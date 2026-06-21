'use strict';
/**
 * parser.js — turns Claude Code .jsonl transcripts into live "agent state",
 * INCREMENTALLY. Transcripts are append-only, so we keep a per-file cursor and
 * only parse the bytes added since last time. That gives us, cheaply and
 * accurately:
 *   - current activity (in-flight tool_use vs tool_result correlation)
 *   - live sub-agents (in-flight Task tools)
 *   - cumulative token usage + estimated cost (whole-session, not just the tail)
 *   - current context-window fill (tokens in the most recent request)
 *
 * Public API: update(file, folder) -> session summary (or null if not usable).
 */

const fs = require('fs');

// ---- tool -> activity category ------------------------------------------
const CAT = {
  code: ['Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'Update', 'Create', 'Apply'],
  read: ['Read', 'Grep', 'Glob', 'LS', 'NotebookRead'],
  shell: ['Bash', 'PowerShell', 'BashOutput', 'KillBash', 'KillShell'],
  web: ['WebSearch', 'WebFetch', 'ToolSearch'],
  delegate: ['Task', 'Agent', 'Workflow'],
  ask: ['AskUserQuestion'],
};
const TOOL2CAT = {};
for (const [cat, names] of Object.entries(CAT)) for (const n of names) TOOL2CAT[n] = cat;
function categorize(tool) {
  if (!tool) return 'think';
  if (TOOL2CAT[tool]) return TOOL2CAT[tool];
  if (tool.startsWith('mcp__')) return 'web';
  return 'work';
}

// ---- model pricing (per token) + context window -------------------------
// Source: Claude API reference (Opus $5/$25, Sonnet $3/$15, Haiku $1/$5 per MTok;
// cache read ×0.1, cache write ×1.25 for 5m / ×2 for 1h TTL).
const PRICE = {
  opus:   { in: 5e-6,  out: 25e-6, ctx: 1_000_000 },
  sonnet: { in: 3e-6,  out: 15e-6, ctx: 1_000_000 },
  haiku:  { in: 1e-6,  out: 5e-6,  ctx: 200_000 },
  fable:  { in: 10e-6, out: 50e-6, ctx: 1_000_000 },
};
function priceFor(model) {
  const m = (model || '').toLowerCase();
  if (m.includes('haiku')) return PRICE.haiku;
  if (m.includes('sonnet')) return PRICE.sonnet;
  if (m.includes('fable') || m.includes('mythos')) return PRICE.fable;
  return PRICE.opus;
}

// ---- helpers ------------------------------------------------------------
function basename(p) { return !p ? '' : p.replace(/[\\/]+$/, '').split(/[\\/]/).pop(); }
function ts(o) { const v = o && o.timestamp ? Date.parse(o.timestamp) : NaN; return Number.isFinite(v) ? v : 0; }
function firstWords(s, n) { return !s ? '' : String(s).replace(/\s+/g, ' ').trim().split(' ').slice(0, n).join(' '); }
function prettyProject(folder, cwd) {
  if (cwd) { const b = basename(cwd); if (b && !/^[a-z]:$/i.test(b)) return b; }
  const s = String(folder || '').replace(/^[a-zA-Z]--/, '');
  const parts = s.split('-'); return parts[parts.length - 1] || s || 'project';
}
function normKey(cwd) { return cwd ? cwd.toLowerCase().replace(/[\\/]+/g, '/').replace(/\/$/, '') : ''; }
function labelFor(cat, tool, input) {
  input = input || {};
  switch (cat) {
    case 'code': return 'editing ' + (basename(input.file_path || input.path || input.notebook_path) || 'a file');
    case 'read':
      if (tool === 'Grep') return 'searching "' + firstWords(input.pattern, 4) + '"';
      if (tool === 'Glob') return 'finding ' + (input.pattern || 'files');
      return 'reading ' + (basename(input.file_path || input.path) || 'files');
    case 'shell': return '$ ' + (firstWords(input.command, 6) || tool);
    case 'web':
      if (tool === 'WebFetch') { try { return 'fetching ' + new URL(input.url).hostname; } catch { return 'fetching web'; } }
      return 'googling "' + firstWords(input.query, 5) + '"';
    case 'delegate': return '→ ' + (firstWords(input.description || input.prompt, 6) || 'sub-agent');
    case 'ask': return 'waiting for you…';
    case 'think': return 'thinking…';
    case 'idle': return 'idle';
    default: return tool || 'working…';
  }
}

// ---- incremental state --------------------------------------------------
const states = new Map(); // file -> state

function freshCounters(s) {
  s.cwd = ''; s.branch = ''; s.version = ''; s.model = '';
  s.firstTs = 0; s.lastTs = 0; s.userTurns = 0; s.msgCount = 0;
  s.inTok = 0; s.outTok = 0; s.cacheRead = 0; s.cacheCreate = 0; s.cacheCreate1h = 0; s.cacheCreate5m = 0; s.reqs = 0;
  s.lastCtx = 0; s.pending = new Map(); s.lastMain = null; s.lastSidechainTs = 0; s.sawSidechain = false;
}
function newState(file) {
  const s = { file, offset: 0, buf: '', sessionId: basename(file).replace(/\.jsonl$/i, '') };
  freshCounters(s); return s;
}

function processLine(s, line) {
  let o; try { o = JSON.parse(line); } catch { return; }
  const t = ts(o);
  if (t) { s.lastTs = Math.max(s.lastTs, t); if (!s.firstTs) s.firstTs = t; }
  if (o.cwd) s.cwd = o.cwd;
  if (o.gitBranch) s.branch = o.gitBranch;
  if (o.version) s.version = o.version;

  const side = o.isSidechain === true;
  if (side) { s.sawSidechain = true; if (t) s.lastSidechainTs = Math.max(s.lastSidechainTs, t); }

  const msg = o.message, role = msg && msg.role, content = msg && msg.content;

  if (o.type === 'assistant' && Array.isArray(content)) {
    if (msg.model) s.model = msg.model;
    const u = msg.usage;
    if (u && !side) {
      s.reqs++;
      const i = u.input_tokens || 0, cr = u.cache_read_input_tokens || 0, cc = u.cache_creation_input_tokens || 0;
      s.inTok += i; s.outTok += u.output_tokens || 0; s.cacheRead += cr; s.cacheCreate += cc;
      if (u.cache_creation) {
        s.cacheCreate1h += u.cache_creation.ephemeral_1h_input_tokens || 0;
        s.cacheCreate5m += u.cache_creation.ephemeral_5m_input_tokens || 0;
      }
      s.lastCtx = i + cr + cc; // tokens in this request ≈ current context occupancy
    }
    let hasTool = false;
    for (const it of content) {
      if (it && it.type === 'tool_use') { hasTool = true; if (!side && it.id) s.pending.set(it.id, { name: it.name, input: it.input, ts: t }); }
    }
    if (!side) s.lastMain = { kind: 'assistant', endTurn: msg.stop_reason === 'end_turn' && !hasTool, hasPrompt: false, ts: t };
    s.msgCount++;
  } else if (o.type === 'user') {
    if (Array.isArray(content)) for (const it of content) if (it && it.type === 'tool_result' && it.tool_use_id) s.pending.delete(it.tool_use_id);
    const isToolResult = !!o.toolUseResult || (Array.isArray(content) && content.some(it => it && it.type === 'tool_result'));
    if (!side && o.isMeta !== true) {
      if (!isToolResult) s.userTurns++;
      s.lastMain = { kind: 'user', endTurn: false, hasPrompt: !isToolResult, ts: t };
    }
    if (role) s.msgCount++;
  }
}

function ingest(s) {
  let fd; try { fd = fs.openSync(s.file, 'r'); } catch { return; }
  try {
    const size = fs.fstatSync(fd).size;
    if (size < s.offset) { freshCounters(s); s.offset = 0; s.buf = ''; } // truncated/rewritten
    if (size === s.offset) return;
    const len = size - s.offset;
    const b = Buffer.allocUnsafe(len);
    fs.readSync(fd, b, 0, len, s.offset);
    s.offset = size;
    const lines = (s.buf + b.toString('utf8')).split('\n');
    s.buf = lines.pop();
    for (const ln of lines) if (ln) processLine(s, ln);
  } catch {} finally { fs.closeSync(fd); }
}

function summarize(s, folder) {
  if (!s.firstTs && !s.lastTs) return null;
  if (s.userTurns === 0 && s.pending.size === 0 && s.msgCount < 2) return null;

  const mainPending = [...s.pending.values()].sort((a, b) => b.ts - a.ts);
  let cat, tool, label;
  if (mainPending.length) {
    const cur = mainPending[0]; tool = cur.name; cat = categorize(tool); label = labelFor(cat, tool, cur.input);
  } else if (s.lastMain && s.lastMain.kind === 'assistant' && s.lastMain.endTurn) {
    cat = 'idle'; tool = null; label = labelFor('idle');
  } else if (s.lastMain && s.lastMain.kind === 'user' && s.lastMain.hasPrompt) {
    cat = 'think'; tool = null; label = 'got a new task…';
  } else { cat = 'think'; tool = null; label = labelFor('think'); }

  const subAgents = mainPending.filter(p => categorize(p.name) === 'delegate').map((p, i) => ({
    id: s.sessionId + ':sub' + i,
    label: firstWords((p.input && (p.input.description || p.input.prompt)) || 'sub-agent', 6),
    agentType: (p.input && (p.input.subagent_type || p.input.agentType)) || 'agent',
    act: 'work', lastActivity: Math.max(p.ts || 0, s.lastSidechainTs) || s.lastTs,
  }));

  const p = priceFor(s.model);
  const cOther = Math.max(0, s.cacheCreate - s.cacheCreate1h - s.cacheCreate5m);
  const cost = s.inTok * p.in + s.outTok * p.out + s.cacheRead * p.in * 0.1
    + s.cacheCreate1h * p.in * 2 + (s.cacheCreate5m + cOther) * p.in * 1.25;
  const totalTokens = s.inTok + s.outTok + s.cacheRead + s.cacheCreate;

  return {
    id: s.sessionId, source: 'claude', project: prettyProject(folder, s.cwd), projectKey: normKey(s.cwd) || folder,
    cwd: s.cwd, branch: s.branch, model: s.model, version: s.version,
    act: cat, tool: tool || null, label, lastActivity: s.lastTs, startedAt: s.firstTs,
    turns: s.userTurns, hasSidechain: s.sawSidechain, subAgents,
    usage: {
      input: s.inTok, output: s.outTok, cacheRead: s.cacheRead, cacheCreate: s.cacheCreate,
      total: totalTokens, requests: s.reqs, cost,
      ctx: s.lastCtx, ctxLimit: p.ctx, ctxPct: p.ctx ? Math.min(1, s.lastCtx / p.ctx) : 0,
    },
  };
}

function update(file, folder) {
  let s = states.get(file);
  if (!s) { s = newState(file); states.set(file, s); }
  ingest(s);
  return summarize(s, folder);
}

module.exports = { update, categorize, prettyProject, priceFor, PRICE };

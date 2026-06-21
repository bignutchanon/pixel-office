'use strict';
/**
 * codex.js — incremental parser for OpenAI Codex CLI session "rollouts"
 * (~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl). Emits the same session
 * summary shape as the Claude parser, tagged source:'codex', so Codex agents
 * appear in the same Pixel Office. Same-cwd Claude + Codex sessions share a pod.
 *
 * Public API: update(file) -> session summary (or null).
 */

const fs = require('fs');

function basename(p) { return !p ? '' : p.replace(/[\\/]+$/, '').split(/[\\/]/).pop(); }
function firstWords(s, n) { return !s ? '' : String(s).replace(/\s+/g, ' ').trim().split(' ').slice(0, n).join(' '); }
function normKey(cwd) { return cwd ? cwd.toLowerCase().replace(/[\\/]+/g, '/').replace(/\/$/, '') : ''; }

function cat(name) {
  const n = (name || '').toLowerCase();
  if (/apply_patch|edit|write|patch|str_replace|create/.test(n)) return 'code';
  if (/exec|shell|bash|command|\brun\b|powershell/.test(n)) return 'shell';
  if (/read|cat|view|grep|glob|search_file/.test(n)) return 'read';
  if (/web|fetch|browser|search/.test(n)) return 'web';
  return 'work';
}
function labelFor(c, name, input) {
  const s = typeof input === 'string' ? input : '';
  if (c === 'shell') {
    const m = /command:\s*"((?:[^"\\]|\\.)*)"/.exec(s);
    const cmd = m ? m[1].replace(/\\(.)/g, '$1') : '';
    return '$ ' + (firstWords(cmd, 6) || name || 'exec');
  }
  if (c === 'code') return 'editing files';
  if (c === 'read') return 'reading';
  if (c === 'web') return 'researching';
  return name || 'working…';
}

const states = new Map();
function freshCounters(s) {
  s.cwd = ''; s.model = ''; s.metaId = '';
  s.firstTs = 0; s.lastTs = 0; s.userTurns = 0; s.msgCount = 0; s.sawAgent = false;
  s.inTok = 0; s.outTok = 0; s.cachedTok = 0; s.totalTok = 0; s.ctx = 0; s.ctxLimit = 0;
  s.pending = new Map(); s.lastMain = null;
}
function newState(file) { const s = { file, offset: 0, buf: '', sessionId: basename(file).replace(/\.jsonl$/i, '') }; freshCounters(s); return s; }

function processLine(s, line) {
  let o; try { o = JSON.parse(line); } catch { return; }
  const t = o.timestamp ? Date.parse(o.timestamp) : 0;
  if (t) { s.lastTs = Math.max(s.lastTs, t); if (!s.firstTs) s.firstTs = t; }
  const p = o.payload || {}, pt = p.type;

  if (o.type === 'session_meta') { if (p.id) s.metaId = p.id; if (p.cwd) s.cwd = p.cwd; }
  else if (o.type === 'turn_context') { if (p.cwd) s.cwd = p.cwd; if (p.model) s.model = p.model; }
  else if (o.type === 'event_msg') {
    if (pt === 'task_started') { if (p.model_context_window) s.ctxLimit = p.model_context_window; }
    else if (pt === 'token_count') {
      const info = p.info || p;
      if (info.model_context_window) s.ctxLimit = info.model_context_window;
      const tu = info.total_token_usage, lu = info.last_token_usage;
      if (tu) { s.inTok = tu.input_tokens || 0; s.cachedTok = tu.cached_input_tokens || 0; s.outTok = tu.output_tokens || 0; s.totalTok = tu.total_tokens || (s.inTok + s.outTok); }
      if (lu) s.ctx = lu.input_tokens || 0;
    }
    else if (pt === 'user_message') { s.userTurns++; s.msgCount++; s.lastMain = { kind: 'user', hasPrompt: true, endTurn: false, ts: t }; }
    else if (pt === 'agent_message') { s.msgCount++; s.sawAgent = true; s.lastMain = { kind: 'assistant', endTurn: false, ts: t }; }
    else if (pt === 'task_complete') { s.lastMain = { kind: 'assistant', endTurn: true, ts: t }; }
  } else if (o.type === 'response_item') {
    if (pt === 'custom_tool_call') { const id = p.call_id || p.id; if (id) s.pending.set(id, { name: p.name, input: p.input, ts: t }); s.msgCount++; s.sawAgent = true; }
    else if (pt === 'custom_tool_call_output') { const id = p.call_id || p.id; if (id) s.pending.delete(id); }
    else if (pt === 'reasoning' && !s.pending.size) s.lastMain = { kind: 'assistant', endTurn: false, think: true, ts: t };
  }
}

function ingest(s) {
  let fd; try { fd = fs.openSync(s.file, 'r'); } catch { return; }
  try {
    const size = fs.fstatSync(fd).size;
    if (size < s.offset) { freshCounters(s); s.offset = 0; s.buf = ''; }
    if (size === s.offset) return;
    const len = size - s.offset, b = Buffer.allocUnsafe(len);
    fs.readSync(fd, b, 0, len, s.offset); s.offset = size;
    const lines = (s.buf + b.toString('utf8')).split('\n');
    s.buf = lines.pop();
    for (const ln of lines) if (ln) processLine(s, ln);
  } catch {} finally { fs.closeSync(fd); }
}

function summarize(s) {
  if (!s.lastTs) return null;
  if (!s.userTurns && !s.pending.size && !s.sawAgent) return null;

  const mp = [...s.pending.values()].sort((a, b) => b.ts - a.ts);
  let c, tool, label;
  if (mp.length) { tool = mp[0].name; c = cat(tool); label = labelFor(c, tool, mp[0].input); }
  else if (s.lastMain && s.lastMain.endTurn) { c = 'idle'; label = 'idle'; }
  else if (s.lastMain && s.lastMain.hasPrompt) { c = 'think'; label = 'got a new task…'; }
  else { c = 'think'; label = 'thinking…'; }

  const ctxLimit = s.ctxLimit || 400000;
  const total = s.totalTok || (s.inTok + s.outTok);
  return {
    id: 'cx-' + (s.metaId || s.sessionId), source: 'codex',
    project: basename(s.cwd) || 'codex', projectKey: normKey(s.cwd) || ('cx:' + s.sessionId),
    cwd: s.cwd, branch: '', model: s.model || 'gpt', version: '',
    act: c, tool: tool || null, label, lastActivity: s.lastTs, startedAt: s.firstTs,
    turns: s.userTurns, hasSidechain: false, subAgents: [],
    usage: {
      input: s.inTok, output: s.outTok, cacheRead: s.cachedTok, cacheCreate: 0,
      total, requests: Math.max(s.userTurns, s.sawAgent ? 1 : 0), cost: null,
      ctx: s.ctx, ctxLimit, ctxPct: ctxLimit ? Math.min(1, s.ctx / ctxLimit) : 0,
    },
  };
}

function update(file) {
  let s = states.get(file);
  if (!s) { s = newState(file); states.set(file, s); }
  ingest(s);
  return summarize(s);
}

module.exports = { update };

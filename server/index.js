'use strict';
/**
 * Pixel Office — zero-dependency server.
 *
 *   node server/index.js
 *
 * Serves the web UI and pushes a live "world" snapshot over Server-Sent Events
 * whenever a Claude Code OR Codex CLI transcript changes. No npm install needed.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const parser = require('./parser.js');   // Claude Code transcripts
const codex = require('./codex.js');     // OpenAI Codex CLI rollouts

const PORT = parseInt(process.env.PIXEL_PORT || '4317', 10);
const PUBLIC = path.join(__dirname, '..', 'public');
const SEND_WINDOW_MS = (parseInt(process.env.PIXEL_WINDOW_HOURS || '12', 10)) * 3600 * 1000;
const HOME = os.homedir();

// ---- sources -----------------------------------------------------------
function isClaudeFile(rel) {
  const parts = rel.split(/[\\/]+/).filter(Boolean);
  return parts.length === 2 && parts[1].toLowerCase().endsWith('.jsonl') && !rel.toLowerCase().includes('subagents');
}
function isCodexFile(rel) {
  const r = rel.toLowerCase();
  return r.endsWith('.jsonl') && r.includes('rollout-');
}
const SOURCES = [
  { name: 'claude', dir: process.env.PIXEL_PROJECTS || path.join(HOME, '.claude', 'projects'), isFile: isClaudeFile,
    scan: (full, rel) => parser.update(full, rel.split(/[\\/]+/).filter(Boolean)[0]) },
  { name: 'codex', dir: process.env.PIXEL_CODEX || path.join(HOME, '.codex', 'sessions'), isFile: isCodexFile,
    scan: (full) => codex.update(full) },
];

const sessions = new Map();   // id -> state
const clients = new Set();    // open SSE responses

function rescan(src, rel) {
  let st; try { st = src.scan(path.join(src.dir, rel), rel); } catch { st = null; }
  if (st) sessions.set(st.id, st);
}
function walk(src, dir, base, depth) {
  if (depth > 7) return;
  let entries; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const rel = base ? base + '/' + e.name : e.name;
    if (e.isDirectory()) walk(src, path.join(dir, e.name), rel, depth + 1);
    else if (e.isFile() && src.isFile(rel)) rescan(src, rel);
  }
}
function fullScan() { for (const src of SOURCES) walk(src, src.dir, '', 0); }

function snapshot() {
  const now = Date.now();
  const list = [];
  for (const s of sessions.values()) if (now - s.lastActivity <= SEND_WINDOW_MS) list.push(s);
  list.sort((a, b) => b.lastActivity - a.lastActivity);
  return { now, sessions: list };
}

// ---- SSE broadcast -----------------------------------------------------
let broadcastTimer = null;
function scheduleBroadcast() {
  if (broadcastTimer) return;
  broadcastTimer = setTimeout(() => {
    broadcastTimer = null;
    const payload = 'data: ' + JSON.stringify(snapshot()) + '\n\n';
    for (const res of clients) { try { res.write(payload); } catch {} }
  }, 120);
}

// ---- file watching -----------------------------------------------------
const dirty = []; // {src, rel}
let scanTimer = null;
function flushDirty() {
  scanTimer = null;
  for (const d of dirty.splice(0)) rescan(d.src, d.rel);
  scheduleBroadcast();
}
function startWatch() {
  for (const src of SOURCES) {
    try {
      fs.watch(src.dir, { recursive: true }, (_evt, filename) => {
        if (!filename) return;
        const rel = String(filename).replace(/\\/g, '/');
        if (!src.isFile(rel)) return;
        dirty.push({ src, rel });
        if (!scanTimer) scanTimer = setTimeout(flushDirty, 150);
      });
      console.log('[pixel-office] watching', src.name, '→', src.dir);
    } catch (e) {
      console.warn(`[pixel-office] watch failed for ${src.name} (${e.message}); periodic scan only`);
    }
  }
  setInterval(() => { fullScan(); scheduleBroadcast(); }, 4000);
}

// ---- static serving ----------------------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
};
function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.normalize(path.join(PUBLIC, urlPath));
  if (!filePath.startsWith(PUBLIC)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write('retry: 2000\n\n');
    res.write('data: ' + JSON.stringify(snapshot()) + '\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  if (url === '/api/world') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(snapshot(), null, 2));
  }
  serveStatic(req, res);
});

server.listen(PORT, () => {
  fullScan();
  startWatch();
  const addr = `http://localhost:${PORT}`;
  console.log(`\n  🏢  Pixel Office running at  ${addr}`);
  console.log(`      sessions found: ${sessions.size}  (claude + codex)\n`);
  if (process.platform === 'win32' && !process.env.PIXEL_NO_OPEN) exec(`start "" "${addr}"`);
});

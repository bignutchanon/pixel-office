'use strict';
/**
 * Pixel Office — VS Code extension host.
 *
 * Reads Claude Code transcripts directly (full Node fs access in the extension
 * host), reconstructs per-session agent state with the shared parser, and pushes
 * snapshots into a Webview via postMessage. No server, no port. Works in VS Code,
 * Cursor, Windsurf, VSCodium (shared extension API).
 */

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const parser = require('./parser.js');
const codex = require('./codex.js');

let panel = null;
let watchers = [];
let scanTimer = null;
let heartbeat = null;
let dirty = [];
const sessions = new Map();

function cfg() {
  const c = vscode.workspace.getConfiguration('pixelOffice');
  const claudeDir = (c.get('projectsDir') || '').trim() || path.join(os.homedir(), '.claude', 'projects');
  const codexDir = path.join(os.homedir(), '.codex', 'sessions');
  const windowMs = (Number(c.get('windowHours')) || 12) * 3600 * 1000;
  return { claudeDir, codexDir, windowMs };
}

// ---- multi-source transcript scanning (Claude Code + Codex CLI) ----
function isClaudeFile(rel) {
  const parts = rel.split(/[\\/]+/).filter(Boolean);
  return parts.length === 2 && parts[1].toLowerCase().endsWith('.jsonl') && !rel.toLowerCase().includes('subagents');
}
function isCodexFile(rel) { const r = rel.toLowerCase(); return r.endsWith('.jsonl') && r.includes('rollout-'); }
function sources() {
  const { claudeDir, codexDir } = cfg();
  return [
    { name: 'claude', dir: claudeDir, isFile: isClaudeFile, scan: (full, rel) => parser.update(full, rel.split(/[\\/]+/).filter(Boolean)[0]) },
    { name: 'codex', dir: codexDir, isFile: isCodexFile, scan: (full) => codex.update(full) },
  ];
}
function rescan(src, rel) { let st; try { st = src.scan(path.join(src.dir, rel), rel); } catch { st = null; } if (st) sessions.set(st.id, st); }
function walk(src, dir, base, depth) {
  if (depth > 7) return;
  let entries; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const rel = base ? base + '/' + e.name : e.name;
    if (e.isDirectory()) walk(src, path.join(dir, e.name), rel, depth + 1);
    else if (e.isFile() && src.isFile(rel)) rescan(src, rel);
  }
}
function fullScan() { for (const src of sources()) walk(src, src.dir, '', 0); }
function snapshot() {
  const { windowMs } = cfg();
  const now = Date.now();
  const list = [];
  for (const s of sessions.values()) if (now - s.lastActivity <= windowMs) list.push(s);
  list.sort((a, b) => b.lastActivity - a.lastActivity);
  return { now, sessions: list };
}
function broadcast() { if (panel) panel.webview.postMessage({ type: 'world', data: snapshot() }); }

function startWatch() {
  fullScan();
  for (const src of sources()) {
    try {
      watchers.push(fs.watch(src.dir, { recursive: true }, (_evt, filename) => {
        if (!filename) return;
        const rel = String(filename).replace(/\\/g, '/');
        if (!src.isFile(rel)) return;
        dirty.push({ src, rel });
        if (!scanTimer) scanTimer = setTimeout(() => { scanTimer = null; for (const d of dirty.splice(0)) rescan(d.src, d.rel); broadcast(); }, 150);
      }));
    } catch (e) { vscode.window.showWarningMessage('Pixel Office: watch failed for ' + src.name + ' — ' + e.message); }
  }
  heartbeat = setInterval(() => { fullScan(); broadcast(); }, 4000);
}
function stopWatch() {
  for (const w of watchers) { try { w.close(); } catch {} }
  watchers = [];
  if (scanTimer) { clearTimeout(scanTimer); scanTimer = null; }
  if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
  dirty = [];
}

// ---- webview ----
function mediaUri(webview, ctx, ...p) {
  return webview.asWebviewUri(vscode.Uri.file(path.join(ctx.extensionPath, 'media', ...p)));
}
function getHtml(webview, ctx) {
  const nonce = crypto.randomBytes(16).toString('hex');
  const cssUri = mediaUri(webview, ctx, 'css', 'style.css');
  const mainUri = mediaUri(webview, ctx, 'js', 'main.js');
  const base = mediaUri(webview, ctx); // media root, for loading optional image assets
  const csp = [
    `default-src 'none'`,
    `img-src ${webview.cspSource} data:`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `font-src ${webview.cspSource}`,
    `connect-src ${webview.cspSource}`,
    `script-src 'nonce-${nonce}' ${webview.cspSource}`,
  ].join('; ');
  // NOTE: body markup must stay in sync with public/index.html
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="${cssUri}" />
  <title>Pixel Office</title>
</head>
<body>
  <header id="bar">
    <div class="brand">🏢 <b>Pixel&nbsp;Office</b> <span class="sub">live Claude&nbsp;Code agents</span></div>
    <div id="stat" class="stat">connecting…</div>
    <div id="legend" class="legend"></div>
    <div class="right">
      <span id="usage" class="usage"></span>
      <span class="hint">scroll&nbsp;zoom · drag&nbsp;pan · dbl-click&nbsp;fit</span>
      <span id="conn" class="dot off" title="connection"></span>
    </div>
  </header>
  <canvas id="stage"></canvas>
  <div id="empty" class="empty hidden">
    <div class="emoji">💤</div>
    <div>No Claude Code sessions active in the last 45 minutes.</div>
    <div class="muted">Open a Claude Code terminal and watch an agent walk in ✨</div>
  </div>
  <script nonce="${nonce}">window.__ASSET_BASE = ${JSON.stringify(base.toString() + '/')};</script>
  <script type="module" nonce="${nonce}" src="${mainUri}"></script>
</body>
</html>`;
}

function openPanel(ctx) {
  if (panel) { panel.reveal(); return; }
  panel = vscode.window.createWebviewPanel(
    'pixelOffice', 'Pixel Office', vscode.ViewColumn.Active,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.file(path.join(ctx.extensionPath, 'media'))],
    }
  );
  panel.webview.html = getHtml(panel.webview, ctx);
  panel.webview.onDidReceiveMessage((m) => { if (m && m.type === 'ready') broadcast(); });
  panel.onDidDispose(() => { panel = null; stopWatch(); });
  startWatch();
  broadcast();
}

function activate(ctx) {
  ctx.subscriptions.push(vscode.commands.registerCommand('pixelOffice.open', () => openPanel(ctx)));
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  status.text = '$(organization) Pixel Office';
  status.tooltip = 'Open the Pixel Office';
  status.command = 'pixelOffice.open';
  status.show();
  ctx.subscriptions.push(status);
}

function deactivate() { stopWatch(); }

module.exports = { activate, deactivate };

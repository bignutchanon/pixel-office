// main.js — wires SSE / VS Code transport -> world + characters -> game loop.

import { Scene } from './render.js';
import { World } from './world.js';
import { Character } from './agent.js';
import { TUNE, BEHAVIOR, ACT, fmtTokens, fmtCost } from './config.js';
import { connect } from './net.js';
import { Assets } from './assets.js';

Assets.load(); // optional image sprites; falls back to procedural art if absent

// activity legend from the shared table
(() => {
  const el = document.getElementById('legend');
  const show = ['code', 'read', 'shell', 'web', 'delegate', 'ask', 'think', 'idle'];
  el.innerHTML = show.map(k => `<span class="item"><span class="sw" style="background:${ACT[k].color}"></span>${ACT[k].name}</span>`).join('');
})();

const scene = new Scene(document.getElementById('stage'));
const world = new World();
const chars = new Map();
let lastSnapshot = { now: Date.now(), sessions: [] };

const shortName = (project, id) => `${project || 'session'} #${(id || '').slice(0, 4)}`;

function reconcile(snap) {
  lastSnapshot = snap;
  const now = Date.now();
  const present = snap.sessions.filter(s => now - s.lastActivity < TUNE.presentMs);
  world.sync(present.map(s => ({ id: s.id, projectKey: s.projectKey, project: s.project })));

  const seen = new Set();
  for (const s of present) {
    seen.add(s.id);
    let c = chars.get(s.id);
    if (!c) { c = new Character(s.id, { spawnX: world.door.x, spawnY: world.door.y, name: shortName(s.project, s.id), source: s.source }); chars.set(s.id, c); }
    if (c.mode === 'leaving') c.mode = 'enter';
    c.name = shortName(s.project, s.id);
    c.subCount = (s.subAgents || []).length;
    c.setState(s);

    (s.subAgents || []).forEach((sub) => {
      seen.add(sub.id);
      let sc = chars.get(sub.id);
      if (!sc) { sc = new Character(sub.id, { isSub: true, parentId: s.id, spawnX: world.door.x, spawnY: world.door.y, name: (sub.agentType || 'agent').slice(0, 12), source: s.source }); chars.set(sub.id, sc); }
      if (sc.mode === 'leaving') sc.mode = 'enter';
      sc.setState({ act: sub.act || 'work', label: sub.label, lastActivity: sub.lastActivity });
    });
  }

  for (const [id, c] of chars) {
    if (seen.has(id)) continue;
    if (c.isSub) c.dead = true;                 // interns vanish when their task ends
    else if (c.mode !== 'leaving') c.leaveTo(world.door.x, world.door.y);
  }
  world.gcClaims(seen);
  updateHud();
}

function chatPass() {
  const arr = [...chars.values()].filter(c => !c.moving && (c.behavior === 'break' || c.behavior === 'meeting'));
  for (const c of arr) c.chatWith = false;
  for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
    const a = arr[i], b = arr[j];
    if (Math.hypot(a.x - b.x, a.y - b.y) < BEHAVIOR.chatDist) {
      a.chatWith = true; b.chatWith = true;
      a.chatFace = a.x <= b.x ? 'right' : 'left';  // turn to face whoever you're talking to
      b.chatFace = a.x <= b.x ? 'left' : 'right';
    }
  }
}

function updateHud() {
  let working = 0, present = 0, subs = 0, onbreak = 0, cdx = 0;
  for (const c of chars.values()) {
    if (c.isSub) { subs++; continue; }
    if (c.present) present++;
    if (c.active) working++;
    if (c.behavior === 'break') onbreak++;
    if (c.source === 'codex' && c.present) cdx++;
  }
  document.getElementById('stat').textContent =
    `${working} working · ${present} in office${cdx ? ` (${cdx} codex)` : ''}${onbreak ? ` · ${onbreak} on break` : ''}${subs ? ` · ${subs} sub-agents` : ''}`;
  document.getElementById('empty').classList.toggle('hidden', present > 0);

  let cost = 0, tok = 0;
  for (const s of lastSnapshot.sessions) if (s.usage) { tok += s.usage.total || 0; if (s.usage.cost != null) cost += s.usage.cost; }
  const usageEl = document.getElementById('usage');
  if (usageEl) usageEl.textContent = `Σ ${fmtTokens(tok)} tok · ~${fmtCost(cost)}`;
}

connect(reconcile, (ok) => { document.getElementById('conn').className = 'dot ' + (ok ? 'on' : 'off'); });

let last = performance.now();
function frame(t) {
  const dt = Math.min(0.05, Math.max(0, (t - last) / 1000)); last = t;
  const now = Date.now();
  for (const [id, c] of chars) { c.update(dt, now, world); if (c.dead) chars.delete(id); }
  chatPass();
  scene.render(world, chars, t);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
setInterval(updateHud, 1000);

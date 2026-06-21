// render.js — camera, walls + commons floor, depth-sorted scene, emotes, labels.

import { TILE, DESK_W, DESK_H, POD_HEADER, WALL, actInfo, ctxColor, fmtCost, fmtTokens } from './config.js';
import { drawWorkstation, drawPerson, drawPlant, drawAmenity, drawEmote, drawRug, drawWindow, drawClock, drawPoster, drawStool } from './sprites.js';
import { Assets } from './assets.js';

const AMENITY_H = { coffee: 22, cooler: 18, sofa: 20, plant: 16, whiteboard: 4, meeting: 38, servers: 44, bookshelf: 30 };

// ---- image-sprite helpers (used when assets are present; else procedural) ----
let _floorPat = null, _floorPatImg = null;
function floorPattern(ctx) {
  const img = Assets.obj('floor'); if (!img) return null;
  if (_floorPatImg !== img) { try { _floorPat = ctx.createPattern(img, 'repeat'); } catch { _floorPat = null; } _floorPatImg = img; }
  return _floorPat;
}
function drawCharImage(ctx, occ) {
  const sheet = Assets.charFor(occ.id); if (!sheet) return false;
  const { img, cols, rows } = sheet;
  const cw = img.width / cols, ch = img.height / rows;
  const dirRows = Assets.layout().dirRows || ['down', 'left', 'right', 'up'];
  let dir = occ.dir, col = 0;
  if (occ.pose === 'desk') dir = 'up';
  else if (occ.pose === 'sofa') dir = 'down';
  // meetsit / inspect keep occ.dir so seats face the table / the server rack
  else if (occ.moving) col = Math.floor(occ.phase * 2) % cols;
  let row = dirRows.indexOf(dir); if (row < 0) row = 0;
  const seated = occ.pose === 'meetsit' || occ.pose === 'sofa';
  const dh = (occ.isSub ? 22 : 28) * (seated ? 0.82 : 1), dw = dh * (cw / ch);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath(); ctx.ellipse(Math.round(occ.x), Math.round(occ.y), 7, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.drawImage(img, col * cw, row * ch, cw, ch, Math.round(occ.x - dw / 2), Math.round(occ.y - dh), Math.round(dw), Math.round(dh));
  return true;
}
function drawAgent(ctx, occ) {
  if (!drawCharImage(ctx, occ)) drawPerson(ctx, occ.x, occ.y, occ.drawOpts());
}
function drawDeskUnit(ctx, cx, cy, screen, glyph, busy, t) {
  const img = Assets.obj('desk');
  if (img) { const w = DESK_W - 6, h = w * (img.height / img.width); ctx.drawImage(img, Math.round(cx + 3), Math.round(cy + 6), Math.round(w), Math.round(h)); }
  else drawWorkstation(ctx, cx, cy, screen, glyph, busy, t);
}
// target footprints (world units) so high-res generated PNGs render at the right size
const OBJ_W = { coffee: 16, cooler: 11, sofa: 48, plant: 13, whiteboard: 80, meeting: 92, servers: 64, bookshelf: 40 };
function drawAmenityUnit(ctx, a, t) {
  const img = Assets.obj(a.type);
  if (img) {
    const w = OBJ_W[a.type] || 24, h = w * (img.height / img.width);
    ctx.drawImage(img, Math.round(a.x), Math.round(a.y), Math.round(w), Math.round(h));
  } else drawAmenity(ctx, a, t);
}

export class Scene {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.max(1, window.devicePixelRatio || 1);
    this.W = 0; this.H = 0;
    this.scale = 3; this.camX = 100; this.camY = 100;
    this.autofit = true; this._drag = null;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this._bindInput();
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.W = r.width; this.H = r.height;
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
  }

  _bindInput() {
    const c = this.canvas;
    c.addEventListener('wheel', (e) => {
      e.preventDefault(); this.autofit = false;
      const old = this.scale;
      this.scale = Math.max(1, Math.min(6, this.scale + (e.deltaY < 0 ? 1 : -1)));
      if (this.scale !== old) {
        const wx = this.camX + (e.offsetX - this.W / 2) / old, wy = this.camY + (e.offsetY - this.H / 2) / old;
        this.camX = wx - (e.offsetX - this.W / 2) / this.scale;
        this.camY = wy - (e.offsetY - this.H / 2) / this.scale;
      }
    }, { passive: false });
    c.addEventListener('mousedown', (e) => { this._drag = { x: e.clientX, y: e.clientY, cx: this.camX, cy: this.camY }; this.autofit = false; });
    window.addEventListener('mousemove', (e) => {
      if (!this._drag) return;
      this.camX = this._drag.cx - (e.clientX - this._drag.x) / this.scale;
      this.camY = this._drag.cy - (e.clientY - this._drag.y) / this.scale;
    });
    window.addEventListener('mouseup', () => { this._drag = null; });
    c.addEventListener('dblclick', () => { this.autofit = true; });
  }

  fit(b) {
    if (!this.autofit || !b) return;
    const sx = Math.floor((this.W - 70) / b.w), sy = Math.floor((this.H - 110) / b.h);
    this.scale = Math.max(1, Math.min(6, Math.min(sx, sy) || 1));
    this.camX = b.x + b.w / 2; this.camY = b.y + b.h / 2;
  }

  w2s(wx, wy) { return [(wx - this.camX) * this.scale + this.W / 2, (wy - this.camY) * this.scale + this.H / 2]; }

  render(world, chars, now) {
    const ctx = this.ctx, dpr = this.dpr;
    this.fit(world.bounds);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.W, this.H);
    ctx.fillStyle = '#161b21'; ctx.fillRect(0, 0, this.W, this.H);

    const tx = Math.round((-this.camX) * this.scale + this.W / 2);
    const ty = Math.round((-this.camY) * this.scale + this.H / 2);
    ctx.setTransform(this.scale * dpr, 0, 0, this.scale * dpr, tx * dpr, ty * dpr);
    ctx.imageSmoothingEnabled = false;

    this._floorAndWalls(ctx, world);

    // pod rugs + sign plaques
    for (const pod of world.podsForRender()) {
      ctx.fillStyle = '#262d37'; ctx.fillRect(pod.x, pod.y + POD_HEADER, pod.w, pod.h - POD_HEADER);
      ctx.fillStyle = '#2f3744'; ctx.fillRect(pod.x, pod.y + POD_HEADER, pod.w, 3);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
      ctx.strokeRect(pod.x + 1.5, pod.y + POD_HEADER + 4.5, pod.w - 3, pod.h - POD_HEADER - 6);
      ctx.fillStyle = '#39424f'; ctx.fillRect(pod.x + 6, pod.y + 4, pod.w - 12, 13);
      ctx.fillStyle = '#4a90e0'; ctx.fillRect(pod.x + 6, pod.y + 4, 4, 13);
    }

    // ---- depth-sorted units ----
    const units = [];
    const byId = chars;

    for (const [sid] of world.assign) {
      const cell = world.cell(sid); if (!cell) continue;
      const occ = byId.get(sid);
      const active = occ && occ.active && occ.sitting;
      const info = occ ? actInfo(occ.act) : actInfo('idle');
      const screen = active ? info.mon : '#0a0d10';
      const glyph = active ? info.glyph : '';
      units.push({
        y: cell.cy + DESK_H - 4, draw: () => {
          drawDeskUnit(ctx, cell.cx, cell.cy, screen, glyph, occ && occ.busy, now);
          if (occ && occ.sitting) drawAgent(ctx, occ);
        },
      });
    }
    for (const a of world.amenities) units.push({ y: a.y + (AMENITY_H[a.type] || 16), draw: () => drawAmenityUnit(ctx, a, now) });
    for (const occ of byId.values()) {
      if (occ.sitting) continue;
      units.push({
        y: occ.y, draw: () => {
          if (occ.pose === 'meetsit') drawStool(ctx, occ.x, occ.y);
          if (occ.isSub && !Assets.charFor(occ.id)) {
            ctx.save(); ctx.translate(occ.x, occ.y); ctx.scale(0.82, 0.82); ctx.translate(-occ.x, -occ.y);
            drawPerson(ctx, occ.x, occ.y, occ.drawOpts()); ctx.restore();
          } else drawAgent(ctx, occ);
        },
      });
    }
    units.sort((a, b) => a.y - b.y);
    for (const u of units) u.draw();

    // collaboration links — agents sharing a pod are working together;
    // a brighter green dashed line marks cross-team (Claude ⇄ Codex) pairs.
    const byPod = new Map();
    for (const [sid, a] of world.assign) {
      const occ = byId.get(sid);
      if (!occ || !occ.present) continue;
      let g = byPod.get(a.podKey); if (!g) byPod.set(a.podKey, g = []);
      g.push(occ);
    }
    for (const g of byPod.values()) {
      if (g.length < 2) continue;
      for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
        const a = g[i], b = g[j], cross = a.source !== b.source;
        ctx.strokeStyle = cross ? 'rgba(110,230,160,0.6)' : 'rgba(255,255,255,0.10)';
        ctx.lineWidth = 1;
        ctx.setLineDash(cross ? [3, 3] : [2, 5]);
        ctx.beginPath(); ctx.moveTo(a.x, a.y - 14); ctx.lineTo(b.x, b.y - 14); ctx.stroke();
      }
    }
    ctx.setLineDash([]);

    // emotes (world space, above everything)
    for (const occ of byId.values()) {
      if (!occ.emote || (!occ.present && occ.mode !== 'leaving')) continue;
      drawEmote(ctx, occ.x, occ.y - (occ.isSub ? 24 : 30), occ.emote, now);
    }

    // ---- screen-space overlays (crisp text) ----
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const pod of world.podsForRender()) {
      const [lx, ly] = this.w2s(pod.x + pod.w / 2, pod.y + 11);
      ctx.font = '700 11px ui-monospace, Menlo, Consolas, monospace';
      ctx.fillStyle = '#cdd8e6'; ctx.fillText(pod.label.toUpperCase(), lx, ly);
    }
    for (const occ of byId.values()) {
      if (!occ.present && occ.mode !== 'leaving') continue;
      const [sx, sy] = this.w2s(occ.x, occ.y);
      if (sx < -120 || sx > this.W + 120 || sy < -80 || sy > this.H + 80) continue;
      const headY = sy - (occ.isSub ? 26 : 34) * (this.scale / 3 + 0.4);
      this._bubble(ctx, sx, headY, occ);
      ctx.font = '600 10px ui-monospace, Menlo, Consolas, monospace';
      const isCodex = occ.source === 'codex';
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillText(occ.name, sx + 1, sy + 11);
      ctx.fillStyle = occ.isSub ? '#9fb3c8' : (isCodex ? '#9fe6c4' : '#eaf1f8');
      ctx.fillText(occ.name, sx, sy + 10);
      // team chip — blue = Claude, green = Codex
      if (!occ.isSub) {
        const nw = ctx.measureText(occ.name).width;
        ctx.fillStyle = isCodex ? '#10a37f' : '#4a90e0';
        ctx.fillRect(sx - nw / 2 - 9, sy + 4, 5, 8);
      }
      // per-agent context-fill bar + cost (Claude) or tokens (Codex)
      const u = occ.usage;
      if (u && !occ.isSub && u.requests > 0) {
        const bw = 42, bh = 4, bx = sx - bw / 2, by = sy + 16;
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = ctxColor(u.ctxPct); ctx.fillRect(bx, by, Math.max(1, bw * u.ctxPct), bh);
        ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1; ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
        ctx.font = '600 9px ui-monospace, Menlo, Consolas, monospace';
        ctx.fillStyle = '#9fb3c8';
        const right = (u.cost != null) ? fmtCost(u.cost) : fmtTokens(u.total) + ' tok';
        ctx.fillText(`${Math.round(u.ctxPct * 100)}% ctx · ${right}`, sx, by + bh + 7);
      }
    }
  }

  _bubble(ctx, cx, cy, occ) {
    const info = actInfo(occ.act);
    const text = occ.label || info.name;
    ctx.font = '600 10px ui-monospace, Menlo, Consolas, monospace';
    const tw = Math.min(220, ctx.measureText(text).width);
    const w = tw + 22, h = 16, x = cx - w / 2, y = cy - h;
    const idle = occ.act === 'idle' || !occ.active;
    ctx.globalAlpha = idle ? 0.6 : 1;
    roundRect(ctx, x, y, w, h, 5);
    ctx.fillStyle = 'rgba(20,24,30,0.92)'; ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = info.color + (idle ? '66' : 'cc'); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 3, y + h); ctx.lineTo(cx + 3, y + h); ctx.lineTo(cx, y + h + 4); ctx.closePath();
    ctx.fillStyle = 'rgba(20,24,30,0.92)'; ctx.fill();
    ctx.fillStyle = info.color; ctx.beginPath(); ctx.arc(x + 9, y + h / 2, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8eef5'; ctx.textAlign = 'left'; ctx.fillText(text, x + 16, y + h / 2 + 0.5, tw);
    ctx.textAlign = 'center'; ctx.globalAlpha = 1;
  }

  _floorAndWalls(ctx, world) {
    const f = world.floorRect;
    const pat = floorPattern(ctx);
    if (pat) {
      ctx.fillStyle = pat; ctx.fillRect(f.x, f.y, f.w, f.h);
    } else {
      ctx.fillStyle = '#20262e'; ctx.fillRect(f.x, f.y, f.w, f.h);
      const c = world.commons;
      ctx.fillStyle = '#242c36'; ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(c.x, c.y, c.w, 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.025)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = f.x; x <= f.x + f.w; x += TILE) { ctx.moveTo(x, f.y); ctx.lineTo(x, f.y + f.h); }
      for (let y = f.y; y <= f.y + f.h; y += TILE) { ctx.moveTo(f.x, y); ctx.lineTo(f.x + f.w, y); }
      ctx.stroke();
    }
    for (const rg of (world.decor && world.decor.rugs) || []) drawRug(ctx, rg.x, rg.y, rg.w, rg.h, rg.color);
    this._walls(ctx, world);
  }

  _walls(ctx, world) {
    const f = world.floorRect, o = { x: f.x - WALL, y: f.y - WALL, w: f.w + 2 * WALL, h: f.h + 2 * WALL };
    const wall = '#2b323d', cap = '#3a4350';
    const dh = 16, dcx = world.door.x;
    const seg = (x, y, w, h) => { ctx.fillStyle = wall; ctx.fillRect(x, y, w, h); ctx.fillStyle = cap; ctx.fillRect(x, y, w, 3); };
    // top (split around the door gap)
    seg(o.x, o.y, (dcx - dh) - o.x, WALL);
    seg(dcx + dh, o.y, (o.x + o.w) - (dcx + dh), WALL);
    // door posts
    ctx.fillStyle = '#4a90e0'; ctx.fillRect(dcx - dh, o.y + WALL - 3, 3, 3); ctx.fillRect(dcx + dh - 3, o.y + WALL - 3, 3, 3);
    // doormat
    ctx.fillStyle = '#37404d'; ctx.fillRect(dcx - 12, f.y, 24, 7);
    // bottom, left, right
    seg(o.x, o.y + o.h - WALL, o.w, WALL);
    seg(o.x, o.y, WALL, o.h);
    seg(o.x + o.w - WALL, o.y, WALL, o.h);

    // wall fittings — windows, framed posters, a clock by the door
    const d = world.decor || {};
    for (const wd of d.windows || []) drawWindow(ctx, wd.x, wd.y);
    for (const ps of d.posters || []) drawPoster(ctx, ps.x, ps.y, ps.c);
    if (d.clock) drawClock(ctx, d.clock.x, d.clock.y);
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

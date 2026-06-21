// world.js — sandbox office layout.
//   • upper area: one "pod" (desk cluster) per project, stable seat assignment
//   • lower "commons" band: coffee corner, lounge sofa, meeting room, server
//     room, plants — with a claimable spot pool so characters don't overlap.

import {
  DESK_W, DESK_H, POD_PAD, POD_HEADER, POD_GAP, MAX_ROW_W, SEAT_DX, SEAT_DY,
  WALL, COMMONS_H, MIN_OFFICE_W,
} from './config.js';

const S = (x, y) => ({ x, y });

export class World {
  constructor() {
    this.pods = new Map();
    this.podOrder = [];
    this.assign = new Map();          // sessionId -> {podKey, deskIndex}
    this.bounds = { x: 0, y: 0, w: 200, h: 200 };
    this.floorRect = { x: 0, y: 0, w: 200, h: 200 };
    this.door = { x: 100, y: -34 };
    this.officeW = MIN_OFFICE_W;

    this.commons = { x: 0, y: 0, w: MIN_OFFICE_W, h: COMMONS_H };
    this.amenities = [];              // {type,x,y} furniture in the commons
    this.spots = { coffee: [], lounge: [], meeting: [] };
    this.wanderPts = [];
    this.claims = new Map();          // charId -> {type, idx}
    this.byKey = new Map();           // "type#idx" -> charId
  }

  sync(present) {
    const ids = new Set(present.map(s => s.id));
    for (const id of [...this.assign.keys()]) if (!ids.has(id)) this.assign.delete(id);

    for (const s of present) {
      const key = s.projectKey || s.project || 'misc';
      if (!this.pods.has(key)) {
        this.pods.set(key, { key, label: s.project || key, deskCount: 1, x: 0, y: 0, cols: 1, rows: 1, w: 0, h: 0 });
        this.podOrder.push(key);
      } else this.pods.get(key).label = s.project || this.pods.get(key).label;
      if (!this.assign.has(s.id)) {
        const used = new Set();
        for (const a of this.assign.values()) if (a.podKey === key) used.add(a.deskIndex);
        let idx = 0; while (used.has(idx)) idx++;
        this.assign.set(s.id, { podKey: key, deskIndex: idx });
      }
    }

    const maxIdx = new Map();
    for (const a of this.assign.values()) maxIdx.set(a.podKey, Math.max(maxIdx.get(a.podKey) ?? -1, a.deskIndex));
    for (const key of [...this.pods.keys()]) {
      if (!maxIdx.has(key)) { this.pods.delete(key); this.podOrder = this.podOrder.filter(k => k !== key); }
    }

    // pack pods into rows
    let rowX = 0, rowY = 0, rowH = 0, maxW = 0;
    for (const key of this.podOrder) {
      const pod = this.pods.get(key); if (!pod) continue;
      pod.deskCount = (maxIdx.get(key) ?? 0) + 1;
      pod.cols = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(pod.deskCount))));
      pod.rows = Math.ceil(pod.deskCount / pod.cols);
      pod.w = POD_PAD * 2 + pod.cols * DESK_W;
      pod.h = POD_HEADER + POD_PAD * 2 + pod.rows * DESK_H;
      if (rowX > 0 && rowX + pod.w > MAX_ROW_W) { rowY += rowH + POD_GAP; rowX = 0; rowH = 0; }
      pod.x = rowX; pod.y = rowY;
      rowX += pod.w + POD_GAP; rowH = Math.max(rowH, pod.h); maxW = Math.max(maxW, pod.x + pod.w);
    }

    const podsBottom = rowY + rowH;
    const officeW = Math.max(maxW, MIN_OFFICE_W);
    this.officeW = officeW;
    this._layoutCommons(officeW, podsBottom);

    const bottom = this.commons.y + this.commons.h;
    this.floorRect = { x: 0, y: 0, w: officeW, h: bottom };
    this.door = { x: officeW / 2, y: -34 };
    this.bounds = { x: -WALL - 6, y: -50, w: officeW + 2 * WALL + 12, h: bottom + WALL + 56 };
  }

  _layoutCommons(officeW, podsBottom) {
    const cy = Math.max(podsBottom + 28, 60);
    this.commons = { x: 0, y: cy, w: officeW, h: COMMONS_H };
    this.amenities = [];
    this.spots = { coffee: [], lounge: [], meeting: [] };
    this.wanderPts = [];

    // coffee corner (left)
    const cofX = 22, cofY = cy + 30;
    this.amenities.push({ type: 'coffee', x: cofX, y: cofY });
    this.amenities.push({ type: 'cooler', x: cofX + 40, y: cofY + 2 });
    this.spots.coffee.push(S(cofX + 8, cofY + 32), S(cofX + 30, cofY + 36));

    // lounge sofa (left-center)
    const loX = 118, loY = cy + 34;
    this.amenities.push({ type: 'sofa', x: loX, y: loY });
    this.amenities.push({ type: 'plant', x: loX + 60, y: loY + 2 });
    this.spots.lounge.push(S(loX + 12, loY + 16), S(loX + 34, loY + 16));

    // meeting room (center-right): whiteboard + table + 6 seats
    const mtX = Math.max(loX + 156, Math.round(officeW * 0.46));
    const mtY = cy + 30, tH = 38;
    this.amenities.push({ type: 'whiteboard', x: mtX + 6, y: mtY - 22 });
    this.amenities.push({ type: 'meeting', x: mtX, y: mtY });
    [[18, -10], [46, -10], [74, -10], [18, tH + 2], [46, tH + 2], [74, tH + 2]]
      .forEach(([dx, dy]) => this.spots.meeting.push(S(mtX + dx, mtY + dy)));

    // server room (right)
    const svX = officeW - 92, svY = cy + 14;
    this.amenities.push({ type: 'servers', x: svX, y: svY });
    this.amenities.push({ type: 'plant', x: svX - 24, y: svY + 44 });
    this.amenities.push({ type: 'bookshelf', x: 60, y: cy + COMMONS_H - 30 });

    // wander waypoints along the front aisle
    const n = 7;
    for (let i = 0; i < n; i++) this.wanderPts.push(S(34 + i * ((officeW - 68) / (n - 1)), cy + COMMONS_H - 20));
  }

  // ---- desk helpers ----
  cell(sessionId) {
    const a = this.assign.get(sessionId); if (!a) return null;
    const pod = this.pods.get(a.podKey); if (!pod) return null;
    const col = a.deskIndex % pod.cols, row = (a.deskIndex / pod.cols) | 0;
    return { cx: pod.x + POD_PAD + col * DESK_W, cy: pod.y + POD_HEADER + POD_PAD + row * DESK_H };
  }
  seat(sessionId) { const c = this.cell(sessionId); return c ? S(c.cx + SEAT_DX, c.cy + SEAT_DY) : null; }
  subSeat(parentId, n) {
    const c = this.cell(parentId); if (!c) return null;
    const spots = [S(c.cx + 2, c.cy + SEAT_DY + 6), S(c.cx + DESK_W - 2, c.cy + SEAT_DY + 6), S(c.cx + SEAT_DX, c.cy + SEAT_DY + 14)];
    return spots[n % spots.length];
  }

  // ---- claimable amenity spots ----
  claimSpot(type, id) {
    const cur = this.claims.get(id);
    if (cur && cur.type === type) return this.spots[type][cur.idx];
    this.releaseClaim(id);
    const arr = this.spots[type] || [];
    for (let i = 0; i < arr.length; i++) {
      const k = type + '#' + i;
      if (!this.byKey.has(k)) { this.byKey.set(k, id); this.claims.set(id, { type, idx: i }); return arr[i]; }
    }
    return null;
  }
  releaseClaim(id) {
    const c = this.claims.get(id);
    if (c) { this.byKey.delete(c.type + '#' + c.idx); this.claims.delete(id); }
  }
  gcClaims(aliveIds) { for (const id of [...this.claims.keys()]) if (!aliveIds.has(id)) this.releaseClaim(id); }

  wanderPoint() {
    if (!this.wanderPts.length) return this.door;
    return this.wanderPts[Math.floor(Math.random() * this.wanderPts.length)];
  }

  podsForRender() { return this.podOrder.map(k => this.pods.get(k)).filter(Boolean); }
}

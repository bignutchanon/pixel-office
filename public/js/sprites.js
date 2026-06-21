// sprites.js — all pixel art is drawn procedurally (no image assets).
// Drawn in WORLD units; render.js applies the camera transform with smoothing off.

const R = Math.round;
function rect(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(R(x), R(y), R(w), R(h)); }
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.min(255, r * f); g = Math.min(255, g * f); b = Math.min(255, b * f);
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

// ============================================================ workstation
export function drawWorkstation(ctx, cx, cy, screenColor, glyph, typing, t) {
  const p = (x, y, w, h, c) => rect(ctx, cx + x, cy + y, w, h, c);
  const W = 46;
  p(W / 2 - 7, 38, 14, 12, '#3a3f4b'); p(W / 2 - 7, 38, 14, 3, '#4b5160');  // chair
  p(5, 14, W - 10, 16, '#6b4a2f'); p(5, 14, W - 10, 3, '#83613f'); p(5, 28, W - 10, 2, '#4f3620'); // desk
  p(7, 30, 3, 8, '#4f3620'); p(W - 10, 30, 3, 8, '#4f3620');
  const mx = W / 2 - 11;
  p(mx + 9, 9, 4, 6, '#222'); p(mx, 1, 22, 14, '#15181d'); p(mx + 2, 3, 18, 10, screenColor);
  drawScreenGlyph(ctx, cx + mx + 2, cy + 3, glyph, t);
  p(W / 2 - 8, 24, 16, 4, '#cdd3da');                                       // keyboard
}
function drawScreenGlyph(ctx, x, y, glyph, t) {
  const blink = (Math.floor((t || 0) / 350) % 2) === 0;
  const p = (px, py, pw, ph, c) => { ctx.fillStyle = c; ctx.fillRect(R(x + px), R(y + py), R(pw), R(ph)); };
  const g = 'rgba(255,255,255,0.85)';
  switch (glyph) {
    case 'code': p(2, 2, 6, 1, '#a0ffa0'); p(2, 4, 10, 1, '#a0ffa0'); p(4, 6, 7, 1, '#a0ffa0'); p(2, 8, 4, 1, '#a0ffa0'); break;
    case 'term': p(2, 2, 3, 1, '#96ff96'); p(6, 2, 1, 1, '#96ff96'); if (blink) p(2, 7, 4, 1, '#96ff96'); break;
    case 'book': p(2, 2, 6, 1, '#c8ebff'); p(2, 4, 8, 1, '#c8ebff'); p(2, 6, 5, 1, '#c8ebff'); p(2, 8, 7, 1, '#c8ebff'); break;
    case 'globe': p(6, 1, 6, 1, '#ffebb4'); p(4, 3, 10, 1, '#ffebb4'); p(4, 5, 10, 1, '#ffebb4'); p(6, 7, 6, 1, '#ffebb4'); p(8, 1, 1, 8, '#ffebb4'); break;
    case 'team': p(3, 4, 3, 3, '#e1c8ff'); p(3, 2, 3, 1, '#e1c8ff'); p(10, 4, 3, 3, '#e1c8ff'); p(10, 2, 3, 1, '#e1c8ff'); break;
    case 'ask': if (blink) { p(7, 1, 4, 1, '#fff'); p(10, 2, 1, 2, '#fff'); p(7, 4, 3, 1, '#fff'); p(7, 6, 1, 1, '#fff'); p(7, 8, 1, 1, '#fff'); } break;
    case 'gear': p(7, 1, 3, 8, g); p(4, 4, 9, 2, g); p(5, 2, 7, 5, g); break;
    case 'dots': { const n = Math.floor((t || 0) / 300) % 3 + 1; for (let i = 0; i < n; i++) p(3 + i * 4, 5, 2, 2, g); } break;
    default: break;
  }
}

// ============================================================ amenities
export function drawAmenity(ctx, a, t) {
  const f = ({
    coffee: drawCoffee, cooler: drawCooler, sofa: drawSofa, plant: drawPlant,
    whiteboard: drawWhiteboard, meeting: drawMeetingTable, servers: drawServers, bookshelf: drawBookshelf,
  })[a.type];
  if (f) f(ctx, a.x, a.y, t);
}

export function drawPlant(ctx, x, y) {
  const p = (a, b, w, h, c) => rect(ctx, x + a, y + b, w, h, c);
  p(1, 8, 8, 7, '#7a4a2a'); p(1, 8, 8, 2, '#915a34');
  p(2, 1, 6, 8, '#2f7d3e'); p(0, 3, 3, 4, '#368a47'); p(7, 3, 3, 4, '#2a6e37');
}
export function drawCooler(ctx, x, y) {
  const p = (a, b, w, h, c) => rect(ctx, x + a, y + b, w, h, c);
  p(0, 6, 10, 12, '#dfe7ee'); p(2, 0, 6, 8, '#7fd3ff'); p(1, 11, 8, 2, '#9fb0bf');
}
function drawCoffee(ctx, x, y, t) {
  const p = (a, b, w, h, c) => rect(ctx, x + a, y + b, w, h, c);
  p(0, 0, 16, 22, '#454b57'); p(0, 0, 16, 3, '#565d6b');     // machine body
  p(2, 5, 12, 6, '#23272f'); p(3, 6, 10, 4, (Math.floor((t || 0) / 500) % 2 ? '#7CFF6B' : '#2f5a39')); // display
  p(5, 13, 6, 5, '#cdb79a'); p(11, 14, 1, 3, '#cdb79a');     // pot
  p(4, 18, 8, 2, '#2b2f37');
}
function drawSofa(ctx, x, y) {
  const p = (a, b, w, h, c) => rect(ctx, x + a, y + b, w, h, c);
  p(0, 4, 48, 16, '#41506b'); p(0, 0, 48, 6, '#4d5d7c');     // back
  p(0, 4, 6, 16, '#4d5d7c'); p(42, 4, 6, 16, '#4d5d7c');     // arms
  p(7, 8, 16, 10, '#56678a'); p(25, 8, 16, 10, '#56678a');   // cushions
}
function drawMeetingTable(ctx, x, y) {
  const p = (a, b, w, h, c) => rect(ctx, x + a, y + b, w, h, c);
  p(0, 0, 92, 38, '#5b4632'); p(0, 0, 92, 4, '#6f573e'); p(4, 4, 84, 30, '#6a523a'); // table top
  p(20, 12, 52, 14, '#7a6045');                                                       // inlay
}
function drawWhiteboard(ctx, x, y, t) {
  const p = (a, b, w, h, c) => rect(ctx, x + a, y + b, w, h, c);
  p(0, 0, 80, 26, '#20242c'); p(2, 2, 76, 22, '#eef2f6');    // board
  p(6, 6, 30, 2, '#5b8def'); p(6, 11, 44, 2, '#e0574f'); p(6, 16, 22, 2, '#5fbf5a');
  p(54, 7, 20, 12, (Math.floor((t || 0) / 700) % 2 ? '#7b6ce0' : '#c0b4f0'));
}
function drawServers(ctx, x, y, t) {
  const p = (a, b, w, h, c) => rect(ctx, x + a, y + b, w, h, c);
  for (let i = 0; i < 3; i++) {
    const rx = i * 22;
    p(rx, 0, 20, 44, '#23262c'); p(rx, 0, 20, 3, '#30343c');
    for (let j = 0; j < 5; j++) {
      const on = (Math.floor((t || 0) / 240) + i * 2 + j) % 3 === 0;
      p(rx + 3, 6 + j * 7, 14, 4, '#15171b');
      p(rx + 4, 7 + j * 7, 2, 2, on ? '#7CFF6B' : '#2b5a33');
      p(rx + 8, 7 + j * 7, 2, 2, on ? '#FFD166' : '#5a4d22');
    }
  }
}
function drawBookshelf(ctx, x, y) {
  const p = (a, b, w, h, c) => rect(ctx, x + a, y + b, w, h, c);
  p(0, 0, 40, 30, '#5a4631'); p(2, 2, 36, 12, '#3a2e20'); p(2, 16, 36, 12, '#3a2e20');
  const cols = ['#e0574f', '#5fbf5a', '#5b8def', '#e7c53b', '#c45fb0'];
  for (let i = 0; i < 8; i++) { p(3 + i * 4.4, 3, 3, 10, cols[i % 5]); p(3 + i * 4.4, 17, 3, 10, cols[(i + 2) % 5]); }
}

// ============================================================ character
export function drawPerson(ctx, x, y, o) {
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath(); ctx.ellipse(R(x), R(y), 7, 3, 0, 0, Math.PI * 2); ctx.fill();
  const pose = o.pose || (o.sitting ? 'desk' : (o.moving ? 'walk' : 'stand'));
  if (pose === 'desk') return drawSeatedBack(ctx, x, y, o);
  if (pose === 'sofa' || pose === 'meetsit') return drawSeatedFront(ctx, x, y, o, pose);
  return drawStanding(ctx, x, y, o, pose);
}

function drawStanding(ctx, x, y, o, pose) {
  const p = (a, b, w, h, c) => rect(ctx, a, b, w, h, c);
  const sk = o.skin, sh = o.shirt, pa = o.pants;
  const ph = o.phase || 0;
  const moving = pose === 'walk';
  const sw = moving ? Math.sin(ph) : 0;
  const bob = moving ? Math.abs(Math.sin(ph)) * 1.2 : Math.sin(o.bob || 0) * 0.6;
  const Y = y - bob;
  const lOff = moving ? sw * 2 : 0;
  p(x - 4, Y - 7 + Math.max(0, lOff), 3, 7 - Math.abs(lOff), pa);
  p(x + 1, Y - 7 + Math.max(0, -lOff), 3, 7 - Math.abs(lOff), pa);
  p(x - 4, Y - 16, 8, 9, sh); p(x - 4, Y - 16, 8, 2, shade(sh, 1.15));
  if (o.team) p(x - 1, Y - 13, 2, 2, o.team);

  let armL = 0, armR = 0, raiseL = false, raiseR = false, cup = false;
  if (moving) { armL = -sw * 2; armR = sw * 2; }
  else if (pose === 'drink') { raiseR = true; cup = true; }
  else if (pose === 'wave') { raiseR = true; armR = Math.sin(ph * 4) * 1.5; }
  else if (pose === 'stretch') { raiseL = raiseR = true; }
  else if (o.busy) { armL = Math.sin(ph * 2) * 1.2; armR = -armL; }

  if (raiseL) { p(x - 6, Y - 20, 2, 8, sh); p(x - 6, Y - 21, 2, 2, sk); }
  else { p(x - 6, Y - 15 + armL, 2, 7, sh); p(x - 6, Y - 9 + armL, 2, 2, sk); }
  if (raiseR) {
    const ry = pose === 'wave' ? armR : 0;
    p(x + 4, Y - 21 + ry, 2, 9, sh); p(x + 4, Y - 23 + ry, 2, 2, sk);
    if (cup) { p(x + 3, Y - 24, 4, 3, '#d7d2c8'); p(x + 3, Y - 24, 4, 1, '#b9b3a6'); }
  } else { p(x + 4, Y - 15 + armR, 2, 7, sh); p(x + 4, Y - 9 + armR, 2, 2, sk); }

  drawHead(ctx, x, Y - 20, o, o.dir || 'down');
}

function drawSeatedBack(ctx, x, y, o) {
  const p = (a, b, w, h, c) => rect(ctx, a, b, w, h, c);
  const sk = o.skin, hr = o.hair, sh = o.shirt, ph = o.phase || 0;
  p(x - 5, y - 14, 10, 10, sh); p(x - 5, y - 14, 10, 2, shade(sh, 0.85));
  if (o.team) p(x - 1, y - 12, 2, 2, o.team);
  const tap = o.busy ? Math.sin(ph * 3) * 1.0 : 0;
  p(x - 7, y - 13, 2, 8 + tap, sh); p(x + 5, y - 13, 2, 8 - tap, sh);
  p(x - 4, y - 22, 8, 8, sk);
  if (!o.bald) { p(x - 4, y - 22, 8, 5, hr); p(x - 4, y - 22, 2, 8, hr); p(x + 2, y - 22, 2, 8, hr); }
}

function drawSeatedFront(ctx, x, y, o, pose) {
  const p = (a, b, w, h, c) => rect(ctx, a, b, w, h, c);
  const sk = o.skin, sh = o.shirt, pa = o.pants;
  p(x - 4, y - 5, 3, 5, pa); p(x + 1, y - 5, 3, 5, pa);
  p(x - 4, y - 14, 8, 9, sh); p(x - 4, y - 14, 8, 2, shade(sh, 1.15));
  if (o.team) p(x - 1, y - 11, 2, 2, o.team);
  if (pose === 'meetsit') { p(x - 6, y - 11, 2, 6, sh); p(x + 4, y - 11, 2, 6, sh); p(x - 6, y - 6, 2, 2, sk); p(x + 4, y - 6, 2, 2, sk); }
  else { p(x - 6, y - 13, 2, 7, sh); p(x + 4, y - 13, 2, 7, sh); p(x - 6, y - 7, 2, 2, sk); p(x + 4, y - 7, 2, 2, sk); }
  drawHead(ctx, x, y - 22, o, 'down');
}

function drawHead(ctx, x, top, o, dir) {
  const p = (a, b, w, h, c) => rect(ctx, a, b, w, h, c);
  const sk = o.skin, hr = o.hair;
  p(x - 4, top, 8, 8, sk);
  if (!o.bald) {
    p(x - 4, top, 8, 3, hr);
    if (dir === 'up') p(x - 4, top, 8, 8, hr);
    if (dir === 'left') p(x - 4, top, 3, 8, hr);
    if (dir === 'right') p(x + 1, top, 3, 8, hr);
  }
  ctx.fillStyle = '#23252b';
  if (dir === 'down') { ctx.fillRect(R(x - 2), R(top + 4), 1, 2); ctx.fillRect(R(x + 1), R(top + 4), 1, 2); }
  else if (dir === 'left') ctx.fillRect(R(x - 2), R(top + 4), 1, 2);
  else if (dir === 'right') ctx.fillRect(R(x + 1), R(top + 4), 1, 2);
}

// floating emote above the head (world space)
export function drawEmote(ctx, x, y, glyph, t) {
  if (!glyph) return;
  const bob = Math.sin((t || 0) / 300) * 1;
  const bx = x + 5, by = y - 2 + bob;
  const p = (a, b, w, h, c) => rect(ctx, bx + a, by + b, w, h, c);
  p(-1, -1, 12, 11, 'rgba(20,24,30,0.9)');
  const g = 'rgba(255,255,255,0.95)';
  switch (glyph) {
    case '!': p(4, 1, 2, 5, '#ff5c5c'); p(4, 7, 2, 2, '#ff5c5c'); break;
    case '?': p(3, 1, 4, 1, '#ffd166'); p(6, 2, 1, 2, '#ffd166'); p(4, 4, 2, 1, '#ffd166'); p(4, 7, 1, 1, '#ffd166'); break;
    case 'zzz': p(2, 2, 4, 1, g); p(5, 3, 1, 2, g); p(2, 5, 4, 1, g); break;
    case 'dots': { const n = Math.floor((t || 0) / 300) % 3 + 1; for (let i = 0; i < n; i++) p(1 + i * 3, 5, 2, 2, g); } break;
    case 'coffee': p(2, 3, 6, 5, '#cdb79a'); p(8, 4, 1, 2, '#cdb79a'); p(2, 2, 6, 1, '#7a5a3a'); break;
    case 'idea': p(4, 1, 3, 4, '#ffe08a'); p(4, 6, 3, 1, '#caa84a'); break;
    default: break;
  }
}

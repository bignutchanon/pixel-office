'use strict';
// Normalize an AI-generated character sprite sheet into a clean, evenly-spaced
// 4×4 grid so the runtime slicer lines up. Detects the 16 frames from the
// transparent gutters, crops each, and repacks them centered + bottom(feet)-
// aligned into uniform square cells.
//   node scripts/normalize-sheet.cjs <input.png> [output.png] [cols] [rows]
// Default output: public/assets/characters/<basename>.png

const fs = require('fs');
const path = require('path');
const { decodePNG, encodeRGBA } = require('./process-sets.cjs');

function bands(prof) {
  const raw = []; let s = -1;
  for (let i = 0; i < prof.length; i++) { if (prof[i] > 2) { if (s < 0) s = i; } else if (s >= 0) { raw.push([s, i - 1]); s = -1; } }
  if (s >= 0) raw.push([s, prof.length - 1]);
  const merged = [];
  for (const b of raw) { const last = merged[merged.length - 1]; if (last && b[0] - last[1] <= 12) last[1] = b[1]; else merged.push([b[0], b[1]]); }
  return merged.filter(b => b[1] - b[0] + 1 >= 16);
}
function evenBands(len, n) { const out = []; for (let i = 0; i < n; i++) out.push([Math.floor(i * len / n), Math.floor((i + 1) * len / n) - 1]); return out; }

const input = process.argv[2];
if (!input) { console.error('usage: node scripts/normalize-sheet.cjs <input.png> [output.png] [cols] [rows]'); process.exit(1); }
const COLS = parseInt(process.argv[4] || '4', 10), ROWS = parseInt(process.argv[5] || '4', 10);
const output = process.argv[3] || path.join(__dirname, '..', 'public', 'assets', 'characters', path.basename(input));

const img = decodePNG(input);
const { w, h, bpp, data } = img;
const A = (x, y) => (bpp === 4 ? data[(y * w + x) * bpp + 3] : 255);
if (bpp !== 4) console.warn('! sheet has no alpha — frame detection may be poor; expecting a transparent sheet.');

const colP = new Array(w).fill(0), rowP = new Array(h).fill(0);
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (A(x, y) > 16) { colP[x]++; rowP[y]++; }
let cB = bands(colP), rB = bands(rowP);
if (cB.length !== COLS) { console.warn(`detected ${cB.length} columns, expected ${COLS} -> even split`); cB = evenBands(w, COLS); }
if (rB.length !== ROWS) { console.warn(`detected ${rB.length} rows, expected ${ROWS} -> even split`); rB = evenBands(h, ROWS); }

const frames = [];
let maxW = 1, maxH = 1;
for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
  const [x0, x1] = cB[c], [y0, y1] = rB[r];
  let minX = x1, minY = y1, maxX = x0, maxY = y0, any = false;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (A(x, y) > 16) { any = true; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  const fw = any ? maxX - minX + 1 : 1, fh = any ? maxY - minY + 1 : 1;
  const buf = Buffer.alloc(fw * fh * 4);
  if (any) for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
    const si = ((minY + y) * w + (minX + x)) * bpp, di = (y * fw + x) * 4;
    buf[di] = data[si]; buf[di + 1] = data[si + 1]; buf[di + 2] = data[si + 2]; buf[di + 3] = A(minX + x, minY + y);
  }
  frames.push({ fw, fh, buf });
  maxW = Math.max(maxW, fw); maxH = Math.max(maxH, fh);
}

const cell = Math.max(maxW, maxH) + 6;
const margin = 2;
const OW = cell * COLS, OH = cell * ROWS, out = Buffer.alloc(OW * OH * 4);
frames.forEach((f, i) => {
  const c = i % COLS, r = (i / COLS) | 0;
  const dx = c * cell + Math.floor((cell - f.fw) / 2);
  const dy = r * cell + (cell - f.fh) - margin;
  for (let y = 0; y < f.fh; y++) for (let x = 0; x < f.fw; x++) {
    const si = (y * f.fw + x) * 4; if (f.buf[si + 3] === 0) continue;
    const di = ((dy + y) * OW + (dx + x)) * 4;
    out[di] = f.buf[si]; out[di + 1] = f.buf[si + 1]; out[di + 2] = f.buf[si + 2]; out[di + 3] = f.buf[si + 3];
  }
});

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, encodeRGBA(OW, OH, out));
console.log(`${path.basename(input)} ${w}x${h} -> ${path.relative(path.join(__dirname, '..'), output)} ${OW}x${OH} (cell ${cell}, ${COLS}x${ROWS})`);

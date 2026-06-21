'use strict';
// Slice a 3x3 furniture sheet into 9 transparent object PNGs (no deps).
// Decodes the PNG, removes the (baked) light checker background via border
// flood-fill, crops each object to its content, writes RGBA PNGs.
//   node scripts/process-sets.cjs [path-to-furniture_set.png]

const fs = require('fs');
const path = require('path');
const os = require('os');
const zlib = require('zlib');

function decodePNG(file) {
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 1, 4) !== 'PNG') throw new Error('not a PNG');
  let off = 8, w, h, bd, ct; const idat = [];
  while (off < b.length) {
    const len = b.readUInt32BE(off), type = b.toString('ascii', off + 4, off + 8), data = b.slice(off + 8, off + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bd = data[8]; ct = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (bd !== 8) throw new Error('bit depth ' + bd + ' unsupported');
  const bpp = ct === 6 ? 4 : ct === 2 ? 3 : null;
  if (!bpp) throw new Error('color type ' + ct + ' unsupported');
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * bpp, recon = Buffer.alloc(h * stride);
  const paeth = (a, bb, c) => { const p = a + bb - c, pa = Math.abs(p - a), pb = Math.abs(p - bb), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? bb : c; };
  let p = 0;
  for (let y = 0; y < h; y++) {
    const ft = raw[p++];
    for (let x = 0; x < stride; x++) {
      const v = raw[p++];
      const a = x >= bpp ? recon[y * stride + x - bpp] : 0;
      const u = y > 0 ? recon[(y - 1) * stride + x] : 0;
      const c = (x >= bpp && y > 0) ? recon[(y - 1) * stride + x - bpp] : 0;
      let r;
      switch (ft) { case 0: r = v; break; case 1: r = v + a; break; case 2: r = v + u; break; case 3: r = v + ((a + u) >> 1); break; case 4: r = v + paeth(a, u, c); break; default: throw new Error('filter ' + ft); }
      recon[y * stride + x] = r & 0xff;
    }
  }
  return { w, h, bpp, data: recon };
}

const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0); const t = Buffer.from(type, 'ascii'); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0); return Buffer.concat([len, t, data, crc]); }
function encodeRGBA(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const stride = w * 4, raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) { raw[y * (stride + 1)] = 0; rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride); }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const isBg = (r, g, b) => r >= 162 && g >= 162 && b >= 162 && (Math.max(r, g, b) - Math.min(r, g, b)) <= 45;

function processCell(src, ox, oy, cw, ch) {
  const { bpp, data, w } = src;
  const rgba = Buffer.alloc(cw * ch * 4);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const si = ((oy + y) * w + (ox + x)) * bpp, di = (y * cw + x) * 4;
    rgba[di] = data[si]; rgba[di + 1] = data[si + 1]; rgba[di + 2] = data[si + 2]; rgba[di + 3] = 255;
  }
  const visited = new Uint8Array(cw * ch), q = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= cw || y >= ch) return;
    const i = y * cw + x; if (visited[i]) return; const di = i * 4;
    if (!isBg(rgba[di], rgba[di + 1], rgba[di + 2])) return;
    visited[i] = 1; rgba[di + 3] = 0; q.push(i);
  };
  for (let x = 0; x < cw; x++) { push(x, 0); push(x, ch - 1); }
  for (let y = 0; y < ch; y++) { push(0, y); push(cw - 1, y); }
  while (q.length) { const i = q.pop(), x = i % cw, y = (i / cw) | 0; push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1); }
  let minX = cw, minY = ch, maxX = -1, maxY = -1;
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) if (rgba[(y * cw + x) * 4 + 3] > 0) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  if (maxX < 0) return { w: cw, h: ch, rgba };
  const pad = 4; minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad); maxX = Math.min(cw - 1, maxX + pad); maxY = Math.min(ch - 1, maxY + pad);
  const bw = maxX - minX + 1, bh = maxY - minY + 1, out = Buffer.alloc(bw * bh * 4);
  for (let y = 0; y < bh; y++) rgba.copy(out, y * bw * 4, ((minY + y) * cw + minX) * 4, ((minY + y) * cw + minX + bw) * 4);
  return { w: bw, h: bh, rgba: out };
}

module.exports = { decodePNG, encodeRGBA, processCell };

if (require.main === module) {
  const input = process.argv[2] || path.join(os.homedir(), 'Downloads', 'pixel_arts', 'furniture_set.png');
  const outDir = path.join(__dirname, '..', 'public', 'assets', 'objects');
  fs.mkdirSync(outDir, { recursive: true });
  const NAMES = [['desk', 'sofa', 'coffee'], ['cooler', 'meeting', 'plant'], ['servers', 'whiteboard', 'bookshelf']];
  const src = decodePNG(input);
  const cw = Math.floor(src.w / 3), ch = Math.floor(src.h / 3);
  console.log(`${path.basename(input)}  ${src.w}x${src.h} (bpp ${src.bpp})  ->  cells ${cw}x${ch}`);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    const name = NAMES[r][c], cell = processCell(src, c * cw, r * ch, cw, ch);
    fs.writeFileSync(path.join(outDir, name + '.png'), encodeRGBA(cell.w, cell.h, cell.rgba));
    console.log(`  ${name}.png  ${cell.w}x${cell.h}`);
  }
  console.log('done -> public/assets/objects/');
}

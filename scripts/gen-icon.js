'use strict';
// Generates a 128x128 PNG app icon (pixel character + "working" glow) with no
// external deps. Writes extension/icon.png.   node scripts/gen-icon.js

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const W = 128, H = 128, S = 4; // 32x32 design scaled x4
const px = Buffer.alloc(W * H * 4);
function set(x, y, r, g, b, a = 255) { if (x < 0 || y < 0 || x >= W || y >= H) return; const o = (y * W + x) * 4; px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = a; }
function R(gx, gy, gw, gh, c) { for (let j = 0; j < gh * S; j++) for (let i = 0; i < gw * S; i++) set(gx * S + i, gy * S + j, c[0], c[1], c[2]); }

const C = {
  bg: [22, 27, 33], floor: [32, 38, 46], wall: [43, 67, 80],
  skin: [241, 201, 165], hair: [43, 33, 24], shirt: [25, 195, 154],
  dark: [21, 24, 29], screen: [124, 255, 107], white: [240, 245, 250],
};

R(0, 0, 32, 32, C.bg);
R(0, 25, 32, 7, C.floor);
R(0, 23, 32, 2, C.wall);
// character (centered)
R(11, 13, 10, 12, C.shirt);
R(9, 14, 2, 8, C.shirt); R(21, 14, 2, 8, C.shirt);  // arms
R(15, 16, 2, 3, C.white);                            // chest badge
R(12, 5, 8, 8, C.skin);                              // head
R(12, 5, 8, 3, C.hair);                              // hair
R(14, 9, 1, 1, C.dark); R(17, 9, 1, 1, C.dark);      // eyes
// little "working" monitor glow (top-right)
R(22, 5, 7, 6, C.dark); R(23, 6, 5, 4, C.screen);

// ---- encode PNG (RGBA, no deps) ----
const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
const raw = Buffer.alloc(H * (W * 4 + 1));
for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; px.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4); }
const idat = zlib.deflateSync(raw, { level: 9 });
const png = Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);

const out = path.join(__dirname, '..', 'extension', 'icon.png');
fs.writeFileSync(out, png);
console.log('wrote', path.relative(path.join(__dirname, '..'), out), png.length, 'bytes (128x128)');

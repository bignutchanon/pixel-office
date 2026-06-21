'use strict';
// Scans public/assets/{characters,objects} and (re)writes manifest.json.
//   node scripts/gen-assets-manifest.js
// Character sheets default to a 4x4 grid (4 walk frames x 4 directions).
// Edit a file's cols/rows in manifest.json afterwards if your sheet differs
// (e.g. an RPG-Maker 3x4 sheet -> "cols": 3).

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const aDir = path.join(root, 'public', 'assets');

function pngSize(file) {
  try {
    const fd = fs.openSync(file, 'r'); const b = Buffer.alloc(24);
    fs.readSync(fd, b, 0, 24, 0); fs.closeSync(fd);
    if (b.toString('ascii', 1, 4) !== 'PNG') return null;
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  } catch { return null; }
}
function listPng(dir) { try { return fs.readdirSync(dir).filter(f => /\.png$/i.test(f)); } catch { return []; } }

const manifestPath = path.join(aDir, 'manifest.json');
let m = { characters: { cols: 4, rows: 4, dirRows: ['down', 'left', 'right', 'up'], files: [] }, objects: {} };
try { m = { ...m, ...JSON.parse(fs.readFileSync(manifestPath, 'utf8')) }; } catch {}
m.characters = m.characters || { cols: 4, rows: 4, dirRows: ['down', 'left', 'right', 'up'], files: [] };
const cols = m.characters.cols || 4, rows = m.characters.rows || 4;

const chars = listPng(path.join(aDir, 'characters')).sort();
m.characters.files = chars.map(f => ({ file: f, cols, rows }));

const objs = {};
for (const f of listPng(path.join(aDir, 'objects'))) objs[f.replace(/\.png$/i, '')] = f;
m.objects = objs;

fs.mkdirSync(aDir, { recursive: true });
fs.writeFileSync(manifestPath, JSON.stringify(m, null, 2) + '\n');

console.log(`manifest: ${chars.length} character sheet(s), ${Object.keys(objs).length} object(s)`);
for (const f of chars) {
  const s = pngSize(path.join(aDir, 'characters', f));
  console.log(`  char  ${f}  ${s ? `${s.w}x${s.h} -> cell ${Math.round(s.w / cols)}x${Math.round(s.h / rows)}` : '(size?)'}`);
}
for (const n of Object.keys(objs)) console.log(`  obj   ${n}`);
console.log('Done. Refresh the browser. For the VS Code extension: node scripts/sync-extension.js then repackage.');

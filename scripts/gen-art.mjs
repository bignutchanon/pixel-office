// gen-art.mjs — generate the whole Pixel Office art set with OpenAI's image
// model (gpt-image-1) and drop it into public/assets/, then refresh the manifest.
//
//   set  OPENAI_API_KEY  in your environment, then:
//   node scripts/gen-art.mjs            # characters + furniture
//   node scripts/gen-art.mjs chars      # characters only
//   node scripts/gen-art.mjs objects    # furniture only
//
// No dependencies. Each image is one gpt-image-1 call (costs money) — quality is
// set to "medium"; lower it to "low" to save cost, raise to "high" for detail.
// Run it yourself (or have Codex run it) with your own key — this repo never
// reads your key.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const KEY = process.env.OPENAI_API_KEY;
const QUALITY = process.env.PIXEL_ART_QUALITY || 'medium'; // low | medium | high
const which = (process.argv[2] || 'all').toLowerCase();

if (!KEY) {
  console.error('✗ OPENAI_API_KEY is not set.\n  PowerShell:  $env:OPENAI_API_KEY="sk-..."\n  bash:        export OPENAI_API_KEY=sk-...\n  then re-run: node scripts/gen-art.mjs');
  process.exit(1);
}

const SHEET =
  'Top-down RPG character sprite sheet, single PNG, fully transparent background ' +
  '(no scene, no floor shadow, no grid lines, no text). 4 columns x 4 rows grid, ' +
  'all 16 cells equal size. Each ROW is one facing direction as a 4-frame walk cycle, ' +
  'row order top to bottom: DOWN (toward viewer), LEFT, RIGHT, UP (away). Column 1 is ' +
  'the idle frame. Character centered in each cell, feet near the bottom, identical ' +
  'design and colors across all 16 frames. 16-bit SNES JRPG pixel-art, crisp pixels, ' +
  'bold outline, limited palette. Character: ';

const CHARACTERS = [
  ['char1.png', 'a software developer with a teal hoodie, glasses, and headphones'],
  ['char2.png', 'a woman with a red blazer holding a coffee mug, brown bob haircut'],
  ['char3.png', 'a person in a bright yellow raincoat with messy black hair'],
  ['char4.png', 'a friendly boxy robot intern with a single round glowing eye'],
  ['char5.png', 'a man with a green flannel shirt, beanie, and a short beard'],
  ['char6.png', 'a woman with purple hair, oversized denim jacket, and earbuds'],
];

const OBJ = (thing) => `Top-down pixel-art ${thing}, single object centered, fully transparent background, no shadow, no text, 16-bit SNES style, crisp pixels, bold outline.`;
const OBJECTS = [
  ['desk.png', OBJ('office desk seen from above with a computer monitor and keyboard')],
  ['sofa.png', OBJ('two-seat lounge sofa seen from above')],
  ['coffee.png', OBJ('coffee machine with a pot')],
  ['cooler.png', OBJ('office water cooler')],
  ['meeting.png', OBJ('long wooden conference/meeting table seen from above')],
  ['plant.png', OBJ('potted green office plant')],
  ['servers.png', OBJ('server rack with blinking status lights')],
  ['whiteboard.png', OBJ('whiteboard with colorful marker scribbles')],
  ['bookshelf.png', OBJ('bookshelf full of colorful books seen from above')],
];

async function genImage(prompt, outPath) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-image-1', prompt, size: '1024x1024', background: 'transparent', quality: QUALITY, n: 1 }),
  });
  if (!res.ok) { throw new Error(`${res.status} ${await res.text()}`.slice(0, 300)); }
  const json = await res.json();
  const b64 = json.data && json.data[0] && json.data[0].b64_json;
  if (!b64) throw new Error('no image data in response');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, Buffer.from(b64, 'base64'));
}

async function run(list, subdir) {
  const dir = path.join(ROOT, 'public', 'assets', subdir);
  fs.mkdirSync(dir, { recursive: true });
  for (const [file, prompt] of list) {
    process.stdout.write(`  ${subdir}/${file} … `);
    try { await genImage(prompt, path.join(dir, file)); console.log('ok'); }
    catch (e) { console.log('FAILED:', e.message); }
  }
}

console.log(`Generating art with gpt-image-1 (quality=${QUALITY}). Each image costs money.\n`);
if (which === 'all' || which === 'chars') { console.log('Characters:'); await run(CHARACTERS.map(([f, d]) => [f, SHEET + d]), 'characters'); }
if (which === 'all' || which === 'objects') { console.log('Objects:'); await run(OBJECTS, 'objects'); }

console.log('\nUpdating manifest…');
spawnSync('node', [path.join(ROOT, 'scripts', 'gen-assets-manifest.js')], { stdio: 'inherit' });
console.log('\nDone. Refresh http://localhost:4317  (for the extension: node scripts/sync-extension.js then repackage).');

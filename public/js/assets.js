// assets.js — optional image sprites (ChatGPT-generated). If assets are present
// they're used; otherwise the renderer falls back to procedural pixel art, so
// the app always works. Loads in both the standalone web app and the VS Code
// webview (which sets window.__ASSET_BASE to the media URI).

const BASE = (typeof window !== 'undefined' && window.__ASSET_BASE) ? window.__ASSET_BASE : '/';

const charSheets = [];        // [{ img, cols, rows }]
const objImgs = {};           // name -> HTMLImageElement
let layout = { cols: 4, rows: 4, dirRows: ['down', 'left', 'right', 'up'] };

function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function loadImg(url) {
  return new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = url + (url.includes('?') ? '&' : '?') + 'v=' + Date.now(); });
}

async function load() {
  let mani = null;
  try { const r = await fetch(BASE + 'assets/manifest.json', { cache: 'no-cache' }); if (r.ok) mani = await r.json(); } catch {}
  if (!mani) { Assets.ready = true; return; }

  if (mani.characters) layout = { ...layout, ...mani.characters };
  const files = (mani.characters && mani.characters.files) || [];
  for (const f of files) {
    const file = typeof f === 'string' ? f : f.file;
    const cols = (typeof f === 'object' && f.cols) || layout.cols;
    const rows = (typeof f === 'object' && f.rows) || layout.rows;
    const img = await loadImg(BASE + 'assets/characters/' + file);
    if (img) charSheets.push({ img, cols, rows });
  }
  for (const [name, file] of Object.entries(mani.objects || {})) {
    const img = await loadImg(BASE + 'assets/objects/' + file);
    if (img) objImgs[name] = img;
  }
  Assets.ready = true;
}

export const Assets = {
  ready: false,
  load,
  hasChars() { return charSheets.length > 0; },
  charFor(id) { return charSheets.length ? charSheets[hash(id || 'x') % charSheets.length] : null; },
  layout() { return layout; },
  obj(name) { return objImgs[name] || null; },
};

'use strict';
// Copies the shared front-end + parser into the extension so it packages
// self-contained. Single source of truth lives in public/ and server/.
//   node scripts/sync-extension.js

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const ext = path.join(root, 'extension');
const media = path.join(ext, 'media');

function copy(src, dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true });
  console.log('  ' + path.relative(root, src) + '  ->  ' + path.relative(root, dest));
}

fs.mkdirSync(media, { recursive: true });
console.log('Syncing extension assets:');
copy(path.join(root, 'public', 'js'), path.join(media, 'js'));
copy(path.join(root, 'public', 'css'), path.join(media, 'css'));
if (fs.existsSync(path.join(root, 'public', 'assets'))) copy(path.join(root, 'public', 'assets'), path.join(media, 'assets'));
fs.copyFileSync(path.join(root, 'server', 'parser.js'), path.join(ext, 'parser.js'));
fs.copyFileSync(path.join(root, 'server', 'codex.js'), path.join(ext, 'codex.js'));
console.log('  server/parser.js  ->  extension/parser.js');
console.log('  server/codex.js   ->  extension/codex.js');
console.log('Done.');

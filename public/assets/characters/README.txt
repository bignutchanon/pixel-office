Drop ChatGPT-generated character sprite sheets here (PNG, transparent background).

Format: a 4×4 grid (4 columns × 4 rows), all cells the same size.
  Row order  : 1=facing DOWN, 2=LEFT, 3=RIGHT, 4=UP
  Columns    : 4-frame walk cycle (column 1 is the idle/standing frame)
  Feet of the character sit at the bottom of each cell, centered.

Name them char1.png, char2.png, char3.png … (one per teammate look).
Each Claude Code session is assigned a sheet by a stable hash.

After adding/removing files, run:  node scripts/gen-assets-manifest.js
(then refresh the browser; for the VS Code extension, also re-run
 node scripts/sync-extension.js and repackage).

See ASSETS.md in the project root for the exact ChatGPT prompts.

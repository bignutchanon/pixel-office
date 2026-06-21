# 🎨 RPG art via ChatGPT — sprite guide

Pixel Office can use real RPG sprite art instead of the built-in procedural art.
Generate the images in ChatGPT, drop them in, run one script, refresh. If no
images are present, the app keeps using the built-in pixel art — nothing breaks.

> ChatGPT's image model (gpt-image-1) can produce a transparent-background sprite
> sheet from one careful prompt. Its weak spot is **consistency across separate
> generations**, so: do **one full sheet per character in a single image**, and
> include a clear reference description so all 16 frames match.

---

## 1) Characters (the important ones)

Each Claude Code session becomes one of these characters. Make a few different
looks (one image each).

**Required format**

- One PNG, **transparent background**, **square** (ask for 1024×1024).
- A **4 × 4 grid** (4 columns × 4 rows), every cell the same size.
- **Row order (top→bottom): DOWN, LEFT, RIGHT, UP** (the facing direction).
- **Columns = a 4-frame walk cycle**; column 1 is the standing/idle pose.
- Character centered in each cell, **feet at the bottom of the cell**.
- Top-down / classic JRPG ¾ view; same design & colors in all 16 frames.

**Prompt to paste into ChatGPT** (edit the character description in the last line):

```
Generate a top-down RPG character sprite sheet as a single PNG with a fully
transparent background (no scene, no shadow under a floor, no grid lines, no text).
Lay it out as a 4 columns × 4 rows grid, all 16 cells exactly the same size.
Each ROW is one facing direction, a 4-frame walk cycle read left to right.
Row order from top to bottom: row 1 faces DOWN (toward the viewer), row 2 faces
LEFT, row 3 faces RIGHT, row 4 faces UP (away from the viewer). Column 1 is the
standing/idle frame. Keep the character perfectly consistent across all frames —
same proportions, outfit, and colors. Center the character in each cell with the
feet near the bottom edge. 16-bit SNES JRPG pixel-art style, crisp pixels, bold
outlines, limited palette. Character: a software developer wearing a teal hoodie,
glasses, and headphones.
```

Save as `public/assets/characters/char1.png`. Repeat with different descriptions
(`char2.png`, `char3.png`, …) — e.g. "a woman with a red blazer and coffee mug",
"a person in a yellow raincoat", "a robot intern with a single round eye".

> Tip: if ChatGPT gives you a single big illustration instead of a clean grid,
> reply: *"Redo as a strict 4×4 sprite-sheet grid, 16 equal cells, transparent
> background, no extra art."* If it returns a 3-column sheet, set that file's
> `"cols": 3` in `manifest.json` after running the script below.

---

## 2) Office furniture & floor (optional — adds to the RPG feel)

One PNG each, transparent background, top-down. Author them around these sizes
(1 pixel = 1 world unit):

| File | What | Size | Prompt seed |
|---|---|---|---|
| `floor.png` | **seamless** tile | 32×32 | "seamless tileable top-down office carpet tile, 16-bit pixel art, no seams, no text" |
| `desk.png` | desk + monitor | ~46 wide | "top-down pixel-art office desk with a computer monitor and keyboard, transparent background" |
| `sofa.png` | lounge sofa | ~48 wide | "top-down pixel-art office sofa, transparent background, 16-bit" |
| `coffee.png` | coffee machine | ~16 | "top-down pixel-art coffee machine, transparent background" |
| `meeting.png` | meeting table | ~92 wide | "top-down pixel-art conference table, transparent background" |
| `plant.png` `servers.png` `whiteboard.png` `bookshelf.png` `cooler.png` | as named | small | "top-down pixel-art <thing>, transparent background, 16-bit" |

Put them in `public/assets/objects/`. Anything you skip uses the built-in art.

---

## 3) Wire it in

```bash
node scripts/gen-assets-manifest.js   # scans the folders, writes manifest.json
```

Then **refresh** http://localhost:4317 (standalone).

For the **VS Code extension**, also:

```bash
node scripts/sync-extension.js
cd extension && npx @vscode/vsce package --no-dependencies
code --install-extension pixel-office-*.vsix --force   # then reload VS Code
```

That's it — characters animate from your sheets (walk in 4 directions, idle at the
desk facing the monitor), and any furniture/floor PNGs replace the procedural art.

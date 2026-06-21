Drop optional furniture / floor PNGs here (transparent background, top-down).

Recognized names (use these exact filenames; any you omit fall back to the
built-in procedural art):
  desk.png        a workstation (desk + monitor)   ~46 px wide
  floor.png       a SEAMLESS tileable floor tile    16 or 32 px square
  sofa.png        lounge sofa                       ~48 px wide
  coffee.png      coffee machine
  cooler.png      water cooler
  meeting.png     meeting-room table                ~92 px wide
  whiteboard.png  whiteboard (wall)
  servers.png     server rack
  bookshelf.png   bookshelf
  plant.png       potted plant

Object PNGs are drawn at their natural pixel size (1 px = 1 world unit), so
author them at the sizes above. After adding files run
  node scripts/gen-assets-manifest.js
See ASSETS.md for ChatGPT prompts.

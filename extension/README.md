# 🏢 Pixel Office — VS Code extension

Visualizes your **live Claude Code agents** as pixel characters working in a
Gather-style office, right inside your editor. Each Claude Code session becomes a
person who walks in, sits at a desk, and animates by what the agent is doing —
coding, reading, running commands, researching, or spawning sub-agents.

Works in **VS Code, Cursor, Windsurf, and VSCodium** (shared extension API).

The extension host reads `~/.claude/projects/**/*.jsonl` directly and streams
state into a webview via `postMessage` — **no server, no port, no dependencies.**

---

## Run it (development — fastest)

1. Open the **`extension/`** folder in VS Code (or Cursor / Windsurf).
2. Press **F5** → an *Extension Development Host* window opens.
3. In that window, click **🏢 Pixel Office** in the status bar — or open the
   Command Palette (`Ctrl/Cmd+Shift+P`) and run **“Open Pixel Office”**.

That's it. Open a Claude Code terminal in any project and watch an agent walk in.

## Install as a package (.vsix)

Build a `.vsix` you can install into any VS Code-family IDE:

```bash
cd extension
npx @vscode/vsce package --no-dependencies
```

Then install it:
- **VS Code / Cursor / Windsurf / VSCodium** → Extensions panel → `…` menu →
  **Install from VSIX…** → pick `pixel-office-1.0.0.vsix`
- or CLI: `code --install-extension pixel-office-1.0.0.vsix`
  (use `cursor`, `windsurf`, or `codium` in place of `code` for those IDEs)

---

## Settings

| Setting | Default | Meaning |
|---|---|---|
| `pixelOffice.projectsDir` | `~/.claude/projects` | transcripts directory to watch |
| `pixelOffice.windowHours` | `12` | only show sessions active within this window |

## Activity colors

🟢 Coding · 🔵 Reading · 🟩 Terminal · 🟡 Researching · 🟣 Delegating ·
🔴 Needs you · ⚪ Thinking · ⚫ Idle. Sub-agents appear as interns beside the desk
that spawned them. Controls: scroll = zoom, drag = pan, double-click = fit.

---

## Editing the art / behavior

The webview assets in `media/` are **copies** of the project's `public/`. The
single source of truth lives one level up. After editing `../public/**` or
`../server/parser.js`, re-sync with:

```bash
node ../scripts/sync-extension.js
```

- Colors / activity table → `media/js/config.js`
- Character & furniture pixels → `media/js/sprites.js`
- Office layout → `media/js/world.js`

---

## JetBrains (IntelliJ / PyCharm / WebStorm …)

JetBrains uses a different plugin system (Kotlin + JCEF), so this extension does
**not** load there. Use the standalone web app instead and open it in the IDE's
built-in browser:

```bash
node ../server/index.js     # then open http://localhost:4317
```

A native JetBrains plugin is possible but is a separate project — ask if you want it.

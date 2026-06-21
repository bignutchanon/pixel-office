# 🏢 Pixel Office

A Gather-style pixel-art virtual office that visualizes your **live AI coding agents**
as little characters working at their desks — in real time, from your actual
sessions. Supports **Claude Code** and **OpenAI Codex CLI** side by side.

Each session becomes a person who walks in, sits down, and animates by what the
agent is *actually doing* — typing code, reading files, running commands,
researching the web, spawning sub-agents, or waiting for you.

> It reads transcripts locally (`~/.claude/projects` and `~/.codex/sessions`).
> Nothing is sent anywhere — the server and UI run entirely on your machine.
> **Zero dependencies, zero build step.**

---

## Run it

### Standalone (any browser)
```bash
node server/index.js
```
…or double-click **`start.bat`** (Windows). Opens at **http://localhost:4317**.
Requires Node 18+. No `npm install`.

### VS Code / Cursor / Windsurf extension
```bash
node scripts/sync-extension.js          # copy UI + parsers into extension/
cd extension && npx @vscode/vsce package --no-dependencies
code --install-extension pixel-office-*.vsix --force   # reload, then status-bar 🏢 Pixel Office
```
A prebuilt `.vsix` is attached to the latest [Release](../../releases). Dev run: open
`extension/` in VS Code and press **F5**.

Open a Claude Code or Codex terminal in any project and watch an agent walk in.

---

## What you'll see

- **Pods** (desk clusters) = projects, grouped by working directory — so a Claude
  session and a Codex session in the **same folder share a pod** (working together).
- **Team colors:** 🔵 Claude · 🟢 Codex (name + chip + shirt + chest badge). A
  green dashed **collaboration link** connects agents in the same pod.
- **Sandbox office:** walls, a door, a coffee corner, lounge sofa, meeting room,
  server room, plants. Characters take coffee breaks, gather in the meeting room
  when delegating, stand up and raise a red **!** when they need you, and chat 💬
  when idling near each other.
- **Live usage:** a context-fill bar (green→amber→red) + estimated cost under each
  character, and a `Σ tokens · ~$cost` total in the header.

| Bubble | Activity | From |
|---|---|---|
| 🟢 Coding | editing a file | Write/Edit · apply_patch |
| 🔵 Reading | reading/searching | Read/Grep/Glob |
| 🟩 Terminal | running a command | Bash/PowerShell · exec |
| 🟡 Researching | web search/fetch | WebSearch/WebFetch |
| 🟣 Delegating | spawning sub-agents | Task/Workflow |
| 🔴 Needs you | waiting for input | AskUserQuestion |
| ⚪ Thinking / ⚫ Idle | reasoning / turn ended | — |

Controls: scroll = zoom · drag = pan · double-click = fit.

---

## More

- 🎨 **RPG art from ChatGPT** — drop in generated sprite sheets to replace the
  procedural pixel art. See **[ASSETS.md](ASSETS.md)**.
- 🤝 **Codex ⇄ Claude bridge** — let the two CLIs consult / talk to each other.
  See **[bridge/README.md](bridge/README.md)**.

## Project layout
```
server/      zero-dep Node server (HTTP + SSE + fs.watch) + parsers
  parser.js  Claude Code transcripts        codex.js  Codex CLI rollouts
public/      the web UI (canvas pixel renderer, ES modules)
  assets/    optional image sprites (see ASSETS.md)
extension/   VS Code extension (reuses public/ via scripts/sync-extension.js)
bridge/      Codex ⇄ Claude wrappers + capped relay
scripts/     sync-extension.js · gen-assets-manifest.js
```

## Configuration (env)
| Var | Default | Meaning |
|---|---|---|
| `PIXEL_PORT` | `4317` | HTTP port |
| `PIXEL_PROJECTS` | `~/.claude/projects` | Claude transcripts dir |
| `PIXEL_CODEX` | `~/.codex/sessions` | Codex rollouts dir |
| `PIXEL_WINDOW_HOURS` | `12` | only show sessions active within this window |

Visual/behaviour tuning lives in `public/js/config.js`.

## Privacy
Runs 100% locally. The office derives activity from your transcripts (file names,
commands, token counts) — keep that in mind before exposing the port publicly.

## License
MIT

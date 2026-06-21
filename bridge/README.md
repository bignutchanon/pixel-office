# 🤝 Codex ⇄ Claude bridge

Let Codex CLI and Claude Code command/talk to each other — and watch both work
side-by-side in Pixel Office (same `cwd` → same pod).

**Prereqs:** both CLIs on your PATH in a normal terminal.
```
claude --version
codex  --version
```

---

## 1) Codex → Claude (Codex consults Claude)

Codex's `exec`/shell tool can run Claude headlessly:
```
claude -p "your question for Claude"
```
…or use the wrapper:  `bridge\ask-claude.cmd "your question"`  (Unix: `bridge/ask-claude.sh`).

To make Codex reach for it on its own, add a line to your Codex instructions
(its `AGENTS.md` / config or just say it in chat):

> *"When you want a second opinion or a hand, consult Claude by running
> `claude -p \"<question>\"` and use its answer."*

## 2) Claude → Codex (Claude consults Codex)

From Claude Code (or any shell):
```
codex exec "your question for Codex"
```
…or:  `bridge\ask-codex.cmd "your question"`.

> If your Codex version uses a different non-interactive command, edit the one
> line in `ask-codex.*` / `relay.js` (it assumes `codex exec "<prompt>"`).

## 3) Auto relay — they talk by themselves (capped)

```
node bridge/relay.js "Design a tiny URL-shortener API together" 4
#                      ^task                                     ^turns (max 10), first=codex|claude
```
Each turn is **one model call**, alternating Codex ⇄ Claude, feeding the last
reply forward. Turn count is capped to keep cost bounded.

---

## Watch it in Pixel Office

Run the office (`node server/index.js` → http://localhost:4317, or the VS Code
extension). While the bridge runs, **both** a Codex character (green chip) and a
Claude character (blue chip) appear — in the **same pod** when they share a
working directory — with live token/context bars. That's the team "working &
talking together." 💬

> 💸 Cost: every consult / relay turn is a real model call. The Pixel Office HUD
> (`Σ … tok · ~$…`) and each character's bar show usage live — keep an eye on it.

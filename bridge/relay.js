'use strict';
/**
 * relay.js — let Codex and Claude talk to each other automatically for a few
 * turns. Each turn is ONE model call (alternating Codex ⇄ Claude); the previous
 * reply is fed to the next agent. Turn count is capped to bound cost.
 *
 *   node bridge/relay.js "<task>" [turns=4] [first=codex|claude]
 *
 * Requires `claude` and `codex` on PATH (run it from a normal terminal where
 * both CLIs work). Watch them appear & chat in Pixel Office at the same time.
 */

const cp = require('child_process');

const args = process.argv.slice(2);
const seed = args[0];
if (!seed) {
  console.error('usage: node bridge/relay.js "<task>" [turns=4] [first=codex|claude]');
  process.exit(1);
}
const turns = Math.min(10, Math.max(1, parseInt(args[1] || '4', 10) || 4));
let who = args[2] === 'claude' ? 'claude' : 'codex';

// keep replies single-line + bounded so shell quoting stays safe and cost stays low
function clean(t) { return (t || '').replace(/[`$]/g, '').replace(/"/g, "'").replace(/\s+/g, ' ').trim().slice(0, 1500); }

function run(agent, prompt) {
  const q = clean(prompt);
  const cmd = agent === 'claude' ? `claude -p "${q}"` : `codex exec "${q}"`;
  const r = cp.spawnSync(cmd, { shell: true, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  if (r.error) return `[${agent} failed: ${r.error.message} — is it on PATH?]`;
  return clean(r.stdout || r.stderr || '(no output)');
}

console.log(`\n=== Codex ⇄ Claude relay · ${turns} turns · task: "${seed}" ===`);
console.log('(each turn = one model call — costs tokens; Ctrl+C to stop)\n');

let prev = `Let's start. ${seed}`;
for (let i = 0; i < turns; i++) {
  const agent = who;
  const prompt =
    `You are ${agent === 'claude' ? 'Claude' : 'Codex'}, collaborating with the other AI assistant on a shared task.\n` +
    `Task: ${seed}\n` +
    `The other assistant just said: "${prev}"\n` +
    `Reply in under 120 words. Build on what they said and end with ONE concrete next step or a question for them. Just reply in text; do not run tools.`;
  const out = run(agent, prompt);
  console.log(`--- turn ${i + 1} · ${agent.toUpperCase()} ---\n${out}\n`);
  prev = out;
  who = who === 'claude' ? 'codex' : 'claude';
}
console.log('=== relay done ===');

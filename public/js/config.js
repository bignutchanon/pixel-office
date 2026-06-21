// config.js — shared constants, tunables, and the activity visual table.

export const TILE = 16;

// Desk "cell" footprint (world units). A character sits below its desk.
export const DESK_W = 46;
export const DESK_H = 58;
export const SEAT_DX = 23; // feet-anchor offset inside a desk cell (must match sprites)
export const SEAT_DY = 50;
export const POD_PAD = 14;
export const POD_HEADER = 20;
export const POD_GAP = 26;
export const MAX_ROW_W = 980; // pods wrap to a new row past this width

export const TUNE = {
  presentMs: 45 * 60 * 1000, // session shown as a person at a desk if active within this
  activeMs: 30 * 1000,       // "currently working" (bright monitor + busy anim) within this
  recentMs: 5 * 60 * 1000,   // "present but just paused"
  walkSpeed: 70,             // world units / second
  arriveDist: 2.0,
};

// sandbox-office sizing + autonomous-behaviour tuning
export const WALL = 12;          // perimeter wall thickness
export const COMMONS_H = 168;    // height of the common-area band below the desks
export const MIN_OFFICE_W = 820; // office never narrower than this (room for amenities)
export const BEHAVIOR = {
  idleGraceMs: 18000,   // once idle this long, the character starts taking breaks
  breakMinMs: 6000,     // how long a single break/wander lasts
  breakMaxMs: 15000,
  chatDist: 30,         // two idlers closer than this may start chatting
  emoteEveryMs: 2600,   // cadence of incidental emotes while working
};

// activity category -> visuals. `mon` = monitor screen colour, `glyph` drawn in the bubble.
export const ACT = {
  code:     { name: 'Coding',      color: '#7CFF6B', mon: '#0b3a1f', glyph: 'code' },
  read:     { name: 'Reading',     color: '#5BC8FF', mon: '#0b2236', glyph: 'book' },
  shell:    { name: 'Terminal',    color: '#9AE6A0', mon: '#04140a', glyph: 'term' },
  web:      { name: 'Researching', color: '#FFD166', mon: '#33280b', glyph: 'globe' },
  delegate: { name: 'Delegating',  color: '#C792EA', mon: '#2a1145', glyph: 'team' },
  ask:      { name: 'Needs you',   color: '#FF5C5C', mon: '#3a1111', glyph: 'ask' },
  think:    { name: 'Thinking',    color: '#AEB9C4', mon: '#161b21', glyph: 'dots' },
  work:     { name: 'Working',     color: '#E8EEF5', mon: '#222a33', glyph: 'gear' },
  idle:     { name: 'Idle',        color: '#5a6472', mon: '#0a0d10', glyph: 'zzz' },
};

export function actInfo(a) { return ACT[a] || ACT.work; }

// usage formatting + context-fill colour
export function fmtTokens(n) {
  n = n || 0;
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return Math.round(n / 1e3) + 'k';
  return String(n | 0);
}
export function fmtCost(n) {
  n = n || 0;
  if (n >= 100) return '$' + Math.round(n);
  if (n >= 1) return '$' + n.toFixed(1);
  return '$' + n.toFixed(2);
}
export function ctxColor(p) { return p < 0.5 ? '#5fbf5a' : p < 0.8 ? '#e7c53b' : '#e0574f'; }

// deterministic colour palette per agent (hash of session id)
const SHIRTS = ['#E14F4F','#E8943A','#E7C53B','#4A8FE0','#7B6CE0','#C45FB0','#5fa8d3','#d98c5f','#e0709a','#6f8fd9'];
const CODEX_SHIRTS = ['#10a37f','#19c39a','#2bb673','#1f8f6b','#3ad29f','#0f7a5c'];
const HAIRS  = ['#2b2118','#4a2f1b','#101418','#6b4423','#3a2a55','#5a4636','#7a5c3a'];
const SKINS  = ['#f1c9a5','#e6b48f','#c98e6a','#a26d4d','#8a5a3c','#f5d6b8'];

export const TEAM = { claude: '#4a90e0', codex: '#10a37f' };

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function appearanceFor(id, source) {
  const h = hash(id || 'x');
  const codex = source === 'codex';
  const shirts = codex ? CODEX_SHIRTS : SHIRTS;
  return {
    shirt: shirts[h % shirts.length],
    hair: HAIRS[(h >> 8) % HAIRS.length],
    skin: SKINS[(h >> 16) % SKINS.length],
    pants: ['#33405a','#3a3a44','#4a3b2e','#2e4a3b'][(h >> 20) % 4],
    bald: (h % 11) === 0,
    team: codex ? TEAM.codex : TEAM.claude,
    codex,
  };
}

// agent.js — a Character with a small behaviour state machine driven by its
// live activity + recency:
//   working  -> sits at its desk (typing/reading/…)
//   delegate -> walks to the meeting room with its sub-agents
//   ask      -> stands up beside the desk and raises a red "!"
//   idle     -> lingers at the desk briefly, then takes coffee / sofa / wander breaks
// Sub-agents always gather at the meeting table while they exist.

import { TUNE, BEHAVIOR, appearanceFor } from './config.js';

export class Character {
  constructor(id, opts = {}) {
    this.id = id;
    this.isSub = !!opts.isSub;
    this.parentId = opts.parentId || null;
    this.source = opts.source || 'claude';
    this.look = appearanceFor(id, this.source);
    this.x = opts.spawnX ?? 0;
    this.y = opts.spawnY ?? 0;
    this.target = { x: this.x, y: this.y };
    this.dir = 'down';
    this.moving = false;
    this.phase = Math.random() * 6.28;
    this.bob = 0;
    this.mode = 'enter';
    this.dead = false;

    this.behavior = 'enter';
    this.pose = 'walk';
    this.emote = null;
    this.sitting = false;
    this.subCount = 0;
    this.chatWith = false;

    this._breakInit = false;
    this.breakUntil = 0;
    this.breakAction = null;
    this.breakPos = null;

    this.act = 'think'; this.tool = null; this.label = '';
    this.project = ''; this.branch = ''; this.model = '';
    this.usage = null;
    this.lastActivity = Date.now();
    this.name = opts.name || id.slice(0, 4);
  }

  setState(s) {
    this.act = s.act || 'work';
    this.tool = s.tool || null;
    this.label = s.label || '';
    this.lastActivity = s.lastActivity || this.lastActivity;
    if (s.project) this.project = s.project;
    if (s.branch !== undefined) this.branch = s.branch;
    if (s.model) this.model = s.model;
    if (s.usage) this.usage = s.usage;
    if (s.source && s.source !== this.source) { this.source = s.source; this.look = appearanceFor(this.id, this.source); }
    if (s.name) this.name = s.name;
  }

  leaveTo(x, y) { this.mode = 'leaving'; this.target = { x, y }; }

  update(dt, now, world) {
    const since = now - this.lastActivity;
    this.active = since < TUNE.activeMs;
    this.present = since < TUNE.presentMs;
    this.busy = this.active && this.act !== 'idle' && this.act !== 'ask';

    this._decide(now, since, world);
    this._move(dt);
    this._poseEmote(now);

    this.phase += dt * (this.moving ? 9 : (this.busy ? 7 : 2.2));
    this.bob = now / 350 + this.phase * 0.05;
    if (this.mode === 'leaving' && !this.moving) this.dead = true;
  }

  _decide(now, since, world) {
    if (this.mode === 'leaving') { this.behavior = 'leave'; world.releaseClaim(this.id); this.target = world.door; return; }

    if (this.isSub) {
      this.behavior = 'meeting';
      this.target = world.claimSpot('meeting', this.id) || world.door;
      return;
    }
    if (this.act === 'ask') {
      this.behavior = 'alert'; world.releaseClaim(this.id);
      const seat = world.seat(this.id);
      this.target = seat ? { x: seat.x, y: seat.y + 12 } : world.door;
      return;
    }
    if (this.subCount > 0 && this.active) {
      this.behavior = 'meeting';
      this.target = world.claimSpot('meeting', this.id) || world.seat(this.id) || world.door;
      return;
    }
    if (this.active) {
      this.behavior = 'desk'; world.releaseClaim(this.id);
      this.target = world.seat(this.id) || world.door;
      return;
    }
    // idle: linger at desk for a grace period, then take breaks
    if (since < TUNE.activeMs + BEHAVIOR.idleGraceMs) {
      this.behavior = 'deskidle'; world.releaseClaim(this.id);
      this.target = world.seat(this.id) || world.door;
      return;
    }
    this.behavior = 'break';
    if (!this._breakInit || now > this.breakUntil) {
      this._breakInit = true;
      this.breakUntil = now + BEHAVIOR.breakMinMs + Math.random() * (BEHAVIOR.breakMaxMs - BEHAVIOR.breakMinMs);
      const r = Math.random();
      if (r < 0.30) { this.breakAction = 'coffee'; this.breakPos = world.claimSpot('coffee', this.id); }
      else if (r < 0.52) { this.breakAction = 'lounge'; this.breakPos = world.claimSpot('lounge', this.id); }
      else { this.breakAction = 'wander'; world.releaseClaim(this.id); this.breakPos = world.wanderPoint(); }
      if (!this.breakPos) { this.breakAction = 'wander'; world.releaseClaim(this.id); this.breakPos = world.wanderPoint(); }
    }
    this.target = this.breakPos || world.door;
  }

  _move(dt) {
    const dx = this.target.x - this.x, dy = this.target.y - this.y, d = Math.hypot(dx, dy);
    if (d > TUNE.arriveDist) {
      const step = Math.min(d, TUNE.walkSpeed * (this.isSub ? 1.15 : 1) * dt);
      this.x += (dx / d) * step; this.y += (dy / d) * step;
      this.moving = true;
      this.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
    } else { this.x = this.target.x; this.y = this.target.y; this.moving = false; }
  }

  _poseEmote(now) {
    if (this.moving) { this.pose = 'walk'; this.emote = null; this.sitting = false; return; }
    switch (this.behavior) {
      case 'desk': this.pose = 'desk'; this.sitting = true; this.dir = 'up'; this.emote = this._workEmote(now); break;
      case 'deskidle': this.pose = 'desk'; this.sitting = true; this.dir = 'up'; this.emote = 'zzz'; break;
      case 'meeting': this.pose = 'meetsit'; this.sitting = false; this.dir = 'down'; this.emote = this.chatWith ? 'dots' : null; break;
      case 'alert': this.pose = 'wave'; this.sitting = false; this.dir = 'down'; this.emote = '!'; break;
      case 'break':
        if (this.breakAction === 'coffee') { this.pose = 'drink'; this.emote = 'coffee'; }
        else if (this.breakAction === 'lounge') { this.pose = 'sofa'; this.emote = this.chatWith ? 'dots' : null; }
        else { this.pose = 'stand'; this.emote = this.chatWith ? 'dots' : 'zzz'; }
        this.sitting = false; this.dir = 'down'; break;
      case 'leave': this.pose = 'walk'; this.sitting = false; this.emote = null; break;
      default: this.pose = 'stand'; this.sitting = false; this.emote = null;
    }
  }

  _workEmote(now) {
    if (this.act === 'web') return ((now / 1000 | 0) % 4 === 0) ? '?' : null;
    if (this.act === 'think') return 'dots';
    if (this.act === 'delegate') return 'idea';
    return null;
  }

  drawOpts() {
    return {
      pose: this.pose, dir: this.dir, moving: this.moving, phase: this.phase, bob: this.bob,
      sitting: this.sitting, busy: this.busy,
      skin: this.look.skin, hair: this.look.hair, shirt: this.look.shirt, pants: this.look.pants, bald: this.look.bald,
      team: this.look.team,
    };
  }
}

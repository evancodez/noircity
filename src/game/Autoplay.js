import { RNG } from '../util/rng.js';

// ?autoplay=1: the game plays itself, as a player would (lane 7's brief
// P0.5). From the title it begins after a moment; in each scene it asks the
// scene's own auto(ctx, A) what to do this step (scenes export it beside
// their script), and presses keys through the game's virtual input
// (game.vin: the same edges and held keys a real keyboard makes, read by
// the prompts, the brawl, the inspection). It waits a human moment at each
// prompt, smokes now and then, fights by reading his clips' marks (blocks
// the jab, slips the hook away from his hand, slips the haymaker, blocks
// the bottle, punishes the openings), walks out, searches.
// Everything runs on game time from a seeded RNG: two runs are one run.
//   A.prompting()                 a prompt (scene, interact) or an inspection is up
//   A.pressAfter(code, a, b)      press once, a..b s after it appeared
//   A.tap(code) / A.hold(code, s) a key's edges (a hold: down now, up s later)
//   A.every(key, a, b)            true once every a..b s (per key)
//   A.once(key)                   true the first time only
//   A.walkPath([[x, z], ...])     walk the points in order (walk mode)
//   A.fight(brawl)                one step of the fight
export class Autoplay {
  constructor(game, { seed = 1937 } = {}) {
    this.game = game;
    this.rng = new RNG(seed).fork(5150);
    this.t = 0;
    this.keys = [];           // { code, down, up, sent }
    this.timers = new Map();
    this.onceSet = new Set();
    this.pending = null;
    this.path = null;
    this.plan = null;
    this.nextJab = 1;
    this.log = [];
    this.done = false;
  }

  // per fixed step (Game.pre, before the controller)
  update(dt) {
    const G = this.game;
    this.t += dt;
    // the scheduled keys' edges
    const V = G.vin;
    for (let i = this.keys.length - 1; i >= 0; i--) {
      const k = this.keys[i];
      if (!k.sent && this.t >= k.down) { k.sent = true; V.down.add(k.code); V.held.add(k.code); }
      if (k.sent && this.t >= k.up) { V.up.add(k.code); V.held.delete(k.code); this.keys.splice(i, 1); }
    }
    if (G.state === 'title') {
      if (this.t > 1.5 && !this.begun) { this.begun = true; G.start(); }
      return;
    }
    if (G.state === 'end') { this.done = true; this.stopWalk(); return; }
    if (G.state !== 'playing') return;
    const S = G.scenes;
    if (!S.current || S.trans) return;
    const def = S.current;
    if (def.auto) def.auto(S.ctx, this);
  }

  // ---- keys -----------------------------------------------------------------------------
  tap(code) { this.hold(code, 1 / 60); }
  hold(code, secs) { this.keys.push({ code, down: this.t, up: this.t + Math.max(1 / 60, secs), sent: false }); this.log.push([+this.t.toFixed(2), code]); }
  isHeld(code) { return this.game.vin.held.has(code) || this.keys.some((k) => k.code === code); }
  release(code) {
    for (const k of this.keys) if (k.code === code) k.up = Math.min(k.up, this.t);
  }

  prompting() {
    const G = this.game;
    return !!(G.scenes.prompting || G.interact.current || G.inspect.active);
  }
  pressAfter(code, a, b) {
    const text = (this.game.scenes.prompting && this.game.scenes.prompting.text) || (this.game.inspect.active ? 'inspect' : 'interact');
    if (!this.pending || this.pending.text !== text || this.pending.code !== code) this.pending = { text, code, at: this.t + this.rng.range(a, b) };
    if (this.t >= this.pending.at) { this.tap(code); this.pending.at = this.t + 1.2; }
  }
  every(key, a, b) {
    const n = this.timers.get(key);
    if (n == null) { this.timers.set(key, this.t + this.rng.range(a, b)); return false; }
    if (this.t < n) return false;
    this.timers.set(key, this.t + this.rng.range(a, b));
    return true;
  }
  once(key) { if (this.onceSet.has(key)) return false; this.onceSet.add(key); return true; }

  // ---- walking (walk mode: the controller's own inputs) ------------------------------------
  walkPath(points) {
    const C = this.game.controller;
    if (C.mode !== 'walk') return;
    if (!this.path || this.path.src !== points.length + ':' + points[0]) this.path = { src: points.length + ':' + points[0], pts: points, i: 0 };
    const P = this.path;
    if (P.i >= P.pts.length) { C.auto = null; return; }
    const [x, z] = P.pts[P.i];
    const dx = x - C.pos.x, dz = z - C.pos.z;
    if (Math.hypot(dx, dz) < 0.35) { P.i++; return; }
    // (turn toward it as a man does, not in one snap)
    const want = Math.atan2(-dx, -dz);
    C.yaw += Math.atan2(Math.sin(want - C.yaw), Math.cos(want - C.yaw)) * 0.12;
    C.pitch += (-0.12 - C.pitch) * 0.1;
    C.auto = { f: 1, s: 0 };
  }
  stopWalk() { const C = this.game.controller; if (C.auto) C.auto = null; this.path = null; }

  // ---- the fight (round 2, docs/story/FIGHT.md): read his tells, answer
  // with the right hand of the rule, move in the room, punish the openings,
  // at a human's pace (a reaction of 0.14 .. 0.3 s, a wrong read now and
  // then, an opening seen a beat late) ------------------------------------------------------------
  fight(B) {
    const him = B.him, me = B.me, c = B.c, G = this.game, r = this.rng;
    const keys = ['KeyW', 'KeyS', 'KeyA', 'KeyD'];
    if (!him || me.act === 'down' || B.finished) { for (const k of ['Space', 'ShiftLeft', ...keys]) this.release(k); return; }
    const eye = G.eye;
    const d = Math.hypot(c.pos.x - eye.x, c.pos.z - eye.z);
    const busyHands = this.isHeld('Mouse0') || this.isHeld('Mouse2');
    // ---- the lesson: do what the card says, a human moment after it shows
    if (B.lesson) {
      const L = B.lesson, st = L.step;
      if (this.lessonStep !== st) { this.lessonStep = st; this.lessonAt = this.t + r.range(0.5, 1.1); }
      this.walkTo(B, d, 1.45);
      if (this.t < this.lessonAt || busyHands || me.act !== 'idle') { if (st < 4 || st === 7) return; }
      if (st === 1 && d < 1.6) { this.tap('Mouse0'); this.lessonAt = this.t + r.range(0.9, 1.4); return; }
      if (st === 2 && d < 1.6) { this.tap('Mouse2'); this.lessonAt = this.t + r.range(0.9, 1.4); return; }
      if (st === 3 && d < 1.6) { this.hold(r.chance(0.5) ? 'Mouse0' : 'Mouse2', r.range(0.75, 0.95)); this.lessonAt = this.t + 1.6; return; }
      if (st === 7) { if (this.once('lessonWalk' + L.total.toFixed(0))) this.hold('KeyA', 0.7); return; }
    }
    // ---- defence: a plan per blow, made when his tell is seen
    if (him.state === 'attack' && him.clip) {
      const cl = c.clip(him.clip);
      const A = cl.marks.contact != null ? (B.stats.his + ':' + him.clip) : null;
      if (A && (!this.plan || this.plan.id !== A)) {
        const info = { br_jab: ['L', 's'], br_jabR: ['R', 's'], br_cross: ['R', 's'], br_hook: ['R', 'w'], br_hookL: ['L', 'w'], br_body: ['R', 'w'], br_bodyL: ['L', 'w'],
          br_haymaker: ['R', 'o'], br_haymakerL: ['L', 'o'], br_rush: ['R', 'o'], br_shove: ['B', 'p'], br_bottle: ['R', 's'], br_bottle_thrust: ['R', 's'], br_stoolSwing: ['R', 'w'] }[him.clip] || ['R', 's'];
        const [hand, kind] = info;
        const away = hand === 'R' ? 'slipR' : 'slipL';
        // (a first-timer's reads: right most of the time, now and then into the swing)
        const miss = r.chance(B.lesson ? 0.05 : 0.2);
        let act;
        if (B.lesson) act = B.lesson.step === 6 ? 'cover' : away;
        else if (kind === 'w') act = r.chance(0.72) ? away : r.chance(0.6) ? 'cover' : (away === 'slipR' ? 'slipL' : 'slipR');
        else if (kind === 'o') act = r.chance(0.55) ? away : 'lean';
        else if (kind === 'p') act = r.chance(0.6) ? 'lean' : 'slipR';
        else act = r.chance(0.45) ? (r.chance(0.5) ? 'slipL' : 'slipR') : r.chance(0.5) ? 'cover' : 'lean';
        this.plan = { id: A, act: miss ? 'none' : act, seen: r.range(0.14, 0.3), lead: r.range(0.1, 0.2), done: false };
      }
      const P = this.plan;
      if (P && A) {
        const tc = cl.marks.contact - him.t;
        const lead = P.act === 'cover' ? P.lead + 0.12 : P.act === 'lean' ? P.lead + 0.1 : P.lead;
        if (!P.done && him.t >= P.seen && tc <= lead && tc > -0.04) {
          P.done = true;
          for (const k of keys) this.release(k);
          if (P.act === 'cover') this.hold('ShiftLeft', tc + 0.3);
          else if (P.act === 'lean') this.hold('Space', 0.3);
          else if (P.act === 'slipL') { this.hold('Space', 0.2); this.tap('KeyA'); }
          else if (P.act === 'slipR') { this.hold('Space', 0.2); this.tap('KeyD'); }
        }
        if (tc > -0.05) return;
      }
    }
    if (me.act !== 'idle' || busyHands) return;
    // ---- the room: keep him at arm's length, step round now and then
    const out = him.state === 'reel';
    this.walkTo(B, d, out ? (him.atSpot ? 1.35 : 2.0) : 1.45);
    // (an opening is seen a beat late, and sometimes not at all)
    const seen = him.state + ':' + (him.open > 0.1) + ':' + him.low;
    if (this.seen !== seen) { this.seen = seen; this.seenAt = this.t + r.range(0.2, 0.45); this.ignore = r.chance(0.15); }
    if (this.t < this.seenAt) return;
    const arm = () => (this.lastArm = this.lastArm === 'Mouse0' ? 'Mouse2' : 'Mouse0');
    const hard = (a, b) => { this.hold(arm(), r.range(a, b)); this.nextJab = this.t + 0.9; };
    if (d > 1.72) return;
    if (out) { if (him.atSpot) hard(0.72, 0.95); return; }
    if (me.holding && him.state !== 'attack') { if (r.chance(0.3) && d < 1.8) this.hold('Mouse2', 0.7); else this.tap('Mouse2'); return; }
    if (this.ignore) { if (this.every('fidget', 0.8, 1.6)) this.ignore = false; return; }
    if (him.open > 0.12 || him.state === 'stun') { hard(0.55, 0.9); return; }
    if (him.state === 'move' && him.low) { hard(0.45, 0.8); return; }
    if (him.state === 'react' && this.t > this.nextJab - 0.6) { this.tap(arm()); this.nextJab = this.t + 0.35; return; }
    if (B.round >= 2 && !me.holding && him.state === 'move' && this.every('grab', 6, 11) && B.reachable()) { this.tap('KeyE'); return; }
    if (him.state === 'move' && this.t > this.nextJab) {
      if (r.chance(0.3)) hard(0.3, 0.7); else this.tap(arm());
      this.nextJab = this.t + r.range(1.0, 2.2);
    }
  }

  // step toward (or away from) him to a distance, with the room's keys; held
  // up (a table, a fallen stool between us) a man steps round it: A or D
  walkTo(B, d, want) {
    const f = d > want + 0.18 ? 'KeyW' : d < want - 0.35 ? 'KeyS' : null;
    for (const k of ['KeyW', 'KeyS']) if (k !== f && this.isHeld(k)) this.release(k);
    if (f && !this.isHeld(f) && !this.isHeld('Space')) this.hold(f, 0.25);
    if (f === 'KeyW') {
      if (this.lastD != null && d > this.lastD - 0.004) this.stall = (this.stall || 0) + 1 / 60; else this.stall = 0;
      if (this.stall > 0.5 && !this.isHeld('Space')) { this.side = this.side === 'KeyA' ? 'KeyD' : 'KeyA'; if (this.stall > 0.5) this.hold(this.side, 0.7); this.stall = -0.4; }
    } else this.stall = 0;
    this.lastD = d;
  }
}

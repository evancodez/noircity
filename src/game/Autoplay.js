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

  // ---- the fight: read his tells by their marks ----------------------------------------------
  fight(B) {
    const him = B.him, me = B.me, c = B.c;
    if (!him || me.state === 'down' || B.finished) { this.release('Space'); return; }
    const r = this.rng;
    // defence: a plan per attack, made at its tell
    if (him.state === 'attack') {
      const id = him.clip + '@' + (B.stats.his || 0);
      if (!this.plan || this.plan.id !== id) {
        // (a human misses one now and then; less often as the fight goes on)
        const miss = r.chance(0.2 - 0.04 * B.round);
        const react = r.range(0.1, 0.19);
        let act = 'block';
        if (him.clip === 'br_hook') act = r.chance(0.12) ? 'slipL' : r.chance(0.75) ? 'slipR' : 'block';
        else if (him.clip === 'br_haymaker') act = r.chance(0.5) ? 'slipL' : 'slipR';
        else if (him.clip === 'br_jab') act = r.chance(0.35) ? (r.chance(0.5) ? 'slipL' : 'slipR') : 'block';
        this.plan = { id, act: miss ? 'none' : act, lead: react, done: false };
      }
      const P = this.plan;
      const tc = c.clip(him.clip).marks.contact - him.t;
      if (!P.done && tc <= P.lead + (P.act === 'block' ? 0.12 : 0) && tc > -0.05) {
        P.done = true;
        if (P.act === 'block') this.hold('Space', tc + 0.25);
        else if (P.act === 'slipL') this.tap('KeyA');
        else if (P.act === 'slipR') this.tap('KeyD');
      }
      if (tc > 0) return;
    }
    if (me.state !== 'idle') return;
    // (a man sees an opening a beat late, and sometimes not at all)
    const seen = him.state + ':' + (him.open > 0) + ':' + him.guardLow;
    if (this.seen !== seen) { this.seen = seen; this.seenAt = this.t + r.range(0.18, 0.42); this.ignore = r.chance(0.2); }
    if (this.t < this.seenAt) return;
    // offence
    const heavy = (k = 0.3) => { this.hold('Mouse2', k); this.nextJab = this.t + 0.8; };
    if (him.state === 'reel' || him.hp <= 0) { heavy(r.range(0.3, 0.6)); return; }
    if (me.holding && (him.state !== 'attack')) { this.tap('Mouse0'); return; }
    if (this.ignore && him.state !== 'reel') { if (this.every('fidget', 0.8, 1.6)) this.ignore = false; return; }
    if (him.open > 0.15 || him.state === 'stun') { if (him.state === 'stun' && r.chance(0.5)) this.tap('Mouse0'); else heavy(r.range(0.3, 0.55)); return; }
    if (him.state === 'guard' && him.guardLow) { heavy(r.range(0.28, 0.45)); return; }
    if (him.state === 'react' && this.t > this.nextJab - 0.6) { this.tap('Mouse0'); this.nextJab = this.t + 0.3; return; }
    // round two on: what is in reach, now and then
    if (B.round >= 2 && !me.holding && him.state === 'guard' && him.next > 0.9 && this.every('grab', 5, 9) && B.reachable()) { this.tap('KeyE'); return; }
    if (him.state === 'guard' && him.next > 0.7 && this.t > this.nextJab) { this.tap('Mouse0'); this.nextJab = this.t + r.range(1.2, 2.6); }
  }
}

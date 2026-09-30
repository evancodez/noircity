import { RNG } from '../util/rng.js';
import { BR_ATTACKS } from '../cast/brawl/clips.js';

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

  // ---- the fight ([B8] version 4, docs/story/FIGHT.md): a first-timer at
  // a human's pace. He sees a tell 0.22 s after it starts and reads four in
  // five (a hop away from the hand that swings; a straight one left by a hop
  // either way, a back-step or the block; a thrown thing: the hop the chevron
  // points to); he sees an opening 0.28 .. 0.48 s late and strikes it with
  // the hand on its side (a jab, a combo, a hard punch - held to its second
  // or third tick - when the man is stunned or open after a miss); now and
  // then he punches into the guard anyway, and hops out of the answer when
  // he reads it. Styles (?style=): player; mash (both buttons as fast as they
  // go, walking in); nododge (fights well, never steps, never blocks);
  // fists (a player who never picks anything up); things (a player who takes
  // whatever is in reach whenever his hands are free, and uses it).
  fight(B) {
    const him = B.him, me = B.me, c = B.c, G = this.game, r = this.rng;
    const style = this.style || (this.style = (typeof location !== 'undefined' && new URLSearchParams(location.search).get('style')) || 'player');
    const moves = ['KeyW', 'KeyS', 'KeyA', 'KeyD'];
    if (!him || me.act === 'down' || B.finished) { for (const k of ['Space', 'Mouse0', 'Mouse2', ...moves]) this.release(k); return; }
    const eye = G.eye;
    const d = Math.hypot(c.pos.x - eye.x, c.pos.z - eye.z);
    const arm = (s) => (s === 'L' ? 'Mouse0' : 'Mouse2');
    const busyHands = this.isHeld('Mouse0') || this.isHeld('Mouse2');
    // ---- the lesson: what the card asks, a human moment after it shows
    if (B.lesson) {
      const L = B.lesson, st = L.step, kind = L.kind;
      // (a first-timer reads each card before he does what it says)
      if (this.lessonStep !== st) { this.lessonStep = st; this.lessonAt = this.t + r.range(1.4, 2.2); }
      this.walkTo(B, d, kind === 'throw' ? 3.0 : 1.4);
      const open = B.openSides();
      if (['jabL', 'jabR', 'guard', 'hold'].includes(kind) && this.t >= this.lessonAt && !busyHands && me.act === 'idle' && d < 1.75 && him.state === 'move') {
        if (kind === 'hold') { if (open) { this.hold(r.chance(0.5) ? 'Mouse0' : 'Mouse2', r.range(0.5, 0.75)); this.lessonAt = this.t + 1.4; } return; }
        if (open) { this.tap(arm(open[0])); this.lessonAt = this.t + r.range(0.7, 1.1); return; }
        // (the guard up: a punch into it, as a first-timer would)
        if (kind === 'guard' && !L.bounced) { this.tap(r.chance(0.5) ? 'Mouse0' : 'Mouse2'); this.lessonAt = this.t + 1.0; }
        return;
      }
      if (kind === 'grab') { if (B.reachable() && this.once('lessonGrab')) this.tap('KeyE'); }
      // (a card up: he does what it asks, and reads the blows it brings;
      // nothing else)
      if (him.state !== 'attack' && !(B.flying && B.flying.length)) return;
    }
    // ---- a masher: both buttons, as fast as they go, walking in
    if (style === 'mash' && !B.lesson) {
      this.walkTo(B, d, 1.35);
      if (this.every('mash', 0.1, 0.16)) this.tap(this.lastArm = this.lastArm === 'Mouse0' ? 'Mouse2' : 'Mouse0');
      return;
    }
    // ---- defence: a plan per blow, made when the tell is seen
    if (him.state === 'attack' && him.clip && (style !== 'nododge' || B.lesson)) {
      const id = B.stats.his + ':' + him.clip;
      if (!this.plan || this.plan.id !== id) {
        const A = BR_ATTACKS[him.clip];
        const feint = /^br_feint/.test(him.clip);
        // ([B8] 'rough': a first-timer who struggles - a read in two goes
        // wrong or is missed, and he sees the tell late)
        const read = r.chance(B.lesson ? 0.95 : style === 'rough' ? 0.55 : 0.8);
        let act = 'none';
        if (A || feint) {
          const hand = feint ? (him.clip === 'br_feint' ? 'R' : 'L') : A.hand;
          const away = hand === 'R' ? 'KeyD' : hand === 'L' ? 'KeyA' : (r.chance(0.5) ? 'KeyA' : 'KeyD');
          const kind = feint ? 'swing' : A.kind;
          const chev = B._cards && B._cards.chev && B._cards.chev.side;
          if (B.lesson) act = B.lesson.kind === 'block' ? 'block' : kind === 'throw' && chev ? (chev === 'L' ? 'KeyA' : 'KeyD') : away;
          else if (kind === 'throw') act = chev ? (chev === 'L' ? 'KeyA' : 'KeyD') : away;
          else if (kind === 'swing') act = away;
          else if (kind === 'straight') act = r.chance(0.55) ? (r.chance(0.5) ? 'KeyA' : 'KeyD') : r.chance(0.5) ? 'block' : 'KeyS';
          else if (kind === 'over') act = r.chance(0.7) ? away : 'KeyS';
          else if (kind === 'rush') act = r.chance(0.5) ? 'KeyA' : 'KeyD';
          else if (kind === 'shove') act = r.chance(0.5) ? 'KeyS' : away;
          // (now and then, read right, a counter into the side his swing opens)
          if (!B.lesson && style !== 'nododge' && !feint && !A.answer && /^br_(jab|jabR|cross|hook|hookL|body|bodyL|shove)$/.test(him.clip) && r.chance(0.25)) act = 'counter:' + (hand === 'R' ? 'Mouse0' : 'Mouse2');
          // (a misread: nothing, or the wrong way)
          if (!read) act = r.chance(0.5) ? 'none' : act === 'KeyD' ? 'KeyA' : act === 'KeyA' ? 'KeyD' : 'none';
        }
        const cl = c.clip(him.clip);
        const at = cl.marks.tell ?? 0;
        this.plan = { id, act, at: this.t - him.t + at + (style === 'rough' && !B.lesson ? 0.3 : 0.22) + r.gauss() * 0.03, contact: this.t - him.t + (cl.marks.contact ?? cl.marks.release ?? cl.marks.strike ?? 0.5) + (him.clip === 'br_throw' ? 0.25 : 0), done: false };
      }
      const P = this.plan;
      if (!P.done && this.t >= P.at) {
        P.done = true;
        for (const k of moves) this.release(k);
        this.release('Mouse0'); this.release('Mouse2');
        if (P.act === 'block') this.hold('Space', Math.max(0.1, P.contact - this.t + 0.12));
        else if (P.act.startsWith('counter:')) this.tap(P.act.slice(8));
        else if (P.act !== 'none') this.tap(P.act);
      }
      if (this.t < P.contact + 0.05) return;
    }
    if (me.act === 'block' || busyHands) return;
    // (never-dodge: a player who does not read his blows at all - no hop, no
    // block, no counter; he punches only when the man is not swinging)
    if (style === 'nododge' && him.state === 'attack') return;
    // ---- the room: at arm's length (W in; a hop back if he is on top of me)
    const out = him.state === 'reel';
    this.walkTo(B, d, out ? (him.atSpot ? 1.35 : 2.6) : 1.4);
    if (!out && d < 1.05 && me.act === 'idle' && this.every('back', 1.0, 1.8)) { this.tap('KeyS'); return; }
    if (out) {
      // (out of his way as he reels to the window)
      if (!him.atSpot && d < 1.5 && me.act === 'idle' && this.every('clear', 0.6, 1.0)) { this.tap('KeyS'); return; }
      if (him.atSpot && d < 1.75 && me.act === 'idle' && this.every('last', 0.5, 0.9)) this.hold(r.chance(0.5) ? 'Mouse0' : 'Mouse2', r.range(0.45, 0.7));
      return;
    }
    // (now and then a step round him)
    if (him.state === 'move' && me.act === 'idle' && this.every('circle', 3, 6)) { this.hold(r.chance(0.5) ? 'KeyA' : 'KeyD', r.range(0.2, 0.5)); return; }
    // ---- a thing in my hands: used on the first opening (or a stool on him at once)
    const things = style === 'things';
    if (things && !me.holding && me.act === 'idle' && him.state === 'move' && B.reachable() && this.every('grabT', 0.4, 0.7)) { this.tap('KeyE'); return; }
    // ---- the openings, seen a beat late
    const open = B.openSides();
    const look = open + ':' + him.state + ':' + (him.missT > 0);
    // (a first-timer takes a moment to see an opening and choose - about a
    // third of a second - lets one in five go by, and now and then throws
    // the wrong hand into the guard)
    // (the man it has just made miss is watched for: that opening is taken at
    // once, never let go by)
    if (this.seen !== look) { const punish = him.missT > 0; this.seen = look; this.seenAt = this.t + (punish ? r.range(0.2, 0.3) : r.range(0.28, 0.48)); this.skip = !punish && r.chance(0.2); }
    if (this.t < this.seenAt || d > 1.75) return;
    if (me.holding && him.state !== 'attack' && me.act === 'idle') {
      const it = me.holding, big = it.hands === 2;
      if (big || open) {
        const code = big ? arm(r.chance(0.5) ? 'L' : 'R') : arm(it.hand);
        if (!big && r.chance(0.3)) this.hold(code, r.range(0.5, 0.7)); else this.tap(code);
        this.seenAt = this.t + 0.6;
        return;
      }
    }
    if (open && me.act !== 'hurt' && !this.skip) {
      let s = open.length === 2 ? (this.lastSide === 'L' ? 'R' : 'L') : open;
      if (open.length === 1 && r.chance(0.12)) s = s === 'L' ? 'R' : 'L';
      // (a thing in that hand: the other fist)
      if (me.holding && me.holding.hands === 1 && me.holding.hand === s && open.length === 2) s = s === 'L' ? 'R' : 'L';
      this.lastSide = s;
      const big = him.state === 'stun' || him.missT > 0.35;
      // (in a hurry to punish a miss the hold is short; a stunned man waits
      // for the second or third tick)
      if (big && r.chance(0.55) && this.every('hard', 0.6, 1.0)) this.hold(arm(s), him.state === 'stun' ? r.range(0.42, 0.66) : r.range(0.22, 0.42));
      else this.tap(arm(s));
      this.seenAt = this.t + r.range(0.18, 0.3);
      return;
    }
    if (style !== 'fists' && B.round >= 2 && !me.holding && him.state === 'move' && this.every('grab', 7, 12) && B.reachable()) { this.tap('KeyE'); return; }
    // (impatience: a punch into the guard now and then)
    if (him.state === 'move' && (style === 'rough' ? this.every('poke', 1.0, 2.0) : this.every('poke', 2.2, 4.2))) this.tap(r.chance(0.5) ? 'Mouse0' : 'Mouse2');
  }

  // step toward (or away from) him to a distance, with the room's keys; held
  // up (a table, a fallen stool between us) a man steps round it: A or D
  walkTo(B, d, want) {
    // (W walks in; he is kept off by a hop back, not by walking)
    const f = d > want + 0.18 ? 'KeyW' : null;
    if (!f && this.isHeld('KeyW')) this.release('KeyW');
    if (f && !this.isHeld('KeyW') && !this.isHeld('Space')) this.hold(f, 0.2);
    if (f === 'KeyW') {
      if (this.lastD != null && d > this.lastD - 0.004) this.stall = (this.stall || 0) + 1 / 60; else this.stall = 0;
      if (this.stall > 0.6 && !this.isHeld('Space')) { this.side = this.side === 'KeyA' ? 'KeyD' : 'KeyA'; this.hold(this.side, 0.6); this.stall = -0.5; }
    } else this.stall = 0;
    this.lastD = d;
  }
}

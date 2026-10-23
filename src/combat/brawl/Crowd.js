import * as THREE from 'three';
import { BR_ATTACKS } from '../../cast/brawl/clips.js';
import { cued } from '../../game/BrawlCue.js';
import { FightCards } from '../../ui/fightCards.js';
import { MEN, BIG } from './kinds.js';
import { EdgeInk } from './ink.js';

// [O4] The crowd brawl (docs/briefs/O4_COMBAT.md §1): one fist fight for one
// to four men in the open city - a street, a bar, the gym's ring. Built on
// the fist fight's parts (the brawler's clips and their marks, the hands'
// fists, the dodge cue's ink, the fight's cards) with FIGHT.md's rules kept
// and made smoother (G1's v6: nothing locks over a quarter second, a hold
// past 0.25 s is the heavy, the dodge window for a human hand, a glancing
// late step):
//   const F = crowdOf(game);
//   F.start({ men: [{ kind: 'driver', at: { x, z }, yaw }, ...], to, why, bounds, leave, onEnd, onDown, things, dmgK, maxIn })
//   F.stop()   F.active   F.men   F.target   F.stats   F.result
//
// ME. The one I face is the one I look at (the soft lock: controller mode
// 'crowd', src/player/modes/crowd.js). A press of LMB / RMB is a jab of that
// fist at once (contact 0.06 s); still held at 0.25 s the fist cocks - the
// heavy - and goes when let go (or at 0.6 s). SPACE held blocks. A / D a
// hop aside (the dodge), S a hop back; held on, circling and backing.
// E takes a bottle or a chair in reach (the place lists them: things); a
// press swings it once (it breaks on him).
//
// THEM. They stand round me at a ring (2.2 - 3 m), circling; one steps in
// at a time, two at most at once (maxIn), and never two big blows together.
// A man's guard is up while he faces me: a jab into it is caught (and often
// answered); my heavy breaks a lesser man's guard. He is OPEN when a blow of
// his missed (slipped, stepped out of, blocked), when he breathes (a hand
// lowered a moment), stunned after my heavy, after the first of my blows
// that found him (the combo, three or four, then he covers up), with his
// back to me. A punch into his wind-up is caught (I am hit through it); a
// heavy into it stops his blow and lands half again. His small blows (a jab,
// a cross, his answer) are told by his body and three white strokes at his
// fist and are blocked with SPACE; his big ones (hooks, haymakers, the
// shove) come with the dodge cue: the world drops to a third, the side it
// comes from goes black, the safe side white; A / D toward the light in the
// window (0.45 s of real time, 0.03 s less after each clean dodge, never
// under 0.3) slips it clean and he is open; in the 0.12 s after it, a
// glancing blow (half, no stagger); the wrong way, or nothing: it lands. A
// man out of my sight throws only the big ones, and is announced: his feet,
// the ink closing on his side, then the cue from there.
//
// THE END. Each man goes down at none (and stays down, or gets up once,
// slower: MEN[kind].getUp). All down: won. Me at none: down (the warning
// 'One more and you're down.' a second first, always) - the fail, by the
// place's onDown (a cop's fight: 'Hands up.'). Walking off: in the open
// (no bounds) they follow; past 14 m 'He's coming.', past 30 m they give up
// ('He's gone.') and the fight is left.
export const CROWD = {
  me: { jab: 4, heavy: 15, counter: 1.5, back: 1.25, combo: [1, 1, 1.15, 1.3, 1.3], comboGap: 0.55, into: 6 },
  hold: { heavy: 0.25, auto: 0.6 },
  hop: { side: 0.55, back: 0.6, dur: 0.1, again: 0.2 },
  buffer: 0.35,
  // the dodge window (real s): wide at first, tighter with each clean dodge
  cue: { start: 0.45, floor: 0.3, step: 0.03, grace: 0.12, k: 1 / 3, held: 0.03, mercy: 0.05, mercyMax: 0.15 },
  ring: { r: 2.5, rMin: 2.1, rMax: 3.0, sep: 0.95, near: 1.35, maxIn: 2, stepGap: 0.75, bigGap: 1.5, unseen: 0.5 },
  reach: 1.9, cone: 0.62, pick: 0.85, sticky: 0.2, keep: 1.05,
  stun: 1.0, coverAfter: 4, cover: 0.9, hurtMax: 0.25, jammed: 0.25,
  warnOn: 30, warnOff: 40, read: 1.0,
  leave: { warn: 14, gone: 30 },
  getUp: { after: 3.0, hp: 0.34 },
  // the hit stop (steps of 1/60 s) and the frame's kick by what landed
  feel: { jab: { stop: 4, kick: [0.6, 0.8], burst: 90 }, heavy: { stop: 5, kick: [2.2, 2.8], burst: 230, knock: 1.1 }, thing: { stop: 5, kick: [1.8, 2.2], burst: 200, knock: 0.8 } },
};
// the black's words (six at most): what put me down, and the fix
export const CROWD_WHY = {
  late: 'Too slow. Dodge when it slows.',
  wrong: 'Wrong way. Toward the light.',
  answer: 'Into his guard. Wait for openings.',
  caught: 'Caught swinging. Hit when open.',
  jab: 'Block his jab.',
  big: "Don't block the big ones.",
  behind: 'From behind. Keep them in front.',
  down: 'Down.',
};
// the kit's cards (once a save; the ids are the fist fight's own)
export const CROWD_CARDS = {
  opening: '[LMB] [RMB] hit when his guard drops',
  dodge: '[A] [D] dodge toward the light',
  block: '[SPACE] hold to block his jab',
  heavy: '[LMB] keep it pressed: the heavy',
};
const THINGS = {
  bottle: { dmg: 20, hands: 1, breaks: true, clip: 'swingBottle', level: 'thing' },
  chair: { dmg: 28, hands: 2, breaks: true, clip: 'swingStool', level: 'thing' },
  stool: { dmg: 28, hands: 2, breaks: true, clip: 'swingStool', level: 'thing' },
};

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const _a = V(0, 0, 0), _b = V(0, 0, 0), _c = V(0, 0, 0), _d = V(0, 0, 0);
const SMALL = /^br_(jab|jabR|cross|answerL|answerR)$/;
const PREWARM = ['br_guard', 'br_stepF', 'br_stepB', 'br_stepL', 'br_stepR', 'br_pivot', 'br_openBoth', 'br_jab', 'br_jabR', 'br_cross', 'br_hook', 'br_hookL', 'br_body', 'br_bodyL',
  'br_haymaker', 'br_haymakerL', 'br_shove', 'br_answerL', 'br_answerR', 'br_feint', 'br_feintL', 'br_hitHeadL', 'br_hitHeadR', 'br_hitBody', 'br_knockL', 'br_knockR', 'br_stun', 'koFall', 'ko', 'o4_getUp'];
const fresh = () => ({ time: 0, landed: 0, blocked: 0, intoGuard: 0, taken: 0, dmgTaken: 0, slips: 0, glancing: 0, wrong: 0, late: 0, cues: 0, his: 0, hisBlocked: 0, downs: 0, jabs: 0, heavies: 0, counters: 0, combos: 0, breaks: 0, things: 0, kos: 0, ups: 0, jammed: 0, answers: 0, presses: 0, clicks: [], latency: [], why: {} });

export function crowdOf(game) { return game.crowd || (game.crowd = new Crowd(game)); }

export class Crowd {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.men = [];
    this.target = null;
    this.stats = fresh();
    this.result = null;
    this.cue = null;
    this.edge = null;
  }
  get hands() { return this.game.player.hands; }
  get controller() { return this.game.controller; }
  get cards() { return this._cards || (this._cards = new FightCards(this.game.hud)); }
  // (the hands' clips aim the fist at the man I face: player/clips/fight.js aim())
  get c() { return this.target ? this.target.c : null; }

  // ---- start / stop ----------------------------------------------------------------------
  start(cfg = {}) {
    const G = this.game;
    if (this.active) this.stop('restart');
    if (G.brawl && G.brawl.active) G.brawl.stop();
    this.cfg = { to: null, why: {}, bounds: null, leave: true, dmgK: 1, maxIn: null, onEnd: null, onDown: null, things: [], name: null, seed: 4242, ...cfg };
    this.rng = G.stage.rng.fork(this.cfg.seed);
    this.active = true;
    this.result = null; this.done = false; this.timers = []; this.lastHurt = null; this.lastCue = null; this.leaveWarn = false;
    this.stats = fresh();
    this.T = 0; this.RT = 0;
    this.cue = null; G.worldK = 1;
    this.cueW = CROWD.cue.start + Math.min(CROWD.cue.mercyMax, CROWD.cue.mercy * (cfg.lateDowns || 0));
    this.warned = false; this.warnedAt = 0;
    this.lastIn = -9; this.lastBig = -9;
    this.nudge = { guard: 0, opened: false, missedCues: 0, cueAgain: false, openAgain: false };
    this.me = { act: 'idle', arm: null, t: 0, h: null, btn: { Mouse0: null, Mouse2: null }, buf: null, stun: 0, holding: null, lastHop: -9, lastHopKey: null, bounceT: 0 };
    this.men = [];
    for (const spec of this.cfg.men || []) this.add(spec);
    this.target = this.men[0] || null;
    // my body: the street fight's footwork and the soft lock
    const C = this.controller;
    C.setMode('crowd', { target: () => this.lockPoint(), free: () => this.free(), bounds: () => this.cfg.bounds, ease: 0.25 });
    this.hands.equip('fists');
    this.hands.play('guard');
    if (G.weapons && G.weapons.current && G.weapons.current !== 'fists') G.weapons.equip('fists');
    this.edge = this.edge || new EdgeInk(G.hud);
    this.edge.clear();
    this.cards.health(this.target ? this.target.hp / this.target.max : null, this.target ? this.target.name : '', true);
    // the things in reach: E takes one (the place lists them)
    this.thingHandles = [];
    for (const it of this.cfg.things || []) this.offerThing(it);
    G.emit('crowd:start', { n: this.men.length });
    return this;
  }

  // a man into the fight: { kind, at: { x, z }, yaw?, c?: Character, hp?, name?, over?: numbers over the kind's }
  add(spec) {
    const G = this.game, base = MEN[spec.kind] || MEN.driver;
    const K = { ...base, ...(spec.over || {}) };
    let c = spec.c;
    if (!c) c = G.cast.spawn(K.cast, { at: spec.at, yaw: spec.yaw ?? Math.atan2(G.eye.x - spec.at.x, G.eye.z - spec.at.z), name: spec.id || null });
    c.noGlance = true;
    // (his fight's clips baked now, under the fight's opening - not at his first blow)
    const bank = c.fig && c.fig.bank;
    if (bank && bank.ensure) for (const n of PREWARM) { try { bank.ensure(n); } catch (e) { /* a clip his kind lacks */ } }
    c.setState('br_guard', 0.25);
    const m = {
      id: this.men.length, c, K, kind: spec.kind, name: spec.name || K.name, hp: spec.hp ?? K.hp, max: spec.hp ?? K.hp,
      state: 'ring', t: 0, clip: null, h: null, clipT: 0, tk: 1, marks: null, aim: null, atk: 0, slipped: null, hit: false,
      openT: 0, coverT: 0, breatheT: this.rng.range(0, K.breathe || 9), next: this.rng.range(0.6, 1.6) + this.men.length * 0.6,
      combo: 0, lastHitT: -9, ang: null, vel: V(0, 0, 0), loco: null, locoT: 0, yawRate: 0, ups: 0, downT: 0, guardHeavies: 0,
      forceHit: false, answerAt: null, outSeenT: 0, said: false, chase: false,
    };
    c.hp = m.hp;
    this.men.push(m);
    return m;
  }

  stop(why = 'stop') {
    if (!this.active) return;
    const G = this.game;
    this.active = false;
    if (this.cue) this.endCue('gone');
    G.worldK = 1;
    if (this.warned) { this.warned = false; G.hud.warn(null); }
    if (this.edge) this.edge.clear();
    if (this._cards) { this._cards.cue(null); this._cards.clear && this._cards.clear(); this._cards.health(null); }
    for (const h of this.thingHandles || []) G.interact.remove(h);
    this.thingHandles = [];
    const C = this.controller;
    if (C.mode === 'crowd') { const P = C.eyePose(); C.setPose(P.x, P.z, P.yaw, P.pitch); }
    if (this.me && this.me.holding) this.dropThing();
    for (const m of this.men) if (m.c && m.c.fig && m.c.fig.anim) m.c.fig.anim.setTimeScale(1);
    G.emit('crowd:stop', { why, result: this.result });
  }
  // (the men off the stage: a scene's setup clears them, a retry spawns them again)
  clearMen() { const G = this.game; for (const m of this.men) if (m.c) { this.colOn(m, true); G.cast.remove(m.c); } this.men = []; this.target = null; }

  // ---- per step: my input (Game.pre: an input acts on the step it arrives) -------------
  inputStep(dt) {
    if (!this.active || this.game.failing) return;
    this.RT += dt;
    this.pickTarget();
    this.input(dt);
    if (this.cue) this.stepCue(dt);
  }

  // ---- per step: the world (Game.post) ---------------------------------------------------
  update(dt, wdt = dt) {
    if (!this.active) return;
    const G = this.game;
    this.T += wdt;
    this.stats.time += wdt;
    G.health.sinceHit = 0;
    if (this._cards) { this._cards.tick(dt); if (this.target) this._cards.health(Math.max(0, this.target.hp) / this.target.max, this.target.name); }
    this.stepTimers();
    if (!this.active) return;
    this.stepMe(dt);
    this.director(wdt);
    for (const m of this.men) this.stepMan(m, wdt);
    this.separate();
    if (!this.active) return;
    if (this.cue) this.drawCue(dt);
    this.drawWind();
    this.announce(dt);
    this.edge.step(dt);
    this.lowWarn();
    this.bumps();
    this.cardsStep(dt);
    this.endCheck(dt);
  }

  // ---- the man I face --------------------------------------------------------------------
  // the man nearest the middle of my view (within a cone, a little sticky)
  pickTarget() {
    const G = this.game, C = this.controller, e = G.eye;
    const fx = -Math.sin(C.yaw), fz = -Math.cos(C.yaw);
    let best = null, bs = Infinity;
    for (const m of this.men) {
      if (!this.standing(m)) continue;
      const dx = m.c.pos.x - e.x, dz = m.c.pos.z - e.z, d = Math.hypot(dx, dz);
      if (d > 7) continue;
      const ang = Math.acos(Math.max(-1, Math.min(1, (dx * fx + dz * fz) / (d || 1))));
      if (ang > CROWD.pick && m !== this.target) continue;
      const s = ang + d * 0.04 - (m === this.target ? CROWD.sticky : 0);
      if (s < bs) { bs = s; best = m; }
    }
    if (!best) {
      if (this.target && !this.standing(this.target)) this.target = this.men.find((m) => this.standing(m)) || null;
      return;
    }
    if (best !== this.target) { this.target = best; this.switchT = this.T; if (this._cards) this._cards.health(best.hp / best.max, best.name, true); }
  }
  standing(m) { return !!m && (m.state !== 'down' && m.state !== 'out' && m.state !== 'gone' && m.state !== 'rise'); }
  // the soft lock's point: his chest (eased toward a new man over 0.2 s)
  lockPoint() {
    const m = this.target;
    if (!m || !this.standing(m) || this.free()) return null;
    const p = m.c.bones && m.c.bones.chest ? _d.setFromMatrixPosition(m.c.bones.chest.matrixWorld) : _d.set(m.c.pos.x, 1.4, m.c.pos.z);
    const lp = this._lp || (this._lp = { x: p.x, y: p.y, z: p.z, pull: 1 });
    const k = Math.min(1, (this.T - (this.switchT ?? -9)) / 0.2);
    lp.x += (p.x - lp.x) * (k < 1 ? 0.35 : 1); lp.y += (p.y - lp.y) * (k < 1 ? 0.35 : 1); lp.z += (p.z - lp.z) * (k < 1 ? 0.35 : 1);
    lp.pull = 0.6 + 0.4 * k;
    return lp;
  }
  // nobody within reach of me: I walk (and can leave)
  free() {
    if (!this.active) return true;
    const e = this.game.eye;
    for (const m of this.men) if (this.standing(m) && Math.hypot(m.c.pos.x - e.x, m.c.pos.z - e.z) < 3.6) return false;
    return true;
  }
  // is a blow of mine on him? (within reach and the cone of where I look)
  onTarget(m, reach = CROWD.reach) {
    const G = this.game, C = this.controller;
    if (!m || !this.standing(m)) return { ok: false, d: 9, ang: 9 };
    const ch = m.c.bones && m.c.bones.chest ? _a.setFromMatrixPosition(m.c.bones.chest.matrixWorld) : _a.set(m.c.pos.x, 1.3, m.c.pos.z);
    const dx = ch.x - G.eye.x, dz = ch.z - G.eye.z;
    const d = Math.min(Math.hypot(dx, dz), Math.hypot(m.c.pos.x - G.eye.x, m.c.pos.z - G.eye.z));
    const look = Math.atan2(-Math.sin(C.yaw), -Math.cos(C.yaw));
    const ang = Math.abs(wrap(Math.atan2(dx, dz) - look));
    return { ok: d <= reach && ang <= CROWD.cone, d, ang };
  }
  // the man my blow finds: the one I face if he is on it, else another in the cone
  victim(reach = CROWD.reach) {
    if (this.target && this.onTarget(this.target, reach).ok) return this.target;
    let best = null, bd = Infinity;
    for (const m of this.men) { const r = this.onTarget(m, reach); if (r.ok && r.ang < bd) { bd = r.ang; best = m; } }
    return best;
  }

  // ---- my side ---------------------------------------------------------------------------
  can(what) {
    const me = this.me, a = me.act, t = me.t;
    if (a === 'hurt' || a === 'grab') return false;
    if (a === 'idle' || a === 'block') return what !== 'block' || a === 'idle';
    if (what === 'punch') return a !== 'bounce' || me.bounceT <= 0;
    if (a === 'hop') return what === 'block' ? t >= 0.08 : what === 'hop' ? this.T - me.lastHop >= CROWD.hop.again && t >= CROWD.hop.dur : false;
    if (a === 'jab' || a === 'wind' || a === 'heavy' || a === 'swing') return what === 'hop' || what === 'block' ? t >= 0.06 : false;
    if (a === 'bounce') return me.bounceT <= 0;
    return false;
  }

  input(dt) {
    const G = this.game, me = this.me, C = this.controller;
    me.t += dt;
    if (me.bounceT > 0) me.bounceT -= dt;
    const M = C.brawlMove || (C.brawlMove = { f: 0, s: 0 });
    const hurt = me.act === 'hurt';
    const hopping = C.brawlHop && C.brawlHop.t < C.brawlHop.dur;
    const circle = (k) => G.held(k) && me.lastHopKey === k && this.T - me.lastHop > 0.12;
    M.f = hurt || hopping ? 0 : (G.held('KeyW') ? 1 : 0) - (G.held('KeyS') && (me.lastHopKey === 'KeyS' && this.T - me.lastHop > 0.12) ? 1 : 0);
    M.s = hurt || hopping ? 0 : (circle('KeyD') ? 1 : 0) - (circle('KeyA') ? 1 : 0);
    if (me.act === 'wind' || me.act === 'block') { M.f *= 0.5; M.s *= 0.5; }
    // ---- the buttons: each press a jab at once; held, the heavy
    for (const code of ['Mouse0', 'Mouse2']) {
      if (G.pressed(code)) { me.btn[code] = { age: 0, t: 0, down: G.held(code) && !G.released(code), used: false, wound: false, at: this.RT }; this.stats.presses++; }
      const b = me.btn[code];
      if (!b) continue;
      b.age += dt;
      if (b.down) { if (G.held(code) && !G.released(code)) b.t += dt; else b.down = false; }
    }
    // (the free walk: nobody in reach - a press still swings at the air)
    for (const code of ['KeyA', 'KeyD', 'KeyS']) if (G.pressed(code)) me.buf = { code, t: 0 };
    if (me.buf) { me.buf.t += dt; if (me.buf.t > 0.15) me.buf = null; }
    // ---- the heavy: the jab's fist still held past 0.25 s cocks; let go (or 0.6 s), it goes
    if (me.act === 'wind') {
      const b = me.btn[me.code];
      if (me.h && me.h.t > 1.08) me.h.t = 0.48;
      if (!b || !b.down || b.t >= CROWD.hold.auto) { this.heavy(me.arm); return; }
    }
    if ((me.act === 'jab' || me.act === 'bounce') && me.code) {
      const b = me.btn[me.code];
      if (b && b.down && !b.wound && b.t >= CROWD.hold.heavy && !(me.holding)) { b.wound = true; this.wind(me.arm, me.code, b.t); return; }
    }
    // ---- the presses (the newest first): a jab at once, from anything but a blow taken
    const order = ['Mouse0', 'Mouse2'].filter((c) => me.btn[c] && !me.btn[c].used).sort((a, b) => me.btn[a].age - me.btn[b].age);
    for (const code of order) {
      const b = me.btn[code];
      if (b.age > CROWD.buffer) { b.used = true; continue; }
      if (!this.can('punch')) continue;
      b.used = true;
      this.flushContact();
      if (this.cue) this.cueAct('punch');
      const arm = code === 'Mouse0' ? 'L' : 'R';
      if (me.holding) { this.swing(arm, code); return; }
      this.jab(arm, code);
      this.stats.latency.length < 200 && this.stats.latency.push(+(this.RT - b.at).toFixed(3));
      return;
    }
    if (hurt) return;
    // ---- SPACE held: the block
    const space = G.held('Space');
    if (space && me.act !== 'block' && this.can('block')) { if (this.cue) this.cueAct('block'); this.block(true); return; }
    if (!space && me.act === 'block') this.block(false);
    // ---- a hop (the dodge)
    const k = me.buf;
    if (k && !this.free()) {
      if (this.cue && this.cueRefuse(k.code)) { me.buf = null; return; }
      if (this.can('hop')) { me.buf = null; this.hop(k.code); }
    } else if (k && this.free()) me.buf = null;
  }

  // a blow of mine whose contact has not come yet, sent home now (a new press)
  flushContact() {
    const h = this.me.h;
    if (!h || h.done || !h.onMark || !h.marks) return;
    const name = h.marks.contact != null ? 'contact' : null;
    if (!name || h.fired.has(name)) return;
    h.fired.add(name);
    if (h.onMark[name]) h.onMark[name](name);
  }
  rest() { return this.me.holding && THINGS[this.me.holding.kind] && THINGS[this.me.holding.kind].hands === 2 ? 'guardBig' : 'guard'; }

  jab(arm, code) {
    const me = this.me;
    me.act = 'jab'; me.arm = arm; me.code = code; me.t = 0;
    const rec = [code, +this.RT.toFixed(3), null];
    if (this.stats.clicks.length < 600) this.stats.clicks.push(rec);
    me.h = this.hands.play(arm === 'L' ? 'jabL' : 'jabR', { onMark: { contact: () => { rec[2] = +this.RT.toFixed(3); this.myContact('jab', arm); } } });
    this.stats.jabs++;
    this.game.emit('crowd:me', { act: 'jab', arm });
  }
  wind(arm, code, held) {
    const me = this.me;
    me.act = 'wind'; me.arm = arm; me.code = code; me.t = 0;
    me.h = this.hands.play(arm === 'L' ? 'c4windL' : 'c4windR');
    me.h.t = Math.min(0.48, Math.max(0, held - CROWD.hold.heavy) * 1.6 + 0.2);
    this.sfx('wind', null, {});
    this.game.emit('crowd:me', { act: 'wind', arm });
  }
  heavy(arm) {
    const me = this.me;
    me.act = 'heavy'; me.arm = arm; me.t = 0;
    const b = me.btn[me.code]; if (b) b.down = false;
    me.h = this.hands.play((arm === 'L' ? 'c4hardL' : 'c4hardR') + 3, { onMark: { contact: () => this.myContact('heavy', arm) } });
    this.stats.heavies++;
    this.sfx('whiff', null, { k: 0.9 });
    this.game.emit('crowd:me', { act: 'heavy', arm });
  }
  block(on) {
    const me = this.me;
    if (on) { if (me.act === 'wind' || me.act === 'jab') me.code = null; me.act = 'block'; me.t = 0; me.h = this.hands.play(me.holding && THINGS[me.holding.kind].hands === 2 ? 'blockBig' : 'block'); this.game.emit('crowd:me', { act: 'block' }); }
    else { me.act = 'idle'; me.t = 0; me.h = this.hands.play(this.rest()); }
  }
  hop(code) {
    const me = this.me, C = this.controller, H = CROWD.hop;
    if (this.cue) this.cueAct('hop', code);
    const fy = C.yaw;
    const fx = -Math.sin(fy), fz = -Math.cos(fy), rx = Math.cos(fy), rz = -Math.sin(fy);
    let dx, dz, dist, clip;
    if (code === 'KeyS') { dx = -fx; dz = -fz; dist = H.back; clip = 'hopB'; }
    else { const s = code === 'KeyD' ? 1 : -1; dx = rx * s; dz = rz * s; dist = H.side; clip = s > 0 ? 'hopR' : 'hopL'; }
    C.brawlHop = { x: dx, z: dz, dist, dur: H.dur, t: 0, from: { x: C.pos.x, z: C.pos.z } };
    me.act = 'hop'; me.t = 0; me.lastHop = this.T; me.lastHopKey = code; me.code = null;
    const big = me.holding && THINGS[me.holding.kind].hands === 2;
    me.h = this.hands.play(big ? clip + 'Big' : clip);
    this.sfx('scuff', null, { k: 0.8 });
    this.game.emit('crowd:me', { act: 'hop', code });
  }
  swing(arm, code) {
    const me = this.me, it = me.holding, T = THINGS[it.kind];
    me.act = 'swing'; me.arm = T.hands === 2 ? 'R' : it.hand; me.code = code; me.t = 0;
    me.h = this.hands.play(T.clip + (T.hands === 2 ? '' : it.hand === 'L' ? 'L' : ''), { onMark: { contact: () => this.myContact('thing', me.arm) } });
    if (!me.h || !me.h.marks || me.h.marks.contact == null) this.myContact('thing', me.arm);
    this.sfx('whiff', null, { k: 1 });
  }
  stepMe(dt) {
    const me = this.me, H = this.hands;
    if (me.act === 'hurt') { me.stun -= dt; if (me.stun <= 0) { me.act = 'idle'; me.t = 0; me.h = H.play(this.rest()); if (this.game.held('Space')) this.block(true); } return; }
    if (me.act === 'hop' && me.t >= CROWD.hop.dur + 0.05 && (!me.h || me.h.done || me.h.t >= me.h.duration)) { me.act = 'idle'; me.t = 0; me.h = H.play(this.rest()); return; }
    if ((me.act === 'jab' || me.act === 'heavy' || me.act === 'bounce' || me.act === 'swing' || me.act === 'grab') && (!me.h || me.h.done || me.h.t >= me.h.duration)) {
      if (me.act === 'jab' && me.code && me.btn[me.code] && me.btn[me.code].down && !me.btn[me.code].wound) return;
      me.act = 'idle'; me.arm = null; me.t = 0;
      me.h = H.play(this.rest());
      if (this.game.held('Space')) this.block(true);
    }
  }
  // the wind-up's ticks at the fist (the fight's cards: one stroke, then three at full)
  drawWind() {
    const me = this.me;
    if (me.act !== 'wind') { if (this._wound) { this._wound = false; this.cards.windMarks(null); } return; }
    const b = me.btn[me.code], t = b ? b.t : 0;
    const lv = t >= 0.5 ? 3 : t >= 0.38 ? 2 : 1;
    const at = this.game.screenOf(this.game.eye.clone().add(V(me.arm === 'L' ? -0.16 : 0.16, -0.14, 0).applyQuaternion(this.game.camera.quaternion)).addScaledVector(V(0, 0, -0.4).applyQuaternion(this.game.camera.quaternion), 1));
    if (at) { this.cards.windMarks(at, me.arm, lv); this._wound = true; }
  }

  // ---- my blow arrives ------------------------------------------------------------------
  myContact(kind, arm) {
    const G = this.game, me = this.me;
    if (!this.active) return;
    const T = kind === 'thing' && me.holding ? THINGS[me.holding.kind] : null;
    const m = this.victim(T ? CROWD.reach + 0.2 : CROWD.reach);
    if (!m) { this.sfx('whiff', null, { k: kind === 'jab' ? 0.5 : 0.9 }); G.emit('crowd:hit', { by: 'me', kind, zone: 'air' }); if (T) this.spendThing(null); return; }
    const head = _b.setFromMatrixPosition(m.c.bones.head.matrixWorld).clone();
    const dir = _c.set(m.c.pos.x - G.eye.x, 0, m.c.pos.z - G.eye.z).normalize().clone();
    const facing = this.faces(m);
    const inTell = m.state === 'atk' && m.clipT < m.marks.strike && !/^br_feint/.test(m.clip);
    const open = !facing || m.openT > 0 || m.state === 'stun' || m.state === 'hurt' || m.state === 'knock' || (m.state === 'atk' && m.clipT > (m.marks.contact ?? 9) + 0.02 && !m.hit) || !!T;
    // ---- into his wind-up: a jab is caught on his shoulder (he hits me through it);
    // a heavy (or a thing) stops the blow and lands as a counter
    if (inTell && kind === 'jab' && facing) {
      this.stats.jammed++;
      m.forceHit = true;
      this.bounce(arm, 'jammed', head, dir);
      G.emit('crowd:hit', { by: 'me', kind, zone: 'jammed', man: m.id });
      return;
    }
    if (!open && !(inTell && kind !== 'jab')) {
      // ---- into his guard
      if (kind === 'heavy' && (m.K.breaks === true || (m.K.breaks === 2 && ++m.guardHeavies >= 2))) {
        m.guardHeavies = 0;
        this.stats.breaks++;
        this.damage(m, 3, dir, 'chip');
        this.sfx('guardBreak', head, {});
        G.fx.hit.puff(head.clone().addScaledVector(dir, -0.2), dir);
        G.hitStop = Math.max(G.hitStop || 0, 3);
        this.open(m, 1.0);
        this.manState(m, 'hurt', 'br_hitBody', 0.05);
        if (this.controller.kick) this.controller.kick(1.2, 1.4, 0.1);
        G.emit('crowd:hit', { by: 'me', kind, zone: 'broke', man: m.id });
        return;
      }
      if (kind === 'jab' && !this.rng.chance(m.K.guard)) { /* a gap in it: it lands below */ }
      else {
        this.stats.intoGuard++; this.nudge.guard++;
        this.bounce(arm, kind === 'jab' ? 'jab' : 'hard', head, dir);
        G.emit('crowd:hit', { by: 'me', kind, zone: 'guard', man: m.id });
        if (m.state === 'ring' || m.state === 'in') { if (this.rng.chance(m.K.answer) || (this.nudge.pound = (this.nudge.pound || []).filter((x) => this.T - x < 1.5).concat(this.T)).length >= 3) m.answerAt = this.T + 0.1; }
        return;
      }
    }
    // ---- it lands
    let dmg = kind === 'jab' ? CROWD.me.jab : kind === 'heavy' ? CROWD.me.heavy : T.dmg;
    const counter = inTell || (m.missT > 0 && !m.punished);
    if (m.missT > 0) m.punished = true;
    if (counter) { dmg *= CROWD.me.counter; this.stats.counters++; }
    if (!facing) dmg *= CROWD.me.back;
    m.combo = this.T - m.lastHitT <= CROWD.me.comboGap ? m.combo + 1 : 1;
    m.lastHitT = this.T;
    dmg *= CROWD.me.combo[Math.min(CROWD.me.combo.length - 1, m.combo)];
    if (m.combo >= 3) this.stats.combos = Math.max(this.stats.combos, m.combo);
    this.stats.landed++;
    if (open && facing && kind !== 'thing') this.nudge.opened = true;
    this.damage(m, dmg, dir, kind);
    this.feel(kind === 'jab' ? 'jab' : kind === 'heavy' ? 'heavy' : 'thing', head, dir);
    this.sfx(kind === 'jab' ? 'jab' : 'heavy', head, { k: kind === 'jab' ? 0.55 : 0.95 });
    if (kind !== 'jab') this.sfx('hisGrunt', head, { k: 0.8 });
    G.emit('crowd:hit', { by: 'me', kind, zone: 'head', man: m.id, counter, combo: m.combo, dmg: +dmg.toFixed(1) });
    if (T) this.spendThing(head, dir);
    if (m.hp <= 0) { this.knockDown(m, dir); return; }
    // (his blow stopped: a heavy, a thing, or a jab into a straight's tell)
    if (m.state === 'atk' && (kind !== 'jab' || SMALL.test(m.clip))) this.cutBlow(m);
    if (m.state === 'atk') return;
    if (kind === 'jab') {
      if (m.combo >= CROWD.coverAfter) { this.coverUp(m); return; }
      this.manState(m, 'hurt', arm === 'L' ? 'br_hitHeadR' : 'br_hitHeadL', 0.04);
      this.open(m, CROWD.me.comboGap * 0.9);
      return;
    }
    // a heavy (or a thing): driven back, stunned (into whatever stands behind him)
    this.knock(m, dir, kind === 'heavy' ? CROWD.feel.heavy.knock : CROWD.feel.thing.knock, arm);
  }
  // a fist off his guard (or jammed on his shoulder): back it comes; a moment before I can punch again
  bounce(arm, kind, head, dir) {
    const me = this.me, G = this.game;
    me.act = 'bounce'; me.t = 0; me.bounceT = kind === 'jammed' ? CROWD.jammed : kind === 'hard' ? 0.22 : 0.1;
    me.h = this.hands.play(arm === 'L' ? 'bounceL' : 'bounceR');
    const at = head.clone().addScaledVector(dir, -0.22).add(V(0, -0.12, 0));
    this.sfx('blocked', at, { k: kind === 'jab' ? 0.7 : 1 });
    G.fx.hit.puff(at, dir);
  }
  feel(lv, head, dir) {
    const G = this.game, F = CROWD.feel[lv];
    G.hitStop = Math.max(G.hitStop || 0, F.stop);
    if (this.controller.kick) this.controller.kick(F.kick[0], F.kick[1], 0.1);
    const jaw = head.clone().addScaledVector(dir, -0.1);
    const ray = jaw.clone().sub(G.eye).normalize();
    const at = G.eye.clone().addScaledVector(ray, Math.max(0.5, G.eye.distanceTo(jaw) - 0.18));
    G.fx.hit.punch(at, dir.clone(), lv === 'jab' ? 0.3 : 0.85, { px: F.burst, camera: G.camera, from: jaw, noBurst: true });
    const sp = G.screenOf(jaw);
    if (sp) this.cards.burst(sp, F.burst, this.stats.landed + 1);
  }
  damage(m, n, dir, kind) {
    m.hp = Math.max(0, m.hp - n);
    m.c.hp = m.hp;
    if (m === this.target && this._cards) this._cards.health(m.hp / m.max, m.name);
    void dir; void kind;
  }
  open(m, s) { m.openT = Math.max(m.openT, s); }
  faces(m) {
    const e = this.game.eye, F = m.c.fig;
    const rel = wrap(Math.atan2(e.x - F.pos.x, e.z - F.pos.z) - F.yaw);
    return Math.abs(rel) < 1.4;
  }
  coverUp(m) {
    m.combo = 0; m.openT = 0; m.coverT = CROWD.cover; m.backT = 1.0;
    this.manState(m, 'hurt', 'br_hitBody', 0.05);
    m.next = Math.max(m.next, 0.8);
  }

  // ---- what I hold -----------------------------------------------------------------------
  offerThing(it) {
    const G = this.game;
    const h = G.interact.add({ id: 'o4thing:' + (it.name || it.kind) + ':' + this.thingHandles.length, at: () => (it.available && !it.available() ? null : (it.object ? it.object.getWorldPosition(_a) : it.pos)), range: 1.9, cone: 0.55, prompt: 'take the ' + it.kind,
      when: () => this.active && !this.me.holding && (this.me.act === 'idle' || this.me.act === 'block') && (!it.available || it.available()),
      onUse: () => this.take(it) });
    this.thingHandles.push(h);
  }
  take(it) {
    const me = this.me, H = this.hands, T = THINGS[it.kind];
    if (!T || me.holding) return;
    let hand = 'R';
    if (T.hands !== 2) { const s = this.game.screenOf(it.object ? it.object.getWorldPosition(_a) : it.pos); hand = s && s.x < innerWidth / 2 ? 'L' : 'R'; }
    me.act = 'grab'; me.t = 0;
    me.h = H.play(T.hands === 2 ? 'grab' : hand === 'L' ? 'grabL' : 'grab', { onMark: { taken: () => {
      const o = it.take ? it.take() : it.object;
      if (!o) return;
      if (it.kind === 'chair' && !o.userData.grip) o.userData.grip = new THREE.Matrix4().makeTranslation(0.12, 0.95, -0.19);
      me.holding = { kind: it.kind, object: o, hand, hands: T.hands };
      H.hold(o, hand);
      this.sfx('grab_' + (it.kind === 'chair' || it.kind === 'stool' ? 'stool' : it.kind), null, {});
      this.stats.things++;
    } } });
    if (!me.h || !me.h.marks || me.h.marks.taken == null) me.h.onMark.taken();
  }
  // it breaks on him (or on nothing): the pieces fall where it broke
  spendThing(at, dir = null) {
    const me = this.me, G = this.game, it = me.holding;
    if (!it) return;
    me.holding = null;
    const o = this.hands.hold(null, it.hand || 'R', { keep: true });
    if (!o) return;
    const B = G.stage.breakables;
    const where = at ? at.clone().addScaledVector(dir || V(0, 0, -1), -0.25) : G.eye.clone().add(V(0, -0.4, 0)).addScaledVector(V(-Math.sin(this.controller.yaw), 0, -Math.cos(this.controller.yaw)), 1.0);
    G.stage.scene.add(o); o.position.copy(where); o.updateMatrixWorld(true);
    if (B && B.add) { const h = B.add(o, { kind: it.kind === 'bottle' ? 'bottle' : 'chair', hp: 1, solid: false }); B.hit(h, { point: where.clone(), dir: (dir || V(0, 0, -1)).clone(), power: 9, by: 'body' }); }
    else o.parent && o.parent.remove(o);
    this.sfx(it.kind === 'bottle' ? 'break_bottle' : 'break_wood', where, {});
  }
  dropThing() {
    const me = this.me, G = this.game, it = me.holding;
    if (!it) return;
    me.holding = null;
    const o = this.hands.hold(null, it.hand || 'R', { keep: true });
    if (!o) return;
    const p = G.eye.clone().add(V(0, -1.2, 0)).addScaledVector(V(-Math.sin(this.controller.yaw), 0, -Math.cos(this.controller.yaw)), 0.6);
    p.y = G.stage.surfaceY(p.x, p.z) + 0.05;
    G.stage.scene.add(o); o.position.copy(p); o.rotation.set(Math.PI / 2, 0, 0); o.scale.setScalar(1); o.updateMatrixWorld(true);
  }

  // ---- the director: who steps in, and when ----------------------------------------------
  director(dt) {
    // (a test hold: the men stand their ring and wait - the feel's measure)
    if (this.hold) return;
    const live = this.men.filter((m) => this.standing(m));
    const engaged = live.filter((m) => m.state === 'in' || m.state === 'atk');
    const maxIn = this.cfg.maxIn ?? Math.min(CROWD.ring.maxIn, live.length);
    if (this.me.act === 'down' || this.game.failing) return;
    // (a man out of my sight bides his time: he comes, but not as often)
    for (const m of live) if (m.state === 'ring') m.next -= dt * (this.seenBy(m) ? 1 : CROWD.ring.unseen);
    if (engaged.length >= maxIn || this.T - this.lastIn < CROWD.ring.stepGap) return;
    // the one who has waited longest steps in (a man answering steps in at once)
    let pick = null;
    for (const m of live) if (m.state === 'ring' && (m.next <= 0 || m.answerAt != null) && (!pick || m.next < pick.next)) pick = m;
    if (!pick) return;
    pick.state = 'in'; pick.t = 0; this.lastIn = this.T;
    pick.plan = this.plan(pick);
  }
  // his next blow (out of my sight: only a big one, which comes with the cue)
  plan(m) {
    const r = this.rng, K = m.K;
    if (m.answerAt != null) return { clip: this.rng.chance(0.5) ? 'br_answerL' : 'br_answerR', answer: true };
    if (m.pending) { const p = m.pending; m.pending = null; return { clip: p }; }
    const seen = this.seenBy(m);
    if (K.feint && r.chance(K.feint) && seen) return { clip: r.chance(0.5) ? 'br_feint' : 'br_feintL' };
    const mix = { ...K.mix };
    if (!seen) for (const k of Object.keys(mix)) if (!BIG.test(k)) delete mix[k];
    // (never two big ones on me together: a second man throws a small one, or waits)
    if (this.T - this.lastBig < CROWD.ring.bigGap || this.men.some((o) => o !== m && o.state === 'atk' && cued(o.clip) && !o.done)) for (const k of Object.keys(mix)) if (cued(k)) delete mix[k];
    let tot = 0; for (const v of Object.values(mix)) tot += v;
    if (tot <= 0) return { clip: null };
    let x = r.next() * tot, clip = 'br_jab';
    for (const [k, v] of Object.entries(mix)) { x -= v; if (x <= 0) { clip = k; break; } }
    return { clip };
  }
  // can I see him (is he within my view, not off to the side or behind)?
  seenBy(m) {
    const G = this.game, C = this.controller;
    const dx = m.c.pos.x - G.eye.x, dz = m.c.pos.z - G.eye.z;
    const ang = Math.abs(wrap(Math.atan2(dx, dz) - Math.atan2(-Math.sin(C.yaw), -Math.cos(C.yaw))));
    return ang < 0.95;
  }

  // ---- a man, one step --------------------------------------------------------------------
  stepMan(m, dt) {
    const c = m.c, F = c.fig, G = this.game, e = G.eye;
    m.t += dt;
    if (m.openT > 0) m.openT -= dt;
    if (m.missT > 0) m.missT -= dt;
    if (m.coverT > 0) m.coverT -= dt;
    if (m.backT > 0) m.backT -= dt;
    if (m.state === 'gone') return;
    if (m.state === 'down') {
      m.downT += dt;
      if (m.K.getUp && m.ups < 1 && m.downT > CROWD.getUp.after && !this.done) this.getUp(m);
      return;
    }
    if (m.state === 'rise') {
      if (m.t >= 1.5) { m.state = 'ring'; m.t = 0; c.down = false; this.colOn(m, true); c.setState('br_guard', 0.2); m.next = 1.2; }
      return;
    }
    if (m.state === 'out') return;
    // (he looks at me, the eased angle)
    const rel = wrap(Math.atan2(e.x - F.pos.x, e.z - F.pos.z) - F.yaw);
    const want = Math.abs(rel) < 1.9 ? rel : 0;
    m.lookA = (m.lookA ?? want) + (want - (m.lookA ?? want)) * (1 - Math.exp(-dt * 7));
    const a = F.yaw + m.lookA, P = m.lookPt || (m.lookPt = V(0, 0, 0));
    const dd = Math.max(1, Math.hypot(e.x - F.pos.x, e.z - F.pos.z));
    P.set(F.pos.x + Math.sin(a) * dd, Math.abs(rel) < 1.9 ? e.y : F.pos.y + 1.7, F.pos.z + Math.cos(a) * dd);
    c.lookAt(P);
    // his breath: a hand lowered a moment, now and then
    if ((m.state === 'ring' || m.state === 'in') && m.K.breathe) {
      m.breatheT -= dt;
      if (m.breatheT <= 0 && m.coverT <= 0) { m.breatheT = m.K.breathe * this.rng.range(0.8, 1.3); this.open(m, this.rng.range(0.5, 0.7)); m.breathing = true; }
    }
    if (m.openT <= 0) m.breathing = false;
    switch (m.state) {
      case 'ring': break;
      case 'in': {
        const d = Math.hypot(e.x - F.pos.x, e.z - F.pos.z);
        if (!m.plan || !m.plan.clip) { m.state = 'ring'; m.next = this.rng.range(0.6, 1.2); break; }
        const A = BR_ATTACKS[m.plan.clip];
        const reach = A ? (A.kind === 'rush' ? 3.0 : A.path.reach - 0.25) : 1.7;
        if (m.answerAt != null && this.T < m.answerAt) break;
        if (d <= reach || m.t > 2.6) { const p = m.plan; m.plan = null; m.answerAt = null; if (d <= reach + 0.3) this.attack(m, p.clip); else { m.state = 'ring'; m.next = 0.4; } }
        break;
      }
      case 'atk': this.stepBlow(m, dt); break;
      case 'hurt': case 'knock': case 'stun': {
        m.clipT += dt;
        if (m.clipT >= m.dur) {
          if (m.state === 'knock' && m.stunAfter) { m.stunAfter = false; this.manState(m, 'stun', 'br_stun', 0.1); this.open(m, CROWD.stun); break; }
          // (still open - a combo on him, a miss of his: he stays where he is)
          if (m.openT > 0.05 && m.coverT <= 0) this.recover(m); else this.toRing(m);
        }
        break;
      }
      // his blow missed (or mine are on him): he stands there open, guard down, then back to the ring
      case 'recover': if (m.openT <= 0 || m.coverT > 0) this.toRing(m); break;
    }
    this.steer(m, dt);
  }
  recover(m) {
    m.state = 'recover'; m.t = 0; m.clip = null; m.h = null; m.marks = null; m.aim = null; m.loco = null;
    m.c.fig.anim.setTimeScale(1);
    m.c.setState('br_guard', 0.12);
    try { m.c.fig.anim.setOverlay('br_openBoth', 0.08); } catch (e) { /* next step */ }
  }
  toRing(m, gap = null) {
    m.state = 'ring'; m.t = 0; m.clip = null; m.h = null; m.marks = null; m.aim = null;
    m.c.fig.anim.setTimeScale(1);
    m.loco = null;
    m.c.setState('br_guard', 0.14);
    try { m.c.fig.anim.setOverlay(null, 0.12); } catch (e) { /* next step */ }
    if (gap != null) m.next = gap;
  }
  // a reaction or a stagger of his: the clip, timed on its own length
  manState(m, state, clip, fade = 0.08) {
    m.state = state; m.clip = clip; m.clipT = 0; m.t = 0; m.loco = null;
    m.c.fig.anim.setTimeScale(1);
    m.h = m.c.play(clip, { fade, hold: true });
    m.dur = m.c.clip(clip).duration;
    if (m.cueing) this.endCue('gone');
  }

  // ---- his blow ----------------------------------------------------------------------------
  attack(m, clip) {
    const G = this.game, c = m.c;
    const cl = c.clip(clip), A = BR_ATTACKS[clip];
    const tk = m.K.tell || 1;
    m.state = 'atk'; m.clip = clip; m.clipT = 0; m.t = 0; m.tk = tk; m.loco = null; m.hit = false; m.slipped = null; m.forceHit = false; m.judged = false;
    m.marks = { strike: (cl.marks.strike ?? cl.marks.contact ?? 0.3) * tk, contact: cl.marks.contact != null ? cl.marks.contact * tk : null };
    m.dur = cl.duration * tk;
    m.h = c.play(clip, { fade: 0.06, hold: true });
    c.fig.anim.setTimeScale(1 / tk);
    m.atk++;
    this.stats.his++;
    // (aimed where I stand as the tell begins, led a little by my walk - never by a hop)
    const C = this.controller, v = C.vel || V(0, 0, 0);
    const lead = A && A.kind !== 'throw' ? Math.min(0.5, (m.marks.contact ?? 0.4) * 0.5) : 0;
    const hopping = C.brawlHop && C.brawlHop.t < C.brawlHop.dur;
    m.aim = { x: G.eye.x + (hopping ? 0 : v.x * lead), z: G.eye.z + (hopping ? 0 : v.z * lead) };
    // a big blow: the side it comes from, and its aim a hand's width that way (the cue says it)
    m.cueSide = null;
    if (A && cued(clip)) { m.cueSide = this.safeSide(m, A); this.lastBig = this.T; }
    // the tell: the glint at the fist, his grunt; a small blow's three white strokes
    const feint = /^br_feint/.test(clip);
    const hand = feint ? (clip === 'br_feint' ? 'R' : 'L') : A ? (A.hand === 'both' ? 'R' : A.hand) : 'R';
    const p = c.bones[hand === 'L' ? 'handL' : 'handR'].getWorldPosition(V(0, 0, 0));
    if (G.fx.hit.glint) G.fx.hit.glint(p, feint ? 0.45 : 1);
    if (!cued(clip)) { const sp = G.screenOf(p); if (sp && this.seenBy(m)) this.cards.tellMark(sp, hand === 'L' ? 'R' : 'L', 0.22 * tk); }
    this.sfx('hisGrunt', p, { k: feint ? 0.25 : 0.45 });
    this.sfx('tell', p, { kind: clip });
    G.emit('crowd:tell', { man: m.id, clip });
  }
  stepBlow(m, dt) {
    m.clipT += dt;
    const A = BR_ATTACKS[m.clip];
    // the dodge cue at its commit
    if (A && m.cueSide && !m.cued && m.marks.contact != null) {
      const at = Math.max(m.marks.strike * 0.85, m.marks.contact - (this.cueW + CROWD.cue.grace) * CROWD.cue.k);
      if (m.clipT >= at) { m.cued = true; if (this.inPath(m, A, this.game.eye).hit || this.seenBy(m)) this.startCue(m, A); }
    }
    if (m.marks.contact != null && !m.judged && m.clipT >= m.marks.contact) { m.judged = true; this.hisContact(m, A); }
    if (m.clipT >= m.dur) {
      m.cued = false;
      // a miss: open a while (he is in the ring, his guard down: the counter)
      if (!m.hit && A && m.judged && m.missOpen) { m.missOpen = false; m.next = this.rng.range(m.K.gap[0], m.K.gap[1]); if (m.openT > 0.05) this.recover(m); else this.toRing(m); return; }
      // a blow that found me is followed on its heels, now and then
      if (m.hit && !m.pending && this.rng.chance(m.K.combo)) { m.pending = A && A.hand === 'L' ? 'br_cross' : 'br_jab'; this.toRing(m, 0.05); m.state = 'in'; m.t = 0; m.plan = { clip: m.pending }; m.pending = null; return; }
      this.toRing(m, this.rng.range(m.K.gap[0], m.K.gap[1]));
    }
  }
  // his blow cut off by mine (a heavy, a thing): the cue goes
  cutBlow(m) {
    if (m.cueing) this.endCue('gone');
    m.judged = true; m.hit = false; m.missOpen = false;
  }
  // the path of his blow against where I stand (in the frame of his aim)
  inPath(m, A, eye, dx = 0, dz = 0) {
    const c = m.c, P = A.path;
    const ax = m.aim.x - c.pos.x, az = m.aim.z - c.pos.z;
    const dA = Math.max(0.3, Math.hypot(ax, az));
    const fx = ax / dA, fz = az / dA, rx = fz, rz = -fx;
    const ex = eye.x + dx - c.pos.x, ez = eye.z + dz - c.pos.z;
    const lat = ex * rx + ez * rz, dep = ex * fx + ez * fz;
    const reach = Math.min(P.reach, dA + P.over);
    const hit = lat >= P.lo && lat <= P.hi && dep > (P.min ?? 0.2) && dep <= reach;
    const into = hit && A.kind === 'swing' && ((A.hand === 'R' && lat < -0.3) || (A.hand === 'L' && lat > 0.3));
    return { hit, into, lat, dep };
  }
  // the safe side of my screen ('L' | 'R') for this blow: the hop that leaves its
  // path (a straight one is aimed a hand's width to the other side so one does)
  safeSide(m, A) {
    const C = this.controller, e = this.game.eye;
    const rx = Math.cos(C.yaw), rz = -Math.sin(C.yaw), H = CROWD.hop.side;
    // (away from the hand that swings, as he faces me: his right hand is on my left)
    const pref = A.hand === 'R' ? 'R' : A.hand === 'L' ? 'L' : (this.rng.chance(0.5) ? 'L' : 'R');
    const out = (s) => !this.inPath(m, A, e, rx * H * (s === 'R' ? 1 : -1), rz * H * (s === 'R' ? 1 : -1)).hit;
    // (a straight one: aimed a hand's width toward the dark side)
    if (A.kind !== 'swing') { const k = (pref === 'R' ? -1 : 1) * 0.25; m.aim.x += rx * k; m.aim.z += rz * k; }
    if (out(pref) && !this.blockedSide(pref)) return pref;
    const other = pref === 'R' ? 'L' : 'R';
    if (out(other) && !this.blockedSide(other)) return other;
    return pref;
  }
  // a hop that way would be stopped by a wall (no room)
  blockedSide(s) {
    const C = this.controller, S = this.game.stage;
    const rx = Math.cos(C.yaw), rz = -Math.sin(C.yaw), k = s === 'R' ? 1 : -1;
    const q = _a.set(C.pos.x + rx * 0.55 * k, 0, C.pos.z + rz * 0.55 * k);
    S.colliders.resolve(q, C.radius * 0.85);
    return Math.hypot(q.x - (C.pos.x + rx * 0.55 * k), q.z - (C.pos.z + rz * 0.55 * k)) > 0.25;
  }

  // his blow arrives
  hisContact(m, A) {
    const G = this.game, me = this.me, H = this.hands;
    if (!this.active || !A || /^br_feint/.test(m.clip) || me.act === 'down') { m.missOpen = /^br_feint/.test(m.clip) ? false : m.missOpen; return; }
    const eye = G.eye;
    const res = m.forceHit ? { hit: true, into: false } : this.inPath(m, A, eye);
    const cue = m.cueing ? this.cue : null;
    let glancing = false;
    if (cue && m.slipped === 'right' && !m.forceHit) { res.hit = false; }
    else if (cue && m.slipped === 'late' && res.hit) glancing = true;
    if (cue) this.endCue(res.hit ? (cue.answer || 'late') : cue.answer || 'out');
    const seen = this.seenBy(m);
    const from = this.sideOf(m);
    if (!res.hit) {
      m.hit = false; m.missOpen = true;
      { const mt = A.miss.t * (m.K.open || 1); this.open(m, mt); m.missT = mt; m.punished = false; }
      this.stats.missed = (this.stats.missed || 0) + 1;
      this.sfx('whiff', null, { k: 1 });
      if (m.slipped === 'right') this.sfx('c4slip', null, {});
      G.emit('crowd:hit', { by: 'him', man: m.id, kind: m.clip, zone: 'missed' });
      return;
    }
    m.hit = true;
    const K = (m.K.dmg || 1) * (this.cfg.dmgK || 1);
    if (me.act === 'block' && !m.forceHit) {
      if (A.block !== null) {
        this.stats.hisBlocked++;
        if (A.block) this.hurtMe(A.dmg * A.block * K, from, { soft: true });
        this.sfx('blocked', eye, { k: A.kind === 'straight' ? 0.7 : 1 });
        me.h = H.play('blockHit');
        // (a straight blocked leaves him open a moment: the block's reward)
        if (A.kind === 'straight') { m.missOpen = true; m.hit = false; const mt = 0.45 * (m.K.open || 1); this.open(m, mt); m.missT = mt; m.punished = false; }
        G.emit('crowd:hit', { by: 'him', man: m.id, kind: m.clip, zone: 'covered' });
        return;
      }
      // a haymaker, a shove, a rush: through the block, a short stagger
      this.lastHurt = { why: 'big', man: m.id };
      this.hurtMe(A.dmg * 0.5 * K, from, { soft: false, stun: CROWD.hurtMax });
      this.sfx('guardBreak', eye, {});
      if (A.push) this.pushMe(m, A.push);
      G.emit('crowd:hit', { by: 'him', man: m.id, kind: m.clip, zone: 'broke' });
      return;
    }
    let dmg = A.dmg * K;
    if (res.into) dmg *= 1.25;
    if (glancing) { dmg *= 0.5; this.stats.glancing++; }
    const caught = /^(jab|heavy|bounce|wind|swing)$/.test(me.act) && !A.answer;
    if (caught) dmg *= 1.25;
    const why = m.forceHit || (caught && me.act === 'bounce') ? 'caught' : A.answer ? 'answer' : !seen ? 'behind' : cue ? (cue.answer === 'wrong' ? 'wrong' : 'late') : SMALL.test(m.clip) ? 'jab' : cued(m.clip) ? 'late' : 'down';
    this.lastHurt = { why, man: m.id, clip: m.clip };
    this.hurtMe(dmg, from, { stun: glancing ? 0 : Math.min(CROWD.hurtMax, A.stun) });
    if (A.push && !glancing) this.pushMe(m, A.push);
    G.emit('crowd:hit', { by: 'him', man: m.id, kind: m.clip, zone: glancing ? 'glancing' : 'head', dmg: +dmg.toFixed(1), why });
  }
  // the side of my screen he is on ('L' | 'R' | 'F' ahead | 'B' behind)
  sideOf(m) {
    const G = this.game, C = this.controller;
    const dx = m.c.pos.x - G.eye.x, dz = m.c.pos.z - G.eye.z;
    const rel = wrap(Math.atan2(dx, dz) - Math.atan2(-Math.sin(C.yaw), -Math.cos(C.yaw)));
    if (Math.abs(rel) < 0.45) return 'F';
    if (Math.abs(rel) > 2.5) return 'B';
    return rel > 0 ? 'L' : 'R';
  }
  hurtMe(n, from = 'F', { soft = false, stun = 0.2 } = {}) {
    const G = this.game, me = this.me, H = this.hands;
    // (nobody goes down unwarned: a blow that would take the last of me while
    // the warning has not been up a second leaves one - and puts it up)
    if (G.health.hp - n <= 0 && !(this.warned && this.T - this.warnedAt >= CROWD.read)) {
      n = Math.max(0, G.health.hp - 1);
      this.stats.spared = (this.stats.spared || 0) + 1;
      if (!this.warned) { this.warned = true; this.warnedAt = this.T; G.hud.warn('One more and you’re down.'); }
    }
    this.stats.taken++;
    this.stats.dmgTaken += n;
    if (!soft) {
      this.controller.shake(0.22 + n / 45, 0);
      this.sfx('punchMe', null, { k: Math.min(1, n / 18) });
      this.sfx('myGrunt', null, { k: Math.min(1, n / 18) });
      if (me.act === 'wind' || me.act === 'jab') me.code = null;
      if (this.controller.brawlHop) this.controller.brawlHop = null;
      if (stun > 0) { me.act = 'hurt'; me.t = 0; me.stun = stun; me.h = H.play(from === 'L' ? 'hurtFromL' : from === 'R' ? 'hurtFromR' : 'hurtFront'); }
      if (me.holding && n >= 12) this.dropThing();
    }
    // (a fist is no bullet: no blood on the lens - the ink closes in a touch on
    // the side it came from, the frame's flash, and the health's own count)
    if (!soft && this.edge) this.edge.pulse(from === 'F' ? 'B' : from, Math.min(0.85, 0.35 + n / 25));
    const Hh = G.health;
    if (Hh.dead) return;
    Hh.hp = Math.max(0, Hh.hp - n); Hh.sinceHit = 0; Hh.hitA = Math.max(Hh.hitA || 0, Math.min(0.7, 0.2 + n / 30));
    if (Hh.hp <= 0) { Hh.dead = true; if (Hh.onDeath) Hh.onDeath(); }
  }
  pushMe(m, k) {
    const C = this.controller, P = C.brawlPush;
    if (!P) return;
    const dx = this.game.eye.x - m.c.pos.x, dz = this.game.eye.z - m.c.pos.z, d = Math.hypot(dx, dz) || 1;
    P.x += dx / d * k * 5.5; P.z += dz / d * k * 5.5;
    if (k > 0.8) { this.hands.play('shoved'); this.sfx('shove', null, { k: 1 }); }
  }
  bumps() {
    const C = this.controller, b = C.bump;
    if (!b) return;
    C.bump = null;
    this.sfx('bodyThud', b.at, { k: Math.min(1, b.speed / 5) });
    C.shake(0.3, 0);
  }

  // ---- the dodge cue ------------------------------------------------------------------------
  startCue(m, A) {
    const G = this.game;
    if (this.cue) this.endCue('gone');
    const remain = Math.max(0.02, m.marks.contact - m.clipT);
    let held = false, teach = null;
    const K = G.hud && G.hud.kit, untaught = K && K.taught && !K.taught().dodge;
    if (untaught && G.hud.teach && !G.shotMode) { teach = G.hud.teach('dodge', CROWD_CARDS.dodge, { hold: true, holdMax: 6, until: () => !this.cue || this.cue.done }); held = !teach.done; }
    else if (this.nudge.cueAgain && G.hud.teach) { this.nudge.cueAgain = false; this.nudge.missedCues = 0; G.hud.teach.again('dodge', CROWD_CARDS.dodge, { hold: false, secs: 2.4, until: () => !this.cue || this.cue.done }); }
    if (!held && G.hud.kit && G.hud.kit.teachCur && G.hud.kit.teachCur.id !== 'dodge' && G.hud.teach.dismiss) G.hud.teach.dismiss();
    const win = this.cueW + CROWD.cue.grace;
    const k = Math.max(0.06, Math.min(1, remain / win));
    this.cue = { m, A, clip: m.clip, side: m.cueSide, t: 0, win: this.cueW, k, vis: 0, held, teach, answer: null, done: false, atk: m.atk };
    m.cueing = true; m.slipped = null;
    G.worldK = held ? CROWD.cue.held : k;
    this.stats.cues++;
    this.sfx('c4cue', null, { k });
    if (G.sfx && G.sfx.duck) G.sfx.duck(0.75, 0.6);
    G.emit('brawl:cue', { clip: m.clip, side: m.cueSide });
    G.emit('crowd:cue', { man: m.id, clip: m.clip, side: m.cueSide, win: this.cueW });
  }
  stepCue(dt) {
    const Q = this.cue;
    if (!Q || Q.done) return;
    Q.t += dt;
    const m = Q.m;
    if (m.state !== 'atk' || m.atk !== Q.atk) { this.endCue('gone'); return; }
    if (Q.held) {
      const K = this.game.hud && this.game.hud.kit, cur = K && K.teachCur;
      const still = cur && Q.teach && cur.h === Q.teach && cur.held;
      if (!still && Q.t > 0.1) { Q.held = false; Q.t = Q.win * 0.5; this.game.worldK = Q.k; }
      return;
    }
    if (Q.t >= Q.win + CROWD.cue.grace + 0.05) this.endCue(Q.answer || 'late');
  }
  // a key toward the dark under a held cue is not taken (the very first, its card up)
  cueRefuse(code) {
    const Q = this.cue;
    if (!Q || !Q.held || Q.done) return false;
    if (code === 'KeyS') return true;
    return !((code === 'KeyD' && Q.side === 'R') || (code === 'KeyA' && Q.side === 'L'));
  }
  // I did something under the cue: a hop (code), a punch, the block
  cueAct(kind, code = null) {
    const Q = this.cue;
    if (!Q || Q.done || Q.answer) return;
    if (kind === 'hop' && code !== 'KeyS') {
      const right = (code === 'KeyD' && Q.side === 'R') || (code === 'KeyA' && Q.side === 'L');
      Q.answer = right ? (Q.t <= Q.win || Q.held ? 'right' : 'late') : 'wrong';
      Q.m.slipped = Q.answer;
      if (Q.answer === 'right') { this.sfx('c4slip', null, {}); }
    } else Q.answer = kind;
    // (the world comes back the instant I act)
    this.game.worldK = 1;
  }
  endCue(answer) {
    const Q = this.cue;
    if (!Q || Q.done) return;
    Q.done = true;
    const G = this.game;
    G.worldK = 1;
    Q.m.cueing = false;
    const S = this.stats;
    if (answer === 'right') { S.slips++; this.cueW = Math.max(CROWD.cue.floor, this.cueW - CROWD.cue.step); this.nudge.missedCues = 0; }
    else if (answer === 'wrong') { S.wrong++; this.nudge.missedCues++; }
    else if (answer === 'late') { S.late++; this.nudge.missedCues++; }
    if (this.nudge.missedCues >= 3 && !this.nudge.cueAgainUsed) { this.nudge.cueAgain = true; this.nudge.cueAgainUsed = true; }
    this.lastCue = { answer, t: this.T, clip: Q.clip };
    this.cue = null;
    this.cards.cue(null, answer === 'right' ? 'right' : answer);
    G.emit('crowd:cueEnd', { answer, clip: Q.clip });
  }
  drawCue(dt) {
    const Q = this.cue, G = this.game;
    if (!Q || Q.done) return;
    Q.vis = Math.min(1, Q.vis + dt / 0.05);
    const m = Q.m, hand = Q.A && (Q.A.hand === 'L' ? 'L' : 'R');
    const bone = m.c.bones[hand === 'L' ? 'handL' : 'handR'];
    let at = null, px = 40;
    if (bone) { const p = bone.getWorldPosition(_a); at = G.screenOf(p); const d = Math.max(0.3, G.camera.position.distanceTo(p)); px = Math.max(26, Math.min(150, 0.11 / d * innerHeight * 0.9)); }
    // (a man out of my sight: no fist to mark, the ink alone)
    if (!this.seenBy(m)) at = null;
    this.cards.cue({ side: Q.side, k: Q.vis * (Q.answer ? 0.5 : 1), t: Q.t, held: Q.held, at, px, kind: (Q.A && Q.A.kind) || 'swing' });
  }

  // ---- a man stepping in from out of my sight: his feet, the ink on his side -------------
  announce(dt) {
    let side = null, k = 0;
    for (const m of this.men) {
      if (!this.standing(m) || (m.state !== 'in' && m.state !== 'atk') || this.seenBy(m)) { m.outSeenT = 0; continue; }
      m.outSeenT += dt;
      const s = this.sideOf(m);
      const kk = m.state === 'atk' ? 0.7 : 0.45;
      if (kk > k) { k = kk; side = s === 'F' ? null : s; }
      if (!m.said) { m.said = true; this.sfx('scuff', m.c.pos.clone().setY(0.1), { k: 1 }); this.sfx('hisGrunt', m.c.pos.clone().setY(1.6), { k: 0.35 }); }
    }
    for (const m of this.men) if (m.state === 'ring') m.said = false;
    if (this.cue) { side = null; k = 0; }
    this.edge.set(side, k);
  }

  // ---- him knocked back, down, up again -------------------------------------------------
  knock(m, dir, D, arm) {
    const c = m.c, F = c.fig;
    const hit = this.sweep(m, dir, D);
    const d0 = hit ? Math.max(0.12, hit.s - 0.08) : D;
    const clip = arm === 'L' ? 'br_knockR' : 'br_knockL';
    this.manState(m, 'knock', clip, 0.05);
    F.startRoot(c.animName, { scale: d0 / (1.0 * F.scale) });
    if (F._rmClip) F._rmClip.yaw0 = Math.atan2(-dir.x, -dir.z);
    m.stunAfter = true;
    m.openT = 0;
    if (hit) {
      // into the wall (or a car, a post): it hurts him more, and he stays down longer
      this.later(0.3 * d0 / D, () => { if (!this.active || !this.standing(m)) return; this.damage(m, CROWD.me.into, dir, 'into'); this.sfx('bodyThud', V(m.c.pos.x, 1, m.c.pos.z), { k: 1 }); this.controller.shake(0.3, 1.5); this.game.hitStop = Math.max(this.game.hitStop || 0, 2); this.stats.into = (this.stats.into || 0) + 1; this.game.emit('crowd:into', { man: m.id }); if (m.hp <= 0) this.knockDown(m, dir); });
    }
    m.next = Math.max(m.next, CROWD.stun + 0.4);
  }
  // what stands behind him along dir within D (a wall, a car, a post): { s }
  sweep(m, dir, D) {
    const c = m.c, S = this.game.stage, r = (c.fig.collider ? c.fig.collider.r : 0.35), Cl = S.colliders;
    for (let s = 0.08; s <= D + 0.001; s += 0.05) {
      const x = c.pos.x + dir.x * s, z = c.pos.z + dir.z * s;
      for (const b of Cl.boxes) {
        const lx = (x - b.cx) * b.c - (z - b.cz) * b.s, lz = (x - b.cx) * b.s + (z - b.cz) * b.c;
        const qx = Math.max(-b.hx, Math.min(b.hx, lx)), qz = Math.max(-b.hz, Math.min(b.hz, lz));
        if (Math.hypot(lx - qx, lz - qz) < r * 0.85) return { s, obj: b };
      }
      for (const q of Cl.circles) { if (q === c.fig.collider || q.tag === 'hood' || q.tag === 'corpse') continue; if (Math.hypot(q.x - x, q.z - z) < q.r + r * 0.85) return { s, obj: q }; }
      const B = this.cfg.bounds;
      if (B && (x > B.x1 - r || x < B.x0 + r || z > B.z1 - r || z < B.z0 + r)) return { s, obj: null };
    }
    return null;
  }
  knockDown(m, dir) {
    const G = this.game;
    if (m.cueing) this.endCue('gone');
    m.c.fig.anim.setTimeScale(1);
    m.state = 'down'; m.t = 0; m.downT = 0; m.openT = 0;
    m.c.ko('deathBack');
    this.colOn(m, false);
    this.stats.kos++;
    this.sfx('bodyFloor', V(m.c.pos.x, 0.2, m.c.pos.z), { k: 1 });
    G.slowmo && this.alive().length === 0 && G.slowmo(0.4, 0.5);
    G.emit('crowd:down', { man: m.id, kind: m.kind });
    if (!(m.K.getUp && m.ups < 1)) m.state = 'out';
    void dir;
    if (this.target === m) { this.target = null; this.pickTarget(); }
  }
  getUp(m) {
    m.ups++;
    this.stats.ups++;
    m.state = 'rise'; m.t = 0;
    m.hp = Math.max(1, Math.round(m.max * CROWD.getUp.hp));
    m.c.hp = m.hp;
    let ok = false;
    try { m.c.play('o4_getUp', { fade: 0.2, hold: true }); ok = true; } catch (e) { ok = false; }
    if (!ok) { m.c.down = false; m.c.setState('br_guard', 0.6); }
    m.K = { ...m.K, tell: (m.K.tell || 1) * 1.12, gap: [m.K.gap[0] * 1.2, m.K.gap[1] * 1.2], open: (m.K.open || 1) * 1.15 };
    this.game.emit('crowd:up', { man: m.id });
  }
  // his body in the colliders (standing) or out of them (down: the dead block nobody's feet)
  colOn(m, on) {
    const S = this.game.stage, cs = S.colliders.circles, col = m.c.fig && m.c.fig.collider;
    if (!col) return;
    const i = cs.indexOf(col);
    if (on && i < 0) cs.push(col);
    if (!on && i >= 0) cs.splice(i, 1);
  }
  alive() { return this.men.filter((m) => m.state !== 'out' && m.state !== 'gone'); }

  // ---- his feet: the ring round me, the step in, round the others and the furniture ----
  steer(m, dt) {
    const c = m.c, F = c.fig, G = this.game, e = G.eye, S = G.stage;
    const free = m.state === 'ring' || m.state === 'in';
    let gx = F.pos.x, gz = F.pos.z, speed = m.K.speed;
    const dx = F.pos.x - e.x, dz = F.pos.z - e.z, d = Math.hypot(dx, dz) || 1;
    if (free) {
      if (m.state === 'in') {
        // in to arm's length, straight at me
        const keep = CROWD.ring.near;
        gx = e.x + dx / d * keep; gz = e.z + dz / d * keep; speed *= 1.25;
      } else {
        // the ring: his own angle round me, kept apart from the others', circling slowly
        if (m.ang == null) m.ang = Math.atan2(dz, dx);
        const cur = Math.atan2(dz, dx);
        m.ang += wrap(cur - m.ang) * Math.min(1, dt * 1.5);
        for (const o of this.men) {
          if (o === m || !this.standing(o) || o.state === 'atk' || o.ang == null) continue;
          const da = wrap(m.ang - o.ang);
          const want = 0.95;
          if (Math.abs(da) < want) m.ang += Math.sign(da || 1) * (want - Math.abs(da)) * Math.min(1, dt * 2.2);
        }
        m.circ = m.circ ?? (this.rng.chance(0.5) ? 1 : -1);
        m.circT = (m.circT ?? this.rng.range(1.5, 3.5)) - dt;
        if (m.circT <= 0) { m.circT = this.rng.range(1.8, 3.8); m.circ = this.rng.chance(0.3) ? 0 : this.rng.chance(0.5) ? 1 : -1; }
        m.ang += m.circ * 0.32 * dt;
        const r = m.backT > 0 ? CROWD.ring.rMax + 0.3 : m.chase ? 1.8 : CROWD.ring.r + (m.id % 2) * 0.35;
        gx = e.x + Math.cos(m.ang) * r; gz = e.z + Math.sin(m.ang) * r;
        if (d > 6) speed *= 1.9;
      }
      // (a place he can stand: out of what stands there)
      const q = _a.set(gx, 0, gz);
      S.colliders.resolve(q, (F.collider ? F.collider.r : 0.35), F.collider);
      gx = q.x; gz = q.z;
    }
    const tv = _b.set(0, 0, 0);
    if (free) { const ddx = gx - F.pos.x, ddz = gz - F.pos.z, dd = Math.hypot(ddx, ddz); if (dd > 0.08) tv.set(ddx, 0, ddz).multiplyScalar(Math.min(speed, dd * 2.4) / dd); }
    m.vel.lerp(tv, 1 - Math.exp(-dt * 7));
    if (!free) m.vel.multiplyScalar(Math.exp(-dt * 12));
    let moved = 0;
    if (free && m.vel.lengthSq() > 1e-6) {
      const x0 = F.pos.x, z0 = F.pos.z;
      const p = _c.set(x0 + m.vel.x * dt, 0, z0 + m.vel.z * dt);
      S.colliders.resolve(p, (F.collider ? F.collider.r : 0.35), F.collider);
      if (Math.hypot(p.x - x0, p.z - z0) < m.vel.length() * dt * 0.4) {
        for (const a of [0.7, -0.7, 1.3, -1.3]) {
          const q = V(x0 + (m.vel.x * Math.cos(a) - m.vel.z * Math.sin(a)) * dt, 0, z0 + (m.vel.x * Math.sin(a) + m.vel.z * Math.cos(a)) * dt);
          S.colliders.resolve(q, (F.collider ? F.collider.r : 0.35), F.collider);
          if (Math.hypot(q.x - x0, q.z - z0) > m.vel.length() * dt * 0.6) { p.copy(q); break; }
        }
      }
      F.pos.x = p.x; F.pos.z = p.z;
      moved = Math.hypot(p.x - x0, p.z - z0) / Math.max(1e-6, dt);
    }
    // (never into me: he stops at arm's length; a blow's own travel too)
    {
      const ex = F.pos.x - e.x, ez = F.pos.z - e.z, ed = Math.hypot(ex, ez);
      const R = m.state === 'atk' && m.clip === 'br_rush' ? 1.2 : CROWD.keep;
      if (ed < R && ed > 1e-4) {
        const x0 = F.pos.x, z0 = F.pos.z;
        F.pos.x = e.x + ex / ed * R; F.pos.z = e.z + ez / ed * R;
        S.colliders.resolve(F.pos, (F.collider ? F.collider.r : 0.35), F.collider);
        if (F._rmClip) { F._rmClip.x0 += F.pos.x - x0; F._rmClip.z0 += F.pos.z - z0; }
      }
    }
    // (a blow's travel never through the hard things: pushed back out, its clip's origin with it)
    if (!free && m.state !== 'down' && m.state !== 'out') {
      const q = _d.set(F.pos.x, 0, F.pos.z);
      S.colliders.resolve(q, (F.collider ? F.collider.r : 0.35) * 0.9, F.collider, false);
      const ddx = q.x - F.pos.x, ddz = q.z - F.pos.z;
      if (Math.abs(ddx) + Math.abs(ddz) > 1e-5) { F.pos.x = q.x; F.pos.z = q.z; if (F._rmClip) { F._rmClip.x0 += ddx; F._rmClip.z0 += ddz; } }
    }
    if (c.object) { c.object.position.x = F.pos.x; c.object.position.z = F.pos.z; }
    // facing: at me (5 rad/s, the short way); through a tell at where it is aimed; struck, no turn
    const aimT = m.state === 'atk' && m.aim && m.clipT < m.marks.strike;
    if (free || aimT) {
      const want = aimT ? Math.atan2(m.aim.x - F.pos.x, m.aim.z - F.pos.z) : Math.atan2(e.x - F.pos.x, e.z - F.pos.z);
      const dy = wrap(want - F.yaw);
      const step = Math.sign(dy) * Math.min(Math.abs(dy), 5 * dt);
      F.yaw = wrap(F.yaw + step);
      m.yawRate = step / Math.max(1e-6, dt);
    } else m.yawRate = 0;
    if (free) this.locomote(m, dt, moved);
  }
  locomote(m, dt, v) {
    const c = m.c, F = c.fig;
    let clip;
    if (v < 0.12) clip = Math.abs(m.yawRate || 0) > 1.0 ? 'br_pivot' : 'br_guard';
    else {
      const s = Math.sin(F.yaw), co = Math.cos(F.yaw);
      const fw = m.vel.x * s + m.vel.z * co, lf = m.vel.x * co - m.vel.z * s;
      clip = Math.abs(fw) >= Math.abs(lf) ? (fw > 0 ? 'br_stepF' : 'br_stepB') : (lf > 0 ? 'br_stepL' : 'br_stepR');
    }
    if (m.loco !== clip) {
      if (m.locoT > 0 && m.loco && clip !== 'br_guard' && m.loco !== 'br_guard') m.locoT -= dt;
      else { m.loco = clip; m.locoT = 0.2; c.setState(clip, 0.16); }
    } else if (m.locoT > 0) m.locoT -= dt;
    if (/^br_step/.test(clip)) F.anim.setTimeScale(Math.max(0.35, Math.min(1.8, v / 1.0)));
    else if (clip === 'br_pivot') F.anim.setTimeScale(Math.max(0.6, Math.min(1.6, Math.abs(m.yawRate) / 2.2)));
    else F.anim.setTimeScale(1);
    // his guard drawn by his body: a hand dropped while he breathes or is open after a miss
    const want = m.openT > 0 && m.coverT <= 0 ? 'br_openBoth' : null;
    if (F.anim.overlay !== want) { try { F.anim.setOverlay(want, want ? 0.1 : 0.12); } catch (e) { /* next step */ } }
  }
  // the men keep a body's width from one another (nobody through anybody)
  separate() {
    const L = this.men.filter((m) => this.standing(m));
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      const a = L[i].c.fig, b = L[j].c.fig;
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz), R = CROWD.ring.sep * 0.75;
      if (d < R && d > 1e-4) {
        const k = (R - d) / d * 0.5;
        const wa = L[i].state === 'atk' ? 0.2 : 1, wb = L[j].state === 'atk' ? 0.2 : 1, s = wa + wb;
        a.pos.x -= dx * k * 2 * wa / s; a.pos.z -= dz * k * 2 * wa / s;
        b.pos.x += dx * k * 2 * wb / s; b.pos.z += dz * k * 2 * wb / s;
      }
    }
  }

  // ---- the warning, the cards, the end ----------------------------------------------------
  lowWarn() {
    const G = this.game, hp = G.health.hp;
    const on = this.warned ? hp < CROWD.warnOff : hp < CROWD.warnOn;
    if (on && !this.warned) { this.warned = true; this.warnedAt = this.T; G.hud.warn('One more and you’re down.'); }
    else if (!on && this.warned) { this.warned = false; G.hud.warn(null); }
  }
  // the kit's cards, at their first need (once a save); the nudge once each
  cardsStep() {
    const G = this.game, T = G.hud && G.hud.teach;
    if (!T || G.shotMode || this.cue || G.failing) return;
    const K = G.hud.kit, taught = K && K.taught ? K.taught() : {};
    // the opening: the first time a man I face is open (a miss, a breath), a second in at least
    const m = this.target;
    if (!taught.opening && m && m.openT > 0.25 && this.T > 1.2 && this.seenBy(m)) { T('opening', CROWD_CARDS.opening, { secs: 3.2, until: false }); return; }
    // the block: after his jab found me
    if (!taught.block && this.lastHurt && this.lastHurt.why === 'jab') { T('block', CROWD_CARDS.block, { secs: 3.4, until: 'Space' }); return; }
    // the heavy: the first time a man is stunned or open long, for a man who has never loaded one
    if (!taught.heavy && taught.opening && !this.stats.heavies && m && (m.state === 'stun' || m.missT > 0.5)) { T('heavy', CROWD_CARDS.heavy, { secs: 3.2, until: false }); return; }
    // the nudge: eight punches into the guard without one into an opening
    if (this.nudge.guard >= 8 && !this.nudge.opened && !this.nudge.openAgain && taught.opening) { this.nudge.openAgain = true; T.again('opening', CROWD_CARDS.opening, { secs: 3.2, until: false }); }
  }
  // won, lost, left
  endCheck(dt) {
    const G = this.game;
    if (this.done) return;
    const live = this.alive();
    if (!live.length) { this.finish('won'); return; }
    // walking off (in the open): they follow a while, then give up
    if (this.cfg.leave && !this.cfg.bounds) {
      const e = G.eye;
      let near = Infinity;
      for (const m of live) if (this.standing(m)) near = Math.min(near, Math.hypot(m.c.pos.x - e.x, m.c.pos.z - e.z));
      // (nobody on his feet - one down, about to get up - is no one to leave)
      if (near === Infinity) return;
      const far = near;
      if (far > CROWD.leave.gone) { this.finish('left'); return; }
      const w = this.leaveWarn ? far > CROWD.leave.warn - 2 : far > CROWD.leave.warn;
      if (w !== !!this.leaveWarn) { this.leaveWarn = w; if (!this.warned) G.hud.warn(w ? (live.length > 1 ? 'They’re coming.' : 'He’s coming.') : null); }
      for (const m of live) m.chase = far > 4;
    }
    void dt;
  }
  finish(result) {
    const G = this.game;
    this.done = true;
    this.result = result;
    if (this.leaveWarn) { this.leaveWarn = false; G.hud.warn(null); }
    if (this.warned) { this.warned = false; G.hud.warn(null); }
    if (result === 'left') { for (const m of this.men) if (this.standing(m)) { m.state = 'gone'; this.toRing(m); m.state = 'gone'; } if (G.hud.say) G.hud.say(this.alive().length > 1 ? 'They’re gone.' : 'He’s gone.', 2.2, { always: true }); }
    G.emit('crowd:end', { result, stats: this.stats });
    const cb = this.cfg.onEnd;
    this.stop(result);
    if (cb) cb(result, this);
  }
  // my health at none: the place says what it means (the hospital, the station)
  playerDown() {
    const G = this.game;
    if (this.done) return;
    this.done = true;
    this.result = 'down';
    this.stats.downs++;
    const why = (this.lastHurt && CROWD_WHY[this.lastHurt.why]) || CROWD_WHY.down;
    this.stats.why[this.lastHurt ? this.lastHurt.why : 'down'] = (this.stats.why[this.lastHurt ? this.lastHurt.why : 'down'] || 0) + 1;
    G.emit('crowd:end', { result: 'down', why, stats: this.stats });
    const spec = this.cfg.onDown ? this.cfg.onDown({ why, last: this.lastHurt, crowd: this }) : null;
    const cop = this.men.some((m) => m.kind === 'cop' && this.standing(m));
    const words = (spec && spec.why) || (cop ? 'Hands up.' : why);
    this.stop('down');
    G.fail({ why: words, to: (spec && spec.to) || this.cfg.to || (G.scenes && G.scenes.beat), fall: true });
  }

  // a timer on the world's clock
  later(s, fn) { (this.timers || (this.timers = [])).push({ at: this.T + s, fn }); }
  stepTimers() { const L = this.timers; if (!L || !L.length) return; for (const x of [...L]) if (this.T >= x.at) { L.splice(L.indexOf(x), 1); x.fn(); } }
  sfx(name, pos, p) { const S = this.game.sfx; if (!S || !S.live) return; if (name.startsWith('break_')) S.play(name, pos, p, { ref: 2 }); else S.fight(name, pos, p); }

  // [O4] where my blow ends, as the eye sees him (the hands' clips read it as the blow starts)
  fistPose(side, kind = 'jab', k = 1) {
    const G = this.game, m = this.victim(CROWD.reach + 0.15) || this.target, cam = G.camera;
    void k;
    if (!m || !m.c.bones || !m.c.bones.head) return null;
    cam.updateMatrixWorld();
    const sgn = side === 'L' ? -1 : 1;
    const head = _a.setFromMatrixPosition(m.c.bones.head.matrixWorld);
    const right = _b.set(1, 0, 0).applyQuaternion(cam.quaternion).setY(0).normalize();
    const T = _c.copy(head).addScaledVector(right, sgn * 0.075);
    T.y -= kind === 'hard' || kind === 'follow' ? 0.1 : 0.06;
    const tc = T.applyMatrix4(cam.matrixWorldInverse);
    const tgt = this.onTarget(m, CROWD.reach + 0.15);
    const dir = tgt.ok && tc.z < -0.3 ? tc.clone().normalize() : V(sgn * 0.035, -0.07, -1).normalize();
    const depth = { jab: 0.66, hard: 0.7, follow: 0.74, block: 0.6, bounce: 0.44 }[kind] ?? 0.66;
    const Kp = dir.clone().multiplyScalar(depth / Math.max(0.3, -dir.z));
    if (kind === 'bounce') { Kp.y += 0.05; Kp.x += sgn * 0.04; }
    if (kind === 'follow') Kp.x -= sgn * 0.06;
    const sh = V(sgn * 0.2, -0.3, 0.05);
    const f = Kp.clone().sub(sh).normalize();
    const up = V(kind === 'hard' || kind === 'follow' ? sgn * -0.25 : 0, 1, 0.1);
    const b = up.addScaledVector(f, -up.dot(f)).normalize();
    const p = Kp.clone().addScaledVector(f, -0.085);
    const e = sh.clone().lerp(Kp, 0.42).add(V(sgn * 0.08, -0.14, 0.06));
    return { frame: 'cam', p: [p.x, p.y, p.z], f: [f.x, f.y, f.z], b: [b.x, b.y, b.z], F: this.hands.poses.guardR.F, e: [e.x, e.y, e.z] };
  }
}

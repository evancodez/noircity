import * as THREE from 'three';
import { buildProp } from '../props/index.js';
import { BR_ATTACKS, OPENS } from '../cast/brawl/clips.js';
import { think, steer, mannerOf, MANNERS } from '../cast/brawl/brain.js';
import { FightCards } from '../ui/fightCards.js';
import { Lesson } from './BrawlLesson.js';

// The fist fight's rules, the arcade pass (docs/story/FIGHT.md version 3:
// fast, light, readable, fair). A rules engine over clips and their marks:
// every time of a blow comes from its clip (hands.clip(name).marks for
// mine, c.clip(name).marks and BR_ATTACKS for his).
//   game.brawl.start({ opponent, manner, room, rng, lesson, retry, ... })
//   game.brawl.stop()   .active  .finished  .manner  .round  .me  .him  .stats
//
// MY SIDE (§1, §2). Each mouse button is an arm. A press throws that arm's
// jab AT ONCE (contact 0.06 s later); held on, the fist comes back into the
// wind-up, and letting go throws the hard punch (0.08 s after the release;
// its power by the hold: 0 at 0.15 s, 1 at 0.6 s). The other hand may start
// 0.10 s after a jab's contact. A / D hop 0.55 m aside, S hops 0.6 m back
// (0.10 s; held on I keep circling / backing away); W walks in; SPACE held
// blocks; E takes the thing I look at. Every input is taken on the step it
// arrives (inputStep runs in Game.pre, before the hands pose), and one that
// arrives while I cannot act yet is kept for 0.15 s.
//
// HIS GUARD (§3) has two sides, named by MY SCREEN: 'L' is his right side
// (my left fist's target), 'R' his left. A side is down while its hand
// swings, after a blow of his misses me, while he breathes (a hand lowered
// between blows), while he is stunned or out on his feet. A punch into a
// side that is up is blocked: a dull knock, a puff of grey at his forearm,
// my fist bounces back, no damage, no hit stop. Into a side that is down it
// lands. A blow that lands in his tell is a counter; hits within 0.5 s chain
// into a combo; three hard punches blocked in 4 s break his guard.
//
// HIS BLOWS (§4) hit a place, not a man. When the tell starts he picks the
// place (where I stand, led by the way I am walking) and winds up at it; the
// blow sweeps its path there (BR_ATTACKS.path); if at contact I stand
// outside the path, it misses and he is open. A hop is a dodge: once I have
// stepped out, nothing drags me back in. (FIGHT.md says he aims at the END
// of the tell; played that way, a hop made on seeing the tell was followed
// and hit - the very thing the user complained of - so the aim is fixed at
// the tell's start and led by my walk, never by my hop. See the report.)
//
// THE ROOM (§7): as round 2 (knocks into the stools, the counter, the
// jukebox, the pie case, a table; the weapon rack; his arming himself; the
// finish out through the nearer window at 12).
export const BRAWL = {
  himHp: 100, meHp: 100, retryHp: 60,
  manners: { measured: 100, dirty: 65, wild: 30, out: 12 },
  order: ['measured', 'dirty', 'wild', 'out'],
  reach: 1.8, cone: 38 * Math.PI / 180, itemReach: 2.0,
  // mine (§2)
  hold: { min: 0.15, full: 0.6 }, buffer: 0.15, other: 0.10,
  hop: { side: 0.55, back: 0.6, dur: 0.10, punchAt: 0.12, again: 0.25, blockAt: 0.08 },
  mine: { jab: 3, hardMin: 7, hardMax: 15 },
  items: { bottle: 16, neck: 10, plate: 8, mug: 8, stool: 22, chair: 22 },
  counter: 1.5, missOpen: 1.5, combo: [1, 1, 1.2, 1.4, 1.4], comboGap: 0.5,
  stun: 1.2, guardBreak: { n: 3, within: 4, open: 1.0 }, coverUp: 0.9,
  // his answer to a punch into his guard (a masher is answered)
  answer: 0.45,
  knock: [0.6, 1.5], comboKnock: 0.35,
  hitStop: { hard: 4, jab: 2 }, slowmo: { k: 0.35, dur: 0.8 },
  // the view on a landed blow (§5.5): a kick and a push-in of the lens
  kick: { hard: [1.5, 2.0], jab: [0.75, 1.0], dur: 0.1 },
  // the burst (§5.3) at 1440 x 900: 90 px for a jab to 220 for a full hard one
  burst: { jab: 90, hard: [150, 220] },
  tick: 0.15,
  down: 1.5, stageAt: 0.4,
  comeRound: 6, comeRoundHp: 20,
  grab: { counter: 1.5, floor: 1.2, stools: 4, preferCounter: 0.25 },
  dmgK: { measured: 1, dirty: 1, wild: 1, out: 1 },
  tough: 0.7,
};
const freshStats = () => ({ landed: 0, taken: 0, blocked: 0, slipped: 0, dodged: 0, wrongSlips: 0, myBlocked: 0, counters: 0, combos: 0, breaks: 0, throws: 0, downs: 0, time: 0, jabs: 0, hards: 0, grabs: 0, his: 0, knocks: 0, into: [], manners: {}, hisItems: [], clips: {}, input: [] });
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const OTHER = { L: 'R', R: 'L' };
// (a jab or a shove, a hook or a body shot stop for a counter; a haymaker,
// a rush and a stool do not stop for a jab; a hard punch stops anything)
const STOPS = /^br_(jab|jabR|cross|hook|hookL|body|bodyL|shove|bottle_thrust|throw)$/;

export class Brawl {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.finished = false;
    this.stats = freshStats();
    this.blackT = 0;
    this.did = {};
  }

  get hands() { return this.game.player.hands; }
  get controller() { return this.game.controller; }
  get cards() { return this._cards || (this._cards = new FightCards(this.game.hud)); }
  get round() { return this.him ? BRAWL.order.indexOf(this.him.manner) + 1 : 0; }

  // ---- start / stop ---------------------------------------------------------------------
  start({ opponent, manner = 'measured', hp = null, room = {}, rng, lesson = false, retry = false, myHp = null, onRetry = null, onKO = null, onGlass = null, onLanded = null, onManner = null, onBottle = null }) {
    const G = this.game;
    this.active = true;
    this.finished = false;
    this.done = false;
    this.fadeBack = 0;
    if (!retry) { this.stats = freshStats(); this.blackT = 0; this.did = {}; }
    this.opts = { onRetry, onKO, onGlass, onLanded, onManner, onBottle };
    this.room = room;
    // (the fight stays in the room: the controller keeps my eye inside its walls)
    G.controller.brawlBounds = room.bounds || null;
    // (the room's pieces: a disc on its rim lies down, and a rolling one
    // bounces off the walls - Breakables' PieceField)
    if (G.stage.breakables) G.stage.breakables.rimFix = true;
    this.rng = rng;
    this.c = opponent;
    const h0 = hp ?? BRAWL.manners[manner];
    this.him = {
      hp: h0, manner: mannerOf(h0), state: 'move', clip: null, h: null, t: 0,
      next: 1.0, circle: 1, circleT: 1, backT: 0, vel: V(0, 0, 0), speed: 0, yawRate: 0,
      holding: null, prop: null, task: null, pending: null, want: null, spot: null, atSpot: false, quietT: 0, loco: null, locoT: 0,
      hadBottle: false, hadStool: false, throws: 0,
      // the guard (§3): each side's time left down, by cause
      open: { L: 0, R: 0 }, missT: 0, coverT: 0, breatheT: 0, hang: null, hangT: 0, taunt: null, wasOpen: { L: false, R: false },
      aim: null, strikeAt: 0, hit: false, blockedHards: [], combo: 0, lastHitT: -9, ov: null,
    };
    opponent.hp = h0;
    this.me = { act: 'idle', arm: null, t: 0, holdT: 0, btn: null, power: 0, h: null, stun: 0, holding: null, stools: 0, buf: null, hopT: 9, hopDir: null, lastHop: -9 };
    if (myHp != null) G.health.hp = myHp;
    this.T = 0;
    this.timers = [];
    this.lessonHold = false; this.lessonBack = false; this.holdStill = false;
    this.lesson = lesson && !retry ? new Lesson(this, typeof lesson === 'number' ? lesson : 1) : null;
    opponent.setState('br_guard', 0.3);
    opponent.noGlance = true;
    opponent._look = null;
    opponent.lookAt(G.eye);
    this.hands.equip('fists');
    this.hands.play('guard');
    G.emit('brawl:round', { n: this.round, manner: this.him.manner });
    this.stats.manners[this.him.manner] = this.stats.manners[this.him.manner] ?? this.stats.time;
    this.cards.health(this.him.hp / 100, 'MACK', true);
    if (this.him.manner === 'out') this.startReel();
    return this;
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    this.lesson = null;
    const C = this.controller;
    C.slip = 0;
    C.brawlBounds = null;
    if (C.brawlMove) { C.brawlMove.f = 0; C.brawlMove.s = 0; }
    C.brawlHop = null;
    // (whatever is in my hand falls where I stand - it never just vanishes)
    if (this.me && this.me.holding) this.dropMine();
    if (this._cards) { this._cards.clear(); this._cards.health(null); }
    this.game.hud.clearPrompt('brawl');
  }

  later(s, fn) { this.timers.push({ at: this.T + s, fn }); }

  // ---- per step: my input (Game.pre, before the hands pose: an input acts
  // on the step it arrives) ------------------------------------------------------------------
  inputStep(dt) {
    if (!this.active || this.blackT > 0) return;
    const me = this.me;
    if (me.act === 'down' || this.finished) { this.moveKeys(false); return; }
    me.t += dt;
    this.input(dt);
  }

  // ---- per step (Game.post) ----------------------------------------------------------------
  update(dt) {
    if (!this.active) return;
    const G = this.game;
    this.T += dt;
    for (const x of [...this.timers]) if (this.T >= x.at) { this.timers.splice(this.timers.indexOf(x), 1); x.fn(); }
    this.stats.time += dt;
    G.health.sinceHit = 0;
    if (this._cards) { this._cards.tick(dt); this._cards.health(this.him.hp / 100, 'MACK'); }
    if (this.blackT > 0) {
      this.blackT -= dt;
      G.hud.fade(1);
      if (this.blackT <= 0) { this.blackT = 0; this.fadeBack = 0.6; }
      return;
    }
    if (this.fadeBack > 0) { this.fadeBack -= dt; G.hud.fade(Math.max(0, this.fadeBack / 0.6)); }
    if (this.me.act === 'down') { this.stepDown(dt); return; }
    this.stepMe(dt);
    this.stepHim(dt);
    if (this.lesson) this.lesson.update(dt);
    this.drawCharge();
    this.drawTicks();
    this.bumps();
  }

  // ---- my side --------------------------------------------------------------------------------
  // what I may start now: 'punch' (with `arm`), 'hop', 'block', 'grab'
  can(what, arm = null) {
    const me = this.me, a = me.act, t = me.t;
    if (a === 'idle') return true;
    if (a === 'hurt' || a === 'stagger' || a === 'down' || a === 'grab') return false;
    if (a === 'block') return what === 'hop';
    if (a === 'hop') return what === 'punch' ? t >= BRAWL.hop.punchAt : what === 'block' ? t >= BRAWL.hop.blockAt : what === 'hop' ? this.T - me.lastHop >= BRAWL.hop.again && t >= BRAWL.hop.dur : false;
    if (a === 'jab') {
      // (the other hand 0.10 after contact: five jabs a second, L R L R; the
      // same hand when this one is home)
      const contact = 0.06;
      if (what === 'punch') return arm !== me.arm ? t >= contact + BRAWL.other : false;
      return t >= contact;
    }
    if (a === 'wind') return what === 'hop' || what === 'block';
    if (a === 'hard') return what === 'punch' ? t >= 0.2 && arm !== me.arm : t >= 0.18;
    // (a fist bounced off his guard: the beat is wasted - no punch for 0.45 s)
    if (a === 'bounce') return what === 'hop' || what === 'block' ? t >= 0.2 : what === 'punch' ? t >= 0.45 : false;
    if (a === 'strike') return what === 'hop' ? me.h && me.h.t >= 0.2 : false;
    return false;
  }

  moveKeys(on) {
    const M = this.controller.brawlMove || (this.controller.brawlMove = { f: 0, s: 0 });
    if (!on) { M.f = 0; M.s = 0; }
  }

  input(dt) {
    const G = this.game, me = this.me, H = this.hands, C = this.controller;
    const M = C.brawlMove || (C.brawlMove = { f: 0, s: 0 });
    const locked = me.act === 'hurt' || me.act === 'stagger';
    // ---- walking: W in; A / D / S held on after a hop keep circling / backing
    const hopping = C.brawlHop && C.brawlHop.t < C.brawlHop.dur;
    M.f = locked || hopping ? 0 : (G.held('KeyW') ? 1 : 0) - (G.held('KeyS') && me.lastHopKey === 'KeyS' && this.T - me.lastHop > 0.12 ? 1 : 0);
    const circle = (k) => G.held(k) && me.lastHopKey === k && this.T - me.lastHop > 0.12;
    M.s = locked || hopping ? 0 : (circle('KeyD') ? 1 : 0) - (circle('KeyA') ? 1 : 0);
    if (me.act === 'wind' || me.act === 'block') { M.f *= 0.5; M.s *= 0.5; }
    if (Math.abs(M.f) + Math.abs(M.s) > 0) { me.moved = (me.moved || 0) + dt * 1.9; this.did.move = me.moved > 1; }
    // ---- the presses of this step (the newest kept 0.15 s if it cannot act yet)
    for (const code of ['Mouse0', 'Mouse2', 'KeyA', 'KeyD', 'KeyS', 'KeyE']) {
      if (G.pressed(code)) { me.buf = { code, t: 0, at: this.T }; this.stats.input.length < 400 && this.stats.input.push([+this.T.toFixed(3), code, me.act]); }
    }
    if (me.buf) { if (me.buf.t > BRAWL.buffer) me.buf = null; else me.buf.t += dt; }
    // ---- a hard punch let go / a wind-up that grows
    if (me.act === 'jab' || me.act === 'wind' || (me.act === 'bounce' && me.btn)) {
      if (me.btn && G.held(me.btn)) me.holdT += dt;
      const held = me.btn && G.held(me.btn) && !G.released(me.btn);
      if ((me.act === 'jab' || (me.act === 'bounce' && me.t >= 0.1)) && held && me.holdT >= BRAWL.hold.min) {
        me.act = 'wind'; me.t = 0; me.itemCock = false;
        const it = me.holding && me.arm === 'R';
        me.h = H.play(it ? (me.holding.kind === 'stool' || me.holding.kind === 'chair' ? 'windBig' : 'windItem') : me.arm === 'L' ? 'windL' : 'windR');
        this.sfx('wind', null, {});
      } else if (me.act === 'wind') {
        if (me.h && me.h.t > 1.08) me.h.t = 0.48;   // (the tremble, round again)
        if (!held) {
          const k = Math.max(0, Math.min(1, (me.holdT - BRAWL.hold.min) / (BRAWL.hold.full - BRAWL.hold.min)));
          if (me.holding && me.arm === 'R') this.strike(true, k); else this.hard(me.arm, k);
          return;
        }
      } else if (me.itemCock && !held) {
        // (a click with a thing in the hand: it strikes as the button comes up)
        me.itemCock = false;
        this.strike(false, 0);
        return;
      }
    }
    if (locked) return;
    // ---- SPACE held: the block (up in 0.05, down in 0.08)
    const space = G.held('Space');
    if (space && me.act !== 'block' && this.can('block')) { this.block(true); return; }
    if (!space && me.act === 'block') this.block(false);
    // ---- what the press asks for
    const b = me.buf;
    if (!b) return;
    const code = b.code;
    if (code === 'KeyA' || code === 'KeyD' || code === 'KeyS') {
      if (this.can('hop')) { me.buf = null; this.hop(code); }
      return;
    }
    if (code === 'KeyE') {
      if (me.act === 'idle' && !me.holding) { me.buf = null; const it = this.reachable(); if (it) this.grab(it); }
      return;
    }
    const arm = code === 'Mouse0' ? 'L' : 'R';
    if (!this.can('punch', arm)) return;
    me.buf = null;
    if (me.holding && arm === 'R') {
      // (a thing in the hand: it is drawn back at once; a click strikes with
      // it as the button comes up, a hold winds it)
      me.act = 'jab'; me.arm = 'R'; me.btn = code; me.t = 0; me.holdT = b.t; me.itemCock = true;
      me.h = H.play(me.holding.kind === 'stool' || me.holding.kind === 'chair' ? 'windBig' : 'windItem');
      if (!G.held(code)) { me.itemCock = false; this.strike(false, 0); }
      return;
    }
    this.jab(arm, code, b.t);
  }

  cancelArm() { const me = this.me; if (me.act === 'wind' || me.act === 'jab') { me.act = 'idle'; me.arm = null; me.itemCock = false; } }

  block(on) {
    const me = this.me;
    if (on) { this.cancelArm(); me.act = 'block'; me.t = 0; me.h = this.hands.play('block'); this.did.blockUp = true; }
    else { me.act = 'idle'; me.t = 0; me.h = this.hands.play('guard'); }
  }

  // a hop: 0.55 m aside (A / D) or 0.6 m back (S) in 0.10 s
  hop(code) {
    const me = this.me, C = this.controller, H = BRAWL.hop;
    const wasBlock = me.act === 'block';
    this.cancelArm();
    const fy = C.faceYaw ?? C.yaw;
    const fx = -Math.sin(fy), fz = -Math.cos(fy), rx = Math.cos(fy), rz = -Math.sin(fy);
    let dx, dz, dist, clip;
    if (code === 'KeyS') { dx = -fx; dz = -fz; dist = H.back; clip = 'hopB'; }
    else { const s = code === 'KeyD' ? 1 : -1; dx = rx * s; dz = rz * s; dist = H.side; clip = s > 0 ? 'hopR' : 'hopL'; }
    C.brawlHop = { x: dx, z: dz, dist, dur: H.dur, t: 0, done: 0 };
    me.act = 'hop'; me.t = 0; me.lastHop = this.T; me.lastHopKey = code; me.hopDir = code;
    me.h = this.hands.play(clip);
    this.sfx('scuff', null, { k: 0.8 });
    this.did[code === 'KeyS' ? 'hopB' : code === 'KeyD' ? 'hopR' : 'hopL'] = true;
    void wasBlock;
  }

  jab(arm, code, already = 0) {
    const me = this.me;
    me.act = 'jab'; me.arm = arm; me.btn = code; me.t = 0; me.holdT = already; me.itemCock = false;
    me.h = this.hands.play(arm === 'L' ? 'jabL' : 'jabR', { onMark: { contact: () => this.myContact('jab', arm, 0) } });
    this.stats.jabs++;
  }
  hard(arm, k) {
    const me = this.me;
    me.act = 'hard'; me.arm = arm; me.power = k; me.t = 0; me.btn = null;
    me.h = this.hands.play(arm === 'L' ? 'hardL' : 'hardR', { onMark: { contact: () => this.myContact('hard', arm, k) } });
    this.stats.hards++;
    this.sfx('whiff', null, { k: 0.4 + 0.5 * k });
  }
  // with something in the right hand: a click strikes; a wind-up smashes it
  // (a stool, a chair) or throws it (a bottle, a plate, a mug)
  strike(wound, k) {
    const me = this.me, it = me.holding, H = this.hands;
    me.itemCock = false;
    if (!it) { me.act = 'idle'; return; }
    me.act = 'strike'; me.arm = 'R'; me.power = wound ? k : 0.5; me.t = 0;
    const big = it.kind === 'stool' || it.kind === 'chair';
    if (wound && !big) {
      me.h = H.play('throwItem', { onMark: { release: () => this.throwHeld(k) } });
      return;
    }
    const clip = big ? (wound ? 'swingBig' : 'swingStool') : it.kind === 'plate' ? 'swingPlate' : wound ? 'smashItem' : 'swingBottle';
    me.h = H.play(clip, { onMark: { contact: () => this.myContact('item', 'R', wound ? Math.max(0.5, k) : 0.5) } });
    this.sfx('whiff', null, { k: big ? 1 : 0.7 });
  }

  grab(it) {
    const me = this.me, H = this.hands;
    me.act = 'grab'; me.t = 0;
    me.h = H.play('grab', { onMark: { taken: () => {
      const o = it.take ? it.take() : it.object;
      if (!o) return;
      if (it.kind === 'stool') me.stools++;
      me.holding = { kind: it.kind, object: o, name: it.name, uses: it.kind === 'neck' ? 2 : 1 };
      H.hold(o, 'R');
      this.sfx('grab_' + (it.kind === 'chair' ? 'stool' : it.kind === 'mug' ? 'plate' : it.kind), null, {});
      this.did.grab = true;
    } } });
    this.stats.grabs++;
  }

  stepMe(dt) {
    const me = this.me, H = this.hands;
    if (me.act === 'stagger' || me.act === 'hurt') {
      me.stun -= dt;
      if (me.stun <= 0) { me.act = 'idle'; me.t = 0; me.h = H.play('guard'); }
      return;
    }
    if (me.act === 'hop' && me.t >= BRAWL.hop.dur + 0.05 && (!me.h || me.h.done || me.h.t >= me.h.duration)) { me.act = 'idle'; me.t = 0; me.h = H.play('guard'); return; }
    if ((me.act === 'jab' || me.act === 'hard' || me.act === 'bounce' || me.act === 'grab' || me.act === 'strike') && !me.itemCock && (!me.h || me.h.done || me.h.t >= me.h.duration)) {
      // (a jab whose button is still held becomes the wind-up in input())
      if (me.act === 'jab' && me.btn && this.game.held(me.btn)) return;
      me.act = 'idle'; me.arm = null; me.t = 0;
      me.h = H.play('guard');
    }
  }

  // is my blow on him? within reach and within the cone of where I look
  onTarget(reach = BRAWL.reach) {
    const G = this.game, c = this.c, C = this.controller;
    const head = _a.setFromMatrixPosition(c.bones.chest.matrixWorld);
    const dx = head.x - G.eye.x, dz = head.z - G.eye.z, d = Math.hypot(dx, dz);
    const dr = Math.hypot(c.pos.x - G.eye.x, c.pos.z - G.eye.z);
    const look = Math.atan2(-Math.sin(C.yaw), -Math.cos(C.yaw));
    const ang = Math.abs(wrap(Math.atan2(dx, dz) - look));
    return { ok: Math.min(d, dr) <= reach && ang <= BRAWL.cone, d: Math.min(d, dr), ang };
  }

  // ---- his guard (§3) ---------------------------------------------------------------------
  // is that side of him (my screen's 'L' | 'R') down right now?
  sideOpen(s) {
    const him = this.him;
    if (!him) return false;
    if (him.state === 'stun' || him.state === 'reel' || him.state === 'arm' || him.state === 'comeRound') return true;
    if (him.coverT > 0) return false;
    if (him.open[s] > 0) return true;
    // (the lesson: he holds a hand down and waits)
    if (him.taunt && him.state === 'move' && him.taunt.includes(s)) return true;
    if (him.state === 'attack') {
      if (him.clip === 'br_bottle') return true;
      // (the hand that swings has left its guard - through the tell and the
      // strike; a blow that FOUND me, he recovers behind his guard: trading
      // blows with him is not how he is beaten; a blow that missed leaves
      // him open by the miss table instead)
      if (him.contactAt != null && him.t > him.contactAt + 0.04 && him.hit) return false;
      return OPENS(BR_ATTACKS[him.clip]).includes(s);
    }
    return false;
  }
  openSides() { return (this.sideOpen('L') ? 'L' : '') + (this.sideOpen('R') ? 'R' : ''); }
  // a side down for s seconds (the longer of what it had and s)
  lower(sides, s, why = null) { const h = this.him; h.why = h.why || {}; for (const x of sides) { if (why && s > h.open[x]) h.why[x] = why; h.open[x] = Math.max(h.open[x], s); } }

  // where a blow of mine ends, as the eye sees him (Hands evaluates it once
  // when the blow starts): the knuckles on the ray from my eye to his jaw
  // on that side, at arm's length - so the fist is drawn ON him and grows
  // smaller as it goes out. Out of reach or out of sight, straight ahead.
  fistPose(side, kind = 'jab', k = 1) {
    const G = this.game, c = this.c, cam = G.camera;
    if (!c || !c.bones || !c.bones.head) return null;
    cam.updateMatrixWorld();
    const sgn = side === 'L' ? -1 : 1;
    // his jaw on that side (a hard one a little lower: the jaw and the neck)
    const head = _a.setFromMatrixPosition(c.bones.head.matrixWorld);
    const right = _b.set(1, 0, 0).applyQuaternion(cam.quaternion).setY(0).normalize();
    const T = _c.copy(head).addScaledVector(right, sgn * 0.075);
    T.y -= kind === 'hard' || kind === 'follow' ? 0.1 : 0.06;
    const tc = T.applyMatrix4(cam.matrixWorldInverse);
    const tgt = this.onTarget(BRAWL.reach + 0.15);
    let dir;
    if (tgt.ok && tc.z < -0.3) dir = tc.clone().normalize();
    else dir = V(sgn * 0.035, -0.07, -1).normalize();
    // the knuckles at arm's length along it (a jab 0.66 deep, a hard punch
    // 0.70); a fist that meets his guard stops 0.05 short; bouncing, it comes
    // back 0.12 and up
    const depth = { jab: 0.66, hard: 0.7, follow: 0.74, block: 0.6, bounce: 0.5 }[kind] ?? 0.66;
    const K = dir.clone().multiplyScalar(depth / Math.max(0.3, -dir.z));
    if (kind === 'bounce') { K.y += 0.03; K.x += sgn * 0.03; }
    if (kind === 'follow') K.x -= sgn * 0.06;
    const sh = V(sgn * 0.2, -0.3, 0.05);
    const f = K.clone().sub(sh).normalize();
    // (the fist turned over at contact: the back of the hand up, a hard one
    // rolled in a little)
    const up = V(kind === 'hard' || kind === 'follow' ? sgn * -0.25 : 0, 1, 0.1);
    const b = up.addScaledVector(f, -up.dot(f)).normalize();
    const p = K.clone().addScaledVector(f, -0.085);
    const e = sh.clone().lerp(K, 0.42).add(V(sgn * 0.08, -0.14, 0.06));
    const P = { frame: 'cam', p: [p.x, p.y, p.z], f: [f.x, f.y, f.z], b: [b.x, b.y, b.z], F: this.hands.poses.guardR.F, e: [e.x, e.y, e.z] };
    return P;
  }

  // my blow arrives
  myContact(kind, arm, k) {
    const G = this.game, him = this.him, c = this.c, me = this.me;
    if (!this.active || this.finished) return;
    const item = kind === 'item' ? me.holding : null;
    const tgt = this.onTarget(item ? BRAWL.itemReach : BRAWL.reach);
    const head = _a.setFromMatrixPosition(c.bones.head.matrixWorld).clone();
    const dir = _b.set(c.pos.x - G.eye.x, 0, c.pos.z - G.eye.z).normalize().clone();
    this.stats.input.length < 400 && this.stats.input.push([+this.T.toFixed(3), 'contact:' + kind + arm, tgt.ok ? this.openSides() : 'air']);
    if (!tgt.ok || him.state === 'ko') {
      // a miss: a whiff of air, nothing else
      this.sfx('whiff', null, { k: kind === 'jab' ? 0.5 : 0.9 });
      G.emit('brawl:hit', { by: 'me', kind, power: k, zone: 'air', arm });
      if (item) this.spendHeld(null, dir);
      return;
    }
    const L = this.lesson;
    // out on his feet: jabs make him sway; a hard punch of 0.5 or more is the last
    if (him.state === 'reel') {
      if ((kind === 'hard' || item) && k >= 0.5 && him.atSpot) { if (item) this.spendHeld(head, dir); this.ko(); return; }
      if (item) this.spendHeld(head, dir);
      him.quietT = 0;
      if (him.atSpot) { this.c.play('br_sway', { fade: 0.06 }); him.swayT = 0.8; }
      this.feel(kind === 'jab' ? 'jab' : 'hard', head, dir, kind === 'jab' ? 0 : k);
      this.sfx(kind === 'jab' ? 'jab' : 'heavy', head, { k: 0.5 });
      G.emit('brawl:hit', { by: 'me', kind, power: k, zone: 'head', arm });
      return;
    }
    const side = arm, openBefore = this.openSides();
    const big = item && (item.kind === 'stool' || item.kind === 'chair');
    const open = this.sideOpen(side) || big;
    if (!open) {
      // ---- into his guard: a dull knock, grey dust at the forearm, my fist
      // bounces back; no damage, no hit stop; the beat is wasted
      this.stats.myBlocked++;
      this.did['blocked' + (kind === 'hard' ? 'Hard' : '')] = true;
      if (L) L.onMyBlow(kind, arm, k, 'blocked');
      const at = head.clone().addScaledVector(dir, -0.22).add(V(0, -0.12, 0));
      this.sfx('blocked', at, { k: kind === 'jab' ? 0.7 : 1 });
      G.fx.hit.puff(at, dir);
      G.emit('brawl:hit', { by: 'me', kind, power: k, zone: 'guard', arm });
      if (item) { this.spendHeld(head, dir); }
      else if (kind === 'jab' || kind === 'hard') { me.act = 'bounce'; me.t = 0; me.h = this.hands.play(arm === 'L' ? 'bounceL' : 'bounceR'); }
      // three hard ones in 4 s break it
      if (kind === 'hard') {
        him.blockedHards = him.blockedHards.filter((x) => this.T - x < BRAWL.guardBreak.within);
        him.blockedHards.push(this.T);
        if (him.blockedHards.length >= BRAWL.guardBreak.n) { this.breakGuard(); return; }
      }
      // (he answers a punch into his guard, now and then: a masher is answered)
      // (he answers a punch into his guard - at once, with the hand on the side
      // that was struck, more surely the more I pound it: a masher is answered)
      him.pounded = (him.pounded || []).filter((x) => this.T - x < 1.5); him.pounded.push(this.T);
      if (!this.lessonHold && him.state === 'move' && this.rng.chance(Math.min(0.9, BRAWL.answer + 0.2 * (him.pounded.length - 1)))) { him.next = Math.min(him.next, 0.05); him.answer = side === 'L' ? 'br_jabR' : 'br_jab'; }
      return;
    }
    // ---- it lands
    const M = BRAWL.mine;
    let dmg;
    if (kind === 'jab') dmg = M.jab;
    else if (kind === 'hard') dmg = M.hardMin + (M.hardMax - M.hardMin) * k;
    else dmg = BRAWL.items[item.kind] ?? 8;
    const inTell = him.state === 'attack' && him.clip && him.t < him.strikeAt;
    const counter = inTell && !/^br_feint/.test(him.clip);
    const stops = counter && (kind !== 'jab' || STOPS.test(him.clip));
    if (counter) { this.stats.counters++; this.did.counter = true; }
    // (a counter and a man open after a miss each count half again - one or
    // the other, not both at once: stacked with a combo they tripled a blow)
    // (the first blow into a man open after a miss: after it, the combo counts)
    const punish = him.missT > 0 && !him.punished;
    if (him.missT > 0) him.punished = true;
    if (counter || punish) dmg *= Math.max(counter ? BRAWL.counter : 1, punish ? BRAWL.missOpen : 1);
    // the combo: each hit within 0.5 s of the last
    him.combo = this.T - him.lastHitT <= BRAWL.comboGap ? him.combo + 1 : 1;
    him.lastHitT = this.T;
    dmg *= BRAWL.combo[Math.min(BRAWL.combo.length - 1, him.combo)];
    if (him.combo >= 3) { this.stats.combos = Math.max(this.stats.combos, him.combo); this.did.combo3 = true; }
    this.damageHim(dmg);
    { const why = counter ? 'counter' : him.state === 'stun' || him.state === 'knock' ? 'stun' : him.state === 'attack' ? 'hisSwing' : (him.why && him.why[side]) || (him.taunt ? 'lesson' : him.state); const D = this.stats.dmgBy || (this.stats.dmgBy = {}); D[why] = +((D[why] || 0) + dmg).toFixed(1); }
    this.stats.landed++;
    // (the side he was hit on stays open through the chain)
    if (him.combo < 3) this.lower(openBefore || side, BRAWL.comboGap * 0.8);
    if (kind === 'jab') this.did['jab' + arm] = true;
    if (kind === 'hard' && k >= 0.5) this.did.hard = true;
    if (L) L.onMyBlow(kind, arm, k, 'landed');
    G.emit('brawl:hit', { by: 'me', kind, power: k, zone: 'head', arm, counter, combo: him.combo });
    if (item) this.spendHeld(head, dir);
    const heavy = kind !== 'jab';
    this.feel(heavy ? 'hard' : 'jab', head, dir, heavy ? (item ? 0.8 : k) : 0);
    this.sfx(kind === 'jab' ? 'jab' : 'heavy', head, { k: heavy ? 0.6 + 0.4 * k : 0.55 });
    if (heavy) this.sfx('hisGrunt', head, { k: 0.7 + 0.3 * k });
    if (him.hp <= BRAWL.manners.out && him.state !== 'reel') { this.startReel(dir); return; }
    if (him.state === 'knock' || him.state === 'into') return;
    // (my left fist lands on his right: his head goes to his left)
    if (!heavy) {
      if (him.state === 'attack' && !stops) return;
      if (him.combo >= 4) { this.coverUp(); return; }
      if (him.combo === 3) { this.knock(dir, BRAWL.comboKnock, arm === 'L' ? 'br_snapR' : 'br_snapL'); return; }
      this.react(arm === 'L' ? 'br_hitHeadR' : 'br_hitHeadL');
      return;
    }
    // a hard one (or a thing) on an open side: bent, driven back, stunned
    const D = BRAWL.knock[0] + (BRAWL.knock[1] - BRAWL.knock[0]) * (item ? 0.6 : k);
    const stun = him.combo <= 2;
    if (stun) this.lower('LR', BRAWL.stun, 'stun'); else { him.open.L = him.open.R = 0; him.coverT = BRAWL.coverUp; him.combo = 0; }
    this.knock(dir, D, arm === 'L' ? 'br_snapR' : 'br_snapL', stun);
    if (big) this.did.stoolHit = true;
  }

  breakGuard() {
    const him = this.him;
    him.blockedHards = [];
    him.coverT = 0;
    this.lower('LR', BRAWL.guardBreak.open, 'break');
    this.stats.breaks++;
    this.did.guardBreak = true;
    this.sfx('guardBreak', null, {});
    this.react('br_hitBody');
    him.next = Math.max(him.next, BRAWL.guardBreak.open);
    this.game.emit('brawl:guardBreak', {});
  }

  // after the fourth in a chain he covers up and steps away
  coverUp() {
    const him = this.him;
    him.combo = 0; him.open.L = 0; him.open.R = 0;
    him.coverT = BRAWL.coverUp; him.backT = 1.0;
    this.react('br_hitBody');
    him.next = Math.max(him.next, 0.8);
  }

  // what I hold is spent on him: a bottle breaks to its neck (good for two
  // more), a neck is gone after two, a plate, a mug break; a stool or a chair
  // comes apart on him (its pieces fall, bounce and lie still)
  spendHeld(at, dir) {
    const me = this.me, G = this.game, H = this.hands;
    const it = me.holding;
    if (!it) return;
    const B = G.stage.breakables;
    const o = H.hold(null, 'R', { keep: true });
    const where = at ? at.clone().addScaledVector(dir, -0.25) : G.eye.clone().addScaledVector(dir, 1.1).setY(G.eye.y - 0.35);
    if (it.kind === 'bottle' && o) {
      // (broken on him: the neck stays in my fist)
      const g = new THREE.Group();
      g.position.copy(where); G.stage.scene.add(g); g.updateMatrixWorld(true);
      g.add(o); o.position.set(0, 0, 0); o.quaternion.identity(); o.scale.setScalar(1); o.updateMatrixWorld(true);
      const hnd = B.add(o, { kind: 'bottle', hp: 1, solid: false });
      B.hit(hnd, { point: where.clone(), dir: dir.clone(), power: 9, by: 'body', neck: true });
      const neck = g.children.find((x) => x.userData && x.userData.kind === 'bottleNeck');
      if (neck) { g.remove(neck); neck.visible = true; me.holding = { kind: 'neck', object: neck, uses: 2 }; H.hold(neck, 'R'); return; }
      me.holding = null;
      return;
    }
    if (it.kind === 'neck' && it.uses > 1) { it.uses--; H.hold(o, 'R'); return; }
    me.holding = null;
    if (o) this.breakInWorld(o, it.kind, where, dir);
  }

  // a wound-up throw: it flies where I look; on him within 6 m and the cone
  // it hits him (power by the wind-up), else it lands and breaks
  throwHeld(k) {
    const me = this.me, G = this.game, it = me.holding;
    if (!it) return;
    const tgt = this.onTarget(6);
    const C = this.controller;
    const look = V(-Math.sin(C.yaw), 0, -Math.cos(C.yaw));
    const c = this.c;
    const d = tgt.ok ? tgt.d : 4;
    const o = this.hands.hold(null, 'R', { keep: true });
    me.holding = null;
    if (!o) return;
    const from = G.eye.clone().addScaledVector(look, 0.4).add(V(0.15, -0.2, 0));
    G.stage.scene.add(o); o.position.copy(from); o.updateMatrixWorld(true);
    this.sfx('whiff', null, { k: 0.8 });
    const t0 = this.T, fly = Math.max(0.12, d / 11);
    const tick = () => {
      if (!this.active) { this.dropInWorld(o, it.kind, o.position.clone()); return; }
      const u = Math.min(1, (this.T - t0) / fly);
      const end = tgt.ok ? _a.setFromMatrixPosition(c.bones.head.matrixWorld) : _a.copy(G.eye).addScaledVector(look, d).setY(G.stage.surfaceY(G.eye.x + look.x * d, G.eye.z + look.z * d) + 0.1);
      o.position.lerpVectors(from, end, u); o.position.y += Math.sin(u * Math.PI) * 0.15;
      o.rotation.y += 0.2; o.rotation.x += 0.13; o.updateMatrixWorld(true);
      if (u < 1) { this.later(0, tick); return; }
      if (tgt.ok && this.him.state !== 'ko') {
        const head = end.clone();
        const dir = V(c.pos.x - G.eye.x, 0, c.pos.z - G.eye.z).normalize();
        this.breakInWorld(o, it.kind, head.addScaledVector(dir, -0.2), dir);
        const open = this.openSides();
        if (!open && this.him.state === 'move') { this.sfx('blocked', head, { k: 1 }); return; }   // (his guard stops a bottle or a plate)
        const dmg = (BRAWL.items[it.kind] ?? 8) * (0.7 + 0.5 * k) * (this.him.missT > 0 ? BRAWL.missOpen : 1);
        this.damageHim(dmg);
        this.stats.landed++;
        this.feel('hard', head, dir, 0.6);
        this.sfx('heavy', head, { k: 0.8 });
        if (this.him.state === 'reel' && k >= 0.5 && this.him.atSpot) { this.ko(); return; }
        if (this.him.hp <= BRAWL.manners.out && this.him.state !== 'reel') { this.startReel(); return; }
        if (this.him.state === 'move' || this.him.state === 'attack' || this.him.state === 'arm') this.react('br_hitBody');
      } else this.breakInWorld(o, it.kind, end.clone(), look);
    };
    this.later(0, tick);
  }

  // a thing out of a hand, broken where it is (in the world). A thing taken
  // off the floor or the counter was taken OUT of the room's breakables
  // (its handle marked broken), so a hit on it did nothing and it hung in
  // the air where it was let go: the user's floating stool. It is broken
  // outright here (breakIt, whatever its handle says): its pieces fall.
  breakInWorld(o, kind, at, dir) {
    const G = this.game;
    if (kind === 'neck') { this.dropInWorld(o, 'neck', at, dir, 1.2); return; }
    G.stage.scene.add(o);
    o.position.copy(at); o.quaternion.identity(); o.scale.setScalar(1);
    o.visible = true;
    o.updateMatrixWorld(true);
    const B = G.stage.breakables;
    const k = kind === 'chair' ? 'stool' : kind;
    let h = B.handle(o);
    if (!h) h = B.add(o, { kind: k, hp: 1, solid: false });
    const kind0 = h.kind;
    h.kind = k;
    B.breakIt(h, { point: at.clone(), dir: dir.clone(), by: 'body' });
    h.kind = kind0;
  }

  // a thing let go without breaking (the neck, a thing dropped when I am hit,
  // when the fight stops): it falls under gravity and comes to rest
  dropInWorld(o, kind, at = null, dir = null, speed = 0.6) {
    const G = this.game;
    if (!o) return;
    const w = at || o.getWorldPosition(V(0, 0, 0));
    const q = o.getWorldQuaternion(new THREE.Quaternion());
    if (o.parent) o.parent.remove(o);
    o.position.copy(w); o.quaternion.copy(q); o.scale.setScalar(1);
    o.visible = true;
    const B = G.stage.breakables;
    const d = dir || V(0, 0, 0);
    const r = this.rng;
    B.field.add(o, V(d.x * speed + r.gauss() * 0.3, 0.6, d.z * speed + r.gauss() * 0.3), V(r.gauss() * 3, r.gauss() * 3, r.gauss() * 3), { owner: B.handle(o) || null, kind });
  }

  // what is in my hand, let go (hit hard, knocked down, the fight over)
  dropMine() {
    const me = this.me;
    if (!me.holding) return;
    const it = me.holding;
    me.holding = null;
    const o = this.hands.held.R;
    if (!o) return;
    this.hands.vm.root.updateMatrixWorld(true);
    o.updateMatrixWorld(true);
    const at = o.getWorldPosition(V(0, 0, 0));
    const q = o.getWorldQuaternion(new THREE.Quaternion());
    this.hands.hold(null, 'R', { keep: true });
    o.quaternion.copy(q);
    this.dropInWorld(o, it.kind, at, null, 0.2);
  }

  // the hit feel (§5): the hit stop, the view's kick and push-in, the white
  // ink burst sized in pixels (90 for a jab .. 220 for a full hard one)
  feel(kind, head, dir, k) {
    const G = this.game;
    G.hitStop = Math.max(G.hitStop || 0, kind === 'jab' ? BRAWL.hitStop.jab : BRAWL.hitStop.hard);
    const K = kind === 'jab' ? BRAWL.kick.jab : BRAWL.kick.hard;
    if (this.controller.kick) this.controller.kick(K[0], K[1] * (kind === 'jab' ? 1 : 0.6 + 0.4 * k), BRAWL.kick.dur);
    const px = kind === 'jab' ? BRAWL.burst.jab : BRAWL.burst.hard[0] + (BRAWL.burst.hard[1] - BRAWL.burst.hard[0]) * k;
    // (at the point of contact as the eye sees it: on the ray to his jaw, at
    // the fist's depth, drawn in the hands' pass over the fist that lands)
    const jaw = head.clone().addScaledVector(dir, -0.1);
    const ray = jaw.clone().sub(G.eye).normalize();
    const at = G.eye.clone().addScaledVector(ray, Math.max(0.5, G.eye.distanceTo(jaw) - 0.18));
    // (the burst is inked on the frame over the fist - the flash sprites
    // printed as a few soft dots behind his head; the sweat flies in the room)
    G.fx.hit.punch(at, dir.clone(), kind === 'jab' ? 0.3 : 0.5 + 0.5 * k, { px, camera: G.camera, from: jaw, noBurst: true });
    const sp = G.screenOf(jaw);
    if (sp) this.cards.burst(sp, px, this.stats.landed + 1);
  }

  damageHim(n) {
    const him = this.him;
    // (tuned by play: every blow of mine counts BRAWL.tough of the table's
    // number - the table's own ratios stand; at 1 a first-timer's fight ran
    // 25 .. 55 s after the lesson, short of FIGHT.md's 60 .. 100 all told)
    n *= BRAWL.tough;
    him.hp = Math.max(this.lesson ? 70 : 0, him.hp - n);
    this.c.hp = him.hp;
    him.quietT = 0;
    const m = mannerOf(him.hp);
    if (m !== him.manner && m !== 'out') this.setManner(m);
  }

  setManner(m) {
    const him = this.him, G = this.game, c = this.c;
    him.manner = m;
    this.stats.manners[m] = this.stats.manners[m] ?? this.stats.time;
    G.emit('brawl:round', { n: this.round, manner: m });
    him.next = Math.max(him.next, 0.8);
    if (m === 'wild') {
      G.fx.hit.punch(c.bones.head.getWorldPosition(V(0, 0, 0)), V(0, -0.3, 1), 0.9, { px: 120, camera: G.camera });
      if (c.bleed) c.bleed(1);
      c.capLoose = true;
      him.hang = this.rng.chance(0.5) ? 'L' : 'R';
    }
    if (this.opts.onManner) this.opts.onManner(m, him);
  }

  react(clip) {
    const him = this.him;
    if (him.holding === 'stool' && him.prop) this.dropHisProp();
    this.hisState('react', clip, him.state === 'attack' || him.state === 'arm' ? 0.08 : 0.05);
    him.next = Math.min(Math.max(him.next, 0.35), 0.8);
    if (him.task) him.task = null;
  }

  hisState(state, clip, fade = 0.1, onMark = {}) {
    const him = this.him;
    him.state = state; him.clip = clip; him.t = 0; him.loco = null; him.ov = null;
    him.h = this.c.play(clip, { fade, onMark });
    return him.h;
  }

  // knocked back along the line of the blow (the head snapped by `snap`);
  // whatever stands behind him takes him; `stun`: then he sways, arms loose
  knock(dir, D, snap = null, stun = false) {
    const him = this.him, c = this.c, F = c.fig;
    if (him.holding === 'stool' && him.prop) this.dropHisProp();
    him.task = null;
    const hit = this.sweep(dir, D);
    const d0 = hit ? Math.max(0.12, hit.s - 0.08) : D;
    // (the head snapped away from the blow in the stagger's first frames:
    // br_knockL / R; `snap` names the side as the jab's reactions do)
    const clip = snap === 'br_snapR' ? 'br_knockR' : snap === 'br_snapL' ? 'br_knockL' : 'br_knock';
    this.hisState('knock', clip, 0.05, { stop: () => { if (hit) this.into(hit, dir); } });
    F.startRoot(c.animName, { scale: d0 / (1.0 * F.scale) });
    if (F._rmClip) F._rmClip.yaw0 = Math.atan2(-dir.x, -dir.z);
    him.stunAfter = stun;
    him.snap = snap;
    this.stats.knocks++;
    him.next = Math.max(him.next, stun ? BRAWL.stun : 0.6);
    this.game.emit('brawl:knock', { d: d0, into: hit ? hit.what : null });
  }

  // what stands behind him along dir within D: { s, what, obj }
  sweep(dir, D) {
    const c = this.c, R = this.room, S = this.game.stage;
    const r = (c.fig.collider ? c.fig.collider.r : 0.35);
    const Cl = S.colliders;
    for (let s = 0.08; s <= D + 0.001; s += 0.04) {
      const x = c.pos.x + dir.x * s, z = c.pos.z + dir.z * s;
      if (R.stools) for (const st of R.stools) {
        if (st.handle.toppled || st.handle.broken || st.taken) continue;
        if (Math.hypot(st.pos.x - x, st.pos.z - z) < 0.2 + r * 0.8) return { s, what: 'stools', obj: st };
      }
      if (R.cafe) for (const t of R.cafe) {
        if (!t.handle.toppled && !t.handle.broken && Math.hypot(t.pos.x - x, t.pos.z - z) < 0.31 + r * 0.8) return { s, what: 'table', obj: t };
        for (const ch of t.chairs) if (!ch.handle.toppled && !ch.handle.broken && !ch.taken && Math.hypot(ch.pos.x - x, ch.pos.z - z) < 0.2 + r * 0.8) return { s, what: 'chair', obj: ch };
      }
      for (const b of Cl.boxes) {
        const tag = b.tag || 'wall';
        const lx = (x - b.cx) * b.c - (z - b.cz) * b.s, lz = (x - b.cx) * b.s + (z - b.cz) * b.c;
        const qx = Math.max(-b.hx, Math.min(b.hx, lx)), qz = Math.max(-b.hz, Math.min(b.hz, lz));
        if (Math.hypot(lx - qx, lz - qz) < r * 0.85) {
          let what = tag === 'counter' ? 'counter' : tag === 'jukebox' ? 'jukebox' : tag === 'booth' ? 'booth' : 'wall';
          if (what === 'counter' && R.pieCase && Math.abs(R.pieCase.pos.z - z) < 0.75 && !R.pieCase.broken) what = 'piecase';
          return { s, what, obj: b };
        }
      }
      if (R.bounds) {
        const B = R.bounds;
        if (x > B.x1 - r * 0.8 || x < B.x0 + r * 0.8 || z > B.z1 - r * 0.8 || z < B.z0 + r * 0.8) return { s, what: 'wall', obj: null };
      }
    }
    return null;
  }

  // his back into it
  into(hit, dir) {
    const G = this.game, R = this.room, c = this.c;
    const at = V(c.pos.x, 1.0, c.pos.z);
    this.stats.throws++;
    this.stats.into.push(hit.what);
    G.emit('brawl:throw', { into: hit.what });
    let clip = 'br_into';
    if (hit.what === 'stools') {
      clip = 'br_into_stools';
      const st = hit.obj;
      const row = R.stools.filter((s) => s !== st && !s.handle.toppled && !s.handle.broken && !s.taken && Math.abs(s.pos.x - st.pos.x) < 0.3);
      const sgn = Math.abs(dir.z) > 0.2 ? Math.sign(dir.z) : (st.pos.z > c.pos.z ? 1 : -1);
      row.sort((a, b) => (a.pos.z - st.pos.z) * sgn - (b.pos.z - st.pos.z) * sgn);
      G.stage.breakables.topple(st.handle, V(dir.x, 0, dir.z + sgn * 0.6).multiplyScalar(1.4));
      let k = 0;
      for (const s of row) {
        const ahead = (s.pos.z - st.pos.z) * sgn;
        if (ahead <= 0 || ahead > 2.8) continue;
        k++;
        this.later(0.18 * k, () => G.stage.breakables.topple(s.handle, V(dir.x * 0.5, 0, sgn).multiplyScalar(1.2)));
      }
      this.sfx('bodyStools', at, {});
    } else if (hit.what === 'counter' || hit.what === 'piecase') {
      if (R.counterHit) R.counterHit(at, dir);
      if (hit.what === 'piecase' && R.pieCase) { R.pieCase.burst(dir); }
      this.sfx('counter', at, { k: 1 });
    } else if (hit.what === 'jukebox') {
      if (R.jukebox) { R.jukebox.hit(1.2); if (R.jukebox.next) this.later(1.1, () => R.jukebox.next()); }
      this.sfx('bodyThud', at, { k: 1 });
    } else if (hit.what === 'table' || hit.what === 'chair') {
      const t = hit.obj;
      G.stage.breakables.topple(t.handle, V(dir.x, 0, dir.z).multiplyScalar(1.4));
      if (t.chairs) for (const ch of t.chairs) if (!ch.taken) this.later(0.15, () => G.stage.breakables.topple(ch.handle, V(ch.pos.x - t.pos.x, 0, ch.pos.z - t.pos.z).add(dir)));
      this.sfx('bodyThud', at, { k: 0.8 });
    } else this.sfx('bodyThud', at, { k: 0.9 });
    this.controller.shake(0.3, 1.5);
    G.hitStop = Math.max(G.hitStop || 0, 2);
    // (into the stools he goes down with them: the stun is spent down there)
    this.hisState('into', clip, 0.1);
  }

  // ---- his side -----------------------------------------------------------------------------------
  stepHim(dt) {
    const him = this.him, c = this.c;
    him.t += dt;
    if (him.state === 'ko') { this.stepKO(dt); return; }
    for (const s of ['L', 'R']) if (him.open[s] > 0) him.open[s] -= dt;
    if (him.missT > 0) him.missT -= dt;
    if (him.coverT > 0) him.coverT -= dt;
    if (!c.fig.alive) return;
    // (he looks at me - unless I am behind him: the look eased as an angle)
    if (!this.finished) {
      const e = this.game.eye, rel = wrap(Math.atan2(e.x - c.pos.x, e.z - c.pos.z) - c.fig.yaw);
      const want = Math.abs(rel) < 1.9 ? rel : 0;
      him.lookA = (him.lookA ?? want) + (want - (him.lookA ?? want)) * (1 - Math.exp(-dt * 7));
      const a = c.fig.yaw + him.lookA, P = him.lookPt || (him.lookPt = new THREE.Vector3());
      const d = Math.max(1, Math.hypot(e.x - c.pos.x, e.z - c.pos.z));
      P.set(c.pos.x + Math.sin(a) * d, Math.abs(rel) < 1.9 ? e.y : c.pos.y + 1.7, c.pos.z + Math.cos(a) * d);
      c.lookAt(P);
    }
    const clipDone = him.h && (him.h.done || him.h.t >= him.h.duration);
    switch (him.state) {
      case 'move':
        this.breathe(dt);
        if (this.me.act !== 'down') think(this, dt);
        break;
      case 'attack': if (clipDone) this.backToGuard(); break;
      case 'react': case 'stun': case 'into': case 'comeRound':
        if (clipDone) { if (him.state === 'comeRound') { him.hp = Math.max(him.hp, BRAWL.comeRoundHp); c.hp = him.hp; this.setManner('wild'); } this.backToGuard(); }
        break;
      case 'knock':
        if (clipDone) {
          if (him.stunAfter && this.sideOpen('L') && him.open.L > 0.25) { him.stunAfter = false; this.hisState('stun', 'br_stun', 0.1); }
          else this.backToGuard();
        }
        break;
      case 'arm': this.stepTask(dt); break;
      case 'reel': this.stepReel(dt); break;
    }
    steer(this, dt);
    this.drawGuard();
  }

  // he breathes between his blows: one hand lowered, shaken out, a while
  // (FIGHT.md v3 §3: more often and longer as he tires; wild, one hand
  // hangs low almost all the time)
  breathe(dt) {
    const him = this.him, M = MANNERS[him.manner];
    if (!M || this.lessonHold) return;
    him.breatheT += dt;
    if (M.hang && him.hang) {
      // (wild: the hanging hand comes up only now and then, for a moment)
      him.hangT = (him.hangT || 0) - dt;
      if (him.hangT < -2.0) him.hangT = 0.8;
      if (him.hangT <= 0 && him.coverT <= 0) this.lower(him.hang, 0.1, 'hang');
    }
    if (him.breatheT >= M.breathe && him.open.L <= 0 && him.open.R <= 0 && him.coverT <= 0) {
      him.breatheT = this.rng.range(-0.4, 0.3);
      this.lower(this.rng.chance(0.5) ? 'L' : 'R', this.rng.range(M.open[0], M.open[1]), 'breathe');
    }
  }

  // the guard drawn by his body: an upper-body overlay (a hand dropped to
  // the hip, shaken out) over his guard and his steps
  drawGuard() {
    const him = this.him, F = this.c.fig;
    if (him.state !== 'move' && him.state !== 'arm') { him.ov = null; return; }
    if (him.state === 'arm') return;
    const L = him.open.L > 0 || him.taunt === 'L' || him.taunt === 'LR', R = him.open.R > 0 || him.taunt === 'R' || him.taunt === 'LR';
    const want = him.coverT > 0 ? null : L && R ? 'br_openBoth' : L ? 'br_openL' : R ? 'br_openR' : null;
    if (F.anim.overlay !== want) {
      try { F.anim.setOverlay(want, want ? 0.1 : 0.12); } catch (e) { /* a non-looping base: next step */ }
    }
    him.ov = want;
  }

  // the tick: for the first 0.15 s of an opening a small white ink tick
  // flicks at the open side of his jaw (no arrows, no text, no outline)
  drawTicks() {
    const him = this.him, cards = this._cards;
    if (!cards || !him || this.finished) return;
    const G = this.game;
    for (const s of ['L', 'R']) {
      const o = this.sideOpen(s);
      if (o && !him.wasOpen[s] && him.state !== 'reel') {
        const head = _a.setFromMatrixPosition(this.c.bones.head.matrixWorld);
        const right = _b.set(1, 0, 0).applyQuaternion(G.camera.quaternion).setY(0).normalize();
        const p = head.clone().addScaledVector(right, (s === 'L' ? -1 : 1) * 0.2).add(V(0, -0.05, 0));
        const sp = G.screenOf(p);
        if (sp) cards.mark(sp, s, BRAWL.tick);
        this.stats.ticks = (this.stats.ticks || 0) + 1;
      }
      him.wasOpen[s] = o;
    }
  }

  backToGuard() {
    const him = this.him, c = this.c;
    him.state = 'move'; him.clip = null; him.t = 0; him.h = null; him.loco = null; him.aim = null; him.ov = null;
    c.setState('br_guard', 0.12);
    if (him.pending) { him.next = 0.08; return; }
    const M = MANNERS[him.manner] || MANNERS.measured;
    if (him.next < 0.3) him.next = this.rng.range(M.gap[0], M.gap[1]);
  }

  // his blow: `clip` of BR_ATTACKS (or a feint). When the tell starts he
  // picks the place it goes: where I stand, led by the way I walk (not by a
  // hop: a hop is how a blow is left)
  hisAttack(clip, { slow = 0 } = {}) {
    const him = this.him, c = this.c, G = this.game;
    him.want = null;
    const cl = c.clip(clip);
    const A = BR_ATTACKS[clip];
    const marks = {
      tell: () => this.hisTell(clip),
      contact: () => this.hisContact(clip),
      release: () => this.hisThrow(),
      take: () => this.hisTake(),
      break: () => this.hisBreak(),
      drop: () => this.dropHisProp(),
    };
    this.hisState('attack', clip, 0.06, marks);
    him.strikeAt = cl.marks.strike ?? cl.marks.contact ?? 0.3;
    him.contactAt = cl.marks.contact ?? cl.marks.release ?? null;
    const tc = (cl.marks.contact ?? cl.marks.release ?? cl.marks.strike ?? 0.4) - (cl.marks.tell ?? 0);
    const Cv = this.controller.vel || V(0, 0, 0);
    const lead = Math.min(0.9, tc * 0.8);
    him.aim = { x: G.eye.x + Cv.x * lead, z: G.eye.z + Cv.z * lead, from: { x: c.pos.x, z: c.pos.z } };
    him.hit = false;
    this.stats.his++;
    this.stats.clips[clip] = (this.stats.clips[clip] || 0) + 1;
    G.emit('brawl:tell', { clip });
    // (the lesson only: the world runs slow through the tell)
    if (slow && cl.marks.strike) G.slowmo(slow, Math.max(0.1, cl.marks.strike));
    void A;
  }

  // the first frame of a tell: a glint on the fist that will swing (grey for
  // a feint), and his grunt
  hisTell(clip) {
    const G = this.game, c = this.c, A = BR_ATTACKS[clip];
    // (his first bottle: the aim is taken again when the neck is cocked)
    if (clip === 'br_bottle') { const Cv = this.controller.vel || V(0, 0, 0); this.him.aim = { x: G.eye.x + Cv.x * 0.4, z: G.eye.z + Cv.z * 0.4 }; }
    const feint = /^br_feint/.test(clip);
    const hand = feint ? (clip === 'br_feint' ? 'R' : 'L') : A ? (A.hand === 'both' ? 'R' : A.hand) : 'R';
    const p = c.bones[hand === 'L' ? 'handL' : 'handR'].getWorldPosition(V(0, 0, 0));
    if (G.fx.hit.glint) G.fx.hit.glint(p, feint ? 0.45 : 1);
    this.sfx('hisGrunt', p, { k: feint ? 0.25 : 0.4 });
    this.sfx('tell', null, { kind: clip });
  }

  // his blow arrives: does it find me where it was aimed?
  hisContact(clip) {
    const G = this.game, me = this.me, H = this.hands, him = this.him, c = this.c;
    if (!this.active || this.finished || me.act === 'down') return;
    const A = BR_ATTACKS[clip];
    if (!A || !him.aim) return;
    const eye = G.eye, L = this.lesson;
    const res = this.inPath(A, eye);
    const from = A.hand === 'R' ? 'L' : A.hand === 'L' ? 'R' : 'F';   // the side of me it comes from
    if (!res.hit) {
      // ---- it misses: the air, and he is open
      him.hit = false;
      this.stats.dodged++; this.stats.slipped++;
      this.did.dodged = true;
      this.lower(A.miss.open, A.miss.t, 'miss');
      him.missT = Math.max(him.missT, A.miss.t); him.punished = false;
      this.sfx('whiff', null, { k: 1 });
      G.emit('brawl:hit', { by: 'him', kind: clip, power: 0, zone: 'missed', lat: +res.lat.toFixed(2), dep: +res.dep.toFixed(2) });
      if (L) L.onHisBlow(clip, 'missed');
      return;
    }
    him.hit = true;
    const K = (BRAWL.dmgK[him.manner] ?? 1) * (L ? 0.5 : 1);
    const dirMe = _c.set(eye.x - c.pos.x, 0, eye.z - c.pos.z).normalize().clone();
    if (me.act === 'block') {
      if (A.block !== null) {
        // ---- the block holds (a straight stopped, a swing a quarter through)
        this.stats.blocked++;
        this.did.block = true;
        if (A.block) this.hurtMe(A.dmg * A.block * K, from, { soft: true });
        this.sfx('blocked', eye, { k: A.kind === 'straight' ? 0.7 : 1 });
        me.h = H.play('blockHit');
        me.act = 'hurt'; me.stun = 0.12; me.t = 0;
        this.later(0.13, () => { if (this.me.act === 'idle' && this.game.held('Space')) this.block(true); });
        if ((clip === 'br_bottle_thrust' || clip === 'br_bottle') && him.holding === 'neck') this.breakHisNeck();
        G.emit('brawl:hit', { by: 'him', kind: clip, power: 0, zone: 'covered' });
        if (L) L.onHisBlow(clip, 'covered');
        return;
      }
      // ---- a haymaker, a stool, a shove: through the block, a stagger
      this.hurtMe(A.dmg * 0.5 * K, from, { soft: true });
      me.act = 'stagger'; me.stun = 0.5; me.t = 0;
      me.h = H.play('shoved');
      this.controller.shake(0.45, 0);
      this.sfx('guardBreak', eye, {});
      if (A.push) this.pushMe(dirMe, A.push);
      G.emit('brawl:hit', { by: 'him', kind: clip, power: 0.5, zone: 'broke' });
      if (L) L.onHisBlow(clip, 'broke');
      return;
    }
    let dmg = A.dmg * K;
    // (a step toward the swing keeps me in its path, and it lands harder)
    if (res.into) { dmg *= 1.25; this.stats.wrongSlips++; }
    this.hurtMe(dmg, from, { stun: A.stun + (res.into ? 0.08 : 0) });
    // (a blow that finds me, he presses: a second one on its heels - trading
    // blows with him is a losing game)
    const press = { measured: 0.35, dirty: 0.45, wild: 0.55 }[him.manner] || 0;
    if (!L && !him.pending && !A.heavy && this.rng.chance(press)) him.pending = A.hand === 'L' ? 'br_cross' : A.hand === 'R' ? 'br_jab' : 'br_hook';
    if (A.push) this.pushMe(dirMe, A.push);
    if (A.kind === 'shove') { me.act = 'stagger'; me.stun = 0.45; this.hands.play('shoved'); }
    if (L) L.onHisBlow(clip, 'hit');
  }

  // the path of his blow against where I stand: in the frame of his aim
  // (from his feet now, toward the place it was aimed), my lateral offset
  // (+ to my right) and depth
  inPath(A, eye) {
    const him = this.him, c = this.c, P = A.path;
    const ax = him.aim.x - c.pos.x, az = him.aim.z - c.pos.z;
    const dA = Math.max(0.3, Math.hypot(ax, az));
    const fx = ax / dA, fz = az / dA;
    const rx = fz, rz = -fx;   // my right, as I face him
    const ex = eye.x - c.pos.x, ez = eye.z - c.pos.z;
    const lat = ex * rx + ez * rz, dep = ex * fx + ez * fz;
    const reach = Math.min(P.reach, dA + P.over);
    const hit = lat >= P.lo && lat <= P.hi && dep > 0.2 && dep <= reach;
    // (toward the swing: out on the side it comes from, past the aim line)
    const into = hit && ((A.hand === 'R' && A.kind === 'swing' && lat < -0.3) || (A.hand === 'L' && A.kind === 'swing' && lat > 0.3));
    return { hit, into, lat, dep, reach };
  }

  hurtMe(n, from = 'F', { soft = false, stun = 0.3 } = {}) {
    const G = this.game, me = this.me, H = this.hands;
    this.stats.taken++;
    this.stats.dmgTaken = (this.stats.dmgTaken || 0) + n;
    G.emit('brawl:hit', { by: 'him', kind: 'hit', power: n / 20, zone: soft ? 'chip' : 'head' });
    if (!soft) {
      this.controller.shake(0.22 + n / 45, 0);
      this.sfx('punchMe', null, { k: Math.min(1, n / 18) });
      this.sfx('myGrunt', null, { k: Math.min(1, n / 18) });
      this.cancelArm();
      if (this.controller.brawlHop) this.controller.brawlHop = null;
      if (me.act !== 'down') { me.act = 'hurt'; me.t = 0; const clip = from === 'L' ? 'hurtFromL' : from === 'R' ? 'hurtFromR' : 'hurtFront'; me.stun = stun; me.h = H.play(clip); }
      if (me.holding && n >= 12) this.dropMine();
    }
    G.health.damage(n);
  }

  // a push on me (m): the controller carries it, into whatever is behind
  pushMe(dir, m) {
    const C = this.controller;
    if (!C.brawlPush) return;
    C.brawlPush.addScaledVector(dir, m * 5.5);
    if (m > 0.8) { this.hands.play('shoved'); this.sfx('shove', null, { k: 1 }); }
  }

  bumps() {
    const C = this.controller, R = this.room;
    const b = C.bump;
    if (!b) return;
    C.bump = null;
    this.sfx('bodyThud', b.at, { k: Math.min(1, b.speed / 5) });
    this.controller.shake(0.3, 0);
    if (R.counterBump && Math.abs(b.at.x - (R.counterX ?? -14.35)) < 0.8) { R.counterBump(b.at, b.speed); this.sfx('cups', b.at, { k: Math.min(1, b.speed / 4) }); }
    this.game.emit('brawl:bump', { at: b.at, speed: b.speed });
  }

  // ---- what he fights with ------------------------------------------------------------------------
  stepTask(dt) {
    const him = this.him, T = him.task, c = this.c;
    if (!T) { this.backToGuard(); return; }
    T.t += dt;
    const p = T.item.stand || T.item.pos;
    const d = Math.hypot(p.x - c.pos.x, p.z - c.pos.z);
    if (T.phase !== 'take' && (d < 0.35 || T.t > 3)) {
      if (!T.item.available || !T.item.available()) { him.task = null; this.backToGuard(); return; }
      T.phase = 'take';
      const clip = T.kind === 'stool' ? 'br_stoolUp' : 'br_take';
      if (T.kind === 'bottle') { him.task = null; this.hisAttack('br_bottle'); return; }
      this.hisState('arm', clip, 0.1, { take: () => this.hisTake() });
      him.state = 'arm';
      return;
    }
    if (T.phase === 'take' && him.h && (him.h.done || him.h.t >= him.h.duration)) { him.task = null; this.backToGuard(); him.next = Math.min(him.next, 0.5); }
  }

  hisTake() {
    const him = this.him, c = this.c, R = this.room;
    const T = him.task || { kind: 'bottle', item: R.hisItem ? R.hisItem('bottle', c.pos) : null };
    const it = T.item;
    if (!it) return;
    const o = it.take ? it.take() : null;
    if (!o) return;
    him.prop = o;
    him.holding = T.kind === 'bottle' ? 'bottle' : T.kind;
    this.stats.hisItems.push(T.kind);
    if (T.kind === 'bottle') him.hadBottle = true;
    else if (T.kind === 'stool') him.hadStool = true;
    else him.throws = (him.throws || 0) + 1;
    c.hold(o, 'R', { grip: T.kind === 'bottle' ? 'hang' : T.kind === 'stool' ? 'hang' : 'upright' });
    this.sfx('grab_' + (T.kind === 'mug' ? 'plate' : T.kind), c.pos.clone().setY(1.2), {});
    if (T.kind === 'bottle' && R.dotSlide) R.dotSlide('first');
    if (this.opts.onBottle && T.kind === 'bottle') this.opts.onBottle('take', him);
  }

  hisBreak() {
    const him = this.him, c = this.c, G = this.game;
    const b = him.prop;
    if (!b || him.holding !== 'bottle') return;
    const B = G.stage.breakables;
    b.updateWorldMatrix(true, true);
    const at = b.getWorldPosition(V(0, 0, 0));
    const parent = b.parent;
    B.hit(B.add(b, { kind: 'bottle', solid: false }), { point: at, dir: V(0, -1, 0), power: 9, by: 'body', neck: true });
    const neck = parent && parent.children.find((o) => o.userData && o.userData.kind === 'bottleNeck');
    G.fx.hit.punch(at, V(0, 1, 0), 0.3, { px: 70, camera: G.camera });
    if (neck) { c.hold(neck, 'R', { grip: 'hang' }); him.prop = neck; him.holding = 'neck'; }
    else { him.prop = null; him.holding = null; }
    if (this.opts.onBottle) this.opts.onBottle('break', him, neck);
  }

  breakHisNeck() {
    const him = this.him, c = this.c, G = this.game;
    const n = him.prop;
    him.prop = null; him.holding = null;
    if (!n) return;
    const at = n.getWorldPosition(V(0, 0, 0));
    c.hold(null, 'R');
    G.stage.scene.add(n); n.position.copy(at); n.updateMatrixWorld(true);
    const B = G.stage.breakables;
    B.breakIt(B.add(n, { kind: 'plate', solid: false }), { point: at, dir: V(0, -1, 0), by: 'fist' });
  }

  // a plate or a mug thrown at me: it flies to the place he aimed (where I
  // stood as he let go, led by my walk); if I am not there it goes past me
  // and breaks on the floor behind
  hisThrow() {
    const him = this.him, c = this.c, G = this.game, o = him.prop;
    if (!o) return;
    him.prop = null; const kind = him.holding; him.holding = null;
    c.hold(null, 'R');
    const from = c.bones.handR.getWorldPosition(V(0, 0, 0));
    const Cv = this.controller.vel || V(0, 0, 0);
    const aim = V(G.eye.x + Cv.x * 0.25, G.eye.y - 0.15, G.eye.z + Cv.z * 0.25);
    const d = from.distanceTo(aim), fly = Math.max(0.2, d / 9);
    // (past the aim it carries on 2 m and falls)
    const dirF = aim.clone().sub(from).setY(0).normalize();
    G.stage.scene.add(o); o.position.copy(from); o.updateMatrixWorld(true);
    const t0 = this.T;
    const spin = this.rng.range(8, 14);
    let judged = false;
    const tick = () => {
      if (!this.active) { this.dropInWorld(o, kind, o.position.clone()); return; }
      const u = (this.T - t0) / fly;
      if (u <= 1) {
        o.position.lerpVectors(from, aim, u); o.position.y += Math.sin(u * Math.PI) * 0.25;
      } else {
        // (it goes on past me, falling)
        const s = (u - 1) * fly;
        o.position.copy(aim).addScaledVector(dirF, s * 9); o.position.y = aim.y - 4.9 * s * s;
      }
      o.rotation.y += spin / 60; o.rotation.x += spin / 90;
      o.updateMatrixWorld(true);
      if (u >= 1 && !judged) {
        judged = true;
        const eye = G.eye;
        const lat = Math.hypot(eye.x - aim.x, eye.z - aim.z);
        if (lat < 0.42 && this.me.act !== 'down') {
          // on me (or on my block)
          him.aim = { x: aim.x, z: aim.z };
          this.hisContact('br_throw');
          const B = G.stage.breakables;
          o.position.copy(eye).add(V(0, -0.5, 0)).addScaledVector(dirF, 0.5); o.updateMatrixWorld(true);
          B.breakIt(B.add(o, { kind: kind === 'mug' ? 'mug' : 'plate', solid: false }), { point: o.position.clone(), dir: V(0, -1, 0), by: 'body' });
          return;
        }
        const A = BR_ATTACKS.br_throw;
        this.lower(A.miss.open, A.miss.t, 'miss'); him.missT = Math.max(him.missT, A.miss.t); him.punished = false;
        this.stats.dodged++; this.did.dodged = true;
        this.sfx('whiff', null, { k: 0.8 });
        this.game.emit('brawl:hit', { by: 'him', kind: 'br_throw', power: 0, zone: 'missed' });
      }
      const floor = G.stage.surfaceY(o.position.x, o.position.z);
      if (u > 1 && (o.position.y <= floor + 0.08 || u > 3)) {
        const B = G.stage.breakables;
        o.position.y = floor + 0.08; o.updateMatrixWorld(true);
        B.breakIt(B.add(o, { kind: kind === 'mug' ? 'mug' : 'plate', solid: false }), { point: o.position.clone(), dir: dirF.clone(), by: 'body' });
        return;
      }
      this.later(0, tick);
    };
    this.later(0, tick);
  }

  // the stool (or anything) out of his hands: it falls from where his hands
  // had it and comes apart on the floor (the neck falls and lies)
  dropHisProp() {
    const him = this.him, c = this.c, G = this.game, o = him.prop;
    if (!o) return;
    him.prop = null; const kind = him.holding; him.holding = null;
    o.updateWorldMatrix(true, true);
    const w = o.getWorldPosition(V(0, 0, 0));
    const q = o.getWorldQuaternion(new THREE.Quaternion());
    c.hold(null, 'R');
    if (kind === 'neck' || kind === 'bottle') { o.quaternion.copy(q); this.dropInWorld(o, kind, w, null, 0.3); return; }
    G.stage.scene.add(o);
    o.position.copy(w); o.quaternion.copy(q); o.scale.setScalar(1);
    o.updateMatrixWorld(true);
    // (a stool or a chair: it comes apart where it falls - its pieces fall
    // from his hands' height under gravity and lie still)
    const B = G.stage.breakables;
    let h = B.handle(o);
    if (!h) h = B.add(o, { kind: 'stool', hp: 1, solid: false });
    const k0 = h.kind; h.kind = kind === 'chair' || kind === 'stool' ? 'stool' : kind || 'stool';
    B.breakIt(h, { point: w.clone(), dir: V(Math.sin(c.fig.yaw), 0, Math.cos(c.fig.yaw)), by: 'body' });
    h.kind = k0;
  }

  // ---- out on his feet (FIGHT.md §8) ------------------------------------------------------------
  startReel() {
    const him = this.him, c = this.c, G = this.game, R = this.room;
    if (him.prop) this.dropHisProp();
    him.task = null; him.pending = null;
    him.manner = 'out';
    this.stats.manners.out = this.stats.manners.out ?? this.stats.time;
    G.emit('brawl:round', { n: 4, manner: 'out' });
    G.emit('brawl:reel', {});
    him.state = 'reel'; him.clip = null; him.t = 0; him.open.L = him.open.R = 0; him.quietT = 0; him.atSpot = false; him.loco = null; him.reelSpeed = null; him.caught = false; him.catchT = 0; him.lane = false; him.stuckT = 0; him.aim = null; him.bestD = null; him.reelPath = null;
    let best = null, bd = Infinity;
    for (const w of R.windows || []) { const d = Math.hypot(w.spot.x - c.pos.x, w.spot.z - c.pos.z); if (d < bd) { bd = d; best = w; } }
    him.window = best;
    him.spot = best ? best.spot : { x: c.pos.x, z: c.pos.z };
    try { c.fig.anim.setOverlay(null, 0.1); } catch (e) { /* */ }
    c.setState('br_reel', 0.3);
  }

  stepReel(dt) {
    const him = this.him, c = this.c, F = c.fig;
    // (left alone AT THE WINDOW he comes round - not on his way there)
    if (him.atSpot) him.quietT += dt; else him.quietT = 0;
    if (him.swayT > 0) him.swayT -= dt;
    if (him.catchT > 0) { him.catchT -= dt; if (him.catchT <= 0) F.anim.setOverlay(null, 0.25); }
    else if (!him.caught && !him.atSpot && this.room.stools) {
      const s = Math.sin(F.yaw), co = Math.cos(F.yaw);
      for (const st of this.room.stools) {
        if (st.taken || st.handle.toppled || st.handle.broken) continue;
        const ox = st.pos.x - F.pos.x, oz = st.pos.z - F.pos.z;
        const lf = ox * co - oz * s, fw = ox * s + oz * co;
        if (Math.abs(lf) > 0.3 && Math.abs(lf) < 0.75 && Math.abs(fw) < 0.35) {
          him.caught = true; him.catchT = 0.85;
          F.anim.setOverlay(lf > 0 ? 'br_catchL' : 'br_catchR', 0.18);
          if (st.st && st.st.spin) st.st.spin(0.6);
          this.sfx('scuff', st.pos, {});
          break;
        }
      }
    }
    const d = Math.hypot(him.spot.x - F.pos.x, him.spot.z - F.pos.z);
    // (reeling into me he shoulders me aside, out of his lane: a big man
    // stumbling does not stop for the man in his way)
    if (!him.atSpot && this.controller.brawlPush) {
      const e = this.game.eye, ex = e.x - F.pos.x, ez = e.z - F.pos.z, de = Math.hypot(ex, ez);
      if (de < 0.8 && de > 1e-3) {
        const vx = him.vel ? him.vel.x : 0, vz = him.vel ? him.vel.z : 0, vl = Math.hypot(vx, vz) || 1;
        // aside, to whichever side of his way I stand
        const side = (vx * ez - vz * ex) >= 0 ? 1 : -1;
        const px = -vz / vl * side, pz = vx / vl * side;
        this.controller.brawlPush.x += (px * 0.7 + ex / de * 0.3) * 6 * dt; this.controller.brawlPush.z += (pz * 0.7 + ez / de * 0.3) * 6 * dt;
      }
    }
    if (!him.atSpot) {
      // (held up on the way - something fallen across it, or me standing in his
      // lane: no nearer the spot for 1.5 s - he goes for the other window)
      if (him.bestD == null || d < him.bestD - 0.1) { him.bestD = d; him.stuckT = 0; } else him.stuckT = (him.stuckT || 0) + dt;
      if (him.stuckT > 2.5 && this.room.windows) {
        const other = this.room.windows.find((w) => w !== him.window);
        if (other) { him.window = other; him.spot = other.spot; him.lane = false; him.reelSpeed = null; him.stuckT = 0; him.bestD = null; }
      }
    }
    if (!him.atSpot && d < 0.2) {
      him.atSpot = true;
      F.pos.x = him.spot.x; F.pos.z = him.spot.z;
      him.loco = null;
      c.setState('br_reel', 0.3);
    }
    if (him.atSpot) {
      const e = wrap(-Math.PI / 2 - F.yaw);
      F.yaw = wrap(F.yaw + Math.sign(e) * Math.min(Math.abs(e), 2.5 * dt));
      if (him.swayT <= 0 && c.animName !== 'br_reel' && !(c.clipH && !c.clipH.done)) c.setState('br_reel', 0.25);
    }
    if (him.quietT > BRAWL.comeRound) {
      him.atSpot = false; him.spot = null;
      this.hisState('comeRound', 'br_comeRound', 0.2);
    }
  }

  // ---- the last blow: out through the window -----------------------------------------------------
  ko() {
    const him = this.him, c = this.c, G = this.game, C = this.controller, w = him.window;
    this.finished = true;
    if (this.me.holding) this.dropMine();
    if (this._cards) this._cards.clear();
    him.state = 'ko'; him.t = 0; him.landed = false; him.fell = false;
    c.lookAt(new THREE.Vector3(c.pos.x - 3, c.pos.y + 1.7, c.pos.z));
    c.fig.yaw = -Math.PI / 2; c.fig._prevYaw = c.fig.yaw;
    const clip = c.clip('br_ko_window');
    him.koLand = clip.marks.land;
    him.koEnd = clip.duration;
    this.hisState('ko', 'br_ko_window', 0.06, { glass: () => { if (this.opts.onGlass) this.opts.onGlass(w); } });
    him.state = 'ko';
    G.hitStop = Math.max(G.hitStop || 0, BRAWL.hitStop.hard);
    if (G.slowmo) G.slowmo(BRAWL.slowmo.k, BRAWL.slowmo.dur);
    C.shake(0.5, 0);
    this.sfx('heavy', null, { k: 1 });
    this.sfx('hisGrunt', null, { k: 1 });
    G.fx.hit.punch(_a.setFromMatrixPosition(c.bones.head.matrixWorld).clone(), V(1, 0.2, 0), 1, { px: 240, camera: G.camera });
    const eye = C.eyePose();
    let yaw = eye.yaw, pitch = eye.pitch;
    C.slip = 0;
    C.brawlHop = null;
    const win = w ? w.spot : { x: c.pos.x, z: c.pos.z };
    const toW = V(win.x - eye.x, 0, win.z - eye.z);
    const step = Math.max(0, Math.min(0.6, toW.length() - 0.9));
    toW.normalize();
    C.setMode('cutscene', { track: (t, dt = 1 / 60) => {
      const p = _b.setFromMatrixPosition(c.bones.chest.matrixWorld);
      const u = Math.max(0, Math.min(1, (him.t - 0.4) / 0.9)), e = u * u * (3 - 2 * u);
      const ex = eye.x + toW.x * step * e, ez = eye.z + toW.z * step * e;
      const ty = Math.atan2(-(p.x - ex), -(p.z - ez));
      const tp = Math.atan2(p.y - eye.y, Math.hypot(p.x - ex, p.z - ez));
      const k = 1 - Math.exp(-dt * 6);
      yaw += wrap(ty - yaw) * k;
      pitch += (Math.max(-0.75, Math.min(0.3, tp)) - pitch) * k;
      return { x: ex, y: eye.y, z: ez, yaw, pitch };
    } });
    if (this.opts.onKO) this.opts.onKO(w);
    this.stats.won = true;
    this.stats.window = w ? w.name : null;
  }

  stepKO() {
    const him = this.him, c = this.c;
    const t = him.t;
    if (!him.landed && t >= him.koLand) {
      him.landed = true;
      this.sfx('bodyPavement', V(c.pos.x, 0.2, c.pos.z), { k: 1 });
      this.controller.shake(0.2, 3);
      if (this.opts.onLanded) this.opts.onLanded(him.window);
    }
    if (!him.fell && t >= him.koEnd) {
      him.fell = true;
      c.down = true; c.state = 'ko'; c.base = 'ko';
      c.setState('br_down', 0.3);
      c.down = true;
      c.lookAt(null);
    }
    if (t >= him.koEnd + 0.4 && !this.done) { this.done = true; this.stop(); this.game.emit('brawl:end', { won: true, window: him.window && him.window.name }); }
  }

  // ---- what is in reach: E takes the thing I look at -----------------------------------------------
  reachable() {
    const R = this.room, eye = this.game.eye, me = this.me;
    if (!R.items) return null;
    const C = this.controller, cp = Math.cos(C.pitch || 0);
    const lx = -Math.sin(C.yaw) * cp, ly = Math.sin(C.pitch || 0), lz = -Math.cos(C.yaw) * cp;
    let best = null, bs = Infinity;
    for (const it of R.items()) {
      if ((it.kind === 'stool') && me.stools >= BRAWL.grab.stools) continue;
      const p = it.pos || it.object.getWorldPosition(_c);
      const dx = p.x - eye.x, dz = p.z - eye.z, d = Math.hypot(dx, dz);
      const floor = it.kind === 'stool' || it.kind === 'chair';
      const lim = floor ? BRAWL.grab.floor : BRAWL.grab.counter;
      if (d >= lim) continue;
      const dy = (floor ? p.y + 0.7 : p.y) - eye.y, d3 = Math.hypot(dx, dy, dz);
      const ang = d3 > 1e-3 ? Math.acos(Math.max(-1, Math.min(1, (dx * lx + dy * ly + dz * lz) / d3))) : 0;
      // (the look decides first; nearness breaks ties)
      if (ang > 1.2) continue;
      const score = 2.2 * ang + 0.35 * d - (floor ? 0 : BRAWL.grab.preferCounter);
      if (score < bs) { bs = score; best = it; }
    }
    return best;
  }

  // the brush stroke beside a winding fist
  drawCharge() {
    const me = this.me, G = this.game;
    const cards = this._cards;
    if (me.act === 'wind') {
      const k = Math.max(0.04, Math.min(1, (me.holdT - BRAWL.hold.min) / (BRAWL.hold.full - BRAWL.hold.min)));
      const p = this.hands.anchor(me.arm === 'L' ? 'palmL' : 'palmR', _c);
      const s = G.screenOf(p);
      if (s) { s.x += (me.arm === 'L' ? 1 : -1) * 70; s.y -= 40; s.side = me.arm === 'L' ? 1 : -1; }
      this.cards.charge(s, k);
      this.charging = k;
    } else if (this.charging != null) { if (cards) cards.charge(null, 0); this.charging = null; }
  }

  // ---- losing: down, black, up at the start of his manner ---------------------------------------------
  playerDown() {
    const me = this.me, G = this.game;
    if (me.act === 'down') return;
    this.cancelArm();
    if (me.holding) this.dropMine();
    me.act = 'down'; me.downT = 0;
    this.controller.brawlHop = null;
    this.stats.downs++;
    this.hands.play('downMe');
    this.sfx('bodyFloor', null, { k: 1 });
    G.emit('player:down', { brawl: true });
  }

  stepDown(dt) {
    const me = this.me, G = this.game;
    me.downT += dt;
    G.hud.fade(Math.min(1, me.downT / 0.35));
    if (me.downT >= BRAWL.stageAt) {
      const m = this.him.manner;
      const left = Math.max(0.05, BRAWL.down - me.downT);
      G.health.reset();
      G.health.hp = BRAWL.retryHp;
      if (G.sfx && G.sfx.hush) G.sfx.hush(left + 0.3);
      if (this.opts.onRetry) this.opts.onRetry(m);
      G.hud.fade(1);
      this.blackT = left;
    }
  }

  get state() {
    const him = this.him, me = this.me;
    return this.active || this.finished ? {
      round: this.round, manner: him && him.manner, me: +this.game.health.hp.toFixed(1), him: him ? +him.hp.toFixed(1) : null, hisState: him && him.state, hisClip: him && him.clip,
      myState: me && me.act, open: this.him ? this.openSides() : '', landed: this.stats.landed, taken: this.stats.taken, blocked: this.stats.blocked, dodged: this.stats.dodged,
      throws: this.stats.throws, downs: this.stats.downs, time: +this.stats.time.toFixed(1), lesson: this.lesson ? this.lesson.step : 0,
    } : null;
  }

  sfx(name, pos, p) { const S = this.game.sfx; if (!S || !S.live) return; if (name.startsWith('break_')) S.play(name, pos, p, { ref: 2 }); else S.fight(name, pos, p); }
}

export function reachProp(kind, variant = null) { return buildProp(kind, variant ? { variant } : {}); }
export const HIS_ATTACKS = Object.keys(BR_ATTACKS);
export { OTHER };

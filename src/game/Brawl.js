import * as THREE from 'three';
import { buildProp } from '../props/index.js';
import { BR_ATTACKS } from '../cast/brawl/clips.js';
import { think, steer, mannerOf, REACH } from '../cast/brawl/brain.js';
import { FightCards } from '../ui/fightCards.js';
import { Lesson } from './BrawlLesson.js';

// The fist fight's rules (round 2: docs/story/FIGHT.md, the user's spec).
// A rules engine over clips and their marks: every number of a blow comes
// from its clip (hands.clip(name).marks for mine, c.clip(name).marks and
// BR_ATTACKS for his), so art can retime a clip and the fight still reads it.
//   game.brawl.start({ opponent, manner, room, rng, lesson, retry, ... })
//   game.brawl.stop()   .active  .finished  .manner  .round  .me  .him  .stats
//
// MY SIDE (FIGHT.md §1). Each mouse button is an arm: a click (let go
// within 0.20 s) is a jab with it; a hold winds it up and letting go throws
// the hard punch, its power by the hold (0 at 0.20 s, 1 at 1.0 s; past that
// the fist trembles and the power stays 1), visible in the fist (drawn
// further back and lower), the view (turned with the shoulder, up to 6
// degrees) and a brush stroke beside the fist (grey to paper white). With
// something in the right hand the right button uses it: a click strikes, a
// wind-up smashes or throws it. W A S D move anywhere in the room; SPACE
// with A / D slips left / right; SPACE alone or with S leans back; SHIFT
// held covers up; E grabs what is in reach. While an arm winds, that side of
// my guard is open (his blows land a quarter harder).
// My blows land only on him within 1.75 m and 35 degrees of where I look.
//
// HIS SIDE (§2). Both his hands attack. A swing comes from its hand: from
// his right (my left) I slip RIGHT, from his left I slip LEFT; into the
// swing it lands a quarter harder. Straight blows are slipped either way or
// leaned from; an overhand is leaned from or slipped away from its hand.
// Covering stops the straight ones, takes a hook for chip damage and is
// broken by an overhand (0.6 s stagger). A blow slipped the right way
// leaves him open 0.9 s: my hits count double and a hard punch stuns him.
//
// THE ROOM (§4). We both move. A hard punch knocks him back 0.6 .. 1.5 m
// along the line of the punch; whatever stands behind him takes him (the
// stools go down one after another, the jukebox skips, the pie case bursts,
// plates fly off the counter, a café table tips). His shove drives me; my
// back into the counter makes the cups jump. Things on the counter and the
// floor can be picked up and used, by both of us.
// His manner follows his health (brain.js): measured, dirty, wild, then out
// on his feet at 12: he reels to the nearer window (a finish spot) and my
// next hard punch of power 0.5 or more puts him out through its glass (§5);
// jabs only make him sway; left alone 6 s he comes round with 20.
// Losing is not failing: at 0 I go down, black, and come up at the start of
// his current manner with 60.
// Randomness: his choices draw from the scene's forked rng (seeded).
export const BRAWL = {
  himHp: 100, meHp: 100, retryHp: 60,
  manners: { measured: 100, dirty: 65, wild: 30, out: 12 },
  order: ['measured', 'dirty', 'wild', 'out'],
  reach: 1.75, cone: 35 * Math.PI / 180, itemReach: 1.95,
  click: 0.2, fullAt: 1.0,
  mine: { jab: 2.5, hardMin: 5, hardMax: 11, guardJab: 0.25, guardHard: 0.5, openMult: 2 },
  items: { bottle: 14, neck: 10, plate: 8, mug: 7, stool: 20, chair: 16 },
  open: 0.9, stagger: 0.6, into: 1.25, windOpen: 1.25,
  knock: [0.6, 1.5],
  hitStop: { hard: 3, jab: 1 }, slowmo: { k: 0.35, dur: 0.8 },
  down: 1.5, stageAt: 0.4,
  comeRound: 6, comeRoundHp: 20,
  grab: { counter: 1.5, floor: 1.15, stools: 4, preferCounter: 0.9 },
  // his blows' weight by his manner
  dmgK: { measured: 1, dirty: 1, wild: 0.85, out: 1 },
};
const freshStats = () => ({ landed: 0, taken: 0, blocked: 0, slipped: 0, wrongSlips: 0, leaned: 0, throws: 0, downs: 0, time: 0, jabs: 0, hards: 0, grabs: 0, his: 0, knocks: 0, into: [], manners: {}, hisItems: [], clips: {} });
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const OTHER = { L: 'R', R: 'L' };

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
  // (the old name for the fight's stage: 1 measured, 2 dirty, 3 wild, 4 out on his feet)
  get round() { return this.him ? BRAWL.order.indexOf(this.him.manner) + 1 : 0; }

  // ---- start / stop ---------------------------------------------------------------------
  // opponent: the Character; manner: where he starts (his health is its top);
  // room: the scene's (brawlRoom in scenes/02_fight.js): stools, cafe,
  // counter items, the jukebox, the pie case, the windows, Dot's slide,
  // hisItem(kind, near); lesson: true | step (the first exchange taught);
  // onRetry(manner) re-stages the room after I go down; onKO(win) / onGlass(win)
  // / onLanded(win) the last blow; onManner(m) his manner changes
  start({ opponent, manner = 'measured', hp = null, room = {}, rng, lesson = false, retry = false, myHp = null, onRetry = null, onKO = null, onGlass = null, onLanded = null, onManner = null, onBottle = null }) {
    const G = this.game;
    this.active = true;
    this.finished = false;
    this.done = false;
    this.fadeBack = 0;
    if (!retry) { this.stats = freshStats(); this.blackT = 0; this.did = {}; }
    this.opts = { onRetry, onKO, onGlass, onLanded, onManner, onBottle };
    this.room = room;
    // (polish, the bug hunt: the fight stays in the room - the front door was
    // walkable in the brawl, and backing off by it took the fight out onto
    // the pavement, where the finish, the windows and the room's rules no
    // longer hold. The controller keeps my eye inside the room's walls)
    G.controller.brawlBounds = room.bounds || null;
    this.rng = rng;
    this.c = opponent;
    const h0 = hp ?? BRAWL.manners[manner];
    this.him = {
      hp: h0, manner: mannerOf(h0), state: 'move', clip: null, h: null, t: 0,
      next: 1.4, open: 0, low: false, lowT: 0, circle: 1, circleT: 1, backT: 0, vel: V(0, 0, 0), speed: 0, yawRate: 0,
      holding: null, prop: null, task: null, pending: null, want: null, spot: null, atSpot: false, quietT: 0, loco: null, locoT: 0,
      hadBottle: false, hadStool: false, throws: 0, aimFor: 0,
    };
    opponent.hp = h0;
    this.me = { act: 'idle', arm: null, t: 0, pressT: 0, power: 0, h: null, slipDir: 0, stun: 0, holding: null, stools: 0, spaceT: -1 };
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
    if (this.me && this.me.holding) { this.hands.hold(null, 'R', { keep: true }); this.me.holding = null; }
    if (this._cards) this._cards.clear();
    this.game.hud.clearPrompt('brawl');
  }

  later(s, fn) { this.timers.push({ at: this.T + s, fn }); }

  // ---- per step (Game.post) ----------------------------------------------------------------
  update(dt) {
    if (!this.active) return;
    const G = this.game;
    this.T += dt;
    for (const x of [...this.timers]) if (this.T >= x.at) { this.timers.splice(this.timers.indexOf(x), 1); x.fn(); }
    this.stats.time += dt;
    G.health.sinceHit = 0;
    if (this._cards) this._cards.tick(dt);
    if (this.blackT > 0) {
      this.blackT -= dt;
      G.hud.fade(1);
      if (this.blackT <= 0) { this.blackT = 0; this.fadeBack = 0.6; }
      return;
    }
    if (this.fadeBack > 0) { this.fadeBack -= dt; G.hud.fade(Math.max(0, this.fadeBack / 0.6)); }
    if (this.me.act === 'down') { this.stepDown(dt); return; }
    if (!this.finished) this.input(dt);
    this.stepMe(dt);
    this.stepHim(dt);
    if (this.lesson) this.lesson.update(dt);
    this.drawCharge();
    this.bumps();
  }

  // ---- my side --------------------------------------------------------------------------------
  input(dt) {
    const G = this.game, me = this.me, H = this.hands, C = this.controller;
    const busy = me.act === 'hurt' || me.act === 'stagger' || me.act === 'down';
    // moving: W A S D, held off while SPACE makes A / D slips
    const space = G.held('Space');
    const M = C.brawlMove || (C.brawlMove = { f: 0, s: 0 });
    const mv = !busy && me.act !== 'slip' && me.act !== 'lean';
    M.f = mv ? (G.held('KeyW') ? 1 : 0) - (G.held('KeyS') && !space ? 1 : 0) : 0;
    M.s = mv && !space ? (G.held('KeyD') ? 1 : 0) - (G.held('KeyA') ? 1 : 0) : 0;
    if (me.act === 'wind' || me.act === 'cock') { M.f *= 0.5; M.s *= 0.5; }
    if (me.act === 'cover') { M.f *= 0.6; M.s *= 0.6; }
    if (Math.abs(M.f) + Math.abs(M.s) > 0) { me.moved = (me.moved || 0) + dt * 1.9; this.did.move = me.moved > 1; }
    if (busy) return;
    // (a blow's recovery can be cut short by a slip: the fist is spent)
    const canDefend = me.act === 'idle' || me.act === 'cover' || me.act === 'cock' || me.act === 'wind' || (me.act === 'jab' && me.h && me.h.t > 0.09) || (me.act === 'hard' && me.h && me.h.t > 0.24);
    // the slips and the lean: SPACE with a direction (either order), or
    // SPACE alone (a moment's grace for the direction to come)
    if (canDefend) {
      const pa = G.pressed('KeyA'), pd = G.pressed('KeyD'), ps = G.pressed('Space');
      if (ps) me.spaceT = 0;
      if (space && (pa || pd || (ps && (G.held('KeyA') || G.held('KeyD'))))) {
        const dir = pd || (ps && G.held('KeyD') && !G.held('KeyA')) ? 1 : -1;
        this.slip(dir); return;
      }
      if (space && (ps && G.held('KeyS') || G.pressed('KeyS'))) { this.lean(); return; }
      if (me.spaceT >= 0) { me.spaceT += dt; if (me.spaceT > 0.07) { me.spaceT = -1; if (space) { this.lean(); return; } } }
    }
    // covering up: SHIFT held
    const shift = G.held('ShiftLeft') || G.held('ShiftRight');
    if (shift && (me.act === 'idle' || me.act === 'cock' || me.act === 'wind')) { this.cancelArm(); me.act = 'cover'; me.h = H.play('cover'); return; }
    if (me.act === 'cover' && !shift) { me.act = 'idle'; me.h = H.play('guard'); }
    if (me.act === 'cover') return;
    // E: what is in reach
    if (G.pressed('KeyE') && me.act === 'idle' && !me.holding) { const it = this.reachable(); if (it) { this.grab(it); return; } }
    // the arms: a press starts the cock; a short click is a jab, a hold a wind-up
    // (polish, the bug hunt: a press made while the other fist is still out
    // - the first 0.13 s of a jab, a hard punch, a grab - is kept for 0.3 s
    // and thrown as soon as the hands are free, not dropped: mashing both
    // buttons swallowed every right-hand click)
    const free = me.act === 'idle' || (me.act === 'jab' && me.h && me.h.t > 0.13);
    if (me.buf) { me.buf.t += dt; if (me.buf.t > 0.3) me.buf = null; }
    for (const [btn, arm] of [['Mouse0', 'L'], ['Mouse2', 'R']]) {
      if (G.pressed(btn) && !free && me.act !== 'cock' && me.act !== 'wind') me.buf = { btn, arm, t: 0 };
    }
    for (const [btn, arm] of [['Mouse0', 'L'], ['Mouse2', 'R']]) {
      const buffered = me.buf && me.buf.btn === btn;
      if ((G.pressed(btn) || buffered) && free) {
        me.buf = null;
        me.act = 'cock'; me.arm = arm; me.pressT = 0; me.btn = btn;
        me.h = H.play(me.holding && arm === 'R' ? (me.holding.kind === 'stool' || me.holding.kind === 'chair' ? 'windBig' : 'windItem') : arm === 'L' ? 'windL' : 'windR');
        return;
      }
    }
    if (me.act === 'cock' || me.act === 'wind') {
      me.pressT += dt;
      if (me.act === 'cock' && me.pressT >= BRAWL.click) { me.act = 'wind'; this.sfx('wind', null, {}); }
      // (past full the fist trembles: the clip's tremble keys, round again)
      if (me.h && me.h.t > 1.58) me.h.t = 1.0;
      if (G.released(me.btn) || !G.held(me.btn)) {
        const arm = me.arm;
        if (me.act === 'cock') {
          if (me.holding && arm === 'R') this.strike(false, 0); else this.jab(arm);
        } else {
          const k = Math.max(0, Math.min(1, (me.pressT - BRAWL.click) / (BRAWL.fullAt - BRAWL.click)));
          if (me.holding && arm === 'R') this.strike(true, k); else this.hard(arm, k);
        }
      }
    }
  }

  cancelArm() { const me = this.me; if (me.act === 'cock' || me.act === 'wind') { me.act = 'idle'; me.arm = null; } }

  slip(dir) {
    const me = this.me;
    this.cancelArm();
    me.act = 'slip'; me.slipDir = dir; me.spaceT = -1;
    me.h = this.hands.play(dir < 0 ? 'slipL' : 'slipR');
    this.sfx('scuff', null, {});
  }
  lean() {
    const me = this.me;
    this.cancelArm();
    me.act = 'lean'; me.spaceT = -1;
    me.h = this.hands.play('leanBack');
    this.sfx('scuff', null, { k: 0.6 });
  }

  jab(arm) {
    const me = this.me;
    me.act = 'jab'; me.arm = arm;
    me.h = this.hands.play(arm === 'L' ? 'jabL' : 'jabR', { onMark: { contact: () => this.myContact('jab', arm, 0) } });
    this.stats.jabs++;
  }
  hard(arm, k) {
    const me = this.me;
    me.act = 'hard'; me.arm = arm; me.power = k;
    me.h = this.hands.play(arm === 'L' ? 'hardL' : 'hardR', { onMark: { contact: () => this.myContact('hard', arm, k) } });
    this.stats.hards++;
    this.sfx('whiff', null, { k: 0.4 + 0.5 * k });
  }
  // with something in the right hand: a click strikes with it; a wind-up
  // smashes it (a stool, a chair) or throws it (a bottle, a plate, a mug)
  strike(wound, k) {
    const me = this.me, it = me.holding, H = this.hands;
    me.act = 'strike'; me.arm = 'R'; me.power = wound ? k : 0.5;
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
    const me = this.me, H = this.hands, G = this.game;
    me.act = 'grab';
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
    const me = this.me, H = this.hands, G = this.game;
    me.t += dt;
    if (me.act === 'stagger' || me.act === 'hurt') {
      me.stun -= dt;
      if (me.stun <= 0) { me.act = 'idle'; me.h = H.play('guard'); }
      return;
    }
    if ((me.act === 'jab' || me.act === 'hard' || me.act === 'slip' || me.act === 'lean' || me.act === 'grab' || me.act === 'strike') && (!me.h || me.h.done || me.h.t >= me.h.duration)) {
      me.act = 'idle'; me.arm = null;
      me.h = H.play('guard');
    }
    void G;
  }

  // is my blow on him? within reach and within the cone of where I look
  onTarget(reach = BRAWL.reach) {
    const G = this.game, c = this.c, C = this.controller;
    const head = _a.setFromMatrixPosition(c.bones.chest.matrixWorld);
    const dx = head.x - G.eye.x, dz = head.z - G.eye.z, d = Math.hypot(dx, dz);
    // (his root, not his chest, sets how far: a lean of his does not matter)
    const dr = Math.hypot(c.pos.x - G.eye.x, c.pos.z - G.eye.z);
    const look = Math.atan2(-Math.sin(C.yaw), -Math.cos(C.yaw));
    const ang = Math.abs(wrap(Math.atan2(dx, dz) - look));
    return { ok: Math.min(d, dr) <= reach && ang <= BRAWL.cone, d: Math.min(d, dr), ang };
  }

  // is his guard up at this instant?
  guarding() {
    const him = this.him;
    if (him.open > 0 || him.low) return false;
    if (him.state === 'attack') {
      const cl = this.c.clip(him.clip);
      return cl.marks.contact == null ? true : him.t < cl.marks.contact - 0.08;
    }
    return him.state === 'move' || him.state === 'arm';
  }

  // my blow arrives
  myContact(kind, arm, k) {
    const G = this.game, him = this.him, c = this.c, me = this.me;
    if (!this.active || this.finished) return;
    const item = kind === 'item' ? me.holding : null;
    const tgt = this.onTarget(item ? BRAWL.itemReach : BRAWL.reach);
    const head = _a.setFromMatrixPosition(c.bones.head.matrixWorld);
    const dir = _b.set(c.pos.x - G.eye.x, 0, c.pos.z - G.eye.z).normalize();
    if (!tgt.ok || him.state === 'ko') {
      this.sfx('whiff', null, { k: 0.6 });
      if (item) this.spendHeld(null, dir);
      return;
    }
    // the lesson counts a blow that lands, where it lands
    const L = this.lesson;
    if (kind === 'jab') this.did['jab' + arm] = true;
    if (kind === 'hard' && k >= 0.5) this.did.hard = true;
    if (L) L.onMyBlow(kind, arm, k);
    // out on his feet: jabs make him sway; a hard punch of 0.5 or more is the last
    if (him.state === 'reel') {
      if ((kind === 'hard' || item) && k >= 0.5 && him.atSpot) { if (item) this.spendHeld(head, dir); this.ko(); return; }
      if (item) this.spendHeld(head, dir);
      him.quietT = 0;
      if (him.atSpot) { this.c.play('br_sway', { fade: 0.08 }); him.swayT = 0.8; }
      this.feel(kind === 'jab' ? 'jab' : 'hard', head, dir, 0.4);
      this.sfx(kind === 'jab' ? 'jab' : 'heavy', head, { k: 0.5 });
      return;
    }
    const M = BRAWL.mine;
    const guarded = !item && this.guarding();
    const open = him.open > 0 || him.state === 'stun';
    let dmg;
    if (kind === 'jab') dmg = M.jab * (guarded ? M.guardJab : 1);
    else if (kind === 'hard') dmg = (M.hardMin + (M.hardMax - M.hardMin) * k) * (guarded ? M.guardHard : 1);
    else dmg = BRAWL.items[item.kind] ?? 8;
    if (open && !guarded) dmg *= M.openMult;
    // a counter into his blow before it lands: it stops the smaller ones
    const intoHis = him.state === 'attack' && !guarded;
    this.damageHim(dmg);
    this.stats.landed++;
    G.emit('brawl:hit', { by: 'me', kind, power: k, zone: guarded ? 'guard' : 'head', arm });
    if (guarded && kind === 'jab') {
      this.sfx('blocked', head, { k: 0.6 });
      G.fx.hit.punch(head.clone().addScaledVector(dir, -0.25).setY(head.y - 0.2), dir.clone().negate(), 0.2);
      G.hitStop = Math.max(G.hitStop || 0, 1);
      // (he answers a jab into his guard, now and then)
      if (him.state === 'move' && !this.lessonHold && this.rng.chance(0.25)) him.next = Math.min(him.next, 0.2);
      return;
    }
    if (item) this.spendHeld(head, dir);
    const heavy = kind !== 'jab';
    this.feel(heavy ? 'hard' : 'jab', head, dir, heavy ? 0.5 + 0.4 * k : 0.3);
    this.sfx(kind === 'jab' ? 'jab' : 'heavy', head, { k: heavy ? 0.6 + 0.4 * k : 0.4 });
    if (heavy) this.sfx('hisGrunt', head, { k: 0.7 + 0.3 * k });
    if (him.hp <= BRAWL.manners.out && him.state !== 'reel') { this.startReel(dir); return; }
    if (him.state === 'knock' || him.state === 'into') return;
    // (my blow from my left arm lands on his right: his head goes to his left)
    const hitClip = arm === 'L' ? 'br_hitHeadR' : 'br_hitHeadL';
    if (!heavy) {
      if (intoHis && /br_(haymaker|rush|stoolSwing|bottle$)/.test(him.clip)) return;
      this.react(hitClip);
      return;
    }
    if (open && (kind === 'hard' || item)) { this.stun(); return; }
    const D = guarded ? BRAWL.knock[0] * 0.6 : BRAWL.knock[0] + (BRAWL.knock[1] - BRAWL.knock[0]) * (item ? 0.5 : k);
    this.knock(dir, D);
  }

  // what I hold is spent on him: a bottle breaks to its neck (good for two
  // more), a neck is gone after two, a plate, a mug, a stool, a chair break
  spendHeld(at, dir) {
    const me = this.me, G = this.game, H = this.hands;
    const it = me.holding;
    if (!it) return;
    const B = G.stage.breakables;
    const o = H.hold(null, 'R', { keep: true });
    const where = at ? at.clone().addScaledVector(dir, -0.2) : G.eye.clone().addScaledVector(dir, 1.2).setY(G.eye.y - 0.4);
    if (it.kind === 'bottle' && o) {
      // (broken on his head: the neck stays in my fist)
      const g = new THREE.Group();
      g.position.copy(where); g.updateMatrixWorld(true);
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

  // a wound-up throw: it flies where I look; on him within 6 m and 35
  // degrees it hits him (power by the wind-up), else it breaks where it lands
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
    if (o) o.visible = false;
    this.sfx('whiff', null, { k: 0.8 });
    this.later(d / 11, () => {
      if (!this.active || !o) return;
      o.visible = true;
      if (tgt.ok && this.him.state !== 'ko') {
        const head = _a.setFromMatrixPosition(c.bones.head.matrixWorld).clone();
        const dir = V(c.pos.x - G.eye.x, 0, c.pos.z - G.eye.z).normalize();
        this.breakInWorld(o, it.kind, head.addScaledVector(dir, -0.2), dir);
        const dmg = (BRAWL.items[it.kind] ?? 8) * (0.7 + 0.5 * k) * (this.him.open > 0 ? BRAWL.mine.openMult : 1);
        this.damageHim(dmg);
        this.stats.landed++;
        this.feel('hard', head, dir, 0.6);
        this.sfx('heavy', head, { k: 0.8 });
        if (this.him.state === 'reel' && k >= 0.5 && this.him.atSpot) { this.ko(); return; }
        if (this.him.hp <= BRAWL.manners.out && this.him.state !== 'reel') { this.startReel(); return; }
        if (this.him.state === 'move' || this.him.state === 'attack' || this.him.state === 'arm') this.react('br_hitBody');
      } else {
        const at = G.eye.clone().addScaledVector(look, d);
        at.y = G.stage.surfaceY(at.x, at.z) + 0.1;
        this.breakInWorld(o, it.kind, at, look);
      }
    });
  }

  // a thing out of a hand, broken where it is (in the world)
  breakInWorld(o, kind, at, dir) {
    const G = this.game;
    if (kind === 'neck') { o.visible = false; return; }
    G.stage.scene.add(o);
    o.position.copy(at); o.quaternion.identity(); o.scale.setScalar(1);
    o.updateMatrixWorld(true);
    const B = G.stage.breakables;
    const k = kind === 'chair' ? 'stool' : kind;
    const h = B.handle(o) || B.add(o, { kind: k, hp: 1, solid: false });
    h.hp = 0.01;
    B.hit(h, { point: at.clone(), dir: dir.clone(), power: 9, by: 'body' });
  }

  // the hit feel: the hit stop, the view kick, the white ink burst
  feel(kind, head, dir, burst) {
    const G = this.game;
    G.hitStop = Math.max(G.hitStop || 0, kind === 'jab' ? BRAWL.hitStop.jab : BRAWL.hitStop.hard);
    this.controller.shake(kind === 'jab' ? 0.1 : 0.3, 0);
    G.fx.hit.punch(head.clone().addScaledVector(dir, -0.12), dir.clone(), burst);
  }

  damageHim(n) {
    const him = this.him, prev = him.hp;
    him.hp = Math.max(this.lesson ? 70 : 0, him.hp - n);
    this.c.hp = him.hp;
    him.quietT = 0;
    const m = mannerOf(him.hp);
    if (m !== him.manner && m !== 'out') this.setManner(m);
    void prev;
  }

  setManner(m) {
    const him = this.him, G = this.game, c = this.c;
    him.manner = m;
    this.stats.manners[m] = this.stats.manners[m] ?? this.stats.time;
    G.emit('brawl:round', { n: this.round, manner: m });
    him.next = Math.max(him.next, 1.0);
    if (m === 'wild') {
      // he bleeds, his cap goes with the next blow to the head
      G.fx.hit.punch(c.bones.head.getWorldPosition(V(0, 0, 0)), V(0, -0.3, 1), 0.9);
      if (c.bleed) c.bleed(1);
      c.capLoose = true;
    }
    if (this.opts.onManner) this.opts.onManner(m, him);
  }

  react(clip) {
    const him = this.him, c = this.c;
    if (him.holding === 'stool' && him.prop) this.dropHisProp();
    // (a blow that stops his own blow half way: the turn of his trunk comes
    // back over a fifth of a second, not in one frame)
    this.hisState('react', clip, him.state === 'attack' || him.state === 'arm' ? 0.22 : 0.1);
    him.next = Math.min(Math.max(him.next, 0.5), 1.0);
    if (him.task) { him.task = null; }
  }

  stun() {
    this.hisState('stun', 'br_stun', this.him.state === 'attack' ? 0.22 : 0.12);
    this.him.open = 0;
    this.sfx('stun', null, {});
  }

  hisState(state, clip, fade = 0.15, onMark = {}) {
    const him = this.him;
    him.state = state; him.clip = clip; him.t = 0; him.loco = null;
    him.h = this.c.play(clip, { fade, onMark });
    return him.h;
  }

  // knocked back along the line of the blow; whatever stands behind him takes him
  knock(dir, D) {
    const him = this.him, c = this.c, F = c.fig;
    if (him.holding === 'stool' && him.prop) this.dropHisProp();
    him.task = null;
    const hit = this.sweep(dir, D);
    const d0 = hit ? Math.max(0.12, hit.s - 0.08) : D;
    // (the clip goes straight back along the line of the blow; he keeps
    // the heading he had - no turn snapped onto him - and only the travel
    // is laid along the blow)
    this.hisState('knock', 'br_knock', him.state === 'attack' || him.state === 'arm' ? 0.22 : 0.1, { stop: () => { if (hit) this.into(hit, dir); } });
    F.startRoot(c.animName, { scale: d0 / (1.0 * F.scale) });
    if (F._rmClip) F._rmClip.yaw0 = Math.atan2(-dir.x, -dir.z);
    this.stats.knocks++;
    him.next = Math.max(him.next, 0.9);
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
      // the room's own walls
      if (R.bounds) {
        const B = R.bounds;
        if (x > B.x1 - r * 0.8 || x < B.x0 + r * 0.8 || z > B.z1 - r * 0.8 || z < B.z0 + r * 0.8) return { s, what: 'wall', obj: null };
      }
    }
    return null;
  }

  // his back into it
  into(hit, dir) {
    const G = this.game, R = this.room, him = this.him, c = this.c;
    const at = V(c.pos.x, 1.0, c.pos.z);
    this.stats.throws++;
    this.stats.into.push(hit.what);
    G.emit('brawl:throw', { into: hit.what });
    let clip = 'br_into';
    if (hit.what === 'stools') {
      clip = 'br_into_stools';
      // (the row goes down one after another, along the way he fell)
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
        this.later(0.22 * k, () => G.stage.breakables.topple(s.handle, V(dir.x * 0.5, 0, sgn).multiplyScalar(1.2)));
      }
      this.sfx('bodyStools', at, {});
    } else if (hit.what === 'counter' || hit.what === 'piecase') {
      // (the plates fly off, the cups jump)
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
    this.hisState('into', clip, 0.12);
  }

  // ---- his side -----------------------------------------------------------------------------------
  stepHim(dt) {
    const him = this.him, c = this.c;
    him.t += dt;
    if (him.state === 'ko') { this.stepKO(dt); return; }
    if (him.open > 0) him.open -= dt;
    if (!c.fig.alive) return;
    // (he looks at me - unless I am behind him: then at nothing, the turn of
    // his chest let go smoothly rather than flipped from one shoulder to the
    // other as I cross behind his back)
    // (the look is eased as an angle about his heading and laid on a point
    // that far round: switching the look off - or to a point ahead - in one
    // step would snap the chest; the Hood's look weight only eases while
    // there is a target)
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
        if (this.me.act !== 'down') think(this, dt);
        break;
      case 'attack': {
        if (clipDone) this.backToGuard();
        break;
      }
      case 'react': case 'stun': case 'into': case 'comeRound':
        if (clipDone) { if (him.state === 'comeRound') { him.hp = Math.max(him.hp, BRAWL.comeRoundHp); c.hp = him.hp; this.setManner('wild'); } this.backToGuard(); }
        break;
      case 'knock':
        if (clipDone) this.backToGuard();
        break;
      case 'arm': this.stepTask(dt); break;
      case 'reel': this.stepReel(dt); break;
    }
    steer(this, dt);
  }

  backToGuard() {
    const him = this.him, c = this.c;
    him.state = 'move'; him.clip = null; him.t = 0; him.h = null; him.loco = null;
    c.setState('br_guard', 0.2);
    if (him.pending) { him.next = 0.12; return; }
    const M = { measured: [1.25, 1.9], dirty: [0.9, 1.4], wild: [0.55, 0.9] }[him.manner] || [1.4, 2];
    if (him.next < 0.4) him.next = this.rng.range(M[0], M[1]);
    const low = { measured: 0.2, dirty: 0.18, wild: 0.1 }[him.manner] || 0;
    if (!this.lessonHold && this.rng.chance(low)) { him.low = true; him.lowT = this.rng.range(0.6, 1.0); }
  }

  // his blow: `clip` of BR_ATTACKS (or a feint)
  hisAttack(clip, { slow = 0 } = {}) {
    const him = this.him, c = this.c, G = this.game;
    him.low = false; him.want = null;
    const cl = c.clip(clip);
    const marks = {
      tell: () => this.sfx('tell', null, { kind: clip }),
      contact: () => this.hisContact(clip),
      release: () => this.hisThrow(),
      take: () => this.hisTake(),
      break: () => this.hisBreak(),
      drop: () => this.dropHisProp(),
    };
    this.hisState('attack', clip, 0.12, marks);
    him.aimFor = (cl.marks.contact ?? 0.4) * 0.45;
    this.stats.his++;
    this.stats.clips[clip] = (this.stats.clips[clip] || 0) + 1;
    G.emit('brawl:tell', { clip });
    // (the lesson: the world runs slow through the tell)
    if (slow && cl.marks.contact) G.slowmo(slow, Math.max(0.1, cl.marks.contact - 0.06));
  }

  // his blow arrives
  hisContact(clip) {
    const G = this.game, me = this.me, H = this.hands, him = this.him, c = this.c;
    if (!this.active || this.finished || me.act === 'down') return;
    const A = BR_ATTACKS[clip];
    if (!A) return;
    const eye = G.eye;
    const d = Math.hypot(eye.x - c.pos.x, eye.z - c.pos.z);
    const facing = Math.abs(wrap(Math.atan2(eye.x - c.pos.x, eye.z - c.pos.z) - c.fig.yaw));
    const reach = (REACH[A.kind] ?? 1.9) + (clip === 'br_rush' ? 0.9 : clip.startsWith('br_haymaker') ? 0.3 : 0);
    const slipCl = H.clip(me.slipDir < 0 ? 'slipL' : 'slipR');
    const inSlip = me.act === 'slip' && me.h && me.h.t >= slipCl.marks.safe && me.h.t <= slipCl.marks.safeEnd;
    const leanCl = H.clip('leanBack');
    const inLean = me.act === 'lean' && me.h && me.h.t >= leanCl.marks.safe && me.h.t <= leanCl.marks.safeEnd;
    // the right way: away from the hand that swings (his right is on my left)
    const away = A.hand === 'R' ? me.slipDir > 0 : A.hand === 'L' ? me.slipDir < 0 : true;
    const correct = inSlip && (A.kind === 'straight' || A.kind === 'shove' || A.kind === 'throw' || away);
    const from = A.hand === 'R' ? 'L' : A.hand === 'L' ? 'R' : 'F';   // the side of me it comes from
    const L = this.lesson;
    if (d > reach + 0.1 || facing > 0.8) {
      this.sfx('whiff', null, { k: 0.6 });
      G.emit('brawl:hit', { by: 'him', kind: clip, power: 0, zone: 'short' });
      if (L) L.onHisBlow(clip, 'short');
      return;
    }
    if (correct) {
      this.stats.slipped++;
      this.did[me.slipDir > 0 ? 'slipR' : 'slipL'] = true;
      him.open = BRAWL.open;
      this.sfx('whiff', null, { k: 1 });
      G.emit('brawl:hit', { by: 'him', kind: clip, power: 0, zone: 'slipped' });
      if (L) L.onHisBlow(clip, 'slipped');
      return;
    }
    if (inLean && A.kind !== 'swing') {
      this.stats.leaned++;
      this.did.lean = true;
      this.sfx('whiff', null, { k: 0.8 });
      G.emit('brawl:hit', { by: 'him', kind: clip, power: 0, zone: 'leaned' });
      if (L) L.onHisBlow(clip, 'leaned');
      return;
    }
    const K = (BRAWL.dmgK[him.manner] ?? 1) * (L ? 0.5 : 1);
    const dirMe = _c.set(eye.x - c.pos.x, 0, eye.z - c.pos.z).normalize();
    if (me.act === 'cover' && A.chip !== null && A.kind !== 'shove') {
      this.stats.blocked++;
      this.did.cover = true;
      if (A.chip) this.hurtMe(A.chip * K, from, { soft: true });
      this.sfx('blocked', eye, { k: A.kind === 'straight' ? 0.7 : 1 });
      H.play('blockHit');
      me.act = 'hurt'; me.stun = H.clip('blockHit').duration; me.h = null;
      if ((clip === 'br_bottle_thrust' || clip === 'br_bottle') && him.holding === 'neck') this.breakHisNeck();
      if (him.manner === 'wild') him.open = Math.max(him.open, 0.6);
      G.emit('brawl:hit', { by: 'him', kind: clip, power: 0, zone: 'covered' });
      if (L) L.onHisBlow(clip, 'covered');
      return;
    }
    if (me.act === 'cover') {
      // an overhand, a stool, a shove: through the cover
      this.hurtMe((A.kind === 'shove' ? A.dmg : 5) * K, from, {});
      me.act = 'stagger'; me.stun = BRAWL.stagger;
      H.play('hurtFront');
      this.controller.shake(0.45, 0);
      this.sfx('guardBreak', eye, {});
      if (A.push) this.pushMe(dirMe, A.push);
      if (L) L.onHisBlow(clip, 'broke');
      return;
    }
    let dmg = A.dmg * K;
    if (inSlip && !correct) { dmg *= BRAWL.into; this.stats.wrongSlips++; }
    // (the side of my guard whose arm is winding is open: a swing from that
    // side, or anything straight, lands a quarter harder)
    if ((me.act === 'wind' || me.act === 'cock') && (from === 'F' || A.kind !== 'swing' || from === me.arm)) dmg *= BRAWL.windOpen;
    this.hurtMe(dmg, from, {});
    if (A.push) this.pushMe(dirMe, A.push);
    if (L) L.onHisBlow(clip, inSlip ? 'wrong' : 'hit');
  }

  hurtMe(n, from = 'F', { soft = false } = {}) {
    const G = this.game, me = this.me, H = this.hands;
    this.stats.taken++;
    this.stats.dmgTaken = (this.stats.dmgTaken || 0) + n;
    G.emit('brawl:hit', { by: 'him', kind: 'hit', power: n / 20, zone: 'head' });
    if (!soft) {
      this.controller.shake(0.25 + n / 40, 0);
      this.sfx('punchMe', null, { k: Math.min(1, n / 18) });
      this.sfx('myGrunt', null, { k: Math.min(1, n / 18) });
      this.cancelArm();
      if (me.act !== 'down') { me.act = 'hurt'; const clip = from === 'L' ? 'hurtFromL' : from === 'R' ? 'hurtFromR' : 'hurtFront'; me.stun = H.clip(clip).duration; me.h = H.play(clip); }
      if (me.holding && n >= 12) { const o = H.hold(null, 'R'); me.holding = null; if (o) o.visible = false; }
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

  // my back into something: the counter, and the cups jump
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
    if (T.phase !== 'take' && (d < 0.35 || T.t > 4)) {
      if (!T.item.available || !T.item.available()) { him.task = null; this.backToGuard(); return; }
      T.phase = 'take';
      const clip = T.kind === 'bottle' ? 'br_bottle' : T.kind === 'stool' ? 'br_stoolUp' : 'br_take';
      // (the bottle: take and break on the counter's edge, then the thrust:
      // his first bottle is an attack of its own)
      if (T.kind === 'bottle') { him.task = null; this.hisAttack('br_bottle'); return; }
      this.hisState('arm', clip, 0.15, { take: () => this.hisTake() });
      him.state = 'arm';
      return;
    }
    if (T.phase === 'take' && him.h && (him.h.done || him.h.t >= him.h.duration)) { him.task = null; this.backToGuard(); him.next = Math.min(him.next, 0.6); }
  }

  // the take mark: the thing off the counter or the floor into his right hand
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
    // (Dot slides me one when he first takes a bottle)
    if (T.kind === 'bottle' && R.dotSlide) R.dotSlide('first');
    if (this.opts.onBottle && T.kind === 'bottle') this.opts.onBottle('take', him);
  }

  // his first bottle broken on the counter's edge: the neck stays in his fist
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
    G.fx.hit.punch(at, V(0, 1, 0), 0.3);
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
    B.hit(B.add(n, { kind: 'plate', solid: false }), { point: at, dir: V(0, -1, 0), power: 9, by: 'fist' });
  }

  // a plate or a mug thrown at me: it flies, lands on me or past me and breaks
  hisThrow() {
    const him = this.him, c = this.c, G = this.game, o = him.prop;
    if (!o) return;
    him.prop = null; const kind = him.holding; him.holding = null;
    c.hold(null, 'R');
    const from = c.bones.handR.getWorldPosition(V(0, 0, 0));
    const eye = G.eye.clone();
    const d = from.distanceTo(eye), fly = d / 9;
    G.stage.scene.add(o); o.position.copy(from); o.updateMatrixWorld(true);
    const t0 = this.T;
    const spin = this.rng.range(8, 14);
    const tick = () => {
      if (!this.active) return;
      const u = Math.min(1, (this.T - t0) / fly);
      o.position.lerpVectors(from, eye, u); o.position.y += Math.sin(u * Math.PI) * 0.25 - 0.1 * u;
      o.rotation.y += spin / 60; o.rotation.x += spin / 90;
      if (u < 1) { this.later(0, tick); return; }
      // it arrives: on me unless slipped, leaned from or covered
      this.hisContact('br_throw');
      const B = G.stage.breakables;
      o.position.copy(eye).add(V(0, -0.5, 0)).addScaledVector(_a.set(eye.x - from.x, 0, eye.z - from.z).normalize(), 0.6);
      o.updateMatrixWorld(true);
      B.hit(B.add(o, { kind: kind === 'mug' ? 'mug' : 'plate', solid: false }), { point: o.position.clone(), dir: V(0, -1, 0), power: 9, by: 'body' });
    };
    this.later(0, tick);
  }

  // the stool (or anything) out of his hands: it drops and goes over
  dropHisProp() {
    const him = this.him, c = this.c, G = this.game, o = him.prop;
    if (!o) return;
    him.prop = null; const kind = him.holding; him.holding = null;
    const w = V(0, 0, 0); o.getWorldPosition(w);
    c.hold(null, 'R');
    if (kind === 'neck') { o.visible = false; return; }
    G.stage.scene.add(o);
    o.position.set(w.x, G.stage.surfaceY(w.x, w.z), w.z);
    o.quaternion.identity(); o.scale.setScalar(1);
    o.updateMatrixWorld(true);
    const B = G.stage.breakables;
    const h = B.handle(o) || B.add(o, { kind: kind === 'chair' ? 'stool' : kind || 'stool', hp: 1, solid: false });
    h.hp = 0.01;
    B.hit(h, { point: o.position.clone(), dir: V(0, -1, 0), power: 9, by: 'body' });
  }

  // ---- out on his feet (FIGHT.md §5) ------------------------------------------------------------
  startReel() {
    const him = this.him, c = this.c, G = this.game, R = this.room;
    if (him.prop) this.dropHisProp();
    him.task = null; him.pending = null;
    him.manner = 'out';
    this.stats.manners.out = this.stats.manners.out ?? this.stats.time;
    G.emit('brawl:round', { n: 4, manner: 'out' });
    G.emit('brawl:reel', {});
    him.state = 'reel'; him.clip = null; him.t = 0; him.open = 0; him.quietT = 0; him.atSpot = false; him.loco = null; him.reelSpeed = null; him.caught = false; him.catchT = 0; him.lane = false; him.stuckT = 0;
    // the nearer window
    let best = null, bd = Infinity;
    for (const w of R.windows || []) { const d = Math.hypot(w.spot.x - c.pos.x, w.spot.z - c.pos.z); if (d < bd) { bd = d; best = w; } }
    him.window = best;
    him.spot = best ? best.spot : { x: c.pos.x, z: c.pos.z };
    c.setState('br_reel', 0.3);
  }

  stepReel(dt) {
    const him = this.him, c = this.c, F = c.fig;
    him.quietT += dt;
    if (him.swayT > 0) him.swayT -= dt;
    // (on the way he catches at a stool beside him: a hand down on its seat)
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
    // (held up on the way - something fallen across it - he goes for the
    // other window)
    if (!him.atSpot) {
      him.stuckT = (him.speed || 0) < 0.15 ? (him.stuckT || 0) + dt : 0;
      if (him.stuckT > 1.2 && this.room.windows) {
        const other = this.room.windows.find((w) => w !== him.window);
        if (other) { him.window = other; him.spot = other.spot; him.lane = false; him.reelSpeed = null; him.stuckT = 0; }
      }
    }
    if (!him.atSpot && d < 0.12) {
      him.atSpot = true;
      F.pos.x = him.spot.x; F.pos.z = him.spot.z;
      him.loco = null;
      c.setState('br_reel', 0.3);
    }
    if (him.atSpot) {
      // (his back to the glass, square: the last blow goes straight out)
      const e = wrap(-Math.PI / 2 - F.yaw);
      F.yaw = wrap(F.yaw + Math.sign(e) * Math.min(Math.abs(e), 2.5 * dt));
      if (him.swayT <= 0 && c.animName !== 'br_reel' && !(c.clipH && !c.clipH.done)) c.setState('br_reel', 0.25);
    }
    // left alone he comes round
    if (him.quietT > BRAWL.comeRound) {
      him.atSpot = false; him.spot = null;
      this.hisState('comeRound', 'br_comeRound', 0.2);
    }
  }

  // ---- the last blow: out through the window -----------------------------------------------------
  ko() {
    const him = this.him, c = this.c, G = this.game, C = this.controller, w = him.window;
    this.finished = true;
    if (this.me.holding) { this.hands.hold(null, 'R', { keep: true }); this.me.holding = null; }
    if (this._cards) this._cards.clear();
    him.state = 'ko'; him.t = 0; him.landed = false; him.fell = false;
    // (his eyes off me as he goes: a point straight ahead, no chest turn left
    // to snap off; let go when he lies still)
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
    G.fx.hit.punch(_a.setFromMatrixPosition(c.bones.head.matrixWorld).clone(), V(1, 0.2, 0), 0.9);
    // the eye stays where it stood and turns to follow him out
    const eye = C.eyePose();
    let yaw = eye.yaw, pitch = eye.pitch;
    C.slip = 0;
    // (and, as he goes over the sill, takes a step after him toward the
    // window, so he is seen landing on the pavement below it)
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
      // down: he lies there, breathing, looking at nothing
      c.down = true; c.state = 'ko'; c.base = 'ko';
      c.setState('br_down', 0.3);
      c.down = true;
      c.lookAt(null);
    }
    if (t >= him.koEnd + 0.4 && !this.done) { this.done = true; this.stop(); this.game.emit('brawl:end', { won: true, window: him.window && him.window.name }); }
  }

  // ---- what is in reach -------------------------------------------------------------------------
  reachable() {
    const R = this.room, eye = this.game.eye, me = this.me;
    if (!R.items) return null;
    // (polish, the bug hunt: the nearest used to win, and a stool always
    // stands nearer than the counter - the stools at the counter's foot,
    // the bottles and plates on its top half a metre further - so E never
    // took anything off the counter. Now the choice is by distance and by
    // where I look, and a thing on the counter within its reach is
    // preferred: the stools are many, the counter's things few, and the
    // counter is reached across the stools)
    // (the look in 3D: looking down at a stool takes the stool; looking level
    // or away, the thing on the counter)
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
      // (past a right angle all behind me counts alike: then the counter wins)
      const score = d + 0.9 * Math.min(ang, 1.6) - (floor ? 0 : BRAWL.grab.preferCounter);
      if (score < bs) { bs = score; best = it; }
    }
    return best;
  }

  // the brush stroke beside a winding fist (and the prompt for what is in reach)
  drawCharge() {
    const me = this.me, G = this.game;
    const cards = this._cards;
    if (me.act === 'wind' || (me.act === 'cock' && me.pressT > 0.08)) {
      const k = Math.max(0.04, Math.min(1, (me.pressT - BRAWL.click) / (BRAWL.fullAt - BRAWL.click)));
      const p = this.hands.anchor(me.arm === 'L' ? 'palmL' : 'palmR', _c);
      const s = G.screenOf(p);
      if (s) { s.x += (me.arm === 'L' ? 1 : -1) * 70; s.y -= 40; s.side = me.arm === 'L' ? 1 : -1; }
      this.cards.charge(s, me.act === 'cock' ? 0.02 : k);
      this.charging = k;
    } else if (this.charging != null) { if (cards) cards.charge(null, 0); this.charging = null; }
    // (after the lesson the HUD is silent: what is in reach shows itself)
  }

  // ---- losing: down, black, up at the start of his manner ---------------------------------------------
  playerDown() {
    const me = this.me, G = this.game;
    if (me.act === 'down') return;
    this.cancelArm();
    me.act = 'down'; me.downT = 0;
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
      myState: me && me.act, landed: this.stats.landed, taken: this.stats.taken, blocked: this.stats.blocked, slipped: this.stats.slipped,
      throws: this.stats.throws, downs: this.stats.downs, time: +this.stats.time.toFixed(1), lesson: this.lesson ? this.lesson.step : 0,
    } : null;
  }

  // (the fight's own sounds are 'f_<name>'; what breaks is 'break_<kind>')
  sfx(name, pos, p) { const S = this.game.sfx; if (!S || !S.live) return; if (name.startsWith('break_')) S.play(name, pos, p, { ref: 2 }); else S.fight(name, pos, p); }
}

export function reachProp(kind, variant = null) { return buildProp(kind, variant ? { variant } : {}); }
export const HIS_ATTACKS = Object.keys(BR_ATTACKS);
export { OTHER };

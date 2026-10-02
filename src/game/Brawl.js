import * as THREE from 'three';
import { buildProp } from '../props/index.js';
import { BR_ATTACKS, OPENS } from '../cast/brawl/clips.js';
import { think, steer, mannerOf, MANNERS } from '../cast/brawl/brain.js';
import { FightCards } from '../ui/fightCards.js';
import { Lesson, HEAVY_CARD } from './BrawlLesson.js';
import { DodgeCue, CUE, cued } from './BrawlCue.js';
// [C4] the line before going down, and the word on the black after
const FIGHT_WARN = 'One more and you’re down.';
// (the dodge's teach card: the kit's, once a save, wherever the first cue comes)
export const DODGE_CARD = '[A] [D] dodge toward the light';
const DOWN_WHY = { late: 'Too slow.', wrong: 'Wrong way.', caught: 'Caught swinging.', answer: 'Into his guard.', down: 'Down.' };

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
  // [B8] his hit points (a room's man may have his own: who.hp); his
  // manners change at these PERCENT of them
  himHp: 116, meHp: 100, retryHp: 60, retryBack: 8, pound: 30, shell: 0.16, mannerHold: 9,
  manners: { measured: 100, dirty: 65, wild: 30, out: 12 },
  order: ['measured', 'dirty', 'wild', 'out'],
  reach: 1.8, cone: 38 * Math.PI / 180, itemReach: 2.0,
  // mine (§2). [B8] version 4: a press jabs at once; a hold goes on into the
  // wind-up (from `min` s held), which loads in three levels as the hold
  // passes `levels` (power 1/3, 2/3, full): three ticks at the fist, a flash
  // at full; let go and the hard punch goes, bigger by level in everything.
  // Let go before the first level and the fist just comes home.
  // [C4] version 5: every press is a jab at once (contact 0.06 s after it,
  // whatever the press's length: a click of 60 to 280 ms is a jab); a button
  // still held when that jab is home (`start`, 0.34 s) cocks the same fist and
  // loads it - the three levels as the hold passes `levels` (the wind clip's
  // own snaps at 0.08, 0.28, 0.48 s after it begins); let go, it is thrown.
  // A press that arrives while I cannot act (hit, knocked down a moment)
  // waits up to `wait` s and then jabs: nothing is swallowed.
  hold: { min: 0.34, start: 0.34, levels: [0.42, 0.62, 0.82] }, buffer: 0.15, wait: 0.35, other: 0.10,
  hop: { side: 0.55, back: 0.6, dur: 0.10, punchAt: 0.12, again: 0.25, blockAt: 0.08 },
  mine: { jab: 3, hard: [9, 15, 22] },
  counter: 1.5, missOpen: 1.5, combo: [1, 1, 1.2, 1.4, 1.4], comboGap: 0.5,
  stun: 1.2, guardBreak: { n: 3, within: 4, open: 1.0 }, coverUp: 0.9,
  // [B8] a punch into his guard is punished: about three times in four he
  // answers at once from the side that blocked (a 0.2 s tell, a fast straight)
  // while I am still coming back. A blocked fist: [when I may hop or block,
  // when I may punch again] - a blocked hard punch leaves me open longer.
  answer: 0.75,
  bounce: { jab: [0.12, 0.4], hard: [0.3, 0.56], item: [0.2, 0.45] },
  // a landed blow by its level (1..3; a jab is its own): the knock back (m),
  // the hit stop (steps), the burst (px at 1440 x 900), the view's kick
  // [deg, lens deg], the stun that opens him (s)
  feelOf: {
    jab: { knock: 0, stop: 2, burst: 90, kick: [0.75, 1.0], stun: 0 },
    1: { knock: 0.55, stop: 3, burst: 140, kick: [1.2, 1.4], stun: 0.6 },
    2: { knock: 0.95, stop: 4, burst: 185, kick: [1.7, 2.2], stun: 0.9 },
    3: { knock: 1.45, stop: 6, burst: 245, kick: [2.4, 3.2], stun: 1.2 },
  },
  comboKnock: 0.35,
  slowmo: { k: 0.35, dur: 0.8 },
  kick: { dur: 0.1 },
  tick: 0.15,
  down: 2.0, stageAt: 0.4,   // ([C4] 1.5 -> 2.0: the black says in a word what went wrong)
  comeRound: 6, comeRoundHp: 20,
  grab: { counter: 1.5, floor: 1.2, stools: 4, preferCounter: 0.25 },
  dmgK: { measured: 1, dirty: 1, wild: 1, out: 1 },
  // (version 3 counted 0.7 of every blow; version 4's numbers are the damage)
  tough: 1,
};
// [R2-H] the last blow's card (the lesson's words: HOLD TO LOAD, THEN LET GO)
const FINISH_CARD = 'OUT ON HIS FEET.   KEEP IT PRESSED, LET GO TO HIT';   // ([C4] the heavy's words, after the critic: they read as 'wait')
// [R2-H] how white his thrown china prints in the air (the glass ticks' 1.6)
const THROWN_LIFT = 0.45;
// [B8] what a thing does in my hands (§5): its damage, how many blows it is
// good for, one hand or both, whether a wind-up throws it, what it becomes
// when it breaks, whether it breaks his guard, its level of feel. A room may
// add kinds of its own (room.things: the Pier 9 bay's crate lid, hook, ...).
export const THINGS = {
  bottle: { dmg: 22, uses: 1, hands: 1, throw: true, then: 'neck', level: 3 },
  neck: { dmg: 14, uses: 2, hands: 1, throw: false, level: 2 },
  plate: { dmg: 12, uses: 1, hands: 1, throw: true, level: 2 },
  mug: { dmg: 12, uses: 1, hands: 1, throw: true, level: 2 },
  stool: { dmg: 35, uses: 1, hands: 2, throw: false, breaksGuard: true, big: true, level: 3 },
  chair: { dmg: 35, uses: 1, hands: 2, throw: false, breaksGuard: true, big: true, level: 3 },
  thing: { dmg: 12, uses: 1, hands: 1, throw: true, level: 2 },
};
// (the table the fight in hand uses: THINGS and the room's own kinds)
let ACTIVE = THINGS;
const THINGS_OF = (it) => (it && (ACTIVE[it.kind] || THINGS[it.kind])) || THINGS.thing;
export { THINGS_OF };
const freshStats = () => ({ landed: 0, taken: 0, blocked: 0, slipped: 0, dodged: 0, wrongSlips: 0, myBlocked: 0, counters: 0, combos: 0, breaks: 0, throws: 0, downs: 0, time: 0, jabs: 0, hards: 0, grabs: 0, his: 0, knocks: 0, into: [], manners: {}, hisItems: [], clips: {}, input: [] });
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3();
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const OTHER = { L: 'R', R: 'L' };
// (a jab or a shove, a hook or a body shot stop for a counter; a haymaker,
// a rush and a stool do not stop for a jab; a hard punch stops anything)
const STOPS = /^br_(jab|jabR|cross|hook|hookL|body|bodyL|shove|bottle_thrust|throw|answerL|answerR)$/;
const JAB_STOPS = /^$/;   // ([B8] a jab into his tell counts half again, and stops nothing)
// ([R2-E] a clip the man's kind knows: c.clip throws on an unknown name)
const CLIP_OK = (c, name) => { try { return !!c.clip(name); } catch (e) { return false; } };

export class Brawl {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.finished = false;
    this.stats = freshStats();
    this.blackT = 0;
    this.did = {};
    // [C4] how long a mouse button is really held, from the events' own
    // times: a slow frame (the sim catching up several steps at once) must
    // not make a 280 ms click look like a 400 ms hold and load a punch
    this.stamps = {};
    if (typeof addEventListener !== 'undefined') {
      addEventListener('mousedown', (e) => { this.stamps['Mouse' + e.button] = { down: e.timeStamp, up: null }; });
      addEventListener('mouseup', (e) => { const s = this.stamps['Mouse' + e.button]; if (s && s.up == null) s.up = e.timeStamp; });
    }
  }
  // (the time a press has been held, s: by its events when it has them, else
  // by the steps - the autoplay's and the shots' presses have no events)
  heldFor(b, code) {
    const s = b.stamp;
    if (!s) return b.t;
    const end = s.up != null ? s.up : (typeof performance !== 'undefined' ? performance.now() : s.down);
    return Math.max(0, (end - s.down) / 1000);
  }

  get hands() { return this.game.player.hands; }
  get controller() { return this.game.controller; }
  get cards() { return this._cards || (this._cards = new FightCards(this.game.hud)); }
  // his hit points as a percent of his whole
  pct(hp) { return hp * 100 / (this.max || BRAWL.himHp); }
  get round() { return this.him ? BRAWL.order.indexOf(this.him.manner) + 1 : 0; }

  // ---- start / stop ---------------------------------------------------------------------
  // [B8] the fight takes its room and its man as data (§7): room = { bounds,
  // items() and hisItem(kind, near) (what can be picked up), things (kinds of
  // its own for THINGS), finishes (where the last blow puts him and what it
  // does: [{ name, spot, yaw, clip, marks: { name: fn } }]), knockables()
  // (what stands in the floor he can be knocked into), onInto(hit, dir) (what
  // his back into it does: a clip name), onBump, gift(why) (someone slides
  // me a thing), lane (the open line down the room) }; who = { name (his
  // bar), manners (his table by manner, brain.js MANNERS by default) }.
  start({ opponent, manner = 'measured', hp = null, room = {}, who = {}, rng, lesson = false, retry = false, myHp = null, onRetry = null, onKO = null, onGlass = null, onLanded = null, onManner = null, onBottle = null, onHop = null }) {
    const G = this.game;
    // ([C4] a fight begun over one still on - a beat jumped to - starts
    // with no card of the last one left up: the lesson's stayed into round 1)
    if (!retry && this.active && this._cards) this._cards.clear();
    this.active = true;
    this.finished = false;
    this.done = false;
    this.fadeBack = 0;
    if (!retry) { this.stats = freshStats(); this.blackT = 0; this.did = {}; this.cueDowns = 0; this.reteach = false; this.lastHurt = null; this.lastCue = null; }
    // ([C4] no cue carried over; the world at its own speed)
    if (this.cue) this.cue.end('gone');
    this.cue = null; G.worldK = 1;
    if (this.warned) { this.warned = false; G.hud.warn(null); }
    // ([B8] this life's start: how hard it pounded his guard is read at a down)
    this.stats.life = { t: this.stats.time, b: this.stats.myBlocked };
    this.opts = { onRetry, onKO, onGlass, onLanded, onManner, onBottle, onHop };
    // ([B8] a thing of his still in the air when I went down falls where it is)
    if (this.flying && this.flying.length) this.dropFlying();
    if (this.room && this.room !== room && this.room.leave) this.room.leave();
    this.room = room;
    if (room.enter) room.enter();
    this.who = { name: 'MACK', ...who };
    this.manners = this.who.manners || MANNERS;
    ACTIVE = { ...THINGS, ...(room.things || {}) };
    // (the fight stays in the room: the controller keeps my eye inside its walls)
    G.controller.brawlBounds = room.bounds || null;
    // (the room's pieces: a disc on its rim lies down, and a rolling one
    // bounces off the walls - Breakables' PieceField)
    if (G.stage.breakables) G.stage.breakables.rimFix = true;
    this.rng = rng;
    this.c = opponent;
    this.max = this.who.hp || BRAWL.himHp;
    const h0 = hp ?? BRAWL.manners[manner] * this.max / 100;
    this.him = {
      // (the percent rounded: 65 % of 116 read back as 65.00000000000001, his
      // measured manner - a retry in his dirty one, a jump to round 2, put
      // him back in his first at the top of it)
      hp: h0, manner: mannerOf(+(h0 * 100 / this.max).toFixed(6)), state: 'move', clip: null, h: null, t: 0,
      next: 1.0, circle: 1, circleT: 1, backT: 0, vel: V(0, 0, 0), speed: 0, yawRate: 0,
      holding: null, prop: null, task: null, pending: null, want: null, spot: null, atSpot: false, quietT: 0, loco: null, locoT: 0,
      hadBottle: false, hadStool: false, throws: 0, acts: 0, thingActs: 0, mannerT: 0,
      // the guard (§3): each side's time left down, by cause
      open: { L: 0, R: 0 }, missT: 0, coverT: 0, breatheT: 0, hang: null, hangT: 0, taunt: null, wasOpen: { L: false, R: false },
      aim: null, strikeAt: 0, hit: false, blockedHards: [], combo: 0, lastHitT: -9, ov: null,
    };
    opponent.hp = h0;
    this.me = { act: 'idle', arm: null, t: 0, holdT: 0, code: null, power: 0, level: 0, h: null, stun: 0, holding: null, stools: 0, buf: null, btns: { Mouse0: null, Mouse2: null }, hopT: 9, hopDir: null, lastHop: -9, lvShown: 0 };
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
    this.cards.health(this.him.hp / this.max, this.who.name, true);
    if (this.him.manner === 'out') this.startReel();
    return this;
  }

  stop() {
    if (!this.active) return;
    // ([C4] the cue, the warning and the black's word go with the fight)
    if (this.cue) this.cue.end('gone');
    this.game.worldK = 1;
    if (this.warned) { this.warned = false; this.game.hud.warn(null); }
    if (this.downWhy) { this.game.hud.kit.failLine(null); this.downWhy = null; if (this.game.hud.setFailing && !this.game.failing) this.game.hud.setFailing(false); }
    this.active = false;
    this.lesson = null;
    const C = this.controller;
    C.slip = 0;
    C.brawlBounds = null;
    if (C.brawlMove) { C.brawlMove.f = 0; C.brawlMove.s = 0; }
    C.brawlHop = null;
    // (whatever is in my hand falls where I stand - it never just vanishes;
    // a thing in the air falls where it is)
    if (this.me && this.me.holding) this.dropMine();
    this.dropFlying();
    if (this._cards) { this._cards.clear(); this._cards.health(null); }
    this.game.hud.clearPrompt('brawl');
    if (this.room && this.room.leave) this.room.leave();
  }

  later(s, fn) { this.timers.push({ at: this.T + s, fn }); }

  // ---- per step: my input (Game.pre, before the hands pose: an input acts
  // on the step it arrives) ------------------------------------------------------------------
  inputStep(dt) {
    if (!this.active || this.blackT > 0) return;
    const me = this.me;
    // ([C4] my own clock: real game time, never slowed by the dodge cue)
    this.RT = (this.RT || 0) + dt;
    if (me.act === 'down' || this.finished) { this.moveKeys(false); return; }
    me.t += dt;
    this.input(dt);
    // [C4] the dodge cue runs on my clock: its window closes in real time
    if (this.cue) this.cue.step(dt);
  }

  // ---- per step (Game.post) ----------------------------------------------------------------
  // [C4] dt: mine (my hands, the cards, the black); wdt: the world's (him,
  // what he throws, his timers) - the same but under the dodge cue
  update(dt, wdt = dt) {
    if (!this.active) return;
    const G = this.game;
    this.T += wdt;
    for (const x of [...this.timers]) if (this.T >= x.at) { this.timers.splice(this.timers.indexOf(x), 1); x.fn(); }
    this.stats.time += wdt;
    G.health.sinceHit = 0;
    if (this._cards) { this._cards.tick(dt); this._cards.health(this.him.hp / this.max, this.who.name); }
    if (this.blackT > 0) {
      this.blackT -= dt;
      G.hud.fade(1);
      // [C4] (the black says in a word what went wrong, in the kit's lettering)
      if (this.downWhy) G.hud.kit.failK(Math.min(1, (this.downBlack - this.blackT) / 0.2) * Math.min(1, this.blackT / 0.25));
      if (this.blackT <= 0) { this.blackT = 0; this.fadeBack = 0.6; if (this.downWhy) { G.hud.kit.failLine(null); this.downWhy = null; } if (G.hud.setFailing && !G.failing) G.hud.setFailing(false); }
      return;
    }
    if (this.fadeBack > 0) { this.fadeBack -= dt; G.hud.fade(Math.max(0, this.fadeBack / 0.6)); }
    if (this.me.act === 'down') { this.stepDown(dt); return; }
    this.stepMe(dt);
    this.stepHim(wdt);
    // ([C4] the fight stopped in his step - the end of the knock-out: nothing
    // more of it this step)
    if (!this.active) return;
    this.stepFlying(wdt);
    this.drawFlying();
    if (this.cue) this.cue.draw(dt);
    if (this.lesson) this.lesson.update(wdt);
    this.drawWind();
    this.drawTicks();
    this.bumps();
    this.lowWarn(dt);
  }

  // ---- my side --------------------------------------------------------------------------------
  // [C4] version 5. Each mouse button is an arm, and each keeps its own
  // record: pressed (age), held (t), let go. EVERY PRESS IS A JAB AT ONCE:
  // the fist starts in the step the press arrives and its contact is 0.06 s
  // later, whatever the press's length (a person's click is 60 to 280 ms;
  // version 4 turned a press held past 0.12 s into the wind-up, and a
  // normal click let go before its first level showed nothing landing). A
  // press that comes while a fist is still out sends that blow home first
  // (its contact is never lost) and jabs. Held on past the jab
  // (BRAWL.hold.start, 0.34 s: the jab has landed and come home), the same
  // fist cocks and loads; let go, the hard punch. A press that arrives while
  // I cannot act (hit, grabbing) waits up to BRAWL.hold.wait and then jabs.
  // What a hand holds is used by that hand's button: in reach a click swings
  // it at once; out of his reach a click throws it; held on, it loads.
  // what I may start now: 'punch' (with `arm`), 'hop', 'block', 'grab'
  can(what, arm = null) {
    const me = this.me, a = me.act, t = me.t;
    void arm;
    if (a === 'idle') return true;
    if (a === 'hurt' || a === 'stagger' || a === 'down' || a === 'grab') return false;
    // ([C4] a press is a jab from anything I do but being hit: from the
    // block, a hop, a jab, a wind-up, a fist bounced off his guard)
    if (what === 'punch') return true;
    if (a === 'block') return what === 'hop';
    if (a === 'hop') return what === 'block' ? t >= BRAWL.hop.blockAt : what === 'hop' ? this.T - me.lastHop >= BRAWL.hop.again && t >= BRAWL.hop.dur : false;
    if (a === 'jab') return t >= 0.06;
    if (a === 'wind' || a === 'cock') return what === 'hop' || what === 'block';
    if (a === 'hard') return t >= 0.18;
    // (a fist bounced off his guard: the feet and the block come back after
    // a moment, a blocked hard punch later than a blocked jab)
    if (a === 'bounce') { const L = BRAWL.bounce[me.bounceKind] || BRAWL.bounce.jab; return t >= L[0]; }
    if (a === 'strike') return what === 'hop' ? me.h && me.h.t >= 0.2 : false;
    return false;
  }

  // a thing in my hands: which button uses it
  bothHands() { const it = this.me.holding; return !!(it && it.hands === 2); }
  handUses(arm) { const it = this.me.holding; return !!(it && (it.hands === 2 || it.hand === arm)); }
  levelOf(holdT) { const L = BRAWL.hold.levels; return holdT >= L[2] ? 3 : holdT >= L[1] ? 2 : holdT >= L[0] ? 1 : 0; }

  moveKeys(on) {
    const M = this.controller.brawlMove || (this.controller.brawlMove = { f: 0, s: 0 });
    if (!on) { M.f = 0; M.s = 0; }
  }

  input(dt) {
    const G = this.game, me = this.me, C = this.controller;
    const M = C.brawlMove || (C.brawlMove = { f: 0, s: 0 });
    const locked = me.act === 'hurt' || me.act === 'stagger';
    // ---- walking: W in; A / D / S held on after a hop keep circling / backing away
    const hopping = C.brawlHop && C.brawlHop.t < C.brawlHop.dur;
    M.f = locked || hopping ? 0 : (G.held('KeyW') ? 1 : 0) - (G.held('KeyS') && me.lastHopKey === 'KeyS' && this.T - me.lastHop > 0.12 ? 1 : 0);
    const circle = (k) => G.held(k) && me.lastHopKey === k && this.T - me.lastHop > 0.12;
    M.s = locked || hopping ? 0 : (circle('KeyD') ? 1 : 0) - (circle('KeyA') ? 1 : 0);
    if (me.act === 'wind' || me.act === 'block') { M.f *= 0.5; M.s *= 0.5; }
    if (Math.abs(M.f) + Math.abs(M.s) > 0) { me.moved = (me.moved || 0) + dt * 1.9; this.did.move = me.moved > 1; }
    // ---- the buttons: a record each (age since the press, time held, down)
    const Bt = me.btns;
    for (const code of ['Mouse0', 'Mouse2']) {
      if (G.pressed(code)) {
        { const st = this.stamps[code], now = typeof performance !== 'undefined' ? performance.now() : 0; Bt[code] = { age: 0, t: 0, down: G.held(code) && !G.released(code), used: false, at: this.RT, stamp: st && now - st.down < 400 ? st : null }; } this.stats.presses = (this.stats.presses || 0) + 1; this.lastInputT = this.RT; this.inputN = (this.inputN || 0) + 1;
        this.stats.input.length < 400 && this.stats.input.push([+this.T.toFixed(3), code, me.act]);
        continue;
      }
      const b = Bt[code];
      if (!b) continue;
      b.age += dt;
      if (b.down) { if (G.held(code) && !G.released(code)) b.t = b.stamp ? this.heldFor(b) : b.t + dt; else b.down = false; }
    }
    // the keys: the newest kept 0.15 s if it cannot act yet
    for (const code of ['KeyA', 'KeyD', 'KeyS', 'KeyE']) {
      if (G.pressed(code)) { me.buf = { code, t: 0 }; this.lastInputT = this.RT; this.inputN = (this.inputN || 0) + 1; this.stats.input.length < 400 && this.stats.input.push([+this.T.toFixed(3), code, me.act]); }
    }
    if (me.buf) { if (me.buf.t > BRAWL.buffer) me.buf = null; else me.buf.t += dt; }
    // ---- the wind-up: it loads while held; let go, the blow
    if (me.act === 'wind') {
      const b = Bt[me.code];
      if (b && b.down) me.holdT = b.t - (me.holdOff || 0);
      if (me.h && me.h.t > 1.08) me.h.t = 0.48;   // (the tremble, round again)
      if (!b || !b.down) {
        const lv = this.levelOf(me.holdT);
        this.stats.input.length < 400 && this.stats.input.push([+this.T.toFixed(3), 'release' + me.arm, lv]);
        if (me.windThing) this.strike(true, Math.max(1, lv));
        else if (lv >= 1) this.hard(me.arm, lv);
        else { me.act = 'idle'; me.t = 0; me.h = this.hands.play(this.restClip()); }
        return;
      }
    }
    // ---- [C4] a thing drawn back to throw (he is out of reach): let go, it flies
    if (me.act === 'cock') {
      const b = Bt[me.code];
      if (!b || !b.down) { this.strike(true, Math.max(1, this.levelOf(b ? b.t : 0))); return; }
      if (b.t >= BRAWL.hold.start) { b.wound = true; this.wind(me.arm, me.code, b.t, true); return; }
    }
    // ---- [C4] the jab home (or a bounced fist, or a thing swung) and its
    // button still held past hold.start: the same fist cocks and loads
    if ((me.act === 'jab' || me.act === 'bounce' || me.act === 'strike') && me.code) {
      const b = Bt[me.code];
      const bl = me.act === 'bounce' ? (BRAWL.bounce[me.bounceKind] || BRAWL.bounce.jab)[0] : 0;
      const swung = me.act !== 'strike' || (me.h && (me.h.done || me.h.t >= Math.min(me.h.duration, 0.26)));
      if (b && b.down && !b.wound && b.t >= BRAWL.hold.start && me.t >= bl && swung) {
        b.wound = true;
        if (me.holding && this.handUses(me.arm)) this.wind(me.arm, me.code, b.t, true);
        else this.wind(me.arm, me.code, b.t);
        return;
      }
    }
    // ---- the presses: the newest first. [C4] Every press jabs at once - from
    // the block, a hop, the other fist's wind-up, a fist still out; only a
    // blow that has me reeling holds it (then it jabs, up to hold.wait later)
    const order = ['Mouse0', 'Mouse2'].filter((c) => Bt[c] && !Bt[c].used).sort((a, b) => Bt[a].age - Bt[b].age);
    for (const code of order) {
      const b = Bt[code];
      if (b.age > BRAWL.hold.wait) { b.used = true; continue; }
      const arm = code === 'Mouse0' ? 'L' : 'R';
      if (!this.can('punch', arm)) continue;
      b.used = true;
      // (a blow of mine still on its way lands first: its contact is never lost)
      this.flushContact();
      if (this.cue) this.cue.act('punch');
      if (this.handUses(arm)) {
        // (a thing in this hand: in reach it is swung at once; out of his
        // reach it is drawn back to throw, and goes when the button comes up)
        const T = THINGS_OF(me.holding);
        const tgt = this.onTarget(BRAWL.itemReach + (T.big ? 0.2 : 0) + (T.reach || 0) + 0.25);
        this.cock(arm, code);
        if (!(T.throw && !tgt.ok)) this.strike(false, T.level);
        return;
      }
      this.jab(arm, code);
      return;
    }
    if (locked) return;
    // ---- SPACE held: the block (up in 0.05, down in 0.08)
    const space = G.held('Space');
    if (space && me.act !== 'block' && this.can('block')) { if (this.cue) this.cue.act('block'); this.block(true); return; }
    if (!space && me.act === 'block') this.block(false);
    // ---- the keys: a hop, E
    const k = me.buf;
    if (k && (k.code === 'KeyA' || k.code === 'KeyD' || k.code === 'KeyS')) {
      // ([C4] the cue held for the lesson's first dodge: only the key toward
      // the light lets time go; the other is not taken)
      if (this.cue && this.cue.refuse(k.code)) { me.buf = null; return; }
      if (this.can('hop')) { me.buf = null; this.hop(k.code); }
      return;
    }
    if (k && k.code === 'KeyE') {
      if (me.act === 'idle' && !me.holding) { me.buf = null; const it = this.reachable(); if (it) { if (this.cue) this.cue.act('grab'); this.grab(it); } }
      return;
    }
    // ---- a button still held from a press a blow took me out of: wind again
    if (me.act === 'idle') {
      for (const code of ['Mouse0', 'Mouse2']) {
        const b = Bt[code], arm = code === 'Mouse0' ? 'L' : 'R';
        if (b && b.used && b.down && b.t >= BRAWL.hold.start && me.rewind !== b) { me.rewind = b; b.wound = true; if (this.handUses(arm)) this.wind(arm, code, BRAWL.hold.start, true); else this.wind(arm, code, BRAWL.hold.start); return; }
      }
    }
  }

  // [C4] a blow of mine whose contact has not come yet, sent home now (a new
  // press cuts its clip short: the hands play one clip at a time)
  flushContact() {
    const h = this.me.h;
    if (!h || h.done || !h.onMark || !h.marks) return;
    const name = h.marks.contact != null ? 'contact' : h.marks.release != null ? 'release' : null;
    if (!name || h.fired.has(name)) return;
    h.fired.add(name);
    if (h.onMark[name]) h.onMark[name](name);
  }

  cancelArm() { const me = this.me; if (me.act === 'wind' || me.act === 'jab' || me.act === 'cock') { me.act = 'idle'; me.arm = null; me.windThing = false; } }

  block(on) {
    const me = this.me;
    if (on) { this.cancelArm(); me.act = 'block'; me.t = 0; me.h = this.hands.play(this.bothHands() ? 'blockBig' : 'block'); this.did.blockUp = true; }
    else { me.act = 'idle'; me.t = 0; me.h = this.hands.play(this.restClip()); }
  }
  // the hands at rest: the guard, or the guard with a thing in them
  restClip() { const it = this.me.holding; return it && it.hands === 2 ? 'guardBig' : 'guard'; }

  // a hop: 0.55 m aside (A / D) or 0.6 m back (S) in 0.10 s
  hop(code) {
    const me = this.me, C = this.controller, H = BRAWL.hop;
    // ([C4] the dodge cue up: this is its answer - toward the light, a slip)
    if (this.cue) this.cue.act('hop', code);
    this.cancelArm();
    const fy = C.faceYaw ?? C.yaw;
    const fx = -Math.sin(fy), fz = -Math.cos(fy), rx = Math.cos(fy), rz = -Math.sin(fy);
    let dx, dz, dist, clip;
    if (code === 'KeyS') { dx = -fx; dz = -fz; dist = H.back; clip = 'hopB'; }
    else { const s = code === 'KeyD' ? 1 : -1; dx = rx * s; dz = rz * s; dist = H.side; clip = s > 0 ? 'hopR' : 'hopL'; }
    C.brawlHop = { x: dx, z: dz, dist, dur: H.dur, t: 0, done: 0 };
    me.act = 'hop'; me.t = 0; me.lastHop = this.T; me.lastHopKey = code; me.hopDir = code;
    me.h = this.hands.play(this.bothHands() ? clip + 'Big' : clip);
    this.sfx('scuff', null, { k: 0.8 });
    this.did[code === 'KeyS' ? 'hopB' : code === 'KeyD' ? 'hopR' : 'hopL'] = true;
    if (this.opts.onHop) this.opts.onHop(code);
  }

  jab(arm, code) {
    const me = this.me;
    me.act = 'jab'; me.arm = arm; me.code = code; me.t = 0; me.holdT = 0; me.windThing = false;
    // ([C4] each press and its contact on my clock: the click play reads them)
    const b = me.btns[code], rec = [code, +((b && b.at != null ? b.at : this.RT) || 0).toFixed(3), +(this.RT || 0).toFixed(3), null];
    const C = this.stats.clicks || (this.stats.clicks = []);
    if (C.length < 2000) C.push(rec);
    me.h = this.hands.play(arm === 'L' ? 'jabL' : 'jabR', { onMark: { contact: () => { rec[3] = +(this.RT || 0).toFixed(3); this.myContact('jab', arm, 0); } } });
    this.stats.jabs++;
  }
  // the wind-up: the fist draws back further and further and trembles; the
  // view leans back; three ticks at the fist as it loads, a flash at full
  // (drawWind). holdT: how long the button has been held already.
  wind(arm, code, holdT = BRAWL.hold.min, thing = false) {
    const me = this.me, H = this.hands;
    me.act = 'wind'; me.arm = arm; me.code = code; me.t = 0; me.holdT = Math.max(BRAWL.hold.min, holdT); me.windThing = thing && !!me.holding; me.lvShown = 0;
    // (the load counts the button's own time held; a wind-up begun again
    // after a blow counts from its new start)
    const bt = this.me.btns[code]; me.holdOff = bt ? bt.t - me.holdT : 0;
    const it = me.windThing ? me.holding : null;
    // ([C4] the fist cocked up by the jaw, in the frame under his face, not down
    // in the corner: player/clips/c4.js)
    const clip = it ? (THINGS_OF(it).big ? 'windBig' : 'windItem' + (it.hand === 'L' ? 'L' : '')) : arm === 'L' ? 'c4windL' : 'c4windR';
    me.h = H.play(clip);
    // (a hold already under way: the draw-back picks up where the hold is)
    me.h.t = Math.min(0.48, me.holdT - BRAWL.hold.min);
    this.stats.input.length < 400 && this.stats.input.push([+this.T.toFixed(3), 'wind' + arm, +me.holdT.toFixed(2)]);
    this.sfx('wind', null, {});
    this.stats.winds = (this.stats.winds || 0) + 1;   // [C4]
  }
  // the hard punch, by its level (1..3): the lunge, the burst, the hit stop,
  // how far he goes back, the bite out of his bar all grow with it
  hard(arm, lv) {
    const me = this.me;
    me.act = 'hard'; me.arm = arm; me.level = lv; me.power = lv / 3; me.t = 0; me.windThing = false;
    me.h = this.hands.play((arm === 'L' ? 'c4hardL' : 'c4hardR') + lv, { onMark: { contact: () => this.myContact('hard', arm, lv) } });
    this.stats.hards++;
    const S = this.stats.levels || (this.stats.levels = [0, 0, 0]); S[lv - 1]++;
    this.sfx('whiff', null, { k: 0.35 + 0.2 * lv });
  }
  // a thing drawn back in its hand (the press of that hand's button)
  cock(arm, code) {
    const me = this.me, it = me.holding;
    me.act = 'cock'; me.arm = it && it.hands === 2 ? 'R' : arm; me.code = code; me.t = 0;
    me.h = this.hands.play(THINGS_OF(it).big ? 'windBig' : 'windItem' + (it.hand === 'L' ? 'L' : ''));
  }
  // with something in my hand: a click strikes with it; a wind-up smashes it
  // (a stool, a chair) or throws it (a bottle, a plate, a mug); lv: its level
  strike(wound, lv) {
    const me = this.me, it = me.holding, H = this.hands;
    me.windThing = false;
    if (!it) { me.act = 'idle'; return; }
    const T = THINGS_OF(it), side = it.hands === 2 ? '' : it.hand === 'L' ? 'L' : '';
    me.act = 'strike'; me.arm = it.hands === 2 ? 'R' : it.hand; me.level = lv; me.power = lv / 3; me.t = 0;
    if (wound && T.throw) {
      me.h = H.play('throwItem' + side, { onMark: { release: () => this.throwHeld(lv) } });
      return;
    }
    const clip = T.big ? (wound ? 'swingBig' : 'swingStool') : it.kind === 'plate' || it.kind === 'mug' ? 'swingPlate' + side : wound ? 'smashItem' + side : 'swingBottle' + side;
    me.h = H.play(clip, { onMark: { contact: () => this.myContact('item', me.arm, lv) } });
    this.sfx('whiff', null, { k: T.big ? 1 : 0.7 });
  }

  grab(it) {
    const me = this.me, H = this.hands;
    const T = THINGS_OF(it);
    // (a small thing into the hand on its side of the frame; a stool or a
    // chair in both, its weight on the right)
    let hand = 'R';
    if (T.hands !== 2) {
      const p = it.pos || it.object.getWorldPosition(_c);
      const s = this.game.screenOf(p);
      hand = s && s.x < innerWidth / 2 ? 'L' : 'R';
    }
    me.act = 'grab'; me.t = 0;
    me.h = H.play(T.hands === 2 ? 'grab' : hand === 'L' ? 'grabL' : 'grab', { onMark: { taken: () => {
      const o = it.take ? it.take() : it.object;
      if (!o) return;
      if (it.kind === 'stool') me.stools++;
      // (a café chair has no grip of its own: taken by the top of its back)
      if (it.kind === 'chair' && !o.userData.grip) o.userData.grip = new THREE.Matrix4().makeTranslation(0.12, 0.95, -0.19);
      me.holding = { kind: it.kind, object: o, name: it.name, uses: T.uses, hand, hands: T.hands };
      H.hold(o, hand);
      this.sfx('grab_' + (it.kind === 'chair' ? 'stool' : it.kind === 'mug' ? 'plate' : it.kind), null, {});
      this.did.grab = true;
      this.stats.held = this.stats.held || [];
      this.stats.held.push(it.kind + hand);
    } } });
    this.stats.grabs++;
  }

  stepMe(dt) {
    const me = this.me, H = this.hands;
    if (me.act === 'stagger' || me.act === 'hurt') {
      me.stun -= dt;
      if (me.stun <= 0) { me.act = 'idle'; me.t = 0; me.h = H.play(this.restClip()); }
      return;
    }
    if (me.act === 'hop' && me.t >= BRAWL.hop.dur + 0.05 && (!me.h || me.h.done || me.h.t >= me.h.duration)) { me.act = 'idle'; me.t = 0; me.h = H.play(this.restClip()); return; }
    if ((me.act === 'jab' || me.act === 'hard' || me.act === 'bounce' || me.act === 'grab' || me.act === 'strike') && (!me.h || me.h.done || me.h.t >= me.h.duration)) {
      // (a jab whose button is still held becomes the wind-up in input())
      if (me.act === 'jab' && me.code && me.btns[me.code] && me.btns[me.code].down) return;
      me.act = 'idle'; me.arm = null; me.t = 0;
      me.h = H.play(this.restClip());
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
    if (him.state === 'stun' || him.state === 'reel' || him.state === 'comeRound') return true;
    // [B8] (going for a thing he keeps his guard up; only the reach and the
    // take itself open him - version 3 left him open all the way, and a
    // quick hand beat him to every errand: a round went by without a blow)
    if (him.state === 'arm') return !!(him.task && him.task.phase === 'take') || !him.task;
    if (him.coverT > 0) return false;
    if (him.open[s] > 0) return true;
    // (the lesson: he holds a hand down and waits)
    if (him.taunt && him.state === 'move' && him.taunt.includes(s)) return true;
    if (him.state === 'attack') {
      if (him.clip === 'br_bottle') return true;
      // [B8] (his answer comes straight from behind his guard: nothing opens,
      // and a jab does not stop it - pounding his guard is paid for)
      if (BR_ATTACKS[him.clip] && BR_ATTACKS[him.clip].answer) return false;
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
    const depth = { jab: 0.66, hard: 0.7, follow: 0.74, block: 0.6, bounce: 0.44 }[kind] ?? 0.66;
    const K = dir.clone().multiplyScalar(depth / Math.max(0.3, -dir.z));
    if (kind === 'bounce') { K.y += 0.05; K.x += sgn * 0.04; }
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

  // my blow arrives. kind 'jab' | 'hard' (lv 1..3) | 'item' (lv: its wind-up)
  myContact(kind, arm, lv) {
    const G = this.game, him = this.him, c = this.c, me = this.me;
    if (!this.active || this.finished) return;
    if (kind === 'hard' && lv >= 2) me.loadedT = this.T;   // [R2-H] the last time I loaded a punch (the finish card reads it)
    const item = kind === 'item' ? me.holding : null;
    const T = item ? THINGS_OF(item) : null;
    const tgt = this.onTarget(item ? BRAWL.itemReach + (T.big ? 0.2 : 0) + (T.reach || 0) : BRAWL.reach);   // ([R2-E] a thing's own reach: the chain)
    const head = _a.setFromMatrixPosition(c.bones.head.matrixWorld).clone();
    const dir = _b.set(c.pos.x - G.eye.x, 0, c.pos.z - G.eye.z).normalize().clone();
    // (the level of the blow's feel: a jab its own; a thing by what it is)
    const lvF = kind === 'jab' ? 'jab' : item ? Math.max(T.level, Math.min(3, lv)) : lv;
    this.stats.input.length < 400 && this.stats.input.push([+this.T.toFixed(3), 'contact:' + kind + arm + (lv || ''), tgt.ok ? this.openSides() : 'air']);
    if (!tgt.ok || him.state === 'ko') {
      // a miss: a whiff of air, nothing else
      if (kind === 'jab') { this.stats.jabAir = (this.stats.jabAir || 0) + 1; this.stats.lastAir = { d: +tgt.d.toFixed(2), ang: +tgt.ang.toFixed(2), st: him.state }; }
      this.sfx('whiff', null, { k: kind === 'jab' ? 0.5 : 0.9 });
      G.emit('brawl:hit', { by: 'me', kind, power: lv, zone: 'air', arm });
      // ([B8] a thing swung at the air is still in the hand: it breaks on
      // him, on his guard, or goes on the floor when it is let go)
      return;
    }
    const L = this.lesson;
    // out on his feet: jabs make him sway; a hard punch of the second level
    // or more, or a thing, is the last
    if (him.state === 'reel') {
      const last = (kind === 'hard' && lv >= 2) || !!item;
      if (last && him.atSpot) { if (item) this.spendHeld(head, dir); this.ko(); return; }
      if (item) this.spendHeld(head, dir);
      him.quietT = 0;
      // ([R2-H] a swaying man that is only jabbed: six in a row and the card comes again)
      if (him.atSpot && (him.reelHits = (him.reelHits || 0) + 1) >= 6) { him.reelHits = 0; him.nagT = this.T + 4; }
      if (him.atSpot) { this.c.play('br_sway', { fade: 0.06 }); him.swayT = 0.8; }
      this.feel(kind === 'jab' ? 'jab' : 1, head, dir);
      this.sfx(kind === 'jab' ? 'jab' : 'heavy', head, { k: 0.5 });
      G.emit('brawl:hit', { by: 'me', kind, power: lv, zone: 'head', arm });
      return;
    }
    const side = arm, openBefore = this.openSides();
    const breaks = !!(item && T.breaksGuard);
    const open = this.sideOpen(side) || breaks;
    if (!open) {
      // ---- a full-power punch into his raised guard breaks it on its own:
      // his arms knocked apart, open on both sides for a second
      if (kind === 'hard' && lv >= 3) {
        this.stats.fullBreaks = (this.stats.fullBreaks || 0) + 1;
        this.did.fullBreak = true;
        const at = head.clone().addScaledVector(dir, -0.2).add(V(0, -0.1, 0));
        this.sfx('blocked', at, { k: 1 });
        this.sfx('heavy', at, { k: 0.55 });
        G.fx.hit.puff(at, dir);
        G.hitStop = Math.max(G.hitStop || 0, 3);
        if (this.controller.kick) this.controller.kick(1.4, 1.6, BRAWL.kick.dur);
        const sp = G.screenOf(at); if (sp) this.cards.burst(sp, 130, this.stats.landed + 7);
        this.breakGuard();
        if (L) L.onMyBlow(kind, arm, lv, 'broke');
        G.emit('brawl:hit', { by: 'me', kind, power: lv, zone: 'broke', arm });
        return;
      }
      // ---- into his guard: a dull knock, grey dust at the forearm, my fist
      // bounces back; no damage, no hit stop; the beat is wasted, and he
      // answers
      this.stats.myBlocked++;
      this.did['blocked' + (kind === 'hard' ? 'Hard' : '')] = true;
      if (L) L.onMyBlow(kind, arm, lv, 'blocked');
      const at = head.clone().addScaledVector(dir, -0.22).add(V(0, -0.12, 0));
      this.sfx('blocked', at, { k: kind === 'jab' ? 0.7 : 1 });
      G.fx.hit.puff(at, dir);
      G.emit('brawl:hit', { by: 'me', kind, power: lv, zone: 'guard', arm });
      if (item) { this.spendHeld(head, dir); me.bounceKind = 'item'; }
      else { me.act = 'bounce'; me.t = 0; me.bounceKind = kind === 'jab' ? 'jab' : 'hard'; me.h = this.hands.play(arm === 'L' ? 'bounceL' : 'bounceR'); }
      // three hard ones in 4 s break it
      if (kind === 'hard') {
        him.blockedHards = him.blockedHards.filter((x) => this.T - x < BRAWL.guardBreak.within);
        him.blockedHards.push(this.T);
        if (him.blockedHards.length >= BRAWL.guardBreak.n) { this.breakGuard(); return; }
      }
      this.answer(side);
      return;
    }
    // ---- it lands
    let dmg = kind === 'jab' ? BRAWL.mine.jab : kind === 'hard' ? BRAWL.mine.hard[lv - 1] : T.dmg;
    const inTell = him.state === 'attack' && him.clip && him.t < him.strikeAt;
    const counter = inTell && !/^br_feint/.test(him.clip);
    // ([B8] a jab into his tell stops only a straight; a hard punch or a
    // thing stops any blow that stops at all - a masher's jabs do not buy
    // him out of a hook)
    const stops = counter && (kind !== 'jab' ? STOPS.test(him.clip) || /^br_(haymaker|haymakerL)$/.test(him.clip) && lv >= 3 : JAB_STOPS.test(him.clip));
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
    { const why = item ? 'thing' : counter ? 'counter' : him.state === 'stun' || him.state === 'knock' ? 'stun' : him.state === 'attack' ? 'hisSwing' : (him.why && him.why[side]) || (him.taunt ? 'lesson' : him.state); const D = this.stats.dmgBy || (this.stats.dmgBy = {}); D[why] = +((D[why] || 0) + dmg).toFixed(1); }
    this.stats.landed++;
    // (the side he was hit on stays open through the chain)
    if (him.combo < 3) this.lower(openBefore || side, BRAWL.comboGap * 0.8);
    if (kind === 'jab') this.did['jab' + arm] = true;
    if (kind === 'hard' && lv >= 2) this.did.hard = true;
    if (item) this.did['thing' + (item.hands === 2 ? 'Big' : item.hand)] = true;
    if (L) L.onMyBlow(kind, arm, lv, 'landed');
    G.emit('brawl:hit', { by: 'me', kind, power: lv, zone: 'head', arm, counter, combo: him.combo, thing: item ? item.kind : null });
    if (item) this.spendHeld(head, dir);
    const heavy = kind !== 'jab';
    this.feel(lvF, head, dir);
    this.sfx(kind === 'jab' ? 'jab' : 'heavy', head, { k: heavy ? 0.5 + 0.17 * (lvF === 'jab' ? 0 : lvF) : 0.55 });
    if (heavy) this.sfx('hisGrunt', head, { k: 0.6 + 0.13 * lvF });
    if (this.pct(him.hp) <= BRAWL.manners.out && him.state !== 'reel') { this.startReel(dir); return; }
    if (him.state === 'knock' || him.state === 'into') return;
    // [R2-E] hit on the arm that holds his weapon while he winds up (his
    // blow's `drops`: the foreman's hook): it goes out of his fist
    { const A = counter && BR_ATTACKS[him.clip]; if (A && A.drops && him.holding === A.drops && side === OPENS(A)) { this.disarm(dir); return; } }
    // (my left fist lands on his right: his head goes to his left)
    if (!heavy) {
      if (him.state === 'attack' && !stops) return;
      if (him.combo >= 4) { this.coverUp(); return; }
      if (him.combo === 3) { this.knock(dir, BRAWL.comboKnock, arm === 'L' ? 'br_snapR' : 'br_snapL'); return; }
      this.react(arm === 'L' ? 'br_hitHeadR' : 'br_hitHeadL');
      return;
    }
    // a hard one (or a thing) on an open side: bent, driven back, stunned -
    // as far and as long as its level
    const F = BRAWL.feelOf[lvF];
    const stun = him.combo <= 2 && F.stun > 0;
    if (stun) this.lower('LR', F.stun, 'stun'); else { him.open.L = him.open.R = 0; him.coverT = BRAWL.coverUp; him.combo = 0; }
    this.knock(dir, F.knock, arm === 'L' ? 'br_snapR' : 'br_snapL', stun);
    if (breaks) { this.did.stoolHit = true; this.lower('LR', Math.max(F.stun, BRAWL.guardBreak.open), 'break'); }
  }

  // [B8] his answer to a punch into his guard (§3): about three times in
  // four, at once, from the side that blocked - a 0.2 s tell and a fast
  // straight - while I am still coming back. A hop or SPACE gets me out if I
  // am quick. (The lesson's guard step shows it once, slowed.)
  answer(side) {
    const him = this.him, L = this.lesson;
    const lessonOK = L && L.step === 3 && !L.answered;
    if (this.lessonHold && !lessonOK) return;
    // (my left fist into his right side: his right hand answers; pounded
    // three times in a second and a half, he answers with a hook)
    him.pounded = (him.pounded || []).filter((x) => this.T - x < 1.5); him.pounded.push(this.T);
    if (him.state !== 'move' || him.task || this.finished) return;
    // [C4] (pounded - three punches into it in a second and a half - he
    // answers every time, and with the fast straight, not a hook: a hook
    // now comes with the dodge cue, and a masher who slipped it was handed
    // the opening; the straight is told by his body alone)
    const pounded = !lessonOK && him.pounded.length >= 3;
    if (!lessonOK && !pounded && !this.rng.chance(BRAWL.answer)) return;
    const clip = side === 'L' ? 'br_answerR' : 'br_answerL';
    this.later(0.03, () => {
      if (!this.active || this.finished || this.him.state !== 'move' || this.me.act === 'down') return;
      this.hisAttack(clip, { slow: lessonOK ? 0.5 : 0 });
      this.stats.answers = (this.stats.answers || 0) + 1;
      if (lessonOK) L.answered = true;
    });
  }

  // [R2-E] his weapon knocked out of his fist (the foreman's hook): it falls
  // (the room takes it: a thing in reach), his blow is spoilt, his hand
  // shaken out, that side open a moment
  disarm(dir) {
    const him = this.him;
    this.dropHisProp();
    him.holding = null; him.prop = null;
    this.stats.disarms = (this.stats.disarms || 0) + 1;
    this.did.disarm = true;
    this.sfx('blocked', null, { k: 1 });
    this.hisState('react', this.c.clip && CLIP_OK(this.c, 'fm_disarmed') ? 'fm_disarmed' : 'br_hitHeadR', 0.05);
    this.lower('L', 0.7, 'disarm');
    him.next = Math.max(him.next, 0.7);
    him.pending = null;
    this.game.emit('brawl:disarm', {});
    void dir;
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
  // comes apart on him (its pieces fall, bounce and lie still). Whatever
  // hand it was in.
  spendHeld(at, dir) {
    const me = this.me, G = this.game, H = this.hands;
    const it = me.holding;
    if (!it) return;
    const B = G.stage.breakables;
    const hand = it.hand || 'R';
    const o = H.hold(null, hand, { keep: true });
    const where = at ? at.clone().addScaledVector(dir, -0.25) : G.eye.clone().addScaledVector(dir, 1.1).setY(G.eye.y - 0.35);
    const T = THINGS_OF(it);
    if (T.then === 'neck' && o) {
      // (broken on him: the neck stays in my fist)
      const g = new THREE.Group();
      g.position.copy(where); G.stage.scene.add(g); g.updateMatrixWorld(true);
      g.add(o); o.position.set(0, 0, 0); o.quaternion.identity(); o.scale.setScalar(1); o.updateMatrixWorld(true);
      const hnd = B.add(o, { kind: 'bottle', hp: 1, solid: false });
      B.hit(hnd, { point: where.clone(), dir: dir.clone(), power: 9, by: 'body', neck: true });
      const neck = g.children.find((x) => x.userData && x.userData.kind === 'bottleNeck');
      if (neck) { g.remove(neck); neck.visible = true; me.holding = { kind: 'neck', object: neck, uses: THINGS_OF({ kind: 'neck' }).uses, hand, hands: 1 }; H.hold(neck, hand); return; }
      me.holding = null;
      return;
    }
    if (it.uses > 1) { it.uses--; H.hold(o, hand); return; }
    me.holding = null;
    if (o) this.breakInWorld(o, it.kind, where, dir);
    // (the hands free again: back to the fists' guard)
  }

  // a wound-up throw: it flies where I look, on an arc; on him within 6 m
  // and the cone it hits him (by its level), else it lands and breaks
  throwHeld(lv) {
    const me = this.me, G = this.game, it = me.holding;
    if (!it) return;
    const T = THINGS_OF(it);
    const tgt = this.onTarget(6);
    const C = this.controller;
    const look = V(-Math.sin(C.yaw), 0, -Math.cos(C.yaw));
    const c = this.c;
    const d = tgt.ok ? tgt.d : 4;
    const hand = it.hand || 'R';
    const o = this.hands.hold(null, hand, { keep: true });
    me.holding = null;
    if (!o) return;
    const from = G.eye.clone().addScaledVector(look, 0.4).add(V(hand === 'L' ? -0.15 : 0.15, -0.2, 0));
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
        if (!open && this.him.state === 'move') { this.sfx('blocked', head, { k: 1 }); G.fx.hit.puff(head, dir); return; }   // (his guard stops a bottle or a plate)
        const dmg = T.dmg * (lv >= 3 ? 1.15 : 1) * (this.him.missT > 0 ? BRAWL.missOpen : 1);
        this.damageHim(dmg);
        this.stats.landed++;
        const D = this.stats.dmgBy || (this.stats.dmgBy = {}); D.thrown = +((D.thrown || 0) + dmg).toFixed(1);
        this.feel(2, head, dir);
        this.sfx('heavy', head, { k: 0.8 });
        if (this.him.state === 'reel' && this.him.atSpot) { this.ko(); return; }
        if (this.pct(this.him.hp) <= BRAWL.manners.out && this.him.state !== 'reel') { this.startReel(); return; }
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
    // ([R2-E] a room's own thing spent: the room says what it becomes - the
    // pier's hook sticks in a crate, its lid splits, its lantern burns)
    if (this.room && this.room.spent && this.room.spent(kind, o, at, dir, this)) return;
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

  // what is in my hands, let go (hit hard, knocked down, the fight over)
  dropMine() {
    const me = this.me;
    if (!me.holding) return;
    const it = me.holding;
    me.holding = null;
    const hand = it.hand || 'R';
    const o = this.hands.held[hand];
    if (!o) return;
    this.hands.vm.root.updateMatrixWorld(true);
    o.updateMatrixWorld(true);
    const at = o.getWorldPosition(V(0, 0, 0));
    const q = o.getWorldQuaternion(new THREE.Quaternion());
    this.hands.hold(null, hand, { keep: true });
    o.quaternion.copy(q);
    this.dropInWorld(o, it.kind, at, null, 0.2);
  }

  // the hit feel (§5), by the blow's level ('jab', 1..3): the hit stop, the
  // view's kick and push-in, the white ink burst sized in pixels
  feel(lv, head, dir) {
    const G = this.game, F = BRAWL.feelOf[lv] || BRAWL.feelOf[2];
    G.hitStop = Math.max(G.hitStop || 0, F.stop);
    if (this.controller.kick) this.controller.kick(F.kick[0], F.kick[1], BRAWL.kick.dur);
    const px = F.burst;
    // (at the point of contact as the eye sees it: on the ray to his jaw, at
    // the fist's depth, drawn in the hands' pass over the fist that lands)
    const jaw = head.clone().addScaledVector(dir, -0.1);
    const ray = jaw.clone().sub(G.eye).normalize();
    const at = G.eye.clone().addScaledVector(ray, Math.max(0.5, G.eye.distanceTo(jaw) - 0.18));
    // (the burst is inked on the frame over the fist - the flash sprites
    // printed as a few soft dots behind his head; the sweat flies in the room)
    const k = lv === 'jab' ? 0 : (lv - 1) / 2;
    G.fx.hit.punch(at, dir.clone(), lv === 'jab' ? 0.3 : 0.5 + 0.5 * k, { px, camera: G.camera, from: jaw, noBurst: true });
    const sp = G.screenOf(jaw);
    if (sp) this.cards.burst(sp, px, this.stats.landed + 1);
  }

  damageHim(n) {
    const him = this.him;
    n *= BRAWL.tough;
    // [B8] (a manner holds a while: for its first `hold` seconds a run of
    // blows takes him no further than the edge of the next - a burst does
    // not skip his dirty or his wild fight)
    const order = BRAWL.order, next = order[order.indexOf(him.manner) + 1];
    const floor = !this.lesson && next && this.T - (him.mannerT ?? -99) < BRAWL.mannerHold ? (BRAWL.manners[next] + 0.5) * this.max / 100 : 0;
    // ([B8] second pass: and no blow takes him past the next manner - a
    // chair for 35 late in his dirty one put him out on his feet, and his
    // wild fight, the haymakers, the blood, the cap, was never seen)
    const after = order[order.indexOf(him.manner) + 2];
    const floor2 = !this.lesson && after ? (BRAWL.manners[after] + 0.5) * this.max / 100 : 0;
    him.hp = Math.max(this.lesson ? 0.7 * this.max : 0, Math.min(him.hp, Math.max(floor, floor2, him.hp - n)));
    this.c.hp = him.hp;
    him.quietT = 0;
    // [B8] (hurt fast - a fifth of him and more in four seconds - he covers
    // up and gives ground a moment: a run of luck does not end the fight in
    // a breath)
    him.hurt = (him.hurt || []).filter((x) => this.T - x[0] < 4); him.hurt.push([this.T, n]);
    if (!this.lesson && him.hurt.reduce((a, x) => a + x[1], 0) >= BRAWL.shell * this.max && him.state !== 'reel') {
      him.hurt = [];
      this.later(0.35, () => { const h = this.him; if (!this.active || h.state === 'reel' || h.state === 'ko') return; h.coverT = Math.max(h.coverT, 1.3); h.open.L = h.open.R = 0; h.backT = 1.2; h.next = Math.max(h.next, 1.0); this.stats.shells = (this.stats.shells || 0) + 1; });
    }
    const m = mannerOf(+this.pct(him.hp).toFixed(6));
    if (m !== him.manner && m !== 'out') this.setManner(m);
  }

  setManner(m) {
    const him = this.him, G = this.game, c = this.c;
    him.manner = m;
    him.mannerT = this.T;
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
    if ((him.holding === 'stool' || him.holding === 'chair') && him.prop) this.dropHisProp();
    this.hisState('react', clip, him.state === 'attack' || him.state === 'arm' ? 0.08 : 0.05);
    him.next = Math.min(Math.max(him.next, 0.35), 0.8);
    // (struck off an errand he fights with his fists a while)
    if (him.task) { him.task = null; him.thingCool = 5; }
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
    if ((him.holding === 'stool' || him.holding === 'chair') && him.prop) this.dropHisProp();
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

  // what stands behind him along dir within D: { s, what, obj }. [B8] The
  // room says what stands on its floor (room.knockables(): { pos, r, what })
  // and what a hard thing is (room.hardAt(tag, x, z) -> a name: the counter,
  // its pie case, the jukebox); the walls and the bounds are 'wall'.
  sweep(dir, D) {
    const c = this.c, R = this.room, S = this.game.stage;
    const r = (c.fig.collider ? c.fig.collider.r : 0.35);
    const Cl = S.colliders;
    const K = R.knockables ? R.knockables() : [];
    for (let s = 0.08; s <= D + 0.001; s += 0.04) {
      const x = c.pos.x + dir.x * s, z = c.pos.z + dir.z * s;
      for (const k of K) if (Math.hypot(k.pos.x - x, k.pos.z - z) < k.r + r * 0.8) return { s, what: k.what, obj: k };
      for (const b of Cl.boxes) {
        const tag = b.tag || 'wall';
        const lx = (x - b.cx) * b.c - (z - b.cz) * b.s, lz = (x - b.cx) * b.s + (z - b.cz) * b.c;
        const qx = Math.max(-b.hx, Math.min(b.hx, lx)), qz = Math.max(-b.hz, Math.min(b.hz, lz));
        if (Math.hypot(lx - qx, lz - qz) < r * 0.85) return { s, what: (R.hardAt && R.hardAt(tag, x, z, b)) || 'wall', obj: b };
      }
      if (R.bounds) {
        const B = R.bounds;
        if (x > B.x1 - r * 0.8 || x < B.x0 + r * 0.8 || z > B.z1 - r * 0.8 || z < B.z0 + r * 0.8) return { s, what: 'wall', obj: null };
      }
    }
    return null;
  }

  // his back into it: the room does what that does (room.onInto(hit, dir, at,
  // brawl) -> the clip he takes it with: 'br_into', or 'br_into_stools' when
  // he goes down with them)
  into(hit, dir) {
    const G = this.game, R = this.room, c = this.c;
    const at = V(c.pos.x, 1.0, c.pos.z);
    this.stats.throws++;
    this.stats.into.push(hit.what);
    G.emit('brawl:throw', { into: hit.what });
    const clip = (R.onInto && R.onInto(hit, dir, at, this)) || 'br_into';
    if (!R.onInto) this.sfx('bodyThud', at, { k: 0.9 });
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
    // [C4] his big blow at its commit, coming at me: the dodge cue
    this.cueCheck();
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
        // (an errand for a thing given while he was busy: he goes on it)
        if (him.task && him.task.phase !== 'take') { him.state = 'arm'; him.h = null; break; }
        this.breathe(dt);
        if (this.me.act !== 'down') think(this, dt);
        break;
      case 'attack': if (clipDone) this.backToGuard(); break;
      case 'react': case 'stun': case 'into': case 'comeRound':
        if (clipDone) { if (him.state === 'comeRound') { him.hp = Math.max(him.hp, BRAWL.comeRoundHp * this.max / 100); c.hp = him.hp; this.setManner('wild'); } this.backToGuard(); }
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
    this.finishCard();
    this.stepThrownLight(dt);
    steer(this, dt);
    this.keepInRoom();
    this.drawGuard();
  }

  // [B8] a blow's own travel (a knock back, into the furniture, a haymaker's
  // step) never carries him through the room's hard things (a counter, a
  // wall): each step it is pushed back out from where it goes in, and the
  // travelling clip's origin goes with it. (A long knock once put him
  // behind the counter, for good.)
  keepInRoom() {
    const him = this.him, F = this.c.fig;
    if (him.state === 'ko' || him.state === 'move' || him.state === 'arm' || (him.state === 'reel' && !him.atSpot)) return;
    const S = this.game.stage;
    const q = _d.set(F.pos.x, 0, F.pos.z);
    S.colliders.resolve(q, (F.collider ? F.collider.r : 0.35) * 0.9, F.collider, false);
    const B = this.room.bounds;
    if (B) { q.x = Math.max(B.x0 + 0.35, Math.min(B.x1 - 0.35, q.x)); q.z = Math.max(B.z0 + 0.35, Math.min(B.z1 - 0.35, q.z)); }
    const dx = q.x - F.pos.x, dz = q.z - F.pos.z;
    if (Math.abs(dx) + Math.abs(dz) < 1e-5) return;
    F.pos.x = q.x; F.pos.z = q.z;
    if (F._rmClip) { F._rmClip.x0 += dx; F._rmClip.z0 += dz; }
    if (this.c.object) { this.c.object.position.x = F.pos.x; this.c.object.position.z = F.pos.z; }
  }

  // he breathes between his blows: one hand lowered, shaken out, a while
  // (FIGHT.md v3 §3: more often and longer as he tires; wild, one hand
  // hangs low almost all the time)
  breathe(dt) {
    const him = this.him, M = this.manners[him.manner];
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
    const M = this.manners[him.manner] || this.manners.measured;
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
    // (a thrown thing is aimed where I stand as the tell begins: no lead)
    const lead = A && A.kind === 'throw' ? 0 : Math.min(0.9, tc * 0.8);
    him.aim = { x: G.eye.x + Cv.x * lead, z: G.eye.z + Cv.z * lead, from: { x: c.pos.x, z: c.pos.z } };
    // [C4] (the chevron is gone: a thrown thing gets the dodge cue in its
    // flight, as his big blows do at their commit - BrawlCue.js). Each blow
    // its own number: the cue looks once, a slip or a wrong way is this one's
    him.atk = (him.atk || 0) + 1; him.slipped = null;
    // [C4] the side the cue will open is chosen now: away from the hand that
    // swings (a swing's own path leaves that side open), else the side with
    // room; a blow that comes straight at me (an overhand, a rush, a shove,
    // the bottle's thrust, a throw) is aimed a hand's width to the other side,
    // so the light side leaves it and the dark side does not
    him.cueSide = A && cued(clip) ? this.safeSide(A) : null;
    this.cueAim(A);
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
    if (clip === 'br_bottle') { const Cv = this.controller.vel || V(0, 0, 0); this.him.aim = { x: G.eye.x + Cv.x * 0.4, z: G.eye.z + Cv.z * 0.4 }; this.cueAim(A); }
    const feint = /^br_feint/.test(clip);
    const hand = feint ? (clip === 'br_feint' ? 'R' : 'L') : A ? (A.hand === 'both' ? 'R' : A.hand) : 'R';
    const p = c.bones[hand === 'L' ? 'handL' : 'handR'].getWorldPosition(V(0, 0, 0));
    if (G.fx.hit.glint) G.fx.hit.glint(p, feint ? 0.45 : 1);
    this.sfx('hisGrunt', p, { k: feint ? 0.25 : 0.4 });
    this.sfx('tell', null, { kind: clip });
  }

  // his blow arrives: does it find me where it was aimed?
  hisContact(clip, opts = {}) {
    const G = this.game, me = this.me, H = this.hands, him = this.him, c = this.c;
    if (!this.active || this.finished || me.act === 'down') return;
    const A = BR_ATTACKS[clip];
    if (!A || !him.aim) return;
    const eye = G.eye, L = this.lesson;
    // (a thrown thing is judged in its flight: stepFlying)
    const res = opts.force ? { hit: true, into: false, lat: 0, dep: 1 } : this.inPath(A, eye);
    // [C4] (the dodge cue answered: toward the light it goes by, whatever the
    // room let my feet do; toward the dark it lands, a straight one too)
    if (!opts.force && him.slipped === clip) { res.hit = false; res.slip = true; }
    if (this.cue && !this.cue.flying && this.cue.clip === clip) this.cue.end(res.hit ? 'late' : 'gone');
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
    // [R2-E] a thing held up as a shield (THINGS' `shield`: the crate lid)
    // stops the blow, whatever it is; a heavy one (or one that breaks a
    // block) splits it, and his weapon bites into it: he is open a moment
    if (me.act === 'block' && me.holding && THINGS_OF(me.holding).shield) {
      this.stats.blocked++; this.stats.shielded = (this.stats.shielded || 0) + 1;
      this.did.block = true; this.did.shield = true;
      const splits = !!(A.heavy || A.block === null);
      this.sfx('blocked', eye, { k: 1 });
      me.h = H.play(this.bothHands() ? 'blockBig' : 'blockHit');
      me.act = 'hurt'; me.stun = 0.16; me.t = 0;
      this.controller.shake(0.2, 0);
      if (splits) {
        this.spendHeld(null, dirMe.clone().negate());
        this.lower('LR', 0.8, 'shield'); him.missT = Math.max(him.missT, 0.8); him.punished = false;
      }
      this.later(0.17, () => { if (this.me.act === 'idle' && this.game.held('Space')) this.block(true); });
      G.emit('brawl:hit', { by: 'him', kind: clip, power: 0, zone: 'shield', split: splits });
      return;
    }
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
    // [B8] (caught punching - a fist out, or bounced off him, or winding -
    // it lands half again: trading blows with him is a losing game)
    const caught = !L && /^(jab|hard|bounce|wind|cock|strike)$/.test(me.act);
    if (caught) { dmg *= 1.5; this.stats.caught = (this.stats.caught || 0) + 1; }
    // [C4] (what put me down, said in a word on the black)
    if (!opts.thrown) {
      const lc = this.lastCue && this.lastCue.atk === him.atk && !this.lastCue.flying ? this.lastCue.answer : null;
      this.lastHurt = { clip, answer: !!A.answer, caught, cue: lc, at: this.T };
    } else this.lastHurt.caught = caught;
    this.hurtMe(dmg, from, { stun: A.stun + (res.into ? 0.08 : 0) });
    { const HB = this.stats.hurtBy || (this.stats.hurtBy = {}); HB[clip] = +((HB[clip] || 0) + dmg).toFixed(1); }
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
    // ([R2-E] a path's `min`: inside it - a long arc's point passes behind a
    // man who has stepped in on it; the first fight's paths have none)
    const hit = lat >= P.lo && lat <= P.hi && dep > (P.min ?? 0.2) && dep <= reach;
    // (toward the swing: out on the side it comes from, past the aim line)
    const into = hit && ((A.hand === 'R' && A.kind === 'swing' && lat < -0.3) || (A.hand === 'L' && A.kind === 'swing' && lat > 0.3));
    return { hit, into, lat, dep, reach };
  }

  hurtMe(n, from = 'F', { soft = false, stun = 0.3 } = {}) {
    const G = this.game, me = this.me, H = this.hands;
    // [C4] (nobody goes down unwarned: a blow that would take the last of me
    // while the warning has not been up a second leaves one - and puts it up)
    // (the lesson is a safe place: his blows sting but never put me down there)
    if (this.lesson) n = Math.max(0, Math.min(n, G.health.hp - 30));
    if (!this.lesson && G.health.hp - n <= 0 && !(this.warned && this.T - (this.warnedAt ?? this.T) >= 1.0)) {
      n = Math.max(0, G.health.hp - 1);
      this.stats.spared = (this.stats.spared || 0) + 1;
      if (!this.warned) { this.warned = true; this.warnedAt = this.T; G.hud.warn(FIGHT_WARN); }
    }
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
    if (R.onBump) R.onBump(b.at, b.speed, this);
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
      const big = T.kind === 'stool' || T.kind === 'chair';
      const clip = big ? 'br_stoolUp' : 'br_take';
      // (his first bottle: broken on the counter's edge, the neck held low)
      if (T.kind === 'bottle' && T.first) { him.task = null; this.hisAttack('br_bottle'); return; }
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
    him.holding = T.kind;
    this.stats.hisItems.push(T.kind);
    const first = T.kind === 'bottle' && (T.first || !him.task);
    if (first) him.hadBottle = true;
    else if (T.kind === 'stool' || T.kind === 'chair') him.hadStool = true;
    else him.throws = (him.throws || 0) + 1;
    c.hold(o, 'R', { grip: T.kind === 'bottle' || T.kind === 'stool' || T.kind === 'chair' ? 'hang' : 'upright' });
    this.sfx('grab_' + (T.kind === 'mug' ? 'plate' : T.kind === 'chair' ? 'stool' : T.kind), c.pos.clone().setY(1.2), {});
    if (first && R.gift) R.gift('first');
    if (this.opts.onBottle && first) this.opts.onBottle('take', him);
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

  // [B8] a thing thrown at me (§4): it flies on a real arc from his hand
  // along the lane aimed where I stood when his tell began; a hop to either
  // side leaves it; it bursts on whatever is behind me (the ray world, the
  // floor) and its pieces come to rest. The chevron that showed through the
  // tell goes when it has passed.
  hisThrow() {
    const him = this.him, c = this.c, G = this.game, o = him.prop;
    if (!o) return;
    him.prop = null; const kind = him.holding; him.holding = null;
    c.hold(null, 'R');
    const from = c.bones.handR.getWorldPosition(V(0, 0, 0));
    const aim = him.aim || { x: G.eye.x, z: G.eye.z };
    const to = V(aim.x, G.eye.y - 0.32, aim.z);
    const hd = Math.hypot(to.x - from.x, to.z - from.z), sp = 12.5, tt = Math.max(0.12, hd / sp), g = 9.8;
    const v = V((to.x - from.x) / tt, (to.y - from.y + 0.5 * g * tt * tt) / tt, (to.z - from.z) / tt);
    G.stage.scene.add(o); o.position.copy(from); o.updateMatrixWorld(true);
    this.lightThing(o, true); him.lightK = 0;   // [R2-H] up light in the air (it came up over the tell): china catches the eye
    this.sfx('b8throw', from, { k: 1 });
    const lane = V(to.x - from.x, 0, to.z - from.z).normalize();
    // ([B8] its middle and its size, for the rim drawn round it on the frame)
    const sph = new THREE.Box3().setFromObject(o, true).getBoundingSphere(new THREE.Sphere());
    // ([C4] the cue's side was chosen at his tell: the lane runs a hand's
    // width to the other side of me)
    (this.flying || (this.flying = [])).push({ o, kind, v, t: 0, from: from.clone(), lane, judged: false, spin: V(this.rng.range(6, 12), this.rng.range(8, 14), 0), by: 'him', c: o.worldToLocal(sph.center.clone()), rad: Math.max(0.06, sph.radius), side: him.cueSide || this.throwSide('R'), atk: him.atk });
    this.stats.thrown = (this.stats.thrown || 0) + 1;
  }

  // the things in the air, a step each
  stepFlying(dt) {
    if (!this.flying || !this.flying.length) return;
    const G = this.game, him = this.him;
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const F = this.flying[i], o = F.o;
      F.t += dt;
      const p0 = o.position.clone();
      F.v.y -= 9.8 * dt;
      const p1 = p0.clone().addScaledVector(F.v, dt);
      const seg = p1.clone().sub(p0), len = seg.length();
      o.rotation.x += F.spin.x * dt; o.rotation.y += F.spin.y * dt;
      // on me: where it crosses my depth, if I am still in its lane
      const eye = G.eye;
      const dep0 = (p0.x - eye.x) * F.lane.x + (p0.z - eye.z) * F.lane.z, dep1 = (p1.x - eye.x) * F.lane.x + (p1.z - eye.z) * F.lane.z;
      // [C4] the dodge cue: when what is left of its flight to me is the
      // cue's share of the window, if it would find me where I stand
      // (from where this step leaves it: this step's move is already made)
      if (!F.judged && !F.cueDone && F.by === 'him' && dep1 < 0) {
        const vh = F.v.x * F.lane.x + F.v.z * F.lane.z;
        const remain = vh > 0.1 ? -dep1 / vh : 9;
        if (remain <= CUE.window * CUE.k + 1e-4) {
          F.cueDone = true;
          const qx = p1.x + F.v.x * remain, qz = p1.z + F.v.z * remain, qy = p1.y + F.v.y * remain - 4.9 * remain * remain;
          if (!this.cue && Math.hypot(qx - eye.x, qz - eye.z) < 0.36 && qy > eye.y - 1.3 && qy < eye.y + 0.25 && this.me.act !== 'down' && !this.finished) this.startCue({ clip: 'br_throw', A: BR_ATTACKS.br_throw, side: F.side, remain, flying: F, atk: F.atk });
        }
      }
      if (!F.judged && dep0 < 0 && dep1 >= 0) {
        F.judged = true;
        const u = -dep0 / Math.max(1e-6, dep1 - dep0);
        const q = p0.clone().lerp(p1, u);
        const lat = Math.hypot(q.x - eye.x, q.z - eye.z);
        // ([C4] slipped under the cue: it goes past my ear, whatever the room let my feet do)
        if (!F.slipped && lat < 0.36 && q.y > eye.y - 1.3 && q.y < eye.y + 0.25 && this.me.act !== 'down' && this.active) {
          // it finds me (or my block)
          him.aim = { x: eye.x, z: eye.z };
          const lc = this.lastCue && this.lastCue.flying === F ? this.lastCue.answer : null;
          this.lastHurt = { clip: 'br_throw', thrown: true, cue: lc, at: this.T };
          this.hisContact('br_throw', { force: true, thrown: true });
          o.position.copy(q); o.updateMatrixWorld(true);
          this.burstThing(o, F.kind, q, F.lane);
          this.flying.splice(i, 1);
          continue;
        }
        // (past me: a miss, and he is open)
        const A = BR_ATTACKS.br_throw;
        if (this.active && !this.finished) {
          this.lower(A.miss.open, A.miss.t, 'miss'); him.missT = Math.max(him.missT, A.miss.t); him.punished = false;
          this.stats.dodged++; this.did.dodged = true; this.did.dodgeThrow = true;
          this.sfx('whiff', q, { k: 0.8 });
          G.emit('brawl:hit', { by: 'him', kind: 'br_throw', power: 0, zone: 'missed', lat: +lat.toFixed(2) });
          if (this.lesson) this.lesson.onHisBlow('br_throw', 'missed');
        }
      }
      // what is in its way: the room (the ray world), the floor
      let hit = null;
      if (len > 1e-5 && G.rays) hit = G.rays.raycast(p0, seg.clone().divideScalar(len), len);
      const floor = G.stage.surfaceY(p1.x, p1.z) + 0.04;
      if (hit) { o.position.copy(hit.point).addScaledVector(hit.normal, 0.05); }
      else if (p1.y <= floor) { o.position.copy(p1); o.position.y = floor; }
      else if (F.t > 3) { /* (never forever) */ }
      else { o.position.copy(p1); o.updateMatrixWorld(true); continue; }
      o.updateMatrixWorld(true);
      if (!F.judged) {
        F.judged = true;
        // ([C4] it struck the room before it reached me: on the record)
        const TS = this.stats.thrownShort || (this.stats.thrownShort = []);
        if (TS.length < 20) TS.push({ at: [+o.position.x.toFixed(2), +o.position.y.toFixed(2), +o.position.z.toFixed(2)], what: hit ? (hit.mesh && (hit.mesh.name || (hit.mesh.parent && hit.mesh.parent.name))) || 'mesh' : 'floor', eye: [+G.eye.x.toFixed(2), +G.eye.y.toFixed(2), +G.eye.z.toFixed(2)] });
      }
      this.burstThing(o, F.kind, o.position.clone(), hit ? hit.normal.clone().negate() : F.lane);
      this.flying.splice(i, 1);
    }
  }
  // [R2-H] his thrown china is drawn light: a dark plate against the dark
  // room at five metres was not seen, and the ring drawn round it to find it
  // was loud. Its materials are cloned (the shared china stays as it was) and
  // lifted by k (0 .. 1): an emissive and a lighter albedo, so the ink prints
  // it paper-white with its rim. It comes up over the tell, in his hand (the
  // plate catching the light is the tell's own mark: nothing pops at the
  // release) and goes back when it bursts, falls or he is struck off it.
  lightThing(o, on, k = 1) {
    if (!o) return;
    o.traverse((m) => {
      if (!m.isMesh || !m.material || Array.isArray(m.material)) return;
      if (on) {
        let c = m.userData.r2hMat && m.material;
        if (!c) {
          const M = m.material;
          if (M.transparent || !/^prop_china/.test(M.name || '')) return;
          m.userData.r2hMat = M;
          c = M.clone();
          c.userData.r2hBase = M.color.clone();
          c.emissive = new THREE.Color(0, 0, 0);
          m.material = c;
        }
        c.emissive.setScalar(THROWN_LIFT * k);
        c.color.copy(c.userData.r2hBase).multiplyScalar(1 + 1.2 * k);
      } else if (m.userData.r2hMat) {
        m.material.dispose && m.material.dispose();
        m.material = m.userData.r2hMat;
        delete m.userData.r2hMat;
      }
    });
  }
  // (each step: the plate in his hand comes up over the throw's tell; one he
  // is struck off goes back to china)
  stepThrownLight(dt) {
    const him = this.him, o = him.prop;
    if (o && him.state === 'attack' && him.clip === 'br_throw') {
      him.lightK = Math.min(1, (him.lightK || 0) + dt / 0.4);
      this.lightThing(o, true, him.lightK);
    } else if (o && him.lightK) { him.lightK = 0; this.lightThing(o, false); }
  }
  // [B8] (second pass) his thrown thing on the frame: speed lines back
  // along the way it came and a white rim - a dark plate against the dark
  // room at five metres was not seen at all, only the chevron and his arm
  drawFlying() {
    const G = this.game, out = [];
    for (const F of this.flying || []) {
      if (F.by !== 'him' || !F.o.parent) continue;
      const mid = F.c ? F.o.localToWorld(_d.copy(F.c)) : _d.copy(F.o.position);
      const h = G.screenOf(mid), f = G.screenOf(F.from);
      if (!h) continue;
      const d = mid.distanceTo(G.camera.position);
      const r = Math.max(9, Math.min(64, (F.rad || 0.12) * 1.1 / Math.max(0.3, d) * innerHeight * 0.74));
      // ([R2-H] the lines trail along the way it is going: back up its own
      // velocity, so the first frames, with the thing still at his hand,
      // show which way it comes from)
      const tl = G.screenOf(_e.copy(mid).addScaledVector(F.v, -0.05));
      out.push({ x: h.x, y: h.y, fx: f ? f.x : h.x, fy: f ? f.y : h.y - 1, r, t: F.t, tx: tl ? tl.x - h.x : 0, ty: tl ? tl.y - h.y : 0 });
    }
    if (out.length || this._flyShown) this.cards.flying(out.length ? out : null);
    this._flyShown = out.length > 0;
  }
  burstThing(o, kind, at, dir) {
    this.lightThing(o, false);
    const B = this.game.stage.breakables;
    const k = kind === 'mug' ? 'mug' : kind === 'bottle' ? 'bottle' : 'plate';
    o.visible = true;
    B.breakIt(B.add(o, { kind: k, hp: 1, solid: false }), { point: at.clone(), dir: dir.clone().setY(Math.min(0, dir.y)).normalize(), by: 'body' });
    this.sfx('break_' + k, at, {});
  }
  // (the fight stops with things in the air: they fall where they are)
  dropFlying() {
    for (const F of this.flying || []) { this.lightThing(F.o, false); this.dropInWorld(F.o, F.kind, F.o.position.clone(), F.lane, 0.8); }
    this.flying = [];
    if (this._cards) { this._cards.chevron(null); this._cards.flying(null); }
    this._flyShown = false;
  }

  // which side of the frame to step to from a thrown thing: away from the
  // hand that throws, unless the room is shut that way (a wall, the counter)
  throwSide(hand = 'R') {
    const C = this.controller, G = this.game;
    const fy = C.faceYaw ?? C.yaw, rx = Math.cos(fy), rz = -Math.sin(fy);
    const want = hand === 'L' ? 'L' : 'R';
    const room = (s) => {
      const q = V(G.eye.x + rx * s * 0.62, 0, G.eye.z + rz * s * 0.62), q0 = q.clone();
      G.stage.colliders.resolve(q, 0.3);
      const B = this.room.bounds;
      const inB = !B || (q.x > B.x0 + 0.3 && q.x < B.x1 - 0.3 && q.z > B.z0 + 0.3 && q.z < B.z1 - 0.3);
      return inB && q.distanceTo(q0) < 0.12;
    };
    const s0 = want === 'R' ? 1 : -1;
    if (room(s0)) return want;
    return room(-s0) ? (want === 'R' ? 'L' : 'R') : want;
  }

  // ---- [C4] the dodge cue (BrawlCue.js) ---------------------------------------------------------
  // the side of my screen a blow of his is left by: away from the hand that
  // swings (its path leaves only that side); a blow that comes straight at
  // me, the side with room (away from its hand first)
  safeSide(A) {
    const away = A.hand === 'L' ? 'L' : 'R';
    if (A.kind === 'swing' || A.kind === 'long') return away;
    return this.throwSide(A.hand === 'both' ? (this.rng.chance(0.5) ? 'L' : 'R') : away);
  }
  // a straight blow (or a throw) aimed a hand's width to the dark side of me
  cueAim(A) {
    const him = this.him, G = this.game, c = this.c;
    if (!him.cueSide || !him.aim || !A || A.kind === 'swing' || A.kind === 'long') return;
    const dx = G.eye.x - c.pos.x, dz = G.eye.z - c.pos.z, dl = Math.hypot(dx, dz) || 1;
    const rx = dz / dl, rz = -dx / dl, s = (him.cueSide === 'R' ? -1 : 1) * CUE.aimOff;
    him.aim.x += rx * s; him.aim.z += rz * s;
  }
  // (his side, a step: is his blow at its commit, coming at me where I stand?)
  cueCheck() {
    const him = this.him;
    if (this.cue || this.finished || this.me.act === 'down' || this.blackT > 0) return;
    if (him.state !== 'attack' || !him.clip || !him.cueSide || him.cueAtk === him.atk) return;
    const A = BR_ATTACKS[him.clip];
    if (!A || A.kind === 'throw' || him.contactAt == null) { him.cueAtk = him.atk; return; }
    const at = Math.max(him.strikeAt ?? 0, him.contactAt - CUE.window * CUE.k);
    if (him.t < at) return;
    him.cueAtk = him.atk;
    if (!this.inPath(A, this.game.eye).hit) return;
    this.startCue({ clip: him.clip, A, side: him.cueSide, remain: Math.max(0.02, him.contactAt - him.t), atk: him.atk });
  }
  startCue(spec) {
    const G = this.game;
    // (the lesson's first: held, with the kit's teach card - time crawls
    // until the key toward the light is pressed; once a save)
    let held = false, teach = null;
    // (the first cue of the save, wherever it comes - the diner's lesson, or
    // Pier 9 for a player who began there: the card, held)
    const K = G.hud && G.hud.kit, untaught = K && K.taught && !K.taught().dodge;
    if (((this.lesson && this.lesson.dodge) || untaught) && G.hud && G.hud.teach) {
      if (this.lesson) this.lesson.dodge = false;
      teach = G.hud.teach('dodge', DODGE_CARD, { hold: true, holdMax: 6, until: () => !this.cue || this.cue.done });
      held = !teach.done;
    } else if (this.reteach && G.hud && G.hud.teach) {
      // (failed twice: the card once more, not held)
      this.reteach = false;
      G.hud.teach.again('dodge', DODGE_CARD, { hold: false, secs: 2.4, until: () => !this.cue || this.cue.done });
    }
    this.cue = new DodgeCue(this, { ...spec, held });
    this.cue.atk = spec.atk;
    this.cue.teach = teach;
  }

  // [C4] the warning before I go down (WAVE_C §1 rule 2): one line low in
  // the frame (the kit's), up while my health is low, gone as it comes back
  lowWarn() {
    const G = this.game, K = G.hud && G.hud.kit;
    if (!K || this.lesson) return;
    // ([C4] after the last blow there is nothing left to warn of: the line
    // goes with his fall, and a fight stopped in this very step - stepKO's
    // stop() - must not put it back up for good, as it did at both fights)
    if (this.finished || !this.active) { if (this.warned) { this.warned = false; G.hud.warn(null); } return; }
    const hp = G.health.hp;
    const on = this.warned ? hp < 40 : hp < 30 && this.me.act !== 'down';
    if (on && !this.warned) { this.warned = true; this.warnedAt = this.T; G.hud.warn(FIGHT_WARN); }
    else if (!on && this.warned) { this.warned = false; G.hud.warn(null); }
  }

  // the stool (or anything) out of his hands: it falls from where his hands
  // had it and comes apart on the floor (the neck falls and lies)
  dropHisProp() {
    const him = this.him, c = this.c, G = this.game, o = him.prop;
    if (!o) return;
    him.prop = null; const kind = him.holding; him.holding = null;
    if (him.lightK) { him.lightK = 0; this.lightThing(o, false); }   // ([R2-H] a plate lit over his tell goes back to china before it falls and comes apart)
    o.updateWorldMatrix(true, true);
    const w = o.getWorldPosition(V(0, 0, 0));
    const q = o.getWorldQuaternion(new THREE.Quaternion());
    c.hold(null, 'R');
    // ([R2-E] a room's own thing out of his hand - the foreman's hook: the
    // room lets it fall and makes it a thing in reach)
    if (this.room && this.room.onHisDrop && this.room.onHisDrop(kind, o, w, q, this)) return;
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
    him.state = 'reel'; him.clip = null; him.t = 0; him.open.L = him.open.R = 0; him.quietT = 0; him.atSpot = false; him.loco = null; him.reelSpeed = null; him.caught = false; him.catchT = 0; him.lane = false; him.stuckT = 0; him.aim = null; him.bestD = null; him.reelPath = null; him.switched = 0; him.reelT = 0; him.spotT = null;
    let best = null, bd = Infinity;
    for (const w of R.finishes || []) { const d = Math.hypot(w.spot.x - c.pos.x, w.spot.z - c.pos.z); if (d < bd) { bd = d; best = w; } }
    him.window = best;
    him.spot = best ? best.spot : { x: c.pos.x, z: c.pos.z };
    try { c.fig.anim.setOverlay(null, 0.1); } catch (e) { /* */ }
    c.setState('br_reel', 0.3);
  }

  // [R2-H] The last blow, taught where it is needed. Out on his feet at the
  // window, the one thing that finishes him is a loaded punch (or a thing),
  // and a player who mashes has no reason to know it: one card at the fist,
  // with the mouse in it, a moment after he gets there - unless I have loaded
  // a punch in the last half minute (I know) - and again only if I go on
  // jabbing a man who does nothing but sway (six blows). Gone with him.
  finishCard() {
    const him = this.him, C = this.cards;
    let want = false;
    if (him.state === 'reel' && him.atSpot && !this.lesson) {
      if (him.spotT == null) { him.spotT = this.T; him.reelHits = 0; him.nagT = 0; him.cardOff = this.T - (this.me.loadedT ?? -99) < 30; }
      const age = this.T - him.spotT;
      want = (age > 0.7 && age < 6 && !him.cardOff) || this.T < him.nagT;
    } else if (him.state !== 'reel') him.spotT = null;
    if (want) { C.card(FINISH_CARD, 'mouseLR'); this._finCard = true; }
    else if (this._finCard) { C.card(''); this._finCard = false; }
  }

  stepReel(dt) {
    const him = this.him, c = this.c, F = c.fig;
    // (left alone AT THE WINDOW he comes round - not on his way there)
    if (him.atSpot) him.quietT += dt; else him.quietT = 0;
    if (him.swayT > 0) him.swayT -= dt;
    if (him.catchT > 0) { him.catchT -= dt; if (him.catchT <= 0) F.anim.setOverlay(null, 0.25); }
    else if (!him.caught && !him.atSpot && this.room.knockables) {
      const s = Math.sin(F.yaw), co = Math.cos(F.yaw);
      for (const st of this.room.knockables()) {
        if (!st.catch) continue;
        const ox = st.pos.x - F.pos.x, oz = st.pos.z - F.pos.z;
        const lf = ox * co - oz * s, fw = ox * s + oz * co;
        if (Math.abs(lf) > 0.3 && Math.abs(lf) < 0.75 && Math.abs(fw) < 0.35) {
          him.caught = true; him.catchT = 0.85;
          F.anim.setOverlay(lf > 0 ? 'br_catchL' : 'br_catchR', 0.18);
          if (st.spin) st.spin(0.6);
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
      // [B8] (me in his way, held up: he shoulders me out of it, hard - a
      // big man reeling does not go round the man who stands there)
      const e = this.game.eye, de = Math.hypot(e.x - F.pos.x, e.z - F.pos.z);
      if (him.stuckT > 0.8 && de < 1.3 && !(him.shovedAt > this.T - 1.2)) {
        him.shovedAt = this.T;
        const vx = him.vel ? him.vel.x : 0, vz = him.vel ? him.vel.z : 0, vl = Math.hypot(vx, vz) || 1;
        const ex = e.x - F.pos.x, ez = e.z - F.pos.z, side = (vx * ez - vz * ex) >= 0 ? 1 : -1;
        this.pushMe(V(-vz / vl * side * 0.8 + ex / (de || 1) * 0.6, 0, vx / vl * side * 0.8 + ez / (de || 1) * 0.6).normalize(), 0.9);
        this.stats.reelShoves = (this.stats.reelShoves || 0) + 1;
      }
      if (him.stuckT > 2.5 && this.room.finishes) {
        const other = this.room.finishes.find((w) => w !== him.window);
        him.switched = (him.switched || 0) + 1;
        if (other) { him.window = other; him.spot = other.spot; him.lane = false; him.reelSpeed = null; him.stuckT = 0; him.bestD = null; }
      }
      // [B8] (neither window to be got to from where he is: he comes round
      // where he stands and fights on - never a fight that cannot end)
      him.reelT = (him.reelT || 0) + dt;
      if (him.switched >= 3 || him.reelT > 12) { him.reelT = 0; him.switched = 0; him.atSpot = false; him.spot = null; this.hisState('comeRound', 'br_comeRound', 0.2); return; }
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
    // (the finish's own clip: out through a window here, through a plank
    // door into the river at Pier 9)
    const koClip = (w && w.clip) || 'br_ko_window';
    const clip = c.clip(koClip);
    him.koLand = clip.marks.land;
    him.koEnd = clip.duration;
    this.hisState('ko', koClip, 0.06, { glass: () => { if (this.opts.onGlass) this.opts.onGlass(w); } });
    him.state = 'ko';
    G.hitStop = Math.max(G.hitStop || 0, BRAWL.feelOf[3].stop);
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
      // ([R2-E] a finish into water has its own sound: the room's splash)
      if (!(him.window && him.window.water)) {
        this.sfx('bodyPavement', V(c.pos.x, 0.2, c.pos.z), { k: 1 });
        this.controller.shake(0.2, 3);
      }
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

  // [B8] the wind-up, seen and heard (§2): as the hold passes each level a
  // white ink tick flicks at the fist and a note rises; at full the fist
  // flashes once. (The fist's own draw-back and tremble are its clip, the
  // view leaning back its view keys: clips/fight.js windL / windR.)
  drawWind() {
    const me = this.me, G = this.game;
    if (me.act !== 'wind') { if (me.lvShown) { me.lvShown = 0; this.cards.windMarks(null); } return; }
    const lv = this.levelOf(me.holdT);
    const hand = me.windThing && me.holding ? (me.holding.hand || 'R') : me.arm;
    const p = this.hands.anchor(hand === 'L' ? 'palmL' : 'palmR', _c);
    const s = G.screenOf(p);
    // (the fist drawn back low may leave the frame: the marks stay on it)
    if (s) { s.x = Math.max(160, Math.min(innerWidth - 160, s.x)); s.y = Math.min(innerHeight - 120, s.y); }
    if (lv > (me.lvShown || 0)) {
      this.sfx(lv >= 3 ? 'b8full' : 'b8tick', null, { k: lv });
      this.stats.ticks3 = (this.stats.ticks3 || 0) + (lv >= 3 ? 1 : 0);
    }
    me.lvShown = lv;
    if (lv > 0) this.cards.windMarks(s, hand, lv);
  }

  // ---- losing: down, black, up at the start of his manner ---------------------------------------------
  playerDown() {
    const me = this.me, G = this.game;
    if (me.act === 'down') return;
    this.cancelArm();
    if (me.holding) this.dropMine();
    if (this.cue) this.cue.end('gone');
    me.act = 'down'; me.downT = 0;
    this.controller.brawlHop = null;
    this.stats.downs++;
    // [C4] what put me down, in a word for the black; two downs off a blow
    // the cue told me of: its card once more at the next
    const LH = this.lastHurt || {};
    const why = LH.cue === 'late' ? 'late' : LH.cue === 'wrong' ? 'wrong' : LH.caught ? 'caught' : LH.answer ? 'answer' : 'down';
    this.downWhyKey = why;
    (this.stats.downWhy || (this.stats.downWhy = [])).push(why);
    if (why === 'late' || why === 'wrong') { this.cueDowns = (this.cueDowns || 0) + 1; if (this.cueDowns === 2) this.reteach = true; }
    // (how long the warning had been up: the proofs read it)
    (this.stats.downWarned || (this.stats.downWarned = [])).push(this.warned ? this.T - (this.warnedAt ?? this.T) : null);
    if (this.warned) { this.warned = false; G.hud.warn(null); }
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
      // [B8] (he has got his breath back, a little: at most `retryBack` of
      // him, never past the start of his manner - failing costs about ten
      // seconds, not the round)
      // (second pass: a down gives him back the same each time, and from the
      // third in a manner I come up whole - the fight gives a little to the
      // man who keeps getting up; version 4's 8, 16, 24 %... held a player
      // who struggled in one manner for good, five minutes and fifteen
      // downs. But a life spent pounding his guard - more than `pound`
      // punches into it a minute: a masher throws 45, a first-timer who
      // struggles 10 to 19 - is paid for as before: 8, 16, 24 %... of him
      // back each time, up with 60)
      const L0 = this.stats.life || { t: 0, b: 0 };
      const rate = (this.stats.myBlocked - L0.b) / Math.max(20, this.stats.time - L0.t) * 60;
      const pounding = rate > BRAWL.pound;
      const key = pounding ? 'pounding' : 'mannerDowns';
      const MD = this.stats[key] || (this.stats[key] = {}); MD[m] = (MD[m] || 0) + 1;
      const back = Math.min(BRAWL.manners[m] * this.max / 100, this.him.hp + BRAWL.retryBack * (pounding ? MD[m] : 1) * this.max / 100);
      const left = Math.max(0.05, BRAWL.down - me.downT);
      G.health.reset();
      G.health.hp = !pounding && MD[m] >= 3 ? BRAWL.meHp : BRAWL.retryHp;
      if (G.sfx && G.sfx.hush) G.sfx.hush(left + 0.3);
      if (this.opts.onRetry) this.opts.onRetry(m, back);
      G.hud.fade(1);
      this.blackT = left;
      // [C4] (the word on the black, in the kit's lettering)
      this.downWhy = DOWN_WHY[this.downWhyKey] || DOWN_WHY.down;
      this.downBlack = left;
      if (G.hud.kit) { G.hud.kit.failLine(this.downWhy); G.hud.kit.failK(0); }
      if (G.hud.setFailing) G.hud.setFailing(true);   // (the HUD's lines and his bar off the black, as a fail's)
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

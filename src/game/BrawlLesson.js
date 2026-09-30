import * as THREE from 'three';

// The first exchange is the lesson (the arcade pass: docs/story/FIGHT.md v3
// §6). He squares up and WAITS: he does not hurt me until step 5. One card
// at a time, low in the frame. The game does not pause. The arrow and the
// slow motion exist here only. A step already done is skipped.
//   1  he lowers the hand on the left of the screen   HIS GUARD IS DOWN  LEFT CLICK   my left jab lands
//   2  he lowers the other                            RIGHT CLICK                    my right jab lands
//   3  guard up, both sides                           GUARD UP: ...WAIT FOR AN OPENING
//                                                     one punch blocked (or 3 s); then he lowers a hand and I land one
//   4  both hands down, taunting                      HOLD, THEN LET GO ...          a hard punch of 0.5 or more lands
//   5  a slow right hook (0.4 x through the tell, the arrow to my safe side)   D   it misses; HE IS OPEN while he is
//   6  the same from his left                         A                              it misses
//   7  he jabs                                        SPACE  BLOCK                   I block one
//   8  he backs off; Dot slides a bottle down the counter   E  GRAB WHAT IS IN REACH   3 s, or I grab something
// Then NOW FIGHT. for a second; his health is full.
// [B8] version 4: step 3 shows him answering a punch into his guard (once,
// slowed); step 4 says what a button does (tap to jab, hold to load); a
// new step 7: he throws a plate, the chevron shows the side to step to.
export const LESSON = [
  null,
  { kind: 'jabL', card: 'HIS GUARD IS DOWN   LEFT CLICK', pic: 'mouseL', taunt: 'L', done: (B) => B.did.jabL },
  { kind: 'jabR', card: 'RIGHT CLICK', pic: 'mouseR', taunt: 'R', done: (B) => B.did.jabR },
  { kind: 'guard', card: 'GUARD UP: HE ANSWERS A PUNCH INTO IT.   WAIT FOR AN OPENING', pic: null, guard: true, done: (B, L) => L.landedOpen },
  { kind: 'hold', card: 'TAP TO JAB.   HOLD TO LOAD, THEN LET GO', pic: 'mouseLR', taunt: 'LR', done: (B) => B.did.hard },
  { kind: 'hookR', card: 'STEP AWAY FROM THE HAND THAT SWINGS', pic: ['D'], attack: 'br_hook', hand: 'R', done: (B, L) => L.missed },
  { kind: 'hookL', card: 'STEP AWAY FROM THE HAND THAT SWINGS', pic: ['A'], attack: 'br_hookL', hand: 'L', done: (B, L) => L.missed },
  { kind: 'throw', card: 'HE THROWS: STEP WHERE THE MARK POINTS', pic: ['A', 'D'], throw: true, attack: 'br_throw', done: (B, L) => L.missed },
  { kind: 'block', card: 'BLOCK', pic: ['SPACE'], attack: 'br_jab', done: (B, L) => L.covered },
  { kind: 'grab', card: 'GRAB WHAT IS IN REACH', pic: ['E'], back: true, done: (B, L) => L.t >= 3 || B.did.grab },
];
export const LESSON_SLOW = 0.4;
const LAST = LESSON.length - 1;

export class Lesson {
  constructor(B, step = 1) {
    this.B = B;
    this.step = 0;
    this.total = 0;
    this.go(Math.max(1, Math.min(LAST, step)));
  }

  // (what the step teaches, by name: the drivers read it, not its number)
  get kind() { return LESSON[this.step] ? LESSON[this.step].kind : null; }

  go(n) {
    const B = this.B;
    this.step = n;
    this.t = 0;
    (B.stats.lessonSteps || (B.stats.lessonSteps = [])).push([n, +(this.total || 0).toFixed(1)]);
    this.missed = false; this.covered = false; this.landedOpen = false;
    this.bounced = false; this.lowered = null; this.answered = false; this.fetch = false;
    this.attackAt = LESSON[n] && LESSON[n].attack ? 1.5 : Infinity;
    this.openT = 0;
    this.pending = false;
    B.lessonHold = true;
    B.lessonBack = !!(LESSON[n] && (LESSON[n].back || LESSON[n].throw));
    const S = LESSON[n];
    if (!S) return;
    // (done already: on to the next)
    if (S.done(B, this) && n < 5) { this.go(n + 1); return; }
    // (the throw: he goes for a plate first, if he has none)
    if (S.throw && !B.him.holding) {
      const it = B.room.hisItem && (B.room.hisItem('plate', B.c.pos) || B.room.hisItem('mug', B.c.pos));
      if (it) { B.him.task = { kind: it.kind, item: it, t: 0 }; B.him.state = 'arm'; B.him.h = null; this.fetch = true; }
      else { this.go(n + 1); return; }
    }
    B.him.taunt = S.taunt || null;
    B.him.open.L = 0; B.him.open.R = 0;
    B.cards.card(S.card, S.pic);
    if (S.back && B.room.gift) B.room.gift('lesson');
  }

  // my blows, as the rules see them land or bounce
  onMyBlow(kind, arm, k, how) {
    if (this.step === 3) {
      if (how === 'blocked') this.bounced = true;
      if (how === 'landed' && this.lowered) this.landedOpen = true;
    }
  }
  onHisBlow(clip, how) {
    const S = LESSON[this.step];
    if (!S || !S.attack || clip !== S.attack) return;
    this.pending = false;
    this.B.cards.arrow(null);
    if (how === 'missed') {
      this.missed = true;
      if (S.hand || S.throw) { this.B.cards.flash('HE IS OPEN', 0.9); this.openT = 0.9; }
    } else if (how === 'covered') this.covered = true;
    // (it found me: he goes again in a moment)
    if (!this.missed && !this.covered) this.attackAt = this.t + 1.5;
  }

  update(dt) {
    const B = this.B, him = B.him, G = B.game;
    this.t += dt;
    this.total += dt;
    const S = LESSON[this.step];
    // his health stays in his measured manner while he is being taught
    if (him.hp < 0.7 * B.max) { him.hp = 0.7 * B.max; B.c.hp = him.hp; }
    if (!S) return this.finish();
    if (S.done(B, this)) {
      if (this.openT > 0) { this.openT -= dt; if (this.openT > 0) return; }
      if (this.step >= LAST) return this.finish();
      this.go(this.step + 1);
      return;
    }
    // step 3: the guard up until a punch has bounced off it (or 3 s); then a
    // hand comes down
    if (S.guard && !this.lowered && (this.bounced || this.t >= 3)) {
      this.lowered = B.rng.chance(0.5) ? 'L' : 'R';
      him.taunt = this.lowered;
    }
    // the blow the step teaches (only within his reach: a real one; a throw
    // from where he has backed off to, with the thing in his hand)
    const dd = Math.hypot(B.c.pos.x - G.eye.x, B.c.pos.z - G.eye.z);
    if (S.throw && him.holding && him.state === 'move') this.holdT = (this.holdT || 0) + dt; else if (S.throw) this.holdT = 0;
    const inReach = S.throw ? him.holding && (dd > 2.2 || (this.holdT > 2.5 && dd > 1.4)) : dd < 1.75;
    // (the throw: struck off his errand, he goes for a thing again; with none
    // left to throw, the step is let go)
    if (S.throw && !him.holding && !him.task && him.state === 'move' && !this.pending && !(B.flying && B.flying.length) && !this.missed) {
      const it = B.room.hisItem && (B.room.hisItem('plate', B.c.pos) || B.room.hisItem('mug', B.c.pos));
      if (it && this.t < 20) { him.task = { kind: it.kind, item: it, t: 0 }; him.state = 'arm'; him.h = null; }
      else { this.go(this.step + 1); return; }
    }
    if (S.attack && this.t >= this.attackAt && him.state === 'move' && inReach) {
      this.attackAt = Infinity;
      B.hisAttack(S.attack, { slow: S.hand ? LESSON_SLOW : S.throw ? 0.55 : 0 });
      this.pending = true;
      if (S.attack === 'br_jab') this.attackAt = this.t + 1.6;
    }
    // (his blow cut off before it came - a hard punch into the tell knocks
    // him out of it: he goes again in a moment; a throw is pending while the
    // thing is in the air)
    if (this.pending && !(him.state === 'attack' && him.clip === S.attack) && !(S.throw && B.flying && B.flying.length)) {
      this.pending = false;
      B.cards.arrow(null);
      if (!this.missed && !this.covered && this.attackAt === Infinity) this.attackAt = this.t + 1.5;
    }
    // the arrow: from the swinging hand to my safe side, through the tell
    if (S.hand && him.state === 'attack' && him.clip === S.attack) {
      if (him.t < him.strikeAt + 0.05) {
        const hand = B.c.bones[S.hand === 'R' ? 'handR' : 'handL'].getWorldPosition(new THREE.Vector3());
        const a = G.screenOf(hand);
        const W = innerWidth, H = innerHeight;
        const b = { x: S.hand === 'R' ? W * 0.82 : W * 0.18, y: H * 0.46 };
        if (a) B.cards.arrow(a, b);
      } else B.cards.arrow(null);
    }
  }

  finish() {
    const B = this.B;
    B.cards.card('');
    B.cards.arrow(null);
    B.cards.flash('NOW FIGHT.', 1.0);
    B.lessonHold = false; B.lessonBack = false;
    B.him.taunt = null;
    B.him.hp = B.max; B.c.hp = B.max;
    B.him.next = 1.2;
    B.lesson = null;
    B.stats.lesson = +this.total.toFixed(1);
    B.game.emit('brawl:lesson', { done: true, time: this.total });
  }
}

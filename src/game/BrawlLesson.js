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
export const LESSON = [
  null,
  { card: 'HIS GUARD IS DOWN   LEFT CLICK', pic: 'mouseL', taunt: 'L', done: (B) => B.did.jabL },
  { card: 'RIGHT CLICK', pic: 'mouseR', taunt: 'R', done: (B) => B.did.jabR },
  { card: 'GUARD UP: YOUR PUNCHES BOUNCE OFF.   WAIT FOR AN OPENING', pic: null, guard: true, done: (B, L) => L.landedOpen },
  { card: 'HOLD, THEN LET GO   THE LONGER, THE HARDER', pic: 'mouseLR', taunt: 'LR', done: (B) => B.did.hard },
  { card: 'STEP AWAY FROM THE HAND THAT SWINGS', pic: ['D'], attack: 'br_hook', hand: 'R', done: (B, L) => L.missed },
  { card: 'STEP AWAY FROM THE HAND THAT SWINGS', pic: ['A'], attack: 'br_hookL', hand: 'L', done: (B, L) => L.missed },
  { card: 'BLOCK', pic: ['SPACE'], attack: 'br_jab', done: (B, L) => L.covered },
  { card: 'GRAB WHAT IS IN REACH', pic: ['E'], back: true, done: (B, L) => L.t >= 3 || B.did.grab },
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

  go(n) {
    const B = this.B;
    this.step = n;
    this.t = 0;
    this.missed = false; this.covered = false; this.landedOpen = false;
    this.bounced = false; this.lowered = null;
    this.attackAt = LESSON[n] && LESSON[n].attack ? 1.5 : Infinity;
    this.openT = 0;
    this.pending = false;
    B.lessonHold = true;
    B.lessonBack = !!(LESSON[n] && LESSON[n].back);
    const S = LESSON[n];
    if (!S) return;
    // (done already: on to the next)
    if (S.done(B, this) && n < 5) { this.go(n + 1); return; }
    B.him.taunt = S.taunt || null;
    B.him.open.L = 0; B.him.open.R = 0;
    B.cards.card(S.card, S.pic);
    if (S.back && B.room.dotSlide) B.room.dotSlide('lesson');
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
      if (S.hand) { this.B.cards.flash('HE IS OPEN', 0.9); this.openT = 0.9; }
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
    if (him.hp < 70) { him.hp = 70; B.c.hp = 70; }
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
    // the blow the step teaches (only within his reach: a real one)
    const dd = Math.hypot(B.c.pos.x - G.eye.x, B.c.pos.z - G.eye.z);
    if (S.attack && this.t >= this.attackAt && him.state === 'move' && dd < 1.75) {
      this.attackAt = Infinity;
      B.hisAttack(S.attack, { slow: S.hand ? LESSON_SLOW : 0 });
      this.pending = true;
      if (S.attack === 'br_jab') this.attackAt = this.t + 1.6;
    }
    // (his blow cut off before it came - a hard punch into the tell knocks
    // him out of it: he goes again in a moment)
    if (this.pending && !(him.state === 'attack' && him.clip === S.attack)) {
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
    B.him.hp = 100; B.c.hp = 100;
    B.him.next = 1.2;
    B.lesson = null;
    B.stats.lesson = +this.total.toFixed(1);
    B.game.emit('brawl:lesson', { done: true, time: this.total });
  }
}

import * as THREE from 'three';

// The first exchange is the lesson (round 2, docs/story/FIGHT.md §3). He
// rises, squares up and waits: he does not attack until I have been shown
// how to answer. One card at a time, low in the frame, in the typewriter
// face with a small inked picture of the mouse or the keys. The game does
// not pause; he circles and feints. A step I do before it is asked counts
// as taught. Then NOW FIGHT. for a second, his health back to 100, and the
// fight opens; after the lesson the HUD is silent.
//   step 1  LEFT CLICK  left jab                 a left jab lands
//   step 2  RIGHT CLICK  right jab               a right jab lands
//   step 3  HOLD, THEN LET GO                    a hard punch of 0.5 or more lands
//   step 4  a slow right hook (the world at 0.4 x through its tell, an inked
//           arrow from his swinging hand to my safe side): SPACE + D     I slip it
//   step 5  the same from his left: SPACE + A                            I slip it
//   step 6  he jabs: SHIFT  cover up                                     I block one
//   step 7  W A S D move, E grab what is in reach (4 s, he backs off, Dot
//           slides a bottle down the counter)                            4 s, or 1 m
export const LESSON = [
  null,
  { card: 'LEFT CLICK   left jab', pic: 'mouseL', done: (B) => B.did.jabL },
  { card: 'RIGHT CLICK   right jab', pic: 'mouseR', done: (B) => B.did.jabR },
  { card: 'HOLD, THEN LET GO   the longer the wind-up, the harder it lands', pic: 'mouseLR', done: (B) => B.did.hard },
  { card: 'slip away from the hand that swings', pic: ['SPACE', 'D'], attack: 'br_hook', hand: 'R', done: (B, L) => L.slipped },
  { card: 'slip away from the hand that swings', pic: ['SPACE', 'A'], attack: 'br_hookL', hand: 'L', done: (B, L) => L.slipped },
  { card: 'cover up', pic: ['SHIFT'], attack: 'br_jab', done: (B, L) => L.covered },
  { card: 'move      E  grab what is in reach', pic: ['W', 'A', 'S', 'D'], back: true, done: (B, L) => L.t >= 4 || L.moved >= 1 },
];
export const LESSON_SLOW = 0.4;

export class Lesson {
  constructor(B, step = 1) {
    this.B = B;
    this.step = 0;
    this.total = 0;
    this.go(Math.max(1, Math.min(7, step)));
  }

  go(n) {
    const B = this.B;
    this.step = n;
    this.t = 0;
    this.slipped = false; this.covered = false;
    this.moved = 0;
    this.last = B.game.eye.clone();
    this.attackAt = n >= 4 && n <= 6 ? 1.1 : Infinity;
    this.feintAt = 2.4;
    this.openT = 0;
    B.lessonHold = true;
    B.lessonBack = !!(LESSON[n] && LESSON[n].back);
    const S = LESSON[n];
    if (!S) return;
    // (taught already: on to the next)
    if (S.done(B, this) && n < 4) { this.go(n + 1); return; }
    B.cards.card(S.card, S.pic);
    if (S.back && B.room.dotSlide) B.room.dotSlide('lesson');
  }

  // the blows the lesson waits for
  onMyBlow() { /* (the rules keep B.did; done() reads it) */ }
  onHisBlow(clip, how) {
    const S = LESSON[this.step];
    if (!S || !S.attack || clip !== S.attack) return;
    this.B.cards.arrow(null);
    if (how === 'slipped') {
      this.slipped = true;
      this.B.cards.flash('HE IS OPEN', 0.9);
      this.openT = 1.0;
    } else if (how === 'covered') this.covered = true;
    // (missed it: he goes again in a moment)
    if (!this.slipped && !this.covered) this.attackAt = this.t + 1.6;
  }

  update(dt) {
    const B = this.B, him = B.him, G = B.game;
    this.t += dt;
    this.total += dt;
    // (walked, not placed: a step's first moments and any jump of the eye -
    // a scene set, a mode eased in - do not count)
    const e = G.eye, dm = Math.hypot(e.x - this.last.x, e.z - this.last.z);
    if (this.t > 0.3 && dm < 0.1) this.moved += dm;
    this.last.copy(e);
    const S = LESSON[this.step];
    // his hp stays in his measured manner while he is being taught
    if (him.hp < 70) { him.hp = 70; B.c.hp = 70; }
    if (!S) return this.finish();
    // done? (for a slip: after the 0.9 s he is open)
    if (S.done(B, this)) {
      if (this.openT > 0) { this.openT -= dt; if (this.openT > 0) return; }
      if (this.step >= 7) return this.finish();
      this.go(this.step + 1);
      return;
    }
    // his part: the blow the step teaches, slow through its tell
    // (only within his reach: the blow the card teaches must be a real one)
    const dd = Math.hypot(B.c.pos.x - G.eye.x, B.c.pos.z - G.eye.z);
    if (S.attack && this.t >= this.attackAt && him.state === 'move' && dd < 1.7) {
      this.attackAt = Infinity;
      B.hisAttack(S.attack, { slow: S.hand ? LESSON_SLOW : 0 });
      if (S.attack === 'br_jab') this.attackAt = this.t + 1.9;
    }
    // the arrow: from the swinging hand to my safe side, through the tell
    if (S.hand && him.state === 'attack' && him.clip === S.attack) {
      const c = B.c.clip(him.clip);
      if (him.t < c.marks.contact) {
        const hand = B.c.bones[S.hand === 'R' ? 'handR' : 'handL'].getWorldPosition(new THREE.Vector3());
        const a = G.screenOf(hand);
        const W = innerWidth, H = innerHeight;
        const b = { x: S.hand === 'R' ? W * 0.82 : W * 0.18, y: H * 0.46 };
        if (a) B.cards.arrow(a, b);
      } else B.cards.arrow(null);
    }
    // otherwise he circles and feints now and then
    if (!S.attack && this.t >= this.feintAt && him.state === 'move') {
      this.feintAt = this.t + B.rng.range(3.0, 4.5);
      B.hisAttack(B.rng.chance(0.5) ? 'br_feint' : 'br_feintL');
    }
  }

  finish() {
    const B = this.B;
    B.cards.card('');
    B.cards.arrow(null);
    B.cards.flash('NOW FIGHT.', 1.0);
    B.lessonHold = false; B.lessonBack = false;
    B.him.hp = 100; B.c.hp = 100;
    B.him.next = 1.3;
    B.lesson = null;
    B.stats.lesson = +this.total.toFixed(1);
    B.game.emit('brawl:lesson', { done: true, time: this.total });
  }
}

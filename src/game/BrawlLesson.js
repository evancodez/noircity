import * as THREE from 'three';

// The first exchange is the lesson (docs/story/FIGHT.md version 5 §7). He
// squares up and WAITS: he does not hurt me until step 5. One card at a
// time, low in the frame. A step already done is skipped.
//   1  he lowers the hand on the left of the screen   HIS GUARD IS DOWN  LEFT CLICK   my left jab lands
//   2  he lowers the other                            RIGHT CLICK                    my right jab lands
//   3  guard up, both sides                           GUARD UP: ...WAIT FOR AN OPENING
//                                                     one punch blocked (or 3 s); then he lowers a hand and I land one
//   4  both hands down, taunting                      HOLD ON AFTER THE JAB ...      a hard punch of level 2 or 3 lands
//   5  a right hook: the dodge cue, held              (the kit's card: [A] [D] dodge toward the light)   it misses
//   6  the same from his left: the cue, its real window                               it misses
//   7  he throws a plate: the cue on the plate                                        it misses me
//   8  he jabs                                        SPACE  BLOCK                   I block one
//   9  he backs off; Dot slides a bottle down the counter   E  GRAB WHAT IS IN REACH   3 s, or I grab something
// Then NOW FIGHT. for a second; his health is full.
// [C4] version 5: the arrow and the chevron are gone, and so is the slow
// tell of his hooks: the dodge cue does it (game/BrawlCue.js) - its first
// time held, with the kit's teach card ('dodge', once a save); a player hit
// twice in the lesson's dodge steps gets the card again.
// [C4] after the critic: the heavy's card says what to do with the button
// (it read as 'wait'); the block's names what it is for
export const HEAVY_CARD = 'KEEP IT PRESSED: IT LOADS.   LET GO TO HIT';
export const LESSON = [
  null,
  { kind: 'jabL', card: 'HIS GUARD IS DOWN   LEFT CLICK', pic: 'mouseL', taunt: 'L', done: (B) => B.did.jabL },
  { kind: 'jabR', card: 'RIGHT CLICK', pic: 'mouseR', taunt: 'R', done: (B) => B.did.jabR },
  { kind: 'guard', card: 'GUARD UP: HE ANSWERS A PUNCH INTO IT.   WAIT FOR AN OPENING', pic: null, guard: true, done: (B, L) => L.landedOpen },
  { kind: 'hold', card: HEAVY_CARD, pic: 'mouseLR', taunt: 'LR', done: (B) => B.did.hard, nudge: 'KEEP IT PRESSED' },
  { kind: 'hookR', card: '', pic: null, attack: 'br_hook', hand: 'R', dodge: true, done: (B, L) => L.missed },
  { kind: 'hookL', card: '', pic: null, attack: 'br_hookL', hand: 'L', done: (B, L) => L.missed },
  { kind: 'throw', card: '', pic: null, throw: true, attack: 'br_throw', done: (B, L) => L.missed },
  { kind: 'block', card: 'HOLD TO BLOCK HIS JAB', pic: ['SPACE'], attack: 'br_jab', done: (B, L) => L.covered },
  { kind: 'grab', card: 'GRAB WHAT IS IN REACH', pic: ['E'], back: true, done: (B, L) => L.t >= 3 || B.did.grab },
];
const LAST = LESSON.length - 1;
// [C4] after the critic (B1): no step waits on one right action. A step not
// done in `PATIENCE.secs`, or after `PATIENCE.presses` inputs that did not do
// it, lets me go to the next (the fight teaches the rest: the block's and the
// heavy's cards come again there); a step that asks for a press nudges once,
// half way, with what it wants. Hands off, the lesson is cut at 12 s as before.
export const PATIENCE = { secs: 15, presses: 10, nudgeAt: 4 };

export class Lesson {
  constructor(B, step = 1) {
    this.B = B;
    this.step = 0;
    this.total = 0;
    this.hits = 0;
    this.go(Math.max(1, Math.min(LAST, step)));
  }

  // (what the step teaches, by name: the drivers read it, not its number)
  get kind() { return LESSON[this.step] ? LESSON[this.step].kind : null; }

  go(n) {
    const B = this.B;
    this.step = n;
    this.t = 0;
    (B.stats.lessonSteps || (B.stats.lessonSteps = [])).push([n, +(this.total || 0).toFixed(1)]);
    this.missed = false; this.covered = false; this.landedOpen = false; this.stepHits = 0;
    this.bounced = false; this.lowered = null; this.answered = false; this.fetch = false;
    this.attackAt = LESSON[n] && LESSON[n].attack ? 1.5 : Infinity;
    this.openT = 0;
    this.pending = false;
    // ([C4] what I have pressed since the step began: its patience)
    this.inputs0 = B.inputN || 0; this.nudged = false;
    // ([C4] the dodge steps: the first cue is held for the kit's card)
    this.dodge = !!(LESSON[n] && LESSON[n].dodge);
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
    if (how === 'missed') {
      this.missed = true;
      if (S.hand || S.throw) { this.B.cards.flash('HE IS OPEN', 0.9); this.openT = 0.9; }
    } else if (how === 'covered') this.covered = true;
    // (it found me: he goes again in a moment; [C4] hit twice in the dodge
    // steps, the dodge card comes again at the next cue)
    if (!this.missed && !this.covered) {
      this.attackAt = this.t + 1.5;
      if (S.hand || S.throw) { this.hits++; if (this.hits === 2) this.B.reteach = true; }
      // ([C4] three times caught in one step - a dodge, the block: the step
      // lets me go; the lesson is never a wall, the fight teaches the rest)
      this.stepHits = (this.stepHits || 0) + 1;
      if (this.stepHits >= 3) { if (S.attack === 'br_jab') this.covered = true; else this.missed = true; this.B.stats.lessonLetGo = (this.B.stats.lessonLetGo || 0) + 1; }
    }
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
    // ([C4] hands off for twelve seconds at a card that waits on me: he has
    // waited long enough - the lesson is over and the fight is on. Nothing
    // waits for ever on a player who does nothing: he loses, as anywhere)
    if (this.t > 12 && (B.RT || 0) - (B.lastInputT ?? 0) > 12 && !B.cue) { B.stats.lessonCut = this.step; return this.finish(); }
    // ([C4] B1: pressing, but not what the card asks - a nudge half way, then
    // the step lets me go; a step that never came to its blow (he was kept
    // busy, I stood on him) lets me go after its time)
    const pressed = (B.inputN || 0) - this.inputs0;
    if (S.nudge && !this.nudged && pressed >= PATIENCE.nudgeAt && !B.cue) { this.nudged = true; B.cards.flash(S.nudge, 1.6); }
    if (!B.cue && !this.pending && ((this.t > PATIENCE.secs) || (pressed >= PATIENCE.presses && !S.attack && this.t > 4))) {
      B.stats.lessonLetGo = (B.stats.lessonLetGo || 0) + 1;
      (B.stats.lessonPassed || (B.stats.lessonPassed = [])).push(S.kind);
      if (S.kind === 'hold') B.heavyUntaught = true;
      if (S.kind === 'block') B.blockUntaught = true;
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
    // ([C4] pinned against the counter with me on top of him, he throws from
    // where he is: the step never waits on my distance for good)
    const inReach = S.throw ? him.holding && (dd > 2.2 || (this.holdT > 2.5 && dd > 1.4) || (this.holdT > 4 && dd > 0.95)) : dd < 1.75;
    // (the throw: struck off his errand, he goes for a thing again; with none
    // left to throw, the step is let go)
    if (S.throw && !him.holding && !him.task && him.state === 'move' && !this.pending && !(B.flying && B.flying.length) && !this.missed) {
      const it = B.room.hisItem && (B.room.hisItem('plate', B.c.pos) || B.room.hisItem('mug', B.c.pos));
      if (it && this.t < 20) { him.task = { kind: it.kind, item: it, t: 0 }; him.state = 'arm'; him.h = null; }
      else { this.go(this.step + 1); return; }
    }
    if (S.attack && this.t >= this.attackAt && him.state === 'move' && inReach && !B.cue) {
      this.attackAt = Infinity;
      B.hisAttack(S.attack);
      this.pending = true;
      if (S.attack === 'br_jab') this.attackAt = this.t + 1.6;
    }
    // (his blow cut off before it came - a hard punch into the tell knocks
    // him out of it: he goes again in a moment; a throw is pending while the
    // thing is in the air)
    if (this.pending && !(him.state === 'attack' && him.clip === S.attack) && !(S.throw && B.flying && B.flying.length)) {
      this.pending = false;
      if (!this.missed && !this.covered && this.attackAt === Infinity) this.attackAt = this.t + 1.5;
    }
  }

  finish() {
    const B = this.B;
    B.cards.card('');
    // ([C4] the middle of the frame its own: a word of the door's goes)
    if (B.game.hud.msgT > 0) B.game.hud.message('', 0.01);
    B.cards.flash('NOW FIGHT.', 1.0);
    B.lessonHold = false; B.lessonBack = false;
    B.him.taunt = null;
    B.him.hp = B.max; B.c.hp = B.max; B.him.mannerT = B.T;
    // ([C4] and I am whole for the fight itself)
    B.game.health.reset();
    B.him.next = 1.2;
    B.lesson = null;
    B.stats.lesson = +this.total.toFixed(1);
    B.game.emit('brawl:lesson', { done: true, time: this.total });
  }
}
void THREE;

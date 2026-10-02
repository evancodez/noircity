import * as THREE from 'three';
import { BR_ATTACKS } from '../cast/brawl/clips.js';

// [C4] The dodge cue (docs/story/briefs/C4_FIGHT.md §2, FIGHT.md version 5
// §5): every blow of his that must be dodged rather than blocked or simply
// out-punched - his hooks and body hooks, the haymaker, the rush, the shove,
// a swung stool, the bottle neck's thrust, every thrown thing, a room's own
// blows marked `cue` (the foreman's hook) - and that is coming at me where I
// stand: at the moment the blow commits (CUE.k * CUE.window of world time
// before it lands) the world drops to about a third of its speed while my
// hands, my look and my keys run on at full speed, and the frame says which
// side to go to: the side the blow comes from goes black, the safe side
// opens up white, the fist (or the thing) is rimmed in white
// (FightCards.cue). The window is CUE.window of REAL time.
//   A or D toward the light inside it: a clean slip - the blow passes where
//   my head was, he is open and my next blow is a counter (his miss: the
//   existing half again); the world comes back the instant I press.
//   The wrong side, or late: it lands (the wrong side into a swing: a
//   quarter harder, as ever). S, SPACE, a punch, E: the world comes back and
//   the old rules judge (a back-step leaves some blows; the block its own).
// The small blows - his jab, the cross, his answer to a punch into his guard
// - have no cue: the body's tell alone (a cue on every jab made the fight a
// quick-time event).
// The lesson's first cue is held (the kit's held teach card: time crawls
// until the key toward the light is pressed; the other is not taken).
export const CUE = {
  window: 0.34,     // s of real time to press in (a first-timer gets about half; a practised player nearly all)
  lessonWindow: 0.46,   // s, the lesson's (after its first, held)
  k: 1 / 3,         // the world's speed under it
  in: 0.05,         // s (real) the ink takes to press in
  aimOff: 0.25,     // m: a straight blow or a throw aimed this far to the dark side of me
};
const SMALL = /^br_(jab|jabR|cross|answerL|answerR|feint|feintL)$/;
// a blow of his that gets the cue
export function cued(clip) {
  const A = BR_ATTACKS[clip];
  if (!A || SMALL.test(clip) || A.answer) return false;
  if (A.cue === false) return false;
  return A.cue === true || A.kind === 'swing' || A.kind === 'over' || A.kind === 'rush' || A.kind === 'shove' || A.kind === 'throw' || A.kind === 'long' || clip === 'br_bottle' || clip === 'br_bottle_thrust';
}
const _v = new THREE.Vector3();

export class DodgeCue {
  // B: the Brawl. spec: { clip, A, side (the safe side of my screen), remain
  // (world s to contact), flying (a thrown thing) }
  constructor(B, { clip, A, side, remain, flying = null, held = false }) {
    this.B = B;
    this.clip = clip; this.A = A; this.side = side; this.flying = flying;
    this.from = side === 'L' ? 'R' : 'L';
    // (in the lesson a little longer: it is being learnt)
    this.window = B.lesson ? CUE.lessonWindow : CUE.window;
    // (the world's speed: the window holds what is left of the blow, in real
    // time, at about a third - less if the blow is nearer than that)
    this.k = Math.max(0.06, Math.min(1, remain / this.window));
    this.t = 0;                 // real time under it
    this.vis = 0;               // how far the ink has pressed in (0..1)
    this.answer = null;
    this.held = held;
    this.done = false;
    B.game.worldK = this.k;
    const S = B.stats.cues || (B.stats.cues = { shown: 0, right: 0, wrong: 0, late: 0, act: 0, held: 0, list: [] });
    S.shown++;
    if (held) S.held++;
    this.rec = { clip, side, k: +this.k.toFixed(2), t0: +(B.RT || 0).toFixed(3), answer: null, at: null };
    if (S.list.length < 200) S.list.push(this.rec);
    B.sfx('c4cue', null, { k: this.k });
    if (B.game.sfx && B.game.sfx.duck) B.game.sfx.duck(0.75, 0.6);
    B.game.emit('brawl:cue', { clip, side });
  }

  // a key toward the dark under a held cue is not taken (the lesson's first)
  refuse(code) {
    if (!this.held || this.done) return false;
    if (code === 'KeyS') return true;
    const right = (code === 'KeyD' && this.side === 'R') || (code === 'KeyA' && this.side === 'L');
    if (!right) { this.B.stats.cues.refused = (this.B.stats.cues.refused || 0) + 1; return true; }
    return false;
  }

  // I did something: a hop (code), a punch, the block, a grab
  act(kind, code = null) {
    if (this.done) return;
    if (kind === 'hop') {
      if (code === 'KeyS') return this.end('act');
      const right = (code === 'KeyD' && this.side === 'R') || (code === 'KeyA' && this.side === 'L');
      return this.end(right ? 'right' : 'wrong');
    }
    this.end('act');
  }

  // per step, my clock: the ink in; the window closes in real time (a held
  // cue waits for its card)
  step(dt) {
    if (this.done) return;
    this.t += dt;
    const B = this.B, him = B.him;
    // (the blow cut off - he was struck, the thing fell - the cue goes)
    if (!this.flying && !(him.state === 'attack' && him.clip === this.clip)) { this.end('gone'); return; }
    if (this.flying && (this.flying.judged || !B.flying || !B.flying.includes(this.flying))) { this.end('gone'); return; }
    if (this.held) {
      // (held while the kit holds its card; let go by it - the card's own
      // hold ran out - the rest of the window runs)
      const K = B.game.hud && B.game.hud.kit, cur = K && K.teachCur;
      const still = cur && this.teach && cur.h === this.teach && cur.held;
      if (!still && this.t > 0.1) { this.held = false; this.t = this.window * 0.5; }
      return;
    }
    if (this.t >= this.window) this.end('late');
  }

  end(answer) {
    if (this.done) return;
    this.done = true;
    this.answer = answer;
    const B = this.B;
    B.game.worldK = 1;
    this.rec.answer = answer; this.rec.at = +this.t.toFixed(3);
    const S = B.stats.cues;
    if (S[answer] != null) S[answer]++;
    if (answer === 'right') {
      // the slip: whatever the room let my feet do, the blow goes by
      if (this.flying) this.flying.slipped = true;
      else B.him.slipped = this.clip;
      B.sfx('c4slip', null, {});
      B.did.slip = true;
    }
    if (this.teach && !this.teach.done && B.game.hud.teach.dismiss && answer !== 'right') { /* the card goes by itself */ }
    B.lastCue = this;
    B.cue = null;
    B.cards.cue(null, answer);
  }

  // the cue on the frame: the dark side, the light side, the rim on what comes
  draw(dt) {
    if (this.done) return;
    const B = this.B, G = B.game;
    this.vis = Math.min(1, this.vis + dt / CUE.in);
    let at = null, r = 0.1;
    if (this.flying) {
      const F = this.flying;
      const p = F.c ? F.o.localToWorld(_v.copy(F.c)) : _v.copy(F.o.position);
      at = G.screenOf(p); r = F.rad || 0.1;
    } else {
      const hand = this.A && (this.A.hand === 'L' ? 'L' : 'R');
      const bone = B.c.bones[hand === 'L' ? 'handL' : 'handR'];
      if (bone) { const p = bone.getWorldPosition(_v); at = G.screenOf(p); r = 0.11; }
      if (this.A && this.A.kind === 'rush') { const ch = B.c.bones.chest.getWorldPosition(_v); at = G.screenOf(ch); r = 0.35; }
    }
    let px = 40;
    if (at) {
      const d = Math.max(0.3, G.camera.position.distanceTo(_v));
      px = Math.max(26, Math.min(150, r / d * innerHeight * 0.9));
    }
    B.cards.cue({ side: this.side, k: this.vis, t: this.t, held: this.held, at, px, kind: this.flying ? 'thing' : (this.A && this.A.kind) || 'swing' });
  }
}

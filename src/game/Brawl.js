import * as THREE from 'three';
import { buildProp } from '../props/index.js';

// The fist fight's rules (docs/story/CONTRACTS.md §14, lane 7's brief P0.3):
// a rules engine over clips and their marks, no physics. Timing is data:
// every number of a blow comes from the clip (hands.clip(name).marks for
// mine, c.clip(name).marks for his), so art can retime a clip and the fight
// still reads it right.
//   game.brawl.start({ opponent, round, ring, room, onRetry, onKO })
//   game.brawl.stop()    .active   .round   .me   .him   .stats
// Resolution happens at a blow's `contact` mark, by what the other man is
// doing at that instant:
//   my jab       lands unless he guards high (not open, not stunned, not
//                reeling from a blow, not in an attack's recovery); a jab
//                into his guard is a dull thud, no damage, and he may counter
//   my heavy     (RMB held 0.25..0.7 s, released) 9..16 by the hold; into his
//                guard it drives through for 40 % and knocks him back
//   his jab      block it, or slip it (either way)
//   his hook     (his right hand, my left) slip AWAY from it (D), or block
//                it for chip damage; slipping into it (A) is a hit
//   his haymaker only slipped; blocking it breaks my guard (0.6 s stagger)
//   his bottle   blocking breaks the bottle; slip
//   a slipped attack leaves him open 0.9 s: my hits count double and a
//   heavy hit stuns him (br_stun: the combo window)
// Rounds flow (no bell): one to 66, two to 33 (the bottle, Dot's bottle on
// the counter, plates and stools in reach), three to 0 (the haymaker,
// faster, wilder, he bleeds). At 0 he reels back down the aisle; my next
// heavy is the last (br_ko_window, through the end bay's glass).
// Losing is not failing: at 0 health the frame goes black, and after 1.5 s
// I am up at the start of the round with 60.
// The room takes part: a heavy that lands with his back within 1.2 m of the
// stools, the jukebox or the pie case throws him into it (once each a round).
// Hit feel: a landed heavy freezes the simulation 3 steps (game.hitStop), a
// jab 1; the last blow runs at 0.35 x for 0.8 s (game.timeScale).
// Randomness: his choices draw from a fork of the scene's rng (seeded: a
// preset at t= always shows the same fight).
export const BRAWL = {
  himHp: 100, meHp: 100, retryHp: 60,
  rounds: [66, 33, 0],                 // his health at which each round ends
  his: { br_jab: 6, br_hook: 12, br_haymaker: 22, br_bottle: 18 },
  chip: { br_hook: 3, br_haymaker: 6, br_bottle: 4 },
  // (tuned from the brief's starting numbers - jab 3, heavy 9..16, bottle 22,
  // plate 12, stool 30 - so the autoplay, a careful player, wins in about
  // 90 s with half his health, and a first-timer in two minutes or so)
  mine: { jab: 2.5, heavyMin: 8, heavyMax: 13, bottle: 18, plate: 10, stool: 24, guarded: 0.3 },
  open: 0.9, stagger: 0.6, down: 1.5, throwNear: 1.2,
  hitStop: { heavy: 3, jab: 1 }, slowmo: { k: 0.35, dur: 0.8 },
  reach: { counter: 1.65, floor: 1.3 },
  // his pace per round: the quiet between his attacks (s), what he throws
  pace: [
    { gap: [1.3, 2.1], mix: { br_jab: 0.62, br_hook: 0.38 }, low: 0.16, combo: 0 },
    { gap: [1.0, 1.6], mix: { br_jab: 0.35, br_hook: 0.3, br_bottle: 0.35 }, low: 0.12, combo: 0.2 },
    { gap: [0.6, 1.1], mix: { br_jab: 0.22, br_hook: 0.3, br_haymaker: 0.36, br_bottle: 0.12 }, low: 0.1, combo: 0.4 },
  ],
};
const HIS_ATTACKS = ['br_jab', 'br_hook', 'br_haymaker', 'br_bottle'];
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _a = new THREE.Vector3(), _b = new THREE.Vector3();

export class Brawl {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.round = 0;
    this.stats = { landed: 0, taken: 0, blocked: 0, slipped: 0, throws: 0, downs: 0, time: 0 };
  }

  get hands() { return this.game.player.hands; }
  get controller() { return this.game.controller; }

  // ---- start / stop ---------------------------------------------------------------------
  // opponent: the Character; round 1..3; ring: { x, z, r, z0, z1 } (the
  // aisle he can be driven along); room: { stools: [{ object, handle, pos }],
  // jukebox, pieCase, items: () => [{ name, object, kind, pos }] };
  // onRetry(round): re-stage the round (losing); onKO(): the last blow is in
  start({ opponent, round = 1, ring, room = {}, rng, onRetry = null, onKO = null, onGlass = null, onLanded = null, hp = null, myHp = null }) {
    const G = this.game;
    this.active = true;
    this.finished = false;
    this.done = false;
    this.fadeBack = 0;
    this.opts = { onRetry, onKO, onGlass, onLanded };
    this.ring = { ...ring };
    this.room = room;
    this.rng = rng;
    this.round = round;
    this.roundStart = round;
    this.c = opponent;
    const him = {
      hp: hp ?? (round === 1 ? BRAWL.himHp : BRAWL.rounds[round - 2]),
      state: 'guard', clip: null, t: 0, next: 1.4, open: 0, lowT: 0, guardLow: false,
      z: opponent.pos.z, combo: 0, bottle: null, thrown: new Set(), reelTo: null, pending: null, hitsInRow: 0, lastHitT: -9,
    };
    this.him = him;
    opponent.hp = him.hp;
    this.me = { state: 'idle', h: null, t: 0, slip: 0, slipDir: 0, windT: 0, release: false, jabHand: 'L', buffered: false, holding: null, heavyK: 0 };
    if (myHp != null) G.health.hp = myHp;
    this.taught = this.taught || {};
    this.T = 0;
    opponent.setState('br_guard');
    this.hands.play('guard');
    this.round0 = round;
    G.emit('brawl:round', { n: round });
    return this;
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    const C = this.controller;
    C.slip = 0;
    this.hands.hold(null, 'R');
    this.game.hud.clearPrompt('brawl');
  }

  // a call a little later, on game time
  later(s, fn) { (this.timers || (this.timers = [])).push({ at: this.T + s, fn }); }

  // ---- per step (Game.post, before the scene's script) ------------------------------------
  update(dt) {
    if (!this.active) return;
    const G = this.game;
    this.T += dt;
    if (this.timers && this.timers.length) for (const x of [...this.timers]) if (this.T >= x.at) { this.timers.splice(this.timers.indexOf(x), 1); x.fn(); }
    this.stats.time += dt;
    // (no regeneration in a fist fight: what he takes, he keeps)
    G.health.sinceHit = 0;
    if (this.fadeBack > 0) { this.fadeBack -= dt; G.hud.fade(Math.max(0, this.fadeBack / 0.6)); }
    if (this.me.state === 'down') { this.stepDown(dt); return; }
    this.input(dt);
    this.stepMe(dt);
    this.stepHim(dt);
    this.stepRing(dt);
    this.teach(dt);
  }

  // ---- my side ------------------------------------------------------------------------------
  input() {
    const G = this.game, me = this.me, him = this.him;
    if (me.state === 'down' || me.state === 'stagger' || me.state === 'hurt' || this.finished) return;
    const H = this.hands;
    const blockHeld = G.held('Space');
    // at 0 he reels: only the last heavy matters (a jab still rocks him)
    // block: held SPACE (up in 0.1 s, held)
    if (me.state === 'idle' && blockHeld) { me.state = 'block'; me.h = H.play('block'); return; }
    if (me.state === 'block' && !blockHeld) { me.state = 'idle'; me.h = H.play('guard'); return; }
    // slips: A / D from guard or block
    const slip = G.pressed('KeyA') ? -1 : G.pressed('KeyD') ? 1 : 0;
    if (slip && (me.state === 'idle' || me.state === 'block')) {
      me.state = 'slip'; me.slipDir = slip;
      me.h = H.play(slip < 0 ? 'slipL' : 'slipR');
      this.sfx('scuff', null, {});
      return;
    }
    // E: grab what is in reach
    if (G.pressed('KeyE') && me.state === 'idle' && !me.holding) {
      const it = this.reachable();
      if (it) { this.grab(it); return; }
    }
    // LMB: a jab (alternating hands; one more can be buffered), or the swing
    // of what I hold
    if (G.pressed('Mouse0')) {
      if (me.holding && me.state === 'idle') { this.swing(); return; }
      if (me.state === 'idle') { this.jab(); return; }
      if (me.state === 'jab' && me.h && me.h.t > 0.1) me.buffered = true;
    }
    // RMB held: the wind; released: the heavy
    if (G.pressed('Mouse2') && me.state === 'idle' && !me.holding) {
      me.state = 'wind'; me.windT = 0; me.release = false;
      me.h = H.play('heavyWind');
      this.sfx('wind', null, {});
    }
    if (me.state === 'wind' && (G.released('Mouse2') || !G.held('Mouse2'))) me.release = true;
  }

  jab() {
    const me = this.me, H = this.hands;
    const name = me.jabHand === 'L' ? 'jabL' : 'jabR';
    me.jabHand = me.jabHand === 'L' ? 'R' : 'L';
    me.state = 'jab'; me.buffered = false;
    me.h = H.play(name, { onMark: { contact: () => this.myContact('jab', 0) } });
    this.stats.jabs = (this.stats.jabs || 0) + 1;
  }

  heavy() {
    const me = this.me, H = this.hands;
    const { marks } = H.clip('heavyWind');
    const c0 = marks.charged, c1 = H.clip('heavyWind').duration;
    me.heavyK = Math.max(0, Math.min(1, (me.windT - c0) / Math.max(1e-3, c1 - c0)));
    me.state = 'heavy';
    me.h = H.play('heavyHit', { onMark: { contact: () => this.myContact('heavy', me.heavyK) } });
  }

  swing() {
    const me = this.me, H = this.hands;
    const it = me.holding;
    const clip = it.kind === 'stool' ? 'swingStool' : it.kind === 'plate' ? 'swingPlate' : 'swingBottle';
    me.state = 'swing';
    me.h = H.play(clip, { onMark: { contact: () => this.myContact(it.kind, 1) } });
    this.sfx('whiff', null, { k: it.kind === 'stool' ? 1 : 0.7 });
  }

  grab(it) {
    const me = this.me, H = this.hands, G = this.game;
    me.state = 'grab';
    me.h = H.play('grab', { onMark: { taken: () => {
      const o = it.take ? it.take() : it.object;
      if (!o) return;
      if (it.handle) G.stage.breakables.remove(it.handle);
      me.holding = { kind: it.kind, object: o, name: it.name };
      H.hold(o, 'R');
      this.sfx('grab_' + it.kind, null, {});
    } } });
    this.stats.grabs = (this.stats.grabs || 0) + 1;
  }

  stepMe(dt) {
    const me = this.me, H = this.hands, C = this.controller, G = this.game;
    me.t += dt;
    if (me.state === 'wind') {
      me.windT += dt;
      const { marks, duration } = H.clip('heavyWind');
      if ((me.release && me.windT >= marks.charged) || me.windT >= duration) this.heavy();
    }
    if (me.state === 'slip') {
      const { duration } = H.clip(me.slipDir < 0 ? 'slipL' : 'slipR');
      const u = me.h ? Math.min(1, me.h.t / duration) : 1;
      // the eye moves off the line and back: out fast, back slower
      C.slip = me.slipDir * 0.36 * Math.sin(Math.PI * Math.pow(u, 0.75));
    } else if (C.slip) C.slip *= Math.exp(-dt * 18);
    if (me.state === 'stagger' || me.state === 'hurt') {
      me.stun -= dt;
      if (me.stun <= 0) { me.state = 'idle'; me.h = H.play(G.held('Space') ? 'block' : 'guard'); if (G.held('Space')) me.state = 'block'; }
      return;
    }
    if (me.state === 'down') return;
    // a clip ran out: back to the guard (a buffered jab goes at once)
    if ((me.state === 'jab' || me.state === 'heavy' || me.state === 'slip' || me.state === 'grab' || me.state === 'swing') && (!me.h || me.h.done)) {
      if (me.state === 'jab' && me.buffered) { this.jab(); return; }
      me.state = 'idle';
      me.h = H.play('guard');
    }
  }

  // is his guard up at this instant?
  guarding() {
    const him = this.him;
    if (him.open > 0 || him.state === 'stun' || him.state === 'react' || him.state === 'reel' || him.state === 'thrown') return false;
    if (him.state === 'attack') {
      // (after his blow has landed or missed he is open until he recovers)
      const c = this.c.clip(him.clip).marks.contact;
      return him.t < c - 0.05;
    }
    return !him.guardLow;
  }

  // my blow arrives
  myContact(kind, k) {
    const G = this.game, him = this.him, c = this.c, me = this.me;
    if (!this.active || this.finished) return;
    const M = BRAWL.mine;
    const head = _a.setFromMatrixPosition(c.bones.head.matrixWorld);
    const dir = _b.subVectors(head, G.eye).setY(0).normalize();
    const item = kind === 'bottle' || kind === 'plate' || kind === 'stool';
    // the last blow: he is reeling at 0; my heavy (or a swing) puts him out
    if (him.state === 'reel' || (him.hp <= 0 && !item && kind === 'heavy')) {
      if (kind === 'heavy' || item) { if (item) this.breakHeld(head, dir); this.ko(); return; }
      this.react(kind, dir, 0.3);
      this.sfx('jab', head, {});
      return;
    }
    if (him.state === 'thrown') { this.sfx('whiff', null, { k: 0.5 }); return; }
    const guarded = !item && this.guarding();
    let dmg, power;
    if (kind === 'jab') {
      if (guarded) {
        this.stats.blockedMine = (this.stats.blockedMine || 0) + 1;
        this.sfx('blocked', head, { k: 0.6 });
        G.fx.hit.punch(head.clone().addScaledVector(dir, -0.25).setY(head.y - 0.2), dir.clone().negate(), 0.2);
        // (he may answer a jab into his guard with one of his own)
        if (him.state === 'guard' && this.rng.chance(0.3 + 0.1 * this.round)) him.next = Math.min(him.next, 0.15);
        return;
      }
      // (three jabs in a row and he covers up, unless he is open)
      if (him.hitsInRow >= 3 && him.open <= 0 && him.state !== 'stun' && this.T - him.lastHitT < 1.2) {
        this.sfx('blocked', head, { k: 0.6 }); him.hitsInRow = 0; him.state = 'guard'; c.setState('br_guard'); him.guardLow = false; return;
      }
      dmg = M.jab; power = 0.35;
    } else if (kind === 'heavy') {
      dmg = M.heavyMin + (M.heavyMax - M.heavyMin) * k;
      power = 0.6 + 0.4 * k;
      if (guarded) { dmg *= M.guarded; power *= 0.6; }
    } else {
      dmg = M[kind]; power = 1;
      this.breakHeld(head, dir);
    }
    if (him.open > 0 && !guarded) dmg *= 2;
    this.damageHim(dmg);
    this.stats.landed++;
    him.hitsInRow = this.T - him.lastHitT < 1.2 ? him.hitsInRow + 1 : 1;
    him.lastHitT = this.T;
    G.emit('brawl:hit', { by: 'me', kind, power, zone: kind === 'heavy' && guarded ? 'body' : 'head' });
    // the feel
    const heavy = kind !== 'jab';
    G.hitStop = Math.max(G.hitStop || 0, heavy ? BRAWL.hitStop.heavy : BRAWL.hitStop.jab);
    this.controller.shake(heavy ? 0.28 : 0.1, 0);
    G.fx.hit.punch(head.clone().addScaledVector(dir, -0.12), dir.clone(), this.round >= 3 && heavy ? 0.85 : heavy ? 0.6 : 0.3);
    this.sfx(kind === 'jab' ? 'jab' : kind === 'heavy' ? 'heavy' : 'break_' + kind, head, { k: power });
    if (heavy && kind !== 'jab') this.sfx('hisGrunt', head, { k: power });
    // what it does to him
    if (him.hp <= 0) { this.startReel(); return; }
    if (heavy) {
      // knocked back down the aisle
      him.push = (him.push || 0) + (guarded ? 0.2 : 0.38);
      if (this.tryThrow(dir)) return;
      if (him.open > 0 && kind === 'heavy') { this.stun(); return; }
    }
    this.react(kind, dir, power);
  }

  // what I hold breaks on him
  breakHeld(at, dir) {
    const me = this.me, G = this.game, H = this.hands;
    const it = me.holding;
    if (!it) return;
    me.holding = null;
    const o = H.hold(null, 'R');
    if (o) {
      // back into the room at his head, and broken there
      G.stage.scene.add(o);
      o.position.copy(at).addScaledVector(dir, -0.15).setY(at.y - 0.3);
      o.updateMatrixWorld(true);
      const B = G.stage.breakables;
      const h = B.add(o, { kind: it.kind, hp: 1, solid: false });
      B.hit(h, { point: at.clone(), dir: dir.clone(), power: 9, by: 'body' });
    }
  }

  damageHim(n) {
    const him = this.him, prev = him.hp;
    him.hp = Math.max(0, him.hp - n);
    this.c.hp = him.hp;
    // the rounds flow: crossing 66 / 33 starts the next
    for (let r = this.round; r < 3; r++) {
      if (prev > BRAWL.rounds[r - 1] && him.hp <= BRAWL.rounds[r - 1]) this.nextRound();
    }
  }

  nextRound() {
    this.round = Math.min(3, this.round + 1);
    const him = this.him;
    him.thrown.clear();
    this.game.emit('brawl:round', { n: this.round });
    // (a breath: he steps off, the next round's first attack comes a little later)
    him.next = Math.max(him.next, 1.2);
  }

  react(kind, dir, power) {
    const him = this.him, c = this.c;
    if (him.state === 'attack' && kind === 'jab' && this.c.clip(him.clip).marks.contact > him.t) {
      // a jab does not stop a haymaker already coming
      if (him.clip === 'br_haymaker') return;
    }
    const clip = kind === 'heavy' || kind === 'stool' ? 'br_hitBody' : this.rng.chance(0.5) ? 'br_hitHeadL' : 'br_hitHeadR';
    him.state = 'react'; him.clip = clip; him.t = 0;
    c.play(clip);
    // (after a blow he comes back at me: the next attack a little sooner)
    him.next = Math.min(Math.max(him.next, 0.5), 1.0);
  }

  stun() {
    const him = this.him;
    him.state = 'stun'; him.clip = 'br_stun'; him.t = 0; him.open = 0;
    this.c.play('br_stun');
    this.sfx('stun', null, {});
  }

  startReel() {
    const him = this.him, c = this.c;
    him.state = 'reel'; him.clip = null; him.t = 0; him.open = 0;
    // he staggers back down the aisle toward the end bay, groggy
    him.reelTo = this.ring.koZ;
    c.play('br_stun', { hold: true });
    this.game.emit('brawl:reel', {});
  }

  // a heavy with his back to the stools, the jukebox or the pie case
  tryThrow(dir) {
    const him = this.him, c = this.c, R = this.room;
    const back = V(c.pos.x + dir.x * 0.5, 0, c.pos.z + dir.z * 0.5);
    const near = (p) => p && Math.hypot(p.x - back.x, p.z - back.z) < BRAWL.throwNear;
    let what = null, target = null;
    if (!him.thrown.has('jukebox') && R.jukebox && near(R.jukebox.pos)) { what = 'jukebox'; target = R.jukebox.pos; }
    else if (!him.thrown.has('piecase') && R.pieCase && near(R.pieCase.pos)) { what = 'piecase'; target = R.pieCase.pos; }
    else if (!him.thrown.has('stools') && R.stools) {
      const s = R.stools.filter((st) => !st.handle.toppled && !st.handle.broken && near(st.pos));
      if (s.length) { what = 'stools'; target = s[0].pos; him.throwStools = s; }
    }
    if (!what) return false;
    him.thrown.add(what);
    this.stats.throws++;
    const clip = 'br_into_' + what;
    him.state = 'thrown'; him.clip = clip; him.t = 0;
    him.throwFrom = V(c.pos.x, 0, c.pos.z);
    // (he goes most of the way to it; his back hits it)
    const to = V(target.x, 0, target.z);
    const d = to.clone().sub(him.throwFrom);
    const L = d.length();
    him.throwTo = him.throwFrom.clone().addScaledVector(d, Math.max(0, (L - 0.45) / Math.max(L, 1e-3)));
    c.play(clip, { onMark: { impact: () => this.throwImpact(what, dir) } });
    this.game.emit('brawl:throw', { into: what });
    return true;
  }

  throwImpact(what, dir) {
    const G = this.game, R = this.room, him = this.him;
    const at = V(this.c.pos.x, 1.0, this.c.pos.z);
    if (what === 'stools') {
      for (const st of him.throwStools || []) G.stage.breakables.topple(st.handle, V(st.pos.x - at.x, 0, st.pos.z - at.z).add(dir));
      this.sfx('bodyStools', at, {});
    } else if (what === 'jukebox') {
      // (the record skips, then the next one drops)
      R.jukebox.hit(1.2);
      if (R.jukebox.next) this.later(1.1, () => R.jukebox.next());
      this.sfx('bodyThud', at, { k: 1 });
    } else if (what === 'piecase') {
      if (R.pieCase.pane) G.stage.glass.shatter(R.pieCase.pane, { dir, power: 1.5 });
      else if (R.pieCase.handle) G.stage.breakables.hit(R.pieCase.handle, { point: at, dir, power: 9, by: 'body' });
      this.sfx('bodyThud', at, { k: 0.8 });
    }
    this.controller.shake(0.35, 1.5);
    G.hitStop = Math.max(G.hitStop || 0, 2);
  }

  // ---- his side -------------------------------------------------------------------------------
  stepHim(dt) {
    const him = this.him, c = this.c, G = this.game;
    him.t += dt;
    if (him.state === 'ko') { this.stepKO(dt); return; }
    if (him.open > 0) him.open -= dt;
    if (!c.alive && him.state !== 'ko') return;
    c.lookAt(G.eye);
    switch (him.state) {
      case 'guard': {
        if (this.me.state === 'down') return;
        // now and then he drops his hands (cocky, tired): a moment to hit
        if (him.guardLow) {
          him.lowT -= dt;
          if (him.lowT <= 0) { him.guardLow = false; c.setState('br_guard'); }
        }
        him.next -= dt;
        if (him.next <= 0) this.attack();
        break;
      }
      case 'attack': {
        const clip = c.clip(him.clip);
        if (him.t >= clip.duration) this.backToGuard();
        break;
      }
      case 'react': case 'stun': {
        const clip = c.clip(him.clip);
        if (him.t >= clip.duration) this.backToGuard();
        break;
      }
      case 'thrown': {
        const clip = c.clip(him.clip), u = him.t / clip.duration;
        // out to the thing by the impact, then back into the aisle
        const imp = clip.marks.impact / clip.duration;
        const k = u < imp ? Math.sin((u / imp) * Math.PI / 2) : 1 - Math.pow((u - imp) / (1 - imp), 2) * 0.85;
        const p = him.throwFrom.clone().lerp(him.throwTo, Math.max(0, Math.min(1, k)));
        c.place({ x: p.x, z: p.z }, c.yaw);
        if (u >= 1) { c.place({ x: this.ring.x, z: him.throwFrom.z }, c.yaw); him.z = him.throwFrom.z; this.backToGuard(); }
        break;
      }
      case 'reel': {
        // groggy steps back to the end bay; the camera follows him down
        const z = c.pos.z, dz = him.reelTo - z;
        if (Math.abs(dz) > 0.02) { const s = Math.sign(dz) * Math.min(Math.abs(dz), dt * 1.1); him.z = z + s; }
        break;
      }
    }
  }

  backToGuard() {
    const him = this.him, c = this.c, P = BRAWL.pace[this.round - 1];
    him.state = 'guard'; him.clip = null; him.t = 0;
    c.setState('br_guard');
    if (him.pending) { him.next = 0.12; return; }
    if (him.next < 0.3) him.next = this.rng.range(P.gap[0], P.gap[1]);
    // hands low for a moment
    if (this.rng.chance(P.low)) { him.guardLow = true; him.lowT = this.rng.range(0.6, 1.0); c.setState('idle', 0.2); }
  }

  attack() {
    const him = this.him, c = this.c, P = BRAWL.pace[this.round - 1];
    let clip = him.pending;
    him.pending = null;
    if (!clip) {
      // what he throws: the round's mix (the bottle only while he has one)
      const mix = { ...P.mix };
      if (!him.bottle) delete mix.br_bottle;
      let tot = 0; for (const v of Object.values(mix)) tot += v;
      let x = this.rng.next() * tot;
      clip = 'br_jab';
      for (const [k, v] of Object.entries(mix)) { x -= v; if (x <= 0) { clip = k; break; } }
      // (round three: a hook after a jab, the wild ones)
      if (this.rng.chance(P.combo)) him.pending = clip === 'br_jab' ? 'br_hook' : 'br_jab';
    }
    if (him.guardLow) { him.guardLow = false; }
    him.state = 'attack'; him.clip = clip; him.t = 0;
    him.next = this.rng.range(P.gap[0], P.gap[1]);
    c.play(clip, { onMark: {
      tell: () => this.sfx('tell', null, { kind: clip }),
      contact: () => this.hisContact(clip),
    } });
    this.stats.his = (this.stats.his || 0) + 1;
    this.game.emit('brawl:tell', { clip });
    this.firstOf = this.firstOf || {};
    if (!this.firstOf[clip]) this.firstOf[clip] = this.T;
  }

  // his blow arrives
  hisContact(clip) {
    const G = this.game, me = this.me, H = this.hands, him = this.him;
    if (!this.active || this.finished || me.state === 'down') return;
    const S = H.clip(me.slipDir < 0 ? 'slipL' : 'slipR');
    const safe = me.state === 'slip' && me.h && me.h.t >= S.marks.safe && me.h.t <= (S.marks.safeEnd ?? 0.3);
    const blocking = me.state === 'block';
    const dmg = BRAWL.his[clip];
    const eye = G.eye;
    const from = _a.setFromMatrixPosition(this.c.bones.head.matrixWorld);
    const dir = _b.subVectors(eye, from).setY(0).normalize();
    // slipped: away from a hook's hand (his right, my left: slip right), any
    // way for the rest
    if (safe && (clip !== 'br_hook' || me.slipDir > 0)) {
      this.stats.slipped++;
      him.open = BRAWL.open;
      this.sfx('whiff', null, { k: 1 });
      G.emit('brawl:hit', { by: 'him', kind: clip, power: 0, zone: 'miss' });
      return;
    }
    if (blocking && clip !== 'br_haymaker') {
      this.stats.blocked++;
      const chip = BRAWL.chip[clip] || 0;
      if (chip) this.hurtMe(chip, dir, { soft: true });
      this.sfx('blocked', eye, { k: clip === 'br_jab' ? 0.7 : 1 });
      H.play('blockHit');
      me.h = null;
      me.state = 'hurt'; me.stun = H.clip('blockHit').duration;
      if (clip === 'br_bottle' && him.bottle) this.breakHisBottle();
      return;
    }
    if (blocking && clip === 'br_haymaker') {
      // it goes through the guard: staggered
      this.hurtMe(BRAWL.chip.br_haymaker, dir, {});
      me.state = 'stagger'; me.stun = BRAWL.stagger;
      H.play('hurt');
      this.controller.shake(0.45, 0);
      this.sfx('guardBreak', eye, {});
      return;
    }
    this.hurtMe(dmg, dir, {});
  }

  hurtMe(n, dir, { soft = false } = {}) {
    const G = this.game, me = this.me, H = this.hands;
    this.stats.taken++;
    this.stats.dmgTaken = (this.stats.dmgTaken || 0) + n;
    G.emit('brawl:hit', { by: 'him', kind: 'hit', power: n / 20, zone: 'head' });
    if (!soft) {
      this.controller.shake(0.25 + n / 40, 0);
      this.sfx('punchMe', null, { k: Math.min(1, n / 18) });
      this.sfx('myGrunt', null, { k: Math.min(1, n / 18) });
      if (me.state !== 'down') { me.state = 'hurt'; me.stun = H.clip('hurt').duration; H.play('hurt'); }
      if (me.holding && n >= 12) { const o = H.hold(null, 'R'); me.holding = null; if (o) o.visible = false; }
      // (a big one moves me back: the ring comes up the aisle)
      this.him.push = (this.him.push || 0) - n * 0.012;
    }
    G.health.damage(n);
  }

  breakHisBottle() {
    const him = this.him, c = this.c, G = this.game;
    const b = him.bottle;
    him.bottle = null;
    if (!b) return;
    const at = b.getWorldPosition(new THREE.Vector3());
    c.hold(null, 'R');
    G.stage.scene.add(b);
    b.position.copy(at);
    b.updateMatrixWorld(true);
    const B = G.stage.breakables;
    B.hit(B.add(b, { kind: 'bottle', solid: false }), { point: at, dir: V(0, -1, 0), power: 9, by: 'fist' });
  }

  // round two: he takes a bottle by the neck and breaks it on the counter
  armBottle(bottle) {
    this.him.bottle = bottle;
  }

  // ---- the ring moves with us along the aisle ---------------------------------------------------
  stepRing(dt) {
    const him = this.him, c = this.c, R = this.ring;
    if (him.state === 'thrown' || him.state === 'ko') return;
    if (him.push) {
      // (a push is spent over a third of a second)
      const s = him.push * Math.min(1, dt * 6);
      him.z -= s * this.dirZ();
      him.push -= s;
      if (Math.abs(him.push) < 1e-3) him.push = 0;
    }
    him.z = Math.max(R.z0, Math.min(R.z1, him.z));
    c.place({ x: R.x, z: him.z }, Math.atan2(this.game.eye.x - R.x, this.game.eye.z - him.z));
    // the ring's centre follows him (the controller keeps me dist from him)
    // (a tight ring round where I should stand: the slips move the eye off
    // the line and it comes back to it, never drifting out of the aisle)
    this.controller.modeOpts.ring = { x: R.x, z: him.z + this.dirZ() * (this.controller.modeOpts.dist ?? 1.45), r: 0.45 };
  }
  // +1: I stand north of him (larger z), he is driven south
  dirZ() { return this.game.eye.z >= this.c.pos.z ? 1 : -1; }

  // ---- what is in reach -------------------------------------------------------------------------
  reachable() {
    const R = this.room, eye = this.game.eye;
    if (!R.items) return null;
    let best = null, bd = Infinity;
    for (const it of R.items(this.round)) {
      const p = it.pos || it.object.getWorldPosition(new THREE.Vector3());
      const d = Math.hypot(p.x - eye.x, p.z - eye.z);
      const lim = it.kind === 'stool' ? BRAWL.reach.floor : BRAWL.reach.counter;
      if (d < lim && d < bd) { bd = d; best = it; }
    }
    return best;
  }

  // ---- the HUD teaches once (round one only) --------------------------------------------------
  teach(dt) {
    const G = this.game, T = this.taught, hud = G.hud, him = this.him;
    if (this.finished) { if (this.grabShown || this.tipT > 0) { hud.clearPrompt('brawl'); this.grabShown = null; this.tipT = 0; } return; }
    if (this.tipT > 0) { this.tipT -= dt; if (this.tipT <= 0) hud.clearPrompt('brawl'); }
    const tip = (key, text, secs) => { if (T[key]) return; T[key] = true; hud.prompt(text, null, 'brawl'); this.tipT = secs; };
    if (this.round0 === 1 && this.round === 1) {
      if (this.T > 0.4 && !T.jab) tip('jab', 'LMB  jab', 2.2);
      if (him.state === 'attack' && him.clip === 'br_jab' && !T.block) tip('block', 'SPACE  block', 1.8);
      if (him.state === 'attack' && him.clip === 'br_hook' && !T.slip) tip('slip', 'A · D  slip', 1.9);
      if ((this.stats.jabs || 0) >= 3 && !T.heavy && this.me.state === 'idle') tip('heavy', 'RMB  hold, let go', 2.4);
    }
    // what is in reach (the first two times: after that the tick alone)
    const it = !this.me.holding && this.me.state === 'idle' ? this.reachable() : null;
    const at = it ? G.screenOf(it.pos || it.object.getWorldPosition(new THREE.Vector3())) : null;
    if (it && (T.grabs || 0) < 2 && !(this.tipT > 0)) { hud.prompt('E  grab', at, 'brawl'); this.grabShown = it; }
    else if (!it && this.grabShown) { this.grabShown = null; if (!(this.tipT > 0)) hud.clearPrompt('brawl'); T.grabs = (T.grabs || 0) + 1; }
  }

  // ---- losing: down, black, up at the start of the round --------------------------------------
  playerDown() {
    const me = this.me, G = this.game;
    if (me.state === 'down') return;
    me.state = 'down'; me.downT = 0;
    this.stats.downs++;
    this.hands.play('hurt');
    this.sfx('bodyFloor', null, { k: 1 });
    G.emit('player:down', { brawl: true });
    this.downRun = true;
  }

  // (Game.post: the black and the retry run on game time)
  stepDown(dt) {
    const me = this.me, G = this.game;
    if (!this.active || me.state !== 'down') return;
    me.downT += dt;
    G.hud.fade(Math.min(1, me.downT / 0.35));
    if (me.downT >= BRAWL.down) {
      const r = this.round;
      G.health.reset();
      G.health.hp = BRAWL.retryHp;
      if (this.opts.onRetry) this.opts.onRetry(r);
      G.hud.fade(0);
      this.fadeBack = 0.6;
    }
  }

  // ---- the end ----------------------------------------------------------------------------------
  // the last heavy: br_ko_window. He goes back over the end booth and out
  // through the end bay's plate glass (its `glass` mark), lands on his back
  // on the wet pavement in the glass; the eye follows him round, the room
  // at 0.35 x for the 0.8 s of the blow.
  ko() {
    const him = this.him, c = this.c, G = this.game, R = this.ring, C = this.controller;
    this.finished = true;
    this.hands.hold(null, 'R');
    this.me.holding = null;
    him.state = 'ko'; him.t = 0; him.landed = false; him.fell = false;
    him.koFrom = V(c.pos.x, 0, c.pos.z);
    him.koYaw0 = c.yaw;
    const clip = c.clip('br_ko_window');
    him.koGlass = clip.marks.glass;
    him.koLand = clip.marks.glass + 0.62;
    c.play('br_ko_window', { onMark: { glass: () => { if (this.opts.onGlass) this.opts.onGlass(); } } });
    G.hitStop = Math.max(G.hitStop || 0, BRAWL.hitStop.heavy);
    if (G.slowmo) G.slowmo(BRAWL.slowmo.k, BRAWL.slowmo.dur);
    C.shake(0.5, 0);
    this.sfx('heavy', null, { k: 1 });
    this.sfx('hisGrunt', null, { k: 1 });
    G.fx.hit.punch(_a.setFromMatrixPosition(c.bones.head.matrixWorld).clone(), V(1, 0.2, 0), 0.9);
    // the eye stays where it stood and turns to follow him out
    const eye = C.eyePose();
    let yaw = eye.yaw, pitch = eye.pitch;
    C.slip = 0;
    C.setMode('cutscene', { track: (t, dt = 1 / 60) => {
      const p = _b.setFromMatrixPosition(c.bones.chest.matrixWorld);
      const ty = Math.atan2(-(p.x - eye.x), -(p.z - eye.z));
      const tp = Math.atan2(p.y - eye.y, Math.hypot(p.x - eye.x, p.z - eye.z));
      const k = 1 - Math.exp(-dt * 7);
      yaw += Math.atan2(Math.sin(ty - yaw), Math.cos(ty - yaw)) * k;
      pitch += (Math.max(-0.5, Math.min(0.3, tp)) - pitch) * k;
      return { x: eye.x, y: eye.y, z: eye.z, yaw, pitch };
    } });
    if (this.opts.onKO) this.opts.onKO();
    this.stats.won = true;
  }

  stepKO(dt) {
    const him = this.him, c = this.c, R = this.ring, G = this.game;
    const t = him.t, tg = him.koGlass, tl = him.koLand;
    const from = him.koFrom, win = R.window, land = R.land;
    // (his back leads: he faces back into the room, the way he came)
    const travel = Math.atan2(land.x - from.x, land.z - from.z);
    const yaw = him.koYaw0 + Math.atan2(Math.sin(travel + Math.PI - him.koYaw0), Math.cos(travel + Math.PI - him.koYaw0)) * Math.min(1, t / (tg * 0.7));
    let x, z, y;
    if (t <= tg) {
      const u = t / tg, e = Math.sin(u * Math.PI / 2);
      x = from.x + (win.x - from.x) * e; z = from.z + (win.z - from.z) * e;
      y = 1.05 * Math.sin(u * Math.PI / 2);
    } else if (t <= tl) {
      const u = (t - tg) / (tl - tg);
      x = win.x + (land.x - win.x) * u; z = win.z + (land.z - win.z) * u;
      y = 1.05 * (1 - u * u) - 0.15 * u;
    } else { x = land.x; z = land.z; y = 0; }
    c.place({ x, z }, yaw);
    // (a stand-in for the clip's own flight: the figure laid back about
    // its hips as it goes, near flat by the time it comes down; his down
    // clip takes over as he lands)
    const tilt = him.fell ? 0 : -1.35 * Math.pow(Math.min(1, t / tl), 0.8);
    if (c.object) {
      // (yaw first, then the lean about his own hips' axis)
      c.object.rotation.order = 'YXZ';
      c.object.position.x = x; c.object.position.z = z;
      c.object.position.y = him.fell ? 0 : Math.max(0, y) + 0.15;
      c.object.rotation.x = tilt;
    }
    if (!him.fell && t >= tl) {
      him.fell = true;
      if (c.object) c.object.rotation.x = 0;
      c.ko('deathBack');
      // (the fall is over as he hits: straight to his lying pose)
      for (let i = 0; i < 70; i++) c.fig.update(1 / 60, 0);
    }
    if (!him.landed && t >= tl) {
      him.landed = true;
      this.sfx('bodyPavement', V(x, 0.2, z), { k: 1 });
      this.controller.shake(0.2, 3);
      if (this.opts.onLanded) this.opts.onLanded();
    }
    if (t >= tl + 1.0 && !this.done) { this.done = true; this.stop(); G.emit('brawl:end', { won: true }); }
  }

  get state() {
    const him = this.him, me = this.me;
    return this.active || this.finished ? {
      round: this.round, me: +this.game.health.hp.toFixed(1), him: him ? +him.hp.toFixed(1) : null, hisState: him && him.state, hisClip: him && him.clip,
      myState: me && me.state, landed: this.stats.landed, taken: this.stats.taken, blocked: this.stats.blocked, slipped: this.stats.slipped,
      throws: this.stats.throws, downs: this.stats.downs, time: +this.stats.time.toFixed(1),
    } : null;
  }

  // (the fight's own sounds are 'f_<name>'; what breaks is 'break_<kind>')
  sfx(name, pos, p) { const S = this.game.sfx; if (!S || !S.live) return; if (name.startsWith('break_')) S.play(name, pos, p, { ref: 2 }); else S.fight(name, pos, p); }
}

// the props a round puts in reach (built by the scene; exported for it)
export function reachProp(kind, variant = null) { return buildProp(kind, variant ? { variant } : {}); }
export { HIS_ATTACKS };

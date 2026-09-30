import * as THREE from 'three';
import { ROUTE, STRETCH, FENCES, LANE, CRATES, PASSAGE, GATE, BOARD, HIS_CAR, DEADEND, EYE, YARD } from '../../stages/backlot/plan.js';
import { WRUN, layOn } from '../../cast/kinds/watcher.js';

// The chase on foot (lane B4, scene 6): the watcher's run along the route
// and the rules under it.
//   He follows ROUTE (the stage's plan): his speed follows mine to stay 9 to
//   22 m ahead along it (a burst past 9.5 m/s if I close to 5), slowing to
//   a tired 4.5 when I fall back, so a man who runs keeps him in sight and
//   one who stops loses him. He vaults the fences, pulls the crate stacks
//   down behind him, goes through the loose board, gets into his car.
//   Lost: more than 30 m behind, or 6 s without a clear line to him: "Lost
//   him." Black, back at the start of that stretch (he 15 m ahead again).
//   chase.progress()        my distance along the route (monotonic)
//   chase.stretch           the stretch I am in (0 .. 4)
//   chase.step(dt)          every step (the scene's onStep)
//   chase.place(s)          him at route distance s (running)
//   chase.onLost            fn(stretch) the scene sets (it re-stages)
const V = (x, z) => new THREE.Vector3(x, 0, z);
const _t = new THREE.Vector3();
const sm = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// the route as segments with their cumulative lengths
export const PATH = (() => {
  const pts = ROUTE.map(([x, z]) => V(x, z));
  const s = [0];
  for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + pts[i].distanceTo(pts[i - 1]));
  return { pts, s, len: s[s.length - 1] };
})();
export function pathAt(s, out = new THREE.Vector3()) {
  const { pts, s: S } = PATH;
  s = Math.max(0, Math.min(PATH.len, s));
  let i = 0;
  while (i < pts.length - 2 && S[i + 1] < s) i++;
  const k = (s - S[i]) / Math.max(1e-6, S[i + 1] - S[i]);
  return out.lerpVectors(pts[i], pts[i + 1], k);
}
// the heading (a figure's: it faces (sin h, cos h)) of the route at s,
// looking `ahead` metres on (a corner is taken round, not snapped)
export function pathHeading(s, ahead = 1.6) {
  const a = pathAt(s - ahead * 0.3), b = pathAt(s + ahead);
  return Math.atan2(b.x - a.x, b.z - a.z);
}
// the nearest route distance to (x, z), searched near `hint` (monotonic
// progress: a parallel stretch further on is not taken for this one)
export function project(x, z, hint = 0, span = 40) {
  const { pts, s: S } = PATH;
  let best = hint, bd = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    if (S[i + 1] < hint - span || S[i] > hint + span) continue;
    const a = pts[i], b = pts[i + 1];
    const tx = b.x - a.x, tz = b.z - a.z, L2 = tx * tx + tz * tz;
    const k = Math.max(0, Math.min(1, ((x - a.x) * tx + (z - a.z) * tz) / L2));
    const px = a.x + tx * k, pz = a.z + tz * k;
    const d = Math.hypot(x - px, z - pz);
    if (d < bd) { bd = d; best = S[i] + Math.sqrt(L2) * k; }
  }
  return { s: best, d: bd };
}
// the route distance of a stretch's start, of a fence, of a crate stack
export const STRETCH_S = STRETCH.map((st) => project(st.at.x, st.at.z, 0, 1e9).s);
const sOfX = (x, z) => project(x, z, 0, 1e9).s;
export const FENCE_S = FENCES.map((f) => sOfX(f.x, (LANE.z0 + LANE.z1) / 2));
export const CRATE_S = CRATES.map((c) => sOfX(c.x, (PASSAGE.z0 + PASSAGE.z1) / 2));
export const GATE_S = sOfX(GATE.x, (PASSAGE.z0 + PASSAGE.z1) / 2);
export const BOARD_S = sOfX(BOARD.x, BOARD.z);
export const CAR_S = PATH.len;
// the corners where the way turns more than 60 degrees: he skids on the
// wet at the first he takes at speed (the end of the straight), and leans
// hard into the rest
export const CORNERS = (() => {
  const out = [];
  const { pts, s: S } = PATH;
  for (let i = 1; i < pts.length - 1; i++) {
    const a = Math.atan2(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z), b = Math.atan2(pts[i + 1].x - pts[i].x, pts[i + 1].z - pts[i].z);
    const d = wrap(b - a);
    if (Math.abs(d) > 1.05) out.push({ s: S[i], turn: d });
  }
  return out;
})();
const SKID = CORNERS.find((c) => c.s > 40) || null;
// where he looks back over his shoulder (twice)
const LOOKS = [STRETCH_S[1] + 3.5, STRETCH_S[3] + 6];

export class Chase {
  constructor(ctx) {
    this.ctx = ctx;
    this.G = ctx.game;
    this.stage = ctx.stage;
    this.w = null;              // the watcher (a Character)
    this.s = 0;                 // his route distance
    this.v = 0;
    this.act = 'stand';         // stand | notice | run | vault | carIn | gone
    this.sp = 0;                // mine
    this.active = false;        // the rules (the run beat)
    this.stretch = 0;
    this.unseen = 0;
    this.losT = 0;
    this.lost = null;           // { t, stretch }: the black of a "Lost him."
    this.fence = 0; this.crate = 0; this.board = false;
    this.look = null;           // { t } a look back
    this.lean = 0;
    this.onLost = null;
    this.pace = null;           // (s) -> target: the escape beat's pacing
    this.lostN = 0;             // times I lost him (the play's record)
  }

  // ---- him ------------------------------------------------------------------------------
  spawn(at, yaw, state = 'watcher_stand') {
    const cast = this.G.cast;
    const kind = cast.has('watcher') ? 'watcher' : 'couple_him';
    const old = cast.get('watcher');
    if (old) cast.remove(old);
    const c = cast.spawn(kind, { at, yaw, name: 'watcher' });
    this.w = c;
    c.noGlance = true;
    if (kind === 'watcher') c.setState(state, 0);
    this.fig = c.fig;
    // the coat's tails out behind him at speed, the look back over the
    // shoulder, the lean into a turn: laid on the clip's pose each step
    c.fig.afterPose = (h, dt) => this.afterPose(h, dt);
    return c;
  }

  // him at route distance s, running
  place(s) {
    this.s = s;
    const p = pathAt(s);
    const F = this.fig;
    F.pos.x = p.x; F.pos.z = p.z;
    F.yaw = pathHeading(s);
    F._prevPos.copy(F.pos); F._prevYaw = F.yaw;
    if (F._rmClip) F._rmClip = null;
    this.act = 'run';
    this.w.setState('watcher_run', 0.15);
    this.v = 6;
  }

  // ---- me -------------------------------------------------------------------------------
  progress() {
    const e = this.G.controller.pos;
    const r = project(e.x, e.z, this.sp, 12);
    // (only ever forward, a little back: a man running round a corner)
    if (r.s > this.sp - 3) this.sp = Math.max(this.sp - 0.5, r.s);
    let st = 0;
    for (let i = 0; i < STRETCH_S.length; i++) if (this.sp >= STRETCH_S[i] - 1) st = i;
    this.stretch = Math.max(this.stretch, st);
    return this.sp;
  }

  // ---- per step ------------------------------------------------------------------------------
  step(dt) {
    if (!this.w || !this.fig) return;
    const G = this.G, F = this.fig;
    this.progress();
    const chase = G.stage.part('chase');
    // his speed: the gap kept between 9 and 22 m
    if (this.act === 'run') {
      const gap = this.s - this.sp;
      const mine = G.controller.run ? G.controller.run.v : 0;
      let want;
      if (this.pace) want = this.pace(this.s);
      else if (!this.active) want = 6.2;
      else if (gap < 5) want = 9.6;
      else if (gap < 9) want = Math.max(mine + 0.8, 7.8);
      else if (gap > 22) want = 4.5;
      else want = Math.min(8.2, Math.max(5.6, mine * 0.97 + (gap - 14) * 0.08));
      this.v += (want - this.v) * (1 - Math.exp(-dt * 2.5));
      // (behind the black of a "Lost him." he waits where the stretch has
      // him: the retry begins as it will be played, 15 m)
      if (!(this.lost && this.lost.done && this.lost.t < 1.1)) this.s += this.v * dt;
      const p = pathAt(this.s);
      F.pos.x = p.x; F.pos.z = p.z;
      const h = pathHeading(this.s, 1.2 + this.v * 0.25);
      const dh = wrap(h - F.yaw);
      F.yaw += Math.sign(dh) * Math.min(Math.abs(dh), dt * 7);
      this.lean += ((Math.max(-1, Math.min(1, dh * 2)) * Math.min(1, this.v / 6)) - this.lean) * (1 - Math.exp(-dt * 6));
      F.anim.setTimeScale(Math.max(0.3, this.v / (WRUN.speed * F.scale)));
      // what he does on the way
      if (this.fence < FENCE_S.length && this.s >= FENCE_S[this.fence] - 0.95 * F.scale) this.startVault();
      else if (this.crate < CRATE_S.length && this.s >= CRATE_S[this.crate] - 0.9 && !this.pull) {
        // (a hand out to the stack as he passes it, a yank: it comes down behind him)
        this.pull = { t: 0, side: CRATES[this.crate].side, i: this.crate };
        this.crate++;
      }
      if (this.pull && !this.pull.done && this.pull.t > 0.2) { this.pull.done = true; chase.crates.pull(this.pull.i); this.G.sfx.play('topple_crate', F.pos.clone().setY(0.5)); this.G.sfx.play('w_crates', F.pos.clone().setY(0.6)); }
      if (!this.board && this.s >= BOARD_S - 0.5) { this.board = true; chase.board.push(2.6); this.G.sfx.play('w_board', V(BOARD.x, BOARD.z).setY(1.4)); }
      for (let i = 0; i < LOOKS.length; i++) if (!this.looked?.[i] && this.s >= LOOKS[i]) { (this.looked || (this.looked = []))[i] = true; this.look = { t: 0 }; }
      if (this.s >= CAR_S - 0.6) this.startCarIn();
      // the washing he goes through
      chase.sheets.touch(F.pos.x, F.pos.z, Math.sin(F.yaw) * this.v, Math.cos(F.yaw) * this.v, 1);
    } else if (this.act === 'vault') {
      const h = this.w.clipH;
      if (!h || h.done || h.t >= h.duration - 1e-3) {
        this.fence++;
        this.act = 'run';
        this.s = project(F.pos.x, F.pos.z, this.s, 6).s;
        this.w.setState('watcher_run', 0.12);
      }
    } else if (this.act === 'carIn') {
      const h = this.w.clipH;
      if (!h || h.t >= h.duration - 1e-3) { this.act = 'gone'; F.object.visible = false; if (F.collider) F.collider.r = 0; this.G.sfx.play('w_door', F.pos.clone().setY(1)); }
    }
    if (this.look) { this.look.t += dt; if (this.look.t > 1.0) this.look = null; }
    // the skid: his feet go out from under him a little on the wet, he
    // leans hard into it and runs on (a spray, the slap of the sole)
    if (this.act === 'run' && SKID && !this.skidDone && this.s >= SKID.s - 1.2) {
      this.skidDone = true;
      this.skid = { t: 0, side: Math.sign(SKID.turn) };
      const p = F.pos.clone();
      G.sfx.play('w_skid', p.clone().setY(0.2));
      const fx = G.fx;
      if (fx && fx.splash) for (let i = 0; i < 14; i++) {
        const a = F.yaw + (Math.random() - 0.5) * 1.6;
        fx.splash.spawn({ pos: p.clone().setY(0.04), vel: new THREE.Vector3(Math.sin(a) * 2.2, 1.2 + Math.random() * 1.4, Math.cos(a) * 2.2), life: 0.5, size: [0.02, 0.035], stretch: 0.04, col: [0.55, 0.55, 0.55], alpha: 0.9, gravity: 9.8, ground: 0.0, fadeOut: 0.2 });
      }
    }
    if (this.skid) {
      const K = this.skid;
      K.t += dt;
      const b = Math.sin(Math.PI * Math.min(1, K.t / 0.55));
      this.lean = K.side * (0.6 + 0.9 * b);
      // (the hips slide out, away from the turn, and come back under him)
      const out = -K.side * 0.32 * b;
      F.pos.x += Math.cos(F.yaw) * out; F.pos.z -= Math.sin(F.yaw) * out;
      if (K.t > 0.55) this.skid = null;
    }
    if (this.pull) { this.pull.t += dt; if (this.pull.t > 0.7) this.pull = null; }
    // the rules
    if (this.active && !this.lost) this.rules(dt);
    if (this.lost) this.lostStep(dt);
  }

  startVault() {
    const F = this.fig;
    this.act = 'vault';
    // square to the fence, 0.95 m (his scale) short of it: the clip's root
    // motion carries him over
    const fx = FENCES[this.fence].x;
    F.yaw = Math.PI / 2;
    F.pos.x = fx - 0.95 * F.scale;
    F._prevPos.copy(F.pos); F._prevYaw = F.yaw;
    this.w.play('watcher_vault', { fade: 0.08 });
    this.G.sfx.play('w_fenceHand', F.pos.clone().setY(1.6));
  }

  startCarIn() {
    const F = this.fig;
    this.act = 'carIn';
    F.yaw = Math.PI;
    this.w.play('watcher_carIn', { fade: 0.12, hold: true });
    this.G.sfx.play('w_handle', F.pos.clone().setY(1));
  }

  // lost him: too far, or out of sight too long
  rules(dt) {
    const G = this.G;
    if (this.act === 'gone' || this.act === 'carIn') return;
    const gap = this.s - this.sp;
    this.losT -= dt;
    if (this.losT <= 0) {
      this.losT = 0.2;
      const eye = G.eye;
      // (his hat over a fence or a crate is him: the head and the chest
      // each get a ray; either clear is seen)
      this.seen = false;
      for (const bone of ['head', 'chest']) {
        const tgt = this.fig.bones[bone].getWorldPosition(_t);
        const dir = tgt.sub(eye);
        const d = dir.length();
        dir.divideScalar(d);
        if (!G.rays.raycast(eye, dir, d - 0.5, { anyHit: true })) { this.seen = true; break; }
      }
    }
    // (close behind him round a corner is not losing him)
    this.unseen = this.seen || gap < 12 ? 0 : this.unseen + dt;
    if (gap > 30 || this.unseen > 6) { (this.lostLog || (this.lostLog = [])).push({ sp: +this.sp.toFixed(1), s: +this.s.toFixed(1), gap: +gap.toFixed(1), unseen: +this.unseen.toFixed(1), stretch: this.stretch, eye: [+G.eye.x.toFixed(1), +G.eye.z.toFixed(1)] }); this.lose(); }
  }

  lose() {
    if (this.lost) return;
    this.lost = { t: 0, stretch: this.stretch, done: false };
    this.lostN++;
    this.G.hud.say('Lost him.', 1.6);
    this.G.sfx.play('w_lost');
  }

  // black (0.35 s), held while the stretch is set again, and up (0.45 s)
  lostStep(dt) {
    const L = this.lost, G = this.G;
    L.t += dt;
    if (L.t < 0.35) G.hud.fade(L.t / 0.35);
    else if (!L.done) { L.done = true; G.hud.fade(1); if (this.onLost) this.onLost(L.stretch); }
    else if (L.t > 1.1) {
      const k = Math.min(1, (L.t - 1.1) / 0.45);
      G.hud.fade(1 - k * k * (3 - 2 * k));
      if (k >= 1) { this.lost = null; G.hud.fade(0); }
    }
  }

  // a retry of stretch i: me at its start, him 15 m ahead, running
  restage(i) {
    this.stretch = i;
    this.sp = STRETCH_S[i];
    this.unseen = 0;
    this.fence = FENCE_S.filter((s) => s < STRETCH_S[i] + 15).length;
    this.crate = CRATE_S.filter((s) => s < STRETCH_S[i] + 15).length;
    this.board = BOARD_S < STRETCH_S[i] + 15;
    this.looked = LOOKS.map((s) => s < STRETCH_S[i] + 15);
    this.skidDone = SKID ? SKID.s < STRETCH_S[i] + 15 : true;
    this.skid = null; this.pull = null;
    this.fig.object.visible = true;
    this.place(STRETCH_S[i] + 15);
  }

  // ---- his figure, laid on the clip each step ----------------------------------------------------
  afterPose(h, dt) {
    const v = this.act === 'run' || this.act === 'vault' ? this.v : 0;
    if (this.act !== 'run') this.lean *= Math.exp(-dt * 8);
    // (the arm toward the stack: its side of him - he runs west down the
    // passage, so the north wall is on his right)
    const pull = this.pull ? { t: this.pull.t, side: this.pull.side > 0 ? 'R' : 'L' } : null;
    // (in the yard his shadow is thrown on the washing from the far flood:
    // cast however far he is from the eye - a Hood's is only within 16 m)
    if (h.pos.x > YARD.x0 - 1 && h.pos.z > YARD.z0 - 3 && h.pos.z < YARD.z1) h.mesh.castShadow = true;
    layOn(h, { v, t: this.G.time || 0, lean: this.lean, look: this.look ? this.look.t : null, pull });
  }
}
export { EYE, HIS_CAR, DEADEND };

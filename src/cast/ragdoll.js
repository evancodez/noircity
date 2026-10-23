import * as THREE from 'three';
import { JOINTS, OFFSET } from '../enemies/HoodRig.js';

// [O8] The physics layer, within reason (docs/briefs/O8_FIGURES.md §2): a
// light ragdoll for a fall - a knock-down, a car's hit, a death. Sixteen
// points at the joints (the pelvis, the chest, the neck, the crown, the
// shoulders, elbows, wrists, hips, knees and ankles) joined by fixed links
// (a box for the torso, sticks for the limbs) and integrated by Verlet,
// solid to the ground under each point (kerbs, steps, floors: the stage's
// walking surface), to the walls and posts (the colliders), and to the cars
// (their boxes with a bonnet and a roof: a man goes over the bonnet or under
// the car by the speed). Not a full-body simulation: the fall's own clip
// (koFall, the Hood's deaths, the slumps) is the pose it reaches for - the
// torso follows the clip in the world for the first few tenths of a second
// (so nothing pops: the points start where the bones are), then only
// gravity, the push and what it meets move it; the limbs keep reaching for
// the clip's pose relative to the torso (soft springs: the arms thrown up,
// the knees giving) so the fall still reads like the base's falls. Asleep
// once still: no cost, no jitter, the pose kept.
//   const rag = new Ragdoll(fig, { clip, push: { v, lo, hi }, follow, world })
//   rag.step(dt)     (the figure's update calls it instead of the mixer)
//   rag.pose()       the bones from the points (after the figure's root is placed)
//   rag.wake()       (a car coming at a body)
//   rag.asleep, rag.t, rag.facing() -> 'up' | 'down', rag.lie() -> { x, z, yaw }
const V = () => new THREE.Vector3();
const _a = V(), _b = V(), _c = V(), _d = V(), _e = V(), _f = V();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _qi = new THREE.Quaternion();
const _m = new THREE.Matrix4(), _mi = new THREE.Matrix4();
// (look development: ?o8rag=noLimb,noFollow,noMin,noBrace - the layer's parts off one at a time)
const DBG = (() => { try { const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('o8rag') : (typeof process !== 'undefined' && process.env.O8RAG) || null; return q ? Object.fromEntries(q.split(',').map((k) => [k, true])) : {}; } catch (e) { return {}; } })();
const smooth = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

// the points: [id, the bone whose joint it is, radius (m, model units), mass]
export const PTS = [
  ['pv', 'hips', 0.17, 2.2], ['ch', 'chest', 0.18, 2.2], ['nk', 'head', 0.095, 0.8], ['hd', 'hat', 0.12, 0.9],
  ['sL', 'upperArmL', 0.09, 0.8], ['eL', 'forearmL', 0.07, 0.5], ['wL', 'handL', 0.06, 0.35],
  ['sR', 'upperArmR', 0.09, 0.8], ['eR', 'forearmR', 0.07, 0.5], ['wR', 'handR', 0.06, 0.35],
  ['hL', 'thighL', 0.12, 1.2], ['kL', 'shinL', 0.08, 0.8], ['fL', 'footL', 0.085, 0.5],
  ['hR', 'thighR', 0.12, 1.2], ['kR', 'shinR', 0.08, 0.8], ['fR', 'footR', 0.085, 0.5],
];
const IX = Object.fromEntries(PTS.map((p, i) => [p[0], i]));
// links: [a, b, stiffness] (rest lengths from the bind pose)
const LINKS = [
  ['pv', 'hL', 1], ['pv', 'hR', 1], ['hL', 'hR', 1],
  ['ch', 'sL', 1], ['ch', 'sR', 1], ['sL', 'sR', 1],
  ['pv', 'ch', 1], ['hL', 'sL', 0.6], ['hR', 'sR', 0.6], ['hL', 'sR', 0.45], ['hR', 'sL', 0.45],
  ['ch', 'nk', 1], ['sL', 'nk', 0.7], ['sR', 'nk', 0.7], ['nk', 'hd', 1], ['ch', 'hd', 0.35],
  ['sL', 'eL', 1], ['eL', 'wL', 1], ['sR', 'eR', 1], ['eR', 'wR', 1],
  ['hL', 'kL', 1], ['kL', 'fL', 1], ['hR', 'kR', 1], ['kR', 'fR', 1],
].map(([a, b, k]) => [IX[a], IX[b], k]);
// the joints' limits as distances: a limb never folds flatter than this
// (fraction of its full length); the knees and the head kept off the chest
const MINS = [['hL', 'fL', 0.52], ['hR', 'fR', 0.52], ['sL', 'wL', 0.32], ['sR', 'wR', 0.32], ['ch', 'kL', 0.62], ['ch', 'kR', 0.62], ['pv', 'hd', 0.8]]
  .map(([a, b, k]) => [IX[a], IX[b], k]);
// the limbs that reach for the clip's pose relative to the torso
const LIMBS = ['nk', 'hd', 'eL', 'wL', 'eR', 'wR', 'kL', 'fL', 'kR', 'fR'].map((n) => IX[n]);
const TORSO = ['pv', 'ch', 'sL', 'sR', 'hL', 'hR'].map((n) => IX[n]);
// the bones a clip sample keeps as they are (no point drives them)
const KEEP = ['shoulderL', 'shoulderR', 'handL', 'handR', 'footL', 'footR'];
const PARENT = Object.fromEntries(JOINTS.map((j) => [j[0], j[1]]));

// ---- the clip as points: sampled once a rig and a clip (model units, the clip's root frame) ----
const TABLES = new WeakMap();
function offsetsOf(fig) {
  const O = (fig.build && fig.build.offsets) || OFFSET;
  const out = {};
  for (const [name] of JOINTS) out[name] = (O[name] || OFFSET[name]).clone();
  return out;
}
function fk(off, quat, hipsPos) {
  // model-space positions and rotations of every joint (root at the origin)
  const P = {}, Q = {};
  for (const [name, parent] of JOINTS) {
    const q = quat[name] || null;
    if (!parent) { P[name] = V(); Q[name] = new THREE.Quaternion(); continue; }
    const loc = name === 'hips' && hipsPos ? hipsPos : off[name];
    P[name] = loc.clone().applyQuaternion(Q[parent]).add(P[parent]);
    Q[name] = Q[parent].clone();
    if (q) Q[name].multiply(q);
  }
  return { P, Q };
}
function clipTable(fig, name) {
  const pair = fig.anim && fig.anim.clips && fig.anim.clips[name];
  if (!pair || !pair.lower) return null;
  let byRig = TABLES.get(fig.anim.clips);
  if (!byRig) TABLES.set(fig.anim.clips, (byRig = new Map()));
  const key = name + '|' + (fig.costume ? fig.costume.name || fig.kind : 'hood');
  if (byRig.has(key)) return byRig.get(key);
  const off = offsetsOf(fig);
  const tracks = [...pair.lower.tracks, ...(pair.upper ? pair.upper.tracks : [])];
  const ints = tracks.map((t) => ({ name: t.name.split('.')[0], prop: t.name.split('.')[1], i: t.createInterpolant() }));
  const fps = 30, n = Math.max(2, Math.round(pair.duration * fps) + 1);
  const samples = [];
  for (let k = 0; k < n; k++) {
    const t = (k / (n - 1)) * pair.duration;
    const quat = {};
    let hipsPos = null;
    for (const it of ints) {
      const v = it.i.evaluate(t);
      if (it.prop === 'quaternion') quat[it.name] = new THREE.Quaternion(v[0], v[1], v[2], v[3]).normalize();
      else if (it.prop === 'position' && it.name === 'hips') hipsPos = V().set(v[0], v[1], v[2]);
    }
    const { P, Q } = fk(off, quat, hipsPos);
    const pts = PTS.map(([, bone]) => P[bone].clone());
    const keep = {};
    for (const b of KEEP) keep[b] = (quat[b] || new THREE.Quaternion()).clone();
    samples.push({ t, pts, keep, frame: torsoQ(pts, new THREE.Quaternion()) });
  }
  const T = { name, duration: pair.duration, samples };
  byRig.set(key, T);
  return T;
}
// the torso's frame from its points: X the hips' line (his left), Y up the spine
function torsoQ(pts, out) {
  const x = _e.subVectors(pts[IX.hL], pts[IX.hR]);
  const y = _f.subVectors(pts[IX.ch], pts[IX.pv]).normalize();
  x.addScaledVector(y, -x.dot(y)).normalize();
  const z = _d.crossVectors(x, y);
  _m.makeBasis(x, y, z);
  return out.setFromRotationMatrix(_m);
}
function frameQ(xv, yv, out) {
  const y = yv.normalize();
  xv.addScaledVector(y, -xv.dot(y)).normalize();
  const z = _d.crossVectors(xv, y);
  _m.makeBasis(xv, y, z);
  return out.setFromRotationMatrix(_m);
}
function sampleAt(T, t, k = 0) {
  const S = T.samples, u = Math.min(1, Math.max(0, t / T.duration)) * (S.length - 1);
  const i = Math.min(S.length - 2, Math.floor(u));
  return { a: S[i], b: S[i + 1], w: u - i };
}

// ---- the ragdoll -------------------------------------------------------------------------------
export class Ragdoll {
  // clip: the fall's clip name (the figure's bank); push: { v: world m/s, lo, hi, up }
  // (the velocity at the feet x lo, at the crown x hi, between by height);
  // follow: how hard the torso keeps to the clip at first (1 gentle .. 0 thrown)
  constructor(fig, { clip = 'koFall', push = null, follow = 1, limb = 1, world = null, maxT = 9 } = {}) {
    this.fig = fig;
    this.world = world || fig.world;
    this.s = fig.scale;
    this.t = 0;
    this.asleep = false;
    this.still = 0;
    this.maxT = maxT;
    this.follow = follow;
    this.limb = limb;
    this.table = clipTable(fig, clip);
    this.clip = clip;
    const n = PTS.length;
    this.p = Array.from({ length: n }, V);
    this.o = Array.from({ length: n }, V);   // the last step's (Verlet)
    this.r = PTS.map((p) => p[2] * this.s);
    this.im = PTS.map((p) => 1 / p[3]);
    this.off = offsetsOf(fig);
    // the bind pose (model units): the links' rest lengths
    const bind = fk(this.off, {}, null).P;
    const bp = PTS.map(([, bone]) => bind[bone]);
    this.rest = LINKS.map(([a, b]) => bp[a].distanceTo(bp[b]) * this.s);
    this.mins = MINS.map(([a, b, k]) => {
      // (a limb's full length: hip to knee to ankle, shoulder to elbow to wrist)
      const full = a === IX.hL ? this.rest[LINKS.findIndex((l) => l[0] === IX.hL && l[1] === IX.kL)] + this.rest[LINKS.findIndex((l) => l[0] === IX.kL && l[1] === IX.fL)]
        : a === IX.hR ? this.rest[LINKS.findIndex((l) => l[0] === IX.hR && l[1] === IX.kR)] + this.rest[LINKS.findIndex((l) => l[0] === IX.kR && l[1] === IX.fR)]
          : a === IX.sL ? this.rest[LINKS.findIndex((l) => l[0] === IX.sL && l[1] === IX.eL)] + this.rest[LINKS.findIndex((l) => l[0] === IX.eL && l[1] === IX.wL)]
            : a === IX.sR ? this.rest[LINKS.findIndex((l) => l[0] === IX.sR && l[1] === IX.eR)] + this.rest[LINKS.findIndex((l) => l[0] === IX.eR && l[1] === IX.wR)]
              : bp[a].distanceTo(bp[b]) * this.s;
      return k * full;
    });
    // where the bones are now: the points start exactly on them (nothing pops)
    const B = fig.bones;
    fig.object.updateMatrixWorld(true);
    PTS.forEach(([, bone], i) => {
      if (bone === 'hat') this.p[i].copy(this.off.hat).applyMatrix4(B.head.matrixWorld);
      else this.p[i].setFromMatrixPosition(B[bone].matrixWorld);
    });
    // their velocity: the figure's own, and the push
    const vel = fig._vel || V();
    const h = 1 / 60;
    const y0 = fig.pos.y;
    for (let i = 0; i < n; i++) {
      const v = _a.set(vel.x, 0, vel.z);
      if (push && push.v) {
        const hk = Math.min(1, Math.max(0, (this.p[i].y - y0) / (1.75 * this.s)));
        const k = (push.lo ?? 1) + ((push.hi ?? 1) - (push.lo ?? 1)) * hk;
        v.addScaledVector(push.v, k);
        if (push.up) v.y += push.up * (0.6 + 0.4 * (1 - hk));
      }
      this.o[i].copy(this.p[i]).addScaledVector(v, -h);
    }
    // the clip's frame in the world: the figure as it stood
    this.M0 = new THREE.Matrix4().compose(fig.pos.clone(), new THREE.Quaternion().setFromAxisAngle(_b.set(0, 1, 0), fig.yaw + (fig._legOff || 0)), _c.setScalar(this.s));
    // the bones no point drives, as they were (blended to the clip's)
    this.keep0 = {};
    for (const b of KEEP) this.keep0[b] = B[b].quaternion.clone();
    this.ground = new Float32Array(n);
    for (let i = 0; i < n; i++) this.ground[i] = this.world.surfaceY(this.p[i].x, this.p[i].z);
    this._groundSet = true;
    this._tw = new THREE.Quaternion();
    this._tc = new THREE.Quaternion();
    this.cars = [];
    this.lying = false;
    this.stats = { steps: 0, maxV: 0 };
  }

  // a friction given per sixtieth of a second, for this substep
  fk(k) { return 1 - Math.pow(1 - k, (this._h || 1 / 60) * 60); }

  wake() { if (this.asleep) { this.asleep = false; this.still = 0; this.lying = true; this.maxT = this.t + 4; } }

  // ---- one step -----------------------------------------------------------------------------
  step(dt) {
    if (this.asleep || dt <= 0) return;
    this.t += dt;
    // substeps: no point moves more than 6 cm a substep (a thrown man never tunnels a wall)
    const h0 = this._h || 1 / 60;
    let vmax = 0;
    for (let i = 0; i < this.p.length; i++) vmax = Math.max(vmax, this.p[i].distanceTo(this.o[i]) / h0);
    const n = Math.min(8, Math.max(1, Math.ceil(vmax * dt / 0.06), Math.ceil(dt / (1 / 60) - 1e-3)));
    const h = dt / n;
    // (Verlet keeps its velocity as the last step's travel: a new step length rescales it)
    if (Math.abs(h - h0) > 1e-6) { const k = h / h0; for (let i = 0; i < this.p.length; i++) this.o[i].lerpVectors(this.p[i], this.o[i], k); }
    this._h = h;
    this.near();
    for (let k = 0; k < n; k++) {
      this.sub(h, (this.t - dt) + h * (k + 1));
      // (struck by a car: thrown along its way, not into the air - the bonnet lifts, it does not launch)
      if (this.carT != null && this.t - this.carT < 0.6) for (let i = 0; i < this.p.length; i++) if (this.p[i].y - this.o[i].y > 2.4 * h) this.o[i].y = this.p[i].y - 2.4 * h;
    }
    // asleep once nothing moves for half a second (and the clip has had its say)
    let mv = 0;
    for (let i = 0; i < this.p.length; i++) mv = Math.max(mv, this.p[i].distanceTo(this.o[i]) / h);
    this.stats.maxV = Math.max(this.stats.maxV, mv);
    this.stats.steps++;
    this.still = mv < 0.12 * this.s ? this.still + dt : 0;
    if ((this.still > 0.45 && this.t > (this.table ? this.table.duration * 0.8 : 0.6)) || this.t > this.maxT) {
      this.asleep = true;
      if (this.onSleep) { const f = this.onSleep; this.onSleep = null; f(this); }
    }
  }

  // the walls, posts and cars near the body (once a step)
  near() {
    const W = this.world, C = W.colliders, pv = this.p[IX.pv];
    this.walls = C.near ? C.near(pv.x, pv.z, 2.4, this._nearOut || (this._nearOut = [])) : [...C.circles, ...C.boxes];
    this.cars.length = 0;
    const G = W.game, list = G && G.vehicles ? G.vehicles.list : [];
    for (const v of list) {
      if (!v || v.solid === false || !v.spec || Math.abs(v.pos.x - pv.x) > 7 || Math.abs(v.pos.z - pv.z) > 7) continue;
      this.cars.push(v);
    }
  }

  sub(h, t) {
    const P = this.p, O = this.o, n = P.length, s = this.s;
    // integrate (gravity; a little air drag)
    const g = 9.8 * h * h;
    for (let i = 0; i < n; i++) {
      const p = P[i], o = O[i];
      const vx = (p.x - o.x) * 0.998, vy = (p.y - o.y) * 0.998, vz = (p.z - o.z) * 0.998;
      o.copy(p);
      // (no part of a man faster than a thrown body: 24 m/s)
      const sp2 = (vx * vx + vy * vy + vz * vz) / (h * h);
      const k = sp2 > 576 ? 24 / Math.sqrt(sp2) : 1;
      p.x += vx * k; p.y += vy * k - g; p.z += vz * k;
    }
    // the clip's pull: the torso in the world for the first tenths, the limbs
    // relative to the torso throughout (soft)
    if (this.table) {
      const { a, b, w } = sampleAt(this.table, t);
      const fw = DBG.noFollow ? 0 : this.follow * (1 - smooth(t / 0.42));
      if (fw > 1e-3) {
        // (the point and its last place both drawn to the clip's: it takes the clip's speed, not a spring's kick)
        const pr = sampleAt(this.table, Math.max(0, t - h));
        for (let i = 0; i < n; i++) {
          _a.lerpVectors(a.pts[i], b.pts[i], w).applyMatrix4(this.M0);
          _c.lerpVectors(pr.a.pts[i], pr.b.pts[i], pr.w).applyMatrix4(this.M0);
          P[i].lerp(_a, fw * 0.6);
          O[i].lerp(_c, fw * 0.6);
        }
      }
      // the torso's frame now and in the clip
      torsoQ(P, this._tw);
      this._tc.slerpQuaternions(a.frame, b.frame, w);
      _qi.copy(this._tc).invert();
      const cpv = _b.lerpVectors(a.pts[IX.pv], b.pts[IX.pv], w);
      // (the limbs reach for the clip while he falls; once down he is limp - a pull
      // against the ground would be a push off it: a body that walks or hops by itself)
      const D = this.table.duration;
      const kr = DBG.noLimb ? 0 : 0.12 * this.limb * (0.5 + 0.5 * smooth(t / 0.3)) * (1 - smooth((t - 0.6 * D) / (0.5 * D)));
      if (kr > 1e-4) {
        // (an inner pull: what the limbs are moved along the ground, the whole body gives
        // back, so it never pushes itself along)
        let mx = 0, my = 0, mz = 0, mt = 0;
        for (const i of LIMBS) {
          if (P[i].y <= this.ground[i] + this.r[i] + 0.01) continue;
          _a.lerpVectors(a.pts[i], b.pts[i], w).sub(cpv).applyQuaternion(_qi).applyQuaternion(this._tw).multiplyScalar(s).add(P[IX.pv]);
          const dx = (_a.x - P[i].x) * kr, dy = (_a.y - P[i].y) * kr, dz = (_a.z - P[i].z) * kr;
          P[i].x += dx; P[i].y += dy; P[i].z += dz;
          const m = PTS[i][3];
          mx += dx * m; my += dy * m; mz += dz * m;
        }
        for (let i = 0; i < n; i++) mt += PTS[i][3];
        mx /= mt; my /= mt; mz /= mt;
        for (let i = 0; i < n; i++) { P[i].x -= mx; P[i].y -= my; P[i].z -= mz; }
      }
    }
    // (inner damping: each point's speed drawn a little toward the body's, which is kept)
    {
      let vx = 0, vy = 0, vz = 0, mt = 0;
      for (let i = 0; i < n; i++) { const m = PTS[i][3]; vx += (P[i].x - O[i].x) * m; vy += (P[i].y - O[i].y) * m; vz += (P[i].z - O[i].z) * m; mt += m; }
      vx /= mt; vy /= mt; vz /= mt;
      const c = 0.06;
      for (let i = 0; i < n; i++) {
        O[i].x += ((P[i].x - O[i].x) - vx) * c; O[i].y += ((P[i].y - O[i].y) - vy) * c; O[i].z += ((P[i].z - O[i].z) - vz) * c;
      }
    }
    // the links, the limits, the ground
    for (let it = 0; it < 6; it++) {
      for (let k = 0; k < LINKS.length; k++) {
        const [a, b, st] = LINKS[k];
        if (DBG.noBrace && st < 1) continue;
        this.link(a, b, this.rest[k], st, false);
      }
      if (!DBG.noMin) for (let k = 0; k < MINS.length; k++) this.link(MINS[k][0], MINS[k][1], this.mins[k], 1, true);
      this.floor(it === 0);
    }
    this.solids();
    this.floor(false, true);
  }

  link(a, b, rest, st, minOnly) {
    const pa = this.p[a], pb = this.p[b];
    const dx = pb.x - pa.x, dy = pb.y - pa.y, dz = pb.z - pa.z;
    const L = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
    if (minOnly && L >= rest) return;
    const wa = this.im[a], wb = this.im[b], W = wa + wb;
    const k = ((L - rest) / L) * st / W;
    pa.x += dx * k * wa; pa.y += dy * k * wa; pa.z += dz * k * wa;
    pb.x -= dx * k * wb; pb.y -= dy * k * wb; pb.z -= dz * k * wb;
  }

  // every point on or above the walking surface under it; friction where it touches
  // (a contact is inelastic: the push out of the ground is no kick - the point keeps
  // only its speed along the ground, and loses most of that)
  floor(fresh, friction = false) {
    const W = this.world, P = this.p, O = this.o;
    for (let i = 0; i < P.length; i++) {
      const p = P[i], o = O[i];
      if (fresh || friction) {
        let gn = W.surfaceY(p.x, p.z);
        // (into a step's riser or a kerb's face from below: it is a wall there, not a lift -
        // the point is held where it was across, and lands on the step only from above)
        const g0 = this.ground[i];
        if (this._groundSet && gn > g0 + 0.06 * this.s && p.y < gn + this.r[i] - 0.05 * this.s) {
          p.x = o.x; p.z = o.z;
          gn = W.surfaceY(p.x, p.z);
        }
        this.ground[i] = gn;
      }
      const g = this.ground[i] + this.r[i];
      if (p.y < g) { o.y += g - p.y; p.y = g; }
      // (touching: its fall into the ground stopped, its slide along it mostly lost)
      if (friction && p.y <= g + 0.002 * this.s) {
        if (o.y > p.y) o.y = p.y;
        const f = this.fk(0.22); o.x += (p.x - o.x) * f; o.z += (p.z - o.z) * f;
      }
    }
  }

  // the walls and posts (2-D, full height) and the cars (a box with a bonnet and a roof)
  solids() {
    const P = this.p;
    for (let i = 0; i < P.length; i++) {
      const p = P[i], r = this.r[i];
      for (const o of this.walls) {
        if (o.gone) continue;
        const x0 = p.x, z0 = p.z;
        if (o.r != null) {
          if (o.tag === 'hood' || o.tag === 'person' || o.tag === 'corpse' || o.tag === 'cast') continue;
          const dx = p.x - o.x, dz = p.z - o.z, d2 = dx * dx + dz * dz, rr = o.r + r;
          if (d2 < rr * rr) { const d = Math.sqrt(d2) || 1e-4; p.x = o.x + (dx / d) * rr; p.z = o.z + (dz / d) * rr; this.contact(i, x0, z0); }
        } else if (boxPush(p, r, o)) this.contact(i, x0, z0);
      }
      for (const v of this.cars) this.car(i, v);
    }
    const C = this.world.colliders;
    if (C.regions && C.regions.length && C.clampNet) for (let i = 0; i < P.length; i++) { const x0 = P[i].x, z0 = P[i].z; C.clampNet(P[i], this.r[i]); if (P[i].x !== x0 || P[i].z !== z0) this.contact(i, x0, z0); }
  }
  // (out of a wall: no kick from the push, the speed into it gone, most of the slide along it
  // too - a body settles against it, it does not skate or bounce)
  contact(i, x0, z0) {
    const p = this.p[i], o = this.o[i];
    let nx = p.x - x0, nz = p.z - z0;
    const L = Math.hypot(nx, nz);
    o.x += nx; o.z += nz;
    if (L < 1e-7) return;
    nx /= L; nz /= L;
    const vx = p.x - o.x, vz = p.z - o.z, vn = vx * nx + vz * nz;
    if (vn < 0) { o.x += nx * vn; o.z += nz * vn; }
    const f = this.fk(0.3); o.x += (p.x - o.x) * f; o.z += (p.z - o.z) * f;
  }

  // a car as two boxes in its own frame (x ahead, y up, z right): the body to the
  // bonnet's line, the cabin over it; a point is pushed out of the face it is least
  // into (the bumper takes the knees, the bonnet the hips, the screen the head), with
  // no kick from the push but the car's own speed along that face's normal
  car(i, v) {
    const p = this.p[i], o = this.o[i], r = this.r[i];
    const c = Math.cos(v.yaw), s = Math.sin(v.yaw);
    const dx = p.x - v.pos.x, dz = p.z - v.pos.z;
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    const hw = v.spec.halfW;
    if (Math.abs(lz) > hw + r || Math.abs(lx) > v.spec.halfL + r) return;
    const y0 = v.pos.y || 0, y = p.y - y0;
    const vx = v.vel ? v.vel.x : 0, vz = v.vel ? v.vel.z : 0;
    const h = this._h || 1 / 60;
    for (const B of carBoxes(v)) {
      if (lx < B.x0 - r || lx > B.x1 + r || y > B.y1 + r) continue;
      // (under the chassis: a standing man's feet pass under the bumper; a man lying there is met)
      if (y < B.y0 && !(this.lying && B.low)) continue;
      const pF = B.x1 + r - lx, pB = lx - (B.x0 - r), pT = B.y1 + r - y, pS = hw + r - Math.abs(lz);
      let ax = 'x', sg = 1, pen = pF;
      if (pB < pen) { pen = pB; sg = -1; }
      if (pT < pen && !DBG.noTop) { pen = pT; ax = 'y'; }
      if (pS < pen || (this.lying && y < 0.45)) { pen = pS; ax = 'z'; sg = Math.sign(lz || 1); }
      let nlx = 0, nlz = 0;
      const px0 = p.x, py0 = p.y, pz0 = p.z;
      if (ax === 'y') p.y = y0 + B.y1 + r;
      else {
        let ox = lx, oz = lz;
        if (ax === 'x') { ox = sg > 0 ? B.x1 + r : B.x0 - r; nlx = sg; } else { oz = sg * (hw + r); nlz = sg; }
        p.x = v.pos.x + ox * c + oz * s;
        p.z = v.pos.z - ox * s + oz * c;
      }
      o.x += p.x - px0; o.y += p.y - py0; o.z += p.z - pz0;
      if (ax === 'y') {
        // (on the bonnet or the roof: not into it, and carried a little by it)
        if (o.y > p.y) o.y = p.y;
        const f = this.fk(0.25); o.x += ((p.x - vx * h) - o.x) * f; o.z += ((p.z - vz * h) - o.z) * f;
        continue;
      }
      const nx = nlx * c + nlz * s, nz = -nlx * s + nlz * c;
      const along = ((p.x - o.x) * nx + (p.z - o.z) * nz) / h, carAlong = vx * nx + vz * nz;
      const want = carAlong * 1.05 + (this.lying ? 1.2 : 0);
      if (along < want) { const add = (want - along) * h; o.x -= nx * add; o.z -= nz * add; }
      // (a car face does not throw a man up faster than its bonnet would: the drag of his own
      // limbs against it is no lift)
      if (p.y - o.y > 1.6 * h) o.y = p.y - 1.6 * h;
      this.carT = this.t;
    }
  }

  // ---- the bones from the points -----------------------------------------------------------------
  pose() {
    const F = this.fig, B = F.bones, off = this.off, obj = F.object;
    obj.updateMatrixWorld(true);
    _mi.copy(obj.matrixWorld).invert();
    const L = this._loc || (this._loc = PTS.map(V));
    for (let i = 0; i < PTS.length; i++) L[i].copy(this.p[i]).applyMatrix4(_mi);
    // the clip's own rotations for the bones no point drives (shoulders, hands, feet)
    let keep = null;
    if (this.table) {
      const { a, b, w } = sampleAt(this.table, this.t);
      const k = smooth(this.t / 0.25);
      keep = {};
      for (const nm of KEEP) keep[nm] = _q2.slerpQuaternions(a.keep[nm], b.keep[nm], w).clone().slerp(this.keep0[nm], 1 - k);
    }
    // the pelvis: its joint at the point, its frame from the hips' line and the spine
    const Qh = frameQ(_a.subVectors(L[IX.hL], L[IX.hR]), _b.subVectors(L[IX.ch], L[IX.pv]), new THREE.Quaternion());
    const Qbh = this._qbh || (this._qbh = frameQ(V().set(1, 0, 0), off.spine.clone().add(off.chest), new THREE.Quaternion()).invert());
    Qh.multiply(Qbh);
    const Qc = frameQ(_a.subVectors(L[IX.sL], L[IX.sR]), _b.subVectors(L[IX.nk], L[IX.ch]), new THREE.Quaternion());
    const Qbc = this._qbc || (this._qbc = frameQ(V().set(1, 0, 0), off.neck.clone().add(off.head), new THREE.Quaternion()).invert());
    Qc.multiply(Qbc);
    const Qs = new THREE.Quaternion().slerpQuaternions(Qh, Qc, 0.5);
    B.root.quaternion.identity();
    B.hips.position.copy(L[IX.pv]);
    B.hips.quaternion.copy(Qh);
    B.spine.quaternion.copy(Qh).invert().multiply(Qs);
    B.chest.quaternion.copy(Qs).invert().multiply(Qc);
    // the joints' places by the bones (not the points: the bones keep their lengths)
    const pHip = L[IX.pv];
    const pSpine = _c.copy(off.spine).applyQuaternion(Qh).add(pHip);
    const pChest = V().copy(off.chest).applyQuaternion(Qs).add(pSpine);
    const pNeck = V().copy(off.neck).applyQuaternion(Qc).add(pChest);
    const Qn = aim(Qc, off.head, _d.subVectors(L[IX.nk], pNeck));
    B.neck.quaternion.copy(Qc).invert().multiply(Qn);
    const pHead = V().copy(off.head).applyQuaternion(Qn).add(pNeck);
    const Qhd = aim(Qn, off.hat, _d.subVectors(L[IX.hd], pHead));
    B.head.quaternion.copy(Qn).invert().multiply(Qhd);
    for (const sd of ['L', 'R']) {
      // the arm
      const sh = B['shoulder' + sd];
      if (keep) sh.quaternion.copy(keep['shoulder' + sd]);
      const Qsh = Qc.clone().multiply(sh.quaternion);
      const pSh = V().copy(off['shoulder' + sd]).applyQuaternion(Qc).add(pChest);
      const pUa = V().copy(off['upperArm' + sd]).applyQuaternion(Qsh).add(pSh);
      const Qua = aim(Qsh, off['forearm' + sd], _d.subVectors(L[IX['e' + sd]], pUa));
      B['upperArm' + sd].quaternion.copy(Qsh).invert().multiply(Qua);
      const pFa = V().copy(off['forearm' + sd]).applyQuaternion(Qua).add(pUa);
      const Qfa = aim(Qua, off['hand' + sd], _d.subVectors(L[IX['w' + sd]], pFa));
      B['forearm' + sd].quaternion.copy(Qua).invert().multiply(Qfa);
      if (keep) B['hand' + sd].quaternion.copy(keep['hand' + sd]);
      // the leg
      const pTh = V().copy(off['thigh' + sd]).applyQuaternion(Qh).add(pHip);
      const Qth = aim(Qh, off['shin' + sd], _d.subVectors(L[IX['k' + sd]], pTh));
      B['thigh' + sd].quaternion.copy(Qh).invert().multiply(Qth);
      const pSn = V().copy(off['shin' + sd]).applyQuaternion(Qth).add(pTh);
      const Qsn = aim(Qth, off['foot' + sd], _d.subVectors(L[IX['f' + sd]], pSn));
      B['shin' + sd].quaternion.copy(Qth).invert().multiply(Qsn);
      if (keep) B['foot' + sd].quaternion.copy(keep['foot' + sd]);
    }
  }

  // how he lies: on his back or his front
  facing() {
    const P = this.p;
    const x = _a.subVectors(P[IX.hL], P[IX.hR]), y = _b.subVectors(P[IX.ch], P[IX.pv]);
    const z = _c.crossVectors(x, y);
    return z.y >= 0 ? 'up' : 'down';
  }
  // where he lies: the pelvis on the ground and the way from his feet to his head
  lie() {
    const P = this.p;
    const fx = (P[IX.fL].x + P[IX.fR].x) / 2, fz = (P[IX.fL].z + P[IX.fR].z) / 2;
    return { x: P[IX.pv].x, z: P[IX.pv].z, dir: Math.atan2(P[IX.hd].x - fx, P[IX.hd].z - fz) };
  }
  point(name, out = V()) { return out.copy(this.p[IX[name]]); }
}

// a bone's world rotation that points its child (offset `childOff`) along `want`,
// from its parent's rotation by the least turn
function aim(Qparent, childOff, want) {
  const from = _e.copy(childOff).normalize().applyQuaternion(Qparent);
  const to = _f.copy(want);
  if (to.lengthSq() < 1e-10) return Qparent.clone();
  to.normalize();
  return new THREE.Quaternion().setFromUnitVectors(from, to).multiply(Qparent);
}

// the car's boxes in its own frame (metres; x ahead of its middle, y above its ground)
function carBoxes(v) {
  const hl = v.spec.halfL;
  if (hl > 3) return [{ x0: -hl, x1: hl, y0: 0.32, y1: 2.2, low: true }];   // a lorry: a wall
  return [
    { x0: -hl, x1: hl, y0: 0, y1: 1.0, low: true },           // the body to the bonnet's line (the bumper sweeps the feet too)
    { x0: -0.6 * hl, x1: 0.24 * hl, y0: 1.0, y1: 1.66 },      // the cabin, the screen at its front
  ];
}

// a point (radius r) out of an oriented box { cx, cz, hx, hz, c, s }; true if it moved
function boxPush(pos, r, b) {
  if (b.hx < 0.005 && b.hz < 0.005) return false;
  if (b.holes && b.holes.some((h) => pos.z > h[0] && pos.z < h[1])) return false;
  const dx = pos.x - b.cx, dz = pos.z - b.cz;
  const lx = dx * b.c - dz * b.s, lz = dx * b.s + dz * b.c;
  if (Math.abs(lx) > b.hx + r || Math.abs(lz) > b.hz + r) return false;
  const qx = Math.max(-b.hx, Math.min(b.hx, lx)), qz = Math.max(-b.hz, Math.min(b.hz, lz));
  const ox = lx - qx, oz = lz - qz, d2 = ox * ox + oz * oz;
  let nlx = lx, nlz = lz;
  if (d2 > 1e-10) {
    if (d2 >= r * r) return false;
    const d = Math.sqrt(d2);
    nlx = qx + (ox / d) * r; nlz = qz + (oz / d) * r;
  } else {
    const px = b.hx - Math.abs(lx), pz = b.hz - Math.abs(lz);
    if (px < pz) nlx = Math.sign(lx || 1) * (b.hx + r); else nlz = Math.sign(lz || 1) * (b.hz + r);
  }
  pos.x = b.cx + nlx * b.c + nlz * b.s;
  pos.z = b.cz - nlx * b.s + nlz * b.c;
  return true;
}

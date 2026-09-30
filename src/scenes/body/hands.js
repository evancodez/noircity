import * as THREE from 'three';
import { OPEN, RELAX, wrap } from '../../player/handPoses.js';

// My hands in scene 3 (lane B1), object first: every moment is written as
// where the THING is (his fist, the paper, a rung, the torn half, a piece
// on the step) and the hand is solved onto it every step (hands.still: a
// pose in the eye's frame, recomputed from the world). No hand ever lags
// the thing it holds; each moment eases in from off the frame and back.
// (no default export: not a scene)
const C = (mcp, pip = mcp * 1.15, dip = pip * 0.7, s = 0) => [mcp, pip, dip, s];
export const POINT = { i: C(0.08, 0.1, 0.06, 0.02), m: C(1.25, 1.45, 0.8), r: C(1.3, 1.5, 0.8, 0.02), l: C(1.35, 1.5, 0.8, 0.06), t: [0.7, 0.35, 0.6, 0.45, 0.35] };
const PINCHF = { i: C(0.62, 0.75, 0.35), m: C(0.85, 1.05, 0.6), r: C(1.2, 1.3, 0.7), l: C(1.3, 1.3, 0.7), t: [0.72, 0.42, 0.42, 0.25, 0.2] };
const GRIPR = { ...wrap(0.016, { k: 1 }), t: [0.9, 0.3, 0.6, 0.5, 0.4] };
const CLAW = { i: C(0.5, 0.7, 0.4), m: C(0.55, 0.75, 0.4), r: C(0.6, 0.8, 0.45), l: C(0.65, 0.8, 0.45), t: [0.6, 0.3, 0.5, 0.3, 0.3] };
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _inv = new THREE.Matrix4();
const lerpF = (a, b, k) => {
  const o = {};
  for (const n of ['i', 'm', 'r', 'l', 't']) { const x = a[n], y = b[n]; o[n] = x.map((v, i) => v + (y[i] - v) * k); }
  return o;
};
export { lerpF, sstep };

// the eye's frame now (the hands' 'cam' frame: the viewmodel's root is the camera)
function inv(G) { G.camera.updateMatrixWorld(); return _inv.copy(G.camera.matrixWorld).invert(); }
export const toCam = (G, w) => w.clone().applyMatrix4(inv(G));
export const dirCam = (G, d) => d.clone().normalize().transformDirection(inv(G));

// a pose from the world: the wrist at `w`, the fingers along `f`, the back
// of the hand toward `b` (world); the elbow below and behind, toward the
// side of the hand (the eye's frame)
export function poseW(G, side, w, f, b, F, eOff = null) {
  const p = toCam(G, w), fc = dirCam(G, f), bc = dirCam(G, b);
  const sx = side === 'R' ? 1 : -1;
  // (the shoulder low at the side of the eye; the elbow between it and the
  // wrist, dropped)
  const sh = V(0.19 * sx, -0.3, 0.08);
  const e = sh.clone().lerp(p, 0.5).add(V(0.07 * sx, -0.12, 0.05));
  if (eOff) e.add(eOff);
  const P = { frame: 'cam', p: p.toArray(), f: fc.toArray(), b: bc.toArray(), F, e: e.toArray() };
  if (side === 'L') { P.p[0] = -P.p[0]; P.f[0] = -P.f[0]; P.b[0] = -P.b[0]; P.e[0] = -P.e[0]; }
  return P;
}
// a pose from a fingertip: the index's tip at `tip`, the finger along `f`
export function tipW(G, side, tip, f, b, F = POINT) {
  const fn = f.clone().normalize(), bn = b.clone().normalize();
  const w = tip.clone().addScaledVector(fn, -0.158).addScaledVector(bn, 0.004);
  return poseW(G, side, w, fn, bn, F);
}
// a pose off the frame, low at the side (where a hand comes from and goes to)
export function awayW(G, side) {
  const s = side === 'R' ? 1 : -1;
  return { frame: 'cam', p: [0.3 * s, -0.62, -0.18], f: [-0.2 * s, 0.6, -0.7], b: [0.8 * s, 0.3, 0.4], F: RELAX, e: [0.3 * s, -0.8, 0.1] };
}
// between two poses of the eye's frame (k 0..1)
export function mixPose(a, b, k) {
  const L = (x, y) => x.map((v, i) => v + (y[i] - v) * k);
  return { frame: 'cam', p: L(a.p, b.p), f: L(a.f, b.f), b: L(a.b, b.b), F: lerpF(a.F, b.F, k), e: L(a.e, b.e) };
}

// hands.still for one hand (null: back to the set's rest, hidden)
export function setHand(H, side, pose) {
  if (!pose) { if (H.still) { H.still[side] = null; if (!H.still.R && !H.still.L) H.still = null; } return; }
  if (!H.still || H.still.clip) H.still = { R: null, L: null };
  H.still[side] = pose;
}

// ---- the moments ---------------------------------------------------------------------------
// Each is a job for the scene's queue (a generator stepped once a step, as
// the diner's makeJobs): it poses the hands every step until it is done.

// his fist opened: my right hand in, the fingers worked into his, the wet
// paper out into my palm, a look at it, into my coat. The eye leans in to
// him and back (C.ease). ~1.9 s
export function* openFist(ctx, ames, { onPaper = null } = {}) {
  const { game: G, hands: H, controller: Ctl } = ctx;
  const fistW = () => ames.bones.handR.getWorldPosition(V(0, 0, 0));
  const P0 = Ctl.eyePose();
  const f0 = fistW();
  // lean: the eye down and toward the fist
  const d = V(f0.x - P0.x, 0, f0.z - P0.z).normalize();
  // (and the eyes on it: it is framed a little above the middle, so the hand
  // comes into the frame from below)
  const lean = { x: P0.x + d.x * 0.16, y: P0.y - 0.2, z: P0.z + d.z * 0.16 };
  lean.yaw = Math.atan2(-(f0.x - lean.x), -(f0.z - lean.z));
  lean.pitch = Math.max(-1.25, Math.atan2(f0.y - lean.y, Math.hypot(f0.x - lean.x, f0.z - lean.z)) + 0.28);
  Ctl.ease(lean, 0.45);
  const wad = new THREE.Group();
  const pm = new THREE.Mesh(new THREE.IcosahedronGeometry(0.022, 1).scale(1, 0.7, 1.35), new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 0.95 }));
  pm.userData.inkSurface = 'paper';
  wad.add(pm);
  wad.userData = { kind: 'paperWad', size: V(0.044, 0.03, 0.06), grip: new THREE.Matrix4() };
  const T = 1.95;
  let t = 0, got = false;
  const up = V(0, 1, 0);
  while (t < T) {
    t += 1 / 60;
    const f = fistW();
    // the hand over his fist, fingers down into it, from my side
    const toward = V(f.x - G.eye.x, 0, f.z - G.eye.z).normalize();
    const over = f.clone().add(V(0, 0.07, 0)).addScaledVector(toward, -0.03);
    const into = f.clone().add(V(0, 0.035, 0)).addScaledVector(toward, 0.005);
    const fd = toward.clone().multiplyScalar(0.55).add(V(0, -0.83, 0));
    const bd = toward.clone().multiplyScalar(0.5).add(up.clone().multiplyScalar(0.6));
    const aOver = tipW(G, 'R', over, fd, bd, CLAW), aInto = tipW(G, 'R', into, fd, bd, PINCHF);
    // (the paper up before my eyes, held in the fingers, then off to the coat)
    const show = { frame: 'cam', p: [0.06, -0.2, -0.34], f: [-0.3, 0.55, -0.78], b: [0.55, 0.45, 0.7], F: PINCHF, e: [0.2, -0.48, -0.08] };
    const away = awayW(G, 'R');
    let pose;
    if (t < 0.4) pose = mixPose(away, aOver, sstep(0, 0.4, t));
    else if (t < 0.62) pose = mixPose(aOver, aInto, sstep(0.4, 0.62, t));
    else if (t < 0.9) {
      // (working it out: the fingers pry, a small twist)
      const k = sstep(0.62, 0.9, t);
      pose = mixPose(aInto, aOver, k * 0.45);
      pose.F = lerpF(PINCHF, CLAW, Math.sin(k * Math.PI) * 0.6);
    } else if (t < 1.3) pose = mixPose(mixPose(aInto, aOver, 0.45), show, sstep(0.9, 1.3, t));
    else if (t < 1.6) pose = show;
    else pose = mixPose(show, away, sstep(1.6, T, t));
    if (!got && t >= 0.78) {
      got = true;
      const p = ames.items.get('paper'); if (p) p.visible = false;
      H.hold(wad, 'R');
      if (onPaper) onPaper();
    }
    // the eye back up as the paper comes away
    if (t >= 1.0 && t < 1.0 + 1 / 60) Ctl.ease({ ...P0 }, 0.55);
    setHand(H, 'R', pose);
    yield null;
  }
  H.hold(null, 'R', { keep: true });
  setHand(H, 'R', null);
  Ctl._ease = null;
}

// the drop ladder: up for its lowest rung, the fingers round it, down with
// it half way, let go (it drops the rest on its own weight). ~1.0 s
export function* pullLadder(ctx, ladder, { onLetGo = null } = {}) {
  const { game: G, hands: H } = ctx;
  const T = 1.05;
  let t = 0, let_ = false;
  const k0 = ladder.down;
  while (t < T) {
    t += 1 / 60;
    // the hand pulls: the ladder comes down with it between 0.4 and 0.72
    if (t > 0.4 && t <= 0.72) ladder.set(k0 + 0.42 * sstep(0.4, 0.72, t));
    const r = ladder.rung(0);
    const grip = r.clone().add(V(0.06, -0.012, 0.025));
    // (the fingers over the rung from my side, the palm up under it, the back of the hand to me)
    const fd = V(0, 0.35, -1), bd = V(0, 0.5, 0.85);
    const onR = poseW(G, 'R', grip.clone().add(V(0, -0.05, 0.075)), fd, bd, GRIPR);
    const openR = poseW(G, 'R', grip.clone().add(V(0.03, -0.12, 0.13)), fd, bd, OPEN);
    const away = awayW(G, 'R');
    let pose;
    if (t < 0.3) pose = mixPose(away, openR, sstep(0, 0.3, t));
    else if (t < 0.4) pose = mixPose(openR, onR, sstep(0.3, 0.4, t));
    else if (t < 0.75) pose = onR;
    else pose = mixPose(onR, away, sstep(0.75, T, t));
    if (!let_ && t >= 0.74) { let_ = true; if (onLetGo) onLetGo(); }
    setHand(H, 'R', pose);
    yield null;
  }
  setHand(H, 'R', null);
}

// on the ladder: each hand on a rung above the eye, taking the next but one
// when the eye has climbed past it (called every step while climbing)
export function climbHands(ctx, ladder, S) {
  const { game: G, hands: H } = ctx;
  const eye = G.eye;
  const foot = ladder.footY();
  const rungY = (i) => foot + ladder.rungs[Math.max(0, Math.min(ladder.rungs.length - 1, i))];
  // (the rung a hand wants: the highest one under shoulder height + 0.35)
  if (!S.init) {
    S.init = true;
    const base = Math.max(0, Math.round((eye.y - 0.1 - foot) / 0.3));
    S.R = { i: base, from: null, t: 1 }; S.L = { i: base + 1, from: null, t: 1 };
    S.next = 'R';
  }
  const dt = 1 / 60;
  for (const side of ['R', 'L']) {
    const h = S[side];
    // too low (under the chin by 0.45): up to two above the other hand
    const other = S[side === 'R' ? 'L' : 'R'];
    if (h.t >= 1 && rungY(h.i) < eye.y - 0.42 && S.next === side) { h.from = h.i; h.i = Math.min(ladder.rungs.length - 1, other.i + 1); h.t = 0; S.next = side === 'R' ? 'L' : 'R'; S.onRung && S.onRung(side); }
    // (going down: the hand too high goes down past the other)
    if (h.t >= 1 && rungY(h.i) > eye.y + 0.35 && S.next === side) { h.from = h.i; h.i = Math.max(0, other.i - 1); h.t = 0; S.next = side === 'R' ? 'L' : 'R'; S.onRung && S.onRung(side); }
    h.t = Math.min(1, h.t + dt / 0.2);
  }
  const s = (side) => (side === 'R' ? 1 : -1);
  const at = (side, i) => ladder.rung(i).clone().add(V(s(side) * 0.13, -0.012, 0.03));
  for (const side of ['R', 'L']) {
    const h = S[side];
    const fd = V(0, 0.3, -1), bd = V(0, 0.45, 0.9);
    const on = poseW(G, side, at(side, h.i).add(V(0, -0.05, 0.075)), fd, bd, GRIPR);
    let pose = on;
    if (h.t < 1 && h.from != null) {
      // (the reach: off one rung, round it and onto the next, open in the air)
      const off = poseW(G, side, at(side, h.from).add(V(0, -0.05, 0.075)), fd, bd, GRIPR);
      pose = mixPose(off, on, sstep(0, 1, h.t));
      pose.F = lerpF(GRIPR, OPEN, Math.sin(h.t * Math.PI));
      pose.p[2] += 0.05 * Math.sin(h.t * Math.PI);
    }
    setHand(H, side, pose);
  }
}
export function handsOff(H) { setHand(H, 'R', null); setHand(H, 'L', null); }

// the torn half off the grating: down on my heels, the fingers pinch it up,
// it comes up before my eyes (the red, the half bird), into my coat. ~1.9 s
export function* takeHalf(ctx, half, { onTaken = null } = {}) {
  const { game: G, hands: H, controller: Ctl } = ctx;
  const P0 = Ctl.eyePose();
  const hp = half.getWorldPosition(V(0, 0, 0));
  const d = V(hp.x - P0.x, 0, hp.z - P0.z);
  const dist = d.length(); d.normalize();
  // (down on my heels, closer: the eye 0.95 over the grating)
  const low = { x: P0.x + d.x * Math.max(0, dist - 0.5), y: hp.y + 0.95, z: P0.z + d.z * Math.max(0, dist - 0.5), yaw: Math.atan2(-d.x, -d.z), pitch: -0.95 };
  Ctl.ease(low, 0.4);
  const T = 2.0;
  let t = 0, got = false;
  const holder = new THREE.Group();
  while (t < T) {
    t += 1 / 60;
    const tip = hp.clone().add(V(0, 0.006, 0));
    const fd = d.clone().multiplyScalar(0.5).add(V(0, -0.85, 0)), bd = d.clone().multiplyScalar(0.55).add(V(0, 0.6, 0));
    const aOver = tipW(G, 'R', tip.clone().add(V(0, 0.06, 0)), fd, bd, CLAW);
    const aOn = tipW(G, 'R', tip, fd, bd, PINCHF);
    const show = { frame: 'cam', p: [0.05, -0.17, -0.3], f: [-0.3, 0.6, -0.74], b: [0.5, 0.45, 0.74], F: PINCHF, e: [0.2, -0.46, -0.08] };
    const away = awayW(G, 'R');
    let pose;
    if (t < 0.45) pose = mixPose(away, aOver, sstep(0.05, 0.45, t));
    else if (t < 0.62) pose = mixPose(aOver, aOn, sstep(0.45, 0.62, t));
    else if (t < 1.05) pose = mixPose(aOn, show, sstep(0.66, 1.05, t));
    else if (t < 1.55) pose = show;
    else pose = mixPose(show, away, sstep(1.55, T, t));
    if (!got && t >= 0.64) {
      got = true;
      // (the half itself into my fingers)
      H.hold(half, 'R');
      if (onTaken) onTaken();
    }
    if (t >= 0.7 && t < 0.7 + 1 / 60) Ctl.ease({ ...P0 }, 0.6);
    setHand(H, 'R', pose);
    yield null;
  }
  H.hold(null, 'R', { keep: true });
  half.visible = false;
  setHand(H, 'R', null);
  Ctl._ease = null;
  void holder;
}

// a table puzzle's fingertip: the index's tip on the pointer (on the thing
// it holds), the hand in from the lower right; pressed: down on it
export function tableFinger(ctx, S, world, down, lift = 0) {
  const { game: G, hands: H } = ctx;
  const cam = G.camera;
  // (the hand comes from my right and toward me: its fingers point away
  // and a little left, down onto the step)
  const right = V(1, 0, 0).applyQuaternion(cam.quaternion); right.y = 0; right.normalize();
  const fwd = V(0, 0, -1).applyQuaternion(cam.quaternion); fwd.y = 0; fwd.normalize();
  const fd = fwd.clone().multiplyScalar(0.55).addScaledVector(right, -0.3).add(V(0, -0.78, 0));
  const bd = fwd.clone().multiplyScalar(0.4).addScaledVector(right, 0.25).add(V(0, 0.85, 0));
  const tip = world.clone().add(V(0, 0.004 + (down ? 0 : 0.012) + lift, 0));
  const want = tipW(G, 'R', tip, fd, bd, POINT);
  // (a short ease toward where it goes: never a lag behind the pointer)
  if (!S.pose) S.pose = mixPose(awayW(G, 'R'), want, 0);
  S.k = Math.min(1, (S.k || 0) + 1 / 60 / 0.25);
  const k = S.k * S.k * (3 - 2 * S.k);
  S.pose = k < 1 ? mixPose(awayW(G, 'R'), want, k) : want;
  setHand(H, 'R', S.pose);
}

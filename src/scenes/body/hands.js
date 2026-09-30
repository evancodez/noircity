import * as THREE from 'three';
import { RELAX, wrap } from '../../player/handPoses.js';

// My hands in scene 3 (lane B1), object first: every moment is written as
// where the THING is (his fist, the paper, a rung, the torn half, a piece
// on the step) and the hand is solved onto it every step (hands.still: a
// pose in the eye's frame, recomputed from the world). No hand ever lags
// the thing it holds; each moment eases in from off the frame and back.
// (no default export: not a scene)
const C = (mcp, pip = mcp * 1.15, dip = pip * 0.7, s = 0) => [mcp, pip, dip, s];
export const POINT = { i: C(0.08, 0.1, 0.06, 0.02), m: C(1.25, 1.45, 0.8), r: C(1.3, 1.5, 0.8, 0.02), l: C(1.35, 1.5, 0.8, 0.06), t: [0.7, 0.35, 0.6, 0.45, 0.35] };
const PINCHF = { i: C(0.62, 0.75, 0.35), m: C(0.85, 1.05, 0.6), r: C(1.2, 1.3, 0.7), l: C(1.3, 1.3, 0.7), t: [0.72, 0.42, 0.42, 0.25, 0.2] };
// a hook round a rung of the drop ladder (13 mm iron) [second pass]: fitted
// on the rig (node forward kinematics of HandRig, scratch fit.mjs): the palm
// tangent to the rung at the knuckles, every phalanx 0.5-2 mm off the iron
// over the top and down the far side, the thumb's tip under the near side
export const RUNG_R = 0.013;
const RUNG_GRIP = { i: [0.805, 0.95, 0.865, 0], m: [1.0, 1.02, 1.08, 0], r: [0.9, 0.85, 1.113, 0], l: [0.65, 0.455, 0.893, 0], t: [0.7, -0.2, 1.0, 0.9, 0.4] };
// (between rungs the hand half open, the fingers together: not splayed flat)
const REACH = { i: C(0.35, 0.45, 0.3), m: C(0.4, 0.5, 0.3), r: C(0.45, 0.55, 0.32), l: C(0.5, 0.6, 0.35), t: [0.45, 0.1, 0.4, 0.35, 0.3] };
void wrap;
const CLAW = { i: C(0.5, 0.7, 0.4), m: C(0.55, 0.75, 0.4), r: C(0.6, 0.8, 0.45), l: C(0.65, 0.8, 0.45), t: [0.6, 0.3, 0.5, 0.3, 0.3] };
// a pinch that holds a thing ~3 cm across between the index's pad and the
// thumb's (fitted on the rig: the pads 32 mm apart in front of the palm;
// src/player/clips/body.js puts what it holds there)
const PINCH = { i: [0.4, 1.2, 0.72, 0], m: C(0.95, 1.1, 0.65), r: C(1.2, 1.3, 0.7), l: C(1.3, 1.3, 0.7), t: [0.5, 0, 0.3, 0, 0.2] };
// (the pinch's middle in the hand bone's frame: where the index's tip and
// the thumb's meet a thing)
const PINCH_AT = [-0.0349, -0.0535, -0.0998];
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
  // (true coordinates of the eye's frame for either hand: Hands.resolve
  // mirrors a left pose into its arm itself [second pass: this mirrored it
  // a second time, and the left hand went to the right of the ladder])
  return { frame: 'cam', p: p.toArray(), f: fc.toArray(), b: bc.toArray(), F, e: e.toArray() };
}
// a hand hooked round a rung (world): the rung's axis point `c` (the hand's
// middle on it), the knuckles' tangent `th` rad round from the climber's side
// (0) over the top (pi/2); `back` pulls the hand off it toward me (m)
export function rungPose(G, side, c, th = 0.87, F = RUNG_GRIP, back = 0, up = 0) {
  const n = V(0, -Math.sin(th), -Math.cos(th));
  const f = V(0, Math.cos(th), -Math.sin(th));
  const b = n.clone().negate();
  const w = c.clone().addScaledVector(n, -(RUNG_R + 0.001)).addScaledVector(f, -0.09).addScaledVector(b, 0.018);
  w.z += back; w.y += up;
  return poseW(G, side, w, f, b, F);
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

// a pose from a pinch: the pinch's middle (PINCH_AT on the hand) at `at`
// (world), the fingers along `f`, the back of the hand toward `b`
export function pinchW(G, side, at, f, b, F = PINCH) {
  const z = f.clone().normalize().negate();
  const y = b.clone().addScaledVector(z, -b.dot(z)).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  const w = at.clone().addScaledVector(x, -PINCH_AT[0]).addScaledVector(y, -PINCH_AT[1]).addScaledVector(z, -PINCH_AT[2]);
  return poseW(G, side, w, f, b, F);
}
// a crumple of wet paper (seeded: every one the same), `r` its radius
export function paperWad(r = 0.017) {
  const geo = new THREE.IcosahedronGeometry(r, 2);
  const p = geo.getAttribute('position');
  let s = 17;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const bumps = Array.from({ length: 9 }, () => [V(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(), 0.12 + rnd() * 0.25]);
  const v = V(0, 0, 0);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = v.clone().normalize();
    let k = 1;
    for (const [d, a] of bumps) k += a * Math.max(0, n.dot(d)) ** 6 - a * 0.35 * Math.max(0, -n.dot(d)) ** 8;
    v.multiplyScalar(k);
    p.setXYZ(i, v.x * 1.15, v.y * 0.8, v.z * 1.05);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xd2d2d2, roughness: 0.95, flatShading: true }));
  m.userData.inkSurface = 'paper';
  return m;
}

// his fist opened [second pass: the pry seen, the paper paper]: the eye
// leans in over his hand (framed just under the middle), my right hand
// comes in open over it, the index and thumb close on the wet paper
// showing between his fingers, work it out with a twist and a pull, and
// it comes away pinched between them - up before my eyes, then into my
// coat as the eye comes back. ~1.95 s
export function* openFist(ctx, ames, { onPaper = null } = {}) {
  const { game: G, hands: H, controller: Ctl } = ctx;
  const paper = ames.items.get('paper');
  const paperW = () => (paper ? paper.getWorldPosition(V(0, 0, 0)) : ames.bones.handR.getWorldPosition(V(0, 0, 0)));
  const P0 = Ctl.eyePose();
  const f0 = paperW();
  const d = V(f0.x - P0.x, 0, f0.z - P0.z);
  const dist = d.length(); d.normalize();
  // lean: in over it (0.45 m off, the eye 0.55 over it), the fist 0.12 rad
  // under the middle of the frame so my hand, from below, is all in it
  const off = Math.min(dist, 0.45);
  const lean = { x: f0.x - d.x * off, y: Math.min(P0.y, f0.y + 0.55), z: f0.z - d.z * off };
  lean.yaw = Math.atan2(-(f0.x - lean.x), -(f0.z - lean.z));
  lean.pitch = Math.max(-1.25, Math.atan2(f0.y - lean.y, Math.hypot(f0.x - lean.x, f0.z - lean.z)) + 0.12);
  Ctl.ease(lean, 0.42);
  const wad = new THREE.Group();
  wad.add(paperWad());
  wad.userData = { kind: 'paperWad', size: V(0.04, 0.028, 0.036) };
  const T = 1.95;
  let t = 0, got = false;
  const up = V(0, 1, 0);
  while (t < T) {
    t += 1 / 60;
    const f = paperW();
    // in from my right, across the frame: the fingers down and to the left
    // into his hand, the back of the hand up (seen side on, the index and
    // the thumb at work, not hidden under my own sleeve)
    const toward = V(f.x - G.eye.x, 0, f.z - G.eye.z).normalize();
    const side = V(-toward.z, 0, toward.x);
    const fd = side.clone().multiplyScalar(-0.72).add(V(0, -0.6, 0)).addScaledVector(toward, 0.25);
    const bd = up.clone().multiplyScalar(0.8).addScaledVector(side, 0.35).addScaledVector(toward, -0.1);
    const aOver = pinchW(G, 'R', f.clone().add(V(0, 0.07, 0)).addScaledVector(side, 0.05), fd, bd, REACH);
    const aOn = pinchW(G, 'R', f.clone().add(V(0, 0.004, 0)), fd, bd, PINCH);
    // (the paper up before my eyes in the pinch, then off to the coat)
    G.camera.updateMatrixWorld();
    const cw = (x, y, z) => V(x, y, z).applyMatrix4(G.camera.matrixWorld);
    const cd = (x, y, z) => V(x, y, z).transformDirection(G.camera.matrixWorld);
    const show = pinchW(G, 'R', cw(0.035, -0.1, -0.34), cd(-0.3, 0.7, -0.62), cd(0.7, 0.25, 0.65), PINCH);
    const away = awayW(G, 'R');
    let pose;
    if (t < 0.36) pose = mixPose(away, aOver, sstep(0, 0.36, t));
    else if (t < 0.56) { pose = mixPose(aOver, aOn, sstep(0.36, 0.56, t)); pose.F = lerpF(REACH, PINCH, sstep(0.4, 0.56, t)); }
    else if (t < 0.86) {
      // (working it out of his fingers: a twist of the wrist, then a pull)
      const k = sstep(0.56, 0.86, t);
      const tw = Math.sin(k * Math.PI * 2) * 0.22 * (1 - k);
      const f2 = fd.clone().applyAxisAngle(up, tw), b2 = bd.clone().applyAxisAngle(up, tw);
      pose = pinchW(G, 'R', f.clone().add(V(0, 0.004 + 0.05 * k * k, 0)), f2, b2, PINCH);
    } else if (t < 1.25) pose = mixPose(pinchW(G, 'R', f.clone().add(V(0, 0.054, 0)), fd, bd, PINCH), show, sstep(0.86, 1.25, t));
    else if (t < 1.55) pose = show;
    else pose = mixPose(show, away, sstep(1.55, T, t));
    if (!got && t >= 0.62) {
      got = true;
      if (paper) paper.visible = false;
      H.hold(wad, 'R');
      if (onPaper) onPaper();
    }
    // the eye back up as the paper comes away
    if (t >= 0.9 && t < 0.9 + 1 / 60) Ctl.ease({ ...P0 }, 0.6);
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
    // (the fingers hooked over the lowest rung from my side, fitted round
    // it; coming to it open, below and short of it, never through it)
    const r = ladder.rung(0).add(V(0.07, 0, 0));
    const onR = rungPose(G, 'R', r, 1.0);
    const openR = rungPose(G, 'R', r, 1.0, REACH, 0.07, -0.05);
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

// on the ladder: each hand hooked round a rung, the lower one reaching past
// the other to the rung above it when the eye has climbed past its own
// (called every step while climbing). A reach comes off the rung toward me
// (the fingers open out of their hook first), goes up in front of the rungs
// between, and hooks over the new one from my side: it never passes through
// the iron. Both rungs held are kept between the chin and a forearm over
// the eye, where the frame (looking a little up the ladder) shows them.
export function climbHands(ctx, ladder, S) {
  const { game: G, hands: H } = ctx;
  const eye = G.eye;
  const foot = ladder.footY();
  const top = ladder.rungs.length - 1;
  const rungY = (i) => foot + ladder.rungs[Math.max(0, Math.min(top, i))];
  const want = () => Math.max(0, Math.min(top, Math.round((eye.y + 0.1 - foot) / 0.3) - 1));
  if (!S.init) {
    S.init = true;
    const base = want();
    S.R = { i: base, from: null, t: 1 }; S.L = { i: Math.min(top, base + 1), from: null, t: 1 };
    S.next = 'R';
  }
  const dt = 1 / 60;
  const REACH_T = 0.17;
  for (const side of ['R', 'L']) {
    const h = S[side];
    const other = S[side === 'R' ? 'L' : 'R'];
    if (h.t >= 1 && other.t >= 0.6 && S.next === side) {
      // (up: the lower hand under the chin goes to the rung over the other)
      if (rungY(h.i) < eye.y - 0.18 && other.i + 1 <= top) { h.from = h.i; h.i = other.i + 1; h.t = 0; S.next = side === 'R' ? 'L' : 'R'; }
      // (down: the higher hand over the brow goes to the rung under the other)
      else if (rungY(h.i) > eye.y + 0.42 && other.i - 1 >= 0) { h.from = h.i; h.i = other.i - 1; h.t = 0; S.next = side === 'R' ? 'L' : 'R'; }
    }
    if (h.t < 1) {
      const t0 = h.t;
      h.t = Math.min(1, h.t + dt / REACH_T);
      // (the iron rings when the hand closes on it)
      if (t0 < 0.8 && h.t >= 0.8 && S.onRung) S.onRung(side);
    }
  }
  const s = (side) => (side === 'R' ? 1 : -1);
  const at = (side, i) => ladder.rung(i).add(V(s(side) * 0.12, 0, 0));
  for (const side of ['R', 'L']) {
    const h = S[side];
    let pose = rungPose(G, side, at(side, h.i));
    if (h.t < 1 && h.from != null) {
      // off (0 .. 0.25): the hook opens and the hand draws back off the iron;
      // across (.25 .. .8): up (or down) in front of the rungs, half open;
      // on (.8 .. 1): in over the new rung, the fingers close round it
      const u = h.t;
      const open = u < 0.25 ? sstep(0, 0.25, u) : u < 0.8 ? 1 : 1 - sstep(0.8, 1, u);
      const back = 0.085 * open;
      const k = sstep(0.15, 0.85, u);
      const a = at(side, h.from), b = at(side, h.i);
      const c = a.clone().lerp(b, k);
      pose = rungPose(G, side, c, 0.87, lerpF(RUNG_GRIP, REACH, open), back, 0.02 * open);
    }
    setHand(H, side, pose);
  }
}
export function handsOff(H) { setHand(H, 'R', null); setHand(H, 'L', null); }

// the torn half off the grating: down on my heels, the fingers pinch it up
// (then the scene holds it up to be turned: inspect, as scene 2's
// matchbook). ~0.9 s
export function* takeHalf(ctx, half, { onTaken = null } = {}) {
  const { game: G, hands: H, controller: Ctl } = ctx;
  const P0 = Ctl.eyePose();
  const hp = half.getWorldPosition(V(0, 0, 0));
  const d = V(hp.x - P0.x, 0, hp.z - P0.z);
  const dist = d.length(); d.normalize();
  // (down on my heels, closer, the eyes on it)
  const low = { x: P0.x + d.x * Math.max(0, dist - 0.45), y: hp.y + 0.9, z: P0.z + d.z * Math.max(0, dist - 0.45) };
  low.yaw = Math.atan2(-(hp.x - low.x), -(hp.z - low.z));
  low.pitch = Math.atan2(hp.y - low.y, Math.hypot(hp.x - low.x, hp.z - low.z)) + 0.3;
  Ctl.ease(low, 0.38);
  const T = 0.95;
  let t = 0, got = false;
  while (t < T) {
    t += 1 / 60;
    const tip = hp.clone().add(V(0, 0.006, 0));
    const fd = d.clone().multiplyScalar(0.5).add(V(0, -0.85, 0)), bd = d.clone().multiplyScalar(0.55).add(V(0, 0.6, 0));
    const aOver = tipW(G, 'R', tip.clone().add(V(0, 0.06, 0)), fd, bd, CLAW);
    const aOn = tipW(G, 'R', tip, fd, bd, PINCHF);
    const away = awayW(G, 'R');
    let pose;
    if (t < 0.4) pose = mixPose(away, aOver, sstep(0.02, 0.4, t));
    else if (t < 0.56) pose = mixPose(aOver, aOn, sstep(0.4, 0.56, t));
    else pose = mixPose(aOn, away, sstep(0.6, T, t));
    if (!got && t >= 0.58) {
      got = true;
      if (onTaken) onTaken();
      Ctl.ease({ ...P0 }, 0.45);
    }
    setHand(H, 'R', pose);
    yield null;
  }
  setHand(H, 'R', null);
  Ctl._ease = null;
}

// a table puzzle's fingertip: the index's tip on the pointer (on the thing
// it holds), the hand in from the lower right; pressed: down on it
// (gone: the thing done - the bird whole, the note read - the hand draws
// back off the frame so what it made is seen [second pass])
export function tableFinger(ctx, S, world, down, lift = 0, gone = false) {
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
  S.k = gone ? Math.max(0, (S.k || 0) - 1 / 60 / 0.35) : Math.min(1, (S.k || 0) + 1 / 60 / 0.25);
  const k = S.k * S.k * (3 - 2 * S.k);
  S.pose = k < 1 ? mixPose(awayW(G, 'R'), want, k) : want;
  setHand(H, 'R', S.pose);
}

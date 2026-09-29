import * as THREE from 'three';
import { gripHand, palmTo, armTo, place, setWorld } from './ik.js';

// Dot's hands on things (Wave A round 2, owner 2): object first. Each thing
// she handles has its path authored here - the tumbler up from under the
// counter and down on it, the scotch off the back bar, carried, tipped over
// the glass, righted, corked, set down, the glass slid to my hand - and her
// arm is solved onto its grip every step, after her clip has posed her body
// (fig.afterPose). The scene (scenes/01_diner.js) runs these as jobs.
//   const H = handsOn(dot)        the per-step driver (one per figure)
//   H.R / H.L = { M, grip, dir, pole, w } | { flat: () => ({ point, normal, fwd }), pole, w } | null
//   H.things = [{ obj, M }]       things set to a world matrix every step
//   (M, dir, pole, w, flat may be functions of nothing, read every step)
// Choreographies (generators for makeJobs):
//   serveGlass(ctx, dot, glassAt) -> the tumbler (up from under the counter, down at glassAt)
//   fetchBottle(ctx, dot, d)      -> the scotch (off the back bar, carried back to her place)
//   pourScotch(ctx, dot, bottle, glass, { onStream, onUncork, onCork })
//   slideGlass(ctx, dot, glass, to, { onRelease })
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const ss = (u) => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };
const val = (f) => (typeof f === 'function' ? f() : f);
const STEP = 1 / 60;
const _ql = new THREE.Quaternion(), _X = new THREE.Vector3(1, 0, 0);

export function handsOn(c) {
  if (c._hands) return c._hands;
  const fig = c.fig;
  // (things: set before the arms are solved - what a hand holds; after: set
  // from a solved hand - what rides in its fingers, a cork)
  const H = { R: null, L: null, things: [], after: [], miss: { R: 0, L: 0 }, worst: 0, worstBy: {}, _label: null, when: {}, lean: 0, leanNow: 0 };
  // (the choreography's phase; when each began, in game time: the probes read it)
  Object.defineProperty(H, 'label', { get() { return H._label; }, set(v) { H._label = v; if (v && H.when[v] == null) { const g = c.game; H.when[v] = g ? +(g.time || 0).toFixed(2) : 0; } } });
  fig.afterPose = (f, dt) => {
    // (she leans into her work: the spine and chest bowed toward the thing,
    // eased; the arms are solved from where that puts her shoulders)
    H.leanNow += ((H.lean || 0) - H.leanNow) * Math.min(1, (dt || 0) * 5);
    if (Math.abs(H.leanNow) > 1e-4) {
      const b = f.bones;
      b.spine.quaternion.multiply(_ql.setFromAxisAngle(_X, H.leanNow * 0.45));
      b.chest.quaternion.multiply(_ql.setFromAxisAngle(_X, H.leanNow * 0.55));
      f.object.updateMatrixWorld(true);
    }
    for (const th of H.things) { const M = val(th.M); if (M) setWorld(th.obj, M); }
    for (const s of ['R', 'L']) {
      const b = H[s];
      if (!b) continue;
      const w = val(b.w ?? 1);
      if (!(w > 0)) continue;
      let T;
      if (b.flat) { const F = val(b.flat); T = palmTo(f, s, F.point, F.normal, F.fwd); }
      else if (b.target) T = val(b.target);
      else T = gripHand(f, s, val(b.M), { ...b.grip, dir: val(b.dir) });
      H.miss[s] = armTo(f, s, T.wrist, T.q, val(b.pole), w);
      // (the worst miss while the hand is fully on a thing: the probes read it)
      if (w > 0.98 && H.miss[s] > H.worst) H.worst = H.miss[s];
      if (w > 0.98) { const k = (H.label || '?') + s; if (!(H.worstBy[k] >= H.miss[s])) H.worstBy[k] = +H.miss[s].toFixed(4); }
    }
    for (const th of H.after) { const M = val(th.M); if (M) setWorld(th.obj, M); }
  };
  c._hands = H;
  return H;
}
export function handsOff(c) {
  const H = c._hands;
  if (!H) return;
  H.R = H.L = null; H.things.length = 0; H.after.length = 0;
}

// her eyes held on a thing while she works (the room's glances wait)
export function gaze(c, at) {
  const G = c._glance;
  if (at) { if (G) { G.until = 0; G.next = 1e9; } c.fig.lookAt(at.clone ? at.clone() : at); }
  else { if (G) G.next = 2 + 3 * c.rng.next(); c.fig.lookAt(null); }
}

// ---- frames ------------------------------------------------------------------------
// her heading frame at the root: fwd, right (world), the root's floor point
export function heading(c) {
  const y = c.fig.yaw;
  const fwd = V(Math.sin(y), 0, Math.cos(y));
  return { fwd, right: V(-Math.cos(y), 0, Math.sin(y)), at: c.fig.pos.clone() };
}
// a point in her heading frame (metres: fwd, up from the floor, right)
export const inHeading = (c, f, up, r) => { const h = heading(c); return h.at.clone().addScaledVector(h.fwd, f).addScaledVector(h.right, r).setY(h.at.y + up); };
// the elbow's way for the right / left arm: out to her side, down, a little back
export const pole = (c, side, out = 1, down = 0.7, back = 0.3) => () => { const h = heading(c); return h.right.clone().multiplyScalar(side === 'R' ? out : -out).addScaledVector(UP, -down).addScaledVector(h.fwd, -back); };

// a key track of world matrices: [[t, { p: Vector3 | fn, q: Quaternion | fn }], ...]
// smooth between keys (smoothstep), positions on a Catmull-Rom through them
export function track(keys) {
  const P = (k) => val(k[1].p), Qk = (k) => val(k[1].q) || new THREE.Quaternion();
  return (t) => {
    let i = 0;
    while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
    const k0 = keys[i], k1 = keys[Math.min(keys.length - 1, i + 1)];
    const u = k1 === k0 ? 0 : ss((t - k0[0]) / Math.max(1e-6, k1[0] - k0[0]));
    const a = P(k0), b = P(k1);
    const pa = i > 0 ? P(keys[i - 1]) : a.clone().multiplyScalar(2).sub(b);
    const pb = i + 2 < keys.length ? P(keys[i + 2]) : b.clone().multiplyScalar(2).sub(a);
    const u2 = u * u, u3 = u2 * u;
    const p = V(0, 0, 0).addScaledVector(pa, -0.5 * u3 + u2 - 0.5 * u).addScaledVector(a, 1.5 * u3 - 2.5 * u2 + 1)
      .addScaledVector(b, -1.5 * u3 + 2 * u2 + 0.5 * u).addScaledVector(pb, 0.5 * u3 - 0.5 * u2);
    return place(p, Qk(k0).clone().slerp(Qk(k1), u));
  };
}
// run fn(t) every step for `dur` seconds (a job's body)
export function* over(dur, fn) {
  for (let t = 0; t < dur - 1e-6; t += STEP) { fn(t); yield null; }
  fn(dur);
}
export const yawQ = (yaw) => new THREE.Quaternion().setFromAxisAngle(UP, yaw);

// ---- the tumbler: up from under the counter, down on it at `at` ---------------------------
// (the right hand; she bends a little to it: her 'serve' clip under the arm)
export function* serveGlass(ctx, c, glass, at, { onDown } = {}) {
  const H = handsOn(c);
  H.label = 'serve';
  const h = heading(c);
  const under = inHeading(c, 0.3, 0.98, 0.18), lift = inHeading(c, 0.32, 1.28, 0.22);
  const hover = at.clone().add(V(0, 0.03, 0)).addScaledVector(h.fwd, -0.02);
  const q = yawQ(c.fig.yaw);
  const tr = track([[0, { p: under, q }], [0.35, { p: under, q }], [0.72, { p: lift, q }], [0.95, { p: hover, q }], [1.08, { p: at, q }]]);
  let T = 0;
  H.things = [{ obj: glass, M: () => tr(T) }];
  const dir = () => h.fwd.clone().negate().addScaledVector(UP, -0.35).addScaledVector(h.right, 0.35);
  let w = 0;
  H.R = { M: () => tr(T), grip: { r: 0.0375, h: 0.036, thumb: 1 }, dir, pole: pole(c, 'R', 1, 0.8, 0.2), w: () => w };
  gaze(c, at);
  H.lean = 0.18;
  c.play('serve', { fade: 0.25 });
  let down = false;
  yield* over(1.35, (t) => {
    T = t;
    w = t < 0.35 ? ss(t / 0.35) : t > 1.12 ? 1 - ss((t - 1.12) / 0.23) : 1;
    if (!down && t >= 1.08) { down = true; if (onDown) onDown(); }
  });
  H.things = []; H.R = null; H.lean = 0;
  gaze(c, null);
  setWorld(glass, place(at, q));
  rebase(glass);
}

// ---- the scotch off the back bar, carried back to her place ---------------------------------
// She turns, walks to the back bar, takes the bottle by its body (it leaves
// the shelf upright, toward her), turns and walks back to her place carrying
// it upright before her right hip.
export function* fetchBottle(ctx, c, bottle, back, { face = null } = {}) {
  const H = handsOn(c);
  H.label = 'fetch';
  const shelf = bottle.getWorldPosition(V(0, 0, 0));
  const q0 = bottle.getWorldQuaternion(new THREE.Quaternion());
  // (to the back bar: 0.48 m short of the bottle, facing it)
  const toward = V(shelf.x - c.fig.pos.x, 0, shelf.z - c.fig.pos.z).normalize();
  const stand = shelf.clone().addScaledVector(toward, -0.42);
  yield* c.walkTo({ x: stand.x, z: stand.z }, { speed: 1.3 });
  c.face(Math.atan2(toward.x, toward.z));
  c.setState('idle', 0.2);
  gaze(c, shelf.clone().add(V(0, 0.15, 0)));
  H.lean = 0.1;
  // reach, take, lift toward her
  const h = heading(c);
  const lifted = shelf.clone().add(V(0, 0.045, 0)).addScaledVector(h.fwd, -0.1).addScaledVector(h.right, 0.03);
  let T = 0, w = 0;
  const tr = track([[0, { p: shelf, q: q0 }], [0.4, { p: shelf, q: q0 }], [0.7, { p: lifted, q: q0 }]]);
  H.things = [{ obj: bottle, M: () => tr(T) }];
  const dir = () => { const g = heading(c); return g.fwd.clone().negate().addScaledVector(UP, -0.45).addScaledVector(g.right, 0.5); };
  H.R = { M: () => tr(T), grip: { r: 0.046, h: 0.12, thumb: 1 }, dir, pole: pole(c, 'R', 1, 0.75, 0.35), w: () => w };
  yield* over(0.72, (t) => { T = t; w = ss(t / 0.36); });
  // carried: upright before her right hip (her heading frame); it goes
  // there from the shelf over the first 0.45 s of the walk back
  const carry = () => place(inHeading(c, 0.26, 0.98, 0.2), yawQ(c.fig.yaw + Math.PI / 2));
  const from = tr(0.72);
  let k = 0;
  const blend = () => {
    const A = from, B = carry();
    const pa = V(0, 0, 0), qa = new THREE.Quaternion(), pb = V(0, 0, 0), qb = new THREE.Quaternion(), s = V(1, 1, 1);
    A.decompose(pa, qa, s); B.decompose(pb, qb, s);
    const u = ss(k);
    return place(pa.lerp(pb, u), qa.slerp(qb, u));
  };
  H.things = [{ obj: bottle, M: blend }];
  H.R = { M: blend, grip: { r: 0.046, h: 0.12, thumb: 1 }, dir, pole: pole(c, 'R', 1, 0.75, 0.3), w: 1 };
  gaze(c, null);
  H.label = 'fetchWalk';
  H.lean = 0;
  const walk = c.walkTo(back, { speed: 1.2 });
  for (let n = 0; ; n++) {
    k = Math.min(1, n * STEP / 0.45);
    const r = walk.next();
    if (r.done) break;
    yield r.value;
  }
  while (k < 1) { k = Math.min(1, k + STEP / 0.45); yield null; }
  if (face != null) c.face(face);
  c.setState('idle', 0.2);
  gaze(c, null);
}

// ---- the pour -----------------------------------------------------------------------------
// At her place, the glass before her: the bottle comes up over the glass,
// upright, beside it; her left hand draws the cork and rests on the counter;
// the bottle tips about the axis along the counter until its mouth is below
// its base and over the glass (115 degrees from upright, the lip 6.5 cm over
// the rim); the stream runs; she rights it with a twist of the wrist, the
// left hand corks it, the bottle goes down on the counter at her right.
export const POUR = { tilt: 115, over: 0.065, gripH: 0.12, lipFrom: 0.138, pour: 1.3 };
export function* pourScotch(ctx, c, bottle, glass, { onUncork, onStream, onStreamOff, onCork, onDown } = {}, downAt0 = null) {
  const H = handsOn(c);
  H.label = 'pour';
  const h = heading(c);
  const G = glass.getWorldPosition(V(0, 0, 0));
  const S = bottle.userData.size || V(0.092, 0.28, 0.092);
  const lipY = bottle.userData.neck ? bottle.userData.neck.y : S.y - 0.022;
  const L = lipY - POUR.gripH;          // grip to lip, along the axis
  // the axis the bottle tips about: along the counter (her right), so the
  // mouth goes forward over the glass
  const tipAxis = h.right.clone();
  const tipQ = (deg) => new THREE.Quaternion().setFromAxisAngle(tipAxis, -deg * Math.PI / 180);
  const q0 = yawQ(c.fig.yaw);   // (its label to me, across the counter)
  const axisOf = (deg) => UP.clone().applyQuaternion(tipQ(deg));
  // the grip point stays where the hand holds it while the bottle tips; it
  // is placed so that at full tilt the lip is `over` above the rim, over
  // the glass's middle (a hair to her side: the stream leaves the lip moving
  // forward)
  const rimY = G.y + 0.085;
  const lipAt = G.clone().setY(rimY + POUR.over).addScaledVector(h.fwd, -0.022);
  const Pg = lipAt.clone().addScaledVector(axisOf(POUR.tilt), -L);
  // the bottle's world matrix: tilt (deg), twist (deg about its own axis), the grip at Pg + d
  const M = (deg, twist = 0, d = null) => {
    const q = tipQ(deg).multiply(q0).multiply(new THREE.Quaternion().setFromAxisAngle(UP, twist * Math.PI / 180));
    const ax = UP.clone().applyQuaternion(q);
    const p = Pg.clone().addScaledVector(ax, -POUR.gripH);
    if (d) p.add(d);
    return place(p, q);
  };
  const from = bottle.matrixWorld.clone();
  let cur = from;
  H.things = [{ obj: bottle, M: () => cur }];
  // (the wrist toward her side, back and down, square to the bottle's axis)
  const dirR = () => h.fwd.clone().multiplyScalar(-0.55).addScaledVector(UP, -0.55).addScaledVector(h.right, 0.6);
  H.R = { M: () => cur, grip: { r: 0.046, h: POUR.gripH, thumb: 1 }, dir: dirR, pole: pole(c, 'R', 1, 0.45, 0.35), w: 1 };
  gaze(c, G.clone().setY(G.y + 0.05));
  H.lean = 0.14;
  // 1. from the carry up over the glass, upright, beside it
  const pa = V(0, 0, 0), qa = new THREE.Quaternion(), s1 = V(1, 1, 1);
  from.decompose(pa, qa, s1);
  const up0 = M(0, 0, V(0, 0.02, 0));
  const pb = V(0, 0, 0), qb = new THREE.Quaternion();
  up0.decompose(pb, qb, s1);
  H.label = 'pourUp';
  yield* over(0.5, (t) => { const u = ss(t / 0.5); cur = place(pa.clone().lerp(pb, u), qa.clone().slerp(qb, u)); });
  H.label = 'pourCork';
  // 2. the left hand draws the cork (a pinch at the cork's top), then rests
  // on the counter at her side of the glass, the cork in its fingers
  const cork = findPart(bottle, 'cork');
  const corkTop = () => V(0, S.y - 0.004, 0).applyMatrix4(cur);
  const corkGrip = () => ({ M: place(corkTop().addScaledVector(UP.clone().applyQuaternion(qFrom(cur)), -0.006), qFrom(cur)) });
  const restL = () => ({ point: G.clone().addScaledVector(h.fwd, -0.07).addScaledVector(h.right, -0.15).setY(G.y), normal: UP, fwd: h.fwd.clone().addScaledVector(h.right, 0.5) });
  let wl = 0, lk = 0;
  const leftAt = () => {
    const A = gripHand(c.fig, 'L', corkGrip().M, { r: 0.016, h: 0, thumb: 1, dir: h.fwd.clone().negate().addScaledVector(h.right, -0.8).addScaledVector(UP, -0.4) });
    if (lk <= 0) return A;
    const F = restL();
    const B = palmTo(c.fig, 'L', F.point, F.normal, F.fwd);
    const u = ss(lk);
    return { wrist: A.wrist.lerp(B.wrist, u), q: A.q.slerp(B.q, u) };
  };
  H.L = { target: leftAt, pole: pole(c, 'L', 1, 0.6, 0.2), w: () => wl };
  yield* over(0.42, (t) => { wl = ss(t / 0.42); cur = M(0, 0, V(0, 0.02, 0)); });
  // the cork out: it goes with her left hand
  let corkHome = null;
  if (cork) {
    corkHome = { parent: cork.parent, m: cork.matrix.clone() };
    const hand = c.fig.bones.handL;
    hand.updateMatrixWorld(true); cork.updateMatrixWorld(true);
    const rel = new THREE.Matrix4().copy(hand.matrixWorld).invert().multiply(cork.matrixWorld);
    H.after.push({ obj: cork, M: () => { hand.updateMatrixWorld(true); return hand.matrixWorld.clone().multiply(rel); } });
  }
  if (onUncork) onUncork();
  yield* over(0.4, (t) => { lk = ss(t / 0.4); cur = M(0, 0, V(0, 0.02 * (1 - ss(t / 0.4)), 0)); });
  // 3. the tip (a slow start, quicker through the middle, easing as the
  // mouth comes over the glass); the stream starts when the scotch reaches
  // the lip (~ 100 degrees for a full bottle)
  H.label = 'pourTip';
  let streaming = false;
  const tipDur = 0.55;
  yield* over(tipDur, (t) => {
    const deg = POUR.tilt * ss(t / tipDur);
    cur = M(deg);
    if (!streaming && deg >= 98) { streaming = true; if (onStream) onStream(); }
  });
  if (!streaming) { streaming = true; if (onStream) onStream(); }
  // 4. the pour: held, a small rock of the wrist (the glug)
  yield* over(POUR.pour, (t) => { cur = M(POUR.tilt + 2.5 * Math.sin(t * 2 * Math.PI / 0.42), 0); });
  // 5. righted with a small twist of the wrist (the last drop kept off the lip)
  let off = false;
  yield* over(0.55, (t) => {
    const u = ss(t / 0.55);
    const deg = POUR.tilt * (1 - u);
    cur = M(deg, 28 * Math.sin(Math.PI * Math.min(1, t / 0.45)), V(0, 0.015 * u, 0));
    if (!off && deg < 96) { off = true; if (onStreamOff) onStreamOff(); }
  });
  if (!off && onStreamOff) onStreamOff();
  // 6. corked: the left hand brings it back and presses it home
  yield* over(0.4, (t) => { lk = 1 - ss(t / 0.4); cur = M(0, 0, V(0, 0.015, 0)); });
  if (cork && corkHome) {
    H.after = [];
    corkHome.parent.add(cork);
    cork.matrix.copy(corkHome.m); cork.matrix.decompose(cork.position, cork.quaternion, cork.scale);
  }
  if (onCork) onCork();
  // 7. the left hand away; the bottle down on the counter at her right
  H.label = 'pourDown';
  // (on the counter at her right, clear of its back edge: 5 cm in from it)
  const downAt = downAt0 ? downAt0.clone() : G.clone().addScaledVector(h.fwd, 0.03).addScaledVector(h.right, 0.15).setY(G.y);
  const onCounter = place(downAt, q0);
  const hov = M(0, 0, V(0, 0.015, 0));
  const pc = V(0, 0, 0), qc = new THREE.Quaternion();
  hov.decompose(pc, qc, s1);
  const mid = pc.clone().lerp(downAt, 0.5).add(V(0, 0.03, 0));
  const tr = track([[0, { p: pc, q: qc }], [0.3, { p: mid, q: q0 }], [0.55, { p: downAt, q: q0 }]]);
  let down = false;
  yield* over(0.8, (t) => {
    wl = 1 - ss(t / 0.35);
    cur = tr(Math.min(0.55, t));
    if (!down && t >= 0.55) { down = true; if (onDown) onDown(downAt); }
  });
  H.L = null;
  // 8. her hand leaves it
  let wr = 1;
  H.R.w = () => wr;
  H.R.M = () => onCounter;
  yield* over(0.3, (t) => { wr = 1 - ss(t / 0.3); cur = onCounter; });
  H.R = null; H.things = []; H.lean = 0;
  setWorld(bottle, onCounter);
  rebase(bottle);
}

// ---- the slide: her hand to the glass, a push, it runs on and stops at `to` ------------------
export function* slideGlass(ctx, c, glass, to, { onRelease, onStop } = {}) {
  const H = handsOn(c);
  H.label = 'slide';
  const h = heading(c);
  const from = glass.getWorldPosition(V(0, 0, 0));
  const q = glass.getWorldQuaternion(new THREE.Quaternion());
  const dir = to.clone().sub(from).setY(0);
  const D = dir.length();
  dir.normalize();
  // pushed 0.18 m (accelerating), then it runs on, slowing evenly, and stops
  const push = Math.min(0.18, D * 0.45), Tp = 0.34;
  const v0 = 2 * push / Tp, a = v0 * v0 / (2 * Math.max(0.01, D - push)), Tr = v0 / a;
  let x = 0, wr = 0;
  const M = () => place(from.clone().addScaledVector(dir, x), q);
  H.R = { M, grip: { r: 0.0375, h: 0.04, thumb: 1 }, dir: () => dir.clone().negate().addScaledVector(UP, -0.3).addScaledVector(h.right, 0.3), pole: pole(c, 'R', 1, 0.6, 0.3), w: () => wr };
  H.things = [{ obj: glass, M }];
  gaze(c, to);
  H.lean = 0.08;
  c.play('slide', { fade: 0.2 });
  // (the clip's lean: its hand reaches the counter by 0.3, the release at 0.6)
  yield* over(0.3, (t) => { wr = ss(t / 0.3); });
  yield* over(Tp, (t) => { const u = t / Tp; x = push * u * u; });
  if (onRelease) onRelease();
  const ret = over(0.3, (t) => { wr = 1 - ss(t / 0.3); });
  let t = 0;
  let r = ret.next();
  while (t < Tr - 1e-6) {
    t = Math.min(Tr, t + STEP);
    x = push + v0 * t - 0.5 * a * t * t;
    if (!r.done) { r = ret.next(); if (r.done) H.R = null; }
    yield null;
  }
  x = D;
  H.R = null; H.things = [];
  setWorld(glass, place(to, q));
  rebase(glass);
  H.lean = 0;
  gaze(c, null);
  if (onStop) onStop();
}

// the diner's items keep a resting place (the train's rattle sets them back
// to it): a thing that has been moved rests where it is now
export function rebase(o) {
  if (o.userData.base) o.userData.base = { p: o.position.clone(), r: o.rotation.clone() };
}
const qFrom = (M) => { const p = V(0, 0, 0), q = new THREE.Quaternion(), s = V(1, 1, 1); M.decompose(p, q, s); return q; };
// a prop's part by its material ('cork'): the cork is a mesh of its own
function findPart(o, key) {
  let f = null;
  o.traverse((m) => { if (!f && m.isMesh && m.material && (m.material.name || '').includes(key)) f = m; });
  return f;
}

import * as THREE from 'three';
import { accentMaterial } from '../../render/accents.js';
import { allocInkId } from '../../render/layers.js';
import { homburgGeometry, makeCigar, HAT_K } from '../../cast/kinds/cardinal.js';
import { rig } from './rig.js';

// The end of it (B7, scene 9): he falls in the street. His hat leaves him
// as his head meets the road, drops onto its brim, rolls on its edge in a
// curve, wobbles down and settles crown up in the water; the cigar is shaken
// from his mouth and lies beside it, its ember still lit (the one colour in
// the frame), the rain hissing on it. Object first: the hat's path is
// authored (a fall, a roll on the brim along an arc, the settle), and the
// hat on his head is hidden the step the one in the street appears where it
// was.
//   endHat(ctx, hood, { now })   hood null + now: a jump (at rest at once)
// (no default export: not a scene)
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4(), _v = new THREE.Vector3();
const Y = V(0, 1, 0);
const BRIM = 0.19;           // the homburg's brim radius (m, world)

let MATS = null;
function mats() {
  if (MATS) return MATS;
  MATS = {
    felt: new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.85, metalness: 0 }),
    band: new THREE.MeshStandardMaterial({ color: 0x040404, roughness: 0.6 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.7 }),
    ash: new THREE.MeshStandardMaterial({ color: 0x5a5a5a, roughness: 1 }),
    ember: accentMaterial('ember', { gain: 1 }),
  };
  return MATS;
}

function makeHat(k = 1) {
  const M = mats();
  const g = new THREE.Group();
  const m = new THREE.Mesh(homburgGeometry(k), M.felt);
  m.userData.inkId = allocInkId();
  m.userData.inkFigure = true;
  m.userData.noRay = true;
  m.castShadow = true;
  g.add(m);
  return g;
}

export function endHat(ctx, hood, { now = false } = {}) {
  const G = ctx.game, S = ctx.stage, R = rig();
  if (!R) return;
  if (R.hat) { S.scene.remove(R.hat.obj); if (R.hat.cigar) S.scene.remove(R.hat.cigar); }
  const hat = makeHat(HAT_K * (hood ? hood.scale : 1)), cigar = makeCigar({ inkId: allocInkId() });
  S.scene.add(hat, cigar);
  hat.visible = false; cigar.visible = false;
  // where it ends: he falls back (away from my rounds); the hat leaves his
  // head as it meets the road, and rolls on behind him and aside into the
  // water; the cigar lies by his head
  let fwd = V(-0.4, 0, 0.92), side = V(0.92, 0, 0.4), pos = V(-5.6, 0, -9.6);
  if (hood) {
    fwd = V(Math.sin(hood.yaw), 0, Math.cos(hood.yaw));
    side = V(Math.cos(hood.yaw), 0, -Math.sin(hood.yaw));
    pos = hood.pos.clone().setY(0);
  }
  const H = R.hat = { obj: hat, cigar, t: 0, done: false, fwd, side, hood, from: null, spin: 0, rng: ctx.rng.fork ? ctx.rng.fork(77) : ctx.rng };
  H.cig = { from: null, t: 0, yaw: Math.atan2(-side.z, side.x) + 0.6 };
  // (until the release says where exactly: his head a man's length behind him)
  plan(H, S, pos.clone().addScaledVector(fwd, -1.45));
  R.hatReset = () => { S.scene.remove(hat, cigar); R.hat = null; R.hatReset = null; };
  if (now || !hood) { placeRest(H, S); H.done = true; H.cig.done = true; }
  R.ticks.push((dt) => step(ctx, H, dt));
}

// where it lands (the head's place on the road), where it rolls to, where
// the cigar lies
function plan(H, S, headAt) {
  const back = H.fwd.clone().negate();
  const land = headAt.clone().setY(0).addScaledVector(back, 0.25).addScaledVector(H.side, 0.1);
  const rest = land.clone().addScaledVector(back, 0.6).addScaledVector(H.side, 0.62);
  rest.y = S.surfaceY(rest.x, rest.z);
  const cigRest = rest.clone().setY(0).addScaledVector(H.side, -0.36).addScaledVector(H.fwd, 0.2);
  cigRest.y = S.surfaceY(cigRest.x, cigRest.z);
  const mid = land.clone().lerp(rest, 0.5).addScaledVector(back, 0.3);
  Object.assign(H, { land, rest, arc: new THREE.QuadraticBezierCurve3(land.clone().setY(0), mid.setY(0), rest.clone().setY(0)) });
  H.arcLen = H.arc.getLength();
  H.cig.rest = cigRest;
}

// the hat at rest, crown up; the cigar beside it
function placeRest(H, S) {
  H.obj.visible = true;
  H.obj.position.copy(H.rest).setY(H.rest.y + 0.002);
  H.obj.quaternion.setFromAxisAngle(Y, 0.7);
  H.cigar.visible = true;
  H.cigar.position.copy(H.cig.rest).setY(H.cig.rest.y + 0.0105);
  H.cigar.quaternion.setFromAxisAngle(Y, H.cig.yaw);
}

function step(ctx, H, dt) {
  const G = ctx.game, S = ctx.stage, R = rig();
  if (!R || R.hat !== H) return false;
  H.t += dt;
  const hood = H.hood;
  // (the hat leaves his head as it meets the road: ~0.85 s into the fall)
  if (hood && !H.from && H.t >= 0.82) {
    hood.object.updateMatrixWorld(true);
    const b = hood.bones.hat;
    const p = V(0, 0, 0).applyMatrix4(b.matrixWorld);
    const q = b.getWorldQuaternion(new THREE.Quaternion());
    H.from = { p, q, t: H.t };
    plan(H, S, p);
    b.scale.setScalar(1e-4);
    H.obj.visible = true;
    H.obj.position.copy(p); H.obj.quaternion.copy(q);
    // the cigar out of his mouth
    const hp = V(0, 0, 0).applyMatrix4(hood.bones.head.matrixWorld);
    H.cig.from = hp.addScaledVector(H.fwd, 0.14);
    H.cig.t = 0;
    H.cigar.visible = true;
    if (hood.b7cigar) hood.b7cigar.visible = false;
  }
  if (H.from && !H.done) hatMotion(H, dt, S, G);
  if (H.cig.from && !H.cig.done) cigarMotion(H, dt, S, G);
  // the ember breathes; the rain hisses on it
  const e = H.cigar.userData.ember;
  if (e && H.cigar.visible) {
    const k = 0.75 + 0.25 * Math.sin(H.t * 2.3) * Math.sin(H.t * 5.1 + 1);
    e.scale.setScalar(0.9 + 0.2 * k);
    H.hissT = (H.hissT || 0) - dt;
    if (H.hissT <= 0 && H.cig.done) {
      H.hissT = 0.35 + H.rng.next() * 0.8;
      const tip = V(H.cigar.userData.len + 0.013, 0, 0).applyMatrix4(H.cigar.matrixWorld);
      if (G.fx && G.fx.puff) G.fx.puff.spawn({ pos: tip.clone().add(V(0, 0.01, 0)), vel: V(0.02, 0.09, 0), life: 1.1, size: [0.02, 0.02], grow: 0.06, rot: 0, spin: 0.4, col: [0.55, 0.55, 0.55], alpha: 0.25, drag: 0.6, fadeIn: 0.1, fadeOut: 0.5, cell: 0 });
      if (H.rng.next() < 0.6) G.sfx.play('b7_hiss', tip, { k: 0.4 + 0.5 * H.rng.next() }, { ref: 1.2 });
    }
  }
  return true;
}

// fall to the road (0.3 s), a bounce onto its brim, the roll along the arc
// on its edge (1.3 s, slowing), the settle: the tilt goes, crown up (0.7 s)
function hatMotion(H, dt, S, G) {
  const F = H.from, t = H.t - F.t;
  const T1 = 0.3, T2 = T1 + 1.3, T3 = T2 + 0.75;
  const edgeTilt = 1.25;       // on its brim: 72 degrees from lying flat
  if (t < T1) {
    const u = t / T1;
    const p = F.p.clone().lerp(H.land.clone().setY(BRIM * Math.sin(edgeTilt) + 0.01), u);
    p.y = F.p.y + (BRIM * Math.sin(edgeTilt) + 0.01 - F.p.y) * u * u;
    H.obj.position.copy(p);
    const q = edgeQuat(H, 0, edgeTilt);
    H.obj.quaternion.copy(F.q).slerp(q, u * u);
    if (u > 0.95 && !H.thud) { H.thud = true; G.sfx.play('b7_hatDrop', p); if (S.street && S.street.addImpact) S.street.addImpact(S, p.x, p.z, 0.5); }
    return;
  }
  if (t < T2) {
    const u = (t - T1) / (T2 - T1), e = 1 - (1 - u) * (1 - u);
    const along = e * H.arcLen;
    const p = H.arc.getPointAt(Math.min(1, e));
    // the tilt eases a little as it slows; it spins on the brim as it rolls
    const tilt = edgeTilt - 0.25 * u * u;
    const q = edgeQuat(H, along / BRIM, tilt, H.arc.getTangentAt(Math.min(1, e)));
    H.obj.quaternion.copy(q);
    H.obj.position.set(p.x, S.surfaceY(p.x, p.z) + BRIM * Math.sin(tilt) * 0.98, p.z);
    H.rollEnd = { along, tilt, tan: H.arc.getTangentAt(1) };
    if (!H.rain && u > 0.2) { H.rain = true; G.sfx.play('b7_hatRoll', p, { dur: 1.0 }); }
    return;
  }
  const u = Math.min(1, (t - T2) / (T3 - T2));
  // the settle: the tilt falls away while it turns on the spot, faster (a
  // coin's last wobble), and lands crown up
  const E = H.rollEnd || { along: H.arcLen, tilt: edgeTilt, tan: V(1, 0, 0) };
  const tilt = E.tilt * Math.pow(1 - u, 1.6) + 0.02 * Math.sin(u * 18) * (1 - u);
  const wob = u * u * 5;
  const q = edgeQuat(H, E.along / BRIM + wob * 0.2, tilt, E.tan.clone().applyAxisAngle(Y, wob));
  H.obj.quaternion.copy(q);
  const p = H.rest;
  H.obj.position.set(p.x, p.y + BRIM * Math.sin(tilt) * 0.98 + 0.002, p.z);
  if (u >= 1) {
    H.done = true;
    G.sfx.play('b7_hatDrop', p, { k: 0.4 });
    if (S.street && S.street.addImpact) S.street.addImpact(S, p.x, p.z, 0.8);
  }
}

// the hat on its brim: its crown axis tipped `tilt` from the vertical, away
// from the direction it rolls across, spun `spin` about that axis
function edgeQuat(H, spin, tilt, tan = null) {
  const t = (tan || H.fwd).clone().setY(0).normalize();
  const across = V(-t.z, 0, t.x);
  _q.setFromAxisAngle(t, tilt);
  _q2.setFromAxisAngle(Y, spin);
  void across;
  return new THREE.Quaternion().copy(_q).multiply(_q2);
}

// shaken out of his mouth: a short arc, a bounce, a roll, still
function cigarMotion(H, dt, S, G) {
  const C = H.cig;
  C.t += dt;
  const T = 0.45;
  const u = Math.min(1, C.t / T);
  const p = C.from.clone().lerp(C.rest, u);
  const y0 = C.from.y, y1 = C.rest.y + 0.0105;
  p.y = y0 + (y1 - y0) * u + 0.25 * Math.sin(Math.PI * u) * (1 - u);
  H.cigar.position.copy(p);
  H.cigar.quaternion.setFromAxisAngle(Y, C.yaw + (1 - u) * 5).multiply(_q.setFromAxisAngle(V(1, 0, 0), (1 - u) * 9));
  if (u >= 1) { C.done = true; H.cigar.quaternion.setFromAxisAngle(Y, C.yaw); G.sfx.play('b7_hiss', p, { k: 1 }, { ref: 1.5 }); }
}

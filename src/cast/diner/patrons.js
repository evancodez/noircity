import * as THREE from 'three';
import { handsOn, gaze, heading, inHeading, pole, track, over, yawQ, rebase } from './dot.js';
import { gripHand, palmTo, place, setWorld } from './ik.js';

// The room's small things done with the hands on the things (Wave A round
// 2, owner 2): Dot takes a plate from the pass and sets it down before the
// old man, tops up his coffee from the pot; the docker feeds the jukebox; the
// patrons hold what they use (Mack's fork, the old man's paper). Object
// first, as dot.js: each thing's path, the arm solved onto it every step.
//   setupPatrons(ctx, d)                    what each holds, at the evening's start
//   deliverPlate(ctx, dot, d, { name, to }) the plate off the pass to `to`
//   topUpCoffee(ctx, dot, d, { cup, onPour })
//   feedJukebox(ctx, docker, d, { onCoin, onPress })
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const ss = (u) => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };

export function setupPatrons(ctx, d) {
  const cast = ctx.cast;
  // Mack eats with his fork in his hand (it was on the plate while his
  // empty hand went to his mouth)
  const m = cast.get('mack');
  if (m && m.seat) {
    const fork = d.take('fork.mack');
    if (fork) m.hold(fork, 'R');
  }
  // the old man stays behind his paper: his head does not turn away from
  // it (his hands hold its edges; a glance turned his chest off them)
  const o = cast.get('oldman');
  if (o && o._glance) { o._glance.next = 1e9; o._glance.until = 0; }
}

// ---- a plate: from the pass to a place on the counter ---------------------------------------
// She takes it by the rim (the thumb on top, the palm to the plate's middle),
// carries it level before her, sets it down and lets go.
const plateGrip = (c) => ({ r: 0.118, h: 0.014, thumb: 1, gap: 0.006 });
export function* deliverPlate(ctx, c, d, { name, from, to, walkTo = 'diner.serve.9' }) {
  const H = handsOn(c);
  H.label = 'plate';
  const plate = d.place('plate', from, { name });
  plate.updateMatrixWorld(true);
  const p0 = plate.getWorldPosition(V(0, 0, 0)), q0 = plate.getWorldQuaternion(new THREE.Quaternion());
  gaze(c, p0);
  // (the wrist toward her left and near side: the palm then lies on the
  // plate's near rim, the thumb over it, the fingers under it)
  const dirToMe = () => { const h = heading(c); return h.right.clone().negate().addScaledVector(h.fwd, -0.5).addScaledVector(UP, -0.2); };
  let T = 0, w = 0;
  const lift = p0.clone().add(V(0, 0.05, 0));
  void lift;
  const tr = track([[0, { p: p0, q: q0 }], [0.35, { p: p0, q: q0 }], [0.6, { p: lift, q: q0 }]]);
  H.things = [{ obj: plate, M: () => tr(T) }];
  H.R = { M: () => tr(T), grip: plateGrip(c), dir: dirToMe, pole: pole(c, 'R', 1, 0.8, 0.2), w: () => w };
  yield* over(0.62, (t) => { T = t; w = ss(t / 0.35); });
  // carried level before her (her heading frame), blended in as she turns
  const from0 = tr(0.62);
  let k = 0;
  const carry = () => place(inHeading(c, 0.34, 1.02, 0.12), yawQ(c.fig.yaw));
  const M = () => { const A = decomp(from0), B = decomp(carry()); const u = ss(k); return place(A.p.lerp(B.p, u), A.q.slerp(B.q, u)); };
  H.things = [{ obj: plate, M }];
  H.R.M = M; H.R.w = 1;
  gaze(c, null);
  // (she stands up against the counter's back edge, square to it, to reach across it)
  const sp = c.where(walkTo);
  const walk = c.walkTo({ x: to.x - 0.46 * Math.sign(to.x - sp.x || 1), z: to.z - 0.1 }, { speed: 1.2 });
  H.label = 'plateWalk';
  for (let n = 0; ; n++) { k = Math.min(1, n / 60 / 0.5); const r = walk.next(); if (r.done) break; yield r.value; }
  while (k < 1) { k = Math.min(1, k + 1 / 30); yield null; }
  c.face(sp.yaw ?? c.fig.yaw);
  c.setState('idle', 0.2);
  H.label = 'plateDown';
  // down on the counter before him, the hand off it
  gaze(c, to);
  const A = decomp(carry());
  const qTo = yawQ(c.fig.yaw);
  const tr2 = track([[0, { p: A.p, q: A.q }], [0.35, { p: to.clone().add(V(0, 0.03, 0)), q: qTo }], [0.55, { p: to, q: qTo }]]);
  T = 0;
  H.things = [{ obj: plate, M: () => tr2(T) }];
  H.R.M = () => tr2(T);
  yield* over(0.85, (t) => { T = Math.min(0.55, t); H.R.w = t < 0.55 ? 1 : 1 - ss((t - 0.55) / 0.3); });
  H.R = null; H.things = [];
  setWorld(plate, place(to, qTo));
  rebase(plate);
  gaze(c, null);
  return plate;
}

// ---- the coffee pot: from the urns to the old man's cup and back ----------------------------
// The pot by its handle (a fist round it, the thumb on top); carried; over
// the cup its spout goes down (it tips 50 degrees away from the handle) for a
// second's pour; back upright; back on the warmer.
export function* topUpCoffee(ctx, c, d, { cup, onPour, onStop, stand = 'diner.serve.9' }) {
  const H = handsOn(c);
  H.label = 'coffee';
  const pot = d.items.get('coffeePot');
  const cupO = d.items.get(cup);
  if (!pot) return;
  pot.updateMatrixWorld(true);
  const home = pot.getWorldPosition(V(0, 0, 0)), qh = pot.getWorldQuaternion(new THREE.Quaternion());
  // (to the warmer: before the pot, a short reach from it)
  const atPot = { x: home.x + 0.42, z: home.z - 0.08 };
  yield* c.walkTo(atPot, { speed: 1.25 });
  c.face(-Math.PI / 2);
  c.setState('idle', 0.2);
  gaze(c, home);
  // the handle: a short upright bar on the pot's +x at 0.094, grip 0.15 up
  const handleM = (P) => P.clone().multiply(new THREE.Matrix4().makeTranslation(0.094, 0, 0));
  const dirOut = (P) => () => V(1, 0, 0).transformDirection(P()).addScaledVector(UP, -0.2);
  let T = 0, w = 0;
  const lift = home.clone().add(V(0, 0.04, 0));
  // (the handle turned to her right hand as she lifts it: a quarter turn)
  const qTurn = qh.clone().multiply(new THREE.Quaternion().setFromAxisAngle(UP, 0));
  const tr = track([[0, { p: home, q: qh }], [0.35, { p: home, q: qh }], [0.6, { p: lift, q: qTurn }]]);
  const P = () => tr(T);
  H.things = [{ obj: pot, M: P }];
  H.R = { M: () => handleM(P()), grip: { r: 0.008, h: 0.15, thumb: 1, gap: 0.004 }, dir: dirOut(P), pole: pole(c, 'R', 1, 0.8, 0.2), w: () => w };
  yield* over(0.62, (t) => { T = t; w = ss(t / 0.35); });
  // carried before her right side, the handle to her right
  const from0 = tr(0.62);
  let k = 0;
  // (the handle to her right as she carries it)
  const carry = () => place(inHeading(c, 0.28, 0.98, 0.16), yawQ(c.fig.yaw + Math.PI));
  const M = () => { const A = decomp(from0), B = decomp(carry()); const u = ss(k); return place(A.p.lerp(B.p, u), A.q.slerp(B.q, u)); };
  H.things = [{ obj: pot, M }];
  H.R.M = () => handleM(M()); H.R.dir = dirOut(M); H.R.w = 1;
  gaze(c, null);
  // (up against the counter's back edge, square to it, across from his cup)
  const cp0 = cupO ? cupO.getWorldPosition(V(0, 0, 0)) : null;
  const sp = c.where(stand);
  const walk = c.walkTo(cp0 ? { x: cp0.x - 0.56 * Math.sign(cp0.x - sp.x || 1), z: cp0.z - 0.12 } : stand, { speed: 1.2 });
  H.label = 'coffeeWalk';
  for (let n = 0; ; n++) { k = Math.min(1, n / 60 / 0.5); const r = walk.next(); if (r.done) break; yield r.value; }
  while (k < 1) { k = Math.min(1, k + 1 / 30); yield null; }
  c.face(sp.yaw ?? c.fig.yaw);
  c.setState('idle', 0.2);
  H.label = 'coffeePour';
  // the pour: the spout over the cup, tipped 50 degrees
  if (cupO) {
    const cp = cupO.getWorldPosition(V(0, 0, 0));
    gaze(c, cp);
    const h = heading(c);
    // (the handle toward her, the spout over the cup)
    const qUp = yawQ(c.fig.yaw + Math.PI / 2);
    const spoutAxis = V(0, 0, 1);   // (the tip turns about the pot's z: the spout, at -x, goes down)
    const tipped = (deg) => qUp.clone().multiply(new THREE.Quaternion().setFromAxisAngle(spoutAxis, deg * Math.PI / 180));
    // (the spout 0.18 up and 0.05 out on the pot's -x; placed over the cup's middle, 7 cm above its rim)
    const spoutAt = (deg) => V(-0.05, 0.18, 0).applyQuaternion(tipped(deg));
    const base = (deg) => cp.clone().add(V(0, 0.07 + 0.07, 0)).sub(spoutAt(deg));
    const A = decomp(carry());
    const tr2 = track([[0, { p: A.p, q: A.q }], [0.45, { p: base(0).add(V(0, 0.03, 0)).addScaledVector(h.fwd, -0.03), q: tipped(0) }], [0.8, { p: base(50), q: tipped(50) }], [1.9, { p: base(52), q: tipped(52) }], [2.3, { p: base(0).add(V(0, 0.03, 0)), q: tipped(0) }]]);
    T = 0;
    H.things = [{ obj: pot, M: () => tr2(T) }];
    H.R.M = () => handleM(tr2(T)); H.R.dir = dirOut(() => tr2(T));
    let poured = false, stopped = false;
    yield* over(2.3, (t) => {
      T = t;
      if (!poured && t >= 0.8) { poured = true; if (onPour) onPour(pot, cupO); }
      if (!stopped && t >= 1.95) { stopped = true; if (onStop) onStop(); }
    });
    if (!stopped && onStop) onStop();
    k = 0;
    const back0 = tr2(2.3);
    H.things = [{ obj: pot, M: () => { const A2 = decomp(back0), B = decomp(carry()); const u = ss(k); return place(A2.p.lerp(B.p, u), A2.q.slerp(B.q, u)); } }];
    H.R.M = () => handleM(H.things[0].M()); H.R.dir = dirOut(H.things[0].M);
    gaze(c, null);
    yield* over(0.4, (t) => { k = t / 0.4; });
  }
  // back to the warmer
  H.label = 'coffeeBack';
  const walk2 = c.walkTo(atPot, { speed: 1.25 });
  for (let r = walk2.next(); !r.done; r = walk2.next()) yield r.value;
  c.face(-Math.PI / 2);
  c.setState('idle', 0.2);
  const A = decomp(carry());
  const tr3 = track([[0, { p: A.p, q: A.q }], [0.4, { p: home.clone().add(V(0, 0.03, 0)), q: qh }], [0.6, { p: home, q: qh }]]);
  T = 0;
  H.things = [{ obj: pot, M: () => tr3(T) }];
  H.R.M = () => handleM(tr3(T)); H.R.dir = dirOut(() => tr3(T));
  yield* over(0.9, (t) => { T = Math.min(0.6, t); H.R.w = t < 0.6 ? 1 : 1 - ss((t - 0.6) / 0.3); });
  H.R = null; H.things = [];
  setWorld(pot, place(home, qh));
  rebase(pot);
}

// ---- the jukebox: a coin in the slot, a button pressed -----------------------------------------
// His right hand's fingers at the coin slot (the coin goes in), then his
// fingertips on a selector button; he lets go.
export function* feedJukebox(ctx, c, d, { onCoin, onPress } = {}) {
  const H = handsOn(c);
  H.label = 'jukebox';
  const jb = d.jukebox && d.jukebox.object;
  const box = jb ? new THREE.Box3().setFromObject(jb) : null;
  const h = heading(c);
  // the front of the machine, where he faces it: the slot at the right of
  // its middle, 1.05 m up; the buttons a row under it, 0.95 up
  const front = box ? Math.max(box.min.z, Math.min(box.max.z, c.fig.pos.z)) : c.fig.pos.z;
  void front;
  const face = c.fig.pos.clone().addScaledVector(h.fwd, 0.29);
  const floor = c.fig.pos.y;
  const slot = face.clone().addScaledVector(h.right, 0.07).setY(floor + 1.12);
  const btn = face.clone().addScaledVector(h.right, -0.02).setY(floor + 1.0);
  let w = 0, at = slot;
  H.R = { flat: () => ({ point: at, normal: h.fwd.clone().negate(), fwd: UP.clone().addScaledVector(h.fwd, 0.3) }), pole: pole(c, 'R', 1, 0.9, 0.1), w: () => w };
  gaze(c, slot);
  yield* over(0.45, (t) => { w = ss(t / 0.45); });
  if (onCoin) onCoin(slot);
  yield* over(0.5, () => {});
  gaze(c, btn);
  const s0 = slot.clone();
  yield* over(0.35, (t) => { at = s0.clone().lerp(btn, ss(t / 0.35)); });
  if (onPress) onPress(btn);
  yield* over(0.25, (t) => { at = btn.clone().addScaledVector(h.fwd, 0.01 * Math.sin(Math.PI * t / 0.25)); });
  yield* over(0.4, (t) => { w = 1 - ss(t / 0.4); });
  H.R = null;
  gaze(c, null);
}

// ---- the cook: the bell on the pass -----------------------------------------------------------
// He steps along behind the pass to the bell, his palm comes down flat on
// its plunger (it rings as the palm lands), up again; back to his place.
export function* ringBell(ctx, c, d, { onRing } = {}) {
  const H = handsOn(c);
  H.label = 'bell';
  const bell = d.bell && d.bell.mesh;
  if (!bell) return;
  const home = { x: c.fig.pos.x, z: c.fig.pos.z }, yaw0 = c.fig.yaw;
  bell.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(bell);
  const top = V((box.min.x + box.max.x) / 2, box.max.y + 0.004, (box.min.z + box.max.z) / 2);
  // (behind the bell, a forearm's reach back from it)
  const h0 = heading(c);
  const stand = top.clone().addScaledVector(h0.fwd, -0.36).addScaledVector(h0.right, -0.12);
  yield* c.walkTo({ x: stand.x, z: stand.z }, { speed: 1.0 });
  c.face(yaw0);
  c.setState('idle', 0.15);
  gaze(c, top);
  const h = heading(c);
  let w = 0, dy = 0.06;
  H.R = { flat: () => ({ point: top.clone().add(V(0, dy, 0)), normal: UP, fwd: h.fwd.clone() }), pole: pole(c, 'R', 1, 0.6, 0.3), w: () => w };
  yield* over(0.45, (t) => { w = ss(t / 0.45); });
  yield* over(0.12, (t) => { dy = 0.06 * (1 - t / 0.12); });
  if (onRing) onRing();
  yield* over(0.25, (t) => { dy = 0.04 * ss(t / 0.25); });
  yield* over(0.35, (t) => { w = 1 - ss(t / 0.35); });
  H.R = null;
  gaze(c, null);
  const walk = c.walkTo(home, { speed: 1.0 });
  for (let r = walk.next(); !r.done; r = walk.next()) yield r.value;
  c.face(yaw0);
}

function decomp(M) { const p = V(0, 0, 0), q = new THREE.Quaternion(), s = V(1, 1, 1); M.decompose(p, q, s); return { p, q }; }
void gripHand; void palmTo;

import * as THREE from 'three';
import { until } from '../../game/script.js';
import { DINER, stoolZ, V } from '../_diner_room.js';
import { handsOn } from '../../cast/diner/dot.js';
import { REACH } from '../../player/clips/fight.js';
import { palm } from '../../player/handPoses.js';

// [B8] How the fight starts (docs/story/briefs/B8_FIGHT.md §1). After his
// line, one continuous eased move of about four seconds, no cut: he stands
// (his stool goes over) and comes down the counter; his left hand lands on
// my right shoulder (the hand and the forearm at the edge of the frame) and
// pulls me round on the stool; I come up off it, my left hand takes the
// stool beside me by its seat and sends it skidding into the counter (it
// goes over and lies where it stops: a thing in the room now); my fists come
// up, he gives ground and squares up. The look stays mine, a little, all
// the way (controller mode 'brawlIn'). Object first: his palm is solved onto
// my shoulder's place every step, my hand onto the stool's seat.
//   startSetup(ctx)          a cold entry: the diner as his line leaves it
//   *startFight(ctx)         the move; returns with him squared up, me on my feet
//   layStool(stage)          the swept stool where it lies (a retry, a later beat)
// The numbers are the diner's site plan (stages/block/site.js).
const SEAT = DINER.playerStool, HIS = DINER.brawlerStool, SWEPT = DINER.playerStool;
const SEAT_YAW = Math.PI / 2;            // the stool's own heading: square to the counter
const EYE_SEAT = () => V(DINER.stools.x - 0.12, DINER.seatedEyeY, stoolZ(SEAT));
// where he stands to lay his hand on me; where I stand up to; where he
// squares up (the lesson's first exchange starts from here)
export const START = {
  via: { x: -13.02, z: 2.55 },
  hand: { x: -13.28, z: 3.5 },
  // (I come up and back a step, out of his reach: the stool I sat on is
  // then between us, at my left hand)
  me: { x: -13.45, z: 4.8 },
  him: { x: -13.0, z: 3.2 },
  // the stool's run: from its place toward the counter's foot, where it hits
  // and goes over along the counter
  swept: { dir: [-0.45, -0.89], stopX: DINER.counter.frontX + 0.23, fall: [0.15, 0, -1] },
  // timing (s from the start of the move)
  T: { walk: 1.3, pull: 0.36, rise: 0.5, up: 0.32, swing: 1.0 },
};
const ss = (u) => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };
const lerp = (a, b, k) => a + (b - a) * k;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const _m = new THREE.Matrix4(), _v = new THREE.Vector3(), _w = new THREE.Vector3();

// the view at the start: framed on him as the diner's glance left it (him a
// little right of the middle, his head a little above it)
function lookAtHim(eye, head, frame = 0.3) {
  return { yaw: Math.atan2(-(head.x - eye.x), -(head.z - eye.z)) + frame, pitch: Math.atan2(head.y - eye.y, Math.hypot(head.x - eye.x, head.z - eye.z)) };
}

// a cold entry (?scene=fight&beat=start): the room of the diner's last beat,
// his line just said - he on his stool turned to me, I on mine turned to him
export function startSetup(ctx, dinerRoom, seatPlayer) {
  const { cast, controller: C } = ctx;
  dinerRoom(ctx);
  seatPlayer(ctx);
  const d = ctx.stage.part('diner');
  const g = d.place('tumbler', V(DINER.counter.frontX - 0.17, DINER.counter.topY, stoolZ(SEAT) + 0.15), { name: 'glass' });
  g.userData.setFill(0);
  const m = cast.get('mack');
  const h = m.play('notice', { hold: true, fade: 0 });
  h.t = h.duration;
  for (let i = 0; i < 20; i++) m.fig.update(1 / 60, 0);
  const head = m.bones.head.getWorldPosition(V(0, 0, 0)); head.y -= 0.12;
  const L = lookAtHim(EYE_SEAT(), head);
  C.yaw = L.yaw; C.pitch = L.pitch;
  m.lookAt(EYE_SEAT());
}

// the swept stool lying where the move leaves it (a retry, a later beat's
// setup: it is a thing in the room now)
export function layStool(stage, { now = false } = {}) {
  const st = stage.part('diner').stool(SWEPT);
  if (!st || st.handle.toppled) return;
  const S = START.swept, x0 = DINER.stools.x, z0 = stoolZ(SWEPT);
  const k = (S.stopX - x0) / S.dir[0];
  st.object.position.set(S.stopX, DINER.floorY, z0 + S.dir[1] * k);
  st.object.updateMatrixWorld(true);
  moveCollider(st, st.object.position);
  st.topple(V(...S.fall));
  if (now) for (let i = 0; i < 90; i++) stage.breakables.update(1 / 60);
}
function moveCollider(st, p) {
  const cl = st.handle.collider;
  if (!cl) return;
  if (cl.x0 === undefined) { cl.x0 = cl.x; cl.z0 = cl.z; }
  cl.x = p.x; cl.z = p.z;
}

export function* startFight(ctx) {
  const { game: G, stage, cast, hands: H, controller: C } = ctx;
  const d = stage.part('diner');
  const m = cast.get('mack');
  const T = START.T;
  const snd = (name, pos = null, p = {}) => G.sfx.play(name, pos, p);
  const head = () => { const p = m.bones.head.getWorldPosition(_v); p.y -= 0.12; return p; };
  // ---- my eye: carried by the move, the look still mine a little -------------------------
  const e0 = C.eyePose();
  const seatEye = V(e0.x, e0.y, e0.z);
  const S = { phase: 'watch', t: 0, yaw: e0.yaw, pitch: e0.pitch, body: SEAT_YAW, frame: wrap(e0.yaw - lookAtHim(seatEye, head(), 0).yaw), eye: seatEye.clone(), yank: 0 };
  // (while he comes the look lags: he walks out of the right of the frame,
  // behind my shoulder, and his hand comes in at its edge; the pull brings
  // the view round to him)
  const yawMin = e0.yaw - 0.3;
  S.frame = Math.max(-0.45, Math.min(0.45, S.frame));
  C.setMode('brawlIn', {
    look: [0.3, 0.18],
    bodyYaw: () => S.body,
    track: (t, dt = 1 / 60) => {
      const hp = head();
      // (the view follows him as an eye does: eased, never snapping)
      const want = lookAtHim(S.eye, hp, S.frame);
      if (S.phase === 'watch' && wrap(want.yaw - yawMin) < 0) want.yaw = yawMin;
      const k = 1 - Math.exp(-dt * (S.phase === 'pull' ? 11 : 6));
      S.yaw += wrap(want.yaw - S.yaw) * k;
      S.pitch += (Math.max(-0.5, Math.min(0.4, want.pitch)) - S.pitch) * k;
      return { x: S.eye.x, y: S.eye.y, z: S.eye.z, yaw: S.yaw, pitch: S.pitch };
    },
  });
  // ---- he stands: the stool goes over (the room starts to clear) ---------------------------
  let fell = false;
  if (m.seat) {
    const rise = m.play('rise', { onMark: { stool: () => {
      fell = true;
      d.stool(HIS).topple(V(1, 0, -0.3));
      snd('stoolFall', V(DINER.stools.x, 0.5, stoolZ(HIS)));
      if (ctx.rng.chance(0.5)) { d.cupsRattle(0.8, 0.6); snd('needleScratch', V(DINER.jukebox.x, DINER.floorY + 1.0, DINER.zMin + 0.6)); G.music.stop(0.15); ctx.flags.scratch = true; }
    } } });
    ctx.flags.onFall && ctx.flags.onFall();
    yield until(() => rise.done || rise.t >= 1.3);
    m.stand();
  }
  if (!fell && !d.stool(HIS).handle.toppled) d.stool(HIS).topple(V(1, 0, -0.3));
  m.lookAt(G.eye);
  // ---- he comes down the counter to me ------------------------------------------------------
  S.frame = S.frame * 0.6;
  const walk = (function* () { yield* m.walkTo(START.via, { speed: 1.75, stop: 0.2 }); yield* m.walkTo(START.hand, { speed: 1.5 }); })();
  const hands = handsOn(m);
  // my right shoulder, where his palm lands: on top of it, a little behind
  // the eye, as the body sits (it turns with the stool)
  const shoulder = () => {
    const b = S.body, ex = S.eye.x, ez = S.eye.z;
    const fx = -Math.sin(b), fz = -Math.cos(b), rx = Math.cos(b), rz = -Math.sin(b);
    return _w.set(ex + rx * 0.19 - fx * 0.04, S.eye.y - 0.2, ez + rz * 0.19 - fz * 0.04);
  };
  let wHand = 0, drop = 0;
  hands.L = {
    flat: () => {
      const p = shoulder().clone();
      // (the fingers over the shoulder toward my back, from where he stands)
      const fwd = V(p.x - m.pos.x, 0, p.z - m.pos.z).normalize();
      // (letting go: the hand slides off the shoulder, down and back to his
      // side - never up across my face)
      if (drop > 0) { const e = ss(drop); p.y -= 0.55 * e; p.addScaledVector(fwd, -0.3 * e); }
      return { point: p, normal: V(0, 1, 0), fwd };
    },
    pole: () => V(m.pos.x + Math.cos(m.fig.yaw) * 0.8, 0.9, m.pos.z - Math.sin(m.fig.yaw) * 0.8),
    w: () => wHand,
  };
  let t = 0, landed = false, arrived = false;
  for (;;) {
    t += 1 / 60;
    if (!arrived) { const r = walk.next(); if (r.done) arrived = true; }
    const dd = Math.hypot(m.pos.x - START.hand.x, m.pos.z - START.hand.z);
    // (turning square to me as he comes the last step)
    if (dd < 0.6) { const want = Math.atan2(S.eye.x - m.pos.x, S.eye.z - m.pos.z); m.fig.yaw += wrap(want - m.fig.yaw) * 0.18; }
    // (the hand comes up in the last half metre and lands)
    if (dd < 0.45 || arrived) wHand = Math.min(1, wHand + 1 / 60 / 0.32);
    if (wHand >= 1 && !landed) { landed = true; ctx.flags.handOn = G.time; snd('clothRustle', shoulder().clone()); snd('bodyThud', shoulder().clone(), { k: 0.25 }); C.shake(0.12, 0); break; }
    if (t > 4) break;
    yield null;
  }
  // ---- the pull: round on the stool to face him ---------------------------------------------
  // (the hands off the counter out of sight: the body turns under them)
  H.hold(null, 'R'); H.hold(null, 'L');
  H.equip('empty');
  S.phase = 'pull';
  const b0 = S.body, face = () => Math.atan2(-(m.pos.x - S.eye.x), -(m.pos.z - S.eye.z));
  const st4 = d.stool(SEAT);
  if (st4 && st4.spin) st4.spin(-0.5);
  snd('stoolSqueak', V(DINER.stools.x, 0.9, stoolZ(SEAT)), { k: 0.8 });
  for (let u = 0; u < T.pull; u += 1 / 60) {
    const k = ss(u / T.pull);
    S.body = b0 + wrap(face() - b0) * k;
    S.frame = lerp(S.frame, 0, 0.2);
    // (yanked toward him a little)
    const pull = Math.sin(Math.PI * Math.min(1, u / T.pull)) * 0.05;
    const dx = m.pos.x - seatEye.x, dz = m.pos.z - seatEye.z, dl = Math.hypot(dx, dz) || 1;
    S.eye.set(seatEye.x + dx / dl * pull, seatEye.y, seatEye.z + dz / dl * pull);
    yield null;
  }
  // ---- I come up off the stool: my hand takes the stool beside me and sends
  // it into the counter; he lets go and gives ground; the fists come up ------------------------
  S.phase = 'rise';
  const sw = d.stool(SWEPT);
  const stoolAt = sw.object.position.clone();
  const run = { v: 0, x: 0, going: false, done: false, stopped: false, t: 0 };
  const dir = V(START.swept.dir[0], 0, START.swept.dir[1]).normalize();
  // my left hand on its seat's near rim, the palm down, the fingers across it
  REACH.L = () => {
    const cam = G.camera;
    const seat = sw.object.position.clone().setY(DINER.stools.seatY);
    const toMe = V(S.eye.x - seat.x, 0, S.eye.z - seat.z).normalize();
    const grip = seat.clone().addScaledVector(toMe, 0.1);
    _m.copy(cam.matrixWorld).invert();
    const at = grip.clone().applyMatrix4(_m);
    const n = V(0, -1, 0).transformDirection(_m);
    const fwd = toMe.clone().negate().transformDirection(_m);
    const P = palm('cam', at.toArray(), n.toArray(), fwd.toArray(), GRIP);
    // (the elbow out to the left and back, above the hand)
    P.e = [P.p[0] - 0.12, P.p[1] + 0.2, P.p[2] + 0.22];
    return P;
  };
  H.equip('fists');
  const rise = H.play('b8_rise', { onMark: {
    grab: () => { run.going = true; snd('scuff', stoolAt, { k: 0.8 }); },
    release: () => { REACH.L = null; },
  } });
  const E0 = S.eye.clone(), E1 = V(START.me.x, DINER.brawlEyeY, START.me.z);
  const m0 = { x: m.pos.x, z: m.pos.z };
  m.setState('br_stepB', 0.15);
  let stepping = true;
  for (let u = 0; u < T.swing; u += 1 / 60) {
    // the eye: up first, then out into the aisle (a man getting off a stool)
    const kx = ss(u / T.rise), ky = ss(Math.min(1, u / T.up));
    S.eye.set(lerp(E0.x, E1.x, kx), lerp(E0.y, E1.y, ky), lerp(E0.z, E1.z, kx));
    S.body = face();
    // his hand lets go as I come up; he gives ground a step and a half
    drop = Math.min(1, drop + 1 / 60 / 0.24);
    if (drop > 0.6) wHand = Math.max(0, wHand - 1 / 60 / 0.2);
    const kb = ss((u - 0.05) / 0.7), kb1 = ss((u - 0.05 + 1 / 60) / 0.7);
    m.fig.pos.x = lerp(m0.x, START.him.x, kb); m.fig.pos.z = lerp(m0.z, START.him.z, kb);
    // (his feet: the guard's shuffle back at the speed he goes, then the guard)
    const sp = Math.hypot(START.him.x - m0.x, START.him.z - m0.z) * (kb1 - kb) * 60;
    if (stepping) { m.fig.anim.setTimeScale(Math.max(0.35, Math.min(2, sp))); if (u > 0.2 && sp < 0.15) { stepping = false; m.fig.anim.setTimeScale(1); m.setState('br_guard', 0.2); } }
    m.fig.yaw += wrap(Math.atan2(S.eye.x - m.pos.x, S.eye.z - m.pos.z) - m.fig.yaw) * 0.2;
    // the stool: pushed while the hand is on it, then on its own, sliding
    // to the counter's foot (a bang), over along the counter
    if (run.going && !run.done) {
      run.t += 1 / 60;
      if (REACH.L) run.v = Math.min(3.0, run.v + 1 / 60 * 22);
      else run.v = Math.max(0.6, run.v - 1 / 60 * 3.5);
      const p = sw.object.position;
      const nx = p.x + dir.x * run.v / 60, nz = p.z + dir.z * run.v / 60;
      if (nx <= START.swept.stopX) {
        run.done = true;
        p.set(START.swept.stopX, p.y, p.z + (START.swept.stopX - p.x) * dir.z / dir.x);
        sw.object.rotation.z = 0;
        sw.object.updateMatrixWorld(true);
        moveCollider(sw, p);
        sw.topple(V(...START.swept.fall));
        snd('counter', p.clone().setY(0.6), { k: 0.5 });
      } else {
        p.x = nx; p.z = nz;
        // (its base drags: it leans back from the push)
        sw.object.rotation.set(-dir.z * 0.12 * Math.min(1, run.v), 0, dir.x * 0.12 * Math.min(1, run.v));
        sw.object.updateMatrixWorld(true);
        moveCollider(sw, p);
      }
    }
    yield null;
  }
  REACH.L = null;
  hands.L = null;
  if (!run.done) layStool(stage);
  void rise;
  return { eye: S.eye.clone(), yaw: S.yaw };
}
// (the hand on the seat's rim: the fingers over it, half closed)
const GRIP = { i: [0.35, 0.5, 0.3, 0], m: [0.38, 0.52, 0.32, 0], r: [0.42, 0.55, 0.34, 0], l: [0.46, 0.58, 0.36, 0], t: [0.5, 0.3, 0.2, 0.35, 0.3] };

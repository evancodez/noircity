import * as THREE from 'three';
import { RUNHANDS } from '../clips/run.js';

// The chase's run (lane B4; rebuilt by lane C6 for wave C): the body is the
// player's - nothing goes over anything by itself.
//   W runs (up to `speed`, 6.8 m/s, in about a second); let go and I slow to
//   a stop; S checks and steps back; A / D step aside; the mouse steers.
//   SPACE goes over what is in the way, C (or Ctrl) goes under it, both
//   timed: pressed in the last moments before it (the time to reach it within
//   [TMIN, TMAX]) I go clean and keep my speed; a little late, a scramble
//   (half a second lost); too early, a hop or a slide on open ground that
//   spends itself before the thing; not at all, I hit it - a low thing trips
//   me over it (a second lost), a tall one stops me dead (the hands on it)
//   and I must climb it from standing (SPACE), or crawl (C), or push its
//   door (SPACE / E).
//   The things are the stage's (stages/backlot/parts/things.js): opts.things.
//   The jump (the roofs' light well): SPACE at the edge, clean, or caught by
//   the hands at the far parapet and hauled up (never a fall). The shed roof
//   (slope): C slides down it, else a slither. An edge with nothing to catch
//   is a drop: the knees take it.
//   Levels: feet over 1.2 m walk the stage's roofColliders (the roofs, the
//   stair) instead of its colliders (the streets'), so the row's buildings
//   below do not hold a man out of their roofs.
// opts: { game, things, speed, side, onEvent(name, data) }
// ctl.run: { act, v, feet, level, move, blocked, last: the last thing met and how }
// Events: vault, trip, hit, scramble, climb, slide, duck, crawl, bash, bruise,
// push, rattle, jump, catch, haul, slideDown, slither, fall, land, rise, hop,
// step; and meet { T, how: clean | late | early | hit } once a thing a pass.
export const TIMING = { TMIN: 0.05, TMAX: 0.42, BUF: 0.15 };
const _v = new THREE.Vector3(), _n = new THREE.Vector3();
const sm = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
export const R0 = 0.36;

export default {
  name: 'run',
  enter(ctl, opts = {}) {
    ctl.run = {
      game: opts.game || null, things: opts.things || null, speed: opts.speed ?? 6.8, side: opts.side ?? 2.6,
      onEvent: opts.onEvent || (() => {}), t: 0, v: opts.v ?? Math.hypot(ctl.vel.x, ctl.vel.z), vs: 0,
      fov0: opts.fov0 ?? ctl.camera.fov, lens: 0, off: { yaw: 0, pitch: 0 }, jolt: null,
      keys: { Space: { held: false, t: 9 }, KeyC: { held: false, t: 9 }, ControlLeft: { held: false, t: 9 }, KeyE: { held: false, t: 9 } },
      move: null, blocked: null, feet: ctl.groundY, level: 'ground', low: 0, lowWant: 0, met: new Map(), last: null, slopeArm: 0,
      speedCap: null,
      flinch(yaw = 0.12, pitch = 0.05) { this.jolt = { t: 0, yaw, pitch, dur: 0.35 }; },
    };
    RUNHANDS.cam = ctl.camera;
    RUNHANDS.set('pump');
    RUNHANDS.w = 1;
  },
  step(ctl, dt) {
    const R = ctl.run;
    if (!R) return;
    ctl.yaw -= R.off.yaw; ctl.pitch -= R.off.pitch;
    R.off.yaw = 0; R.off.pitch = 0;
    const G = R.game;
    const held = (c) => ctl.keys.has(c) || (G && G.vin && G.vin.held.has(c));
    let f = (held('KeyW') || held('ArrowUp') ? 1 : 0) - (held('KeyS') || held('ArrowDown') ? 1 : 0);
    let s = (held('KeyD') || held('ArrowRight') ? 1 : 0) - (held('KeyA') || held('ArrowLeft') ? 1 : 0);
    if (ctl.auto) { f = ctl.auto.f || 0; s = ctl.auto.s || 0; }
    if (ctl.frozen) { f = 0; s = 0; }
    // the keys' presses, remembered BUF seconds (C and Ctrl are one)
    // (a press is its edge as the input saw it, not only the key held at this
    // step: a tap shorter than a step - or one under a teach card's crawl,
    // when a step is long in real time - is never lost)
    const edge = (code) => !!(G && G.pressed && G.pressed(code));
    // ([C6 3rd] a press made while a move has the body - a hit's stop, a hop,
    // a landing, a trip - is kept for the move's end: a SPACE pressed as I hit
    // the fence climbs it when the stop is over, a C pressed in a hop goes
    // under what the hop meets. Only the last press, and only one made in the
    // move's last 0.6 s: the press was meant for what comes next.)
    const busy = !!R.move;
    for (const code of ['Space', 'KeyC', 'ControlLeft', 'KeyE']) {
      const K = R.keys[code];
      const h = !ctl.frozen && (held(code) || (code === 'Space' && !!(ctl.auto && ctl.auto.jump)) || (code === 'KeyC' && !!(ctl.auto && ctl.auto.slide)) || (code === 'ControlLeft' && held('ControlRight')));
      const e = !ctl.frozen && (edge(code) || (code === 'ControlLeft' && edge('ControlRight')));
      const pressedNow = (h && !K.held) || (e && K.t > dt * 0.5);
      if (pressedNow) { K.t = 0; if (busy) K.qt = R.t; } else K.t += dt;
      K.held = h;
      if (!busy && K.qt != null) { if (R.t - K.qt < 0.6 && K.t >= TIMING.BUF) K.t = 0; K.qt = null; }
    }
    const io = {
      press: (k) => (k === 'C' ? Math.min(R.keys.KeyC.t, R.keys.ControlLeft.t) : R.keys[k].t),
      spend: (k) => { if (k === 'C') { R.keys.KeyC.t = 9; R.keys.ControlLeft.t = 9; } else R.keys[k].t = 9; },
    };
    R.t += dt;
    const W = ctl.world;
    R.level = R.feet > 1.2 ? 'roof' : 'ground';
    const cols = R.level === 'roof' && W.roofColliders ? W.roofColliders : W.colliders;
    R.cols = cols;

    if (R.move) stepMove(ctl, R, dt, cols);
    else {
      // ---- the run: forward along the view, aside with A / D --------------------------
      const slope = stairSlope(ctl, W);
      let top = R.speed;
      if (slope > 0.2) top = Math.min(top, 4.3);
      else if (slope < -0.2) top = Math.min(top, 5.2);
      if (R.speedCap != null) top = Math.min(top, R.speedCap);
      // (a hard turn at a run costs speed: the body's momentum carried round)
      const turn = Math.abs(Math.atan2(Math.sin(ctl.yaw - (R.lastYaw ?? ctl.yaw)), Math.cos(ctl.yaw - (R.lastYaw ?? ctl.yaw)))) / Math.max(1e-3, dt);
      R.lastYaw = ctl.yaw;
      if (turn > 1.6 && R.v > 3) R.v -= Math.min(R.v - 3, (turn - 1.6) * 1.1 * dt * R.v * 0.5);
      const want = f > 0 ? top : f < 0 ? -1.8 : 0;
      // (up to speed in about a second; let go, slowing to a stop)
      const acc = want > R.v ? (R.v < 3 ? 9 : 5.2) : f === 0 ? 8.5 : 14;
      R.v += Math.sign(want - R.v) * Math.min(Math.abs(want - R.v), acc * dt);
      R.vs += ((s ? s * R.side : 0) - R.vs) * (1 - Math.exp(-dt * 10));
      const sin = Math.sin(ctl.yaw), cos = Math.cos(ctl.yaw);
      ctl.vel.set(-sin * R.v + cos * R.vs, 0, -cos * R.v - sin * R.vs);
      // ---- what is in the way -------------------------------------------------------
      if (R.blocked) blockedStep(ctl, R, io);
      else {
        const q = R.things ? R.things.ahead(ctl.pos, ctl.vel, R.level, R0) : null;
        decide(ctl, R, q, io, dt);
      }
      if (!R.move) {
        const kx = ctl.pos.x, kz = ctl.pos.z;
        ctl.pos.addScaledVector(ctl.vel, dt);
        cols.resolve(ctl.pos, ctl.radius);
        ctl.keepOff(kx, kz);
        // (running into a wall is a stop, not a slide along it at full speed)
        const moved = Math.hypot(ctl.pos.x - kx, ctl.pos.z - kz) / Math.max(1e-4, dt);
        if (R.v > 0 && moved < R.v * 0.5 && Math.hypot(ctl.vel.x, ctl.vel.z) > 1) R.v = Math.max(0, Math.min(R.v, moved + 1.2));
        // the ground: a stair's tread, a kerb, or an edge to drop off
        const gy = W.surfaceY(ctl.pos.x, ctl.pos.z);
        if (gy < R.feet - 0.55) { R.move = { kind: 'fall', t: 0, vy: 0, vx: ctl.vel.x, vz: ctl.vel.z, from: R.feet }; R.onEvent('fall', {}); }
        else R.feet += (gy - R.feet) * (1 - Math.exp(-dt * 16));
      }
    }
    // ---- the eye: low under a thing, the lens, the bob, the hands ------------------------
    R.low += (R.lowWant - R.low) * (1 - Math.exp(-dt * (R.lowWant > R.low ? 14 : 8)));
    ctl.groundY = R.feet - R.low;
    const sp = Math.hypot(ctl.vel.x, ctl.vel.z);
    const MK = R.move ? R.move.kind : null;
    const lensWant = MK ? (MK === 'jump' || MK === 'vault' || MK === 'slide' || MK === 'slideDown' ? 1 : 0.4) : Math.min(1, sp / R.speed);
    R.lens += (lensWant - R.lens) * (1 - Math.exp(-dt * 3));
    const fov = R.fov0 + 5.5 * R.lens;
    if (Math.abs(ctl.camera.fov - fov) > 1e-3) { ctl.camera.fov = fov; ctl.camera.updateProjectionMatrix(); }
    const running = !R.move && !R.blocked;
    ctl.bobAmp += ((running && sp > 0.4 ? Math.min(1.35, sp / 4) : 0) - ctl.bobAmp) * (1 - Math.exp(-dt * 8));
    const prev = ctl.bobPhase;
    ctl.bobPhase += dt * (running && sp > 0.15 ? 2.1 + sp * 0.95 : 0);
    if (running && Math.floor(prev / Math.PI) !== Math.floor(ctl.bobPhase / Math.PI)) R.onEvent('step', { v: sp, level: R.level, y: R.feet, x: ctl.pos.x, z: ctl.pos.z });
    RUNHANDS.phase = ctl.bobPhase;
    RUNHANDS.k += ((running ? Math.min(1, sp / 5) : 0.15) - RUNHANDS.k) * (1 - Math.exp(-dt * 6));
    RUNHANDS.step(dt, 8);
    // a jolt: the view kicked and back
    const J = R.jolt;
    if (J) {
      J.t += dt;
      const u = J.t / (J.dur || 0.35), e = u < 0.2 ? u / 0.2 : Math.max(0, 1 - (u - 0.2) / 0.8);
      R.off.yaw = J.yaw * e; R.off.pitch = J.pitch * e;
      if (u >= 1) R.jolt = null;
    }
    // (the move's own tilt of the head: a slide leans back, a trip looks down)
    if (R.move && R.move.pitch) R.off.pitch += R.move.pitch;
    ctl.yaw += R.off.yaw; ctl.pitch += R.off.pitch;
  },
  exit(ctl) {
    const R = ctl.run;
    if (R) {
      ctl.yaw -= R.off.yaw; ctl.pitch -= R.off.pitch;
      if (R.move && R.move.T && R.move.colOff && R.things) R.things.solid(R.move.T, true);
      ctl.groundY = R.feet;
      ctl.camera.fov = R.fov0; ctl.camera.updateProjectionMatrix();
    }
    delete ctl.run;
  },
};

// the ground's slope under the eye along the view (a stair): > 0 going up
function stairSlope(ctl, W) {
  const sin = Math.sin(ctl.yaw), cos = Math.cos(ctl.yaw);
  const a = W.surfaceY(ctl.pos.x, ctl.pos.z), b = W.surfaceY(ctl.pos.x - sin * 0.5, ctl.pos.z - cos * 0.5);
  const d = (b - a) / 0.5;
  return Math.abs(d) > 2 ? 0 : d;
}

// ---- what to do about the thing ahead ---------------------------------------------------------
const keyFor = (kind) => (kind === 'under' || kind === 'slope' ? 'C' : kind === 'locked' ? null : 'Space');

function decide(ctl, R, q, io, dt) {
  const { TMIN, TMAX, BUF } = TIMING;
  const sp = io.press('Space') < BUF, cp = io.press('C') < BUF;
  const T = q ? q.T : null;
  // the shed's roof is met as I come over its head: C in the moments before
  // arms the slide down it
  if (T && T.kind === 'slope') {
    if (cp && q.t < 0.8) { io.spend('C'); R.slopeArm = 1; }
    if (q.d < 0.35 && q.c > 0.5) {
      const clean = R.slopeArm > 0;
      R.slopeArm = 0;
      startSlideDown(ctl, R, T, clean);
      meet(R, T, clean ? 'clean' : 'hit');
    }
    return;
  }
  const need = T ? keyFor(T.kind) : null;
  const right = need === 'Space' ? sp : need === 'C' ? cp : false;
  if (T && right && q.c > 0.5) {
    if (q.t <= TMAX && q.t >= TMIN && q.d > -0.05) { io.spend(need); start(ctl, R, q, 'clean'); return; }
    if (q.t < TMIN || q.d <= 0.05) { io.spend(need); start(ctl, R, q, 'late'); return; }
    // (early: held in the buffer while it may yet come into the window; a
    // press it cannot reach in time is a hop or a slide at once)
    const k = io.press(need);
    if (k < dt * 1.5 && q.t - (BUF - k) > TMAX) {
      io.spend(need);
      if (T.kind === 'jump' && q.t < 1.0) { start(ctl, R, q, 'early'); return; }
      if (need === 'C') startSlide(ctl, R, 'early'); else startHop(ctl, R);
      meet(R, T, 'early');
      return;
    }
  } else if (sp || cp) {
    // a press with nothing for it to meet (or the wrong key): a hop, a slide
    const key = sp ? 'Space' : 'C';
    if (io.press(key) < dt * 1.5 && Math.hypot(ctl.vel.x, ctl.vel.z) > 2.2) {
      io.spend(key);
      if (sp) startHop(ctl, R); else startSlide(ctl, R, 'open');
      if (T && q.t < 1.0) meet(R, T, 'early');
      return;
    }
  }
  // contact with nothing pressed: I hit it
  if (T && q.d <= 0.03 && q.c > 0.4) hit(ctl, R, q);
}

function meet(R, T, how) {
  if (!T) return;
  const prev = R.met.get(T.id);
  // (one verdict a thing a pass: the first, unless a hit follows an early)
  if (prev && !(prev === 'early' && how === 'hit')) return;
  R.met.set(T.id, how);
  R.last = { id: T.id, how, t: R.t };
  R.onEvent('meet', { T, how });
}

// ---- the moves ---------------------------------------------------------------------------------
function start(ctl, R, q, how) {
  const T = q.T, F = q.F;
  // straight across it along its normal, from my side
  const nx = -q.side * F.n.x, nz = -q.side * F.n.z;
  const v = Math.max(how === 'clean' ? 5.2 : 0, Math.hypot(ctl.vel.x, ctl.vel.z));
  const cross = Math.max(0, q.d) + T.depth + 2 * R0 + 0.25;
  const along = Math.max(0, Math.min(F.L, q.u * F.L));
  const at = { x: T.a.x + F.t.x * along, z: T.a.z + F.t.z * along };
  meet(R, T, how);
  if (T.kind === 'over') {
    if (how === 'clean') {
      const dur = Math.max(0.36, Math.min(0.62, cross / Math.max(4.6, v)));
      R.move = { kind: 'vault', T, t: 0, dur, vx: nx * cross / dur, vz: nz * cross / dur, keep: v, lift: Math.max(0.2, (T.top - 1.15) * 0.95 + 0.14), colOff: true };
      plant(at, T.y + T.top, F, 0.2);
      R.onEvent('vault', { T });
    } else {
      // a scramble: the hands on it, a knee over, down the far side
      R.move = { kind: 'scramble', T, t: 0, dur: T.low ? 0.5 : 0.66, nx, nz, cross, keep: 3.2, lift: Math.max(0.25, T.top - 0.95), colOff: true };
      plant(at, T.y + T.top, F, 0.2);
      R.onEvent('scramble', { T });
    }
    R.things.solid(T, false);
  } else if (T.kind === 'under') {
    if (how === 'clean') startSlide(ctl, R, 'clean', T, q);
    else {
      // late: a duck under it, bent double, its edge brushing my back
      R.move = { kind: 'duck', T, t: 0, nx, nz, cross, speed: 2.2, colOff: true };
      R.lowWant = 0.95;
      R.things.solid(T, false);
      R.onEvent('duck', { T });
    }
  } else if (T.kind === 'shoulder') {
    // ([C6 3rd] a door is met within a step of its frame too: the body goes
    // into the doorway, not into the wall beside it)
    const lat = doorLat(T, F, q.u * F.L);
    const atD = { x: T.a.x + F.t.x * lat.to, z: T.a.z + F.t.z * lat.to };
    if (how === 'clean') {
      T.bash(1);
      const vb = Math.max(3.8, v * 0.85);
      R.move = { kind: 'bash', T, t: 0, dur: 0.22, vx: nx * vb + F.t.x * lat.d / 0.22, vz: nz * vb + F.t.z * lat.d / 0.22 };
      plantDoor(atD, F, q.side);
      R.jolt = { t: 0, yaw: 0.06, pitch: -0.05, dur: 0.3 };
      R.onEvent('bash', { T });
    } else {
      // late: the shoulder into it at the last moment, a bruise
      T.bash(0.6);
      R.move = { kind: 'bruise', T, t: 0, dur: 0.48, vx: nx * 1.6 + F.t.x * lat.d / 0.48, vz: nz * 1.6 + F.t.z * lat.d / 0.48 };
      plantDoor(atD, F, q.side);
      R.jolt = { t: 0, yaw: -0.1, pitch: -0.12, dur: 0.45 };
      ctl.shake(0.5);
      R.onEvent('bruise', { T });
    }
  } else if (T.kind === 'jump') {
    // ([C6 3rd] late - pressed at the parapet itself - a foot on its coping
    // and over, slower, onto the far roof; too early, short: the hands catch
    // the far parapet and haul. A late press cost the catch and the haul: on
    // the roofs clumsy hands lost four and five times running)
    if (how === 'late') startJump(ctl, R, T, q.d, true, nx, nz, v, { standing: true, hs: Math.max(4.6, v * 0.78) });
    else startJump(ctl, R, T, q.d, how === 'clean', nx, nz, v);
  }
}

// ([C6 3rd] a door's doorway from where along it I am: the point inside its
// frame nearest me, and how far aside that is)
function doorLat(T, F, along) {
  const m = Math.min(0.42, F.L / 2);
  const to = Math.max(m, Math.min(F.L - m, along));
  return { to, d: to - along };
}

function plant(at, y, F, w) {
  RUNHANDS.plantR.set(at.x + F.t.x * w, y + 0.012, at.z + F.t.z * w);
  RUNHANDS.plantL.set(at.x - F.t.x * w, y + 0.012, at.z - F.t.z * w);
  rightOnRight();
  RUNHANDS.lift = 0;
  RUNHANDS.set('plant');
}
// (the right hand is the one on the eye's right)
function rightOnRight() {
  const cam = RUNHANDS.cam;
  if (!cam) return;
  const r = _n.set(1, 0, 0).applyQuaternion(cam.quaternion);
  if ((RUNHANDS.plantR.x - RUNHANDS.plantL.x) * r.x + (RUNHANDS.plantR.z - RUNHANDS.plantL.z) * r.z < 0) { _v.copy(RUNHANDS.plantR); RUNHANDS.plantR.copy(RUNHANDS.plantL); RUNHANDS.plantL.copy(_v); }
}
function plantDoor(at, F, side) {
  // (both palms on the door's face, chest high, a hand's breadth apart)
  const ox = F.n.x * 0.04 * side, oz = F.n.z * 0.04 * side;
  RUNHANDS.plantR.set(at.x + F.t.x * 0.2 + ox, 1.25, at.z + F.t.z * 0.2 + oz);
  RUNHANDS.plantL.set(at.x - F.t.x * 0.2 + ox, 1.4, at.z - F.t.z * 0.2 + oz);
  rightOnRight();
  RUNHANDS.lift = 0;
  RUNHANDS.set('plant');
}

function startHop(ctl, R) {
  const v = Math.hypot(ctl.vel.x, ctl.vel.z);
  const k = v < 4 ? 4 / Math.max(0.1, v) : 1;
  R.move = { kind: 'hop', t: 0, dur: 0.4, vx: ctl.vel.x * k, vz: ctl.vel.z * k, lift: 0.3 };
  R.onEvent('hop', {});
}

// a slide on the wet: the eye drops, the speed carries and dies; under a
// thing it carries on low until clear of it
function startSlide(ctl, R, how, T = null, q = null) {
  const v = Math.max(how === 'clean' ? 5.0 : 2.5, Math.hypot(ctl.vel.x, ctl.vel.z));
  let dx = ctl.vel.x, dz = ctl.vel.z;
  if (q) { dx = -q.side * q.F.n.x; dz = -q.side * q.F.n.z; }
  const L = Math.hypot(dx, dz) || 1;
  R.move = { kind: 'slide', T, t: 0, dur: 0.68, dx: dx / L, dz: dz / L, v0: v, how, colOff: !!T, under: T ? (T.depth + 2 * R0 + (q ? Math.max(0, q.d) : 0) + 0.2) : 0, gone: 0, pitch: 0.05 };
  R.lowWant = 1.05;
  if (T) R.things.solid(T, false);
  R.onEvent('slide', { T, how });
  RUNHANDS.set('pump');
}

// the jump over the light well: from the parapet, over the gap, down onto the
// far roof (clean); or short, onto the hands at the far parapet (caught)
function startJump(ctl, R, T, d0, clean, nx, nz, v, { standing = false, hs: hsIn = null } = {}) {
  const L = T.land;
  // (how far: to past the far parapet clean; to its outer face short)
  const xOuter = L.x - nx * 0.125;            // the far parapet's face toward me
  const toOuter = (ctl.pos.x - xOuter) * -nx + (0) * nz;
  const D = clean ? toOuter + 1.1 : Math.max(0.6, toOuter - R0 - 0.06);
  // ([C6 3rd] from standing at the parapet: up on its coping and over, slower)
  const hs = standing ? (hsIn ?? 4.3) : clean ? Math.max(5.6, v) : Math.max(3.4, v * 0.72);
  const ka = standing ? 0.34 : Math.min(0.5, Math.max(0.12, (Math.max(0, d0) + R0 + 0.3) / Math.max(0.5, D)));
  const yA = T.y + T.top + (standing ? 0.42 : clean ? 0.32 : 0.16);
  R.move = { kind: 'jump', T, t: 0, dur: D / hs, nx, nz, hs, y0: R.feet, yA, ka, yEnd: clean ? L.y : L.top - 1.6, clean, standing, colOff: true, pitch: 0 };
  if (standing) { plant({ x: ctl.pos.x + nx * (Math.max(0, d0) + R0), z: ctl.pos.z }, T.y + T.top, T.frame(), 0.22); }
  R.things.solid(T, false);
  R.onEvent('jump', { T, clean, standing });
}

function startSlideDown(ctl, R, T, clean) {
  // ([C6 3rd] a slither down it on the hands a little quicker: 3.0 to 3.8 m/s, was 2.6 to 3.4)
  R.move = { kind: clean ? 'slideDown' : 'slither', T, t: 0, v: clean ? Math.max(4.5, R.v) : 3.0, pitch: 0 };
  R.lowWant = clean ? 0.95 : 0.5;
  R.onEvent(clean ? 'slideDown' : 'slither', { T });
}

function hit(ctl, R, q) {
  const T = q.T, F = q.F;
  const nx = -q.side * F.n.x, nz = -q.side * F.n.z;
  const at = { x: ctl.pos.x + nx * (Math.max(0, q.d) + R0), z: ctl.pos.z + nz * (Math.max(0, q.d) + R0) };
  if (T.kind === 'over' && T.low) {
    // tripped over it: carried over it by the run, the hands thrown out
    const cross = Math.max(0.2, q.d) + T.depth + 2 * R0 + 0.3;
    // ([C6 3rd] a trip costs a little more - longer down, slower up: four
    // trips in a stretch lose him, two or three warn)
    R.move = { kind: 'trip', T, t: 0, dur: 1.0, nx, nz, cross, colOff: true, pitch: 0 };
    R.things.solid(T, false);
    RUNHANDS.set('catch');
    R.jolt = { t: 0, yaw: 0.05 * (Math.random() < 0.5 ? -1 : 1), pitch: -0.3, dur: 0.6 };
    ctl.shake(0.55);
    meet(R, T, 'hit');
    R.onEvent('trip', { T });
    return;
  }
  if (T.kind === 'locked' && T.bash) T.bash(1);
  // a hard stop: the body against it, the hands on it
  meet(R, T, 'hit');
  ctl.pos.x -= nx * 0.16; ctl.pos.z -= nz * 0.16;
  R.v = 0; R.vs = 0;
  ctl.vel.set(0, 0, 0);
  // ([C6 2nd] under a thing the knock is the head and shoulders against it:
  // shorter than a body stopped dead against a fence)
  R.move = { kind: 'hit', T, t: 0, dur: T.kind === 'jump' ? 0.32 : T.kind === 'under' ? 0.44 : 0.6 };
  if (T.kind === 'under') { RUNHANDS.set('catch'); R.jolt = { t: 0, yaw: 0.04, pitch: 0.22, dur: 0.5 }; }
  else { plant(at, T.y + Math.min(1.3, T.top), F, 0.22); R.jolt = { t: 0, yaw: 0.05, pitch: -0.14, dur: 0.45 }; }
  ctl.shake(0.7);
  R.blocked = { T, nx, nz, at, side: q.side };
  R.onEvent(T.kind === 'locked' ? 'rattle' : 'hit', { T });
}

// pressed against a thing after a hit: SPACE climbs (or jumps), C crawls,
// SPACE / E pushes a door; turning away or stepping aside lets go of it
function blockedStep(ctl, R, io) {
  const B = R.blocked, T = B.T;
  const F = T.frame();
  // (still against it? its face within a hand of me, and me facing it)
  const s = (ctl.pos.x - T.a.x) * F.n.x + (ctl.pos.z - T.a.z) * F.n.z;
  const along = (ctl.pos.x - T.a.x) * F.t.x + (ctl.pos.z - T.a.z) * F.t.z;
  const gap = Math.abs(s) - T.depth / 2 - R0;
  const fwd = { x: -Math.sin(ctl.yaw), z: -Math.cos(ctl.yaw) };
  const facing = fwd.x * B.nx + fwd.z * B.nz;
  const cx = T.catch || 0;
  if (!T.active || facing < 0.25 || gap > 0.3 || along < -R0 - cx || along > F.L + R0 + cx || Math.abs(R.vs) > 1.2) { R.blocked = null; RUNHANDS.set('pump'); return; }
  // (pressed against it: W does not move me through it)
  if (R.v > 0) { R.v = 0; ctl.vel.set(0, 0, 0); }
  const sp = io.press('Space') < TIMING.BUF, cp = io.press('C') < TIMING.BUF, ep = io.press('KeyE') < TIMING.BUF;
  if (T.kind === 'over' && sp) {
    io.spend('Space');
    R.blocked = null;
    R.move = { kind: 'climb', T, t: 0, dur: T.top > 1.3 ? 0.95 : 0.7, nx: B.nx, nz: B.nz, cross: Math.max(0, gap) + T.depth + 2 * R0 + 0.35, keep: 2.4, lift: Math.max(0.3, T.top - 0.85), colOff: true };
    plant(B.at, T.y + T.top, F, 0.2);
    R.things.solid(T, false);
    R.onEvent('climb', { T });
  } else if (T.kind === 'under' && cp) {
    io.spend('C');
    R.blocked = null;
    // ([C6 2nd] a scramble under it, bent double on the hands: quicker than a crawl,
    // so a missed slide costs about what a missed vault does)
    R.move = { kind: 'crawl', T, t: 0, nx: B.nx, nz: B.nz, cross: Math.max(0, gap) + T.depth + 2 * R0 + 0.25, speed: 2.2, colOff: true };
    R.lowWant = 1.15;
    R.things.solid(T, false);
    R.onEvent('crawl', { T });
  } else if (T.kind === 'shoulder' && (sp || ep)) {
    io.spend('Space'); io.spend('KeyE');
    R.blocked = null;
    T.bash(0.7);
    // ([C6 3rd] against the wall a step beside its frame: into the doorway)
    const lat = doorLat(T, F, along);
    R.move = { kind: 'push', T, t: 0, dur: 0.35, vx: B.nx * 1.8 + F.t.x * lat.d / 0.35, vz: B.nz * 1.8 + F.t.z * lat.d / 0.35 };
    plantDoor({ x: T.a.x + F.t.x * lat.to, z: T.a.z + F.t.z * lat.to }, F, B.side);
    R.onEvent('push', { T });
  } else if (T.kind === 'locked' && (sp || ep)) {
    io.spend('Space'); io.spend('KeyE');
    T.bash(1);
    R.jolt = { t: 0, yaw: 0.03, pitch: -0.05, dur: 0.3 };
    R.onEvent('rattle', { T });
  } else if (T.kind === 'jump' && sp) {
    io.spend('Space');
    R.blocked = null;
    // a standing jump from the parapet: ([C6 3rd] a foot up on its coping
    // and over, slower than a running leap, onto the far roof - a fumble at
    // the well costs about what a fumble elsewhere costs, not the catch and
    // the haul on top of the stop: clumsy hands lost five times running here)
    startJump(ctl, R, T, Math.max(0, gap), true, B.nx, B.nz, 0, { standing: true });
  }
}

// ---- a move's own path -------------------------------------------------------------------------
function stepMove(ctl, R, dt, cols) {
  const M = R.move, W = ctl.world;
  M.t += dt;
  const u = M.dur ? Math.min(1, M.t / M.dur) : 0;
  const gy = () => W.surfaceY(ctl.pos.x, ctl.pos.z);
  const end = (speed, ev = 'land', data = {}) => {
    if (M.colOff && M.T) R.things.solid(M.T, true);
    R.move = null;
    R.lowWant = 0;
    R.v = speed;
    RUNHANDS.set('pump');
    if (ev) R.onEvent(ev, { from: M.kind, ...data });
  };
  switch (M.kind) {
    case 'vault': {
      ctl.pos.x += M.vx * dt; ctl.pos.z += M.vz * dt;
      const lift = M.lift * Math.sin(Math.PI * Math.min(1, u / 0.86)) - 0.16 * Math.sin(Math.PI * Math.max(0, (u - 0.8) / 0.2));
      if (u > 0.55) RUNHANDS.lift = Math.min(1, (u - 0.55) / 0.3);
      ctl.vel.set(M.vx, 0, M.vz);
      R.feet = gy() + lift;
      if (u >= 1) { R.feet = gy(); end(Math.max(R.v, M.keep)); }
      return;
    }
    case 'scramble':
    case 'climb': {
      // up it slowly (the hands on it), over, down the far side
      const k = M.kind === 'climb' ? 0.6 : 0.55;
      const push = u < k ? 0.35 : M.cross / (M.dur * (1 - k)) * 0.9;
      ctl.pos.x += M.nx * push * dt; ctl.pos.z += M.nz * push * dt;
      const lift = u < k ? M.lift * sm(u / k) : M.lift * (1 - sm((u - k) / (1 - k) / 0.8)) - 0.12 * Math.sin(Math.PI * Math.max(0, (u - 0.88) / 0.12));
      if (u > k) RUNHANDS.lift = Math.min(1, (u - k) / 0.25);
      ctl.vel.set(M.nx * push, 0, M.nz * push);
      M.pitch = -0.12 * Math.sin(Math.PI * u);
      R.feet = gy() + lift;
      if (u >= 1) { R.feet = gy(); end(M.keep); }
      return;
    }
    case 'trip': {
      // carried over it, the eye pitched down at the ground coming up, the hands out
      const v = 3.4 * (1 - 0.6 * u);
      ctl.pos.x += M.nx * v * dt; ctl.pos.z += M.nz * v * dt;
      const lift = 0.18 * Math.sin(Math.PI * Math.min(1, u / 0.45)) - 0.55 * Math.sin(Math.PI * Math.min(1, Math.max(0, (u - 0.3) / 0.7)));
      M.pitch = -0.38 * Math.sin(Math.PI * Math.min(1, u / 0.8));
      ctl.vel.set(M.nx * v, 0, M.nz * v);
      R.feet = gy() + lift;
      if (u >= 1) { R.feet = gy(); end(1.6, 'land', { hard: true }); }
      return;
    }
    case 'hit': {
      // stopped dead against it a moment (stunned), then pressed against it
      ctl.vel.set(0, 0, 0);
      R.feet = gy() - 0.05 * Math.sin(Math.PI * u);
      if (u >= 1) { R.move = null; R.v = 0; R.feet = gy(); }
      return;
    }
    case 'hop': {
      ctl.pos.x += M.vx * dt; ctl.pos.z += M.vz * dt;
      cols.resolve(ctl.pos, ctl.radius);
      ctl.vel.set(M.vx, 0, M.vz);
      R.feet = gy() + M.lift * Math.sin(Math.PI * u) - 0.08 * Math.sin(Math.PI * Math.max(0, (u - 0.85) / 0.15));
      if (u >= 1) { R.feet = gy(); end(Math.hypot(M.vx, M.vz), 'land'); }
      return;
    }
    case 'slide':
    case 'duck':
    case 'crawl': {
      // low along the way; under a thing until clear of it
      let v;
      if (M.kind === 'slide') {
        const k = Math.min(1, M.t / M.dur);
        v = M.v0 * (1 - 0.45 * k);
        R.lowWant = 1.05;
        // (a slide still going when it comes to a thing to go under takes it:
        // already low, the body goes on under)
        if (!M.T && R.things) {
          const q = R.things.ahead(ctl.pos, ctl.vel, R.level, R0, { kinds: ['under'] });
          if (q && q.d < 0.15) { M.T = q.T; M.colOff = true; R.things.solid(q.T, false); M.under = M.gone + q.T.depth + 2 * R0 + 0.2; }
        }
      } else { v = M.speed; R.lowWant = M.kind === 'crawl' ? 1.15 : 0.95; M.pitch = -0.08; }
      const dx = M.kind === 'slide' ? M.dx : M.nx, dz = M.kind === 'slide' ? M.dz : M.nz;
      ctl.pos.x += dx * v * dt; ctl.pos.z += dz * v * dt;
      M.gone = (M.gone || 0) + v * dt;
      cols.resolve(ctl.pos, ctl.radius);
      ctl.vel.set(dx * v, 0, dz * v);
      R.feet += (gy() - R.feet) * (1 - Math.exp(-dt * 16));
      const need = M.kind === 'slide' ? M.under : M.cross;
      if ((M.kind !== 'slide' || M.t >= M.dur) && M.gone >= need) { end(M.kind === 'slide' ? v : 2.4, 'rise'); return; }
      // (a slide that has spent itself: up again)
      if (M.kind === 'slide' && M.t > M.dur * 2.2) end(Math.max(1.5, v), 'rise');
      return;
    }
    case 'bash':
    case 'bruise':
    case 'push': {
      ctl.pos.x += M.vx * dt; ctl.pos.z += M.vz * dt;
      cols.resolve(ctl.pos, ctl.radius);
      ctl.vel.set(M.vx, 0, M.vz);
      if (u > 0.5) RUNHANDS.lift = Math.min(1, (u - 0.5) / 0.4);
      R.feet += (gy() - R.feet) * (1 - Math.exp(-dt * 16));
      if (u >= 1) end(Math.hypot(M.vx, M.vz), null);
      return;
    }
    case 'jump': {
      // the long jump over the gap; or short, onto the hands at the far parapet
      ctl.pos.x += M.nx * M.hs * dt; ctl.pos.z += M.nz * M.hs * dt;
      ctl.vel.set(M.nx * M.hs, 0, M.nz * M.hs);
      R.feet = u < M.ka ? M.y0 + (M.yA - M.y0) * Math.sin(Math.PI / 2 * u / M.ka) : M.yA + (M.yEnd - M.yA) * ((u - M.ka) / (1 - M.ka)) ** 2;
      M.pitch = M.clean ? -0.12 * Math.sin(Math.PI * u) : -0.3 * u;
      // ([C6 3rd] from standing: the hands push off the coping and come away)
      if (M.standing && u > 0.3) RUNHANDS.lift = Math.min(1, (u - 0.3) / 0.3);
      if (u < 1) return;
      if (M.standing) RUNHANDS.set('pump');
      const L = M.T.land;
      if (!M.clean) {
        // (the hands on the coping, the body against the wall below it)
        RUNHANDS.plantR.set(L.x, L.top + 0.03, ctl.pos.z - 0.22);
        RUNHANDS.plantL.set(L.x, L.top + 0.03, ctl.pos.z + 0.22);
        rightOnRight();
        RUNHANDS.lift = 0;
        RUNHANDS.set('plant');
        // ([C6 2nd] the hang and the haul quicker: a missed jump costs about
        // what a missed vault does, not the stretch)
        R.move = { kind: 'hang', T: M.T, t: 0, dur: 0.26, nx: M.nx, nz: M.nz, y: L.top - 1.6, colOff: true, pitch: 0.12 };
        R.feet = L.top - 1.6;
        ctl.shake(0.8);
        R.jolt = { t: 0, yaw: 0, pitch: 0.2, dur: 0.4 };
        R.onEvent('catch', { T: M.T });
        return;
      }
      R.feet = gy();
      R.things.solid(M.T, true);
      R.move = { kind: 'land', t: 0, dur: 0.32, vx: M.nx * M.hs * 0.85, vz: M.nz * M.hs * 0.85, dip: 0.42 };
      ctl.shake(0.45);
      R.onEvent('land', { from: 'jump', hard: true });
      return;
    }
    case 'hang': {
      // hanging by the hands: the eye at the coping; then the haul up and over
      ctl.vel.set(0, 0, 0);
      R.feet = M.y + 0.04 * Math.sin(M.t * 9) * Math.max(0, 1 - M.t / 0.3);
      if (u >= 1) {
        R.move = { kind: 'haul', T: M.T, t: 0, dur: 0.72, nx: M.nx, nz: M.nz, y0: R.feet, colOff: true, pitch: 0 };
        R.onEvent('haul', { T: M.T });
      }
      return;
    }
    case 'haul': {
      // up on the arms, a knee on the coping, over it onto the roof
      const L = M.T.land;
      R.feet = M.y0 + (L.top + 0.1 - M.y0) * sm(Math.min(1, u / 0.6)) - (L.top + 0.1 - L.y) * sm(Math.max(0, (u - 0.6) / 0.4));
      const push = u < 0.5 ? 0.0 : 2.2;
      ctl.pos.x += M.nx * push * dt; ctl.pos.z += M.nz * push * dt;
      M.pitch = 0.12 * (1 - sm(u / 0.5)) - 0.18 * Math.sin(Math.PI * u);
      if (u > 0.6) RUNHANDS.lift = Math.min(1, (u - 0.6) / 0.3);
      if (u >= 1) { R.feet = gy(); if (M.colOff && M.T) R.things.solid(M.T, true); R.move = null; R.v = 2.6; RUNHANDS.set('pump'); R.onEvent('land', { from: 'haul' }); }
      return;
    }
    case 'land': {
      // a landing's dip, the run carried on
      ctl.pos.x += M.vx * dt; ctl.pos.z += M.vz * dt;
      cols.resolve(ctl.pos, ctl.radius);
      ctl.vel.set(M.vx, 0, M.vz);
      R.feet = gy() - M.dip * Math.sin(Math.PI * u);
      if (u >= 1) { R.move = null; R.v = Math.hypot(M.vx, M.vz); R.feet = gy(); }
      return;
    }
    case 'slideDown':
    case 'slither': {
      // down the steep roof on the seat of the coat (or slithering on the
      // hands), then off its eave: a drop to the pavement
      M.v = Math.min(M.kind === 'slideDown' ? 6.0 : 3.8, M.v + dt * 4);
      ctl.pos.x -= M.v * dt;
      cols.resolve(ctl.pos, ctl.radius);
      ctl.vel.set(-M.v, 0, 0);
      M.pitch = M.kind === 'slideDown' ? 0.06 : -0.32;
      const y = gy();
      if (y < R.feet - 0.6) {
        R.move = { kind: 'fall', t: 0, vy: -0.5, vx: -M.v * 0.8, vz: 0, from: R.feet, after: M.kind };
        R.lowWant = 0;
        R.onEvent('fall', { from: M.kind });
        return;
      }
      R.feet = y;
      return;
    }
    case 'fall': {
      M.vy -= 9.8 * dt;
      ctl.pos.x += M.vx * dt; ctl.pos.z += M.vz * dt;
      (R.feet > 1.2 && W.roofColliders ? W.roofColliders : W.colliders).resolve(ctl.pos, ctl.radius);
      R.feet += M.vy * dt;
      ctl.vel.set(M.vx, 0, M.vz);
      const y = gy();
      if (R.feet <= y) {
        const h = M.from - y;
        R.feet = y;
        const hard = h > 1.4 || M.after === 'slither';
        R.move = { kind: 'land', t: 0, dur: hard ? 0.45 : 0.25, vx: M.vx * (hard ? 0.4 : 0.8), vz: M.vz * (hard ? 0.4 : 0.8), dip: Math.min(0.6, 0.15 + h * 0.16) };
        ctl.shake(Math.min(1, 0.25 + h * 0.2));
        R.onEvent('land', { from: 'fall', h, hard });
      }
      return;
    }
    default:
      R.move = null;
  }
}

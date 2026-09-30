import * as THREE from 'three';
import { RUNHANDS } from '../clips/run.js';

// The chase's run (lane B4, scene 6): controller.setMode('run', opts).
// Built on walkStep: W runs at 7.5 m/s (no key to hold for it), A / D step
// aside at 3.2 while running on, S checks; the mouse steers as in walking.
// At speed the lens opens a few degrees, the stride bobs harder, the fists
// pump in the bottom corners (the hands' 'run' set: player/clips/run.js).
//   opts.fences      [{ a: {x, z}, b: {x, z}, h, collider }]: SPACE within
//                    2.2 m moving at one vaults it (0.45 s, both palms on its
//                    top, the eye arcs over and lands with a dip, no speed
//                    lost); running into it without SPACE is a scramble (1.1 s)
//   opts.obstacles   (x, z, r) -> [things]: what lies in the way (a fallen
//                    crate); a body into one without SPACE stumbles (a
//                    second lost, never a stop); SPACE hops over (0.4 s)
//   opts.onEvent(name, data)   'vault' | 'scramble' | 'stumble' | 'hop' |
//                    'land' | 'step' (the scene's sounds and prompts)
//   opts.speed (7.5), opts.side (3.2)
// ctl.run.flinch(yaw, pitch) (a dog at the gate), ctl.run.speedCap (a
// retry's first beat), ctl.run.act ('run' | 'vault' | 'scramble' |
// 'stumble' | 'hop'), ctl.run.v (the speed).
// SPACE is buffered 0.3 s, and held counts.
const _n = new THREE.Vector3();
const sm = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

export default {
  name: 'run',
  enter(ctl, opts = {}) {
    ctl.run = {
      speed: opts.speed ?? 7.5, side: opts.side ?? 3.2, fences: opts.fences || [], obstacles: opts.obstacles || null, onEvent: opts.onEvent || (() => {}),
      fov0: ctl.camera.fov, lens: 0, act: 'run', t: 0, v: 0, space: -1, spaceHeld: false, off: { yaw: 0, pitch: 0 }, jolt: null,
      vel0: new THREE.Vector3(), fence: null, hopY: 0, lastStep: 0, speedCap: null, stumbleCD: 0, game: opts.game || null, bobBase: ctl.bobAmp,
      flinch(yaw = 0.12, pitch = 0.05) { this.jolt = { t: 0, yaw, pitch }; },
    };
    RUNHANDS.cam = ctl.camera;
    RUNHANDS.set('pump');
    RUNHANDS.w = 1;
  },
  step(ctl, dt) {
    const R = ctl.run;
    if (!R) return;
    // (the view's own offsets - a jolt, a lurch - are laid on the look and
    // taken off again next step: the mouse's look stays the player's)
    ctl.yaw -= R.off.yaw; ctl.pitch -= R.off.pitch;
    R.off.yaw = 0; R.off.pitch = 0;
    const keys = ctl.keys, G = R.game;
    // (walkStep eases its own bob: it is given back its own value, and the
    // run's harder stride is laid on after)
    ctl.bobAmp = R.bobBase;
    const held = (c) => keys.has(c) || (G && G.vin && G.vin.held.has(c));
    let f = (held('KeyW') || held('ArrowUp') ? 1 : 0) - (held('KeyS') || held('ArrowDown') ? 1 : 0);
    let s = (held('KeyD') || held('ArrowRight') ? 1 : 0) - (held('KeyA') || held('ArrowLeft') ? 1 : 0);
    if (ctl.auto) { f = ctl.auto.f || 0; s = ctl.auto.s || 0; }
    if (ctl.frozen) { f = 0; s = 0; }
    // SPACE: a press is remembered 0.3 s; held counts
    const sp = held('Space') || (ctl.auto && ctl.auto.jump);
    if (sp && !R.spaceHeld) R.space = 0.3;
    R.spaceHeld = !!sp;
    R.space -= dt;
    const wantJump = R.space > 0 || R.spaceHeld;
    R.stumbleCD = Math.max(0, R.stumbleCD - dt);

    const sin = Math.sin(ctl.yaw), cos = Math.cos(ctl.yaw);
    const fwd = _n.set(-sin, 0, -cos);
    R.t += dt;
    if (R.act === 'vault' || R.act === 'scramble' || R.act === 'hop') {
      stepMove(ctl, R, dt);
    } else {
      // the run: forward at speed, aside at `side` (walkStep's velocity is
      // shaped so: its input direction and speed give both at once)
      let top = R.speed;
      if (R.act === 'stumble') {
        // (a second lost: the legs caught, the speed dropped to a jog and back)
        const k = R.t / 0.9;
        top = R.speed * (0.28 + 0.72 * sm((k - 0.35) / 0.65));
        if (R.t >= 0.9) { R.act = 'run'; R.t = 0; RUNHANDS.set('pump'); }
      }
      if (R.speedCap != null) top = Math.min(top, R.speedCap);
      const fs = f > 0 ? top : f < 0 ? 2.0 : 0;
      const ss = s ? R.side : 0;
      const sp2 = Math.hypot(fs, ss);
      const input = sp2 > 0 ? { f: f > 0 ? 1 : f < 0 ? -1 : 0, s: s ? s * (fs > 0 ? ss / fs : 1) : 0 } : { f: 0, s: 0 };
      ctl.walkStep(dt, { speed: sp2 || R.speed, canSprint: false, input });
      // the fences: SPACE near one (moving at it) vaults; into one without it
      // is a scramble over
      if (R.act === 'run') {
        const F = fenceAhead(ctl, R);
        if (F && wantJump && F.d < 2.2 && F.along > 1.0) startVault(ctl, R, F, 'vault');
        else if (F && F.d < 0.62 && F.along > 0.4 && f > 0) startVault(ctl, R, F, 'scramble');
      }
      // the things in the way: SPACE hops, else a stumble through
      if (R.act === 'run' && R.obstacles) {
        const ahead = R.obstacles(ctl.pos.x + fwd.x * 1.2, ctl.pos.z + fwd.z * 1.2, 0.5);
        if (ahead.length && wantJump && ctl.vel.length() > 2) startHop(ctl, R);
        else if (R.stumbleCD <= 0 && R.obstacles(ctl.pos.x, ctl.pos.z, 0.3).length) {
          R.act = 'stumble'; R.t = 0; R.stumbleCD = 1.4;
          RUNHANDS.set('catch');
          R.jolt = { t: 0, yaw: 0.05 * (Math.random() < 0.5 ? -1 : 1), pitch: -0.16 };
          ctl.shake(0.5);
          R.onEvent('stumble', {});
        }
      } else if (R.act === 'run' && wantJump && R.space > 0.28 && ctl.vel.length() > 3 && !fenceAhead(ctl, R)) {
        // (SPACE on open ground: a stride that is a hop, so it is never dead)
        startHop(ctl, R);
      }
    }
    // the stride: harder bob at speed; the fists pump with it
    R.v = Math.hypot(ctl.vel.x, ctl.vel.z);
    const lensWant = R.act === 'run' || R.act === 'hop' ? Math.min(1, R.v / R.speed) : R.act === 'vault' ? 1 : 0.3;
    R.lens += (lensWant - R.lens) * (1 - Math.exp(-dt * 3));
    const fov = R.fov0 + 5.5 * R.lens;
    if (Math.abs(ctl.camera.fov - fov) > 1e-3) { ctl.camera.fov = fov; ctl.camera.updateProjectionMatrix(); }
    R.bobBase = ctl.bobAmp;
    if (R.act === 'run' || R.act === 'stumble') ctl.bobAmp = R.bobBase * (1 + 0.35 * Math.min(1, R.v / R.speed));
    RUNHANDS.phase = ctl.bobPhase;
    RUNHANDS.k += (Math.min(1, R.v / 5) - RUNHANDS.k) * (1 - Math.exp(-dt * 6));
    RUNHANDS.step(dt, R.act === 'vault' ? 14 : 8);
    // a jolt (a dog at the gate, a stumble): the view kicked and back in 0.35 s
    const J = R.jolt;
    if (J) {
      J.t += dt;
      const u = J.t / 0.35, e = u < 0.2 ? u / 0.2 : Math.max(0, 1 - (u - 0.2) / 0.8);
      R.off.yaw = J.yaw * e; R.off.pitch = J.pitch * e;
      if (u >= 1) R.jolt = null;
    }
    ctl.yaw += R.off.yaw; ctl.pitch += R.off.pitch;
  },
  exit(ctl) {
    const R = ctl.run;
    if (R) {
      ctl.yaw -= R.off.yaw; ctl.pitch -= R.off.pitch;
      if (R.fence && R.fence.collider && R.fence.off) { R.fence.collider.cx -= 1000; R.fence.off = false; }
      ctl.camera.fov = R.fov0; ctl.camera.updateProjectionMatrix();
    }
    delete ctl.run;
  },
};

// the nearest fence the eye is running at: its distance (along the fence's
// normal), the speed toward it, and where the eye crosses it
function fenceAhead(ctl, R) {
  let best = null;
  const px = ctl.pos.x, pz = ctl.pos.z;
  for (const F of R.fences) {
    const ax = F.a.x, az = F.a.z, bx = F.b.x, bz = F.b.z;
    const tx = bx - ax, tz = bz - az, L = Math.hypot(tx, tz);
    const ux = tx / L, uz = tz / L;
    let nx = -uz, nz = ux;
    let d = (px - ax) * nx + (pz - az) * nz;
    if (d < 0) { nx = -nx; nz = -nz; d = -d; }
    // (along its length, inside it)
    const s = (px - ax) * ux + (pz - az) * uz;
    if (s < -0.2 || s > L + 0.2) continue;
    const along = -(ctl.vel.x * nx + ctl.vel.z * nz);
    if (d > 4) continue;
    if (!best || d < best.d) best = { F, d, along, nx, nz, s, ux, uz };
  }
  return best;
}

function startVault(ctl, R, hit, kind) {
  R.act = kind;
  R.t = 0;
  R.fence = hit.F;
  // (the fence's collider steps aside while the body goes over it)
  if (hit.F.collider && !hit.F.off) { hit.F.collider.cx += 1000; hit.F.off = true; }
  const v = Math.max(kind === 'vault' ? 5.0 : 0, Math.hypot(ctl.vel.x, ctl.vel.z));
  // straight over it: along the fence's normal, the speed kept
  R.vel0.set(-hit.nx, 0, -hit.nz).multiplyScalar(kind === 'vault' ? v : 1.8);
  R.cross = { x: hit.F.a.x + hit.ux * hit.s, z: hit.F.a.z + hit.uz * hit.s, d0: hit.d, nx: hit.nx, nz: hit.nz };
  R.dur = kind === 'vault' ? Math.max(0.42, Math.min(0.5, (hit.d + 1.3) / Math.max(4, v))) : 1.1;
  // the palms go to the top rail either side of where the eye crosses it
  const h = hit.F.h;
  RUNHANDS.plantR.set(R.cross.x + hit.ux * 0.2, h + 0.01, R.cross.z + hit.uz * 0.2);
  RUNHANDS.plantL.set(R.cross.x - hit.ux * 0.2, h + 0.01, R.cross.z - hit.uz * 0.2);
  // (the right hand is the one on the eye's right: along the fence, the
  // side that is right of the running direction)
  const rx = -R.vel0.z, rz = R.vel0.x;
  if (rx * hit.ux + rz * hit.uz < 0) { const t = RUNHANDS.plantR.clone(); RUNHANDS.plantR.copy(RUNHANDS.plantL); RUNHANDS.plantL.copy(t); }
  RUNHANDS.lift = 0;
  RUNHANDS.set('plant');
  R.onEvent(kind, { fence: hit.F });
}

function startHop(ctl, R) {
  R.act = 'hop'; R.t = 0; R.dur = 0.42;
  R.vel0.set(ctl.vel.x, 0, ctl.vel.z);
  if (R.vel0.length() < 4) R.vel0.setLength(4);
  R.onEvent('hop', {});
}

// the vault, the scramble, the hop: the body's path is the move's own (the
// eye arcs; the speed is kept), the walls still hold it
function stepMove(ctl, R, dt) {
  const u = Math.min(1, R.t / R.dur);
  const gy = ctl.world.surfaceY(ctl.pos.x, ctl.pos.z);
  let lift = 0;
  if (R.act === 'vault') {
    ctl.pos.addScaledVector(R.vel0, dt);
    // up over the rail (the eye 0.5 over its own height at the top), down,
    // and the landing's dip
    lift = 0.52 * Math.sin(Math.PI * Math.min(1, u / 0.85)) - 0.2 * Math.sin(Math.PI * Math.max(0, (u - 0.8) / 0.2));
    if (u > 0.55) RUNHANDS.lift = Math.min(1, (u - 0.55) / 0.3);
    ctl.bobAmp *= Math.exp(-dt * 10);
  } else if (R.act === 'scramble') {
    // up it hand over hand, a leg over, down the far side: slow
    const push = u < 0.62 ? 0.3 : 3.6;
    ctl.pos.addScaledVector(_n.copy(R.vel0).normalize(), push * dt);
    lift = u < 0.62 ? 0.75 * sm(u / 0.62) : 0.75 * (1 - sm((u - 0.62) / 0.3)) - 0.15 * Math.sin(Math.PI * Math.max(0, (u - 0.88) / 0.12));
    if (u > 0.62) RUNHANDS.lift = Math.min(1, (u - 0.62) / 0.25);
    ctl.bobAmp *= Math.exp(-dt * 10);
  } else {
    ctl.pos.addScaledVector(R.vel0, dt);
    lift = 0.32 * Math.sin(Math.PI * u) - 0.08 * Math.sin(Math.PI * Math.max(0, (u - 0.85) / 0.15));
  }
  ctl.vel.copy(R.act === 'scramble' ? _n.copy(R.vel0).normalize().multiplyScalar(u < 0.62 ? 0.3 : 3.6) : R.vel0);
  ctl.world.colliders.resolve(ctl.pos, ctl.radius);
  ctl.groundY = gy + lift;
  if (u >= 1) {
    const was = R.act;
    R.act = 'run'; R.t = 0;
    if (R.fence && R.fence.collider && R.fence.off) { R.fence.collider.cx -= 1000; R.fence.off = false; }
    R.fence = null;
    RUNHANDS.set('pump');
    ctl.groundY = gy;
    // (the run goes on at the speed it had: the next step's walkStep eases it)
    if (was === 'scramble') ctl.vel.setLength(3.2);
    R.onEvent('land', { from: was });
  }
}

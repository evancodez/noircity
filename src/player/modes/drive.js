import * as THREE from 'three';

// Driving (lane B5): the eye in the driver's seat of a car (src/vehicles).
//   controller.setMode('drive', { vehicle, game, eye: Vector3 (car frame),
//     control?(v, dt) -> true when it drove the car itself this step })
// Each step: the keys (W throttle, S brake, A / D steer, arrows too; the
// game's virtual keys count) into the car, the car's step (it moves before
// the eye is placed: no lag), the eye in its seat with the body's pitch and
// roll, the lens a little wider with speed. The mouse looks a little (the
// eye turns, the car does not) and drifts back ahead once it rests.
// controller.drive: { v, look: { yaw, pitch }, lean (0..1: the head out of
// the window to aim; the scene eases it), aim (true: the look is the aim's,
// wider, and stays where it is put) }
const EYE = 1.65;
const LOOK = { yaw: [-0.6, 0.6], pitch: [-0.32, 0.26] };
const AIM = { yaw: [-0.7, 0.34], pitch: [-0.3, 0.2] };
const LEAN = new THREE.Vector3(0.2, 0.06, -0.62);   // the head and shoulders out of the window (car frame)
const _e = new THREE.Vector3();
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export default {
  name: 'drive',
  enter(ctl, opts) {
    const v = opts.vehicle;
    // [R2] opts.fov: the lens at rest in the seat (the car's own: a longer
    // lens than on foot, so the road through the screen is the picture)
    const base = opts.fov ?? ctl.camera.fov;
    ctl.drive = { v, look: { yaw: 0, pitch: opts.pitch ?? -0.07 }, idle: 9, lean: 0, aim: false, fov0: ctl.camera.fov, base, eye: (opts.eye || new THREE.Vector3(-0.42, 1.44, -0.34)).clone(), fov: opts.fov != null && opts.ease != null && opts.ease < 0.01 ? base : ctl.camera.fov };
    ctl.bobAmp = 0;
    this.step(ctl, 0);
  },
  exit(ctl) {
    const D = ctl.drive;
    if (D && Math.abs(ctl.camera.fov - D.fov0) > 1e-3) { ctl.camera.fov = D.fov0; ctl.camera.updateProjectionMatrix(); }
    if (ctl.viewFx) ctl.viewFx.roll = 0;
    ctl.drive = null;
  },
  mouse(ctl, e) {
    const D = ctl.drive;
    if (!D || ctl.lookLocked) return true;
    const R = D.aim ? AIM : LOOK;
    D.look.yaw = clamp(D.look.yaw - e.movementX * ctl.sensitivity, R.yaw[0], R.yaw[1]);
    D.look.pitch = clamp(D.look.pitch - e.movementY * ctl.sensitivity, R.pitch[0], R.pitch[1]);
    D.idle = 0;
    return true;
  },
  step(ctl, dt) {
    const D = ctl.drive, O = ctl.modeOpts;
    if (!D) return;
    const v = D.v, G = O.game;
    // the keys into the car (unless the scene drives it this step)
    const held = (c) => (G ? G.held(c) : ctl.keys.has(c));
    const own = O.control && O.control(v, dt);
    if (!own) {
      const I = v.input;
      const fz = ctl.frozen || (G && G.state !== 'playing');
      I.throttle = !fz && (held('KeyW') || held('ArrowUp')) ? 1 : 0;
      I.brake = !fz && (held('KeyS') || held('ArrowDown')) ? 1 : 0;
      I.steer = fz ? 0 : ((held('KeyA') || held('ArrowLeft')) ? 1 : 0) - ((held('KeyD') || held('ArrowRight')) ? 1 : 0);
    }
    if (dt > 0 && v.driver === 'player') v.step(dt);
    // the look: back to the road ahead once the mouse rests (never while aiming)
    D.idle += dt;
    const R = D.aim ? AIM : LOOK;
    if (!D.aim && !D.focus && D.idle > 0.7 && dt > 0) {
      const k = 1 - Math.exp(-dt * 1.8);
      D.look.yaw += (0 - D.look.yaw) * k;
      D.look.pitch += ((O.pitch ?? -0.07) - D.look.pitch) * k;
    }
    // a thing the eyes follow (his car spinning out): the look eases to it
    if (D.focus && dt > 0 && !D.aim) {
      const f = D.focus.pos || D.focus, e = ctl.camera.position;
      const want = Math.atan2(-(f.x - e.x), -(f.z - e.z)) - (v.yaw - Math.PI / 2);
      const w = Math.atan2(Math.sin(want), Math.cos(want));
      const k = 1 - Math.exp(-dt * (D.idle > 0.5 ? 3.0 : 0.8));
      D.look.yaw += (clamp(w, -0.75, 0.75) - D.look.yaw) * k;
    }
    D.look.yaw = clamp(D.look.yaw, D.focus ? -0.75 : R.yaw[0], D.focus ? 0.75 : R.yaw[1]);
    D.look.pitch = clamp(D.look.pitch, R.pitch[0], R.pitch[1]);
    // the eye in its seat (the head out of the window as it leans)
    const L = D.lean;
    _e.copy(D.eye).addScaledVector(LEAN, L * L * (3 - 2 * L));
    // (the head lags the body a hair: the jolts reach the eye softened)
    v.seat(_e, _e);
    ctl.pos.set(_e.x, 0, _e.z);
    ctl.groundY = _e.y - EYE + 0.02;
    ctl.yaw = v.yaw - Math.PI / 2 + D.look.yaw;
    ctl.pitch = D.look.pitch + v.pitch * 0.9;
    ctl.bodyYaw = v.yaw - Math.PI / 2;
    ctl.bobAmp = 0;
    ctl.vel.set(0, 0, 0);
    // the body's roll (and its shake) reach the view
    const V = ctl.viewFx || (ctl.viewFx = { yaw: 0, pitch: 0, roll: 0, fwd: 0, side: 0, down: 0, eyes: 0 });
    const t = G ? G.time : 0, sh = v.shake * v.shake;
    V.roll = -v.roll * 0.85 + Math.sin(t * 41) * 0.004 * sh;
    V.pitch = (V.pitch || 0) + Math.sin(t * 53 + 0.7) * 0.006 * sh;
    V.yaw = (V.yaw || 0) + Math.sin(t * 47 + 1.9) * 0.004 * sh;
    // the lens widens with speed (68 -> 77 degrees flat out); [2nd pass] on
    // a thing the eyes follow (his spin into the post) it closes in, as a
    // camera would push in on the wreck (it was a small car turning 30 m off)
    const want = D.focus ? D.base - 14 : D.base + 9 * clamp((v.speed - 8) / 20, 0, 1);
    D.fov += (want - D.fov) * (dt > 0 ? 1 - Math.exp(-dt * (D.focus ? 2.2 : 2.5)) : 0);
    if (!ctl._kick && Math.abs(ctl.camera.fov - D.fov) > 0.01) { ctl.camera.fov = D.fov; ctl.camera.updateProjectionMatrix(); }
  },
};

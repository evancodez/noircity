import * as THREE from 'three';

// Holding a man by his lapels (lane B5, the question): the eye stands a
// forearm's length in front of him, where the scene puts it, and the mouse
// looks freely round (the question is asked with a look: the scene reads
// where the eyes are). Each step the scene sets controller.hold.at (the
// eye's place, world, y the eye's height) and .face (the yaw that looks at
// him); the look is kept relative to it.
//   controller.setMode('hold', { at: Vector3, face: yaw, pitch })
//   controller.hold = { at, face, look: { yaw, pitch }, idle }
const EYE = 1.65;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const R = { yaw: [-1.9, 1.9], pitch: [-0.95, 0.35] };

export default {
  name: 'hold',
  enter(ctl, opts) {
    ctl.hold = { at: (opts.at || ctl.camera.position).clone(), face: opts.face ?? ctl.yaw, look: { yaw: opts.yaw ?? 0, pitch: opts.pitch ?? -0.12 }, idle: 0, lean: 0 };
    this.step(ctl, 0);
  },
  exit(ctl) { ctl.hold = null; },
  mouse(ctl, e) {
    const H = ctl.hold;
    if (!H || ctl.lookLocked) return true;
    H.look.yaw = clamp(H.look.yaw - e.movementX * ctl.sensitivity, R.yaw[0], R.yaw[1]);
    H.look.pitch = clamp(H.look.pitch - e.movementY * ctl.sensitivity, R.pitch[0], R.pitch[1]);
    H.idle = 0;
    return true;
  },
  step(ctl, dt) {
    const H = ctl.hold;
    if (!H) return;
    H.idle += dt;
    ctl.pos.set(H.at.x, 0, H.at.z);
    ctl.groundY = H.at.y - EYE + 0.02;
    ctl.yaw = H.face + H.look.yaw;
    ctl.pitch = H.look.pitch;
    ctl.bodyYaw = H.face;
    ctl.bobAmp = 0;
    ctl.vel.set(0, 0, 0);
  },
};
export const HOLD_EYE = new THREE.Vector3();

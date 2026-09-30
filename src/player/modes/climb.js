// (the Controller's eye height over the feet: Controller.js EYE)
const EYE = 1.65;

// Climbing a ladder (scene 3, the fire escape's drop ladder; lane B1).
//   controller.setMode('climb', { path(u) -> { x, y, z } (the eye), u: 0 .. 1,
//       speed: u per second, face: yaw (the ladder's way), drive: null | -1 | 1,
//       onRung(i) })
// W climbs, S goes down (held: one to one, no momentum: a man on a ladder
// stops when he stops); `drive` climbs on its own (the way down after the
// landing). The mouse looks about within 1.1 rad of the ladder's face and
// never through the wall. `ctl.climb.u` says where he is; the scene reads
// it (the top: onto the landing; the foot: off it).
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export default {
  name: 'climb',
  enter(ctl, opts) {
    ctl.climb = { u: opts.u ?? 0, path: opts.path, speed: opts.speed ?? 0.5, face: opts.face ?? ctl.yaw, drive: opts.drive ?? null, onRung: opts.onRung || null, rung: -1, moving: 0 };
    const P = ctl.climb.path(ctl.climb.u);
    ctl.pos.set(P.x, 0, P.z);
    ctl.groundY = P.y - EYE + 0.02;
  },
  step(ctl, dt) {
    const K = ctl.climb;
    if (!K) return;
    const k = ctl.keys;
    let f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    if (ctl.auto) f = ctl.auto.f || 0;
    if (K.drive != null) f = K.drive;
    if (ctl.frozen) f = 0;
    const u0 = K.u;
    K.u = clamp(K.u + f * K.speed * dt, 0, 1);
    K.moving = Math.abs(K.u - u0) / Math.max(1e-6, dt) / K.speed;
    const P = K.path(K.u);
    ctl.pos.set(P.x, 0, P.z);
    ctl.groundY = P.y - EYE + 0.02;
    // a rung every 0.3 m: the hands and the feet on it (the scene's sound)
    const r = Math.floor((P.y - (K.path(0).y)) / 0.3);
    if (r !== K.rung && dt > 0) { if (K.rung >= 0 && K.onRung) K.onRung(r, f); K.rung = r; }
    // the look, held round the ladder's face
    ctl.yaw = K.face + clamp(wrap(ctl.yaw - K.face), -1.1, 1.1);
    ctl.pitch = clamp(ctl.pitch, -1.2, 1.25);
    // a small sway with each reach
    ctl.bobAmp += ((K.moving > 0.1 ? 0.35 : 0) - ctl.bobAmp) * (1 - Math.exp(-8 * dt));
    ctl.bobPhase += dt * (K.moving > 0.1 ? 6.2 : 0);
  },
  exit(ctl) { delete ctl.climb; },
};

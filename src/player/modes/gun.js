// The gun mode (lane C2): one way of fighting with a gun, in a room or a
// street (IV The Door, VII Pier Nine's loud pass, VIII The Block). Today's
// walk, a little slower (a room, not an avenue), and the crouch behind cover:
//   C toggles the crouch, Ctrl holds it: the eye goes down to 0.7 m above
//     the floor in a fifth of a second - under a desk on its side, a
//     counter, a crate, a car's wing - and a crouched man moves at a creep
//   RMB, crouched: rise and aim over what I am behind (0.15 s up, 0.15 s
//     down when it is let go); the eye goes up only as far as the gun needs
//     to clear it (the muzzle must clear the cover or the round hits it),
//     never higher than standing; at the end of something too tall to rise
//     over (a cabinet, a jamb), it leans out round its side instead
//   RMB, standing: the gun's own steady (the revolver's)
//   controller.setMode('gun', { crouch: false })
//   controller.crouchK  0 standing .. 1 down     controller.riseK  0 .. 1 up over the cover
//   controller.crouchOn the toggle's state       controller.leanK  -1 .. 1 (left .. right)
// (the mode 'office' of scene 5 stays as it was until lane C5 moves to this one)
import * as THREE from 'three';
export const GUN_MODE = { down: 1.0, time: 0.2, rise: 0.15, walk: 3.6, sprint: 5.6, creep: 1.7, risenWalk: 0.9, lean: 0.46, look: 1.3 };
const G_ = GUN_MODE;
const ss = (k) => k * k * (3 - 2 * k);

function heldRmb(ctl) {
  const G = ctl.world && ctl.world.game;
  return ctl.keys.has('Mouse2') || !!(G && G.vin && G.vin.held.has('Mouse2'));
}

// how far up the eye must go from the crouch for the gun to clear what is
// in front (a ray at the eye's height and one at the muzzle's, along the
// view's heading, 1.3 m); or, when nothing short of standing clears it,
// the side to lean out to
function plan(ctl) {
  const S = ctl.world, G = S.game;
  const R = G && G.rays;
  const floor = ctl._gy0 ?? ctl.groundY;
  const eye0 = floor + 1.63 - G_.down;
  const dir = new THREE.Vector3(-Math.sin(ctl.yaw), 0, -Math.cos(ctl.yaw));
  const skip = (e) => !!e.mesh.userData.pane;
  const clear = (x, y, z) => !R || !R.raycast(_o.set(x, y, z), dir, G_.look, { anyHit: true, skip });
  const px = ctl.pos.x, pz = ctl.pos.z;
  for (let h = 0; h <= G_.down + 1e-6; h += 0.05) {
    if (clear(px, eye0 + h, pz) && clear(px, eye0 + h - 0.1, pz)) return { up: Math.min(G_.down, h + 0.06), lean: 0 };
  }
  // too tall to rise over: lean round its side (the side that is clear)
  const rx = Math.cos(ctl.yaw), rz = -Math.sin(ctl.yaw);
  for (const s of [1, -1]) {
    const x = px + rx * s * G_.lean, z = pz + rz * s * G_.lean;
    if (S.colliders && blockedAt(S, x, z)) continue;
    if (clear(x, eye0 + 0.25, z)) return { up: 0.25, lean: s };
  }
  return { up: G_.down, lean: 0 };
}
const _o = new THREE.Vector3();
function blockedAt(S, x, z) {
  const p = { x, z };
  const r = 0.2;
  S.colliders.resolve(p, r);
  return Math.hypot(p.x - x, p.z - z) > 0.02;
}

export default {
  name: 'gun',
  enter(ctl, opts) {
    ctl.crouchOn = !!opts.crouch;
    ctl.crouchK = ctl.crouchOn ? 1 : 0;
    ctl.riseK = 0; ctl.leanK = 0;
    ctl._crouchC = ctl.keys.has('KeyC');
    ctl._gy0 = null;
    ctl._rise = { up: G_.down, lean: 0 };
    ctl._riseWas = false;
    ctl._leanOff = { x: 0, z: 0 };
  },
  step(ctl, dt) {
    // (the walk's own ground and place back first: the crouch, the rise and
    // the lean are laid on top of them)
    if (ctl._gy0 != null) ctl.groundY = ctl._gy0;
    ctl.pos.x -= ctl._leanOff.x; ctl.pos.z -= ctl._leanOff.z;
    const c = ctl.keys.has('KeyC') || !!(ctl.world.game && ctl.world.game.vin && ctl.world.game.vin.held.has('KeyC'));
    if (c && !ctl._crouchC && !ctl.frozen) ctl.crouchOn = !ctl.crouchOn;
    ctl._crouchC = c;
    const ctrl = ctl.keys.has('ControlLeft') || ctl.keys.has('ControlRight');
    const want = ctl.frozen ? 0 : (ctl.crouchOn || ctrl) ? 1 : 0;
    const k0 = ctl.crouchK || 0;
    ctl.crouchK = want > k0 ? Math.min(1, k0 + dt / G_.time) : Math.max(0, k0 - dt / (G_.time * 1.3));
    const e = ss(ctl.crouchK);
    // the rise: RMB while down
    const rising = !ctl.frozen && ctl.crouchK > 0.55 && heldRmb(ctl);
    if (rising && !ctl._riseWas) { ctl._gy0 = ctl._gy0 ?? ctl.groundY; ctl._rise = plan(ctl); }
    ctl._riseWas = rising;
    const r0 = ctl.riseK || 0;
    ctl.riseK = rising ? Math.min(1, r0 + dt / G_.rise) : Math.max(0, r0 - dt / G_.rise);
    const rk = ss(ctl.riseK);
    const speed = ctl.riseK > 0.3 ? G_.risenWalk : G_.walk - (G_.walk - G_.creep) * e;
    ctl.walkStep(dt, { speed, sprint: G_.sprint - 3.9 * e, canSprint: e < 0.5 && ctl.riseK < 0.1 });
    ctl._gy0 = ctl.groundY;
    const up = ctl._rise.lean ? ctl._rise.up : ctl._rise.up;
    ctl.groundY -= G_.down * e - up * rk * e;
    // the lean: the eye out round the side
    const lean = ctl._rise.lean * rk * e;
    ctl.leanK = lean;
    const rx = Math.cos(ctl.yaw), rz = -Math.sin(ctl.yaw);
    ctl._leanOff.x = rx * lean * G_.lean; ctl._leanOff.z = rz * lean * G_.lean;
    ctl.pos.x += ctl._leanOff.x; ctl.pos.z += ctl._leanOff.z;
    // (a crouched man's step is short: the bob too)
    ctl.bobAmp *= 1 - 0.5 * e;
  },
  exit(ctl) {
    if (ctl._gy0 != null) ctl.groundY = ctl._gy0;
    if (ctl._leanOff) { ctl.pos.x -= ctl._leanOff.x; ctl.pos.z -= ctl._leanOff.z; ctl._leanOff.x = ctl._leanOff.z = 0; }
    ctl._gy0 = null;
    ctl.crouchK = 0; ctl.riseK = 0; ctl.leanK = 0;
    ctl.crouchOn = false;
  },
};

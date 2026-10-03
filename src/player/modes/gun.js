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
export const GUN_MODE = { down: 1.0, time: 0.2, rise: 0.15, walk: 3.6, sprint: 5.6, creep: 1.7, risenWalk: 0.9, lean: 0.46, look: 2.4, leanLook: 1.3 };   // [C2] after the critic: look 1.3 -> 2.4 (down 1.4 m behind the tipped desk, RMB rose to nothing - its knee space let the plan's rays through - and the rounds went into its top, 2.2 m out)
const G_ = GUN_MODE;
const ss = (k) => k * k * (3 - 2 * k);

function heldRmb(ctl) {
  const G = ctl.world && ctl.world.game;
  return ctl.keys.has('Mouse2') || !!(G && G.vin && G.vin.held.has('Mouse2'));
}

// how far up the eye must go from the crouch for the gun to clear what is
// in front (a ray at the eye's height and one at the muzzle's, along the
// view's heading, GUN_MODE.look: 2.4 m); or, when nothing short of standing clears it,
// the side to lean out to
function plan(ctl) {
  const S = ctl.world, G = S.game;
  const R = G && G.rays;
  const floor = ctl._gy0 ?? ctl.groundY;
  const eye0 = floor + 1.63 - G_.down;
  const skip = (e) => !!e.mesh.userData.pane;
  // (along the view's heading and a little to either side of it: the gun
  // must clear what it is turned to)
  const dirs = [0, 0.22, -0.22].map((a) => new THREE.Vector3(-Math.sin(ctl.yaw + a), 0, -Math.cos(ctl.yaw + a)));
  const clear = (x, y, z) => !R || dirs.every((dir) => !R.raycast(_o.set(x, y, z), dir, G_.look, { anyHit: true, skip }));
  const px = ctl.pos.x, pz = ctl.pos.z;
  for (let h = 0; h <= G_.down + 1e-6; h += 0.05) {
    if (clear(px, eye0 + h, pz) && clear(px, eye0 + h - 0.16, pz)) return { up: Math.min(G_.down, h + 0.08), lean: 0 };
  }
  // too tall to rise over: lean round its side (the side that is clear
  // straight ahead - a jamb, a cabinet's end: the gun past its edge) // [C2] second owner: the view's own line only
  const rx = Math.cos(ctl.yaw), rz = -Math.sin(ctl.yaw);
  // (round a jamb the room beyond may be a corridor's far wall: the lean looks 1.3 m, as the rise once did)
  const ahead = (x, y, z) => !R || !R.raycast(_o.set(x, y, z), dirs[0], G_.leanLook, { anyHit: true, skip });
  for (const s of [1, -1]) {
    const x = px + rx * s * G_.lean, z = pz + rz * s * G_.lean;
    if (S.colliders && blockedAt(S, x, z)) continue;
    if (ahead(x, eye0 + 0.25, z) && ahead(x, eye0 + 0.12, z)) return { up: 0.25, lean: s };
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
    ctl.riseK = 0; ctl.leanK = 0; ctl.riseOver = false;
    ctl._crouchC = ctl.keys.has('KeyC');
    ctl._want = null;
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
    // (the knees and the coat: down and up are heard, as the rise over the cover is)
    const G0 = ctl.world && ctl.world.game;
    if (want !== ctl._want && ctl._want != null && G0 && G0.sfx && !ctl.frozen) G0.sfx.play('crouch', null, {}, { send: false, gain: want ? 0.5 : 0.32 });
    ctl._want = want;
    const k0 = ctl.crouchK || 0;
    ctl.crouchK = want > k0 ? Math.min(1, k0 + dt / G_.time) : Math.max(0, k0 - dt / (G_.time * 1.3));
    const e = ss(ctl.crouchK);
    // the rise: RMB while down
    const rising = !ctl.frozen && ctl.crouchK > 0.55 && heldRmb(ctl);
    if (rising && !ctl._riseWas) { ctl._gy0 = ctl._gy0 ?? ctl.groundY; ctl._rise = plan(ctl); ctl._planT = 0.1; if (G0 && G0.sfx) G0.sfx.play('clothRustle', null, {}, { send: false, gain: 0.3 }); }
    // (up, it is planned again as the view turns: up further when the gun is
    // turned onto something taller, down a little only slowly)
    else if (rising && (ctl._planT -= dt) <= 0) {
      ctl._planT = 0.1;
      const p = plan(ctl);
      if (!ctl._rise.lean && !p.lean) ctl._rise.want = p.up;
    }
    if (rising && ctl._rise.want != null) { const w = ctl._rise.want, u = ctl._rise.up; ctl._rise.up = w > u ? Math.min(w, u + dt * 6) : Math.max(w, u - dt * 1.2); }
    ctl._riseWas = rising;
    const r0 = ctl.riseK || 0;
    ctl.riseK = rising ? Math.min(1, r0 + dt / G_.rise) : Math.max(0, r0 - dt / G_.rise);
    const rk = ss(ctl.riseK);
    // ([C2] after the critic's second look: up over something - a rise over
    // nothing, in the open, lifts the eye 0.08 m and is still down in the open)
    ctl.riseOver = ctl.riseK > 0.5 && (!!ctl._rise.lean || ctl._rise.up > 0.15);
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
    ctl.crouchK = 0; ctl.riseK = 0; ctl.leanK = 0; ctl.riseOver = false;
    ctl.crouchOn = false;
  },
};

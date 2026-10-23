// (the Controller's eye height over the feet: Controller.js EYE)
const EYE = 1.65;

// The swim (NOIR CITY, lane O1b; O1 Left 6: a man in the river was put on the
// quay by a fade): the eye at the water, W / A / S / D stroke him along
// (slower than a walk; SHIFT a little faster), a slow bob, the look free.
// He cannot climb the quay's face: only the stone steps (world/dressing.js
// quaySteps, a lamp at each landing) and the slipways' ramps take him out
// (the city's swim step, world/swim.js, watches for those).
//   controller.setMode('swim', { water: y, C (the city: inWater, groundAt), canLeave(x, z) -> bool })
export default {
  name: 'swim',
  enter(ctl, opts) {
    // (his strokes, not footsteps: the walk's step callback is the stroke's while he swims)
    ctl.swim = { y: opts.water, C: opts.C, canLeave: opts.canLeave || (() => false), t: 0, onStep: ctl.onStep };
    ctl.onStep = opts.onStroke || null;
    ctl.vel.multiplyScalar(0.35);
  },
  step(ctl, dt) {
    const S = ctl.swim;
    if (!S) return;
    S.t += dt;
    const x0 = ctl.pos.x, z0 = ctl.pos.z, gy = ctl.groundY;
    ctl.walkStep(dt, { speed: 1.8, sprint: 2.6 });
    ctl.groundY = gy;
    // (out of the water only where it lets him: the face of the quay holds him off)
    const out = (x, z) => !S.C.inWater(x, z) && !S.canLeave(x, z);
    if (out(ctl.pos.x, ctl.pos.z)) {
      const x1 = ctl.pos.x, z1 = ctl.pos.z;
      ctl.pos.x = x0;
      if (out(ctl.pos.x, ctl.pos.z)) { ctl.pos.x = x1; ctl.pos.z = z0; if (out(ctl.pos.x, ctl.pos.z)) ctl.pos.x = x0; }
      ctl.vel.multiplyScalar(0.5);
    }
    // the eye at the water (eased down as he goes in), a slow bob
    const want = S.y + 0.3 + Math.sin(S.t * 1.9) * 0.05 - EYE;
    ctl.groundY += (want - ctl.groundY) * (1 - Math.exp(-6 * dt));
    ctl.bobAmp *= 0.5;
  },
  exit(ctl) { if (ctl.swim) ctl.onStep = ctl.swim.onStep; ctl.swim = null; },
};

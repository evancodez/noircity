// Walking in a room where men shoot (lane B2, scene 5): today's walk, a
// little slower (a room, not an avenue), and a crouch. C ducks and rises
// again (a toggle), Ctrl held ducks while it is held: the eye goes down to
// 0.72 m in a fifth of a second - behind the tipped desk, the filing
// cabinets, the water cooler - and a crouched man moves at a creep.
//   controller.setMode('office', { crouch: false })
//   controller.crouchK   0 standing .. 1 down (read by the scene: cover)
//   controller.crouchOn  the toggle's state (a scene may set it)
const DOWN = 0.93;           // how far the eye goes down (1.65 -> 0.72)
const TIME = 0.2;

export default {
  name: 'office',
  enter(ctl, opts) {
    ctl.crouchOn = !!opts.crouch;
    ctl.crouchK = ctl.crouchOn ? 1 : 0;
    ctl._crouchC = ctl.keys.has('KeyC');
    ctl._gy0 = null;
  },
  step(ctl, dt) {
    // (the walk's own ground back first: the crouch is laid on top of it)
    if (ctl._gy0 != null) ctl.groundY = ctl._gy0;
    const c = ctl.keys.has('KeyC');
    if (c && !ctl._crouchC && !ctl.frozen) ctl.crouchOn = !ctl.crouchOn;
    ctl._crouchC = c;
    const want = ctl.frozen ? 0 : (ctl.crouchOn || ctl.keys.has('ControlLeft') || ctl.keys.has('ControlRight')) ? 1 : 0;
    const k0 = ctl.crouchK || 0;
    ctl.crouchK = want > k0 ? Math.min(1, k0 + dt / TIME) : Math.max(0, k0 - dt / (TIME * 1.3));
    const k = ctl.crouchK;
    const e = k * k * (3 - 2 * k);
    ctl.walkStep(dt, { speed: 3.6 - 1.9 * e, sprint: 5.6 - 3.9 * e, canSprint: e < 0.5 });
    ctl._gy0 = ctl.groundY;
    ctl.groundY -= DOWN * e;
    // (a crouched man's step is short: the bob too)
    ctl.bobAmp *= 1 - 0.5 * e;
  },
  exit(ctl) {
    if (ctl._gy0 != null) ctl.groundY = ctl._gy0;
    ctl._gy0 = null;
    ctl.crouchK = 0;
    ctl.crouchOn = false;
  },
};

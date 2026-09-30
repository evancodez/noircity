// [B8] The way into the fist fight (docs/story/briefs/B8_FIGHT.md §1): the
// eye is carried by the scene - off the stool, round to him, up onto its
// feet - and the player may still look, a little: the mouse moves the view
// within a small range round where the scene holds it, and the look comes
// back to the middle when the mouse rests (as the brawl's own nudge does).
//   controller.setMode('brawlIn', { track(t, dt) -> { x, y, z, yaw, pitch }, look: [0.3, 0.2], bodyYaw(t)? })
// y is the eye's world height. bodyYaw(t), when given, is the heading the
// hands' body frame keeps (the stool's, while he is on it), else the view's.
const clamp = (x, a) => Math.max(-a, Math.min(a, x));

export default {
  name: 'brawlIn',
  enter(ctl, opts) {
    ctl._in = { yaw: 0, pitch: 0, idle: 0 };
    if (opts.bodyYaw) ctl.bodyYaw = opts.bodyYaw(0);
  },
  step(ctl, dt) {
    const O = ctl.modeOpts, I = ctl._in || (ctl._in = { yaw: 0, pitch: 0, idle: 0 });
    const P = O.track ? O.track(ctl.modeT, dt) : null;
    if (!P) return;
    // (the look comes home when the mouse rests)
    I.idle += dt;
    if (I.idle > 0.3) { const k = Math.exp(-dt * 2.2); I.yaw *= k; I.pitch *= k; }
    ctl.pos.set(P.x, 0, P.z);
    ctl.groundY = P.y - 1.63;
    ctl.yaw = P.yaw + I.yaw;
    ctl.pitch = Math.max(-1.2, Math.min(1.0, P.pitch + I.pitch));
    ctl.bodyYaw = O.bodyYaw ? O.bodyYaw(ctl.modeT) : null;
    ctl.vel.set(0, 0, 0);
  },
  mouse(ctl, e) {
    const O = ctl.modeOpts, I = ctl._in || (ctl._in = { yaw: 0, pitch: 0, idle: 0 });
    const [ly, lp] = O.look || [0.3, 0.2];
    I.yaw = clamp(I.yaw - e.movementX * ctl.sensitivity, ly);
    I.pitch = clamp(I.pitch - e.movementY * ctl.sensitivity, lp);
    I.idle = 0;
    return true;
  },
  exit(ctl) { delete ctl._in; },
};

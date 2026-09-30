// The sneak (lane B6, scene 8): walking as the street's walk, a little
// slower; C (the scene toggles it) crouches: the eye drops 0.6 m in a fifth
// of a second, the pace falls to a crouch-walk (not a crawl), no running;
// Shift runs when standing. Footfalls are the crew's to hear: each one is
// reported to ctl.onFootfall(x, z, { run, crouch, speed }) (the scene's),
// and sounds softer crouched.
//   controller.setMode('sneak', { crouch, sfx })   ctl.sneak = { crouch, k, speed, run }
const CROUCH_DROP = 0.62;

export default {
  name: 'sneak',
  enter(ctl, opts = {}) {
    const S = ctl.sneak = { crouch: !!opts.crouch, k: opts.crouch ? 1 : 0, gy: ctl.world.surfaceY(ctl.pos.x, ctl.pos.z), speed: 0, run: false };
    S.walk = opts.walk ?? 3.1;
    S.crawl = opts.crawl ?? 2.05;
    S.sprint = opts.sprint ?? 5.4;
    S.sfx = opts.sfx || null;
    // (the street's footfall is main.js's: kept, and called by ours)
    S.prevStep = ctl.onStep;
    ctl.onStep = (x, z, v) => {
      const run = S.run, crouch = S.crouch;
      if (S.sfx) S.sfx.play('step', null, { run, k: crouch ? 0.16 : run ? 0.7 : 0.42 }, { send: false });
      if (ctl.onFootfall) ctl.onFootfall(x, z, { run, crouch, speed: v });
    };
    ctl.groundY = S.gy - CROUCH_DROP * S.k;
  },
  step(ctl, dt) {
    const S = ctl.sneak;
    if (!S) return;
    // (the crouch is laid on the eye after the walk: the walk eases the
    // ground it stands on, the crouch comes off it)
    ctl.groundY = S.gy;
    if (dt > 0) {
      const k = ctl.keys;
      const shift = k.has('ShiftLeft') || k.has('ShiftRight');
      ctl.walkStep(dt, { speed: S.crouch ? S.crawl : S.walk, sprint: S.sprint, canSprint: !S.crouch });
      S.speed = Math.hypot(ctl.vel.x, ctl.vel.z);
      S.run = shift && !S.crouch && S.speed > S.walk + 0.4;
    }
    S.gy = ctl.groundY;
    S.k += ((S.crouch ? 1 : 0) - S.k) * (1 - Math.exp(-14 * dt));
    ctl.groundY = S.gy - CROUCH_DROP * S.k;
    // (crouched, the stride is shorter: the bob a little smaller)
    ctl.bobAmp *= 1 - 0.35 * S.k * Math.min(1, dt * 60);
  },
  exit(ctl) {
    const S = ctl.sneak;
    if (!S) return;
    ctl.onStep = S.prevStep;
    ctl.groundY = S.gy;
    delete ctl.sneak;
  },
};

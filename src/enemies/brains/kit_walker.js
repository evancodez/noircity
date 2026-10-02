// The kit's test bed's man (lane C1, src/scenes/92_kit.js): he goes to a
// goal through the points of his path, walking or running, and never fires;
// a hit checks him for a breath, and he goes on. The scene decides what his
// reaching the goal means (a fail).
//   brain: 'kit_walker', options: { path: [{ x, z }, ...] (the last is the goal), run, onArrive(hood) }
export default {
  name: 'kit_walker',
  create(game, hood, opts) {
    const { body } = opts;
    const path = opts.path || (opts.goal ? [opts.goal] : []);
    let i = 0, started = false, arrived = false, hold = 0;
    return {
      state: 'walk',
      update(dt) {
        if (arrived || i >= path.length) { body.stop(); return; }
        // (a round in him: he checks, a breath, then on)
        if (hold > 0) { hold -= dt; body.stop(); if (hold <= 0) started = false; return; }
        const P = path[i];
        if (!started) { started = true; body.go(P.x, P.z, !!opts.run); }
        if (body.follow(dt) || Math.hypot(hood.pos.x - P.x, hood.pos.z - P.z) < 0.6) {
          i++;
          started = false;
          if (i >= path.length) {
            arrived = true;
            body.stop();
            hood.setState('idle', 0.3);
            if (opts.onArrive) opts.onArrive(hood);
          }
        }
      },
      onHit() { hold = 0.5; },
    };
  },
};

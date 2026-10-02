// The kit's test bed's man (lane C1, src/scenes/92_kit.js): he walks to a
// goal and never fires; a hit staggers him, and he goes on. The scene
// decides what his reaching the goal means (a fail).
//   brain: 'kit_walker', options: { goal: { x, z }, run, onArrive(hood) }
export default {
  name: 'kit_walker',
  create(game, hood, opts) {
    const { body } = opts;
    const goal = opts.goal;
    let started = false, arrived = false, hold = 0;
    return {
      state: 'walk',
      update(dt) {
        if (arrived || !goal) { body.stop(); return; }
        // (a round in him: he checks, a breath, then on)
        if (hold > 0) { hold -= dt; body.stop(); if (hold <= 0) started = false; return; }
        if (!started) { started = true; body.go(goal.x, goal.z, !!opts.run); }
        if (body.follow(dt) || Math.hypot(hood.pos.x - goal.x, hood.pos.z - goal.z) < 0.6) {
          arrived = true;
          body.stop();
          hood.setState('idle', 0.3);
          if (opts.onArrive) opts.onArrive(hood);
        }
      },
      onHit() { hold = 0.55; },
    };
  },
};

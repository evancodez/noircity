import * as THREE from 'three';

// The Cardinal (B7, scene 9): he does not run and does not hide. He walks
// at the diner along his path behind his two men, a pistol in his free
// hand; every few seconds he stops, raises it, fires once or twice, and
// walks on. He takes a great deal of killing and shows it: his wounds
// (counted here, not his hit points) slow the walk, then a knee goes (the
// scene's clip), then he falls (the scene's). The scene reads `wounds` and
// `stage` and is told of each hit (onWound).
//   brain: 'b7_cardinal', options: { path: [{x, z}], pace: [m/s by stage],
//     onWound(hood, { head, wounds }), aim }
const _v = new THREE.Vector3();

export default {
  name: 'b7_cardinal',
  create(game, hood, opts) {
    const { body } = opts;
    const r = body.rng;
    const path = opts.path || [];
    const pace = opts.pace || [0.95, 0.72, 0.5];
    let i = 0, mode = 'walk', fireAt = game.time + r.range(3.2, 4.2), aimT = 0, shots = 0, hp0 = hood.hp;
    const B = {
      state: 'walk', wounds: 0, stage: 0, hold: 0,
      get mode() { return mode; },
      update(dt, t) {
        const p = body.player;
        if (B.hold > 0) { B.hold -= dt; hood.speed = 0; return; }
        if (mode === 'walk') {
          const wp = path[i];
          if (!wp) { mode = 'stand'; hood.speed = 0; hood.setState('aim', 0.3); return; }
          const d = Math.hypot(wp.x - hood.pos.x, wp.z - hood.pos.z);
          if (d < 0.35) { i++; return; }
          body.faceTo(wp.x, wp.z, dt, 2.2);
          hood.speed = pace[Math.min(pace.length - 1, B.stage)];
          if (hood.state !== 'walk') hood.setState('walk', 0.35);
          hood.lookAt(_v.copy(p).setY(p.y - 0.3));
          // (he stops to shoot when he has a line, never mid-stride through a door)
          if (t >= fireAt && body.distToPlayer() < 40 && body.checkLOS(dt)) {
            mode = 'aim'; hood.speed = 0; hood.setState('aim', 0.3); aimT = r.range(0.55, 0.8); shots = r.int(1, 2);
          }
          return;
        }
        // aim / stand: turned to me, the pistol up
        hood.speed = 0;
        body.faceTo(p.x, p.z, dt, 2.8);
        hood.lookAt(_v.copy(p).setY(p.y - 0.3));
        aimT -= dt;
        if (aimT > 0) return;
        if (shots > 0) { body.fire(t); shots--; aimT = r.range(0.5, 0.75); return; }
        if (mode === 'aim') { mode = 'walk'; fireAt = t + r.range(2.6, 3.6) + B.stage * 0.6; }
        else { shots = r.int(1, 2); aimT = r.range(1.2, 1.8); }
      },
      onHit(dir) {
        // (his hit points are a wall; the wounds are what count)
        const lost = hp0 - hood.hp;
        hp0 = hood.hp;
        const head = lost >= 900;
        B.wounds += head ? 3 : lost >= 45 ? 1 : 0.7;
        if (opts.onWound) opts.onWound(hood, { head, wounds: B.wounds, dir });
      },
      release() {},
    };
    body.aim = opts.aim ?? 0.8;
    return B;
  },
};

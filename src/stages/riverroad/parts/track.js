import * as THREE from 'three';
import { ROAD, project, frameAt, groundAt } from '../road.js';

// What the cars drive in (src/vehicles reads stage.track): the road's
// line, its two walls (the river railing on the right, the warehouse fronts
// on the left: a car scrapes along them), the hard round things (the el's
// columns, the lamp posts), the things that burst (the smash part), and the
// headlamps' two real lights (pre-allocated with the stage, so the light
// count never changes when a car comes on).
//   track.project(x, z, hint) -> { s, d }   track.frame(s)
//   track.right, track.left      the walls' d
//   track.circles(s0, s1, out)   [{ x, z, r, s, d, kind }]
//   track.ground(d)              the ground's height across the road
//   track.smash                  the smash part (collide, kickPieces)
//   track.spots                  [SpotLight x2]
export default {
  name: 'track', order: 95,
  build(stage) {
    const buckets = new Map();
    const add = (c) => { const k = Math.floor(c.s / 10); if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(c); };
    const el = stage.part('el');
    for (const c of el.columns) add({ ...c, kind: 'column' });
    const L = stage.part('lamps');
    for (const l of L.posts) { const b = l.group.position; add({ x: b.x, z: b.z, r: 0.2, s: l.s, d: l.d, kind: 'post', lamp: l }); }
    // the headlamps' lights (no shadows): off until a car takes one
    const spots = [];
    for (let i = 0; i < 2; i++) {
      const s = new THREE.SpotLight(0xffffff, 0, 40, 0.42, 0.55, 1.6);
      s.position.set(0, -50, 0);
      s.castShadow = false;
      stage.scene.add(s, s.target);
      spots.push(s);
    }
    return {
      project, frame: (s, out = {}) => frameAt(s, out), ground: groundAt,
      right: ROAD.rail - 0.1, left: ROAD.wall + 0.25,
      smash: stage.part('smash'), spots,
      circles(s0, s1, out = []) {
        out.length = 0;
        for (let k = Math.floor(s0 / 10); k <= Math.floor(s1 / 10); k++) { const b = buckets.get(k); if (b) for (const c of b) out.push(c); }
        return out;
      },
      add,
    };
  },
};

import * as THREE from 'three';
import { Lamps } from '../../../world/Lamps.js';
import { OVERPASS } from '../../../world/Overpass.js';
import { ROAD, roadPoint, frameAt } from '../road.js';

// The river road's lamps: gooseneck posts along the river pavement, their
// arms out over the road, and lamps hung under the el's road-side girder,
// the block's own (world/Lamps.js: cones, bulbs, the rain's light registry,
// the pooled real SpotLights, shooting out). Only the pool is the road's:
// five real lights (two with shadows) go to the nearest lamps, so the two
// cars' headlamps (src/vehicles) can have one each and the frame still
// carries seven. A cone past SHOW m is not drawn.
// API: the Lamps (stage.lamps), plus posts: [lamp] in s order (the crash
// finds its post among them) and near(s, d, r) -> lamp
const SHOW = 240;
const F = {};

export default {
  name: 'lamps', order: 50, tick: 40,
  build(stage) {
    const L = Object.create(Lamps.prototype);
    Object.assign(L, { world: stage, lamps: [], rng: stage.rng.fork(501), _poolTimer: 0, _fwd: new THREE.Vector3() });
    L.geo = L.postGeometry();
    L.posts = [];
    // the river posts: every 32 m, the arm over the road
    for (let s = 6; s < ROAD.len + 30; s += 32) {
      const sc = Math.min(ROAD.len, s);
      frameAt(sc, F);
      const base = roadPoint(sc, ROAD.rail - 0.75, ROAD.pave);
      const lamp = L.addPost(base, Math.PI + F.h, { real: true });
      lamp.s = sc; lamp.d = ROAD.rail - 0.75;
      L.posts.push(lamp);
    }
    // the el's lamps: under the road-side girder, mid-span, every other span
    for (let s = 4 + OVERPASS.span * 1.5; s < ROAD.len; s += OVERPASS.span * 2) {
      const a = roadPoint(s, ROAD.elA + 0.15, OVERPASS.deckY);
      const lamp = L.addHanging(a, { real: true });
      lamp.s = s; lamp.d = ROAD.elA;
    }
    // the pool: 2 + 3 (Lamps.buildPool's, with fewer lights)
    L.pool = [];
    const mk = (shadow) => {
      const spot = new THREE.SpotLight(0xffffff, 0, 26, 0.85, 0.95, 2.0);
      spot.castShadow = shadow;
      if (shadow) {
        spot.shadow.mapSize.set(1024, 1024);
        spot.shadow.bias = -0.0004; spot.shadow.normalBias = 0.02; spot.shadow.radius = 5;
        spot.shadow.camera.near = 0.3; spot.shadow.camera.far = 26;
      }
      spot.position.set(0, -50, 0);
      stage.scene.add(spot, spot.target);
      L.pool.push({ spot, lamp: null, k: 0, shadow });
    };
    for (let i = 0; i < 2; i++) mk(true);
    for (let i = 0; i < 3; i++) mk(false);
    L.buildInstances();
    // the post nearest (s, d) within r m
    L.near = (s, d, r = 6) => {
      let best = null, bd = r;
      for (const l of L.posts) { const e = Math.hypot(l.s - s, (l.d - d) * 0.5); if (e < bd) { bd = e; best = l; } }
      return best;
    };
    const baseUpdate = L.update;
    L.update = function (dt, t, camera) {
      const p = camera.position;
      for (const l of this.lamps) {
        const far = Math.hypot(l.head.x - p.x, l.head.z - p.z) > SHOW;
        l.cone.visible = !far;
      }
      baseUpdate.call(this, dt, t, camera);
    };
    return L;
  },
  update: (lamps, dt, t, camera) => lamps.update(dt, t, camera),
};

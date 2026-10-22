import * as THREE from 'three';
import { STARTS, START_DEFAULT, CITY, EL } from '../../../world/plan.js';

// Where a man may walk (lane O1): every wall of the city in the walking
// colliders' grid (the city part made them a GridColliders): the lots, the
// gardens' walls, the edges, the quay's railing, the bridge's parapets and
// barrier, the rail yard's fence; the lamp posts, the hydrants, the bins,
// the call boxes, the bollards, the el's columns as round things; the cars
// as their boxes as they stand (colliders.bodies). The outer net is the
// whole city (a region); the bounds - all the Hoods' nav grid reads - are a
// small square round the start (navAround(x, z, r) moves it: a fight's
// lane builds its grid where the fight is).
// The named places (anchors): city.start.<id> for every start of the plan
// ({ pos, yaw (an eye's: looking at the car's door), carYaw, car: { x, z } }).
//   api: { navAround(x, z, r), walls: count, posts: count }
export default {
  name: 'bounds', order: 200,
  build(stage) {
    const C = stage.part('city').C;
    const col = stage.colliders;
    for (const w of C.walls) {
      const b = col.addBox(w.cx, w.cz, w.hx, w.hz, w.angle, w.tag);
      if (w.barrier) b.barrier = true;
    }
    for (const p of C.posts) col.addCircle(p.x, p.z, p.r, p.tag);
    const el = stage.part('el');
    if (el) for (const c of el.columns) col.addCircle(c.x, c.z, c.r, 'column');
    // the el stations' stairs on the pavement: a man walks round their foot
    if (el) for (const s of el.stops) col.addBox(s.stair.x, s.stair.z - 3, 1.1, 8, 0, 'stair');
    // the outer net: the whole city; the bounds (the nav grid's) a small square
    col.addRegion(CITY.x0, CITY.x1, CITY.z0, CITY.z1, 'city');
    const S0 = STARTS[START_DEFAULT].car;
    col.setBounds(S0.x - 12, S0.x + 12, S0.z - 12, S0.z + 12);
    col.bodies = () => { const G = stage.game; return G && G.vehicles ? G.vehicles.list : []; };
    // the starts: the car at the kerb, my place on the pavement by its door
    for (const [id, s] of Object.entries(STARTS)) {
      const c = s.car;
      // (the car's left side faces the road's middle for a car at the right
      // kerb: I stand on the pavement on its right, by the passenger side,
      // looking at it)
      const rx = Math.sin(c.yaw), rz = Math.cos(c.yaw);   // the car's right (x, z)
      const px = c.x + rx * 2.3, pz = c.z + rz * 2.3;
      const yaw = Math.atan2(-(c.x - px), -(c.z - pz)) + 0.35;
      stage.addAnchor(`city.start.${id}`, { pos: new THREE.Vector3(px, 0, pz), yaw, car: { x: c.x, z: c.z }, carYaw: c.yaw, name2: s.name });
    }
    void EL;
    return {
      walls: C.walls.length, posts: C.posts.length,
      navAround(x, z, r = 30) {
        col.setBounds(x - r, x + r, z - r, z + r);
        return col.bounds;
      },
    };
  },
};

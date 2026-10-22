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
// (behind the free roam's coupe: its half length 2.45 + a stride; a hair
// toward the road's middle, so the car stands low on the right of the frame
// and the street runs away left of it, as the reference's car and street do)
const START_BACK = 2.45 + 2.2, START_SIDE = -0.35;

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
    // the starts: the car at the kerb, me a stride behind its tail, looking
    // up the street past it (a little toward the road's middle): the car low
    // in the frame, the district the picture, the car within E's reach (the
    // critic's M2: a start facing the car's flank from a metre, a wall at my
    // back, showed a door panel)
    const v = new THREE.Vector3();
    for (const [id, s] of Object.entries(STARTS)) {
      const c = s.car;
      const fx = Math.cos(c.yaw), fz = -Math.sin(c.yaw);   // the car's forward (x, z)
      const rx = Math.sin(c.yaw), rz = Math.cos(c.yaw);    // its right: the kerb (a car at the right kerb)
      v.set(c.x - fx * START_BACK + rx * START_SIDE, 0, c.z - fz * START_BACK + rz * START_SIDE);
      col.resolve(v, 0.3);   // (clear of a post or a bin on the kerb)
      const yaw = c.yaw - Math.PI / 2 + 0.2;
      stage.addAnchor(`city.start.${id}`, { pos: v.clone(), yaw, car: { x: c.x, z: c.z }, carYaw: c.yaw, name2: s.name });
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

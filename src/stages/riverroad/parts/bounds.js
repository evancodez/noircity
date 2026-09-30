import { ROAD, roadPoint, frameAt, carYawAt } from '../road.js';

// Where a man may walk on the river road (the crash's stretch, the last
// ~400 m: the only place anyone gets out of a car): the outer net round it,
// the railing and the warehouse fronts as walls, the el's columns. The
// cars keep their own walls (src/vehicles). The story's places:
//   tail.car.start   my coupe at the kerb where the tail begins
//   tail.sedan.start his sedan, already well down the road
export default {
  name: 'bounds', order: 200,
  build(stage) {
    const C = stage.colliders;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    const S0 = 880;
    for (let s = S0; s <= ROAD.len; s += 5) for (const d of [ROAD.wall - 2, ROAD.rail + 2]) {
      const p = roadPoint(s, d);
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z);
    }
    C.setBounds(x0 - 4, x1 + 4, z0 - 4, z1 + 4);
    const F = {};
    for (let s = S0; s < ROAD.len; s += 6) {
      frameAt(s + 3, F);
      const r = roadPoint(s + 3, ROAD.rail + 0.15), w = roadPoint(s + 3, ROAD.wall - 0.3);
      // (a box's angle turns local x toward (cos a, -sin a): along the road)
      C.addBox(r.x, r.z, 3.2, 0.15, F.h + Math.PI / 2, 'rail');
      C.addBox(w.x, w.z, 3.2, 0.3, F.h + Math.PI / 2, 'wall');
    }
    const el = stage.part('el');
    if (el) for (const c of el.columns) if (c.s > S0 - 10) C.addCircle(c.x, c.z, c.r, 'column');
    const a = (name, s, d, y, extra = {}) => stage.addAnchor(name, { pos: roadPoint(s, d, y), yaw: frameAt(s, {}).h, carYaw: carYawAt(s), s, d, ...extra });
    a('tail.car.start', ROAD.marks.start, 4.4, 0);
    a('tail.sedan.start', ROAD.marks.start + 70, 1.8, 0);
    return { bounds: C.bounds };
  },
};

import * as THREE from 'three';
import { LAYER, tagInk, allocInkId } from '../../../render/layers.js';
import { makeGroundMaterial } from '../../../render/shaders/ground.js';
import { merge } from '../../../world/geom.js';
import { HARBOR, BACKST, MERCER, MARKET, NORTHST } from '../plan.js';

// The backlot's ground: one wet plane at y 0 under everything (the alleys,
// the yards, the two streets' roads: the wet-street shader, its puddles,
// ripples and streaked reflections), and the two streets' pavements raised
// 0.15 on kerbs. The alleys are flush with the roads (a drop kerb where the
// side alley meets Harbor Street). It is the stage's `street` (the
// footfalls' and the rounds' ripples: addImpact).
const TOP = 0.15;
// the pavements: [x0, x1, z0, z1]
const PAVES = [
  // Harbor Street: the north pavement, broken by the side alley's mouth (x 0 .. 5)
  [HARBOR.x0, 0, HARBOR.z0 - HARBOR.pave, HARBOR.z0],
  [5, HARBOR.x1, HARBOR.z0 - HARBOR.pave, HARBOR.z0],
  // its south pavement
  [HARBOR.x0, HARBOR.x1, HARBOR.z1, HARBOR.z1 + HARBOR.pave],
  // the back street (Pell Lane): the east pavement (the board fence's side) and the west
  [BACKST.x1, 2.0, BACKST.z0, BACKST.z1],
  [BACKST.x0 - BACKST.pave, BACKST.x0, BACKST.z0, BACKST.z1],
  // [C6] Mercer Street's pavements, and the market's flags (flush with them
  // and with Pell Lane's through the gate)
  [MERCER.x0, MERCER.road[0], MERCER.z0, MERCER.z1],
  [MERCER.road[1], MERCER.x1, MERCER.z0, MERCER.z1],
  [MARKET.x0, MARKET.x1, MARKET.z0, MARKET.z1],
  // the cross street at the north end (its south pavement cut by Pell Lane's and Mercer Street's roads; the kerb on the road side: 5th)
  [-40, BACKST.x0, NORTHST.z1, BACKST.z0, 'z0'], [BACKST.x1, MERCER.road[0], NORTHST.z1, BACKST.z0, 'z0'], [MERCER.road[1], NORTHST.x1, NORTHST.z1, BACKST.z0, 'z0'],
  [NORTHST.x0, NORTHST.x1, NORTHST.z0 - NORTHST.pave, NORTHST.z0, 'z1'],
];

export default {
  name: 'street', order: 20,
  build(stage) {
    const { scene, U, M, colliders } = stage;
    const road = new THREE.Mesh(new THREE.PlaneGeometry(420, 420, 1, 1).rotateX(-Math.PI / 2), makeGroundMaterial(U, { paving: 0 }));
    road.position.set(30, 0, -70);
    road.receiveShadow = true;
    road.layers.set(LAYER.GROUND);
    road.userData.inkId = allocInkId();
    road.name = 'backlotGround';
    scene.add(road);
    const paveMat = makeGroundMaterial(U, { paving: 1 });
    const kerbs = [];
    for (const [x0, x1, z0, z1, side] of PAVES) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), paveMat);
      p.position.set((x0 + x1) / 2, TOP, (z0 + z1) / 2);
      p.receiveShadow = true;
      p.layers.set(LAYER.GROUND);
      p.userData.inkId = allocInkId();
      scene.add(p);
      // the kerb stones: a low box round the slab's road side(s)
      const k = (w, d, x, z) => kerbs.push(new THREE.BoxGeometry(w, TOP, d).translate(x, TOP / 2 - 0.002, z));
      if (x0 === MARKET.x0 && x1 === MARKET.x1) continue;                              // (the market: walls, no kerb)
      if (side === 'z0') { k(x1 - x0, 0.22, (x0 + x1) / 2, z0 + 0.11); continue; }
      if (side === 'z1') { k(x1 - x0, 0.22, (x0 + x1) / 2, z1 - 0.11); continue; }
      if (z1 <= HARBOR.z0 + 0.01) k(x1 - x0, 0.22, (x0 + x1) / 2, z1 - 0.11);          // north pavement's kerb
      else if (z0 >= HARBOR.z1 - 0.01) k(x1 - x0, 0.22, (x0 + x1) / 2, z0 + 0.11);     // south
      else if (x0 >= BACKST.x1 - 0.01 && x0 < MERCER.x0) k(0.22, z1 - z0, x0 + 0.11, (z0 + z1) / 2);     // back street, east
      else if (x0 === MERCER.road[1]) k(0.22, z1 - z0, x0 + 0.11, (z0 + z1) / 2);      // Mercer St, east
      else k(0.22, z1 - z0, x1 - 0.11, (z0 + z1) / 2);                                 // back street, west; Mercer St, west
    }
    const kerb = new THREE.Mesh(merge(kerbs), M.kerb);
    kerb.receiveShadow = true;
    tagInk(kerb);
    scene.add(kerb);
    // the stage's outer net (and the Hoods' nav grid, which must fit in
    // memory: the backlot's own ground, a little beyond its walls)
    colliders.setBounds(-38, 104, -163, 22);
    stage.addSurface((x, z) => surfaceY(x, z));
    const api = {
      road, surfaceY,
      addImpact(world, x, z, strength = 1) {
        const arr = world.U.uImpacts.value;
        let oldest = 0;
        for (let i = 1; i < arr.length; i++) if (arr[i].z < arr[oldest].z) oldest = i;
        arr[oldest].set(x, z, world.U.uTime.value, strength);
      },
      addBlast(world, x, z, strength = 3) {
        const arr = world.U.uBlasts.value;
        let oldest = 0;
        for (let i = 1; i < arr.length; i++) if (arr[i].z < arr[oldest].z) oldest = i;
        arr[oldest].set(x, z, world.U.uTime.value, strength);
      },
    };
    return api;
  },
};

// the walking surface: a pavement's top, its kerb step smoothed over 0.24 m
const ss = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
function inside(x, z, [x0, x1, z0, z1], e = 0.12) {
  const kx = ss(x0 - e, x0 + e, x) * (1 - ss(x1 - e, x1 + e, x));
  const kz = ss(z0 - e, z0 + e, z) * (1 - ss(z1 - e, z1 + e, z));
  return kx * kz;
}
export function surfaceY(x, z) {
  let k = 0;
  for (const P of PAVES) { const v = inside(x, z, P); if (v > k) k = v; }
  return TOP * k;
}

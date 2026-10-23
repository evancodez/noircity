import * as THREE from 'three';
import { LAYER, allocInkId } from '../../../render/layers.js';
import { makeGroundMaterial } from '../../../render/shaders/ground.js';
import { RIVER, RIVER_LINE, QUAY_OFF, BRIDGE, PIERS, PAVE, EDGE } from '../../../world/plan.js';
import { RIVER_SEGS } from '../../../world/cityGen.js';

// The city's ground (the stage's `street`: footfalls' and rounds' ripples on
// the wet road, addImpact / addBlast): one wet-road shape over all the land
// to the quay's edge (the wet-street shader: its puddles, its rings, every
// lamp's streak in it), the bridge's deck over the water. The raised
// pavements are the near chunks' (stream.js: they come with the kerbs); the
// walking surface is the generator's groundAt (stage.addSurface).
//   api: { road, pave (the pavements' material, shared), addImpact, addBlast }
export default {
  name: 'street', order: 20,
  build(stage) {
    const { scene, U } = stage;
    const C = stage.part('city').C;
    const roadMat = makeGroundMaterial(U, { paving: 0 }), paveMat = makeGroundMaterial(U, { paving: 1 });
    // [O1b] the city's street: ink and pools (the cold play's finding 3) - the
    // dry ground between the puddles darker, the light kept in the puddles' sheen
    roadMat.uniforms.uDryK.value = 0.5; paveMat.uniforms.uDryK.value = 0.6;
    const mk = (geo, mat, name) => {
      const m = new THREE.Mesh(geo, mat);
      m.layers.set(LAYER.GROUND);
      m.receiveShadow = true;
      m.userData.inkId = allocInkId();
      m.name = name;
      scene.add(m);
      return m;
    };
    // the land: west and north far past the edges, east and south to the
    // quay's face (the river road's line pushed out QUAY_OFF)
    const land = [[-900, -900]];
    for (let i = 0; i < RIVER_LINE.length; i++) {
      const s = RIVER_SEGS[Math.min(i, RIVER_SEGS.length - 1)];
      const [x, z] = RIVER_LINE[i];
      // (the outward offset of the line's point: the segment's normal is toward the city)
      if (i === 0) land.push([x - s.nx * QUAY_OFF, -900]);
      land.push([x - s.nx * QUAY_OFF, z - s.nz * QUAY_OFF]);
    }
    land.push([-900, land[land.length - 1][1]]);
    const sh = new THREE.Shape();
    // (drawn in x, -z: rotated flat it lies in x, z)
    sh.moveTo(land[0][0], -land[0][1]);
    for (let i = 1; i < land.length; i++) sh.lineTo(land[i][0], -land[i][1]);
    sh.closePath();
    const road = mk(new THREE.ShapeGeometry(sh, 1).rotateX(-Math.PI / 2), roadMat, 'cityGround');
    // the bridge's deck (road) and the piers' decks (raised: pavement)
    // (two fixed spans: the gap between the bascule's hinges is open water - its leaves are up)
    const spans = [[RIVER.e + QUAY_OFF - 1, BRIDGE.hinge[0]], [BRIDGE.hinge[1], BRIDGE.x1]];
    mk(mergeAll(spans.map(([a, b]) => new THREE.PlaneGeometry(b - a, BRIDGE.hw * 2).rotateX(-Math.PI / 2).translate((a + b) / 2, BRIDGE.deckY, BRIDGE.z))), roadMat, 'bridgeDeck');
    const piers = [];
    for (const p of PIERS) piers.push(new THREE.PlaneGeometry(p.w, p.len + 1).rotateX(-Math.PI / 2).translate(p.x, PAVE, RIVER.s + QUAY_OFF + p.len / 2 - 0.5));
    // the quay's pavement (river side of the river road) and the bridge's footways
    const quay = [];
    for (const s of RIVER_SEGS) {
      const a0 = [s.ax - s.nx * RIVER.hw, s.az - s.nz * RIVER.hw], b0 = [s.bx - s.nx * RIVER.hw, s.bz - s.nz * RIVER.hw];
      const a1 = [s.ax - s.nx * QUAY_OFF, s.az - s.nz * QUAY_OFF], b1 = [s.bx - s.nx * QUAY_OFF, s.bz - s.nz * QUAY_OFF];
      quay.push(quadGeo(a0, b0, b1, a1, PAVE));
    }
    for (const sz of [-1, 1]) {
      const z0 = BRIDGE.z + sz * BRIDGE.hw, z1 = BRIDGE.z + sz * (BRIDGE.hw + BRIDGE.foot);
      for (const [a, b] of spans) quay.push(quadGeo([a, z0], [b, z0], [b, z1], [a, z1], PAVE));
    }
    const pave = mk(mergeAll([...piers, ...quay]), paveMat, 'quayPave');
    void EDGE;
    stage.addSurface((x, z) => C.groundAt(x, z));
    const impact = (arrName) => (world, x, z, strength = 1) => {
      const arr = world.U[arrName].value;
      let oldest = 0;
      for (let i = 1; i < arr.length; i++) if (arr[i].z < arr[oldest].z) oldest = i;
      arr[oldest].set(x, z, world.U.uTime.value, strength);
    };
    return { road, pave, paveMat, roadMat, addImpact: impact('uImpacts'), addBlast: impact('uBlasts') };
  },
};

// a flat quad (four corners in x, z) at y, facing up
export function quadGeo(a, b, c, d, y) {
  const pos = [a[0], y, a[1], b[0], y, b[1], c[0], y, c[1], a[0], y, a[1], c[0], y, c[1], d[0], y, d[1]];
  for (let i = 0; i < pos.length; i += 9) {
    const ux = pos[i + 3] - pos[i], uz = pos[i + 5] - pos[i + 2], vx = pos[i + 6] - pos[i], vz = pos[i + 8] - pos[i + 2];
    if (uz * vx - ux * vz < 0) for (let k = 0; k < 3; k++) { const t = pos[i + 3 + k]; pos[i + 3 + k] = pos[i + 6 + k]; pos[i + 6 + k] = t; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}
// (position + normal only, non-indexed: the city's pieces merged a bucket at a time)
export function mergeAll(list0) {
  const list = list0.map((g0) => { const g = g0.index ? g0.toNonIndexed() : g0; if (!g.getAttribute('normal')) g.computeVertexNormals(); return g; });
  let n = 0; for (const g of list) n += g.getAttribute('position').count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  let o = 0;
  for (const g of list) {
    pos.set(g.getAttribute('position').array, o * 3); nor.set(g.getAttribute('normal').array, o * 3);
    o += g.getAttribute('position').count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}

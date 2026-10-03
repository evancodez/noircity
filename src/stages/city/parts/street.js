import * as THREE from 'three';
import { LAYER, allocInkId } from '../../../render/layers.js';
import { makeGroundMaterial } from '../../../render/shaders/ground.js';
import { merge } from '../../../world/geom.js';
import { PAVE, SLABS, RIVER, RIVER_SAMPLES, riverFrame, riverPoint, EW, EW_LIST, CANAL, PIER, groundAt, WHARF_X } from '../plan.js';

// The city's ground (it is the stage's `street`: the footfalls' and the
// rounds' ripples, addImpact): the wet road, one shape over all the land
// from the canal to the depot and the rail yard to the quay (the
// wet-street shader: its puddles, its rings, every lamp's streak); the
// pavements raised PAVE on kerb stones (the blocks' rings, the yard road's
// west side, the canal's and the depot's, the river road's two); the land
// north of the canal. The walking surface is plan.groundAt.
const F = {};

// a flat ribbon along the river road from d0 to d1 (d + west), s0 .. s1
function riverRibbon(d0, d1, y, s0, s1, step = 3, skip = null) {
  const pos = [], idx = [];
  let n = 0;
  for (let s = s0; s <= s1 + 1e-6; s += step) {
    const sc = Math.min(s, s1);
    if (skip && skip(sc)) { n = 0; continue; }
    riverFrame(sc, F);
    for (const d of [d0, d1]) pos.push(F.x + F.rx * d, y, F.z + F.rz * d);
    const k = pos.length / 3 / 2 - 1;
    if (n > 0) { const a = (k - 1) * 2, b = k * 2; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    n++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // (the face must look up)
  const nz = g.getAttribute('normal');
  if (nz.count && nz.getY(0) < 0) { const I = g.index.array; for (let i = 0; i < I.length; i += 3) { const t = I[i + 1]; I[i + 1] = I[i + 2]; I[i + 2] = t; } g.computeVertexNormals(); }
  return g;
}
// a kerb's face along the river road at d (its top PAVE), facing the road
function riverKerb(d, s0, s1, skip = null) {
  const parts = [];
  for (let s = s0; s < s1; s += 3) {
    if (skip && skip(s + 1.5)) continue;
    const a = riverPoint(s, d), b = riverPoint(Math.min(s1, s + 3), d);
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const g = new THREE.BoxGeometry(len + 0.02, PAVE, 0.22);
    g.rotateY(Math.atan2(-(b.z - a.z), b.x - a.x));
    g.translate((a.x + b.x) / 2, PAVE / 2 - 0.002, (a.z + b.z) / 2);
    parts.push(g);
  }
  return parts;
}

export default {
  name: 'street', order: 20,
  build(stage) {
    const { scene, U, M } = stage;
    const roadMat = makeGroundMaterial(U, { paving: 0 }), paveMat = makeGroundMaterial(U, { paving: 1 });
    const mk = (geo, mat, name, ground = true) => {
      const m = new THREE.Mesh(geo, mat);
      if (ground) m.layers.set(LAYER.GROUND);
      m.receiveShadow = true;
      m.userData.inkId = allocInkId();
      m.name = name;
      scene.add(m);
      return m;
    };
    // the land: the canal's south edge, the quay's line south to the pier's
    // yard, round the yard, the depot and the yard beyond
    const sh = new THREE.Shape();
    const land = [[-700, CANAL.z0]];
    const RS = RIVER_SAMPLES;
    for (let i = 0; i <= RS.n; i += 4) { riverFrame(i, F); land.push([F.x - F.rx * RIVER.quay, F.z - F.rz * RIVER.quay]); }
    land.push([PIER.yard.x1, PIER.yard.z0 - 2], [PIER.yard.x1, PIER.yard.z1], [PIER.yard.x0 + 30, PIER.yard.z1 + 1], [PIER.yard.x0 + 30, 700], [-700, 700]);
    // (the shape is drawn in x, -z: rotated flat it lies in x, z)
    sh.moveTo(land[0][0], -land[0][1]);
    for (let i = 1; i < land.length; i++) sh.lineTo(land[i][0], -land[i][1]);
    sh.closePath();
    const landGeo = new THREE.ShapeGeometry(sh, 1).rotateX(-Math.PI / 2);
    const road = mk(landGeo, roadMat, 'cityGround');
    // north of the canal: the gasworks' ground
    const north = mk(new THREE.PlaneGeometry(1400, 600).rotateX(-Math.PI / 2).translate(-100, 0, CANAL.z1 - 300), roadMat, 'cityNorth');
    // the pavements: every slab a flat plane at PAVE, its kerb stones round it
    const paves = [], kerbs = [];
    const T = PAVE;
    for (const [x0, x1, z0, z1] of SLABS) {
      paves.push(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, T, (z0 + z1) / 2));
      const k = (w, d, x, z) => kerbs.push(new THREE.BoxGeometry(w, T, d).translate(x, T / 2 - 0.002, z));
      k(x1 - x0, 0.22, (x0 + x1) / 2, z0 + 0.11); k(x1 - x0, 0.22, (x0 + x1) / 2, z1 - 0.11);
      k(0.22, z1 - z0 - 0.44, x0 + 0.11, (z0 + z1) / 2); k(0.22, z1 - z0 - 0.44, x1 - 0.11, (z0 + z1) / 2);
    }
    // the river road's: the quay pavement east, the west pavement in front
    // of the wharf (broken where the streets come in)
    const crossing = (s) => { riverFrame(s, F); return EW_LIST.some((k) => Math.abs(F.z - EW[k].z) < EW[k].hw + 0.6); };
    const s1 = RS.n;
    paves.push(riverRibbon(-RIVER.hw, -RIVER.quay, T, 0, s1));
    paves.push(riverRibbon(RIVER.hw, RIVER.hw + RIVER.pw, T, 0, s1, 3, crossing));
    kerbs.push(...riverKerb(-RIVER.hw, 0, s1), ...riverKerb(RIVER.hw, 0, s1, crossing), ...riverKerb(RIVER.hw + RIVER.pw, 0, s1, crossing));
    const pave = mk(merge(paves), paveMat, 'cityPave');
    const kerb = mk(merge(kerbs), M.kerb, 'cityKerbs', false);
    kerb.receiveShadow = true;
    // the quay's face down to the water (seen from the bridge, the pier)
    const quay = [];
    for (let i = 0; i < RS.n; i += 4) {
      const a = riverPoint(i, -RIVER.quay), b = riverPoint(Math.min(RS.n, i + 4), -RIVER.quay);
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      quay.push(new THREE.BoxGeometry(len + 0.05, 2.6, 0.4).rotateY(Math.atan2(-(b.z - a.z), b.x - a.x)).translate((a.x + b.x) / 2 + 0.1, PAVE - 1.3, (a.z + b.z) / 2));
    }
    quay.push(new THREE.BoxGeometry(1400, 2.6, 0.4).translate(-100, PAVE - 1.3, CANAL.z0 - 0.2));
    quay.push(new THREE.BoxGeometry(1400, 2.6, 0.4).translate(-100, PAVE - 1.3, CANAL.z1 + 0.2));
    const quayM = mk(merge(quay), M.stone || M.kerb, 'cityQuay', false);
    stage.addSurface((x, z) => groundAt(x, z));
    void WHARF_X;
    const impact = (arrName) => (world, x, z, strength = 1) => {
      const arr = world.U[arrName].value;
      let oldest = 0;
      for (let i = 1; i < arr.length; i++) if (arr[i].z < arr[oldest].z) oldest = i;
      arr[oldest].set(x, z, world.U.uTime.value, strength);
    };
    return { road, north, pave, kerb, quay: quayM, addImpact: impact('uImpacts'), addBlast: impact('uBlasts') };
  },
};

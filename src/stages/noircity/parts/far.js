import * as THREE from 'three';
import { allocInkId } from '../../../render/layers.js';
import { farLot } from '../../../city/kits/facade.js';
import { LAMP, lampHead } from '../../../city/kits/street.js';
import { mergeAll } from './street.js';

// The far city (lane O1): what is always drawn, the whole city over, in
// tiles of TILE metres - every lot's mass (its tiers, parapet, roof, water
// tank, spire), its lit windows and lit shop fronts, every lamp's glowing
// mouth. The near chunks (stream.js) only add the relief on these masses,
// so the city never pops in: walking or driving, the blocks, their lights
// and the lamps down every street are there to the fog. A tile is a few
// meshes (three ink ids for its masses, alternating lots, so neighbours
// get a contour between them). The masses are the bullets' solids (a round
// stops in a wall anywhere in the city); they cast no lamp shadow (a tile
// is 240 m: every shadow map would draw it whole).
//   api: { tiles: [{ key, meshes, mid }], litMat, update(camera) }
export const TILE = 240;
const SHOW = 1200;
// position + colour, non-indexed
function mergeLit(list) {
  let n = 0; for (const g of list) n += g.getAttribute('position').count;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (const g of list) { pos.set(g.getAttribute('position').array, o * 3); col.set(g.getAttribute('color').array, o * 3); o += g.getAttribute('position').count; }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}

export default {
  name: 'far', order: 30,
  *buildSteps(stage) {
    const { scene, M } = stage;
    const C = stage.part('city').C;
    const group = new THREE.Group();
    group.name = 'farCity';
    scene.add(group);
    const stoneFar = new THREE.MeshStandardMaterial({ color: 0x232323, roughness: 0.9, envMap: M.envSoft, envMapIntensity: 0.2 });
    // the lights: a lit window a small pale pane, a shop front dimmer and wider
    // (a lit shop front is a big pane low in the frame: at 0.34 it printed as
    // a white slab), a lamp's mouth the bulb's white (M.bulb's 8)
    const LIT = 0.62, SHOP = 0.1, BULB = 8;
    const lightMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    const litMat = lightMat, shopMat = lightMat;
    const tiles = new Map();
    const tileOf = (x, z) => `${Math.floor(x / TILE)},${Math.floor(z / TILE)}`;
    C.lots.forEach((L, i) => {
      const k = tileOf(L.cx, L.cz);
      if (!tiles.has(k)) tiles.set(k, { key: k, out: {}, lamps: [] });
      farLot(L, tiles.get(k).out, i % 2);
    });
    yield;
    for (const l of C.lamps) {
      const k = tileOf(l.x, l.z);
      if (!tiles.has(k)) tiles.set(k, { key: k, out: {}, lamps: [] });
      tiles.get(k).lamps.push(l);
    }
    const list = [];
    const _q = new THREE.Quaternion(), _y = new THREE.Vector3(0, 1, 0), _m = new THREE.Matrix4(), _s = new THREE.Vector3(1, 1, 1);
    for (const T of tiles.values()) {
      const ids = allocInkId(3);
      const meshes = [];
      const mk = (geos, mat, id, ray) => {
        if (!geos || !geos.length) return null;
        const m = new THREE.Mesh(mergeAll(geos), mat);
        m.userData.inkId = id;
        m.receiveShadow = !!ray;
        if (!ray) m.userData.noRay = true;
        m.userData.surf = undefined;
        group.add(m);
        meshes.push(m);
        return m;
      };
      // (the roofs' pieces with the first group's masses: a draw saved a tile)
      mk([...(T.out.mass0 || []), ...(T.out.roof || [])], M.brickFar, ids, true);
      mk(T.out.mass1, M.brickFar, ids + 1, true);
      mk(T.out.stone0, stoneFar, ids, true); mk(T.out.stone1, stoneFar, ids + 1, true);
      // the lights in one mesh, each its own level (a vertex colour): the lit
      // windows, the lit shop fronts, the lamps' mouths (their posts are the near chunks')
      const lights = [];
      const tint = (geos, v) => { for (const g0 of geos || []) { const g = g0.index ? g0.toNonIndexed() : g0; const n = g.getAttribute('position').count; g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3).fill(v), 3)); lights.push(g); } };
      tint(T.out.lit, LIT); tint(T.out.shop, SHOP);
      tint(T.lamps.map((l) => {
        _q.setFromAxisAngle(_y, l.yaw);
        _m.compose(new THREE.Vector3(l.x, 0.15, l.z), _q, _s);
        return LAMP.bulb.clone().applyMatrix4(_m);
      }), BULB);
      if (lights.length) {
        const m = new THREE.Mesh(mergeLit(lights), lightMat);
        m.userData.inkId = ids + 2; m.userData.noRay = true;
        group.add(m); meshes.push(m);
      }
      const [i, j] = T.key.split(',').map(Number);
      const mid = new THREE.Vector3((i + 0.5) * TILE, 0, (j + 0.5) * TILE);
      list.push({ key: T.key, meshes, mid });
      yield;
    }
    void lampHead;
    const api = {
      group, tiles: list, litMat, shopMat,
      update(camera) {
        const p = camera.position;
        for (const t of list) {
          const v = Math.hypot(t.mid.x - p.x, t.mid.z - p.z) < SHOW;
          if (t._v === v) continue;
          t._v = v;
          for (const m of t.meshes) m.visible = v;
        }
      },
    };
    return api;
  },
  build(stage) { const it = this.buildSteps(stage); let r; while (!(r = it.next()).done); return r.value; },
  update: (f, dt, t, camera) => f.update(camera),
};

import * as THREE from 'three';
import { allocSkylineId } from '../../../render/layers.js';
import { merge } from '../../../world/geom.js';
import { Skyline, makeTowerMaterial } from '../../../world/Skyline.js';

// [C6 2nd] The city beyond the backlot: the block's towers (world/Skyline.js,
// flat fogged silhouettes with a few lit window flecks), in three rings round
// the backlot past its last walls - seen over the roofs from the roof row,
// down the avenue under the el, at the ends of the alleys and lanes (the
// reference's skyline: soft grey masses a little under the sky, never a
// cutout). The rings keep clear of the stage itself (the nearest is 230 m
// from its middle; the backlot is ~110 m across from there).
const CENTER = { x: 38, z: -62 };
const TONE = [0.31, 0.33, 0.34], HAZE = [0.1, 0.15, 0.2];

export default {
  name: 'skyline', order: 12,
  build(stage) {
    const group = new THREE.Group();
    group.name = 'backlotSkyline';
    stage.scene.add(group);
    const sk = Object.create(Skyline.prototype);
    Object.assign(sk, { world: stage, windows: [], _az: [], wrng: stage.rng.fork(6802), group });
    const rng = stage.rng.fork(6801);
    const rows = [
      { R: 235, n: 26, h: [45, 110], w: [16, 28] },
      { R: 330, n: 24, h: [70, 160], w: [18, 32] },
      { R: 470, n: 22, h: [110, 240], w: [24, 40] },
    ];
    rows.forEach((row, ri) => {
      const parts = [];
      for (let i = 0; i < row.n; i++) {
        const a = ((i + rng.range(0.1, 0.9)) / row.n) * Math.PI * 2;
        const R = row.R * rng.range(0.9, 1.12);
        const x = CENTER.x + Math.sin(a) * R, z = CENTER.z + Math.cos(a) * R;
        const h = rng.range(row.h[0], row.h[1]);
        if (rng.chance(0.35)) sk.slabTower(parts, rng, x, z, h * 0.9, rng.range(row.w[0], row.w[1]) * 1.2);
        else sk.tower(parts, rng, x, z, h, rng.range(row.w[0], row.w[1]) * 1.2, Math.min(3, ri + 1), false, 0);
      }
      const mesh = new THREE.Mesh(merge(parts), makeTowerMaterial(stage.U, TONE[ri], HAZE[ri]));
      mesh.userData.inkId = allocSkylineId();
      mesh.userData.noRay = true;
      mesh.frustumCulled = false;
      group.add(mesh);
    });
    sk.buildWindows();
    if (sk.windowMesh) sk.windowMesh.userData.noRay = true;
    return { group };
  },
};

// [O8] The physics layer off the page (node): a bare figure on the Hood's
// skeleton falls on a flat street (or a step, a wall), the ragdoll's numbers
// printed every tenth of a second - its speed, its lowest point, when it
// sleeps. For tuning without a browser:
//   node tools/o8/ragtest.mjs [push m/s] [wall x | -] [step]
import * as THREE from 'three';
import { JOINTS, OFFSET } from '../../src/enemies/HoodRig.js';
import { Ragdoll } from '../../src/cast/ragdoll.js';
import { getClips } from '../../src/enemies/HoodAnim.js';

const push = +(process.argv[2] || 2.3);
const wallX = process.argv[3] && process.argv[3] !== '-' ? +process.argv[3] : null;
const step = process.argv[4] === 'step';
const obj = new THREE.Group();
const bones = {};
for (const [name, parent] of JOINTS) {
  const b = new THREE.Bone(); b.name = name; b.position.copy(OFFSET[name]); bones[name] = b;
  if (parent) bones[parent].add(b);
}
obj.add(bones.root);
obj.scale.setScalar(1.0);
obj.updateMatrixWorld(true);
const boxes = wallX != null ? [{ cx: wallX - 0.5, cz: 0, hx: 0.5, hz: 5, c: 1, s: 0, tag: 'wall' }] : [];
const world = {
  surfaceY: (x, z) => (step && x > 0.4 ? 0.17 * Math.min(4, Math.floor((x - 0.4) / 0.3) + 1) : 0),
  colliders: { circles: [], boxes, near: () => boxes, regions: [] },
  game: null,
};
const fig = { world, scale: 1, bones, object: obj, pos: new THREE.Vector3(), yaw: 0, _vel: new THREE.Vector3(), anim: { clips: getClips() }, build: null };
const R = new Ragdoll(fig, { push: { v: new THREE.Vector3(-push, 0, 0), lo: 0.05, hi: 1, up: 0.4 }, clip: process.env.CLIP || null });
let t = 0;
for (let k = 0; k < 60 * 6; k++) {
  R.step(1 / 60);
  t += 1 / 60;
  if (k % 6 === 0) {
    let v = 0, lo = Infinity, hi = -Infinity;
    for (let i = 0; i < R.p.length; i++) { v = Math.max(v, R.p[i].distanceTo(R.o[i]) / (R._h || 1 / 60)); lo = Math.min(lo, R.p[i].y - R.r[i]); hi = Math.max(hi, R.p[i].y); }
    let wi = 0, wv = 0; for (let i = 0; i < R.p.length; i++) { const q = R.p[i].distanceTo(R.o[i]); if (q > wv) { wv = q; wi = i; } }
    console.log(t.toFixed(2), "worst", wi, "v", v.toFixed(2), 'lo', lo.toFixed(3), 'hi', hi.toFixed(2), 'pv', R.p[0].x.toFixed(2), R.p[0].y.toFixed(2), R.p[0].z.toFixed(2), R.asleep ? 'ASLEEP' : '', R.facing());
  }
  if (R.asleep) break;
}

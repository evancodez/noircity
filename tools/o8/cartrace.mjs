import * as THREE from 'three';
import { JOINTS, OFFSET } from '../../src/enemies/HoodRig.js';
import { Ragdoll, PTS } from '../../src/cast/ragdoll.js';
import { getClips } from '../../src/enemies/HoodAnim.js';
const sp = 50 / 3.6;
const obj = new THREE.Group(); const bones = {};
for (const [name, parent] of JOINTS) { const b = new THREE.Bone(); b.name = name; b.position.copy(OFFSET[name]); bones[name] = b; if (parent) bones[parent].add(b); }
obj.add(bones.root); obj.updateMatrixWorld(true);
const car = { pos: new THREE.Vector3(-2.45 - 0.3, 0, 0), yaw: 0, vel: new THREE.Vector3(sp, 0, 0), spec: { halfL: 2.45, halfW: 0.95 } };
const world = { surfaceY: () => 0, colliders: { circles: [], boxes: [], near: () => [], regions: [] }, game: { vehicles: { list: [car] } } };
const fig = { world, scale: 1, bones, object: obj, pos: new THREE.Vector3(), yaw: -Math.PI / 2, _vel: new THREE.Vector3(), anim: { clips: getClips() }, build: null };
const R = new Ragdoll(fig, { clip: process.env.CLIP || null, follow: 0 });
const h = 1 / 480;
for (let k = 0; k < 40; k++) {
  car.pos.x += car.vel.x * h;
  R.step(h);
  const row = PTS.map(([id], i) => `${id}:${R.p[i].x.toFixed(2)},${R.p[i].y.toFixed(2)}`).join(' ');
  if (k % 4 === 0) console.log(k, 'front', (car.pos.x + 2.45).toFixed(3), row);
}

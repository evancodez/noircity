// [O8] a car into a standing man off the page (node): the ragdoll's numbers
//   node tools/o8/cartest.mjs [km/h]
import * as THREE from 'three';
import { JOINTS, OFFSET } from '../../src/enemies/HoodRig.js';
import { Ragdoll } from '../../src/cast/ragdoll.js';
import { getClips } from '../../src/enemies/HoodAnim.js';
const kmh = +(process.argv[2] || 50), sp = kmh / 3.6;
const obj = new THREE.Group(); const bones = {};
for (const [name, parent] of JOINTS) { const b = new THREE.Bone(); b.name = name; b.position.copy(OFFSET[name]); bones[name] = b; if (parent) bones[parent].add(b); }
obj.add(bones.root); obj.updateMatrixWorld(true);
const car = { pos: new THREE.Vector3(-2.45 - 0.3, 0, 0), yaw: 0, vel: new THREE.Vector3(sp, 0, 0), spec: { halfL: 2.45, halfW: 0.95 } };
const world = { surfaceY: () => 0, colliders: { circles: [], boxes: [], near: () => [], regions: [] }, game: { vehicles: { list: [car] } } };
const fig = { world, scale: 1, bones, object: obj, pos: new THREE.Vector3(), yaw: -Math.PI / 2, _vel: new THREE.Vector3(), anim: { clips: getClips() }, build: null };
const R = new Ragdoll(fig, { push: { v: new THREE.Vector3(sp * (+process.env.K || 1.05), 0, 0), lo: +(process.env.LO || 1), hi: +(process.env.HI || 0.3), up: (+process.env.UP || 0.07) * sp }, clip: 'deathBack', follow: 0 });
let t = 0, top = 0;
for (let k = 0; k < 60 * 5; k++) {
  const h = 1 / 60;
  if (car.pos.x > 6) car.vel.x = Math.max(0, car.vel.x - 9 * h);
  car.pos.x += car.vel.x * h;
  R.step(h); t += h;
  if (process.env.DBGV && k < 14) { let wi = 0, wv = -1e9; R.p.forEach((q, i) => { const vy = (q.y - R.o[i].y) / R._h; if (vy > wv) { wv = vy; wi = i; } }); console.log("k", k, "up", wi, wv.toFixed(2), "y", R.p[wi].y.toFixed(2), "x", R.p[wi].x.toFixed(2), "car front", (car.pos.x + 2.45).toFixed(2)); }
  let hi = 0; for (const p of R.p) hi = Math.max(hi, p.y); top = Math.max(top, hi);
  if (k % 6 === 0) console.log(t.toFixed(2), 'car', car.pos.x.toFixed(1), 'pv', R.p[0].x.toFixed(2), R.p[0].y.toFixed(2), 'hi', hi.toFixed(2), 'hd', R.p[3].x.toFixed(2), R.p[3].y.toFixed(2), R.asleep ? 'ASLEEP' : '');
  if (R.asleep) break;
}
console.log('top', top.toFixed(2));

// Headless check of the Hood gaits (src/enemies/HoodAnim.js): the legs are
// solved with IK, so (1) the ankle must reach its target exactly and (2) during
// stance the foot's ground contact (heel, then sole, then ball) must stay fixed
// in the world while the root advances at the clip's speed (no foot sliding).
//   node tools/gaittest.mjs
import * as THREE from 'three';
import { solvePose, OFFSET, ANKLE_Y } from '../src/enemies/HoodRig.js';
import { _gait, WALK, RUN } from '../src/enemies/HoodAnim.js';

function fkFoot(S, side) {
  const chain = ['hips', 'thigh' + side, 'shin' + side, 'foot' + side];
  let q = S.q.hips.clone();
  const p = S.hipsPos.clone();
  for (let i = 1; i < chain.length; i++) {
    p.add(OFFSET[chain[i]].clone().applyQuaternion(q));
    q = q.clone().multiply(S.q[chain[i]]);
  }
  const heel = p.clone().add(new THREE.Vector3(0, -ANKLE_Y, -0.065).applyQuaternion(q));
  const ball = p.clone().add(new THREE.Vector3(0, -ANKLE_Y, 0.13).applyQuaternion(q));
  return { ankle: p, heel, ball };
}

for (const [name, G, D] of [['walk', _gait.WALK_G, WALK], ['run', _gait.RUN_G, RUN]]) {
  const N = 400;
  let maxErr = 0, maxSlide = 0;
  const prev = { L: null, R: null };
  for (let i = 0; i <= N; i++) {
    const ph = i / N;
    const P = _gait.gaitPose(ph, G);
    const S = solvePose(P);
    const t = ph * D.T;
    for (const [side, off] of [['L', 0], ['R', 0.5]]) {
      const p = (ph + off) % 1;
      const { ankle, heel, ball } = fkFoot(S, side);
      maxErr = Math.max(maxErr, ankle.distanceTo(new THREE.Vector3(...P['foot' + side])));
      if (p >= G.beta) { prev[side] = null; continue; }        // swing
      // the lower of heel / ball is the contact; its world x-z must not move
      const c = heel.y <= ball.y + 1e-4 ? heel : ball;
      const w = new THREE.Vector3(c.x, 0, c.z + D.speed * t);
      const key = heel.y <= ball.y + 1e-4 ? 'h' : 'b';
      if (prev[side] && prev[side].key === key) maxSlide = Math.max(maxSlide, w.distanceTo(prev[side].w));
      prev[side] = { w, key };
    }
  }
  console.log(`${name}: max IK error ${(maxErr * 1000).toFixed(2)} mm, max stance slide per step ${(maxSlide * 1000).toFixed(2)} mm (root moves ${(D.speed * D.T / N * 1000).toFixed(1)} mm per step)`);
}

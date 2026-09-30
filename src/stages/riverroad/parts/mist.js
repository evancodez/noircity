import * as THREE from 'three';
import { GroundMist } from '../../../fx/GroundMist.js';

// the lit ground mist down the road ahead: the block's box (its shader
// reads its bounds in world space), carried 30 .. 150 m ahead of the eye
export default {
  name: 'mist', order: 100, tick: 100,
  build(stage) {
    const m = new GroundMist(stage, { min: new THREE.Vector3(-60, 0, -60), max: new THREE.Vector3(60, 3.2, 60), intensity: 0.8 });
    m.fwd = new THREE.Vector3();
    return m;
  },
  update(m, dt, t, camera) {
    camera.getWorldDirection(m.fwd);
    m.fwd.y = 0; m.fwd.normalize();
    const c = camera.position;
    const cx = c.x + m.fwd.x * 90, cz = c.z + m.fwd.z * 90;
    m.mesh.position.set(cx, 1.6, cz);
    const U = m.material.uniforms;
    U.uMin.value.set(cx - 60, 0, cz - 60); U.uMax.value.set(cx + 60, 3.2, cz + 60);
  },
};

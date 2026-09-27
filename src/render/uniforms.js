import * as THREE from 'three';
import { fogUniforms } from './fog.js';
import { MAX_LAMPS } from './shaders/common.js';
import { makeGroundUniformsShared } from './shaders/ground.js';

// One bag of uniform objects shared (by reference) between the pipeline and
// every custom world shader. Materials spread it into their own uniforms, so
// updating a value here updates it everywhere with no per-material plumbing.
export function createSharedUniforms(tex) {
  const lampPos = [], lampDir = [], lampParams = [];
  for (let i = 0; i < MAX_LAMPS; i++) {
    lampPos.push(new THREE.Vector3());
    lampDir.push(new THREE.Vector3(0, -1, 0));
    lampParams.push(new THREE.Vector4(1, 0, 0, 0));
  }
  return {
    uTime: { value: 0 },
    uLightning: { value: 0 },
    tDepth: { value: null },          // opaque scene depth (normal/id pass)
    tNormalId: { value: null },       // normal/id pass colour (w = ink id; < 0 = figure)
    uRes: { value: new THREE.Vector2(1, 1) },
    uNear: { value: 0.1 },
    uFar: { value: 1500 },
    uUseDepth: { value: 1 },          // 0 during the reflection pass
    uLampPos: { value: lampPos },
    uLampDir: { value: lampDir },
    uLampParams: { value: lampParams },
    uLampCount: { value: 0 },
    ...fogUniforms,
    ...makeGroundUniformsShared(tex),
  };
}

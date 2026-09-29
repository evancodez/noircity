import * as THREE from 'three';
import { fogUniforms } from './fog.js';
import { MAX_LAMPS } from './shaders/common.js';
import { makeGroundUniformsShared } from './shaders/ground.js';
import { bindGlassUniforms } from './glass.js';

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
  const U = {
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
    // the Look (Pipeline.applyLook): the 3D rain's gain, the room smoke in
    // the lamp cones, and the dry volumes (stage.dry, up to 4 boxes; an
    // empty slot is an inverted box that holds nothing)
    uRain3d: { value: 1 },
    uHaze: { value: 0 },
    uDryMin: { value: [0, 1, 2, 3].map(() => new THREE.Vector3(1e5, 1e5, 1e5)) },
    uDryMax: { value: [0, 1, 2, 3].map(() => new THREE.Vector3(-1e5, -1e5, -1e5)) },
    ...fogUniforms,
    ...makeGroundUniformsShared(tex),
  };
  // (glass, window light and rooms take their clock, lamps and fog from here)
  bindGlassUniforms(U);
  return U;
}

import * as THREE from 'three';
import { LAYER } from '../render/layers.js';
import { makeMistMaterial } from '../render/shaders/mist.js';

// The lit ground mist at the far end of the avenue (see render/shaders/mist.js).
// One proxy box drawn with its back faces into the volume pass only (its own
// MIST layer: the planar reflection does not see it, Pipeline §2).
export class GroundMist {
  constructor(world, { min = new THREE.Vector3(-11, 0, -175), max = new THREE.Vector3(21, 3.2, -12), intensity = 1.0 } = {}) {
    const size = new THREE.Vector3().subVectors(max, min);
    const center = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5);
    this.material = makeMistMaterial(world.U, { min, max, intensity });
    this.mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), this.material);
    this.mesh.position.copy(center);
    this.mesh.layers.set(LAYER.MIST);
    this.mesh.renderOrder = 4;
    this.mesh.frustumCulled = false;
    world.scene.add(this.mesh);
  }
}

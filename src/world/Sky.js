import * as THREE from 'three';
import { LAYER } from '../render/layers.js';
import { makeSkyMaterial } from '../render/shaders/sky.js';

// Sky dome that follows the camera (drawn first, no depth write).
export class Sky {
  constructor(world) {
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 24), makeSkyMaterial(world.U));
    this.mesh.layers.set(LAYER.SKY);   // never in the street's reflection
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -100;
    world.scene.add(this.mesh);
  }
  update(camera) { this.mesh.position.copy(camera.position); }
}

import * as THREE from 'three';
import { LAYER } from '../render/layers.js';
import { makeSteamMaterial } from '../render/shaders/steam.js';

// Steam columns rising from the street grates. GPU-animated instanced puffs;
// the CPU only sets the vent list once. `puff(i)` (Phase 3) can boost a vent.
export class Steam {
  constructor(world, vents, perVent = 34) {
    const rng = world.rng.fork(91);
    const n = vents.length * perVent;
    const base = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute('position', base.getAttribute('position'));
    geo.setAttribute('uv', base.getAttribute('uv'));
    const seed = new Float32Array(n * 4), origin = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = vents[Math.floor(i / perVent)];
      seed[i * 4] = rng.next();
      seed[i * 4 + 1] = rng.range(3.5, 6.0);
      seed[i * 4 + 2] = rng.next();
      seed[i * 4 + 3] = rng.next();
      origin[i * 3] = v.x + rng.range(-0.5, 0.5);
      origin[i * 3 + 1] = v.y;
      origin[i * 3 + 2] = v.z + rng.range(-0.35, 0.35);
    }
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4));
    geo.setAttribute('aOrigin', new THREE.InstancedBufferAttribute(origin, 3));
    geo.instanceCount = n;
    this.material = makeSteamMaterial(world.U, world.tex.puff);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.layers.set(LAYER.FX_REFL);
    this.mesh.renderOrder = 8;
    world.scene.add(this.mesh);
  }
}

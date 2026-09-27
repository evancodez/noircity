import * as THREE from 'three';
import { LAYER } from '../render/layers.js';
import { makeRainMaterial, makeSplashMaterial } from '../render/shaders/rain.js';

// 3D rain streaks + ground splash rings, all animated in the vertex shader.
export class Rain {
  constructor(world, count = 20000, splashes = 700) {
    const rng = world.rng.fork(33);
    const mk = (n, geoBase, mat) => {
      const geo = new THREE.InstancedBufferGeometry();
      geo.index = geoBase.index;
      geo.setAttribute('position', geoBase.getAttribute('position'));
      geo.setAttribute('uv', geoBase.getAttribute('uv'));
      const seed = new Float32Array(n * 4);
      for (let i = 0; i < n * 4; i++) seed[i] = rng.next();
      geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4));
      geo.instanceCount = n;
      const m = new THREE.Mesh(geo, mat);
      m.frustumCulled = false;
      m.layers.set(LAYER.RAIN);
      m.renderOrder = 10;
      world.scene.add(m);
      return m;
    };
    this.rainMat = makeRainMaterial(world.U);
    this.splashMat = makeSplashMaterial(world.U);
    this.streaks = mk(count, new THREE.PlaneGeometry(1, 1), this.rainMat);
    this.splash = mk(splashes, new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), this.splashMat);
    this._fwd = new THREE.Vector3();
  }

  update(camera, pixelHeight) {
    camera.getWorldDirection(this._fwd);
    this._fwd.y = 0;
    this._fwd.normalize();
    const u = this.rainMat.uniforms;
    u.uBoxCenter.value.copy(camera.position).addScaledVector(this._fwd, 12);
    u.uBoxCenter.value.y = 7;
    // the streaks are drawn into the full-res rain buffer: size them in its pixels
    u.uPixelAngle.value = THREE.MathUtils.degToRad(camera.fov) / Math.max(1, pixelHeight);
    this.splashMat.uniforms.uCenter.value.copy(camera.position).addScaledVector(this._fwd, 9);
  }
}

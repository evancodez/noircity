import * as THREE from 'three';
import { LAYER, allocInkId } from '../render/layers.js';
import { groundY } from './ground.js';

// Spent .45 ACP cases: thrown up and to the right from the Tommy gun's
// ejection port (reprojected from the viewmodel into the world), tumbling,
// bouncing on the wet street with a tick (a tiny ripple ring, and an onTick
// hook for the Phase 3 audio), then lying there a while. One instanced draw.
const MAX = 64;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _e = new THREE.Euler();

export class Casings {
  constructor(world) {
    this.world = world;
    this.rng = world.rng.fork(521);
    const geo = new THREE.CylinderGeometry(0.0058, 0.0058, 0.0228, 12, 1);
    geo.rotateZ(Math.PI / 2);   // lies along x
    // inked, not rendered: a dark matte case that prints as a black tick with
    // at most a rim glint (a glossy metal case printed as a CG-shaded tube
    // with a white cap). It joins the WORLD layer so the
    // id pass sees it and the ink pass treats it as a small figure.
    const mat = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.9, metalness: 0.0 });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.layers.set(LAYER.FX_REFL);
    this.mesh.layers.enable(LAYER.WORLD);
    this.mesh.userData.inkId = allocInkId();
    this.mesh.userData.inkFigure = true;
    this.mesh.userData.inkPerInstance = false;
    this.mesh.castShadow = false;
    this.mesh.name = 'casings';
    world.scene.add(this.mesh);
    this.list = [];
    this.onTick = null;
    this.ticks = 0;
  }

  eject(pos, right, up, fwd) {
    const r = this.rng;
    let c;
    if (this.list.length >= MAX) c = this.list.shift();
    else c = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), rot: new THREE.Euler(), spin: new THREE.Vector3() };
    c.pos.copy(pos);
    c.vel.copy(right).multiplyScalar(r.range(1.6, 2.6)).addScaledVector(up, r.range(1.4, 2.4)).addScaledVector(fwd, r.range(-0.6, 0.2));
    c.rot.set(r.next() * 6, r.next() * 6, r.next() * 6);
    c.spin.set(r.gauss() * 25, r.gauss() * 25, r.gauss() * 25);
    c.age = 0;
    c.bounces = 0;
    c.rest = false;
    this.list.push(c);
  }

  update(dt) {
    const L = this.list;
    let w = 0;
    for (let i = 0; i < L.length; i++) {
      const c = L[i];
      c.age += dt;
      if (c.age > 9) continue;
      if (!c.rest) {
        c.vel.y -= 9.8 * dt;
        c.pos.addScaledVector(c.vel, dt);
        c.rot.x += c.spin.x * dt; c.rot.y += c.spin.y * dt; c.rot.z += c.spin.z * dt;
        const gy = groundY(this.world, c.pos.x, c.pos.z) + 0.006;
        if (c.pos.y < gy) {
          c.pos.y = gy;
          if (c.vel.y < -0.6 && c.bounces < 3) {
            c.vel.y *= -0.32;
            c.vel.x *= 0.55; c.vel.z *= 0.55;
            c.spin.multiplyScalar(0.5);
            c.bounces++;
            this.ticks++;
            if (c.bounces === 1 && gy < 0.05) this.world.street.addImpact(this.world, c.pos.x, c.pos.z, 0.12);
            if (this.onTick) this.onTick(c.pos, c.bounces);
          } else {
            // settle lying down on its side
            c.rest = true;
            c.rot.x = 0; c.rot.z = 0;
          }
        }
      }
      L[w++] = c;
    }
    L.length = w;
    for (let i = 0; i < w; i++) {
      const c = L[i];
      _q.setFromEuler(c.rot);
      _m.compose(c.pos, _q, _s);
      this.mesh.setMatrixAt(i, _m);
    }
    this.mesh.count = w;
    if (w) this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear() { this.list.length = 0; this.mesh.count = 0; }
}

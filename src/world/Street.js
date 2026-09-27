import * as THREE from 'three';
import { LAYER, tagInk, allocInkId } from '../render/layers.js';
import { makeGroundMaterial } from '../render/shaders/ground.js';
import { smoothNormals } from './geom.js';

// Street layout constants shared by the other world modules.
export const STREET = {
  kerbX: -6.0,          // road / left pavement edge
  facadeX: -10.2,       // left building line
  pavementTop: 0.15,
  rightKerbX: 17.0,     // right pavement edge (behind the overpass)
  zNear: 70,
  zFar: -420,
};

export class Street {
  constructor(world) {
    const { scene, U, M } = world;
    this.road = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400, 1, 1).rotateX(-Math.PI / 2), makeGroundMaterial(U, { paving: 0 }));
    this.road.position.set(0, 0, -200);
    this.road.receiveShadow = true;
    this.road.layers.set(LAYER.GROUND);
    this.road.userData.inkId = allocInkId();
    this.road.name = 'street';
    scene.add(this.road);

    const paveMat = makeGroundMaterial(U, { paving: 1 });
    const len = STREET.zNear - STREET.zFar;
    const zc = (STREET.zNear + STREET.zFar) / 2;
    // left pavement
    const lw = STREET.kerbX - STREET.facadeX + 0.4;
    this.paveL = new THREE.Mesh(new THREE.PlaneGeometry(lw, len).rotateX(-Math.PI / 2), paveMat);
    this.paveL.position.set(STREET.facadeX - 0.4 + lw / 2, STREET.pavementTop, zc);
    // right pavement
    this.paveR = new THREE.Mesh(new THREE.PlaneGeometry(14, len).rotateX(-Math.PI / 2), paveMat);
    this.paveR.position.set(STREET.rightKerbX + 7, STREET.pavementTop, zc);
    for (const p of [this.paveL, this.paveR]) {
      p.receiveShadow = true;
      p.layers.set(LAYER.GROUND);
      p.userData.inkId = allocInkId();
      scene.add(p);
    }

    // kerb stones: rounded profile extruded along the street
    const kerbGeo = (sign) => {
      const s = new THREE.Shape();
      const h = STREET.pavementTop - 0.003;
      s.moveTo(-0.3 * sign, -0.05);
      s.lineTo(0.0, -0.05);
      s.lineTo(0.0, h - 0.04);
      s.quadraticCurveTo(0.0, h, -0.04 * sign, h);
      s.lineTo(-0.3 * sign, h);
      s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false, curveSegments: 6 });
      return smoothNormals(g, 1e-3);
    };
    const kerbL = new THREE.Mesh(kerbGeo(1), M.kerb);
    kerbL.position.set(STREET.kerbX, 0, STREET.zFar);
    const kerbR = new THREE.Mesh(kerbGeo(-1), M.kerb);
    kerbR.position.set(STREET.rightKerbX, 0, STREET.zFar);
    for (const k of [kerbL, kerbR]) {
      k.receiveShadow = true;
      tagInk(k);
      scene.add(k);
    }
    world.colliders.setBounds(STREET.facadeX + 0.5, STREET.rightKerbX + 1.5, -118, 30);
  }

  // footstep / bullet ripple on the wet street
  addImpact(world, x, z, strength = 1) {
    const arr = world.U.uImpacts.value;
    let oldest = 0;
    for (let i = 1; i < arr.length; i++) if (arr[i].z < arr[oldest].z) oldest = i;
    arr[oldest].set(x, z, world.U.uTime.value, strength);
  }

  // an explosion's shockwave: one bold ring with a bright crest (ground.js
  // blastRings), strength ~3 (x a bullet ring's amplitude)
  addBlast(world, x, z, strength = 3) {
    const arr = world.U.uBlasts.value;
    let oldest = 0;
    for (let i = 1; i < arr.length; i++) if (arr[i].z < arr[oldest].z) oldest = i;
    arr[oldest].set(x, z, world.U.uTime.value, strength);
  }
}

// Height of the walking surface at x (the pavements are raised; the kerb step
// is smoothed over 25 cm, as the player's Controller does it).
export function groundAt(x) {
  const ss = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const l = 1 - ss(STREET.kerbX - 0.12, STREET.kerbX + 0.12, x);
  const r = ss(STREET.rightKerbX - 0.12, STREET.rightKerbX + 0.12, x);
  return STREET.pavementTop * Math.max(l, r);
}

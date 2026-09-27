import * as THREE from 'three';
import { FOG } from '../render/fog.js';
import { makeMaterials } from './materials.js';
import { LightRegistry } from './Lights.js';
import { Colliders } from './Colliders.js';
import { Street } from './Street.js';
import { Facade } from './Facade.js';
import { Overpass } from './Overpass.js';
import { Lamps } from './Lamps.js';
import { Skyline } from './Skyline.js';
import { Cars } from './Cars.js';
import { Props } from './Props.js';
import { Rain } from './Rain.js';
import { Sky } from './Sky.js';
import { Steam } from '../fx/Steam.js';
import { GroundMist } from '../fx/GroundMist.js';

// Assembles the block. Hooks for later phases:
//   world.update(dt, t, camera)     — call once per fixed step
//   world.lights                    — registry that rain/steam/rim read
//   world.colliders                 — XZ collision (player, Hoods)
//   world.flash                     — PointLight for muzzle flashes (intensity 0 at rest)
//   world.street.addImpact(world, x, z, s) — ripple ring on the wet street
//   world.solids                    — meshes for bullet raycasts
export class World {
  constructor({ renderer, scene, U, tex, rng }) {
    this.renderer = renderer;
    this.scene = scene;
    this.U = U;
    this.tex = tex;
    this.rng = rng;
    this.time = 0;
    this.M = makeMaterials(renderer, tex);
    this.lights = new LightRegistry(U);
    this.colliders = new Colliders();

    scene.fog = new THREE.FogExp2(FOG.color.clone(), FOG.density);
    // dim cool paper-tone ambient: keeps unlit iron black but not dead
    this.hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.0);
    // (lifted so the lighter-albedo surfaces - the stone façade, pavement -
    // print as dark grey with texture rather than dead black; the iron, paint
    // and asphalt albedos are dark enough that they still print as ink)
    this.hemi.color.setScalar(1.0);
    this.hemi.groundColor.setScalar(0.3);
    this.hemi.intensity = 1.0;
    scene.add(this.hemi);
    // Phase 2 hook: one pre-allocated point light for muzzle flashes, so
    // flashing it never changes the light count (no shader recompiles).
    this.flash = new THREE.PointLight(0xffffff, 0, 18, 2);
    this.flash.position.set(0, -50, 0);
    scene.add(this.flash);

    this.sky = new Sky(this);
    this.street = new Street(this);
    this.overpass = new Overpass(this);
    this.facade = new Facade(this);
    this.lamps = new Lamps(this);
    this.skyline = new Skyline(this);
    this.cars = new Cars(this);
    this.props = new Props(this);
    this.steam = new Steam(this, this.props.vents);
    this.mist = new GroundMist(this);
    this.rain = new Rain(this);

    this.solids = [];
    scene.traverse((o) => { if (o.isMesh && o.layers.mask & 3 && !o.isInstancedMesh) this.solids.push(o); });
    this._rim = [];
  }

  update(dt, t, camera, pixelHeight = 1000) {
    this.time = t;
    this.U.uTime.value = t;
    this.sky.update(camera);
    this.lamps.update(dt, t, camera);
    this.rain.update(camera, pixelHeight);
    const sorted = this.lights.sync(camera.position);
    // the 4 nearest lamps drive the ink pass' white rim light
    this._rim.length = 0;
    for (let i = 0; i < sorted.length && this._rim.length < 4; i++) {
      this._rim.push({ position: sorted[i].position, strength: sorted[i].intensity });
    }
    this.U.uFogColor.value.copy(this.scene.fog.color);
    this.U.uFogDensity.value = this.scene.fog.density;
  }

  get rimLamps() { return this._rim; }
}

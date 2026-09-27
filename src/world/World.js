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
import { Train } from './Train.js';
import { Sky } from './Sky.js';
import { Steam } from '../fx/Steam.js';
import { GroundMist } from '../fx/GroundMist.js';
import { Hoods } from '../enemies/Hood.js';

// Assembles the block. Hooks for later phases:
//   world.update(dt, t, camera)     — call once per fixed step
//   world.lights                    — registry that rain/steam/rim read
//   world.colliders                 — XZ collision (player, Hoods)
//   world.flash                     — PointLight for muzzle flashes (intensity 0 at rest)
//   world.street.addImpact(world, x, z, s) — ripple ring on the wet street
//   world.solids                    — meshes for bullet raycasts (+ Hood hit volumes,
//                                     userData.joint / userData.hood)
//   world.hoods                     — the Hoods (enemies/Hood.js): spawn(pos, variant)
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
    // Phase 3a: the explosion's flash and the burning wrecks' fire lights,
    // pre-allocated at intensity 0 for the same reason (a constant light
    // count: no program recompiles when a car goes up)
    // (every extra light is paid by every lit pixel of every lit material -
    // five of them cost a third of the frame - so: the blast borrows the
    // muzzle-flash light, the nearest fire gets the one new light, and the
    // Hoods' flash pool gives one up for it: the light count is Phase 2's)
    const pl = (hex, dist) => { const L = new THREE.PointLight(hex, 0, dist, 2); L.position.set(0, -50, 0); scene.add(L); return L; };
    this.fxLights = { blast: this.flash, fire: [pl(0xffffff, 24)] };
    // (a pale warm white: lit stone, iron and car bodies stay ink - a
    // saturated orange light printed every lit edge as an orange outline;
    // the colour lives in the flames and their column in the wet street)
    for (const L of this.fxLights.fire) L.color.setRGB(1.0, 0.87, 0.76);

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
    // Phase 3a: the el train (driven by the Game: world/Train.js)
    this.train = new Train(this);
    this.fxRef = null;       // the Game's effects (sparks for the train's wheels)

    this.solids = [];
    scene.traverse((o) => { if (o.isMesh && o.layers.mask & 3 && !o.isInstancedMesh && !o.userData.noRay) this.solids.push(o); });
    this._rim = [];
    this.hoods = new Hoods(this);
  }

  update(dt, t, camera, pixelHeight = 1000) {
    this.time = t;
    this.U.uTime.value = t;
    this.sky.update(camera);
    this.lamps.update(dt, t, camera);
    this.rain.update(camera, pixelHeight);
    this.hoods.update(dt, t, camera);
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

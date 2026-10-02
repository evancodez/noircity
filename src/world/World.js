import * as THREE from 'three';
import { FOG } from '../render/fog.js';
import { EXPOSURE } from '../render/tone.js';
import { makeMaterials } from './materials.js';
import { LightRegistry } from './Lights.js';
import { Colliders } from './Colliders.js';
import { Hoods } from '../enemies/Hood.js';
import { RayWorld } from '../util/RayWorld.js';
import { NavGrid } from '../enemies/Nav.js';
import { CoverSet } from '../enemies/HoodAI.js';
import { Fx } from '../fx/Fx.js';
import { React } from '../fx/React.js';
import { Glass } from '../destruct/Glass.js';
import { Breakables } from '../destruct/Breakables.js';
import { Cast } from '../cast/Cast.js';

// The Stage: a place (docs/story/CONTRACTS.md §2.2). This base holds the
// engine services every place has; the place itself is assembled from PARTS
// (src/stages/<stage>/parts/*.js, each `export default { name, order,
// build(stage) -> api }`), built in `order`. The block (src/stages/block/)
// is the first stage.
//
//   stage.update(dt, t, camera)     once per fixed step
//   stage.lights                    the registry that rain / steam / rim read
//   stage.colliders                 XZ collision (player, Hoods): real boxes
//                                   for walls, setBounds only an outer net
//   stage.solids                    meshes for bullet raycasts (+ Hood hit
//                                   volumes, userData.joint / userData.hood):
//                                   addSolid(mesh) / removeSolid(mesh)
//   stage.flash, stage.fxLights     pre-allocated lights (muzzle flash, blast,
//                                   fire): the light count never changes
//   stage.street                    { addImpact(stage, x, z, s), addBlast(...) }:
//                                   the street part's, a no-op without one
//   stage.hoods                     the Hoods (enemies/Hood.js): spawn(pos, variant)
//   stage.cast                      every figure (src/cast/Cast.js): spawn(kind, opts)
//   stage.glass, stage.breakables   the panes and the things that break
//                                   (src/destruct/): a part registers its own
//   stage.part(name)                the api a part's build() returned (also
//                                   stage[name], the old World's fields)
//   stage.anchor(name)              a named place: { pos, yaw, ... }
//   stage.surfaceY(x, z)            the walking surface (kerbs, floors, steps)
//   stage.dry                       Box3[]: volumes the rain never enters
//   stage.look / lookAt(pos)        the place's Look (§9.1)
// The place's own systems are built with it, once its parts stand: the ray
// world, the nav grid and cover set, the effects (fx); its reactions (react)
// on the first bind(game). The player's and the machine's systems (hands,
// weapons, health, HUD, sound, the pipeline) are the Game's.

// Today's frame (render/fog.js, render/tone.js): the block's exterior
const BASE_LOOK = {
  fogDensity: FOG.density, fogColor: FOG.color.clone(), exposure: EXPOSURE,
  rainOverlay: 1, rain3d: 1, grain: 1, ambient: 1, reflect: 'street', haze: 0,
  // (the sound of the place: sfx.room(name) follows the Look the eye is in)
  room: 'street',
};
// (a stage without a street part: impacts and blasts fall on nothing)
const NO_STREET = { addImpact() {}, addBlast() {} };

export class Stage {
  constructor({ name, renderer, scene = null, U, tex, rng, parts = [], look = null, deferred = false }) {
    this.name = name;
    this.renderer = renderer;
    this.scene = scene || new THREE.Scene();
    this.U = U;
    this.tex = tex;
    this.rng = rng;
    this.time = 0;
    this.M = makeMaterials(renderer, tex);
    this.lights = new LightRegistry(U);
    this.colliders = new Colliders();
    this.anchors = new Map();
    this.dry = [];
    this.look = { ...BASE_LOOK, ...(look || {}) };
    this.lookVolumes = [];     // [{ box: Box3, look }]: lookAt() picks the one the eye is in
    this.street = NO_STREET;
    this.surfaces = [];        // (x, z) -> y | undefined, the last to answer wins
    this.lodHooks = { refl: [], shadow: [] };
    this.fxRef = null;         // the stage's effects (sparks for the train's wheels)
    scene = this.scene;

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
    // one pre-allocated point light for muzzle flashes, so flashing it never
    // changes the light count (no shader recompiles)
    this.flash = new THREE.PointLight(0xffffff, 0, 18, 2);
    this.flash.position.set(0, -50, 0);
    scene.add(this.flash);
    // the explosion's flash and the burning wrecks' fire lights,
    // pre-allocated at intensity 0 for the same reason (a constant light
    // count: no program recompiles when a car goes up)
    // (every extra light is paid by every lit pixel of every lit material -
    // five of them cost a third of the frame - so: the blast borrows the
    // muzzle-flash light, the nearest fire gets the one new light, and the
    // Hoods' flash pool gives one up for it)
    const pl = (hex, dist) => { const L = new THREE.PointLight(hex, 0, dist, 2); L.position.set(0, -50, 0); scene.add(L); return L; };
    this.fxLights = { blast: this.flash, fire: [pl(0xffffff, 24)] };
    // (a pale warm white: lit stone, iron and car bodies stay ink - a
    // saturated orange light printed every lit edge as an orange outline;
    // the colour lives in the flames and their column in the wet street)
    for (const L of this.fxLights.fire) L.color.setRGB(1.0, 0.87, 0.76);

    // the registries a part fills while it builds: its panes and the things
    // that break (plain lists: they make no mesh and draw no rng)
    this.glass = new Glass(this);
    this.breakables = new Breakables(this);

    // the parts, in order (the order is the build order of the ink ids,
    // the RNG draws and the scene graph: never reorder a stage's parts)
    this.parts = new Map();
    this.updaters = [];
    this._defs = [...parts].sort((a, b) => a.order - b.order || (a.name < b.name ? -1 : 1));
    // [C3] (deferred: the parts and the systems are built by buildSteps(),
    // a step at a time - Stages.warm builds a stage over several frames)
    if (deferred) { this.deferred = true; return; }
    for (const def of this._defs) this.buildPart(def);
    this.finish();
  }

  // [C3] one part (the constructor's loop, as it was)
  buildPart(def, built = undefined) {
    const name = this.name;
    if (this.parts.has(def.name)) throw new Error(`stage ${name}: two parts named '${def.name}'`);
    if (def.name in this && this[def.name] !== NO_STREET) throw new Error(`stage ${name}: '${def.name}' is the stage's own, not a part name`);
    const api = built !== undefined ? built : def.build(this);
    this.parts.set(def.name, api);
    this[def.name] = api;
    if (def.update) this.updaters.push({ tick: def.tick ?? def.order, fn: def.update, api });
  }
  // [C3] the place's systems once its parts stand (the constructor's tail, as it was)
  finish() {
    const scene = this.scene;
    this.updaters.sort((a, b) => a.tick - b.tick);
    this.solids = [];
    scene.traverse((o) => { if (o.isMesh && o.layers.mask & 3 && !o.isInstancedMesh && !o.userData.noRay) this.solids.push(o); });
    this._rim = [];
    this.hoods = new Hoods(this);
    // every figure of the place (src/cast/): the Hoods among them
    this.cast = new Cast(this);
    // the place's own systems
    this.rays = new RayWorld(this);
    this.nav = new NavGrid(this.colliders);
    this.covers = new CoverSet(this, this.nav);
    this.fx = new Fx(this);
    this.fxRef = this.fx;
    this.react = null;
    this.deferred = false;
  }
  // [C3] the deferred build, a part a step, then the systems as finish()
  // builds them (the bullets' world a few milliseconds a step)
  *buildSteps() {
    // (a part that can build in steps - def.buildSteps(stage), a generator
    // returning the api - is stepped through too)
    for (const def of this._defs) {
      if (def.buildSteps) { const it = def.buildSteps(this); let r; while (!(r = it.next()).done) yield def.name; this.buildPart(def, r.value); }
      else this.buildPart(def);
      yield def.name;
    }
    const scene = this.scene;
    this.updaters.sort((a, b) => a.tick - b.tick);
    const all = [];
    scene.traverse((o) => { if (o.isMesh && o.layers.mask & 3 && !o.isInstancedMesh && !o.userData.noRay) all.push(o); });
    this._rim = [];
    this.hoods = new Hoods(this);
    this.cast = new Cast(this);
    yield 'cast';
    this.solids = [];
    this.rays = new RayWorld(this);
    this.solids = all;
    { let t0 = performance.now(); for (const m of all) { this.rays.add(m); if (performance.now() - t0 > 3) { yield 'rays'; t0 = performance.now(); } } }
    this.nav = new NavGrid(this.colliders);
    this.covers = new CoverSet(this, this.nav);
    yield 'nav';
    this.fx = new Fx(this);
    this.fxRef = this.fx;
    this.react = null;
    this.deferred = false;
  }

  // the Game enters this stage (Game.enterStage): the reactive world binds
  // to it once
  bind(game) {
    this.game = game;
    if (!this.react) this.react = new React(game);
  }

  part(name) { return this.parts.get(name) || null; }

  // ---- named places -----------------------------------------------------------------
  // anchor: { pos: Vector3, yaw = 0, r = zone radius, ... anything a part keeps }
  addAnchor(name, data) {
    const a = { yaw: 0, ...data, name };
    if (!a.pos || !a.pos.isVector3) a.pos = new THREE.Vector3(a.pos?.x ?? 0, a.pos?.y ?? 0, a.pos?.z ?? 0);
    this.anchors.set(name, a);
    return a;
  }
  anchor(name) { return this.anchors.get(name) || null; }

  // ---- the walking surface -------------------------------------------------------------
  // fn(x, z) -> y, or undefined where it has no say (a floor outside its room)
  addSurface(fn) { this.surfaces.push(fn); return fn; }
  surfaceY(x, z) {
    for (let i = this.surfaces.length - 1; i >= 0; i--) {
      const y = this.surfaces[i](x, z);
      if (y !== undefined) return y;
    }
    return 0;
  }

  // ---- bullets and line of sight --------------------------------------------------------
  addSolid(mesh) {
    this.solids.push(mesh);
    if (this.rays) this.rays.add(mesh);
    return mesh;
  }
  removeSolid(mesh) {
    const i = this.solids.indexOf(mesh);
    if (i >= 0) this.solids.splice(i, 1);
    if (this.rays) this.rays.remove(mesh);
  }

  // ---- the Look (§9.1) -------------------------------------------------------------------
  // the Look of the volume the eye is in (volumes: addLook(box, look))
  addLook(box, look) { const v = { box, look: { ...this.look, ...look } }; this.lookVolumes.push(v); return v; }
  lookAt(pos) {
    for (const v of this.lookVolumes) if (v.box.containsPoint(pos)) return v.look;
    return this.look;
  }

  // ---- light builds for the reflection and the shadow maps (Pipeline hooks) ---------------
  // a part registers fn(on); lodOff (__noir.perfLegacy) keeps the shadow
  // maps on the full builds
  onReflLod(fn) { this.lodHooks.refl.push(fn); }
  onShadowLod(fn) { this.lodHooks.shadow.push(fn); }
  reflLod(on) { for (const f of this.lodHooks.refl) f(on); }
  shadowLod(on) { if (this.lodOff) return; for (const f of this.lodHooks.shadow) f(on); }

  // ---- per step ----------------------------------------------------------------------------
  update(dt, t, camera, pixelHeight = 1000) {
    this.time = t;
    this.U.uTime.value = t;
    for (const u of this.updaters) u.fn(u.api, dt, t, camera, pixelHeight);
    this.hoods.update(dt, t, camera);
    this.cast.update(dt, t, camera);
    this.breakables.update(dt);
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

// (the old name: code written against the one-block World keeps working)
export { Stage as World };

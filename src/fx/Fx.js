import * as THREE from 'three';
import { LAYER } from '../render/layers.js';
import { Particles } from './Particles.js';
import { Decals } from './Decals.js';
import { MuzzleFlash } from './MuzzleFlash.js';
import { Casings } from './Casings.js';
import { Impacts } from './Impacts.js';
import { Blood } from './Blood.js';
import { Explosions } from './Explosion.js';
import { makeBloodAtlas, makeFlashAtlas, makeFireAtlas, makeGlassAtlas, ATLAS, FIRE } from './fxTextures.js';

// the muzzle smoke's colour (linear, Phase 3b review: ~0.35): laid at alpha
// ~0.4 it prints as a soft grey wash over the black street and a shade
// lighter than the lit mist - visible against both, never an ink blot
const MUZZLE_SMOKE_COL = 0.35;
// (the puff's darker core: it reads against the lit mist)
const MUZZLE_SMOKE_CORE = 0.13;

// All combat effects, one update per fixed step. Draw calls: blood, chips,
// sparks, splash, dust, smoke, 3 flash systems, 3 decal pools, casings.
export class Fx {
  constructor(world) {
    this.world = world;
    const atlas = makeBloodAtlas();
    this.atlas = atlas;
    this.flashAtlas = makeFlashAtlas();
    const cells = [ATLAS.cols, ATLAS.rows];
    // blood in the air is mirrored by the wet street (boosted there so it
    // clears the reflection's bright-pass: a burst leaves a red streak)
    this.blood = new Particles(world, { max: 900, map: atlas, cells, layer: LAYER.FX_REFL, name: 'blood', reflGain: 5, renderOrder: 4, keepChroma: true });
    this.chips = new Particles(world, { max: 300, map: atlas, cells, layer: LAYER.FX, name: 'chips' });
    this.sparks = new Particles(world, { max: 300, map: atlas, cells, layer: LAYER.FX_REFL, name: 'sparks', blending: 'add' });
    this.splash = new Particles(world, { max: 300, map: atlas, cells, layer: LAYER.FX, name: 'splash' });
    this.dust = new Particles(world, { max: 120, map: world.tex.puff, cells: [1, 1], layer: LAYER.FX, name: 'dust', crisp: false, alphaFromR: true });
    // Phase 3a: fire, smoke, glass and debris (fxTextures FIRE / GLASS)
    this.fireAtlas = makeFireAtlas();
    this.glassAtlas = makeGlassAtlas();
    const fc = [FIRE.cols, FIRE.rows];
    // flames and fireballs: the second permitted colour. Normal blending
    // (never additive: the ink pass keys colour on saturation, and additive
    // fire over grey would wash out to white), chroma kept through the fog
    // like blood, mirrored by the wet street (FX_REFL)
    // (its bloom fades with distance - Particles distDim: a mid-distance
    // wreck's flames print as ink, not as a glow sprite)
    this.fire = new Particles(world, { max: 700, map: this.fireAtlas, cells: fc, layer: LAYER.FX_REFL, name: 'fire', renderOrder: 6, keepChroma: true, cut: [0.3, 0.55], distDim: [14, 24, 0.3] });
    // smoke: soft dry-brush washes (muzzle smoke, the bonnet's warning
    // smoke, the black column over a wreck); scene pass only
    // (alpha remapped by a wide soft window: the body of a puff is a solid
    // wash, only its rim and the gaps between its brush strokes are soft)
    this.smoke = new Particles(world, { max: 700, map: this.fireAtlas, cells: fc, layer: LAYER.FX, name: 'smokeWash', renderOrder: 3, crisp: true, cut: [0.04, 0.5], occlude: 0.9, fogFade: 0.8 });
    // glass shards, debris flecks, embers (lit, normal blending)
    this.debris = new Particles(world, { max: 500, map: this.fireAtlas, cells: fc, layer: LAYER.FX_REFL, name: 'debris', renderOrder: 4, keepChroma: true, cut: [0.35, 0.6] });
    this.decals = new Decals(world, atlas, this.glassAtlas);
    this.flash = new MuzzleFlash(world, this.flashAtlas, world.tex.puff);
    this.casings = new Casings(world);
    this.impacts = new Impacts(world, this);
    this.bloodFx = new Blood(world, this);
    this.explosions = new Explosions(world, this);
  }

  update(dt, time) {
    this.flash.update(dt, time);
    this.blood.update(dt);
    this.chips.update(dt);
    this.sparks.update(dt);
    this.splash.update(dt);
    this.dust.update(dt);
    this.casings.update(dt);
    this.bloodFx.update(dt);
    this.explosions.update(dt);
    this.fire.update(dt);
    this.smoke.update(dt);
    this.debris.update(dt);
  }

  // Muzzle smoke after a burst (Phase 3a preamble #5, 3b): a soft puff
  // 0.25-0.35 m across hanging at the muzzle, its alpha laid in dry-brush
  // strokes (a wash you see the street through), lit by the flash for its
  // first ~100 ms, drifting up and along the shot. Phase 3b review: one
  // mid-grey puff (col 0.35) vanished in front of the lit arcade mist, which
  // prints the same grey; now two mid-grey outer lobes (col 0.35, alpha
  // ~0.35: they read against the dark street) wrap a DARKER core (col 0.13,
  // alpha ~0.5: it reads against the lit mist), all three flash-lit at
  // birth, so the puff separates from either ground. It hangs where the gun
  // points (gunFwd), rising slowly.
  muzzleSmoke(pos, fwd, shots = 3, gunFwd = null) {
    const r = this.world.rng;
    const k = Math.min(1, 0.8 + shots * 0.04);
    const col = MUZZLE_SMOKE_COL;
    const dir = gunFwd || fwd;
    const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    const puff = (o, s, c, a, up) => this.smoke.spawn({
      pos: pos.clone().addScaledVector(dir, o).addScaledVector(side, r.gauss() * 0.03).add(new THREE.Vector3(0, up, 0)),
      vel: dir.clone().multiplyScalar(r.range(0.25, 0.45)).add(new THREE.Vector3(r.gauss() * 0.04, r.range(0.14, 0.24), r.gauss() * 0.04)),
      life: r.range(1.2, 1.6), size: [s, s], grow: r.range(0.1, 0.16), rot: r.next() * 6.28, spin: r.gauss() * 0.3,
      col: [c, c, c], alpha: a, drag: 0.8, fadeIn: 0.04, fadeOut: 0.7, cell: FIRE.SMOKE[r.int(0, 3)],
      lit: 3.0, litT: 0.1,
    });
    // (drawn in spawn order: the outer lobes first, the core over them)
    puff(0.2, r.range(0.3, 0.35) * k, col, r.range(0.33, 0.38), 0.03);
    puff(0.3, r.range(0.25, 0.3) * k, col, r.range(0.33, 0.38), 0.06);
    puff(0.22, r.range(0.2, 0.24) * k, MUZZLE_SMOKE_CORE, r.range(0.48, 0.54), 0.035);
  }

  clear() {
    for (const s of [this.blood, this.chips, this.sparks, this.splash, this.dust, this.fire, this.smoke, this.debris]) s.clear();
    this.decals.clear();
    this.flash.clear();
    this.casings.clear();
    this.bloodFx.clear();
    this.explosions.clear();
  }

  get liveParticles() {
    return this.blood.list.length + this.chips.list.length + this.sparks.list.length + this.splash.list.length + this.dust.list.length
      + this.fire.list.length + this.smoke.list.length + this.debris.list.length;
  }
}

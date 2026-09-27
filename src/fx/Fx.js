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

  // Muzzle smoke after a burst (Phase 3a preamble #5): a soft mid-grey puff
  // ~0.3 m across at the muzzle, its alpha laid in dry-brush strokes, lit by
  // the flash for its first ~100 ms, drifting up and along the shot
  muzzleSmoke(pos, fwd, shots = 3) {
    const r = this.world.rng;
    // (the muzzle sits ~1 m from the eye: a 0.3 m puff there fills a fifth
    // of the frame, so it is laid thin - a brushed wash you see the street
    // through - and it drifts off forward and up out of the view)
    const k = Math.min(1.3, 0.75 + shots * 0.06);
    for (let i = 0; i < 2; i++) {
      const s = (i === 0 ? 0.26 : r.range(0.14, 0.2)) * k;
      const side = new THREE.Vector3(-fwd.z, 0, fwd.x).multiplyScalar(r.gauss() * 0.05);
      this.smoke.spawn({
        pos: pos.clone().addScaledVector(fwd, 0.25 + i * 0.12).add(side).add(new THREE.Vector3(0, 0.03 + i * 0.04, 0)),
        vel: fwd.clone().multiplyScalar(r.range(0.4, 0.7)).add(new THREE.Vector3(r.gauss() * 0.05, r.range(0.3, 0.45), r.gauss() * 0.05)),
        life: r.range(1.2, 1.6), size: [s, s], grow: r.range(0.12, 0.2), rot: r.next() * 6.28, spin: r.gauss() * 0.3,
        col: [0.024, 0.024, 0.024], alpha: 0.62, drag: 0.6, fadeIn: 0.04, fadeOut: 0.7, cell: FIRE.SMOKE[r.int(0, 3)],
        lit: 3.5, litT: 0.1,
      });
    }
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

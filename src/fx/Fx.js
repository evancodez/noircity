import { LAYER } from '../render/layers.js';
import { Particles } from './Particles.js';
import { Decals } from './Decals.js';
import { MuzzleFlash } from './MuzzleFlash.js';
import { Casings } from './Casings.js';
import { Impacts } from './Impacts.js';
import { Blood } from './Blood.js';
import { makeBloodAtlas, makeFlashAtlas, ATLAS } from './fxTextures.js';

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
    this.decals = new Decals(world, atlas);
    this.flash = new MuzzleFlash(world, this.flashAtlas, world.tex.puff);
    this.casings = new Casings(world);
    this.impacts = new Impacts(world, this);
    this.bloodFx = new Blood(world, this);
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
  }

  clear() {
    for (const s of [this.blood, this.chips, this.sparks, this.splash, this.dust]) s.clear();
    this.decals.clear();
    this.flash.clear();
    this.casings.clear();
    this.bloodFx.clear();
  }

  get liveParticles() {
    return this.blood.list.length + this.chips.list.length + this.sparks.list.length + this.splash.list.length + this.dust.list.length;
  }
}

import * as THREE from 'three';
import { LAYER } from '../render/layers.js';
import { Particles } from './Particles.js';
import { Decals } from './Decals.js';
import { MuzzleFlash } from './MuzzleFlash.js';
import { Casings } from './Casings.js';
import { Impacts } from './Impacts.js';
import { Blood } from './Blood.js';
import { Explosions } from './Explosion.js';
import { Pour, Cig, Punch } from './StoryFx.js';
import { makeBloodAtlas, makeFlashAtlas, makeFireAtlas, makeGlassAtlas, ATLAS, FIRE } from './fxTextures.js';

// the muzzle puff (Phase 3c): a compact DENSE core (col 0.13, alpha ~0.7,
// 0.18 m) - a dark-grey blot against the lit mist and the lamp-lit road, a
// shade lighter than the black wet asphalt - and one lighter lobe riding up
// off it (col 0.3), both cut crisp from the brushed smoke cells so the edge
// frays in dry-brush bristles instead of fading like a gaussian sprite
// (Phase 3d: NOTHING in the puff prints paler than the mist - the lobe
// riding off the top, col 0.2 and flash-lit x4 at birth, printed as a pale
// disc brighter than the arcade mist behind it; it is now as dark as the
// core's rim, 0.05, and lit no harder than the core)
const MUZZLE_SMOKE_COL = 0.05;
const MUZZLE_SMOKE_CORE = 0.02;

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
    // the train's wheel sparks (Phase 3c review): a system of their own -
    // solid 5-6 px heads with thin line tails (Particles `spark`)
    this.railSparks = new Particles(world, { max: 160, map: atlas, cells, layer: LAYER.FX_REFL, name: 'railSparks', blending: 'add', spark: true });
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
    // the muzzle puff: the same brushed cells cut in a narrow window - a
    // solid body with a frayed bristle edge (Phase 3c; drawn only while a
    // puff hangs, like every empty system)
    // (Phase 3c review: drawn LAST of the world's washes - renderOrder 3 ->
    // 9, after the street's steam (8): transparent systems are ordered by
    // renderOrder, not per particle, and a vent's soft grey plume behind the
    // muzzle was drawn over the puff hanging half a metre from the eye - the
    // 'pale steam plume' in front of the arcade mist was the steam itself.
    // fogFade 0.8 -> 0.4, and the crisp cut widened, [0.26, 0.44] ->
    // [0.22, 0.5], so the bristled edge reads at 1x)
    // (Phase 3d: the cut window [0.22, 0.5] -> [0.3, 0.7] - the edge now
    // frays over the cell's whole bristled rim instead of closing into a
    // clean round outline)
    // (Phase 3d review: and a second, coarser octave cut into that rim -
    // Particles `fray` - so the outline breaks into three or four ragged
    // lobes at 1x, not a smooth ellipse with a soft grey rim; the rng draws
    // are untouched. At 0.6, cut only into the outer rim, the notches of the
    // two overlapping sprites filled each other in and the core still read
    // as an ellipse: 0.8, over a steeper ramp. Cut from the centre out it
    // holed the lobe, and the flash behind printed through as pale bits)
    this.puff = new Particles(world, { max: 48, map: this.fireAtlas, cells: fc, layer: LAYER.FX, name: 'muzzlePuff', renderOrder: 9, crisp: true, cut: [0.3, 0.7], occlude: 1.45, fogFade: 0.4, occLayer: LAYER.VOL_POST, occMark: true, fray: 0.8 });
    // glass shards, debris flecks, embers (lit, normal blending)
    this.debris = new Particles(world, { max: 500, map: this.fireAtlas, cells: fc, layer: LAYER.FX_REFL, name: 'debris', renderOrder: 4, keepChroma: true, cut: [0.35, 0.6] });
    this.decals = new Decals(world, atlas, this.glassAtlas);
    this.flash = new MuzzleFlash(world, this.flashAtlas, world.tex.puff);
    this.casings = new Casings(world);
    this.impacts = new Impacts(world, this);
    this.bloodFx = new Blood(world, this);
    this.explosions = new Explosions(world, this);
    // the story's small effects (fx/StoryFx.js): the pour, the cigarette's
    // smoke, a fist landing
    this.pour = new Pour(this);
    this.cig = new Cig(this);
    this.hit = new Punch(this);
  }

  update(dt, time) {
    this.pour.update(dt);
    this.flash.update(dt, time);
    this.blood.update(dt);
    this.chips.update(dt);
    this.sparks.update(dt);
    this.railSparks.update(dt);
    this.splash.update(dt);
    this.dust.update(dt);
    this.casings.update(dt);
    this.bloodFx.update(dt);
    this.explosions.update(dt);
    this.fire.update(dt);
    this.smoke.update(dt);
    this.puff.update(dt);
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
  // Phase 3c: the three wide washes (0.2-0.35 m, alpha 0.35-0.5) vanished
  // into the lit road and the mist, whose grey they matched; now TWO lobes,
  // compact (0.18 m, growing ~6 cm a second) and dense: a dark core (col
  // 0.13, alpha 0.7) and a lighter lobe (col 0.3, alpha 0.5) riding up off
  // its top, both frayed at the edge by the puff system's crisp cut
  muzzleSmoke(pos, fwd, shots = 3, gunFwd = null) {
    const r = this.world.rng;
    const k = Math.min(1, 0.85 + shots * 0.04);
    const dir = gunFwd || fwd;
    const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    const puff = (o, s, c, a, up, grow, lit = 3.0) => this.puff.spawn({
      pos: pos.clone().addScaledVector(dir, o).addScaledVector(side, r.gauss() * 0.02).add(new THREE.Vector3(0, up, 0)),
      vel: dir.clone().multiplyScalar(r.range(0.18, 0.3)).add(new THREE.Vector3(r.gauss() * 0.03, r.range(0.1, 0.16), r.gauss() * 0.03)),
      life: r.range(1.1, 1.4), size: [s, s], grow, rot: r.next() * 6.28, spin: r.gauss() * 0.25,
      col: [c, c, c], alpha: a, drag: 1.2, fadeIn: 0.03, fadeOut: 0.6, cell: FIRE.SMOKE[r.int(0, 3)],
      lit, litT: 0.1,
    });
    // (drawn in spawn order: the lobe first, the dark core over it)
    // (Phase 3d: the lobe dark too - see MUZZLE_SMOKE_COL - and flash-lit
    // only as hard as the core)
    puff(0.24, r.range(0.15, 0.17) * k, MUZZLE_SMOKE_COL, r.range(0.48, 0.52), 0.07, r.range(0.07, 0.09), 1.5);
    // (Phase 3c review: the core lit only half as hard by the flash - 3.0
    // lifted it toward the mist's grey in its first frames)
    // (Phase 3d: the core a full 0.18 m however short the burst - k shrank
    // a 3-round burst's to 0.165 - at alpha 0.7)
    // (the rng is drawn in the original order and count: the world's rng
    // runs the whole battle)
    puff(0.18, r.range(0.175, 0.185), MUZZLE_SMOKE_CORE, (r.range(0.68, 0.72), 0.7), 0.03, r.range(0.05, 0.07), 1.5);
  }

  clear() {
    for (const s of [this.blood, this.chips, this.sparks, this.railSparks, this.splash, this.dust, this.fire, this.smoke, this.puff, this.debris]) s.clear();
    this.decals.clear();
    this.flash.clear();
    this.casings.clear();
    this.bloodFx.clear();
    this.explosions.clear();
  }

  get liveParticles() {
    return this.blood.list.length + this.chips.list.length + this.sparks.list.length + this.railSparks.list.length + this.splash.list.length + this.dust.list.length
      + this.fire.list.length + this.smoke.list.length + this.puff.list.length + this.debris.list.length;
  }
}

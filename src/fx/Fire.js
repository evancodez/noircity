import * as THREE from 'three';
import { FIRE } from './fxTextures.js';
import { FIRE_COL } from './Explosion.js';

// A burning wreck (Phase 3a). Per fire:
//   - flames: flame-tongue sprites licking up off the engine bay (and a
//     smaller fire in the cabin), upright, swaying, their colour running
//     from yellow-white at the root to deep orange at the tips. Normal
//     blending, chroma kept (FX_REFL: the wet street mirrors them, and the
//     reflection bright pass keeps their chroma -> a warm column)
//   - a warm PointLight (from the world's pre-allocated fire pool) that
//     flickers with the flames, plus a light-registry entry so the rain
//     falling through it glitters
//   - a rising black smoke column: dark soft washes drifting downwind
//   - over ~60 s it dies down to embers: fewer, lower flames, a dim light,
//     sparks of embers, a thin smoke thread
// intensity() is 1 while it roars, ~0.2 as embers; the Game reads it for
// the hot-wreck damage tick, the Hoods' hazard radius and the fire sound.
// (Phase 3a review: the full blaze was 55 s, and a long battle's street
// turned into a gallery of roaring wrecks; an old wreck now sinks to a warm
// ember glow sooner: embers (I < 0.45) from ~59 s, the floor by ~70 s)
const ROAR = 35;     // s at full blaze
const FADE = 35;     // s from full blaze down to embers

export class Fire {
  constructor(world, fx, { pos, yaw = 0, t0 = 0, cabin = null } = {}) {
    this.world = world;
    this.fx = fx;
    this.rng = world.rng.fork(7700 + Math.round(pos.x * 13 + pos.z * 7));
    this.pos = pos.clone();              // the engine bay (flame root)
    this.cabin = cabin ? cabin.clone() : null;
    this.yaw = yaw;
    this.age = -t0;
    this.acc = { flame: 0, cab: 0, smoke: 0, ember: 0 };
    this.light = null;                   // a pooled PointLight while it burns
    this.entry = world.lights.add({ position: pos.clone().add(new THREE.Vector3(0, 1.4, 0)), direction: new THREE.Vector3(0, -1, 0), halfAngle: Math.PI, range: 6, intensity: 0 });
    this.flick = 1;
    this.wind = new THREE.Vector3(0.55, 0, 0.12);
  }

  intensity() {
    const a = this.age;
    if (a < 0) return 0;
    const up = Math.min(1, a / 0.6);
    const down = a < ROAR ? 1 : Math.max(0.2, 1 - (a - ROAR) / FADE * 0.8);
    return up * down;
  }

  // flicker: two noisy sines and the odd gust
  flicker(t) {
    const s = this.rng;
    const n = 0.72 + 0.16 * Math.sin(t * 13.1 + this.pos.x) + 0.1 * Math.sin(t * 29.7 + this.pos.z * 3) + 0.08 * Math.sin(t * 7.3);
    if (s.chance(0.02)) this.flick = 0.75 + s.next() * 0.5;
    this.flick += (1 - this.flick) * 0.1;
    return n * this.flick;
  }

  update(dt, t) {
    this.age += dt;
    const I = this.intensity();
    const F = this.fx, r = this.rng;
    const f = this.flicker(t);
    // the warm light, a little above the flames
    if (this.light) {
      this.light.position.copy(this.pos).add(new THREE.Vector3(0, 1.5, 0));
      this.light.intensity = I > 0 ? 70 * I * f : 0;
      this.light.distance = 16 + 10 * I;
    }
    this.entry.intensity = I > 0 ? 0.5 * I * f : 0;
    this.entry.position.copy(this.pos).add(new THREE.Vector3(0, 1.4, 0));
    if (I <= 0) return;
    const ember = I < 0.45;
    // flames off the engine bay (as embers: low licks along the bay)
    this.acc.flame += dt * (ember ? 12 : 34 * Math.max(0.3, I));
    while (this.acc.flame >= 1) {
      this.acc.flame -= 1;
      const s = ember ? r.range(0.3, 0.55) : r.range(0.8, 1.7) * (0.8 + 0.4 * I);
      const off = new THREE.Vector3(r.gauss() * 0.42, 0, r.gauss() * 0.36).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
      const root = r.chance(0.35);
      F.fire.spawn({
        pos: this.pos.clone().add(off).add(new THREE.Vector3(0, s * 0.4, 0)),
        vel: new THREE.Vector3(this.wind.x * 0.5 + r.gauss() * 0.15, r.range(1.1, 2.2) * (ember ? 0.5 : 1), this.wind.z * 0.5 + r.gauss() * 0.15),
        life: r.range(0.4, 0.75) * (ember ? 0.8 : 1), size: [s * 0.75, s], grow: 0.35, rot: r.gauss() * 0.14, spin: r.gauss() * 0.3,
        col: ember ? FIRE_COL.orange : root ? FIRE_COL.white : FIRE_COL.yellow, colEnd: FIRE_COL.deep, colPow: 1.3, cell: FIRE.FLAME[r.int(0, 3)],
        fadeIn: 0.08, fadeOut: 0.35, drag: 0.5,
      });
    }
    // the cabin burns lower
    if (this.cabin && !ember) {
      this.acc.cab += dt * 14 * I;
      while (this.acc.cab >= 1) {
        this.acc.cab -= 1;
        const s = r.range(0.55, 1.1);
        F.fire.spawn({
          pos: this.cabin.clone().add(new THREE.Vector3(r.gauss() * 0.35, s * 0.35, r.gauss() * 0.35)),
          vel: new THREE.Vector3(r.gauss() * 0.1, r.range(0.7, 1.4), r.gauss() * 0.1),
          life: r.range(0.3, 0.55), size: [s * 0.8, s], grow: 0.2, rot: r.gauss() * 0.14,
          col: FIRE_COL.yellow, colEnd: FIRE_COL.deep, colPow: 1.2, cell: FIRE.FLAME[r.int(0, 3)], fadeIn: 0.1, fadeOut: 0.35,
        });
      }
    }
    // the smoke column: a soft dark wash rising and drifting downwind -
    // translucent, the skyline ghosting through it, darkest where the puffs
    // overlap over the fire (Phase 3a review: at 5.5 opaque puffs a second
    // it was a solid black mass blotting out the towers, and the biggest
    // 3a cost in the MSAA scene target: fewer, larger, thinner puffs)
    this.acc.smoke += dt * (ember ? 2.2 : 3.4);
    while (this.acc.smoke >= 1) {
      this.acc.smoke -= 1;
      const s = r.range(1.1, 1.8) * (ember ? 0.45 : 1);
      F.smoke.spawn({
        pos: this.pos.clone().add(new THREE.Vector3(r.gauss() * 0.3, 1.6 + r.next() * 0.6, r.gauss() * 0.3)),
        vel: new THREE.Vector3(this.wind.x + r.gauss() * 0.2, r.range(1.5, 2.4) * (ember ? 0.6 : 1), this.wind.z + r.gauss() * 0.2),
        life: r.range(5, 8), size: [s, s], grow: r.range(0.55, 0.95), rot: r.next() * 6.28, spin: r.gauss() * 0.15,
        col: [0.004, 0.004, 0.004], alpha: r.range(0.3, 0.4) * (ember ? 0.55 : 1), drag: 0.25, fadeIn: 0.07, fadeOut: 0.6, cell: FIRE.SMOKE[r.int(0, 3)],
      });
    }
    // embers: sparks rising off the dying fire
    this.acc.ember += dt * (ember ? 9 : 3);
    while (this.acc.ember >= 1) {
      this.acc.ember -= 1;
      F.fire.spawn({
        pos: this.pos.clone().add(new THREE.Vector3(r.gauss() * 0.4, 0.3, r.gauss() * 0.4)),
        vel: new THREE.Vector3(r.gauss() * 0.4 + this.wind.x, r.range(1.2, 3), r.gauss() * 0.4),
        life: r.range(0.8, 1.8), size: [0.07, 0.07], col: FIRE_COL.orange, colEnd: FIRE_COL.deep, cell: FIRE.EMBER, drag: 0.4, fadeOut: 0.4,
      });
    }
    // as embers: the bay glows - a few hot coals sitting on the wreck
    if (ember && r.chance(dt * 10)) {
      const off = new THREE.Vector3(r.gauss() * 0.4, 0, r.gauss() * 0.3).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
      const s = r.range(0.12, 0.26);
      F.fire.spawn({ pos: this.pos.clone().add(off).add(new THREE.Vector3(0, 0.05, 0)), life: r.range(0.4, 0.9), size: [s, s * 0.6], rot: r.next() * 6.28,
        col: FIRE_COL.orange, colEnd: FIRE_COL.deep, cell: FIRE.BALL[r.int(0, 3)], fadeIn: 0.2, fadeOut: 0.5 });
    }
  }

  dispose() {
    this.world.lights.remove(this.entry);
    if (this.light) this.light.intensity = 0;
  }
}

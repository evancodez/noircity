import * as THREE from 'three';
import { FIRE } from './fxTextures.js';
import { FIRE_COL } from './Explosion.js';

// A burning wreck (Phase 3a; lane 3: one fire per explosion kind). Per fire:
//   - flames: flame-tongue sprites licking up off each of its SOURCES (the
//     engine bay, the cabin, fire standing up through the roof, the tank),
//     upright, swaying, yellow-white at the root to deep orange at the tips.
//     Normal blending, chroma kept (FX_REFL: the wet street mirrors them)
//   - a warm PointLight (from the world's pre-allocated fire pool) that
//     flickers with the flames, plus a light-registry entry so the rain
//     falling through it glitters
//   - a rising black smoke column: dark soft washes drifting downwind
//   - over ~60 s it dies down to embers: fewer, lower flames, a dim light,
//     sparks of embers, a thin smoke thread
//   - (kind B) a POOL: burning fuel spread on the wet street, a sheet of low
//     flame 3-4 m wide that burns 12 s, lying on the water (it reflects)
// Sources are given in the car's own frame and `toWorld(v)` maps them each
// step: a wreck that rolls onto its side carries its fire with it.
// intensity() is 1 while it roars, ~0.2 as embers; the Game reads it for
// the hot-wreck damage tick, the Hoods' hazard radius and the fire sound.
// douse(): the oldest of three roaring fires sinks to embers (the frame
// rate's limit of two big fires, Cars.js).
const ROAR = 25;     // s at full blaze
const FADE = 35;     // s from full blaze down to embers
const _v = new THREE.Vector3(), _w = new THREE.Vector3();

// the flame recipe per source kind: rate (flames/s at full blaze), size
// range, rise speed, life, spread (rx, rz, m), the white-hot root share
const SRC = {
  bay: { rate: 34, s: [0.8, 1.7], up: [1.1, 2.2], life: [0.4, 0.75], root: 0.35 },
  cabin: { rate: 14, s: [0.55, 1.1], up: [0.7, 1.4], life: [0.3, 0.55], root: 0.15 },
  // fire standing up through the roof (the cook-off): a tall column that
  // settles to a cabin fire after ~10 s
  roof: { rate: 30, s: [1.0, 2.0], up: [2.0, 3.2], life: [0.45, 0.8], root: 0.3 },
  // the tank at the rear, low and wide
  tank: { rate: 22, s: [0.6, 1.3], up: [0.8, 1.6], life: [0.35, 0.6], root: 0.4 },
};

export class Fire {
  constructor(world, fx, { pos, yaw = 0, t0 = 0, cabin = null, sources = null, toWorld = null, pool = null, seed = null } = {}) {
    this.world = world;
    this.fx = fx;
    this.rng = world.rng.fork(seed ?? (7700 + Math.round(pos.x * 13 + pos.z * 7)));
    this.toWorld = toWorld;
    // the old two-source fire (engine bay + cabin, in world space)
    this.sources = sources ? sources.map((s) => ({ ...s, acc: 0, w: new THREE.Vector3() }))
      : [{ kind: 'bay', at: pos.clone(), rx: 0.42, rz: 0.36, world: true, acc: 0, w: pos.clone() }, ...(cabin ? [{ kind: 'cabin', at: cabin.clone(), rx: 0.35, rz: 0.35, world: true, acc: 0, w: cabin.clone(), noEmber: true }] : [])];
    this.pos = new THREE.Vector3();          // the main source (light, sound, hazard)
    this.yaw = yaw;
    this.age = -t0;
    this.acc = { smoke: 0, ember: 0, pool: 0 };
    this.light = null;                       // a pooled PointLight while it burns
    this.place();
    this.entry = world.lights.add({ position: this.pos.clone().add(new THREE.Vector3(0, 1.4, 0)), direction: new THREE.Vector3(0, -1, 0), halfAngle: Math.PI, range: 6, intensity: 0 });
    this.flick = 1;
    this.wind = new THREE.Vector3(0.55, 0, 0.12);
    // the fuel pool: { at (local), rx, rz (full size), life, spread (s) }
    this.pool = pool ? { ...pool, w: new THREE.Vector3(), age: 0 } : null;
    if (this.pool) {
      this.poolEntry = world.lights.add({ position: new THREE.Vector3(), direction: new THREE.Vector3(0, -1, 0), halfAngle: Math.PI, range: 5, intensity: 0 });
    }
    this.doused = false;
  }

  // the sources' world positions (a rolled wreck carries them)
  place() {
    for (const s of this.sources) {
      if (s.world) s.w.copy(s.at);
      else s.w.copy(this.toWorld(s.at));
    }
    this.pos.copy(this.sources[0].w);
    if (this.pool) this.pool.w.copy(this.pool.world ? this.pool.at : this.toWorld(this.pool.at)).setY(this.pool.y ?? 0.02);
  }

  intensity() {
    const a = this.age;
    if (a < 0) return 0;
    const up = Math.min(1, a / 0.6);
    const down = a < ROAR ? 1 : Math.max(0.2, 1 - (a - ROAR) / FADE * 0.8);
    return up * down;
  }

  // the oldest of three roaring fires dies down to embers (Cars.js)
  douse() {
    if (this.age < ROAR + FADE) this.age = ROAR + FADE;
    this.doused = true;
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
    if (this.toWorld) this.place();
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
    this.updatePool(dt, f);
    if (I <= 0) return;
    const ember = I < 0.45;
    const up = new THREE.Vector3(0, 1, 0);
    for (const S of this.sources) {
      const R = SRC[S.kind] || SRC.bay;
      if (ember && S.noEmber) continue;
      // (the roof column settles into a cabin fire after ~10 s)
      const roofK = S.kind === 'roof' ? Math.max(0.45, 1 - Math.max(0, this.age - 8) / 12) : 1;
      S.acc += dt * (ember ? (S.kind === 'bay' || S.kind === 'tank' ? 12 : 4) : R.rate * Math.max(0.3, I) * (S.k ?? 1) * roofK);
      while (S.acc >= 1) {
        S.acc -= 1;
        const s = ember ? r.range(0.3, 0.55) : r.range(R.s[0], R.s[1]) * (0.65 + 0.55 * I) * (S.kind === 'roof' ? 0.6 + 0.4 * roofK : 1);
        const off = _v.set(r.gauss() * (S.rx ?? 0.4), 0, r.gauss() * (S.rz ?? 0.35)).applyAxisAngle(up, this.yaw);
        const low = ember ? 0.5 : 0.55 + 0.45 * I;
        const root = r.chance(R.root + 0.45 * (1 - I));
        F.fire.spawn({
          pos: S.w.clone().add(off).add(_w.set(0, s * 0.4, 0)),
          vel: new THREE.Vector3(this.wind.x * 0.5 + r.gauss() * 0.15, r.range(R.up[0], R.up[1]) * low * (S.kind === 'roof' ? roofK : 1), this.wind.z * 0.5 + r.gauss() * 0.15),
          life: r.range(R.life[0], R.life[1]) * (ember ? 0.8 : 0.75 + 0.25 * I), size: [s * 0.75, s], grow: 0.35 * (ember ? 1 : 0.5 + 0.5 * I), rot: r.gauss() * 0.14, spin: r.gauss() * 0.3,
          col: ember ? FIRE_COL.orange : root ? FIRE_COL.white : FIRE_COL.yellow, colEnd: FIRE_COL.deep, colPow: 1.3, cell: FIRE.FLAME[r.int(0, 3)],
          fadeIn: 0.08, fadeOut: 0.35, drag: 0.5,
        });
      }
    }
    // the smoke column: a soft dark wash rising and drifting downwind -
    // translucent, the skyline ghosting through it, darkest where the puffs
    // overlap over the fire
    const top = this.sources.reduce((m, s) => (s.kind === 'roof' ? s : m), this.sources[0]);
    this.acc.smoke += dt * (ember ? 2.2 : 3.4);
    while (this.acc.smoke >= 1) {
      this.acc.smoke -= 1;
      const s = r.range(1.1, 1.8) * (ember ? 0.45 : 1);
      F.smoke.spawn({
        pos: top.w.clone().add(new THREE.Vector3(r.gauss() * 0.3, 1.6 + r.next() * 0.6, r.gauss() * 0.3)),
        vel: new THREE.Vector3(this.wind.x + r.gauss() * 0.2, r.range(1.5, 2.4) * (ember ? 0.6 : 1), this.wind.z + r.gauss() * 0.2),
        life: r.range(5, 8), size: [s, s], grow: r.range(0.55, 0.95), rot: r.next() * 6.28, spin: r.gauss() * 0.15,
        col: [0.004, 0.004, 0.004], alpha: r.range(0.3, 0.4) * (ember ? 0.55 : 1), drag: 0.25, fadeIn: 0.07, fadeOut: 0.6, cell: FIRE.SMOKE[r.int(0, 3)],
      });
    }
    // embers: sparks rising off the fire
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
      const off = new THREE.Vector3(r.gauss() * 0.4, 0, r.gauss() * 0.3).applyAxisAngle(up, this.yaw);
      const s = r.range(0.12, 0.26);
      F.fire.spawn({ pos: this.pos.clone().add(off).add(new THREE.Vector3(0, 0.05, 0)), life: r.range(0.4, 0.9), size: [s, s * 0.6], rot: r.next() * 6.28,
        col: FIRE_COL.orange, colEnd: FIRE_COL.deep, cell: FIRE.BALL[r.int(0, 3)], fadeIn: 0.2, fadeOut: 0.5 });
    }
  }

  // Burning fuel on the wet street: it spreads out from under the tank in
  // ~0.8 s to its full 3-4 m, burns as a sheet of LOW flame (short tongues,
  // crowded, their tips licking) for its life, and goes out from the edge
  // in; a flame on the water is mirrored like any fire (FX_REFL)
  updatePool(dt, f) {
    const P = this.pool;
    if (!P) return;
    P.age += dt;
    const life = P.life ?? 12;
    const k = P.age < 0 ? 0 : Math.min(1, P.age / (P.spread ?? 0.8)) * Math.max(0, Math.min(1, (life - P.age) / 3));
    this.poolEntry.intensity = 0.45 * k * f;
    this.poolEntry.position.copy(P.w).add(new THREE.Vector3(0, 0.6, 0));
    if (k <= 0) return;
    const r = this.rng, F = this.fx;
    const rx = P.rx * (0.35 + 0.65 * Math.min(1, P.age / (P.spread ?? 0.8))), rz = P.rz * (0.35 + 0.65 * Math.min(1, P.age / (P.spread ?? 0.8)));
    // (Wave A fix D7) One low sheet of flame with a ragged edge, not a row
    // of separate tongues: the sheet is laid in wide, squat pieces - the
    // atlas's tongue cells squashed flat, each a run of short tongues on a
    // ragged base, overlapping their neighbours so the base is one burning
    // band - and a few taller tongues licking up out of it make its top edge
    // ragged. Thinned as it goes out, from the edge in.
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    const at = (d) => {
      const a = r.next() * Math.PI * 2;
      const lx = Math.cos(a) * rx * d, lz = Math.sin(a) * rz * d;
      return [P.w.x + lx * c + lz * s, P.w.z - lx * s + lz * c];
    };
    // the sheet: pieces per second by its area
    this.acc.pool += dt * 70 * rx * rz * (0.4 + 0.6 * k);
    while (this.acc.pool >= 1) {
      this.acc.pool -= 1;
      const d = Math.sqrt(r.next()) * (0.5 + 0.5 * k);
      const [x, z] = at(d);
      const edge = 1 - d;
      const w = r.range(0.55, 0.95) * (0.6 + 0.4 * k), h = r.range(0.2, 0.34) * (0.7 + 0.3 * k) * (0.8 + 0.4 * edge);
      const ball = r.chance(0.35);
      F.fire.spawn({
        pos: new THREE.Vector3(x, P.w.y + h * (ball ? 0.3 : 0.42), z),
        vel: new THREE.Vector3(this.wind.x * 0.25 + r.gauss() * 0.05, r.range(0.08, 0.25), this.wind.z * 0.25 + r.gauss() * 0.05),
        life: r.range(0.3, 0.55), size: [w, ball ? h * 0.6 : h], grow: 0.1, rot: r.gauss() * 0.05, spin: 0,
        col: r.chance(0.35 + 0.25 * edge) ? FIRE_COL.white : FIRE_COL.yellow, colEnd: FIRE_COL.deep, colPow: 1.4, cell: ball ? FIRE.BALL[r.int(0, 3)] : FIRE.FLAME[r.int(0, 3)],
        fadeIn: 0.06, fadeOut: 0.3, drag: 0.8,
      });
    }
    // the tongues that lick up out of it (its ragged top)
    this.acc.poolT = (this.acc.poolT || 0) + dt * 22 * rx * rz * (0.4 + 0.6 * k);
    while (this.acc.poolT >= 1) {
      this.acc.poolT -= 1;
      const d = Math.sqrt(r.next()) * (0.45 + 0.45 * k);
      const [x, z] = at(d);
      const sz = r.range(0.25, 0.5) * (0.6 + 0.4 * k);
      F.fire.spawn({
        pos: new THREE.Vector3(x, P.w.y + 0.12 + sz * 0.4, z),
        vel: new THREE.Vector3(this.wind.x * 0.4 + r.gauss() * 0.1, r.range(0.35, 0.8), this.wind.z * 0.4 + r.gauss() * 0.1),
        life: r.range(0.22, 0.42), size: [sz * 0.8, sz], grow: 0.2, rot: r.gauss() * 0.2, spin: r.gauss() * 0.3,
        col: FIRE_COL.yellow, colEnd: FIRE_COL.deep, colPow: 1.4, cell: FIRE.FLAME[r.int(0, 3)],
        fadeIn: 0.06, fadeOut: 0.3, drag: 0.6,
      });
    }
  }

  dispose() {
    this.world.lights.remove(this.entry);
    if (this.poolEntry) this.world.lights.remove(this.poolEntry);
    if (this.light) this.light.intensity = 0;
  }
}

import * as THREE from 'three';
import { SURF } from '../util/RayWorld.js';
import { ATLAS } from './fxTextures.js';
import { groundAt } from '../world/Street.js';
import { roundedBox } from '../world/geom.js';

// Bullet impacts by surface (RayWorld.SURF):
//   stone / pavement - dark ink chips flung off the face + a pale dust puff
//                      + a dark impact decal
//   iron / car       - brief white sparks (additive, stretched) + a small
//                      dark mark on car bodies
//   water (street)   - a splash of pale droplets + a ripple ring
//                      (world.street.addImpact)
export class Impacts {
  constructor(world, fx) {
    this.world = world;
    this.fx = fx;
    this.rng = world.rng.fork(733);
    // (lane 3, P1: new draws of their own - the old stream keeps its order)
    this.rng2 = world.rng.fork(734);
    this.count = 0;
    this.cells = new Map();     // stone hits per 35 cm cell: a corner loses a chunk
  }

  at(hit, dir) {
    const r = this.rng, fx = this.fx;
    const p = hit.point, n = hit.normal;
    this.count++;
    // reflected direction: debris leaves along the bounce, fanned by the normal
    const refl = dir.clone().addScaledVector(n, -2 * dir.dot(n)).normalize();
    const gy = groundAt(p.x);
    if (hit.surf === SURF.WATER || hit.surf === SURF.PAVE) {
      this.world.street.addImpact(this.world, p.x, p.z, hit.surf === SURF.WATER ? 0.9 : 0.5);
      const k = hit.surf === SURF.WATER ? 1 : 0.6;
      for (let i = 0; i < 12 * k; i++) {
        const v = new THREE.Vector3(r.gauss() * 0.6, r.range(1.4, 3.2), r.gauss() * 0.6).addScaledVector(refl, r.range(0.3, 1.2));
        fx.splash.spawn({
          pos: p.clone().setY(gy + 0.02), vel: v, life: r.range(0.3, 0.6), size: [0.016, 0.03], stretch: 0.03,
          col: [0.5, 0.5, 0.5], alpha: 0.9, cell: ATLAS.DROP, gravity: 9.8, ground: gy, fadeOut: 0.2,
        });
      }
      // the crown: a ring of fine white drops
      fx.splash.spawn({ pos: p.clone().setY(gy + 0.05), vel: new THREE.Vector3(0, 0.6, 0), life: 0.14, size: [0.22, 0.12], col: [0.35, 0.35, 0.35], alpha: 0.8, cell: ATLAS.DROPS, grow: 0.9, fadeOut: 0.5 });
      if (hit.surf === SURF.PAVE) fx.decals.ink(p, n, 0.08);
      return;
    }
    if (hit.surf === SURF.IRON || hit.surf === SURF.CAR) {
      const nS = r.int(6, 12);
      for (let i = 0; i < nS; i++) {
        const v = refl.clone().multiplyScalar(r.range(4, 11)).add(new THREE.Vector3(r.gauss() * 2.5, r.gauss() * 2.5 + 1, r.gauss() * 2.5));
        fx.sparks.spawn({
          pos: p.clone().addScaledVector(n, 0.01), vel: v, life: r.range(0.06, 0.2), size: [0.008, 0.012], stretch: 0.035,
          col: [5, 5, 5], alpha: 1, cell: ATLAS.DROP, gravity: 9.8, ground: gy, fadeOut: 0.3,
        });
      }
      fx.sparks.spawn({ pos: p.clone().addScaledVector(n, 0.02), life: 0.035, size: [0.12, 0.12], rot: r.next() * 6.28, col: [4, 4, 4], cell: ATLAS.CHIP, fadeOut: 0 });
      // (P1) a few heavier sparks that fall, bounce on the street and die
      const q = this.rng2;
      for (let i = 0; i < 4; i++) {
        const v = refl.clone().multiplyScalar(q.range(1.5, 3.5)).add(new THREE.Vector3(q.gauss() * 1.2, q.range(0.5, 2), q.gauss() * 1.2));
        fx.sparks.spawn({ pos: p.clone().addScaledVector(n, 0.01), vel: v, life: q.range(0.5, 0.9), size: [0.01, 0.014], stretch: 0.025, col: [5, 5, 5], alpha: 1, cell: ATLAS.DROP, gravity: 9.8, ground: gy, bounce: 0.35, fadeOut: 0.5 });
      }
      // the dent: a dark pit with a bright torn edge round it
      fx.decals.surface.add(p.clone().addScaledVector(n, 0.011), n, q.range(0.06, 0.09), q.next() * 6.28, ATLAS.SPLAT[q.int(0, 3)], [0.13, 0.13, 0.13], 0.9);
      if (hit.surf === SURF.CAR) fx.decals.ink(p, n, 0.05);
      else fx.decals.surface.add(p.clone().addScaledVector(n, 0.012), n, q.range(0.03, 0.045), q.next() * 6.28, ATLAS.CHIP, [0.004, 0.004, 0.004], 1);
      // (a ring: the struck metal)
      const G = this.world.game;
      if (G && G.sfx && G.sfx.play) G.sfx.play('ring', p, { big: hit.surf === SURF.IRON ? 1 : 0.5 });
      return;
    }
    // stone (and anything else): ink chips + dust + a dark mark
    const nC = r.int(6, 11);
    for (let i = 0; i < nC; i++) {
      const v = n.clone().multiplyScalar(r.range(1, 3.2)).addScaledVector(refl, r.range(0.5, 2)).add(new THREE.Vector3(r.gauss(), r.gauss() + 0.6, r.gauss()));
      const s = r.range(0.01, 0.028);
      fx.chips.spawn({
        pos: p.clone().addScaledVector(n, 0.02), vel: v, life: r.range(0.5, 1.0), size: [s, s * r.range(0.6, 1)], rot: r.next() * 6.28, spin: r.gauss() * 20,
        col: [0.003, 0.003, 0.003], alpha: 1, cell: r.chance(0.5) ? ATLAS.CHIP : ATLAS.DROPS, gravity: 9.8, ground: gy, fadeOut: 0.15,
      });
    }
    for (let i = 0; i < 2; i++) {
      const s = r.range(0.1, 0.2);
      fx.dust.spawn({
        pos: p.clone().addScaledVector(n, 0.06), vel: n.clone().multiplyScalar(r.range(0.3, 0.8)), life: r.range(0.35, 0.6), size: [s, s], grow: 0.5, rot: r.next() * 6.28,
        col: [0.07, 0.07, 0.07], alpha: 0.5, drag: 3, fadeOut: 0.8,
      });
    }
    // (P1) the crater: pale crushed stone round a dark core
    const q = this.rng2;
    fx.decals.surface.add(p.clone().addScaledVector(n, 0.009), n, q.range(0.16, 0.24), q.next() * 6.28, ATLAS.SPLAT[q.int(0, 3)], [0.16, 0.16, 0.16], 0.85);
    fx.decals.ink(p, n, r.range(0.09, 0.15));
    // a few hits in one place (a pilaster's corner, a kerb) and a chunk
    // comes away: a lump of stone that falls and lies at the foot
    const key = Math.round(p.x / 0.35) + ',' + Math.round(p.y / 0.35) + ',' + Math.round(p.z / 0.35);
    const c = (this.cells.get(key) || 0) + 1;
    this.cells.set(key, c);
    if (c === 3 || c === 6) this.chunk(p, n, refl);
  }

  // a chunk of stone knocked off (lane 3, P1)
  chunk(p, n, refl) {
    const W = this.world, q = this.rng2, B = W.breakables;
    if (!B || !B.field) return;
    const s = q.range(0.07, 0.13);
    const geo = roundedBox(s * q.range(1, 1.6), s * q.range(0.7, 1.1), s * q.range(0.8, 1.3), s * 0.18, 1);
    const m = new THREE.Mesh(geo, W.M.stone);
    m.position.copy(p).addScaledVector(n, s * 0.6);
    m.rotation.set(q.next() * 6, q.next() * 6, q.next() * 6);
    m.userData.inkId = 3;
    m.userData.noRay = true;
    m.castShadow = false;
    B.field.add(m, n.clone().multiplyScalar(q.range(1, 2.2)).addScaledVector(refl, 0.5).add(new THREE.Vector3(0, q.range(0.3, 1.2), 0)), new THREE.Vector3(q.gauss() * 6, q.gauss() * 6, q.gauss() * 6));
    // the scar it leaves: a big dark gouge, and a puff of stone dust
    this.fx.decals.surface.add(p.clone().addScaledVector(n, 0.013), n, q.range(0.2, 0.3), q.next() * 6.28, ATLAS.SPLAT[q.int(0, 3)], [0.004, 0.004, 0.004], 1);
    for (let i = 0; i < 3; i++) {
      const d = q.range(0.18, 0.3);
      this.fx.dust.spawn({ pos: p.clone().addScaledVector(n, 0.08), vel: n.clone().multiplyScalar(q.range(0.3, 0.8)).add(new THREE.Vector3(0, -0.2, 0)), life: q.range(0.6, 1.0), size: [d, d], grow: 0.6, rot: q.next() * 6.28, col: [0.09, 0.09, 0.09], alpha: 0.55, drag: 2.5, fadeOut: 0.8 });
    }
  }
}

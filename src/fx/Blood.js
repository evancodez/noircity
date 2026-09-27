import * as THREE from 'three';
import { ATLAS } from './fxTextures.js';
import { groundAt } from '../world/Street.js';

// Blood: the only saturated red in the world (DESIGN.md §1.8).
//   hit(point, dir)  - 20-40 red drops flung along the shot direction with
//        gravity (stretched along their velocity), a short-lived red splash
//        at the wound (the reference's centre man), and persistent splatter
//        decals on whatever is behind the hit within ~2 m (wall, car, column)
//        and on the street where the spray lands.
//   pool(hood)       - a pool under a corpse, growing over ~5 s to ~1.2 m.
// Colours are linear; the ink pass keeps chroma and prints them vivid red
// (hue to display space, value floored: render/shaders/ink.js).
export const BLOOD_AIR = [0.11, 0.00045, 0.0045];   // display ~#c8102e (ink.js)

export class Blood {
  constructor(world, fx) {
    this.world = world;
    this.fx = fx;
    this.rng = world.rng.fork(419);
    this.bursts = 0;
    this.pending = [];   // corpse pools waiting for the body to land
  }

  hit(point, dir, { strength = 1, rays = null, exit = true } = {}) {
    const r = this.rng, fx = this.fx;
    this.bursts++;
    const n = Math.round(r.range(20, 40) * (0.7 + 0.3 * strength));
    const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    for (let i = 0; i < n; i++) {
      // most of the spray exits along the shot, a little blows back
      const back = r.chance(0.15);
      const v = dir.clone().multiplyScalar((back ? -1 : 1) * r.range(1.5, 5.5) * strength)
        .addScaledVector(side, r.gauss() * 1.1)
        .add(new THREE.Vector3(0, r.range(-0.3, 2.2), 0));
      // a few heavy globs among the drops
      const s = r.chance(0.15) ? r.range(0.07, 0.11) : r.range(0.025, 0.06);
      fx.blood.spawn({
        pos: point.clone().add(new THREE.Vector3(r.gauss() * 0.05, r.gauss() * 0.05, r.gauss() * 0.05)),
        vel: v, life: r.range(0.7, 1.4), size: [s, s * 1.3], stretch: 0.03, col: BLOOD_AIR.map((c) => c * r.range(0.75, 1.25)),
        cell: r.chance(0.7) ? ATLAS.DROP : ATLAS.DROPS, gravity: 9.8, drag: 0.4, ground: groundAt(point.x),
        fadeOut: 0.05,
        onGround: (p) => { if (r.chance(0.35)) fx.decals.drop(p.pos, r.range(0.06, 0.16)); return false; },
      });
    }
    // the splash at the wound (the reference's centre man): big jagged red
    // splatters thrown off the body, spreading and hanging ~0.5 s
    const nS = Math.round(4 + 2 * strength);
    for (let i = 0; i < nS; i++) {
      const s = r.range(0.22, 0.46) * (0.75 + 0.35 * strength);
      fx.blood.spawn({
        pos: point.clone().addScaledVector(dir, r.range(0.02, 0.25)).add(new THREE.Vector3(r.gauss() * 0.06, r.gauss() * 0.06, r.gauss() * 0.04)),
        vel: dir.clone().multiplyScalar(r.range(0.6, 1.8)).addScaledVector(side, r.gauss() * 0.4).add(new THREE.Vector3(0, r.range(0.1, 0.8), 0)),
        life: r.range(0.4, 0.75), size: [s, s], rot: r.next() * 6.28, spin: r.gauss() * 0.8, grow: r.range(0.4, 0.9),
        col: BLOOD_AIR.map((c) => c * r.range(0.9, 1.3)), cell: ATLAS.SPLAT[r.int(0, 3)], gravity: 1.2, drag: 1.5, fadeOut: 0.45,
      });
    }
    if (!rays) return;
    // splatter on whatever stands behind him within ~2 m
    if (exit) {
      const o = point.clone().addScaledVector(dir, 0.3);
      const d2 = dir.clone().add(new THREE.Vector3(0, -0.15, 0)).normalize();
      const h = rays.raycast(o, d2, 2.2);
      if (h) fx.decals.blood(h.point, h.normal, r.range(0.35, 0.75) * (0.8 + 0.3 * strength));
    }
    // on the street where the spray comes down
    const gp = point.clone().addScaledVector(dir, r.range(0.6, 1.8)).addScaledVector(side, r.gauss() * 0.3);
    gp.y = groundAt(gp.x);
    fx.decals.blood(gp, new THREE.Vector3(0, 1, 0), r.range(0.3, 0.6));
  }

  // queue a pool under a corpse; it starts once the body is on the street
  pool(hood, delay = 0.9) {
    this.pending.push({ hood, t: delay });
  }

  update(dt) {
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const P = this.pending[i];
      P.t -= dt;
      if (P.t > 0) continue;
      this.pending.splice(i, 1);
      const h = P.hood;
      // under the chest: between the hips and the neck, on the street
      const a = new THREE.Vector3().setFromMatrixPosition(h.bones.hips.matrixWorld);
      const b = new THREE.Vector3().setFromMatrixPosition(h.bones.neck.matrixWorld);
      const c = a.lerp(b, 0.6);
      c.y = groundAt(c.x);
      this.fx.decals.pool(c, this.rng.range(1.0, 1.35), this.rng.range(4.5, 5.5));
    }
  }

  clear() { this.pending.length = 0; }
}

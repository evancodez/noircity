import * as THREE from 'three';
import { FIRE } from './fxTextures.js';
import { BLOOD_AIR } from './Blood.js';
import { accent } from '../render/accents.js';

// The story's small effects (lane 3's brief P0.3), reached through the
// stage's effects (game.fx):
//   fx.pour.start({ from: Object3D, to: Object3D, accent: 'amber', rate }) / fx.pour.stop()
//       a thin stream from a bottle's mouth into a glass
//   fx.cig.wisp(tipPos)            a thread of smoke off a cigarette's tip
//   fx.cig.exhale(mouthPos, dir)   a plume breathed out, drifting up
//   fx.hit.punch(pos, dir, power)  a fist landing: a small white burst, at
//                                  power > 0.7 a few drops of blood
// FOUNDATION STUB (lane 3 owns src/fx/**): each draws something plain with
// the existing particle systems (debris for the stream, smoke washes, the
// white sparks, blood). Their draws come from forks of their own, never
// from the stage's shared rng (the battle's draws stay the battle's).
const _a = new THREE.Vector3(), _b = new THREE.Vector3();

// where a prop's stream leaves / lands: the top of its box
function topOf(o, out) {
  o.getWorldPosition(out);
  const s = o.userData && o.userData.size;
  out.y += s ? s.y * (o.userData.kind === 'tumbler' ? 0.7 : 1) : 0.1;
  return out;
}

export class Pour {
  constructor(fx) { this.fx = fx; this.rng = fx.world.rng.fork(7101); this.on = null; }
  start({ from, to, accent: key = 'amber', rate = 1 } = {}) {
    const c = accent(key);
    this.on = { from, to, rate, col: [c.r * 2, c.g * 2, c.b * 2], acc: 0 };
  }
  stop() { this.on = null; }
  get active() { return !!this.on; }
  update(dt) {
    const P = this.on;
    if (!P || !P.from || !P.to) return;
    const r = this.rng;
    topOf(P.from, _a); topOf(P.to, _b);
    P.acc += dt * 90 * P.rate;
    while (P.acc >= 1) {
      P.acc -= 1;
      const u = r.next();
      this.fx.debris.spawn({
        pos: _a.clone().lerp(_b, u), vel: new THREE.Vector3(0, -0.4, 0), life: 0.06, size: [0.006, 0.014], rot: 0, spin: 0,
        col: P.col, cell: 12, gravity: 0, fadeOut: 0.02, lit: 1, litT: 0.05,
      });
    }
  }
}

export class Cig {
  constructor(fx) { this.fx = fx; this.rng = fx.world.rng.fork(7102); }
  wisp(tip) {
    const r = this.rng;
    this.fx.smoke.spawn({
      pos: tip.clone(), vel: new THREE.Vector3(r.gauss() * 0.01, r.range(0.12, 0.2), r.gauss() * 0.01), life: r.range(1.6, 2.4),
      size: [0.02, 0.05], grow: 0.08, rot: r.next() * 6.28, spin: r.gauss() * 0.2, col: [0.05, 0.05, 0.05], alpha: 0.35,
      drag: 0.4, fadeIn: 0.1, fadeOut: 0.8, cell: FIRE.SMOKE[r.int(0, 3)],
    });
  }
  exhale(mouth, dir = new THREE.Vector3(0, 0, -1)) {
    const r = this.rng;
    for (let k = 0; k < 5; k++) {
      this.fx.smoke.spawn({
        pos: mouth.clone().addScaledVector(dir, 0.05 + k * 0.06), vel: dir.clone().multiplyScalar(r.range(0.3, 0.5)).add(new THREE.Vector3(0, r.range(0.08, 0.15), 0)),
        life: r.range(2, 3), size: [0.08, 0.08], grow: 0.2, rot: r.next() * 6.28, spin: r.gauss() * 0.2, col: [0.06, 0.06, 0.06], alpha: 0.3,
        drag: 1.2, fadeIn: 0.1, fadeOut: 1.0, cell: FIRE.SMOKE[r.int(0, 3)],
      });
    }
  }
}

export class Punch {
  constructor(fx) { this.fx = fx; this.rng = fx.world.rng.fork(7103); }
  punch(pos, dir = new THREE.Vector3(0, 0, -1), power = 0.5) {
    const r = this.rng;
    for (let k = 0; k < 10; k++) {
      const v = new THREE.Vector3(r.gauss(), r.gauss(), r.gauss()).normalize().multiplyScalar(r.range(0.6, 1.8)).addScaledVector(dir, 0.8);
      this.fx.sparks.spawn({ pos: pos.clone(), vel: v, life: r.range(0.04, 0.08), size: [0.012, 0.02], stretch: 0.02, col: [4, 4, 4], cell: 4, gravity: 0, fadeOut: 0.03 });
    }
    if (power > 0.7) {
      for (let k = 0; k < 4; k++) {
        const v = new THREE.Vector3(r.gauss() * 0.6, r.range(0.2, 1.0), r.gauss() * 0.6).addScaledVector(dir, 1.2);
        this.fx.blood.spawn({ pos: pos.clone(), vel: v, life: r.range(0.4, 0.7), size: [0.01, 0.016], col: BLOOD_AIR, cell: 0, gravity: 9.8, ground: 0.16, fadeOut: 0.1 });
      }
    }
  }
}

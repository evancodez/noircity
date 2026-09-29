import * as THREE from 'three';

// Light exposure (docs/story/CONTRACTS.md §10): how lit a point is by the
// stage's lamps, for stealth (wave B) and anything else that asks.
//   game.exposure.at(pos, { los: true }) -> 0..1
//   game.exposure.player -> { value, lamp }   chest and head, smoothed 0.15 s
// Computed on the CPU from the stage's light registry (stage.lights: the
// lamps' position, beam direction, half angle, range, intensity, enabled):
// inside a beam the light falls with the distance down it and toward its
// edge; one ray per lamp (the stage's ray world) shadows it. A lamp that is
// shot out or switched off has intensity 0 and stops counting.
// (FOUNDATION: working and plain; lane 7 owns the rules that read it)
const _d = new THREE.Vector3(), _p = new THREE.Vector3();

export class Exposure {
  constructor(game) {
    this.game = game;
    this._player = { value: 0, lamp: null };
    this._t = -1;
  }

  // one lamp's light at pos (0..1, unshadowed)
  lampAt(e, pos) {
    _d.subVectors(pos, e.position);
    const dist = _d.length();
    if (dist > e.range * 1.25 || dist < 1e-4) return dist < 1e-4 ? e.intensity : 0;
    _d.divideScalar(dist);
    const omni = e.halfAngle >= Math.PI * 0.99;
    const cosA = omni ? 1 : _d.dot(e.direction);
    const edge = omni ? 1 : THREE.MathUtils.smoothstep(cosA, Math.cos(e.halfAngle * 1.25), Math.cos(e.halfAngle * 0.6));
    const fall = 1 - THREE.MathUtils.smoothstep(dist, e.range * 0.4, e.range * 1.25);
    return e.intensity * edge * fall;
  }

  // light at a point: the sum of the lamps that reach it, 0..1; with los
  // each one is tested for a clear line (a wall, a car, a crate shadows it)
  at(pos, { los = true, best = null } = {}) {
    const G = this.game, S = G.stage;
    let sum = 0, top = 0;
    for (const e of S.lights.entries) {
      if (!e.enabled || !(e.intensity > 0)) continue;
      let k = this.lampAt(e, pos);
      if (k <= 0.01) continue;
      if (los) {
        _p.subVectors(pos, e.position);
        const d = _p.length();
        _p.divideScalar(d);
        if (G.rays.raycast(e.position, _p, d - 0.3, { anyHit: true })) k = 0;
      }
      sum += k;
      if (best && k > top) { top = k; best.lamp = e; }
    }
    return Math.min(1, sum);
  }

  // the player: sampled at the chest and the head, smoothed over ~0.15 s
  // (computed when asked, at most once a step)
  get player() {
    const G = this.game, P = this._player;
    if (this._t === G.time) return P;
    const dt = this._t < 0 ? 1 : Math.max(0, G.time - this._t);
    this._t = G.time;
    const eye = G.eye, hit = { lamp: null };
    const head = this.at(eye, { best: hit });
    const chest = this.at(_p.copy(eye).setY(eye.y - 0.45), {});
    const v = Math.max(head, chest);
    P.value += (v - P.value) * (1 - Math.exp(-dt / 0.15));
    P.lamp = hit.lamp;
    return P;
  }
}

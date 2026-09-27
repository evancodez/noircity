import * as THREE from 'three';

// Waves of Hoods: 3, 5, 7, 9 ... (1 + 2n); heavies with Tommy guns from wave
// 3 (1, then one more every other wave). They come out of the fog down the
// avenue, from behind cars and the el's columns, 40-60 m from the player
// (out of his line of sight when possible), a few seconds apart, at most 12
// alive at once.
export function waveSize(n) { return 1 + 2 * n; }
export function waveHeavies(n) { return n >= 3 ? Math.min(3, Math.floor((n - 1) / 2)) : 0; }
export const MAX_ALIVE = 12;

export class Spawner {
  constructor(game) {
    this.game = game;
    this.rng = game.world.rng.fork(1777);
    this.wave = 0;
    this.toSpawn = 0;
    this.heaviesLeft = 0;
    this.timer = 0;
    this.enabled = true;
    // candidate spots: open nav cells every ~3 m over the block, plus the
    // cover points (behind a car / column); scored per spawn
    const nav = game.nav;
    this.spots = [];
    const B = game.world.colliders.bounds;
    for (let z = B.maxZ - 2; z > B.minZ + 2; z -= 3) {
      for (let x = B.minX + 1; x < B.maxX - 1; x += 3) {
        if (nav.free(x, z)) this.spots.push({ x, z, behind: false });
      }
    }
    for (const c of game.covers.points) this.spots.push({ x: c.x, z: c.z, behind: true, cover: c });
  }

  startWave(n) {
    this.wave = n;
    this.toSpawn = waveSize(n);
    this.heaviesLeft = waveHeavies(n);
    this.timer = 0.4;
  }

  get done() { return this.toSpawn === 0; }

  pickSpot() {
    const G = this.game, p = G.camera.position, r = this.rng;
    const cands = [];
    for (const s of this.spots) {
      const d = Math.hypot(s.x - p.x, s.z - p.z);
      if (d < 40 || d > 60) continue;
      // not on top of another Hood
      let near = false;
      for (const h of G.world.hoods.list) if (h.alive && Math.hypot(h.pos.x - s.x, h.pos.z - s.z) < 2.5) { near = true; break; }
      if (near) continue;
      cands.push({ s, d, score: (s.behind ? 2 : 0) + (d < 47 ? 2 : 0) + r.next() * 3 });
    }
    if (!cands.length) {
      // a short block: the farthest open spots
      let best = null, bd = 0;
      for (const s of this.spots) {
        const d = Math.hypot(s.x - p.x, s.z - p.z) + r.next() * 4;
        if (d > bd) { bd = d; best = s; }
      }
      return best;
    }
    cands.sort((a, b) => b.score - a.score);
    // prefer spots the player cannot see (out of the fog / behind cover)
    for (let i = 0; i < Math.min(6, cands.length); i++) {
      const s = cands[i].s;
      const e = new THREE.Vector3(s.x, 1.6, s.z);
      const dir = new THREE.Vector3().subVectors(p, e);
      const d = dir.length();
      dir.divideScalar(d);
      if (d > 48 || G.rays.raycast(e, dir, d - 0.5, { anyHit: true })) return s;
    }
    return cands[0].s;
  }

  update(dt) {
    if (!this.enabled || this.toSpawn <= 0) return;
    this.timer -= dt;
    if (this.timer > 0) return;
    const alive = this.game.world.hoods.list.filter((h) => h.alive).length;
    if (alive >= MAX_ALIVE) { this.timer = 0.5; return; }
    const s = this.pickSpot();
    if (!s) { this.timer = 0.5; return; }
    // the last ones of a wave are the heavies
    const heavy = this.heaviesLeft > 0 && this.toSpawn <= this.heaviesLeft;
    this.game.spawnHood(s.x, s.z, { heavy });
    if (heavy) this.heaviesLeft--;
    this.toSpawn--;
    this.timer = this.rng.range(0.7, 1.6);
  }
}

import * as THREE from 'three';
import { GASWORKS, SPECIAL, RIVER, DISTRICTS } from '../world/plan.js';
import { riverNearest } from '../world/cityGen.js';

// The city's own sound (lane O7, docs/seams/NIGHT.md §4): each thing placed
// where it is and heard at its distance, never on top of the game's own
// sounds (nothing new starts while there is heat, a fight or a warning):
//   the gasworks' hum      a low loop at the holders, within 300 m
//   the river's lap        a soft loop at the quay's edge nearest me, within 90 m
//   the market's voices    a crowd's murmur under the hall's roof, within 140 m
//   a ship's horn          now and then, out on the river (heard everywhere, far)
//   the Hill's bell        on the night's hour, from the Hill, the hour's strokes
//   a siren, far off       now and then at no heat (the city's, not mine)
// (the rain's rise and fall, the el's rumble overhead and the thunder are
// the base's: Sfx's gusts, the train part's rumble, the storm)
export const AMB = { horn: [70, 150], siren: [80, 170], murmurEvery: 5.2, check: 0.5 };
const _p = new THREE.Vector3();

export class Ambience {
  constructor(night) {
    this.night = night;
    this.t = 0;
    this.hornT = 40; this.sirenT = 60; this.murT = 0;
    this.bellQ = [];
    // (the market hall in the Tenements and the fish market's shed on the quay)
    this.markets = SPECIAL.filter((s) => s.id === 'marketHall' || s.id === 'fishmarket').map((H) => ({ x: (H.rect[0] + H.rect[1]) / 2, z: (H.rect[2] + H.rect[3]) / 2 }));
    const hill = DISTRICTS.find((d) => d.id === 'hill');
    this.bell = hill ? { x: (Math.max(hill.rect[0], -560) + Math.min(hill.rect[1], 420)) / 2, z: Math.max(hill.rect[2], -560) + 60 } : { x: -150, z: -500 };
    const gx = GASWORKS.holders.reduce((a, h) => a + h.x, 0) / GASWORKS.holders.length, gz = GASWORKS.holders.reduce((a, h) => a + h.z, 0) / GASWORKS.holders.length;
    this.gas = { x: gx, z: gz };
    night.game.on('night:hour', (e) => { if (e && e.hour != null) { const n = ((e.hour + 11) % 12) + 1; for (let i = 0; i < n; i++) this.bellQ.push(i * 2.6); } });
  }

  get sfx() { return this.night.game.sfx; }
  // (the game's own sounds have the stage: heat, a fight, a warning)
  get busy() { const G = this.night.game, P = G.police; return (P && P.heat > 0) || (G.brawl && G.brawl.active) || (G.director && G.director.active) || !!G.hud.warnText || !!G.failing; }

  step(dt) {
    const N = this.night, G = N.game, S = this.sfx;
    if (!S || !S.live || !N.inCity) { this.stopAll(); return; }
    const e = G.eye;
    this.t += dt;
    // the bell's strokes (queued by the hour), spaced
    if (this.bellQ.length) {
      this.bellQ = this.bellQ.map((x) => x - dt);
      while (this.bellQ.length && this.bellQ[0] <= 0) { this.bellQ.shift(); if (!this.busy) S.play('n_bell', _p.set(this.bell.x, 30, this.bell.z), { f: 196 }, { ref: 60, roll: 0.6, max: 2000 }); }
    }
    if (this.t < AMB.check) return;
    const step = this.t; this.t = 0;
    // the loops: on within reach, off beyond
    const dg = Math.hypot(e.x - this.gas.x, e.z - this.gas.z);
    if (dg < 300) S.loop('n_gas', _p.set(this.gas.x, 12, this.gas.z), 0.5, 'brown', 140, 35, true); else if (S.loops.has('n_gas')) S.stopLoop('n_gas');
    const R = riverNearest(e.x, e.z);
    const qx = R.x + R.nx * (RIVER.hw + 20), qz = R.z + R.nz * (RIVER.hw + 20);
    const dr = Math.hypot(e.x - qx, e.z - qz);
    if (dr < 90) S.loop('n_lap', _p.set(qx, -1.5, qz), 0.16, 'pink', 700, 120, true); else if (S.loops.has('n_lap')) S.stopLoop('n_lap');
    if (this.busy) return;
    // the market's voices under its roof
    this.murT -= step;
    for (const M of this.markets) {
      const dm = Math.hypot(e.x - M.x, e.z - M.z);
      if (dm < 140 && this.murT <= 0) { this.murT = AMB.murmurEvery; S.play('n_murmur', _p.set(M.x, 3, M.z), {}, { ref: 14, roll: 1, send: false }); }
    }
    // a ship's horn, out on the river; a siren a long way off
    this.hornT -= step; this.sirenT -= step;
    if (this.hornT <= 0) {
      this.hornT = AMB.horn[0] + Math.random() * (AMB.horn[1] - AMB.horn[0]);
      S.play('n_horn', _p.set(R.x + R.nx * 180, 4, R.z + R.nz * 180), {}, { ref: 90, roll: 0.5, max: 3000, street: true });
    }
    if (this.sirenT <= 0) {
      this.sirenT = AMB.siren[0] + Math.random() * (AMB.siren[1] - AMB.siren[0]);
      const a = Math.random() * Math.PI * 2;
      S.play('n_siren', _p.set(e.x + Math.cos(a) * 520, 5, e.z + Math.sin(a) * 520), {}, { ref: 80, roll: 0.6, max: 3000, street: true });
    }
  }

  stopAll() {
    const S = this.sfx;
    if (!S || !S.live) return;
    for (const k of ['n_gas', 'n_lap']) if (S.loops.has(k)) S.stopLoop(k);
  }
}

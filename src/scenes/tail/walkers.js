import * as THREE from 'three';
import { makeUmbrella } from '../watcher/umbrella.js';
import { NS, EW, riverPoint, riverSAtZ, RIVER } from '../../stages/city/plan.js';

// A few people out in the rain (lane C3): figures under umbrellas walking
// the pavements along his way, who get out of the way of a car - they are
// never run down: one coming at them, they jump clear (a quick dash to the
// wall, a start, then on). The cast's own figures (couple_him, oldman,
// couple_her), the watcher's umbrella in the right hand. Three at most: the
// budget is eight figures for the whole frame.
//   new Walkers(chase); walkers.step(dt); walkers.dispose()
const KINDS = ['couple_him', 'oldman', 'couple_her'];
// the pavements they walk: [x0, z0, x1, z1] (on his way: Cooper's west
// pavement, Baxter's east, Water St's east, the river road's quay)
function stretches() {
  const rq = (z) => riverPoint(riverSAtZ(z), -(RIVER.hw + 1.6));
  const a = rq(-120), b = rq(-70);
  return [
    [NS.cooper.x - NS.cooper.hw - 1.4, EW.harbor.z - 22, NS.cooper.x - NS.cooper.hw - 1.4, EW.clock.z + 18],
    [NS.baxter.x + NS.baxter.hw + 1.4, EW.canal.z + 30, NS.baxter.x + NS.baxter.hw + 1.4, EW.market.z - 18],
    [NS.water.x + NS.water.hw + 1.4, EW.clock.z - 14, NS.water.x + NS.water.hw + 1.4, EW.market.z + 18],
    [a.x, a.z, b.x, b.z],
  ];
}
const _p = new THREE.Vector3();

export class Walkers {
  constructor(chase, { n = 3 } = {}) {
    this.chase = chase;
    this.game = chase.game;
    this.list = [];
    const st = chase.stage, cast = st.cast, rng = chase.ctx.rng.fork(8800);
    const S = stretches();
    for (let i = 0; i < n && i < S.length; i++) {
      const kind = KINDS[i % KINDS.length];
      if (!cast.has(kind)) continue;
      const [x0, z0, x1, z1] = S[i];
      const u = rng.next();
      const x = x0 + (x1 - x0) * u, z = z0 + (z1 - z0) * u;
      const dir = rng.next() < 0.5 ? 1 : -1;
      const yaw = Math.atan2((x1 - x0) * dir, (z1 - z0) * dir);
      let c;
      try { c = cast.spawn(kind, { at: { x, z }, yaw }); } catch (e) { continue; }
      if (!c) continue;
      const umb = makeUmbrella(st);
      umb.hold(c.fig);
      const w = { c, umb, seg: S[i], dir, mode: 'walk', t: 0, jumpT: 0, startT: 0 };
      this.walk(w);
      this.list.push(w);
    }
  }

  dispose() {
    for (const w of this.list) { if (w.umb.group.parent) w.umb.group.parent.remove(w.umb.group); }
    this.list = [];
  }

  walk(w, speed = 1.15) {
    const c = w.c, F = c.fig;
    c.clipH = null; c.base = 'walk'; c.state = 'walk';
    try { c._anim('walk', 0.25); } catch (e) { /* */ }
    if (c.costumed && F.anim && F.anim.setOverlay) F.anim.setOverlay('carry', 0.25);
    F.speed = speed;
  }
  stand(w) {
    const c = w.c, F = c.fig;
    F.speed = 0;
    c.clipH = null; c.base = 'idle'; c.state = 'idle';
    try { c._anim('idle', 0.2); } catch (e) { /* */ }
  }

  step(dt) {
    const C = this.chase, cars = [C.my, C.his, ...(C.traffic ? C.traffic.cars.map((x) => x.v) : [])].filter(Boolean);
    for (const w of this.list) {
      const F = w.c.fig;
      w.t += dt;
      const [x0, z0, x1, z1] = w.seg;
      // a car coming at me: where it will be in the next second
      let threat = null;
      for (const v of cars) {
        const sp = Math.hypot(v.vel.x, v.vel.z);
        if (sp < 1.5) continue;
        for (const tt of [0.2, 0.45, 0.75, 1.0]) {
          _p.set(F.pos.x - (v.pos.x + v.vel.x * tt), 0, F.pos.z - (v.pos.z + v.vel.z * tt));
          const c = Math.cos(v.yaw), s = Math.sin(v.yaw);
          const lx = _p.x * c - _p.z * s, lz = _p.x * s + _p.z * c;
          if (Math.abs(lx) < v.spec.halfL + 1.1 && Math.abs(lz) < v.spec.halfW + 1.1) { threat = { v, lz }; break; }
        }
        if (threat) break;
      }
      if (threat && w.mode !== 'jump') {
        // jump clear: away from the car's line, fast, to the wall's side
        const v = threat.v, c = Math.cos(v.yaw), s = Math.sin(v.yaw);
        const side = threat.lz >= 0 ? 1 : -1;
        const rx = s * side, rz = c * side;    // (the car's right, toward me)
        w.mode = 'jump'; w.jumpT = 0.55;
        F.yaw = Math.atan2(rx, rz);
        F.speed = 4.2;
        w.c.base = 'run'; w.c.state = 'run';
        try { w.c._anim('run', 0.08); } catch (e) { /* */ }
        if (this.game.sfx && Math.random() < 0.6) this.game.sfx.play('grunt', F.pos.clone().setY(1.5), { f0: 150, k: 0.25, dur: 0.12 }, { ref: 4 });
      }
      if (w.mode === 'jump') {
        w.jumpT -= dt;
        if (w.jumpT <= 0) { w.mode = 'start'; w.startT = 1.4; this.stand(w); }
      } else if (w.mode === 'start') {
        w.startT -= dt;
        if (w.startT <= 0) { w.mode = 'walk'; this.walk(w); }
      } else {
        // along the pavement; at its end, about and back
        const tx = w.dir > 0 ? x1 : x0, tz = w.dir > 0 ? z1 : z0;
        if (Math.hypot(tx - F.pos.x, tz - F.pos.z) < 1.2) w.dir = -w.dir;
        const want = Math.atan2((w.dir > 0 ? x1 - x0 : x0 - x1), (w.dir > 0 ? z1 - z0 : z0 - z1));
        let dy = want - F.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        F.yaw += Math.sign(dy) * Math.min(Math.abs(dy), 3 * dt);
        // (kept on the pavement's line)
        const L = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / L, uz = (z1 - z0) / L;
        const along = (F.pos.x - x0) * ux + (F.pos.z - z0) * uz;
        const px = x0 + ux * along, pz = z0 + uz * along;
        F.pos.x += (px - F.pos.x) * Math.min(1, dt * 1.5); F.pos.z += (pz - F.pos.z) * Math.min(1, dt * 1.5);
      }
      // never under a car: out of any car's box, whatever happened
      for (const v of cars) {
        const c = Math.cos(v.yaw), s = Math.sin(v.yaw);
        const dx = F.pos.x - v.pos.x, dz = F.pos.z - v.pos.z;
        const lx = dx * c - dz * s, lz = dx * s + dz * c;
        const hx = v.spec.halfL + 0.4, hz = v.spec.halfW + 0.4;
        if (Math.abs(lx) < hx && Math.abs(lz) < hz) {
          const nz = (lz >= 0 ? 1 : -1) * hz;
          F.pos.x = v.pos.x + lx * c + nz * s; F.pos.z = v.pos.z - lx * s + nz * c;
        }
      }
      F.pos.y = this.chase.stage.surfaceY(F.pos.x, F.pos.z);
      w.umb.update(dt);
    }
  }
}

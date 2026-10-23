import * as THREE from 'three';
import { FLOOR } from '../../city/kits/interior/kit.js';
import { crates, label } from '../../city/kits/interior/pieces.js';
import { RNG } from '../../util/rng.js';

// The market hall (the Tenements; brief O5 §2.9): one high hall under its
// iron roof, the stalls in rows down its length (their awnings, their
// crates of fruit, their scales), the lamps hung in lines over the aisles,
// the crowd, the gallery along the west wall up its stairs (its rail, the
// hall below), a second door out the far side. E at a fruit stall: an apple
// (a little health); at the paper stand: tonight's paper.
const HEADLINES = ['RAIN TILL MONDAY', 'DOCK STRIKE TALKS FAIL', 'MAYOR: CITY IS CLEAN', 'TWO HELD IN BANK JOB', 'HEAT WAVE? NOT HERE', 'BRIDGE STAYS UP', 'GANG WAR FEARED', 'FIGHT NIGHT AT THE GYM'];
export default {
  kind: 'hall',
  spawn: { x: 0, z: -2.0, yaw: 0 },
  build(K, s, P) {
    const b = s.lb, R0 = new RNG(0x4A11), rng = () => R0.next();
    const x0 = b.x0 + 0.6, x1 = b.x1 - 0.6, z0 = b.z0 + 0.6, z1 = -0.3, H = Math.min(9.0, s.lot.h - 1.0);
    K.roomRect = { x0, x1, z0, z1 };
    K.room(x0, x1, z0, z1, { h: H, floor: 'concrete', wall: 'plaster', ceil: 'dark', look: { ambient: 0.5, haze: 0.45, room: 'o5_hall' }, sides: { s: { holes: P.doorHoles(s, 's') }, n: { holes: P.doorHoles(s, 'n') } } });
    // the roof's iron trusses across the hall
    for (let z = z0 + 4; z < z1 - 2; z += 6) { K.box('iron', x0, x1, FLOOR + H - 0.8, FLOOR + H - 0.6, z - 0.08, z + 0.08, 2); for (let x = x0 + 2; x < x1 - 1; x += 4) K.add('iron', new THREE.BoxGeometry(0.05, 0.9, 0.05).rotateZ(((x / 4) | 0) % 2 ? 0.6 : -0.6).translate(x, FLOOR + H - 0.25, z), 2); }
    // the stalls: blocks either side of the middle aisle and along the outer aisles
    const lanes = [[-6.5, -3.0], [3.0, 6.5], [x0 + 5.4, x0 + 8.9], [x1 - 8.9, x1 - 5.4]].filter(([a, c]) => a > x0 + 4.5 && c < x1 - 0.5);
    const stalls = [];
    for (const [a, c] of lanes) {
      for (let z = -6.0; z > z0 + 4.0; z -= 5.5) {
        const za = z - 3.6, zb = z;
        // the counter, its crates of produce (spheres heaped), the awning's frame over it
        K.box('wood', a, c, FLOOR, FLOOR + 0.95, za, zb, 1);
        K.box('woodHi', a - 0.1, c + 0.1, FLOOR + 0.95, FLOOR + 1.0, za - 0.1, zb + 0.1, 1);
        K.solid(a, c, za, zb);
        const k = stalls.length % 4;
        for (let i = 0; i < 6; i++) { const px = a + 0.4 + (i % 3) * ((c - a - 0.8) / 2), pz = za + 0.7 + Math.floor(i / 3) * 2.0; K.box('wood', px - 0.35, px + 0.35, FLOOR + 1.0, FLOOR + 1.22, pz - 0.5, pz + 0.5, 1); if (k < 3) for (let j = 0; j < 7; j++) K.add(k === 1 ? 'linen' : 'leather', new THREE.SphereGeometry(0.07 + rng() * 0.03, 8, 6).translate(px - 0.22 + rng() * 0.44, FLOOR + 1.27, pz - 0.35 + rng() * 0.7), 3); }
        for (const [px, pz] of [[a, za], [c, za], [a, zb], [c, zb]]) K.cyl('iron', px, FLOOR, FLOOR + 2.6, pz, 0.04, 0.04, 6, 2);
        K.box('cloth', a - 0.3, c + 0.3, FLOOR + 2.6, FLOOR + 2.65, za - 0.3, zb + 0.3, 2);
        stalls.push({ a, c, za, zb, k, x: (a + c) / 2, z: (za + zb) / 2 });
      }
    }
    // the lamps over the aisles
    for (const x of [0, x0 + 4.0, x1 - 4.0]) for (let z = -4.0; z > z0 + 2; z -= 7.5) K.lamp(x, FLOOR + 4.6, z, { kind: 'pendant', power: 0.9, ceilY: FLOOR + H, drop: 4.6 });
    // the gallery along the west wall: its floor on posts, its rail, the stairs up from the front
    const gx1 = x0 + 3.2, gy = FLOOR + 3.6, gz0 = z0 + 1.0, gz1 = -9.0;
    K.at(1);
    K.floor(x0, gx1, gz0, gz1, gy, 'boards', { slab: 0.2, lvl: 1 });
    K.rail(gx1, gz0, gx1, gz1 - 2.6, gy, { lvl: 1 });
    K.rail(x0, gz1, gx1 - 1.2, gz1, gy, { lvl: 1 });
    for (let z = gz0 + 2; z < gz1 - 1; z += 6) { K.box('crates' in K.mats ? 'wood' : 'wood', x0 + 0.5, x0 + 1.4, gy, gy + 0.8, z - 0.5, z + 0.5, 1); K.solid(x0 + 0.5, x0 + 1.4, z - 0.5, z + 0.5, { lvl: 1 }); }
    K.lamp(x0 + 1.6, gy + 2.4, (gz0 + gz1) / 2, { kind: 'bare', power: 0.5, ceilY: FLOOR + H });
    K.at(0);
    for (let z = gz0 + 0.3; z < gz1; z += 4) { K.cyl('iron', gx1 - 0.1, FLOOR, gy - 0.2, z, 0.09, 0.09, 8, 2); K.post(gx1 - 0.1, z, 0.12); }
    // (under the gallery: the stores, crates)
    crates(K, x0 + 0.8, gz0 + 3.0, { n: 2, s: 0.9, rng });
    K.at(null);
    K.stairs(gx1 - 1.2, gx1, gz1 - 0.05, gz1 + 3.2, FLOOR, gy, 'n', { key: 'wood', lvl: 0 });
    K.rail(gx1 + 0.02, gz1, gx1 + 0.02, gz1 + 3.2, FLOOR, { h: 0.95, solid: true, lvl: null });
    // (the gallery's rail turns down the stairs' side; the stairs' underside a wall at the floor)
    K.solid(gx1 - 1.3, gx1 - 1.2, gz1, gz1 + 3.2, { lvl: 0 });
    // the paper stand by the door; the fruit stall's man
    const ns = [3.0, -2.0];
    K.box('wood', ns[0] - 0.5, ns[0] + 0.5, FLOOR, FLOOR + 1.05, ns[1] - 0.4, ns[1] + 0.4, 1);
    K.box('linen', ns[0] - 0.45, ns[0] + 0.45, FLOOR + 1.05, FLOOR + 1.12, ns[1] - 0.35, ns[1] + 0.35, 3);
    K.solid(ns[0] - 0.5, ns[0] + 0.5, ns[1] - 0.4, ns[1] + 0.4);
    K.use({ at: [ns[0], FLOOR + 1.1, ns[1]], range: 2.0, cone: 0.5, prompt: 'tonight’s paper', onUse: () => {
      const G = P.game, h = HEADLINES[(s.state.paper = ((s.state.paper ?? Math.floor(Math.random() * HEADLINES.length)) + 1) % HEADLINES.length)];
      G.sfx.play('newspaper', null, {}, { ref: 1 }); G.hud.message(h, 2.4);
    } });
    label(K, 'MARKET HALL', 0, FLOOR + 4.2, z1 - 0.0, { w: 3.0, h: 0.6, dir: 'n', dark: true });
    const fruit = stalls.find((t) => t.k === 0);
    if (fruit) {
      const fx = fruit.c + 0.6, fz = fruit.z;
      K.fig('docker', fx - 1.15, fz, -Math.PI / 2, { name: 'grocer', state: 'idle' });
      K.use({ at: [fruit.c, FLOOR + 1.2, fz], range: 2.2, cone: 0.5, prompt: 'an apple: $1', onUse: () => { const G = P.game; if (!P.buy(s, 1, 'an apple', 'He tosses you one.')) return; G.health.hp = Math.min(100, G.health.hp + 10); G.sfx.play('coin', null, {}, { ref: 1 }); } });
    }
    // the crowd: shoppers at the stalls, a vendor or two
    const people = [['oldman', 1.9, -9.0, -Math.PI / 2, 'idle'], ['couple_her', -1.8, -14.0, Math.PI / 2, 'idle'], ['couple_him', -1.6, -15.0, Math.PI / 2, 'idle'], ['dockhand', 1.9, -20.0, -Math.PI / 2, 'idle']];
    for (const [k, x, z, y, st] of people) K.fig(k, x, z, y, { name: k + Math.round(z), state: st });
    K.stallsAt = stalls;
  },
  live(K, s, P) {
    // the shoppers drift from stall to stall down the middle aisle
    const G = P.game, F = s.frame;
    const walkers = () => s.live.cast.filter((c) => /^hall_(couple|oldman|dockhand)/.test(c.name));
    let t = 0;
    return {
      step(dt) {
        t += dt;
        for (const c of walkers()) {
          if (!c.alive || c.down) continue;
          const W = c._w || (c._w = { t: 0, next: 3 + Math.random() * 6 });
          W.t += dt;
          if (W.go) {
            const dx = W.go.x - c.pos.x, dz = W.go.z - c.pos.z, d = Math.hypot(dx, dz);
            if (d < 0.25) { W.go = null; c.setState('idle', 0.3); c.face(Math.atan2(W.face.x - c.pos.x, W.face.z - c.pos.z)); W.t = 0; W.next = 5 + Math.random() * 8; continue; }
            const sp = 1.1 * dt;
            c.fig.pos.x += dx / d * sp; c.fig.pos.z += dz / d * sp;
            c.face(Math.atan2(dx, dz));
          } else if (W.t > W.next) {
            // (the stalls either side of the middle aisle: the way between them is clear)
            const mids = K.stallsAt.filter((q) => Math.abs(q.x) < 6);
            const st = mids[Math.floor(Math.random() * mids.length)];
            if (!st) continue;
            const side = st.x < 0 ? 1 : -1;
            const gx = side > 0 ? st.c + 0.7 : st.a - 0.7, gz = st.z + (Math.random() - 0.5) * 2.0;
            const p = F.w(gx, gz), f = F.w(st.x, gz);
            W.go = { x: p.x, z: p.z }; W.face = f;
            c.setState('walk', 0.3);
          }
        }
        void t; void G;
      },
    };
  },
};

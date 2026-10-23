import * as THREE from 'three';
import { FLOOR } from '../../city/kits/interior/kit.js';
import { label, litWindow, chair, sheet, crates } from '../../city/kits/interior/pieces.js';
import { RNG } from '../../util/rng.js';

// A tenement stairwell (the Tenements, three of them; brief O5 §2.11): the
// street door, the mailboxes, the stairs up - a flight to the half landing,
// a flight back - four floors and more (as high as the house is), a lamp on
// every landing, three doors on each (one in three opens: a hall, a window
// onto the street, nothing taken; the rest rattle, locked), and at the top
// the door to the roof: the roof, its parapet, the city round it, and the
// fire escape down to the street. No two alike (the walls' paint, the lamps,
// what stands in the hall below, how many floors - a seeded variant each).
const PAINT = ['paper', 'plaster', 'paper'];
const LAMP = ['cage', 'bare', 'globe'];
export default {
  kind: 'stair',
  spawn: { x: 0.2, z: -1.2, yaw: 0.2 },
  build(K, s, P) {
    const v = s.variant || 0, b = s.lb, R0 = new RNG(0x57A1 + v * 77), rng = () => R0.next();
    const H = s.lot.h, N = Math.max(4, Math.round((H - FLOOR) / 3.3)), fh = (H - FLOOR) / N;
    const L0 = -1.4, L1 = 1.6, zF = -0.3, zA = -2.2, zB = -4.4, zH = -5.6, mid = 0.08, t = 0.24;
    const paint = PAINT[v % 3], lampKind = LAMP[v % 3];
    K.roomRect = { x0: L0, x1: L1, z0: zH, z1: zF };
    const y = (k) => FLOOR + k * fh;
    // the well between the flights (full height), the shaft's walls floor by floor (each floor's own)
    K.at(null);
    K.wall('z', 0, zB, zA, FLOOR, H, { t: mid * 2, key: paint });
    K.volume(L0, L1, zH, zF, FLOOR, H + 2.7, { ambient: 0.35, haze: 0.2, room: 'corridor' });
    K.halls = [];
    for (let k = 0; k <= N; k++) {
      const yk = y(k), top = k === N;
      K.at(k);
      // the floor of the front landing, the half landing over it (none above the roof's)
      if (k > 0) K.floor(L0 - t, L1 + t, zA, zF + 0.0, yk, 'boards', { slab: 0.22, lvl: k });
      else K.floor(L0 - t, L1 + t, zA, zF + 0.0, yk, 'tile', { slab: 0.2, lvl: 0 });
      if (!top) {
        K.floor(L0, L1, zH, zB, yk + fh / 2, 'boards', { slab: 0.18, lvl: k });
        K.stairs(L0, -mid, zB, zA, yk, yk + fh / 2, 'n', { key: 'wood', lvl: k });
        K.stairs(mid, L1, zB, zA, yk + fh / 2, y(k + 1), 's', { key: 'wood', lvl: k });
      }
      // (a floor's three doors: the west, the east, the back - one opens)
      const open = top ? -1 : k === 0 ? -1 : (Math.floor(rng() * 3) + k) % 3;
      const hz = [-1.75, -0.75];
      const wH = top ? 2.7 : fh;
      const holeW = k > 0 && !top ? [{ a: hz[0], b: hz[1], top: yk + 2.05 }] : [];
      const holeE = (k > 0 && !top) || top ? [{ a: hz[0], b: hz[1], top: yk + 2.05 }] : [];
      K.wall('z', L0 - t / 2, zH, zF, yk, yk + wH, { key: paint, holes: holeW });
      K.wall('z', L1 + t / 2, zH, zF, yk, yk + wH, { key: paint, holes: holeE });
      K.wall('x', zH - t / 2, L0 - t, L1 + t, yk, yk + (top ? wH : fh), { key: paint, holes: k > 0 && !top ? [{ a: L0 + 0.25, b: L0 + 1.15, top: yk + fh / 2 + 2.05, bottom: yk + fh / 2 }] : [] });
      if (top) { K.ceil(L0 - t, L1 + t, zH - t, zF, yk + wH); K.wall('x', zF + t / 2 - 0.02, L0 - t, L1 + t, yk, yk + wH, { key: 'concrete', t: 0.2 }); }
      // the lamp on the landing
      const lamp = K.lamp(0.1, yk + Math.min(2.6, fh - 0.5), -1.2, { kind: lampKind, power: 0.85, ceilY: yk + Math.min(3.1, fh - 0.05), on: !(k === 2 && v === 1) });
      if (k === 2 && v === 1) lamp.flicker = true;
      // the doors
      if (k > 0 && !top) {
        const dW = K.door({ x: L0 - t / 2, z: hz[0], axis: 'z', w: 1.0, y: yk, locked: open !== 0, name: `w${k}` });
        const dE = K.door({ x: L1 + t / 2, z: hz[0], axis: 'z', w: 1.0, y: yk, locked: open !== 1, name: `e${k}` });
        const dN = K.door({ x: L0 + 0.25, z: zH - t / 2, axis: 'x', w: 0.9, y: yk + fh / 2, locked: true, name: `n${k}` });
        label(K, String(k * 10 + 1), L0 - 0.01, yk + 2.3, -1.25, { w: 0.22, h: 0.16, dir: 'e', lit: true });
        label(K, String(k * 10 + 2), L1 + 0.01, yk + 2.3, -1.25, { w: 0.22, h: 0.16, dir: 'w', lit: true });
        void dW; void dE; void dN;
        if (open === 0 || open === 1) K.halls.push(hall(K, s, P, k, yk, open === 0 ? 'w' : 'e', { L0, L1, t, zF, paint, rng, fh }));
        else K.halls.push(null);
      }
      // the ground floor: the mailboxes, a pram (or a bicycle, or the bins) by the stairs' foot, the cupboard under the flight
      if (k === 0) {
        for (let i = 0; i < 8; i++) K.box('iron', L0 + 0.0, L0 + 0.12, FLOOR + 1.1 + (i % 4) * 0.22, FLOOR + 1.3 + (i % 4) * 0.22, -1.9 + Math.floor(i / 4) * 0.42, -1.55 + Math.floor(i / 4) * 0.42, 3);
        K.box('wood', mid, L1, FLOOR, y(0) + fh / 2 - 0.1, zB, zA, 1);
        // (the cupboard is solid at the ground only: over it runs the first flight back, on the same floor's level)
        K.cupboard = K.solid(mid, L1, zB, zA, { lvl: null }); K.cupboard.lvl = undefined;
        if (v === 0) { K.box('leather', L1 - 0.75, L1 - 0.1, FLOOR + 0.3, FLOOR + 0.85, -1.9, -0.9, 1); K.add('iron', new THREE.TorusGeometry(0.17, 0.02, 6, 14).rotateY(Math.PI / 2).translate(L1 - 0.4, FLOOR + 0.2, -1.8), 1); K.add('iron', new THREE.TorusGeometry(0.17, 0.02, 6, 14).rotateY(Math.PI / 2).translate(L1 - 0.4, FLOOR + 0.2, -1.0), 1); K.solid(L1 - 0.8, L1, -2.0, -0.8, { lvl: 0 }); }
        else if (v === 1) { for (const z of [-1.7, -0.7]) K.add('iron', new THREE.TorusGeometry(0.32, 0.025, 6, 18).rotateY(Math.PI / 2).translate(L1 - 0.12, FLOOR + 0.33, z), 1); K.box('iron', L1 - 0.15, L1 - 0.1, FLOOR + 0.3, FLOOR + 0.75, -1.7, -0.7, 1); K.solid(L1 - 0.25, L1, -2.1, -0.4, { lvl: 0 }); }
        else { for (const z of [-1.7, -1.0]) { K.cyl('iron', L1 - 0.35, FLOOR, FLOOR + 0.75, z, 0.27, 0.25, 12, 1); } K.solid(L1 - 0.65, L1, -2.0, -0.7, { lvl: 0 }); }
        sheet(K, -1.0, FLOOR + 1.6, zA - 0.0, { w: 0.4, h: 0.55, dir: 's' });
      }
    }
    // ---- the roof: its surface, the bulkhead's door out onto it, the fire escape down
    const R = N, yr = H;
    K.at(R);
    const bulk = K.doors.find((d) => false);
    void bulk;
    K.door({ x: L1 + t / 2, z: -1.75, axis: 'z', w: 1.0, y: yr, name: 'roof' });
    K.surface(b.x0 + 0.4, b.x1 - 0.4, b.z0 + 0.4, b.z1 - 0.4, yr, R);
    // (the bulkhead stands on the roof: its walls are solid there; inside it, the shaft's floor answers)
    K.solid(L0 - t, L0, zH - t, zF + t, { lvl: R }); K.solid(L0 - t, L1 + t, zH - t, zH, { lvl: R }); K.solid(L0 - t, L1 + t, zF, zF + t, { lvl: R });
    K.solid(L1, L1 + t, zH - t, -1.8, { lvl: R }); K.solid(L1, L1 + t, -0.7, zF + t, { lvl: R });
    // (the roof's surface must not answer inside the bulkhead: its own floor is the landing's)
    // a chimney stack and a skylight on the roof
    K.box('concrete', b.x1 - 2.0, b.x1 - 1.2, yr, yr + 1.6, b.z0 + 1.2, b.z0 + 2.0, 1); K.solid(b.x1 - 2.0, b.x1 - 1.2, b.z0 + 1.2, b.z0 + 2.0, { lvl: R });
    K.box('glass', b.x0 + 1.2, b.x0 + 2.6, yr, yr + 0.5, -7.0, -5.6, 1); K.solid(b.x0 + 1.2, b.x0 + 2.6, -7.0, -5.6, { lvl: R });
    // the fire escape: its ladder's top at the parapet over the street (seen from the street while loaded)
    const fx = Math.max(b.x0 + 1.0, Math.min(b.x1 - 1.0, L1 + 2.4));
    for (const sd of [-0.22, 0.22]) K.box('iron', fx + sd - 0.02, fx + sd + 0.02, FLOOR + 2.4, yr + 1.0, 0.12, 0.16, 9);
    for (let yy = FLOOR + 2.6; yy < yr + 0.9; yy += 0.32) K.box('iron', fx - 0.22, fx + 0.22, yy - 0.015, yy + 0.015, 0.13, 0.15, 9);
    K.box('iron', fx - 0.5, fx + 0.5, yr + 0.98, yr + 1.02, -0.3, 0.2, 9);
    K.use({ at: [fx, yr + 0.9, -0.2], range: 2.2, cone: 0.6, lvl: R, prompt: 'down the fire escape', onUse: () => escapeDown(K, s, P, fx, yr) });
    K.at(null);
    K.roofY = yr; K.fh = fh; K.N = N;
    label(K, v === 2 ? 'NO LOITERING' : v === 1 ? 'KEEP THE DOOR SHUT' : 'NO PEDDLERS', 0, FLOOR + 2.4, zH - 0.0 + 0.0, { w: 1.4, h: 0.3, dir: 's', lit: false });
    void litWindow; void chair; void crates;
  },
  live(K, s, P) {
    const fl = K.lamps.filter((l) => l.flicker);
    let t = 0;
    return {
      step(dt) {
        t += dt;
        if (K.cupboard) K.cupboard.gone = !(P.inside === s && P.game.controller.groundY < FLOOR + 0.5);
        for (const l of fl) { const on = Math.sin(t * 13) + Math.sin(t * 5.7) > 0.6; if (on !== l.on) l.set(on); }
        // (the roof's surface: not inside the bulkhead)
      },
    };
  },
};

// a hall behind a landing's open door: a strip along the street face, its window on the street (or a lit court), a runner, a chair, a coat on a hook
function hall(K, s, P, k, yk, side, { L0, L1, t, zF, paint, rng, fh }) {
  const b = s.lb;
  const x0 = side === 'w' ? Math.max(b.x0 + 0.4, L0 - t - 4.2) : L1 + t, x1 = side === 'w' ? L0 - t : Math.min(b.x1 - 0.4, L1 + t + 4.2);
  if (x1 - x0 < 1.2) return null;
  const z0 = -3.0, z1 = zF;
  const W = P.faceWindows(s, { kinds: ['win'], y0: yk + 0.4, y1: yk + fh - 0.3, x0: x0 + 0.5, x1: x1 - 0.5 }).slice(0, 1);
  K.windows = [...(K.windows || []), ...W];
  K.room(x0, x1, z0, z1, { y: yk, h: Math.min(2.9, fh - 0.25), floor: 'boards', wall: paint, look: { ambient: 0.4, haze: 0.15, room: 'corridor' }, sides: { [side === 'w' ? 'e' : 'w']: false, s: { holes: P.windowHoles(W) } } });
  K.box('cloth', x0 + 0.3, x1 - 0.3, yk, yk + 0.015, z0 + 0.5, z1 - 0.6, 1);
  if (!W.length) litWindow(K, (x0 + x1) / 2, yk + 1.5, z0, { w: 0.8, h: 1.1, dir: 's' });
  chair(K, side === 'w' ? x0 + 0.5 : x1 - 0.5, z0 + 0.6, side === 'w' ? -Math.PI / 2 : Math.PI / 2, { y: yk });
  K.box('cloth', side === 'w' ? x0 + 0.02 : x1 - 0.12, side === 'w' ? x0 + 0.12 : x1 - 0.02, yk + 0.9, yk + 1.75, z1 - 1.2, z1 - 0.7, 3);
  K.lamp((x0 + x1) / 2, yk + 2.3, (z0 + z1) / 2, { kind: 'bare', power: 0.3, ceilY: yk + Math.min(2.9, fh - 0.25) });
  K.use({ at: [(x0 + x1) / 2, yk + 1.4, z1 - 0.2], range: 2.4, cone: 0.7, prompt: 'the window', when: () => !!W.length, onUse: () => P.game.hud.message('The street, four floors down. Nobody looks up.', 1.8) });
  void rng;
  return { x0, x1, k };
}

// the fire escape: down its ladder to the pavement (a climb, eased: the eye goes down the face)
function escapeDown(K, s, P, fx, yr) {
  const G = P.game, C = G.controller, F = s.frame;
  const top = F.v(fx, yr + 1.6, 0.55), bot = F.v(fx, 0.15 + 1.62, 0.9);
  const yaw = F.yaw(0);
  const dur = 2.6;
  G.sfx.play('w_ladder', top, {}, { ref: 2 });
  C.setMode('cutscene', { track: (tt) => {
    const u = Math.min(1, tt / dur), e = u * u * (3 - 2 * u);
    return { x: top.x + (bot.x - top.x) * e, y: top.y + (bot.y - top.y) * e, z: top.z + (bot.z - top.z) * e, yaw, pitch: -0.2 + 0.15 * Math.sin(u * Math.PI) };
  } });
  P.later((() => { let t = 0, n = 0; return (dt) => { t += dt; if (t > n * 0.35 && t < dur) { n++; G.sfx.play('w_ladderStop', null, { k: 0.4 }, { ref: 1 }); } if (t < dur) return false; C.setPose(bot.x, bot.z, yaw + Math.PI, -0.05); P.level = 0; return true; }; })());
}

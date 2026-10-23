import * as THREE from 'three';
import { pay } from '../../combat/money.js';
import { FLOOR } from '../../city/kits/interior/kit.js';
import { desk, shelves, label, crates } from '../../city/kits/interior/pieces.js';
import { RNG } from '../../util/rng.js';

// The garage (the Yards; brief O5 §2.5): a high workshop of concrete, the
// pit with its steps, the lift's two posts and arms, a car under a sheet,
// the bench and its tools, tyres, drums, the shutter to the street chained.
// The man in overalls: E, he sees to the car I came in (it stands outside,
// at the kerb: O2's rules until they land - the stand-in repairs it for
// money, or repaints it another grey).
const REPAIR = 15, REPAINT = 10;
const GREYS = [0x2a2a2a, 0x5a5a58, 0x111111, 0x7a7a76];
export default {
  kind: 'garage',
  spawn: { x: 0, z: -1.5, yaw: 0.2 },
  build(K, s, P) {
    const b = s.lb, R0 = new RNG(0x6A8), rng = () => R0.next();
    const x0 = Math.max(b.x0 + 0.5, -12.6), x1 = Math.min(b.x1 - 0.5, 5.7), z0 = Math.max(b.z0 + 0.5, -20.4), z1 = -0.3, H = Math.min(5.6, s.lot.h - 0.6);
    K.roomRect = { x0, x1, z0, z1 };
    // (the shutter's hole in the front wall: chained shut, seen from inside)
    const sh = P.faceWindows(s, { kinds: ['loading'], y0: 0, y1: 4 })[0];
    const holes = [...P.doorHoles(s, 's')];
    if (sh) holes.push({ a: sh.lx - sh.w / 2, b: sh.lx + sh.w / 2, top: FLOOR + 3.7, win: true });
    K.room(x0, x1, z0, z1, { h: H, floor: 'concrete', wall: 'concrete', ceil: 'dark', look: { ambient: 0.45, haze: 0.2, room: 'o5_big' }, sides: { s: { holes } } });
    if (sh) {
      // the shutter's slats, its chain and padlock
      for (let y = FLOOR + 0.1; y < FLOOR + 3.7; y += 0.16) K.box('iron', sh.lx - sh.w / 2, sh.lx + sh.w / 2, y, y + 0.13, -0.24, -0.2, 1);
      K.box('chrome', sh.lx + sh.w / 2 - 0.3, sh.lx + sh.w / 2 - 0.22, FLOOR + 0.3, FLOOR + 0.9, -0.3, -0.26, 3);
      K.use({ at: [sh.lx, FLOOR + 1.0, -0.3], range: 2.4, cone: 0.6, prompt: 'the shutter', onUse: () => { P.game.sfx.play('c5_chain', K.F.v(sh.lx, 1, -0.3), {}, { ref: 3 }); P.game.hud.message('Chained. The man has the key.', 1.6); } });
    }
    // the pit: sunk in the floor, its steps at the back end; its edges a man does not walk off
    const px0 = x0 + 4.0, px1 = px0 + 1.1, pz0 = -13.0, pz1 = -6.0, py = FLOOR - 1.35;
    K.box('concrete', px0 - 0.1, px1 + 0.1, py - 0.2, py, pz0 - 0.1, pz1 + 0.1, 0);
    K.box('concrete', px0 - 0.12, px0, py, FLOOR, pz0, pz1, 0); K.box('concrete', px1, px1 + 0.12, py, FLOOR, pz0, pz1, 0);
    K.box('concrete', px0, px1, py, FLOOR, pz1, pz1 + 0.12, 0);
    K.surface(px0, px1, pz0 + 1.5, pz1, py, 0);
    K.stairs(px0, px1, pz0, pz0 + 1.5, py, FLOOR, 'n', { key: 'iron' });
    // (the floor round it: the room's surface is one rect, so the pit's rect wins where it is lower - the walls keep me out of it but by the steps)
    K.solid(px0 - 0.2, px0 - 0.05, pz0 + 1.5, pz1); K.solid(px1 + 0.05, px1 + 0.2, pz0 + 1.5, pz1); K.solid(px0, px1, pz1 + 0.05, pz1 + 0.2);
    K.solid(px0 - 0.2, px0 - 0.05, pz0, pz0 + 1.5, { lvl: null }); K.solid(px1 + 0.05, px1 + 0.2, pz0, pz0 + 1.5);
    // the lift: two posts and their arms, raised empty
    const lx = x0 + 9.0, lz = -9.0;
    for (const sd of [-1, 1]) { K.box('iron', lx + sd * 1.4 - 0.15, lx + sd * 1.4 + 0.15, FLOOR, FLOOR + 3.6, lz - 0.15, lz + 0.15, 1); K.post(lx + sd * 1.4, lz, 0.25); K.box('iron', lx + sd * 1.4 - (sd > 0 ? 1.0 : 0), lx + sd * 1.4 + (sd < 0 ? 1.0 : 0), FLOOR + 1.55, FLOOR + 1.65, lz - 0.9, lz + 0.9, 1); }
    // a car under a sheet (a mass of cloth over a car's shape)
    const cx = x0 + 9.0, cz = -16.0;
    K.add('cloth', new THREE.SphereGeometry(1, 20, 12).scale(2.3, 0.75, 1.0).translate(cx, FLOOR + 0.55, cz), 1);
    K.add('cloth', new THREE.SphereGeometry(1, 16, 10).scale(1.1, 0.55, 0.85).translate(cx - 0.2, FLOOR + 1.1, cz), 1);
    K.solid(cx - 2.2, cx + 2.2, cz - 0.95, cz + 0.95);
    K.use({ at: [cx, FLOOR + 1.0, cz + 0.9], range: 2.6, cone: 0.6, prompt: 'the sheet', onUse: () => { P.game.sfx.play('clothRustle', K.F.v(cx, 1, cz), {}, { ref: 2 }); P.game.hud.message('Somebody’s coupe. Not yours.', 1.6); } });
    // the bench along the left wall, tools on the shelf over it; tyres; drums
    desk(K, x0, x0 + 0.8, -6.0, -2.5, { h: 0.92 });
    shelves(K, -6.0, -2.5, x0, { dir: 'e', h: 2.2, n: 3, depth: 0.3, fill: 'iron', rng });
    for (let i = 0; i < 4; i++) K.add('rope', new THREE.TorusGeometry(0.33, 0.12, 8, 16).rotateX(Math.PI / 2).translate(x1 - 0.7, FLOOR + 0.12 + i * 0.24, -3.0), 1);
    K.post(x1 - 0.7, -3.0, 0.45);
    for (const [dx, dz] of [[0, 0], [0.62, 0.1], [0.3, 0.6]]) { K.cyl('iron', x1 - 0.7 - dx, FLOOR, FLOOR + 0.9, -18.6 + dz, 0.3, 0.3, 16, 1); K.post(x1 - 0.7 - dx, -18.6 + dz, 0.3); }
    crates(K, x0 + 0.6, z0 + 0.7, { n: 2, s: 0.8, rng });
    // the lamps: cages high over the lift and the pit, a bare one over the bench
    K.lamp(lx, FLOOR + H - 0.6, lz, { kind: 'cage', power: 1.1, ceilY: FLOOR + H });
    K.lamp(px0 + 0.5, FLOOR + H - 0.8, -9.5, { kind: 'cage', power: 0.8, ceilY: FLOOR + H });
    K.lamp(x0 + 0.9, FLOOR + 2.4, -4.2, { kind: 'pendant', power: 0.6, ceilY: FLOOR + H });
    K.lamp(cx, FLOOR + H - 0.6, cz, { kind: 'bare', power: 0.5, ceilY: FLOOR + H });
    label(K, 'REPAIRS\nPAINT', x0 + 0.02, FLOOR + 3.0, -4.2, { w: 1.3, h: 0.7, dir: 'e', dark: true });
    label(K, `REPAIR $${REPAIR}   PAINT $${REPAINT}`, 0.0, FLOOR + 2.6, z0 + 0.02, { w: 2.6, h: 0.32, dir: 's', lit: true });
    // the man in overalls at the bench
    K.fig('dockhand', x0 + 1.3, -4.4, -Math.PI / 2, { name: 'mechanic', state: 'idle' });
    K.use({ at: [x0 + 1.3, FLOOR + 1.5, -4.4], range: 2.4, cone: 0.5, prompt: () => carOffer(s, P), onUse: () => carWork(K, s, P) });
  },
};
const myCar = (P, s) => { const c = P.game.city && P.game.city.car; return c && Math.hypot(c.pos.x - s.door.x, c.pos.z - s.door.z) < 30 ? c : null; };
function carOffer(s, P) {
  const car = myCar(P, s);
  if (!car) return 'the mechanic';
  return (car.damage || 0) > 0.2 ? `fix the car: $${REPAIR}` : `paint the car: $${REPAINT}`;
}
function carWork(K, s, P) {
  const G = P.game, car = myCar(P, s);
  if (!car) { G.hud.message('Bring it round. He’ll look at it.', 1.8); return; }
  const fix = (car.damage || 0) > 0.2, cost = fix ? REPAIR : REPAINT;
  if (s.state.sore) { G.hud.message('Not to you. Not tonight.', 1.6); return; }
  if (!pay(G, cost, fix ? 'repairs' : 'paint')) { G.hud.message(`$${cost}. He waits.`, 1.6); return; }
  if (fix) { if (car.repair) car.repair(); else { car.damage = 0; car.pull = 0; } G.emit('car:repaired', { car }); }
  else {
    const k = (s.state.paint = ((s.state.paint || 0) + 1) % GREYS.length);
    const base = G.stage.M.paint;
    car.object.traverse((o) => { if (o.isMesh && (o.material === base || o.userData.o5paint)) { if (!o.userData.o5paint) { o.material = base.clone(); o.userData.o5paint = true; } o.material.color.setHex(GREYS[k]); } });
    G.emit('car:repainted', { car, grey: GREYS[k] });
  }
  G.sfx.play('c5_tap', K.F.v(0, 1, -3), {}, { ref: 2 });
  G.hud.message(fix ? 'Done. Runs like it should.' : 'Another grey. Nobody looks twice.', 2.0);
}

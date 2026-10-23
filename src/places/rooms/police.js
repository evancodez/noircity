import { FLOOR } from '../../city/kits/interior/kit.js';
import { counter, bench, bars, label, sheet, shelves, desk, chair } from '../../city/kits/interior/pieces.js';
import { RNG } from '../../util/rng.js';

// Police headquarters (Downtown; brief O5 §2.7): the hall with the high
// desk and its sergeant, the waiting benches, the bounty board by the door
// (three names a night: O7 fills it - K.bounty is its place), the gate at
// the desk's end into the back: the cells, three of them behind bars, a
// bench in each. After an arrest I wake on the middle cell's bench (O3's
// seam: places.wake('police')), its door open; then the desk, then the door.
export default {
  kind: 'police',
  spawn: { x: 0, z: -1.6, yaw: 0 },
  build(K, s, P) {
    const b = s.lb, R0 = new RNG(0x9011), rng = () => R0.next();
    const x0 = Math.max(b.x0 + 0.5, -7.0), x1 = Math.min(b.x1 - 0.5, 7.0), z1 = -0.3, zm = -8.0, z0 = Math.max(b.z0 + 0.5, -15.0), H = 3.9;
    K.roomRect = { x0, x1, z0: zm, z1 };
    // the hall
    K.room(x0, x1, zm, z1, { h: H, floor: 'tile', wall: 'paper', look: { ambient: 0.6, haze: 0.2 }, sides: { s: { holes: P.doorHoles(s, 's') }, n: { holes: [{ a: x1 - 1.6, b: x1 - 0.6, top: FLOOR + 2.05 }] } } });
    K.box('wood', x0, x1, FLOOR, FLOOR + 1.2, zm, zm + 0.04, 0);
    // the high desk across the hall, the sergeant behind it, the gate at its end
    counter(K, x0 + 1.5, x1 - 2.2, -5.6, -4.9, { dir: 's', h: 1.12 });
    K.fig('oldman', 0, -6.4, 0, { name: 'sergeant', state: 'read' });
    K.use({ at: [0, FLOOR + 1.5, -5.2], range: 2.2, cone: 0.5, prompt: 'the desk sergeant', onUse: () => { P.game.sfx.play('paperTouch', null, {}, { ref: 1 }); P.game.hud.message(P.arrested ? 'He pushes your things across. Sign.' : 'He looks up. Then down again.', 2.0); P.arrested = false; } });
    // the benches along the walls, the bounty board by the door
    bench(K, x0 + 0.05, x0 + 0.55, -4.2, -1.2);
    bench(K, x1 - 0.55, x1 - 0.05, -4.2, -2.0);
    const bx = x1 - 1.3;
    label(K, 'WANTED', bx, FLOOR + 2.55, z1 - 0.0, { w: 1.3, h: 0.32, dir: 'n', dark: true });
    for (let i = 0; i < 3; i++) sheet(K, bx - 0.45 + i * 0.45, FLOOR + 1.9, z1, { w: 0.36, h: 0.5, dir: 'n' });
    K.bounty = { x: bx, y: FLOOR + 1.9, z: z1, dir: 'n', w: 1.4 };
    K.use({ at: [bx, FLOOR + 1.9, z1 - 0.05], range: 2.2, cone: 0.45, prompt: 'the board', onUse: () => { P.game.emit('bounty:look', {}); P.game.hud.message(P.game.bounty ? 'Three names tonight.' : 'Three names. No faces yet.', 2.0); } });
    K.lamp(-2.2, FLOOR + 3.2, -5.2, { kind: 'globe', power: 0.8, ceilY: FLOOR + H });
    K.lamp(2.4, FLOOR + 3.2, -5.2, { kind: 'globe', power: 0.8, ceilY: FLOOR + H });
    K.lamp(bx, FLOOR + 3.1, -1.2, { kind: 'bare', power: 0.4, ceilY: FLOOR + H });
    label(K, 'POLICE', 0, FLOOR + 3.2, zm, { w: 1.8, h: 0.42, dir: 's', dark: true });
    // the back: the cells' corridor, the cells behind their bars
    K.room(x0, x1, z0, zm - 0.24, { h: H, floor: 'concrete', wall: 'concrete', ceil: 'dark', look: { ambient: 0.4, haze: 0.15 }, sides: { s: false } });
    K.door({ x: x1 - 1.6, z: zm - 0.12, axis: 'x', w: 1.0, name: 'cells' });
    const cz = z0 + 2.6, cw = (x1 - x0) / 3;
    K.cells = [];
    for (let i = 0; i < 3; i++) {
      const a = x0 + i * cw, c = a + cw;
      bars(K, 'x', cz, a, c, { y0: FLOOR, y1: FLOOR + H, gap: [a + 0.3, a + 1.2] });
      if (i < 2) K.wall('z', c, z0, cz, FLOOR, FLOOR + H, { t: 0.16, key: 'concrete' });
      bench(K, a + 0.35, c - 0.35, z0 + 0.05, z0 + 0.6, { h: 0.45 });
      const D = K.door({ x: a + 0.3, z: cz, axis: 'x', w: 0.9, mat: 'iron', name: 'cell' + i, swing: -1 });
      K.cells.push({ a, c, door: D, bench: { x: (a + c) / 2, z: z0 + 0.33 } });
      K.lamp((a + c) / 2, FLOOR + 3.1, (z0 + cz) / 2, { kind: 'cage', power: 0.35, ceilY: FLOOR + H });
    }
    // (the cells' doors open; the last one's man in it)
    K.lamp((x0 + x1) / 2, FLOOR + 3.1, (cz + zm) / 2, { kind: 'bare', power: 0.5, ceilY: FLOOR + H });
    K.fig('docker', K.cells[2].bench.x, K.cells[2].bench.z + 0.05, 0, { name: 'drunk', state: 'sitSmoke', seat: { y: FLOOR + 0.45, name: 'booth' } });
    // a desk in the corridor with the duty man's chair, a filing cabinet
    desk(K, x0 + 0.1, x0 + 1.5, zm - 2.0, zm - 0.9);
    chair(K, x0 + 0.8, zm - 2.5, Math.PI);
    shelves(K, zm - 3.4, zm - 2.4, x1, { dir: 'w', h: 1.6, n: 3, depth: 0.45, fill: 'iron', rng });
    K.wake = { x: K.cells[1].bench.x, z: K.cells[1].bench.z, yaw: 0 };
    K.seat({ name: 'cellbench', x: K.cells[1].bench.x, z: K.cells[1].bench.z + 0.05, yaw: 0, eyeY: FLOOR + 1.2, at: [K.cells[1].bench.x, FLOOR + 0.5, K.cells[1].bench.z], prompt: 'sit', standAt: { x: K.cells[1].bench.x, z: K.cells[1].bench.z + 0.8, yaw: 0 } });
  },
  // the arrest's wake: on the middle cell's bench, its door open
  wake(K, s, P) {
    const G = P.game;
    const S = K.seats.find((x) => x.name === 'cellbench');
    if (S) P.sit(s, S);
    const D = K.cells[1].door; D.open(null, 9);
    P.arrested = true;
    G.hud.message('Headquarters. The cell door is open.', 2.6);
  },
};

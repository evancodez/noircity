import { FLOOR } from '../../city/kits/interior/kit.js';
import { wake as fallWake } from '../../combat/fall.js';
import { counter, bench, bars, label, sheet, shelves, desk, chair } from '../../city/kits/interior/pieces.js';
import * as THREE from 'three';
import { RNG } from '../../util/rng.js';
import { poster } from '../../night/bounty.js';

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
    // [O5b] the desk: a wanted man at my side is booked here ('Book him.': the reward), a dead one's half paid
    const BY = () => P.game.night && P.game.night.bounty;
    K.use({ at: [0, FLOOR + 1.5, -5.2], range: 2.4, cone: 0.55,
      prompt: () => { const B = BY(); if (B && B.ledNear()) return 'book him'; const o = B ? B.owed() : 0; return o ? `collect  $${o}` : 'the desk sergeant'; },
      onUse: () => deskUse(K, s, P) });
    // the benches along the walls, the bounty board by the door
    bench(K, x0 + 0.05, x0 + 0.55, -4.2, -1.2);
    bench(K, x1 - 0.55, x1 - 0.05, -4.2, -2.0);
    const bx = x1 - 1.3;
    label(K, 'WANTED', bx, FLOOR + 2.55, z1 - 0.0, { w: 1.3, h: 0.32, dir: 'n', dark: true });
    for (let i = 0; i < 3; i++) sheet(K, bx - 0.45 + i * 0.45, FLOOR + 1.9, z1, { w: 0.4, h: 0.55, dir: 'n' });
    K.bounty = { x: bx, y: FLOOR + 1.9, z: z1, dir: 'n', w: 1.4 };
    // [O5b] the night's three posters on the sheets (O7's poster(): crossed when he is down, PAID when paid); E: the card
    K.posters = [0, 1, 2].map((i) => ({ x: bx - 0.45 + i * 0.45, y: FLOOR + 1.9, z: z1 - 0.022 }));
    K.use({ at: [bx, FLOOR + 1.9, z1 - 0.05], range: 2.2, cone: 0.45, prompt: 'the wanted board', onUse: () => { P.game.emit('bounty:look', {}); const B = BY(); if (B) B.use(); else P.game.hud.message('Three names. No faces yet.', 2.0); } });
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
    // [O5b] a booked man's walk: from the desk's end through the cells' door to the first cell's bench
    { const c0 = K.cells[0]; K.bookPath = [[x1 - 1.1, -4.3], [x1 - 1.1, zm + 0.5], [x1 - 1.1, zm - 0.9], [c0.a + 0.75, cz + 0.9], [c0.a + 0.75, cz - 0.6], [c0.bench.x, c0.bench.z + 0.45]]; K.bookSit = { x: c0.bench.x, z: c0.bench.z + 0.05 }; }
    K.seat({ name: 'cellbench', x: K.cells[1].bench.x, z: K.cells[1].bench.z + 0.05, yaw: 0, eyeY: FLOOR + 1.2, at: [K.cells[1].bench.x, FLOOR + 0.5, K.cells[1].bench.z], prompt: 'sit', standAt: { x: K.cells[1].bench.x, z: K.cells[1].bench.z + 0.8, yaw: 0 } });
  },
  // [O5b] the posters on the hall's sheets, redrawn when a man's state changes
  live(K, s, P) {
    const G = P.game, F = s.frame;
    const items = [];
    let sig = null;
    const draw = () => {
      const B = G.night && G.night.bounty;
      const L = B ? B.names() : [];
      const now = L.map((b) => b.state).join();
      if (now === sig) return;
      sig = now;
      for (const it of items) { it.tex.dispose(); it.mat.dispose(); it.mesh.geometry.dispose(); if (it.mesh.parent) it.mesh.parent.remove(it.mesh); }
      items.length = 0;
      L.slice(0, 3).forEach((b, i) => {
        const at = K.posters[i];
        const tex = new THREE.CanvasTexture(poster(b)); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
        const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color().setScalar(0.62) });
        mat.userData.inkSurface = 'lit';
        const g = new THREE.PlaneGeometry(0.36, 0.5).rotateZ((i - 1) * 0.03).rotateY(Math.PI).translate(at.x, at.y, at.z);
        const m = new THREE.Mesh(g, mat);
        m.matrixAutoUpdate = false; m.matrix.copy(F.M);
        m.userData.inkId = K.id + 3; m.userData.noRay = true; m.name = 'poster ' + b.id;
        K.group.add(m); m.updateMatrixWorld(true);
        items.push({ tex, mat, mesh: m });
      });
    };
    draw();
    return {
      step() { draw(); },
      dispose() { for (const it of items) { it.tex.dispose(); it.mat.dispose(); it.mesh.geometry.dispose(); if (it.mesh.parent) it.mesh.parent.remove(it.mesh); } items.length = 0; },
    };
  },
  // the arrest's wake: on the middle cell's bench, its door open
  wake(K, s, P) {
    const G = P.game;
    const S = K.seats.find((x) => x.name === 'cellbench');
    if (S) P.sit(s, S);
    const D = K.cells[1].door; D.open(null, 9);
    P.arrested = true;
    // (O4's rules of the station: the guns kept by the police, a fine of a fifth)
    const r = fallWake(G, 'station');
    G.hud.message(r.line + ' The cell door is open.', 3.0);
  },
};

// [O5b] E at the sergeant's desk
function deskUse(K, s, P) {
  const G = P.game, B = G.night && G.night.bounty, F = s.frame;
  G.sfx.play('paperTouch', null, {}, { ref: 1 });
  const M = B && B.ledNear();
  if (M) {
    // the cells' door and the first cell's door open; he is walked through them and sat on the bench
    const D = K.doors.find((d) => d.name === 'cells'); if (D && (D.shut || D.target === 0)) D.open(null);
    const C = K.cells[0].door; if (C && (C.shut || C.target === 0)) C.open(null);
    const path = K.bookPath.map(([x, z]) => F.w(x, z));
    const st = F.w(K.bookSit.x, K.bookSit.z);
    path.sit = { x: st.x, y: FLOOR + 0.45, z: st.z, yaw: F.figYaw(0) - Math.PI };
    B.book(M, path);
    P.laterT(1.0, () => G.hud.message(`$${M.b.reward}. He signs for him.`, 2.2));
    return;
  }
  const paid = B ? B.collect() : 0;
  if (paid) { G.hud.message(`$${paid}. Half, for a dead man.`, 2.2); return; }
  G.hud.message(P.arrested ? 'He pushes your things across. Sign.' : 'He looks up. Then down again.', 2.0);
  P.arrested = false;
}

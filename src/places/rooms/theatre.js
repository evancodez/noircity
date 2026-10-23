import * as THREE from 'three';
import { FLOOR } from '../../city/kits/interior/kit.js';
import { sheet, label, litWindow, bench } from '../../city/kits/interior/pieces.js';

// The theatre's lobby (the Orpheum, Downtown under its marquee; brief O5
// §2.10): the lobby with its carpet, the box office's lit window and its
// girl, the posters, the stairs up to the balcony (closed tonight), the
// doors to the dark house at the back. In the house: the rows of seats, the
// screen lit; a seat (E) and the reel on the screen (a still of the stills'
// kind: game.stills.play('o5_reel'), one panel, held), then up and out.
const TICKET = 1;
export default {
  kind: 'theatre',
  spawn: { x: 0, z: -1.6, yaw: 0 },
  build(K, s, P) {
    const b = s.lb;
    const x0 = Math.max(b.x0 + 0.5, -6.2), x1 = Math.min(b.x1 - 0.5, 9.2), z1 = -0.3, zl = -7.0, z0 = Math.max(b.z0 + 0.5, -21.4), H = 4.2;
    K.roomRect = { x0, x1, z0: zl, z1 };
    const hx = 1.0;
    // ---- the lobby
    // ([O5] after the critic - a dull grey mud: the walls dark, one hard pool on a pale carpet, the
    // box office's window, the posters and the doors' frames lit white, the rest black)
    K.room(x0, x1, zl, z1, { h: H, floor: 'boards', wall: 'plaster', look: { ambient: 0.3, haze: 0.45 }, sides: { s: { holes: P.doorHoles(s, 's') }, n: { holes: [{ a: hx - 1.0, b: hx + 1.0, top: FLOOR + 2.3 }] } } });
    K.box('canvas', x0 + 0.4, x1 - 0.4, FLOOR, FLOOR + 0.015, zl + 0.4, z1 - 0.4, 0);
    // the box office: a booth of wood and glass at the left, its window lit, the girl in it
    const bx0 = x0 + 0.05, bx1 = x0 + 2.2, bz0 = -4.0, bz1 = -1.8;
    K.box('wood', bx0, bx1, FLOOR, FLOOR + 1.1, bz1 - 0.08, bz1, 1);
    K.box('wood', bx1 - 0.08, bx1, FLOOR, FLOOR + 1.1, bz0, bz1, 1);
    K.box('lit', bx0 + 0.1, bx1 - 0.1, FLOOR + 1.1, FLOOR + 2.1, bz1 - 0.05, bz1 - 0.03, 2);
    K.box('wood', bx0, bx1, FLOOR + 2.1, FLOOR + 2.4, bz0, bz1, 1);
    K.solid(bx0, bx1, bz0, bz1);
    K.fig('waitress', (bx0 + bx1) / 2, (bz0 + bz1) / 2 - 0.2, 0, { name: 'cashier', state: 'idle' });
    K.use({ at: [(bx0 + bx1) / 2, FLOOR + 1.3, bz1 + 0.05], range: 2.0, cone: 0.5, prompt: () => (s.state.ticket ? 'the box office' : `a ticket: $${TICKET}`), onUse: () => {
      const G = P.game;
      if (s.state.ticket) { G.hud.message('One show. It’s on now.', 1.4); return; }
      if (!P.buy(s, TICKET, 'a ticket', 'She waves you through.')) return;
      s.state.ticket = true; G.sfx.play('register', null, {}, { ref: 1 });
    } });
    label(K, 'TICKETS', (bx0 + bx1) / 2, FLOOR + 2.25, bz1 + 0.01, { w: 1.2, h: 0.25, dir: 's', dark: true });
    // the posters in their frames; the stairs up the right wall to the balcony's door (closed tonight)
    for (let i = 0; i < 3; i++) { const z = -1.6 - i * 1.8; K.box('woodHi', x1 - 0.06, x1, FLOOR + 0.85, FLOOR + 2.55, z - 0.6, z + 0.6, 3); K.box('lit', x1 - 0.07, x1 - 0.06, FLOOR + 0.92, FLOOR + 2.48, z - 0.53, z + 0.53, 2); sheet(K, z, FLOOR + 1.7, x1 - 0.08, { w: 0.8, h: 1.3, dir: 'w', key: 'wood' }); }
    // two lit frames either side of the doors into the house, a poster's dark shape in each
    for (const px of [hx - 2.1, hx + 2.1]) { K.box('woodHi', px - 0.62, px + 0.62, FLOOR + 0.8, FLOOR + 2.6, zl, zl + 0.06, 3); K.box('lit', px - 0.55, px + 0.55, FLOOR + 0.87, FLOOR + 2.53, zl + 0.06, zl + 0.07, 2); sheet(K, px, FLOOR + 1.7, zl + 0.07, { w: 0.82, h: 1.36, dir: 's', key: 'wood' }); }
    label(K, 'NOW SHOWING\nTHE LONG NIGHT', x0 + 0.02, FLOOR + 2.0, -5.4, { w: 1.6, h: 0.7, dir: 'e', lit: true });
    bench(K, x0 + 0.05, x0 + 0.5, -6.6, -4.6);
    K.lamp(hx, FLOOR + 2.9, -3.6, { kind: 'pendant', power: 1.5, ceilY: FLOOR + H });
    // (a chandelier: small lit globes on a ring of arms round it)
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; K.add('bulb', new THREE.SphereGeometry(0.05, 8, 6).translate(hx + Math.cos(a) * 0.45, FLOOR + 3.3, -3.6 + Math.sin(a) * 0.45), 2); K.add('chrome', new THREE.CylinderGeometry(0.008, 0.008, 0.46, 4).rotateZ(Math.PI / 2).rotateY(-a).translate(hx + Math.cos(a) * 0.23, FLOOR + 3.36, -3.6 + Math.sin(a) * 0.23), 2); }
    K.lamp(x1 - 1.6, FLOOR + 3.4, -1.6, { kind: 'globe', power: 0.35, ceilY: FLOOR + H });
    K.fig('oldman', hx + 1.4, zl + 0.5, 0, { name: 'usher', state: 'idle' });
    // the doors into the house (a double door, pushed either way)
    K.door({ x: hx - 1.0, z: zl - 0.12, axis: 'x', w: 2.0, double: true, h: 2.25, name: 'house' });
    // ---- the house: dark, the rows of seats, the screen at the far end
    const Hh = 7.2;
    K.room(x0, x1, z0, zl - 0.24, { h: Hh, floor: 'boards', wall: 'dark', ceil: 'dark', look: { ambient: 0.25, haze: 0.6, room: 'o5_house' }, sides: { s: false } });
    // (the house's back wall over the lobby's ceiling: open, the street's buildings showed over it from the seats)
    K.wall('x', zl - 0.12, x0 - 0.24, x1 + 0.24, FLOOR + H - 0.05, FLOOR + Hh, { key: 'dark', solid: false });
    const sw = Math.min(x1 - x0 - 2.0, 9.0), scx = (x0 + x1) / 2;
    K.box('screen', scx - sw / 2, scx + sw / 2, FLOOR + 1.6, FLOOR + 1.6 + sw * 0.6, z0 + 0.05, z0 + 0.08, 2);
    K.box('cloth', scx - sw / 2 - 0.6, scx - sw / 2, FLOOR, FLOOR + 6.5, z0, z0 + 0.3, 1);
    K.box('cloth', scx + sw / 2, scx + sw / 2 + 0.6, FLOOR, FLOOR + 6.5, z0, z0 + 0.3, 1);
    // the stage's lip under it
    K.box('wood', x0, x1, FLOOR, FLOOR + 0.7, z0, z0 + 1.6, 1);
    K.solid(x0, x1, z0, z0 + 1.6);
    // the rows (an aisle down each side)
    const rows = [];
    for (let z = z0 + 4.0; z < zl - 2.8; z += 1.05) {
      K.box('leather', x0 + 1.4, x1 - 1.4, FLOOR, FLOOR + 0.45, z - 0.25, z + 0.25, 1);
      K.box('leather', x0 + 1.4, x1 - 1.4, FLOOR + 0.45, FLOOR + 0.95, z + 0.2, z + 0.3, 1);
      K.solid(x0 + 1.4, x1 - 1.4, z - 0.3, z + 0.3);
      rows.push(z);
    }
    // the light from the screen and the projector's beam over the rows (a cone from the back wall)
    K.lamp(scx, FLOOR + 6.4, z0 + 3.0, { kind: 'bare', power: 0.25, ceilY: FLOOR + Hh, cone: false });
    K.lamp(scx, FLOOR + 5.0, zl - 0.6, { kind: 'bare', power: 0.0, ceilY: FLOOR + Hh, cone: false });
    // my seat: the end of a middle row, from the aisle (up, I face the doors out, up the aisle)
    const rz = rows[Math.floor(rows.length / 2)] ?? (z0 + 6);
    const sx = x0 + 1.75;
    K.seat({ name: 'house', x: sx, z: rz - 0.05, yaw: 0, eyeY: FLOOR + 1.12, at: [sx, FLOOR + 0.6, rz], prompt: 'take a seat', pitch: 0.12, standAt: { x: x0 + 0.8, z: rz + 0.2, yaw: Math.atan2(-(hx - x0 - 0.8), -(zl - rz - 0.2)) }, onSit: () => reel(K, s, P), tourSkip: 'the reel play' });
    K.spawnHouse = { x: x0 + 0.8, z: rz + 0.4 };
  },
};

function reel(K, s, P) {
  const G = P.game;
  P.later((() => { let t = 0; return (dt) => { t += dt; if (t < 1.4) return false; if (G.stills && G.stills.has && G.stills.has('o5_reel')) {
      // ([O5] after the critic: the base's footer writes the keys as words - not under the reel; E or a click ends it)
      const H = G.stills.hint; if (H) H.style.visibility = 'hidden';
      G.stills.play('o5_reel', { onDone: () => { if (H) H.style.visibility = ''; } });
    } G.emit('theatre:reel', {}); return true; }; })());
}
void THREE; void litWindow;

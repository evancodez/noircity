import * as THREE from 'three';
import { FLOOR } from '../../city/kits/interior/kit.js';
import { counter, backBar, stool, table, bench, label, litWindow } from '../../city/kits/interior/pieces.js';
import { RNG } from '../../util/rng.js';

// The diner (Downtown; brief O5 §2.2): the long counter and its stools
// under four pendants, the back shelves lit, the kitchen's hatch bright with
// the cook in it, the booths along the big windows (the street seen through
// them, the rain on the glass), a jukebox at the far end. Sit at the counter
// (E): the coffee (E: health whole, the cup set before me), the pie. A
// waitress behind the counter, two customers who talk in a booth, a man on
// a stool with his supper.
const COFFEE = 1, PIE = 1;
export default {
  kind: 'diner',
  spawn: { x: 0.6, z: -1.6, yaw: -0.25 },
  build(K, s, P) {
    const b = s.lb, R0 = new RNG(0xD1E), rng = () => R0.next();
    const x0 = Math.max(b.x0 + 0.6, -11.6), x1 = Math.min(b.x1 - 0.6, 11.6), z0 = -10, z1 = -0.3, H = 3.8;
    // the windows: the shop fronts of its face (the door's is the door)
    const W = P.faceWindows(s, { kinds: ['shop'], y0: 0, y1: 3, x0: x0 + 0.5, x1: x1 - 0.5 });
    K.windows = W;
    K.room(x0, x1, z0, z1, { h: H, floor: 'tile', wall: 'plaster', look: { haze: 0.4, ambient: 0.6 }, sides: { s: { holes: [...P.doorHoles(s, 's'), ...P.windowHoles(W)] }, n: { holes: [{ a: 4.2, b: 7.0, bottom: FLOOR + 1.15, top: FLOOR + 2.1, win: true }] } } });
    // a dark wainscot round the room, the paper above it
    K.box('wood', x0, x1, FLOOR, FLOOR + 1.0, z0, z0 + 0.04, 0);
    K.box('wood', x0, x0 + 0.04, FLOOR, FLOOR + 1.0, z0, z1, 0);
    K.box('wood', x1 - 0.04, x1, FLOOR, FLOOR + 1.0, z0, z1, 0);
    // the kitchen behind the hatch: lit walls, the cook at the pass
    K.room(3.6, 8.2, z0 - 2.9, z0 - 0.24, { h: 3.0, floor: 'tile', wall: 'litDim', ceil: 'litDim', sides: { s: false }, look: { ambient: 0.8 } });
    K.box('chrome', 4.0, 7.8, FLOOR + 0.9, FLOOR + 0.95, z0 - 2.9, z0 - 2.3, 1);
    K.box('woodHi', 4.2, 7.0, FLOOR + 1.12, FLOOR + 1.16, z0 - 0.36, z0 + 0.12, 1);
    K.lamp(5.9, FLOOR + 2.6, z0 - 1.5, { kind: 'bare', power: 0.5, ceilY: FLOOR + 3.0, cone: false });
    // the counter, its stools, the back bar against the back wall left of the hatch
    const cx0 = x0 + 3.0, cx1 = 3.2;
    counter(K, cx0, cx1, -6.6, -5.95, { dir: 's', h: 1.05 });
    backBar(K, cx0, 3.4, z0, { dir: 's', rows: 2, rng, cab: 0.95 });
    const stools = [];
    for (let x = cx0 + 0.6; x < cx1 - 0.3; x += 1.05) { stool(K, x, -5.25); stools.push(x); }
    // the pendants over the counter, two over the booths
    for (let i = 0; i < 4; i++) K.lamp(cx0 + (cx1 - cx0) * (i + 0.5) / 4, FLOOR + 2.75, -5.7, { kind: 'pendant', power: 0.85, ceilY: FLOOR + H });
    // the booths along the windows (each a table between two benches)
    const booths = W.filter((w) => Math.abs(w.lx) > 2.5).map((w) => w.lx);
    for (const bx of booths) {
      table(K, bx, -1.45, { w: 0.75, d: 1.25, h: 0.74 });
      for (const sd of [-1, 1]) {
        K.box('leather', bx + sd * 0.95 - 0.28, bx + sd * 0.95 + 0.28, FLOOR, FLOOR + 0.46, -2.15, -0.75, 1);
        K.box('leather', sd > 0 ? bx + sd * 0.95 + 0.18 : bx + sd * 0.95 - 0.28, sd > 0 ? bx + sd * 0.95 + 0.28 : bx + sd * 0.95 - 0.18, FLOOR + 0.46, FLOOR + 1.15, -2.15, -0.75, 1);
        K.solid(bx + sd * 0.95 - 0.28, bx + sd * 0.95 + 0.28, -2.15, -0.75);
      }
    }
    if (booths.length) { K.lamp(booths[0], FLOOR + 2.5, -1.45, { kind: 'pendant', power: 0.6, ceilY: FLOOR + H }); K.lamp(booths.at(-1), FLOOR + 2.5, -1.45, { kind: 'pendant', power: 0.6, ceilY: FLOOR + H }); }
    // the jukebox at the far end: an arch of lit tubes
    const jx = x1 - 0.55, jz = -7.6;
    K.box('wood', jx - 0.38, jx + 0.38, FLOOR, FLOOR + 1.45, jz - 0.35, jz + 0.35, 1);
    K.box('lit', jx - 0.4, jx - 0.32, FLOOR + 0.3, FLOOR + 1.5, jz - 0.36, jz + 0.36, 2);
    K.box('litDim', jx - 0.42, jx - 0.4, FLOOR + 0.9, FLOOR + 1.3, jz - 0.25, jz + 0.25, 2);
    K.solid(jx - 0.4, jx + 0.4, jz - 0.38, jz + 0.38);
    // the menu board over the back bar
    label(K, 'COFFEE   5\nPIE     10\nHASH    25\nEGGS    20', cx0 + 1.6, FLOOR + 2.9, z0, { w: 1.6, h: 0.9, dir: 's', dark: true });
    label(K, 'DINER', x0 + 0.02, FLOOR + 2.6, -5.0, { w: 1.3, h: 0.45, dir: 'e', lit: true });
    litWindow(K, -5.0, FLOOR + 1.9, x0, { w: 1.0, h: 1.2, dir: 'e' });
    // the cup and the plate before each free stool (the props are the base's)
    const free = stools.filter((x, i) => i !== 1 && i !== stools.length - 2);
    for (const x of free) {
      const S = K.seat({ name: 'stool' + Math.round(x * 10), x, z: -5.25, yaw: 0, eyeY: FLOOR + 1.62, at: [x, FLOOR + 0.8, -5.25], prompt: 'sit at the counter', standAt: { x, z: -4.4, yaw: 0 } });
      K.use({ seated: S, at: [x, FLOOR + 1.08, -6.25], range: 1.6, cone: 0.6, prompt: () => (s.state.cup === x ? 'drink the coffee' : `coffee: $${COFFEE}`), onUse: () => coffee(K, s, P, x) });
      K.use({ seated: S, at: [x + 0.32, FLOOR + 1.08, -6.3], range: 1.6, cone: 0.35, prompt: `pie: $${PIE}`, when: () => s.state.pie !== x, onUse: () => pie(K, s, P, x) });
    }
    K.use({ at: [jx - 0.4, FLOOR + 1.0, jz], prompt: 'the jukebox', onUse: () => { P.game.sfx.play('jukebox_change', K.F.v(jx, FLOOR + 1, jz), {}, { ref: 3 }); P.game.hud.message('It takes the nickel. Nothing plays.', 1.8); } });
    // its people: the waitress, the cook, two at a booth, a man at his supper
    K.fig('waitress', -1.2, -7.1, 0, { name: 'waitress', state: 'wipe' });
    K.fig('cook', 5.6, z0 - 1.1, 0, { name: 'cook', state: 'hatch' });
    if (booths.length) {
      const bx = booths[0];
      K.fig('couple_him', bx - 0.95, -1.45, Math.PI / 2, { name: 'him', state: 'sitTalk', seat: { y: FLOOR + 0.45, name: 'booth' } });
      K.fig('couple_her', bx + 0.95, -1.45, -Math.PI / 2, { name: 'her', state: 'sitTalk', seat: { y: FLOOR + 0.45, name: 'booth' } });
    }
    K.fig('oldman', stools[1], -5.25, Math.PI, { name: 'supper', state: 'sitEat', seat: { y: FLOOR + 0.77, name: 'stool' } });
    void THREE;
  },
  live(K, s, P) {
    return {
      step() {},
      enter() { P.game.sfx.play('doorbell', K.F.v(0, FLOOR + 2.2, -0.4), {}, { ref: 3 }); },
    };
  },
};

function coffee(K, s, P, x) {
  const G = P.game;
  if (s.state.cup === x) {
    // a swallow: the health whole
    G.sfx.play('sip', null, {}, { ref: 1 });
    G.health.reset();
    G.hud.message('Hot. Black.', 1.4);
    return;
  }
  if ((G.save.money || 0) >= COFFEE) P.money(-COFFEE, 'coffee'); else G.hud.message('On the house.', 1.4);
  s.state.cup = x;
  const c = K.prop('cup', x, FLOOR + 1.05, -6.25, 0.4, { name: 'cup' });
  K.prop('saucer', x, FLOOR + 1.05, -6.25, 0, { name: 'saucer' });
  void c;
  G.sfx.play('coffeePour', K.F.v(x, FLOOR + 1.1, -6.25), {}, { ref: 2 });
  G.health.reset();
}
function pie(K, s, P, x) {
  const G = P.game;
  if ((G.save.money || 0) >= PIE) P.money(-PIE, 'pie'); else G.hud.message('On the house.', 1.4);
  s.state.pie = x;
  K.prop('plate', x + 0.32, FLOOR + 1.05, -6.3, 0, { name: 'plate' });
  K.prop('pie', x + 0.32, FLOOR + 1.065, -6.3, 0.6, { name: 'pie' });
  G.sfx.play('plateDown', K.F.v(x, FLOOR + 1.1, -6.3), {}, { ref: 2 });
}

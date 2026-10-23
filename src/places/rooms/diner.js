import * as THREE from 'three';
import { FLOOR } from '../../city/kits/interior/kit.js';
import { counter, stool, table, bench, label, litWindow } from '../../city/kits/interior/pieces.js';
import { lathe } from '../../props/lib.js';
import { pieCase, priceBoard } from '../art.js';
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
    // (what was on the counter went with the last visit)
    s.state.cups = {}; s.state.pies = {};
    const x0 = Math.max(b.x0 + 0.6, -11.6), x1 = Math.min(b.x1 - 0.6, 11.6), z0 = -10, z1 = -0.3, H = 3.8;
    K.roomRect = { x0, x1, z0, z1 };   // [O5b] (the tour's and the jank walk's: the whole room)
    // the windows: the shop fronts of its face (the door's is the door)
    const W = P.faceWindows(s, { kinds: ['shop'], y0: 0, y1: 3, x0: x0 + 0.5, x1: x1 - 0.5 });
    K.windows = W;
    K.room(x0, x1, z0, z1, { h: H, floor: 'tile', wall: 'plaster', look: { haze: 0.4, ambient: 0.6 }, sides: { s: { holes: [...P.doorHoles(s, 's'), ...P.windowHoles(W)] }, n: { holes: [{ a: 4.2, b: 7.0, bottom: FLOOR + 1.15, top: FLOOR + 2.1, win: true }] } } });
    // a dark wainscot round the room, the paper above it
    K.box('wood', x0, x1, FLOOR, FLOOR + 1.0, z0, z0 + 0.04, 0);
    K.box('wood', x0, x0 + 0.04, FLOOR, FLOOR + 1.0, z0, z1, 0);
    K.box('wood', x1 - 0.04, x1, FLOOR, FLOOR + 1.0, z0, z1, 0);
    // the kitchen behind the hatch: lit walls, the cook at the pass
    // (built piece by piece: nothing of it may reach into the diner's back wall)
    K.floor(3.6, 8.2, z0 - 2.9, z0 - 0.25, FLOOR, 'tile');
    K.box('litDim', 3.6, 8.2, FLOOR + 3.0, FLOOR + 3.2, z0 - 2.9, z0 - 0.4, 0);
    K.wall('x', z0 - 3.02, 3.36, 8.44, FLOOR, FLOOR + 3.2, { key: 'litDim' });
    K.wall('z', 3.48, z0 - 2.9, z0 - 0.25, FLOOR, FLOOR + 3.2, { key: 'litDim' });
    K.wall('z', 8.32, z0 - 2.9, z0 - 0.25, FLOOR, FLOOR + 3.2, { key: 'litDim' });
    K.volume(3.6, 8.2, z0 - 2.9, z0 - 0.25, FLOOR, FLOOR + 3.0, { ambient: 0.8 });
    K.box('chrome', 4.0, 7.8, FLOOR + 0.9, FLOOR + 0.95, z0 - 2.9, z0 - 2.3, 1);
    K.box('woodHi', 4.2, 7.0, FLOOR + 1.12, FLOOR + 1.16, z0 - 0.36, z0 + 0.12, 1);
    K.lamp(5.9, FLOOR + 2.6, z0 - 1.5, { kind: 'bare', power: 0.5, ceilY: FLOOR + 3.0, cone: false });
    // the counter, its stools, the back bar against the back wall left of the hatch
    const cx0 = x0 + 3.0, cx1 = 3.2;
    counter(K, cx0, cx1, -6.6, -5.95, { dir: 's', h: 1.05 });
    // [O5b] (brief O5b §3: the diner's back wall was the bar's bottle shelf) a diner's own: the back
    // counter, the pie case lit from inside, two coffee urns, the price board lit over them
    const pcx = backWall(K, cx0, Math.min(3.4, cx1 + 0.2), z0);
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
    // (its face dark, its tubes lit: an arch of light, not a white box)
    K.box('litDim', jx - 0.42, jx - 0.38, FLOOR + 0.9, FLOOR + 1.3, jz - 0.22, jz + 0.22, 2);
    for (const sd of [-1, 1]) K.box('lit', jx - 0.44, jx - 0.38, FLOOR + 0.2, FLOOR + 1.35, jz + sd * 0.33 - 0.03, jz + sd * 0.33 + 0.03, 2);
    K.box('lit', jx - 0.44, jx - 0.38, FLOOR + 1.35, FLOOR + 1.41, jz - 0.36, jz + 0.36, 2);
    K.solid(jx - 0.4, jx + 0.4, jz - 0.38, jz + 0.38);
    // the price board over the back counter, lit
    label(K, '', pcx, FLOOR + 2.72, z0, { w: 1.9, h: 1.0, dir: 's', draw: priceBoard([['COFFEE', '5c'], ['PIE', '10c'], ['HASH', '25c'], ['EGGS ANY STYLE', '20c']]), res: 2 });
    // the pass: plates up, the bell, the orders on their rail (the cook's hands come and go in the hatch)
    K.prop('plate', 5.0, FLOOR + 1.16, z0 - 0.12, 0, { name: 'pass1' });
    K.prop('plate', 6.1, FLOOR + 1.16, z0 - 0.08, 0, { name: 'pass2' });
    K.add('chrome', lathe([[0.0001, 0], [0.07, 0], [0.07, 0.01], [0.05, 0.05], [0.012, 0.075], [0.0001, 0.08]], 14).translate(6.7, FLOOR + 1.16, z0 + 0.02), 3);
    K.box('chrome', 4.25, 6.95, FLOOR + 2.02, FLOOR + 2.05, z0 + 0.02, z0 + 0.05, 2);
    for (const [x, h] of [[4.5, 0.2], [4.85, 0.16], [5.3, 0.22], [6.4, 0.18]]) K.box('linen', x - 0.06, x + 0.06, FLOOR + 2.02 - h, FLOOR + 2.02, z0 + 0.055, z0 + 0.06, 3);
    label(K, 'DINER', x0 + 0.02, FLOOR + 2.6, -5.0, { w: 1.3, h: 0.45, dir: 'e', lit: true });
    litWindow(K, -5.0, FLOOR + 1.9, x0, { w: 1.0, h: 1.2, dir: 'e' });
    // the cup and the plate before each free stool (the props are the base's)
    const free = stools.filter((x, i) => i !== 1 && i !== stools.length - 2);
    for (const x of free) {
      const S = K.seat({ name: 'stool' + Math.round(x * 10), x, z: -5.25, yaw: 0, eyeY: FLOOR + 1.62, at: [x, FLOOR + 0.8, -5.25], range: 1.7, cone: 0.38, prompt: 'sit at the counter', standAt: { x, z: -4.4, yaw: 0 }, tourAt: [x, -4.3] });
      K.use({ seated: S, at: [x, FLOOR + 1.08, -6.25], range: 1.6, cone: 0.6, prompt: () => ((s.state.cups || {})[x.toFixed(2)] ? 'drink the coffee' : `coffee: $${COFFEE}`), onUse: () => coffee(K, s, P, x) });
      K.use({ seated: S, at: [x + 0.32, FLOOR + 1.08, -6.3], range: 1.6, cone: 0.35, prompt: `pie: $${PIE}`, when: () => !(s.state.pies || {})[x.toFixed(2)], onUse: () => pie(K, s, P, x) });
    }
    K.use({ at: [jx - 0.4, FLOOR + 1.0, jz], range: 2.6, cone: 0.6, prompt: 'the jukebox', tourAt: [jx - 1.5, jz], onUse: () => { P.game.sfx.play('jukebox_change', K.F.v(jx, FLOOR + 1, jz), {}, { ref: 3 }); P.game.hud.message('It takes the nickel. Nothing plays.', 1.8); } });
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
  const key = x.toFixed(2);
  if ((s.state.cups || (s.state.cups = {}))[key]) {
    // a swallow: the health whole
    G.sfx.play('sip', null, {}, { ref: 1 });
    G.health.reset();
    G.hud.message('Hot. Black.', 1.4);
    return;
  }
  if (!P.buy(s, COFFEE, 'coffee', 'On the house. Once.')) return;
  s.state.cups[key] = true;
  const c = K.prop('cup', x, FLOOR + 1.05, -6.25, 0.4, { name: 'cup' });
  K.prop('saucer', x, FLOOR + 1.05, -6.25, 0, { name: 'saucer' });
  void c;
  G.sfx.play('coffeePour', K.F.v(x, FLOOR + 1.1, -6.25), {}, { ref: 2 });
  G.health.reset();
}
function pie(K, s, P, x) {
  const G = P.game;
  if (!P.buy(s, PIE, 'pie', 'On the house. Once.')) return;
  (s.state.pies || (s.state.pies = {}))[x.toFixed(2)] = true;
  K.prop('plate', x + 0.32, FLOOR + 1.05, -6.3, 0, { name: 'plate' });
  K.prop('pie', x + 0.32, FLOOR + 1.065, -6.3, 0.6, { name: 'pie' });
  G.sfx.play('plateDown', K.F.v(x, FLOOR + 1.1, -6.3), {}, { ref: 2 });
}

// [O5b] the back wall: a low counter, the pie case on it (its glass lit from inside: the pies on their
// stands), two coffee urns of chrome, the cups stacked between them
function backWall(K, a0, a1, z0) {
  K.box('wood', a0, a1, FLOOR, FLOOR + 0.92, z0, z0 + 0.45, 1);
  K.box('woodHi', a0 - 0.02, a1 + 0.02, FLOOR + 0.92, FLOOR + 0.96, z0, z0 + 0.48, 1);
  K.box('black', a0 + 0.02, a1 - 0.02, FLOOR, FLOOR + 0.1, z0 + 0.44, z0 + 0.47, 1);
  K.solid(a0, a1, z0, z0 + 0.48);
  // the pie case: its frame, its top, its face lit (a third of the way along, under the price board)
  const L = a1 - a0, pc = a0 + L * 0.34;
  const p0 = pc - 0.95, p1 = pc + 0.95, y0 = FLOOR + 0.96, y1 = FLOOR + 1.7;
  K.box('chrome', p0 - 0.03, p1 + 0.03, y1, y1 + 0.04, z0 + 0.04, z0 + 0.44, 2);
  for (const x of [p0 - 0.03, p1]) K.box('chrome', x, x + 0.03, y0, y1, z0 + 0.4, z0 + 0.44, 2);
  K.box('litDim', p0, p1, y0, y1, z0 + 0.04, z0 + 0.06, 2);
  label(K, '', (p0 + p1) / 2, (y0 + y1) / 2, z0 + 0.42, { w: p1 - p0, h: y1 - y0 - 0.02, dir: 's', draw: pieCase(), res: 2 });
  // the register at the counter's near end: its body, its lit tab
  K.box('chrome', a0 + 0.25, a0 + 0.8, y0, y0 + 0.32, z0 + 0.1, z0 + 0.42, 1);
  K.box('black', a0 + 0.3, a0 + 0.75, y0 + 0.32, y0 + 0.42, z0 + 0.12, z0 + 0.3, 1);
  K.box('lit', a0 + 0.38, a0 + 0.67, y0 + 0.36, y0 + 0.41, z0 + 0.3, z0 + 0.31, 3);
  // a malt mixer by the case, its steel cup
  K.box('chrome', p1 + 0.35, p1 + 0.5, y0, y0 + 0.5, z0 + 0.08, z0 + 0.22, 1);
  K.box('chrome', p1 + 0.3, p1 + 0.55, y0 + 0.42, y0 + 0.5, z0 + 0.08, z0 + 0.36, 1);
  K.add('chrome', new THREE.CylinderGeometry(0.05, 0.04, 0.17, 12).translate(p1 + 0.42, y0 + 0.2, z0 + 0.3), 3);
  // the urns: a body, a dome, a finial, a tap; their gauge glass
  const urn = lathe([[0.0001, 0], [0.13, 0], [0.13, 0.04], [0.17, 0.08], [0.17, 0.5], [0.14, 0.58], [0.06, 0.66], [0.03, 0.7], [0.04, 0.74], [0.0001, 0.76]], 22);
  const ux = [a1 - 1.55, a1 - 0.8];
  for (const x of ux) {
    K.add('chrome', urn.clone().translate(x, y0, z0 + 0.24), 1);
    K.box('black', x - 0.02, x + 0.02, y0 + 0.08, y0 + 0.13, z0 + 0.4, z0 + 0.48, 3);
    K.box('lit', x + 0.1, x + 0.12, y0 + 0.12, y0 + 0.42, z0 + 0.38, z0 + 0.4, 3);
  }
  urn.dispose();
  // the word over them, lit, and a lamp low over the urns (their chrome catches it)
  label(K, 'COFFEE', (ux[0] + ux[1]) / 2, FLOOR + 2.15, z0, { w: 1.1, h: 0.28, dir: 's', lit: true });
  K.lamp((ux[0] + ux[1]) / 2, FLOOR + 2.35, z0 + 0.7, { kind: 'pendant', power: 0.55, ceilY: FLOOR + 3.8 });
  // the cups stacked upside down on a cloth between the urns and the case
  for (let i = 0; i < 4; i++) K.add('linen', new THREE.CylinderGeometry(0.045, 0.035, 0.07, 10).translate(a1 - 2.25 + i * 0.1, y0 + 0.035 + (i % 2) * 0.07, z0 + 0.3), 3);
  return pc;
}

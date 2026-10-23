import { FLOOR } from '../../city/kits/interior/kit.js';
import { counter, shelves, label, sheet } from '../../city/kits/interior/pieces.js';
import { RNG } from '../../util/rng.js';
import { pay, give, owns, wallet, arms, money } from '../../combat/money.js';
import { SHOP } from '../../scenes/94_o4.js';
import { priceCard } from '../../scenes/o4/places.js';

// The gun shop (the Tenements, off the avenue; brief O5 §2.4): a narrow
// front shop behind its windows, the counter across it with a glass case of
// pistols, the long guns racked on the wall behind the man, the card of
// prices over him and O4's card of them as I stand at the case. E at the case:
// buy - O4's rules (src/scenes/94_o4.js SHOP: the double, shells, .38s; the
// money and the coat's rounds in src/combat/money.js): a gun bought is mine
// (save.inventory) and comes out in my hand, the mouse wheel turns through
// what I own (city.js); rounds go into the coat. And the revolver, if I have
// none (the man in the coat has one under his arm: OPEN_WORLD §1). A fist at
// the man: his word and the room is sore (Places.fist).
export const PRICES = [
  { id: 'revolver', name: 'a revolver', price: 25, gun: 'revolver', with: 12, line: 'THE .38, SIX SHOTS ......... $25', when: (G) => !owns(G, 'revolver') },
  { id: 'shotgun', name: 'the double', price: SHOP.items.shotgun.price, gun: 'shotgun', with: 4, line: SHOP.items.shotgun.line, when: (G) => !owns(G, 'shotgun') },
  { id: 'rounds', name: 'a dozen .38s', price: SHOP.items.rounds.price, gives: SHOP.items.rounds.gives, line: SHOP.items.rounds.line },
  { id: 'shells', name: 'ten shells', price: SHOP.items.shells.price, gives: SHOP.items.shells.gives, line: SHOP.items.shells.line },
];
export default {
  kind: 'gunshop',
  spawn: { x: 0, z: -1.4, yaw: 0 },
  build(K, s, P) {
    const b = s.lb, R0 = new RNG(0x6A5), rng = () => R0.next();
    const x0 = Math.max(b.x0 + 0.45, -4.6), x1 = Math.min(b.x1 - 0.45, 11.0), z0 = -7.4, z1 = -0.3, H = 3.2;
    const W = P.faceWindows(s, { kinds: ['shop'], y0: 0, y1: 3, x0: x0 + 0.5, x1: x1 - 0.5 });
    K.windows = W;
    K.roomRect = { x0, x1, z0, z1 };
    K.room(x0, x1, z0, z1, { h: H, floor: 'boards', wall: 'plaster', look: { ambient: 0.55, haze: 0.3 }, sides: { s: { holes: [...P.doorHoles(s, 's'), ...P.windowHoles(W)] }, n: { holes: [{ a: x1 - 1.6, b: x1 - 0.6, top: FLOOR + 2.05 }] } } });
    // the counter across the shop, its glass case on the customer side
    const cz = -4.4;
    counter(K, x0 + 1.4, x1 - 2.0, cz - 0.6, cz, { dir: 's', h: 0.98, top: 'glass' });
    K.box('litDim', x0 + 1.6, x1 - 2.2, FLOOR + 0.62, FLOOR + 0.66, cz - 0.5, cz - 0.08, 2);
    // the pistols in the case (the base's revolver prop is the stand-in, laid flat)
    for (let i = 0; i < 4; i++) { const x = x0 + 2.2 + i * 1.1; K.box('black', x - 0.12, x + 0.12, FLOOR + 0.67, FLOOR + 0.7, cz - 0.38, cz - 0.24, 3); K.box('black', x + 0.04, x + 0.09, FLOOR + 0.67, FLOOR + 0.7, cz - 0.24, cz - 0.16, 3); }
    // the long guns racked on the back wall, the boxes of rounds on its shelves
    for (let i = 0; i < 9; i++) { const x = x0 + 1.0 + i * 0.42; K.box('black', x - 0.03, x + 0.03, FLOOR + 1.0, FLOOR + 2.3, z0 + 0.05, z0 + 0.1, 3); K.box('wood', x - 0.05, x + 0.05, FLOOR + 1.0, FLOOR + 1.35, z0 + 0.05, z0 + 0.14, 3); }
    K.box('wood', x0 + 0.7, x0 + 4.9, FLOOR + 2.25, FLOOR + 2.32, z0, z0 + 0.2, 1);
    K.box('wood', x0 + 0.7, x0 + 4.9, FLOOR + 1.05, FLOOR + 1.12, z0, z0 + 0.2, 1);
    shelves(K, x0 + 5.4, x1 - 2.2, z0, { dir: 's', h: 2.3, n: 4, depth: 0.35, fill: 'woodHi', rng });
    // the lamps: two shaded over the counter, one by the door
    K.lamp(x0 + 2.8, FLOOR + 2.5, cz - 0.3, { kind: 'pendant', power: 0.9, ceilY: FLOOR + H });
    K.lamp(x0 + 5.8, FLOOR + 2.5, cz - 0.3, { kind: 'pendant', power: 0.9, ceilY: FLOOR + H });
    K.lamp(0, FLOOR + 2.6, -1.6, { kind: 'bare', power: 0.4, ceilY: FLOOR + H });
    // the card of prices over the man, a target sheet, the back room's door (locked)
    label(K, PRICES.map((p) => `${p.name.toUpperCase().padEnd(20, ' ')} $${p.price}`).join('\n'), x0 + 2.9, FLOOR + 2.65, z0 + 0.02, { w: 2.6, h: 0.6, dir: 's', lit: true });
    label(K, 'GUNS', x1 - 0.02, FLOOR + 2.3, -2.4, { w: 1.0, h: 0.42, dir: 'w', dark: true });
    sheet(K, -2.0, FLOOR + 1.7, x1, { w: 0.5, h: 0.65, dir: 'w' });
    K.door({ x: x1 - 1.6, z: z0 - 0.12, axis: 'x', w: 1.0, locked: true, name: 'back' });
    // the man behind the counter
    K.fig('oldman', x0 + 4.0, cz - 1.25, 0, { name: 'gunman', state: 'idle' });
    // E at the case: what he sells, one thing a press (cycling)
    K.use({ at: [x0 + 3.6, FLOOR + 1.0, cz - 0.1], range: 2.0, cone: 0.55, prompt: () => offerText(s, P), onUse: () => buy(K, s, P) });
    K.use({ at: [x0 + 5.6, FLOOR + 1.0, cz - 0.1], range: 2.0, cone: 0.25, prompt: 'next', onUse: () => { pick(s, P, 1); P.game.sfx.play('paperTouch', null, {}, { ref: 1 }); P.game.hud.message(cur(s, P).name, 1.2); } });
    K.caseAt = { x: x0 + 4.6, z: cz };
  },
  // (O4's card of prices while I stand at the case)
  live(K, s, P) {
    const G = P.game;
    return {
      step() {
        const c = K.F.w(K.caseAt.x, K.caseAt.z), d = Math.hypot(G.eye.x - c.x, G.eye.z - c.z);
        priceCard(G.hud, d < 3.0 && P.inside === s && !G.failing ? ['GUNS  &  AMMUNITION', ...PRICES.filter((p) => !p.when || p.when(G)).map((p) => p.line), 'YOU HAVE  $' + money(G)] : []);
      },
      dispose() { priceCard(G.hud, []); },
    };
  },
};
const list = (G) => PRICES.filter((p) => !p.when || p.when(G));
const cur = (s, P) => { const L = list(P.game); return L[(s.state.pick || 0) % L.length]; };
const pick = (s, P, d) => { s.state.pick = ((s.state.pick || 0) + d + 100) % list(P.game).length; };
function offerText(s, P) {
  const p = cur(s, P);
  return `buy ${p.name}: $${p.price}`;
}
function buy(K, s, P) {
  const G = P.game, p = cur(s, P);
  if (s.state.sore) { G.hud.message('Not to you. Not tonight.', 1.6); return; }
  if (!pay(G, p.price, p.id)) { G.hud.message(`Not enough. $${p.price}.`, 1.6); G.sfx.play('revDry', null, {}, { send: false, gain: 0.6 }); return; }
  G.sfx.play('o4_till', null, {}, { send: false, gain: 0.8 });
  const A = wallet(G).ammo;
  if (p.gun) {
    // (a gun bought is mine and comes out in my hand, its rounds in my coat)
    give(G, p.gun);
    A[p.gun] = (A[p.gun] || 0) + p.with;
    arms(G).to(p.gun);
    G.setViewmodelVisible(true);
    if (G.controller.mode === 'walk') G.controller.setMode('gun', { crouch: false });
    G.hud.say ? G.hud.say(p.gun === 'shotgun' ? 'The double. Four shells with it.' : 'The .38. A dozen rounds with it.', 2.0, { always: true }) : null;
    s.state.pick = 0;
  } else for (const [gun, n] of Object.entries(p.gives)) {
    A[gun] = (A[gun] || 0) + n;
    const W = G.player.weapons.get(gun);
    if (G.player.weapons.current === gun && W && Number.isFinite(W.pocket)) { W.pocket += n; if (W.keep) W.keep(); }
    G.hud.say ? G.hud.say(n + (gun === 'shotgun' ? ' shells.' : ' rounds.'), 1.8, { always: true }) : null;
  }
  G.emit('shop:buy', { id: p.id, price: p.price, item: p.gun || null });
}

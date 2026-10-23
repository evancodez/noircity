import { defineScene, wait, until, beat } from '../game/script.js';
import { crowdOf } from '../combat/brawl/Crowd.js';
import { gunsOf } from '../guns/Guns.js';
import { money, earn, pay, owns, give, arms, wallet } from '../combat/money.js';
import { BOXER_LEVELS } from '../combat/brawl/kinds.js';
import { buildCounter, buildRing, priceCard } from './o4/places.js';
import { DINER, counterAt } from './_diner_room.js';

// [O4] Lane O4's test bed (docs/briefs/O4_COMBAT.md): NOT a scene of the
// story; ?start=o4 plays it from the first contest, ?start=o4.<beat> one
// contest, ?scene=o4&beat=<beat> frames it. On the block (the avenue under
// the el, the diner) until the city (lane O1) merges. Each beat is a contest
// of its own with its own retry (a fall puts me back at its start, the men
// as they were), and on to the next when it is won:
//   brawl1     a driver in the street (the crowd brawl, one man)
//   brawl2     two: a driver and a hood
//   brawl3     three: a driver, a hood, a drunk
//   cop        a cop: he blocks well and grabs; down, 'Hands up.'
//   done       the end of the run (E: again)
// The plays (tools/plays/o4_*.json, the driver tools/lib/o4_brawl.mjs) read
// G.crowd and ctx.flags.o4.
const NORTH = 0;
export const O4 = {
  // the street before the diner: open road, the cars and the el's columns round it
  me: { x: -1.0, z: 3.0, yaw: NORTH },
  brawl1: { men: [{ kind: 'driver', at: { x: -0.6, z: -1.2 } }], obj: 'The driver. Put him down.' },
  brawl2: { men: [{ kind: 'driver', at: { x: -2.2, z: -1.0 } }, { kind: 'gangster', at: { x: 1.4, z: -1.4 } }], obj: 'Two of them. Put them down.' },
  brawl3: { men: [{ kind: 'driver', at: { x: -2.6, z: -0.8 } }, { kind: 'gangster', at: { x: 1.6, z: -1.6 } }, { kind: 'drunk', at: { x: -0.4, z: -2.6 } }], obj: 'Three of them. Keep them in front.' },
  cop: { men: [{ kind: 'cop', at: { x: -0.6, z: -1.2 } }], obj: 'A cop. Fists, or run.' },
};
// the street shootout: four of the gang down the avenue, the cover the world's
// (the cars, the el's columns, the barrels, the newsstand, a wall's end);
// I start down behind the column, the revolver and a pocket of rounds
const EAST = -Math.PI / 2;
export const STREET = {
  // (a sedan left across the near lane: low cover, wide - the bed's own, the block's cars stand along the kerbs)
  car: { x: 7.4, z: -11.4, yaw: 0.06 },
  at: [7.6, -9.55, 0],
  area: { x0: -9.6, x1: 18.2, z0: -42, z1: 8 },
  pocket: 24,
  men: [
    { kind: 'pistol', at: { x: 6.4, z: -20.7 }, cover: true, wait: 1.6, variant: { coat: 0, brim: 1, tall: 1 } },
    { kind: 'tommy', at: { x: 12.9, z: -25.1 }, cover: true, wait: 2.6, variant: { coat: 1, brim: 0, tall: 1, heavy: true, cap: 'flat' } },
    { kind: 'pistol', at: { x: 2.6, z: -28.7 }, cover: true, wait: 3.4, variant: { coat: 2, brim: 0, tall: 0, cap: 'flat' } },
    // (the fourth comes up the avenue later, from the far cars on the left)
    { kind: 'pistol', at: { x: -4.0, z: -42.0 }, way: [{ x: -4.2, z: -33.0, run: true }, { x: -4.3, z: -26.7, run: true }], wait: 9.0, variant: { coat: 1, brim: 1, tall: 1, cig: true } },
  ],
  // the bot's cover spots (behind them, facing the men)
  spots: [{ x: 7.6, z: -9.55, yaw: 0 }, { x: 5.6, z: -9.6, yaw: 0.1 }, { x: 10.62, z: -8.55, yaw: 0 }, { x: 11.8, z: 2.85, yaw: 0 }],
  open: { x: 6.5, z: -9.0 },
  obj: 'Four of them down the street. Cover to cover.',
};
// the shotgun's range: three men standing down the avenue at 4, 10 and 25 m (no
// brains: targets), the double in hand and ten shells in the coat
export const RANGE = {
  at: [2.0, 6.5, 0],
  men: [{ x: 2.0, z: 2.5, d: 4 }, { x: 1.4, z: -3.5, d: 10 }, { x: 2.6, z: -18.5, d: 25 }],
  pocket: 10,
  obj: 'The shotgun. Close, it is murder.',
};
// the gun shop (the rules; the room is lane O5's): a counter on the pavement,
// the double, shells, rounds on it; E buys what I look at; the card of prices
export const SHOP = {
  counter: { x: -8.9, z: -10.2, yaw: Math.PI / 2 }, at: [-7.25, -10.2, Math.PI / 2], cash: 150,
  items: {
    shotgun: { price: 120, prompt: 'buy the shotgun', line: 'THE DOUBLE  12 BORE ...... $120' },
    shells: { price: 8, prompt: 'buy ten shells', line: 'SHELLS, A BOX OF TEN ..... $8', gives: { shotgun: 10 } },
    rounds: { price: 6, prompt: 'buy a dozen .38s', line: '.38 ROUNDS, A DOZEN ...... $6', gives: { revolver: 12 } },
  },
  obj: 'The gun shop. Buy what you need.',
};
// the gym's ring (the rules; the room is lane O5's): a bout with a boxer of a
// level for a bet; won, the purse; down, the bet is his
export const GYM = { ring: { x: 3.0, z: 12.6, size: 5.2 }, cash: 60, obj: 'The gym. A bout, for money.' };
// a bar brawl in the diner: two of them by the counter; the room's things to
// fight with (two bottles on the counter, the cafe's chairs), its walls to
// put a man into, the stools in his way and mine
export const DINERFIGHT = {
  me: { x: -12.15, z: -1.7, yaw: Math.PI },
  men: [{ kind: 'drunk', at: { x: -12.9, z: 2.3 } }, { kind: 'driver', at: { x: -11.9, z: 4.4 } }],
  bottles: [[3, 0.16, 0.1, 'o4.bottle1'], [6, 0.16, -0.2, 'o4.bottle2']],
  obj: 'A fight in the diner. Use the room.',
};
const CONTESTS = ['brawl1', 'brawl2', 'brawl3', 'cop', 'street', 'diner'];
const NEXT = { brawl1: 'brawl2', brawl2: 'brawl3', brawl3: 'cop', cop: 'diner', diner: 'street', street: 'done', done: 'brawl1' };

// the street for a beat: the men gone, me where I start, the fight begun
function street(ctx, name) {
  const G = ctx.game, F = crowdOf(G), B = O4[name];
  F.stop('setup');
  F.clearMen();
  gunsOf(G).end();
  for (const h of [...G.world.hoods.list]) G.removeHood(h);
  G.corpses.length = 0; G.pending.length = 0;
  G.fx.clear();
  G.health.reset();
  if (name === 'street') { shootout(ctx); return; }
  if (name === 'range') { range(ctx); return; }
  if (name === 'shop') { shop(ctx); return; }
  if (name === 'gym') { gym(ctx); return; }
  if (name === 'diner') { dinerFight(ctx); return; }
  const E = O4.me;
  ctx.controller.setPose(E.x, E.z, E.yaw, -0.05);
  G.eye.copy(G.camera.position);
  ctx.flags.o4 = { beat: name, t0: G.time, result: null, tries: G.fails(name) };
  if (!B) { ctx.player.weapons.equip('fists'); return; }
  F.start({ men: B.men.map((m) => ({ ...m, yaw: Math.atan2(E.x - m.at.x, E.z - m.at.z) })), to: name, leave: true, seed: 4242 + G.fails(name) * 7,
    onEnd: (result) => { ctx.flags.o4.result = result; } });
}

// the bar brawl: the diner's floor, its things, two men
function dinerFight(ctx) {
  const G = ctx.game, S = ctx.stage, B = DINERFIGHT, F = crowdOf(G), d = S.part('diner');
  const Bk = S.breakables;
  const E = B.me;
  ctx.controller.setPose(E.x, E.z, E.yaw, -0.05);
  G.eye.copy(G.camera.position);
  // (the room's things, as the diner's fight takes them: off the floor, out of the bullets' world)
  const lift = (o, handle) => {
    if (handle && Bk) Bk.snapshot(handle);
    if (o.parent) o.parent.remove(o);
    o.traverse((m) => { if (m.isMesh) S.removeSolid(m); });
    if (handle && handle.collider) for (const arr of [S.colliders.circles, S.colliders.boxes]) { const k = arr.indexOf(handle.collider); if (k >= 0) arr.splice(k, 1); }
    if (handle) handle.broken = true;
    o.position.set(0, 0, 0); o.quaternion.identity(); o.scale.setScalar(1);
    return o;
  };
  const things = [];
  for (const [i, back, dz, name] of B.bottles) {
    const o = d.place('bottle', counterAt(i, back, dz), { name, variant: 'beer' });
    things.push({ kind: 'bottle', name, object: o, take: () => d.take(name), available: () => d.items.get(name) === o });
  }
  for (const t of d.booths.cafe || []) for (const c of t.chairs) {
    if (!c.handle || c.handle.broken || c.handle.toppled) continue;
    const it = { kind: 'chair', object: c.object, taken: false };
    it.take = () => { it.taken = true; return lift(c.object, c.handle); };
    it.available = () => !it.taken && !c.handle.broken && !c.handle.toppled;
    things.push(it);
  }
  ctx.flags.o4 = { beat: 'diner', t0: G.time, result: null, things: things.length };
  F.start({ men: B.men.map((m) => ({ ...m, yaw: Math.atan2(E.x - m.at.x, E.z - m.at.z) })), to: 'diner', leave: false, seed: 5100 + G.fails('diner') * 7,
    bounds: { x0: DINER.counter.frontX + 0.25, x1: DINER.innerX - 0.1, z0: DINER.zMin + 0.2, z1: DINER.zMax - 0.2 }, things,
    onEnd: (result) => { ctx.flags.o4.result = result; } });
}

// the gun shop: the counter and its things; the money for the test
function shop(ctx) {
  const G = ctx.game, S = ctx.stage, C = ctx.controller, B = SHOP;
  if (S._o4shop) S._o4shop.remove();
  S._o4shop = buildCounter(S, B.counter);
  C.setPose(B.at[0], B.at[1], B.at[2], -0.18);
  G.eye.copy(G.camera.position);
  wallet(G);
  if (!ctx.flags.o4cash) { ctx.flags.o4cash = true; G.save.money = Math.max(G.save.money, B.cash); }
  if (!owns(G, 'revolver')) give(G, 'revolver');
  arms(G).to(owns(G, 'shotgun') ? 'shotgun' : 'revolver');
  ctx.flags.o4 = { beat: 'shop', t0: G.time, bought: [] };
}
// the gym: the ring on the road, the boxer of the next level in his corner
function gym(ctx) {
  const G = ctx.game, S = ctx.stage, C = ctx.controller, R = GYM.ring;
  if (S._o4ring) S._o4ring.remove();
  const ring = S._o4ring = buildRing(S, R);
  C.setPose(ring.door.x - 0.6, ring.door.z + 1.4, Math.atan2(-(R.x - ring.door.x), -(R.z - ring.door.z)), -0.1);
  G.eye.copy(G.camera.position);
  ctx.player.weapons.equip('fists');
  wallet(G);
  if (!ctx.flags.o4gymcash) { ctx.flags.o4gymcash = true; G.save.money = Math.max(G.save.money, GYM.cash); }
  const lv = Math.min(3, (G.save.flags.o4gym || 0) + 1);
  const L = BOXER_LEVELS[lv];
  const c = G.cast.spawn('o4_boxer', { at: ring.his, yaw: Math.atan2(ring.mine.x - ring.his.x, ring.mine.z - ring.his.z), name: 'boxer' + lv });
  c.setState('br_guard', 0);
  ctx.flags.o4 = { beat: 'gym', t0: G.time, level: lv, boxer: c, result: null, bet: 0 };
  void L;
}

// the range: the men stand there, the shotgun in hand
function range(ctx) {
  const G = ctx.game, C = ctx.controller, R = RANGE;
  C.setPose(R.at[0], R.at[1], R.at[2], -0.02);
  G.eye.copy(G.camera.position);
  const W = ctx.player.weapons;
  W.equip('shotgun');
  const S = W.get('shotgun');
  if (S) S.setCounts({ rounds: 2, pocket: R.pocket });
  ctx.flags.o4 = { beat: 'range', men: [], t0: G.time };
  for (const m of R.men) {
    const h = G.spawnHood(m.x, m.z, { variant: { coat: 1, brim: 1, tall: 1, cap: 'flat' }, yaw: Math.atan2(R.at[0] - m.x, R.at[1] - m.z), ai: false, hp: 100, state: 'idle' });
    h.o4d = m.d;
    ctx.flags.o4.men.push(h);
  }
}

// the shootout down the avenue (the gun kit, its men planning on the world's cover)
function shootout(ctx) {
  const G = ctx.game, K = gunsOf(G), B = STREET, C = ctx.controller, S = ctx.stage;
  // (the sedan across the lane: once on this stage; it stays, a car like the others)
  if (!S._o4car) { const cars = S.part('cars'); const car = cars.spawn({ pos: new G.camera.position.constructor(B.car.x, 0, B.car.z), yaw: B.car.yaw, lights: false, paint: 'paint' }); cars.cars.push(car); S._o4car = car; }
  C.setPose(B.at[0], B.at[1], B.at[2], -0.04);
  C.setMode('gun', { crouch: true });
  G.eye.copy(G.camera.position);
  K.arm('revolver', { pocket: B.pocket });
  K.begin({ world: true, area: B.area, to: 'street', maxFiring: 2, flankAfter: 14, settleK: 1.2, dmgK: 0.9 });
  ctx.flags.c2 = { beat: 'street', men: [], won: false, t0: G.time, spots: B.spots, open: B.open };
  ctx.flags.o4 = { beat: 'street', t0: G.time, result: null };
  for (const m of B.men) ctx.flags.c2.men.push(K.spawn({ kind: m.kind, at: m.at, way: m.way ? { steps: m.way } : null, wait: m.wait ?? 0, cover: !!m.cover, variant: m.variant || null }));
}

export default defineScene({
  id: 'o4', stage: 'block', title: '', name: 'The Street',
  beats: [...CONTESTS, 'done', 'range', 'shop', 'gym'],
  save: [],
  objectives: { ...Object.fromEntries(CONTESTS.map((k) => [k, k === 'street' ? STREET.obj : k === 'diner' ? DINERFIGHT.obj : O4[k].obj])), done: 'All of them won. E: again.', range: RANGE.obj, shop: SHOP.obj, gym: GYM.obj },
  setup: Object.fromEntries([...CONTESTS, 'done', 'range', 'shop', 'gym'].map((b) => [b, (ctx) => street(ctx, b)])),
  *script(ctx) {
    const G = ctx.game, F = ctx.flags, C = crowdOf(G);
    const exitFn = () => { C.stop('exit'); C.clearMen(); gunsOf(G).end(); G.off('scene:exit', exitFn); ctx.hud.warn(null); priceCard(G.hud, []);
      const S = ctx.stage; if (S._o4shop) { S._o4shop.remove(); S._o4shop = null; } if (S._o4ring) { S._o4ring.remove(); S._o4ring = null; } };
    G.on('scene:exit', exitFn);
    const name = ctx.beat;
    if (name === 'done') {
      yield beat('done');
      yield* ctx.prompt({ text: 'again', key: 'KeyE' });
      G.scenes.go('o4', { beat: 'brawl1', fade: 'black', card: false });
      return;
    }
    // (the mouse wheel turns through what I own: fists, the revolver, the shotgun)
    ctx.onStep(() => { const w = G.mouse.wheel; if (w && !C.active) arms(G).next(Math.sign(w)); });
    if (name === 'range') { yield beat('range'); return; }
    if (name === 'shop') { yield* shopScript(ctx); return; }
    if (name === 'gym') { yield* gymScript(ctx); return; }
    if (!CONTESTS.includes(name)) return;
    if (name === 'street') { yield* shootoutScript(ctx); return; }
    yield beat(name);
    yield until(() => !!(F.o4 && F.o4.result));
    const r = F.o4.result;
    (G._o4won || (G._o4won = [])).push(name + ':' + r);
    if (r === 'won') ctx.hud.objective('Down. All of them.');
    else if (r === 'left') ctx.hud.objective('Walked away.');
    yield wait(1.8);
    ctx.hud.objective(null);
    // (won: on to the next; a play that proves one contest keeps it: G.o4stay)
    G.scenes.go('o4', { beat: r === 'won' && !G.o4stay ? NEXT[name] : name, fade: 'black', card: false });
  },
});

// the shootout's contest: the kit's cards, its warning each step, won when the last is down
function* shootoutScript(ctx) {
  const G = ctx.game, K = gunsOf(G), F = ctx.flags, C = ctx.controller;
  yield beat('street');
  G.director.stop(); G.director.begin();
  G.director.run(function* () { while (G.scenes.ctx === ctx && !(F.c2 && F.c2.won)) yield null; });
  let won = false;
  ctx.onStep(() => ctx.hud.warn(K.active && !won ? K.warning() : null));
  if (G.fails('street') === 2) K.teach('crouch', { again: true }); else K.teach('crouch');
  let rose = false, n0 = 4;
  const alive = () => (F.c2 ? F.c2.men.filter((h) => h.alive).length : 0);
  yield until(() => {
    if (!rose && (C.crouchK || 0) > 0.6) { rose = true; K.teach('rise'); }
    const n = alive();
    if (n < n0 && n === 1) ctx.hud.objective('One left.');
    n0 = n;
    return n === 0;
  });
  F.c2.won = true; won = true; ctx.hud.warn(null);
  (G._c2won || (G._c2won = [])).push('street');
  F.o4.result = 'won';
  ctx.hud.objective('Clear.');
  yield wait(1.8);
  ctx.hud.objective(null);
  K.end();
  G.scenes.go('o4', { beat: G.o4stay ? 'street' : NEXT.street, fade: 'black', card: false });
}

// the gun shop: E on a thing on the counter buys it (the prompt says the price)
function* shopScript(ctx) {
  const G = ctx.game, S = ctx.stage, K = S._o4shop, F = ctx.flags;
  yield beat('shop');
  const say = (t) => G.hud.say(t, 1.8, { always: true });
  for (const [k, it] of Object.entries(SHOP.items)) {
    const h = ctx.interact.add({ id: 'o4buy:' + k, at: () => K.at(k), range: 2.2, cone: 0.32, prompt: it.prompt + '  $' + it.price,
      when: () => !(k === 'shotgun' && owns(G, 'shotgun')),
      onUse: () => {
        if (!pay(G, it.price, k)) { G.sfx.play('revDry', null, {}, { send: false, gain: 0.6 }); say('Not enough. $' + it.price + '.'); return; }
        G.sfx.play('o4_till', null, {}, { send: false, gain: 0.8 });
        F.o4.bought.push(k);
        if (k === 'shotgun') { give(G, 'shotgun'); K.items.shotgun.visible = false; const A = wallet(G).ammo; A.shotgun = (A.shotgun || 0) + 4; arms(G).to('shotgun'); say('The double. Four shells with it.'); }
        else for (const [gun, n] of Object.entries(it.gives)) {
          const A = wallet(G).ammo, W = G.player.weapons.get(gun);
          A[gun] = (A[gun] || 0) + n;
          if (G.player.weapons.current === gun && W && Number.isFinite(W.pocket)) { W.pocket += n; if (W.keep) W.keep(); }
          say(n + (gun === 'shotgun' ? ' shells.' : ' rounds.'));
        }
      } });
    void h;
  }
  // the card of prices, while I stand at the counter
  ctx.onStep(() => {
    const c = SHOP.counter, d = Math.hypot(G.eye.x - c.x, G.eye.z - c.z);
    priceCard(G.hud, d < 3.2 ? ['GUNS  &  AMMUNITION', ...Object.entries(SHOP.items).filter(([k]) => !(k === 'shotgun' && owns(G, 'shotgun'))).map(([, it]) => it.line), 'YOU HAVE  $' + money(G)] : []);
  });
  yield until(() => false);
}

// the gym: E at my corner takes the bout (the bet if I have it), I step in, he comes
function* gymScript(ctx) {
  const G = ctx.game, S = ctx.stage, ring = S._o4ring, F = ctx.flags, C = crowdOf(G);
  yield beat('gym');
  const lv = F.o4.level, L = BOXER_LEVELS[lv];
  const bet = () => Math.min(money(G), L.bet);
  ctx.onStep(() => {
    const d = Math.hypot(G.eye.x - ring.door.x, G.eye.z - ring.door.z);
    priceCard(G.hud, d < 4 && !C.active && !F.o4.result ? ['THE GYM.  TONIGHT:', L.name + '  (' + ['', 'A KID', 'A PRO', 'THE CHAMP'][lv] + ')', 'BET $' + L.bet + '  -  PURSE $' + L.purse, 'YOU HAVE  $' + money(G)] : []);
  });
  let go = false;
  ctx.interact.add({ id: 'o4bout', at: () => new G.camera.position.constructor(ring.door.x + 0.55, 1.1, ring.door.z - 0.55), range: 2.8, cone: 0.9, prompt: 'a bout with ' + L.name.toLowerCase(),
    when: () => !C.active && !F.o4.result, onUse: () => { go = true; } });
  yield until(() => go);
  ctx.interact.remove('o4bout');
  F.o4.bet = bet();
  if (F.o4.bet > 0) pay(G, F.o4.bet, 'bet');
  priceCard(G.hud, []);
  G.sfx.play('o4_bell', null, {}, { send: false, gain: 0.7 });
  // in through the ropes to my corner (half a second, eased)
  const m = ring.mine, his = ring.his;
  const yaw = Math.atan2(-(his.x - m.x), -(his.z - m.z));
  ctx.controller.ease({ x: m.x, y: G.stage.surfaceY(m.x, m.z) + 1.65, z: m.z, yaw, pitch: -0.05 }, 0.45);
  yield wait(0.5);
  ctx.controller.setPose(m.x, m.z, yaw, -0.05);
  G.eye.copy(G.camera.position);
  ctx.hud.objective('Win the bout.');
  C.start({ men: [{ kind: 'boxer', c: F.o4.boxer, name: L.name, over: { ...L }, hp: L.hp }], bounds: ring.bounds, leave: false, to: 'gym', maxIn: 1, seed: 7100 + lv,
    onEnd: (r) => { F.o4.result = r; },
    onDown: () => ({ why: F.o4.bet > 0 ? 'Out cold. The bet is his.' : 'Out cold.', to: 'gym' }) });
  yield until(() => !!F.o4.result);
  if (F.o4.result === 'won') {
    G.sfx.play('o4_bell', null, {}, { send: false, gain: 0.7 });
    const purse = F.o4.bet > 0 ? L.purse + F.o4.bet : Math.round(L.purse / 2);
    earn(G, purse, 'purse');
    G.save.flags.o4gym = Math.max(G.save.flags.o4gym || 0, lv);
    (G._o4won || (G._o4won = [])).push('gym:' + lv);
    ctx.hud.objective('Won. $' + purse + '.');
  }
  yield wait(2.4);
  ctx.hud.objective(null);
  G.scenes.go('o4', { beat: 'gym', fade: 'black', card: false });
}

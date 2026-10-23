import { defineScene, wait, until, beat } from '../game/script.js';
import { crowdOf } from '../combat/brawl/Crowd.js';
import { gunsOf } from '../guns/Guns.js';

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
const CONTESTS = ['brawl1', 'brawl2', 'brawl3', 'cop', 'street'];
const NEXT = { brawl1: 'brawl2', brawl2: 'brawl3', brawl3: 'cop', cop: 'street', street: 'done', done: 'brawl1' };

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
  const E = O4.me;
  ctx.controller.setPose(E.x, E.z, E.yaw, -0.05);
  G.eye.copy(G.camera.position);
  ctx.flags.o4 = { beat: name, t0: G.time, result: null, tries: G.fails(name) };
  if (!B) { ctx.player.weapons.equip('fists'); return; }
  F.start({ men: B.men.map((m) => ({ ...m, yaw: Math.atan2(E.x - m.at.x, E.z - m.at.z) })), to: name, leave: true, seed: 4242 + G.fails(name) * 7,
    onEnd: (result) => { ctx.flags.o4.result = result; } });
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
  beats: [...CONTESTS, 'done'],
  save: [],
  objectives: { ...Object.fromEntries(CONTESTS.map((k) => [k, k === 'street' ? STREET.obj : O4[k].obj])), done: 'All of them won. E: again.' },
  setup: Object.fromEntries([...CONTESTS, 'done'].map((b) => [b, (ctx) => street(ctx, b)])),
  *script(ctx) {
    const G = ctx.game, F = ctx.flags, C = crowdOf(G);
    const exitFn = () => { C.stop('exit'); C.clearMen(); gunsOf(G).end(); G.off('scene:exit', exitFn); ctx.hud.warn(null); };
    G.on('scene:exit', exitFn);
    const name = ctx.beat;
    if (name === 'done') {
      yield beat('done');
      yield* ctx.prompt({ text: 'again', key: 'KeyE' });
      G.scenes.go('o4', { beat: 'brawl1', fade: 'black', card: false });
      return;
    }
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

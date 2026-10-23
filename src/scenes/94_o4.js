import { defineScene, wait, until, beat } from '../game/script.js';
import { crowdOf } from '../combat/brawl/Crowd.js';

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
const CONTESTS = ['brawl1', 'brawl2', 'brawl3', 'cop'];
const NEXT = { brawl1: 'brawl2', brawl2: 'brawl3', brawl3: 'cop', cop: 'done', done: 'brawl1' };

// the street for a beat: the men gone, me where I start, the fight begun
function street(ctx, name) {
  const G = ctx.game, F = crowdOf(G), B = O4[name];
  F.stop('setup');
  F.clearMen();
  for (const h of [...G.world.hoods.list]) G.removeHood(h);
  G.fx.clear();
  G.health.reset();
  const E = O4.me;
  ctx.controller.setPose(E.x, E.z, E.yaw, -0.05);
  G.eye.copy(G.camera.position);
  ctx.flags.o4 = { beat: name, t0: G.time, result: null, tries: G.fails(name) };
  if (!B) { ctx.player.weapons.equip('fists'); return; }
  F.start({ men: B.men.map((m) => ({ ...m, yaw: Math.atan2(E.x - m.at.x, E.z - m.at.z) })), to: name, leave: true, seed: 4242 + G.fails(name) * 7,
    onEnd: (result) => { ctx.flags.o4.result = result; } });
}

export default defineScene({
  id: 'o4', stage: 'block', title: '', name: 'The Street',
  beats: [...CONTESTS, 'done'],
  save: [],
  objectives: { ...Object.fromEntries(CONTESTS.map((k) => [k, O4[k].obj])), done: 'All of them won. E: again.' },
  setup: Object.fromEntries([...CONTESTS, 'done'].map((b) => [b, (ctx) => street(ctx, b)])),
  *script(ctx) {
    const G = ctx.game, F = ctx.flags, C = crowdOf(G);
    const exitFn = () => { C.stop('exit'); C.clearMen(); G.off('scene:exit', exitFn); ctx.hud.warn(null); };
    G.on('scene:exit', exitFn);
    const name = ctx.beat;
    if (name === 'done') {
      yield beat('done');
      yield* ctx.prompt({ text: 'again', key: 'KeyE' });
      G.scenes.go('o4', { beat: 'brawl1', fade: 'black', card: false });
      return;
    }
    if (!CONTESTS.includes(name)) return;
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

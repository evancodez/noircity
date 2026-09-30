import { defineScene, wait, until, beat } from '../game/script.js';

// The revolver's range (lane B3): NOT a scene of the story - it is not in
// src/scenes/order.js, so the story never reaches it; ?start=range plays it
// (tools/plays/revolver.json), ?scene=range&beat=<beat> frames it. On the
// block, in the street's composition: three Hoods down the avenue under the
// lamps. Q draws the .38; at the first shot they come alive and fire from
// where they stand; all three down, Q puts it away, and the end card.
// Beats: ready (holstered, the prompt), fight (drawn, the men awake), done.
// (the eye and the men: the play's aim is computed from these)
export const RANGE = {
  eye: { x: -3.8, z: -9.0, yaw: -0.105, pitch: 0.0 },
  hoods: [
    { x: -1.6, z: -19.5, variant: { coat: 1, brim: 1, tall: 1, cig: true } },
    { x: 2.6, z: -24.0, variant: { coat: 0, brim: 0, tall: 0 } },
    { x: -6.0, z: -27.0, variant: { coat: 2, brim: 1, tall: 1 } },
  ],
};

function place(ctx) {
  const E = RANGE.eye;
  ctx.controller.setPose(E.x, E.z, E.yaw, E.pitch);
}
// the three, on free ground (the nav grid's nearest free cell), facing me;
// asleep until a shot (theirs or mine), then fighting from where they stand
function spawnMen(ctx, awake = false) {
  const G = ctx.game, nav = G.nav, E = RANGE.eye;
  return RANGE.hoods.map((H, i) => {
    let x = H.x, z = H.z;
    if (nav && nav.nearestFree) { const k = nav.nearestFree(x, z, 3); const c = nav.center(k); x = c.x; z = c.z; }
    const h = G.spawnHood(x, z, { variant: H.variant, yaw: Math.atan2(E.x - x, E.z - z), wake: awake ? () => true : 'shot', post: { x, z }, leash: 0, aim: 0.45 });
    h.rangeIndex = i;
    return h;
  });
}
const alive = (G) => G.world.hoods.list.filter((h) => h.alive).length;

export default defineScene({
  id: 'range', stage: 'block', title: '', name: 'The Range',
  beats: ['ready', 'fight', 'done'],
  setup: {
    ready(ctx) { place(ctx); ctx.player.weapons.equip(null); ctx.flags.men = spawnMen(ctx); },
    fight(ctx) { place(ctx); ctx.flags.men = spawnMen(ctx, true); ctx.player.weapons.equip('revolver'); },
    done(ctx) { place(ctx); ctx.player.weapons.equip('revolver'); },
  },
  *script(ctx) {
    const G = ctx.game;
    if (ctx.at('ready')) {
      yield wait(0.8);
      yield* ctx.prompt({ text: 'draw', key: 'KeyQ' });
      ctx.player.weapons.equip('revolver');
      ctx.hud.prompt('LMB  fire     RMB  steady     R  reload', null, 'range');
      yield until(() => G.counters.shots > 0);
      ctx.hud.clearPrompt('range');
    }
    yield beat('fight');
    // (the fight: a director's encounter, so the health shows)
    G.director.run(function* (d) { yield d.until(() => alive(G) === 0); });
    yield until(() => alive(G) === 0);
    yield wait(1.2);
    G.director.stop();
    yield beat('done');
    {
      yield* ctx.prompt({ text: 'put away', key: 'KeyQ' });
      const w = ctx.player.weapons.get('revolver');
      if (w && w.holster()) yield until(() => ctx.player.weapons.current !== 'revolver');
      yield wait(0.8);
    }
    ctx.next();
  },
});

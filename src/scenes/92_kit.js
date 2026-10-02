import { defineScene, wait, until, beat } from '../game/script.js';

// The kit's test bed (lane C1; docs/story/seams/Z.md): NOT a scene of the
// story - not in src/scenes/order.js; ?start=kit plays it (tools/plays/kit*.json),
// ?scene=kit&beat=ready frames it. One small contest that uses the whole kit,
// so the kit is proven by play, not only built:
//   the objective line   'Stop the walking man.' (struck through: 'Done.')
//   the teach cards      [LMB] fire, then [RMB] steady the aim; once per save;
//                        shown once more after two fails (teach.again)
//   the warning          "He's getting close." when he is 7 m from me
//   the fail             he reaches me: 'He reached you.', black, back at
//                        the start of 'ready', the world as its setup makes it
// A man walks up the avenue at me (brain kit_walker: he never fires; a hit
// checks him for half a second). The revolver is out. Two body hits or one in
// the head put him down. Won: 'Done.', then the round again (kit.wins counts).
// Idle, he reaches me in about 12 s: the warning about 4 s before.
export const KIT_BED = {
  eye: { x: -3.8, z: -9.0, yaw: -0.105, pitch: 0.0 },
  from: { x: -1.2, z: -30.5 },
  goal: { x: -3.5, z: -12.0 },
  near: 7,
};

function spawnWalker(ctx) {
  const G = ctx.game, B = KIT_BED;
  let { x, z } = B.from;
  const nav = G.nav;
  if (nav && nav.nearestFree) { const k = nav.nearestFree(x, z, 3); const c = nav.center(k); x = c.x; z = c.z; }
  const F = ctx.flags;
  const h = G.spawnHood(x, z, {
    variant: { coat: 1, brim: 1, tall: 1, cig: false }, yaw: Math.atan2(B.goal.x - x, B.goal.z - z),
    brain: 'kit_walker', goal: B.goal, hp: 100,
    onArrive: () => { F.arrived = true; },
  });
  return h;
}

export default defineScene({
  id: 'kit', stage: 'block', title: '', name: 'The Kit',
  beats: ['ready', 'done'],
  objectives: { ready: 'Stop the walking man.', done: 'Done.' },
  setup: {
    ready(ctx) {
      const E = KIT_BED.eye, G = ctx.game;
      for (const h of [...G.world.hoods.list]) G.removeHood(h);
      G.corpses.length = 0; G.pending.length = 0;
      ctx.controller.setPose(E.x, E.z, E.yaw, E.pitch);
      ctx.player.weapons.equip('revolver');
      // (six live rounds each round of the contest)
      const W = ctx.player.weapons.get('revolver');
      if (W && W.chambers) { W.chambers.fill('live'); W.top = 0; }
      ctx.flags.man = spawnWalker(ctx);
    },
    done(ctx) {
      const E = KIT_BED.eye;
      ctx.controller.setPose(E.x, E.z, E.yaw, E.pitch);
      ctx.player.weapons.equip('revolver');
    },
  },
  *script(ctx) {
    const G = ctx.game, F = ctx.flags, hud = ctx.hud;
    if (ctx.at('ready')) {
      yield beat('ready');
      // (the director has an encounter on: the health shows, the lull is off)
      G.director.run(function* (d) { yield d.until(() => !F.man || !F.man.alive || F.arrived); });
      // the teach cards: once per save; once more after two fails here
      const again = G.fails('ready') >= 2 && !F.againShown;
      hud.teach('fire', '[LMB] fire');
      hud.teach('steady', '[RMB] steady the aim', { until: 'Mouse2' });
      if (again) { F.againShown = true; hud.teach.again('steady'); }
      const man = F.man;
      yield until(() => {
        if (!man.alive) return true;
        const d = Math.hypot(man.pos.x - KIT_BED.goal.x, man.pos.z - KIT_BED.goal.z);
        hud.warn(d < KIT_BED.near ? 'He’s getting close.' : null);
        if (F.arrived) return true;
        return false;
      });
      hud.warn(null);
      if (F.arrived && man.alive) {
        G.fail({ why: 'He reached you.', to: 'ready' });
        return;
      }
      G.kitWins = (G.kitWins || 0) + 1;
      yield wait(1.4);
      G.director.stop();
    }
    yield beat('done');
    yield wait(2.4);
    // (the round again: a fresh man, the counts kept)
    G.scenes.go('kit', { beat: 'ready', fade: 'black', card: false, fadeIn: 0.6 });
  },
});

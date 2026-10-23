import { People } from './People.js';

// [O3] The people of the city (lane O3): installed by the free roam
// (src/scenes/city.js), one per game while the city is the stage.
//   installPeople(ctx)   (in the city scene's script: makes game.people if
//                         needed and steps it with the scene)
//   peopleOf(game)       game.people or null
// game.people (People.js): the crowd, the witnesses, the gangs, the player's
// stand-in hands; game.police (src/police/Police.js): the heat and the
// answer; game.crime (src/police/crime.js): the bus every lane tells.
// Shot mode (the golden frames) has no people unless the URL says &people=1.
export function peopleOf(G) { return G.people || null; }

export function installPeople(ctx) {
  const G = ctx.game;
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
  if (G.shotMode && !(q && q.get('people'))) return null;
  if (q && q.get('people') === '0') return null;
  if (G.people && G.people.stage !== ctx.stage) { G.people.dispose(); G.people = null; }
  if (!G.people) G.people = new People(G, ctx.stage);
  const P = G.people;
  ctx.onStep((dt) => P.step(dt));
  // (the frames' tableaux: fixed people for a golden frame / look development)
  const st = q && q.get('o3stage');
  if (st && G.shotMode) P.stageShot(st);
  // (the frame-rate scenario: ?o3heat=n raises the heat as the roam begins, shot mode only)
  const oh = q && +q.get('o3heat');
  if (oh && G.shotMode) P.police.raise(oh, G.eye, 'staged');
  return P;
}

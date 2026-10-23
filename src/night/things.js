// [O7] The seams of docs/THINGS_TO_DO.md, for every lane's thing to do (a
// bout, a race, a fare, a hideout, the bounty, the reel): one way to be taken
// up and put down, so the line, the marks, the money, the news and the night's
// record are the same for all of them.
//   game.things.start(id, { line, at })   taken up: the objective line (under
//       the heat's: night.take), the mark on the minimap and the map (at:
//       { x, z } or a function giving one, e.g. a fare's kerb, a moving car)
//   game.things.line(id, text)             the line changed (a lap, the place)
//   game.things.end(id, { result, money, news, weight, where })   put down:
//       the line and the mark gone; money (+ paid, - lost) through O4's
//       wallet (the HUD counts it in); news.say(news, weight, where) (O1b's
//       paper); the night's record save.flags.night[id] = { result, hour }
//       (a cleared hideout stays cleared: things.done(id))
//   game.things.active (Map id -> opts)    game.things.done(id) -> record | null
//   game.money.add(n, why)   game.money.take(n, why) -> bool   game.money.n
// Nothing here lists a thing or says go: a thing is only ever started by its
// own place, when the player walks up to it.
import { earn, pay } from '../combat/money.js';
import { newsOf } from '../world/items.js';

export function installThings(night) {
  const G = night.game;
  const active = new Map();
  const T = {
    active,
    start(id, opts = {}) {
      active.set(id, opts);
      if (opts.line) night.take(id, opts.line);
      G.emit('things:start', { id, opts });
      return id;
    },
    line(id, text) { const o = active.get(id); if (!o) return; o.line = text; night.take(id, text || null); },
    end(id, r = {}) {
      const o = active.get(id);
      active.delete(id);
      night.take(id, null);
      if (r.money > 0) earn(G, r.money, id);
      else if (r.money < 0) pay(G, -r.money, id);
      if (r.news) newsOf(G).say(r.news, r.weight || 1, r.where || null);
      const F = G.save.flags, N = F.night || (F.night = {});
      N[id] = { result: r.result || 'done', hour: Math.round(night.clock.min) };
      G.emit('things:end', { id, result: r.result || 'done', opts: o || null });
      return N[id];
    },
    done(id) { const N = G.save.flags.night; return (N && N[id]) || null; },
  };
  G.things = T;
  // (the mark: night.target is the last thing taken up with a place - the minimap's ring, the map's)
  G.money = {
    get n() { return G.save.money; },
    add: (n, why = '') => earn(G, n, why),
    take: (n, why = '') => pay(G, n, why),
  };
  // (a new night: nothing is taken up)
  G.on('night:start', () => { for (const id of [...active.keys()]) night.take(id, null); active.clear(); });
  return T;
}

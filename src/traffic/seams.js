import { earn, pay as takeMoney, money as moneyOf } from '../combat/money.js';

// The seams the wheels (lane O2) read of other lanes, now that they are in the city:
//
// crime: O3's bus (src/police/crime.js, game.crime: emit(kind, point, by, opts) -
// its own witnesses judge who saw it). Off the city's stage (a bed without the
// people) a stand-in with the same signature that logs it and emits the game
// event 'crime' - nothing more.
//
// money: O4's wallet (src/combat/money.js, save.money; O7's HUD counts it in):
//   money(G)   pay(G, n, why) - money to the player   spend(G, n) -> bool - his, spent
export function crimeOf(G) {
  if (G.crime && G.crime.emit) return G.crime;
  if (G._o2crime) return G._o2crime;
  const C = {
    log: [],
    emit(kind, point, by = 'player', opts = {}) {
      const e = { kind, x: point ? +point.x.toFixed(1) : 0, z: point ? +point.z.toFixed(1) : 0, by, level: opts.level ?? 1, seen: null, t: +(G.time || 0).toFixed(1) };
      C.log.push(e);
      if (C.log.length > 60) C.log.shift();
      G.emit('crime', e);
      return e;
    },
  };
  G._o2crime = C;
  return C;
}
export const money = (G) => moneyOf(G);
export function pay(G, n, why = '') { return n > 0 ? earn(G, n, why) : money(G); }
export function spend(G, n, why = '') { return takeMoney(G, n, why); }

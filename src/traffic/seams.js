// Seams other lanes replace (lane O2), each a function of mine with the base's
// behaviour until theirs lands (named in docs/reports/O2.md "For other lanes").
//
// crime (O3's police reads it): game.crime.emit(kind, point, info) - a crime
// done at a point: 'hijack' (a car taken: info.seen, info.by), 'cop' (a cop's
// car taken: he calls it in). Until O3 merges: logged (game.crime.log) and the
// game event 'crime' { kind, point, seen } emitted - nothing more.
//
// money (O4 names save.money; O7 draws it): money(G) / pay(G, n) / spend(G, n)
// on save.money (Save.js: [O2] a getter on save.flags.money until O4's lands).
export function crimeOf(G) {
  if (G.crime && G.crime.emit) return G.crime;
  const C = {
    log: [],
    emit(kind, point, info = {}) {
      const e = { kind, point: point ? { x: +point.x.toFixed(1), z: +point.z.toFixed(1) } : null, seen: !!info.seen, by: info.by || null, t: +(G.time || 0).toFixed(1) };
      C.log.push(e);
      if (C.log.length > 60) C.log.shift();
      G.emit('crime', e);
      return e;
    },
  };
  G.crime = C;
  return C;
}
export function money(G) { return (G.save && G.save.money) || 0; }
export function pay(G, n, why = null) {
  if (!G.save || !n) return money(G);
  G.save.money = Math.max(0, (G.save.money || 0) + n);
  if (G.hud && n > 0) G.hud.message(`$${n}${why ? '  ' + why : ''}`, 2.2);
  G.emit('money', { n, total: G.save.money, why });
  return G.save.money;
}
export function spend(G, n) {
  if (money(G) < n) return false;
  G.save.money -= n;
  G.emit('money', { n: -n, total: G.save.money });
  return true;
}

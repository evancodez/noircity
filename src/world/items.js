import { vhash } from './streets.js';

// NOIR CITY: the things a man picks up with E (lane O1b, brief §3). Placed by
// rule (world/dressing.js C.itemSpots: a roll of cash in an alley's end or by
// a yard's drums, a box of rounds behind the crates at a loading door, a
// bottle on a stoop, a matchbook on every bar's step, a paper at every
// newsstand), dropped where a man fell (his gun: items.drop), found in a car
// I take (items.glovebox), and put back over time where nobody is looking.
// The take is on the press, 0.2 s of the thing flying to the hand, and never
// holds my feet (parts/items.js draws them and reads E).
//   KINDS[kind]: { prompt, take(G, item) -> the line said (its count seen) }
//   news: the city's own news of what I did last: news.say(line) (the police
//   system's events - O3 - and the night's; until they come, three lines of
//   the night), news.latest() -> the headline a paper carries.
// Seams for the other lanes: save.money a plain number (O4's money.js
// replaces the adding); the rounds into the revolver's pocket as the base
// keeps it (src/player/weapons/revolver.js); a gun picked up is the base's
// weapon kinds (weapons.equip); a bottle is counted (save.flags.bottles) for
// the crowd brawl (O4); the matchbooks a collection (save.flags.matchbooks:
// { id: name }) for the pause card (O7).
export const RESPAWN = 300;          // (s) a taken thing is back after this, unless it is in view

export function money(G, n) {
  const S = G.save;
  S.money = (S.money || 0) + n;
  G.emit('money', { money: S.money, delta: n, why: 'found' });
  return S.money;
}
// the rounds: into the revolver's pocket (counted from the first box in the
// city: the city's pocket is never endless), and the coat's count if lane O4's is there
export function rounds(G, n) {
  const W = G.player && G.player.weapons && G.player.weapons.get('revolver');
  if (W) { if (!isFinite(W.pocket)) W.pocket = 0; W.pocket += n; if (W.keep) W.keep(); }
  const A = G.save.ammo;
  if (A && typeof A === 'object' && typeof A.revolver === 'number') A.revolver += n;
  return W ? W.pocket : n;
}

export const KINDS = {
  cash: {
    prompt: 'take', sound: 'c5_envelope',
    take(G, it) { const n = 5 + Math.floor(vhash(it.x, it.z, it.n || 0) * 40); const total = money(G, n); return `$${n}  -  $${total}`; },
  },
  rounds: {
    prompt: 'take', sound: 'revRound',
    take(G) { const p = rounds(G, 12); return `12 rounds  -  ${p} in the pocket`; },
  },
  weapon: {
    prompt: 'take', sound: 'revDraw',
    take(G, it) {
      const kind = it.gun || 'revolver';
      const S = G.save;
      if (!S.inventory.includes(kind)) S.inventory.push(kind);
      const Ws = G.player.weapons;
      if (Ws && Ws.get(kind)) { Ws.equip(kind); if (G.setViewmodelVisible) G.setViewmodelVisible(true); }
      if (kind === 'revolver') rounds(G, 6);
      return kind === 'tommy' ? 'his Tommy gun' : 'his revolver  -  6 rounds';
    },
  },
  bottle: {
    prompt: 'take', sound: 'casingTick',
    take(G) { const F = G.save.flags; F.bottles = (F.bottles || 0) + 1; return F.bottles > 1 ? `a bottle  -  ${F.bottles}` : 'a bottle'; },
  },
  matchbook: {
    prompt: 'take', sound: 'paperTouch',
    take(G, it) {
      const F = G.save.flags, M = F.matchbooks || (F.matchbooks = {});
      M[it.place] = it.name;
      return `${it.name}  -  matchbook ${Object.keys(M).length} of ${it.of || 6}`;
    },
  },
  paper: {
    prompt: 'take a paper', sound: 'kit_paper', stays: true,
    take(G) { const N = newsOf(G); N.read = (N.read || 0) + 1; return null; },
  },
};

// ---- the news ---------------------------------------------------------------------------------
const NIGHT = ['RAIN TO LAST THE NIGHT', 'DOCK STRIKE IN ITS SECOND WEEK', 'MAYOR VOWS TO CLEAN UP THE BOWERY'];
export function newsOf(G) {
  if (G.news) return G.news;
  const N = G.news = {
    lines: [],
    // a line of what happened (the police's events, the city's): the newest is the headline
    say(line, where = null) {
      if (!line) return;
      const L = String(line).toUpperCase().slice(0, 48);
      if (this.lines.length && this.lines[this.lines.length - 1].line === L) return;
      this.lines.push({ line: L, where, t: G.time || 0 });
      if (this.lines.length > 20) this.lines.shift();
      G.emit('news', { line: L, where });
    },
    latest() { return this.lines.length ? this.lines[this.lines.length - 1].line : NIGHT[Math.floor((G.time || 0) / 240) % NIGHT.length]; },
    night: NIGHT,
  };
  return N;
}

import { vhash } from './streets.js';
import { wallet, owns, give, arms } from '../combat/money.js';

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
// Seams for the other lanes: save.money and save.ammo are lane O4's
// (combat/money.js wallet: the rounds into the coat's count, and into the
// revolver's pocket when it is in hand); a gun picked up is O4's give + arms;
// a bottle is counted (save.flags.bottles) and offered in a fist fight
// (coatBottle, read by O4's Crowd.start); the matchbooks a collection
// (save.flags.matchbooks: { id: name }) for the pause card (O7); what I carry
// is pockets(G) (the Tab card until O7's HUD).
export const RESPAWN = 300;          // (s) a taken bottle is back after this, unless it is in view
// [O1b] after the critic (the cheat: a roll of cash came back where nobody
// looked, so one alley was a bank): money and rounds are found once a save -
// a taken spot is kept in save.flags.o1bTaken and never laid again; a bottle
// (junk in a doorway) comes back, a matchbook is a collection (once each)
export const ONCE = { cash: true, rounds: true, matchbook: true };
export const spotKey = (it) => `${it.kind}:${Math.round(it.x * 2)},${Math.round(it.z * 2)}`;

export function money(G, n) {
  const S = wallet(G);
  S.money += n;
  G.emit('money', { money: S.money, delta: n, why: 'found' });
  return S.money;
}
// the rounds (lane O4's coat: save.ammo.revolver, counted): into the coat's
// count always; into the revolver's pocket too when it is the gun in my hand
// (O4's arms.to keeps the two the same as the gun goes in and out). The line
// says the truth: a coat's count when I own the revolver, 'no gun' when I do not.
export function rounds(G, n) {
  const A = wallet(G).ammo;
  A.revolver = (A.revolver || 0) + n;
  const Ws = G.player && G.player.weapons;
  const W = Ws && Ws.current === 'revolver' ? Ws.get('revolver') : null;
  if (W) { if (!isFinite(W.pocket)) W.pocket = 0; W.pocket += n; if (W.keep) W.keep(); A.revolver = W.pocket; }
  return A.revolver;
}
export const roundsLine = (G, n, total) => (owns(G, 'revolver') ? `${n} rounds  -  ${total} in the coat` : `${n} .38 rounds  -  no gun for them yet`);
// what is in my pockets (the Tab card, parts/items.js): [[label, value]]
export function pockets(G) {
  const S = wallet(G), F = S.flags || {}, A = S.ammo || {};
  const out = [['$', String(S.money)]];
  if (A.revolver) out.push(['.38 rounds', String(A.revolver) + (owns(G, 'revolver') ? '' : '  (no gun)')]);
  if (A.shotgun) out.push(['shells', String(A.shotgun)]);
  if (A.tommy) out.push(['drums', String(A.tommy)]);
  if (F.bottles) out.push(['bottles', String(F.bottles)]);
  const M = F.matchbooks ? Object.keys(F.matchbooks).length : 0;
  if (M) out.push(['matchbooks', `${M} of 6`]);
  return out;
}
// [O1b] a bottle in the coat is one of the things in reach of a fist fight
// (lane O4's Crowd: the room's bottles and chairs - E takes it out, it is
// swung once and breaks on him); one less in the coat when it is taken out
export function coatBottle(G, makeObject) {
  const F = G.save.flags;
  const pos = { x: 0, y: 0, z: 0 };
  const it = {
    kind: 'bottle', name: 'coat', coat: true,
    get pos() { const e = G.eye, y = G.controller ? G.controller.yaw : 0; pos.x = e.x - Math.sin(y) * 0.45; pos.y = e.y - 0.55; pos.z = e.z - Math.cos(y) * 0.45; return pos; },
    available: () => (F.bottles || 0) > 0,
    take: () => { if (!(F.bottles > 0)) return null; F.bottles -= 1; return makeObject(); },
  };
  return it;
}

export const KINDS = {
  cash: {
    prompt: 'take', sound: 'c5_envelope',
    take(G, it) { const n = 5 + Math.floor(vhash(it.x, it.z, it.n || 0) * 40); const total = money(G, n); return `$${n}  -  $${total}`; },
  },
  rounds: {
    prompt: 'take', sound: 'revRound',
    take(G) { return roundsLine(G, 12, rounds(G, 12)); },
  },
  weapon: {
    prompt: 'take', sound: 'revDraw',
    take(G, it) {
      const kind = it.gun || 'revolver';
      give(G, kind);
      const Ws = G.player.weapons;
      if (Ws && Ws.get(kind)) { arms(G).to(kind); if (G.setViewmodelVisible) G.setViewmodelVisible(true); }
      if (kind === 'revolver') { const n = rounds(G, 6); return `his revolver  -  ${n} rounds in the coat`; }
      return 'his Tommy gun';
    },
  },
  bottle: {
    prompt: 'take', sound: 'casingTick',
    take(G) { const F = G.save.flags; F.bottles = (F.bottles || 0) + 1; return F.bottles > 1 ? `a bottle for a fight  -  ${F.bottles} in the coat` : 'a bottle  -  for the next fight'; },
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
    // a line of what happened (the police's events, the activities', the
    // city's): THINGS_TO_DO §10 - the worst thing of the last ten minutes is
    // the headline (weight: a death 3, a car burning 2, shots or a wild car
    // 1), ties the newest; nothing: the night's own line
    say(line, weight = 1, where = null) {
      if (!line) return;
      if (weight && typeof weight === 'object') { where = weight; weight = 1; }
      const L = String(line).toUpperCase().slice(0, 48);
      if (this.lines.length && this.lines[this.lines.length - 1].line === L) return;
      this.lines.push({ line: L, weight, where, t: G.time || 0 });
      if (this.lines.length > 20) this.lines.shift();
      G.emit('news', { line: L, weight, where });
    },
    latest() {
      const now = G.time || 0;
      let best = null;
      for (const l of this.lines) if (now - l.t < 600 && (!best || l.weight >= best.weight)) best = l;
      return best ? best.line : NIGHT[Math.floor(now / 240) % NIGHT.length];
    },
    night: NIGHT,
  };
  return N;
}

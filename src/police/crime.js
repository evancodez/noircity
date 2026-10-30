// [O3] The crime bus (lane O3, NOIR CITY): every lane says what the player
// did, where, and the city answers. A crime unseen is nothing; a crime seen
// raises the heat - at once when a cop sees it (a cop in line of sight within
// 40 m), later when a civilian who saw it (within 25 m, in line of sight)
// reaches a call box or a cop in sight and tells it. The crowd reacts to
// what it sees whatever the police make of it (a gun out: they run; a shot:
// they scatter; a fight: they back off in a ring; a body: they gather).
//
//   game.crime.emit(kind, point, by = 'player', opts)  -> the crime's record
//     kind   'punch' 1 | 'hijack' 1 | 'smash' 1 (what is someone's) | 'vandal' 1 ([O1c] a bin,
//            a board, a crate knocked over by my fist) | 'shot' 2 |
//            'assault' 2 (a cop knocked down with fists) | 'death' 3 |
//            'cophurt' 4 (a cop shot or run down) | 'menace' 0 (a gun drawn:
//            no heat, but the street runs) | 'wreck' 0 | 'body' 0
//     point  { x, z } (or a Vector3): where it happened
//     by     'player' (only the player's crimes are the police's), or who
//     opts   { victim, quiet, level }: victim (a Person of src/people: he is
//            no witness of his own), level (override)
//   game.crime.on(fn)   every emit, after the city has been told
//   game.crime.log      the last 40 records (the plays read them)
// A record: { id, kind, level, x, z, t, by, seen: 'cop' | 'civ' | null,
// reporters: n, reported: bool }.
export const LEVEL = { punch: 1, hijack: 1, smash: 1, vandal: 1 /* [O1c] a thing of the street knocked over by my fist */, shot: 2, assault: 2, death: 3, cophurt: 4, menace: 0, wreck: 0, body: 0 };
// how far a witness sees (m): a cop, a civilian (the brief's numbers)
export const SEE = { cop: 40, civ: 25 };

export class Crime {
  constructor(people) {
    this.P = people;
    this.log = [];
    this.fns = [];
    this.n = 0;
  }
  on(fn) { this.fns.push(fn); return fn; }
  off(fn) { const i = this.fns.indexOf(fn); if (i >= 0) this.fns.splice(i, 1); }

  emit(kind, point, by = 'player', opts = {}) {
    const P = this.P, G = P.G;
    const x = point ? point.x : G.eye.x, z = point ? point.z : G.eye.z;
    const level = opts.level ?? LEVEL[kind] ?? 1;
    // (the same crime told twice - O4's gun and this lane's own listener on
    // the shot - within 0.3 s and 3 m is one)
    const last = this.log[this.log.length - 1];
    if (last && last.kind === kind && G.time - last.t < 0.3 && Math.hypot(last.x - x, last.z - z) < 3) return last;
    const rec = { id: ++this.n, kind, level, x, z, t: G.time, by, seen: null, reporters: 0, reported: false, victim: opts.victim || null };
    this.log.push(rec);
    if (this.log.length > 40) this.log.shift();
    // the street sees it first (the crowd's reactions, the witnesses), then the police
    P.witness(rec, opts);
    for (const fn of this.fns) fn(rec);
    G.emit('crime', rec);
    return rec;
  }
}

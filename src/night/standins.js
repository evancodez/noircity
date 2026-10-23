// The seams the night reads from lanes not merged yet (lane O7's first pass,
// docs/seams/NIGHT.md §6). Each is a tiny module that gives the seam's shape
// so the HUD can be played; each is installed ONLY when the real one is
// absent (game.police and game.crime from O3), and is
// dropped at O7's fix pass when the real one has merged into main.
//   police (O3's seam):  game.police = { heat 0..5, searching, units: [],
//                          on('heat', fn), set(level), lost(), stand: true }
//                        'heat' fires { heat, was, searching } on every change
//   crime (O3's seam):   game.crime.emit(kind, point, by): raises the heat to
//                        the brief's level for the crime (punch 1, hijack 1,
//                        shot 2, death 3, cop 4); unseen time lets it fall
//                        (the search, then a badge less)
//   news: O1b's, merged (world/items.js newsOf(G): say(line, weight, where), latest())
// The money (save.money), the matchbooks (save.matchbooks) and the garage
// (save.garage) are the save's own fields (src/game/Save.js): no stand-in.
// The debug bed (?nightbed=1, never in a normal run): 1..5 set the heat, 0
// clears it, 9 toggles the search, 8 gives $50, 7 a matchbook - keys read
// through the game's own input edges, so a pad or a play reaches them alike.
import { newsOf } from '../world/items.js';

export const CRIME = { punch: 1, hijack: 1, shot: 2, death: 3, cop: 4 };
// the stand-in's fall: unseen this long, the search; searching this long, a badge less
export const LOSE = { quiet: 14, search: 9 };

export function installStandins(night) {
  const G = night.game;
  const made = [];
  if (!G.police) {
    const L = new Map();
    G.police = {
      stand: true, heat: 0, searching: false, units: [], quiet: 0,
      on(name, fn) { if (!L.has(name)) L.set(name, []); L.get(name).push(fn); return fn; },
      off(name, fn) { const a = L.get(name); if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } },
      emit(name, e) { const a = L.get(name); if (a) for (const f of [...a]) f(e); },
      set(level, { searching = false } = {}) {
        const was = this.heat, ws = this.searching;
        this.heat = Math.max(0, Math.min(5, level | 0));
        this.searching = this.heat > 0 && !!searching;
        this.quiet = 0;
        G.save.heat = this.heat;
        if (was !== this.heat || ws !== this.searching) this.emit('heat', { heat: this.heat, was, searching: this.searching });
      },
      // (O5's door: an interior shakes them off)
      lost() { if (this.heat > 0) this.set(0); },
      step(dt) {
        if (this.heat <= 0) return;
        this.quiet += dt;
        if (!this.searching && this.quiet > LOSE.quiet) { this.searching = true; this.quiet = 0; this.emit('heat', { heat: this.heat, was: this.heat, searching: true }); }
        else if (this.searching && this.quiet > LOSE.search) { const h = this.heat - 1; this.set(h, { searching: h > 0 }); }
      },
    };
    made.push('police');
  }
  if (!G.crime) {
    G.crime = {
      stand: true,
      emit(kind, point = null, by = 'me') {
        const P = G.police;
        if (!P || !P.set || by !== 'me') return;
        P.set(Math.max(P.heat, CRIME[kind] || 1));
        void point;
      },
    };
    made.push('crime');
    // [O7] until O3's witnesses: a shot in the city is heard (heat 2, as the
    // brief's table has it), O4's crowd's crimes (a gun drawn in a fist fight,
    // a runner put down) the same - the city answers within the second, the
    // shields brushed in and 'Lose them.'; it falls by itself unseen (LOSE)
    G.on('shot', () => { if (night.inCity) G.crime.emit('shot', null, 'me'); });
    G.on('crime', (e) => { if (night.inCity && e && e.by === 'player') G.crime.emit(e.kind === 'draw' ? 'punch' : 'shot', e.at, 'me'); });
  }
  // (the news is O1b's now, in main: world/items.js newsOf - no stand-in)
  newsOf(G);
  return made;
}

// the stand-ins' step (the police's fall) and the debug bed's keys
export function stepStandins(night, dt) {
  const G = night.game, P = G.police;
  if (P && P.stand && P.step) P.step(dt);
  if (!night.bed) return;
  const pr = (c) => G.keysDown.has(c) || G.vin.down.has(c);
  if (P && P.set) {
    for (let i = 0; i <= 5; i++) if (pr('Digit' + i)) P.set(i);
    if (pr('Digit9') && P.heat > 0) P.set(P.heat, { searching: !P.searching });
  }
  if (pr('Digit8')) G.save.money += 50;
  if (pr('Digit7')) {
    // (one of O1b's six, as if taken off its bar's step)
    const C = G.stage && G.stage.part && G.stage.part('city') ? G.stage.part('city').C : null;
    const F = G.save.flags.matchbooks || (G.save.flags.matchbooks = {});
    const sp = ((C && C.itemSpots) || []).find((q) => q.kind === 'matchbook' && !F[q.place]);
    if (sp) { F[sp.place] = sp.name; G.emit('matchbook', { id: sp.place }); }
  }
}

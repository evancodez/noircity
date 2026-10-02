// The order of the story (wave C, docs/story/WAVE_C.md §4; the kit's
// contract is docs/story/seams/Z.md). No default export: not a scene.
// scenes.next() / ctx.next() go to the next id here that has a scene file;
// past the last one, the "to be continued" card. A scene's chapter card takes
// its numeral and title from here unless the scene gives its own
// (defineScene title / name). The Body (`body`) is cut: its file is parked as
// src/scenes/_body_cut.js (the manager skips files that start with `_`).
//
// Each chapter also carries the defaults a scene file may override in its own
// defineScene (seams/Z.md §5, §6):
//   objective   the stand-in objective line for a scene that sets none of its
//               own (hud.objective), shown from its first second
//   music       its music slot: 'slot' | { slot, fade } | null (silence) |
//               { stop: fade } | 'room' (the scene's own diegetic music: the
//               manager leaves it alone); undefined: the manager leaves it
//   beatMusic   { beat: same } a beat that overrides it, applied when that
//               beat begins and when the scene is entered at it
//   carry       what the detective carries by the start of the chapter
//               (WAVE_C §4): added to save.inventory when the scene is entered
//               (a chapter picked, a ?start=, a CONTINUE, a jump)
//   flags       story flags by then (added where not already set)
const ARMED = ['matchbook', 'amesCard', 'check', 'revolver'];
const NOTE = { note: 'PIER 9' };
export const ORDER = [
  { id: 'diner', numeral: 'I', title: 'The Diner', music: 'room', carry: [] },
  { id: 'fight', numeral: 'II', title: 'The Fight', objective: 'Put the big man down.', music: 'room', carry: [] },
  { id: 'office', numeral: 'III', title: 'Room 304', objective: 'Find Ames. Room 304.', music: { slot: 'office', fade: 2.5 }, carry: ['matchbook', 'amesCard'] },
  { id: 'gunfight', numeral: 'IV', title: 'The Door', objective: 'Stay alive.', music: { stop: 2.5 }, carry: ARMED, flags: NOTE },
  { id: 'watcher', numeral: 'V', title: 'The Watcher', objective: 'Catch him before the pier.', music: null,
    beatMusic: { escape: { slot: 'chase', fade: 0.4 }, run: { slot: 'chase', fade: 0.4 }, car: { slot: 'chase', fade: 0.4 } }, carry: ARMED, flags: NOTE },
  { id: 'tail', numeral: 'VI', title: 'The Tail', objective: 'Stay on his tail lamps.', music: { slot: 'tail', fade: 2.5 }, carry: ARMED, flags: NOTE },
  { id: 'warehouse', numeral: 'VII', title: 'Pier Nine', objective: 'Quietly. The lit office.', music: { slot: 'warehouse', fade: 1.5 },
    beatMusic: { fight: { slot: 'fight', fade: 2.5 }, ko: { slot: 'fight', fade: 2.5 }, after: { stop: 3 } }, carry: ARMED, flags: NOTE },
  { id: 'shootout', numeral: 'VIII', title: 'The Block', objective: 'Get to Dot.', music: null,
    beatMusic: { cars: { slot: 'shootout', fade: 2.5 }, doorways: { slot: 'shootout', fade: 2.5 }, el: { slot: 'shootout', fade: 2.5 }, driveby: { slot: 'shootout', fade: 2.5 } },
    carry: [...ARMED, 'shells'], flags: NOTE },
];

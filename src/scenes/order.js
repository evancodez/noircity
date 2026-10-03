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
//   objectives  { beat: line | null } the stand-in objective line of every
//               beat (hud.objective), from WAVE_C §4 and what each beat of
//               the wave B scene asks of the player today; null: no line in
//               that beat (better nothing than a wrong goal). A stand-in is
//               taken down when a beat begins that has none here. A scene
//               file that declares its own `objective` or `objectives` takes
//               over the chapter's lines whole: none of these apply then.
//   objective   (optional) one line for every beat that has none above
//   music       its music slot: 'slot' | { slot, fade } | null (silence) |
//               { stop: fade } | 'room' (the scene's own diegetic music: the
//               manager leaves it alone); undefined: entered from another
//               scene, the music stops (a retry changes nothing)
//   beatMusic   { beat: same } a beat that overrides it, applied when that
//               beat begins and when the scene is entered at it
//   carry       what the detective carries by the start of the chapter
//               (WAVE_C §4): added to save.inventory when the scene is entered
//               (a chapter picked, a ?start=, a CONTINUE, a jump)
//   flags       story flags by then (added where not already set)
const ARMED = ['matchbook', 'amesCard', 'check', 'revolver'];
const NOTE = { note: 'PIER 9' };
// (the same line for a run of beats)
const each = (beats, line) => Object.fromEntries(beats.map((b) => [b, line]));
export const ORDER = [
  // I: the scene file declares its own lines (01_diner.js)
  { id: 'diner', numeral: 'I', title: 'The Diner', music: 'room', carry: [] },
  // [C4] II: the scene file declares its own lines (02_fight.js)
  { id: 'fight', numeral: 'II', title: 'The Fight', music: 'room', carry: [] },
  // [C5] III and IV: the scene files declare their own lines (04_office.js, 05_gunfight.js)
  { id: 'office', numeral: 'III', title: 'Room 304', music: { slot: 'office', fade: 2.5 }, carry: ['matchbook', 'amesCard'] },
  { id: 'gunfight', numeral: 'IV', title: 'The Door', music: { stop: 2.5 }, carry: ARMED, flags: NOTE },
  // [C6] V: the scene file declares its own lines and music (06_watcher.js:
  // the chase rebuilt, its beats its stretches; the wave B beats' stand-ins
  // went with it)
  { id: 'watcher', numeral: 'V', title: 'The Watcher', music: null, carry: ARMED, flags: NOTE },
  // [C3] VI: the scene file declares its own lines (07_tail.js: the city's
  // chase rebuilt; the wave B beats' stand-ins went with it)
  { id: 'tail', numeral: 'VI', title: 'The Tail', music: { slot: 'tail', fade: 2.5 }, carry: ARMED, flags: NOTE },
  // [C7] VII: the scene file declares its own lines (08_warehouse.js: three
  // passes of the shed, quiet, the office, loud, then the foreman)
  { id: 'warehouse', numeral: 'VII', title: 'Pier Nine', music: { slot: 'warehouse', fade: 1.5 },
    beatMusic: { fight: { slot: 'fight', fade: 2.5 }, ko: { slot: 'fight', fade: 2.5 }, after: { stop: 3 } }, carry: ARMED, flags: NOTE },
  { id: 'shootout', numeral: 'VIII', title: 'The Block', music: null,
    beatMusic: { cars: { slot: 'shootout', fade: 2.5 }, doorways: { slot: 'shootout', fade: 2.5 }, el: { slot: 'shootout', fade: 2.5 }, driveby: { slot: 'shootout', fade: 2.5 } },
    carry: [...ARMED, 'shells'], flags: NOTE,
    objectives: { arrive: 'Take the gun.', ...each(['cars', 'doorways', 'el', 'driveby'], 'Hold the diner.'), cardinal: 'Here he comes. Stop him.', end: null } },
];

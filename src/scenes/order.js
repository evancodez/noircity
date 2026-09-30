// The order of the story (wave B seams, docs/story/seams/X.md). No default
// export: not a scene. scenes.next() / ctx.next() go to the next id here
// that has a scene file (src/scenes/NN_<id>.js); past the last one, the
// "to be continued" card. A scene's chapter card takes its numeral and
// title from here unless the scene gives its own (defineScene title / name).
export const ORDER = [
  { id: 'diner', numeral: 'I', title: 'The Diner' },
  { id: 'fight', numeral: 'II', title: 'The Fight' },
  { id: 'body', numeral: 'III', title: 'The Body' },
  { id: 'office', numeral: 'IV', title: 'Room 304' },
  { id: 'gunfight', numeral: 'V', title: 'The Door' },
  { id: 'watcher', numeral: 'VI', title: 'The Watcher' },
  { id: 'tail', numeral: 'VII', title: 'The Tail' },
  { id: 'warehouse', numeral: 'VIII', title: 'Pier Nine' },
  { id: 'shootout', numeral: 'IX', title: 'The Block' },
];

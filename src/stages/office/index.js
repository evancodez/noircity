// The office (lane B2): the Harbor Building's third floor - room 304, the
// corridor before it, the fire escape outside its side window - and, three
// floors down through the blind, the street with the lamp the watcher
// stands under (scene 6 opens here). Its parts are ./parts/*.js; its
// numbers ./plan.js. It draws from root.fork(304): building it never
// touches the block's draws.
const mods = import.meta.glob('./parts/*.js', { eager: true });

export default {
  name: 'office',
  salt: 304,
  parts: Object.values(mods).map((m) => m.default),
  // (outside the rooms: the fire escape and the light well, the street's
  // own Look; the rooms add their interior Looks, parts/room.js)
  look: null,
};

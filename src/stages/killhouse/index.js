// The killhouse (lane C2): the gun kit's test bed - two rooms and a corridor
// behind a street front, a lobby, and a short piece of wet street with two
// parked cars (./plan.js has the numbers). Not a place of the story: the
// scene `guns` (src/scenes/91_guns.js, ?start=guns) plays the kit's beats
// here. It draws from root.fork(9191): building it never touches the
// block's draws.
const mods = import.meta.glob('./parts/*.js', { eager: true });

export default {
  name: 'killhouse',
  salt: 9191,
  parts: Object.values(mods).map((m) => m.default),
  look: null,
};

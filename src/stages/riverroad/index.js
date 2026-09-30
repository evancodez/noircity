// The river road (scene 7, The Tail; lane B5): 1.3 km of wet road under
// and beside the el, the river on the right behind its railing, the
// warehouses and a market on the left. Its line is ./road.js; its content
// the parts (./parts/*.js, found on their own), built in their `order`.
// It draws from root.fork(salt): building it never disturbs the block.
const mods = import.meta.glob('./parts/*.js', { eager: true });

export default {
  name: 'riverroad',
  salt: 7007,
  parts: Object.values(mods).map((m) => m.default),
  // outside, in the rain (the car's cabin is a room of its own: the
  // vehicles give its look volume)
  look: { room: 'street' },
};

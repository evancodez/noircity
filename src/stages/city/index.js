// The city (lane C3, chapter VI The Tail): a district at night in the rain,
// six streets by five, the el down the avenue and along the river, the
// docks with Pier 9 at the river road's end (./plan.js has the numbers).
// Its content is its parts (./parts/*.js, found on their own), built in
// their `order`. It draws from root.fork(salt): building it never disturbs
// the block's draws (the golden frames).
const mods = import.meta.glob('./parts/*.js', { eager: true });

export default {
  name: 'city',
  salt: 3303,
  parts: Object.values(mods).map((m) => m.default),
  // outside, in the rain (the car's cabin is a room of its own: the
  // vehicles give its look volume)
  look: { room: 'street' },
};

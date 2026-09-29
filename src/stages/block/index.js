// The block (docs/story/CONTRACTS.md §2.3): the avenue under the el, the
// near stone building (the diner's), the parked cars, the lamps, the city
// behind. Its content is its parts (./parts/*.js, found on their own), built
// in their `order`: today's build order, so the ink ids, the RNG draws and
// the scene graph are what every golden frame was printed with. A new part
// takes an order after the last (or between two, if it allocates no ink
// ids and draws no RNG from a shared fork).
const mods = import.meta.glob('./parts/*.js', { eager: true });

export default {
  name: 'block',
  parts: Object.values(mods).map((m) => m.default),
  // (the exterior Look is today's frame: world/World.js BASE_LOOK)
  look: null,
};

// Part update ticks (a part's `update(api, dt, t, camera, pixelHeight)` runs
// every step in `tick` order, default its build order): sky 10, overpass 20,
// cars 30, lamps 40, rain 50 - the old World.update's order.

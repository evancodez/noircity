import { Cars, sedanTemplates } from '../../../world/Cars.js';

// The city's `cars` (what fx/React and the sound ask every stage for): the
// block's Cars, empty - src/vehicles spawns the moving sedans through it (a
// round cracks the glass, breaks a lens, flattens a tyre). The parked cars,
// the traffic and the hijack are lane O2's: the bays are the generator's
// (stage.part('city').C.bays, graph.baysNear).
//   cars.parked: [body] (the track's bodies read it: O2 fills it)
export default {
  name: 'cars', order: 90, tick: 30,
  build(stage) {
    const C = Object.create(Cars.prototype);
    Object.assign(C, {
      world: stage, cars: [], fires: [], chains: [], game: null, parked: [],
      rng: stage.rng.fork(4447), limRng: stage.rng.fork(4450), kindRng: stage.rng.fork(4451), fxRng: stage.rng.fork(4452),
    }, sedanTemplates());
    stage.onShadowLod((on) => C.shadowLod(on));
    return C;
  },
  update: (C, dt) => { void C; void dt; },
};

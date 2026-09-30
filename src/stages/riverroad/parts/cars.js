import * as THREE from 'three';
import { Cars, sedanTemplate } from '../../../world/Cars.js';

// The river road's sedans as the block's Cars (world/Cars.js): no car is
// parked here; src/vehicles spawns the watcher's sedan (and the others that
// cross the road) through it, so a round into one cracks and shatters its
// glass, breaks a lens, flattens a tyre, marks the body (fx/React.js routes
// the bullets to stage.cars). Nothing here ever blows up (the limits are
// out of reach: the tail is not the shootout).
export default {
  name: 'cars', order: 90, tick: 30,
  build(stage) {
    const C = Object.create(Cars.prototype);
    Object.assign(C, {
      world: stage, cars: [], fires: [], chains: [], game: null,
      rng: stage.rng.fork(4447), limRng: stage.rng.fork(4450), kindRng: stage.rng.fork(4451), fxRng: stage.rng.fork(4452),
      T: sedanTemplate(false), TL: sedanTemplate(true),
    });
    stage.onShadowLod((on) => C.shadowLod(on));
    return C;
  },
  update: (cars, dt, t, camera) => cars.lodUpdate(camera),
};

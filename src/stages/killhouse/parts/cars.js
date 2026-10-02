import * as THREE from 'three';
import { Cars, sedanTemplates } from '../../../world/Cars.js';
import { CARS } from '../plan.js';

// The two sedans parked on the killhouse's street: the block's sedans
// (world/Cars.js: the same model, the same reactions to a round - glass that
// cracks and goes, a body that sparks, a tank that can go up). `cars` is
// also what fx/React.js and the sound ask every stage for. Their bodies are
// steel to the gun kit (a round stops in them), their glass breaks.
export default {
  name: 'cars', order: 70, tick: 30,
  build(stage) {
    const C = Object.create(Cars.prototype);
    Object.assign(C, {
      world: stage, cars: [], game: null, fires: [], chains: [],
      rng: stage.rng.fork(4447), limRng: stage.rng.fork(4450), kindRng: stage.rng.fork(4451), fxRng: stage.rng.fork(4452),
    }, sedanTemplates());
    for (const c of CARS) {
      const car = C.spawn({ pos: new THREE.Vector3(c.x, 0, c.z), yaw: c.yaw, lights: false, paint: c.paint });
      C.cars.push(car);
      car.group.traverse((o) => { if (o.isMesh) o.userData.cover = { kind: o.userData.part === 'glass' || o.userData.part === 'lens' ? 'glass' : 'steel' }; });
    }
    stage.onShadowLod((on) => C.shadowLod(on));
    return C;
  },
  update: (C, dt, t, camera) => C.lodUpdate(camera),
};

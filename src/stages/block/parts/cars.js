import { Cars } from '../../../world/Cars.js';

// the parked sedans (and their wrecks)
export default {
  name: 'cars', order: 70, tick: 30,
  build(stage) {
    const cars = new Cars(stage);
    stage.onShadowLod((on) => cars.shadowLod(on));
    return cars;
  },
  update: (cars, dt, t, camera) => cars.lodUpdate(camera),
};

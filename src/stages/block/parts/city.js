import { City } from '../../../world/City.js';

// the city behind the block: the roofscape, the bridge, the sky's life
// (lane 4's brief 4; world/City.js). After every accepted part: it draws
// only from its own forks and takes skyline ink ids after the towers'.
export default {
  name: 'city', order: 160, tick: 160,
  build: (stage) => new City(stage),
  update: (city, dt, t, camera) => city.update(dt, t, camera),
};

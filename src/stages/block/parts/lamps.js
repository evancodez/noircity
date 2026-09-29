import { Lamps } from '../../../world/Lamps.js';

// the streetlamps, the el's hanging lamps, the sconces, the pooled real
// SpotLights (stage.lamps.addCustom gives any part a lamp of its own)
export default {
  name: 'lamps', order: 50, tick: 40,
  build: (stage) => new Lamps(stage),
  update: (lamps, dt, t, camera) => lamps.update(dt, t, camera),
};

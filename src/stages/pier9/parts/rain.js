import { Rain } from '../../../world/Rain.js';

// the 3D rain that follows the eye (the shed's dry volume keeps it outside)
export default {
  name: 'rain', order: 110, tick: 50,
  build: (stage) => new Rain(stage, 14000, 500),
  update: (rain, dt, t, camera, pixelHeight) => rain.update(camera, pixelHeight),
};

import { Rain } from '../../../world/Rain.js';

// the 3D rain that follows the camera (the house is a dry volume: it never falls inside)
export default {
  name: 'rain', order: 110, tick: 50,
  build: (stage) => new Rain(stage),
  update: (rain, dt, t, camera, pixelHeight) => rain.update(camera, pixelHeight),
};

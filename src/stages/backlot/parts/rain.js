import { Rain } from '../../../world/Rain.js';

// the 3D rain that follows the camera (the Game drives its brightness)
export default {
  name: 'rain', order: 110, tick: 50,
  build: (stage) => new Rain(stage),
  update: (rain, dt, t, camera, pixelHeight) => rain.update(camera, pixelHeight),
};

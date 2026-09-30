import { Sky } from '../../../world/Sky.js';

// the sky dome that follows the camera (the strip of grey over the alleys)
export default {
  name: 'sky', order: 10, tick: 10,
  build: (stage) => new Sky(stage),
  update: (sky, dt, t, camera) => sky.update(camera),
};

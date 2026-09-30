import { Sky } from '../../../world/Sky.js';

// the storm sky, following the eye (the block's)
export default {
  name: 'sky', order: 10, tick: 10,
  build: (stage) => new Sky(stage),
  update: (sky, dt, t, camera) => sky.update(camera),
};

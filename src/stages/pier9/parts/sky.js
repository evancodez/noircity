import { Sky } from '../../../world/Sky.js';

// the storm sky over the river (the block's dome, following the eye)
export default {
  name: 'sky', order: 10, tick: 10,
  build: (stage) => new Sky(stage),
  update: (sky, dt, t, camera) => sky.update(camera),
};

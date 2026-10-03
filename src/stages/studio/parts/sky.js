import { Sky } from '../../../world/Sky.js';

// the night outside the window: the block's sky dome, following the eye
export default {
  name: 'sky', order: 10, tick: 10,
  build: (stage) => new Sky(stage),
  update: (s, dt, t, camera) => s.update(camera),
};

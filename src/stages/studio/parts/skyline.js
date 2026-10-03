import { Skyline } from '../../../world/Skyline.js';

// the towers far off through the window: the block's skyline, in its rows of fog
export default {
  name: 'skyline', order: 60,
  build: (stage) => new Skyline(stage),
};

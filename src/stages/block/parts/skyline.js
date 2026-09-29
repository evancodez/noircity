import { Skyline } from '../../../world/Skyline.js';

// the towers behind, in rows of fog
export default {
  name: 'skyline', order: 60,
  build: (stage) => new Skyline(stage),
};

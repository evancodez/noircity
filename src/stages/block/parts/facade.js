import { Facade } from '../../../world/Facade.js';

// the near stone building and the far blocks
export default {
  name: 'facade', order: 40,
  build: (stage) => new Facade(stage),
};

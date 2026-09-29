import { Train } from '../../../world/Train.js';

// the el train (driven by the Game: world/Train.js)
export default {
  name: 'train', order: 120,
  build: (stage) => new Train(stage),
};

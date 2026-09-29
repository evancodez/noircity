import { GroundMist } from '../../../fx/GroundMist.js';

// the lit ground mist at the far end of the avenue
export default {
  name: 'mist', order: 100,
  build: (stage) => new GroundMist(stage),
};

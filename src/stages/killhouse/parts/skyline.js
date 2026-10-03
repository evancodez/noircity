import { Skyline } from '../../../world/Skyline.js';

// the towers over the warehouse across the street, in rows of fog (the
// block's skyline, drawn from the killhouse's own salt)
export default {
  name: 'skyline', order: 60,
  build: (stage) => new Skyline(stage),
};

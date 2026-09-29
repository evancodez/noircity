import { Props } from '../../../world/Props.js';

// the street's furniture: booth, newsstand, hydrants, cans, grates, crates
export default {
  name: 'props', order: 80,
  build: (stage) => new Props(stage),
};

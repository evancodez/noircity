import { Steam } from '../../../fx/Steam.js';

// steam rising from the props' grates (it reads their vents)
export default {
  name: 'steam', order: 90,
  build: (stage) => new Steam(stage, stage.part('props').vents),
};

import { Overpass } from '../../../world/Overpass.js';

// the el: columns, arches, deck, railing, stations
export default {
  name: 'overpass', order: 30, tick: 20,
  build(stage) {
    const el = new Overpass(stage);
    // (the reflection and the shadow maps take its light builds)
    stage.onReflLod((on) => el.reflLod(on));
    stage.onShadowLod((on) => el.reflLod(on));
    return el;
  },
  update: (el, dt, t, camera) => el.update(camera),
};

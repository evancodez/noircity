import { Rain } from '../../../world/Rain.js';

// the rain outside the window: the block's 3D rain (the room is a dry
// volume: it never rains inside); no splash rings (the floor is a room's)
export default {
  name: 'rain', order: 110, tick: 50,
  build(stage) {
    const rain = new Rain(stage, 9000, 10);
    rain.splash.visible = false;
    return rain;
  },
  update: (rain, dt, t, camera, pixelHeight) => rain.update(camera, pixelHeight),
};

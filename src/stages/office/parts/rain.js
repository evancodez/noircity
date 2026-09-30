import { Rain } from '../../../world/Rain.js';
import { STREET } from '../plan.js';

// The rain outside: the block's 3D rain, its box lowered to fall past the
// windows from above the roofs to the street three floors down (the rooms
// are dry volumes: it never falls inside). The street's splash rings stay
// off: they lie on the block's street plane, which here is the office floor.
export default {
  name: 'rain', order: 110, tick: 50,
  build(stage) {
    const rain = new Rain(stage);
    rain.splash.visible = false;
    return rain;
  },
  update(rain, dt, t, camera, pixelHeight) {
    rain.update(camera, pixelHeight);
    // (the box is 16 m tall: from the street's height to a little above the roofs' line)
    rain.rainMat.uniforms.uBoxCenter.value.y = STREET.y + 8.5;
  },
};

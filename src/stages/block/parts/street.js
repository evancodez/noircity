import { Street } from '../../../world/Street.js';

// the wet avenue, the kerbs and the pavements (the block's walking surface
// and its outer collision net), and the block's first named places
export default {
  name: 'street', order: 20,
  build(stage) {
    const street = new Street(stage);
    stage.addSurface((x, z) => street.surfaceY(x, z));
    // where play has always begun, by the left kerb looking down the avenue
    stage.addAnchor('block.player.start', { pos: { x: -7.3, y: 0.15, z: 6.2 }, yaw: -0.2 });
    // the side alley's mouth off the cross street (CONTRACTS §15)
    stage.addAnchor('block.alley.mouth', { pos: { x: -14.0, y: 0.15, z: -27.0 }, yaw: Math.PI / 2, r: 3 });
    return street;
  },
};

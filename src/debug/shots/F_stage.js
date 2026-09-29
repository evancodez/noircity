// The foundation's presets. Every file in src/debug/shots/ is found on its
// own (debug/Shots.js): a lane keeps its presets in L<n>_*.js, exporting
// { presets: { name: { x, z, yaw, pitch, fov, t, stage?, ... } } }.
export const presets = {
  // where play begins off the title card: the block's player.start anchor,
  // by the left kerb looking down the avenue, at the play camera's lens
  start: {
    x: -7.3, z: 6.2, yaw: -0.2, pitch: 0.02, fov: 68, t: 2,
    stage(stage, camera, controller) {
      const a = stage.anchor('block.player.start');
      controller.setPose(a.pos.x, a.pos.z, a.yaw, 0.02);
    },
  },
};

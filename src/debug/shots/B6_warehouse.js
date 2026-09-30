// Lane B6's presets (scene 8, Pier Nine): the pier9 stage seen from a few
// places without the scene's cast (look development). The scene's own
// frames are ?scene=warehouse&beat=<beat>.
//   ?shot=p9&pose=x,z,yaw,pitch[,fov]   anywhere on the stage (pose= is the
//                                        camera: main.js applies it before
//                                        the stage function, which re-places it)
const at = (x, z, yaw, pitch, fov = 70, y = null) => ({
  t: 2, fov,
  stage(stage, camera, controller, game) {
    game.enterStage('pier9');
    const q = new URLSearchParams(location.search).get('pose');
    const [px, pz, pyaw, ppitch] = q ? q.split(',').map(Number) : [x, z, yaw, pitch];
    controller.setPose(px, pz, pyaw, ppitch, y);
  },
});

export const presets = {
  p9: at(-5.2, 20.5, 0.12, 0.04),
  p9door: at(-10.5, -1.0, 0.0, 0.02),
  p9floor: at(0, -3, 0, 0.05),
  p9office: at(0, -38, 0, 0.3, 60),
  p9bay: at(8.5, -30, -2.2, -0.05),
};

import * as THREE from 'three';

// [B8] The fist fight's own presets (docs/story/briefs/B8_FIGHT.md): to look
// at a moment of the fight from outside the player's eye, and to run seeds.
//   b8spy&sc=<scene>&beat=<beat>&spy=x,y,z,yaw,pitch[,fov]&t=<s>
//       the scene's beat played for t seconds as it plays (its script, its
//       controller), drawn from a camera of its own (the player's hands
//       hidden): the room from above, the start from the side
const Q = () => new URLSearchParams(location.search);

function stageSpy(stage, camera, controller, game) {
  const q = Q();
  game.scenes.shot(q.get('sc') || 'fight', q.get('beat') || null);
  const [x, y, z, yaw, pitch, fov] = (q.get('spy') || '-12.8,6,2,0,-1.2,60').split(',').map(Number);
  // (after the scene has moved the eye this step, the picture is taken from
  // the spy's place: the rules still see the player where he is)
  const put = () => {
    camera.position.set(x, y, z);
    camera.rotation.order = 'YXZ';
    camera.rotation.set(pitch, yaw, 0);
    if (fov && Math.abs(camera.fov - fov) > 1e-3) { camera.fov = fov; camera.updateProjectionMatrix(); }
    camera.updateMatrixWorld();
  };
  game.scenes.ctx.onStep(put);
  put();
  game.setViewmodelVisible(false);
  void THREE;
}

export const presets = {
  b8spy: { t: 1, viewmodel: false, stage: stageSpy },
};

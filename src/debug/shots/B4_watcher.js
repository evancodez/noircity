import * as THREE from 'three';

// Lane B4's presets (scene 6, The Watcher). The scene's beats are also
// reachable as ?scene=watcher&beat=<seen|escape|run|car>&t=<s>.
//   backlot      the backlot stage at a pose: &pose=x,z,yaw,pitch[,fov]
//                (&y= the ground under the eye)
//   bl_straight  down the straight from the foot of the ladder
//   bl_escape    on the top landing, looking down to the street
//   watcher_study  the watcher in the straight, the eye `wd` m off (default
//                6) at bearing `wb` degrees (0 his front, 90 his left, 180
//                his back), playing clip `wc` (default watcher_run) in place;
//                &ws=<m/s> his speed (the clip's time scale); &wl=1 a look back
//                A strip of the run: t= over one cycle (0.62 s).
//   watcher_pass   he runs past on the straight at `ws` m/s, the eye still
//                by the east wall `wd` m off his line (a strip over ~2 s)
const P = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
const num = (k, d) => (P.get(k) != null ? parseFloat(P.get(k)) : d);

function onBacklot(x, z, yaw, pitch, y = null) {
  return {
    t: 1,
    stage(stage, camera, controller, game) {
      game.enterStage('backlot');
      const q = P.get('pose');
      if (q) { const [a, b, c, d, f] = q.split(',').map(Number); if (f) { camera.fov = f; camera.updateProjectionMatrix(); } controller.setPose(a, b, c, d, P.get('y') ? parseFloat(P.get('y')) : null); }
      else controller.setPose(x, z, yaw, pitch, y);
    },
  };
}

function spawnWatcher(game, at, yaw, clip) {
  const cast = game.cast;
  const c = cast.spawn(cast.has('watcher') ? 'watcher' : 'couple_him', { at, yaw, name: 'watcher' });
  if (c.kind === 'watcher') c.setState(clip, 0);
  return c;
}

export const presets = {
  backlot: onBacklot(2.5, -12, 0, 0),
  bl_straight: onBacklot(0.95, -9.8, 0, 0.02),
  bl_escape: onBacklot(0.5, -10.4, Math.PI - 0.1, -0.45, 10.8),
  watcher_study: {
    t: 0.5,
    stage(stage, camera, controller, game) {
      game.enterStage('backlot');
      const at = { x: num('wx', 1.2), z: num('wz', 4.2) };
      const c = spawnWatcher(game, at, 0, P.get('wc') || 'watcher_run');
      const F = c.fig;
      const ws = num('ws', 6.0);
      if ((P.get('wc') || 'watcher_run') === 'watcher_run') F.anim.setTimeScale(ws / (6.0 * F.scale));
      const d = num('wd', 6), b = num('wb', 90) * Math.PI / 180;
      // his front is +z (yaw 0): the eye at bearing b round him
      const ex = at.x + Math.sin(b) * d, ez = at.z + Math.cos(b) * d;
      const ty = 1.0;
      const yaw = Math.atan2(-(at.x - ex), -(at.z - ez));
      camera.fov = num('fov', 40); camera.updateProjectionMatrix();
      controller.setPose(ex, ez, yaw, Math.atan2(ty - 1.6, d), 0);
      if (P.get('wl') === '1') {
        // (a look back over the shoulder, as the chase lays it on)
        const q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
        F.afterPose = (h) => { const B = h.bones; B.chest.quaternion.multiply(q.setFromAxisAngle(Y, 0.45)); B.neck.quaternion.multiply(q.setFromAxisAngle(Y, 0.9)); B.head.quaternion.multiply(q.setFromAxisAngle(Y, 0.5)); B.spine.quaternion.multiply(q.setFromAxisAngle(Y, 0.35)); };
      }
    },
  },
  watcher_pass: {
    t: 0.5,
    stage(stage, camera, controller, game) {
      game.enterStage('backlot');
      const ws = num('ws', 7.0);
      const z0 = -22;
      const c = spawnWatcher(game, { x: 2.3, z: z0 }, Math.PI, 'watcher_run');
      const F = c.fig;
      F.anim.setTimeScale(ws / (6.0 * F.scale));
      game.scripts.push((t, dt) => { F.pos.z = z0 - ws * t; });
      const d = num('wd', 2.3);
      controller.setPose(2.3 + d, -34, Math.atan2(2.3 + d - 2.3, -4), -0.05, 0);
      camera.fov = num('fov', 60); camera.updateProjectionMatrix();
    },
  },
};

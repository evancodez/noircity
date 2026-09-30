import * as THREE from 'three';
import { restageStretch, startRun } from '../../scenes/06_watcher.js';
import { layOn } from '../../cast/kinds/watcher.js';
import { project } from '../../scenes/watcher/chase.js';

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

// the chase in shot mode: the run beat at stretch `st` (0 .. 4), W held
// (&jump=1 SPACE held too; &w=0 no W), &ax=<yaw offset> the look turned;
// t= how long into it
function chase() {
  return {
    scene: 'watcher', beat: 'run', t: 2, viewmodel: true,
    stage(stage, camera, controller, game) {
      const i = Math.round(num('st', 0));
      const ctx = game.scenes.ctx;
      if (i > 0 && ctx && ctx.flags.chase) restageStretch(ctx, i);
      controller.auto = { f: P.get('w') === '0' ? 0 : 1, s: num('as', 0), jump: P.get('jump') === '1' };
      if (P.get('ax')) controller.yaw += num('ax', 0);
      // (&at=x,z: me there after the restage, looking north; &ws= his s ahead)
      if (P.get('at')) { const [x, z] = P.get('at').split(',').map(Number); controller.setPose(x, z, num('ay', 0), num('ap', 0)); if (ctx && P.get('w') !== '0') startRun(ctx); }
      if (P.get('hz') && ctx && ctx.flags.chase) { const [x, z] = P.get('hz').split(',').map(Number); ctx.flags.chase.place(project(x, z, 0, 1e9).s); }
      // (&fov= a narrower lens for a study of him)
      if (P.get('fov')) { camera.fov = num('fov', 70); camera.updateProjectionMatrix(); if (controller.run) controller.run.fov0 = camera.fov; }
    },
  };
}

export const presets = {
  chase: chase(),
  // down the fire escape with W held (&ax= the look turned)
  esc: { scene: 'watcher', beat: 'escape', t: 1, viewmodel: true, stage(stage, camera, controller) { controller.auto = { f: 1 }; } },
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
      // (the coat's tails and a look back, as the chase lays them on)
      F.afterPose = (h) => layOn(h, { v: ws, t: game.time, look: P.get('wl') === '1' ? 0.4 : null });
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
      F.afterPose = (h) => layOn(h, { v: ws, t: game.time });
      game.scripts.push((t, dt) => { F.pos.z = z0 - ws * t; });
      const d = num('wd', 2.3);
      controller.setPose(2.3 + d, -34, Math.atan2(2.3 + d - 2.3, -4), -0.05, 0);
      camera.fov = num('fov', 60); camera.updateProjectionMatrix();
    },
  },
};

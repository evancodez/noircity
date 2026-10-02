import { layOn } from '../../cast/kinds/watcher.js';
import { pathAt, project } from '../../scenes/watcher/course.js';

// Chapter V's presets (lane B4; lane C6 for the rebuilt chase). The scene's
// beats are also reachable as ?scene=watcher&beat=<beat>&t=<s> (seen, escape,
// alley, lane, yard, kitchen, over, street, car).
//   backlot      the backlot stage at a pose: &pose=x,z,yaw,pitch[,fov]
//                (&y= the ground under the eye)
//   bl_straight  down the alley from the foot of the ladder
//   bl_escape    on the top landing, looking down to the street
//   chase        a run beat (&st=<beat>, default alley) with W held (&w=0 no W;
//                &jump=1 SPACE held; &slide=1 C held), &at=x,z (&ay= yaw,
//                &ap= pitch, &ay2=: the look turned), &hs= his path distance
//                ahead of where it puts him, &fov=
//   watcher_study  the watcher in the straight, the eye `wd` m off (default
//                6) at bearing `wb` degrees (0 his front, 90 his left, 180
//                his back), playing clip `wc` (default watcher_run) in place;
//                &ws=<m/s> his speed (the clip's time scale); &wl=1 a look back;
//                &wt= the clip's time (a held clip: a slide, a vault)
//   watcher_pass   he runs past on the straight at `ws` m/s
//   c6look       the backlot's places at night, no one there: &pose= as backlot
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

// the chase in shot mode at a run beat, W held
function chase() {
  return {
    scene: 'watcher', beat: P.get('st') || 'alley', t: 2, viewmodel: true,
    stage(stage, camera, controller, game) {
      const ctx = game.scenes.ctx;
      const C = ctx && ctx.flags.chase;
      if (P.get('at')) {
        const [x, z] = P.get('at').split(',').map(Number);
        const y = P.get('y') ? parseFloat(P.get('y')) : null;
        if (controller.run) controller.run.feet = y ?? stage.surfaceY(x, z);
        controller.pos.set(x, 0, z);
        controller.yaw = num('ay', controller.yaw); controller.pitch = num('ap', controller.pitch);
        if (controller.run) controller.groundY = controller.run.feet;
      }
      if (P.get('hs') && C) C.place(project(C.P, controller.pos.x, controller.pos.z, 0, 1e9).s + num('hs', 12));
      controller.auto = { f: P.get('w') === '0' ? 0 : 1, s: num('as', 0), jump: P.get('jump') === '1', slide: P.get('slide') === '1' };
      if (P.get('ay2')) controller.yaw += num('ay2', 0);
      if (P.get('fov')) { camera.fov = num('fov', 70); camera.updateProjectionMatrix(); if (controller.run) controller.run.fov0 = camera.fov; }
      void pathAt;
    },
  };
}

export const presets = {
  chase: chase(),
  // down the fire escape with W held (&ax= the look turned)
  esc: { scene: 'watcher', beat: 'escape', t: 1, viewmodel: true, stage(stage, camera, controller) { controller.auto = { f: 1 }; } },
  backlot: onBacklot(2.5, -12, 0, 0),
  c6look: onBacklot(2.5, -12, 0, 0),
  bl_straight: onBacklot(0.95, -9.8, 0, 0.02),
  bl_escape: onBacklot(0.5, -10.4, Math.PI - 0.1, -0.45, 10.8),
  watcher_study: {
    t: 0.5,
    stage(stage, camera, controller, game) {
      game.enterStage('backlot');
      const at = { x: num('wx', 1.2), z: num('wz', 4.2) };
      const clip = P.get('wc') || 'watcher_run';
      const c = spawnWatcher(game, at, 0, clip);
      const F = c.fig;
      const ws = num('ws', 6.0);
      if (clip === 'watcher_run') F.anim.setTimeScale(ws / (6.0 * F.scale));
      else if (P.get('wt') != null) { c.play(clip, { fade: 0, hold: true }); F.anim.setTimeScale(0); F.anim.baseTime = num('wt', 0); }
      const d = num('wd', 6), b = num('wb', 90) * Math.PI / 180;
      const ex = at.x + Math.sin(b) * d, ez = at.z + Math.cos(b) * d;
      const ty = 1.0;
      const yaw = Math.atan2(-(at.x - ex), -(at.z - ez));
      camera.fov = num('fov', 40); camera.updateProjectionMatrix();
      controller.setPose(ex, ez, yaw, Math.atan2(ty - 1.6, d), 0);
      F.afterPose = (h) => layOn(h, { v: clip === 'watcher_run' ? ws : 0, t: game.time, look: P.get('wl') === '1' ? 0.4 : null });
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
      game.scripts.push((t) => { F.pos.z = z0 - ws * t; });
      const d = num('wd', 2.3);
      controller.setPose(2.3 + d, -34, Math.atan2(2.3 + d - 2.3, -4), -0.05, 0);
      camera.fov = num('fov', 60); camera.updateProjectionMatrix();
    },
  },
};

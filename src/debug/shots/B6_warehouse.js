// Lane B6's presets (scene 8, Pier Nine): the pier9 stage seen from a few
// places without the scene's cast (look development), and the scene's own
// moments for the review's strips and frames (the scene's beats with a
// staged minute: a sound, a throw, the switch, a blow, at set times).
//   ?shot=p9&pose=x,z,yaw,pitch[,fov]   anywhere on the stage (pose= is the
//                                        camera: main.js applies it before
//                                        the stage function, which re-places it)
//   b6s_curious   (lamps) a step heard behind the first man as he passes the
//                 cross aisle: he turns, peers, gives it up, walks on
//   b6s_bottle    (stairs) a bottle lobbed along the strip: the arc, the
//                 smash, the Hoods' heads turning, both going to look
//   b6s_switch    (lamps) the switch pulled, aisle B's lamps die; from the
//                 pocket his man comes up the cross aisle and puts it back
//   b6s_blow      (lamps) behind the first man: E, the blow, he folds
//   b6f_hands     (lamps) the hands: hands=lit / hands=dark (the pool, the dark)
//   b6f_stairs    (stairs) the strip at the stairs' foot, the Hoods
//   b6f_window    (listen) the office window, his shape on the blinds
//   b6f_bay       (out) the bay from the east stairs' landing
// (their times: t= in the query; the staged moments are fixed game times)
import * as THREE from 'three';

const at = (x, z, yaw, pitch, fov = 70, y = null) => ({
  t: 2, fov,
  stage(stage, camera, controller, game) {
    game.enterStage('pier9');
    const q = new URLSearchParams(location.search).get('pose');
    const [px, pz, pyaw, ppitch] = q ? q.split(',').map(Number) : [x, z, yaw, pitch];
    controller.setPose(px, pz, pyaw, ppitch, y);
  },
});

// ---- the scene's moments ----------------------------------------------------------------
const live = (game) => game.scenes.ctx && game.scenes.ctx.flags.live;
// fn once at game time t0 (the shot's steps run game.scripts each step)
const when = (game, t0, fn) => { let done = false; game.scripts.push((t) => { if (!done && t >= t0 - 1e-6) { done = true; fn(t); } }); };
// a key or the mouse button held from t0 to t1 (as a player's)
const hold = (game, code, t0, t1) => {
  let s = 0;
  game.scripts.push((t) => {
    if (s === 0 && t >= t0) { s = 1; game.vin.down.add(code); game.vin.held.add(code); }
    else if (s === 1 && t >= t1) { s = 2; game.vin.held.delete(code); game.vin.up.add(code); }
  });
};
// E on a thing at t0 (the shot mode runs no interact: its handler, as E would)
const use = (game, id, t0) => when(game, t0, () => { const h = game.interact.list.find((x) => x.id === id); if (h && (!h.when || h.when())) h.onUse(game.scenes.ctx); });
// the camera where I stand for the moment (the player placed, crouched or
// not: setPose puts the controller back to its walk, the sneak again after)
// (pose=x,z,yaw,pitch in the query moves a frame's camera: look development)
const stand = (game, controller, x, z, yaw, pitch, crouch = true, y = null) => {
  const q = new URLSearchParams(location.search).get('pose');
  if (q) [x, z, yaw, pitch] = q.split(',').map(Number);
  controller.setPose(x, z, yaw, pitch, y);
  controller.setMode('sneak', { crouch });
  controller.lookLocked = true;
};
const scene = (beat, t, fn, fov = null) => ({
  scene: 'warehouse', beat, t, viewmodel: true, fov,
  stage(stage, camera, controller, game) { fn(game, controller, live(game), stage); },
});
// (a man parked out of the moment: at a point, standing, looking one way)
// (the men blind and deaf: a frame of the place, not a moment of the game)
const blind = (L) => { for (const m of L.crew.men) { m.perceive = () => 0; m.hear = () => {}; } };
const park = (m, x, z, yaw) => { m.c.place({ x, z }, yaw); m.route = []; m.spec = { ...m.spec, at: [x, z], yaw, looks: [yaw] }; m.setMode('hold'); m.look = m.light = m.lookWant = yaw; };

export const presets = {
  p9: at(-5.2, 20.5, 0.12, 0.04),
  p9door: at(-10.5, -1.0, 0.0, 0.02),
  p9floor: at(0, -3, 0, 0.05),
  p9office: at(0, -38, 0, 0.3, 60),
  p9bay: at(8.5, -30, -2.2, -0.05),

  // a step behind him as he passes the cross aisle (he comes up aisle A
  // from 8 m south of it at the beat's start): he turns, peers, gives it up
  b6s_curious: scene('lamps', 6, (game, C, L) => {
    stand(game, C, -6.65, -11.25, 0.95, -0.04);
    when(game, 4.55, () => L.crew.noise(new THREE.Vector3(-13.3, 0, -15.4), 3, 'step'));
  }),
  // the lob from the strip's end: a bottle in hand, LMB held (the arc),
  // released; the smash, the Hoods turn and go
  b6s_bottle: scene('stairs', 3, (game, C, L) => {
    stand(game, C, -9.45, -35.3, -1.41, -0.05);
    const b = L.bottles[3];
    L.stealth.take(b);
    when(game, 0.7, () => { C.pitch = 0.15; });
    hold(game, 'Mouse0', 0.8, 1.45);
  }, 58),
  // the switch: pulled at 0.3 s; I am in the pocket by 1.6 s, looking out
  // down the cross aisle; aisle B's man comes and puts it back
  // (the camera at the pocket's mouth to see down the cross aisle: the men's
  // eyes are off for it, the walk and the fix are the game's)
  b6s_switch: scene('lamps', 4, (game, C, L) => {
    park(L.crew.get('sully'), -11.2, -24.6, Math.PI);
    blind(L);
    stand(game, C, -8.95, -13.15, Math.PI - 0.05, -0.12, false);
    use(game, 'b6switch', 0.3);
    when(game, 1.6, () => stand(game, C, -7.9, -16.65, -2.72, -0.02));
  }),
  // behind the first man (stopped at the cross aisle, looking up his aisle):
  // E, the blow, he folds
  b6s_blow: scene('lamps', 2, (game, C, L) => {
    park(L.crew.get('sully'), -11.2, -14.2, Math.PI);
    stand(game, C, -11.25, -12.75, 0.0, -0.04);
    use(game, 'b6ko_sully', 0.9);
  }, 78),

  // the hands: in the door's pool / in the dark of the stacks' pocket
  // (?shot=b6f_hands&hands=lit|dark)
  b6f_hands: scene('lamps', 1.5, (game, C, L) => {
    park(L.crew.get('sully'), -11.2, -24.6, Math.PI);
    blind(L);
    const lit = new URLSearchParams(location.search).get('hands') !== 'dark';
    if (lit) stand(game, C, -10.9, -4.9, 0.3, -0.42, false);
    else stand(game, C, -6.65, -11.2, 0.95, -0.3, true);
  }),
  // the strip at the stairs' foot, the Hoods by them, the mezzanine over
  b6f_stairs: scene('stairs', 2.5, (game, C, L) => { blind(L); stand(game, C, -10.0, -36.3, -1.2, 0.1, false); }, 66),
  // the office window from under it (crouched, as I listen): the Cardinal at it, a shape
  // on the blinds (his look comes at ~14 s)
  b6f_window: scene('listen', 15.5, (game, C, L) => { blind(L); stand(game, C, -1.0, -41.45, 0.0, 0.42, true, 3.8); }, 60),
  // the bay from the east stairs' landing: the clear floor in its pool, the
  // loading doors, the side door out
  b6f_bay: scene('out', 2, (game, C, L) => { blind(L); stand(game, C, 7.6, -40.3, -2.45, -0.34, false, 3.8); }, 66),
};

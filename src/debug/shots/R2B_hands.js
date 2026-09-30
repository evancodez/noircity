import * as THREE from 'three';
import { presets as B3 } from './B3_revolver.js';
import { SLAT } from '../../player/clips/watcher.js';

// Lane R2-B's presets (round 2: the hands across the game).
//   r2rev                the .38 in the street's composition (as B3's rev: all
//                        of its options), and:
//     &gp=x,y,z,yaw,pitch,roll[,ex,ey,ez]   the gun's ready place moved
//                        (the eye's frame: look development of the rest)
//   r2beat&sc=<scene>&beat=<beat>   a story beat's frame, as ?scene= (t= its
//                        time), with the look-development options below
//   (both) &skin=bare|glove   the revolver set's skin forced (look development)
const Q = () => new URLSearchParams(location.search);

function lookDev(game) {
  const skin = Q().get('skin');
  if (!skin) return;
  const H = game.player.hands;
  game.scripts.push(() => {
    if (H.set !== 'revolver') return;
    for (const s of ['R', 'L']) if (H.rig[s].skin !== skin) H.rig[s].setSkin(skin);
  });
}

function withPose(stageFn) {
  return (stage, camera, controller, game) => {
    const gp = Q().get('gp');
    if (gp) {
      const v = gp.split(',').map(Number);
      const R = game.weapons.get('revolver').POSE.ready;
      R.p.set(v[0], v[1], v[2]);
      R.q.setFromEuler(new THREE.Euler(v[4], v[3], v[5], 'YXZ'));
      if (v.length >= 9) R.e.set(v[6], v[7], v[8]);
    }
    lookDev(game);
    stageFn(stage, camera, controller, game);
  };
}

// &press=KeyE@1.8,Mouse0@2.4   keys pressed at those game times (a scene's
// prompt taken, as a player would: game.scenes.press, and the virtual input)
function presses(game) {
  // (&hold=Mouse2@1.0: held from then to the frame)
  const list = (Q().get('press') || '').split(',').filter(Boolean).map((a) => { const [code, t] = a.split('@'); return { code, t: +t || 0, done: 0 }; });
  for (const a of (Q().get('hold') || '').split(',').filter(Boolean)) { const [code, t] = a.split('@'); list.push({ code, t: +t || 0, done: 0, hold: true }); }
  if (!list.length) return;
  game.scripts.push((t) => {
    for (const p of list) {
      if (p.done === 0 && t >= p.t - 1e-6) { p.done = 1; game.scenes.press(p.code); game.vin.down.add(p.code); game.vin.held.add(p.code); }
      else if (p.done === 1 && !p.hold) { p.done = 2; game.vin.held.delete(p.code); game.vin.up.add(p.code); game.scenes.injected.delete(p.code); }
    }
  });
}

function stageBeat(stage, camera, controller, game) {
  const sc = Q().get('sc') || 'gunfight';
  const beat = Q().get('beat') || null;
  game.scenes.shot(sc, beat);
  presses(game);
  const gp = Q().get('gp');
  if (gp) withPose(() => {})(stage, camera, controller, game);
  else lookDev(game);
}

// r2slat: the watcher's window (the seen beat), the two fingers on a slat
// 0.32 m before the eye (clips/watcher.js partSlats, SLAT.at)
function stageSlat(stage, camera, controller, game) {
  game.scenes.shot('watcher', 'seen');
  let done = false;
  game.scripts.push((t) => {
    if (done || t < 0.3) return;
    done = true;
    camera.updateMatrixWorld();
    const at = new THREE.Vector3(0.01, -0.03, -0.32).applyMatrix4(camera.matrixWorld);
    SLAT.cam = camera; SLAT.at = at;
    game.player.hands.equip('empty');
    game.player.hands.play('partSlats');
  });
}

export const presets = {
  r2slat: { t: 1.2, viewmodel: true, stage: stageSlat },
  r2rev: { ...B3.rev, stage: withPose(B3.rev.stage) },
  r2beat: { t: 1, viewmodel: true, stage: stageBeat },
};

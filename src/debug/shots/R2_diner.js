import * as THREE from 'three';
import { DINER_CLIPS } from '../../player/clips/diner.js';

// Wave A round 2, owner 2 (scene one): the presets that judge the contacts.
//   r2hands&clip=<name>&ct=<s>   a hands clip of the diner at ct seconds, seated square
//     &orbit=<deg>               a free camera round the hands (0 in front of
//                                them looking back at the eye, 90 their right,
//                                180 behind, 270 their left); the eye they
//                                belong to stays put
//     &orbitc=L|R|both &orbitr=<m> &orbity=<m> &orbitfov=<deg> &bg=1
//     (the beat each clip is played in: the glass's in drink, the wallet's
//     in pay, the smoke's in order, lightUp in settle)
const Q = () => new URLSearchParams(location.search);
const num = (k, d) => { const v = parseFloat(Q().get(k) ?? ''); return Number.isFinite(v) ? v : d; };
const BEAT = { reachGlass: 'drink', sip: 'drink', putDown: 'drink', payWallet: 'pay', drag: 'order', ash: 'order', lightUp: 'settle' };

function orbit(game, controller, camera) {
  const deg = parseFloat(Q().get('orbit') ?? '');
  if (!Number.isFinite(deg)) return;
  const H = game.player.hands;
  camera.updateMatrixWorld();
  game.vm.study = camera.matrixWorld.clone();
  H.bodyYaw = controller.bodyYaw ?? controller.yaw;
  H.studyFov = true;
  const by = H.bodyYaw;
  const fwd = new THREE.Vector3(-Math.sin(by), 0, -Math.cos(by)), right = new THREE.Vector3(Math.cos(by), 0, -Math.sin(by));
  const which = Q().get('orbitc') || 'both';
  const R = num('orbitr', which === 'both' ? 1.2 : 0.8), up = num('orbity', 0.12);
  camera.fov = num('orbitfov', which === 'both' ? 34 : 24);
  camera.updateProjectionMatrix();
  const a = deg * Math.PI / 180;
  const c = new THREE.Vector3(), tmp = new THREE.Vector3(), eyeP = camera.position.clone();
  const pose = { x: eyeP.x, y: eyeP.y, z: eyeP.z, yaw: controller.yaw, pitch: controller.pitch };
  const track = () => {
    game.vm.root.updateMatrixWorld(true);
    c.set(0, 0, 0);
    let n = 0;
    for (const h of ['R', 'L']) {
      if (which !== 'both' && which !== h) continue;
      if (!H.rig[h].visible) continue;
      c.add(tmp.set(0, -0.01, -0.05).applyMatrix4(H.rig[h].hand.matrixWorld)); n++;
    }
    if (n) c.multiplyScalar(1 / n); else c.copy(eyeP).addScaledVector(fwd, 0.45).setY(eyeP.y - 0.3);
    const p = c.clone().addScaledVector(fwd, Math.cos(a) * R).addScaledVector(right, Math.sin(a) * R);
    p.y += up;
    const d = c.clone().sub(p);
    Object.assign(pose, { x: p.x, y: p.y, z: p.z, yaw: Math.atan2(-d.x, -d.z), pitch: Math.atan2(d.y, Math.hypot(d.x, d.z)) });
    return pose;
  };
  controller.setMode('cutscene', { track });
  if (Q().get('bg') !== '1') game.stage.scene.visible = false;
}

// the clip starts at 0.5 s (the room set up; after the clips that bring the
// glass up, for those that start with it in the hand) and runs ct
const PRE = { sip: ['reachGlass'], putDown: ['reachGlass', 'sip'] };
const preOf = (clip) => PRE[clip] || [];
const T0 = 0.5 + preOf(Q().get('clip') || '').reduce((a, c) => a + DINER_CLIPS[c].duration + 0.02, 0);
const SHOT_T = Math.round((num('ct', 1) + T0) * 60) / 60;
function r2hands(stage, camera, controller, game) {
  const clip = Q().get('clip') || 'reachGlass';
  const H = game.player.hands;
  game.scenes.shot('diner', BEAT[clip] || 'settle');
  controller.setMode('seated', { anchor: 'diner.stool.player', ease: 1e-3 });
  controller.apply(0);
  if (clip === 'drag' || clip === 'ash') { const c = H.cigarette(); if (c) { H.lit = true; if (H.held.R !== c) H.hold(c, 'R'); } }
  // (the glass taken first for the clips that start with it in the hand)
  let t0 = 0.5;
  for (const p of preOf(clip)) { game.scripts.push(onceAt(t0, () => H.play(p))); t0 += DINER_CLIPS[p].duration + 0.02; }
  const start = Math.round(t0 * 60) / 60;
  game.scripts.push(onceAt(start, () => {
    H.play(clip);
    if (Q().has('orbit')) orbit(game, controller, camera);
  }));
}
function onceAt(t0, fn) { let done = false; return (t) => { if (!done && t >= t0 - 1e-6) { done = true; fn(); } }; }

// r2cam&beat=<beat>&cam=x,y,z,yaw,pitch[,fov][&press=...][&t=...][&hands=1]
//   the diner's scene 1 at a beat, seen from a free camera (a witness: the
//   pour from Dot's side, the slide from above); the scene plays as it would
function r2cam(stage, camera, controller, game) {
  game.scenes.shot('diner', Q().get('beat') || 'order');
  const [x, y, z, yaw, pitch, fov] = (Q().get('cam') || '-15.0,1.5,5.2,0,-0.12,32').split(',').map(Number);
  if (fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  if (Q().get('hands') !== '1') { camera.updateMatrixWorld(); game.vm.study = camera.matrixWorld.clone(); }
  controller.setMode('cutscene', { track: () => ({ x, y, z, yaw, pitch }), ease: 1e-3 });
}

export const presets = {
  r2hands: { t: SHOT_T, viewmodel: true, stage: r2hands },
  r2cam: { t: num('t', 1), viewmodel: false, stage: r2cam },
};

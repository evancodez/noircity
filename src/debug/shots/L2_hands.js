import * as THREE from 'three';

// Lane 2's presets: the hands.
//   handstudy                 the two bare hands open, palms down, over the counter
//                             under a lamp (seated at the diner's counter, stool 4)
//     &pose=<name>            any pose of player/handPoses.js ('tommyL' shows the
//                             gun set), a pair ('study', 'rest', 'guard') or a
//                             clip's moment ('lightUp@2.0')
//     &orbit=<deg>            a free camera turns round the hands (0 front, 90 their
//                             right, 180 behind, 270 their left), 0.55 m off
//     &orbitc=L|R|both        what it turns round (a palm, or both)
//     &bg=1                   keep the room behind (else a plain studio)
//     &orbitr=<m> &orbity=<m> &orbitfov=<deg>   its distance, height and lens
//   handclip&clip=<name>&ct=<s>   a clip of the hands at ct seconds into it, in its
//                             place: the diner's clips seated at the counter, the
//                             fists' in the ring facing Mack, the Tommy gun's on the street
// (the diner and the ring are set up through the scene shot mode:
// game.scenes.shot, as ?scene= does)
const Q = () => new URLSearchParams(location.search);
const num = (k, d) => { const v = parseFloat(Q().get(k) ?? ''); return Number.isFinite(v) ? v : d; };

// the clips by the place they belong to
const FIST_CLIPS = new Set(['guard', 'jabL', 'jabR', 'heavyWind', 'heavyHit', 'block', 'blockHit', 'slipL', 'slipR', 'hurt', 'grab', 'swingBottle', 'swingPlate', 'swingStool']);
const OUT_CLIPS = new Set(['searchBody', 'showMatchbook']);

function orbit(game, controller, camera) {
  const deg = parseFloat(Q().get('orbit') ?? '');
  if (!Number.isFinite(deg)) return;
  const H = game.player.hands;
  // the eye the hands belong to stays where the seat put it; the camera
  // goes round the hands (their centre ~0.45 m ahead of the eye, 0.3 down)
  camera.updateMatrixWorld();
  const eye = camera.matrixWorld.clone();
  game.vm.study = eye;
  H.bodyYaw = controller.bodyYaw ?? controller.yaw;
  H.studyFov = true;
  const by = H.bodyYaw;
  const fwd = new THREE.Vector3(-Math.sin(by), 0, -Math.cos(by)), right = new THREE.Vector3(Math.cos(by), 0, -Math.sin(by));
  const set = H.set;
  // the centre: the hands' palms (orbitc=L | R | both), found each step
  // from where the hands are (the gun's grips are laid after its first step)
  const which = Q().get('orbitc') || 'both';
  // (a long lens from well off, so the camera never stands inside a sleeve)
  const R = num('orbitr', which === 'both' ? 1.2 : 0.95), up = num('orbity', 0.12);
  camera.fov = num('orbitfov', which === 'both' ? 34 : 22);
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
    // 0 = in front of the hands looking back at the eye; 90 = their right
    const p = c.clone().addScaledVector(fwd, Math.cos(a) * R).addScaledVector(right, Math.sin(a) * R);
    p.y += up;
    const d = c.clone().sub(p);
    Object.assign(pose, { x: p.x, y: p.y, z: p.z, yaw: Math.atan2(-d.x, -d.z), pitch: Math.atan2(d.y, Math.hypot(d.x, d.z)) });
    return pose;
  };
  controller.setMode('cutscene', { track });
  // a plain studio behind the hands (the world hidden: the ink's paper and
  // fog), unless bg=1; the hands keep the world's lights at the eye
  if (Q().get('bg') !== '1') game.stage.scene.visible = false;
}

function handStudy(stage, camera, controller, game) {
  game.scenes.shot('diner', 'settle');
  const H = game.player.hands;
  const name = Q().get('pose') || 'study';
  const clipAt = name.indexOf('@') > 0 ? name.slice(0, name.indexOf('@')) : null;
  const gunPose = /^tommy/.test(name);
  if (name.startsWith('tommyReload@')) game.weapon.ammo = 3;
  H.equip(gunPose ? 'tommy' : FIST_CLIPS.has(clipAt) || /^guard|^jab|^block/.test(name) ? 'fists' : 'smoke');
  H.pose(name);
  controller.apply(0);
  orbit(game, controller, camera);
}

function handClip(stage, camera, controller, game) {
  const clip = Q().get('clip') || 'lightUp';
  const ct = num('ct', 1);
  const H = game.player.hands;
  let T = SHOT_T;
  if (clip === 'tommyReload') {
    // on the street, the gun in hand: the reload runs `ct` s at the frame
    game.weapon.ammo = 3;
    let done = false;
    game.scripts.push((t) => { if (!done && t >= T - ct - 1e-6) { done = true; H.play('tommyReload'); } });
    return;
  }
  if (FIST_CLIPS.has(clip)) {
    game.scenes.shot('fight', 'round1');
    // (the stand-in fight throws its first punch at 1.5 s: the clip is
    // over before it)
    T = SHOT_T;
  } else if (OUT_CLIPS.has(clip)) {
    game.scenes.shot('fight', 'outside');
  } else {
    game.scenes.shot('diner', clip === 'payWallet' ? 'pay' : clip === 'reachGlass' || clip === 'sip' || clip === 'putDown' ? 'drink' : clip === 'drag' || clip === 'ash' ? 'order' : 'settle');
    // (the cigarette lit: the beat's stand-in one, into the hand as the hands hold it)
    if (clip === 'drag' || clip === 'ash') { const c = H.cigarette(); if (c) { H.lit = true; if (H.held.R !== c) H.hold(c, 'R'); } }
    if (clip === 'putDown') { let done0 = false; game.scripts.push((t) => { if (!done0 && t >= 0.1) { done0 = true; H.play('reachGlass'); } }); }
  }
  let done = false;
  const start = Math.round((T - ct) * 60) / 60;
  game.scripts.push((t) => { if (!done && t >= start - 1e-6) { done = true; H.play(clip); } });
}
// the frame's time: the clip starts at 0.5 s (the room set up) and runs ct
const SHOT_T = Math.round((num('ct', 1) + 0.5) * 60) / 60;

export const presets = {
  handstudy: { t: 1, viewmodel: true, stage: handStudy },
  handclip: { t: SHOT_T, viewmodel: true, stage: handClip },
  // the reload on the street (the golden 'reload' composition)
  handreload: { x: -3.8, z: -9.0, y: 0.07, yaw: -0.105, pitch: 0.075, fov: 70, t: SHOT_T, viewmodel: true, holdWindow: 0, stage: handClip },
};

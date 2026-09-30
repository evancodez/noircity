import * as THREE from 'three';
import { RANGE } from '../../scenes/90_range.js';

// Lane B3's presets: the revolver (and the hands' new surface).
//   rev                  the street's composition, the .38 drawn and at rest
//     &rs=1              steadied (RMB held from the start)
//     &rf=<s>            a round fired <s> before the frame (0.03: mid-climb)
//     &rr=<s>            a reload <s> into its 1.7 s (the cylinder out at 0.3)
//     &rd=<s>            the draw <s> in (0.35 s)      &rh=<s> the put-away
//     &rc=<s>            a reload cut by a press <s> after its first pair
//     &orbit=<deg>       a free camera round the gun and hand (0 in front,
//                        90 their right); &orbitr= &orbity= &orbitfov=
//     &bg=0              a plain studio behind (the world hidden)
//   revfight             a staged fight on the block against three Hoods:
//                        the first down (a head shot 0.4 s before the frame),
//                        the second staggered by a body hit, the third
//                        aiming; the .38 steadied, its flash in frame
//   (range: ?scene=range&beat=ready | fight | done frames the play's scene)
const Q = () => new URLSearchParams(location.search);
const num = (k, d) => { const v = parseFloat(Q().get(k) ?? ''); return Number.isFinite(v) ? v : d; };
const STEP = 1 / 60;
const tEnd = (d) => num('t', d);

function equipRevolver(game, { spent = 0 } = {}) {
  game.weapons.equip('revolver');
  const w = game.weapons.get('revolver');
  // (a draw already done: the gun up at the frame's first step)
  w.phase = 'ready'; w.t = 1;
  for (let i = 0; i < spent; i++) w.chambers[i] = 'spent';
  return w;
}
// a press of a mouse button at game time t (as a player's: down, up a step later)
function pressAt(game, code, t0, hold = false) {
  let state = 0;
  game.scripts.push((t) => {
    if (state === 0 && t >= t0 - 1e-6) { state = 1; game.vin.down.add(code); game.vin.held.add(code); }
    else if (state === 1 && !hold) { state = 2; game.vin.held.delete(code); game.vin.up.add(code); }
  });
}

function orbit(game, controller, camera) {
  const deg = num('orbit', NaN);
  if (!Number.isFinite(deg)) return;
  const H = game.player.hands;
  camera.updateMatrixWorld();
  const eye = camera.matrixWorld.clone();
  game.vm.study = eye;
  H.studyFov = true;
  const yaw = controller.yaw;
  const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)), right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const R = num('orbitr', 0.8), up = num('orbity', 0.08);
  camera.fov = num('orbitfov', 26);
  camera.updateProjectionMatrix();
  const a = deg * Math.PI / 180;
  const c = new THREE.Vector3(), eyeP = camera.position.clone();
  const pose = { x: eyeP.x, y: eyeP.y, z: eyeP.z, yaw, pitch: 0 };
  const w = game.weapons.get('revolver');
  const track = () => {
    game.vm.root.updateMatrixWorld(true);
    if (w && w.prop) w.prop.getWorldPosition(c); else c.copy(eyeP).addScaledVector(fwd, 0.45);
    const p = c.clone().addScaledVector(fwd, Math.cos(a) * R).addScaledVector(right, Math.sin(a) * R);
    p.y += up;
    const d = c.clone().sub(p);
    Object.assign(pose, { x: p.x, y: p.y, z: p.z, yaw: Math.atan2(-d.x, -d.z), pitch: Math.atan2(d.y, Math.hypot(d.x, d.z)) });
    return pose;
  };
  controller.setMode('cutscene', { track, ease: 1e-3 });
  if (Q().get('bg') === '0') game.stage.scene.visible = false;
}

function stageRev(stage, camera, controller, game) {
  const T = tEnd(1.2);
  const w = equipRevolver(game, { spent: num('spent', 0) });
  if (Q().get('rs') === '1') game.vin.held.add('Mouse2');
  const rf = num('rf', NaN);
  if (Number.isFinite(rf)) pressAt(game, 'Mouse0', Math.round((T - rf) * 60) / 60);
  const rr = num('rr', NaN);
  if (Number.isFinite(rr)) {
    w.chambers = ['spent', 'spent', 'spent', 'spent', 'spent', 'live'];
    let done = false;
    game.scripts.push((t) => { if (!done && t >= Math.round((T - rr) * 60) / 60 - 1e-6) { done = true; w.reload(); } });
  }
  const rc = num('rc', NaN);
  if (Number.isFinite(rc)) {
    w.chambers = ['spent', 'spent', 'spent', 'spent', 'spent', 'spent'];
    const t0 = Math.round((T - rc - 0.8) * 60) / 60;
    let done = false;
    game.scripts.push((t) => { if (!done && t >= t0 - 1e-6) { done = true; w.reload(); } });
    pressAt(game, 'Mouse0', Math.round((T - rc) * 60) / 60);
  }
  const rd = num('rd', NaN);
  if (Number.isFinite(rd)) {
    game.weapons.equip(null);
    let done = false;
    game.scripts.push((t) => { if (!done && t >= Math.round((T - rd) * 60) / 60 - 1e-6) { done = true; game.weapons.equip('revolver'); } });
  }
  const rh = num('rh', NaN);
  if (Number.isFinite(rh)) {
    let done = false;
    game.scripts.push((t) => { if (!done && t >= Math.round((T - rh) * 60) / 60 - 1e-6) { done = true; w.holster(); } });
  }
  orbit(game, controller, camera);
}

// the staged fight: the range's three men in the street's composition
function stageRevFight(stage, camera, controller, game) {
  const T = tEnd(4);
  const w = equipRevolver(game);
  game.vin.held.add('Mouse2');
  const eye = camera.position.clone();
  const nav = game.nav;
  const at = (x, z) => { const k = nav.nearestFree(x, z, 3); const c = nav.center(k); return [c.x, c.z]; };
  const face = (x, z) => Math.atan2(eye.x - x, eye.z - z);
  const [ax, az] = at(RANGE.hoods[0].x, RANGE.hoods[0].z);
  const A = game.spawnHood(ax, az, { ai: false, variant: RANGE.hoods[0].variant, yaw: face(ax, az) + 0.3, state: 'aim' });
  A.lookAt(eye);
  const [bx, bz] = at(RANGE.hoods[1].x, RANGE.hoods[1].z);
  const B = game.spawnHood(bx, bz, { ai: false, variant: RANGE.hoods[1].variant, yaw: face(bx, bz), state: 'aim' });
  B.lookAt(eye);
  const [cx, cz] = at(RANGE.hoods[2].x, RANGE.hoods[2].z);
  const C = game.spawnHood(cx, cz, { ai: false, variant: RANGE.hoods[2].variant, yaw: face(cx, cz) - 0.3, state: 'aim' });
  C.lookAt(eye);
  const chest = (h) => new THREE.Vector3().setFromMatrixPosition(h.bones.chest.matrixWorld);
  const head = (h) => new THREE.Vector3().setFromMatrixPosition(h.bones.head.matrixWorld);
  // aim the eye at a point (the steadied gun's sights on it), then press
  const aimAt = (p) => {
    const d = p.clone().sub(camera.position);
    controller.yaw = Math.atan2(-d.x, -d.z);
    controller.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
  };
  const events = [
    [T - 1.6, () => aimAt(head(A))], [T - 1.2, () => game.vin.down.add('Mouse0')],
    [T - 0.9, () => game.stagedHoodFire(C, T - 0.9)],
    [T - 0.75, () => aimAt(chest(B).add(new THREE.Vector3(0, -0.1, 0)))], [T - 2 * STEP, () => game.vin.down.add('Mouse0')],
    [T - 0.3, () => game.stagedHoodFire(C, T - 0.3)],
  ];
  let k = 0;
  game.scripts.push((t) => { while (k < events.length && t >= events[k][0] - 1e-6) events[k++][1](); });
  void w;
}

export const presets = {
  rev: { x: RANGE.eye.x, z: RANGE.eye.z, y: 0.07, yaw: -0.105, pitch: 0.075, fov: 70, t: 1.2, viewmodel: true, holdWindow: 0, stage: stageRev },
  revfight: { x: RANGE.eye.x, z: RANGE.eye.z, y: 0.07, yaw: -0.105, pitch: 0.075, fov: 70, t: 4, viewmodel: true, holdWindow: 0, prewarm: true, stage: stageRevFight },
};

import * as THREE from 'three';

// Lane 6's presets (the cast).
//   caststudy                 all seven and one Hood in a row under a lamp on the
//                             street, 5 m from the eye, turned three-quarters, each
//                             with what he carries
//   caststudy&far=1           the same at 22 m: silhouettes only
//   castlab&kind=<k>&hs=<state>&hy=<deg>   one figure, any state (a clip plays
//                             from t = 3.9 when it is a one-shot), any angle
//                             (hy: 0 = facing the eye). Seated states are
//                             staged in the diner (stool 7 / booth 4, hseat=
//                             stool|booth), the rest on the street.
//                             focus=0,dist,bearing,eye,fov for close-ups (as hoodlab);
//                             the waitress's counter clips (serve pour slide
//                             slideBottle wipe duck) behind the counter at
//                             hat=<anchor> (diner.serve.4), seen from
//                             heye=<anchor> (the player's stool); hs=walk|carry|run
//                             crosses the frame
//   castdiner&cview=<n>       the diner's people where scene 1 has them (Dot at
//                             the urns, the cook in the hatch, the old man on
//                             stool 9, the docker on stool 1, the couple in
//                             booth 2, the brawler on stool 6); cview 0 from the
//                             aisle by the door, 1 from the player's stool, 2
//                             down the counter, 3 the booth
const Q = () => new URLSearchParams(location.search);
const D2R = Math.PI / 180;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const KINDS7 = ['brawler', 'waitress', 'cook', 'oldman', 'couple_her', 'couple_him', 'docker'];
// what each carries in the study
const GEAR = { waitress: ['coffeePot', 'R'], docker: ['mug', 'R'] };
const STUDY_STATE = { oldman: 'read', waitress: 'idle' };

// focus= on a cast figure (main.js's focus looks at stage.hoods only): the
// same framing, set every step
export function focusOn(game, controller, camera, c) {
  const f = Q().get('focus');
  if (!f) return;
  const [, dist = 3, bearing = 0, eye = 1.5, fov = 32] = f.split(',').map(Number);
  game.scripts.push(() => {
    const h = c.fig;
    const tgt = new THREE.Vector3().setFromMatrixPosition(h.bones.hips.matrixWorld);
    tgt.y = Math.max(tgt.y, h.pos.y + 0.35) + 0.15;
    const a = h.yaw + bearing * D2R;
    const cx = tgt.x + Math.sin(a) * dist, cz = tgt.z + Math.cos(a) * dist;
    const ey = h.pos.y + eye;
    camera.fov = fov;
    camera.updateProjectionMatrix();
    controller.setPose(cx, cz, Math.atan2(-(tgt.x - cx), -(tgt.z - cz)), Math.atan2(tgt.y - ey, dist), ey - 1.63);
  });
}

function giveGear(stage, c, prop) {
  const G = GEAR[c.kind];
  if (!G) return;
  c.hold(prop(G[0]), G[1]);
}

import { buildProp } from '../../props/index.js';

// ---- castlab --------------------------------------------------------------------------
const SEATED = /^sit|^notice$|^rise$/;
function stageCastLab(stage, camera, controller, game) {
  const q = Q();
  const kind = q.get('kind') || 'brawler';
  const st = q.get('hs') || 'idle';
  const yaw = parseFloat(q.get('hy') || '0') * D2R;
  if (kind === 'hood') {
    // a Hood through the cast (no AI): leanDoor, stepOut (from t = 3.9), sitCar
    const h = stage.cast.spawn('hood', { at: { x: -2.2, z: -17.3 }, yaw, brain: 'none', variant: { coat: 1, brim: 1, tall: 1 } });
    if (st === 'stepOut') { h.setState('leanDoor', 0); let done = false; game.scripts.push((t) => { if (!done && t >= 3.9 - 1e-6) { done = true; h.play('stepOut', { fade: 0.15 }); } }); } else if (st !== 'idle') h.setState(st, 0);
    return;
  }
  let c;
  if (SEATED.test(st)) {
    // in the diner: the seat, and the eye in the aisle facing it
    const booth = (q.get('hseat') || (kind.startsWith('couple') ? 'booth' : 'stool')) === 'booth';
    const seat = booth ? 'diner.booth.4.a' : 'diner.stool.7';
    c = stage.cast.spawn(kind, { seat });
    const a = stage.anchor(seat);
    const fy = a.yaw + Math.PI + yaw;
    const cx = a.pos.x + Math.sin(fy) * 2.6, cz = a.pos.z + Math.cos(fy) * 2.6;
    controller.setPose(cx, cz, Math.atan2(-(a.pos.x - cx), -(a.pos.z - cz)), -0.15, 0.15);
  } else if (q.get('hat') || /^(serve|pour|slide|slideBottle|wipe|duck)$/.test(st)) {
    // behind the counter, seen from the player's stool (hat=<anchor>)
    const at = q.get('hat') || 'diner.serve.4';
    c = stage.cast.spawn(kind, { at });
    const a = stage.anchor(q.get('heye') || 'diner.stool.player'), b = stage.anchor(at);
    const ey = a.eyeY ?? 1.6;
    controller.setPose(a.pos.x, a.pos.z, Math.atan2(-(b.pos.x - a.pos.x), -(b.pos.z - a.pos.z)) + (parseFloat(q.get('hpan') || '0') * D2R), -0.02, ey - 1.63);
  } else if (st === 'walk' || st === 'carry' || st === 'run') {
    // across the frame, passing the mark (-2.2, -17.3) at t = 4.3
    const sp = st === 'run' ? 2.9 : 1.25;
    c = stage.cast.spawn(kind, { at: { x: -2.2 - sp * 4.3, z: -17.3 }, yaw: Math.PI / 2 });
    if (st === 'carry' && !GEAR[kind]) c.hold(buildProp('plate'), 'R');
    else if (st === 'carry') giveGear(stage, c, (k) => buildProp(k));
    const gen = c.walkTo({ x: 6, z: -17.3 }, { run: st === 'run' });
    game.scripts.push(() => gen.next());
  } else {
    c = stage.cast.spawn(kind, { at: { x: -2.2, z: -17.3 }, yaw });
  }
  if (kind === 'brawler' && q.get('blood')) c.bleed(parseFloat(q.get('blood')));
  if (GEAR[kind] && q.get('gear') === '1' && !c.held.R) giveGear(stage, c, (k) => buildProp(k));
  if (st !== 'idle' && st !== 'walk' && st !== 'carry' && st !== 'run') {
    const one = !['sit', 'sitEat', 'sitDrink', 'sitRead', 'sitSmoke', 'sitTalk', 'lean', 'wipe', 'hatch', 'watch', 'read', 'br_guard', 'ko'].includes(st);
    if (!one) c.setState(st, 0);
    else {
      // (a one-shot starts at t = 3.9, from its natural base)
      if (st.startsWith('br_')) c.setState('br_guard', 0);
      let done = false;
      game.scripts.push((t) => { if (!done && t >= 3.9 - 1e-6) { done = true; c.play(st, { fade: 0.1 }); } });
    }
  }
  focusOn(game, controller, camera, c);
}

// ---- caststudy ---------------------------------------------------------------------------
// the row: an arc round the eye (x -2.2, z -13.3) at R m, each figure turned
// 40 deg from facing the eye; the Hood last, for scale
function stageCastStudy(stage, camera, controller, game) {
  const far = Q().get('far') === '1';
  const R = far ? 22 : 5, step = far ? 2.3 : 9.4;
  const cx = -2.2, cz = -13.3;
  const kinds = [...KINDS7, 'hood'];
  kinds.forEach((k, i) => {
    const a = ((i - (kinds.length - 1) / 2) * step + (far ? 1.6 : 0)) * D2R;
    const x = cx + R * Math.sin(a), z = cz - R * Math.cos(a);
    const face = Math.atan2(cx - x, cz - z) + 40 * D2R;
    if (k === 'hood') { stage.hoods.spawn([x, z], { coat: 1, brim: 1, tall: 1 }, { yaw: face, state: 'idle' }); return; }
    const c = stage.cast.spawn(k, { at: { x, z }, yaw: face });
    if (STUDY_STATE[k] && STUDY_STATE[k] !== 'idle') c.setState(STUDY_STATE[k], 0);
    giveGear(stage, c, (kk) => buildProp(kk));
  });
}

// ---- castdiner -----------------------------------------------------------------------------
export function seatDinerCast(stage) {
  const cast = stage.cast;
  const dot = cast.spawn('waitress', { at: 'diner.urns' });
  dot.setState('lean', 0);
  const cook = cast.spawn('cook', { at: 'diner.hatch' });
  cook.setState('hatch', 0);
  cast.spawn('oldman', { seat: 'diner.stool.9' }).setState('sitRead', 0);
  const dk = cast.spawn('docker', { seat: 'diner.stool.1' });
  dk.setState('sitDrink', 0);
  dk.hold(buildProp('mug'), 'R');
  cast.spawn('couple_her', { seat: 'diner.booth.2.a' }).setState('sitSmoke', 0);
  cast.spawn('couple_him', { seat: 'diner.booth.2.b' }).setState('sitTalk', 0);
  cast.spawn('brawler', { seat: 'diner.stool.6' }).setState('sitEat', 0);
}
const DINER_VIEWS = [
  // from the aisle, the brawler over his plate on stool 6, the counter beyond
  { x: -12.3, z: 3.6, yaw: 0.73, pitch: -0.1, y: 0.15, fov: 60 },
  // the player's seated eye on stool 4, looking down the counter at him
  { x: -13.75, z: 4.1, yaw: 0.06, pitch: -0.1, y: -0.03, fov: 64 },
  // down the aisle from the jukebox end: the stools' row and the booths
  { x: -12.9, z: -4.6, yaw: Math.PI, pitch: -0.06, y: 0.15, fov: 58 },
  // the booth of the couple, from the aisle
  { x: -13.1, z: 3.2, yaw: -2.05, pitch: -0.1, y: 0.15, fov: 56 },
  // Dot at the back bar and the cook in his hatch, from the aisle
  { x: -12.6, z: 5.5, yaw: 1.32, pitch: -0.04, y: 0.15, fov: 60 },
];
function stageCastDiner(stage, camera, controller) {
  seatDinerCast(stage);
  const v = DINER_VIEWS[parseInt(Q().get('cview') || '0', 10)] || DINER_VIEWS[0];
  camera.fov = v.fov; camera.updateProjectionMatrix();
  controller.setPose(v.x, v.z, v.yaw, v.pitch, v.y);
}

export const presets = {
  caststudy: { x: -2.2, z: -13.3, y: -0.03, yaw: 0, pitch: -0.1, fov: 50, t: 4.3, stage: stageCastStudy },
  castlab: { x: -2.2, z: -13.3, y: -0.03, yaw: 0, pitch: -0.12, fov: 50, t: 4.3, stage: stageCastLab },
  castdiner: { x: -12.2, z: -0.6, y: 0.15, yaw: 0.75, pitch: -0.05, fov: 62, t: 4.3, stage: stageCastDiner },
};

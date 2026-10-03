import * as THREE from 'three';
import { buildProp } from '../../props/index.js';
import { HAND_CLIPS } from '../../player/Hands.js';
import { homburgGeometry, makeCigar } from '../../cast/kinds/cardinal.js';
import { allocInkId } from '../../render/layers.js';
import { accentMaterial } from '../../render/accents.js';
import { Cabin } from '../../vehicles/cabin.js';

// Lane C9: the stills' pictures (docs/story/briefs/C9_STILLS.md). One preset
// per panel, shot=still_<id>_<n>: a small tableau staged for the purpose and
// rendered through the game's own ink pipeline. tools/stills.sh renders each
// at its panel's aspect and writes public/stills/<id>_<n>.jpg.
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const q = () => new URLSearchParams(location.search);

// the eye: at (x, y, z) looking at (tx, ty, tz), lens fov (the controller's
// pose: feet x, z, the ground under the eye at y - 1.65)
function look(controller, camera, [x, y, z], [tx, ty, tz], fov) {
  const dx = tx - x, dy = ty - y, dz = tz - z;
  const yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(dy, Math.hypot(dx, dz));
  camera.fov = fov; camera.updateProjectionMatrix();
  controller.setPose(x, z, yaw, pitch, y - 1.65);
}
// a prop placed in the stage
function place(stage, kind, at, { yaw = 0, rx = 0, rz = 0, variant = null, scale = 1 } = {}) {
  const p = buildProp(kind, { variant });
  p.position.copy(at);
  p.rotation.set(rx, yaw, rz, 'YXZ');
  p.scale.setScalar(scale);
  stage.scene.add(p);
  return p;
}
// a hard light: a spot lamp of the stage's pool (its cone seen or not)
function spot(stage, from, to, { half = 0.3, intensity = 60, cone = true, strength = 0.6, shadow = null, distance = null } = {}) {
  const ax = to.clone().sub(from).normalize();
  const L = stage.lamps.addCustom({ head: from.clone(), axis: ax, height: from.distanceTo(to) * 1.2, half, real: true, strength, tag: 'still' });
  Object.assign(L.light, { intensity, angle: half, penumbra: 0.35, distance: distance ?? from.distanceTo(to) * 3 });
  L.cone.visible = cone;
  L.priority = 10;
  if (shadow) L.shadow = shadow;
  return L;
}

// ---- 1. opening: A TIP. AMES. --------------------------------------------------------------
// a desk lamp of the props, its light the pool's: from its bulb along its shade
function deskLamp(S, at, yaw, { intensity = 30, half = 0.62, strength = 0.55, cone = true, reach = 1.2, target = null } = {}) {
  if (target) yaw = Math.atan2(target.x - at.x, target.z - at.z);
  const p = place(S, 'deskLamp', at, { yaw });
  p.updateMatrixWorld(true);
  const head = p.userData.head.clone().applyMatrix4(p.matrixWorld);
  const ax = target ? target.clone().sub(head).normalize() : p.userData.axis.clone().transformDirection(p.matrixWorld);
  const L = spot(S, head, head.clone().addScaledVector(ax, reach), { half, intensity, strength, cone, shadow: { radius: 2.5, near: 0.03 } });
  return { prop: p, lamp: L };
}
// the hands: the bare set, a held pose of clips/c9.js
function hands(game, clip) {
  const H = game.player.hands;
  // (look development: hp=x,y,z hu=x,y,z hf=x,y,z move the held thing in the eye's frame)
  const c = HAND_CLIPS[clip], Q = q();
  if (Q.get('hp') || Q.get('hu') || Q.get('hf')) {
    for (const side of ['R', 'L']) for (const k of c.keys[side] || []) {
      const a = k[1].at;
      if (!a) continue;
      if (Q.get('hp')) a.p = Q.get('hp').split(',').map(Number);
      if (Q.get('hu')) a.up = Q.get('hu').split(',').map(Number);
      if (Q.get('hf')) a.fwd = Q.get('hf').split(',').map(Number);
    }
  }
  H.equip('empty');
  H.play(clip);
  game.setViewmodelVisible(true);
}

// once the hands have settled (late in the fast-forward): fn() once
function late(game, fn, at = 0.9) {
  let done = false;
  game.scripts.push((t) => { if (!done && t >= at) { done = true; fn(); } });
}
// a cord hanging from a point to a point (a cloth-covered phone cord: black)
function cordBetween(S, a, b, sag = 0.25, r = 0.0045) {
  const mid = a.clone().lerp(b, 0.5); mid.y -= sag;
  const pts = [a, a.clone().lerp(mid, 0.5).add(V(0, -sag * 0.25, 0)), mid, mid.clone().lerp(b, 0.5).add(V(0, -sag * 0.1, 0)), b];
  const curve = new THREE.CatmullRomCurve3(pts);
  const geo = new THREE.TubeGeometry(curve, 64, r, 8, false);
  const m = new THREE.Mesh(geo, S.studio.mats.bakelite);
  m.userData.inkId = S.studio.kit.piece();
  S.scene.add(m);
  return m;
}

function tip(stage, camera, controller, game) {
  game.enterStage('studio');
  const S = game.stage, D = S.studio.SET.desk;
  const top = D.top;
  // the lamp on the left of the desk, its cone down onto the blotter
  deskLamp(S, V(-0.5, top, D.z - 0.05), 0.85, { intensity: 8, half: 0.45, reach: 0.9, strength: 0.9 });
  const base = place(S, 'deskPhone', V(-0.05, top, D.z + 0.12), { yaw: -0.25, variant: 'empty' });
  look(controller, camera, [0.1, top + 0.52, D.z + 0.8], [-0.02, top + 0.3, D.z - 0.6], 56);
  hands(game, 'c9tip');
  // the cord from the handset in my hand down to the base on the desk
  late(game, () => {
    const H = game.player.hands, hs = H.held.R;
    if (!hs) return;
    H.vm.root.updateMatrixWorld(true);
    const a = H.toWorld(V(0, -0.006, 0.118).applyMatrix4(hs.matrixWorld));
    cordBetween(S, a, base.position.clone().add(V(-0.06, 0.03, -0.09)), 0.3);
  });
}

// a man of the crew, a still figure (no brain): x, z, facing yaw (0 = +z)
function man(game, x, z, yaw, variant = { coat: 1, brim: 1, tall: 1 }) {
  return game.cast.spawn('hood', { at: { x, z }, yaw, brain: 'none', variant });
}

// ---- 1b. opening: HIS MEN. MY DINER. --------------------------------------------------------
// The diner's door from the pavement, open, the room's light in it: two of
// them black at the door, the third in it, and her small in the light
// between them, the one white shape.
function men(stage, camera, controller, game) {
  const S = game.stage, F = S.dinerFront;
  F.door.open();
  const dz = 0.6;
  man(game, -9.0, dz - 0.62, -Math.PI / 2 + 0.15, { coat: 1, brim: 1, tall: 1 });
  man(game, -9.05, dz + 0.68, -Math.PI / 2 - 0.12, { coat: 0, brim: 1, tall: 1 });
  man(game, -11.2, dz + 0.42, -Math.PI / 2 - 0.3, { coat: 2, brim: 0, tall: 1 });
  game.cast.spawn('waitress', { at: { x: -12.5, z: dz - 0.12 }, yaw: Math.PI / 2 - 0.35 });
  look(controller, camera, [-6.0, 1.1, dz + 0.05], [-10.6, 1.62, dz + 0.1], 40);
  game.setViewmodelVisible(false);
}

// ---- 2. ames: AMES. MARKED. ---------------------------------------------------------------
// Ames's card in my wet fingers under the street lamp by the diner's door
// (lane C4's prop and its hold, player/clips/c4.js c4readCard)
function ames(stage, camera, controller, game) {
  look(controller, camera, [-7.7, 1.62, -0.4], [-8.75, 2.45, -2.4], 56);
  const H = game.player.hands;
  // (gloved: black wet leather, as on the wheel - the card the one white)
  H.equip('empty', { skin: 'glove' });
  H.play('c4readCard');
  game.setViewmodelVisible(true);
}

// ---- 3a. check: DOT'S HAND. ----------------------------------------------------------------
// The torn check whole on the desk under the lamp, close: her pencil
function check(stage, camera, controller, game) {
  game.enterStage('studio');
  const S = game.stage, D = S.studio.SET.desk, top = D.top;
  deskLamp(S, V(-0.36, top, D.z - 0.3), 0, { intensity: 3.5, half: 0.26, reach: 0.8, strength: 0.4, target: V(-0.02, top, D.z + 0.06) });
  const c = place(S, 'guestCheck', V(-0.02, top + 0.004, D.z + 0.06), { yaw: 0.12, variant: 'pier9' });
  tear(c, S.studio.rng);
  look(controller, camera, [0.02, top + 0.34, D.z + 0.2], [-0.01, top, D.z + 0.04], 34);
  game.setViewmodelVisible(false);
}

// the check torn in three and put back together: the tears drawn on its
// face (a dark gap, the paper's fibres white along both lips)
function tear(prop, rng) {
  const cv = prop.userData.canvas, g = cv.getContext('2d'), W = cv.width, H = cv.height;
  const line = (pts) => {
    const jag = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      const n = 14;
      for (let k = 0; k < n; k++) { const u = k / n; jag.push([ax + (bx - ax) * u + rng.range(-5, 5), ay + (by - ay) * u + rng.range(-6, 6)]); }
    }
    jag.push(pts[pts.length - 1]);
    const path = () => { g.beginPath(); jag.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); };
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.strokeStyle = 'rgba(245,242,232,0.95)'; g.lineWidth = 11; path(); g.stroke();
    g.strokeStyle = 'rgba(10,10,10,0.95)'; g.lineWidth = 4; path(); g.stroke();
  };
  line([[-10, H * 0.46], [W * 0.35, H * 0.445], [W * 0.62, H * 0.47], [W + 10, H * 0.455]]);
  line([[W * 0.57, H * 0.465], [W * 0.6, H * 0.7], [W * 0.52, H * 0.86], [W * 0.58, H + 10]]);
  prop.traverse((o) => { if (o.isMesh && o.material && o.material.map) o.material.map.needsUpdate = true; });
}

// ---- 3b. check: SHE SENT HIM TO THEM. -------------------------------------------------------
// Her shape behind the counter, the back bar's light behind her, the face lost
function her(stage, camera, controller, game) {
  const d = game.stage.diner;
  game.cast.spawn('waitress', { at: { x: -15.45, z: 2.2 }, yaw: Math.PI / 2 });
  if (d && d.lamps) for (const L of d.lamps) L.on = false;
  place(game.stage, 'coffeePot', V(-14.72, 1.2, 2.72), { yaw: 0.6 });
  look(controller, camera, [-13.55, 1.32, 2.4], [-15.6, 1.68, 2.25], 40);
  game.setViewmodelVisible(false);
}

// ---- 4. photo: NOT HIS GIRL. HIS NEXT. ------------------------------------------------------
// Her photograph on his desk under his lamp, crossed through in red
function photo(stage, camera, controller, game) {
  game.enterStage('studio');
  const S = game.stage, D = S.studio.SET.desk, top = D.top;
  deskLamp(S, V(-0.3, top, D.z - 0.3), 0, { intensity: 3.5, half: 0.26, reach: 0.8, strength: 0.6, target: V(0, top, D.z + 0.08) });
  place(S, 'dotPhoto', V(0.0, top + 0.004, D.z + 0.08), { yaw: -0.14 });
  look(controller, camera, [0.04, top + 0.3, D.z + 0.3], [-0.005, top, D.z + 0.06], 36);
  game.setViewmodelVisible(false);
}

// ---- 6. end: (no words) --------------------------------------------------------------------
// His homburg in the wet street, the cigar's ember beside it
function end(stage, camera, controller, game) {
  const S = game.stage;
  const hat = new THREE.Mesh(homburgGeometry(1.12), new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.55 }));
  hat.userData.inkId = allocInkId();
  hat.position.set(-1.95, 0.02, -18.45);
  hat.rotation.set(0.2, 0.9, 0.12);
  hat.castShadow = true;
  S.scene.add(hat);
  const cig = makeCigar({ inkId: allocInkId() });
  cig.position.set(-1.38, 0.012, -17.92);
  cig.rotation.set(0, -0.9, 0);
  cig.scale.setScalar(1.25);
  S.scene.add(cig);
  look(controller, camera, [-1.55, 0.15, -17.2], [-1.6, 0.42, -30], 40);
  game.setViewmodelVisible(false);
}

// ---- the diner's neon in the city (its tube and its letters as the
// block's sign, stages/block/parts/dinerFront.js: the same word, the same
// glass) on a dark board: `at` its middle, facing `n` (a unit xz vector)
const arc = (cx, cy, rx, ry, a0, a1, n = 18) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)]; });
const GLYPH = {
  D: { w: 0.78, strokes: [[[0, 0], [0, 1], [0.34, 1], ...arc(0.34, 0.5, 0.44, 0.5, Math.PI / 2, -Math.PI / 2).slice(1, -1), [0.34, 0], [0, 0]]] },
  I: { w: 0.0, strokes: [[[0, 0], [0, 1]]] },
  N: { w: 0.74, strokes: [[[0, 0], [0, 1], [0.74, 0], [0.74, 1]]] },
  E: { w: 0.62, strokes: [[[0.62, 1], [0, 1], [0, 0], [0.62, 0]], [[0, 0.52], [0.46, 0.52]]] },
  R: { w: 0.7, strokes: [[[0, 0], [0, 1], [0.36, 1], ...arc(0.36, 0.745, 0.3, 0.255, Math.PI / 2, -Math.PI / 2).slice(1, -1), [0.36, 0.49], [0, 0.49]], [[0.3, 0.49], [0.7, 0]]] },
};
function neonSign(S, at, n, { H = 0.55, tube = 0.009, board = true } = {}) {
  const word = 'DINER', track = 0.42 * H / 0.55;
  const total = [...word].reduce((s, ch) => s + GLYPH[ch].w * H, 0) + track * (word.length - 1);
  // (the word read from the front: its right along n x up)
  const right = V(-n.z, 0, n.x).multiplyScalar(-1);
  const P = (u, v) => at.clone().addScaledVector(right, u - total / 2).add(V(0, v - H / 2, 0)).addScaledVector(n, 0.07);
  const mat = accentMaterial('neon', { tube });
  const id = allocInkId();
  const tubes = [];
  let u0 = 0;
  for (const ch of word) {
    const gl = GLYPH[ch];
    for (const st of gl.strokes) {
      const pts = st.map(([u, v]) => P(u0 + u * H, v * H));
      tubes.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.2), pts.length * 6, tube, 10, false));
    }
    u0 += gl.w * H + track;
  }
  tubes.push(new THREE.TubeGeometry(new THREE.LineCurve3(P(-0.05, -0.1), P(total + 0.05, -0.1)), 32, tube, 10, false));
  for (const geo of tubes) { const m = new THREE.Mesh(geo, mat); m.userData.inkId = id; m.userData.noRay = true; S.scene.add(m); }
  if (board) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(total + 0.5, H + 0.55, 0.12), new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.6 }));
    b.position.copy(at).add(V(0, -0.05, 0));
    b.lookAt(at.clone().add(n));
    b.userData.inkId = allocInkId();
    S.scene.add(b);
  }
}

// my coupe in the city, the eye in its seat or over its bonnet (the tail's
// cabin: vehicles/cabin.js - the wipers, the rain on the glass, the hands on
// the wheel); heading -z down EL AVE
function coupe(game, x, z) {
  game.enterStage('city');
  const car = game.vehicles.spawn('coupe', { at: { x, z }, yaw: Math.PI / 2, lights: true });
  game.vehicles.setPlayer(car);
  return car;
}

// ---- 1c. opening: (no words) ----------------------------------------------------------------
// The diner's neon through my wet windscreen, the wiper's arc, my knuckles on the wheel
function neon(stage, camera, controller, game) {
  const car = coupe(game, -96.2, 34);
  const S = game.stage;
  neonSign(S, V(-95.3, 2.75, 19), V(0, 0, 1), { H: 0.9 });
  const cab = new Cabin(game);
  cab.attach(car, { pitch: -0.13, fov: 40 });
  game.scripts.push((t, dt) => { cab.step(dt); cab.screen.mat.uniforms.uRain.value = 1; cab.screen.mat.uniforms.uLit.value = 0.9; });
}

// ---- 5. diner: THE DINER. ------------------------------------------------------------------
// My headlamps on the wet avenue, the el above, the diner's neon small and far
function avenue(stage, camera, controller, game) {
  coupe(game, -91.6, -90);
  const S = game.stage;
  neonSign(S, V(-89.6, 3.0, -150), V(0, 0, 1), { H: 0.9 });
  look(controller, camera, [-91.6, 1.48, -90.5], [-91.1, 2.0, -124], 48);
  game.setViewmodelVisible(false);
}

export const presets = {
  still_opening_1: { t: 1, fov: 54, stage: tip },
  still_opening_2: { t: 1.5, fov: 46, stage: men },
  still_ames_1: { t: 1.6, fov: 50, stage: ames },
  still_check_1: { t: 1, fov: 34, stage: check },
  still_check_2: { t: 1.5, fov: 44, stage: her },
  still_photo_1: { t: 1, fov: 34, stage: photo },
  still_end_1: { t: 2, fov: 40, stage: end },
  still_opening_3: { t: 2.6, fov: 40, stage: neon },
  still_diner_1: { t: 2, fov: 50, stage: avenue },
};

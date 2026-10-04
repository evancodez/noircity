import * as THREE from 'three';
import { buildProp } from '../../props/index.js';
import { homburgGeometry, makeCigar } from '../../cast/kinds/cardinal.js';
import { allocInkId, LAYER } from '../../render/layers.js';
import { accentMaterial } from '../../render/accents.js';
import { Cabin } from '../../vehicles/cabin.js';
import { HAND_CLIPS } from '../../player/Hands.js';
import { wrap } from '../../player/handPoses.js';

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
function spot(stage, from, to, { half = 0.3, intensity = 60, cone = true, strength = 0.6, shadow = null, distance = null, penumbra = 0.35 } = {}) {
  const ax = to.clone().sub(from).normalize();
  const L = stage.lamps.addCustom({ head: from.clone(), axis: ax, height: from.distanceTo(to) * 1.2, half, real: true, strength, tag: 'still' });
  Object.assign(L.light, { intensity, angle: half, penumbra, distance: distance ?? from.distanceTo(to) * 3 });
  L.cone.visible = cone;
  L.priority = 10;
  if (shadow) L.shadow = shadow;
  return L;
}

// ---- 1. opening: A TIP. AMES. --------------------------------------------------------------
// a desk lamp of the props, its light the pool's: from its bulb along its shade
function deskLamp(S, at, yaw, { intensity = 30, half = 0.62, strength = 0.55, cone = true, reach = 1.2, target = null, penumbra = 0.35 } = {}) {
  if (target) yaw = Math.atan2(target.x - at.x, target.z - at.z);
  const p = place(S, 'deskLamp', at, { yaw });
  p.updateMatrixWorld(true);
  const head = p.userData.head.clone().applyMatrix4(p.matrixWorld);
  const ax = target ? target.clone().sub(head).normalize() : p.userData.axis.clone().transformDirection(p.matrixWorld);
  const L = spot(S, head, head.clone().addScaledVector(ax, reach), { half, intensity, strength, cone, penumbra, shadow: { radius: 2.5, near: 0.03 } });
  return { prop: p, lamp: L };
}
// a coiled cord lying along a path (points on the desk): a helix round it
function coiledCord(S, pts, { r = 0.0075, wire = 0.0026, turns = 70 } = {}) {
  const path = new THREE.CatmullRomCurve3(pts);
  const N = turns * 10, out = [];
  const up = V(0, 1, 0);
  for (let i = 0; i <= N; i++) {
    const u = i / N, p = path.getPointAt(u), tg = path.getTangentAt(u);
    const side = tg.clone().cross(up).normalize(), lift = side.clone().cross(tg).normalize();
    const a = u * turns * Math.PI * 2;
    out.push(p.clone().addScaledVector(side, Math.cos(a) * r).addScaledVector(lift, Math.sin(a) * r + r));
  }
  const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(out), N, wire, 5, false);
  const m = new THREE.Mesh(geo, S.studio.mats.bakelite);
  m.userData.inkId = S.studio.kit.piece();
  S.scene.add(m);
  return m;
}

// [C9 after the critic] The receiver off its cradle, lying on the desk in
// the lamp's cone, its cord coiled back to the phone: the shape every
// player knows, no hand (the rig's hand printed blocky and took a third of
// the panel; held upright the handset read as a torch). Seen from above:
// only from there does its profile read (low, it was a black bar); the
// window and its rain are out of this frame (they are in the next two).
// ([C11, after the critic] now the receiver is in my hand, up off the
// cradle over the pool, and the window's rain runs across the top: WAVE_C
// 5's picture - a receiver in a hand, the lamp, rain on the glass. ?hand=0
// gives the old frame, the handset on the desk.)
function tip(stage, camera, controller, game) {
  game.enterStage('studio');
  const S = game.stage, D = S.studio.SET.desk;
  const top = D.top;
  const Q = q(), N = (k, d) => (Q.get(k) != null ? Number(Q.get(k)) : d);
  const hs = V(N('hx', -0.05), top + 0.029, D.z + N('hz', 0.1));
  // the lamp on the left of the desk, its cone down onto the desk behind the
  // handset (the handset's shape black against the pool) and the phone
  const pool = V(N('px', -0.04), top, D.z + N('pz', 0.1));
  // ([C11] a hard pool: 6 -> 26, its edge 0.35 -> 0.08 - the art director
  // read the pool mid-grey; paper white now, ink round it)
  deskLamp(S, V(N('lx', -0.42), top, D.z + N('lz', -0.12)), 0, { intensity: N('li', 26), half: N('lh', 0.3), reach: 0.6, strength: 0.8, target: pool, penumbra: N('lp', 0.08) });
  const base = place(S, 'deskPhone', V(N('bx', 0.17), top, D.z + N('bz', -0.07)), { yaw: N('by', 0.3), variant: 'empty' });
  // (the dome's gloss a little duller: the lamp's spot on it was the brightest thing in the panel)
  base.traverse((o) => { if (o.isMesh && o.material && o.material.roughness != null) { o.material = o.material.clone(); o.material.roughness = Math.max(o.material.roughness, N('br', 0.55)); } });
  // [C11, after the critic] the receiver in my hand (WAVE_C 5: a telephone
  // receiver in a hand, the lamp's cone): the right hand has it up off the
  // empty cradle, over the white pool - the hand and the handset one ink
  // shape on the white, the lamp's rim along the knuckles and the bar, its
  // cord falling away out of the frame. (It lay on the desk: a first-timer
  // read "the phone off the hook", not "a call".) The hand is the player's
  // own rig, as in play (the Ames card's still): a hold of the handset, its
  // bar across the palm, the cups away from it.
  if (N('hand', 1) > 0) {
    const H = game.player.hands;
    H.equip('empty');
    const hset = buildProp('handset');
    hset.traverse((o) => { if (o.isMesh && o.material && o.material.roughness != null) { o.material = o.material.clone(); o.material.roughness = 0.8; if (o.material.envMapIntensity != null) o.material.envMapIntensity = 0.05; } });
    // (the cord: a coil from the mouth cup, falling away beyond it)
    {
      const pts = [];
      const n = 900, turns = 30;
      for (let i = 0; i <= n; i++) {
        const u = i / n, a = u * turns * Math.PI * 2;
        const c = V(0, -0.015 - 0.25 * u * u, 0.1 + 0.32 * u);
        pts.push(c.add(V(Math.cos(a) * 0.0075, Math.sin(a) * 0.0075, 0)));
      }
      const cord = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n, 0.0026, 5, false), hset.children.find((o) => o.isMesh)?.material || S.studio.mats.bakelite);
      hset.add(cord);
    }
    // the hold: the bar across the palm (the handset's z along the hand's x,
    // its back, +y, in the palm), the bar's middle where the fingers close
    // (the hand's default socket undone: Hands.poseForProp)
    const Bm = new THREE.Matrix4().makeBasis(V(0, 0, -1), V(0, 1, 0), V(1, 0, 0));
    const T = new THREE.Matrix4().makeTranslation(N('gx', 0.0), N('gy', -0.03), N('gz', -0.068)).multiply(Bm).multiply(new THREE.Matrix4().makeTranslation(0, -0.008, 0));
    const Sk = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0, 0, Math.PI / 2)).setPosition(0, -0.035, -0.055);
    hset.userData.grip = T.clone().invert().multiply(Sk);
    H.hold(hset, 'R');
    const key = { o: 'handset', at: { frame: 'cam', p: [N('hpx', 0.06), N('hpy', -0.075), N('hpz', -0.5)], up: [N('hux', 0.1), N('huy', 0.25), N('huz', 1)], fwd: [N('hfx', 1), N('hfy', -0.2), N('hfz', 0.15)] }, F: { ...wrap(0.017), t: [N('t0', 0.9), N('t1', 0.4), N('t2', 0.6), N('t3', 0.3), N('t4', 0.3)] }, e: [N('hex', 0.3), N('hey', -0.35), N('hez', 0.05)], ef: 'cam' };
    HAND_CLIPS.c11phoneR = { duration: 0.4, hold: true, blocking: false, marks: {}, keys: { R: [[0, key], [0.4, key]] }, brush: 'R' };
    H.play('c11phoneR');
    game.setViewmodelVisible(true);
  } else {
    // the handset across the desk on its side (its profile up to the eye:
    // the bar and the two cups), the ear cup to the left
    const yw = Math.PI / 2 + N('hy', 0.3);
    const hset = place(S, 'handset', hs, { yaw: yw, rz: N('hr', Math.PI / 2) });
    hset.traverse((o) => { if (o.isMesh && o.material && o.material.roughness != null) { o.material = o.material.clone(); o.material.roughness = N('hm', 0.9); if (o.material.envMapIntensity != null) o.material.envMapIntensity = 0.05; o.material.color.multiplyScalar(0.6); } });
    const ax = V(Math.sin(yw), 0, Math.cos(yw));
    const m = hs.clone().addScaledVector(ax, 0.1); m.y = top;
    const b = base.position.clone().add(V(0.07, 0, 0.06)); b.y = top;
    coiledCord(S, [m, m.clone().add(V(0.05, 0, -0.03)), V(0.12, top, D.z + 0.12), V(0.27, top, D.z + 0.1), b]);
  }
  // ([C11, after the critic] with the hand the eye lifts a little: the
  // window's foot and its rain runs across the top of the frame, the lamp's
  // shade in its corner)
  const hand = N('hand', 1) > 0;
  look(controller, camera, [N('ex', 0.02), top + N('ey', hand ? 0.45 : 0.5), D.z + N('ez', hand ? 0.55 : 0.44)], [0.0, top + N('ty', hand ? 0.06 : 0.0), D.z + N('tz', hand ? -0.17 : 0.04)], N('fv', 42));
  if (!hand) game.setViewmodelVisible(false);
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
  // [C9 after the critic] the eye a little higher, so the hats' crowns stand
  // against the room's light (they sank into the black over the door:
  // "three hats" read as three coats), and the street number over the door
  // dimmed (it pulled the eye first)
  const Q = q(), N = (k, d) => (Q.get(k) != null ? Number(Q.get(k)) : d);
  F.group.traverse((o) => {
    const m = o.isMesh && o.material, im = m && m.map && m.map.image;
    if (im && im.width === 256 && im.height === 128 && m.metalness === 0.2) { o.material = m.clone(); o.material.color.setScalar(N('nd', 0.3)); }
  });
  look(controller, camera, [-6.0, N('ey', 1.5), dz + 0.05], [-10.6, N('ty', 1.7), dz + 0.1], N('fv', 40));
  game.setViewmodelVisible(false);
}

// ---- 2. ames: AMES. MARKED. ---------------------------------------------------------------
// Ames's card in my wet fingers under the street lamp by the diner's door
// (lane C4's prop and its hold, player/clips/c4.js c4readCard)
// [C9 after the critic] the bare hand, as in play (a black glove read as
// another man's), and a frame play cannot give: low and close, looking down
// past the card at the wet black pavement, only the thumb and the
// fingertips in, the card the one light
function ames(stage, camera, controller, game) {
  const Q = q(), N = (k, d) => (Q.get(k) != null ? Number(Q.get(k)) : d);
  look(controller, camera, [N('ex', -7.7), N('ey', 1.4), N('ez', -0.4)], [N('tx', -8.4), N('ty', 0.3), N('tz', -1.6)], N('fv', 56));
  const H = game.player.hands;
  H.equip('empty');
  H.play('c4readCard');
  game.setViewmodelVisible(true);
  if (N('dk', 1) > 0) darkStreet(game.stage, (l) => N('keep', 0) > 0 && l.sconce);
  // the frame: a part of the eye's view, round the card (the hold puts it
  // left of the middle, the hand to its right): k times closer, the right
  // edge just past the fingertips
  const k = N('k', 1.8), cu = N('cu', 0.33), cv = N('cv', 0.6);
  for (const c of [camera, H.vm.cam]) c.setViewOffset(1, 1, cu - 0.5 / k, cv - 0.5 / k, 1 / k, 1 / k);
}

// ---- 3a. check: DOT'S HAND. ----------------------------------------------------------------
// The torn check whole on the desk under the lamp, close: her pencil
function check(stage, camera, controller, game) {
  game.enterStage('studio');
  const S = game.stage, D = S.studio.SET.desk, top = D.top;
  deskLamp(S, V(-0.36, top, D.z - 0.3), 0, { intensity: 3.5, half: 0.26, reach: 0.8, strength: 0.4, target: V(-0.02, top, D.z + 0.06) });
  const c = place(S, 'guestCheck', V(-0.02, top + 0.004, D.z + 0.06), { yaw: 0.12, variant: 'pier9' });
  tear(c);
  look(controller, camera, [0.02, top + 0.34, D.z + 0.2], [-0.01, top, D.z + 0.04], 34);
  game.setViewmodelVisible(false);
}

// the check torn and put back together as lane C5's puzzle tears it
// (wave-c/C5-office src/scenes/office/check.js: seven pieces - three tears
// across, under the head and between the words, at 31 / 51.5 / 69.5 % from
// the top, and one down through each of the top three bands; the same
// fixed curves, copied here: that file is not on this branch): the tears
// drawn on its face (a dark gap, the paper's fibres white along both lips).
// [C9 after the critic: the still's check was torn in three, not as the
// player had just pieced it]
const C5 = { w: 0.085, d: 0.14 };
const c5jag = (t, seed, amp) => amp * (0.55 * Math.sin(t * 61 + seed) + 0.3 * Math.sin(t * 173 + seed * 2.3) + 0.15 * Math.sin(t * 419 + seed * 5.1));
const C5HY = [0.31, 0.515, 0.695].map((f) => C5.d / 2 - f * C5.d);
const c5h = (k) => (x) => C5HY[k] + c5jag(x, 1.3 + k * 2.1, 0.0026) + (k % 2 ? 0.05 : -0.04) * x;
const C5VX = [0.012, -0.004, 0.009];
const c5v = (r) => (y) => C5VX[r] + c5jag(y, 3.1 + r * 2.2, 0.0024) + (r % 2 ? -0.12 : 0.1) * (y - (r === 0 ? 0.045 : C5HY[r]));
function c5meet(h, v) { let y = h(0); for (let i = 0; i < 10; i++) y = h(v(y)); return y; }
function tear(prop) {
  const cv = prop.userData.canvas, g = cv.getContext('2d'), W = cv.width, H = cv.height;
  // the check's frame (x across, y up, metres from its middle) to the canvas
  const P = (x, y) => [(x + C5.w / 2) / C5.w * W, (C5.d / 2 - y) / C5.d * H];
  const line = (pts) => {
    const path = () => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(...P(x, y)) : g.moveTo(...P(x, y)))); };
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.strokeStyle = 'rgba(245,242,232,0.95)'; g.lineWidth = 13; path(); g.stroke();
    g.strokeStyle = 'rgba(10,10,10,0.95)'; g.lineWidth = 5; path(); g.stroke();
  };
  const n = 48, L = -C5.w / 2 - 0.002, R = C5.w / 2 + 0.002;
  for (let k = 0; k < 3; k++) { const h = c5h(k); line(Array.from({ length: n + 1 }, (_, i) => { const x = L + (R - L) * i / n; return [x, h(x)]; })); }
  for (let r = 0; r < 3; r++) {
    const v = c5v(r), yt = r === 0 ? C5.d / 2 + 0.002 : c5meet(c5h(r - 1), v), yb = c5meet(c5h(r), v);
    line(Array.from({ length: n + 1 }, (_, i) => { const y = yt + (yb - yt) * i / n; return [v(y), y]; }));
  }
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
  // [C9 after the critic] closer: the print half the frame, the pool tight
  // round it and the desk black past it (it was a quarter of the width on a
  // flat grey pool: "a crossed-out photo", slowly "of the waitress")
  const Q = q(), N = (k, d) => (Q.get(k) != null ? Number(Q.get(k)) : d);
  // ([C11, after the critic] as the room has it now (pier9 mezz.js): her
  // photograph on a felt blotter in a hard white pool, ink round it - the
  // still had a soft mid-grey pool and the light changed at the cut)
  deskLamp(S, V(-0.3, top, D.z - 0.3), 0, { intensity: N('li', 9), half: N('lh', 0.21), reach: 0.8, strength: 0.6, target: V(0, top, D.z + 0.08), penumbra: N('lp', 0.12) });
  {
    const felt = new THREE.MeshStandardMaterial({ color: 0x3c3c3c, roughness: 0.95, metalness: 0 });
    felt.userData.inkSurface = 'cloth';
    const bl = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.003, 0.42).translate(0.02, top + 0.0015, D.z + 0.06), felt);
    bl.userData.inkId = S.studio.kit.piece(); bl.receiveShadow = true;
    S.scene.add(bl);
  }
  place(S, 'dotPhoto', V(0.0, top + 0.004, D.z + 0.08), { yaw: -0.14 });
  look(controller, camera, [N('ex', 0.03), top + N('ey', 0.2), D.z + N('ez', 0.215)], [-0.005, top, D.z + N('tz', 0.08)], N('fv', 36));
  game.setViewmodelVisible(false);
}

// ---- 6. end: (no words) --------------------------------------------------------------------
// His homburg in the wet street, the cigar's ember beside it
// [C9 after the critic] close and low on the hat alone: the street's lamps
// out, one light behind it catching the brim's edge and the wet road, the
// ember small beside it, the exposure down so the avenue goes to black (the
// whole lit avenue, parked cars and six lamps - and one red tail lamp - stood
// behind a glossy hat)
function end(stage, camera, controller, game) {
  const S = game.stage;
  const Q = q(), N = (k, d) => (Q.get(k) != null ? Number(Q.get(k)) : d);
  darkStreet(S);
  const hat = new THREE.Mesh(homburgGeometry(1.12), new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: N('hr', 0.8) }));
  hat.userData.inkId = allocInkId();
  hat.position.set(-1.95, 0.02, -18.45);
  hat.rotation.set(0.2, 0.9, 0.12);
  hat.castShadow = true;
  S.scene.add(hat);
  const cig = makeCigar({ inkId: allocInkId() });
  cig.position.set(N('cx', -1.7), 0.012, N('cz', -18.2));
  cig.rotation.set(0, N('cr', -0.3), 0);
  cig.scale.setScalar(N('cs', 1.0));
  S.scene.add(cig);
  // (the ember kept out of the street's mirror: its reflection printed as a
  // second red speck up the road, and red is the crew's)
  if (N('er', 1) > 0) cig.userData.ember.layers.set(LAYER.FX);
  // the one light: behind the hat, low, toward the eye
  spot(S, V(N('lx', -2.2), N('ly', 1.4), N('lz', -20.4)), V(-1.95, 0.1, -18.3), { half: N('lh', 0.45), intensity: N('li', 80), cone: N('lc', 1) > 0, strength: 0.7 });
  look(controller, camera, [N('ex', -1.5), N('ey', 0.3), N('ez', -17.2)], [N('tx', -2.15), N('ty', 0.06), N('tz', -18.6)], N('fv', 30));
  game.setViewmodelVisible(false);
  game.pipeline.exposureOverride = N('xp', 0.32);
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
function coupe(game, x, z, lights = true, yaw = 0) {
  game.enterStage('city');
  const car = game.vehicles.spawn('coupe', { at: { x, z }, yaw: Math.PI / 2 + yaw, lights });
  game.vehicles.setPlayer(car);
  return car;
}

// ---- 1c. opening: (no words) ----------------------------------------------------------------
// The diner's neon through my wet windscreen, the wiper's arc, my knuckles on the wheel
// [C9 after the critic] the street's lamps out: the cabin a black
// silhouette (the wheel's rim, the wiper, the pillars) and the one light the
// neon, bleeding through the wet glass (every lamp, pillar and brush stroke
// lit, the strip was the busiest of the nine)
function darkStreet(S, keep = () => false) {
  if (S.lamps && S.lamps.lamps) for (const l of S.lamps.lamps) if (!keep(l)) l.on = false;
}
function neon(stage, camera, controller, game) {
  const Q = q(), N = (k, d) => (Q.get(k) != null ? Number(Q.get(k)) : d);
  const car = coupe(game, N('cx', -96.2), 34, N('hl', 0) > 0, N('cy', 0.02));
  const S = game.stage;
  darkStreet(S);
  neonSign(S, V(-95.3, N('ny', 2.75), N('nz', 19)), V(0, 0, 1), { H: N('nh', 0.9) });
  const cab = new Cabin(game);
  // ([C11] lower and a little wider, -0.1 / 32 -> -0.17 / 44: my knuckles
  // on the wheel in the frame's foot, the sign still at its head)
  cab.attach(car, { pitch: N('pp', -0.17), fov: N('fv', 44) });
  // (the chrome inside dulled: the mirror's glass printed as a pale card)
  if (N('dc', 1) > 0) car.body.traverse((o) => {
    const m = o.isMesh && o.material;
    if (m && !Array.isArray(m) && m.metalness > 0.5) { o.material = m.clone(); o.material.envMapIntensity = 0.05; o.material.color.multiplyScalar(0.3); }
  });
  // ([C11] the art director: too dark - the neon lights the drops on the
  // glass (their flecks white, the wiper's arc the clear sweep through
  // them: uLit 0.45 -> 1.3) and a light from the sign falls through the
  // glass on the bonnet, the wiper and my knuckles on the wheel (their rim);
  // the exposure a step up, 0.6 -> 0.72)
  // ([C11, after the critic] the sign's light 420 -> 260 and the drops'
  // lift 1.3 -> 0.8: the glass under DINER printed a hard pale rectangle
  // between the pillars and the drops a static of white specks; now the
  // glow fades off the sign and the drops are fewer, the brighter ones lit)
  spot(S, V(-95.4, N('sy', 2.4), 19.4), V(N('sx', -96.3), 1.0, 33.4), { half: N('sh', 0.16), intensity: N('si', 260), cone: false, strength: 0.9, distance: 30, penumbra: 0.5 });
  game.scripts.push((t, dt) => { cab.step(dt); cab.screen.mat.uniforms.uRain.value = 1; cab.screen.mat.uniforms.uLit.value = N('ul', 0.8); });
  game.pipeline.exposureOverride = N('xp', 0.72);
}

// ---- 5. diner: THE DINER. ------------------------------------------------------------------
// My headlamps on the wet avenue, the el above, the diner's neon small and far
// [C9 after the critic] the street's lamps out, low by my coupe's front
// wing: the headlamp close, its beam on the black wet road, the el's iron
// caught in it, the neon small at the end of the light (the bonnet camera
// over a lit avenue was the tail's own view: mid-grey, five lamps, nothing
// close)
function avenue(stage, camera, controller, game) {
  const Q = q(), N = (k, d) => (Q.get(k) != null ? Number(Q.get(k)) : d);
  coupe(game, -91.6, -90);
  const S = game.stage;
  darkStreet(S);
  neonSign(S, V(N('nx', -89.6), 3.0, N('nz', -150)), V(0, 0, 1), { H: 0.9 });
  look(controller, camera, [N('ex', -92.85), N('ey', 1.0), N('ez', -91.85)], [N('tx', -91.3), N('ty', 0.4), N('tz', -130)], N('fv', 44));
  game.setViewmodelVisible(false);
  // (the ink's exposure down: the fog and the sky behind the el print dark,
  // the beam and the neon stay the lights)
  game.pipeline.exposureOverride = N('xp', 0.4);
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

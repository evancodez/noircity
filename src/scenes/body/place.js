import * as THREE from 'three';
import { buildProp } from '../../props/index.js';
import { ALLEY } from '../../stages/block/parts/alley.js';
import { DINER } from '../../stages/block/site.js';
import { accentMaterial } from '../../render/accents.js';
import { LAYER, allocInkId, markFigure } from '../../render/layers.js';

// Scene 3's place and its evidence (lane B1): where Ames stood and where he
// lies, the two rounds' line from the fire escape through his chest into
// the brick, where everything of his lies, the car that pulls out, the hat
// in the gutter. (no default export: not a scene)
export const V = (x, y, z) => new THREE.Vector3(x, y, z);
export { ALLEY };

// the plane the line of fire lies in (x = XV: he stood square to the fire
// escape, the shooter straight across from him)
export const XV = -11.35;
// where he stood: his back 0.45 m off the south wall, facing the landing
export const STOOD = { x: XV, z: ALLEY.zS - 0.45 };
// the shooter's gun, over the landing's rail
export const SHOOTER = V(XV, 5.3, ALLEY.zN + 1.0);
// the two wounds, high and low in his chest (a hand apart, a little apart
// across him too)
export const WOUNDS = [V(XV + 0.05, 1.6, STOOD.z - 0.13), V(XV - 0.05, 1.36, STOOD.z - 0.125)];
// the two marks: the line from the gun through each wound, on into the
// brick of the south wall
export const MARKS = WOUNDS.map((w) => {
  const d = w.clone().sub(SHOOTER);
  const t = (ALLEY.zS - 0.012 - SHOOTER.z) / d.z;
  return SHOOTER.clone().addScaledVector(d, t);
});

// where he lies: his hips, his heading (a figure's: the model's -z, his
// head, goes to (-sin, -cos) of it... the head toward the wall, a little
// into the alley; the feet toward the gutter and the mouth)
export const LIES = { x: -11.2, z: -25.25, yaw: Math.PI - 0.3 };
// the kneel: on his right side, at the building line, facing into the alley
export const KNEEL = { x: -10.38, z: -24.82, yaw: 1.2, eyeY: ALLEY.y + 1.02 };
// the view the strings are worked from: out on the pavement's edge at the
// mouth, the plane of the line of fire face on
export const STUDY = (() => {
  // (south of the phone booth at the mouth, so it stands at the frame's edge)
  const cam = V(-8.05, ALLEY.y + 1.85, -24.95), look = V(XV, 2.95, -26.7);
  const d = look.clone().sub(cam);
  return { x: cam.x, y: cam.y, z: cam.z, yaw: Math.atan2(-d.x, -d.z), pitch: Math.atan2(d.y, Math.hypot(d.x, d.z)), fov: 60 };
})();

// where the scene begins: by Mack on the pavement (the window he went out
// of, from the save; B4 when entered cold), looking down to the alley lamp
export function mackLanding(game) {
  const w = (game.save && game.save.flags && game.save.flags.window) === 'B2' ? 'B2' : 'B4';
  const f = DINER.finish[w];
  // (scene 2 lays him with his hips 1.55 m out from his spot at the glass)
  return { w, x: f.x + 1.55, z: f.z };
}
export function startPose(game) {
  const L = mackLanding(game);
  const x = -8.15, z = L.z - 1.6;
  // (down the pavement to the alley's mouth, where the car comes out)
  const d = V(-9.4 - x, 1.1 - 1.8, -28.6 - z);
  return { x, z, yaw: Math.atan2(-d.x, -d.z), pitch: 0.03 };
}

// Mack as scene 2 left him: on his back on the pavement in the glass, out
// cold (his window gone). Only what a cold start needs; a play straight on
// from scene 2 finds the glass already out and the room as it stood.
export function mackOut(ctx) {
  const { stage, cast, game } = ctx;
  const L = mackLanding(game);
  const front = stage.part('dinerFront');
  const pane = front && front.panes ? front.panes[L.w] : null;
  if (pane && !pane.broken && pane.state !== 'gone') {
    try { stage.glass.shatter(pane, { dir: V(1, 0.15, 0), power: 2, by: 'body', at: V(DINER.faceX - 0.1, 1.5, DINER.finish[L.w].z) }); } catch (e) { /* no glass: fine */ }
  }
  if (front && front.openBay) try { front.openBay(L.w); } catch (e) { /* */ }
  if (!cast.has('brawler')) return null;
  const m = cast.spawn('brawler', { at: { x: L.x, z: L.z }, yaw: -Math.PI / 2 });
  // (his lying clip is scene 2's; a later fight may rename it: then he
  // lies in the Hood's settled death)
  try { m.setState('br_down', 0); } catch (e) { try { m.setState('deathBack', 0); } catch (e2) { /* */ } }
  m.down = true; m.state = 'ko'; m.base = 'ko';
  for (let i = 0; i < 30; i++) m.fig.update(1 / 60, 0);
  return m;
}

// Ames where he fell, and what fell with him
export function layVictim(ctx) {
  const { stage, cast, game } = ctx;
  const c = cast.spawn('victim', { at: { x: LIES.x, z: LIES.z }, yaw: LIES.yaw });
  c.down = true; c.state = 'dead';
  for (let i = 0; i < 4; i++) c.fig.update(1 / 60, 0);
  // he is not pushed, walked through or shot at: his circle goes, a box
  // round the length of him takes its place
  const C = stage.colliders;
  if (c.fig.collider) { const i = C.circles.indexOf(c.fig.collider); if (i >= 0) C.circles.splice(i, 1); }
  const box = C.addBox(LIES.x - Math.sin(LIES.yaw) * -0.05, LIES.z - Math.cos(LIES.yaw) * -0.05, 0.3, 0.95, LIES.yaw, 'body');
  ctx.flags.bodyBox = box;
  return c;
}

// the things round him: his spectacles cracked by his head, his shoe off
// by the drain, the blood under him running to the gutter, the rounds'
// marks in the brick; the torn half and the casings up on the landing
export function evidence(ctx) {
  const { stage, game } = ctx;
  const out = [];
  const put = (kind, pos, rot = [0, 0, 0], opts = {}) => {
    const p = buildProp(kind, opts);
    p.position.copy(pos); p.rotation.set(...rot, 'YXZ');
    p.traverse((o) => { if (o.isMesh) o.userData.noRay = true; });
    stage.scene.add(p);
    out.push(p);
    return p;
  };
  const ev = {};
  // the spectacles, flat on the flags a hand from his head, the glass up
  const head = V(LIES.x + Math.sin(LIES.yaw) * -0.78, ALLEY.y, LIES.z + Math.cos(LIES.yaw) * -0.78);
  ev.specs = put('spectacles', V(head.x + 0.28, ALLEY.y + 0.004, head.z - 0.12), [-Math.PI / 2 + 0.06, 0.7, 0]);
  ev.shoe = put('amesShoe', V(-10.75, ALLEY.y, -26.75), [0, 1.1, Math.PI / 2 - 0.1]);
  ev.shoe.position.y = ALLEY.y + 0.045;
  // up on the landing: the half, and the two brass cases
  const Ly = ALLEY.esc.y1 + 0.003;
  // (caught at the landing's outer edge under the rail, a corner of it out
  // over the alley: from below, where the lines cross, the red shows)
  ev.half = put('matchHalf', V(XV + 0.06, ALLEY.esc.y1 - 0.012, ALLEY.zN + ALLEY.esc.d + 0.045), [0.75, 0.15, 0]);
  ev.half.scale.setScalar(1.3);
  // (it glows a breath of its own red: the clue must show in the dark)
  ev.half.traverse((o) => { if (o.isMesh && o.material && o.material.userData && o.material.userData.accent === 'crew') { o.material = o.material.clone(); o.material.emissive = accentMaterial('crew').color.clone().multiplyScalar(0.8); } });
  ev.casings = [put('casing', V(XV - 0.12, Ly + 0.001, ALLEY.zN + 0.8), [0, 0.4, 0]), put('casing', V(XV + 0.42, Ly + 0.001, ALLEY.zN + 0.48), [0, 2.1, 0])];
  // the blood: a pool under his back and a run of it down the fall of the
  // flags to the gutter and along it to the drain
  ev.blood = bloodOnFlags(stage);
  out.push(ev.blood);
  // the holes themselves (a decal alone washes out under the lamp)
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const chip = new THREE.MeshStandardMaterial({ color: 0x5a5a5a, roughness: 1 });
  ev.holes = [];
  const hid = allocInkId();
  for (const m of MARKS) {
    const g = new THREE.Group();
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.016, 16), holeMat);
    const rim = new THREE.Mesh(new THREE.RingGeometry(0.016, 0.05, 16, 1), chip);
    for (const o of [hole, rim]) { o.rotation.y = Math.PI; o.userData.noRay = true; o.userData.inkId = hid; g.add(o); }
    rim.position.z = 0.0005;
    g.position.set(m.x, m.y, ALLEY.zS - 0.014);
    stage.scene.add(g);
    ev.holes.push(g);
    out.push(g);
  }
  ev.all = out;
  ctx.flags.ev = ev;
  return ev;
}

// the floor of the alley where it falls to the gutter (parts/alley.js)
const floorY = (z) => ALLEY.y - (0.035 * Math.exp(-(((z - ALLEY.gutterZ) / 0.22) ** 2)) + 0.01 * (1 - Math.min(1, Math.abs(z - ALLEY.gutterZ) / 3)));
// the blood as flat shapes of its own, on the flags' own ink id (no line
// round it: the red alone)
function bloodOnFlags(stage) {
  const g = new THREE.Group();
  g.name = 'body_blood';
  const mat = accentMaterial('blood');
  mat.polygonOffset = true; mat.polygonOffsetFactor = -2; mat.polygonOffsetUnits = -2;
  mat.side = THREE.DoubleSide;
  const floor = stage.part('alley').meshes.find((m) => m.name === 'alley_floor');
  const id = floor ? floor.userData.inkId : allocInkId();
  const add = (geo) => { const m = new THREE.Mesh(geo, mat); m.userData.noRay = true; m.userData.inkId = id; g.add(m); return m; };
  // a pool: an uneven blob, longer along the way it runs
  const blob = (cx, cz, r, seed, ax = 0, stretch = 1.25) => {
    const pts = [];
    for (let k = 0; k < 56; k++) {
      const a = k / 56 * Math.PI * 2;
      const rr = r * (1 + 0.2 * Math.sin(3 * a + seed) + 0.1 * Math.sin(7 * a + seed * 2.1) + 0.05 * Math.sin(13 * a + seed * 3.7));
      const lx = Math.cos(a) * rr * stretch, lz = Math.sin(a) * rr;
      pts.push(new THREE.Vector2(cx + lx * Math.cos(ax) - lz * Math.sin(ax), -(cz + lx * Math.sin(ax) + lz * Math.cos(ax))));
    }
    const geo = new THREE.ShapeGeometry(new THREE.Shape(pts), 1).rotateX(-Math.PI / 2);
    const p = geo.getAttribute('position');
    for (let i = 0; i < p.count; i++) p.setY(i, floorY(p.getZ(i)) + 0.003);
    return add(geo);
  };
  // under his back, and a second lobe where it gathered by his side
  const back = V(LIES.x + Math.sin(LIES.yaw) * -0.3, 0, LIES.z + Math.cos(LIES.yaw) * -0.3);
  blob(back.x, back.z, 0.24, 1.3, LIES.yaw + Math.PI / 2, 1.5);
  blob(LIES.x + 0.12, LIES.z - 0.28, 0.12, 4.1, 1.2, 1.3);
  // the run: a thread that narrows as it wanders down the flags, into the
  // gutter, to the drain
  const path = new THREE.CatmullRomCurve3([V(LIES.x + 0.12, 0, LIES.z - 0.36), V(-11.02, 0, -25.9), V(-10.96, 0, -26.3), V(-11.03, 0, -26.7), V(-11.02, 0, -26.93), V(ALLEY.drainX - 0.08, 0, ALLEY.gutterZ + 0.02)]);
  const N = 60, pos = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, c = path.getPointAt(u), t = path.getTangentAt(u);
    const w = (0.017 - 0.009 * u) * (1 + 0.45 * Math.sin(u * 37) * Math.sin(u * 13 + 1)) * (u > 0.93 ? 1.6 : 1);
    const nx = -t.z, nz = t.x;
    for (const sg of [-1, 1]) { const x = c.x + nx * w * sg, z = c.z + nz * w * sg; pos.push(x, floorY(z) + 0.003, z); }
    if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const run = new THREE.BufferGeometry();
  run.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  run.setIndex(idx);
  run.computeVertexNormals();
  add(run);
  stage.scene.add(g);
  return g;
}

// what the scene put in the world goes when it ends
export function clearEvidence(ctx) {
  const ev = ctx.flags && ctx.flags.ev;
  if (!ev) return;
  for (const o of ev.all) if (o.parent) o.parent.remove(o);
}

// ---- the hat in the gutter: crown down in the water by the kerb, turning --------------
export function gutterHat(ctx) {
  const { stage } = ctx;
  const h = buildProp('amesHat');
  h.traverse((o) => { if (o.isMesh) o.userData.noRay = true; });
  // (crown down: turned over, floating with the brim just in the water)
  const pivot = new THREE.Group();
  pivot.add(h);
  h.rotation.x = Math.PI;
  h.position.y = 0.09;
  pivot.position.set(-5.78, 0.0, -13.2);
  stage.scene.add(pivot);
  const H = { pivot, hat: h, t: 0 };
  H.step = (dt) => {
    H.t += dt;
    // it turns slowly in the run of the gutter and drifts a little with it
    pivot.rotation.y += dt * 0.42;
    pivot.position.z -= dt * 0.035;
    h.rotation.z = 0.05 * Math.sin(H.t * 1.7);
    pivot.position.y = 0.004 * Math.sin(H.t * 2.3);
    H.ripple = (H.ripple || 0) - dt;
    if (H.ripple <= 0 && stage.street && stage.street.addImpact) { H.ripple = 1.1; stage.street.addImpact(stage, pivot.position.x, pivot.position.z, 0.22); }
  };
  H.remove = () => { if (pivot.parent) pivot.parent.remove(pivot); };
  return H;
}

// ---- the car that pulls out of the alley and goes: the block's sedan, its
// tail lamps the crew's red, on a rail of its own ------------------------------------------
// (out along the alley's north side - past the phone booth at the mouth,
// off the kerb - then a left turn and away down the avenue)
const RAIL = [[-17.5, -28.9], [-13.0, -28.9], [-9.7, -29.0], [-7.6, -30.1], [-6.1, -32.6], [-4.6, -37.5], [-2.4, -45], [-1.6, -58], [-1.5, -90], [-1.5, -150]];
export function crewCar(ctx) {
  const { stage } = ctx;
  const cars = stage.part('cars');
  const T = cars.T, M = stage.M;
  const g = new THREE.Group();
  g.name = 'body_car';
  const id = allocInkId();
  const addM = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; m.userData.inkId = id; m.userData.noRay = true; g.add(m); return m; };
  addM(T.paint, M.paint); addM(T.chrome, M.chrome); addM(T.dark, M.rubber); addM(T.skirt, M.black);
  addM(T.rubber, M.rubber); addM(T.hubs, M.hubcap); addM(T.caps, M.chrome); addM(T.seams, M.seam);
  addM(T.glass, M.carGlass);
  markFigure(g);
  // the tail lamps: two small red discs glowing at the back (+ their sheen)
  const tailM = new THREE.MeshBasicMaterial({ color: accentMaterial('crew').color.clone().multiplyScalar(16) });
  tailM.name = 'body_tail';
  tailM.userData.accent = 'crew';
  for (const z of [0.74, -0.74]) {
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.095, 16, 10).scale(0.45, 1, 1), tailM);
    d.position.set(-2.33, 0.85, z);
    d.userData.inkId = id; d.userData.noRay = true;
    g.add(d);
  }
  const curve = new THREE.CatmullRomCurve3(RAIL.map(([x, z]) => V(x, 0, z)), false, 'centripetal');
  const L = curve.getLength();
  stage.scene.add(g);
  const C = { group: g, curve, s: 0, v: 0, t: 0, going: false, done: false, L };
  const place = () => {
    const u = Math.min(1, C.s / L);
    const p = curve.getPointAt(u), tn = curve.getTangentAt(u);
    // (on the walking surface: the alley's flags and the pavement, off the
    // kerb onto the road)
    const y = stage.surfaceY(p.x, p.z);
    C.y = C.y == null ? y : C.y + (y - C.y) * 0.35;
    g.position.set(p.x, C.y, p.z);
    g.rotation.set(0, Math.atan2(-tn.z, tn.x), 0);
  };
  place();
  C.go = () => { C.going = true; };
  C.step = (dt) => {
    if (!C.going || C.done) return;
    C.t += dt;
    // away: a slow roll out of the alley, the turn, then it opens up
    const want = C.s < 7 ? 3.2 : C.s < 16 ? 7 : 14;
    C.v += (want - C.v) * (1 - Math.exp(-dt * 1.4));
    C.s += C.v * dt;
    place();
    if (C.s >= L - 0.5) { C.done = true; g.visible = false; }
  };
  C.remove = () => { if (g.parent) g.parent.remove(g); };
  void LAYER;
  return C;
}

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
export const KNEEL = { x: -10.3, z: -25.45, yaw: Math.PI / 2 + 0.12, eyeY: ALLEY.y + 1.02 };
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
  const d = V(-9.6 - x, 1.2 - 1.8, -27.0 - z);
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
  ev.half = put('matchHalf', V(XV + 0.18, Ly, ALLEY.zN + 0.62), [0, 2.2, 0]);
  // (it glows a breath of its own red: the clue must show in the dark)
  ev.half.traverse((o) => { if (o.isMesh && o.material && o.material.userData && o.material.userData.accent === 'crew') { o.material = o.material.clone(); o.material.emissive = accentMaterial('crew').color.clone().multiplyScalar(0.35); } });
  ev.casings = [put('casing', V(XV - 0.12, Ly + 0.001, ALLEY.zN + 0.8), [0, 0.4, 0]), put('casing', V(XV + 0.42, Ly + 0.001, ALLEY.zN + 0.48), [0, 2.1, 0])];
  // the blood: a pool under his back and a run of it to the drain
  const D = game.fx && game.fx.decals;
  if (D) {
    const t0 = stage.time - 60;
    const chest = V(LIES.x + Math.sin(LIES.yaw) * -0.35, ALLEY.y, LIES.z + Math.cos(LIES.yaw) * -0.35);
    D.pool(chest, 0.62, 1, t0);
    D.pool(V(LIES.x + 0.1, ALLEY.y, LIES.z - 0.2), 0.38, 1, t0);
    // the run: a thread of it along the fall of the flags to the gutter and the drain
    const run = [[-11.06, -25.72, 0.16], [-11.02, -25.98, 0.13], [-10.99, -26.24, 0.12], [-10.98, -26.5, 0.11], [-10.98, -26.76, 0.12], [-11.0, -26.95, 0.16]];
    for (const [x, z, s] of run) D.pool(V(x, ALLEY.y - 0.01, z), s, 1, t0);
    // the marks in the brick: two small dark holes, the brick chipped round them
    for (const m of MARKS) { try { D.ink(m.clone(), V(0, 0, -1)); } catch (e) { /* */ } }
  }
  // the holes themselves (a decal alone washes out under the lamp)
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const chip = new THREE.MeshStandardMaterial({ color: 0x5a5a5a, roughness: 1 });
  ev.holes = [];
  const hid = allocInkId();
  for (const m of MARKS) {
    const g = new THREE.Group();
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.011, 14), holeMat);
    const rim = new THREE.Mesh(new THREE.RingGeometry(0.011, 0.032, 14, 1), chip);
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
const RAIL = [[-17.0, -28.2], [-13.0, -28.2], [-9.4, -28.45], [-7.2, -29.9], [-5.9, -32.6], [-4.4, -37.5], [-2.3, -45], [-1.6, -58], [-1.5, -90], [-1.5, -150]];
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
  const red = accentMaterial('crew', { gain: 5, additive: false });
  red.name = 'body_tail';
  const tailM = new THREE.MeshBasicMaterial({ color: red.color.clone() });
  tailM.userData.accent = 'crew';
  for (const z of [0.74, -0.74]) {
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 10).scale(0.5, 1, 1), tailM);
    d.position.set(-2.34, 0.84, z);
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
    g.position.set(p.x, 0, p.z);
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

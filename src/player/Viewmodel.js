import * as THREE from 'three';
import { LAYER, VM_ID0 } from '../render/layers.js';
import { roundedBox, smoothNormals, merge } from '../world/geom.js';

// The player's Thompson M1928 and gloved hands, first person.
//
// Built from smooth parts only (lathes, bevelled extrusions, rounded boxes,
// ellipsoids): finned barrel with a Cutts compensator, 50-round drum, vertical
// foregrip, pistol grip and wooden stock; the right glove on the grip (index
// finger on the trigger), the left on the foregrip; coat sleeves running out
// of frame. Gun-local frame: +x right, +y up, the muzzle toward -z.
//
// Rendering (render/Pipeline.js): its own camera (FOV 50, same eye) draws it
// into the id and scene targets after a depth clear (LAYER.VIEWMODEL), so it is
// inked like the world and never clips into walls; never reflected. Its brush
// field is anchored in the gun's frame (uVmFrame): strokes ride on the gun.
//
// Motion: sway (lags the look), walk bob, idle breath, recoil kick + muzzle
// climb (a spring), and the reload: tilt, drum out, drum in, bolt, back.

export const VM_FOV = 50;
const TAU = Math.PI * 2;
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// gun-local points of interest
export const MUZZLE = new THREE.Vector3(0, 0.03, -0.52);
export const EJECT = new THREE.Vector3(0.02, 0.04, -0.04);
const DRUM_C = new THREE.Vector3(0, -0.07, -0.085);
const FOREGRIP = new THREE.Vector3(0, 0.012, -0.3);

// ---- geometry helpers ----------------------------------------------------------
// GQ scales every segment count (Phase 3b: the heavies' Tommy guns beyond
// ~12 m use a build at GQ 0.35 - a 0.6 m gun ~40 px long prints the same)
let GQ = 1;
const sq = (n, min = 3) => Math.max(min, Math.round(n * GQ));
// lathe along the gun's -z axis: profile [[r, a]] with a = distance forward
function latheFwd(profile, segs = 32) {
  const g = new THREE.LatheGeometry(profile.map(([r, a]) => new THREE.Vector2(Math.max(r, 1e-4), a)), sq(segs, 6));
  g.rotateX(-Math.PI / 2);   // lathe +y -> gun -z
  return g;
}
// lathe along -y (hanging down): profile [[r, d]] with d = distance down
function latheDown(profile, segs = 28) {
  const g = new THREE.LatheGeometry(profile.map(([r, d]) => new THREE.Vector2(Math.max(r, 1e-4), -d)), sq(segs, 6));
  return g;
}
// lathe along +x (the drum's axis): profile [[r, x]]
function latheX(profile, segs = 48) {
  const g = new THREE.LatheGeometry(profile.map(([r, x]) => new THREE.Vector2(Math.max(r, 1e-4), x)), sq(segs, 8));
  g.rotateZ(-Math.PI / 2);   // lathe +y -> +x
  return g;
}
// side profile in (a = forward, y), extruded across x (width w, bevel b)
function sideExtrude(pts, w, b, curveSeg = 16) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  s.splineThru(pts.slice(1).map(([a, y]) => new THREE.Vector2(a, y)));
  s.closePath();
  const depth = Math.max(0.002, w - 2 * b);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: b, bevelSize: b * 0.9, bevelSegments: sq(5, 1), curveSegments: sq(curveSeg, 4) });
  g.translate(0, 0, -depth / 2);
  g.rotateY(Math.PI / 2);    // shape x (forward) -> -z, extrusion -> x
  return smoothNormals(g, 1e-4);
}
function ellipsoid(rx, ry, rz, c, segs = 28, bump = null) {
  const g = new THREE.SphereGeometry(1, sq(segs, 6), sq(Math.round(segs * 0.7), 4));
  const p = g.getAttribute('position');
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    let k = 1;
    if (bump) k += bump(v);
    p.setXYZ(i, v.x * rx * k, v.y * ry * k, v.z * rz * k);
  }
  g.computeVertexNormals();
  g.translate(c.x, c.y, c.z);
  return g;
}
// capsule between two points
function capsuleBetween(a, b, r, segs = 16) {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  const g = new THREE.CapsuleGeometry(r, Math.max(1e-3, len), sq(6, 2), sq(segs, 5));
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}

const rbox = (w, h, d, r, seg) => roundedBox(w, h, d, r, sq(seg, 1));
const torus = (R, r, a, b, arc) => new THREE.TorusGeometry(R, r, sq(a, 4), sq(b, 6), arc);
function buildGun(q = 1) {
  GQ = q;
  try { return buildGunParts(); } finally { GQ = 1; }
}
function buildGunParts() {
  const steel = [], wood = [], drum = [], knob = [];
  // receiver: a long rounded box with a narrower rib on top
  steel.push(rbox(0.034, 0.052, 0.25, 0.009, 4).translate(0, 0.026, -0.055));
  steel.push(rbox(0.022, 0.012, 0.2, 0.005, 3).translate(0, 0.054, -0.07));
  // lower frame / trigger housing
  steel.push(rbox(0.03, 0.03, 0.15, 0.007, 3).translate(0, -0.01, 0.0));
  // Lyman rear sight: base, two ladder rails and the aperture slide, standing
  // proud of the receiver so its notch breaks the black slab's top line
  steel.push(rbox(0.022, 0.012, 0.034, 0.004, 2).translate(0, 0.063, 0.04));
  for (const x of [-0.0075, 0.0075]) steel.push(rbox(0.0035, 0.036, 0.006, 0.0015, 2).translate(x, 0.085, 0.046));
  steel.push(rbox(0.02, 0.006, 0.007, 0.0018, 2).translate(0, 0.1, 0.046));
  const ap = torus(0.0042, 0.0016, 8, 16);
  steel.push(ap.translate(0, 0.093, 0.046));
  // the receiver's side: a raised rail along the left flank and the
  // ejection-port frame on the right, so the ink finds crease lines in the
  // slab instead of one flat black side
  steel.push(rbox(0.004, 0.009, 0.2, 0.0018, 2).translate(-0.0175, 0.036, -0.06));
  steel.push(rbox(0.004, 0.018, 0.055, 0.0018, 2).translate(0.0175, 0.034, -0.035));
  // barrel: finned (cooling fins) behind a plain run to the Cutts compensator
  const prof = [[0.0, 0.17], [0.0135, 0.17], [0.0135, 0.19]];
  for (let a = 0.19; a < 0.335; a += 0.0115) {
    prof.push([0.0132, a], [0.0176, a + 0.002], [0.0176, a + 0.0052], [0.0132, a + 0.0072]);
  }
  // the Cutts compensator: a straight cylinder only a little wider than the
  // barrel (not a bulb), a square shoulder behind, a flat face with the
  // bore in front
  prof.push([0.0115, 0.345], [0.0108, 0.44], [0.0118, 0.449], [0.0142, 0.4495], [0.0146, 0.452], [0.0146, 0.513], [0.0141, 0.5165],
    [0.0072, 0.517], [0.0066, 0.51], [0.0, 0.51]);
  steel.push(latheFwd(prof, 30).translate(0, 0.03, 0));
  // compensator: four raised transverse ribs across its top (between the
  // cut ports) + the front sight blade on the barrel behind it
  for (const z of [-0.462, -0.474, -0.486, -0.498]) steel.push(rbox(0.021, 0.0065, 0.0048, 0.0016, 2).translate(0, 0.0454, z));
  steel.push(rbox(0.003, 0.012, 0.012, 0.0012, 2).translate(0, 0.0465, -0.437));
  // foregrip mount under the barrel
  steel.push(rbox(0.02, 0.018, 0.034, 0.005, 2).translate(0, 0.017, -0.3));
  // vertical foregrip with finger grooves (wood), raked forward a little
  const fg = latheDown([[0, 0], [0.013, 0], [0.0165, 0.008], [0.019, 0.022], [0.0165, 0.034], [0.0195, 0.047], [0.0165, 0.059],
    [0.0195, 0.072], [0.017, 0.085], [0.0215, 0.098], [0.0205, 0.106], [0.012, 0.111], [0, 0.112]], 28);
  fg.rotateX(0.14).translate(FOREGRIP.x, FOREGRIP.y, FOREGRIP.z);
  wood.push(fg);
  // trigger guard + trigger
  const guard = torus(0.019, 0.0034, 8, 24, Math.PI);
  guard.rotateY(Math.PI / 2).rotateX(Math.PI).translate(0, -0.025, 0.03);
  steel.push(guard);
  steel.push(capsuleBetween(new THREE.Vector3(0, -0.022, 0.028), new THREE.Vector3(0, -0.036, 0.034), 0.0028, 8));
  // pistol grip (wood), raked back
  wood.push(sideExtrude([[-0.052, -0.018], [-0.06, -0.055], [-0.068, -0.09], [-0.076, -0.118], [-0.09, -0.127], [-0.112, -0.122],
    [-0.108, -0.09], [-0.098, -0.052], [-0.09, -0.02], [-0.07, -0.012]], 0.03, 0.0085));
  // stock (wood): comb, wrist, butt plate
  // (a real M1928 stock drops ~6 cm at the heel: it runs back and down out
  // of the frame instead of standing beside the camera as a flat plank)
  const stock = sideExtrude([[-0.07, 0.048], [-0.2, 0.03], [-0.36, 0.0], [-0.45, -0.022], [-0.462, -0.036], [-0.462, -0.17],
    [-0.44, -0.182], [-0.3, -0.112], [-0.17, -0.05], [-0.11, -0.024], [-0.075, -0.006]], 0.036, 0.011);
  wood.push(stock);
  // the drum: a flat can with rolled rims, a raised ring and the winding key
  drum.push(latheX([[0, -0.025], [0.066, -0.025], [0.084, -0.0235], [0.0915, -0.019], [0.0935, -0.012], [0.0935, 0.012], [0.0915, 0.019],
    [0.084, 0.0235], [0.066, 0.025], [0.058, 0.026], [0.052, 0.025], [0.03, 0.025], [0.02, 0.028], [0.016, 0.036], [0.006, 0.037], [0, 0.037]], 56));
  const ring = torus(0.058, 0.0028, 8, 56);
  ring.rotateY(Math.PI / 2).translate(0.026, 0, 0);
  drum.push(ring);
  // winding key: a flat bar across the hub
  drum.push(rbox(0.006, 0.042, 0.009, 0.0025, 2).translate(0.038, 0, 0));
  // cocking knob on top of the receiver (animated in the reload): a ribbed
  // knob on a stem, standing well above the top rib
  knob.push(ellipsoid(0.0098, 0.0082, 0.0098, new THREE.Vector3(0, 0.08, 0), 16));
  knob.push(new THREE.CylinderGeometry(0.0034, 0.0034, 0.022, sq(10, 5)).translate(0, 0.067, 0));
  const kr = torus(0.0096, 0.0014, 6, 20);
  kr.rotateX(Math.PI / 2);
  knob.push(kr.translate(0, 0.08, 0));
  return { steel: merge(steel), wood: merge(wood), drum: merge(drum), knob: merge(knob) };
}

// the whole gun as one geometry (the heavies' Tommy guns, enemies/Hood.js);
// q < 1: the far build
export function buildTommyGeometry(q = 1) {
  const G = buildGun(q);
  const drum = G.drum.clone().translate(DRUM_C.x, DRUM_C.y, DRUM_C.z);
  const knob = G.knob.clone().translate(0, 0, -0.11);
  return merge([G.steel, G.wood, drum, knob]);
}

// right glove wrapped round the pistol grip (finger on the trigger), left
// glove round the foregrip; each hand is its own mesh (the left one moves to
// the drum in the reload)
function buildHands() {
  const R = [];
  // fist on the grip: the palm wraps from the back, knuckles to the front
  R.push(ellipsoid(0.034, 0.047, 0.05, new THREE.Vector3(0.002, -0.058, 0.082), 28,
    (v) => 0.12 * Math.exp(-((v.z + 0.8) ** 2) / 0.2) * Math.max(0, v.y + 0.2)));
  // index finger to the trigger
  R.push(capsuleBetween(new THREE.Vector3(0.013, -0.04, 0.062), new THREE.Vector3(0.006, -0.034, 0.036), 0.0085, 10));
  // thumb over the top of the grip, on the left side
  R.push(capsuleBetween(new THREE.Vector3(-0.022, -0.03, 0.088), new THREE.Vector3(-0.02, -0.016, 0.058), 0.0095, 10));
  // back of the hand and the wrist, toward the elbow (down, right, back)
  R.push(ellipsoid(0.03, 0.028, 0.045, new THREE.Vector3(0.02, -0.07, 0.115), 20));
  const L = [];
  // left fist round the foregrip: a smaller palm on its back, four curled
  // fingers wrapping its front (their proximal knuckles a ridge down the
  // left side, facing the eye), the thumb up the right side with its tip
  // bent over the top, the back of the hand and the wrist toward the elbow
  L.push(ellipsoid(0.027, 0.046, 0.03, new THREE.Vector3(-0.008, -0.05, -0.286), 24));
  for (let k = 0; k < 4; k++) {
    const y = -0.024 - k * 0.0155, rr = 0.0085 - k * 0.0006;
    const kn = new THREE.Vector3(-0.026, y, -0.3);          // knuckle
    const mid = new THREE.Vector3(-0.012, y - 0.001, -0.323);
    const tip = new THREE.Vector3(0.012, y - 0.002, -0.318);
    L.push(capsuleBetween(kn, mid, rr, 10), capsuleBetween(mid, tip, rr * 0.92, 10));
    L.push(ellipsoid(rr * 1.25, rr * 1.05, rr * 1.2, kn, 12));
  }
  L.push(capsuleBetween(new THREE.Vector3(0.016, -0.062, -0.284), new THREE.Vector3(0.022, -0.028, -0.292), 0.0102, 10));
  L.push(capsuleBetween(new THREE.Vector3(0.022, -0.028, -0.292), new THREE.Vector3(0.014, -0.008, -0.304), 0.0088, 10));
  L.push(ellipsoid(0.028, 0.028, 0.042, new THREE.Vector3(-0.022, -0.07, -0.27), 20));
  const shift = (list, c) => list.map((g) => g.translate(-c.x, -c.y, -c.z));
  // left hand in its own frame (origin at the grip point) so it can travel
  const LC = new THREE.Vector3(0, -0.05, -0.3);
  return { right: merge(R), left: merge(shift(L, LC)), leftC: LC };
}

// one coat sleeve with a glove cuff: a tube along +y of unit length (scaled
// to the wrist-elbow distance each frame)
function buildSleeve() {
  const g = new THREE.LatheGeometry([
    [0.0, -0.02], [0.028, -0.02], [0.033, 0.0], [0.034, 0.05], [0.041, 0.06], [0.045, 0.09], [0.048, 0.5], [0.05, 0.9], [0.05, 1.05], [0.0, 1.06],
  ].map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y)), 24);
  return g;
}

export class Viewmodel {
  constructor(world, camera) {
    this.world = world;
    this.camera = camera;
    this.cam = new THREE.PerspectiveCamera(VM_FOV, camera.aspect, 0.03, 50);
    this.setAspect(camera.aspect);
    this.visible = true;
    const M = world.M;
    // Inked, not CG-shaded: every part is rough with no environment
    // reflection, so no specular hotspot or crescent survives (the drum and
    // the compensator printed polished highlights); the shape comes from the
    // key light's diffuse terms, the ink's rim and its crease lines.
    const mats = {
      steel: new THREE.MeshStandardMaterial({ color: 0x0e0e0e, roughness: 0.9, metalness: 0.0, envMap: M.envSoft, envMapIntensity: 0, side: THREE.DoubleSide }),
      // (dark walnut in the coat-grey range: it prints as dry-brushed dark
      // grey that the ink's brush breaks, never a pale flat plank)
      wood: new THREE.MeshStandardMaterial({ color: 0x272727, roughness: 0.92, metalness: 0.0, envMap: M.envSoft, envMapIntensity: 0, side: THREE.DoubleSide }),
      glove: new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9, metalness: 0.0, envMap: M.envSoft, envMapIntensity: 0, side: THREE.DoubleSide }),
      // (the coat sleeves fill a lot of the frame and print black: a cheap
      // Lambert is enough)
      sleeve: new THREE.MeshLambertMaterial({ color: 0x0a0a0a, side: THREE.DoubleSide }),
    };
    this.mats = mats;
    // root follows the camera; `gun` carries the pose (sway, recoil, reload)
    this.root = new THREE.Object3D();
    this.root.matrixAutoUpdate = false;
    this.root.name = 'viewmodel';
    this.gun = new THREE.Group();
    this.root.add(this.gun);
    const G = buildGun(), H = buildHands();
    const add = (geo, mat, id, parent = this.gun) => {
      const m = new THREE.Mesh(geo, mat);
      m.userData.inkId = VM_ID0 + id;
      m.userData.inkFigure = true;
      m.castShadow = false; m.receiveShadow = false;
      m.frustumCulled = false;
      m.layers.set(LAYER.VIEWMODEL);
      parent.add(m);
      return m;
    };
    add(G.steel, mats.steel, 0);
    add(G.wood, mats.wood, 2);
    this.drumG = new THREE.Group();
    this.drumG.position.copy(DRUM_C);
    this.gun.add(this.drumG);
    add(G.drum, mats.steel, 1, this.drumG);
    this.knobG = new THREE.Group();
    this.knobG.position.set(0, 0, -0.11);
    this.gun.add(this.knobG);
    add(G.knob, mats.steel, 0, this.knobG);
    add(H.right, mats.glove, 3);
    this.leftG = new THREE.Group();
    this.leftG.position.copy(H.leftC);
    this.leftHome = H.leftC.clone();
    this.gun.add(this.leftG);
    add(H.left, mats.glove, 3, this.leftG);
    const sl = buildSleeve();
    this.sleeveR = add(sl, mats.sleeve, 4);
    this.sleeveL = add(sl, mats.sleeve, 4);
    this.wristR = new THREE.Vector3(0.024, -0.074, 0.13);
    this.elbowR = new THREE.Vector3(0.24, -0.34, 0.12);
    this.wristL = new THREE.Vector3(-0.024, -0.074, -0.262);   // relative to the gun (moves with the hand)
    this.elbowL = new THREE.Vector3(-0.34, -0.33, -0.3);
    // a key light for the gun alone (LAYER.VIEWMODEL only: three filters
    // lights by the camera's layers, so the world never sees it): up and to
    // the left like the street lamp in the composition, so the steel catches
    // highlights and the walnut prints as dry-brushed grey instead of the
    // gun reading as one black mass whenever no lamp is near
    // (the parts are matte now: a little more key so the lit tops of the
    // receiver, the drum rim and the knuckles raise dry-brush greys)
    this.key = new THREE.PointLight(0xffffff, 2.2, 3, 2);
    this.key.position.set(-0.45, 0.42, -0.75);
    this.key.layers.enableAll();
    this.root.add(this.key);
    // The gun lives in its own tiny scene (the pipeline draws it with three
    // extra render calls; over the whole world graph those traversals cost
    // ~2 ms). It is lit by proxies of the world's lights that matter at the
    // eye: the ambient, the muzzle flash, the two nearest lamp spots.
    this.scene = new THREE.Scene();
    this.scene.name = 'viewmodelScene';
    this.scene.add(this.root);
    this.hemi = new THREE.HemisphereLight();
    this.flashP = new THREE.PointLight(0xffffff, 0, 12, 2);
    this.spots = [0, 1].map(() => { const sp = new THREE.SpotLight(0xffffff, 0, 26, 0.5, 0.9, 2); this.scene.add(sp, sp.target); return sp; });
    this.scene.add(this.hemi, this.flashP);
    for (const L of [this.hemi, this.flashP, ...this.spots]) L.layers.enableAll();

    // pose state (camera space)
    this.base = { pos: new THREE.Vector3(0.21, -0.2, -0.56), rot: new THREE.Euler(0.1, 0.27, -0.1, 'YXZ') };
    this.sway = { x: 0, y: 0, vx: 0, vy: 0 };
    this.recoil = { z: 0, vz: 0, p: 0, vp: 0, yaw: 0, roll: 0 };
    this.reloadT = -1;
    this.reloadDur = 2.3;
    // lowered (Phase 3b review): a dead man's gun leaves the shoulder - on
    // the end card the Tommy gun drops out of the bottom of the frame
    // (0 = shouldered, 1 = gone; the root is hidden once it is out of view)
    this.lower = 0;
    this.lowerTarget = 0;
    this._lastYaw = null; this._lastPitch = null;
    this.pose = new THREE.Matrix4();
    this.frameInv = new THREE.Matrix4();
    this.t = 0;
    this._q = new THREE.Quaternion(); this._e = new THREE.Euler(0, 0, 0, 'YXZ'); this._v = new THREE.Vector3();
    // (scratch: update() and the light sync run every step / frame)
    this._dh = new THREE.Vector3(); this._dhOff = new THREE.Vector3(0.03, -0.075, 0.02); this._wl = new THREE.Vector3(); this._tmpV = new THREE.Vector3();
    this._elR = new THREE.Vector3(); this._elL = new THREE.Vector3(); this._m4 = new THREE.Matrix4(); this._one = new THREE.Vector3(1, 1, 1);
    this._sd = new THREE.Vector3(); this._up = new THREE.Vector3(0, 1, 0); this._act = [];
  }

  // Depth squeeze: the viewmodel is drawn into the same depth buffer as the
  // world (the id pass' depth TEXTURE, which a clear would wipe), so its NDC
  // depth is remapped z' = a z + b into [-1, -0.999]: the gun always wins,
  // keeps its own self-occlusion, and the ink pass reconstructs its view
  // position through this matrix's inverse (uProjInvVM).
  setAspect(a) {
    const c = this.cam;
    c.aspect = a;
    c.updateProjectionMatrix();
    const e = c.projectionMatrix.elements, A = 0.0005, B = -0.9995;
    for (let k = 0; k < 4; k++) e[k * 4 + 2] = A * e[k * 4 + 2] + B * e[k * 4 + 3];
    c.projectionMatrixInverse.copy(c.projectionMatrix).invert();
  }

  kick(strength = 1, rng = Math.random) {
    const R = this.recoil;
    R.vz += 1.1 * strength;
    R.vp += 1.9 * strength;
    R.yaw += (rng() - 0.5) * 0.012 * strength;
    R.roll += (rng() - 0.5) * 0.02 * strength;
  }

  startReload() { if (this.reloadT < 0) this.reloadT = 0; }
  // lower the gun out of the frame (1) or bring it back (0); snap: at once
  lowerTo(v, snap = false) { this.lowerTarget = v; if (snap) this.lower = v; }
  get reloading() { return this.reloadT >= 0; }

  // controller: yaw/pitch (for sway), bobPhase/bobAmp (walk bob)
  update(dt, controller) {
    this.t += dt;
    const S = this.sway, R = this.recoil;
    if (controller) {
      if (this._lastYaw !== null && dt > 0) {
        let dy = controller.yaw - this._lastYaw;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        const dp = controller.pitch - this._lastPitch;
        // the gun lags the look: pushed opposite to the turn, springs back
        S.vx += -dy * 2.2;
        S.vy += -dp * 2.2;
      }
      this._lastYaw = controller.yaw; this._lastPitch = controller.pitch;
    }
    if (dt > 0) {
      const k = 90, c = 13;
      S.vx += (-k * S.x - c * S.vx) * dt; S.x += S.vx * dt;
      S.vy += (-k * S.y - c * S.vy) * dt; S.y += S.vy * dt;
      S.x = Math.max(-0.12, Math.min(0.12, S.x)); S.y = Math.max(-0.1, Math.min(0.1, S.y));
      // recoil springs (stiff, fast settle)
      const kr = 520, cr = 38;
      R.vz += (-kr * R.z - cr * R.vz) * dt; R.z += R.vz * dt;
      R.vp += (-kr * R.p - cr * R.vp) * dt; R.p += R.vp * dt;
      R.yaw *= Math.exp(-14 * dt); R.roll *= Math.exp(-12 * dt);
      if (this.reloadT >= 0) {
        this.reloadT += dt;
        if (this.reloadT >= this.reloadDur) this.reloadT = -1;
      }
      // (the drop: quick, like a man letting the gun fall to his side)
      this.lower += (this.lowerTarget - this.lower) * (1 - Math.exp(-7 * dt));
      if (Math.abs(this.lowerTarget - this.lower) < 0.004) this.lower = this.lowerTarget;
    }
    // walk bob + idle breath
    const bp = controller ? controller.bobPhase : 0, ba = controller ? controller.bobAmp : 0;
    const breath = Math.sin(this.t * 1.7) * 0.0022;
    const pos = this._v.copy(this.base.pos);
    pos.x += Math.cos(bp) * 0.011 * ba + S.x * 0.12;
    pos.y += -Math.abs(Math.sin(bp)) * 0.014 * ba + breath + S.y * 0.12;
    pos.z += R.z * 0.03;
    const e = this._e.copy(this.base.rot);
    e.x += R.p * 0.055 + S.y * 0.5 + breath * 0.8;
    e.y += R.yaw + S.x * 0.6;
    e.z += R.roll + S.x * -0.3 + Math.cos(bp) * 0.01 * ba;
    // reload choreography
    let drumOut = 0, drumDrop = 0, bolt = 0, handToDrum = 0;
    if (this.reloadT >= 0) {
      // the gun comes up and turns its right side to the eye, the drum
      // slides out to the right and drops away, a fresh one goes in, the
      // left hand racks the bolt, the gun goes back down
      const u = this.reloadT / this.reloadDur;
      const tilt = sstep(0.0, 0.16, u) * (1 - sstep(0.84, 1.0, u));
      e.y += 0.42 * tilt;
      e.z += 0.3 * tilt;
      e.x += 0.16 * tilt - 0.07 * sstep(0.74, 0.8, u) * (1 - sstep(0.8, 0.9, u));
      pos.x -= 0.08 * tilt; pos.y += 0.06 * tilt; pos.z += 0.04 * tilt;
      handToDrum = sstep(0.1, 0.24, u) * (1 - sstep(0.62, 0.72, u));
      drumOut = sstep(0.24, 0.4, u) * (1 - sstep(0.5, 0.64, u));
      drumDrop = sstep(0.34, 0.46, u) * (1 - sstep(0.48, 0.56, u));
      bolt = sstep(0.74, 0.79, u) * (1 - sstep(0.81, 0.86, u));
    }
    // lowered: down and out of the frame, the muzzle dipping, rolled away
    const L = this.lower;
    if (L > 0) {
      const l = L * L * (3 - 2 * L);
      pos.y -= 0.5 * l; pos.x += 0.05 * l; pos.z += 0.06 * l;
      e.x -= 0.75 * l; e.z -= 0.35 * l;
    }
    this.drumG.position.set(DRUM_C.x + 0.15 * drumOut, DRUM_C.y - 0.18 * drumDrop, DRUM_C.z + 0.01 * drumOut);
    this.drumG.rotation.set(0.3 * drumDrop, 0, -0.35 * drumOut);
    this.knobG.position.z = -0.11 + 0.055 * bolt;
    // left hand: on the foregrip, or on the drum's rim during the swap
    const drumHand = this._dh.copy(this.drumG.position).add(this._dhOff);
    this.leftG.position.copy(this.leftHome).lerp(drumHand, handToDrum);
    this.leftG.rotation.set(0, 0, 0.6 * handToDrum);

    this.gun.position.copy(pos);
    this.gun.quaternion.setFromEuler(e);
    this.gun.updateMatrix();
    this.pose.copy(this.gun.matrix);
    this.frameInv.copy(this.pose).invert();
    // sleeves: from the wrist (moves with the hand) to a fixed elbow
    this.placeSleeve(this.sleeveR, this.wristR, this._vmToGun(this.elbowR, pos, e, this._elR));
    const wl = this._wl.copy(this.leftG.position).add(this._tmpV.copy(this.wristL).sub(this.leftHome));
    this.placeSleeve(this.sleeveL, wl, this._vmToGun(this.elbowL, pos, e, this._elL));
  }

  // elbows are fixed in CAMERA space (the arms reach from the body); the
  // sleeves live in the gun's frame, so convert
  _vmToGun(pCam, pos, e, out) {
    const m = this._m4.compose(pos, this._q.setFromEuler(e), this._one).invert();
    return out.copy(pCam).applyMatrix4(m);
  }

  placeSleeve(mesh, wrist, elbow) {
    const d = this._sd.subVectors(elbow, wrist);
    const len = d.length();
    mesh.position.copy(wrist);
    mesh.quaternion.setFromUnitVectors(this._up, d.normalize());
    mesh.scale.set(1, len, 1);
  }

  // mirror the world's lights near the eye into the viewmodel scene
  syncLights(camera) {
    const W = this.world;
    this.hemi.color.copy(W.hemi.color); this.hemi.groundColor.copy(W.hemi.groundColor); this.hemi.intensity = W.hemi.intensity;
    const F = W.flash;
    this.flashP.position.copy(F.position); this.flashP.intensity = F.intensity; this.flashP.distance = F.distance; this.flashP.decay = F.decay;
    const pool = (W.lamps && W.lamps.pool) || [];
    const p = camera.position;
    const act = this._act;
    act.length = 0;
    for (const sl of pool) if (sl.lamp && sl.spot.intensity > 0) { sl._vmD = sl.spot.position.distanceToSquared(p); act.push(sl); }
    act.sort((a, b) => a._vmD - b._vmD);
    this.spots.forEach((sp, i) => {
      const src = act[i] && act[i].spot;
      if (!src) { sp.intensity = 0; return; }
      sp.position.copy(src.position); sp.target.position.copy(src.target.position); sp.target.updateMatrixWorld();
      sp.angle = src.angle; sp.penumbra = src.penumbra; sp.distance = src.distance; sp.decay = src.decay; sp.intensity = src.intensity;
    });
  }

  // After the camera moved: glue the root to it; returns nothing.
  sync(camera) {
    this.syncLights(camera);
    this.root.matrix.copy(camera.matrixWorld);
    this.root.matrixWorldNeedsUpdate = true;
    this.root.updateMatrixWorld(true);
    this.cam.position.setFromMatrixPosition(camera.matrixWorld);
    this.cam.quaternion.setFromRotationMatrix(camera.matrixWorld);
    this.cam.updateMatrixWorld(true);
    this.root.visible = this.visible && this.lower < 0.98;
  }

  // gun-local point -> VM-camera view space -> world (VM placement)
  vmWorld(local, out = new THREE.Vector3()) {
    return out.copy(local).applyMatrix4(this.gun.matrixWorld);
  }

  // The same screen point seen through the MAIN camera at view depth `depth`:
  // where world effects (the flash light, casings, the flash's reflection)
  // must be for their screen position to match the viewmodel.
  reproject(local, depth, camera, out = new THREE.Vector3()) {
    const p = out.copy(local).applyMatrix4(this.pose);            // VM view space
    const tv = Math.tan(THREE.MathUtils.degToRad(VM_FOV) / 2);
    const tm = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const nx = p.x / (-p.z * tv), ny = p.y / (-p.z * tv);
    p.set(nx * tm * depth, ny * tm * depth, -depth);
    return p.applyMatrix4(camera.matrixWorld);
  }

  // gun forward (muzzle direction) in world space
  forward(out = new THREE.Vector3()) {
    return out.set(0, 0, -1).transformDirection(this.gun.matrixWorld);
  }
}

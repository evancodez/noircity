import * as THREE from 'three';
import { LAYER, VM_ID0 } from '../render/layers.js';
import { roundedBox, smoothNormals, merge } from '../world/geom.js';

// The player's Thompson M1928, first person (the hands on it: Hands.js).
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
// climb (a spring), and the reload: tilt, drum out and dropped, a fresh
// drum in, bolt, back (RELOAD). The hands are not here: player/Hands.js
// lays its rig on the gun's grips every step.

export const VM_FOV = 50;
const TAU = Math.PI * 2;
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// gun-local points of interest
export const MUZZLE = new THREE.Vector3(0, 0.03, -0.52);
export const EJECT = new THREE.Vector3(0.02, 0.04, -0.04);
const DRUM_C = new THREE.Vector3(0, -0.07, -0.085);
export const FOREGRIP = new THREE.Vector3(0, 0.012, -0.3);
export { DRUM_C };
// The reload (lane 2 brief, fix 2), seconds from its start. The sound
// (Sfx 'reload' at dur 2.6) lands on the same moments: the latch at 0.52,
// the drum sliding out at 0.68, in at 1.35, home at 1.56, the bolt 1.98 / 2.11.
// where the fresh drum comes from: below the frame, tipped (the eye's frame)
const FRESH_LOW = { p: new THREE.Vector3(0.02, -0.46, -0.42), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.9, 0.5, -0.6)) };
export const RELOAD = {
  dur: 2.6,
  latch: 0.52,          // the left thumb on the latch
  out0: 0.55, out1: 0.72, slide: 0.05,   // the spent drum slides 5 cm out to the side (the gun's left, turned to the eye)
  gone: 1.04,           // ... falls: out of the bottom of the frame by u = 0.40
  land: 1.39,           // ... and lands by the feet 0.35 s later (clang, ripple)
  rise0: 1.12,          // the fresh drum rises into view in the left hand
  line: 1.36,           // lined up beside the slot
  seat0: 1.42, seat: 1.56,   // slides in, seats (a push of the palm, a jolt)
  bolt0: 1.9, boltBack: 1.98, boltHome: 2.11,
  grip0: 2.12, grip1: 2.4,   // the hand back on the foregrip
  down0: 2.232,         // the gun goes back down (the old 0.368 s)
};

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

// the drum alone (the spent drum lying on the street, Weapon.dropDrum):
// its axis along x, centred
export function buildDrumGeometry() { return buildGun(0.6).drum; }

// the whole gun as one geometry (the heavies' Tommy guns, enemies/Hood.js);
// q < 1: the far build
export function buildTommyGeometry(q = 1) {
  const G = buildGun(q);
  const drum = G.drum.clone().translate(DRUM_C.x, DRUM_C.y, DRUM_C.z);
  const knob = G.knob.clone().translate(0, 0, -0.11);
  return merge([G.steel, G.wood, drum, knob]);
}

export class Viewmodel {
  constructor(world, camera) {
    this.world = world;
    this.camera = camera;
    this.cam = new THREE.PerspectiveCamera(VM_FOV, camera.aspect, 0.03, 50);
    this.setAspect(camera.aspect);
    this.visible = true;
    this.study = null;
    this.reloadFreeze = null;
    this.flame = null;          // world point of a lighter's flame in the hands (Hands)   // (a still of the reload: handstudy&pose=tommyReload@<s>)
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
    const G = buildGun();
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
    // (the hands and sleeves are the hands' rig, player/Hands.js: one
    // articulated pair for every set; they take the gun's grips from here)
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
    this.reloadDur = RELOAD.dur;
    this._pA = new THREE.Vector3(); this._pB = new THREE.Vector3(); this._qA = new THREE.Quaternion(); this._qB = new THREE.Quaternion();
    this.drumFall = null;
    this._g = new THREE.Vector3(); this._qc = new THREE.Quaternion(); this._mi = new THREE.Matrix4(); this._s3 = new THREE.Vector3();
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
    this._m4 = new THREE.Matrix4(); this._one = new THREE.Vector3(1, 1, 1); this._act = [];
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

  // The sets that are not a gun see through the eye's own lens (a hand on
  // the counter lands on the counter, a prop picked up keeps its size); the
  // guns keep VM_FOV (Hands.js switches it with the set).
  setFov(fov) {
    if (Math.abs(this.cam.fov - fov) < 1e-9) return;
    this.cam.fov = fov;
    this.setAspect(this.cam.aspect);
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
      if (this.reloadFreeze != null) this.reloadT = this.reloadFreeze;
      else if (this.reloadT >= 0) {
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
    // reload choreography (fix 2; timings in seconds: RELOAD). The gun
    // comes up and turns its right side to the eye (as it always did: the
    // same tilt over the first 0.368 s), the drum slides out and FALLS out
    // of the bottom of the frame, a fresh one comes up in the left hand
    // (player/Hands.js), slides in and seats, the bolt is racked, the gun
    // goes back down.
    let bolt = 0;
    const RT = this.reloadT;
    if (RT >= 0) {
      const RL = RELOAD;
      const tilt = sstep(0.0, 0.368, RT) * (1 - sstep(RL.down0, RL.dur, RT));
      e.y += 0.42 * tilt;
      e.z += 0.3 * tilt;
      // (the muzzle dips as the bolt is hauled back; a small jolt as the
      // palm seats the drum)
      const seat = sstep(RL.seat - 0.06, RL.seat, RT) * (1 - sstep(RL.seat, RL.seat + 0.16, RT));
      e.x += 0.16 * tilt - 0.07 * sstep(RL.bolt0, RL.boltBack, RT) * (1 - sstep(RL.boltBack, RL.boltHome + 0.08, RT)) - 0.035 * seat;
      pos.x -= 0.08 * tilt; pos.y += 0.06 * tilt - 0.006 * seat; pos.z += 0.04 * tilt + 0.012 * seat;
      bolt = sstep(RL.bolt0, RL.boltBack, RT) * (1 - sstep(RL.boltBack + 0.06, RL.boltHome, RT));
    }
    // lowered: down and out of the frame, the muzzle dipping, rolled away
    const L = this.lower;
    if (L > 0) {
      const l = L * L * (3 - 2 * L);
      pos.y -= 0.5 * l; pos.x += 0.05 * l; pos.z += 0.06 * l;
      e.x -= 0.75 * l; e.z -= 0.35 * l;
    }
    this.knobG.position.z = -0.11 + 0.055 * bolt;

    this.gun.position.copy(pos);
    this.gun.quaternion.setFromEuler(e);
    this.gun.updateMatrix();
    this.pose.copy(this.gun.matrix);
    this.frameInv.copy(this.pose).invert();
    this.updateDrum(dt);
  }

  // The drum through the reload (gun-local, drumG is the gun's child):
  //   in the slot | sliding 5 cm out to the side | falling (gravity in the
  //   eye's frame, a slight tumble: out of the bottom of the frame by 1.04 s)
  //   | gone | the fresh one rising from below the frame (the left hand lies
  //   on its rim: Hands) | lined up beside the slot, pushed in and seated
  updateDrum(dt) {
    const D = this.drumG, RL = RELOAD, t = this.reloadT;
    D.visible = true;
    if (t < 0 || t < RL.out0) {
      D.position.copy(DRUM_C); D.rotation.set(0, 0, 0);
      this.drumFall = null;
      return;
    }
    if (t < RL.out1) {
      D.position.set(DRUM_C.x - RL.slide * sstep(RL.out0, RL.out1, t), DRUM_C.y, DRUM_C.z);
      D.rotation.set(0, 0, 0);
      this.drumFall = null;
      return;
    }
    if (t < RL.rise0) {
      // falling: from where it left the slot, in the eye's frame (analytic in
      // the fall's own clock, so a still at any moment of it is exact)
      const F = this.drumFall || (this.drumFall = this._fallStart());
      const tau = Math.max(0, t - RL.out1);
      const g = this._g.set(0, -9.8, 0).applyQuaternion(this._qc.copy(this.camera.quaternion).invert());
      this._pB.copy(F.p).addScaledVector(F.v, tau).addScaledVector(g, 0.5 * tau * tau);
      this._qB.copy(F.q).multiply(this._q.setFromAxisAngle(F.w, F.wl * tau));
      // back into the gun's frame
      this._m4.compose(this._pB, this._qB, this._one).premultiply(this._mi.copy(this.gun.matrix).invert());
      this._m4.decompose(D.position, D.quaternion, this._s3);
      D.visible = this._pB.y > -1.2;
      return;
    }
    this.drumFall = null;
    // the fresh drum: it rises into view from below the frame, tilted, held
    // by its rim in the left hand (Hands lays the hand on it), lines up
    // beside the slot, slides in and seats
    const k = sstep(RL.seat0, RL.seat, t);
    const lk = 1 - sstep(RL.line, RL.seat0 + 0.04, t);
    D.position.set(DRUM_C.x - RL.slide * 1.1 * (1 - k), DRUM_C.y, DRUM_C.z);
    D.rotation.set(0.22 * lk, 0.12 * lk, -0.18 * lk);
    if (t < RL.line) {
      // from below the frame (in the eye's frame) up to the slot's line
      D.updateMatrix();
      const m = this._m4.multiplyMatrices(this.gun.matrix, D.matrix);
      m.decompose(this._pA, this._qA, this._s3);
      const u = sstep(RL.rise0 - 0.1, RL.line, t);
      const e = 1 - (1 - u) * (1 - u);
      this._pB.copy(FRESH_LOW.p).lerp(this._pA, e);
      this._qB.copy(FRESH_LOW.q).slerp(this._qA, e);
      this._m4.compose(this._pB, this._qB, this._one).premultiply(this._mi.copy(this.gun.matrix).invert());
      this._m4.decompose(D.position, D.quaternion, this._s3);
      D.visible = t >= RL.rise0 - 0.1;
    }
  }

  // where the drum is as it leaves the slot, in the eye's frame, and how it
  // goes: on with the slide's speed, a little down, tumbling
  _fallStart() {
    const D = this.drumG;
    D.updateMatrix();
    const m = new THREE.Matrix4().multiplyMatrices(this.gun.matrix, D.matrix);
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    m.decompose(p, q, s);
    const side = new THREE.Vector3(-1, 0, 0).transformDirection(this.gun.matrix);
    const v = side.multiplyScalar(0.3).add(new THREE.Vector3(0, -0.1, 0));
    const w = new THREE.Vector3(0.3, 0.2, 1).normalize();
    return { p, q, v, w, wl: 2.6 };
  }

  // mirror the world's lights near the eye into the viewmodel scene
  syncLights(camera) {
    const W = this.world;
    this.hemi.color.copy(W.hemi.color); this.hemi.groundColor.copy(W.hemi.groundColor); this.hemi.intensity = W.hemi.intensity;
    const F = W.flash;
    this.flashP.position.copy(F.position); this.flashP.intensity = F.intensity; this.flashP.distance = F.distance; this.flashP.decay = F.decay;
    // (a lighter's flame in the hands borrows the proxy while no muzzle flash
    // has it: a small warm-white point on both hands, Hands sets `flame`)
    if (this.flame && F.intensity <= 0) {
      this.flashP.position.copy(this.flame); this.flashP.intensity = 0.12; this.flashP.distance = 0.8; this.flashP.decay = 2;
      this.flashP.color.setRGB(1, 0.86, 0.66);
    } else this.flashP.color.setRGB(1, 1, 1);
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
    // (handstudy: `study` is the eye the hands belong to, the camera orbits it)
    this.root.matrix.copy(this.study || camera.matrixWorld);
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
    const tv = Math.tan(THREE.MathUtils.degToRad(this.cam.fov) / 2);
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

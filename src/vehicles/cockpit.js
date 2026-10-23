import * as THREE from 'three';
import { lathe, merge, roundedBox, tube, V3 } from '../world/geom.js';
import { COUPE } from './models.js';
import { KINDS, wellOn } from './kinds.js';

// The cockpit (lane O2): what the driver sees from his seat in any of the
// fleet's cars (vehicles/kinds.js): the dash and its dials, the wheel on its
// column, the mirror, the wipers. One per stage, built from the coupe's own
// (models.js: the same pieces, the same frame) and put into whichever car
// the player sits in, at that kind's seat; the car's model then carries the
// names the cabin and the hands read (wheel, wheelMount, needles, wipers).
//   cockpitInto(stage, car)    the cockpit into a fleet car (and the car's
//                              body opened: its well, no glass, no man)
//   cockpitOut(stage, car)     back out (the car shut again)
//   screenBasis(kind)          the windscreen's rain pane in that kind's screen
let COCK = null;
function build(M) {
  const cabin = [], trim = [], panel = [], dials = [];
  const S = COUPE.screen;
  cabin.push(roundedBox(0.06, 0.46, 1.3, 0.02, 2).translate(0.4, 0.86, 0));
  cabin.push(roundedBox(0.26, 0.04, 1.32, 0.015, 2).translate(0.52, 1.09, 0));
  cabin.push(tube([V3(0.385, 1.085, -0.64), V3(0.378, 1.095, 0), V3(0.385, 1.085, 0.64)], 0.022, 8, 16));
  cabin.push(new THREE.PlaneGeometry(1.9, 1.3).rotateX(-Math.PI / 2).translate(-0.3, 0.64, 0));
  cabin.push(roundedBox(0.55, 0.16, 1.24, 0.06, 3).translate(-0.62, 0.84, 0));
  cabin.push(roundedBox(0.1, 0.05, 1.3, 0.02, 2).translate(S.base - 0.03, S.baseY - 0.005, 0));
  trim.push(roundedBox(0.028, 0.052, 0.17, 0.014, 2).translate(0.36, 1.7, 0.0));
  trim.push(new THREE.CylinderGeometry(0.007, 0.007, 0.06, 6).translate(0.37, 1.76, 0.0));
  {
    const H = COUPE.hub, N = COUPE.wheelN;
    const a = H.clone().addScaledVector(N, -0.04), b = H.clone().addScaledVector(N, -0.52);
    cabin.push(tube([a, a.clone().lerp(b, 0.5), b], 0.026, 10, 6));
  }
  panel.push(roundedBox(0.012, 0.15, 0.3, 0.012, 2).translate(0.372, 0.93, 0.36));
  trim.push(new THREE.CylinderGeometry(0.012, 0.012, 0.01, 12).rotateZ(Math.PI / 2).translate(0.364, 0.97, 0.36));
  for (let i = 0; i < 7; i++) panel.push(roundedBox(0.01, 0.1, 0.012, 0.004, 1).translate(0.372, 0.9, -0.08 + i * 0.022));
  panel.push(roundedBox(0.012, 0.13, 0.19, 0.01, 2).translate(0.374, 0.9, -0.014));
  trim.push(roundedBox(0.008, 0.012, 1.24, 0.004, 1).translate(0.372, 1.055, 0));
  const dz = [[COUPE.eye.z - 0.09, 0.068], [COUPE.eye.z + 0.095, 0.052], [0.05, 0.05]];
  for (const [z, r] of dz) {
    trim.push(new THREE.TorusGeometry(r, 0.007, 6, 28).rotateY(Math.PI / 2).translate(0.368, COUPE.dial.y, z));
    dials.push(new THREE.CircleGeometry(r - 0.004, 28).rotateY(-Math.PI / 2).translate(0.37, COUPE.dial.y, z));
  }
  const g = new THREE.Group();
  g.name = 'cockpit';
  const mk = (list, mat, name) => { const m = new THREE.Mesh(merge(list), mat); m.name = name; m.castShadow = false; m.receiveShadow = true; m.userData.noRay = true; g.add(m); return m; };
  const meshes = {};
  meshes.cabin = mk(cabin, M.iron, 'cabin');
  meshes.trim = mk(trim, M.chrome, 'trim');
  meshes.panel = mk(panel, M.iron, 'panel');
  meshes.dials = mk(dials, new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(0.025) }), 'dials');
  for (const k of ['trim', 'panel', 'dials']) meshes[k].userData.inkSub = true;
  const needleGeo = new THREE.BoxGeometry(0.004, 0.058, 0.006).translate(0, 0.026, 0);
  const needles = [];
  for (const z of [COUPE.eye.z - 0.09, COUPE.eye.z + 0.095]) {
    const n = new THREE.Mesh(needleGeo, M.black);
    n.position.set(0.364, COUPE.dial.y, z); n.rotation.order = 'YXZ'; n.rotation.y = -Math.PI / 2;
    n.userData.noRay = true;
    g.add(n); needles.push(n);
  }
  const wipers = COUPE.wipers.map((p) => {
    const w = new THREE.Group();
    w.position.copy(p);
    const arm = new THREE.Mesh(merge([new THREE.BoxGeometry(0.012, 0.36, 0.006).translate(0, 0.18, 0), new THREE.CylinderGeometry(0.014, 0.014, 0.02, 8).rotateX(Math.PI / 2)]), M.iron);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.4, 0.012).translate(0, 0.2, 0), M.black);
    blade.position.set(0, 0.33, 0.012); blade.rotation.z = 0.02;
    arm.add(blade); w.add(arm);
    arm.rotation.order = 'XYZ';
    arm.userData.noRay = true; blade.userData.noRay = true;
    g.add(w);
    return { pivot: w, arm };
  });
  // the wheel on its mount (models.js's frame: x away from the eye down the column)
  const N = COUPE.wheelN, U = V3(N.y, -N.x, 0);
  if (U.y < 0) U.negate();
  const mount = new THREE.Group();
  mount.name = 'wheelMount';
  mount.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(N.clone().negate(), U, V3(0, 0, 1)));
  mount.position.copy(COUPE.hub);
  const wheel = new THREE.Group();
  wheel.name = 'wheel';
  const R = COUPE.rimR;
  const parts = [new THREE.TorusGeometry(R, 0.0165, 12, 64).rotateY(Math.PI / 2)];
  for (const a of [Math.PI / 4, 3 * Math.PI / 4, 5 * Math.PI / 4, 7 * Math.PI / 4]) {
    const d = V3(0, Math.cos(a), Math.sin(a));
    parts.push(tube([d.clone().multiplyScalar(0.03).add(V3(-0.02, 0, 0)), d.clone().multiplyScalar(R * 0.6).add(V3(-0.012, 0, 0)), d.clone().multiplyScalar(R - 0.01)], 0.0065, 6, 8));
  }
  parts.push(lathe([[0.0, 0.0], [0.045, 0.0], [0.04, 0.025], [0.02, 0.04], [0.0, 0.042]], 20).rotateZ(Math.PI / 2).translate(-0.01, 0, 0).rotateY(Math.PI));
  const wm = new THREE.Mesh(merge(parts), M.iron);
  wm.name = 'wheelRim'; wm.userData.inkSub = true; wm.userData.noRay = true;
  wheel.add(wm); mount.add(wheel); g.add(mount);
  return { group: g, meshes, needles, wipers, wheel, wheelMount: mount, rim: wm };
}

export function cockpitInto(stage, car) {
  const m = car.model;
  if (!m || !m.fleet) return false;
  if (!COCK || COCK.M !== stage.M) { COCK = build(stage.M); COCK.M = stage.M; }
  const K = KINDS[m.kind];
  const C = COCK.group;
  if (C.parent) C.parent.remove(C);
  C.position.set(K.cockpit[0], K.cockpit[1], 0);
  m.group.add(C);
  // (its ink: the car's own slots - the dash a contour of its own against the body)
  const ids = m.group.children.find((o) => o.isMesh && o.userData.inkId != null);
  const base = ids ? ids.userData.inkId : null;
  const sub = m.group.userData.inkSlots && m.group.userData.inkSlots[1] != null ? m.group.userData.inkSlots[1] : null;
  C.traverse((o) => { if (o.isMesh && base != null) { o.userData.inkId = o.userData.inkSub && sub != null ? sub + (base - m.group.userData.inkSlots[0]) : base; o.userData.inkFigure = true; } });
  // (the wipers lie in this kind's screen)
  const S = K.screen, rake = Math.atan2(S.topY - S.baseY, S.base - S.top);
  for (const w of COCK.wipers) w.pivot.rotation.z = Math.PI / 2 - rake;
  m.needles = COCK.needles; m.wipers = COCK.wipers; m.wheel = COCK.wheel; m.wheelMount = COCK.wheelMount;
  m.meshes.wheel = COCK.rim; m.meshes.wheelMount = COCK.wheelMount; m.meshes.wheelGroup = COCK.wheel;
  wellOn(m, true);
  m.group.updateMatrixWorld(true);
  return true;
}
export function cockpitOut(stage, car) {
  const m = car && car.model;
  if (!m || !m.fleet) return;
  if (COCK && COCK.group.parent === m.group) m.group.remove(COCK.group);
  m.needles = null; m.wipers = null; m.wheel = null; m.wheelMount = null;
  wellOn(m, false);
}
// the windscreen's rain pane (tail/screen.js: built in the coupe's screen) in
// a kind's own: the same plane frame, at its scuttle, up its rake, its length
export function screenBasis(kind) {
  const S = KINDS[kind].screen, C = COUPE.screen;
  const rake = Math.atan2(S.topY - S.baseY, S.base - S.top);
  const up = new THREE.Vector3(-Math.cos(rake), Math.sin(rake), 0);
  const across = new THREE.Vector3(0, 0, 1);
  const n = new THREE.Vector3().crossVectors(across, up);
  const k = Math.hypot(S.base - S.top, S.topY - S.baseY) / Math.hypot(C.base - C.top, C.topY - C.baseY);
  return new THREE.Matrix4().makeBasis(across, up.multiplyScalar(k), n).setPosition(S.base - 0.004, S.baseY + 0.005, 0);
}

import * as THREE from 'three';
import { LAYER, allocInkId, markFigure } from '../render/layers.js';
import { makeConeMesh } from '../render/shaders/cone.js';
import { lathe, merge, roundedBox, smoothNormals, tube, V2, V3 } from './geom.js';

// 1930s sedans built from bevelled side-profile extrusions (body, cabin,
// pontoon fenders), lathed headlamps / hubcaps / spare, torus tyres, tube
// bumpers. Local frame: +x forward, +y up, z across. Parts are merged per
// material (5 draw calls a car). Body, glass and wheels get separate ink ids so
// the contour pass outlines windows and wheel arches like an inker would.

const WHEEL_R = 0.375;

function bodyShape() {
  // long hood with an upright grille face, flat belt, short sloped trunk
  const s = new THREE.Shape();
  s.moveTo(-2.24, 0.52);
  s.lineTo(2.16, 0.52);
  s.splineThru([V2(2.27, 0.58), V2(2.31, 0.74), V2(2.3, 0.95), V2(2.22, 1.06)]);
  s.splineThru([V2(1.7, 1.1), V2(1.1, 1.12), V2(0.7, 1.13)]);
  s.lineTo(-1.3, 1.12);
  s.splineThru([V2(-1.72, 1.07), V2(-2.08, 0.93), V2(-2.27, 0.72), V2(-2.29, 0.58)]);
  s.closePath();
  return s;
}

function cabinShape() {
  // tall, upright 1930s greenhouse: steep windshield, high roof, fastback rear
  const s = new THREE.Shape();
  s.moveTo(0.7, 1.04);
  s.lineTo(0.74, 1.1);
  s.lineTo(0.47, 1.58);
  s.quadraticCurveTo(0.4, 1.68, 0.24, 1.69);
  s.splineThru([V2(-0.35, 1.71), V2(-0.9, 1.68)]);
  s.splineThru([V2(-1.2, 1.56), V2(-1.46, 1.36), V2(-1.68, 1.12)]);
  s.lineTo(-1.7, 1.04);
  s.closePath();
  return s;
}

function fenderShape(front) {
  const s = new THREE.Shape();
  if (front) {
    // tall pontoon fender: rises from the bumper, crowns over the wheel,
    // then sweeps down and back into the running board
    s.moveTo(0.32, 0.47);
    s.splineThru([V2(0.62, 0.6), V2(0.98, 0.86), V2(1.4, 1.04), V2(1.85, 1.07), V2(2.18, 0.96), V2(2.38, 0.72), V2(2.42, 0.52)]);
    s.lineTo(2.08, 0.49);
    for (let i = 0; i <= 28; i++) {
      const a = 0.2 + (i / 28) * (Math.PI - 0.4);
      s.lineTo(1.55 + 0.48 * Math.cos(a), 0.38 + 0.48 * Math.sin(a));
    }
    s.lineTo(0.8, 0.45);
  } else {
    s.moveTo(-0.88, 0.47);
    s.splineThru([V2(-1.02, 0.72), V2(-1.32, 0.94), V2(-1.75, 1.0), V2(-2.1, 0.9), V2(-2.34, 0.66), V2(-2.37, 0.49)]);
    s.lineTo(-2.06, 0.49);
    for (let i = 0; i <= 28; i++) {
      const a = Math.PI - 0.2 - (i / 28) * (Math.PI - 0.4);
      s.lineTo(-1.55 + 0.47 * Math.cos(a), 0.38 + 0.47 * Math.sin(a));
    }
  }
  s.closePath();
  return s;
}

function extrude(shape, depth, bt, bs, seg = 5) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bt, bevelSize: bs, bevelSegments: seg, curveSegments: 20 });
  g.translate(0, 0, -depth / 2);
  return smoothNormals(g, 1e-4);
}

function flatShape(points, round = 0.04) {
  // polygon with softly rounded corners
  const s = new THREE.Shape();
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n], p1 = points[i], p2 = points[(i + 1) % n];
    const a = p1.clone().sub(p0).normalize(), b = p2.clone().sub(p1).normalize();
    const q0 = p1.clone().addScaledVector(a, -round), q1 = p1.clone().addScaledVector(b, round);
    if (i === 0) s.moveTo(q0.x, q0.y); else s.lineTo(q0.x, q0.y);
    s.quadraticCurveTo(p1.x, p1.y, q1.x, q1.y);
  }
  s.closePath();
  return s;
}

// thin pane lying on the straight cabin segment a->b, pushed out by `off`
function paneOnSegment(a, b, off, height, width, z) {
  const t = b.clone().sub(a);
  const len = t.length();
  t.normalize();
  const n = V2(t.y, -t.x); // outward for our clockwise-ish traversal
  const c = a.clone().add(b).multiplyScalar(0.5).addScaledVector(n, off);
  const g = roundedBox(0.012, Math.min(height, len * 0.86), width, 0.004, 2);
  const ang = Math.atan2(-t.x, t.y);
  g.rotateZ(ang);
  g.translate(c.x, c.y, z);
  return g;
}

// Soft contact shadow under a car: dark footprint + darker wheel patches.
// Without it the black cars float on their own reflections.
let CONTACT = null;
function contactMaterial() {
  if (CONTACT) return CONTACT;
  const W = 256, H = 128;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.filter = 'blur(10px)';
  g.fillStyle = 'rgba(0,0,0,0.75)';
  g.beginPath();
  g.roundRect(W * 0.1, H * 0.2, W * 0.8, H * 0.6, 26);
  g.fill();
  g.filter = 'blur(5px)';
  g.fillStyle = 'rgba(0,0,0,0.95)';
  for (const [u, v] of [[0.21, 0.24], [0.79, 0.24], [0.21, 0.76], [0.79, 0.76]]) {
    g.beginPath();
    g.ellipse(u * W, v * H, W * 0.07, H * 0.1, 0, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  CONTACT = new THREE.MeshBasicMaterial({
    color: 0x000000, alphaMap: tex, transparent: true, depthWrite: false, fog: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  return CONTACT;
}

let TEMPLATE = null;
function buildTemplate() {
  const paint = [], chrome = [], rubber = [], glass = [], lenses = [], dark = [], white = [], hubs = [], seams = [], caps = [];
  const BODY_D = 1.2, BODY_BT = 0.1, BODY_BS = 0.08;
  const CAB_D = 1.0, CAB_BT = 0.12, CAB_BS = 0.09;
  paint.push(extrude(bodyShape(), BODY_D, BODY_BT, BODY_BS, 6));
  paint.push(extrude(cabinShape(), CAB_D, CAB_BT, CAB_BS, 6));
  const bodyHalf = BODY_D / 2 + BODY_BT;   // 0.70
  const cabHalf = CAB_D / 2 + CAB_BT;      // 0.62
  for (const sgn of [1, -1]) {
    const ff = extrude(fenderShape(true), 0.22, 0.07, 0.06, 6);
    ff.translate(0, 0, sgn * 0.78);
    const rf = extrude(fenderShape(false), 0.2, 0.07, 0.06, 6);
    rf.translate(0, 0, sgn * 0.76);
    paint.push(ff, rf);
    // running board
    rubber.push(roundedBox(1.3, 0.05, 0.26, 0.02, 2).translate(-0.3, 0.445, sgn * 0.77));
    // side windows (flat panes on the cabin's flat side)
    const zf = sgn * (cabHalf + 0.004);
    const w1 = flatShape([V2(0.6, 1.18), V2(0.4, 1.55), V2(-0.26, 1.6), V2(-0.26, 1.18)], 0.05);
    const w2 = flatShape([V2(-0.36, 1.18), V2(-0.36, 1.6), V2(-0.88, 1.57), V2(-1.22, 1.38), V2(-1.38, 1.18)], 0.06);
    for (const w of [w1, w2]) {
      const g = new THREE.ExtrudeGeometry(w, { depth: 0.006, bevelEnabled: false, curveSegments: 6 });
      g.translate(0, 0, zf - 0.003);
      glass.push(g);
    }
    // door seams: front door edge (behind the front fender), B-pillar line,
    // rear door edge (ahead of the rear fender); proud of the body side
    const zs = sgn * (bodyHalf + 0.004);
    for (const [x0, y0, x1, y1] of [[0.66, 1.06, 0.6, 0.52], [-0.31, 1.07, -0.31, 0.5], [-0.98, 1.05, -0.9, 0.55]]) {
      seams.push(tube([V3(x0, y0, zs), V3((x0 + x1) / 2, (y0 + y1) / 2, zs * 1.003), V3(x1, y1, zs)], 0.007, 5, 8));
    }
    // cabin side seam: the B-pillar between the two panes
    seams.push(tube([V3(-0.31, 1.13, sgn * (cabHalf + 0.003)), V3(-0.31, 1.6, sgn * (cabHalf + 0.003))], 0.006, 5, 4));
    // chrome belt trim along the body side
    chrome.push(tube([V3(2.1, 1.02, sgn * (bodyHalf - 0.02)), V3(0.6, 1.07, sgn * (bodyHalf + 0.005)), V3(-0.5, 1.07, sgn * (bodyHalf + 0.005)), V3(-1.6, 1.02, sgn * (bodyHalf - 0.01))], 0.012, 6, 32));
    // wheels
    for (const [wx, wz] of [[1.55, 0.78], [-1.55, 0.76]]) {
      const tyre = new THREE.TorusGeometry(0.27, 0.105, 16, 40).translate(wx, WHEEL_R, sgn * wz);
      // whitewall: ONE thin pale ring that makes a black 1930s tyre read in
      // ink (a wide band plus a chrome hubcap ring read as a bullseye)
      // (it sits just proud of the torus sidewall: a ring placed inside the
      // tyre's bulge is half hidden and shows as two concentric circles)
      // drawn as the lit upper arc only, the way an inker would pick it out
      const ww = new THREE.RingGeometry(0.25, 0.265, 48, 1, -0.25, Math.PI + 0.5);
      if (sgn < 0) ww.rotateY(Math.PI);
      white.push(ww.translate(wx, WHEEL_R, sgn * (wz + 0.108)));
      rubber.push(tyre);
      // (profile runs bottom-up so LatheGeometry's faces point outward)
      const hub = lathe([[0.25, -0.02], [0.23, 0.01], [0.17, 0.045], [0.08, 0.07], [0.0, 0.075]], 28).rotateX(sgn * Math.PI / 2).translate(wx, WHEEL_R, sgn * (wz + 0.03));
      hubs.push(hub);
      // small chrome cap dot at the hub centre
      caps.push(lathe([[0.06, -0.01], [0.055, 0.01], [0.035, 0.025], [0.0, 0.03]], 20).rotateX(sgn * Math.PI / 2).translate(wx, WHEEL_R, sgn * (wz + 0.1)));
      const disc = new THREE.CylinderGeometry(0.26, 0.26, 0.12, 28).rotateX(Math.PI / 2).translate(wx, WHEEL_R, sgn * wz);
      dark.push(disc);
    }
    // headlamps: bullet shells on stalks, lens facing +x
    const hl = lathe([[0.0, -0.25], [0.05, -0.23], [0.1, -0.17], [0.13, -0.09], [0.145, 0.0], [0.15, 0.03], [0.135, 0.045]], 28);
    hl.rotateZ(-Math.PI / 2).translate(2.26, 0.98, sgn * 0.6);
    chrome.push(hl);
    chrome.push(new THREE.CylinderGeometry(0.03, 0.04, 0.12, 8).translate(2.14, 0.88, sgn * 0.6));
    const lens = new THREE.CircleGeometry(0.128, 28).rotateY(Math.PI / 2).translate(2.26 + 0.047, 0.98, sgn * 0.6);
    lenses.push(lens);
    // taillights
    dark.push(lathe([[0, -0.08], [0.04, -0.06], [0.05, 0.0], [0.035, 0.03]], 16).rotateZ(Math.PI / 2).translate(-2.3, 0.84, sgn * 0.74));
  }
  // windshield (split) and rear window
  const ws0 = V2(0.74 + CAB_BS * 0.3, 1.1), ws1 = V2(0.47 + CAB_BS * 0.3, 1.58);
  glass.push(paneOnSegment(ws0, ws1, CAB_BS * 0.8, 0.48, 0.44, 0.245));
  glass.push(paneOnSegment(ws0, ws1, CAB_BS * 0.8, 0.48, 0.44, -0.245));
  const rw0 = V2(-1.46, 1.36), rw1 = V2(-1.2, 1.56);
  glass.push(paneOnSegment(rw1, rw0, CAB_BS * 0.9, 0.3, 0.62, 0));
  // grille shield + bars
  const gs = new THREE.Shape();
  gs.moveTo(-0.22, 0.52);
  gs.lineTo(0.22, 0.52);
  gs.quadraticCurveTo(0.25, 0.86, 0.0, 1.08);
  gs.quadraticCurveTo(-0.25, 0.86, -0.22, 0.52);
  const grille = new THREE.ExtrudeGeometry(gs, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 16 });
  grille.rotateY(Math.PI / 2).translate(2.3, 0, 0);
  dark.push(smoothNormals(grille, 1e-4));
  for (let z = -0.16; z <= 0.161; z += 0.04) {
    const top = 1.05 - Math.pow(Math.abs(z) / 0.23, 2) * 0.36;
    chrome.push(new THREE.CylinderGeometry(0.009, 0.009, top - 0.55, 6).translate(2.39, (top + 0.55) / 2, z));
  }
  // hood centre strip + ornament
  chrome.push(tube([V3(0.76, 1.145, 0), V3(1.4, 1.14, 0), V3(2.0, 1.12, 0), V3(2.26, 1.08, 0)], 0.014, 6, 24));
  chrome.push(lathe([[0, 0], [0.03, 0.01], [0.025, 0.06], [0.006, 0.12], [0, 0.13]], 12).translate(2.2, 1.09, 0));
  // bumpers
  const bump = (x, s) => {
    const g = tube([V3(x - s * 0.1, 0.46, -0.95), V3(x, 0.46, -0.55), V3(x + s * 0.03, 0.46, 0), V3(x, 0.46, 0.55), V3(x - s * 0.1, 0.46, 0.95)], 0.05, 10, 48);
    g.translate(0, -0.46, 0).scale(1, 1.7, 1).translate(0, 0.46, 0);
    chrome.push(g);
    for (const z of [-0.35, 0.35]) chrome.push(new THREE.CapsuleGeometry(0.035, 0.2, 4, 10).translate(x + s * 0.03, 0.5, z));
    chrome.push(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 8).rotateZ(Math.PI / 2).translate(x - s * 0.15, 0.46, -0.45));
    chrome.push(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 8).rotateZ(Math.PI / 2).translate(x - s * 0.15, 0.46, 0.45));
  };
  bump(2.55, 1);
  bump(-2.55, -1);
  // underbody skirt: under a real car it is dark; without this the lit street
  // and its reflections show through the gap and the car seems to float.
  // Its own unlit black mesh: the mirrored camera sees it from below, where a
  // lit material (hemisphere ground light, env) came back as a grey plate in
  // the puddle under every car; the reference's water under a car is dead black
  const skirt = roundedBox(3.3, 0.4, 1.36, 0.08, 2).translate(0.0, 0.3, 0);
  // spare tyre on the turtle deck
  const spareAxis = V3(-0.78, 0.62, 0).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 0, 1), spareAxis);
  const spare = new THREE.TorusGeometry(0.23, 0.09, 14, 36).applyQuaternion(q).translate(-2.31, 0.8, 0);
  rubber.push(spare);
  const cover = lathe([[0.27, -0.03], [0.22, 0.02], [0.12, 0.06], [0, 0.07]], 28).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), spareAxis)).translate(-2.34, 0.82, 0);
  paint.push(cover);

  TEMPLATE = {
    paint: merge(paint), chrome: merge(chrome), rubber: merge(rubber), glass: merge(glass), lenses: merge(lenses), dark: merge(dark), white: merge(white), hubs: merge(hubs),
    seams: merge(seams), caps: merge(caps), skirt,
  };
  return TEMPLATE;
}

export class Cars {
  constructor(world) {
    this.world = world;
    this.cars = [];
    const T = TEMPLATE || buildTemplate();
    this.T = T;
    const specs = [
      { pos: V3(2.6, 0, -27), yaw: -1.2, lights: false, paint: 'paint' },
      // parked under the el, ~14 m from the street view and cropped by the
      // right edge of the frame like the reference's big black car, leaving
      // the mid-ground (the cars at 18-50 m) open; shot=cars frames it at 6 m
      { pos: V3(6.5, 0, -19.0), yaw: 2.55, lights: false, paint: 'paint' },
      // the car down the middle of the street view: black like the
      // reference's far sedan (a grey paint prints as clay in the mist)
      { pos: V3(-4.3, 0, -25.0), yaw: Math.PI / 2 - 0.05, lights: false, paint: 'paint' },
      // (these two moved with the el: they stand between its column pairs)
      { pos: V3(14.4, 0, -5.5), yaw: 1.76, lights: false, paint: 'paint' },
      { pos: V3(-4.1, 0, -57), yaw: Math.PI / 2, lights: false, paint: 'paintGrey' },
      { pos: V3(9.4, 0, -61.5), yaw: -2.55, lights: true, paint: 'paint' },
      { pos: V3(0.8, 0, -97), yaw: -1.62, lights: false, paint: 'paint' },
      { pos: V3(-3.9, 0, 21), yaw: Math.PI / 2 + 0.05, lights: false, paint: 'paint' },
    ];
    for (const s of specs) this.cars.push(this.spawn(s));
  }

  spawn({ pos, yaw, lights, paint }) {
    const { M, scene, colliders, U } = this.world;
    const T = this.T;
    const g = new THREE.Group();
    g.position.copy(pos);
    g.rotation.y = yaw;
    const bodyId = allocInkId(), glassId = allocInkId(), wheelId = allocInkId(), seamId = allocInkId();
    // slight per-car variation: not every sedan carries whitewalls
    const rv = Math.abs(Math.sin(pos.x * 12.9898 + pos.z * 78.233)) % 1;
    const add = (geo, mat, id) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true; m.receiveShadow = true;
      m.userData.inkId = id;
      g.add(m);
      return m;
    };
    add(T.paint, M[paint], bodyId);
    add(T.chrome, M.chrome, bodyId);
    add(T.dark, M.rubber, bodyId);
    add(T.skirt, M.black, bodyId);
    add(T.rubber, M.rubber, wheelId);
    if (rv > 0.35) add(T.white, M.whitewall, wheelId);
    add(T.hubs, M.hubcap, wheelId);
    add(T.caps, M.chrome, wheelId);
    add(T.glass, M.carGlass, glassId);
    add(T.seams, M.seam, seamId);
    const lens = add(T.lenses, lights ? M.headlamp : M.glass, bodyId);
    // contact shadow (FX layer: main pass only, never reflected or outlined)
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(5.7, 2.5).rotateX(-Math.PI / 2), contactMaterial());
    shadow.position.y = 0.012;
    shadow.layers.set(LAYER.FX);
    shadow.renderOrder = 1;
    g.add(shadow);
    markFigure(g);
    scene.add(g);
    g.updateMatrixWorld(true);
    const car = { group: g, pos, yaw, lights, lens, spot: null, cones: [], entry: null, health: 100 };
    colliders.addBox(pos.x, pos.z, 2.6, 1.0, yaw, 'car');
    if (lights) {
      const toW = (v) => v.clone().applyMatrix4(g.matrixWorld);
      const fwd = V3(1, -0.1, 0).normalize().transformDirection(g.matrixWorld);
      const spot = new THREE.SpotLight(0xffffff, 110, 30, 0.4, 0.6, 2.0);
      spot.position.copy(toW(V3(2.75, 1.0, 0)));
      spot.target.position.copy(toW(V3(14, -0.4, 0)));
      scene.add(spot, spot.target);
      car.spot = spot;
      for (const z of [0.6, -0.6]) {
        const apex = toW(V3(2.34, 0.98, z));
        const cone = makeConeMesh(U, { apex, axis: fwd, tan: 0.24, height: 11, r0: 0.11, intensity: 0.2, seed: z * 7 });
        cone.layers.set(LAYER.VOLUME);
        scene.add(cone);
        car.cones.push(cone);
      }
      car.entry = this.world.lights.add({ position: toW(V3(2.2, 1.05, 0)), direction: fwd.clone(), halfAngle: 0.3, range: 16, intensity: 0.7 });
    }
    return car;
  }
}

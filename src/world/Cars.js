import * as THREE from 'three';
import { LAYER, allocInkId, markFigure } from '../render/layers.js';
import { makeConeMesh } from '../render/shaders/cone.js';
import { lathe, merge, roundedBox, smoothNormals, tube, V2, V3 } from './geom.js';
import { Fire } from '../fx/Fire.js';
import { FIRE } from '../fx/fxTextures.js';

const FIRE_CELL_SHARD = FIRE.SHARD;
const FIRE_CELL_SMOKE = FIRE.SMOKE;

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

// CQ scales the template's segment counts (Phase 3b: the far build, CQ
// 0.4, for cars beyond FAR_LOD m - a 4.5 m sedan ~70 px long prints the same
// with a third of the triangles; its clearcoat body was 33k of them)
let CQ = 1;
const cq = (n, min = 3) => Math.max(min, Math.round(n * CQ));
const FAR_LOD = 36;
function extrude(shape, depth, bt, bs, seg = 5) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bt, bevelSize: bs, bevelSegments: cq(seg, 2), curveSegments: cq(20, 8) });
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

let TEMPLATE = null, TEMPLATE_LO = null;
function buildTemplate(q = 1) {
  CQ = q;
  try { return buildTemplateParts(); } finally { CQ = 1; }
}
function buildTemplateParts() {
  const paint = [], chrome = [], rubber = [], glass = [], lenses = [], dark = [], white = [], hubs = [], seams = [], caps = [];
  // Phase 3a: every pane and headlamp lens is also kept on its own, so a
  // car's glass can be rebuilt without the ones that were shot out
  const panes = [], lensParts = [];
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
    panes.push({ geo: glass[glass.length - 2], c: V3(0.15, 1.39, sgn * cabHalf), n: V3(0, 0, sgn), w: 0.9 });
    panes.push({ geo: glass[glass.length - 1], c: V3(-0.8, 1.38, sgn * cabHalf), n: V3(0, 0, sgn), w: 0.9 });
    // door seams: front door edge (behind the front fender), B-pillar line,
    // rear door edge (ahead of the rear fender); proud of the body side
    const zs = sgn * (bodyHalf + 0.004);
    for (const [x0, y0, x1, y1] of [[0.66, 1.06, 0.6, 0.52], [-0.31, 1.07, -0.31, 0.5], [-0.98, 1.05, -0.9, 0.55]]) {
      seams.push(tube([V3(x0, y0, zs), V3((x0 + x1) / 2, (y0 + y1) / 2, zs * 1.003), V3(x1, y1, zs)], 0.007, 5, 8));
    }
    // cabin side seam: the B-pillar between the two panes
    seams.push(tube([V3(-0.31, 1.13, sgn * (cabHalf + 0.003)), V3(-0.31, 1.6, sgn * (cabHalf + 0.003))], 0.006, 5, 4));
    // chrome belt trim along the body side
    chrome.push(tube([V3(2.1, 1.02, sgn * (bodyHalf - 0.02)), V3(0.6, 1.07, sgn * (bodyHalf + 0.005)), V3(-0.5, 1.07, sgn * (bodyHalf + 0.005)), V3(-1.6, 1.02, sgn * (bodyHalf - 0.01))], 0.012, cq(6, 4), cq(32, 12)));
    // wheels
    for (const [wx, wz] of [[1.55, 0.78], [-1.55, 0.76]]) {
      const tyre = new THREE.TorusGeometry(0.27, 0.105, cq(16, 8), cq(40, 16)).translate(wx, WHEEL_R, sgn * wz);
      // whitewall: ONE thin pale ring that makes a black 1930s tyre read in
      // ink (a wide band plus a chrome hubcap ring read as a bullseye)
      // (it sits just proud of the torus sidewall: a ring placed inside the
      // tyre's bulge is half hidden and shows as two concentric circles)
      // drawn as the lit upper arc only, the way an inker would pick it out
      const ww = new THREE.RingGeometry(0.25, 0.265, cq(48, 16), 1, -0.25, Math.PI + 0.5);
      if (sgn < 0) ww.rotateY(Math.PI);
      white.push(ww.translate(wx, WHEEL_R, sgn * (wz + 0.108)));
      rubber.push(tyre);
      // (profile runs bottom-up so LatheGeometry's faces point outward)
      const hub = lathe([[0.25, -0.02], [0.23, 0.01], [0.17, 0.045], [0.08, 0.07], [0.0, 0.075]], cq(28, 12)).rotateX(sgn * Math.PI / 2).translate(wx, WHEEL_R, sgn * (wz + 0.03));
      hubs.push(hub);
      // small chrome cap dot at the hub centre
      caps.push(lathe([[0.06, -0.01], [0.055, 0.01], [0.035, 0.025], [0.0, 0.03]], cq(20, 8)).rotateX(sgn * Math.PI / 2).translate(wx, WHEEL_R, sgn * (wz + 0.1)));
      const disc = new THREE.CylinderGeometry(0.26, 0.26, 0.12, cq(28, 12)).rotateX(Math.PI / 2).translate(wx, WHEEL_R, sgn * wz);
      dark.push(disc);
    }
    // headlamps: bullet shells on stalks, lens facing +x
    const hl = lathe([[0.0, -0.25], [0.05, -0.23], [0.1, -0.17], [0.13, -0.09], [0.145, 0.0], [0.15, 0.03], [0.135, 0.045]], cq(28, 12));
    hl.rotateZ(-Math.PI / 2).translate(2.26, 0.98, sgn * 0.6);
    chrome.push(hl);
    chrome.push(new THREE.CylinderGeometry(0.03, 0.04, 0.12, 8).translate(2.14, 0.88, sgn * 0.6));
    const lens = new THREE.CircleGeometry(0.128, 28).rotateY(Math.PI / 2).translate(2.26 + 0.047, 0.98, sgn * 0.6);
    lenses.push(lens);
    lensParts.push({ geo: lens, c: V3(2.307, 0.98, sgn * 0.6), n: V3(1, 0, 0), side: sgn });
    // taillights
    dark.push(lathe([[0, -0.08], [0.04, -0.06], [0.05, 0.0], [0.035, 0.03]], cq(16, 8)).rotateZ(Math.PI / 2).translate(-2.3, 0.84, sgn * 0.74));
  }
  // windshield (split) and rear window
  const ws0 = V2(0.74 + CAB_BS * 0.3, 1.1), ws1 = V2(0.47 + CAB_BS * 0.3, 1.58);
  glass.push(paneOnSegment(ws0, ws1, CAB_BS * 0.8, 0.48, 0.44, 0.245));
  panes.push({ geo: glass[glass.length - 1], c: V3(0.64, 1.34, 0.245), n: V3(0.87, 0.49, 0), w: 0.45 });
  glass.push(paneOnSegment(ws0, ws1, CAB_BS * 0.8, 0.48, 0.44, -0.245));
  panes.push({ geo: glass[glass.length - 1], c: V3(0.64, 1.34, -0.245), n: V3(0.87, 0.49, 0), w: 0.45 });
  const rw0 = V2(-1.46, 1.36), rw1 = V2(-1.2, 1.56);
  glass.push(paneOnSegment(rw1, rw0, CAB_BS * 0.9, 0.3, 0.62, 0));
  panes.push({ geo: glass[glass.length - 1], c: V3(-1.37, 1.47, 0), n: V3(-0.6, 0.8, 0), w: 0.6 });
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
  chrome.push(tube([V3(0.76, 1.145, 0), V3(1.4, 1.14, 0), V3(2.0, 1.12, 0), V3(2.26, 1.08, 0)], 0.014, cq(6, 4), cq(24, 10)));
  chrome.push(lathe([[0, 0], [0.03, 0.01], [0.025, 0.06], [0.006, 0.12], [0, 0.13]], 12).translate(2.2, 1.09, 0));
  // bumpers
  const bump = (x, s) => {
    const g = tube([V3(x - s * 0.1, 0.46, -0.95), V3(x, 0.46, -0.55), V3(x + s * 0.03, 0.46, 0), V3(x, 0.46, 0.55), V3(x - s * 0.1, 0.46, 0.95)], 0.05, cq(10, 6), cq(48, 16));
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
  const spare = new THREE.TorusGeometry(0.23, 0.09, cq(14, 8), cq(36, 14)).applyQuaternion(q).translate(-2.31, 0.8, 0);
  rubber.push(spare);
  const cover = lathe([[0.27, -0.03], [0.22, 0.02], [0.12, 0.06], [0, 0.07]], cq(28, 12)).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), spareAxis)).translate(-2.34, 0.82, 0);
  paint.push(cover);

  return {
    paint: merge(paint), chrome: merge(chrome), rubber: merge(rubber), glass: merge(glass), lenses: merge(lenses), dark: merge(dark), white: merge(white), hubs: merge(hubs),
    seams: merge(seams), caps: merge(caps), skirt, panes, lensParts,
  };
}
// the parts whose geometry is shared by every car (never rebuilt per car:
// the glass and the lenses are) swap to the far build beyond FAR_LOD m
const LOD_PARTS = ['paint', 'chrome', 'dark', 'rubber', 'white', 'hubs', 'caps', 'seams'];

// ---------------------------------------------------------------------------
// Damage (Phase 3a). Bullets are dispatched here by the game (game/React.js)
// with the RayWorld hit; the part is told by the mesh (userData.part) and
// the hit point in the car's frame:
//   glass  - the first round spider-cracks the pane (a crack decal), the
//            second shatters it: the pane leaves the car's glass geometry,
//            its cracks go, shards fall
//   lens   - the headlamp breaks: lens gone, shards, its light off
//   rubber - near a wheel: the tyre hisses flat and the car sags onto it
//   body   - a dark bullet mark (fx/Impacts) and damage
// At SMOKE_AT the bonnet starts smoking (the 10 s warning: the Hoods clear
// out, HoodAI hazards); every round into a smoking car shortens the fuse;
// then it explodes (fx/Explosion.js) and burns (fx/Fire.js): a blackened,
// sagging wreck that still stops bullets and men.
// (Phase 3a review: a long battle blew three cars in 100 s. A round into the
// body counts in full only on the engine bay - the front ~1.6 m, the bonnet
// and grille - elsewhere 0.4x; glass and tyres count less too. It takes
// ~14 rounds into the engine bay, or a long spray at a man behind the car,
// to set it smoking. And at most TWO cars may be going up or roaring at
// once: a third one reaching the smoke state fizzles - a thin grey smoke
// that dies away - and it stays a dead, unexploded car.)
const DMG = { body: 4.5, glass: 1.0, lens: 1.5, tyre: 1.5 };
const BAY_X = 0.6;           // local x forward of which a body round hits the engine bay
const OFF_BAY = 0.4;         // damage share of a body round elsewhere
const SMOKE_AT = 36;
const MAX_BLAZES = 2;        // smoking-to-blow + roaring wrecks at once
export const FUSE = 10;       // s of warning smoke before the blast
// the warning smoke's grey (linear; prints ~0.5 display: render/tone.js)
const SMOKE_GREY = 0.066;
const WHEELS = [[1.55, 0.78], [1.55, -0.78], [-1.55, 0.76], [-1.55, -0.76]];
const _l = new THREE.Vector3(), _n = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion();

export class Cars {
  constructor(world) {
    this.world = world;
    this.cars = [];
    this.rng = world.rng.fork(4447);
    const T = TEMPLATE || (TEMPLATE = buildTemplate());
    this.T = T;
    this.TL = TEMPLATE_LO || (TEMPLATE_LO = buildTemplate(0.4));
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
    this.game = null;        // bound by the Game (effects, sound, Hoods)
    this.fires = [];
  }

  bind(game) { this.game = game; }

  spawn({ pos, yaw, lights, paint }) {
    const { M, scene, colliders, U } = this.world;
    const T = this.T;
    const g = new THREE.Group();
    g.position.copy(pos);
    g.rotation.y = yaw;
    const bodyId = allocInkId(), glassId = allocInkId(), wheelId = allocInkId(), seamId = allocInkId();
    // slight per-car variation: not every sedan carries whitewalls
    const rv = Math.abs(Math.sin(pos.x * 12.9898 + pos.z * 78.233)) % 1;
    const meshes = {};
    const add = (key, geo, mat, id, part) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true; m.receiveShadow = true;
      m.userData.inkId = id;
      m.userData.part = part;
      g.add(m);
      meshes[key] = m;
      return m;
    };
    add('paint', T.paint, M[paint], bodyId, 'body');
    add('chrome', T.chrome, M.chrome, bodyId, 'body');
    add('dark', T.dark, M.rubber, bodyId, 'body');
    add('skirt', T.skirt, M.black, bodyId, 'body');
    add('rubber', T.rubber, M.rubber, wheelId, 'rubber');
    if (rv > 0.35) add('white', T.white, M.whitewall, wheelId, 'rubber');
    add('hubs', T.hubs, M.hubcap, wheelId, 'rubber');
    add('caps', T.caps, M.chrome, wheelId, 'rubber');
    // glass and lenses: this car's own merged copy (rebuilt as panes go)
    add('glass', merge(T.panes.map((p) => p.geo.clone())), M.carGlass, glassId, 'glass');
    add('seams', T.seams, M.seam, seamId, 'body');
    const lens = add('lens', merge(T.lensParts.map((p) => p.geo.clone())), lights ? M.headlamp : M.glass, bodyId, 'lens');
    for (const k of ['glass', 'lens']) meshes[k].userData.surf = 'glass';
    // contact shadow (FX layer: main pass only, never reflected or outlined)
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(5.7, 2.5).rotateX(-Math.PI / 2), contactMaterial());
    shadow.position.y = 0.012;
    shadow.layers.set(LAYER.FX);
    shadow.renderOrder = 1;
    g.add(shadow);
    markFigure(g);
    scene.add(g);
    g.updateMatrixWorld(true);
    const car = {
      id: this.cars.length, group: g, pos, yaw, lights, lens, spot: null, cones: [], entry: null, health: 100, meshes,
      state: 'intact',           // intact -> smoking -> burning (a wreck), or smoking (a dud) -> dead
      panes: T.panes.map(() => ({ hits: 0, broken: false })), lensBroken: [false, false],
      tyres: [0, 0, 0, 0], sag: [0, 0, 0, 0], extraSag: 0, tilt: [0, 0], fuse: FUSE, smokeT: 0, smokeAcc: 0,
      hits: 0, fire: null, wreckT: 0, dud: false, lod: 0,
    };
    g.traverse((o) => { if (o.isMesh) o.userData.car = car; });
    car.collider = colliders.addBox(pos.x, pos.z, 2.6, 1.0, yaw, 'car');
    car.collider.car = car;
    if (lights) {
      const toW = (v) => v.clone().applyMatrix4(g.matrixWorld);
      const fwd = V3(1, -0.1, 0).normalize().transformDirection(g.matrixWorld);
      const spot = new THREE.SpotLight(0xffffff, 110, 30, 0.4, 0.6, 2.0);
      spot.position.copy(toW(V3(2.75, 1.0, 0)));
      spot.target.position.copy(toW(V3(14, -0.4, 0)));
      scene.add(spot, spot.target);
      car.spot = spot;
      car.spotI = spot.intensity;
      for (const z of [0.6, -0.6]) {
        const apex = toW(V3(2.34, 0.98, z));
        const cone = makeConeMesh(U, { apex, axis: fwd, tan: 0.24, height: 11, r0: 0.11, intensity: 0.2, seed: z * 7 });
        cone.layers.set(LAYER.VOLUME);
        cone.userData.side = Math.sign(z);
        scene.add(cone);
        car.cones.push(cone);
      }
      car.entry = this.world.lights.add({ position: toW(V3(2.2, 1.05, 0)), direction: fwd.clone(), halfAngle: 0.3, range: 16, intensity: 0.7 });
    }
    return car;
  }

  // the car's frame: world -> local
  local(car, p, out = _l) { return out.copy(p).applyMatrix4(_m.copy(car.group.matrixWorld).invert()); }
  toWorld(car, v) { return v.clone().applyMatrix4(car.group.matrixWorld); }
  engine(car) { return this.toWorld(car, V3(1.45, 1.0, 0)); }

  // a bullet hit one of this car's meshes; returns 'glass' when the pane's
  // own effect replaces the generic impact, else null (sparks + mark)
  hit(car, hit, dir, { weak = false } = {}) {
    const G = this.game, r = this.rng;
    if (!G) return null;
    let part = hit.mesh.userData.part;
    const lp = this.local(car, hit.point);
    // (the lenses sit inside the headlamp shells, half buried in the body's
    // front bevel: a round that lands within a lamp's rim breaks it)
    if (part !== 'lens') {
      for (let i = 0; i < 2; i++) if (!car.lensBroken[i] && this.T.lensParts[i].c.distanceTo(lp) < 0.2) part = 'lens';
    }
    car.hits++;
    if (car.state === 'burning') return null;
    let dmg = DMG.body * (lp.x > BAY_X ? 1 : OFF_BAY), out = null;
    if (part === 'glass') {
      // nearest pane (by centre, in the car's frame)
      let bi = -1, bd = Infinity;
      car.panes.forEach((p, i) => { if (p.broken) return; const d = this.T.panes[i].c.distanceToSquared(lp); if (d < bd) { bd = d; bi = i; } });
      if (bi >= 0) {
        const P = car.panes[bi];
        P.hits++;
        dmg = DMG.glass;
        if (P.hits >= 2) this.shatter(car, bi);
        else {
          G.fx.decals.crack(hit.point, hit.normal, r.range(0.32, 0.46) * this.T.panes[bi].w / 0.9 + 0.1, 'car' + car.id + ':' + bi);
          G.sfx.glass(hit.point, 0.35);
        }
        out = 'glass';
      }
    } else if (part === 'lens') {
      // (lensParts[0] is the +z lamp: sgn 1 was pushed first)
      const side = lp.z > 0 ? 0 : 1;
      if (!car.lensBroken[side]) this.breakLens(car, side);
      else if (!car.lensBroken[1 - side]) this.breakLens(car, 1 - side);
      dmg = DMG.lens;
      out = 'glass';
    } else if (part === 'rubber') {
      let wi = -1, wd = 0.5 * 0.5;
      WHEELS.forEach(([x, z], i) => { const d = (lp.x - x) ** 2 + (lp.y - 0.375) ** 2 + (lp.z - z) ** 2; if (d < wd) { wd = d; wi = i; } });
      if (wi >= 0) {
        dmg = DMG.tyre;
        if (!car.tyres[wi]) { car.tyres[wi] = 1; G.sfx.tyre(hit.point); }
      }
    }
    // (a Hood's stray round cracks glass and marks the paint, but it takes
    // the player's sustained fire to set a car smoking)
    this.damage(car, weak ? dmg * 0.15 : dmg);
    return out;
  }

  damage(car, dmg) {
    if (car.state === 'burning' || car.state === 'dead') return;
    car.health -= dmg;
    if (car.state === 'intact' && car.health <= SMOKE_AT) this.startSmoke(car);
    // every round into a smoking car shortens the fuse
    else if (car.state === 'smoking' && !car.dud) car.fuse = Math.max(0.6, car.fuse - dmg * 0.09);
  }

  // cars going up (smoking toward the blast) + wrecks still roaring
  blazes() {
    let n = 0;
    for (const c of this.cars) if (c.state === 'smoking' && !c.dud) n++;
    for (const f of this.fires) if (f.intensity() >= 0.45) n++;
    return n;
  }

  startSmoke(car, fuse = FUSE, { force = false } = {}) {
    if (car.state !== 'intact') return;
    car.state = 'smoking';
    car.fuse = fuse;
    car.smokeT = 0;
    // (two blazes already: this one fizzles out instead - see DMG above)
    car.dud = !force && this.blazes() > MAX_BLAZES;
    if (car.dud) car.fuse = this.rng.range(6, 8);
    if (this.game) this.game.onCarSmoking(car);
  }

  shatter(car, i) {
    const G = this.game, r = this.rng, T = this.T;
    const P = car.panes[i];
    if (P.broken) return;
    P.broken = true;
    this.rebuild(car, 'glass', T.panes, car.panes.map((p) => !p.broken));
    G.fx.decals.hideOwner('car' + car.id + ':' + i);
    const c = this.toWorld(car, T.panes[i].c), n = T.panes[i].n.clone().transformDirection(car.group.matrixWorld);
    this.shards(c, n, T.panes[i].w, 16);
    G.sfx.glass(c, 1);
  }

  breakLens(car, side) {
    const G = this.game, T = this.T;
    car.lensBroken[side] = true;
    this.rebuild(car, 'lens', T.lensParts, car.lensBroken.map((b) => !b));
    const c = this.toWorld(car, T.lensParts[side].c);
    this.shards(c, T.lensParts[side].n.clone().transformDirection(car.group.matrixWorld), 0.25, 7);
    if (G) G.sfx.glass(c, 0.5);
    if (car.spot) {
      const lit = car.lensBroken.filter((b) => !b).length;
      car.spot.intensity = car.spotI * lit / 2;
      for (const cone of car.cones) if ((cone.userData.side > 0 ? 0 : 1) === side) cone.visible = false;
      if (car.entry) car.entry.intensity = 0.35 * lit;
    }
  }

  // merge the parts that are still there into the car's mesh (or hide it)
  rebuild(car, key, parts, keep) {
    const m = car.meshes[key];
    const list = parts.filter((p, i) => keep[i]).map((p) => p.geo.clone());
    const G = this.game;
    if (!list.length) { m.visible = false; if (G) G.rays.setEnabled(m, false); return; }
    const old = m.geometry;
    m.geometry = merge(list);
    old.dispose();
    if (G) G.rays.refresh(m);
  }

  // glass shards: pale slivers catching the light, falling and tumbling
  shards(c, n, w, count) {
    const F = this.game.fx, r = this.rng;
    for (let k = 0; k < count; k++) {
      const s = r.range(0.03, 0.09) * (0.6 + w * 0.5);
      F.debris.spawn({
        pos: c.clone().add(new THREE.Vector3(r.gauss() * w * 0.3, r.gauss() * 0.12, r.gauss() * w * 0.3)),
        vel: n.clone().multiplyScalar(r.range(0.4, 2.2)).add(new THREE.Vector3(r.gauss() * 0.6, r.range(-0.2, 1.2), r.gauss() * 0.6)),
        life: r.range(0.7, 1.3), size: [s, s * r.range(0.4, 0.8)], rot: r.next() * 6.28, spin: r.gauss() * 14,
        col: [0.34, 0.34, 0.34], alpha: 1, cell: FIRE_CELL_SHARD, gravity: 9.8, ground: 0.02, fadeOut: 0.15, lit: 2, litT: 0.08,
      });
    }
  }

  explode(car) {
    const G = this.game;
    car.state = 'burning';
    car.wreckT = 0;
    const at = this.engine(car);
    G.fx.explosions.blast(at, { yaw: car.yaw });
    // everything glass goes at once
    car.panes.forEach((p, i) => { if (!p.broken) { p.broken = true; G.fx.decals.hideOwner('car' + car.id + ':' + i); } });
    this.rebuild(car, 'glass', this.T.panes, car.panes.map(() => false));
    car.lensBroken = [true, true];
    this.rebuild(car, 'lens', this.T.lensParts, [false, false]);
    if (car.spot) { car.spot.intensity = 0; for (const c of car.cones) c.visible = false; if (car.entry) car.entry.intensity = 0; }
    // the blackened wreck: char paint, no chrome, burnt tyres (sagging)
    const M = this.world.M, ms = car.meshes;
    ms.paint.material = M.wreck;
    ms.chrome.material = M.wreckMetal;
    ms.caps.material = M.wreckMetal;
    ms.hubs.material = M.wreck;
    ms.seams.visible = false;
    if (ms.white) ms.white.visible = false;
    car.tyres = [1, 1, 1, 1];
    car.extraSag = 0.07;
    car.tilt = [this.rng.gauss() * 0.03, this.rng.gauss() * 0.02];
    // the fire: engine bay + cabin
    const fire = new Fire(this.world, G.fx, { pos: this.toWorld(car, V3(1.35, 1.05, 0)), yaw: car.yaw, cabin: this.toWorld(car, V3(-0.4, 1.15, 0)) });
    car.fire = fire;
    this.fires.push(fire);
    this.assignFireLights();
    G.onCarExploded(car, at);
  }

  // the world's fire lights go to the fires nearest the player
  assignFireLights() {
    const lights = this.world.fxLights.fire;
    const cam = this.game ? this.game.camera.position : new THREE.Vector3();
    const live = this.fires.filter((f) => f.age < 1 || f.intensity() > 0).sort((a, b) => a.pos.distanceToSquared(cam) - b.pos.distanceToSquared(cam));
    for (const f of this.fires) f.light = null;
    lights.forEach((L, i) => { const f = live[i]; if (f) f.light = L; else L.intensity = 0; });
  }

  // per fixed step (game/React.js)
  // per step (World.update): the far build for the cars beyond FAR_LOD m
  // (4 m of hysteresis). The bullets' BVH keeps the full build (RayWorld).
  lodUpdate(camera) {
    const p = camera.position;
    for (const car of this.cars) {
      const d = Math.hypot(car.pos.x - p.x, car.pos.z - p.z);
      const lod = this.world.lodOff ? 0 : car.lod ? (d > FAR_LOD - 4 ? 1 : 0) : (d > FAR_LOD ? 1 : 0);
      if (lod === car.lod) continue;
      car.lod = lod;
      const T = lod ? this.TL : this.T;
      for (const k of LOD_PARTS) {
        const m = car.meshes[k];
        if (!m) continue;
        m.userData.rayGeo = this.T[k];
        m.geometry = T[k];
      }
    }
  }

  update(dt, t) {
    const G = this.game, r = this.rng;
    for (const car of this.cars) {
      // sag: tyres going flat, then the wreck settling
      let moved = false;
      for (let i = 0; i < 4; i++) {
        const want = car.tyres[i];
        if (car.sag[i] !== want) { car.sag[i] += Math.sign(want - car.sag[i]) * Math.min(Math.abs(want - car.sag[i]), dt * 0.8); moved = true; }
      }
      if (car.state === 'burning' && car.wreckT < 3) { car.wreckT += dt; moved = true; }
      if (moved) this.pose(car);
      if (car.state === 'smoking') {
        car.smokeT += dt;
        car.fuse -= dt;
        // GREY smoke boiling out of the bonnet, thicker as the fuse runs: the
        // warning must read 'about to blow', never as the black column of a
        // burning wreck (fx/Fire.js, fx/Explosion.js own the black). A mid
        // grey (~0.5 display: lighter than the towers and the façade, darker
        // than a lamp's cone, which its occluder takes off behind it), laid
        // thinner and in smaller puffs than the fire's column; each puff
        // pales a little as it rises and spreads. Only in the last ~1.5 s of
        // the fuse do the new puffs at its root darken - to a dark grey
        // (~0.25 display), still not the black of the fire.
        // a dud: thin pale smoke, dying away over its last ~4 s
        const fizz = car.dud ? Math.min(1, Math.max(0, car.fuse / 4)) : 1;
        const k = Math.min(1, car.smokeT / FUSE) * fizz;
        const late = car.dud ? 0 : 1 - Math.min(1, Math.max(0, car.fuse / 1.5));
        const g0 = SMOKE_GREY * (1 - 0.5 * late) * (car.dud ? 1.15 : 1);
        car.smokeAcc += dt * (5 + 10 * k) * (car.dud ? 0.6 * fizz : 1);
        while (car.smokeAcc >= 1) {
          car.smokeAcc -= 1;
          const p = this.toWorld(car, V3(1.5 + r.gauss() * 0.3, 1.15, r.gauss() * 0.3));
          const s = r.range(0.45, 0.7) * (0.8 + 0.5 * k);
          // (each puff its own grey, ~0.33-0.55 display: overlapping billows
          // of different tone read as smoke against the mid-grey mist, where
          // a single flat grey was the mist's own value)
          const g = g0 * r.range(0.55, 1.2);
          G.fx.smoke.spawn({
            pos: p, vel: new THREE.Vector3(r.gauss() * 0.25 + 0.35, r.range(1.3, 2.2), r.gauss() * 0.25),
            life: r.range(2.2, 3.1), size: [s, s], grow: r.range(0.35, 0.55), rot: r.next() * 6.28, spin: r.gauss() * 0.3,
            col: [g, g, g], colEnd: [g * 1.25, g * 1.25, g * 1.25], alpha: r.range(0.78, 0.9), drag: 0.3, fadeIn: 0.06, fadeOut: 0.45,
            cell: FIRE_CELL_SMOKE[r.int(0, 3)],
          });
        }
        if (car.fuse <= 0) {
          if (car.dud) { car.state = 'dead'; if (G && G.counters) G.counters.fizzles = (G.counters.fizzles || 0) + 1; }
          else this.explode(car);
        }
      }
    }
    for (const f of this.fires) f.update(dt, t);
    // the fire light follows the player to the nearest fire (once a second)
    if (this.fires.length > 1) { this.fireLightT = (this.fireLightT ?? 1) - dt; if (this.fireLightT <= 0) { this.fireLightT = 1; this.assignFireLights(); } }
  }

  // the group's transform from its tyres' sag (+ the wreck's settling)
  pose(car) {
    const g = car.group, s = car.sag;
    const D = 0.09;   // m a flat tyre drops its corner
    const fl = s[0] * D, fr = s[1] * D, rl = s[2] * D, rr = s[3] * D;
    const w = car.state === 'burning' ? Math.min(1, car.wreckT / 2.5) : 0;
    const drop = (fl + fr + rl + rr) / 4 + car.extraSag * w;
    const pitch = Math.atan2((rl + rr) / 2 - (fl + fr) / 2, 3.1) + car.tilt[0] * w;
    const roll = Math.atan2((fl + rl) / 2 - (fr + rr) / 2, 1.56) + car.tilt[1] * w;
    g.position.set(car.pos.x, car.pos.y - drop, car.pos.z);
    g.quaternion.setFromAxisAngle(V3(0, 1, 0), car.yaw)
      .multiply(_q.setFromAxisAngle(V3(0, 0, 1), pitch))
      .multiply(new THREE.Quaternion().setFromAxisAngle(V3(1, 0, 0), roll));
    g.updateMatrixWorld(true);
    if (this.game) {
      for (const m of Object.values(car.meshes)) if (m.visible) this.game.rays.refresh(m);
      // (its shadow moves with it: a few cm a step, so every ~0.25 s)
      this.shadowT = (this.shadowT ?? 0) + 1;
      if (this.shadowT % 15 === 0) this.game.pipeline.dirtyShadows();
    }
  }

  clear() {
    for (const f of this.fires) f.dispose();
    this.fires.length = 0;
  }
}

import * as THREE from 'three';
import { LAYER, allocHoodSlot, HOOD_ID0, FIG_ANCHOR, markFigure } from '../render/layers.js';
import { SEDAN_SHAPES } from '../world/Cars.js';
import { lathe, merge, roundedBox, smoothNormals, tube, V2, V3 } from '../world/geom.js';
import { accent } from '../render/accents.js';

// The cars of wave B (lane B5) as models: local frame +x forward, +y up,
// +z to the car's right (the block's sedans' frame, world/Cars.js), the
// origin on the ground under the middle of the car.
//   buildCoupe(M)  my coupe: the block's body and fender profiles with a
//                  coupe's cabin, and everything the driver sees from his
//                  seat (the dash and its dials, the pillars, the header,
//                  the headliner, the door sills, the wipers). No glass: the
//                  windscreen's rain is an effect of its own (vehicles/screen.js)
//   buildTruck(M)  a 1930s box truck
// A moving car keeps its brush on its body: its meshes take a figure slot
// of the ink's (as a Hood's), anchored to the car every step (anchorInk).

const ext = (shape, depth, bt, bs, seg = 4, curve = 18) => {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bt, bevelSize: bs, bevelSegments: seg, curveSegments: curve });
  g.translate(0, 0, -depth / 2);
  return smoothNormals(g, 1e-4);
};

// the coupe's body in profile, from its tail to the cowl (the hood, the
// grille and the fenders make the front): the cockpit's well cut out of it
// (the body's top would otherwise be a table at the driver's chest), the
// door skins close its sides
function coupeBody() {
  const s = new THREE.Shape();
  s.moveTo(-2.24, 0.52);
  s.lineTo(0.66, 0.52);
  s.lineTo(0.66, 1.1);
  // the cowl drops into the well at the dash, the well's floor, up behind the seat
  s.lineTo(0.64, 0.62);
  s.lineTo(-1.26, 0.62);
  s.lineTo(-1.3, 1.12);
  s.splineThru([V2(-1.72, 1.07), V2(-2.08, 0.93), V2(-2.27, 0.72), V2(-2.29, 0.58)]);
  s.closePath();
  return s;
}
// the hood: a long crowned engine cover from the cowl to the grille, a
// little narrower and lower as it goes, its sides down between the fenders
// (a loft of superellipse sections: no facets, a soft crown the lamps run
// along); x from the cowl, top and half width at each station
// [R2] the nose raked lower (top1 1.075 -> 1.0, the grille's shell with
// it): from the raised seat the road runs on down past the ornament
export const HOOD = { x0: 0.64, x1: 2.25, top0: 1.155, top1: 1.0, w0: 0.5, w1: 0.37, side: 0.78 };
export function hoodTop(x) { const u = Math.min(1, Math.max(0, (x - HOOD.x0) / (HOOD.x1 - HOOD.x0))); return HOOD.top0 + (HOOD.top1 - HOOD.top0) * Math.pow(u, 1.4); }
function hoodLoft() {
  const NX = 28, NA = 24, pos = [], idx = [];
  for (let i = 0; i <= NX; i++) {
    const u = i / NX, x = HOOD.x0 + (HOOD.x1 - HOOD.x0) * u;
    const top = hoodTop(x), w = HOOD.w0 + (HOOD.w1 - HOOD.w0) * u * u;
    // (the nose rounds down into the grille's shell)
    const nose = u > 0.92 ? Math.sin(((u - 0.92) / 0.08) * Math.PI / 2) * 0.05 : 0;
    const bot = HOOD.side;
    for (let j = 0; j <= NA; j++) {
      const a = -Math.PI / 2 + (j / NA) * Math.PI;
      const sa = Math.sin(a), ca = Math.cos(a);
      const n = 3.2;
      const z = w * Math.sign(sa) * Math.pow(Math.abs(sa), 2 / n);
      const y = bot + (top - nose - bot) * Math.pow(Math.abs(ca), 2 / n);
      pos.push(x, y, z);
    }
  }
  for (let i = 0; i < NX; i++) for (let j = 0; j < NA; j++) {
    const a = i * (NA + 1) + j, b = a + 1, c = a + NA + 1, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // (outward: the crown's normal must point up)
  const nm = g.getAttribute('normal');
  if (nm.getY(Math.floor(NA / 2)) < 0) { const I = g.index.array; for (let k = 0; k < I.length; k += 3) { const t = I[k + 1]; I[k + 1] = I[k + 2]; I[k + 2] = t; } g.computeVertexNormals(); }
  return g;
}
// the coupe's cabin: an upright split screen, a long roof, a fastback; open
// below the belt (the well is the body's)
function coupeCabin() {
  const s = new THREE.Shape();
  s.moveTo(0.66, 1.12);
  s.lineTo(0.42, 1.78);
  s.quadraticCurveTo(0.36, 1.86, 0.18, 1.87);
  s.splineThru([V2(-0.5, 1.88), V2(-0.98, 1.83)]);
  s.splineThru([V2(-1.32, 1.66), V2(-1.62, 1.4), V2(-1.88, 1.13)]);
  s.lineTo(-1.3, 1.12);
  s.closePath();
  return s;
}

// the cabin as a shell: the roof and the fastback a cap 5 cm thick across
// the car, each side a frame round its window openings
function coupeShell() {
  const top = [V2(0.42, 1.78), V2(0.36, 1.85), V2(0.18, 1.87), V2(-0.5, 1.88), V2(-0.98, 1.83), V2(-1.32, 1.66), V2(-1.62, 1.4), V2(-1.88, 1.13)];
  const curve = new THREE.SplineCurve(top);
  const pts = curve.getPoints(40);
  const cap = new THREE.Shape();
  cap.moveTo(pts[0].x, pts[0].y);
  for (const p of pts) cap.lineTo(p.x, p.y);
  // (back along the inside, 5 cm under the skin)
  for (let i = pts.length - 1; i >= 0; i--) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const tx = b.x - a.x, ty = b.y - a.y, l = Math.hypot(tx, ty) || 1;
    cap.lineTo(pts[i].x + (ty / l) * 0.05, pts[i].y - (tx / l) * 0.05);
  }
  cap.closePath();
  const out = [ext(cap, 1.08, 0.04, 0.03, 3, 40)];
  // the sides: the cabin's outline with the windows cut out of it
  const side = coupeCabin();
  const win = new THREE.Path();
  win.moveTo(0.58, 1.18); win.lineTo(0.38, 1.72); win.quadraticCurveTo(0.3, 1.8, 0.12, 1.81);
  win.lineTo(-0.94, 1.77); win.lineTo(-0.94, 1.18); win.closePath();
  const q = new THREE.Path();
  q.moveTo(-1.06, 1.18); q.lineTo(-1.06, 1.72); q.quadraticCurveTo(-1.28, 1.62, -1.52, 1.36); q.lineTo(-1.66, 1.18); q.closePath();
  side.holes.push(win, q);
  for (const sgn of [-1, 1]) {
    const g = ext(side, 0.04, 0.012, 0.012, 2, 24);
    g.translate(0, 0, sgn * 0.56);
    out.push(g);
  }
  return out;
}

// where the driver's eye sits (car frame) and the dials' centre
// [R2] the windscreen is the picture: the eye 10 cm higher (the road ahead
// was a 12 % band between the horizon and the hood, the dash and the wheel
// 40 % of the frame); the wheel rises with it, so the hands keep their place
export const COUPE = {
  eye: V3(-0.38, 1.56, -0.34),
  halfL: 2.45, halfW: 0.94, wheelbase: 3.1,
  lamps: [V3(2.3, 0.98, -0.6), V3(2.3, 0.98, 0.6)],
  tail: [V3(-2.3, 0.84, -0.74), V3(-2.3, 0.84, 0.74)],
  window: { x0: -0.95, x1: 0.62, y0: 1.14, y1: 1.74, z: -0.66 },
  screen: { base: 0.66, baseY: 1.13, top: 0.43, topY: 1.77, halfW: 0.62 },
  wipers: [V3(0.655, 1.14, -0.5), V3(0.655, 1.14, 0.08)],
  dial: V3(0.375, 1.0, -0.34),
  // the wheel: its hub, its face toward the eye (tilted back on its raked
  // column), its rim's radius; it turns up to WHEEL_TURN either way
  hub: V3(0.06, 1.19, -0.34),
  wheelN: V3(-0.72, 0.69, 0).normalize(),
  rimR: 0.205,
};
export const WHEEL_TURN = 1.7;

// ([C3 3rd] built a few steps at a time when a stage is warmed: the same
// geometry, the same order; buildCoupe runs it through at once)
export function buildCoupe(M) { const it = buildCoupeSteps(M); let r; while (!(r = it.next()).done); return r.value; }
export function* buildCoupeSteps(M) {
  const paint = [], chrome = [], rubber = [], dark = [], hubs = [], cabin = [], trim = [];
  paint.push(ext(coupeBody(), 1.2, 0.1, 0.08, 5));
  yield;
  paint.push(hoodLoft());
  // the front's frame under the hood, between the fenders (dark)
  dark.push(roundedBox(1.7, 0.36, 0.86, 0.05, 2).translate(1.45, 0.62, 0));
  // (the cabin a shell with real openings - its roof and fastback a cap, its
  // sides frames round the windows: a solid cabin enclosed the eye, and the
  // id pass, which draws both faces, saw a wall where the windscreen is)
  paint.push(...coupeShell());
  yield;
  for (const sgn of [1, -1]) {
    // the door skins over the well, up to the belt
    paint.push(roundedBox(1.98, 0.6, 0.06, 0.025, 2).translate(-0.31, 0.83, sgn * 0.675));
  }
  for (const sgn of [1, -1]) {
    const ff = ext(SEDAN_SHAPES.fender(true), 0.22, 0.07, 0.06, 5); ff.translate(0, 0, sgn * 0.78);
    const rf = ext(SEDAN_SHAPES.fender(false), 0.2, 0.07, 0.06, 5); rf.translate(0, 0, sgn * 0.76);
    paint.push(ff, rf);
    rubber.push(roundedBox(1.3, 0.05, 0.26, 0.02, 2).translate(-0.3, 0.445, sgn * 0.77));
    for (const [wx, wz] of [[1.55, 0.78], [-1.55, 0.76]]) {
      rubber.push(new THREE.TorusGeometry(0.27, 0.105, 12, 32).translate(wx, 0.375, sgn * wz));
      hubs.push(lathe([[0.25, -0.02], [0.23, 0.01], [0.17, 0.045], [0.08, 0.07], [0.0, 0.075]], 24).rotateX(sgn * Math.PI / 2).translate(wx, 0.375, sgn * (wz + 0.03)));
      dark.push(new THREE.CylinderGeometry(0.26, 0.26, 0.12, 20).rotateX(Math.PI / 2).translate(wx, 0.375, sgn * wz));
    }
    // headlamp shells on their stalks, tail lamp housings
    chrome.push(lathe([[0.0, -0.25], [0.05, -0.23], [0.1, -0.17], [0.13, -0.09], [0.145, 0.0], [0.15, 0.03], [0.135, 0.045]], 24).rotateZ(-Math.PI / 2).translate(2.26, 0.98, sgn * 0.6));
    chrome.push(new THREE.CylinderGeometry(0.03, 0.04, 0.12, 8).translate(2.14, 0.88, sgn * 0.6));
    dark.push(lathe([[0, -0.08], [0.045, -0.06], [0.055, 0.0], [0.04, 0.03]], 12).rotateZ(Math.PI / 2).translate(-2.3, 0.84, sgn * 0.74));
    // chrome belt line
    chrome.push(tube([V3(0.62, 1.1, sgn * 0.705), V3(-0.5, 1.09, sgn * 0.71), V3(-1.6, 1.03, sgn * 0.7)], 0.012, 5, 24));
    yield;
  }
  // grille, hood strip, the ornament (a winged thing on the radiator cap)
  const gs = new THREE.Shape();
  gs.moveTo(-0.22, 0.52); gs.lineTo(0.22, 0.52); gs.quadraticCurveTo(0.25, 0.82, 0.0, 1.0); gs.quadraticCurveTo(-0.25, 0.82, -0.22, 0.52);
  const grille = new THREE.ExtrudeGeometry(gs, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 12 });
  dark.push(smoothNormals(grille.rotateY(Math.PI / 2).translate(2.3, 0, 0), 1e-4));
  for (let z = -0.16; z <= 0.161; z += 0.04) { const top = 0.97 - Math.pow(Math.abs(z) / 0.23, 2) * 0.33; chrome.push(new THREE.CylinderGeometry(0.009, 0.009, top - 0.55, 6).translate(2.39, (top + 0.55) / 2, z)); }
  chrome.push(tube([0.7, 1.1, 1.5, 1.9, 2.2].map((x) => V3(x, hoodTop(x) + 0.004, 0)), 0.011, 5, 24));
  // the hood's side seams, where it lifts
  for (const sgn of [-1, 1]) chrome.push(tube([0.72, 1.3, 1.9, 2.2].map((x) => { const u = (x - HOOD.x0) / (HOOD.x1 - HOOD.x0); const w = HOOD.w0 + (HOOD.w1 - HOOD.w0) * u * u; return V3(x, hoodTop(x) - 0.05, sgn * (w * 0.93)); }), 0.006, 4, 16));
  {
    // the ornament: a stylised bird, wings swept back (the eye's aiming mark)
    const w = new THREE.Shape();
    w.moveTo(0.1, 0); w.quadraticCurveTo(0.02, 0.05, -0.12, 0.09); w.lineTo(-0.08, 0.04); w.quadraticCurveTo(-0.02, 0.02, -0.05, 0.0); w.closePath();
    const body = new THREE.ExtrudeGeometry(w, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1, curveSegments: 8 });
    body.translate(0, 0, -0.006);
    const wing = new THREE.ExtrudeGeometry(w, { depth: 0.006, bevelEnabled: false, curveSegments: 8 });
    const wl = wing.clone().rotateX(Math.PI / 2 - 0.35).translate(-0.02, 0.05, 0.0), wr = wing.clone().rotateX(-Math.PI / 2 + 0.35).translate(-0.02, 0.05, 0.0);
    chrome.push(merge([body, wl, wr]).translate(2.19, hoodTop(2.19) + 0.03, 0));
    chrome.push(lathe([[0, 0], [0.028, 0.0], [0.024, 0.03], [0.0, 0.035]], 12).translate(2.19, hoodTop(2.19) - 0.004, 0));
  }
  // bumpers
  for (const [x, s] of [[2.55, 1], [-2.55, -1]]) {
    const g = tube([V3(x - s * 0.1, 0.46, -0.95), V3(x, 0.46, -0.55), V3(x + s * 0.03, 0.46, 0), V3(x, 0.46, 0.55), V3(x - s * 0.1, 0.46, 0.95)], 0.05, 8, 32);
    g.translate(0, -0.46, 0).scale(1, 1.7, 1).translate(0, 0.46, 0);
    chrome.push(g);
  }
  const skirt = roundedBox(3.3, 0.4, 1.36, 0.08, 2).translate(0.0, 0.3, 0);
  yield;

  // ---- what the driver sees from his seat ----------------------------------------------------
  const S = COUPE.screen;
  // the dash: an upright panel across the car, a narrow ledge on it under
  // the screen, the ledge's front edge rolled
  cabin.push(roundedBox(0.06, 0.46, 1.3, 0.02, 2).translate(0.4, 0.86, 0));
  cabin.push(roundedBox(0.26, 0.04, 1.32, 0.015, 2).translate(0.52, 1.09, 0));
  cabin.push(tube([V3(0.385, 1.085, -0.64), V3(0.378, 1.095, 0), V3(0.385, 1.085, 0.64)], 0.022, 8, 16));
  // under the dash, the floor, the bench seat's edge by my knees
  cabin.push(new THREE.PlaneGeometry(1.9, 1.3).rotateX(-Math.PI / 2).translate(-0.3, 0.64, 0));
  cabin.push(roundedBox(0.55, 0.16, 1.24, 0.06, 3).translate(-0.62, 0.84, 0));
  // the scuttle under the screen, the header over it, the corner pillars and
  // the split screen's post
  cabin.push(roundedBox(0.1, 0.05, 1.34, 0.02, 2).translate(S.base - 0.03, S.baseY - 0.005, 0));
  cabin.push(roundedBox(0.16, 0.08, 1.3, 0.03, 2).translate(S.top - 0.04, S.topY + 0.035, 0));
  for (const sgn of [-1, 1]) {
    const a = V3(S.base, S.baseY, sgn * (S.halfW + 0.01)), b = V3(S.top, S.topY, sgn * (S.halfW - 0.03));
    cabin.push(tube([a, a.clone().lerp(b, 0.5).add(V3(-0.01, 0, 0)), b], 0.03, 8, 8));
  }
  trim.push(tube([V3(S.base - 0.005, S.baseY + 0.01, 0), V3(S.top + 0.002, S.topY - 0.01, 0)], 0.009, 6, 4));
  // the headliner (seen from below), the roof rails, the door tops and sills
  cabin.push(new THREE.PlaneGeometry(1.5, 1.26).rotateX(Math.PI / 2).translate(-0.4, 1.82, 0));
  for (const sgn of [-1, 1]) {
    cabin.push(roundedBox(1.6, 0.06, 0.07, 0.02, 2).translate(-0.4, 1.79, sgn * 0.61));
    trim.push(roundedBox(1.9, 0.022, 0.08, 0.01, 1).translate(-0.31, 1.14, sgn * 0.66));
    // the B pillar behind my shoulder
    cabin.push(roundedBox(0.09, 0.66, 0.06, 0.02, 2).translate(-1.0, 1.46, sgn * 0.62));
  }
  // the rear-view mirror on its stalk
  trim.push(roundedBox(0.028, 0.052, 0.17, 0.014, 2).translate(0.36, 1.7, 0.0));
  trim.push(new THREE.CylinderGeometry(0.007, 0.007, 0.06, 6).translate(0.37, 1.76, 0.0));
  // the steering column from the wheel's hub down into the dash
  {
    const H = COUPE.hub, N = COUPE.wheelN;
    const a = H.clone().addScaledVector(N, -0.04), b = H.clone().addScaledVector(N, -0.52);
    cabin.push(tube([a, a.clone().lerp(b, 0.5), b], 0.026, 10, 6));
  }
  // the panel's furniture (its own ink id: the lines of the dash): the
  // glovebox door before the passenger with its chrome catch, the radio's
  // grille in the middle, a chrome strip across under the ledge
  const panel = [];
  panel.push(roundedBox(0.012, 0.15, 0.3, 0.012, 2).translate(0.372, 0.93, 0.36));
  trim.push(new THREE.CylinderGeometry(0.012, 0.012, 0.01, 12).rotateZ(Math.PI / 2).translate(0.364, 0.97, 0.36));
  for (let i = 0; i < 7; i++) panel.push(roundedBox(0.01, 0.1, 0.012, 0.004, 1).translate(0.372, 0.9, -0.08 + i * 0.022));
  panel.push(roundedBox(0.012, 0.13, 0.19, 0.01, 2).translate(0.374, 0.9, -0.014));
  trim.push(roundedBox(0.008, 0.012, 1.24, 0.004, 1).translate(0.372, 1.055, 0));
  // the dials on the panel: two before the driver, a clock in the middle
  const dials = [];
  const dz = [[COUPE.eye.z - 0.09, 0.068], [COUPE.eye.z + 0.095, 0.052], [0.05, 0.05]];
  for (const [z, r] of dz) {
    trim.push(new THREE.TorusGeometry(r, 0.007, 6, 28).rotateY(Math.PI / 2).translate(0.368, COUPE.dial.y, z));
    dials.push(new THREE.CircleGeometry(r - 0.004, 28).rotateY(-Math.PI / 2).translate(0.37, COUPE.dial.y, z));
  }

  yield;
  const g = new THREE.Group();
  g.name = 'coupe';
  const mk = (list, mat, name) => { const m = new THREE.Mesh(list.isBufferGeometry ? list : merge(list), mat); m.name = name; g.add(m); return m; };
  const meshes = {};
  meshes.paint = mk(paint, M.paint, 'paint'); yield;
  meshes.chrome = mk(chrome, M.chrome, 'chrome'); yield;
  meshes.rubber = mk(rubber, M.rubber, 'rubber');
  meshes.dark = mk(dark, M.rubber, 'dark'); meshes.hubs = mk(hubs, M.hubcap, 'hubs'); meshes.skirt = mk(skirt, M.black, 'skirt'); yield;
  meshes.cabin = mk(cabin, M.iron, 'cabin'); meshes.trim = mk(trim, M.chrome, 'trim'); yield;
  // the dial faces: a dim pale glow; the needles are their own meshes
  const dialMat = new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(0.06) });
  meshes.dials = mk(dials, dialMat, 'dials');
  meshes.trim.userData.inkSub = true;
  meshes.panel = mk(panel, M.iron, 'panel');
  meshes.panel.userData.inkSub = true;
  meshes.dials.userData.inkSub = true;
  const needleGeo = new THREE.BoxGeometry(0.004, 0.058, 0.006).translate(0, 0.026, 0);
  const needles = [];
  for (const z of [COUPE.eye.z - 0.09, COUPE.eye.z + 0.095]) {
    const n = new THREE.Mesh(needleGeo, M.black);
    n.position.set(0.364, COUPE.dial.y, z);
    n.rotation.order = 'YXZ';
    n.rotation.y = -Math.PI / 2;
    g.add(n);
    needles.push(n);
  }
  meshes.needles = needles;
  // the headlamp lenses and the tail lamps (the crew's red is the sedan's:
  // mine are a dull red glass)
  const lens = [];
  for (const p of COUPE.lamps) lens.push(new THREE.CircleGeometry(0.128, 24).rotateY(Math.PI / 2).translate(p.x + 0.047, p.y, p.z));
  meshes.lens = mk(lens, M.headlamp, 'lens');
  meshes.lens.userData.emitter = true;
  // the wipers: an arm and a blade each, pivoting at the scuttle
  const wipers = COUPE.wipers.map((p) => {
    const w = new THREE.Group();
    w.position.copy(p);
    // (the pivot lies in the screen's plane: the arm sweeps across the glass)
    const rake = Math.atan2(S.topY - S.baseY, S.base - S.top);
    w.rotation.z = Math.PI / 2 - rake;
    const arm = new THREE.Mesh(merge([new THREE.BoxGeometry(0.012, 0.36, 0.006).translate(0, 0.18, 0), new THREE.CylinderGeometry(0.014, 0.014, 0.02, 8).rotateX(Math.PI / 2)]), M.iron);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.4, 0.012).translate(0, 0.2, 0), M.black);
    blade.position.set(0, 0.33, 0.012);
    blade.rotation.z = 0.02;
    arm.add(blade);
    w.add(arm);
    // (arm.rotation.x: the sweep, in the screen's plane)
    arm.rotation.order = 'XYZ';
    g.add(w);
    return { pivot: w, arm };
  });
  meshes.wipers = wipers;
  yield;
  // the wheel: a mount on the column (x away from the eye, y up its face, z
  // to the car's right), the wheel turning in it about its x (+ clockwise)
  {
    // (x points away from the eye, down the column: a right-handed frame
    // with y up the wheel's face and z to the car's right)
    const N = COUPE.wheelN, U = V3(N.y, -N.x, 0);
    if (U.y < 0) U.negate();
    const mount = new THREE.Group();
    mount.name = 'wheelMount';
    mount.matrixAutoUpdate = true;
    const basis = new THREE.Matrix4().makeBasis(N.clone().negate(), U, V3(0, 0, 1));
    mount.quaternion.setFromRotationMatrix(basis);
    mount.position.copy(COUPE.hub);
    const wheel = new THREE.Group();
    wheel.name = 'wheel';
    const R = COUPE.rimR;
    const parts = [new THREE.TorusGeometry(R, 0.0165, 12, 64).rotateY(Math.PI / 2)];
    // four thin spokes, the hub and its horn button
    for (const a of [Math.PI / 4, 3 * Math.PI / 4, 5 * Math.PI / 4, 7 * Math.PI / 4]) {
      const d = V3(0, Math.cos(a), Math.sin(a));
      parts.push(tube([d.clone().multiplyScalar(0.03).add(V3(-0.02, 0, 0)), d.clone().multiplyScalar(R * 0.6).add(V3(-0.012, 0, 0)), d.clone().multiplyScalar(R - 0.01)], 0.0065, 6, 8));
    }
    parts.push(lathe([[0.0, 0.0], [0.045, 0.0], [0.04, 0.025], [0.02, 0.04], [0.0, 0.042]], 20).rotateZ(Math.PI / 2).translate(-0.01, 0, 0).rotateY(Math.PI));
    const wm = new THREE.Mesh(merge(parts), M.iron);
    wm.name = 'wheelRim';
    wm.userData.inkSub = true;
    wheel.add(wm);
    mount.add(wheel);
    g.add(mount);
    meshes.wheel = wm;
    meshes.wheelMount = mount;
    meshes.wheelGroup = wheel;
  }
  for (const m of Object.values(meshes)) if (m && m.isMesh) { m.castShadow = false; m.receiveShadow = true; }
  // [R2] (wider than the car and darker at its heart: from the pavement it
  // stood on the bright wash of its own lamps' streaks with no dark under
  // its sills, lifted off the road)
  meshes.contact = contactShadow(g, 6.1, 2.9);
  return { group: g, meshes, needles, wipers, wheel: meshes.wheelGroup, wheelMount: meshes.wheelMount };
}

// A 1930s box truck (the one that pulls out of a side street): a cab with a
// long hood and round fenders, a tall box body, dual rear wheels.
export const TRUCK = { halfL: 3.6, halfW: 1.2, lamps: [V3(2.95, 1.25, -0.75), V3(2.95, 1.25, 0.75)] };
export function buildTruck(M) {
  const body = [], dark = [], chrome = [], rubber = [];
  body.push(roundedBox(6.0, 2.7, 2.36, 0.08, 2).translate(-1.3, 2.05, 0));      // the box
  body.push(roundedBox(1.5, 1.7, 2.1, 0.12, 3).translate(1.35, 1.75, 0));        // the cab
  body.push(roundedBox(1.35, 0.72, 1.0, 0.14, 3).translate(2.55, 1.3, 0));       // the hood
  for (const sgn of [-1, 1]) {
    body.push(new THREE.CylinderGeometry(0.55, 0.55, 0.3, 20, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(-Math.PI / 2 + Math.PI / 2).translate(2.4, 0.62, sgn * 0.82));
    for (const x of [2.4, -2.4, -3.1]) rubber.push(new THREE.TorusGeometry(0.33, 0.13, 10, 24).translate(x, 0.46, sgn * 0.95));
    chrome.push(lathe([[0.0, -0.2], [0.08, -0.17], [0.12, -0.08], [0.13, 0.02], [0.11, 0.04]], 16).rotateZ(-Math.PI / 2).translate(2.95, 1.25, sgn * 0.75));
  }
  dark.push(roundedBox(0.06, 0.8, 0.9, 0.03, 2).translate(3.25, 1.2, 0));
  dark.push(roundedBox(0.04, 0.6, 1.8, 0.02, 1).translate(1.95, 2.05, 0));       // the cab's screen
  chrome.push(roundedBox(0.12, 0.14, 2.3, 0.05, 2).translate(3.3, 0.55, 0));
  const g = new THREE.Group();
  g.name = 'truck';
  const mk = (list, mat) => { const m = new THREE.Mesh(merge(list), mat); g.add(m); return m; };
  const meshes = { body: mk(body, M.paintGrey || M.paint), dark: mk(dark, M.rubber), chrome: mk(chrome, M.chrome), rubber: mk(rubber, M.rubber) };
  const lens = [];
  for (const p of TRUCK.lamps) lens.push(new THREE.CircleGeometry(0.11, 20).rotateY(Math.PI / 2).translate(p.x + 0.05, p.y, p.z));
  meshes.lens = mk(lens, M.headlamp);
  meshes.lens.userData.emitter = true;
  meshes.contact = contactShadow(g, 8.0, 2.9, -0.4);
  return { group: g, meshes };
}

// red tail lamps (the crew's red, lit): two small discs behind a sedan
// a soft dark footprint under a car (the block's sedans have one: without it
// a black car floats on its own reflections and on the headlamps' wet road).
// FX layer: the main pass only, never reflected or outlined.
let CONTACT = null;
export function contactShadow(g, len, wid, x = 0) {
  if (!CONTACT) {
    const W = 256, H = 128;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x2 = c.getContext('2d');
    x2.filter = 'blur(12px)';
    x2.fillStyle = 'rgba(0,0,0,0.75)';
    x2.beginPath(); x2.roundRect(W * 0.08, H * 0.16, W * 0.84, H * 0.68, 30); x2.fill();
    x2.filter = 'blur(7px)';
    x2.fillStyle = 'rgba(0,0,0,0.97)';
    x2.beginPath(); x2.roundRect(W * 0.16, H * 0.27, W * 0.68, H * 0.46, 18); x2.fill();
    x2.filter = 'blur(5px)';
    x2.fillStyle = 'rgba(0,0,0,0.95)';
    for (const [u, v] of [[0.21, 0.24], [0.79, 0.24], [0.21, 0.76], [0.79, 0.76]]) { x2.beginPath(); x2.ellipse(u * W, v * H, W * 0.07, H * 0.1, 0, 0, Math.PI * 2); x2.fill(); }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.NoColorSpace;
    CONTACT = new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: tex, transparent: true, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(len, wid).rotateX(-Math.PI / 2).translate(x, 0.014, 0), CONTACT);
  m.layers.set(LAYER.FX);
  // [2nd pass] after the headlamps' pools (renderOrder 2, additive): the
  // other car's pool no longer lights the road under a car, which then
  // stood lifted on a bright wash with nothing under its wheels
  m.renderOrder = 3;
  m.userData.noRay = true;
  m.castShadow = false;
  g.add(m);
  return m;
}

export function tailLamps(g, at, gain = 7) {
  const mat = new THREE.MeshBasicMaterial({ color: accent('crew', { gain }) });
  mat.name = 'accent_crew_lamp';
  mat.userData.accent = 'crew';
  const parts = at.map((p) => new THREE.SphereGeometry(0.07, 14, 10).scale(0.45, 0.85, 1).translate(p.x - 0.02, p.y, p.z));
  const m = new THREE.Mesh(merge(parts), mat);
  m.name = 'tailLamps';
  m.userData.noRay = true;
  m.userData.emitter = true;
  g.add(m);
  // their glow in the rain: a soft red halo round each (it carries to 60 m,
  // and the wet road takes it down in two red streaks: LAYER.FX_REFL)
  const glowMat = new THREE.SpriteMaterial({ map: glowTexture(), color: accent('crew', { gain: 0.9 }), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
  glowMat.name = 'accent_crew_glow';
  glowMat.userData.accent = 'crew';
  m.userData.glows = at.map((p) => {
    const sp = new THREE.Sprite(glowMat);
    sp.position.set(p.x - 0.06, p.y, p.z);
    sp.scale.setScalar(0.62);
    sp.layers.set(LAYER.FX_REFL);
    sp.renderOrder = 6;
    sp.userData.noRay = true;
    sp.userData.side = Math.sign(p.z);
    g.add(sp);
    return sp;
  });
  return m;
}
let GLOW = null;
export function glowTexture() {
  if (GLOW) return GLOW;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.18, 'rgba(255,255,255,0.55)');
  gr.addColorStop(0.5, 'rgba(255,255,255,0.12)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr;
  x.fillRect(0, 0, 64, 64);
  GLOW = new THREE.CanvasTexture(c);
  return GLOW;
}

// a moving car's brush rides on it: every mesh of the group takes one of
// the figure slots (the Hoods', layers.js) and the slot's anchor follows
// the car (anchorInk each step). Returns the slot (or -1: world ids kept).
// (a mesh marked userData.inkSub takes a second slot on the same anchor: the
// wheel against the dash, the dials' bezels, need a contour of their own)
export function figureInk(group) {
  const slot = allocHoodSlot();
  if (slot < 0) return -1;
  let sub = -1;
  group.traverse((o) => { if (o.isMesh && o.userData.inkSub && sub < 0) sub = allocHoodSlot(); });
  // (the lamps keep their own ids: an emitter under a figure's ceiling
  // would print dim)
  group.traverse((o) => { if (o.isMesh && !o.userData.emitter) { o.userData.inkId = HOOD_ID0 + (o.userData.inkSub && sub >= 0 ? sub : slot); o.userData.inkFigure = true; } });
  group.userData.inkSlots = sub >= 0 ? [slot, sub] : [slot];
  return slot;
}
export function anchorInk(slot, group) {
  if (slot < 0) return;
  const p = group.position;
  // (well below the car: the figure shader's shin rule never reaches it)
  for (const s of group.userData.inkSlots || [slot]) FIG_ANCHOR[s].set(p.x, p.y - 3, p.z, group.rotation.y);
}
export { markFigure, LAYER };

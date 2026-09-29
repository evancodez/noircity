import * as THREE from 'three';
import { lathe, merge, roundedBox, smoothNormals, tube, V2, V3 } from '../world/geom.js';

// The burnt-out sedan (lane 3, P0.1). It has to read as a wreck from 40 m by
// its SILHOUETTE alone, so it is built as a shell you can see through, not as
// the intact body painted black (Phase 3a's wreck printed as a lump):
//   - the same length, width and wheelbase as the sedan (world/Cars.js: local
//     +x forward, +y up, z across; 4.9 x 1.8 m)
//   - no glass: the side skins are thin plates with the door holes cut out;
//     above the belt line only the roof on thin, bent pillars
//   - the roof sagged ~10 cm between the pillars; the bonnet gone (A) or
//     peeled up and back against the windscreen frame; the boot lid gone (B)
//   - one door hanging open on its lower hinge, another missing
//   - inside, in the openings: seat frames, their springs and the steering
//     wheel's ring as thin black line work
//   - on its rims: the tyres burnt away, the car 9 cm lower, ribbons of tyre
//     hanging off the rims
//   - char black and matte, with pale ash along the top edges (vertex colour:
//     the ink's dry brush prints it as a few pale strokes, never a gloss)
// A variant per explosion kind: A nose down (bonnet gone, front wheels
// splayed), B tail collapsed (boot and rear bumper gone), C gutted (the roof
// caved deeper, both front doors out), D on its side (Cars.js poses it).
// Every build is cached per kind; the four materials are shared.

export const RIM_R = 0.285;          // the rim's flange touches the street
export const WRECK_DROP = 0.375 - RIM_R;   // the intact wheel radius minus the rim's

// ---- small geometry helpers ---------------------------------------------------------

// a cheap deterministic value noise (no rng draws: the builds are cached and
// must never touch a stream the accepted frames depend on)
function hash3(x, y, z) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  let r = 0;
  for (let k = 0; k < 8; k++) {
    const a = k & 1, b = (k >> 1) & 1, c = (k >> 2) & 1;
    r += hash3(xi + a, yi + b, zi + c) * (a ? u : 1 - u) * (b ? v : 1 - v) * (c ? w : 1 - w);
  }
  return r;
}

// offset a closed CCW outline outward by d (the Cars.js extrusions grow their
// shapes by the bevel size: the wreck's plates must match the intact outline)
function offsetOutline(pts, d) {
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n], b = pts[i], c = pts[(i + 1) % n];
    const e0 = V2(b.x - a.x, b.y - a.y).normalize(), e1 = V2(c.x - b.x, c.y - b.y).normalize();
    const n0 = V2(e0.y, -e0.x), n1 = V2(e1.y, -e1.x);
    const m = n0.clone().add(n1);
    const len = m.length();
    if (len < 1e-6) { out.push(b.clone().addScaledVector(n0, d)); continue; }
    m.divideScalar(len);
    const k = Math.min(2.5, 1 / Math.max(0.3, m.dot(n0)));
    out.push(b.clone().addScaledVector(m, d * k));
  }
  return out;
}

// the outline of a Cars.js shape as a clean closed polyline (no repeated end)
function outlineOf(shape, div = 64) {
  const p = shape.getSpacedPoints(div);
  if (p.length > 1 && p[0].distanceTo(p[p.length - 1]) < 1e-5) p.pop();
  return p;
}

function shapeFrom(pts) {
  const s = new THREE.Shape();
  s.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i].x, pts[i].y);
  s.closePath();
  return s;
}

// polygon with softly rounded corners (as Cars.js flatShape)
function roundPoly(points, round = 0.04) {
  const s = new THREE.Path();
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

// a thin plate: an extruded outline (+ holes), `depth` thick, centred on z
function plate(shape, depth, bevel = 0.008) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 10 });
  g.translate(0, 0, -depth / 2);
  return g;
}

// A sheet with thickness: fn(u, v) -> Vector3 on the upper face, nu x nv
// quads, keep(u, v) drops quads (a hole: the jagged edge of burnt steel).
// The lower face is the upper pushed along -normal by `thick`; the outer
// border gets rim quads so the sheet never vanishes edge-on.
function slab(nu, nv, fn, thick = 0.03, keep = null) {
  const P = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) P.push(fn(i / nu, j / nv));
  const idx = (i, j) => j * (nu + 1) + i;
  const N = P.map(() => new THREE.Vector3());
  const t0 = new THREE.Vector3(), t1 = new THREE.Vector3();
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      t0.subVectors(P[idx(Math.min(nu, i + 1), j)], P[idx(Math.max(0, i - 1), j)]);
      t1.subVectors(P[idx(i, Math.min(nv, j + 1))], P[idx(i, Math.max(0, j - 1))]);
      N[idx(i, j)].crossVectors(t0, t1).normalize();
    }
  }
  const pos = [];
  const tri = (a, b, c) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  const lo = P.map((p, k) => p.clone().addScaledVector(N[k], -thick));
  const kept = (i, j) => !keep || keep((i + 0.5) / nu, (j + 0.5) / nv);
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      if (!kept(i, j)) continue;
      const a = idx(i, j), b = idx(i + 1, j), c = idx(i + 1, j + 1), d = idx(i, j + 1);
      tri(P[a], P[b], P[c]); tri(P[a], P[c], P[d]);
      tri(lo[a], lo[c], lo[b]); tri(lo[a], lo[d], lo[c]);
      // rims on every edge that borders a dropped quad or the border
      const edge = (p, q, open) => { if (!open) return; tri(P[p], lo[p], lo[q]); tri(P[p], lo[q], P[q]); };
      edge(a, b, j === 0 || !kept(i, j - 1));
      edge(b, c, i === nu - 1 || !kept(i + 1, j));
      edge(c, d, j === nv - 1 || !kept(i, j + 1));
      edge(d, a, i === 0 || !kept(i - 1, j));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

// a zig-zag spring or frame drawn as a thin tube (line work)
function line(points, r = 0.009, radial = 5) {
  return tube(points, r, radial, Math.max(6, points.length * 3));
}
// straight segments (a frame loop), one thin tube per run of points
function polyline(points, r = 0.009) {
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const len = a.distanceTo(b);
    const g = new THREE.CylinderGeometry(r, r, len, 5, 1, true);
    g.translate(0, len / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), b.clone().sub(a).normalize()));
    g.translate(a.x, a.y, a.z);
    out.push(g);
    // a knot at each corner so the loop reads as bent rod, not as sticks
    out.push(new THREE.SphereGeometry(r * 1.15, 6, 4).translate(b.x, b.y, b.z));
  }
  return out;
}

// ---- the sedan's outlines (Cars.js exports them) ---------------------------------------
// The extrusions of Cars.js grow each shape by its bevel size: body 0.08,
// cabin 0.09. The wreck's plates are cut from the grown outlines.
let OUT = null;
function outlines(shapes) {
  if (OUT) return OUT;
  const body = offsetOutline(outlineOf(shapes.body(), 160), 0.075);
  const cabin = offsetOutline(outlineOf(shapes.cabin(), 120), 0.085);
  // the body's top line y(x) (the highest outline point near x)
  const topY = (pts) => (x) => {
    let best = -1, bd = 1e9;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      if ((p.x - x) * (q.x - x) > 0) continue;
      const t = Math.abs(q.x - p.x) < 1e-6 ? 0 : (x - p.x) / (q.x - p.x);
      const y = p.y + (q.y - p.y) * t;
      if (y > best) best = y;
    }
    if (best < 0) for (const p of pts) { const d = Math.abs(p.x - x); if (d < bd) { bd = d; best = p.y; } }
    return best;
  };
  OUT = { body, cabin, bodyTop: topY(body), cabTop: topY(cabin) };
  return OUT;
}

// ---- the build -----------------------------------------------------------------------------
const KINDS = {
  //         bonnet     boot    frontDoorP  frontDoorN  rearDoorP  rearDoorN  roofSag  splay  bumperF  bumperR  spare
  A: { bonnet: 'gone', boot: true, doors: { fP: 'hang', fN: 'shut', rP: 'shut', rN: 'gone' }, sag: 0.09, splay: 0.2, bumperF: 'drop', bumperR: true, spare: true },
  B: { bonnet: 'peel', boot: false, doors: { fP: 'shut', fN: 'gone', rP: 'hang', rN: 'shut' }, sag: 0.1, splay: 0, bumperF: true, bumperR: false, spare: false },
  C: { bonnet: 'peel', boot: true, doors: { fP: 'hang', fN: 'gone', rP: 'open', rN: 'hang' }, sag: 0.13, splay: 0, bumperF: true, bumperR: 'drop', spare: true },
  D: { bonnet: 'peel', boot: true, doors: { fP: 'shut', fN: 'hang', rP: 'gone', rN: 'shut' }, sag: 0.08, splay: 0.08, bumperF: 'drop', bumperR: true, spare: false },
};
export const WRECK_KINDS = Object.keys(KINDS);

const CACHE = {};

// shapes: { body(), cabin(), fender(front) } from Cars.js; roll: a D wreck's
// side (+1 / -1: the side it lies on decides where the ash settled)
export function buildWreck(kind, shapes, roll = 0) {
  const key = kind + (roll || '');
  if (CACHE[key]) return CACHE[key];
  const K = KINDS[kind] || KINDS.C;
  const O = outlines(shapes);
  const shell = [], lines = [], rims = [], doors = [];
  const edges = [];      // points along the top edges (the embers crawl there)
  const SIDE = 0.665;    // the side skins' centre plane (outer face at ~0.70)

  // -- door openings in the side skins (x0, x1: the door's rear and front edge)
  const DOORS = { f: [-0.31, 0.63], r: [-0.97, -0.35] };
  const doorHole = (x0, x1) => roundPoly([V2(x0, 0.6), V2(x1, 0.6), V2(x1 - 0.02, 1.13), V2(x0, 1.13)], 0.05);
  for (const sgn of [1, -1]) {
    const tag = sgn > 0 ? 'P' : 'N';
    const s = shapeFrom(O.body);
    // every door that is not shut is a hole (open, hanging or gone)
    for (const d of ['f', 'r']) if (K.doors[d + tag] !== 'shut') s.holes.push(doorHole(...DOORS[d]));
    // the door seams of the shut doors: a burnt panel shows its gaps
    const g = plate(s, 0.03);
    g.translate(0, 0, sgn * SIDE);
    shell.push(g);
    for (const d of ['f', 'r']) {
      if (K.doors[d + tag] !== 'shut') continue;
      const [x0, x1] = DOORS[d];
      for (const x of [x0, x1]) lines.push(line([V3(x, 1.15, sgn * (SIDE + 0.02)), V3(x + 0.01, 0.85, sgn * (SIDE + 0.024)), V3(x + 0.02, 0.6, sgn * (SIDE + 0.02))], 0.006));
    }
    // the belt: a rolled lip along the top of each skin (a line an inker
    // would pull along the car; it keeps the skin's top edge from going thin)
    const belt = [];
    for (let x = -1.72; x <= 0.78; x += 0.25) belt.push(V3(x, O.bodyTop(x) - 0.015, sgn * (SIDE + 0.005)));
    shell.push(tube(belt, 0.024, 6, 40));
    edges.push(belt.map((p) => p.clone()));
    // the fenders (the template's pontoons, kept: they carry the silhouette)
    const ff = new THREE.ExtrudeGeometry(shapes.fender(true), { depth: 0.22, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.06, bevelSegments: 3, curveSegments: 14 });
    ff.translate(0, 0, -0.11 + sgn * 0.78);
    const rf = new THREE.ExtrudeGeometry(shapes.fender(false), { depth: 0.2, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.06, bevelSegments: 3, curveSegments: 14 });
    rf.translate(0, 0, -0.1 + sgn * 0.76);
    shell.push(smoothNormals(ff, 1e-4), smoothNormals(rf, 1e-4));
    // the running board: one still on its brackets, the other hanging
    const rb = roundedBox(1.3, 0.04, 0.24, 0.015, 1);
    if (sgn < 0) rb.rotateX(-0.22).rotateZ(0.06);
    shell.push(rb.translate(-0.3, 0.46 - (sgn < 0 ? 0.05 : 0), sgn * 0.78));
  }

  // -- the tub: the floor, the firewall and the rear bulkhead (seen through
  // the door holes: the dark inside of a burnt shell)
  shell.push(roundedBox(3.9, 0.03, 1.3, 0.01, 1).translate(-0.3, 0.56, 0));
  shell.push(roundedBox(0.03, 0.6, 1.3, 0.01, 1).translate(0.74, 0.86, 0));
  shell.push(roundedBox(0.03, 0.55, 1.3, 0.01, 1).translate(-1.62, 0.84, 0));

  // -- the chassis under the floor (a rolled wreck shows its underside): the
  // two frame rails, the beam axles and the differential, the driveshaft,
  // the tank and the exhaust with its silencer
  for (const z of [-0.42, 0.42]) shell.push(roundedBox(4.1, 0.12, 0.08, 0.02, 1).translate(-0.05, 0.44, z));
  for (const x of [1.55, -1.55]) shell.push(tube([V3(x, 0.375, -0.7), V3(x, 0.39, 0), V3(x, 0.375, 0.7)], 0.038, 6, 12));
  shell.push(new THREE.SphereGeometry(0.13, 12, 8).scale(1, 0.85, 1).translate(-1.55, 0.38, 0));
  shell.push(tube([V3(0.95, 0.46, 0), V3(-0.3, 0.42, 0), V3(-1.45, 0.39, 0)], 0.035, 6, 12));
  shell.push(roundedBox(0.42, 0.26, 1.0, 0.06, 2).translate(-2.02, 0.5, 0));
  shell.push(tube([V3(1.2, 0.5, -0.28), V3(0.2, 0.32, -0.3), V3(-1.2, 0.32, -0.32), V3(-2.55, 0.34, -0.34)], 0.028, 6, 24));
  shell.push(new THREE.CylinderGeometry(0.08, 0.08, 0.6, 12).rotateZ(Math.PI / 2).translate(-0.9, 0.32, -0.32));

  // -- the engine bay: the block, the head, the radiator, the grille shell
  shell.push(roundedBox(0.72, 0.36, 0.5, 0.06, 2).translate(1.45, 0.78, 0));
  shell.push(roundedBox(0.62, 0.12, 0.34, 0.04, 2).translate(1.42, 1.0, 0.02));
  shell.push(roundedBox(0.08, 0.48, 0.62, 0.02, 1).translate(2.12, 0.84, 0));
  {
    const gs = new THREE.Shape();
    gs.moveTo(-0.22, 0.52); gs.lineTo(0.22, 0.52);
    gs.quadraticCurveTo(0.25, 0.86, 0.0, 1.08);
    gs.quadraticCurveTo(-0.25, 0.86, -0.22, 0.52);
    const grille = new THREE.ExtrudeGeometry(gs, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 1, curveSegments: 12 });
    grille.rotateY(Math.PI / 2).translate(2.3, 0, 0);
    // (the bars burnt out: a few bent ones left as line work)
    shell.push(grille.scale(1, 1, 1));
    for (const z of [-0.12, -0.04, 0.08]) lines.push(line([V3(2.38, 0.56, z), V3(2.4, 0.8, z + 0.01), V3(2.38, 1.0 - Math.abs(z), z)], 0.008));
  }
  // the bonnet deck: its top follows the body's top line from the cowl to the
  // grille. A: gone (the bay open to the sky); else peeled up and back
  const bonnetFn = (u, v) => {
    const x = 0.78 + u * 1.46, z = (v - 0.5) * 1.24;
    return V3(x, O.bodyTop(x) - 0.01 + 0.035 * (1 - (z / 0.62) ** 2), z);
  };
  if (K.bonnet === 'peel') {
    // hinged at the cowl, lifted 70 deg and folded back over the bay, its
    // front edge curled and crumpled (a torn sheet, not a lid)
    const hinge = V3(0.8, O.bodyTop(0.8), 0);
    const g = slab(14, 8, (u, v) => {
      const p = bonnetFn(u, v);
      const rel = p.clone().sub(hinge);
      const ang = 1.2 + 0.35 * u * u;            // curl: steeper toward the front edge
      const c = Math.cos(ang), s = Math.sin(ang);
      const x = rel.x * c - rel.y * s, y = rel.x * s + rel.y * c;
      const cr = (vnoise(u * 3.1, v * 2.3, 7.7) - 0.5) * 0.12 * u + Math.sin(v * Math.PI * 2 + 1.3) * 0.03 * u;
      return V3(hinge.x + x + cr, hinge.y + y, rel.z * (1 - 0.12 * u) + (vnoise(u * 2, v * 4, 3.1) - 0.5) * 0.06 * u);
    }, 0.025, (u, v) => !(u > 0.82 && (v < 0.12 || vnoise(u * 9, v * 9, 1.7) > 0.72)));
    shell.push(g);
  }
  // cowl and scuttle: the strip between the bonnet and the windscreen
  shell.push(slab(4, 6, (u, v) => { const x = 0.74 + u * 0.1, z = (v - 0.5) * 1.22; return V3(x, O.bodyTop(x) + 0.02, z); }, 0.03));

  // -- the boot: the turtle deck (B: gone, the boot a black hole)
  if (K.boot) {
    shell.push(slab(10, 8, (u, v) => {
      const x = -1.66 - u * 0.58, z = (v - 0.5) * 1.22;
      return V3(x, O.bodyTop(x) - 0.01 + 0.03 * (1 - (z / 0.62) ** 2), z);
    }, 0.03));
  } else {
    // the boot's floor and a lip of the deck left at the rear window
    shell.push(roundedBox(0.6, 0.03, 1.2, 0.01, 1).translate(-1.95, 0.64, 0));
    shell.push(slab(3, 8, (u, v) => { const x = -1.66 - u * 0.1, z = (v - 0.5) * 1.18; return V3(x, O.bodyTop(x) - 0.01, z); }, 0.03));
  }

  // -- the cabin: no glass. The roof on thin, bent pillars.
  // cabin outline points (grown): front-bottom (the cowl), top front, top rear
  const cabTop = O.cabTop;
  const roofX0 = 0.4, roofX1 = -1.18;
  const sag = K.sag;
  const roofFn = (u, v) => {
    const x = roofX0 + (roofX1 - roofX0) * u, z = (v - 0.5) * 1.18;
    const crown = 0.04 * (1 - (z / 0.6) ** 2);
    // sagged between the pillars (the B post holds the middle a little)
    const dip = sag * Math.sin(Math.PI * u) * (1 - 0.35 * Math.exp(-(((x + 0.31) / 0.18) ** 2))) * (0.75 + 0.25 * (1 - (z / 0.6) ** 2));
    const buckle = (vnoise(u * 5, v * 3, 2.2) - 0.5) * 0.03;
    return V3(x, cabTop(x) - 0.015 + crown - dip + buckle, z);
  };
  shell.push(slab(22, 10, roofFn, 0.035));
  // the roof's side edges: the rain gutters (a clean line along the top)
  for (const v of [0.02, 0.98]) {
    const pts = [];
    for (let k = 0; k <= 10; k++) pts.push(roofFn(k / 10, v).add(V3(0, -0.01, (v - 0.5) * 0.03)));
    shell.push(tube(pts, 0.02, 6, 40));
    edges.push(pts);
  }
  // the windscreen frame: the header and the cowl rail across, the A pillars
  // (bent: the heat sagged the roof onto them), a centre post stub
  const aTop = (sgn) => roofFn(0, sgn > 0 ? 1 : 0).add(V3(0.02, -0.02, 0));
  const aBot = (sgn) => V3(0.8, O.bodyTop(0.8) + 0.02, sgn * 0.57);
  shell.push(tube([aTop(-1), V3(roofX0 + 0.04, cabTop(roofX0) - 0.02 - sag * 0.2, 0), aTop(1)], 0.024, 6, 20));
  for (const sgn of [1, -1]) {
    const a = aBot(sgn), b = aTop(sgn);
    const m = a.clone().lerp(b, 0.55).add(V3(0.03, -0.02, sgn * 0.02));
    shell.push(tube([a, m, b], 0.028, 6, 16));
    // the B pillar: from the belt to the roof edge, bowed out a little
    const bb = V3(-0.31, O.bodyTop(-0.31) - 0.02, sgn * 0.6), bt = roofFn((-0.31 - roofX0) / (roofX1 - roofX0), sgn > 0 ? 0.99 : 0.01);
    const bm = bb.clone().lerp(bt, 0.5).add(V3(0.015, 0, sgn * 0.025));
    shell.push(tube([bb, bm, bt], 0.026, 6, 16));
    // the rear quarter: the narrow panel behind the rear side window, down
    // the fastback to the belt (a plate: it is the car's broadest pillar)
    const q = new THREE.Shape();
    const qp = [V2(-1.4, 1.14), V2(-1.2, 1.4), V2(-0.9, 1.6), V2(-0.94, cabTop(-0.94) - 0.04 - sag * 0.5), V2(-1.18, cabTop(-1.18) - 0.03 - sag * 0.15), V2(-1.52, 1.44), V2(-1.76, 1.14)];
    q.moveTo(qp[0].x, qp[0].y);
    for (let i = 1; i < qp.length; i++) q.lineTo(qp[i].x, qp[i].y);
    q.closePath();
    shell.push(plate(q, 0.03).translate(0, 0, sgn * 0.59));
    edges.push([V3(-0.94, cabTop(-0.94) - 0.04, sgn * 0.6), V3(-1.2, cabTop(-1.2) - 0.02, sgn * 0.6), V3(-1.52, 1.44, sgn * 0.6)]);
  }
  // the fastback: roof to boot, with the rear window a torn hole
  {
    const fx0 = -1.18, fx1 = -1.72;
    const fb = (u, v) => {
      const x = fx0 + (fx1 - fx0) * u, z = (v - 0.5) * 1.18;
      return V3(x, cabTop(x) - 0.02 + 0.02 * (1 - (z / 0.6) ** 2) - sag * 0.15 * (1 - u), z);
    };
    shell.push(slab(8, 10, fb, 0.03, (u, v) => !(u > 0.12 && u < 0.62 && v > 0.22 && v < 0.78) || vnoise(u * 11, v * 11, 5.5) > 0.86));
  }

  // -- the interior: seat frames, springs, the steering wheel (line work)
  const seat = (xb, xf, yb, lean) => {
    const out = [];
    const z0 = -0.56, z1 = 0.56;
    // the cushion frame (a loop) and three zig-zag springs across it
    out.push(...polyline([V3(xb, yb, z0), V3(xf, yb, z0), V3(xf, yb, z1), V3(xb, yb, z1), V3(xb, yb, z0)], 0.011));
    for (const x of [xb + 0.1, (xb + xf) / 2, xf - 0.1]) {
      const zz = [];
      for (let k = 0; k <= 8; k++) zz.push(V3(x + (k % 2 ? 0.04 : -0.04), yb + 0.03, z0 + (z1 - z0) * k / 8));
      out.push(...polyline(zz, 0.006));
    }
    // the back frame, leaning back, and two springs up it
    const top = yb + 0.52;
    const xt = xb - lean;
    out.push(...polyline([V3(xb, yb, z0), V3(xt, top, z0 + 0.03), V3(xt, top, z1 - 0.03), V3(xb, yb, z1)], 0.011));
    for (const z of [-0.2, 0.2]) {
      const zz = [];
      for (let k = 0; k <= 7; k++) { const t = k / 7; zz.push(V3(xb + (xt - xb) * t, yb + (top - yb) * t, z + (k % 2 ? 0.05 : -0.05))); }
      out.push(...polyline(zz, 0.006));
    }
    // the legs down to the floor
    for (const z of [z0 + 0.05, z1 - 0.05]) out.push(...polyline([V3(xf - 0.03, yb, z), V3(xf - 0.05, 0.58, z)], 0.01));
    return out;
  };
  lines.push(...seat(-0.26, 0.2, 0.88, 0.14));
  lines.push(...seat(-1.24, -0.8, 0.86, 0.12));
  // steering: the column from the firewall, the ring (its rim burnt to the
  // steel core: a thin circle), two spokes
  {
    const z = -0.3;
    const c0 = V3(0.72, 1.02, z), c1 = V3(0.4, 1.3, z);
    lines.push(...polyline([c0, c1], 0.016));
    const axis = c1.clone().sub(c0).normalize();
    const ring = new THREE.TorusGeometry(0.19, 0.011, 5, 36);
    ring.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 0, 1), axis));
    ring.translate(c1.x, c1.y, c1.z);
    lines.push(ring);
    const sp = new THREE.Vector3().crossVectors(axis, V3(0, 0, 1)).normalize();
    lines.push(...polyline([c1.clone().addScaledVector(sp, 0.19), c1, c1.clone().addScaledVector(sp, -0.19)], 0.008));
  }

  // -- the headlamp shells (empty, the lenses gone) and the bumpers
  for (const sgn of [1, -1]) {
    const hl = lathe([[0.0, -0.25], [0.05, -0.23], [0.1, -0.17], [0.13, -0.09], [0.145, 0.0], [0.15, 0.03], [0.135, 0.045], [0.12, 0.03]], 16);
    hl.rotateZ(-Math.PI / 2).translate(2.26, 0.98, sgn * 0.6);
    shell.push(hl);
  }
  const bumper = (x, s, drop) => {
    const g = tube([V3(x - s * 0.1, 0.46, -0.95), V3(x, 0.46, -0.55), V3(x + s * 0.03, 0.46, 0), V3(x, 0.46, 0.55), V3(x - s * 0.1, 0.46, 0.95)], 0.05, 8, 32);
    g.translate(0, -0.46, 0).scale(1, 1.6, 1).translate(0, 0.46, 0);
    if (drop) {
      // torn off its -z bracket: it hangs from the other, one end on the street
      g.translate(-x, -0.46, -0.95).rotateX(-0.36).translate(x, 0.46, 0.95);
    }
    return g;
  };
  if (K.bumperF) shell.push(bumper(2.55, 1, K.bumperF === 'drop'));
  if (K.bumperR) shell.push(bumper(-2.55, -1, K.bumperR === 'drop'));

  // -- the rims: the tyres burnt away, the car on its steel wheels
  const wheel = (wx, wy, wz, sgn, splay, seed) => {
    const out = [], rib = [];
    // the dished disc and the two flanges
    const disc = lathe([[0.235, -0.06], [0.24, -0.02], [0.2, 0.0], [0.12, 0.03], [0.05, 0.05], [0.0, 0.05]], 24).rotateX(sgn * Math.PI / 2);
    const f1 = new THREE.TorusGeometry(RIM_R - 0.018, 0.018, 6, 40).translate(0, 0, 0.055);
    const f2 = new THREE.TorusGeometry(RIM_R - 0.018, 0.018, 6, 40).translate(0, 0, -0.055);
    const band = new THREE.CylinderGeometry(RIM_R - 0.03, RIM_R - 0.03, 0.11, 32, 1, true).rotateX(Math.PI / 2);
    const hub = lathe([[0.07, -0.01], [0.065, 0.02], [0.04, 0.045], [0.0, 0.05]], 12).rotateX(sgn * Math.PI / 2).translate(0, 0, sgn * 0.05);
    // what is left of the tyre: a few ribbons of rubber off the bead, hanging
    // (the lowest hangs to the street, the others curl)
    for (let k = 0; k < 4; k++) {
      const a0 = -Math.PI / 2 + (hash3(seed, k, 1) - 0.5) * 2.6;
      const len = 0.12 + 0.2 * hash3(seed, k, 2);
      const w = 0.025 + 0.02 * hash3(seed, k, 3);
      const zc = (hash3(seed, k, 4) - 0.5) * 0.08;
      rib.push(slab(1, 6, (u, v) => {
        const r0 = RIM_R - 0.01;
        const bx = Math.cos(a0) * r0, by = Math.sin(a0) * r0;
        // it leaves the rim tangentially and falls under its weight
        const t = v * len;
        const out2 = 0.05 * Math.sin(v * 2.5 + seed);
        return V3(bx + Math.cos(a0) * out2 + Math.sin(a0) * t * 0.3, by - t * 0.9 + Math.cos(a0) * out2 * 0.2, zc + (u - 0.5) * w + Math.sin(v * 5 + k) * 0.015);
      }, 0.008));
    }
    // and one torn arc of bead still round the top of the rim
    const arc = new THREE.TorusGeometry(RIM_R - 0.006, 0.026, 5, 14, 0.9 + hash3(seed, 9, 9));
    arc.rotateZ(0.6 + hash3(seed, 8, 8) * 1.2);
    out.push(disc, f1, f2, band, hub, arc);
    const m = new THREE.Matrix4().compose(V3(wx, wy, wz), new THREE.Quaternion().setFromEuler(new THREE.Euler(sgn * splay, 0, 0)), V3(1, 1, 1));
    for (const g of [...out, ...rib]) g.applyMatrix4(m);
    return { out, rib };
  };
  let seed = 1;
  for (const [wx, wz, front] of [[1.55, 0.78, 1], [1.55, -0.78, 1], [-1.55, 0.76, 0], [-1.55, -0.76, 0]]) {
    const sgn = Math.sign(wz);
    // (A: the front suspension gave way, the front wheels splay out at the
    // bottom; the rims sit at the intact wheel centre, the body comes down)
    const w = wheel(wx, 0.375, wz, sgn, front ? K.splay : 0, seed++);
    rims.push(...w.out);
    lines.push(...w.rib);
  }
  // the spare on the turtle deck: the rim only
  if (K.spare) {
    const spareAxis = V3(-0.78, 0.62, 0).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 0, 1), spareAxis);
    rims.push(new THREE.TorusGeometry(0.2, 0.018, 6, 30).applyQuaternion(q).translate(-2.31, 0.8, 0));
    rims.push(new THREE.CircleGeometry(0.19, 20).applyQuaternion(q).translate(-2.3, 0.8, 0));
  }

  // -- the doors that are not shut: hanging on the lower hinge, or open
  const doorGeo = (x0, x1) => {
    // the door panel (the skin's piece) + its window frame (glass gone)
    const s = new THREE.Shape();
    const pts = [V2(x0, 0.6), V2(x1, 0.6), V2(x1 - 0.02, 1.13), V2(x0, 1.13)];
    s.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < 4; i++) s.lineTo(pts[i].x, pts[i].y);
    s.closePath();
    const g = [plate(s, 0.035)];
    const top = x1 > 0 ? [V3(x1 - 0.04, 1.14, 0), V3(x1 - 0.2, 1.5, 0), V3(x0 + 0.05, 1.56, 0), V3(x0 + 0.02, 1.14, 0)]
      : [V3(x1 - 0.02, 1.14, 0), V3(x1 - 0.02, 1.56, 0), V3(x0 + 0.34, 1.52, 0), V3(x0 + 0.1, 1.3, 0), V3(x0 + 0.02, 1.14, 0)];
    g.push(...polyline(top, 0.018));
    return g;
  };
  for (const sgn of [1, -1]) {
    const tag = sgn > 0 ? 'P' : 'N';
    for (const d of ['f', 'r']) {
      const st = K.doors[d + tag];
      if (st !== 'hang' && st !== 'open') continue;
      const [x0, x1] = DOORS[d];
      // hinged at its front edge; swung out, then (hanging) dropped round the
      // lower hinge so its free edge droops toward the street
      const hinge = V3(x1, 0.62, sgn * SIDE);
      const swing = st === 'open' ? 1.15 : 0.95;
      const droop = st === 'hang' ? 0.34 : 0.05;
      const parts = doorGeo(x0, x1);
      const q = new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), sgn * swing);
      const q2 = new THREE.Quaternion().setFromAxisAngle(V3(1, 0, 0).applyQuaternion(q), -sgn * droop);
      for (const g of parts) {
        g.translate(-x1, -0.62, 0);
        g.applyQuaternion(q);
        g.applyQuaternion(q2);
        g.translate(hinge.x, hinge.y, hinge.z);
        doors.push(g);
      }
    }
  }

  const out = {
    shell: merge(shell), lines: merge(lines), rims: merge(rims), doors: doors.length ? merge(doors) : null,
    edges: edges.map((pts) => pts.map((p) => p.clone())), kind,
  };
  // (the up the ash settled on: a D wreck lies on its side)
  const up = roll ? V3(0, 0, -roll) : V3(0, 1, 0);
  ashColours(out.shell, 1, up, roll ? 0.85 : 0);
  if (out.doors) ashColours(out.doors, 2, up, roll ? 0.85 : 0);
  // the whole wreck sits on its rims, 9 cm lower than the car stood (the
  // rims stay at the wheel centres: their flanges meet the street)
  for (const k of ['shell', 'lines', 'doors']) if (out[k]) out[k].translate(0, -WRECK_DROP, 0);
  out.rims.translate(0, -WRECK_DROP, 0);
  for (const e of out.edges) for (const p of e) p.y -= WRECK_DROP;
  for (const k of ['shell', 'lines', 'rims', 'doors']) if (out[k]) out[k].computeBoundingBox();
  CACHE[key] = out;
  return out;
}

// Char black with pale ash on the top edges: the colour attribute
// (multiplied into the char material). Upward faces take a patchy ash (a
// dry-brush field of low-frequency noise), vertical faces stay char; the
// steel of the lower body is darkest.
function ashColours(g, seed, upv, lift) {
  const p = g.getAttribute('position'), n = g.getAttribute('normal');
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const ny = n.getX(i) * upv.x + n.getY(i) * upv.y + n.getZ(i) * upv.z;
    const y = x * upv.x + p.getY(i) * upv.y + z * upv.z + lift;
    const up = Math.max(0, Math.min(1, (ny - 0.45) / 0.45));
    const py = p.getY(i);
    const patch = vnoise(x * 3.3 + seed, py * 5.1, z * 3.7);
    const fine = vnoise(x * 17 + 3, py * 17, z * 17 + seed);
    // (only high up: the belt, the roof, the tops of the fenders and deck)
    const high = Math.max(0, Math.min(1, (y - 0.95) / 0.25));
    const ash = up * high * Math.max(0, Math.min(1, (patch - 0.38) * 3.2)) * (0.55 + 0.45 * fine);
    const c = 0.0016 + 0.07 * ash;
    col[i * 3] = c; col[i * 3 + 1] = c * 0.99; col[i * 3 + 2] = c * 0.97;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

// The wreck's materials (shared by every wreck, made once)
let MATS = null;
export function wreckMaterials(M) {
  if (MATS) return MATS;
  const std = (o) => new THREE.MeshStandardMaterial({ envMap: M.envSoft, ...o });
  MATS = {
    // (double sided: the plates and sheets are seen from inside through
    // the holes; the ink's id pass is double sided already)
    shell: std({ color: 0xffffff, vertexColors: true, roughness: 0.97, metalness: 0.04, envMapIntensity: 0.08, side: THREE.DoubleSide }),
    lines: std({ color: 0x040404, roughness: 0.9, metalness: 0.1, envMapIntensity: 0.05, side: THREE.DoubleSide }),
    rims: std({ color: 0x0a0a0a, roughness: 0.8, metalness: 0.3, envMapIntensity: 0.12, side: THREE.DoubleSide }),
  };
  return MATS;
}

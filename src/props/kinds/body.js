import * as THREE from 'three';
import { PM, lathe, slab, mergeGeos, std } from '../lib.js';
import { accentMaterial } from '../../render/accents.js';

// The body's things (scene 3, lane B1): what lies round Ames in the alley
// and what the puzzles are made of.
//   amesHat      a soft grey felt hat, the crown pinched, the band dark:
//                it lies crown down in the gutter's water, turning
//   amesShoe     a man's black oxford on its side (his left)
//   spectacles   round wire frames, the left glass starred by the fall
//   casing       a spent brass case, 9 mm
//   matchHalf    the torn half of a Cardinal matchbook's back cover (crew
//                red): half of the black bird, the torn edge white
// The torn back of the matchbook itself (tornBack) is built here too: the
// scene lays it on the book it came from (the halves puzzle).

// ---- the tear: one jagged line across the book's back (its frame: x across
// the book, w = 0.038; z along it, L = 0.05; the hinge at -z) -------------------
export const BOOK = { w: 0.038, L: 0.05, t: 0.0022 };
const TEAR = (() => {
  // hand-placed: a diagonal, torn with small teeth (never a straight cut)
  const pts = [];
  const n = 13;
  const tooth = [0, 0.0012, -0.0009, 0.0016, 0.0004, -0.0013, 0.001, 0.0018, -0.0006, 0.0011, -0.0014, 0.0007, 0.0];
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const x = -BOOK.w / 2 + u * BOOK.w;
    const z = -0.006 + u * 0.014 + tooth[i];
    pts.push([x, z]);
  }
  return pts;
})();
export const TEAR_PTS = TEAR;

// a canvas: the black bird (a cardinal: the crest, the beak, the long tail)
// on transparent, for the book's back
let BIRD = null;
function birdTexture() {
  if (BIRD) return BIRD;
  const c = document.createElement('canvas'); c.width = 256; c.height = 320;
  const x = c.getContext('2d');
  x.fillStyle = '#000';
  x.translate(128, 170);
  x.beginPath();
  // the body and the head, the crest raised, the beak to the left
  x.moveTo(-70, -20);
  x.bezierCurveTo(-60, -60, -20, -70, 0, -72);
  x.lineTo(20, -118); x.lineTo(24, -76);
  x.bezierCurveTo(60, -70, 80, -40, 70, 0);
  x.bezierCurveTo(64, 40, 40, 60, 20, 70);
  // the tail, long, fanned down to the right
  x.lineTo(70, 140); x.lineTo(40, 146); x.lineTo(0, 76);
  x.bezierCurveTo(-30, 70, -60, 40, -66, 0);
  x.lineTo(-104, -10); x.lineTo(-72, -32);
  x.closePath();
  x.fill();
  // (the eye: a pin of red)
  x.globalCompositeOperation = 'destination-out';
  x.beginPath(); x.arc(-34, -34, 7, 0, Math.PI * 2); x.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  BIRD = t;
  return t;
}

// the book's back rectangle -> uv (the bird drawn across the tear, a little
// toward the hinge so each half has a good part of it)
const uvOf = (x, z) => [(x + BOOK.w / 2) / BOOK.w, 1 - (z + BOOK.L / 2) / BOOK.L];

// a flat piece: the polygon pts [[x, z]] extruded t thick (y 0 .. t), with
// uvs from the book's frame; returns the slab and its outer-face decal
function piece(pts, t) {
  const s = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  const geo = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: 1 });
  geo.rotateX(-Math.PI / 2);
  // (the printed outer face, under the slab: laid flat as the slab is, then
  // turned to face down)
  const decal = new THREE.ShapeGeometry(s, 1).rotateX(-Math.PI / 2).scale(1, -1, 1).translate(0, -0.0002, 0);
  const uv = decal.getAttribute('uv'), p = decal.getAttribute('position');
  for (let i = 0; i < uv.count; i++) { const [u, v] = uvOf(p.getX(i), p.getZ(i)); uv.setXY(i, u, v); }
  return { geo, decal };
}
// the torn edge: a thin pale strip along the tear on the outer face (the
// card's fibres where it tore)
function tearEdge(side) {
  const pts = [];
  for (const [x, z] of TEAR) pts.push(new THREE.Vector3(x, -0.0003, z + side * 0.0004));
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.00035, 4, false);
  return g;
}

// the remaining back (the +z side of the tear, toward the striker) and the
// half that tore off (the hinge side)
export function tornBack() {
  const { w, L, t } = BOOK;
  const keep = [[-w / 2, L / 2], [w / 2, L / 2], ...[...TEAR].reverse()];
  const half = [...TEAR, [w / 2, -L / 2], [-w / 2, -L / 2]];
  return { keep: piece(keep, t), half: piece(half, t), edgeKeep: tearEdge(1), edgeHalf: tearEdge(-1) };
}
export function birdMaterial() {
  const m = new THREE.MeshBasicMaterial({ color: 0x050505, map: birdTexture(), alphaTest: 0.5, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  m.name = 'prop_birdDecal';
  return m;
}
export function edgeMaterial() { return std('tornEdge', { color: 0x9a9a9a, roughness: 0.95, surface: 'cloth' }); }

export const SPECS = {
  amesHat(v, lod) {
    const P = PM();
    const seg = lod ? 24 : 48;
    // a fedora lying crown down: built upright, the scene turns it
    const crown = lathe([[0.0, 0.14], [0.03, 0.142], [0.06, 0.135], [0.075, 0.115], [0.085, 0.06], [0.09, 0.012], [0.092, 0.0]], seg);
    // (the pinch: the crown's front squeezed in)
    const p = crown.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const k = Math.max(0, (y - 0.07) / 0.07) * Math.exp(-((Math.atan2(x, z)) ** 2) / 0.5);
      p.setX(i, x * (1 - 0.18 * k)); p.setY(i, y - 0.012 * k);
    }
    crown.computeVertexNormals();
    const brim = lathe([[0.092, 0.004], [0.13, 0.0], [0.155, -0.006], [0.158, -0.004], [0.13, 0.006], [0.092, 0.012]], seg);
    const band = lathe([[0.0915, 0.012], [0.0925, 0.012], [0.0905, 0.032], [0.0895, 0.032]], seg);
    const felt = std('hatFelt', { color: 0x767676, roughness: 0.9, surface: 'cloth' });   // [R2-G] (a pale felt: it must read on black water)
    return { parts: [{ geo: crown, mat: felt, id: 0 }, { geo: brim, mat: felt, id: 0 }, { geo: band, mat: P.black, id: 1 }], grip: [0, 0.07, 0] };
  },
  amesShoe(v, lod) {
    const P = PM();
    const s = lod ? 16 : 32;
    const upper = new THREE.SphereGeometry(1, s, s / 2).scale(0.045, 0.04, 0.13).translate(0, 0.04, 0.01);
    const sole = slab(0.09, 0.012, 0.28, { bevel: 0.004, corner: 0.03, seg: 2 }).translate(0, 0, 0.005);
    const heel = slab(0.07, 0.025, 0.06, { bevel: 0.003, corner: 0.01, seg: 2 }).translate(0, 0, -0.1);
    const opening = new THREE.CircleGeometry(0.032, 16).rotateX(-Math.PI / 2).scale(1, 1, 1.5).translate(0, 0.081, -0.05);
    return { parts: [{ geo: upper, mat: P.leather, id: 0 }, { geo: mergeGeos([sole, heel]), mat: P.black, id: 1 }, { geo: opening, mat: P.black, id: 1 }], grip: [0, 0.04, 0] };
  },
  spectacles(v, lod) {
    const P = PM();
    const r = 0.021, gap = 0.012;
    const rim = [], glass = [], crack = [];
    for (const s of [-1, 1]) {
      rim.push(new THREE.TorusGeometry(r, 0.0011, 5, lod ? 20 : 40).translate(s * (r + gap / 2), 0, 0));
      glass.push(new THREE.CircleGeometry(r, 28).translate(s * (r + gap / 2), 0, 0));
    }
    // the bridge and the arms (folded in, one askew)
    rim.push(new THREE.TorusGeometry(gap / 2 + 0.002, 0.0011, 4, 10, Math.PI).translate(0, 0.004, 0));
    for (const s of [-1, 1]) {
      const a = new THREE.CylinderGeometry(0.0009, 0.0009, 0.11, 5).rotateX(Math.PI / 2).translate(s * (2 * r + gap / 2), 0, -0.055);
      rim.push(s > 0 ? a.rotateY(0.3) : a);
    }
    // the left glass starred: a few thin dark lines from a point
    const c0 = new THREE.Vector3(-(r + gap / 2) + 0.004, 0.005, 0.0005);
    for (let k = 0; k < 7; k++) {
      const a = k * 0.9 + 0.3, l = r * (0.7 + 0.3 * ((k * 37) % 5) / 5);
      const b = c0.clone().add(new THREE.Vector3(Math.cos(a) * l, Math.sin(a) * l, 0));
      const d = b.clone().sub(c0);
      const g = new THREE.PlaneGeometry(0.0005, d.length()).translate(0, d.length() / 2, 0);
      g.rotateZ(Math.atan2(-d.x, d.y)).translate(c0.x, c0.y, c0.z);
      crack.push(g);
    }
    const parts = [
      { geo: mergeGeos(rim), mat: P.metal, id: 0 },
      { geo: mergeGeos(glass), mat: P.glass, id: 1, cast: false },
      { geo: mergeGeos(crack), mat: P.black, id: 1, cast: false, side: THREE.DoubleSide },
    ];
    // (built facing +z, upright: lying on the flags the scene lays it flat)
    return { parts, grip: [0, 0, 0] };
  },
  casing(v, lod) {
    const P = PM();
    const c = lathe([[0.0, 0.0], [0.0048, 0.0], [0.0048, 0.001], [0.0043, 0.0015], [0.0045, 0.019], [0.0042, 0.019], [0.0042, 0.002], [0, 0.002]], lod ? 10 : 18);
    c.rotateX(Math.PI / 2).translate(0, 0.0045, -0.0095);
    return { parts: [{ geo: c, mat: P.brass, id: 0 }], grip: [0, 0.004, 0] };
  },
  matchHalf(v, lod) {
    const T = tornBack();
    // (the half's own frame: centred on itself, lying face up - its printed
    // outer face (the bird's half) up)
    const flip = (g) => g.clone().rotateZ(Math.PI).translate(0, BOOK.t, 0);
    const crew = accentMaterial('crew');
    const parts = [
      { geo: flip(T.half.geo), mat: crew, id: 0 },
      { geo: flip(T.half.decal), mat: birdMaterial(), id: 0, cast: false },
      { geo: flip(T.edgeHalf), mat: edgeMaterial(), id: 0, cast: false },
    ];
    return { parts, grip: [0, BOOK.t, -0.012], accent: 'crew' };
  },
};

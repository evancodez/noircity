import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { accentMaterial } from '../render/accents.js';

// Shared making for the prop library and the diner's furniture: the
// materials (ink greys: low albedos, no gloss), smooth geometry (lathes,
// fluted lathes, tubes along curves, bevelled boxes and slabs) and one
// procedural atlas of printed paper (labels, the menu board, the clock
// face, the licence card, the newspaper, the matchbook's bird).
//
// Tone: a room indoors is lit by the stage's hemisphere (flat, everywhere)
// and by the pendants' pooled spot lights (~200 lux on the counter). An
// albedo of sRGB 0x18 prints black in the ambient and paper white in a lamp
// pool; 0x28..0x40 are the dark-grey washes; nothing in a room needs more
// than ~0x48 to read as "light" (china, paper, the apron).
export const V2 = (x, y) => new THREE.Vector2(x, y);
export const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---- materials ------------------------------------------------------------------
const cache = new Map();
export function std(key, { color, roughness = 0.8, metalness = 0, surface = null, ...rest } = {}) {
  if (cache.has(key)) return cache.get(key);
  const m = new THREE.MeshStandardMaterial({ color, roughness, metalness, ...rest });
  m.name = 'prop_' + key;
  if (surface) m.userData.inkSurface = surface;
  cache.set(key, m);
  return m;
}
export function basic(key, opts) {
  if (cache.has(key)) return cache.get(key);
  const m = new THREE.MeshBasicMaterial(opts);
  m.name = 'prop_' + key;
  cache.set(key, m);
  return m;
}
export function accentMat(key, opts = {}) {
  const k = 'accent_' + key + JSON.stringify(opts);
  if (cache.has(k)) return cache.get(k);
  const m = accentMaterial(key, opts);
  cache.set(k, m);
  return m;
}

// a white highlight tick on glass (a bottle's shoulder, a tumbler's rim):
// an unlit paper-white stroke, printed as paper in the hands too
function tickMat() {
  if (cache.has('tick')) return cache.get('tick');
  const m = basic('tick', { color: new THREE.Color(1, 1, 1).multiplyScalar(1.6) });
  m.userData.inkSurface = 'paper';
  return m;
}

function amberLineMat() {
  if (cache.has('amberLine')) return cache.get('amberLine');
  const m = accentMaterial('amber');
  m.name = 'prop_amberLine';
  m.transparent = true;
  m.depthWrite = false;
  m.side = THREE.DoubleSide;
  cache.set('amberLine', m);
  return m;
}

// the prop palette (sRGB hex; see the tone note above)
export function PM() {
  return {
    china: std('china', { color: 0x3c3c3c, roughness: 0.42, surface: 'enamel' }),
    chinaRim: std('chinaRim', { color: 0x141414, roughness: 0.5, surface: 'enamel' }),
    glass: std('glass', { color: 0x6a6a6a, roughness: 0.14, transparent: true, opacity: 0.32, depthWrite: false, surface: 'metal' }),
    // (fix round A5: the glass of a vessel that holds scotch - its own ink
    // class, so the amber is read through it and the empty glass above the
    // fill line prints dark)
    amberGlass: std('amberGlass', { color: 0x6a6a6a, roughness: 0.14, transparent: true, opacity: 0.28, depthWrite: false, surface: 'amberGlass' }),
    glassThick: std('glassThick', { color: 0x5a5a5a, roughness: 0.16, transparent: true, opacity: 0.55, depthWrite: false, surface: 'metal' }),
    glassDark: std('glassDark', { color: 0x1e1e1e, roughness: 0.18, transparent: true, opacity: 0.82, depthWrite: false, surface: 'metal' }),
    bottleDark: std('bottleDark', { color: 0x050505, roughness: 0.22, surface: 'metal' }),
    metal: std('metal', { color: 0x090909, roughness: 0.3, metalness: 0.0, surface: 'metal' }),
    chrome: std('chrome', { color: 0x080808, roughness: 0.16, metalness: 0.0, surface: 'metal' }),
    brass: std('brass', { color: 0x161616, roughness: 0.25, surface: 'metal' }),
    dark: std('dark', { color: 0x070707, roughness: 0.8, surface: 'wood' }),
    black: std('black', { color: 0x030303, roughness: 0.9, surface: 'cloth' }),
    paper: std('paper', { color: 0x3a3a3a, roughness: 0.95, surface: 'cloth' }),
    paperLight: std('paperLight', { color: 0x484848, roughness: 0.95, surface: 'cloth' }),
    leather: std('leather', { color: 0x050505, roughness: 0.7, surface: 'cloth' }),
    seat: std('seat', { color: 0x0e0e0e, roughness: 0.6, surface: 'cloth' }),
    cork: std('cork', { color: 0x2a2a2a, roughness: 0.95, surface: 'wood' }),
    food: std('food', { color: 0x2c2c2c, roughness: 0.9, surface: 'cloth' }),
    crust: std('crust', { color: 0x363636, roughness: 0.9, surface: 'cloth' }),
    coffee: std('coffee', { color: 0x040404, roughness: 0.15, surface: 'enamel' }),
    ash: std('ash', { color: 0x0e0e0e, roughness: 1.0, surface: 'cloth' }),
    atlas: std('atlas', { color: 0x606060, roughness: 0.9, map: atlas().tex, surface: 'cloth' }),
    atlasDecal: std('atlasDecal', { color: 0x303030, roughness: 0.9, map: atlas().tex, alphaTest: 0.5, surface: 'cloth' }),
    atlasGlow: basic('atlasGlow', { color: 0xffffff, map: atlas().tex }),
    tick: tickMat(),
    amber: accentMat('amber'),
    // (the meniscus line: the amber, drawn over the bottle's glass)
    amberLine: amberLineMat(),
    crew: accentMat('crew'),
    ember: accentMat('ember'),
  };
}

// ---- geometry ------------------------------------------------------------------
export function lathe(profile, segs = 40, phi0 = 0, phiLen = Math.PI * 2) {
  return new THREE.LatheGeometry(profile.map(([r, y]) => V2(Math.max(r, 1e-4), y)), segs, phi0, phiLen);
}

// A lathe whose radius is modulated round the axis: r(y) - depth(y) *
// flute(phi). Welded at the seam so the normals are smooth all round.
export function flutedLathe(profile, { segs = 60, count = 10, depth = () => 0 } = {}) {
  const rows = profile.length;
  const pos = [], idx = [];
  for (let i = 0; i < rows; i++) {
    const [r, y] = profile[i];
    const dd = depth(y, i);
    for (let j = 0; j <= segs; j++) {
      const a = (j / segs) * Math.PI * 2;
      // a shallow scallop per flute: 0 at the ridge, 1 mid-flute
      const f = Math.pow(Math.sin(((a * count) / 2) % Math.PI), 1.4);
      const rr = Math.max(1e-4, r - dd * f);
      pos.push(Math.sin(a) * rr, y, Math.cos(a) * rr);
    }
  }
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < segs; j++) {
      const a = i * (segs + 1) + j, b = a + segs + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const w = mergeVertices(g, 1e-6);
  w.computeVertexNormals();
  return w;
}

// weld and smooth
export function smooth(geo, tol = 1e-5) {
  geo.deleteAttribute('normal');
  const uv = geo.getAttribute('uv');
  if (uv) geo.deleteAttribute('uv');
  const g = mergeVertices(geo, tol);
  g.computeVertexNormals();
  return g;
}

// keep position + normal (+ uv when every part has one) so merges line up
export function mergeGeos(list, { uv = false, color = false } = {}) {
  const clean = list.map((g) => {
    let q = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(q.attributes)) if (k !== 'position' && k !== 'normal' && !(uv && k === 'uv') && !(color && k === 'color')) q.deleteAttribute(k);
    const n = q.getAttribute('position').count;
    if (!q.getAttribute('normal')) q.computeVertexNormals();
    if (uv && !q.getAttribute('uv')) q.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
    if (color && !q.getAttribute('color')) q.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3).fill(1), 3));
    return q;
  });
  return mergeGeometries(clean, false);
}

// a rounded rectangle in the x/y plane
export function roundRectShape(w, h, r) {
  const s = new THREE.Shape();
  r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4);
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// A bevelled slab: a rounded-rectangle footprint w (x) by d (z), h tall,
// its base on y = 0, edges rounded by `bevel`, corners by `corner`.
export function slab(w, h, d, { bevel = 0.004, corner = 0.006, seg = 3, curve = 6 } = {}) {
  bevel = Math.min(bevel, h * 0.45, w * 0.3, d * 0.3);
  const s = roundRectShape(w - 2 * bevel, d - 2 * bevel, Math.max(1e-4, corner - bevel * 0.5));
  const depth = Math.max(1e-4, h - 2 * bevel);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: seg, curveSegments: curve });
  // extrude runs along +z: stand it up (z -> y) with the base on y = 0
  g.rotateX(-Math.PI / 2);
  g.translate(0, bevel, 0);
  return smooth(g);
}

// a box with uvs kept (for printed faces)
export function boxUV(w, h, d) { return new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0); }

// a tube along points (smooth; closed caps optional)
export function tubeAlong(points, r, radial = 10, tubular = null, closed = false) {
  const c = new THREE.CatmullRomCurve3(points, closed, 'centripetal');
  return new THREE.TubeGeometry(c, tubular || points.length * 8, r, radial, closed);
}

// a torus arc as a handle: in the x/y plane, from angle a0 to a1
export function handleArc(R, r, a0, a1, segs = 24, radial = 10) {
  const g = new THREE.TorusGeometry(R, r, radial, segs, a1 - a0);
  g.rotateZ(a0);
  return g;
}

// a flat polygon (x/z plane, facing up) from [[x, z]], at height y
export function flatPoly(pts, y = 0) {
  const s = new THREE.Shape(pts.map(([x, z]) => V2(x, -z)));
  const g = new THREE.ShapeGeometry(s, 8);
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

// remap a geometry's uvs (0..1) into an atlas rect [u0, v0, u1, v1]
export function uvRect(geo, [u0, v0, u1, v1]) {
  const uv = geo.getAttribute('uv');
  if (!uv) return geo;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
  uv.needsUpdate = true;
  return geo;
}

// planar uvs from the x/y extent of a geometry (a printed face seen along z)
export function planarUV(geo, axisU = 'x', axisV = 'y', rect = [0, 0, 1, 1]) {
  geo.computeBoundingBox();
  const b = geo.boundingBox, p = geo.getAttribute('position');
  const uv = new Float32Array(p.count * 2);
  const get = (i, a) => (a === 'x' ? p.getX(i) : a === 'y' ? p.getY(i) : p.getZ(i));
  const [u0, v0, u1, v1] = rect;
  for (let i = 0; i < p.count; i++) {
    const s = (get(i, axisU) - b.min[axisU]) / Math.max(1e-6, b.max[axisU] - b.min[axisU]);
    const t = (get(i, axisV) - b.min[axisV]) / Math.max(1e-6, b.max[axisV] - b.min[axisV]);
    uv[i * 2] = u0 + s * (u1 - u0);
    uv[i * 2 + 1] = v0 + t * (v1 - v0);
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

// ---- the printed atlas ------------------------------------------------------------
// One 1024 x 1024 canvas, greyscale except where alpha cuts a decal. Every
// region is drawn once with fixed marks (no randomness: a few hand-placed
// strokes), so every build prints the same.
//   [u0, v0, u1, v1] rects (three.js uv: v up)
let ATLAS = null;
const R = (x, y, w, h) => [x / 1024, 1 - (y + h) / 1024, (x + w) / 1024, 1 - y / 1024];
export const AT = {
  scotch: R(0, 0, 256, 128),       // the scotch's paper label
  rye: R(0, 128, 256, 128),        // a plainer label
  pack: R(256, 0, 128, 192),       // the cigarette pack's face
  match: R(384, 0, 128, 192),      // the matchbook's bird and name (decal)
  licence: R(512, 0, 256, 160),    // the licence card
  news: R(768, 0, 256, 256),       // the newspaper's front
  menuBoard: R(0, 256, 512, 256),  // the menu board (white on black)
  clock: R(512, 256, 256, 256),    // the wall clock's face
  menu: R(768, 256, 256, 256),     // a menu card's cover
  napkin: R(0, 512, 128, 128),     // napkins (a paper white patch)
  ketchup: R(128, 512, 128, 128),  // a ketchup label
  milk: R(256, 512, 128, 128),     // the dairy's mark
  headline: R(384, 512, 256, 128), // a folded paper's headline (three bars)
  gin: R(640, 512, 128, 128),      // the gin's label
  sign: R(768, 512, 256, 128),     // REST ROOM / a small card (P2)
  juke: R(0, 640, 256, 256),       // the jukebox's record label ring
};
export function atlas() {
  if (ATLAS) return ATLAS;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 1024;
  const g = cv.getContext('2d');
  g.fillStyle = '#000';
  g.clearRect(0, 0, 1024, 1024);
  const px = (r) => [r[0] * 1024, (1 - r[3]) * 1024, (r[2] - r[0]) * 1024, (r[3] - r[1]) * 1024];
  const fill = (r, c) => { const [x, y, w, h] = px(r); g.fillStyle = c; g.fillRect(x, y, w, h); return [x, y, w, h]; };
  const serif = (s, bold = true) => `${bold ? 'bold ' : ''}${s}px Georgia, 'Times New Roman', serif`;
  const sans = (s) => `bold ${s}px 'Helvetica Neue', Arial, sans-serif`;
  const text = (t, x, y, font, c = '#111', align = 'center') => { g.font = font; g.fillStyle = c; g.textAlign = align; g.textBaseline = 'middle'; g.fillText(t, x, y); };
  const stroke = (pts, w, c) => { g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); };

  // scotch label: an old paper with a dark crest, a heavy name bar and two
  // thin lines (no readable words at arm's length)
  {
    const [x, y, w, h] = fill(AT.scotch, '#b4b0a8');
    g.fillStyle = '#1c1c1c'; g.fillRect(x + 6, y + 6, w - 12, 5); g.fillRect(x + 6, y + h - 11, w - 12, 5);
    g.beginPath(); g.ellipse(x + w / 2, y + 36, 16, 18, 0, 0, 7); g.fill();
    g.fillRect(x + 40, y + 66, w - 80, 16);
    g.fillRect(x + 64, y + 92, w - 128, 4); g.fillRect(x + 80, y + 104, w - 160, 4);
  }
  {
    const [x, y, w, h] = fill(AT.rye, '#9c9890');
    g.fillStyle = '#202020'; g.fillRect(x + 30, y + 40, w - 60, 22); g.fillRect(x + 70, y + 76, w - 140, 5);
    g.strokeStyle = '#202020'; g.lineWidth = 3; g.strokeRect(x + 12, y + 12, w - 24, h - 24);
  }
  // the cigarette pack: white paper, a dark band, a round seal
  {
    const [x, y, w, h] = fill(AT.pack, '#c8c8c4');
    g.fillStyle = '#161616'; g.fillRect(x, y + h * 0.52, w, 26);
    g.beginPath(); g.arc(x + w / 2, y + h * 0.3, 22, 0, 7); g.fill();
    g.fillStyle = '#c8c8c4'; g.beginPath(); g.arc(x + w / 2, y + h * 0.3, 15, 0, 7); g.fill();
    g.fillStyle = '#161616'; g.fillRect(x + 24, y + h * 0.78, w - 48, 6);
  }
  // the matchbook's decal: a black cardinal (crest, beak, tail) and THE
  // CARDINAL in small capitals, on transparent
  {
    const [x, y, w, h] = px(AT.match);
    g.clearRect(x, y, w, h);
    g.fillStyle = '#050505';
    g.save();
    g.translate(x + w / 2, y + 78);
    g.beginPath();
    // body and tail
    g.moveTo(-30, 20); g.bezierCurveTo(-20, -8, 4, -18, 18, -14);
    g.lineTo(26, -30); g.lineTo(24, -12); // the crest
    g.lineTo(36, -8); g.lineTo(24, -2);   // the beak
    g.bezierCurveTo(26, 16, 10, 28, -8, 30);
    g.lineTo(-40, 44); g.lineTo(-34, 30); g.closePath();
    g.fill();
    g.restore();
    g.fillRect(x + 22, y + 124, w - 44, 3);
    text('THE', x + w / 2, y + 142, serif(15), '#050505');
    text('CARDINAL', x + w / 2, y + 162, serif(19), '#050505');
    // (make sure the decal's background is fully clear)
  }
  // the licence card: a pale card, a dark oval photograph, three short
  // lines, PRIVATE INVESTIGATOR
  {
    const [x, y, w, h] = fill(AT.licence, '#c4c2bc');
    g.strokeStyle = '#1a1a1a'; g.lineWidth = 3; g.strokeRect(x + 6, y + 6, w - 12, h - 12);
    text('PRIVATE INVESTIGATOR', x + w / 2, y + 26, serif(17), '#111');
    g.fillStyle = '#0c0c0c'; g.beginPath(); g.ellipse(x + 52, y + 92, 28, 36, 0, 0, 7); g.fill();
    g.fillStyle = '#222'; g.fillRect(x + 100, y + 66, 120, 7); g.fillRect(x + 100, y + 88, 96, 7); g.fillRect(x + 100, y + 110, 108, 7);
    stroke([[x + 110, y + 138], [x + 140, y + 130], [x + 160, y + 140], [x + 200, y + 132]], 3, '#111');
  }
  // the newspaper: a masthead, a headline in three heavy bars, grey columns
  {
    const [x, y, w, h] = fill(AT.news, '#aeaeaa');
    g.fillStyle = '#141414'; g.fillRect(x + 10, y + 10, w - 20, 26);
    g.fillRect(x + 10, y + 46, w - 20, 22); g.fillRect(x + 10, y + 74, w - 20, 22); g.fillRect(x + 10, y + 102, (w - 20) * 0.7, 22);
    g.fillStyle = '#6a6a66';
    for (let c = 0; c < 4; c++) for (let r = 0; r < 14; r++) g.fillRect(x + 12 + c * 60, y + 134 + r * 8, 52 - ((r * 7 + c * 3) % 5) * 4, 3);
  }
  // the menu board: four short lines, chalk-white on black
  {
    const [x, y, w, h] = fill(AT.menuBoard, '#0a0a0a');
    g.strokeStyle = '#8a8a8a'; g.lineWidth = 4; g.strokeRect(x + 8, y + 8, w - 16, h - 16);
    const rows = [['COFFEE', '5'], ['PIE', '10'], ['HASH', '25'], ['EGGS', '20']];
    rows.forEach(([a, b], i) => {
      const yy = y + 44 + i * 54;
      text(a, x + 40, yy, sans(40), '#e8e8e8', 'left');
      text(b, x + w - 40, yy, sans(40), '#e8e8e8', 'right');
      g.fillStyle = '#5a5a5a';
      for (let k = x + 200 + (i % 2) * 10; k < x + w - 110; k += 18) g.fillRect(k, yy + 6, 6, 4);
    });
  }
  // the clock's face: numerals round a pale dial, no hands (they are
  // geometry: they move)
  {
    const [x, y, w, h] = fill(AT.clock, '#000');
    const cx = x + w / 2, cy = y + h / 2;
    g.fillStyle = '#c2c2bc'; g.beginPath(); g.arc(cx, cy, 124, 0, 7); g.fill();
    g.strokeStyle = '#1a1a1a'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, 116, 0, 7); g.stroke();
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2, r0 = i % 5 ? 108 : 100;
      g.lineWidth = i % 5 ? 2 : 5;
      stroke([[cx + Math.sin(a) * r0, cy - Math.cos(a) * r0], [cx + Math.sin(a) * 114, cy - Math.cos(a) * 114]], i % 5 ? 2 : 5, '#1a1a1a');
    }
    for (let i = 1; i <= 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      text(String(i), cx + Math.sin(a) * 80, cy - Math.cos(a) * 80 + 2, serif(24), '#161616');
    }
  }
  // a menu card's cover: dark with a pale frame and one line
  {
    const [x, y, w, h] = fill(AT.menu, '#1a1a1a');
    g.strokeStyle = '#8a8a86'; g.lineWidth = 4; g.strokeRect(x + 14, y + 14, w - 28, h - 28);
    text('MENU', x + w / 2, y + h * 0.42, serif(40), '#9a9a96');
    g.fillStyle = '#8a8a86'; g.fillRect(x + 80, y + h * 0.58, w - 160, 4);
  }
  fill(AT.napkin, '#d0d0cc');
  {
    const [x, y, w, h] = fill(AT.ketchup, '#4a4a48');
    g.fillStyle = '#d0d0cc'; g.beginPath(); g.ellipse(x + w / 2, y + h / 2, 44, 30, 0, 0, 7); g.fill();
    g.fillStyle = '#1a1a1a'; g.fillRect(x + 34, y + h / 2 - 6, w - 68, 12);
  }
  {
    const [x, y, w, h] = fill(AT.milk, '#c8c8c4');
    g.fillStyle = '#1a1a1a'; g.fillRect(x + 20, y + 50, w - 40, 26);
  }
  {
    const [x, y, w, h] = fill(AT.headline, '#b0b0ac');
    g.fillStyle = '#121212'; g.fillRect(x + 8, y + 10, w - 16, 28); g.fillRect(x + 8, y + 46, w - 16, 28); g.fillRect(x + 8, y + 82, (w - 16) * 0.66, 28);
  }
  {
    const [x, y, w, h] = fill(AT.gin, '#c0c0bc');
    g.fillStyle = '#161616'; g.fillRect(x + 16, y + 40, w - 32, 18); g.fillRect(x + 30, y + 70, w - 60, 5);
  }
  {
    const [x, y, w, h] = fill(AT.sign, '#141414');
    text('REST ROOM', x + w / 2, y + h / 2, serif(38), '#b0b0aa');
  }
  // the record's label: a pale ring round a dark spindle, a dark band
  {
    const [x, y, w, h] = fill(AT.juke, '#000');
    const cx = x + w / 2, cy = y + h / 2;
    g.fillStyle = '#060606'; g.beginPath(); g.arc(cx, cy, 126, 0, 7); g.fill();
    g.strokeStyle = '#1c1c1c'; g.lineWidth = 1;
    for (let r = 60; r < 124; r += 5) { g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke(); }
    g.fillStyle = '#b8b8b2'; g.beginPath(); g.arc(cx, cy, 44, 0, 7); g.fill();
    g.fillStyle = '#1a1a1a'; g.fillRect(cx - 30, cy - 18, 60, 8); g.fillRect(cx - 22, cy + 12, 44, 5);
    g.beginPath(); g.arc(cx, cy, 5, 0, 7); g.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  ATLAS = { canvas: cv, tex };
  return ATLAS;
}

// ---- deterministic jitter for hand-placed marks (never Math.random) ----------
export function hash(i, s = 0) {
  const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

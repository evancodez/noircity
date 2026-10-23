import * as THREE from 'three';
import { lathe, tube, V3, merge } from '../../world/geom.js';
import { PAVE } from '../../world/plan.js';
import { KITS, lotWindows } from './facade.js';
import { PROPS_EXT } from './street.js';
import { accent } from '../../render/accents.js';
import { vhash, vpick } from '../../world/streets.js';

// NOIR CITY's dressing kit (lane O1b): what world/dressing.js placed, as
// geometry in world space with a grey level each (a vertex colour: one
// material, one draw a chunk for all of it - parts/dressing.js merges):
//   propPieces(rec)          a pavement thing (crates, barrels, churns, a mailbox,
//                            a phone booth, a fruit stand, flowers, a sandwich
//                            board, a bicycle, dustbins, a rain barrel, oil
//                            drums, a handcart): [[geo, level]] (its variant by rec.v)
//   treePieces(t)            a street tree by its kind (plane, bare, poplar, elm)
//   faceRelief(lot, out)     a lot's street faces by their character: the window
//                            heads (lintel, hood, arch), iron pilasters, stone
//                            quoins, a tile ground floor; the awnings in the
//                            street's canvas; the trade boards (atlas cells); and
//                            in a lit shop window what its trade has behind the glass
// out: { relief: [[geo, level]], board: [geo with uv], lit: [[geo, level]] }
// Levels are linear greys (or a registry colour: accents.js, so the tone
// measure counts every accent).
export const G = {
  ink: 0.005, iron: 0.008, wood: 0.03, woodP: 0.06, barrel: 0.02, tin: 0.09, paper: 0.22,
  canvasP: 0.2, canvasD: 0.012, trim: 0.07, tile: 0.16, leaf: 0.006, bark: 0.01, fruit: 0.12, glass: 0.0,
};
export const RED = accent('paintRed').toArray();
export const NEON_RED = accent('neonRed').toArray();
export const AMBER = accent('neonAmber').toArray();

const box = (sx, sy, sz) => new THREE.BoxGeometry(sx, sy, sz);
const at = (g, x, y, z) => g.translate(x, y, z);
const cyl = (r0, r1, h, n = 10) => new THREE.CylinderGeometry(r0, r1, h, n);

// ---- the pavement things (local: the base's middle at the origin, +x along the wall, +z out of it) ----
const PIECES = {
  crates(v) {
    const P = [], n = 1 + Math.floor(v * 3);
    for (let i = 0; i < n; i++) {
      const s = 0.5 + ((v * 7 + i * 0.37) % 1) * 0.18, x = (i % 2 ? 0.3 : -0.25) * (n > 1 ? 1 : 0), y = i > 1 ? 0.55 : 0, r = (v * 13 + i) % 0.4 - 0.2;
      const g = box(s * 1.1, s * 0.8, s * 0.8).rotateY(r).translate(x, y + s * 0.4, 0);
      P.push([g, i % 2 ? G.woodP : G.wood]);
      P.push([box(s * 1.12, 0.05, s * 0.82).rotateY(r).translate(x, y + s * 0.62, 0), G.ink]);
    }
    return P;
  },
  barrel(v) { return barrelAt(0, 0, v, v > 0.7); },
  barrels(v) {
    const P = [], n = 2 + Math.floor(v * 3);
    const spots = [[-0.32, -0.05], [0.32, 0.02], [0, 0.42], [-0.62, 0.4], [0.62, 0.42]];
    for (let i = 0; i < n; i++) P.push(...barrelAt(spots[i][0], spots[i][1], (v * 11 + i * 0.3) % 1, i === 4));
    return P;
  },
  churns(v) {
    const P = [], n = 1 + Math.floor(v * 2.5);
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * 0.36;
      P.push([lathe([[0, 0], [0.17, 0], [0.17, 0.45], [0.12, 0.55], [0.08, 0.62], [0.09, 0.68], [0.1, 0.7], [0, 0.72]], 12).translate(x, 0, 0), G.tin]);
      P.push([new THREE.TorusGeometry(0.06, 0.012, 4, 8).translate(x + 0.15, 0.6, 0).rotateY(0), G.iron]);
    }
    return P;
  },
  mailbox(v) {
    return [
      [cyl(0.05, 0.06, 0.55, 8).translate(0, 0.27, 0), G.iron],
      [box(0.42, 0.5, 0.4).translate(0, 0.8, 0), G.iron],
      [lathe([[0, 0], [0.21, 0], [0.21, 0.01]], 12, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).scale(1, 1, 0.95).translate(0, 1.05, 0), G.iron],
      [box(0.26, 0.04, 0.02).translate(0, 0.98, 0.21), G.paper * (v > 0.5 ? 1 : 0.6)],
    ];
  },
  booth(v) {
    const P = [];
    for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) P.push([box(0.07, 2.25, 0.07).translate(x * 0.5, 1.12, z * 0.5), G.iron]);
    P.push([box(1.1, 0.12, 1.1).translate(0, 2.3, 0), G.iron]);
    P.push([new THREE.ConeGeometry(0.62, 0.3, 4).rotateY(Math.PI / 4).translate(0, 2.51, 0), G.iron]);
    P.push([box(1.02, 0.18, 1.02).translate(0, 2.12, 0), G.paper]);     // (its lettered band: TELEPHONE)
    P.push([box(1.0, 0.9, 1.0).translate(0, 0.45, 0), G.iron]);
    P.push([box(0.04, 1.1, 0.96).translate(-0.48, 1.45, 0), G.glass]);
    P.push([box(0.96, 1.1, 0.04).translate(0, 1.45, -0.48), G.glass]);
    P.push([box(0.25, 0.4, 0.15).translate(0.2, 1.4, -0.38), G.ink]);   // (the telephone inside)
    void v;
    return P;
  },
  fruit(v) {
    const P = [[box(2.2, 0.08, 0.8).rotateX(-0.25).translate(0, 0.85, 0.02), G.wood]];
    for (const x of [-1.05, 1.05]) for (const z of [-0.3, 0.3]) P.push([box(0.06, 0.85, 0.06).translate(x, 0.42, z), G.wood]);
    // the crates of fruit raked toward the street, a heap in each (small lumps: apples, oranges, a dark one of plums)
    for (let r = 0; r < 2; r++) for (let k = 0; k < 4; k++) {
      const cx = -0.8 + k * 0.53, cz = -0.16 + r * 0.32, cy = 0.9 - r * 0.08;
      P.push([box(0.48, 0.14, 0.3).translate(cx, cy, cz), G.wood]);
      const lev = (k + r + Math.floor(v * 3)) % 3 === 0 ? G.fruit * 0.25 : (k + r) % 2 ? G.fruit * 0.55 : G.fruit * 0.4;
      for (let q = 0; q < 5; q++) P.push([new THREE.IcosahedronGeometry(0.055, 0).translate(cx - 0.16 + (q % 3) * 0.16, cy + 0.1 + (q > 2 ? 0.05 : 0), cz - 0.06 + (q > 2 ? 0.05 : (q % 2) * 0.1)), lev]);
    }
    // its awning on two poles
    for (const x of [-1.1, 1.1]) P.push([box(0.04, 1.2, 0.04).translate(x, 1.4, 0.38), G.wood]);
    P.push([box(2.4, 0.04, 1.0).rotateX(0.28).translate(0, 2.0, 0.1), v > 0.5 ? G.canvasP : G.canvasD]);
    return P;
  },
  flowers(v) {
    const P = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + v, x = Math.cos(a) * 0.28, z = Math.sin(a) * 0.22;
      P.push([cyl(0.13, 0.1, 0.36, 10).translate(x, 0.18, z), G.tin]);
      P.push([new THREE.IcosahedronGeometry(0.17 + ((v * 5 + i) % 1) * 0.06, 1).scale(1, 0.8, 1).translate(x, 0.5, z), i % 2 ? G.paper * 0.7 : G.fruit]);
    }
    return P;
  },
  board(v) {
    // a sandwich board (an A): two leaves, their lettering a pale field
    const P = [];
    for (const s of [-1, 1]) {
      P.push([box(0.62, 0.92, 0.03).rotateX(s * 0.2).translate(0, 0.46, s * 0.1), G.wood]);
      P.push([box(0.5, 0.6, 0.005).rotateX(s * 0.2).translate(0, 0.5, s * (0.1 + 0.02)), G.paper * (v > 0.5 ? 1 : 0.7)]);
    }
    return P;
  },
  bike(v) {
    // a bicycle leaning on the wall (local -z): two wheels, the frame, the bars
    const P = [];
    const tilt = 0.18;
    for (const x of [-0.52, 0.52]) P.push([new THREE.TorusGeometry(0.33, 0.018, 4, 18).translate(x, 0.34, 0), G.ink]);
    P.push([tube([V3(-0.52, 0.34, 0), V3(-0.12, 0.62, 0), V3(0.36, 0.64, 0), V3(0.52, 0.34, 0)], 0.022, 4, 10), G.ink]);
    P.push([tube([V3(-0.12, 0.62, 0), V3(0.02, 0.34, 0), V3(0.52, 0.34, 0)], 0.02, 4, 8), G.ink]);
    P.push([box(0.22, 0.05, 0.08).translate(-0.16, 0.8, 0), G.ink]);
    P.push([box(0.05, 0.05, 0.46).translate(0.42, 0.88, 0), G.ink]);
    if (v > 0.6) P.push([box(0.32, 0.2, 0.26).translate(0.62, 0.72, 0), G.wood]);   // (a basket)
    for (const p of P) p[0].rotateX(-tilt);
    return P;
  },
  bins(v) {
    const P = [], n = 2 + (v > 0.6 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * 0.56, dent = (v * 7 + i) % 1;
      P.push([lathe([[0, 0], [0.24, 0], [0.26, 0.8], [0.28, 0.82], [0, 0.82]], 12).translate(x, 0, 0), G.tin * 0.6]);
      P.push([lathe([[0, 0.12], [0.18, 0.08], [0.29, 0.0], [0.29, -0.02], [0, -0.02]], 12).rotateZ(dent > 0.7 ? 0.5 : 0).translate(x + (dent > 0.7 ? 0.1 : 0), 0.84, 0), G.tin * 0.8]);
    }
    return P;
  },
  rainbarrel(v) {
    return [
      [lathe([[0, 0], [0.33, 0], [0.36, 0.45], [0.33, 0.9], [0, 0.9]], 14), G.barrel],
      [cyl(0.37, 0.37, 0.04, 14).translate(0, 0.2, 0), G.iron], [cyl(0.37, 0.37, 0.04, 14).translate(0, 0.7, 0), G.iron],
      [box(0.08, 3 + v * 2, 0.08).translate(0.2, 2.3 + v, -0.22), G.iron],      // (the downpipe into it)
    ];
  },
  drums(v) {
    const P = [], n = 2 + Math.floor(v * 3);
    const spots = [[-0.3, 0], [0.3, 0.05], [0, 0.48], [-0.6, 0.5], [0.6, 0.5]];
    for (let i = 0; i < n; i++) {
      const [x, z] = spots[i];
      if (i === 4 && v > 0.8) { P.push([cyl(0.29, 0.29, 0.88, 12).rotateZ(Math.PI / 2).translate(x, 0.29, z), G.tin * 0.5]); continue; }
      P.push([cyl(0.29, 0.29, 0.88, 12).translate(x, 0.44, z), (i + Math.floor(v * 4)) % 2 ? G.tin * 0.5 : G.iron]);
      for (const y of [0.3, 0.6]) P.push([cyl(0.3, 0.3, 0.03, 12).translate(x, y, z), G.iron]);
    }
    return P;
  },
  cart(v) {
    // a two-wheeled handcart, its shafts on the ground, a load now and then
    const P = [[box(1.6, 0.08, 0.95).translate(0, 0.62, 0), G.wood]];
    for (const z of [-0.47, 0.47]) P.push([box(1.6, 0.25, 0.04).translate(0, 0.78, z), G.wood]);
    for (const z of [-0.56, 0.56]) P.push([new THREE.TorusGeometry(0.42, 0.04, 5, 16).translate(0.1, 0.42, z), G.ink]);
    for (const z of [-0.35, 0.35]) P.push([box(1.1, 0.05, 0.05).rotateZ(0.42).translate(-1.15, 0.38, z), G.wood]);
    if (v > 0.4) P.push([box(1.2, 0.4, 0.75).translate(0.1, 0.9, 0), v > 0.7 ? G.paper * 0.5 : G.woodP]);
    return P;
  },
};
function barrelAt(x, z, v, lying) {
  const g = lathe([[0, 0], [0.27, 0], [0.31, 0.2], [0.33, 0.42], [0.31, 0.64], [0.27, 0.84], [0, 0.84]], 14);
  const hoops = [0.12, 0.72].map((y) => cyl(0.315, 0.315, 0.04, 14).translate(0, y, 0));
  const P = [[g, G.barrel], ...hoops.map((h) => [h, G.iron])];
  for (const p of P) { if (lying) p[0].translate(0, -0.42, 0).rotateZ(Math.PI / 2).translate(0, 0.33, 0); p[0].rotateY(v * 3).translate(x, 0, z); }
  return P;
}
// (the whole shape of each, uncoloured: lane O6's pools draw one that goes over)
for (const k of Object.keys(PIECES)) PROPS_EXT[k] = () => merge(PIECES[k](0).map(([g]) => g.clone()));

// a placed thing: its pieces in the world (the record's yaw turns +x along the wall)
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _y = new THREE.Vector3(0, 1, 0), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3();
export function propPieces(rec, y0 = PAVE) {
  const P = (PIECES[rec.kind] || PIECES.crates)(rec.v || 0);
  // (the face's out (rec.face) is the thing's local +z; else its yaw alone)
  const yaw = rec.face ? Math.atan2(rec.face[0], rec.face[1]) : rec.yaw;
  _q.setFromAxisAngle(_y, yaw + (rec.kind === 'board' ? Math.PI / 2 : 0));
  _m.compose(_p.set(rec.x, y0, rec.z), _q, _s);
  for (const p of P) p[0].applyMatrix4(_m);
  return P;
}

// ---- the trees: a shape each (city/kits/trees.js) ----------------------------------------------
export { treePieces } from './trees.js';

// ---- the trade boards' atlas (one canvas for the city: each trade in each lettering, the names) ----
export const TRADES = {
  tailor: 'TAILOR', jeweler: 'JEWELER', shoes: 'SHOES', hats: 'HATS', radio: 'RADIO', books: 'BOOKS', cafe: 'CAFE', drugs: 'DRUGS',
  grocer: 'GROCERY', butcher: 'MEATS', barber: 'BARBER', laundry: 'LAUNDRY', deli: 'DELICATESSEN', pawn: 'LOANS', chopsuey: 'CHOP SUEY',
  chandler: 'SHIP CHANDLER', hardware: 'HARDWARE', florist: 'FLOWERS', tobacco: 'TOBACCO', cigars: 'CIGARS',
};
const NAMES = ['KLEIN', 'ROSEN', 'O\'MALLEY', 'BRUNO', 'FINE', 'LEVY', 'COHEN', 'MORELLI', 'NOLAN', 'WEISS', 'CASSIDY', 'LIPPMAN', 'ESPOSITO', 'MURPHY', 'GOLD', 'KAPLAN'];
// (every colour a neutral grey: the ink keeps any chroma over a quarter as colour - a warm gilt printed orange)
const STYLES = {
  deco: { font: (px) => `700 ${px}px "Futura", "Avenir Next Condensed", sans-serif`, bg: '#0b0b0b', fg: '#e4e4e4', rim: '#6a6a6a', track: 0.12 },
  serif: { font: (px) => `700 ${px}px "Didot", "Georgia", "Times New Roman", serif`, bg: '#141414', fg: '#cdcdcd', rim: '#868686', track: 0.06 },
  script: { font: (px) => `italic 700 ${px * 1.05}px "Snell Roundhand", "Brush Script MT", "Apple Chancery", cursive`, bg: '#090909', fg: '#efefef', rim: '#3a3a3a', track: 0, script: true },
  block: { font: (px) => `900 ${px}px "Impact", "Arial Black", sans-serif`, bg: '#b6b6b6', fg: '#101010', rim: '#2a2a2a', track: 0.04 },
  stencil: { font: (px) => `700 ${px}px "Stencil", "Copperplate", "Courier New", monospace`, bg: '#393939', fg: '#0d0d0d', rim: '#1a1a1a', track: 0.1 },
};
export const LETTERS = Object.keys(STYLES);
let ATLAS = null;
export function boardAtlas() {
  if (ATLAS) return ATLAS;
  const W = 2048, CW = 400, CH = 60, cols = 5;
  const cells = [];
  for (const st of LETTERS) { for (const t of Object.keys(TRADES)) cells.push({ st, key: 't:' + t, text: TRADES[t] }); for (const n of NAMES) cells.push({ st, key: 'n:' + n, text: n }); }
  const rows = Math.ceil(cells.length / cols);
  const c = document.createElement('canvas'); c.width = W; c.height = 2048;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, W, c.height);
  const uv = new Map();
  cells.forEach((cell, i) => {
    const x = (i % cols) * (CW + 8) + 4, y = Math.floor(i / cols) * (CH + 4) + 2;
    const S = STYLES[cell.st];
    g.fillStyle = S.bg; g.fillRect(x, y, CW, CH);
    g.strokeStyle = S.rim; g.lineWidth = 3; g.strokeRect(x + 4, y + 4, CW - 8, CH - 8);
    let text = cell.text;
    if (S.script) text = text.split(' ').map((w) => (w[0] + w.slice(1).toLowerCase())).join(' ');
    let px = 40;
    g.font = S.font(px);
    const room = CW * 0.86;
    const w0 = g.measureText(text).width + text.length * px * S.track;
    if (w0 > room) { px = Math.floor(px * room / w0); g.font = S.font(px); }
    g.fillStyle = S.fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (S.track && 'letterSpacing' in g) g.letterSpacing = `${(px * S.track).toFixed(1)}px`;
    g.fillText(text, x + CW / 2, y + CH / 2 + 2);
    if ('letterSpacing' in g) g.letterSpacing = '0px';
    uv.set(cell.st + '|' + cell.key, [x / W, 1 - (y + CH) / c.height, (x + CW) / W, 1 - y / c.height]);
  });
  void rows;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  ATLAS = { tex, uv, canvas: c };
  return ATLAS;
}
// a board's face (a plane with the cell's uvs) at a wall: centre (x, y, z), normal (nx, nz), w x h
function boardFace(uvr, x, y, z, nx, nz, w, h) {
  const p = new THREE.PlaneGeometry(w, h);
  const U = p.getAttribute('uv');
  for (let i = 0; i < U.count; i++) U.setXY(i, U.getX(i) ? uvr[2] : uvr[0], U.getY(i) ? uvr[3] : uvr[1]);
  return p.rotateY(Math.atan2(nx, nz)).translate(x, y, z);
}

// ---- what is behind a lit shop window, by its trade (local: x across the
// window, y up from its middle, z out of the wall; the window w x h) -------------------------------
const DISPLAY = {
  tailor(w, h, v) {
    const P = [], n = w > 2.4 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const x = (n === 1 ? 0 : (i ? 0.45 : -0.45)) * w * 0.5;
      P.push([lathe([[0.02, 0], [0.2, 0.05], [0.24, 0.3], [0.17, 0.55], [0.22, 0.85], [0.26, 1.0], [0.14, 1.08], [0.05, 1.12], [0.02, 1.12]], 10).translate(x, -h / 2 + 0.95, 0), G.ink]);
      P.push([cyl(0.02, 0.02, 0.95, 4).translate(x, -h / 2 + 0.48, 0), G.ink]);
      P.push([cyl(0.18, 0.18, 0.03, 8).translate(x, -h / 2 + 0.02, 0), G.ink]);
    }
    if (v > 0.5) P.push([box(0.5, 0.04, 0.3).translate(w * 0.3, -h / 2 + 0.6, 0), G.ink]);
    return P;
  },
  jeweler(w, h) {
    const P = [[box(w * 0.8, 0.5, 0.3).translate(0, -h / 2 + 0.25, 0), G.ink]];
    P.push([cyl(0.22, 0.22, 0.05, 16).rotateX(Math.PI / 2).translate(-w * 0.2, 0.25, 0.05), G.ink]);
    P.push([cyl(0.18, 0.18, 0.02, 14).rotateX(Math.PI / 2).translate(-w * 0.2, 0.25, 0.08), G.tin]);
    P.push([box(0.04, 0.6, 0.04).translate(-w * 0.2, -0.25, 0.04), G.ink]);
    for (const x of [0.1, 0.3]) P.push([box(0.18, 0.04, 0.12).translate(x * w, -h / 2 + 0.75, 0), G.ink]);
    return P;
  },
  shoes(w, h, v) {
    const P = [];
    for (let r = 0; r < 3; r++) {
      const y = -h / 2 + 0.35 + r * 0.55;
      P.push([box(w * 0.85, 0.03, 0.25).translate(0, y, 0), G.ink]);
      for (let k = 0; k < 4; k++) if ((k + r + Math.floor(v * 4)) % 5) P.push([box(0.24, 0.1, 0.1).translate(-w * 0.32 + k * w * 0.21, y + 0.06, 0), G.ink]);
    }
    return P;
  },
  hats(w, h) {
    const P = [];
    for (let k = 0; k < 3; k++) {
      const x = (k - 1) * w * 0.28, y = -h / 2 + 0.7 + (k % 2) * 0.35;
      P.push([cyl(0.015, 0.015, y + h / 2, 4).translate(x, (y - h / 2) / 2, 0), G.ink]);
      P.push([lathe([[0.02, 0.2], [0.13, 0.19], [0.15, 0.08], [0.16, 0.03], [0.27, 0.02], [0.28, 0], [0.02, 0]], 12).translate(x, y, 0), G.ink]);
    }
    return P;
  },
  radio(w, h, v) {
    const P = [[box(w * 0.7, 0.05, 0.4).translate(0, -h / 2 + 0.55, 0), G.ink]];
    const x = (v - 0.5) * w * 0.3;
    P.push([box(0.5, 0.6, 0.3).translate(x, -h / 2 + 0.88, 0), G.ink]);
    P.push([new THREE.CylinderGeometry(0.25, 0.25, 0.3, 14, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2).translate(x, -h / 2 + 1.18, 0), G.ink]);
    P.push([box(0.3, 0.2, 0.02).translate(x, -h / 2 + 0.95, 0.16), G.tin]);
    return P;
  },
  books(w, h, v) {
    const P = [];
    for (let r = 0; r < 4; r++) {
      const y = -h / 2 + 0.2 + r * 0.55;
      if (y > h / 2 - 0.2) break;
      P.push([box(w * 0.92, 0.03, 0.2).translate(0, y, 0), G.ink]);
      let x = -w * 0.44;
      for (let k = 0; x < w * 0.44; k++) {
        const t = 0.05 + ((v * 17 + k * 0.29 + r * 0.13) % 1) * 0.05, bh = 0.3 + ((k * 0.37 + r * 0.21 + v) % 1) * 0.15;
        if ((k * 7 + r) % 9) P.push([box(t, bh, 0.16).translate(x + t / 2, y + bh / 2 + 0.02, 0), G.ink]);
        x += t + 0.008;
      }
    }
    return P;
  },
  cafe(w, h) {
    const P = [[box(w * 0.8, 0.9, 0.3).translate(0, -h / 2 + 0.45, -0.1), G.ink]];
    for (let k = 0; k < 3; k++) { const x = (k - 1) * w * 0.25; P.push([cyl(0.15, 0.15, 0.05, 10).translate(x, -h / 2 + 0.75, 0.25), G.ink]); P.push([cyl(0.03, 0.03, 0.72, 4).translate(x, -h / 2 + 0.38, 0.25), G.ink]); }
    P.push([lathe([[0.01, 0], [0.18, 0], [0.2, 0.4], [0.12, 0.55], [0.03, 0.6]], 10).translate(w * 0.28, -h / 2 + 0.9, -0.1), G.tin]);
    return P;
  },
  drugs(w, h) {
    const P = [];
    for (const [x, s] of [[-0.25, 1], [0.25, 0.85]]) P.push([lathe([[0.01, 0], [0.2, 0.02], [0.24, 0.3], [0.16, 0.5], [0.06, 0.62], [0.07, 0.72], [0.01, 0.74]], 12).scale(s, s, s).translate(x * w, -h / 2 + 0.6, 0), G.ink]);
    P.push([box(w * 0.85, 0.04, 0.2).translate(0, -h / 2 + 0.58, 0), G.ink]);
    return P;
  },
  grocer(w, h) {
    const P = [];
    for (let r = 0; r < 3; r++) {
      const y = -h / 2 + 0.4 + r * 0.6;
      P.push([box(w * 0.9, 0.03, 0.22).translate(0, y, 0), G.ink]);
      for (let k = 0; k < 7; k++) P.push([cyl(0.06, 0.06, 0.16, 6).translate(-w * 0.4 + k * w * 0.13, y + 0.1, 0), G.ink]);
    }
    return P;
  },
  butcher(w, h, v) {
    const P = [[box(w * 0.85, 0.04, 0.04).translate(0, h / 2 - 0.25, 0), G.ink]];
    const n = 3 + Math.floor(v * 2);
    for (let k = 0; k < n; k++) {
      const x = -w * 0.35 + k * (w * 0.7 / (n - 1));
      P.push([cyl(0.01, 0.01, 0.2, 3).translate(x, h / 2 - 0.36, 0), G.ink]);
      P.push([new THREE.IcosahedronGeometry(0.17, 1).scale(0.85, 2.0 + (k % 2) * 0.6, 0.6).translate(x, h / 2 - 0.85 - (k % 2) * 0.15, 0), G.ink]);
    }
    P.push([box(w * 0.85, 0.75, 0.3).translate(0, -h / 2 + 0.38, 0), G.ink]);
    return P;
  },
  barber(w, h) {
    // the chair: its seat, its back, its footrest, the mirror's frame behind
    const P = [];
    P.push([box(0.55, 0.12, 0.5).translate(0, -h / 2 + 0.6, 0), G.ink]);
    P.push([box(0.55, 0.7, 0.1).rotateX(-0.2).translate(0, -h / 2 + 1.0, -0.2), G.ink]);
    P.push([cyl(0.06, 0.12, 0.5, 8).translate(0, -h / 2 + 0.28, 0), G.ink]);
    P.push([box(0.4, 0.05, 0.2).translate(0, -h / 2 + 0.2, 0.35), G.ink]);
    for (const x of [-0.32, 0.32]) P.push([box(0.08, 0.06, 0.45).translate(x, -h / 2 + 0.78, 0), G.ink]);
    return P;
  },
  laundry(w, h, v) {
    const P = [[box(w * 0.9, 0.02, 0.02).translate(0, h / 2 - 0.2, 0), G.ink]];
    const n = 3 + Math.floor(v * 2);
    for (let k = 0; k < n; k++) {
      const x = -w * 0.38 + k * (w * 0.76 / (n - 1));
      const s = new THREE.Shape();
      s.moveTo(-0.22, 0); s.lineTo(-0.3, -0.12); s.lineTo(-0.2, -0.2); s.lineTo(-0.18, -0.75); s.lineTo(0.18, -0.75); s.lineTo(0.2, -0.2); s.lineTo(0.3, -0.12); s.lineTo(0.22, 0); s.lineTo(0, -0.08); s.lineTo(-0.22, 0);
      P.push([new THREE.ShapeGeometry(s).translate(x, h / 2 - 0.22, 0), G.ink]);
    }
    return P;
  },
  deli(w, h, v) {
    const P = [[box(w * 0.85, 0.03, 0.03).translate(0, h / 2 - 0.25, 0), G.ink]];
    for (let k = 0; k < 6; k++) {
      const x = -w * 0.38 + k * w * 0.15, L = 0.45 + ((k * 0.31 + v) % 1) * 0.4;
      P.push([cyl(0.05 + (k % 2) * 0.02, 0.05, L, 6).translate(x, h / 2 - 0.3 - L / 2, 0), G.ink]);
    }
    P.push([box(w * 0.85, 0.7, 0.3).translate(0, -h / 2 + 0.35, 0), G.ink]);
    return P;
  },
  pawn(w, h, v) {
    const P = [[box(w * 0.85, 0.03, 0.22).translate(0, -h / 2 + 0.5, 0), G.ink], [box(w * 0.85, 0.03, 0.22).translate(0, -h / 2 + 1.2, 0), G.ink]];
    // a trumpet's bell and tube, a clock, a fiddle
    P.push([lathe([[0.01, 0], [0.03, 0.3], [0.08, 0.42], [0.16, 0.48]], 10).rotateZ(Math.PI / 2).translate(-w * 0.25, -h / 2 + 0.62, 0), G.ink]);
    P.push([cyl(0.15, 0.15, 0.05, 12).rotateX(Math.PI / 2).translate(w * 0.05, -h / 2 + 1.38, 0), G.ink]);
    P.push([new THREE.IcosahedronGeometry(0.16, 1).scale(0.7, 1.4, 0.3).translate(w * 0.28, -h / 2 + 0.78 + v * 0.1, 0), G.ink]);
    return P;
  },
  chopsuey(w, h) {
    // the roast ducks on their hooks, two paper lanterns (the registry's red)
    const P = [[box(w * 0.85, 0.03, 0.03).translate(0, h / 2 - 0.3, 0), G.ink]];
    for (let k = 0; k < 4; k++) P.push([new THREE.IcosahedronGeometry(0.13, 1).scale(0.9, 1.8, 0.7).translate(-w * 0.3 + k * w * 0.2, h / 2 - 0.62, 0), G.ink]);
    for (const x of [-0.36, 0.36]) P.push([new THREE.SphereGeometry(0.14, 10, 8).scale(1, 1.15, 1).translate(x * w, h / 2 - 0.2, 0.05), NEON_RED]);
    return P;
  },
  chandler(w, h) {
    const P = [];
    for (let k = 0; k < 3; k++) P.push([new THREE.TorusGeometry(0.18 - k * 0.02, 0.04, 5, 12).rotateX(Math.PI / 2).translate(-w * 0.25, -h / 2 + 0.06 + k * 0.08, 0), G.ink]);
    P.push([lathe([[0.01, 0], [0.12, 0], [0.13, 0.3], [0.1, 0.35], [0.03, 0.42]], 8).translate(w * 0.2, -h / 2 + 0.55, 0), G.ink]);
    P.push([box(0.06, 0.8, 0.04).translate(w * 0.05, -h / 2 + 0.6, 0), G.ink]);
    P.push([new THREE.TorusGeometry(0.22, 0.04, 4, 10, Math.PI).rotateZ(Math.PI).translate(w * 0.05, -h / 2 + 0.3, 0), G.ink]);
    return P;
  },
  hardware(w, h, v) {
    const P = [[box(w * 0.85, 0.03, 0.03).translate(0, h / 2 - 0.25, 0), G.ink]];
    for (let k = 0; k < 4; k++) {
      const x = -w * 0.33 + k * w * 0.22;
      if ((k + Math.floor(v * 3)) % 2) P.push([lathe([[0.01, 0], [0.12, 0], [0.15, 0.25], [0.01, 0.25]], 8).translate(x, h / 2 - 0.65, 0), G.ink]);
      else P.push([box(0.04, 0.5, 0.18).translate(x, h / 2 - 0.55, 0), G.ink]);
    }
    for (let r = 0; r < 5; r++) P.push([box(0.5, 0.03, 0.04).translate(w * 0.3, -h / 2 + 0.2 + r * 0.3, 0), G.ink]);
    return P;
  },
  florist(w, h) {
    const P = [];
    for (let k = 0; k < 4; k++) {
      const x = -w * 0.35 + k * w * 0.23;
      P.push([cyl(0.1, 0.08, 0.3, 8).translate(x, -h / 2 + 0.15, 0), G.ink]);
      P.push([new THREE.IcosahedronGeometry(0.2, 1).translate(x, -h / 2 + 0.45, 0), G.ink]);
    }
    return P;
  },
  tobacco(w, h) {
    const P = [[box(w * 0.85, 0.03, 0.22).translate(0, -h / 2 + 0.6, 0), G.ink]];
    for (let k = 0; k < 5; k++) P.push([box(0.3, 0.08, 0.2).translate(-w * 0.3 + (k % 3) * 0.32, -h / 2 + 0.66 + Math.floor(k / 3) * 0.09, 0), G.ink]);
    P.push([lathe([[0.01, 0], [0.12, 0], [0.13, 0.35], [0.1, 0.4], [0.01, 0.42]], 10).translate(w * 0.3, -h / 2 + 0.62, 0), G.ink]);
    return P;
  },
};
DISPLAY.cigars = DISPLAY.tobacco;

// ---- a lot's street faces by their character ------------------------------------------------------
const kitOfLot = (L) => KITS[L.district === 'hill' ? 'hill' : L.district === 'docks' ? 'docks' : L.district === 'yards' ? 'yards' : L.district === 'tenements' ? 'tenement' : 'downtown'];
const _o = new THREE.Vector3();
// a local piece onto a face: x along, y up, z out
const onFace = (g, f, u, y) => {
  const ux = (f.b[0] - f.a[0]) / f.len, uz = (f.b[1] - f.a[1]) / f.len;
  return g.rotateY(Math.atan2(f.n[0], f.n[1])).translate(f.a[0] + ux * u, y, f.a[1] + uz * u);
};
const onWin = (g, w, dz = 0) => g.rotateY(Math.atan2(w.nx, w.nz)).translate(w.x + w.nx * dz, w.y, w.z + w.nz * dz);

export function faceRelief(L, out) {
  if (!L.fc || !L.fc.length) return;
  const K = kitOfLot(L);
  const W = lotWindows(L);
  const rel = out.relief, brd = out.board, lit = out.lit;
  for (const f of L.fc) {
    const ch = f.ch;
    const mine = W.filter((w) => Math.abs(w.nx - f.n[0]) < 0.01 && Math.abs(w.nz - f.n[1]) < 0.01);
    const top = L.kind === 'rect' && L.tower ? L.h * 0.42 : L.h;
    // the window heads (the upper windows): by the street's
    if (ch.win !== 'plain') for (const w of mine) {
      if (w.kind !== 'win' || w.y > top) continue;
      const yy = w.h / 2 + 0.1;
      if (ch.win === 'lintel') rel.push([onWin(new THREE.PlaneGeometry(w.w + 0.22, 0.18).translate(0, yy, 0), w, 0.05), G.trim]);
      else if (ch.win === 'hood') rel.push([onWin(box(w.w + 0.36, 0.13, 0.14).translate(0, yy + 0.04, 0.07), w), G.trim]);
      else if (ch.win === 'arch') rel.push([onWin(new THREE.RingGeometry(w.w / 2 + 0.02, w.w / 2 + 0.16, 6, 1, 0, Math.PI).scale(1, 0.55, 1).translate(0, w.h / 2 - 0.02, 0), w, 0.05), G.trim]);
    }
    // the material's own strokes on the face
    const H = Math.min(top, 40);
    if (ch.mat === 'iron') {
      // cast-iron fronts: a pilaster at every window column, up the face
      const cols = [...new Set(mine.filter((w) => w.kind === 'win').map((w) => Math.round(((w.x - f.a[0]) * (f.b[0] - f.a[0]) + (w.z - f.a[1]) * (f.b[1] - f.a[1])) / f.len * 10) / 10))].sort((a, b) => a - b);
      for (let i = 0; i + 1 < cols.length; i++) rel.push([onFace(box(0.2, H - 0.3, 0.12).translate(0, (H - 0.3) / 2, 0.06), f, (cols[i] + cols[i + 1]) / 2, 0), G.trim * 0.6]);
    } else if ((ch.mat === 'stone' || ch.mat === 'pale') && L.kind === 'rect') {
      // quoins at the face's corners (an end where the lot turns onto another street): blocks long and short up the corner
      const F = L.faces || {};
      const ends = f.n[1] < -0.5 ? [F.e, F.w] : f.n[1] > 0.5 ? [F.w, F.e] : f.n[0] < -0.5 ? [F.n, F.s] : [F.s, F.n];
      for (const [u, on] of [[0.32, ends[0]], [f.len - 0.32, ends[1]]]) if (on) for (let y = 0.4, k = 0; y < H - 0.6; y += 0.62, k++) rel.push([onFace(new THREE.PlaneGeometry(k % 2 ? 0.55 : 0.95, 0.54).translate(u < 1 ? (k % 2 ? 0.27 - 0.32 : 0.47 - 0.32) : (k % 2 ? -0.27 + 0.32 : -0.47 + 0.32), y + 0.27, 0.035), f, u, 0), ch.mat === 'pale' ? G.trim * 1.2 : G.trim * 0.75]);
    } else if (ch.mat === 'tile') {
      // a glazed ground floor: a pale field under the course
      rel.push([onFace(new THREE.PlaneGeometry(f.len, K.ground - 0.45).translate(f.len / 2, (K.ground - 0.45) / 2, 0.02), f, 0, 0), G.tile]);
    }
    // the doors (the cold play's finding 8: one door everywhere): a leaf of its
    // own by the hash of where it stands - panelled, glazed (lit now and then),
    // double, a warehouse's planks - its paint dark, mid or pale, a lit
    // transom over some, a number plate beside many
    const works = L.district === 'docks' || L.district === 'yards';
    for (const w of mine) {
      if (w.kind !== 'door') continue;
      const h = vhash(w.x, w.z, 21), h2 = vhash(w.x, w.z, 22), h3 = vhash(w.x, w.z, 23);
      const paint = h2 < 0.4 ? G.ink * 1.5 : h2 < 0.8 ? G.wood : G.woodP * 1.4;
      const ww = w.w - 0.06, hh = w.h - 0.04, z0 = 0.03;
      const kind = works && h < 0.5 ? 'planks' : h < 0.5 ? 'panel' : h < 0.78 ? 'glazed' : h < 0.9 ? 'double' : 'panel';
      rel.push([onWin(box(ww, hh, 0.04).translate(0, 0, z0), w), paint]);
      if (kind === 'panel') for (const y of [-hh * 0.22, hh * 0.24]) rel.push([onWin(new THREE.PlaneGeometry(ww * 0.62, hh * 0.32).translate(0, y, z0 + 0.025), w), paint * 0.55]);
      if (kind === 'double') rel.push([onWin(box(0.03, hh, 0.02).translate(0, 0, z0 + 0.03), w), G.ink]);
      if (kind === 'planks') for (let k = 1; k < 5; k++) rel.push([onWin(box(0.02, hh, 0.015).translate(-ww / 2 + k * ww / 5, 0, z0 + 0.025), w), G.ink]);
      if (kind === 'glazed') {
        const litG = h3 < 0.3;
        (litG ? lit : rel).push([onWin(new THREE.PlaneGeometry(ww * 0.66, hh * 0.38).translate(0, hh * 0.2, z0 + 0.026), w), litG ? 0.32 : G.glass]);
        rel.push([onWin(box(0.025, hh * 0.38, 0.01).translate(0, hh * 0.2, z0 + 0.03), w), paint]);
      }
      // the knob (and a mail slot)
      rel.push([onWin(new THREE.SphereGeometry(0.035, 6, 4).translate(ww * 0.36 * (h2 < 0.5 ? 1 : -1), -0.05, z0 + 0.05), w), G.tin * 1.5]);
      if (kind !== 'planks' && h3 > 0.5) rel.push([onWin(new THREE.PlaneGeometry(0.24, 0.04).translate(0, -hh * 0.05, z0 + 0.027), w), G.tin]);
      // a lit transom (the far build's transom glass is dark: a light on in the hall)
      if (h3 > 0.82) lit.push([onWin(new THREE.PlaneGeometry(w.w - 0.1, 0.5).translate(0, w.h / 2 + 0.4, 0.035), w), 0.4]);
      // the number plate beside it
      if (h > 0.35) rel.push([onWin(new THREE.CircleGeometry(0.08, 10).scale(1.4, 1, 1).translate((w.w / 2 + 0.38) * (h3 < 0.5 ? 1 : -1), 0.55, 0.02), w), G.paper * 0.6]);
    }
    // the shop fronts: the trade's board on the fascia, the awning, the display behind the glass
    const awnK = ch.awnK || 0;
    for (const w of mine) {
      if (w.kind !== 'shop') continue;
      const style = LETTERS.includes(ch.letter) ? ch.letter : 'serif';
      if (w.trade) {
        const A = boardAtlas();
        const uvT = A.uv.get(style + '|t:' + w.trade), uvN = A.uv.get(style + '|n:' + vpick(NAMES, w.x, w.z, 11));
        const firstWin = K.ground + 0.9 - K.win[1] / 2;
        const y0 = w.y + w.h / 2 + 0.03, room = Math.min(0.95, firstWin - 0.1 - y0);
        if (uvT && room > 0.25) {
          const bw = Math.min(w.w * 0.95, 3.6), withName = room > 0.6 && vhash(w.x, w.z, 12) < 0.7;
          if (withName) {
            brd.push(boardFace(uvN, w.x + w.nx * 0.2, y0 + room * 0.78, w.z + w.nz * 0.2, w.nx, w.nz, bw * 0.55, room * 0.36));
            brd.push(boardFace(uvT, w.x + w.nx * 0.2, y0 + room * 0.33, w.z + w.nz * 0.2, w.nx, w.nz, bw, room * 0.58));
          } else brd.push(boardFace(uvT, w.x + w.nx * 0.2, y0 + room / 2, w.z + w.nz * 0.2, w.nx, w.nz, bw, room * 0.9));
        }
        // behind the lit glass, what the trade has (dark against the light)
        if (w.lit && DISPLAY[w.trade]) for (const [g, c] of DISPLAY[w.trade](w.w, w.h, vhash(w.x, w.z, 13))) (Array.isArray(c) ? lit : rel).push([onWin(g.translate(0, 0, 0.12), w), c]);
      }
      // a barber's pole by his window, red and white, its glass top lit (the registry's red)
      if (w.trade === 'barber' && vhash(w.x, w.z, 16) < 0.7) {
        const side = vhash(w.x, w.z, 17) < 0.5 ? -1 : 1, px = side * (w.w / 2 + 0.3), y0 = 2.0 - w.y;
        rel.push([onWin(new THREE.CylinderGeometry(0.075, 0.075, 0.9, 12).translate(px, y0 + 0.45, 0.24), w), G.paper * 1.2]);
        for (let k = 0; k < 4; k++) rel.push([onWin(new THREE.TorusGeometry(0.078, 0.022, 4, 10, Math.PI * 1.1).rotateX(Math.PI / 2 - 0.55).rotateY(k * 0.5).translate(px, y0 + 0.12 + k * 0.22, 0.24), w), RED]);
        rel.push([onWin(new THREE.BoxGeometry(0.04, 0.04, 0.24).translate(px, y0 + 0.45, 0.12), w), G.iron]);
        lit.push([onWin(new THREE.SphereGeometry(0.09, 10, 6).translate(px, y0 + 1.0, 0.24), w), 2.2]);
      }
      // the awning in the street's canvas
      if (ch.awning && vhash(w.x, w.z, 14) < awnK) awning(rel, w, ch.awning, w.y + w.h / 2 - 0.05, vhash(w.x, w.z, 15));
    }
  }
}
// an awning raked out from the wall over a shop front: its canvas in strips
// (the street's: stripe, pin, pale, dark, scallop), its valance, its arms
function awning(rel, w, kind, y, v) {
  const D = 1.35 + v * 0.3, drop = 0.5, Wd = w.w + 0.2;
  const n = Math.max(3, Math.round(Wd / (kind === 'pin' ? 0.22 : 0.42)));
  const sw = Wd / n;
  const tilt = Math.atan2(drop, D), L = Math.hypot(D, drop);
  for (let i = 0; i < n; i++) {
    const x = -Wd / 2 + (i + 0.5) * sw;
    const c = kind === 'pale' ? G.canvasP : kind === 'dark' ? G.canvasD : kind === 'pin' ? (i % 2 ? G.canvasP * 0.75 : G.canvasD) : kind === 'scallop' ? G.canvasP * 0.8 : (i % 2 ? G.canvasP : G.canvasD);
    const sx = kind === 'pin' && i % 2 ? sw * 0.45 : sw + 0.002;
    // the canvas (a strip from the wall to the hem), the valance (hanging at the hem)
    rel.push([onWin(new THREE.PlaneGeometry(sx, L).rotateX(-Math.PI / 2 + tilt).translate(x, y - drop / 2 - w.y, D / 2), w), c]);
    if (kind === 'scallop') rel.push([onWin(new THREE.CircleGeometry(sw / 2, 6, Math.PI, Math.PI).translate(x, y - drop - w.y, D + 0.005), w), c]);
    else rel.push([onWin(new THREE.PlaneGeometry(sx, 0.24).translate(x, y - drop - 0.12 - w.y, D + 0.005), w), c]);
  }
  for (const s of [-1, 1]) rel.push([onWin(box(0.03, 0.03, L).rotateX(tilt).translate(s * Wd / 2, y - drop / 2 - w.y - 0.03, D / 2), w), G.iron]);
}
// ---- a flight of stone steps down the quay's face into the river (world/dressing.js quaySteps) ----
export function stepsPieces(s, waterY) {
  const P = [], n = 12, L = s.len, drop = PAVE - (waterY - 1.0);
  for (let k = 0; k < n; k++) {
    const top = PAVE - (k + 1) * drop / n, bot = waterY - 1.6, along = (k + 0.5) * L / n;
    const cx = s.x + s.nx * 0.72 + s.dx * along, cz = s.z + s.nz * 0.72 + s.dz * along;
    const g = new THREE.BoxGeometry(1.42, top - bot, L / n + 0.01).rotateY(Math.atan2(s.dx, s.dz)).translate(cx, (top + bot) / 2, cz);
    P.push([g, G.trim * (k % 2 ? 0.8 : 0.95)]);
  }
  // (an iron rail down its open side)
  const a = V3(s.x + s.nx * 1.4, PAVE + 0.95, s.z + s.nz * 1.4), b = V3(s.x + s.nx * 1.4 + s.dx * L, waterY + 0.9, s.z + s.nz * 1.4 + s.dz * L);
  P.push([tube([a, b], 0.03, 5, 4), G.iron]);
  for (let k = 0; k <= 3; k++) { const t = k / 3; P.push([new THREE.CylinderGeometry(0.025, 0.025, 0.95, 5).translate(a.x + (b.x - a.x) * t, (a.y + (b.y - a.y) * t) - 0.47, a.z + (b.z - a.z) * t), G.iron]); }
  return P;
}
export { DISPLAY, PIECES, NAMES };
void _o;

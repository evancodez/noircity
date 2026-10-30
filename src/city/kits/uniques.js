import * as THREE from 'three';
import { lathe, tube, V3 } from '../../world/geom.js';
import { PAVE } from '../../world/plan.js';
import { G, RED, NEON_RED, AMBER } from './dress.js';
import { LETTER_FONT } from '../../ui/lettering.js';

// NOIR CITY: the one thing mid-block that is only there (lane O1b, brief §1:
// "a church, a firehouse, a bathhouse, a cinema, a bank's columns, a hotel's
// canopy, a lit clock, a water tower, a billboard, a stair down to a cellar
// bar, a yard's gate"). world/dressing.js picked the lot face nearest each
// street's middle (C.uniques: { kind, x, z (the face's middle), nx, nz, len,
// h (the lot's height), p (the pavement) }); a builder draws it in that
// face's frame (x along the face, y up from the pavement, z out of the wall).
//   uniquePieces(u) -> { relief: [[geo, level]], lit: [[geo, level]], sign: [geo with uv], vents: [{ x, y, z }] }
// The lettering is one atlas (signAtlas): each unique's own words in its own hand.
const WORDS = {
  canopy: ['THE MAJESTIC', 'deco'], paper: ['THE EVENING STAR', 'serif'], cinema: ['RIALTO', 'deco'], firehouse: ['ENGINE CO. 7', 'serif'],
  baths: ['PUBLIC BATHS', 'deco'], ballroom: ['ROSELAND', 'script'], columns: ['SAVINGS BANK', 'serif'], seamen: ['SEAMEN\'S REST', 'serif'],
  balls: ['LOANS', 'block'], barber: ['BARBER', 'script'], cellar: ['THE CELLAR', 'script'], chinese: ['JADE GARDEN', 'block'],
  steamvent: ['HAND LAUNDRY', 'serif'], poultry: ['LIVE POULTRY', 'block'], gate: ['NO ADMITTANCE', 'stencil'], bakery: ['BAKERY', 'script'],
  cycles: ['CYCLES', 'block'], yardgate: ['HARBOR LUMBER CO.', 'stencil'], billboard: ['GALLAGHER\'S RYE', 'block'], gasboard: ['CITY GAS LIGHT CO.', 'serif'],
  mission: ['JESUS SAVES', 'block'], fountain: ['1898', 'serif'], closed: ['CLOSED', 'stencil'], office: ['PIER 7  OFFICE', 'stencil'],
};
const FONTS = {
  deco: (px) => `700 ${px}px "Futura", ${LETTER_FONT}`, serif: (px) => `700 ${px}px "Didot", "Georgia", serif`,
  script: (px) => `italic 700 ${px}px "Snell Roundhand", "Brush Script MT", cursive`, block: (px) => `900 ${px}px "Impact", "Arial Black", sans-serif`,
  stencil: (px) => `700 ${px}px "Stencil", "Copperplate", monospace`,
};
let ATLAS = null;
export function signAtlas() {
  if (ATLAS) return ATLAS;
  const W = 2048, CW = 1000, CH = 150;
  const c = document.createElement('canvas'); c.width = W; c.height = 2048;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, W, c.height);
  const uv = new Map();
  Object.entries(WORDS).forEach(([k, [text, st]], i) => {
    const x = (i % 2) * (CW + 24) + 12, y = Math.floor(i / 2) * (CH + 10) + 6;
    // (a pale board, ink letters; the billboard's a painted field)
    // (neutral greys only: the ink prints any chroma over a quarter as colour)
    g.fillStyle = k === 'billboard' ? '#c6c6c6' : '#0e0e0e'; g.fillRect(x, y, CW, CH);
    g.strokeStyle = k === 'billboard' ? '#1a1a1a' : '#8c8c8c'; g.lineWidth = 5; g.strokeRect(x + 7, y + 7, CW - 14, CH - 14);
    let t = st === 'script' ? text.split(' ').map((w) => w[0] + w.slice(1).toLowerCase()).join(' ') : text;
    let px = 100;
    g.font = FONTS[st](px);
    const w0 = g.measureText(t).width;
    if (w0 > CW * 0.88) { px = Math.floor(px * CW * 0.88 / w0); g.font = FONTS[st](px); }
    g.fillStyle = k === 'billboard' ? '#0c0c0c' : '#e6e6e6'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(t, x + CW / 2, y + CH / 2 + 4);
    uv.set(k, [x / W, 1 - (y + CH) / c.height, (x + CW) / W, 1 - y / c.height]);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  ATLAS = { tex, uv, aspect: CW / CH };
  return ATLAS;
}
const box = (sx, sy, sz) => new THREE.BoxGeometry(sx, sy, sz);
const cyl = (r0, r1, h, n = 12) => new THREE.CylinderGeometry(r0, r1, h, n);
// a lettered face (local: centre x, y, z out; w x h), from the atlas
function sign(k, x, y, z, w, h, yaw = 0) {
  const A = signAtlas(), r = A.uv.get(k);
  const p = new THREE.PlaneGeometry(w, h);
  const U = p.getAttribute('uv');
  for (let i = 0; i < U.count; i++) U.setXY(i, U.getX(i) ? r[2] : r[0], U.getY(i) ? r[3] : r[1]);
  return p.rotateY(yaw).translate(x, y, z);
}
// a row of bulbs (lit)
const bulbs = (out, x0, x1, y, z, step = 0.45, r = 0.07, c = 3) => { for (let x = x0; x <= x1 + 1e-6; x += step) out.push([new THREE.SphereGeometry(r, 6, 4).translate(x, y, z), c]); };
// [O1b] a unique's own door (registered as the face's door: world/dressing.js
// UNIQUE_DOORS - E tries it, it rattles): its stone frame, its leaf or leaves
// ('panel' dark wood; 'glazed' a lit pane in a dark leaf; 'pair' two glazed
// leaves), a lit transom over it - centred at x, w wide, h tall, on the face
function door(R, L, x, w, h, kind) {
  for (const s of [-1, 1]) R.push([box(0.18, h + 0.3, 0.12).translate(x + s * (w / 2 + 0.09), (h + 0.3) / 2, 0.06), G.trim * 1.3]);
  R.push([box(w + 0.56, 0.22, 0.16).translate(x, h + 0.41, 0.08), G.trim * 1.3]);
  L.push([new THREE.PlaneGeometry(w - 0.1, 0.24).translate(x, h + 0.14, 0.03), 0.42]);
  R.push([box(w, 0.04, 0.03).translate(x, h + 0.01, 0.05), G.ink]);
  const leaves = kind === 'pair' ? [[-w / 4, w / 2 - 0.03], [w / 4, w / 2 - 0.03]] : [[0, w - 0.04]];
  for (const [lx, lw] of leaves) {
    R.push([box(lw, h - 0.02, 0.05).translate(x + lx, h / 2, 0.035), G.wood]);
    if (kind === 'panel') for (const y of [h * 0.28, h * 0.7]) R.push([new THREE.PlaneGeometry(lw * 0.62, h * 0.3).translate(x + lx, y, 0.062), G.ink]);
    else { L.push([new THREE.PlaneGeometry(lw * 0.66, h * 0.46).translate(x + lx, h * 0.62, 0.062), 0.34]); R.push([box(0.025, h * 0.46, 0.01).translate(x + lx, h * 0.62, 0.068), G.wood]); }
    R.push([new THREE.SphereGeometry(0.04, 6, 4).translate(x + lx + (kind === 'pair' ? -Math.sign(lx) * lw * 0.38 : lw * 0.38), h * 0.45, 0.08), G.tin * 1.5]);
  }
}

const B = {
  canopy(u, R, L, S) {
    const d = Math.max(2.4, u.p - 0.5);
    R.push([box(5.6, 0.28, d).translate(0, 3.6, d / 2), G.iron]);
    for (const s of [-1, 1]) R.push([cyl(0.06, 0.07, 3.6, 8).translate(s * 2.6, 1.8, d - 0.15), G.iron]);
    S.push(sign('canopy', 0, 3.6, d + 0.15, 5.4, 0.4 * 0 + 0.55));
    bulbs(L, -2.5, 2.5, 3.42, d * 0.5, 0.5, 0.06, 4);
    door(R, L, 0, 1.6, 2.6, 'glazed');
  },
  paper(u, R, L, S) {
    S.push(sign('paper', 0, 5.4, 0.25, 7.2, 1.1));
    R.push([box(7.5, 1.3, 0.2).translate(0, 5.4, 0.1), G.iron]);
    L.push([new THREE.CircleGeometry(0.7, 24).translate(0, 7.1, 0.12), 1.4]);
    R.push([new THREE.TorusGeometry(0.72, 0.06, 6, 24).translate(0, 7.1, 0.12), G.iron]);
    for (const a of [0.6, 2.4]) R.push([box(0.05, 0.55, 0.02).translate(0, 0.25, 0).rotateZ(a).translate(0, 7.1, 0.16), G.ink]);
  },
  cinema(u, R, L, S) {
    const w = Math.min(8, u.len * 0.8), d = 2.6, y = 4.4;
    R.push([box(w + 0.2, 1.4, d).translate(0, y, d / 2), G.iron]);
    L.push([box(w, 1.0, 0.02).translate(0, y, d + 0.02), 0.9]);
    S.push(sign('cinema', 0, y, d + 0.04, w * 0.7, 0.8));
    // ([O1b] after the critic: white bulbs, the blade's amber the RIALTO's colour - amber bulbs streaked the wet street, 4.5 % of a frame from the kerb)
    bulbs(L, -w / 2, w / 2, y - 0.82, d - 0.1, 0.4, 0.07, 3);
    bulbs(L, -w / 2, w / 2, y + 0.82, d - 0.1, 0.4, 0.07, 3);
    // the blade over it
    R.push([box(0.9, 4.2, 0.18).translate(w / 2 - 0.6, y + 3.4, 0.9), G.iron]);
    L.push([box(0.7, 3.9, 0.2).translate(w / 2 - 0.6, y + 3.4, 0.9), AMBER.map((c) => c * 0.25)]);
    door(R, L, 0, 2.4, 2.6, 'pair');
  },
  clock(u, R, L) {
    // a street clock on its pillar at the kerb (u.post)
    const z = u.p - 0.8;
    R.push([lathe([[0, 0], [0.32, 0], [0.32, 0.3], [0.22, 0.4], [0.16, 0.5], [0.14, 3.1], [0.2, 3.2], [0.2, 3.3], [0, 3.3]], 14).translate(0, 0, z), G.iron]);
    R.push([cyl(0.5, 0.5, 0.22, 24).rotateX(Math.PI / 2).translate(0, 3.85, z), G.iron]);
    for (const s of [-1, 1]) L.push([new THREE.CircleGeometry(0.42, 24).rotateY(s > 0 ? 0 : Math.PI).translate(0, 3.85, z + s * 0.115), 1.6]);
    for (const s of [-1, 1]) for (const a of [0.5, 2.1]) R.push([box(0.04, 0.32, 0.01).translate(0, 0.15, 0).rotateZ(a).translate(0, 3.85, z + s * 0.12), G.ink]);
    R.push([new THREE.ConeGeometry(0.3, 0.5, 12).translate(0, 4.3, z), G.iron]);
  },
  firehouse(u, R, L, S) {
    // the engine house: two tall doors (each a pair of leaves in dark enamel,
    // a row of lights near the top, pale rails), the pier between, the
    // company's board; the red is a lamp over each door and the alarm box on
    // its post ([O1b] after the critic, B2: the doors were a 47 % red wash at
    // arm's length - the registry's red is a touch, never a wall)
    for (const s of [-1, 1]) {
      const cx = s * 1.75;
      R.push([box(3.0, 3.8, 0.1).translate(cx, 1.9, 0.06), G.wood]);
      R.push([box(3.3, 0.2, 0.18).translate(cx, 3.9, 0.09), G.trim * 1.6]);
      R.push([box(0.04, 3.7, 0.02).translate(cx, 1.88, 0.12), G.ink]);
      for (const y of [0.7, 1.9]) R.push([box(2.9, 0.06, 0.02).translate(cx, y, 0.12), G.trim * 1.2]);
      for (const q of [-1, 1]) R.push([box(0.06, 3.7, 0.02).translate(cx + q * 1.45, 1.88, 0.12), G.trim * 1.2]);
      for (let k = 0; k < 4; k++) R.push([box(0.5, 0.45, 0.02).translate(cx - 1.08 + k * 0.72, 2.95, 0.12), G.paper * 0.9]);
      // [O1c] at arm's length (the brief's 'flat now'): each leaf's raised panels - a lit rim
      // round a field proud of the leaf - the brass (the pulls at the meeting edge, the
      // hinges, the kick plates), and the company's red in one thin line under the lights
      for (const l of [-1, 1]) {
        const lx = cx + l * 0.725;
        for (const [py, ph] of [[0.38, 0.5], [1.3, 1.0], [2.33, 0.62]]) {
          R.push([box(1.06, ph - 0.12, 0.03).translate(lx, py, 0.125), G.wood * 1.8]);
          for (const q of [-1, 1]) {
            // ([O1c] after the critic, m3: the red where the eye is at arm's length - the middle
            // panel's top rail, at 1.74 m, one thin red line a leaf; the rest pale)
            R.push([box(1.12, 0.035, 0.03).translate(lx, py + q * (ph / 2 - 0.04), 0.135), ph === 1.0 && q > 0 ? RED : G.trim * 1.5]);
            R.push([box(0.035, ph - 0.05, 0.03).translate(lx + q * 0.545, py, 0.135), G.trim * 1.5]);
          }
        }
        R.push([cyl(0.028, 0.028, 0.6, 10).translate(cx + l * 0.13, 1.45, 0.2), G.paper * 2.2]);
        for (const ey of [1.15, 1.75]) R.push([box(0.09, 0.05, 0.05).translate(cx + l * 0.13, ey, 0.16), G.paper * 2.2]);
        for (const hy of [0.45, 1.9, 3.3]) R.push([box(0.07, 0.2, 0.04).translate(cx + l * 1.42, hy, 0.15), G.paper * 1.8]);
        R.push([box(1.3, 0.16, 0.02).translate(lx, 0.09, 0.13), G.paper * 1.4]);
      }
      R.push([box(2.9, 0.05, 0.02).translate(cx, 3.42, 0.13), RED]);
      L.push([new THREE.SphereGeometry(0.15, 12, 8).translate(cx, 4.35, 0.42), NEON_RED]);
      R.push([box(0.04, 0.04, 0.34).translate(cx, 4.35, 0.22), G.iron]);
    }
    R.push([box(0.4, 4.0, 0.2).translate(0, 2.0, 0.1), G.trim * 1.6]);
    S.push(sign('firehouse', 0, 4.95, 0.12, 5.0, 0.6));
    // the street's fire alarm: a red box on a post at the kerb's side of the doors
    R.push([cyl(0.05, 0.06, 1.3, 8).translate(3.75, 0.65, 0.5), G.iron]);
    R.push([box(0.2, 0.3, 0.13).translate(3.75, 1.42, 0.5), RED]);
    R.push([box(0.12, 0.1, 0.01).translate(3.75, 1.45, 0.57), G.paper]);
  },
  baths(u, R, L, S, V) {
    R.push([new THREE.PlaneGeometry(Math.min(u.len, 12), 5.2).translate(0, 2.6, 0.03), G.tile * 1.3]);
    S.push(sign('baths', 0, 4.4, 0.06, 6.0, 0.9));
    for (const s of [-1, 1]) { L.push([new THREE.CircleGeometry(0.55, 20).translate(s * 3.2, 2.8, 0.05), 0.5]); R.push([new THREE.TorusGeometry(0.58, 0.07, 6, 20).translate(s * 3.2, 2.8, 0.06), G.trim]); }
    for (const s of [-1, 1]) { R.push([cyl(0.12, 0.12, 0.6, 8).rotateX(Math.PI / 2).translate(s * 1.2, 5.6, 0.3), G.iron]); V.push([s * 1.2, 5.6, 0.62]); }
    door(R, L, 0, 1.4, 2.6, 'glazed');
  },
  church(u, R, L, S, V, steeple = false) {
    const H = u.h, w = Math.min(u.len - 1, 14);
    // the gable front over the lot's top, the rose window, the pointed door, the tower and its spire
    const gab = new THREE.BufferGeometry();
    gab.setAttribute('position', new THREE.Float32BufferAttribute([-w / 2, H, 0.2, w / 2, H, 0.2, 0, H + w * 0.45, 0.2], 3));
    gab.computeVertexNormals();
    R.push([gab, steeple ? G.wood : G.trim]);
    R.push([box(w, H, 0.4).translate(0, H / 2, 0.0), steeple ? G.wood : G.trim * 0.8]);
    L.push([new THREE.CircleGeometry(1.4, 24).translate(0, H * 0.62, 0.22), 0.45]);
    for (let k = 0; k < 8; k++) R.push([box(0.08, 2.8, 0.04).rotateZ((k / 8) * Math.PI).translate(0, H * 0.62, 0.24), G.ink]);
    R.push([new THREE.TorusGeometry(1.45, 0.12, 6, 24).translate(0, H * 0.62, 0.24), G.trim * 1.4]);
    const door = new THREE.Shape();
    door.moveTo(-1, 0); door.lineTo(-1, 2.4); door.quadraticCurveTo(-1, 3.4, 0, 3.8); door.quadraticCurveTo(1, 3.4, 1, 2.4); door.lineTo(1, 0); door.lineTo(-1, 0);
    R.push([new THREE.ShapeGeometry(door).translate(0, 0, 0.22), G.ink]);
    L.push([new THREE.CircleGeometry(0.3, 12).translate(0, 3.0, 0.23), AMBER.map((c) => c * 0.3)]);
    // the tower at one end, its spire (Mercer's tall in stone; Hester's a belfry with a lit clock)
    const tx = w / 2 - 2.2, th = H + (steeple ? 10 : 16);
    R.push([box(4.4, th, 4.4).translate(tx, th / 2, -1.8), steeple ? G.wood : G.trim * 0.9]);
    if (steeple) {
      R.push([new THREE.ConeGeometry(3.4, 5, 4).rotateY(Math.PI / 4).translate(tx, th + 2.5, -1.8), G.iron]);
      L.push([new THREE.CircleGeometry(0.9, 20).translate(tx, th - 2.2, 0.42), 1.3]);
    } else {
      R.push([new THREE.ConeGeometry(2.4, 18, 8).translate(tx, th + 9, -1.8), G.trim * 0.7]);
      for (const s of [-1, 1]) R.push([new THREE.ConeGeometry(0.5, 4, 6).translate(tx + s * 1.9, th + 2, -1.8 + 1.9), G.trim * 0.7]);
    }
    R.push([box(0.12, 1.6, 0.12).translate(tx, th + (steeple ? 5.8 : 18.6), -1.8), G.iron]);
    R.push([box(0.8, 0.12, 0.12).translate(tx, th + (steeple ? 6.2 : 19.0), -1.8), G.iron]);
  },
  steeple(u, R, L, S, V) { B.church(u, R, L, S, V, true); },
  ballroom(u, R, L, S) {
    R.push([box(8, 1.5, 0.3).translate(0, 5.8, 0.2), G.iron]);
    S.push(sign('ballroom', 0, 5.8, 0.38, 7.2, 1.1));
    // ([O1b] after the critic: white bulbs - amber ones streaked red in the wet street, 4.8 % of a frame from the kerb; Fifth St's colour is its red blades)
    bulbs(L, -3.9, 3.9, 6.75, 0.3, 0.35, 0.06, 3);
    bulbs(L, -3.9, 3.9, 4.85, 0.3, 0.35, 0.06, 3);
    // ([O1b] after the critic, M4: the door was a flat white card) the dance hall's doors: a glazed pair, lit within
    door(R, L, 0, 2.4, 2.6, 'pair');
  },
  columns(u, R, L, S) {
    const w = Math.min(u.len - 2, 14), n = 6, H = 7.2;
    for (let k = 0; k < n; k++) { const x = -w / 2 + (k + 0.5) * (w / n); R.push([lathe([[0, 0], [0.45, 0], [0.45, 0.3], [0.36, 0.4], [0.33, H - 0.6], [0.4, H - 0.45], [0.48, H - 0.3], [0.48, H], [0, H]], 14).translate(x, 0, 1.1), G.trim * 1.4]); }
    R.push([box(w + 0.8, 1.1, 1.7).translate(0, H + 0.55, 0.85), G.trim * 1.2]);
    const ped = new THREE.BufferGeometry();
    ped.setAttribute('position', new THREE.Float32BufferAttribute([-w / 2 - 0.4, H + 1.1, 1.7, w / 2 + 0.4, H + 1.1, 1.7, 0, H + 3.0, 1.7], 3));
    ped.computeVertexNormals();
    R.push([ped, G.trim * 1.2]);
    S.push(sign('columns', 0, H + 0.55, 1.72, w * 0.7, 0.7));
    door(R, L, 0, 2.2, 3.4, 'pair');
  },
  mission(u, R, L, S) {
    R.push([box(5.6, 1.3, 0.2).translate(0, 4.6, 0.12), G.iron]);
    // ([O1b] after the critic: white tubes, the red the cross's alone - two red tubes and their streaks were 3.4 % of a frame from the kerb)
    L.push([box(5.2, 0.1, 0.05).translate(0, 4.15, 0.25), 2.4]);
    L.push([box(5.2, 0.1, 0.05).translate(0, 5.05, 0.25), 2.4]);
    S.push(sign('mission', 0, 4.6, 0.24, 5.2, 0.78));
    L.push([box(0.14, 1.6, 0.06).translate(0, 6.6, 0.15), NEON_RED]);
    L.push([box(0.9, 0.14, 0.06).translate(0, 6.9, 0.15), NEON_RED]);
    door(R, L, 0, 1.4, 2.4, 'glazed');
  },
  seamen(u, R, L, S) {
    S.push(sign('seamen', 0, 4.4, 0.17, 6.0, 0.9));   // ([O1b] in front of its board: it was behind it)
    R.push([box(6.3, 1.1, 0.2).translate(0, 4.4, 0.05), G.iron]);
    R.push([new THREE.TorusGeometry(0.7, 0.09, 6, 16, Math.PI).rotateZ(Math.PI).translate(0, 6.2, 0.15), G.tin]);
    R.push([box(0.14, 1.6, 0.1).translate(0, 6.6, 0.15), G.tin]);
    R.push([box(0.9, 0.12, 0.1).translate(0, 7.2, 0.15), G.tin]);
    L.push([box(0.3, 0.4, 0.3).translate(-3.6, 3.0, 0.5), AMBER.map((c) => c * 0.6)]);
    R.push([box(0.05, 0.05, 0.5).translate(-3.6, 3.3, 0.25), G.iron]);
    door(R, L, 0, 1.3, 2.4, 'panel');
  },
  balls(u, R, L, S) {
    // the pawnbroker's three gilt balls on their bracket, the board
    R.push([box(1.6, 0.06, 0.06).translate(0.8, 5.0, 0).rotateY(-Math.PI / 2).translate(0, 0, 0), G.iron]);
    const ox = 0, oz = 1.5;
    R.push([box(0.05, 0.05, 1.6).translate(ox, 5.0, 0.8), G.iron]);
    for (const [dx, dy] of [[-0.32, -0.55], [0.32, -0.55], [0, -1.05]]) R.push([new THREE.SphereGeometry(0.26, 14, 10).translate(ox + dx, 5.0 + dy, oz), G.fruit * 2.2]);
    S.push(sign('balls', 0, 3.7, 0.12, 2.6, 0.55));
  },
  barber(u, R, L, S) {
    // the pole: red and white in a spiral (strips), a lit glass top
    const x = 1.4, z = 0.35, H = 1.4, y0 = 2.0;
    R.push([cyl(0.13, 0.13, H, 16).translate(x, y0 + H / 2, z), G.paper]);
    for (let k = 0; k < 6; k++) { const g = new THREE.TorusGeometry(0.135, 0.04, 4, 12, Math.PI * 1.2).rotateX(Math.PI / 2 - 0.5).rotateY(k * 0.4).translate(x, y0 + 0.15 + k * 0.22, z); R.push([g, RED]); }
    L.push([new THREE.SphereGeometry(0.16, 12, 8).translate(x, y0 + H + 0.18, z), 2.4]);
    R.push([cyl(0.15, 0.15, 0.08, 16).translate(x, y0 - 0.04, z), G.iron]);
    R.push([box(0.06, 0.06, 0.35).translate(x, y0 + H / 2, z / 2), G.iron]);
    S.push(sign('barber', -1.2, 3.55, 0.12, 2.4, 0.5));
  },
  cellar(u, R, L, S) {
    // the areaway: an iron railing round a dark well at the wall, the amber window low down in it, the sign
    const w = 2.8, d = 1.25;
    R.push([new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate(1.2, 0.012, d / 2), G.ink * 0]);
    for (let x = -w / 2; x <= w / 2 + 1e-6; x += 0.18) R.push([box(0.022, 0.95, 0.022).translate(1.2 + x, 0.48, d), G.iron]);
    for (let z = 0.15; z < d; z += 0.18) for (const s of [-1, 1]) R.push([box(0.022, 0.95, 0.022).translate(1.2 + s * w / 2, 0.48, z), G.iron]);
    R.push([box(w, 0.04, 0.04).translate(1.2, 0.95, d), G.iron]);
    for (const s of [-1, 1]) R.push([box(0.04, 0.04, d).translate(1.2 + s * w / 2, 0.95, d / 2), G.iron]);
    L.push([new THREE.PlaneGeometry(1.6, 0.55).translate(1.2, 0.3, 0.03), AMBER.map((c) => c * 0.6)]);
    R.push([box(0.04, 0.55, 0.02).translate(1.2, 0.3, 0.05), G.ink]);
    S.push(sign('cellar', -1.4, 2.9, 0.75, 1.8, 0.4));
    R.push([box(0.04, 0.04, 0.8).translate(-1.4, 3.2, 0.4), G.iron]);
  },
  chinese(u, R, L, S) {
    R.push([tube([V3(-u.len / 2 + 0.5, 4.4, 0.25), V3(0, 4.1, 0.6), V3(u.len / 2 - 0.5, 4.4, 0.25)], 0.012, 3, 12), G.iron]);
    const n = Math.max(4, Math.floor(u.len / 2.3));
    for (let k = 0; k < n; k++) { const x = -u.len / 2 + 1 + k * (u.len - 2) / (n - 1); L.push([new THREE.SphereGeometry(0.17, 10, 8).scale(1, 1.25, 1).translate(x, 3.9 - Math.sin((k / (n - 1)) * Math.PI) * 0.25, 0.4), NEON_RED]); }
    R.push([box(0.9, 3.6, 0.16).translate(-u.len * 0.25, 6.4, 0.9), G.iron]);
    L.push([box(0.08, 3.3, 0.08).translate(-u.len * 0.25 - 0.3, 6.4, 0.99), NEON_RED]);
    L.push([box(0.08, 3.3, 0.08).translate(-u.len * 0.25 + 0.3, 6.4, 0.99), NEON_RED]);
    S.push(sign('chinese', 1.5, 3.4, 0.12, 4.0, 0.62));
  },
  steamvent(u, R, L, S, V) {
    for (const s of [-1, 1]) { R.push([cyl(0.14, 0.14, 0.7, 10).rotateX(Math.PI / 2).translate(s * 1.6, 2.7, 0.35), G.iron]); V.push([s * 1.6, 2.7, 0.75]); }
    S.push(sign('steamvent', 0, 3.6, 0.12, 4.4, 0.6));
  },
  poultry(u, R, L, S) {
    for (let k = 0; k < 6; k++) {
      const x = -1.6 + (k % 3) * 0.75, y = Math.floor(k / 3) * 0.5;
      R.push([box(0.7, 0.45, 0.55).translate(x, y + 0.23, 0.35), G.wood]);
      for (let s = 0; s < 4; s++) R.push([box(0.02, 0.4, 0.57).translate(x - 0.3 + s * 0.2, y + 0.23, 0.35), G.woodP]);
    }
    S.push(sign('poultry', 0.5, 3.5, 0.12, 4.0, 0.6));
  },
  gate(u, R, L, S) {
    for (const s of [-1, 1]) {
      R.push([box(2.0, 3.6, 0.12).translate(s * 1.02, 1.8, 0.07), G.wood]);
      for (let k = 0; k < 6; k++) R.push([box(0.04, 3.5, 0.03).translate(s * 1.02 - 0.85 + k * 0.34, 1.8, 0.14), G.woodP]);
      R.push([box(2.0, 0.12, 0.05).rotateZ(s * 0.95).translate(s * 1.02, 1.8, 0.15), G.woodP]);
    }
    S.push(sign('gate', 0, 2.6, 0.17, 2.2, 0.35));
  },
  bakery(u, R, L, S) {
    // the oven's glow up through the cellar grating in the pavement
    L.push([new THREE.PlaneGeometry(2.4, 0.9).rotateX(-Math.PI / 2).translate(0, 0.008, 0.75), AMBER.map((c) => c * 0.35)]);
    for (let x = -1.2; x <= 1.2 + 1e-6; x += 0.15) R.push([box(0.03, 0.02, 0.9).translate(x, 0.015, 0.75), G.iron]);
    S.push(sign('bakery', 0, 3.6, 0.12, 3.2, 0.6));
  },
  cycles(u, R, L, S) {
    R.push([new THREE.TorusGeometry(0.6, 0.05, 6, 24).translate(-2.0, 4.8, 0.2), G.iron]);
    for (let k = 0; k < 6; k++) R.push([box(0.02, 1.15, 0.02).rotateZ((k / 6) * Math.PI).translate(-2.0, 4.8, 0.2), G.iron]);
    S.push(sign('cycles', 0.6, 3.6, 0.12, 3.0, 0.55));
    for (let k = 0; k < 4; k++) R.push([box(0.04, 0.5, 0.04).translate(-1 + k * 0.6, 0.25, 0.9), G.iron]);
  },
  yardgate(u, R, L, S) {
    const w = Math.min(u.len - 2, 10);
    for (const s of [-1, 1]) R.push([box(0.6, 5.6, 0.6).translate(s * (w / 2 + 0.3), 2.8, 0.3), G.trim]);
    R.push([box(w + 1.2, 1.3, 0.3).translate(0, 5.0, 0.3), G.wood]);
    S.push(sign('yardgate', 0, 5.0, 0.47, w * 0.9, 0.95));
    for (const s of [-1, 1]) { R.push([box(w / 2 - 0.1, 3.8, 0.1).translate(s * w / 4, 1.9, 0.08), G.wood]); for (let k = 0; k < 5; k++) R.push([box(0.05, 3.7, 0.04).translate(s * w / 4 - w / 4 + 0.4 + k * (w / 2 - 0.8) / 4, 1.9, 0.15), G.woodP]); }
  },
  watertower(u, R) {
    // a timber tank on a steel trestle on the shed's roof, by the street
    const y0 = u.h, H = 9;
    for (const [x, z] of [[-2, -2], [2, -2], [2, 2], [-2, 2]]) R.push([box(0.2, H, 0.2).translate(x, y0 + H / 2, z - 3), G.iron]);
    for (const s of [-1, 1]) R.push([box(0.08, 0.08, 5.8).rotateX(s * 0.95).translate(-2, y0 + H / 2, -3), G.iron]);
    for (const s of [-1, 1]) R.push([box(0.08, 0.08, 5.8).rotateX(s * 0.95).translate(2, y0 + H / 2, -3), G.iron]);
    R.push([cyl(2.8, 2.8, 5.2, 18).translate(0, y0 + H + 2.6, -3), G.wood]);
    for (const y of [0.8, 2.2, 3.6, 4.8]) R.push([cyl(2.84, 2.84, 0.08, 18).translate(0, y0 + H + y, -3), G.iron]);
    R.push([new THREE.ConeGeometry(3.0, 2.2, 18).translate(0, y0 + H + 6.3, -3), G.iron]);
  },
  billboard(u, R, L, S) {
    const y0 = u.h + 1.2, w = 12, h = 4.6;
    for (const x of [-4.5, 0, 4.5]) R.push([box(0.15, h + 1.2, 0.15).translate(x, y0 + (h + 1.2) / 2 - 1.2, -0.8), G.iron]);
    R.push([box(w + 0.3, h + 0.3, 0.12).translate(0, y0 + h / 2, -0.55), G.iron]);
    S.push(sign('billboard', 0, y0 + h * 0.62, -0.48, w * 0.92, h * 0.4));
    // the bottle, painted
    R.push([lathe([[0.01, 0], [0.5, 0], [0.55, 1.4], [0.3, 1.9], [0.18, 2.4], [0.2, 2.5], [0.01, 2.5]], 12).scale(1, 1, 0.1).translate(w * 0.36, y0 + 0.3, -0.45), G.ink]);
    for (const x of [-4, 0, 4]) { R.push([tube([V3(x, y0 - 0.3, -0.5), V3(x, y0 - 0.2, 0.4), V3(x, y0 + 0.2, 0.9)], 0.03, 4, 6), G.iron]); L.push([new THREE.SphereGeometry(0.14, 8, 6).translate(x, y0 + 0.25, 0.95), 2.5]); }
  },
  gasboard(u, R, L, S) {
    S.push(sign('gasboard', 0, Math.max(5, u.h - 2.4), 0.06, Math.min(u.len * 0.8, 12), 1.6));
  },
  fountain(u, R, L, S) {
    // a drinking fountain in a niche: the arch, the lion's mask, the basin
    R.push([new THREE.RingGeometry(0.9, 1.15, 12, 1, 0, Math.PI).translate(0, 1.8, 0.05), G.trim * 1.5]);
    for (const s of [-1, 1]) R.push([box(0.25, 1.8, 0.2).translate(s * 1.02, 0.9, 0.1), G.trim * 1.5]);
    R.push([new THREE.SphereGeometry(0.22, 10, 8).scale(1, 1, 0.5).translate(0, 1.45, 0.1), G.tin]);
    R.push([new THREE.CylinderGeometry(0.6, 0.45, 0.4, 14, 1, false, -Math.PI / 2, Math.PI).translate(0, 0.75, 0.05), G.trim * 1.5]);
    S.push(sign('fountain', 0, 2.25, 0.08, 0.8, 0.2));
  },
};

// the Hill's lane (world/dressing.js hillLane): in the world's frame - its
// cobbled ribbon, its walls with their coping, the mouths' piers
function lanePieces(u, R) {
  const P = u.pts, n = P.length - 1;
  const nrm = (k) => { const a = P[Math.max(0, k - 1)], b = P[Math.min(n, k + 1)], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); return [-dz / L, dx / L]; };
  const pos = [];
  for (let k = 0; k < n; k++) {
    const na = nrm(k), nb = nrm(k + 1), a = P[k], b = P[k + 1], y = PAVE + 0.012;
    const a0 = [a[0] - na[0] * u.hw, a[1] - na[1] * u.hw], a1 = [a[0] + na[0] * u.hw, a[1] + na[1] * u.hw], b0 = [b[0] - nb[0] * u.hw, b[1] - nb[1] * u.hw], b1 = [b[0] + nb[0] * u.hw, b[1] + nb[1] * u.hw];
    pos.push(a0[0], y, a0[1], b1[0], y, b1[1], b0[0], y, b0[1], a0[0], y, a0[1], a1[0], y, a1[1], b1[0], y, b1[1]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  // (the face looks up)
  const p = g.getAttribute('position').array;
  for (let i = 0; i < p.length; i += 9) { const ux = p[i + 3] - p[i], uz = p[i + 5] - p[i + 2], vx = p[i + 6] - p[i], vz = p[i + 8] - p[i + 2]; if (uz * vx - ux * vz < 0) for (let q = 0; q < 3; q++) { const t = p[i + 3 + q]; p[i + 3 + q] = p[i + 6 + q]; p[i + 6 + q] = t; } }
  g.computeVertexNormals();
  R.push([g, G.wood * 0.5]);
  // the walls: 2.6 m of stone, a coping on top
  for (const w of u.walls) {
    const L = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]), yaw = Math.atan2(-(w.b[1] - w.a[1]), w.b[0] - w.a[0]);
    R.push([box(L + 0.06, 2.6, 0.45).rotateY(yaw).translate((w.a[0] + w.b[0]) / 2, PAVE + 1.3, (w.a[1] + w.b[1]) / 2), G.trim * 0.55]);
    R.push([box(L + 0.1, 0.12, 0.6).rotateY(yaw).translate((w.a[0] + w.b[0]) / 2, PAVE + 2.66, (w.a[1] + w.b[1]) / 2), G.trim * 1.1]);
  }
  // the mouths: a pier each side, a lantern on each
  for (const k of [1, n - 1]) {
    const nk = nrm(k);
    for (const s of [-1, 1]) {
      const x = P[k][0] + nk[0] * s * (u.hw + u.verge), z = P[k][1] + nk[1] * s * (u.hw + u.verge);
      R.push([box(0.8, 3.4, 0.8).translate(x, PAVE + 1.7, z), G.trim * 0.8]);
    }
  }
}

// a unique's pieces in the world: { relief, lit, sign, vents }
export function uniquePieces(u) {
  const R = [], L = [], S = [], V = [];
  if (u.kind === 'lane') { lanePieces(u, R); return { relief: R, lit: L, sign: S, vents: [] }; }
  const f = B[u.kind];
  if (!f) return { relief: R, lit: L, sign: S, vents: V };
  f(u, R, L, S, V);
  const yaw = Math.atan2(u.nx, u.nz);
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const m = new THREE.Matrix4().compose(new THREE.Vector3(u.x, PAVE, u.z), q, new THREE.Vector3(1, 1, 1));
  for (const p of R) p[0].applyMatrix4(m);
  for (const p of L) p[0].applyMatrix4(m);
  for (const g of S) g.applyMatrix4(m);
  const vents = V.map(([x, y, z]) => new THREE.Vector3(x, y, z).applyMatrix4(m));
  return { relief: R, lit: L, sign: S, vents };
}
export const UNIQUE_KINDS = Object.keys(B);

// the el's stair gate (the cold play's finding 11: the stair looked
// climbable, went black at its foot and said nothing): two posts, an iron
// grille, a chain across, a board CLOSED - at (x, z), facing +z (the street)
export function stairGate(x, z, w = 1.8) {
  const R = [], S = [];
  for (const s of [-1, 1]) R.push([box(0.12, 1.5, 0.12).translate(x + s * (w / 2 + 0.06), PAVE + 0.75, z), G.iron]);
  for (let k = 0; k <= 9; k++) R.push([box(0.025, 1.3, 0.025).translate(x - w / 2 + 0.09 + k * (w - 0.18) / 9, PAVE + 0.7, z), G.iron]);
  for (const y of [0.12, 1.32]) R.push([box(w, 0.04, 0.04).translate(x, PAVE + y, z), G.iron]);
  R.push([tube([V3(x - w / 2, PAVE + 1.0, z + 0.06), V3(x, PAVE + 0.82, z + 0.09), V3(x + w / 2, PAVE + 1.0, z + 0.06)], 0.018, 4, 10), G.tin]);
  R.push([box(0.12, 0.16, 0.08).translate(x, PAVE + 0.86, z + 0.1), G.tin]);
  S.push(sign('closed', x, PAVE + 1.08, z + 0.05, 0.9, 0.24));
  return { relief: R, sign: S };
}
// a pier's shed (the cold play's finding 9: a blank slab): its roof's ridge,
// doors, lit windows, a board on the office's
export function pierShed(x0, x1, z0, z1, h, office) {
  const R = [], L = [], S = [];
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
  const gab = new THREE.BufferGeometry();
  const y = PAVE + h;
  gab.setAttribute('position', new THREE.Float32BufferAttribute([x0, y, z0, x1, y, z0, cx, y + w * 0.22, z0, x1, y, z1, x0, y, z1, cx, y + w * 0.22, z1], 3));
  gab.computeVertexNormals();
  R.push([gab, G.wood]);
  for (const s of [-1, 1]) { const g = new THREE.PlaneGeometry(Math.hypot(w / 2, w * 0.22) + 0.3, d + 0.4).rotateX(-Math.PI / 2).rotateZ(s * Math.atan2(w * 0.22, w / 2)).translate(cx - s * w / 4, y + w * 0.11, cz); R.push([g, G.iron]); }
  // the doors on its long sides, a window lit here and there, the office's board
  for (const sx of [-1, 1]) for (let k = 0; k < Math.floor(d / 9); k++) {
    const z = z0 + 4.5 + k * 9, x = sx < 0 ? x0 - 0.02 : x1 + 0.02, yaw = sx < 0 ? -Math.PI / 2 : Math.PI / 2;
    R.push([new THREE.PlaneGeometry(3.2, 3.4).rotateY(yaw).translate(x + sx * 0.01, PAVE + 1.7, z), G.wood * 1.6]);
    for (let q = 0; q < 4; q++) R.push([new THREE.PlaneGeometry(0.06, 3.3).rotateY(yaw).translate(x + sx * 0.015, PAVE + 1.7, z - 1.2 + q * 0.8), G.ink]);
    const lit = ((k + (sx > 0 ? 1 : 0)) % 3) === 0;
    (lit ? L : R).push([new THREE.PlaneGeometry(1.2, 0.8).rotateY(yaw).translate(x + sx * 0.015, PAVE + h - 1.4, z + 2.6), lit ? 0.55 : G.ink]);
  }
  if (office) {
    S.push(sign('office', cx, PAVE + h - 1.0, z0 - 0.04, Math.min(w * 0.8, 9), 1.0, Math.PI));
    L.push([new THREE.PlaneGeometry(1.4, 1.0).rotateY(Math.PI).translate(cx - 3, PAVE + 2.0, z0 - 0.03), 0.6]);
    L.push([new THREE.PlaneGeometry(1.4, 1.0).rotateY(Math.PI).translate(cx + 3, PAVE + 2.0, z0 - 0.03), 0.6]);
  }
  return { relief: R, lit: L, sign: S };
}

import * as THREE from 'three';
import { allocInkId, LAYER } from '../../../render/layers.js';
import { accent } from '../../../render/accents.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { merge } from '../../../world/geom.js';
import { BLOCKS, PAVE } from '../plan.js';

// [C3c] The city's neon (the user, after playing the tail: "add some neon
// signs, not an overload, but in general to the city, to add some colour").
// Twenty-six signs ([C3c, after the critic] eighteen, then eight more where
// a timed drive had none) where a sign would be and where the drive passes:
// a lit tube on a black enamel board (the tube's rim its colour, its centre line
// white-hot, as the DINER's), the bloom's glow round it, a grey wash of its
// light on the wall and the wet pavement under it, and its streak in the
// road (the pipeline's mirror takes any bright emitter in the world layer:
// the streak keeps the tube's hue). Three colours, one a sign: the
// registry's neon blue, a green and an amber (accents.js neonGreen /
// neonAmber). No red: red is his tail lamps, the thing I follow, and the
// Cardinal's colour (WAVE_C §4). (No painted halo: the ink keeps any trace
// of a saturated colour at full strength, so a soft coloured halo printed as
// a flat coloured disc over the sign.)
//
// Batched: every face is a quad into one atlas (one canvas, one material);
// a block's signs are one mesh of boards, one of faces and one of washes,
// shown with their block (buildings.js: the block's own visibility, which
// sight.js keeps). No real lights. Two signs flicker (their faces a mesh of
// their own, the gain taken down a moment now and then).
//
// A sign: { x, z: the point on the facade, n: [nx, nz] the facade's outward
// normal, kind: 'blade' (hung out over the pavement, a face each side) |
// 'flat' (on the wall) | 'window' (a lit shop window with the tube in it),
// text, vert (letters one above another), col: 'blue' | 'green' | 'amber',
// y: the centre's height, sym: 'cross' | 'balls' | 'arrow' (to the wall),
// flick }

const SIGNS = [
  // (each on the right-hand side as his way passes it, or facing the way
  // ahead: a left-hand drive's near pillar hides most of the left kerb)
  // Pell Lane, the kerb where it starts: the hotel over the lane, flickering
  { x: -203.25, z: -3, n: [-1, 0], kind: 'blade', text: 'HOTEL', vert: true, col: 'blue', y: 5.0, flick: true },
  // Harbor St, east from the lane: a bar
  { x: -190, z: -12, n: [0, -1], kind: 'blade', text: 'BAR', vert: true, col: 'amber', y: 4.4 },
  // Cooper St, north: the pharmacy's cross
  { x: -166.5, z: -64, n: [-1, 0], kind: 'blade', text: 'DRUGS', vert: true, col: 'green', y: 4.8, sym: 'cross' },
  // the market square: a cafe across Market St, the dance hall across the avenue
  { x: -134, z: -185, n: [0, 1], kind: 'flat', text: 'CAFE', col: 'amber', y: 4.2, w: 4.2, h: 1.3 },
  { x: -87, z: -137, n: [-1, 0], kind: 'flat', text: 'DANCING', col: 'green', y: 4.6, w: 6.4, h: 1.4 },
  // the avenue under the el, north to the canal: the pawnbroker
  { x: -87, z: -222, n: [-1, 0], kind: 'blade', text: 'LOANS', vert: true, col: 'amber', y: 4.6, sym: 'balls' },
  // Canal St, east: a garage, flickering
  { x: -58, z: -241.5, n: [0, -1], kind: 'blade', text: 'GARAGE', vert: true, col: 'green', y: 4.9, flick: true },
  // Baxter St, south past the clock: liquor, and a lit window further on
  { x: -33.5, z: -205, n: [1, 0], kind: 'blade', text: 'LIQUOR', vert: true, col: 'blue', y: 4.9 },
  { x: -33.5, z: -146, n: [1, 0], kind: 'window', text: 'OPEN', col: 'amber' },
  // Clock St, east to the alley: a lit window, EATS
  { x: -3, z: -91.5, n: [0, -1], kind: 'window', text: 'EATS', col: 'green' },
  // the alley: rooms, small, over a door
  { x: 9.75, z: -60, n: [1, 0], kind: 'blade', text: 'ROOMS', vert: true, col: 'amber', y: 3.9, small: true },
  // Harbor St under the el: the theatre's name
  { x: 30, z: -12, n: [0, -1], kind: 'blade', text: 'PALACE', vert: true, col: 'green', y: 6.0, big: true },
  // Water St, north: a tavern, a hotel, and the way to the docks
  { x: 58.5, z: -68, n: [-1, 0], kind: 'blade', text: 'TAVERN', vert: true, col: 'amber', y: 4.9 },
  { x: 58.5, z: -150, n: [-1, 0], kind: 'blade', text: 'HOTEL', vert: true, col: 'blue', y: 5.0 },
  { x: 58.5, z: -224, n: [-1, 0], kind: 'blade', text: 'DOCKS', col: 'amber', y: 4.2, sym: 'arrow', horiz: true },
  // the river road: an oyster bar by the wharf market, a bar at the quay, a
  // cold store's long tube (the river road read greyest)
  { x: 95, z: -204, n: [1, 0], kind: 'blade', text: 'OYSTERS', vert: true, col: 'green', y: 5.0 },
  { x: 95, z: -72, n: [1, 0], kind: 'blade', text: 'BAR', vert: true, col: 'blue', y: 4.4 },
  { x: 95, z: 86, n: [1, 0], kind: 'flat', text: 'COLD STORE', col: 'amber', y: 6.6, w: 9.5, h: 1.3 },
  // [C3c, after the critic] where a timed drive went without colour (frames
  // every 10 s of the good hands, seed 33: t10, t20, t30, t50; the river road
  // after OYSTERS): the T where Pell Lane meets Harbor St (straight ahead as
  // I pull off the kerb), Cooper St north past the square (far ahead and
  // high: the near left kerb is behind the pillar), the square's far corner
  // across the avenue (seen all the way over the square), Baxter St south
  // (the right kerb, past the clock's street), Canal St's end at the river (a
  // seamen's mission, as I turn onto the river road), and the river road: a
  // lodging house's tall sign high over the
  // wharf (in view from the canal's corner all the way down), a pool hall,
  // and a seamen's hotel at the far end by the docks
  { x: -209, z: -38, n: [0, 1], kind: 'flat', text: 'BILLIARDS', col: 'green', y: 5.4, w: 3.8, h: 0.85 },
  { x: -183.5, z: -192, n: [1, 0], kind: 'blade', text: 'CIGARS', vert: true, col: 'blue', y: 6.4, big: true },
  { x: -87, z: -199, n: [-1, 0], kind: 'flat', text: 'RADIO', col: 'blue', y: 4.6, w: 4.6, h: 1.3 },
  { x: -33.5, z: -124, n: [1, 0], kind: 'blade', text: 'GRILL', vert: true, col: 'green', y: 4.7 },
  { x: 86, z: -241.5, n: [0, -1], kind: 'blade', text: 'MISSION', vert: true, col: 'blue', y: 5.4 },
  { x: 95, z: -138, n: [1, 0], kind: 'blade', text: 'LODGING', vert: true, col: 'amber', y: 7.2, big: true },
  { x: 95, z: 14, n: [1, 0], kind: 'blade', text: 'POOL', vert: true, col: 'green', y: 4.6 },
  { x: 95, z: 110, n: [1, 0], kind: 'blade', text: 'HOTEL', vert: true, col: 'blue', y: 6.4, big: true },
];

// the colours, as the canvas draws them (sRGB) and as the halo is lit (linear)
const COL = {
  blue: { rim: '#4aa8ff', core: '#dff0ff', key: 'neon' },
  green: { rim: '#3cff88', core: '#e6fff0', key: 'neonGreen' },
  amber: { rim: '#ff9a2e', core: '#fff1d8', key: 'neonAmber' },
};
const GAIN = 3.2;          // the faces' level (the canvas' tube x this)
const SHOW = 260;          // beyond this the signs go (their blocks go at 330)
const PX = 112;            // atlas pixels a metre
const ATLAS = 2048;
const ATLAS_H = 2560;      // ([C3c, after the critic] taller: the eight signs added)

// ---- the atlas -------------------------------------------------------------------------------------
function atlas() {
  const c = document.createElement('canvas'); c.width = ATLAS; c.height = ATLAS_H;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, ATLAS, ATLAS_H);
  let x = 4, y = 4, row = 0;
  const cells = [];
  const alloc = (wPx, hPx) => {
    if (x + wPx + 4 > ATLAS) { x = 4; y += row + 8; row = 0; }
    const cell = { x, y, w: wPx, h: hPx };
    x += wPx + 8; row = Math.max(row, hPx);
    if (y + hPx > ATLAS_H) throw new Error('neon atlas full');
    cells.push(cell);
    return cell;
  };
  return { c, g, alloc };
}

// one face of a sign into its cell: the board's black (or a lit window's
// grey), the tube's glow, the tube, its white-hot centre line
function drawFace(A, s, wM, hM, { flipArrow = false } = {}) {
  const C = COL[s.col];
  const cell = A.alloc(Math.round(wM * PX), Math.round(hM * PX));
  const g = A.g;
  g.save();
  g.beginPath(); g.rect(cell.x, cell.y, cell.w, cell.h); g.clip();
  g.translate(cell.x, cell.y);
  const W = cell.w, H = cell.h;
  if (s.kind === 'window') {
    // the pane: a dim lit grey (x the gain: ~0.06 lit), its glazing bars dark
    g.fillStyle = '#1b1b1b'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H * 0.05); g.fillRect(0, H * 0.95, W, H * 0.05);
    g.fillRect(0, 0, W * 0.03, H); g.fillRect(W * 0.97, 0, W * 0.03, H);
    g.fillRect(W * 0.49, 0, W * 0.02, H * 0.3);
    g.fillRect(0, H * 0.3, W, H * 0.025);
  } else { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); }
  g.lineJoin = 'round'; g.lineCap = 'round';
  const tube = Math.max(3, Math.round(PX * (s.big ? 0.055 : 0.045)));
  const paths = [];   // functions that lay a path (stroked three times)
  const font = (px) => `bold ${px}px "Arial Narrow", "Helvetica Neue", Arial, sans-serif`;
  const text = (t, cx, cy, px, sx = 0.86) => paths.push(() => { g.save(); g.font = font(px); g.textAlign = 'center'; g.textBaseline = 'middle'; g.translate(cx, cy); g.scale(sx, 1); g.beginPath(); g.strokeText(t, 0, 0); g.restore(); });
  const shape = (fn) => paths.push(() => { g.beginPath(); fn(); g.stroke(); });
  const m = tube * 1.6;
  if (s.kind !== 'window') {
    // the border tube round the board
    shape(() => { const r = Math.min(W, H) * 0.12; g.roundRect(m, m, W - 2 * m, H - 2 * m, r); });
  }
  if (s.vert) {
    const n = s.text.length;
    const top = s.sym ? H * 0.2 : m * 2.2;
    const step = (H - top - m * 2.6) / n;
    const px = Math.min(step * 0.92, (W - 4 * m) * 1.15);
    for (let i = 0; i < n; i++) text(s.text[i], W / 2, top + step * (i + 0.55), px, 1);
    if (s.sym === 'cross') {
      const cx = W / 2, cy = H * 0.105, a = Math.min(W * 0.28, H * 0.06), b = a * 0.36;
      shape(() => { g.moveTo(cx - b, cy - a); g.lineTo(cx + b, cy - a); g.lineTo(cx + b, cy - b); g.lineTo(cx + a, cy - b); g.lineTo(cx + a, cy + b); g.lineTo(cx + b, cy + b); g.lineTo(cx + b, cy + a); g.lineTo(cx - b, cy + a); g.lineTo(cx - b, cy + b); g.lineTo(cx - a, cy + b); g.lineTo(cx - a, cy - b); g.lineTo(cx - b, cy - b); g.closePath(); });
    } else if (s.sym === 'balls') {
      const r = Math.min(W * 0.13, H * 0.03), cx = W / 2, cy = H * 0.1;
      for (const [dx, dy] of [[-1.25, -0.7], [1.25, -0.7], [0, 1.0]]) shape(() => g.arc(cx + dx * r, cy + dy * r, r, 0, Math.PI * 2));
    }
  } else if (s.kind === 'window') {
    text(s.text, W / 2, H * 0.64, H * 0.36, 0.9);
  } else {
    const arrowW = s.sym === 'arrow' ? H * 0.9 : 0;
    const tw = W - 4 * m - arrowW;
    const px = Math.min(H * 0.6, (tw / Math.max(1, s.text.length)) * 1.45);
    const dir = flipArrow ? -1 : 1;
    const tx = W / 2 - dir * arrowW / 2;
    text(s.text, tx, H * 0.53, px, s.text.length > 6 ? 0.8 : 0.9);
    if (s.sym === 'arrow') {
      const ax = dir > 0 ? W - 2 * m - arrowW * 0.55 : 2 * m + arrowW * 0.55, ay = H / 2, k = arrowW * 0.38;
      shape(() => { g.moveTo(ax - dir * k, ay - k * 0.28); g.lineTo(ax + dir * k * 0.15, ay - k * 0.28); g.lineTo(ax + dir * k * 0.15, ay - k * 0.75); g.lineTo(ax + dir * k, ay); g.lineTo(ax + dir * k * 0.15, ay + k * 0.75); g.lineTo(ax + dir * k * 0.15, ay + k * 0.28); g.lineTo(ax - dir * k, ay + k * 0.28); g.closePath(); });
    }
  }
  // the tube (the glass), then its hot line. No glow painted on the enamel:
  // the ink keeps ANY trace of a saturated colour at full strength (its
  // value floored at 0.45), so a soft glow printed the whole board as a
  // coloured slab; the board stays black and the bloom gives the glow
  g.strokeStyle = C.rim; g.lineWidth = tube;
  for (const p of paths) p();
  g.strokeStyle = C.core; g.lineWidth = Math.max(1, tube * 0.32);
  for (const p of paths) p();
  g.restore();
  return { u0: cell.x / ATLAS, v0: 1 - (cell.y + cell.h) / ATLAS_H, u1: (cell.x + cell.w) / ATLAS, v1: 1 - cell.y / ATLAS_H };
}

// a quad (w x h) facing (fx, fz) at p, its texture the cell's
function faceGeo(w, h, fx, fz, x, y, z, uv) {
  const g = new THREE.PlaneGeometry(w, h);
  const a = g.attributes.uv;
  for (let i = 0; i < a.count; i++) a.setXY(i, uv.u0 + a.getX(i) * (uv.u1 - uv.u0), uv.v0 + a.getY(i) * (uv.v1 - uv.v0));
  g.rotateY(Math.atan2(fx, fz)).translate(x, y, z);
  return g;
}

// soft round falloff (the halo's, the wash's)
let SOFT = null;
function softTex() {
  if (SOFT) return SOFT;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.6)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.15)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  SOFT = new THREE.CanvasTexture(c);
  return SOFT;
}

// a soft quad lying on a plane (the wall's wash, the pavement's), its colour
// in the vertices
function washGeo(w, h, rotX, rotY, x, y, z, c) {
  const g = new THREE.PlaneGeometry(w, h);
  if (rotX) g.rotateX(rotX);
  if (rotY) g.rotateY(rotY);
  g.translate(x, y, z);
  const n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

const blockOf = (x, z) => BLOCKS.findIndex((b) => x >= b.kx0 - 1.5 && x <= b.kx1 + 1.5 && z >= b.kz0 - 1.5 && z <= b.kz1 + 1.5);

export default {
  name: 'neon', order: 195, tick: 65,
  build(stage) {
    const { scene, M } = stage;
    const group = new THREE.Group();
    group.name = 'neon';
    scene.add(group);
    const A = atlas();
    const tex = new THREE.CanvasTexture(A.c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const faceMat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color().setScalar(GAIN), fog: false });
    faceMat.name = 'neon_faces';
    const washMat = new THREE.MeshBasicMaterial({ map: softTex(), vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    washMat.name = 'neon_wash';
    const groups = new Map();   // block index -> { boards, faces, halos, washes, flick: [] }
    const G = (bi) => { if (!groups.has(bi)) groups.set(bi, { boards: [], faces: [], washes: [], flick: [] }); return groups.get(bi); };
    const box = (cx, cy, cz, sx, sy, sz, yaw) => new THREE.BoxGeometry(sx, sy, sz).rotateY(yaw).translate(cx, cy, cz);
    const signs = [];
    for (const s of SIGNS) {
      const bi = blockOf(s.x, s.z);
      const B = G(bi);
      const [nx, nz] = s.n, tx = -nz, tz = nx;      // out from the wall; along it
      const C = COL[s.col];
      const lin = accent(C.key);
      const hue = lin.clone().multiplyScalar(1 / Math.max(lin.r, lin.g, lin.b));
      // the wash: the sign's light, mostly white (grey light on the wall:
      // the ink's tones, not a coloured slab)
      const washC = new THREE.Color(1, 1, 1).lerp(hue, 0.08).multiplyScalar(0.05);
      const own = { faces: [] };
      const into = s.flick ? own : B;
      let cx, cy, cz, hw, hh;
      if (s.kind === 'blade') {
        const n = s.text.length;
        const wM = s.small ? 0.62 : s.big ? 1.15 : 0.82;
        const lh = s.small ? 0.42 : s.big ? 0.78 : 0.56;
        const hM = s.horiz ? 0.8 : n * lh + (s.sym ? 0.75 : 0.32);
        const bw = s.horiz ? 2.4 : wM;
        const out = 0.35 + bw / 2;
        cx = s.x + nx * out; cy = s.y; cz = s.z + nz * out;
        const th = 0.12;
        const yawN = Math.atan2(-nz, nx);
        B.boards.push(box(cx, cy, cz, bw, hM, th, yawN));
        // (its iron: a bar from the wall over the board's top, a stay below)
        const reach = 0.35 + bw;
        B.boards.push(box(s.x + nx * reach / 2, cy + hM / 2 + 0.08, s.z + nz * reach / 2, reach, 0.05, 0.05, yawN));
        B.boards.push(box(s.x + nx * 0.18, cy, s.z + nz * 0.18, 0.36, Math.min(hM, 1.4), 0.08, yawN));
        // a face each side; the arrow (to the wall) drawn for each side
        // ([C3c, after the critic] the two faces share one cell unless the
        // arrow must point each way: the atlas holds the added signs)
        let uv0 = null;
        for (const sd of [1, -1]) {
          const fx = tx * sd, fz = tz * sd;
          // (the viewer's right on this face is (fz, -fx): the wall is to his
          // right when (fz, -fx) . n < 0)
          const wallRight = fz * nx - fx * nz < 0;
          const uv = s.sym === 'arrow' || !uv0 ? drawFace(A, s, bw - 0.06, hM - 0.06, { flipArrow: !wallRight }) : uv0;
          uv0 = uv;
          into.faces.push(faceGeo(bw - 0.06, hM - 0.06, fx, fz, cx + fx * (th / 2 + 0.004), cy, cz + fz * (th / 2 + 0.004), uv));
        }
        hw = bw; hh = hM;
        // the wash on the wall by its root, and on the pavement below
        B.washes.push(washGeo(bw * 2.2 + 1.2, hM * 1.6 + 1, 0, Math.atan2(nx, nz), s.x + nx * 0.14, cy, s.z + nz * 0.14, washC));
      } else {
        const wM = s.kind === 'window' ? 2.4 : s.w, hM = s.kind === 'window' ? 1.7 : s.h;
        const y = s.kind === 'window' ? PAVE + 0.55 + hM / 2 : s.y;
        const off = s.kind === 'window' ? 0.11 : 0.1;
        cx = s.x + nx * off; cy = y; cz = s.z + nz * off;
        if (s.kind !== 'window') B.boards.push(box(s.x + nx * 0.05, y, s.z + nz * 0.05, wM + 0.1, hM + 0.1, 0.1, Math.atan2(-nz, nx) + Math.PI / 2));
        const uv = drawFace(A, s, wM, hM);
        into.faces.push(faceGeo(wM, hM, nx, nz, cx + nx * 0.005, cy, cz + nz * 0.005, uv));
        hw = wM; hh = hM;
        B.washes.push(washGeo(wM * 1.8 + 1.5, hM * 2.4 + 1.2, 0, Math.atan2(nx, nz), s.x + nx * 0.14, cy, s.z + nz * 0.14, washC));
      }
      // the pavement under it
      const py = PAVE + 0.025, pd = s.kind === 'window' ? 1.3 : 1.5;
      B.washes.push(washGeo(Math.max(hw, 1.2) * 1.9 + 1.6, 3.0, -Math.PI / 2, Math.atan2(nx, nz), s.x + nx * pd, py, s.z + nz * pd, washC.clone().multiplyScalar(1.4)));
      if (s.flick) B.flick.push(own);
      signs.push({ s, bi, at: new THREE.Vector3(cx, cy, cz) });
    }
    tex.needsUpdate = true;
    // the meshes, a block at a time
    const blocks = [];
    const tag = (m, id, layer = LAYER.WORLD) => { m.userData.inkId = id; m.userData.noRay = true; m.layers.set(layer); m.castShadow = false; m.receiveShadow = false; group.add(m); return m; };
    for (const [bi, B] of groups) {
      const id = allocInkId();
      const meshes = [];
      if (B.boards.length) meshes.push(tag(new THREE.Mesh(merge(B.boards), M.black), id));
      // (the faces and washes keep their uv and colour: merge() strips them)
      if (B.faces.length) meshes.push(tag(new THREE.Mesh(mergeGeometries(B.faces), faceMat), id));
      if (B.washes.length) { const w = tag(new THREE.Mesh(mergeGeometries(B.washes), washMat), id, LAYER.FX); w.renderOrder = 5; meshes.push(w); }
      const flick = [];
      for (const f of B.flick) {
        const fm = faceMat.clone(); fm.name = 'neon_faces_flick';
        meshes.push(tag(new THREE.Mesh(mergeGeometries(f.faces), fm), id));
        flick.push({ fm, seed: flick.length * 7.3 + bi * 1.7, k: 1 });
      }
      const b = bi >= 0 ? BLOCKS[bi] : null;
      const mid = b ? new THREE.Vector3((b.x0 + b.x1) / 2, 0, (b.z0 + b.z1) / 2) : new THREE.Vector3();
      blocks.push({ bi, meshes, mid, flick, _v: null });
    }
    const BU = stage.part('buildings');
    // (?noneon=1: the city without its neon - the frame rate's before)
    if (typeof location !== 'undefined' && /[?&]noneon=1/.test(location.search)) group.visible = false;
    const api = {
      group, signs, blocks, faceMat,
      update(dt, t, camera) {
        const p = camera.position;
        for (const B of blocks) {
          const bb = BU && B.bi >= 0 ? BU.blocks[B.bi] : null;
          const v = Math.hypot(B.mid.x - p.x, B.mid.z - p.z) < SHOW && (!bb || bb.seen !== false);
          if (B._v !== v) { B._v = v; for (const m of B.meshes) m.visible = v; }
          if (!v) continue;
          // the flicker: on, and now and then a stammer (a few short drops)
          for (const f of B.flick) {
            const ph = (t + f.seed) % 7.1;
            let k = 1;
            if (ph < 0.9) { const q = Math.sin(ph * 41 + f.seed) * Math.sin(ph * 17.3); k = q > 0.2 ? 0.08 : 1; }
            if (k !== f.k) { f.k = k; f.fm.color.setScalar(GAIN * k); }
          }
        }
      },
    };
    return api;
  },
  update: (n, dt, t, camera) => n.update(dt, t, camera),
};

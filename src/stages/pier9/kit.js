import * as THREE from 'three';
import { allocInkId } from '../../render/layers.js';
import { mergeGeos, hash } from '../../props/lib.js';

// Pier 9's building kit (lane B6): the shed's materials and a builder that
// tags every piece with its own ink id and the ink's interior surface class
// (render/shaders/idpass.js: plaster, wood, metal, lit ...).
// Tone (as the diner, props/diner/kit.js): the room's light is the stage's
// hemisphere, low inside (the interior Look's ambient), plus the hanging
// lamps' pooled spot lights. An albedo of sRGB 0x18..0x22 prints black in
// the dark and paper white in a pool; the floor planks a shade lighter so a
// pool on them prints as a white disc with the boards running through it.
export const hex = (h) => new THREE.Color(h);

// ---- canvas maps ------------------------------------------------------------------------
// the deck's planks: long boards running north-south, their seams, knots,
// oil stains where the trucks stand; one map repeated in world metres
function plankMap(W = 512, H = 1024, { boards = 8, light = 44, seam = 10 } = {}) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = `rgb(${light},${light},${light})`; g.fillRect(0, 0, W, H);
  const bw = W / boards;
  for (let b = 0; b < boards; b++) {
    // each board its own value, a little
    const v = light + Math.round((hash(b, 3) - 0.5) * 14);
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(b * bw, 0, bw, H);
    // butt joints at staggered lengths
    for (let y = hash(b, 5) * 300; y < H; y += 260 + hash(b, Math.floor(y)) * 200) {
      g.fillStyle = `rgba(${seam},${seam},${seam},0.9)`; g.fillRect(b * bw, y, bw, 3);
    }
    // grain: long faint streaks
    for (let k = 0; k < 26; k++) {
      const x = b * bw + hash(b * 31 + k, 7) * bw, y = hash(b * 31 + k, 8) * H, L = 60 + hash(b * 31 + k, 9) * 240;
      const d = Math.round((hash(b * 31 + k, 10) - 0.5) * 18);
      g.strokeStyle = `rgba(${light + d},${light + d},${light + d},0.5)`; g.lineWidth = 1 + hash(k, b) * 1.5;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (hash(k, 11) - 0.5) * 4, y + L); g.stroke();
    }
    // the seam between boards
    g.fillStyle = `rgba(${seam},${seam},${seam},1)`; g.fillRect(b * bw, 0, 3, H);
  }
  // oil and water stains: soft dark blotches
  for (let i = 0; i < 26; i++) {
    const x = hash(i, 21) * W, y = hash(i, 22) * H, r = 20 + hash(i, 23) * 70;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(10,10,10,${0.25 + hash(i, 24) * 0.35})`); gr.addColorStop(1, 'rgba(10,10,10,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}

// the walls: vertical boards, weathered, a dark seam every 0.2 m
function boardMap(W = 256, H = 256) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = 'rgb(34,34,34)'; g.fillRect(0, 0, W, H);
  const n = 8, bw = W / n;
  for (let b = 0; b < n; b++) {
    const v = 30 + Math.round(hash(b, 41) * 14);
    g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(b * bw, 0, bw, H);
    for (let k = 0; k < 10; k++) {
      const x = b * bw + hash(b * 17 + k, 42) * bw, d = Math.round((hash(b * 17 + k, 43) - 0.5) * 16);
      g.strokeStyle = `rgba(${v + d},${v + d},${v + d},0.6)`; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (hash(k, 44) - 0.5) * 6, H); g.stroke();
    }
    g.fillStyle = 'rgb(6,6,6)'; g.fillRect(b * bw, 0, 3, H);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}

let MATS = null;
export function pierMats() {
  if (MATS) return MATS;
  const std = (name, color, roughness, surface, extra = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });
    m.name = 'pier_' + name;
    if (surface) m.userData.inkSurface = surface;
    return m;
  };
  const glow = (name, v, extra = {}) => {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(v, v, v), ...extra });
    m.name = 'pier_' + name;
    m.userData.inkSurface = 'lit';
    return m;
  };
  const planks = plankMap();
  planks.repeat.set(1 / 3.2, 1 / 6.4);
  const boards = boardMap();
  MATS = {
    std, glow,
    floor: std('floor', 0xffffff, 0.86, 'wood', { map: planks }),
    wall: std('wall', 0xffffff, 0.92, 'wood', { map: boards }),
    wallOut: std('wallOut', 0xffffff, 0.8, 'wood', { map: boards }),
    roof: std('roof', 0x0c0c0c, 0.9, 'wood'),
    iron: std('iron', 0x101010, 0.5, 'metal'),
    ironDark: std('ironDark', 0x080808, 0.6, 'metal'),
    crate: std('crate', 0xffffff, 0.85, 'wood', { vertexColors: true }),
    crateDark: std('crateDark', 0x161616, 0.85, 'wood'),
    canvas: std('canvas', 0x141414, 0.95, 'cloth'),
    rope: std('rope', 0x1c1c1c, 0.95, 'cloth'),
    timber: std('timber', 0x1e1e1e, 0.8, 'wood'),
    plankDoor: std('plankDoor', 0x262626, 0.85, 'wood', { map: boards }),
    concrete: std('concrete', 0x2a2a2a, 0.9, 'plaster'),
    paint: std('paint', 0x1a1a1a, 0.55, 'enamel'),
    black: std('black', 0x050505, 0.9, 'cloth'),
    tyre: std('tyre', 0x070707, 0.8, 'cloth'),
    glassDark: std('glassDark', 0x0c0c0c, 0.1, 'metal'),
    blind: std('blind', 0x303030, 0.8, 'plaster'),
    officeWall: std('officeWall', 0x1c1c1c, 0.9, 'plaster'),
    officeLit: glow('officeLit', 1.6),
    officeGlow: glow('officeGlow', 0.55),
    letter: std('letter', 0x7a7a7a, 0.8, 'plaster'),
    bulb: glow('bulb', 9),
    bulbDim: glow('bulbDim', 4),
    lampInner: glow('lampInner', 0.3, { side: THREE.DoubleSide }),
    shade: std('shade', 0x0a0a0a, 0.4, 'enamel', { side: THREE.DoubleSide }),
    hull: std('hull', 0x0a0a0a, 0.7, 'metal'),
  };
  return MATS;
}

// the builder: meshes into a group with the current ink id; piece() starts
// a new id (a new thing: a contour against its neighbours)
export function makeKit(stage, g) {
  let id = allocInkId();
  const kit = {
    stage, g, M: pierMats(),
    piece() { id = allocInkId(); return id; },
    get id() { return id; },
    add(geo, mat, { cast = true, receive = true, parent = g, name = null, noRay = false, figure = false } = {}) {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = cast; m.receiveShadow = receive;
      m.userData.inkId = id;
      if (mat.userData && mat.userData.inkSurface) m.userData.inkSurface = mat.userData.inkSurface;
      if (noRay) m.userData.noRay = true;
      if (figure) m.userData.inkFigure = true;
      if (name) m.name = name;
      parent.add(m);
      return m;
    },
    addMerged(list, mat, opts) { return list.length ? kit.add(mergeGeos(list, { uv: !!mat.map, color: !!mat.vertexColors }), mat, opts) : null; },
    box(x0, x1, y0, y1, z0, z1) { return new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); },
  };
  return kit;
}

// world-metre uvs on a box-ish geometry: each face mapped by its dominant
// normal axis (u along the face, v up), `s` metres per repeat
export function worldUV(geo, s = 1) {
  const P = geo.getAttribute('position'), N = geo.getAttribute('normal');
  const uv = new Float32Array(P.count * 2);
  for (let i = 0; i < P.count; i++) {
    const nx = Math.abs(N.getX(i)), ny = Math.abs(N.getY(i)), nz = Math.abs(N.getZ(i));
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    let u, v;
    if (ny >= nx && ny >= nz) { u = x; v = z; } else if (nx >= nz) { u = z; v = y; } else { u = x; v = y; }
    uv[i * 2] = u / s; uv[i * 2 + 1] = v / s;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

// a grey per vertex (the crates' values, one per crate)
export function paint(geo, v) {
  const n = geo.getAttribute('position').count;
  const c = new Float32Array(n * 3);
  const col = new THREE.Color().setRGB(v, v, v, THREE.SRGBColorSpace);
  for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}

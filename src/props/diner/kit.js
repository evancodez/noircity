import * as THREE from 'three';
import { allocInkId } from '../../render/layers.js';
import { mergeGeos } from '../lib.js';

// The diner's building kit (parts/diner.js builds the room with it; lane 5).
// Tone: the room's light is the stage's flat hemisphere (albedo is tone:
// sRGB 0x18 prints black, 0x28..0x40 dark-grey washes) plus the pendants'
// pooled spot lights (paper white wherever a pool falls). Every mesh is
// tagged with the ink's interior surface class (userData.inkSurface: lane
// 1's calm washes) and gets an ink id per piece of furniture.
export const hex = (h) => new THREE.Color(h);

let MATS = null;
export function roomMats() {
  if (MATS) return MATS;
  const std = (name, color, roughness, surface, extra = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });
    m.name = 'diner_' + name;
    m.userData.inkSurface = surface;
    return m;
  };
  const glow = (name, v, extra = {}) => {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(v, v, v), ...extra });
    m.name = 'diner_' + name;
    // (a lit panel prints its own flat light: the ink's 'lit' class)
    m.userData.inkSurface = 'lit';
    return m;
  };
  MATS = {
    std, glow,
    ceil: std('ceil', 0x0b0b0b, 1.0, 'plaster'),
    plaster: std('plaster', 0xffffff, 0.95, 'plaster', { vertexColors: true }),
    panel: std('panel', 0x101010, 0.62, 'wood'),
    panelStile: std('panelStile', 0x181818, 0.55, 'wood'),
    rail: std('rail', 0x262626, 0.45, 'wood'),
    counterFront: std('counterFront', 0x0d0d0d, 0.55, 'wood'),
    counterTop: std('counterTop', 0x222222, 0.42, 'enamel'),
    steel: std('steel', 0x141414, 0.18, 'metal'),
    brass: std('brass', 0x151515, 0.22, 'metal'),
    cabinet: std('cabinet', 0x0e0e0e, 0.6, 'wood'),
    shelf: std('shelf', 0x1c1c1c, 0.5, 'wood'),
    booth: std('booth', 0x0b0b0b, 0.58, 'cloth'),
    boothFrame: std('boothFrame', 0x141414, 0.5, 'wood'),
    tableTop: std('tableTop', 0x1a1a1a, 0.4, 'enamel'),
    black: std('black', 0x050505, 0.9, 'cloth'),
    enamelDark: std('enamelDark', 0x0a0a0a, 0.5, 'enamel'),
    iron: std('iron', 0x121212, 0.4, 'metal'),
    cloth: std('cloth', 0x151515, 0.9, 'cloth'),
    frame: std('frame', 0x2c2c2c, 0.5, 'wood'),
    kitchen: glow('kitchen', 0.32, { vertexColors: true }),
    kitchenDark: std('kitchenDark', 0x0a0a0a, 0.8, 'plaster'),
    mirror: glow('mirror', 1.0, { vertexColors: true }),
    // (polish: the shade's inside a lit grey round the bulb, not paper white)
    lampInner: glow('lampInner', 0.32, { side: THREE.DoubleSide }),
    bulb: glow('bulb', 9),
  };
  return MATS;
}

// a vertical gradient baked into vertex colours: v(y) sRGB-ish grey -> linear
export function paintY(geo, fn) {
  const p = geo.getAttribute('position');
  const c = new Float32Array(p.count * 3);
  const col = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const v = fn(p.getY(i), p.getX(i), p.getZ(i));
    col.setRGB(v, v, v, THREE.SRGBColorSpace);
    c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}

// the builder: meshes into a group with the current ink id; `piece()`
// starts a new id (a new piece of furniture: a contour against its
// neighbours)
export function makeKit(stage, g) {
  let id = allocInkId();
  const kit = {
    stage, g, M: roomMats(),
    piece() { id = allocInkId(); return id; },
    get id() { return id; },
    add(geo, mat, { cast = true, receive = true, parent = g, name = null, noRay = false } = {}) {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = cast; m.receiveShadow = receive;
      m.userData.inkId = id;
      if (mat.userData && mat.userData.inkSurface) m.userData.inkSurface = mat.userData.inkSurface;
      if (noRay) m.userData.noRay = true;
      if (name) m.name = name;
      parent.add(m);
      return m;
    },
    // many geometries of one material as one mesh
    addMerged(list, mat, opts) { return list.length ? kit.add(mergeGeos(list, { uv: !!mat.map, color: !!mat.vertexColors }), mat, opts) : null; },
    // a box from its extents
    box(x0, x1, y0, y1, z0, z1) { return new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); },
  };
  return kit;
}

import * as THREE from 'three';
import { lathe, merge, tube, V3, roundedBox } from '../../world/geom.js';
import { PAVE } from '../../world/plan.js';

// NOIR CITY's street kit (lane O1): the pavements and their kerb stones, the
// lamp posts, the furniture. Pieces are geometries in world space (the
// stream part merges them a chunk at a time, one mesh a material).
//   paveGeo(pts)                   a convex pavement slab's top at PAVE
//   kerbGeos(pts, kerbSides)       its kerb stones (only on the sides that face a road)
//   LAMP: { iron, shade, bulb, head }   the gooseneck post's pieces (local: the
//                                  arm along +x), placeLamp(geo, lamp) puts one
//   propGeo(kind)                  a hydrant, a bin, a call box (local, origin at the base)

export function paveGeo(P) {
  const pos = [];
  for (let i = 1; i + 1 < P.length; i++) pos.push(P[0][0], PAVE, P[0][1], P[i][0], PAVE, P[i][1], P[i + 1][0], PAVE, P[i + 1][1]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  // (the face looks up: flip where it does not)
  const p = g.getAttribute('position').array;
  for (let i = 0; i < p.length; i += 9) {
    const ux = p[i + 3] - p[i], uz = p[i + 5] - p[i + 2], vx = p[i + 6] - p[i], vz = p[i + 8] - p[i + 2];
    if (uz * vx - ux * vz < 0) for (let k = 0; k < 3; k++) { const t = p[i + 3 + k]; p[i + 3 + k] = p[i + 6 + k]; p[i + 6 + k] = t; }
  }
  g.computeVertexNormals();
  return g;
}

export function kerbGeos(P, sides) {
  const out = [];
  const s = polySign(P);
  for (let e = 0; e < P.length; e++) {
    if (sides && !sides[e]) continue;
    const a = P[e], b = P[(e + 1) % P.length];
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
    if (L < 0.3) continue;
    // (inward: the kerb stone lies inside the slab's edge)
    const nx = (-dz / L) * s, nz = (dx / L) * s;
    const g = new THREE.BoxGeometry(L, PAVE + 0.02, 0.24);
    g.rotateY(Math.atan2(-dz, dx));
    g.translate((a[0] + b[0]) / 2 + nx * 0.12, (PAVE + 0.02) / 2 - 0.02, (a[1] + b[1]) / 2 + nz * 0.12);
    out.push(g);
  }
  return out;
}
function polySign(P) { let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; } return a >= 0 ? 1 : -1; }

// ---- the lamp post (the city's lighter build of the block's gooseneck) -------------------------------
export const LAMP = (() => {
  const base = lathe([
    [0, 0], [0.3, 0], [0.3, 0.1], [0.25, 0.16], [0.23, 0.5], [0.17, 0.6], [0.17, 0.88], [0.13, 0.96],
    [0.1, 1.04], [0.085, 2.6], [0.105, 2.64], [0.105, 2.74], [0.08, 2.78], [0.068, 4.9], [0.09, 4.95],
    [0.09, 5.05], [0.065, 5.1], [0.06, 5.6], [0.075, 5.66], [0.04, 5.8], [0, 5.86],
  ], 12);
  const arm = tube([V3(0, 5.0, 0), V3(0, 5.55, 0), V3(0.1, 6.02, 0), V3(0.42, 6.3, 0), V3(0.9, 6.34, 0), V3(1.26, 6.2, 0), V3(1.46, 5.98, 0)], 0.042, 6, 28);
  const sc = [];
  for (let i = 0; i <= 20; i++) { const t = i / 20, a = Math.PI + t * Math.PI * 2.6, r = 0.3 * (1 - t * 0.78); sc.push(V3(0.36 + Math.cos(a) * r, 5.72 + Math.sin(a) * r * 0.9, 0)); }
  const scroll = tube(sc, 0.016, 4, 30);
  const shade = lathe([[0.03, 0.12], [0.07, 0.08], [0.12, 0.0], [0.24, -0.12], [0.36, -0.24], [0.43, -0.3], [0.44, -0.33], [0.41, -0.33]], 18).translate(1.46, 5.96, 0);
  const bulb = new THREE.CircleGeometry(0.35, 20).rotateX(Math.PI / 2).translate(1.46, 5.96 - 0.29, 0);
  return { iron: merge([base, arm, scroll]), shade, bulb, head: V3(1.46, 5.64, 0) };
})();
// a piece of the post (local) at a lamp's place (yaw: the arm's heading, Lamps.addPost's)
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _y = new THREE.Vector3(0, 1, 0), _s = new THREE.Vector3(1, 1, 1);
export function placeLamp(geo, l) {
  _q.setFromAxisAngle(_y, l.yaw);
  _m.compose(new THREE.Vector3(l.x, PAVE, l.z), _q, _s);
  return geo.clone().applyMatrix4(_m);
}
// the head (the shade's mouth) of a lamp, in the world
export function lampHead(l, out = new THREE.Vector3()) {
  _q.setFromAxisAngle(_y, l.yaw);
  return out.copy(LAMP.head).applyQuaternion(_q).add(new THREE.Vector3(l.x, PAVE, l.z));
}

// ---- the furniture ---------------------------------------------------------------------------------------
const PROPS = {
  // a telegraph pole (the Yards'): its crossbar across the street (local z), its insulators
  pole: () => merge([
    new THREE.CylinderGeometry(0.11, 0.16, 9.0, 7).translate(0, 4.5, 0),
    new THREE.BoxGeometry(0.13, 0.13, 2.4).translate(0, 8.3, 0),
    ...[-0.95, 0, 0.95].map((k) => new THREE.CylinderGeometry(0.05, 0.06, 0.2, 6).translate(0, 8.46, k)),
  ]),
  hydrant: () => merge([
    lathe([[0, 0], [0.17, 0], [0.17, 0.06], [0.13, 0.1], [0.12, 0.55], [0.15, 0.58], [0.15, 0.64], [0.1, 0.7], [0.06, 0.78], [0, 0.8]], 16),
    new THREE.CylinderGeometry(0.05, 0.05, 0.36, 10).rotateZ(Math.PI / 2).translate(0, 0.45, 0),
  ]),
  bin: () => merge([
    lathe([[0, 0], [0.26, 0], [0.28, 0.85], [0.3, 0.88], [0.3, 0.92], [0, 0.94]], 18),
  ]),
  callbox: () => merge([
    roundedBox(0.42, 1.25, 0.32, 0.04, 2).translate(0, 0.62 + 0.7, 0),
    new THREE.CylinderGeometry(0.07, 0.09, 0.7, 10).translate(0, 0.35, 0),
    roundedBox(0.5, 0.08, 0.4, 0.03, 2).translate(0, 2.0, 0),
  ]),
};
PROPS.bench = () => merge([
  roundedBox(1.7, 0.07, 0.42, 0.02, 2).translate(0, 0.46, 0),
  roundedBox(1.7, 0.36, 0.06, 0.02, 2).rotateX(-0.18).translate(0, 0.72, -0.22),
  ...[-0.72, 0.72].map((x) => new THREE.BoxGeometry(0.06, 0.46, 0.4).translate(x, 0.23, 0)),
]);
PROPS.newsstand = () => merge([
  roundedBox(1.6, 1.7, 1.0, 0.04, 2).translate(0, 0.85, 0),
  new THREE.BoxGeometry(1.9, 0.08, 1.3).rotateX(0.12).translate(0, 1.95, 0.08),
  new THREE.BoxGeometry(1.4, 0.5, 0.25).rotateX(-0.5).translate(0, 1.0, 0.6),
]);
PROPS.stop = () => merge([
  new THREE.CylinderGeometry(0.05, 0.06, 2.7, 8).translate(0, 1.35, 0),
  new THREE.CylinderGeometry(0.28, 0.28, 0.04, 20).rotateX(Math.PI / 2).translate(0, 2.5, 0.04),
]);
PROPS.stall = () => merge([
  roundedBox(2.6, 0.9, 1.0, 0.03, 2).translate(0, 0.45, 0),
  ...[[-1.25, -0.45], [1.25, -0.45], [-1.25, 0.45], [1.25, 0.45]].map(([x, z]) => new THREE.BoxGeometry(0.06, 2.2, 0.06).translate(x, 1.1, z)),
  new THREE.BoxGeometry(2.9, 0.05, 1.5).rotateX(0.25).translate(0, 2.25, 0.2),
  ...[-0.8, 0, 0.8].map((x) => new THREE.BoxGeometry(0.62, 0.22, 0.42).translate(x, 1.0, 0.15)),
]);
// a street-name post: its two blades (a name each, the one along the street it names)
PROPS.namepost = () => merge([
  new THREE.CylinderGeometry(0.045, 0.06, 2.95, 8).translate(0, 1.47, 0),
  new THREE.SphereGeometry(0.07, 8, 6).translate(0, 2.97, 0),
]);

// the street names' atlas: every name, pale capitals on black enamel (a cell each)
let NAMES = null;
export function nameAtlas(names) {
  if (NAMES) return NAMES;
  const W = 1024, cw = 256, ch = 44, cols = W / cw;
  const c = document.createElement('canvas'); c.width = W; c.height = Math.max(64, Math.ceil(names.length / cols) * ch);
  const g = c.getContext('2d');
  g.fillStyle = '#060606'; g.fillRect(0, 0, c.width, c.height);
  const uv = new Map();
  names.forEach((n, i) => {
    const x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
    g.strokeStyle = '#8a877f'; g.lineWidth = 2; g.strokeRect(x + 3, y + 3, cw - 6, ch - 6);
    g.fillStyle = '#d6d2c6'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const fs = Math.min(26, (cw - 16) / (n.length * 0.62));
    g.font = `700 ${fs}px "Avenir Next Condensed", "Arial Narrow", sans-serif`;
    g.fillText(n, x + cw / 2, y + ch / 2 + 1);
    uv.set(n, [x / W, 1 - (y + ch) / c.height, (x + cw) / W, 1 - y / c.height]);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  NAMES = { tex, uv, mat: new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color().setScalar(0.6) }) };
  return NAMES;
}
// a name post's blades as faces with the atlas' uvs: [{ geo (with uv) }] and its iron
export function nameBlades(p, A) {
  const faces = [], iron = [];
  const blade = (name, along, y) => {
    // (a blade along x names an east-west street; along z, a north-south one)
    const yaw = along === 'x' ? 0 : Math.PI / 2;
    iron.push(new THREE.BoxGeometry(1.25, 0.24, 0.05).rotateY(yaw).translate(p.x, PAVE + y, p.z));
    const uv = A.uv.get(name);
    if (!uv) return;
    for (const s of [1, -1]) {
      const f = new THREE.PlaneGeometry(1.2, 0.2);
      const U = f.getAttribute('uv');
      for (let i = 0; i < U.count; i++) U.setXY(i, U.getX(i) ? uv[2] : uv[0], U.getY(i) ? uv[3] : uv[1]);
      f.rotateY(yaw + (s > 0 ? 0 : Math.PI)).translate(p.x + (along === 'x' ? 0 : s * 0.03), PAVE + y, p.z + (along === 'x' ? s * 0.03 : 0));
      faces.push(f);
    }
  };
  blade(p.names[0], 'z', 2.68);
  blade(p.names[1], 'x', 2.4);
  iron.push(placeProp('namepost', p));
  return { faces, iron };
}

const CACHE = new Map();
export function propGeo(kind) {
  if (!CACHE.has(kind)) CACHE.set(kind, (PROPS[kind] || PROPS.bin)());
  return CACHE.get(kind);
}
export function placeProp(kind, p) {
  _q.setFromAxisAngle(_y, p.yaw || 0);
  _m.compose(new THREE.Vector3(p.x, p.road ? 0 : PAVE, p.z), _q, _s);
  // (in the road: a manhole's lid, a length of the tram's rail - flush, a glint in the wet)
  if (kind === 'manhole') return new THREE.CylinderGeometry(0.42, 0.42, 0.024, 16).translate(0, 0.006, 0).applyMatrix4(_m);
  if (kind === 'rail') return new THREE.BoxGeometry(p.len, 0.02, 0.075).translate(0, 0.004, 0).applyMatrix4(_m);
  return propGeo(kind).clone().applyMatrix4(_m);
}

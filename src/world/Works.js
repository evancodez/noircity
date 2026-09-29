import * as THREE from 'three';
import { lathe, merge, roundedBox, tube, catenaryPoints, V3 } from './geom.js';

// Builders for the things that close the block (stages/block/parts/bounds.js):
// works vehicles, road-works kit, fences. Each returns { key: BufferGeometry[] }
// in its own frame (origin on the ground, +z its front, +x its right), for
// the caller to place and merge by material. Smooth where the eye comes
// close (lathed tyres and lanterns, bevelled boxes), plain where it cannot.

export const B = (w, h, d, x, y, z, r = 0.03, seg = 2) => roundedBox(w, h, d, Math.min(r, w * 0.45, h * 0.45, d * 0.45), seg).translate(x, y, z);
const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

// a tyre + hub, axis along x, centred at (x, y, z)
export function wheel(r, w, x, y, z, segs = 28) {
  const t = lathe([
    [r * 0.55, -w / 2], [r * 0.9, -w / 2], [r * 0.98, -w * 0.38], [r, -w * 0.15], [r, w * 0.15], [r * 0.98, w * 0.38], [r * 0.9, w / 2], [r * 0.55, w / 2],
  ], segs).rotateZ(Math.PI / 2).translate(x, y, z);
  const hub = lathe([[0, 0], [r * 0.56, 0], [r * 0.5, 0.03], [r * 0.25, 0.06], [r * 0.12, 0.08], [0, 0.085]], 20);
  hub.rotateZ(-Math.PI / 2 * Math.sign(x || 1)).translate(x + Math.sign(x || 1) * w * 0.35, y, z);
  return { rubber: [t], hub: [hub] };
}

// a pontoon fender over a wheel: an arc band, bevelled, along x
function fender(r, w, x, y, z, a0 = 0.15, a1 = Math.PI - 0.15, drop = 0) {
  const s = new THREE.Shape();
  const n = 20, ro = r + 0.12, ri = r + 0.04;
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; const p = [Math.cos(a) * ro, Math.sin(a) * ro]; if (i === 0) s.moveTo(p[0], p[1] - drop); else s.lineTo(p[0], p[1]); }
  for (let i = n; i >= 0; i--) { const a = a0 + (a1 - a0) * i / n; s.lineTo(Math.cos(a) * ri, Math.sin(a) * ri - (i === 0 ? drop : 0)); }
  const g = new THREE.ExtrudeGeometry(s, { depth: w - 0.06, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 4 });
  g.translate(0, 0, -(w - 0.06) / 2).rotateY(Math.PI / 2).translate(x, y, z);
  return g;
}

// A 1930s flatbed truck: long hood, rounded cab, pontoon fenders, a timber
// bed with stake sides and a tailboard. 6.4 m long, 2.2 wide.
export function flatbed({ load = null } = {}) {
  const P = { paint: [], rubber: [], hub: [], glass: [], wood: [], iron: [], chrome: [] };
  const add = (k, g) => P[k].push(g);
  const R = 0.48;
  // chassis rails
  for (const sx of [-0.45, 0.45]) add('iron', box(0.12, 0.18, 6.0, sx, 0.62, -0.2));
  // wheels: front singles, rear duals
  for (const [z, dual] of [[2.05, false], [-1.75, true]]) for (const sx of [-1, 1]) {
    const offs = dual ? [0.78, 1.02] : [0.9];
    for (const o of offs) { const w = wheel(R, 0.22, sx * o, R, z); P.rubber.push(...w.rubber); P.hub.push(...w.hub); }
  }
  // hood, radiator shell and grille bars
  add('paint', B(0.98, 0.72, 1.55, 0, 1.2, 2.25, 0.12, 3));
  add('paint', B(1.02, 1.0, 0.16, 0, 1.12, 3.05, 0.1, 3));
  for (let i = -3; i <= 3; i++) add('chrome', box(0.02, 0.7, 0.03, i * 0.1, 1.12, 3.14));
  // front fenders (with the running board sweeping back) and the rear ones
  for (const sx of [-1, 1]) {
    add('paint', fender(R, 0.42, sx * 0.9, R, 2.05, 0.1, Math.PI - 0.05, 0.1));
    add('paint', B(0.34, 0.05, 1.6, sx * 0.95, 0.52, 0.65, 0.02));
    add('paint', fender(R, 0.62, sx * 0.9, R, -1.75, 0.05, Math.PI - 0.05, 0));
    // headlamp on its stalk
    const hl = lathe([[0, 0], [0.11, 0.0], [0.13, 0.05], [0.12, 0.13], [0.07, 0.17], [0, 0.18]], 20).rotateX(Math.PI / 2).translate(sx * 0.62, 1.42, 3.0);
    add('paint', hl);
    add('iron', box(0.04, 0.3, 0.04, sx * 0.62, 1.22, 2.95));
  }
  // cab: body, rounded roof, windows
  add('paint', B(1.9, 1.05, 1.45, 0, 1.25, 0.8, 0.08, 3));
  add('paint', B(1.86, 0.62, 1.38, 0, 2.02, 0.78, 0.22, 4));
  add('glass', box(1.5, 0.42, 0.02, 0, 2.02, 1.48));
  for (const sx of [-1, 1]) add('glass', box(0.02, 0.4, 0.9, sx * 0.94, 2.02, 0.85));
  add('glass', box(1.3, 0.34, 0.02, 0, 2.02, 0.08));
  // the bed: planks, cross members, stake pockets, stakes and rails, the
  // tailboard (down on its chains if `load` says so)
  add('wood', box(2.2, 0.1, 3.7, 0, 1.0, -1.5));
  for (const sx of [-1, 1]) {
    for (const z of [0.2, -0.9, -2.0, -3.25]) add('wood', box(0.08, 0.72, 0.08, sx * 1.06, 1.41, z));
    for (const y of [1.3, 1.68]) add('wood', box(0.05, 0.12, 3.6, sx * 1.08, y, -1.5));
  }
  add('wood', box(2.18, 0.72, 0.07, 0, 1.41, 0.26));
  add('wood', box(2.1, 0.6, 0.07, 0, 1.36, -3.36));
  add('iron', box(2.1, 0.04, 0.04, 0, 1.64, -3.4));
  if (load === 'pipes') {
    for (let i = 0; i < 3; i++) add('iron', new THREE.CylinderGeometry(0.34, 0.34, 3.2, 20, 1, true).rotateX(Math.PI / 2).translate(-0.62 + i * 0.62, 1.4, -1.6));
  }
  return P;
}

// A panel van: short hood, tall box body, rear doors.
export function van() {
  const P = { paint: [], rubber: [], hub: [], glass: [], iron: [], chrome: [] };
  const add = (k, g) => P[k].push(g);
  const R = 0.42;
  for (const [z] of [[1.55], [-1.6]]) for (const sx of [-1, 1]) { const w = wheel(R, 0.22, sx * 0.82, R, z); P.rubber.push(...w.rubber); P.hub.push(...w.hub); }
  add('paint', B(0.9, 0.62, 1.1, 0, 1.08, 1.95, 0.12, 3));
  add('paint', B(0.94, 0.86, 0.14, 0, 1.0, 2.5, 0.1, 3));
  for (const sx of [-1, 1]) {
    add('paint', fender(R, 0.36, sx * 0.82, R, 1.55, 0.1, Math.PI - 0.05, 0.08));
    add('paint', fender(R, 0.36, sx * 0.82, R, -1.6, 0.05, Math.PI - 0.05, 0));
    add('paint', B(0.3, 0.05, 1.8, sx * 0.9, 0.45, 0.0, 0.02));
  }
  add('paint', B(1.84, 1.95, 3.9, 0, 1.55, -0.3, 0.16, 4));
  add('glass', box(1.4, 0.4, 0.02, 0, 1.95, 1.62));
  for (const sx of [-1, 1]) add('glass', box(0.02, 0.38, 0.55, sx * 0.93, 1.95, 1.2));
  add('chrome', box(0.03, 0.6, 0.04, 0.3, 1.4, -2.27));
  add('iron', box(0.01, 1.7, 0.02, 0, 1.5, -2.27));
  return P;
}

// A timber sawhorse barricade, 2.4 m: two A-frames and a top board.
export function sawhorse(len = 2.4) {
  const P = { wood: [], iron: [] };
  P.wood.push(B(0.05, 0.26, len, 0, 1.02, 0, 0.012));
  P.wood.push(B(0.05, 0.18, len * 0.9, 0.1, 0.55, 0, 0.012));
  for (const z of [-len / 2 + 0.2, len / 2 - 0.2]) for (const s of [-1, 1]) {
    const leg = B(0.07, 1.2, 0.07, 0, 0, 0, 0.01).rotateZ(s * 0.28).translate(s * 0.17, 0.56, z);
    P.wood.push(leg);
  }
  return P;
}

// A storm lantern: a glass globe (lit), wire guard, cap and bail. Origin
// at the bail's top; the globe's centre is returned for the light.
export function lantern() {
  const P = { iron: [], glow: [] };
  P.glow.push(lathe([[0, -0.3], [0.05, -0.29], [0.075, -0.24], [0.08, -0.2], [0.07, -0.15], [0.045, -0.12], [0, -0.115]], 18));
  P.iron.push(lathe([[0.0, -0.32], [0.08, -0.32], [0.085, -0.3], [0.05, -0.29], [0.0, -0.29]], 18));
  P.iron.push(lathe([[0.0, -0.08], [0.03, -0.085], [0.06, -0.11], [0.055, -0.12], [0.0, -0.12]], 18));
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + 0.4;
    const pts = [V3(Math.cos(a) * 0.05, -0.12, Math.sin(a) * 0.05), V3(Math.cos(a) * 0.088, -0.2, Math.sin(a) * 0.088), V3(Math.cos(a) * 0.08, -0.3, Math.sin(a) * 0.08)];
    P.iron.push(tube(pts, 0.004, 4, 8));
  }
  P.iron.push(new THREE.TorusGeometry(0.06, 0.004, 4, 16, Math.PI).translate(0, -0.08, 0));
  return { parts: P, globe: V3(0, -0.2, 0) };
}

// A timber hoarding along +z from 0 to len: posts, a rail, vertical
// boards of uneven height. Returns boards and the bill rectangles.
export function hoarding(len, h, rng) {
  const P = { wood: [] };
  const bills = [];
  let z = 0;
  while (z < len - 0.01) {
    const w = Math.min(len - z, rng.range(0.17, 0.26));
    const bh = h + rng.range(-0.12, 0.06);
    P.wood.push(box(0.035, bh, w - 0.012, 0, bh / 2, z + w / 2).rotateZ(rng.range(-0.004, 0.004)));
    z += w;
  }
  for (let p = 0; p <= len; p += 2.4) P.wood.push(box(0.1, h + 0.1, 0.1, -0.07, (h + 0.1) / 2, Math.min(p, len - 0.05)));
  for (const y of [0.35, h - 0.35]) P.wood.push(box(0.06, 0.1, len, -0.05, y, len / 2));
  // bills: a few rectangles, some overlapping, some half torn away
  let bz = rng.range(0.3, 1.2);
  while (bz < len - 0.8) {
    const w = rng.range(0.55, 0.95), bh = w * rng.range(1.2, 1.5);
    bills.push({ z: bz + w / 2, y: rng.range(1.0, Math.min(1.6, h - bh / 2 - 0.1)), w, h: bh, torn: rng.next(), seed: rng.next() });
    bz += w + rng.range(-0.15, 1.6);
  }
  return { parts: P, bills };
}

// a canvas of torn bills: grey sheets with bars of type and ragged edges
export function billTexture(rng) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 176;
  const x = c.getContext('2d');
  x.clearRect(0, 0, 128, 176);
  const tone = 150 + rng.int(0, 60);
  x.fillStyle = `rgb(${tone},${tone},${tone})`;
  // ragged outline: the lower part torn away on a slant
  const tear = 90 + rng.range(0, 70);
  x.beginPath(); x.moveTo(2, 2); x.lineTo(126, 2);
  let y = tear + rng.range(-20, 20);
  x.lineTo(126, y);
  for (let u = 126; u > 2; u -= 8) { y += rng.range(-9, 9); x.lineTo(u, Math.min(172, Math.max(40, y))); }
  x.lineTo(2, Math.min(172, tear + rng.range(-10, 30)));
  x.closePath(); x.fill();
  x.globalCompositeOperation = 'source-atop';
  const ink = tone - 110;
  x.fillStyle = `rgb(${ink},${ink},${ink})`;
  x.fillRect(12, 14, 104, 22);                       // a heading
  for (let k = 0; k < 5; k++) x.fillRect(16 + rng.range(0, 10), 46 + k * 14, rng.range(50, 90), 6);
  x.fillRect(30, 124, 68, 16);
  x.globalCompositeOperation = 'source-over';
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// A stack of concrete / iron pipe sections, lying along z (a pyramid).
export function pipeStack(n = 3, r = 0.42, len = 2.6) {
  const P = { iron: [] };
  let row = 0;
  for (let k = n; k > 0; k--, row++) {
    for (let i = 0; i < k; i++) {
      const x = (i - (k - 1) / 2) * r * 2.02;
      const y = r + row * r * 1.72;
      const g = lathe([[r * 0.8, 0], [r, 0], [r, len], [r * 0.8, len]], 24).rotateX(Math.PI / 2).translate(x, y, len / 2);
      P.iron.push(g);
    }
  }
  return P;
}

// A towed air compressor: a rounded hood on two wheels, a drawbar.
export function compressor() {
  const P = { paint: [], rubber: [], hub: [], iron: [] };
  P.paint.push(B(1.1, 0.9, 1.9, 0, 1.05, 0, 0.18, 3));
  P.paint.push(B(1.14, 0.08, 1.96, 0, 0.58, 0, 0.02));
  for (const sx of [-1, 1]) { const w = wheel(0.34, 0.18, sx * 0.62, 0.34, -0.2); P.rubber.push(...w.rubber); P.hub.push(...w.hub); }
  P.iron.push(box(0.06, 0.06, 1.3, 0, 0.45, 1.45));
  P.iron.push(new THREE.CylinderGeometry(0.06, 0.06, 0.3, 12).translate(0, 1.6, -0.5));
  return P;
}

// A tar boiler: a tank on two wheels, its firebox and chimney.
export function tarBoiler() {
  const P = { iron: [], rubber: [], hub: [] };
  P.iron.push(lathe([[0, 0], [0.42, 0], [0.45, 0.05], [0.45, 1.3], [0.42, 1.35], [0, 1.36]], 24).rotateZ(Math.PI / 2).translate(0.68, 0.95, 0));
  P.iron.push(B(1.2, 0.35, 0.8, 0, 0.42, 0, 0.04));
  P.iron.push(new THREE.CylinderGeometry(0.09, 0.11, 1.1, 14).translate(0.4, 1.75, 0));
  P.iron.push(new THREE.CylinderGeometry(0.14, 0.12, 0.08, 14).translate(0.4, 2.3, 0));
  for (const sz of [-1, 1]) { const w = wheel(0.4, 0.12, 0, 0.4, 0); const g = merge([...w.rubber]); g.rotateY(Math.PI / 2).translate(0, 0, sz * 0.52); P.rubber.push(g); }
  P.iron.push(box(0.05, 0.05, 1.4, -0.9, 0.55, 0).rotateY(Math.PI / 2));
  return P;
}

// a chain between two points (a sagging string of links, read as a thin tube)
export function chain(a, b, sag = 0.12) { return tube(catenaryPoints(a, b, sag, 16), 0.012, 5, 32); }

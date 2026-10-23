import * as THREE from 'three';
import { lathe } from '../../../props/lib.js';
import { LETTER_FONT } from '../../../ui/lettering.js';

// The interior kit's furniture (lane O5): each piece drawn into a RoomKit
// (kit.js) in the room's frame, solid where it stands (its collider), in a
// few strokes (the ink's economy: boxes and lathes the brush prints as one
// mass with a lit edge). dir: the way a piece faces ('n' -z, 's' +z, 'w' -x,
// 'e' +x) - a counter's customer side, a shelf's open side.
const D = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] };
export const dirYaw = (d) => ({ s: 0, e: Math.PI / 2, n: Math.PI, w: -Math.PI / 2 }[d] || 0);

// a counter (a bar, the diner's, a shop's): its body, its polished top with
// an overhang on the customer side (dir), a kick plate; solid
export function counter(K, x0, x1, z0, z1, { y = K.FLOOR, h = 1.05, dir = 's', top = 'woodHi', body = 'wood', over = 0.18 } = {}) {
  const [dx, dz] = D[dir];
  K.box(body, x0, x1, y, y + h - 0.05, z0, z1, 1);
  K.box('black', x0 + (dx < 0 ? -0.02 : 0.03), x1 - (dx > 0 ? -0.02 : 0.03), y, y + 0.12, z0 + (dz < 0 ? -0.02 : 0.03), z1 - (dz > 0 ? -0.02 : 0.03), 1);
  K.box(top, x0 + Math.min(0, dx) * over - 0.03, x1 + Math.max(0, dx) * over + 0.03, y + h - 0.05, y + h, z0 + Math.min(0, dz) * over - 0.03, z1 + Math.max(0, dz) * over + 0.03, 1);
  K.solid(x0, x1, z0, z1);
}
// the back bar: a lit mirror behind rows of bottles (the reference's lit
// glass behind black shapes), the shelves, a cabinet under them
export function backBar(K, a0, a1, c, { y = K.FLOOR, dir = 's', rows = 3, lit = 'lit', rng = Math.random, cab = 0.95 } = {}) {
  const [dx, dz] = D[dir];
  const along = dz !== 0, sg = along ? dz : dx;
  // (a: along the wall, q: out from it)
  const B = (p0, p1, ya, yb, q0, q1, key, part = 1) => { const qa = Math.min(q0, q1), qb = Math.max(q0, q1); if (along) K.box(key, p0, p1, ya, yb, qa, qb, part); else K.box(key, qa, qb, ya, yb, p0, p1, part); };
  const qf = c + sg * 0.42;
  B(a0, a1, y, y + cab, c, qf, 'wood');
  if (along) K.solid(a0, a1, Math.min(c, qf), Math.max(c, qf)); else K.solid(Math.min(c, qf), Math.max(c, qf), a0, a1);
  const y0 = y + cab + 0.1, y1 = y0 + rows * 0.42 + 0.1;
  // the lit glass, a hair off the wall
  B(a0 + 0.1, a1 - 0.1, y0, y1, c + sg * 0.02, c + sg * 0.04, lit, 2);
  for (let r = 0; r <= rows; r++) {
    const yy = y0 + r * 0.42;
    B(a0, a1, yy - 0.03, yy, c, c + sg * 0.26, 'wood');
    if (r === rows) break;
    // bottles: black lathes on the shelf, seeded heights
    for (let a = a0 + 0.18; a < a1 - 0.12; a += 0.13 + rng() * 0.12) {
      if (rng() < 0.18) continue;
      const hh = 0.22 + rng() * 0.12, w = 0.035 + rng() * 0.012, q = c + sg * (0.1 + rng() * 0.08);
      const g = lathe([[0.0001, 0], [w, 0], [w, hh * 0.62], [w * 0.4, hh * 0.78], [w * 0.32, hh], [0.0001, hh]], 10);
      K.add('black', along ? g.translate(a, yy, q) : g.translate(q, yy, a), 3);
    }
  }
  B(a0 - 0.05, a1 + 0.05, y1, y1 + 0.12, c, c + sg * 0.3, 'wood');
}
export function stool(K, x, z, { y = K.FLOOR, h = 0.76, solid = true } = {}) {
  K.add('chrome', lathe([[0.0001, 0], [0.2, 0], [0.2, 0.025], [0.04, 0.05], [0.03, h - 0.06], [0.05, h - 0.05], [0.0001, h - 0.05]], 16).translate(x, y, z), 1);
  K.add('leather', lathe([[0.0001, h - 0.06], [0.19, h - 0.06], [0.2, h - 0.01], [0.17, h + 0.03], [0.0001, h + 0.035]], 18).translate(x, y, z), 1);
  if (solid) K.post(x, z, 0.2);
}
export function chair(K, x, z, yaw = 0, { y = K.FLOOR, solid = true, key = 'wood' } = {}) {
  const g = [];
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  for (const [lx, lz] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) { const [px, pz] = at(lx, lz); g.push(new THREE.BoxGeometry(0.04, 0.45, 0.04).translate(px, y + 0.225, pz)); }
  g.push(new THREE.BoxGeometry(0.44, 0.05, 0.44).rotateY(yaw).translate(x, y + 0.47, z));
  const [bx, bz] = at(0, -0.2);
  g.push(new THREE.BoxGeometry(0.44, 0.5, 0.04).rotateY(yaw).translate(bx, y + 0.74, bz));
  for (const q of g) K.add(key, q, 1);
  if (solid) K.post(x, z, 0.24);
}
export function table(K, x, z, { y = K.FLOOR, w = 0.9, d = 0.9, h = 0.76, round = false, key = 'wood', top = 'woodHi', solid = true } = {}) {
  if (round) {
    K.add(top, new THREE.CylinderGeometry(w / 2, w / 2, 0.045, 24).translate(x, y + h - 0.022, z), 1);
    K.add(key, lathe([[0.0001, 0], [0.25, 0], [0.25, 0.03], [0.05, 0.06], [0.04, h - 0.05], [0.0001, h - 0.05]], 14).translate(x, y, z), 1);
    if (solid) K.post(x, z, w / 2);
  } else {
    K.box(top, x - w / 2, x + w / 2, y + h - 0.045, y + h, z - d / 2, z + d / 2, 1);
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) K.box(key, x + a * (w / 2 - 0.06) - 0.03, x + a * (w / 2 - 0.06) + 0.03, y, y + h - 0.045, z + b * (d / 2 - 0.06) - 0.03, z + b * (d / 2 - 0.06) + 0.03, 1);
    if (solid) K.solid(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
  }
}
export function desk(K, x0, x1, z0, z1, { y = K.FLOOR, h = 0.78 } = {}) {
  K.box('woodHi', x0, x1, y + h - 0.05, y + h, z0, z1, 1);
  K.box('wood', x0, x0 + 0.42, y, y + h - 0.05, z0 + 0.03, z1 - 0.03, 1);
  K.box('wood', x1 - 0.42, x1, y, y + h - 0.05, z0 + 0.03, z1 - 0.03, 1);
  K.box('wood', x0 + 0.42, x1 - 0.42, y + 0.25, y + h - 0.05, (z0 + z1) / 2 - 0.01, (z0 + z1) / 2 + 0.01, 1);
  K.solid(x0, x1, z0, z1);
}
export function bench(K, x0, x1, z0, z1, { y = K.FLOOR, h = 0.46, key = 'wood', solid = true } = {}) {
  K.box(key, x0, x1, y + h - 0.05, y + h, z0, z1, 1);
  for (const x of [x0 + 0.08, x1 - 0.12]) K.box(key, x, x + 0.04, y, y + h - 0.05, z0 + 0.04, z1 - 0.04, 1);
  if (solid) K.solid(x0, x1, z0, z1);
}
export function bed(K, x0, x1, z0, z1, { y = K.FLOOR, head = 'n' } = {}) {
  K.box('iron', x0, x1, y + 0.28, y + 0.36, z0, z1, 1);
  K.box('linen', x0 + 0.04, x1 - 0.04, y + 0.36, y + 0.56, z0 + 0.04, z1 - 0.04, 1);
  K.box('cloth', x0 + 0.02, x1 - 0.02, y + 0.5, y + 0.6, (head === 'n' ? z0 + 0.6 : z0), (head === 'n' ? z1 : z1 - 0.6), 1);
  const hz = head === 'n' ? z0 : z1;
  K.box('linen', x0 + 0.15, x1 - 0.15, y + 0.56, y + 0.68, head === 'n' ? z0 + 0.08 : z1 - 0.48, head === 'n' ? z0 + 0.48 : z1 - 0.08, 1);
  for (const x of [x0, x1 - 0.04]) for (const z of [z0, z1 - 0.04]) K.box('iron', x, x + 0.04, y, y + (Math.abs(z - hz) < 0.1 ? 1.1 : 0.7), z, z + 0.04, 1);
  K.box('iron', x0, x1, y + 0.95, y + 1.0, hz - 0.02, hz + 0.02, 1);
  K.solid(x0, x1, z0, z1);
}
// shelves against a wall at z (or x for 'e'/'w'), open toward dir
export function shelves(K, a0, a1, c, { y = K.FLOOR, h = 2.0, dir = 's', n = 4, depth = 0.4, key = 'wood', fill = null, rng = Math.random } = {}) {
  const [dx, dz] = D[dir];
  const along = dz !== 0;
  const box = (p0, p1, ya, yb, q0, q1, k = key) => { if (along) K.box(k, p0, p1, ya, yb, Math.min(q0, q1), Math.max(q0, q1), 1); else K.box(k, Math.min(q0, q1), Math.max(q0, q1), ya, yb, p0, p1, 1); };
  const qf = c + (along ? dz : dx) * depth;
  box(a0, a0 + 0.04, y, y + h, c, qf); box(a1 - 0.04, a1, y, y + h, c, qf);
  box(a0, a1, y, y + h, c, c + (along ? dz : dx) * 0.02);
  for (let i = 0; i <= n; i++) {
    const yy = y + 0.1 + i * (h - 0.15) / n;
    box(a0, a1, yy - 0.025, yy, c, qf);
    if (fill && i < n) for (let a = a0 + 0.12; a < a1 - 0.15; a += 0.18 + rng() * 0.25) { if (rng() < 0.25) continue; const ww = 0.12 + rng() * 0.2, hh = 0.1 + rng() * 0.22; box(a, a + ww, yy, yy + hh, c + (along ? dz : dx) * 0.04, c + (along ? dz : dx) * (depth - 0.06), fill); }
  }
  if (along) K.solid(a0, a1, Math.min(c, qf), Math.max(c, qf)); else K.solid(Math.min(c, qf), Math.max(c, qf), a0, a1);
}
// crates stacked at a point (seeded): solid, a little cover
export function crates(K, x, z, { y = K.FLOOR, n = 3, s = 0.9, rng = Math.random, key = 'wood' } = {}) {
  let top = y;
  for (let i = 0; i < n; i++) {
    const ss = s * (0.85 + rng() * 0.2), ox = (rng() - 0.5) * 0.12, oz = (rng() - 0.5) * 0.12;
    K.box(key, x - ss / 2 + ox, x + ss / 2 + ox, top, top + ss * 0.8, z - ss / 2 + oz, z + ss / 2 + oz, 1);
    K.box('black', x - ss / 2 + ox - 0.01, x + ss / 2 + ox + 0.01, top + ss * 0.38, top + ss * 0.42, z - ss / 2 + oz - 0.01, z + ss / 2 + oz + 0.01, 1);
    top += ss * 0.8;
  }
  K.solid(x - s / 2, x + s / 2, z - s / 2, z + s / 2);
}
export function heavyBag(K, x, z, { y = K.FLOOR, top = null } = {}) {
  const yt = top ?? y + 3.0;
  K.cyl('iron', x, y + 1.85, yt, z, 0.008, 0.008, 4, 2);
  K.add('leather', lathe([[0.0001, 0], [0.15, 0.02], [0.17, 0.12], [0.17, 0.95], [0.15, 1.05], [0.0001, 1.08]], 16).translate(x, y + 0.75, z), 1);
  K.post(x, z, 0.22);
}
// a boxing ring: the platform (its canvas the palest floor), the corner
// posts, three ropes, the steps; it is walked up onto (its floor a surface)
// - the ropes hold a man in, but between the ropes at the steps' corner one
// climbs through
export function ring(K, x0, x1, z0, z1, { y = K.FLOOR, h = 0.62, gap = 's' } = {}) {
  K.box('wood', x0, x1, y, y + h - 0.06, z0, z1, 1);
  K.box('canvas', x0 - 0.15, x1 + 0.15, y + h - 0.06, y + h, z0 - 0.15, z1 + 0.15, 0);
  K.floor(x0 - 0.15, x1 + 0.15, z0 - 0.15, z1 + 0.15, y + h, null);
  for (const [px, pz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) { K.cyl('iron', px, y + h, y + h + 1.35, pz, 0.05, 0.05, 10, 2); K.box('leather', px - 0.08, px + 0.08, y + h + 0.3, y + h + 1.2, pz - 0.08, pz + 0.08, 2); K.post(px, pz, 0.12); }
  for (const yy of [0.45, 0.85, 1.25]) {
    for (const [ax, az, bx, bz, k] of [[x0, z0, x1, z0, 'n'], [x0, z1, x1, z1, 's'], [x0, z0, x0, z1, 'w'], [x1, z0, x1, z1, 'e']]) {
      const L = Math.hypot(bx - ax, bz - az);
      const g = new THREE.CylinderGeometry(0.022, 0.022, L, 6).rotateZ(Math.PI / 2).rotateY(-Math.atan2(bz - az, bx - ax)).translate((ax + bx) / 2, y + h + yy, (az + bz) / 2);
      K.add('rope', g, 2);
      void k;
    }
  }
  return { x0, x1, z0, z1, y: y + h };
}
// a flight of plain steps up to a level (the ring's, a stage's)
export function steps(K, x0, x1, z0, z1, y0, y1, dir) { K.stairs(x0, x1, z0, z1, y0, y1, dir, { key: 'wood' }); }
// a safe: the box, its door (a group of its own on a hinge, swung by the room), a dial
export function safe(K, x, z, yaw = 0, { y = K.FLOOR, s = 0.8 } = {}) {
  const c = Math.cos(yaw), sn = Math.sin(yaw);
  K.add('iron', new THREE.BoxGeometry(s, s * 1.1, s * 0.85).rotateY(yaw).translate(x, y + s * 0.55, z), 1);
  K.post(x, z, s * 0.5);
  // the door: its own mesh on its hinge (the safe's left front edge), in the room's group
  const door = new THREE.Group();
  const hx = x + (-s / 2) * c + (s * 0.43) * sn, hz = z - (-s / 2) * sn + (s * 0.43) * c;
  door.position.copy(K.F.v(hx, y + 0.05, hz));
  door.rotation.y = K.F.yaw(yaw);
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(s - 0.06, s * 1.1 - 0.1, 0.06).translate((s - 0.06) / 2, (s * 1.1 - 0.1) / 2, 0.03), K.mats.iron);
  leaf.userData.inkId = K.id + 2;
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 16).rotateX(Math.PI / 2).translate(s * 0.62, s * 0.55, 0.07), K.mats.chrome);
  dial.userData.inkId = K.id + 3; dial.userData.noRay = true;
  door.add(leaf, dial);
  K.group.add(door);
  K.extra.push(leaf, dial);
  return { door, leaf, x, z, yaw };
}
export function lockers(K, a0, a1, c, { y = K.FLOOR, dir = 's', h = 1.9 } = {}) {
  const [dx, dz] = D[dir];
  const along = dz !== 0;
  const q0 = c, q1 = c + (along ? dz : dx) * 0.45;
  const n = Math.max(1, Math.round((a1 - a0) / 0.4));
  for (let i = 0; i < n; i++) {
    const a = a0 + i * (a1 - a0) / n, b = a + (a1 - a0) / n - 0.015;
    if (along) K.box('iron', a, b, y, y + h, Math.min(q0, q1), Math.max(q0, q1), 1); else K.box('iron', Math.min(q0, q1), Math.max(q0, q1), y, y + h, a, b, 1);
    const vy = y + h - 0.25, f = q1 + (along ? dz : dx) * 0.006;
    for (let k = 0; k < 3; k++) { if (along) K.box('black', a + 0.08, b - 0.08, vy - k * 0.05, vy - k * 0.05 + 0.02, f - 0.003, f + 0.003, 3); else K.box('black', f - 0.003, f + 0.003, vy - k * 0.05, vy - k * 0.05 + 0.02, a + 0.08, b - 0.08, 3); }
  }
  if (along) K.solid(a0, a1, Math.min(q0, q1), Math.max(q0, q1)); else K.solid(Math.min(q0, q1), Math.max(q0, q1), a0, a1);
}
// iron bars from y0 to y1 along a line (a cell's front), solid; gap: [a, b] left open (its barred door is the room's)
export function bars(K, axis, c, a0, a1, { y0 = K.FLOOR, y1 = K.FLOOR + 2.6, gap = null, step = 0.14 } = {}) {
  for (let a = a0 + 0.05; a < a1; a += step) {
    if (gap && a > gap[0] - 0.02 && a < gap[1] + 0.02) continue;
    if (axis === 'x') K.cyl('iron', a, y0, y1, c, 0.016, 0.016, 6, 1); else K.cyl('iron', c, y0, y1, a, 0.016, 0.016, 6, 1);
  }
  for (const yy of [y0 + 0.05, y0 + 1.0, y1 - 0.05]) { if (axis === 'x') K.box('iron', a0, a1, yy - 0.03, yy + 0.03, c - 0.03, c + 0.03, 1); else K.box('iron', c - 0.03, c + 0.03, yy - 0.03, yy + 0.03, a0, a1, 1); }
  const S = (p, q) => { if (q - p < 0.02) return; if (axis === 'x') K.solid(p, q, c - 0.05, c + 0.05); else K.solid(c - 0.05, c + 0.05, p, q); };
  if (gap) { S(a0, gap[0]); S(gap[1], a1); } else S(a0, a1);
}
// a window onto a lit court or the night (a lit pane with its bars), on a wall facing dir
export function litWindow(K, a, y, c, { w = 1.0, h = 1.4, dir = 's', key = 'litDim' } = {}) {
  const [dx, dz] = D[dir];
  const along = dz !== 0;
  const f = c + (along ? dz : dx) * 0.012;
  const B = (p0, p1, ya, yb, k, q = f) => { if (along) K.box(k, p0, p1, ya, yb, q - 0.006, q + 0.006, 2); else K.box(k, q - 0.006, q + 0.006, ya, yb, p0, p1, 2); };
  B(a - w / 2, a + w / 2, y - h / 2, y + h / 2, key);
  const g = c + (along ? dz : dx) * 0.03;
  B(a - 0.025, a + 0.025, y - h / 2, y + h / 2, 'wood', g);
  B(a - w / 2, a + w / 2, y + h * 0.1 - 0.025, y + h * 0.1 + 0.025, 'wood', g);
  B(a - w / 2 - 0.06, a + w / 2 + 0.06, y - h / 2 - 0.08, y - h / 2, 'wood', g);
}
// a sheet on a wall (a poster, a price card, a bounty notice) - its face lettered (K.label) or plain
export function sheet(K, a, y, c, { w = 0.6, h = 0.8, dir = 's', key = 'poster' } = {}) {
  const [dx, dz] = D[dir];
  const along = dz !== 0;
  const f = c + (along ? dz : dx) * 0.01;
  if (along) K.box(key, a - w / 2, a + w / 2, y - h / 2, y + h / 2, f - 0.004, f + 0.004, 3); else K.box(key, f - 0.004, f + 0.004, y - h / 2, y + h / 2, a - w / 2, a + w / 2, 3);
}

// ---- lettering: one atlas a place (a price card, a board, a sign on a door) ------------------------
// K.labels: [{ text, lines, x, y, z, w, h, dir, lit }] -> drawn at finish into one canvas and one mesh
// [O5b] outer: drawn with the place's outside (K.outer: seen from the street with its door shut - the hospital's EMERGENCY)
export function label(K, text, a, y, c, { w = 0.8, h = 0.4, dir = 's', lit = false, dark = false, size = 1, outer = false } = {}) {
  (K.labels || (K.labels = [])).push({ text, a, y, c, w, h, dir, lit, dark, size, outer });
}
export function finishLabels(K) {
  const L = K.labels;
  if (!L || !L.length) return null;
  const PX = 160, W = 1024;
  const rects = []; let x = 2, y = 2, row = 0;
  for (const l of L) { const pw = Math.min(W - 4, Math.round(l.w * PX)), ph = Math.round(l.h * PX); if (x + pw > W - 2) { x = 2; y += row + 4; row = 0; } rects.push([x, y, pw, ph]); x += pw + 4; row = Math.max(row, ph); }
  const H = Math.min(2048, Math.pow(2, Math.ceil(Math.log2(y + row + 4))));
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  const geos = [], outs = [];
  L.forEach((l, i) => {
    const [rx, ry, pw, ph] = rects[i];
    g.save(); g.translate(rx, ry);
    g.fillStyle = l.dark ? '#0d0d0d' : l.lit ? '#e2ded2' : '#9c9890'; g.fillRect(0, 0, pw, ph);
    g.strokeStyle = l.dark ? '#77736a' : '#1a1a1a'; g.lineWidth = Math.max(2, ph * 0.03); g.strokeRect(ph * 0.05, ph * 0.05, pw - ph * 0.1, ph - ph * 0.1);
    g.fillStyle = l.dark ? '#b9b5aa' : '#0d0d0d'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const lines = String(l.text).split('\n');
    const fs = Math.min((ph * 0.8) / lines.length, (pw * 0.9) / (Math.max(...lines.map((s) => s.length)) * 0.6)) * l.size;
    g.font = `700 ${fs}px ${LETTER_FONT}`;
    lines.forEach((s, k) => g.fillText(s, pw / 2, ph / 2 + (k - (lines.length - 1) / 2) * fs * 1.12));
    g.restore();
    const [dx, dz] = D[l.dir];
    const p = new THREE.PlaneGeometry(l.w, l.h);
    const U = p.getAttribute('uv');
    const u0 = rx / W, u1 = (rx + pw) / W, v0 = 1 - (ry + ph) / H, v1 = 1 - ry / H;
    for (let k = 0; k < U.count; k++) U.setXY(k, U.getX(k) ? u1 : u0, U.getY(k) ? v1 : v0);
    p.rotateY(Math.atan2(dx, dz));
    const along = dz !== 0;
    const off = 0.016;
    if (along) p.translate(l.a, l.y, l.c + dz * off); else p.translate(l.c + dx * off, l.y, l.a);
    (l.outer ? outs : geos).push(p);
  });
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color().setScalar(0.85) });
  mat.userData.inkSurface = 'lit';
  const mesh = (list, into) => {
    if (!list.length) return null;
    const flat = list.map((q0) => { const q = q0.index ? q0.toNonIndexed() : q0; if (q !== q0) q0.dispose(); return q; });
    let n = 0; for (const q of flat) n += q.getAttribute('position').count;
    const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), nor = new Float32Array(n * 3); let o = 0;
    for (const q of flat) { pos.set(q.getAttribute('position').array, o * 3); nor.set(q.getAttribute('normal').array, o * 3); uv.set(q.getAttribute('uv').array, o * 2); o += q.getAttribute('position').count; q.dispose(); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const m = new THREE.Mesh(geo, mat);
    m.matrixAutoUpdate = false; m.matrix.copy(K.F.M);
    m.userData.inkId = K.id + 3; m.userData.noRay = true;
    into.add(m);
    K.extra.push(m);
    return m;
  };
  const m = mesh(geos, K.group);
  mesh(outs, K.outer);
  K.labelTex = tex; K.labelMat = mat;
  return m;
}

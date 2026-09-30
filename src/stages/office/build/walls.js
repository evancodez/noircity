import * as THREE from 'three';

// Walls with openings, as boxes round the holes (every face a real face:
// the ink draws a wall's edges at a door's reveal, a window's sill).
//   wall(kit, mat, { axis: 'z' | 'x', a: [a0, a1] across its thickness, s: [s0, s1]
//        along it, y: [y0, y1], holes: [[s0, s1, y0, y1], ...] }) -> [geometries]
// axis 'z': the wall runs along z, its thickness along x (a = x range);
// axis 'x': it runs along x, its thickness along z (a = z range).
export function wallGeos({ axis = 'z', a, s, y, holes = [] }) {
  const out = [];
  const box = (s0, s1, y0, y1) => {
    if (s1 - s0 < 1e-4 || y1 - y0 < 1e-4) return;
    const w = s1 - s0, h = y1 - y0, t = a[1] - a[0];
    const g = axis === 'z' ? new THREE.BoxGeometry(t, h, w) : new THREE.BoxGeometry(w, h, t);
    if (axis === 'z') g.translate((a[0] + a[1]) / 2, (y0 + y1) / 2, (s0 + s1) / 2);
    else g.translate((s0 + s1) / 2, (y0 + y1) / 2, (a[0] + a[1]) / 2);
    out.push(g);
  };
  const H = [...holes].sort((p, q) => p[0] - q[0]);
  let cur = s[0];
  for (const [h0, h1, hy0, hy1] of H) {
    box(cur, h0, y[0], y[1]);
    box(h0, h1, y[0], hy0);
    box(h0, h1, hy1, y[1]);
    cur = h1;
  }
  box(cur, s[1], y[0], y[1]);
  return out;
}

// the colliders of a wall (thin boxes, the holes left open where `open`)
export function wallColliders(colliders, { axis = 'z', a, s, holes = [] }, tag = 'wall') {
  const H = [...holes].filter((h) => h[4] === 'open').sort((p, q) => p[0] - q[0]);
  let cur = s[0];
  const add = (s0, s1) => {
    if (s1 - s0 < 1e-3) return;
    const c = (a[0] + a[1]) / 2, hc = Math.max(0.04, (a[1] - a[0]) / 2), m = (s0 + s1) / 2, hm = (s1 - s0) / 2;
    if (axis === 'z') colliders.addBox(c, m, hc, hm, 0, tag); else colliders.addBox(m, c, hm, hc, 0, tag);
  };
  for (const [h0, h1] of H) { add(cur, h0); cur = h1; }
  add(cur, s[1]);
}

// a moulding along a wall face: a strip of profile (depth, height) at
// height y, from s0 to s1 (holes skipped), on the face at `f` (x for axis
// 'z', z for 'x'), standing out toward `dir` (+1 / -1)
export function strip({ axis = 'z', f, dir = 1, s: [s0, s1], y, d = 0.02, h = 0.05, skip = [] }) {
  const out = [];
  let cur = s0;
  const put = (a, b) => {
    if (b - a < 1e-3) return;
    const g = axis === 'z' ? new THREE.BoxGeometry(d, h, b - a) : new THREE.BoxGeometry(b - a, h, d);
    if (axis === 'z') g.translate(f + dir * d / 2, y + h / 2, (a + b) / 2);
    else g.translate((a + b) / 2, y + h / 2, f + dir * d / 2);
    out.push(g);
  };
  for (const [a, b] of [...skip].sort((p, q) => p[0] - q[0])) { put(cur, a); cur = Math.max(cur, b); }
  put(cur, s1);
  return out;
}

// a frame (casing) round an opening on a wall face: two jambs and a head
// (and a sill when `sill`), `w` wide, `d` proud of the face
export function casing({ axis = 'z', f, dir = 1, s: [s0, s1], y: [y0, y1], w = 0.08, d = 0.025, sill = false, sillD = 0.06 }) {
  const out = [];
  const B = (sa, sb, ya, yb, dd = d) => {
    const g = axis === 'z' ? new THREE.BoxGeometry(dd, yb - ya, sb - sa) : new THREE.BoxGeometry(sb - sa, yb - ya, dd);
    if (axis === 'z') g.translate(f + dir * dd / 2, (ya + yb) / 2, (sa + sb) / 2);
    else g.translate((sa + sb) / 2, (ya + yb) / 2, f + dir * dd / 2);
    out.push(g);
  };
  B(s0 - w, s0, sill ? y0 - 0.02 : y0, y1 + w);
  B(s1, s1 + w, sill ? y0 - 0.02 : y0, y1 + w);
  B(s0 - w, s1 + w, y1, y1 + w);
  if (sill) { B(s0 - w - 0.03, s1 + w + 0.03, y0 - 0.035, y0, sillD); }
  return out;
}

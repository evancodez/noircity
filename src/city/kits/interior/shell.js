import * as THREE from 'three';

// A place's lot as the street sees it, with its ways in (lane O5): the base
// tier's box the far tile drew (cut out of it while the place is loaded:
// surgery.js), drawn again face by face with holes where its doors and its
// windows are, and the holes' reveals (the wall's thickness, back to the
// room's own wall). Same material and ink id as the far mass: from the
// street the building is as it was, but its door opens on a room.
//   shellGeo(T, holes, depth) -> BufferGeometry (position, normal; non-indexed)
// T: the tier { x0, x1, y0, y1, z0, z1 }; holes: [{ face: 'n'|'s'|'w'|'e', a0, a1, y0, y1 }]
// (a, the face's own horizontal: x for n / s, z for w / e)
export function shellGeo(T, holes, depth = 0.3) {
  const P = [], N = [];
  // (wound to face n, whatever order the corners come in)
  const quad = (a, b, c, d, n) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    const L = cx * n[0] + cy * n[1] + cz * n[2] >= 0 ? [a, b, c, a, c, d] : [a, d, c, a, c, b];
    for (const v of L) { P.push(v[0], v[1], v[2]); N.push(n[0], n[1], n[2]); }
  };
  // a face of the box at a fixed coordinate, its rectangle cut by holes:
  // to3(u, v) maps the face's (u, v) to a point; n its normal; ccw by n
  const face = (U0, U1, V0, V1, H, to3, n, flip) => {
    const us = [U0, U1];
    for (const h of H) us.push(Math.max(U0, Math.min(U1, h.a0)), Math.max(U0, Math.min(U1, h.a1)));
    const u = [...new Set(us)].sort((p, q) => p - q);
    for (let i = 0; i + 1 < u.length; i++) {
      const a = u[i], b = u[i + 1];
      if (b - a < 1e-4) continue;
      const m = (a + b) / 2;
      const gaps = H.filter((h) => h.a0 < m && h.a1 > m).map((h) => [Math.max(V0, h.y0), Math.min(V1, h.y1)]).sort((p, q) => p[0] - q[0]);
      let v = V0;
      const strip = (v0, v1) => { if (v1 - v0 < 1e-4) return; const A = to3(a, v0), B = to3(b, v0), C = to3(b, v1), D = to3(a, v1); if (flip) quad(A, D, C, B, n); else quad(A, B, C, D, n); };
      for (const [g0, g1] of gaps) { strip(v, g0); v = Math.max(v, g1); }
      strip(v, V1);
    }
  };
  const { x0, x1, y0, y1, z0, z1 } = T;
  const by = (k) => holes.filter((h) => h.face === k);
  // (each face wound counter-clockwise seen from outside)
  face(x0, x1, y0, y1, by('s'), (u, v) => [u, v, z1], [0, 0, 1], false);
  face(x0, x1, y0, y1, by('n'), (u, v) => [u, v, z0], [0, 0, -1], true);
  face(z0, z1, y0, y1, by('e'), (u, v) => [x1, v, u], [1, 0, 0], true);
  face(z0, z1, y0, y1, by('w'), (u, v) => [x0, v, u], [-1, 0, 0], false);
  // the top and the bottom
  quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]);
  quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]);
  // the reveals: a hole's sides and head, back into the wall by depth
  for (const h of holes) {
    const d = depth;
    if (h.face === 's' || h.face === 'n') {
      const z = h.face === 's' ? z1 : z0, zi = h.face === 's' ? z1 - d : z0 + d, sg = h.face === 's' ? 1 : -1;
      // left jamb faces +x, right faces -x, head faces -y, sill faces +y
      quad([h.a0, h.y0, zi], [h.a0, h.y0, z], [h.a0, h.y1, z], [h.a0, h.y1, zi], [1, 0, 0]);
      quad([h.a1, h.y0, z], [h.a1, h.y0, zi], [h.a1, h.y1, zi], [h.a1, h.y1, z], [-1, 0, 0]);
      quad([h.a0, h.y1, z], [h.a1, h.y1, z], [h.a1, h.y1, zi], [h.a0, h.y1, zi], [0, -1, 0]);
      if (h.y0 > y0 + 0.05) quad([h.a0, h.y0, zi], [h.a1, h.y0, zi], [h.a1, h.y0, z], [h.a0, h.y0, z], [0, 1, 0]);
      void sg;
    } else {
      const x = h.face === 'e' ? x1 : x0, xi = h.face === 'e' ? x1 - d : x0 + d;
      quad([xi, h.y0, h.a0], [x, h.y0, h.a0], [x, h.y1, h.a0], [xi, h.y1, h.a0], [0, 0, 1]);
      quad([x, h.y0, h.a1], [xi, h.y0, h.a1], [xi, h.y1, h.a1], [x, h.y1, h.a1], [0, 0, -1]);
      quad([x, h.y1, h.a0], [x, h.y1, h.a1], [xi, h.y1, h.a1], [xi, h.y1, h.a0], [0, -1, 0]);
      if (h.y0 > y0 + 0.05) quad([xi, h.y0, h.a0], [xi, h.y0, h.a1], [x, h.y0, h.a1], [x, h.y0, h.a0], [0, 1, 0]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  return g;
}

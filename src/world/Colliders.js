// 2D (XZ-plane) collision world for the player & later the Hoods:
// circles (posts, columns, hydrants), oriented boxes (cars, booths, stands),
// and an outer rectangle of invisible walls.
export class Colliders {
  constructor() {
    this.circles = [];
    this.boxes = [];
    this.bounds = { minX: -1e9, maxX: 1e9, minZ: -1e9, maxZ: 1e9 };
  }
  addCircle(x, z, r, tag) { const c = { x, z, r, tag }; this.circles.push(c); return c; }
  addBox(cx, cz, hx, hz, angle = 0, tag) {
    const b = { cx, cz, hx, hz, angle, c: Math.cos(angle), s: Math.sin(angle), tag };
    this.boxes.push(b);
    return b;
  }
  setBounds(minX, maxX, minZ, maxZ) { this.bounds = { minX, maxX, minZ, maxZ }; }

  // Push a circle of radius r at (pos.x, pos.z) out of everything.
  resolve(pos, r) {
    for (let iter = 0; iter < 3; iter++) {
      for (const c of this.circles) {
        const dx = pos.x - c.x, dz = pos.z - c.z;
        const d2 = dx * dx + dz * dz, rr = c.r + r;
        if (d2 < rr * rr) {
          const d = Math.sqrt(d2) || 1e-4;
          pos.x = c.x + (dx / d) * rr;
          pos.z = c.z + (dz / d) * rr;
        }
      }
      for (const b of this.boxes) {
        // to box-local (angle = rotation about +Y, three.js convention)
        const dx = pos.x - b.cx, dz = pos.z - b.cz;
        const lx = dx * b.c - dz * b.s;
        const lz = dx * b.s + dz * b.c;
        const qx = Math.max(-b.hx, Math.min(b.hx, lx));
        const qz = Math.max(-b.hz, Math.min(b.hz, lz));
        let ox = lx - qx, oz = lz - qz;
        const d2 = ox * ox + oz * oz;
        let nlx = lx, nlz = lz;
        if (d2 > 1e-10) {
          if (d2 >= r * r) continue;
          const d = Math.sqrt(d2);
          nlx = qx + (ox / d) * r;
          nlz = qz + (oz / d) * r;
        } else {
          // inside: exit along the shallowest axis
          const px = b.hx - Math.abs(lx), pz = b.hz - Math.abs(lz);
          if (px < pz) nlx = Math.sign(lx || 1) * (b.hx + r);
          else nlz = Math.sign(lz || 1) * (b.hz + r);
        }
        // back to world
        pos.x = b.cx + nlx * b.c + nlz * b.s;
        pos.z = b.cz - nlx * b.s + nlz * b.c;
      }
      const B = this.bounds;
      pos.x = Math.max(B.minX + r, Math.min(B.maxX - r, pos.x));
      pos.z = Math.max(B.minZ + r, Math.min(B.maxZ - r, pos.z));
    }
    return pos;
  }
}

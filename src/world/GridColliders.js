import { Colliders } from './Colliders.js';

// [O1] The city's walking colliders: the same API as Colliders (circles,
// oriented boxes, the bounds and the regions of the outer net), but every
// circle and box is also kept in a grid of CELL-metre buckets, so a resolve
// looks only at what is near (the city has ~2.5 k walls and posts; the
// block's linear walk over all of them was fine for a hundred).
//   colliders.bodies = () => [{ box() }]   moving solids (the cars) tested too
// The lists (circles, boxes) stay whole for the readers that walk them once
// (the Hoods' nav grid over the bounds, the cover set).
const CELL = 16;
const key = (i, j) => i * 65536 + j;

export class GridColliders extends Colliders {
  constructor() {
    super();
    this.grid = new Map();
    this.bodies = null;
    this._seen = new Set();
    this._near = [];
  }
  _insert(o, x0, x1, z0, z1) {
    o._cells = [];
    for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++) for (let j = Math.floor(z0 / CELL); j <= Math.floor(z1 / CELL); j++) {
      const k = key(i, j);
      let L = this.grid.get(k);
      if (!L) this.grid.set(k, (L = []));
      L.push(o);
      o._cells.push(k);
    }
  }
  _drop(o) {
    for (const k of o._cells || []) { const L = this.grid.get(k); if (L) { const i = L.indexOf(o); if (i >= 0) L.splice(i, 1); } }
    o._cells = null;
  }
  addCircle(x, z, r, tag) {
    const c = super.addCircle(x, z, r, tag);
    this._insert(c, x - r, x + r, z - r, z + r);
    return c;
  }
  addBox(cx, cz, hx, hz, angle = 0, tag) {
    const b = super.addBox(cx, cz, hx, hz, angle, tag);
    const ex = hx * Math.abs(b.c) + hz * Math.abs(b.s), ez = hx * Math.abs(b.s) + hz * Math.abs(b.c);
    this._insert(b, cx - ex, cx + ex, cz - ez, cz + ez);
    return b;
  }
  remove(o) {
    this._drop(o);
    let i = this.boxes.indexOf(o); if (i >= 0) this.boxes.splice(i, 1);
    i = this.circles.indexOf(o); if (i >= 0) this.circles.splice(i, 1);
  }
  // what is near a point (r: the reach)
  near(x, z, r, out = this._near) {
    out.length = 0;
    const S = this._seen; S.clear();
    for (let i = Math.floor((x - r) / CELL); i <= Math.floor((x + r) / CELL); i++) for (let j = Math.floor((z - r) / CELL); j <= Math.floor((z + r) / CELL); j++) {
      const L = this.grid.get(key(i, j));
      if (!L) continue;
      for (const o of L) if (!S.has(o)) { S.add(o); out.push(o); }
    }
    return out;
  }

  resolve(pos, r, skip = null, circles = true) {
    for (let iter = 0; iter < 3; iter++) {
      const L = this.near(pos.x, pos.z, r + 1);
      for (const o of L) {
        if (o === skip || o.gone) continue;
        if (o.r != null) {
          if (!circles) continue;
          const dx = pos.x - o.x, dz = pos.z - o.z;
          const d2 = dx * dx + dz * dz, rr = o.r + r;
          if (d2 < rr * rr) { const d = Math.sqrt(d2) || 1e-4; pos.x = o.x + (dx / d) * rr; pos.z = o.z + (dz / d) * rr; }
        } else boxPush(pos, r, o);
      }
      // the cars: their boxes as they stand this step
      if (this.bodies) for (const v of this.bodies()) {
        if (!v || v.solid === false || !v.box) continue;
        if (Math.abs(v.pos.x - pos.x) > 6 || Math.abs(v.pos.z - pos.z) > 6) continue;
        boxPush(pos, r, v.box());
      }
      if (this.regions.length) this.clampNet(pos, r);
      else {
        const B = this.bounds;
        pos.x = Math.max(B.minX + r, Math.min(B.maxX - r, pos.x));
        pos.z = Math.max(B.minZ + r, Math.min(B.maxZ - r, pos.z));
      }
    }
    return pos;
  }
}

// a circle at pos (radius r) out of an oriented box { cx, cz, hx, hz, c, s }
function boxPush(pos, r, b) {
  if (b.holes && b.holes.some((h) => pos.z > h[0] && pos.z < h[1])) return;
  const dx = pos.x - b.cx, dz = pos.z - b.cz;
  const lx = dx * b.c - dz * b.s, lz = dx * b.s + dz * b.c;
  const qx = Math.max(-b.hx, Math.min(b.hx, lx)), qz = Math.max(-b.hz, Math.min(b.hz, lz));
  const ox = lx - qx, oz = lz - qz, d2 = ox * ox + oz * oz;
  let nlx = lx, nlz = lz;
  if (d2 > 1e-10) {
    if (d2 >= r * r) return;
    const d = Math.sqrt(d2);
    nlx = qx + (ox / d) * r; nlz = qz + (oz / d) * r;
  } else {
    const px = b.hx - Math.abs(lx), pz = b.hz - Math.abs(lz);
    if (px < pz) nlx = Math.sign(lx || 1) * (b.hx + r); else nlz = Math.sign(lz || 1) * (b.hz + r);
  }
  pos.x = b.cx + nlx * b.c + nlz * b.s;
  pos.z = b.cz - nlx * b.s + nlz * b.c;
}

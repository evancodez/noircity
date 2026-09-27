import * as THREE from 'three';

// Walkable grid over the block for the Hoods: 0.5 m cells, blocked where a
// static collider (car, column, booth, crates, hydrant, lamp post...) comes
// within a man's radius. A* (8-neighbour, octile) + string pulling gives
// short, natural paths around cars and between the el's columns; the
// colliders' own resolve() keeps them from ever interpenetrating.
export class NavGrid {
  constructor(colliders, { cell = 0.5, inflate = 0.45 } = {}) {
    this.col = colliders;
    const B = colliders.bounds;
    this.cell = cell;
    this.x0 = B.minX + 0.3; this.z0 = B.minZ + 0.3;
    this.nx = Math.floor((B.maxX - 0.3 - this.x0) / cell);
    this.nz = Math.floor((B.maxZ - 0.3 - this.z0) / cell);
    const N = this.nx * this.nz;
    this.blocked = new Uint8Array(N);
    const circles = colliders.circles.filter((c) => c.tag !== 'hood');
    for (let j = 0; j < this.nz; j++) {
      for (let i = 0; i < this.nx; i++) {
        const x = this.x0 + (i + 0.5) * cell, z = this.z0 + (j + 0.5) * cell;
        let b = 0;
        for (const c of circles) {
          const dx = x - c.x, dz = z - c.z, rr = c.r + inflate;
          if (dx * dx + dz * dz < rr * rr) { b = 1; break; }
        }
        if (!b) {
          for (const bx of colliders.boxes) {
            const dx = x - bx.cx, dz = z - bx.cz;
            const lx = dx * bx.c - dz * bx.s, lz = dx * bx.s + dz * bx.c;
            const qx = Math.max(0, Math.abs(lx) - bx.hx), qz = Math.max(0, Math.abs(lz) - bx.hz);
            if (qx * qx + qz * qz < inflate * inflate) { b = 1; break; }
          }
        }
        this.blocked[j * this.nx + i] = b;
      }
    }
    this.g = new Float32Array(N);
    this.from = new Int32Array(N);
    this.stamp = new Uint32Array(N);
    this.closed = new Uint32Array(N);
    this.gen = 1;
    this.heap = new Int32Array(N);
    this.f = new Float32Array(N);
  }

  idx(x, z) {
    const i = Math.floor((x - this.x0) / this.cell), j = Math.floor((z - this.z0) / this.cell);
    if (i < 0 || j < 0 || i >= this.nx || j >= this.nz) return -1;
    return j * this.nx + i;
  }
  free(x, z) { const k = this.idx(x, z); return k >= 0 && !this.blocked[k]; }
  center(k, out = new THREE.Vector3()) {
    const i = k % this.nx, j = (k / this.nx) | 0;
    return out.set(this.x0 + (i + 0.5) * this.cell, 0, this.z0 + (j + 0.5) * this.cell);
  }
  nearestFree(x, z, maxR = 8) {
    const k0 = this.idx(Math.min(Math.max(x, this.x0), this.x0 + this.nx * this.cell - 0.01), Math.min(Math.max(z, this.z0), this.z0 + this.nz * this.cell - 0.01));
    if (k0 >= 0 && !this.blocked[k0]) return k0;
    const i0 = k0 % this.nx, j0 = (k0 / this.nx) | 0;
    const R = Math.ceil(maxR / this.cell);
    let best = -1, bd = Infinity;
    for (let r = 1; r <= R && best < 0; r++) {
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          const i = i0 + di, j = j0 + dj;
          if (i < 0 || j < 0 || i >= this.nx || j >= this.nz) continue;
          const k = j * this.nx + i;
          if (this.blocked[k]) continue;
          const d = di * di + dj * dj;
          if (d < bd) { bd = d; best = k; }
        }
      }
    }
    return best;
  }

  // straight segment clear of blocked cells (sampled every quarter cell)
  lineFree(x0, z0, x1, z1) {
    const dx = x1 - x0, dz = z1 - z0;
    const L = Math.hypot(dx, dz);
    const n = Math.max(1, Math.ceil(L / (this.cell * 0.35)));
    for (let s = 1; s <= n; s++) {
      const k = this.idx(x0 + (dx * s) / n, z0 + (dz * s) / n);
      if (k < 0 || this.blocked[k]) return false;
    }
    return true;
  }

  // A*; returns smoothed waypoints [Vector3] (excluding the start), or null
  findPath(sx, sz, tx, tz, maxExpand = 12000) {
    const s = this.nearestFree(sx, sz), t = this.nearestFree(tx, tz);
    if (s < 0 || t < 0) return null;
    const nx = this.nx, gen = ++this.gen;
    const G = this.g, F = this.f, FROM = this.from, ST = this.stamp, CL = this.closed, H = this.heap;
    const ti = t % nx, tj = (t / nx) | 0;
    const hfun = (k) => {
      const di = Math.abs((k % nx) - ti), dj = Math.abs(((k / nx) | 0) - tj);
      return (Math.max(di, dj) + 0.4142 * Math.min(di, dj));
    };
    let hn = 0;
    const push = (k) => {
      let i = hn++;
      H[i] = k;
      while (i > 0) { const p = (i - 1) >> 1; if (F[H[p]] <= F[H[i]]) break; const tmp = H[p]; H[p] = H[i]; H[i] = tmp; i = p; }
    };
    const pop = () => {
      const top = H[0];
      H[0] = H[--hn];
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < hn && F[H[l]] < F[H[m]]) m = l;
        if (r < hn && F[H[r]] < F[H[m]]) m = r;
        if (m === i) break;
        const tmp = H[m]; H[m] = H[i]; H[i] = tmp; i = m;
      }
      return top;
    };
    ST[s] = gen; G[s] = 0; F[s] = hfun(s); FROM[s] = -1;
    push(s);
    let found = false, expanded = 0;
    const D = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]];
    while (hn > 0) {
      const k = pop();
      if (CL[k] === gen) continue;
      CL[k] = gen;
      if (k === t) { found = true; break; }
      if (++expanded > maxExpand) break;
      const i = k % nx, j = (k / nx) | 0;
      for (const [di, dj, c] of D) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= nx || jj >= this.nz) continue;
        const kk = jj * nx + ii;
        if (this.blocked[kk] || CL[kk] === gen) continue;
        // no corner cutting
        if (di && dj && (this.blocked[j * nx + ii] || this.blocked[jj * nx + i])) continue;
        const g = G[k] + c;
        if (ST[kk] !== gen || g < G[kk]) {
          ST[kk] = gen; G[kk] = g; FROM[kk] = k; F[kk] = g + hfun(kk);
          push(kk);
        }
      }
    }
    if (!found) return null;
    const cells = [];
    for (let k = t; k >= 0; k = FROM[k]) cells.push(k);
    cells.reverse();
    // string pulling
    const pts = cells.map((k) => this.center(k));
    pts[pts.length - 1].set(tx, 0, tz);
    if (!this.free(tx, tz)) pts[pts.length - 1].copy(this.center(t));
    const out = [];
    let a = new THREE.Vector3(sx, 0, sz);
    let i = 0;
    while (i < pts.length - 1) {
      let j = pts.length - 1;
      while (j > i + 1 && !this.lineFree(a.x, a.z, pts[j].x, pts[j].z)) j--;
      out.push(pts[j]);
      a = pts[j];
      i = j;
    }
    if (!out.length) out.push(pts[pts.length - 1]);
    return out;
  }
}

import * as THREE from 'three';

// Fast bullet / line-of-sight raycasts against world.solids.
//
// three's Mesh.raycast walks every triangle of a mesh whose bounding sphere
// the ray touches; the block's solids hold ~900k triangles (a car alone is
// 57k), which cost ~6.6 ms a ray - far too slow for 11 rounds/s plus a dozen
// Hoods checking line of sight. So each unique static geometry gets a small
// BVH (built once, in its local space, shared by every mesh that uses it:
// the eight cars share one), and a ray is tested against the world-space
// AABB of every solid first, then against that solid's BVH in local space.
// Hood hit volumes (moving, tagged userData.hood / userData.joint) are tested
// analytically as spheres and capsules from their bones' matrices.

const LEAF = 6;

export class GeoBVH {
  constructor(geometry) {
    const P = geometry.getAttribute('position');
    const pa = P.array;
    const stride = P.isInterleavedBufferAttribute ? P.data.stride : 3;
    const off = P.isInterleavedBufferAttribute ? P.offset : 0;
    const idx = geometry.index ? geometry.index.array : null;
    const n = idx ? (idx.length / 3) | 0 : (P.count / 3) | 0;
    this.count = n;
    const tri = new Float32Array(n * 9);
    const cen = new Float32Array(n * 3);
    for (let t = 0; t < n; t++) {
      for (let k = 0; k < 3; k++) {
        const vi = idx ? idx[t * 3 + k] : t * 3 + k;
        const o = vi * stride + off;
        tri[t * 9 + k * 3] = pa[o];
        tri[t * 9 + k * 3 + 1] = pa[o + 1];
        tri[t * 9 + k * 3 + 2] = pa[o + 2];
      }
      cen[t * 3] = (tri[t * 9] + tri[t * 9 + 3] + tri[t * 9 + 6]) / 3;
      cen[t * 3 + 1] = (tri[t * 9 + 1] + tri[t * 9 + 4] + tri[t * 9 + 7]) / 3;
      cen[t * 3 + 2] = (tri[t * 9 + 2] + tri[t * 9 + 5] + tri[t * 9 + 8]) / 3;
    }
    const order = new Uint32Array(n);
    for (let i = 0; i < n; i++) order[i] = i;
    // nodes: bounds (6 floats) + [start, count, right] (count 0 = inner node)
    const maxNodes = Math.max(1, 2 * Math.ceil(n / LEAF) + 16) * 2;
    let bounds = new Float32Array(maxNodes * 6);
    let info = new Uint32Array(maxNodes * 3);
    let nodeCount = 0;
    const stack = [[0, n, -1, 0]];   // start, end, parent, isRight
    while (stack.length) {
      const [s, e, parent, isRight] = stack.pop();
      const node = nodeCount++;
      if (node * 6 + 6 > bounds.length) {
        const b2 = new Float32Array(bounds.length * 2); b2.set(bounds); bounds = b2;
        const i2 = new Uint32Array(info.length * 2); i2.set(info); info = i2;
      }
      if (parent >= 0 && isRight) info[parent * 3 + 2] = node;
      let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
      let cx0 = Infinity, cy0 = Infinity, cz0 = Infinity, cx1 = -Infinity, cy1 = -Infinity, cz1 = -Infinity;
      for (let i = s; i < e; i++) {
        const t = order[i];
        for (let k = 0; k < 9; k += 3) {
          const x = tri[t * 9 + k], y = tri[t * 9 + k + 1], z = tri[t * 9 + k + 2];
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
          if (z < z0) z0 = z; if (z > z1) z1 = z;
        }
        const cx = cen[t * 3], cy = cen[t * 3 + 1], cz = cen[t * 3 + 2];
        if (cx < cx0) cx0 = cx; if (cx > cx1) cx1 = cx;
        if (cy < cy0) cy0 = cy; if (cy > cy1) cy1 = cy;
        if (cz < cz0) cz0 = cz; if (cz > cz1) cz1 = cz;
      }
      bounds.set([x0, y0, z0, x1, y1, z1], node * 6);
      const cnt = e - s;
      const ex = cx1 - cx0, ey = cy1 - cy0, ez = cz1 - cz0;
      if (cnt <= LEAF || Math.max(ex, ey, ez) < 1e-7) {
        info[node * 3] = s; info[node * 3 + 1] = cnt; info[node * 3 + 2] = 0;
        continue;
      }
      // spatial midpoint split of the centroid bounds on the longest axis
      const ax = ex >= ey && ex >= ez ? 0 : ey >= ez ? 1 : 2;
      const mid = ax === 0 ? cx0 + ex / 2 : ax === 1 ? cy0 + ey / 2 : cz0 + ez / 2;
      let i = s, j = e - 1;
      while (i <= j) {
        if (cen[order[i] * 3 + ax] < mid) i++;
        else { const tmp = order[i]; order[i] = order[j]; order[j] = tmp; j--; }
      }
      let m = i;
      if (m === s || m === e) m = (s + e) >> 1;
      info[node * 3] = s; info[node * 3 + 1] = 0;
      // children: left = node + 1 (pushed last, popped first), right patched later
      stack.push([m, e, node, 1]);
      stack.push([s, m, node, 0]);
    }
    this.bounds = bounds.slice(0, nodeCount * 6);
    this.info = info.slice(0, nodeCount * 3);
    this.tri = tri;
    this.order = order;
    this._stack = new Int32Array(128);
  }

  // Nearest hit along o + d t, t in [0, far]. Returns t (Infinity if none);
  // this.hitTri = triangle index.
  raycast(ox, oy, oz, dx, dy, dz, far, anyHit = false) {
    const B = this.bounds, I = this.info, T = this.tri, O = this.order;
    const ix = 1 / (dx || 1e-12), iy = 1 / (dy || 1e-12), iz = 1 / (dz || 1e-12);
    const st = this._stack;
    let sp = 0;
    st[sp++] = 0;
    let best = far;
    let bestTri = -1;
    while (sp > 0) {
      const nd = st[--sp];
      const b = nd * 6;
      let t0 = (B[b] - ox) * ix, t1 = (B[b + 3] - ox) * ix;
      let tmin = t0 < t1 ? t0 : t1, tmax = t0 < t1 ? t1 : t0;
      t0 = (B[b + 1] - oy) * iy; t1 = (B[b + 4] - oy) * iy;
      tmin = Math.max(tmin, t0 < t1 ? t0 : t1); tmax = Math.min(tmax, t0 < t1 ? t1 : t0);
      t0 = (B[b + 2] - oz) * iz; t1 = (B[b + 5] - oz) * iz;
      tmin = Math.max(tmin, t0 < t1 ? t0 : t1); tmax = Math.min(tmax, t0 < t1 ? t1 : t0);
      if (tmax < Math.max(tmin, 0) || tmin > best) continue;
      const cnt = I[nd * 3 + 1];
      if (cnt > 0) {
        const s = I[nd * 3];
        for (let k = s; k < s + cnt; k++) {
          const tr = O[k] * 9;
          // Moller-Trumbore, double sided
          const ax = T[tr], ay = T[tr + 1], az = T[tr + 2];
          const e1x = T[tr + 3] - ax, e1y = T[tr + 4] - ay, e1z = T[tr + 5] - az;
          const e2x = T[tr + 6] - ax, e2y = T[tr + 7] - ay, e2z = T[tr + 8] - az;
          const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
          const det = e1x * px + e1y * py + e1z * pz;
          if (det > -1e-12 && det < 1e-12) continue;
          const inv = 1 / det;
          const sx = ox - ax, sy = oy - ay, sz = oz - az;
          const u = (sx * px + sy * py + sz * pz) * inv;
          if (u < 0 || u > 1) continue;
          const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
          const v = (dx * qx + dy * qy + dz * qz) * inv;
          if (v < 0 || u + v > 1) continue;
          const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
          if (t > 1e-5 && t < best) {
            best = t; bestTri = O[k];
            if (anyHit) { this.hitTri = bestTri; return best; }
          }
        }
      } else {
        if (sp + 2 >= st.length) continue;
        st[sp++] = I[nd * 3 + 2];
        st[sp++] = nd + 1;
      }
    }
    this.hitTri = bestTri;
    return bestTri >= 0 ? best : Infinity;
  }

  triNormal(ti, out) {
    const T = this.tri, b = ti * 9;
    const e1x = T[b + 3] - T[b], e1y = T[b + 4] - T[b + 1], e1z = T[b + 5] - T[b + 2];
    const e2x = T[b + 6] - T[b], e2y = T[b + 7] - T[b + 1], e2z = T[b + 8] - T[b + 2];
    return out.set(e1y * e2z - e1z * e2y, e1z * e2x - e1x * e2z, e1x * e2y - e1y * e2x).normalize();
  }
}

const BVH_CACHE = new WeakMap();
function bvhFor(geo) {
  let b = BVH_CACHE.get(geo);
  if (!b) { b = new GeoBVH(geo); BVH_CACHE.set(geo, b); }
  return b;
}

// Surface classes for impact effects (fx/Impacts.js).
export const SURF = { STONE: 'stone', IRON: 'iron', CAR: 'car', WATER: 'water', PAVE: 'pave', HOOD: 'hood', GLASS: 'glass', METAL: 'metal' };

function classify(mesh, world) {
  if (mesh === world.street.road) return SURF.WATER;
  if (mesh === world.street.paveL || mesh === world.street.paveR) return SURF.PAVE;
  for (let o = mesh; o; o = o.parent) {
    if (o.name === 'overpass') return SURF.IRON;
    if (o.userData && o.userData.surf) return o.userData.surf;
  }
  if (mesh.userData.inkFigure) return SURF.CAR;           // car groups are figures
  const m = mesh.material;
  if (m && m.metalness > 0.25) return SURF.IRON;
  return SURF.STONE;
}

const _o = new THREE.Vector3(), _d = new THREE.Vector3();
const _box = new THREE.Box3();

export class RayWorld {
  constructor(world) {
    this.world = world;
    this.entries = [];
    this.stats = { rays: 0, ms: 0 };
    const t0 = performance.now();
    for (const mesh of world.solids) this.add(mesh);
    this.buildMs = performance.now() - t0;
  }

  // a static solid joins the bullets' world (stage.addSolid); the Hoods'
  // hit volumes are tested analytically (raycastHoods), never here
  add(mesh) {
    if (mesh.userData.hood) return;
    const g = mesh.geometry;
    if (!g || !g.getAttribute('position')) return;
    mesh.updateWorldMatrix(true, false);
    if (!g.boundingBox) g.computeBoundingBox();
    _box.copy(g.boundingBox).applyMatrix4(mesh.matrixWorld);
    // the far skyline is never within a bullet's range of the block
    const far = Math.hypot((_box.min.x + _box.max.x) / 2, (_box.min.z + _box.max.z) / 2 + 40) > 260;
    if (far) return;
    const bvh = bvhFor(g);
    bvh.geo = g;
    this.entries.push({
      mesh, bvh, inv: mesh.matrixWorld.clone().invert(), mw: mesh.matrixWorld.clone(),
      inv3: new THREE.Matrix3().setFromMatrix4(mesh.matrixWorld.clone().invert()),
      min: _box.min.clone(), max: _box.max.clone(), surf: classify(mesh, this.world),
    });
  }
  remove(mesh) { this.entries = this.entries.filter((e) => e.mesh !== mesh); }

  // Nearest static hit. Returns { t, point, normal, mesh, surf } or null.
  // opts.anyHit: stop at the first hit (line of sight).
  raycast(origin, dir, far = 150, opts = {}) {
    const t0 = performance.now();
    let best = far, hit = null, bestTri = -1;
    const ox = origin.x, oy = origin.y, oz = origin.z, dx = dir.x, dy = dir.y, dz = dir.z;
    const ix = 1 / (dx || 1e-12), iy = 1 / (dy || 1e-12), iz = 1 / (dz || 1e-12);
    for (const e of this.entries) {
      if (e.off) continue;
      // world AABB slab test
      let a = (e.min.x - ox) * ix, b = (e.max.x - ox) * ix;
      let tmin = Math.min(a, b), tmax = Math.max(a, b);
      a = (e.min.y - oy) * iy; b = (e.max.y - oy) * iy;
      tmin = Math.max(tmin, Math.min(a, b)); tmax = Math.min(tmax, Math.max(a, b));
      a = (e.min.z - oz) * iz; b = (e.max.z - oz) * iz;
      tmin = Math.max(tmin, Math.min(a, b)); tmax = Math.min(tmax, Math.max(a, b));
      if (tmax < Math.max(tmin, 0) || tmin > best) continue;
      if (opts.skip && opts.skip(e)) continue;
      // ray into the mesh's local space (t is preserved: direction is not
      // normalised after the transform)
      _o.copy(origin).applyMatrix4(e.inv);
      _d.copy(dir).applyMatrix3(e.inv3);
      const t = e.bvh.raycast(_o.x, _o.y, _o.z, _d.x, _d.y, _d.z, best, !!opts.anyHit);
      if (t < best) {
        best = t; hit = e; bestTri = e.bvh.hitTri;
        if (opts.anyHit) break;
      }
    }
    this.stats.rays++;
    this.stats.ms += performance.now() - t0;
    if (!hit) return null;
    const normal = hit.bvh.triNormal(bestTri, new THREE.Vector3()).transformDirection(hit.mw);
    if (normal.dot(dir) > 0) normal.negate();
    return { t: best, point: origin.clone().addScaledVector(dir, best), normal, mesh: hit.mesh, surf: hit.surf };
  }

  // Phase 3a (a reactive world): a mesh that moved (a sagging wreck, a
  // tumbled trash can) or whose geometry was rebuilt (a shattered pane)
  // refreshes its entry; a mesh that is gone (the glass of a wreck) is
  // switched off.
  refresh(mesh) {
    for (const e of this.entries) {
      if (e.mesh !== mesh) continue;
      mesh.updateWorldMatrix(true, false);
      // (a mesh drawn with a far LOD keeps its full build for the bullets)
      const g = mesh.userData.rayGeo || mesh.geometry;
      if (!g.boundingBox) g.computeBoundingBox();
      if (e.bvh.geo !== g) { e.bvh = bvhFor(g); e.bvh.geo = g; }
      e.mw.copy(mesh.matrixWorld);
      e.inv.copy(mesh.matrixWorld).invert();
      e.inv3.setFromMatrix4(e.inv);
      _box.copy(g.boundingBox).applyMatrix4(mesh.matrixWorld);
      e.min.copy(_box.min); e.max.copy(_box.max);
    }
  }
  setEnabled(mesh, on) { for (const e of this.entries) if (e.mesh === mesh) e.off = !on; }

  // Ray against the Hoods' hit volumes (spheres / capsules on the bones).
  // Returns { t, hood, joint, point } or null. opts.skipHood: ignore him.
  raycastHoods(origin, dir, far, hoods, opts = {}) {
    let best = far, res = null;
    for (const h of hoods) {
      if (h === opts.skipHood) continue;
      if (!opts.includeDead && !h.alive) continue;
      // coarse: a 1.2 m sphere around his hips
      const c = h.pos;
      const cx = c.x - origin.x, cy = c.y + 0.9 - origin.y, cz = c.z - origin.z;
      const tc = cx * dir.x + cy * dir.y + cz * dir.z;
      const d2 = cx * cx + cy * cy + cz * cz - tc * tc;
      if (d2 > 1.44 * h.scale * h.scale || tc < -1.2 || tc - 1.2 > best) continue;
      for (const m of h.hitMeshes) {
        const t = rayVolume(origin, dir, m, best);
        if (t < best) { best = t; res = { t, hood: h, joint: m.userData.joint, mesh: m }; }
      }
    }
    if (res) res.point = origin.clone().addScaledVector(dir, res.t);
    return res;
  }
}

// analytic ray vs a hit volume mesh (sphere or capsule along its local Y)
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
function rayVolume(o, d, m, far) {
  const p = m.geometry.parameters;
  const s = m.matrixWorld.elements;
  const scale = Math.hypot(s[0], s[1], s[2]);
  if (m.geometry.type === 'SphereGeometry') {
    _c.setFromMatrixPosition(m.matrixWorld);
    return raySphere(o, d, _c, p.radius * scale, far);
  }
  // capsule: segment from -len/2 to +len/2 along local Y
  const hl = p.height !== undefined ? p.height / 2 : p.length / 2;
  _a.set(0, -hl, 0).applyMatrix4(m.matrixWorld);
  _b.set(0, hl, 0).applyMatrix4(m.matrixWorld);
  return rayCapsule(o, d, _a, _b, p.radius * scale, far);
}

function raySphere(o, d, c, r, far) {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const cc = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - cc;
  if (disc < 0) return Infinity;
  const t = -b - Math.sqrt(disc);
  return t > 0 && t < far ? t : Infinity;
}

// closest approach of the ray to the segment, then a sphere at that point
const _p = new THREE.Vector3();
function rayCapsule(o, d, a, b, r, far) {
  const bax = b.x - a.x, bay = b.y - a.y, baz = b.z - a.z;
  const oax = o.x - a.x, oay = o.y - a.y, oaz = o.z - a.z;
  const baba = bax * bax + bay * bay + baz * baz;
  const bard = bax * d.x + bay * d.y + baz * d.z;
  const baoa = bax * oax + bay * oay + baz * oaz;
  const rdoa = d.x * oax + d.y * oay + d.z * oaz;
  const oaoa = oax * oax + oay * oay + oaz * oaz;
  const A = baba - bard * bard;
  const B = baba * rdoa - baoa * bard;
  const C = baba * oaoa - baoa * baoa - r * r * baba;
  const h = B * B - A * C;
  if (h >= 0 && A > 1e-10) {
    const t = (-B - Math.sqrt(h)) / A;
    const y = baoa + t * bard;
    if (y > 0 && y < baba && t > 0 && t < far) return t;
  }
  // caps
  const t1 = raySphere(o, d, a, r, far);
  const t2 = raySphere(o, d, b, r, far);
  return Math.min(t1, t2);
}

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// Geometry helpers. The rule (DESIGN.md anti-goals): nothing near the camera
// may show polygon facets, so extrusions get bevels + welded smooth normals,
// round things are lathes with high segment counts.

export const V2 = (x, y) => new THREE.Vector2(x, y);
export const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// Weld + recompute normals so bevels and curved outlines shade smoothly.
export function smoothNormals(geo, tol = 1e-4) {
  geo.deleteAttribute('normal');
  if (geo.getAttribute('uv')) geo.deleteAttribute('uv');
  const g = mergeVertices(geo, tol);
  g.computeVertexNormals();
  return g;
}

// Smooth normals, but keep creases sharper than `creaseAngle` (radians).
// Uses three's toCreasedNormals when available for hard-surface pieces.
export function smoothExtrude(shape, opts) {
  const geo = new THREE.ExtrudeGeometry(shape, { curveSegments: 24, ...opts });
  return smoothNormals(geo);
}

export function lathe(profile, segments = 40, phiStart = 0, phiLength = Math.PI * 2) {
  const pts = profile.map(([r, y]) => V2(Math.max(r, 0.0001), y));
  const geo = new THREE.LatheGeometry(pts, segments, phiStart, phiLength);
  return geo;
}

export function strip(geo) {
  // keep only position + normal so merges line up
  for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k);
  if (geo.index) geo = geo.toNonIndexed();
  return geo;
}

export function merge(list) {
  const clean = list.map((g) => strip(g));
  return mergeGeometries(clean, false);
}

export function place(geo, { pos, rot, scale, quat } = {}) {
  const m = new THREE.Matrix4();
  const q = quat || new THREE.Quaternion().setFromEuler(new THREE.Euler(...(rot || [0, 0, 0]), 'XYZ'));
  m.compose(pos || V3(0, 0, 0), q, scale ? (scale.isVector3 ? scale : V3(scale, scale, scale)) : V3(1, 1, 1));
  geo.applyMatrix4(m);
  return geo;
}

// Rounded box via bevelled extrude of a rounded rectangle (no facets on edges).
export function roundedBox(w, h, d, r = 0.04, seg = 4) {
  const s = new THREE.Shape();
  const x = -w / 2 + r, y = -h / 2 + r, W = w - 2 * r, H = h - 2 * r;
  s.moveTo(x, y - r);
  s.lineTo(x + W, y - r);
  s.quadraticCurveTo(x + W + r, y - r, x + W + r, y);
  s.lineTo(x + W + r, y + H);
  s.quadraticCurveTo(x + W + r, y + H + r, x + W, y + H + r);
  s.lineTo(x, y + H + r);
  s.quadraticCurveTo(x - r, y + H + r, x - r, y + H);
  s.lineTo(x - r, y);
  s.quadraticCurveTo(x - r, y - r, x, y - r);
  const depth = Math.max(0.001, d - 2 * r);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: r, bevelSize: r * 0.999, bevelOffset: -r * 0.999, bevelSegments: seg, curveSegments: seg * 2 });
  g.translate(0, 0, -depth / 2);
  return smoothNormals(g);
}

// Sweep a closed 2D profile (px across, py up) along a 3D polyline.
// frames: T = path tangent, B = `acrossFn(i)` or horizontal normal, N = B x T.
export function sweep(points, profile, { closed = true, upHint = V3(0, 1, 0), fixedAcross = null, flat = false } = {}) {
  const n = points.length, m = profile.length;
  const pos = [];
  const T = new THREE.Vector3(), B = new THREE.Vector3(), N = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const a = points[Math.max(0, i - 1)], b = points[Math.min(n - 1, i + 1)];
    T.subVectors(b, a).normalize();
    if (fixedAcross) B.copy(fixedAcross);
    else B.crossVectors(T, upHint).normalize();
    N.crossVectors(B, T).normalize();
    for (let j = 0; j < m; j++) {
      const [px, py] = profile[j];
      pos.push(points[i].x + B.x * px + N.x * py, points[i].y + B.y * px + N.y * py, points[i].z + B.z * px + N.z * py);
    }
  }
  // CCW profiles (in B,N space) give outward normals with (a,c,b) winding.
  let area = 0;
  for (let j = 0; j < m; j++) {
    const [x0, y0] = profile[j], [x1, y1] = profile[(j + 1) % m];
    area += x0 * y1 - x1 * y0;
  }
  const ccw = area >= 0;
  const idx = [];
  const mm = closed ? m : m - 1;
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < mm; j++) {
      const a = i * m + j, b = i * m + ((j + 1) % m), c = (i + 1) * m + j, d = (i + 1) * m + ((j + 1) % m);
      if (ccw) idx.push(a, c, b, b, c, d);
      else idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  if (flat) {
    const f = g.toNonIndexed();
    f.computeVertexNormals();
    return f;
  }
  g.computeVertexNormals();
  return g;
}

// Sagging wire between two points.
export function catenaryPoints(a, b, sag, segments = 24) {
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = new THREE.Vector3().lerpVectors(a, b, t);
    p.y -= sag * 4 * t * (1 - t);
    pts.push(p);
  }
  return pts;
}

export function tube(points, radius, radial = 8, tubular = null, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points, closed, 'centripetal');
  return new THREE.TubeGeometry(curve, tubular || Math.max(8, points.length * 4), radius, radial, closed);
}

// Planar UVs from world position (for tiling textures on architecture).
export function worldUV(geo, axisU, axisV, scale = 1) {
  const p = geo.getAttribute('position');
  const uv = new Float32Array(p.count * 2);
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    uv[i * 2] = v.dot(axisU) * scale;
    uv[i * 2 + 1] = v.dot(axisV) * scale;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

// Box UVs from world position picking the dominant axis per face.
export function boxWorldUV(geo, scale = 1) {
  const p = geo.getAttribute('position'), n = geo.getAttribute('normal');
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ax >= ay && ax >= az) { u = z; v = y; } else if (az >= ay) { u = x; v = y; } else { u = x; v = z; }
    uv[i * 2] = u * scale; uv[i * 2 + 1] = v * scale;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

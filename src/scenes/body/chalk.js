import * as THREE from 'three';
import { LAYER } from '../../render/layers.js';
import { ACCENT_U } from '../../render/accents.js';

// White lines drawn into the world (scene 3): the strings, the rays they
// throw, the dashed outline of where he stood. A thin tube with a minimum
// printed width (as the neon's: every vertex pushed out along its view
// normal until the line is `minPx` pixels across), unlit paper white,
// drawn in the scene pass only (LAYER.FX: no ink line round it, no
// reflection) and occluded by what stands in front of it.
// (no helper file's default export: not a scene)
export function chalkMaterial({ color = 1.0, minPx = 2.2, opacity = 1 } = {}) {
  const m = new THREE.ShaderMaterial({
    uniforms: {
      uViewH: ACCENT_U.uViewH, uMinPx: { value: minPx }, uR: { value: 0.004 },
      uColor: { value: new THREE.Color(color, color, color) }, uOpacity: { value: opacity },
    },
    vertexShader: /* glsl */`
      uniform float uViewH, uMinPx, uR;
      void main() {
        vec3 n = normalize( normalMatrix * normal );
        vec4 mv = modelViewMatrix * vec4( position, 1.0 );
        float pxW = 2.0 * max( - mv.z, 1e-3 ) / ( projectionMatrix[ 1 ][ 1 ] * uViewH );
        mv.xyz += n * max( 0.5 * uMinPx * pxW - uR, 0.0 );
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      uniform float uOpacity;
      void main() { gl_FragColor = vec4( uColor, uOpacity ); }`,
    transparent: true, depthWrite: false,
  });
  m.name = 'body_chalk';
  return m;
}

// a straight segment a..b as a unit cylinder, moved each step (no geometry
// rebuilt): seg.set(a, b), seg.mesh.visible
const UNIT = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true).translate(0, 0.5, 0);
const _d = new THREE.Vector3(), _q = new THREE.Quaternion(), _y = new THREE.Vector3(0, 1, 0);
export function segment(mat, r = 0.004) {
  const mesh = new THREE.Mesh(UNIT, mat);
  mesh.layers.set(LAYER.FX);
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  mesh.userData.noRay = true;
  const S = {
    mesh, r,
    set(a, b) {
      _d.subVectors(b, a);
      const L = _d.length();
      if (L < 1e-5) { mesh.visible = false; return S; }
      mesh.visible = true;
      mesh.position.copy(a);
      mesh.quaternion.copy(_q.setFromUnitVectors(_y, _d.divideScalar(L)));
      mesh.scale.set(r, L, r);
      return S;
    },
  };
  return S;
}

// a dashed polyline (world points, closed or not) as one merged mesh of
// short tubes: `dash` metres drawn, `gap` left
export function dashed(points, mat, { dash = 0.06, gap = 0.045, r = 0.004, closed = true } = {}) {
  const pts = closed ? [...points, points[0]] : points;
  const geos = [];
  let carry = 0, on = true;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const L = a.distanceTo(b);
    let s = 0;
    while (s < L - 1e-6) {
      const left = (on ? dash : gap) - carry;
      const e = Math.min(L, s + left);
      if (on && e - s > 0.004) {
        const p0 = a.clone().lerp(b, s / L), p1 = a.clone().lerp(b, e / L);
        const d = p1.clone().sub(p0), l = d.length();
        const g = new THREE.CylinderGeometry(r, r, l, 5, 1, true).translate(0, l / 2, 0);
        g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(_y, d.normalize()));
        g.translate(p0.x, p0.y, p0.z);
        geos.push(g);
      }
      carry += e - s;
      if (carry >= (on ? dash : gap) - 1e-6) { carry = 0; on = !on; }
      s = e;
    }
  }
  const merged = mergeList(geos);
  const mesh = new THREE.Mesh(merged, mat);
  mesh.layers.set(LAYER.FX);
  mesh.renderOrder = 3;
  mesh.userData.noRay = true;
  return mesh;
}

function mergeList(list) {
  let n = 0, ni = 0;
  for (const g of list) { n += g.getAttribute('position').count; ni += g.index.count; }
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), idx = new Uint32Array(ni);
  let o = 0, oi = 0;
  for (const g of list) {
    const p = g.getAttribute('position'), q = g.getAttribute('normal');
    pos.set(p.array, o * 3); nor.set(q.array, o * 3);
    const I = g.index.array;
    for (let k = 0; k < I.length; k++) idx[oi + k] = I[k] + o;
    o += p.count; oi += I.length;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  return geo;
}

// a ring of dashes (a wound marked on the outline): centre, normal, radius
export function ring(c, n, radius, mat, { r = 0.0035, dashes = 8 } = {}) {
  const u = new THREE.Vector3().crossVectors(n, Math.abs(n.y) < 0.9 ? _y : new THREE.Vector3(1, 0, 0)).normalize();
  const v = new THREE.Vector3().crossVectors(n, u).normalize();
  const pts = [];
  for (let k = 0; k < 32; k++) { const a = k / 32 * Math.PI * 2; pts.push(c.clone().addScaledVector(u, Math.cos(a) * radius).addScaledVector(v, Math.sin(a) * radius)); }
  const per = 2 * Math.PI * radius / dashes;
  return dashed(pts, mat, { dash: per * 0.55, gap: per * 0.45, r, closed: true });
}

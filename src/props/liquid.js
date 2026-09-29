import * as THREE from 'three';

// A liquid inside a vessel of revolution: its own mesh (the scotch's amber,
// the coffee's black), filled to a level and tilted so its surface stays
// level in the world while the glass tips.
//   const L = makeLiquid(innerProfile [[r, y]] from the floor up, { y0, yFull, mat, segs })
//   L.mesh    L.set(fill 0..1, upLocal: Vector3 (the world's up in the vessel's frame))
//   L.ripple(k)  rings spreading on the surface (a passing train): k 0..1, set per step
// The surface is the plane through the axis point at the level with normal
// upLocal; the wall follows the inner profile up to it. The volume is not
// conserved exactly while tilted (the level stays on the axis), which
// reads right in a hand at 0.3 m: the high side climbs, the low side drops.
const _u = new THREE.Vector3();

export function makeLiquid(profile, { y0, yFull, mat, segs = 32, rows = 6 } = {}) {
  // the inner radius at a height, from the vessel's inner profile
  const rAt = (y) => {
    if (y <= profile[0][1]) return profile[0][0];
    for (let i = 1; i < profile.length; i++) {
      const [r1, y1] = profile[i], [r0, yy0] = profile[i - 1];
      if (y <= y1) return r0 + (r1 - r0) * ((y - yy0) / Math.max(1e-6, y1 - yy0));
    }
    return profile[profile.length - 1][0];
  };
  const yTop = profile[profile.length - 1][1];
  // vertices: the wall (rows + 1 rings of segs + 1), the cap (a centre and
  // segs + 1 rim points), the floor (a centre and segs + 1 points)
  const nWall = (rows + 1) * (segs + 1);
  const nCap = 1 + (segs + 1);
  const nFloor = 1 + (segs + 1);
  const pos = new Float32Array((nWall + nCap + nFloor) * 3);
  const idx = [];
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < segs; j++) {
      const a = i * (segs + 1) + j, b = a + segs + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const c0 = nWall;
  for (let j = 0; j < segs; j++) idx.push(c0, c0 + 1 + j, c0 + 2 + j);
  const f0 = nWall + nCap;
  for (let j = 0; j < segs; j++) idx.push(f0, f0 + 2 + j, f0 + 1 + j);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'liquid';
  const state = { fill: 1, up: new THREE.Vector3(0, 1, 0), ripple: 0, rippleT: 0 };
  const cosA = [], sinA = [];
  for (let j = 0; j <= segs; j++) { const a = (j / segs) * Math.PI * 2; cosA.push(Math.cos(a)); sinA.push(Math.sin(a)); }

  function rebuild() {
    const level = y0 + state.fill * (yFull - y0);
    const u = _u.copy(state.up).normalize();
    const uy = Math.max(0.25, u.y);
    // the surface height over a point (x, z) of the vessel's frame
    const surf = (x, z) => level - (u.x * x + u.z * z) / uy;
    const rip = state.ripple;
    for (let j = 0; j <= segs; j++) {
      // (the rim point: iterate twice so the radius matches its height)
      let r = rAt(level), yT = level;
      for (let k = 0; k < 3; k++) { yT = Math.min(yTop, Math.max(y0, surf(sinA[j] * r, cosA[j] * r))); r = rAt(yT); }
      // (rings spread from the middle: a small ripple on the rim)
      const wob = rip * 0.0012 * Math.sin(state.rippleT * 40 - r * 900);
      for (let i = 0; i <= rows; i++) {
        const t = i / rows;
        const y = y0 + (yT - y0) * t + wob * t;
        const rr = rAt(y);
        const p = (i * (segs + 1) + j) * 3;
        pos[p] = sinA[j] * rr; pos[p + 1] = y; pos[p + 2] = cosA[j] * rr;
      }
      const q = (c0 + 1 + j) * 3, top = (rows * (segs + 1) + j) * 3;
      pos[q] = pos[top]; pos[q + 1] = pos[top + 1]; pos[q + 2] = pos[top + 2];
      const fq = (f0 + 1 + j) * 3, bot = j * 3;
      pos[fq] = pos[bot]; pos[fq + 1] = pos[bot + 1]; pos[fq + 2] = pos[bot + 2];
    }
    pos[c0 * 3] = 0; pos[c0 * 3 + 1] = Math.min(yTop, Math.max(y0, level)) + rip * 0.0016 * Math.sin(state.rippleT * 40); pos[c0 * 3 + 2] = 0;
    pos[f0 * 3] = 0; pos[f0 * 3 + 1] = y0; pos[f0 * 3 + 2] = 0;
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    mesh.visible = state.fill > 0.004;
  }
  rebuild();
  return {
    mesh, state,
    set(fill = state.fill, up = null) {
      state.fill = Math.max(0, Math.min(1, fill));
      if (up) state.up.copy(up);
      rebuild();
    },
    ripple(k, dt = 1 / 60) {
      if (k <= 1e-3 && state.ripple <= 1e-3) return;
      state.ripple = k;
      state.rippleT += dt;
      rebuild();
    },
  };
}

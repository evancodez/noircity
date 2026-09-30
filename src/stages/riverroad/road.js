import * as THREE from 'three';

// The river road (scene 7, lane B5): one centre line, 1.3 km of it, and
// everything on the stage is placed along it by (s, d):
//   s  metres along the road from where the tail begins (0 .. ROAD.len)
//   d  metres across it, + to the right (the river), - to the left (the el)
// The road runs from the north (z ~ +1150) toward the south, ending near
// the world's origin: the close, the shots and the crash happen within the
// bullets' world (util/RayWorld.js keeps meshes within ~260 m of (0, -40)).
// Headings: h is the controller's yaw looking down the road (forward =
// (-sin h, -cos h)); a car's own heading (a group turned by rotation.y, its
// local +x forward) is h + PI / 2.
export const ROAD = {
  len: 1760,
  half: 6.5,          // the carriageway's half width (two lanes of 3.25 m)
  kerbR: 6.5,         // the river pavement: 6.5 .. 9.2
  rail: 9.2,          // the river railing (the car's right wall)
  quay: 9.6,          // the quay's edge: the water below
  waterY: -2.1,
  kerbL: -6.5,        // the el's pavement: -9.6 .. -6.5
  elA: -8.3,          // the el's near column line
  elB: -16.1,         // ... and its far one (the deck's centre -12.2)
  wall: -21.5,        // the warehouses' fronts (the car's left wall)
  pave: 0.15,
  // the story's marks on the road
  // (the chase ~1.3 km: a minute flat out, longer for a first-timer; the
  // close ~400 m, round the origin: the bullets' world)
  // (the freighter lies along the chase, not the close: wherever his tyre
  // goes, the wreck and the question have open water and the far bank
  // behind them, never a hull's black side)
  marks: { start: 14, train: 250, market: 400, marketEnd: 700, truck: 862, stand: 1012, oncoming: 1150, close: 1330, hull: 1195, end: 1740 },
  // where a failed stretch goes back to (the last one passed)
  checkpoints: [14, 420, 820, 1200],
};

const STEP = 1;              // samples every metre
const N = Math.ceil(ROAD.len / STEP) + 1;
// the bends: gentle, a few degrees either way, one long S through the market
function bend(s) {
  return 0.085 * Math.sin((s / 560) * Math.PI * 2 + 0.6) + 0.05 * Math.sin((s / 270) * Math.PI * 2 + 2.1)
    + 0.03 * Math.sin((s / 150) * Math.PI * 2 + 0.3);
}
const X = new Float32Array(N), Z = new Float32Array(N), H = new Float32Array(N);
{
  let x = 0, z = 0;
  for (let i = 0; i < N; i++) {
    const s = i * STEP, h = bend(s);
    X[i] = x; Z[i] = z; H[i] = h;
    const hm = bend(s + STEP / 2);
    x += -Math.sin(hm) * STEP; z += -Math.cos(hm) * STEP;
  }
  // the end of the road at (0, -260): the close lies round the origin
  const ox = -X[N - 1], oz = -260 - Z[N - 1];
  for (let i = 0; i < N; i++) { X[i] += ox; Z[i] += oz; }
}

const clampS = (s) => Math.max(0, Math.min(ROAD.len, s));
// the road's frame at s: the centre, forward and right (unit, xz), the yaw
export function frameAt(s, out = {}) {
  s = clampS(s);
  const f = s / STEP, i = Math.min(N - 2, Math.floor(f)), u = f - i;
  out.x = X[i] + (X[i + 1] - X[i]) * u;
  out.z = Z[i] + (Z[i + 1] - Z[i]) * u;
  const h = H[i] + (H[i + 1] - H[i]) * u;
  out.h = h;
  out.fx = -Math.sin(h); out.fz = -Math.cos(h);
  out.rx = Math.cos(h); out.rz = -Math.sin(h);
  return out;
}
const _f = {};
// a point on the road: s along, d across, y up
export function roadPoint(s, d = 0, y = 0, out = new THREE.Vector3()) {
  const F = frameAt(s, _f);
  return out.set(F.x + F.rx * d, y, F.z + F.rz * d);
}
// the road's heading at s as a car's rotation.y (local +x forward)
export const carYawAt = (s) => frameAt(s, _f).h + Math.PI / 2;
// the eye's yaw looking down the road
export const eyeYawAt = (s) => frameAt(s, _f).h;

// (x, z) -> { s, d }: the nearest centre sample, searched round a hint
// (a car's last s) or over the whole road
export function project(x, z, hint = null, out = {}) {
  let i0 = 0, i1 = N - 1;
  if (hint != null) { const c = Math.round(clampS(hint) / STEP); i0 = Math.max(0, c - 40); i1 = Math.min(N - 1, c + 40); }
  let bi = i0, bd = Infinity;
  const stride = hint != null ? 1 : 8;
  for (let i = i0; i <= i1; i += stride) {
    const d = (X[i] - x) ** 2 + (Z[i] - z) ** 2;
    if (d < bd) { bd = d; bi = i; }
  }
  if (stride > 1) {
    const a = Math.max(0, bi - 8), b = Math.min(N - 1, bi + 8);
    for (let i = a; i <= b; i++) { const d = (X[i] - x) ** 2 + (Z[i] - z) ** 2; if (d < bd) { bd = d; bi = i; } }
  }
  // refine along the segment's tangent
  const h = H[bi], fx = -Math.sin(h), fz = -Math.cos(h);
  const dx = x - X[bi], dz = z - Z[bi];
  const along = dx * fx + dz * fz;
  out.s = clampS(bi * STEP + along);
  out.d = dx * Math.cos(h) - dz * Math.sin(h);
  return out;
}

// the ground's height at (s, d): the carriageway 0, the pavements 0.15 (the
// kerb smoothed over 25 cm), the quay past the railing drops to the water
export function groundAt(d) {
  const ss = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const r = ss(ROAD.kerbR - 0.12, ROAD.kerbR + 0.12, d), l = 1 - ss(ROAD.kerbL - 0.12, ROAD.kerbL + 0.12, d);
  return ROAD.pave * Math.max(l, r);
}

export const ROAD_SAMPLES = { X, Z, H, N, STEP };

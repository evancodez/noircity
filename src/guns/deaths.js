import * as THREE from 'three';

// How a gunman dies where he is (lane C2): the fall is picked by what is
// beside him, and turned so the body fits on the floor that is there.
//   a wall at his back      deathSlumpWall: back against it, down it, sitting
//   the low cover he rose   deathSlumpOver: folded over it
//   from
//   room to fall            the Hood's own falls (deathBack, deathKnees,
//                           deathSpin), the one the round asked for if it fits
//   no room (a doorway,     deathSlump: onto his knees and over onto his side
//   furniture all round)
// Never thrown back through a desk, never sliding, never standing up through
// a table: each fall has a footprint (the floor its body comes to lie on,
// in his own frame) and is only chosen where the footprint is free.
//   chooseDeath(game, hood, dir, head, kind) -> { kind, yaw, slide: { x, z } | null }
const V = (x, y, z) => new THREE.Vector3(x, y, z);
// the floor each fall lies on, in his frame (+z ahead, +x his left), metres
export const PRINT = {
  deathBack: [[0, -0.5], [0, -1.0], [0, -1.5], [0.38, -1.15], [-0.38, -1.15], [0.45, -0.45], [-0.4, -0.4]],
  deathKnees: [[0, 0.5], [0, 0.95], [0, 1.35], [0.32, 1.0], [-0.32, 1.0], [0.3, 0.3], [-0.3, 0.3]],
  deathSpin: [[-0.55, 0.0], [-1.05, 0.05], [0.4, -0.15], [-0.8, 0.28], [-0.8, -0.28], [0.1, 0.3]],
  deathSlump: [[0.3, -0.1], [0.5, -0.35], [0.15, -0.5], [0.42, 0.22], [-0.1, -0.45]],
  deathSlumpWall: [[0, 0.45], [0.18, 0.72], [-0.15, 0.62]],
  deathSlumpOver: [[0, -0.3], [0.2, -0.25], [-0.2, -0.3]],
};
const PAD = 0.14;

// is the floor at (x, z) free for a body? (no wall, furniture, car, jamb;
// inside the stage's net; the living men do not count: he falls among them)
export function floorFree(stage, x, z, pad = PAD) {
  const C = stage.colliders;
  for (const c of C.circles) {
    if (c.tag === 'hood' || c.tag === 'corpse' || c.tag === 'cast') continue;
    if (Math.hypot(x - c.x, z - c.z) < c.r + pad) return false;
  }
  for (const b of C.boxes) {
    if (b.hx < 0.01 && b.hz < 0.01) continue;
    const dx = x - b.cx, dz = z - b.cz;
    const lx = dx * b.c - dz * b.s, lz = dx * b.s + dz * b.c;
    if (Math.abs(lx) < b.hx + pad && Math.abs(lz) < b.hz + pad) return false;
  }
  const inR = (R) => x > R.minX && x < R.maxX && z > R.minZ && z < R.maxZ;
  if (!inR(C.bounds) && !C.regions.some(inR)) return false;
  return true;
}
export function fits(stage, kind, x, z, yaw) {
  const P = PRINT[kind];
  if (!P) return true;
  const c = Math.cos(yaw), s = Math.sin(yaw);
  // (his frame: ahead (sin yaw, cos yaw), his left (cos yaw, -sin yaw))
  for (const [lx, lz] of P) if (!floorFree(stage, x + lx * c + lz * s, z - lx * s + lz * c)) return false;
  return true;
}

const _o = V(0, 0, 0), _d = V(0, 0, 0);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function chooseDeath(G, h, dir, head, kind0) {
  const S = G.stage, R = G.rays;
  const x = h.pos.x, z = h.pos.z, y = h.pos.y, yaw0 = h.yaw;
  const solid = (e) => !e.mesh.userData.pane && !(e.mesh.userData.cover && e.mesh.userData.cover.kind === 'glass');
  // 1. a wall (anything upright and solid) close at his back, the way the round throws him
  const back = Math.atan2(dir.x, dir.z);       // the round's way: he goes back along it
  for (const a of [back, yaw0 + Math.PI]) {
    _o.set(x, y + 0.85, z); _d.set(Math.sin(a), 0, Math.cos(a));
    const hit = R.raycast(_o, _d, 0.9, { skip: (e) => !solid(e) });
    if (hit && Math.abs(hit.normal.y) < 0.35 && hit.t > 0.2) {
      // face away from it, the root drawn back to 0.3 m off it
      const n = hit.normal.clone().setY(0).normalize();
      const yaw = Math.atan2(n.x, n.z);
      const sx = hit.point.x + n.x * 0.32, sz = hit.point.z + n.z * 0.32;
      // (a wall high enough to sit against: a ray at the shoulders hits it too)
      _o.set(sx, y + 1.25, sz); _d.set(-n.x, 0, -n.z);
      const tall = R.raycast(_o, _d, 0.6, { anyHit: true, skip: (e) => !solid(e) });
      if (tall && fits(S, 'deathSlumpWall', sx, sz, yaw) && floorFree(S, sx, sz, 0.12)) return { kind: 'deathSlumpWall', yaw, slide: { x: sx, z: sz } };
    }
  }
  // 2. the low cover he stood up from, before him (he rose over it to shoot)
  {
    const f = Math.atan2(G.eye.x - x, G.eye.z - z);
    for (const a of [f, yaw0]) {
      _o.set(x, y + 0.6, z); _d.set(Math.sin(a), 0, Math.cos(a));
      const low = R.raycast(_o, _d, 0.85, { skip: (e) => !solid(e) });
      if (!low || Math.abs(low.normal.y) > 0.35) continue;
      _o.set(x, y + 1.22, z);
      const high = R.raycast(_o, _d, 1.0, { anyHit: true, skip: (e) => !solid(e) });
      if (high) continue;
      // the top: a ray down onto it just past its face
      const tp = low.point.clone().addScaledVector(_d, 0.1); tp.y = y + 1.3;
      const down = R.raycast(tp, V(0, -1, 0), 1.0, { skip: (e) => !solid(e) });
      const top = down ? down.point.y - y : 0;
      if (top < 0.62 || top > 1.12) continue;
      const n = low.normal.clone().setY(0).normalize();
      const sx = low.point.x + n.x * 0.34, sz = low.point.z + n.z * 0.34;
      const yaw = Math.atan2(-n.x, -n.z);
      // (over it, the hat stays on: it would fly through what he lies on)
      if (floorFree(S, sx, sz, 0.1)) { h.hatFlies = false; return { kind: top > 0.92 ? 'deathSlumpOverHi' : 'deathSlumpOver', yaw, slide: { x: sx, z: sz } }; }
    }
  }
  // 3. the fall the round asked for, if it fits as he stands (or a little turned)
  for (const dy of [0, 0.35, -0.35, 0.7, -0.7]) if (fits(S, kind0, x, z, yaw0 + dy)) return { kind: kind0, yaw: wrap(yaw0 + dy), slide: null };
  // 4. another fall that fits
  for (const k of ['deathKnees', 'deathBack', 'deathSpin']) {
    if (k === kind0) continue;
    for (const dy of [0, 0.5, -0.5, 1.0, -1.0, 1.6, -1.6, Math.PI]) if (fits(S, k, x, z, yaw0 + dy)) return { kind: k, yaw: wrap(yaw0 + dy), slide: null };
  }
  // 5. the slump: in place, onto his knees and his side
  for (const dy of [0, 0.8, -0.8, 1.6, -1.6, Math.PI, 2.4, -2.4]) if (fits(S, 'deathSlump', x, z, yaw0 + dy)) return { kind: 'deathSlump', yaw: wrap(yaw0 + dy), slide: null };
  return { kind: 'deathSlump', yaw: yaw0, slide: null };
}

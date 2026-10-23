import * as THREE from 'three';
import { NavGrid } from '../enemies/Nav.js';
import { worldCoverPoints } from '../combat/guns/cover.js';   // [O4] cover from the world

// The places a gunman can hold (lane C2): read from the stage's colliders
// (every box or circle tagged as cover: a desk, a counter, crates, barrels,
// a car, a cabinet, a hydrant, a column) and the corners the stage names (a
// door's jamb, the end of a wall: `stage.coverCorners` [{ x, z, nx, nz }]).
// A point stands a man's width off a face, on free ground. Whether it hides
// him is asked against the player's eye at the moment (the line to his
// head crouched, and standing): `low` cover hides him only down (he rises
// over it to shoot), `tall` hides him standing (he steps out of it to shoot).
//   covers = new Covers(game)      covers.rebuild()      covers.points
//   covers.state(pt, eye)  ->  'tall' | 'low' | 'open'
//   covers.fire(pt, eye)   ->  { x, z, rise: bool } a place to shoot from (the
//                               point itself, risen; or a step out to its side)
export const COVER_TAGS = new Set(['booth', 'crates', 'barrels', 'car', 'stand', 'can', 'hydrant', 'column', 'bench']);
const OFF = 0.55;          // a point's distance from the face (a man's radius and a hand)
const STEP = 0.75;         // along a face

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _a = V(0, 0, 0), _b = V(0, 0, 0);

// every door of the stage (a part's `doors`; the gun kit's own list)
export function doorsOf(S) {
  const out = [];
  for (const p of S.parts.values()) if (p && p.doors) out.push(...Object.values(p.doors));
  if (S._c2doors) for (const D of Object.values(S._c2doors)) if (!out.includes(D)) out.push(D);
  return out;
}

export class Covers {
  constructor(game) {
    this.game = game;
    this.points = [];
  }

  // the nav grid as the room stands now (the doorways open: the men walk
  // through doors; a desk over on its front), and the points with it
  rebuild() {
    const G = this.game, S = G.stage, C = S.colliders;
    // (the doors' colliders out of the grid: a doorway is a way through)
    // (nor the dead: a body never blocks the living's way)
    // (a locked door stays shut in the grid: a man looking for a way never
    // paths through it - the way through it is an entry's, who has the key)
    const all = doorsOf(S);
    for (const D of all) if (D.locked && D.shut && !D.live && D.apply) { D.live = true; D.apply(); }
    const locked = new Set(all.filter((D) => D.locked && D.shut).map((D) => D.col));
    const doors = new Set(C.boxes.filter((b) => b.tag === 'door' && !locked.has(b)));
    // (out of the lists while the grid is built - not shrunk to a point: a
    // point still blocks the cells round it, and a shut leaf's point is the
    // doorway's middle)
    const boxes = C.boxes, circles = C.circles;
    // (a door that can stand open is in the grid as it stands open: the leaf
    // into the room is a thing to go round, the doorway a way through)
    const opened = all.filter((D) => doors.has(D.col) && D.openBox).map((D) => ({ ...D.col, ...D.openBox(), tag: 'door' }));
    C.boxes = [...boxes.filter((b) => !doors.has(b)), ...opened];
    C.circles = circles.filter((c) => c.tag !== 'corpse');
    // (a quarter-metre grid, 0.3 m round what stands: a 1 m doorway is a way
    // through - the stage's own 0.5 m grid closes it)
    try { S.nav = new NavGrid(C, { cell: 0.25, inflate: 0.3 }); } finally { C.boxes = boxes; C.circles = circles; }
    const nav = S.nav;
    const P = [];
    for (const b of C.boxes) {
      if (!COVER_TAGS.has(b.tag)) continue;
      // along each face, a man's width off it
      for (const [ax, sgn] of [[0, 1], [0, -1], [1, 1], [1, -1]]) {
        const half = ax === 0 ? b.hz : b.hx, out = ax === 0 ? b.hx : b.hz;
        const n = Math.max(1, Math.round((2 * half) / STEP));
        for (let i = 0; i < n; i++) {
          const s = n === 1 ? 0 : -half + (2 * half) * (i + 0.5) / n;
          // local (lx, lz): the face's normal along the axis
          const lx = ax === 0 ? sgn * (out + OFF) : s, lz = ax === 0 ? s : sgn * (out + OFF);
          const x = b.cx + lx * b.c + lz * b.s, z = b.cz - lx * b.s + lz * b.c;
          const nlx = ax === 0 ? sgn : 0, nlz = ax === 0 ? 0 : sgn;
          const nx = nlx * b.c + nlz * b.s, nz = -nlx * b.s + nlz * b.c;
          if (nav.free(x, z)) P.push({ x, z, nx, nz, obs: b, tag: b.tag, taken: null });
        }
      }
    }
    for (const c of C.circles) {
      if (!COVER_TAGS.has(c.tag)) continue;
      const n = c.r > 0.35 ? 8 : 6;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + 0.2;
        const nx = Math.cos(a), nz = Math.sin(a);
        const x = c.x + nx * (c.r + OFF), z = c.z + nz * (c.r + OFF);
        if (nav.free(x, z)) P.push({ x, z, nx, nz, obs: c, tag: c.tag, taken: null });
      }
    }
    for (const k of S.coverCorners || []) if (nav.free(k.x, k.z)) P.push({ x: k.x, z: k.z, nx: k.nx, nz: k.nz, obs: null, tag: 'corner', corner: true, taken: null });
    // [O4] an encounter in the open city ({ world: true }): whatever else is solid
    // in its area is cover too - a wall's face and its ends, a post, a crate
    const K = G.guns;
    if (K && K.cfg && K.cfg.world) for (const q of worldCoverPoints(G, nav, K.cfg.area)) P.push(q);
    this.points = P;
    return P;
  }

  floor(x, z) { return this.game.stage.surfaceY(x, z); }

  // the line from the eye to a man's head standing at (x, z), crouched or up
  seen(x, z, eye, crouched) {
    const y = this.floor(x, z) + (crouched ? 0.98 : 1.62);
    return this.game.guns.see(eye, _a.set(x, y, z), 0.2);
  }
  // (cover is judged against where I can shoot from: my place at a standing
  // eye's height - down behind something I would see nothing, up I see him)
  up(eye) { return this._up.set(eye.x, this.floor(eye.x, eye.z) + 1.62, eye.z); }
  get _up() { return this.__up || (this.__up = V(0, 0, 0)); }
  state(pt, eye0) {
    const eye = this.up(eye0).clone();
    if (this.seen(pt.x, pt.z, eye, true)) return 'open';
    return this.seen(pt.x, pt.z, eye, false) ? 'low' : 'tall';
  }

  // a place to shoot from: risen over a low cover; or a step out to the side
  // of a tall one, onto free ground, with a clear line from the gun to the
  // eye and room for the arm (a jamb, a wall: never a gun through it)
  fire(pt, eye0, st = null) {
    const G = this.game, nav = G.nav;
    const eye = this.up(eye0).clone();
    const s = st || this.state(pt, eye0);
    if (s === 'open') return { x: pt.x, z: pt.z, rise: false };
    const dx = eye.x - pt.x, dz = eye.z - pt.z, d = Math.hypot(dx, dz) || 1;
    const px = -dz / d, pz = dx / d;
    if (s === 'low' && this.armRoom(pt.x, pt.z, eye, px, pz)) return { x: pt.x, z: pt.z, rise: true };
    for (const k of [0.65, -0.65, 0.95, -0.95, 1.3, -1.3]) {
      const x = pt.x + px * k, z = pt.z + pz * k;
      if (!nav.free(x, z) || !nav.lineFree(pt.x, pt.z, x, z)) continue;
      if (!this.seen(x, z, eye, false)) continue;
      if (!this.armRoom(x, z, eye, px, pz)) continue;
      // [C2] after the critic: and his gun has the line too - out far enough
      // that the hand with the gun clears the jamb (his rounds went into it)
      if (!this.gunLine(x, z, eye, px, pz)) continue;
      return { x, z, rise: false, step: k };
    }
    return null;
  }
  // the line from his gun (in his right hand, 0.22 m to that side, at 1.35 m) to the eye.
  // ([px, pz] is his right as he faces the eye. [C2] after the critic's second
  // look: either side passed, and a man whose right side was behind a crate's
  // corner came out to it, raised, and could not fire - again and again)
  gunLine(x, z, eye, px, pz) {
    const G = this.game, y = this.floor(x, z) + 1.35;
    // (to my eye and to my chest - he aims at the chest of a man standing there)
    for (const ty of [eye.y, eye.y - 0.36]) {
      const o = _a.set(x + px * 0.22, y, z + pz * 0.22);
      const d = _b.set(eye.x - o.x, ty - o.y, eye.z - o.z);
      const L = d.length(); d.divideScalar(L);
      if (G.rays.raycast(o, d, Math.max(0.01, L - 0.3), { anyHit: true, skip: (e) => !!e.mesh.userData.pane })) return false;
    }
    return true;
  }
  // a gun held out at the eye from (x, z): no wall within the arm's reach -
  // from his right shoulder ([px, pz] his right as he faces the eye)
  armRoom(x, z, eye, px = 0, pz = 0) {
    const G = this.game;
    const o = _a.set(x + px * 0.18, this.floor(x, z) + 1.38, z + pz * 0.18);
    const d = _b.set(eye.x - o.x, eye.y - o.y, eye.z - o.z).normalize();
    return !G.rays.raycast(o, d, 0.85, { anyHit: true, skip: (e) => !!e.mesh.userData.pane });
  }
}

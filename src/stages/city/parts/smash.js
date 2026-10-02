import * as THREE from 'three';
import { allocInkId, markFigure } from '../../../render/layers.js';
import { lathe, merge } from '../../../world/geom.js';
import { crateGeo, CRATE, BARREL, stallGeo, fenceGeo, FENCE, standGeo, hydrantGeo } from '../../riverroad/smashKinds.js';
import { NS, EW, NS_LIST, EW_LIST, PAVE, RIVER, riverFrame, riverPoint, riverSAtZ, blockAt, ROADWORKS, WHARF_X, groundAt, PELL, CINEMA, SPECIAL } from '../plan.js';

// What a car goes through in the city (the river road's things: fruit
// crates, stalls, barrels, newsstands, board fences, hydrants; and the
// city's own: dustbins, the roadworks' sawhorses). They stand as instances
// (one draw per kind); a car that meets one bursts it: its pieces take the
// car's speed and fly up over its hood, tumble, bounce and settle where they
// fall (a piece lying in the road is kicked again by the next car). A
// hydrant goes off its stem: a geyser. What he knocks over marks where he
// went. Placed in the market square (stalls in rows: a car can go through),
// the wharf market on the river road's apron, the pavements' clutter.
//   smash.collide(car, out) -> [items it burst this step] (item.drag)
//   smash.kickPieces(car)   smash.spill(item, vel)   smash.near(x, z, r, out)
//   smash.items, smash.byTag(tag)
// Events on the game: 'smash' { kind, pos, speed, by, item }.
const G = 9.8;
const CELL = 10;
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _m = new THREE.Matrix4(), _s = new THREE.Vector3();

// [3rd owner] (the critic: a row of eight stalls at 50 km/h cost nothing and
// the speed rose) drag: the speed kept through one; dmg: the damage it costs
// my car (Car.hurt; four is a wreck) - a stall takes about a third of the
// speed and an eighth of a step, a row of them a lamp; a crate or a bin next
// to nothing. The same for every car: he pays it too.
const KIND = {
  crate: { r: 0.42, drag: 0.975, dmg: 0.01, sound: 'smash_crate' },
  barrel: { r: 0.36, drag: 0.95, dmg: 0.03, sound: 'smash_barrel' },
  stall: { r: 1.35, drag: 0.68, dmg: 0.14, sound: 'smash_stall' },
  fence: { r: 1.1, drag: 0.86, dmg: 0.05, sound: 'smash_fence' },
  stand: { r: 0.95, drag: 0.78, dmg: 0.1, sound: 'smash_stand' },
  hydrant: { r: 0.22, drag: 0.88, dmg: 0.08, sound: 'smash_hydrant' },
  bin: { r: 0.33, drag: 0.965, dmg: 0.01, sound: 'city_bin' },
  horse: { r: 0.9, drag: 0.93, dmg: 0.02, sound: 'smash_fence' },
  // [2nd owner] a dairy's milk cans, a café's tables and chairs
  can: { r: 0.21, drag: 0.985, sound: 'city_bin' },
  table: { r: 0.4, drag: 0.975, sound: 'smash_crate' },
  chair: { r: 0.27, drag: 0.985, sound: 'smash_crate' },
};

// a sawhorse (two A-legs, a rail, a white board); the dustbin is binLite below
function horseGeo() {
  const P = [];
  for (const x of [-0.85, 0.85]) for (const z of [-0.22, 0.22]) P.push(new THREE.BoxGeometry(0.06, 1.05, 0.06).rotateX(z > 0 ? -0.22 : 0.22).translate(x, 0.5, z * 0.6));
  P.push(new THREE.BoxGeometry(2.0, 0.08, 0.09).translate(0, 0.98, 0));
  return merge(P);
}
function boardGeo() { return new THREE.BoxGeometry(1.9, 0.22, 0.03).translate(0, 0.8, 0.07); }
// [2nd owner] the city's lighter builds of what stands in hundreds (each
// pool is one draw of every instance in three passes, never culled): the
// fruit heaped in a crate (12 apples of 5 x 4 sides: 672 -> 360 triangles),
// a barrel (16 sides, its hoops thinner: 1672 -> 760), a dustbin (14 sides:
// 1120 -> 790)
// a milk can (a churn: the shoulder, the neck, the lid, a band), a café's
// round table on its stem and a bentwood chair
function canGeo() {
  const body = lathe([[0, 0], [0.16, 0], [0.17, 0.02], [0.17, 0.4], [0.19, 0.44], [0.19, 0.5], [0.12, 0.6], [0.1, 0.66], [0.13, 0.68], [0.13, 0.71], [0, 0.72]], 12);
  return merge([body, new THREE.TorusGeometry(0.172, 0.012, 3, 12).rotateX(Math.PI / 2).translate(0, 0.2, 0)]);
}
function tableGeo() {
  return merge([new THREE.CylinderGeometry(0.36, 0.36, 0.03, 18).translate(0, 0.73, 0), new THREE.CylinderGeometry(0.025, 0.03, 0.7, 6).translate(0, 0.37, 0),
    new THREE.CylinderGeometry(0.2, 0.22, 0.03, 12).translate(0, 0.015, 0)]);
}
function chairGeo() {
  const P = [new THREE.CylinderGeometry(0.2, 0.2, 0.03, 14).translate(0, 0.45, 0)];
  for (const [x, z] of [[-0.14, -0.14], [0.14, -0.14], [-0.14, 0.14], [0.14, 0.14]]) P.push(new THREE.CylinderGeometry(0.013, 0.013, 0.46, 5).translate(x, 0.225, z));
  P.push(new THREE.TorusGeometry(0.15, 0.012, 4, 14, Math.PI).translate(0, 0.72, -0.17));
  for (const x of [-0.15, 0.15]) P.push(new THREE.CylinderGeometry(0.012, 0.012, 0.28, 5).translate(x, 0.6, -0.17));
  return merge(P);
}
function fruitLite(rng) {
  const parts = [];
  for (let i = 0; i < 12; i++) {
    const r = 0.055 + rng.next() * 0.015;
    parts.push(new THREE.SphereGeometry(r, 5, 4).translate(-0.24 + (i % 4) * 0.16 + rng.gauss() * 0.015, 0.3 + (i % 3 === 1 ? 0.03 : 0), -0.12 + Math.floor(i / 4) * 0.12 + rng.gauss() * 0.015));
  }
  return merge(parts);
}
function barrelLite() {
  const prof = [];
  for (let i = 0; i <= 10; i++) { const u = i / 10; prof.push([0.25 + 0.045 * Math.sin(u * Math.PI), u * 0.86]); }
  const body = lathe([[0, 0], ...prof, [0, 0.86]], 16);
  const hoops = [0.08, 0.26, 0.6, 0.78].map((y) => new THREE.TorusGeometry(0.25 + 0.045 * Math.sin((y / 0.86) * Math.PI) + 0.006, 0.012, 3, 16).rotateX(Math.PI / 2).translate(0, y, 0));
  return merge([body, ...hoops]);
}
function binLite() {
  const prof = [[0, 0.02], [0.24, 0.02], [0.25, 0.05]];
  for (let i = 0; i < 6; i++) { const y = 0.08 + i * 0.14; prof.push([0.26, y], [0.275, y + 0.035], [0.26, y + 0.07]); }
  prof.push([0.265, 0.92], [0.28, 0.94], [0.275, 0.96]);
  return merge([lathe(prof, 14), lathe([[0.3, 0.0], [0.29, 0.03], [0.22, 0.07], [0.08, 0.1], [0.05, 0.14], [0.0, 0.15]], 14).translate(0, 0.95, 0)]);
}

export default {
  name: 'smash', order: 85, tick: 85,
  build(stage) {
    const { scene, M } = stage;
    let rng = stage.rng.fork(851);
    const prng = stage.rng.fork(852);
    const group = new THREE.Group();
    group.name = 'smash';
    scene.add(group);
    const wood = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.8, envMap: M.envSoft, envMapIntensity: 0.25 });
    const fruitM = new THREE.MeshStandardMaterial({ color: 0x2c2c2c, roughness: 0.32, envMap: M.env, envMapIntensity: 0.5 });
    const canvas = new THREE.MeshStandardMaterial({ color: 0x262626, roughness: 0.9, side: THREE.DoubleSide });
    const paper = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 0.9, side: THREE.DoubleSide });
    const white = new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.7 });
    const iron = M.lampIron;
    const ZERO = new THREE.Matrix4().makeScale(0, 0, 0), ONE = new THREE.Vector3(1, 1, 1), UP = new THREE.Vector3(0, 1, 0);

    // ---- the pools of instances --------------------------------------------------------
    const pools = {};
    const pieces = [];
    const pool = (name, geo, mat, cap, { figure = false } = {}) => {
      const im = new THREE.InstancedMesh(geo, mat, cap);
      im.name = 'smash_' + name;
      im.userData.inkId = allocInkId();
      im.userData.inkPerInstance = false;
      im.userData.noRay = true;
      im.frustumCulled = false;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      if (figure) markFigure(im);
      for (let i = 0; i < cap; i++) im.setMatrixAt(i, ZERO);
      im.count = 0;
      group.add(im);
      const P = { name, im, cap, used: 0, free: [], owner: new Array(cap).fill(null) };
      pools[name] = P;
      return P;
    };
    const alloc = (P, owner) => {
      let i = P.free.length ? P.free.pop() : P.used < P.cap ? P.used++ : -1;
      if (P.im.count < P.used) P.im.count = P.used;
      if (i < 0) {
        // the pool is full: the settled piece furthest from the eye goes
        const cam = stage.game ? stage.game.camera.position : null;
        let best = -1, bd = -1;
        for (let k = 0; k < P.cap; k++) {
          const o = P.owner[k];
          if (!o || !o.piece || !o.rest) continue;
          const d = cam ? o.pos.distanceToSquared(cam) : o.t;
          if (d > bd) { bd = d; best = k; }
        }
        if (best < 0) return -1;
        pieces.splice(pieces.indexOf(P.owner[best]), 1);
        i = best;
      }
      P.owner[i] = owner;
      return i;
    };
    const release = (P, i) => { P.im.setMatrixAt(i, ZERO); P.owner[i] = null; P.free.push(i); P.im.instanceMatrix.needsUpdate = true; };
    const setM = (P, i, pos, q, scale) => { _m.compose(pos, q, scale); P.im.setMatrixAt(i, _m); P.im.instanceMatrix.needsUpdate = true; };
    const stallG = stallGeo(), standG = standGeo();
    pool('crate', crateGeo(), wood, 520);
    pool('fruit', fruitLite(stage.rng.fork(853)), fruitM, 520);
    pool('barrel', barrelLite(), wood, 160);
    pool('stallFrame', stallG.frame, wood, 70);
    pool('awning', stallG.awning, canvas, 70);
    pool('fence', fenceGeo(), wood, 90);
    pool('stand', standG.frame, wood, 8);
    pool('standPapers', standG.papers, paper, 8);
    pool('hydrant', hydrantGeo(), iron, 40, { figure: true });
    pool('bin', binLite(), M.paintedMetal, 90);
    pool('horse', horseGeo(), wood, 12);
    pool('can', canGeo(), M.paintedMetal, 30);
    pool('table', tableGeo(), white, 10);
    pool('chair', chairGeo(), wood, 20);
    pool('board', boardGeo(), white, 12);
    pool('plank', new THREE.BoxGeometry(1, 1, 1), wood, 1100);
    pool('apple', new THREE.SphereGeometry(1, 9, 7), fruitM, 800);
    pool('sheet', new THREE.PlaneGeometry(1, 1), paper, 300);
    pool('cloth', new THREE.PlaneGeometry(1, 1, 2, 2), canvas, 80);

    // ---- the things ------------------------------------------------------------------
    const items = [];
    const cells = new Map();
    const ck = (i, j) => i * 100003 + j;
    const place = (kind, x, z, yaw = 0, extra = {}) => {
      const pos = new THREE.Vector3(x, groundAt(x, z), z);
      const it = { kind, pos, yaw, alive: true, q: new THREE.Quaternion().setFromAxisAngle(UP, yaw), r: KIND[kind].r, drag: KIND[kind].drag, dmg: KIND[kind].dmg || 0, inst: [], ...extra };
      items.push(it);
      const k = ck(Math.floor(x / CELL), Math.floor(z / CELL));
      if (!cells.has(k)) cells.set(k, []);
      cells.get(k).push(it);
      return it;
    };
    const show = (it, name, off = null) => {
      const P = pools[name];
      const i = alloc(P, it);
      if (i < 0) return;
      const p = off ? it.pos.clone().add(off.clone().applyQuaternion(it.q)) : it.pos;
      setM(P, i, p, it.q, ONE);
      it.inst.push({ P, i });
    };
    const crates = (x, z, n = 2, high = 2, yaw = 0) => {
      const ax = Math.cos(yaw), az = -Math.sin(yaw);
      for (let j = 0; j < n; j++) for (let h = 0; h < high - (j % 2 && high > 1 ? rng.int(0, 1) : 0); h++) {
        const o = (j - (n - 1) / 2) * 0.66;
        const it = place('crate', x + ax * o + rng.gauss() * 0.03, z + az * o + rng.gauss() * 0.03, yaw + rng.gauss() * 0.06, { level: h });
        it.pos.y += h * CRATE.h;
        show(it, 'crate');
        if (h === high - 1 || rng.chance(0.3)) show(it, 'fruit');
        it.fruit = it.inst.length > 1;
      }
    };
    const barrels = (x, z, n = 3) => {
      for (let j = 0; j < n; j++) { const it = place('barrel', x + (j % 2) * 0.62 + rng.gauss() * 0.05, z + Math.floor(j / 2) * 0.62, rng.next() * 6); show(it, 'barrel'); }
    };
    const stall = (x, z, yaw, withCrates = true, tag = null) => {
      const it = place('stall', x, z, yaw, { tag });
      show(it, 'stallFrame'); show(it, 'awning');
      if (withCrates) {
        it.cargo = [];
        for (const [ox, oz, oy] of [[-0.8, -0.1, 0.88], [0.0, -0.05, 0.88], [0.8, -0.1, 0.88], [-0.4, 0.3, 0.0], [0.5, 0.35, 0.0]]) {
          if (!rng.chance(0.85)) continue;
          const c = { kind: 'crate', pos: null, inst: [], alive: true };
          const off = new THREE.Vector3(ox, oy, oz);
          const P = pools.crate, i = alloc(P, c), Pf = pools.fruit, fi = alloc(Pf, c);
          const p = it.pos.clone().add(off.applyQuaternion(it.q));
          setM(P, i, p, it.q, ONE); setM(Pf, fi, p, it.q, ONE);
          c.pos = p; c.q = it.q.clone(); c.inst.push({ P, i }, { P: Pf, i: fi }); c.fruit = true;
          it.cargo.push(c);
        }
      }
      return it;
    };
    const fence = (x, z, yaw, tag = null) => { const it = place('fence', x, z, yaw, { tag }); show(it, 'fence'); return it; };
    const hydrant = (x, z) => { const it = place('hydrant', x, z, 0); show(it, 'hydrant'); return it; };
    const bin = (x, z) => { const it = place('bin', x, z, rng.next() * 6); show(it, 'bin'); return it; };
    const horse = (x, z, yaw) => { const it = place('horse', x, z, yaw); show(it, 'horse'); show(it, 'board'); return it; };
    const cans = (x, z, ax, az, n) => { for (let j = 0; j < n; j++) { const it = place('can', x + ax * j * 0.42 + rng.gauss() * 0.03, z + az * j * 0.42 + rng.gauss() * 0.03, rng.next() * 6); show(it, 'can'); } };
    // (a table and its two chairs, the chairs turned to it)
    const cafe = (x, z) => {
      const t = place('table', x, z, rng.next() * 6); show(t, 'table');
      for (const s of [-1, 1]) { const a = rng.next() * 6, cx = x + Math.cos(a) * 0.62 * s, cz = z + Math.sin(a) * 0.62 * s; const c = place('chair', cx, cz, Math.atan2(cx - x, cz - z)); show(c, 'chair'); }
    };

    const wharf = [];
    const layout = () => {
      rng = stage.rng.fork(851);
      // the market square: three rows of stalls east-west, lanes between, a
      // car can go through anywhere (and he does, corner to corner)
      const sq = blockAt(1, 1);
      for (const z of [sq.z0 + 9, (sq.z0 + sq.z1) / 2, sq.z1 - 9]) {
        for (let x = sq.x0 + 5; x < sq.x1 - 4; x += rng.range(4.0, 5.2)) {
          if (rng.chance(0.12)) continue;
          stall(x, z + rng.gauss() * 0.2, rng.chance(0.5) ? 0 : Math.PI, true, 'square');
          if (rng.chance(0.4)) crates(x + rng.range(-1, 1), z + (rng.chance(0.5) ? 1.6 : -1.6), rng.int(1, 3), rng.int(1, 2), rng.next() * 0.4);
        }
      }
      for (let k = 0; k < 10; k++) barrels(rng.range(sq.x0 + 3, sq.x1 - 3), rng.range(sq.z0 + 3, sq.z1 - 3), rng.int(1, 3));
      // the wharf market: stalls along the river road's west pavement where the
      // apron is wide (between Market St and Clock St, and on past it a little:
      // its last stalls), crates and barrels between them and the road
      const wm = { s0: riverSAtZ(EW.market.z + 12), s1: riverSAtZ(EW.clock.z + 28) };
      for (let s = wm.s0; s < wm.s1; s += rng.range(4.2, 6)) {
        const f = riverFrame(s, {});
        if (Math.abs(f.z - EW.clock.z) < EW.clock.hw + 2) continue;
        const p = riverPoint(s, RIVER.hw + RIVER.pw + 1.4);
        if (p.x < WHARF_X + 2) continue;
        const yaw = Math.atan2(-f.fz, f.fx);
        wharf.push(stall(p.x, p.z, yaw, true, 'wharf'));
        if (rng.chance(0.55)) { const q = riverPoint(s + 1.5, RIVER.hw + 0.9); crates(q.x, q.z, rng.int(1, 3), rng.int(1, 2), yaw); }
        if (rng.chance(0.3)) { const q = riverPoint(s + 3, RIVER.hw + 1.2); barrels(q.x, q.z, rng.int(2, 3)); }
      }
      // (a market's overflow in the road's edge)
      for (let s = wm.s0 + 8; s < wm.s1; s += rng.range(22, 34)) { const q = riverPoint(s, RIVER.hw - 1.2); crates(q.x, q.z, rng.int(2, 3), rng.int(1, 2), riverFrame(s, {}).yaw); }
      // the pavements' clutter: a hydrant near every corner, dustbins by the
      // shop doors, crates outside some, a newsstand on a few corners
      for (const a of NS_LIST) for (const b of EW_LIST) {
        const S = NS[a], E = EW[b];
        if (rng.chance(0.75)) hydrant(S.x - S.hw - 0.6, E.z + E.hw + E.p + 3.5);
        if (rng.chance(0.22)) { const it = place('stand', S.x + S.hw + 1.6, E.z + E.hw + E.p + 4.5, Math.PI / 2); show(it, 'stand'); show(it, 'standPapers'); }
      }
      for (const a of NS_LIST) {
        const S = NS[a];
        for (let z = S.z0 + 12; z < S.z1 - 6; z += rng.range(14, 30)) {
          if (EW_LIST.some((k) => Math.abs(z - EW[k].z) < EW[k].hw + EW[k].p + 2)) continue;
          if (S.works && z > ROADWORKS.z0 - 4 && z < ROADWORKS.z1 + 4) continue;
          const side = rng.chance(0.5) ? 1 : -1;
          const x = S.x + side * (S.hw + S.p - 0.5);
          if (rng.chance(0.55)) bin(x, z); else crates(x, z, rng.int(1, 2), rng.int(1, 2), Math.PI / 2);
        }
      }
      for (const b of EW_LIST) {
        const E = EW[b];
        for (let x = E.x0 + 14; x < WHARF_X - 6; x += rng.range(14, 30)) {
          if (NS_LIST.some((k) => Math.abs(x - NS[k].x) < NS[k].hw + NS[k].p + 2) || Math.abs(x - PELL.x) < PELL.hw + PELL.pe + 1) continue;
          const side = rng.chance(0.5) ? 1 : -1;
          const z = E.z + side * (E.hw + E.p - 0.5);
          if (rng.chance(0.55)) bin(x, z); else crates(x, z, rng.int(1, 2), rng.int(1, 2), 0);
        }
      }
      // [2nd owner] a dairy's cans: a delivery left in the alley through the
      // block (he takes the alley when I am near: through them, ringing), and
      // rows of them by shop doors on Cooper and Water St; a café's tables
      // under the Bijou's marquee and along the square's north edge under the
      // bulbs (what a car mounting the kerb finds)
      {
        const ax = SPECIAL['3,2'].alleyNS;
        cans(ax - 0.9, -62, 1, 0.15, 4);
        cans(ax + 1.6, -48, 0, 1, 3);
        const C = NS.cooper;
        cans(C.x + C.hw + C.p - 0.6, -58, 0, 1, 4);
        const W = NS.water;
        cans(W.x - W.hw - W.p + 0.6, -142, 0, 1, 3);
        const fz = EW.fifth.z - EW.fifth.hw - EW.fifth.p / 2;
        for (const x of [CINEMA.x - 8.5, CINEMA.x - 5, CINEMA.x + 5.5, CINEMA.x + 9]) cafe(x, fz);
        const sq = blockAt(1, 1);
        for (const x of [sq.x0 + 10, sq.x0 + 22, sq.x1 - 14]) cafe(x, sq.z0 + 2.2);
      }
      // the roadworks on Baxter: sawhorses with their white boards across the
      // street at each end of the trench
      for (const z of [ROADWORKS.z0, ROADWORKS.z1]) for (const x of [-3.3, -1.1, 1.1, 3.3]) horse(NS.baxter.x + x, z, 0);
      // the coal yard's board fence (block 3,4: along Baxter's east and Fifth's
      // south pavement): it gives
      {
        const Y = blockAt(3, 4);
        for (let z = Y.z0 + 1.2; z < Y.z1 - 1; z += FENCE.w + 0.02) fence(Y.x0 + 0.1, z, Math.PI / 2, 'coal');
        for (let x = Y.x0 + 1.2; x < (Y.x0 + Y.x1) / 2 + 3; x += FENCE.w + 0.02) fence(x, Y.z0 + 0.1, 0, 'coal');
      }
    };
    layout();

    // ---- the pieces ------------------------------------------------------------------
    // [2nd owner] a thing that flies off whole (a crate, a barrel, a bin, a
    // hydrant, a can, a table, a chair) is drawn about its middle - its
    // geometry stands on its foot, so a whole piece was drawn half its
    // height above where it was, and lay on the road a hand off the stones
    // (a crate 0.17 m, a bin on its side 0.2 m): the matrix takes its
    // middle back to the piece's place, and the piece rests on the lowest
    // point of its box (or of its drum, rolled on its side) as it lies
    const _off = new THREE.Matrix4(), _mm = new THREE.Matrix4();
    const bbOf = (P) => { if (!P.bb) { const g = P.im.geometry; if (!g.boundingBox) g.computeBoundingBox(); const b = g.boundingBox; P.bb = { c: b.getCenter(new THREE.Vector3()), e: b.getSize(new THREE.Vector3()).multiplyScalar(0.5) }; } return P.bb; };
    const setPiece = (p) => {
      if (!p.bb) { setM(p.P, p.i, p.pos, p.q, p.scale); return; }
      _mm.compose(p.pos, p.q, p.scale).multiply(_off.makeTranslation(-p.bb.c.x, -p.bb.c.y, -p.bb.c.z));
      p.P.im.setMatrixAt(p.i, _mm); p.P.im.instanceMatrix.needsUpdate = true;
    };
    const halfY = (p) => {
      if (!p.bb) return p.pivotY ?? p.r * 0.5;
      const q = p.q, e = p.bb.e;
      const ax = Math.abs(2 * (q.x * q.y + q.w * q.z)), ay = Math.abs(1 - 2 * (q.x * q.x + q.z * q.z)), az = Math.abs(2 * (q.y * q.z - q.w * q.x));
      if (p.roll) return Math.max(e.x, e.z) * Math.sqrt(Math.max(0, 1 - ay * ay)) + e.y * ay;
      return ax * e.x + ay * e.y + az * e.z;
    };
    const piece = (name, pos, q, scale, vel, ang, { r = 0.1, paper: isPaper = false, whole = null, bounce = 0.3 } = {}) => {
      const P = pools[name];
      const p = { piece: true, name, P, pos: pos.clone(), q: q.clone(), scale: scale.clone(), vel: vel.clone(), ang: ang.clone(), r, paper: isPaper, rest: false, t: 0, bounce, whole, restT: 0 };
      const i = whole ? whole.i : alloc(P, p);
      if (i < 0) return null;
      p.i = i;
      P.owner[i] = p;
      if (whole) p.bb = bbOf(P);
      setPiece(p);
      pieces.push(p);
      return p;
    };
    const rnd = (a, b) => prng.range(a, b), gs = () => prng.gauss();
    const randQ = () => _q.setFromEuler(_e.set(rnd(0, 6.28), rnd(0, 6.28), rnd(0, 6.28))).clone();
    const flung = (carVel, spread = 1, lift = 1) => {
      const k = Math.min(1, carVel.length() / 20);
      return new THREE.Vector3(carVel.x * rnd(0.45, 1.05) + gs() * 2.2 * spread, rnd(2.0, 5.5) * lift * (0.4 + 0.8 * k) + rnd(0, 1.2), carVel.z * rnd(0.45, 1.05) + gs() * 2.2 * spread);
    };
    const spin = (k = 1) => new THREE.Vector3(gs() * 9 * k, gs() * 9 * k, gs() * 9 * k);
    const burstCrate = (c, carVel, whole = false) => {
      const [ci, fi] = c.inst;
      if (whole && ci) {
        const pc = piece('crate', c.pos.clone().setY(c.pos.y + CRATE.h / 2), c.q, ONE, flung(carVel, 0.6, 0.8), spin(0.7), { r: 0.22, whole: ci, bounce: 0.25 });
        if (pc) pc.pivotY = CRATE.h / 2;
        if (fi) release(fi.P, fi.i);
      } else {
        if (ci) release(ci.P, ci.i);
        if (fi) release(fi.P, fi.i);
        const n = 6 + prng.int(0, 3);
        for (let k = 0; k < n; k++) {
          const o = new THREE.Vector3(gs() * 0.2, CRATE.h * rnd(0.1, 0.9), gs() * 0.15).applyQuaternion(c.q).add(c.pos);
          const long = prng.chance(0.6);
          piece('plank', o, randQ(), new THREE.Vector3(long ? 0.62 : 0.4, 0.018, long ? 0.075 : 0.045), flung(carVel), spin(), { r: 0.04 });
        }
      }
      if (c.fruit) {
        const n = 7 + prng.int(0, 5);
        for (let k = 0; k < n; k++) {
          const o = new THREE.Vector3(gs() * 0.2, CRATE.h + 0.02, gs() * 0.14).applyQuaternion(c.q).add(c.pos);
          const r = rnd(0.05, 0.07);
          const pa = piece('apple', o, randQ(), new THREE.Vector3(r, r, r), flung(carVel, 1.4, 1.1), spin(0.5), { r, bounce: 0.45 });
          if (pa) pa.roll = true;
        }
      }
      c.alive = false; c.inst = [];
    };
    const wholeRoll = (it, name, h, r, v) => {
      const bi = it.inst[0];
      const p = piece(name, it.pos.clone().setY(it.pos.y + h / 2), it.q, ONE, flung(v, 0.5, 0.9), spin(0.6), { r, whole: bi, bounce: 0.3 });
      if (p) { p.pivotY = h / 2; p.roll = true; }
      for (const x of it.inst.slice(1)) release(x.P, x.i);
    };
    const burst = {
      crate: (it, v, slow) => burstCrate(it, v, slow || prng.chance(0.2)),
      barrel: (b, v) => {
        const bi = b.inst[0];
        if (prng.chance(0.55) && bi) wholeRoll(b, 'barrel', BARREL.h, 0.3, v);
        else {
          if (bi) release(bi.P, bi.i);
          for (let k = 0; k < 10; k++) {
            const a = (k / 10) * Math.PI * 2;
            const o = new THREE.Vector3(Math.cos(a) * 0.26, BARREL.h / 2, Math.sin(a) * 0.26).add(b.pos);
            piece('plank', o, new THREE.Quaternion().setFromEuler(_e.set(0, -a, Math.PI / 2 + gs() * 0.2)), new THREE.Vector3(0.84, 0.02, 0.15), flung(v, 1.2), spin(), { r: 0.05 });
          }
        }
        b.inst = [];
      },
      bin: (b, v) => { wholeRoll(b, 'bin', 0.96, 0.3, v); b.inst = []; },
      can: (b, v) => { wholeRoll(b, 'can', 0.72, 0.19, v); b.inst = []; },
      table: (it, v) => { const bi = it.inst[0]; const p = piece('table', it.pos.clone().setY(it.pos.y + 0.37), it.q, ONE, flung(v, 0.7, 1.0), spin(0.8), { r: 0.36, whole: bi, bounce: 0.3 }); if (p) p.pivotY = 0.37; it.inst = []; },
      chair: (it, v) => { const bi = it.inst[0]; const p = piece('chair', it.pos.clone().setY(it.pos.y + 0.4), it.q, ONE, flung(v, 1.0, 1.2), spin(1.0), { r: 0.25, whole: bi, bounce: 0.35 }); if (p) p.pivotY = 0.4; it.inst = []; },
      stall: (it, v) => {
        for (const x of it.inst) release(x.P, x.i);
        const top = it.pos.clone().setY(it.pos.y + 2.3);
        const cv = flung(v, 0.4, 1.4); cv.y += 2;
        piece('cloth', top, it.q.clone().multiply(new THREE.Quaternion().setFromEuler(_e.set(-Math.PI / 2 + 0.3, 0, 0))), new THREE.Vector3(3.2, 2.0, 1), cv, spin(0.35), { r: 0.05, paper: true });
        for (let k = 0; k < 4; k++) piece('plank', it.pos.clone().add(new THREE.Vector3(gs() * 0.8, rnd(0.3, 2.2), gs() * 0.5)), randQ(), new THREE.Vector3(2.3, 0.05, 0.05), flung(v, 0.8), spin(0.6), { r: 0.04 });
        for (let k = 0; k < 7; k++) piece('plank', it.pos.clone().add(new THREE.Vector3(gs() * 1.0, 0.86, gs() * 0.3)), randQ(), new THREE.Vector3(rnd(1.2, 3.0), 0.035, 0.17), flung(v), spin(0.8), { r: 0.04 });
        for (const c of it.cargo || []) if (c.alive) burstCrate(c, v, prng.chance(0.25));
        it.inst = [];
      },
      fence: (it, v) => {
        for (const x of it.inst) release(x.P, x.i);
        for (let k = 0; k < 12; k++) {
          const o = new THREE.Vector3(-1.1 + k * 0.19 + 0.095, 0.95, 0).applyQuaternion(it.q).add(it.pos);
          const q = it.q.clone().multiply(new THREE.Quaternion().setFromEuler(_e.set(gs() * 0.3, 0, gs() * 0.3)));
          piece('plank', o, q, new THREE.Vector3(0.17, 1.8, 0.022), flung(v, 0.8, 0.8), spin(0.6), { r: 0.06 });
        }
        for (let k = 0; k < 2; k++) piece('plank', it.pos.clone().setY(0.4 + k * 1.1), it.q, new THREE.Vector3(2.3, 0.09, 0.045), flung(v, 0.5, 0.6), spin(0.4), { r: 0.04 });
        it.inst = [];
      },
      horse: (it, v) => {
        for (const x of it.inst) release(x.P, x.i);
        piece('plank', it.pos.clone().setY(0.98), it.q, new THREE.Vector3(2.0, 0.08, 0.09), flung(v, 0.6, 0.9), spin(0.5), { r: 0.04 });
        piece('plank', it.pos.clone().setY(0.8), it.q, new THREE.Vector3(1.9, 0.22, 0.03), flung(v, 0.8, 1.0), spin(0.6), { r: 0.04 });
        for (let k = 0; k < 4; k++) piece('plank', it.pos.clone().setY(0.5), randQ(), new THREE.Vector3(0.06, 1.05, 0.06), flung(v, 1, 0.8), spin(0.7), { r: 0.04 });
        it.inst = [];
      },
      stand: (it, v) => {
        for (const x of it.inst) release(x.P, x.i);
        for (let k = 0; k < 60; k++) {
          const o = it.pos.clone().add(new THREE.Vector3(gs() * 0.5, rnd(0.8, 2.0), gs() * 0.5));
          const pv = flung(v, 1.6, 1.3); pv.multiplyScalar(0.8); pv.y += rnd(1, 4);
          piece('sheet', o, randQ(), new THREE.Vector3(rnd(0.3, 0.45), rnd(0.38, 0.55), 1), pv, spin(0.5), { r: 0.01, paper: true });
        }
        for (let k = 0; k < 8; k++) piece('plank', it.pos.clone().add(new THREE.Vector3(gs() * 0.5, rnd(0.2, 1.8), gs() * 0.4)), randQ(), new THREE.Vector3(rnd(0.9, 1.6), 0.03, rnd(0.5, 1.0)), flung(v, 1, 0.8), spin(0.5), { r: 0.05 });
        it.inst = [];
      },
      hydrant: (it, v) => {
        const hi = it.inst[0];
        const p = piece('hydrant', it.pos.clone().setY(it.pos.y + 0.45), it.q, ONE, flung(v, 0.4, 0.9), spin(0.7), { r: 0.16, whole: hi, bounce: 0.35 });
        if (p) p.pivotY = 0.4;
        it.geyser = { at: it.pos.clone(), t: 0 };
        geysers.push(it.geyser);
        it.inst = [];
      },
    };
    const geysers = [];
    const near = [];

    // ---- per step ---------------------------------------------------------------------
    const api = {
      group, items, pools, pieces, geysers, wharf,
      byTag: (tag) => items.filter((i) => i.tag === tag),
      near(x, z, r, out = []) {
        out.length = 0;
        for (let i = Math.floor((x - r) / CELL); i <= Math.floor((x + r) / CELL); i++) for (let j = Math.floor((z - r) / CELL); j <= Math.floor((z + r) / CELL); j++) {
          const L = cells.get(ck(i, j));
          if (L) for (const it of L) if (it.alive) out.push(it);
        }
        return out;
      },
      smash(it, vel, by = null) {
        if (!it.alive) return;
        it.alive = false;
        burst[it.kind](it, vel, vel.length() < 6);
        const g = stage.game;
        if (g) {
          g.sfx.play(KIND[it.kind].sound, it.pos, { k: Math.min(1, vel.length() / 18) }, { ref: 4 });
          g.emit('smash', { kind: it.kind, pos: it.pos, speed: vel.length(), by, item: it });
          if (it.kind === 'hydrant') g.sfx.play('hydrant', it.pos, { dur: 4 }, { ref: 4 });
        }
      },
      spill(it, vel) {
        if (!it.alive) return;
        if (it.kind === 'stall') { for (const c of it.cargo || []) if (c.alive && prng.chance(0.8)) burstCrate(c, vel.clone().multiplyScalar(rnd(0.7, 1.2)), true); return; }
        this.smash(it, vel);
      },
      collide(v, hit = []) {
        hit.length = 0;
        const list = this.near(v.pos.x, v.pos.z, v.spec.halfL + 2, near);
        for (const it of list) {
          if (!v.overlaps(it.pos, it.r, it.pos.y - 0.2 - (v.groundY || 0), it.pos.y + 2.2)) continue;
          this.smash(it, v.vel3(_v).clone(), v);
          hit.push(it);
        }
        return hit;
      },
      // [3rd owner] a piece the car meets is kicked out of its way, never up
      // into it (the critic: thrown up at the car's own speed, a fruit fell
      // back through the bonnet and sat between my hands): at the front, on
      // ahead of the bumper, faster than the car and low; under or beside
      // the body, out of its side
      kickPieces(v) {
        const sp = v.speedAbs;
        if (sp < 1.5) return 0;
        let n = 0;
        const c = Math.cos(v.yaw), sn = Math.sin(v.yaw), S = v.spec;
        for (const p of pieces) {
          if (p.pos.y > 1.9 || Math.abs(p.pos.x - v.pos.x) > 3.5 || Math.abs(p.pos.z - v.pos.z) > 3.5) continue;
          if (!v.overlaps(p.pos, p.r + 0.05, -1, 1.6)) continue;
          const kv = v.vel3(_v);
          const dx = p.pos.x - v.pos.x, dz = p.pos.z - v.pos.z;
          const lx = dx * c - dz * sn, lz = dx * sn + dz * c;
          // (the car's right, in the world: (sn, c))
          const side = lz >= 0 ? 1 : -1;
          if (lx > S.halfL - 0.7 && p.pos.y - (v.groundY || 0) < 0.9) {
            const k = rnd(1.15, 1.4), out = gs() * 1.4 + side * rnd(0.5, 2.0);
            p.vel.set(kv.x * k + sn * out, rnd(0.8, 2.2) * Math.min(1, sp / 12) + (p.paper ? 1.2 : 0), kv.z * k + c * out);
          } else {
            const out = rnd(2.5, 4.5) * side;
            const nz = side * (S.halfW + p.r + 0.06);
            p.pos.x = v.pos.x + lx * c + nz * sn; p.pos.z = v.pos.z - lx * sn + nz * c;
            p.vel.set(kv.x * rnd(0.5, 0.8) + sn * out, rnd(0.6, 1.6) + (p.paper ? 1 : 0), kv.z * rnd(0.5, 0.8) + c * out);
          }
          p.ang.copy(spin(0.6));
          p.rest = false; p.restT = 0;
          n++;
        }
        return n;
      },
      update(dt, t) {
        this.t = t;
        // what flies back into my windscreen is thrown off it, up and over
        const G0 = stage.game, me = G0 && G0.vehicles && G0.vehicles.player;
        if (me && me.model && me.model.wheel) {
          const c = Math.cos(me.yaw), sn = Math.sin(me.yaw);
          for (const p of pieces) {
            if (p.rest || p.pos.y < me.pos.y + 1.0 || p.pos.y > me.pos.y + 1.95) continue;
            const dx = p.pos.x - me.pos.x, dz = p.pos.z - me.pos.z;
            const lx = dx * c - dz * sn, lz = dx * sn + dz * c;
            if (lx < 0.25 || lx > 0.85 || Math.abs(lz) > 0.7) continue;
            const rvx = (p.vel.x - me.vel.x) * c - (p.vel.z - me.vel.z) * sn;
            if (rvx > -0.5) continue;
            p.vel.set(me.vel.x + (p.vel.x - me.vel.x) * -0.25, 2.5 + Math.random() * 3, me.vel.z + (p.vel.z - me.vel.z) * -0.25);
            p.ang.multiplyScalar(-0.6);
            if (!p.paper) G0.emit('screenHit', { pos: p.pos.clone(), k: Math.min(1, -rvx / 12), lz });
          }
          // [3rd owner] nothing inside my car's body (the bonnet, the cabin,
          // the boot, up to the roof): a piece found in it is put on the
          // surface over it - the bonnet, the roof, the boot lid - and thrown
          // up and back off it, or out of its side if it is low by a door
          const S = me.spec, gy = me.groundY ?? me.pos.y;
          const inBody = (x, y, z, r) => {
            const dx = x - me.pos.x, dz = z - me.pos.z;
            const lx = dx * c - dz * sn, lz = dx * sn + dz * c, ly = y - gy;
            if (Math.abs(lx) > S.halfL + r * 0.5 || Math.abs(lz) > S.halfW + r * 0.5) return null;
            const top = lx > 0.85 ? 1.06 : lx < -1.05 ? 1.1 : 1.6;
            // (under the floor - a plank flat on the stones, a fruit in the
            // road - is under the car, not in it: kickPieces has those)
            if (ly > top + r || ly < 0.28) return null;
            return { lx, lz, ly, top };
          };
          for (const p of pieces) {
            const half = p.name === 'plank' ? p.scale.x * 0.5 : 0;
            if (Math.abs(p.pos.x - me.pos.x) > 3.2 + half || Math.abs(p.pos.z - me.pos.z) > 3.2 + half) continue;
            const r = Math.min(p.r, 0.12);
            let hit = inBody(p.pos.x, p.pos.y, p.pos.z, r), lift = hit ? hit.top + r - hit.ly : 0;
            // (a long plank or a stall's pole: its two ends too - a pole whose
            // middle is outside crossed the windscreen inside the glass)
            if (half > 0.35) {
              _v.set(half, 0, 0).applyQuaternion(p.q);
              for (const k of [1, -1]) {
                const e = inBody(p.pos.x + _v.x * k, p.pos.y + _v.y * k, p.pos.z + _v.z * k, 0.03);
                if (e) { const l = e.top + 0.05 - e.ly; if (!hit || l > lift) { hit = hit || e; lift = Math.max(lift, l); } }
              }
              if (hit && lift > 0) { p.pos.y += lift + 0.02; const back = rnd(2, 4); p.vel.set(me.vel.x - c * back + gs() * 1.2, rnd(2.0, 3.4), me.vel.z + sn * back + gs() * 1.2); p.rest = false; p.restT = 0; }
              continue;
            }
            if (!hit) continue;
            const { lx, lz, ly, top } = hit;
            const side = lz >= 0 ? 1 : -1;
            const rx = me.vel.x, rz = me.vel.z;
            if (ly < 0.75 && S.halfW + r - Math.abs(lz) < 0.35) {
              const nz = side * (S.halfW + r + 0.04);
              p.pos.x = me.pos.x + lx * c + nz * sn; p.pos.z = me.pos.z - lx * sn + nz * c;
              const out = rnd(1.5, 3) * side;
              p.vel.set(rx + sn * out, Math.max(0.5, p.vel.y), rz + c * out);
            } else {
              p.pos.y = gy + top + r + 0.02;
              const back = rnd(2, 4.5), out = gs() * 1.6 + side * 0.8;
              p.vel.set(rx - c * back + sn * out, rnd(2.2, 3.8), rz + sn * back + c * out);
            }
            p.rest = false; p.restT = 0;
          }
        }
        for (let j = pieces.length - 1; j >= 0; j--) {
          const p = pieces[j];
          if (p.rest) continue;
          p.t += dt;
          if (p.paper) {
            p.vel.y -= G * 0.28 * dt;
            p.vel.multiplyScalar(Math.exp(-1.6 * dt));
            p.vel.x += Math.sin(p.t * 5.3 + j) * 1.2 * dt; p.vel.z += Math.cos(p.t * 4.1 + j * 0.7) * 1.2 * dt;
          } else {
            p.vel.y -= G * dt;
            p.vel.multiplyScalar(Math.exp(-0.08 * dt));
          }
          p.pos.addScaledVector(p.vel, dt);
          const w = p.ang.length();
          if (w > 1e-4) { _q.setFromAxisAngle(_v.copy(p.ang).divideScalar(w), w * dt); p.q.premultiply(_q); }
          const gy = groundAt(p.pos.x, p.pos.z) + halfY(p);
          if (p.pos.y < gy) {
            p.pos.y = gy;
            if (p.vel.y < -1.2 && !p.paper) {
              p.vel.y *= -p.bounce; p.ang.multiplyScalar(0.55); p.vel.x *= 0.7; p.vel.z *= 0.7;
            } else {
              p.vel.y = 0;
              const fr = p.roll ? 1.1 : p.paper ? 9 : 5;
              p.vel.x *= Math.exp(-fr * dt); p.vel.z *= Math.exp(-fr * dt);
              p.ang.multiplyScalar(Math.exp(-(p.roll ? 1.2 : 6) * dt));
              if (!p.roll || Math.hypot(p.vel.x, p.vel.z) < 0.5) settleFlat(p, dt);
            }
            if (Math.hypot(p.vel.x, p.vel.z) < 0.08 && p.ang.length() < 0.2) { p.restT += dt; if (p.restT > 0.3) { p.rest = true; p.vel.set(0, 0, 0); p.ang.set(0, 0, 0); } }
          }
          setPiece(p);
        }
        const g = stage.game;
        for (const gz of geysers) {
          gz.t += dt;
          if (!g || gz.t > 30) continue;
          const k = Math.min(1, gz.t / 0.4) * (gz.t > 20 ? Math.max(0, 1 - (gz.t - 20) / 10) : 1);
          gz.acc = (gz.acc || 0) + dt * 90 * k;
          while (gz.acc >= 1) {
            gz.acc -= 1;
            g.fx.splash.spawn({ pos: gz.at.clone().setY(gz.at.y + 0.35), vel: new THREE.Vector3(gs() * 0.6, rnd(6, 10) * k, gs() * 0.6), life: rnd(1.0, 1.6), size: [0.03, 0.09], stretch: 0.06,
              col: [0.55, 0.55, 0.55], alpha: 0.9, cell: 1, gravity: 9.8, ground: 0.01, fadeOut: 0.2 });
          }
        }
      },
      // put everything back as it was built (a retry: the world as it was)
      reset() {
        pieces.length = 0;
        geysers.length = 0;
        for (const P of Object.values(pools)) { for (let i = 0; i < P.cap; i++) P.im.setMatrixAt(i, ZERO); P.free = []; P.used = 0; P.owner.fill(null); P.im.count = 0; P.im.instanceMatrix.needsUpdate = true; }
        items.length = 0; cells.clear(); wharf.length = 0;
        layout();
      },
    };
    const settleFlat = (p, dt) => {
      // ([2nd owner] a whole box - a crate, a hydrant, a table - comes down on
      // the face nearest the ground, never balanced on an edge)
      if (p.pivotY != null && !p.roll && !p.bb) return;
      const s = p.scale;
      let ax = s.x <= s.y && s.x <= s.z ? 0 : s.y <= s.z ? 1 : 2;
      if (p.bb && !p.roll) {
        const q = p.q, ys = [Math.abs(2 * (q.x * q.y + q.w * q.z)), Math.abs(1 - 2 * (q.x * q.x + q.z * q.z)), Math.abs(2 * (q.y * q.z - q.w * q.x))];
        ax = ys[0] >= ys[1] && ys[0] >= ys[2] ? 0 : ys[1] >= ys[2] ? 1 : 2;
      }
      _v.set(ax === 0 ? 1 : 0, ax === 1 ? 1 : 0, ax === 2 ? 1 : 0).applyQuaternion(p.q);
      const target = _s.set(0, _v.y >= 0 ? 1 : -1, 0);
      _q.setFromUnitVectors(_v, target);
      p.q.premultiply(new THREE.Quaternion().slerp(_q, 1 - Math.exp(-10 * dt)));
    };
    void PAVE;
    return api;
  },
  update: (s, dt, t) => s.update(dt, t),
};

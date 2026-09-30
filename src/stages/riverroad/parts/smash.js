import * as THREE from 'three';
import { allocInkId, markFigure } from '../../../render/layers.js';
import { ROAD, roadPoint, frameAt, project } from '../road.js';
import { crateGeo, fruitHeapGeo, CRATE, barrelGeo, BARREL, stallGeo, STALL, fenceGeo, FENCE, standGeo, STAND, hydrantGeo } from '../smashKinds.js';

// What a car goes through on the river road (lane B5): fruit crates, the
// market's stalls, barrels, the newsstand, board fences, hydrants. They
// stand as instances (one draw per kind for the whole road); a car that
// meets one bursts it: its pieces (slats, apples, staves, papers, boards,
// the awning's canvas) take the car's speed and fly up over its hood,
// tumble, bounce and settle where they fall and stay (a piece lying in the
// road is kicked again by the next car). A barrel or a crate may go whole.
// A hydrant goes off its stem: a geyser.
//   smash.collide(vehicle)  -> [items it burst this step] (the vehicle loses
//                              a little speed for each: item.drag)
//   smash.kickPieces(vehicle)  the pieces in its way
//   smash.spill(item, vel)  knocked into the road without a car through it
//                           (the watcher's swerve)
//   smash.items, smash.near(s0, s1), smash.update(dt)
// Events on the game: 'smash' { kind, pos, speed, by }.
const G = 9.8;
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _m = new THREE.Matrix4(), _s = new THREE.Vector3();
const F = {};

// how each kind goes: its collision radius, how much it slows a car, what
// it comes apart into
const KIND = {
  crate: { r: 0.42, drag: 0.985, sound: 'smash_crate' },
  barrel: { r: 0.36, drag: 0.97, sound: 'smash_barrel' },
  stall: { r: 1.35, drag: 0.93, sound: 'smash_stall' },
  fence: { r: 1.1, drag: 0.95, sound: 'smash_fence' },
  stand: { r: 0.95, drag: 0.9, sound: 'smash_stand' },
  hydrant: { r: 0.22, drag: 0.94, sound: 'smash_hydrant' },
};

export default {
  name: 'smash', order: 85, tick: 85,
  build(stage) {
    const { scene, M } = stage;
    const rng = stage.rng.fork(851);
    const prng = stage.rng.fork(852);
    const group = new THREE.Group();
    group.name = 'smash';
    scene.add(group);
    const wood = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.8, envMap: M.envSoft, envMapIntensity: 0.25 });
    const fruitM = new THREE.MeshStandardMaterial({ color: 0x2c2c2c, roughness: 0.32, envMap: M.env, envMapIntensity: 0.5 });
    const canvas = new THREE.MeshStandardMaterial({ color: 0x262626, roughness: 0.9, side: THREE.DoubleSide });
    const paper = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 0.9, side: THREE.DoubleSide });
    const iron = M.lampIron;

    // ---- the pools of instances -------------------------------------------------
    const pools = {};
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
      im.count = 0;   // (only the instances in use are drawn: alloc raises it)
      group.add(im);
      const P = { name, im, cap, used: 0, free: [], owner: new Array(cap).fill(null) };
      pools[name] = P;
      return P;
    };
    const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
    const alloc = (P, owner) => {
      let i = P.free.length ? P.free.pop() : P.used < P.cap ? P.used++ : -1;
      if (P.im.count < P.used) P.im.count = P.used;
      if (i < 0) {
        // the pool is full: the oldest settled piece far from the eye goes
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
    pool('crate', crateGeo(), wood, 420);
    pool('fruit', fruitHeapGeo(rng), fruitM, 420);
    pool('barrel', barrelGeo(), wood, 110);
    pool('stallFrame', stallG.frame, wood, 40);
    pool('awning', stallG.awning, canvas, 40);
    pool('fence', fenceGeo(), wood, 70);
    pool('stand', standG.frame, wood, 4);
    pool('standPapers', standG.papers, paper, 4);
    pool('hydrant', hydrantGeo(), iron, 16, { figure: true });
    // the pieces (unit shapes, scaled per piece)
    pool('plank', new THREE.BoxGeometry(1, 1, 1), wood, 900);
    pool('apple', new THREE.SphereGeometry(1, 9, 7), fruitM, 700);
    pool('sheet', new THREE.PlaneGeometry(1, 1), paper, 260);
    pool('cloth', new THREE.PlaneGeometry(1, 1, 2, 2), canvas, 60);

    // ---- the things, placed along the road -----------------------------------------
    const items = [];
    const buckets = new Map();
    const place = (kind, s, d, yaw = 0, extra = {}) => {
      frameAt(Math.max(0, Math.min(ROAD.len, s)), F);
      const pos = roadPoint(s, d, 0);
      pos.y = groundY(d);
      const ry = F.h + Math.PI / 2 + yaw;
      const it = { kind, s, d, pos, yaw: ry, alive: true, q: new THREE.Quaternion().setFromAxisAngle(UP, ry), r: KIND[kind].r, drag: KIND[kind].drag, inst: [], ...extra };
      items.push(it);
      const k = Math.floor(s / 10);
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(it);
      return it;
    };
    const UP = new THREE.Vector3(0, 1, 0);
    const show = (it, name, off = null, qx = null) => {
      const P = pools[name];
      const i = alloc(P, it);
      if (i < 0) return;
      const p = off ? it.pos.clone().add(off.clone().applyQuaternion(it.q)) : it.pos;
      const q = qx ? it.q.clone().multiply(qx) : it.q;
      setM(P, i, p, q, ONE);
      it.inst.push({ P, i, off, qx });
    };
    const ONE = new THREE.Vector3(1, 1, 1);
    // a stack of crates (1 .. 3 high, a row of n)
    const crates = (s, d, n = 2, high = 2, yaw = 0) => {
      for (let j = 0; j < n; j++) for (let h = 0; h < high - (j % 2 && high > 1 ? rng.int(0, 1) : 0); h++) {
        const it = place('crate', s + (j - (n - 1) / 2) * 0.66, d + rng.gauss() * 0.03, yaw + rng.gauss() * 0.06, { level: h });
        it.pos.y += h * CRATE.h;
        show(it, 'crate');
        if (h === high - 1 || rng.chance(0.3)) show(it, 'fruit');
        it.fruit = it.inst.length > 1;
      }
    };
    const barrels = (s, d, n = 3) => {
      for (let j = 0; j < n; j++) {
        const it = place('barrel', s + (j % 2) * 0.62 + rng.gauss() * 0.05, d + Math.floor(j / 2) * 0.62, rng.next() * 6);
        show(it, 'barrel');
      }
    };
    const stall = (s, d, withCrates = true) => {
      const it = place('stall', s, d, 0);
      show(it, 'stallFrame');
      show(it, 'awning');
      if (withCrates) {
        // crates on the table and a bin under it: all part of the stall
        it.cargo = [];
        for (const [x, z, y] of [[-0.8, -0.1, 0.88], [0.0, -0.05, 0.88], [0.8, -0.1, 0.88], [-0.4, 0.3, 0.0], [0.5, 0.35, 0.0]]) {
          if (!rng.chance(0.85)) continue;
          const c = { kind: 'crate', pos: null, inst: [], alive: true };
          const off = new THREE.Vector3(x, y, z);
          const P = pools.crate, i = alloc(P, c);
          const Pf = pools.fruit, fi = alloc(Pf, c);
          const p = it.pos.clone().add(off.clone().applyQuaternion(it.q));
          setM(P, i, p, it.q, ONE); setM(Pf, fi, p, it.q, ONE);
          c.pos = p; c.q = it.q.clone(); c.inst.push({ P, i }, { P: Pf, i: fi }); c.fruit = true;
          it.cargo.push(c);
        }
      }
      return it;
    };
    const fence = (s, d, yaw = 0) => { const it = place('fence', s, d, yaw); show(it, 'fence'); return it; };

    // the market: stalls under the el between its column lines, crates and
    // barrels at the kerb and spilling into the parking lane
    const M0 = ROAD.marks.market, M1 = ROAD.marks.marketEnd;
    const stalls = [];
    for (let s = M0; s < M1; s += rng.range(4.2, 6.5)) {
      // (clear of the el's columns: 4 + k * 11.5)
      const k = Math.round((s - 4) / 11.5), off = s - (4 + k * 11.5);
      if (Math.abs(off) < 2.1) continue;
      stalls.push(stall(s, -9.9 - rng.range(0, 0.4), true));
      if (rng.chance(0.55)) stall(s + rng.range(-0.5, 0.5), -14.4, rng.chance(0.6));
    }
    for (let s = M0 - 10; s < M1 + 10; s += rng.range(5, 11)) {
      if (rng.chance(0.65)) crates(s, -7.1 + rng.range(-0.2, 0.3), rng.int(1, 3), rng.int(1, 3));
      if (rng.chance(0.35)) barrels(s + 2.5, -7.4, rng.int(2, 3));
    }
    // things in the road itself: a market's overflow in the parking lane
    for (const [s, d, n, h] of [[422, -4.9, 3, 2], [475, -5.2, 2, 3], [518, -4.6, 4, 1], [568, -5.0, 2, 2], [616, -4.8, 3, 2], [642, -3.6, 2, 1], [672, -4.9, 3, 2]]) crates(s, d, n, h);
    for (const [s, d] of [[450, -4.8], [540, -5.3], [595, -4.2], [690, -5.1]]) barrels(s, d, 3);
    // the newsstand on the corner by the truck's side street
    const nsS = ROAD.marks.stand + 9;
    const stand = place('stand', nsS, -7.6, 0);
    show(stand, 'stand'); show(stand, 'standPapers');
    // board hoardings along the el's near columns (two stretches)
    for (const [s0, s1] of [[160, 262], [1060, 1180]]) {
      for (let s = s0; s < s1; s += FENCE.w + 0.02) {
        const k = Math.round((s - 4) / 11.5), off = s - (4 + k * 11.5);
        if (Math.abs(off) < 1.3) continue;
        fence(s, ROAD.elA + 0.45, 0);
      }
    }
    // hydrants on the pavements
    for (const [s, d] of [[120, -7.0], [268, 7.3], [345, -7.0], [720, -7.0], [790, 7.3], [950, -7.0], [1040, 7.3], [1250, -7.0], [1470, 7.3], [1600, -7.0]]) {
      const it = place('hydrant', s, d, 0);
      show(it, 'hydrant');
    }
    // a few crates and barrels on the river pavement and by the rail
    for (let s = 60; s < ROAD.len - 40; s += rng.range(70, 130)) {
      if (rng.chance(0.5)) crates(s, 7.6, rng.int(1, 2), rng.int(1, 2)); else barrels(s, 7.5, 2);
    }

    // ---- the pieces ----------------------------------------------------------------
    const pieces = [];
    // a piece: an instance of a pool, flung
    const piece = (name, pos, q, scale, vel, ang, { r = 0.1, paper: isPaper = false, whole = null, bounce = 0.3 } = {}) => {
      const P = pools[name];
      const p = { piece: true, name, P, pos: pos.clone(), q: q.clone(), scale: scale.clone(), vel: vel.clone(), ang: ang.clone(), r, paper: isPaper, rest: false, t: 0, bounce, whole, restT: 0 };
      const i = whole ? whole.i : alloc(P, p);
      if (i < 0) return null;
      p.i = i;
      P.owner[i] = p;
      setM(P, i, p.pos, p.q, p.scale);
      pieces.push(p);
      return p;
    };
    const rnd = (a, b) => prng.range(a, b), gs = () => prng.gauss();
    const randQ = () => _q.setFromEuler(_e.set(rnd(0, 6.28), rnd(0, 6.28), rnd(0, 6.28))).clone();
    // a thing's velocity when a car goes through it: the car's, more or
    // less, lifted and spread (car: the car's velocity; k: 0 slow .. 1 fast)
    const flung = (carVel, spread = 1, lift = 1) => {
      const sp = carVel.length();
      const k = Math.min(1, sp / 22);
      return new THREE.Vector3(
        carVel.x * rnd(0.45, 1.05) + gs() * 2.2 * spread,
        rnd(2.0, 5.5) * lift * (0.4 + 0.8 * k) + rnd(0, 1.2),
        carVel.z * rnd(0.45, 1.05) + gs() * 2.2 * spread);
    };
    const spin = (k = 1) => new THREE.Vector3(gs() * 9 * k, gs() * 9 * k, gs() * 9 * k);
    // the crate: its slats, its fruit, or (slow) the whole thing tumbling
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
      c.alive = false;
      c.inst = [];
    };
    const burstBarrel = (b, carVel) => {
      const bi = b.inst[0];
      if (prng.chance(0.55) && bi) {
        // whole: knocked flying, it rolls on when it lands
        const p = piece('barrel', b.pos.clone().setY(b.pos.y + BARREL.h / 2), b.q, ONE, flung(carVel, 0.5, 0.9), spin(0.6), { r: 0.3, whole: bi, bounce: 0.3 });
        if (p) { p.pivotY = BARREL.h / 2; p.roll = true; }
      } else {
        if (bi) release(bi.P, bi.i);
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * Math.PI * 2;
          const o = new THREE.Vector3(Math.cos(a) * 0.26, BARREL.h / 2, Math.sin(a) * 0.26).add(b.pos);
          const q = new THREE.Quaternion().setFromEuler(_e.set(0, -a, Math.PI / 2 + gs() * 0.2));
          piece('plank', o, q, new THREE.Vector3(0.84, 0.02, 0.15), flung(carVel, 1.2), spin(), { r: 0.05 });
        }
      }
      b.alive = false; b.inst = [];
    };
    const burst = {
      crate: (it, v, slow) => burstCrate(it, v, slow || prng.chance(0.2)),
      barrel: burstBarrel,
      stall: (it, v) => {
        for (const x of it.inst) release(x.P, x.i);
        // the awning's canvas goes up over the car, the poles and planks fly
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
      stand: (it, v) => {
        for (const x of it.inst) release(x.P, x.i);
        // a cloud of papers: they go up and come down slow, turning
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
        const p = piece('hydrant', it.pos.clone().setY(0.45), it.q, ONE, flung(v, 0.4, 0.9), spin(0.7), { r: 0.16, whole: hi, bounce: 0.35 });
        if (p) p.pivotY = 0.4;
        it.geyser = { at: it.pos.clone(), t: 0 };
        geysers.push(it.geyser);
        it.inst = [];
      },
    };
    const geysers = [];

    // ---- per step --------------------------------------------------------------------
    const gyAt = (p, hint) => { project(p.x, p.z, hint.s ?? null, hint); return hint.d > ROAD.quay ? ROAD.waterY : groundY(hint.d); };
    const api = {
      group, items, pools, pieces, geysers, stalls,
      near(s0, s1, out = []) {
        out.length = 0;
        for (let k = Math.floor(s0 / 10); k <= Math.floor(s1 / 10); k++) { const b = buckets.get(k); if (b) for (const it of b) if (it.alive) out.push(it); }
        return out;
      },
      // burst it (vel: what hit it)
      smash(it, vel, by = null) {
        if (!it.alive) return;
        it.alive = false;
        const slow = vel.length() < 6;
        burst[it.kind](it, vel, slow);
        const g = stage.game;
        if (g) {
          g.sfx.play(KIND[it.kind].sound, it.pos, { k: Math.min(1, vel.length() / 20) }, { ref: 4 });
          g.emit('smash', { kind: it.kind, pos: it.pos, speed: vel.length(), by });
          if (it.kind === 'hydrant') g.sfx.play('hydrant', it.pos, { dur: 4 }, { ref: 4 });
        }
      },
      // the watcher's swerve: a stall's cargo and the crates by it knocked
      // into the road (vel: the push, world)
      spill(it, vel) {
        if (!it.alive) return;
        if (it.kind === 'stall') {
          for (const c of it.cargo || []) if (c.alive && prng.chance(0.8)) burstCrate(c, vel.clone().multiplyScalar(rnd(0.7, 1.2)), true);
          // the awning sags, torn
          return;
        }
        this.smash(it, vel);
      },
      // a car's box against the things: those it overlaps burst
      collide(v, hit = []) {
        hit.length = 0;
        const list = this.near(v.s - 6, v.s + 6, this._near || (this._near = []));
        for (const it of list) {
          if (!v.overlaps(it.pos, it.r, it.pos.y - 0.2, it.pos.y + 2.2)) continue;
          this.smash(it, v.vel3(_v).clone(), v);
          hit.push(it);
        }
        return hit;
      },
      // the pieces in a car's way: kicked on
      kickPieces(v) {
        const sp = v.speedAbs;
        if (sp < 1.5) return 0;
        let n = 0;
        for (const p of pieces) {
          if (p.pos.y > 1.9) continue;
          if (Math.abs(p.pos.x - v.pos.x) > 3.5 || Math.abs(p.pos.z - v.pos.z) > 3.5) continue;
          if (!v.overlaps(p.pos, p.r + 0.05, -1, 1.6)) continue;
          const kv = v.vel3(_v);
          p.vel.set(kv.x * rnd(0.8, 1.15) + gs() * 1.2, rnd(1.5, 3.8) * Math.min(1, sp / 12) + (p.paper ? 1.5 : 0), kv.z * rnd(0.8, 1.15) + gs() * 1.2);
          p.ang.copy(spin(0.6));
          p.rest = false; p.restT = 0;
          n++;
        }
        return n;
      },
      update(dt, t) {
        this.t = t;
        // what flies back into my windscreen is thrown off it, up and over
        // the roof (a thump on the glass: game.emit 'screenHit')
        const G0 = stage.game, me = G0 && G0.vehicles && G0.vehicles.player;
        if (me && me.model && me.model.wheel) {
          const c = Math.cos(me.yaw), sn = Math.sin(me.yaw);
          for (const p of pieces) {
            if (p.rest || p.pos.y < me.pos.y + 1.0 || p.pos.y > me.pos.y + 1.95) continue;
            const dx = p.pos.x - me.pos.x, dz = p.pos.z - me.pos.z;
            const lx = dx * c - dz * sn, lz = dx * sn + dz * c;
            if (lx < 0.25 || lx > 0.85 || Math.abs(lz) > 0.7) continue;
            // (relative to the car it must be coming back at the glass)
            const rvx = (p.vel.x - me.vel.x) * c - (p.vel.z - me.vel.z) * sn;
            if (rvx > -0.5) continue;
            const up = 2.5 + Math.random() * 3;
            p.vel.set(me.vel.x + (p.vel.x - me.vel.x) * -0.25, up, me.vel.z + (p.vel.z - me.vel.z) * -0.25);
            p.ang.multiplyScalar(-0.6);
            if (!p.paper) G0.emit('screenHit', { pos: p.pos.clone(), k: Math.min(1, -rvx / 12), lz });
          }
        }
        for (let j = pieces.length - 1; j >= 0; j--) {
          const p = pieces[j];
          if (p.rest) continue;
          p.t += dt;
          if (p.paper) {
            // paper and canvas: slow falls, a flutter, a lot of air
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
          const hint = p.hint || (p.hint = {});
          const gy = gyAt(p.pos, hint) + (p.pivotY ?? p.r * 0.5);
          if (p.pos.y < gy) {
            p.pos.y = gy;
            if (p.vel.y < -1.2 && !p.paper) {
              p.vel.y *= -p.bounce;
              p.ang.multiplyScalar(0.55);
              p.vel.x *= 0.7; p.vel.z *= 0.7;
            } else {
              p.vel.y = 0;
              const fr = p.roll ? 1.1 : p.paper ? 9 : 5;
              p.vel.x *= Math.exp(-fr * dt); p.vel.z *= Math.exp(-fr * dt);
              p.ang.multiplyScalar(Math.exp(-(p.roll ? 1.2 : 6) * dt));
              // settle flat: the piece lies down on its broadest face
              if (!p.roll || Math.hypot(p.vel.x, p.vel.z) < 0.5) settleFlat(p, dt);
            }
            if (Math.hypot(p.vel.x, p.vel.z) < 0.08 && p.ang.length() < 0.2) { p.restT += dt; if (p.restT > 0.3) { p.rest = true; p.vel.set(0, 0, 0); p.ang.set(0, 0, 0); } }
          }
          setM(p.P, p.i, p.pos, p.q, p.scale);
        }
        // the geysers: a hydrant off its stem, a column of white water
        const g = stage.game;
        for (const gz of geysers) {
          gz.t += dt;
          if (!g || gz.t > 30) continue;
          const k = Math.min(1, gz.t / 0.4) * (gz.t > 20 ? Math.max(0, 1 - (gz.t - 20) / 10) : 1);
          gz.acc = (gz.acc || 0) + dt * 90 * k;
          while (gz.acc >= 1) {
            gz.acc -= 1;
            g.fx.splash.spawn({ pos: gz.at.clone().setY(0.35), vel: new THREE.Vector3(gs() * 0.6, rnd(6, 10) * k, gs() * 0.6), life: rnd(1.0, 1.6), size: [0.03, 0.09], stretch: 0.06,
              col: [0.55, 0.55, 0.55], alpha: 0.9, cell: 1, gravity: 9.8, ground: 0.01, fadeOut: 0.2 });
          }
        }
      },
    };
    // (the pieces lie down: the smallest dimension turned upright)
    const settleFlat = (p, dt) => {
      if (p.pivotY != null && !p.roll) return;
      const s = p.scale;
      const ax = s.x <= s.y && s.x <= s.z ? 0 : s.y <= s.z ? 1 : 2;
      _v.set(ax === 0 ? 1 : 0, ax === 1 ? 1 : 0, ax === 2 ? 1 : 0).applyQuaternion(p.q);
      const target = _s.set(0, _v.y >= 0 ? 1 : -1, 0);
      _q.setFromUnitVectors(_v, target);
      const k = 1 - Math.exp(-10 * dt);
      p.q.premultiply(new THREE.Quaternion().slerp(_q, k));
    };
    return api;
  },
  update: (s, dt, t) => s.update(dt, t),
};

// the ground under a thing at d: the road, or a pavement
function groundY(d) {
  return d < ROAD.kerbL || d > ROAD.kerbR ? ROAD.pave : 0;
}

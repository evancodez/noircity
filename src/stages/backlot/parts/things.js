import * as THREE from 'three';
import { lathe, merge, tube, V3, roundedBox } from '../../../world/geom.js';
import { allocInkId, markFigure, tagInk } from '../../../render/layers.js';
import { materials } from '../arch.js';
import {
  LANE, KITCHEN, ROOFS, TANNER, TRUCK, MARKET, FENCE, KDOOR, PRESS, BALLEY, AVENUE,
} from '../plan.js';

// What the chase meets in its way (lane C6): every thing a man must go
// over, under or through, as one list the run mode reads (player/modes/run.js)
// and the chase works (scenes/watcher/chase.js). Each is a slab across the
// way - a segment a -> b, depth across it - with its kind:
//   over      SPACE: a fence, a party wall, bins or crates he pulled down, a
//             skylight, a car's bonnet (top: its height; low: a trip if run
//             into, else a hard stop)
//   under     C: the fence broken at its foot, the half-shut roller door, the
//             tank on its legs, the truck's plank, the barrow (under: the
//             clearance)
//   shoulder  SPACE: the door he slammed (E opens it from standing)
//   locked    the other door: it rattles, it does not open
//   jump      SPACE at the edge: the light well between the roofs
//   slope     C: the shed's steep roof (slid down, else slithered)
// The same look every time: a pale edge along what is gone over (its top)
// and along what is gone under (its underside).
//   things.list / things.get(id)
//   things.ahead(p, v, level, r) -> { T, d, c, t, u, side } | null   the nearest in the way
//   things.trigger(id, opts)       his doing: bins, crates, the rack, the barrow, a door slammed, the car
//   things.reset(stretch)          a retry: what he knocked down put back as that stretch begins
//   things.solid(T, on)            its collider in or out of the world (a body going over it)
// Event hooks: things.onEvent(name, T, data) (the scene's sounds).
const _p = new THREE.Vector3(), _q = new THREE.Vector3();
const SS = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

export default {
  name: 'things', order: 135, tick: 135,
  build(stage) {
    const MAT = materials(stage);
    const M = stage.M;
    const std = (o) => new THREE.MeshStandardMaterial(o);
    const wood = std({ color: 0x3e3e3e, roughness: 0.88, envMap: M.envSoft, envMapIntensity: 0.12 });
    const tin = M.paintedMetal;
    const list = [];
    const byId = new Map();
    const api = { list, onEvent: null };
    const groundC = stage.colliders, roofC = stage.roofColliders;
    const ink = (o, figure = true) => { o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.userData.noRay = true; } }); tagInk(o); if (figure) markFigure(o); };

    // a thing: a slab across the way
    const add = (spec) => {
      const T = {
        id: spec.id, kind: spec.kind, a: { ...spec.a }, b: { ...spec.b }, depth: spec.depth ?? 0.2, y: spec.y ?? 0,
        top: spec.top ?? 1.0, under: spec.under ?? 0.8, low: !!spec.low, level: spec.level || 'ground', active: spec.active ?? true,
        stretch: spec.stretch || null, group: spec.group || null, moving: !!spec.moving, vel: { x: 0, z: 0 }, state: {}, col: null, colOn: false,
        a0: { ...spec.a }, b0: { ...spec.b }, pass: spec.pass || null, dynamic: !!spec.dynamic, his: spec.his || null,
      };
      T.frame = () => frame(T);
      if (spec.collide !== false) {
        const set = T.level === 'roof' ? roofC : groundC;
        const F = frame(T);
        T.col = set.addBox(F.cx, F.cz, F.L / 2, T.depth / 2, F.ang, 'thing:' + T.id);
        T.colSet = set;
        T.colOn = true;
        if (!T.active) solid(T, false);
      }
      list.push(T);
      byId.set(T.id, T);
      return T;
    };
    // the slab's frame: its centre, length, angle (a collider box's), the
    // unit along it (t) and across it (n)
    const frame = (T) => {
      const tx = T.b.x - T.a.x, tz = T.b.z - T.a.z, L = Math.hypot(tx, tz) || 1e-3;
      const t = { x: tx / L, z: tz / L }, n = { x: -t.z, z: t.x };
      // (a collider's angle: rotation about +Y, local x along the slab)
      return { cx: (T.a.x + T.b.x) / 2, cz: (T.a.z + T.b.z) / 2, L, t, n, ang: -Math.atan2(tz, tx) };
    };
    const solid = (T, on) => {
      if (!T.col || T.colOn === on) return;
      T.colOn = on;
      T.col.cx += on ? -1000 : 1000;
    };
    // (a thing that moves: its collider follows)
    const placeCol = (T) => {
      if (!T.col) return;
      const F = frame(T);
      T.col.cx = F.cx + (T.colOn ? 0 : 1000); T.col.cz = F.cz;
      T.col.hx = F.L / 2; T.col.hz = T.depth / 2;
      T.col.angle = F.ang; T.col.c = Math.cos(F.ang); T.col.s = Math.sin(F.ang);
    };
    api.solid = solid;
    api.get = (id) => byId.get(id) || null;
    api.placeCol = placeCol;
    const emit = (name, T, d = {}) => { if (api.onEvent) api.onEvent(name, T, d); };
    api.emit = emit;

    // the nearest active thing in the way of a body at p moving v (on its
    // level): d the distance from the body's front to its near face, c the
    // closing speed, t = d / c, u along it (0 .. 1), side (+1 / -1: which face)
    api.ahead = (p, v, level = 'ground', r = 0.36, { range = 7, kinds = null } = {}) => {
      let best = null;
      for (const T of list) {
        if (!T.active || T.level !== level || T.kind === 'sheet') continue;
        if (kinds && !kinds.includes(T.kind)) continue;
        const F = frame(T);
        const ux = p.x - T.a.x, uz = p.z - T.a.z;
        const along = ux * F.t.x + uz * F.t.z;
        if (along < -r - 0.15 || along > F.L + r + 0.15) continue;
        const s = ux * F.n.x + uz * F.n.z;
        const side = s >= 0 ? 1 : -1;
        const d = Math.abs(s) - T.depth / 2 - r;
        if (d > range) continue;
        // (closing: my velocity less the thing's, toward its face)
        const c = -side * ((v.x - T.vel.x) * F.n.x + (v.z - T.vel.z) * F.n.z);
        if (c < 0.4 && d > 0.05) continue;
        const t = d / Math.max(0.4, c);
        if (!best || d < best.d) best = { T, d, c, t, u: along / F.L, side, F };
      }
      return best;
    };

    // ---- the pale marks: one material, one look -------------------------------------------
    const markTop = (g, x0, z0, x1, z1, y, w = 0.05) => {
      const L = Math.hypot(x1 - x0, z1 - z0);
      const m = new THREE.Mesh(new THREE.BoxGeometry(L, 0.025, w), MAT.mark);
      m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
      m.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
      m.userData.noRay = true;
      g.add(m);
      return m;
    };

    // ================= the alley: the bins he pulls down ===========================
    // six bins against the east wall; pulled, they go over across the alley
    // and roll into a line from wall to wall (the first SPACE: taught here)
    {
      const g = new THREE.Group();
      const bins = [];
      const binGeo = lathe([[0, 0], [0.26, 0], [0.28, 0.05], [0.27, 0.72], [0.3, 0.76], [0.3, 0.8], [0, 0.8]], 22);
      const rimGeo = new THREE.TorusGeometry(0.295, 0.016, 6, 28).rotateX(Math.PI / 2).translate(0, 0.785, 0);
      const jit = [0.12, -0.16, 0.06, -0.1, 0.17, -0.05];
      for (let i = 0; i < 6; i++) {
        const b = new THREE.Group();
        b.add(new THREE.Mesh(binGeo, tin));
        const rim = new THREE.Mesh(rimGeo, MAT.mark); rim.userData.noRay = true; b.add(rim);
        const s0 = { x: 4.62, z: -21.2 - i * 0.66 };
        // (at rest: on its side, its axis across the alley, end to end with
        // the next: wall to wall)
        const s1 = { x: 0.06 + i * 0.81, z: -26.4 + jit[i], yaw: jit[(i + 2) % 6] * 0.8, roll: 1.4 + i * 0.9 };
        bins.push({ g: b, s0, s1, delay: i * 0.07 });
        g.add(b);
      }
      ink(g);
      stage.scene.add(g);
      const T = add({ id: 'bins', kind: 'over', low: true, top: 0.6, a: { x: 0.0, z: -26.4 }, b: { x: 5.0, z: -26.4 }, depth: 0.72, active: false, dynamic: true, stretch: 'alley' });
      T.mesh = g;
      T.place = (k) => {
        for (const B of bins) {
          const kk = (k - B.delay) / 0.8;
          const u = SS(0, 1, kk), tip = SS(0, 0.35, kk);
          // (the base: from standing by the wall to lying with its base at s1.x)
          const x = B.s0.x + (B.s1.x - B.s0.x) * u, z = B.s0.z + (B.s1.z - B.s0.z) * u;
          B.g.position.set(x, 0.3 * tip, z);
          // (order XYZ: tipped over about z, a little yaw, rolled about its own axis)
          B.g.rotation.set(B.s1.roll * u, B.s1.yaw * tip, -Math.PI / 2 * tip);
        }
      };
      T.place(0);
      T.state.k = 0;
      T.trigger = () => { T.state.go = true; for (const c of T.standCols) c.x += 1000; };
      T.reset = () => { T.state.go = false; T.state.k = 0; T.active = false; solid(T, false); T.place(0); for (const c of T.standCols) if (c.x > 500) c.x -= 1000; };
      T.update = (dt) => {
        if (!T.state.go || T.state.k >= 1.4) return;
        T.state.k = Math.min(1.4, T.state.k + dt);
        T.place(T.state.k);
        if (T.state.k > 0.35 && !T.active) { T.active = true; solid(T, true); }
      };
      // standing, they are the alley's clutter: solid at the wall
      T.standCols = bins.map((B) => groundC.addCircle(B.s0.x, B.s0.z, 0.3, 'can'));
    }
    // the crates at the alley's head (he yanks the stack when I am close)
    crateStack(add, stage, wood, MAT, ink, { id: 'alleyCrates', at: [{ x: 4.45, z: -41.6 }, { x: 4.4, z: -40.9 }, { x: 4.45, z: -41.25, y: 0.62 }], fall: [{ x: 3.6, z: -42.4, yaw: 0.3 }, { x: 2.5, z: -42.6, yaw: -0.2 }, { x: 1.35, z: -42.5, yaw: 0.5 }], line: [{ x: 1.0, z: -42.5 }, { x: 3.95, z: -42.5 }], stretch: 'alley' });

    // ================= the lane: the fences =========================================
    fence(add, stage, wood, MAT, ink, { id: 'fence1', x: 13.0, h: 1.72, kind: 'over' });
    fence(add, stage, wood, MAT, ink, { id: 'fence2', x: 24.0, h: 2.55, kind: 'under', gap: 0.8 });
    fence(add, stage, wood, MAT, ink, { id: 'fence3', x: 35.0, h: 1.75, kind: 'over' });
    // the bin he kicks rolling down the lane at me (A / D round it, SPACE over it)
    {
      const b = new THREE.Group();
      b.add(new THREE.Mesh(lathe([[0, 0], [0.26, 0], [0.28, 0.05], [0.27, 0.72], [0.3, 0.76], [0.3, 0.8], [0, 0.8]], 22), tin));
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.295, 0.016, 6, 28).rotateX(Math.PI / 2).translate(0, 0.785, 0), MAT.mark); rim.userData.noRay = true; b.add(rim);
      ink(b);
      stage.scene.add(b);
      const home = { x: 44.4, z: -48.1 };
      const T = add({ id: 'laneBin', kind: 'over', low: true, top: 0.6, a: { x: home.x, z: home.z - 0.42 }, b: { x: home.x, z: home.z + 0.42 }, depth: 0.6, active: false, dynamic: true, moving: true, stretch: 'lane' });
      T.mesh = b;
      const stand = () => { b.position.set(home.x, 0, home.z); b.rotation.set(0, 0, 0); };
      stand();
      T.standCol = groundC.addCircle(home.x, home.z, 0.3, 'can');
      T.trigger = ({ toward } = {}) => {
        // kicked over and sent rolling down the lane, across it a little
        T.state = { go: true, t: 0, x: home.x - 0.3, z: -49.0, vx: -4.6, vz: toward ? Math.sign(toward - home.z) * 0.6 : -0.5, spin: 0 };
        T.standCol.x += 1000;
        T.active = true; solid(T, true);
      };
      T.reset = () => { T.state = {}; T.active = false; solid(T, false); T.vel = { x: 0, z: 0 }; T.standCol.x = home.x; stand(); };
      T.update = (dt) => {
        const S = T.state;
        if (!S.go) return;
        S.t += dt;
        // (it rolls, slowing on the wet, off the walls)
        const f = Math.exp(-dt * 0.55);
        S.vx *= f; S.vz *= f;
        S.x += S.vx * dt; S.z += S.vz * dt;
        if (S.z > LANE.z1 - 0.35) { S.z = LANE.z1 - 0.35; S.vz = -Math.abs(S.vz) * 0.5; }
        if (S.z < LANE.z0 + 0.35) { S.z = LANE.z0 + 0.35; S.vz = Math.abs(S.vz) * 0.5; }
        S.spin += Math.hypot(S.vx, S.vz) * dt / 0.3;
        // (on its side, its axis across the lane (z), rolling about it)
        b.position.set(S.x, 0.3, S.z - 0.4);
        b.rotation.set(Math.PI / 2, 0, S.spin);
        T.a.x = T.b.x = S.x; T.a.z = S.z - 0.42; T.b.z = S.z + 0.42;
        T.depth = 0.6;
        T.vel = { x: S.vx, z: S.vz };
        placeCol(T);
        if (Math.hypot(S.vx, S.vz) < 0.15) { S.go = false; T.vel = { x: 0, z: 0 }; }
      };
    }

    // ================= the yard: the back doors ====================================
    for (const side of ['W', 'E']) {
      const d = KITCHEN.doors[side];
      const g = new THREE.Group();
      const leaf = new THREE.Mesh(roundedBox(d.w - 0.04, d.h - 0.04, 0.06, 0.01, 1).translate((d.w - 0.04) / 2, (d.h - 0.04) / 2, 0), M.wood);
      g.add(leaf);
      // (its panels, a push plate, a bolt)
      for (const y of [0.55, 1.45]) g.add(new THREE.Mesh(new THREE.BoxGeometry(d.w - 0.3, 0.6, 0.02).translate(d.w / 2, y, 0.035), MAT.woodDark));
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.02).translate(d.w - 0.2, 1.05, -0.045), MAT.metal));
      ink(g);
      // hinged on its west jamb, opening into the kitchen (north, -z)
      g.position.set(d.x - d.w / 2 + 0.02, 0.02, KITCHEN.z1 - 0.15);
      stage.scene.add(g);
      const T = add({ id: 'door' + side, kind: 'locked', a: { x: d.x - d.w / 2, z: KITCHEN.z1 - 0.15 }, b: { x: d.x + d.w / 2, z: KITCHEN.z1 - 0.15 }, depth: 0.3, top: d.h, stretch: 'yard' });
      T.mesh = g;
      T.side = side;
      T.state = { a: 0, v: 0, rattle: 0 };
      // (its swing: 0 shut .. 1.75 open, a damped spring to its rest)
      T.rest = 0;
      T.update = (dt) => {
        const S = T.state;
        S.v += (-(S.a - T.rest) * 30 - S.v * 5) * dt;
        S.a += S.v * dt;
        if (S.a < 0) { S.a = 0; S.v = Math.abs(S.v) * 0.3; }
        if (S.a > 1.9) { S.a = 1.9; S.v = -Math.abs(S.v) * 0.4; }
        S.rattle = Math.max(0, S.rattle - dt);
        g.rotation.y = S.a + Math.sin(S.rattle * 60) * 0.012 * S.rattle;
        // (open far enough, the way is clear)
        const open = S.a > 0.9;
        if (open && T.active) { T.active = false; solid(T, false); }
        if (!open && !T.active && T.kind !== 'open') { T.active = true; solid(T, true); }
      };
      // he went through: shut behind him (slammed); or locked; or open
      T.set = (state) => {
        if (state === 'slammed') { T.kind = 'shoulder'; T.rest = 0; T.state.a = 0.5; T.state.v = -9; T.active = true; solid(T, true); emit('slam', T); }
        else if (state === 'locked') { T.kind = 'locked'; T.rest = 0; T.state.a = 0; T.state.v = 0; T.active = true; solid(T, true); }
        else if (state === 'shut') { T.kind = 'shoulder'; T.rest = 0; T.state.a = 0; T.state.v = 0; T.active = true; solid(T, true); }
        else if (state === 'open') { T.kind = 'open'; T.rest = 1.55; T.state.a = 1.55; T.state.v = 0; T.active = false; solid(T, false); }
      };
      // a body into it: it flies open (bashed), or it rattles (locked)
      T.bash = (k = 1) => { if (T.kind === 'locked') { T.state.rattle = 0.35; emit('rattle', T); return false; } T.kind = 'open'; T.rest = 1.45; T.state.v = 14 * k; T.active = false; solid(T, false); emit('bash', T, { k }); return true; };
      T.reset = () => T.set('shut');
    }

    // ================= the kitchen: the racks he pulls down, the roller door =========
    // a rack of pans at the south end of each corridor beside the table: he
    // pulls it over across his corridor as he passes (it lies across most of
    // it: step round its end, or over it)
    for (const [id, x, dir] of [['rackW', 55.55, -1], ['rackE', 64.45, 1]]) {
      const g = new THREE.Group();
      const parts = [];
      for (const [dx, dz] of [[-0.8, -0.24], [0.8, -0.24], [-0.8, 0.24], [0.8, 0.24]]) parts.push(new THREE.CylinderGeometry(0.02, 0.02, 1.9, 6).translate(dx, 0.95, dz));
      for (const y of [0.3, 0.9, 1.5, 1.88]) parts.push(new THREE.BoxGeometry(1.64, 0.025, 0.5).translate(0, y, 0));
      g.add(new THREE.Mesh(merge(parts), MAT.metal));
      const pans = [];
      for (const y of [0.31, 0.91, 1.51]) for (const dx of [-0.5, 0.05, 0.55]) pans.push(lathe([[0, 0], [0.15, 0], [0.16, 0.1], [0, 0.1]], 14).translate(dx, y + 0.012, 0));
      g.add(new THREE.Mesh(merge(pans), MAT.metal));
      const e = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.022, 0.03).translate(0, 1.9, -0.25 * dir), MAT.mark); e.userData.noRay = true; g.add(e);
      ink(g);
      // standing end on to the corridor (its length along z), at the table's end
      const home = { x, z: -90.75 };
      stage.scene.add(g);
      // (fallen across the corridor: its height now along x from its base outward)
      const xf0 = Math.min(x, x + dir * 1.95), xf1 = Math.max(x, x + dir * 1.95);
      const T = add({ id, kind: 'over', low: true, top: 0.52, a: { x: xf0, z: home.z }, b: { x: xf1, z: home.z }, depth: 1.66, active: false, dynamic: true, stretch: 'kitchen' });
      T.mesh = g;
      T.standCol = groundC.addBox(home.x, home.z, 0.26, 0.83, 0, 'rack');
      T.state = { k: 0, go: false };
      T.place = (k) => {
        const u = SS(0, 1, k / 0.55);
        // (order ZYX: its length turned along z, then tipped over about z)
        g.rotation.set(0, Math.PI / 2, -dir * u * Math.PI / 2, 'ZYX');
        g.position.set(home.x + dir * 0.26 * u, 0.26 * u, home.z);
      };
      T.place(0);
      T.trigger = () => { T.state.go = true; T.standCol.cx += 1000; emit('rack', T); };
      T.reset = () => { T.state = { k: 0, go: false }; T.active = false; solid(T, false); if (T.standCol.cx > 500) T.standCol.cx -= 1000; T.place(0); };
      T.update = (dt) => {
        if (!T.state.go || T.state.k >= 0.8) return;
        T.state.k = Math.min(0.8, T.state.k + dt);
        T.place(T.state.k);
        if (T.state.k > 0.3 && !T.active) { T.active = true; solid(T, true); }
      };
    }
    {
      // [C6 2nd] the roller door, down to the floor tonight and padlocked to
      // its bolt in the sill: it rattles (the way out of the kitchen is its
      // iron door, into the press hall)
      const R = KITCHEN.roll;
      const g = new THREE.Group();
      const slats = [];
      for (let y = 0.08; y < R.h; y += 0.11) slats.push(new THREE.BoxGeometry(R.w, 0.095, 0.035).translate(0, y, 0));
      g.add(new THREE.Mesh(merge(slats), MAT.metal));
      g.add(new THREE.Mesh(new THREE.BoxGeometry(R.w + 0.02, 0.07, 0.06).translate(0, 0.035, 0), MAT.iron));
      // (the padlock on its hasp at the bottom bar)
      g.add(new THREE.Mesh(merge([new THREE.BoxGeometry(0.08, 0.1, 0.04).translate(0.4, 0.06, -0.06), new THREE.TorusGeometry(0.03, 0.007, 4, 10, Math.PI).translate(0.4, 0.11, -0.06)]), MAT.iron));
      ink(g, false);
      g.position.set(R.x, 0, KITCHEN.z0 + 0.12);
      stage.scene.add(g);
      const T = add({ id: 'roller', kind: 'locked', top: R.h, a: { x: R.x - R.w / 2 - 0.05, z: KITCHEN.z0 + 0.12 }, b: { x: R.x + R.w / 2 + 0.05, z: KITCHEN.z0 + 0.12 }, depth: 0.32, stretch: 'kitchen' });
      T.mesh = g;
      T.state = { rattle: 0 };
      T.bash = () => { T.state.rattle = 0.4; emit('rattle', T); return false; };
      T.update = (dt) => { const S = T.state; S.rattle = Math.max(0, S.rattle - dt); g.position.z = KITCHEN.z0 + 0.12 + Math.sin(S.rattle * 70) * 0.012 * S.rattle; };
    }
    // [C6 2nd] the kitchen's iron door in its east wall, into the press hall:
    // he flings it open on his way (it stays open); shut, a push of the
    // shoulder opens it (SPACE / E)
    {
      const d = KDOOR, g = new THREE.Group();
      const leaf = new THREE.Mesh(roundedBox(0.06, d.h - 0.04, d.w - 0.04, 0.01, 1).translate(0, (d.h - 0.04) / 2, (d.w - 0.04) / 2), MAT.iron);
      g.add(leaf);
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.6).translate(-0.05, 1.05, d.w / 2), MAT.metal));
      ink(g);
      // hinged on its north jamb, opening east into the hall
      g.position.set(d.x, 0.02, d.z - d.w / 2 + 0.02);
      stage.scene.add(g);
      const T = add({ id: 'kdoor', kind: 'shoulder', a: { x: d.x, z: d.z - d.w / 2 }, b: { x: d.x, z: d.z + d.w / 2 }, depth: 0.3, top: d.h, stretch: 'kitchen' });
      T.mesh = g;
      T.state = { a: 0, v: 0 };
      T.rest = 0;
      T.update = (dt) => {
        const S = T.state;
        S.v += (-(S.a - T.rest) * 30 - S.v * 5) * dt;
        S.a += S.v * dt;
        if (S.a < 0) { S.a = 0; S.v = Math.abs(S.v) * 0.3; }
        if (S.a > 1.9) { S.a = 1.9; S.v = -Math.abs(S.v) * 0.4; }
        g.rotation.y = S.a;
        const open = S.a > 0.9;
        if (open && T.active) { T.active = false; solid(T, false); }
        if (!open && !T.active && T.kind !== 'open') { T.active = true; solid(T, true); }
      };
      T.set = (state) => {
        if (state === 'open') { T.kind = 'open'; T.rest = 1.6; T.state.a = 1.6; T.state.v = 0; T.active = false; solid(T, false); }
        else { T.kind = 'shoulder'; T.rest = 0; T.state.a = 0; T.state.v = 0; T.active = true; solid(T, true); }
      };
      T.bash = (k = 1) => { T.kind = 'open'; T.rest = 1.6; T.state.v = 14 * k; T.active = false; solid(T, false); emit('bash', T, { k }); return true; };
      T.reset = () => T.set('shut');
    }

    // ================= [C6 2nd] the press hall, the avenue, the alley ===============
    // the web across the gap between the north line's two units: a man goes
    // under it (the paper is the pale edge; press.js draws it running)
    {
      const W = PRESS.web, zm = (PRESS.lineN.z0 + PRESS.lineN.z1) / 2;
      const g = new THREE.Group();
      for (const z of [zm - W.w / 2, zm + W.w / 2]) markTop(g, PRESS.units[0][1], z, PRESS.units[1][0], z, W.y - 0.005, 0.03);
      stage.scene.add(g);
      add({ id: 'web', kind: 'under', under: W.y, a: { x: PRESS.units[0][1] + 0.02, z: zm }, b: { x: PRESS.units[1][0] - 0.02, z: zm }, depth: W.w, stretch: 'press' });
    }
    // the conveyor across the middle aisle: over it (its rails pale)
    {
      const C = PRESS.conveyor, za = PRESS.lineN.z1, zb = PRESS.lineS.z0;
      const g = new THREE.Group();
      for (const x of [C.x - C.w / 2 + 0.04, C.x + C.w / 2 - 0.04]) markTop(g, x, za + 0.05, x, zb - 0.05, C.y + 0.025, 0.05);
      stage.scene.add(g);
      add({ id: 'conveyor', kind: 'over', low: true, top: C.y + 0.18, a: { x: C.x, z: za + 0.02 }, b: { x: C.x, z: zb - 0.02 }, depth: C.w, stretch: 'press' });
    }
    // the bundles on their hand truck by the south line: he pulls them over
    // across the middle aisle behind him (step round, or over)
    bundleStack(add, stage, MAT, ink, { id: 'pressBundles', x: 84.6, z: PRESS.lineS.z0 - 0.45, toward: -1, stretch: 'press' });
    // the bundles for the news-stand at the alley's corner: across the
    // avenue's west lane behind him
    bundleStack(add, stage, MAT, ink, { id: 'avBundles', x: AVENUE.x0 + 1.85, z: BALLEY.z1 + 4.4, toward: 1, axis: 'x', stretch: 'el' });
    // the steam pipe across the alley behind the press hall, lagged white,
    // out of the hall's north wall and into the next block: under it
    {
      const P = BALLEY.pipe, r = 0.2, y = P.y + r;
      const g = new THREE.Group();
      const z0 = BALLEY.z0 + 0.05, z1 = BALLEY.z1 - 0.05;
      // (the lagging: canvas painted white, grimy - the pale thing across the way)
      const lag = new THREE.MeshStandardMaterial({ color: 0xd4d4d4, roughness: 0.95, emissive: 0x1c1c1c });
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(r, r, z1 - z0, 16).rotateX(Math.PI / 2).translate(P.x, y, (z0 + z1) / 2), lag));
      const bands = [];
      for (let z = z0 + 0.4; z < z1; z += 0.9) bands.push(new THREE.TorusGeometry(r + 0.01, 0.012, 4, 18).translate(P.x, y, z));
      for (const z of [z0 + 1.6, z1 - 1.4]) bands.push(new THREE.CylinderGeometry(r + 0.06, r + 0.06, 0.1, 16).rotateX(Math.PI / 2).translate(P.x, y, z));
      // (a valve on it, its wheel)
      bands.push(new THREE.CylinderGeometry(0.05, 0.05, 0.36, 8).translate(P.x, y + 0.36, z0 + 2.4), new THREE.TorusGeometry(0.16, 0.018, 5, 18).rotateX(Math.PI / 2).translate(P.x, y + 0.55, z0 + 2.4));
      g.add(new THREE.Mesh(merge(bands), MAT.iron));
      // its underside's pale edge, both sides
      for (const dx of [-r + 0.02, r - 0.02]) markTop(g, P.x + dx, z0 + 0.1, P.x + dx, z1 - 0.1, P.y + 0.012, 0.03);
      ink(g, false);
      stage.scene.add(g);
      api.pipe = { x: P.x, y, joint: new THREE.Vector3(P.x, y + 0.1, z0 + 1.6) };
      add({ id: 'pipe', kind: 'under', under: P.y, a: { x: P.x, z: BALLEY.z0 + 0.02 }, b: { x: P.x, z: BALLEY.z1 - 0.02 }, depth: 2 * r + 0.08, stretch: 'el' });
    }

    // ================= the roofs ====================================================
    const r1y = ROOFS.R1.y;
    {
      // the party wall across R1: brick, a pale coping
      const P = ROOFS.party;
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, P.h, ROOFS.z1 - ROOFS.z0 - 0.5).translate(P.x, r1y + P.h / 2, (ROOFS.z0 + ROOFS.z1) / 2), MAT.brickDark));
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, ROOFS.z1 - ROOFS.z0 - 0.5).translate(P.x, r1y + P.h + 0.03, (ROOFS.z0 + ROOFS.z1) / 2), MAT.trim));
      markTop(g, P.x, ROOFS.z0 + 0.3, P.x, ROOFS.z1 - 0.3, r1y + P.h + 0.065, 0.06);
      // (its own chimney breast where it meets the north parapet)
      ink(g, false);
      stage.scene.add(g);
      add({ id: 'party', kind: 'over', level: 'roof', y: r1y, top: P.h, a: { x: P.x, z: ROOFS.z0 + 0.25 }, b: { x: P.x, z: ROOFS.z1 - 0.25 }, depth: 0.3, stretch: 'over' });
      // the skylight: its ridge pale (vault it, or go round it)
      const S = ROOFS.skylight;
      const gs = new THREE.Group();
      markTop(gs, S.x, S.z - S.d / 2, S.x, S.z + S.d / 2, r1y + S.h + 0.02, 0.05);
      stage.scene.add(gs);
      add({ id: 'skylight', kind: 'over', level: 'roof', y: r1y, top: S.h, a: { x: S.x, z: S.z - S.d / 2 }, b: { x: S.x, z: S.z + S.d / 2 }, depth: S.w, stretch: 'over' });
      // the edge: R1's west parapet (the launch) and R2's east one (the catch)
      const ge = new THREE.Group();
      const G = ROOFS.gap, PH = ROOFS.parapet, r2e = ROOFS.R2.yE;
      for (const [x0, x1, y] of [[G.x1, G.x1 + 0.25, r1y], [G.x0 - 0.25, G.x0, r2e]]) {
        ge.add(new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, PH, ROOFS.z1 - ROOFS.z0).translate((x0 + x1) / 2, y + PH / 2, (ROOFS.z0 + ROOFS.z1) / 2), MAT.brick));
        ge.add(new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + 0.06, 0.06, ROOFS.z1 - ROOFS.z0 + 0.06).translate((x0 + x1) / 2, y + PH + 0.03, (ROOFS.z0 + ROOFS.z1) / 2), MAT.trim));
        markTop(ge, (x0 + x1) / 2 + (y === r1y ? -0.1 : 0.1), ROOFS.z0 + 0.05, (x0 + x1) / 2 + (y === r1y ? -0.1 : 0.1), ROOFS.z1 - 0.05, y + PH + 0.065, 0.05);
      }
      ink(ge, false);
      stage.scene.add(ge);
      const T = add({ id: 'edge', kind: 'jump', level: 'roof', y: r1y, top: PH, a: { x: G.x1 + 0.125, z: ROOFS.z0 }, b: { x: G.x1 + 0.125, z: ROOFS.z1 }, depth: 0.25, stretch: 'over' });
      T.land = { x: G.x0 - 0.125, y: r2e, top: r2e + PH };
      T.span = G.x1 - G.x0;
      // (R2's east parapet, the far side: a wall for a man on R2)
      roofC.addBox(G.x0 - 0.125, (ROOFS.z0 + ROOFS.z1) / 2, 0.125, (ROOFS.z1 - ROOFS.z0) / 2, 0, 'parapet');
      // the tank: its underside's rim pale (slide under it between its legs)
      const t = ROOFS.tank;
      const yT = ROOFS.R2.yW + (ROOFS.R2.yE - ROOFS.R2.yW) * (t.x - ROOFS.R2.x0) / (ROOFS.R2.x1 - ROOFS.R2.x0);
      const gt = new THREE.Group();
      const rim = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.02, 6, 40).rotateX(Math.PI / 2).translate(t.x, yT + t.under, -111.0), MAT.mark);
      rim.userData.noRay = true;
      gt.add(rim);
      stage.scene.add(gt);
      add({ id: 'tank', kind: 'under', level: 'roof', y: yT, under: t.under, a: { x: t.x, z: -112.8 }, b: { x: t.x, z: -109.4 }, depth: 2.5, stretch: 'over' });
      // the shed's steep roof: its head (C: the slide down)
      add({ id: 'slope', kind: 'slope', level: 'roof', y: ROOFS.R2.yW, a: { x: ROOFS.shed.x1, z: -113.4 }, b: { x: ROOFS.shed.x1, z: -108.6 }, depth: 0.1, collide: false, stretch: 'over' });
    }

    // ================= Tanner's Row: the truck's plank, the dog, the crates ==========
    {
      // the plank from the truck's side to the bay's dock, 0.92 up: they were
      // unloading; a man slides under it
      const x0 = TRUCK.x - 1.2, x1 = TRUCK.x, zA = -118.55, zB = TANNER.z0 + 0.55, y = 0.95;
      const g = new THREE.Group();
      const planks = [];
      for (let x = x0 + 0.06; x < x1; x += 0.2) planks.push(new THREE.BoxGeometry(0.18, 0.05, zA - zB + 0.3).translate(x, y, (zA + zB) / 2));
      g.add(new THREE.Mesh(merge(planks), wood));
      for (const x of [x0 + 0.05, x1 - 0.05]) g.add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, zA - zB + 0.3).translate(x, y - 0.08, (zA + zB) / 2), MAT.woodDark));
      for (const x of [x0 + 0.05, x1 - 0.05]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.022, zA - zB + 0.3).translate(x + (x < TRUCK.x - 0.6 ? -0.05 : 0.05), y - 0.15, (zA + zB) / 2), MAT.mark); e.userData.noRay = true; g.add(e); }
      // a sack on it, a crate half off it
      g.add(new THREE.Mesh(roundedBox(0.5, 0.3, 0.7, 0.1, 2).translate(TRUCK.x - 0.7, y + 0.18, -119.6), MAT.canvas));
      ink(g, false);
      stage.scene.add(g);
      add({ id: 'plank', kind: 'under', under: y - 0.14, a: { x: (x0 + x1) / 2, z: zB }, b: { x: (x0 + x1) / 2, z: zA }, depth: x1 - x0, stretch: 'over' });
    }
    crateStack(add, stage, wood, MAT, ink, { id: 'rowCrates', at: [{ x: 52.0, z: -116.55 }, { x: 52.66, z: -116.5 }, { x: 52.3, z: -116.55, y: 0.62 }], fall: [{ x: 51.4, z: -117.3, yaw: 0.4 }, { x: 51.2, z: -118.1, yaw: -0.3 }, { x: 51.0, z: -118.9, yaw: 0.6 }], line: [{ x: 51.2, z: -116.3 }, { x: 51.2, z: -119.3 }], stretch: 'over' });

    // ================= the street: the car out of the garage; the market =============
    {
      // the market's crates across the middle aisle (static: two high, a plank on them)
      const g = new THREE.Group();
      const x0 = MARKET.rows[0][1], x1 = MARKET.rows[1][0], z = -108.2;
      const cr = [];
      for (let x = x0 + 0.34; x < x1 - 0.2; x += 0.66) { cr.push(new THREE.BoxGeometry(0.62, 0.5, 0.6).translate(x, 0.15 + 0.25, z)); if ((x * 3) % 2 < 1.2) cr.push(new THREE.BoxGeometry(0.62, 0.42, 0.6).translate(x + 0.04, 0.15 + 0.71, z + 0.02)); }
      g.add(new THREE.Mesh(merge(cr), wood));
      g.add(new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.05, 0.3).translate((x0 + x1) / 2, 0.15 + 0.95, z), MAT.woodDark));
      markTop(g, x0, z - 0.14, x1, z - 0.14, 0.15 + 0.98, 0.04);
      markTop(g, x0, z + 0.14, x1, z + 0.14, 0.15 + 0.98, 0.04);
      ink(g);
      stage.scene.add(g);
      add({ id: 'marketCrates', kind: 'over', top: 0.95, y: 0.15, a: { x: x0, z }, b: { x: x1, z }, depth: 0.62, stretch: 'street' });
      // the barrow: a costermonger's cart on two big wheels, shafts out; he
      // drags it across the aisle behind him (a man slides under its bed)
      const gb = new THREE.Group();
      const bed = [];
      bed.push(new THREE.BoxGeometry(3.2, 0.06, 1.2).translate(0, 1.0, 0));
      for (const s of [-1, 1]) { bed.push(new THREE.BoxGeometry(3.2, 0.32, 0.05).translate(0, 1.18, s * 0.6)); bed.push(new THREE.BoxGeometry(0.05, 0.32, 1.2).translate(s * 1.6, 1.18, 0)); }
      for (const s of [-1, 1]) bed.push(new THREE.BoxGeometry(1.6, 0.06, 0.06).translate(2.3, 0.92 - 0.0, s * 0.5));
      gb.add(new THREE.Mesh(merge(bed), wood));
      const wheels = [];
      for (const s of [-1, 1]) wheels.push(new THREE.TorusGeometry(0.62, 0.04, 8, 32).translate(0, 0.66, s * 0.66));
      for (const s of [-1, 1]) for (let i = 0; i < 6; i++) { const a = i * Math.PI / 6; wheels.push(new THREE.BoxGeometry(1.2, 0.03, 0.03).rotateZ(a).translate(0, 0.66, s * 0.66)); }
      gb.add(new THREE.Mesh(merge(wheels), MAT.woodDark));
      const e = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.022, 0.04).translate(0, 0.955, 0.62), MAT.mark); e.userData.noRay = true; gb.add(e);
      const e2 = e.clone(); e2.position.z = -1.24; gb.add(e2);
      // fruit boxes on it, a tarp
      gb.add(new THREE.Mesh(roundedBox(2.6, 0.28, 0.9, 0.12, 2).translate(-0.1, 1.2, 0), MAT.canvas));
      ink(gb);
      stage.scene.add(gb);
      const z0b = -103.2;
      const homeB = { x: 13.2 - 0.0, z: z0b };        // against the east row, end on to the aisle
      const T = add({ id: 'barrow', kind: 'under', under: 0.9, y: 0.15, a: { x: x0, z: z0b }, b: { x: x1, z: z0b }, depth: 1.24, active: false, dynamic: true, stretch: 'street' });
      T.mesh = gb;
      T.place = (k) => {
        const u = SS(0, 1, k / 0.9);
        // (from standing along the stall row to across the aisle, swung round on its wheels)
        gb.position.set(homeB.x - 4.2 * u, 0.15, homeB.z - 2.4 * (1 - u));
        gb.rotation.y = Math.PI / 2 * (1 - u);
      };
      T.place(0);
      T.standCol = groundC.addBox(homeB.x, homeB.z - 2.4, 0.62, 1.6, 0, 'barrow');
      // (its wheels and shafts stand in the aisle's sides: a man passes only under its bed)
      T.sideCols = [groundC.addBox(x0 + 0.2, z0b, 0.25, 0.75, 0, 'barrowside'), groundC.addBox(x1 - 0.2, z0b, 0.25, 0.75, 0, 'barrowside')];
      for (const c of T.sideCols) c.cx += 1000;
      T.state = { k: 0, go: false };
      T.trigger = () => { T.state.go = true; T.standCol.cx += 1000; emit('barrow', T); };
      T.reset = () => { T.state = { k: 0, go: false }; T.active = false; solid(T, false); T.standCol.cx = homeB.x; for (const c of T.sideCols) if (c.cx < 500) c.cx += 1000; T.place(0); };
      T.update = (dt) => {
        if (!T.state.go || T.state.k >= 1.0) return;
        T.state.k = Math.min(1.0, T.state.k + dt);
        T.place(T.state.k);
        if (T.state.k > 0.5 && !T.active) { T.active = true; solid(T, true); for (const c of T.sideCols) if (c.cx > 500) c.cx -= 1000; }
      };
    }
    // the car out of the garage at Mercer Street's foot: a 'thing' that moves
    // (its slab its near side; the scene drives it: scenes/watcher/street.js)
    add({ id: 'car', kind: 'over', low: false, top: 1.08, a: { x: 0, z: 0 }, b: { x: 0, z: 1 }, depth: 1.9, active: false, dynamic: true, moving: true, collide: true, stretch: 'street' });
    byId.get('car').reset = () => { const C = byId.get('car'); C.active = false; solid(C, false); C.vel = { x: 0, z: 0 }; };

    // ---- the whole list's resets -----------------------------------------------------------
    const ORDER = ['alley', 'lane', 'yard', 'kitchen', 'press', 'el', 'over', 'street', 'car'];
    // a retry of stretch `name`: everything of it and after it as it was
    api.reset = (name) => {
      const i = Math.max(0, ORDER.indexOf(name));
      for (const T of list) {
        const j = ORDER.indexOf(T.stretch);
        if (j >= i || j < 0) { if (T.reset) T.reset(); else if (T.dynamic) { T.active = false; solid(T, false); } }
      }
    };
    api.trigger = (id, opts = {}) => { const T = byId.get(id); if (T && T.trigger) { T.trigger(opts); emit('trigger', T, opts); } return T; };
    api.update = (dt, t) => { for (const T of list) if (T.update) T.update(dt, t); };
    api.ORDER = ORDER;
    void _p; void _q; void FENCE; void V3; void tube; void allocInkId;
    return api;
  },
  update(api, dt, t) { api.update(dt, t); },
};

// a board fence across the lane at x: posts at the walls, rails, boards, a
// top rail with its pale edge (over); or tall with no pale top and its foot
// broken out, the broken ends pale (under)
function fence(add, stage, wood, MAT, ink, { id, x, h, kind, gap = 0 }) {
  const z0 = LANE.z0, z1 = LANE.z1;
  const g = new THREE.Group();
  const P = [], B = [];
  const rng = stage.rng.fork(Math.round(x * 100));
  for (const z of [z0 + 0.06, z1 - 0.06]) P.push(new THREE.BoxGeometry(0.12, h + 0.08, 0.12).translate(x, (h + 0.08) / 2, z));
  for (const y of kind === 'under' ? [gap + 0.22, h - 0.3] : [0.35, h - 0.3]) P.push(new THREE.BoxGeometry(0.07, 0.12, z1 - z0).translate(x + 0.065, y, (z0 + z1) / 2));
  if (kind === 'over') P.push(new THREE.BoxGeometry(0.14, 0.06, z1 - z0).translate(x, h - 0.01, (z0 + z1) / 2));
  for (let z = z0 + 0.14; z < z1 - 0.14; z += 0.155) {
    const top = kind === 'over' ? h - 0.04 - rng.range(0, 0.05) : h - rng.range(0, 0.12);
    // (the under kind: the boards broken off at their feet, ragged)
    const bot = kind === 'under' ? gap + rng.range(0, 0.07) : 0.04;
    B.push(new THREE.BoxGeometry(0.06, top - bot, 0.135).translate(x, (top + bot) / 2, z + 0.0675));
    if (kind === 'under' && rng.next() < 0.5) B.push(new THREE.BoxGeometry(0.05, rng.range(0.05, 0.2), 0.12).translate(x + 0.02, rng.range(0.02, 0.08), z + 0.0675));
  }
  g.add(new THREE.Mesh(merge(P), MAT.woodDark));
  g.add(new THREE.Mesh(merge(B), wood));
  const mark = (y, w) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.025, z1 - z0 - 0.2).translate(x, y, (z0 + z1) / 2), MAT.mark); m.userData.noRay = true; g.add(m); };
  if (kind === 'over') mark(h + 0.02, 0.07);
  else { mark(gap + 0.012, 0.1); }
  // (the under kind: a wire and a crossbar over its top - plainly no way over)
  if (kind === 'under') g.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, z1 - z0).translate(x, h + 0.18, (z0 + z1) / 2), MAT.iron));
  ink(g, true);
  stage.scene.add(g);
  const T = add({ id, kind, top: h, under: gap, a: { x, z: z0 + 0.02 }, b: { x, z: z1 - 0.02 }, depth: 0.16, stretch: 'lane' });
  T.mesh = g;
  T.update = () => {};
  return T;
}

// a stack of crates that he yanks down as he passes (when I am close): three
// crates toppling about their bottom edges into a line across the way
function crateStack(add, stage, wood, MAT, ink, { id, at, fall, line, stretch }) {
  const S = 0.62;
  const items = at.map((p, i) => {
    const g = new THREE.Group();
    const parts = [new THREE.BoxGeometry(S - 0.02, S - 0.02, S - 0.02).translate(0, S / 2, 0)];
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) parts.push(new THREE.BoxGeometry(0.07, S, 0.07).translate(sx * (S / 2 - 0.035), S / 2, sz * (S / 2 - 0.035)));
    parts.push(new THREE.BoxGeometry(S + 0.01, 0.07, S + 0.01).translate(0, S / 2, 0));
    g.add(new THREE.Mesh(merge(parts), wood));
    const m = new THREE.Mesh(new THREE.BoxGeometry(S + 0.02, 0.02, 0.05).translate(0, S + 0.01, S / 2 - 0.02), MAT.mark); m.userData.noRay = true; g.add(m);
    ink(g);
    stage.scene.add(g);
    return { g, p0: { x: p.x, y: p.y || 0, z: p.z }, p1: fall[i], delay: i === 2 ? 0 : 0.12 + i * 0.08 };
  });
  const T = add({ id, kind: 'over', low: true, top: S, a: line[0], b: line[1], depth: S, active: false, dynamic: true, stretch });
  T.items = items;
  const cols = items.filter((it) => !it.p0.y).map((it) => stage.colliders.addBox(it.p0.x, it.p0.z, S / 2, S / 2, 0, 'crates'));
  T.place = (k) => {
    for (const it of items) {
      const u = SS(0, 1, (k - it.delay) / 0.55);
      const x = it.p0.x + (it.p1.x - it.p0.x) * u, z = it.p0.z + (it.p1.z - it.p0.z) * u;
      const y = it.p0.y * (1 - SS(0.1, 0.8, (k - it.delay) / 0.55)) + 0.05 * Math.sin(Math.PI * Math.min(1, Math.max(0, ((k - it.delay) / 0.55 - 0.8) / 0.3)));
      it.g.position.set(x, y, z);
      it.g.rotation.set(u * Math.PI / 2 * (it.p0.y ? 1 : 0.95), (it.p1.yaw || 0) * u, 0);
    }
  };
  T.place(0);
  T.state = { k: 0, go: false };
  T.trigger = () => { T.state.go = true; for (const c of cols) if (c.cx < 500) c.cx += 1000; };
  T.reset = () => { T.state = { k: 0, go: false }; T.active = false; if (T.col && T.colOn) { T.colOn = false; T.col.cx += 1000; } for (const c of cols) if (c.cx > 500) c.cx -= 1000; T.place(0); };
  T.update = (dt) => {
    if (!T.state.go || T.state.k >= 1.2) return;
    T.state.k = Math.min(1.2, T.state.k + dt);
    T.place(T.state.k);
    if (T.state.k > 0.35 && !T.active) { T.active = true; if (T.col && !T.colOn) { T.colOn = true; T.col.cx -= 1000; } }
  };
  return T;
}

// [C6 2nd] a stack of the edition's bundles (tied with twine) on a hand
// truck, that he pulls over as he passes when I am close: five bundles
// toppling into a line across the way. `toward` +1 / -1: the side of the
// stack the line falls to along `axis` ('z': the line runs along z from the
// stack; 'x': along x)
function bundleStack(add, stage, MAT, ink, { id, x, z, toward = 1, axis = 'z', stretch }) {
  const paper = new THREE.MeshStandardMaterial({ color: 0xbdbdbd, roughness: 0.85 });
  const geo = merge([roundedBox(0.6, 0.3, 0.42, 0.04, 2).translate(0, 0.15, 0), new THREE.BoxGeometry(0.62, 0.02, 0.03).translate(0, 0.31, 0), new THREE.BoxGeometry(0.03, 0.02, 0.44).translate(0, 0.31, 0)]);
  // the hand truck: two wheels, the frame, its handles
  const truck = new THREE.Group();
  truck.add(new THREE.Mesh(merge([
    new THREE.BoxGeometry(0.05, 1.3, 0.05).translate(-0.25, 0.75, 0.22), new THREE.BoxGeometry(0.05, 1.3, 0.05).translate(0.25, 0.75, 0.22),
    new THREE.BoxGeometry(0.6, 0.04, 0.32).translate(0, 0.08, 0.05),
    new THREE.TorusGeometry(0.14, 0.035, 6, 16).rotateY(Math.PI / 2).translate(-0.33, 0.14, 0.24), new THREE.TorusGeometry(0.14, 0.035, 6, 16).rotateY(Math.PI / 2).translate(0.33, 0.14, 0.24),
  ]), MAT.iron));
  truck.position.set(x, 0, z);
  truck.rotation.y = axis === 'z' ? 0 : Math.PI / 2;
  ink(truck);
  stage.scene.add(truck);
  const items = [];
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(geo, paper);
    m.castShadow = true; m.userData.noRay = true;
    const g = new THREE.Group(); g.add(m);
    ink(g);
    stage.scene.add(g);
    const d = toward * (0.55 + i * 0.62);
    const p0 = { x, y: 0.12 + i * 0.31, z };
    const p1 = axis === 'z' ? { x: x + (i % 2 ? 0.12 : -0.1), z: z + d, yaw: (i * 0.41) % 0.5 - 0.25 } : { x: x + d, z: z + (i % 2 ? 0.12 : -0.1), yaw: Math.PI / 2 + (i * 0.41) % 0.5 - 0.25 };
    p1.y = stage.surfaceY(p1.x, p1.z);
    items.push({ g, p0, p1, delay: (4 - i) * 0.06 });
  }
  const end = toward * (0.55 + 4 * 0.62 + 0.35);
  const line = axis === 'z' ? [{ x, z: z + toward * 0.3 }, { x, z: z + end }] : [{ x: x + toward * 0.3, z }, { x: x + end, z }];
  const T = add({ id, kind: 'over', low: true, top: 0.42, a: line[0], b: line[1], depth: 0.62, active: false, dynamic: true, stretch });
  T.items = items;
  const col = stage.colliders.addBox(x, z, 0.36, 0.3, axis === 'z' ? 0 : Math.PI / 2, 'bundles');
  T.place = (k) => {
    for (const it of items) {
      const u = Math.min(1, Math.max(0, (k - it.delay) / 0.5)), e = u * u * (3 - 2 * u);
      const px = it.p0.x + (it.p1.x - it.p0.x) * e, pz = it.p0.z + (it.p1.z - it.p0.z) * e;
      const py = it.p0.y + (it.p1.y - it.p0.y) * e + 0.06 * Math.sin(Math.PI * Math.min(1, Math.max(0, (u - 0.75) / 0.25)));
      it.g.position.set(px, py, pz);
      it.g.rotation.set(axis === 'z' ? toward * e * 0.4 : 0, (it.p1.yaw || 0) * e, axis === 'x' ? -toward * e * 0.4 : 0);
    }
    truck.rotation.z = axis === 'z' ? 0 : -toward * Math.min(1, k * 2) * 1.2;
    truck.rotation.x = axis === 'z' ? toward * Math.min(1, k * 2) * 1.2 : 0;
  };
  T.place(0);
  T.state = { k: 0, go: false };
  T.trigger = () => { T.state.go = true; };
  T.reset = () => { T.state = { k: 0, go: false }; T.active = false; if (T.col && T.colOn) { T.colOn = false; T.col.cx += 1000; } T.place(0); };
  T.update = (dt) => {
    if (!T.state.go || T.state.k >= 1.0) return;
    T.state.k = Math.min(1.0, T.state.k + dt);
    T.place(T.state.k);
    if (T.state.k > 0.3 && !T.active) { T.active = true; if (T.col && !T.colOn) { T.colOn = true; T.col.cx -= 1000; } }
  };
  void col;
  return T;
}

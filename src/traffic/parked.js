import * as THREE from 'three';
import { allocInkId, LAYER } from '../render/layers.js';
import { merge } from '../world/geom.js';
import { KINDS, kindGeo, fleetMats } from '../vehicles/kinds.js';
import { contactShadow } from '../vehicles/models.js';
import { RNG } from '../util/rng.js';
import { STARTS } from '../world/plan.js';

// The parked cars (lane O2): at the plan's bays (C.bays: every kerb lane),
// a few in each district, of the district's kinds (lorries in the Yards,
// saloons on the Docks, vans and saloons in the Tenements, the hearse on the
// Hill). Chosen once for the whole city (seeded: the same street has the same
// cars every night), made bodies near the eye (within 190 m) and drawn as
// instances of their kind's build - a few draws for all of them, the full
// build near, the light one far, only those the eye looks toward. A body is
// solid to cars (Car.js shunts it: it slides on its locked wheels and stops,
// rocks and settles), to men (the walking colliders' bodies) and is a car to
// take: E at its door (vehicles/hijack.js) makes it a real car
// (promote): from then on it is a Car, kept where it is left.
//   parked.bodies (live)  parked.promote(body) -> Car  parked.step(dt, camera)
//   parked.taken (bay keys gone: a car taken or driven off from its bay)
const RADIUS = 190, DROP = 240, NEAR = 42, FAR = 95;
const MARGIN = 0.62, CLOSE = 10;
// a district's share of bays taken and its mix of kinds
const MIX = {
  downtown: { share: 0.28, kinds: [['coupe', 3], ['saloon', 3], ['taxi', 3], ['van', 1], ['police', 0.4]] },
  tenements: { share: 0.34, kinds: [['saloon', 4], ['coupe', 2], ['van', 2.5], ['taxi', 1]] },
  docks: { share: 0.26, kinds: [['saloon', 3.5], ['van', 2.5], ['lorry', 2.5], ['coupe', 1]] },
  yards: { share: 0.22, kinds: [['lorry', 4], ['van', 3], ['saloon', 1.5], ['coupe', 1.5]] },
  hill: { share: 0.16, kinds: [['coupe', 4], ['saloon', 4.5], ['hearse', 1]] },
};
const PARTS = ['body', 'chrome', 'dark', 'glass', 'pale'];
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _e = new THREE.Euler(), _f = new THREE.Vector3();

export class Parked {
  constructor(W) {
    this.W = W;
    const stage = W.stage, C = W.C, G = W.graph;
    this.stage = stage;
    // ---- where: once for the whole city -------------------------------------------------
    const rng = new RNG(5521);
    const recs = [];
    // (along its kerb: the bays of a street's side in the order the traffic passes them)
    const alongOf = (b) => b.x * Math.cos(b.yaw) - b.z * Math.sin(b.yaw);
    const order = [...C.bays].map((b, i) => ({ ...b, i, along: alongOf(b) })).sort((a, b) => (a.street < b.street ? -1 : a.street > b.street ? 1 : a.side - b.side || a.along - b.along));
    let lastKey = null, freeFrom = -1e9;
    const starts = Object.values(STARTS).map((s) => s.car);
    for (const b of order) {
      const key = b.street + ':' + b.side;
      if (key !== lastKey) { lastKey = key; freeFrom = -1e9; }
      const along = b.along;
      const cell = C.cellAt(b.x, b.z), dist = (cell && cell.district) || 'downtown';
      const mix = MIX[dist] || MIX.downtown;
      const r = rng.next(), rk = rng.next();
      if (r > mix.share || along < freeFrom) continue;
      // (clear of the starts' cars and of the junctions' mouths; the race's
      // loop in the Yards kept clear: the Straight, Centre St, Foundry St and
      // Water St round it are the course - vehicles/race.js)
      if (starts.some((s) => Math.hypot(s.x - b.x, s.z - b.z) < 9)) continue;
      if (b.x > -462 && b.x < -358 && b.z > -42 && b.z < 252) continue;
      const S = G.streetAt(b.x, b.z);
      if (S && (S.s < S.edge.hw + 7 || S.s > S.edge.len - S.edge.hw - 7)) continue;
      let tot = 0; for (const [, w] of mix.kinds) tot += w;
      let u = rk * tot, kind = mix.kinds[0][0];
      for (const [k, w] of mix.kinds) { if (u < w) { kind = k; break; } u -= w; }
      const K = KINDS[kind];
      // (a long one takes its neighbour's bay too)
      freeFrom = along + K.halfL * 2 + 1.4;
      recs.push({ bay: b.i, kind, x: b.x, z: b.z, yaw: b.yaw, body: null, gone: false });
    }
    this.recs = recs;
    this.grid = new Map();
    for (const r of recs) { const k = Math.floor(r.x / 64) * 4096 + Math.floor(r.z / 64); if (!this.grid.has(k)) this.grid.set(k, []); this.grid.get(k).push(r); }
    this.bodies = [];
    this.taken = new Set();
    // ---- the draws: by kind, near and far, by part ------------------------------------
    const M = stage.M, X = fleetMats(M);
    const mats = { body: null, chrome: M.chrome, dark: M.rubber, glass: M.carGlass, pale: M.whitewall };
    this.inst = {};
    const count = {};
    for (const r of recs) count[r.kind] = (count[r.kind] || 0) + 1;
    for (const kind of Object.keys(count)) {
      const cap = Math.min(90, count[kind]);
      this.inst[kind] = { cap };
      const id = allocInkId(1);
      for (const lod of ['hi', 'lo', 'box']) {
        const g = kindGeo(kind, lod === 'box' ? 2 : lod === 'lo' ? 1 : 0);
        const geo = {
          body: g.body, chrome: g.chrome,
          dark: merge([g.dark, g.hub, g.red, g.bust].filter(Boolean)),
          glass: merge([g.glass, g.lens].filter(Boolean)),
          pale: g.pale || g.lamp ? merge([g.pale, g.lamp].filter(Boolean)) : null,
        };
        const set = {};
        for (const part of PARTS) {
          if (!geo[part]) continue;
          const im = new THREE.InstancedMesh(geo[part], part === 'body' ? M[KINDS[kind].paint] || M.paint : mats[part], cap);
          im.userData.inkId = id; im.userData.inkFigure = true; im.userData.noRay = true;
          im.castShadow = false; im.receiveShadow = true; im.count = 0; im.visible = false;
          im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
          stage.scene.add(im);
          set[part] = im;
        }
        this.inst[kind][lod] = set;
      }
      void X;
    }
    // their contact shadows: one draw (the coupe's soft footprint, scaled by kind)
    const sh = contactShadow(new THREE.Group(), 1, 1);
    this.shadow = new THREE.InstancedMesh(sh.geometry, sh.material, 240);
    this.shadow.layers.set(LAYER.FX); this.shadow.renderOrder = 3; this.shadow.userData.noRay = true; this.shadow.frustumCulled = false; this.shadow.count = 0;
    stage.scene.add(this.shadow);
    this.dealT = 0; this.dirty = true;
    this._last = { x: 1e9, z: 1e9, yaw: 0 };
  }

  // a record made a body (near the eye)
  make(r) {
    const K = KINDS[r.kind], P = this;
    const b = {
      kind: r.kind, parked: true, rec: r, pos: new THREE.Vector3(r.x, 0, r.z), yaw: r.yaw, vel: new THREE.Vector3(), yawRate: 0,
      spec: { halfL: K.halfL, halfW: K.halfW, mass: (K.spec.mass || 1) * 1.6, k: K.spec.k || 1.32 }, solid: true, rock: 0, rockV: 0, rockAmp: 0, dents: 0, woken: 9,
      box() { const c = Math.cos(this.yaw), s = Math.sin(this.yaw); return { cx: this.pos.x, cz: this.pos.z, hx: K.halfL, hz: K.halfW, c, s }; },
      emit(name, e) { if (name === 'bump' && e.imp > 1.2) { this.rockV += Math.min(1.2, e.imp * 0.08); this.dents++; P.dirty = true; if (P.W.onParkedHit) P.W.onParkedHit(this, e); } },
      hurt() {},
      local(p, out = new THREE.Vector3()) { const dx = p.x - this.pos.x, dz = p.z - this.pos.z, c = Math.cos(this.yaw), s = Math.sin(this.yaw); return out.set(dx * c - dz * s, p.y - this.pos.y, dx * s + dz * c); },
    };
    r.body = b;
    this.bodies.push(b);
    return b;
  }

  // a parked car becomes a real one (taken): its record gone from the bays
  promote(b) {
    const r = b.rec;
    const i = this.bodies.indexOf(b);
    if (i >= 0) this.bodies.splice(i, 1);
    if (r) { r.gone = true; r.body = null; this.taken.add(r.bay); }
    this.dirty = true;
    const v = this.W.V.spawn(b.kind, { at: new THREE.Vector3(b.pos.x, 0, b.pos.z), yaw: b.yaw, lights: false, fleet: true, ink: true });
    v.driver = null;
    return v;
  }

  step(dt, camera) {
    const eye = camera.position;
    this.dealT -= dt;
    if (this.dealT <= 0) {
      this.dealT = 0.5;
      // bodies for the records within reach; gone past DROP
      for (let i = this.bodies.length - 1; i >= 0; i--) {
        const b = this.bodies[i];
        if (Math.abs(b.pos.x - eye.x) > DROP || Math.abs(b.pos.z - eye.z) > DROP) {
          // (a body put back where it stands now: it was shunted, it stays shunted)
          b.rec.x = b.pos.x; b.rec.z = b.pos.z; b.rec.yaw = b.yaw; b.rec.body = null;
          this.bodies.splice(i, 1); this.dirty = true;
        }
      }
      for (let i = Math.floor((eye.x - RADIUS) / 64); i <= Math.floor((eye.x + RADIUS) / 64); i++) for (let j = Math.floor((eye.z - RADIUS) / 64); j <= Math.floor((eye.z + RADIUS) / 64); j++) {
        for (const r of this.grid.get(i * 4096 + j) || []) {
          if (r.gone || r.body) continue;
          if (Math.hypot(r.x - eye.x, r.z - eye.z) > RADIUS) continue;
          this.make(r); this.dirty = true;
        }
      }
    }
    // a shunted car slides on its locked wheels and stops; rocks and settles
    const T = this.stage.track;
    for (const b of this.bodies) {
      if (b.vel.lengthSq() > 1e-4 || Math.abs(b.yawRate) > 1e-3) {
        b.pos.x += b.vel.x * dt; b.pos.z += b.vel.z * dt; b.yaw += b.yawRate * dt;
        b.vel.multiplyScalar(Math.exp(-4.5 * dt)); b.yawRate *= Math.exp(-5 * dt);
        if (b.vel.lengthSq() < 0.01) b.vel.set(0, 0, 0);
        if (Math.abs(b.yawRate) < 0.01) b.yawRate = 0;
        this.dirty = true;
        if (T) for (const k of T.statics(b.pos.x, b.pos.z, 5, b._near || (b._near = []))) {
          if (k.r != null || k.gone) continue;
          const o = obbPush(b, k);
          if (o) { b.pos.x += o[0]; b.pos.z += o[1]; b.vel.multiplyScalar(0.5); }
        }
        // (into its neighbour: stopped against it, the push shared - it rocks)
        for (const o of this.bodies) {
          if (o === b || Math.abs(o.pos.x - b.pos.x) > 8 || Math.abs(o.pos.z - b.pos.z) > 8) continue;
          const c = Math.cos(o.yaw), s = Math.sin(o.yaw);
          const push = obbPush(b, { cx: o.pos.x, cz: o.pos.z, hx: o.spec.halfL, hz: o.spec.halfW, c, s });
          if (push) { b.pos.x += push[0] * 0.6; b.pos.z += push[1] * 0.6; o.pos.x -= push[0] * 0.4; o.pos.z -= push[1] * 0.4; o.vel.addScaledVector(b.vel, 0.3); b.vel.multiplyScalar(0.4); o.rockV += 0.3; }
        }
      }
      if (b.rockV || b.rockAmp > 0.01) { b.rockAmp = Math.max(0, b.rockAmp + b.rockV - dt * 1.6); b.rockV = 0; b.rock += dt; this.dirty = true; }
    }
    // the instances: rewritten when one moved or the eye turned or went on
    camera.getWorldDirection(_f);
    const fl = Math.hypot(_f.x, _f.z) || 1, fx = _f.x / fl, fz = _f.z / fl;
    const yaw = Math.atan2(fx, fz), L = this._last;
    const turned = Math.abs(Math.atan2(Math.sin(yaw - L.yaw), Math.cos(yaw - L.yaw))) > 0.1 || Math.hypot(eye.x - L.x, eye.z - L.z) > 3;
    if (this.dirty || turned) this.relayout(camera, eye, fx, fz, yaw);
  }

  relayout(camera, eye, fx, fz, yaw) {
    this.dirty = false;
    Object.assign(this._last, { x: eye.x, z: eye.z, yaw });
    const half = Math.atan(Math.tan((camera.fov * Math.PI) / 360) * (camera.aspect || 1.6)) + MARGIN;
    const cosHalf = Math.cos(Math.min(Math.PI, half));
    const n = {};
    let ns = 0;
    const G = this.W.C;
    for (const b of this.bodies) {
      const dx = b.pos.x - eye.x, dz = b.pos.z - eye.z, d = Math.hypot(dx, dz);
      const I = this.inst[b.kind];
      if (!I) continue;
      if (d > CLOSE && (dx * fx + dz * fz) / d < cosHalf) continue;
      const lod = d < NEAR ? 'hi' : d < FAR ? 'lo' : 'box';
      const key = b.kind + lod;
      const k = n[key] = (n[key] || 0);
      if (k >= I.cap) continue;
      n[key] = k + 1;
      const gy = G.groundAt(b.pos.x, b.pos.z);
      _q.setFromEuler(_e.set(Math.sin(b.rock * 9) * 0.03 * Math.min(1, b.rockAmp), b.yaw, 0, 'YXZ'));
      _m.compose(_p.set(b.pos.x, gy, b.pos.z), _q, _s.set(1, 1, 1));
      for (const im of Object.values(I[lod])) im.setMatrixAt(k, _m);
      if (ns < this.shadow.instanceMatrix.count) {
        const K = KINDS[b.kind];
        _q.setFromAxisAngle(_p.set(0, 1, 0), b.yaw);
        this.shadow.setMatrixAt(ns++, _m.compose(_p.set(b.pos.x, gy + 0.012, b.pos.z), _q, _s.set(K.halfL * 2 + 1.2, 1, K.halfW * 2 + 1.0)));
      }
    }
    for (const [kind, I] of Object.entries(this.inst)) for (const lod of ['hi', 'lo', 'box']) {
      const c = n[kind + lod] || 0;
      for (const im of Object.values(I[lod])) {
        im.count = c; im.visible = c > 0;
        if (c) { im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.boundingSphere.radius += 4; }
      }
    }
    this.shadow.count = ns; this.shadow.instanceMatrix.needsUpdate = true;
  }

  // the parked bodies near a point (the hijack's look, the traffic's)
  near(x, z, r) { return this.bodies.filter((b) => Math.abs(b.pos.x - x) < r && Math.abs(b.pos.z - z) < r); }

  dispose() {
    for (const I of Object.values(this.inst)) for (const lod of ['hi', 'lo', 'box']) for (const im of Object.values(I[lod] || {})) { if (im.parent) im.parent.remove(im); im.dispose(); }
    if (this.shadow.parent) this.shadow.parent.remove(this.shadow);
    this.shadow.dispose();
  }
}

// a body's box out of a static box: the push (least overlap), or null
function obbPush(b, k) {
  const ca = Math.cos(b.yaw), sa = Math.sin(b.yaw), hx = b.spec.halfL, hz = b.spec.halfW;
  const axes = [[ca, -sa], [sa, ca], [k.c, -k.s], [k.s, k.c]];
  const dx = k.cx - b.pos.x, dz = k.cz - b.pos.z;
  let best = Infinity, bn = null;
  for (const [ax, az] of axes) {
    const ra = hx * Math.abs(ca * ax - sa * az) + hz * Math.abs(sa * ax + ca * az);
    const rb = k.hx * Math.abs(k.c * ax - k.s * az) + k.hz * Math.abs(k.s * ax + k.c * az);
    const d = dx * ax + dz * az;
    const o = ra + rb - Math.abs(d);
    if (o <= 0) return null;
    if (o < best) { best = o; bn = d > 0 ? [-ax, -az] : [ax, az]; }
  }
  return [bn[0] * best, bn[1] * best];
}

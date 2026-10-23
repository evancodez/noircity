import * as THREE from 'three';
import { allocInkId, LAYER } from '../render/layers.js';
import { merge } from '../world/geom.js';
import { KINDS, kindGeo, fleetMats, lookAt, scrapeGeo } from '../vehicles/kinds.js';
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
// [the user: "not overly copy-paste"] Each car's look by a seeded hash of its
// bay (kinds.js lookAt): its kind's variant (a set of instances each), its grey
// (the instance's colour), whitewalls (a part of their own), now and then a
// scrape along a door (one draw for all of them) or a flat tyre it sags on.
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
const PARTS = ['body', 'chrome', 'dark', 'glass', 'pale', 'name', 'white', 'all'];
// a paint's grey as the instance's colour over the black paint's (linear: the ratio)
const PAINT_HEX = { paint: 0x030303, paintGrey: 0x101010, paintPale: 0x2a2a2a };
const _c = new THREE.Color();
const _m2 = new THREE.Matrix4(), _m3 = new THREE.Matrix4(), _r = new THREE.Matrix4();
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
    // [O2] after the critic (M3: the first W of the game ran into a car parked 20 m ahead of
    // the start's coupe): each start's kerb is kept clear 48 m ahead of its car, in its line
    const starts = Object.values(STARTS).map((s) => s.car);
    const inLine = (b) => starts.some((s) => {
      const fx = Math.cos(s.yaw ?? 0), fz = -Math.sin(s.yaw ?? 0), dx = b.x - s.x, dz = b.z - s.z;
      const along = dx * fx + dz * fz, lat = Math.abs(dx * fz - dz * fx);
      return along > -9 && along < 48 && lat < 3.6;
    });
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
      if (starts.some((s) => Math.hypot(s.x - b.x, s.z - b.z) < 9) || inLine(b)) continue;
      if (b.x > -462 && b.x < -358 && b.z > -42 && b.z < 252) continue;
      const S = G.streetAt(b.x, b.z);
      if (S && (S.s < S.edge.hw + 7 || S.s > S.edge.len - S.edge.hw - 7)) continue;
      let tot = 0; for (const [, w] of mix.kinds) tot += w;
      let u = rk * tot, kind = mix.kinds[0][0];
      for (const [k, w] of mix.kinds) { if (u < w) { kind = k; break; } u -= w; }
      const K = KINDS[kind];
      // (a long one takes its neighbour's bay too)
      freeFrom = along + K.halfL * 2 + 1.4;
      recs.push({ bay: b.i, kind, x: b.x, z: b.z, yaw: b.yaw, body: null, gone: false, look: lookAt(kind, b.x, b.z, 0, { parked: true }) });
    }
    this.recs = recs;
    this.grid = new Map();
    for (const r of recs) { const k = Math.floor(r.x / 64) * 4096 + Math.floor(r.z / 64); if (!this.grid.has(k)) this.grid.set(k, []); this.grid.get(k).push(r); }
    this.bodies = [];
    this.taken = new Set();
    // ---- the draws: by kind and variant, near, light and far, by part ----------------
    const M = stage.M, X = fleetMats(M);
    const mats = { body: M.paint, chrome: M.chrome, dark: M.rubber, glass: M.carGlass, pale: M.whitewall, name: X.name, white: M.whitewall, all: M.paint };
    const base = new THREE.Color(PAINT_HEX.paint);
    this.tint = {};
    for (const [k, hex] of Object.entries(PAINT_HEX)) { _c.setHex(hex); this.tint[k] = new THREE.Color(_c.r / base.r, _c.g / base.g, _c.b / base.b); }
    this.inst = {};
    const count = {}, ids = {};
    for (const r of recs) { const key = r.kind + ':' + r.look.variant; count[key] = (count[key] || 0) + 1; }
    for (const key of Object.keys(count)) {
      const [kind, vs] = key.split(':'), v = +vs;
      const cap = Math.min(60, count[key]);
      this.inst[key] = { cap };
      const id = ids[kind] || (ids[kind] = allocInkId(1));
      for (const lod of ['hi', 'lo', 'box']) {
        const g = kindGeo(kind, lod === 'box' ? 2 : lod === 'lo' ? 1 : 0, v);
        // (near: every part; the light build: the chrome with the dark, no names, no
        // whitewalls; far: the whole car one mesh)
        const geo = lod === 'box' ? { all: g.all } : {
          body: g.body,
          chrome: lod === 'hi' ? g.chrome : null,
          dark: merge([g.dark, g.hub, g.red, g.bust, lod === 'lo' ? g.chrome : null].filter(Boolean)),
          glass: merge([g.glass, g.lens].filter(Boolean)),
          pale: g.pale || g.lamp ? merge([g.pale, g.lamp].filter(Boolean)) : null,
          name: lod === 'hi' ? g.name : null,
          white: lod === 'hi' ? g.white : null,
        };
        const set = {};
        for (const part of PARTS) {
          if (!geo[part]) continue;
          const im = new THREE.InstancedMesh(geo[part], mats[part], cap);
          im.userData.inkId = id; im.userData.inkFigure = true; im.userData.noRay = true;
          im.castShadow = false; im.receiveShadow = true; im.count = 0; im.visible = false;
          im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
          // (the paint's grey: the instance's colour)
          if (part === 'body' || part === 'all') { im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3); im.instanceColor.setUsage(THREE.DynamicDrawUsage); }
          stage.scene.add(im);
          set[part] = im;
        }
        this.inst[key][lod] = set;
      }
    }
    // the scrapes along the doors: one draw for all of them
    this.scrapes = new THREE.InstancedMesh(scrapeGeo(), M.whitewall, 60);
    this.scrapes.userData.noRay = true; this.scrapes.castShadow = false; this.scrapes.count = 0; this.scrapes.frustumCulled = false;
    this.scrapes.userData.inkId = ids.saloon || allocInkId(1); this.scrapes.userData.inkFigure = true;
    stage.scene.add(this.scrapes);
    // their contact shadows: one draw (the coupe's soft footprint, scaled by kind)
    const sh = contactShadow(new THREE.Group(), 1, 1);
    this.shadow = new THREE.InstancedMesh(sh.geometry, sh.material, 240);
    this.shadow.layers.set(LAYER.FX); this.shadow.renderOrder = 3; this.shadow.userData.noRay = true; this.shadow.frustumCulled = false; this.shadow.count = 0;
    stage.scene.add(this.shadow);
    this.dealT = 0; this.dirty = true;
    // (the rounds' world: the near ones' boxes, a mesh each not drawn - RayWorld reads its matrix)
    this.proxies = new Map();
    this._last = { x: 1e9, z: 1e9, yaw: 0 };
  }

  // a record made a body (near the eye)
  make(r) {
    if (!r.look) r.look = lookAt(r.kind, r.x, r.z, 0, { parked: true });
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

  // the rounds' solids: a proxy for each body within 75 m, out again past it
  rays() {
    const G = this.W.game, R = G.rays, eye = G.camera.position;
    if (!R) return;
    for (const [b, m] of this.proxies) if (!this.bodies.includes(b) || Math.hypot(b.pos.x - eye.x, b.pos.z - eye.z) > 85) { R.remove(m); this.proxies.delete(b); }
    for (const b of this.bodies) {
      if (this.proxies.has(b) || Math.hypot(b.pos.x - eye.x, b.pos.z - eye.z) > 75) continue;
      const m = new THREE.Mesh(kindGeo(b.kind, 2, b.rec.look.variant).body);
      m.userData.part = 'body'; m.userData.parked = b;
      m.position.set(b.pos.x, 0, b.pos.z); m.rotation.y = b.yaw; m.updateMatrixWorld(true);
      R.add(m);
      this.proxies.set(b, m);
    }
  }
  // a parked car becomes a real one (taken): its record gone from the bays
  promote(b) {
    const r = b.rec;
    const i = this.bodies.indexOf(b);
    if (i >= 0) this.bodies.splice(i, 1);
    if (r) { r.gone = true; r.body = null; this.taken.add(r.bay); }
    const px = this.proxies.get(b); if (px && this.W.game.rays) { this.W.game.rays.remove(px); this.proxies.delete(b); }
    this.dirty = true;
    const v = this.W.V.spawn(b.kind, { at: new THREE.Vector3(b.pos.x, 0, b.pos.z), yaw: b.yaw, lights: false, fleet: true, ink: true, look: b.rec.look });
    v.driver = null;
    return v;
  }

  step(dt, camera) {
    const eye = camera.position;
    this.dealT -= dt;
    if (this.dealT <= 0) {
      this.dealT = 0.5;
      this.rays();
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
      const px = this.proxies.get(b);
      if (px && (Math.abs(px.position.x - b.pos.x) > 0.05 || Math.abs(px.position.z - b.pos.z) > 0.05)) { px.position.set(b.pos.x, 0, b.pos.z); px.rotation.y = b.yaw; this.W.game.rays.refresh(px); }
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
    let ns = 0, nsc = 0;
    const G = this.W.C;
    for (const b of this.bodies) {
      const dx = b.pos.x - eye.x, dz = b.pos.z - eye.z, d = Math.hypot(dx, dz);
      const L = b.rec.look, set = b.kind + ':' + L.variant;
      const I = this.inst[set];
      if (!I) continue;
      if (d > CLOSE && (dx * fx + dz * fz) / d < cosHalf) continue;
      const lod = d < NEAR ? 'hi' : d < FAR ? 'lo' : 'box';
      const key = set + lod;
      const k = n[key] = (n[key] || 0);
      if (k >= I.cap) continue;
      n[key] = k + 1;
      const gy = G.groundAt(b.pos.x, b.pos.z);
      // (a flat tyre: the car down on that side and that end a little)
      _q.setFromEuler(_e.set(Math.sin(b.rock * 9) * 0.03 * Math.min(1, b.rockAmp) + L.sag * 0.04, b.yaw, L.sag ? 0.012 : 0, 'YXZ'));
      _m.compose(_p.set(b.pos.x, gy - (L.sag ? 0.05 : 0), b.pos.z), _q, _s.set(1, 1, 1));
      const S = I[lod];
      for (const [part, im] of Object.entries(S)) {
        if (part === 'white') continue;
        im.setMatrixAt(k, _m);
        if (im.instanceColor) im.setColorAt(k, this.tint[L.paint] || this.tint.paint);
      }
      if (S.white && L.white) { const kw = n[key + 'w'] = (n[key + 'w'] || 0); if (kw < I.cap) { n[key + 'w'] = kw + 1; S.white.setMatrixAt(kw, _m); } }
      // (a scrape along a door: a few pale strokes, near only)
      if (L.scrape && lod === 'hi' && nsc < this.scrapes.instanceMatrix.count) {
        const SC = KINDS[b.kind].scrape;
        if (SC) {
          const lx = SC.x[0] + (SC.x[1] - SC.x[0]) * L.u;
          _m2.makeTranslation(lx, SC.y, L.scrape * SC.z);
          if (L.scrape < 0) _m2.multiply(_r.makeRotationY(Math.PI));
          this.scrapes.setMatrixAt(nsc++, _m3.multiplyMatrices(_m, _m2));
        }
      }
      if (ns < this.shadow.instanceMatrix.count) {
        const K = KINDS[b.kind];
        _q.setFromAxisAngle(_p.set(0, 1, 0), b.yaw);
        this.shadow.setMatrixAt(ns++, _m.compose(_p.set(b.pos.x, gy + 0.012, b.pos.z), _q, _s.set(K.halfL * 2 + 1.2, 1, K.halfW * 2 + 1.0)));
      }
    }
    for (const [set, I] of Object.entries(this.inst)) for (const lod of ['hi', 'lo', 'box']) {
      for (const [part, im] of Object.entries(I[lod])) {
        const c = part === 'white' ? (n[set + lod + 'w'] || 0) : (n[set + lod] || 0);
        im.count = c; im.visible = c > 0;
        if (c) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.computeBoundingSphere(); im.boundingSphere.radius += 4; }
      }
    }
    this.scrapes.count = nsc; this.scrapes.visible = nsc > 0; this.scrapes.instanceMatrix.needsUpdate = true;
    this.shadow.count = ns; this.shadow.instanceMatrix.needsUpdate = true;
  }

  // the parked bodies near a point (the hijack's look, the traffic's)
  near(x, z, r) { return this.bodies.filter((b) => Math.abs(b.pos.x - x) < r && Math.abs(b.pos.z - z) < r); }

  dispose() {
    for (const I of Object.values(this.inst)) for (const lod of ['hi', 'lo', 'box']) for (const im of Object.values(I[lod] || {})) { if (im.parent) im.parent.remove(im); im.dispose(); }
    if (this.scrapes.parent) this.scrapes.parent.remove(this.scrapes);
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

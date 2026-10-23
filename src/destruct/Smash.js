import * as THREE from 'three';
import { allocInkId } from '../render/layers.js';
import { SURF } from '../util/RayWorld.js';
import { FIRE, ATLAS } from '../fx/fxTextures.js';
import { KINDS, kindGeo } from './smashKinds.js';
import { SmashPieces } from './SmashPieces.js';
import { CarDamage } from './CarDamage.js';

// [O6] The destruction set (lane O6; the API and the caps: docs/seams/SMASH.md).
// One per stage (stage.smash, the noircity stage's `props` part). Anything
// the world places is registered as an ITEM of a KIND (src/destruct/
// smashKinds.js: the lamp post, the hydrant, the bin, the call box, the
// bench, the stall, the newsstand, the crate, the fence, the street sign,
// the telegraph pole, the awning, the shop glass) and answers what meets it:
//   smash.register(record | Object3D, kind, opts) -> item
//   smash.hit(item | record | Object3D, point, impulse: Vector3, by) -> 'hit' | 'over' | 'break' | null
//        by: 'car' | 'bullet' | 'fist' | 'body' | 'blast' (impulse: its way and its speed, m/s)
//   smash.collide(car, out)       (Car.js through stage.track.smash: what a car meets)
//   smash.bullet(hit, dir, weak)  (fx/React.js through stage.props.hit: what a round meets)
//   smash.blast(at, r, power)     smash.mend(item)   smash.mendAll()   smash.update(dt)
// A STANDING item is drawn merged with its neighbours (the city's chunk
// meshes, stream.js; a bed's merged set): the merge records each item's
// vertex ranges (its SLOTS), so the item that goes over leaves the merge -
// its triangles collapsed, in the draw and in the bullets' world - and is
// drawn on its own: an instance of its kind's pool (one draw a kind), with
// a box in the bullets' world. It is physical while it moves and where it
// lies: a rigid body on the ground (a tumble, a roll), a hinge at the base
// (a post that leans, bends, falls); it stops a man (a box in the walking
// colliders where it lies) and slows a car (Car.collide meets it again: a
// light thing is kicked on, a heavy one is a bump). Capped: at most CAP
// items out of their merge at once; past it, the oldest at rest that the eye
// cannot see goes back to standing (the city mends out of sight), as does
// everything more than MEND_R from the eye. Its pieces (planks, fruit,
// papers, canvas, glass) are SmashPieces' pools. Cars: CarDamage (dents, a
// wing, a lamp, glass, a door, the engine's steam to fire, the blast, the
// wreck, the tyres, the tram's sparks).
// Events (game.emit): 'smash' { kind, pos, by, how, item }.
export const CAP = 140;                // items out of their merge at once
const MEND_R = 200;                   // (m) further than this from the eye: mended
const CELL = 8;
const G = 9.8;
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _a = new THREE.Vector3(), _r = new THREE.Vector3(), _n = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4(), _one = new THREE.Vector3(1, 1, 1);
const _f = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const CORNERS = [];
const _rs = Array.from({ length: 8 }, () => new THREE.Vector3());
for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) CORNERS.push([sx, sy, sz]);

let NEXT = 1;

export class Smash {
  // opts: { mats: { iron, kerb, tree, wood, cloth, fruit, paper, shard }, idOf(k) -> an ink id }
  constructor(stage, opts = {}) {
    this.stage = stage;
    this.items = [];
    this.byRec = new Map();
    this.grid = new Map();
    this.out = [];               // items out of their merge (detached)
    this.dark = [];              // lamps shot out (standing, dark)
    this.geysers = [];
    this.jets = [];
    this.bulbs = [];             // a leaning lamp's own glowing mouth (a few)
    this.events = [];            // the plays' record (what went, how, the first frame)
    this.stats = { over: 0, broken: 0, shot: 0, mended: 0, recycled: 0, maxOut: 0 };
    this.mats = opts.mats;
    this.idOf = opts.idOf || ((k) => { const c = this._ids || (this._ids = {}); return c[k] ?? (c[k] = allocInkId()); });
    this.pools = {};
    this.pieces = new SmashPieces(stage, opts.mats, opts.caps || {}, this.idOf);
    this.cars = new CarDamage(this);
    this.rngS = 0x2F6E2B1;
    this._near = [];
    this._hits = [];
    this._hitPool = Array.from({ length: 16 }, () => ({ drag: 1, dmg: 0, pos: new THREE.Vector3(), kind: '', item: null }));
    this.group = new THREE.Group();
    this.group.name = 'smash';
    stage.scene.add(this.group);
    // the pools of whole things out of their merge (built now, invisible: the
    // city's compile sees them; no ink id is taken from the shared counter)
    for (const [kind, K] of Object.entries(KINDS)) {
      if (!K.cap) continue;
      const geo = kindGeo(kind);
      const im = new THREE.InstancedMesh(geo, this.mats[K.mat] || this.mats.kerb, K.cap);
      im.name = 'smash_' + kind;
      im.userData.inkId = this.idOf(kind);
      im.userData.inkPerInstance = false;
      im.userData.noRay = true;
      im.frustumCulled = false;
      im.receiveShadow = true;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (let i = 0; i < K.cap; i++) im.setMatrixAt(i, ZERO);
      im.count = 0;
      im.visible = false;
      this.group.add(im);
      geo.computeBoundingBox();
      const b = geo.boundingBox;
      this.pools[kind] = { im, cap: K.cap, free: [], used: 0, owner: new Array(K.cap).fill(null),
        c: b.getCenter(new THREE.Vector3()), e: b.getSize(new THREE.Vector3()).multiplyScalar(0.5) };
    }
    // the bullets' boxes of what is out (a unit box, never drawn)
    this.proxyGeo = new THREE.BoxGeometry(1, 1, 1);
    this.proxyMat = new THREE.MeshBasicMaterial({ visible: false });
    // a hydrant's stump, a leaning lamp's lit mouth
    this.stumpGeo = new THREE.CylinderGeometry(0.12, 0.15, 0.12, 12).translate(0, 0.06, 0);
    this.bulbGeo = new THREE.CircleGeometry(0.33, 18).rotateX(Math.PI / 2);
    this.bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(8) });
  }

  get game() { return this.stage.game; }
  rnd(a = 0, b = 1) { this.rngS = (this.rngS * 16807) % 2147483647; return a + (b - a) * (this.rngS / 2147483647); }
  gauss() { return (this.rnd() + this.rnd() + this.rnd() - 1.5) * 1.15; }

  // ---- the registry -------------------------------------------------------------------------
  // target: a record { x, z, yaw } (the generator's: drawn merged, slots come
  // from the merge) or an Object3D (drawn on its own: it is moved itself).
  // opts: { y: base height (else the walking surface), merged: true (slots
  // will come from a merge), colliders: true (add its walking and car
  // colliders here: a bed's own things; the city's are bounds' and track's),
  // pane (glass), w, d, h, wall: { nx, nz } (an awning's) }
  register(target, kind, opts = {}) {
    const K = KINDS[kind];
    if (!K) throw new Error(`smash.register: no kind '${kind}'`);
    const isObj = !!(target && target.isObject3D);
    const rec = isObj ? null : target;
    const p = isObj ? target.getWorldPosition(new THREE.Vector3()) : null;
    const x = isObj ? p.x : rec.x, z = isObj ? p.z : rec.z;
    const yaw = isObj ? new THREE.Euler().setFromQuaternion(target.getWorldQuaternion(_q), 'YXZ').y : rec.yaw || 0;
    const y0 = opts.y ?? (isObj ? p.y : this.stage.surfaceY(x, z));
    const it = {
      id: NEXT++, kind, K, rec, obj: isObj ? target : null, x, z, yaw, y0, opts,
      q0: new THREE.Quaternion().setFromAxisAngle(UP, yaw), P: new THREE.Vector3(x, y0, z), Q: new THREE.Quaternion().setFromAxisAngle(UP, yaw),
      state: 'stand', slots: [], man: null, car: null, hits: 0, hp: K.hp ?? 3, body: null, inst: -1, proxy: null, entry: null, lamp: null, t: 0,
      fp: K.fp ? { hx: K.fp[0], hz: K.fp[1] } : null,
    };
    if (isObj) {
      it.home = { p: target.position.clone(), q: target.quaternion.clone(), parent: target.parent };
      target.traverse((o) => { if (o.isMesh) o.userData.prop = it; });
    }
    if (rec) this.byRec.set(rec, it);
    this.items.push(it);
    const k = this.key(x, z);
    if (!this.grid.has(k)) this.grid.set(k, []);
    this.grid.get(k).push(it);
    if (opts.colliders) this.addColliders(it);
    return it;
  }
  key(x, z) { return Math.floor(x / CELL) * 100003 + Math.floor(z / CELL); }
  near(x, z, r, out = this._near) {
    out.length = 0;
    for (let i = Math.floor((x - r) / CELL); i <= Math.floor((x + r) / CELL); i++) for (let j = Math.floor((z - r) / CELL); j <= Math.floor((z + r) / CELL); j++) {
      const L = this.grid.get(i * 100003 + j);
      if (L) for (const it of L) out.push(it);
    }
    return out;
  }
  // the item standing at (x, z) (track.js and bounds look theirs up: a post, a bench's box)
  itemAt(x, z, tag = null) {
    const L = this.grid.get(this.key(x, z));
    if (!L) return null;
    for (const it of L) if (Math.abs(it.x - x) < 0.05 && Math.abs(it.z - z) < 0.05 && (!tag || it.K.tags.includes(tag))) return it;
    return null;
  }
  itemOf(x) { return !x ? null : x.K ? x : x.isObject3D ? x.userData.prop || null : this.byRec.get(x) || null; }

  // a bed's own colliders (the city's are made by bounds and track from the plan)
  addColliders(it) {
    const S = this.stage, K = it.K, T = S.track;
    if (K.round) {
      it.man = S.colliders.addCircle(it.x, it.z, K.r, K.tags[0]);
      if (T && T.addCircle && !K.high) it.car = T.addCircle(it.x, it.z, K.r, K.tags[0], this.giveOf(it));
    } else if (it.fp && !K.high && !K.pane) {
      it.man = S.colliders.addBox(it.x, it.z, it.fp.hx, it.fp.hz, it.yaw, K.tags[0]);
    }
  }
  // what a round thing gives to a car (Car.vsCircle's give: it bends or goes over at speed)
  giveOf(it) {
    const K = it.K;
    return { give: true, giveAt: K.giveAt, drag: K.drag, hurt: K.hurt, item: it, onGive: (car, vn) => this.carHit(it, car, vn) };
  }
  // the city's track hands its circle of a registered post here (track.js)
  bindCircle(it, c) { it.car = c; Object.assign(c, this.giveOf(it)); return c; }

  // ---- the merges (the city's chunks, a bed's set) ------------------------------------------------
  // a merged mesh came in with its ranges ({ owner: record, start, count } in
  // vertices): each item's slots; one already out is taken out of it at once
  chunkIn(key, meshes) {
    for (const m of meshes) {
      const R = m.userData.ranges;
      if (!R) continue;
      for (const r of R) {
        const it = this.byRec.get(r.owner);
        if (!it) continue;
        const s = { mesh: m, start: r.start, count: r.count, key, attr: r.attr || 'position' };
        it.slots.push(s);
        // (one out of its merge is taken out of the new build at once; a dark lamp's mouth stays dark)
        if (s.attr === 'color' ? it.dark || (it.K.lamp && it.state !== 'stand') : it.state !== 'stand') this.collapse(s, it);
        // (a merge the bullets do not see - the city's benches and stalls - gives each its box while it stands)
        if (m.userData.noRay && it.state === 'stand' && it.K.fp && !it.proxy) this.addProxy(it);
      }
    }
  }
  // a merged mesh going (a chunk dropped): its slots are forgotten
  chunkOut(key, meshes = null) {
    const owners = new Set();
    if (meshes) for (const m of meshes) for (const r of m.userData.ranges || []) owners.add(r.owner);
    for (const o of owners) {
      const it = this.byRec.get(o);
      if (!it) continue;
      it.slots = it.slots.filter((s) => s.key !== key);
      if (it.state === 'stand' && it.proxy) this.dropProxy(it);
    }
  }
  // a slot's triangles collapsed onto one point (in the draw and in the
  // bullets' world: the item is not there any more); a lamp's mouth (a
  // colour slot) goes dark
  collapse(s, it) {
    if (s.saved) return;
    const g = s.mesh.geometry, A = g.getAttribute(s.attr);
    if (!A) return;
    const a = A.array, i0 = s.start * A.itemSize, n = s.count * A.itemSize;
    s.saved = a.slice(i0, i0 + n);
    if (s.attr === 'color') a.fill(0, i0, i0 + n);
    else {
      const x = a[i0], y = a[i0 + 1], z = a[i0 + 2];
      for (let i = i0; i < i0 + n; i += 3) { a[i] = x; a[i + 1] = y; a[i + 2] = z; }
      // (the bullets' world keeps its own copy of the triangles: they go too)
      const e = this.entryOf(s.mesh);
      if (e && e.bvh && e.bvh.tri && e.bvh.count * 3 === A.count) {
        const T = e.bvh.tri, t0 = (s.start / 3) * 9, tn = (s.count / 3) * 9;
        s.savedTri = T.slice(t0, t0 + tn);
        T.fill(0, t0, t0 + tn);
      }
    }
    A.addUpdateRange(i0, n);
    A.needsUpdate = true;
    void it;
  }
  restore(s) {
    if (!s.saved) return;
    const g = s.mesh.geometry, A = g.getAttribute(s.attr);
    if (A) {
      const i0 = s.start * A.itemSize;
      A.array.set(s.saved, i0);
      A.addUpdateRange(i0, s.saved.length);
      A.needsUpdate = true;
      if (s.savedTri) {
        const e = this.entryOf(s.mesh);
        if (e && e.bvh && e.bvh.tri) e.bvh.tri.set(s.savedTri, (s.start / 3) * 9);
      }
    }
    s.saved = null; s.savedTri = null;
  }
  // a lamp's mouth at a level (0 dark, 1 lit): its colour slot rewritten
  bulbLevel(it, k) {
    for (const s of it.slots) {
      if (s.attr !== 'color') continue;
      if (k >= 1) { this.restore(s); continue; }
      if (!s.saved) this.collapse(s, it);
      if (k > 0) {
        const A = s.mesh.geometry.getAttribute('color'), i0 = s.start * 3;
        for (let i = 0; i < s.saved.length; i++) A.array[i0 + i] = s.saved[i] * k;
        A.addUpdateRange(i0, s.saved.length); A.needsUpdate = true;
      }
    }
  }
  entryOf(mesh) {
    const R = this.stage.rays;
    if (!R) return null;
    if (mesh.userData._rayE && R.entries.includes(mesh.userData._rayE)) return mesh.userData._rayE;
    const e = R.entries.find((x) => x.mesh === mesh) || null;
    mesh.userData._rayE = e;
    return e;
  }

  // ---- out of the merge, and back ----------------------------------------------------------------------
  detach(it) {
    if (it.state !== 'stand') return false;
    it.state = 'live';
    it.t = 0;
    for (const s of it.slots) if (s.attr !== 'color' || it.K.lamp) this.collapse(s, it);
    this.colliders(it, false);
    const K = it.K;
    if (it.obj) {
      // (its own mesh: it is the moving thing)
      it.obj.traverse((o) => { if (o.isMesh && this.stage.rays) this.stage.rays.setEnabled(o, false); });
    } else if (this.pools[it.kind]) {
      const P = this.pools[it.kind];
      let i = P.free.length ? P.free.pop() : P.used < P.cap ? P.used++ : -1;
      if (i < 0) i = this.takeSlot(P);
      if (i >= 0) {
        P.owner[i] = it; it.inst = i;
        if (P.im.count < P.used) P.im.count = P.used;
        P.im.visible = true;
      }
    }
    if (K.proxy !== false && !it.obj && !it.proxy) this.addProxy(it);
    it.P.set(it.x, it.y0, it.z); it.Q.copy(it.q0);
    this.draw(it);
    this.out.push(it);
    this.stats.maxOut = Math.max(this.stats.maxOut, this.out.length);
    if (this.out.length > CAP) this.recycle();
    return true;
  }
  // a pool full: the instance of the oldest resting item out of view
  takeSlot(P) {
    let best = -1, bt = -1;
    for (let k = 0; k < P.cap; k++) { const o = P.owner[k]; if (o && o.state === 'rest' && o.t > bt && !this.seen(o)) { bt = o.t; best = k; } }
    if (best < 0) for (let k = 0; k < P.cap; k++) { const o = P.owner[k]; if (o && o.state === 'rest' && o.t > bt) { bt = o.t; best = k; } }
    if (best < 0) return -1;
    this.mend(P.owner[best]);
    this.stats.recycled++;
    const i = P.free.pop();
    return i ?? -1;
  }
  // over the cap: the oldest at rest that the eye does not see goes back
  recycle() {
    let best = null;
    for (const it of this.out) if (it.state === 'rest' && !this.seen(it) && (!best || it.t > best.t)) best = it;
    if (!best) for (const it of this.out) if (it.state === 'rest' && (!best || it.t > best.t)) best = it;
    if (best) { this.mend(best); this.stats.recycled++; }
  }
  seen(it) {
    const G0 = this.game;
    if (!G0) return false;
    const c = G0.camera.position;
    _d.set(it.P.x - c.x, 0, it.P.z - c.z);
    const d = _d.length();
    if (d > 90) return false;
    G0.camera.getWorldDirection(_f); _f.y = 0; _f.normalize();
    return _d.dot(_f) > -0.2 * d;
  }

  // the walking and the car's colliders of a standing item: on or off
  colliders(it, on) {
    const S = this.stage;
    if (!it.man && !it.manLooked) {
      it.manLooked = true;
      const L = S.colliders.near ? S.colliders.near(it.x, it.z, 0.5) : [...S.colliders.circles, ...S.colliders.boxes];
      for (const o of L) {
        const ox = o.r != null ? o.x : o.cx, oz = o.r != null ? o.z : o.cz;
        if (Math.abs(ox - it.x) < 0.06 && Math.abs(oz - it.z) < 0.06 && it.K.tags.includes(o.tag)) { it.man = o; break; }
      }
    }
    if (it.man) it.man.gone = !on;
    if (it.car) it.car.gone = !on;
    // (a plain Colliders - not the city's grid - knows no `gone`: out of its lists)
    if (it.man && !S.colliders.grid) {
      const C = S.colliders, arr = it.man.r != null ? C.circles : C.boxes, i = arr.indexOf(it.man);
      if (!on && i >= 0) arr.splice(i, 1); else if (on && i < 0) arr.push(it.man);
    }
  }

  // back as it stood (out of view: a recycle, the mend at a distance, a reset)
  mend(it) {
    if (it.state === 'stand' && !it.dark) return;
    const i = this.out.indexOf(it);
    if (i >= 0) this.out.splice(i, 1);
    const j = this.dark.indexOf(it);
    if (j >= 0) this.dark.splice(j, 1);
    for (const s of it.slots) this.restore(s);
    if (it.inst >= 0) {
      const P = this.pools[it.kind];
      P.im.setMatrixAt(it.inst, ZERO); P.owner[it.inst] = null; P.free.push(it.inst); P.im.instanceMatrix.needsUpdate = true;
      it.inst = -1;
    }
    if (it.proxy) this.dropProxy(it);
    if (it.lie) this.dropLie(it);
    if (it.stump) { it.stump.parent && it.stump.parent.remove(it.stump); it.stump = null; }
    if (it.bulb) { it.bulb.visible = false; it.bulb = null; }
    if (it.geyser) { it.geyser.dead = true; it.geyser = null; }
    if (it.obj) {
      const h = it.home;
      if (h.parent && it.obj.parent !== h.parent) h.parent.add(it.obj);
      it.obj.position.copy(h.p); it.obj.quaternion.copy(h.q); it.obj.visible = true;
      it.obj.traverse((o) => { if (o.isMesh) { if (o.userData.sag0 != null) { o.scale.y = 1; o.rotation.x = o.userData.sag0; } if (this.stage.rays) { this.stage.rays.setEnabled(o, true); this.stage.rays.refresh(o); } } });
      it.obj.updateMatrixWorld(true);
    }
    if (it.lamp) {
      const L = this.stage.lamps, l = it.lamp;
      l.bent = false; l.dead = false; l.head.copy(l.head0 || l.head);
      // (its cone and its light let go: the next deal places them at its head again)
      if (l.cone) { l.cone.lamp = null; l.cone.mesh.visible = false; if (l.cone.entry) { l.cone.entry.enabled = false; l.cone.entry.intensity = 0; } l.cone = null; }
      if (L && L.pool) for (const sp of L.pool) if (sp.lamp === l) { sp.lamp = null; sp.k = 0; }
      if (L && L.setOn) L.setOn(l, true);
    }
    if (it.pane && this.stage.glass) this.stage.glass.restore(it.pane);
    it.state = 'stand'; it.dark = false; it.body = null; it.hits = 0; it.hp = it.K.hp ?? 3; it.flick = null; it.torn = 0; it.gone = false; it.glassGone = false; it.dumped = false;
    it.P.set(it.x, it.y0, it.z); it.Q.copy(it.q0);
    if (it.K.fp && !it.proxy && it.slots.some((s) => s.attr === 'position' && s.mesh.userData.noRay)) this.addProxy(it);
    this.colliders(it, true);
    this.stats.mended++;
  }
  mendAll() {
    for (const it of [...this.out, ...this.dark]) this.mend(it);
    for (const it of this.items) if (it.state !== 'stand' || it.torn || it.pane && it.pane.state !== 'whole') this.mend(it);
    this.pieces.clear();
    for (const g of this.geysers) g.dead = true;
    this.geysers.length = 0; this.jets.length = 0;
    this.events.push({ t: this.game ? +this.game.time.toFixed(3) : 0, kind: '*', what: 'mendAll', by: 'reset' });
  }

  // ---- the bullets' boxes of what is out ------------------------------------------------------------
  addProxy(it) {
    const S = this.stage, P = this.pools[it.kind];
    if (!S.rays || !P) return;
    const m = new THREE.Mesh(this.proxyGeo, this.proxyMat);
    m.visible = false;
    m.userData.prop = it;
    m.userData.surf = it.K.surf || SURF.IRON;
    m.scale.set(P.e.x * 2 * 0.95, P.e.y * 2 * 0.95, P.e.z * 2 * 0.95);
    this.group.add(m);
    it.proxy = m;
    this.syncProxy(it);
    S.addSolid(m);
    it.entry = S.rays.entries[S.rays.entries.length - 1];
    if (it.entry && it.entry.mesh !== m) it.entry = S.rays.entries.find((e) => e.mesh === m) || null;
  }
  dropProxy(it) {
    const S = this.stage;
    S.removeSolid(it.proxy);
    this.group.remove(it.proxy);
    it.proxy = null; it.entry = null;
  }
  syncProxy(it) {
    const m = it.proxy, P = this.pools[it.kind];
    if (!m) return;
    _c.copy(P.c).applyQuaternion(it.Q).add(it.P);
    m.position.copy(_c); m.quaternion.copy(it.Q);
    m.updateMatrixWorld(true);
    const e = it.entry;
    if (!e) return;
    e.mw.copy(m.matrixWorld); e.inv.copy(m.matrixWorld).invert(); e.inv3.setFromMatrix4(e.inv);
    const g = this.proxyGeo;
    if (!g.boundingBox) g.computeBoundingBox();
    _box.copy(g.boundingBox).applyMatrix4(m.matrixWorld);
    e.min.copy(_box.min); e.max.copy(_box.max);
  }

  // the item drawn where it is now (its instance, or its own object)
  draw(it) {
    if (it.obj) { it.obj.position.copy(it.P); it.obj.quaternion.copy(it.Q); if (it.obj.parent && it.obj.parent !== this.stage.scene) { /* a child: its parent's frame */ } it.obj.updateMatrixWorld(true); }
    else if (it.inst >= 0) {
      const P = this.pools[it.kind];
      _m.compose(it.P, it.Q, _one);
      P.im.setMatrixAt(it.inst, _m); P.im.instanceMatrix.needsUpdate = true;
    }
    if (it.proxy) this.syncProxy(it);
  }

  // ---- what meets it ------------------------------------------------------------------------------------
  // the one door in for every lane: a car, a round, a fist, a body, a blast
  hit(x, point = null, impulse = null, by = 'body') {
    const it = this.itemOf(x);
    if (!it) return null;
    const pt = point || _v.set(it.x, it.y0 + 0.6, it.z).clone();
    const imp = impulse || new THREE.Vector3(0, 0, 0);
    const sp = imp.length();
    const dir = sp > 1e-6 ? imp.clone().divideScalar(sp) : new THREE.Vector3(0, 0, -1);
    if (by === 'bullet') return this.shot(it, pt, dir, false);
    if (by === 'car') return this.carHit(it, null, sp, dir, pt);
    // a fist counts a third of a round's push; a body thrown into it, its speed; a blast, its push
    const v = by === 'fist' ? Math.max(1.2, sp * 0.4) : sp;
    if (v < (it.K.giveAt ?? 1) * (by === 'blast' ? 0.5 : 0.8)) { this.jolt(it, pt, dir, by); return 'hit'; }
    return this.carHit(it, null, v, dir, pt, by);
  }

  // a small knock that does not take it over: a sound, a shiver
  jolt(it, pt, dir, by) {
    const G0 = this.game;
    if (!G0) return;
    G0.sfx.play(it.K.knock || 'b9thunk', pt, { k: 0.5 }, { ref: 3 });
    this.log(it, 'jolt', by);
  }

  // a car (or a push as hard): it goes over by its kind (returns 'over' | 'break' | null)
  carHit(it, car, vn, dir = null, point = null, by = 'car') {
    if (it.state !== 'stand' && it.state !== 'rest') return null;
    const K = it.K, G0 = this.game;
    const d = dir ? dir.clone() : car ? new THREE.Vector3(car.vel.x, 0, car.vel.z).normalize() : new THREE.Vector3(1, 0, 0);
    d.y = 0; if (d.lengthSq() < 1e-6) d.set(1, 0, 0); d.normalize();
    const pt = point || new THREE.Vector3(it.x, it.y0 + 0.5, it.z);
    const cv = car ? new THREE.Vector3(car.vel.x, 0, car.vel.z) : d.clone().multiplyScalar(vn);
    let res = 'over';
    if (K.how === 'pane') { this.shatterPane(it, d, Math.min(2, vn / 5), pt); res = 'break'; }
    else if (K.how === 'tear') { this.tearDown(it, cv); }
    else if (it.state === 'rest') return null;
    else if (K.how === 'lean') this.lean(it, d, vn);
    else if (K.how === 'shear') this.shear(it, cv, vn);
    else if (K.how === 'break' && (vn > 2.5 || by !== 'car')) { this.breakUp(it, cv, pt); res = 'break'; }
    else this.tumble(it, cv, vn, pt);
    if (G0) {
      G0.sfx.play(K.sound, pt, { k: Math.min(1, vn / 14) }, { ref: 4 });
      if (K.goods) this.spillGoods(it, cv);
      if (K.papers) this.papers(it, cv, 46);
      G0.emit('smash', { kind: it.kind, pos: pt.clone(), by, how: res, item: it, speed: vn });
    }
    this.stats[res === 'break' ? 'broken' : 'over']++;
    this.log(it, res, by);
    return res;
  }

  log(it, what, by) {
    const G0 = this.game;
    if (this.events.length < 400) this.events.push({ t: G0 ? +G0.time.toFixed(3) : 0, at: performance.now(), kind: it.kind, what, by, id: it.id });
  }

  // ---- how each goes ---------------------------------------------------------------------------------
  // a post: it leans from its base, bends and stops; hard enough, it goes
  // down flat (a lamp flickers and dies either way)
  lean(it, d, vn) {
    if (!this.detach(it)) return;
    const K = it.K;
    const fall = vn > K.fallAt;
    // (a little scatter in the way it goes: never a ruler's lean)
    const a = Math.atan2(d.z, d.x) + this.gauss() * 0.18;
    const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const axis = new THREE.Vector3().crossVectors(UP, dir).normalize();
    const target = fall ? Math.PI / 2 - (K.restLean ?? 0.05) : Math.min(1.05, 0.22 + (vn - K.giveAt) * 0.075 + this.rnd(0, 0.08));
    it.body = { lean: true, axis, ang: 0, w: Math.min(4.5, 0.6 + vn * 0.16), target, fall, dir, bounced: 0 };
    if (it.K.lamp) this.lampHit(it, fall);
    this.sparksAt(new THREE.Vector3(it.x, it.y0 + 0.4, it.z), dir, 0.8);
  }

  // a hydrant off its stem: the head flies, a column of water stands where it was
  shear(it, cv, vn) {
    if (!this.detach(it)) return;
    const P = this.pools[it.kind];
    this.makeBody(it, cv.clone().multiplyScalar(this.rnd(0.55, 0.85)).add(new THREE.Vector3(this.gauss() * 0.6, this.rnd(3, 5.5), this.gauss() * 0.6)), vn * 0.5);
    it.body.p.y += 0.12;
    void P;
    // the stump
    const s = new THREE.Mesh(this.stumpGeo, this.mats.kerb);
    s.position.set(it.x, it.y0, it.z);
    s.userData.inkId = this.idOf('stump'); s.userData.noRay = true;
    this.group.add(s);
    it.stump = s;
    this.geyser(it);
  }

  // a whole thing knocked over: a rigid body with the car's way in it
  tumble(it, cv, vn, pt) {
    if (!this.detach(it)) return;
    const K = it.K;
    const k = K.carry ?? 0.9;
    const v = cv.clone().multiplyScalar(k * this.rnd(0.85, 1.1));
    v.y = Math.min(4.5, (K.lift ?? 1.2) + vn * 0.12 * this.rnd(0.6, 1.2));
    v.x += this.gauss() * 0.4; v.z += this.gauss() * 0.4;
    this.makeBody(it, v, vn, pt);
  }

  // a crate: to planks and its fruit (it is gone: what lies are its pieces)
  breakUp(it, cv, pt) {
    if (!this.detach(it)) return;
    it.state = 'rest';
    it.gone = true;
    if (it.inst >= 0) { const P = this.pools[it.kind]; P.im.setMatrixAt(it.inst, ZERO); P.im.instanceMatrix.needsUpdate = true; }
    if (it.proxy) this.dropProxy(it);
    const PC = this.pieces, n = 7 + Math.floor(this.rnd(0, 4));
    const q = it.q0;
    for (let k = 0; k < n; k++) {
      const o = _v.set(this.gauss() * 0.2, 0.34 * this.rnd(0.1, 0.9), this.gauss() * 0.15).applyQuaternion(q).add(it.P).clone();
      const long = this.rnd() < 0.6;
      PC.spawn('plank', o, this.randQ(), _w.set(long ? 0.62 : 0.4, 0.018, long ? 0.075 : 0.045), this.flung(cv), this.spin(), { r: 0.04 });
    }
    if (it.K.fruit !== false) for (let k = 0; k < 9; k++) {
      const o = _v.set(this.gauss() * 0.2, 0.36, this.gauss() * 0.14).applyQuaternion(q).add(it.P).clone();
      const r = this.rnd(0.05, 0.07);
      PC.spawn('fruit', o, this.randQ(), _w.set(r, r, r), this.flung(cv, 1.4, 1.1), this.spin(0.5), { r, bounce: 0.45, roll: true });
    }
    this.dust(pt || it.P, 0.6);
  }

  // an awning torn down (a lorry's roof, the tram, or shot through): the
  // canvas falls off its frame, its water sheets down
  tearDown(it, cv) {
    if (it.state !== 'stand') return;
    const o = it.obj, G0 = this.game;
    this.dump(it);
    this.detach(it);
    // (it swings down off the wall from its hinge and drops: a rigid body)
    this.makeBody(it, (cv || new THREE.Vector3()).clone().multiplyScalar(0.5).add(new THREE.Vector3(0, 0.5, 0)), 4);
    it.body.w.add(_v.set(it.opts.wall ? -it.opts.wall.nz : 0, 0, it.opts.wall ? it.opts.wall.nx : 1).multiplyScalar(this.rnd(-2, 2)));
    void o; void G0;
  }

  // ---- what a round does (each kind its own answer) ----------------------------------------------------------
  shot(it, point, dir, weak) {
    const K = it.K, G0 = this.game;
    if (!G0) return null;
    it.hits++;
    this.stats.shot++;
    this.log(it, 'shot', 'bullet');
    const p = point.clone();
    switch (K.shot) {
      case 'lamp': {
        // the head (shade, glass): it goes out; the post sparks
        const L = it.lamp || this.lampOf(it);
        const head = L ? L.head : null;
        if (head && p.distanceTo(head) < 0.75 && !it.dark && !(it.flick && it.flick.dying)) { if (!weak) this.shootLamp(it, dir); return 'done'; }
        this.sparksAt(p, dir, 0.5);
        if (it.state === 'live' && it.body && it.body.lean && !it.body.fall) it.body.w += 0.25;
        return null;
      }
      case 'leak': {
        // a hydrant: a fan of water out of the hole (the head off: nothing)
        if (it.state === 'stand' && !weak) this.jet(p, _v.copy(dir).negate().setY(0.2).normalize().clone(), 'water', 10);
        G0.sfx.play('clang', p, { k: 0.6 }, { ref: 3 });
        return null;
      }
      case 'knock': {
        // light things: the round knocks them over (a bin, a sign, a crate)
        if (it.state === 'stand') {
          if (K.how === 'break' && it.hits >= (K.hp ?? 2)) { this.carHit(it, null, 4, dir, p, 'bullet'); return null; }
          if (K.how !== 'break' && (it.hits >= (K.hp ?? 1) || K.how === 'tumble')) { this.carHit(it, null, K.giveAt + 1.2, dir, p, 'bullet'); return null; }
          if (K.how === 'lean' && it.hits >= (K.hp ?? 3)) { this.carHit(it, null, K.giveAt + 1, dir, p, 'bullet'); return null; }
        } else if (it.body && !it.body.lean) { this.kickBody(it, _v.copy(dir).multiplyScalar(2.5).setY(1.6), p); }
        G0.sfx.play(K.knock || 'clang', p, { k: 0.5 }, { ref: 3 });
        this.chipsAt(p, dir, K.surf === SURF.STONE ? 0.16 : 0.08, 6);
        return null;
      }
      case 'goods': {
        // a stall: its goods jump and burst; enough and it goes over
        this.goodsBurst(it, p, dir);
        if (it.state === 'stand' && it.hits >= (K.hp ?? 6)) this.carHit(it, null, K.giveAt + 0.8, dir, p, 'bullet');
        return null;
      }
      case 'papers': {
        this.papers(it, dir.clone().multiplyScalar(1.5), 6, p);
        if (it.state === 'stand' && it.hits >= (K.hp ?? 8)) this.carHit(it, null, K.giveAt + 0.6, dir, p, 'bullet');
        return null;
      }
      case 'wood': {
        // a bench, a fence, a pole: splinters; a fence panel goes down at the third
        this.chipsAt(p, dir, 0.1, 9);
        G0.sfx.play('c2_woodHit', p, { k: 0.7 }, { ref: 3 });
        if (it.state === 'stand' && K.hp && it.hits >= K.hp) this.carHit(it, null, K.giveAt + 1, dir, p, 'bullet');
        else if (it.body && !it.body.lean) this.kickBody(it, _v.copy(dir).multiplyScalar(1.2).setY(0.6), p);
        return null;
      }
      case 'box': {
        // the call box: its glass breaks at the first, then it sparks
        if (!it.glassGone) { it.glassGone = true; this.glassBits(p, dir, 12); G0.sfx.glass(p, 0.5); return 'done'; }
        this.sparksAt(p, dir, 0.6);
        if (it.state === 'stand' && it.hits >= (K.hp ?? 6)) this.carHit(it, null, K.giveAt + 0.5, dir, p, 'bullet');
        return null;
      }
      case 'tear': {
        // an awning: torn, its water dumped; the third drops it
        if (it.state !== 'stand') return null;
        it.torn = (it.torn || 0) + 1;
        if (it.torn === 1) this.dump(it);
        if (it.obj) it.obj.traverse((o) => { if (o.isMesh) { if (o.userData.sag0 == null) o.userData.sag0 = o.rotation.x; o.rotation.x = o.userData.sag0 + 0.08 * it.torn; } });
        G0.sfx.play('awning_tear', p, { k: 0.8 }, { ref: 3 });
        if (it.torn >= (K.hp ?? 3)) this.tearDown(it, dir.clone().multiplyScalar(2));
        return null;
      }
      case 'pane': return null;    // (the pane's own: Glass)
      default:
        this.sparksAt(p, dir, 0.5);
        return null;
    }
  }

  // ---- the lamps ----------------------------------------------------------------------------------------------
  lampOf(it) {
    if (it.lamp) return it.lamp;
    const L = this.stage.lamps;
    if (!L || !L.all) return null;
    if (!this._lampMap) { this._lampMap = new Map(); for (const l of L.all) if (l.src) this._lampMap.set(l.src, l); }
    it.lamp = this._lampMap.get(it.rec) || null;
    if (it.lamp && !it.lamp.head0) it.lamp.head0 = it.lamp.head.clone();
    return it.lamp;
  }
  // struck by a car: it flickers and dies (a hard blow: dies at once as it goes down)
  lampHit(it, fall) {
    const L = this.lampOf(it);
    if (!L) return;
    L.bent = true;
    this.bulbLevel(it, 0);
    it.flick = { t: 0, dur: fall ? this.rnd(0.35, 0.6) : this.rnd(0.9, 1.6), seed: this.rnd(0, 100), on: true };
    // its own lit mouth while it flickers (a few at once: the oldest goes dark)
    let b = this.bulbs.find((x) => !x.visible);
    if (!b && this.bulbs.length < 4) { b = new THREE.Mesh(this.bulbGeo, this.bulbMat); b.userData.inkId = this.idOf('bulb'); b.userData.noRay = true; this.group.add(b); this.bulbs.push(b); }
    if (b) { b.visible = true; it.bulb = b; }
  }
  // a round in its head: glass, sparks, the pop; a buzz back on, then dark
  shootLamp(it, dir) {
    const L = this.lampOf(it), G0 = this.game;
    if (!L || !G0) return;
    const p = L.head;
    for (let k = 0; k < 18; k++) {
      const s = this.rnd(0.025, 0.07);
      G0.fx.debris.spawn({ pos: p.clone().add(_v.set(this.gauss() * 0.15, -0.05, this.gauss() * 0.15)), vel: new THREE.Vector3(this.gauss() * 1.2 + dir.x * 0.8, this.rnd(-0.5, 1.2), this.gauss() * 1.2 + dir.z * 0.8),
        life: this.rnd(0.9, 1.6), size: [s, s * 0.6], rot: this.rnd(0, 6.28), spin: this.gauss() * 12, col: [0.4, 0.4, 0.4], cell: FIRE.SHARD, gravity: 9.8, ground: this.stage.surfaceY(p.x, p.z) + 0.02, fadeOut: 0.15, lit: 3, litT: 0.15 });
    }
    for (let k = 0; k < 26; k++) {
      const v = new THREE.Vector3(this.gauss(), this.rnd(-1.2, 0.6), this.gauss()).normalize().multiplyScalar(this.rnd(2, 6));
      G0.fx.sparks.spawn({ pos: p.clone(), vel: v, life: this.rnd(0.25, 0.8), size: [0.01, 0.016], stretch: 0.04, col: [6, 6, 6], cell: ATLAS.DROP, gravity: 9.8, ground: this.stage.surfaceY(p.x, p.z) + 0.02, fadeOut: 0.4 });
    }
    G0.sfx.glass(p, 0.8);
    G0.sfx.zap(p);
    it.dark = true;
    this.dark.push(it);
    // (a buzz back on for a moment, more often than not, then dark for good)
    it.flick = { t: 0, dur: this.rnd() < 0.6 ? this.rnd(0.5, 1.1) : 0.05, seed: this.rnd(0, 100), on: true, shot: true, dying: true };
    this.bulbLevel(it, 0);
    L.dead = true;
    if (G0.counters) G0.counters.lampsOut = (G0.counters.lampsOut || 0) + 1;
  }
  lampStep(it, dt) {
    const F = it.flick, L = it.lamp, S = this.stage.lamps;
    if (!F || !L) return;
    F.t += dt;
    const t = F.t + F.seed;
    let on;
    if (F.shot) on = F.t > 0.18 && F.t < F.dur && Math.sin(t * 91) * Math.sin(t * 37 + 1.3) > -0.1;
    else on = F.t < 0.12 || (F.t < F.dur && Math.sin(t * 47) + Math.sin(t * 23 + 2.1) > 0.15);
    if (on !== F.on) {
      F.on = on;
      L.dead = !on;
      if (F.shot) this.bulbLevel(it, on ? 0.6 : 0);
      if (on && F.shot && !F.buzzed) { F.buzzed = true; if (this.game) this.game.sfx.buzz(L.head, F.dur); }
    }
    if (it.bulb) it.bulb.visible = on;
    if (F.t >= F.dur) {
      L.dead = true;
      if (S && S.setOn) S.setOn(L, false);
      if (it.bulb) { it.bulb.visible = false; it.bulb = null; }
      if (F.shot) this.bulbLevel(it, 0);
      it.flick = null;
      if (this.game && !F.shot) this.game.sfx.play('zap', L.head, {}, { ref: 4 });
    }
  }
  // the head of a leaning lamp: its cone, its light and its mouth go with it
  lampFollow(it) {
    const L = it.lamp;
    if (!L) return;
    _v.set(1.46, 5.64, 0).applyQuaternion(it.Q).add(it.P);
    L.head.copy(_v);
    const ax = _a.set(Math.cos(it.yaw) * 0.18, -1, -Math.sin(it.yaw) * 0.18).normalize().applyQuaternion(_q.copy(it.Q).multiply(_q2.copy(it.q0).invert()));
    if (L.cone && L.cone.mesh) {
      const M = L.cone.mesh;
      M.position.copy(L.head);
      M.quaternion.setFromUnitVectors(_n.set(0, -1, 0), ax);
      M.material.uniforms.uApex.value.copy(L.head);
      M.material.uniforms.uAxis.value.copy(ax);
      if (L.cone.entry) { L.cone.entry.position.copy(L.head); L.cone.entry.direction.copy(ax); }
    }
    const S = this.stage.lamps;
    if (S && S.pool) for (const s of S.pool) if (s.lamp === L) { s.spot.position.copy(L.head); s.spot.target.position.copy(L.head).addScaledVector(ax, 6); s.spot.target.updateMatrixWorld(); }
    if (it.bulb) { it.bulb.position.copy(_v.set(1.46, 5.96 - 0.3, 0).applyQuaternion(it.Q).add(it.P)); it.bulb.quaternion.copy(it.Q); }
  }

  // ---- the rigid body (a tumble, a slide, a roll) ---------------------------------------------------------------------
  makeBody(it, v, vn = 0, pt = null) {
    const P = this.pools[it.kind];
    const e = it.obj ? (it.opts.e ? new THREE.Vector3(...it.opts.e) : new THREE.Vector3(0.5, 0.3, 0.5)) : P.e.clone();
    const c = it.obj ? (it.opts.c ? new THREE.Vector3(...it.opts.c) : new THREE.Vector3(0, e.y, 0)) : P.c.clone();
    const p = c.clone().applyQuaternion(it.Q).add(it.P);
    const b = { p, v: v.clone(), w: new THREE.Vector3(), e, c, touch: false, restT: 0, roll: null };
    // the turn the blow gives: about the axis across the way it was hit, by how high
    const h = pt ? Math.max(0.1, pt.y - it.y0) : e.y;
    _a.set(v.x, 0, v.z);
    const sp = _a.length();
    if (sp > 1e-3) { _a.divideScalar(sp); b.w.crossVectors(UP, _a).multiplyScalar(Math.min(9, (sp * 0.9 + vn * 0.2) * Math.min(1.4, h / Math.max(0.2, e.y * 2)) / Math.max(0.3, e.y * 2))); }
    b.w.x += this.gauss() * 1.2; b.w.y += this.gauss() * 1.6; b.w.z += this.gauss() * 1.2;
    it.body = b;
    it.state = 'live'; it.t = 0;
    if (it.lie) this.dropLie(it);
  }
  kickBody(it, v, pt) {
    if (it.state === 'rest' && it.body && !it.body.lean) { it.state = 'live'; it.body.restT = 0; it.body.roll = null; if (it.lie) this.dropLie(it); }
    if (!it.body || it.body.lean) return;
    it.body.v.add(v);
    if (pt) { _r.subVectors(pt, it.body.p); it.body.w.add(_a.crossVectors(_r, v).multiplyScalar(1.5)); }
  }

  stepBody(it, dt) {
    const b = it.body, S = this.stage;
    if (b.roll) return this.stepRoll(it, dt);
    const n = Math.min(4, Math.max(1, Math.ceil((b.v.length() + b.w.length() * b.e.length()) * dt / 0.05)));
    const h = dt / n;
    for (let s = 0; s < n; s++) {
      b.v.y -= G * h;
      b.p.addScaledVector(b.v, h);
      const wl = b.w.length();
      if (wl > 1e-6) { _q.setFromAxisAngle(_a.copy(b.w).divideScalar(wl), wl * h); it.Q.premultiply(_q).normalize(); }
      // the ground under its corners: every corner below it pushes back
      // (impulses shared among the corners touching: a face meets the stones flat)
      let deep = 0, nc = 0;
      b.touch = false;
      const e = b.e;
      // (inverse inertia of a box of mass 1: 3 / (e2^2 + e3^2) about each local axis)
      const ix = 3 / (e.y * e.y + e.z * e.z), iy = 3 / (e.x * e.x + e.z * e.z), iz = 3 / (e.x * e.x + e.y * e.y);
      for (const [sx, sy, sz] of CORNERS) {
        const r = _rs[nc];
        r.set(sx * e.x, sy * e.y, sz * e.z).applyQuaternion(it.Q);
        const pen = S.surfaceY(b.p.x + r.x, b.p.z + r.z) - (b.p.y + r.y);
        if (pen <= 0) continue;
        if (pen > deep) deep = pen;
        nc++;
      }
      if (nc) b.touch = true;
      for (let k = 0; k < nc; k++) {
        const r = _rs[k];
        _v.crossVectors(b.w, r).add(b.v);
        if (_v.y >= 0) continue;
        const Iw = this.invI(it.Q, _n.crossVectors(r, UP), ix, iy, iz, _w);
        const den = 1 + _c.crossVectors(Iw, r).y;
        const j = -(1 + (it.K.bounce ?? 0.15)) * _v.y / den / nc;
        b.v.y += j;
        b.w.addScaledVector(Iw, j);
        // friction: the ground scrubs the corner's slide
        _v.crossVectors(b.w, r).add(b.v);
        const vt = Math.hypot(_v.x, _v.z);
        if (vt > 1e-4) {
          _d.set(-_v.x / vt, 0, -_v.z / vt);
          const It = this.invI(it.Q, _n.crossVectors(r, _d), ix, iy, iz, _a);
          const dent = 1 + _c.crossVectors(It, r).dot(_d);
          const jt = Math.min(vt / dent / nc, (it.K.mu ?? 0.5) * j);
          b.v.addScaledVector(_d, jt);
          b.w.addScaledVector(It, jt);
        }
      }
      if (deep > 0) b.p.y += deep;
      if (b.touch) { const k = Math.exp(-(it.K.scrub ?? 2.2) * h); b.v.x *= k; b.v.z *= k; b.w.multiplyScalar(Math.exp(-1.2 * h)); }
      // walls stop it (a box in the colliders' world: a building's, a fence's)
      if (Math.abs(b.v.x) + Math.abs(b.v.z) > 0.05 && S.colliders.resolve) {
        const rr = Math.min(b.e.x, b.e.z, 0.45);
        _c.set(b.p.x, 0, b.p.z);
        S.colliders.resolve(_c, rr, it.man, false);
        if (Math.abs(_c.x - b.p.x) + Math.abs(_c.z - b.p.z) > 1e-4) {
          const nx = _c.x - b.p.x, nz = _c.z - b.p.z, l = Math.hypot(nx, nz);
          b.p.x = _c.x; b.p.z = _c.z;
          const vn = (b.v.x * nx + b.v.z * nz) / l;
          if (vn < 0) { b.v.x -= 1.4 * vn * nx / l; b.v.z -= 1.4 * vn * nz / l; }
        }
      }
    }
    it.P.copy(b.c).applyQuaternion(it.Q).negate().add(b.p);
    // at rest: on its broadest face, still
    // (still on the ground: no slide, no turn - its vertical speed is the step's own gravity and the push back)
    if (b.touch && b.v.x * b.v.x + b.v.z * b.v.z < 0.03 && Math.abs(b.v.y) < 0.7 && b.w.lengthSq() < 0.35) b.restT += dt; else b.restT = 0;
    if (b.restT > 0.25 || it.t > 12) {
      // (a round thing on its side rolls on, slowing)
      if (it.K.roll && !b.rolled && this.onSide(it) && Math.hypot(b.v.x, b.v.z) > 0.25) return this.startRoll(it);
      this.settle(it);
    }
  }
  // the inverse inertia (box, mass 1) applied to a world vector
  invI(Q, x, ix, iy, iz, out) {
    _q2.copy(Q).invert();
    out.copy(x).applyQuaternion(_q2);
    out.set(out.x * ix, out.y * iy, out.z * iz).applyQuaternion(Q);
    return out;
  }
  onSide(it) { _v.set(0, 1, 0).applyQuaternion(it.Q); return Math.abs(_v.y) < 0.5; }
  startRoll(it) {
    const b = it.body;
    _v.set(0, 1, 0).applyQuaternion(it.Q).setY(0).normalize();     // its axis, lying
    const d = new THREE.Vector3(-_v.z, 0, _v.x);
    const sp = b.v.x * d.x + b.v.z * d.z;
    b.roll = { axis: _v.clone(), dir: d.multiplyScalar(Math.sign(sp) || 1), sp: Math.min(5, Math.abs(sp) + 0.6), r: Math.max(b.e.x, b.e.z) };
    b.rolled = true;
  }
  stepRoll(it, dt) {
    const b = it.body, R = b.roll;
    R.sp = Math.max(0, R.sp - dt * 0.9);
    b.p.addScaledVector(R.dir, R.sp * dt);
    _q.setFromAxisAngle(_a.crossVectors(UP, R.dir).normalize(), R.sp / R.r * dt);
    it.Q.premultiply(_q).normalize();
    // (a wall turns it back)
    const S = this.stage;
    _c.set(b.p.x, 0, b.p.z);
    S.colliders.resolve(_c, R.r * 0.8, it.man, false);
    if (Math.abs(_c.x - b.p.x) + Math.abs(_c.z - b.p.z) > 1e-4) { b.p.x = _c.x; b.p.z = _c.z; R.dir.negate(); R.sp *= 0.4; }
    b.p.y = S.surfaceY(b.p.x, b.p.z) + R.r;
    it.P.copy(b.c).applyQuaternion(it.Q).negate().add(b.p);
    if (R.sp <= 0.02) { b.roll = null; this.settle(it); }
  }
  // lying still: flat on the face nearest the ground, its lowest point on it;
  // a man's box where it lies (a big thing stops him), the bullets' box there
  settle(it) {
    const b = it.body;
    if (!b.lean && !it.K.roll) {
      const ax = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)].map((a) => a.applyQuaternion(it.Q));
      let best = 0;
      for (let i = 1; i < 3; i++) if (Math.abs(ax[i].y) > Math.abs(ax[best].y)) best = i;
      it.Q.premultiply(_q.setFromUnitVectors(ax[best].clone(), _v.set(0, Math.sign(ax[best].y) || 1, 0)));
      b.vert = best;
    }
    if (!b.lean) {
      // (its lowest corner on the ground)
      let low = Infinity;
      for (const [sx, sy, sz] of CORNERS) { _r.set(sx * b.e.x, sy * b.e.y, sz * b.e.z).applyQuaternion(it.Q); const y = b.p.y + _r.y - this.stage.surfaceY(b.p.x + _r.x, b.p.z + _r.z); if (y < low) low = y; }
      if (Number.isFinite(low)) b.p.y -= low - 0.003;
      it.P.copy(b.c).applyQuaternion(it.Q).negate().add(b.p);
      b.v.set(0, 0, 0); b.w.set(0, 0, 0);
    }
    it.state = 'rest';
    this.draw(it);
    if (it.K.lie && !it.lie && !b.lean) this.addLie(it);
  }
  // a man's box where it lies (only what is big enough to stop him)
  addLie(it) {
    const b = it.body, C = this.stage.colliders;
    const ax = [0, 1, 2].filter((i) => i !== (b.vert ?? 1));
    const E = [b.e.x, b.e.y, b.e.z];
    _v.set(ax[0] === 0 ? 1 : 0, ax[0] === 1 ? 1 : 0, ax[0] === 2 ? 1 : 0).applyQuaternion(it.Q);
    const ang = Math.atan2(-_v.z, _v.x);
    it.lie = C.addBox(b.p.x, b.p.z, E[ax[0]] * 0.9, E[ax[1]] * 0.9, ang, 'smash');
  }
  dropLie(it) {
    const C = this.stage.colliders;
    if (C.remove) C.remove(it.lie); else { const k = C.boxes.indexOf(it.lie); if (k >= 0) C.boxes.splice(k, 1); }
    it.lie = null;
  }

  // a post's hinge at its base: it leans to its angle and stops (a bend),
  // or goes all the way down and lies there (a fall, a bounce)
  stepLean(it, dt) {
    const b = it.body, K = it.K;
    if (b.fall) {
      b.w += 1.5 * G / K.h * Math.sin(b.ang + 0.05) * dt;
      b.ang += b.w * dt;
      if (b.ang >= b.target) {
        b.ang = b.target;
        if (b.w > 0.8 && b.bounced < 2) { b.w *= -0.22; b.bounced++; if (b.bounced === 1) this.postDown(it); }
        else { b.w = 0; this.settleLean(it); }
      }
    } else {
      // (a spring to its bent angle: it whips over and stops, a little back)
      b.w += ((b.target - b.ang) * 38 - b.w * 7.5) * dt;
      b.ang += b.w * dt;
      if (Math.abs(b.w) < 0.02 && Math.abs(b.target - b.ang) < 0.004 && it.t > 0.4) this.settleLean(it);
    }
    it.Q.setFromAxisAngle(b.axis, b.ang).multiply(it.q0);
  }
  settleLean(it) {
    it.state = 'rest';
    // (leaning, its base still stops a man; down flat it lies under his feet)
    if (!it.body.fall && it.man) it.man.gone = false;
  }
  // a post down on the road: sparks where its head meets the stones, a ring on the wet
  postDown(it) {
    const G0 = this.game;
    if (!G0) return;
    _v.set(it.K.lamp ? 1.46 : 0, it.K.h * 0.95, 0).applyQuaternion(it.Q).add(it.P);
    this.sparksAt(_v.clone(), UP, 1.2);
    if (this.stage.street && this.stage.street.addImpact) this.stage.street.addImpact(this.stage, _v.x, _v.z, 0.9);
    G0.sfx.play('crash', _v, { k: 0.6 }, { ref: 5 });
    if (G0.controller && G0.controller.shake) G0.controller.shake(0.25, _v.distanceTo(G0.camera.position));
  }

  // ---- a car against what stands and what lies (Car.collide calls this every step) ---------------------------
  // round standing things are the track's circles (Car.vsCircle's give);
  // boxes, what lies and what flies are met here. Returns what the car pays
  // for: [{ drag, dmg, pos, kind, item }]
  collide(car, out = this._hits) {
    out.length = 0;
    const S = car.spec, cx = car.pos.x, cz = car.pos.z;
    const sp = car.speedAbs;
    const list = this.near(cx, cz, S.halfL + 2.5);
    const c = Math.cos(car.yaw), s = Math.sin(car.yaw);
    const top = (car.groundY || 0) + (S.top ?? (car.kind === 'truck' || car.kind === 'tram' ? 3.3 : 1.75));
    let n = 0;
    for (const it of list) {
      if (it.gone || it.state !== 'stand' && it.body && it.body.lean) continue;
      const K = it.K;
      if (K.high) {
        // an awning: only what is tall reaches it
        if (it.state !== 'stand' || top < it.y0 + (K.low ?? 2.5)) continue;
        if (!this.boxOverlap(car, it.x, it.z, it.fp.hx, it.fp.hz, it.yaw)) continue;
        this.carHit(it, car, sp);
        continue;
      }
      if (K.pane) {
        if (it.state !== 'stand' || !it.pane || it.pane.state === 'gone') continue;
        if (!this.boxOverlap(car, it.x, it.z, it.fp.hx + 0.25, it.fp.hz + 0.35, it.yaw)) continue;
        this.carHit(it, car, Math.max(3, sp));
        continue;
      }
      if (it.state === 'stand') {
        if (K.round || !it.fp) continue;
        if (!this.boxOverlap(car, it.x, it.z, it.fp.hx, it.fp.hz, it.yaw)) continue;
        // the speed into it: the car's velocity toward its middle
        _d.set(it.x - cx, 0, it.z - cz);
        const dl = _d.length() || 1;
        const vn = Math.max(sp * 0.35, (car.vel.x * _d.x + car.vel.z * _d.z) / dl);
        if (vn > K.giveAt) {
          const res = this.carHit(it, car, vn);
          if (res && n < this._hitPool.length) { const h = this._hitPool[n++]; h.drag = K.drag; h.dmg = K.hurt * Math.min(1.4, Math.max(0.3, vn / 12)); h.pos.set(it.x, 0.6, it.z); h.kind = it.kind; h.item = it; out.push(h); }
        } else {
          // (slower than it gives: it is a solid thing)
          const B = this._box || (this._box = {});
          B.cx = it.x; B.cz = it.z; B.hx = it.fp.hx; B.hz = it.fp.hz; B.c = Math.cos(it.yaw); B.s = Math.sin(it.yaw); B.tag = it.kind;
          car.vsBox(B, null);
        }
        continue;
      }
      // out of the merge: flying or lying - kicked on (light), a bump (heavy)
      const b = it.body;
      if (!b || sp < 1.0) continue;
      const bx = b.p.x, bz = b.p.z;
      if (b.p.y - (car.groundY || 0) > 1.9) continue;
      const rr = Math.min(b.e.x, b.e.z, 0.6);
      _v.set(bx, car.pos.y, bz);
      if (!car.overlaps(_v, rr, -1, 2.5)) continue;
      if ((it.bumpT || 0) > 0) continue;
      it.bumpT = 0.5;
      const lx = (bx - cx) * c - (bz - cz) * s;
      const ahead = lx > S.halfL - 0.9;
      if (K.light) {
        _w.set(car.vel.x * this.rnd(0.9, 1.25), this.rnd(1, 2.6) * Math.min(1, sp / 10), car.vel.z * this.rnd(0.9, 1.25));
        if (!ahead) { const side = ((bx - cx) * s + (bz - cz) * c) >= 0 ? 1 : -1; _w.x += s * side * 3; _w.z += c * side * 3; }
        this.kickBody(it, _w, null);
        G0play(this.game, K.knock || 'city_bin', b.p, Math.min(1, sp / 12));
        if (n < this._hitPool.length) { const h = this._hitPool[n++]; h.drag = 0.985; h.dmg = 0; h.pos.copy(b.p); h.kind = it.kind; h.item = it; out.push(h); }
      } else {
        // a heavy thing lying in the road: a bump through the wheels, it is shoved
        car.heaveV = (car.heaveV || 0) + 0.9 * Math.min(1, sp / 12);
        this.kickBody(it, _w.set(car.vel.x * 0.35, 0.4, car.vel.z * 0.35), null);
        G0play(this.game, K.knock || 'b9thunk', b.p, Math.min(1, sp / 12));
        if (n < this._hitPool.length) { const h = this._hitPool[n++]; h.drag = K.lieDrag ?? 0.93; h.dmg = 0.01; h.pos.copy(b.p); h.kind = it.kind; h.item = it; out.push(h); }
      }
    }
    // a post down across the road: a bump (heavy, low: driven over)
    for (const it of list) {
      if (!(it.body && it.body.lean && it.body.fall && it.state === 'rest') || sp < 2) continue;
      if ((it.bumpT || 0) > 0) continue;
      // (the post's line: from its base along its fall)
      const L = it.K.h * 0.95, d = it.body.dir;
      const lx0 = it.x - cx, lz0 = it.z - cz;
      let hit = false;
      for (let u = 0.6; u <= L; u += 0.8) { _v.set(it.x + d.x * u, car.pos.y, it.z + d.z * u); if (car.overlaps(_v, 0.15, -1, 1)) { hit = true; break; } }
      void lx0; void lz0;
      if (!hit) continue;
      it.bumpT = 0.7;
      car.heaveV = (car.heaveV || 0) + 1.3 * Math.min(1, sp / 10);
      car.shake = Math.min(1, (car.shake || 0) + 0.4);
      G0play(this.game, 'b9thunk', _v, 0.8);
      if (n < this._hitPool.length) { const h = this._hitPool[n++]; h.drag = 0.95; h.dmg = 0.02; h.pos.copy(_v); h.kind = it.kind; h.item = it; out.push(h); }
    }
    return out;
  }
  // the car's box against a footprint (separating axes in the plane)
  boxOverlap(car, x, z, hx, hz, yaw) {
    const S = car.spec, ca = Math.cos(car.yaw), sa = Math.sin(car.yaw), cb = Math.cos(yaw), sb = Math.sin(yaw);
    const axes = [[ca, -sa], [sa, ca], [cb, -sb], [sb, cb]];
    const dx = x - car.pos.x, dz = z - car.pos.z;
    for (const [ax, az] of axes) {
      const ra = S.halfL * Math.abs(ca * ax - sa * az) + S.halfW * Math.abs(sa * ax + ca * az);
      const rb = hx * Math.abs(cb * ax - sb * az) + hz * Math.abs(sb * ax + cb * az);
      if (Math.abs(dx * ax + dz * az) > ra + rb) return false;
    }
    return true;
  }
  kickPieces(car) { return this.pieces.kick(car); }
  guardBody(car) { return this.pieces.guard(car); }

  // a blast: what stands within r goes over away from it, what lies is thrown
  blast(at, r = 6, power = 1) {
    const list = [...this.near(at.x, at.z, r)];
    for (const it of list) {
      const d = Math.hypot(it.x - at.x, it.z - at.z);
      if (d > r) continue;
      const k = (1 - d / r) * power;
      _d.set(it.x - at.x, 0, it.z - at.z).normalize();
      if (it.state === 'stand' && !it.K.pane) this.carHit(it, null, (it.K.giveAt ?? 2) + 1 + 10 * k, _d.clone(), null, 'blast');
      else if (it.K.pane && it.state === 'stand') this.shatterPane(it, _d.clone(), 1.5, at);
      else if (it.body && !it.body.lean) this.kickBody(it, _d.clone().multiplyScalar(6 * k).setY(3 * k), null);
    }
    // the pieces lying near are thrown too
    for (const P of Object.values(this.pieces.pools)) for (let i = 0; i < P.used; i++) {
      const p = P.owner[i];
      if (!p || p.dead) continue;
      const d = Math.hypot(p.pos.x - at.x, p.pos.z - at.z);
      if (d > r) continue;
      const k = (1 - d / r) * power;
      p.vel.set((p.pos.x - at.x) / (d + 0.1) * 7 * k, 3 + 4 * k, (p.pos.z - at.z) / (d + 0.1) * 7 * k);
      if (p.rest) { p.rest = false; this.pieces.n--; this.pieces.live.push(p); }
    }
  }

  // ---- the shop glass (destruct/Glass.js panes) ---------------------------------------------------------------------
  // a pane registered as an item (opts: { pane }): rounds go to Glass (its
  // own); a car into the front, or a blast, bursts it
  shatterPane(it, dir, power = 1, at = null) {
    const Gl = this.stage.glass;
    if (!it.pane || !Gl || it.pane.state === 'gone') return;
    Gl.shatter(it.pane, { dir, power, at: at || null, by: 'body' });
    it.state = 'rest';
    if (!this.out.includes(it)) this.out.push(it);
  }

  // ---- water: the hydrant's column, a hole's fan ---------------------------------------------------------------------
  geyser(it) {
    const G0 = this.game;
    const g = { at: new THREE.Vector3(it.x, it.y0 + 0.12, it.z), t: 0, acc: 0, dead: false, it };
    this.geysers.push(g);
    it.geyser = g;
    // (two at most in full spate: the oldest falls to a dribble - the splash pool is 300 drops)
    const full = this.geysers.filter((x) => !x.dead && x.t < 40);
    if (full.length > 2) full[0].t = Math.max(full[0].t, 40);
    if (G0) G0.sfx.hydrant(g.at);
  }
  jet(at, dir, fluid = 'water', life = 10) {
    this.jets.push({ at: at.clone(), dir: dir.clone(), t: 0, acc: 0, life, fluid });
    while (this.jets.length > 6) this.jets.shift();
    if (this.game) this.game.sfx.play('burst_water', at, {}, { ref: 3 });
  }
  waterStep(dt) {
    const G0 = this.game;
    if (!G0) return;
    for (let i = this.geysers.length - 1; i >= 0; i--) {
      const g = this.geysers[i];
      if (g.dead) { this.geysers.splice(i, 1); continue; }
      g.t += dt;
      // a minute of it: full for 40 s, then dying to a dribble
      const k = Math.min(1, g.t / 0.3) * (g.t > 40 ? Math.max(0.05, 1 - (g.t - 40) / 20) : 1);
      if (g.t > 60) { g.dead = true; continue; }
      // (a white column off the stump, opening into a crown that rains back down round it)
      g.acc += dt * 95 * k;
      while (g.acc >= 1) {
        g.acc -= 1;
        const up = this.rnd(6.5, 10.5) * Math.sqrt(k), sp = this.rnd() < 0.3 ? 1.1 : 0.45;
        G0.fx.splash.spawn({ pos: g.at.clone().add(_v.set(this.gauss() * 0.05, 0, this.gauss() * 0.05)), vel: new THREE.Vector3(this.gauss() * sp, up, this.gauss() * sp), life: this.rnd(1.0, 1.8), size: [0.045, 0.16], stretch: 0.08,
          col: [1.1, 1.1, 1.1], alpha: 0.95, cell: ATLAS.DROP, gravity: 9.8, ground: g.at.y - 0.1, fadeOut: 0.2 });
      }
      // the fall of it on the street: rings on the wet round the stump
      if (this.rnd() < dt * 8 * k && this.stage.street && this.stage.street.addImpact) this.stage.street.addImpact(this.stage, g.at.x + this.gauss() * 1.2, g.at.z + this.gauss() * 1.2, 0.4);
      // (spray where it falls back: a low pale haze round the stump)
      if (this.rnd() < dt * 4 * k) G0.fx.dust.spawn({ pos: g.at.clone().add(_v.set(this.gauss() * 0.6, this.rnd(0.1, 0.6), this.gauss() * 0.6)), vel: new THREE.Vector3(this.gauss() * 0.4, 0.3, this.gauss() * 0.4), life: this.rnd(0.8, 1.3), size: [0.45, 0.35], grow: 0.8, rot: this.rnd(0, 6.28), col: [0.7, 0.7, 0.7], alpha: 0.1, drag: 1.5, fadeOut: 0.6 });
    }
    for (let i = this.jets.length - 1; i >= 0; i--) {
      const J = this.jets[i];
      J.t += dt;
      if (J.t > J.life) { this.jets.splice(i, 1); continue; }
      const strong = Math.max(0, 1 - J.t / J.life);
      J.acc += dt * (14 + 50 * strong);
      while (J.acc >= 1) {
        J.acc -= 1;
        const sp = (0.5 + 3.2 * strong) * this.rnd(0.7, 1.1), fan = 0.15 + 0.4 * strong;
        G0.fx.splash.spawn({ pos: J.at.clone(), vel: new THREE.Vector3(J.dir.x * sp + this.gauss() * fan, J.dir.y * sp + this.gauss() * fan * 0.5, J.dir.z * sp + this.gauss() * fan), life: this.rnd(0.4, 0.9), size: [0.01, 0.02 + 0.01 * strong], stretch: 0.03, col: [0.45, 0.45, 0.45], alpha: 0.9, cell: ATLAS.DROP, gravity: 9.8, ground: this.stage.surfaceY(J.at.x, J.at.z), fadeOut: 0.1 });
      }
    }
  }
  // an awning's load of rain sheets off its edge
  dump(it) {
    const G0 = this.game;
    if (!G0 || it.dumped) return;
    it.dumped = true;
    const W = it.opts.w || 3, D = it.opts.d || 1.5, wl = it.opts.wall || { nx: 1, nz: 0 };
    for (let k = 0; k < 140; k++) {
      const u = (this.rnd() - 0.5) * W;
      const p = new THREE.Vector3(it.x + wl.nx * D * this.rnd(0.6, 1) - wl.nz * u, it.y0 + (it.K.low ?? 2.5) - 0.1, it.z + wl.nz * D * this.rnd(0.6, 1) + wl.nx * u);
      G0.fx.splash.spawn({ pos: p, vel: new THREE.Vector3(this.gauss() * 0.2, this.rnd(-1, 0.2), this.gauss() * 0.2), life: this.rnd(0.5, 1.0), size: [0.014, 0.05], stretch: 0.04, col: [0.42, 0.42, 0.42], alpha: 0.9, cell: ATLAS.DROP, gravity: 9.8, ground: this.stage.surfaceY(p.x, p.z), fadeOut: 0.1 });
    }
  }

  // ---- the mess (pieces, sparks, chips) ---------------------------------------------------------------------------------
  randQ() { return new THREE.Quaternion().setFromEuler(new THREE.Euler(this.rnd(0, 6.28), this.rnd(0, 6.28), this.rnd(0, 6.28))); }
  flung(cv, spread = 1, lift = 1) {
    const k = Math.min(1, cv.length() / 20);
    return new THREE.Vector3(cv.x * this.rnd(0.45, 1.05) + this.gauss() * 2.2 * spread, this.rnd(2.0, 5.5) * lift * (0.4 + 0.8 * k) + this.rnd(0, 1.2), cv.z * this.rnd(0.45, 1.05) + this.gauss() * 2.2 * spread);
  }
  spin(k = 1) { return new THREE.Vector3(this.gauss() * 9 * k, this.gauss() * 9 * k, this.gauss() * 9 * k); }
  spillGoods(it, cv) {
    const PC = this.pieces;
    // the goods off its table: fruit, skidding on the wet
    for (let k = 0; k < 22; k++) {
      const o = new THREE.Vector3(this.gauss() * 0.9, 1.0 + this.rnd(0, 0.2), this.gauss() * 0.25).applyQuaternion(it.q0).add(it.P);
      const r = this.rnd(0.05, 0.075);
      PC.spawn('fruit', o, this.randQ(), _w.set(r, r, r), this.flung(cv, 1.3, 0.8), this.spin(0.5), { r, bounce: 0.45, roll: true });
    }
    for (let k = 0; k < 3; k++) {
      const o = new THREE.Vector3((k - 1) * 0.8, 1.0, 0.15).applyQuaternion(it.q0).add(it.P);
      PC.spawn('plank', o, this.randQ(), _w.set(0.62, 0.22, 0.42), this.flung(cv, 0.8, 0.7), this.spin(0.6), { r: 0.25 });
    }
    // its canvas torn off, fluttering down
    const top = it.P.clone().setY(it.y0 + 2.3);
    const cv2 = this.flung(cv, 0.4, 1.4); cv2.y += 2;
    PC.spawn('cloth', top, it.q0.clone().multiply(_q.setFromEuler(new THREE.Euler(-Math.PI / 2 + 0.3, 0, 0))), _w.set(2.9, 1.6, 1), cv2, this.spin(0.35), { r: 0.05, paper: true });
  }
  goodsBurst(it, p, dir) {
    const PC = this.pieces;
    for (let k = 0; k < 4; k++) {
      const r = this.rnd(0.03, 0.05);
      PC.spawn('fruit', p.clone().add(_v.set(this.gauss() * 0.1, 0.05, this.gauss() * 0.1)), this.randQ(), _w.set(r, r, r), new THREE.Vector3(dir.x * 2 + this.gauss() * 1.5, this.rnd(1.5, 3.2), dir.z * 2 + this.gauss() * 1.5), this.spin(0.6), { r, bounce: 0.4, roll: true });
    }
    const G0 = this.game;
    if (G0) { G0.sfx.play('splinter', p, { k: 0.5 }, { ref: 3 }); this.chipsAt(p, dir, 0.08, 6); }
  }
  papers(it, cv, n, at = null) {
    const PC = this.pieces;
    const o0 = at || it.P.clone().setY(it.y0 + 1.2);
    for (let k = 0; k < n; k++) {
      const o = o0.clone().add(_v.set(this.gauss() * 0.4, this.rnd(0, 0.8), this.gauss() * 0.4));
      const v = this.flung(cv, 1.4, 1.2).multiplyScalar(0.7); v.y += this.rnd(1, 3.5);
      PC.spawn('sheet', o, this.randQ(), _w.set(this.rnd(0.3, 0.45), this.rnd(0.38, 0.55), 1), v, this.spin(0.5), { r: 0.01, paper: true });
    }
    if (this.game) this.game.sfx.play('newspaper', o0, {}, { ref: 3 });
  }
  glassBits(p, dir, n = 10) {
    const PC = this.pieces;
    for (let k = 0; k < n; k++) {
      const s = this.rnd(0.02, 0.06);
      PC.spawn('shard', p.clone().add(_v.set(this.gauss() * 0.1, this.gauss() * 0.1, this.gauss() * 0.1)), this.randQ(), _w.set(s, s, 1), new THREE.Vector3(dir.x * 1.2 + this.gauss(), this.rnd(0.2, 1.6), dir.z * 1.2 + this.gauss()), this.spin(1.2), { r: 0.02, bounce: 0.2 });
    }
  }
  sparksAt(p, dir, k = 1) {
    const G0 = this.game;
    if (!G0) return;
    const n = Math.round(10 + 22 * k);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(this.gauss() * 2, this.rnd(0.5, 2.8), this.gauss() * 2).addScaledVector(dir, -1.2 * k);
      G0.fx.sparks.spawn({ pos: p.clone(), vel: v, life: this.rnd(0.12, 0.45), size: [0.008, 0.013], stretch: 0.03, col: [6, 6, 6], cell: ATLAS.DROP, gravity: 9.8, ground: this.stage.surfaceY(p.x, p.z) + 0.01, fadeOut: 0.3 });
    }
  }
  chipsAt(p, dir, size = 0.1, n = 8) {
    const G0 = this.game;
    if (!G0) return;
    for (let i = 0; i < n; i++) {
      const s = this.rnd(size * 0.3, size);
      G0.fx.debris.spawn({ pos: p.clone(), vel: new THREE.Vector3(-dir.x * this.rnd(0.6, 2) + this.gauss() * 1.2, this.rnd(0.5, 2.5), -dir.z * this.rnd(0.6, 2) + this.gauss() * 1.2), life: this.rnd(0.6, 1.2), size: [s, s * 0.4], rot: this.rnd(0, 6.28), spin: this.gauss() * 14, col: [0.1, 0.1, 0.1], alpha: 1, cell: FIRE.CHUNK, gravity: 9.8, ground: this.stage.surfaceY(p.x, p.z) + 0.01, bounce: 0.25, fadeOut: 0.3 });
    }
  }
  dust(p, k = 1) {
    const G0 = this.game;
    if (!G0) return;
    for (let i = 0; i < 3; i++) G0.fx.dust.spawn({ pos: p.clone().add(_v.set(this.gauss() * 0.2, 0.3, this.gauss() * 0.2)), vel: new THREE.Vector3(this.gauss() * 0.3, this.rnd(0.1, 0.5), this.gauss() * 0.3), life: this.rnd(0.6, 1.1), size: [0.4 * k, 0.4 * k], grow: 0.8, rot: this.rnd(0, 6.28), col: [0.08, 0.08, 0.08], alpha: 0.4, drag: 2.5, fadeOut: 0.8 });
  }

  // ---- what a round meets (fx/React.js: stage.props.hit(ud.prop, hit, dir, { weak })) ----------------------------------
  // ud.prop: an item (its own mesh, its box out of the merge), or 'merged'
  // (a merged mesh: the item standing where the round went)
  bullet(prop, hit, dir, weak = false) {
    if (prop && prop.carD) return this.cars.bullet(prop.carD, hit, dir, weak);
    let it = prop && prop.K ? prop : null;
    if (!it) it = this.pick(hit.point);
    if (!it) return null;
    return this.shot(it, hit.point, dir, weak);
  }
  // the standing item whose shape holds a point (a round on a merged mesh)
  pick(p) {
    let best = null, bd = Infinity;
    for (const it of this.near(p.x, p.z, 2.2)) {
      if (it.state !== 'stand' && !it.dark) continue;
      const K = it.K;
      const dy = p.y - it.y0;
      let d;
      if (K.lamp) {
        // the post, the arm, the head
        const L = this.lampOf(it);
        const dh = L ? p.distanceTo(L.head) : 9;
        const dp = Math.hypot(p.x - it.x, p.z - it.z);
        d = Math.min(dh < 0.8 ? dh * 0.5 : 9, dy < 6.4 && dp < 0.4 ? dp : 9, dy > 5 && dy < 6.5 ? this.armDist(it, p) : 9);
      } else if (K.round) {
        if (dy < -0.1 || dy > K.h + 0.15) continue;
        d = Math.hypot(p.x - it.x, p.z - it.z) - K.r;
      } else if (it.fp) {
        if (dy < -0.1 || dy > K.h + 0.3) continue;
        const c = Math.cos(it.yaw), s = Math.sin(it.yaw), dx = p.x - it.x, dz = p.z - it.z;
        const lx = dx * c - dz * s, lz = dx * s + dz * c;
        d = Math.max(Math.abs(lx) - it.fp.hx, Math.abs(lz) - it.fp.hz);
      } else continue;
      if (d < 0.3 && d < bd) { bd = d; best = it; }
    }
    return best;
  }
  armDist(it, p) {
    const c = Math.cos(it.yaw), s = Math.sin(it.yaw);
    const dx = p.x - it.x, dz = p.z - it.z;
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    return lx > -0.2 && lx < 1.8 ? Math.abs(lz) : 9;
  }

  // ---- per step (fx/React.js steps the stage's props) -------------------------------------------------------------
  update(dt, t) {
    const G0 = this.game;
    for (let i = this.out.length - 1; i >= 0; i--) {
      const it = this.out[i];
      it.t += dt;
      if (it.bumpT > 0) it.bumpT -= dt;
      if (it.flick) this.lampStep(it, dt);
      if (it.state !== 'live' || !it.body) continue;
      if (it.body.lean) this.stepLean(it, dt);
      else this.stepBody(it, dt);
      if (it.lamp && it.body.lean) this.lampFollow(it);
      this.draw(it);
    }
    for (const it of this.dark) if (it.flick) this.lampStep(it, dt);
    this.waterStep(dt);
    this.pieces.update(dt);
    const me = G0 && G0.vehicles && G0.vehicles.player;
    if (me && me.model && me.model.wheel) this.pieces.guard(me);
    this.cars.update(dt, t);
    // far from the eye: mended (a few looked at a step, round the list)
    if (G0 && (this.out.length || this.dark.length)) {
      const e = G0.camera.position;
      // (the lists in turn: what is out, then the dark lamps)
      this._ml = !this._ml;
      const L = (this._ml && this.out.length) || !this.dark.length ? this.out : this.dark;
      this._mi = ((this._mi || 0) + 1) % Math.max(1, L.length);
      const it = L[this._mi];
      if (it && Math.hypot(it.x - e.x, it.z - e.z) > MEND_R && !(it.geyser && !it.geyser.dead && it.geyser.t < 60)) this.mend(it);
    }
  }
}

const _box = new THREE.Box3();
function G0play(G0, name, at, k) { if (G0) G0.sfx.play(name, at, { k }, { ref: 3 }); }

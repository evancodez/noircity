import * as THREE from 'three';
import { FIRE, ATLAS } from '../fx/fxTextures.js';
import { accent } from '../render/accents.js';
import { roundedBox, tube } from '../world/geom.js';
import { supportUnder } from './Glass.js';
const _box3 = new THREE.Box3(), _c3 = new THREE.Vector3();

// Breakables (docs/story/CONTRACTS.md §8.2): anything a round, a fist, a
// body, a blast or a car can break. One set per stage (stage.breakables,
// game.breakables); a part registers its things while it builds.
//   breakables.add(object, { kind, hp: 1, mass, solid: true, collider?,
//                            onBreak(ctx, how) }) -> handle
//   breakables.hit(handle | object, { point, dir, power, by, neck? })  -> 'hit' | 'break' | null
//       by: 'bullet' | 'fist' | 'body' | 'blast' | 'car'   (a fist counts 0.35
//       of a round, a blast or a car 3)
//   breakables.topple(handle | object, impulse: Vector3)   knock it over, whole
//       (a stool falls and rolls; it knocks the next one in its way)
//   breakables.upright(handle)   breakables.remove(handle)   breakables.list
//   breakables.spill(pos, { accent?: 'amber', amount: 1 })   a liquid spilt
// Each kind breaks in its own way and leaves its own mess (lane 3, P0.3):
//   bottle   breaks at the shoulder: the neck stays (in the hand, a jagged
//            weapon: how.neck), the body goes to curved shards, the liquid
//            bursts and runs (amber for whisky)
//   plate, cup, saucer, mug   5-8 wedges (the cup's handle its own piece)
//   tumbler  the heavy base survives, the wall goes to bits
//   stool    the seat comes off the column, the column bends, the base rolls
//            away in an arc
//   table    splits along its length, the two halves fold in
//   pieCase  its glass shatters as panes do (destruct/Glass.js), what is in
//            it slides out
//   jukebox  never destroyed: a hit dents it, its lights stutter, a shower of
//            sparks at the third hit
//   crate, barrel, sign, pipe, can, ...   (the street's: P1, see below)
// Pieces are real meshes cut to the thing's size (never the prop's insides:
// the prop library is lane 5's), they fall, bounce, settle and stay (capped,
// the oldest go). A break emits 'break' { kind, pos, by, neck? } and asks for
// the sound 'break_<kind>' (sfx.play is silent for a name it lacks).
// Bullets find a breakable through mesh.userData.breakable (fx/React.js).
// Draws come from forks of its own, never from the stage's shared rng.
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _ax = new THREE.Vector3(), _m = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);
const HP_OF = { bullet: 1, fist: 0.35, body: 1, blast: 3, car: 3 };
const LIVE_CAP = 140, REST_CAP = 280;

export class Breakables {
  constructor(stage) {
    this.stage = stage;
    this.list = [];
    this.moving = [];     // topples in progress
    this.rng = null;
    this.pieces = null;   // PieceField
    this.spills = [];
    this.flickers = [];
    this.jets = [];       // burst pipes: water fans, steam jets, a barrel's leak
    this.swings = [];     // hanging signs
    this.ropes = [];      // cut wires
  }

  // (opts: a kind's own settings - a pipe's fluid, a wire's ends, a sign's
  // brackets - kept on the handle as h.opts)
  add(object, { kind = 'thing', hp = 1, mass = 1, solid = true, collider = null, onBreak = null, ...opts } = {}) {
    // (snap/made/removed/panes: what restore() needs - see there)
    const h = { object, kind, hp, hp0: hp, mass, solid, collider, onBreak, broken: false, toppled: false, hits: 0, opts, snap: null, made: [], removed: [], panes: [] };
    object.traverse((o) => { if (o.isMesh) { o.userData.breakable = h; if (!solid) o.userData.noRay = true; } });
    // (added once the stage stands: into the bullets' world now; during the
    // build the stage collects every mesh on its own)
    if (solid && this.stage.rays) object.traverse((o) => { if (o.isMesh) this.stage.addSolid(o); });
    object.userData.breakableHandle = h;
    this.list.push(h);
    return h;
  }

  handle(x) { return x && x.object ? x : x && x.userData ? x.userData.breakableHandle || x.userData.breakable || null : null; }

  remove(x) {
    const h = this.handle(x);
    if (!h) return;
    const i = this.list.indexOf(h);
    if (i >= 0) this.list.splice(i, 1);
  }

  get game() { return this.stage.game; }
  get R() { return this.rng || (this.rng = this.stage.rng.fork(6161)); }
  get field() { return this.pieces || (this.pieces = new PieceField(this.stage, this.stage.rng.fork(6162))); }

  hit(x, { point = null, dir = new THREE.Vector3(0, 0, -1), power = 1, by = 'bullet', neck = null } = {}) {
    const h = this.handle(x);
    if (!h || h.broken) return null;
    this.snapshot(h);
    this._cur = h;
    h.hits++;
    if (h.kind === 'jukebox') { this.dent(h, { point, dir, by }); return 'hit'; }  // (dented, never destroyed)
    // the street's things answer every hit in their own way (P1)
    if (HIT[h.kind]) { const res = HIT[h.kind].call(this, h, { point, dir: dir.clone().normalize(), power, by }); if (res) return res; }
    h.hp -= power * (HP_OF[by] ?? 1);
    if (h.hp > 1e-6) {
      // a knock that does not break it: a stool rocks, a sign swings
      if (h.kind === 'stool' && by !== 'bullet') this.topple(h, dir);
      return 'hit';
    }
    this.breakIt(h, { point, dir, by, neck });
    return 'break';
  }

  // ---- the break -----------------------------------------------------------------
  breakIt(h, { point = null, dir = new THREE.Vector3(0, 0, -1), by = 'bullet', neck = null } = {}) {
    const G = this.game, S = this.stage;
    this.snapshot(h);
    this._cur = h;
    h.broken = true;
    const o = h.object;
    o.updateWorldMatrix(true, true);
    const pos = point ? point.clone() : o.getWorldPosition(new THREE.Vector3());
    // (a thing in a hand: its own scene is not the stage's; or on a bone)
    let root = o, onBone = false;
    while (root.parent) { root = root.parent; if (root.isBone) onBone = true; }
    const held = neck ?? (root !== S.scene || onBone);
    const how = { by, pos, dir, neck: null };
    const fn = BREAK[h.kind] || BREAK.thing;
    fn.call(this, h, { pos, dir: dir.clone().normalize(), by, held, how });
    if (h.kind !== 'pieCase') {
      o.visible = false;
      o.traverse((m) => { if (m.isMesh) this.unSolid(h, m); });
    }
    if (h.collider) {
      const C = S.colliders;
      for (const arr of [C.circles, C.boxes]) { const i = arr.indexOf(h.collider); if (i >= 0) { arr.splice(i, 1); h.colArr = arr; } }
    }
    if (G) {
      if (G.sfx && G.sfx.play) G.sfx.play('break_' + h.kind, pos);
      G.emit('break', { kind: h.kind, pos, by, neck: how.neck });
    }
    if (h.onBreak) h.onBreak(G ? G.scenes ? G.scenes.ctx : G : null, how);
    return how;
  }

  // broken glass: a clear piece shows as its bright edges and a sheen (the
  // prop's own glass prints near black once it is a small shard)
  shardMat() {
    return this._shard || (this._shard = new THREE.MeshStandardMaterial({ color: 0x505050, roughness: 0.12, metalness: 0.55, envMap: this.stage.M.env, envMapIntensity: 1.8, side: THREE.DoubleSide }));
  }

  // the object's first material (the pieces are made of it)
  matOf(o, pick = null) {
    let m = null;
    o.traverse((x) => { if (!m && x.isMesh && (!pick || pick(x))) m = x.material; });
    return m || new THREE.MeshStandardMaterial({ color: 0x333333 });
  }
  sizeOf(o) {
    if (o.userData.size) return o.userData.size.isVector3 ? o.userData.size : new THREE.Vector3(...o.userData.size);
    const b = new THREE.Box3().setFromObject(o);
    const s = b.getSize(new THREE.Vector3());
    // (in the object's own scale: the box is world-sized)
    const sc = o.getWorldScale(new THREE.Vector3());
    return s.divide(sc);
  }

  // a piece: geometry in the object's local frame -> a mesh at its world
  // place, flung
  piece(o, geo, mat, vel, spin, opts = {}) {
    geo.computeBoundingBox();
    const c = geo.boundingBox.getCenter(new THREE.Vector3());
    geo.translate(-c.x, -c.y, -c.z);
    const m = new THREE.Mesh(geo, mat);
    o.updateWorldMatrix(true, false);
    _m.copy(o.matrixWorld);
    m.position.copy(c).applyMatrix4(_m);
    m.quaternion.setFromRotationMatrix(_m);
    m.scale.setFromMatrixScale(_m);
    m.userData.inkId = o.userData.inkId ?? (() => { let id = 1; o.traverse((x) => { if (x.isMesh && x.userData.inkId) id = x.userData.inkId; }); return id; })();
    m.userData.noRay = true;
    m.castShadow = false;
    return this.field.add(m, vel, spin, { owner: this._cur, ...opts });
  }

  // ---- restore (Wave A fix D2): a retry, a second BEGIN, d.reset() ------------------
  // The first blow (a hit, a topple, a dent) snapshots the thing as it stood:
  // every node of it with its parent, its local transform, its visibility
  // and its material. restore(handle) takes away what the break made (its
  // pieces, a neck, cut wires' halves, the pie case's glass and its shards,
  // a swing, a flicker, a jet), puts the snapshot back, the solids back into
  // the bullets' world and its collider back in the room, and forgets the
  // damage. clearPieces(box) sweeps the mess out of a box (everything that
  // fell and lies there: pieces, glass shards, spills, marks).
  snapshot(h) {
    if (h.snap) return;
    const list = [];
    h.object.traverse((o) => list.push({ o, parent: o.parent, p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone(), vis: o.visible, mat: o.isMesh ? o.material : null }));
    h.snap = list;
  }

  // a mesh out of the bullets' world, remembered for restore
  unSolid(h, m) {
    // (a mesh collected by the stage at its build is in the bullets' world
    // without being in stage.solids: anything not marked noRay was a solid)
    if (!m.userData.noRay && !h.removed.includes(m)) h.removed.push(m);
    this.stage.removeSolid(m);
  }

  restore(x, { place = true } = {}) {
    const h = this.handle(x);
    if (!h) return null;
    const S = this.stage, G = this.game;
    const own = new Set(h.snap ? h.snap.map((e) => e.o) : []);
    // what the break made
    this.moving = this.moving.filter((m) => m.h !== h);
    this.swings = this.swings.filter((s) => s.h !== h);
    this.flickers = this.flickers.filter((f) => f.h !== h);
    this.jets = this.jets.filter((j) => j.h !== h);
    for (const R of this.ropes) if (R.h === h && R.mesh.parent) { R.mesh.parent.remove(R.mesh); R.mesh.geometry.dispose(); }
    this.ropes = this.ropes.filter((R) => R.h !== h);
    if (this.pieces) this.pieces.drop((p) => p.owner === h, own);
    for (const m of h.made) if (!own.has(m) && m.parent) m.parent.remove(m);
    for (const pane of h.panes) if (S.glass && S.glass.removePane) S.glass.removePane(pane);
    // the thing as it stood before the first blow
    if (h.snap && place) {
      for (const e of h.snap) {
        const o = e.o;
        if (o.parent !== e.parent) { if (e.parent) e.parent.add(o); else if (o.parent) o.parent.remove(o); }
        o.position.copy(e.p); o.quaternion.copy(e.q); o.scale.copy(e.s); o.visible = e.vis;
        if (e.mat && o.material !== e.mat) o.material = e.mat;
        if (o.userData.ownMat) { delete o.userData.ownMat; delete o.userData.col0; delete o.userData.em0; }
      }
      h.object.updateWorldMatrix(true, true);
    }
    // (the room's own reset may have put some back already)
    for (const m of h.removed) if (!S.solids.includes(m)) S.addSolid(m);
    if (G && G.rays && G.rays.refresh) h.object.traverse((m) => { if (m.isMesh && S.solids.includes(m)) G.rays.refresh(m); });
    if (h.collider && h.colArr && !h.colArr.includes(h.collider)) h.colArr.push(h.collider);
    if (h.collider && h.collider.x0 !== undefined) { h.collider.x = h.collider.x0; h.collider.z = h.collider.z0; }
    Object.assign(h, { broken: false, toppled: false, hp: h.hp0, hits: 0, dumped: false, cut: false, out: false, snap: null, made: [], removed: [], panes: [] });
    delete h.rest;
    if (G && G.pipeline && G.pipeline.dirtyShadows) G.pipeline.dirtyShadows();
    return h;
  }

  // sweep a box (THREE.Box3, world) clear of what fell there - or everywhere
  // (no box): the pieces, the glass shards, the spills running off an edge,
  // the pools and marks on its floor. A thing's own meshes that fell (a pie
  // slid out of its case, a crate thrown off a stack) are left for restore().
  clearPieces(box = null) {
    const S = this.stage, G = this.game;
    const inBox = (o) => !box || box.containsPoint(o.getWorldPosition(_v));
    const own = new Set();
    for (const h of this.list) if (h.snap) for (const e of h.snap) own.add(e.o);
    let n = this.pieces ? this.pieces.drop((p) => inBox(p.mesh), own) : 0;
    this.spills = this.spills.filter((s) => !(!box || box.containsPoint(s.edge.at)));
    if (S.glass && S.glass.clearShards) n += S.glass.clearShards(box);
    if (G && G.fx && G.fx.decals && G.fx.decals.clearIn) G.fx.decals.clearIn(box);
    return n;
  }

  // the liquid in it bursts: drops, then a spill where it lands
  burst(pos, dir, key, amount = 1) {
    const G = this.game, r = this.R;
    if (!G) return;
    const c = key ? accent(key) : new THREE.Color(0.02, 0.02, 0.02);
    const col = [c.r * 1.6, c.g * 1.6, c.b * 1.6];
    for (let k = 0; k < 26 * amount; k++) {
      const v = new THREE.Vector3(r.gauss(), r.range(0.2, 1.4), r.gauss()).normalize().multiplyScalar(r.range(0.8, 2.8)).addScaledVector(dir, 0.8);
      const s = r.range(0.006, 0.016);
      G.fx.debris.spawn({ pos: pos.clone(), vel: v, life: r.range(0.4, 0.8), size: [s, s * 1.8], stretch: 0.02, rot: 0, col, cell: FIRE.EMBER, gravity: 9.8, ground: this.floorAt(pos), fadeOut: 0.15 });
    }
    this.spill(pos, { accent: key, amount });
  }

  // ---- the spill: it spreads on what it fell on and runs off an edge ----------------
  // (the support under it is found by the bullets' rays: a counter top, a
  // table, the floor; an edge within reach sends a thin stream down to a
  // pool on the floor)
  spill(pos, { accent: key = 'amber', amount = 1 } = {}) {
    const G = this.game, r = this.R;
    if (!G) return null;
    const top = this.supportAt(pos);
    // (a spilt pool is the liquid seen thin on a dark top: deeper than the
    // liquid in the glass, never lifted toward flame)
    const c = key ? accent(key) : new THREE.Color(0.02, 0.02, 0.02);
    const col = [c.r * 0.55, c.g * 0.5, c.b * 0.5];
    const p = new THREE.Vector3(pos.x, top + 0.003, pos.z);
    G.fx.decals.pools.add(p, UP.clone(), 0.16 + 0.16 * amount, r.next() * 6.28, ATLAS.POOL, col, 0.95, { grow: 1.8 }, G.time ?? 0);
    // an edge nearby: where the support drops away within ~0.3 m
    const floor = this.floorAt(pos);
    let edge = null;
    if (top - floor > 0.25) {
      for (let k = 0; k < 12 && !edge; k++) {
        const a = k * Math.PI / 6;
        for (const d of [0.12, 0.2, 0.3]) {
          const q = new THREE.Vector3(pos.x + Math.cos(a) * d, pos.y, pos.z + Math.sin(a) * d);
          if (this.supportAt(q) < top - 0.2) { edge = { at: new THREE.Vector3(pos.x + Math.cos(a) * (d - 0.04), top, pos.z + Math.sin(a) * (d - 0.04)), dir: new THREE.Vector3(Math.cos(a), 0, Math.sin(a)) }; break; }
        }
      }
    }
    const s = { col, edge, top, floor, t: 0, life: 2.2 + 1.5 * amount, acc: 0, pooled: false, amount };
    if (edge) this.spills.push(s);
    return s;
  }

  // the highest solid under a point (a counter, a table), else the floor
  supportAt(p) {
    const G = this.game;
    const fl = this.floorAt(p);
    if (!G || !G.rays) return fl;
    const hit = G.rays.raycast(new THREE.Vector3(p.x, p.y + 0.3, p.z), new THREE.Vector3(0, -1, 0), 4);
    return hit ? Math.max(fl, hit.point.y) : fl;
  }
  floorAt(p) { return this.stage.surfaceY(p.x, p.z); }

  // ---- the jukebox: dented, never destroyed ------------------------------------------
  dent(h, { point, dir }) {
    const G = this.game, r = this.R, o = h.object;
    if (!G) return;
    // a jolt (it rocks on its feet) and a dark dent mark
    this.moving.push({ h, jolt: 0.18, t: 0, p0: o.position.clone(), dir: dir.clone().setY(0).normalize() });
    if (point) G.fx.decals.ink(point, dir.clone().negate(), 0.07);
    // its lights stutter: the glowing parts dip and catch for ~0.7 s
    const glows = [];
    o.traverse((m) => {
      if (!m.isMesh) return;
      const mat = m.material;
      const lum = mat.color ? mat.color.r + mat.color.g + mat.color.b : 0;
      if (mat.isMeshBasicMaterial || (mat.emissive && mat.emissive.getHex() !== 0) || lum > 1.5) {
        if (!m.userData.ownMat) { m.material = mat.clone(); m.userData.ownMat = true; m.userData.col0 = m.material.color ? m.material.color.clone() : null; m.userData.lv0 = m.material.uniforms && m.material.uniforms.uLevel ? m.material.uniforms.uLevel.value : null; m.userData.em0 = m.material.emissive ? m.material.emissive.clone() : null; }
        glows.push(m);
      }
    });
    this.flickers.push({ h, meshes: glows, t: 0, dur: 0.7 + 0.2 * h.hits, seed: r.next() * 100 });
    // the third hit: a shower of sparks out of its works
    if (h.hits % 3 === 0) {
      const c = point || o.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 1, 0));
      for (let k = 0; k < 40; k++) {
        const v = new THREE.Vector3(r.gauss(), r.range(0.4, 1.6), r.gauss()).normalize().multiplyScalar(r.range(1.5, 4.5)).addScaledVector(dir, -1.2);
        G.fx.sparks.spawn({ pos: c.clone(), vel: v, life: r.range(0.25, 0.7), size: [0.01, 0.016], stretch: 0.03, col: [5, 5, 5], cell: ATLAS.DROP, gravity: 9.8, ground: this.floorAt(c), fadeOut: 0.3 });
      }
    }
    if (G.sfx && G.sfx.play) G.sfx.play('jukebox_hit', point || o.getWorldPosition(new THREE.Vector3()), { power: 1 });
  }

  // ---- topple: knocked over whole ----------------------------------------------------
  // It tips away from the push about its base's far edge (gravity takes it),
  // lands, and a stool rolls a little in an arc on its side; a stool that
  // falls into the next one knocks it over too
  topple(x, impulse = new THREE.Vector3(1, 0, 0)) {
    const h = this.handle(x);
    if (!h || h.broken || h.toppled) return;
    this.snapshot(h);
    h.toppled = true;
    const o = h.object;
    _v.set(impulse.x, 0, impulse.z);
    if (_v.lengthSq() < 1e-8) _v.set(1, 0, 0);
    _v.normalize();
    const size = this.sizeOf(o);
    const foot = Math.max(0.08, Math.min(size.x, size.z) * 0.45);
    // the axis: horizontal, across the push, through the base's far edge
    const axis = new THREE.Vector3(_v.z, 0, -_v.x);
    this.moving.push({
      h, q0: o.quaternion.clone(), p0: o.position.clone(), axis, dir: _v.clone(), foot, height: size.y,
      ang: 0, w: 0.9 + Math.min(2, impulse.length()) * 0.6, t: 0, rolled: 0, rollW: h.kind === 'stool' ? this.R.range(1.2, 2.2) * (this.R.chance(0.5) ? 1 : -1) : 0, knocked: false,
    });
    const G = this.game;
    if (G && G.sfx && G.sfx.play) G.sfx.play('topple_' + h.kind, o.getWorldPosition(new THREE.Vector3()));
  }

  // stand it back up (a retry, a preset)
  upright(x) {
    const h = this.handle(x);
    if (!h) return;
    const m = this.moving.find((e) => e.h === h);
    if (m) { if (m.q0) h.object.quaternion.copy(m.q0); h.object.position.copy(m.p0); this.moving.splice(this.moving.indexOf(m), 1); }
    else if (h.rest) { h.object.quaternion.copy(h.rest.q); h.object.position.copy(h.rest.p); }
    h.toppled = false;
    this.home(h);
  }

  // a knocked-over thing stood up again: its collider where it stands, its
  // meshes where the bullets' world (and what falls) finds them
  home(h) {
    const cl = h.collider;
    if (cl && cl.x0 !== undefined) { cl.x = cl.x0; cl.z = cl.z0; }
    const G = this.game;
    if (G && G.rays && G.rays.refresh) { h.object.updateMatrixWorld(true); h.object.traverse((x) => { if (x.isMesh) G.rays.refresh(x); }); }
  }

  update(dt) {
    for (let i = this.moving.length - 1; i >= 0; i--) {
      const m = this.moving[i], o = m.h.object;
      m.t += dt;
      if (m.jolt !== undefined) {
        // the jukebox rocks back onto its feet
        const k = Math.max(0, 1 - m.t / m.jolt);
        o.position.copy(m.p0).addScaledVector(m.dir, 0.012 * Math.sin(m.t * 60) * k);
        if (m.t >= m.jolt) { o.position.copy(m.p0); this.moving.splice(i, 1); }
        continue;
      }
      const G = 9.8;
      // tipping about the far base edge: angular acceleration by the lever
      if (m.ang < Math.PI / 2) {
        const lev = Math.hypot(m.foot, m.height / 2);
        m.w += (G / lev) * Math.sin(m.ang + Math.atan2(m.foot * 0.3, m.height / 2)) * dt * 0.9;
        m.ang = Math.min(Math.PI / 2, m.ang + m.w * dt);
        if (m.ang >= Math.PI / 2) { m.w = 0; m.landT = m.t; }
      } else if (m.barrel) {
        // a barrel on its side rolls across its axis, slowing
        m.barrel.v = Math.max(0, m.barrel.v - dt * 0.8);
        m.barrel.x += m.barrel.v * dt;
      } else if (m.rollW) {
        // on its side: it rolls in an arc about its base, slowing
        m.rollW *= Math.max(0, 1 - dt * 1.6);
        m.rolled += m.rollW * dt;
      }
      // the pose: rotate about the far base edge, then (rolled) about the
      // vertical through the base
      const pivot = m.p0.clone().addScaledVector(m.dir, m.foot);
      _q.setFromAxisAngle(m.axis, m.ang);
      const off = m.p0.clone().sub(pivot).applyQuaternion(_q);
      o.quaternion.copy(m.q0).premultiply(_q);
      o.position.copy(pivot).add(off);
      if (m.barrel && m.barrel.x) {
        // (on its side its axis lies along the push: it rolls across it)
        const qb = new THREE.Quaternion().setFromAxisAngle(m.dir, -m.barrel.x / Math.max(0.1, m.foot));
        const c = o.position.clone();
        o.quaternion.premultiply(qb);
        o.position.copy(c).addScaledVector(m.axis, m.barrel.x);
      }
      if (m.rolled) {
        const qr = new THREE.Quaternion().setFromAxisAngle(UP, m.rolled);
        o.position.sub(pivot).applyQuaternion(qr).add(pivot);
        o.quaternion.premultiply(qr);
      }
      // a falling stool knocks the next one in its way
      if (!m.knocked && m.ang > 0.9 && m.h.kind === 'stool') {
        m.knocked = true;
        const tip = pivot.clone().addScaledVector(m.dir, m.height * 0.9);
        for (const h of this.list) {
          if (h === m.h || h.broken || h.toppled || h.kind !== 'stool') continue;
          const p = h.object.getWorldPosition(_v);
          if (Math.hypot(p.x - tip.x, p.z - tip.z) < 0.55 || Math.hypot(p.x - pivot.x, p.z - pivot.z) < m.height * 0.95 && (p.x - pivot.x) * m.dir.x + (p.z - pivot.z) * m.dir.z > 0) {
            const d = m.dir.clone().applyAxisAngle(UP, this.R.gauss() * 0.3);
            this.topple(h, d.multiplyScalar(1.2));
          }
        }
      }
      if (m.ang >= Math.PI / 2 && Math.abs(m.rollW) < 0.05 && m.t > 0.5 && (!m.barrel || m.barrel.v <= 0)) {
        m.h.rest = { q: m.q0, p: m.p0 };
        this.moving.splice(i, 1);
        // (lying down now: the bullets' world - and what falls on it - finds
        // it where it lies, not standing where it stood; round 2)
        const Gm = this.game;
        if (Gm && Gm.rays && Gm.rays.refresh) { o.updateMatrixWorld(true); o.traverse((x) => { if (x.isMesh) Gm.rays.refresh(x); }); }
        // (and the floor it stood on is free; what it lies across is not)
        const cl = m.h.collider;
        if (cl && cl.r !== undefined) {
          if (cl.x0 === undefined) { cl.x0 = cl.x; cl.z0 = cl.z; }
          const p = o.getWorldPosition(_v); cl.x = p.x; cl.z = p.z;
        }
      }
    }
    if (this.pieces) this.pieces.update(dt);
    this.updateJets(dt);
    this.updateSwings(dt);
    this.updateRopes(dt);
    this.updateSpills(dt);
    for (let i = this.flickers.length - 1; i >= 0; i--) {
      const f = this.flickers[i];
      f.t += dt;
      const on = f.t >= f.dur || Math.sin(f.t * 47 + f.seed) + Math.sin(f.t * 23 + f.seed * 2) > -0.2;
      const k = f.t >= f.dur ? 1 : on ? 1 : 0.15;
      for (const m of f.meshes) { if (m.userData.col0) m.material.color.copy(m.userData.col0).multiplyScalar(k); else if (m.userData.lv0 != null) m.material.uniforms.uLevel.value = m.userData.lv0 * k; if (m.userData.em0) m.material.emissive.copy(m.userData.em0).multiplyScalar(k); }   // [B7] (a shader tube: its level)
      if (f.t >= f.dur) this.flickers.splice(i, 1);
    }
  }

  // a spill over an edge: a thin stream runs down, a pool spreads below
  updateSpills(dt) {
    const G = this.game;
    if (!G) return;
    const r = this.R;
    for (let i = this.spills.length - 1; i >= 0; i--) {
      const s = this.spills[i];
      s.t += dt;
      const k = Math.max(0, Math.min(1, (s.life - s.t) / 1.2)) * Math.min(1, s.t / 0.3);
      s.acc += dt * 60 * k;
      while (s.acc >= 1) {
        s.acc -= 1;
        const p = s.edge.at.clone().addScaledVector(s.edge.dir, 0.02 + r.next() * 0.01);
        G.fx.debris.spawn({ pos: p, vel: s.edge.dir.clone().multiplyScalar(0.25).add(new THREE.Vector3(0, -0.2, 0)), life: 0.6, size: [0.004 + 0.002 * k, 0.03], stretch: 0.04, rot: 0,
          col: s.col.map((c) => c * 1.5), cell: FIRE.EMBER, gravity: 9.8, ground: s.floor + 0.01, fadeOut: 0.05 });
      }
      if (!s.pooled && s.t > 0.35) {
        s.pooled = true;
        const p = s.edge.at.clone().addScaledVector(s.edge.dir, 0.1); p.y = s.floor + 0.003;
        G.fx.decals.pools.add(p, UP.clone(), 0.35 + 0.3 * s.amount, r.next() * 6.28, ATLAS.POOL, s.col, 0.95, { grow: s.life }, G.time ?? 0);
      }
      if (s.t > s.life) this.spills.splice(i, 1);
    }
  }

  // ---- P1: the street answers ---------------------------------------------------------
  // a jet out of a hole: water (a fan that weakens to a dribble), steam (a
  // white jet with a hiss for 4 s), a barrel's leak (a dark dribble)
  jet(at, dir, fluid = 'water', follow = null) {
    const G = this.game;
    const J = { h: this._cur, at: at.clone(), dir: dir.clone().normalize(), fluid, t: 0, acc: 0, follow };
    if (follow) {
      follow.updateWorldMatrix(true, false);
      J.local = follow.worldToLocal(at.clone());
      J.ldir = dir.clone().transformDirection(new THREE.Matrix4().copy(follow.matrixWorld).invert());
    }
    this.jets.push(J);
    while (this.jets.length > 8) this.jets.shift();
    if (G && G.sfx && G.sfx.play) G.sfx.play(fluid === 'steam' ? 'hiss' : 'burst_' + fluid, at);
  }

  updateJets(dt) {
    const G = this.game, r = this.R;
    if (!G) return;
    for (let i = this.jets.length - 1; i >= 0; i--) {
      const J = this.jets[i];
      J.t += dt;
      if (J.follow) { J.at.copy(J.local).applyMatrix4(J.follow.matrixWorld); J.dir.copy(J.ldir).transformDirection(J.follow.matrixWorld); }
      const gy = this.floorAt(J.at);
      if (J.fluid === 'steam') {
        const k = Math.max(0, 1 - J.t / 4);
        if (k <= 0) { this.jets.splice(i, 1); continue; }
        J.acc += dt * 90 * k;
        while (J.acc >= 1) {
          J.acc -= 1;
          // (a jet: narrow at the hole, streaked along its speed, opening
          // and slowing into a drifting cloud)
          const s = r.range(0.035, 0.07);
          G.fx.smoke.spawn({ pos: J.at.clone().addScaledVector(J.dir, r.next() * 0.15), vel: J.dir.clone().multiplyScalar(r.range(5, 8) * (0.4 + 0.6 * k)).add(new THREE.Vector3(r.gauss() * 0.25, r.gauss() * 0.25, r.gauss() * 0.25)),
            life: r.range(0.5, 1.0), size: [s, s], grow: r.range(0.7, 1.2), stretch: 0.06, rot: r.next() * 6.28, spin: r.gauss() * 0.5,
            col: [0.34, 0.34, 0.34], colEnd: [0.26, 0.26, 0.26], alpha: r.range(0.3, 0.45) * (0.5 + 0.5 * k), drag: 2.4, gravity: -0.5, fadeIn: 0.02, fadeOut: 0.7, cell: FIRE.SMOKE[r.int(0, 3)] });
        }
        continue;
      }
      // water: a strong fan first, then a thin dribble that never stops
      const strong = J.fluid === 'leak' ? 0 : Math.max(0, 1 - J.t / 5);
      const rate = J.fluid === 'leak' ? 14 : 18 + 70 * strong;
      J.acc += dt * rate;
      const col = J.fluid === 'leak' ? [0.03, 0.03, 0.03] : [0.42, 0.42, 0.42];
      while (J.acc >= 1) {
        J.acc -= 1;
        const sp = J.fluid === 'leak' ? r.range(0.2, 0.6) : (0.4 + 3.2 * strong) * r.range(0.7, 1.1);
        const fan = J.fluid === 'leak' ? 0.05 : 0.15 + 0.5 * strong;
        const v = J.dir.clone().multiplyScalar(sp).add(new THREE.Vector3(r.gauss() * fan, r.gauss() * fan * 0.5, r.gauss() * fan));
        G.fx.splash.spawn({ pos: J.at.clone(), vel: v, life: r.range(0.4, 0.9), size: [0.01, 0.02 + 0.01 * strong], stretch: 0.03, col, alpha: 0.9, cell: ATLAS.DROP, gravity: 9.8, ground: gy, fadeOut: 0.1 });
      }
      const S = this.stage.street;
      if (S && S.addImpact && r.chance(dt * 6)) S.addImpact(this.stage, J.at.x + J.dir.x * (0.2 + strong), J.at.z + J.dir.z * (0.2 + strong), 0.3);
      if (J.fluid === 'leak' && J.t > 12) this.jets.splice(i, 1);
    }
  }

  // a hanging sign: a pendulum about its brackets; a bracket shot through
  // and it drops to hang by one corner
  updateSwings(dt) {
    for (const S of this.swings) {
      const o = S.h.object;
      S.w += (-9.8 / S.L * Math.sin(S.ang) - S.w * 0.7) * dt;
      S.ang += S.w * dt;
      if (S.corner) {
        S.cw += (-9.8 / S.L * Math.sin(S.cang - S.crest) - S.cw * 1.1) * dt;
        S.cang += S.cw * dt;
      }
      o.position.copy(S.p0);
      o.quaternion.copy(S.q0).multiply(_q.setFromAxisAngle(S.axis, S.ang));
      if (S.corner) {
        const qc = new THREE.Quaternion().setFromAxisAngle(S.cax, S.cang);
        o.position.sub(S.cpivot).applyQuaternion(qc).add(S.cpivot);
        o.quaternion.premultiply(qc);
      }
    }
  }

  // a cut wire: two halves pinned at their posts, each a chain falling and
  // swinging, their free ends spitting sparks for a few seconds
  updateRopes(dt) {
    const G = this.game, r = this.R;
    for (const R of this.ropes) {
      R.t += dt;
      const P = R.pts, Q = R.prev, n = P.length;
      for (let i = 1; i < n; i++) {
        const p = P[i], q = Q[i];
        const vx = (p.x - q.x) * 0.985, vy = (p.y - q.y) * 0.985, vz = (p.z - q.z) * 0.985;
        q.copy(p);
        p.x += vx; p.y += vy - 9.8 * dt * dt; p.z += vz;
        const fy = this.floorAt(p) + 0.01;
        if (p.y < fy) p.y = fy;
      }
      for (let it = 0; it < 8; it++) {
        P[0].copy(R.pin);
        for (let i = 0; i < n - 1; i++) {
          const a = P[i], b = P[i + 1];
          const d = _v.subVectors(b, a);
          const l = d.length() || 1e-6;
          const k = (l - R.seg) / l;
          if (i === 0) b.addScaledVector(d, -k);
          else { a.addScaledVector(d, k * 0.5); b.addScaledVector(d, -k * 0.5); }
        }
      }
      const old = R.mesh.geometry;
      R.mesh.geometry = tube(P.map((p) => p.clone()), R.r, 5, n * 2);
      old.dispose();
      if (G && R.t < 3.5 && r.chance(dt * 14)) {
        const e = P[n - 1];
        for (let k = 0; k < 5; k++) G.fx.sparks.spawn({ pos: e.clone(), vel: new THREE.Vector3(r.gauss() * 1.5, r.range(0.5, 2.5), r.gauss() * 1.5), life: r.range(0.1, 0.35), size: [0.008, 0.012], stretch: 0.03, col: [6, 6, 6], cell: ATLAS.DROP, gravity: 9.8, ground: this.floorAt(e), fadeOut: 0.3 });
      }
    }
  }
}

// ---- how the street's things answer a hit (P1) ----------------------------------------
// (`this` is the Breakables; a return of 'hit' / 'break' ends the hit there)
const HIT = {
  // a hanging sign: it swings on its brackets, slows, stops; a round near an
  // end shoots that bracket through and it drops to hang by one corner.
  // (the object's origin is the brackets' line, its local x along it; opts
  // { w, h }: its board)
  sign(h, { point, dir, power }) {
    const o = h.object;
    let S = this.swings.find((s) => s.h === h);
    if (!S) {
      S = { h, p0: o.position.clone(), q0: o.quaternion.clone(), axis: new THREE.Vector3(1, 0, 0), ang: 0, w: 0, L: Math.max(0.2, (h.opts.h || 0.6) * 0.6), brackets: 2 };
      this.swings.push(S);
    }
    // a push across the board: the swing
    o.updateWorldMatrix(true, false);
    const n = new THREE.Vector3(0, 0, 1).transformDirection(o.matrixWorld);
    S.w += dir.dot(n) * 2.6 * power;
    // near a bracket: it goes
    if (point && S.brackets === 2) {
      const lp = o.worldToLocal(point.clone());
      const W = h.opts.w || 1;
      if (Math.abs(lp.x) > W * 0.32 && lp.y > -0.12) {
        S.brackets = 1;
        const side = Math.sign(lp.x);
        // it now hangs from the other corner: the board turns about the
        // board's normal through that bracket until its middle is under it
        S.corner = true;
        S.cax = n.clone();
        S.cpivot = o.localToWorld(new THREE.Vector3(-side * W / 2, 0, 0));
        S.L = Math.hypot(W / 2, (h.opts.h || 0.6) / 2);
        S.crest = side * Math.atan2(W / 2, (h.opts.h || 0.6) / 2) * (n.y >= 0 ? 1 : -1);
        S.cang = 0; S.cw = 0;
        const G = this.game;
        if (G) {
          const r = this.R;
          for (let k = 0; k < 10; k++) G.fx.sparks.spawn({ pos: point.clone(), vel: new THREE.Vector3(r.gauss() * 2, r.range(0.5, 2), r.gauss() * 2), life: r.range(0.1, 0.3), size: [0.008, 0.012], stretch: 0.03, col: [5, 5, 5], cell: ATLAS.DROP, gravity: 9.8, ground: this.floorAt(point), fadeOut: 0.3 });
          if (G.sfx && G.sfx.play) G.sfx.play('sign_drop', point);
        }
      }
    }
    return 'hit';
  },

  // a pipe: a drain bursts into a fan of water, a steam pipe into a white
  // jet with a hiss (opts.fluid: 'water' | 'steam')
  pipe(h, { point, dir }) {
    if (!point) return 'hit';
    const o = h.object;
    o.updateWorldMatrix(true, false);
    // (out of the pipe's side, back toward the shooter, and down)
    // (a hole tears open to one side of the round's path: the jet squirts
    // across it, not back down the line of fire)
    const across = new THREE.Vector3().crossVectors(dir, UP).normalize().multiplyScalar(this.R.chance(0.5) ? 1 : -1);
    const out = dir.clone().negate().multiplyScalar(0.45).add(across);
    out.y = h.opts.fluid === 'steam' ? 0.15 : -0.25;
    this.jet(point, out.normalize(), h.opts.fluid || 'water', o);
    return 'hit';
  },

  // a barrel: knocked over, it rolls; a hole leaks
  barrel(h, { point, dir, power }) {
    if (point && h.hits <= 3) this.jet(point, dir.clone().negate().setY(-0.3).normalize(), 'leak', h.object);
    if (!h.toppled) {
      this.topple(h, dir.clone().multiplyScalar(1 + power));
      const m = this.moving.find((e) => e.h === h);
      if (m) m.barrel = { v: 1.1 + 0.6 * power * this.R.next(), x: 0 };
    }
    return h.hits >= 6 ? null : 'hit';
  },

  // a crate in a stack: the first rounds knock it (and the ones on it) over
  crate(h, { dir, power }) {
    if (h.toppled) return null;
    this.topple(h, dir.clone().multiplyScalar(0.8 + power));
    // (whatever stands on it goes too)
    const p = h.object.getWorldPosition(new THREE.Vector3());
    for (const o of this.list) {
      if (o === h || o.kind !== 'crate' || o.toppled || o.broken) continue;
      const q = o.object.getWorldPosition(_v);
      // (one standing on it is thrown off and falls: a loose piece now)
      if (Math.hypot(q.x - p.x, q.z - p.z) < 0.5 && q.y > p.y + 0.1) {
        this.snapshot(o);
        o.toppled = true;
        const r = this.R;
        this.field.add(o.object, dir.clone().multiplyScalar(r.range(0.8, 1.6)).add(new THREE.Vector3(r.gauss() * 0.3, r.range(0.5, 1.2), r.gauss() * 0.3)), new THREE.Vector3(r.gauss() * 2, r.gauss() * 2, r.gauss() * 2), { owner: o });
      }
    }
    return 'hit';
  },

  // the newsstand: papers fly up off it and drift down wet
  papers(h, { point, dir }) {
    const r = this.R, o = h.object;
    const at = point || o.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 1, 0));
    const mat = this._paper || (this._paper = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 0.9, side: THREE.DoubleSide }));
    for (let k = 0; k < 7; k++) {
      const g = new THREE.PlaneGeometry(r.range(0.2, 0.34), r.range(0.26, 0.4));
      const m = new THREE.Mesh(g, mat);
      m.position.copy(at).add(new THREE.Vector3(r.gauss() * 0.1, r.range(0, 0.1), r.gauss() * 0.1));
      m.rotation.set(r.next() * 6, r.next() * 6, r.next() * 6);
      m.userData.inkId = 3;
      m.userData.noRay = true;
      this.field.add(m, new THREE.Vector3(r.gauss() * 1.2, r.range(2.5, 4.5), r.gauss() * 1.2).addScaledVector(dir, 0.8), new THREE.Vector3(r.gauss() * 3, r.gauss() * 3, r.gauss() * 3), { paper: true, thin: true, owner: h });
    }
    return 'hit';
  },

  // an awning: it tears and dumps the water it held (a sheet off its edge)
  awning(h, { point, dir }) {
    const G = this.game, r = this.R, o = h.object;
    if (!G || h.dumped) return 'hit';
    h.dumped = true;
    o.updateWorldMatrix(true, false);
    const W = h.opts.w || 2, D = h.opts.d || 1;
    // (its front edge: local +z, along local x)
    for (let k = 0; k < 160; k++) {
      const x = (r.next() - 0.5) * W;
      const p = o.localToWorld(new THREE.Vector3(x, 0, D * r.range(0.3, 0.55)));
      const v = new THREE.Vector3(r.gauss() * 0.2, r.range(-1, 0.2), r.gauss() * 0.2);
      G.fx.splash.spawn({ pos: p, vel: v, life: r.range(0.5, 1.0), size: [0.014, 0.05], stretch: 0.04, col: [0.4, 0.4, 0.4], alpha: 0.9, cell: ATLAS.DROP, gravity: 9.8, ground: this.floorAt(p), fadeOut: 0.1 });
    }
    // the tear: it sags in the middle
    o.scale.y = 1;
    o.rotation.x += 0.12;
    if (point) G.fx.decals.ink(point, dir.clone().negate(), 0.25);
    if (G.sfx && G.sfx.play) G.sfx.play('awning_tear', point || o.position);
    return 'hit';
  },

  // a wire: cut, the two halves fall, swing and spit sparks
  // (opts { a, b }: its ends, world; the object is the wire's mesh)
  wire(h, { point }) {
    if (h.cut) return 'hit';
    h.cut = true;
    h.broken = true;
    const A = h.opts.a, B = h.opts.b;
    const cut = point ? point.clone() : A.clone().lerp(B, 0.5);
    h.object.visible = false;
    h.object.traverse((m) => { if (m.isMesh) this.unSolid(h, m); });
    const mat = this.matOf(h.object);
    for (const [pin, end] of [[A, cut], [B, cut]]) {
      const n = 12;
      const len = pin.distanceTo(end) * 1.02;
      const pts = [], prev = [];
      for (let i = 0; i < n; i++) { const p = pin.clone().lerp(end, i / (n - 1)); p.y -= Math.sin(Math.PI * i / (n - 1)) * 0.05; pts.push(p); prev.push(p.clone()); }
      const mesh = new THREE.Mesh(tube(pts, 0.012, 5, n * 2), mat);
      mesh.userData.inkId = h.object.userData.inkId || 3;
      mesh.userData.noRay = true;
      this.stage.scene.add(mesh);
      this.ropes.push({ h, pin: pin.clone(), pts, prev, seg: len / (n - 1), r: h.opts.r || 0.012, mesh, t: 0 });
    }
    return 'break';
  },

  // a neon letter: it goes out with a pop and a fall of glass and sparks;
  // its neighbours (the other letters within ~0.8 m) flicker
  neon(h, { point }) {
    const G = this.game, r = this.R, o = h.object;
    if (h.out) return 'hit';
    h.out = true;
    // [B7] (the tube's accent material is a shader: its level, not a colour, goes dark)
    o.traverse((m) => { if (m.isMesh) { m.material = m.material.clone(); if (m.material.color) m.material.color.setRGB(0.02, 0.02, 0.025); else if (m.material.uniforms && m.material.uniforms.uLevel) m.material.uniforms.uLevel.value = 0.003; if (m.material.emissive) m.material.emissive.setRGB(0, 0, 0); } });
    const at = point || o.getWorldPosition(new THREE.Vector3());
    if (G) {
      for (let k = 0; k < 18; k++) G.fx.sparks.spawn({ pos: at.clone(), vel: new THREE.Vector3(r.gauss() * 1.4, r.range(0, 1.6), r.gauss() * 1.4), life: r.range(0.15, 0.5), size: [0.008, 0.012], stretch: 0.03, col: [6, 6, 6], cell: ATLAS.DROP, gravity: 9.8, ground: this.floorAt(at), fadeOut: 0.3 });
      for (let k = 0; k < 10; k++) { const s = r.range(0.006, 0.016); G.fx.debris.spawn({ pos: at.clone(), vel: new THREE.Vector3(r.gauss() * 0.6, r.range(-0.2, 0.8), r.gauss() * 0.6), life: r.range(0.6, 1.2), size: [s, s * 0.5], rot: r.next() * 6.28, spin: r.gauss() * 14, col: [0.3, 0.3, 0.3], cell: FIRE.SHARD, gravity: 9.8, ground: this.floorAt(at) + 0.01, fadeOut: 0.12, lit: 2.5, litT: 0.08 }); }
      if (G.sfx && G.sfx.play) G.sfx.play('neon_pop', at);
    }
    const p = o.getWorldPosition(new THREE.Vector3());
    for (const n of this.list) {
      if (n === h || n.kind !== 'neon' || n.out) continue;
      if (n.object.getWorldPosition(_v).distanceTo(p) > 0.9) continue;
      const meshes = [];
      this.snapshot(n);
      n.object.traverse((m) => { if (m.isMesh) { if (!m.userData.ownMat) { m.material = m.material.clone(); m.userData.ownMat = true; m.userData.col0 = m.material.color ? m.material.color.clone() : null; m.userData.lv0 = m.material.uniforms && m.material.uniforms.uLevel ? m.material.uniforms.uLevel.value : null; m.userData.em0 = m.material.emissive ? m.material.emissive.clone() : null; } meshes.push(m); } });
      this.flickers.push({ h: n, meshes, t: 0, dur: r.range(0.8, 1.6), seed: r.next() * 100 });
    }
    return 'break';
  },
};

// ---- how each kind breaks ------------------------------------------------------------
// (`this` is the Breakables; each builds its pieces in the object's frame)
const lath = (prof, segs, p0 = 0, dp = Math.PI * 2) => new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(Math.max(1e-4, r), y)), segs, p0, dp);

// a lathe sector with its broken edges made ragged (vertices near the cut
// edges pushed about: a clean wedge reads as a machined part)
function raggedSector(prof, p0, dp, r, amp) {
  const g = lath(prof, Math.max(3, Math.round(dp * 8)), p0, dp);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(x, z);
    let d = Math.abs(a - p0), d2 = Math.abs(a - (p0 + dp));
    d = Math.min(d, Math.abs(d - Math.PI * 2)); d2 = Math.min(d2, Math.abs(d2 - Math.PI * 2));
    if (Math.min(d, d2) < 0.05 || y > prof[prof.length - 2][1] - 1e-4) {
      const j = (Math.sin(i * 12.9898 + r) * 43758.5453) % 1;
      p.setY(i, y + (j - 0.5) * amp);
    }
  }
  g.computeVertexNormals();
  return g;
}

function flingOut(r, pos, c, dir, k = 1) {
  const out = new THREE.Vector3(c.x - pos.x, 0, c.z - pos.z);
  if (out.lengthSq() < 1e-6) out.set(r.gauss(), 0, r.gauss());
  out.normalize();
  return out.multiplyScalar(r.range(0.6, 1.8) * k).addScaledVector(dir, r.range(0.3, 1.2) * k).add(new THREE.Vector3(0, r.range(0.5, 1.8) * k, 0));
}
const spinOf = (r, k = 1) => new THREE.Vector3(r.gauss(), r.gauss(), r.gauss()).multiplyScalar(r.range(4, 12) * k);

const BREAK = {
  thing(h, { pos, dir }) {
    const G = this.game, r = this.R;
    if (!G) return;
    for (let k = 0; k < 14; k++) {
      const s = r.range(0.02, 0.07);
      G.fx.debris.spawn({
        pos: pos.clone().add(new THREE.Vector3(r.gauss() * 0.05, r.gauss() * 0.05, r.gauss() * 0.05)),
        vel: new THREE.Vector3(r.gauss() * 1.2 + dir.x * 0.6, r.range(0.3, 2.0), r.gauss() * 1.2 + dir.z * 0.6),
        life: r.range(0.8, 1.5), size: [s, s * 0.6], rot: r.next() * 6.28, spin: r.gauss() * 10,
        col: [0.3, 0.3, 0.3], cell: 12, gravity: 9.8, ground: this.floorAt(pos) + 0.02, fadeOut: 0.15, lit: 1.5, litT: 0.1,
      });
    }
  },

  // the bottle: at the shoulder. The neck stays (held: a jagged weapon in the
  // same hand; else it falls), the body goes to curved shards, the liquid
  // bursts
  bottle(h, { pos, dir, held, how }) {
    const o = h.object, r = this.R;
    const S = this.sizeOf(o);
    const R = S.x / 2, H = S.y, sh = H * 0.58;
    const glass = this.shardMat();
    // the neck with a jagged, saw-toothed break round the shoulder
    const neckProf = [[R * 0.72, sh + 0.004], [R * 0.9, sh + 0.02], [0.013, sh + 0.05], [0.012, H - 0.012], [0.014, H - 0.006], [0.012, H], [1e-4, H]];
    const ng = lath(neckProf, 24);
    const p = ng.getAttribute('position');
    for (let i = 0; i < p.count; i++) if (p.getY(i) < sh + 0.006) { const a = Math.atan2(p.getX(i), p.getZ(i)); p.setY(i, p.getY(i) - Math.max(0, Math.sin(a * 5 + 1.3) + 0.4 * Math.sin(a * 13)) * 0.03); }
    ng.computeVertexNormals();
    if (held) {
      // (the neck takes the bottle's place: the same parent, the same hold)
      const neck = new THREE.Mesh(ng, glass);
      neck.name = 'bottleNeck';
      neck.userData.inkId = o.userData.inkId;
      neck.userData.kind = 'bottleNeck';
      neck.userData.size = new THREE.Vector3(S.x, H - sh, S.z);
      neck.userData.weapon = 'broken bottle';
      neck.position.copy(o.position); neck.quaternion.copy(o.quaternion); neck.scale.copy(o.scale);
      if (o.userData.grip) neck.userData.grip = o.userData.grip;
      o.parent.add(neck);
      h.made.push(neck);
      how.neck = neck;
    } else {
      this.piece(o, ng, glass, flingOut(r, pos, o.getWorldPosition(_v), dir, 0.8), spinOf(r));
    }
    // the body's shards: the wall in curved pieces, the base a thick disc
    const body = [[R, 0.004], [R, sh]];
    const n = r.int(5, 8);
    let a = r.next() * 6.28;
    for (let k = 0; k < n; k++) {
      const da = (Math.PI * 2 / n) * r.range(0.7, 1.3);
      const y0 = r.range(0.01, sh * 0.4), y1 = r.range(sh * 0.55, sh);
      const g = raggedSector([[R, y0], [R, y1]], a, da, k, 0.03);
      this.piece(o, g, glass, flingOut(r, pos, o.getWorldPosition(_v), dir, 1.2), spinOf(r, 1.4), { thin: true });
      a += da;
    }
    this.piece(o, lath([[1e-4, 0], [R, 0], [R, 0.02], [R * 0.95, 0.025], [1e-4, 0.022]], 20), glass, flingOut(r, pos, o.getWorldPosition(_v), dir, 0.5), spinOf(r, 0.5));
    void body;
    // the liquid bursts and runs (whisky: amber)
    const key = o.userData.accent || (o.userData.liquid ? 'amber' : null);
    const wp = o.localToWorld(new THREE.Vector3(0, sh * 0.5, 0));
    if (key || o.userData.fill) this.burst(wp, dir, key || 'amber', Math.max(0.3, o.userData.fill ?? 0.7));
    if (o.userData.setFill) try { o.userData.setFill(0); } catch (e) { /* the prop's */ }
    // a spray of glitter
    const G = this.game;
    if (G) for (let k = 0; k < 10; k++) { const s = r.range(0.006, 0.014); G.fx.debris.spawn({ pos: wp.clone(), vel: flingOut(r, pos, wp, dir, 1.5), life: r.range(0.4, 0.9), size: [s, s * 0.6], rot: r.next() * 6.28, spin: r.gauss() * 14, col: [0.32, 0.32, 0.32], cell: FIRE.SHARD, gravity: 9.8, ground: this.floorAt(wp) + 0.01, fadeOut: 0.12, lit: 2.5, litT: 0.08 }); }
  },

  // china: 5 to 8 wedges (the cup's and the mug's handle a piece of its own);
  // thrown flat against a man, the bits rain down
  plate(h, args) { BREAK.china.call(this, h, args, 'plate'); },
  saucer(h, args) { BREAK.china.call(this, h, args, 'saucer'); },
  cup(h, args) { BREAK.china.call(this, h, args, 'cup'); },
  mug(h, args) { BREAK.china.call(this, h, args, 'mug'); },
  china(h, { pos, dir, by }, kind) {
    const o = h.object, r = this.R;
    const S = this.sizeOf(o);
    const R = S.x / 2, H = S.y;
    const mat = this.matOf(o);
    const prof = kind === 'plate' || kind === 'saucer'
      ? [[1e-4, 0], [R * 0.66, 0], [R, H * 0.75], [R, H], [R * 0.66, H * 0.38], [1e-4, H * 0.38]]
      : [[1e-4, 0], [R * 0.7, 0], [R, H * 0.4], [R, H], [R * 0.91, H], [R * 0.86, H * 0.12], [1e-4, H * 0.12]];
    const n = r.int(5, 8);
    let a = r.next() * 6.28;
    const rain = by === 'body';
    for (let k = 0; k < n; k++) {
      const da = (Math.PI * 2 / n) * r.range(0.65, 1.35);
      const g = raggedSector(prof, a, Math.min(da, Math.PI * 2 - 0.01), k * 3.1, H * 0.2);
      const vel = rain ? new THREE.Vector3(r.gauss() * 1.2, r.range(-0.5, 1.2), r.gauss() * 1.2).addScaledVector(dir, -0.6) : flingOut(r, pos, o.getWorldPosition(_v), dir, 1);
      this.piece(o, g, mat, vel, spinOf(r, 1.2), { thin: true });
      a += da;
    }
    if (kind === 'cup' || kind === 'mug') {
      const hg = new THREE.TorusGeometry(H * 0.28, R * 0.12, 6, 12, Math.PI).rotateZ(-Math.PI / 2).translate(R, H * 0.5, 0);
      this.piece(o, hg, mat, flingOut(r, pos, o.getWorldPosition(_v), dir, 1), spinOf(r));
    }
  },

  // the tumbler: the heavy base survives, the wall goes to bits
  tumbler(h, { pos, dir }) {
    const o = h.object, r = this.R;
    const S = this.sizeOf(o);
    const R = S.x / 2, H = S.y;
    const mat = this.shardMat();
    this.piece(o, lath([[1e-4, 0], [R, 0], [R, H * 0.22], [R * 0.9, H * 0.24], [R * 0.88, H * 0.16], [1e-4, H * 0.16]], 24), mat, flingOut(r, pos, o.getWorldPosition(_v), dir, 0.3), spinOf(r, 0.3));
    const n = r.int(8, 12);
    let a = 0;
    for (let k = 0; k < n; k++) {
      const da = Math.PI * 2 / n * 2 * r.range(0.6, 1.4);
      const y0 = H * r.range(0.22, 0.5), y1 = y0 + H * r.range(0.25, 0.5);
      this.piece(o, raggedSector([[R, y0], [R, Math.min(H, y1)]], a, da, k, 0.012), mat, flingOut(r, pos, o.getWorldPosition(_v), dir, 1.3), spinOf(r, 1.5), { thin: true });
      a += da * 0.55;
    }
    const wp = o.localToWorld(new THREE.Vector3(0, H * 0.4, 0));
    const fill = o.userData.fill ?? 0;
    if (fill > 0.02) this.burst(wp, dir, o.userData.accent || 'amber', fill * 0.6);
    if (o.userData.setFill) try { o.userData.setFill(0); } catch (e) { /* the prop's */ }
  },

  // the stool: the seat comes off the column (and rolls on its rim), the
  // column bends, the base rolls away in an arc
  stool(h, { pos, dir }) {
    const o = h.object, r = this.R;
    const S = this.sizeOf(o);
    const H = S.y, R = S.x / 2;
    const metal = this.matOf(o), seatMat = this.matOf(o, (m) => m !== o.children[0]) || metal;
    const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    // the seat: a thick cushion disc
    const seat = lath([[1e-4, H - 0.095], [R * 0.95, H - 0.095], [R, H - 0.075], [R, H - 0.03], [R * 0.92, H - 0.005], [1e-4, H]], 32);
    this.piece(o, seat, seatMat, dir.clone().multiplyScalar(r.range(1.2, 2.2)).add(new THREE.Vector3(0, r.range(1.2, 2.2), 0)), spinOf(r, 0.8), { roll: true, rad: R });
    // the column: bent at a kink a third of the way up
    const kink = H * r.range(0.3, 0.45), bend = r.range(0.28, 0.5);
    const top = new THREE.Vector3(0, H - 0.1, 0).applyAxisAngle(new THREE.Vector3(side.x, 0, side.z), 0);
    const pts = [new THREE.Vector3(0, 0.08, 0), new THREE.Vector3(0, kink, 0),
      new THREE.Vector3(0, kink, 0).add(new THREE.Vector3(0, H - 0.1 - kink, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), bend * 0.5)),
      new THREE.Vector3(0, kink, 0).add(new THREE.Vector3(0, H - 0.1 - kink, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), bend))];
    void top;
    const col = tube(pts, 0.032, 10, 24);
    this.piece(o, col, metal, dir.clone().multiplyScalar(r.range(0.4, 1)).add(new THREE.Vector3(0, r.range(0.5, 1.2), 0)), spinOf(r, 0.5));
    // the base: a heavy disc that rolls away on its rim in an arc
    const base = lath([[1e-4, 0], [R, 0], [R, 0.02], [R * 0.35, 0.06], [R * 0.18, 0.1], [1e-4, 0.1]], 32);
    this.piece(o, base, metal, dir.clone().multiplyScalar(r.range(1.4, 2.4)).addScaledVector(side, r.gauss() * 0.6), new THREE.Vector3(), { roll: true, rad: R, upright: true });
  },

  // the booth's table: splits along its length, the halves fold in
  table(h, { pos, dir }) {
    const o = h.object, r = this.R;
    o.updateWorldMatrix(true, true);
    const box = new THREE.Box3();
    o.traverse((m) => { if (m.isMesh && m !== o && m.parent === o) return; if (m.isMesh) { m.geometry.computeBoundingBox(); box.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld)); } });
    const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const alongX = size.x >= size.z;
    const L = alongX ? size.x : size.z, W = alongX ? size.z : size.x;
    const mat = this.matOf(o);
    const ax = alongX ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
    for (const s of [-1, 1]) {
      // each half hinges on its outer end; its inner end drops to the floor
      const geo = roundedBox(alongX ? L / 2 - 0.01 : W, size.y, alongX ? W : L / 2 - 0.01, 0.01, 1);
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(c).addScaledVector(ax, s * L / 4);
      m.userData.inkId = o.userData.inkId;
      m.userData.noRay = true;
      const outer = c.clone().addScaledVector(ax, s * L / 2);
      const fall = Math.asin(Math.min(0.95, (c.y - this.floorAt(c)) / (L / 2)));
      this.field.addHinge(m, outer, new THREE.Vector3().crossVectors(ax, UP).multiplyScalar(s), fall * r.range(0.9, 1.0), h);
    }
    // the leg goes over
    o.children.forEach((ch) => {
      if (!ch.isMesh) return;
      const g = ch.geometry.clone();
      this.piece(ch, g, ch.material, dir.clone().multiplyScalar(0.5).add(new THREE.Vector3(0, 0.3, 0)), spinOf(r, 0.3));
    });
    void pos;
  },

  // the pie case: its glass shatters as panes do; what is in it slides out
  pieCase(h, { pos, dir }) {
    const o = h.object, G = this.game, r = this.R;
    const glass = this.stage.glass;
    o.updateWorldMatrix(true, true);
    // the glass: the meshes that say so (userData.glass), else the case's box
    const panes = [];
    o.traverse((m) => { if (m.isMesh && m.userData.glass) panes.push(m); });
    const box = new THREE.Box3().setFromObject(o);
    const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
    const faces = panes.length ? panes.map((m) => {
      m.geometry.computeBoundingBox();
      const b = m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld);
      const bs = b.getSize(new THREE.Vector3()), bc = b.getCenter(new THREE.Vector3());
      const thin = bs.x < bs.z ? (bs.x < bs.y ? 'x' : 'y') : (bs.z < bs.y ? 'z' : 'y');
      m.visible = false;
      this.unSolid(h, m);
      return { c: bc, n: thin === 'x' ? new THREE.Vector3(1, 0, 0) : thin === 'z' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0), w: thin === 'x' ? bs.z : bs.x, h: thin === 'y' ? bs.z : bs.y };
    }) : [
      { c: c.clone().add(new THREE.Vector3(dir.x < 0 ? s.x / 2 : -s.x / 2, 0, 0)), n: new THREE.Vector3(1, 0, 0), w: s.z, h: s.y },
      { c: c.clone().add(new THREE.Vector3(0, s.y / 2, 0)), n: new THREE.Vector3(0, 1, 0), w: s.x, h: s.z },
    ];
    for (const f of faces) {
      const p = glass.addPane({ centre: f.c, normal: f.n, w: Math.max(0.1, f.w), h: Math.max(0.1, f.h), tag: 'pieCase' });
      h.panes.push(p);
      glass.shatter(p, { dir, power: 1.2, at: pos });
    }
    // what is in it (anything with a prop kind) slides out onto the counter
    // and off it
    const inside = [];
    o.traverse((m) => { if (m !== o && m.userData && m.userData.kind && m.userData.kind !== 'glass') inside.push(m); });
    for (const m of inside) {
      const wp = m.getWorldPosition(new THREE.Vector3()), wq = m.getWorldQuaternion(new THREE.Quaternion());
      this.stage.scene.attach(m);
      m.position.copy(wp); m.quaternion.copy(wq);
      this.field.add(m, dir.clone().multiplyScalar(r.range(0.6, 1.4)).add(new THREE.Vector3(r.gauss() * 0.2, r.range(0.1, 0.5), r.gauss() * 0.2)), spinOf(r, 0.2), { slide: true, owner: h });
    }
    void G;
  },

  // (the jukebox is never destroyed: Breakables.dent)
  jukebox() {},
};

// ---- the pieces ---------------------------------------------------------------------------
// Rigid bits: they fly, bounce (a tick), roll if round, settle on whatever is
// under them (found by the bullets' rays: a counter, a table, the floor),
// lie flat and stay. A hinge piece (a table half) turns about its outer edge
// until its inner end meets the floor.
export class PieceField {
  constructor(stage, rng) {
    this.stage = stage;
    this.rng = rng;
    this.live = [];
    this.rest = [];
  }

  // (round 2: what is under it, shown - a knocked-over stool's old seat or a
  // broken table is no support - found again every few centimetres, never
  // kept from where it was thrown: glass does not lie on the air)
  groundUnder(p) { return supportUnder(this.stage, p); }

  add(m, vel, spin, opts = {}) {
    if (!m.parent) this.stage.scene.add(m);
    let rad = 0.05;
    if (m.geometry) { if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere(); rad = m.geometry.boundingSphere.radius * m.scale.x; }
    else { const b = new THREE.Box3().setFromObject(m); rad = Math.max(0.02, b.getSize(new THREE.Vector3()).length() / 2); }
    const p = { mesh: m, vel: vel.clone(), spin: spin.clone(), rad, t: 0, ground: this.groundUnder(m.position), gx: m.position.x, gz: m.position.z, bounces: 0, ...opts };
    this.live.push(p);
    while (this.live.length > LIVE_CAP) this.settle(this.live.shift(), true);
    return p;
  }

  addHinge(m, pivot, axis, angle, owner = null) {
    this.stage.scene.add(m);
    this.live.push({ mesh: m, owner, hinge: { pivot, axis: axis.normalize(), ang: 0, w: 0, max: angle, p0: m.position.clone(), q0: m.quaternion.clone() }, t: 0 });
  }

  // take away the pieces that match (flying or lying); a mesh in `keep` (a
  // thing's own, put back by restore) stays in the scene -> how many went
  drop(pred, keep = null) {
    let n = 0;
    for (const L of [this.live, this.rest]) {
      for (let i = L.length - 1; i >= 0; i--) {
        const p = L[i];
        if (!pred(p)) continue;
        L.splice(i, 1);
        n++;
        if (keep && keep.has(p.mesh)) continue;
        if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
        if (p.mesh.geometry && p.owner) p.mesh.geometry.dispose();
      }
    }
    return n;
  }

  settle(p, now = false) {
    const m = p.mesh;
    if (!now) {
      // lie on its broadest side: the local axis nearest the vertical goes
      // exactly vertical
      const axes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)].map((a) => a.applyQuaternion(m.quaternion));
      let best = axes[0];
      for (const a of axes) if (Math.abs(a.y) > Math.abs(best.y)) best = a;
      // (a disc - a seat, a base, a plate's wedge - lies on its face)
      if (p.roll || p.thin) best = axes[1];
      const tgt = new THREE.Vector3(0, Math.sign(best.y) || 1, 0);
      m.quaternion.premultiply(_q.setFromUnitVectors(best.clone().normalize(), tgt));
      // (its lowest point on what is under it, exactly: a piece lies on the
      // counter or the floor, never a centimetre over it)
      this.seat(p);
    }
    if (p.vel) p.vel.set(0, 0, 0);
    this.rest.push(p);
    while (this.rest.length > REST_CAP) { const q = this.rest.shift(); q.mesh.parent && q.mesh.parent.remove(q.mesh); }
  }

  // what a piece lies on: the highest support under its footprint (its
  // middle and four points toward its edges: a sliver across a fallen
  // stool's column lies on the column)
  restSupport(p, b = null) {
    const m = p.mesh;
    if (!b) { m.updateMatrixWorld(true); b = _box3.setFromObject(m, true); }
    const hx = (b.max.x - b.min.x) * 0.35, hz = (b.max.z - b.min.z) * 0.35;
    let g = -Infinity;
    for (const [ox, oz] of [[0, 0], [hx, 0], [-hx, 0], [0, hz], [0, -hz]]) g = Math.max(g, supportUnder(this.stage, _c3.set(m.position.x + ox, b.max.y, m.position.z + oz)));
    return g;
  }

  // (about to land: is what it lands on really there? a fresh look; if the
  // floor is further down, it falls on)
  landOn(p) {
    const g = this.groundUnder(p.mesh.position);
    p.gx = p.mesh.position.x; p.gz = p.mesh.position.z; p.gT = 6;
    if (g < p.ground - 0.02) { p.ground = g; return false; }
    p.ground = g;
    return true;
  }

  // set a piece down on the support under it by its lowest vertex
  seat(p) {
    const m = p.mesh;
    m.updateMatrixWorld(true);
    const b = _box3.setFromObject(m, true);
    if (!Number.isFinite(b.min.y)) return;
    const g = this.restSupport(p, b);
    p.ground = g;
    m.position.y += g + 0.002 - b.min.y;
  }

  update(dt) {
    const r = this.rng;
    // (a piece lying on something that is gone - a stool knocked over, a
    // table broken - falls again: a few looked at each step, round the list)
    if (this.rest.length) {
      for (let k = 0; k < 6; k++) {
        this._ri = ((this._ri || 0) + 1) % this.rest.length;
        const p = this.rest[this._ri];
        if (p.hinge || !p.mesh.parent) continue;
        const m = p.mesh;
        m.updateMatrixWorld(true);
        const b = _box3.setFromObject(m, true);
        const g = this.restSupport(p, b);
        if (b.min.y - g > 0.006) {
          this.rest.splice(this._ri, 1);
          p.vel = new THREE.Vector3(0, 0, 0); p.spin = new THREE.Vector3(0, 0, 0); p.gT = 0; p.bounces = 3; p.rolling = null;
          this.live.push(p);
          if (!this.rest.length) break;
        }
      }
    }
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i], m = p.mesh;
      p.t += dt;
      if (p.hinge) {
        const H = p.hinge;
        H.w += 9.8 * 1.5 / 0.8 * Math.cos(H.ang) * dt;
        H.ang = Math.min(H.max, H.ang + H.w * dt);
        _q.setFromAxisAngle(H.axis, H.ang);
        m.position.copy(H.p0).sub(H.pivot).applyQuaternion(_q).add(H.pivot);
        m.quaternion.copy(H.q0).premultiply(_q);
        if (H.ang >= H.max) { this.live.splice(i, 1); this.rest.push(p); }
        continue;
      }
      if (p.rolling) {
        // on its rim: along its heading, turning, slowing, then it falls flat
        const R = p.rolling;
        R.speed = Math.max(0, R.speed - dt * 0.9);
        R.dir.applyAxisAngle(UP, R.turn * dt);
        m.position.addScaledVector(R.dir, R.speed * dt);
        // (a wall, the counter's foot, a booth stop it: it bounces off, slowed -
        // it never rolls on through them)
        const Cl = this.stage.colliders;
        if (Cl && Cl.resolve && this.stage.breakables.rimFix) {
          const q = _c3.set(m.position.x, 0, m.position.z);
          Cl.resolve(q, Math.min(0.12, p.rad * 0.5));
          if (Math.hypot(q.x - m.position.x, q.z - m.position.z) > 1e-4) { m.position.x = q.x; m.position.z = q.z; R.dir.negate(); R.speed *= 0.35; }
        }
        R.ang += R.speed / Math.max(0.05, p.rad) * dt;
        // (the lean grows by its size, whichever way it goes: with a turn to the
        // left the old sum met zero at -0.375 rad and the disc stood on its rim
        // for ever - never lying down)
        if (R.speed < 0.35) R.lean += dt * (1.5 + (this.stage.breakables.rimFix ? Math.abs(R.lean) : R.lean) * 4) * Math.sign(R.turn || 1);
        const axle = new THREE.Vector3(-R.dir.z, 0, R.dir.x);
        const q0 = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axle);
        m.quaternion.copy(new THREE.Quaternion().setFromAxisAngle(R.dir, R.lean)).multiply(new THREE.Quaternion().setFromAxisAngle(axle, R.ang)).multiply(q0);
        m.position.y = p.ground + p.rad * Math.cos(Math.min(Math.PI / 2, Math.abs(R.lean))) + 0.02;
        if (Math.abs(R.lean) >= Math.PI / 2 - 0.05) { this.live.splice(i, 1); this.settle(p); }
        continue;
      }
      if (p.paper) {
        // a sheet of paper: it floats, side-slips and flutters down
        p.vel.y = Math.max(p.vel.y - 3 * dt, -0.9);
        p.vel.x *= 1 - 1.2 * dt; p.vel.z *= 1 - 1.2 * dt;
        p.vel.x += Math.sin(p.t * 5 + p.rad * 40) * 1.4 * dt;
        p.vel.z += Math.cos(p.t * 4 + p.rad * 30) * 1.4 * dt;
      } else p.vel.y -= 9.8 * dt;
      m.position.addScaledVector(p.vel, dt);
      const w = p.spin.length();
      if (w > 1e-4) m.quaternion.premultiply(_q.setFromAxisAngle(_ax.copy(p.spin).divideScalar(w), w * dt));
      // (moved over the floor: find what is under it again)
      const near = m.position.y - (p.ground || 0) < 0.35;
      if (Math.hypot(m.position.x - p.gx, m.position.z - p.gz) > (near ? 0.04 : 0.25) || (p.gT = (p.gT || 0) - 1) < 0) { p.gT = near ? 6 : 12; p.gx = m.position.x; p.gz = m.position.z; p.ground = this.groundUnder(m.position); }
      const low = p.thin ? p.rad * 0.3 : p.rad * 0.55;
      if (m.position.y - low <= p.ground && p.vel.y < 0 && this.landOn(p)) {
        m.position.y = p.ground + low;
        if (p.roll && p.bounces === 0 && Math.hypot(p.vel.x, p.vel.z) > 0.6) {
          // a disc lands on its rim and rolls
          const d = new THREE.Vector3(p.vel.x, 0, p.vel.z).normalize();
          p.rolling = { dir: d, speed: Math.hypot(p.vel.x, p.vel.z) * 0.8, ang: 0, lean: 0, turn: r.range(0.8, 1.8) * (r.chance(0.5) ? 1 : -1) };
          continue;
        }
        if (p.vel.y < -1.4 && p.bounces < 3) {
          p.vel.y *= -0.28; p.vel.x *= 0.5; p.vel.z *= 0.5; p.spin.multiplyScalar(0.4); p.bounces++;
          continue;
        }
        this.live.splice(i, 1);
        m.position.y = p.ground + (p.thin ? 0.004 : low * 0.6);
        this.settle(p);
      }
    }
  }
}

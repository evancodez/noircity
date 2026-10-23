import * as THREE from 'three';
import { mergeGeos, lathe } from '../../../props/lib.js';

// The interior kit's door (lane O5; the killhouse's door made the kit's,
// src/stages/killhouse/door.js): a panelled leaf on a hinge, in a room's
// frame. It swings away from whoever opens it (a push door is pushed), it
// stops on a man in its way (it never passes through anyone), it may be
// locked (a rattle, and the jamb shakes), glazed (a dark pane in its top),
// or double (two leaves). Its collider is a thin box along the leaf, moved
// as it swings; its meshes are bullets' solids (refreshed as it moves).
//   d = makeDoor(kit, { x, z, axis: 'x' | 'z', w, h, y, swing: 1 | -1 | 0
//                       (0: either way), locked, glass, double, lvl, name, closer })
//   d.open(by?)  d.close()  d.toggle(by)  d.rattle()  d.shut  d.open01  d.update(dt)
//   d.centre (world)  d.locked  d.lvl  d.moving
// axis: the wall's direction in the room's frame ('x': a wall along x - the
// leaf, shut, lies along x). The hinge is at the lower end (x0 or z0), the
// leaf runs w along the axis.
const THICK = 0.05;
const OPEN = 1.6;

function leafGeos(w, h, glass) {
  const t = THICK, st = 0.11, out = [];
  // (the leaf in its own frame: hinge edge at the origin, along +x, faces +-z)
  const B = (x0, x1, y0, y1, th = t) => out.push(new THREE.BoxGeometry(x1 - x0, y1 - y0, th).translate((x0 + x1) / 2, (y0 + y1) / 2, 0));
  B(0, st, 0, h); B(w - st, w, 0, h);
  B(st, w - st, h - 0.13, h);
  B(st, w - st, 0, 0.24);
  if (glass) {
    B(st, w - st, h * 0.52 - 0.1, h * 0.52);
    B(st, w - st, 0.24, h * 0.52 - 0.1, t * 0.55);
  } else {
    B(st, w - st, 0.98, 1.1);
    B(st, w - st, 0.24, 0.98, t * 0.55);
    B(st, w - st, 1.1, h - 0.13, t * 0.55);
  }
  return out;
}
function knobGeos(w) {
  const out = [];
  for (const s of [-1, 1]) {
    const k = lathe([[0.0001, 0], [0.028, 0], [0.028, 0.006], [0.01, 0.012], [0.009, 0.042], [0.022, 0.052], [0.026, 0.066], [0.018, 0.078], [0.0001, 0.08]], 14);
    k.rotateX(s * Math.PI / 2).translate(w - 0.08, 1.0, s * 0.02);
    out.push(k);
  }
  return out;
}

export function makeDoor(kit, spec) {
  const { F, mats } = kit;
  const stage = kit.stage;
  const w0 = spec.w ?? 1.0, h = spec.h ?? 2.05, y = spec.y ?? kit.FLOOR;
  const leaves = spec.double ? 2 : 1;
  const lw = (w0 - 0.01) / leaves;
  const along = spec.axis === 'z';
  // the leaves' hinges (local), the second at the far end turned round
  const L = [];
  const root = new THREE.Group();
  root.matrixAutoUpdate = false; root.matrix.copy(F.M);
  // (a street door is part of the street: drawn while the room behind it is not)
  (spec.outer ? kit.outer : kit.group).add(root);
  const geo = mergeGeos(leafGeos(lw, h, spec.glass));
  const kg = mergeGeos(knobGeos(lw));
  for (let i = 0; i < leaves; i++) {
    const hinge = new THREE.Group();
    // (local: a wall along x at z, the hinge at x; along z: at x, the hinge at z)
    const s0 = i === 0 ? 0.005 : w0 - 0.005;
    if (along) hinge.position.set(spec.x, y, spec.z + s0);
    else hinge.position.set(spec.x + s0, y, spec.z);
    // (the leaf's own +x runs along the wall from its hinge; the second leaf the other way)
    const base = (along ? -Math.PI / 2 : 0) + (i === 1 ? Math.PI : 0);
    hinge.rotation.y = base;
    root.add(hinge);
    const leaf = new THREE.Mesh(geo, mats[spec.mat || 'wood']);
    leaf.castShadow = true; leaf.receiveShadow = true;
    leaf.userData.inkId = kit.id;
    leaf.userData.cover = { kind: 'thin', name: 'door' };
    hinge.add(leaf);
    const knob = new THREE.Mesh(kg, mats.chrome);
    knob.userData.inkId = kit.id; knob.userData.noRay = true;
    hinge.add(knob);
    if (spec.glass) {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(lw - 0.24, h * 0.42 - 0.18), mats.glass);
      pane.position.set(lw / 2, h * 0.52 + (h * 0.42) / 2 + 0.02, 0);
      pane.userData.inkId = kit.id; pane.userData.noRay = true;
      const back = pane.clone(); back.rotation.y = Math.PI;
      hinge.add(pane, back);
    }
    // the collider: a box whose grid cells cover the whole swing (so a
    // resolve near it always finds it), its size set as it stands
    const hw = F.w(hinge.position.x, hinge.position.z);
    const col = stage.colliders.addBox(hw.x, hw.z, lw + 0.1, lw + 0.1, 0, 'door');
    col.lvl = spec.lvl ?? null;
    kit.cols.push(col);
    L.push({ hinge, leaf, base, col, sgn: i === 0 ? 1 : -1 });
  }
  const mid = along ? F.v(spec.x, y + 1.0, spec.z + w0 / 2) : F.v(spec.x + w0 / 2, y + 1.0, spec.z);
  const D = {
    name: spec.name || 'door', spec, leaves: L, w: w0, lw, h, angle: 0, target: 0, speed: 3.2, moving: false,
    locked: !!spec.locked, lvl: spec.lvl ?? null, centre: mid, jolt: 0, openT: 0, kit,
    // (the normal of the wall, world: the side a point is on)
    nrm: (() => { const d = along ? F.dir(1, 0) : F.dir(0, 1); return d; })(),
    get shut() { return Math.abs(this.angle) < 0.06; },
    get open01() { return Math.min(1, Math.abs(this.angle) / OPEN); },
    side(p) { return Math.sign((p.x - mid.x) * this.nrm.x + (p.z - mid.z) * this.nrm.z) || 1; },
    open(by = null, speed = 3.4) {
      if (this.locked) { this.rattle(); return false; }
      // (away from the one who opens it: a door that swings one way only swings that way)
      let sg = spec.swing || 0;
      // (an 'x' wall's leaf: + swings it to local -z; a 'z' wall's: + to local +x)
      if (!sg) sg = by ? (along ? -1 : 1) * this.side(by) : 1;
      this.target = sg * OPEN;
      this.speed = speed;
      if (!this.moving && this.shut) kit.sfx('c2_doorOpen', mid, 3);
      this.moving = true;
      this.openT = 0;
      return true;
    },
    close(speed = 2.4) { if (this.target !== 0) { this.target = 0; this.speed = speed; this.moving = true; } },
    toggle(by) { if (this.shut || this.target === 0) return this.open(by); this.close(); return true; },
    rattle() { kit.sfx('c2_doorRattle', mid, 3); this.jolt = 0.25; },
    // the leaf i's direction (world) at angle a, from its hinge
    dirOf(l, a) {
      const r = l.base + a * l.sgn;
      // (a group's local +x rotated by r about y: (cos r, -sin r), then the frame's)
      return F.dir(Math.cos(r), -Math.sin(r));
    },
    hingeW(l) { return F.w(l.hinge.position.x, l.hinge.position.z); },
    apply() {
      for (const l of L) {
        l.hinge.rotation.y = l.base + this.angle * l.sgn;
        const p = this.hingeW(l), d = this.dirOf(l, this.angle);
        const c = l.col;
        c.cx = p.x + d.x * lw / 2; c.cz = p.z + d.z * lw / 2;
        // (the box's own x axis in the world is (c, -s): along the leaf)
        const ang = Math.atan2(-d.z, d.x);
        c.angle = ang; c.c = Math.cos(ang); c.s = Math.sin(ang);
        c.hx = lw / 2; c.hz = THICK / 2 + 0.03;
      }
      root.updateMatrixWorld(true);
      const G = stage.game;
      if (G && G.rays) for (const l of L) G.rays.refresh(l.leaf);
    },
    // the leaf's distance from a point at angle a (plan)
    dist(l, a, px, pz) {
      const p = this.hingeW(l), d = this.dirOf(l, a);
      const t = Math.max(0, Math.min(lw, (px - p.x) * d.x + (pz - p.z) * d.z));
      return Math.hypot(px - (p.x + d.x * t), pz - (p.z + d.z * t));
    },
    // would the leaves, swinging to a, cut into someone? (they stop on him)
    blocked(a) {
      const G = stage.game;
      if (!G) return false;
      const C = G.controller;
      const who = [];
      if (!C.frozen) who.push([C.pos.x, C.pos.z, 0.34]);
      for (const h of stage.hoods.list) if (h.alive) who.push([h.pos.x, h.pos.z, 0.3]);
      for (const c of stage.cast.list) if (c.own && c.alive && c.pos) who.push([c.pos.x, c.pos.z, 0.3]);
      for (const l of L) for (const [x, z, r] of who) { const d1 = this.dist(l, a, x, z); if (d1 < r && d1 < this.dist(l, this.angle, x, z) - 1e-4) return true; }
      return false;
    },
    update(dt) {
      if (!this._live) { this._live = true; this.apply(); }
      if (this.jolt > 0) {
        this.jolt -= dt;
        const k = Math.max(0, this.jolt) * Math.sin(this.jolt * 90) * 0.02;
        for (const l of L) l.hinge.rotation.y = l.base + (this.angle + k) * l.sgn;
        if (this.jolt <= 0) for (const l of L) l.hinge.rotation.y = l.base + this.angle * l.sgn;
      }
      if (!this.shut && !this.moving) this.openT += dt;
      if (!this.moving) return;
      const e = this.target - this.angle;
      const step = Math.sign(e) * Math.min(Math.abs(e), this.speed * dt * (0.4 + Math.min(1, Math.abs(e) * 2.5)));
      const next = this.angle + step;
      if (this.blocked(next)) { this.moving = false; return; }
      this.angle = next;
      if (Math.abs(this.target - this.angle) < 1e-3) {
        this.angle = this.target; this.moving = false;
        if (this.target === 0) kit.sfx('c2_doorShut', mid, 3);
      }
      this.apply();
    },
  };
  D.apply();
  kit.doors.push(D);
  return D;
}

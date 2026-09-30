import * as THREE from 'three';
import { Lamps } from '../../../world/Lamps.js';
import { allocInkId, markFigure } from '../../../render/layers.js';
import { lathe, mergeGeos } from '../../../props/lib.js';
import { PIER } from '../site.js';
import { pierMats } from '../kit.js';

// Pier 9's light (lane B6). A Lamps (world/Lamps.js) without the block's
// posts: the pooled real spot lights (the nearest seven lamps that are on;
// two of them with shadows, given only to the lamps that hang still - a
// torch's moving shadow map would be re-rendered every frame), and the
// methods the reactive world calls (react, hit, setOn). Built early (order
// 15) so the other parts can hang lamps of their own on it.
//   lamps.hang(name, head, { half, drop, row, strength })  a hanging work
//        lamp on a long flex from the trusses (an enamel shade, a bulb, its
//        cone in the dust); it can swing (lamp.swing(v))
//   lamps.torch(tag)   a moving beam (a man's torch or lantern): its cone,
//        its registry entry (exposure, rain, rim) and a share of the pool;
//        lamp.aim(pos, dir) every step
//   lamps.byName       the hanging lamps by name; lamps.rows: row -> [lamps]
//   lamps.dim(lamp, on, { flicker })   switched off or on (the knife switch)
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _dn = V(0, -1, 0);

export class PierLamps extends Lamps {
  // (world/Lamps.js builds the block's posts in its constructor: this one
  // builds only what every stage's lamps need)
  static make(stage) {
    const L = Object.create(PierLamps.prototype);
    L.world = stage;
    L.lamps = [];
    L.rng = stage.rng.fork(41);
    L._poolTimer = 0;
    L._fwd = new THREE.Vector3();
    L.byName = new Map();
    L.rows = new Map();
    L.torches = [];
    L.buildPool();
    // two shadowed slots, five plain: a shadow map for each of the two
    // still lamps nearest the eye
    const third = L.pool.find((p) => p.shadow && p !== L.pool[0] && p !== L.pool[1]);
    if (third) { third.shadow = false; third.spot.castShadow = false; }
    return L;
  }

  // the knife switch's row going dark (a short dying flicker), or coming on
  dim(lamp, on, { flicker = 0.25 } = {}) {
    if (on) { lamp.on = true; lamp.dying = null; return; }
    lamp.dying = { t: 0, len: flicker };
  }

  hang(name, head, { half = 0.52, row = null, strength = 1, drop = null } = {}) {
    const S = this.world, M = pierMats();
    const top = PIER.trussY - 0.1;
    const cord = drop ?? (top - head.y - 0.2);
    const pivot = new THREE.Group();
    pivot.position.set(head.x, head.y + 0.2 + cord, head.z);
    S.scene.add(pivot);
    const id = allocInkId();
    const mk = (geo, mat, cast = false) => { const m = new THREE.Mesh(geo, mat); m.userData.inkId = id; m.castShadow = cast; m.receiveShadow = false; return m; };
    // the flex and the shade: a wide enamel dish (a work lamp's)
    const flex = new THREE.CylinderGeometry(0.008, 0.008, cord, 6).translate(0, -cord / 2, 0);
    const shade = lathe([[0.03, 0.2], [0.06, 0.17], [0.1, 0.12], [0.2, 0.05], [0.3, 0.01], [0.34, -0.005], [0.33, -0.012]].reverse(), 40).translate(0, -cord - 0.2, 0);
    const inner = lathe([[0.04, 0.18], [0.1, 0.11], [0.2, 0.04], [0.31, 0.0]], 36).translate(0, -cord - 0.2, 0);
    const iron = mk(flex, M.iron);
    const sh = mk(shade, M.shade, true);
    const inn = mk(inner, M.lampInner);
    const bulb = mk(mergeGeos([new THREE.SphereGeometry(0.06, 18, 10).translate(0, 0.08, 0), new THREE.CircleGeometry(0.07, 24).rotateX(Math.PI / 2).translate(0, 0.02, 0)]).translate(0, -cord - 0.2, 0), M.bulb);
    markFigure(sh);
    for (const m of [iron, sh, inn, bulb]) { m.userData.noRay = m !== sh; pivot.add(m); }
    const lamp = this.addCustom({ head: head.clone(), axis: _dn.clone(), height: head.y - 0.05, half, real: true, bulb, fadeEnd: 0.8, edgeSoft: 0.45, strength, tag: 'hang' });
    // (the pool: a white disc on the boards some 4 m across, black between)
    if (lamp.light) { lamp.light.intensity = 95 * strength; lamp.light.angle = Math.min(1.1, half * 1.45); lamp.light.penumbra = 0.6; lamp.light.distance = head.y * 2.4 + 2; }
    lamp.entry.range = head.y + 0.4;
    Object.assign(lamp, { name, row, pivot, cordLen: cord + 0.2, sw: { x: 0, z: 0, vx: 0, vz: 0 }, hangAt: pivot.position.clone(), aim0: _dn.clone() });
    lamp.swing = (v) => { lamp.sw.vx += v.x / lamp.cordLen; lamp.sw.vz += v.z / lamp.cordLen; };
    lamp.base = { cone: lamp.coneBase, light: lamp.light ? lamp.light.intensity : 0 };
    this.byName.set(name, lamp);
    if (row) { if (!this.rows.has(row)) this.rows.set(row, []); this.rows.get(row).push(lamp); }
    return lamp;
  }

  // a moving beam: a man's torch (narrow, long) or bull's-eye lantern (a
  // little wider, shorter)
  torch(tag = 'torch', { half = 0.3, range = 11, strength = 1.0 } = {}) {
    const lamp = this.addCustom({ head: V(0, -50, 0), axis: V(0, -1, 0), height: range, half, real: true, bulb: null, fadeEnd: 0.9, edgeSoft: 0.35, strength: 0.55 * strength, tag });
    lamp.torch = true;
    if (lamp.light) { lamp.light.intensity = 70 * strength; lamp.light.angle = half * 1.15; lamp.light.penumbra = 0.45; lamp.light.distance = range * 1.6; }
    lamp.entry.range = range;
    lamp.entry.intensity = 0;
    lamp.entry.torch = true;
    lamp.on = false;
    lamp.range = range;
    lamp.aim = (pos, dir) => {
      lamp.head.copy(pos); lamp.axis.copy(dir).normalize();
      const cone = lamp.cone;
      cone.position.copy(pos);
      cone.quaternion.setFromUnitVectors(_dn, lamp.axis);
      const u = cone.material.uniforms;
      u.uApex.value.copy(pos); u.uAxis.value.copy(lamp.axis);
      lamp.entry.position.copy(pos); lamp.entry.direction.copy(lamp.axis);
      if (lamp.light) {
        lamp.light.pos.copy(pos); lamp.light.target.copy(pos).addScaledVector(lamp.axis, range);
        for (const slot of this.pool) if (slot.lamp === lamp) { slot.spot.position.copy(pos); slot.spot.target.position.copy(lamp.light.target); slot.spot.target.updateMatrixWorld(); }
      }
    };
    this.torches.push(lamp);
    return lamp;
  }

  // a torch or lantern gone with its man (the scene's cast cleared)
  release(lamp) {
    lamp.on = false;
    lamp.released = true;
  }
  // a released torch taken again by a new man
  reuse(tag) {
    const l = this.torches.find((t) => t.released && t.tag === tag);
    if (l) { l.released = false; return l; }
    return null;
  }

  // one step of a hanging lamp's swing on its flex (a damped pendulum)
  swingStep(l, dt) {
    if (!l.sw) return;
    const S = l.sw;
    const w2 = 9.8 / l.cordLen;
    S.vx += (-w2 * S.x - 0.35 * S.vx) * dt;
    S.vz += (-w2 * S.z - 0.35 * S.vz) * dt;
    S.x = Math.max(-0.5, Math.min(0.5, S.x + S.vx * dt)); S.z = Math.max(-0.5, Math.min(0.5, S.z + S.vz * dt));
    const moving = Math.abs(S.x) + Math.abs(S.z) + Math.abs(S.vx) + Math.abs(S.vz) > 1e-4;
    if (!moving && !l._swung) return;
    l._swung = moving;
    l.pivot.rotation.set(-S.z, 0, S.x);
    l.pivot.updateMatrixWorld(true);
    l.axis.copy(l.aim0).applyEuler(l.pivot.rotation);
    l.head.copy(l.hangAt).addScaledVector(l.axis, l.cordLen);
    const cone = l.cone;
    cone.position.copy(l.head);
    cone.quaternion.setFromUnitVectors(_dn, l.axis);
    const u = cone.material.uniforms;
    u.uApex.value.copy(l.head); u.uAxis.value.copy(l.axis);
    l.entry.position.copy(l.head); l.entry.direction.copy(l.axis);
    if (l.light) {
      l.light.pos.copy(l.head); l.light.target.copy(l.head).addScaledVector(l.axis, l.head.y + 1);
      for (const slot of this.pool) if (slot.lamp === l) { slot.spot.position.copy(l.light.pos); slot.spot.target.position.copy(l.light.target); slot.spot.target.updateMatrixWorld(); }
    }
  }

  // the reactive world's step (fx/React.js): shot lamps die, lamps swing
  react(dt, t) {
    super.react(dt, t);
    for (const l of this.lamps) if (l.sw) this.swingStep(l, dt);
  }

  // the pool: shadows only for the still lamps; torches take plain slots
  updatePool(dt, camPos, camFwd) {
    this._poolTimer -= dt;
    const lc = this._lastCam;
    let onN = 0;
    for (const l of this.lamps) if (l.light && l.on) onN++;
    const snap = !lc || Math.hypot(camPos.x - lc.x, camPos.y - lc.y, camPos.z - lc.z) > 2.0 || onN !== this._onN;
    this._onN = onN;
    (this._lastCam || (this._lastCam = camPos.clone())).copy(camPos);
    if (snap) this._poolTimer = 0;
    if (this._poolTimer <= 0) {
      this._poolTimer = 0.25;
      const cands = this.lamps.filter((l) => l.light && l.on);
      for (const l of cands) {
        const dx = l.head.x - camPos.x, dz = l.head.z - camPos.z;
        const d = Math.hypot(dx, dz);
        const ahead = (dx * camFwd.x + dz * camFwd.z) / Math.max(d, 1e-3);
        l._score = d * (ahead < -0.2 ? 1.6 : 1.0) * (l.torch ? 0.8 : 1);
      }
      cands.sort((a, b) => a._score - b._score);
      const nShadow = this.pool.filter((p) => p.shadow).length;
      this._want = new Set(cands.slice(0, this.pool.length));
      this._wantShadow = new Set(cands.filter((l) => !l.torch).slice(0, nShadow));
    }
    if (!this._want) return;
    const held = new Set(this.pool.map((p) => p.lamp).filter(Boolean));
    for (const slot of this.pool) {
      const wanted = slot.lamp && (slot.shadow ? this._wantShadow.has(slot.lamp) : this._want.has(slot.lamp) && !this._wantShadow.has(slot.lamp));
      if (slot.lamp && (!wanted || !slot.lamp.on)) {
        slot.k = snap || !slot.lamp.on ? 0 : Math.max(0, slot.k - dt * 4);
        if (slot.k === 0) { held.delete(slot.lamp); slot.lamp = null; }
      } else if (slot.lamp) slot.k = snap ? 1 : Math.min(1, slot.k + dt * 4);
      if (!slot.lamp) {
        const src = slot.shadow ? this._wantShadow : [...this._want].filter((l) => !this._wantShadow.has(l));
        const pick = [...src].find((l) => !held.has(l));
        if (pick) { this.assign(slot, pick); held.add(pick); if (snap) slot.k = 1; }
      }
      const L = slot.lamp;
      slot.spot.intensity = L ? L.light.intensity * slot.k * L._k : 0;
      slot.spot.visible = true;
    }
  }

  update(dt, t, camera) {
    // the switched row: a dying flicker, then dark
    for (const l of this.lamps) {
      const D = l.dying;
      if (!D) continue;
      D.t += dt;
      const n = Math.sin(t * 83 + l.flickerSeed) * Math.sin(t * 29 + 1.1);
      l.on = D.t < D.len && n > -0.2;
      if (D.t >= D.len) { l.on = false; l.dying = null; }
    }
    for (const l of this.torches) if (l.released) l.on = false;
    super.update(dt, t, camera);
  }
}

export default {
  name: 'lamps', order: 15, tick: 40,
  build(stage) {
    const L = PierLamps.make(stage);
    for (const [name, x, y, z, half, row] of PIER.lamps) {
      L.hang(name, V(x, y, z), { half, row, drop: name === 'B3' ? PIER.trussY - 0.1 - y - 0.2 : null });
    }
    return L;
  },
  update: (lamps, dt, t, camera) => lamps.update(dt, t, camera),
};


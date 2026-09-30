import * as THREE from 'three';
import { Lamps } from '../../../world/Lamps.js';

// The office's lamps: the block's lamp system (world/Lamps.js: the pooled
// real SpotLights, three of them with shadows, the cones, the light
// registry) without the block's own posts and hanging lamps - every lamp
// here is a part's (stage.lamps.addCustom). Two things differ from the
// street, both on this instance only:
//   - a lamp may carry `priority` (it is dealt a pooled light before any
//     nearer lamp: the light through the blind must always cast its slats)
//     and `noShadow` (it never takes a shadowed light);
//   - a lamp may carry `shadow: { radius, mapSize, bias, normalBias }` for
//     the shadowed light it is dealt (the slats want a sharper map than a
//     street lamp's soft pool).
export class RoomLamps {
  constructor(stage) {
    // (Lamps' constructor builds the block's posts along its street: the
    // pool, the instancing and every method are taken as they are)
    const L = Object.create(Lamps.prototype);
    L.world = stage;
    L.lamps = [];
    L.rng = stage.rng.fork(41);
    L._poolTimer = 0;
    L._fwd = new THREE.Vector3();
    L.buildPool();
    L.inst = [];
    L.updatePool = updatePool;
    L.assign = assign;
    return L;
  }
}

// Lamps.assign, and the lamp's own shadow settings
function assign(slot, lamp) {
  Lamps.prototype.assign.call(this, slot, lamp);
  const s = slot.spot;
  if (!slot.shadow) return;
  const S = lamp.shadow || {};
  s.shadow.radius = S.radius ?? 5;
  s.shadow.bias = S.bias ?? -0.0004;
  s.shadow.normalBias = S.normalBias ?? 0.02;
  s.shadow.camera.near = S.near ?? 0.3;
  const size = S.mapSize ?? 1024;
  if (s.shadow.mapSize.x !== size) {
    s.shadow.mapSize.set(size, size);
    if (s.shadow.map) { s.shadow.map.dispose(); s.shadow.map = null; }
  }
  s.shadow.camera.updateProjectionMatrix();
  s.shadow.needsUpdate = true;
}

// Lamps.updatePool with the lamps' priority and noShadow
function updatePool(dt, camPos, camFwd) {
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
      l._score = d * (ahead < -0.2 ? 1.6 : 1.0) - (l.priority || 0) * 1000;
    }
    cands.sort((a, b) => a._score - b._score);
    const nShadow = this.pool.filter((p) => p.shadow).length;
    this._want = new Set(cands.slice(0, this.pool.length));
    this._wantShadow = new Set(cands.filter((l) => !l.noShadow).slice(0, nShadow));
  }
  if (!this._want) return;
  const held = new Set(this.pool.map((p) => p.lamp).filter(Boolean));
  for (const slot of this.pool) {
    const wanted = slot.lamp && (slot.shadow ? this._wantShadow.has(slot.lamp) : this._want.has(slot.lamp) && !this._wantShadow.has(slot.lamp));
    if (slot.lamp && !wanted) {
      slot.k = snap ? 0 : Math.max(0, slot.k - dt * 4);
      if (slot.k === 0) { held.delete(slot.lamp); slot.lamp = null; }
    } else if (slot.lamp) slot.k = snap ? 1 : Math.min(1, slot.k + dt * 4);
    if (!slot.lamp) {
      const pick = [...(slot.shadow ? this._wantShadow : this._want)].find((l) => !held.has(l));
      if (pick) { this.assign(slot, pick); held.add(pick); if (snap) slot.k = 1; }
    }
    const L = slot.lamp;
    slot.spot.intensity = L ? L.light.intensity * slot.k * L._k : 0;
    slot.spot.visible = true;
    // (a lamp that moves - the desk lamp falling - takes its light with it)
    if (L && L.moved) {
      slot.spot.position.copy(L.light.pos);
      slot.spot.target.position.copy(L.light.target);
      slot.spot.target.updateMatrixWorld();
      slot.spot.angle = L.light.angle;
    }
  }
  for (const l of this.lamps) l.moved = false;
}

export default {
  name: 'lamps', order: 50, tick: 40,
  build: (stage) => new RoomLamps(stage),
  update: (lamps, dt, t, camera) => lamps.update(dt, t, camera),
};

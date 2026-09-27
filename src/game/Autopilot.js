import * as THREE from 'three';

// The autopilot player for shot=battle (docs/PHASE2B_NOTES.md): turns toward
// the nearest Hood it can see, fires in bursts (and fights the recoil climb),
// reloads, and strafes between two cover points. Deterministic (seeded RNG):
// the same t always renders the same firefight.
export class Autopilot {
  constructor(game, { a = [-5.2, -8.6], b = [-2.0, -9.4], homeYaw = -0.1 } = {}) {
    this.game = game;
    this.rng = game.world.rng.fork(3131);
    this.spots = [new THREE.Vector2(...a), new THREE.Vector2(...b)];
    this.spot = 0;
    this.moveT = this.rng.range(3, 5);
    this.target = null;
    this.targetT = 0;
    this.burst = 0;
    this.pause = 0.6;
    this.homeYaw = homeYaw;
    this.wob = 0;
    this._v = new THREE.Vector3();
  }

  pickTarget() {
    const G = this.game, eye = G.camera.position;
    let best = null, bs = Infinity;
    for (const h of G.world.hoods.list) {
      if (!h.alive) continue;
      const c = this._v.setFromMatrixPosition(h.bones.chest.matrixWorld);
      const d = eye.distanceTo(c);
      // a Tommy gun at pistol-fight range - or anyone who is shooting at us
      const firing = G.time - (G.lastHoodShot.get(h) ?? -99) < 4;
      if (d > (firing ? 48 : 30)) continue;
      const dir = c.clone().sub(eye).divideScalar(d);
      if (G.rays.raycast(eye, dir, d - 0.5, { anyHit: true })) continue;
      // prefer near and in front of the current aim; a man far round to
      // the side (beyond ~75 deg of the avenue) is left for later
      let dy = Math.atan2(-dir.x, -dir.z) - G.controller.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      let dh = Math.atan2(-dir.x, -dir.z) - this.homeYaw;
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      if (Math.abs(dh) > 1.3 && d > 9 && !firing) continue;
      const s = d + Math.abs(dy) * 12 + Math.abs(dh) * 6;
      if (s < bs) { bs = s; best = h; }
    }
    return best;
  }

  update(dt) {
    const G = this.game, C = G.controller, W = G.weapon, r = this.rng;
    // ---- movement: strafe between the two spots --------------------------
    this.moveT -= dt;
    if (this.moveT <= 0) { this.spot = 1 - this.spot; this.moveT = r.range(4, 7); }
    const sp = this.spots[this.spot];
    const dx = sp.x - C.pos.x, dz = sp.y - C.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.25) {
      const sin = Math.sin(C.yaw), cos = Math.cos(C.yaw);
      // world dir -> (forward, right) input
      const f = (-sin * dx - cos * dz) / dist, s = (cos * dx - sin * dz) / dist;
      C.auto = { f, s, sprint: false };
    } else C.auto = { f: 0, s: 0, sprint: false };
    // ---- target & aim -----------------------------------------------------
    this.targetT -= dt;
    if (this.targetT <= 0 || (this.target && !this.target.alive)) {
      const prev = this.target;
      this.target = this.pickTarget();
      this.targetT = 0.3;
      // a human needs a moment to find a new man in the rain
      if (this.target && this.target !== prev) { this.settle = r.range(0.6, 1.2); this.burst = 0; }
    }
    this.settle = Math.max(0, (this.settle || 0) - dt);
    // the aim point drifts around the chest (+-0.3 m): some rounds miss
    this.drift = this.drift || new THREE.Vector3();
    this.driftT = (this.driftT || 0) - dt;
    if (this.driftT <= 0) { this.driftT = r.range(0.25, 0.6); this.driftTo = new THREE.Vector3(r.gauss() * 0.42, r.gauss() * 0.4, r.gauss() * 0.42); }
    if (this.driftTo) this.drift.lerp(this.driftTo, Math.min(1, dt * 4));
    let err = 1;
    this.wob += dt;
    if (this.target) {
      const c = this._v.setFromMatrixPosition(this.target.bones.chest.matrixWorld);
      c.y += 0.02;
      c.add(this.drift);
      const eye = G.camera.position;
      const d = c.clone().sub(eye);
      const wantYaw = Math.atan2(-d.x, -d.z);
      const wantPitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
      let ey = wantYaw - C.yaw; ey = Math.atan2(Math.sin(ey), Math.cos(ey));
      const ep = wantPitch - C.pitch;
      const rate = 3.4 * dt;
      // a slightly unsteady hand
      const wy = Math.sin(this.wob * 2.3) * 0.004, wp = Math.sin(this.wob * 3.1 + 1) * 0.003;
      C.yaw += Math.max(-rate, Math.min(rate, ey * Math.min(1, dt * 9))) + wy * dt * 3;
      C.pitch += Math.max(-rate, Math.min(rate, ep * Math.min(1, dt * 9))) + wp * dt * 3;
      err = Math.hypot(ey, ep);
    } else {
      // no one in sight: look down the avenue, level
      let ey = this.homeYaw - C.yaw; ey = Math.atan2(Math.sin(ey), Math.cos(ey));
      C.yaw += ey * Math.min(1, dt * 2);
      C.pitch += (0.02 - C.pitch) * Math.min(1, dt * 2);
    }
    // ---- trigger discipline ---------------------------------------------------
    if (G.state !== 'playing') { W.trigger = false; this.burst = 0; if (!W.reloading && W.ammo < 30) W.reload(); return; }
    if (this.burst > 0) {
      W.trigger = !!this.target && err < 0.06;
      if (W.sinceShot === 0) this.burst--;
      if (!W.trigger || this.burst <= 0) { W.trigger = false; this.burst = 0; this.pause = r.range(0.6, 1.3); }
    } else {
      W.trigger = false;
      this.pause -= dt;
      if (this.pause <= 0 && this.settle <= 0 && this.target && err < 0.03 && !W.reloading) this.burst = r.int(3, 6);
    }
    if (!W.reloading && (W.ammo === 0 || (W.ammo < 12 && !this.target))) { W.trigger = false; this.burst = 0; W.reload(); }
  }
}

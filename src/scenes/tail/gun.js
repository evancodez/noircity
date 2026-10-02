import * as THREE from 'three';
import { DRIVE } from '../../player/clips/drive.js';
import { PROP_KINDS, buildProp } from '../../props/index.js';
import { LAYER, allocVmId } from '../../render/layers.js';
import { FLASH } from '../../fx/fxTextures.js';

// The revolver out of the window (lane B5's, for the city: lane C3). RMB:
// my left hand leaves the wheel, down to the holster and up out of the
// window with the gun (0.22 s), the head leaning out after it, the mouse
// aims, A / D still steer. LMB fires (one a press, 0.3 s apart); LMB with
// the gun down brings it up and fires once the arm is up. Six in the
// cylinder and one reload's worth in the pocket (the story: I come to the
// pier with an empty gun): R, or a press on an empty cylinder, reloads in
// 1.3 s while the right hand drives. A round goes down the eye's line: into
// his car (chase.hisHit says what it did to him: tyre, man, tank, body), or
// into whatever stands in the way (a column, a parked car, the wall).
//   gun.step(dt) (phase b), gun.holster(dt), gun.rounds, gun.pocket, gun.shots
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const _v = new THREE.Vector3(), _d = new THREE.Vector3();

export class WindowGun {
  constructor(chase) {
    this.chase = chase;
    this.game = chase.game;
    this.aimK = 0; this.fireBuf = 0; this.snapT = 0; this.cool = 0; this.reloadT = 0;
    this.rounds = 6; this.pocket = 6;
    this.shots = 0; this.hits = 0;
    this.prop = null;
    this.ray = new THREE.Raycaster();
    const G = this.game;
    // (its key light out there: made with the scene, behind its fade)
    if (!G.stage._gunKey) {
      const L = new THREE.PointLight(0xffffff, 0, 1.4, 2);
      L.layers.enableAll();
      L.position.set(0.12, 0.3, 0.02);
      G.vm.root.add(L);
      G.stage._gunKey = L;
    }
    this.key = G.stage._gunKey;
  }

  dispose() {
    this.chase.kit.aimMark(0);
    if (DRIVE.gun && DRIVE.gun.prop) DRIVE.gun.prop.visible = false;
    if (this.key) this.key.intensity = 0;
    DRIVE.aim = 0;
  }

  step(dt) {
    const G = this.game, C = G.controller, ch = this.chase;
    const held = G.held('Mouse2');
    if (G.pressed('Mouse0')) { this.fireBuf = this.aimK < 0.9 ? 0.35 : 0.15; if (!held && this.aimK < 0.5) this.snapT = 0.9; }
    if (G.pressed('KeyR') && this.rounds < 6 && this.pocket > 0 && this.reloadT <= 0) this.startReload();
    this.fireBuf = Math.max(0, this.fireBuf - dt);
    this.snapT = Math.max(0, this.snapT - dt);
    const want = (held || this.snapT > 0) && ch.phase !== 'c' ? 1 : 0;
    // (as the gun comes up the eye comes onto him; the mouse has the last word)
    if (want && !this._want) this.aimSnap = 0.32;
    this._want = !!want;
    const his = ch.his;
    if (this.aimSnap > 0 && C.drive && his) {
      this.aimSnap -= dt;
      const D = C.drive, e = G.camera.position, v = ch.my;
      const p = his.seat(_d.set(-1.9, 0.75, 0), _v);
      const wy = Math.atan2(-(p.x - e.x), -(p.z - e.z)) - (v.yaw - Math.PI / 2);
      const wp = Math.atan2(p.y - e.y, Math.hypot(p.x - e.x, p.z - e.z)) - v.pitch * 0.9;
      const k = 1 - Math.exp(-dt * 12);
      D.look.yaw += (clamp(Math.atan2(Math.sin(wy), Math.cos(wy)), -0.7, 0.34) - D.look.yaw) * k;
      D.look.pitch += (clamp(wp, -0.3, 0.2) - D.look.pitch) * k;
    }
    const rate = want ? 1 / 0.22 : 1 / 0.3;
    this.aimK = clamp(this.aimK + Math.sign(want - this.aimK) * rate * dt, 0, 1);
    DRIVE.aim = this.aimK;
    if (C.drive) { C.drive.lean = this.aimK; C.drive.aim = this.aimK > 0.5; }
    this.show(this.aimK > 0.25);
    ch.kit.aimMark(this.aimK);
    this.cool = Math.max(0, this.cool - dt);
    if (DRIVE.gun) DRIVE.gun.kick = Math.max(0, (DRIVE.gun.kick || 0) - dt / 0.16);
    if (this.reloadT > 0) { this.reloadT -= dt; if (this.reloadT <= 0) { const n = Math.min(6 - this.rounds, this.pocket); this.rounds += n; this.pocket -= n; } }
    if (this.fireBuf > 0 && this.aimK > 0.9 && this.cool <= 0 && this.reloadT <= 0) { this.fireBuf = 0; this.fire(); }
  }
  holster(dt) {
    if (this.aimK <= 0) return;
    this.aimK = Math.max(0, this.aimK - dt / 0.3);
    DRIVE.aim = this.aimK;
    const C = this.game.controller;
    if (C.drive) { C.drive.lean = this.aimK; C.drive.aim = false; }
    this.show(this.aimK > 0.25);
    this.chase.kit.aimMark(this.aimK);
  }
  startReload() {
    if (this.pocket <= 0) return false;
    this.reloadT = 1.3;
    this.game.sfx.play('tail_reload', null, {});
    return true;
  }
  // the revolver: made once, drawn in the hands' scene (its path and the
  // hand on it are the drive set's: player/clips/drive.js)
  show(on) {
    const G = this.game, vm = G.vm;
    if (!this.prop) {
      if (DRIVE.gun && DRIVE.gun.prop && DRIVE.gun.prop.parent) DRIVE.gun.prop.parent.remove(DRIVE.gun.prop);
      const kind = PROP_KINDS.includes('revolver') ? 'revolver' : 'tailRevolver';
      const p = buildProp(kind);
      const id = allocVmId();
      p.traverse((o) => { if (!o.isMesh) return; o.layers.set(LAYER.VIEWMODEL); o.userData.inkId = id; o.userData.inkFigure = true; o.castShadow = false; o.frustumCulled = false; });
      p.matrixAutoUpdate = false;
      p.visible = false;
      vm.root.add(p);
      this.prop = p;
      DRIVE.gun = { prop: p, kick: 0 };
    }
    if (!on) this.prop.visible = false;
    if (this.key) this.key.intensity = on ? 0.35 * clamp((this.aimK - 0.25) / 0.5, 0, 1) : 0;
  }
  fire() {
    const G = this.game, cam = G.camera, ch = this.chase, his = ch.his;
    if (this.rounds <= 0) {
      G.sfx.play('tail_click', null, {});
      if (!this.startReload()) G.emit('tail:dry', {});
      return;
    }
    this.rounds--;
    this.shots++;
    this.cool = 0.3;
    cam.updateMatrixWorld();
    const dir = new THREE.Vector3(0, 0, -1).transformDirection(cam.matrixWorld);
    const origin = cam.position.clone();
    const muzzle = new THREE.Vector3();
    if (this.prop) {
      this.prop.updateMatrixWorld(true);
      const ud = this.prop.userData;
      let mz = ud.muzzle;
      if (!mz) { const b = new THREE.Box3().setFromObject(this.prop); const inv = this.prop.matrixWorld.clone().invert(); b.applyMatrix4(inv); mz = ud.muzzle = new THREE.Vector3((b.min.x + b.max.x) / 2, b.max.y - 0.015, b.max.z); }
      muzzle.copy(mz).applyMatrix4(this.prop.matrixWorld);
    } else muzzle.copy(origin).addScaledVector(dir, 0.6);
    this.flash(muzzle, dir);
    G.sfx.pistol(muzzle.clone(), 0);
    G.controller.kick(1.8, 1.2, 0.11);
    if (DRIVE.gun) DRIVE.gun.kick = 1;
    G.counters.shots++;
    G.emit('shot', { weapon: 'revolver' });
    // his car: its own meshes, tested directly (it moves; the bullets'
    // world keeps the still things)
    let hisHit = null;
    if (his && his.car) {
      this.ray.set(origin, dir); this.ray.far = 140;
      const meshes = Object.values(his.car.meshes).filter((m) => m && m.isMesh && m.visible && !m.userData.noRay);
      const hits = this.ray.intersectObjects(meshes, false);
      if (hits.length) hisHit = hits[0];
    }
    const world = G.rays.raycast(origin, dir, hisHit ? hisHit.distance : 140);
    if (hisHit && (!world || world.t > hisHit.distance)) {
      this.hits++;
      const hit = { t: hisHit.distance, point: hisHit.point, normal: hisHit.face ? hisHit.face.normal.clone().transformDirection(hisHit.object.matrixWorld) : dir.clone().negate(), mesh: hisHit.object, surf: 0 };
      // (the block's car reactions: the glass cracks and shatters, a lens
      // breaks, sparks off the paint)
      const C = this.game.stage.cars;
      let r = null;
      try { r = C.hit(his.car, hit, dir); } catch (e) { r = null; }
      if (!r) this.sparks(hit.point, hit.normal);
      ch.hisHit(his.local(hit.point, new THREE.Vector3()), hit);
      G.emit('tail:hit', { point: hit.point });
    } else if (world) {
      G.react.bullet(world, dir.clone());
    }
    if (this.rounds <= 0 && this.pocket > 0) this.startReload();
  }
  sparks(p, n) {
    const G = this.game, r = this.chase.ctx.rng;
    for (let i = 0; i < 10; i++) G.fx.sparks.spawn({ pos: p.clone(), vel: n.clone().multiplyScalar(r.range(1, 3)).add(new THREE.Vector3(r.gauss(), r.gauss() + 1, r.gauss())), life: r.range(0.15, 0.4), size: [0.01, 0.016], stretch: 0.04, col: [6, 6, 6], cell: 4, gravity: 9.8, ground: 0.02, fadeOut: 0.3 });
  }
  // the flash out of the window: a small hard star at the muzzle and a
  // short spray along the barrel (lane B5's R2)
  flash(mz, fwd) {
    const G = this.game, F = G.fx.flash, r = this.chase.ctx.rng, FR = 1 / 60;
    const gf = new THREE.Vector3(0, 0, -1);
    if (this.prop) gf.transformDirection(this.prop.matrixWorld); else gf.copy(fwd);
    const s = r.range(0.06, 0.075), rot = r.next() * Math.PI * 2;
    const p = mz.clone().addScaledVector(gf, 0.02);
    F.vm.spawn({ pos: p, life: FR * 0.5, size: [s, s], rot, col: [3.2, 3.2, 3.2], cell: FLASH.RADIAL[r.int(0, 5)], fadeOut: 0 });
    F.vm.spawn({ pos: p.clone().addScaledVector(gf, 0.03), vel: gf.clone(), life: FR * 0.5, size: [s * 0.5, s * 0.3], stretch: s * 1.3, col: [2.6, 2.6, 2.6], cell: FLASH.SMALL[r.int(0, 1)], fadeOut: 0 });
    const gun = this.prop;
    const anchor = { alive: true, muzzleWorld: (out) => (gun ? (gun.updateMatrixWorld(true), out.copy(gun.userData.muzzle).applyMatrix4(gun.matrixWorld)) : out.copy(p)) };
    F.queue.push({ sys: F.vm, pos: p.clone(), size: s * 0.6, cell: FLASH.RADIAL[r.int(0, 5)], rot: rot + 1.3, col: 2.2, t: G.time + FR, anchor });
    const w = mz.clone().addScaledVector(gf, 1.6);
    F.light.position.copy(w);
    F.lightT = 0; F.lightI = F.intensity.player * 0.55; F.light.intensity = F.lightI;
    F.playerEntry.position.copy(F.light.position); F.playerEntry.intensity = 0.3;
    F.puff(mz.clone().addScaledVector(gf, 0.04), gf, 0.35, true);
  }
}

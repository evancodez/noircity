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
    // [3rd owner] no aim of the game's own: the critic's cheat was here - a
    // bare LMB raised the gun and fired once it was up, and every raise swung
    // the eye onto his tank (LMB alone, never aimed, landed 6 of 6). Now LMB
    // with the gun down only brings it out of the window (held out a moment,
    // as a tap of RMB would); a round goes only on a press while the arm is
    // up, down the eye's line where the mouse put it.
    if (G.pressed('Mouse0')) {
      if (this.aimK >= 0.9) this.fireBuf = 0.15;
      else if (held) this.fireBuf = 0.12;            // (RMB held, the arm still rising: that press counts once it is up)
      else this.snapT = Math.max(this.snapT, 1.6);   // (the gun comes out; the press is not a shot)
    }
    if (G.pressed('KeyR') && this.rounds < 6 && this.pocket > 0 && this.reloadT <= 0) this.startReload();
    this.fireBuf = Math.max(0, this.fireBuf - dt);
    this.snapT = Math.max(0, this.snapT - dt);
    const want = (held || this.snapT > 0) && ch.phase !== 'c' ? 1 : 0;
    // (LMB again while it is out keeps it out)
    if (this.fireBuf > 0 && !held) this.snapT = Math.max(this.snapT, 1.2);
    const rate = want ? 1 / 0.22 : 1 / 0.3;
    this.aimK = clamp(this.aimK + Math.sign(want - this.aimK) * rate * dt, 0, 1);
    DRIVE.aim = this.aimK;
    // ([2nd owner] the head out of the window to see past the screen's
    // pillar while the eyes are on his crash - chase.crashLean - gun or no)
    if (C.drive) { C.drive.lean = Math.max(this.aimK, ch.crashLean || 0); C.drive.aim = this.aimK > 0.5; }
    this.show(this.aimK > 0.25);
    ch.kit.aimMark(this.aimK);
    this.cool = Math.max(0, this.cool - dt);
    if (DRIVE.gun) DRIVE.gun.kick = Math.max(0, (DRIVE.gun.kick || 0) - dt / 0.16);
    if (this.reloadT > 0) { this.reloadT -= dt; if (this.reloadT <= 0) { const n = Math.min(6 - this.rounds, this.pocket); this.rounds += n; this.pocket -= n; } }
    if (this.fireBuf > 0 && this.aimK > 0.9 && this.cool <= 0 && this.reloadT <= 0) { this.fireBuf = 0; this.fire(); }
  }
  holster(dt) {
    const C = this.game.controller, cl = this.chase.crashLean || 0;
    if (this.aimK <= 0) { if (C.drive && (cl > 0.001 || C.drive.lean > 0.001)) C.drive.lean = cl; return; }
    this.aimK = Math.max(0, this.aimK - dt / 0.3);
    DRIVE.aim = this.aimK;
    if (C.drive) { C.drive.lean = Math.max(this.aimK, cl); C.drive.aim = false; }
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
      // [C10a] (the last try's revolver: off the viewmodel and off the GPU - each retry built another, +16 geometries)
      if (DRIVE.gun && DRIVE.gun.prop) { if (DRIVE.gun.prop.parent) DRIVE.gun.prop.parent.remove(DRIVE.gun.prop); DRIVE.gun.prop.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
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
    this.ray.set(origin, dir); this.ray.far = 140;
    const meshesOf = (v) => Object.values(v.car.meshes).filter((m) => m && m.isMesh && m.visible && !m.userData.noRay);
    if (his && his.car) {
      const hits = this.ray.intersectObjects(meshesOf(his), false);
      if (hits.length) hisHit = hits[0];
    }
    // [4th owner] (a car of the traffic between us takes the round: the
    // critic's "steer round traffic while aiming" - a round went through a
    // car on the river road to find him)
    let carHit = null, carV = null;
    for (const c of (ch.traffic && ch.traffic.cars) || []) {
      const v = c.v;
      if (!v || !v.car || v.pos.distanceTo(origin) > (hisHit ? hisHit.distance + 3 : 140)) continue;
      const hits = this.ray.intersectObjects(meshesOf(v), false);
      if (hits.length && (!carHit || hits[0].distance < carHit.distance)) { carHit = hits[0]; carV = c; }
    }
    if (carHit && (!hisHit || carHit.distance < hisHit.distance)) {
      const world0 = G.rays.raycast(origin, dir, carHit.distance);
      if (!world0 || world0.t > carHit.distance) {
        const hit = { t: carHit.distance, point: carHit.point, normal: carHit.face ? carHit.face.normal.clone().transformDirection(carHit.object.matrixWorld) : dir.clone().negate(), mesh: carHit.object, surf: 0 };
        let r = null;
        try { r = this.game.stage.cars.hit(carV.v.car, hit, dir); } catch (e) { r = null; }
        if (!r) this.sparks(hit.point, hit.normal);
        if (ch.traffic.shotAt) ch.traffic.shotAt(carV);
        this.trafficHits = (this.trafficHits || 0) + 1;
        G.emit('tail:hitTraffic', { point: hit.point });
        if (this.rounds <= 0 && this.pocket > 0) this.startReload();
        return;
      }
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

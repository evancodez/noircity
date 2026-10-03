import * as THREE from 'three';
import * as THREE_ from 'three';
import { MUZZLE, EJECT, RELOAD, buildDrumGeometry } from './Viewmodel.js';
import { allocInkId } from '../render/layers.js';

// The Thompson M1928: 50-round drum, 11 rounds/s, hitscan with a spread
// cone that grows while the trigger is held (and when moving) and recovers
// when it is released. Head shots kill; torso hits do 52 (2 kill a normal
// Hood, 100 hp), limbs 34 (3 kill); beyond 30 m damage falls off a little.
// Every shot: recoil kick + muzzle climb (the view climbs; the player or the
// autopilot pulls it back down), a muzzle flash with its light, a smoke puff,
// an ejected case, and the hit's effect (blood / chips / sparks / splash).
export const WEAPON = {
  drum: 50,
  rate: 11,                 // rounds / s
  reload: RELOAD.dur,       // s (the drum falls out of the frame, a fresh one goes in: Viewmodel RELOAD)
  spread0: 0.0035,          // rad, first round
  spreadStep: 0.0032,       // added per round while firing
  spreadMax: 0.05,
  spreadMove: 0.012,        // added while moving
  recover: 0.09,            // rad / s once the trigger is released
  climb: 0.0042,            // view climb per round (rad)
  range: 160,
  dmgTorso: 52, dmgLimb: 34,
};
const HEAD = new Set(['head', 'hat']);
const TORSO = new Set(['chest', 'spine', 'hips', 'neck']);

export class Weapon {
  constructor(game, viewmodel) {
    this.game = game;
    this.vm = viewmodel;
    this.ammo = WEAPON.drum;
    this.trigger = false;
    this.cool = 0;
    this.spread = WEAPON.spread0;
    this.sinceShot = 10;
    this.reloadLeft = 0;
    this.rng = game.world.rng.fork(1021);
    this._dir = new THREE.Vector3();
    this._fwd = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._up = new THREE.Vector3();
    this.lastShotTime = -10;
  }

  get reloading() { return this.reloadLeft > 0; }

  reload() {
    if (this.reloading || this.ammo === WEAPON.drum) return false;
    this.reloadLeft = WEAPON.reload;
    this.vm.startReload();
    // (the sound's moments are fractions of its length: at 2.6 s they land on
    // the latch, the drum out, the drum in and home, the bolt)
    this.game.sfx.play('reload', null, { dur: WEAPON.reload }, { send: false, gain: 0.8 });
    this.dropped = false;
    return true;
  }

  reset() {
    this.ammo = WEAPON.drum; this.reloadLeft = 0; this.cool = 0; this.trigger = false; this.spread = WEAPON.spread0;
  }

  update(dt, time) {
    if (this.reloadLeft > 0) {
      // the spent drum lands by the feet 0.35 s after it left the frame
      if (!this.dropped && WEAPON.reload - this.reloadLeft + dt >= RELOAD.land - 1e-6) { this.dropped = true; this.dropDrum(); }
      this.reloadLeft -= dt;
      if (this.reloadLeft <= 0) { this.reloadLeft = 0; this.ammo = WEAPON.drum; }
    }
    this.cool = Math.max(-1 / WEAPON.rate, this.cool - dt);
    this.sinceShot += dt;
    let fired = 0;
    if (this.trigger && !this.reloading) {
      if (this.ammo <= 0) { this.reload(); }
      else {
        while (this.cool <= 0 && this.ammo > 0) {
          this.fire(time);
          this.cool += 1 / WEAPON.rate;
          fired++;
          if (fired > 2) break;
        }
      }
    } else if (this.cool < 0) this.cool = 0;
    if (!this.trigger || this.sinceShot > 0.15) {
      this.spread = Math.max(WEAPON.spread0, this.spread - WEAPON.recover * dt);
    }
    // a burst has ended: the smoke it leaves hangs at the muzzle
    if (this.burstShots > 0 && this.sinceShot > 0.13) {
      if (this.lastMuzzle) this.game.fx.muzzleSmoke(this.lastMuzzle, this.lastFwd, this.burstShots, this.lastGunFwd);
      this.burstShots = 0;
    }
  }

  // The spent drum on the ground: a clang, a ripple on the wet street, a dark
  // drum lying there that stays (three at most, the oldest goes). World
  // geometry, not a bullet solid (it would change where rounds land).
  dropDrum() {
    const G = this.game, S = G.stage, cam = G.camera;
    if (!S) return;
    const fwd = new THREE_.Vector3(0, 0, -1).applyQuaternion(cam.quaternion); fwd.y = 0;
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1);
    fwd.normalize();
    const right = new THREE_.Vector3(-fwd.z, 0, fwd.x);
    // (by the right foot, a little ahead: where a drum dropped from the gun lands)
    const x = cam.position.x + right.x * 0.28 + fwd.x * 0.35, z = cam.position.z + right.z * 0.28 + fwd.z * 0.35;
    const y = S.surfaceY ? S.surfaceY(x, z) : 0;
    const p = new THREE_.Vector3(x, y, z);
    G.sfx.play('clang', p, { k: 0.55 }, { ref: 3 });
    if (S.street && S.street.addImpact) S.street.addImpact(S, x, z, 0.7);
    const list = S._spentDrums || (S._spentDrums = []);
    if (list.length >= 3) { const old = list.shift(); S.scene.remove(old); }
    if (!Weapon.drumGeo) Weapon.drumGeo = buildDrumGeometry();
    if (!Weapon.drumMat) Weapon.drumMat = new THREE_.MeshStandardMaterial({ color: 0x0e0e0e, roughness: 0.9, metalness: 0 });
    const m = new THREE_.Mesh(Weapon.drumGeo, Weapon.drumMat);
    // lying on its face (the drum's axis up), turned as it fell
    m.position.set(x, y + 0.026, z);
    m.rotation.set(0, Math.atan2(fwd.x, fwd.z) + 0.7, Math.PI / 2, 'YXZ');
    m.userData.inkId = allocInkId();
    m.userData.noRay = true;
    m.castShadow = false; m.receiveShadow = true;
    S.scene.add(m);
    list.push(m);
  }

  // fire one round; `forceDir` (staged shots) bypasses the spread
  fire(time, forceDir = null) {
    const G = this.game, r = this.rng;
    const cam = G.camera;
    this.ammo--;
    this.sinceShot = 0;
    this.lastShotTime = time;
    G.counters.shots++;
    const moving = G.controller.vel.length() > 1;
    const cone = this.spread + (moving ? WEAPON.spreadMove : 0);
    this.spread = Math.min(WEAPON.spreadMax, this.spread + WEAPON.spreadStep);
    // direction: the view axis inside the cone (uniform over the disc)
    cam.updateMatrixWorld();
    const fwd = this._fwd.set(0, 0, -1).transformDirection(cam.matrixWorld);
    const right = this._right.set(1, 0, 0).transformDirection(cam.matrixWorld);
    const up = this._up.set(0, 1, 0).transformDirection(cam.matrixWorld);
    const a = r.next() * Math.PI * 2, rr = Math.sqrt(r.next()) * cone;
    const dir = forceDir ? this._dir.copy(forceDir) : this._dir.copy(fwd).addScaledVector(right, Math.cos(a) * rr).addScaledVector(up, Math.sin(a) * rr).normalize();
    const origin = cam.position.clone();
    // recoil: the gun kicks, the view climbs (mostly up, a little sideways)
    this.vm.kick(1, () => r.next());
    G.controller.pitch = Math.min(1.4, G.controller.pitch + WEAPON.climb * r.range(0.7, 1.2));
    G.controller.yaw += WEAPON.climb * 0.35 * r.gauss();
    // flash, smoke, case
    G.sfx.tommy();
    this.burstShots = (this.burstShots || 0) + 1;
    const vmMuzzle = this.vm.vmWorld(MUZZLE);
    const wMuzzle = this.vm.reproject(MUZZLE, 0.9, cam);
    G.fx.flash.player(vmMuzzle, wMuzzle, fwd.clone(), time, this.vm.forward());
    this.lastMuzzle = wMuzzle.clone();
    this.lastFwd = fwd.clone();
    // (the gun's own heading in the world: the puff hangs where it points)
    this.lastGunFwd = fwd.clone();
    const ej = this.vm.reproject(EJECT, 0.45, cam);
    G.fx.casings.eject(ej, right, up, fwd);
    // [C2] in a gun kit's encounter the round is the kit's: from the muzzle,
    // through what is thin, into what is solid (src/guns/Guns.js)
    if (G.guns && G.guns.active && !forceDir) {
      const hit = G.guns.playerRound(origin, dir.clone(), { name: 'tommy', chew: 1, steady: 1, range: WEAPON.range,
        dmg: (hh) => { let d = TORSO.has(hh.joint) ? WEAPON.dmgTorso : WEAPON.dmgLimb; if (hh.t > 30) d *= Math.max(0.7, 1 - (hh.t - 30) * 0.01); return d; } });
      G.emit('shot', { weapon: 'tommy', hit });
      return;
    }
    // the shot
    const hood = G.rays.raycastHoods(origin, dir, WEAPON.range, G.world.hoods.list);
    const wall = G.rays.raycast(origin, dir, hood ? hood.t : WEAPON.range);
    if (hood && (!wall || hood.t < wall.t)) this.hitHood(hood, dir, time);
    else if (wall) G.react.bullet(wall, dir);
    G.emit('shot', { weapon: 'tommy', hit: hood && (!wall || hood.t < wall.t) ? hood : wall });
  }

  hitHood(hit, dir, time) {
    const G = this.game, h = hit.hood, r = this.rng;
    G.counters.hits++;
    const head = HEAD.has(hit.joint);
    let dmg = head ? 999 : TORSO.has(hit.joint) ? WEAPON.dmgTorso : WEAPON.dmgLimb;
    if (hit.t > 30) dmg *= Math.max(0.7, 1 - (hit.t - 30) * 0.01);
    if (head) G.counters.headshots++;
    G.fx.bloodFx.hit(hit.point, dir, { strength: head ? 1.3 : TORSO.has(hit.joint) ? 1 : 0.7, rays: G.rays });
    G.damageHood(h, dmg, dir, { head, joint: hit.joint, time });
  }
}

import * as THREE from 'three';
import { MUZZLE, EJECT } from './Viewmodel.js';

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
  reload: 2.3,              // s
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
    this.game.sfx.reload();
    return true;
  }

  reset() {
    this.ammo = WEAPON.drum; this.reloadLeft = 0; this.cool = 0; this.trigger = false; this.spread = WEAPON.spread0;
  }

  update(dt, time) {
    if (this.reloadLeft > 0) {
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

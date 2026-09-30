import * as THREE from 'three';

// A plain revolver (wave B seams): the front a gunfight is built against
// before the real one lands (lane B3 replaces its insides and keeps this
// front). No model, no hands: the 'revolver' hands' set (hidden).
// Six rounds, one per press (0.3 s between), straight down the view: the
// Tommy gun's bullet path (the Hoods first, then the world through
// react.bullet), a Hood dead to two body hits (a head hit kills), the
// Hoods' pistol sound, the muzzle flash at a point ahead of the eye,
// controller.kick; R (or a press on an empty cylinder) reloads in 1.8 s.
export const REVOLVER = { rounds: 6, gap: 0.3, reload: 1.8, range: 120, dmgBody: 55 };
const HEAD = new Set(['head', 'hat']);
// the flash's point in the eye's frame (m: right, up, ahead)
const MUZZLE = new THREE.Vector3(0.1, -0.09, -0.8);

export default (game) => {
  const G = game;
  const dir = new THREE.Vector3(), at = new THREE.Vector3();
  const W = {
    name: 'revolver', set: 'revolver',
    ammo: REVOLVER.rounds, mag: REVOLVER.rounds,
    cool: 0, reloadLeft: 0,
    get reloading() { return this.reloadLeft > 0; },
    equip() { this.cool = 0; },
    unequip() { this.reloadLeft = 0; },
    trigger(down, pressed) {
      if (!pressed || this.reloading) return;
      if (this.ammo <= 0) { this.reload(); return; }
      if (this.cool <= 0) this.fire();
    },
    fire() {
      if (this.reloading || this.ammo <= 0 || this.cool > 0) return false;
      this.ammo--;
      this.cool = REVOLVER.gap;
      const cam = G.camera, time = G.time;
      cam.updateMatrixWorld();
      dir.set(0, 0, -1).transformDirection(cam.matrixWorld);
      const origin = cam.position.clone();
      G.counters.shots++;
      // flash, sound, the kick
      at.copy(MUZZLE).applyMatrix4(cam.matrixWorld);
      G.fx.flash.player(at.clone(), at.clone(), dir.clone(), time);
      G.sfx.pistol(at.clone(), 0);
      G.controller.kick(2.2, 1.5, 0.12);
      // the shot: the Tommy gun's path
      const hood = G.rays.raycastHoods(origin, dir, REVOLVER.range, G.world.hoods.list);
      const wall = G.rays.raycast(origin, dir, hood ? hood.t : REVOLVER.range);
      const onHood = hood && (!wall || hood.t < wall.t);
      if (onHood) {
        const head = HEAD.has(hood.joint);
        G.counters.hits++;
        if (head) G.counters.headshots++;
        G.fx.bloodFx.hit(hood.point, dir, { strength: head ? 1.3 : 1, rays: G.rays });
        G.damageHood(hood.hood, head ? 999 : REVOLVER.dmgBody, dir.clone(), { head, joint: hood.joint, time });
      } else if (wall) G.react.bullet(wall, dir.clone());
      G.emit('shot', { weapon: 'revolver', hit: onHood ? hood : wall });
      return true;
    },
    reload() {
      if (this.reloading || this.ammo === REVOLVER.rounds) return false;
      this.reloadLeft = REVOLVER.reload;
      return true;
    },
    update(dt) {
      this.cool = Math.max(0, this.cool - dt);
      if (this.reloadLeft > 0) {
        this.reloadLeft -= dt;
        if (this.reloadLeft <= 0) { this.reloadLeft = 0; this.ammo = REVOLVER.rounds; }
      }
    },
  };
  return W;
};

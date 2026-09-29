import * as THREE from 'three';
import { LAYER } from '../render/layers.js';
import { Particles } from './Particles.js';
import { FLASH } from './fxTextures.js';

// Muzzle flashes: white ink splatter starbursts (canvas atlas, fxTextures),
// two frames each (a big burst, then a smaller different one), random
// rotation and scale, plus a short hard point light so the wet street, the
// gun and the nearest Hoods flash with it, and a small smoke puff.
//
//   player(vmPos, worldPos, fwd)  - the Tommy gun: sprites on LAYER.VM_FX drawn
//        by the viewmodel camera over the gun; a stand-in on LAYER.REFL_ONLY at
//        the reprojected world muzzle so the wet street mirrors it; world.flash
//        (the pre-allocated PointLight) for ~60 ms.
//   hood(pos, dir)  - a Hood's pistol / Tommy gun: world sprites (LAYER.FX_REFL,
//        mirrored in the street), one of a small shared pool of PointLights.
const FLASH_T = 0.06;          // light duration (s)
const FRAME = 1 / 60;
// the player's sprites sit this far ahead of the muzzle face along the
// barrel, so the starburst's core clears the Cutts compensator instead of
// being hidden behind it (the gun is seen from behind, down the barrel)
const VM_AHEAD = 0.075;
// the screenshot hold (shot mode): the second, smaller frame, a softer light
const HOLD = { size: 0.6, light: 0.55, entry: 0.12, reflSize: 0.34, reflCol: 3 };
// a Hood's flash beyond FAR_FLASH m is the bold starburst, >= FAR_PX on screen
const FAR_FLASH = 13;
const FAR_PX = 48;
const FAR_COL = 1.35;
const _v = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3();

export class MuzzleFlash {
  constructor(world, atlas, puffTex) {
    this.world = world;
    this.rng = world.rng.fork(313);
    const mk = (layer, name, max, reflGain = 1) => new Particles(world, {
      max, map: atlas, cells: [FLASH.cols, FLASH.rows], layer, name, crisp: true, renderOrder: 5, reflGain, cut: [0.1, 0.32],
    });
    this.vm = mk(LAYER.VM_FX, 'flashVM', 8);
    this.refl = mk(LAYER.REFL_ONLY, 'flashRefl', 8);
    this.world3 = mk(LAYER.FX_REFL, 'flashWorld', 48);
    this.smoke = new Particles(world, { max: 160, map: puffTex, cells: [1, 1], layer: LAYER.FX, name: 'smoke', crisp: false, renderOrder: 3, alphaFromR: true });
    // the player's light
    this.light = world.flash;
    this.lightT = 0;
    this.lightI = 0;
    this.playerEntry = world.lights.add({ position: new THREE.Vector3(0, -50, 0), direction: new THREE.Vector3(0, -1, 0), halfAngle: Math.PI, range: 3.2, intensity: 0 });
    // the Hoods' shared pool (pre-allocated: the light count never changes)
    this.pool = [];
    // (two: a burning wreck's fire light is the third, world.fxLights)
    for (let i = 0; i < 2; i++) {
      const L = new THREE.PointLight(0xffffff, 0, 14, 2);
      L.position.set(0, -50, 0);
      L.layers.enableAll();
      world.scene.add(L);
      const entry = world.lights.add({ position: L.position, direction: new THREE.Vector3(0, -1, 0), halfAngle: Math.PI, range: 7, intensity: 0 });
      this.pool.push({ light: L, t: 1, i0: 0, entry });
    }
    this.poolNext = 0;
    this.queue = [];           // second frames, due next step
    this.last = { player: null, hoods: new Map() };
    this.intensity = { player: 32, hood: 22 };
    this.light.distance = 12;
    this.camera = null;        // set by the game: orients the Hoods' side sprays
  }

  // A Hood's flash sprite: facing the eye (every shot at the player) it is a
  // radial starburst centred on the muzzle; seen side-on a forward spray,
  // turned so it throws along the shot's projected direction, with its core
  // (0.2 of the quad off-centre in the atlas) placed on the muzzle.
  hoodSprite(pos, dir, s) {
    const r = this.rng, cam = this.camera;
    if (!cam) return { cell: FLASH.RADIAL[r.int(0, 5)], rot: r.next() * Math.PI * 2, center: pos.clone() };
    const toEye = _v.subVectors(cam.position, pos).normalize();
    if (dir.dot(toEye) > 0.7) return { cell: FLASH.RADIAL[r.int(0, 5)], rot: r.next() * Math.PI * 2, center: pos.clone() };
    const dv = _v.copy(dir).transformDirection(cam.matrixWorldInverse);
    const rot = Math.atan2(dv.y, dv.x) + r.gauss() * 0.12;
    _r.set(1, 0, 0).transformDirection(cam.matrixWorld);
    _u.set(0, 1, 0).transformDirection(cam.matrixWorld);
    const center = pos.clone().addScaledVector(_r, Math.cos(rot) * 0.2 * s).addScaledVector(_u, Math.sin(rot) * 0.2 * s);
    return { cell: FLASH.SIDE[r.int(0, 3)], rot, center };
  }

  // vmPos: muzzle in world coordinates of the VIEWMODEL (camera-relative
  // placement, drawn by the VM camera); worldPos: the muzzle reprojected into
  // the main camera's world at ~1 m; camRight/camUp: billboard spin frame
  // gunFwd: the barrel's direction in the viewmodel's frame (the sprites are
  // pushed VM_AHEAD along it); fwd: the view axis (world)
  player(vmPos, worldPos, fwd, time, gunFwd = fwd) {
    const r = this.rng;
    const s = r.range(0.4, 0.52);
    const cell = FLASH.RADIAL[r.int(0, 5)];
    const rot = r.next() * Math.PI * 2;
    const p = vmPos.clone().addScaledVector(gunFwd, VM_AHEAD);
    this.vm.spawn({ pos: p, life: FRAME * 1.01, size: [s, s], rot, col: [3.2, 3.2, 3.2], cell, fadeOut: 0 });
    // a forward spray sprite stretched along the barrel (the shot's direction)
    this.vm.spawn({ pos: p.clone().addScaledVector(gunFwd, 0.05), vel: gunFwd.clone(), life: FRAME * 1.01, size: [s * 0.55, s * 0.3], stretch: s * 0.9, col: [2.6, 2.6, 2.6], cell: FLASH.SMALL[r.int(0, 1)], fadeOut: 0 });
    const s2 = s * r.range(0.6, 0.8), cell2 = FLASH.RADIAL[r.int(0, 5)], rot2 = rot + r.range(1, 2);
    this.queue.push({ sys: this.vm, pos: p.clone(), size: s2, cell: cell2, rot: rot2, col: 2.4, t: time + FRAME });
    this.refl.spawn({ pos: worldPos, life: FRAME * 2.01, size: [0.5, 0.5], rot, col: [4, 4, 4], cell, fadeOut: 0 });
    // light: ahead of the muzzle, so it rakes the wet street and the men in
    // front more than it floods the gun itself
    this.light.position.copy(worldPos).addScaledVector(fwd, 1.3);
    this.lightT = 0;
    this.lightI = this.intensity.player * r.range(0.85, 1.15);
    this.light.intensity = this.lightI;
    this.playerEntry.position.copy(this.light.position);
    this.playerEntry.intensity = 0.35;
    // smoke
    this.puff(worldPos, fwd, 0.6, true);
    this.last.player = { vmPos: vmPos.clone(), worldPos: worldPos.clone(), fwd: fwd.clone(), gunFwd: gunFwd.clone(), time, s, cell, rot, s2, cell2, rot2 };
  }

  // metres per screen pixel at distance d (the main camera, full-res frame)
  pxSize(d) {
    const cam = this.camera;
    const H = Math.max(1, this.world.U.uRes.value.y);
    const fov = cam ? cam.fov : 70;
    return (2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2) * d) / H;
  }

  hood(h, pos, dir, time, heavy = false) {
    const r = this.rng;
    // (the sprite's white core is ~1/5 of the quad; the spikes and drops
    // fill the rest: a ~1 m splash of white ink at the pistol)
    let s = (heavy ? 1.45 : 1.15) * r.range(0.85, 1.15);
    const d = this.camera ? this.camera.position.distanceTo(pos) : 0;
    let cell, rot, center, far = false;
    if (d > FAR_FLASH) {
      // Beyond ~15 m (Phase 3a preamble #2): the bold starburst, centred ON
      // the muzzle (no side-spray offset, no random turn), at least ~48 px
      // on screen, and anchored to the gun hand for its life (update()).
      far = true;
      cell = FLASH.FAR[r.int(0, 3)];
      rot = 0;
      center = pos.clone();
      s = Math.max(s * 0.8, FAR_PX * this.pxSize(d));
    } else ({ cell, rot, center } = this.hoodSprite(pos, dir, s));
    // (a far flash is only just over paper white: at 3.4 its bloom halo
    // printed the 48 px starburst as a soft white blob)
    const fc = far ? FAR_COL : 3.4;
    const p0 = this.world3.spawn({ pos: center, life: FRAME * 1.01, size: [s, s], rot, col: [fc, fc, fc], cell, fadeOut: 0 });
    if (far) p0.anchor = h;
    this.queue.push({ sys: this.world3, pos: pos.clone(), size: s * (far ? 0.85 : 0.7), cell: far ? FLASH.FAR[r.int(0, 3)] : FLASH.SMALL[r.int(0, 1)], rot: far ? 0 : rot + 1.3, col: far ? FAR_COL * 0.9 : 2.6, t: time + FRAME, anchor: far ? h : null });
    const P = this.pool[this.poolNext];
    this.poolNext = (this.poolNext + 1) % this.pool.length;
    P.light.position.copy(pos).addScaledVector(dir, 0.3);
    P.t = 0;
    P.i0 = this.intensity.hood * (heavy ? 1.2 : 1);
    P.light.intensity = P.i0;
    P.entry.intensity = 1.2;
    this.puff(pos, dir, 0.35);
    this.last.hoods.set(h, { pos: pos.clone(), center: center.clone(), dir: dir.clone(), time, s, cell, rot, heavy, far });
  }

  // (player, Phase 3c: the per-round wisps are short-lived and hardly grow
  // - identical for their first frames, so a flash frame is unchanged - and
  // gone within ~0.4 s: a burst's soft wisps, growing 0.45 m a second and
  // hanging a second, had merged into a soft smudge the size of a car round
  // the muzzle, burying the compact brushed puff the burst leaves, Fx.muzzleSmoke)
  puff(pos, dir, k, player = false) {
    const r = this.rng;
    for (let i = 0; i < 2; i++) {
      const v = dir.clone().multiplyScalar(r.range(0.3, 0.9)).add(new THREE.Vector3(r.gauss() * 0.1, r.range(0.15, 0.4), r.gauss() * 0.1));
      const sz = r.range(0.12, 0.22) * (0.6 + k);
      // (the rng is drawn in the original order: pos, then life)
      const p0 = pos.clone().addScaledVector(dir, r.range(0.05, 0.25));
      const life = r.range(0.7, 1.2);
      this.smoke.spawn({
        pos: p0, vel: v, life: player ? life * 0.4 : life, size: [sz, sz], grow: player ? 0.15 : 0.45,
        rot: r.next() * 6.28, spin: r.gauss() * 0.6, col: [0.05, 0.05, 0.05], alpha: 0.28 * k + 0.1, drag: 1.4, fadeIn: player ? 0.1 / 0.4 : 0.1, fadeOut: 0.7,
      });
    }
  }

  update(dt, time) {
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const q = this.queue[i];
      if (time + 1e-6 >= q.t) {
        const pq = q.sys.spawn({ pos: q.anchor && q.anchor.alive ? q.anchor.muzzleWorld(_v) : q.pos, life: FRAME * 1.01, size: [q.size, q.size], rot: q.rot, col: [q.col, q.col, q.col], cell: q.cell, fadeOut: 0 });
        if (q.anchor) pq.anchor = q.anchor;
        this.queue.splice(i, 1);
      }
    }
    // lights: a hard ~60 ms flash with a quick tail
    if (this.lightI > 0) {
      this.lightT += dt;
      const u = this.lightT / FLASH_T;
      this.light.intensity = u >= 1 ? 0 : this.lightI * (u < 0.5 ? 1 : 1 - (u - 0.5) * 2);
      this.playerEntry.intensity = this.light.intensity > 0 ? 0.35 * this.light.intensity / this.lightI : 0;
      if (u >= 1) this.lightI = 0;
    }
    for (const P of this.pool) {
      if (P.t >= 1) continue;
      P.t += dt / FLASH_T;
      P.light.intensity = P.t >= 1 ? 0 : P.i0 * (P.t < 0.5 ? 1 : 1 - (P.t - 0.5) * 2);
      P.entry.intensity = P.light.intensity > 0 ? 1.2 : 0;
    }
    this.vm.update(dt);
    this.refl.update(dt);
    // far flashes ride on the gun hand (the sprite lives a frame or two, but
    // a held frame and a man turning under fire must not leave it behind)
    for (const p of this.world3.list) if (p.anchor && p.anchor.alive) p.anchor.muzzleWorld(p.pos);
    this.world3.update(dt);
    this.smoke.update(dt);
  }

  // Screenshot hold (shot mode): re-show the most recent flash of every
  // shooter that fired within `window` s, frozen at its first frame, with
  // its light on, so the frame shows the firefight's flashes.
  // The player's flash is held at its SECOND frame (the smaller radial,
  // no forward spray) with a softer light: held for a whole frame, the
  // first frame's full-size burst and 32-unit light blew a third of the
  // picture out to white. A Hood's flash is held where his muzzle was when
  // he fired (f.pos / f.center), not where his hand has moved since.
  holdRecent(time, window = 0.5, vmNow = null) {
    const lp = this.last.player;
    if (lp && time - lp.time <= window) {
      const vmPos = vmNow ? vmNow.vmPos : lp.vmPos;
      const wp = vmNow ? vmNow.worldPos : lp.worldPos;
      const fwd = vmNow ? vmNow.fwd : lp.fwd;
      const gunFwd = vmNow && vmNow.gunFwd ? vmNow.gunFwd : lp.gunFwd;
      const p = vmPos.clone().addScaledVector(gunFwd, VM_AHEAD);
      const s = Math.min(lp.s2 ?? Infinity, lp.s * HOLD.size);
      const a = this.vm.spawn({ pos: p, life: 1, size: [s, s], rot: lp.rot2 ?? lp.rot, col: [2.8, 2.8, 2.8], cell: lp.cell2 ?? lp.cell, fadeOut: 0 });
      a.hold = true;
      const c = this.refl.spawn({ pos: wp, life: 1, size: [HOLD.reflSize, HOLD.reflSize], rot: lp.rot, col: [HOLD.reflCol, HOLD.reflCol, HOLD.reflCol], cell: lp.cell2 ?? lp.cell, fadeOut: 0 });
      c.hold = true;
      this.light.position.copy(wp).addScaledVector(fwd, 1.3);
      this.light.intensity = this.intensity.player * HOLD.light;
      this.playerEntry.position.copy(this.light.position);
      this.playerEntry.intensity = HOLD.entry;
    }
    let k = 0;
    for (const [h, f] of this.last.hoods) {
      if (time - f.time > window || !h.alive) continue;
      // a far flash is held on his gun hand as it is NOW (the frame shows
      // the pose he has at the hold, not the one he had when he fired)
      const pos = f.far ? h.muzzleWorld(new THREE.Vector3()) : f.pos;
      const fc = f.far ? FAR_COL : 3.4;
      const a = this.world3.spawn({ pos: f.far ? pos : (f.center || pos), life: 1, size: [f.s, f.s], rot: f.rot, col: [fc, fc, fc], cell: f.cell, fadeOut: 0 });
      a.hold = true;
      if (k < this.pool.length) {
        const P = this.pool[k++];
        P.light.position.copy(pos).addScaledVector(f.dir, 0.3);
        P.light.intensity = this.intensity.hood;
        P.entry.intensity = 1.2;
        P.t = 2;
      }
    }
    this.vm.write(); this.refl.write(); this.world3.write();
  }

  clear() {
    this.vm.clear(); this.refl.clear(); this.world3.clear(); this.smoke.clear();
    this.queue.length = 0;
    this.last.hoods.clear();
    this.last.player = null;
  }
}

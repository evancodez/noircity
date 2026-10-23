import * as THREE from 'three';
import { LAYER, tagInk, allocInkId, markFigure } from '../../../render/layers.js';
import { makeConeMesh } from '../../../render/shaders/cone.js';
import { glowTexture } from '../../../vehicles/models.js';
import { merge, roundedBox } from '../../../world/geom.js';
import { OVERPASS } from '../../../world/Overpass.js';

// The el's train round the loop (lane O1, from the old city's): four cars,
// their windows lit, the lamp a white eye down the avenue, the rumble
// through the Game's train sound. It goes round the loop once, then waits
// at the station a while and goes round the other way. The Game steps it
// (update(dt, t, opts)).
const CARS = 4, LEN = 13.6, GAP = 0.9, SPEED = 14;
const WAIT = 22;

export default {
  name: 'train', order: 120,
  build(stage) {
    const { scene, M } = stage;
    const el = stage.part('el');
    const line = el.line;
    const group = new THREE.Group();
    group.name = 'train';
    group.visible = false;
    scene.add(group);
    const body = merge([
      roundedBox(LEN, 2.9, 2.7, 0.35, 3).translate(0, 2.25, 0),
      roundedBox(LEN - 0.4, 0.5, 2.3, 0.2, 2).translate(0, 3.8, 0),
      new THREE.BoxGeometry(2.2, 0.7, 2.2).translate(-LEN / 2 + 2.4, 0.45, 0),
      new THREE.BoxGeometry(2.2, 0.7, 2.2).translate(LEN / 2 - 2.4, 0.45, 0),
    ]);
    const win = [];
    for (let x = -LEN / 2 + 1.3; x < LEN / 2 - 1; x += 1.25) for (const z of [-1.36, 1.36]) win.push(new THREE.PlaneGeometry(0.8, 0.9).rotateY(z > 0 ? 0 : Math.PI).translate(x, 2.55, z));
    win.push(new THREE.PlaneGeometry(1.2, 0.8).rotateY(Math.PI / 2).translate(LEN / 2 + 0.01, 2.6, 0));
    const winGeo = merge(win);
    const lit = new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(2.4) });
    const cars = [];
    const id = allocInkId(CARS);
    for (let i = 0; i < CARS; i++) {
      const g = new THREE.Group();
      const b = new THREE.Mesh(body, M.iron);
      const w = new THREE.Mesh(winGeo, lit);
      w.userData.noRay = true; b.userData.noRay = true;
      g.add(b, w);
      tagInk(g, id + i);
      markFigure(b);
      group.add(g);
      cars.push(g);
    }
    const LAMP = new THREE.Vector3(LEN / 2 + 0.06, 3.25, 0);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.24, 20).rotateY(Math.PI / 2).translate(LAMP.x + 0.03, LAMP.y, 0), M.headlamp);
    lens.userData.emitter = true; lens.userData.noRay = true;
    tagInk(lens, id);
    cars[0].add(lens);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color().setScalar(1.7), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    halo.layers.set(LAYER.FX_REFL); halo.renderOrder = 6; halo.userData.noRay = true; halo.visible = false;
    scene.add(halo);
    const beam = makeConeMesh(stage.U, { apex: new THREE.Vector3(), axis: new THREE.Vector3(1, 0, 0), tan: 0.13, height: 30, r0: 0.2, intensity: 0.3, seed: 11.3 });
    beam.layers.set(LAYER.VOLUME); beam.frustumCulled = false; beam.visible = false;
    scene.add(beam);
    const _a = new THREE.Vector3(), _x = new THREE.Vector3(), _up = new THREE.Vector3(0, -1, 0), F = {};
    const deckTop = OVERPASS.deckY + OVERPASS.girderH - 0.1;
    // [O1b] the stations along the line (O1 Left 5: the train went round once
    // and was gone at the station it left): it runs the loop for ever now,
    // braking into each station on a curve a hand would drive, standing there
    // DWELL s with its windows lit (the doors' time), pulling out again
    const TRAIN = CARS * (LEN + GAP) - GAP, ACC = 1.1, DWELL = 14;
    const stopS = (el.stops || []).map((st) => {
      let best = 0, bd = Infinity;
      for (let s = 0; s < line.len; s += 1) { line.at(s, F); const d = Math.hypot(F.x - st.x, F.z - st.z); if (d < bd) { bd = d; best = s; } }
      return best;
    });
    const wrap = (s) => ((s % line.len) + line.len) % line.len;
    const api = {
      group, active: false, s: 0, dir: 1, onRumble: null, onSqueal: null, beam, halo, next: 8, run0: 0,
      v: 0, mode: 'run', waitT: 0, stopAt: -1, stops: stopS, waits: 0,
      light: stage.lights.add({ position: new THREE.Vector3(0, -50, 0), direction: new THREE.Vector3(0, -1, 0), halfAngle: Math.PI, range: 14, intensity: 0 }),
      run(s, dir = 1) {
        this.active = true; this.s = s; this.run0 = s; this.dir = dir; group.visible = true; beam.visible = true; halo.visible = true;
        this.v = SPEED; this.mode = 'run'; this.stopAt = -1;
      },
      stop() { this.active = false; group.visible = false; beam.visible = false; halo.visible = false; this.light.intensity = 0; if (this.onRumble) this.onRumble(0, null); },
      // the next station ahead of the train's middle, and how far (m)
      nextStop() {
        const mid = this.s - this.dir * TRAIN / 2;
        let best = -1, bd = Infinity;
        stopS.forEach((ss, i) => { const d = wrap((ss - mid) * this.dir); if (i !== this.left && d < bd) { bd = d; best = i; } });
        return { i: best, d: bd };
      },
      update(dt, t, { camera = null, canStart = true } = {}) {
        if (!this.active) {
          this.next -= dt;
          if (this.next <= 0 && canStart !== false) { this.dirN = -(this.dirN || -1); this.run(this.dirN > 0 ? 0 : line.len, this.dirN); this.next = WAIT; }
          return;
        }
        if (this.mode === 'wait') {
          this.waitT -= dt;
          if (this.waitT <= 0) { this.mode = 'run'; this.left = this.stopAt; this.since = 0; }
        } else {
          const N = stopS.length ? this.nextStop() : { i: -1, d: Infinity };
          // (the brake's curve: the speed it may have at this distance from the platform's middle)
          const vMax = Math.min(SPEED, Math.sqrt(2 * ACC * Math.max(0, N.d)));
          const v0 = this.v;
          this.v = Math.min(vMax, this.v + ACC * dt);
          if (this.v < v0 - 0.01 && this.onSqueal && N.d < 30 && this.v > 1) this.onSqueal(0.45, cars[0].position);
          if (N.i >= 0 && N.d < 0.4 && this.v < 0.6) { this.mode = 'wait'; this.waitT = DWELL; this.v = 0; this.stopAt = N.i; this.waits++; }
          // (the station it pulled out of is behind it once it has gone a train's length)
          if (this.left !== undefined && (this.since = (this.since || 0) + this.v * dt) > TRAIN + 10) this.left = undefined;
        }
        this.s += this.dir * this.v * dt;
        let nearest = null, nd = Infinity;
        for (let i = 0; i < CARS; i++) {
          const sc = this.s - this.dir * (i * (LEN + GAP) + LEN / 2);
          line.at(sc, F);
          const tr = 1.7 * (this.dir > 0 ? 1 : -1);
          const p = new THREE.Vector3(F.x - F.nx * tr, deckTop, F.z - F.nz * tr);
          const g = cars[i];
          g.position.copy(p);
          g.rotation.y = Math.atan2(-F.fz, F.fx) + (this.dir > 0 ? 0 : Math.PI);
          g.updateMatrixWorld(true);
          if (camera) { const d = p.distanceTo(camera.position); if (d < nd) { nd = d; nearest = p; } }
        }
        {
          const m = cars[0].matrixWorld;
          _a.copy(LAMP).applyMatrix4(m);
          _x.set(1, -0.06, 0).transformDirection(m);
          beam.position.copy(_a);
          beam.quaternion.setFromUnitVectors(_up, _x);
          beam.material.uniforms.uApex.value.copy(_a);
          beam.material.uniforms.uAxis.value.copy(_x);
          halo.position.copy(_a).addScaledVector(_x, 0.25);
          const d = camera ? _a.distanceTo(camera.position) : 60;
          halo.scale.setScalar(Math.min(6, 2.2 + d * 0.015));
          halo.material.opacity = 1 - 0.55 * Math.min(1, Math.max(0, (d - 140) / 220));
        }
        // ([O1b] the rumble with its speed: a train standing at a platform hums, it does not roar)
        const vk = 0.25 + 0.75 * Math.min(1, this.v / SPEED);
        if (this.onRumble) this.onRumble(nearest ? Math.max(0, 1 - nd / 140) * vk : 0, nearest);
        if (nearest) { this.light.position.copy(nearest).setY(nearest.y + 1.5); this.light.intensity = 0.9; }
        const G = stage.game;
        if (nearest && nd < 22 && G) G.controller.shake(0.1 * (1 - nd / 22) * vk, 0);
        this.s = wrap(this.s);
      },
    };
    return api;
  },
};

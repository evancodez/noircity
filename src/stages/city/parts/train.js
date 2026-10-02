import * as THREE from 'three';
import { LAYER, tagInk, allocInkId, markFigure } from '../../../render/layers.js';
import { makeConeMesh } from '../../../render/shaders/cone.js';
import { glowTexture } from '../../../vehicles/models.js';
import { merge, roundedBox } from '../../../world/geom.js';
import { OVERPASS } from '../../../world/Overpass.js';

// The el's train: four cars, their windows lit, its lamp a white eye seen a
// long way down the line (the landmark that moves: seen down the avenue and
// along Harbor St and the river, heard everywhere), sparks at the wheels
// now and then, the rumble through the Game's train sound. It runs the el's
// whole line on a timetable of its own (one way, then the other, a gap
// between): the Game steps every stage's train (update(dt, t, opts)).
const CARS = 4, LEN = 13.6, GAP = 0.9, SPEED = 15;
const PERIOD = 46;      // s between departures

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
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color().setScalar(1.7), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    halo.layers.set(LAYER.FX_REFL); halo.renderOrder = 6; halo.userData.noRay = true; halo.visible = false;
    scene.add(halo);
    const beam = makeConeMesh(stage.U, { apex: new THREE.Vector3(), axis: new THREE.Vector3(1, 0, 0), tan: 0.13, height: 30, r0: 0.2, intensity: 0.3, seed: 11.3 });
    beam.layers.set(LAYER.VOLUME); beam.frustumCulled = false; beam.visible = false;
    scene.add(beam);
    const _a = new THREE.Vector3(), _x = new THREE.Vector3(), _up = new THREE.Vector3(0, -1, 0), F = {};
    const deckTop = OVERPASS.deckY + OVERPASS.girderH - 0.1;
    const api = {
      group, active: false, s: 0, dir: 1, onRumble: null, onSqueal: null, beam, halo, next: 6,
      light: stage.lights.add({ position: new THREE.Vector3(0, -50, 0), direction: new THREE.Vector3(0, -1, 0), halfAngle: Math.PI, range: 14, intensity: 0 }),
      // a run along the line from s in dir (+1 from the north end)
      run(s, dir = 1) {
        this.active = true; this.s = s; this.dir = dir; group.visible = true; beam.visible = true; halo.visible = true;
        const lead = cars[0];
        if (lens.parent !== lead) lead.add(lens);
      },
      stop() { this.active = false; group.visible = false; beam.visible = false; halo.visible = false; this.light.intensity = 0; if (this.onRumble) this.onRumble(0, null); },
      stage() {},
      update(dt, t, { camera = null, canStart = true } = {}) {
        if (!this.active) {
          this.next -= dt;
          if (this.next <= 0 && canStart !== false) { this.dirN = -(this.dirN || -1); this.run(this.dirN > 0 ? -30 : line.len + 30, this.dirN); this.next = PERIOD; }
          return;
        }
        this.s += this.dir * SPEED * dt;
        let nearest = null, nd = Infinity;
        for (let i = 0; i < CARS; i++) {
          const sc = this.s - this.dir * (i * (LEN + GAP) + LEN / 2);
          line.at(sc, F);
          const off = sc < 0 ? sc : sc > line.len ? sc - line.len : 0;
          // (on the track nearer the way it is going)
          const tr = 1.7 * (this.dir > 0 ? 1 : -1);
          const p = new THREE.Vector3(F.x + F.fx * off - F.nx * tr, deckTop, F.z + F.fz * off - F.nz * tr);
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
        if (this.onRumble) this.onRumble(nearest ? Math.max(0, 1 - nd / 140) : 0, nearest);
        if (nearest) { this.light.position.copy(nearest).setY(nearest.y + 1.5); this.light.intensity = 0.9; }
        const L = stage.lamps;
        if (nearest && nd < 40 && L && L.tremble) L.tremble(nearest.x, nearest.z, (1 - nd / 40) * dt * 30);
        const G = stage.game;
        if (nearest && nd < 22 && G) G.controller.shake(0.1 * (1 - nd / 22), 0);
        const tail = this.s - this.dir * CARS * (LEN + GAP);
        if ((this.dir > 0 && tail > line.len + 40) || (this.dir < 0 && tail < -40)) this.stop();
      },
    };
    return api;
  },
};

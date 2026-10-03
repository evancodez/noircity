import * as THREE from 'three';
import { LAYER, tagInk, allocInkId, markFigure } from '../../../render/layers.js';
import { makeConeMesh } from '../../../render/shaders/cone.js';
import { glowTexture } from '../../../vehicles/models.js';
import { merge, roundedBox } from '../../../world/geom.js';
import { OVERPASS } from '../../../world/Overpass.js';

// [C6 2nd] The el's train over the avenue (the city's train, stages/city/
// parts/train.js, on the avenue's straight line, parts/avenue.js): three
// cars, their windows lit, its lamp a white eye down the line, the rumble
// through the Game's train sound (Game wires onRumble to sfx.train). It keeps
// no timetable of its own: the chapter sends it (`run(s, dir)`) as I come out
// of the press hall's dock, so it thunders over the avenue while I am under
// the el; the Game steps it (it ignores the Game's start: canStart).
//   api.run(s, dir)   from line distance s, dir +1 north (s up), -1 south
//   api.stop()
const CARS = 3, LEN = 13.6, GAP = 0.9, SPEED = 15;

export default {
  name: 'train', order: 120,
  build(stage) {
    const { scene, M } = stage;
    const av = stage.part('avenue');
    if (!av) return { active: false, update() {}, stage() {}, run() {}, stop() {}, onRumble: null, onSqueal: null };
    const line = av.line;
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
    const beam = makeConeMesh(stage.U, { apex: new THREE.Vector3(), axis: new THREE.Vector3(1, 0, 0), tan: 0.13, height: 30, r0: 0.2, intensity: 0.3, seed: 17.1 });
    beam.layers.set(LAYER.VOLUME); beam.frustumCulled = false; beam.visible = false;
    scene.add(beam);
    const _a = new THREE.Vector3(), _x = new THREE.Vector3(), _up = new THREE.Vector3(0, -1, 0), F = {};
    const deckTop = OVERPASS.deckY + OVERPASS.girderH - 0.1;
    const rng = stage.rng.fork(6812);
    const spill = stage.lights.add({ position: new THREE.Vector3(0, -50, 0), direction: new THREE.Vector3(0, -1, 0), halfAngle: 1.1, range: 12, intensity: 0 });
    const api = {
      group, active: false, s: 0, dir: 1, onRumble: null, onSqueal: null, beam, halo, line,
      light: stage.lights.add({ position: new THREE.Vector3(0, -50, 0), direction: new THREE.Vector3(0, -1, 0), halfAngle: Math.PI, range: 14, intensity: 0 }),
      run(s, dir = 1) {
        this.active = true; this.s = s; this.dir = dir; group.visible = true; beam.visible = true; halo.visible = true;
        const lead = cars[0];
        if (lens.parent !== lead) lead.add(lens);
      },
      stop() { this.active = false; group.visible = false; beam.visible = false; halo.visible = false; this.light.intensity = 0; spill.intensity = 0; if (this.onRumble) this.onRumble(0, null); },
      stage() {},
      update(dt, t, { camera = null } = {}) {
        if (!this.active) return;
        this.s += this.dir * SPEED * dt;
        let nearest = null, nd = Infinity;
        for (let i = 0; i < CARS; i++) {
          const sc = this.s - this.dir * (i * (LEN + GAP) + LEN / 2);
          line.at(sc, F);
          // (on the track nearer the way it is going)
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
        // (from under the el the train itself is hidden by its deck: what the
        // street sees is the light strobing down past the girder and the
        // sparks the wheels throw off the rail, spilling over the bottom
        // flange on the side of the eye - the block's train's way, world/Train.js)
        const FX = stage.fxRef || stage.fx;
        if (camera && FX && dt > 0) {
          const cam = camera.position;
          for (let i = 0; i < CARS; i++) {
            const g = cars[i], d = g.position.distanceTo(cam);
            if (d > 60 || !rng.chance(dt * 9)) continue;
            const side = Math.sign(cam.x - av.line.at(0, F).x) || 1;
            const along = (rng.chance(0.5) ? 1 : -1) * (LEN / 2 - 2.3);
            const wheel = new THREE.Vector3(F.x + side * (OVERPASS.halfW + 0.2), OVERPASS.deckY - 0.03, g.position.z + along);
            const sw = Math.max(0.006, 0.45 * rng.range(5, 6) * (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * wheel.distanceTo(cam)) / Math.max(1, stage.U.uRes.value.y));
            const nS = rng.int(6, 10);
            for (let n = 0; n < nS; n++) {
              // (thrown back along the rail - the train runs toward -dir in z - out over the girder, and down)
              const v = new THREE.Vector3(side * rng.range(0.6, 1.2) * 1.4, -rng.range(0.5, 1.5) * 1.4, this.dir * rng.range(1.2, 3.0) * 1.4);
              (FX.railSparks || FX.sparks).spawn({ pos: wheel.clone().add(new THREE.Vector3(rng.gauss() * 0.14, rng.gauss() * 0.04, rng.gauss() * 0.14)), vel: v, life: rng.range(0.25, 0.45), size: [sw, sw], stretch: 0.12, col: [1.6, 1.6, 1.6], cell: 4, gravity: 3, ground: 0.02, fadeOut: 0 });
            }
            if (this.onSqueal && rng.chance(0.3)) this.onSqueal(0.4, wheel);
          }
        }
        // the light down past the girder: under the deck's edge by the lead
        // cars, strobing with the windows passing the railing's posts
        if (nearest) {
          const k = Math.max(0, 1 - nd / 50);
          spill.position.set(nearest.x, OVERPASS.deckY - 0.4, nearest.z);
          spill.intensity = k * (0.55 + 0.45 * Math.abs(Math.sin(this.s / 1.7 * Math.PI)));
        } else spill.intensity = 0;
        if (this.onRumble) this.onRumble(nearest ? Math.max(0, 1 - nd / 140) : 0, nearest);
        if (nearest) { this.light.position.copy(nearest).setY(nearest.y + 1.5); this.light.intensity = 0.9; }
        const L = stage.lamps;
        if (nearest && nd < 40 && L && L.tremble) L.tremble(nearest.x, nearest.z, (1 - nd / 40) * dt * 30);
        const G = stage.game;
        if (nearest && nd < 22 && G && G.controller) G.controller.shake(0.1 * (1 - nd / 22), 0);
        const tail = this.s - this.dir * CARS * (LEN + GAP);
        if ((this.dir > 0 && tail > line.len + 40) || (this.dir < 0 && tail < -40)) this.stop();
      },
    };
    return api;
  },
};

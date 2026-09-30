import * as THREE from 'three';
import { tagInk, allocInkId, markFigure } from '../../../render/layers.js';
import { merge, roundedBox, V3 } from '../../../world/geom.js';
import { OVERPASS } from '../../../world/Overpass.js';
import { ROAD, roadPoint, frameAt } from '../road.js';

// One train on the river road's el (the scene runs it once: run(s, dir)).
// Four cars, their windows lit, sparks now and then at the wheels, the
// rumble through the Game's train sound. The Game steps every stage's
// train (active, update(dt, t, opts)); this one never starts on its own.
const CARS = 4, LEN = 13.6, GAP = 0.9, SPEED = 17;
const F = {};

export default {
  name: 'train', order: 120,
  build(stage) {
    const { scene, M } = stage;
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
    const api = {
      group, active: false, s: 0, dir: -1, onRumble: null, onSqueal: null,
      // the train at s (its head), running toward -1 (back up the road,
      // over the player's head) or +1
      run(s, dir = -1) { this.active = true; this.s = s; this.dir = dir; this.near = false; group.visible = true; },
      stop() { this.active = false; group.visible = false; this.light.intensity = 0; if (this.onRumble) this.onRumble(0, null); },
      light: stage.lights.add({ position: new THREE.Vector3(0, -50, 0), direction: new THREE.Vector3(0, -1, 0), halfAngle: Math.PI, range: 14, intensity: 0 }),
      update(dt, t, { camera = null } = {}) {
        if (!this.active) return;
        this.s += this.dir * SPEED * dt;
        let nearest = null, nd = Infinity;
        for (let i = 0; i < CARS; i++) {
          const sc = this.s - this.dir * (i * (LEN + GAP) + LEN / 2);
          const c = Math.max(0, Math.min(ROAD.len, sc));
          frameAt(c, F);
          const p = roadPoint(c, (ROAD.elA + ROAD.elB) / 2 + 1.7 * (this.dir > 0 ? 1 : -1), OVERPASS.deckY + OVERPASS.girderH - 0.1);
          p.x += F.fx * (sc - c); p.z += F.fz * (sc - c);
          const g = cars[i];
          g.position.copy(p);
          g.rotation.y = F.h + Math.PI / 2 + (this.dir > 0 ? 0 : Math.PI);
          g.updateMatrixWorld(true);
          if (camera) { const d = p.distanceTo(camera.position); if (d < nd) { nd = d; nearest = p; } }
        }
        if (this.onRumble) this.onRumble(nearest ? Math.max(0, 1 - nd / 140) : 0, nearest);
        // its lit windows light the rain round it; overhead, the iron shakes
        // the lamps on it and the car under it
        if (nearest) { this.light.position.copy(nearest).setY(nearest.y + 1.5); this.light.intensity = 0.9; }
        const L = stage.lamps;
        if (nearest && nd < 40 && L && L.tremble) L.tremble(nearest.x, nearest.z, (1 - nd / 40) * dt * 30);
        const G = stage.game;
        if (nearest && nd < 22 && G) G.controller.shake(0.12 * (1 - nd / 22), 0);
        const tail = this.s - this.dir * CARS * (LEN + GAP);
        if ((this.dir < 0 && tail < -200) || (this.dir > 0 && tail > ROAD.len + 200) || (camera && this.near && nd > 380)) this.stop();
        if (nd < 150) this.near = true;
      },
    };
    return api;
  },
};

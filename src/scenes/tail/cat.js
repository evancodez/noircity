import * as THREE from 'three';
import { merge, tube, V3 } from '../../world/geom.js';
import { tagInk, markFigure } from '../../render/layers.js';

// A cat in the rain (lane C3, 2nd owner): a black shape sitting on a
// doorstep, the tail round its feet, that bolts when a car comes close - a
// spring off the step and away along the pavement, low and quick - and is
// let go once it is out of the frame (never taken away in sight). Alive, a
// little; and for whoever pulls up beside it, an answer.
//   new Cat(chase, { x, z, yaw, path: [[x, z], ...], y?: a perch, near: 9.5, at?: s });
//   (it bolts when a moving car comes within `near`, or at the chase's time
//   `at`; runs the path's points and sits again at the last - or is let go
//   the moment it is out of the frame)
//   cat.step(dt); cat.dispose()
let GEO = null;
function geos() {
  if (GEO) return GEO;
  const ear = (s) => new THREE.ConeGeometry(0.028, 0.06, 4).translate(s * 0.035, 0.07, 0);
  const head = (y, z) => merge([new THREE.SphereGeometry(0.065, 10, 8).scale(1, 0.9, 1.05), ear(-1), ear(1)]).translate(0, y, z);
  // sitting: the body upright on its haunches, the tail round its feet
  const sit = merge([
    new THREE.SphereGeometry(0.1, 10, 8).scale(1, 1.55, 1.15).translate(0, 0.16, -0.02),
    head(0.34, 0.03),
    new THREE.SphereGeometry(0.05, 8, 6).scale(1, 0.6, 1.4).translate(0.05, 0.03, 0.08),
    tube([V3(0, 0.02, -0.12), V3(0.1, 0.02, -0.08), V3(0.14, 0.02, 0.04), V3(0.1, 0.02, 0.13)], 0.018, 5, 12),
  ]);
  // running: the body long and low, the head out, the tail out behind and up
  const run = merge([
    new THREE.SphereGeometry(0.1, 10, 8).scale(0.9, 0.85, 2.3).translate(0, 0.2, 0),
    head(0.26, 0.27),
    tube([V3(0, 0.22, -0.2), V3(0, 0.28, -0.36), V3(0, 0.36, -0.46)], 0.018, 5, 10),
  ]);
  const leg = new THREE.CylinderGeometry(0.016, 0.012, 0.16, 5).translate(0, -0.08, 0);
  GEO = { sit, run, leg };
  return GEO;
}

export class Cat {
  constructor(chase, { x, z, yaw = 0, path = [], y = null, near = 9.5, at = null } = {}) {
    this.chase = chase;
    const st = chase.stage, M = st.M;
    const G = geos();
    const g = new THREE.Group();
    g.name = 'cat';
    this.sit = new THREE.Mesh(G.sit, M.black);
    this.run = new THREE.Mesh(G.run, M.black);
    this.run.visible = false;
    g.add(this.sit, this.run);
    this.legs = [];
    for (const [lx, lz] of [[-0.05, 0.15], [0.05, 0.15], [-0.05, -0.14], [0.05, -0.14]]) {
      const l = new THREE.Mesh(G.leg, M.black);
      l.position.set(lx, 0.17, lz);
      l.visible = false;
      this.run.add(l);
      this.legs.push(l);
    }
    tagInk(g);
    markFigure(g);
    g.traverse((o) => { if (o.isMesh) o.userData.noRay = true; });
    this.y0 = y ?? (st.surfaceY ? st.surfaceY(x, z) : 0);
    this.near = near;
    g.position.set(x, this.y0, z);
    g.rotation.y = yaw;
    st.scene.add(g);
    this.g = g;
    this.path = path.slice();
    this.at = at;
    this.dir = [Math.sin(yaw), Math.cos(yaw)];
    this.aim();
    this.state = 'sit';
    this.t = 0;
  }

  dispose() { if (this.g.parent) this.g.parent.remove(this.g); }
  // toward the path's next point
  aim() {
    const p = this.path[0];
    if (!p) return false;
    const dx = p[0] - this.g.position.x, dz = p[1] - this.g.position.z, l = Math.hypot(dx, dz) || 1;
    this.dir = [dx / l, dz / l];
    return l;
  }

  step(dt) {
    const C = this.chase, g = this.g;
    if (this.state === 'gone') return;
    this.t += dt;
    if (this.state === 'sit' || this.state === 'rest') {
      // (an ear, the tail: alive)
      this.sit.rotation.y = Math.sin(this.t * 0.7) * 0.15;
      if (this.state === 'rest' || !this.path.length) return;
      if (this.at != null && C.t > this.at) { this.bolt(); return; }
      for (const v of [C.my, C.his, ...(C.traffic ? C.traffic.cars.map((c) => c.v) : [])]) {
        if (!v || v.speedAbs < 1.5) continue;
        if (Math.hypot(v.pos.x - g.position.x, v.pos.z - g.position.z) < this.near) { this.bolt(); break; }
      }
      return;
    }
    // (the next point of its way; at the last it sits again)
    const left = this.aim();
    if (left !== false && left < 0.3) {
      this.path.shift();
      if (!this.path.length) {
        this.state = 'rest'; this.t = 0;
        this.sit.visible = true; this.run.visible = false;
        g.position.y = C.stage.surfaceY ? C.stage.surfaceY(g.position.x, g.position.z) : this.y0;
        g.rotation.y += Math.PI;
        return;
      }
      this.aim();
    }
    g.rotation.y = Math.atan2(this.dir[0], this.dir[1]);
    // the spring off the step, then low and quick along the pavement
    const sp = this.state === 'spring' ? 3.5 : 7.5;
    g.position.x += this.dir[0] * sp * dt;
    g.position.z += this.dir[1] * sp * dt;
    const ground = C.stage.surfaceY ? C.stage.surfaceY(g.position.x, g.position.z) : this.y0;
    if (this.state === 'spring') {
      // (off the step, or down off its perch)
      const u = Math.min(1, this.t / (this.y0 - ground > 0.5 ? 0.5 : 0.32));
      g.position.y = this.y0 + (ground - this.y0) * u * u + Math.sin(u * Math.PI) * 0.35;
      if (u >= 1) { this.state = 'run'; this.t = 0; }
    } else {
      g.position.y = ground + Math.abs(Math.sin(this.t * 17)) * 0.05;
      this.run.rotation.x = Math.sin(this.t * 17) * 0.06;
      for (let i = 0; i < 4; i++) this.legs[i].rotation.x = Math.sin(this.t * 17 + (i < 2 ? 0 : Math.PI) + (i % 2) * 0.6) * 0.8;
      // out of the frame (and away a while): let go
      const cam = C.game.camera;
      if (this.t > 1.5) {
        const v = g.position.clone().project(cam);
        const behind = new THREE.Vector3().subVectors(g.position, cam.position).dot(cam.getWorldDirection(new THREE.Vector3())) < 0;
        if (behind || Math.abs(v.x) > 1.15 || Math.abs(v.y) > 1.15) { this.state = 'gone'; g.visible = false; }
      }
    }
  }

  bolt() {
    this.state = 'spring';
    this.t = 0;
    this.sit.visible = false;
    this.run.visible = true;
    for (const l of this.legs) l.visible = true;
    this.aim();
    this.g.rotation.y = Math.atan2(this.dir[0], this.dir[1]);
    const S = this.chase.game.sfx;
    if (S && S.live) S.play('grunt', this.g.position.clone().setY(0.3), { f0: 520, k: 0.12, dur: 0.09 }, { ref: 3 });
  }
}

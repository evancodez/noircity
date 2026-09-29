import * as THREE from 'three';
import { FIRE, ATLAS, FLASH } from './fxTextures.js';
import { BLOOD_AIR } from './Blood.js';
import { accent, accentMaterial } from '../render/accents.js';
import { LAYER } from '../render/layers.js';

// The story's small effects (lane 3's brief P0.3), reached through the
// stage's effects (game.fx):
//   fx.pour.start({ from: Object3D, to: Object3D, accent: 'amber', rate, fill: true }) / fx.pour.stop()
//       a thin stream from a bottle's mouth to a glass: a real tube falling
//       in an arc, swaying a little, a splash in the glass, the level rising
//   fx.cig.wisp(tipPos, key?)      a thin thread rising off a cigarette's tip,
//       curling, breaking up at ~0.5 m (call it every step while it burns)
//   fx.cig.exhale(mouthPos, dir)   a soft plume ~0.6 m long that slows, rolls
//       and rises (into the lamp cone above)
//   fx.hit.punch(pos, dir, power)  a fist landing: a small white ink burst
//       (the muzzle flash's splatter family, 2 frames), sweat drops, at
//       power > 0.7 a few drops of blood - never a fountain
// Smoke is grey and brushed (the thread a ribbon with a broken, dry-brush
// alpha; the plume the brushed smoke cells), never a soft sprite blob.
// Their draws come from forks of their own, never from the stage's shared rng.
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

// where a prop's stream leaves (the mouth: the top of its axis) and lands
// (the liquid's surface in a glass, else the top of its box)
function mouthOf(o, out) {
  const s = o.userData && o.userData.size;
  return o.localToWorld(out.set(0, s ? s.y : 0.1, 0));
}
function landOf(o, out) {
  const s = o.userData && o.userData.size;
  const f = o.userData && o.userData.fill != null ? o.userData.fill : 0.3;
  const h = s ? s.y : 0.1;
  return o.localToWorld(out.set(0, 0.014 + (h - 0.02) * Math.max(0.05, f) * 0.45, 0));
}

export class Pour {
  constructor(fx) {
    this.fx = fx;
    this.rng = fx.world.rng.fork(7101);
    this.on = null;
    this.mesh = null;
    this.t = 0;
  }
  start({ from, to, accent: key = 'amber', rate = 1, fill = true } = {}) {
    const c = accent(key);
    this.on = { from, to, rate, key, fill, col: [c.r * 2, c.g * 2, c.b * 2], acc: 0, t: 0 };
    if (!this.mesh) {
      this.mat = accentMaterial(key);
      this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.mat);
      this.mesh.userData.noRay = true;
      this.mesh.frustumCulled = false;
      this.fx.world.scene.add(this.mesh);
    }
    this.mesh.visible = true;
  }
  stop() { this.on = null; if (this.mesh) this.mesh.visible = false; }
  get active() { return !!this.on; }
  update(dt) {
    const P = this.on;
    if (!P || !P.from || !P.to) return;
    const r = this.rng;
    P.t += dt;
    mouthOf(P.from, _a); landOf(P.to, _b);
    // the stream: it leaves the lip along the bottle's tilt, falls in an arc
    // into the glass; the middle sways a few millimetres
    const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(P.from.getWorldQuaternion(new THREE.Quaternion()));
    axis.y = Math.min(axis.y, 0.2);
    const sway = new THREE.Vector3(Math.sin(P.t * 7.3) * 0.004, 0, Math.cos(P.t * 5.1) * 0.004);
    const c1 = _a.clone().addScaledVector(axis.normalize(), 0.035).add(sway);
    const c2 = _b.clone().add(new THREE.Vector3(0, Math.max(0.04, (_a.y - _b.y) * 0.4), 0)).addScaledVector(sway, 1.5);
    const curve = new THREE.CubicBezierCurve3(_a.clone(), c1, c2, _b.clone());
    // (a thin tube, thinning as it falls and speeds up)
    const w = 0.0032 * Math.min(1.3, P.rate);
    const g = new THREE.TubeGeometry(curve, 18, w, 6, false);
    const pos = g.getAttribute('position'), nrm = g.getAttribute('normal');
    // taper: pull the rings toward the curve down its length
    for (let i = 0; i < pos.count; i++) {
      const ring = Math.floor(i / 7);
      const u = ring / 18;
      const k = 1 - 0.35 * u;
      const p = curve.getPoint(u);
      pos.setXYZ(i, p.x + (pos.getX(i) - p.x) * k, p.y + (pos.getY(i) - p.y) * k, p.z + (pos.getZ(i) - p.z) * k);
    }
    void nrm;
    const old = this.mesh.geometry;
    this.mesh.geometry = g;
    old.dispose();
    // the splash in the glass: drops jumping off the surface
    P.acc += dt * 40 * P.rate;
    while (P.acc >= 1) {
      P.acc -= 1;
      this.fx.debris.spawn({
        pos: _b.clone(), vel: new THREE.Vector3(r.gauss() * 0.15, r.range(0.2, 0.5), r.gauss() * 0.15), life: r.range(0.08, 0.16), size: [0.004, 0.006], rot: 0, spin: 0,
        col: P.col, cell: FIRE.EMBER, gravity: 9.8, ground: _b.y - 0.01, fadeOut: 0.03,
      });
    }
    // the level rises
    if (P.fill && P.to.userData && P.to.userData.setFill) P.to.userData.setFill(Math.min(0.62, (P.to.userData.fill || 0) + dt * 0.28 * P.rate));
  }
}

// A cigarette's thread: points leave the tip and rise, curling in a slow
// field; drawn as a thin camera-facing ribbon whose alpha is broken like a
// dry brush, widening as it rises, falling apart from ~0.35 m and gone by
// ~0.55 m
class Thread {
  constructor(fx) {
    this.fx = fx;
    this.pts = [];
    this.lastT = -1;
    this.seed = 1.7;
    const max = 90;
    this.max = max;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 2 * 3);
    this.col = new Float32Array(max * 2 * 4);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 4));
    const idx = [];
    for (let i = 0; i < max - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false;
    this.mesh.layers.set(LAYER.FX);
    this.mesh.renderOrder = 3;
    this.mesh.userData.noRay = true;
    fx.world.scene.add(this.mesh);
  }
  update(dt, t, cam, rng) {
    const P = this.pts;
    for (const p of P) {
      p.age += dt;
      const h = p.p.y - p.y0;
      // rising faster as it goes, a slow curl that grows with height
      // (one field for the whole thread: a point's own phase tore it into
      // zig-zags)
      const cx = Math.sin(p.p.y * 14 + t * 1.3 + this.seed) * 0.12 + Math.sin(p.p.y * 31 + t * 2.1) * 0.05;
      const cz = Math.cos(p.p.y * 11 + t * 1.1 + this.seed * 1.3) * 0.12;
      p.p.x += (cx * (0.4 + h * 5)) * dt;
      p.p.z += (cz * (0.4 + h * 5)) * dt;
      p.p.y += (0.09 + h * 0.35) * dt;
    }
    while (P.length && (P[0].age > 5 || P[0].p.y - P[0].y0 > 0.6)) P.shift();
    // the ribbon
    const n = Math.min(P.length, this.max);
    const toCam = new THREE.Vector3();
    for (let i = 0; i < this.max; i++) {
      const j = i < n ? P.length - 1 - i : -1;
      if (j < 0) { this.col[i * 8 + 3] = 0; this.col[i * 8 + 7] = 0; continue; }
      const p = P[j].p, q = P[Math.max(0, j - 1)].p, s = P[Math.min(P.length - 1, j + 1)].p;
      const tan = _c.subVectors(q, s);
      if (tan.lengthSq() < 1e-10) tan.set(0, 1, 0);
      toCam.subVectors(cam, p).normalize();
      const side = _a.crossVectors(tan, toCam).normalize();
      const h = p.y - P[j].y0;
      const w = 0.0016 + h * 0.012;
      this.pos.set([p.x + side.x * w, p.y + side.y * w, p.z + side.z * w], i * 6);
      this.pos.set([p.x - side.x * w, p.y - side.y * w, p.z - side.z * w], i * 6 + 3);
      // (dry brush: the alpha breaks in bits that grow with height)
      const fade = Math.max(0, 1 - h / 0.55) * Math.min(1, P[j].age * 6);
      // (it breaks up into strands and gaps above ~12 cm, more the higher)
      const brk = h < 0.12 ? 1 : (Math.sin(j * 0.55 + P[j].seed * 0.3) * 0.5 + 0.5) > (h - 0.12) * 2.4 ? 1 : 0.05;
      const a = 0.8 * fade * brk;
      const g = 0.22 + h * 0.1;
      for (let k = 0; k < 2; k++) this.col.set([g, g, g, a * (k === 0 ? 1 : 0.8)], (i * 2 + k) * 4);
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.color.needsUpdate = true;
    this.mesh.geometry.setDrawRange(0, Math.max(0, (n - 1) * 6));
    this.mesh.visible = n > 1;
    void rng;
  }
}

export class Cig {
  constructor(fx) { this.fx = fx; this.rng = fx.world.rng.fork(7102); this.threads = new Map(); this.t = 0; this.plumes = []; }
  // a thread of smoke off the tip (call it every step while it burns)
  wisp(tip, key = 'player') {
    let T = this.threads.get(key);
    if (!T) { T = new Thread(this.fx); this.threads.set(key, T); }
    if (this.t - T.lastT < 1 / 40) return;
    T.lastT = this.t;
    T.pts.push({ p: tip.clone(), y0: tip.y, age: 0, seed: this.rng.next() * 10 });
    if (T.pts.length > T.max) T.pts.shift();
  }
  // a plume breathed out: pushed out along `dir`, slowing, rolling, rising
  exhale(mouth, dir = new THREE.Vector3(0, 0, -1)) {
    this.plumes.push({ mouth: mouth.clone(), dir: dir.clone().normalize(), t: 0, acc: 0 });
  }
  update(dt) {
    this.t += dt;
    const cam = this.fx.world.game ? this.fx.world.game.camera.position : null;
    if (cam) for (const T of this.threads.values()) T.update(dt, this.t, cam, this.rng);
    const r = this.rng;
    for (let i = this.plumes.length - 1; i >= 0; i--) {
      const P = this.plumes[i];
      P.t += dt;
      // a breath lasts ~0.6 s, strongest at first
      const k = Math.max(0, 1 - P.t / 0.6);
      P.acc += dt * 60 * k;
      while (P.acc >= 1) {
        P.acc -= 1;
        const s = r.range(0.025, 0.045);
        this.fx.smoke.spawn({
          pos: P.mouth.clone().addScaledVector(P.dir, 0.03).add(new THREE.Vector3(r.gauss() * 0.01, r.gauss() * 0.01, r.gauss() * 0.01)),
          vel: P.dir.clone().multiplyScalar(r.range(0.8, 1.4) * (0.5 + k)).add(new THREE.Vector3(r.gauss() * 0.06, r.range(0.02, 0.08), r.gauss() * 0.06)),
          life: r.range(2.2, 3.4), size: [s, s], grow: r.range(0.16, 0.26), rot: r.next() * 6.28, spin: r.gauss() * 0.5,
          col: [0.05, 0.05, 0.05], colEnd: [0.06, 0.06, 0.06], alpha: r.range(0.18, 0.26), drag: 2.6, gravity: -0.12,
          fadeIn: 0.05, fadeOut: 1.0, cell: FIRE.SMOKE[r.int(0, 3)],
        });
      }
      if (P.t > 0.7) this.plumes.splice(i, 1);
    }
  }
}

export class Punch {
  constructor(fx) { this.fx = fx; this.rng = fx.world.rng.fork(7103); this.queue = []; }
  punch(pos, dir = new THREE.Vector3(0, 0, -1), power = 0.5) {
    const r = this.rng, F = this.fx;
    const d = dir.clone().normalize();
    // the white ink burst: the muzzle flash's splatter, two frames
    const s = 0.22 + 0.3 * power;
    const W = F.flash && F.flash.world3;
    if (W) {
      W.spawn({ pos: pos.clone(), life: 1.01 / 60, size: [s, s], rot: r.next() * 6.28, col: [3.2, 3.2, 3.2], cell: FLASH.RADIAL[r.int(0, 5)], fadeOut: 0 });
      this.queue.push({ pos: pos.clone().addScaledVector(d, 0.03), s: s * 0.7, rot: r.next() * 6.28, cell: FLASH.SMALL[r.int(0, 1)], t: 1 });
    }
    // sweat: a spray of fine pale drops flung on with the blow
    for (let k = 0; k < 8 + 8 * power; k++) {
      const v = new THREE.Vector3(r.gauss(), r.gauss() * 0.6 + 0.3, r.gauss()).normalize().multiplyScalar(r.range(0.6, 2.2)).addScaledVector(d, r.range(0.8, 2));
      F.splash.spawn({ pos: pos.clone(), vel: v, life: r.range(0.25, 0.5), size: [0.006, 0.012], stretch: 0.02, col: [0.45, 0.45, 0.45], alpha: 0.9, cell: ATLAS.DROP, gravity: 9.8, ground: 0.16, fadeOut: 0.15 });
    }
    // a hard one: a few drops of blood (never a fountain)
    if (power > 0.7) {
      for (let k = 0; k < 3 + Math.round((power - 0.7) * 8); k++) {
        const v = new THREE.Vector3(r.gauss() * 0.5, r.range(0.3, 1.1), r.gauss() * 0.5).addScaledVector(d, r.range(0.8, 1.6));
        F.blood.spawn({ pos: pos.clone(), vel: v, life: r.range(0.4, 0.7), size: [0.01, 0.016], stretch: 0.02, col: BLOOD_AIR, cell: 0, gravity: 9.8, ground: 0.16, fadeOut: 0.1 });
      }
    }
  }
  update() {
    const W = this.fx.flash && this.fx.flash.world3;
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const q = this.queue[i];
      if (--q.t > 0) continue;
      if (W) W.spawn({ pos: q.pos, life: 1.01 / 60, size: [q.s, q.s], rot: q.rot, col: [2.6, 2.6, 2.6], cell: q.cell, fadeOut: 0 });
      this.queue.splice(i, 1);
    }
  }
}

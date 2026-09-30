import * as THREE from 'three';
import { allocInkId } from '../../render/layers.js';

// The watcher's umbrella (lane B4): black, open, eight panels between eight
// ribs, a long shaft, a crook handle. Object first: while he holds it, its
// place is authored (the grip at his right fist, the shaft upright, tipped a
// little into the wind) and his hand is posed onto the grip; when he lets
// it go it tips, drops and rolls on its rim in the wind until it lies on
// its side in the wet, rim and handle on the ground (never through it,
// never in the air).
//   const u = makeUmbrella(stage)       its group, in the stage's scene
//   u.hold(fig)                         in his right hand
//   u.drop(vel)                         let go (vel: the hand's, m/s)
//   u.lie(x, z, yaw)                    at rest on the street at once
//   u.update(dt)                        every step
const UP = new THREE.Vector3(0, 1, 0);
const R = 0.52, H = 0.3, SHAFT = 0.86, GRIP = 0.12;
let MATS = null;

function canopyGeo() {
  const na = 96, nr = 14;
  const pos = [], idx = [];
  for (let j = 0; j <= nr; j++) {
    const v = j / nr;
    for (let i = 0; i <= na; i++) {
      const a = (i / na) * Math.PI * 2;
      // between the ribs the cloth sags in and the hem scallops up
      const panel = 0.5 - 0.5 * Math.cos(8 * a);
      const r = R * v * (1 - 0.055 * panel * v);
      const y = H * (1 - Math.pow(v, 1.7)) - 0.035 * panel * v * (1 - v) * 3 + 0.03 * panel * v * v;
      pos.push(Math.cos(a) * r, y, Math.sin(a) * r);
    }
  }
  for (let j = 0; j < nr; j++) for (let i = 0; i < na; i++) {
    const a = j * (na + 1) + i, b = a + na + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function build() {
  if (!MATS) {
    MATS = {
      cloth: new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.55, metalness: 0.0, side: THREE.DoubleSide }),
      metal: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.6 }),
      wood: new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.6 }),
    };
  }
  // local frame: the grip's middle at the origin, the shaft up +y, the crook
  // hooking toward -z
  const g = new THREE.Group();
  const top = GRIP + SHAFT;
  const canopy = new THREE.Mesh(canopyGeo(), MATS.cloth);
  canopy.position.y = top - H;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, SHAFT + 0.12, 8).translate(0, GRIP + (SHAFT + 0.12) / 2 - 0.02, 0), MATS.metal);
  const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.008, 0.1, 8).translate(0, top + 0.05, 0), MATS.metal);
  // the crook: a J of wood under the grip
  const pts = [];
  for (let i = 0; i <= 16; i++) { const a = (i / 16) * Math.PI * 1.1; pts.push(new THREE.Vector3(0, -0.05 - Math.sin(a) * 0.05, -0.05 + Math.cos(a) * 0.05)); }
  pts.unshift(new THREE.Vector3(0, GRIP, 0));
  const crook = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 28, 0.014, 8), MATS.wood);
  // the ribs under the cloth, and their tips at the hem
  const ribs = [];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const p = [];
    for (let j = 0; j <= 8; j++) { const v = j / 8; p.push(new THREE.Vector3(Math.cos(a) * R * v, top - H + H * (1 - Math.pow(v, 1.7)) - 0.006, Math.sin(a) * R * v)); }
    ribs.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(p), 12, 0.004, 5));
    ribs.push(new THREE.SphereGeometry(0.009, 6, 4).translate(Math.cos(a) * R * 1.005, top - H - 0.004, Math.sin(a) * R * 1.005));
  }
  const rib = new THREE.Mesh(mergeGeos(ribs), MATS.metal);
  g.add(canopy, shaft, ferrule, crook, rib);
  const id = allocInkId();
  g.traverse((o) => { if (o.isMesh) { o.userData.inkId = id; o.userData.inkFigure = true; o.userData.noRay = true; o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function mergeGeos(list) {
  const n = list.map((g) => (g.index ? g.toNonIndexed() : g));
  let count = 0;
  for (const g of n) count += g.getAttribute('position').count;
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3);
  let o = 0;
  for (const g of n) { pos.set(g.getAttribute('position').array, o * 3); nor.set(g.getAttribute('normal').array, o * 3); o += g.getAttribute('position').count; }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}

// the lowest point of the umbrella turned by q, below its origin (the rim's
// or the crook's)
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _a = new THREE.Vector3();
function lowest(q) {
  let lo = Infinity;
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    _v.set(Math.cos(a) * R, GRIP + SHAFT - H, Math.sin(a) * R).applyQuaternion(q);
    lo = Math.min(lo, _v.y);
  }
  for (const p of [[0, GRIP + SHAFT + 0.1, 0], [0, -0.1, -0.05], [0, -0.05, -0.1]]) { _v.set(...p).applyQuaternion(q); lo = Math.min(lo, _v.y); }
  return lo;
}

export function makeUmbrella(stage) {
  const g = build();
  stage.scene.add(g);
  const u = {
    group: g, state: 'rest', fig: null, t: 0,
    pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, tilt: 0, tiltV: 0, spin: 0, spinV: 0, axis: new THREE.Vector3(1, 0, 0), ground: 0,
    hold(fig) { this.fig = fig; this.state = 'held'; g.visible = true; },
    // let go: it keeps the hand's velocity, tips away (the wind at its back)
    drop(vel = new THREE.Vector3(), { wind = new THREE.Vector3(0.6, 0, 0.2) } = {}) {
      this.state = 'fall'; this.t = 0;
      this.pos.copy(g.position);
      this.vel.copy(vel);
      this.wind = wind.clone();
      // it goes over toward the wind's side
      const w = wind.clone().setY(0);
      if (w.lengthSq() < 1e-6) w.set(1, 0, 0);
      w.normalize();
      this.axis.set(w.z, 0, -w.x);   // (a turn about it tips the top toward w)
      this.tilt = 0.12; this.tiltV = 2.6; this.spin = 0; this.spinV = 1.8;
      this.ground = stage.surfaceY(this.pos.x, this.pos.z);
    },
    lie(x, z, yaw = 0) {
      this.state = 'rest'; this.fig = null; g.visible = true;
      this.pos.set(x, 0, z); this.ground = stage.surfaceY(x, z);
      this.axis.set(Math.cos(yaw), 0, -Math.sin(yaw));
      this.tilt = 1.2; this.spin = yaw * 0.7;
      this.pose();
    },
    pose() {
      _q.setFromAxisAngle(this.axis, this.tilt);
      const qs = new THREE.Quaternion().setFromAxisAngle(UP, this.spin);
      g.quaternion.copy(_q).multiply(qs);
      g.position.copy(this.pos);
      // (never through the street: resting on its lowest point)
      const lo = lowest(g.quaternion);
      if (this.state !== 'held') g.position.y = Math.max(g.position.y, this.ground - lo);
      g.updateMatrixWorld(true);
    },
    update(dt) {
      if (this.state === 'held' && this.fig) {
        // the grip at his right fist, the shaft up, tipped a little forward
        // and into the wind; it rides the hand's height
        const F = this.fig;
        const hb = F.bones.handR;
        hb.updateMatrixWorld(true);
        const p = _a.setFromMatrixPosition(hb.matrixWorld);
        g.position.copy(p);
        const fx = Math.sin(F.yaw), fz = Math.cos(F.yaw);
        g.quaternion.setFromAxisAngle(_v.set(fz, 0, -fx).normalize(), 0.1).multiply(_q.setFromAxisAngle(_v.set(1, 0, 0), -0.05));
        g.updateMatrixWorld(true);
        return;
      }
      if (this.state !== 'fall') return;
      this.t += dt;
      // the fall: gravity against the open canopy's drag, the wind's push;
      // it tips over (a spring toward lying on its side, overshooting once),
      // spins on its rim as it rolls, and slows to rest
      this.vel.y -= 9.8 * dt;
      this.vel.addScaledVector(this.wind, dt * 1.6);
      this.vel.multiplyScalar(Math.exp(-dt * (this.pos.y > this.ground + 0.25 ? 2.2 : 3.2)));
      this.pos.addScaledVector(this.vel, dt);
      if (this.pos.y < this.ground) { this.pos.y = this.ground; if (this.vel.y < 0) this.vel.y *= -0.15; this.vel.x *= 0.96; this.vel.z *= 0.96; }
      const rest = 1.2;
      this.tiltV += ((rest - this.tilt) * 26 - this.tiltV * 3.2) * dt;
      this.tilt += this.tiltV * dt;
      this.spinV *= Math.exp(-dt * 0.9);
      this.spin += this.spinV * dt;
      this.wind.multiplyScalar(Math.exp(-dt * 0.5));
      this.pose();
      if (this.t > 5) this.state = 'rest';
    },
  };
  return u;
}

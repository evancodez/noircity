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

// where a prop's stream leaves: the lip's lowest point (userData.mouth, or
// the neck's lip on the axis, else the top of its axis, moved down its
// rim to the side the pour hangs from) and lands (the liquid's surface in a
// glass, else the top of its box)
const _q = new THREE.Quaternion();
function mouthOf(o, out, axisOut = null) {
  const ud = o.userData || {};
  const s = ud.size;
  const m = ud.mouth || ud.neck || ud.spout;
  if (m) out.copy(m); else out.set(0, s ? s.y : 0.1, 0);
  o.localToWorld(out);
  const ax = (axisOut || new THREE.Vector3()).set(0, 1, 0).applyQuaternion(o.getWorldQuaternion(_q));
  // (the lip's low side: the rim radius toward the world's down, square to the axis)
  const r = m && m.r != null ? m.r : 0.015;
  const d = new THREE.Vector3(0, -1, 0).addScaledVector(ax, ax.y);
  if (d.lengthSq() > 1e-6) out.addScaledVector(d.normalize(), r);
  return out;
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
  // accent 'coffee' is no accent: a black stream (the coffee is ink, not colour)
  start({ from, to, accent: key = 'amber', rate = 1, fill = true } = {}) {
    const dark = key === 'coffee';
    const c = dark ? { r: 0.02, g: 0.02, b: 0.02 } : accent(key);
    this.on = { from, to, rate, key, fill, col: [c.r * 2, c.g * 2, c.b * 2], acc: 0, t: 0 };
    if (!this.mesh) {
      this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), null);
      this.mesh.userData.noRay = true;
      this.mesh.frustumCulled = false;
      this.fx.world.scene.add(this.mesh);
    }
    this.mats = this.mats || {};
    this.mesh.material = this.mats[key] || (this.mats[key] = dark ? new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.4 }) : accentMaterial(key));
    this.mesh.visible = true;
  }
  stop() { this.on = null; if (this.mesh) this.mesh.visible = false; }
  get active() { return !!this.on; }
  update(dt) {
    const P = this.on;
    if (!P || !P.from || !P.to) return;
    const r = this.rng;
    P.t += dt;
    const axis = new THREE.Vector3();
    mouthOf(P.from, _a, axis); landOf(P.to, _b);
    // the stream (round 2): what a pour is - the scotch leaves the lip
    // moving along the bottle's axis, slowly, and falls: a parabola from the
    // lip down to the surface in the glass, 3.5 mm across as it leaves,
    // thinning as it speeds up (the flow is the same through every section:
    // r ~ v^-1/2), swaying a few millimetres at its foot. It never bends
    // back up, never aims at the glass: where it lands is where the lip is.
    const v0 = 0.2 * Math.min(1.2, P.rate);
    const vx = axis.x * v0, vz = axis.z * v0, vy = Math.min(0, axis.y) * v0;
    const drop = Math.max(0.01, _a.y - _b.y);
    // (time to fall `drop` from vy: g/2 t^2 - vy t - drop = 0)
    const g0 = 9.81, T = (vy + Math.sqrt(vy * vy + 2 * g0 * drop)) / g0;
    const N = 16;
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const t = T * i / N;
      const k = i / N;
      // (the sway grows down the stream: the foot wanders, the lip holds)
      const sw = 0.0025 * k * k;
      pts.push(new THREE.Vector3(_a.x + vx * t + Math.sin(P.t * 7.3 + k * 2) * sw, _a.y + vy * t - 0.5 * g0 * t * t, _a.z + vz * t + Math.cos(P.t * 5.9 + k * 2) * sw));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const w = 0.00175 * Math.min(1.3, P.rate);
    const g = new THREE.TubeGeometry(curve, N, w, 6, false);
    const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const ring = Math.floor(i / 7);
      const u = ring / N;
      const t = T * u;
      const v = Math.hypot(vx, vz, vy - g0 * t);
      const k = Math.sqrt(v0 / Math.max(v0, v)) * 0.55 + 0.45;
      const p = curve.getPoint(u);
      pos.setXYZ(i, p.x + (pos.getX(i) - p.x) * k, p.y + (pos.getY(i) - p.y) * k, p.z + (pos.getZ(i) - p.z) * k);
    }
    _b.set(pts[N].x, _b.y, pts[N].z);
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

// A cigarette's thread (Wave A fix D1). What a smoker sees at arm's length:
// a hair-thin grey line that rises straight off the tip for ~10 cm (the
// laminar part), then starts to waver, then tears into two or three thin
// curls that wind about each other by ~40 cm, and is gone by ~70 cm. It is
// never a tube and never white: mid grey, half transparent, 2-4 px wide at
// arm's length, so over the lit counter it is a faint darker hair and over
// the dark back bar a pale one.
// Points leave the tip (30 a second) and rise, faster as they go; above the
// laminar run one slow field pushes them about (one field for the whole
// thread: a point's own phase tore it into zig-zags), and the draught from
// the diner's door, while it stands open, leans the whole thread away from
// it. Drawn as up to three camera-facing strands that share the points: at
// the tip they lie on one another (one line); higher up the side strands
// swing out from it, each on its own slow phase, and the line's weight goes
// to them. Each strand is three vertices across (edge, core, edge: alpha
// 0 / a / 0), so a 3 px hair has a soft edge instead of a stair-stepped one.
// The strands break in gaps that ride up with the smoke (the gap belongs to
// the points, not to the height).
const THREAD = {
  rate: 30,            // points a second
  max: 128,            // points kept: ~4 s of rise, the top at ~0.7 m
  laminar: 0.10,       // m of straight rise
  split: [0.12, 0.40], // the curls part between these heights (m)
  gone: [0.46, 0.70],  // and fade out between these
  w0: 0.001,           // half width of a strand's core at the tip (m): ~3 px at 0.45 m
  w1: 0.0014,          // ... and at the top
  // (scene-linear grey x alpha: display ~0.6 on black (tone.js), a paler
  // hair over the lit back-bar glass, a darker one over the lit counter;
  // round 2: a little surer - it read as nothing at the seat)
  grey: 0.22,
  alpha: 0.6,
};
const STRANDS = 3;
const _s = new THREE.Vector3(), _t = new THREE.Vector3(), _e = new THREE.Vector3();
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
class Thread {
  constructor(fx) {
    this.fx = fx;
    this.pts = [];
    this.lastT = -1;
    this.seed = 1.7;
    const max = THREAD.max;
    this.max = max;
    const g = new THREE.BufferGeometry();
    const nv = STRANDS * max * 3;
    this.pos = new Float32Array(nv * 3);
    this.col = new Float32Array(nv * 4);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 4));
    const idx = [];
    for (let k = 0; k < STRANDS; k++) {
      for (let i = 0; i < max - 1; i++) {
        const a = (k * max + i) * 3, b = a + 3;
        // (edge L - core - edge R, two quads per segment)
        idx.push(a, a + 1, b, a + 1, b + 1, b, a + 1, a + 2, b + 1, a + 2, b + 2, b + 1);
      }
    }
    g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    this.mesh.frustumCulled = false;
    this.mesh.layers.set(LAYER.FX);
    this.mesh.renderOrder = 3;
    this.mesh.userData.noRay = true;
    fx.world.scene.add(this.mesh);
  }
  // the draught through the diner's door while it stands open: a push away
  // from the doorway, weaker the further in (m/s, horizontal)
  draught(p, out) {
    out.set(0, 0, 0);
    const st = this.fx.world;
    const F = st && st.part ? st.part('dinerFront') : null;
    const d = F && F.door;
    if (!d || !(d.angle > 0.01) || !d.object) return out;
    d.object.getWorldPosition(_e);
    const dx = p.x - _e.x, dz = p.z - _e.z, l = Math.hypot(dx, dz) || 1;
    const k = d.angle * 0.13 * (1 - 0.6 * sstep(3, 10, l));
    return out.set(dx / l * k, 0, dz / l * k);
  }
  update(dt, t, cam, rng) {
    const P = this.pts, T = THREAD;
    const lean = this.draught(P.length ? P[P.length - 1].p : _e.set(0, 0, 0), _t);
    for (const p of P) {
      p.age += dt;
      const h = p.p.y - p.y0;
      // (the column itself only drifts a little, slowly, above the laminar
      // run; the waver and the curls are laid on it where it is drawn)
      const wv = sstep(T.laminar, T.laminar * 3, h) * (0.004 + 0.03 * h);
      const cx = Math.sin(p.p.y * 6 + t * 0.35 + this.seed);
      const cz = Math.cos(p.p.y * 5 + t * 0.3 + this.seed * 1.3);
      p.p.x += (cx * wv + lean.x * (0.35 + h)) * dt;
      p.p.z += (cz * wv + lean.z * (0.35 + h)) * dt;
      p.p.y += (0.09 + h * 0.33) * dt;
    }
    while (P.length && (P[0].age > 6 || P[0].p.y - P[0].y0 > T.gone[1])) P.shift();
    // the strands: first where each strand's core runs (C), then the
    // ribbons across its own drawn path (a curl that loops over keeps its
    // width all the way round)
    const n = Math.min(P.length, this.max);
    const max = this.max;
    const C = this.core || (this.core = new Float32Array(STRANDS * max * 3));
    const AL = this.al || (this.al = new Float32Array(STRANDS * max));
    const toCam = _a;
    for (let i = 0; i < n; i++) {
      const j = P.length - 1 - i;
      const pt = P[j], p = pt.p;
      toCam.subVectors(cam, p).normalize();
      // (across the view, horizontal: the plane the curls wind in)
      const side = _b.crossVectors(UP, toCam);
      if (side.lengthSq() < 1e-10) side.set(1, 0, 0);
      side.normalize();
      const h = p.y - pt.y0;
      const sp = sstep(T.split[0], T.split[1], h);
      const fade = (1 - sstep(T.gone[0], T.gone[1], h)) * Math.min(1, pt.age * 8);
      // the waver: a wave travelling up the column (the undulation a still
      // room puts in a thread once it leaves the laminar run), ~8 cm long,
      // its swing growing to a couple of cm; two axes out of step, so it winds
      const A = 0.014 * sstep(T.laminar * 0.8, T.laminar * 2.6, h) * (1 + 1.5 * h);
      const wx = A * Math.sin(h * 75 - t * 3.1 + this.seed), wz = A * 0.8 * Math.sin(h * 64 - t * 2.7 + this.seed * 2.1 + 1.1);
      for (let k = 0; k < STRANDS; k++) {
        // a curl: the strand's core turns round a point riding up the
        // column, in the plane across the view; once the radius passes
        // 1 / (the wave number) the path loops back on itself (a curl).
        // The middle strand keeps to the column, the side ones part from it
        const ph = k * 2.09 + this.seed;
        const kk = 58 + 11 * k;
        const r = (k === 0 ? 0.3 : 1) * sp * (0.004 + 0.075 * Math.max(0, h - T.split[0]));
        const th = h * kk - t * (2.4 + 0.45 * k) + ph;
        const drift = k === 0 ? 0 : (k === 1 ? 1 : -1) * sp * 0.15 * Math.max(0, h - T.split[0]);
        _s.copy(p).add(_e.set(wx, 0, wz)).addScaledVector(side, r * Math.cos(th) + drift);
        _s.y += r * 0.85 * Math.sin(th);
        C[(k * max + i) * 3] = _s.x; C[(k * max + i) * 3 + 1] = _s.y; C[(k * max + i) * 3 + 2] = _s.z;
        // the line's weight: at the tip all on the middle strand, higher up
        // shared out to the curls
        const share = k === 0 ? 1 - 0.5 * sp : 0.7 * sp;
        // gaps that rise with the smoke: a strand breaks where its own
        // phase says so, more often the higher it is
        const gap = h < T.split[0] ? 1 : (Math.sin(j * 0.31 + k * 1.9 + pt.seed * 0.2) * 0.5 + 0.5) > 0.1 + 1.2 * sp * (h - T.split[0]) ? 1 : 0.1;
        // (either side of a break: nothing drawn across it)
        const brk = pt.cut || (P[j + 1] && P[j + 1].cut) ? 0 : 1;
        AL[k * max + i] = T.alpha * fade * share * gap * brk;
      }
    }
    for (let k = 0; k < STRANDS; k++) {
      for (let i = 0; i < max; i++) {
        const v = (k * max + i) * 3;
        if (i >= n) { this.col[v * 4 + 3] = 0; this.col[v * 4 + 7] = 0; this.col[v * 4 + 11] = 0; continue; }
        const a0 = (k * max + Math.max(0, i - 1)) * 3, a1 = (k * max + Math.min(n - 1, i + 1)) * 3;
        _c.set(C[a1] - C[a0], C[a1 + 1] - C[a0 + 1], C[a1 + 2] - C[a0 + 2]);
        if (_c.lengthSq() < 1e-12) _c.set(0, 1, 0);
        _s.set(C[v], C[v + 1], C[v + 2]);
        toCam.subVectors(cam, _s).normalize();
        const side = _b.crossVectors(_c, toCam);
        if (side.lengthSq() < 1e-12) side.set(1, 0, 0);
        side.normalize();
        const j = P.length - 1 - i;
        const sp = sstep(T.split[0], T.split[1], P[j].p.y - P[j].y0);
        const ww = (T.w0 + (T.w1 - T.w0) * sp) * (k === 0 ? 1 : 0.8) * 2;
        this.pos.set([_s.x + side.x * ww, _s.y + side.y * ww, _s.z + side.z * ww], v * 3);
        this.pos.set([_s.x, _s.y, _s.z], v * 3 + 3);
        this.pos.set([_s.x - side.x * ww, _s.y - side.y * ww, _s.z - side.z * ww], v * 3 + 6);
        // (round 2: a pale core with dark edges - an inked hair: the core
        // reads over the dark wall and the back bar, the edges over the lit
        // counter and the white pool)
        // (the lit counter under the pool is several stops over paper white:
        // only a near-opaque edge darkens it at all)
        const g = T.grey * (1 - 0.15 * sp), a = AL[k * max + i], ea = Math.min(0.9, a * 1.6);
        this.col.set([0, 0, 0, ea, g, g, g, a, 0, 0, 0, ea], v * 4);
      }
    }
    // (the slots past the last point collapse onto it: a segment into a
    // stale slot drew a long sliver to wherever that slot was left)
    if (n > 0) {
      for (let k = 0; k < STRANDS; k++) {
        const last = (k * max + n - 1) * 9;
        for (let i = n; i < max; i++) this.pos.copyWithin((k * max + i) * 9, last, last + 9);
      }
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.color.needsUpdate = true;
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
    if (this.t - T.lastT < 1 / THREAD.rate - 1e-6) return;
    T.lastT = this.t;
    // (round 2: a tip carried fast - to the lips, to the ashtray - leaves no
    // rope along its path: the thread breaks there and starts again at the
    // tip, as a real thread tears in the draught of the hand)
    const last = T.pts[T.pts.length - 1];
    const cut = !!last && last.p.distanceTo(tip) > 0.012;
    T.pts.push({ p: tip.clone(), y0: tip.y, age: 0, seed: this.rng.next() * 10, cut });
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
      // a breath lasts ~0.6 s, strongest at first: a soft plume pushed out
      // ~0.6 m, slowing (drag), rolling (each puff turns), rising into the
      // lamp's cone above (buoyant); a pale grey wash, never white (display
      // under 0.5 where it is thickest), gone in ~3 s
      const k = Math.max(0, 1 - P.t / 0.6);
      // (many small puffs, each its own speed and drift: the plume is long
      // and ragged, never one round cloud)
      P.acc += dt * 110 * k;
      while (P.acc >= 1) {
        P.acc -= 1;
        const s = r.range(0.025, 0.045);
        this.fx.smoke.spawn({
          pos: P.mouth.clone().addScaledVector(P.dir, 0.05).add(new THREE.Vector3(r.gauss() * 0.012, r.gauss() * 0.012, r.gauss() * 0.012)),
          vel: P.dir.clone().multiplyScalar(r.range(0.5, 1.4) * (0.45 + k)).add(new THREE.Vector3(r.gauss() * 0.12, r.range(0.02, 0.14), r.gauss() * 0.12)),
          life: r.range(1.9, 2.9), size: [s, s * r.range(0.6, 1)], grow: r.range(0.05, 0.11), rot: r.next() * 6.28, spin: r.gauss() * 1.2,
          col: [0.1, 0.1, 0.1], colEnd: [0.07, 0.07, 0.07], alpha: r.range(0.12, 0.2), drag: 2.2, gravity: -0.2,
          fadeIn: 0.05, fadeOut: 1.2, cell: FIRE.SMOKE[r.int(0, 3)],
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

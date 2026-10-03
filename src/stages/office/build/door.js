import * as THREE from 'three';
import { LAYER } from '../../../render/layers.js';
import { makeFrosted } from './frosted.js';
import { mergeGeos, lathe } from '../../../props/lib.js';
import { FLOOR, DOOR } from '../plan.js';

// [C5] A hinged door of the Harbor Building's third floor, on the gun kit's
// contract (docs/story/seams/GUNS.md §3: lane C2's stages/killhouse/door.js,
// made for this floor - its floor at y 0, a frosted light with a name on it,
// a closer, a kick, a grille gate). A panelled leaf on a hinge that a man
// opens by walking through it (the kit's entries call open()), the player
// with E, and that a round goes through (thin wood: cover kind 'thin'; its
// glazed light a pane of the glass system). Physically there: a collider
// along the leaf, moved as it swings, its meshes in the bullets' world.
//   door = makeDoor(stage, kit, mats, name, spec, opts)
//   door.open(by?, speed?)  door.close(speed?)  door.kick()  door.set(angle)
//   door.shut  door.open01  door.locked (a rattle and no more)  door.closer
//   (shuts itself after a moment with nobody in the doorway: the click, the
//   glass shivering in its frame)  door.update(dt)  door.frost (or null)
// spec (plan.js DOORS): { axis: 'z' | 'x', x | z, z0 z1 | x0 x1, swing, inside, outside, glass }
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const THICK = 0.045;
const OPEN = 1.62;        // fully open (rad)

// the glazed doors' lettering (read from the corridor) and their light
const GLASS = {
  ames: { text: ['J. AMES', 'INVESTIGATIONS'], glow: [0.14, 1.15] },
  305: { text: ['305', ''], glow: [0.05, 0.6] },
  306: { text: ['306  J. DUBOIS', 'IMPORTS'], glow: [0.04, 0.5] },
  stair: { text: ['STAIRS'], glow: [0.06, 0.5] },
  wc: { text: ['WASHROOM'], glow: [0.05, 0.6] },
};

function leafGeos(w, h, glass) {
  const t = THICK, st = 0.12, out = [];
  const B = (z0, z1, y0, y1, th = t) => out.push(new THREE.BoxGeometry(th, y1 - y0, z1 - z0).translate(0, (y0 + y1) / 2, (z0 + z1) / 2));
  B(0, st, 0, h); B(w - st, w, 0, h);
  B(st, w - st, h - 0.13, h);
  B(st, w - st, 0, 0.24);
  if (glass) {
    const [g0, g1] = glass;
    B(st, w - st, g0 - 0.1, g0);
    B(st, w - st, 0.24, g0 - 0.1, t * 0.55);
    for (const s of [-1, 1]) {
      const x = s * (t / 2 + 0.004);
      out.push(new THREE.BoxGeometry(0.012, 0.02, w - 2 * st).translate(x, g0 + 0.01, w / 2));
      out.push(new THREE.BoxGeometry(0.012, 0.02, w - 2 * st).translate(x, g1 - 0.01, w / 2));
    }
  } else {
    B(st, w - st, 1.0, 1.12);
    B(st, w - st, 0.24, 1.0, t * 0.55);
    B(st, w - st, 1.12, h - 0.13, t * 0.55);
  }
  return out;
}
// an iron grille gate's leaf: a frame and bars (the stair's gate below)
function grilleGeos(w, h) {
  const out = [];
  const B = (z0, z1, y0, y1, th = 0.03) => out.push(new THREE.BoxGeometry(th, y1 - y0, z1 - z0).translate(0, (y0 + y1) / 2, (z0 + z1) / 2));
  B(0, 0.04, 0, h); B(w - 0.04, w, 0, h); B(0, w, h - 0.04, h); B(0, w, 0, 0.04); B(0, w, h * 0.5 - 0.02, h * 0.5 + 0.02);
  for (let z = 0.12; z < w - 0.06; z += 0.1) B(z - 0.008, z + 0.008, 0.04, h - 0.04, 0.016);
  return out;
}
function knobGeos(w) {
  const out = [];
  for (const s of [-1, 1]) {
    const k = lathe([[0.0001, 0], [0.03, 0], [0.03, 0.006], [0.011, 0.012], [0.009, 0.045], [0.024, 0.055], [0.028, 0.07], [0.02, 0.083], [0.0001, 0.086]], 18);
    k.rotateZ(-s * Math.PI / 2).translate(s * 0.022, 0, 0);
    out.push(k);
  }
  return out;
}

export function makeDoor(stage, kit, mats, name, spec, { h = DOOR.h, grille = false } = {}) {
  const along = spec.axis === 'z';
  const s0 = along ? spec.z0 : spec.x0, s1 = along ? spec.z1 : spec.x1;
  const w = s1 - s0 - 0.012;
  kit.piece();
  const hinge = new THREE.Group();
  if (along) hinge.position.set(spec.x, FLOOR + (spec.y || 0), s0 + 0.006);
  else hinge.position.set(s0 + 0.006, FLOOR + (spec.y || 0), spec.z);
  const frame = new THREE.Group();
  if (!along) frame.rotation.y = Math.PI / 2;
  hinge.add(frame);
  kit.g.add(hinge);
  const G0 = spec.glass && GLASS[spec.glass];
  const g = G0 ? DOOR.glass : null;
  const leaf = kit.add(mergeGeos(grille ? grilleGeos(w, h - 0.01) : leafGeos(w, h - 0.01, g)), grille ? mats.iron : mats.door, { parent: frame, name: 'door_' + name });
  leaf.userData.cover = { kind: 'thin', name: 'door ' + name };
  // (a knob: the leaf's latch side; a grille has its own bolt)
  const knob = grille ? null : kit.add(mergeGeos(knobGeos(w)), mats.brass, { parent: frame, cast: false, noRay: true, name: 'knob_' + name });
  if (knob) knob.position.set(0, 1.0, w - 0.07);
  let pane = null, frost = null, local = null;
  if (g) {
    frost = makeFrosted({ w: w - 0.24, h: g[1] - g[0], text: G0.text, seed: name.charCodeAt(0) + name.length * 7 });
    frost.userData.glow(G0.glow[0], G0.glow[1]);
    frost.userData.fall({ base: 0.012, peak: 1.3, sigma: 0.85 });
    // (the lettering reads from the side away from the pane's normal: the
    // normal is turned away from the corridor, `outside`'s side for AMES /
    // D305, `outside` for the stair and the washroom too)
    const n = V(1, 0, 0);
    hinge.updateMatrixWorld(true);
    const nw = n.clone().transformDirection(frame.matrixWorld);
    const c = along ? V(spec.x, 0, (s0 + s1) / 2) : V((s0 + s1) / 2, 0, spec.z);
    const o = spec.outside;
    if (nw.x * (o.x - c.x) + nw.z * (o.z - c.z) > 0) n.set(-1, 0, 0);
    pane = stage.glass.addPane({ centre: V(0, (g[0] + g[1]) / 2, w / 2), normal: n, w: w - 0.24, h: g[1] - g[0], material: frost, parent: frame, tag: 'door' + name, thick: 0.005 });
    pane.mesh.layers.set(LAYER.WORLD);
    pane.mesh.userData.noRay = true;
    pane.mesh.userData.inkId = kit.id;
    pane.mesh.userData.inkSurface = 'lit';
  }
  const col = stage.colliders.addBox(hinge.position.x, hinge.position.z, 0.001, 0.001, 0, 'door');
  const sgn = spec.swing || 1;
  const D = {
    name, spec, hinge, frame, leaf, knob, pane, frost, w, angle: 0, target: 0, speed: 3, moving: false, locked: false, col, live: false,
    closer: false, closerT: 0, vel: 0, kicked: false, jolt: 0, grille,
    get shut() { return Math.abs(this.angle) < 0.08; },
    get open01() { return Math.min(1, Math.abs(this.angle) / OPEN); },
    centre: along ? V(spec.x, FLOOR + (spec.y || 0), (s0 + s1) / 2) : V((s0 + s1) / 2, FLOOR + (spec.y || 0), spec.z),
    set(a) { this.angle = this.target = a; this.moving = false; this.kicked = false; this.apply(); },
    open(by = null, speed = 3.4) {
      if (this.locked) { this.rattle(); return false; }
      const G = stage.game;
      // (a man's hand on the far side: the handle turns first, slowly - I hear it, I see the knob go round)
      const theirs = !!(by && G && Math.hypot(by.x - G.eye.x, by.z - G.eye.z) > 0.6);
      if (theirs && this.handle && this.shut && !this.moving) { this.delay = 0.75; this.knobT = 0; if (G.sfx) G.sfx.play('c5_handle', this.centre.clone().setY(FLOOR + 1.0), {}, { ref: 3 }); }
      this.target = sgn * OPEN;
      this.speed = speed;
      if (!this.moving && this.open01 < 0.5 && !(this.delay > 0)) { if (G && G.sfx) G.sfx.play(grille ? 'c5_gate' : 'c2_doorOpen', this.centre.clone().setY(FLOOR + 1.1), {}, { ref: 3 }); }
      this.moving = true; this.kicked = false;
      return true;
    },
    close(speed = 2.6) { this.target = 0; this.speed = speed; this.moving = true; this.kicked = false; },
    // flung open: a heel by the lock, it bangs off its stop
    kick() {
      this.locked = false; this.closer = false;
      this.target = sgn * OPEN; this.vel = 10 * sgn; this.moving = true; this.kicked = true;
      const G = stage.game;
      if (G && G.sfx) G.sfx.play('office_doorKick', this.centre.clone().setY(FLOOR + 1.0), {}, { ref: 3 });
    },
    rattle() { const G = stage.game; if (G && G.sfx) G.sfx.play('c2_doorRattle', this.centre.clone().setY(FLOOR + 1.0), {}, { ref: 3 }); this.jolt = 0.25; },
    apply() {
      hinge.rotation.y = this.angle;
      hinge.updateMatrixWorld(true);
      const a = this.angle, c = Math.cos(a), s = Math.sin(a);
      const dx = along ? s : c, dz = along ? c : -s;
      col.cx = hinge.position.x + dx * w / 2; col.cz = hinge.position.z + dz * w / 2;
      col.angle = a; col.c = c; col.s = s;
      if (along) { col.hx = this.live ? THICK / 2 + 0.02 : 0.001; col.hz = this.live ? w / 2 : 0.001; }
      else { col.hx = this.live ? w / 2 : 0.001; col.hz = this.live ? THICK / 2 + 0.02 : 0.001; }
      const G = stage.game;
      if (G && G.rays) { G.rays.refresh(leaf); if (pane && pane.proxy) G.rays.refresh(pane.proxy); }
    },
    // somebody (the player or a living man) in the doorway or in the leaf's sweep
    busy() {
      const G = stage.game;
      if (!G) return false;
      const c = this.centre, r = w + 0.35;
      const near = (x, z) => Math.hypot(x - c.x, z - c.z) < r;
      if (near(G.controller.pos.x, G.controller.pos.z)) return true;
      for (const h of stage.hoods.list) if (h.alive && near(h.pos.x, h.pos.z)) return true;
      return false;
    },
    update(dt) {
      if (!this.live) { this.live = true; this.apply(); }
      if (this.jolt > 0) {
        this.jolt -= dt;
        const k = Math.max(0, this.jolt) * Math.sin(this.jolt * 90) * 0.02;
        hinge.rotation.y = this.angle + k;
        if (this.jolt <= 0) hinge.rotation.y = this.angle;
      }
      // the closer: open, nobody in its way for a moment: it draws itself shut
      if (this.closer && !this.moving && this.open01 > 0.05) {
        this.closerT = this.busy() ? 0 : this.closerT + dt;
        if (this.closerT > 1.1) { this.closerT = 0; this.close(1.25); this.closing = true; }
      }
      // (the handle going round before the leaf moves)
      if (this.knobT != null && knob) {
        this.knobT += dt;
        knob.rotation.x = Math.sin(Math.min(1, this.knobT / 0.6) * Math.PI) * 0.9;
        if (this.knobT > 0.75) { knob.rotation.x = 0; this.knobT = null; }
      }
      if (this.delay > 0) {
        this.delay -= dt;
        if (this.delay <= 0) { const G = stage.game; if (G && G.sfx) G.sfx.play('c2_doorOpen', this.centre.clone().setY(FLOOR + 1.1), {}, { ref: 3 }); }
        return;
      }
      if (!this.moving) return;
      if (this.kicked) {
        // (a kick: flung, it bangs off its stop and comes back a little)
        let next = this.angle + this.vel * dt;
        if (Math.abs(next) >= OPEN) {
          next = sgn * OPEN; const v = Math.abs(this.vel);
          this.vel = -this.vel * 0.25;
          const G = stage.game;
          if (G && G.sfx && v > 0.8) G.sfx.play('office_doorBang', this.centre.clone().setY(FLOOR + 1.2), { k: Math.min(1, v / 3) }, { ref: 3 });
        }
        this.vel += sgn * (Math.abs(next) < OPEN - 0.15 ? 5 : 0) * dt;
        this.vel *= Math.exp(-2.5 * dt);
        if (this.blocked(next)) { this.vel = 0; next = this.angle; }
        this.angle = next;
        if (Math.abs(this.vel) < 0.05 && Math.abs(this.angle) > OPEN - 0.3) { this.moving = false; this.kicked = false; }
        this.apply();
        return;
      }
      const e = this.target - this.angle;
      const step = Math.sign(e) * Math.min(Math.abs(e), this.speed * dt * (0.4 + Math.min(1, Math.abs(e) * 2.5)));
      let next = this.angle + step;
      let b = this.blocked(next);
      if (b === 'player') { next = this.angle + step * 0.45; b = this.blocked(next); if (b === 'player' && this.shove(next)) b = false; }
      if (b) { this.moving = false; this.closing = false; return; }
      this.angle = next;
      if (Math.abs(this.target - this.angle) < 1e-3) {
        this.angle = this.target; this.moving = false;
        if (this.target === 0) {
          const G = stage.game;
          if (G && G.sfx) G.sfx.play(this.closing ? 'c5_closerClick' : 'c2_doorShut', this.centre.clone().setY(FLOOR + 1.1), {}, { ref: 3 });
          // (the glass shivers in its frame)
          if (this.closing && pane) this.jolt = 0.18;
          this.closing = false;
        }
      }
      this.apply();
    },
    openBox() {
      const a = sgn * OPEN, c = Math.cos(a), s = Math.sin(a);
      const dx = along ? s : c, dz = along ? c : -s;
      const hx = along ? THICK / 2 + 0.02 : w / 2, hz = along ? w / 2 : THICK / 2 + 0.02;
      return { cx: hinge.position.x + dx * w / 2, cz: hinge.position.z + dz * w / 2, hx, hz, c, s, angle: a };
    },
    dist(a, px, pz) {
      const c = Math.cos(a), s = Math.sin(a);
      const dx = along ? s : c, dz = along ? c : -s;
      const hx = hinge.position.x, hz = hinge.position.z;
      const t = Math.max(0, Math.min(w, (px - hx) * dx + (pz - hz) * dz));
      return Math.hypot(px - (hx + dx * t), pz - (hz + dz * t));
    },
    blocked(a) {
      const G = stage.game;
      if (!G) return false;
      const test = (x, z, r) => { const d1 = this.dist(a, x, z); return d1 < r && d1 < this.dist(this.angle, x, z) - 1e-4; };
      for (const h of stage.hoods.list) if (h.alive && test(h.pos.x, h.pos.z, 0.3)) return 'man';
      if (test(G.controller.pos.x, G.controller.pos.z, 0.36)) return 'player';
      return false;
    },
    shove(a) {
      const G = stage.game, C = G.controller;
      const plane = along ? spec.x : spec.z;
      const off = (along ? C.pos.x : C.pos.z) - plane;
      const sw = Math.sign(along ? Math.sin(a) : -Math.sin(a)) || sgn;
      const side = Math.abs(off) < 0.05 ? -sw : Math.sign(off);
      for (let k = 0.02; k <= 0.25 + 1e-6; k += 0.02) {
        const p = { x: C.pos.x + (along ? side * k : 0), z: C.pos.z + (along ? 0 : side * k) };
        if (this.dist(a, p.x, p.z) < 0.41) continue;
        const q = { x: p.x, z: p.z };
        stage.colliders.resolve(q, C.radius);
        if (Math.hypot(q.x - p.x, q.z - p.z) > 0.03) return false;
        C.pos.x = p.x; C.pos.z = p.z;
        return true;
      }
      return false;
    },
  };
  hinge.updateMatrixWorld(true);
  if (frost) local = { mesh: pane.mesh };
  D.local = local;
  return D;
}

// a door's use point (Interact `at`): where the view's line meets the
// doorway's plane, kept inside the doorway (lane C2's doorPoint, 91_guns.js)
export function doorPoint(G, d) {
  const s = d.spec, along = s.axis === 'z';
  const s0 = (along ? s.z0 : s.x0) + 0.08, s1 = (along ? s.z1 : s.x1) - 0.08;
  const y0 = d.centre.y + 0.3, y1 = d.centre.y + 2.0;
  const out = V(0, 0, 0), f = V(0, 0, 0);
  const px0 = along ? s.x : s.z;
  return () => {
    const cam = G.camera, o = cam.position;
    f.set(0, 0, -1).transformDirection(cam.matrixWorld);
    const n = along ? f.x : f.z, ww = along ? px0 - o.x : px0 - o.z;
    let k = Math.abs(n) > 1e-4 ? ww / n : -1;
    if (!(k > 0)) k = Math.abs(ww);
    const px = o.x + f.x * k, py = o.y + f.y * k, pz = o.z + f.z * k;
    const u = Math.min(s1, Math.max(s0, along ? pz : px));
    if (along) out.set(px0, Math.min(y1, Math.max(y0, py)), u);
    else out.set(u, Math.min(y1, Math.max(y0, py)), px0);
    return out;
  };
}

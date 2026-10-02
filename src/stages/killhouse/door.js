import * as THREE from 'three';
import { LAYER } from '../../render/layers.js';
import { makeFrosted } from '../office/build/frosted.js';
import { mergeGeos, lathe } from '../../props/lib.js';
import { FLOOR, DOOR_H } from './plan.js';

// A hinged door of the killhouse (lane C2): a panelled leaf on a hinge that
// a man opens by walking through it (the gun kit's entries call open()), the
// player with E, and that a round goes through (thin wood: the gun kit's
// cover kind 'thin'; its glazed light a pane of the glass system). It is
// physically there: a collider along the leaf, moved as it swings, and its
// meshes in the bullets' world, refreshed while it moves.
//   door = makeDoor(stage, kit, mats, name, spec)
//   door.open(by?)   swing it open (away from `by`, a point: a push door
//                    opens the way it is pushed; a door that opens one way only
//                    opens that way)       door.close()     door.shut (bool)
//   door.set(angle)  at once     door.update(dt)     door.frost (the pane's material, or null)
//   door.locked      a rattle and no more
// spec (plan.js DOORS): { axis: 'z' | 'x', x | z, z0 z1 | x0 x1, swing, inside, outside, glass }
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const THICK = 0.045;
const OPEN = 1.62;        // fully open (rad)

// a panelled leaf in its own frame: the hinge edge at the origin, the leaf
// along +z (width w), faces toward +-x; a glazed upper panel between g0, g1
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
  } else {
    // two panels, set back, a mid rail
    B(st, w - st, 1.0, 1.12);
    B(st, w - st, 0.24, 1.0, t * 0.55);
    B(st, w - st, 1.12, h - 0.13, t * 0.55);
  }
  return out;
}
function knobGeos(w) {
  const out = [];
  for (const s of [-1, 1]) {
    const k = lathe([[0.0001, 0], [0.03, 0], [0.03, 0.006], [0.011, 0.012], [0.009, 0.045], [0.024, 0.055], [0.028, 0.07], [0.02, 0.083], [0.0001, 0.086]], 18);
    k.rotateZ(-s * Math.PI / 2).translate(s * 0.022, 1.0, w - 0.07);
    out.push(k);
  }
  return out;
}

export function makeDoor(stage, kit, mats, name, spec) {
  const along = spec.axis === 'z';
  const s0 = along ? spec.z0 : spec.x0, s1 = along ? spec.z1 : spec.x1;
  const w = s1 - s0 - 0.012;
  kit.piece();
  const hinge = new THREE.Group();
  // (the hinge on the s0 jamb, the leaf in the wall's middle)
  if (along) hinge.position.set(spec.x, FLOOR, s0 + 0.006);
  else { hinge.position.set(s0 + 0.006, FLOOR, spec.z); }
  // (an axis 'x' door: its leaf along +x - the frame turned a quarter so the
  // leaf's own +z runs along the world's +x)
  const frame = new THREE.Group();
  if (!along) frame.rotation.y = Math.PI / 2;
  hinge.add(frame);
  kit.g.add(hinge);
  const g = spec.glass ? [1.12, 1.96] : null;
  const leaf = kit.add(mergeGeos(leafGeos(w, DOOR_H - 0.01, g)), mats.door, { parent: frame, name: 'door_' + name });
  leaf.userData.cover = { kind: 'thin', name: 'door ' + name };
  kit.add(mergeGeos(knobGeos(w)), mats.brass, { parent: frame, cast: false, noRay: true });
  let pane = null, frost = null;
  if (g) {
    frost = makeFrosted({ w: w - 0.24, h: g[1] - g[0], text: null, seed: name.charCodeAt(0) + name.charCodeAt(1) * 7 });
    frost.userData.glow(0.16, 1.0);
    frost.userData.fall({ base: 0.014, peak: 1.1, sigma: 0.8 });
    pane = stage.glass.addPane({ centre: V(0, (g[0] + g[1]) / 2, w / 2), normal: V(1, 0, 0), w: w - 0.24, h: g[1] - g[0], material: frost, parent: frame, tag: 'door' + name, thick: 0.005 });
    pane.mesh.layers.set(LAYER.WORLD);
    pane.mesh.userData.noRay = true;
    pane.mesh.userData.inkId = kit.id;
    pane.mesh.userData.inkSurface = 'lit';
  }
  // the collider: a thin box along the leaf (zero until the stage stands: the
  // men's nav grid is built with the doorways open - they walk through doors)
  const col = stage.colliders.addBox(hinge.position.x, hinge.position.z, 0.001, 0.001, 0, 'door');
  const D = {
    name, spec, hinge, frame, leaf, pane, frost, w, angle: 0, target: 0, speed: 3, moving: false, locked: false, col, live: false,
    get shut() { return Math.abs(this.angle) < 0.08; },
    get open01() { return Math.min(1, Math.abs(this.angle) / OPEN); },
    // the doorway's middle (world, floor height)
    centre: along ? V(spec.x, FLOOR, (s0 + s1) / 2) : V((s0 + s1) / 2, FLOOR, spec.z),
    set(a) { this.angle = this.target = a; this.moving = false; this.apply(); },
    open(by = null, speed = 3.4) {
      if (this.locked) { this.rattle(); return false; }
      const sgn = spec.swing || 1;
      // (a door that may be pushed either way: away from whoever pushes it)
      if (spec.both && by) {
        const side = along ? Math.sign(by.x - spec.x) : Math.sign(by.z - spec.z);
        this.target = (along ? -side : side) * OPEN;
      } else this.target = sgn * OPEN;
      this.speed = speed;
      if (!this.moving) { const G = stage.game; if (G && G.sfx) G.sfx.play('c2_doorOpen', this.centre.clone().setY(FLOOR + 1.1), {}, { ref: 3 }); }
      this.moving = true;
      return true;
    },
    close(speed = 2.6) { this.target = 0; this.speed = speed; this.moving = true; },
    rattle() { const G = stage.game; if (G && G.sfx) G.sfx.play('c2_doorRattle', this.centre.clone().setY(FLOOR + 1.0), {}, { ref: 3 }); this.jolt = 0.25; },
    apply() {
      hinge.rotation.y = this.angle;
      hinge.updateMatrixWorld(true);
      // the collider along the leaf as it stands
      const a = this.angle, c = Math.cos(a), s = Math.sin(a);
      // (the leaf's direction from the hinge, world)
      const dx = along ? s : c, dz = along ? c : -s;
      col.cx = hinge.position.x + dx * w / 2; col.cz = hinge.position.z + dz * w / 2;
      col.angle = a; col.c = c; col.s = s;
      if (along) { col.hx = this.live ? THICK / 2 + 0.02 : 0.001; col.hz = this.live ? w / 2 : 0.001; }
      else { col.hx = this.live ? w / 2 : 0.001; col.hz = this.live ? THICK / 2 + 0.02 : 0.001; }
      const G = stage.game;
      if (G && G.rays) { G.rays.refresh(leaf); if (pane && pane.proxy) G.rays.refresh(pane.proxy); }
    },
    update(dt) {
      if (!this.live) { this.live = true; this.apply(); }
      if (this.jolt > 0) {
        this.jolt -= dt;
        const k = Math.max(0, this.jolt) * Math.sin(this.jolt * 90) * 0.02;
        hinge.rotation.y = this.angle + k;
        if (this.jolt <= 0) hinge.rotation.y = this.angle;
      }
      if (!this.moving) return;
      const e = this.target - this.angle;
      const step = Math.sign(e) * Math.min(Math.abs(e), this.speed * dt * (0.4 + Math.min(1, Math.abs(e) * 2.5)));
      // (the leaf stops against a man or the player in its way: it never passes through anyone)
      const next = this.angle + step;
      if (this.blocked(next)) { this.moving = false; return; }
      this.angle = next;
      if (Math.abs(this.target - this.angle) < 1e-3) {
        this.angle = this.target; this.moving = false;
        if (this.target === 0) { const G = stage.game; if (G && G.sfx) G.sfx.play('c2_doorShut', this.centre.clone().setY(FLOOR + 1.1), {}, { ref: 3 }); }
      }
      this.apply();
    },
    // the leaf's distance at angle `a` from a point (plan)
    dist(a, px, pz) {
      const c = Math.cos(a), s = Math.sin(a);
      const dx = along ? s : c, dz = along ? c : -s;
      const hx = hinge.position.x, hz = hinge.position.z;
      const t = Math.max(0, Math.min(w, (px - hx) * dx + (pz - hz) * dz));
      return Math.hypot(px - (hx + dx * t), pz - (hz + dz * t));
    },
    // would the leaf, swinging to `a`, cut into the player or a living man?
    // (it stops against him as a real door does; it never passes through anyone)
    blocked(a) {
      const G = stage.game;
      if (!G) return false;
      const test = (x, z, r) => { const d1 = this.dist(a, x, z); return d1 < r && d1 < this.dist(this.angle, x, z) - 1e-4; };
      if (test(G.eye.x, G.eye.z, 0.36)) return true;
      for (const h of stage.hoods.list) if (h.alive && test(h.pos.x, h.pos.z, 0.3)) return true;
      return false;
    },
  };
  // the doorway's frame (both faces): the casings are the shell's
  hinge.updateMatrixWorld(true);
  return D;
}

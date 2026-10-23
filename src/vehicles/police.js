import * as THREE from 'three';
import { Pilot } from './pilot.js';
import { lampsLit, policeGlow } from './kinds.js';

// The police car's hunt (lane O2 gives it; lane O3's police drive it): a
// driver that hunts a target on the road graph - the way to it worked out
// again as it moves (every second and a half, or when it has gone on 25 m),
// the base's Pilot on that way (the same inputs a player gives: no leash),
// and in the last 14 m straight at it, to stop beside it (a man) or nose to
// its flank (a car: O3 says what a stop is). The red lamp and the siren.
//   const v = wheels.police(x, z, { target, siren: true })     a car put at a point, hunting
//   v.driver = new HuntPilot(wheels, target, { pace })           any car made a hunter
//   siren(wheels, v, on)                                          the lamp turning, the wail
//   hunt.state 'route' | 'close' | 'lost'; hunt.gap (m to the target)
const _v = new THREE.Vector3();
export class HuntPilot {
  constructor(W, target, { pace = 1.05, keep = 4, stopAt = 6 } = {}) {
    this.W = W;
    this.target = target;
    this.o = { pace, keep, stopAt };
    this.inner = null;
    this.t = 0; this.replanT = 0;
    this.state = 'route';
    this.gap = Infinity;
    this.from = null;
  }
  tpos() { const t = this.target; return t.pos || t; }
  plan(v) {
    const p = this.tpos();
    const path = this.W.lanePathFor({ x: v.pos.x, z: v.pos.z }, { x: p.x, z: p.z }, { vmax: 20, aLat: 5.5, aBrake: 6, pace: 1.25 });
    if (!path) return false;
    if (!this.inner) this.inner = new Pilot(path, { pace: this.o.pace, vmax: 22, keep: this.o.keep, overtake: true, bodies: () => this.W.bodiesFor(v) });
    else this.inner.setPath(path, v);
    this.inner.i = path.nearest(v.pos.x, v.pos.z, 0, 30); this.inner.s = path.pts[this.inner.i].s;
    this.inner.o.stopAt = path.len - this.o.stopAt;
    this.from = { x: p.x, z: p.z };
    return true;
  }
  drive(v, dt) {
    this.t += dt;
    const p = this.tpos();
    this.gap = Math.hypot(p.x - v.pos.x, p.z - v.pos.z);
    const moved = this.from ? Math.hypot(p.x - this.from.x, p.z - this.from.z) : 1e9;
    this.replanT -= dt;
    if (this.gap > 14 && (this.replanT <= 0 && (moved > 25 || this.t < 0.1 || !this.inner) || moved > 60)) { this.replanT = 1.5; if (!this.plan(v)) this.state = 'lost'; else this.state = 'route'; }
    const I = v.input;
    if (this.gap <= 14 || !this.inner) {
      // close: straight at it, slowing to a stop beside it
      this.state = 'close';
      const l = v.local(_v.set(p.x, 0, p.z), _v);
      const ang = Math.atan2(-l.z, l.x);
      I.steer = Math.max(-1, Math.min(1, ang * 2.2));
      const want = Math.max(0, Math.min(8, (this.gap - this.o.stopAt) * 0.9));
      const sp = v.speed;
      I.throttle = want > sp + 0.3 ? Math.min(1, (want - sp) / 3) : 0;
      I.brake = sp > want + 0.5 ? Math.min(1, (sp - want) / 3) : want < 0.2 ? 1 : 0;
      I.handbrake = 0; I.hold = 1;
      return;
    }
    this.inner.drive(v, dt);
  }
}

// the lamp turning red and the wail (a police car's siren on or off)
export function siren(W, v, on) {
  v.siren = on;
  lampsLit(v.model, W.stage, on || (v.lamps && v.lamps.on));
  const g = policeGlow(v.model);
  if (g) g.visible = on;
}
// each step: the sirens near the eye wail, the lamps pulse
export function sirenStep(W, dt) {
  const G = W.game, eye = G.camera.position, S = G.sfx;
  for (const v of W.V.list) {
    if (!v.siren) continue;
    v._sirT = (v._sirT || 0) - dt;
    const d = Math.hypot(v.pos.x - eye.x, v.pos.z - eye.z);
    if (v.model.glow) { const k = 0.5 + 0.5 * Math.sin(G.time * 9); v.model.glow.scale.setScalar(0.5 + 0.7 * k); }
    if (v._sirT <= 0 && d < 220) { v._sirT = 1.25; if (S && S.live) S.play('o2_siren', v.pos.clone().setY(1.6), { k: 1 }, { ref: 14 }); }
  }
}

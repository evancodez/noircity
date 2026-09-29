import * as THREE from 'three';
import { HIP_Y } from '../enemies/HoodRig.js';
import { CAST_CLIPS } from './clips.js';

// A Character (docs/story/CONTRACTS.md §6): one figure of the story on the
// Hood's skeleton (same joint names, bones, ink slot and brush anchor, LODs,
// shadow). The figure itself is a Hood (enemies/Hood.js, `c.fig`); the
// Character is what a scene directs:
//   c.name c.kind c.pos c.yaw c.alive c.object c.bones c.hp c.brain c.state
//   c.setState(name, fade)          idle walk run aim | sit sitEat sitDrink
//                                   sitRead sitSmoke sitTalk lean duck cower ...
//   c.play(clip, { fade, hold, onMark: { mark: fn } }) -> handle   handle.done
//   c.clip(name) -> { duration, marks }        (src/cast/clips.js)
//   *c.walkTo(anchor | {x, z}, { speed, run })  a generator for scripts
//   c.sit(anchor) / c.stand()   c.lookAt(Vector3 | null)   c.face(yaw)
//   c.hold(prop | null, 'L' | 'R')   c.hit({ dir, power, zone, by })   c.ko(kind)
//   c.items   Map name -> Object3D the figure carries (the brawler's matchbook)
// Yaw: c.yaw and c.face(yaw) are the FIGURE's heading (a Hood's: it faces
// (sin yaw, cos yaw)); an anchor's yaw is a viewer's (the controller's: it
// looks along (-sin yaw, -cos yaw)), so a figure put on an anchor turns to
// anchor.yaw + PI. place / sit / walkTo do that for you.
//
// FOUNDATION STUB (lane 6 owns src/cast/**): the figure is a Hood without a
// gun, scaled to the kind's height; a story clip holds a plain stand-in
// pose (POSES below, set on the bones after the Hood's own mixer) for its
// duration and fires its marks on time.
// stand-in poses: bone -> [x, y, z] rotation (rad) from hanging straight
// (the Hood's bind pose: limbs down, facing +z, left +x; rotating a limb by
// a negative x lifts it forward)
const SIT = { thighL: [-1.5, 0, 0], thighR: [-1.5, 0, 0], shinL: [1.5, 0, 0], shinR: [1.5, 0, 0], skirtL: [-1.5, 0, 0], skirtR: [-1.5, 0, 0] };
const GUARD = { upperArmL: [-0.55, 0, -0.25], upperArmR: [-0.55, 0, 0.25], forearmL: [-2.0, 0, 0], forearmR: [-2.0, 0, 0] };
export const POSES = {
  sit: { ...SIT, upperArmL: [-0.7, 0, -0.1], upperArmR: [-0.7, 0, 0.1], forearmL: [-0.9, 0, 0], forearmR: [-0.9, 0, 0], seat: true },
  sitEat: { ...SIT, upperArmL: [-0.7, 0, -0.2], upperArmR: [-0.7, 0, 0.2], forearmL: [-1.3, 0, 0], forearmR: [-1.3, 0, 0], spine: [0.2, 0, 0], seat: true },
  sitDrink: { ...SIT, upperArmL: [-0.7, 0, -0.1], upperArmR: [-0.9, 0, 0.1], forearmL: [-0.9, 0, 0], forearmR: [-1.7, 0, 0], seat: true },
  sitRead: { ...SIT, upperArmL: [-1.1, 0, -0.25], upperArmR: [-1.1, 0, 0.25], forearmL: [-1.3, 0, 0], forearmR: [-1.3, 0, 0], seat: true },
  rise: { thighL: [-0.8, 0, 0], thighR: [-0.8, 0, 0], shinL: [0.8, 0, 0], shinR: [0.8, 0, 0], skirtL: [-0.8, 0, 0], skirtR: [-0.8, 0, 0], drop: 0.2 },
  guard: { ...GUARD, spine: [0.1, 0, 0] },
  jabL: { ...GUARD, upperArmL: [-1.45, 0, -0.05], forearmL: [-0.1, 0, 0] },
  jabR: { ...GUARD, upperArmR: [-1.45, 0, 0.05], forearmR: [-0.1, 0, 0] },
  hookR: { ...GUARD, upperArmR: [-1.3, 0, 0.9], forearmR: [-1.4, 0, 0] },
  haymaker: { upperArmL: [-2.6, 0, -0.3], upperArmR: [-2.6, 0, 0.3], forearmL: [-0.8, 0, 0], forearmR: [-0.8, 0, 0], spine: [-0.2, 0, 0] },
  hitHead: { ...GUARD, neck: [-0.35, 0, 0] },
  hitBody: { spine: [0.45, 0, 0], upperArmL: [-0.3, 0, 0], upperArmR: [-0.3, 0, 0], forearmL: [-1.2, 0, 0], forearmR: [-1.2, 0, 0] },
  stun: { spine: [-0.12, 0, 0], neck: [-0.2, 0, 0] },
  thrown: { spine: [-0.5, 0, 0], upperArmL: [-2.2, 0, -0.6], upperArmR: [-2.2, 0, 0.6], forearmL: [-0.4, 0, 0], forearmR: [-0.4, 0, 0] },
  reach: { upperArmR: [-1.1, 0, 0.1], forearmR: [-0.35, 0, 0] },
  pour: { upperArmR: [-1.25, 0, 0.1], forearmR: [-0.7, 0, 0], upperArmL: [-0.9, 0, -0.1], forearmL: [-0.6, 0, 0] },
  lean: { upperArmL: [-0.35, 0, -0.3], upperArmR: [-0.35, 0, 0.3], forearmL: [-1.7, 0, 0], forearmR: [-1.7, 0, 0] },
  duck: { thighL: [-1.9, 0, 0], thighR: [-1.9, 0, 0], shinL: [2.3, 0, 0], shinR: [2.3, 0, 0], skirtL: [-1.9, 0, 0], skirtR: [-1.9, 0, 0], spine: [0.5, 0, 0], upperArmR: [-2.8, 0, 0.2], drop: 0.52 },
};
const HOOD_STATES = new Set(['idle', 'walk', 'run', 'aim', 'stagger']);
const _e = new THREE.Euler(), _t = new THREE.Vector3();

// anchor name | anchor | { x, z } | Vector3 -> { x, z, y | null, yaw (the
// figure's heading) | null }
export function resolveAt(stage, at) {
  const a = typeof at === 'string' ? stage.anchor(at) : at && at.pos ? at : null;
  if (typeof at === 'string' && !a) throw new Error(`cast: no anchor '${at}'`);
  if (a) return { x: a.pos.x, z: a.pos.z, y: a.pos.y, yaw: a.yaw != null ? a.yaw + Math.PI : null };
  return { x: at.x, z: at.z, y: at.y ?? null, yaw: null };
}

export class Character {
  constructor(cast, fig, { kind, name, own = true, brain = 'none', group = null }) {
    this.cast = cast;
    this.fig = fig;
    this.kind = kind;
    this.name = name;
    this.own = own;            // updated here (false: a Hood in stage.hoods)
    this.brain = brain;
    this.group = group;
    this.hp = 100;
    this.down = false;
    this.state = 'idle';
    this.seat = null;          // { y } while seated
    this.poseName = null;      // the stand-in pose held now
    this.basePose = null;      // what a finished clip returns to
    this.clipH = null;
    this.items = new Map();
    this.held = { L: null, R: null };
    fig.character = this;
    fig.afterPose = (h) => this.applyPose(h);
  }

  get pos() { return this.fig.pos; }
  get yaw() { return this.fig.yaw; }
  set yaw(v) { this.fig.yaw = v; }
  get alive() { return !this.down && this.fig.alive; }
  get object() { return this.fig.object; }
  get bones() { return this.fig.bones; }
  get stage() { return this.cast.stage; }

  // ---- placing -------------------------------------------------------------------
  where(at) { return resolveAt(this.stage, at); }

  place(at, yaw = null) {
    const w = this.where(at);
    this.fig.pos.x = w.x; this.fig.pos.z = w.z;
    this.fig._prevPos.copy(this.fig.pos);
    if (yaw != null) this.fig.yaw = yaw;
    else if (w.yaw != null) this.fig.yaw = w.yaw;
    this.fig._prevYaw = this.fig.yaw;
    return this;
  }

  face(yaw) { this.fig.yaw = yaw; }
  lookAt(v) { this.fig.lookAt(v || null); }

  sit(anchor) {
    const w = this.where(anchor);
    this.place(anchor);
    this.fig.speed = 0;
    this.fig.setState('idle', 0.2);
    this.seat = { y: w.y ?? 0.92 };
    this.basePose = 'sit';
    this.poseName = 'sit';
    this.state = 'sit';
  }

  stand() {
    if (!this.seat) return;
    this.seat = null;
    this.basePose = null;
    this.poseName = null;
    this.state = 'idle';
    // off the stool, away from what he faced
    this.fig.pos.x -= Math.sin(this.fig.yaw) * 0.45;
    this.fig.pos.z -= Math.cos(this.fig.yaw) * 0.45;
  }

  // ---- states and clips ------------------------------------------------------------
  setState(name, fade = 0.25) {
    if (HOOD_STATES.has(name)) {
      if (this.seat) this.stand();
      this.basePose = null; this.poseName = null; this.clipH = null;
      this.fig.setState(name, fade);
      this.state = name;
      return;
    }
    if (!CAST_CLIPS[name]) throw new Error(`cast: no state '${name}'`);
    this.play(name, { fade, hold: true });
    this.basePose = CAST_CLIPS[name].pose;
    this.state = name;
  }

  clip(name) {
    const c = CAST_CLIPS[name];
    if (!c) throw new Error(`cast: no clip '${name}'`);
    return { duration: c.duration, marks: { ...c.marks } };
  }

  play(name, { fade = 0.2, hold = false, onMark = null } = {}) {
    const c = CAST_CLIPS[name];
    if (!c) throw new Error(`cast: no clip '${name}'`);
    if (this.clipH && !this.clipH.done) this.clipH.stop();
    const h = {
      name, t: 0, duration: c.duration, marks: c.marks, loop: !!c.loop, hold: hold || !!c.hold, onMark: onMark || {}, fired: new Set(), done: false,
      stop: () => { h.done = true; },
    };
    if (c.state) { this.fig.setState(c.state, fade); if (c.state === 'run') this.fig.speed = 2.9; }
    this.poseName = c.pose;
    this.clipH = h;
    return h;
  }

  // ---- movement ----------------------------------------------------------------------
  *walkTo(target, { speed = 1.25, run = false, stop = 0.12 } = {}) {
    const w = this.where(target);
    if (this.seat) this.stand();
    this.clipH = null; this.poseName = null; this.basePose = null;
    const F = this.fig;
    F.speed = run ? 2.9 : speed;
    F.setState(run ? 'run' : 'walk', 0.2);
    this.state = run ? 'run' : 'walk';
    for (let n = 0; n < 3600; n++) {
      const dx = w.x - F.pos.x, dz = w.z - F.pos.z, d = Math.hypot(dx, dz);
      if (d < stop + F.speed / 60) break;
      F.yaw = Math.atan2(dx, dz);
      yield null;
    }
    F.pos.x = w.x; F.pos.z = w.z;
    F.speed = 0;
    F.setState('idle', 0.25);
    this.state = 'idle';
    if (w.yaw != null) F.yaw = w.yaw;
  }

  // ---- holding -------------------------------------------------------------------------
  // a §8.1 prop at the hand bone (null: let go; returns what was held)
  hold(prop, hand = 'R') {
    const prev = this.held[hand];
    if (prev) { prev.parent && prev.parent.remove(prev); this.held[hand] = null; }
    if (!prop) return prev;
    const bone = this.fig.bones[hand === 'L' ? 'handL' : 'handR'];
    bone.add(prop);
    const g = prop.userData.grip;
    _t.set(0, -0.09, 0.02);
    if (g) _t.sub(new THREE.Vector3().setFromMatrixPosition(g));
    prop.position.copy(_t);
    prop.quaternion.identity();
    prop.scale.setScalar(1 / this.fig.scale);
    this.held[hand] = prop;
    return prev;
  }

  // ---- the fight -------------------------------------------------------------------------
  hit({ dir = null, power = 0.5, zone = 'body', by = 'fist' } = {}) {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - power * 20);
    this.fig.flinch(dir);
    const G = this.stage.game;
    if (G) G.emit('cast:hit', { who: this, dir, power, zone, by });
  }

  // down, not dead: no blood pool; he stays where he fell
  ko(kind = 'deathBack') {
    if (this.down) return;
    this.down = true;
    this.clipH = null; this.poseName = null; this.basePose = null; this.seat = null;
    this.fig.die(['deathBack', 'deathKnees', 'deathSpin'].includes(kind) ? kind : 'deathBack');
    this.state = 'ko';
    const G = this.stage.game;
    if (G) G.emit('cast:down', { who: this });
  }

  // ---- per step ---------------------------------------------------------------------------
  update(dt, t, camera) {
    const h = this.clipH;
    if (h && !h.done) {
      const t0 = h.t;
      h.t += dt;
      for (const [m, at] of Object.entries(h.marks)) {
        if (h.fired.has(m)) continue;
        if (at <= h.t + 1e-6 && (at > t0 || (t0 === 0 && at === 0))) { h.fired.add(m); if (h.onMark[m]) h.onMark[m](this, m); }
      }
      if (h.t >= h.duration) {
        if (h.loop) { h.t -= h.duration; h.fired.clear(); }
        else if (!h.hold) { h.done = true; this.poseName = this.basePose; if (CAST_CLIPS[h.name].state) { this.fig.setState('idle', 0.3); this.fig.speed = 0; } }
      }
    }
    if (this.own) this.fig.update(dt, t, camera);
  }

  // the stand-in pose over the Hood's mixer (fig.afterPose)
  applyPose(fig) {
    const P = this.poseName && POSES[this.poseName];
    if (!P) return;
    const b = fig.bones;
    for (const k in P) {
      const v = P[k];
      if (!Array.isArray(v) || !b[k]) continue;
      b[k].quaternion.setFromEuler(_e.set(v[0], v[1], v[2]));
    }
    // seated: the hips come down onto the seat; crouched: toward the floor
    if (P.seat && this.seat) fig.object.position.y = this.seat.y + 0.08 - HIP_Y * fig.scale;
    else if (P.drop) fig.object.position.y -= P.drop * fig.scale;
  }
}

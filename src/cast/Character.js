import * as THREE from 'three';
import { CAST_CLIPS } from './clips.js';
import { KO_D, IS_ADDITIVE } from './castAnim.js';
import { newspaper, holder, umbrella, blood, cloth } from './extras.js';
import { RNG } from '../util/rng.js';

// A Character (docs/story/CONTRACTS.md §6): one figure of the story on the
// Hood's skeleton. The figure itself (`c.fig`) is a Figure (src/cast/
// Figure.js: a Hood in a costume) or, for the kinds hood / heavy, a Hood of
// stage.hoods; the Character is what a scene directs:
//   c.name c.kind c.pos c.yaw c.alive c.object c.bones c.hp c.brain c.state c.down
//   c.setState(name, fade)          idle walk run aim | sit sitEat sitDrink sitRead
//                                   sitSmoke sitTalk | lean wipe duck cower watch hatch
//                                   read | br_guard | ko ...  (a looping base state)
//   c.play(clip, { fade, hold, onMark: { mark: fn } }) -> handle   handle.done / .t
//   c.clip(name) -> { duration, marks }        (src/cast/clips.js)
//   *c.walkTo(anchor | {x, z}, { speed, run })  a generator for scripts
//   c.sit(anchor) / c.stand()   c.lookAt(Vector3 | null)   c.face(yaw)   c.place(at, yaw)
//   c.hold(prop | null, 'L' | 'R', { grip })   c.hit({ dir, power, zone, by })   c.ko(kind)
//   c.glance(pos, seconds)      a look at something (the door's bell, a noise)
//   c.notice(pos)               the brawler's slow turn of the head (P0.3)
//   c.bleed(level)              blood at his mouth (> 0) and on his shirt (> 0.5)
//   c.capLoose                  true: the next blow to the head knocks the cap off
//   c.items   Map name -> Object3D the figure carries (the brawler's matchbook)
// Yaw: c.yaw and c.face(yaw) are the FIGURE's heading (a Hood's: it faces
// (sin yaw, cos yaw)); an anchor's yaw is a viewer's (the controller's: it
// looks along (-sin yaw, -cos yaw)), so a figure put on an anchor turns to
// anchor.yaw + PI. place / sit / walkTo do that for you.
// A clip that moves him (rise, the throws, the last blow) carries his
// position (Figure.startRoot); br_ko_window travels to the anchor
// 'diner.pavement.ko' from wherever he is, his back to it.
const HOOD_STATES = new Set(['idle', 'walk', 'run', 'aim', 'stagger']);
// clips that depend on the seat (baked per seat: 'sitEat@stool77')
const SEATED = new Set(['sit', 'sitEat', 'sitDrink', 'sitRead', 'sitSmoke', 'sitTalk', 'notice', 'rise']);
// calm states: the figure glances about now and then
const CALM = new Set(['idle', 'sit', 'sitEat', 'sitDrink', 'sitRead', 'sitSmoke', 'sitTalk', 'lean', 'wipe', 'hatch', 'watch', 'read']);
const _t = new THREE.Vector3(), _q = new THREE.Quaternion(), _v = new THREE.Vector3();

// anchor name | anchor | { x, z } | Vector3 -> { x, z, y | null, yaw (the
// figure's heading) | null, anchor }
export function resolveAt(stage, at) {
  const a = typeof at === 'string' ? stage.anchor(at) : at && at.pos ? at : null;
  if (typeof at === 'string' && !a) throw new Error(`cast: no anchor '${at}'`);
  if (a) return { x: a.pos.x, z: a.pos.z, y: a.pos.y, yaw: a.yaw != null ? a.yaw + Math.PI : null, anchor: a };
  return { x: at.x, z: at.z, y: at.y ?? null, yaw: null, anchor: null };
}

let SEQ = 0;

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
    this.base = 'idle';        // the looping state a one-shot returns to
    this.seat = null;          // { anchor, type, key, y, floor } while seated
    this.clipH = null;
    this.animName = 'idle';
    this.items = new Map();
    this.held = { L: null, R: null };
    this.capLoose = false;
    this.costumed = !!fig.costume;
    fig.character = this;
    // (a seeded stream per character, in spawn order: glances and fidgets)
    this.rng = (cast.stage.rng ? cast.stage.rng.fork(6600 + (SEQ++ % 997)) : new RNG(6600 + SEQ++));
    this._glance = { next: 2 + this.rng.next() * 6, until: 0, target: null };
    this._look = null;         // a slow turn of the head (notice)
    this.extras = [];
    if (kind === 'oldman') this.extras.push(newspaper(this));
    if (kind === 'couple_her') this.extras.push(holder(this));
    if (kind === 'couple_him') this.extras.push(umbrella(this));
    if (kind === 'waitress') { this._cloth = cloth(this); this.extras.push(this._cloth); }
    if (kind === 'brawler') { this._blood = blood(this); this.extras.push(this._blood); }
    if (this.costumed) fig.extras = this.extras;
    fig.afterPose = null;
  }

  get pos() { return this.fig.pos; }
  get yaw() { return this.fig.yaw; }
  set yaw(v) { this.fig.yaw = v; }
  get alive() { return !this.down && this.fig.alive; }
  get object() { return this.fig.object; }
  get bones() { return this.fig.bones; }
  get stage() { return this.cast.stage; }
  get game() { return this.cast.stage.game; }
  // the seat's height in the figure's own (model) units
  get seatModel() { return this.seat ? (this.seat.y - this.seat.floor) / this.fig.scale : 0; }

  // ---- placing -------------------------------------------------------------------
  where(at) { return resolveAt(this.stage, at); }

  place(at, yaw = null) {
    const w = this.where(at);
    this.fig.pos.x = w.x; this.fig.pos.z = w.z;
    this.fig._prevPos.copy(this.fig.pos);
    if (yaw != null) this.fig.yaw = yaw;
    else if (w.yaw != null) this.fig.yaw = w.yaw;
    this.fig._prevYaw = this.fig.yaw;
    if (this.fig._rmClip) this.fig._rmClip = null;
    return this;
  }

  face(yaw) { this.fig.yaw = yaw; }
  // (during the slow notice a look at something retargets the turn)
  lookAt(v) {
    if (this._look && v) { this._look.to.copy(v); return; }
    this._look = null;
    // (a look let go is eased off: the Hood's look is laid on only while it
    // has a target, so dropping the target turned the chest and the head
    // back in one frame - round 2, the pop as he rose off his stool. The
    // target is walked round to straight ahead first, then let go)
    if (!v && this.fig.lookTarget && this.fig._lookW > 0.05) { this._lookOff = { t: 0, from: this.fig.lookTarget.clone() }; return; }
    this._lookOff = null;
    this.fig.lookAt(v || null);
  }
  // (the look easing off, per step: toward a point straight ahead of him)
  lookOff(dt) {
    const L = this._lookOff, F = this.fig;
    if (!L) return;
    L.t += dt;
    const k = Math.min(1, L.t / 0.35), e = k * k * (3 - 2 * k);
    const ahead = _t.set(F.pos.x + Math.sin(F.yaw) * 3, L.from.y, F.pos.z + Math.cos(F.yaw) * 3);
    if (!F.lookTarget) F.lookTarget = new THREE.Vector3();
    F.lookTarget.lerpVectors(L.from, ahead, e);
    if (k >= 1) { this._lookOff = null; F.lookAt(null); }
  }

  // the resolved clip name (a seated clip is baked for its seat)
  clipName(name) {
    if (!this.costumed) return name;
    if (SEATED.has(name)) {
      const S = this.seat || this._lastSeat;
      return name + '@' + (S ? S.key : 'stool77');
    }
    if (name === 'idle' || HOOD_STATES.has(name)) return name;
    return name;
  }

  sit(anchor) {
    const w = this.where(anchor);
    this.place(anchor);
    this.fig.speed = 0;
    const name = typeof anchor === 'string' ? anchor : (w.anchor && w.anchor.name) || '';
    const type = /booth/.test(name) ? 'booth' : 'stool';
    const floor = this.stage.surfaceY(w.x, w.z);
    const y = w.y ?? (floor + (type === 'booth' ? 0.45 : 0.77));
    this.seat = { anchor: w.anchor, type, y, floor, key: type + Math.round((y - floor) * 100) };
    this._lastSeat = this.seat;
    this.setState('sit', 0.2);
  }

  // off the seat. After 'rise' he is already standing where the clip left
  // him; otherwise he steps back off it, away from what he faced.
  stand() {
    if (!this.seat) return;
    this.seat = null;
    const risen = this.animName && this.animName.startsWith('rise');
    if (!risen) {
      this.fig.pos.x -= Math.sin(this.fig.yaw) * 0.45;
      this.fig.pos.z -= Math.cos(this.fig.yaw) * 0.45;
      this.fig._prevPos.copy(this.fig.pos);
    }
    this.clipH = null;
    this.base = 'idle';
    this.state = 'idle';
    this._anim('idle', risen ? 0.4 : 0.3);
  }

  // ---- states and clips ------------------------------------------------------------
  _anim(name, fade = 0.25) {
    const F = this.fig;
    const nm = this.clipName(name);
    this.animName = nm;
    if (HOOD_STATES.has(name)) { F.setState(name, fade); return nm; }
    if (!this.costumed) {
      // (a Hood in the cast: only the Hood's clips: leanDoor, stepOut, sitCar)
      F.setState(F.anim.clips[name] ? name : 'idle', fade);
      return nm;
    }
    F.state = name;
    // the waitress wipes with her cloth
    if (this._cloth) this._cloth.object.visible = name === 'wipe';
    F.anim.play(nm, { fade });
    F.startRoot(nm);
    return nm;
  }

  setState(name, fade = 0.25) {
    if (HOOD_STATES.has(name)) {
      if (this.seat) this.stand();
      this.clipH = null;
      this.base = name;
      this.state = name;
      this._anim(name, fade);
      return;
    }
    if (!CAST_CLIPS[name]) throw new Error(`cast: no state '${name}'`);
    const def = CAST_CLIPS[name];
    if (def.loop || def.base) {
      this.clipH = null;
      this.base = name;
      this.state = name;
      if (def.state) { this.fig.setState(def.state, fade); if (def.state === 'run') this.fig.speed = 2.9; this.animName = def.state; return; }
      this._anim(name, fade);
      return;
    }
    // a one-shot as a state: play it and hold its last pose
    this.play(name, { fade, hold: true });
    this.base = name;
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
    this.clipH = h;
    this.state = name;
    // (a clip that leaves him in another state: stepping out of a doorway)
    if (c.then) this.base = c.then;
    const F = this.fig;
    if (c.state) {
      // (flight: the Hood's run, with an overlay of the kind's own)
      F.setState(c.state, fade);
      if (c.state === 'run') F.speed = 2.9;
      this.animName = c.state;
      const ov = c.overlay && c.overlay[this.kind];
      if (ov && this.costumed) F.anim.setOverlay(ov, 0.2);
      return h;
    }
    if (!this.costumed) { if (F.anim.clips[name]) this._anim(name, fade); else F.flinch(); return h; }
    if (IS_ADDITIVE(name)) { F.anim.additive(name); this.state = this.base; return h; }
    const nm = this._anim(name, fade);
    if (name === 'br_ko_window' && !c.selfTravel) this._koTravel(nm);
    // the brawler's notice turns his head slowly to the eye (lookAt retargets)
    if (name === 'notice' && this.game && this.game.eye) this.notice(this.game.eye.clone());

    if (c.cover && this.capLoose) h.onCover = c.cover;
    return h;
  }

  // the last blow carries him from where he stands to the pavement outside
  _koTravel(nm) {
    const a = this.stage.anchor('diner.pavement.ko');
    if (!a) return;
    const F = this.fig;
    const dx = a.pos.x - F.pos.x, dz = a.pos.z - F.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.5) return;
    // his back to it: he faces away from where he is going
    const yaw = Math.atan2(-dx, -dz);
    F.startRoot(nm, { scale: d / (KO_D * F.scale), yaw });
    F._prevYaw = yaw;
  }

  // ---- movement ----------------------------------------------------------------------
  *walkTo(target, { speed = 1.25, run = false, stop = 0.12 } = {}) {
    const w = this.where(target);
    if (this.seat) this.stand();
    this.clipH = null;
    const F = this.fig;
    F.speed = run ? 2.9 : speed;
    this.base = run ? 'run' : 'walk';
    this.state = this.base;
    this._anim(this.base, 0.2);
    // a load in the right hand is carried level before her
    if (this.costumed && !run && this.held.R) F.anim.setOverlay('carry', 0.25);
    for (let n = 0; n < 3600; n++) {
      const dx = w.x - F.pos.x, dz = w.z - F.pos.z, d = Math.hypot(dx, dz);
      if (d < stop + F.speed / 60) break;
      // (turning toward the mark, not snapping to it)
      const want = Math.atan2(dx, dz);
      let dy = want - F.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      F.yaw += Math.sign(dy) * Math.min(Math.abs(dy), 5 / 60);
      yield null;
    }
    F.pos.x = w.x; F.pos.z = w.z;
    F.speed = 0;
    if (this.costumed) F.anim.setOverlay(null, 0.2);
    this.base = 'idle';
    this.state = 'idle';
    this._anim('idle', 0.3);
    if (w.yaw != null) F.yaw = w.yaw;
  }

  // ---- holding -------------------------------------------------------------------------
  // a §8.1 prop at the hand (null: let go; returns what was held). grip:
  // 'upright' (it stands in the hand: a pot, a mug, a glass, a plate) or
  // 'hang' (held by the neck, hanging along the hand: a bottle as a club)
  hold(prop, hand = 'R', { grip = null } = {}) {
    const prev = this.held[hand];
    if (prev) { prev.parent && prev.parent.remove(prev); this.held[hand] = null; }
    if (!prop) return prev;
    const bone = this.fig.bones[hand === 'L' ? 'handL' : 'handR'];
    bone.add(prop);
    const kind = prop.userData.kind;
    // (the waitress pours: she holds a bottle round its body, not its neck)
    const g = grip || (kind === 'bottle' && this.kind === 'brawler' ? 'hang' : kind === 'bottle' && this.kind === 'waitress' ? 'body' : 'upright');
    const hs = this.costumed ? (this.fig.costume.garments.find((x) => x.kind === 'hands')?.s ?? 1) : 1;
    const inv = 1 / this.fig.scale;
    prop.scale.setScalar(inv);
    if (g === 'hang') prop.quaternion.identity();
    else prop.quaternion.setFromAxisAngle(_v.set(1, 0, 0), Math.PI / 2);
    // the palm, in the hand bone's frame
    _t.set(0, -0.068 * hs, 0.012);
    let gp = prop.userData.grip ? new THREE.Vector3().setFromMatrixPosition(prop.userData.grip) : new THREE.Vector3();
    if (g === 'body') {
      // the palm on the body a third of the way up, the axis a radius off
      // the palm on its inner side (the palm faces +x on the right hand)
      const sz = prop.userData.size, r = sz ? sz.x / 2 : 0.04;
      gp = new THREE.Vector3(0, (sz ? sz.y : 0.28) * 0.36, 0);
      _t.x += (hand === 'L' ? -1 : 1) * (r + 0.006) * inv;
    }
    gp.applyQuaternion(prop.quaternion).multiplyScalar(inv);
    prop.position.copy(_t).sub(gp);
    this.held[hand] = prop;
    return prev;
  }

  // ---- looking ----------------------------------------------------------------------------
  glance(pos, seconds = 1.6) {
    // (a man in a fist fight keeps his eyes on the man he fights: a plate
    // breaking by him does not snap his head round for a frame)
    if (!pos || !this.alive || this.noGlance) return;
    const G = this._glance;
    G.target = pos.clone ? pos.clone() : new THREE.Vector3(pos.x, pos.y ?? 1.5, pos.z);
    G.until = seconds;
    G.next = seconds + 3 + this.rng.next() * 6;
    this.fig.lookAt(G.target);
  }

  // the slow turn of the head toward pos (2.0 s: turned at 0.9, held)
  notice(pos) {
    const F = this.fig;
    const fwd = new THREE.Vector3(Math.sin(F.yaw), 0, Math.cos(F.yaw));
    const head = new THREE.Vector3().setFromMatrixPosition(F.bones.head.matrixWorld);
    this._look = { from: head.clone().addScaledVector(fwd, 2), to: pos.clone(), t: 0, dur: 0.9, cur: new THREE.Vector3() };
    F.lookAt(this._look.from);
  }

  // ---- the fight -------------------------------------------------------------------------
  hit({ dir = null, power = 0.5, zone = 'body', by = 'fist' } = {}) {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - power * 20);
    const G = this.game;
    if (this.kind === 'brawler' && this.costumed) {
      // the head snaps away from the blow; a body blow folds him
      let side = 'L';
      if (dir) {
        const lx = Math.cos(this.fig.yaw) * dir.x - Math.sin(this.fig.yaw) * dir.z;
        side = lx <= 0 ? 'L' : 'R';
      }
      const clip = zone === 'head' ? 'br_hitHead' + side : 'br_hitBody';
      const busy = this.clipH && !this.clipH.done && /^br_(into|ko)/.test(this.clipH.name);
      if (!busy) this.play(clip, { fade: 0.05 });
      if (zone === 'head' && this.capLoose && !this.fig.hat) {
        const d = dir ? dir.clone().setY(0).normalize() : new THREE.Vector3(Math.sin(this.fig.yaw), 0, Math.cos(this.fig.yaw)).negate();
        this.fig.throwCover(d.multiplyScalar(2.2 + 1.5 * power).add(_v.set(0, 2.4, 0)));
      }
    } else this.fig.flinch(dir);
    if (G) G.emit('cast:hit', { who: this, dir, power, zone, by });
  }

  bleed(level = 1) { if (this._blood) this._blood.set(level); }

  // down, not dead: no blood pool; he stays where he fell, breathing
  ko(kind = 'deathBack') {
    if (this.down) return;
    this.down = true;
    this.seat = null;
    // (a man who is down looks at nothing: no turn of the chest or the head
    // toward anything while he lies there)
    this._look = null;
    this.lookAt(null);
    const G = this.game;
    if (!this.costumed) {
      this.clipH = null;
      this.fig.die(['deathBack', 'deathKnees', 'deathSpin'].includes(kind) ? kind : 'deathBack');
    } else {
      // (after the last blow he is already down: he only breathes; from his
      // feet he falls back first)
      const lying = this.animName.startsWith('br_ko_window');
      this.clipH = null;
      if (lying) this._anim('ko', 0.3);
      else { this._anim('koFall', 0.08); this._koFall = 0; }
      if (this.fig.hat == null && this.kind === 'brawler' && !lying) {
        const d = new THREE.Vector3(Math.sin(this.fig.yaw), 0, Math.cos(this.fig.yaw)).multiplyScalar(-1.2).add(_v.set(0, 1.8, 0));
        this.fig.throwCover(d);
      }
    }
    this.state = 'ko';
    this.base = 'ko';
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
        if (at <= h.t + 1e-6 && (at > t0 || (t0 === 0 && at === 0))) {
          h.fired.add(m);
          this.markDefault(h, m);
          if (h.onMark[m]) h.onMark[m](this, m);
        }
      }
      if (h.t >= h.duration) {
        if (h.loop) { h.t -= h.duration; h.fired.clear(); }
        else if (!h.hold) {
          h.done = true;
          const c = CAST_CLIPS[h.name];
          if (c.state) { this.fig.speed = 0; if (this.costumed) this.fig.anim.setOverlay(null, 0.2); }
          this.state = this.base;
          if (!IS_ADDITIVE(h.name)) this._anim(this.base, c.fadeOut ?? 0.25);
        }
      }
    }
    if (this._koFall != null && this.costumed) {
      this._koFall += dt;
      if (this._koFall > 1.15) { this._koFall = null; this._anim('ko', 0.3); }
    }
    if (this._lookOff) this.lookOff(dt);
    if (this.costumed && this.alive) this.life(dt);
    if (this.own) this.fig.update(dt, t, camera);
  }

  // what a clip does to the figure itself at its marks (lane 7 adds the
  // world's side: sounds, glass, the stools)
  markDefault(h, m) {
    if (h.name === 'br_ko_window' && m === 'glass' && this.kind === 'brawler' && !this.fig.hat) {
      this.fig.throwCover(new THREE.Vector3(Math.sin(this.fig.yaw), 0, Math.cos(this.fig.yaw)).multiplyScalar(-1.5).add(_v.set(0, 2, 0)));
    }
  }

  // glances: now and then toward the eye, toward the room; a slow notice
  life(dt) {
    const F = this.fig;
    const L = this._look;
    if (L) {
      L.t += dt;
      const k = Math.min(1, L.t / L.dur);
      const e = k * k * (3 - 2 * k);
      L.cur.lerpVectors(L.from, L.to, e);
      F.lookTarget = F.lookTarget || new THREE.Vector3();
      F.lookTarget.copy(L.cur);
      return;
    }
    const G = this._glance;
    if (G.until > 0) {
      G.until -= dt;
      if (G.until <= 0) this.lookAt(null);
      return;
    }
    if (!CALM.has(this.state)) return;
    G.next -= dt;
    if (G.next > 0) return;
    const game = this.game;
    const r = this.rng.next();
    let tgt = null;
    if (r < 0.35 && game && game.eye) tgt = game.eye.clone();
    else {
      const a = F.yaw + (this.rng.next() - 0.5) * 2.2;
      tgt = new THREE.Vector3(F.pos.x + Math.sin(a) * 4, F.pos.y + 1.4 + (this.rng.next() - 0.5) * 0.6, F.pos.z + Math.cos(a) * 4);
    }
    this.glance(tgt, 1.1 + this.rng.next() * 1.8);
  }
}

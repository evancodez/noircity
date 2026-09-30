import * as THREE from 'three';
import { buildProp } from '../../props/index.js';

// The warehouse crew (lane B6, scene 8): six men on the floor, each with a
// light, walking designed rounds. Their lights and their bodies are the
// whole language of the scene (docs/story/briefs/B6_WAREHOUSE.md):
//   seeing   his light on me: he sees me. Me in a lamp's pool (or any light
//            on me: game.exposure): he sees me from wherever he is looking
//            my way. In the dark and out of his beam: only within 3 m in
//            front of him. Always with a clear line (crates, walls, the
//            truck cut it).
//   hearing  running is heard within 8 m, walking within 3 m, crouching
//            never; a bottle breaking or the load crashing, far off.
//   calm     his round: walk, stop, look about, walk on (his light swinging
//            a little as he walks)
//   curious  he stops; his head comes round to what he glimpsed or heard,
//            then his light; a low sound. Certainty takes 1 to 2.5 s (slower
//            in the dark, faster in a pool or his beam, nearer is faster);
//            out of his sight it drains away and he goes to look
//   search   he walks to where I was, looks about with his light, gives up
//            and walks back to his round
//   alarm    a whistle, they all come: the cosh from behind (the scene
//            decides what that does: onCaught)
// Everything runs in the fixed step from the step's time; the few random
// choices come from the scene's rng.
export const TUNE = {
  walk: 1.25, search: 1.1, run: 3.1,
  turn: 3.2, lookRate: 2.6, lightRate: 2.0, lightLag: 0.3,
  beamHalf: 0.3,
  viewHalf: 1.05, viewRange: 30, nearDark: 3.0,
  certainDark: 2.5, certainLit: 1.0,
  hearRun: 8, hearWalk: 3,
  decay: 0.32, grace: 0.6, lost: 1.6,
  searchLook: 4.2, alarmCosh: 1.7,
};
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Quaternion();
const _X = V(1, 0, 0);

// one man of the crew
export class Man {
  constructor(crew, spec) {
    this.crew = crew;
    this.spec = spec;
    this.name = spec.name;
    const { stage } = crew;
    const hood = spec.kind === 'hood';
    this.hood = hood;
    this.c = stage.cast.spawn(hood ? 'hood' : spec.kind, { at: { x: spec.at[0], z: spec.at[1] }, yaw: spec.yaw ?? 0, brain: 'none', name: spec.name, variant: spec.variant || null });
    this.fig = this.c.fig;
    this.c.noGlance = true;
    // (the pier's floor: 0 under him wherever the eye is)
    this.fig.surface = () => 0;
    this.route = spec.route || [];
    this.entry = spec.entry ? spec.entry.map((e) => ({ ...e })) : null;
    this.ri = spec.ri ?? 0;
    this.wait = spec.wait0 ?? 0;
    this.mode = spec.start || (this.route.length > 1 ? 'patrol' : 'hold');
    this.a = 0;
    this.seenT = -1;          // time I was last seen by him
    this.last = null;         // where he last saw or heard me
    this.path = null; this.pi = 0;
    this.look = this.fig.yaw; this.lookWant = this.fig.yaw;
    this.light = this.fig.yaw; this.lightPitch = -0.22;
    this.lookHold = 0;
    this.sweep = 0;
    this.modeT = 0;
    this.losT = 0; this.los = false;
    this.down = false;
    // his light: a lantern or a torch, its beam a lamp of the pier's
    this.lamp = null; this.prop = null;
    if (spec.light) {
      const L = stage.lamps;
      const kind = spec.light;
      this.lamp = L.reuse(kind) || L.torch(kind, kind === 'lantern' ? { half: 0.34, range: 9.5, strength: 0.9 } : { half: 0.26, range: 11, strength: 1.0 });
      this.lamp.on = true;
      this.prop = buildProp(kind === 'lantern' ? 'lantern' : 'torch');
      this.prop.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.userData.noRay = true; } });
      stage.scene.add(this.prop);
    }
    if (!hood && this.c.costumed) {
      this.fig.anim.setOverlay(spec.light ? 'dh_carry' : null, 0);
      // the cargo hook on his belt
      const hook = buildProp('cargoHook');
      hook.scale.setScalar(1 / this.fig.scale);
      hook.position.set(-0.17, -0.02, 0.06);
      hook.rotation.set(Math.PI / 2, 0.2, -0.3);
      hook.traverse((o) => { if (o.isMesh) o.userData.noRay = true; });
      this.fig.bones.hips.add(hook);
      this.hook = hook;
    }
    if (hood) {
      // a Hood holds his torch out in the left hand: the arm set after the
      // pose, straight from the shoulder to a bent elbow
      this.fig.afterPose = (h) => this.hoodArm(h);
    }
    this.c.setState('idle', 0);
    this.aim(0);
  }

  get pos() { return this.fig.pos; }

  // a Hood's torch arm (upper arm swung forward, the elbow bent up)
  hoodArm(h) {
    if (!this.lamp || this.down || !h.alive) return;
    const b = h.bones;
    b.upperArmL.quaternion.setFromAxisAngle(_X, -0.45).multiply(_q.setFromAxisAngle(V(0, 0, 1), 0.12));
    b.forearmL.quaternion.setFromAxisAngle(_X, -1.25);
    b.handL.quaternion.setFromAxisAngle(_X, 0.3);
  }

  // where his head is (the eyes), world
  eye(out = new THREE.Vector3()) {
    const f = this.fig;
    f.bones.head.getWorldPosition(out);
    return out;
  }

  // ---- his light ------------------------------------------------------------------
  aim(dt) {
    if (!this.lamp) return;
    const f = this.fig, on = !this.down && this.lamp.on !== false;
    // (the lantern hangs from the fist by its bail; the torch is the fist)
    const hand = this.hood ? f.bones.handL : f.bones.handR;
    hand.getWorldPosition(_a);
    const yaw = this.light, pitch = this.lightPitch;
    const dir = _d.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    if (this.down) { _a.set(f.pos.x + Math.sin(f.yaw) * 0.5, 0.12, f.pos.z + Math.cos(f.yaw) * 0.5); }
    const P = this.prop;
    if (this.spec.light === 'lantern') {
      P.position.set(_a.x, _a.y - 0.33, _a.z);
      P.rotation.set(0, yaw, 0);
    } else {
      P.position.copy(_a).addScaledVector(dir, 0.04);
      P.quaternion.setFromUnitVectors(V(0, 0, 1), dir);
      P.position.y -= 0.03;
    }
    if (this.down) { P.position.set(_a.x, 0, _a.z); P.rotation.set(0, yaw, Math.PI / 2); }
    P.updateMatrixWorld(true);
    const lens = P.userData.lens ? P.userData.lens.clone().applyMatrix4(P.matrixWorld) : _a.clone();
    this.lamp.aim(lens, dir);
    this.lamp.on = on && !this.lightOff;
    this.lampPos = lens;
  }

  // ---- seeing and hearing -----------------------------------------------------------
  // how well he sees me this step (0..1) and why
  perceive(dt, t) {
    const C = this.crew, G = C.game, pl = C.player;
    if (this.down) return 0;
    const eye = this.eye(_b);
    const P = pl.chest;
    const dx = P.x - eye.x, dz = P.z - eye.z, dy = P.y - eye.y;
    const d = Math.hypot(dx, dz, dy);
    if (d > TUNE.viewRange) return 0;
    const bearing = Math.atan2(dx, dz);
    const off = Math.abs(wrap(bearing - this.look));
    // his beam: the lamp's axis to my chest (or my head)
    let beam = 0;
    if (this.lamp && this.lamp.on && this.lampPos) {
      const lp = this.lampPos, ax = this.lamp.axis;
      for (const q of [pl.chest, pl.head]) {
        _d.subVectors(q, lp);
        const L = _d.length();
        if (L > (this.lamp.range || 10) * 0.9) continue;
        const ang = Math.acos(Math.max(-1, Math.min(1, _d.dot(ax) / Math.max(L, 1e-4))));
        if (ang < TUNE.beamHalf * 1.15) beam = Math.max(beam, 1 - Math.max(0, ang - TUNE.beamHalf * 0.6) / (TUNE.beamHalf * 0.55));
      }
    }
    // (the lamps' light on me: a torch on me is its own man's beam, below)
    const lit = pl.lampLit;
    const inView = off < TUNE.viewHalf;
    let s = 0;
    if (beam > 0) s = Math.max(s, 0.6 + 0.4 * beam);
    if (inView && lit > 0.2) s = Math.max(s, Math.min(1, (lit - 0.1) * 1.4));
    if (inView && d < TUNE.nearDark) s = Math.max(s, (pl.crouch ? 0.55 : 0.8) * (1 - d / TUNE.nearDark) + 0.2);
    if (s <= 0) return 0;
    // a clear line (looked for every 0.1 s)
    this.losT -= dt;
    if (this.losT <= 0) {
      this.losT = 0.1;
      this.los = false;
      for (const q of [pl.head, pl.chest]) {
        _d.subVectors(q, eye);
        const L = _d.length();
        _d.divideScalar(L);
        const o = _a.copy(eye).addScaledVector(_d, 0.25);
        if (!G.rays.raycast(o, _d, Math.max(0.05, L - 0.5), { anyHit: true })) { this.los = true; break; }
      }
    }
    if (!this.los) return 0;
    // (how lit I am decides how fast he is sure; nearer is faster)
    this.why = beam > 0 ? 'beam' : lit > 0.2 ? 'lit' : 'near';
    // (what he saw, for the tests and the report: why, how far, how far off his look)
    this.saw = { why: this.why, d: +d.toFixed(2), off: +off.toFixed(2), beam: +beam.toFixed(2), lit: +lit.toFixed(2), s: +s.toFixed(2), at: [+P.x.toFixed(2), +P.z.toFixed(2)], t: +t.toFixed(2),
      me: [+this.pos.x.toFixed(2), +this.pos.z.toFixed(2)], look: +this.look.toFixed(2), light: +this.light.toFixed(2), yaw: +this.fig.yaw.toFixed(2), mode: this.mode, lamp: this.lampPos ? this.lampPos.toArray().map((v) => +v.toFixed(2)) : null, axis: this.lamp ? this.lamp.axis.toArray().map((v) => +v.toFixed(2)) : null };
    const litK = Math.max(beam > 0 ? 1 : 0, Math.min(1, lit * 1.3));
    // (the brief's one to two and a half seconds: never less than a second
    // from his "hm" to the whistle, near or not, lit or not - a player who
    // hears it has time to drop or step back into the black; the dark is
    // quicker near him, down to that second)
    const T = Math.max(TUNE.certainLit, (TUNE.certainDark + (TUNE.certainLit - TUNE.certainDark) * litK) * Math.max(0.55, Math.min(1, d / 7)));
    return s / T;
  }

  hear(pos, r, kind) {
    if (this.down || this.mode === 'alarm') return;
    const d = Math.hypot(pos.x - this.pos.x, pos.z - this.pos.z);
    if (d > r) return;
    this.heard = { pos: pos.clone(), kind, d };
  }

  // ---- modes ------------------------------------------------------------------------------
  setMode(m) {
    if (this.mode === m) return;
    this.prevMode = this.mode;
    this.mode = m;
    this.modeT = 0;
    this.path = null;
    const C = this.crew;
    if (this.c.costumed && !this.down) this.fig.anim.setOverlay(m === 'curious' ? 'dh_peer' : m === 'fix' ? 'dh_fix' : this.lamp ? 'dh_carry' : null, 0.35);
    if (m === 'curious') {
      C.sound('hm', this.eye(V(0, 0, 0)));
      // (for the plays and the report: what turned him)
      C.game.emit('b6:curious', { by: this.name, from: this.prevMode, heard: this.lastHeard || null, saw: this.saw || null, t: +C.game.time.toFixed(2) });
    }
    if (m === 'search' || m === 'investigate') this.searchT = 0;
  }

  go(x, z) {
    const N = this.crew.stage.nav;
    const p = N.findPath(this.pos.x, this.pos.z, x, z);
    this.path = p && p.length ? p : [V(x, 0, z)];
    this.pi = 0;
  }

  // walk the path; true when there
  follow(dt, speed) {
    const f = this.fig;
    if (!this.path || this.pi >= this.path.length) { this.stand(); return true; }
    const tgt = this.path[this.pi];
    const dx = tgt.x - f.pos.x, dz = tgt.z - f.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.3) { this.pi++; if (this.pi >= this.path.length) { this.stand(); return true; } return false; }
    const want = Math.atan2(dx, dz);
    const err = wrap(want - f.yaw);
    f.yaw += Math.sign(err) * Math.min(Math.abs(err), TUNE.turn * dt);
    // (a sharp corner: he turns on the spot first)
    const k = Math.abs(err) > 0.9 ? 0 : speed;
    if (k > 0) {
      if (this.c.state !== (speed > 2 ? 'run' : 'walk')) this.c.setState(speed > 2 ? 'run' : 'walk', 0.25);
      f.speed = Math.min(k, d / Math.max(dt, 1e-3));
    } else this.stand();
    return false;
  }

  stand() {
    const f = this.fig;
    f.speed = 0;
    if (this.c.state !== 'idle' && !this.down) this.c.setState('idle', 0.3);
  }

  // one step
  update(dt, t) {
    const C = this.crew, pl = C.player, f = this.fig;
    this.modeT += dt;
    if (this.down) { this.aim(dt); return; }
    // what he sees and hears
    const rate = this.perceive(dt, t);
    if (rate > 0) {
      this.a = Math.min(1, this.a + rate * dt);
      this.seenT = t;
      this.last = (this.last || V(0, 0, 0)).set(pl.feet.x, 0, pl.feet.z);
    } else if (t - this.seenT > TUNE.grace) this.a = Math.max(0, this.a - TUNE.decay * dt);
    const H = this.heard;
    this.heard = null;
    if (H) this.lastHeard = { kind: H.kind, d: +H.d.toFixed(2), at: [+H.pos.x.toFixed(2), +H.pos.z.toFixed(2)], t: +t.toFixed(2) };
    if (rate > 0) this.lastSeenWhy = this.saw;
    if (this.mode === 'alarm') { this.alarmStep(dt); return; }
    if (this.a >= 1) { C.alarm(this); return; }

    // a sound: a footstep turns his head (curious); a crash or a bottle
    // sends him to look
    if (H && this.mode !== 'fix') {
      if (H.kind === 'step') {
        if (this.mode === 'patrol' || this.mode === 'hold' || this.mode === 'return') { this.setMode('curious'); this.a = Math.max(this.a, 0.12); }
        if (this.mode === 'curious' || this.mode === 'search') { this.last = H.pos.clone().setY(0); this.seenT = Math.max(this.seenT, t - TUNE.grace); }
      } else if (H.kind === 'crash' || H.kind === 'bottle') {
        this.target = H.pos.clone().setY(0);
        this.setMode('investigate');
        this.go(this.target.x, this.target.z);
        this.lookAtPoint(this.target, true);
      }
    }
    // a glimpse turns a calm man curious
    if (rate > 0 && (this.mode === 'patrol' || this.mode === 'hold' || this.mode === 'return' || this.mode === 'investigate' || this.mode === 'fix')) this.setMode('curious');

    switch (this.mode) {
      case 'patrol': this.patrol(dt, t); break;
      case 'hold': this.holdStep(dt, t); break;
      case 'wait': this.stand(); this.sway(dt, t); break;
      case 'curious': this.curious(dt, t); break;
      case 'search': this.searchStep(dt, t, false); break;
      case 'investigate': this.searchStep(dt, t, true); break;
      case 'return': this.returnStep(dt, t); break;
      case 'fix': this.fixStep(dt, t); break;
      default: break;
    }
    this.turnLook(dt);
  }

  // the look comes round at its rate; the light follows a beat later
  turnLook(dt) {
    const f = this.fig;
    const e = wrap(this.lookWant - this.look);
    this.look += Math.sign(e) * Math.min(Math.abs(e), TUNE.lookRate * dt);
    // (the head can turn only so far from the body: past it the body turns)
    const rel = wrap(this.look - f.yaw);
    if (Math.abs(rel) > 1.1 && (!f.speed || f.speed < 0.1)) f.yaw += Math.sign(rel) * Math.min(Math.abs(rel) - 1.1, TUNE.turn * dt);
    this.lagT = (this.lagT || 0) + dt;
    const el = wrap(this.look - this.light);
    this.light += Math.sign(el) * Math.min(Math.abs(el), TUNE.lightRate * dt);
    const head = this.eye(_a);
    const tgt = V(head.x + Math.sin(this.look) * 4, head.y + this.lightPitch * 3, head.z + Math.cos(this.look) * 4);
    this.c.lookAt(tgt);
    this.aim(dt);
  }

  lookAtPoint(p, snap = false) {
    this.lookWant = Math.atan2(p.x - this.pos.x, p.z - this.pos.z);
    if (snap) this.lookHold = 0;
  }

  // a calm man's light: ahead, swinging a little with his stride
  sway(dt, t) {
    const f = this.fig;
    this.lookWant = f.yaw + 0.22 * Math.sin(t * 0.9 + this.spec.at[0]);
    this.lightPitch += (-0.22 - this.lightPitch) * Math.min(1, dt * 2);
  }

  patrol(dt, t) {
    const R = this.route;
    // (a first walk before the round: the first man's pass through the door's pool)
    if (this.entry && this.entry.length) {
      if (!this.path) { const e = this.entry[0]; this.path = [V(e.x, 0, e.z)]; this.pi = 0; }
      this.sway(dt, t);
      if (this.follow(dt, this.spec.speed || TUNE.walk)) { this.entry.shift(); this.path = null; }
      return;
    }
    if (!R.length) { this.stand(); return; }
    const p = R[this.ri];
    if (this.wait > 0) {
      this.wait -= dt;
      this.stand();
      // (at a stop he looks where the round says: each look for a share of the wait)
      const L = p.looks;
      if (L && L.length) {
        const k = Math.min(L.length - 1, Math.floor((1 - this.wait / p.wait) * L.length));
        this.lookWant = L[k];
      } else this.sway(dt, t);
      if (this.wait <= 0) { this.ri = (this.ri + 1) % R.length; this.path = null; }
      return;
    }
    if (!this.path) { this.path = [V(p.x, 0, p.z)]; this.pi = 0; }
    this.sway(dt, t);
    if (this.follow(dt, this.spec.speed || TUNE.walk)) {
      this.path = null;
      if (p.wait) this.wait = p.wait; else this.ri = (this.ri + 1) % R.length;
    }
  }

  holdStep(dt, t) {
    this.stand();
    const L = this.spec.looks || [this.spec.yaw ?? this.fig.yaw];
    const per = this.spec.lookEvery || 3.5;
    const k = Math.floor((t + (this.spec.phase || 0)) / per) % L.length;
    this.lookWant = L[k];
  }

  curious(dt, t) {
    this.stand();
    if (this.last) this.lookAtPoint(this.last);
    this.lightPitch += ((this.last ? Math.atan2(-1.2, Math.max(1, Math.hypot(this.last.x - this.pos.x, this.last.z - this.pos.z))) : -0.2) - this.lightPitch) * Math.min(1, dt * 3);
    // out of his sight: it drains; lost a while, he goes to look (or back
    // to his round if it was nothing much)
    const t0 = this.crew.game.time;
    if (t0 - this.seenT > TUNE.lost && this.modeT > 1.2) {
      if (this.a > 0.3 && this.last) { this.target = this.last.clone(); this.setMode('search'); this.go(this.target.x, this.target.z); }
      else if (this.a <= 0.05) this.resume();
    }
  }

  searchStep(dt, t, noise) {
    // (walking to it: his light ahead, sweeping; there: he looks about)
    if (this.path) {
      this.lookWant = this.fig.yaw + 0.5 * Math.sin(t * 1.6);
      this.lightPitch += (-0.25 - this.lightPitch) * Math.min(1, dt * 2);
      const near = this.target && Math.hypot(this.target.x - this.pos.x, this.target.z - this.pos.z) < (noise ? 1.8 : 0.8);
      if (this.follow(dt, TUNE.search) || near) { this.path = null; this.stand(); this.searchT = 0; }
      return;
    }
    this.stand();
    this.searchT += dt;
    const yaw0 = this.fig.yaw;
    const k = Math.floor(this.searchT / 1.3) % 3;
    this.lookWant = yaw0 + [-0.9, 0.9, 0][k];
    this.lightPitch += (-0.35 - this.lightPitch) * Math.min(1, dt * 2);
    if (this.searchT > TUNE.searchLook) { this.a = Math.min(this.a, 0.2); this.crew.sound('shrug', this.eye(V(0, 0, 0))); this.resume(); }
  }

  // a new post: he walks there and stands it, looking about (his round is
  // over; a sound or a glimpse still turns him, and he comes back here)
  sendTo(x, z, yaw, looks = null) {
    if (this.down || this.mode === 'alarm') return;
    this.route = [];
    this.spec = { ...this.spec, at: [x, z], yaw, looks: looks || [yaw], lookEvery: 3.2 };
    this.wait = 0;
    this.setMode('return');
    this.go(x, z);
  }

  // back to his round: on to the point he was walking to (a man who turned
  // to look goes on the way he was going, not back the way he came)
  resume() {
    if (this.route.length < 2) {
      const h = this.spec.at;
      this.setMode('return');
      this.go(h[0], h[1]);
      return;
    }
    const best = Math.max(0, Math.min(this.route.length - 1, this.ri | 0));
    this.ri = best;
    this.wait = 0;
    this.setMode('return');
    this.go(this.route[best].x, this.route[best].z);
  }

  returnStep(dt, t) {
    this.sway(dt, t);
    if (this.follow(dt, TUNE.walk)) {
      if (this.route.length >= 2) this.setMode('patrol');
      else { this.setMode('hold'); const y = this.spec.yaw ?? this.fig.yaw; this.fig.yaw = y; }
    }
  }

  // the switch: walk to it, put it back, back to the round
  fixStep(dt, t) {
    const F = this.fixing;
    if (!F) { this.resume(); return; }
    if (this.path) {
      this.sway(dt, t);
      if (this.follow(dt, TUNE.walk)) { this.path = null; this.fixT = 0; this.fig.yaw = F.face; }
      return;
    }
    this.stand();
    this.fixT += dt;
    this.lookWant = F.face;
    this.lightPitch += (0.05 - this.lightPitch) * Math.min(1, dt * 3);
    if (this.fixT > F.dur && !F.done) { F.done = true; F.onDone && F.onDone(); }
    if (this.fixT > F.dur + 0.8) { this.fixing = null; this.resume(); }
  }

  alarmStep(dt) {
    const pl = this.crew.player;
    this.lookAtPoint(pl.feet);
    this.lightPitch += (-0.1 - this.lightPitch) * Math.min(1, dt * 4);
    this.repath = (this.repath || 0) - dt;
    if (this.repath <= 0) { this.repath = 0.5; this.go(pl.feet.x, pl.feet.z); }
    const d = Math.hypot(pl.feet.x - this.pos.x, pl.feet.z - this.pos.z);
    if (d > 1.6) this.follow(dt, TUNE.run); else this.stand();
    this.turnLook(dt);
  }

  // knocked down from behind: he folds, lies there
  knockDown() {
    if (this.down) return;
    this.down = true;
    this.mode = 'down';
    this.fig.speed = 0;
    this.c.lookAt(null);
    if (this.c.costumed) { this.fig.anim.setOverlay(null, 0.1); this.c.play('dh_fold', { fade: 0.08, hold: true }); }
    else this.c.ko('deathKnees');
    this.c.down = true;
    if (this.lamp) this.lightOff = false;
  }

  remove() {
    if (this.lamp) this.crew.stage.lamps.release(this.lamp);
    if (this.prop && this.prop.parent) this.prop.parent.remove(this.prop);
  }
}

// the crew: every man, the alarm, what they hear
export class Crew {
  constructor(game, stage, { rng, onAlarm = null, onCaught = null } = {}) {
    this.game = game;
    this.stage = stage;
    this.rng = rng;
    this.men = [];
    this.onAlarm = onAlarm;
    this.onCaught = onCaught;
    this.alarmT = -1;
    this.player = { eye: V(0, 0, 0), head: V(0, 0, 0), chest: V(0, 0, 0), feet: V(0, 0, 0), crouch: false, exposure: 0, lampLit: 0, speed: 0 };
  }

  add(spec) { const m = new Man(this, spec); this.men.push(m); return m; }
  get(name) { return this.men.find((m) => m.name === name) || null; }

  sound(name, pos, p = {}) { const S = this.game.sfx; if (S && S.play) S.play(name, pos, p, { ref: 3 }); }

  // a noise at pos heard within r (a step, a crash, a bottle)
  noise(pos, r, kind = 'step') { for (const m of this.men) m.hear(pos, r, kind); }

  // the nearest men that are free to go and look at pos (n of them)
  sendNearest(pos, n, kind = 'crash', maxD = 40) {
    const free = this.men.filter((m) => !m.down && m.mode !== 'alarm' && m.mode !== 'fix').map((m) => ({ m, d: Math.hypot(m.pos.x - pos.x, m.pos.z - pos.z) })).filter((e) => e.d < maxD).sort((a, b) => a.d - b.d).slice(0, n);
    for (const { m } of free) m.hear(pos, 1e9, kind);
    return free.map((e) => e.m);
  }

  alarm(by) {
    if (this.alarmT >= 0) return;
    this.alarmT = 0;
    this.alarmBy = by;
    // (for the plays and the report: who, and what he saw)
    this.game.emit('b6:alarm', { by: by.name, saw: by.saw || null, me: this.player.feet.toArray().map((v) => +v.toFixed(2)), t: +this.game.time.toFixed(2) });
    this.sound('whistle', by.eye(V(0, 0, 0)));
    for (const m of this.men) { if (!m.down) { m.setMode('alarm'); m.a = 1; } }
    if (this.onAlarm) this.onAlarm(by);
  }

  // the player as the men see him (the scene fills it every step)
  sense(p) { Object.assign(this.player, p); }

  step(dt, t) {
    for (const m of this.men) m.update(dt, t);
    // a man found lying: the one who finds him goes to him, and the
    // nearest with him; they look about (a search), then go back
    this.findT = (this.findT || 0) - dt;
    if (this.findT <= 0 && this.alarmT < 0) { this.findT = 0.25; this.findDown(t); }
    if (this.alarmT >= 0) {
      this.alarmT += dt;
      if (this.alarmT >= TUNE.alarmCosh && !this.caught) { this.caught = true; if (this.onCaught) this.onCaught(this.alarmBy); }
    }
  }

  findDown(t) {
    const G = this.game;
    for (const d of this.men) {
      if (!d.down || d.found) continue;
      const p = _c.set(d.pos.x, 0.35, d.pos.z);
      for (const m of this.men) {
        if (m.down || !(m.mode === 'patrol' || m.mode === 'hold' || m.mode === 'return' || m.mode === 'wait' || m.mode === 'curious')) continue;
        const eye = m.eye(_b);
        const dx = p.x - eye.x, dz = p.z - eye.z, L = Math.hypot(dx, dz);
        if (L > 9) continue;
        if (Math.abs(wrap(Math.atan2(dx, dz) - m.look)) > TUNE.viewHalf) continue;
        // (in his beam, or near enough to make out in the dark)
        const inBeam = m.lamp && m.lamp.on && m.lampPos && _d.subVectors(p, m.lampPos).normalize().dot(m.lamp.axis) > Math.cos(TUNE.beamHalf * 1.6);
        if (!inBeam && L > 4.5) continue;
        _d.subVectors(p, eye); const Ld = _d.length(); _d.divideScalar(Ld);
        if (G.rays.raycast(_a.copy(eye).addScaledVector(_d, 0.25), _d, Math.max(0.05, Ld - 0.6), { anyHit: true })) continue;
        d.found = true;
        this.sound('hm', eye);
        G.emit('b6:found', { by: m.name, down: d.name, t: +t.toFixed(2) });
        m.hear(V(d.pos.x, 0, d.pos.z), 1e9, 'crash');
        this.sendNearest(V(d.pos.x, 0, d.pos.z), 2, 'crash', 30);
        break;
      }
    }
  }

  // the most any man is sure of me (0..1), and who
  get most() { let b = null; for (const m of this.men) if (!b || m.a > b.a) b = m; return b; }

  clear() { for (const m of this.men) m.remove(); this.men = []; }
}

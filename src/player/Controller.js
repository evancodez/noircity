import * as THREE from 'three';

// First-person controller: pointer-lock mouse look, WASD (+Shift sprint),
// capsule-vs-XZ collision against the stage's colliders, its walking surface
// (stage.surfaceY: kerbs, floors), head bob. Camera eye height 1.65 m above
// whatever surface the player stands on. `world` is the current stage
// (re-bound by the Game on stage:enter).
//
// Modes (docs/story/CONTRACTS.md §7.1): controller.setMode(name, opts),
// controller.mode. First person only; a pose is { x, y, z, yaw, pitch,
// fov? } with y the EYE's world height and yaw / pitch the controller's
// (forward = (-sin yaw, -cos yaw)).
//   'walk'      as it always was (WASD, sprint, kerbs, bob, footfalls)
//   'seated'    { anchor, yawRange: [-2.3, 2.3], pitchRange: [-0.9, 0.7], lean: 0.06,
//                 eyeY: anchor.eyeY | 1.6 }  the eye fixed over the seat, the
//                 look free inside the ranges (relative to the anchor's yaw)
//   'brawl'     { opponent: Character, ring: { x, z, r }, dist: 1.45, eyeY: 1.8 }
//                 the eye kept `dist` from him and locked on his chest; the
//                 mouse only nudges the view (+-0.12 rad); controller.slip
//                 (metres, + = right) moves the eye sideways
//   'table'     { pose, fov }  the puzzle view, eased in over 0.5 s
//   'cutscene'  { track(t) -> pose }  the script drives the eye
//   'drive'     { vehicle }  (wave B)
//   controller.ease(pose, seconds)   glide the eye to a pose and hold it
//   controller.shake(strength, dist)
// setPose() puts the controller back in 'walk' at that pose.
// (FOUNDATION: the modes are plain but working; lane 2 owns them: the
// seated swivel, the brawl's footwork, the eases)
export const EYE = 1.65;
export const MODES = ['walk', 'seated', 'brawl', 'table', 'cutscene', 'drive'];
const _v = new THREE.Vector3();
const clampA = (x, a, b) => Math.max(a, Math.min(b, x));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class Controller {
  constructor(camera, dom, world) {
    this.camera = camera;
    this.dom = dom;
    this.world = world;
    this.pos = new THREE.Vector3(-7.4, 0, 6);  // feet position
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.radius = 0.36;
    this.enabled = false;       // input enabled (pointer locked)
    this.keys = new Set();
    this.bobPhase = 0;
    this.bobAmp = 0;
    this.groundY = 0;
    this.stepTimer = 0;
    this.sensitivity = 0.0021;
    this.onStep = null;         // callback(x, z) for footsteps (ripples / audio)
    this.auto = null;           // { f, s, sprint } from the autopilot
    this.frozen = false;        // dead / title: no movement
    this.mode = 'walk';
    this.modeOpts = {};
    this.modeT = 0;
    this.bodyYaw = null;        // the body's heading when it is not the view's (seated: the stool's)
    this.nudge = { yaw: 0, pitch: 0 };   // brawl: the mouse's small say
    this.slip = 0;              // brawl: the eye's sideways offset (m)
    this.viewFx = null;         // the hands' clips' eye motion (Hands.viewFx)
    this._ease = null;          // { from, to, t, dur }

    this._onMouse = (e) => {
      if (!this.enabled) return;
      if (this.mode === 'brawl') {
        this.nudge.yaw = clampA(this.nudge.yaw - e.movementX * this.sensitivity, -0.12, 0.12);
        this.nudge.pitch = clampA(this.nudge.pitch - e.movementY * this.sensitivity, -0.12, 0.12);
        return;
      }
      if (this.mode === 'table' || this.mode === 'cutscene' || this.lookLocked) return;
      this.yaw -= e.movementX * this.sensitivity;
      this.pitch -= e.movementY * this.sensitivity;
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    };
    this._onKey = (e, down) => {
      const k = e.code;
      if (down) this.keys.add(k); else this.keys.delete(k);
    };
    document.addEventListener('mousemove', this._onMouse);
    document.addEventListener('keydown', (e) => this._onKey(e, true));
    document.addEventListener('keyup', (e) => this._onKey(e, false));
    document.addEventListener('pointerlockchange', () => {
      this.enabled = document.pointerLockElement === this.dom;
      if (!this.enabled) this.keys.clear();
    });
  }

  lock() {
    try {
      const p = this.dom.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* ignored: headless / unsupported */ }
  }

  setPose(x, z, yaw, pitch, y = null) {
    this.mode = 'walk';
    this.bodyYaw = null;
    this._modeBlend = null;
    this.modeOpts = {};
    this._ease = null;
    this.pos.set(x, 0, z);
    this.yaw = yaw;
    this.pitch = pitch;
    this.vel.set(0, 0, 0);
    this.groundY = y ?? this.world.surfaceY(x, z);
    this.apply(0);
  }

  // ---- modes ----------------------------------------------------------------------
  setMode(name, opts = {}) {
    if (!MODES.includes(name)) throw new Error(`controller.setMode: no mode '${name}'`);
    if (name === 'drive') throw new Error('controller: drive is wave B');
    const prev = this.eyePose();
    this.mode = name;
    if (name !== 'seated') this.bodyYaw = null;
    this.modeOpts = opts;
    this.modeT = 0;
    this._ease = null;
    this.vel.set(0, 0, 0);
    this.bobAmp = 0;
    const S = this.world;
    if (name === 'walk') {
      if (opts.pose) this.placeEye(opts.pose);
      else this.groundY = S.surfaceY(this.pos.x, this.pos.z);
    } else if (name === 'seated') {
      const a = typeof opts.anchor === 'string' ? S.anchor(opts.anchor) : opts.anchor;
      if (!a) throw new Error(`controller seated: no anchor '${opts.anchor}'`);
      // forward: he sits up at the counter, his head a hand ahead of the
      // stool's centre (on stool 4 the eye is at x -13.87), so the counter's
      // near edge runs across the bottom of the frame instead of under the
      // eye. The first frame of the game is square and calm: straight across
      // the counter at the back bar (the anchor's yaw), pitched a little
      // down (-0.14), no roll, ever; the lean as he looks down stays small.
      this.modeOpts = { yawRange: [-2.3, 2.3], pitchRange: [-0.9, 0.7], lean: 0.04, forward: 0.12, ...opts, anchor: a };
      this.bodyYaw = a.yaw;
      this.pos.set(a.pos.x, 0, a.pos.z);
      this.groundY = (opts.eyeY ?? a.eyeY ?? 1.6) - EYE + 0.02;
      this.yaw = a.yaw;
      this.pitch = opts.pitch ?? -0.14;
    } else if (name === 'brawl') {
      this.modeOpts = { dist: 1.45, eyeY: 1.8, ...opts };
      this.nudge.yaw = 0; this.nudge.pitch = 0; this.slip = 0;
    } else if (name === 'table') {
      this.ease(opts.pose, opts.ease ?? 0.5, prev);
    }
    // every mode change is eased (0.4 s) from where the eye was, unless the
    // eye jumps (a scene entered, another stage): then it cuts
    if (name !== 'table') this._modeBlend = { from: prev, t: 0, dur: opts.ease ?? 0.4, checked: false };
    // (a table view may take its own lens; any other mode gives it back)
    const c = this.camera;
    if (name === 'table' && opts.fov) { if (this._fov0 == null) this._fov0 = c.fov; c.fov = opts.fov; c.updateProjectionMatrix(); }
    else if (name !== 'table' && this._fov0 != null) { c.fov = this._fov0; this._fov0 = null; c.updateProjectionMatrix(); }
    this.apply(0);
    return this;
  }

  // the eye's pose right now
  eyePose() {
    const c = this.camera;
    return { x: c.position.x, y: c.position.y, z: c.position.z, yaw: this.yaw, pitch: this.pitch, fov: c.fov };
  }

  // stand the walking eye at a pose
  placeEye(p) {
    this.pos.set(p.x, 0, p.z);
    this.groundY = p.y != null ? p.y - EYE + 0.02 : this.world.surfaceY(p.x, p.z);
    this.yaw = p.yaw ?? this.yaw;
    this.pitch = p.pitch ?? this.pitch;
  }

  // glide the eye to `pose` over `seconds`, then hold it there (any mode)
  ease(pose, seconds = 0.4, from = null) {
    this._ease = { from: from || this.eyePose(), to: pose, t: 0, dur: Math.max(1e-3, seconds) };
  }

  // one step of a mode that is not 'walk' (no input: the mouse handler and
  // update() give the input)
  modeStep(dt) {
    const O = this.modeOpts;
    this.modeT += dt;
    if (this.mode === 'seated') {
      const a = O.anchor;
      const dy = clampA(wrap(this.yaw - a.yaw), O.yawRange[0], O.yawRange[1]);
      this.yaw = a.yaw + dy;
      // past +-1.2 rad the stool swivels with the look (the body turns: the
      // hands on the counter go with it)
      const sw = O.swivel ?? 1.2;
      this.bodyYaw = a.yaw + (Math.abs(dy) > sw ? Math.sign(dy) * (Math.abs(dy) - sw) : 0);
      this.pitch = clampA(this.pitch, O.pitchRange[0], O.pitchRange[1]);
      // a man leaning on the counter: the eye comes forward as he looks down
      const lean = O.lean * Math.max(0, -this.pitch);
      const fw = O.forward || 0, by = this.bodyYaw ?? a.yaw;
      this.pos.set(a.pos.x - Math.sin(by) * fw - Math.sin(this.yaw) * lean, 0, a.pos.z - Math.cos(by) * fw - Math.cos(this.yaw) * lean);
    } else if (this.mode === 'brawl' && O.opponent) {
      const op = O.opponent.pos;
      _v.set(this.pos.x - op.x, 0, this.pos.z - op.z);
      if (_v.lengthSq() < 1e-6) _v.set(1, 0, 0);
      _v.normalize();
      let x = op.x + _v.x * O.dist, z = op.z + _v.z * O.dist;
      // the slip: sideways across the line to him
      x += _v.z * this.slip; z += -_v.x * this.slip;
      if (O.ring) {
        const dx = x - O.ring.x, dz = z - O.ring.z, d = Math.hypot(dx, dz), R = O.ring.r ?? 2;
        if (d > R) { x = O.ring.x + dx / d * R; z = O.ring.z + dz / d * R; }
      }
      this.pos.set(x, 0, z);
      // (footwork: never through a stool, a booth or the counter)
      if (this.world.colliders) this.world.colliders.resolve(this.pos, this.radius * 0.8);
      x = this.pos.x; z = this.pos.z;
      this.groundY = O.eyeY - EYE + 0.02;
      const ty = (op.y || 0) + 1.45 * (O.opponent.fig ? O.opponent.fig.scale : 1) * 0.78;
      this.yaw = Math.atan2(-(op.x - x), -(op.z - z)) + this.nudge.yaw;
      this.pitch = Math.atan2(ty - O.eyeY, Math.hypot(op.x - x, op.z - z)) + this.nudge.pitch;
    } else if (this.mode === 'cutscene' && O.track) {
      const p = O.track(this.modeT);
      if (p) this._pose = p;
    }
  }

  update(dt) {
    if (this.mode !== 'walk' || this._ease) { this.apply(dt); return; }
    const k = this.keys;
    let f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    let s = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let sprint = k.has('ShiftLeft') || k.has('ShiftRight');
    // the battle autopilot (game/Autopilot.js) drives the same inputs
    if (this.auto) { f = this.auto.f; s = this.auto.s; sprint = !!this.auto.sprint; }
    if (this.frozen) { f = 0; s = 0; }
    const speed = sprint ? 6.8 : 4.0;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    // forward = (-sin, -cos), right = (cos, -sin) in XZ
    const wx = (-sin * f + cos * s), wz = (-cos * f - sin * s);
    const len = Math.hypot(wx, wz) || 1;
    const on = Math.min(1, Math.hypot(f, s));
    const tx = (wx / len) * speed * on;
    const tz = (wz / len) * speed * on;
    const accel = (Math.abs(f) + Math.abs(s) > 0.05) ? 12 : 9;
    const a = 1 - Math.exp(-accel * dt);
    this.vel.x += (tx - this.vel.x) * a;
    this.vel.z += (tz - this.vel.z) * a;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.world.colliders.resolve(this.pos, this.radius);

    const gy = this.world.surfaceY(this.pos.x, this.pos.z);
    this.groundY += (gy - this.groundY) * (1 - Math.exp(-14 * dt));
    const v = Math.hypot(this.vel.x, this.vel.z);
    this.bobAmp += ((v > 0.3 ? Math.min(1, v / 4) : 0) - this.bobAmp) * (1 - Math.exp(-8 * dt));
    const prev = this.bobPhase;
    this.bobPhase += dt * (v > 0.1 ? 2.1 + v * 0.95 : 0);
    // a footstep lands every half bob cycle
    if (Math.floor(prev / Math.PI) !== Math.floor(this.bobPhase / Math.PI) && this.onStep) this.onStep(this.pos.x, this.pos.z, v);
    this.apply(dt);
  }

  // a blast's kick (Phase 3a): strength falls with distance
  shake(strength = 1, dist = 0) {
    const k = strength / (1 + Math.max(0, dist - 4) * 0.15);
    this.shakeAmp = Math.max(this.shakeAmp || 0, Math.min(1, k));
    this.shakeT = 0;
  }

  apply(dt = 0) {
    const c = this.camera;
    // the pose-driven views: an ease, a table, a cutscene's track
    if (this.mode !== 'walk') this.modeStep(dt);
    const E = this._ease;
    let P = this.mode === 'cutscene' ? this._pose : null;
    if (E) {
      E.t = Math.min(E.dur, E.t + dt);
      const u = E.t / E.dur, k = u * u * (3 - 2 * u);
      const L = (a, b) => a + (b - a) * k;
      P = { x: L(E.from.x, E.to.x), y: L(E.from.y, E.to.y), z: L(E.from.z, E.to.z), yaw: E.from.yaw + wrap(E.to.yaw - E.from.yaw) * k, pitch: L(E.from.pitch, E.to.pitch) };
      // (an ease in walk mode lets go once it arrives: he walks on from there)
      if (E.t >= E.dur && this.mode === 'walk') { this._ease = null; this.placeEye(E.to); }
    }
    if (P) {
      this.yaw = P.yaw; this.pitch = P.pitch;
      this.pos.set(P.x, 0, P.z);
      this.groundY = P.y - EYE + 0.02;
      c.position.set(P.x, P.y, P.z);
      c.rotation.order = 'YXZ';
      c.rotation.set(P.pitch, P.yaw, 0);
      this.blendMode(dt);
      return;
    }
    const bobY = Math.abs(Math.sin(this.bobPhase)) * 0.045 * this.bobAmp;
    const bobX = Math.cos(this.bobPhase) * 0.025 * this.bobAmp;
    let sx = 0, sy = 0;
    if (this.shakeAmp > 0.001) {
      this.shakeT += dt;
      const a = this.shakeAmp * Math.exp(-this.shakeT * 5);
      sx = Math.sin(this.shakeT * 47) * 0.02 * a; sy = Math.sin(this.shakeT * 39 + 1.3) * 0.028 * a;
      if (a < 0.002) this.shakeAmp = 0;
    }
    // the hands' clips move the eye with the body (a punch's lunge, a slip,
    // a blow landing: Hands sets viewFx; zero outside those clips)
    const V = this.viewFx;
    let ox = 0, oy = 0, oz = 0, vy = 0, vp = 0, vr = 0;
    if (V && (V.yaw || V.pitch || V.roll || V.fwd || V.side || V.down)) {
      const sn = Math.sin(this.yaw), cs = Math.cos(this.yaw);
      ox = -sn * V.fwd + cs * V.side; oz = -cs * V.fwd - sn * V.side; oy = -V.down;
      vy = V.yaw; vp = V.pitch; vr = V.roll;
    }
    c.position.set(this.pos.x + Math.cos(this.yaw) * bobX + ox, this.groundY + EYE - 0.02 + bobY + oy, this.pos.z - Math.sin(this.yaw) * bobX + oz);
    c.rotation.order = 'YXZ';
    // (seated, the horizon never tips: a man on a stool does not roll his head)
    const roll = this.mode === 'seated' ? 0 : Math.sin(this.bobPhase) * 0.004 * this.bobAmp + sx * 0.5 + vr;
    c.rotation.set(this.pitch + sy + vp, this.yaw + sx + vy, roll);
    this.blendMode(dt);
  }

  // the ease of a mode change: the camera goes from where the eye was to
  // where the new mode puts it over 0.4 s (smoothstep)
  blendMode(dt) {
    const B = this._modeBlend;
    if (!B) return;
    const c = this.camera;
    if (!B.checked) {
      B.checked = true;
      // (and never from nowhere: an eye that was not yet placed is no start)
      const jump = Math.hypot(c.position.x - B.from.x, c.position.y - B.from.y, c.position.z - B.from.z);
      if (B.from.x === undefined || !Number.isFinite(jump) || !Number.isFinite(B.from.yaw + B.from.pitch) || jump > 2.5) { this._modeBlend = null; return; }
    }
    B.t += dt;
    const u = Math.min(1, B.t / B.dur);
    if (u >= 1) { this._modeBlend = null; return; }
    const k = 1 - u * u * (3 - 2 * u);
    c.position.x += (B.from.x - c.position.x) * k;
    c.position.y += (B.from.y - c.position.y) * k;
    c.position.z += (B.from.z - c.position.z) * k;
    c.rotation.x += (B.from.pitch - c.rotation.x) * k;
    c.rotation.y += wrap(B.from.yaw - c.rotation.y) * k;
  }
}

import * as THREE from 'three';
import { LAYER, allocVmId } from '../render/layers.js';
import { MUZZLE, RELOAD, VM_FOV } from './Viewmodel.js';
import { HAND_CLIPS } from './handClips.js';
import { HAND_POSES, mirror } from './handPoses.js';
import { HandRig, FINGERS } from './HandRig.js';

// The hands (docs/story/CONTRACTS.md §7.2; lane 2 brief): the detective's
// one pair of inked hands and sleeves, drawn by the viewmodel camera as the
// Tommy gun always was. game.player.hands.
//   hands.equip(set, opts)   'tommy' | 'revolver' | 'fists' | 'smoke' | 'empty' | 'wheel'
//   hands.set                the set in hand
//   hands.hold(prop | null, 'L' | 'R') -> the prop let go (or null)
//   hands.play(clip, { onMark: { mark: fn } }) -> handle { name, t, duration, done, stop() }
//   hands.clip(name) -> { duration, marks }       (player/handClips.js)
//   hands.busy               a clip that blocks input is running
//   hands.anchor(name, out?) -> world Vector3: 'muzzle', 'cigTip', 'mouth',
//                            'palmL', 'palmR', 'glass', 'eye', 'pack', 'lighter'
//   hands.pose(name | null)  a still: a pose of handPoses.js ('tommyL'), a
//                            pair ('study': studyR + studyL) or a clip's
//                            moment ('lightUp@2.0')
//
// One rig (player/HandRig.js) per arm, two skins on it: 'bare' indoors,
// 'glove' with the guns. Every step: the clip's keys (handClips.js) are
// evaluated into a pose per hand (handPoses.js: a wrist place and turn in a
// frame + joint angles), blended from where the hand was when the clip
// began, laid on the rig; a held prop rides its socket on the hand.
//
// Sets: 'tommy' is the gun, gloves and coat sleeves (the gun's grips, the
// reload's drum swap: tommyPose); 'smoke' the diner (bare hands, coat
// sleeves with the shirt cuff, resting on the counter); 'fists' the brawl
// (bare, sleeves pushed up, the guard); 'empty' hands out of sight until a
// clip or a held prop brings one up; 'revolver' and 'wheel' are wave B (no
// hands yet). The gun sets see through VM_FOV; the others through the
// eye's own lens (Viewmodel.setFov), so what a hand touches in the world is
// where it touches it.
const SETS = {
  tommy: { skin: 'glove', sleeve: 'coat', gun: true, R: 'tommyR', L: 'tommyL' },
  revolver: { hidden: true, gun: true },
  wheel: { hidden: true },
  smoke: { skin: 'bare', sleeve: 'coat', cuff: true, R: 'restR', L: 'restL', brush: 'R' },
  fists: { skin: 'bare', sleeve: 'pushed', R: 'guardR', L: 'guardL', brush: 'R' },
  empty: { skin: 'bare', sleeve: 'coat', cuff: true, R: 'downR', L: 'downL', hideAtRest: true },
};
export const HAND_SETS = ['tommy', 'revolver', 'fists', 'smoke', 'empty', 'wheel'];
const POINTS = { mouth: new THREE.Vector3(0.0, -0.075, -0.06), eye: new THREE.Vector3(0, 0, 0) };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const MX = new THREE.Matrix4().makeScale(-1, 1, 1);

// Where a held prop sits in the hand (hand-bone frame, a right hand; the
// left takes the mirror): the prop's grip point at `p`, its axes turned by
// `r` (Euler XYZ). kind -> socket; `bone` names a finger bone to ride on.
const SOCKETS = {
  // between the first two fingers, the filter on the palm side, the tip out
  // of the back of the hand
  cigarette: { bone: 'i0', p: [0.0105, 0.0005, -0.021], r: [0, 0, 0] },
  // wrapped in the palm, the glass upright when the thumb is up
  tumbler: { bone: 'hand', p: [0.004, -0.056, -0.05], r: [0, 0, Math.PI / 2] },
  glass: { bone: 'hand', p: [0.004, -0.056, -0.05], r: [0, 0, Math.PI / 2] },
  lighter: { bone: 'hand', p: [-0.006, -0.03, -0.062], r: [0, 0, Math.PI / 2] },
  cigarettePack: { bone: 'hand', p: [0.0, -0.03, -0.058], r: [Math.PI / 2, 0, 0] },
  wallet: { bone: 'hand', p: [0.0, -0.028, -0.07], r: [Math.PI / 2, 0, 0] },
  matchbook: { bone: 'i1', p: [0.0, -0.012, -0.012], r: [0, 0, 0] },
  bottle: { bone: 'hand', p: [0.004, -0.04, -0.05], r: [0, 0, Math.PI / 2] },
  plate: { bone: 'hand', p: [0.0, -0.02, -0.07], r: [0, 0, 0] },
  stool: { bone: 'hand', p: [0.0, -0.035, -0.05], r: [0, 0, Math.PI / 2] },
  default: { bone: 'hand', p: [0.0, -0.035, -0.055], r: [0, 0, Math.PI / 2] },
};

export class Hands {
  constructor(game, vm) {
    this.game = game;
    this.vm = vm;
    this.set = 'tommy';
    this.opts = {};
    this.held = { L: null, R: null };
    this.clips = [];        // running handles
    this.still = null;      // hands.pose(): { R, L } pose defs
    this._m = new THREE.Matrix4();
    const M = vm.world.M;
    // Matte, like the gun: the shape comes from the lamps' diffuse light, the
    // ink's contours and rim. The marks (knuckle ticks, nails) are the
    // vertex colours (HandRig).
    const std = (color, rough = 0.9) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, envMap: M.envSoft, envMapIntensity: 0, vertexColors: true });
    this.mats = {
      bare: std(0x8e8e8e, 0.82),
      glove: std(0x222222, 0.9),
      sleeve: vm.mats.sleeve,
      cuff: new THREE.MeshStandardMaterial({ color: 0xdcdcdc, roughness: 0.9, metalness: 0, envMap: M.envSoft, envMapIntensity: 0 }),
    };
    // ink ids (CONTRACTS §9.4, allocVmId): each hand's skin, each sleeve, the cuffs
    const id0 = allocVmId(5);
    this.ids = { skinR: id0, skinL: id0 + 1, sleeveR: id0 + 2, sleeveL: id0 + 3, cuff: id0 + 4 };
    this.rig = {
      R: new HandRig('R', this.mats, { skin: this.ids.skinR, sleeve: this.ids.sleeveR, cuff: this.ids.cuff }, LAYER.VIEWMODEL),
      L: new HandRig('L', this.mats, { skin: this.ids.skinL, sleeve: this.ids.sleeveL, cuff: this.ids.cuff }, LAYER.VIEWMODEL),
    };
    vm.root.add(this.rig.R.root, this.rig.L.root);
    // the evaluated pose per hand (arm-root space): { p, q, F, e } and the
    // snapshot a new clip blends from
    const mk = () => ({ p: V(0, 0, 0), q: new THREE.Quaternion(), F: null, e: V(0, 0, 0), vis: true });
    this.now = { R: mk(), L: mk() };
    this.from = { R: null, L: null };
    this.blendT = 1; this.blendDur = 0.12;
    this._a = { R: mk(), L: mk() }; this._b = { R: mk(), L: mk() };
    this._frames = { cam: new THREE.Matrix4(), body: new THREE.Matrix4(), gun: null, drum: new THREE.Matrix4() };
    this._v = V(0, 0, 0); this._f = V(0, 0, 0); this._bk = V(0, 0, 0); this._x = V(0, 0, 0); this._z = V(0, 0, 0); this._y = V(0, 0, 0);
    this._q = new THREE.Quaternion(); this._q2 = new THREE.Quaternion(); this._mb = new THREE.Matrix4();
    this._eyeQ = new THREE.Quaternion(); this._eyeP = V(0, 0, 0); this._s = V(1, 1, 1);
    this.bodyYaw = null;    // the study's body heading (else the controller's)
    this.poses = HAND_POSES;   // (look development: __noir.game.player.hands.poses)
    this.equip('tommy');
  }

  // ---- sets ---------------------------------------------------------------------------
  equip(set, opts = {}) {
    if (!HAND_SETS.includes(set)) throw new Error(`hands.equip: no set '${set}' (sets: ${HAND_SETS.join(', ')})`);
    const prev = this.set;
    this.set = set;
    this.opts = opts;
    const S = SETS[set];
    // the gun is the Tommy gun set's
    this.vm.gun.visible = set === 'tommy';
    if (set !== 'tommy') { this.game.weapon.trigger = false; }
    for (const h of ['R', 'L']) {
      const r = this.rig[h];
      if (S.skin) r.setSkin(opts.skin || S.skin);
      r.cuffOn = !!S.cuff;
      if (S.sleeve) r.setSleeve(opts.sleeve || S.sleeve, true);
    }
    // a set change is not a clip: the hands go straight to the new rest
    if (prev !== set) { this.from.R = this.from.L = null; this.blendT = 1; }
    this.update(0);
    return this;
  }

  // ---- held props -----------------------------------------------------------------------
  hold(prop, hand = 'R') {
    const prev = this.held[hand];
    if (prev) {
      this.vm.root.remove(prev);
      prev.matrixAutoUpdate = true;
      prev.traverse((o) => {
        if (!o.isMesh || !o.userData._handSave) return;
        const S = o.userData._handSave;
        o.layers.mask = S.mask; o.userData.inkId = S.id; o.userData.inkFigure = S.fig; o.castShadow = S.cast; o.frustumCulled = S.cull;
        delete o.userData._handSave;
      });
      // (let go: it keeps where the hand had it, as a world object again)
      prev.matrix.decompose(prev.position, prev.quaternion, prev.scale);
      this.held[hand] = null;
    }
    if (!prop) return prev;
    if (prop.parent) prop.parent.remove(prop);
    const id = allocVmId();
    prop.traverse((o) => {
      if (!o.isMesh) return;
      o.userData._handSave = { mask: o.layers.mask, id: o.userData.inkId, fig: !!o.userData.inkFigure, cast: o.castShadow, cull: o.frustumCulled };
      o.layers.set(LAYER.VIEWMODEL);
      o.userData.inkId = id;
      o.userData.inkFigure = true;    // (viewmodel ids are written as figures)
      o.castShadow = false;
      o.frustumCulled = false;
    });
    prop.matrixAutoUpdate = false;
    prop.scale.setScalar(1);
    this.vm.root.add(prop);
    this.held[hand] = prop;
    this.placeHeld();
    return prev;
  }

  // ---- clips -----------------------------------------------------------------------------
  clip(name) {
    const c = HAND_CLIPS[name];
    if (!c) throw new Error(`hands: no clip '${name}'`);
    return { duration: c.duration, marks: { ...c.marks } };
  }

  play(name, { onMark = null } = {}) {
    const c = HAND_CLIPS[name];
    if (!c) throw new Error(`hands: no clip '${name}'`);
    // (one clip at a time: a new one ends the last, the hands blend on from
    // where they are)
    for (const h of this.clips) h.done = true;
    const h = {
      name, t: 0, duration: c.duration, marks: c.marks, hold: !!c.hold, blocking: c.blocking !== false,
      onMark: onMark || {}, fired: new Set(), done: false, stop: () => { h.done = true; },
    };
    this.clips = [h];
    this.snapshot(c.blend ?? 0.12);
    if (name === 'tommyReload') this.game.weapon.reload();
    return h;
  }

  get busy() { return this.clips.some((h) => !h.done && h.blocking && h.t < h.duration); }
  get current() { const h = this.clips[0]; return h && !h.done ? h.name : null; }

  // a still (handstudy, look development): a pose name, a pair or 'clip@t'
  pose(name = null) {
    if (!name) { this.still = null; return; }
    const at = name.indexOf('@');
    // (the reload is the gun's clock: a still of it freezes the gun there)
    if (name.startsWith('tommyReload@')) { this.vm.reloadFreeze = parseFloat(name.slice(at + 1)) || 0; this.vm.reloadT = this.vm.reloadFreeze; this.still = null; this.update(0); return; }
    if (at > 0) { this.still = { clip: name.slice(0, at), t: parseFloat(name.slice(at + 1)) || 0 }; this.update(0); return; }
    const P = HAND_POSES;
    const R = P[name + 'R'] || (name.endsWith('R') && P[name]) || null;
    const L = P[name + 'L'] || (name.endsWith('L') && P[name]) || null;
    if (!R && !L) throw new Error(`hands.pose: no pose '${name}'`);
    this.still = { R, L };
    this.update(0);
  }

  // where the hand was when the clip began: the new clip blends from it
  snapshot(dur) {
    for (const h of ['R', 'L']) {
      const n = this.now[h];
      if (!n.F) { this.from[h] = null; continue; }
      this.from[h] = { p: n.p.clone(), q: n.q.clone(), F: cloneF(n.F), e: n.e.clone(), vis: n.vis };
    }
    this.blendT = 0; this.blendDur = dur;
  }

  // ---- anchors -------------------------------------------------------------------------------
  anchor(name, out = new THREE.Vector3()) {
    const cam = this.game.camera;
    if (name === 'muzzle') return this.vm.reproject(MUZZLE, 0.9, cam, out);
    this.vm.root.updateMatrixWorld(true);
    if (name === 'cigTip') {
      const c = this.held.R && this.held.R.userData.kind === 'cigarette' ? this.held.R : this.held.L && this.held.L.userData.kind === 'cigarette' ? this.held.L : null;
      if (c) return this.toWorld(out.set(0, (c.userData.size ? c.userData.size.y : 0.08), 0).applyMatrix4(c.matrixWorld));
      return this.toWorld(out.set(0.02, -0.09, -0.28).applyMatrix4(this.vm.root.matrixWorld));
    }
    if (name === 'glass') {
      const g = this.held.L || this.held.R;
      if (g) return this.toWorld(out.set(0, 0.06, 0).applyMatrix4(g.matrixWorld));
      return this.toWorld(out.set(0, -0.16, -0.36).applyMatrix4(this.vm.root.matrixWorld));
    }
    if (name === 'palmR' || name === 'palmL') {
      const r = this.rig[name[4]];
      return this.toWorld(out.set(0, -0.016, -0.05).applyMatrix4(r.hand.matrixWorld));
    }
    // where the hands expect the pack and the lighter on the counter (lane 7
    // / lane 5 may place them there): the body frame of the seated eye
    if (name === 'pack' || name === 'lighter') {
      const p = name === 'pack' ? PACK_AT : LIGHTER_AT;
      this.frames();
      return out.set(...p).applyMatrix4(this._frames.body).applyMatrix4(this.vm.root.matrixWorld);
    }
    const p = POINTS[name];
    if (!p) throw new Error(`hands.anchor: no point '${name}'`);
    cam.updateMatrixWorld();
    return out.copy(p).applyMatrix4(cam.matrixWorld);
  }

  // a point in the hands' scene -> the world point seen at the same place
  // (the gun sets draw through VM_FOV: reprojected at the point's depth)
  toWorld(p) {
    if (Math.abs(this.vm.cam.fov - this.game.camera.fov) < 1e-6 && !this.vm.study) return p;
    const cam = this.game.camera;
    const v = p.clone().applyMatrix4(this._m.copy(this.vm.root.matrixWorld).invert());
    const tv = Math.tan(THREE.MathUtils.degToRad(this.vm.cam.fov) / 2), tm = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
    const k = tv / tm;
    return p.set(v.x * k, v.y * k, v.z).applyMatrix4(cam.matrixWorld);
  }

  // ---- per fixed step (Game.pre, after the gun's update) --------------------------------------
  update(dt) {
    for (const h of this.clips) {
      if (h.done) continue;
      const t0 = h.t;
      h.t = Math.min(h.duration, h.t + dt);
      for (const [m, at] of Object.entries(h.marks)) {
        if (h.fired.has(m)) continue;
        if (at <= h.t + 1e-6 && (at > t0 || t0 === 0)) { h.fired.add(m); if (h.onMark[m]) h.onMark[m](m); }
      }
      if (h.t >= h.duration && !h.hold) h.done = true;
    }
    if (dt > 0) this.blendT += dt;
    this.pose3();
  }

  // the frames a pose may be written in, as matrices into the arm root's
  // parent (the eye): 'cam' identity, 'body' (the eye's place, the body's
  // heading, no pitch), 'gun' (the Tommy gun's pose)
  frames() {
    const F = this._frames, vm = this.vm;
    vm.root.matrix.decompose(this._eyeP, this._eyeQ, this._s);
    const C = this.game.controller;
    const yaw = this.bodyYaw ?? (C && C.bodyYaw != null ? C.bodyYaw : (C ? C.yaw : 0));
    this._q.setFromAxisAngle(this._y.set(0, 1, 0), yaw);
    this._q2.copy(this._eyeQ).invert().multiply(this._q);
    F.body.makeRotationFromQuaternion(this._q2);
    F.gun = vm.gun.matrix;
    vm.drumG.updateMatrix();
    F.drum.multiplyMatrices(vm.gun.matrix, vm.drumG.matrix);
    return F;
  }

  // lay the current poses on the rigs (and the held props on the hands)
  pose3() {
    const S = SETS[this.set];
    const F = this.frames();
    const vis = !S.hidden && this.vm.visible !== false;
    let clip = this.clips[0] && !this.clips[0].done ? this.clips[0] : (this.clips[0] && this.clips[0].hold ? this.clips[0] : null);
    let ct = clip ? clip.t : 0;
    let cdef = clip ? HAND_CLIPS[clip.name] : null;
    if (this.still && this.still.clip) { cdef = HAND_CLIPS[this.still.clip]; ct = this.still.t; clip = { name: this.still.clip }; }
    for (const h of ['R', 'L']) {
      const out = this._a[h];
      let ok = false;
      if (this.set === 'tommy') ok = this.tommyPose(h, out);
      else if (this.still && this.still[h]) ok = this.resolve(this.still[h], h, out);
      else if (cdef && cdef.keys && cdef.keys[h]) ok = this.evalKeys(cdef.keys[h], ct, h, out);
      if (!ok) {
        const rest = S[h] ? HAND_POSES[S[h]] : null;
        if (rest) { this.resolve(rest, h, out); ok = true; out.vis = !S.hideAtRest || !!this.held[h]; }
      }
      // (the blend from where the hand was when the clip began)
      const n = this.now[h];
      const fr = this.from[h];
      if (fr && this.blendT < this.blendDur) {
        const k = sstep(0, 1, this.blendT / this.blendDur);
        n.p.lerpVectors(fr.p, out.p, k); n.q.slerpQuaternions(fr.q, out.q, k); n.e.lerpVectors(fr.e, out.e, k);
        n.F = lerpF(fr.F, out.F, k, n.F); n.vis = out.vis || fr.vis;
      } else {
        n.p.copy(out.p); n.q.copy(out.q); n.e.copy(out.e); n.F = copyF(out.F, n.F); n.vis = out.vis;
      }
      const rig = this.rig[h];
      rig.visible = vis && ok && n.vis;
      if (rig.visible) rig.apply(n.p, n.q, n.F, n.e);
    }
    this.placeHeld();
    // the brush field rides on the hand that moves (the gun sets: the gun)
    const vm = this.vm;
    vm.setFov(S.gun && !this.studyFov ? VM_FOV : this.game.camera.fov);
    if (!S.gun) {
      const b = this.rig[(cdef && cdef.brush) || S.brush || 'R'];
      b.root.updateMatrixWorld(true);
      this._m.copy(vm.root.matrixWorld).invert().multiply(b.hand.matrixWorld);
      vm.frameInv.copy(this._m).invert();
    }
  }

  // one hand's pose def -> the arm root's space: { p, q, F, e, vis }
  resolve(P, side, out) {
    if (typeof P === 'string') P = HAND_POSES[P];
    if (!P) return false;
    const F = this._frames;
    const M = P.frame === 'gun' ? F.gun : P.frame === 'drum' ? F.drum : P.frame === 'body' ? F.body : F.cam;
    out.p.set(...P.p).applyMatrix4(M);
    const f = this._f.set(...P.f).transformDirection(M), b = this._bk.set(...P.b).transformDirection(M);
    if (P.e) {
      out.e.set(...P.e);
      if (P.frame !== 'gun' && P.frame !== 'drum') out.e.applyMatrix4(M);
    } else out.e.set(side === 'R' ? 0.24 : -0.24, -0.42, 0.05);
    if (side === 'L') { out.p.x = -out.p.x; out.e.x = -out.e.x; f.x = -f.x; b.x = -b.x; }
    const z = this._z.copy(f).normalize().negate();
    const y = this._y.copy(b).addScaledVector(z, -b.dot(z)).normalize();
    const x = this._x.crossVectors(y, z);
    out.q.setFromRotationMatrix(this._mb.makeBasis(x, y, z));
    out.F = copyF(P.F, out.F);
    out.vis = true;
    return true;
  }

  // a hand's keys at time t: [[t, pose, ease?], ...]; pose: a name, '@rest'
  // (the set's rest), or a def
  evalKeys(keys, t, side, out) {
    let i = 0;
    while (i < keys.length - 1 && keys[i + 1][0] <= t) i++;
    const k0 = keys[i], k1 = keys[Math.min(keys.length - 1, i + 1)];
    const get = (k, o) => {
      let P = k[1];
      if (P === '@rest') { const S = SETS[this.set]; P = S[side] ? HAND_POSES[S[side]] : null; }
      if (typeof P === 'string') P = HAND_POSES[P];
      if (typeof P === 'function') P = P(this);
      if (!P) return false;
      return this.resolve(P, side, o);
    };
    if (!get(k0, out)) return false;
    if (k1 === k0 || t <= k0[0]) return true;
    const B = this._b[side];
    if (!get(k1, B)) return true;
    let u = Math.min(1, Math.max(0, (t - k0[0]) / Math.max(1e-6, k1[0] - k0[0])));
    const ease = k1[2] || 'io';
    u = ease === 'lin' ? u : ease === 'in' ? u * u : ease === 'out' ? 1 - (1 - u) * (1 - u) : ease === 'snap' ? 1 - Math.pow(1 - u, 3) : u * u * (3 - 2 * u);
    out.p.lerp(B.p, u); out.q.slerp(B.q, u); out.e.lerp(B.e, u);
    out.F = lerpF(out.F, B.F, u, out.F);
    return true;
  }

  // ---- the Tommy gun: both hands on its grips; the reload's drum swap ------------------------
  // (fix 3: the left hand grips the foregrip from its left side, fingers
  // round the front; fix 2: the drum falls out of the frame, the hand brings
  // a fresh one up)
  tommyPose(side, out) {
    const P = HAND_POSES;
    const still = this.still && this.still[side];
    if (still) return this.resolve(still, side, out);
    if (side === 'R' || !this.vm.reloading) {
      return this.resolve(side === 'R' ? P.tommyR : P.tommyL, side, out);
    }
    const t = this.vm.reloadT, RL = RELOAD;
    const seq = [
      [0, P.tommyL], [0.23, P.tommyL], [RL.latch, P.tommyLatchL], [RL.out1, P.tommyLatchL],
      [RL.out1 + 0.3, P.tommyDropL, 'in'], [RL.rise0 - 0.08, P.tommyDropL], [RL.rise0 + 0.05, P.tommyRimL, 'out'], [RL.line, P.tommyRimL],
      [RL.seat0, P.tommyPushL0], [RL.seat, P.tommyPushL, 'snap'], [RL.seat + 0.1, P.tommyPushL],
      [RL.bolt0 - 0.02, P.tommyBoltL], [RL.boltBack, P.tommyBoltBackL, 'snap'], [RL.boltHome, P.tommyBoltL, 'snap'],
      [RL.grip1, P.tommyL],
    ];
    return this.evalKeys(seq, t, 'L', out);
  }

  // held props ride their sockets on the hands
  placeHeld() {
    for (const h of ['R', 'L']) {
      const prop = this.held[h];
      if (!prop) continue;
      const rig = this.rig[h];
      const S = SOCKETS[prop.userData.kind] || SOCKETS.default;
      const bone = S.bone === 'hand' ? rig.hand : (S.bone[0] === 't' ? rig.thumb.b[+S.bone[1]] : rig.fingers[S.bone[0]].b[+S.bone[1]]);
      rig.root.updateMatrixWorld(true);
      const sock = S._m || (S._m = new THREE.Matrix4().compose(V(...S.p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...S.r)), V(1, 1, 1)));
      const g = prop.userData.grip;
      const m = this._m.copy(this.vm.root.matrixWorld).invert().multiply(bone.matrixWorld).multiply(sock);
      if (h === 'L') m.multiply(MX);
      if (g) m.multiply(this._mb.copy(g).invert());
      prop.matrix.copy(m);
      prop.matrixWorldNeedsUpdate = true;
      prop.visible = rig.visible;
    }
  }
}

// where the smoke set's hands find the pack and the lighter (body frame)
export const PACK_AT = [0.14, -0.4, -0.44];
export const LIGHTER_AT = [0.26, -0.4, -0.42];

function cloneF(F) { const o = {}; for (const k of [...FINGERS, 't']) o[k] = F[k] ? F[k].slice() : null; return o; }
function copyF(src, dst) {
  dst = dst || {};
  for (const k of [...FINGERS, 't']) {
    const s = src ? src[k] : null;
    if (!s) { dst[k] = null; continue; }
    const d = dst[k] && dst[k].length === s.length ? dst[k] : (dst[k] = new Array(s.length));
    for (let i = 0; i < s.length; i++) d[i] = s[i];
  }
  return dst;
}
function lerpF(a, b, k, dst) {
  dst = dst || {};
  for (const key of [...FINGERS, 't']) {
    const x = a ? a[key] : null, y = b ? b[key] : null;
    const n = key === 't' ? 5 : 4;
    const d = dst[key] && dst[key].length === n ? dst[key] : (dst[key] = new Array(n).fill(0));
    for (let i = 0; i < n; i++) d[i] = (x ? x[i] || 0 : 0) * (1 - k) + (y ? y[i] || 0 : 0) * k;
  }
  return dst;
}
export { mirror };

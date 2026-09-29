import * as THREE from 'three';
import { LAYER, allocVmId } from '../render/layers.js';
import { MUZZLE } from './Viewmodel.js';
import { HAND_CLIPS } from './handClips.js';

// The hands (docs/story/CONTRACTS.md §7.2): the detective's one pair of
// inked hands and sleeves, drawn by the viewmodel camera as the Tommy gun
// always was. game.player.hands.
//   hands.equip(set, opts)   'tommy' | 'revolver' | 'fists' | 'smoke' | 'empty' | 'wheel'
//   hands.set                the set in hand
//   hands.hold(prop | null, 'L' | 'R') -> the prop let go (or null)
//   hands.play(clip, { onMark: { mark: fn } }) -> handle { name, t, duration, done, stop() }
//   hands.clip(name) -> { duration, marks }       (player/handClips.js)
//   hands.busy               a clip that blocks input is running
//   hands.anchor(name, out?) -> world Vector3: 'muzzle', 'cigTip', 'mouth',
//                            'palmL', 'palmR', 'glass', 'eye'
//   hands.pose(name)         a still (lane 2)
//
// FOUNDATION STUB (lane 2 owns src/player/**): 'tommy' is today's gun and
// gloves, untouched (player/Viewmodel.js: the golden frames prove it); the
// other sets show no hands yet. A held prop is drawn in the hands' own
// scene at the palm (its meshes move to the viewmodel layer and take a
// viewmodel ink id while held, and get their own back when let go). A clip
// runs its clock and fires its marks on time; nothing moves yet.
const PALM = { R: new THREE.Vector3(0.15, -0.2, -0.42), L: new THREE.Vector3(-0.15, -0.2, -0.42) };
const POINTS = {
  cigTip: new THREE.Vector3(0.0, -0.1, -0.3), mouth: new THREE.Vector3(0.0, -0.08, -0.06), palmR: PALM.R, palmL: PALM.L,
  glass: new THREE.Vector3(0.0, -0.16, -0.36), eye: new THREE.Vector3(0, 0, 0),
};
export const HAND_SETS = ['tommy', 'revolver', 'fists', 'smoke', 'empty', 'wheel'];

export class Hands {
  constructor(game, vm) {
    this.game = game;
    this.vm = vm;
    this.set = 'tommy';
    this.opts = {};
    this.held = { L: null, R: null };
    this.clips = [];        // running handles
    this._m = new THREE.Matrix4();
  }

  equip(set, opts = {}) {
    if (!HAND_SETS.includes(set)) throw new Error(`hands.equip: no set '${set}' (sets: ${HAND_SETS.join(', ')})`);
    this.set = set;
    this.opts = opts;
    // the gun, the gloves and the sleeves are the Tommy gun's group
    this.vm.gun.visible = set === 'tommy';
    if (set !== 'tommy') { this.game.weapon.trigger = false; }
    return this;
  }

  hold(prop, hand = 'R') {
    const prev = this.held[hand];
    if (prev) {
      this.vm.root.remove(prev);
      prev.traverse((o) => {
        if (!o.isMesh || !o.userData._handSave) return;
        const S = o.userData._handSave;
        o.layers.mask = S.mask; o.userData.inkId = S.id; o.userData.inkFigure = S.fig; o.castShadow = S.cast; o.frustumCulled = S.cull;
        delete o.userData._handSave;
      });
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
    // the prop's grip on the palm, upright in the camera's frame
    const g = prop.userData.grip;
    prop.position.copy(PALM[hand]);
    if (g) prop.position.sub(new THREE.Vector3().setFromMatrixPosition(g));
    prop.quaternion.identity();
    prop.scale.setScalar(1);
    this.vm.root.add(prop);
    this.held[hand] = prop;
    return prev;
  }

  clip(name) {
    const c = HAND_CLIPS[name];
    if (!c) throw new Error(`hands: no clip '${name}'`);
    return { duration: c.duration, marks: { ...c.marks } };
  }

  play(name, { onMark = null } = {}) {
    const c = HAND_CLIPS[name];
    if (!c) throw new Error(`hands: no clip '${name}'`);
    // (one clip at a time: a new one ends the last)
    for (const h of this.clips) h.done = true;
    const h = {
      name, t: 0, duration: c.duration, marks: c.marks, hold: !!c.hold, blocking: c.blocking !== false,
      onMark: onMark || {}, fired: new Set(), done: false, stop: () => { h.done = true; },
    };
    this.clips = [h];
    if (name === 'tommyReload') this.game.weapon.reload();
    return h;
  }

  get busy() { return this.clips.some((h) => !h.done && h.blocking && h.t < h.duration); }
  get current() { const h = this.clips[0]; return h && !h.done ? h.name : null; }

  pose() {}

  anchor(name, out = new THREE.Vector3()) {
    const cam = this.game.camera;
    if (name === 'muzzle') return this.vm.reproject(MUZZLE, 0.9, cam, out);
    const p = POINTS[name];
    if (!p) throw new Error(`hands.anchor: no point '${name}'`);
    cam.updateMatrixWorld();
    return out.copy(p).applyMatrix4(cam.matrixWorld);
  }

  // per fixed step (Game.pre): the clips' clocks and marks
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
  }
}

import * as THREE from 'three';
import { LAYER, allocVmId } from '../render/layers.js';
import { buildProp } from '../props/index.js';

// Inspect (docs/story/CONTRACTS.md §4.2): an object held up in the hands and
// turned.
//   inspect.open({ prop: 'matchbook' | Object3D, options?, caption?: string,
//                  onDone(ctx) {} })     inspect.active    inspect.close()
// The prop is drawn in the hands' scene (inked like the gun, its brush in
// the viewmodel's frame), the mouse turns it, the wheel brings it closer,
// E puts it away (Esc gives the mouse back to the page, the pause card).
// options: { dist: 0.32, scale: 3 (a matchbook is small: shown larger),
//            spin: [x, y] (rad, the starting turn) }
// (FOUNDATION: working; lane 7 owns the logic, lane 2 poses the hands)
export class Inspect {
  constructor(game) {
    this.game = game;
    this.active = null;
  }

  open({ prop, options = {}, caption = null, onDone = null } = {}) {
    const G = this.game;
    if (this.active) this.close(false);
    const obj = typeof prop === 'string' ? buildProp(prop) : prop;
    const saved = [];
    const id = allocVmId();
    obj.traverse((o) => {
      if (!o.isMesh) return;
      saved.push([o, o.layers.mask, o.userData.inkId, !!o.userData.inkFigure, o.frustumCulled]);
      o.layers.set(LAYER.VIEWMODEL);
      o.userData.inkId = id;
      o.userData.inkFigure = true;
      o.frustumCulled = false;
    });
    const parent = obj.parent;
    if (parent) parent.remove(obj);
    // a pivot at the eye's centre line: the prop turns about its own middle
    const pivot = new THREE.Group();
    const size = obj.userData.size || new THREE.Vector3(0.1, 0.1, 0.1);
    const k = options.scale ?? Math.min(4, 0.09 / Math.max(size.x, size.y, size.z, 0.01));
    obj.position.set(0, -size.y / 2 * k, 0);
    obj.scale.setScalar(k);
    pivot.add(obj);
    pivot.position.set(0, -0.03, -(options.dist ?? 0.32));
    const [sx, sy] = options.spin || [0.5, 0.3];
    pivot.rotation.set(sx, sy, 0);
    G.vm.root.add(pivot);
    this.active = { obj, pivot, parent, saved, onDone, caption, dist: options.dist ?? 0.32, t: 0 };
    // (the mouse turns the prop, not the view)
    G.controller.lookLocked = true;
    if (caption) G.hud.say(caption, 3);
    G.hud.prompt('E  put away', null, 'inspect');
    return this.active;
  }

  // put it away: the prop goes back where it was (or nowhere)
  close(done = true) {
    const A = this.active;
    if (!A) return;
    const G = this.game;
    A.pivot.remove(A.obj);
    G.vm.root.remove(A.pivot);
    for (const [o, mask, id, fig, cull] of A.saved) { o.layers.mask = mask; o.userData.inkId = id; o.userData.inkFigure = fig; o.frustumCulled = cull; }
    A.obj.position.set(0, 0, 0); A.obj.scale.setScalar(1);
    if (A.parent) A.parent.add(A.obj);
    this.active = null;
    G.controller.lookLocked = false;
    G.hud.clearPrompt('inspect');
    if (done && A.onDone) A.onDone(G.scenes.ctx || { game: G });
  }

  // per fixed step (Game.post): the mouse turns it, the wheel brings it in
  update(dt) {
    const A = this.active;
    if (!A) return;
    const G = this.game, m = G.mouse;
    A.t += dt;
    A.pivot.rotation.y += m.dx * 0.006;
    A.pivot.rotation.x += m.dy * 0.006;
    A.dist = Math.max(0.18, Math.min(0.5, A.dist + m.wheel * 0.0004));
    A.pivot.position.z = -A.dist;
    if (A.t > 0.2 && G.pressed('KeyE')) this.close(true);
  }
}

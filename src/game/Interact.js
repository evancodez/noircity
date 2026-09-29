import * as THREE from 'three';
import { keyLabel } from './script.js';

// Interaction (docs/story/CONTRACTS.md §4.1): the things the player can
// use, one prompt at a time.
//   interact.add({ id, at: Object3D | Vector3 | () => Vector3, range: 1.6,
//                  cone: 0.5 (rad), prompt: 'light up', key: 'KeyE', hold: 0 (s),
//                  when: () => true, onUse(ctx) {}, scope: 'scene' }) -> handle
//   interact.remove(id | handle)    interact.clear(scope)    interact.current
// The candidate is the one nearest the centre of the view within its range
// and cone (generous cones: never a pixel hunt); the HUD prints `E  light up`
// low in the frame with a tick at the thing. A scene's own prompt
// (ctx.prompt) takes the line while it waits. A scene's handles are
// cleared when it ends (scope 'scene', the default).
// (FOUNDATION: working; lane 7 owns it: the tick's look, hold-to-use)
const _p = new THREE.Vector3(), _f = new THREE.Vector3();

export class Interact {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.current = null;
    this.heldT = 0;
  }

  add(spec) {
    const h = { range: 1.6, cone: 0.5, key: 'KeyE', hold: 0, when: null, scope: 'scene', ...spec };
    if (!h.id) h.id = 'i' + (this.list.length + 1) + '_' + (h.prompt || '');
    this.remove(h.id);
    this.list.push(h);
    return h;
  }

  remove(x) {
    const i = this.list.findIndex((h) => h === x || h.id === x);
    if (i >= 0) { if (this.list[i] === this.current) this.drop(); this.list.splice(i, 1); }
  }

  clear(scope = null) {
    for (const h of [...this.list]) if (!scope || h.scope === scope) this.remove(h);
  }

  where(h, out) {
    const a = typeof h.at === 'function' ? h.at() : h.at;
    if (!a) return null;
    if (a.isObject3D) return a.getWorldPosition(out);
    return out.copy(a);
  }

  drop() {
    if (this.current) this.game.hud.clearPrompt('interact');
    this.current = null;
    this.heldT = 0;
  }

  // per fixed step (Game.post)
  update(dt) {
    const G = this.game;
    if (!this.list.length || G.scenes.prompting || G.inspect.active || G.puzzles.active || G.state !== 'playing') { this.drop(); return; }
    const cam = G.camera;
    _f.set(0, 0, -1).transformDirection(cam.matrixWorld);
    let best = null, bs = Infinity;
    for (const h of this.list) {
      if (h.when && !h.when()) continue;
      if (!this.where(h, _p)) continue;
      _p.sub(cam.position);
      const d = _p.length();
      if (d > h.range || d < 1e-4) continue;
      const ang = Math.acos(Math.max(-1, Math.min(1, _p.dot(_f) / d)));
      if (ang > h.cone) continue;
      if (ang < bs) { bs = ang; best = h; }
    }
    if (best !== this.current) { this.drop(); this.current = best; }
    if (!best) return;
    G.hud.prompt(`${keyLabel(best.key)}  ${best.prompt || ''}`, G.screenOf(this.where(best, _p)), 'interact');
    const use = best.hold > 0 ? (G.controller.keys.has(best.key) ? (this.heldT += dt) >= best.hold : (this.heldT = 0, false)) : G.pressed(best.key);
    if (use) {
      this.heldT = 0;
      if (best.onUse) best.onUse(G.scenes.ctx || { game: G });
    }
  }
}

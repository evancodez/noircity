import * as THREE from 'three';
import { LAYER } from '../render/layers.js';
import { makeGlassMaterial } from '../render/glass.js';

// Glass (docs/story/CONTRACTS.md §8.3): every pane that a round, a body or
// a blast can break. One per stage (stage.glass, game.glass); a part
// registers its panes while it builds.
//   glass.addPane({ mesh | centre, normal, w, h, material?, thick: 0.006,
//                   lit: false, room?: Object3D, tag, parent? }) -> pane
//   glass.hit(pane, { point, dir, power, by, normal })   1st round: a crack
//       at the point; the next: it goes          -> 'glass' | 'done'
//   glass.shatter(pane, { dir, power })          all of it, now
//   glass.restore(pane)                          whole again (a retry)
//   pane.state: 'whole' | 'cracked' | 'holed' | 'gone'
//   pane.on('state', fn(pane, state))            game event 'glass:shatter' { pane }
//
// A pane given as { centre, normal, w, h } gets a plain faint plane (lane
// 1's makeGlassMaterial) drawn in the scene pass only (LAYER.FX: the ink
// still sees the room behind it) and an invisible twin on the world layer
// that the bullets hit (userData.pane; fx/React.js routes it here).
// A pane may instead be SHARED: a record of an owner that draws many panes
// in one merged mesh (the façade's windows, world/Facade.js): the owner
// finds the pane the round hit, the pane keeps the owner's fields (kind, c,
// w, h, shop, ...), and owner.paneGone(pane, from) redraws its mesh.
//
// FOUNDATION STUB (lane 3 owns src/destruct/**): the façade's crack /
// shatter behaviour of Phase 3a, moved here unchanged (same decals, same
// draws from the game's rng, same sounds): a first round cracks a window
// (a shop window goes at once), the second shatters it into falling
// shards and leaves a dark hole. No geometry-true cracks yet (lane 3).
export class Glass {
  constructor(stage) {
    this.stage = stage;
    this.panes = [];
    this._geo = null;
  }

  addPane(spec) {
    let pane;
    if (spec.shared) {
      // (the owner's own record becomes the pane: its fields stay where
      // the owner's code expects them)
      pane = spec;
      Object.assign(pane, { state: 'whole', broken: false, hits: pane.hits || 0, listeners: [] });
    } else {
      const normal = (spec.normal || new THREE.Vector3(1, 0, 0)).clone().normalize();
      const c = (spec.centre || spec.c || (spec.mesh && spec.mesh.getWorldPosition(new THREE.Vector3())) || new THREE.Vector3()).clone();
      pane = {
        tag: spec.tag || 'pane', c, normal, w: spec.w ?? 1, h: spec.h ?? 1, thick: spec.thick ?? 0.006, lit: !!spec.lit, room: spec.room || null,
        mesh: spec.mesh || null, proxy: null, state: 'whole', broken: false, hits: 0, listeners: [], kind: 'pane',
      };
      if (!pane.mesh) {
        const geo = new THREE.PlaneGeometry(pane.w, pane.h);
        const m = new THREE.Mesh(geo, spec.material || makeGlassMaterial({ wet: 1, side: 'out' }));
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
        m.position.copy(c);
        m.layers.set(LAYER.FX);
        m.renderOrder = 1;
        m.name = 'pane_' + pane.tag;
        (spec.parent || this.stage.scene).add(m);
        pane.mesh = m;
        // the bullets' target: an invisible twin on the world layer
        const px = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ visible: false }));
        px.visible = false;
        px.quaternion.copy(m.quaternion);
        px.position.copy(c);
        px.userData.pane = pane;
        px.userData.surf = 'glass';
        px.name = 'paneRay_' + pane.tag;
        (spec.parent || this.stage.scene).add(px);
        pane.proxy = px;
        // (a pane added once the stage stands joins the bullets' world now;
        // during the build the stage collects every mesh on its own)
        if (this.stage.rays) this.stage.addSolid(px);
      } else pane.mesh.userData.pane = pane;
    }
    pane.on = (ev, fn) => { if (ev === 'state') pane.listeners.push(fn); return pane; };
    this.panes.push(pane);
    return pane;
  }

  setState(pane, state) {
    if (pane.state === state) return;
    pane.state = state;
    for (const fn of pane.listeners) fn(pane, state);
  }

  get game() { return this.stage.game; }

  // a round hit the pane: the first cracks it, the second (or any round
  // into a crack) shatters it; a shop window goes at once
  hit(pane, { point, dir, normal = null, power = 1, by = 'bullet' } = {}) {
    const G = this.game;
    if (!G) return null;
    if (pane.broken) return 'done';      // through the hole, into the dark room
    pane.hits++;
    if (pane.hits === 1 && !pane.shop && power < 2) {
      G.fx.decals.crack(point, normal || pane.normal || new THREE.Vector3(1, 0, 0), 0.7, pane);
      G.sfx.glass(point, 0.35);
      this.setState(pane, 'cracked');
      return 'glass';
    }
    this.shatter(pane, { dir, power, by });
    return 'glass';
  }

  shatter(pane, { dir = new THREE.Vector3(-1, 0, 0), power = 1 } = {}) {
    const G = this.game, r = G.rng, F = G.fx;
    const w = pane;
    if (w.broken) return;
    w.broken = true;
    G.fx.decals.hideOwner(w);
    // a lit pane goes dark: its owner moves it into the dark glass mesh
    if (w.owner) {
      const from = w.kind;
      if (w.kind !== 'dark') { w.kind = 'dark'; w.owner.paneGone(w, from); }
      // the hole: black, jagged, glass teeth left round the frame
      F.decals.paneHole(w.c.clone().add(new THREE.Vector3(0.004, 0, 0)), new THREE.Vector3(1, 0, 0), w.w, w.h);
    } else {
      // a pane of its own: it goes, the room behind it opens
      if (w.mesh) w.mesh.visible = false;
      if (w.proxy) this.stage.removeSolid(w.proxy);
    }
    // shards: out and down onto the pavement
    const n = Math.round(10 + w.w * w.h * 6);
    const nx = w.owner ? 1 : w.normal.x, nz = w.owner ? 0 : w.normal.z;
    for (let k = 0; k < n; k++) {
      const s = r.range(0.04, 0.12);
      // (the draws in the façade's old order: the pane's centre, then the
      // throw - the game's rng runs the whole battle)
      const pos = w.c.clone().add(new THREE.Vector3(0.05 * nx, r.gauss() * w.h * 0.3, r.gauss() * w.w * 0.3));
      const out = r.range(0.4, 2.2) - dir.x * 0.3, up = r.range(-0.3, 1.2), side = r.gauss() * 0.8;
      F.debris.spawn({
        pos,
        vel: w.owner ? new THREE.Vector3(out, up, side) : new THREE.Vector3(out * nx + dir.x * power, up, side + out * nz),
        life: r.range(1.0, 2.0), size: [s, s * r.range(0.4, 0.8)], rot: r.next() * 6.28, spin: r.gauss() * 10,
        col: [0.32, 0.32, 0.32], cell: 12, gravity: 9.8, ground: 0.17, fadeOut: 0.12, lit: w.kind === 'dark' ? 1.5 : 3, litT: 0.12,
      });
    }
    G.sfx.glass(w.c, 1.2);
    G.counters.windows++;
    this.setState(w, 'gone');
    G.emit('glass:shatter', { pane: w });
  }

  // put a pane of its own back whole (a retry, a preset)
  restore(pane) {
    if (pane.owner || !pane.broken) { if (!pane.owner) { pane.hits = 0; this.setState(pane, 'whole'); } return; }
    pane.broken = false;
    pane.hits = 0;
    if (pane.mesh) pane.mesh.visible = true;
    if (pane.proxy && this.stage.rays) this.stage.addSolid(pane.proxy);
    const G = this.game;
    if (G) G.fx.decals.hideOwner(pane);
    this.setState(pane, 'whole');
  }

  update() {}
}

import * as THREE from 'three';
import { buildProp } from '../props/index.js';

// Puzzles (docs/story/CONTRACTS.md §4.3): played on a table, a real surface
// of the stage; the camera eases to look down on it; the pieces are real
// meshes, inked by the pipeline.
//   puzzles.define({ id, table: { anchor, size: [w, d], height }, build(ctx) -> state,
//                    input(state, pointer), update(state, dt), solved(state) -> bool,
//                    hint(state, level: 1..3) -> string, exit(state) })
//   puzzles.open(id, { onSolved(ctx) })    puzzles.active    puzzles.close()
// pointer: { x, z (metres on the table, from its centre: +x to the right
// as seen, +z away from the eye), down (LMB held), pressed (LMB this
// step), right (RMB held), wheel (this step), world: Vector3 }: a virtual
// cursor driven by the mouse under pointer lock, drawn by the HUD as a small
// ink cross. E leaves (progress kept: the state lives on). A hint after 40 s
// without progress (level 1 a nudge .. 3 nearly the answer): the state says
// what progress is by bumping state.progress.
// The demo (?scene=diner&beat=settle&puzzle=demo): slide the matchbook
// onto the ring on the counter.
// (FOUNDATION: working; lane 7 owns it)
const _w = new THREE.Vector3();

export class Puzzles {
  constructor(game) {
    this.game = game;
    this.defs = new Map();
    this.states = new Map();
    this.active = null;
    this.define(DEMO);
  }

  define(def) { this.defs.set(def.id, def); return def; }

  open(id, { onSolved = null } = {}) {
    const G = this.game, def = this.defs.get(id);
    if (!def) throw new Error(`puzzles.open: no puzzle '${id}'`);
    const S = G.stage;
    const a = typeof def.table.anchor === 'string' ? S.anchor(def.table.anchor) : def.table.anchor;
    if (!a) throw new Error(`puzzle ${id}: no table anchor '${def.table.anchor}'`);
    const ctx = G.scenes.ctx || { game: G, stage: S };
    let state = this.states.get(id);
    if (!state) { state = def.build(ctx, a) || {}; state.progress = state.progress || 0; this.states.set(id, state); }
    // the eye above the table, looking down on it from the player's side
    const yaw = a.yaw ?? 0, h = def.table.height ?? a.pos.y;
    const back = 0.18;
    const pose = { x: a.pos.x + Math.sin(yaw) * back, y: h + 0.55, z: a.pos.z + Math.cos(yaw) * back, yaw, pitch: -1.25 };
    this.active = { id, def, state, anchor: a, height: h, onSolved, prevMode: G.controller.mode, prevOpts: G.controller.modeOpts,
      prevPose: G.controller.eyePose(), pointer: { x: 0, z: 0, down: false, pressed: false, right: false, wheel: 0, world: new THREE.Vector3() }, idle: 0, lastProgress: state.progress, hinted: 0 };
    G.controller.setMode('table', { pose, fov: def.table.fov || 55 });
    return this.active;
  }

  close() {
    const A = this.active, G = this.game;
    if (!A) return;
    if (A.def.exit) A.def.exit(A.state);
    this.active = null;
    G.hud.cursor(null);
    const C = G.controller;
    if (A.prevMode === 'seated') C.setMode('seated', A.prevOpts);
    else { C.setMode('walk'); C.ease(A.prevPose, 0.4); }
  }

  // per fixed step (Game.post)
  update(dt) {
    const A = this.active;
    if (!A) return;
    const G = this.game, P = A.pointer, m = G.mouse, [w, d] = A.def.table.size;
    const yaw = A.anchor.yaw ?? 0;
    P.x = Math.max(-w / 2, Math.min(w / 2, P.x + m.dx * 0.0006));
    P.z = Math.max(-d / 2, Math.min(d / 2, P.z - m.dy * 0.0006));
    P.pressed = G.pressed('Mouse0');
    P.down = G.controller.keys.has('Mouse0') || (P.down && !G.released('Mouse0'));
    P.right = G.controller.keys.has('Mouse2');
    P.wheel = m.wheel;
    // table -> world: +x right as seen, +z away (the eye looks along -z of yaw)
    const c = Math.cos(yaw), s = Math.sin(yaw);
    P.world.set(A.anchor.pos.x + P.x * c - P.z * s, A.height, A.anchor.pos.z - P.x * s - P.z * c);
    G.hud.cursor(G.screenOf(_w.copy(P.world)));
    A.def.input(A.state, P);
    if (A.def.update) A.def.update(A.state, dt);
    if (A.state.progress !== A.lastProgress) { A.lastProgress = A.state.progress; A.idle = 0; }
    A.idle += dt;
    if (A.idle > 40 && A.def.hint && A.hinted < 3) { A.hinted++; A.idle = 0; G.hud.say(A.def.hint(A.state, A.hinted), 4); }
    if (A.def.solved(A.state)) {
      const done = A.onSolved;
      this.states.delete(A.id);
      this.close();
      if (done) done(G.scenes.ctx || { game: G });
      return;
    }
    if (G.pressed('KeyE')) this.close();
  }
}

// the demo puzzle: slide the matchbook onto the ring on the counter
const DEMO = {
  id: 'demo',
  table: { anchor: 'diner.counter.player', size: [0.6, 0.36] },
  build(ctx, a) {
    const S = ctx.stage || ctx.game.stage;
    const piece = buildProp('matchbook');
    piece.position.set(a.pos.x + 0.1, a.pos.y, a.pos.z + 0.15);
    S.scene.add(piece);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.03, 0.036, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xbbbbbb }));
    ring.position.set(a.pos.x - 0.02, a.pos.y + 0.002, a.pos.z - 0.12);
    S.scene.add(ring);
    return { piece, ring, grab: false, progress: 0 };
  },
  input(st, p) {
    if (p.pressed && p.world.distanceTo(st.piece.position) < 0.06) st.grab = true;
    if (!p.down) st.grab = false;
    if (st.grab) { st.piece.position.x = p.world.x; st.piece.position.z = p.world.z; st.progress++; }
  },
  solved(st) { return Math.hypot(st.piece.position.x - st.ring.position.x, st.piece.position.z - st.ring.position.z) < 0.02; },
  hint(st, level) { return ['The ring on the counter.', 'Drag the matchbook onto the ring.', 'Hold the mouse button on the matchbook, drag it into the ring.'][level - 1]; },
  exit() {},
};

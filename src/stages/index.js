import * as THREE from 'three';
import { Stage } from '../world/World.js';

// Every stage of the story: src/stages/<name>/index.js default-exports
// { name, parts: [part defs], look?, salt? } and is found here on its own
// (import.meta.glob, eager): a new stage is a new directory, never an edit.
// game.stages.get(name) builds a stage on first use; .names lists them.
// RNG: the block draws from the root seed (its parts' forks are the ones
// every golden frame was printed with); another stage declares a `salt`
// and draws from root.fork(salt), so building it never disturbs the block.
const mods = import.meta.glob('./*/index.js', { eager: true });
export const STAGE_DEFS = new Map(Object.values(mods).map((m) => [m.default.name, m.default]));

export class Stages {
  // ctx: { renderer, U, tex, rng }: the engine every stage shares
  constructor(ctx) {
    this.ctx = ctx;
    this.built = new Map();
  }

  get names() { return [...STAGE_DEFS.keys()]; }

  // (opts.scene: the scene to build it into, main.js's for the first stage)
  get(name, opts = {}) {
    // [C3] (a stage being warmed is finished at once)
    // ([C3 3rd] only its build: the programs and the scene's pre-builds that
    // were still to come are left to the first frame)
    if (this.warming && this.warming.has(name)) { const w = this.warming.get(name); if (w.stage.deferred) for (let r = w.it.next(); !r.done && w.stage.deferred; r = w.it.next()); this.warming.delete(name); if (this.warmed) this.warmed.delete(name); }
    if (this.built.has(name)) return this.built.get(name);
    const def = STAGE_DEFS.get(name);
    if (!def) throw new Error(`no stage '${name}' (stages: ${this.names.join(', ')})`);
    const { renderer, U, tex, rng } = this.ctx;
    const stage = new Stage({
      name, renderer, U, tex, rng: def.salt == null ? rng : rng.fork(def.salt), scene: opts.scene || null,
      parts: def.parts, look: def.look || null,
    });
    this.built.set(name, stage);
    return stage;
  }

  // [C3] build a stage a little at a time before it is needed (a scene's
  // last stretch calls it every frame: lane C6's foot chase for the city):
  // parts until `budgetMs` is spent, then the place's systems; true once it
  // stands. get(name) finishes it at once if called first.
  // [C3 3rd] then, still a slice a frame, what the first frame of the place
  // would otherwise do all at once (the critic: the cut froze ~0.8 s): its
  // materials' shader programs compiled against its own lights (the GPU
  // compiles them in parallel while the frames run on: KHR_parallel_shader_
  // compile; warm() stays false until they are ready, at most a few seconds),
  // and what a scene registered for the place (WARM_AFTER: the tail's coupe
  // and its lines). get(name) after a finished build just uses it.
  warm(name, budgetMs = 6) {
    const W = this.warming || (this.warming = new Map());
    if (this.built.has(name) && !W.has(name)) {
      if (!this.warmed || !this.warmed.has(name)) return true;
    }
    if (!W.has(name) && !this.built.has(name)) {
      const def = STAGE_DEFS.get(name);
      if (!def) throw new Error(`no stage '${name}' (stages: ${this.names.join(', ')})`);
      const { renderer, U, tex, rng } = this.ctx;
      const stage = new Stage({ name, renderer, U, tex, rng: def.salt == null ? rng : rng.fork(def.salt), parts: def.parts, look: def.look || null, deferred: true });
      this.built.set(name, stage);
      W.set(name, { stage, it: this.warmSteps(name, stage) });
      (this.warmed || (this.warmed = new Set())).add(name);
      return false;
    }
    const w = W.get(name);
    if (!w) return true;
    const t0 = performance.now();
    for (;;) {
      const a = performance.now();
      const r = w.it.next();
      // (the steps that ran long: game.stages.warmLog, for whoever tunes it)
      const ms = performance.now() - a;
      if (ms > 8) (this.warmLog || (this.warmLog = [])).push([name, String(r.value), +ms.toFixed(1)]);
      if (r.done) { W.delete(name); this.warmed.delete(name); return true; }
      if (r.value === WAIT || performance.now() - t0 > budgetMs) return false;
    }
  }
  *warmSteps(name, stage) {
    yield* stage.buildSteps();
    // (the programs: compiled a group of the scene's objects a step, with the
    // place's lights, into a target like the pipeline's scene target)
    const G = globalThis.__noir && globalThis.__noir.game;
    const r = this.ctx.renderer, cam = G && G.camera, P = G && G.pipeline;
    if (r && cam && r.compile) {
      // (the place's lights alone, in a scene of their own: a program is made
      // for the count and kind of lights it is lit by, and compile() gathers
      // them from its target scene on every call - over the whole city that
      // was 20 ms a call)
      const LS = new THREE.Scene();
      // (a program also reads the scene's fog and environment)
      LS.fog = stage.scene.fog; LS.environment = stage.scene.environment;
      stage.scene.traverseVisible((o) => { if (o.isLight) { const c = o.clone(false); c.layers.mask = o.layers.mask; LS.add(c); } });
      const meshes = [];
      stage.scene.traverse((o) => { if (o.isMesh || o.isPoints || o.isLine || o.isSprite) meshes.push(o); });
      const mats = new Set();
      const prev = r.getRenderTarget();
      const one = (o) => {
        r.setRenderTarget((P && P.rtScene) || prev);
        try { for (const m of r.compile(o, cam, LS)) mats.add(m); } catch (e) { /* its first frame will */ }
        r.setRenderTarget(prev);
      };
      // (the id pass draws every object with its own material: one variant a
      // kind of object - instanced, skinned, plain - compiled with it)
      const idMat = P && P.idMat, kinds = new Set();
      for (const o of meshes) {
        if (o.material && o.material.isMaterial) one(o);
        if (idMat && o.isMesh) {
          const k = [!!o.isInstancedMesh, !!o.isSkinnedMesh, !!o.isBatchedMesh, !!(o.morphTargetInfluences && o.morphTargetInfluences.length), !!o.instanceColor, !!(o.geometry && o.geometry.attributes.color)].join();
          if (!kinds.has(k)) { kinds.add(k); const m0 = o.material; o.material = idMat; one(o); o.material = m0; }
        }
        yield 'compile';
      }
      // (until the GPU has them, a frame at a time: at most ~3 s)
      const props = r.properties;
      const t0 = performance.now();
      while (mats.size && performance.now() - t0 < 3000) {
        for (const m of mats) { const pr = props.get(m).currentProgram; if (!pr || !pr.isReady || pr.isReady()) mats.delete(m); }
        if (mats.size) yield WAIT;
      }
    }
    const after = WARM_AFTER.get(name);
    if (after && G) yield* after(stage, G);
  }
}

// [C3 3rd] what a scene builds ahead for a place it will be entered in (run
// at the end of Stages.warm, a step at a time): WARM_AFTER.set(name, function* (stage, game) { ... })
export const WARM_AFTER = new Map();
// (a warm step that waits for the next frame whatever the budget)
const WAIT = Symbol('wait');

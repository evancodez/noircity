// [R2-G] The table views of the dry step (the halves, the note), framed as
// a panel under the lamp, not a flat grey close-up (the puzzles' own view
// looks straight down from 0.55 m: the step filled the frame and read as a
// grey slab under the brush field). I am down on my heels before the step:
// the plank door in its stone frame across the top of the picture, the
// step in the lamp's pool (its light faded in as I come down to it), the
// wet flags at its foot falling off into the dark. When the thing is made
// (the bird whole, the note whole) the eye leans in over it, to be read.
// The pointer is the puzzles' own (table metres, one to one), whatever the
// eye: only the view is this file's.
// The lens is held here for the whole scene: the puzzles set a table's
// lens at once on opening and the controller gives the old one back at
// once on closing (a pop each way, and between the halves and the note a
// jump to the walking lens and back); this eases it every step instead.
// (no default export: not a scene)

// (look dev: ?stepcam=back,up,pitch,fov[,side])
const Q = typeof location !== 'undefined' && location.search.includes('stepcam') ? new URLSearchParams(location.search).get('stepcam').split(',').map(Number) : null;
// working: crouched a pace back; done: leaned in over it
const VIEW = {
  halves: { back: 0.42, up: 0.68, pitch: -0.94, fov: 46, side: 0.02 },
  note: { back: 0.45, up: 0.72, pitch: -0.92, fov: 52, side: 0.02 },
};
// (over the thing made: its middle in the middle of the frame, the pool's
// edge and the door's foot still in the picture)
const CLOSE = {
  halves: { up: 0.32, pitch: -1.12, fov: 30 },
  note: { up: 0.42, pitch: -1.08, fov: 40 },
};
const sstep = (u) => { const t = Math.min(1, Math.max(0, u)); return t * t * (3 - 2 * t); };

function poseOf(a, v) {
  const yaw = a.yaw ?? 0;
  // back: toward the eye (the table's -z); side: the table's +x (right as seen)
  const bx = Math.sin(yaw), bz = Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  return { x: a.pos.x + bx * v.back + rx * v.side, y: a.pos.y + v.up, z: a.pos.z + bz * v.back + rz * v.side, yaw, pitch: v.pitch, fov: v.fov };
}

// over a world point `f`: the eye `up` over it, pitched so it is in the middle
function overOf(a, f, v) {
  const yaw = a.yaw ?? 0, back = v.up / Math.tan(-v.pitch);
  return { x: f.x + Math.sin(yaw) * back, y: f.y + v.up, z: f.z + Math.cos(yaw) * back, yaw, pitch: v.pitch, fov: v.fov };
}

// One per scene run: M.open(which, done, focus) right after puzzles.open(id);
// M.step(dt) every step. `done()` says the thing is made (then the lean in
// over `focus()`, a world point).
export function stepLens(ctx) {
  const G = ctx.game, C = ctx.controller, cam = G.camera;
  const alley = ctx.stage.part && ctx.stage.part('alley');
  const M = { base: null, shown: null, light: 0, cur: null };
  M.open = (which, done, focus = null) => {
    const A = G.puzzles.active;
    if (!A) return;
    // (the walking lens, the first time: the puzzles kept it to give back)
    if (M.base == null) M.base = C._fov0 ?? cam.fov;
    if (M.shown == null) M.shown = M.base;
    C._fov0 = null;
    cam.fov = M.shown; cam.updateProjectionMatrix();
    const V0 = Q ? { back: Q[0], up: Q[1], pitch: Q[2], fov: Q[3], side: Q[4] ?? 0 } : VIEW[which];
    const V1 = CLOSE[which];
    const P0 = poseOf(A.anchor, V0);
    C.setMode('table', { pose: P0, ease: 0.55 });
    M.cur = { A, V0, V1, P0, P1: null, k: 0, done, focus };
  };
  M.step = (dt) => {
    if (M.base == null) return;
    const A = G.puzzles.active, cur = M.cur && M.cur.A === A ? M.cur : null;
    let fovWant = M.base;
    if (cur) {
      const want = cur.done && cur.done() ? 1 : 0;
      // (where to lean: over the thing made, where it lies when it is made)
      if (want && !cur.P1) cur.P1 = overOf(A.anchor, cur.focus ? cur.focus() : A.anchor.pos, cur.V1);
      cur.k += Math.sign(want - cur.k) * Math.min(Math.abs(want - cur.k), dt / 0.7);
      const k = sstep(cur.k);
      fovWant = cur.V0.fov + (cur.V1.fov - cur.V0.fov) * k;
      // (once the eye has come down to the step it is held there, or on its
      // way in over the thing made)
      const E = C._ease;
      if (k > 0 && cur.P1 && E && C.mode === 'table' && E.t >= E.dur) {
        const L = (a, b) => a + (b - a) * k;
        E.to = { x: L(cur.P0.x, cur.P1.x), y: L(cur.P0.y, cur.P1.y), z: L(cur.P0.z, cur.P1.z), yaw: L(cur.P0.yaw, cur.P1.yaw), pitch: L(cur.P0.pitch, cur.P1.pitch) };
        E.from = E.to;
      }
    } else M.cur = null;
    // the lens: eased toward the view's (or back to the walking one)
    const a = 1 - Math.exp(-dt / 0.15);
    M.shown += (fovWant - M.shown) * a;
    if (!cur && Math.abs(M.shown - M.base) < 0.02) M.shown = M.base;
    if (Math.abs(cam.fov - M.shown) > 1e-4) { cam.fov = M.shown; cam.updateProjectionMatrix(); }
    // the lamp's light down on the step while I am at it
    const lw = cur ? 1 : 0;
    M.light += (lw - M.light) * (1 - Math.exp(-dt / 0.18));
    if (M.light < 0.003 && !cur) M.light = 0;
    if (alley) alley.stepLight(M.light);
    if (!cur && M.shown === M.base && M.light === 0) { M.base = null; M.shown = null; }
  };
  return M;
}
export { poseOf as stepPose, VIEW as STEP_VIEW };

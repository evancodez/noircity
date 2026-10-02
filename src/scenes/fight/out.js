import * as THREE from 'three';
import { DINER } from '../../stages/block/site.js';
import { DOOR, SLAT } from '../../player/clips/watcher.js';
import { buildProp } from '../../props/index.js';

// [C4] The end of chapter II (the brief's §4, §5): the way out of the diner
// and what I find on him.
//   hookDoor(ctx)      the street door's sounds and its word, once: tried
//                      while barred it rattles ('Barred.'); the last one out
//                      lets it slam and the bar drops across it
//   afterKO(ctx, w)    after the last blow: E lifts the bar (the right hand
//                      closes on it, lifts it up onto its keeper) and the
//                      door is pushed open by walking into it; or SPACE at
//                      the broken bay: over the sill onto the pavement (the
//                      body's big move). -> { step(dt), out }
//   *readCard(ctx)     on the pavement, after the matchbook: Ames's card,
//                      folded in it, comes out and turns over in my fingers
//                      under the street lamp - J. AMES, PRIVATE
//                      INVESTIGATIONS, HARBOR BLDG. RM 304, crossed through
//                      in the crew's red. E puts it away.
export const AMES_LINE = 'Harbor Building. Room 304.';
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const doorAt = () => V(DINER.innerX - 0.1, DINER.floorY + 1.05, DINER.door.hingeZ + DINER.door.w / 2);

export function hookDoor(ctx) {
  const G = ctx.game, d = ctx.stage.part('dinerFront').door;
  if (d.c4Hooked) return;
  d.c4Hooked = true;
  d.on('rattle', () => {
    G.sfx.play('f_c4rattle', doorAt(), {}, { ref: 2 });
    if (G.state === 'playing' && !G.shotMode) G.hud.message('Barred.', 1.5);
    (G.counters.rattles = (G.counters.rattles || 0) + 1);
    G.emit('door:rattle', {});
  });
  d.on('barDown', () => G.sfx.play('f_c4bar', doorAt(), {}, { ref: 2 }));
  // (any other scene on the block finds the door as it always was: no bar across it)
  G.on('scene:enter', (e) => { if (e && e.id !== 'fight' && (d.barred || d.bar)) { d.barOnSlam = false; d.liftBar({ now: true }); } });
  d.on('slam', () => {
    G.sfx.play('f_c4shut', doorAt(), {}, { ref: 2 });
    // (the last one out let it slam: the bar, knocked off its keeper, drops)
    const S = G.scenes, ctx2 = S && S.ctx;
    if (d.barOnSlam && !d.barred && !(ctx2 && ctx2.flags && ctx2.flags.fleeing > 0)) d.dropBar();
  });
}

// the bar's middle, where a hand takes it (world)
function barGrip(d, out = V(0, 0, 0)) {
  const b = d.makeBar();
  b.pivot.updateMatrixWorld(true);
  return out.set(-0.035, 0, -0.42).applyMatrix4(b.pivot.matrixWorld);
}

export function afterKO(ctx, w) {
  const G = ctx.game, C = ctx.controller, H = ctx.hands;
  const front = ctx.stage.part('dinerFront'), d = front.door;
  const S = { lifting: false, liftT: 0, climbing: false, climbT: 0, out: false, how: null };
  // ---- the bar ------------------------------------------------------------------------------
  ctx.interact.add({ id: 'c4.bar', at: () => barGrip(d), range: 1.8, cone: 0.6, prompt: 'lift the bar',
    when: () => d.barred && !S.lifting && !S.climbing && C.mode === 'walk',
    onUse: () => {
      S.lifting = true; S.liftT = 0;
      SLAT.cam = G.camera; DOOR.out = V(-1, 0, 0); DOOR.at = barGrip(d);
      H.play('carDoor', { onMark: { grip: () => { d.liftBar(); G.sfx.play('f_c4lift', doorAt(), {}, { ref: 2 }); d.barOnSlam = false; S.how = S.how || 'door'; G.emit('door:unbarred', {}); } } });
    } });
  // ---- over the sill of the broken bay (SPACE: the body's big move) ------------------------------
  const L = ctx.flags.landing || { x: DINER.faceX + 1.4, z: DINER.bays[w] };
  const bayZ = DINER.bays[w];
  // (beside where he lies, not over him: the side of the bay away from his head)
  const zc = Math.max(bayZ - 1.25, Math.min(bayZ + 1.25, L.z + (L.z >= bayZ ? -1.3 : 1.3)));
  const sill = V(DINER.innerX - 0.05, DINER.window.sill + 0.04, zc);
  ctx.interact.add({ id: 'c4.sill', key: 'Space', at: sill, range: 1.7, cone: 0.7, prompt: 'climb out',
    when: () => !S.climbing && !S.lifting && C.mode === 'walk' && G.eye.x < DINER.innerX && front.panes[w] && front.panes[w].broken,
    onUse: () => {
      S.climbing = true; S.climbT = 0;
      const P = C.eyePose();
      const tx = DINER.faceX + 0.75, tz = zc, ty = DINER.floorY + 1.63;
      const yaw0 = P.yaw, yaw1 = Math.atan2(-(L.x - tx), -(L.z - tz));
      G.sfx.play('crouch');
      G.sfx.play('clothRustle');
      C.setMode('cutscene', { track: (t) => {
        const u = Math.min(1, t / 1.0), e = u * u * (3 - 2 * u);
        // (a hand on the sill, the body up and over the riser, down on the pavement)
        const x = P.x + (tx - P.x) * e, z = P.z + (tz - P.z) * e;
        const y = P.y + (ty - P.y) * e + 0.36 * Math.sin(Math.PI * Math.min(1, u * 1.15)) - 0.12 * Math.sin(Math.PI * u) * (u > 0.6 ? 1 : 0);
        const yw = yaw0 + Math.atan2(Math.sin(yaw1 - yaw0), Math.cos(yaw1 - yaw0)) * Math.max(0, (u - 0.55) / 0.45);
        return { x, y, z, yaw: yw, pitch: -0.35 * Math.sin(Math.PI * u) + (u > 0.7 ? -0.2 * (u - 0.7) / 0.3 : 0) };
      } });
      S.climbDone = () => { C.setMode('walk', { pose: { x: tx, y: ty, z: tz, yaw: yaw1, pitch: -0.2 } }); G.sfx.play('f_bodyFloor', null, { k: 0.4 }); S.how = 'sill'; };
    } });
  return Object.assign(S, {
    step(dt) {
      if (S.lifting) {
        S.liftT += dt;
        if (DOOR.at) DOOR.at = barGrip(d);
        if (S.liftT > 0.95 && !S.letGo) { S.letGo = true; H.play('c4letGo'); }
        if (S.liftT > 1.4) { S.lifting = false; S.letGo = false; DOOR.at = null; }
      }
      if (S.climbing) {
        S.climbT += dt;
        if (S.climbT >= 1.0 && S.climbDone) { const f = S.climbDone; S.climbDone = null; f(); }
        if (S.climbT >= 1.05) S.climbing = false;
      }
      S.out = G.eye.x > DINER.faceX + 0.2;
    },
  });
}

// ---- Ames's card ---------------------------------------------------------------------------
// it comes out of the matchbook and turns over in my fingers (the inspection's
// pivot turned from its back to its face over 0.8 s), the mouse still turns it
export function* readCard(ctx) {
  const G = ctx.game;
  const card = buildProp('amesCard');
  ctx.flags.card = card;
  G.sfx.play('clothRustle');
  // (its back to me first: turned over about its long edge, face up, by 1.0 s)
  const FACE = 1.05;
  const A = G.inspect.open({ prop: card, options: { spin: [FACE - Math.PI, 0.12], dist: 0.27, scale: 2.7 } });
  let read = false;
  A.onDone = () => { read = true; };
  const p = A.pivot;
  let t = 0, turned = 0;
  while (!read) {
    t += 1 / 60;
    if (t < 1.05) {
      // (the turn, eased; the mouse's own turn rides on it)
      const u = Math.min(1, Math.max(0, (t - 0.3) / 0.7)), e = u * u * (3 - 2 * u);
      const want = (FACE - Math.PI) + Math.PI * e;
      p.rotation.x += want - (FACE - Math.PI) - turned;
      turned = want - (FACE - Math.PI);
      if (u > 0.5 && !ctx.flags.cardTurned) { ctx.flags.cardTurned = true; G.sfx.play('matchbook'); }
    }
    yield null;
  }
  ctx.flags.cardRead = true;
}

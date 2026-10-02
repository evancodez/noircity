import * as THREE from 'three';
import { DINER } from '../../stages/block/site.js';
import { DOOR, SLAT } from '../../player/clips/watcher.js';
import { until } from '../../game/script.js';

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
    // ([C4] not over the fight's own word in the middle of the frame - NOW
    // FIGHT. at the lesson's end was written on top of it: the rattle says it)
    const fc = G.brawl && G.brawl.active && G.brawl._cards;
    // ([C4] after the last blow, facing it: its prompt says what to do - E
    // lift the bar - and the word would only sit on top of it)
    const cur = G.interact && G.interact.current;
    if (G.state === 'playing' && !G.shotMode && !(fc && fc.flT > 0) && !(cur && cur.id === 'c4.bar')) G.hud.message('Barred.', 1.5);
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

// [C4] the point of the barred leaf my view crosses (or, looking away from
// it, the nearest point of it to that line): where the bar's prompt sits
const _o = new THREE.Vector3(), _dv = new THREE.Vector3();
function onLeaf(G) {
  const x0 = DINER.innerX - 0.1, z0 = DINER.door.hingeZ + 0.06, z1 = DINER.door.hingeZ + DINER.door.w - 0.06;
  const y0 = DINER.floorY + 0.35, y1 = DINER.floorY + 1.85;
  const cam = G.camera;
  _o.copy(cam.position); _dv.set(0, 0, -1).transformDirection(cam.matrixWorld);
  // (inside, facing the street: the ray meets the leaf's plane ahead)
  let t = Math.abs(_dv.x) > 1e-3 ? (x0 - _o.x) / _dv.x : -1;
  if (!(t > 0)) t = Math.max(0.3, Math.abs(x0 - _o.x));
  const y = Math.max(y0, Math.min(y1, _o.y + _dv.y * t)), z = Math.max(z0, Math.min(z1, _o.z + _dv.z * t));
  return V(x0, y, z);
}

export function afterKO(ctx, w) {
  const G = ctx.game, C = ctx.controller, H = ctx.hands;
  const front = ctx.stage.part('dinerFront'), d = front.door;
  const S = { lifting: false, liftT: 0, climbing: false, climbT: 0, out: false, how: null };
  // ---- the bar ------------------------------------------------------------------------------
  // ([C4] after the critic (B2): the prompt wherever I look at the door, from
  // up against it to two and a half metres back - anchored on the point of
  // the leaf my view crosses (clamped to it), not on the bar's middle at
  // waist height, which a man pressed to the door could not find)
  ctx.interact.add({ id: 'c4.bar', at: () => onLeaf(G), range: 2.5, cone: 0.75, prompt: 'lift the bar',
    when: () => d.barred && !S.lifting && !S.climbing && C.mode === 'walk',
    onUse: () => {
      S.lifting = true; S.liftT = 0;
      SLAT.cam = G.camera; DOOR.out = V(-1, 0, 0); DOOR.at = barGrip(d);
      H.play('carDoor', { onMark: { grip: () => { d.liftBar(); G.sfx.play('f_c4lift', doorAt(), {}, { ref: 2 }); d.barOnSlam = false; S.how = S.how || 'door'; G.emit('door:unbarred', {}); } } });
    } });
  // ---- over the sill of the broken bay (SPACE: the body's big move) ------------------------------
  const L = ctx.flags.landing || { x: DINER.faceX + 1.4, z: DINER.bays[w] };
  const bayZ = DINER.bays[w];
  // ([C4] after the critic (B2): over the sill wherever I stand at the broken
  // bay - the point of the sill in front of me, along the whole of the hole
  // (the glass gone, its jagged edges kept off by a hand's width), not one
  // spot 1.25 m to the side of him; and not onto him: a body's width off
  // where he lies, on my side of him)
  const half = DINER.window.w / 2 - 0.3;
  let zc = bayZ;
  const climbZ = () => {
    let z = Math.max(bayZ - half, Math.min(bayZ + half, G.eye.z));
    if (Math.abs(z - L.z) < 0.85) z = L.z + (G.eye.z >= L.z ? 0.85 : -0.85);
    return Math.max(bayZ - half, Math.min(bayZ + half, z));
  };
  // (the prompt in the hole itself, at chest height: found looking out at
  // the street or down at him, not only looking down at the sill)
  const sill = () => V(DINER.innerX + 0.05, DINER.window.sill + 0.5, climbZ());
  ctx.interact.add({ id: 'c4.sill', key: 'Space', at: sill, range: 2.0, cone: 0.95, prompt: 'climb out',
    when: () => !S.climbing && !S.lifting && C.mode === 'walk' && G.eye.x < DINER.innerX && front.panes[w] && front.panes[w].broken,
    onUse: () => {
      S.climbing = true; S.climbT = 0;
      zc = climbZ();
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
  const answers = roomAnswers(ctx, () => !S.climbing && !S.lifting && C.mode === 'walk');
  return Object.assign(S, {
    step(dt) {
      answers(dt);
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

// [C4] after the critic (M4, WAVE_C §1 rule 7): the room answers whatever
// a curious man tries after the last blow - a word from the docker against
// the far wall, from Dot down behind the counter (she gets up), from the
// cook in his hatch (his bell); the jukebox plays its next record; a stool
// walked into spins. Small, once or twice each, never in the way.
function roomAnswers(ctx, free) {
  const G = ctx.game, cast = ctx.cast, d = ctx.stage.part('diner');
  const head = (c) => () => c && c.bones && c.bones.head ? c.bones.head.getWorldPosition(V(0, 0, 0)) : null;
  const talk = (id, c, lines, prompt, then, range = 2.6) => {
    if (!c) return;
    let n = 0;
    ctx.interact.add({ id, at: head(c), range, cone: 0.45, prompt, when: free,
      onUse: () => { const line = lines[Math.min(n, lines.length - 1)]; n++; G.hud.say(line, 2.4); if (then) then(n); } });
  };
  const dk = cast.get('docker'), dot = cast.get('dot'), cook = cast.get('cook');
  talk('c4.docker', dk, ['Not my fight, mister.', 'I didn’t see nothing.'], 'talk', (n) => {
    if (n === 1 && dk.play) { try { dk.play('startle'); } catch (e) { /* */ } }
  });
  talk('c4.dot', dot, ['You’d better go. They’ll send more.', 'Go on. I’ll be all right.'], 'talk', (n) => {
    // (up from behind the counter at the first word)
    if (n === 1 && dot.setState) { try { dot.setState('idle', 0.4); } catch (e) { /* */ } }
  });
  // (the cook is across the counter and the back bar, in his hatch)
  talk('c4.cook', cook, ['Kitchen’s closed.', 'I said closed.'], 'talk', () => { if (d.bell) d.bell.ring(); }, 4.2);
  if (d.jukebox) {
    const J = DINER.jukebox;
    ctx.interact.add({ id: 'c4.jukebox', at: V(J.x, DINER.floorY + 1.1, DINER.zMin + 0.45), range: 2.2, cone: 0.5, prompt: 'play', when: free,
      onUse: () => { d.jukebox.next(); G.sfx.play('clothRustle', V(J.x, 1.0, DINER.zMin + 0.5), { k: 0.3 }); } });
  }
  // (a stool walked into turns on its post, with its squeak)
  const cool = new Map();
  return (dt) => {
    if (!free()) return;
    const e = G.eye;
    for (let i = 1; i <= 9; i++) {
      const st = d.stool(i);
      if (!st || !st.object || st.handle && (st.handle.toppled || st.handle.broken)) continue;
      const p = st.object.getWorldPosition(V(0, 0, 0));
      const k = (cool.get(i) || 0) - dt;
      cool.set(i, k);
      // (my body against its seat: my radius and its, and a little)
      if (k <= 0 && Math.hypot(p.x - e.x, p.z - e.z) < 0.68) { st.spin(0.9); G.sfx.play('stoolSqueak', V(p.x, 0.9, p.z)); cool.set(i, 2.5); ctx.flags.spun = (ctx.flags.spun || 0) + 1; }
    }
  };
}

// ---- Ames's card ---------------------------------------------------------------------------
// [C4] after the critic (m2): out of the matchbook into my fingers - the
// right hand brings it up with its back to me and turns it over under the
// street lamp (player/clips/c4.js c4readCard: the card placed, the hand
// solved onto it - it never hangs in the air); E puts it away
export function* readCard(ctx) {
  const G = ctx.game, H = ctx.hands;
  G.sfx.play('clothRustle');
  const h = H.play('c4readCard', { onMark: { turned: () => { ctx.flags.cardTurned = true; G.sfx.play('matchbook'); } } });
  yield null;
  ctx.flags.card = H.held.R || null;
  yield until(() => h.t >= 1.0 || h.done);
  G.hud.prompt('E  put away', null, 'c4card');
  ctx.flags.cardUp = true;
  yield until(() => ctx.pressed('KeyE'));
  G.hud.clearPrompt('c4card');
  ctx.flags.cardRead = true;
}

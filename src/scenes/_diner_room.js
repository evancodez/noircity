import * as THREE from 'three';
import { DINER, stoolZ } from '../stages/block/site.js';
import { buildProp } from '../props/index.js';

// The diner as scenes 1 and 2 find it (STORY.md): who sits where, what is
// on the counter, the player on his stool, and the small machinery both
// scenes direct it with. Shared by scenes/01_diner.js and scenes/02_fight.js
// (this file has no default export: the scene manager passes it over).
// Everything goes through the contract's APIs (the cast, the hands, the
// diner part's API, the props): when the real room, people and hands
// arrive, the same directions play on them.
export const V = (x, y, z) => new THREE.Vector3(x, y, z);

// the ring (the aisle between the stools and the booths): Mack squared up
// to the south, the player 1.45 m north of him; the fight drives him down
// the aisle toward the end bay (B4), whose glass he goes out through
export const RING = {
  x: DINER.ring.x, z: DINER.ring.z, r: DINER.ring.r,
  // how far along the aisle the fight may go (him), and where he reels to
  z0: -3.15, z1: 6.2, koZ: -3.1,
  // the flight: out over booth 4, through the end bay's glass, onto the pavement
  // (his feet's path: laid back, his head and shoulders lead by ~0.8 m, so
  // the glass goes as they reach it)
  window: { x: DINER.faceX - 0.85, z: DINER.bays.B4 + 0.1 },
};
export const MACK_AT = { x: DINER.ring.x, z: DINER.ring.z - 0.72 };
export const EYE_AT = { x: DINER.ring.x, z: DINER.ring.z + 0.73 };
export const BRAWL_EYE = DINER.brawlEyeY;

// the room at the start of the evening: phase 'evening' (scene 1) or
// 'fight' (scene 2: Mack off his stool, his stool over)
export function dinerRoom(ctx, phase = 'evening') {
  const { stage, cast, game } = ctx;
  const d = stage.part('diner'), front = stage.part('dinerFront');
  cast.clear();
  d.reset();
  for (const p of Object.values(front.panes)) stage.glass.restore(p);
  // (the door's little bells, whoever opens it)
  // (and the room's heads turn to it: lane 6's cast.attention)
  if (!front.bellHooked) {
    front.bellHooked = true;
    front.door.on('open', () => {
      game.sfx.play('doorbell', V(DINER.innerX - 0.1, 2.3, 0.6));
      if (game.cast && game.cast.attention) game.cast.attention(V(DINER.innerX, 1.6, 0.6));
    });
  }
  // (the glass whole again: the street's sound back behind the wall)
  if (game.sfx && game.sfx.roomOpen) game.sfx.roomOpen(0);
  const dot = cast.spawn('waitress', { at: 'diner.urns' });
  dot.setState('lean');
  cast.spawn('cook', { at: 'diner.hatch' }).setState('hatch');
  cast.spawn('oldman', { seat: 'diner.stool.9' }).setState('sitRead');
  const dk = cast.spawn('docker', { seat: 'diner.stool.1' });
  // (his mug off the counter into his hands: lane 6's sitDrink holds it)
  const mug = d.take('mug.docker');
  if (mug) dk.hold(mug, 'R');
  dk.setState('sitDrink');
  cast.spawn('couple_her', { seat: 'diner.booth.2.a' }).setState('sitTalk');
  cast.spawn('couple_him', { seat: 'diner.booth.2.b' }).setState('sitTalk');
  if (phase === 'evening') cast.spawn('brawler', { seat: 'diner.stool.' + DINER.brawlerStool }).setState('sitEat');
  // (the record on: heard from the jukebox, never in shot mode)
  if (!game.shotMode && !d.jukebox.slot) d.jukebox.play('jukebox_a');
  else if (!game.shotMode) game.music.cue(d.jukebox.slot, { diegetic: { pos: jukeboxPos(), room: 'diner' } });
  return d;
}
export const jukeboxPos = () => V(DINER.jukebox.x, DINER.floorY + 1.0, DINER.zMin + 0.6);

// the player on his stool, the smoke set in his hands (the pitch: a man
// leaning on the counter, looking along it to the back bar and Dot)
// (turn: radians off the counter's square, + toward the north end and Dot's
// urns, - toward the south end and Mack)
export function seatPlayer(ctx, { lit = false, pitch = -0.16, turn = 0 } = {}) {
  const { controller, hands } = ctx;
  hands.hold(null, 'R');
  hands.hold(null, 'L');
  hands.equip('smoke');
  controller.setMode('seated', { anchor: 'diner.stool.player', pitch });
  if (turn) { controller.yaw += turn; controller.apply(0); }
  if (lit) holdCigarette(ctx, true);
}

// the cigarette between his fingers (lane 2 draws the hand round it)
export function holdCigarette(ctx, lit) {
  const c = buildProp('cigarette');
  ctx.hands.hold(c, 'R');
  if (lit) c.userData.setTip('lit');
  ctx.flags.cig = c;
  return c;
}

// the glass on the counter at my left hand, with `fill` of scotch
export function setGlass(ctx, fill = 1) {
  const d = ctx.stage.part('diner');
  const g = d.place('tumbler', 'diner.counter.glass', { name: 'glass' });
  g.userData.setFill(fill);
  return g;
}

// ---- jobs: what each figure is doing, one after another ----------------------------
// A job is a generator (the same kind a scene yields: wait, until, nothing,
// or a figure's walkTo). jobs.add(name, gen) queues it after that figure's
// current one; jobs.busy(name); jobs.step() runs one step of each (the
// scene's onStep). The script and the room both queue work for Dot; she
// does it in order, and the script waits on her (until(() => !jobs.busy)).
export function makeJobs() {
  const Q = new Map();
  const step1 = (q, dt) => {
    for (let guard = 0; guard < 16 && q.length; guard++) {
      const J = q[0];
      if (J.wait) {
        if (J.wait.kind === 'wait') { J.wait.left -= dt; if (J.wait.left > 1e-6) return; }
        else if (J.wait.kind === 'until' && !J.wait.cond()) return;
        J.wait = null;
      }
      const r = J.it.next();
      if (r.done) { q.shift(); continue; }
      J.wait = r.value || null;
      if (!J.wait || (J.wait.kind === 'wait' && J.wait.left > 0) || J.wait.kind === 'until') return;
    }
  };
  return {
    add(name, gen) { if (!Q.has(name)) Q.set(name, []); Q.get(name).push({ it: gen, wait: null }); },
    busy(name) { const q = Q.get(name); return !!(q && q.length); },
    clear(name) { if (name) Q.delete(name); else Q.clear(); },
    step(dt) { for (const q of Q.values()) step1(q, dt); },
  };
}

// a clip on a figure, as a job step: play it, wait for it to end
export function* clip(c, name, onMark = null) {
  const h = c.play(name, { onMark: onMark || {} });
  while (!h.done && h.t < h.duration) yield null;
}

// a counter-top point opposite stool i (x from the counter's front edge)
export const counterAt = (i, back = 0.2, dz = 0) => V(DINER.counter.frontX - back, DINER.counter.topY, stoolZ(i) + dz);
export { DINER, stoolZ };

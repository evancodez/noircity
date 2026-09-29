import * as THREE from 'three';
import { DINER } from '../stages/block/site.js';
import { buildProp } from '../props/index.js';

// The diner as scenes 1 and 2 find it (STORY.md): who sits where, what is
// on the counter, the player on his stool. Shared by scenes/01_diner.js and
// scenes/02_fight.js (this file has no default export: the scene manager
// passes it over).
// (FOUNDATION STUB: lane 7 owns src/scenes/**)
export const V = (x, y, z) => new THREE.Vector3(x, y, z);

// the room at the start of the evening: phase 'evening' (scene 1) or
// 'fight' (scene 2: Mack off his stool, his stool over)
export function dinerRoom(ctx, phase = 'evening') {
  const { stage, cast, game } = ctx;
  const d = stage.part('diner'), front = stage.part('dinerFront');
  cast.clear();
  d.reset();
  for (const p of Object.values(front.panes)) stage.glass.restore(p);
  const dot = cast.spawn('waitress', { at: 'diner.urns' });
  dot.setState('lean');
  const cook = cast.spawn('cook', { at: 'diner.hatch' });
  void cook;
  cast.spawn('oldman', { seat: 'diner.stool.9' }).setState('sitRead');
  cast.spawn('docker', { seat: 'diner.stool.1' }).setState('sitDrink');
  cast.spawn('couple_her', { seat: 'diner.booth.2.a' }).setState('sitTalk');
  cast.spawn('couple_him', { seat: 'diner.booth.2.b' }).setState('sitTalk');
  if (phase === 'evening') cast.spawn('brawler', { seat: 'diner.stool.' + DINER.brawlerStool }).setState('sitEat');
  if (!game.shotMode) d.jukebox.play('jukebox_a');
  return d;
}

// the player on his stool, the smoke set in his hands
export function seatPlayer(ctx, { lit = false } = {}) {
  const { controller, hands } = ctx;
  hands.hold(null, 'R');
  hands.equip('smoke');
  controller.setMode('seated', { anchor: 'diner.stool.player', pitch: -0.28 });
  if (lit) holdCigarette(ctx, true);
}

// the cigarette between his fingers (a stand-in: no hand is drawn yet)
export function holdCigarette(ctx, lit) {
  const c = buildProp('cigarette');
  ctx.hands.hold(c, 'R');
  c.rotation.set(-1.2, 0.3, 0);
  if (lit) c.userData.setTip('lit');
  return c;
}

// X: off the stool (walk mode, into the aisle) and back onto it
export function standToggle(ctx) {
  const { controller: C, stage } = ctx;
  if (!ctx.pressed('KeyX')) return;
  const a = stage.anchor('diner.stool.player');
  if (C.mode === 'seated') {
    C.setMode('walk', { pose: { x: a.pos.x + 0.75, y: DINER.floorY + 1.65, z: a.pos.z, yaw: C.yaw, pitch: 0 } });
  } else if (C.mode === 'walk' && Math.hypot(C.pos.x - a.pos.x, C.pos.z - a.pos.z) < 1.4) {
    C.setMode('seated', { anchor: a, pitch: -0.2 });
  }
}

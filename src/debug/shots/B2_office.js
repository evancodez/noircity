// Lane B2's presets: room 304 and the fight in it (scenes 4 and 5), each a
// scene beat at a moment, framed for review. Every one is also a query:
//   ?scene=office&beat=<b>&t=<s>[&demo=1][&pose=x,z,yaw,pitch,fov]
//   b2_corridor   the corridor from the lift's dark end: 304's lit glass, the lamp's pool
//   b2_room       the room from the door: the desk and its lamp, the blind, the slats on the wall
//   b2_slats      the picture hung crooked in the blind's light
//   b2_overview   (round 2) the room as lit, the ceiling's slats and the fan
//   b2_pad        puzzle D: the pencil's side across the next sheet (the demo hand)
//   b2_dial       puzzle E: the fingers on the dial, the sheet at the frame's edge
//   b2_safe       the safe open, the ledger in it (red)
//   b2_shadows    scene 5: a man's shadow on the door's glass, another on the sidelight's
//   b2_kick       the door kicked in: its glass in the air, the first man through
//   b2_tipped     the desk over on its front, the lamp burning on the floor
//   b2_window     the Tommy gun at the fire escape window (his outline on the curtain)
//   b2_street     the street through two fingers' gap in the blind: the lamp post, the watcher's place
//   b2_cover      down behind the tipped desk, the door over its edge
import { office } from '../../scenes/office/room.js';
const beat = (scene, b, t, extra = {}) => ({ scene, beat: b, t, viewmodel: true, ...extra });

export const presets = {
  b2_corridor: beat('office', 'corridor', 2.5),
  b2_room: beat('office', 'room', 1.5, { x: 0.45, z: 1.25, yaw: -1.62, pitch: -0.1, fov: 72 }),
  b2_slats: beat('office', 'room', 1.5, { x: 3.6, z: 3.0, yaw: 0.5, pitch: -0.1, fov: 70 }),
  // (round 2) the room as lit: the banker's lamp's pool, the blind, the street's light up
  // through it on the ceiling and the fan in it, the slats on the floor
  b2_overview: beat('office', 'room', 1.5, { x: 0.7, z: 2.0, yaw: -1.75, pitch: 0.14, fov: 72 }),
  b2_pad: beat('office', 'pad', 6.2),
  b2_dial: beat('office', 'safe', 2.2),
  b2_safe: beat('office', 'ledger', 1.2),
  b2_shadows: beat('gunfight', 'shadows', 9.3, { x: 2.3, z: 2.0, yaw: 1.28, pitch: 0.02, fov: 64 }),
  b2_kick: beat('gunfight', 'door', 0.55, { x: 3.4, z: 2.4, yaw: 1.2, pitch: 0.0, fov: 70 }),
  b2_tipped: beat('gunfight', 'door', 2.5, {
    x: 4.3, z: 5.4, yaw: 0.72, pitch: -0.28, fov: 72,
    stage(stage) { stage.part('office').tipDesk(); },
  }),
  b2_window: beat('gunfight', 'window', 9.0, { x: 3.9, z: 3.6, yaw: 2.85, pitch: -0.05, fov: 68 }),
  // the street from the window (office.window.street), the slats at the eye parted flat:
  // the lamp post on the far pavement, where the watcher stands (office.street.watcher)
  b2_street: beat('office', 'room', 1.5, {
    x: 5.3, z: 4.15, yaw: -1.606, pitch: -0.43, fov: 50, viewmodel: false,
    stage(stage) {
      // (two fingers in the blind at the eye: the slats above lifted, those below pressed down)
      const B = stage.part('office').blind;
      // (where the eye's line to the street crosses the blind: ~1.52 m)
      B.slats.forEach((S, i) => { const d = S.y - 1.52; if (Math.abs(d) < 0.15) B.set(i, { tilt: 0.05, lift: d > 0 ? 0.11 * (1 - d / 0.15) : 0, sag: d <= 0 ? 0.11 * (1 + d / 0.15) : 0 }); });
    },
  }),
  // down behind the desk, the door over its edge
  b2_cover: beat('gunfight', 'door', 2.8, {
    x: 3.98, z: 3.55, yaw: 1.02, pitch: 0.0, fov: 72,
    stage(stage) { stage.part('office').tipDesk(); stage.game.controller.setMode('office', { crouch: true }); },
  }),
};
void office;

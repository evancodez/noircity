import { NEUTRAL, mergePose, ANKLE_Y } from '../../enemies/HoodRig.js';
import victim from './victim.js';

// [C5] Ames, dead at his desk (chapter III, lane C5): the same thin man in
// the same rumpled suit as lane B1's victim (its costume, its wounds), sat in
// his swivel chair behind the desk and gone slack in it - slid down a little,
// the head dropped forward and over to his left (the face lost to the dark),
// the right arm hanging down beside the chair (the telephone was his), the
// left hand in his lap. He never moves: one clip, a still, no breath.
// The scene seats him: cast.spawn('ames', { at: { x, z }, yaw }) at the chair.
const A = ANKLE_Y;
// (the seat's top 0.495 m over the floor; the figure's own scale applied to it)
function slump(s) {
  const seat = 0.495 / s;
  return {
    hipsPos: [0.0, seat + 0.1, 0.06], hips: [-14, 4, 5],
    spine: [-6, 2, 4], chest: [4, 8, 9], neck: [24, -6, 8], head: [34, -18, 26], headLevel: [0], headRoot: [6, 0, 0],
    shoulderL: [0, 0, 6], shoulderR: [0, 0, -10],
    // (the right hand down by the chair's side, the fingers loose; the left in his lap)
    handTR: [-0.3, seat - 0.12, 0.12], elbowPoleR: [-1, 0.2, -0.4], handR: [-10, 0, -8],
    handTL: [0.06, seat + 0.13, 0.33], elbowPoleL: [1, -0.6, -0.2], handL: [40, 0, 40],
    footL: [0.17, A, 0.5], footR: [-0.12, A, 0.42], footRotL: [0, 14, 0], footRotR: [0, -6, 0],
    kneeL: [0.35, 0.2, 1], kneeR: [-0.2, 0.2, 1],
  };
}

export default {
  kind: 'ames', h: victim.h, name: 'ames',
  // (a copy: the costumes table names each kind's own)
  costume: { ...victim.costume, h: undefined, name: undefined },
  clips: {
    ames_slump: { duration: 4, loop: true, def: (ctx) => { const P = slump(ctx.s || 1); return { armSpace: 'root', pose: () => mergePose(NEUTRAL, P) }; } },
  },
  idle: 'ames_slump',
  onSpawn(c, fig) {
    // the two wounds in his shirt front, the blood soaked round them; no paper in his fist
    // (the victim's own onSpawn: a sock for a lost shoe and a paper in the hand are the alley's)
    const B = fig.bones;
    void B;
    victimWounds(c, fig);
    c.down = true;
    c.state = 'dead';
  },
};

// (the victim's wounds, as its own onSpawn lays them; the alley's shoe and paper left out)
function victimWounds(c, fig) {
  const run = victim.onSpawn;
  // a stand-in character for the victim's onSpawn, then the alley's things taken back off
  run(c, fig);
  const B = fig.bones;
  B.footL.scale.setScalar(1);
  for (const k of ['paper']) { const m = c.items.get(k); if (m && m.parent) m.parent.remove(m); c.items.delete(k); }
  // (the sock: a child of the left shin the victim's onSpawn added: away, the shoe is on)
  for (const ch of [...B.shinL.children]) if (ch.isMesh && ch.geometry && ch.geometry.type === 'SphereGeometry') B.shinL.remove(ch);
}

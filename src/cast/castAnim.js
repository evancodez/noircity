import { HoodAnimator, getClips, bake, bakeAdditive, chainKeys, DEATH_BACK } from '../enemies/HoodAnim.js';
import { NEUTRAL, mergePose, samplePoseKeys, ANKLE_Y } from '../enemies/HoodRig.js';
import { figureRig, figureGeometry } from './tailor.js';
import { COSTUMES, KIND_DEFS } from './costumes.js';
import { BR_DEFS } from './brawl/clips.js';
import { CAST_CLIPS } from './clips.js';

// The cast's clips (lane 6, P0.3): procedural poses on the Hood's joints,
// baked per costume (its own proportions: the IK knows his arm lengths)
// the way enemies/HoodAnim.js bakes the Hood's. A bank holds, per kind,
// the Hood's clips (walk, run, flinch, ...) and the cast's, baked the first
// time they are played. A clip that depends on the seat is named
// '<clip>@<seat>' ('sitEat@stool77': a stool whose top is 0.77 m above the
// floor; 'sitTalk@booth45').
// Poses are keyed like HoodAnim's: [pitch, yaw, roll] degrees per bone, arm
// targets (handT) in the figure's root space (metres, model units: the
// figure is scaled to its height after), the feet by IK.
// Timing (durations and marks) is data in src/cast/clips.js; these poses are
// authored to it.
const TAU = Math.PI * 2;
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const S = Math.sin, C = Math.cos;
const A = ANKLE_Y;
const P = (over) => mergePose(NEUTRAL, over);
// periodic noise from a few harmonics of the loop (no visible repeat inside it)
const wob = (t, T, k = 0) => 0.6 * S(TAU * t / T + k) + 0.3 * S(2 * TAU * t / T + 1.7 * k + 0.4) + 0.2 * S(3 * TAU * t / T + 2.3 * k + 1.1);
// a keyed pose, sampled
const keyed = (arr) => { const K = chainKeys(arr); return (t) => samplePoseKeys(K, t); };
// travel carried by the root (Figure.rootMotion): the pose is authored in
// the clip's start frame; the root's travel rm(t) = [x, z] is taken out of
// the hips, the feet and the hands' targets
function rooted(poseFn, rm) {
  return (t) => {
    const p = poseFn(t);
    const [x, z] = rm(t);
    const sub = (k) => { if (p[k]) p[k] = [p[k][0] - x, p[k][1], p[k][2] - z, ...p[k].slice(3)]; };
    for (const k of ['hipsPos', 'footL', 'footR', 'handTL', 'handTR']) sub(k);
    return p;
  };
}
const smooth = (x) => x * x * (3 - 2 * x);
const pw = (t, keys) => {   // piecewise smooth scalar: keys [[t, v], ...]
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) return lerp(keys[i - 1][1], keys[i][1], smooth((t - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0])));
  return keys[keys.length - 1][1];
};

// ---------------------------------------------------------------------------
// seats: a stool at the counter, a booth at its table (world metres above the
// floor: the counter's top 1.05 and front edge 0.6 ahead of a stool's centre;
// a booth table's top 0.75 and edge 0.4 ahead of the seat)
const SEAT = { stool: { top: 1.05, edge: 0.6, footY: 0.3, footZ: 0.36, fwd: 0.1 }, booth: { top: 0.75, edge: 0.4, footY: 0, footZ: 0.44, fwd: 0.02 } };
function seatOf(ctx, arg = 'stool77') {
  const type = arg.startsWith('booth') ? 'booth' : 'stool';
  const h = (parseInt(arg.replace(/\D/g, ''), 10) || (type === 'booth' ? 45 : 77)) / 100;
  const Z = SEAT[type], s = ctx.s;
  return { type, seat: h / s, top: Z.top / s, edge: Z.edge / s, footY: Z.footY / s, footZ: Z.footZ / s, fwd: Z.fwd / s };
}

// sitting: the pelvis on the seat, leaning `lean` deg toward the counter,
// the feet on the stool's rail or the floor
function sitBase(G, lean = 20, o = {}) {
  const wide = o.wide ?? 0.13;
  return {
    hipsPos: [0, G.seat + 0.125, G.fwd - 0.02],
    hips: [lean * 0.45, 0, 0],
    spine: [lean * 0.3, 0, 0],
    chest: [lean * 0.25, 0, 0],
    neck: [8, 0, 0], head: [-6, 0, 0], headRoot: [4, 0, 0], headLevel: [0.4],
    footL: [wide + 0.01, G.footY + A, G.footZ], footR: [-wide, G.footY + A, G.footZ - 0.05],
    footRotL: [G.type === 'stool' ? 12 : 0, 12, 0], footRotR: [G.type === 'stool' ? 16 : 0, 16, 0],
    kneeL: [0.25, 0.15, 1], kneeR: [-0.25, 0.15, 1],
  };
}
// forearms on the counter: the wrists on the top, the elbows out
const onCounter = (G, xl, xr, zl = 0.16, zr = 0.16) => ({
  handTL: [xl, G.top + 0.035, G.edge + zl], handTR: [xr, G.top + 0.035, G.edge + zr],
  elbowPoleL: [1, -0.7, -0.4], elbowPoleR: [-1, -0.7, -0.4], handL: [10, 0, 20], handR: [10, 0, -20],
});

const DEFS = {
  // ---- seated, and on top of it -------------------------------------------------------
  sit: (ctx, arg) => {
    const G = seatOf(ctx, arg);
    return { duration: 7, loop: true, armSpace: 'root', pose: (t) => {
      const b = wob(t, 7), w = wob(t, 7, 2);
      return P({ ...sitBase(G, 22), ...onCounter(G, 0.2 + 0.01 * w, -0.2, 0.1, 0.14 + 0.02 * b),
        chest: [5 + 1.2 * S(TAU * t / 3.5), 3 * w, 0], head: [-6 + 2 * b, 6 * w, 2 * b] });
    } };
  },
  // the brawler over his plate: hunched, elbows wide, the fork to his mouth
  sitEat: (ctx, arg) => {
    const G = seatOf(ctx, arg);
    return { duration: 4, loop: true, armSpace: 'root', pose: (t) => {
      // a bite at 1.6: the fork comes up 1.1 .. 1.6, goes back 1.6 .. 2.3
      const up = pw(t, [[0, 0], [1.1, 0], [1.6, 1], [1.9, 1], [2.4, 0], [4, 0]]);
      const chew = up > 0.5 ? 0 : S(TAU * t * 1.5) * (1 - sstep(2.4, 3.6, t)) * sstep(1.9, 2.4, t);
      const hunch = 30 - 6 * up;
      const base = sitBase(G, hunch, { wide: 0.15 });
      return P({ ...base,
        chest: [9 - 4 * up, 3 * up, 0], neck: [14 - 8 * up, 0, 0], head: [-4 + 6 * up + 2 * chew, -4 * up, 0], headLevel: [0.2],
        ...onCounter(G, 0.3, -0.28, 0.02, 0.04),
        handTR: [lerp(-0.26, -0.1, up), lerp(G.top + 0.05, G.top + 0.34, up), lerp(G.edge + 0.08, G.edge - 0.12, up)],
        elbowPoleR: [-1, lerp(-0.6, -0.9, up), -0.2], handR: [lerp(10, -60, up), 0, -20],
        shoulderL: [0, 0, -3], shoulderR: [0, 0, 3 - 4 * up],
      });
    } };
  },
  // the docker: the mug in both hands, the elbows on the counter, a sip at 1.8
  sitDrink: (ctx, arg) => {
    const G = seatOf(ctx, arg);
    return { duration: 4.6, loop: true, armSpace: 'root', pose: (t) => {
      const up = pw(t, [[0, 0], [1.3, 0], [1.8, 1], [2.3, 1], [2.9, 0], [4.6, 0]]);
      const my = lerp(G.top + 0.16, G.top + 0.42, up), mz = lerp(G.edge + 0.02, G.edge - 0.12, up);
      return P({ ...sitBase(G, 26 - 4 * up),
        neck: [10 - 4 * up, 0, 0], head: [-2 - 14 * up, 0, 0], headLevel: [0.2],
        handTL: [0.07, my, mz], handTR: [-0.07, my, mz], elbowPoleL: [1, -1, -0.2], elbowPoleR: [-1, -1, -0.2],
        handL: [-30 - 30 * up, 0, 60], handR: [-30 - 30 * up, 0, -60],
      });
    } };
  },
  // the old man behind his broadsheet: both hands up, the paper before his
  // face; a page turned at 4.5
  sitRead: (ctx, arg) => {
    const G = seatOf(ctx, arg);
    return { duration: 7, loop: true, armSpace: 'root', pose: (t) => {
      const turn = pw(t, [[0, 0], [4.3, 0], [4.7, 1], [5.2, 0], [7, 0]]);
      const b = wob(t, 7, 1);
      return P({ ...sitBase(G, 14),
        spine: [4, 0, 0], chest: [10, 0, 0], neck: [22, 0, 0], head: [-8 + 3 * b, 4 * b, 0], headLevel: [0.1],
        handTL: [0.27, G.seat + 0.6 + 0.006 * b, 0.35], handTR: [lerp(-0.27, 0.02, turn), G.seat + 0.6 + 0.05 * turn, lerp(0.35, 0.42, turn)],
        elbowPoleL: [1, -1, -0.3], elbowPoleR: [-1, -1, -0.3], handL: [-70, 0, 70], handR: [-70, 0, -70],
      });
    } };
  },
  // her cigarette: the elbow on the table, the holder up by her face; a drag at 1.5
  sitSmoke: (ctx, arg) => {
    const G = seatOf(ctx, arg);
    return { duration: 5, loop: true, armSpace: 'root', pose: (t) => {
      const d = pw(t, [[0, 0], [1.1, 0], [1.5, 1], [1.9, 1], [2.4, 0], [5, 0]]);
      return P({ ...sitBase(G, 8),
        head: [-8 - 4 * d, 8, 4], headLevel: [0.3],
        handTL: [0.14, G.top + 0.04, G.edge + 0.08], elbowPoleL: [1, -0.6, -0.4],
        handTR: [lerp(-0.12, -0.05, d), lerp(G.top + 0.3, G.top + 0.42, d), lerp(G.edge + 0.05, G.edge - 0.05, d)], elbowPoleR: [-0.6, -1, 0.2],
        handR: [-50, 0, -40],
        footL: [0.02, A, G.footZ + 0.02], footR: [-0.06, A + 0.04, G.footZ + 0.1], kneeL: [0, 0.2, 1], kneeR: [-0.1, 0.4, 1],
      });
    } };
  },
  // talking across a booth table: leaning in, a hand that speaks, the head
  // turning to the other one
  sitTalk: (ctx, arg) => {
    const G = seatOf(ctx, arg);
    return { duration: 6, loop: true, armSpace: 'root', pose: (t) => {
      const g = wob(t, 6, 0.5), h = wob(t, 6, 2.1);
      return P({ ...sitBase(G, 16 + 3 * h),
        head: [-6 + 4 * g, 6 * h, 3 * g], headLevel: [0.3], chest: [6, 4 * g, 0],
        handTL: [0.18, G.top + 0.035, G.edge + 0.1], elbowPoleL: [1, -0.6, -0.4],
        handTR: [-0.16 + 0.03 * g, G.top + 0.12 + 0.07 * (0.5 + 0.5 * h), G.edge + 0.12], elbowPoleR: [-1, -0.8, -0.2],
        handR: [-20 + 15 * g, 0, -30],
      });
    } };
  },

  // ---- standing ------------------------------------------------------------------------------
  // the old man reading on his feet (the study), bent
  read: () => ({ duration: 7, loop: true, armSpace: 'root', pose: (t) => {
    const b = wob(t, 7, 1);
    return P({ ...BENT(t), handTL: [0.27, 1.42 + 0.006 * b, 0.35], handTR: [-0.27, 1.42, 0.35],
      elbowPoleL: [1, -1, -0.3], elbowPoleR: [-1, -1, -0.3], handL: [-70, 0, 70], handR: [-70, 0, -70], neck: [24, 0, 0], head: [-10 + 3 * b, 4 * b, 0] });
  } }),
  // the waitress at the back bar: her hip against it, arms folded, weight on
  // one leg, the other ankle crossed
  lean: () => ({ duration: 9, loop: true, armSpace: 'root', pose: (t) => {
    const b = S(TAU * t / 4.5), w = wob(t, 9, 1);
    return P({
      hipsPos: [0.03, 0.935, -0.06], hips: [-4, 8, -7], spine: [4, -4, 3], chest: [-2 - 1 * b, -4, 3], neck: [6, 0, 0],
      head: [-4 + 2 * w, 10 * w, -3], headLevel: [0.5], headRoot: [2, 0, 0],
      footL: [0.07, A, 0.07], footR: [-0.02, A + 0.01, 0.13], footRotL: [0, 14, 0], footRotR: [8, -10, 0], kneeR: [0.2, 0, 1], kneeL: [0.1, 0, 1],
      handTL: [-0.1, 1.18 + 0.004 * b, 0.13], handTR: [0.1, 1.16 + 0.004 * b, 0.15], elbowPoleL: [1, -0.4, 0.3], elbowPoleR: [-1, -0.4, 0.3],
      handL: [0, 90, 0], handR: [0, -90, 0],
    });
  } }),
  // the brawler's own stance: feet wide, arms off his belly, chest out
  idleBrawler: () => ({ duration: 8, loop: true, pose: (t) => {
    const b = S(TAU * t / 4), w = wob(t, 8), v = wob(t, 8, 2);
    return P({
      hipsPos: [0.02 * w, 0.95, -0.01], hips: [0, 3 * w, 2 * w], spine: [2, -1 * w, -1 * w], chest: [-4 - 1.5 * b, 0, 0],
      neck: [14, 5 * v, 0], head: [-6, 10 * v, 1.5 * w], headLevel: [0.2],
      armL: [0.36, -1, 0.1, 0], armR: [-0.36, -1, 0.14, 0], elbowL: [22 + 3 * b], elbowR: [26], handL: [0, 0, 10], handR: [0, 0, -10],
      shoulderL: [0, 0, 1 * b], shoulderR: [0, 0, -1 * b],
      footL: [0.17, A, 0.04], footR: [-0.17, A, -0.03], footRotL: [0, 14, 0], footRotR: [0, 16, 0],
    });
  } }),
  idleWaitress: () => ({ duration: 8, loop: true, armSpace: 'root', pose: (t) => {
    const b = S(TAU * t / 4), w = wob(t, 8);
    return P({
      hipsPos: [0.025, 0.95, 0], hips: [0, 4, -5 + w], spine: [3, -2, 3], chest: [-2 - 1 * b, 0, 2], head: [-4, 8 * w, -2], headLevel: [0.4],
      handTL: [0.12, 0.95, 0.1], handTR: [-0.08, 0.95, 0.12], elbowPoleL: [1, 0, -0.5], elbowPoleR: [-1, 0, -0.5], handL: [0, 40, 0], handR: [0, -40, 0],
      footL: [0.06, A, 0.05], footR: [-0.1, A, -0.02], footRotL: [0, 20, 0], footRotR: [0, 8, 0], kneeL: [0.3, 0, 1],
    });
  } }),
  idleOld: () => ({ duration: 8, loop: true, pose: (t) => BENTP(t) }),
  // the cook in his hatch: both hands on the sill, leaning out a little
  hatch: () => ({ duration: 8, loop: true, armSpace: 'root', pose: (t) => {
    const w = wob(t, 8), b = S(TAU * t / 4);
    return P({ hipsPos: [0, 0.95, -0.03], hips: [6, 0, 0], spine: [8, 3 * w, 0], chest: [8 - b, 0, 0], neck: [6, 0, 0], head: [-6, 12 * w, 0], headLevel: [0.3],
      handTL: [0.3, 1.2, 0.34], handTR: [-0.3, 1.2, 0.34], elbowPoleL: [1, -0.3, -0.5], elbowPoleR: [-1, -0.3, -0.5], handL: [60, 0, 0], handR: [60, 0, 0] });
  } }),
  // the docker's back against the wall, hands in the coat's pockets, watching
  watch: () => ({ duration: 8, loop: true, armSpace: 'root', pose: (t) => {
    const b = S(TAU * t / 3.6);
    return P({ hipsPos: [0, 0.94, 0.04], hips: [-6, 0, 0], spine: [-2, 0, 0], chest: [-4 - b, 0, 0], neck: [12, 0, 0], head: [-6, 0, 0],
      handTL: [0.2, 0.9, 0.1], handTR: [-0.2, 0.9, 0.1], elbowPoleL: [1, 0, -0.6], elbowPoleR: [-1, 0, -0.6],
      footL: [0.14, A, 0.2], footR: [-0.14, A, 0.24] });
  } }),
};

// the old man's stoop
function BENT(t) {
  const b = S(TAU * t / 4.4), w = wob(t, 8.8);
  return { hipsPos: [0, 0.925, -0.04], hips: [8, 2 * w, 0], spine: [16, 0, 0], chest: [12 - b, 0, 0], neck: [26, 3 * w, 0], head: [-26, 8 * w, 0], headLevel: [0.35], headRoot: [4, 0, 0],
    footL: [0.1, A, 0.06], footR: [-0.1, A, -0.02], kneeL: [0.1, 0, 1], kneeR: [-0.1, 0, 1] };
}
const BENTP = (t) => P({ ...BENT(t), armL: [0.14, -1, 0.3, 0], armR: [-0.14, -1, 0.32, 0], elbowL: [30], elbowR: [34] });

// ---- one-shots -----------------------------------------------------------------------------
Object.assign(DEFS, {
  // the brawler at the counter: stops eating, the fork down, the shoulders
  // come round (his head is turned by Character.notice: it follows the eye)
  notice: (ctx, arg) => {
    const G = seatOf(ctx, arg);
    return { duration: 2.0, armSpace: 'root', pose: (t) => {
      const k = sstep(0, 0.9, t);
      return P({ ...sitBase(G, lerp(30, 20, k), { wide: 0.15 }), ...onCounter(G, 0.3, -0.26, 0.02, lerp(0.04, 0.12, k)),
        chest: [lerp(9, 2, k), lerp(0, 14, k), 0], spine: [8, lerp(0, 8, k), 0], neck: [lerp(14, 6, k), 0, 0], head: [-4, 0, 0], headLevel: [0.2] });
    } };
  },
  // he stands off the stool (it goes over behind him at 0.7), squares up
  rise: (ctx, arg) => {
    const G = seatOf(ctx, arg);
    const sit = { ...sitBase(G, 20, { wide: 0.15 }), ...onCounter(G, 0.3, -0.26, 0.02, 0.1), chest: [2, 14, 0], spine: [8, 8, 0] };
    const rm = (t) => [0, -0.34 * sstep(0.35, 1.1, t)];
    const K = keyed([
      [0, sit],
      [0.35, { hipsPos: [0, G.seat + 0.16, G.fwd + 0.02], hips: [26, 0, 0], spine: [14, 6, 0], chest: [10, 10, 0],
        handTL: [0.3, G.top + 0.04, G.edge + 0.02], handTR: [-0.28, G.top + 0.04, G.edge + 0.04], footL: [0.15, A, 0.22], footR: [-0.15, A, 0.12], footRotL: [0, 14, 0], footRotR: [0, 16, 0] }],
      [0.7, { hipsPos: [0, 0.84, -0.2], hips: [10, 0, 0], spine: [4, 4, 0], chest: [0, 6, 0], neck: [12, 0, 0],
        handTL: [0.3, 0.98, 0.14], handTR: [-0.3, 0.98, 0.1], elbowPoleL: [1, -0.3, -0.6], elbowPoleR: [-1, -0.3, -0.6], footL: [0.16, A, 0.02], footR: [-0.16, A, -0.1] }],
      [1.1, { hipsPos: [0, 0.94, -0.34], hips: [0, 0, 0], spine: [2, 0, 0], chest: [-4, 0, 0], neck: [14, 0, 0], head: [-6, 0, 0],
        handTL: [0.34, 0.86, -0.25], handTR: [-0.34, 0.86, -0.28], footL: [0.17, A, -0.32], footR: [-0.17, A, -0.38] }],
      [1.6, { hipsPos: [0, 0.95, -0.34], chest: [-5, 0, 0], handTL: [0.36, 0.88, -0.28], handTR: [-0.36, 0.88, -0.31] }],
    ]);
    return { duration: 1.6, armSpace: 'root', pose: rooted(K, rm), rootMotion: rm };
  },
  // the waitress sets a thing down on the counter before her (down 0.8)
  serve: () => ({ duration: 1.2, armSpace: 'root', pose: keyed([
    [0, { hipsPos: [0, 0.95, 0], chest: [-2, 0, 0], handTR: [-0.16, 1.0, 0.2], elbowPoleR: [-1, -0.5, -0.4], handTL: [0.18, 0.92, 0.05] }],
    [0.5, { hips: [4, 0, 0], spine: [10, 0, 0], chest: [8, -6, 0], handTR: [-0.1, 1.18, 0.42], handR: [-40, 0, 0] }],
    [0.8, { spine: [14, 0, 0], chest: [10, -8, 0], handTR: [-0.08, 1.14, 0.5], handR: [-60, 0, 0] }],
    [1.2, { hips: [0, 0, 0], spine: [3, 0, 0], chest: [-2, 0, 0], handTR: [-0.16, 1.0, 0.2], handR: [-40, 0, -4] }],
  ]) }),
  // the pour (lane 7's marks: take, uncork, streamOn, streamOff): she turns
  // to the back bar, takes the bottle, back to the counter, draws the cork,
  // tilts it over the glass, rights it
  pour: () => {
    // (quick, as a waitress with a room to serve is: the turn and a step
    // back to the bar 0 .. 0.45, the bottle in hand at 0.5, back at the
    // counter by 0.85, the cork out at 0.9, the tilt, the stream 1.3 .. 2.6,
    // righted and corked by 3.2)
    const rm = (t) => [0, -0.55 * pw(t, [[0, 0], [0.4, 1], [0.55, 1], [0.9, 0]])];
    const K = keyed([
      [0, { hipsPos: [0, 0.95, 0], handTR: [-0.18, 0.96, 0.15], handTL: [0.18, 0.94, 0.08] }],
      [0.4, { rootYaw: [-160], hipsPos: [0, 0.94, -0.55], footL: [0.1, A, -0.5], footR: [-0.12, A, -0.62], handTR: [-0.05, 1.1, -0.95], elbowPoleR: [-1, -0.3, 0.3], chest: [8, 0, 0] }],
      [0.5, { handTR: [0.02, 1.18, -1.02], chest: [10, 0, 0] }],
      [0.9, { rootYaw: [0], hipsPos: [0, 0.95, 0], footL: [0.12, A, 0.04], footR: [-0.12, A, -0.02], handTR: [-0.12, 1.2, 0.3], chest: [2, 0, 0], elbowPoleR: [-1, -0.5, -0.4],
        handTL: [-0.02, 1.26, 0.32], elbowPoleL: [1, -0.5, -0.2] }],
      [1.05, { handTL: [0.16, 1.12, 0.2], handTR: [-0.08, 1.24, 0.34] }],
      // (the bottle round its body, tipped 100 degrees, its mouth over the glass)
      [1.3, { spine: [10, 0, 0], chest: [10, 8, 0], handTR: [-0.1, 1.34, 0.5], handR: [-80, 0, 0] }],
      [2.6, { handTR: [-0.08, 1.32, 0.52], handR: [-84, 0, 0] }],
      [2.85, { handTR: [-0.08, 1.24, 0.4], handR: [-40, 0, 0], chest: [4, 0, 0], spine: [4, 0, 0], handTL: [-0.02, 1.2, 0.36] }],
      [3.2, { handTR: [-0.16, 1.02, 0.2], handTL: [0.18, 0.94, 0.08] }],
    ]);
    return { duration: 3.2, armSpace: 'root', pose: rooted(K, rm), rootMotion: rm };
  },
  // she slides the glass across the counter to his hand (release 0.6)
  slide: () => ({ duration: 1.2, armSpace: 'root', pose: keyed([
    [0, { handTR: [-0.16, 1.02, 0.2], elbowPoleR: [-1, -0.5, -0.4] }],
    [0.3, { spine: [12, 0, 0], chest: [8, 0, 0], handTR: [-0.06, 1.17, 0.38], handR: [-70, 0, 0] }],
    [0.6, { spine: [22, 0, 0], chest: [12, 6, 0], hipsPos: [0, 0.93, 0.04], handTR: [0.0, 1.16, 0.74], handR: [-80, 0, 0] }],
    [0.8, { handTR: [0.0, 1.2, 0.66] }],
    [1.2, { spine: [3, 0, 0], chest: [-2, 0, 0], hipsPos: [0, 0.95, 0], handTR: [-0.16, 1.02, 0.2], handR: [-40, 0, -4] }],
  ]) }),
  // in the fight: a bottle sent down the counter (release 0.5)
  slideBottle: () => ({ duration: 1.0, armSpace: 'root', pose: keyed([
    [0, { handTR: [-0.16, 1.02, 0.2] }],
    [0.25, { chest: [6, -20, 0], handTR: [-0.3, 1.16, 0.3], handR: [-60, 0, 0] }],
    [0.5, { chest: [8, 25, 0], spine: [10, 8, 0], handTR: [0.2, 1.16, 0.5], handR: [-70, 0, 0] }],
    [1.0, { chest: [-2, 0, 0], spine: [3, 0, 0], handTR: [-0.16, 1.02, 0.2], handR: [-40, 0, -4] }],
  ]) }),
  // wiping the counter: slow circles with the cloth
  wipe: () => ({ duration: 2.4, loop: true, armSpace: 'root', pose: (t) => {
    const a = TAU * t / 2.4;
    return P({ hipsPos: [0, 0.94, 0.02], hips: [6, 0, 0], spine: [14, 0, 0], chest: [10, 5 * S(a), 0], neck: [4, 0, 0], head: [-10, -5, 0], headLevel: [0.3],
      handTR: [-0.08 + 0.12 * C(a), 1.14, 0.48 + 0.08 * S(a)], elbowPoleR: [-1, -0.4, -0.3], handR: [-80, 0, 0],
      handTL: [0.2, 1.15, 0.38], elbowPoleL: [1, -0.6, -0.3], handL: [-80, 0, 0], footR: [-0.14, A, -0.1] });
  } }),
  // down behind the counter, a hand up over the head (held)
  duck: () => ({ duration: 0.6, armSpace: 'root', pose: keyed([
    [0, { hipsPos: [0, 0.95, 0] }],
    [0.25, { hipsPos: [0, 0.72, -0.05], hips: [20, 0, 0], spine: [20, 0, 0], chest: [14, 0, 0], footL: [0.12, A, 0.14], footR: [-0.12, A, -0.12], footRotR: [-30, 8, 0] }],
    [0.6, { hipsPos: [0, 0.42, -0.1], hips: [34, 0, 0], spine: [26, 0, 0], chest: [20, 0, 0], neck: [20, 0, 0], head: [10, 0, 0],
      footL: [0.13, A, 0.16], footR: [-0.13, 0.1, -0.22], footRotR: [-50, 8, 0], kneeL: [0.3, 0.2, 1], kneeR: [-0.2, -0.2, 1],
      handTR: [-0.04, 1.02, 0.12], elbowPoleR: [-1, 0.5, 0.3], handTL: [0.16, 0.6, 0.32], elbowPoleL: [1, -0.5, 0] }],
  ]) }),
  // the cook rings the bell (ring 0.4)
  ring: () => ({ duration: 1.0, armSpace: 'root', pose: keyed([
    [0, { hipsPos: [0, 0.95, -0.03], hips: [6, 0, 0], spine: [8, 0, 0], chest: [8, 0, 0], handTL: [0.3, 1.2, 0.34], handTR: [-0.3, 1.2, 0.34], elbowPoleL: [1, -0.3, -0.5], elbowPoleR: [-1, -0.3, -0.5], handL: [60, 0, 0], handR: [60, 0, 0] }],
    [0.28, { handTR: [-0.2, 1.4, 0.42], chest: [8, 6, 0] }],
    [0.4, { handTR: [-0.2, 1.22, 0.46], handR: [80, 0, 0] }],
    [0.55, { handTR: [-0.22, 1.3, 0.44] }],
    [1.0, { handTR: [-0.3, 1.2, 0.34], chest: [8, 0, 0], handR: [60, 0, 0] }],
  ]) }),
  // ... and slides a plate onto the shelf (down 0.9)
  plateUp: () => ({ duration: 1.4, armSpace: 'root', pose: keyed([
    [0, { hipsPos: [0, 0.95, -0.03], hips: [6, 0, 0], spine: [8, 0, 0], chest: [8, 0, 0], handTL: [0.3, 1.2, 0.34], handTR: [-0.3, 1.2, 0.34], elbowPoleL: [1, -0.3, -0.5], elbowPoleR: [-1, -0.3, -0.5], handL: [60, 0, 0], handR: [60, 0, 0] }],
    [0.4, { handTR: [-0.2, 1.05, 0.12], chest: [0, -20, 0], spine: [2, -10, 0] }],
    [0.9, { handTR: [-0.08, 1.24, 0.5], chest: [12, 0, 0], spine: [12, 0, 0], handR: [-70, 0, 0] }],
    [1.4, { handTR: [-0.3, 1.2, 0.34], chest: [8, 0, 0], spine: [8, 0, 0], handR: [60, 0, 0] }],
  ]) }),
  // the old man down under it all, on his knees, arms over his head (held)
  cower: () => ({ duration: 1.0, armSpace: 'root', pose: keyed([
    [0, { ...BENT(0), armL: [0.14, -1, 0.3, 0], armR: [-0.14, -1, 0.32, 0] }],
    [0.3, { hipsPos: [0, 0.7, 0.02], hips: [20, 0, 0], footL: [0.12, A, 0.12], footR: [-0.12, A + 0.04, -0.18], footRotR: [-40, 8, 0],
      handTL: [0.1, 1.45, 0.2], handTR: [-0.1, 1.45, 0.2], elbowPoleL: [1, 0.3, 0.4], elbowPoleR: [-1, 0.3, 0.4] }],
    [0.6, { hipsPos: [0, 0.4, -0.12], hips: [62, 0, 0], spine: [22, 0, 0], chest: [16, 0, 0], neck: [24, 0, 0], head: [20, 0, 0],
      footL: [0.13, 0.08, -0.34], footR: [-0.13, 0.08, -0.36], footRotL: [-150, 6, 0], footRotR: [-150, 6, 0], kneeL: [0.1, -0.2, 1], kneeR: [-0.1, -0.2, 1],
      handTL: [0.05, 0.62, 0.52], handTR: [-0.05, 0.64, 0.5], elbowPoleL: [1, 0.2, 0.3], elbowPoleR: [-1, 0.2, 0.3], handL: [0, 0, 60], handR: [0, 0, -60] }],
    [1.0, { hipsPos: [0, 0.38, -0.13], chest: [18, 0, 0] }],
  ]) }),
  // flight: an overlay on the run: he leads her by the arm, she is led
  fleeLead: () => ({ duration: 0.72, loop: true, armSpace: 'root', pose: (t) => P({ chest: [8, -14, 0], spine: [6, -6, 0], head: [0, -20, 0],
    handTR: [-0.36, 1.0, -0.36], elbowPoleR: [-1, 0, 0.2], armL: [0.2, -0.8, 0.5 * S(TAU * t / 0.72), 0], elbowL: [70] }) }),
  fleeLed: () => ({ duration: 0.72, loop: true, armSpace: 'root', pose: (t) => P({ chest: [10, 12, 0], spine: [8, 6, 0], head: [-4, 10, 0],
    handTL: [0.3, 1.1, 0.45], elbowPoleL: [1, -0.3, -0.4], armR: [-0.2, -0.85, 0.4 * S(TAU * t / 0.72 + 1), 0], elbowR: [70], handR: [-40, 0, 0] }) }),
  // a pot (or a bottle, a plate) carried level before her on the walk, the
  // free hand out from her side
  carry: () => ({ duration: 1.1, loop: true, armSpace: 'root', pose: (t) => {
    const c = C(TAU * t / 1.1);
    return P({ chest: [-2, 3 * c, 0], handTR: [-0.2, 1.08 + 0.006 * c, 0.3], elbowPoleR: [-1, -0.8, -0.3], handR: [-80, 0, -10],
      handTL: [0.3, 0.9, 0.06 + 0.06 * c], elbowPoleL: [1, 0, -0.5], handL: [0, 0, 30] });
  } }),
});

// ---- the brawler's fight (CONTRACTS §14): every attack's tell reads in
// silhouette in its first 0.2 s; each tell runs at least 0.3 s before its
// contact. Root space; he faces +z, the eye 1.45 m ahead.
// The guard (fix round, B4): upright, chin down, the fists at cheek height
// either side of the jaw (the wrists under them, the forearms up), the
// elbows in front of the ribs, the left foot and the left shoulder forward:
// the most dangerous shape in the game, not a man hugging his belly.
const GUARD = {
  hipsPos: [0, 0.93, -0.04], hips: [0, -18, 0], spine: [-1, -5, 0], chest: [-4, -5, 0], neck: [8, 6, 0], head: [10, 12, 0], headLevel: [0.4], headRoot: [2, 0, 0],
  footL: [0.14, A, 0.22], footR: [-0.18, A, -0.22], footRotL: [0, 12, 0], footRotR: [0, 32, 0], kneeL: [0.3, 0, 1], kneeR: [-0.2, 0, 1],
  handTL: [0.155, 1.44, 0.25], handTR: [-0.13, 1.41, 0.19], elbowPoleL: [0.35, -1, 0.7], elbowPoleR: [-0.35, -1, 0.7],
  handL: [-15, -60, 10], handR: [-15, 60, -10], shoulderL: [0, 0, 4], shoulderR: [0, 0, -4],
};
const guardAt = (t) => {
  const w = S(TAU * t / 1.2), b = S(TAU * t / 0.6), v = wob(t, 2.4, 1);
  return { hipsPos: [0.028 * w, 0.93 + 0.008 * b, -0.04], hips: [0, -18 + 3 * w, -2 * w], chest: [-4 + b, -5 - 2 * w, 2 * w],
    handTL: [0.155 + 0.01 * v, 1.44 + 0.012 * b, 0.25], handTR: [-0.13, 1.41 + 0.01 * b, 0.19 + 0.01 * v], head: [10, 12 + 3 * w, 0] };
};
const fight = (dur, keys, rm = null) => {
  const K = keyed([[0, GUARD], ...keys]);
  return () => ({ duration: dur, armSpace: 'root', pose: rm ? rooted(K, rm) : K, rootMotion: rm });
};
Object.assign(DEFS, {
  br_guard: () => ({ duration: 2.4, loop: true, armSpace: 'root', pose: (t) => P({ ...GUARD, ...guardAt(t) }) }),
  // the left shoulder dips, the left fist flicks out straight
  br_jab: fight(0.7, [
    [0.2, { chest: [8, 4, -10], shoulderL: [0, 0, -8], handTL: [0.14, 1.14, 0.26], elbowPoleL: [1, -1.4, 0], hipsPos: [0, 0.89, -0.07] }],
    [0.3, { chest: [6, -14, -4], hips: [4, -22, 0], handTL: [0.12, 1.3, 0.42], footL: [0.14, A, 0.3] }],
    [0.38, { chest: [4, -24, 0], spine: [8, -8, 0], hipsPos: [0, 0.9, 0.04], handTL: [0.03, 1.46, 0.76], handL: [-80, 0, 30], elbowPoleL: [1, -0.4, 0], shoulderL: [0, 12, 0] }],
    [0.5, { handTL: [0.05, 1.42, 0.7] }],
    [0.7, { ...GUARD }],
  ]),
  // the right shoulder drops and the right elbow goes back and out past his
  // body's line (it breaks the outline), then the fist comes round wide at
  // head height
  br_hook: fight(1.0, [
    [0.18, { chest: [8, -18, 10], shoulderR: [0, 0, 10], handTR: [-0.34, 1.24, 0.08], elbowPoleR: [-1, -0.1, -1] }],
    [0.3, { chest: [8, -30, 8], hips: [4, -24, 0], spine: [8, -10, 0], handTR: [-0.4, 1.3, 0.02], elbowPoleR: [-1, 0.1, -1], hipsPos: [0, 0.88, -0.08] }],
    [0.48, { chest: [6, -38, 4], handTR: [-0.46, 1.42, 0.02], elbowPoleR: [-1, 0.3, -0.7] }],
    [0.62, { chest: [6, 30, -4], hips: [4, 12, 0], spine: [8, 10, 0], hipsPos: [0, 0.9, 0.04], handTR: [0.04, 1.5, 0.6], elbowPoleR: [-1, 0.6, 0.1], handR: [-60, 0, 60], footRotR: [-20, 10, 0] }],
    [0.8, { chest: [8, 42, -4], handTR: [0.26, 1.42, 0.4], elbowPoleR: [-0.3, 0.3, 1] }],
    [1.0, { ...GUARD }],
  ]),
  // both hands up and back over the right shoulder, the whole body wound to
  // his right, he steps in; the blow comes down overhand
  br_haymaker: fight(1.4, [
    [0.2, { chest: [-6, -34, 8], spine: [-4, -14, 0], hips: [0, -26, 0], handTR: [-0.3, 1.52, -0.2], handTL: [-0.1, 1.5, -0.04], elbowPoleR: [-0.7, 0.4, 0.6], elbowPoleL: [0.4, 0.1, 1], neck: [8, 0, 0], head: [-10, 20, 0] }],
    [0.4, { chest: [-10, -44, 10], spine: [-6, -16, 0], handTR: [-0.34, 1.58, -0.3], handTL: [-0.16, 1.56, -0.14], hipsPos: [0, 0.92, -0.1] }],
    [0.7, { hipsPos: [0, 0.9, 0.12], footL: [0.14, A, 0.5], footRotL: [0, 10, 0], chest: [-12, -46, 10], handTR: [-0.34, 1.6, -0.32] }],
    [0.95, { hipsPos: [0, 0.84, 0.3], hips: [16, 14, 0], spine: [16, 10, 0], chest: [18, 26, -6], neck: [22, 0, 0], head: [6, 0, 0],
      handTR: [0.04, 1.34, 0.86], elbowPoleR: [-1, 1, 0.3], handR: [-80, 0, 20], handTL: [0.28, 1.0, 0.34], elbowPoleL: [1, -0.5, -0.3], footR: [-0.16, A, -0.02], footRotR: [-25, 20, 0] }],
    [1.15, { hipsPos: [0, 0.82, 0.3], chest: [24, 30, -6], handTR: [0.16, 1.02, 0.7] }],
    [1.4, { ...GUARD }],
  ], (t) => [0, 0.3 * sstep(0.45, 0.95, t) - 0.3 * sstep(1.15, 1.4, t)]),
  // he snatches a bottle off the counter at his right (take 0.35), breaks it
  // on the edge (break 0.75), holds the neck low and out to the side, then
  // thrusts (contact 1.6)
  br_bottle: fight(2.0, [
    [0.2, { hips: [8, -60, 0], chest: [14, -24, 0], spine: [10, -10, 0], handTR: [-0.62, 1.08, 0.12], elbowPoleR: [-1, -0.6, 0.3], handR: [-60, 0, 0], footR: [-0.34, A, -0.08] }],
    [0.35, { handTR: [-0.72, 1.02, 0.18], chest: [18, -28, 0] }],
    [0.55, { hips: [4, -40, 0], chest: [-4, -20, 10], handTR: [-0.3, 1.56, 0.02], elbowPoleR: [-1, 0.2, -0.3], handR: [30, 0, 0], head: [-6, -20, 0] }],
    [0.75, { hips: [10, -60, 0], chest: [22, -30, -4], spine: [12, -12, 0], handTR: [-0.68, 1.02, 0.2], elbowPoleR: [-1, 0.2, 0.3], handR: [-50, 0, 0] }],
    [1.0, { hips: [4, -16, 0], chest: [8, -6, 0], spine: [8, -4, 0], footR: [-0.2, A, -0.24], handTR: [-0.44, 0.98, 0.24], elbowPoleR: [-1, -0.6, -0.2], handR: [-20, 0, -30], head: [-2, 10, 0] }],
    [1.3, { chest: [6, -22, 2], handTR: [-0.4, 1.02, -0.06], hipsPos: [0, 0.88, -0.1] }],
    [1.6, { hipsPos: [0, 0.86, 0.14], hips: [8, 14, 0], chest: [12, 24, 0], spine: [10, 8, 0], handTR: [-0.02, 1.18, 0.84], elbowPoleR: [-1, -0.3, 0], handR: [-80, 0, 0], footL: [0.14, A, 0.38] }],
    [1.75, { handTR: [0.0, 1.16, 0.8] }],
    [2.0, { ...GUARD, handTR: [-0.22, 1.08, 0.22] }],
  ], (t) => [-0.38 * pw(t, [[0, 0], [0.3, 1], [0.8, 1], [1.1, 0]]), 0]),
  // the thrust alone (the neck already in his right fist, held low): the
  // jagged glass drawn back beside the shoulder, the body wound to his
  // right (the tell, readable at once), then driven straight at my chest
  // (contact 0.45) with the left foot stepping in; back to the low hold
  br_bottle_thrust: fight(0.9, [
    [0.14, { hips: [4, -24, 0], chest: [6, -26, 4], spine: [6, -8, 0], handTR: [-0.4, 1.3, -0.06], elbowPoleR: [-1, -0.2, -0.5], handR: [-40, 0, 0], hipsPos: [0, 0.9, -0.1] }],
    [0.3, { chest: [4, -32, 6], hips: [4, -28, 0], handTR: [-0.42, 1.28, -0.12], hipsPos: [0, 0.89, -0.12] }],
    [0.45, { hipsPos: [0, 0.86, 0.14], hips: [8, 14, 0], chest: [12, 24, 0], spine: [10, 8, 0], handTR: [-0.02, 1.18, 0.84], elbowPoleR: [-1, -0.3, 0], handR: [-80, 0, 0], footL: [0.14, A, 0.38] }],
    [0.58, { handTR: [0.0, 1.16, 0.8] }],
    [0.9, { ...GUARD, handTR: [-0.22, 1.08, 0.22], handR: [-20, 0, -10] }],
  ], (t) => [0, 0.14 * sstep(0.3, 0.45, t) - 0.14 * sstep(0.6, 0.9, t)]),
  // hit reactions: where and how hard
  br_hitHeadL: fight(0.4, [
    [0.06, { neck: [4, -18, -12], head: [-16, -38, -18], chest: [2, -16, 6], handTL: [0.22, 1.1, 0.3], hipsPos: [-0.03, 0.9, -0.08] }],
    [0.18, { neck: [6, -14, -10], head: [-10, -30, -12], chest: [4, -18, 6] }],
    [0.4, { ...GUARD }],
  ]),
  br_hitHeadR: fight(0.4, [
    [0.06, { neck: [4, 24, 12], head: [-16, 44, 18], chest: [2, 10, -6], handTR: [-0.26, 1.08, 0.2], hipsPos: [0.03, 0.9, -0.08] }],
    [0.18, { neck: [6, 18, 10], head: [-10, 34, 12], chest: [4, 8, -6] }],
    [0.4, { ...GUARD }],
  ]),
  // he folds over the blow
  br_hitBody: fight(0.5, [
    [0.08, { hipsPos: [0, 0.84, -0.12], hips: [20, -10, 0], spine: [24, 0, 0], chest: [18, 0, 0], neck: [24, 0, 0], head: [8, 0, 0],
      handTL: [0.08, 1.0, 0.2], handTR: [-0.1, 0.98, 0.2], elbowPoleL: [1, -0.4, 0.3], elbowPoleR: [-1, -0.4, 0.3] }],
    [0.22, { hipsPos: [0, 0.85, -0.12], spine: [20, 0, 0] }],
    [0.5, { ...GUARD }],
  ]),
  // the opening: arms drop, he sways on his heels
  br_stun: () => ({ duration: 1.3, armSpace: 'root', pose: keyed([
    [0, GUARD],
    [0.15, { hipsPos: [0, 0.92, -0.1], hips: [-6, -10, 0], chest: [-8, 0, 0], neck: [4, 0, 0], head: [-18, 6, 8],
      handTL: [0.3, 0.9, 0.08], handTR: [-0.3, 0.9, 0.04], elbowPoleL: [1, 0, -0.5], elbowPoleR: [-1, 0, -0.5], handL: [0, 0, 20], handR: [0, 0, -20] }],
    [0.5, { hipsPos: [0.04, 0.93, -0.13], hips: [-8, -6, 4], chest: [-10, 4, -4], head: [-22, -8, -10], handTL: [0.32, 0.88, 0.02] }],
    [0.85, { hipsPos: [-0.04, 0.92, -0.08], hips: [-4, -14, -4], chest: [-6, -4, 6], head: [-14, 10, 12], handTR: [-0.32, 0.9, 0.08] }],
    [1.3, { ...GUARD }],
  ]) }),
});

// thrown into the room (backwards, by a heavy hit: lane 7 turns his back to
// the thing first): into the stools (he goes down with them and gets up
// off one knee), into the jukebox (his head goes back against its arch),
// into the pie case
Object.assign(DEFS, {
  br_into_stools: () => {
    const rm = (t) => [0, -1.1 * sstep(0, 0.55, t) - 0.25 * sstep(0.5, 0.9, t) + 0.35 * sstep(1.4, 2.2, t)];
    const K = keyed([
      [0, GUARD],
      [0.2, { hipsPos: [0, 0.88, -0.45], hips: [-12, 0, 0], spine: [-8, 0, 0], chest: [-10, 0, 0], neck: [-4, 0, 0], head: [-18, 0, 0],
        handTL: [0.6, 1.5, -0.3], handTR: [-0.6, 1.5, -0.3], elbowPoleL: [1, 0, 0], elbowPoleR: [-1, 0, 0], footL: [0.14, A + 0.08, -0.1], footR: [-0.18, A, -0.6] }],
      [0.5, { hipsPos: [0, 0.66, -1.15], hips: [-30, 0, 6], chest: [-14, 0, 0], handTL: [0.7, 1.2, -1.2], handTR: [-0.72, 1.14, -1.2], footL: [0.16, A, -0.7], footR: [-0.2, A, -0.95] }],
      [0.9, { hipsPos: [0.05, 0.3, -1.35], hips: [-20, 10, 20], spine: [8, 0, 0], chest: [14, 0, 0], neck: [10, 0, 0], head: [0, 0, 0],
        handTL: [0.5, 0.25, -1.1], handTR: [-0.5, 0.18, -1.45], elbowPoleL: [1, 0.3, 0], elbowPoleR: [-1, 0.3, 0], footL: [0.2, A, -0.5], footR: [-0.2, A + 0.05, -0.8], kneeL: [0.4, 0.5, 1] }],
      [1.5, { hipsPos: [0, 0.5, -1.1], hips: [12, 0, 0], spine: [20, 0, 0], chest: [10, 0, 0], neck: [10, 0, 0], head: [-10, 0, 0],
        footL: [0.16, A, -0.8], footR: [-0.16, 0.1, -1.45], footRotR: [-60, 8, 0], kneeR: [-0.1, -0.5, 1], handTL: [0.2, 0.62, -0.72], handTR: [-0.3, 0.3, -1.0], elbowPoleL: [1, -0.5, 0] }],
      [2.2, { ...GUARD, hipsPos: [0, 0.9, -1.05], footL: [0.14, A, -0.8], footR: [-0.18, A, -1.2], handTL: [0.1, 1.2, -0.7], handTR: [-0.14, 1.16, -0.8] }],
    ]);
    return { duration: 2.2, armSpace: 'root', pose: rooted(K, rm), rootMotion: rm };
  },
  br_into_jukebox: () => {
    const rm = (t) => [0, -0.9 * sstep(0, 0.5, t) + 0.3 * sstep(0.9, 1.6, t)];
    const K = keyed([
      [0, GUARD],
      [0.25, { hipsPos: [0, 0.9, -0.5], hips: [-10, 0, 0], chest: [-12, 0, 0], head: [-14, 0, 0], handTL: [0.5, 1.4, -0.3], handTR: [-0.5, 1.4, -0.35], elbowPoleL: [1, 0, 0], elbowPoleR: [-1, 0, 0], footR: [-0.18, A, -0.62] }],
      [0.5, { hipsPos: [0, 0.88, -0.84], hips: [-16, 0, 0], spine: [-10, 0, 0], chest: [-18, 0, 0], neck: [-20, 0, 0], head: [-30, 10, 0],
        handTL: [0.62, 1.3, -1.0], handTR: [-0.62, 1.26, -1.0], footL: [0.14, A, -0.4], footR: [-0.18, A, -0.7] }],
      [0.8, { hipsPos: [0, 0.82, -0.84], hips: [-8, 0, 0], chest: [-12, 0, 0], neck: [-10, 0, 0], head: [-22, 14, 6] }],
      [1.6, { ...GUARD, hipsPos: [0, 0.9, -0.62], footL: [0.14, A, -0.4], footR: [-0.18, A, -0.8], handTL: [0.1, 1.2, -0.3], handTR: [-0.14, 1.16, -0.4] }],
    ]);
    return { duration: 1.6, armSpace: 'root', pose: rooted(K, rm), rootMotion: rm };
  },
  br_into_piecase: () => {
    const rm = (t) => [0, -0.8 * sstep(0, 0.5, t) + 0.25 * sstep(0.9, 1.6, t)];
    const K = keyed([
      [0, GUARD],
      [0.25, { hipsPos: [0, 0.9, -0.45], hips: [-10, 0, 0], chest: [-10, 0, 0], head: [-12, 0, 0], handTL: [0.5, 1.4, -0.3], handTR: [-0.5, 1.3, -0.4], elbowPoleL: [1, 0, 0], elbowPoleR: [-1, 0, 0], footR: [-0.18, A, -0.6] }],
      [0.5, { hipsPos: [0, 0.86, -0.76], hips: [-24, 0, 0], spine: [-20, 0, 0], chest: [-24, 0, 0], neck: [-14, 0, 0], head: [-24, 0, 0],
        handTL: [0.7, 1.1, -1.0], handTR: [-0.66, 1.04, -1.05], footL: [0.14, A, -0.3], footR: [-0.18, A, -0.6] }],
      [0.85, { hipsPos: [0, 0.84, -0.76], hips: [-14, 0, 0], chest: [-14, 0, 0], handTR: [-0.4, 1.05, -0.9] }],
      [1.6, { ...GUARD, hipsPos: [0, 0.9, -0.55], footL: [0.14, A, -0.35], footR: [-0.18, A, -0.75], handTL: [0.1, 1.2, -0.25], handTR: [-0.14, 1.16, -0.35] }],
    ]);
    return { duration: 1.6, armSpace: 'root', pose: rooted(K, rm), rootMotion: rm };
  },
});

// the last blow: it lifts him; two steps backwards, over the booth table,
// his back through the plate glass of bay B4 (glass 1.0), down on his back on
// the pavement outside (land 1.45), one arm out. Authored for a travel of
// KO_D (model m); the figure scales it to where the pavement anchor is.
export const KO_D = 3.6;
const KO_LIE = { ...DEATH_BACK[DEATH_BACK.length - 1].pose };
const koLie = (t = 0) => {
  const b = S(TAU * t / 3.2);
  return { ...KO_LIE, hipsPos: [KO_LIE.hipsPos[0], KO_LIE.hipsPos[1], KO_LIE.hipsPos[2]], chest: [KO_LIE.chest[0] + 1.5 * b, KO_LIE.chest[1], KO_LIE.chest[2]],
    head: [KO_LIE.head[0], KO_LIE.head[1] + 2, KO_LIE.head[2]] };
};
Object.assign(DEFS, {
  br_ko_window: () => {
    const rm = (t) => [0, -KO_D * pw(t, [[0, 0], [0.45, 0.2], [0.75, 0.42], [1.0, 0.68], [1.45, 0.9], [1.8, 1]]) + KO_LIE.hipsPos[2] * sstep(1.3, 2.2, t) * 0];
    const L = KO_D;
    const K = keyed([
      [0, GUARD],
      // lifted: the chin up, arms flung, up on his toes
      [0.12, { hipsPos: [0, 0.98, -0.1], hips: [-10, 0, 0], spine: [-10, 0, 0], chest: [-16, 10, 0], neck: [-24, 0, 0], head: [-30, 16, 0],
        handTL: [0.55, 1.5, -0.1], handTR: [-0.5, 1.62, -0.2], elbowPoleL: [1, 0, 0], elbowPoleR: [-1, 0.2, 0], footL: [0.14, A + 0.06, 0.1], footR: [-0.18, A, -0.3], footRotL: [-20, 12, 0] }],
      // the two steps back
      [0.3, { hipsPos: [0, 0.94, -0.45], footR: [-0.18, A, -0.62], footL: [0.14, A + 0.12, -0.2], footRotL: [-30, 12, 0] }],
      [0.45, { hipsPos: [0, 0.92, -0.72], footL: [0.14, A, -0.86], footRotL: [0, 12, 0], hips: [-18, 0, 0], chest: [-20, 10, 0] }],
      // the table at his thighs: he goes over it backwards
      [0.75, { hipsPos: [0, 0.98, -1.52], hips: [-55, 0, 8], spine: [-8, 0, 0], chest: [-10, 0, 0], neck: [-14, 0, 0], head: [-24, 10, 0],
        footL: [0.14, 0.45, -1.1], footR: [-0.16, 0.3, -1.25], footRotL: [30, 12, 0], footRotR: [30, 12, 0], kneeL: [0.1, 1, 0.4], kneeR: [-0.1, 1, 0.4],
        handTL: [0.62, 1.4, -1.8], handTR: [-0.6, 1.5, -1.9] }],
      // flat out through the glass
      [1.0, { hipsPos: [0, 1.08, -2.45], hips: [-88, 0, 12], chest: [-6, 0, 0], neck: [-6, 0, 0], head: [-16, 0, 0],
        footL: [0.14, 1.1, -1.85], footR: [-0.16, 0.9, -1.95], kneeL: [0.1, 1, 0.2], kneeR: [-0.1, 1, 0.2],
        handTL: [0.7, 1.3, -2.8], handTR: [-0.66, 1.5, -2.95] }],
      // down on the pavement
      [1.45, { ...KO_LIE, hipsPos: [KO_LIE.hipsPos[0], KO_LIE.hipsPos[1] + 0.05, -L * 0.9 + KO_LIE.hipsPos[2] + 0.1], footL: [KO_LIE.footL[0], 0.3, -L * 0.9 + KO_LIE.footL[2] + 0.2], footR: [KO_LIE.footR[0], 0.25, -L * 0.9 + KO_LIE.footR[2] + 0.2] }],
      [1.65, { ...KO_LIE, hipsPos: [KO_LIE.hipsPos[0], KO_LIE.hipsPos[1] + 0.03, -L + KO_LIE.hipsPos[2]], footL: [KO_LIE.footL[0], KO_LIE.footL[1] + 0.05, -L + KO_LIE.footL[2]], footR: [KO_LIE.footR[0], KO_LIE.footR[1], -L + KO_LIE.footR[2]] }],
      [2.4, { ...KO_LIE, hipsPos: [KO_LIE.hipsPos[0], KO_LIE.hipsPos[1], -L + KO_LIE.hipsPos[2]], footL: [KO_LIE.footL[0], KO_LIE.footL[1], -L + KO_LIE.footL[2]], footR: [KO_LIE.footR[0], KO_LIE.footR[1], -L + KO_LIE.footR[2]] }],
    ]);
    return { duration: 2.4, armSpace: 'root', pose: rooted(K, rm), rootMotion: rm };
  },
  // out cold on his back, breathing (the arms as the fall left them)
  ko: () => ({ duration: 3.2, loop: true, armSpace: 'root', pose: (t) => P(koLie(t)) }),
  // down from standing where he is (a figure put down by a script: the
  // fall is 0.9 s, then he lies as 'ko')
  koFall: () => ({ duration: 1.15, armSpace: 'root', pose: keyed([...DEATH_BACK.map((k) => [k.t, k.pose])]) }),
  // [O4] up again (the crowd brawl: a man knocked down once gets up, slower):
  // from flat on his back, up onto an elbow and his hands, a knee, his feet,
  // his fists up; the root carried to where he stands up (he lay 0.8 m behind it)
  o4_getUp: () => {
    const rm = (t) => [0, -0.5 * sstep(0.6, 1.5, t)];
    const K = keyed([
      [0, KO_LIE],
      [0.35, { hipsPos: [0.0, 0.17, -0.75], hips: [-55, 0, 0], spine: [20, 0, 0], chest: [20, 0, 0], neck: [0, 0, 0], head: [10, 0, 0],
        armR: [-0.35, -0.85, -0.4, 0], elbowR: [20], armL: [0.35, -0.85, -0.4, 0], elbowL: [20],
        footL: [0.15, A, -0.3], footRotL: [0, 8, 0], kneeL: [0.2, 1, 0.6], footR: [-0.15, 0.09, -0.05], footRotR: [60, 10, 0], kneeR: [-0.2, 1, 0.3] }],
      [0.75, { hipsPos: [0.02, 0.5, -0.55], hips: [-5, 0, 0], spine: [25, 0, 0], chest: [15, 0, 0], neck: [0, 0, 0], head: [-5, 0, 0],
        armR: [-0.2, -0.9, 0.3, 0], elbowR: [30], armL: [0.3, -0.8, 0.5, 0], elbowL: [60],
        footL: [0.15, A, -0.3], footRotL: [0, 8, 0], kneeL: [0.2, 0.3, 1], footR: [-0.15, 0.1, -0.85], footRotR: [-60, 10, 0], kneeR: [-0.1, -0.3, 1] }],
      [1.2, { hipsPos: [0, 0.88, -0.45], hips: [-5, 0, 0], spine: [8, 0, 0], chest: [0, 0, 0], head: [4, 0, 0],
        armR: [-0.25, -0.8, 0.55, 0], elbowR: [110], armL: [0.25, -0.8, 0.6, 0], elbowL: [110],
        footL: [0.14, A, -0.25], footRotL: [0, 12, 0], kneeL: [0.3, 0, 1], footR: [-0.16, A, -0.62], footRotR: [0, 25, 0], kneeR: [-0.2, 0, 1] }],
      [1.5, { hipsPos: [0, 0.93, -0.54], hips: [0, -18, 0], spine: [-1, -5, 0], chest: [-4, -5, 0], neck: [8, 6, 0], head: [10, 12, 0],
        armR: [-0.3, -0.6, 0.7, 0], elbowR: [125], armL: [0.3, -0.55, 0.75, 0], elbowL: [125],
        footL: [0.14, A, -0.28], footRotL: [0, 12, 0], kneeL: [0.3, 0, 1], footR: [-0.18, A, -0.72], footRotR: [0, 32, 0], kneeR: [-0.2, 0, 1] }],
    ]);
    return { duration: 1.5, armSpace: 'root', pose: rooted((t) => P(K(t)), rm), rootMotion: rm, fps: 30 };
  },
});

// the brawler's fight as round 2 made it (src/cast/brawl/clips.js): his
// guard, his steps, both hands' blows, the room, the last blow
Object.assign(DEFS, BR_DEFS);

// startle: a jolt over whatever he is doing (additive)
const ADDITIVE = {
  startle: [
    { t: 0, bones: {} },
    { t: 0.08, bones: { spine: [-6, 0, 0], chest: [-10, 0, 0], neck: [-8, 0, 0], head: [-10, 0, 0], upperArmL: [-14, 0, -8], upperArmR: [-14, 0, 8], shoulderL: [0, 0, -6], shoulderR: [0, 0, 6] } },
    { t: 0.3, bones: { spine: [-4, 0, 0], chest: [-6, 0, 0], neck: [-4, 0, 0], head: [-6, 0, 0], upperArmL: [-8, 0, -4], upperArmR: [-8, 0, 4], shoulderL: [0, 0, -3], shoulderR: [0, 0, 3] } },
    { t: 0.8, bones: { spine: [0, 0, 0], chest: [0, 0, 0], neck: [0, 0, 0], head: [0, 0, 0], upperArmL: [0, 0, 0], upperArmR: [0, 0, 0], shoulderL: [0, 0, 0], shoulderR: [0, 0, 0] } },
  ],
};

// the kind's own stance, played as its 'idle'
const IDLE = { brawler: 'idleBrawler', waitress: 'idleWaitress', oldman: 'idleOld' };
export const IS_ADDITIVE = (name) => !!ADDITIVE[name];

// the kinds of their own files (src/cast/kinds/*.js, costumes.js reads them):
// each clip is its timing (CAST_CLIPS: duration, marks, loop, hold, ...) and
// its poses, def(ctx, arg) -> { pose(t), armSpace?, rootMotion?, fps? }
// (ctx = { kind, costume, rig, s }; arg: what follows '@' in the name)
for (const K of KIND_DEFS) {
  for (const [name, c] of Object.entries(K.clips || {})) {
    // (CAST_CLIPS is clips.js's table: an entry this kind wrote before - the
    // module read again by the dev server - is not a second definition)
    if (DEFS[name] || ADDITIVE[name] || (CAST_CLIPS[name] && CAST_CLIPS[name].kind !== K.kind)) throw new Error(`cast kinds: clip '${name}' defined twice (kind '${K.kind}')`);
    if (typeof c.def !== 'function' || !(c.duration > 0)) throw new Error(`cast kinds: clip '${name}' needs { duration, def(ctx, arg) } (kind '${K.kind}')`);
    const { def, ...timing } = c;
    CAST_CLIPS[name] = { marks: {}, ...timing, kind: K.kind };
    DEFS[name] = (ctx, arg) => ({ duration: c.duration, loop: !!c.loop, ...def(ctx, arg) });
  }
  if (K.idle) IDLE[K.kind] = K.idle;
}

// ---------------------------------------------------------------------------
const BANKS = new Map();
export function castBank(kind) {
  if (BANKS.has(kind)) return BANKS.get(kind);
  const costume = COSTUMES[kind];
  const rig = figureRig(costume);
  const s = costume.h / figureGeometry(costume, 0).userData.top;
  const ctx = { kind, costume, rig, s };
  const clips = { ...getClips() };
  const bank = {
    kind, ctx, clips,
    has(name) { const [b] = name.split('@'); return !!clips[name] || !!DEFS[b] || !!ADDITIVE[b]; },
    ensure(name) {
      if (clips[name]) return clips[name];
      const [b, arg] = name.split('@');
      if (ADDITIVE[b]) return (clips[name] = bakeAdditive(name, ADDITIVE[b]));
      const def = DEFS[b];
      if (!def) throw new Error(`cast: no clip '${name}' for '${kind}'`);
      const d = def(ctx, arg);
      // (the fight's blows bake at 60 fps: a 0.10 s strike is six samples)
      const c = bake(name, d.duration, d.pose, { loop: !!d.loop, armSpace: d.armSpace || 'chest', rig, rootMotion: d.rootMotion || null, fps: d.fps || undefined });
      clips[name] = c;
      return c;
    },
  };
  if (IDLE[kind]) {
    const d = DEFS[IDLE[kind]](ctx);
    clips.idle = bake('idle', d.duration, d.pose, { loop: true, armSpace: d.armSpace || 'chest', rig });
  }
  BANKS.set(kind, bank);
  return bank;
}

// The look-at (Hood.postPose) turns the spine, the chest and the head ON TOP
// of the pose the mixer wrote this step. But three's mixer only writes a
// bone when its animated value changed since the last step (PropertyMixer.
// apply compares the two accumulation buffers): on a held pose (a clip that
// ended and holds - notice, rise, the last blow - or a track that is flat
// over some keys) the bone keeps what it had, and the look is laid on top
// of last step's look, every step: the torso wound round and round (the
// brawler's 360s as he rose into the fight and as he lay on the pavement).
// So before each mixer step the bones the look (and the aim) touch are
// marked changed: the mixer writes them fresh every step, and the look is
// always one look on one pose. (Round 2, the fight's owner: the root cause.)
const LOOK_BONES = new Set(['spine', 'chest', 'neck', 'head', 'upperArmR']);
export class CastAnimator extends HoodAnimator {
  constructor(root, bank) {
    super(root, bank.clips);
    this.bank = bank;
  }
  update(dt) {
    const M = this.mixer;
    const binds = M._bindings;
    if (binds) {
      // (the region the coming step compares against: last step's)
      const other = M._accuIndex;
      for (const pm of binds) {
        const b = pm.binding;
        const node = b && (b.targetObject || b.node);
        if (!node || !LOOK_BONES.has(node.name) || pm.valueSize !== 4) continue;
        const o = other * 4 + 4;
        pm.buffer[o] = NaN;
      }
    }
    super.update(dt);
  }
  play(name, opts) { if (this.bank) this.bank.ensure(name); return super.play(name, opts); }
  setOverlay(name, fade) { if (name && this.bank) this.bank.ensure(name); return super.setOverlay(name, fade); }
  additive(name, w) { if (this.bank) this.bank.ensure(name); return super.additive(name, w); }
}

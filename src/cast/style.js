import * as THREE from 'three';

// [O8] The variants of the cast (docs/briefs/O8_FIGURES.md §1, OPEN_WORLD's
// "nothing copy-paste"): a figure's own build, gait and habits, by a seeded
// hash of where he stands - the same place, the same man; the next corner,
// another. On top of the look (the coat, the hat: src/people/costumes.js),
// what the outline and the walk tell at 20 m:
//   build     slight / middling / heavy (the shoulders' width, the chest's depth)
//   hat       its tilt: pulled down over the eyes, pushed back, cocked
//   carriage  a slouch, the chest up, the head down against the rain
//   walk      the hips' sway (the women), the shoulders' roll (the working
//             men, the gangs' swagger), the arms in or out
//   habits    the idle he keeps (the weight on one leg, hands in the
//             pockets, a cigarette, the arms folded), hands in the pockets
//             as he walks
//   styleFor(kind, x, z, { role, sex, work }) -> style   fig.setStyle(style)
// The women and the working men are kinds of their own in this: she walks
// narrow, her arms in, her hips swaying; he walks heavy, rolling the shoulders.
const frac = (v) => v - Math.floor(v);
export const hashAt = (x, z, k = 0) => frac(Math.sin(x * 12.9898 + z * 78.233 + k * 37.719) * 43758.5453);
export const IDLES = ['idle', 'o8_idleShift', 'o8_idlePockets', 'o8_idleSmoke', 'o8_idleArms'];

export function styleFor(kind, x, z, { role = 'walker', sex = 'm', work = false, old = false } = {}) {
  const u = (k) => hashAt(x, z, k);
  const f = sex === 'f', cop = role === 'cop', gang = role === 'gang';
  const b = u(1);
  const boy = /newsboy/.test(kind), big = /boxer/.test(kind);
  const build = boy ? 'slight' : big ? 'heavy' : f ? (b < 0.55 ? 'slight' : 'mid') : b < 0.28 ? 'slight' : b < 0.7 ? 'mid' : 'heavy';
  const W = { slight: [0.93, 0.95], mid: [1, 1], heavy: [1.09, 1.08] }[build];
  const S = {
    build,
    wx: W[0] * (0.985 + 0.03 * u(2)), wz: W[1],
    // degrees: the spine and the chest bowed, the chest held up, the head down
    slouch: f || cop ? 0 : (u(3) < 0.35 ? 3 + 6 * u(4) : 0) + (work ? 3 : 0) + (old ? 9 : 0),
    chestUp: cop ? 4 : f ? 2.5 : u(3) > 0.82 ? 4 : 0,
    headDown: u(7) < 0.4 ? 3 + 5 * u(8) : 0,
    // the walk: the hips' roll, the shoulders' turn (x the gait's own), the arms
    sway: f ? 1 : work ? 0.25 : u(5) < 0.25 ? 0.45 : 0.1,
    swagger: gang ? 0.8 + 0.4 * u(6) : work ? 0.7 : f ? 0.15 : u(6) < 0.3 ? 0.5 : 0.15,
    armIn: f ? 1 : work ? -0.6 : 0,
    // the hat: pitch (+ down over the eyes, - pushed back), roll (cocked)
    hat: [gang ? 0.08 + 0.06 * u(9) : (u(9) - 0.45) * 0.2, (u(10) - 0.5) * (gang ? 0.24 : 0.14)],
    pockets: !f && !cop && !work && u(11) < 0.28,
    smoke: !f && !cop && !boy && u(12) < (gang ? 0.3 : 0.1),
    idle: null,
  };
  // the idle he keeps (a cop and a woman their own few)
  const r = u(13);
  S.idle = cop ? (r < 0.5 ? 'o8_idleShift' : 'o8_idleArms')
    : S.smoke ? 'o8_idleSmoke'
      : f ? (r < 0.6 ? 'o8_idleShift' : 'idle')
        : S.pockets ? 'o8_idlePockets'
          : r < 0.3 ? 'idle' : r < 0.6 ? 'o8_idleShift' : r < 0.8 ? 'o8_idlePockets' : 'o8_idleArms';
  if (old) S.idle = kind === 'oldman' ? null : S.idle;
  return S;
}

// the layer, per step, on top of the clip (Hood.postPose calls it): the
// carriage always, the walk's roll with the gait's phase, the hat once
const _q = new THREE.Quaternion(), _e = new THREE.Euler();
const D = Math.PI / 180;
const rot = (bone, p, y, r) => { if (!bone) return; bone.quaternion.multiply(_q.setFromEuler(_e.set(p * D, y * D, r * D, 'YXZ'))); };
export function applyStyle(h, dt) {
  const S = h.style, b = h.bones;
  if (!S || !h.alive || h.rag || h.down) return;
  const st = h.state;
  const walking = st === 'walk' || st === 'run';
  const mv = walking ? Math.min(1, h.speed / 1.3) : 0;
  // the gait's phase (0..1 over a stride pair) from the legs' clip
  let ph = 0;
  if (walking && h.anim && h.anim.lower) {
    const a = h.anim.lower.get(h.anim.base), c = h.anim.clips[h.anim.base];
    if (a && c) ph = (a.time / c.duration) % 1;
  }
  const s2 = Math.sin(ph * Math.PI * 2);
  const run = st === 'run' ? 0.5 : 1;
  // (a fight, a seat, the gun: the clip's own carriage)
  const calm = st === 'idle' || walking || st === 'watch';
  if (!calm) return;
  // (into a turn he leans the way he turns, harder the faster he goes)
  const lean = Math.max(-9, Math.min(9, -(h._yawRate || 0) * h.speed * 2.4));
  rot(b.spine, S.slouch * 0.45 - S.chestUp * 0.3, S.swagger * 3.5 * s2 * mv * run, -S.sway * 2.6 * s2 * mv * run + lean);
  rot(b.chest, S.slouch * 0.55 - S.chestUp * 0.7, S.swagger * 2.5 * s2 * mv * run, 0);
  rot(b.neck, -S.slouch * 0.7 + S.headDown * 0.5 + S.chestUp * 0.5, 0, 0);
  rot(b.head, S.headDown * 0.5, 0, S.sway * 1.6 * s2 * mv);
  if (S.armIn) {
    rot(b.upperArmL, 0, 0, -S.armIn * 5 * (walking ? 1 : 0.5));
    rot(b.upperArmR, 0, 0, S.armIn * 5 * (walking ? 1 : 0.5));
  }
}

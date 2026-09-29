import * as THREE from 'three';
import { BR_ATTACKS, STEP } from './clips.js';

// Mack in the fight (round 2, docs/story/FIGHT.md §4): what he does, where
// he goes, how his feet carry him. The rules (src/game/Brawl.js) own the
// blows' outcome; this owns his choices and his steering.
//   think(B, dt)   in 'move': keep his distance, circle, close, back off;
//                  choose the next attack by his manner; arm himself
//   steer(B, dt)   move him (speed-limited, round the furniture, never
//                  through it), turn him to me (the short way, rate-limited),
//                  and pick the stepping clip his real velocity asks for
// His manner follows his health: measured (100..65), dirty (65..30), wild
// (30..12), out on his feet (12 and under: the rules take him to a window).
export const MANNERS = {
  measured: { keep: [1.4, 1.8], speed: 1.15, gap: [1.6, 2.4], low: 0.2, feint: 0.15, combo: 0.1,
    mix: { br_jab: 0.34, br_hook: 0.2, br_hookL: 0.16, br_body: 0.12, br_bodyL: 0.08, br_cross: 0.1 } },
  dirty: { keep: [1.25, 1.7], speed: 1.3, gap: [1.1, 1.7], low: 0.18, feint: 0.18, combo: 0.2, shove: 0.12,
    mix: { br_jab: 0.2, br_cross: 0.12, br_hook: 0.18, br_hookL: 0.16, br_body: 0.08, br_bodyL: 0.06, br_shove: 0.1, br_bottle_thrust: 0.3 } },
  wild: { keep: [1.2, 1.5], speed: 1.45, gap: [0.6, 1.0], low: 0.1, feint: 0.05, combo: 0.35,
    mix: { br_haymaker: 0.24, br_haymakerL: 0.18, br_hook: 0.14, br_hookL: 0.12, br_rush: 0.14, br_cross: 0.08, br_jab: 0.1, br_bottle_thrust: 0.2 } },
};
export function mannerOf(hp) { return hp > 65 ? 'measured' : hp > 30 ? 'dirty' : hp > 12 ? 'wild' : 'out'; }
// the nearest he comes to my eye (his root), and a rush's end
export const KEEP_OFF = { eye: 1.1, rush: 1.2, body: 1.0 };
export const REACH = { straight: 1.95, swing: 1.85, over: 1.95, shove: 1.7, throw: 7, rush: 2.9 };
const _v = new THREE.Vector3(), _w = new THREE.Vector3();
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// ---- choices -------------------------------------------------------------------------------
export function think(B, dt) {
  const him = B.him, c = B.c, eye = B.game.eye, r = B.rng;
  const M = MANNERS[him.manner] || MANNERS.measured;
  const d = Math.hypot(eye.x - c.pos.x, eye.z - c.pos.z);
  // (circling: which way, for how long)
  him.circleT -= dt;
  if (him.circleT <= 0) { him.circleT = r.range(1.8, 3.6); him.circle = r.chance(0.5) ? 1 : -1; if (r.chance(0.25)) him.circle = 0; }
  if (him.backT > 0) him.backT -= dt;
  // hands low for a moment (cocky, tired)
  if (him.lowT > 0) { him.lowT -= dt; if (him.lowT <= 0) him.low = false; }
  if (B.lessonHold) { him.goal = null; return; }
  // going for something to fight with
  if (him.task) return;
  him.next -= dt;
  if (him.next > 0) return;
  // his next move
  const plan = pickAttack(B, M, d);
  if (!plan) { him.next = 0.3; return; }
  if (plan.task) { him.task = plan.task; him.state = 'arm'; him.h = null; return; }
  if (d > (plan.reach ?? 1.9)) { him.want = plan.clip; him.next = 0.25; return; }
  B.hisAttack(plan.clip);
}

function pickAttack(B, M, d) {
  const him = B.him, r = B.rng;
  if (him.pending) { const p = him.pending; him.pending = null; return { clip: p, reach: REACH[BR_ATTACKS[p]?.kind] || 1.9 }; }
  // what he holds decides first
  if (him.holding === 'stool') return { clip: 'br_stoolSwing', reach: 2.0 };
  if (him.holding === 'plate' || him.holding === 'mug') {
    // (a throw from 3 m: he backs off first)
    if (d < 2.4) { him.backT = 1.0; return null; }
    return { clip: 'br_throw', reach: 7 };
  }
  // arming himself: the first bottle in his dirty manner, a plate or a mug
  // now and then, a stool when he is wild
  const room = B.room;
  if (him.manner === 'dirty' && !him.holding && !him.hadBottle && room.hisItem) {
    const it = room.hisItem('bottle', B.c.pos);
    if (it) return { task: { kind: 'bottle', item: it, t: 0 } };
  }
  if (him.manner === 'dirty' && !him.holding && (him.throws || 0) < 2 && r.chance(0.18) && room.hisItem) {
    const it = room.hisItem(r.chance(0.5) ? 'plate' : 'mug', B.c.pos);
    if (it) return { task: { kind: it.kind, item: it, t: 0 } };
  }
  if (him.manner === 'wild' && !him.holding && !him.hadStool && r.chance(0.3) && room.hisItem) {
    const it = room.hisItem('stool', B.c.pos);
    if (it) return { task: { kind: 'stool', item: it, t: 0 } };
  }
  // a feint now and then (it teaches the tell)
  if (r.chance(M.feint)) return { clip: r.chance(0.5) ? 'br_feint' : 'br_feintL', reach: 2.4 };
  // the rush from a little way off
  if (him.manner === 'wild' && d > 1.9 && d < 3.1 && r.chance(0.5)) return { clip: 'br_rush', reach: REACH.rush };
  const mix = { ...M.mix };
  if (!(him.holding === 'neck')) delete mix.br_bottle_thrust;
  else { delete mix.br_hook; delete mix.br_cross; delete mix.br_haymaker; delete mix.br_rush; delete mix.br_body; }
  let tot = 0; for (const v of Object.values(mix)) tot += v;
  let x = r.next() * tot, clip = 'br_jab';
  for (const [k, v] of Object.entries(mix)) { x -= v; if (x <= 0) { clip = k; break; } }
  if (r.chance(M.combo)) {
    const a = BR_ATTACKS[clip];
    him.pending = a && a.hand === 'L' ? (r.chance(0.6) ? 'br_hook' : 'br_cross') : (r.chance(0.6) ? 'br_hookL' : 'br_jab');
    if (him.holding === 'neck') him.pending = 'br_jab';
  }
  return { clip, reach: REACH[BR_ATTACKS[clip]?.kind] || 1.9 };
}

// ---- steering --------------------------------------------------------------------------------
// where he wants to be this step (null: stay)
function goalOf(B) {
  const him = B.him, c = B.c, eye = B.game.eye;
  if (B.holdStill) return null;
  const M = MANNERS[him.manner] || MANNERS.measured;
  // (reeling to the window: there in three seconds at most, however far)
  // (the clear floor before the glass is come at square, from the room:
  // first to a point 1.1 m in front of the spot, then back onto it - the
  // café tables and their chairs stand either side of that lane)
  if (him.state === 'reel') {
    if (!him.spot) return null;
    const S = him.spot, ax = S.x - 1.1;
    if (!him.lane && (Math.abs(c.pos.z - S.z) < 0.3 || Math.hypot(c.pos.x - ax, c.pos.z - S.z) < 0.3)) him.lane = true;
    const tx = him.lane ? S.x : ax;
    if (him.reelSpeed == null) him.reelSpeed = Math.max(1.1, Math.min(2.2, (Math.hypot(ax - c.pos.x, S.z - c.pos.z) + 1.1) / 2.7));
    return { x: tx, z: S.z, speed: him.reelSpeed, face: 'spot', tx };
  }
  if (him.task && him.task.item && him.task.phase !== 'take') {
    const p = him.task.item.stand || him.task.item.pos;
    return { x: p.x, z: p.z, speed: M.speed * 1.1 };
  }
  _v.set(c.pos.x - eye.x, 0, c.pos.z - eye.z);
  let d = _v.length();
  if (d < 1e-3) { _v.set(0, 0, 1); d = 1; }
  _v.divideScalar(d);
  let keep = B.lessonHold ? 1.5 : (M.keep[0] + M.keep[1]) / 2;
  if (him.want) keep = Math.min(keep, 1.25);
  if (him.backT > 0) keep = him.holding === 'plate' || him.holding === 'mug' ? 3.1 : Math.max(keep, 2.3);
  if (B.lessonBack) keep = 2.8;
  // (circling: a step to the side round me)
  const side = him.circle * 0.6;
  return { x: eye.x + _v.x * keep + _v.z * side, z: eye.z + _v.z * keep - _v.x * side, speed: M.speed };
}

export function steer(B, dt) {
  const him = B.him, c = B.c, F = c.fig, eye = B.game.eye;
  const S = B.game.stage;
  const free = him.state === 'move' || (him.state === 'reel' && !him.atSpot) || (him.state === 'arm' && him.task && him.task.phase !== 'take');
  const g = free ? goalOf(B) : null;
  // the velocity he wants: toward the goal, easing in, capped
  const tv = _w.set(0, 0, 0);
  if (g) {
    const dx = g.x - F.pos.x, dz = g.z - F.pos.z, dd = Math.hypot(dx, dz);
    if (dd > 0.08) tv.set(dx, 0, dz).multiplyScalar(Math.min(g.speed, dd * 2.2) / dd);
  }
  const V = him.vel || (him.vel = new THREE.Vector3());
  V.lerp(tv, 1 - Math.exp(-dt * 7));
  if (!free) V.multiplyScalar(Math.exp(-dt * 12));
  let moved = 0;
  if (free && V.lengthSq() > 1e-6) {
    const x0 = F.pos.x, z0 = F.pos.z;
    const p = _v.set(x0 + V.x * dt, 0, z0 + V.z * dt);
    S.colliders.resolve(p, (F.collider ? F.collider.r : 0.35), F.collider);
    // (round the furniture: blocked this way, he tries a way either side)
    if (Math.hypot(p.x - x0, p.z - z0) < V.length() * dt * 0.4) {
      for (const a of [0.7, -0.7, 1.3, -1.3]) {
        const q = new THREE.Vector3(x0 + (V.x * Math.cos(a) - V.z * Math.sin(a)) * dt, 0, z0 + (V.x * Math.sin(a) + V.z * Math.cos(a)) * dt);
        S.colliders.resolve(q, (F.collider ? F.collider.r : 0.35), F.collider);
        if (Math.hypot(q.x - x0, q.z - z0) > V.length() * dt * 0.6) { p.copy(q); break; }
      }
    }
    F.pos.x = p.x; F.pos.z = p.z;
    moved = Math.hypot(p.x - x0, p.z - z0) / Math.max(1e-6, dt);
    him.speed = moved;
  } else him.speed = 0;
  // (never into me: my body is a circle he stops at - a blow's root motion,
  // a rush, a walk to the counter all end at arm's length)
  // (polish: 1.1 m from my eye, a rush 1.2 m - at 0.78 m a rush or an
  // overhand leaning in filled the frame, a black mass with the camera
  // almost inside him; his fists still reach, his arms are long)
  {
    const dx = F.pos.x - eye.x, dz = F.pos.z - eye.z, dd = Math.hypot(dx, dz);
    let R = him.clip === 'br_rush' ? KEEP_OFF.rush : KEEP_OFF.eye;
    // (and his body: a haymaker or an overhand throws the chest and the
    // head well past the feet - they too stay KEEP_OFF.body from my eye:
    // the root goes back by as much as the body leans in toward me)
    if (dd > 1e-4 && c.object && c.bones.chest && c.bones.head) {
      const o = c.object.position, ux = -dx / dd, uz = -dz / dd;
      let lean = 0;
      for (const b of [c.bones.chest, c.bones.head]) {
        const e = b.matrixWorld.elements;
        lean = Math.max(lean, (e[12] - o.x) * ux + (e[14] - o.z) * uz);
      }
      R = Math.max(R, KEEP_OFF.body + Math.min(0.8, lean));
    }
    if (dd < R && him.state !== 'ko') {
      const k = dd > 1e-4 ? R / dd : 0;
      const x0 = F.pos.x, z0 = F.pos.z;
      F.pos.x = eye.x + (dd > 1e-4 ? dx * k : R); F.pos.z = eye.z + dz * k;
      S.colliders.resolve(F.pos, (F.collider ? F.collider.r : 0.35), F.collider);
      // (a travelling clip sets his root from where it began every step:
      // its origin goes back with him, or the clip would carry him in again;
      // and the figure is drawn where he now stands, this frame)
      const ddx = F.pos.x - x0, ddz = F.pos.z - z0;
      if (F._rmClip) { F._rmClip.x0 += ddx; F._rmClip.z0 += ddz; }
      if (c.object) { c.object.position.x = F.pos.x; c.object.position.z = F.pos.z; }
    }
  }
  // facing: at me (the short way round, at most 4 rad/s; slower in a blow's tell)
  const turnable = him.state === 'move' || him.state === 'arm' || (him.state === 'reel' && !him.atSpot) || (him.state === 'attack' && him.t < him.aimFor);
  if (turnable) {
    let want = Math.atan2(eye.x - F.pos.x, eye.z - F.pos.z);
    // (reeling, he backs to the glass: his back to where he goes, so he
    // stands there with his back to it)
    if (him.state === 'reel' && g && g.face === 'spot') {
      const dx = g.x - F.pos.x, dz = g.z - F.pos.z;
      want = him.lane || Math.hypot(dx, dz) < 0.3 ? -Math.PI / 2 : Math.atan2(-dx, -dz);
    }
    const d = wrap(want - F.yaw);
    const rate = him.state === 'attack' ? 2.5 : 4;
    const step = Math.sign(d) * Math.min(Math.abs(d), rate * dt);
    F.yaw = wrap(F.yaw + step);
    him.yawRate = step / dt;
  } else him.yawRate = 0;
  // the feet: the stepping clip his real velocity asks for
  if (him.state === 'move' || him.state === 'arm' || him.state === 'reel') locomote(B, dt, moved);
}

function locomote(B, dt, v) {
  const him = B.him, c = B.c, F = c.fig;
  if (him.state === 'arm' && him.task && him.task.phase === 'take') return;
  if (him.state === 'reel' && him.atSpot) return;
  const reel = him.state === 'reel';
  let clip;
  if (v < 0.12) clip = Math.abs(him.yawRate || 0) > 1.0 && !reel ? 'br_pivot' : reel ? 'br_reel' : him.low ? 'idle' : 'br_guard';
  else if (reel) clip = 'br_reelBack';
  else {
    const V = him.vel, s = Math.sin(F.yaw), co = Math.cos(F.yaw);
    const fw = V.x * s + V.z * co, lf = V.x * co - V.z * s;
    clip = Math.abs(fw) >= Math.abs(lf) ? (fw > 0 ? 'br_stepF' : 'br_stepB') : (lf > 0 ? 'br_stepL' : 'br_stepR');
  }
  if (him.loco !== clip) {
    // (a new gait holds at least a fifth of a second: no flicker between two)
    if (him.locoT > 0 && him.loco && clip !== 'br_guard' && him.loco !== 'br_guard') { him.locoT -= dt; }
    else { him.loco = clip; him.locoT = 0.2; c.setState(clip, reel ? 0.25 : 0.16); }
  } else if (him.locoT > 0) him.locoT -= dt;
  // the time scale follows his real speed (the feet stay planted)
  if (/^br_step/.test(clip)) F.anim.setTimeScale(Math.max(0.35, Math.min(1.8, v / STEP.speed)));
  else if (clip === 'br_reelBack') F.anim.setTimeScale(Math.max(0.35, Math.min(2.2, v / (STEP.speed * STEP.T * STEP.beta / 0.9 / STEP.beta))));
  else if (clip === 'br_pivot') F.anim.setTimeScale(Math.max(0.6, Math.min(1.6, Math.abs(him.yawRate) / 2.2)));
}

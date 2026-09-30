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
  // (the arcade pass, FIGHT.md v3 §2: the quiet between his blows - gap -
  // 0.9 .. 1.5 s measured, 0.7 .. 1.2 dirty, 0.4 .. 0.8 wild; he often
  // throws two in a row - combo; he breathes - lowers a hand - every
  // `breathe` seconds; wild, one hand hangs low almost all the time)
  measured: { keep: [1.3, 1.6], speed: 1.9, gap: [0.9, 1.5], breathe: 3.2, open: [0.55, 0.75], feint: 0.12, combo: 0.25,
    mix: { br_jab: 0.3, br_jabR: 0.08, br_hook: 0.2, br_hookL: 0.16, br_body: 0.12, br_bodyL: 0.08, br_cross: 0.06 } },
  dirty: { keep: [1.25, 1.55], speed: 2.1, gap: [0.7, 1.2], breathe: 2.4, open: [0.6, 0.85], feint: 0.16, combo: 0.35, shove: 0.12,
    mix: { br_jab: 0.18, br_cross: 0.12, br_hook: 0.18, br_hookL: 0.16, br_body: 0.08, br_bodyL: 0.06, br_shove: 0.1, br_bottle_thrust: 0.3 } },
  wild: { keep: [1.2, 1.45], speed: 2.3, gap: [0.4, 0.8], breathe: 1.8, open: [0.7, 0.95], hang: true, feint: 0.06, combo: 0.5,
    mix: { br_haymaker: 0.24, br_haymakerL: 0.18, br_hook: 0.14, br_hookL: 0.12, br_rush: 0.14, br_cross: 0.08, br_jab: 0.1, br_bottle_thrust: 0.2 } },
};
export function mannerOf(hp) { return hp > 65 ? 'measured' : hp > 30 ? 'dirty' : hp > 12 ? 'wild' : 'out'; }
// the nearest he comes to my eye (his root), and a rush's end
export const KEEP_OFF = { eye: 1.1, rush: 1.2, body: 1.0, pass: 0.85, reel: 0.5 };
// (how near he comes before he throws it: a little inside the blow's own reach)
export const REACH = { straight: 1.75, swing: 1.65, over: 1.8, shove: 1.6, throw: 7, rush: 3.0 };
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _g = new THREE.Vector3();
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// ---- choices -------------------------------------------------------------------------------
export function think(B, dt) {
  const him = B.him, c = B.c, eye = B.game.eye, r = B.rng;
  const MM = B.manners || MANNERS, M = MM[him.manner] || MM.measured;
  const d = Math.hypot(eye.x - c.pos.x, eye.z - c.pos.z);
  // (circling: which way, for how long)
  him.circleT -= dt;
  if (him.thingCool > 0) him.thingCool -= dt;
  if (him.circleT <= 0) { him.circleT = r.range(1.8, 3.6); him.circle = r.chance(0.5) ? 1 : -1; if (r.chance(0.25)) him.circle = 0; }
  if (him.backT > 0) him.backT -= dt;
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
  if (him.answer) { const a = him.answer; him.answer = null; return { clip: a, reach: REACH.straight + 0.1 }; }
  if (him.pending) { const p = him.pending; him.pending = null; return { clip: p, reach: REACH[BR_ATTACKS[p]?.kind] || 1.9 }; }
  // what he holds decides first
  if (him.holding === 'stool' || him.holding === 'chair') return { clip: 'br_stoolSwing', reach: 2.0 };
  if (him.holding === 'plate' || him.holding === 'mug' || him.holding === 'bottle') {
    // (a throw from 2.5 m and more: he backs off first)
    him.throwWait = (him.throwWait || 0) + 0.3;
    if (d < 2.4 && !(him.throwWait > 2.5 && d > 1.4)) { him.backT = 1.0; return null; }
    him.throwWait = 0;
    return { clip: 'br_throw', reach: 7 };
  }
  const room = B.room;
  him.acts = (him.acts || 0) + 1;
  // his first bottle in his dirty manner: broken on the counter, the neck
  if (him.manner === 'dirty' && !him.holding && !him.hadBottle && room.hisItem && !(him.thingCool > 0)) {
    const it = room.hisItem('bottle', B.c.pos);
    if (it) { him.thingActs = (him.thingActs || 0) + 1; return { task: { kind: 'bottle', item: it, t: 0, first: true } }; }
  }
  // [B8] he uses the room (FIGHT.md v4 §4): from his measured manner on,
  // about one of his actions in four is with a thing, while things last -
  // when one is within his reach and I am not on top of him: a plate, a mug
  // or a bottle to throw, a stool or a chair to swing
  if (!him.holding && room.hisItem && d > 1.05 && !(him.thingCool > 0)) {
    // (a thing in reach first; then kept to about one action in four)
    const p = M.things ?? 0.25, ratio = (him.thingActs || 0) / Math.max(1, him.acts);
    const task = pickThing(B, M);
    if (task && r.chance(ratio < p ? 0.85 : 0.15)) { him.thingActs = (him.thingActs || 0) + 1; return { task }; }
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

// a thing within his reach (its place to stand at most `REACH_THING` from
// him), by his manner: throwables more often than a stool
const REACH_THING = 3.2;
function pickThing(B, M) {
  const r = B.rng, c = B.c, room = B.room;
  const kinds = M.thingKinds || ['plate', 'mug', 'bottle', 'stool', 'chair'];
  const found = [];
  for (const k of kinds) {
    if (k === 'bottle' && !B.him.hadBottle) continue;
    const it = room.hisItem(k, c.pos);
    if (!it) continue;
    const p = it.stand || it.pos;
    if (Math.hypot(p.x - c.pos.x, p.z - c.pos.z) > REACH_THING) continue;
    found.push({ it, w: k === 'stool' || k === 'chair' ? 0.8 : 1 });
  }
  if (!found.length) return null;
  let tot = 0; for (const f of found) tot += f.w;
  let x = r.next() * tot;
  for (const f of found) { x -= f.w; if (x <= 0) return { kind: f.it.kind, item: f.it, t: 0 }; }
  return { kind: found[0].it.kind, item: found[0].it, t: 0 };
}

// ---- steering --------------------------------------------------------------------------------
// where he wants to be this step (null: stay)
function goalOf(B) {
  const him = B.him, c = B.c, eye = B.game.eye;
  if (B.holdStill) return null;
  const MM = B.manners || MANNERS, M = MM[him.manner] || MM.measured;
  // (reeling to the window: there in three seconds at most, however far)
  // (the clear floor before the glass is come at square, from the room:
  // first to a point 1.1 m in front of the spot, then back onto it - the
  // café tables and their chairs stand either side of that lane)
  if (him.state === 'reel') {
    if (!him.spot) return null;
    const S = him.spot, ax = S.x - 1.1;
    // (the arcade pass: by the open aisle - out into it where he stands, along
    // it to the window's bay, into the clear lane square to the glass, back
    // onto the spot. Straight at the lane point he caught on the booths and
    // the café tables and never got there)
    if (!him.reelPath || him.reelPath.spot !== S) {
      // (the aisle's middle: between the stools' seats and the booths' ends)
      // (the room's open lane: in the diner the aisle, 1.4 m off the counter)
      const aisle = B.room && B.room.lane != null ? B.room.lane : c.pos.x;
      const P = [];
      // (straight to the lane when nothing stands between: sampled every 15 cm)
      const clear = (x0, z0, x1, z1) => {
        const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.15);
        for (let i = 1; i <= n; i++) {
          const x = x0 + (x1 - x0) * i / n, z = z0 + (z1 - z0) * i / n;
          const q = _g.set(x, 0, z);
          B.game.stage.colliders.resolve(q, 0.35, c.fig.collider);
          if (Math.hypot(q.x - x, q.z - z) > 0.02) return false;
        }
        return true;
      };
      if (Math.abs(c.pos.z - S.z) > 0.6 && !clear(c.pos.x, c.pos.z, ax, S.z)) { P.push({ x: aisle, z: c.pos.z }, { x: aisle, z: S.z }); }
      P.push({ x: ax, z: S.z, lane: true }, { x: S.x, z: S.z, lane: true });
      him.reelPath = P; P.spot = S; him.reelI = 0; him.lane = false;
      let L = 0, px = c.pos.x, pz = c.pos.z;
      for (const q of P) { L += Math.hypot(q.x - px, q.z - pz); px = q.x; pz = q.z; }
      him.reelSpeed = Math.max(1.2, Math.min(3.0, L / 2.7));
    }
    const P = him.reelPath;
    while (him.reelI < P.length - 1 && Math.hypot(P[him.reelI].x - c.pos.x, P[him.reelI].z - c.pos.z) < 0.3) him.reelI++;
    const q = P[him.reelI];
    if (q.lane) him.lane = true;
    return { x: q.x, z: q.z, speed: him.reelSpeed, face: 'spot', tx: q.x };
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
  // (polish: a place he can stand - the point at arm's length from me can
  // fall on a stool or the counter, and with me in the gap between the
  // stools and the counter he stood off behind the stool for good: no blow
  // in reach, the lesson waiting on one. The goal is pushed out of the
  // furniture as his own body would be)
  if (g && him.state !== 'reel') {
    // (the block's colliders are many: the push is looked for again only
    // when the goal has moved 12 cm or a fifth of a second has gone)
    const GC = him.goalC || (him.goalC = { x: 1e9, z: 1e9, ox: 0, oz: 0, t: 0 });
    GC.t -= dt;
    if (GC.t <= 0 || Math.hypot(g.x - GC.x, g.z - GC.z) > 0.12) {
      const q = _g.set(g.x, 0, g.z);
      S.colliders.resolve(q, (F.collider ? F.collider.r : 0.35), F.collider);
      GC.x = g.x; GC.z = g.z; GC.ox = q.x - g.x; GC.oz = q.z - g.z; GC.t = 0.2;
    }
    g.x += GC.ox; g.z += GC.oz;
    // (and wedged - in the pocket between the counter, a stool and a stool
    // knocked over, wanting to move and not moving for a second and a half -
    // he steps out into the open aisle, away from the counter, first)
    const want = Math.hypot(g.x - F.pos.x, g.z - F.pos.z) > 0.3;
    him.wedgeT = want && (him.speed || 0) < 0.08 ? (him.wedgeT || 0) + dt : Math.max(0, (him.wedgeT || 0) - dt * 2);
    if (him.wedgeT > 1.5) him.outT = 1.0;
    if (him.outT > 0) {
      him.outT -= dt;
      const ax = B.room && B.room.lane != null ? B.room.lane + 0.1 : F.pos.x + 0.9;
      g.x = Math.max(ax, F.pos.x + 0.5); g.z = F.pos.z;
      if (him.outT <= 0) him.wedgeT = 0;
    }
  }
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
  // (reeling and held up a second - fallen stools round him in the pocket
  // by the counter - he stumbles over the stools and the chairs: only the
  // walls, the counter and the booths stop him)
  const blind = him.state === 'reel' && (him.stuckT || 0) > 1.0;
  if (free && V.lengthSq() > 1e-6) {
    const x0 = F.pos.x, z0 = F.pos.z;
    const p = _v.set(x0 + V.x * dt, 0, z0 + V.z * dt);
    S.colliders.resolve(p, (F.collider ? F.collider.r : 0.35), F.collider, !blind);
    // (round the furniture: blocked this way, he tries a way either side)
    if (Math.hypot(p.x - x0, p.z - z0) < V.length() * dt * 0.4) {
      for (const a of [0.7, -0.7, 1.3, -1.3]) {
        const q = new THREE.Vector3(x0 + (V.x * Math.cos(a) - V.z * Math.sin(a)) * dt, 0, z0 + (V.x * Math.sin(a) + V.z * Math.cos(a)) * dt);
        S.colliders.resolve(q, (F.collider ? F.collider.r : 0.35), F.collider, !blind);
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
    // (walking - circling, stepping out of a corner, going for a bottle -
    // his steering keeps him 1.25 m and more from me anyway; closer than
    // that he is only passing, and in the 1.1 m aisle a 1.1 m ring round my
    // eye walled him into the corner by the counter for good: he may pass
    // at arm's length)
    if (him.state === 'move' || him.state === 'arm') R = KEEP_OFF.pass;
    // (reeling to the window he brushes past me: I may stand in his lane)
    if (him.state === 'reel' && !him.atSpot) R = KEEP_OFF.reel;
    // (and his body: a haymaker or an overhand throws the chest and the
    // head well past the feet - they too stay KEEP_OFF.body from my eye:
    // the root goes back by as much as the body leans in toward me)
    if (R !== KEEP_OFF.pass && R !== KEEP_OFF.reel && dd > 1e-4 && c.object && c.bones.chest && c.bones.head) {
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
      // (reeling with me in his lane: he stumbles round me, not into me - a
      // turn about my eye toward the side his window lies)
      if (him.state === 'reel' && g && dd > 1e-4) {
        const gx = g.x - eye.x, gz = g.z - eye.z;
        const cr = dx * gz - dz * gx;
        const a = (cr >= 0 ? 1 : -1) * Math.min(0.06, 1.6 * dt);
        const ca = Math.cos(a), sa = Math.sin(a), rx = F.pos.x - eye.x, rz = F.pos.z - eye.z;
        F.pos.x = eye.x + rx * ca - rz * sa; F.pos.z = eye.z + rx * sa + rz * ca;
      }
      S.colliders.resolve(F.pos, (F.collider ? F.collider.r : 0.35), F.collider);
      // (a travelling clip sets his root from where it began every step:
      // its origin goes back with him, or the clip would carry him in again;
      // and the figure is drawn where he now stands, this frame)
      const ddx = F.pos.x - x0, ddz = F.pos.z - z0;
      if (F._rmClip) { F._rmClip.x0 += ddx; F._rmClip.z0 += ddz; }
      if (c.object) { c.object.position.x = F.pos.x; c.object.position.z = F.pos.z; }
    }
  }
  // facing: at me (the short way round, 5 rad/s: FIGHT.md v3 §4); through
  // a tell, at the place his blow is aimed (fixed when the tell began); in
  // the strike and after it, no turn at all
  const aimT = him.state === 'attack' && him.aim && him.t < him.strikeAt;
  const turnable = him.state === 'move' || him.state === 'arm' || (him.state === 'reel' && !him.atSpot) || aimT;
  if (turnable) {
    let want = aimT ? Math.atan2(him.aim.x - F.pos.x, him.aim.z - F.pos.z) : Math.atan2(eye.x - F.pos.x, eye.z - F.pos.z);
    // (reeling, he backs to the glass: his back to where he goes, so he
    // stands there with his back to it)
    if (him.state === 'reel' && g && g.face === 'spot') {
      const dx = g.x - F.pos.x, dz = g.z - F.pos.z;
      want = him.lane || Math.hypot(dx, dz) < 0.3 ? -Math.PI / 2 : Math.atan2(-dx, -dz);
    }
    const d = wrap(want - F.yaw);
    const rate = 5;
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
  if (v < 0.12) clip = Math.abs(him.yawRate || 0) > 1.0 && !reel ? 'br_pivot' : reel ? 'br_reel' : 'br_guard';
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

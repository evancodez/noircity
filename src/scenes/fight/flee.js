import * as THREE from 'three';
import { DINER } from '../../stages/block/site.js';

// [C4] The room clears round me (WAVE_C §6 II, the brief's §1: "people fleeing
// at the start run through me. They go round."). Each of them has a way out
// planned round me, Mack, the stools, the café tables and each other - a
// line of points down the open side of the aisle - and steers off every body
// on the way (a circle each: me, Mack, the others), slowing and turning his
// shoulders to squeeze past; the stools and tables are kept out of by the
// stage's colliders. The old man (nearest the door) is out first, then the
// couple; the docker backs off to the far wall at the north end; Dot ducks
// behind the counter. The street door is pushed open by whoever reaches it
// (stages/block/parts/dinerFront.js: the leaf never passes through a body)
// and the last one out lets it slam: the bar drops (02_fight.js).
//   *flee(ctx, c, pts, { speed, out })   a job: run the points; `out`: off
//                                        the pavement and gone at the end
//   ROUTES                               the ways out, by who
// The 'now' placement of the same room (a jump, a retry) is clearRoom(ctx,
// true) in 02_fight.js: the couple and the old man gone, the docker at the
// far wall, Dot down.
const P = (x, z) => ({ x, z });
export const ROUTES = {
  // the couple: out of the booth to the aisle, down its open side (between
  // the stools and the café chairs, east of where we stand), to the door
  couple_her: [P(-12.5, 7.8), P(-12.35, 6.2), P(-12.0, 4.5), P(-11.95, 2.3), P(-11.65, 1.05), P(-11.05, 0.62), P(-10.15, 0.6), P(-9.3, 0.6), P(-8.65, 1.6), P(-8.3, 5.5), P(-8.2, 12.5)],
  couple_him: [P(-12.55, 9.0), P(-12.45, 7.2), P(-12.25, 5.6), P(-11.95, 3.6), P(-11.9, 2.0), P(-11.6, 1.0), P(-11.05, 0.6), P(-10.15, 0.6), P(-9.3, 0.62), P(-8.7, 1.7), P(-8.35, 6.0), P(-8.25, 13.0)],
  // the old man: off his stool at the south end and out first, the short way
  oldman: [P(-13.05, -2.0), P(-12.25, -0.75), P(-11.6, 0.3), P(-11.05, 0.58), P(-10.15, 0.6), P(-9.3, 0.58), P(-8.7, -0.5), P(-8.35, -4.5), P(-8.3, -9.5)],
  // the docker: back from his stool to the far wall, north, out of it
  docker: [P(-13.45, 9.3), P(-13.1, 10.9)],
};
export const DOCKER_AT = { x: -13.1, z: 10.9 };

const _v = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0), _q = new THREE.Quaternion();
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// the bodies a runner keeps off: me, Mack, the cast still on their feet
function bodies(ctx, self) {
  const out = [];
  const e = ctx.game.eye;
  out.push({ x: e.x, z: e.z, r: 0.38, me: true });
  for (const c of ctx.cast.list) {
    if (c === self || !c.fig || c.down) continue;
    out.push({ x: c.pos.x, z: c.pos.z, r: c.kind === 'brawler' ? 0.42 : 0.3, who: c.name });
  }
  return out;
}

// a runner: the points in order, a circle round every body, the room's
// furniture kept out by its colliders. speed m/s; run: the run cycle
export function* flee(ctx, c, pts, { speed = 2.6, run = true, out = false, r = 0.3, log = null, onOut = null } = {}) {
  const G = ctx.game, S = ctx.stage, F = c.fig;
  if (c.seat) c.stand();
  c.clipH = null;
  c.base = run ? 'run' : 'walk'; c.state = c.base;
  c._anim(c.base, 0.2);
  F.speed = 0;
  let i = 0, t0 = G.time, last = G.time, slow = 0, stuck = 0, best = 1e9;
  const rec = log ? (log[c.name] = { min: 9, minWho: null, through: 0 }) : null;
  // (the shoulders turned to squeeze past: the spine and the chest twisted
  // after the clip's pose - the figure's bones are written fresh every step,
  // cast/diner/steady.js, so the twist never winds on)
  const prevAfter = F.afterPose;
  c._twist = 0;
  F.afterPose = (h, dt) => {
    if (prevAfter) prevAfter(h, dt);
    const want = (c.turnShoulders || 0) * 0.62;
    c._twist += (want - c._twist) * Math.min(1, dt * 9);
    if (Math.abs(c._twist) < 1e-3) return;
    for (const b of [h.bones.spine, h.bones.chest]) if (b) b.quaternion.multiply(_q.setFromAxisAngle(_y, c._twist / 2));
  };
  for (let n = 0; n < 60 * 30 && i < pts.length; n++) {
    const dt = Math.max(1 / 240, Math.min(1 / 20, G.time - last || 1 / 60)); last = G.time;
    const B = bodies(ctx, c);
    // (out of the furniture and never inside a body: after the step's move)
    if (S.colliders) { _v.set(F.pos.x, 0, F.pos.z); S.colliders.resolve(_v, r * 0.9, F.collider); F.pos.x = _v.x; F.pos.z = _v.z; }
    let squeeze = 0;
    for (const b of B) {
      const ox = F.pos.x - b.x, oz = F.pos.z - b.z, od = Math.hypot(ox, oz), R = b.r + r;
      if (rec) { if (od - R < rec.min) { rec.min = +(od - R).toFixed(3); rec.minWho = b.me ? 'me' : b.who; } if (od < R - 0.05) rec.through++; }
      if (od < R && od > 1e-4) { F.pos.x = b.x + ox / od * R; F.pos.z = b.z + oz / od * R; }
    }
    // (out past the shopfront: no longer in the room)
    if (onOut && F.pos.x > DINER.faceX + 0.3) { onOut(); onOut = null; }
    const q = pts[i];
    const dx = q.x - F.pos.x, dz = q.z - F.pos.z, d = Math.hypot(dx, dz);
    if (d < (i === pts.length - 1 ? 0.2 : 0.5)) { i++; n--; stuck = 0; best = 1e9; continue; }
    // (held up - a body in the way that will not move - for two seconds: on
    // to the next point of the way, round it)
    if (d < best - 0.05) { best = d; stuck = 0; } else if ((stuck += dt) > 2.0 && i < pts.length - 1) { i++; stuck = 0; best = 1e9; if (rec) rec.skips = (rec.skips || 0) + 1; continue; }
    // the way to the next point, bent round the bodies ahead (a circle each:
    // the side of it the runner already is on)
    let wx = dx / d, wz = dz / d;
    for (const b of B) {
      const ox = b.x - F.pos.x, oz = b.z - F.pos.z, od = Math.hypot(ox, oz);
      const R = b.r + r + 0.22;
      if (od > R + 1.1 || od < 1e-4) continue;
      const ahead = (ox * wx + oz * wz) / od;
      if (ahead < -0.2) continue;
      // (the side to pass on: the side the body's centre is not, from the way)
      const side = (wx * oz - wz * ox) > 0 ? -1 : 1;
      const k = Math.max(0, Math.min(1.6, (R + 1.1 - od) / 1.1)) * (0.4 + 0.6 * Math.max(0, ahead));
      // (aside of the body, and away from it when inside its circle)
      wx += (-oz / od) * side * k * 1.2 - (od < R ? ox / od * 1.5 : 0);
      wz += (ox / od) * side * k * 1.2 - (od < R ? oz / od * 1.5 : 0);
      if (od < R + 0.35) squeeze = Math.max(squeeze, 1 - (od - R) / 0.35);
    }
    const wl = Math.hypot(wx, wz) || 1;
    wx /= wl; wz /= wl;
    const want = Math.atan2(wx, wz);
    F.yaw = wrap(F.yaw + Math.sign(wrap(want - F.yaw)) * Math.min(Math.abs(wrap(want - F.yaw)), 9 * dt));
    // (squeezing past a body: slower, the shoulders turned - his chest turned
    // across the way, a quarter turn of the upper body)
    slow += ((squeeze > 0.15 ? 0.68 : 1) - slow) * Math.min(1, dt * 8);
    F.speed = speed * slow;
    c.turnShoulders = squeeze > 0.15 ? Math.sign(wrap(want - Math.atan2(dx, dz))) || 1 : 0;
    yield null;
  }
  F.speed = 0;
  c.turnShoulders = 0;
  F.afterPose = prevAfter;
  c.base = 'idle'; c.state = 'idle';
  c._anim('idle', 0.3);
  if (out) ctx.cast.remove(c);
  void t0;
}

import { buildPath, samplePath, route, nearestNode } from '../../stages/city/route.js';
import { riverProject, riverPoint, RIVER_LEN, PIER } from '../../stages/city/plan.js';
import { RNG } from '../../util/rng.js';

// A player's hands for the tail's proofs (lane C3): what keys a player
// would hold this moment, decided from what a player sees (his car, the
// road his car takes - its tail lamps going round a corner - the corner
// ahead). The page's driver (tools/lib/c3_tail.mjs) presses them by real
// input; the headless run (tools/lib/c3city.mjs) gives them to the car.
//   makeBot(chase, profile, { seed }) -> { tick(dt) -> { W, S, A, D, Space }, aimAt() }
// Profiles:
//   idle   hands off
//   good   reads the corners (brakes before them, the handbrake at the
//          tight ones), keeps 12 to 30 m off him, never rams him in a
//          (a player who uses what was taught)
//   bad    a first-timer: late on the brakes (into corners too fast), slow
//          hands (a quarter second behind), a wobble on the wheel, and a
//          wrong turn now and then (on past his corner: round the block
//          by the streets to find him again)
//   chaser (tuning) follows his way at his speed, as close as is safe
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

const PROFILES = {
  idle: null,
  good: { aLat: 7.2, brake: 6.5, lag: 0.08, wobble: 0, keep: 13, far: 26, hb: true, wrong: 0, look: 1.0, gunGap: 14, gunAt: 26, aimTol: 0.01, aimJit: 0.004 },
  bad: { aLat: 8.6, brake: 4.8, lag: 0.15, wobble: 0.04, keep: 10, far: 22, hb: false, wrong: 0.5, look: 0.9, damp: 0.2, gunGap: 18, gunAt: 30, aimTol: 0.03, aimJit: 0.05, fireGap: 0.35, aimAt: 'window' },
  chaser: { aLat: 7.5, brake: 6, lag: 0, wobble: 0, keep: 11, far: 22, hb: false, wrong: 0, look: 1.0 },
};

export function makeBot(chase, name, { seed = 7, track = null, attempt = 0 } = {}) {
  let P = PROFILES[name];
  if (!P) return { tick: () => ({}), name };
  // (a first-timer learns: each try after a failure a little more careful
  // into the corners, a little steadier; and having lost him once by a
  // wrong turn, he knows the way the next time but one)
  if (attempt > 0 && name === 'bad') P = { ...P, aLat: Math.max(7.2, P.aLat - 0.6 * attempt), brake: Math.min(6, P.brake + 0.5 * attempt), wobble: P.wobble * 0.6, wrong: attempt >= 2 ? 0 : P.wrong * 0.5 };
  const rng = new RNG(seed);
  const B = {
    name, P, rng, path: null, pathKey: '', i: -1, t: 0, queue: [], keys: {}, wrongT: 0, wrongUsed: 0, detour: null, stuckT: 0, backT: 0,
    tick(dt) {
      B.t += dt;
      const want = B.decide(dt);
      // (slow hands: what is decided now is done a little later)
      B.queue.push([B.t + P.lag, want]);
      while (B.queue.length > 1 && B.queue[1][0] <= B.t) B.queue.shift();
      if (B.queue[0][0] <= B.t) B.keys = B.queue[0][1];
      return B.keys;
    },
    // the road his car takes (every junction he has committed to)
    ensurePath() {
      const D = chase.driver, my = chase.my;
      if (B.detour) return B.detour;
      // phase c: round his wreck (the side of the road with the room) and on
      // down the river road to the pier's yard
      if (chase.phase === 'c') {
        if (B.pathKey !== 'pier') {
          const w = chase.his.pos, wp = riverProject(w.x, w.z, {}), mp = riverProject(my.pos.x, my.pos.z, {});
          // (the side with the room: past his wreck and clear of the el's
          // columns and the posts)
          const T0 = chase.stage ? chase.stage.track : track;
          const hb = chase.his.box();
          const clear = (d) => {
            for (let s2 = wp.s - 12; s2 <= wp.s + 12; s2 += 2) {
              const q = riverPoint(s2, d);
              const lx = (q.x - hb.cx) * hb.c - (q.z - hb.cz) * hb.s, lz = (q.x - hb.cx) * hb.s + (q.z - hb.cz) * hb.c;
              if (Math.abs(lx) < hb.hx + 1.4 && Math.abs(lz) < hb.hz + 1.4) return false;
              if (T0) for (const k of T0.statics(q.x, q.z, 2, [])) { if (k.r != null && !k.gone && Math.hypot(k.x - q.x, k.z - q.z) < k.r + 1.5) return false; if (k.r == null && k.tag !== 'post' && Math.abs((q.x - k.cx) * k.c - (q.z - k.cz) * k.s) < k.hx + 1.2 && Math.abs((q.x - k.cx) * k.s + (q.z - k.cz) * k.c) < k.hz + 1.2) return false; }
            }
            return true;
          };
          const cands = (wp.d > 0 ? [-3, -1.5, -4.5, 4.2, 5.5] : [3, 1.5, 4.5, -4.2, -5.5]).concat([0, 6, -6]);
          const side = cands.find(clear) ?? (wp.d > 0 ? -3.2 : 3.2);
          B.pierSide = side;
          const pts = [[my.pos.x, my.pos.z]];
          for (let s2 = mp.s + 6; s2 < RIVER_LEN - 2; s2 += 3) {
            const near = Math.abs(s2 - wp.s) < 14;
            if (s2 < wp.s - 14 && s2 < mp.s + 10) continue;
            const q = riverPoint(s2, near ? side : 1.45 * 0.45);
            pts.push([q.x, q.z]);
          }
          pts.push([PIER.park.x - 4, PIER.park.z - 3], [PIER.park.x, PIER.park.z]);
          B.path = samplePath(pts, { vmax: 16, aLat: P.aLat * 0.9, aBrake: P.brake });
          B.pathKey = 'pier'; B.i = -1;
        }
        return B.path;
      }
      if (D.state === 'river' || D.state === 'lost' || D.state === 'stopped') {
        if (B.pathKey !== 'river') { B.path = samplePath(D.path.pts.map((p) => [p.x, p.z]), { vmax: 22, aLat: P.aLat, aBrake: P.brake }); B.pathKey = 'river'; B.i = -1; }
        return B.path;
      }
      const ids = D.allIds || D.ids;
      const key = ids.join(',');
      if (key !== B.pathKey) {
        B.path = buildPath(ids.concat(D.ids.slice(D.ids.indexOf(ids[ids.length - 1]) + 1, D.ids.indexOf(ids[ids.length - 1]) + 2)), { vmax: 22, aLat: P.aLat, aBrake: P.brake, laneK: 0.45, rRight: 8, rLeft: 9 });
        B.pathKey = key;
        B.i = B.path.nearestAll(my.pos.x, my.pos.z);
      }
      return B.path;
    },
    decide(dt) {
      const my = chase.my, his = chase.his, D = chase.driver;
      const K = { W: 0, S: 0, A: 0, D: 0, Space: 0 };
      if (chase.phase === 'start' || chase.failing) return K;
      if (chase.phase === 'wreck' || chase.phase === 'parked' || chase.phase === 'crash') return { S: my.speed > 0.5 ? 1 : 0 };
      const path = B.ensurePath();
      if (!path) return K;
      if (B.i < 0) B.i = path.nearestAll(my.pos.x, my.pos.z);
      B.i = path.nearest(my.pos.x, my.pos.z, B.i, 30);
      const p = path.pts[B.i];
      const s = p.s;
      const sp = Math.max(0, my.speed);
      // a wrong turn (the bad one): on past a corner, then the streets round
      if (P.wrong && !B.detour && B.wrongUsed < 1 && chase.phase === 'a' && B.t > 25) {
        const ahead = path.at(Math.min(path.len, s + 12), {}), here = path.at(s, {});
        const turn = Math.abs(Math.atan2(ahead.fx * here.fz - ahead.fz * here.fx, ahead.fx * here.fx + ahead.fz * here.fz));
        // (only where straight on is a street: a man misses a turn, he does
        // not drive at a wall he can see)
        const T0 = chase.stage ? chase.stage.track : track;
        const open = T0 && !T0.blocked(my.pos.x, my.pos.z, my.pos.x + here.fx * 40, my.pos.z + here.fz * 40, ['wall', 'fence', 'works', 'gate', 'barrier', 'rail']);
        if (turn > 0.9 && open && rng.next() < P.wrong * dt * 4) { B.wrongUsed++; B.wrongT = 2.4; B.wrongDir = [here.fx, here.fz]; }
      }
      if (B.wrongT > 0) {
        B.wrongT -= dt;
        // straight on past his corner, then find the way to him again
        const yawW = Math.atan2(-B.wrongDir[1], B.wrongDir[0]);
        const e = Math.atan2(Math.sin(yawW - my.yaw), Math.cos(yawW - my.yaw));
        K.W = 1; K.A = e > 0.08 ? 1 : 0; K.D = e < -0.08 ? 1 : 0;
        // (he sees he has missed it: off the throttle, onto the brake)
        if (B.wrongT < 1.4) { K.W = 0; K.S = my.speed > 4 ? 1 : 0; }
        if (B.wrongT <= 0) B.replan();
        return K;
      }
      // the point to steer for
      const Ld = clamp((4.5 + sp * 0.42) * P.look, 4.5, 15);
      const T = path.at(Math.min(path.len, s + Ld), {});
      const c = Math.cos(my.yaw), sn = Math.sin(my.yaw);
      const dx = T.x - my.pos.x, dz = T.z - my.pos.z;
      let fx = dx * c - dz * sn, fz = dx * sn + dz * c;
      // (a car standing in my way - his wreck, a parked one into the road, a
      // car stopped at a junction - is steered round, as anyone would)
      const bodies = chase.bodies ? chase.bodies() : [];
      for (const o of bodies) {
        if (o === my || !o.solid || (o === his && chase.phase === 'a')) continue;
        const ox = o.pos.x - my.pos.x, oz = o.pos.z - my.pos.z;
        if (Math.abs(ox) > 26 || Math.abs(oz) > 26) continue;
        const ax = ox * c - oz * sn, az = ox * sn + oz * c;
        if (ax < 2 || ax > 22) continue;
        const pz = fz * (ax / Math.max(1, fx));
        const d = az - pz;
        if (Math.abs(d) < 2.3) fz += -Math.sign(d || 1) * (2.3 - Math.abs(d)) * (1 - ax / 24) * 1.4;
      }
      let ang = Math.atan2(-fz, fx) - my.yawRate * (P.damp ?? 0.12);
      if (P.wobble) ang += Math.sin(B.t * 2.3) * P.wobble;
      const dead = 0.035;
      K.A = ang > dead ? 1 : 0; K.D = ang < -dead ? 1 : 0;
      // the speed: the corner ahead allows, his car ahead asks
      let want = path.at(Math.min(path.len, s + 1 + sp * 0.3), {}).v;
      if (chase.phase === 'a' || chase.phase === 'start') {
        const gap = chase.gap();
        const ahead = (his.pos.x - my.pos.x) * c - (his.pos.z - my.pos.z) * sn;
        if (ahead > 0 && gap < P.keep) want = Math.min(want, Math.max(0, his.speed - 1.5));
        else if (gap < P.far) want = Math.min(want, his.speed + 2 + (gap - P.keep) * 0.4);
      }
      if (chase.phase === 'b' && P.gunGap) {
        // (in the river road's run: close to him, then hold a shooting range)
        const gap = chase.gap();
        if (gap < P.gunGap) want = Math.min(want, his.speed + (gap - P.gunGap * 0.7) * 0.3);
      }
      if (chase.phase === 'c' && B.pierStop) want = Math.min(want, B.pierStop(my));
      // stuck: back off
      if (B.backT > 0) { B.backT -= dt; return { S: 1, A: K.D, D: K.A }; }
      B.stuckT = want > 2 && sp < 0.6 ? B.stuckT + dt : 0;
      if (B.stuckT > 1.5) { B.stuckT = 0; B.backT = 1.2; }
      const e = want - sp;
      if (e > 0.4) K.W = 1;
      else if (e < -1.2) K.S = 1;
      // the handbrake at a tight corner, a good hand on it
      if (P.hb && sp > 7 && sp < 14) {
        const ahead = path.at(Math.min(path.len, s + 4), {}), here = path.at(s, {});
        const turn = Math.abs(Math.atan2(ahead.fx * here.fz - ahead.fz * here.fx, ahead.fx * here.fx + ahead.fz * here.fz));
        if (turn > 0.5 && Math.abs(ang) > 0.35) { K.Space = 1; K.W = 0; }
      }
      return K;
    },
    // phase b: the gun (RMB held once he is near, the sights onto his car's
    // back - a tyre for the good hand, wherever for the bad - LMB when on).
    // { rmb, dyaw, dpitch (radians: the turn the mouse must make), fire }
    aim() {
      if (chase.phase !== 'b' || !chase.his || !chase.game) return null;
      const G = chase.game, cam = G.camera, his = chase.his, gap = chase.gap();
      const out = { rmb: gap < (P.gunAt ?? 28), fire: false, dyaw: 0, dpitch: 0 };
      if (!out.rmb || !chase.gun || chase.gun.aimK < 0.95) return out;
      // the target on his car (its frame: x ahead, z right): the rear tyre on
      // the near side, or the rear window
      const tgt = B.target || (B.target = P.aimAt === 'window' ? [-1.6, 1.3, 0] : [-1.55, 0.42, 0.76]);
      const w = his.seat(new (cam.position.constructor)(tgt[0], tgt[1], tgt[2] * (B.side || 1)));
      w.applyMatrix4(cam.matrixWorldInverse);
      const ay = Math.atan2(w.x, -w.z), ap = Math.atan2(w.y, Math.hypot(w.x, w.z));
      const jit = (P.aimJit ?? 0.004) * (rng.next() - 0.5);
      out.dyaw = ay + jit; out.dpitch = ap + jit;
      const tol = P.aimTol ?? 0.012;
      out.fire = Math.abs(ay) < tol && Math.abs(ap) < tol * 1.5 && B.t - (B.lastFire || -9) > (P.fireGap ?? 0.45);
      if (out.fire) { B.lastFire = B.t; B.side = rng.next() < 0.5 ? 1 : -1; B.target = null; }
      return out;
    },
    // back on his way from wherever I am: the streets from the nearest
    // junction to the one he passed last
    replan() {
      const my = chase.my, D = chase.driver;
      const ids = D.allIds || D.ids;
      const from = nearestNode(my.pos.x, my.pos.z);
      // (the junction of his I can reach that is furthest along his way)
      let best = null;
      for (let k = ids.length - 1; k >= 0 && !best; k--) { const r = route(from.id, ids[k]); if (r && r.length > 1) best = { r, k }; }
      if (!best) { B.detour = null; return; }
      const rest = ids.slice(best.k + 1);
      const all = best.r.concat(rest);
      try { B.detour = buildPath(all, { vmax: 22, aLat: P.aLat, aBrake: P.brake, laneK: 0.45, rRight: 8, rLeft: 9 }); B.i = -1; B.detourIds = all; } catch (e) { B.detour = null; }
      B.pathKey = '';
      // (the detour is let go once I am back on his way)
      B.detourUntil = all;
    },
  };
  // phase c: a stop by the pier's gate
  B.pierStop = (my) => { const k = chase.pierPark || { x: 133, z: 176 }; const d = Math.hypot(my.pos.x - k.x, my.pos.z - k.z); return Math.sqrt(Math.max(0, 2 * 3.5 * (d - 2))); };
  // once the detour reaches his road, back to following him
  const tick0 = B.tick;
  B.tick = (dt) => {
    if (B.detour && B.i > 0 && B.detour.len - B.detour.pts[B.i].s < 20) { B.detour = null; B.pathKey = ''; B.i = -1; }
    return tick0(dt);
  };
  void track;
  return B;
}

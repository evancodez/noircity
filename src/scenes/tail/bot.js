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
//   follow the good hands' driving with the gun never drawn (a proof that
//          he reaches the pier's gate if I do not stop him)
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

const PROFILES = {
  idle: null,
  good: { aLat: 7.2, brake: 6.5, lag: 0.08, wobble: 0, keep: 13, far: 26, hb: true, wrong: 0, look: 1.0, gunGap: 14, gunAt: 32, aimTol: 0.01, aimJit: 0.004 },
  // ([4th owner] the bad hands aim like a sloppy hand - the eye drifting
  // round the mark, at whatever part of his car - and shunt him when dry)
  bad: { aLat: 8.6, brake: 4.8, lag: 0.15, wobble: 0.04, keep: 10, far: 22, hb: false, wrong: 0.5, look: 0.9, damp: 0.2, gunGap: 18, gunAt: 30, aimSd: 0.02, aimTol: 0.035, aimReact: 0.1, aimGain: 3.5, fireGap: 0.45, aimAt: 'any', pit: true },
  chaser: { aLat: 7.5, brake: 6, lag: 0, wobble: 0, keep: 11, far: 22, hb: false, wrong: 0, look: 1.0 },
  // [3rd owner] the good hands on the wheel, the gun never drawn: keeps up
  // with him down the river road and never stops him (he reaches the gate)
  follow: { aLat: 7.2, brake: 6.5, lag: 0.08, wobble: 0, keep: 13, far: 26, hb: true, wrong: 0, look: 1.0, gunGap: 14, noGun: true },
  // [4th owner] hands that aim like hands (bot.aim: the eye drifts round the
  // mark, the press comes after a reaction): the critic's 'good aim' and
  // 'sloppy' (good driving), and 'badsloppy' (the bad driving and a sloppy hand)
  aimer: { aLat: 7.2, brake: 6.5, lag: 0.08, wobble: 0, keep: 13, far: 26, hb: true, wrong: 0, look: 1.0, gunGap: 14, gunAt: 30, aimSd: 0.006, aimTol: 0.012, aimReact: 0.18, aimGain: 6, fireGap: 0.6 },
  sloppy: { aLat: 7.2, brake: 6.5, lag: 0.08, wobble: 0, keep: 13, far: 26, hb: true, wrong: 0, look: 1.0, gunGap: 14, gunAt: 30, aimSd: 0.02, aimTol: 0.035, aimReact: 0.1, aimGain: 3.5, fireGap: 0.45, aimAt: 'any' },
  badsloppy: { aLat: 8.6, brake: 4.8, lag: 0.15, wobble: 0.04, keep: 10, far: 22, hb: false, wrong: 0.5, look: 0.9, damp: 0.2, gunGap: 18, gunAt: 30, aimSd: 0.02, aimTol: 0.035, aimReact: 0.1, aimGain: 3.5, fireGap: 0.45, aimAt: 'any' },
  // (the shunt alone: the sloppy hand, and the shunt once dry)
  pitter: { aLat: 7.2, brake: 6.5, lag: 0.08, wobble: 0, keep: 13, far: 26, hb: true, wrong: 0, look: 1.0, gunGap: 14, gunAt: 30, aimSd: 0.02, aimTol: 0.035, aimReact: 0.1, aimGain: 3.5, fireGap: 0.45, aimAt: 'any', pit: true },
};

export function makeBot(chase, name, { seed = 7, track = null, attempt = 0 } = {}) {
  let P = PROFILES[name];
  if (!P) return { tick: () => ({}), name };
  // (a first-timer learns: each try after a failure a little more careful
  // into the corners, a little steadier; and having lost him once by a
  // wrong turn, he knows the way the next time but one)
  if (attempt > 0 && name === 'bad') P = { ...P, aLat: Math.max(7.2, P.aLat - 0.6 * attempt), brake: Math.min(6, P.brake + 0.5 * attempt), wobble: P.wobble * 0.6, wrong: attempt >= 2 ? 0 : P.wrong * 0.5,
    // ([4th owner] and a steadier hand on the gun)
    aimSd: Math.max(0.009, P.aimSd * (1 - 0.22 * attempt)) };
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
          // (the room at an offset d across the road, past his wreck: the
          // nearest thing - the wreck's box, a column, a post, the rail, a
          // wall - to a line at d over the wreck's stretch, m)
          const near = [];
          const room = (d) => {
            let m = Infinity;
            for (let s2 = wp.s - 12; s2 <= wp.s + 12; s2 += 1.5) {
              const q = riverPoint(s2, d);
              const lx = (q.x - hb.cx) * hb.c - (q.z - hb.cz) * hb.s, lz = (q.x - hb.cx) * hb.s + (q.z - hb.cz) * hb.c;
              m = Math.min(m, Math.hypot(Math.max(0, Math.abs(lx) - hb.hx), Math.max(0, Math.abs(lz) - hb.hz)));
              if (T0) for (const k of T0.statics(q.x, q.z, 3, near)) {
                if (k.gone) continue;
                if (k.r != null) { m = Math.min(m, Math.hypot(k.x - q.x, k.z - q.z) - k.r); continue; }
                const kx = (q.x - k.cx) * k.c - (q.z - k.cz) * k.s, kz = (q.x - k.cx) * k.s + (q.z - k.cz) * k.c;
                m = Math.min(m, Math.hypot(Math.max(0, Math.abs(kx) - k.hx), Math.max(0, Math.abs(kz) - k.hz)));
              }
              near.length = 0;
            }
            return m;
          };
          // the offset with the most room (a car's half and a hand), the
          // nearer the lane the better; after a try that wedged, another
          let best = null;
          for (let d = -8; d <= 8.01; d += 0.5) {
            const r = room(d);
            if (r < 1.3) continue;
            const score = Math.min(r, 2.4) - Math.abs(d - 0.65) * 0.03 - (B.pierTried || []).filter((t) => Math.abs(t - d) < 1.6).length * 3;
            if (!best || score > best.score) best = { d, score };
          }
          const side = best ? best.d : (wp.d > 0 ? -3.2 : 3.2);
          B.pierSide = side;
          (B.pierTried || (B.pierTried = [])).push(side);
          const pts = [[my.pos.x, my.pos.z]];
          for (let s2 = mp.s + 4; s2 < RIVER_LEN - 2; s2 += 2) {
            const ds = Math.abs(s2 - wp.s);
            const k = ds < 10 ? 1 : ds < 22 ? 1 - (ds - 10) / 12 : 0;
            if (s2 < wp.s - 22 && s2 < mp.s + 10) continue;
            const q = riverPoint(s2, 0.65 + (side - 0.65) * k * k * (3 - 2 * k));
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
      // [4th owner] (phase b: a slower car in my lane ahead and the other
      // lane clear: out and past it, as he does - the good hands sat behind
      // the river road's slow car and lost the shot)
      if (chase.phase === 'b' && P.gunGap) {
        let slow = false, oncoming = false;
        for (const o of chase.bodies ? chase.bodies() : []) {
          if (o === my || o === his || !o.solid || o.parked) continue;
          const ox = o.pos.x - my.pos.x, oz = o.pos.z - my.pos.z;
          if (Math.abs(ox) > 70 || Math.abs(oz) > 70) continue;
          const ax = ox * c - oz * sn, az = ox * sn + oz * c;
          const facing = Math.cos((o.yaw || 0) - my.yaw) < -0.5;
          if (facing && ax > -2 && ax < 55 && az < 1 && az > -6) oncoming = true;
          if (!facing && ax > 2 && ax < 24 && Math.abs(az) < 2.4 && Math.hypot(o.vel.x, o.vel.z) < sp + 1) slow = true;
        }
        if (slow && !oncoming && !(B.passT > 0)) B.passT = 3.2;
        if (oncoming && B.passT > 0.8) B.passT = 0.8;
        B.passT = Math.max(0, (B.passT || 0) - dt);
        const k = B.passT > 0 ? Math.min(1, B.passT / 0.8) * 3.0 : 0;
        if (k) { T.x += T.fz * k; T.z -= T.fx * k; }
      }
      const dx = T.x - my.pos.x, dz = T.z - my.pos.z;
      let fx = dx * c - dz * sn, fz = dx * sn + dz * c;
      // [4th owner] the gun dry and he hurt (rules.js RAM): the shunt - up
      // beside his back quarter on the side with the road, then the wheel
      // into it (the dry gun's teach card says so)
      const g = chase.gun, Dh = chase.driver, H = chase.hisDmg || {};
      const hurt = (H.tyres || 0) >= 1 || (H.man || 0) >= 2 || (H.tank || 0) >= 2 || (Dh && Dh.control <= 0.5);
      let pitWant = null;
      if (chase.phase === 'b' && P.pit && g && g.rounds <= 0 && g.pocket <= 0 && g.reloadT <= 0 && Dh && Dh.state !== 'lost') {
        const side = B.pitSide || (B.pitSide = -1);           // (his left: the other lane)
        const l = his.local(my.pos);
        const lead = his.vel.clone().multiplyScalar(0.35);
        const set = (q) => { const ddx = q.x + lead.x - my.pos.x, ddz = q.z + lead.z - my.pos.z; fx = ddx * c - ddz * sn; fz = ddx * sn + ddz * c; };
        const beside = Math.abs(l.x + 3.6) < 1.6 && Math.abs(l.z - side * 2.4) < 1.1;
        // (out beside him only when near and the other lane is clear ahead:
        // far behind, close up on his line first)
        let clearSide = true;
        for (const o of chase.bodies ? chase.bodies() : []) {
          if (o === my || o === his || !o.solid) continue;
          const q = his.local(o.pos);
          // (a car on that side near him, or one coming the other way there)
          const coming = Math.cos((o.yaw || 0) - his.yaw) < -0.5;
          if (q.x > -12 && q.x < (coming ? 40 : 14) && Math.sign(q.z || 1) === side && Math.abs(q.z) < 6) { clearSide = false; break; }
        }
        // (that side shut a while: the other)
        B.pitShut = !clearSide && l.x > -14 ? (B.pitShut || 0) + dt : 0;
        if (B.pitShut > 2.5) { B.pitShut = 0; B.pitSide = -side; }
        if (l.x < -11 || !clearSide) { pitWant = l.x < -11 ? his.speed + clamp((-8 - l.x) * 0.5, 0, 6) : his.speed - 1; B.pitIn = 0; }
        else if (hurt && beside) { set(his.world(-1.2, side * 0.4)); pitWant = his.speed + 2.5; B.pitIn = (B.pitIn || 0) + dt; }
        else { set(his.world(-3.6, side * 2.4)); pitWant = his.speed + clamp((-3.6 - l.x) * 0.8, -4, 6); B.pitIn = 0; }
        if (B.pitIn > 1.6) { B.pitIn = 0; B.pitSide = -side; }
      }
      // (a car standing in my way - his wreck, a parked one into the road, a
      // car stopped at a junction - is steered round, as anyone would)
      const bodies = chase.bodies ? chase.bodies() : [];
      for (const o of bodies) {
        if (o === my || !o.solid || (o === his && (chase.phase === 'a' || pitWant != null))) continue;
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
      if (pitWant != null) want = Math.max(0, pitWant);
      // stuck: back off
      if (B.backT > 0) { B.backT -= dt; return { S: 1, A: K.D, D: K.A }; }
      B.stuckT = want > 2 && sp < 0.6 ? B.stuckT + dt : 0;
      // (or no way made in three seconds of wanting to go: a wedge that
      // rocks - back off too)
      const pg = B.prog || (B.prog = { t: B.t, x: my.pos.x, z: my.pos.z });
      if (want <= 2) { pg.t = B.t; pg.x = my.pos.x; pg.z = my.pos.z; }
      else if (B.t - pg.t > 3) { if (Math.hypot(my.pos.x - pg.x, my.pos.z - pg.z) < 1.5) B.stuckT = 9; pg.t = B.t; pg.x = my.pos.x; pg.z = my.pos.z; }
      if (B.stuckT > 1.5) { B.stuckT = 0; B.backT = 1.6; if (chase.phase === 'c') B.pathKey = ''; }
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
      if (chase.phase !== 'b' || !chase.his || !chase.game || P.noGun) return null;
      const G = chase.game, cam = G.camera, his = chase.his, gap = chase.gap();
      // ([4th owner] dry: the gun goes back in, the eyes on the road)
      const dry = chase.gun && chase.gun.rounds <= 0 && chase.gun.pocket <= 0 && chase.gun.reloadT <= 0;
      const out = { rmb: gap < (P.gunAt ?? 28) && !dry, fire: false, dyaw: 0, dpitch: 0 };
      // ([4th owner] the dt of this step, for the hand's drift and its wait)
      const dtA = Math.max(0, Math.min(0.1, B.t - (B.aimT ?? B.t))); B.aimT = B.t;
      if (!out.rmb || !chase.gun || chase.gun.aimK < 0.95) { B.onT = 0; return out; }
      // the target on his car (its frame: x ahead, z right): the rear tyre on
      // the near side, or the rear window ([4th owner] or, for a hand that
      // shoots at whatever it can: a quarter, the window or the tank)
      const pick = () => { const a = P.aimAt === 'any' ? ['quarter', 'quarter', 'window', 'tank'][Math.floor(rng.next() * 4)] : P.aimAt || 'quarter'; return a === 'window' ? [-1.6, 1.3, 0] : a === 'tank' ? [-2.3, 0.75, 0] : [-1.55, 0.42, 0.76]; };
      const tgt = B.target || (B.target = pick());
      const w = his.seat(new (cam.position.constructor)(tgt[0], tgt[1], tgt[2] * (B.side || 1)));
      // ([4th owner] a hand leads a moving mark a little: where his car will
      // be as the press lands - and less my own car's way)
      const lead = P.aimLead ?? 0.08;
      if (lead) { w.addScaledVector(his.vel, lead); w.addScaledVector(chase.my.vel, -lead); }
      w.applyMatrix4(cam.matrixWorldInverse);
      const ay = Math.atan2(w.x, -w.z), ap = Math.atan2(w.y, Math.hypot(w.x, w.z));
      const tol = P.aimTol ?? 0.012;
      if (P.aimSd) {
        // [4th owner] a hand, not a turret (the critic, 2nd look: the proofs'
        // aim was perfect): where the mouse puts the eye drifts round the mark
        // (an Ornstein-Uhlenbeck wander of P.aimSd rad, P.aimTh 1/s), and the
        // press comes once the eye has sat within the hand's tolerance for
        // its reaction time - wherever the round then goes
        const th = P.aimTh ?? 2, o = B.off || (B.off = [0, 0]);
        for (let k = 0; k < 2; k++) o[k] += -o[k] * th * dtA + P.aimSd * Math.sqrt(2 * th * dtA) * rng.gauss();
        out.dyaw = ay + o[0]; out.dpitch = ap + o[1];
        B.onT = Math.abs(ay) < tol && Math.abs(ap) < tol * 1.5 ? (B.onT || 0) + dtA : 0;
        out.fire = B.onT >= (P.aimReact ?? 0.12) && B.t - (B.lastFire || -9) > (P.fireGap ?? 0.45);
        // (the hand closes the gap at its own rate: whoever moves the mouse
        // - autoKeys each step, tools/lib/c3_tail.mjs each poll - moves it by
        // 1 - exp(-gain dt) of the way)
        out.gain = P.aimGain ?? 6;
      } else {
        const jit = (P.aimJit ?? 0.004) * (rng.next() - 0.5);
        out.dyaw = ay + jit; out.dpitch = ap + jit;
        out.fire = Math.abs(ay) < tol && Math.abs(ap) < tol * 1.5 && B.t - (B.lastFire || -9) > (P.fireGap ?? 0.45);
      }
      if (out.fire) { B.lastFire = B.t; B.onT = 0; B.side = rng.next() < 0.5 ? 1 : -1; B.target = null; }
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

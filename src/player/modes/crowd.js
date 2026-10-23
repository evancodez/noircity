// [O4] The street fight's footwork and look (docs/briefs/O4_COMBAT.md §1;
// the crowd brawl, src/combat/brawl/Crowd.js, drives it):
//   controller.setMode('crowd', { target() -> { x, y, z } | null, free() -> bool, bounds? })
// The look is mine: the mouse turns the view freely (the one I face is the
// one I look at). A soft lock: when the mouse rests a fifth of a second the
// view eases onto the man I face (his chest), so a man who does not aim
// still faces his man; looking at another switches to him and the ease
// follows him there (0.2 s). The feet: W in, A / D circling and S backing
// (the brawl hands me its move, brawlMove { f, s }, and its hop, brawlHop:
// 0.55 m aside, 0.6 back, in 0.10 s); a blow's push (brawlPush). With no man
// within reach of me (free()), I walk and run as ever (walkStep: Shift runs):
// that is how a fight is left. The eye where the walk has it (no pop as a
// man comes within reach or leaves it).
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const CROWD_MODE = { eye: 0, rest: 0.2, pull: 6, cone: 1.0, speed: { in: 3.2, side: 2.4, back: 2.2 } };

export default {
  name: 'crowd',
  enter(ctl, opts) {
    ctl._cw = { idle: 9 };
    ctl.brawlMove = { f: 0, s: 0 };
    ctl.brawlPush = ctl.brawlPush || { x: 0, z: 0, set(x, y, z) { this.x = x; this.z = z; return this; } };
    if (ctl.brawlPush.set) ctl.brawlPush.set(0, 0, 0);
    ctl.brawlHop = null;
    ctl.bump = null;
    void opts;
  },
  step(ctl, dt) {
    const O = ctl.modeOpts, W = ctl._cw || (ctl._cw = { idle: 9 });
    const S = ctl.world;
    W.idle += dt;
    const px = ctl.pos.x, pz = ctl.pos.z;
    const free = O.free ? O.free() : false;
    if (free && !(ctl.brawlHop && ctl.brawlHop.t < ctl.brawlHop.dur)) {
      // (nobody on me: the walk as ever - the way out of a fight)
      ctl.walkStep(dt, { speed: 4.0, sprint: 6.8, canSprint: true });
    } else {
      const M = ctl.brawlMove || { f: 0, s: 0 };
      const sin = Math.sin(ctl.yaw), cos = Math.cos(ctl.yaw);
      const sp = M.f > 0 ? CROWD_MODE.speed.in : M.f < 0 ? CROWD_MODE.speed.back : CROWD_MODE.speed.side;
      const len = Math.hypot(M.f, M.s) || 1, k = Math.min(1, Math.hypot(M.f, M.s));
      const tx = ((-sin * M.f + cos * M.s) / len) * sp * k;
      const tz = ((-cos * M.f - sin * M.s) / len) * sp * k;
      const a = 1 - Math.exp(-30 * dt);
      ctl.vel.x += (tx - ctl.vel.x) * a; ctl.vel.z += (tz - ctl.vel.z) * a;
      const P = ctl.brawlPush;
      ctl.pos.x += (ctl.vel.x + (P ? P.x : 0)) * dt;
      ctl.pos.z += (ctl.vel.z + (P ? P.z : 0)) * dt;
      const HP = ctl.brawlHop;
      if (HP && HP.t < HP.dur) {
        const e = (u) => 1 - Math.pow(1 - Math.min(1, u), 2.2);
        const t1 = Math.min(HP.dur, HP.t + dt);
        const kk = e(t1 / HP.dur) - e(HP.t / HP.dur);
        HP.t = t1;
        ctl.pos.x += HP.x * HP.dist * kk; ctl.pos.z += HP.z * HP.dist * kk;
      }
      const wx = ctl.pos.x, wz = ctl.pos.z;
      if (S.colliders) S.colliders.resolve(ctl.pos, ctl.radius * 0.85);
      ctl.keepOff(px, pz, 0.95);
      const BB = O.bounds && (typeof O.bounds === 'function' ? O.bounds() : O.bounds);
      if (BB) {
        const m = ctl.radius * 0.85;
        ctl.pos.x = clamp(ctl.pos.x, BB.x0 + m, BB.x1 - m);
        ctl.pos.z = clamp(ctl.pos.z, BB.z0 + m, BB.z1 - m);
      }
      if (P && (P.x * P.x + P.z * P.z) > 0.8 && Math.hypot(ctl.pos.x - wx, ctl.pos.z - wz) > 0.3 * Math.hypot(P.x, P.z) * dt) {
        ctl.bump = { at: ctl.pos.clone(), speed: Math.hypot(P.x, P.z), from: { x: px, z: pz } };
        P.x = 0; P.z = 0;
      }
      if (P) { const d = Math.exp(-dt * 5.5); P.x *= d; P.z *= d; }
      const bob = Math.hypot(ctl.vel.x, ctl.vel.z);
      ctl.bobAmp += ((bob > 0.3 ? Math.min(0.7, bob / 3) : 0) - ctl.bobAmp) * (1 - Math.exp(-8 * dt));
      ctl.bobPhase += dt * (bob > 0.1 ? 2.6 + bob * 1.2 : 0);
      ctl.groundY = S.surfaceY(ctl.pos.x, ctl.pos.z) + CROWD_MODE.eye;
    }
    // the soft lock: the mouse at rest, the view eases onto the man I face
    const T = O.target ? O.target() : null;
    if (T && W.idle > CROWD_MODE.rest) {
      const ex = ctl.pos.x, ez = ctl.pos.z;
      const want = Math.atan2(-(T.x - ex), -(T.z - ez));
      const d = wrap(want - ctl.yaw);
      if (Math.abs(d) < CROWD_MODE.cone) {
        const k = 1 - Math.exp(-dt * CROWD_MODE.pull * (T.pull ?? 1));
        ctl.yaw = wrap(ctl.yaw + d * k);
        const eyeY = ctl.groundY + 1.65;
        const wp = Math.atan2((T.y ?? eyeY) - eyeY, Math.max(0.6, Math.hypot(T.x - ex, T.z - ez)));
        ctl.pitch += (clamp(wp, -0.7, 0.5) - ctl.pitch) * k * 0.8;
      }
    }
    ctl.bodyYaw = null;
  },
  mouse(ctl, e) {
    const W = ctl._cw || (ctl._cw = { idle: 9 });
    ctl.yaw -= e.movementX * ctl.sensitivity;
    ctl.pitch = clamp(ctl.pitch - e.movementY * ctl.sensitivity, -1.2, 1.0);
    if (Math.abs(e.movementX || 0) + Math.abs(e.movementY || 0) > 0.5) W.idle = 0;
    return true;
  },
  exit(ctl) { delete ctl._cw; ctl.brawlHop = null; if (ctl.brawlMove) { ctl.brawlMove.f = 0; ctl.brawlMove.s = 0; } },
};

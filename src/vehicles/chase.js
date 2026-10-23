import * as THREE from 'three';
import { KINDS } from './kinds.js';

// [O2] The view from behind the car (the user's must, 2026-10-23: "when in a
// car, allow a third person view mode too"). V in a car (the pad's R3) turns
// between the seat and a camera behind the car: a spring on its heading and
// its place (a touch of lag into a turn and under the brake), high enough to
// read the street over the roof, never through a wall (it comes in along the
// line from the car to it: the bullets' world - walls, columns, cars - cast
// three times across a sphere's width, and O1's walls in plan); the look (the
// mouse, the right stick) swings it round the car and it settles behind once
// it rests; reverse looks back the way the car goes; RMB held is the seat again
// (the aim out of the window stays first person). Eased both ways (0.4 s): the
// camera never jumps. Remembered in the save (save.flags.carView). In the
// chase the car is whole: the seat's cockpit, the hands on the wheel and the
// rain on the windscreen go (the scene's onSwap), the man's bust at the wheel
// shows.
//   chase.want  chase.k (0 the seat .. 1 behind)   chase.toggle()
//   chase.apply(ctl, D, v, dt) -> the drive mode's view hook (src/player/modes/drive.js)
//   chase.mouse(dx, dy, s)  the look round the car
export const CHASE = { gap: 3.6, over: 1.15, look: 1.05, lead: 3.2, fov: 68, follow: 3.4, spring: 9, blend: 0.4, settle: 1.1, pitch: [-0.42, 0.5] };
const _p = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _s = new THREE.Vector3();
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = (u) => u * u * (3 - 2 * u);

export class Chase {
  constructor(G) {
    this.G = G;
    this.want = !!(G.save && G.save.flags && G.save.flags.carView === 'third');
    this.k = 0;
    this.cam = new THREE.Vector3();
    this.has = false;
    this.head = 0;
    this.oy = 0; this.op = 0; this.idle = 9; this.back = 0;
    this.third = false;          // (what is shown: the car whole or the seat)
    this.onSwap = null;          // (third) => the scene's: the cockpit, the hands, the screen
    this.stats = { toggles: 0, pulled: 0, minDist: 99 };
  }
  // getting in: as the save has it, eased in from the seat
  begin(car) { this.car = car; this.k = 0; this.has = false; this.oy = 0; this.op = 0; this.back = 0; this.third = false; this.want = !!(this.G.save.flags && this.G.save.flags.carView === 'third'); }
  end() { this.car = null; this.k = 0; this.has = false; if (this.third) { this.third = false; } }
  toggle() {
    this.want = !this.want;
    this.stats.toggles++;
    const F = this.G.save.flags || (this.G.save.flags = {});
    F.carView = this.want ? 'third' : 'seat';
    this.G.emit('wheels:view', { third: this.want });
  }
  mouse(dx, dy, s) {
    this.oy = wrap(this.oy - dx * s);
    this.op = clamp(this.op - dy * s, CHASE.pitch[0], CHASE.pitch[1]);
    this.idle = 0;
  }
  // the drive mode's hook, after the seat's eye is placed: the view behind, blended by k
  apply(ctl, D, v, dt) {
    const G = this.G;
    const seat = !this.want || G.held('Mouse2');
    if (dt > 0) this.k = clamp(this.k + (seat ? -dt : dt) / CHASE.blend, 0, 1);
    const s = smooth(this.k);
    const third = s > 0.5;
    if (third !== this.third) { this.third = third; if (this.onSwap) this.onSwap(third, v); }
    if (this.k <= 0) { this.has = false; return; }
    // the heading it follows: the nose, or the tail a breath into reverse (it looks the way it goes)
    const sp = v.speed;
    if (dt > 0) this.back = sp < -1.2 ? Math.min(1, this.back + dt * 1.6) : Math.max(0, this.back - dt * 2.2);
    const goal = v.yaw + (this.back > 0.5 ? Math.PI : 0);
    if (!this.has) this.head = goal;
    else if (dt > 0) this.head += wrap(goal - this.head) * (1 - Math.exp(-dt * CHASE.follow));
    // the look swings it round; it settles behind once it rests
    this.idle += dt;
    if (this.idle > CHASE.settle && dt > 0) { const kk = 1 - Math.exp(-dt * 1.7); this.oy += wrap(0 - this.oy) * kk; this.op += (0 - this.op) * kk; }
    const K = KINDS[v.kind];
    const top = K ? Math.max(K.box.roof, K.box.load ? K.box.load[2] : 0) : 1.55;
    const hl = v.spec.halfL || 2.45;
    const a = this.head + this.oy, fx = Math.cos(a), fz = -Math.sin(a);
    const back = hl + CHASE.gap + clamp(Math.abs(sp) * 0.05, 0, 1.4);
    const rise = top + CHASE.over + Math.sin(this.op) * back * 0.9;
    const cosP = Math.cos(this.op);
    // the pivot over the car's middle (what the camera looks past), and where it wants to be
    const gy = v.groundY || 0;
    _p.set(v.pos.x, gy + top * 0.75, v.pos.z);
    _c.set(v.pos.x - fx * back * cosP, gy + Math.max(0.6, rise), v.pos.z - fz * back * cosP);
    // the spring on its place (the lag under the brake, into a turn)
    if (!this.has) { this.cam.copy(_c); this.has = true; }
    else if (dt > 0) this.cam.lerp(_c, 1 - Math.exp(-dt * CHASE.spring));
    // never through a wall: in along the line from the pivot to it
    const want = _d.subVectors(this.cam, _p), far = want.length();
    if (far > 0.01) {
      want.divideScalar(far);
      const hit = this.clear(_p, want, far, v);
      if (hit < far) { this.cam.copy(_p).addScaledVector(want, Math.max(0.9, hit)); this.stats.pulled++; }
      this.stats.minDist = Math.min(this.stats.minDist, Math.min(far, hit));
    }
    // it looks over the car, a little ahead of it the way the car goes
    const lx = v.pos.x + Math.cos(goal) * CHASE.lead, lz = v.pos.z - Math.sin(goal) * CHASE.lead, ly = gy + top * 0.55 + CHASE.look;
    const dx = lx - this.cam.x, dz = lz - this.cam.z, dy = ly - this.cam.y;
    const yaw3 = Math.atan2(-dx, -dz), pitch3 = Math.atan2(dy, Math.max(0.3, Math.hypot(dx, dz)));
    // blended with the seat's eye (the drive mode put it in ctl): the camera never jumps
    const sx = ctl.pos.x, sz = ctl.pos.z, sy = ctl.groundY;
    const EYE = 1.65;
    ctl.pos.set(sx + (this.cam.x - sx) * s, 0, sz + (this.cam.z - sz) * s);
    ctl.groundY = sy + ((this.cam.y - EYE + 0.02) - sy) * s;
    ctl.yaw = ctl.yaw + wrap(yaw3 - ctl.yaw) * s;
    ctl.pitch = ctl.pitch + (pitch3 - ctl.pitch) * s;
    // (the body's roll and shake are the seat's: from behind, the car shows them itself)
    const V = ctl.viewFx;
    if (V) { V.roll *= 1 - s; V.pitch *= 1 - s * 0.7; V.yaw *= 1 - s * 0.7; }
    const fov = D.fov + (CHASE.fov + 6 * clamp((Math.abs(sp) - 8) / 20, 0, 1) - D.fov) * s;
    if (!ctl._kick && Math.abs(ctl.camera.fov - fov) > 0.01) { ctl.camera.fov = fov; ctl.camera.updateProjectionMatrix(); }
  }
  // how far along the line from p (dir d, length far) the view is clear: the bullets'
  // world (my car skipped) cast at the middle and a sphere's width either side, and the
  // city's walls in plan (O1's graph)
  clear(p, d, far, v) {
    const G = this.G, R = G.rays;
    let best = far;
    const body = v.body;
    const mine = (e) => { let o = e.mesh; while (o) { if (o === body) return true; o = o.parent; } return false; };
    if (R && R.raycast) {
      const sxv = -d.z, szv = d.x, sl = Math.hypot(sxv, szv) || 1;
      for (const off of [0, -0.35, 0.35]) {
        _s.set(p.x + sxv / sl * off, p.y, p.z + szv / sl * off);
        const h = R.raycast(_s, d, best + 0.4, { skip: mine });
        if (h && h.t - 0.35 < best) best = Math.max(0, h.t - 0.35);
      }
    }
    // (the walls in plan: a building between the car and the camera)
    const g = G.stage && G.stage.part && G.stage.part('city') ? G.stage.part('city').graph : null;
    if (g && g.lineOfSight) {
      const at = (t) => [p.x + d.x * t, p.z + d.z * t];
      const [ex, ez] = at(best);
      if (!g.lineOfSight(p.x, p.z, ex, ez)) {
        let lo = 0, hi = best;
        for (let i = 0; i < 7; i++) { const m = (lo + hi) / 2, [mx, mz] = at(m); if (g.lineOfSight(p.x, p.z, mx, mz)) lo = m; else hi = m; }
        best = Math.max(0, lo - 0.35);
      }
    }
    return best;
  }
}

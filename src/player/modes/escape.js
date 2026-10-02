import * as THREE from 'three';
import { RUNHANDS } from '../clips/run.js';

// Down a fire escape (lane B4, scene 6): controller.setMode('escape', opts).
// The body follows a rail of points (the landings' walkways, the flights'
// treads, the ladder); W takes it down at a quick pace (3.3 m/s along the
// way on the level, 2.9 on the stairs), S holds it; the mouse looks where it
// likes within 80 degrees of the way ahead and eases back to it when it
// rests (the turns at the landings sweep the view round on their own).
//   opts.rail   [{ x, y, z, kind: 'walk' | 'stair' | 'ladder', rail?: 'L' | 'R' }]
//               y is the FEET; a point's kind is the segment that ends at it
//               ('rail' puts that hand on the flight's handrail)
//   opts.endYaw the eye's yaw at the rail's end (the ladder turns it there)
//   opts.onEvent(name, data)   'foot' { kind, y } a footfall, 'landing' a
//               landing reached (it rings), 'ladder' the ladder begins,
//               'ladderStop' it hits its stop, 'end'
//   opts.ladderTime (0.95 s)  the ride down the ladder, at its own pace
//   opts.autoTo (s) the way goes on by itself until s (out through the
//               window: the E that began it carries the body onto the iron)
//   opts.v      the speed it comes in with; opts.pitchBase the look's base
// ctl.esc.s / .len / .done; ctl.esc.ladderK (0..1 of the ride).
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const sm = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

export default {
  name: 'escape',
  enter(ctl, opts = {}) {
    const rail = opts.rail.map((p) => ({ ...p }));
    let len = 0;
    rail[0].s = 0;
    for (let i = 1; i < rail.length; i++) { len += Math.hypot(rail[i].x - rail[i - 1].x, rail[i].y - rail[i - 1].y, rail[i].z - rail[i - 1].z); rail[i].s = len; }
    ctl.esc = {
      rail, len, s: opts.s ?? 0, v: opts.v ?? 0, look: { yaw: 0, pitch: 0 }, idle: 0, done: false, heading: null, autoTo: opts.autoTo ?? null,
      onEvent: opts.onEvent || (() => {}), endYaw: opts.endYaw ?? null, ladderTime: opts.ladderTime ?? 0.95, ladderT: 0, ladderK: 0,
      footAcc: 0, seg: 0, game: opts.game || null, pitchBase: opts.pitchBase ?? -0.1, ladder: opts.ladder || null,
    };
    ctl.esc.seg = segIndex(ctl.esc, ctl.esc.s);
    // (the look the eye had comes with it: an offset from the way ahead)
    const E = ctl.esc;
    const h = headingAt(E, E.s);
    E.heading = h;
    // (not clamped: a man looking back at the street stays looking at it
    // until he moves; then the way down takes his eyes)
    E.look.yaw = wrap(ctl.yaw - h);
    E.look.pitch = ctl.pitch - E.pitchBase;
    RUNHANDS.cam = ctl.camera;
    RUNHANDS.set('pump'); RUNHANDS.w = 1; RUNHANDS.k = 0;
  },
  mouse(ctl, e) {
    const E = ctl.esc;
    if (!E) return false;
    const lim = Math.max(1.4, Math.abs(E.look.yaw));
    E.look.yaw = Math.max(-lim, Math.min(lim, E.look.yaw - e.movementX * ctl.sensitivity));
    E.look.pitch = Math.max(-1.1, Math.min(0.9, E.look.pitch - e.movementY * ctl.sensitivity));
    E.idle = 0;
    return true;
  },
  step(ctl, dt) {
    const E = ctl.esc;
    if (!E) return;
    const G = E.game;
    const held = (c) => ctl.keys.has(c) || (G && G.vin && G.vin.held.has(c));
    let f = (held('KeyW') || held('ArrowUp') ? 1 : 0) - (held('KeyS') || held('ArrowDown') ? 1 : 0);
    if (ctl.auto) f = ctl.auto.f || 0;
    if (ctl.frozen) f = 0;
    if (E.autoTo != null && E.s < E.autoTo) f = 1;
    const i = segIndex(E, E.s);
    const next = E.rail[Math.min(E.rail.length - 1, i + 1)];
    const kind = next.kind || 'walk';
    if (kind === 'ladder' && E.s < E.len) {
      // the ladder: it slides down with me, at its own pace
      if (E.ladderT === 0) E.onEvent('ladder', {});
      E.ladderT += dt;
      const L0 = E.rail[i].s, L1 = next.s;
      const k = Math.min(1, E.ladderT / E.ladderTime);
      // (a slow first moment - the catch lets go - then the drop, the stop)
      const ek = k < 0.25 ? 0.4 * k * k / 0.0625 * 0.25 : 0.1 + 0.9 * sm((k - 0.25) / 0.75);
      E.s = L0 + (L1 - L0) * Math.min(1, ek);
      E.ladderK = ek;
      E.v = (L1 - L0) / E.ladderTime;
      // [C6] (a drop after the ladder: its stop, then the rest is a fall)
      if (k >= 1) { E.s = L1 + 1e-4; E.onEvent('ladderStop', {}); if (E.s >= E.len - 1e-3) E.s = E.len; }
    } else if (kind === 'drop' && E.s < E.len) {
      // [C6] let go of the ladder at its stop: a metre's fall, the knees take it
      E.dropT = (E.dropT || 0) + dt;
      const L0 = E.rail[i].s, L1 = next.s;
      const k = Math.min(1, (E.dropT / 0.38) ** 2);
      E.s = L0 + (L1 - L0) * k;
      E.ladderK = 1;
      E.v = 0;
      if (k >= 1) { E.s = E.len; E.onEvent('drop', {}); }
    } else if (E.s < E.len) {
      const want = f > 0 ? (next.duck ? next.duck.speed : kind === 'stair' ? 2.9 : 3.3) : 0;
      E.v += (want - E.v) * (1 - Math.exp(-dt * (want > E.v ? 7 : 12)));
      const s0 = E.s;
      E.s = Math.min(E.len, E.s + E.v * dt);
      // footfalls: every 0.34 m on a flight (a tread), 0.62 on a landing
      E.footAcc += E.s - s0;
      const stride = kind === 'stair' ? 0.34 : 0.62;
      if (E.footAcc >= stride) { E.footAcc -= stride; E.onEvent('foot', { kind, y: pointAt(E, E.s, _a).y }); }
      // a landing reached from a flight: it rings
      const j = segIndex(E, E.s);
      if (j !== E.seg) {
        const prevKind = E.rail[E.seg + 1] ? E.rail[E.seg + 1].kind : null;
        if (prevKind === 'stair' && (E.rail[j + 1] || {}).kind !== 'stair') E.onEvent('landing', { y: E.rail[j].y });
        E.seg = j;
      }
    }
    const p = pointAt(E, E.s, _a);
    ctl.pos.set(p.x, 0, p.z);
    // a segment through a low opening (a window under its raised sash):
    // bent low through it and up again on the far side, the palms on the
    // sill while the body goes over it
    const di = segIndex(E, E.s), D = E.rail[di + 1].duck || null;
    let duck = 0, du = 0;
    if (D) {
      du = Math.min(1, Math.max(0, (E.s - E.rail[di].s) / Math.max(1e-6, E.rail[di + 1].s - E.rail[di].s)));
      duck = sm(du / D.k0) * (1 - sm((du - D.k1) / (1 - D.k1)));
    }
    ctl.groundY = p.y - (D ? D.drop * duck : 0);
    // the way ahead turns the body; the look is laid on it and eases back
    // to it once the mouse has rested 0.6 s (faster while moving)
    let h = headingAt(E, E.s);
    if (E.endYaw != null && (kind === 'ladder' || kind === 'drop')) h = E.heading + wrap(E.endYaw - E.heading) * sm(Math.min(1, E.ladderK / 0.3));
    const dh = wrap(h - E.heading);
    E.heading += Math.sign(dh) * Math.min(Math.abs(dh), dt * (kind === 'ladder' ? 6.5 : 4.2));
    E.idle += dt;
    if (E.idle > 0.6 && E.v > 0.5) { const k = Math.exp(-dt * 2.4); E.look.yaw *= k; E.look.pitch = E.look.pitch * k; }
    const onStair = kind === 'stair' && E.v > 0.3;
    E.pitchBase += ((onStair ? -0.32 : kind === 'ladder' || kind === 'drop' ? -0.2 + 0.17 * E.ladderK : -0.08 - (D ? D.pitch * duck : 0)) - E.pitchBase) * (1 - Math.exp(-dt * (D ? 9 : 4)));
    ctl.yaw = E.heading + E.look.yaw;
    ctl.pitch = Math.max(-1.45, Math.min(1.45, E.pitchBase + E.look.pitch));
    // the stride's bob, and the hands: one on the flight's handrail
    ctl.vel.set(0, 0, 0);
    const moving = E.v > 0.3 && kind !== 'ladder' && kind !== 'drop' && !D;
    ctl.bobAmp += ((moving ? 0.75 : 0) - ctl.bobAmp) * (1 - Math.exp(-dt * 8));
    ctl.bobPhase += dt * (moving ? 2.1 + E.v * 1.6 : 0);
    RUNHANDS.phase = ctl.bobPhase;
    RUNHANDS.k += ((moving ? 0.55 : 0.15) - RUNHANDS.k) * (1 - Math.exp(-dt * 6));
    // on a flight, a hand runs down its handrail (object first: the rail's
    // point beside me and a little ahead, at the rail's height); on the
    // ladder both hands hold its sides as it drops, and let go as I turn
    const seg = E.rail[Math.min(E.rail.length - 1, segIndex(E, E.s) + 1)];
    if (D && D.hands && du > 0.08 && du < D.k1 + 0.3) {
      // (through the window: both palms go to the sill as the body bends to
      // it, stay while it goes over, and come off as it rises outside)
      RUNHANDS.plantR.set(...D.hands[0]);
      RUNHANDS.plantL.set(...D.hands[1]);
      RUNHANDS.lift = Math.max(0, Math.min(1, (du - D.k1) / 0.26));
      RUNHANDS.set('plant');
    } else if (seg.kind === 'stair' && seg.rail) {
      const i = segIndex(E, E.s), a = E.rail[i], b = E.rail[i + 1];
      const hx = b.x - a.x, hz = b.z - a.z, hl = Math.hypot(hx, hz) || 1;
      const fx = hx / hl, fz = hz / hl;
      // (the right of a heading (fx, fz) is (-fz, fx))
      const sx = seg.rail === 'R' ? -fz : fz, sz = seg.rail === 'R' ? fx : -fx;
      const ahead = Math.min(0.35, (b.s - E.s) * 0.8);
      const q = pointAt(E, Math.min(b.s, E.s + ahead), _b);
      const P = seg.rail === 'R' ? RUNHANDS.plantR : RUNHANDS.plantL;
      P.set(q.x + sx * 0.33, q.y + 0.97, q.z + sz * 0.33);
      RUNHANDS.railSide = seg.rail;
      RUNHANDS.lift = 0;
      RUNHANDS.set('rail');
    } else if (kind === 'ladder') {
      const L = E.ladder;
      if (L) {
        const y = pointAt(E, E.s, _b).y + 1.25;
        // (its sides left and right of me as I go down it facing south)
        RUNHANDS.plantR.set(L.x - 0.24, y, L.z + 0.06);
        RUNHANDS.plantL.set(L.x + 0.24, y, L.z + 0.06);
      }
      RUNHANDS.lift = Math.max(0, (E.ladderK - 0.55) / 0.35);
      RUNHANDS.set(E.ladderK < 0.28 ? 'plant' : 'pump');
    } else RUNHANDS.set('pump');
    RUNHANDS.step(dt, 7);
    if (E.s >= E.len && !E.done) { E.done = true; E.onEvent('end', {}); }
  },
  exit(ctl) { delete ctl.esc; },
};

function segIndex(E, s) {
  const R = E.rail;
  for (let i = 0; i < R.length - 1; i++) if (s < R[i + 1].s) return i;
  return R.length - 2;
}
function pointAt(E, s, out) {
  const i = segIndex(E, s), a = E.rail[i], b = E.rail[i + 1];
  const k = Math.min(1, Math.max(0, (s - a.s) / Math.max(1e-6, b.s - a.s)));
  return out.set(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, a.z + (b.z - a.z) * k);
}
// the heading of the way at s (a look a little ahead, so a turn begins
// before the corner)
function headingAt(E, s) {
  const a = pointAt(E, s, _a).clone();
  let b = pointAt(E, Math.min(E.len, s + 0.9), _b);
  if (Math.hypot(b.x - a.x, b.z - a.z) < 0.05) { const i = segIndex(E, s); const r = E.rail[i + 1], q = E.rail[i]; b = _b.set(r.x + (r.x - q.x), 0, r.z + (r.z - q.z)); if (Math.hypot(b.x - a.x, b.z - a.z) < 0.05) return E.heading ?? 0; }
  return Math.atan2(-(b.x - a.x), -(b.z - a.z));
}

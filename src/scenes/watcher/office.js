import * as THREE from 'three';
import { ROOM as OR, WIN, ESC as OE, STREET, POST, DOOR as ODOOR } from '../../stages/office/plan.js';
import { BLIND } from '../../stages/office/build/openings.js';
import { WRUN } from '../../cast/kinds/watcher.js';

// Scene 6's first beat in lane B2's office (round 2, lane R2-C). What of
// the office this scene needs and the office stage does not give, made
// from here without touching the stage's files:
//   officeStreet(O)          the street under the window as a walking surface
//                            (the stage has none out there: a figure on it
//                            stood at the third floor's height, over the road)
//   officeAfterFight(O)      a cold start (?start=watcher) finds the room as
//                            the gunfight left it: the desk over, the door in
//   makeOfficeBlind(O, opts) two fingers part the room's own blind: the three
//                            slats at the slit are drawn by bendable copies
//                            while they are parted (B2's are whole slats, one
//                            instance each), with the stand-in blind's API
//                            (part, fingerAt, gapAt) so the hands' clip and
//                            the beat's script are the same for both
//   officeRun(C, pts)        his run off down the office's street, into the
//                            light well's mouth under the fire escape
//   WAY_OUT                  the eye's way across the room to the fire-escape
//                            window and down under its sash
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const sm = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function officeStreet(O) {
  if (O._r2cStreet) return;
  O._r2cStreet = true;
  // (outside the building's face only: the fire escape's own surface, and
  // the room's floor, keep their say)
  O.addSurface((x, z) => (x > STREET.face + 0.02 && x < STREET.far && Math.abs(z) < 44
    ? (x < STREET.kerb || x > STREET.farKerb ? STREET.y + 0.15 : STREET.y)
    : undefined));
}

export function officeAfterFight(O) {
  const room = O.part('office');
  if (!room) return;
  if (!room.desk.tip) room.tipDesk({ now: true });
  if (room.door.angle < 1.4) { room.door.angle = room.door.target = 1.72; room.door.vel = 0; room.door.moving = false; room.door.hinge.rotation.y = 1.72; room.doorCollider(); }
  void ODOOR;
}

// B2's curtain over the fire-escape window, pushed aside to the window's
// far side (k 1: gathered on its rod, its outer edge where it hung; 0: as
// B2 hangs it) - the way out goes through the window, and the man at the
// window in the gunfight had it aside. A scale on its mesh (its own cloth
// motion is in its vertices); given back when the scene leaves the office.
export function curtainAside(O, k) {
  const room = O.part('office');
  const cm = room && room.curtain && room.curtain.mesh;
  if (!cm) return;
  const U = cm.material && cm.material.uniforms;
  const c0 = O._r2cCurtain0 || (O._r2cCurtain0 = { x: cm.position.x, s: cm.scale.x, w: room.curtain.w, lamp: U && U.uLampK ? U.uLampK.value : null });
  const sc = c0.s * (1 - 0.82 * k);
  cm.scale.x = sc;
  cm.position.x = c0.x + (c0.w / 2) * (c0.s - sc);
  // (gathered, the cloth is folds against the frame, not a pane the light
  // well shines through: it glowed as a white bar beside the window - its
  // glow brought down to a dark cloth while it is aside)
  if (U && U.uLampK && c0.lamp != null) U.uLampK.value = c0.lamp * (1 - 0.93 * k);
}

// ---- the blind ----------------------------------------------------------------------------
// B2's slat: a crowned strip, width along x (the street side +x), its length
// along z, tilted about z (street edge up) - openings.js buildBlind
export function makeOfficeBlind(O, { gapY = 1.5, zAt = (WIN.z0 + WIN.z1) / 2 } = {}) {
  const RB = O.part('office').blind;
  const im = RB.mesh;
  const S = RB.slats;
  // the pressed slat: the first under the slit's height whose neighbours
  // are whole (a round may have torn one away in the gunfight)
  let lo = S.findIndex((s) => s.y < gapY);
  if (lo < 1) lo = Math.floor(S.length * 0.6);
  const whole = (i) => S[i - 1] && S[i + 1] && !S[i - 1].gone && !S[i].gone && !S[i + 1].gone;
  for (let d = 0; d < 6 && !whole(lo); d++) { if (whole(lo + d)) { lo += d; break; } if (whole(lo - d)) { lo -= d; break; } }
  const idx = [lo - 1, lo, lo + 1];
  const zc = (WIN.z0 + WIN.z1) / 2, w = BLIND.width, len = BLIND.len;
  // the fingers press the slat here (world z); the slit is widest under them
  const zf = Math.max(zc - len / 2 + 0.3, Math.min(zc + len / 2 - 0.3, zAt));
  // (fine along its length where it bends)
  const base = new THREE.BoxGeometry(w, 0.0022, len, 3, 1, 120);
  {
    const p = base.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) / (w / 2), s = p.getZ(i) / (len / 2);
      p.setY(i, p.getY(i) + 0.0035 * (1 - u * u) - 0.004 * s * s);
    }
  }
  const B0 = base.getAttribute('position').array.slice();
  // what the parting does to each at the bell's top: turned toward the line
  // of sight (street edge down) and moved apart - the pressed one down, the
  // one over it up, the one under it pushed a little
  // (the pressed one only a little flatter: turned up to the street it caught
  // the flood full and printed as a white bar across the slit)
  const PART = [{ tilt: -0.5, dy: 0.045 }, { tilt: 0.78, dy: -0.05 }, { tilt: 0.7, dy: -0.02 }];
  const meshes = idx.map(() => {
    const m = new THREE.Mesh(base.clone(), im.material);
    m.castShadow = true; m.receiveShadow = true;
    m.userData.inkId = im.userData.inkId;
    m.userData.noRay = true;
    m.layers.mask = im.layers.mask;
    m.position.set(BLIND.x, 0, zc);
    m.visible = false;
    m.name = 'r2c_slat';
    im.parent.add(m);
    return m;
  });
  const bell = (z) => Math.exp(-((z - (zf - zc)) ** 2) / 0.03);
  // a local point (x, y, z) of slat j (0 .. 2) with the part k, relative to
  // the mesh (BLIND.x, 0, zc): turned about z, lifted
  const place = (j, x, y, z, k, out) => {
    const s = S[idx[j]], b = bell(z) * k;
    const a = s.tilt + (PART[j].tilt - s.tilt) * b;
    // (a round's twist, as B2 writes it: Euler(twist, 0, tilt, 'ZXY'))
    const ct = Math.cos(s.twist), st = Math.sin(s.twist);
    const y1 = y * ct - z * st, z1 = y * st + z * ct;
    const ca = Math.cos(a), sa = Math.sin(a);
    return out.set(x * ca - y1 * sa, x * sa + y1 * ca + s.y + s.lift - s.sag + PART[j].dy * b, z1);
  };
  const _p = new THREE.Vector3();
  let shown = false;
  const saved = idx.map((i) => S[i].gone);
  const show = (on) => {
    if (on === shown) return;
    shown = on;
    meshes.forEach((m) => { m.visible = on; });
    idx.forEach((i, j) => RB.set(i, { gone: on ? true : saved[j] }));
  };
  const B = {
    k: 0, lo, zf,
    part(k) {
      this.k = k;
      const K = sm(k);
      if (K <= 1e-4) { show(false); return; }
      show(true);
      meshes.forEach((m, j) => {
        const p = m.geometry.getAttribute('position');
        for (let i = 0; i < p.count; i++) {
          place(j, B0[i * 3], B0[i * 3 + 1], B0[i * 3 + 2], K, _p);
          p.setXYZ(i, _p.x, _p.y, _p.z);
        }
        p.needsUpdate = true;
        m.geometry.computeVertexNormals();
        m.geometry.computeBoundingSphere();
      });
    },
    // the pressed slat's room edge under the fingers (world)
    fingerAt(out = new THREE.Vector3()) {
      place(1, -w / 2 + 0.008, 0.004, zf - zc, sm(this.k), out);
      return out.add(_off.set(BLIND.x, 0, zc));
    },
    // the middle of the slit (world), dx along the slats from the fingers
    // (negative: to the viewer's left, -z; the eye looks through the slit
    // a little left of the hand)
    gapAt(out = new THREE.Vector3(), dx = 0) {
      const K = sm(this.k), z = zf - zc + dx;
      place(0, 0, 0, z, K, out);
      place(1, 0, 0, z, K, _q);
      return out.add(_q).multiplyScalar(0.5).add(_off.set(BLIND.x, 0, zc));
    },
    // the room's own slats back, as they were
    restore() { show(false); },
    dispose() { show(false); meshes.forEach((m) => { m.parent.remove(m); m.geometry.dispose(); }); base.dispose(); },
  };
  return B;
}
const _off = new THREE.Vector3(), _q = new THREE.Vector3();

// ---- his run in the office's street -----------------------------------------------------------
// from under the lamp across the road, over it at a slant to this side, and
// into the light well's mouth under the fire escape (he is out of the slit
// within a second; the building's face hides him at the end)
export const HIS_WAY = [[POST.x - 0.25, POST.z - 0.7], [17.2, 6.1], [12.4, 8.2], [8.2, 9.2], [5.9, 9.4]];

export function officeRun(C, pts = HIS_WAY) {
  const P = pts.map(([x, z]) => V(x, 0, z));
  const L = [0];
  for (let i = 1; i < P.length; i++) L.push(L[i - 1] + P[i].distanceTo(P[i - 1]));
  const at = (s, out) => {
    s = Math.max(0, Math.min(L[L.length - 1], s));
    let i = 0;
    while (i < P.length - 2 && L[i + 1] < s) i++;
    return out.lerpVectors(P[i], P[i + 1], (s - L[i]) / Math.max(1e-6, L[i + 1] - L[i]));
  };
  const _a = new THREE.Vector3(), _b = new THREE.Vector3();
  const R = { s: 0, v: 0, done: false };
  C.act = 'flee';
  C.w.setState('watcher_run', 0.12);
  R.step = (dt) => {
    if (R.done) return;
    const F = C.fig;
    // (off the mark hard: 0 to 7 m/s in half a second)
    R.v = Math.min(7.2, R.v + dt * 14);
    R.s += R.v * dt;
    at(R.s, _a);
    F.pos.x = _a.x; F.pos.z = _a.z;
    at(R.s + 1.4, _b);
    const h = Math.atan2(_b.x - _a.x, _b.z - _a.z);
    const dh = wrap(h - F.yaw);
    F.yaw += Math.sign(dh) * Math.min(Math.abs(dh), dt * 9);
    C.v = R.v;
    C.lean += ((Math.max(-1, Math.min(1, dh * 2)) * Math.min(1, R.v / 6)) - C.lean) * (1 - Math.exp(-dt * 6));
    F.anim.setTimeScale(Math.max(0.3, R.v / (WRUN.speed * F.scale)));
    if (R.s >= L[L.length - 1]) { R.done = true; F.object.visible = false; C.act = 'gone'; }
  };
  return R;
}

// ---- the way out: across the room to the fire-escape window, and under its sash ----------------
// The window is in the north wall (+z): its sill at OE.y0, the lower sash
// raised to OE.y0 + OE.open (0.62 m of opening). The eye comes to it, bends
// low, both palms on the sill, and goes under the sash's rail; there the
// frame is the rail and the wall - black - and the scene cuts on it to the
// backlot's same window, where the eye comes up on the iron.
export const WAY_OUT = {
  x: (OE.x0 + OE.x1) / 2 + 0.05,
  stand: OR.z1 - 0.62,               // in front of it, standing
  sill: OE.y0,
  rail: OE.y0 + OE.open,             // the raised sash's bottom rail
  wall: OR.z1,                       // the wall's inner face
};
// the track (t from the E): the head turns first (a third of a second), the
// body follows across the room, then down and forward under the sash.
// Returns { pose, duck (0..1), under (true once the rail is over the lens) }
export function wayOut(P0) {
  const W = WAY_OUT;
  const dyaw = wrap(Math.PI - P0.yaw);
  const A = { x: W.x, y: 1.6, z: W.stand };
  // the duck's end: under the rail, the eye a hand under it, past the wall's face
  const C = { x: W.x, y: W.rail - 0.3, z: W.wall + 0.06 };
  const T_TURN = 0.35, T0 = 0.08, T1 = 0.92, T2 = 1.42;
  return (t) => {
    const a = sm(t / T_TURN), b = sm((t - T0) / (T1 - T0)), d = sm((t - T1 + 0.08) / (T2 - T1 + 0.08));
    // (across the room: from the slit to A, round the desk's end - a little
    // bow toward the room's north side keeps clear of the desk)
    const bow = Math.sin(Math.PI * b) * 0.35;
    let x = P0.x + (A.x - P0.x) * b, y = P0.y + (A.y - P0.y) * b, z = P0.z + (A.z - P0.z) * b + bow;
    // (then down and in under the sash: the head first low, then forward)
    const dy = sm(Math.min(1, d * 1.5)), dz = sm(Math.max(0, (d - 0.25) / 0.75));
    y += (C.y - A.y) * dy;
    z += (C.z - A.z) * dz;
    const pitch = P0.pitch + (-0.18 - P0.pitch) * a - 0.34 * dy + 0.12 * dz;
    return { pose: { x, y, z, yaw: P0.yaw + dyaw * a, pitch }, duck: dy, under: z > W.wall - 0.04 && y < W.rail - 0.1, end: t >= T2 };
  };
}

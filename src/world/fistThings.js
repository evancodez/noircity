import * as THREE from 'three';

// [O1c] The street answers a fist (docs/briefs/O1C_STREETS.md §2). O7's bare-hand
// jab (night/fist.js) lands on people; a swing at nobody comes here first, and
// what is in front of me within a fist's reach answers as its kind:
//   - a thing of the destruction set (stage.smash, docs/seams/SMASH.md) is hit at the
//     jab's contact with a fist's push (Smash.hit 'fist'): a bin, a churn, a bucket of
//     flowers, a sandwich board, a bicycle, a barrel go over; a crate is shoved over
//     whole; a bench, a stall, oil drums, barrels, a handcart shake (the next jab takes
//     them over); iron that does not give - a lamp post, a hydrant, a call box, a mailbox,
//     a booth, a sign - rings and stands, and hurts the hand (the flinch, a beat);
//   - shop glass cracks at the first jab and goes at the second (the set's glazing);
//   - a wall hurts the hand (the flinch, a beat, grit off the stone); a street door
//     is knocked on; a car's tin dents where the fist met it (CarDamage.dent, its
//     paint scarred pale round it), the body rocks on its springs, and a car that is
//     not mine is a crime ('vandal'): the street sees it as it sees a bin go over;
//   - a bottle in front of my feet is knocked off its step and breaks; the other
//     things lying there are knocked loose (items.knock);
// and the city answers: a thing knocked over is a crime of its own ('vandal', 1)
// that a cop or a witness who saw it tells (O3's crime.emit; glass, stalls and
// newsstands are O3's own 'smash' through the set's event).
// ([O1c] after the critic, M1: the kick - C held and LMB, no foot, nothing
// teaching it, C otherwise nothing on foot - is cut.) The second blow instead:
// a thing that shook to a jab (a bench, oil drums, barrels, a handcart) goes
// over to the next jab within `again` s - the weight put into it (the eye
// lunges, the wind of it), so hitting again is all a player has to find out.
//   thingStep(G, R, arm) -> true when the press was taken (fist.js, before the whiff)
export const THING = { reach: 1.25, cone: 0.62, jab: 3.5, heavy: 6, again: 2.5, beat: 0.25 };
// iron that does not give to a fist: it rings, and the hand hurts
const IRON = new Set(['lamp', 'pole', 'hydrant', 'callbox', 'mailbox', 'booth', 'namesign', 'stop']);
// shoved over whole by a jab (Smash.hit 'body' under its break speed): a car or a round breaks it
const SHOVE = new Set(['crates', 'crate']);
// what O3 already makes a crime of through the set's 'smash' event (by 'fist')
const O3S = new Set(['glass', 'stall', 'newsstand']);
const _f = new THREE.Vector3();

// what is in front of me within reach: { kind: 'thing' | 'glass' | 'item' | 'wall' | 'door' | 'car', gap, ... }
export function thingAhead(G) {
  const e = G.eye, S = G.stage && G.stage.smash;
  const f = _f.set(0, 0, -1).transformDirection(G.camera.matrixWorld);
  const fl = Math.hypot(f.x, f.z) || 1, fx = f.x / fl, fz = f.z / fl, pitch = Math.asin(Math.max(-1, Math.min(1, f.y)));
  const reach = THING.reach;
  let best = null;
  const offer = (c) => { if (!best || c.gap + c.ang * 0.6 < best.gap + best.ang * 0.6) best = c; };
  const angTo = (x, z) => { const dx = x - e.x, dz = z - e.z, d = Math.hypot(dx, dz) || 1; return Math.acos(Math.max(-1, Math.min(1, (dx * fx + dz * fz) / d))); };
  // (looking at the sky: no thing)
  if (pitch > 0.75) return null;
  // the set's things
  if (S) for (const it of S.near(e.x, e.z, 3)) {
    const K = it.K;
    if (it.state !== 'stand' || it.gone || K.high || K.pane) continue;
    let nx, nz, gap;
    if (K.round) {
      const dx = it.x - e.x, dz = it.z - e.z, d = Math.hypot(dx, dz) || 1;
      gap = d - K.r; nx = it.x - dx / d * K.r; nz = it.z - dz / d * K.r;
    } else if (it.fp) {
      const c = Math.cos(it.yaw), s = Math.sin(it.yaw), dx = e.x - it.x, dz = e.z - it.z;
      const lx = Math.max(-it.fp.hx, Math.min(it.fp.hx, dx * c - dz * s)), lz = Math.max(-it.fp.hz, Math.min(it.fp.hz, dx * s + dz * c));
      nx = it.x + lx * c + lz * s; nz = it.z - lx * s + lz * c;
      gap = Math.hypot(nx - e.x, nz - e.z);
    } else continue;
    if (gap > reach) continue;
    const ang = Math.min(angTo(it.x, it.z), gap > 0.15 ? angTo(nx, nz) : 9);
    if (ang > THING.cone) continue;
    // (the jab's height on it: chest high, or its top)
    const y = Math.max(it.y0 + 0.1, Math.min(it.y0 + K.h - 0.05, e.y - 0.45));
    offer({ kind: 'thing', it, gap, ang, point: new THREE.Vector3(nx, y, nz) });
  }
  // shop glass (the set's windows: glazed when met)
  const w = S && S.shopNear ? S.shopNear(e.x, e.z, null, reach + 0.3) : null;
  if (w && w.nx * fx + w.nz * fz < -0.5 && !(w.it && w.it.pane && w.it.pane.state === 'gone')) {
    const off = (e.x - w.x) * w.nx + (e.z - w.z) * w.nz, y = e.y - 0.4;
    if (off > 0 && off < reach + 0.3 && Math.abs(y - w.y) < w.h / 2 - 0.1) {
      const t = off / Math.max(0.3, -(w.nx * fx + w.nz * fz));
      const px = e.x + fx * t, pz = e.z + fz * t;
      if (Math.abs((px - w.x) * w.nz - (pz - w.z) * w.nx) < w.w / 2 - 0.2) offer({ kind: 'glass', w, gap: off - 0.15, ang: 0, point: new THREE.Vector3(px - w.nx * 0.05, y, pz - w.nz * 0.05) });
    }
  }
  // a wall, a door, a car (the bullets' world, along the look)
  if (G.rays) {
    const h = G.rays.raycast(e.clone(), f.clone(), reach + 0.35);
    if (h) {
      const P = h.mesh && h.mesh.userData.prop;
      const hp = h.point, gap = Math.hypot(hp.x - e.x, hp.z - e.z);
      const st = G.stage.part && G.stage.part('stream');
      const door = st && st.doorNear ? st.doorNear(hp.x, hp.z, 0.9) : null;
      // (a thing of the set whose shape the ray met - its own mesh or its chunk's merge - is the
      // set's, above; the ground is no wall)
      if (P && P.carD) offer({ kind: 'car', car: P.carD, gap, ang: 0, point: hp, normal: h.normal });
      // ([O1c] after O2's merge: a parked car is a body drawn as an instance - its proxy carries it)
      else if (h.mesh && h.mesh.userData.parked) offer({ kind: 'car', parked: h.mesh.userData.parked, gap, ang: 0, point: hp, normal: h.normal });
      else if (!(P && (P.K || P === 'merged')) && Math.abs(h.normal.y) < 0.6) offer({ kind: door ? 'door' : 'wall', door, gap, ang: 0, point: hp, normal: h.normal });
    }
  }
  // a thing lying in front of my feet (items.ahead: a bottle on a stoop) - ([O1c] after the
  // critic, m2) the jab is chest high: a bottle on a step is hit when I look down at it (at my
  // feet it is out of the view otherwise), never by a jab meant for what stands behind it
  const I = G.stage && G.stage.part && G.stage.part('items');
  const item = I && I.ahead ? I.ahead(e, fx, fz, reach + 0.3) : null;
  if (item && pitch < -0.3) offer({ kind: 'item', item, gap: Math.hypot(item.x - e.x, item.z - e.z) - 0.3, ang: angTo(item.x, item.z) });
  return best;
}

// the press: the swing now, the answer at its contact (true: taken)
export function thingStep(G, R, arm) {
  const T = thingAhead(G);
  if (!T) return false;
  const H = G.player.hands, S = G.stage.smash;
  const fl = Math.hypot(G.camera.matrixWorld.elements[8], G.camera.matrixWorld.elements[10]) || 1;
  const dir = new THREE.Vector3(-G.camera.matrixWorld.elements[8] / fl, 0, -G.camera.matrixWorld.elements[10] / fl);
  G.setViewmodelVisible(true);
  if (H.set !== 'fists') H.equip('fists');
  // (the second blow at what shook to the last one: my weight in it)
  const was = T.kind === 'thing' ? T.it : T.kind === 'car' ? T.car || T.parked : null;
  const heavy = !!(was && was.fistT != null && G.time - was.fistT < THING.again);
  const land = () => answer(G, R, T, dir, heavy, S);
  G.emit('city:swing', { thing: T.kind, heavy });
  if (heavy) {
    if (G.controller.kick) G.controller.kick(-3.2, 1.5, 0.22);
    if (G.sfx && G.sfx.fight) G.sfx.fight('wind', null, { k: 0.4 });
  }
  H.play(arm === 'L' ? 'jabL' : 'jabR', { onMark: { contact: land } });
  R.fistDown = G.time + 0.9;
  return true;
}

// the beat after a hurt hand (fist.js calls it every step on foot)
export function thingTick(G, R) {
  return R.fistBeat != null && G.time < R.fistBeat;
}

// a struck car's springs posed while nothing else steps it (a step adds to its hardT: then its own
// step posed it) - city.js calls it every step on foot, before anything there may return
export function rockTick(G, R) {
  const dt = Math.min(0.1, Math.max(0, G.time - (R.fistTickT ?? G.time)));
  R.fistTickT = G.time;
  if (R.rocking && R.rocking.size) for (const v of R.rocking) {
    if (G.time > v.rockUntil || !v.body) { R.rocking.delete(v); continue; }
    if (v.hardT === v.rockHardT && dt > 0) v.pose(dt);
    v.rockHardT = v.hardT;
  }
}

function answer(G, R, T, dir, heavy, S) {
  const sfx = G.sfx, ctl = G.controller;
  let hurtNow = false;
  const hurt = () => {
    hurtNow = true;
    // (the hand meets what does not give: it hurts - the flinch, the grunt, a beat before the next)
    G.player.hands.play('hurt');
    if (sfx.fight) sfx.fight('myGrunt', null, { k: 0.35 });
    if (ctl.kick) ctl.kick(2.2, 0.6, 0.16);
    R.fistBeat = G.time + THING.beat;
  };
  if (T.kind === 'thing') {
    const it = T.it, kind = it.kind;
    const by = SHOVE.has(kind) && !heavy ? 'body' : 'fist';
    const sp = by === 'body' ? 1.7 : heavy ? THING.heavy : THING.jab;
    const res = S.hit(it, T.point, dir.clone().multiplyScalar(sp), by);
    it.fistT = res === 'hit' && !IRON.has(kind) ? G.time : null;
    if (res === 'hit') {
      if (IRON.has(kind)) {
        // (iron rings: the post's own ring under the clang)
        sfx.play(kind === 'lamp' || kind === 'pole' || kind === 'namesign' || kind === 'stop' ? 'c3_post' : 'clang', T.point, { k: 0.35 }, { ref: 3 });
        hurt();
      } else {
        // (it shakes and stands: a thud, its own knock)
        sfx.play('f_jab', T.point, { k: 0.4 }, { ref: 3 });
        if (ctl.kick) ctl.kick(0.9, 0.4, 0.08);
      }
    } else if (res) {
      // ([O1c] after the critic: a can, a churn, a barrel, a bicycle struck high topples - the push is above
      // its middle - instead of hopping and landing on its foot again)
      if (res === 'over' && it.K.how === 'tumble' && !it.K.lie && it.body && it.body.w) it.body.w.add(new THREE.Vector3(dir.z, 0, -dir.x).multiplyScalar(heavy ? 6 : 4.5));
      if (ctl.kick) ctl.kick(1.2, 0.8, 0.1);
      if (!O3S.has(kind) && G.crime) G.crime.emit('vandal', { x: it.x, z: it.z }, 'player');
    }
    G.emit('city:fist', { man: null, thing: kind, how: res, heavy, hurt: hurtNow });
    return;
  }
  if (T.kind === 'glass') {
    const it = S.glaze(T.w), Gl = G.stage.glass;
    if (!it || !it.pane || !Gl) return;
    const first = !it.pane.hits;
    if (first) Gl.hit(it.pane, { point: T.point, normal: new THREE.Vector3(T.w.nx, 0, T.w.nz), dir: dir.clone(), power: 0.6, by: 'fist' });
    else {
      S.shatterPane(it, dir.clone(), 1.2, T.point);
      G.emit('smash', { kind: 'glass', pos: T.point.clone(), by: 'fist', how: 'break', item: it, speed: 3 });
    }
    if (ctl.kick) ctl.kick(1.0, 0.5, 0.1);
    G.emit('city:fist', { man: null, thing: 'glass', how: first ? 'crack' : 'break', heavy });
    return;
  }
  if (T.kind === 'item') {
    const I = G.stage.part('items');
    const how = I.knock(T.item, dir);
    if (ctl.kick) ctl.kick(0.6, 0.3, 0.08);
    G.emit('city:fist', { man: null, thing: 'item:' + T.item.kind, how, heavy });
    return;
  }
  if (T.kind === 'car') {
    // ([O1c] after the critic, B1: the tin answers) a dent where the fist met it, the paint
    // scarred pale round it (O6b's CarDamage.dent), the body rocked on its springs away
    // from the blow; a second blow within `again` s deeper. A car not mine: a crime.
    const CD = S && S.cars;
    // (a parked car of O2's - an instance - becomes a real one where it stands (the hijack's
    // promote), kept as a car left there, its damage attached now: the dent lands on it)
    if (T.parked) {
      const W = G.wheels, b = T.parked;
      if (!W || !W.parked || !W.parked.bodies.includes(b)) return;
      const v0 = W.parked.promote(b);
      if (W.leave) W.leave(v0);
      if (CD && !v0.smashD) CD.attach(v0);
      if (!v0.smashD) return;
      T.car = v0.smashD;
    }
    const D = T.car, v = D.v;
    let depth = 0;
    if (CD && D.state !== 'wreck') {
      const l = v.local(T.point, new THREE.Vector3()).clone(), Sp = v.spec;
      l.y = T.point.y - (v.groundY || 0);
      const p = new THREE.Vector3(Math.max(-Sp.halfL, Math.min(Sp.halfL, l.x)), Math.max(0.45, Math.min(1.1, l.y)), Math.max(-Sp.halfW, Math.min(Sp.halfW, l.z)));
      depth = heavy ? 0.07 : 0.045;
      CD.dent(D, p, CD.toLocalDir(v, dir), heavy ? 0.42 : 0.32, depth);
      // (rocked: a side blow rolls it, an end's pitches it)
      const side = Math.abs(l.z) / Sp.halfW > Math.abs(l.x) / Sp.halfL, a = heavy ? 0.85 : 0.55;
      if (side) v.rollV = (v.rollV || 0) - Math.sign(l.z || 1) * a; else v.pitchV = (v.pitchV || 0) + Math.sign(l.x || 1) * a * 0.7;
      v.shake = Math.min(1, (v.shake || 0) + 0.35);
      // (its springs posed a second and a half while nothing else steps it: thingTick - a parked
      // car is never stepped, and a step would let its physics shove it off the kerb)
      (R.rocking || (R.rocking = new Set())).add(v); v.rockUntil = G.time + 1.5;
    }
    D.fistT = G.time; if (T.parked) T.parked.fistT = G.time;
    sfx.play('c3_dent', T.point, { k: heavy ? 0.7 : 0.5 }, { ref: 3 });
    if (ctl.kick) ctl.kick(1.0, 0.5, 0.1);
    // (someone's car beaten in the street: the street sees it as a bin knocked over - once a few seconds)
    if (v.driver !== 'player' && G.crime && !(D.fistCrimeT != null && G.time - D.fistCrimeT < 4)) { D.fistCrimeT = G.time; G.crime.emit('vandal', { x: v.pos.x, z: v.pos.z }, 'player'); }
    G.emit('city:fist', { man: null, thing: 'car', how: depth ? 'dent' : 'hit', heavy, depth });
    return;
  }
  // a wall or a door: grit off the stone and a hurt hand; a door is knocked on
  if (T.kind === 'door') {
    sfx.play('b9thunk', T.point, { k: 0.55 }, { ref: 3 });
    if (ctl.kick) ctl.kick(0.7, 0.3, 0.08);
  } else {
    sfx.play('w_hitWall', T.point, { k: 0.4 }, { ref: 3 });
    if (S && S.chipsAt) S.chipsAt(T.point.clone(), T.normal ? T.normal.clone() : dir.clone().negate(), 0.06, 5);
    hurt();
  }
  G.emit('city:fist', { man: null, thing: T.kind, how: 'hit', heavy, hurt: hurtNow });
}

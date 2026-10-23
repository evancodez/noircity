import * as THREE from 'three';

// [O1c] The street answers a fist (docs/briefs/O1C_STREETS.md §2). O7's bare-hand
// jab (night/fist.js) lands on people; a swing at nobody comes here first, and
// what is in front of me within a fist's reach answers as its kind:
//   - a thing of the destruction set (stage.smash, docs/seams/SMASH.md) is hit at the
//     jab's contact with a fist's push (Smash.hit 'fist'): a bin, a churn, a bucket of
//     flowers, a sandwich board, a bicycle, a barrel go over; a crate is shoved over
//     whole (a kick breaks it); a bench, a stall, oil drums shake (a kick takes them
//     over); iron that does not give - a lamp post, a hydrant, a call box, a mailbox,
//     a booth, a sign - rings and stands, and hurts the hand (the flinch, a beat);
//   - shop glass cracks at the first jab and goes at the second (the set's glazing);
//   - a wall hurts the hand (the flinch, a beat, grit off the stone); a street door
//     is knocked on; a car's tin dents with the sound of it;
//   - a bottle in front of my feet is knocked off its step and breaks; the other
//     things lying there are knocked loose (items.knock);
// and the city answers: a thing knocked over is a crime of its own ('vandal', 1)
// that a cop or a witness who saw it tells (O3's crime.emit; glass, stalls and
// newsstands are O3's own 'smash' through the set's event).
// A kick: crouched (C or Ctrl held) the press is a kick - the eye dips and lunges,
// a foot's push (stronger, low: what lies at my feet).
//   thingStep(G, R, arm) -> true when the press was taken (fist.js, before the whiff)
export const THING = { reach: 1.25, kickReach: 1.45, cone: 0.62, jab: 3.5, kick: 6, beat: 0.5 };
// iron that does not give to a fist: it rings, and the hand hurts
const IRON = new Set(['lamp', 'pole', 'hydrant', 'callbox', 'mailbox', 'booth', 'namesign', 'stop']);
// shoved over whole by a jab (Smash.hit 'body' under its break speed): a kick breaks it
const SHOVE = new Set(['crates', 'crate']);
// what O3 already makes a crime of through the set's 'smash' event (by 'fist')
const O3S = new Set(['glass', 'stall', 'newsstand']);
const _f = new THREE.Vector3();

export function kicking(G) { return G.held('KeyC') || G.held('ControlLeft') || G.held('ControlRight'); }

// what is in front of me within reach: { kind: 'thing' | 'glass' | 'item' | 'wall' | 'door' | 'car', gap, ... }
export function thingAhead(G, kick = false) {
  const e = G.eye, S = G.stage && G.stage.smash;
  const f = _f.set(0, 0, -1).transformDirection(G.camera.matrixWorld);
  const fl = Math.hypot(f.x, f.z) || 1, fx = f.x / fl, fz = f.z / fl, pitch = Math.asin(Math.max(-1, Math.min(1, f.y)));
  const reach = kick ? THING.kickReach : THING.reach;
  let best = null;
  const offer = (c) => { if (!best || c.gap + c.ang * 0.6 < best.gap + best.ang * 0.6) best = c; };
  const angTo = (x, z) => { const dx = x - e.x, dz = z - e.z, d = Math.hypot(dx, dz) || 1; return Math.acos(Math.max(-1, Math.min(1, (dx * fx + dz * fz) / d))); };
  // (looking at the sky: no thing; looking down past my feet: only a foot's)
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
    // (the jab's height on it: chest high, or its top; a kick: low)
    const y = kick ? it.y0 + Math.min(0.4, K.h * 0.5) : Math.max(it.y0 + 0.1, Math.min(it.y0 + K.h - 0.05, e.y - 0.45));
    offer({ kind: 'thing', it, gap, ang, point: new THREE.Vector3(nx, y, nz) });
  }
  // shop glass (the set's windows: glazed when met)
  const w = S && S.shopNear ? S.shopNear(e.x, e.z, null, reach + 0.3) : null;
  if (w && w.nx * fx + w.nz * fz < -0.5 && !(w.it && w.it.pane && w.it.pane.state === 'gone')) {
    const off = (e.x - w.x) * w.nx + (e.z - w.z) * w.nz, y = e.y - (kick ? 1.0 : 0.4);
    if (off > 0 && off < reach + 0.3 && Math.abs(y - w.y) < w.h / 2 - 0.1) {
      const t = off / Math.max(0.3, -(w.nx * fx + w.nz * fz));
      const px = e.x + fx * t, pz = e.z + fz * t;
      if (Math.abs((px - w.x) * w.nz - (pz - w.z) * w.nx) < w.w / 2 - 0.2) offer({ kind: 'glass', w, gap: off - 0.15, ang: 0, point: new THREE.Vector3(px - w.nx * 0.05, y, pz - w.nz * 0.05) });
    }
  }
  // a thing lying in front of my feet (items.ahead: a bottle on a stoop)
  const I = G.stage && G.stage.part && G.stage.part('items');
  const item = I && I.ahead ? I.ahead(e, fx, fz, reach + 0.3) : null;
  if (item) offer({ kind: 'item', item, gap: Math.hypot(item.x - e.x, item.z - e.z) - 0.3, ang: angTo(item.x, item.z) });
  // a wall, a door, a car (the bullets' world, along the look)
  if (G.rays) {
    const dir = kick ? new THREE.Vector3(fx, -0.35, fz).normalize() : f.clone();
    const h = G.rays.raycast(e.clone(), dir, reach + 0.35);
    if (h) {
      const P = h.mesh && h.mesh.userData.prop;
      const hp = h.point, gap = Math.hypot(hp.x - e.x, hp.z - e.z);
      const st = G.stage.part && G.stage.part('stream');
      const door = st && st.doorNear ? st.doorNear(hp.x, hp.z, 0.9) : null;
      // (a thing of the set whose shape the ray met - its own mesh or its chunk's merge - is the
      // set's, above; the ground is no wall)
      if (P && P.carD) offer({ kind: 'car', car: P.carD, gap, ang: 0, point: hp, normal: h.normal });
      else if (!(P && (P.K || P === 'merged')) && Math.abs(h.normal.y) < 0.6) offer({ kind: door ? 'door' : 'wall', door, gap, ang: 0, point: hp, normal: h.normal });
    }
  }
  return best;
}

// the press: the swing now, the answer at its contact (true: taken)
export function thingStep(G, R, arm) {
  const kick = kicking(G);
  const T = thingAhead(G, kick);
  if (!T) return false;
  const H = G.player.hands, S = G.stage.smash;
  const fl = Math.hypot(G.camera.matrixWorld.elements[8], G.camera.matrixWorld.elements[10]) || 1;
  const dir = new THREE.Vector3(-G.camera.matrixWorld.elements[8] / fl, 0, -G.camera.matrixWorld.elements[10] / fl);
  G.setViewmodelVisible(true);
  if (H.set !== 'fists') H.equip('fists');
  const land = () => answer(G, R, T, dir, kick, S);
  G.emit('city:swing', { thing: T.kind, kick });
  if (kick) {
    // (no foot in the hand kit: the eye dips and lunges, the fists stay up; the foot lands in 0.12 s)
    H.play('guard');
    if (G.controller.kick) G.controller.kick(-3.2, 1.5, 0.22);
    if (G.sfx && G.sfx.fight) G.sfx.fight('wind', null, { k: 0.4 });
    (R.fistQ || (R.fistQ = [])).push({ t: G.time + 0.12, fn: land });
  } else H.play(arm === 'L' ? 'jabL' : 'jabR', { onMark: { contact: land } });
  R.fistDown = G.time + 0.9;
  return true;
}

// the stepped queue (a kick's foot) and the beat after a hurt hand (fist.js calls it every step on foot)
export function thingTick(G, R) {
  if (R.fistQ && R.fistQ.length) for (let i = R.fistQ.length - 1; i >= 0; i--) if (G.time >= R.fistQ[i].t) { const q = R.fistQ.splice(i, 1)[0]; q.fn(); }
  return R.fistBeat != null && G.time < R.fistBeat;
}

function answer(G, R, T, dir, kick, S) {
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
    const by = SHOVE.has(kind) && !kick ? 'body' : 'fist';
    const sp = by === 'body' ? 1.7 : kick ? THING.kick : THING.jab;
    const res = S.hit(it, T.point, dir.clone().multiplyScalar(sp), by);
    if (res === 'hit') {
      if (IRON.has(kind)) {
        // (iron rings: the post's own ring under the clang)
        sfx.play(kind === 'lamp' || kind === 'pole' || kind === 'namesign' || kind === 'stop' ? 'c3_post' : 'clang', T.point, { k: kick ? 0.5 : 0.35 }, { ref: 3 });
        if (!kick) hurt();
        else if (ctl.kick) ctl.kick(1.4, 0.4, 0.12);
      } else {
        // (it shakes and stands: a thud, its own knock)
        sfx.play('f_jab', T.point, { k: 0.4 }, { ref: 3 });
        if (ctl.kick) ctl.kick(0.9, 0.4, 0.08);
      }
    } else if (res) {
      if (ctl.kick) ctl.kick(1.2, 0.8, 0.1);
      if (!O3S.has(kind) && G.crime) G.crime.emit('vandal', { x: it.x, z: it.z }, 'player');
    }
    G.emit('city:fist', { man: null, thing: kind, how: res, kick, hurt: hurtNow });
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
    G.emit('city:fist', { man: null, thing: 'glass', how: first ? 'crack' : 'break', kick });
    return;
  }
  if (T.kind === 'item') {
    const I = G.stage.part('items');
    const how = I.knock(T.item, dir);
    if (ctl.kick) ctl.kick(0.6, 0.3, 0.08);
    G.emit('city:fist', { man: null, thing: 'item:' + T.item.kind, how, kick });
    return;
  }
  if (T.kind === 'car') {
    sfx.play('c3_dent', T.point, { k: kick ? 0.7 : 0.45 }, { ref: 3 });
    if (ctl.kick) ctl.kick(1.0, 0.5, 0.1);
    G.emit('city:fist', { man: null, thing: 'car', how: 'dent', kick });
    return;
  }
  // a wall or a door: grit off the stone and a hurt hand; a door is knocked on
  if (T.kind === 'door') {
    sfx.play('b9thunk', T.point, { k: 0.55 }, { ref: 3 });
    if (ctl.kick) ctl.kick(0.7, 0.3, 0.08);
  } else {
    sfx.play('w_hitWall', T.point, { k: kick ? 0.6 : 0.4 }, { ref: 3 });
    if (S && S.chipsAt) S.chipsAt(T.point.clone(), T.normal ? T.normal.clone() : dir.clone().negate(), 0.06, 5);
    if (!kick) hurt();
  }
  G.emit('city:fist', { man: null, thing: T.kind, how: 'hit', kick, hurt: hurtNow });
}

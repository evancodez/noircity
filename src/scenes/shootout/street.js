import * as THREE from 'three';
import { gunsOf, Guns } from '../../guns/Guns.js';
import { DINER, SITE } from './site.js';
import { dinerOpenings } from '../../stages/block/site.js';
import { rig, roundAt } from './rig.js';
import { climbOut, doorOut, CLIMB } from './carOut.js';

// VIII, the street (lane C8; the brief's §3): a fight with choices, on the
// gun kit (docs/story/seams/GUNS.md). The place is the block as it stands:
// the diner (the counter is hard, the booths are chewed, the glass goes),
// the pavement, the cars (the engine end stops a round, an open door does
// not; a car shot long enough burns and goes, and takes the men behind it),
// the el's columns (steel). The men come as men would - out of their cars'
// doors and across to cover, out of the dark under the el, round the corner
// along the pavement to the door - and use the kit's rules: cover to cover,
// one goes round, the Tommy gunner pins, the heavy comes for the door.
// (no default export: not a scene)
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _v = V(0, 0, 0);

// the fight's place: the men take no cover outside it (the diner and the
// block between its front and the el's far columns)
export const AREA = { x0: -10.0, x1: 19.5, z0: -46, z1: 27 };
// the reasons a fall is given, in this chapter's words
export const WHY = {
  default: 'They got you.', rush: 'He walked right up to the door.', reload: 'Reloading in the open.', flank: 'They came round on you.',
  risen: 'Up over your cover too long.', tommy: 'The Tommy gun chewed through.', cover: 'Your cover was shot away.',
  bare: 'Down, but in the open.', angle: 'They had your angle.', moving: 'Shot in the open.', open: 'Shot standing in their sights.',
};
export const WARN = { rush: 'The big one’s at the door!', door: 'The door! Behind you!' };

// where a beat puts me (a retry of it: the checkpoint): inside, behind the counter's
// end or at a window - never out in the road before the men who shot me
export const AT = {
  cars: { x: -13.15, z: 0.62, yaw: -Math.PI / 2 },
  flank: { x: -13.15, z: 2.2, yaw: -Math.PI / 2 + 0.25 },
  // ([C8] after the critic: AT.el was open to the man on the el even crouched;
  // now down under the front wall by the pilaster between B4 and the door -
  // the wall's head hides me from every place on his rail (probed: 6 of 6))
  el: { x: -10.85, z: -1.6, yaw: -Math.PI / 2 - 0.2, crouch: true },
  saloon: { x: -13.15, z: -1.4, yaw: -Math.PI / 2 - 0.45 },
  cardinal: { x: -13.15, z: -1.4, yaw: -Math.PI / 2 - 0.45 },
  last: { x: -12.2, z: -0.4, yaw: -Math.PI / 2 - 0.5 },
};

// the places a player holds in the diner (the plays' good hand chooses among
// them; the bad one stands at the window): under the sills of the windows
// (the wall below them stops a round), behind the counter (round its end)
const E0 = -Math.PI / 2;
const BEHIND = [{ x: -13.3, z: -4.75 }, { x: -15.35, z: -4.6 }];
export const SPOTS = [
  { x: -10.8, z: -3.0, yaw: E0 }, { x: -10.8, z: -4.7, yaw: E0 + 0.3 }, { x: -10.8, z: -0.6, yaw: E0 }, { x: -10.8, z: 1.6, yaw: E0 },
  { x: -10.8, z: 4.2, yaw: E0 }, { x: -10.8, z: 5.9, yaw: E0 - 0.3 },
  // ([C8] after the critic: the second place behind the counter is south of Dot - she is down in
  // the aisle at z 0.6, and the way in is round the counter's south end)
  { x: -15.35, z: -2.4, yaw: E0, via: BEHIND }, { x: -15.35, z: -0.95, yaw: E0, via: BEHIND },
];
export const OPEN = { x: -11.0, z: -3.8 };

// ---- the cars: up the avenue, round what is in the road (the parked
// sedans at (2.6, -27), (-4.3, -25), (6.5, -19)), nose in at the far side
export const CARS = [
  // (from far down the avenue, between the el's west columns - they cross
  // the road there - and the kerb; past the parked sedans; then across to
  // the far side and nose in)
  // (A broadside across the far lane, its right side to the diner: its men
  // out of the far doors behind its body - a man climbing out is not a man
  // in the open; B nose in, its lamps through the glass)
  { rail: [[-3.0, -86], [-2.0, -74], [0.4, -62], [0.6, -56], [-0.2, -44], [-0.9, -31], [-0.9, -24], [1.4, -15.5], [4.2, -9.0], [5.4, -4.0], [5.6, 1.2]], delay: 0 },
  { rail: [[-3.2, -86], [-2.2, -74], [0.2, -62], [0.5, -56], [-0.4, -44], [-1.0, -31], [-1.0, -24], [1.4, -16.8], [4.6, -13.6], [7.2, -10.8], [8.2, -8.6], [6.8, -7.0]], delay: 5.5 },
];
// their men: the car, the door, the kind, the first place (the lee of the
// car or its door: then the kit's brain takes the cover it reads)
export const CAR_MEN = [
  { car: 0, door: 'lf', kind: 'pistol', delay: 0.4 },
  { car: 0, door: 'lr', kind: 'pistol', delay: 0.8 },
  { car: 0, door: 'lf', kind: 'pistol', delay: 2.2, run: { x: 12.6, z: 3.4 } },
  { car: 1, door: 'rf', kind: 'pistol', delay: 0.35 },
  // (the Tommy gunner: he pins the diner's front from behind his car)
  { car: 1, door: 'rr', kind: 'tommy', delay: 0.9 },
];
// (not used: eight in the first fight were a wall for the first-timer's hand -
// four tries and no way through; five is the first fight) two more out of the dark under the el
export const CARS_MORE = [
  { at: { x: 18.2, z: 7.5 }, steps: [{ x: 15.0, z: 6.0, run: true }, { x: 13.6, z: 4.6, run: true }], kind: 'pistol', wait: 0.2 },
  { at: { x: 18.2, z: -5.5 }, steps: [{ x: 15.2, z: -6.5, run: true }, { x: 12.6, z: -8.8, run: true }], kind: 'pistol', wait: 1.4 },
];
// ---- movement 2: out of the dark under the el's far side, between the
// columns to cover; and round the corner along the pavement to the door
export const UNDER_EL = [
  { at: { x: 18.1, z: 15.5 }, steps: [{ x: 15.2, z: 11.4, run: true }, { x: 13.9, z: 8.2, run: true }], kind: 'pistol', wait: 0.5 },
  { at: { x: 18.2, z: -16.5 }, steps: [{ x: 15.4, z: -14.6, run: true }, { x: 12.0, z: -12.6, run: true }], kind: 'pistol', wait: 1.6 },
  { at: { x: 18.1, z: 4.5 }, steps: [{ x: 15.6, z: 3.2, run: true }, { x: 14.0, z: 0.4, run: true }], kind: 'tommy', wait: 3.2 },
];
// and from the other side: one down the north pavement, round the corner of
// the block where the roadworks close it, for the door
export const NORTH = [
  { at: { x: -8.2, z: 27.0 }, steps: [{ x: -8.4, z: 16.0, run: true }, { x: -8.6, z: 9.5, run: true }], kind: 'pistol', wait: 0.5 },
];
// the man for Dot: out of the alley's mouth, round the corner, up the
// pavement under the windows to the door, in, and on to her
export const FOR_DOT = { at: { x: -9.6, z: -29.2 }, path: [{ x: -7.7, z: -28.7 }, { x: -7.8, z: -25.4 }, { x: -8.5, z: -20 }, { x: -8.4, z: -8.2 }, { x: -8.6, z: -4.0 }, { x: -9.5, z: -1.2 }, { x: -9.5, z: 0.6 }, { x: -11.3, z: 0.6 }, { x: -13.0, z: -1.6 }, { x: -14.2, z: -3.9 }, { x: -14.8, z: -4.25 }], aimFrom: 8 };
// ---- movement 3: high on the el; the drive-by; the heavy for the door
export const EL = { x: 11.95, z: 0.3, y: 10.72 };
export const DRIVEBY = {
  rail: [[-3.4, -86], [-2.2, -74], [0.3, -62], [0.5, -56], [-0.4, -44], [-1.0, -31], [-0.9, -24], [-1.9, -16], [-2.2, -4], [-2.2, 6], [-1.4, 17.5], [0.6, 23.8], [3.2, 24.8], [4.6, 22.0], [3.2, 13.0], [3.0, 5.0], [3.0, -4.0], [3.0, -12.0], [1.2, -20.0], [-0.9, -27.0], [-0.6, -40], [0.4, -50], [0.6, -58], [0.2, -64], [-2.0, -74], [-3.0, -86]],
  // the stretch he fires along the diner's front (z)
  fire: [-13, 13.5],
};
// (not used: with them the el was six at once from three sides - the clumsy
// hand four tries and no way through) two more round the corner from the alley's mouth
export const SOUTH = [
  { at: { x: -8.8, z: -29.0 }, steps: [{ x: -8.4, z: -20.0, run: true }, { x: -7.4, z: -13.0, run: true }], kind: 'pistol', wait: 0.3 },
  { at: { x: -8.4, z: -29.5 }, steps: [{ x: -6.0, z: -22.0, run: true }, { x: -5.0, z: -15.5, run: true }], kind: 'pistol', wait: 1.5 },
];
export const HEAVY = { at: { x: -8.4, z: -33.5 }, steps: [{ x: -8.6, z: -20.0 }, { x: -8.5, z: -8.4 }, { x: -8.7, z: -3.6 }, { x: -9.4, z: -1.2 }] };

// ---- the kit, begun for a beat (its setup: every retry) -------------------------------------
export function beginFight(ctx, beat, { maxFiring = 2, flankAfter = 13, settleK = 1.1, dmgK = 1 } = {}) {
  const G = ctx.game, K = gunsOf(G), R = rig();
  K.end();
  // [C8] fail softly: each fall in this beat gives its men a fifth more to
  // settle and a tenth less in a round (three falls at most: the beat as
  // written is the first try's; a player who keeps going down in one place
  // gets through in a try or two more, never by standing still - they still
  // kill a man who stands in the open)
  const f = Math.min(3, G.fails(beat));
  settleK += 0.22 * f;
  dmgK *= 1 - 0.1 * f;
  // (and after a fall nobody is sent round, from the second one fewer fires
  // at once: the clumsy first hand died in
  // the street to the flank and to three guns at once, try after try)
  if (f >= 2) maxFiring = Math.max(1, maxFiring - 1);
  if (f >= 1) flankAfter = 0;
  // ([C8] after the critic: drums are few - a man who emptied them all and
  // fell is told so, whatever the round that did it)
  const dry = () => { const RR = rig(); return !!RR && G.weapon.ammo <= 0 && RR.reserve <= 0 && (RR.dotLeft || 0) <= 0; };
  // (and a man of the scene's own - the kitchen, the el - says who it was)
  const own = () => { const L = K.lastKill; return L && L.ai && L.ai.h && L.ai.h.c8why; };
  const why = new Proxy(WHY, { get: (t, k) => (typeof k !== 'string' ? t[k] : dry() ? 'Out of drums.' : own() || t[k]) });
  widen(G, () => K.begin({ to: beat, maxFiring, flankAfter, settleK, dmgK, area: AREA, why, warn: WARN }));
  // [C8] the room dark: from the street they cannot find me in it until I
  // fire (the gun's flash: 2.5 s), or I stand in a car's lamps
  K.see = function c8see(a, b, pad) {
    const RR = rig();
    if (RR && !RR.lightsOn && b.x < DINER.innerX && a.x > DINER.faceX - 0.2 && G.time - RR.firedAt > 2.5) return false;
    return Guns.prototype.see.call(this, a, b, pad);
  };
  if (!R.kitOff) { R.kitOff = true; (R.onTeardown || (R.onTeardown = [])).push(() => { const K2 = gunsOf(G); K2.end(); delete K2.see; }); }
  return K;
}
// the kit's grid over the diner too: the block's bounds end at its front
// (the room is a region of its own); for the grid the bounds take it in
export function widen(G, fn) {
  const C = G.stage.colliders, B = C.bounds, x0 = B.minX;
  B.minX = Math.min(B.minX, DINER.backX - 0.2);
  try { return fn(); } finally { B.minX = x0; }
}
export function rebuild(G) { const K = gunsOf(G); widen(G, () => K.rebuild()); }

// ---- the men -----------------------------------------------------------------------------------
// a gunman of the kit, with his beat's mark (the beat's count reads it)
export function gunman(ctx, spec) {
  const G = ctx.game, K = gunsOf(G);
  const h = K.spawn({ kind: spec.kind || 'pistol', at: spec.at, way: spec.steps ? { steps: spec.steps } : null, wait: spec.wait ?? 0, cover: !!spec.cover, hp: spec.hp, yaw: spec.yaw ?? null, variant: spec.variant || null, door: spec.door || null, start: spec.start || null });
  h.c8beat = ctx.beat;
  return h;
}
// the men of a beat still up (the kit's and the scene's own)
export function alive(ctx, beat = ctx.beat) {
  const S = ctx.stage;
  return S.hoods.list.filter((h) => h.alive && h.c8beat === beat && !h.c8gone).length;
}

// a car up the avenue on its rail: lamps, the brakes as it swings in
export function carIn(ctx, spec, { onStop = null, key } = {}) {
  const G = ctx.game, S = ctx.stage, R = rig();
  const car = R.rails.spawn({ rail: spec.rail, lights: true, v0: 13, cruise: 13, decel: 8.5, lat: 6 });
  car.c8beat = ctx.beat;
  // (it goes up when it is shot for - its tank, its engine - not from a spray
  // along the street: about fifteen rounds into the tank, forty anywhere)
  car.limit = 46;
  R.cars[key] = car;
  car.meshes.lens.material = S.M.headlamp;
  let skid = false;
  car.rail.riders.push((c) => {
    if (!skid && c.rail.L - c.rail.s < 15 && c.rail.v > 6) { skid = true; G.sfx.play('b7_skid', c.pos.clone().setY(0.4), { dur: 1.3 }); }
  });
  car.rail.onStop = (c) => { G.sfx.play('b7_brake', c.pos.clone().setY(0.4)); if (onStop) onStop(c); };
  return car;
}

// the men out of a stopped car, one door at a time: in the seat as it
// opens, they climb out (carOut.js), then the kit has them
export function outOfCar(ctx, car, men, { beat = ctx.beat, firstRounds = true } = {}) {
  const G = ctx.game, R = rig();
  let t = 0, i = 0;
  const out = [];
  R.ticks.push((dt) => {
    if (car.state === 'dead' || !R.rails.list.includes(car)) return false;
    t += dt;
    while (i < men.length && t >= men[i].delay) {
      const m = men[i++];
      if (car.state === 'burning') continue;
      const door = R.rails.openDoor(car, m.door);
      // (an open door is a leaf of sheet steel and glass: a round goes through it)
      door.mesh.userData.cover = { kind: 'thin' };
      G.sfx.play('b7_carDoor', car.pos.clone().setY(1));
      const o = doorOut(car, m.door);
      // his first place: behind his own door, or a run across to the el
      const lee = m.run || leeOf(car, m.door);
      const h = gunman(ctx, { kind: m.kind, at: { x: o.x, z: o.z }, steps: [{ x: lee.x, z: lee.z, run: true }], wait: CLIMB + 0.05, yaw: o.yaw });
      h.c8beat = beat;
      climbOut(G, h, R.ticks, { yaw: o.yaw });
      R.ticks.push(((d0) => (dt2) => { if ((d0 -= dt2) > 0) return true; R.rails.doorBox(car, door); rebuild(G); return false; })(0.3));
      if (firstRounds) suppress(ctx, h, m.kind === 'tommy' ? 9 : 2, CLIMB + 0.4);
      out.push(h);
    }
    return i < men.length;
  });
  return out;
}
// behind the open door of a car (the side away from the diner), in its lee
function leeOf(car, key) {
  const D = { rf: [0.2, 1], rr: [-0.65, 1], lf: [0.2, -1], lr: [-0.65, -1] }[key];
  const p = V(D[0] - 0.55, 0, D[1] * 1.65).applyMatrix4(car.group.matrixWorld);
  return { x: p.x, z: p.z };
}

// a man's first rounds go into the windows (whatever glass is still whole):
// the front comes apart, the first lesson that what hides me will not last
export function suppress(ctx, h, n, delay) {
  const G = ctx.game, S = ctx.stage, R = rig();
  const front = S.part('dinerFront');
  let t = delay, left = n;
  R.ticks.push((dt) => {
    if (!h.alive || left <= 0) return false;
    if ((t -= dt) > 0) return true;
    const panes = Object.values(front.panes).filter((p) => p.state !== 'gone' && !p.parent);
    if (!panes.length) return false;
    const r = ctx.rng;
    const p = panes[Math.floor(r.next() * panes.length)];
    const c = p.centre || (p.mesh ? p.mesh.getWorldPosition(V(0, 0, 0)) : null);
    if (!c) return false;
    const target = c.clone().add(V(0, r.range(-0.5, 0.6), r.range(-(p.w || 1) * 0.35, (p.w || 1) * 0.35)));
    const k = (R.paneRounds || (R.paneRounds = new Map())).get(p) || 0;
    R.paneRounds.set(p, k + 1);
    roundAt(G, h, target, { heavy: h.gunKind === 'tommy', shatter: k >= 1 });
    left--;
    t = h.gunKind === 'tommy' ? r.range(0.08, 0.11) : r.range(0.35, 0.6);
    return true;
  });
}

// ---- [C8] nobody hides out the clock: no round from any of them for 12 s
// (a man pinned behind a column, me down deep in the room), the one of the
// kit's men nearest me comes in to the kerb before the diner, where he has me
export function pressOn(ctx) {
  const G = ctx.game, R = rig(), K = gunsOf(G);
  let shots = G.counters.hoodShots, quiet = 0;
  R.ticks.push((dt) => {
    if (G.failing || !K.active || R.won) { quiet = 0; return true; }
    if (G.counters.hoodShots !== shots) { shots = G.counters.hoodShots; quiet = 0; return true; }
    quiet += dt;
    if (quiet < 12) return true;
    quiet = 0;
    const e = G.eye;
    let best = null, bd = Infinity;
    for (const [h, ai] of G.ais) {
      const S = ai.brain && ai.brain.S;
      if (!h.alive || !S || S.state === 'entry' || S.state === 'wait' || ai.brain.kind === 'rusher') continue;
      const d = Math.hypot(h.pos.x - e.x, h.pos.z - e.z);
      if (d < bd) { bd = d; best = ai; }
    }
    if (!best) return true;
    const S = best.brain.S, tz = Math.max(-6, Math.min(9, e.z + (best.h.pos.z > e.z ? 2.5 : -2.5)));
    if (S.cover) { S.cover.taken = null; S.cover = null; S.fire = null; }
    if (best.brain.drop) best.brain.drop();
    best.path = null;
    S.entry = { steps: [{ x: -4.6, z: tz, run: true }, { x: -7.0, z: tz, run: true }], i: 0, opened: false, framed: 0 };
    S.state = 'entry'; S.t = 0;
    K.events.push({ t: +G.time.toFixed(2), what: 'pressOn', name: best.brain.kind });
    G.counters.c8pressOn = (G.counters.c8pressOn || 0) + 1;
    return true;
  });
}

// ---- the man for Dot (scripted, not the kit's: he walks for her, not for
// me): her cry as he comes in, a few seconds, then her
export function manForDot(ctx, { onDot }) {
  const G = ctx.game, S = ctx.stage, R = rig(), F = FOR_DOT;
  const h = G.spawnHood(F.at.x, F.at.z, { ai: false, variant: { coat: 2, brim: 1, tall: 0 }, yaw: 0, state: 'walk' });
  h.surface = (x, z) => S.surfaceY(x, z);
  h.c8beat = ctx.beat;
  h.c8dot = true;
  h.onMove = (hh) => { const K = gunsOf(G); if (K.active) K.resolveMan(hh); };
  let i = 0, inT = -1, aimT = 0, cried = false;
  const dot = ctx.cast.get('dot');
  const st = { h, inside: false, aiming: false, t: 0 };
  R.ticks.push((dt) => {
    if (!h.alive) { if (st.inside && !st.saved) { st.saved = true; if (dot) ctx.hud.say('Dot: ...thanks.', 1.6); } return false; }
    if (G.failing) return true;
    st.t += dt;
    const p = F.path[i];
    if (p) {
      const d = Math.hypot(p.x - h.pos.x, p.z - h.pos.z);
      if (d < 0.35) { i++; return true; }
      const yaw = Math.atan2(p.x - h.pos.x, p.z - h.pos.z);
      h.yaw += Math.atan2(Math.sin(yaw - h.yaw), Math.cos(yaw - h.yaw)) * Math.min(1, dt * 6);
      const sp = i <= 2 ? 2.6 : 1.35;
      if (h.state !== (sp > 2 ? 'run' : 'walk')) h.setState(sp > 2 ? 'run' : 'walk', 0.2);
      h.speed = sp;
      h.pos.x += Math.sin(h.yaw) * sp * dt; h.pos.z += Math.cos(h.yaw) * sp * dt;
      if (h.onMove) h.onMove(h);
    }
    // in at the door: her cry, the line, the clock
    if (!st.inside && h.pos.x < DINER.innerX) {
      st.inside = true; inT = 0;
      if (!cried) { cried = true; ctx.hud.say('Dot: The door!', 1.8); }
      ctx.hud.objective('Dot! Stop him.');
      h.setAim(true);
      G.counters.c8dotMan = (G.counters.c8dotMan || 0) + 1;
    }
    if (st.inside) {
      inT += dt;
      if (dot) h.lookAt(dot.pos.clone().setY(1.0));
      R.warn = 'He’s going for Dot!';
      if (!p || inT > F.aimFrom - 1.6) { if (!st.aiming) { st.aiming = true; h.speed = 0; h.setState('aim', 0.2); G.sfx.play('c2_cock', h.pos.clone().setY(1.4), {}, { ref: 3 }); } }
      if (inT > F.aimFrom) {
        aimT += dt;
        if (aimT > 0 && !st.fired) {
          st.fired = true;
          if (dot) roundAt(G, h, dot.pos.clone().setY(1.0));
          onDot();
        }
      }
    }
    return true;
  });
  return st;
}

// ---- [C8] after the critic: the flank through the kitchen. Round by the
// alley to the kitchen's back door: its crash, Dot's one word ("Kitchen!"),
// and he is up at the hatch behind the counter (the cook's place in I) - the
// counter, which hides me from the street, does not hide me from him. His
// tell is his rise into the hatch and the click; down below the pass he is
// behind the partition (it stops my rounds, as it stops his), up in the
// hatch he has the room, two rounds, then down again two seconds. The kit's pistol
// man's numbers. (His own small brain, as the el's: he does not walk the grid)
export const KITCHEN = { x: -16.74, z: 2.25, eyeY: 1.78, hatchX: DINER.backX + 0.55 };
export function kitchenMan(ctx) {
  const G = ctx.game, S = ctx.stage, K = gunsOf(G), R = rig(), H = DINER.hatch;
  G.sfx.play('office_doorKick', V(DINER.backX - 2.5, 1.2, KITCHEN.z));
  ctx.hud.say('Dot: Kitchen!', 1.8);
  const h = G.spawnHood(KITCHEN.x, KITCHEN.z, { ai: false, variant: { coat: 0, brim: 1, tall: 1 }, yaw: 0.1, state: 'kneel', hp: 100 });
  h.surface = (x, z) => S.surfaceY(x, z);
  h.c8beat = ctx.beat;
  h.c8kitchen = true;
  h.c8why = 'The kitchen. He was behind you.';
  h.gunKind = 'pistol';
  h.visible = false;
  if (h.object) h.object.visible = false;
  const ai = { h, heavy: false, brain: { kind: 'pistol', S: { state: 'hold' } } };
  // (from the hatch only through its opening: the partition is solid)
  const sees = (b) => {
    const a = V(h.pos.x, KITCHEN.eyeY, h.pos.z);
    const t = (KITCHEN.hatchX - a.x) / (b.x - a.x);
    if (!(t > 0 && t < 1)) return false;
    const y = a.y + (b.y - a.y) * t, z = a.z + (b.z - a.z) * t;
    if (!(z > H.z0 + 0.05 && z < H.z1 - 0.05 && y > H.y0 + 0.02 && y < H.y1 - 0.02)) return false;
    return K.see(a, b, 0.1);
  };
  const st = { h, mode: 'in', t: 0, n: 0, line: false };
  // (for the plays: can he see this point from the hatch)
  st.can = (p) => sees(p);
  R.ticks.push((dt) => {
    if (!h.alive) return false;
    if (G.failing || !K.active) return true;
    st.t += dt;
    const body = K.playerBody();
    const line = st.mode !== 'in' && st.mode !== 'down' && (sees(body.chest) || sees(body.head));
    st.line = line;
    // the warning: from the crash until he is down below the pass again
    if (st.mode === 'in' || st.mode === 'rise' || st.mode === 'aim' || st.mode === 'fire') R.warn = 'The kitchen! Behind you!';
    // (low below the pass he is turned along it, his gun with him - never through the panel; up, at me)
    const low = st.mode === 'in' || st.mode === 'down';
    if (low) { h.lookAt(null); h.yaw += Math.atan2(Math.sin(0.1 - h.yaw), Math.cos(0.1 - h.yaw)) * Math.min(1, dt * 8); }
    else { h.lookAt(G.eye.clone().setY(G.eye.y - 0.25)); const f = Math.atan2(G.eye.x - h.pos.x, G.eye.z - h.pos.z); h.yaw += Math.atan2(Math.sin(f - h.yaw), Math.cos(f - h.yaw)) * Math.min(1, dt * 8); }
    if (st.mode === 'in') {
      // (through the kitchen, low below the pass: his hat shows over it a moment before he rises)
      if (st.t > 0.7 && !(h.object && h.object.visible)) { h.visible = true; if (h.object) h.object.visible = true; }
      if (st.t > 1.5) { st.mode = 'rise'; st.t = 0; h.setState('idle', 0.35); }
      return true;
    }
    if (st.mode === 'rise') {
      if (st.t > 0.4) { st.mode = 'aim'; st.t = 0; h.setAim(true); ai.brain.S.state = 'aim'; G.sfx.play('c2_cock', V(h.pos.x, 1.7, h.pos.z), {}, { ref: 3 }); }
      return true;
    }
    if (st.mode === 'aim') {
      if (st.t > 0.75) { st.mode = 'fire'; st.t = 0; st.n = 0; ai.brain.S.state = 'fire'; }
      return true;
    }
    if (st.mode === 'fire') {
      if (st.t > 0.45) {
        st.t = 0; st.n++;
        const dmgK = (K.cfg && K.cfg.dmgK) || 1;
        if (line) K.hoodRound(ai, body.chest.clone(), 0.022, 17 * dmgK, { tommy: false });
        else if (st.lastAt) K.hoodRound(ai, st.lastAt, 0.05, 17 * dmgK, { tommy: false });
        if (line) st.lastAt = body.chest.clone();
        h.fire();
        if (st.n >= 2) { st.mode = 'down'; st.t = 0; h.setAim(false); ai.brain.S.state = 'hold'; h.setState('kneel', 0.3); }
      }
      return true;
    }
    if (st.mode === 'down') {
      // (down below the pass a breath; up again)
      if (st.t > 2.0) { st.mode = 'rise'; st.t = 0; h.setState('idle', 0.35); }
      return true;
    }
    return true;
  });
  return st;
}

// ---- high on the el: a Tommy gunner at the rail (his own brain: he does not
// walk the street's grid). His tell: the gun comes up over the rail, a click,
// half a second; then a burst down at me if he has a line. The counter does
// not hide a man from him; a column, the room's back, the ceiling do
export function elGunman(ctx) {
  const G = ctx.game, S = ctx.stage, K = gunsOf(G), R = rig();
  const h = G.spawnHood(EL.x + 1.4, EL.z - 0.4, { ai: false, heavy: true, variant: { coat: 1, brim: 1, tall: 1, heavy: true }, yaw: -Math.PI / 2, state: 'idle', hp: 120 });
  h.surface = () => EL.y;
  h.pos.y = EL.y;
  h.c8beat = ctx.beat;
  h.gunKind = 'tommy';
  h.c8why = 'The man on the el had you.';
  const ai = { h, heavy: true, brain: { kind: 'tommy', S: { state: 'hold' } } };
  const st = { mode: 'in', t: 0, n: 0, h, ai };
  // (for the plays: could he see this point from somewhere on his rail)
  st.can = (p) => [0.3, -3.5, 4.2, -7.2, 7.8, -10.5, h.pos.z].some((z) => sees(V(EL.x, EL.y + 1.55, z), p));
  // (from up there into the room only through the front's openings: the
  // building's face above them is brick ten metres high - the rays through
  // the room's ceiling are not to be trusted from above, so the line is
  // checked against the front itself)
  const OPS = dinerOpenings();
  const sees = (a, b) => {
    if (b.x < DINER.faceX && a.x > DINER.faceX) {
      const t = (DINER.faceX - a.x) / (b.x - a.x), y = a.y + (b.y - a.y) * t, z = a.z + (b.z - a.z) * t;
      if (!OPS.some((o) => z > o.z0 + 0.05 && z < o.z1 - 0.05 && y > o.y0 && y < o.y1)) return false;
    }
    return K.see(a, b, 0.15);
  };
  R.ticks.push((dt) => {
    if (!h.alive) { if (!st.fell) { st.fell = true; overTheRail(ctx, h); } return false; }
    if (G.failing || !K.active) return true;
    st.t += dt;
    const body = K.playerBody();
    const eye = V(h.pos.x, EL.y + 1.55, h.pos.z);
    const line = sees(eye, body.chest) || sees(eye, body.head);
    st.line = line;
    if (st.mode === 'in') {
      // (up to the rail from the deck's middle)
      const dx = EL.x - h.pos.x;
      h.speed = 1.2; h.setState('walk', 0.2);
      h.pos.x += Math.sign(dx) * Math.min(Math.abs(dx), 1.2 * dt);
      h.pos.z += (EL.z - h.pos.z) * Math.min(1, dt * 2);
      if (Math.abs(dx) < 0.05) { st.mode = 'watch'; st.t = 0; h.speed = 0; h.setState('idle', 0.2); }
      return true;
    }
    h.lookAt(G.eye.clone());
    if (st.to == null) h.yaw += Math.atan2(Math.sin(Math.atan2(G.eye.x - h.pos.x, G.eye.z - h.pos.z) - h.yaw), Math.cos(Math.atan2(G.eye.x - h.pos.x, G.eye.z - h.pos.z) - h.yaw)) * Math.min(1, dt * 4);
    else h.yaw = st.to > h.pos.z ? 0 : Math.PI;
    if (st.mode === 'watch') {
      if (line && st.t > 1.2 && st.to == null) { st.mode = 'raise'; st.t = 0; h.setAim(true); ai.brain.S.state = 'aim'; G.sfx.play('c2_cock', eye, {}, { ref: 4 }); return true; }
      // (no line for a while: along the rail for one - he walks the deck's edge)
      st.noLine = line ? 0 : (st.noLine || 0) + dt;
      if (st.noLine > 6 && st.to == null) {
        st.noLine = 0;
        const zs = [0.3, -3.5, 4.2, -7.2, 7.8, -10.5];
        const pick = zs.find((z) => Math.abs(z - h.pos.z) > 0.5 && (sees(V(EL.x, EL.y + 1.55, z), body.chest) || sees(V(EL.x, EL.y + 1.55, z), body.head)));
        if (pick != null) st.to = pick;
      }
      if (st.to != null) {
        const dz = st.to - h.pos.z;
        if (Math.abs(dz) < 0.06) { st.to = null; h.speed = 0; h.setState('idle', 0.2); }
        else { h.speed = 1.6; if (h.state !== 'walk') h.setState('walk', 0.2); h.pos.z += Math.sign(dz) * Math.min(Math.abs(dz), 1.6 * dt); }
      }
      return true;
    }
    if (st.mode === 'raise') { if (st.t > 0.75) { st.mode = 'fire'; st.t = 0; st.n = 0; ai.brain.S.state = 'fire'; } return true; }
    if (st.mode === 'fire') {
      if (st.t > 0.095) {
        st.t = 0; st.n++;
        const at = line ? body.chest.clone() : (st.lastAt || body.chest.clone());
        if (line) st.lastAt = at.clone();
        K.hoodRound(ai, at, 0.024 + st.n * 0.004, 8, { tommy: true });
        h.fire();
        if (st.n >= 9) { st.mode = 'watch'; st.t = -1.6; h.setAim(false); ai.brain.S.state = 'hold'; }
      }
      return true;
    }
    return true;
  });
  return st;
}
// hit, he goes over the rail and down onto the street (or a car's roof)
function overTheRail(ctx, h) {
  const G = ctx.game, R = rig();
  const cars = Object.values(R.cars).filter((c) => c.state !== 'dead');
  let best = null, bd = 5;
  for (const c of cars) { const d = Math.hypot(c.pos.x - h.pos.x, c.pos.z - h.pos.z); if (d < bd) { bd = d; best = c; } }
  let land = V(h.pos.x - 1.8, 0, h.pos.z);
  if (best) { const lp = G.stage.cars.local(best, V(h.pos.x, 1, h.pos.z), V(0, 0, 0)); lp.set(Math.max(-1.5, Math.min(0.5, lp.x)), 1.6, Math.max(-0.45, Math.min(0.45, lp.z))); land = lp.applyMatrix4(best.group.matrixWorld).setY(0); }
  const top = best ? (best.state === 'burning' ? 1.25 : 1.68) : G.stage.surfaceY(land.x, land.z);
  const p0 = h.pos.clone(), y0 = EL.y;
  const out = V(land.x - p0.x, 0, land.z - p0.z).normalize();
  const p1 = p0.clone().addScaledVector(out, 0.75);
  const y1 = y0 - 0.5, T1 = 0.4;
  const T2 = Math.sqrt(2 * Math.max(0.1, y1 - top) / 9.8);
  let t = 0, landed = false;
  h.script = (hd, tt, dt) => {
    if (landed) return;
    t += dt;
    let x, z, y;
    if (t < T1) { const u = t / T1, e = u * u * (3 - 2 * u); x = p0.x + (p1.x - p0.x) * e; z = p0.z + (p1.z - p0.z) * e; y = y0 + 0.25 * Math.sin(Math.PI * u * 0.8) - 0.5 * u * u; }
    else { const u = Math.min(1, (t - T1) / T2); x = p1.x + (land.x - p1.x) * u; z = p1.z + (land.z - p1.z) * u; y = Math.max(top, y1 - 4.9 * (t - T1) * (t - T1)); }
    hd.pos.x = x; hd.pos.z = z;
    hd.surface = () => y;
    if (t > T1 && y <= top + 1e-3) {
      landed = true;
      hd.surface = () => top;
      G.sfx.play('b7_bodyRoof', hd.pos.clone().setY(top), { k: best ? 1 : 0.6 });
      if (best && best.rail) R.rails.bump(best, -0.9);
    }
  };
}

// ---- the drive-by: down the near side past the diner, round at the end of
// the block, back up the far side; a Tommy gun from its back window. It
// steers round what is in the road on its rail; held up (a car, a man, a
// wreck) it stops and they get out. The driver hit, or the engine: it goes
// off its line into a post and burns
export function driveBy(ctx, { onOut, stopNear = null } = {}) {
  const G = ctx.game, S = ctx.stage, K = gunsOf(G), R = rig(), D = DRIVEBY;
  const car = R.rails.spawn({ rail: D.rail, lights: true, v0: 12, cruise: 12.5, stop: false, lat: 6.5, decel: 7, accel: 4 });
  car.c8beat = ctx.beat;
  R.cars.driveby = car;
  car.meshes.lens.material = S.M.headlamp;
  const seat = (lx, lz) => V(lx, 0, lz).applyMatrix4(car.group.matrixWorld);
  const mk = (lx, lz, heavy) => { const s = seat(lx, lz); const h = G.spawnHood(s.x, s.z, { ai: false, heavy, variant: { coat: heavy ? 1 : 0, brim: 1, tall: 1, heavy }, state: 'idle', hp: heavy ? 90 : 60 }); h.c8beat = ctx.beat; h.setState('sitCar', 0); if (h.collider) h.collider.r = 0.01; return h; };
  const driver = mk(0.1, -0.35, false), gunner = mk(-0.85, 0.35, true);
  gunner.gunKind = 'tommy';
  const ai = { h: gunner, heavy: true, brain: { kind: 'tommy', S: { state: 'fire' } } };
  const st = { car, driver, gunner, out: false, crashed: false, t: 0, rounds: 0, fireT: 0 };
  car.rail.onBlocked = () => { if (!st.crashed) getOut(); };
  const getOut = () => {
    if (st.out) return;
    st.out = true;
    car.rail.plan.v.fill(0); car.rail.done = true; car.rail.stopped = true;
    const men = [];
    for (const [h, key, kind] of [[gunner, 'rr', 'tommy'], [driver, 'lf', 'pistol']]) {
      if (!h.alive) continue;
      const o = doorOut(car, key);
      G.removeHood(h);
      const door = R.rails.openDoor(car, key);
      door.mesh.userData.cover = { kind: 'thin' };
      const m = gunman(ctx, { kind, at: { x: o.x, z: o.z }, steps: [{ x: o.x + (o.x > 0 ? 1.2 : -0.4), z: o.z, run: true }], wait: CLIMB + 0.05, yaw: o.yaw });
      climbOut(G, m, R.ticks, { yaw: o.yaw });
      men.push(m);
    }
    R.ticks.push(((d0) => (dt) => { if ((d0 -= dt) > 0) return true; rebuild(G); return false; })(0.5));
    if (onOut) onOut(men);
  };
  car.rail.riders.push((c, dt) => {
    const M = c.group.matrixWorld;
    for (const [h, lx, lz] of [[driver, 0.12, -0.36], [gunner, -0.82, 0.3]]) {
      if (!S.hoods.list.includes(h) || (!h.alive && h._deathT > 0.4)) continue;
      const p = _v.set(lx, 0, lz).applyMatrix4(M);
      h.pos.x = p.x; h.pos.z = p.z;
      const y = p.y + 0.3;
      h.surface = () => y;
      h.yaw = c.yaw + (h === gunner ? 0.0 : -Math.PI / 2);
      if (h === gunner && h.alive) h.lookAt(G.eye.clone().setY(G.eye.y - 0.3));
    }
    if (c.state === 'burning' || st.crashed || st.out) return;
    // ([C8] the second time round: it pulls up by the diner and they get out)
    if (stopNear != null && c.pos.x < 1 && c.pos.z > stopNear && driver.alive) { G.sfx.play('b7_brake', c.pos.clone().setY(0.4)); getOut(); return; }
    // crippled: the driver hit, or the engine: off the rail into a post
    if (!driver.alive || c.pts >= 6) {
      st.crashed = true;
      const ahead = V(Math.cos(c.yaw), 0, -Math.sin(c.yaw));
      let best = null, bs = Infinity;
      for (const q of [{ x: -6.7, z: 16.0 }, { x: -6.7, z: -17.5 }, { x: 11.8, z: 1.6 }, { x: 10.6, z: -9.9 }, { x: 13.0, z: 13.1 }, { x: 9.6, z: -21.4 }]) {
        const dx = q.x - c.pos.x, dz = q.z - c.pos.z, dd = Math.hypot(dx, dz);
        if (dd < 5 || dd > 30 || (dx * ahead.x + dz * ahead.z) / dd < 0.35) continue;
        const score = dd + 2 * Math.abs(dx * ahead.z - dz * ahead.x);
        if (score < bs) { bs = score; best = q; }
      }
      c.rail.onCrash = (cc) => wrecked(ctx, cc, st);
      if (best) R.rails.crash(c, { at: best });
      else { c.rail.plan.v.fill(0); c.rail.onStop = () => wrecked(ctx, c, st); }
      return;
    }
    // the Tommy gun from the window along the diner's front (the first rounds into the front: the tell)
    const near = c.pos.z > D.fire[0] && c.pos.z < D.fire[1] && gunner.alive;
    if (!near) { if (st.burst) { st.burst = false; gunner.setAim(false); } return; }
    if (!st.burst) { st.burst = true; gunner.setAim(true); st.fireT = 0.3; G.sfx.play('c2_cock', gunner.pos.clone().setY(1.3), {}, { ref: 4 }); }
    st.fireT -= dt;
    if (st.fireT > 0) return;
    st.fireT = 0.1;
    st.rounds++;
    if (st.rounds < 6) roundAt(G, gunner, V(DINER.faceX + 0.05, 1.0 + ctx.rng.next() * 2.2, c.pos.z + ctx.rng.range(-2.5, 2.5)), { heavy: true, shatter: true });
    else { K.hoodRound(ai, K.playerBody().chest.clone(), 0.035, 8, { tommy: true }); gunner.fire(); }
  });
  return st;
}
function wrecked(ctx, car, st) {
  const G = ctx.game, S = ctx.stage, R = rig();
  G.sfx.play('b7_crash', car.pos.clone().setY(0.8));
  G.controller.shake(0.5, car.pos.distanceTo(G.eye));
  for (const l of S.lamps.lamps) if (l.kind === 'post' && Math.hypot(l.head.x - 1.5 - car.pos.x, l.head.z - car.pos.z) < 4 && !l.dead) S.lamps.shootOut(l, V(0, 0, 1));
  car.rail.engine = false;
  S.cars.startSmoke(car, 2.2);
  for (const h of [st.driver, st.gunner]) if (h.alive) G.killHood(h, V(0, 0.3, 1).normalize(), false, 'deathBack');
  R.rails.settle(car);
  rebuild(G);
}

// ---- the heavy, for the door: the kit's rusher, up the pavement from the south
export function heavyForDoor(ctx) {
  return gunman(ctx, { kind: 'rusher', at: HEAVY.at, steps: HEAVY.steps, wait: 0.5 });
}

export { SITE };

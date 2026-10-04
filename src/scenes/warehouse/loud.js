import * as THREE from 'three';
import { gunsOf } from '../../guns/Guns.js';
import { PIER } from '../../stages/pier9/site.js';

// [C7] Pier Nine's second pass (docs/story/briefs/C7_PIER.md "Pass two"):
// the same shed, lit along its main aisle, the Cardinal's men hunting me
// with torches and pistols. Two rule sets meet here:
//   - until they have me, they are the crew of the quiet pass: a man sees
//     what his torch falls on and what stands in a lamp's light; a shot is
//     heard, and they come to it. A round of mine drops a man who does not
//     know I am there; a lamp can be shot out (a round spent for a pool of
//     black).
//   - the moment one of them is sure of me (the shout), every hunter still
//     on his feet is a gunman of the gun kit (src/guns/Guns.js): cover,
//     the tell, the settle - the loud way out.
// Either way the goal is the loading bay.
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PI = Math.PI;

// the hunters: two of the Cardinal's Hoods that held the stairs (if they are
// still on their feet), and two more with pistols, in at the big doors
export const HUNTERS = [
  // aisle B, the long lit way, from the doors to the cross aisle under the stairs
  { name: 'gun1', kind: 'hood', light: 'torch', hunter: true, at: [1.4, -2.2], yaw: PI, speed: 1.35, variant: { coat: 1, brim: 1, tall: 0 },
    route: [{ x: 0.4, z: -26.6, wait: 2.6, looks: [PI, -PI / 2, PI / 2] }, { x: 0.4, z: -13.0, wait: 2.0, looks: [-PI / 2, PI / 2] }] },
  // the bay's man: the way out is his to watch (he walks its mouth and looks in)
  { name: 'gun3', kind: 'hood', light: 'torch', hunter: true, at: [8.6, -2.2], yaw: PI, speed: 1.4, variant: { coat: 0, brim: 1, tall: 1, cig: true },
    route: [{ x: 9.6, z: -29.2, wait: 3.0, looks: [PI, PI - 0.6, -PI / 2] }, { x: 6.2, z: -28.4, wait: 2.4, looks: [PI, -PI / 2 - 0.4] }] },
];
// the two at the stairs' foot hunt too: one holds the west stairs, one walks the strip
// (spread over the floor, none at the west stairs' foot: the man who goes
// up to answer the telephone walks there from his round)
export const HOODS_LOUD = {
  hood1: { route: [{ x: -11.0, z: -31.0, wait: 2.6, looks: [PI, PI / 2, 0] }, { x: -11.0, z: -16.5, wait: 2.4, looks: [PI / 2, PI] }] },
  // (the strip before the bay: he watches the floor's north end and the bay's mouth)
  hood2: { route: [{ x: 8.4, z: -36.4, wait: 2.6, looks: [PI / 2 + 0.4, 0, PI / 2] }, { x: 3.6, z: -36.4, wait: 2.6, looks: [0.3, -0.5] }] },
};

// the hanging lamps a round can put out (the dead stay dead until the
// checkpoint's setup lights them again)
export function relightLamps(stage) {
  for (const l of stage.lamps.lamps) {
    if (l.torch) continue;
    if (l.dead) { l.dead = false; l.deadT = 0; l.buzz = null; l.dieNow = false; l.deadK = 0; }
    if (l.row || l.name) { l.on = true; l.dying = null; }
  }
}

// a round of mine (the 'shot' event: the eye's line at the moment it went):
// a lamp's head on the line puts it out; a hunter who did not have me goes
// down; the shot is heard all over the shed
export function onShot(ctx, L, ray) {
  const G = ctx.game, stage = ctx.stage, crew = L.crew;
  const o = ray.o, d = ray.d;
  const far = ray.far ?? 80;
  // the first thing on the line: a lamp's head, a man's body, the wall
  let best = null;
  const lampsL = stage.lamps;
  if (lampsL.game == null) lampsL.game = G;
  for (const l of lampsL.lamps) {
    if (l.torch || l.dead || !l.head || !l.name) continue;
    const t = _proj(o, d, l.head);
    if (t < 0.5 || t > far + 0.6) continue;
    if (_dist(o, d, t, l.head) < 0.42 && (!best || t < best.t)) best = { t, lamp: l };
  }
  for (const m of crew.men) {
    if (m.down) continue;
    const top = m.eye(_w).y + 0.15, foot = top - 1.85;
    // (his body a column 0.3 m round from his knees to the top of his head)
    for (let t = 0.5; t < Math.min(far, 40); t += 0.12) {
      const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
      if (y < foot + 0.4 || y > top) continue;
      if (Math.hypot(x - m.pos.x, z - m.pos.z) < 0.3) { if (!best || t < best.t) best = { t, man: m, at: V(x, y, z) }; break; }
    }
  }
  if (best && best.lamp) {
    lampsL.shootOut(best.lamp, d.clone());
    G.counters.c7lamps = (G.counters.c7lamps || 0) + 1;
    G.emit('c7:lamp', { name: best.lamp.name });
  } else if (best && best.man) {
    // (a round in the head drops a man who did not know I was there; one in
    // the body hurts him, and he knows: the shout, and it is the gunfight)
    const m = best.man, head = best.at.y > m.eye(_w).y - 0.24;
    if (G.fx && G.fx.bloodFx) G.fx.bloodFx.hit(best.at, d.clone(), { strength: 1.1, rays: G.rays });
    G.sfx.play('grunt', best.at, { f0: 90, k: 0.6, dur: 0.25 }, { ref: 3 });
    G.counters.c7shot = (G.counters.c7shot || 0) + 1;
    // ([C7] once they are loud the only crew left is the man up on the
    // catwalk: two in the body put him down, as a gunman)
    if (head || (L.loud && (m.hurt || 0) + 55 >= 100)) { m.hurt = (m.hurt || 0) + 55; m.shot(); }
    else { m.hurt = (m.hurt || 0) + 55; crew.alarm(m); }
  }
  // (a shot is heard: the nearest two come to where it was fired from;
  // the rest stop and look)
  const from = V(o.x, 0, o.z);
  crew.sendNearest(from, 2, 'crash', 60);
  crew.noise(from, 30, 'step');
}
const _w = V(0, 0, 0);
function _proj(o, d, p) { return (p.x - o.x) * d.x + (p.y - o.y) * d.y + (p.z - o.z) * d.z; }
function _dist(o, d, t, p) { return Math.hypot(o.x + d.x * t - p.x, o.y + d.y * t - p.y, o.z + d.z * t - p.z); }

// the shout: every hunter still on his feet becomes a gunman of the gun
// kit where he stands (his torch dropped), the crew's own rules end
export function goLoud(ctx, L) {
  const G = ctx.game;
  if (L.loud) return;
  L.loud = true;
  L.gunmen = L.gunmen || [];
  // ([C10a] after the critic: loud before the telephone's man had set off (a
  // round fired in the pass's first seconds) left nobody who could climb - the
  // gunmen stand on the floor - so a man crouched behind the catwalk's boards
  // was never reached: nothing came, nothing was lost, for minutes. Now the
  // answerer still goes up (the crew's rule, his torch, his cosh, his own
  // warning); back at the stairs' foot he draws like the rest (drawGuns))
  if (!L.answerer) L.answerer = sendAnswerer(ctx, L) || true;
  drawGuns(ctx, L);
  G.emit('c7:loud', { men: L.gunmen.length, t: +G.time.toFixed(2) });
}

// every man of the crew on the floor who is not on his way up to answer the
// telephone becomes a gunman where he stands (the shout; [C10a] and the
// answerer when he is down again - called each step while loud)
export function drawGuns(ctx, L) {
  const G = ctx.game, K = gunsOf(G), crew = L.crew;
  for (const m of [...crew.men]) {
    if (m.down) continue;
    // (a man up on the catwalk keeps the crew's rule: he comes at me, the cosh)
    if (m.upLvl || m.answering) continue;
    const at = { x: m.pos.x, z: m.pos.z };
    // (the shout, then each draws: the first a half second on, the rest after
    // him - the moment to get down or get out of their light)
    const h = K.spawn({ kind: 'pistol', at, yaw: m.fig.yaw, variant: m.spec.variant || null, name: m.name, wait: 0.55 + 0.4 * L.gunmen.length, hp: m.hurt ? Math.max(20, 100 - m.hurt) : null });
    // (they stand on the shed's floor, never on the mezzanine's level over it)
    h.surface = () => 0;
    L.gunmen.push(h);
    m.remove(); ctx.cast.remove(m.c);
    crew.men.splice(crew.men.indexOf(m), 1);
  }
  if (!crew.men.some((m) => !m.down && (m.upLvl || m.answering))) crew.onCaught = null;
}

// the telephone rang behind me: one of them goes up to answer it - up the
// west stairs, along the catwalk to the office's door, a look along the
// catwalk with his torch, and back down (so a man who waits up there in the
// dark is found: waiting is not a way out)
export function sendAnswerer(ctx, L) {
  const crew = L.crew, mezz = ctx.stage.part('mezz');
  const pick = crew.get('hood1') && !crew.get('hood1').down ? crew.get('hood1')
    : crew.men.filter((m) => !m.down && m.spec.hunter).sort((a, b) => Math.hypot(a.pos.x + 3, a.pos.z + 40) - Math.hypot(b.pos.x + 3, b.pos.z + 40))[0];
  if (!pick || pick.mode === 'alarm') return null;
  pick.canClimb(mezz);
  const back = pick.route;
  pick.route = [
    { x: -2.9, z: -40.2, wait: 0 }, { x: -9.0, z: -40.2, wait: 0 }, { x: -9.7, z: -41.55, wait: 0 },
    { x: 1.3, z: -41.55, wait: 4.5, looks: [Math.PI / 2, Math.PI / 2 - 0.25, Math.PI / 2 + 0.2] },
    { x: -9.7, z: -41.55, wait: 0 }, { x: -9.0, z: -40.2, wait: 0 }, { x: -2.9, z: -40.2, wait: 0 },
    ...back,
  ];
  pick.ri = 0; pick.wait = 0; pick.path = null;
  pick.setMode('patrol');
  pick.answering = true;
  // (once: back at the stairs' foot he takes up his own round again)
  pick.routeThen = back; pick.answerN = 7;
  return pick;
}

// am I at the bay (the way out): its floor, or the far stairs' lower half
export function atBay(stage, C) {
  if (stage.part('mezz').up && !(C.pos.x > 11.2 && Math.abs(C.pos.z - PIER.stairs.E.z) < 0.7)) return false;
  const onStairs = C.pos.x > 11.2 && C.pos.x < PIER.stairs.E.foot + 0.1 && Math.abs(C.pos.z - PIER.stairs.E.z) < 0.7;
  // (its floor, and the back corner under the mezzanine's east end)
  const inBay = C.pos.x > PIER.bay.x0 + 0.3 && C.pos.z > PIER.bay.z0 && C.pos.z < -29.4 && C.groundY < 0.5;
  return onStairs || inBay;
}

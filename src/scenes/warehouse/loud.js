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
// still on their feet), and three more with pistols, in at the big doors
export const HUNTERS = [
  // aisle B, the long lit way, from the doors to the cross aisle under the stairs
  { name: 'gun1', kind: 'hood', light: 'torch', hunter: true, at: [1.4, -2.2], yaw: PI, speed: 1.35, variant: { coat: 1, brim: 1, tall: 0 },
    route: [{ x: 0.4, z: -26.6, wait: 2.6, looks: [PI, -PI / 2, PI / 2] }, { x: 0.4, z: -13.0, wait: 2.0, looks: [-PI / 2, PI / 2] }] },
  // the east side: up aisle C to the hoist's load and back
  { name: 'gun2', kind: 'hood', light: 'torch', hunter: true, at: [5.4, -2.2], yaw: PI, speed: 1.35, variant: { coat: 2, brim: 0, tall: 1 },
    route: [{ x: 11.2, z: -24.0, wait: 2.2, looks: [PI, PI / 2, -PI / 2] }, { x: 11.2, z: -9.0, wait: 2.0, looks: [-PI / 2, 0] }] },
  // the bay's man: the way out is his to watch (he walks its mouth and looks in)
  { name: 'gun3', kind: 'hood', light: 'torch', hunter: true, at: [8.6, -2.2], yaw: PI, speed: 1.4, variant: { coat: 0, brim: 1, tall: 1, cig: true },
    route: [{ x: 9.6, z: -29.2, wait: 3.0, looks: [PI, PI - 0.6, -PI / 2] }, { x: 6.2, z: -28.4, wait: 2.4, looks: [PI, -PI / 2 - 0.4] }] },
];
// the two at the stairs' foot hunt too: one holds the west stairs, one walks the strip
export const HOODS_LOUD = {
  hood1: { route: [{ x: -2.6, z: -37.2, wait: 3.0, looks: [PI / 2 + 0.3, -PI / 2, 0.2] }, { x: -6.0, z: -29.2, wait: 2.0, looks: [PI, 0] }] },
  hood2: { route: [{ x: 6.8, z: -36.6, wait: 2.6, looks: [PI / 2, -0.4] }, { x: -0.6, z: -36.6, wait: 2.6, looks: [PI, -PI / 2] }] },
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
    const top = m.eye(_w).y + 0.15;
    // (his body a column 0.3 m round from his knees to the top of his head)
    for (let t = 0.5; t < Math.min(far, 40); t += 0.12) {
      const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
      if (y < 0.4 || y > top) continue;
      if (Math.hypot(x - m.pos.x, z - m.pos.z) < 0.3) { if (!best || t < best.t) best = { t, man: m, at: V(x, y, z) }; break; }
    }
  }
  if (best && best.lamp) {
    lampsL.shootOut(best.lamp, d.clone());
    G.counters.c7lamps = (G.counters.c7lamps || 0) + 1;
    G.emit('c7:lamp', { name: best.lamp.name });
  } else if (best && best.man) {
    best.man.shot();
    if (G.fx && G.fx.bloodFx) G.fx.bloodFx.hit(best.at, d.clone(), { strength: 1.1, rays: G.rays });
    G.sfx.play('grunt', best.at, { f0: 90, k: 0.6, dur: 0.25 }, { ref: 3 });
    G.counters.c7shot = (G.counters.c7shot || 0) + 1;
  }
  // (a shot is heard: the nearest three come to where it was fired from;
  // the rest stop and look)
  const from = V(o.x, 0, o.z);
  crew.sendNearest(from, 3, 'crash', 60);
  crew.noise(from, 30, 'step');
}
const _w = V(0, 0, 0);
function _proj(o, d, p) { return (p.x - o.x) * d.x + (p.y - o.y) * d.y + (p.z - o.z) * d.z; }
function _dist(o, d, t, p) { return Math.hypot(o.x + d.x * t - p.x, o.y + d.y * t - p.y, o.z + d.z * t - p.z); }

// the shout: every hunter still on his feet becomes a gunman of the gun
// kit where he stands (his torch dropped), the crew's own rules end
export function goLoud(ctx, L) {
  const G = ctx.game, K = gunsOf(G), crew = L.crew;
  if (L.loud) return;
  L.loud = true;
  L.gunmen = L.gunmen || [];
  for (const m of [...crew.men]) {
    if (m.down) continue;
    const at = { x: m.pos.x, z: m.pos.z };
    const h = K.spawn({ kind: 'pistol', at, yaw: m.fig.yaw, variant: m.spec.variant || null, name: m.name, wait: 0 });
    // (they stand on the shed's floor, never on the mezzanine's level over it)
    h.surface = () => 0;
    L.gunmen.push(h);
    m.remove(); ctx.cast.remove(m.c);
    crew.men.splice(crew.men.indexOf(m), 1);
  }
  crew.onCaught = null;
  G.emit('c7:loud', { men: L.gunmen.length, t: +G.time.toFixed(2) });
}

// am I at the bay (the way out): its floor, or the far stairs' lower half
export function atBay(stage, C) {
  if (stage.part('mezz').up && !(C.pos.x > 11.2 && Math.abs(C.pos.z - PIER.stairs.E.z) < 0.7)) return false;
  const onStairs = C.pos.x > 11.2 && C.pos.x < PIER.stairs.E.foot + 0.1 && Math.abs(C.pos.z - PIER.stairs.E.z) < 0.7;
  const inBay = C.pos.x > 9.9 && C.pos.z > -41.2 && C.pos.z < -29.4 && C.groundY < 0.5;
  return onStairs || inBay;
}

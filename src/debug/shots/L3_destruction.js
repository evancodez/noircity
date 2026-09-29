import * as THREE from 'three';
import { setDebugWreckKind } from '../../world/Cars.js';

// Lane 3's presets (destruction). Query strings:
//   shot=wreck&t=<s>&wreckkind=A|B|C|D   the core wreck preset, its staged
//                                        blast forced to a kind (the param is
//                                        read here, at load: Shots.js is frozen)
//   shot=wreckstudy                      the four wrecks side on under the lamp,
//                                        no fire: the silhouette alone (D, on its
//                                        side, turned 35 deg: its underside and
//                                        rims toward us)
//   shot=wreckstudy&wk=A|B|C|D           one of them, 8 m away
const Q = () => new URLSearchParams(location.search);
setDebugWreckKind(Q().get('wreckkind'));

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// wreckstudy: the parked cars cleared away, the wrecks in a row across the
// avenue by the lamp at z = -17.5, seen side on against the lit mist down
// the avenue
function stageWreckStudy(world, camera, controller, game) {
  const cars = world.cars;
  for (const c of cars.cars) c.group.visible = false;
  const one = Q().get('wk');
  const kinds = one ? [one] : ['A', 'B', 'C', 'D'];
  const step = 5.3;
  kinds.forEach((k, i) => {
    const x = 0.4 + (i - (kinds.length - 1) / 2) * step;
    const car = cars.spawn({ pos: V(x, 0, -19.5), yaw: k === 'D' ? 0.6 : 0.0, lights: false, paint: 'paint' });
    cars.cars.push(car);
    // (D rolls onto its near side: its underside, axles and rims face us)
    cars.wreckNow(car, k, { fire: Q().get('fire') === '1', rollSgn: 1 });
  });
}

// glassstudy2: the diner's plate glass (bay B2, 3.55 x 2.5 m) seen from the
// kerb, shot `hits` times at seeded points in the last 2 s (1: a star; 4:
// stars and the first pieces out; 12: most of it gone; all: shattered by the
// rounds, the shards falling, then lying on the pavement at t + 3)
//   shot=glassstudy2&hits=1|4|12|all   (&age=<s>: seconds since the last round)
function stageGlassStudy(world, camera, controller, game) {
  const T = tEnd(presets.glassstudy2);
  const pane = world.part('dinerFront').panes.B2;
  const hq = Q().get('hits') || '4';
  const age = parseFloat(Q().get('age') ?? (hq === 'all' ? '0.45' : '0.4'));
  // (all: three rounds, then it goes at the frame's age - glass.shatter, as
  // the round that takes it past its count would)
  const n = hq === 'all' ? 3 : Math.max(1, parseInt(hq, 10) || 1);
  const pts = [];
  // (seeded points: a golden-ratio scatter over the pane, the first near the
  // middle; the eye fires them)
  for (let k = 0; k < n; k++) {
    const u = ((0.5 + k * 0.618034) % 1) - 0.5, v = ((0.37 + k * 0.414214) % 1) - 0.5;
    pts.push(new THREE.Vector3(pane.c.x, pane.c.y + v * pane.h * 0.8, pane.c.z + u * pane.w * 0.85));
  }
  const t1 = T - age - (hq === 'all' ? 0.3 : 0), t0 = Math.max(0.2, t1 - (hq === 'all' ? 0.6 : 1.6));
  let k = 0, gone = false;
  game.scripts.push((t) => {
    if (hq === 'all' && !gone && t >= T - age - 1e-6) {
      gone = true;
      const dir = pane.c.clone().sub(camera.position).normalize();
      game.glass.shatter(pane, { dir, power: 1, by: 'bullet', at: pts[0] });
    }
    while (k < pts.length && t >= t0 + (t1 - t0) * (pts.length > 1 ? k / (pts.length - 1) : 1) - 1e-6) {
      if (pane.state === 'gone') { k = pts.length; break; }
      const eye = camera.position.clone();
      const dir = pts[k].clone().sub(eye).normalize();
      const hit = game.rays.raycast(eye, dir, 30);
      if (hit) game.react.bullet(hit, dir);
      k++;
    }
  });
}

// windowman: the diner's end bay (B4) bursting outwards at the moment the
// brawler goes through it (glass.shatter with a man-sized hole round him),
// seen from the pavement; &age=<s> after the burst (default 0.12)
function stageWindowMan(world, camera, controller, game) {
  const T = tEnd(presets.windowman);
  const pane = world.part('dinerFront').panes.B4;
  const age = parseFloat(Q().get('age') ?? '0.12');
  const at = new THREE.Vector3(pane.c.x, 1.55, pane.c.z + 0.2);
  let mack = null;
  try {
    mack = game.cast && game.cast.spawn('brawler', { at: { x: -10.9, z: at.z }, yaw: -Math.PI / 2 });
  } catch (e) { mack = null; }
  let done = false;
  game.scripts.push((t) => {
    if (mack && mack.object) {
      // (he goes through backwards: a stand-in slide along +x)
      const u = Math.max(0, Math.min(1, (t - (T - age - 0.25)) / 0.6));
      mack.object.position.x = -10.9 + u * 1.9;
    }
    if (!done && t >= T - age - 1e-6) {
      done = true;
      game.glass.shatter(pane, { dir: new THREE.Vector3(1, 0.05, 0.1).normalize(), power: 1.6, at, by: 'body' });
      try { mack && mack.ko && mack.ko('deathBack'); } catch (e) { /* the stub cast */ }
    }
  });
}

const tEnd = (shot) => { const t = parseFloat(Q().get('t') ?? ''); return Number.isFinite(t) ? t : shot.t; };

export const presets = {
  // (on the road by the kerb, square to bay B2, eye 1.65 over the street)
  glassstudy2: { x: -6.0, z: 5.0, y: 0.15, yaw: Math.PI / 2, pitch: 0.08, fov: 58, t: 4, stage: stageGlassStudy },
  windowman: { x: -6.2, z: -8.6 + 1.3, y: 0.15, yaw: 2.55, pitch: 0.0, fov: 62, t: 4, stage: stageWindowMan },
  wreckstudy: { x: 0.4, z: -9.0, y: 0.0, yaw: 0, pitch: -0.02, fov: 70, t: 2, stage: stageWreckStudy },
};
// (one wreck: 8 m from its side)
if (Q().get('wk')) Object.assign(presets.wreckstudy, { z: -11.5, fov: 55 });

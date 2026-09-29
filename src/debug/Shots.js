import * as THREE from 'three';

// Camera presets for ?shot=<name>. Each: feet position (x, z), yaw, pitch
// (radians), vertical fov, default fast-forward seconds, optional stage(world).
export const SHOTS = {
  // Reference composition: low on the road by the left kerb, eye ~1.7 m,
  // looking down the avenue. The vanishing point sits ~45 % across and ~55 %
  // down; the el (now set back ~13 m to the right) fills the top-right third
  // with its deck top and open railing inside the frame and sky between the
  // members; the near lamp stands left of the towers that back the VP.
  street: { x: -3.8, z: -9.0, y: 0.07, yaw: -0.105, pitch: 0.075, fov: 70, t: 4 },
  // Standing in the cone of the lamp by the phone booth, looking up at it.
  lamp: { x: -3.4, z: -12.8, yaw: 0.3, pitch: 0.28, fov: 66, t: 4 },
  // Two black sedans, the nearer ~7 m away (Phase 1b review, pending AD
  // sign-off): the camera moved 1.5 m toward -x and turned 0.1 rad down the
  // avenue (pitch -0.07, fov 58) so the skyline runs unbroken across the
  // left half behind the cars and the el enters from the top right instead
  // of arching over the whole frame. (Any closer to the near car and its
  // column pair's portal arch fills the top of the frame again.)
  // Phase 1c: x +0.4, yaw -0.05 so the el column clears the near sedan's rear.
  cars: { x: 2.2, z: -13.6, yaw: -0.45, pitch: -0.07, fov: 58, t: 4 },
  // the Phase 1 framing, kept for the AD comparison
  cars_v1: { x: 3.3, z: -13.8, yaw: -0.5, pitch: -0.1, fov: 62, t: 4 },
  // inspection views (not part of the reference set)
  carside: { x: 1.4, z: -57.5, yaw: Math.PI / 2, pitch: -0.12, fov: 50, t: 4 },
  car34: { x: 0.5, z: -63.5, yaw: 2.525, pitch: -0.13, fov: 50, t: 4 },
};

// ---- Phase 2a: the Hood ------------------------------------------------------
const D2R = Math.PI / 180;
// hoodstudy: five Hoods in a row 4 m from the camera under the lamp at
// z = -17.5, turned 0/45/90/135/180 deg from facing the camera, in states
// idle / walk / aim / flinch / deathBack. t= scrubs their clock: the walker
// crosses its mark at t = 4.45, the flinches hit at 3.85 and 4.45, the death
// starts at 3.9 (so t = 4.0, 4.3, 4.6, 4.9 show impact, stagger, fall, ground).
function stageHoodStudy(world, camera) {
  const H = world.hoods;
  // an arc 4 m from the eye (x -2.2, z -13.3), 17 deg apart; each yaw is
  // relative to facing the camera (0 = looking straight at it)
  const cx = -2.2, cz = -13.3, R = 4;
  const at = (k) => {
    const a = (k - 2) * 17 * D2R;
    const x = cx + R * Math.sin(a), z = cz - R * Math.cos(a);
    return { x, z, face: Math.atan2(cx - x, cz - z) };
  };
  const P = [0, 1, 2, 3, 4].map(at);
  const yaws = [0, 45, 90, 135, 180].map((a, k) => P[k].face + a * D2R);
  // idle
  H.spawn([P[0].x, P[0].z], { coat: 1, brim: 1, tall: 1, cig: true }, { yaw: yaws[0], state: 'idle' });
  // walk: along its facing, crossing its mark at t = 4.45
  const w = H.spawn([P[1].x, P[1].z], { coat: 0, brim: 0, tall: 0 }, { yaw: yaws[1] });
  w.speed = 1.0;
  w.setState('walk', 0);
  const dir = [Math.sin(yaws[1]), Math.cos(yaws[1])];
  w.script = (h, t) => { if (t === 0) return; h.pos.x = P[1].x + dir[0] * (t - 4.45) * h.speed; h.pos.z = P[1].z + dir[1] * (t - 4.45) * h.speed; };
  w.script(w, 1e-6);
  // aim (profile), at a target ahead of him at eye height
  const a = H.spawn([P[2].x, P[2].z], { coat: 2, brim: 1, tall: 1 }, { yaw: yaws[2], state: 'aim' });
  a.lookAt(new THREE.Vector3(P[2].x + Math.sin(yaws[2]) * 8, 1.55, P[2].z + Math.cos(yaws[2]) * 8));
  // flinch: idle, hit repeatedly from his left
  const f = H.spawn([P[3].x, P[3].z], { coat: 1, brim: 0, tall: 1, cig: false }, { yaw: yaws[3], state: 'idle' });
  let nextHit = 0;
  const hits = [2.2, 3.85, 4.45, 5.3, 6.4];
  f.script = (h, t) => { while (nextHit < hits.length && t >= hits[nextHit]) { h.flinch(); nextHit++; } };
  // deathBack at t = 3.9
  const d = H.spawn([P[4].x, P[4].z], { coat: 0, brim: 1, tall: 1 }, { yaw: yaws[4], state: 'idle' });
  d.script = (h, t) => { if (h.alive && t >= 3.9) h.die('deathBack'); };
}

// hood: one Hood 5 m away aiming at the camera, one walking across at 25 m
function stageHood(world, camera) {
  const H = world.hoods;
  const cam = camera.position;
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).setY(0).normalize();
  const side = new THREE.Vector3(-fwd.z, 0, fwd.x);   // screen right
  const p1 = cam.clone().addScaledVector(fwd, 5).addScaledVector(side, -0.5);
  const a = H.spawn([p1.x, p1.z], { coat: 1, brim: 1, tall: 1, cig: true }, { yaw: Math.atan2(cam.x - p1.x, cam.z - p1.z), state: 'aim' });
  a.lookAt(cam.clone());
  const p2 = cam.clone().addScaledVector(fwd, 25).addScaledVector(side, 2.6);
  const w = H.spawn([p2.x, p2.z], { coat: 0, brim: 0, tall: 0 }, { yaw: Math.PI / 2 });
  w.speed = 1.0;
  w.setState('walk', 0);
  const x2 = p2.x;
  w.script = (h, t) => { if (t > 0) h.pos.x = x2 + (t - 4) * h.speed; };
  w.script(w, 1e-6);
}

// hoodwalk (inspection): a walker in profile 4 m away and a runner at 7 m,
// both crossing the frame; t= scrubs the gait
function stageHoodWalk(world) {
  const H = world.hoods;
  const w = H.spawn([-4, -17.3], { coat: 0, brim: 1, tall: 1 }, { yaw: Math.PI / 2 });
  w.speed = 1.0; w.setState('walk', 0);
  w.script = (h, t) => { if (t > 0) h.pos.x = -2.2 + (t - 4.45) * h.speed; };
  w.script(w, 1e-6);
  const r = H.spawn([0, -20.3], { coat: 1, brim: 0, tall: 0 }, { yaw: -Math.PI / 2 });
  r.speed = 2.9; r.setState('run', 0);
  r.script = (h, t) => { if (t > 0) h.pos.x = -1.0 - (t - 4.45) * h.speed; };
  r.script(r, 1e-6);
}
// hooddeath (inspection): deathBack / deathKnees / deathSpin side by side,
// turned toward screen-left in 3/4 like the reference's centre man, all
// shot at t = 3.9
function stageHoodDeath(world) {
  const H = world.hoods;
  const kinds = ['deathBack', 'deathKnees', 'deathSpin'];
  kinds.forEach((k, i) => {
    const h = H.spawn([-4.6 + i * 2.4, -17.6], { coat: i % 3, brim: 1 - (i % 2), tall: 1 }, { yaw: -60 * D2R, state: 'aim' });
    h.lookAt(new THREE.Vector3(-12, 1.5, -13));
    h.script = (hh, t) => { if (hh.alive && t >= 3.9) hh.die(k); };
  });
}
// hoodlab (inspection): one Hood in the middle of the study row under the
// lamp. URL: hs=<state|deathBack|deathKnees|deathSpin|flinch> (default idle),
// hy=<yaw deg, 0 = facing the camera>, hv=<coat,brim> ; the death / first
// flinch starts at t = 3.9. Combine with focus= for close-ups.
function stageHoodLab(world) {
  const H = world.hoods;
  const q = new URLSearchParams(location.search);
  const st = q.get('hs') || 'idle';
  const yaw = parseFloat(q.get('hy') || '0') * D2R;
  const [coat = 0, brim = 1, heavy = 0] = (q.get('hv') || '0,1').split(',').map(Number);
  const death = st.startsWith('death');
  const base = death || st === 'flinch' ? 'idle' : st;
  const h = H.spawn([-2.2, -17.3], { coat, brim, tall: 1, heavy: !!heavy }, { yaw, state: base });
  if (base === 'aim') h.lookAt(new THREE.Vector3(-2.2 + Math.sin(yaw) * 8, 1.55, -17.3 + Math.cos(yaw) * 8));
  if (base === 'walk' || base === 'run') { h.speed = base === 'walk' ? 1.0 : 2.9; h.script = (hh, t) => { if (t > 0) { hh.pos.x = -2.2 + Math.sin(yaw) * (t - 4.45) * hh.speed; hh.pos.z = -17.3 + Math.cos(yaw) * (t - 4.45) * hh.speed; } }; h.script(h, 1e-6); }
  if (death) h.script = (hh, t) => { if (hh.alive && t >= 3.9) hh.die(st); };
  if (st === 'flinch') { const hits = [3.9, 5.2]; let k = 0; h.script = (hh, t) => { while (k < hits.length && t >= hits[k]) { hh.flinch(); k++; } }; }
}
SHOTS.hoodlab = { x: -2.2, z: -13.3, y: -0.03, yaw: 0, pitch: -0.12, fov: 50, t: 4.3, stage: stageHoodLab };
SHOTS.hooddeath = { x: -2.2, z: -12.2, y: -0.03, yaw: 0, pitch: -0.12, fov: 58, t: 4.3, stage: stageHoodDeath };
SHOTS.hoodwalk = { x: -2.2, z: -13.3, y: -0.03, yaw: 0, pitch: -0.1, fov: 50, t: 4.45, stage: stageHoodWalk };
SHOTS.hoodstudy = { x: -2.2, z: -13.3, y: -0.03, yaw: 0, pitch: -0.12, fov: 60, t: 4.3, stage: stageHoodStudy };
SHOTS.hood = { ...SHOTS.street, t: 4, stage: stageHood };

// ---- Phase 2b: combat ---------------------------------------------------------
const Q = () => new URLSearchParams(location.search);
const tEndOf = (shot) => { const t = parseFloat(Q().get('t') ?? ''); return Number.isFinite(t) ? t : shot.t; };
const STEP = 1 / 60;

// battle: the REAL game loop - waves on (from wave=<n>, default 5), a
// deterministic seed, and the autopilot player (game/Autopilot.js) strafing
// by the left kerb in the street composition. t= fast-forwards the fight.
// (wave 5 by default: eleven Hoods including two Tommy-gun heavies, so
// the fight is still on at t=60)
// The wave starts 13 s before the clock (game.warmup, run by main.js before
// the t= fast-forward, the player holding fire): the Hoods come out of the
// fog at 40-60 m and walk in, so that t=6 already opens on the firefight.
function stageBattle(world, camera, controller, game, defWave = 5) {
  const w = parseInt(Q().get('wave') ?? String(defWave), 10) || defWave;
  game.startBattle({ wave: w, autopilot: false });
  game.warmup = parseFloat(Q().get('warmup') ?? '13');
  game.afterWarmup = () => game.enableAutopilot();
  // Phase 3a: the whole living block runs (train, lightning), seeded
  game.ambient = true;
}

// train: the el train mid-crossing over the street view, window light
// strobing onto the street below. trainz=<z> / trainahead=<m> / traindir=<1|-1>
function stageTrain(world, camera, controller, game) {
  const T = tEndOf(SHOTS.train);
  const z = parseFloat(Q().get('trainz') ?? '-40'), ahead = parseFloat(Q().get('trainahead') ?? '30');
  const dir = parseInt(Q().get('traindir') ?? '1', 10) || 1;
  // start it so that at t = T its lead car is `ahead` m past z
  const tr = world.train;
  tr.stage(z, ahead - dir * 15 * T * 0 - 15 * T, dir);
}
SHOTS.train = { ...SHOTS.street, t: 3, stage: stageTrain };

// hoods: the staged reference firefight (brief §2a / PHASE2B_NOTES): four
// Hoods at 8-30 m in the street composition (el top right, lamp left).
//   centre, ~12 m : being shot - deathBack starts 0.4 s before the frame,
//                   blood bursting off his chest (the reference's centre man)
//   right, ~14 m  : aiming and firing over the car's hood, flash held
//   right, ~22 m  : aiming from beside an el column
//   centre, ~30 m : walking in out of the mist
// The Tommy gun fires the killing burst (its flash held in frame too).
function stageHoods(world, camera, controller, game) {
  const T = tEndOf(SHOTS.hoods);
  const cam = camera.position.clone();
  const nav = game.nav;
  const at = (x, z) => { const k = nav.nearestFree(x, z, 3); const c = nav.center(k); return [c.x, c.z]; };
  const face = (x, z) => Math.atan2(cam.x - x, cam.z - z);
  const eye = cam.clone();
  // A: the man being shot, ~9 m, under the lamp left of the gun's flash
  // (Phase 3a preamble: 1.85 m left and 3.2 m deeper than 2b, so the
  // player's flash sits ~60 px clear of his red burst at 1600x1000, both
  // inside the lamp cone; the nav grid snaps him to x -5.65, z -17.98)
  const [ax, az] = at(+(Q().get('ax') ?? -5.6), +(Q().get('az') ?? -18.1));
  const A = game.spawnHood(ax, az, { ai: false, variant: { coat: 0, brim: 1, tall: 1 }, yaw: face(ax, az) + 0.55, state: 'aim' });
  A.lookAt(eye);
  // B: the shooter behind the car on the right, firing over its hood
  // (behind the hood, not the cabin: his chest clears the bonnet)
  const [bx, bz] = at(6.06, -20.98);
  const B = game.spawnHood(bx, bz, { ai: false, variant: { coat: 1, brim: 1, tall: 1, cig: true }, yaw: face(bx, bz), state: 'aim' });
  B.lookAt(eye);
  // C: aiming from beside an el column further back
  const [cx, cz] = at(8.3, -33);
  const C = game.spawnHood(cx, cz, { ai: false, variant: { coat: 2, brim: 0, tall: 0 }, yaw: face(cx, cz), state: 'aim' });
  C.lookAt(eye);
  // D: walking in out of the lit mist down the left of the avenue, ~30 m
  // (clear of the dying man's silhouette: Phase 3a preamble #1)
  const [dx, dz] = at(+(Q().get('dx') ?? -7.0), +(Q().get('dz') ?? -37));
  const D = game.spawnHood(dx, dz, { ai: false, variant: { coat: 1, brim: 0, tall: 1 }, yaw: face(dx, dz) - 0.7 });
  D.speed = 1.1;
  D.setState('walk', 0);
  const dir = [Math.sin(D.yaw), Math.cos(D.yaw)];
  D.script = (h, t) => { if (t > 0) { h.pos.x = dx + dir[0] * (t - T) * h.speed; h.pos.z = dz + dir[1] * (t - T) * h.speed; } };
  D.script(D, 1e-6);
  // the scripted fire: B and C shoot at the player, the Tommy gun cuts A down
  const chest = (h) => new THREE.Vector3().setFromMatrixPosition(h.bones.chest.matrixWorld);
  const events = [
    [T - 1.2, () => game.stagedHoodFire(C, T - 1.2)],
    [T - 0.75, () => game.stagedHoodFire(B, T - 0.75)],
    [T - 0.58, () => game.scriptedShot(chest(A).add(new THREE.Vector3(0.12, -0.25, 0)), T - 0.58)],
    [T - 0.49, () => game.scriptedShot(chest(A).add(new THREE.Vector3(-0.05, 0.02, 0)), T - 0.49)],
    [T - 0.4, () => { game.scriptedShot(chest(A).add(new THREE.Vector3(0.02, 0.1, 0)), T - 0.4); if (A.alive) game.killHood(A, new THREE.Vector3().subVectors(chest(A), eye).normalize(), false, 'deathBack'); }],
    [T - 0.34, () => game.stagedHoodFire(C, T - 0.34)],
    [T - 0.05, () => game.stagedHoodFire(B, T - 0.05)],
  ];
  let k = 0;
  game.scripts.push((t) => { while (k < events.length && t >= events[k][0] - 1e-6) events[k++][1](); });
}

// viewmodel: the street composition with the Tommy gun in frame and a muzzle
// flash 0.03 s old (its second frame) - fired two steps before the frame
// vmpuff=<s> (Phase 3b): instead, a 4-round burst whose muzzle smoke (it
// hangs 0.13 s after the last round) is <s> old at the frame
function stageViewmodel(world, camera, controller, game) {
  const T = tEndOf(SHOTS.viewmodel);
  const aim = new THREE.Vector3(0, 0, -30).applyMatrix4(camera.matrixWorld);
  const puff = parseFloat(Q().get('vmpuff') ?? '');
  if (Number.isFinite(puff)) {
    // (the burst is fired a few degrees down: the frame tips with it, so the
    // muzzle and its smoke sit against the dark road below the cars, not in
    // the lit mist)
    controller.pitch -= parseFloat(Q().get('vmpitch') ?? '0.08');
    controller.apply(0);
    camera.updateMatrixWorld();
    const aimDown = new THREE.Vector3(0, 0, -30).applyMatrix4(camera.matrixWorld);
    aim.copy(aimDown);
    const t1 = Math.round((T - puff - 0.14) * 60) / 60;
    const t0 = t1 - 3 / 11;
    let k = 0;
    game.scripts.push((t) => { while (k < 4 && t >= t0 + k / 11 - 1e-6) { game.scriptedShot(aim, t); k++; } });
    return;
  }
  const t0 = Math.round(T * 60) / 60 - 2 * STEP;
  let done = false;
  game.scripts.push((t) => { if (!done && t >= t0 - 1e-6) { done = true; game.scriptedShot(aim, t); } });
}

// viewmodel reload: vmreload=<s into the 2.3 s reload> (default 0.85: the
// drum is off and hanging below the gun)
function stageReload(world, camera, controller, game) {
  const T = tEndOf(SHOTS.reload);
  const at = parseFloat(Q().get('vmreload') ?? '0.85');
  let done = false;
  game.weapon.ammo = 3;
  game.scripts.push((t) => { if (!done && t >= T - at - 1e-6) { done = true; game.weapon.reload(); } });
}

// impacts: the Tommy gun rakes the façade (stone), the near car's body
// (sparks), an el column (iron) and the wet street (splash + ring) in the
// last half second, so one frame shows every surface's reaction
function stageImpacts(world, camera, controller, game) {
  const T = tEndOf(SHOTS.impacts);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const targets = [V(-10.1, 2.4, -19), V(-10.1, 1.6, -21.5), V(-4.3, 1.0, -24.2), V(-3.6, 0.9, -25.2), V(12.5, 3, -27), V(-1.5, 0, -15), V(0.5, 0, -17)];
  let k = 0;
  const t0 = T - 0.5;
  game.scripts.push((t) => {
    while (k < targets.length && t >= t0 + k * 0.07 - 1e-6) game.scriptedShot(targets[k++], t);
  });
}

// muzzlesmoke (look development, Phase 3a preamble #5): a 5-round burst
// that ends `smokeage` s before the frame (default 0.35)
function stageMuzzleSmoke(world, camera, controller, game) {
  const T = tEndOf(SHOTS.muzzlesmoke);
  const age = parseFloat(Q().get('smokeage') ?? '0.35');
  const aim = new THREE.Vector3(0, 0, -30).applyMatrix4(camera.matrixWorld);
  const t0 = T - age - 0.13 - 4 / 11;
  let k = 0;
  game.scripts.push((t) => { while (k < 5 && t >= t0 + k / 11 - 1e-6) { game.scriptedShot(aim, t); k++; } });
}
SHOTS.muzzlesmoke = { ...SHOTS.street, t: 4, viewmodel: true, holdWindow: 0, stage: stageMuzzleSmoke };
SHOTS.reload = { ...SHOTS.street, t: 4, viewmodel: true, holdWindow: 0, stage: stageReload };
SHOTS.impacts = { ...SHOTS.street, t: 4, viewmodel: true, holdWindow: 0.1, stage: stageImpacts };
SHOTS.battle = { ...SHOTS.street, t: 30, viewmodel: true, holdWindow: 0.35, stage: stageBattle };
SHOTS.hoods = { ...SHOTS.street, t: 4, viewmodel: true, holdWindow: 0.6, stage: stageHoods };
SHOTS.viewmodel = { ...SHOTS.street, t: 4, viewmodel: true, holdWindow: 0, stage: stageViewmodel };

// ---- Phase 3a: the reactive world ---------------------------------------------
// wreck: the black sedan down the middle of the avenue, already shot to its
// warning smoke at t = 0 (a cracked windscreen, a shattered side window, a
// flat front tyre, bullet marks), a Hood crouched by its trunk. It explodes
// at t = 3.0 (fuse), so t = 2.9 smoke, 3.1 fireball, 3.4 chunks in the air,
// 8 the burning wreck with its warm column in the wet street, 40 still
// burning, ~95 embers. wreckcar=<i> picks another car.
function stageWreck(world, camera, controller, game) {
  const cars = world.cars;
  const car = cars.cars[parseInt(Q().get('wreckcar') ?? '2', 10) || 0];
  const fuse = parseFloat(Q().get('fuse') ?? '3');
  const eye = camera.position.clone();
  const L = (x, y, z) => cars.toWorld(car, new THREE.Vector3(x, y, z));
  // the rounds that did it (straight into the car, no muzzle flash in frame)
  const shots = [L(-1.37, 1.47, 0.12), L(-0.8, 1.4, 0.64), L(-0.8, 1.36, 0.64), L(0.15, 1.4, 0.64), L(-1.55, 0.3, 0.9), L(-1.9, 0.8, 0.7), L(-1.2, 0.75, 0.72), L(0.2, 0.7, 0.72), L(-2.3, 0.9, 0.3), L(-2.2, 1.0, -0.4)];
  for (const p of shots) {
    const dir = p.clone().sub(eye).normalize();
    const hit = game.rays.raycast(eye, dir, 80);
    if (hit) game.react.bullet(hit, dir);
  }
  game.fx.impacts.count = 0;
  cars.startSmoke(car, fuse);
  car.smokeT = 6;    // (thick: it has been smoking a while)
  // a Hood by its trunk, in the blast
  const hp = L(-3.1, 0, 1.35);
  const h = game.spawnHood(hp.x, hp.z, { ai: false, variant: { coat: 1, brim: 1, tall: 1 }, state: 'aim' });
  h.yaw = Math.atan2(eye.x - hp.x, eye.z - hp.z) + 0.4;
  h.lookAt(eye);
  // and one further off, who takes the blast standing
  const hp2 = L(-5.5, 0, -4.8);
  const h2 = game.spawnHood(hp2.x, hp2.z, { ai: false, variant: { coat: 0, brim: 0, tall: 0 }, state: 'idle' });
  h2.yaw = Math.atan2(eye.x - hp2.x, eye.z - hp2.z) - 0.6;
}
SHOTS.wreck = { x: -2.2, z: -13.0, y: 0.0, yaw: 0.06, pitch: 0.06, fov: 58, t: 8, stage: stageWreck };

// a round into `target` from `from` (default: 3 m in front of it toward
// the street), dispatched through the reactive world like a real bullet
function shootAt(game, target, from = null) {
  const o = from || target.clone().add(new THREE.Vector3(3, 0.3, 0.6));
  const dir = target.clone().sub(o).normalize();
  const hit = game.rays.raycast(o, dir, 20);
  if (hit) game.react.bullet(hit, dir);
  return hit;
}

// havoc (look development, Phase 3a): the left side of the block takes a
// few rounds - the near street lamp is shot out, two façade windows (one
// lit) and the phone booth's glass shatter, the hydrant bursts, a trash can
// tumbles, a grate coughs steam, a hanging lamp swings and dies
function stageHavoc(world, camera, controller, game) {
  const T = tEndOf(SHOTS.havoc);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const lamp = world.lamps.lamps.find((l) => !l.hanging && !l.sconce && Math.abs(l.head.z + 17.5) < 0.5);
  const hang = world.lamps.lamps.find((l) => l.hanging && l.real && l.head.z < -20 && l.head.z > -40);
  const lit = world.facade.windows.find((w) => w.kind === 'dim' && w.c.z < -2 && w.c.z > -20);
  const events = [
    [T - 3.4, () => lamp && shootAt(game, lamp.head.clone().add(V(0, 0.2, 0)), lamp.head.clone().add(V(3, -2, 1)))],
    [T - 3.0, () => lit && (shootAt(game, lit.c.clone().add(V(0, 0.3, 0.4))), shootAt(game, lit.c.clone().add(V(0, -0.4, 0.35))))],
    [T - 2.8, () => { shootAt(game, V(-10.19, 2.4, -17.3)); }],
    [T - 2.6, () => { for (const dz of [0.25, 0.3]) shootAt(game, V(-8.43, 1.5, -27.2 + dz), V(-6.2, 1.6, -25 + dz)); for (const dx of [0.25, 0.28]) shootAt(game, V(-8.9 + dx, 1.4, -26.73), V(-6.2 + dx, 1.5, -21)); }],
    [T - 2.3, () => { shootAt(game, V(-6.55, 0.62, -27.5), V(-6.0, 1.0, -31)); shootAt(game, V(-6.55, 0.5, -27.5), V(-6.0, 1.0, -31)); }],
    [T - 2.0, () => { for (let k = 0; k < 3; k++) shootAt(game, V(-9.5, 0.7, -66), V(-5, 1.2, -60)); }],
    [T - 1.6, () => { shootAt(game, V(-1.4, 0.05, -21.5), V(-1, 1.7, -15)); }],
    [T - 1.2, () => hang && (shootAt(game, hang.head.clone().add(V(0, 0.25, 0)), hang.head.clone().add(V(-4, -3, 3))), shootAt(game, hang.head.clone().add(V(0, 0.25, 0)), hang.head.clone().add(V(-4, -3, 3))))],
  ];
  let k = 0;
  game.scripts.push((t) => { while (k < events.length && t >= events[k][0] - 1e-6) events[k++][1](); });
}
SHOTS.havoc = { ...SHOTS.street, t: 4, stage: stageHavoc };

// storm: a lightning strike `strikeage` s before the frame (default 0: its
// first frame, the tone kick held); strikeage=0.05 the flash after the kick,
// 0.2 the dip of the double flicker
function stageStorm(world, camera, controller, game) {
  const T = tEndOf(SHOTS.storm);
  const age = parseFloat(Q().get('strikeage') ?? '0');
  let done = false;
  const t0 = Math.round((T - age) * 60) / 60 - 1 / 60;
  game.scripts.push((t) => { if (!done && t >= t0 - 1e-6) { done = true; game.storm.strike(1, false); } });
  if (age < 1 / 60) game.pipeline.kickHold = true;
}
SHOTS.storm = { ...SHOTS.street, t: 4, stage: stageStorm };

// ---- Phase 3b ------------------------------------------------------------------
// perf: the performance scenario (tools/fps.mjs "shot=perf&t=1&anim=1"): the
// battle (wave 6: twelve Hoods alive at once, heavies among them, the
// autopilot fighting), plus the car down the middle of the avenue blown up
// during the warm-up so it burns through the measurement, the train kept
// crossing the el, and a lightning strike every ~2.5 s
// (seeded, Phase 3b review: the Hoods are held on their feet - a hit
// bleeds and flinches, nobody falls, no blast kills - and the autopilot
// holds his mark while he aims and fires, so the Hood count, the fire and
// the view, hence tris / calls, repeat from run to run; perfseed=0 lets
// the fight run free as before)
function stagePerf(world, camera, controller, game) {
  stageBattle(world, camera, controller, game, 6);
  if (Q().get('perfseed') !== '0') {
    game.hoodsHold = true;
    game.afterWarmup = () => { game.enableAutopilot(); game.autopilot.hold = true; };
  }
  const cars = world.cars;
  cars.startSmoke(cars.cars[2], 0.5, { force: true });
  const tr = world.train;
  let strikeT = 0, staged = false;
  game.scripts.push((t, dt) => {
    // (after the warm-up: the train comes in from behind the eye, so it runs
    // over the view through the measurement; then it keeps crossing)
    if (t < game.warmup - 0.5) return;
    if (!staged || !tr.active) { staged = true; tr.stage(20, 0, 1); }
    strikeT -= dt;
    if (strikeT <= 0) { strikeT = 2.5; game.storm.strike(1, false); }
  });
}
SHOTS.perf = { ...SHOTS.street, t: 1, viewmodel: true, holdWindow: 0, stage: stagePerf };

// title: the title card over the live street - the drifting title camera
// (Game.titleDrift) at t=, the rain falling, no gun in frame
function stageTitle(world, camera, controller, game) {
  game.state = 'title';
  game.setViewmodelVisible(false);
  game.hud.showTitle();
  game.titleDrift(0);
}
SHOTS.title = { ...SHOTS.street, t: 6, viewmodel: false, stage: stageTitle };

// end: THE END over the battle (the battle preset, wave 5, the autopilot)
// at t= (default 60): kills and waves from the fight, a seeded epitaph
// (epitaph=<i> picks one)
function stageEnd(world, camera, controller, game) {
  stageBattle(world, camera, controller, game);
  const T = tEndOf(SHOTS.end);
  const pick = parseInt(Q().get('epitaph') ?? '', 10);
  game.hud.epiRng = { next: () => (Number.isFinite(pick) ? (pick + 0.5) / 12 : 0.37) };
  let done = false;
  // (0.6 s before the frame: the dead man's Tommy gun has dropped out of it)
  game.scripts.push((t) => { if (!done && t >= game.warmup + T - 0.6 - 1e-6) { done = true; game.endGame(); } });
}
SHOTS.end = { ...SHOTS.street, t: 60, viewmodel: true, holdWindow: 0.35, stage: stageEnd };

const ALIASES = { default: 'street' };

export function getShot(name) {
  const key = SHOTS[name] ? name : ALIASES[name];
  return key ? { name: key, ...SHOTS[key] } : null;
}

export function applyShot(shot, controller, camera, world, game) {
  camera.fov = shot.fov;
  camera.updateProjectionMatrix();
  // optional y: ground height under the eye (raises the camera for a shot)
  controller.setPose(shot.x, shot.z, shot.yaw, shot.pitch, shot.y ?? null);
  camera.updateMatrixWorld();
  if (shot.stage) shot.stage(world, camera, controller, game);
}

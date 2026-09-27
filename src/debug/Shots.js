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
  const [coat = 0, brim = 1] = (q.get('hv') || '0,1').split(',').map(Number);
  const death = st.startsWith('death');
  const base = death || st === 'flinch' ? 'idle' : st;
  const h = H.spawn([-2.2, -17.3], { coat, brim, tall: 1 }, { yaw, state: base });
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

// Phase 2b/3 will replace these with staged scenes.
const ALIASES = { hoods: 'hood', wreck: 'street', ots: 'street', default: 'street' };

export function getShot(name) {
  const key = SHOTS[name] ? name : ALIASES[name];
  return key ? { name: key, ...SHOTS[key] } : null;
}

export function applyShot(shot, controller, camera, world) {
  camera.fov = shot.fov;
  camera.updateProjectionMatrix();
  // optional y: ground height under the eye (raises the camera for a shot)
  controller.setPose(shot.x, shot.z, shot.yaw, shot.pitch, shot.y ?? null);
  if (shot.stage) shot.stage(world, camera, controller);
}

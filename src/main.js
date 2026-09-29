// Error capture must evaluate before anything else.
import { errlog } from './debug/errlog.js';
import * as THREE from 'three';
import { installFogChunks } from './render/fog.js';
import { makeTextures } from './render/textures.js';
import { createSharedUniforms } from './render/uniforms.js';
import { Pipeline } from './render/Pipeline.js';
import { World } from './world/World.js';
import { Controller } from './player/Controller.js';
import { Hud } from './ui/Hud.js';
import { Stats } from './debug/Stats.js';
import { bench } from './debug/Bench.js';
import { GpuProf } from './debug/GpuProf.js';
import { getShot, applyShot } from './debug/Shots.js';
import { RNG } from './util/rng.js';
import { DEATH_REPORT } from './enemies/Hood.js';
import { Game } from './game/Game.js';
import { Sfx, audioTest } from './audio/Sfx.js';

// ---- URL params (DESIGN.md §9) -------------------------------------------
const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const shot = shotName ? getShot(shotName) : null;
const shotMode = !!shot;
// HUD: on in play unless hud=0; in shot mode only with hud=1
const hudOn = shotMode ? params.get('hud') === '1' : params.get('hud') !== '0';
const debug = params.get('debug') === '1';
const wavesOn = params.get('waves') === '1' || !shotMode;
const animate = params.get('anim') === '1' || !shotMode; // shots freeze after fast-forward unless anim=1
const tSkip = parseFloat(params.get('t') ?? (shot ? String(shot.t ?? 4) : '0')) || 0;
const pixelRatio = parseFloat(params.get('dpr') ?? '1') || 1;
const seed = parseInt(params.get('seed') ?? '1937', 10);

// ---- renderer --------------------------------------------------------------
installFogChunks();
const renderer = new THREE.WebGLRenderer({
  antialias: false,
  powerPreference: 'high-performance',
  stencil: false,
  preserveDrawingBuffer: shotMode,
});
// The ink pass writes display-referred values itself; nothing else ever
// renders to the canvas, so no extra output transform is wanted.
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.info.autoReset = false;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.1, 1500);
camera.rotation.order = 'YXZ';
camera.layers.enableAll();

const tex = makeTextures(1);
const U = createSharedUniforms(tex);
const rng = new RNG(seed);
const world = new World({ renderer, scene, U, tex, rng });
const pipeline = new Pipeline(renderer, tex, U, { pixelRatio, view: parseInt(params.get('view') ?? '0', 10) || 0, debugRT: params.get('rt') });
const controller = new Controller(camera, renderer.domElement, world);
controller.onStep = (x, z, v) => { world.street.addImpact(world, x, z, Math.min(1, v / 5) * 0.8); if (game) game.sfx.step(null, v > 5, true); };

// ---- HUD / title / game ------------------------------------------------------
let game = null;
// sound: procedural Web Audio (audio/Sfx.js); no AudioContext until the
// first click (the pointer-lock start), none at all in shot mode
const sfx = new Sfx({ enabled: !shotMode });
const hud = new Hud({
  brush: tex.brush.image,
  onBegin: () => { sfx.unlock(); controller.lock(); },
  onRestart: () => { sfx.unlock(); game.restart(); controller.lock(); },
  onResume: () => { sfx.unlock(); controller.lock(); },
});
// (the browser opens the audio only on a gesture: any key on the title lets
// the rain in behind it; the click that begins the game does too)
if (!shotMode) for (const ev of ['mousedown', 'keydown', 'touchstart']) addEventListener(ev, () => { sfx.unlock(); hud.soundHint(!sfx.live); }, { passive: true });
hud.soundHint(!shotMode);
hud.setVisible(hudOn);
if (shotMode) hud.hideTitle();
game = new Game({ world, camera, controller, pipeline, hud, shotMode, wavesOn, sfx });
game.bindInput(renderer.domElement);
// (play and the battle preset: every Hood variant + combat program up front)
if (!shotMode || wavesOn || shotName === 'battle' || shotName === 'end' || shotName === 'perf') game.prewarm(renderer);
document.addEventListener('pointerlockerror', () => {
  if (shotMode) return;
  if (game.state === 'title') hud.showTitle('click again to take the mouse');
  else if (game.state !== 'dead') hud.showPause('click again to take the mouse');
});
// pointer lock lost in play: the fight pauses (see the loop) under the
// dimmed pause card, the sound drops back; the click that takes the mouse
// again resumes
document.addEventListener('pointerlockchange', () => {
  if (shotMode) return;
  if (document.pointerLockElement === renderer.domElement) {
    hud.hideTitle();
    hud.hidePause();
    sfx.pauseMix(false);
    if (game.state === 'title') game.start();
  } else if (game.state === 'playing' || game.state === 'intermission') {
    hud.showPause();
    sfx.pauseMix(true);
  }
});
// the viewmodel: in play; in shot mode for the combat presets or vm=1
// vmpos=x,y,z / vmrot=pitch,yaw,roll: viewmodel composition (look development)
if (params.get('vmpos')) game.vm.base.pos.set(...params.get('vmpos').split(',').map(Number));
if (params.get('vmrot')) { const [a, b, c] = params.get('vmrot').split(',').map(Number); game.vm.base.rot.set(a, b, c, 'YXZ'); }
const vmParam = params.get('vm');
game.setViewmodelVisible(vmParam ? vmParam === '1' : (!shotMode || !!(shot && shot.viewmodel)));

function resize() {
  pipeline.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  game.vm.setAspect(camera.aspect);
}
addEventListener('resize', resize);
resize();
const stats = debug ? new Stats(renderer) : null;

// ---- start pose & fast-forward ---------------------------------------------
// pose=x,z,yaw,pitch[,fov] overrides a preset's camera (framing new shots)
const poseParam = params.get('pose');
if (shot && poseParam) {
  const [x, z, yaw, pitch, fov] = poseParam.split(',').map(Number);
  Object.assign(shot, { x, z, yaw, pitch }, fov ? { fov } : {});
}
if (shot) applyShot(shot, controller, camera, world, game);
else controller.setPose(-7.3, 6.2, -0.2, 0.02);
game.eye.copy(camera.position);
// waves=1 in shot mode: the real spawning, no autopilot
if (shotMode && wavesOn && game.counters.wave === 0) game.startBattle({ wave: parseInt(params.get('wave') ?? '1', 10) || 1, autopilot: false });

const STEP = 1 / 60;
let simTime = 0;
function simStep(dt) {
  game.pre(dt, simTime);
  world.update(dt, simTime, camera, pipeline.height);
  game.post(dt, simTime);
  simTime += dt;
}
// staged warm-up (shot=battle): simulated before the clock starts
if (game.warmup > 0) {
  game.inWarmup = true;
  for (let i = 0, n = Math.round(game.warmup * 60); i < n; i++) simStep(STEP);
  game.inWarmup = false;
  if (game.afterWarmup) game.afterWarmup();
}
const skipSteps = Math.round(tSkip * 60);
const tFF = performance.now();
for (let i = 0; i < skipSteps; i++) simStep(STEP);
if (skipSteps === 0) simStep(0);
const ffMs = performance.now() - tFF;
// hp=<n> (HUD look development): a fresh hit leaving the player at n
if (params.get('hp')) { const n = parseFloat(params.get('hp')); game.health.hp = n + 12; game.health.damage(12); game.health.update(0.12); }
// a screenshot holds the firefight's most recent muzzle flashes (their first
// frame, lights on) so the frame shows them (docs/PHASE2B_NOTES.md)
if (shotMode) game.holdFlashes(shot && shot.holdWindow);

// focus=i[,dist,bearingDeg,eyeHeight,fov]: after the fast-forward, aim the
// camera at Hood i (bearing 0 = in front of his face, 90 = his left side),
// looking at his hips bone, so close-ups track a walking or fallen man
const focusParam = params.get('focus');
if (shot && focusParam && world.hoods.list.length) {
  const [i, dist = 3, bearing = 0, eye = 1.5, fov = 32] = focusParam.split(',').map(Number);
  const h = world.hoods.list[Math.min(world.hoods.list.length - 1, i | 0)];
  const tgt = new THREE.Vector3().setFromMatrixPosition(h.bones.hips.matrixWorld);
  tgt.y = Math.max(tgt.y, 0.35) + 0.15;
  const a = h.yaw + bearing * Math.PI / 180;
  const cx = tgt.x + Math.sin(a) * dist, cz = tgt.z + Math.cos(a) * dist;
  const yaw = Math.atan2(-(tgt.x - cx), -(tgt.z - cz));
  const pitch = Math.atan2(tgt.y - eye, dist);
  camera.fov = fov;
  camera.updateProjectionMatrix();
  controller.setPose(cx, cz, yaw, pitch, eye - 1.63);
  world.update(0, simTime, camera, pipeline.height);
}

// card=pause|wave (look development): hold that card over the frame
if (params.get('card') === 'pause') hud.showPause();
if (params.get('card') === 'wave') hud.showWave(6, 13);

// gdbg=<n>: wet-street term debug (render/shaders/ground.js)
if (params.get('gdbg')) U.uGroundDebug.value = parseInt(params.get('gdbg'), 10) || 0;

// exposure=<v>: override the ink pass exposure (look development)
if (params.get('exposure')) pipeline.inkMat.uniforms.uExposure.value = parseFloat(params.get('exposure'));

// lightning=<v>: hold a constant lightning level (screenshot testing)
const lightningParam = parseFloat(params.get('lightning') ?? '');
if (lightningParam > 0) pipeline.updateLightning = () => { pipeline.lightning = lightningParam; };

// debug view cycling (F2): 0 ink, 1 tone only, 2 normals, 3 ids, 4 fog, 5 edges, 6 brush, 7 volume, 8 surfaces
addEventListener('keydown', (e) => {
  if (e.code === 'F2') { pipeline.view = (pipeline.view + 1) % 9; e.preventDefault(); }
});

// ---- loop ----------------------------------------------------------------------
let frames = 0;
let acc = 0;
const perf = { sim: 0, render: 0, steps: 0 };
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;
  const tA = performance.now();
  // in play, the fight pauses behind the "click to resume" card
  const paused = !shotMode && (game.state === 'playing' || game.state === 'intermission') && document.pointerLockElement !== renderer.domElement;
  if (animate && !paused) {
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < 6) { simStep(STEP); acc -= STEP; n++; }
    if (n === 6) acc = 0;
    perf.steps += n;
  }
  const tB = performance.now();
  renderer.info.reset();
  pipeline.rimLamps = world.rimLamps;
  camera.updateMatrixWorld();
  game.vm.sync(camera);
  pipeline.render(scene, camera, simTime);
  game.hudUpdate(dt);
  if (sfx.live) sfx.update(dt, { fires: world.cars.fires, hp: game.health.hp, dead: game.state === 'dead', listener: camera });
  const tC = performance.now();
  // CPU time per frame (debug overlay / tools/fps.mjs): simulation, render submit
  perf.sim = perf.sim * 0.95 + (tB - tA) * 0.05;
  perf.render = perf.render * 0.95 + (tC - tB) * 0.05;
  if (perf.log) perf.log.push([tB - tA, tC - tB, dt * 1000]);
  frames++;
  errlog.setFrames(frames);
  if (frames % 10 === 1) writeCounters();
  if (stats) {
    const K = game.counters;
    stats.update(`pos ${camera.position.x.toFixed(1)} ${camera.position.y.toFixed(2)} ${camera.position.z.toFixed(1)}  yaw ${controller.yaw.toFixed(2)} pitch ${controller.pitch.toFixed(2)}\nview ${pipeline.view}  tex ${tex.buildMs.toFixed(0)}ms  game ${game.initMs.toFixed(0)}ms\n`
      + `wave ${K.wave}  hoods alive ${K.alive}/${K.spawned}  kills ${K.kills}\nshots ${K.shots}  hits ${K.hits} (head ${K.headshots})  hood shots ${K.hoodShots}  hood hits ${K.hoodHits}\n`
      + `hp ${game.health.hp.toFixed(0)}  ammo ${game.weapon.ammo}  particles ${game.fx.liveParticles}  decals ${K.decals}  rays ${game.rays.stats.rays}\n`
      + `cpu sim ${perf.sim.toFixed(2)} ms  render ${perf.render.toFixed(2)} ms`);
  }
}
// counters for the headless tools (tools/counters.sh reads #counters)
const counterEl = document.createElement('div');
counterEl.id = 'counters';
counterEl.style.display = 'none';
document.body.appendChild(counterEl);
function writeCounters() {
  const K = { ...game.counters, time: +simTime.toFixed(2), hp: +game.health.hp.toFixed(1), ammo: game.weapon.ammo, state: game.state,
    particles: game.fx.liveParticles, ffMs: Math.round(ffMs), rays: game.rays.stats.rays, rayMs: +game.rays.stats.ms.toFixed(1),
    states: game.world.hoods.list.map((h) => (h.alive ? (game.ais.get(h)?.state || h.state) : 'dead')).join(',') };
  counterEl.dataset.json = JSON.stringify(K);
}
writeCounters();
requestAnimationFrame(frame);

window.__noir = {
  THREE, scene, camera, renderer, pipeline, world, controller, hud, U, tex, game,
  get counters() { return game.counters; },
  perf,
  // fast-forward the fixed-step simulation (as t= does at load)
  sim(seconds = 1) { const n = Math.round(seconds * 60); for (let i = 0; i < n; i++) simStep(STEP); writeCounters(); return { ...game.counters }; },
  params: { shotName, shotMode, hudOn, debug, wavesOn, tSkip },
  bench: (opts) => bench(renderer, pipeline, scene, camera, opts),
  // Phase 3b performance pass, in-session before/after: legacy = true puts
  // back the Phase 3a pipeline (every MSAA resolve, the depth resolve, the
  // full-detail far el / cars / Tommy guns, the ink's and the street's full
  // paths); false (the default) is the optimised one. Same image either way
  // (the LODs within a few pixels).
  perfLegacy(on = true) {
    pipeline.deferResolve = !on;
    pipeline.rtScene.resolveDepthBuffer = !!on;
    pipeline.setSceneFormat(!on);
    pipeline.inkMat.uniforms.uFast.value = on ? 0 : 1;
    U.uFast.value = on ? 0 : 1;
    world.lodOff = !!on;
    for (const h of world.hoods.list) if (h.tommy) h.tommy.geometry = !on && h.lod >= 1 ? h.tommy.userData.geoLo : h.tommy.userData.geoHi;
    world.overpass.update(camera);
    world.cars.lodUpdate(camera);
    return { legacy: !!on };
  },
  // GPU ms per pipeline stage over `seconds` of live play (timer queries)
  async gpuProfile(seconds = 4) {
    const P = pipeline.prof || (pipeline.prof = new GpuProf(renderer.getContext()));
    if (!P.ok) { pipeline.prof = null; return { error: 'EXT_disjoint_timer_query_webgl2 unavailable' }; }
    P.reset();
    await new Promise((r) => setTimeout(r, seconds * 1000));
    const out = P.report();
    pipeline.prof = null;
    return out;
  },
  lightning: (strength = 1) => pipeline.pulseLightning(simTime, strength),
  // spawnHood([x, z] | {x, z} | Vector3, variant = seed | { coat, brim, tall, cig }, { yaw, state })
  spawnHood(pos, variant = {}, opts = {}) { return world.hoods.spawn(pos, variant, opts); },
  // spawnAI(x, z, heavy): a Hood with a brain
  spawnAI(x, z, heavy = false) { return game.spawnHood(x, z, { heavy }); },
  get hoods() { return world.hoods.list; },
  deathReport: DEATH_REPORT,
  get time() { return simTime; },
  sfx,
  // render every procedural sound offline: [{ name, peak, rms, seconds }]
  audioTest,
};
window.__noirReady = true;
// legacy=1: the Phase 3a pipeline paths (performance before/after, see perfLegacy)
if (params.get('legacy') === '1') window.__noir.perfLegacy(true);

// audiotest=1: the offline audio table as JSON in #errlog's data-audio
// (tools/errors.sh prints it)
if (params.get('audiotest') === '1') {
  audioTest().then((r) => { errlog.el.dataset.audio = JSON.stringify(r); }, (e) => { errlog.el.dataset.audio = 'ERR ' + e; });
}

// probe=<js expression over N = window.__noir> (headless inspection): the
// JSON result lands in #errlog's data-probe attribute
if (params.get('probe')) {
  try {
    const v = new Function('N', 'THREE', `return (${params.get('probe')});`)(window.__noir, THREE);
    Promise.resolve(v).then((r) => { errlog.el.dataset.probe = JSON.stringify(r); }, (e) => { errlog.el.dataset.probe = 'ERR ' + e; });
  } catch (e) { errlog.el.dataset.probe = 'ERR ' + e; }
}

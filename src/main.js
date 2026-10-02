// Error capture must evaluate before anything else.
import { errlog } from './debug/errlog.js';
import * as THREE from 'three';
import { installFogChunks } from './render/fog.js';
import { makeTextures } from './render/textures.js';
import { createSharedUniforms } from './render/uniforms.js';
import { Pipeline } from './render/Pipeline.js';
import { Stages } from './stages/index.js';
import { Controller } from './player/Controller.js';
import { Hud } from './ui/Hud.js';
import { Stats } from './debug/Stats.js';
import { bench } from './debug/Bench.js';
import { GpuProf } from './debug/GpuProf.js';
import { getShot, sceneShot, applyShot } from './debug/Shots.js';
import { RNG } from './util/rng.js';
import { DEATH_REPORT } from './enemies/Hood.js';
import { Game } from './game/Game.js';
import { Sfx, audioTest } from './audio/Sfx.js';
import { Autoplay } from './game/Autoplay.js';
import { ORDER } from './scenes/order.js';

// ---- URL params (DESIGN.md §9) -------------------------------------------
const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
// ?scene=<id>&beat=<name>: a story beat's frame (Shots.js sceneShot)
const sceneName = params.get('scene');
const shot = shotName ? getShot(shotName) : sceneName ? sceneShot(sceneName, params.get('beat')) : null;
const shotMode = !!shot;
// HUD: on in play unless hud=0; in shot mode only with hud=1
const hudOn = shotMode ? params.get('hud') === '1' : params.get('hud') !== '0';
const debug = params.get('debug') === '1';
const animate = params.get('anim') === '1' || !shotMode; // shots freeze after fast-forward unless anim=1
const tSkip = parseFloat(params.get('t') ?? (shot ? String(shot.t ?? 4) : '0')) || 0;
const pixelRatio = parseFloat(params.get('dpr') ?? '1') || 1;
const seed = parseInt(params.get('seed') ?? '1937', 10);
// autoplay=1: the game plays itself from the title (game/Autoplay.js)
const autoplay = params.get('autoplay') === '1' && !shotMode;
// speed=<k> (headless testing): the real-time loop runs k fixed steps' worth per frame
const speed = Math.max(0.1, parseFloat(params.get('speed') ?? '1') || 1);

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
// the places of the story (src/stages/): the block is built first, into
// this scene; any other on first use (game.stages.get)
const stages = new Stages({ renderer, U, tex, rng });
const block = stages.get('block', { scene });
const pipeline = new Pipeline(renderer, tex, U, { pixelRatio, view: parseInt(params.get('view') ?? '0', 10) || 0, debugRT: params.get('rt') });
const controller = new Controller(camera, renderer.domElement, block);
controller.onStep = (x, z, v) => { const S = controller.world; S.street.addImpact(S, x, z, Math.min(1, v / 5) * 0.8); if (game) game.sfx.step(null, v > 5, true, game._room === 'diner'); };

// ---- HUD / title / game ------------------------------------------------------
let game = null;
// sound: procedural Web Audio (audio/Sfx.js); no AudioContext until the
// first click (the pointer-lock start), none at all in shot mode
// (mute=1 in the URL, or a browser driven by a test tool: the game starts
// silent and the title says so; M turns the sound on)
const autoMute = params.get('mute') === '1' || !!navigator.webdriver;
const sfx = new Sfx({ enabled: !shotMode, forceMute: autoMute });
// the title's choice waits for the pointer lock: BEGIN, or CONTINUE from
// the save
// (?start=<id>[.<beat>] in play: BEGIN starts at that scene and beat
// instead of the diner, the save unread - a scene played without the ones
// before it, by hand or by tools/play.mjs)
const startParam = shotMode ? null : params.get('start');
const startAt = startParam ? { scene: startParam.split('.')[0], beat: startParam.split('.')[1] || null } : null;
let startFrom = null, chosen = null;
const hud = new Hud({
  brush: tex.brush.image,
  onBegin: () => { startFrom = chosen || startAt; sfx.unlock(); controller.lock(); },
  onContinue: () => { startFrom = game.save.read(); sfx.unlock(); controller.lock(); },
  // (CHAPTERS on the title: the table of contents starts the story at any
  // chapter, the save unread)
  // (the choice is kept: if the browser refuses the mouse on that click, the
  // next click anywhere - "click again to take the mouse" - starts there too)
  onChapter: (id) => { chosen = { scene: id, beat: null }; startFrom = chosen; sfx.unlock(); controller.lock(); },
  // (the slice's end card goes back to the title; THE END tries again)
  onRestart: (kind) => { sfx.unlock(); if (kind === 'cont') { game.toTitle(); return; } game.restart(); controller.lock(); },
  onResume: () => { sfx.unlock(); controller.lock(); },
  onSetting: (k, d) => settings.change(k, d),
});
// (the browser opens the audio only on a gesture: any key on the title lets
// the rain in behind it; the click that begins the game does too)
if (!shotMode) for (const ev of ['mousedown', 'keydown', 'touchstart']) addEventListener(ev, () => { sfx.unlock(); hud.soundHint(!sfx.live, sfx.muted); }, { passive: true });
hud.soundHint(!shotMode, sfx.muted);
hud.setVisible(hudOn);
if (shotMode) hud.hideTitle();
// (a screenshot never depends on when the page loaded: no CSS animation runs)
if (shotMode) hud.freeze();
game = new Game({ stages, stage: 'block', camera, controller, pipeline, hud, shotMode, sfx });
game.bindInput(renderer.domElement);
// the pause card's settings line (P1): mouse sensitivity, volume, subtitles
// (kept in localStorage; never read in shot mode)
const settings = {
  load() {
    if (shotMode) return;
    try {
      const m = parseFloat(localStorage.getItem('noir.mouse'));
      if (Number.isFinite(m)) controller.sensitivity = 0.0021 * Math.min(3, Math.max(0.2, m / 5));
      hud.subtitles = localStorage.getItem('noir.subs') !== '0';
    } catch (e) { /* storage blocked: defaults */ }
  },
  get() { return { mouse: Math.round(controller.sensitivity / 0.0021 * 5), volume: Math.round(sfx.volume * 10), subtitles: hud.subtitles }; },
  change(k, d) {
    if (k === 'mouse') { const m = Math.min(15, Math.max(1, this.get().mouse + d)); controller.sensitivity = 0.0021 * m / 5; try { localStorage.setItem('noir.mouse', String(m)); } catch (e) { /* */ } }
    if (k === 'volume') sfx.setVolume(sfx.volume + d * 0.1);
    if (k === 'subtitles') { hud.subtitles = !hud.subtitles; try { localStorage.setItem('noir.subs', hud.subtitles ? '1' : '0'); } catch (e) { /* */ } }
  },
};
settings.load();
hud.settings = () => settings.get();
// the title offers CONTINUE when a checkpoint exists
if (!shotMode) hud.showTitle('', { canContinue: game.save.exists });
hud.setChapters(ORDER.map((c) => ({ ...c, ready: !!game.scenes.get(c.id) })));
if (startAt && !game.scenes.get(startAt.scene)) console.error(`start=${startParam}: no scene '${startAt.scene}' (scenes: ${game.scenes.names.join(', ')})`);
else if (startAt && startAt.beat && !game.scenes.get(startAt.scene).beats.includes(startAt.beat)) console.error(`start=${startParam}: '${startAt.scene}' has no beat '${startAt.beat}'`);
// (play and the fight presets: every Hood variant + combat program up front)
if (!shotMode || shot.prewarm) game.prewarm(renderer);
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
    if (game.state === 'title') { game.start(startFrom); chosen = null; }   // [R3] (the chapter picked is spent: BEGIN on a later title starts the story, not that chapter again)
  } else if (game.state === 'playing') {
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
// pose=x,z,yaw,pitch[,fov] overrides a preset's camera (framing new shots);
// fov=<deg> alone overrides its lens
const poseParam = params.get('pose');
if (shot && poseParam) {
  const [x, z, yaw, pitch, fov] = poseParam.split(',').map(Number);
  Object.assign(shot, { x, z, yaw, pitch }, fov ? { fov } : {});
}
if (shot && params.get('fov')) shot.fov = parseFloat(params.get('fov'));
if (shot) applyShot(shot, controller, camera, game.stage, game);
else controller.setPose(-7.3, 6.2, -0.2, 0.02);
// puzzle=<id> (with a scene beat): open that puzzle on its table
// (?scene=diner&beat=settle&puzzle=demo)
if (shot && params.get('puzzle')) game.puzzles.open(params.get('puzzle'));
// press=<code>@<t>[,<code>@<t>...] (shot mode, a beat's moment): a key goes
// down (and up a step later) at game time t, as a player's would, so a
// query string can show the lighter's flame or the pour
const pressList = shot ? (params.get('press') || shot.press || '') : '';
if (pressList) {
  for (const item of pressList.split(',')) {
    const [code, at] = item.split('@');
    const t0 = parseFloat(at) || 0;
    let state = 0;
    game.scripts.push((t) => {
      if (state === 0 && t >= t0 - 1e-6) { state = 1; game.vin.down.add(code); game.vin.held.add(code); }
      else if (state === 1) { state = 2; game.vin.held.delete(code); game.vin.up.add(code); }
    });
  }
}
game.eye.copy(camera.position);

const STEP = 1 / 60;
let simTime = 0;
function simStep(dt) {
  // a hit stop (the brawl): the world holds for a step or three
  if (game.hitStop > 0) { game.hitStop--; return; }
  game.pre(dt, simTime);
  game.stage.update(dt, simTime, camera, pipeline.height);
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
if (shot && focusParam && game.stage.hoods.list.length) {
  const [i, dist = 3, bearing = 0, eye = 1.5, fov = 32] = focusParam.split(',').map(Number);
  const H = game.stage.hoods.list;
  const h = H[Math.min(H.length - 1, i | 0)];
  const tgt = new THREE.Vector3().setFromMatrixPosition(h.bones.hips.matrixWorld);
  tgt.y = Math.max(tgt.y, 0.35) + 0.15;
  const a = h.yaw + bearing * Math.PI / 180;
  const cx = tgt.x + Math.sin(a) * dist, cz = tgt.z + Math.cos(a) * dist;
  const yaw = Math.atan2(-(tgt.x - cx), -(tgt.z - cz));
  const pitch = Math.atan2(tgt.y - eye, dist);
  camera.fov = fov;
  camera.updateProjectionMatrix();
  controller.setPose(cx, cz, yaw, pitch, eye - 1.63);
  game.stage.update(0, simTime, camera, pipeline.height);
}

// card=pause (look development): hold that card over the frame
if (params.get('card') === 'pause') hud.showPause();
// card=chapter / card=cont / say=<line> (look development): the chapter
// card, the slice's end card, a subtitle, held over the frame
if (params.get('card') === 'chapter') { hud.card('I', 'The Diner', 1e6); hud.tickCard(1.0); }
if (params.get('card') === 'cont') hud.showEnd({ kind: 'cont' });
if (params.get('say')) hud.say(params.get('say'), 1e6);

// gdbg=<n>: wet-street term debug (render/shaders/ground.js)
if (params.get('gdbg')) U.uGroundDebug.value = parseInt(params.get('gdbg'), 10) || 0;

// exposure=<v>: override the ink pass exposure (look development)
if (params.get('exposure')) pipeline.exposureOverride = parseFloat(params.get('exposure'));

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
const NO_FIRES = [];
const perf = { sim: 0, render: 0, steps: 0 };
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;
  const tA = performance.now();
  // in play, the fight pauses behind the "click to resume" card
  const paused = !shotMode && !autoplay && game.state === 'playing' && document.pointerLockElement !== renderer.domElement;
  if (animate && !paused) {
    // (the last blow of the fight runs slow: game.timeScale)
    acc += dt * game.timeScale * speed;
    let n = 0;
    const cap = Math.ceil(6 * speed);
    while (acc >= STEP && n < cap) { simStep(STEP); acc -= STEP; n++; }
    if (n === cap) acc = 0;
    perf.steps += n;
  }
  const tB = performance.now();
  renderer.info.reset();
  const S = game.stage;
  pipeline.rimLamps = S.rimLamps;
  // the Look of the volume the eye is in (CONTRACTS §9.1)
  pipeline.setLook(S.lookAt(camera.position));
  camera.updateMatrixWorld();
  game.vm.sync(camera);
  pipeline.render(S.scene, camera, simTime);
  game.hudUpdate(dt);
  if (sfx.live) sfx.update(dt, { fires: S.cars ? S.cars.fires : NO_FIRES, hp: game.health.hp, dead: game.state === 'dead', listener: camera });
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
      + `hoods alive ${K.alive}/${K.spawned}  kills ${K.kills}\nshots ${K.shots}  hits ${K.hits} (head ${K.headshots})  hood shots ${K.hoodShots}  hood hits ${K.hoodHits}\n`
      + `hp ${game.health.hp.toFixed(0)}  ammo ${game.weapon.ammo}  particles ${game.fx.liveParticles}  decals ${K.decals}  rays ${game.rays.stats.rays}\n`
      + `cpu sim ${perf.sim.toFixed(2)} ms  render ${perf.render.toFixed(2)} ms`);
  }
}
// counters for the headless tools (tools/counters.sh reads #counters)
const counterEl = document.createElement('div');
counterEl.id = 'counters';
counterEl.style.display = 'none';
document.body.appendChild(counterEl);
// (a scene's flags hold objects too: the counters carry the plain ones)
function plainFlags(f) { const o = {}; for (const [k, v] of Object.entries(f)) if (v == null || typeof v !== 'object') o[k] = v; return o; }
function writeCounters() {
  const K = { ...game.counters, time: +simTime.toFixed(2), hp: +game.health.hp.toFixed(1), ammo: game.weapon.ammo, state: game.state,
    particles: game.fx.liveParticles, ffMs: Math.round(ffMs), rays: game.rays.stats.rays, rayMs: +game.rays.stats.ms.toFixed(1),
    states: game.world.hoods.list.map((h) => (h.alive ? (game.ais.get(h)?.state || h.state) : 'dead')).join(','),
    scene: game.scenes.current ? game.scenes.current.id : null, beat: game.scenes.beat, mode: controller.mode, hands: game.hands.set,
    fight: game.brawl.state, play: +(game.scenes.playTime || 0).toFixed(1), prompt: hud.promptShown, say: hud.sayShown, flags: game.scenes.ctx ? plainFlags(game.scenes.ctx.flags) : null };
  counterEl.dataset.json = JSON.stringify(K);
}
writeCounters();
requestAnimationFrame(frame);

window.__noir = {
  THREE, camera, renderer, pipeline, controller, hud, U, tex, game, stages,
  // the current stage and its scene (the old one-block names)
  get world() { return game.stage; },
  get stage() { return game.stage; },
  get scene() { return game.stage.scene; },
  get counters() { return game.counters; },
  perf,
  // fast-forward the fixed-step simulation (as t= does at load)
  sim(seconds = 1) { const n = Math.round(seconds * 60); for (let i = 0; i < n; i++) simStep(STEP); writeCounters(); return { ...game.counters }; },
  params: { shotName, sceneName, shotMode, hudOn, debug, tSkip },
  bench: (opts) => bench(renderer, pipeline, game.stage.scene, camera, opts),
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
    const W = game.stage;
    W.lodOff = !!on;
    for (const h of W.hoods.list) if (h.tommy) h.tommy.geometry = !on && h.lod >= 1 ? h.tommy.userData.geoLo : h.tommy.userData.geoHi;
    if (W.overpass) W.overpass.update(camera);
    if (W.cars) W.cars.lodUpdate(camera);
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
  spawnHood(pos, variant = {}, opts = {}) { return game.stage.hoods.spawn(pos, variant, opts); },
  // spawnAI(x, z, heavy): a Hood with a brain
  spawnAI(x, z, heavy = false) { return game.spawnHood(x, z, { heavy }); },
  get hoods() { return game.stage.hoods.list; },
  deathReport: DEATH_REPORT,
  get time() { return simTime; },
  sfx,
  // render every procedural sound offline: [{ name, peak, rms, seconds }]
  audioTest,
};
window.__noirReady = true;
if (autoplay) { game.autoplay = new Autoplay(game, { seed }); window.__noir.autoplay = game.autoplay; }
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

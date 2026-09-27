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
import { getShot, applyShot } from './debug/Shots.js';
import { RNG } from './util/rng.js';
import { DEATH_REPORT } from './enemies/Hood.js';

// ---- URL params (DESIGN.md §9) -------------------------------------------
const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const shot = shotName ? getShot(shotName) : null;
const shotMode = !!shot;
const hudOn = params.get('hud') !== '0';
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
controller.onStep = (x, z, v) => world.street.addImpact(world, x, z, Math.min(1, v / 5) * 0.8);

function resize() {
  pipeline.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ---- HUD / title -------------------------------------------------------------
const hud = new Hud({ onBegin: () => controller.lock() });
if (shotMode || !hudOn) hud.setVisible(false);
document.addEventListener('pointerlockchange', () => {
  if (shotMode) return;
  if (document.pointerLockElement === renderer.domElement) hud.hideTitle();
  else hud.showTitle('click to resume');
});
const stats = debug ? new Stats(renderer) : null;

// ---- start pose & fast-forward ---------------------------------------------
// pose=x,z,yaw,pitch[,fov] overrides a preset's camera (framing new shots)
const poseParam = params.get('pose');
if (shot && poseParam) {
  const [x, z, yaw, pitch, fov] = poseParam.split(',').map(Number);
  Object.assign(shot, { x, z, yaw, pitch }, fov ? { fov } : {});
}
if (shot) applyShot(shot, controller, camera, world);
else controller.setPose(-7.3, 6.2, -0.2, 0.02);

const STEP = 1 / 60;
let simTime = 0;
function simStep(dt) {
  if (!shotMode) controller.update(dt);
  else controller.apply(dt);
  world.update(dt, simTime, camera, pipeline.height);
  simTime += dt;
}
const skipSteps = Math.round(tSkip * 60);
for (let i = 0; i < skipSteps; i++) simStep(STEP);
if (skipSteps === 0) simStep(0);

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
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;
  if (animate) {
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < 6) { simStep(STEP); acc -= STEP; n++; }
    if (n === 6) acc = 0;
  }
  renderer.info.reset();
  pipeline.rimLamps = world.rimLamps;
  pipeline.render(scene, camera, simTime);
  frames++;
  errlog.setFrames(frames);
  if (stats) stats.update(`pos ${camera.position.x.toFixed(1)} ${camera.position.y.toFixed(2)} ${camera.position.z.toFixed(1)}  yaw ${controller.yaw.toFixed(2)} pitch ${controller.pitch.toFixed(2)}\nview ${pipeline.view}  tex ${tex.buildMs.toFixed(0)}ms`);
}
requestAnimationFrame(frame);

window.__noir = {
  THREE, scene, camera, renderer, pipeline, world, controller, hud, U, tex,
  params: { shotName, shotMode, hudOn, debug, wavesOn, tSkip },
  bench: (opts) => bench(renderer, pipeline, scene, camera, opts),
  lightning: (strength = 1) => pipeline.pulseLightning(simTime, strength),
  // spawnHood([x, z] | {x, z} | Vector3, variant = seed | { coat, brim, tall, cig }, { yaw, state })
  spawnHood(pos, variant = {}, opts = {}) { return world.hoods.spawn(pos, variant, opts); },
  get hoods() { return world.hoods.list; },
  deathReport: DEATH_REPORT,
  get time() { return simTime; },
};
window.__noirReady = true;

import * as THREE from 'three';
import { DINER } from '../../stages/block/site.js';
import { CAST_CLIPS } from '../../cast/clips.js';
import { buildProp } from '../../props/index.js';

// Lane 6: the brawler's fight (P0.4).
//   brawlstudy&clip=<name>&t=<s>   him alone in the diner's aisle under its
//                                  pendants, at the player's eye (1.80) and
//                                  distance (1.45 m); the clip starts at t = 0,
//                                  so t is the time into it (default br_guard)
//     &side=1                      the eye 2.1 m off his right side, over the counter
//     &round=3                     round three: blood, the cap loose
//     &hit=head|body               a blow lands at t = 0 (c.hit: the reaction clip)
//   (clip=br_bottle_thrust: the broken neck in his fist from the start)
//   brawlstrip&clip=<name>          five of him side by side on the street under
//                                  a lamp, the clip at tell, wind, contact,
//                                  follow and recover (&side=1: in profile)
// br_ko_window is staged in the aisle opposite bay B4 (its path runs over
// booth 4's table and out through the B4 pane to diner.pavement.ko).
const Q = () => new URLSearchParams(location.search);
const EYE_Y = 1.8, DIST = 1.45;
const FLOOR = DINER.floorY;

// tell, wind, contact, follow, recover (s into the clip)
export function stripTimes(name) {
  const c = CAST_CLIPS[name];
  const hit = c.marks.contact ?? c.marks.impact ?? c.marks.glass ?? c.duration * 0.5;
  return [0.16, Math.max(0.2, hit - 0.16), hit, Math.min(c.duration - 0.05, hit + 0.16), c.duration - 0.12];
}

function roundProps(c, round, stage) {
  if (round >= 3) { c.bleed(1); c.capLoose = true; }
  void stage;
}

// the bottle clip: the bottle comes into his hand at 'take', breaks at 'break'
// (lane 7 makes the glass and the sound; here only what is in his hand)
function bottleHands(c, h) {
  let b = null;
  h.onMark.take = () => { b = buildProp('bottle', { variant: 'beer' }); c.hold(b, 'R', { grip: 'hang' }); };
  h.onMark.break = () => { if (b) b.scale.y *= 0.62; };
}

// the thrust: the broken neck already in his fist from the start
function neckInFist(c) {
  const b = buildProp('bottle', { variant: 'beer' });
  c.hold(b, 'R', { grip: 'hang' });
  b.scale.y *= 0.62;
}

function stageBrawlStudy(stage, camera, controller, game) {
  const q = Q();
  const name = q.get('clip') || 'br_guard';
  if (!CAST_CLIPS[name]) throw new Error(`brawlstudy: no clip '${name}'`);
  const round = parseInt(q.get('round') || '1', 10);
  const ko = name === 'br_ko_window';
  // in the aisle; for the last blow opposite bay B4, his back to the window
  const at = ko ? { x: -12.7, z: DINER.bays.B4 + 0.1 } : { x: DINER.ring.x, z: DINER.ring.z - 0.72 };
  const yaw = ko ? -Math.PI / 2 : 0;
  const c = stage.cast.spawn('brawler', { at, yaw });
  roundProps(c, round, stage);
  if (name === 'br_bottle_thrust') neckInFist(c);
  c.setState('br_guard', 0);
  // (a second of warm-up first: the diner's pendants take the lamp pool's
  // lights; then the clip starts with the clock, so t is its time)
  game.warmup = 1;
  game.afterWarmup = () => {
    // hit=head|body: a blow lands at t = 0 (from the eye: c.hit, as lane 7's
    // rules call it; round 3 knocks the cap off)
    const hz = q.get('hit');
    if (hz) { c.hit({ zone: hz, power: 0.8, dir: new THREE.Vector3(-Math.sin(yaw) + 0.5 * Math.cos(yaw), 0, -Math.cos(yaw) - 0.5 * Math.sin(yaw)).normalize() }); return; }
    if (name === 'br_guard') return;
    const h = c.play(name, { fade: 0 });
    if (name === 'br_bottle') bottleHands(c, h);
    // (what lane 7's rules do at the marks, for the picture: the pane goes)
    if (ko) h.onMark.glass = () => { const p = stage.part('dinerFront')?.panes?.B4; if (p) stage.glass.shatter(p, { dir: new THREE.Vector3(1, 0, 0), power: 2 }); };
  };
  // the eye: 1.45 m before him (or off his left side), at 1.80, on his chest
  const side = q.get('side') === '1';
  // (the side: his right, over the counter: the aisle is too narrow to
  // stand off his left)
  const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), right = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
  const d = side ? 2.1 : DIST;
  const e = new THREE.Vector3(at.x, 0, at.z).addScaledVector(side ? right : fwd, d);
  if (ko) e.set(-12.7 - DIST, 0, DINER.bays.B4 + 0.1);
  const ty = FLOOR + 1.45 * c.fig.scale * 0.78;
  controller.setPose(e.x, e.z, Math.atan2(-(at.x - e.x), -(at.z - e.z)), Math.atan2(ty - EYE_Y, d), EYE_Y - 1.63);
  if (ko) controller.setPose(e.x, e.z, -Math.PI / 2 - 0.15, -0.12, EYE_Y - 1.63);
  if (q.get('fov')) return;
  camera.fov = side ? 50 : 68; camera.updateProjectionMatrix();
}

// five of him in a row under a lamp on the street, each at one moment
function stageStrip(stage, camera, controller, game) {
  const name = Q().get('clip') || 'br_hook';
  const round = parseInt(Q().get('round') || '1', 10);
  const T = parseFloat(Q().get('t') || '3');
  const times = stripTimes(name);
  const side = Q().get('side') === '1';
  times.forEach((ct, i) => {
    const x = -2.2 + (i - 2) * 1.35, z = -17.3;
    const c = stage.cast.spawn('brawler', { at: { x, z }, yaw: side ? -Math.PI / 2 : 0 });
    roundProps(c, round, stage);
    if (name === 'br_bottle_thrust') neckInFist(c);
    c.setState('br_guard', 0);
    let done = false;
    const t0 = Math.max(0, T - ct);
    game.scripts.push((t) => {
      if (done || t < t0 - 1e-6) return;
      done = true;
      const h = c.play(name, { fade: 0 });
      if (name === 'br_bottle') bottleHands(c, h);
    });
  });
  controller.setPose(-2.2, -11.6, 0, -0.08, -0.03);
  camera.fov = 52; camera.updateProjectionMatrix();
}

export const presets = {
  brawlstrip: { x: -2.2, z: -11.6, y: -0.03, yaw: 0, pitch: -0.08, fov: 52, t: 3, stage: stageStrip },
  brawlstudy: { x: -12.85, z: 1.73, y: 0.17, yaw: 0, pitch: -0.2, fov: 68, t: 0.5, stage: stageBrawlStudy },
};

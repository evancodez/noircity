import * as THREE from 'three';
import { DAMAGE } from './Car.js';
import { FIRE } from '../fx/fxTextures.js';

// A car's damage as the eye sees it (lane O2): the seam lane O6 replaces with
// its own damage states, fire and wreck (docs/seams/SMASH.md when it lands).
// The base's rule kept (Car.js counts the blows: v.damage 0..4, 'damage'
// events at each step): 1 a headlamp out, 2 the bonnet steaming, 3 the wheel
// pulling (and for my own car the warning `She won't take much more.`), 4 a
// wreck - its engine dead where it stands, smoking black; I get out and take
// another (the free roam never fails on a wreck).
//   showDamage(W, v, cold)   the steps reached shown (cold: put back quietly)
//   damageStep(W, dt)        the steam and the smoke of every hurt car near the eye
//   watchDamage(W, v)        v's 'damage' events into the above (and the warning)
const _v = new THREE.Vector3();
export function watchDamage(W, v) {
  if (v._dmgWatch) return;
  v._dmgWatch = true;
  v.on('damage', (e) => {
    const G = W.game;
    G.sfx.play('tail_crash', e.point || v.pos, { k: 0.9 }, { ref: 4 });
    showDamage(W, v, false);
  });
}
export function showDamage(W, v, cold = false) {
  const d = Math.floor(v.damage || 0), G = W.game;
  if (d >= 1 && !v._lampOut) {
    v._lampOut = true;
    if (v.lamps && v.lamps.cones && v.lamps.cones[0]) { v.lamps.cones[0].visible = false; v.lamps.intensity *= 0.55; }
    if (!cold && G.sfx.glass) G.sfx.glass(v.pos.clone().setY(1), 0.5);
  }
  if (d >= 2) v._steam = true;
  if (d >= 3) v.pull = v.pull || 0.035;
  if (d >= DAMAGE.wreck && !v._wrecked) {
    v._wrecked = true;
    v.power = 0;
    v._steam = 'black';
    if (v === W.V.player && !cold) { G.hud.warn(null); G.hud.message('Wrecked.', 2.4); }
  }
  // (my car: the warning before the end - WAVE_C §1 rule 2)
  if (v === W.V.player && d === DAMAGE.wreck - 1 && !cold && !v._warned) { v._warned = true; G.hud.warn('She won’t take much more.'); v._warnT = 4; }
}
export function damageStep(W, dt) {
  const G = W.game, eye = G.camera.position;
  const P = W.V.player;
  if (P && P._warnT > 0) { P._warnT -= dt; if (P._warnT <= 0) G.hud.warn(null); }
  for (const v of W.V.list) {
    if (!v._steam) continue;
    if (Math.abs(v.pos.x - eye.x) > 80 || Math.abs(v.pos.z - eye.z) > 80) continue;
    const black = v._steam === 'black';
    v._steamAcc = (v._steamAcc || 0) + dt * (black ? 9 : 2 + Math.min(4, v.speedAbs * 0.2));
    const nose = (v.spec.halfL || 2.45) - 0.6;
    while (v._steamAcc >= 1) {
      v._steamAcc -= 1;
      const p = v.seat(_v.set(nose - Math.random() * 0.5, 1.05, (Math.random() - 0.5) * 0.8), new THREE.Vector3());
      const g = black ? 0.006 + Math.random() * 0.006 : 0.035 + Math.random() * 0.015;
      const s = black ? 0.5 + Math.random() * 0.4 : 0.18;
      G.fx.smoke.spawn({ pos: p, vel: new THREE.Vector3((Math.random() - 0.5) * 0.4, black ? 1.6 + Math.random() : 0.5 + Math.random() * 0.5, (Math.random() - 0.5) * 0.4).addScaledVector(v.vel, 0.6), life: black ? 2.6 + Math.random() : 0.8 + Math.random() * 0.6, size: [s, s], grow: black ? 0.6 : 0.5, rot: Math.random() * 6.28, spin: (Math.random() - 0.5) * 0.6,
        col: [g, g, g], colEnd: [g * 1.4, g * 1.4, g * 1.4], alpha: black ? 0.8 : 0.35, drag: black ? 0.3 : 1.2, fadeIn: 0.08, fadeOut: 0.5, cell: FIRE.SMOKE[Math.floor(Math.random() * 4) % FIRE.SMOKE.length] });
    }
  }
}

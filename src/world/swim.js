import * as THREE from 'three';
import { PAVE, WATER_Y, SLIPS, RIVER } from './plan.js';

// NOIR CITY: a man in the river swims to the steps (lane O1b; O1 Left 6, the
// brief §2: "a short swim, the eye at the water, not a fade"). The city's
// free roam calls swimStep every step on foot (src/scenes/city.js):
//   in the water (off a pier's end, down a slipway, off the steps): the swim
//   (the controller's 'swim' mode: the eye at the water, W strokes him on), a
//   splash, the card `[W] swim to the steps` the first time; the steps'
//   lamps say where. At the foot of a flight of steps (C.steps): he climbs
//   them (the 'climb' mode, driven, 1.6 s) and stands on the quay. Up a
//   slipway's ramp: he wades out where it is shallow. Never a loss.
// A car in the river is still the river's (the fade, the car given back at
// the steps: until lane O2's parked cars, a man left on foot far from any
// car would be stuck in all but name).
//   swimStep(ctx, R) -> true while the swim (or the climb out) has him
export const FOOT_R = 1.6;
const _v = new THREE.Vector3();

const onSlip = (x, z) => SLIPS.some((s) => Math.abs(x - s.x) < s.w / 2 - 0.3 && z > RIVER.s + RIVER.hw);

export function swimStep(ctx, R) {
  const G = ctx.game, ctl = ctx.controller, C = ctx.stage.part('city').C, hud = ctx.hud;
  const S = R.swim || (R.swim = { on: false, climbing: null, n: 0 });
  // the climb out: the steps up to the quay, then on his feet
  if (S.climbing) {
    if (ctl.mode !== 'climb') { S.climbing = null; return false; }
    if (ctl.climb && ctl.climb.u >= 0.999) {
      const top = S.climbing.top;
      ctl.setMode('walk', { pose: { x: top[0], z: top[1], yaw: S.climbing.yaw, pitch: -0.05 }, ease: 0.3 });
      S.climbing = null; S.on = false;
      G.emit('city:ashore', { how: 'steps' });
      return false;
    }
    return true;
  }
  if (!S.on) {
    // in: on foot over the water, falling into it
    if (ctl.mode !== 'walk' || !C.inWater(ctl.pos.x, ctl.pos.z) || ctl.groundY > PAVE - 0.35) return false;
    S.on = true; S.n++; S.t0 = G.time;
    ctl.setMode('swim', {
      water: WATER_Y, C, ease: 0.25,
      canLeave: (x, z) => onSlip(x, z),
      onStroke: (x, z) => { if (G.sfx) G.sfx.play('b9splash', _v.set(x, WATER_Y, z), { k: 0.25 }); },
    });
    if (G.sfx) G.sfx.play('b9splash', _v.set(ctl.pos.x, WATER_Y, ctl.pos.z), { k: 1 });
    const st = ctx.stage.part('street');
    if (st && st.addImpact) st.addImpact(ctx.stage, ctl.pos.x, ctl.pos.z, 1);
    // ([O1b] after the critic, m3: the card went the frame it came - the W that
    // walked him off the pier answered it; it stays until he has swum on 2 s in)
    hud.teach('city_swim', '[W] swim to the steps', { until: () => !S.on || (G.time - S.t0 > 2.5 && G.held('KeyW')) });
    G.emit('city:swim', { x: ctl.pos.x, z: ctl.pos.z });
    return true;
  }
  if (ctl.mode !== 'swim') { S.on = false; return false; }
  const p = ctl.pos;
  // out up a slipway's ramp where it is shallow: on his feet
  if (onSlip(p.x, p.z) && C.groundAt(p.x, p.z) > WATER_Y - 0.6) {
    ctl.setMode('walk', { ease: 0.45 });
    S.on = false;
    G.emit('city:ashore', { how: 'slipway' });
    return false;
  }
  // at the foot of a flight: up the steps
  for (const s of C.steps || []) {
    if (Math.hypot(p.x - s.foot[0], p.z - s.foot[1]) > FOOT_R) continue;
    const foot = s.foot, step = s.step, top = s.top;
    const yaw = Math.atan2(-(step[0] - foot[0]), -(step[1] - foot[1]));
    const yawTop = Math.atan2(-(top[0] - step[0]), -(top[1] - step[1]));
    const EYE = 1.65;
    // (the eye: up the flight from the water to its top step, then across onto the quay)
    const path = (u) => {
      if (u < 0.78) { const k = u / 0.78; return { x: foot[0] + (step[0] - foot[0]) * k, y: WATER_Y + 0.3 + (PAVE + EYE - (WATER_Y + 0.3)) * k, z: foot[1] + (step[1] - foot[1]) * k }; }
      const k = (u - 0.78) / 0.22;
      return { x: step[0] + (top[0] - step[0]) * k, y: PAVE + EYE, z: step[1] + (top[1] - step[1]) * k };
    };
    // (a context move: 0.6 s up the flight, the look free - GAME_TWO A2)
    ctl.setMode('climb', { path, u: 0, speed: 1.65, face: yaw, drive: 1, ease: 0.25 });
    S.climbing = { top, yaw: yawTop, s };
    if (G.sfx) G.sfx.play('b9splash', _v.set(p.x, WATER_Y, p.z), { k: 0.5 });
    return true;
  }
  return true;
}

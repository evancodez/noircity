import * as THREE from 'three';
import { crowdOf } from '../combat/brawl/Crowd.js';

// [O7] after the critic (B3: 'LMB on foot with empty hands does nothing'): the
// bare hand in the street. The rulebook (WAVE_C §2) gives LMB as the right
// hand's main act - jab, fire: with nothing drawn, on foot in the city, out of
// a fight, LMB / RMB throws O4's jab on the press (the hands up, the swing, the
// whiff); a man in reach (1.9 m, in front of me, nothing between) takes it -
// a man with a fight of his own (c.onFist: the wanted man, the beat cop) says
// what it means; anyone else answers with O4's crowd brawl, and the city
// hears it (crime.emit('punch'): the heat's 1, the beat cop). In a place's
// room the room's own fist is first (Places.fist); a swing at nobody there is
// this one's. The hands go down again a breath after the last swing.
//   fistStep(ctx, R) -> true when the press was taken (city.js's step)
export const FIST = { reach: 1.9, cone: 0.42, down: 0.9 };
const KINDS = { o4_cop: 'cop', o4_gangster: 'gangster', o4_drunk: 'drunk', o4_driver: 'driver', o4_boxer: 'boxer' };
const _f = new THREE.Vector3(), _o = new THREE.Vector3();

export function drawnGun(G) { const c = G.player.weapons.current, h = G.player.hands.set; return !!c && c !== 'fists' && !!h && h !== 'empty' && h !== 'fists'; }

export function fistStep(ctx, R) {
  const G = ctx.game, F = crowdOf(G), H = G.player.hands;
  // (the hands down a breath after the last swing at nobody)
  if (R.fistDown != null && G.time > R.fistDown) { R.fistDown = null; if (!F.active && !drawnGun(G) && H.set === 'fists') { H.equip('empty'); G.setViewmodelVisible(false); } }
  if (R.inCar || F.active || (G.brawl && G.brawl.active) || G.failing || drawnGun(G)) return false;
  const L = G.pressed('Mouse0'), Rt = G.pressed('Mouse2');
  if (!L && !Rt) return false;
  const P = R.places;
  if (P && (P.seat || (P.inside && P.fistAt === G.time))) return false;
  const arm = L ? 'L' : 'R';
  const man = inReach(G);
  if (man && man.onFist) { man.onFist(arm); return true; }
  if (man) {
    const kind = KINDS[man.kind] || 'driver';
    F.start({ men: [{ kind, c: man }], leave: true, seed: 9100 + Math.floor(G.time),
      onDown: () => (kind === 'cop' ? { why: 'Hands up.', to: 'station' } : { why: 'Down in the street.', to: 'hospital' }) });
    F.inputStep(0);   // (the press that started it is my first jab: it lands now)
    if (G.crime) G.crime.emit(kind === 'cop' ? 'cop' : 'punch', { x: man.pos.x, z: man.pos.z }, 'me');
    G.emit('city:fist', { man: man.name || null, kind });
    return true;
  }
  // nobody: the swing, the whiff
  G.setViewmodelVisible(true);
  if (H.set !== 'fists') H.equip('fists');
  H.play(arm === 'L' ? 'jabL' : 'jabR');
  if (G.sfx && G.sfx.fight) G.sfx.fight('whiff', null, { k: 0.5 });
  R.fistDown = G.time + FIST.down;
  G.emit('city:fist', { man: null });
  return true;
}

// the man in front of me within reach: a figure of the stage's cast, standing, nothing between
export function inReach(G) {
  const e = G.eye, f = _f.set(0, 0, -1).transformDirection(G.camera.matrixWorld);
  const fl = Math.hypot(f.x, f.z) || 1;
  let best = null, bs = FIST.cone;
  for (const c of G.cast.list) {
    if (!c.alive || c.down || c.seat || c.noFist) continue;
    const p = c.pos, dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz);
    if (d > FIST.reach || Math.abs((p.y || 0) + 1.3 - e.y) > 1.4) continue;
    const a = Math.acos(Math.max(-1, Math.min(1, (dx * f.x + dz * f.z) / (d * fl || 1))));
    if (a >= bs) continue;
    _o.set(dx, (p.y || 0) + 1.3 - e.y, dz);
    const L = _o.length();
    if (G.rays && G.rays.raycast(e.clone(), _o.normalize(), Math.max(0.05, L - 0.4))) continue;
    bs = a; best = c;
  }
  return best;
}

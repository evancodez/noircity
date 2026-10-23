import * as THREE from 'three';
import { FLOOR } from '../../city/kits/interior/kit.js';
import { ring, heavyBag, bench, lockers, sheet, label, crates } from '../../city/kits/interior/pieces.js';
import { RNG } from '../../util/rng.js';
import { boutStart } from '../bout.js';

// The boxing gym (the Tenements; brief O5 §2.1): a long hall behind its
// street door, the ring at the back under two caged lamps (the brightest
// thing in the place: the canvas prints paper white), heavy bags on chains
// down the front, benches, lockers, the fight cards on the wall. The man at
// the ring's corner runs the bouts: E, a bout for money, three levels
// (bout.js: the base's fist fight - the stand-in for O4's brawl.bout - with
// the purse paid on a win). Men train at the bags; a crowd comes to the
// ropes for a bout.
export default {
  kind: 'gym',
  spawn: { x: 0, z: -1.6, yaw: 0 },
  build(K, s, P) {
    const b = s.lb, R0 = new RNG(0x6E1), rng = () => R0.next();
    const x0 = b.x0 + 0.4, x1 = b.x1 - 0.4, z0 = Math.max(b.z0 + 0.4, -18), z1 = -0.3, H = 4.4;
    K.room(x0, x1, z0, z1, { h: H, floor: 'boards', look: { haze: 0.55, ambient: 0.45 }, sides: { s: { holes: P.doorHoles(s, 's') } } });
    // the ring at the back, centred across the hall
    const rw = Math.min(5.0, x1 - x0 - 1.7), rcx = (x0 + x1) / 2;
    const rz0 = z0 + 0.9, rz1 = rz0 + rw;
    const R = ring(K, rcx - rw / 2, rcx + rw / 2, rz0, rz1);
    // (the ropes are a fence round its edge: the platform's sides solid, a gap at the steps' corner)
    K.solid(rcx - rw / 2 - 0.15, rcx + rw / 2 + 0.15, rz0 - 0.15, rz0 + 0.02);
    K.solid(rcx - rw / 2 - 0.15, rcx - rw / 2 + 0.02, rz0, rz1);
    K.solid(rcx + rw / 2 - 0.02, rcx + rw / 2 + 0.15, rz0, rz1);
    K.solid(rcx - rw / 2 - 0.15, rcx + rw / 2 - 1.0, rz1 - 0.02, rz1 + 0.15);
    // (the steps up at the front-right corner)
    K.stairs(rcx + rw / 2 - 1.0, rcx + rw / 2 - 0.1, rz1 + 0.15, rz1 + 1.05, FLOOR, R.y, 'n', { key: 'wood' });
    // two caged lamps over the ring, one over the bags, a bare one by the door
    K.lamp(rcx - rw * 0.22, FLOOR + 3.3, (rz0 + rz1) / 2, { kind: 'pendant', power: 1.3, ceilY: FLOOR + H, drop: 3.3 - 0.62 });
    K.lamp(rcx + rw * 0.22, FLOOR + 3.3, (rz0 + rz1) / 2, { kind: 'pendant', power: 1.3, ceilY: FLOOR + H, drop: 3.3 - 0.62 });
    K.lamp(x0 + 1.4, FLOOR + 3.0, -4.6, { kind: 'cage', power: 0.7, ceilY: FLOOR + H });
    K.lamp((x0 + x1) / 2, FLOOR + 3.1, -1.6, { kind: 'bare', power: 0.45, ceilY: FLOOR + H });
    // the bags down the left wall; the benches along the right; lockers at the back of the right wall
    for (const z of [-3.2, -5.6]) heavyBag(K, x0 + 1.0, z, { top: FLOOR + H });
    bench(K, x1 - 0.5, x1 - 0.05, -7.2, -3.4);
    lockers(K, rz1 + 1.4, Math.min(-7.8, rz1 + 4.2), x1, { dir: 'w' });
    crates(K, x0 + 0.5, rz1 + 1.6, { n: 1, s: 0.7, rng });
    // the fight cards and a poster or two on the walls
    for (let i = 0; i < 4; i++) sheet(K, -3.0 - i * 1.6, FLOOR + 1.9 + (i % 2) * 0.25, x0, { w: 0.55, h: 0.75, dir: 'e' });
    label(K, 'BOUTS\nNIGHTLY', x0 + 0.01 + (x1 - x0) * 0.5, FLOOR + 3.0, z0, { w: 2.0, h: 0.9, dir: 's', dark: true });
    label(K, 'SEE THE MAN\nAT THE RING', -8.2, FLOOR + 1.9, x0, { w: 1.0, h: 0.5, dir: 'e', lit: true });
    // the man at the ring's corner (by the steps); two men at the bags and the bench
    K.ring = { x0: rcx - rw / 2, x1: rcx + rw / 2, z0: rz0, z1: rz1, y: R.y };
    K.man = { x: rcx + rw / 2 + 0.4, z: rz1 + 0.7 };
    K.fig('oldman', K.man.x, K.man.z, Math.PI * 0.85, { name: 'promoter', state: 'watch' });
    K.fig('docker', x0 + 1.75, -3.2, -Math.PI / 2, { name: 'trainer', state: 'br_guard' });
    K.fig('dockhand', x1 - 0.9, -5.0, -Math.PI / 2, { name: 'sitter', state: 'idle' });
    // E at the man: the bout
    K.use({ at: [K.man.x, FLOOR + 1.5, K.man.z], range: 2.4, cone: 0.5,
      prompt: () => boutPrompt(s, P),
      when: () => !P.game.brawl.active && !(s.live && s.live.run && s.live.run.busy),
      onUse: () => s.live.run.offer(), tourSkip: 'the bout plays' });
    void rng;
  },
  live(K, s, P) { return boutStart(K, s, P); },
};

const PURSE = [25, 60, 140];
const NAMES = ['KID SHEA', 'BIG LOU', 'THE OX'];
function boutPrompt(s) {
  const lv = Math.min(2, (s.state.wins || 0));
  return `a bout: ${NAMES[lv].toLowerCase()}, $${PURSE[lv]}`;
}
export { PURSE, NAMES };
void THREE;

import * as THREE from 'three';
import { FLOOR } from '../../city/kits/interior/kit.js';
import { counter, shelves, bed, chair, table, label, sheet, bars } from '../../city/kits/interior/pieces.js';
import { RNG } from '../../util/rng.js';

// The hotel (the Carlton, on Grand Ave; brief O5 §2.6): the lobby with its
// desk, its clerk, the pigeonholes and the bell, two armchairs and a palm,
// the lift in its cage; a corridor upstairs; my room (3) over the avenue -
// the bed, a chair, the window onto Grand Ave and the el. E at the bed:
// sleep - the black, the heat dies (the police's: heat:clear), health
// whole, the night on an hour (night:hour), and the save is written (the v2
// save with the city at its 'hotel' beat: CONTINUE wakes me here; O7 defines
// the open world's save and CONTINUE).
const UP = 4.4;   // the downtown ground floor's height
export default {
  kind: 'hotel',
  spawn: { x: 0, z: -1.6, yaw: 0 },
  build(K, s, P) {
    const b = s.lb, R0 = new RNG(0x407E1), rng = () => R0.next();
    const x0 = Math.max(b.x0 + 0.6, -8.0), x1 = Math.min(b.x1 - 0.6, 8.0), z0 = Math.max(b.z0 + 0.5, -11.7), z1 = -0.3;
    const y1 = FLOOR + UP;
    // ---- the lobby (floor 0)
    K.at(0);
    K.roomRect = { x0, x1, z0, z1 };
    // (the lift's shaft is cut through the ceiling)
    const L = { x0: x0 + 0.3, x1: x0 + 2.1, z0: z0 + 0.1, z1: z0 + 1.9 };
    K.room(x0, x1, z0, z1, { h: UP - 0.3, floor: 'tile', wall: 'paper', ceil: null, look: { ambient: 0.6, haze: 0.25 }, sides: { s: { holes: P.doorHoles(s, 's') } } });
    // (the ceiling, round the shaft)
    K.ceil(L.x1 + 0.1, x1 + 0.24, z0 - 0.24, z1 + 0.24, FLOOR + UP - 0.3, 'plaster');
    K.ceil(x0 - 0.24, L.x1 + 0.1, L.z1 + 0.1, z1 + 0.24, FLOOR + UP - 0.3, 'plaster');
    K.box('wood', x0, x1, FLOOR, FLOOR + 1.1, z0, z0 + 0.04, 0);
    // the desk, its bell, the pigeonholes behind it, the clerk
    const dz = z0 + 3.2;
    counter(K, x1 - 4.6, x1 - 0.6, dz - 0.6, dz, { dir: 's', h: 1.1, top: 'woodHi' });
    shelves(K, x1 - 4.2, x1 - 1.0, z0, { dir: 's', h: 2.2, n: 6, depth: 0.25, fill: 'linen', rng });
    K.prop('cup', x1 - 1.3, FLOOR + 1.1, dz - 0.25, 0, { name: 'pen' });
    K.use({ at: [x1 - 2.6, FLOOR + 1.15, dz - 0.15], range: 2.0, cone: 0.5, prompt: 'the bell', onUse: () => { P.game.sfx.play('bell', K.F.v(x1 - 2.6, 1.5, dz), {}, { ref: 3 }); P.game.hud.message('The clerk looks up. Your key is on its hook: 3.', 2.0); } });
    K.fig('oldman', x1 - 2.6, dz - 1.2, 0, { name: 'clerk', state: 'read' });
    // two armchairs and their low table on a rug; a palm by the door
    K.box('cloth', -3.6, 0.4, FLOOR, FLOOR + 0.02, -6.4, -3.4, 1);
    for (const [cx, cz, yw] of [[-2.8, -4.9, -Math.PI / 2], [-0.4, -4.9, Math.PI / 2]]) {
      K.box('leather', cx - 0.4, cx + 0.4, FLOOR, FLOOR + 0.45, cz - 0.4, cz + 0.4, 1);
      K.box('leather', cx - 0.4 + (yw < 0 ? 0 : 0.6), cx - 0.4 + (yw < 0 ? 0.2 : 0.8), FLOOR + 0.45, FLOOR + 1.0, cz - 0.4, cz + 0.4, 1);
      K.solid(cx - 0.42, cx + 0.42, cz - 0.42, cz + 0.42);
    }
    table(K, -1.6, -4.9, { round: true, w: 0.6, h: 0.5 });
    K.cyl('wood', x0 + 0.6, FLOOR, FLOOR + 0.5, -1.0, 0.25, 0.3, 12, 1);
    for (let i = 0; i < 7; i++) { const a = i * 0.9; K.add('cloth', new THREE.PlaneGeometry(0.22, 0.9).rotateX(-0.6).rotateY(a).translate(x0 + 0.6 + Math.sin(a) * 0.3, FLOOR + 0.95, -1.0 + Math.cos(a) * 0.3), 3); }
    K.post(x0 + 0.6, -1.0, 0.32);
    label(K, 'HOTEL CARLTON', 0, FLOOR + 3.3, z0, { w: 2.6, h: 0.5, dir: 's', dark: true });
    sheet(K, -5.0, FLOOR + 1.9, z0, { w: 0.8, h: 1.0, dir: 's' });
    K.lamp(-1.6, FLOOR + 3.0, -4.9, { kind: 'globe', power: 0.8, ceilY: FLOOR + UP - 0.3 });
    K.lamp(x1 - 2.6, FLOOR + 3.0, dz - 0.4, { kind: 'pendant', power: 0.8, ceilY: FLOOR + UP - 0.3 });
    K.lamp(0, FLOOR + 3.0, -1.4, { kind: 'globe', power: 0.5, ceilY: FLOOR + UP - 0.3 });
    // ---- the lift: a cage in its shaft, ground floor to the first; E: up or down
    K.at(null);
    bars(K, 'z', L.x1, L.z0, L.z1, { y0: FLOOR, y1: y1 + 2.4, gap: [L.z0 + 0.35, L.z1 - 0.25] });
    K.wall('x', L.z0 - 0.1, L.x0 - 0.3, L.x1 + 0.1, FLOOR, y1 + 2.6, { t: 0.2, key: 'paper' });
    const lift = { y: FLOOR, target: FLOOR, at: 0, t: 0, L, y1 };
    const cab = new THREE.Group();
    K.group.add(cab);
    const cabMeshes = [];
    const cm = (g, key) => { const m = new THREE.Mesh(g, K.mats[key]); m.userData.inkId = K.id + 2; cab.add(m); cabMeshes.push(m); K.extra.push(m); return m; };
    const lw = L.x1 - L.x0, ld = L.z1 - L.z0;
    cm(new THREE.BoxGeometry(lw - 0.1, 0.08, ld - 0.1).translate(0, -0.04, 0), 'woodHi');
    cm(new THREE.BoxGeometry(lw - 0.1, 0.06, ld - 0.1).translate(0, 2.35, 0), 'iron');
    for (let i = 0; i < 9; i++) { const x = -lw / 2 + 0.1 + i * (lw - 0.2) / 8; cm(new THREE.CylinderGeometry(0.012, 0.012, 2.3, 4).translate(x, 1.17, -ld / 2 + 0.06), 'iron'); }
    cab.userData.home = K.F.v((L.x0 + L.x1) / 2, 0, (L.z0 + L.z1) / 2);
    cab.rotation.y = K.F.yaw(0);
    lift.cab = cab;
    lift.place = () => { cab.position.copy(cab.userData.home).setY(lift.y); cab.updateMatrixWorld(true); };
    lift.place();
    // its floor (a surface that moves with it), its gates (closed while it rides; a floor's gate shut while the cab is away)
    lift.floor = { x0: L.x0, x1: L.x1, z0: L.z0, z1: L.z1, y: FLOOR, lvl: 0, prefer: true };
    K.floors.push(lift.floor);
    lift.gate = K.solid(L.x1 - 0.05, L.x1 + 0.05, L.z0 + 0.35, L.z1 - 0.25, { lvl: null });
    lift.gate.lvl = undefined; lift.gate.gone = true;
    lift.shut0 = K.solid(L.x1 + 0.08, L.x1 + 0.16, L.z0 + 0.35, L.z1 - 0.25, { lvl: null }); lift.shut0.lvl = undefined;
    lift.shut1 = K.solid(L.x1 + 0.08, L.x1 + 0.16, L.z0 + 0.35, L.z1 - 0.25, { lvl: null }); lift.shut1.lvl = undefined;
    K.lift = lift;
    K.use({ atFn: () => K.F.v(L.x1 - 0.3, lift.y + 1.2, (L.z0 + L.z1) / 2), range: 2.2, cone: 0.6, prompt: () => (lift.at === 0 ? 'the lift: up' : 'the lift: down'), when: () => !lift.riding, onUse: () => ride(K, s, P) });
    // (a call button outside each floor's gate)
    // ---- the first floor: the corridor at the back, my room over the avenue
    K.at(1);
    const cz0 = z0, cz1 = z0 + 2.4;
    K.room(L.x1 + 0.14, x1, cz0, cz1, { y: y1, h: 2.9, floor: 'boards', wall: 'paper', look: { ambient: 0.5, haze: 0.2 }, sides: { s: { holes: [{ a: -0.6, b: 0.4, top: y1 + 2.05 }, { a: 3.0, b: 4.0, top: y1 + 2.05 }, { a: -4.6, b: -3.6, top: y1 + 2.05 }] }, w: { holes: [{ a: L.z0 + 0.3, b: L.z1 - 0.2, top: y1 + 2.2 }] } } });
    K.box('cloth', x0 + 2.4, x1 - 0.2, y1, y1 + 0.02, cz0 + 0.5, cz1 - 0.5, 1);
    for (const x of [x0 + 4.2, 2.6]) K.lamp(x, y1 + 2.5, (cz0 + cz1) / 2, { kind: 'globe', power: 0.45, ceilY: y1 + 2.9 });
    // the doors along it: 2 (locked), 3 (mine), 4 (locked)
    K.door({ x: -4.6, z: cz1 + 0.12, axis: 'x', w: 1.0, y: y1, locked: true, name: 'room2' });
    const mine = K.door({ x: -0.6, z: cz1 + 0.12, axis: 'x', w: 1.0, y: y1, name: 'room3', swing: -1 });
    K.door({ x: 3.0, z: cz1 + 0.12, axis: 'x', w: 1.0, y: y1, locked: true, name: 'room4' });
    label(K, '2', -4.1, y1 + 2.25, cz1, { w: 0.18, h: 0.18, dir: 'n', lit: true });
    label(K, '3', -0.1, y1 + 2.25, cz1, { w: 0.18, h: 0.18, dir: 'n', lit: true });
    label(K, '4', 3.5, y1 + 2.25, cz1, { w: 0.18, h: 0.18, dir: 'n', lit: true });
    void mine;
    // my room: the window onto the avenue (a window of the face on this floor)
    const rx0 = -2.0, rx1 = 1.9, rz0 = cz1 + 0.24, rz1 = z1;
    const win = P.faceWindows(s, { kinds: ['win'], y0: y1 + 0.3, y1: y1 + 2.4, x0: rx0 + 0.6, x1: rx1 - 0.6 });
    K.windows = win.slice(0, 1);
    K.room(rx0, rx1, rz0, rz1, { y: y1, h: 2.9, floor: 'boards', wall: 'paper', look: { ambient: 0.45, haze: 0.1 }, sides: { n: false, s: { holes: P.windowHoles(K.windows) } } });
    // (its back wall is the corridor's front: the room's 'n' side, with its door)
    bed(K, rx0 + 0.1, rx0 + 1.5, rz0 + 0.3, rz0 + 2.4, { y: y1, head: 'n' });
    chair(K, rx1 - 0.6, rz1 - 1.2, -Math.PI / 2 - 0.4, { y: y1 });
    K.box('wood', rx1 - 0.6, rx1 - 0.02, y1, y1 + 1.9, rz0 + 0.1, rz0 + 1.1, 1);
    K.solid(rx1 - 0.6, rx1 - 0.02, rz0 + 0.1, rz0 + 1.1);
    K.box('woodHi', rx0 + 0.1, rx0 + 0.55, y1, y1 + 0.6, rz0 + 2.5, rz0 + 2.95, 1);
    K.lamp(rx0 + 0.32, y1 + 0.9, rz0 + 2.72, { kind: 'pendant', power: 0.35, ceilY: y1 + 0.95, drop: 0.6 });
    K.lamp((rx0 + rx1) / 2, y1 + 2.5, (rz0 + rz1) / 2, { kind: 'bare', power: 0.35, ceilY: y1 + 2.9, on: false });
    K.use({ at: [rx0 + 0.8, y1 + 0.6, rz0 + 1.3], range: 2.2, cone: 0.6, prompt: 'sleep', onUse: () => sleep(K, s, P) });
    K.use({ at: [rx1 - 0.05, y1 + 1.3, rz1 - 1.8], range: 2.0, cone: 0.4, prompt: 'the light', onUse: () => { const l = K.lamps.at(-1); l.set(!l.on); P.game.sfx.play('c3_switch', null, {}, { ref: 1 }); } });
    K.box('chrome', rx1 - 0.06, rx1 - 0.02, y1 + 1.25, y1 + 1.37, rz1 - 1.85, rz1 - 1.75, 3);
    K.wake = { x: rx0 + 0.8, z: rz0 + 1.2, yaw: -Math.PI / 2 - 0.3, y: y1, lvl: 1 };
    K.at(null);
  },
  live(K, s, P) {
    const G = P.game, lift = K.lift;
    return {
      step(dt) {
        if (lift.riding) {
          lift.t += dt;
          const T = 3.2, u = Math.min(1, lift.t / T), e = u * u * (3 - 2 * u);
          lift.y = lift.from + (lift.target - lift.from) * e;
          lift.floor.y = lift.y; lift.floor.lvl = lift.y > (FLOOR + lift.y1) / 2 ? 1 : 0;
          lift.place();
          if (u >= 1) { lift.riding = false; lift.at = lift.target > FLOOR + 0.1 ? 1 : 0; lift.gate.gone = true; G.sfx.play('c5_liftBell', lift.cab.position.clone().setY(lift.y + 2), {}, { ref: 3 }); G.sfx.play('c5_cage', lift.cab.position.clone(), {}, { ref: 3 }); }
        }
        // a floor's gate shut while the cab is not there (and only on that floor)
        lift.shut0.gone = !(P.level === 0 && (lift.riding || lift.at !== 0));
        lift.shut1.gone = !(P.level === 1 && (lift.riding || lift.at !== 1));
      },
      dispose() {},
    };
  },
  // CONTINUE (the 'hotel' beat): up in my room, by the bed
  wake(K, s, P) {
    const G = P.game, W = K.wake, p = s.frame.w(W.x, W.z);
    G.controller.setPose(p.x, p.z, s.frame.yaw(W.yaw), -0.1, W.y);
    P.level = 1;
    G.hud.message('Morning, near enough. The rain again.', 2.4);
  },
};

function ride(K, s, P) {
  const G = P.game, lift = K.lift, L = lift.L;
  // (I must be in the cab: else it is called to me)
  const me = s.frame.l(G.controller.pos.x, G.controller.pos.z);
  const inCab = me.x > L.x0 && me.x < L.x1 && me.z > L.z0 && me.z < L.z1 && Math.abs(G.controller.groundY - lift.y) < 0.6;
  lift.from = lift.y;
  lift.target = inCab ? (lift.at === 0 ? lift.y1 : FLOOR) : (P.level === 1 ? lift.y1 : FLOOR);
  if (!inCab && Math.abs(lift.target - lift.y) < 0.05) { G.hud.message('Step in.', 1.0); return; }
  lift.riding = true; lift.t = 0;
  lift.gate.gone = !inCab;
  G.sfx.play('c5_cage', lift.cab.position.clone(), {}, { ref: 3 });
  G.sfx.play('c5_liftMotor', lift.cab.position.clone(), {}, { ref: 3 });
}

function sleep(K, s, P) {
  const G = P.game;
  if (P.sleeping) return;
  P.sleeping = { t: 0 };
  const T = { t: 0 };
  const C = G.controller;
  C.frozen = true;
  const step = (dt) => {
    T.t += dt;
    if (T.t < 1.0) { G.hud.fade(T.t / 1.0); return false; }
    if (!T.done) {
      T.done = true;
      // the heat dies, health whole, the night on an hour, the save written at the hotel
      G.health.reset();
      if (G.police && G.police.clear) G.police.clear('sleep');
      G.emit('heat:clear', { why: 'sleep' });
      G.emit('night:hour', { hours: 1, why: 'sleep' });
      const S = G.scenes, was = S.beat;
      S.beat = 'hotel';
      const d = G.save.write();
      S.beat = was;
      G.emit('saved', { at: 'hotel', ok: !!d });
      G.hud.kit.failLine && G.hud.kit.failLine('Slept. Saved.');
      G.hud.kit.failK && G.hud.kit.failK(1);
    }
    if (T.t < 3.0) return false;
    if (T.t < 3.8) { G.hud.kit.failK && G.hud.kit.failK(0); G.hud.fade(1 - (T.t - 3.0) / 0.8); return false; }
    G.hud.fade(0); G.hud.kit.failLine && G.hud.kit.failLine(null);
    C.frozen = false;
    P.sleeping = null;
    return true;
  };
  P.later(step);
}

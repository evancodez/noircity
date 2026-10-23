import * as THREE from 'three';
import { FLOOR } from '../../city/kits/interior/kit.js';
import { counter, bench, bed, label, sheet, litWindow, table, chair } from '../../city/kits/interior/pieces.js';
import { wake as fallWake } from '../../combat/fall.js';
import { LETTER_FONT } from '../../ui/lettering.js';
import { RNG } from '../../util/rng.js';

// The hospital (lane O5b, brief O5b §1): Downtown on Mercer St, a street door
// of its own - the lit globe over it, EMERGENCY lettered under it, the
// ambulance at the kerb (a car of the city's: solid, it takes a shove) -; the
// hall with the admitting desk and its nurse, the waiting bench, a trolley;
// a swing door and a short corridor; the ward: two rows of iron beds under
// one pendant, a man asleep in one, screens, the night in the window.
// A fall in the city that no place claims wakes me here (the city's beat
// `hospital`: the black, 'Came round.', the stitches paid - O4's fall.js -,
// the gun kept, the heat gone, my car where it was), in the ward's bed by
// the door. Any free bed is a sleep (the hotel's rule: the save written at
// the city's beat `ward`, 'Slept. Saved.', the night on an hour).
const WARD_Z1 = -10.84;
void bed;
export default {
  kind: 'hospital',
  spawn: { x: 0, z: -1.6, yaw: 0 },
  build(K, s, P) {
    const b = s.lb, R0 = new RNG(0x405b), rng = () => R0.next();
    const x0 = Math.max(b.x0 + 0.5, -7.0), x1 = Math.min(b.x1 - 0.5, 7.0), z1 = -0.3, zh = -7.4, z0 = Math.max(b.z0 + 0.5, -23.5);
    const H = 3.7;
    K.roomRect = { x0, x1, z0: zh, z1 };
    // ---- the hall: pale tiled walls to the shoulder (the one white thing a hospital has), the desk under a hard pendant
    K.room(x0, x1, zh, z1, { h: H, floor: 'lino', wall: 'plaster', look: { ambient: 0.24, haze: 0.3 }, sides: { s: { holes: P.doorHoles(s, 's') }, n: { holes: [{ a: -0.8, b: 0.8, top: FLOOR + 2.2 }] } } });
    const dado = (x0_, x1_, za, zb) => K.box('linen', x0_, x1_, FLOOR, FLOOR + 1.35, za, zb, 0);
    dado(x0, -0.85, zh, zh + 0.03); dado(0.85, x1, zh, zh + 0.03);
    dado(x0, x0 + 0.03, zh, z1); dado(x1 - 0.03, x1, zh, z1);
    K.box('black', x0, x1, FLOOR + 1.35, FLOOR + 1.4, zh, zh + 0.035, 0);
    // the admitting desk on the right, the nurse behind it, her lamp, the book
    const dx0 = 1.6, dx1 = Math.min(5.4, x1 - 1.0), dz0 = -4.5, dz1 = -3.85;
    counter(K, dx0, dx1, dz0, dz1, { dir: 's', h: 1.08, top: 'woodHi' });
    K.box('linen', (dx0 + dx1) / 2 - 0.25, (dx0 + dx1) / 2 + 0.2, FLOOR + 1.08, FLOOR + 1.1, dz1 - 0.35, dz1 - 0.05, 3);
    K.fig('waitress', (dx0 + dx1) / 2, -5.2, 0, { name: 'nurse', state: 'idle' });
    // [O5b] after the critic (B2): the point is her head behind the desk (the sergeant's rule), not the
    // counter's edge below the eye - at the desk's front, looking at her face, E answers
    K.use({ at: [(dx0 + dx1) / 2, FLOOR + 1.55, -5.2], range: 2.6, cone: 0.5, prompt: 'the nurse', onUse: () => nurse(s, P) });
    label(K, 'ADMITTING', (dx0 + dx1) / 2, FLOOR + 2.55, zh, { w: 1.7, h: 0.3, dir: 's', dark: true });
    label(K, 'WARD', 0, FLOOR + 2.5, zh, { w: 0.8, h: 0.26, dir: 's', lit: true });
    label(K, 'NO SMOKING\nVISITORS 2 - 4', x0, FLOOR + 1.95, -2.4, { w: 0.9, h: 0.5, dir: 'e' });
    // the waiting bench on the left, a man on it with his hat in his hands; a trolley along the wall
    bench(K, x0 + 0.05, x0 + 0.55, -6.6, -3.2);
    K.fig('oldman', x0 + 0.35, -4.4, Math.PI / 2, { name: 'waiting', state: 'sit', seat: { y: FLOOR + 0.46, name: 'bench' } });
    trolley(K, x1 - 0.55, -2.2, -0.3);
    K.solid(x1 - 0.95, x1 - 0.15, -3.3, -1.1);
    // the light: one hard pendant over the desk; [O5b] after the critic (M3: the hall was an even grey
    // box from the door) the room's dark and a second hard pendant over the floor before the swing
    // doors - the pool a player sees first, the dado white in it, the corners black
    K.lamp((dx0 + dx1) / 2, FLOOR + 2.75, -4.0, { kind: 'pendant', power: 1.15, ceilY: FLOOR + H });
    K.lamp(-0.6, FLOOR + 2.8, -4.6, { kind: 'pendant', power: 1.2, ceilY: FLOOR + H });
    // the swing doors to the ward, the corridor behind them
    K.door({ x: -0.8, z: zh - 0.12, axis: 'x', w: 1.6, double: true, name: 'ward' });
    K.room(-1.1, 1.1, WARD_Z1 + 0.24, zh - 0.24, { h: 3.0, floor: 'tile', wall: 'plaster', look: { ambient: 0.3, haze: 0.25 }, sides: { s: false, n: false } });
    K.lamp(0, FLOOR + 2.6, (WARD_Z1 + zh) / 2, { kind: 'bare', power: 0.32, ceilY: FLOOR + 3.0, cone: false });
    // ---- the ward (a long room, the beds' heads to its side walls, the aisle down its middle under
    // one pendant: the beds at the pool's edge, the far end in the dark with the night nurse's lamp)
    const wx0 = Math.max(x0, -4.6), wx1 = Math.min(x1, 4.6);
    K.room(wx0, wx1, z0, WARD_Z1, { h: 3.6, floor: 'lino', wall: 'plaster', look: { ambient: 0.26, haze: 0.4 }, sides: { s: { holes: [{ a: -0.8, b: 0.8, top: FLOOR + 2.2 }] } } });
    dado(wx0, wx1, z0, z0 + 0.03); dado(wx0, wx0 + 0.03, z0, WARD_Z1); dado(wx1 - 0.03, wx1, z0, WARD_Z1);
    dado(wx0, -0.85, WARD_Z1 - 0.03, WARD_Z1); dado(0.85, wx1, WARD_Z1 - 0.03, WARD_Z1);
    const BL = 2.05, BW = 0.95;
    const zs = []; for (let z = WARD_Z1 - 1.25; z > z0 + 2.4; z -= 2.5) zs.push(+z.toFixed(2));
    K.beds = [];
    for (const side of ['w', 'e']) {
      for (const z of zs) {
        const xa = side === 'w' ? wx0 + 0.06 : wx1 - 0.06 - BL, xb = xa + BL;
        bedX(K, xa, xb, z - BW / 2, z + BW / 2, side);
        // the chart on the foot rail
        const fx = side === 'w' ? xb + 0.02 : xa - 0.03;
        K.box('linen', fx, fx + 0.01, FLOOR + 0.62, FLOOR + 0.92, z - 0.12, z + 0.12, 3);
        K.beds.push({ side, z, xa, xb, x: (xa + xb) / 2 });
      }
    }
    // the lockers between the beds, a screen half round one bed
    for (const q of K.beds) if (q.z > z0 + 3.5) { const lz = q.z - 1.25; const xa = q.side === 'w' ? wx0 + 0.06 : wx1 - 0.5, xb = xa + 0.44; K.box('wood', xa, xb, FLOOR, FLOOR + 0.8, lz - 0.22, lz + 0.22, 1); K.solid(xa, xb, lz - 0.22, lz + 0.22); }
    const scr = K.beds.find((q) => q.side === 'w' && q.z === zs[2]) || K.beds[0];
    screen(K, scr.xb + 0.25, scr.z - 1.0, scr.z + 1.0);
    // a man asleep in the west row's second bed
    const sl = K.beds.find((q) => q.side === 'w' && q.z === zs[1]) || K.beds[0];
    sleeper(K, sl.xa, sl.z);
    // the night nurse's table at the ward's far end, her lamp low; the windows on the night
    const tz = z0 + 1.1;
    table(K, 0.9, tz, { w: 1.0, d: 0.7 });
    chair(K, 0.9, tz - 0.65, 0);
    K.lamp(1.1, FLOOR + 1.05, tz, { kind: 'pendant', power: 0.25, ceilY: FLOOR + 1.12, drop: 0.75 });
    litWindow(K, -1.9, FLOOR + 2.1, z0, { w: 1.0, h: 1.5, dir: 's' });
    litWindow(K, 2.6, FLOOR + 2.1, z0, { w: 1.0, h: 1.5, dir: 's' });
    // the one pendant over the aisle (the ward's one pool of light)
    K.lamp(0, FLOOR + 2.75, (zs[0] + zs[zs.length - 1]) / 2 + 1.2, { kind: 'pendant', power: 1.05, ceilY: FLOOR + 3.6 });
    // the beds: the wake's (the east row's first, by the door), a sleep in every free one
    const mine = K.beds.find((q) => q.side === 'e' && q.z === zs[0]);
    K.wakeBed = mine;
    K.seat({ name: 'wardbed', x: mine.xb - 0.55, z: mine.z, yaw: Math.PI / 2 - 0.45, eyeY: FLOOR + 1.1, pitch: 0.02, yawRange: [-1.7, 1.7], at: [mine.x, FLOOR + 0.62, mine.z], prompt: 'lie down', standAt: { x: mine.xa - 0.55, z: mine.z + 0.15, yaw: Math.PI / 2 }, tourAt: [mine.xa - 0.9, mine.z] });
    let toured = false;
    for (const q of K.beds) {
      if (q === sl || q === mine) continue;
      // (the tour tries one of them: a sleep is 4 s of black)
      const aisle = q.side === 'w' ? q.xb + 0.9 : q.xa - 0.9;
      K.use({ at: [q.x, FLOOR + 0.62, q.z], range: 2.6, cone: 0.42, prompt: 'sleep', onUse: () => wardSleep(s, P), tourAt: toured ? null : [aisle, q.z], tourSkip: toured });
      toured = true;
    }
    // ---- the outside (drawn with the street, K.outer): the ground floor's shop fronts of O1's block
    // faced over in pale stone (a hospital is not a tailor's), its frosted windows lit, the door
    // set back between two pilasters under a canopy, the globe over it, EMERGENCY, the name
    front(K, s);
    void rng; void sheet;
  },
  live(K, s, P) {
    const G = P.game;
    let amb = null;
    // the ambulance at the kerb: one of the city's cars (solid; a round finds it; a car shoves it)
    const park = () => {
      if (!G.vehicles || (amb && G.vehicles.list.includes(amb)) || (G.city && G.city.car === amb && amb)) return;
      try { amb = ambulance(G, s); } catch (e) { amb = null; }
    };
    park();
    return {
      step() { if (!amb || !G.vehicles.list.includes(amb)) park(); },
      enter() {},
      dispose() {
        if (amb && G.vehicles.list.includes(amb) && !(G.city && G.city.car === amb)) { G.vehicles.remove(amb); for (const m of amb._ownMats || []) m.dispose(); if (amb._ownTex) amb._ownTex.dispose(); }
        amb = null;
      },
    };
  },
  // the city's beat `hospital` (a fall in the street): in the ward's bed, 'Came round.', the stitches paid
  // (O4's fall.js: a tenth of the money, the gun kept); `ward` (CONTINUE after a sleep here): the bed, no bill
  wake(K, s, P, how) {
    const G = P.game;
    const S = K.seats.find((x) => x.name === 'wardbed');
    if (S) P.sit(s, S);
    // (the gun kept, under the coat: nothing is drawn in a bed)
    if (G.player.weapons.current && G.player.weapons.current !== 'fists') G.player.weapons.equip('fists');
    if (how === 'ward') { G.hud.message('Morning, near enough. The rain again.', 2.4); return; }
    P.woke = true;
    const r = fallWake(G, 'hospital');
    G.hud.message('Came round. ' + r.line.replace('The hospital. ', ''), 3.2);
  },
};

// the front: a stone face 0.42 m proud of the block's over its ground floor (O1's shop fronts and
// their signs behind it), the door's reveal, frosted windows, a canopy, the globe, the lettering
function front(K, s) {
  const b = s.lb, a0 = b.x0 + 0.05, a1 = b.x1 - 0.05, D = 0.42, top = FLOOR + 4.35, dw = 0.62;
  const P9 = (k, x0, x1, y0, y1, z0, z1) => K.box(k, x0, x1, y0, y1, z0, z1, 9);
  // the face, round the door's opening
  P9('stone', a0, -dw - 0.25, 0.1, top, 0.02, D);
  P9('stone', dw + 0.25, a1, 0.1, top, 0.02, D);
  P9('stone', -dw - 0.25, dw + 0.25, FLOOR + 2.3, top, 0.02, D);
  // the cornice, the plinth
  P9('black', a0 - 0.05, a1 + 0.05, top, top + 0.16, 0.0, D + 0.12);
  P9('black', a0, a1, 0.1, 0.42, D, D + 0.03);
  // the pilasters each side of the door
  for (const sg of [-1, 1]) P9('stone', sg > 0 ? dw + 0.05 : -dw - 0.45, sg > 0 ? dw + 0.45 : -dw - 0.05, 0.1, FLOOR + 2.9, D, D + 0.14);
  // the reveal (the door set back in the face): its two cheeks and its head
  P9('stone', dw, dw + 0.25, 0.1, FLOOR + 2.3, 0.02, D);
  P9('stone', -dw - 0.25, -dw, 0.1, FLOOR + 2.3, 0.02, D);
  // the step up into the reveal (walked)
  P9('stone', -dw - 0.25, dw + 0.25, 0.1, FLOOR, 0.0, D + 0.3);
  K.surface(-dw - 0.2, dw + 0.2, -0.05, D + 0.3, FLOOR, 0);
  // the canopy over the door: a dark slab on two iron rods
  P9('black', -dw - 0.7, dw + 0.7, FLOOR + 2.86, FLOOR + 2.98, D, D + 1.15);
  for (const sg of [-1, 1]) K.add('iron', new THREE.CylinderGeometry(0.012, 0.012, 1.4, 4).rotateX(-0.95).translate(sg * (dw + 0.55), FLOOR + 3.45, D + 0.6), 9);
  // the frosted windows (lit from inside: the reference's lit squares, and their streaks in the wet street)
  for (let x = a0 + 1.6; x < a1 - 1.2; x += 2.4) {
    if (Math.abs(x) < dw + 1.4) continue;
    P9('litDim', x - 0.55, x + 0.55, FLOOR + 1.0, FLOOR + 2.55, D + 0.005, D + 0.012);
    P9('black', x - 0.025, x + 0.025, FLOOR + 1.0, FLOOR + 2.55, D + 0.012, D + 0.03);
    P9('black', x - 0.55, x + 0.55, FLOOR + 1.9, FLOOR + 1.95, D + 0.012, D + 0.03);
    P9('black', x - 0.68, x + 0.68, FLOOR + 0.92, FLOOR + 1.0, D, D + 0.08);
  }
  // the face is solid to a man on the pavement (its door's gap open)
  K.solid(a0, -dw - 0.05, 0.0, D + 0.1, { tag: 'wall' });
  K.solid(dw + 0.05, a1, 0.0, D + 0.1, { tag: 'wall' });
  // the globe over the door on its bracket, its light in the street's deal
  K.box('iron', -0.03, 0.03, FLOOR + 3.2, FLOOR + 3.26, D, D + 0.62, 9);
  K.box('iron', -0.02, 0.02, FLOOR + 3.02, FLOOR + 3.22, D + 0.56, D + 0.6, 9);
  const g = K.lamp(0, FLOOR + 2.92, D + 0.58, { kind: 'outside', power: 1.6 });
  g.bulb.geometry.dispose(); g.bulb.geometry = new THREE.SphereGeometry(0.17, 18, 12);
  K.outer.add(g.bulb);
  label(K, 'EMERGENCY', 0, FLOOR + 2.58, D + 0.01, { w: 1.5, h: 0.28, dir: 's', lit: true, outer: true });
  label(K, 'CITY  HOSPITAL', 0, FLOOR + 3.75, D + 0.01, { w: Math.min(5.0, a1 - a0 - 1), h: 0.5, dir: 's', dark: true, outer: true });
}

// [O5b] after the critic (B3: a free bed cleared heat 2 in four seconds, gunmen at the door): a ward's
// bed is a sleep, a save and a mend at heat 0 only; with the law on me the night nurse says no
// (the heat is lost the city's way: out of their sight, a change of car, time)
function wardSleep(s, P) {
  const G = P.game, h = G.police ? G.police.heat || 0 : 0;
  if (h > 0) { G.sfx.play('paperTouch', null, {}, { ref: 1 }); G.hud.message('Not with the law on your heels.', 2.0); G.emit('ward:refused', { heat: h }); return; }
  P.sleepAt('ward');
}

// E at the desk: the nurse's word (after a wake: the bill; else the night's)
function nurse(s, P) {
  const G = P.game;
  G.sfx.play('paperTouch', null, {}, { ref: 1 });
  if (s.state.sore) { G.hud.message('She will not look at you.', 1.8); return; }
  if (P.woke) { P.woke = false; G.hud.message('Paid. Mind the stitches.', 2.0); return; }
  const lines = ['Nobody by that name tonight.', 'You look like you need a bed. We have one.', 'Wait your turn.'];
  s.state.nurseN = ((s.state.nurseN ?? -1) + 1) % lines.length;
  G.hud.message(lines[s.state.nurseN], 2.0);
}

// an iron bed with its long side along x, its head to the wall at 'w' (x0) or 'e' (x1)
function bedX(K, x0, x1, z0, z1, head = 'w') {
  const y = FLOOR;
  K.box('iron', x0, x1, y + 0.28, y + 0.36, z0, z1, 1);
  K.box('linen', x0 + 0.04, x1 - 0.04, y + 0.36, y + 0.56, z0 + 0.04, z1 - 0.04, 1);
  K.box('cloth', head === 'w' ? x0 + 0.6 : x0 + 0.02, head === 'w' ? x1 - 0.02 : x1 - 0.6, y + 0.5, y + 0.6, z0 + 0.02, z1 - 0.02, 1);
  const hx = head === 'w' ? x0 : x1;
  K.box('linen', head === 'w' ? x0 + 0.08 : x1 - 0.48, head === 'w' ? x0 + 0.48 : x1 - 0.08, y + 0.56, y + 0.68, z0 + 0.15, z1 - 0.15, 1);
  for (const x of [x0, x1 - 0.04]) for (const z of [z0, z1 - 0.04]) K.box('iron', x, x + 0.04, y, y + (Math.abs(x - hx) < 0.1 ? 1.1 : 0.7), z, z + 0.04, 1);
  K.box('iron', hx - 0.02, hx + 0.02, y + 0.95, y + 1.0, z0, z1, 1);
  K.solid(x0, x1, z0, z1);
}
// a trolley along the wall: an iron frame on four small wheels, a folded sheet
function trolley(K, x, z0, z1) {
  const w = 0.62, za = Math.min(z0, z1) - 2.0, zb = Math.max(z0, z1);
  K.box('iron', x - w / 2, x + w / 2, FLOOR + 0.78, FLOOR + 0.82, za, zb, 1);
  K.box('linen', x - w / 2 + 0.03, x + w / 2 - 0.03, FLOOR + 0.82, FLOOR + 0.9, za + 0.05, zb - 0.05, 1);
  for (const [a, c] of [[-1, za + 0.1], [1, za + 0.1], [-1, zb - 0.1], [1, zb - 0.1]]) {
    K.box('iron', x + a * (w / 2 - 0.04) - 0.015, x + a * (w / 2 - 0.04) + 0.015, FLOOR + 0.08, FLOOR + 0.8, c - 0.015, c + 0.015, 1);
    K.add('black', new THREE.CylinderGeometry(0.06, 0.06, 0.03, 12).rotateZ(Math.PI / 2).translate(x + a * (w / 2 - 0.04), FLOOR + 0.06, c), 1);
  }
}
// a folding screen: three linen panels in iron frames, angled
function screen(K, x, za, zb) {
  const n = 3, L = (zb - za) / n;
  for (let i = 0; i < n; i++) {
    const a = za + i * L, c = a + L, off = (i % 2) * 0.12;   // (panels along z at x, zig-zagged)
    K.box('linen', x - 0.015 + off, x + 0.015 + off, FLOOR + 0.2, FLOOR + 1.75, a + 0.03, c - 0.03, 1);
    K.box('iron', x - 0.02 + off, x + 0.02 + off, FLOOR, FLOOR + 1.8, a, a + 0.03, 1);
  }
  K.solid(x - 0.06, x + 0.18, za, zb);
}
// a man asleep: the blanket over his shoulders and knees, his head turned on the pillow
function sleeper(K, xa, z) {
  const y = FLOOR + 0.6;
  K.add('cloth', new THREE.SphereGeometry(1, 20, 12).scale(0.62, 0.17, 0.36).translate(xa + 1.05, y, z), 1);
  K.add('cloth', new THREE.SphereGeometry(1, 16, 10).scale(0.42, 0.13, 0.3).translate(xa + 1.6, y, z + 0.04), 1);
  K.add('leather', new THREE.SphereGeometry(0.11, 16, 12).scale(1.15, 0.9, 1).translate(xa + 0.36, y + 0.17, z - 0.03), 1);
  K.add('linen', new THREE.SphereGeometry(0.06, 10, 8).translate(xa + 0.42, y + 0.15, z + 0.08), 1);
}

// the ambulance: the city's lorry, its box painted pale, AMBULANCE and a cross on each side,
// a bell lamp on the cab's roof; parked at the kerb before the door
function ambulance(G, s) {
  const p = s.frame.w(5.4, 5.0);
  const v = G.vehicles.spawn('truck', { at: new THREE.Vector3(p.x, 0, p.z), yaw: s.frame.yaw(Math.PI / 2), lights: false });
  v.driver = null;
  const M = G.stage.M, paint = M.paintGrey || M.paint;
  let body = null;
  v.body.traverse((o) => { if (o.isMesh && o.material === paint && !body) body = o; });
  if (body) { const m = body.material.clone(); m.color.setScalar(0.85); m.roughness = 0.5; body.material = m; v._ownMats = [m]; }
  // the lettering (a canvas: the cross and the word), one plane each side of the box
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#c9c6be'; g.fillRect(0, 0, 512, 128);
  g.fillStyle = '#0c0c0c';
  g.fillRect(28, 50, 72, 28); g.fillRect(50, 28, 28, 72);
  g.font = `700 64px ${LETTER_FONT}`; g.textBaseline = 'middle'; g.fillText('AMBULANCE', 122, 68, 370);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, metalness: 0 });
  v._ownMats = [...(v._ownMats || []), mat]; v._ownTex = tex;
  const ink = body ? body.userData.inkId : undefined;
  for (const sg of [-1, 1]) {
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.85), mat);
    pl.position.set(-1.4, 2.2, sg * 1.195);
    if (sg < 0) pl.rotation.y = Math.PI;
    pl.userData.inkId = ink; pl.userData.inkFigure = true;
    v.body.add(pl);
  }
  // the bell lamp on the cab (dark: nobody is being driven anywhere tonight)
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.16, 14), M.rubber || paint);
  lamp.position.set(1.35, 2.68, 0); lamp.userData.inkId = ink; lamp.userData.inkFigure = true;
  v.body.add(lamp);
  v.ambulance = true;
  // [O5b] after the critic (B1: E took it, and its seat looked into the box - the lorry has no cab
  // view to drive by): locked. E at it tries the door - the rattle, 'locked' (city.js) - until O2's
  // ambulance comes with a seat that sees
  v.locked = true;
  return v;
}

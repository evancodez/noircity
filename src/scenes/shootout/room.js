import * as THREE from 'three';
import { SITE, DINER, stoolZ } from './site.js';
import { buildProp } from '../../props/index.js';
import { steady } from '../../cast/diner/steady.js';
import { allocInkId } from '../../render/layers.js';
import { roundedBox, merge } from '../../world/geom.js';

// The diner as scene 9 finds it (B7): after the fight, an hour on. The
// window Mack went through is still out, the rain comes in over that
// booth; his stool is over; Dot alone behind the counter; the others gone,
// a paper left on a table, a cup still steaming. And the scene's own
// things: the switch by the door, the reserve of drums, the room's lights,
// dying (black, and back at the start of the beat, the room as it was).
// (no default export: not a scene)
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// the story's window (scene 2's: the save's flag, else B4)
export function mackWindow(G) {
  const w = G && G.save && G.save.flags && G.save.flags.window;
  return w === 'B2' ? 'B2' : 'B4';
}

// the room fresh (the scene entered, a jump): as scene 2 left it
export function freshRoom(ctx) {
  const { stage, cast, game: G } = ctx;
  const d = stage.part('diner'), front = stage.part('dinerFront');
  cast.clear();
  d.reset();
  if (stage.glass.clearShards) stage.glass.clearShards();
  for (const p of Object.values(front.panes)) stage.glass.restore(p);
  for (const n of ['B2', 'B4']) if (front.closeBay) front.closeBay(n);
  // Mack's window: gone, the wall open there
  const w = mackWindow(G);
  const pane = front.panes[w];
  if (G) stage.glass.shatter(pane, { dir: V(1, 0.15, 0), power: 2, by: 'body', at: V(DINER.faceX - 0.1, 1.5, DINER.finish[w].z) });
  if (front.openBay) front.openBay(w);
  if (G && G.sfx && G.sfx.roomOpen) G.sfx.roomOpen(0.5);
  // his stool over, the room left as they ran
  d.stool(DINER.brawlerStool).topple(V(1, 0, -0.3));
  d.take('plate.mack'); d.take('fork.mack'); d.take('knife.mack');
  d.take('beer.mack');
  d.take('menu.5');
  // the old man's paper on the booth's table, his cup still steaming on the counter
  d.take('paper.8');
  const booth = d.booths && d.booths[0];
  if (booth) d.place('newspaper', V(-11.45, DINER.booths.tableY + DINER.floorY + 0.02, booth.z - 0.1), { name: 'b7.paper', yaw: 0.9 });
  d.jukebox.slot = d.jukebox.slot || null;
  backBarBottles(ctx, d);
  return d;
}

// bottles standing along the back bar's working top and its first shelf:
// what a round into the room finds and bursts (the bar's own painted rows
// stand behind them)
const BOTTLES = [];
export function backBarBottles(ctx, d) {
  const { stage } = ctx;
  clearBottles(stage);
  const x = DINER.backX + 0.3, top = DINER.floorY + 0.95, shelf = 1.52;
  const V = ['rye', 'gin', 'scotch', 'beer', 'rye', 'gin'];
  let k = 0;
  for (const [z, y] of [[-3.1, top], [-2.4, shelf], [-1.2, top], [-0.4, shelf], [0.3, top], [1.3, shelf], [2.2, shelf], [4.2, shelf], [5.0, top], [6.3, shelf], [7.4, top], [7.9, shelf]]) {
    const name = 'b7.bottle' + k;
    const o = d.place('bottle', new THREE.Vector3(x + (k % 2) * 0.08, y, z), { name, variant: V[k % V.length] === 'scotch' ? 'rye' : V[k % V.length], yaw: k * 1.3 });
    const h = stage.breakables.add(o, { kind: 'bottle', hp: 1, solid: false });
    BOTTLES.push({ name, h });
    k++;
  }
}
export function clearBottles(stage) {
  const d = stage.part('diner');
  for (const b of BOTTLES) { d.take(b.name); stage.breakables.remove(b.h); }
  BOTTLES.length = 0;
}

// Dot behind the counter, opposite the door
export function placeDot(ctx, state = 'lean') {
  const { cast } = ctx;
  let dot = cast.get('dot');
  if (!dot) {
    dot = cast.spawn('waitress', { at: { x: SITE.dot.x, z: SITE.dot.z }, yaw: Math.PI / 2 });
    steady(dot.fig);
  }
  dot.place({ x: SITE.dot.x, z: SITE.dot.z }, Math.PI / 2);
  dot.setState(state);
  return dot;
}

// ---- the Tommy gun and its drums, as things on the counter -------------------------
let GUN_GEO = null, DRUM_GEO = null, GUN_MAT = null;
export function gunGeometries(build) {
  if (!GUN_GEO) {
    GUN_GEO = build.gun();
    DRUM_GEO = build.drum();
    GUN_MAT = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.55, metalness: 0.35 });
  }
  return { gun: GUN_GEO, drum: DRUM_GEO, mat: GUN_MAT };
}

// the counter's things of this scene: the gun lying on its side along the
// counter (muzzle down the room, -z), two drums standing by it
export function makeCounterGun(stage, build) {
  const { gun, drum, mat } = gunGeometries(build);
  const g = new THREE.Group();
  g.name = 'b7.gun';
  const m = new THREE.Mesh(gun, mat);
  // on its left side: its right (+x) up
  m.rotation.set(0, 0, Math.PI / 2);
  m.updateMatrix();
  const box = new THREE.Box3().setFromBufferAttribute(gun.getAttribute('position')).applyMatrix4(m.matrix);
  m.position.y = -box.min.y;
  g.add(m);
  const id = allocInkId();
  m.userData.inkId = id;
  m.castShadow = true; m.receiveShadow = true;
  g.userData.mesh = m;
  // the drums: two, lying flat one on the other (a stack her hand carries by
  // the rims), the winding keys up; the stack's origin at its foot
  const stack = new THREE.Group();
  stack.name = 'b7.drums';
  const sid = allocInkId();
  for (let i = 0; i < 2; i++) {
    const dm = new THREE.Mesh(drum, mat);
    dm.rotation.set(0, i * 0.9, Math.PI / 2);
    dm.position.set(0, 0.025 + i * 0.063, 0);
    dm.userData.inkId = sid;
    dm.castShadow = true;
    stack.add(dm);
  }
  return { group: g, mesh: m, stack, drums: [stack] };
}

// ---- the switch by the door ------------------------------------------------------------
export function makeSwitch(stage) {
  const M = stage.M;
  const g = new THREE.Group();
  g.name = 'b7.switch';
  const plate = new THREE.Mesh(roundedBox(0.016, 0.13, 0.085, 0.006, 2), new THREE.MeshStandardMaterial({ color: 0x5a5a5a, roughness: 0.4, metalness: 0.6 }));
  const tog = new THREE.Mesh(roundedBox(0.03, 0.03, 0.012, 0.005, 2).translate(-0.015, 0.0, 0), M.chrome || plate.material);
  const lever = new THREE.Group();
  lever.add(tog);
  g.add(plate, lever);
  g.position.set(SITE.switch.x, SITE.switch.y, SITE.switch.z);
  const id = allocInkId();
  for (const o of [plate, tog]) { o.userData.inkId = id; o.userData.noRay = true; }
  g.userData.lever = lever;
  const set = (on) => { lever.rotation.z = on ? 0.35 : -0.35; };
  set(true);
  g.userData.set = set;
  return g;
}

// the room's lights: the pendants (their pool light, cone and bulb) off, or
// back on; the room's painted light (the sconce, the jukebox's glow) stays
export function setRoomLights(stage, on) {
  const d = stage.part('diner');
  for (const l of d.lamps) {
    if (!l._b7) l._b7 = { cone: l.dipBase.cone, light: l.dipBase.light };
    if (l.dead) continue;
    l.dipBase.cone = on ? l._b7.cone : 0;
    l.dipBase.light = on ? l._b7.light : 0;
    l.on = !!on && !!d.near;
    if (l.bulb) l.bulb.visible = !!on;
  }
}
export function restoreRoomLights(stage) {
  const d = stage.part('diner');
  for (const l of d.lamps) if (l._b7) { l.dipBase.cone = l._b7.cone; l.dipBase.light = l._b7.light; delete l._b7; if (l.bulb) l.bulb.visible = true; }
}

// ---- the HUD: the drums I carry, beside the ammo -----------------------------------------
export function reserveLayer(hud) {
  const L = hud.layer('b7ammo');
  if (!L.firstChild) {
    L.innerHTML = '<div class="b7res" style="position:absolute;right:40px;bottom:108px;display:flex;gap:8px;flex-direction:row-reverse"></div>'
      + '<div class="b7hint" style="position:absolute;right:38px;bottom:92px;font:13px \'American Typewriter\',Courier,monospace;letter-spacing:0.3em;color:#d8d8d8;text-shadow:0 0 3px #000;text-transform:uppercase;display:none"></div>';
  }
  const res = L.querySelector('.b7res'), hint = L.querySelector('.b7hint');
  let last = null;
  return {
    set(n, show, note) {
      const key = n + '/' + show + '/' + note;
      if (key === last) return;
      last = key;
      L.style.display = show ? '' : 'none';
      res.innerHTML = '';
      for (let i = 0; i < n; i++) {
        const c = document.createElement('canvas');
        c.width = 22; c.height = 22;
        const g = c.getContext('2d');
        g.fillStyle = '#e8e6e0';
        g.beginPath(); g.arc(11, 11, 8.5, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#111';
        g.beginPath(); g.arc(11, 11, 3.2, 0, Math.PI * 2); g.fill();
        c.style.cssText = 'width:18px;height:18px;filter:drop-shadow(0 0 2px #000)';
        res.appendChild(c);
      }
      hint.textContent = note || '';
      hint.style.display = note ? '' : 'none';
    },
  };
}

export { V, stoolZ };

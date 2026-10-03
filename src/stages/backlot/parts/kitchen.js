import * as THREE from 'three';
import { holeyPanel } from '../kit.js';
import { arch } from '../arch.js';
import { lathe, tube, V3, roundedBox, merge } from '../../../world/geom.js';
import { accentMaterial } from '../../../render/accents.js';
import { Steam } from '../../../fx/Steam.js';
import { KITCHEN, LOADING, YARD, LANES, FLOOR, KDOOR } from '../plan.js';

// The kitchen behind the washing yard (lane C6): the back of a restaurant on
// the ground floor of a two-storey block. Two back doors in its south wall,
// one at the head of each lane of the yard (the leaves are things.js's: one
// he slams, one locked); the roller door in its north wall, half down (the
// shutter is things.js's: slid under). Inside: the ranges along the west
// wall with a fire door open (the only colour: fire), the sinks along the
// east, the long table down the middle, pans on racks, steam; one lamp over
// the table. Outside, the lamps over the doors throw their light down the
// lanes through the washing, and a caged bulb over the roller door lights
// the loading yard.
export default {
  name: 'kitchen', order: 62,
  build(stage) {
    const A = arch(stage, 6262);
    const { MAT, K, face, fbox, facade, mass } = A;
    const KI = KITCHEN, T = 0.3, CEIL = FLOOR;
    const api = { MAT };
    // ---- the shell: four walls (holes for the doors), the ceiling, the floor above
    const dW = KI.doors.W, dE = KI.doors.E, R = KI.roll;
    holeyPanel(K, 'kitchen', MAT.brickDark, 'z', KI.z1 - T, KI.z1, KI.x0, KI.x1, 0, KI.h, [[dW.x - dW.w / 2, dW.x + dW.w / 2, 0, dW.h], [dE.x - dE.w / 2, dE.x + dE.w / 2, 0, dE.h]]);
    holeyPanel(K, 'kitchen', MAT.brickDark, 'z', KI.z0, KI.z0 + T, KI.x0, KI.x1, 0, KI.h, [[R.x - R.w / 2, R.x + R.w / 2, 0, R.h]]);
    K.box('kitchen', MAT.brickDark, KI.x0, KI.x0 + T, 0, KI.h, KI.z0 + T, KI.z1 - T);
    // ([C6 2nd] the east wall: the iron door into the press hall's back in it)
    holeyPanel(K, 'kitchen', MAT.brickDark, 'x', KI.x1 - T, KI.x1, KI.z0 + T, KI.z1 - T, 0, KI.h, [[KDOOR.z - KDOOR.w / 2, KDOOR.z + KDOOR.w / 2, 0, KDOOR.h]]);
    K.box('kitchen', MAT.brickDark, KI.x0, KI.x1, KI.h - 0.3, KI.h, KI.z0, KI.z1);
    // (the ceiling of the ground floor; the floor above is the block's)
    K.box('kitchenIn', MAT.plaster, KI.x0 + T, KI.x1 - T, CEIL, CEIL + 0.25, KI.z0 + T, KI.z1 - T);
    // the walls' colliders, with the doorways open (the leaves are things)
    const col = (x0, x1, z0, z1) => K.collide(x0, x1, z0, z1, 'wall');
    col(KI.x0, dW.x - dW.w / 2, KI.z1 - T, KI.z1);
    col(dW.x + dW.w / 2, dE.x - dE.w / 2, KI.z1 - T, KI.z1);
    col(dE.x + dE.w / 2, KI.x1, KI.z1 - T, KI.z1);
    col(KI.x0, R.x - R.w / 2, KI.z0, KI.z0 + T);
    col(R.x + R.w / 2, KI.x1, KI.z0, KI.z0 + T);
    col(KI.x0, KI.x0 + T, KI.z0, KI.z1);
    col(KI.x1 - T, KI.x1, KI.z0, KDOOR.z - KDOOR.w / 2);
    col(KI.x1 - T, KI.x1, KDOOR.z + KDOOR.w / 2, KI.z1);
    A.doorFrame('kitchen', face('x', KI.x1 - T, -1), KDOOR.z, KDOOR.w, KDOOR.h);
    // the outer faces: the south (on the yard), the north (on the loading yard)
    const Fs = face('z', KI.z1, 1), Fn = face('z', KI.z0, -1);
    facade('kitchen', Fs, KI.x0, KI.x1, KI.h, { bay: 2.9, from: 1, litP: 0.2, skip: [[57.5, 62.5]] });
    facade('kitchen', Fn, KI.x0, KI.x1, KI.h, { bay: 2.9, from: 1, litP: 0.15 });
    A.doorFrame('kitchen', Fs, dW.x, dW.w, dW.h);
    A.doorFrame('kitchen', Fs, dE.x, dE.w, dE.h);
    // (the roller door's box over the opening, its guides)
    fbox('kitchen', MAT.metal, Fn, R.x - R.w / 2 - 0.15, R.x + R.w / 2 + 0.15, R.h, R.h + 0.42, 0, 0.32);
    for (const s of [-1, 1]) fbox('kitchen', MAT.metal, Fn, R.x + s * (R.w / 2 + 0.04) - 0.05, R.x + s * (R.w / 2 + 0.04) + 0.05, 0, R.h, 0, 0.1);
    // small windows of the kitchen on the yard, lit from inside (a steamy pane)
    for (const x of [51.6, 58.0, 62.0, 68.4]) {
      fbox('kitchen', MAT.lit, Fs, x - 0.45, x + 0.45, 1.5, 2.3, -0.12, -0.1);
      fbox('kitchen', MAT.trim, Fs, x - 0.55, x + 0.55, 1.42, 1.5, 0, 0.12);
    }
    // ---- inside -------------------------------------------------------------------------
    // the floor: tiles (a lighter, glossier ground)
    {
      const g = new THREE.PlaneGeometry(KI.x1 - KI.x0 - 2 * T, KI.z1 - KI.z0 - 2 * T).rotateX(-Math.PI / 2).translate((KI.x0 + KI.x1) / 2, 0.004, (KI.z0 + KI.z1) / 2);
      K.add('kitchenFloor', MAT.tile, g, { cast: false });
    }
    // the ranges along the west wall: three black iron stoves, a hood over them
    const g = 'ranges';
    for (const z of [-96.8, -92.6, -88.4]) {
      K.add(g, MAT.iron, roundedBox(1.1, 0.88, 3.4, 0.04, 2).translate(KI.x0 + T + 0.56, 0.44, z));
      K.add(g, MAT.metal, roundedBox(1.14, 0.06, 3.44, 0.02, 1).translate(KI.x0 + T + 0.57, 0.9, z));
      // pots on them
      for (const dz of [-0.9, 0.7]) K.add(g, MAT.metal, lathe([[0, 0], [0.2, 0], [0.22, 0.02], [0.22, 0.3], [0.24, 0.32], [0, 0.32]], 18).translate(KI.x0 + T + 0.55, 0.93, z + dz));
      stage.colliders.addBox(KI.x0 + T + 0.56, z, 0.58, 1.72, 0, 'stove');
    }
    // ([C6 2nd] the hood over the ranges: a sloped sheet of tin from the wall
    // out over the stoves, its lip a bright line, its flue up into the ceiling)
    {
      const sh = new THREE.Shape();
      sh.moveTo(0, 3.25); sh.lineTo(0.5, 3.25); sh.lineTo(1.62, 2.38); sh.lineTo(1.62, 2.22); sh.lineTo(1.54, 2.22); sh.lineTo(0.46, 3.1); sh.lineTo(0, 3.1);
      const hood = new THREE.ExtrudeGeometry(sh, { depth: 12.0, bevelEnabled: false }).translate(0, 0, -6.0).translate(KI.x0 + T, 0, -92.6);
      K.add(g, MAT.metal, hood);
      const lip = new THREE.BoxGeometry(0.06, 0.05, 12.0).translate(KI.x0 + T + 1.6, 2.24, -92.6);
      K.add('rangesLip', new THREE.MeshStandardMaterial({ color: 0xb8b8b8, metalness: 0.6, roughness: 0.3, envMap: stage.M.envSoft, envMapIntensity: 1.0 }), lip);
      for (const z of [-95.4, -89.8]) K.add(g, MAT.metal, new THREE.CylinderGeometry(0.22, 0.22, CEIL - 3.2, 14).translate(KI.x0 + T + 0.3, 3.2 + (CEIL - 3.2) / 2, z));
    }
    // the fire door of the middle stove, open: the coals (fire, the only colour)
    {
      const fire = accentMaterial('fire', { gain: 1.4 });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.22).rotateY(Math.PI / 2).translate(KI.x0 + T + 1.115, 0.42, -92.6), fire);
      m.userData.noRay = true;
      stage.scene.add(m);
      api.fire = m;
    }
    // the sinks along the east wall, a drainer, shelves of plates over them
    // ([C6 2nd] clear of the iron door in the north-east corner)
    for (const z of [-93.9, -90.2, -86.5]) {
      K.add('sinks', MAT.tile, roundedBox(0.8, 0.9, 2.6, 0.03, 2).translate(KI.x1 - T - 0.42, 0.45, z));
      stage.colliders.addBox(KI.x1 - T - 0.42, z, 0.42, 1.32, 0, 'sink');
      K.box('sinks', MAT.woodDark, KI.x1 - T - 0.36, KI.x1 - T, 1.7, 1.75, z - 1.2, z + 1.2);
      K.box('sinks', MAT.woodDark, KI.x1 - T - 0.36, KI.x1 - T, 2.2, 2.25, z - 1.2, z + 1.2);
    }
    // the long table down the middle (steel-topped, on legs), pans on it
    {
      const t = KI.table;
      K.add('table', MAT.metal, roundedBox(t.x1 - t.x0, 0.06, t.z1 - t.z0, 0.02, 1).translate((t.x0 + t.x1) / 2, 0.9, (t.z0 + t.z1) / 2));
      for (const x of [t.x0 + 0.1, (t.x0 + t.x1) / 2, t.x1 - 0.1]) for (const z of [t.z0 + 0.1, t.z1 - 0.1]) K.box('table', MAT.metal, x - 0.03, x + 0.03, 0, 0.88, z - 0.03, z + 0.03);
      K.box('table', MAT.woodDark, t.x0 + 0.1, t.x1 - 0.1, 0.24, 0.27, t.z0 + 0.1, t.z1 - 0.1);
      for (const [x, z] of [[56.4, -92.0], [58.6, -92.8], [61.8, -92.2], [63.6, -92.9]]) K.add('table', MAT.metal, lathe([[0, 0], [0.16, 0], [0.17, 0.12], [0, 0.12]], 16).translate(x, 0.93, z));
      stage.colliders.addBox((t.x0 + t.x1) / 2, (t.z0 + t.z1) / 2, (t.x1 - t.x0) / 2, (t.z1 - t.z0) / 2, 0, 'table');
    }
    // a pass-through to the dining room in the west half of the north wall (a
    // dark opening with a shelf: the restaurant beyond, shut)
    K.box('kitchenIn', MAT.woodDark, 51.4, 54.6, 1.05, 1.1, KI.z0 + T, KI.z0 + T + 0.4);
    K.box('kitchenIn', MAT.black, 51.4, 54.6, 1.1, 2.0, KI.z0 + T - 0.02, KI.z0 + T);
    // the walls: white tiles to the shoulder (they catch the one lamp), the
    // plaster above gone grey with steam
    {
      const y1 = 1.55, t = 0.02;
      // ([C6 2nd] the tiles as tiles: white squares, the grout dark between,
      // glazed - each lamp a hard highlight on them)
      const wallTile = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, map: tileTexture(), roughness: 0.22, envMap: stage.M.envSoft, envMapIntensity: 0.7 });
      const band = (x0, x1, z0, z1) => K.box('kitchenTile', wallTile, x0, x1, 0.02, y1, z0, z1, 1 / 1.2);
      const zi1 = KI.z1 - T, zi0 = KI.z0 + T, xi0 = KI.x0 + T, xi1 = KI.x1 - T;
      // south wall (the doors), north wall (the roller door, the hatch)
      band(xi0, dW.x - dW.w / 2 - 0.12, zi1 - t, zi1); band(dW.x + dW.w / 2 + 0.12, dE.x - dE.w / 2 - 0.12, zi1 - t, zi1); band(dE.x + dE.w / 2 + 0.12, xi1, zi1 - t, zi1);
      band(xi0, 51.3, zi0, zi0 + t); band(54.7, R.x - R.w / 2 - 0.1, zi0, zi0 + t); band(R.x + R.w / 2 + 0.1, xi1, zi0, zi0 + t);
      band(xi0, xi0 + t, zi0, zi1); band(xi1 - t, xi1, zi0, KDOOR.z - KDOOR.w / 2 - 0.12); band(xi1 - t, xi1, KDOOR.z + KDOOR.w / 2 + 0.12, zi1);
      // (the tiles' top course: a dark edge - [C6 4th] cut round the doors and
      // the hatch, as the tiles are: it ran across both yard doors and the
      // roller door, a dark bar at chest height through every doorway)
      const course = (x0, x1, z0, z1) => K.box('kitchenTile', MAT.woodDark, x0, x1, y1, y1 + 0.04, z0, z1);
      course(xi0, dW.x - dW.w / 2 - 0.12, zi1 - 0.03, zi1); course(dW.x + dW.w / 2 + 0.12, dE.x - dE.w / 2 - 0.12, zi1 - 0.03, zi1); course(dE.x + dE.w / 2 + 0.12, xi1, zi1 - 0.03, zi1);
      course(xi0, 51.3, zi0, zi0 + 0.03); course(54.7, R.x - R.w / 2 - 0.1, zi0, zi0 + 0.03); course(R.x + R.w / 2 + 0.1, xi1, zi0, zi0 + 0.03);
      // pans hung from a rail over the table
      for (let x = 56; x <= 64; x += 1.0) K.add('table', MAT.metal, lathe([[0, 0], [0.14, 0], [0.15, 0.09], [0, 0.09]], 14).rotateX(Math.PI / 2).translate(x, 2.25, -91.75));
      K.add('table', MAT.iron, tube([V3(55.6, 2.42, -91.75), V3(64.4, 2.42, -91.75)], 0.02, 6, 2));
      // ([C6 2nd] the plates on the shelves over the sinks: white, on edge, catching the light)
      const china = new THREE.MeshStandardMaterial({ color: 0xe4e4e4, roughness: 0.28, emissive: 0x141414, envMap: stage.M.envSoft, envMapIntensity: 0.5 });
      const plates = [];
      for (const zc of [-93.9, -90.2, -86.5]) for (const y of [1.75, 2.25]) for (let z = zc - 1.05; z < zc + 1.1; z += 0.13) plates.push(new THREE.CylinderGeometry(0.115, 0.115, 0.018, 18).rotateX(Math.PI / 2).rotateY(Math.PI / 2).rotateZ(0.18).translate(xi1 - 0.16, y + 0.12, z));
      K.add('china', china, merge(plates), { figure: true });
    }
    // the lamp: a shade over the table (the one light), and the stove's glow
    const L = stage.part('lamps');
    // (two shades over the long table: two pools on the steel and the tiles, the corners in ink)
    api.lamp = L.hang(57.0, CEIL - 0.1, -92.4, { real: true });
    api.lamp2 = L.hang(63.0, CEIL - 0.1, -92.4, { real: true });
    if (api.lamp2.light) { api.lamp2.light.intensity = 150; api.lamp2.light.angle = 0.95; api.lamp2.light.penumbra = 0.8; }
    if (api.lamp.light) { api.lamp.light.intensity = 170; api.lamp.light.angle = 0.95; api.lamp.light.penumbra = 0.8; }
    // ([C6 2nd] a bulb over the iron door: the way out of the kitchen lit)
    // ([C6 4th] brighter: the brightest thing in the room, the way out)
    api.doorLamp = L.wall(KI.x1 - T, 2.75, KDOOR.z + 0.95, -1, 0, { out: 0.45, strength: 1.5 });
    // ([C6 4th] a lamp under the hood over the ranges: the west half was flat
    // dark grey - now the stove tops and the pots catch it, the corridor
    // beside them a pool, the rest ink)
    api.hoodLamp = L.wall(KI.x0 + T, 2.05, -91.0, 1, 0, { out: 0.25, strength: 0.8, half: 0.6 });
    // steam off the pots
    api.steam = new Steam(stage, [V3(KI.x0 + T + 0.55, 1.25, -93.5), V3(KI.x0 + T + 0.55, 1.25, -89.1)], 10);
    // the kitchen's Look: dark round its one lamp
    stage.addLook(new THREE.Box3(V3(KI.x0 + T, -1, KI.z0 + T), V3(KI.x1 - T, CEIL, KI.z1 - T)), { ambient: 0.15, exposure: 1.1, rainOverlay: 0.0, haze: 0.3, room: 'kitchen' });
    stage.dry.push(new THREE.Box3(V3(KI.x0, 0, KI.z0), V3(KI.x1, KI.h, KI.z1)));
    // ---- outside: the floods over the back doors down the lanes, the bulb over the roller door
    // (low over each door, aimed down its lane through the washing: the
    // sheets glow with it, and a man between the lamp and a sheet is his own
    // shadow on it)
    api.floods = {};
    for (const side of ['W', 'E']) {
      const d = KI.doors[side];
      // ([C6 3rd] its visible beam fainter and shorter: looking up a lane into
      // it the whole frame went to a grey fog; the light on the sheets is as it was)
      const l = L.wall(d.x, 2.75, KI.z1, 0, 1, { out: 4.2, half: 0.36, strength: 0.5, height: 18 });
      l.light.intensity = 900;
      l.light.penumbra = 0.5;
      l.light.angle = 0.42;
      l.shadowRadius = 1.5;
      const ln = LANES[side];
      l.keen = (c) => c.x > ln.x0 - 2 && c.x < ln.x1 + 2 && c.z > KI.z1 && c.z < YARD.z1 + 4;
      api.floods[side] = l;
    }
    // ([C6 3rd] a bulb on a bracket beside each back door, down on its leaf
    // and its step: the door at the head of the lane is the lit thing there,
    // not a dark corner under the flood - the slammed one plain to run at, the
    // locked one's padlock and chain catching it)
    api.doorLamps = {};
    for (const side of ['W', 'E']) {
      const d = KI.doors[side];
      api.doorLamps[side] = L.wall(d.x - d.w / 2 - 0.55, 2.62, KI.z1, 0, 1, { out: 0.2, strength: 0.85, half: 0.66 });
    }
    api.rollLamp = L.wall(R.x + 2.2, 3.9, KI.z0, 0, -1, { out: 0.4, strength: 1.0 });
    // the yard at night: the sky's grey off the walls, the washing the lit thing in it
    stage.addLook(new THREE.Box3(V3(YARD.x0 - 3.5, -1, KI.z1), V3(YARD.x1, 30, YARD.z1 + 1.5)), {
      // ([C6 3rd] less haze: looking up a lane into its flood the yard was a grey fog)
      ambient: 0.12, exposure: 1.05, fogDensity: 0.0026, fogColor: new THREE.Color(0.04, 0.04, 0.04), haze: 0.18,
    });
    void mass; void tube; void LOADING;
    K.flush();
    return api;
  },
};

// [C6 2nd] the wall tiles: a grid of glazed squares, the grout dark (8 x 8 a repeat)
function tileTexture() {
  let c = null;
  try { c = typeof document !== 'undefined' ? document.createElement('canvas') : null; } catch (e) { c = null; }
  if (!c) { const t = new THREE.DataTexture(new Uint8Array([220, 220, 220, 255]), 1, 1); t.needsUpdate = true; return t; }
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#5a5a5a'; g.fillRect(0, 0, 256, 256);
  let r = 11;
  const rnd = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    const v = 214 + Math.floor(rnd() * 26);
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(i * 32 + 1.5, j * 32 + 1.5, 29, 29);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

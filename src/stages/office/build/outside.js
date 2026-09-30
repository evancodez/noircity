import * as THREE from 'three';
import { mergeGeos, lathe, tubeAlong } from '../../../props/lib.js';
import { wallGeos } from './walls.js';
import { makeRoomMaterial } from '../../../render/glass.js';
import { accentMaterial } from '../../../render/accents.js';
import { LAYER, markFigure } from '../../../render/layers.js';
import { FLOOR, ROOM, T, LAND, FLIGHT, STREET, POST, ESC, BLIND_LIGHT } from '../plan.js';

// Outside: the fire escape and the light well it hangs in (the Tommy gun
// comes up it), and three floors down through the blind the street - the
// far pavement, the lamp post the watcher stands under, the building across
// the way with a few windows lit, the HOTEL sign's blue tubes up the street
// and its floodlight (the light that comes in through the blind).
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const M = (l) => mergeGeos(l);
const hash = (i, s = 0) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };

export function buildFireEscape(kit, mats, stage) {
  const out = {};
  kit.piece();
  const L = LAND, F = FLIGHT;
  const iron = [];
  // the landing's grating: bars along x, a frame
  for (let z = L.z0 + 0.02; z < L.z1; z += 0.045) iron.push(new THREE.BoxGeometry(L.x1 - L.x0, 0.03, 0.012).translate((L.x0 + L.x1) / 2, L.y - 0.015, z));
  iron.push(new THREE.BoxGeometry(L.x1 - L.x0, 0.06, 0.04).translate((L.x0 + L.x1) / 2, L.y - 0.03, L.z1));
  iron.push(new THREE.BoxGeometry(0.04, 0.06, L.z1 - L.z0).translate(L.x1, L.y - 0.03, (L.z0 + L.z1) / 2));
  // the railing: a top rail at 0.95, a mid rail, balusters
  const rail = (a, b) => { iron.push(tubeAlong([a, b], 0.016, 8, 2)); };
  rail(V(L.x0, L.y + 0.95, L.z1), V(L.x1, L.y + 0.95, L.z1));
  rail(V(L.x1, L.y + 0.95, L.z1), V(L.x1, L.y + 0.95, L.z0 + 0.05));
  rail(V(L.x0 + 0.5, L.y + 0.5, L.z1), V(L.x1, L.y + 0.5, L.z1));
  for (let x = L.x0 + 0.5; x <= L.x1 + 1e-3; x += 0.14) iron.push(new THREE.BoxGeometry(0.014, 0.95, 0.014).translate(x, L.y + 0.475, L.z1));
  for (let z = L.z0 + 0.1; z <= L.z1; z += 0.14) iron.push(new THREE.BoxGeometry(0.014, 0.95, 0.014).translate(L.x1, L.y + 0.475, z));
  // the brackets under it, into the wall
  for (const x of [L.x0 + 0.3, (L.x0 + L.x1) / 2, L.x1 - 0.2]) iron.push(tubeAlong([V(x, L.y - 0.05, ROOM.z1 + T), V(x, L.y - 0.05, L.z1 - 0.1), V(x, L.y - 0.9, ROOM.z1 + T)], 0.02, 6, 10));
  // the flight down to the west: stringers, slatted treads, a handrail
  const n = 17, dy = (F.y1 - F.y0) / n, dx = (F.x1 - F.x0) / n;
  for (let i = 0; i < n; i++) {
    const x = F.x1 - (i + 0.5) * dx, y = F.y1 - (i + 1) * dy;
    for (let k = 0; k < 4; k++) iron.push(new THREE.BoxGeometry(dx * 0.9, 0.02, 0.012).translate(x, y, F.z0 + 0.06 + k * (F.z1 - F.z0 - 0.12) / 3));
  }
  for (const z of [F.z0, F.z1]) iron.push(tubeAlong([V(F.x1, F.y1 - 0.02, z), V(F.x0, F.y0 - 0.02, z)], 0.02, 6, 4));
  iron.push(tubeAlong([V(F.x1, F.y1 + 0.9, F.z1), V(F.x0, F.y0 + 0.9, F.z1)], 0.015, 6, 4));
  for (let i = 0; i <= n; i += 3) iron.push(new THREE.BoxGeometry(0.014, 0.9, 0.014).translate(F.x1 - i * dx, F.y1 - i * dy + 0.45, F.z1));
  // the landing below, and the ladder up from this one
  iron.push(new THREE.BoxGeometry(2.2, 0.04, L.z1 - L.z0).translate(F.x0 - 1.0, F.y0 - 0.02, (L.z0 + L.z1) / 2));
  for (const x of [L.x1 - 0.5, L.x1 - 0.1]) iron.push(new THREE.BoxGeometry(0.02, 3.2, 0.02).translate(x, L.y + 1.6 + 0.9, L.z1 - 0.15));
  for (let y = L.y + 1.2; y < L.y + 4; y += 0.3) iron.push(new THREE.BoxGeometry(0.4, 0.016, 0.016).translate(L.x1 - 0.3, y, L.z1 - 0.15));
  const mesh = kit.add(M(iron), mats.iron, { name: 'fire_escape' });
  markFigure(mesh);
  // his feet: the landing and the flight are the Hoods' floor out there
  stage.addSurface((x, z) => {
    if (z < L.z0 - 0.05 || z > L.z1 + 0.05) return undefined;
    if (x >= L.x0 - 0.02 && x <= L.x1) return L.y;
    if (x >= F.x0 && x < L.x0) return F.y0 + (F.y1 - F.y0) * (x - F.x0) / (F.x1 - F.x0);
    return undefined;
  });
  // the railing's colliders (the Hood keeps to the iron)
  stage.colliders.addBox((L.x0 + L.x1) / 2, L.z1 + 0.05, (L.x1 - L.x0) / 2, 0.05, 0, 'wall');
  stage.colliders.addBox(L.x1 + 0.05, (L.z0 + L.z1) / 2, 0.05, (L.z1 - L.z0) / 2, 0, 'wall');
  // the light well: the next building's brick 3.5 m off, a lit window in it, the dark below
  kit.piece();
  const wz = L.z1 + 2.2;
  const wall = [];
  wall.push(new THREE.BoxGeometry(14, 30, 0.3).translate(1.5, STREET.y + 12, wz + 0.15));
  kit.add(M(wall), mats.brick, { name: 'lightwell_wall', cast: false });
  // its windows: two dark, one lit (a room's light behind a blind)
  for (const [x, y, lit] of [[-1.4, 1.1, 0], [3.2, 1.3, 0.9], [3.0, -2.2, 0], [-1.2, -2.4, 0.3]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), makeRoomMaterial({ seed: x * 3 + y, lit }));
    m.position.set(x, y, wz - 0.005); m.rotation.y = Math.PI; m.scale.set(1.0, 1.4, 1);
    m.userData.inkId = kit.id;
    kit.g.add(m);
    kit.add(M([new THREE.BoxGeometry(1.16, 0.08, 0.1).translate(x, y - 0.74, wz - 0.03), new THREE.BoxGeometry(1.1, 0.06, 0.06).translate(x, y + 0.73, wz - 0.02)]), mats.stone, { cast: false });
  }
  // our own wall's outside face: brick where the stucco of the room is
  kit.piece();
  kit.add(M(wallGeos({ axis: 'x', a: [ROOM.z1 + T + 0.001, ROOM.z1 + T + 0.021], s: [-1.85, 6.65], y: [STREET.y + 6, 6.0], holes: [[ESC.x0, ESC.x1, ESC.y0, ESC.y1]] })), mats.brick, { cast: false, name: 'harbor_north_face' });
  out.mesh = mesh;
  return out;
}

export function buildStreet(kit, mats, stage, lamps) {
  const out = {};
  const S = STREET, y0 = S.y;
  // ---- the street, the pavements ----------------------------------------------------------------
  kit.piece();
  kit.add(new THREE.BoxGeometry(S.farKerb - S.kerb, 0.1, 90).translate((S.kerb + S.farKerb) / 2, y0 - 0.05, 0), mats.asphalt, { name: 'street_road', cast: false });
  kit.piece();
  kit.add(M([new THREE.BoxGeometry(S.kerb - S.face, 0.25, 90).translate((S.face + S.kerb) / 2, y0 + 0.025, 0), new THREE.BoxGeometry(S.far - S.farKerb, 0.25, 90).translate((S.farKerb + S.far) / 2, y0 + 0.025, 0)]), mats.stone, { name: 'street_pavements', cast: false });
  // ---- the building across the way: its face, its windows, a doorway ----------------------------
  kit.piece();
  const face = [];
  face.push(new THREE.BoxGeometry(0.6, 26, 90).translate(S.far + 0.3, y0 + 13, 0));
  // cornices and string courses: the face's lines in the dark
  for (const y of [3.6, 7.2, 10.8, 14.4, 18]) face.push(new THREE.BoxGeometry(0.16, 0.14, 90).translate(S.far - 0.06, y0 + y, 0));
  kit.add(M(face), mats.stone, { name: 'far_building', cast: false });
  // the windows: a grid, most of them dark, a few lit
  kit.piece();
  const dark = [];
  const winMats = [];
  for (let fl = 0; fl < 5; fl++) for (let k = -9; k <= 9; k++) {
    const z = k * 3.2 + 0.6, y = y0 + 4.8 + fl * 3.6;
    // (round 2: a few lit panes where the room's eye meets the facade
    // through the blind - from the door, the desk, the window - so the
    // window is a night window with lights in it, never a black plate)
    const seen = (fl === 1 && k === 4) || (fl === 0 && k === 3) || (fl === 2 && k === 5) || (fl === 1 && k === 1);
    const lit = seen ? 0.7 + hash(k, fl) * 0.3 : hash(k * 7 + fl, 3) > 0.84 ? 0.55 + hash(k, fl) * 0.45 : 0;
    if (lit > 0) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), makeRoomMaterial({ seed: k * 11 + fl, lit }));
      m.position.set(S.far - 0.01, y, z); m.rotation.y = -Math.PI / 2; m.scale.set(1.3, 1.9, 1);
      m.userData.inkId = kit.id;
      kit.g.add(m);
      winMats.push(m);
    } else dark.push(new THREE.BoxGeometry(0.02, 1.9, 1.3).translate(S.far - 0.01, y, z));
    // the sills
    dark.push(new THREE.BoxGeometry(0.12, 0.07, 1.46).translate(S.far - 0.06, y - 1.0, z));
  }
  kit.add(M(dark), mats.glassDark, { name: 'far_windows', cast: false });
  // the street's own windows below ours: the shop fronts across, dark, one lit door
  kit.piece();
  const shop = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), makeRoomMaterial({ seed: 44, lit: 0.8 }));
  shop.position.set(S.far - 0.01, y0 + 1.35, 1.2); shop.rotation.y = -Math.PI / 2; shop.scale.set(1.4, 2.4, 1);
  shop.userData.inkId = kit.id;
  kit.g.add(shop);

  // ---- the lamp post on the far pavement (the watcher stands under it) --------------------------
  kit.piece();
  {
    const geo = lamps.postGeometry();
    const g = new THREE.Group();
    g.position.set(POST.x, y0 + 0.15, POST.z);
    g.rotation.y = Math.PI;            // (its arm reaches over the street, toward -x)
    kit.g.add(g);
    const iron = new THREE.Mesh(geo.iron, stage.M.lampIron); iron.castShadow = true;
    const shade = new THREE.Mesh(geo.shade, stage.M.lampShade);
    const bulb = new THREE.Mesh(geo.bulb, stage.M.bulb);
    g.add(iron, shade, bulb);
    g.traverse((o) => { if (o.isMesh) o.userData.inkId = kit.id; });
    markFigure(shade);
    g.updateMatrixWorld(true);
    const head = geo.head.clone().applyMatrix4(g.matrixWorld);
    const lamp = lamps.addCustom({ head, axis: V(0, -1, 0.0), height: head.y - y0, half: 0.42, real: true, bulb, fadeEnd: 0.9, edgeSoft: 0.3, strength: 1.0, tag: 'post' });
    if (lamp.light) { lamp.light.intensity = 170; lamp.light.angle = 0.8; lamp.light.distance = 12; }
    lamp.noShadow = true;
    out.post = { group: g, lamp, head };
  }

  // ---- the HOTEL sign: a blade of blue tubes on the far building, up the street; its floodlight ---
  kit.piece();
  {
    const zc = BLIND_LIGHT.from[2] + 0.3, top = y0 + 17.6, H = 0.9;
    const letters = 'HOTEL';
    const g = new THREE.Group();
    kit.g.add(g);
    // the blade: a dark board standing out from the face
    kit.add(new THREE.BoxGeometry(1.4, letters.length * H + 0.6, 0.12).translate(S.far - 0.95, top - (letters.length * H) / 2, zc), mats.iron, { parent: g, cast: false });
    const neon = accentMaterial('neon', { tube: 0.02, minPx: 3 });
    const off = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.3 });
    const tubes = [];
    const G = GLYPHS;
    [...letters].forEach((ch, i) => {
      const cy = top - 0.3 - i * H - H / 2;
      for (const st of G[ch]) {
        const pts = st.map(([u, v]) => V(S.far - 0.95 + (u - 0.5) * 0.62, cy + (v - 0.5) * 0.66, zc - 0.075));
        // (both faces of the blade carry the letters: the face toward us, -z)
        tubes.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.01), Math.max(8, pts.length * 6), 0.02, 8, false));
      }
    });
    const tm = kit.add(M(tubes), neon, { parent: g, cast: false, name: 'hotel_neon', noRay: true });
    tm.userData.inkId = kit.id;
    out.neon = { mesh: tm, on: neon, off, flick: 0, seed: 3.7 };
  }
  // its floodlight: a hooded lamp on a bracket under the sign, aimed down
  // across the street at our window (parts/room.js deals it the blind's light)
  kit.piece();
  {
    const g = new THREE.Group();
    kit.g.add(g);
    const from = new THREE.Vector3(...BLIND_LIGHT.from);
    const hood = lathe([[0.02, 0.12], [0.1, 0.1], [0.22, 0.0], [0.26, -0.08], [0.24, -0.08]], 24);
    const hm = kit.add(hood, mats.iron, { parent: g, cast: false });
    const disc = kit.add(new THREE.CircleGeometry(0.2, 24).rotateX(Math.PI / 2).translate(0, -0.07, 0), stage.M.bulb, { parent: g, cast: false });
    g.position.copy(from);
    g.lookAt(new THREE.Vector3(...BLIND_LIGHT.through));
    g.rotateX(-Math.PI / 2);
    kit.add(tubeAlong([V(S.far, from.y + 0.3, from.z), V(from.x + 0.3, from.y + 0.35, from.z), V(from.x, from.y + 0.12, from.z)], 0.03, 6, 10), mats.iron, { cast: false });
    markFigure(hm);
    out.flood = { group: g, from, disc };
  }

  // ---- the wet street: the lamps' streaks in it (painted light; the room's Look mirrors nothing) --
  kit.piece();
  {
    const streak = (x, z, w, len, gain, col = null) => {
      const g = new THREE.PlaneGeometry(w, len).rotateX(-Math.PI / 2);
      const m = new THREE.MeshBasicMaterial({ color: col || new THREE.Color(gain, gain, gain), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, map: streakTex() });
      const mesh = new THREE.Mesh(g, m);
      // (the streak runs from under the light toward the eye at the window)
      mesh.position.set(x, y0 + 0.012, z);
      mesh.rotation.y = Math.atan2(ROOM.x1 - x, 4.2 - z) + Math.PI / 2;
      mesh.layers.set(LAYER.FX);
      mesh.userData.noRay = true;
      kit.g.add(mesh);
      return mesh;
    };
    out.streaks = [
      streak(POST.x - 1.9, POST.z, 0.5, 4.2, 0.55),
      streak(S.far - 1.4, BLIND_LIGHT.from[2], 0.4, 5.5, 0.4),
    ];
  }
  return out;
}

// a soft vertical streak (bright in its middle, broken by the wet's ripples)
let STREAK = null;
function streakTex() {
  if (STREAK) return STREAK;
  const c = document.createElement('canvas'); c.width = 32; c.height = 128;
  const g = c.getContext('2d');
  const im = g.createImageData(32, 128);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 32; x++) {
    const u = (x + 0.5) / 32 - 0.5, v = (y + 0.5) / 128;
    const a = Math.exp(-u * u / 0.02) * Math.pow(Math.sin(Math.PI * v), 0.6) * (0.55 + 0.45 * Math.sin(v * 50 + Math.sin(v * 13) * 2) ** 2);
    const i = (y * 32 + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = Math.round(255 * a); im.data[i + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  STREAK = new THREE.CanvasTexture(c);
  STREAK.colorSpace = THREE.SRGBColorSpace;
  return STREAK;
}

// the HOTEL's letters as tube strokes in a unit box (u across, v up)
const GLYPHS = {
  H: [[[0, 0], [0, 1]], [[1, 0], [1, 1]], [[0, 0.52], [1, 0.52]]],
  O: [[[0.5, 1], [0.1, 0.85], [0, 0.5], [0.1, 0.15], [0.5, 0], [0.9, 0.15], [1, 0.5], [0.9, 0.85], [0.5, 1]]],
  T: [[[0, 1], [1, 1]], [[0.5, 1], [0.5, 0]]],
  E: [[[1, 1], [0, 1], [0, 0], [1, 0]], [[0, 0.52], [0.72, 0.52]]],
  L: [[[0, 1], [0, 0], [0.95, 0]]],
};
void FLOOR;

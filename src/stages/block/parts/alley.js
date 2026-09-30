import * as THREE from 'three';
import { allocInkId, LAYER } from '../../../render/layers.js';
import { makeGroundMaterial } from '../../../render/shaders/ground.js';
import { merge, lathe, tube, roundedBox, V3 } from '../../../world/geom.js';
import { STREET } from '../../../world/Street.js';

// The side alley (scene 3, the body; lane B1). The cross street off the
// west pavement, x from the building line (-10.2) back 14 m to the wire
// gate (-24.2), z -30 .. -24 (the far block's end on the north, the near
// building's end on the south: bounds.js closes it and holds the wall
// lamp's fixture at block.alley.lamp).
//   the south wall   brick, a doorway with one dry stone step under a
//                    small hood (the table of the paper puzzles), the wall
//                    lamp over it (its bulb, cone and pool light: off until
//                    the scene lights it), a drainpipe, two dark windows
//   the north wall   brick, the fire escape: a landing at 4 m a man stands
//                    on (railings, a grating, a window behind), a stair up
//                    to a second landing in the dark, a drop ladder that
//                    slides down in its guides (api.ladder)
//   the floor        wet flagstones (the pavement's ground material, so the
//                    lamp streaks in it) with a gutter down the middle to a
//                    drain grate at the mouth; bins, a crate
// Nothing of it is drawn, shadow-cast, shot at or collided with until the
// scene shows it (api.show(true)): the accepted street frames look into
// the alley's mouth. Every mesh is noRay; the colliders come and go with
// show(); the lamp is registered off (lamp.on = false) and its cone hidden.
export const ALLEY = {
  mouthX: STREET.facadeX, gateX: STREET.facadeX - 14,
  zS: -24.0, zN: -30.0, y: 0.15,
  // [R2-G] the south wall's visible face: the near building's side quoin
  // (world/Facade.js, a 0.4 m slab along its whole end) stands 8 cm out
  // into the alley and hid the brick, the door's planks and the two bullet
  // holes behind it; the south wall's things stand on this face instead
  faceS: -24.09,
  lamp: new THREE.Vector3(-12.5, 4.14, -24.3),
  // the doorway and its dry step (the step's top is the puzzles' table)
  door: { x: -12.95, w: 1.0, h: 2.2 },
  step: { x: -12.95, w: 1.2, d: 0.42, h: 0.17 },
  // the fire escape on the north wall
  esc: { x0: -14.1, x1: -10.75, d: 1.15, y1: 4.15, y2: 7.3 },
  ladder: { x: -13.55, len: 4.6, up: 1.85 },
  gutterZ: -27.0,
  drainX: -11.0,
};
const A = ALLEY;
const STEP_TOP = A.y + A.step.h;

// the brick, as an inker indicates it [second pass]: a plain wet wall (the
// ink lays its own brush over it, as on every wall of the block) with the
// courses drawn only here and there - a few bricks in a patch by a corner,
// under a sill, where the plaster has gone - as hand-drawn joints that fade
// out at the patch's edge. A wall of bricks laid edge to edge in even tones
// printed as graph paper under the lamp; this does not. One tile is 7 m by
// 4.75 m of wall (the wall is two by two of it).
export const BRICK_TILE = [7.0, 4.75];
function brickTexture() {
  const W = 2048, H = 1392;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  let s = 91;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const pxM = W / BRICK_TILE[0], pyM = H / BRICK_TILE[1];
  // the wall's own tone: a slow wash of soot and damp, low contrast
  x.fillStyle = '#5a5a5a'; x.fillRect(0, 0, W, H);
  for (let k = 0; k < 26; k++) {
    const cx = r() * W, cy = r() * H, rx = 150 + r() * 420, ry = 90 + r() * 260, v = r() < 0.5 ? 40 : 120, a = 0.05 + r() * 0.07;
    // (drawn at the wrapped copies too: the tile repeats without a seam)
    for (const ox of [-W, 0, W]) for (const oy of [-H, 0, H]) {
      x.save(); x.translate(cx + ox, cy + oy); x.scale(rx, ry);
      const gg = x.createRadialGradient(0, 0, 0, 0, 0, 1);
      gg.addColorStop(0, `rgba(${v},${v},${v},${a})`); gg.addColorStop(1, `rgba(${v},${v},${v},0)`);
      x.fillStyle = gg; x.beginPath(); x.arc(0, 0, 1, 0, 7); x.fill(); x.restore();
    }
  }
  // the patches of brick: a few courses of real size (22 x 7 cm), the
  // joints a dark hand-drawn line, broken, fading out to the patch's edge
  const bw = 0.225 * pxM, bh = 0.075 * pyM;
  const line = (x0, y0, x1, y1, a) => {
    x.strokeStyle = `rgba(22,22,22,${a})`;
    x.lineWidth = 2 + r() * 1.4;
    x.beginPath(); x.moveTo(x0 + (r() - 0.5) * 2, y0 + (r() - 0.5) * 2); x.lineTo(x1 + (r() - 0.5) * 2, y1 + (r() - 0.5) * 2); x.stroke();
  };
  const PATCHES = 14;
  for (let p = 0; p < PATCHES; p++) {
    const cx = r() * W, cy = 60 + r() * (H - 120);
    const rx = (0.5 + r() * 0.6) * pxM, ry = (0.22 + r() * 0.3) * pyM;
    const row0 = Math.floor((cy - ry) / bh), row1 = Math.ceil((cy + ry) / bh);
    for (let row = row0; row <= row1; row++) {
      const y = row * bh, off = (row & 1) * bw * 0.5;
      // the course's bed joint: drawn where it is inside the patch
      const dy = (y - cy) / ry;
      if (Math.abs(dy) >= 1) continue;
      const half = rx * Math.sqrt(1 - dy * dy) * (0.75 + r() * 0.3);
      const xa = cx - half, xb = cx + half;
      let xs = xa;
      while (xs < xb) {
        const seg = (0.2 + r() * 0.5) * pxM;
        const e = Math.min(xb, xs + seg);
        const edge = 1 - Math.pow(Math.abs(((xs + e) / 2 - cx) / Math.max(1, half)), 2);
        if (r() < 0.8) line(xs, y, e, y, 0.35 + 0.4 * edge * (1 - Math.abs(dy)));
        xs = e + (r() < 0.3 ? bw * 0.3 : 0);
      }
      // the head joints of the course below: every brick's end
      if (row < row1) {
        for (let k = Math.floor((xa - off) / bw); k * bw + off < xb; k++) {
          const hx = k * bw + off + (r() - 0.5) * 3;
          if (hx < xa || hx > xb || r() < 0.2) continue;
          const edge = 1 - Math.pow(Math.abs((hx - cx) / Math.max(1, half)), 2);
          line(hx, y, hx, y + bh, 0.3 + 0.4 * edge * (1 - Math.abs(dy)));
          // (now and then a brick a shade darker, as a brush would touch it in)
          if (r() < 0.12) { x.fillStyle = 'rgba(30,30,30,0.18)'; x.fillRect(hx + 2, y + 2, bw - 4, bh - 4); }
        }
      }
    }
  }
  // grime: long wet streaks down the wall, darker toward the foot
  for (let k = 0; k < 110; k++) {
    const sx = r() * W, len = 160 + r() * 900, w = 5 + r() * 26;
    const g = x.createLinearGradient(0, 0, 0, len);
    g.addColorStop(0, 'rgba(20,20,20,0)'); g.addColorStop(0.3, `rgba(20,20,20,${0.1 + r() * 0.16})`); g.addColorStop(1, 'rgba(20,20,20,0)');
    x.fillStyle = g; x.save(); x.translate(sx, r() * H * 0.6); x.fillRect(-w / 2, 0, w, len); x.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export default {
  name: 'alley', order: 200, tick: 200,
  build(stage) {
    const { M, colliders, U } = stage;
    const g = new THREE.Group();
    g.name = 'alley';
    g.visible = false;
    stage.scene.add(g);
    const std = (o) => new THREE.MeshStandardMaterial({ envMap: M.envSoft, envMapIntensity: 0.25, ...o });
    const brickMap = brickTexture();
    const MAT = {
      // (no bump: the joints under the lamp's grazing pool printed as a grid)
      brick: std({ color: 0xa4a4a4, map: brickMap, roughness: 0.92, envMapIntensity: 0.18 }),
      stone: std({ color: 0x3c3c3c, roughness: 0.85 }),
      stepTop: std({ color: 0x5a5a5a, roughness: 0.9 }),
      iron: M.iron,
      rust: std({ color: 0x0a0a0a, roughness: 0.7, metalness: 0.3 }),
      door: std({ color: 0x262626, roughness: 0.75 }),   // [R2-G] (was 0x101010: under the step's light the planks' foot read as a flat black plane)
      pane: std({ color: 0x080808, roughness: 0.85, envMapIntensity: 0.1 }),
      bin: std({ color: 0x151515, roughness: 0.6, metalness: 0.3 }),
      wood: std({ color: 0x2a2a2a, roughness: 0.9, envMapIntensity: 0.1 }),
    };
    const meshes = [];
    const add = (parts, mat, { id = allocInkId(), cast = true, figure = false, parent = g, name = null } = {}) => {
      const m = new THREE.Mesh(Array.isArray(parts) ? merge(parts) : parts, mat);
      m.castShadow = cast; m.receiveShadow = true;
      m.userData.inkId = id; m.userData.noRay = true;
      if (figure) m.userData.inkFigure = true;
      if (name) m.name = name;
      parent.add(m);
      meshes.push(m);
      return m;
    };
    const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
    const rbox = (w, h, d, x, y, z, r = 0.02) => roundedBox(w, h, d, Math.min(r, w * 0.4, h * 0.4, d * 0.4), 2).translate(x, y, z);
    const cyl = (r, h, x, y, z, seg = 10) => new THREE.CylinderGeometry(r, r, h, seg).translate(x, y, z);
    const bar = (a, b, r, seg = 8) => {
      const d = b.clone().sub(a), L = d.length();
      const geo = new THREE.CylinderGeometry(r, r, L, seg);
      geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), d.normalize()));
      return geo.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    };
    const len = A.mouthX - A.gateX;

    // ---- the walls: brick faces over the buildings' ends ----------------------------------
    const wallH = 9.5;
    const face = (z, facing) => {
      const geo = new THREE.PlaneGeometry(len, wallH);
      if (facing < 0) geo.rotateY(Math.PI);
      geo.translate((A.mouthX + A.gateX) / 2, wallH / 2, z);
      // (the brick's tile in world metres)
      const uv = geo.getAttribute('uv'), p = geo.getAttribute('position');
      for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / BRICK_TILE[0] * (facing < 0 ? -1 : 1) + (facing < 0 ? 0.37 : 0), p.getY(i) / BRICK_TILE[1]);
      return geo;
    };
    const wallS = add(face(A.faceS, -1), MAT.brick, { name: 'alley_wallS' });
    const wallN = add(face(A.zN + 0.01, 1), MAT.brick, { name: 'alley_wallN' });
    // the corners at the mouth: dressed stone quoins so the brick does not
    // end on a raw edge at the building line
    {
      const q = [];
      for (const [z, s] of [[A.zS, -1], [A.zN, 1]]) {
        for (let y = 0.2, i = 0; y < wallH; y += 0.42, i++) q.push(rbox(0.12, 0.36, i % 2 ? 0.34 : 0.52, A.mouthX - 0.05, y + 0.18, z + s * (i % 2 ? 0.17 : 0.26) - s * 0.01, 0.02));
      }
      add(q, MAT.stone);
    }

    // ---- the floor: wet flagstones falling to a gutter down the middle -----------------------
    {
      const nx = 56, nz = 30;
      const geo = new THREE.PlaneGeometry(len - 0.4, A.zS - A.zN, nx, nz).rotateX(-Math.PI / 2);
      const p = geo.getAttribute('position');
      for (let i = 0; i < p.count; i++) {
        const z = p.getZ(i) + (A.zS + A.zN) / 2;
        const dip = 0.035 * Math.exp(-(((z - A.gutterZ) / 0.22) ** 2)) + 0.01 * (1 - Math.min(1, Math.abs(z - A.gutterZ) / 3));
        p.setY(i, A.y - dip);
      }
      geo.translate((A.mouthX - 0.4 + A.gateX) / 2 - 0.2 + 0.2, 0, (A.zS + A.zN) / 2);
      geo.computeVertexNormals();
      const floor = new THREE.Mesh(geo, makeGroundMaterial(U, { paving: 1 }));
      floor.receiveShadow = true;
      floor.layers.set(LAYER.GROUND);
      floor.userData.inkId = allocInkId();
      floor.userData.noRay = true;
      floor.name = 'alley_floor';
      g.add(floor);
      meshes.push(floor);
      // the drain at the mouth: an iron grate in a stone frame
      const gr = [rbox(0.62, 0.03, 0.5, A.drainX, A.y - 0.02, A.gutterZ, 0.01)];
      const bars = [];
      for (let k = -4; k <= 4; k++) bars.push(box(0.022, 0.025, 0.42, A.drainX + k * 0.058, A.y - 0.012, A.gutterZ));
      add(gr, MAT.stone);
      add(bars, MAT.iron);
      add(box(0.5, 0.01, 0.36, A.drainX, A.y - 0.04, A.gutterZ), M.black || new THREE.MeshBasicMaterial({ color: 0 }), { cast: false });
    }

    // ---- the south wall: the doorway, its step and hood, the lamp, a pipe, windows -----------
    const D = A.door, S = A.step;
    {
      const frame = [];
      const zf = A.faceS - 0.04;
      frame.push(rbox(0.14, D.h + 0.12, 0.12, D.x - D.w / 2 - 0.07, A.y + (D.h + 0.12) / 2, zf));
      frame.push(rbox(0.14, D.h + 0.12, 0.12, D.x + D.w / 2 + 0.07, A.y + (D.h + 0.12) / 2, zf));
      frame.push(rbox(D.w + 0.42, 0.2, 0.16, D.x, A.y + D.h + 0.14, zf - 0.01));
      add(frame, MAT.stone);
      // the door: planks in a frame, recessed, a dark glass light above
      // [R2-G] each plank its own ink (the ink draws the seams between
      // them: one mesh of five read as a flat black plane under the step's
      // light), two iron straps across, the handle, the keyhole plate
      for (let k = 0; k < 5; k++) add(box(D.w / 5 - 0.012, D.h - 0.02, 0.05, D.x - D.w / 2 + (k + 0.5) * D.w / 5, A.y + D.h / 2, A.faceS - 0.02), MAT.door, { cast: false });
      add([box(D.w - 0.06, 0.06, 0.012, D.x, A.y + 0.42, A.faceS - 0.051), box(D.w - 0.06, 0.06, 0.012, D.x, A.y + 1.78, A.faceS - 0.051),
        box(0.05, 0.05, 0.03, D.x + D.w / 2 - 0.12, A.y + 1.0, A.faceS - 0.06), box(0.035, 0.09, 0.008, D.x + D.w / 2 - 0.12, A.y + 0.9, A.faceS - 0.048)], MAT.iron);
      // the step: a worn slab of stone, a hollow in its middle
      const st = rbox(S.w, S.h, S.d, S.x, A.y + S.h / 2, A.faceS - S.d / 2 + 0.005, 0.03);
      add(st, MAT.stepTop, { name: 'alley_step' });
      // the hood over the door: a slab on two iron brackets
      const hoodY = A.y + D.h + 0.42;
      // (it keeps the rain off the step, not the lamp's light: no shadow)
      add(rbox(D.w + 0.7, 0.09, 0.62, D.x, hoodY, A.faceS - 0.31, 0.02), MAT.stone, { cast: false });
      const br = [];
      for (const sx of [-1, 1]) br.push(tube([V3(D.x + sx * (D.w / 2 + 0.2), hoodY - 0.5, A.faceS - 0.01), V3(D.x + sx * (D.w / 2 + 0.2), hoodY - 0.15, A.faceS - 0.35), V3(D.x + sx * (D.w / 2 + 0.2), hoodY - 0.05, A.faceS - 0.55)], 0.015, 6, 12));
      add(br, MAT.iron, { cast: false });
      // (the hood keeps the rain off the step)
      stage.dry.push(new THREE.Box3(V3(D.x - D.w / 2 - 0.35, A.y - 0.2, A.zS - 0.62), V3(D.x + D.w / 2 + 0.35, hoodY, A.zS)));
      // a drainpipe down the wall, its shoe over the gutter's side
      const px = -15.6;
      const pipe = [cyl(0.05, 8.6, px, 4.45, A.faceS - 0.07, 12), new THREE.CylinderGeometry(0.05, 0.07, 0.25, 12).rotateX(0.6).translate(px, 0.28, A.faceS - 0.16)];
      for (let y = 1.2; y < 8.6; y += 2.1) pipe.push(new THREE.TorusGeometry(0.06, 0.012, 6, 14).rotateX(Math.PI / 2).translate(px, y, A.faceS - 0.07));
      add(pipe, MAT.rust);
      // two dark windows up the wall, their sills
      const win = [], sill = [];
      for (const [wx, wy] of [[-17.2, 3.4], [-12.0, 6.9], [-19.8, 6.9]]) {
        win.push(box(1.0, 1.5, 0.04, wx, wy, A.faceS - 0.01));
        sill.push(rbox(1.2, 0.08, 0.16, wx, wy - 0.8, A.faceS - 0.06, 0.015), rbox(1.16, 0.1, 0.1, wx, wy + 0.8, A.faceS - 0.03, 0.015));
      }
      add(win, MAT.pane);
      add(sill, MAT.stone);
    }

    // ---- the wall lamp: a bulb under the fixture (bounds.js), its cone and pool light ---------
    const bulb = new THREE.Mesh(new THREE.CircleGeometry(0.15, 32).rotateX(Math.PI / 2).translate(A.lamp.x, A.lamp.y, A.lamp.z), M.bulbDim);
    bulb.userData.noRay = true;
    bulb.userData.inkId = allocInkId();
    g.add(bulb);
    const lamp = stage.lamps.addCustom({
      head: A.lamp.clone(), axis: V3(0.16, -1, -0.24).normalize(), height: 4.5, half: 0.46,
      real: true, bulb, fadeEnd: 0.8, edgeSoft: 0.35, strength: 1.25, tag: 'alley',
    });
    // (off, and out of the pool, until the scene lights it: it must not
    // touch an accepted frame)
    lamp.on = false;
    lamp.cone.visible = false;
    // (its light reaches further than its cone of lit rain: a wide soft pool
    // thrown across the alley, so the far wall, the fire escape and the
    // drop ladder stand dark against a grey wash, not black on black)
    if (lamp.light) {
      lamp.light.angle = 1.12; lamp.light.penumbra = 0.9; lamp.light.intensity = 85; lamp.light.distance = 16;
      lamp.light.target.set(-12.9, 0.4, A.zN + 0.6);
    }

    // ---- [R2-G] the lamp's light on the step, for the table views ------------------------------
    // (the lamp's own pool is thrown across the alley, to the fire escape:
    // the step under it stood at the pool's edge, a flat grey slab. The
    // same head's light down onto the step and the foot of the door, faded
    // in as I go down to the step and out as I rise - no cone of its own,
    // the lamp's cone is already there)
    const stepLamp = (() => {
      const head = A.lamp.clone().add(V3(0, -0.08, 0.02));
      const at = V3(S.x - 0.05, STEP_TOP, A.faceS - 0.2);
      const l = stage.lamps.addCustom({ head, axis: at.clone().sub(head).normalize(), height: head.y - STEP_TOP, half: 0.3, real: true, bulb: null, strength: 1, tag: 'alleyStep' });
      l.on = false;
      l.cone.visible = false;
      const Q = typeof location !== 'undefined' && location.search.includes('steplight') ? new URLSearchParams(location.search).get('steplight').split(',').map(Number) : null;
      if (l.light) { l.light.angle = Q ? Q[0] : 0.12; l.light.penumbra = Q ? Q[1] : 0.8; l.light.distance = 7; l.light.target = at.clone(); }
      l.full = Q ? Q[2] : 170;
      if (l.light) l.light.intensity = 0;
      return l;
    })();

    // ---- [R2-G] the mouth lamp: a gooseneck on the far block's corner --------------------------
    // (the wall lamp over the door cannot be seen from the pavement: it is
    // 2.3 m in behind the near building's end. From where scene 2 leaves me,
    // 20 m up the pavement, this is the alley's light: a head out over the
    // pavement at the corner, its cone in the rain on the mouth, where the
    // car comes out, and its sheen on the wet running back down the
    // pavement to me - the line to it. Off, and hidden with the rest of
    // the alley, until the scene lights it.)
    const mouth = (() => {
      const Q = typeof location !== 'undefined' && location.search.includes('mouthlamp') ? new URLSearchParams(location.search).get('mouthlamp').split(',').map(Number) : null;
      // (Q: y, z of the wall plate, reach, axis x, axis z, light scale)
      const wx = A.mouthX + 0.02, wy = Q ? Q[0] : 4.9, wz = Q ? Q[1] : A.zN - 1.5, R = Q ? Q[2] : 0.45;
      const arm = [V3(wx, wy, wz), V3(wx + R * 0.4, wy + 0.1, wz + 0.03), V3(wx + R * 0.75, wy + 0.08, wz + 0.08), V3(wx + R * 0.97, wy - 0.06, wz + 0.12), V3(wx + R, wy - 0.2, wz + 0.13)];
      const head = V3(wx + R, wy - 0.46, wz + 0.13);
      const iron = [tube(arm, 0.028, 8, 32), new THREE.CylinderGeometry(0.11, 0.11, 0.04, 16).rotateZ(Math.PI / 2).translate(wx + 0.02, wy, wz)];
      const shade = lathe([[0.02, 0.06], [0.05, 0.03], [0.12, -0.04], [0.21, -0.12], [0.25, -0.15], [0.235, -0.15]], 28).translate(head.x, head.y + 0.2, head.z);
      const id = allocInkId();
      add(iron, M.lampIron || MAT.iron, { id, name: 'alley_mouthIron' });
      add(shade, M.lampShade || MAT.iron, { id, figure: true, name: 'alley_mouthShade' });
      const b = new THREE.Mesh(new THREE.CircleGeometry(0.19, 32).rotateX(Math.PI / 2).translate(head.x, head.y + 0.06, head.z), M.bulbDim);
      b.userData.noRay = true;
      b.userData.inkId = allocInkId();
      g.add(b);
      // (down, a little out over the mouth and back toward the pavement I
      // come from: the pool on the flags of the mouth and the kerb's edge)
      const l = stage.lamps.addCustom({ head: head.clone(), axis: (Q && Q[3] != null ? V3(Q[3], -1, Q[4]) : V3(0.15, -1, 0.25)).normalize(), height: wy - 0.3, half: 0.44, real: !(Q && Q[5] === 0), bulb: b, fadeEnd: 0.72, edgeSoft: 0.3, strength: Q && Q[6] ? Q[6] : 1.4, tag: 'alleyMouth' });
      l.on = false;
      l.cone.visible = false;
      if (l.light) { l.light.angle = 0.6; l.light.penumbra = 0.85; l.light.intensity = 70; l.light.distance = 12; }
      return l;
    })();

    // ---- the north wall: the fire escape -------------------------------------------------------
    const E = A.esc;
    const zw = A.zN, zo = A.zN + E.d;       // the wall, the landing's outer edge
    const esc = new THREE.Group();
    esc.name = 'alley_escape';
    g.add(esc);
    const escId = allocInkId();
    const iron = [], grating = [];
    const landing = (y, x0, x1) => {
      // the frame: angle iron round the edge, slats across
      iron.push(box(x1 - x0, 0.05, 0.05, (x0 + x1) / 2, y - 0.03, zo));
      iron.push(box(x1 - x0, 0.05, 0.05, (x0 + x1) / 2, y - 0.03, zw + 0.05));
      for (const x of [x0, x1]) iron.push(box(0.05, 0.05, E.d, x, y - 0.03, (zw + zo) / 2));
      for (let x = x0 + 0.06; x < x1 - 0.03; x += 0.07) grating.push(box(0.03, 0.015, E.d - 0.06, x, y - 0.01, (zw + zo) / 2));
      // the railing: posts, a top rail and a mid rail, bars between
      const rh = 1.0;
      const posts = [];
      for (let x = x0; x <= x1 + 1e-3; x += (x1 - x0) / 4) posts.push(x);
      for (const x of posts) iron.push(cyl(0.018, rh, x, y + rh / 2, zo, 8));
      for (const hy of [rh, rh * 0.5]) iron.push(bar(V3(x0, y + hy, zo), V3(x1, y + hy, zo), 0.016));
      for (const x of [x0, x1]) for (const hy of [rh, rh * 0.5]) iron.push(bar(V3(x, y + hy, zo), V3(x, y + hy, zw + 0.04), 0.016));
      for (const x of [x0, x1]) iron.push(cyl(0.018, rh, x, y + rh / 2, zw + 0.05, 8));
      for (let x = x0 + 0.12; x < x1 - 0.05; x += 0.12) iron.push(bar(V3(x, y + 0.02, zo), V3(x, y + rh * 0.5, zo), 0.007, 5));
      // the brackets under it: diagonal struts into the wall
      for (const x of [x0 + 0.15, (x0 + x1) / 2, x1 - 0.15]) iron.push(bar(V3(x, y - 0.05, zo - 0.05), V3(x, y - 1.05, zw + 0.03), 0.02));
    };
    landing(E.y1, E.x0, E.x1);
    landing(E.y2, E.x0 + 0.6, E.x1);
    // the stair from the first landing up to the second, along the wall
    {
      const sx0 = E.x0 + 0.9, sx1 = E.x1 - 0.5, sz = zw + 0.5, w = 0.55;
      for (const dz of [-w / 2, w / 2]) iron.push(bar(V3(sx1, E.y1, sz + dz), V3(sx0, E.y2, sz + dz), 0.022));
      const n = 12;
      for (let k = 1; k < n; k++) {
        const u = k / n;
        iron.push(box(0.1, 0.02, w, sx1 + (sx0 - sx1) * u, E.y1 + (E.y2 - E.y1) * u, sz));
      }
      iron.push(bar(V3(sx1, E.y1 + 0.95, sz - w / 2), V3(sx0, E.y2 + 0.95, sz - w / 2), 0.014));
    }
    add(iron, MAT.iron, { id: escId, parent: esc, name: 'alley_escIron' });
    add(grating, MAT.iron, { id: escId, parent: esc, cast: true, name: 'alley_escGrating' });
    // the windows the fire escape serves
    add([box(1.1, 1.7, 0.04, (E.x0 + E.x1) / 2 - 0.3, E.y1 + 0.95, zw + 0.02), box(1.0, 1.6, 0.04, (E.x0 + E.x1) / 2 + 0.3, E.y2 + 0.95, zw + 0.02)], MAT.pane);
    add([rbox(1.3, 0.08, 0.16, (E.x0 + E.x1) / 2 - 0.3, E.y1 + 0.08, zw + 0.07, 0.015), rbox(1.2, 0.1, 0.1, (E.x0 + E.x1) / 2 - 0.3, E.y1 + 1.85, zw + 0.04, 0.015),
      rbox(1.2, 0.1, 0.1, (E.x0 + E.x1) / 2 + 0.3, E.y2 + 1.8, zw + 0.04, 0.015)], MAT.stone);
    // the drop ladder: two rails and the rungs, sliding in two guides on the
    // landing's outer edge; `down` 0 (up, its foot 2.35 m over the ground)
    // .. 1 (its feet on the flags)
    const L = A.ladder;
    const ladG = new THREE.Group();
    ladG.name = 'alley_ladder';
    esc.add(ladG);
    const lz = zo + 0.06;
    const lad = [];
    const lw = 0.44;
    for (const dx of [-lw / 2, lw / 2]) lad.push(cyl(0.02, L.len, L.x + dx, L.len / 2, lz, 8));
    const rungs = [];
    for (let y = 0.3; y < L.len - 0.1; y += 0.3) { lad.push(new THREE.CylinderGeometry(0.013, 0.013, lw, 6).rotateZ(Math.PI / 2).translate(L.x, y, lz)); rungs.push(y); }
    add(lad, MAT.iron, { id: escId, parent: ladG, name: 'alley_ladderIron' });
    // the guides and the counterweight hook on the landing's rail
    add([rbox(0.08, 0.14, 0.1, L.x - lw / 2 - 0.05, E.y1 + 0.1, lz, 0.01), rbox(0.08, 0.14, 0.1, L.x + lw / 2 + 0.05, E.y1 + 0.1, lz, 0.01),
      rbox(0.08, 0.14, 0.1, L.x - lw / 2 - 0.05, E.y1 + 0.85, lz, 0.01), rbox(0.08, 0.14, 0.1, L.x + lw / 2 + 0.05, E.y1 + 0.85, lz, 0.01)], MAT.iron, { id: escId, parent: esc });
    let api = null;
    const ladder = {
      group: ladG, down: 0, rungs, x: L.x, z: lz, w: lw,
      // the ladder's foot, world y
      footY: () => A.y + L.up * (1 - ladder.down),
      set(k) {
        ladder.down = Math.max(0, Math.min(1, k)); ladG.position.y = A.y + L.up * (1 - ladder.down);
        // (down, it stands in the way: a man walks into it, not through it)
        const want = api && api.shown && ladder.down > 0.9;
        if (want && !ladder.col) ladder.col = colliders.addBox(L.x, lz, lw / 2 + 0.05, 0.06, 0, 'alley');
        else if (!want && ladder.col) { const i = colliders.boxes.indexOf(ladder.col); if (i >= 0) colliders.boxes.splice(i, 1); ladder.col = null; }
      },
      // a rung's world point (i from the foot)
      rung(i, out = new THREE.Vector3()) { return out.set(L.x, ladder.footY() + rungs[Math.max(0, Math.min(rungs.length - 1, i))], lz); },
    };
    ladder.set(0);

    // ---- bins, a crate, rubbish against the walls --------------------------------------------
    const bins = [];
    const binAt = (x, z, lid = true, tip = 0) => {
      const p = [lathe([[0, 0.02], [0.25, 0.02], [0.27, 0.1], [0.28, 0.82], [0.3, 0.86], [0.26, 0.88], [0, 0.88]], 28)];
      for (const y of [0.25, 0.55]) p.push(new THREE.TorusGeometry(0.28, 0.012, 6, 28).rotateX(Math.PI / 2).translate(0, y, 0));
      if (lid) p.push(lathe([[0, 0.97], [0.12, 0.96], [0.3, 0.9], [0.31, 0.88], [0, 0.88]], 28));
      for (const q of p) { q.rotateZ(tip); q.translate(x, A.y, z); }
      add(p, MAT.bin);
      bins.push({ x, z, r: 0.34 });
    };
    binAt(-20.4, A.zN + 0.45); binAt(-21.05, A.zN + 0.5, false); binAt(-16.2, A.zS - 0.42);
    // a crate on its side and a plank
    add([rbox(0.7, 0.55, 0.55, 0, 0, 0, 0.02).rotateY(0.3).translate(-18.6, A.y + 0.275, A.zS - 0.45)], MAT.wood);
    bins.push({ x: -18.6, z: A.zS - 0.45, r: 0.42 });
    add([rbox(0.06, 1.9, 0.22, 0, 0, 0, 0.01).rotateZ(0.2).translate(-22.4, A.y + 0.92, A.zN + 0.15)], MAT.wood);

    // ---- colliders, anchors, the sound of the place ----------------------------------------------
    const cols = [];
    const colSpecs = () => {
      const out = [];
      out.push(['box', S.x, A.faceS - S.d / 2, S.w / 2, S.d / 2 + 0.02, 0, 'step']);
      for (const b of bins) out.push(['circle', b.x, b.z, b.r, 'can']);
      // the drop ladder, once it is down, stands in the way
      return out;
    };
    const setColliders = (on) => {
      for (const c of cols) for (const arr of [colliders.circles, colliders.boxes]) { const i = arr.indexOf(c); if (i >= 0) arr.splice(i, 1); }
      cols.length = 0;
      if (!on) return;
      for (const s of colSpecs()) cols.push(s[0] === 'box' ? colliders.addBox(s[1], s[2], s[3], s[4], s[5], 'alley') : colliders.addCircle(s[1], s[2], s[3], 'alley'));
    };
    // the step: its top is the paper puzzles' table (the eye stands north
    // of it and looks south, down onto it)
    stage.addAnchor('body.step', { pos: V3(S.x, STEP_TOP, A.faceS - S.d / 2), yaw: Math.PI, size: [S.w - 0.1, S.d - 0.06] });
    stage.addAnchor('body.ladder', { pos: V3(L.x, A.y, zo + 0.75), yaw: 0 });
    stage.addAnchor('body.landing', { pos: V3(L.x + 0.55, E.y1, (zw + zo) / 2 + 0.05), yaw: 0 });
    // the walking surface: the step and, while the scene is on, the landing
    stage.addSurface((x, z) => (api.shown && Math.abs(x - S.x) < S.w / 2 && z > A.faceS - S.d && z < A.zS ? STEP_TOP : undefined));
    // (the alley's own room: the street's rain, the gutters and the drains)
    stage.addLook(new THREE.Box3(V3(A.gateX, -1, A.zN), V3(A.mouthX - 0.3, 12, A.zS)), { room: 'alley' });

    api = {
      group: g, meshes, lamp, bulb, mouth, ladder, escape: esc, walls: { S: wallS, N: wallN }, shown: false,
      stepTop: STEP_TOP,
      // the scene shows the place (and its colliders); the lamp is the scene's
      show(on = true) {
        api.shown = !!on;
        g.visible = !!on;
        setColliders(!!on);
        ladder.set(ladder.down);
        if (!on) api.light(false);
      },
      light(on = true) {
        lamp.on = !!on;
        lamp.cone.visible = !!on;
        if (bulb) bulb.visible = !!on;
        // [R2-G] (and the mouth lamp with it)
        const mo = on && !(typeof location !== 'undefined' && location.search.includes('nomouth'));
        mouth.on = !!mo;
        mouth.cone.visible = !!mo;
        if (mouth.bulb) mouth.bulb.visible = !!mo;
        if (!on) api.stepLight(0);
      },
      // [R2-G] the step's light, 0..1 (the table views: in as I go down to it)
      stepLight(k) {
        const on = api.shown && k > 0.002;
        stepLamp.on = on;
        if (stepLamp.light) stepLamp.light.intensity = stepLamp.full * Math.max(0, Math.min(1, k));
      },
      // the meshes a drawn ray may strike (the strings)
      rayTargets() { return meshes.filter((m) => m.visible !== false); },
    };
    return api;
  },
  update(api) {
    // (the lamp's bulb follows the lamp; nothing else moves on its own)
    if (!api.shown && api.lamp.on) api.light(false);
  },
};

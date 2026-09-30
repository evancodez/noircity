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

// the brick: a canvas of courses laid by hand, uneven tones, worn joints,
// rain streaks down from the sills; low contrast (the ink lays its own
// strokes over it: a crisp even grid would print as graph paper)
function brickTexture() {
  const W = 1024, H = 1024;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  let s = 91;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  // (the joints barely lighter than the bricks and broken off in places;
  // the courses read by the bricks' own uneven tones, in patches, as a
  // brush would lay them: a clean even grid prints as graph paper)
  x.fillStyle = '#5e5e5e'; x.fillRect(0, 0, W, H);
  const bw = 128, bh = 44;
  // slow patches of tone across the wall: soot, damp, sun-faded
  const patch = (px, py) => 0.5 + 0.5 * Math.sin(px * 0.006 + 1.3) * Math.sin(py * 0.009 + 0.4) + 0.25 * Math.sin(px * 0.017 + py * 0.011);
  for (let row = 0; row * bh < H + bh; row++) {
    const off = (row % 2) * bw * 0.5 + (r() - 0.5) * 10;
    for (let col = -1; col * bw < W + bw; col++) {
      const bx = col * bw + off + 2 + (r() - 0.5) * 4, by = row * bh + 2 + (r() - 0.5) * 3;
      const v = Math.round(52 + 26 * patch(bx, by) + (r() - 0.5) * 14 - (r() < 0.1 ? 14 : 0));
      x.fillStyle = `rgb(${v},${v},${v})`;
      // (a joint washed out: the brick runs into its neighbour)
      const gap = r() < 0.35 ? 0 : 3;
      x.fillRect(bx, by, bw - gap + (r() - 0.5) * 6, bh - (r() < 0.3 ? 0 : 3));
      if (r() < 0.2) { x.fillStyle = `rgba(30,30,30,0.5)`; x.beginPath(); x.moveTo(bx, by); x.lineTo(bx + 10 + r() * 20, by); x.lineTo(bx, by + 6 + r() * 12); x.fill(); }
    }
  }
  // grime: long wet streaks down the wall, darker toward the foot
  for (let k = 0; k < 90; k++) {
    const sx = r() * W, len = 120 + r() * 700, w = 4 + r() * 22;
    const g = x.createLinearGradient(0, 0, 0, len);
    g.addColorStop(0, 'rgba(20,20,20,0)'); g.addColorStop(0.3, `rgba(20,20,20,${0.12 + r() * 0.2})`); g.addColorStop(1, 'rgba(20,20,20,0)');
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
      brick: std({ color: 0xa4a4a4, map: brickMap, bumpMap: brickMap, bumpScale: 0.25, roughness: 0.92, envMapIntensity: 0.18 }),
      stone: std({ color: 0x3c3c3c, roughness: 0.85 }),
      stepTop: std({ color: 0x5a5a5a, roughness: 0.9 }),
      iron: M.iron,
      rust: std({ color: 0x0a0a0a, roughness: 0.7, metalness: 0.3 }),
      door: std({ color: 0x101010, roughness: 0.75 }),
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
      // (brick courses in world metres: 1.8 m of wall a repeat)
      const uv = geo.getAttribute('uv'), p = geo.getAttribute('position');
      for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 2.4 * (facing < 0 ? -1 : 1), p.getY(i) / 2.3);
      return geo;
    };
    const wallS = add(face(A.zS - 0.01, -1), MAT.brick, { name: 'alley_wallS' });
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
      const zf = A.zS - 0.05;
      frame.push(rbox(0.14, D.h + 0.12, 0.12, D.x - D.w / 2 - 0.07, A.y + (D.h + 0.12) / 2, zf));
      frame.push(rbox(0.14, D.h + 0.12, 0.12, D.x + D.w / 2 + 0.07, A.y + (D.h + 0.12) / 2, zf));
      frame.push(rbox(D.w + 0.42, 0.2, 0.16, D.x, A.y + D.h + 0.14, zf - 0.01));
      add(frame, MAT.stone);
      // the door: planks in a frame, recessed, a dark glass light above
      const planks = [];
      for (let k = 0; k < 5; k++) planks.push(box(D.w / 5 - 0.012, D.h - 0.02, 0.05, D.x - D.w / 2 + (k + 0.5) * D.w / 5, A.y + D.h / 2, A.zS - 0.03));
      add(planks, MAT.door);
      add(box(0.05, 0.05, 0.03, D.x + D.w / 2 - 0.12, A.y + 1.0, A.zS - 0.07), MAT.iron);
      // the step: a worn slab of stone, a hollow in its middle
      const st = rbox(S.w, S.h, S.d, S.x, A.y + S.h / 2, A.zS - S.d / 2 - 0.005, 0.03);
      add(st, MAT.stepTop, { name: 'alley_step' });
      // the hood over the door: a slab on two iron brackets
      const hoodY = A.y + D.h + 0.42;
      // (it keeps the rain off the step, not the lamp's light: no shadow)
      add(rbox(D.w + 0.7, 0.09, 0.62, D.x, hoodY, A.zS - 0.31, 0.02), MAT.stone, { cast: false });
      const br = [];
      for (const sx of [-1, 1]) br.push(tube([V3(D.x + sx * (D.w / 2 + 0.2), hoodY - 0.5, A.zS - 0.02), V3(D.x + sx * (D.w / 2 + 0.2), hoodY - 0.15, A.zS - 0.35), V3(D.x + sx * (D.w / 2 + 0.2), hoodY - 0.05, A.zS - 0.55)], 0.015, 6, 12));
      add(br, MAT.iron, { cast: false });
      // (the hood keeps the rain off the step)
      stage.dry.push(new THREE.Box3(V3(D.x - D.w / 2 - 0.35, A.y - 0.2, A.zS - 0.62), V3(D.x + D.w / 2 + 0.35, hoodY, A.zS)));
      // a drainpipe down the wall, its shoe over the gutter's side
      const px = -15.6;
      const pipe = [cyl(0.05, 8.6, px, 4.45, A.zS - 0.08, 12), new THREE.CylinderGeometry(0.05, 0.07, 0.25, 12).rotateX(0.6).translate(px, 0.28, A.zS - 0.17)];
      for (let y = 1.2; y < 8.6; y += 2.1) pipe.push(new THREE.TorusGeometry(0.06, 0.012, 6, 14).rotateX(Math.PI / 2).translate(px, y, A.zS - 0.08));
      add(pipe, MAT.rust);
      // two dark windows up the wall, their sills
      const win = [], sill = [];
      for (const [wx, wy] of [[-17.2, 3.4], [-12.0, 6.9], [-19.8, 6.9]]) {
        win.push(box(1.0, 1.5, 0.04, wx, wy, A.zS - 0.02));
        sill.push(rbox(1.2, 0.08, 0.16, wx, wy - 0.8, A.zS - 0.07, 0.015), rbox(1.16, 0.1, 0.1, wx, wy + 0.8, A.zS - 0.04, 0.015));
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
    const ladder = {
      group: ladG, down: 0, rungs, x: L.x, z: lz, w: lw,
      // the ladder's foot, world y
      footY: () => A.y + L.up * (1 - ladder.down),
      set(k) { ladder.down = Math.max(0, Math.min(1, k)); ladG.position.y = A.y + L.up * (1 - ladder.down); },
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
      out.push(['box', S.x, A.zS - S.d / 2, S.w / 2, S.d / 2 + 0.02, 0, 'step']);
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
    stage.addAnchor('body.step', { pos: V3(S.x, STEP_TOP, A.zS - S.d / 2 - 0.01), yaw: Math.PI, size: [S.w - 0.1, S.d - 0.06] });
    stage.addAnchor('body.ladder', { pos: V3(L.x, A.y, zo + 0.75), yaw: 0 });
    stage.addAnchor('body.landing', { pos: V3(L.x + 0.55, E.y1, (zw + zo) / 2 + 0.05), yaw: 0 });
    // the walking surface: the step and, while the scene is on, the landing
    stage.addSurface((x, z) => (api.shown && Math.abs(x - S.x) < S.w / 2 && z > A.zS - S.d && z < A.zS ? STEP_TOP : undefined));
    // (the alley's own room: the street's rain, the gutters and the drains)
    stage.addLook(new THREE.Box3(V3(A.gateX, -1, A.zN), V3(A.mouthX - 0.3, 12, A.zS)), { room: 'alley' });

    const api = {
      group: g, meshes, lamp, bulb, ladder, escape: esc, walls: { S: wallS, N: wallN }, shown: false,
      stepTop: STEP_TOP,
      // the scene shows the place (and its colliders); the lamp is the scene's
      show(on = true) {
        api.shown = !!on;
        g.visible = !!on;
        setColliders(!!on);
        if (!on) api.light(false);
      },
      light(on = true) {
        lamp.on = !!on;
        lamp.cone.visible = !!on;
        if (bulb) bulb.visible = !!on;
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

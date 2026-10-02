import * as THREE from 'three';
import { DINER, DINER_SIGHT, dinerOpenings, dinerSightFrom } from '../site.js';
import { tagInk, allocInkId, LAYER } from '../../../render/layers.js';
import { accent, accentMaterial } from '../../../render/accents.js';
import { makeGlassMaterial, makeWindowLightMaterial } from '../../../render/glass.js';
import { boxWorldUV, merge, roundedBox, lathe, tube, V3 } from '../../../world/geom.js';

// The diner's street front (docs/story/CONTRACTS.md §15; lane 4's brief 1):
// a 1930s lunch-room front set into the stone of the four ground-floor bays
// between the pilasters at z = 11.6 and z = -6.0.
//   - a stall riser of dark glazed tile under the windows (pavement to
//     0.90), one thin steel trim line along its top
//   - plate glass in B1, B2, B4 (3.55 x 2.20, y 0.90 .. 3.10) in slim steel
//     frames, a band of ribbed transom glass above each (3.10 .. 3.40) that
//     the room's light glows through
//   - the door bay B3: a vestibule 0.4 deep with splayed side lights, the
//     leaf (glazed upper half, a push bar, a blind half drawn) hinged at
//     z = 0.12, opening inwards when the player walks into it; a bell on a
//     spring over it; the street number on the transom
//   - DINER in neon tube over B2 and B3 (accent 'neon'), each letter a
//     breakable of kind 'neon'; the N buzzes and drops out now and then
//   - a rolled canvas awning under the fascia, a gutter along its top that
//     drips a row of drops onto the pavement
//   - the room's light lying on the wet pavement through each window, and
//     the sign's blue on it
// API (stage.part('dinerFront')):
//   door    { object, leaf, open(), close(), isOpen, angle (0 shut .. 1 open),
//             on('open' | 'close', fn) }    the leaf, hinged at z = 0.12,
//             opens inwards when the player comes to it, closes behind him;
//             its collider follows the leaf
//   panes   { B1, B2, B4, B3L, B3R, door }  (destruct/Glass.js panes:
//             pane.state, game.glass.hit / shatter; B4 is the end bay, the
//             KO window)
//   sign    { letters: [{ ch, group, handle }], setOn(on) }
//   group   the front's meshes    near   true while the room's light counts
//           (the eye inside, or the front in view within 30 m: site.js)
// The front is always drawn and always solid; only the room's light is an
// optimisation (site.js DINER_SIGHT, read by parts/diner.js).
const NEON_H = 0.55;          // letter height (m)
const NEON_R = 0.009;         // tube radius: 18 mm tubes
const XF = -10.1;             // the shopfront's glass line (the wall face is -10.2)
const XR = -10.06;            // the stall riser's face
const XD = -10.5;             // the door's plane, 0.4 behind the shopfront line
const PIL_FACE = -9.77;       // the pilasters' street face (world/Facade.js)

export default {
  name: 'dinerFront', order: 130, tick: 130,
  build(stage) {
    const { M, colliders } = stage;
    const D = DINER, X = D.faceX, Xi = D.innerX, F = D.floorY, W = D.window;
    const rng = stage.rng.fork(1304);
    const g = new THREE.Group();
    g.name = 'dinerFront';
    stage.scene.add(g);
    const ops = dinerOpenings();
    const std = (o) => new THREE.MeshStandardMaterial(o);
    const MM = {
      tile: std({ color: 0x0b0b0b, roughness: 0.32, metalness: 0, envMap: M.envSoft, envMapIntensity: 0.55 }),
      steel: std({ color: 0x151515, roughness: 0.45, metalness: 0.4, envMap: M.envSoft, envMapIntensity: 0.5 }),
      trim: M.seam,
      fascia: std({ color: 0x080808, roughness: 0.7, metalness: 0.1, envMap: M.envSoft, envMapIntensity: 0.25 }),
      canvas: std({ color: 0x171717, roughness: 0.95, metalness: 0 }),
      blind: std({ color: 0x3a3a3a, roughness: 0.95, metalness: 0, side: THREE.DoubleSide }),
      brass: std({ color: 0x6a6a6a, roughness: 0.35, metalness: 0.9, envMap: M.envSoft, envMapIntensity: 0.9 }),
    };
    const meshes = [];
    let awning = null;
    const mesh = (geo, mat, { cast = true, parent = g, id = null } = {}) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = cast; m.receiveShadow = true;
      parent.add(m);
      if (id != null) tagInk(m, id);
      meshes.push(m);
      return m;
    };
    const boxG = (x0, x1, y0, y1, z0, z1) => new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);

    // ---- the stone wall round the openings (floor to the room's ceiling;
    // the building's mass stands above it). The door bay is one opening,
    // floor to transom: the vestibule.
    const wallParts = [];
    const slab = (za, zb, ya, yb) => { if (zb - za > 1e-3 && yb - ya > 1e-3) wallParts.push(boxG(Xi, X, ya, yb, za, zb)); };
    const B3 = D.bays.B3, half = W.w / 2;
    const cuts = [
      ...ops.filter((o) => !o.name.startsWith('B3') && !o.door),
      { name: 'B3', z0: B3 - half, z1: B3 + half, y0: F, y1: W.transom },
    ].sort((a, b) => a.z0 - b.z0);
    let z = D.zMin;
    for (const o of cuts) {
      slab(z, o.z0, F, D.ceilY);
      slab(o.z0, o.z1, F, o.y0);
      slab(o.z0, o.z1, o.y1, D.ceilY);
      z = o.z1;
    }
    slab(z, D.zMax, F, D.ceilY);
    const wall = mesh(boxWorldUV(merge(wallParts), 1 / 12), M.stone, { id: allocInkId() });
    wall.name = 'dinerFrontWall';

    // ---- the stall risers and their steel trim line, the window frames
    const idFront = allocInkId();
    const riser = [], steel = [], trim = [];
    const winOps = ops.filter((o) => !o.door && !o.name.startsWith('B3'));
    for (const o of winOps) {
      // (the riser fills the bay between the pilasters' flanks)
      const za = o.z0 - 0.04, zb = o.z1 + 0.04;
      riser.push(roundedBox(XR - Xi + 0.02, W.sill - F, zb - za, 0.012, 2).translate((XR + Xi - 0.02) / 2, (F + W.sill) / 2, (za + zb) / 2));
      trim.push(roundedBox(0.035, 0.022, zb - za, 0.008, 2).translate(XR + 0.005, W.sill + 0.004, (za + zb) / 2));
      // slim steel frame: jambs, head, the transom bar and the top bar
      for (const zj of [o.z0 + 0.025, o.z1 - 0.025]) steel.push(roundedBox(0.07, W.transom - W.sill, 0.05, 0.01, 2).translate(XF, (W.sill + W.transom) / 2, zj));
      steel.push(roundedBox(0.075, 0.05, o.z1 - o.z0, 0.01, 2).translate(XF + 0.005, W.sill + 0.03, (o.z0 + o.z1) / 2));
      steel.push(roundedBox(0.08, 0.045, o.z1 - o.z0, 0.01, 2).translate(XF + 0.005, W.head, (o.z0 + o.z1) / 2));
      steel.push(roundedBox(0.07, 0.04, o.z1 - o.z0, 0.01, 2).translate(XF, W.transom - 0.02, (o.z0 + o.z1) / 2));
      // transom glazing bars: the ribbed band in three lights
      for (const k of [1, 2]) steel.push(roundedBox(0.05, W.transom - W.head, 0.03, 0.008, 2).translate(XF, (W.head + W.transom) / 2, o.z0 + (o.z1 - o.z0) * k / 3));
    }

    // ---- the door bay B3: a vestibule 0.4 deep, splayed side lights
    const dz = D.door, dz0 = dz.hingeZ, dz1 = dz.hingeZ + dz.w;
    const bz0 = B3 - half, bz1 = B3 + half;
    const doorTop = F + dz.h;
    riser.push(roundedBox(XR - Xi + 0.02, W.sill - F, 0.3, 0.012, 2).translate((XR + Xi - 0.02) / 2, (F + W.sill) / 2, bz0 + 0.11));
    riser.push(roundedBox(XR - Xi + 0.02, W.sill - F, 0.3, 0.012, 2).translate((XR + Xi - 0.02) / 2, (F + W.sill) / 2, bz1 - 0.11));
    // the splayed sides: from the shopfront line at the bay's edges back to
    // the door's jambs; riser below, glass above, steel at both ends
    const splay = [];
    for (const [za, zb] of [[bz0 + 0.26, dz0 - 0.05], [bz1 - 0.26, dz1 + 0.05]]) {
      const a = V3(XF, 0, za), b = V3(XD + 0.02, 0, zb);
      const len = a.distanceTo(b), mid = a.clone().add(b).multiplyScalar(0.5);
      const ang = Math.atan2(b.x - a.x, b.z - a.z);      // (rotation about y of a box along z)
      const put = (geo) => geo.rotateY(ang).translate(mid.x, 0, mid.z);
      riser.push(put(new THREE.BoxGeometry(0.12, W.sill - F, len).translate(0, (F + W.sill) / 2, 0)));
      trim.push(put(new THREE.BoxGeometry(0.03, 0.022, len).translate(0.045, W.sill + 0.004, 0)));
      steel.push(put(new THREE.BoxGeometry(0.07, 0.05, len).translate(0, W.sill + 0.03, 0)));
      steel.push(put(new THREE.BoxGeometry(0.07, 0.045, len).translate(0, doorTop + 0.02, 0)));
      steel.push(put(new THREE.BoxGeometry(0.07, 0.04, len).translate(0, W.transom - 0.02, 0)));
      splay.push({ a, b, len, mid, ang });
    }
    // the shopfront posts at the bay's edges and the door's jambs and head
    for (const zp of [bz0 + 0.24, bz1 - 0.24]) steel.push(roundedBox(0.09, W.transom - F, 0.06, 0.012, 2).translate(XF, (F + W.transom) / 2, zp));
    for (const zp of [dz0 - 0.035, dz1 + 0.035]) steel.push(roundedBox(0.1, W.transom - F, 0.07, 0.012, 2).translate(XD, (F + W.transom) / 2, zp));
    steel.push(roundedBox(0.1, 0.07, dz1 - dz0 + 0.14, 0.012, 2).translate(XD, doorTop + 0.035, (dz0 + dz1) / 2));
    // the vestibule's ceiling (a soffit at the transom) and the band of
    // stone between the posts and the pilasters
    riser.push(boxG(XD - 0.05, XF, W.transom - 0.02, W.transom + 0.04, bz0 + 0.2, bz1 - 0.2));
    // the fascia's lower lip over the whole bay line (the shopfront head)
    steel.push(roundedBox(0.1, 0.07, D.pilasters[0] - D.pilasters[4] - 0.75, 0.015, 2).translate(XF + 0.01, W.transom + 0.03, (D.pilasters[0] + D.pilasters[4]) / 2));
    mesh(merge(riser), MM.tile, { id: idFront });
    mesh(merge(steel), MM.steel, { id: idFront });
    mesh(merge(trim), MM.trim, { id: idFront, cast: false });

    // ---- the plate glass (lane 3's panes; lane 1's glass)
    const panes = {};
    const glassMat = () => makeGlassMaterial({ wet: 1, side: 'out' });
    for (const o of winOps) {
      const h = W.head - W.sill - 0.05;
      panes[o.name] = stage.glass.addPane({
        centre: V3(XF - 0.01, W.sill + 0.05 + h / 2, (o.z0 + o.z1) / 2), normal: V3(1, 0, 0),
        w: o.z1 - o.z0 - 0.05, h, tag: 'diner.' + o.name, parent: g, material: glassMat(),
      });
    }
    // the splayed side lights: panes of their own, turned with the splay
    splay.forEach((s, i) => {
      const n = V3(Math.cos(s.ang), 0, -Math.sin(s.ang));
      if (n.x < 0) n.negate();
      const h = doorTop - W.sill - 0.05;
      panes[i === 0 ? 'B3L' : 'B3R'] = stage.glass.addPane({
        centre: V3(s.mid.x, W.sill + 0.05 + h / 2, s.mid.z), normal: n, w: s.len - 0.04, h, tag: 'diner.' + (i === 0 ? 'B3L' : 'B3R'), parent: g, material: glassMat(),
      });
    });

    // ---- the ribbed transom glass: the room's light glowing through
    // reeded glass (a soft band, a little brighter at its middle, with
    // irregular reeds: drawn on a canvas, never a regular stripe)
    const transomTex = (() => {
      const c = document.createElement('canvas');
      c.width = 256; c.height = 32;
      const x = c.getContext('2d');
      const gr = x.createLinearGradient(0, 0, 0, 32);
      gr.addColorStop(0, '#5a5a5a'); gr.addColorStop(0.5, '#8c8c8c'); gr.addColorStop(1, '#4e4e4e');
      x.fillStyle = gr; x.fillRect(0, 0, 256, 32);
      let u = 0;
      while (u < 256) {
        const w = 2 + rng.next() * 4;
        x.fillStyle = `rgba(0,0,0,${0.08 + rng.next() * 0.22})`;
        x.fillRect(u, 0, w * 0.45, 32);
        u += w;
      }
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    const transomMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.2, 0.2), map: transomTex });
    const transoms = [];
    for (const o of winOps) transoms.push(new THREE.PlaneGeometry(o.z1 - o.z0 - 0.06, W.transom - W.head - 0.06).rotateY(Math.PI / 2).translate(XF - 0.02, (W.head + W.transom) / 2, (o.z0 + o.z1) / 2));
    for (const s of splay) transoms.push(new THREE.PlaneGeometry(s.len - 0.06, W.transom - doorTop - 0.09).rotateY(s.ang + Math.PI / 2).translate(s.mid.x, (doorTop + 0.05 + W.transom - 0.04) / 2, s.mid.z));
    // (one mesh each: merge() drops the uvs the reeds need)
    for (const q of transoms) mesh(q, transomMat, { cast: false, id: idFront }).userData.noRay = true;

    // ---- the street number on the transom over the door
    {
      const c = document.createElement('canvas');
      c.width = 256; c.height = 128;
      const x = c.getContext('2d');
      x.fillStyle = '#0a0a0a'; x.fillRect(0, 0, 256, 128);
      x.fillStyle = '#d8d8d8';
      x.font = 'bold 92px "Bodoni 72", Didot, Georgia, serif';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('714', 128, 70);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      const h = W.transom - doorTop - 0.12;
      const m = mesh(new THREE.PlaneGeometry(dz.w - 0.04, h).rotateY(Math.PI / 2).translate(XD + 0.012, doorTop + 0.07 + h / 2, (dz0 + dz1) / 2),
        new THREE.MeshStandardMaterial({ map: t, roughness: 0.3, metalness: 0.2, envMap: M.envSoft, envMapIntensity: 0.6 }), { cast: false, id: idFront });
      m.userData.noRay = true;
    }

    // ---- the door: a leaf hinged at its south jamb, opening inwards;
    // glazed upper half, a push bar, a blind half drawn behind the glass
    const hinge = new THREE.Group();
    hinge.position.set(XD, F, dz0);
    g.add(hinge);
    const idDoor = allocInkId();
    const leafParts = [];
    const lw = dz.w, lh = dz.h, lt = 0.045;
    const rail = (y0, y1) => leafParts.push(roundedBox(lt, y1 - y0, lw, 0.01, 2).translate(-0.03, (y0 + y1) / 2, lw / 2));
    rail(0, 0.95);                                   // the kick panel (solid lower half)
    rail(lh - 0.09, lh);                             // the top rail
    for (const zs of [0.05, lw - 0.05]) leafParts.push(roundedBox(lt, lh, 0.1, 0.01, 2).translate(-0.03, lh / 2, zs));
    const leaf = mesh(merge(leafParts), MM.steel, { parent: hinge, id: idDoor });
    leaf.name = 'dinerDoor';
    // the push bar across the outside, on two stand-offs
    const bar = merge([
      new THREE.CylinderGeometry(0.016, 0.016, lw - 0.3, 16).rotateX(Math.PI / 2).translate(0.035, 1.05, lw / 2),
      new THREE.CylinderGeometry(0.01, 0.01, 0.06, 10).rotateZ(Math.PI / 2).translate(0.01, 1.05, 0.2),
      new THREE.CylinderGeometry(0.01, 0.01, 0.06, 10).rotateZ(Math.PI / 2).translate(0.01, 1.05, lw - 0.2),
    ]);
    mesh(bar, MM.brass, { parent: hinge, id: idDoor, cast: false });
    // the blind: drawn down over the top half of the glazing, inside
    const gy0 = 0.95, gy1 = lh - 0.09;
    const blindH = (gy1 - gy0) * 0.5;
    mesh(new THREE.PlaneGeometry(lw - 0.2, blindH).rotateY(Math.PI / 2).translate(-0.07, gy1 - blindH / 2, lw / 2), MM.blind, { parent: hinge, cast: false, id: idDoor });
    mesh(new THREE.CylinderGeometry(0.012, 0.012, lw - 0.18, 10).rotateX(Math.PI / 2).translate(-0.07, gy1 - blindH, lw / 2), MM.steel, { parent: hinge, cast: false, id: idDoor });
    panes.door = stage.glass.addPane({
      centre: V3(-0.03, (gy0 + gy1) / 2, lw / 2), normal: V3(1, 0, 0), w: lw - 0.2, h: gy1 - gy0, tag: 'diner.door', parent: hinge, material: glassMat(),
    });

    // the bell on its spring over the door (inside, on the head jamb)
    const bellPivot = new THREE.Group();
    bellPivot.position.set(XD - 0.12, doorTop - 0.02, dz1 - 0.18);
    g.add(bellPivot);
    const spring = [];
    for (let i = 0; i <= 24; i++) { const u = i / 24; spring.push(V3(0.02 * Math.sin(u * 18), -0.02 - u * 0.1, 0.02 * Math.cos(u * 18))); }
    mesh(tube(spring, 0.003, 5, 60), MM.steel, { parent: bellPivot, cast: false, id: idDoor });
    const bellGeo = lathe([[0.0, 0.0], [0.03, -0.005], [0.045, -0.03], [0.05, -0.06], [0.062, -0.075], [0.058, -0.08], [0.0, -0.08]], 24).translate(0, -0.12, 0);
    const bellM = mesh(bellGeo, MM.brass, { parent: bellPivot, cast: false, id: idDoor });
    bellM.userData.noRay = true;

    // ---- the fascia over B2 and B3, the neon, the transformer and cable
    const fz0 = D.pilasters[3] - 0.36, fz1 = D.pilasters[1] + 0.36;   // (-1.96 .. 7.56)
    const fy0 = W.transom + 0.04, fy1 = fy0 + 0.92;
    const fx0 = PIL_FACE, fx1 = PIL_FACE + 0.14;
    const idSign = allocInkId();
    mesh(roundedBox(fx1 - fx0, fy1 - fy0, fz1 - fz0, 0.03, 3).translate((fx0 + fx1) / 2, (fy0 + fy1) / 2, (fz0 + fz1) / 2), MM.fascia, { id: idSign });
    // a thin steel edge round the panel
    mesh(merge([
      roundedBox(0.03, 0.03, fz1 - fz0 + 0.02, 0.01, 2).translate(fx1 + 0.005, fy1 - 0.03, (fz0 + fz1) / 2),
      roundedBox(0.03, 0.03, fz1 - fz0 + 0.02, 0.01, 2).translate(fx1 + 0.005, fy0 + 0.03, (fz0 + fz1) / 2),
    ]), MM.trim, { id: idSign, cast: false });
    // the letters: tube strokes with filleted corners, drawn in a letter's
    // own box (u across, v up, in letter heights), read along -z from the
    // street (the viewer faces -x: his right hand is -z)
    const E = [];   // [u, v] polylines per letter; ellipse arcs sampled
    const arc = (cx, cy, rx, ry, a0, a1, n = 18) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)]; });
    const GLYPH = {
      D: { w: 0.78, strokes: [[[0, 0], [0, 1], [0.34, 1], ...arc(0.34, 0.5, 0.44, 0.5, Math.PI / 2, -Math.PI / 2).slice(1, -1), [0.34, 0], [0, 0]]] },
      I: { w: 0.0, strokes: [[[0, 0], [0, 1]]] },
      N: { w: 0.74, strokes: [[[0, 0], [0, 1], [0.74, 0], [0.74, 1]]] },
      E: { w: 0.62, strokes: [[[0.62, 1], [0, 1], [0, 0], [0.62, 0]], [[0, 0.52], [0.46, 0.52]]] },
      R: { w: 0.7, strokes: [[[0, 0], [0, 1], [0.36, 1], ...arc(0.36, 0.745, 0.3, 0.255, Math.PI / 2, -Math.PI / 2).slice(1, -1), [0.36, 0.49], [0, 0.49]], [[0.3, 0.49], [0.7, 0]]] },
    };
    void E;
    const word = 'DINER', track = 0.42;
    const total = [...word].reduce((s, ch) => s + GLYPH[ch].w * NEON_H, 0) + track * (word.length - 1);
    const sz = (fz0 + fz1) / 2 + total / 2;   // the word's start (its left, +z)
    const ny = 3.85 - NEON_H / 2;             // (y centre 3.85)
    const nx = fx1 + 0.07;                    // tube centres, on stand-offs
    // (lane 1's tube: widened to at least 3.5 px on screen, white-hot core,
    // blue halo; on the world layer it leaves its own sheen in the street)
    const neonOn = accentMaterial('neon', { tube: NEON_R });
    neonOn.name = 'neon_on';
    // an unlit tube: dark glass
    const neonOff = std({ color: 0x1c1c1c, roughness: 0.25, metalness: 0.2, envMap: M.envSoft, envMapIntensity: 0.8 });
    const letters = [];
    let u0 = 0;
    const fillet = (pts, r) => {
      // polyline -> dense points with round corners (a bent glass tube)
      const P = pts.map(([u, v]) => new THREE.Vector2(u, v));
      const out = [P[0].clone()];
      for (let i = 1; i < P.length - 1; i++) {
        const a = P[i - 1], b = P[i], c = P[i + 1];
        const d0 = b.clone().sub(a), d1 = c.clone().sub(b);
        const l0 = d0.length(), l1 = d1.length();
        d0.normalize(); d1.normalize();
        const turn = Math.acos(THREE.MathUtils.clamp(d0.dot(d1), -1, 1));
        if (turn < 0.2) { out.push(b.clone()); continue; }
        const rr = Math.min(r, l0 * 0.45, l1 * 0.45);
        const p0 = b.clone().addScaledVector(d0, -rr), p1 = b.clone().addScaledVector(d1, rr);
        for (let k = 0; k <= 6; k++) {
          const t = k / 6;
          // quadratic bezier p0 -> b -> p1
          out.push(new THREE.Vector2((1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * b.x + t * t * p1.x, (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * b.y + t * t * p1.y));
        }
      }
      out.push(P[P.length - 1].clone());
      return out;
    };
    const idNeon = allocInkId();
    for (const ch of word) {
      const gl = GLYPH[ch];
      const lg = new THREE.Group();
      lg.name = 'neon_' + ch;
      g.add(lg);
      const tubes = [], caps = [], stand = [];
      const toW = (p) => V3(nx, ny + p.y * NEON_H, sz - (u0 + p.x * NEON_H));
      for (const st of gl.strokes) {
        const d = fillet(st, 0.07).map((p) => new THREE.Vector2(p.x * NEON_H, p.y * NEON_H));
        // resample evenly (the tube's segments do not bunch at the corners)
        const pts = [];
        for (let i = 0; i < d.length - 1; i++) {
          const a = d[i], b = d[i + 1], n = Math.max(1, Math.ceil(a.distanceTo(b) / 0.02));
          for (let k = 0; k < n; k++) pts.push(a.clone().lerp(b, k / n));
        }
        pts.push(d[d.length - 1]);
        const w = pts.map((p) => V3(nx, ny + p.y, sz - (u0 + p.x)));
        tubes.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(w, false, 'centripetal'), w.length * 2, NEON_R, 10, false));
        // the tube's ends bend back into the fascia: dark electrode caps
        for (const e of [w[0], w[w.length - 1]]) caps.push(new THREE.CylinderGeometry(0.016, 0.016, 0.07, 12).rotateZ(Math.PI / 2).translate(e.x - 0.035, e.y, e.z));
        void toW;
      }
      // stand-offs every ~0.25 m of stroke
      for (const st of gl.strokes) for (let i = 0; i < st.length; i += 2) {
        const p = st[i];
        stand.push(new THREE.CylinderGeometry(0.005, 0.005, 0.07, 6).rotateZ(Math.PI / 2).translate(nx - 0.035, ny + p[1] * NEON_H, sz - (u0 + p[0] * NEON_H)));
      }
      const tubeM = new THREE.Mesh(merge(tubes), neonOn);
      tubeM.userData.inkId = idNeon;
      tubeM.userData.noRay = true;
      lg.add(tubeM);
      mesh(merge([...caps, ...stand]), MM.steel, { parent: lg, cast: false, id: idNeon });
      // the bullets' target: an invisible box round the letter
      const bw = Math.max(gl.w * NEON_H, 0.06);
      const proxy = new THREE.Mesh(new THREE.BoxGeometry(0.08, NEON_H + 0.04, bw + 0.04).translate(nx, ny + NEON_H / 2, sz - u0 - bw / 2), new THREE.MeshBasicMaterial({ visible: false }));
      proxy.visible = false;
      lg.add(proxy);
      const handle = stage.breakables.add(lg, { kind: 'neon', hp: 1 });
      letters.push({ ch, group: lg, tube: tubeM, handle, lit: true });
      u0 += gl.w * NEON_H + track;
    }
    // the underline: one tube under the word, its ends turned into the panel
    {
      const y = ny - 0.1, za = sz + 0.05, zb = sz - total - 0.05;
      const ul = new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(V3(nx, y, za), V3(nx, y, zb)), 64, NEON_R, 10, false), neonOn);
      ul.userData.inkId = idNeon;
      ul.userData.noRay = true;
      g.add(ul);
      mesh(merge([za, zb].map((zz) => new THREE.CylinderGeometry(0.016, 0.016, 0.07, 12).rotateZ(Math.PI / 2).translate(nx - 0.035, y, zz))), MM.steel, { cast: false, id: idNeon });
      letters.underline = ul;
    }
    // the transformer box on top of the fascia's end and its cable into
    // the wall
    {
      const tb = V3(fx0 + 0.02, fy1 + 0.13, fz0 + 0.45);
      mesh(roundedBox(0.3, 0.24, 0.42, 0.02, 2).translate(tb.x - 0.12, tb.y, tb.z), MM.steel, { id: idSign });
      const a = V3(tb.x - 0.2, tb.y + 0.02, tb.z + 0.21), b = V3(X + 0.02, fy1 + 0.55, fz0 + 1.2);
      const cable = [];
      for (let i = 0; i <= 12; i++) { const t = i / 12; const p = a.clone().lerp(b, t); p.y -= 0.12 * Math.sin(Math.PI * t); cable.push(p); }
      mesh(tube(cable, 0.008, 6, 40), MM.steel, { cast: false, id: idSign }).userData.noRay = true;
    }

    // ---- the rolled canvas awning on its bar under the fascia, and the
    // gutter along the fascia's top with its downpipe
    {
      const ay = fy0 - 0.16, ax = fx1 - 0.04, za = fz0 + 0.15, zb = fz1 - 0.15;
      const roll = lathe([[0.0, 0], [0.1, 0], [0.13, 0.03], [0.14, 0.12], [0.14, zb - za - 0.12], [0.13, zb - za - 0.03], [0.1, zb - za], [0.0, zb - za]], 28);
      roll.rotateX(Math.PI / 2).translate(ax, ay, za);   // (the roll runs from za to zb, over B2..B3)
      const fl = new THREE.PlaneGeometry(zb - za - 0.1, 0.16).rotateY(Math.PI / 2).rotateZ(-0.35).translate(ax + 0.13, ay - 0.13, (za + zb) / 2);
      awning = mesh(merge([roll, fl]), MM.canvas, { id: allocInkId() });
      // (lane 3's awning dumps its water off its front edge: its local x
      // along it, local +z toward the street, the origin on the roll's axis)
      awning.geometry.translate(-ax, -ay, -(za + zb) / 2).rotateY(-Math.PI / 2);
      awning.position.set(ax, ay, (za + zb) / 2);
      awning.rotation.y = Math.PI / 2;
      awning.userData.awning = { w: zb - za, d: 0.3 };
      const brk = [];
      for (const zz of [za - 0.04, zb + 0.04]) {
        brk.push(roundedBox(0.34, 0.05, 0.04, 0.01, 2).translate(ax - 0.12, ay, zz));
        brk.push(new THREE.CylinderGeometry(0.02, 0.02, 0.08, 12).rotateX(Math.PI / 2).translate(ax, ay, zz));
      }
      // the crank eye at the north end
      brk.push(new THREE.TorusGeometry(0.03, 0.006, 6, 16).translate(ax, ay - 0.07, zb + 0.07));
      mesh(merge(brk), MM.steel, { cast: false, id: idSign });
      // gutter: a half-round on the fascia's top front edge
      const gx = fx1 - 0.02, gy = fy1 + 0.02, gl = fz1 - fz0 + 0.1;
      const gut = new THREE.CylinderGeometry(0.055, 0.055, gl, 16, 1, true, Math.PI / 2, Math.PI).rotateX(Math.PI / 2).translate(gx, gy, (fz0 + fz1) / 2);
      const pipe = [
        new THREE.CylinderGeometry(0.04, 0.04, gy - F + 0.02, 14).translate(gx - 0.02, (gy + F) / 2, fz1 - 0.02),
        new THREE.CylinderGeometry(0.052, 0.052, 0.06, 14).translate(gx - 0.02, F + 0.03, fz1 - 0.02),
      ];
      const gm = mesh(merge([gut, ...pipe]), MM.steel, { id: allocInkId() });
      gm.material = MM.steel.clone(); gm.material.side = THREE.DoubleSide;
      stage.breakables.add(gm, { kind: 'pipe', hp: 3 });
    }

    // ---- the drops from the gutter: a row of drips falling to the
    // pavement, each on its own clock (drawn, never inked)
    const drips = [];
    {
      const n = 22;
      const geo = new THREE.CylinderGeometry(0.004, 0.004, 1, 5).translate(0, -0.5, 0);
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.14, 0.14, 0.14), transparent: true, opacity: 0.85, depthWrite: false });
      const im = new THREE.InstancedMesh(geo, mat, n);
      im.layers.set(LAYER.FX);
      im.frustumCulled = false;
      im.userData.noRay = true;
      g.add(im);
      for (let i = 0; i < n; i++) {
        const zz = fz0 + 0.1 + (fz1 - fz0 - 0.2) * (i + rng.range(0.15, 0.85)) / n;
        drips.push({ z: zz, x: fx1 + 0.02 + rng.range(-0.015, 0.03), period: rng.range(1.05, 2.6), phase: rng.range(0, 3) });
      }
      drips.mesh = im;
      drips.top = fy1 + 0.0;
    }

    // ---- the room's light on the wet pavement through each window, and
    // the sign's blue: both broken by the wet (a soft fall-off from the
    // front, torn into puddle shapes, never a clean-edged card: the ink
    // pass keeps a colour by a threshold, so a smooth blue wash would print
    // as a hard ellipse)
    const puddleTex = (seed, fall) => {
      const r = stage.rng.fork(seed);
      const c = document.createElement('canvas');
      c.width = 256; c.height = 256;
      const x = c.getContext('2d');
      x.fillStyle = '#000'; x.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 70; i++) {
        const cx = r.range(0, 256), cy = r.range(0, 256), rx = r.range(10, 46), ry = rx * r.range(0.3, 0.8);
        x.fillStyle = `rgba(255,255,255,${r.range(0.35, 0.9).toFixed(2)})`;
        x.beginPath(); x.ellipse(cx, cy, rx, ry, r.range(0, 3.14), 0, Math.PI * 2); x.fill();
      }
      x.globalCompositeOperation = 'destination-in';
      x.fillStyle = fall(x); x.fillRect(0, 0, 256, 256);
      return new THREE.CanvasTexture(c);
    };
    const pools = [];
    for (const o of winOps) {
      const wz = o.z1 - o.z0, len = 2.9;
      const m = makeWindowLightMaterial({ w: wz, h: len, slats: 0 });
      // (lane 1's stub is a clean-edged card: give it a fall-off of its own)
      if (m.name === 'windowLightStub' && !m.map) {
        m.map = puddleTex(1310 + pools.length, (x) => { const gr = x.createLinearGradient(0, 0, 256, 0); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); return gr; });
        m.opacity = 0.09;
      }
      const p = new THREE.Mesh(new THREE.PlaneGeometry(len, wz * 0.96).rotateX(-Math.PI / 2).translate(XR + len / 2 + 0.02, F + 0.004, (o.z0 + o.z1) / 2), m);
      p.layers.set(LAYER.FX);
      p.userData.noRay = true;
      g.add(p);
      pools.push(p);
    }
    // (the sign's blue on the wet pavement is lane 1's reflection of the
    // tubes now: no patch of its own)
    letters.sheen = null;

    // ---- colliders: the front (risers and walls) except the vestibule,
    // the splayed sides, the pilasters, the door (it follows the leaf); the
    // outer net's regions: the pavement against the front, the vestibule,
    // the doorway, the room
    const cz0 = D.zMin - 0.3, cz1 = D.zMax + 0.3;
    const wx0 = Xi, wx1 = XR + 0.01;
    const wallBox = (za, zb) => colliders.addBox((wx0 + wx1) / 2, (za + zb) / 2, (wx1 - wx0) / 2, (zb - za) / 2, 0, 'wall');
    const wallBoxes = [wallBox(cz0, bz0 + 0.26), wallBox(bz1 - 0.26, cz1)];
    for (const s of splay) colliders.addBox(s.mid.x, s.mid.z, 0.06, s.len / 2, s.ang, 'wall');
    for (const pz of D.pilasters) colliders.addBox(X + 0.18, pz, 0.26, D.pilasterW / 2, 0, 'wall');
    const col = colliders.addBox(XD - 0.03, (dz0 + dz1) / 2, 0.04, dz.w / 2, 0, 'door');
    colliders.addRegion(XD - 0.05, X + 1.2, bz0 + 0.26, bz1 - 0.26, 'diner.vestibule');
    colliders.addRegion(Xi - 1.2, X + 1.2, dz0, dz1, 'diner.door');
    colliders.addRegion(D.backX, Xi, D.zMin, D.zMax, 'diner');
    // the wall's thickness behind the plate glass is indoors: no rain falls
    // in the reveals, and the ink prints them calm like the room (lane 1:
    // an untagged surface in a dry box is plaster). The door bay's
    // vestibule is left out: it is open to the street.
    for (const [za, zb] of [[D.zMin - 0.45, bz0], [bz1, D.zMax + 0.45]]) {
      stage.dry.push(new THREE.Box3(new THREE.Vector3(Xi - 0.02, F - 0.2, za), new THREE.Vector3(XF - 0.02, D.ceilY, zb)));
    }
    stage.addAnchor('diner.door.out', { pos: { x: X + 0.9, y: F, z: dz0 + dz.w / 2 }, yaw: -Math.PI / 2, r: 1.0 });
    stage.addAnchor('diner.door.in', { pos: { x: Xi - 0.9, y: F, z: dz0 + dz.w / 2 }, yaw: Math.PI / 2, r: 1.0 });
    stage.addAnchor('diner.pavement.ko', { pos: { x: -8.9, y: 0.15, z: D.bays.B4 + 0.2 }, yaw: Math.PI / 2, r: 1.6 });

    const listeners = { open: [], close: [], slam: [], rattle: [] };
    // [C4] a push door (WAVE_C §6 II, the brief's §4): it opens OUTWARD, onto
    // the pavement, on its closer. From inside it is pushed: walking into it
    // (or E) swings it open as far and as fast as I push, and it never passes
    // through me or anyone (the leaf is kept clear of every body near it);
    // from the street it is pulled (E, door.pull()). Let go, the closer
    // swings it back - never through a body - and it shuts with a knock (a
    // hard shut: 'slam'). door.barred: shut and barred (the fight): a push
    // gives it a centimetre, the bar knocks in its brackets, the bell
    // shivers ('rattle'). The bar itself (door.makeBar(), built on demand so
    // no other scene's frame changes): an iron flat bar on a pivot at the
    // latch jamb, inside; stowed upright, it swings down across the door into
    // a bracket on the hinge jamb (door.dropBar(), door.liftBar()).
    // door.angle 0..1 as before (1: open as far as it goes, OPEN_MAX).
    const door = {
      object: hinge, leaf, collider: col, angle: 0, target: 0, isOpen: false, holdT: 0,
      bell: { pivot: bellPivot, a: 0, v: 0 },
      barred: false, shut: false, push: 0, block: 1, rattleT: 0, jig: 0, bar: null, slamV: 0,
      on(ev, fn) { (listeners[ev] || (listeners[ev] = [])).push(fn); return door; },
      emit(ev) { for (const f of listeners[ev] || []) f(door); },
      open() { if (door.barred) { door.tried(); return; } if (door.target !== 1) { door.target = 1; door.bell.v += 5; } door.holdT = 1.5; },
      close() { if (door.target !== 0) { door.target = 0; door.bell.v -= 3; door.emit('close'); } },
      // from the street: E pulls it open toward me (it stops at whoever stands in its way)
      pull() { door.open(); door.holdT = 2.5; },
      // tried while barred: a centimetre, the knock, the bell's shiver
      tried() {
        if (door.rattleT > 0) return;
        door.rattleT = 0.8; door.jig = 1; door.bell.v += 2;
        door.emit('rattle');
      },
      makeBar() {
        if (door.bar) return door.bar;
        // (the pivot on the latch jamb's inside face at the push bar's height)
        const piv = new THREE.Group();
        piv.position.set(XD - 0.075, F + 1.05, dz1 + 0.035);
        g.add(piv);
        const L = dz.w + 0.02;
        const barGeo = merge([
          roundedBox(0.02, 0.065, L, 0.006, 2).translate(0, 0, -L / 2 + 0.03),
          new THREE.CylinderGeometry(0.022, 0.022, 0.04, 14).rotateZ(Math.PI / 2),
        ]);
        const barM = mesh(barGeo, MM.steel, { parent: piv, id: idDoor, cast: false });
        // the brackets: the pivot's plate on the latch jamb, the open hook
        // on the hinge jamb the bar drops into; the keeper that holds it up
        const brk = merge([
          roundedBox(0.03, 0.14, 0.05, 0.006, 2).translate(XD - 0.07, F + 1.05, dz1 + 0.04),
          roundedBox(0.05, 0.02, 0.07, 0.004, 2).translate(XD - 0.085, F + 1.0, dz0 - 0.01),
          roundedBox(0.014, 0.08, 0.07, 0.004, 2).translate(XD - 0.11, F + 1.05, dz0 - 0.01),
          roundedBox(0.03, 0.05, 0.05, 0.006, 2).translate(XD - 0.07, F + 2.05, dz1 + 0.04),
        ]);
        const brkM = mesh(brk, MM.steel, { id: idDoor, cast: false });
        door.bar = { pivot: piv, mesh: barM, brackets: brkM, a: Math.PI / 2, target: Math.PI / 2, v: 0, down: false };
        piv.rotation.x = door.bar.a;
        return door.bar;
      },
      // the bar falls across the door (the slam knocks it off its keeper)
      dropBar({ now = false } = {}) {
        const b = door.makeBar();
        door.barred = true; b.target = 0; b.down = true;
        if (now) { b.a = 0; b.v = 0; b.pivot.rotation.x = 0; }
      },
      liftBar({ now = false } = {}) {
        const b = door.makeBar();
        door.barred = false; b.target = Math.PI / 2; b.down = false;
        if (now) { b.a = b.target; b.v = 0; b.pivot.rotation.x = b.a; }
      },
    };
    const sign = {
      letters,
      on: true,
      setOn(on) {
        sign.on = !!on;
        for (const l of letters) l.tube.material = sign.on && l.lit ? neonOn : neonOff;
        letters.underline.material = sign.on ? neonOn : neonOff;
        if (letters.sheen) letters.sheen.visible = sign.on;
      },
    };
    const nLetter = letters.find((l) => l.ch === 'N');
    // (polish, the bug hunt: a window a man has gone out through is a way
    // out - the burst pane's hole looked open, the sill under the hands, but
    // the front's wall collider ran on across it, an invisible wall at the
    // glass. openBay(name) opens a gap in the wall the width of the pane
    // less the frame, and a region of the net through the wall's thickness;
    // it closes again when the pane is put back)
    const holes = {};
    const openBay = (name) => {
      const z = D.bays[name];
      if (z == null || holes[name]) return;
      const h = [z - W.w / 2 + 0.4, z + W.w / 2 - 0.4];
      for (const b of wallBoxes) (b.holes || (b.holes = [])).push(h);
      holes[name] = { h, region: colliders.addRegion(Xi - 1.2, X + 1.2, h[0], h[1], 'diner.hole.' + name) };
    };
    const closeBay = (name) => {
      const o = holes[name];
      if (!o) return;
      for (const b of wallBoxes) if (b.holes) b.holes = b.holes.filter((x) => x !== o.h);
      const k = colliders.regions.indexOf(o.region); if (k >= 0) colliders.regions.splice(k, 1);
      delete holes[name];
    };
    for (const name of ['B2', 'B4']) if (panes[name] && panes[name].on) panes[name].on('state', (pane) => { if (!pane.broken) closeBay(name); });
    return {
      openBay, closeBay,
      group: g, wall, door, panes, sign, awning, near: null, stage, facade: stage.part('facade'),
      drips, pools, neonOn, neonOff, nLetter, flickRng: rng.fork(7), nextFlick: 2.5, flickLeft: 0,
    };
  },

  update(api, dt, t, camera) {
    // (the room's light: on while the eye is in it or the front is in
    // view within 30 m; parts/diner.js reads it through dinerInSight)
    api.near = dinerSightFrom(camera, !!api.near);
    DINER_SIGHT.state = api.near;

    // [C4] the door: pushed open from inside by whoever walks into it,
    // pulled from the street (door.pull / open), swung back by its closer;
    // the leaf never passes through a body (stepDoor)
    const d = api.door, D = DINER;
    stepDoor(api, d, dt, camera);
    // the bell on its spring: a damped swing, kicked by the door
    const b = d.bell;
    if (Math.abs(b.v) > 1e-4 || Math.abs(b.a) > 1e-4) {
      b.v += (-60 * b.a - 3.2 * b.v) * dt;
      b.a += b.v * dt;
      b.pivot.rotation.x = b.a;
    }

    // the N buzzes: dark for 0.1 s every few seconds (sometimes twice)
    const N = api.nLetter;
    if (N && api.sign.on && !N.handle.broken) {
      if (api.flickLeft > 0) {
        api.flickLeft -= dt;
        if (api.flickLeft <= 0) N.tube.material = api.neonOn;
      } else if (t >= api.nextFlick) {
        N.tube.material = api.neonOff;
        api.flickLeft = 0.1;
        const r = api.flickRng;
        api.nextFlick = t + (r.chance(0.3) ? 0.22 : r.range(2.5, 6.5));
      }
    }

    // the gutter's drops: each falls from the lip to the pavement on its
    // own clock (hidden while it gathers)
    const dr = api.drips, im = dr.mesh, m = _m;
    for (let i = 0; i < dr.length; i++) {
      const q = dr[i];
      const s = (t + q.phase) % q.period;
      const y = dr.top - 4.9 * s * s;
      const v = 9.8 * s;
      if (y < DINER.floorY + 0.02) { m.makeScale(0, 0, 0); }
      else {
        const len = Math.min(0.03 + v * 0.018, y - DINER.floorY);
        m.makeScale(1, len, 1).setPosition(q.x, y, q.z);
      }
      im.setMatrixAt(i, m);
    }
    im.instanceMatrix.needsUpdate = true;
  },
};
const _m = new THREE.Matrix4();

// ---- [C4] the push door's step ------------------------------------------------------------
// The leaf turns about its hinge (XD, hingeZ), outward (+x: onto the pavement)
// by d.angle * OPEN_MAX rad. Every step:
//   need   the least angle that clears every body in the doorway or behind
//          the open leaf (a body pushing out - me walking into it, the
//          couple running out - drives the leaf ahead of it, as fast as it
//          comes: never through it)
//   block  the most the leaf may open before it meets a body outside, in its
//          sweep (it stops at a man standing on the pavement before it)
//   want   need, or OPEN_MAX while held open (open / pull / push by E),
//          else 0: the closer brings it back at its own pace, the last
//          centimetres with a knock ('slam' when it comes hard)
// Barred (or shut), it does not open: a body pushing on it rattles it.
const OPEN_MAX = 1.42;
const _bodies = [];
function leafClear(a, px, pz, R) {
  const w = DINER.door.w, hz = DINER.door.hingeZ;
  const ux = Math.sin(a), uz = Math.cos(a);
  const ox = XD - 0.03 * Math.cos(a), oz = hz + 0.03 * Math.sin(a);
  const t = Math.max(0, Math.min(w, (px - ox) * ux + (pz - oz) * uz));
  return Math.hypot(px - (ox + ux * t), pz - (oz + uz * t)) >= R;
}
// the angles at which the leaf touches the circle: [lo, hi] or null
function leafSpan(px, pz, R) {
  let lo = null, hi = null;
  for (let a = 0; a <= OPEN_MAX + 1e-6; a += 0.025) if (!leafClear(a, px, pz, R)) { if (lo == null) lo = a; hi = a; }
  return lo == null ? null : [lo, hi];
}
function stepDoor(api, d, dt, camera) {
  const D = DINER, w = D.door.w, hz = D.door.hingeZ, midZ = hz + w / 2;
  const S = api.stage, G = S.game;
  const e = camera.position;
  const pe = d._pe || (d._pe = { x: e.x, z: e.z });
  const vx = dt > 0 ? (e.x - pe.x) / dt : 0;
  pe.x = e.x; pe.z = e.z;
  // the bodies near the doorway: me, the cast, the hoods
  _bodies.length = 0;
  const near = (x, z) => Math.abs(z - midZ) < w + 0.5 && x > XD - 1.1 && x < XD + 1.6;
  if (near(e.x, e.z)) _bodies.push({ x: e.x, z: e.z, r: 0.36, me: true });
  if (S.cast) for (const c of S.cast.list) if (c.fig && !c.down && near(c.pos.x, c.pos.z)) _bodies.push({ x: c.pos.x, z: c.pos.z, r: 0.3 });
  if (S.hoods) for (const h of S.hoods.list) if (h.alive && near(h.pos.x, h.pos.z)) _bodies.push({ x: h.pos.x, z: h.pos.z, r: 0.3 });
  const cur = d.angle * OPEN_MAX;
  let need = 0, block = OPEN_MAX;
  for (const b of _bodies) {
    // (a man of the cast comes on at a run: the leaf gives a hand's breadth
    // before him; me, only when I touch it - or push: below)
    const sp = leafSpan(b.x, b.z, b.r + (b.me ? 0.05 : 0.16));
    if (!sp) continue;
    // (in the room or the doorway, or already behind the open leaf: it is
    // pushed ahead of the body; out on the pavement before it: it stops)
    if (b.x < XD + 0.08 || cur >= sp[0] - 0.02) need = Math.max(need, sp[1] + 0.05);
    else block = Math.min(block, Math.max(0, sp[0] - 0.05));
  }
  // (one of them in the doorway from inside is on his way out: it gives a
  // stride ahead of him, as it does ahead of me when I push)
  // (a man running out shoves it wide: it swings as far as it goes, then
  // comes back on its closer once he is clear of it)
  for (const b of _bodies) {
    if (b.me || b.x < XD - 0.75 || b.x > XD + 0.05 || Math.abs(b.z - midZ) > w / 2 + 0.1) continue;
    const sp = leafSpan(b.x + 0.42, b.z, b.r + 0.12);
    if (sp) need = Math.max(need, Math.min(OPEN_MAX, Math.max(sp[1] + 0.05, 1.3)));
  }
  // me walking into it from inside: it gives ahead of me (a step's lookahead)
  const inDoor = Math.abs(e.z - midZ) < w / 2 - 0.05 && e.x > XD - 0.85 && e.x < XD + 0.05;
  const pushing = inDoor && vx > 0.25;
  if (pushing) { const sp = leafSpan(e.x + 0.32, e.z, 0.41); if (sp) need = Math.max(need, sp[1] + 0.05); }
  d.push = need;
  if (d.rattleT > 0) d.rattleT -= dt;
  let want;
  if (d.barred || d.shut) {
    if (d.barred && (pushing || need > 0.02)) d.tried();
    want = 0;
    d.holdT = 0; d.target = 0;
  } else {
    if (d.target === 1 && (d.holdT -= dt) <= 0) d.close();
    want = Math.max(need, d.target === 1 ? Math.min(OPEN_MAX, block) : 0);
  }
  // the motion: pushed, at once to what the body needs; opened by a hand,
  // 2.2 rad/s; the closer, easing back at 1.5 rad/s (slower the last 0.3)
  let a = cur;
  if (want > a) a = need >= want - 1e-4 ? want : Math.min(want, a + dt * 2.2);
  else if (want < a) {
    const sp = a < 0.3 ? 0.9 : 1.5;
    a = Math.max(want, a - dt * sp);
    if (a <= 1e-4 && cur > 1e-4) { a = 0; d.bell.v -= 2.5; d.emit('slam'); }
  }
  // (the leaf off its jamb, whatever opened it: the bell, the room's heads - 'open')
  if (cur <= 0.03 && a > 0.03) { if (!(d.target === 1)) d.bell.v += 4; d.emit('open'); }
  // (barred, tried: the leaf gives a centimetre and comes back)
  let jig = 0;
  if (d.jig > 0) { d.jig = Math.max(0, d.jig - dt * 4); jig = 0.012 * Math.abs(Math.sin((1 - d.jig) * Math.PI * 3)) * d.jig; }
  d.angle = a / OPEN_MAX;
  const A = a + jig;
  // (the jank watch: the leaf inside a body by more than 6 cm - never)
  if (G && G.counters) for (const b of _bodies) if (!leafClear(A, b.x, b.z, b.r - 0.06)) { G.counters.doorThrough = (G.counters.doorThrough || 0) + 1; if (b.me) G.counters.doorThroughMe = (G.counters.doorThroughMe || 0) + 1; }
  if (A !== d._A) {
    d._A = A;
    d.object.rotation.y = A;
    d.isOpen = d.angle > 0.95;
    // the collider follows the leaf at every angle (a box along it, turned
    // with it): nobody walks through the open leaf either
    const c = d.collider;
    c.angle = A; c.c = Math.cos(A); c.s = Math.sin(A);
    c.cx = XD - 0.03 * Math.cos(A) + (w / 2) * Math.sin(A);
    c.cz = hz + 0.03 * Math.sin(A) + (w / 2) * Math.cos(A);
  }
  // the bar: swung down across the door under its own weight (a knock as it
  // lands, a little bounce), lifted back up by a hand
  const B = d.bar;
  if (B && (Math.abs(B.a - B.target) > 1e-4 || Math.abs(B.v) > 1e-4)) {
    if (B.target < B.a || B.v > 0) {
      B.v -= dt * 22; B.a += B.v * dt;
      if (B.a <= B.target) { B.a = B.target; const v = B.v; B.v = Math.abs(v) > 1.5 ? -v * 0.18 : 0; if (!B.knocked) { B.knocked = true; d.emit('barDown'); } }
    } else { B.knocked = false; B.v = 0; B.a = Math.min(B.target, B.a + dt * 5); }
    B.pivot.rotation.x = B.a;
  }
  // E at the door: inside it is pushed (or tried), from the street pulled
  if (G && G.interact && !api.doorUse) {
    const at = (out) => () => new THREE.Vector3(XD + (out ? 0.06 : -0.08), D.floorY + 1.05, hz + w - 0.25);
    const ok = () => G.stage === S && !(G.brawl && G.brawl.active) && G.state === 'playing';
    api.doorUse = [
      G.interact.add({ id: 'diner.door.push', scope: 'stage', at: at(false), range: 1.5, cone: 0.6, prompt: 'push', when: () => ok() && !d.barred && G.eye.x < XD && d.angle < 0.3,
        onUse: () => { if (d.barred || d.shut) d.tried(); else { d.open(); d.holdT = 1.6; } } }),
      G.interact.add({ id: 'diner.door.pull', scope: 'stage', at: at(true), range: 1.6, cone: 0.6, prompt: 'pull', when: () => ok() && G.eye.x > XD + 0.1 && d.angle < 0.3,
        onUse: () => { if (d.barred || d.shut) d.tried(); else d.pull(); } }),
    ];
  }
}

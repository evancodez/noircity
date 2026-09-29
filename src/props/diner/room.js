import * as THREE from 'three';
import { DINER, dinerOpenings } from '../../stages/block/site.js';
import { paintY } from './kit.js';
import { lathe, slab, hash, mergeGeos, tubeAlong, V3 } from '../lib.js';

// The diner's shell: the linoleum floor (polished: a short broken sheen
// under each pendant; a lighter inlaid line 0.3 m out from the counter's
// base; scuffed paths; wet footprints from the door and a wet mat inside
// it), the plain dark ceiling, the walls (dark panelling below a dado rail
// 1.1 m up, plaster above that fades to black toward the ceiling), the
// front wall's inner lining round the openings, the pictures and the coat
// rack by the door end.
const D = DINER, F = D.floorY, C = D.counter;

// ---- the floor's two maps (albedo, roughness) --------------------------------
// One 512 x 1024 canvas each over the whole floor (x -17 .. -10.45 along u,
// z -5.8 .. 11.4 along v): no tiling, so nothing repeats as a grid.
function floorMaps() {
  const W = 512, H = 1024;
  const u = (x) => ((x - D.backX) / (D.innerX - D.backX)) * W;
  const v = (z) => (1 - (z - D.zMin) / (D.zMax - D.zMin)) * H;
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const ca = mk(), cr = mk();
  const a = ca.getContext('2d'), r = cr.getContext('2d');
  a.fillStyle = 'rgb(6,6,6)'; a.fillRect(0, 0, W, H);
  r.fillStyle = 'rgb(62,62,62)'; r.fillRect(0, 0, W, H);   // roughness 0.24: polished
  const blob = (g, x, y, rad, rgba) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, rgba); gr.addColorStop(1, rgba.replace(/[\d.]+\)$/, '0)'));
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
  };
  // a mottle in the polish (broken sheen): soft patches of duller wax
  for (let i = 0; i < 520; i++) {
    const x = hash(i, 1) * W, y = hash(i, 2) * H, s = 6 + hash(i, 3) * 34;
    blob(r, x, y, s, `rgba(190,190,190,${0.35 + hash(i, 4) * 0.45})`);
    if (i % 3 === 0) blob(a, x, y, s * 1.2, `rgba(9,9,9,${0.3 + hash(i, 5) * 0.3})`);
  }
  // scuffed paths: the aisle by the stools, the way from the door to the
  // counter, the service aisle behind it; worn duller and a shade lighter
  const scuff = (pts, width, n) => {
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const i = Math.min(pts.length - 2, Math.floor(t * (pts.length - 1)));
      const f = t * (pts.length - 1) - i;
      const x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f + (hash(k, 7) - 0.5) * width;
      const z = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f + (hash(k, 8) - 0.5) * width * 0.6;
      const s = 6 + hash(k, 9) * 16;
      blob(r, u(x), v(z), s, `rgba(200,200,200,${0.12 + hash(k, 10) * 0.18})`);
      blob(a, u(x), v(z), s, `rgba(12,12,12,${0.1 + hash(k, 11) * 0.15})`);
    }
  };
  scuff([[-12.9, -5.0], [-12.9, 10.4]], 0.7, 600);
  scuff([[-10.8, 0.6], [-12.3, 1.8], [-13.2, 3.6]], 0.55, 160);
  scuff([[-15.7, -3.4], [-15.7, 8.4]], 0.5, 380);
  // wet footprints from the door to the player's stool (a man came in out
  // of the rain): glossy and a little darker, fading as they dry
  const steps = [];
  let px = -10.7, pz = 0.55;
  for (let k = 0; k < 9; k++) {
    const tx = -13.3, tz = 3.9;
    const dx = tx - px, dz = tz - pz, d = Math.hypot(dx, dz) || 1;
    px += (dx / d) * 0.36; pz += (dz / d) * 0.36;
    const side = k % 2 ? 1 : -1;
    steps.push([px + (-dz / d) * 0.09 * side, pz + (dx / d) * 0.09 * side, Math.atan2(dz, dx), 1 - k / 10]);
  }
  for (const [x, z, ang, wet] of steps) {
    for (const g of [r, a]) {
      g.save(); g.translate(u(x), v(z)); g.rotate(-ang + Math.PI / 2);
      g.scale(W / (D.innerX - D.backX), H / (D.zMax - D.zMin));
      g.fillStyle = g === r ? `rgba(18,18,18,${0.85 * wet})` : `rgba(1,1,1,${0.6 * wet})`;
      g.beginPath(); g.ellipse(0, -0.05, 0.05, 0.085, 0, 0, 7); g.fill();
      g.beginPath(); g.ellipse(0, 0.1, 0.045, 0.05, 0, 0, 7); g.fill();
      g.restore();
    }
  }
  // the wet ground inside the door, round the mat
  blob(r, u(-10.9), v(0.6), 60, 'rgba(20,20,20,0.9)');
  const tA = new THREE.CanvasTexture(ca); tA.colorSpace = THREE.SRGBColorSpace; tA.anisotropy = 8;
  const tR = new THREE.CanvasTexture(cr); tR.colorSpace = THREE.NoColorSpace; tR.anisotropy = 8;
  return { map: tA, rough: tR };
}

export function buildShell(kit) {
  const { M } = kit;
  const W = D.innerX, B = D.backX, e = 0.003;
  const lx = W - B, lz = D.zMax - D.zMin, cx = (W + B) / 2, cz = (D.zMin + D.zMax) / 2;
  const out = {};

  // ---- the floor
  kit.piece();
  const maps = floorMaps();
  const floorMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: maps.map, roughness: 1, roughnessMap: maps.rough, metalness: 0 });
  floorMat.name = 'diner_floor';
  floorMat.userData.inkSurface = 'lino';
  const fg = new THREE.PlaneGeometry(lx, lz).rotateX(-Math.PI / 2).translate(cx, F + e, cz);
  out.floor = kit.add(fg, floorMat, { cast: false });
  // the inlaid line, 0.3 m out from the counter's base, round its ends
  kit.piece();
  const bx = C.frontX + 0.3, w = 0.035, yl = F + e + 0.0008;
  const strips = [
    kit.box(bx - w / 2, bx + w / 2, yl, yl + 0.0004, C.z0 - 0.3, C.z1 + 0.3),
    kit.box(C.frontX - C.depth - 0.25, bx + w / 2, yl, yl + 0.0004, C.z0 - 0.3 - w / 2, C.z0 - 0.3 + w / 2),
    kit.box(C.frontX - C.depth - 0.25, bx + w / 2, yl, yl + 0.0004, C.z1 + 0.3 - w / 2, C.z1 + 0.3 + w / 2),
  ];
  kit.addMerged(strips, M.std('inlay', 0x3a3a3a, 0.35, 'lino'), { cast: false });
  // the wet mat inside the door
  kit.piece();
  const mat = slab(1.25, 0.012, 0.85, { bevel: 0.005, corner: 0.03 }).rotateY(Math.PI / 2).translate(W - 0.62, F + e, D.door.hingeZ + D.door.w / 2);
  kit.add(mat, M.std('mat', 0x0a0a0a, 0.95, 'cloth'), { cast: false });

  // ---- the ceiling: plain and dark (a shallow cornice along the walls)
  kit.piece();
  kit.add(new THREE.PlaneGeometry(lx, lz).rotateX(Math.PI / 2).translate(cx, D.ceilY - e, cz), M.ceil, { cast: false });

  // ---- the walls: panelling to the dado, plaster above
  const dadoY = F + 1.1;
  const plasterV = (y) => {
    const t = Math.min(1, Math.max(0, (y - dadoY) / (D.ceilY - dadoY)));
    return 0.24 * Math.pow(1 - t * t * (3 - 2 * t), 1.25) + 0.018;
  };
  const plaster = [], panels = [], stiles = [], rails = [], skirt = [];
  // a wall run: along a line at fixed x (facing +x or -x) or fixed z
  // (facing +z or -z), from a to b, between y0 and y1
  const run = (axis, at, dir, a, b, { y0 = F, y1 = D.ceilY, panelTop = dadoY, seed = 0 } = {}) => {
    if (b - a < 0.02) return;
    const mk = (w, h, yc, off) => {
      const g = new THREE.PlaneGeometry(w, h, 1, Math.max(1, Math.round(h / 0.25)));
      if (axis === 'x') { g.rotateY(dir > 0 ? Math.PI / 2 : -Math.PI / 2); g.translate(at + dir * off, yc, (a + b) / 2); }
      else { if (dir < 0) g.rotateY(Math.PI); g.translate((a + b) / 2, yc, at + dir * off); }
      return g;
    };
    const len = b - a;
    if (y1 > panelTop) plaster.push(paintY(mk(len, y1 - Math.max(panelTop, y0), (Math.max(panelTop, y0) + y1) / 2, e), plasterV));
    if (y0 < panelTop) {
      const top = Math.min(panelTop, y1);
      panels.push(mk(len, top - y0, (y0 + top) / 2, e));
      // stiles at an uneven step (0.5 .. 0.85 m), a rail under the dado
      const pb = (x0, x1, yy0, yy1, t) => {
        if (axis === 'x') return kit.box(Math.min(at, at + dir * t), Math.max(at, at + dir * t), yy0, yy1, x0, x1);
        return kit.box(x0, x1, yy0, yy1, Math.min(at, at + dir * t), Math.max(at, at + dir * t));
      };
      let s = a + 0.04, k = 0;
      while (s < b - 0.06) {
        stiles.push(pb(s, s + 0.055, y0 + 0.13, top - 0.06, 0.014));
        s += 0.5 + hash(k + seed * 17, 21) * 0.35; k++;
      }
      stiles.push(pb(b - 0.06, b - 0.005, y0 + 0.13, top - 0.06, 0.014));
      stiles.push(pb(a, b, top - 0.075, top - 0.04, 0.014));
      skirt.push(pb(a, b, y0, y0 + 0.13, 0.018));
      if (top >= panelTop - 1e-3) rails.push(pb(a, b, panelTop - 0.035, panelTop + 0.012, 0.032), pb(a, b, panelTop + 0.012, panelTop + 0.03, 0.02));
    }
  };
  // the back wall (x = -17): only where the back bar leaves it bare (the
  // cabinets stand in front of it from C.z0 to C.z1; the kitchen's
  // partition in the middle)
  run('x', B, 1, D.zMin, C.z0 - 0.02, { seed: 1 });
  run('x', B, 1, C.z1 + 0.02, D.zMax, { seed: 2 });
  run('x', B, 1, C.z0 - 0.02, C.z1 + 0.02, { y0: F + 2.05, seed: 3 });
  // the end walls
  run('z', D.zMin, 1, B, W, { seed: 4 });
  run('z', D.zMax, -1, B, W, { seed: 5 });
  // the front wall's inner face, round its openings
  const ops = dinerOpenings().sort((p, q) => p.z0 - q.z0);
  let z = D.zMin;
  let sd = 6;
  for (const o of ops) {
    run('x', W, -1, z, o.z0, { seed: sd++ });
    run('x', W, -1, o.z0, o.z1, { y1: o.y0, seed: sd++ });
    run('x', W, -1, o.z0, o.z1, { y0: o.y1, seed: sd++ });
    z = o.z1;
  }
  run('x', W, -1, z, D.zMax, { seed: sd++ });
  kit.piece();
  kit.addMerged(plaster, M.plaster, { cast: false });
  kit.piece();
  kit.addMerged(panels, M.panel, { cast: false });
  kit.addMerged(stiles, M.panelStile, { cast: false });
  kit.addMerged(skirt, M.enamelDark, { cast: false });
  kit.piece();
  kit.addMerged(rails, M.rail, { cast: false });
  // the window sills inside (a wooden ledge under each pane)
  kit.piece();
  const sills = [];
  for (const o of ops) if (!o.door) sills.push(slab(0.2, 0.035, o.z1 - o.z0 + 0.06, { bevel: 0.008, corner: 0.01 }).translate(W - 0.08, o.y0 - 0.02, (o.z0 + o.z1) / 2));
  kit.addMerged(sills, M.rail, { cast: false });

  // ---- pictures: plain dark rectangles, a light edge
  kit.piece();
  const frames = [], canv = [];
  const picture = (x, y, zWall, dir, w, h) => {
    const t = 0.03, fw = 0.045;
    const zz = zWall + dir * (t / 2 + 0.004);
    frames.push(kit.box(x - w / 2, x + w / 2, y + h / 2 - fw, y + h / 2, zz - t / 2, zz + t / 2));
    frames.push(kit.box(x - w / 2, x + w / 2, y - h / 2, y - h / 2 + fw, zz - t / 2, zz + t / 2));
    frames.push(kit.box(x - w / 2, x - w / 2 + fw, y - h / 2 + fw, y + h / 2 - fw, zz - t / 2, zz + t / 2));
    frames.push(kit.box(x + w / 2 - fw, x + w / 2, y - h / 2 + fw, y + h / 2 - fw, zz - t / 2, zz + t / 2));
    canv.push(kit.box(x - w / 2 + fw, x + w / 2 - fw, y - h / 2 + fw, y + h / 2 - fw, zz - 0.006, zz + 0.006));
  };
  picture(-15.9, 2.35, D.zMax, -1, 0.62, 0.8);
  picture(-14.5, 2.2, D.zMax, -1, 0.85, 0.6);
  picture(-11.55, 2.55, D.zMax, -1, 0.5, 0.62);
  picture(-11.4, 2.75, D.zMin, 1, 0.55, 0.42);
  kit.addMerged(frames, M.std('pframe', 0x444444, 0.4, 'wood'), { cast: false });
  kit.addMerged(canv, M.std('pcanvas', 0x0c0c0c, 0.7, 'cloth'), { cast: false });

  // ---- the coat rack on the end wall by the door: a board of hooks, two
  // hats, a wet coat dripping on the floor
  out.coat = buildCoatRack(kit, -11.45, D.zMin);
  return out;
}

// a fedora: a lathe crown with a pinch, a brim curled at the edge
export function fedoraGeo(s = 1) {
  const brim = lathe([[0.0001, 0.0], [0.08, 0.0], [0.14, 0.004], [0.165, 0.012], [0.168, 0.018], [0.155, 0.014], [0.12, 0.008], [0.08, 0.006], [0.0001, 0.006]], 40);
  const crown = lathe([[0.085, 0.0], [0.09, 0.03], [0.088, 0.08], [0.075, 0.11], [0.04, 0.12], [0.0001, 0.105]], 40);
  // the pinch: dent the crown's top along its long axis
  const p = crown.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), zz = p.getZ(i);
    if (y > 0.07) p.setY(i, y - 0.02 * Math.exp(-(x * x) / 0.0012) * ((y - 0.07) / 0.05));
    p.setZ(i, zz * 1.12);
  }
  crown.computeVertexNormals();
  brim.scale(1, 1, 1.12);
  const band = lathe([[0.0892, 0.004], [0.0915, 0.006], [0.0915, 0.026], [0.0892, 0.028]], 40);
  band.scale(1, 1, 1.12);
  return { crown: crown.scale(s, s, s), brim: brim.scale(s, s, s), band: band.scale(s, s, s) };
}

function buildCoatRack(kit, x, zWall) {
  const { M } = kit;
  kit.piece();
  const y = 1.78, z = zWall + 0.012;
  const board = slab(1.2, 0.022, 0.12, { bevel: 0.006, corner: 0.01 }).rotateX(Math.PI / 2).translate(x, y, z + 0.011);
  const hooks = [];
  for (let k = 0; k < 4; k++) {
    const hx = x - 0.45 + k * 0.3;
    hooks.push(tubeAlong([V3(hx, y + 0.02, z + 0.02), V3(hx, y + 0.02, z + 0.08), V3(hx, y + 0.07, z + 0.12), V3(hx, y + 0.1, z + 0.11)], 0.007, 8, 24));
  }
  kit.add(board, M.rail, { cast: false });
  kit.addMerged(hooks, M.iron, { cast: false });
  // two hats on the outer hooks
  kit.piece();
  const hats = [];
  for (const [hx, tilt, yaw] of [[x - 0.45, 0.35, 0.3], [x + 0.45, 0.28, -0.5]]) {
    const f = fedoraGeo(1.0);
    const m = new THREE.Matrix4().compose(V3(hx, y + 0.03, z + 0.13), new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2 + tilt, yaw, 0)), V3(1, 1, 1));
    for (const g of [f.crown, f.brim, f.band]) hats.push(g.applyMatrix4(m.clone().multiply(new THREE.Matrix4().makeTranslation(0, -0.06, 0))));
  }
  kit.addMerged(hats, M.black, { cast: false });
  // the coat: a long dark drape from the middle hook, its shoulders on the
  // hook, the hem 1.05 m below, a collar and a sleeve hanging in front
  kit.piece();
  const cx = x - 0.15, top = y + 0.07;
  const prof = [[0.0001, 0], [0.05, -0.01], [0.17, -0.07], [0.2, -0.16], [0.19, -0.45], [0.2, -0.75], [0.23, -1.0], [0.235, -1.06], [0.0001, -1.07]];
  // (the lathe's profile runs bottom to top so its faces look out)
  const coat = lathe(prof.slice().reverse(), 36);
  coat.scale(1, 1, 0.34);
  // (folds: a few slow vertical ripples, deeper toward the hem)
  const p = coat.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const X = p.getX(i), Y = p.getY(i), Z = p.getZ(i);
    const a = Math.atan2(Z / 0.34, X);
    const k = Math.min(1, -Y / 0.9);
    const f = 1 + k * 0.08 * Math.sin(a * 5 + 1.3) + k * 0.04 * Math.sin(a * 11);
    p.setXYZ(i, X * f, Y, Z * f);
  }
  coat.computeVertexNormals();
  coat.translate(cx, top, z + 0.11);
  const collar = new THREE.TorusGeometry(0.075, 0.025, 10, 28, Math.PI * 1.4).rotateX(Math.PI / 2).rotateY(Math.PI * 0.8).scale(1, 1, 0.6).translate(cx, top - 0.035, z + 0.12);
  const sleeve = new THREE.CapsuleGeometry(0.045, 0.5, 6, 14).translate(0, -0.25, 0).rotateZ(0.08).translate(cx + 0.14, top - 0.13, z + 0.19);
  const coatMesh = kit.add(mergeGeos([coat, collar, sleeve]), M.cloth, { cast: false });
  // the puddle it drips into
  kit.piece();
  const puddle = new THREE.CircleGeometry(0.22, 28).rotateX(-Math.PI / 2).scale(1.3, 1, 0.8).translate(cx + 0.03, F + 0.0045, z + 0.26);
  kit.add(puddle, M.std('puddle', 0x020202, 0.08, 'lino'), { cast: false });
  return { mesh: coatMesh, drip: V3(cx + 0.02, top - 1.06, z + 0.2), floorY: F + 0.005 };
}

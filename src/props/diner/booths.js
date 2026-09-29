import * as THREE from 'three';
import { DINER, dinerOpenings } from '../../stages/block/site.js';
import { slab, mergeGeos, hash, V3, lathe } from '../lib.js';
import { makeWindowLightMaterial } from '../../render/glass.js';
import { LAYER } from '../../render/layers.js';

// The booths by the windows: high-backed benches, buttoned (a dark mass
// with a few dimples), a table between each pair; booth 3 by the door's
// side light is a short one (a bench, a table and a stool). The window
// light: the street lamp's light through the wet glass lies on the floor and
// the tables (lane 1's window-light material; the blind half down over B2
// lays its slats' shadows across the couple's booth). The el train's
// window lights sweep in through the same openings (trainBars).
const D = DINER, F = D.floorY;
export const BOOTH = { seatY: F + 0.45, backTop: F + 1.28, benchD: 0.5 };

// one bench: its seat toward `face` (+1: faces +z), its back at zb
function bench(kit, x0, x1, zb, face) {
  const { M } = kit;
  const d = BOOTH.benchD, sy = BOOTH.seatY, bt = BOOTH.backTop;
  const zc = zb + face * d / 2;
  const w = x1 - x0 - 0.06;
  const xc = (x0 + x1) / 2 + 0.01;
  const g = [];
  // the base (a plinth under the seat) and the seat cushion
  g.push(kit.box(x0 + 0.04, x1 - 0.02, F, sy - 0.1, Math.min(zb, zb + face * (d - 0.06)), Math.max(zb, zb + face * (d - 0.06))));
  const seat = slab(w, 0.11, d - 0.04, { bevel: 0.035, corner: 0.05, seg: 4, curve: 8 }).translate(xc, sy - 0.11, zc + face * 0.01);
  // the back: a tall rounded cushion, leaning back a little
  const back = slab(w, bt - sy + 0.02, 0.13, { bevel: 0.04, corner: 0.05, seg: 4, curve: 8 });
  back.rotateX(face * 0.1).translate(xc, sy - 0.02, zb + face * 0.085);
  const cush = [seat, back];
  // the buttons: a few dimples in the back, two rows, uneven
  const dims = [];
  for (let r = 0; r < 2; r++) for (let k = 0; k < 4; k++) {
    if (hash(k + r * 4, zb * 3) < 0.15) continue;
    const bx = x0 + 0.3 + k * (w - 0.45) / 3 + (r ? 0.18 : 0);
    if (bx > x1 - 0.12) continue;
    const by = sy + 0.3 + r * 0.33;
    const bz = zb + face * (0.085 + 0.065 + 0.0) - face * (by - sy) * 0.1 * 0.0;
    dims.push(new THREE.SphereGeometry(0.012, 10, 8).scale(1, 1, 0.5).translate(bx, by, bz + face * 0.003 - face * (by - sy) * 0.1));
  }
  // the frame: a wooden cap along the back's top and an end panel at the aisle
  const frame = [];
  frame.push(slab(x1 - x0, 0.04, 0.2, { bevel: 0.012, corner: 0.02 }).translate((x0 + x1) / 2, bt, zb + face * 0.06));
  frame.push(slab(0.045, bt - F + 0.02, d + 0.16, { bevel: 0.012, corner: 0.03 }).translate(x0 - 0.0, F, zb + face * (d + 0.16) / 2 - face * 0.08));
  return { base: g, cush, dims, frame };
}

export function buildBooths(kit, stage, buildProp) {
  const { M } = kit;
  const BT = D.booths, x0 = BT.x0, x1 = BT.x1, bx = (x0 + x1) / 2;
  const booths = [];
  const cush = [], dims = [], frame = [], base = [];
  BT.z.forEach((z, i) => {
    const short = i === 2;
    const half = short ? 0.55 : 1.0;
    const seats = [];
    for (const s of short ? [1] : [-1, 1]) {
      const zb = z + s * half;
      const b = bench(kit, x0, x1, zb, -s);
      cush.push(...b.cush); dims.push(...b.dims); frame.push(...b.frame); base.push(...b.base);
      seats.push(zb - s * (BOOTH.benchD / 2));
    }
    booths.push({ z, half, short, seats });
  });
  kit.piece();
  kit.addMerged(cush, M.booth);
  kit.addMerged(dims, M.black, { cast: false });
  kit.addMerged(base, M.cabinet);
  kit.piece();
  kit.addMerged(frame, M.boothFrame);

  // the tables: a top with a steel band, one pedestal; each a breakable
  booths.forEach((b, i) => {
    kit.piece();
    const tz = b.short ? b.z - 0.12 : b.z, td = b.short ? 0.44 : 0.64;
    const t = new THREE.Group();
    t.position.set(bx - 0.06, 0, tz);
    kit.g.add(t);
    const tl = x1 - x0 - 0.22;
    kit.add(slab(tl, 0.032, td, { bevel: 0.006, corner: 0.03 }).translate(0, BT.tableY - 0.032, 0), M.tableTop, { parent: t });
    kit.add(slab(tl + 0.012, 0.022, td + 0.012, { bevel: 0.004, corner: 0.034 }).translate(0, BT.tableY - 0.046, 0), M.steel, { parent: t, cast: false });
    const ped = lathe([[0.0001, F], [0.24, F], [0.25, F + 0.012], [0.12, F + 0.04], [0.04, F + 0.08], [0.035, BT.tableY - 0.12], [0.08, BT.tableY - 0.06], [0.1, BT.tableY - 0.046], [0.0001, BT.tableY - 0.046]], 36);
    kit.add(ped, M.iron, { parent: t });
    // on each: a napkin box, an ashtray, a ketchup bottle
    const items = [];
    const put = (kind, dx, dz, yaw, variant) => { const o = buildProp(kind, { lod: 1, variant }); o.position.set(dx, BT.tableY, dz); o.rotation.y = yaw; t.add(o); items.push(o); return o; };
    put('napkinBox', 0.52, -0.08 * (i % 2 ? 1 : -1), Math.PI / 2);
    put('bottle', 0.5, 0.1 * (i % 2 ? 1 : -1), 0.4 + i, 'ketchup');
    put('ashtray', 0.22, 0.05 * (i % 2 ? -1 : 1), i * 0.7);
    const h = stage.breakables.add(t, { kind: 'table', hp: 3 });
    b.table = t; b.handle = h; b.items = items;
  });
  // booth 3's stool, on the door side of its table
  const b3 = booths[2];
  const st = buildProp('stool', { lod: 1 });
  st.position.set(bx - 0.25, 0, b3.z - 0.62);
  st.scale.set(0.95, 0.62, 0.95);
  kit.g.add(st);
  b3.stool = st;
  return booths;
}

// the blind half down over B2: a headrail and its slats (their shadows are
// the window light's: slats in lane 1's material)
export function buildBlind(kit, bay = 'B2', down = 0.5) {
  const { M } = kit;
  const o = dinerOpenings().find((q) => q.name === bay);
  const x = D.innerX - 0.06, top = D.window.head - 0.02, h = (D.window.head - o.y0) * down;
  kit.piece();
  const sl = [];
  const n = Math.round(h / 0.052);
  for (let k = 0; k < n; k++) {
    const y = top - 0.06 - k * (h - 0.06) / Math.max(1, n - 1);
    // (a slat: a thin curved strip, tilted half open; a slight sag)
    const g = new THREE.BoxGeometry(0.048, 0.0025, o.z1 - o.z0 - 0.1, 1, 1, 8);
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) { const zz = p.getZ(i) / ((o.z1 - o.z0) / 2); p.setY(i, p.getY(i) - 0.006 * (1 - zz * zz) - 0.003 * Math.pow(p.getX(i) / 0.024, 2)); }
    g.computeVertexNormals();
    g.rotateZ(0.55 + (hash(k, 71) - 0.5) * 0.06).translate(x, y, (o.z0 + o.z1) / 2);
    sl.push(g);
  }
  sl.push(slab(0.07, 0.05, o.z1 - o.z0 - 0.04, { bevel: 0.008, corner: 0.01 }).translate(x, top - 0.02, (o.z0 + o.z1) / 2));
  sl.push(slab(0.055, 0.02, o.z1 - o.z0 - 0.08, { bevel: 0.006, corner: 0.008 }).translate(x, top - h - 0.03, (o.z0 + o.z1) / 2));
  // the cords
  for (const dz of [-0.9, 0.9]) sl.push(new THREE.CylinderGeometry(0.0022, 0.0022, h + 0.25, 5).translate(x + 0.03, top - (h + 0.25) / 2, (o.z0 + o.z1) / 2 + dz));
  kit.addMerged(sl, M.std('blind', 0x2e2e2e, 0.6, 'cloth'), { cast: true });
  return { bay, down, y0: top - h, y1: top };
}

// The street's light through each window, on the floor and the booth
// tables: every opening projected from a lamp outside onto those planes.
// (the source is a lamp post by the kerb, north of the door: lane 4's
// street lamps are further off; this is the light the brief asks for)
export const STREET_LIGHT = V3(-6.7, 5.4, 5.5);
function project(L, p, y) { const t = (L.y - y) / (L.y - p.y); return V3(L.x + (p.x - L.x) * t, y, L.z + (p.z - L.z) * t); }
// clip a convex polygon [[x, z]] to a rectangle
function clipRect(poly, x0, x1, z0, z1) {
  const edges = [[(p) => p[0] >= x0, (a, b) => [x0, a[1] + (b[1] - a[1]) * (x0 - a[0]) / (b[0] - a[0])]],
    [(p) => p[0] <= x1, (a, b) => [x1, a[1] + (b[1] - a[1]) * (x1 - a[0]) / (b[0] - a[0])]],
    [(p) => p[1] >= z0, (a, b) => [a[0] + (b[0] - a[0]) * (z0 - a[1]) / (b[1] - a[1]), z0]],
    [(p) => p[1] <= z1, (a, b) => [a[0] + (b[0] - a[0]) * (z1 - a[1]) / (b[1] - a[1]), z1]]];
  let out = poly;
  for (const [inside, cut] of edges) {
    const src = out; out = [];
    for (let i = 0; i < src.length; i++) {
      const a = src[i], b = src[(i + 1) % src.length];
      const ia = inside(a), ib = inside(b);
      if (ia) out.push(a);
      if (ia !== ib) out.push(cut(a, b));
    }
    if (!out.length) break;
  }
  return out;
}
// a quad from a polygon of 4 points (x, z) at height y, uvs 0..1 across the
// pane's (u along z, v along height)
function patchGeo(pts, y, uvs) {
  const g = new THREE.BufferGeometry();
  const pos = [], uv = [], idx = [];
  pts.forEach(([x, z], i) => { pos.push(x, y, z); uv.push(...(uvs ? uvs[i] : [0, 0])); });
  for (let i = 1; i < pts.length - 1; i++) idx.push(0, i + 1, i);
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function buildWindowLight(kit, booths, blind) {
  const L = STREET_LIGHT;
  const out = [];
  const ops = dinerOpenings().filter((o) => !o.door);
  for (const o of ops) {
    const x = D.faceX;
    const slats = blind && blind.bay === o.name ? 12 : 0;
    const top = o.name.startsWith('B3') ? D.window.transom : D.window.head;
    const corners = [[o.z0, o.y0], [o.z1, o.y0], [o.z1, top], [o.z0, top]];
    const mat = makeWindowLightMaterial({ w: o.z1 - o.z0, h: top - o.y0, slats });
    // the floor: clipped to the room (the booths' seats hide some of it)
    const floorPts = corners.map(([z, y]) => project(L, V3(x, y, z), F + 0.006));
    const poly = clipRect(floorPts.map((p) => [p.x, p.z]), D.backX + 0.05, D.innerX - 0.02, D.zMin, D.zMax);
    const uvs = [[0, 0], [1, 0], [1, 1], [0, 1]];
    if (poly.length === 4) {
      const m = new THREE.Mesh(patchGeo(poly, F + 0.006, uvs), mat);
      m.layers.set(LAYER.FX); m.renderOrder = 2; m.userData.noRay = true;
      kit.g.add(m); out.push(m);
    } else if (poly.length > 2) {
      const m = new THREE.Mesh(patchGeo(poly, F + 0.006, null), mat);
      m.layers.set(LAYER.FX); m.renderOrder = 2; m.userData.noRay = true;
      kit.g.add(m); out.push(m);
    }
    // the tables that stand in the light
    for (const b of booths) {
      const tz = b.short ? b.z - 0.12 : b.z, td = b.short ? 0.44 : 0.64;
      const tp = corners.map(([z, y]) => project(L, V3(x, y, z), D.booths.tableY + 0.002));
      const q = clipRect(tp.map((p) => [p.x, p.z]), D.booths.x0 + 0.05, D.booths.x1 - 0.17, tz - td / 2, tz + td / 2);
      if (q.length < 3) continue;
      const m = new THREE.Mesh(patchGeo(q, D.booths.tableY + 0.002, null), mat);
      m.layers.set(LAYER.FX); m.renderOrder = 2; m.userData.noRay = true;
      kit.g.add(m); out.push(m);
    }
  }
  return out;
}

// ---- the el train's window lights, sweeping in (trainPass) -------------------
// Light bars, one per carriage, pass along the avenue; each shows in the
// room only where it comes through an opening: on the floor, the counter's
// front and the back bar. Additive quads (scene pass only), resized every
// step to the part of each bar that the opening lets through.
export function buildTrainBars(kit) {
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.075, 0.075, 0.075), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, map: barTexture() });
  mat.name = 'diner_trainBar';
  const ops = dinerOpenings().filter((o) => !o.door);
  // the surfaces a bar lands on (the light comes from the el, high and to
  // the east, so it drops as it crosses the room): [kind, x or y, y/x range]
  const C = D.counter;
  const surf = [
    { kind: 'floor', y: F + 0.008, x0: C.frontX + 0.05, x1: D.innerX - 0.1, gain: 1 },
    { kind: 'wallX', x: C.frontX + 0.004, y0: F + 0.12, y1: C.topY - 0.08, gain: 0.8 },
    { kind: 'wallX', x: D.backX + 0.02, y0: 1.2, y1: 2.0, gain: 0.7 },
  ];
  const quads = [];
  for (const o of ops) {
    for (const s of surf) {
      const g = s.kind === 'floor' ? new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2) : new THREE.PlaneGeometry(1, 1).rotateY(Math.PI / 2);
      const m = new THREE.Mesh(g, s.gain === 1 ? mat : mat.clone());
      if (s.gain !== 1) m.material.color.multiplyScalar(s.gain);
      m.layers.set(LAYER.FX); m.renderOrder = 3; m.userData.noRay = true; m.visible = false;
      kit.g.add(m);
      quads.push({ m, o, s });
    }
  }
  // (the bars' z at the surfaces: shifted from the opening by the skew of
  // the light, which comes a little from the north)
  const skew = { floor: -0.5, wallX: -1.2 };
  return {
    quads,
    // bars: [{ z0, z1, k }] in the plane of the front wall
    set(bars) {
      for (const q of quads) {
        let best = null;
        for (const b of bars) {
          const a = Math.max(b.z0, q.o.z0), c = Math.min(b.z1, q.o.z1);
          if (c - a > 0.02 && (!best || c - a > best.c - best.a)) best = { a, c, k: b.k };
        }
        if (!best) { q.m.visible = false; continue; }
        const dz = skew[q.s.kind] * (q.s.x !== undefined && q.s.x < -16 ? 1.6 : 1);
        const z0 = best.a + dz, z1 = best.c + dz;
        q.m.visible = true;
        q.m.material.opacity = best.k;
        if (q.s.kind === 'floor') {
          q.m.scale.set(q.s.x1 - q.s.x0, 1, z1 - z0);
          q.m.position.set((q.s.x0 + q.s.x1) / 2, q.s.y, (z0 + z1) / 2);
        } else {
          q.m.scale.set(1, q.s.y1 - q.s.y0, z1 - z0);
          q.m.position.set(q.s.x, (q.s.y0 + q.s.y1) / 2, (z0 + z1) / 2);
        }
      }
    },
    hide() { for (const q of quads) q.m.visible = false; },
  };
}
// a soft-edged bar (feathered at its ends and sides)
let BAR_TEX = null;
function barTexture() {
  if (BAR_TEX) return BAR_TEX;
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  const img = g.createImageData(64, 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const fx = Math.min(1, Math.min(x, 63 - x) / 10), fy = Math.min(1, Math.min(y, 63 - y) / 6);
    const v = Math.round(255 * fx * fy);
    const i = (y * 64 + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  BAR_TEX = new THREE.CanvasTexture(c);
  BAR_TEX.colorSpace = THREE.SRGBColorSpace;
  return BAR_TEX;
}

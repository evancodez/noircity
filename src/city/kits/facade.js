import * as THREE from 'three';
import { RNG } from '../../util/rng.js';

// NOIR CITY's facade kit (lane O1): a lot of the generator's
// (src/world/cityGen.js) dressed by its district's kit. Two builds, so the
// city is never all in memory at full detail:
//   farLot(lot, out)    what is always drawn, the whole city over: the mass
//                       (tiers, parapets, roofs, water tanks), the lit
//                       windows and the lit shop fronts - the silhouette and
//                       the lights of a night city
//   nearLot(lot, out)   what streams in round the eye: the relief on the
//                       mass's faces (the dark windows and doors, the shop
//                       fronts, the cornices, the fire escapes, the loading
//                       doors, the awnings), never a second mass
// Both lay their pieces in from the same seeded layout (lotWindows), so the
// relief lands exactly round the lights the far build already drew: nothing
// moves when the near build comes in.
// out: { [bucket]: BufferGeometry[] } (the stream and far parts merge each
// bucket into one mesh with its material).
// Buckets: far: mass0 mass1 mass2 (three ink ids, alternating lots), stone0..2,
// lit, shop, roof; near: dark, trim, iron, awning, glass.
const box = (x0, x1, y0, y1, z0, z1) => new THREE.BoxGeometry(Math.max(0.01, x1 - x0), Math.max(0.01, y1 - y0), Math.max(0.01, z1 - z0)).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
// a quad on a face: centre (x, y, z), normal (nx, nz), width w along the face, height h
const quad = (x, y, z, nx, nz, w, h) => new THREE.PlaneGeometry(w, h).rotateY(Math.atan2(nx, nz)).translate(x, y, z);
const push = (out, k, g) => { (out[k] || (out[k] = [])).push(g); };

// the kit's numbers by district (and the named places' own)
export const KITS = {
  downtown: { ground: 4.4, step: [2.8, 3.4], win: [1.2, 1.9], lit: 0.07, shop: 0.7, litShop: 0.18, stone: true, cornice: 0.5, parapet: 0.9 },
  tenement: { ground: 3.4, step: [2.4, 2.9], win: [1.0, 1.6], lit: 0.11, shop: 0.75, litShop: 0.14, cornice: 0.35, parapet: 0.6, escape: 0.55, tank: 0.18 },
  docks: { ground: 4.6, step: [6.5, 9], win: [1.6, 1.2], lit: 0.04, shop: 0, litShop: 0, loading: true, parapet: 0.5 },
  yards: { ground: 4.4, step: [5, 7], win: [1.4, 1.2], lit: 0.03, shop: 0, litShop: 0, loading: true, parapet: 0.3, clerestory: true },
  hill: { ground: 3.8, step: [2.8, 3.4], win: [1.1, 1.9], lit: 0.16, shop: 0, litShop: 0, roof: true },
};
const kitOf = (lot) => KITS[lot.district === 'hill' ? 'hill' : lot.district === 'docks' ? 'docks' : lot.district === 'yards' ? 'yards' : lot.district === 'tenements' ? 'tenement' : 'downtown'];

// ---- the mass: its tiers (a tower steps back as it rises) -------------------------------------
// rect: [{ x0, x1, z0, z1, y0, y1 }]; poly: [{ pts, y0, y1 }]
export function lotTiers(lot) {
  if (lot.kind === 'poly') return [{ pts: lot.pts, y0: 0, y1: lot.h }];
  const { x0, x1, z0, z1, h } = lot;
  if (!lot.tower) return [{ x0, x1, z0, z1, y0: 0, y1: h }];
  // a tower: the base to 40 %, set back 2 m to 72 %, set back 4.5 m to the top
  const T = [], w = x1 - x0, d = z1 - z0;
  const s1 = Math.min(2.2, w * 0.12, d * 0.12), s2 = Math.min(4.6, w * 0.25, d * 0.25);
  T.push({ x0, x1, z0, z1, y0: 0, y1: h * 0.42 });
  T.push({ x0: x0 + s1, x1: x1 - s1, z0: z0 + s1, z1: z1 - s1, y0: h * 0.42, y1: h * 0.74 });
  T.push({ x0: x0 + s2, x1: x1 - s2, z0: z0 + s2, z1: z1 - s2, y0: h * 0.74, y1: h });
  return T;
}

// the faces of a tier that carry windows: { a: [x, z], b: [x, z], n: [nx, nz], y0, y1, ground }
function tierFaces(lot, tier, ti) {
  const F = [];
  if (tier.pts) {
    const P = tier.pts;
    for (let e = 0; e < P.length; e++) {
      const a = P[e], b = P[(e + 1) % P.length];
      const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
      if (L < 3) continue;
      // (outward normal of a CCW polygon: (ez, -ex))
      F.push({ a, b, n: [dz / L, -dx / L], y0: tier.y0, y1: tier.y1, ground: ti === 0 });
    }
    return F;
  }
  const f = lot.faces || {};
  // (a tier above the base is seen from every side; the base only on its streets)
  const all = ti > 0 || lot.house;
  const { x0, x1, z0, z1, y0, y1 } = tier;
  if (all || f.n) F.push({ a: [x1, z0], b: [x0, z0], n: [0, -1], y0, y1, ground: ti === 0, blank: !all && lot.back });
  if (all || f.s) F.push({ a: [x0, z1], b: [x1, z1], n: [0, 1], y0, y1, ground: ti === 0, blank: !all && lot.back });
  if (all || f.w) F.push({ a: [x0, z0], b: [x0, z1], n: [-1, 0], y0, y1, ground: ti === 0, blank: !all && lot.back, alley: f.alleyW });
  if (all || f.e) F.push({ a: [x1, z1], b: [x1, z0], n: [1, 0], y0, y1, ground: ti === 0, blank: !all && lot.back, alley: f.alleyE });
  return F;
}

// ---- the windows: one seeded layout for both builds ---------------------------------------------
// -> [{ x, y, z, nx, nz, w, h, lit, kind: 'win' | 'shop' | 'door' | 'loading' }]
export function lotWindows(lot) {
  if (lot._win) return lot._win;
  const K = kitOf(lot);
  const rng = new RNG((lot.seed || 1) ^ 0x5EED);
  const W = [];
  if (lot.kind === 'garden') return (lot._win = W);
  const tiers = lotTiers(lot);
  tiers.forEach((tier, ti) => {
    for (const f of tierFaces(lot, tier, ti)) {
      const dx = f.b[0] - f.a[0], dz = f.b[1] - f.a[1], L = Math.hypot(dx, dz);
      const ux = dx / L, uz = dz / L;
      if (f.blank) {
        // (a blank side wall: a window or two high up, now and then)
        if (rng.chance(0.4)) { const u = L * rng.range(0.3, 0.7), y = Math.min(f.y1 - 2, 6 + rng.range(0, 4)); W.push({ x: f.a[0] + ux * u, y, z: f.a[1] + uz * u, nx: f.n[0], nz: f.n[1], w: K.win[0], h: K.win[1], lit: rng.chance(0.1), kind: 'win' }); }
        continue;
      }
      const step = rng.range(K.step[0], K.step[1]);
      const n = Math.max(1, Math.floor((L - 1.2) / step));
      const off = (L - (n - 1) * step) / 2;
      const ground = f.ground ? K.ground : 0;
      const fh = lot.fh || 3.5;
      for (let k = 0; k < n; k++) {
        const u = off + k * step;
        const x = f.a[0] + ux * u, z = f.a[1] + uz * u;
        if (f.ground) {
          if (K.loading && (k % 2 === 0)) W.push({ x, y: 2.1, z, nx: f.n[0], nz: f.n[1], w: Math.min(step * 0.62, 4.2), h: 4.0, lit: false, kind: 'loading' });
          else if (K.shop && !f.alley && rng.chance(K.shop)) W.push({ x, y: 1.75, z, nx: f.n[0], nz: f.n[1], w: step * 0.8, h: 2.6, lit: rng.chance(K.litShop), kind: 'shop' });
          else if (!lot.house) W.push({ x, y: 1.2, z, nx: f.n[0], nz: f.n[1], w: 1.05, h: 2.3, lit: false, kind: 'door' });
        }
        for (let y = f.y0 + (f.ground ? ground : 0.6) + 0.9; y + K.win[1] / 2 < f.y1 - 0.9; y += fh) {
          if (lot.house && f.ground && y < 2) continue;
          W.push({ x, y, z, nx: f.n[0], nz: f.n[1], w: K.win[0], h: K.win[1], lit: rng.chance(K.lit * (lot.tower ? 0.8 : 1)), kind: 'win' });
        }
      }
    }
  });
  return (lot._win = W);
}

// ---- the far build ------------------------------------------------------------------------------------
// g: the lot's ink group (0..2)
export function farLot(lot, out, g = 0) {
  const K = kitOf(lot);
  const stone = K.stone || lot.place;
  const massK = (stone ? 'stone' : 'mass') + g;
  if (lot.kind === 'garden') {
    // the garden's wall (with its piers), the trees' crowns over it
    const { x0, x1, z0, z1, wallH } = lot;
    for (const [a, b, c, d] of [[x0, x1, z0, z0 + 0.5], [x0, x1, z1 - 0.5, z1], [x0, x0 + 0.5, z0, z1], [x1 - 0.5, x1, z0, z1]]) push(out, massK, box(a, b, 0, wallH, c, d));
    return;
  }
  for (const t of lotTiers(lot)) {
    if (t.pts) push(out, massK, prism(t.pts, t.y0, t.y1));
    else push(out, massK, box(t.x0, t.x1, t.y0, t.y1, t.z0, t.z1));
  }
  const top = lotTiers(lot).at(-1);
  const rng = new RNG((lot.seed || 1) ^ 0xFA4);
  // the parapet on the top (a lip round the roof)
  if (K.parapet && top.x0 != null && !lot.house) {
    const p = K.parapet, y = top.y1, t = 0.35;
    push(out, massK, box(top.x0, top.x1, y, y + p, top.z0, top.z0 + t));
    push(out, massK, box(top.x0, top.x1, y, y + p, top.z1 - t, top.z1));
    push(out, massK, box(top.x0, top.x0 + t, y, y + p, top.z0, top.z1));
    push(out, massK, box(top.x1 - t, top.x1, y, y + p, top.z0, top.z1));
  }
  // a house's hip roof; a tenement's water tank on its legs; a tower's spire
  if (lot.house) push(out, massK, hipRoof(top.x0, top.x1, top.z0, top.z1, top.y1, 3.2));
  if (K.tank && top.x0 != null && rng.chance(K.tank) && top.x1 - top.x0 > 7 && top.z1 - top.z0 > 7) {
    const cx = top.x0 + (top.x1 - top.x0) * rng.range(0.3, 0.7), cz = top.z0 + (top.z1 - top.z0) * rng.range(0.3, 0.7), y = top.y1;
    push(out, 'roof', new THREE.CylinderGeometry(1.6, 1.6, 3.2, 12).translate(cx, y + 3.4, cz));
    push(out, 'roof', new THREE.ConeGeometry(1.75, 1.2, 12).translate(cx, y + 5.6, cz));
    for (const [ox, oz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) push(out, 'roof', box(cx + ox * 1.1 - 0.08, cx + ox * 1.1 + 0.08, y, y + 1.8, cz + oz * 1.1 - 0.08, cz + oz * 1.1 + 0.08));
  }
  if (lot.tower && rng.chance(0.55)) {
    const cx = (top.x0 + top.x1) / 2, cz = (top.z0 + top.z1) / 2, y = top.y1, w = Math.min(top.x1 - top.x0, top.z1 - top.z0);
    push(out, massK, box(cx - w * 0.22, cx + w * 0.22, y, y + 5, cz - w * 0.22, cz + w * 0.22));
    push(out, 'roof', new THREE.ConeGeometry(w * 0.12, 9 + rng.range(0, 8), 8).translate(cx, y + 5 + 5, cz));
  }
  // the lights: lit windows and lit shop fronts (a hair in front of the face)
  for (const w of lotWindows(lot)) {
    if (!w.lit) continue;
    push(out, w.kind === 'shop' ? 'shop' : 'lit', quad(w.x + w.nx * 0.07, w.y, w.z + w.nz * 0.07, w.nx, w.nz, w.w, w.h));
  }
}

// ---- the near build ----------------------------------------------------------------------------------
export function nearLot(lot, out) {
  const K = kitOf(lot);
  if (lot.kind === 'garden') { nearGarden(lot, out); return; }
  const rng = new RNG((lot.seed || 1) ^ 0x7EA4);
  // the dark openings (a lit one is the far build's: its quad is in front)
  for (const w of lotWindows(lot)) {
    const ang = Math.atan2(w.nx, w.nz);
    // a lit pane (the far build's light): its bars dark over it - a sash's
    // cross, a shop front's mullions and transom - so it reads as a window
    if (w.lit && w.kind === 'win') {
      push(out, 'dark', box(-0.035, 0.035, -w.h / 2, w.h / 2, 0, 0.03).rotateY(ang).translate(w.x + w.nx * 0.08, w.y, w.z + w.nz * 0.08));
      push(out, 'dark', box(-w.w / 2, w.w / 2, -0.035, 0.035, 0, 0.03).rotateY(ang).translate(w.x + w.nx * 0.08, w.y + w.h * 0.1, w.z + w.nz * 0.08));
    }
    if (w.lit && w.kind === 'shop') {
      for (const f of [-1 / 6, 1 / 6]) push(out, 'dark', box(-0.05, 0.05, -w.h / 2, w.h / 2, 0, 0.03).rotateY(ang).translate(w.x + w.nx * 0.08 + Math.cos(ang) * f * w.w * 2, w.y, w.z + w.nz * 0.08 - Math.sin(ang) * f * w.w * 2));
      push(out, 'dark', box(-w.w / 2, w.w / 2, -0.05, 0.05, 0, 0.03).rotateY(ang).translate(w.x + w.nx * 0.08, w.y + w.h * 0.28, w.z + w.nz * 0.08));
    }
    if (w.kind === 'door') push(out, 'trim', box(-0.75, 0.75, 0, 0.15, 0, 0.45).rotateY(ang).translate(w.x, 0.15, w.z));
    if (w.lit && w.kind !== 'door') continue;
    const k = w.kind === 'shop' ? 'glass' : 'dark';
    push(out, k, quad(w.x + w.nx * 0.04, w.y, w.z + w.nz * 0.04, w.nx, w.nz, w.w, w.h));
    // a sill under a window, a frame round a shop front
    if (w.kind === 'win') push(out, 'trim', box(-w.w / 2 - 0.08, w.w / 2 + 0.08, -0.06, 0.06, 0, 0.22).rotateY(Math.atan2(w.nx, w.nz)).translate(w.x, w.y - w.h / 2 - 0.06, w.z));
    if (w.kind === 'shop') push(out, 'trim', box(-w.w / 2 - 0.15, w.w / 2 + 0.15, w.h / 2, w.h / 2 + 0.35, 0, 0.18).rotateY(Math.atan2(w.nx, w.nz)).translate(w.x, w.y, w.z));
  }
  const tiers = lotTiers(lot);
  // the cornices: a band out from every tier's top on its dressed faces, a
  // course over the ground floor
  tiers.forEach((t, ti) => {
    for (const f of tierFaces(lot, t, ti)) {
      if (f.blank) continue;
      const dx = f.b[0] - f.a[0], dz = f.b[1] - f.a[1], L = Math.hypot(dx, dz);
      const ang = Math.atan2(f.n[0], f.n[1]);
      const mx = (f.a[0] + f.b[0]) / 2, mz = (f.a[1] + f.b[1]) / 2;
      const c = K.cornice || 0.25;
      push(out, 'trim', box(-L / 2 - c * 0.5, L / 2 + c * 0.5, -0.3, 0.12, 0, c).rotateY(ang).translate(mx, t.y1 - 0.15, mz));
      if (f.ground && K.ground && !lot.house) push(out, 'trim', box(-L / 2, L / 2, -0.12, 0.12, 0, 0.16).rotateY(ang).translate(mx, K.ground - 0.3, mz));
      // a tenement's fire escape on a street face (not over a shop's sign line)
      if (K.escape && f.ground && !f.alley && L > 7 && rng.chance(K.escape)) fireEscape(out, f, lot, rng);
      // an awning over a shop front now and then (downtown, the tenements)
      if (K.shop && f.ground && rng.chance(0.25)) {
        const u = L * rng.range(0.25, 0.75), w = rng.range(3, 6);
        const ax = f.a[0] + (dx / L) * u, az = f.a[1] + (dz / L) * u;
        const g = new THREE.BoxGeometry(w, 0.08, 1.6).rotateX(-0.32).translate(0, 0, 0.8).rotateY(ang).translate(ax, K.ground - 0.55, az);
        push(out, 'awning', g);
      }
    }
  });
  // a house's porch; a door's step
  if (lot.house) {
    const t = tiers[0];
    push(out, 'trim', box((t.x0 + t.x1) / 2 - 2, (t.x0 + t.x1) / 2 + 2, 0, 0.4, t.z1, t.z1 + 2));
    push(out, 'trim', box((t.x0 + t.x1) / 2 - 2, (t.x0 + t.x1) / 2 + 2, 3.2, 3.4, t.z1, t.z1 + 2.2));
  }
}

// a fire escape up a street face: a landing per floor, its rail, the stair
// between them (black iron: a few strokes on the brick)
function fireEscape(out, f, lot, rng) {
  const dx = f.b[0] - f.a[0], dz = f.b[1] - f.a[1], L = Math.hypot(dx, dz);
  const ux = dx / L, uz = dz / L, nx = f.n[0], nz = f.n[1];
  const w = Math.min(4.2, L * 0.4), u0 = L * rng.range(0.3, 0.7);
  const cx = f.a[0] + ux * u0, cz = f.a[1] + uz * u0;
  const ang = Math.atan2(nx, nz);
  const fh = lot.fh || 3.2;
  for (let y = 4.2; y < f.y1 - 1.5; y += fh) {
    const at = (g) => g.rotateY(ang).translate(cx, y, cz);
    push(out, 'iron', at(new THREE.BoxGeometry(w, 0.06, 1.15).translate(0, 0, 0.62)));
    push(out, 'iron', at(new THREE.BoxGeometry(w, 0.05, 0.05).translate(0, 0.95, 1.18)));
    for (const s of [-1, 1]) push(out, 'iron', at(new THREE.BoxGeometry(0.05, 0.95, 0.05).translate(s * w / 2, 0.47, 1.18)));
    for (const s of [-1, 1]) push(out, 'iron', at(new THREE.BoxGeometry(0.05, 0.95, 0.05).translate(s * w / 2, 0.47, 0.1).translate(0, 0, 1.08 * 0)));
    // the stair to the next landing (a slanted stringer)
    if (y + fh < f.y1 - 1.5) {
      const sL = Math.hypot(w * 0.8, fh);
      push(out, 'iron', at(new THREE.BoxGeometry(sL, 0.08, 0.5).rotateZ(Math.atan2(fh, w * 0.8)).translate(0, fh / 2, 0.85)));
    }
  }
  // (the drop ladder hangs over the pavement, out of a man's reach)
  push(out, 'iron', new THREE.BoxGeometry(0.4, 2.2, 0.05).rotateY(ang).translate(cx + nx * 1.1, 4.2 - 1.2, cz + nz * 1.1));
}

// the garden: its gate in the wall's street side, the trees inside
function nearGarden(lot, out) {
  const rng = new RNG((lot.seed || 1) ^ 0x6A7E);
  const { x0, x1, z0, z1, sides, wallH } = lot;
  // the wall's coping, its piers every 6 m on the street sides
  const piers = (a, b, z, along) => { for (let u = a; u <= b; u += 6) push(out, 'trim', along === 'x' ? box(u - 0.35, u + 0.35, 0, wallH + 0.4, z - 0.35, z + 0.35) : box(z - 0.35, z + 0.35, 0, wallH + 0.4, u - 0.35, u + 0.35)); };
  if (sides.n) piers(x0, x1, z0 + 0.25, 'x');
  if (sides.s) piers(x0, x1, z1 - 0.25, 'x');
  if (sides.w) piers(z0, z1, x0 + 0.25, 'z');
  if (sides.e) piers(z0, z1, x1 - 0.25, 'z');
  // the gates (shut: an iron grille in the wall, its two tall piers)
  const n = lot.gates || 1, W = x1 - x0;
  for (let k = 0; k < n; k++) {
    const gx = x0 + (W / n) * (k + 0.5);
    const gz = sides.s ? z1 : z0;
    const s = sides.s ? 1 : -1;
    push(out, 'iron', box(gx - 2, gx + 2, 0.2, wallH + 0.6, gz + s * 0.02 - 0.03, gz + s * 0.02 + 0.03));
    for (const ox of [-2.3, 2.3]) push(out, 'trim', box(gx + ox - 0.45, gx + ox + 0.45, 0, wallH + 1.4, gz - 0.45, gz + 0.45));
  }
  // the trees: dark crowns over the wall
  const nT = Math.floor(W / 14);
  for (let k = 0; k < nT; k++) {
    const tx = x0 + 4 + rng.next() * (W - 8), tz = z0 + 4 + rng.next() * (z1 - z0 - 8);
    const r = rng.range(2.5, 4.2);
    // (a crown of three lumps: one ball read as a balloon over the wall)
    for (let q = 0; q < 3; q++) push(out, 'tree', new THREE.IcosahedronGeometry(r * rng.range(0.6, 0.85), 2).scale(1, 0.8, 1).translate(tx + rng.range(-1, 1) * r * 0.45, 5 + r * rng.range(0.4, 0.9), tz + rng.range(-1, 1) * r * 0.45));
    push(out, 'iron', new THREE.CylinderGeometry(0.18, 0.25, 5, 6).translate(tx, 2.5, tz));
  }
}

// ---- small solids ------------------------------------------------------------------------------------
// a vertical prism on a convex polygon (CCW in x, z), from y0 to y1
export function prism(P, y0, y1) {
  const pos = [];
  const n = P.length;
  // (walls: outward faces)
  for (let i = 0; i < n; i++) {
    const a = P[i], b = P[(i + 1) % n];
    pos.push(a[0], y0, a[1], b[0], y0, b[1], b[0], y1, b[1], a[0], y0, a[1], b[0], y1, b[1], a[0], y1, a[1]);
  }
  // (the roof and the floor: fans)
  for (let i = 1; i + 1 < n; i++) {
    pos.push(P[0][0], y1, P[0][1], P[i + 1][0], y1, P[i + 1][1], P[i][0], y1, P[i][1]);
    pos.push(P[0][0], y0, P[0][1], P[i][0], y0, P[i][1], P[i + 1][0], y0, P[i + 1][1]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  // (the winding: a CCW polygon in (x, z) seen from above is CW in three's y-up frame)
  fixWinding(g);
  g.computeVertexNormals();
  return g;
}
// flip every triangle whose normal points into the solid's middle
function fixWinding(g) {
  const p = g.getAttribute('position').array;
  let cx = 0, cy = 0, cz = 0; const n = p.length / 3;
  for (let i = 0; i < p.length; i += 3) { cx += p[i]; cy += p[i + 1]; cz += p[i + 2]; }
  cx /= n; cy /= n; cz /= n;
  for (let i = 0; i < p.length; i += 9) {
    const ax = p[i], ay = p[i + 1], az = p[i + 2], bx = p[i + 3], by = p[i + 4], bz = p[i + 5], qx = p[i + 6], qy = p[i + 7], qz = p[i + 8];
    const ux = bx - ax, uy = by - ay, uz = bz - az, vx = qx - ax, vy = qy - ay, vz = qz - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const mx = (ax + bx + qx) / 3 - cx, my = (ay + by + qy) / 3 - cy, mz = (az + bz + qz) / 3 - cz;
    if (nx * mx + ny * my + nz * mz < 0) for (let k = 0; k < 3; k++) { const t = p[i + 3 + k]; p[i + 3 + k] = p[i + 6 + k]; p[i + 6 + k] = t; }
  }
}
// a hip roof over a rect at y
function hipRoof(x0, x1, z0, z1, y, h) {
  const cx = (x0 + x1) / 2, inset = Math.min(x1 - x0, z1 - z0) / 2;
  const r0 = [x0 + inset * 0.9, z0 + inset], r1 = [x1 - inset * 0.9, z0 + inset];
  const A = [x0 - 0.4, z0 - 0.4], B = [x1 + 0.4, z0 - 0.4], C = [x1 + 0.4, z1 + 0.4], D = [x0 - 0.4, z1 + 0.4];
  const R0 = [Math.min(r0[0], cx), (z0 + z1) / 2], R1 = [Math.max(r1[0], cx), (z0 + z1) / 2];
  const pos = [];
  const tri = (a, ay, b, by, c, cy) => pos.push(a[0], ay, a[1], b[0], by, b[1], c[0], cy, c[1]);
  const Y = y + h;
  tri(A, y, B, y, R1, Y); tri(A, y, R1, Y, R0, Y);
  tri(C, y, D, y, R0, Y); tri(C, y, R0, Y, R1, Y);
  tri(B, y, C, y, R1, Y);
  tri(D, y, A, y, R0, Y);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const p = g.getAttribute('position').array;
  // (outward: away from the roof's middle line, up)
  for (let i = 0; i < p.length; i += 9) {
    const ux = p[i + 3] - p[i], uy = p[i + 4] - p[i + 1], uz = p[i + 5] - p[i + 2], vx = p[i + 6] - p[i], vy = p[i + 7] - p[i + 1], vz = p[i + 8] - p[i + 2];
    const ny = uz * vx - ux * vz;
    if (ny < 0) for (let k = 0; k < 3; k++) { const t = p[i + 3 + k]; p[i + 3 + k] = p[i + 6 + k]; p[i + 6 + k] = t; }
  }
  g.computeVertexNormals();
  return g;
}

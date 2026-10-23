import { PAVE, STARTS, RIVER, PIERS, SLIPS, QUAY_OFF, BRIDGE, CRANES, PLACES, districtAt } from './plan.js';
import { lotWindows } from '../city/kits/facade.js';
import { character, STREETS, vhash, vpick } from './streets.js';

// NOIR CITY: the streets dressed by rule (lane O1b; the brief's §1 and §2).
// Run once at the end of the generator (cityGen.generate -> dress(C, ctx)):
// plain numbers, deterministic (every choice a seeded hash of where it
// stands: world/streets.js vhash), no meshes. It reads the generated city
// and writes:
//   lot.fc        the lot's street faces [{ a, b, n, mid, len, st, ch }] (st:
//                 the street it fronts, ch: that street's character there);
//                 lot.ch, lot.mat, lot.win: its main face's
//   win.trade     a shop front's trade (lotWindows' shop windows, by its street)
//   C.lamps       restyled by their street (l.style: goose globe bracket hung
//                 dish; a bracket's and a hung lamp's post taken out of C.posts:
//                 kind 'wall', no post; globe and hung lamps hang their cone straight down)
//   C.dress       the new things on the pavements, ONE RECORD EACH:
//                 { id, kind, x, z, yaw, v (variant 0..1), chunk, r | hx hz,
//                   tag (its collider's), smash (the destruction set's kind) }
//                 - its collider in C.posts (round) or C.walls (a box), tagged;
//                 drawn on its own from its record (parts/dressing.js), never
//                 merged into O1's chunk meshes; registering it with lane O6's
//                 set is one call: smash.register(rec, rec.smash, { merged: true })
//   C.trees       street trees { x, z, kind, v, s, chunk } (their trunks in C.posts, 'tree')
//   C.uniques     the one thing mid-block on each street { id, kind, street, x, z, nx, nz, len, lot, chunk }
//   C.itemSpots   where the items lie (world/items.js): { kind, x, y, z, yaw, place?, chunk }
//   C.steps       the quay's and the piers' stone steps down to the water
//                 { x, z (the landing, on the quay), dx, dz (down the flight),
//                   nx, nz (out to the water), len, top: [x, z], foot: [x, z] }
// ctx: { inLot(x, z, pad), onPave(x, z, m), chunkOf(x, z) } (the generator's)
const KEEP_START = 8;

export function dress(C, ctx) {
  const { inLot, onPave, chunkOf } = ctx;
  const dress = [], trees = [], uniques = [], spots = [];
  // ---- the streets' segments in buckets (which street a face fronts) -------------------
  const SB = 48, segs = new Map();
  const sk = (i, j) => i * 4096 + j;
  for (const st of C.streets) {
    const [ax, az] = st.a, [bx, bz] = st.b, L = Math.hypot(bx - ax, bz - az);
    if (L < 1) continue;
    const s = { st, ax, az, dx: (bx - ax) / L, dz: (bz - az) / L, L };
    const r = st.hw + (st.p || 3) + 8;
    for (let i = Math.floor((Math.min(ax, bx) - r) / SB); i <= Math.floor((Math.max(ax, bx) + r) / SB); i++) for (let j = Math.floor((Math.min(az, bz) - r) / SB); j <= Math.floor((Math.max(az, bz) + r) / SB); j++) {
      if (!segs.has(sk(i, j))) segs.set(sk(i, j), []);
      segs.get(sk(i, j)).push(s);
    }
  }
  // the street a face looks onto: from its middle out along n, the nearest
  // segment running along the face (the bridge never)
  const streetOf = (mx, mz, nx, nz) => {
    let best = null, bd = Infinity;
    const px = mx + nx * 3, pz = mz + nz * 3;
    for (const s of segs.get(sk(Math.floor(px / SB), Math.floor(pz / SB))) || []) {
      if (s.st.bridge) continue;
      if (Math.abs(s.dx * nx + s.dz * nz) > 0.35) continue;
      const u = Math.max(0, Math.min(s.L, (px - s.ax) * s.dx + (pz - s.az) * s.dz));
      const d = Math.hypot(px - s.ax - s.dx * u, pz - s.az - s.dz * u);
      // (the street must be out in front of the face, within its pavement and half)
      const ahead = (s.ax + s.dx * u - mx) * nx + (s.az + s.dz * u - mz) * nz;
      if (ahead < 0 || d > s.st.hw + (s.st.p || 3) + 3) continue;
      if (d < bd) { bd = d; best = s.st; }
    }
    return best;
  };

  // ---- every lot's street faces, its character --------------------------------------------
  for (const L of C.lots) {
    if (L.kind === 'garden' || L.back || L.house || L.hall) continue;
    const F = [];
    if (L.kind === 'rect') {
      const f = L.faces || {};
      if (f.n) F.push({ a: [L.x1, L.z0], b: [L.x0, L.z0], n: [0, -1] });
      if (f.s) F.push({ a: [L.x0, L.z1], b: [L.x1, L.z1], n: [0, 1] });
      if (f.w) F.push({ a: [L.x0, L.z0], b: [L.x0, L.z1], n: [-1, 0], alley: !!f.alleyW });
      if (f.e) F.push({ a: [L.x1, L.z1], b: [L.x1, L.z0], n: [1, 0], alley: !!f.alleyE });
    } else {
      const P = L.pts;
      for (let e = 0; e < P.length; e++) {
        const a = P[e], b = P[(e + 1) % P.length], dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
        if (len < 3) continue;
        // (a -> b always the face's local +x: rotateY(atan2(nx, nz)) of (1, 0, 0) is (nz, -nx), as the rect faces have it)
        const n = [dz / len, -dx / len];
        F.push(dx * n[1] - dz * n[0] >= 0 ? { a, b, n } : { a: b, b: a, n });
      }
    }
    L.fc = [];
    for (const f of F) {
      const mx = (f.a[0] + f.b[0]) / 2, mz = (f.a[1] + f.b[1]) / 2, len = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]);
      const st = f.alley ? null : streetOf(mx, mz, f.n[0], f.n[1]);
      if (!st) continue;
      const ch = character(st.id, districtAt(mx, mz).id);
      L.fc.push({ ...f, mid: [mx, mz], len, st: st.id, name: st.name, hw: st.hw, p: st.p, ch });
    }
    if (!L.fc.length) continue;
    const main = L.fc.reduce((a, b) => (b.len > a.len ? b : a));
    L.ch = main.ch; L.mat = main.ch.mat; L.win = main.ch.win; L.st = main.st;
    // the shop fronts' trades: by the street each faces (a seeded pick by where it stands)
    for (const w of lotWindows(L)) {
      if (w.kind !== 'shop') continue;
      const fc = L.fc.find((q) => Math.abs(q.n[0] - w.nx) < 0.01 && Math.abs(q.n[1] - w.nz) < 0.01);
      const ch = fc ? fc.ch : L.ch;
      if (ch.trades && ch.trades.length && !L.place) w.trade = vpick(ch.trades, w.x, w.z, 7);
      // (a fifth more of them lit: what the trade has shows dark against the glass)
      if (w.trade && !w.lit && vhash(w.x, w.z, 8) < 0.2) w.lit = true;
    }
  }

  // ---- the placed things: a spatial list for the spacing checks ------------------------------
  const B = 8, near = new Map();
  const bk = (x, z) => Math.floor(x / B) * 8192 + Math.floor(z / B);
  const note = (x, z, r, what) => { const k = bk(x, z); if (!near.has(k)) near.set(k, []); near.get(k).push({ x, z, r, what }); };
  const clear = (x, z, r, pad = 0.35) => {
    for (let i = Math.floor((x - 4) / B); i <= Math.floor((x + 4) / B); i++) for (let j = Math.floor((z - 4) / B); j <= Math.floor((z + 4) / B); j++) {
      for (const o of near.get(i * 8192 + j) || []) if (Math.hypot(o.x - x, o.z - z) < o.r + r + pad) return false;
    }
    return true;
  };
  for (const p of C.posts) note(p.x, p.z, p.r + 0.2, p.tag);
  for (const w of C.walls) if (w.tag !== 'wall' && w.tag !== 'edge' && w.hx < 3 && w.hz < 3) note(w.cx, w.cz, Math.hypot(w.hx, w.hz), w.tag);
  for (const p of C.props) if (!p.road) note(p.x, p.z, p.kind === 'newsstand' ? 1.2 : p.kind === 'bench' ? 1.0 : 0.5, p.kind);
  // (the doors: a clear way in front of every one)
  for (const L of C.lots) if (L.fc) for (const w of lotWindows(L)) if (w.kind === 'door') { note(w.x + w.nx * 0.75, w.z + w.nz * 0.75, 0.55, 'door'); }
  // (the starts: their car and me kept clear)
  for (const s of Object.values(STARTS)) note(s.car.x, s.car.z, KEEP_START, 'start');
  // (the places' doors: O5's ways in)
  const placeDoor = (id) => { const L = C.lots.find((l) => l.place && l.place.id === id); return L; };
  void placeDoor;

  let nid = 1;
  // a thing on the pavement: one record, its collider, its note
  const put = (kind, x, z, yaw, o) => {
    const r = o.r ?? Math.hypot(o.hx || 0.3, o.hz || 0.3);
    if (!onPave(x, z, (o.r ?? Math.min(o.hx, o.hz)) + 0.05) || inLot(x, z, (o.r ?? Math.min(o.hx, o.hz)) * 0.6) || !clear(x, z, r, o.pad ?? 0.3)) return null;
    const rec = { id: nid++, kind, x, z, yaw, v: vhash(x, z, 31), chunk: chunkOf(x, z), ...o };
    dress.push(rec);
    note(x, z, r, kind);
    if (o.r != null) C.posts.push({ x, z, r: o.r, tag: o.tag || kind, dress: rec });
    else C.walls.push({ cx: x, cz: z, hx: o.hx, hz: o.hz, angle: yaw, tag: o.tag || kind, dress: rec });
    return rec;
  };
  // the shapes (their colliders) and the destruction set's kinds (lane O6:
  // docs/seams/SMASH.md; the new kinds are this lane's to add to its set)
  const SH = {
    crates: { hx: 0.55, hz: 0.42, smash: 'crate' },
    barrels: { r: 0.62, smash: 'barrel' },
    barrel: { r: 0.33, smash: 'barrel' },
    churns: { r: 0.4, smash: 'churn' },
    mailbox: { r: 0.3, smash: 'mailbox' },
    booth: { hx: 0.55, hz: 0.55, smash: 'booth' },
    fruit: { hx: 1.15, hz: 0.42, smash: 'stall' },
    flowers: { r: 0.5, smash: 'flowers' },
    board: { hx: 0.32, hz: 0.28, smash: 'board' },
    bike: { hx: 0.88, hz: 0.14, smash: 'bike' },
    bins: { r: 0.5, smash: 'bin' },
    rainbarrel: { r: 0.38, smash: 'rainbarrel' },
    drums: { r: 0.62, smash: 'drum' },
    cart: { hx: 1.15, hz: 0.6, smash: 'cart' },
  };
  // along a face: the point u m from a, out o m from the wall; the face's yaw (its along-axis)
  const along = (f, u, o) => { const ux = (f.b[0] - f.a[0]) / f.len, uz = (f.b[1] - f.a[1]) / f.len; return [f.a[0] + ux * u + f.n[0] * o, f.a[1] + uz * u + f.n[1] * o, Math.atan2(-uz, ux)]; };
  const uOf = (f, x, z) => ((x - f.a[0]) * (f.b[0] - f.a[0]) + (z - f.a[1]) * (f.b[1] - f.a[1])) / f.len;
  const tryPut = (kind, f, u, o, extra = {}) => {
    if (u < 1 || u > f.len - 1) return null;
    const S = SH[kind];
    const [x, z, yaw] = along(f, u, o + (S.r ?? S.hz));
    return put(kind, x, z, yaw, { ...S, face: f.n, ...extra });
  };

  // ---- the pavements by rule: each lot's street faces ------------------------------------------
  for (const L of C.lots) {
    if (!L.fc || L.place) continue;
    const W = lotWindows(L);
    for (const f of L.fc) {
      const ch = f.ch, P = ch.props || {};
      if (f.st === 'river' || (f.p || 3) < 1.9) continue;
      const room = (f.p || 3) - 1.4;     // (the walk kept clear by the kerb)
      const ground = W.filter((w) => Math.abs(w.nx - f.n[0]) < 0.01 && Math.abs(w.nz - f.n[1]) < 0.01 && w.y < 4.5);
      for (const w of ground) {
        const u = uOf(f, w.x, w.z), h = vhash(w.x, w.z, 101), h2 = vhash(w.x, w.z, 202), side = h2 < 0.5 ? -1 : 1;
        if (w.kind === 'loading') {
          if (h < (P.crate || 0)) tryPut('crates', f, u + side * (w.w / 2 + 0.9), 0.05);
          if (h2 < (P.barrel || 0)) tryPut(vhash(w.x, w.z, 9) < 0.5 ? 'barrels' : 'barrel', f, u - side * (w.w / 2 + 0.9), 0.05);
          if (vhash(w.x, w.z, 303) < (P.drum || 0)) tryPut('drums', f, u - side * (w.w / 2 + 2.2), 0.05);
          if (vhash(w.x, w.z, 404) < (P.cart || 0) * 0.6 && room > 1.2) tryPut('cart', f, u + side * (w.w / 2 + 2.6), 0.15);
        } else if (w.kind === 'shop') {
          if (w.trade === 'grocer' && h < 0.85) tryPut('fruit', f, u, 0.05);
          else if (w.trade === 'florist' && h < 0.9) tryPut('flowers', f, u + side * w.w * 0.3, 0.05);
          else if (h < (P.fruit || 0) * 0.3 && room > 0.8) tryPut('crates', f, u + side * w.w * 0.35, 0.05);
          if (h2 < (P.board || 0) * 0.5 && room > 1.1) tryPut('board', f, u + side * (w.w / 2 + 0.2), 0.9, { yaw0: 1 });
          if (vhash(w.x, w.z, 505) < (P.bike || 0) * 0.5) tryPut('bike', f, u - side * (w.w / 2 + 0.5), 0.02);
        } else if (w.kind === 'door') {
          if (h < (P.churn || 0) * 0.5) tryPut('churns', f, u + side * 1.3, 0.05);
          if (h2 < (P.bin || 0) * 0.35) tryPut('bins', f, u - side * 1.55, 0.05);
          if (vhash(w.x, w.z, 606) < (P.bike || 0) * 0.3) tryPut('bike', f, u + side * 2.0, 0.02);
        }
      }
      // a rain barrel under a downpipe at the face's end
      for (const end of [1.2, f.len - 1.2]) if (vhash(f.a[0] + end, f.a[1], 707) < (P.rainbarrel || 0) * 0.6) tryPut('rainbarrel', f, end, 0.05);
    }
  }
  // ---- the alleys: dustbins in a row, a barrel, crates ---------------------------------------
  for (const A of C.alleys) {
    const cx = (A.x0 + A.x1) / 2;
    const n = Math.floor((A.z1 - A.z0) / 7);
    for (let k = 0; k < n; k++) {
      const z = A.z0 + 4 + k * 7 + vhash(cx, k, 1) * 2, side = vhash(cx, z, 2) < 0.5 ? -1 : 1;
      const x = side < 0 ? A.x0 + 0.55 : A.x1 - 0.55;
      const pick = vhash(x, z, 3);
      const kind = pick < 0.45 ? 'bins' : pick < 0.65 ? 'crates' : pick < 0.8 ? 'rainbarrel' : 'barrel';
      const S = SH[kind];
      const rec = { ...S, face: [side < 0 ? 1 : -1, 0], alley: true };
      // (an alley is at pavement height but is no pavement polygon: placed by its own walls)
      if (!clear(x, z, S.r ?? S.hx, 0.3)) continue;
      const r0 = { id: nid++, kind, x, z, yaw: Math.PI / 2, v: vhash(x, z, 31), chunk: chunkOf(x, z), ...rec };
      dress.push(r0); note(x, z, S.r ?? S.hx, kind);
      if (S.r != null) C.posts.push({ x, z, r: S.r, tag: kind, dress: r0 });
      else C.walls.push({ cx: x, cz: z, hx: S.hx, hz: S.hz, angle: Math.PI / 2, tag: kind, dress: r0 });
    }
  }
  // ---- a newsstand at a corner now and then (downtown, the tenements): where
  // the paper is (the items' newspaper; O1's furniture kind, so lane O6's set takes it)
  for (const p of [...C.props]) {
    if (p.kind !== 'namesign') continue;
    const D = districtAt(p.x, p.z).id;
    if ((D !== 'downtown' && D !== 'tenements') || vhash(p.x, p.z, 810) > 0.45) continue;
    const jx = Math.round(p.x / 30) * 30, jz = Math.round(p.z / 30) * 30;
    const sz = Math.sign(p.z - jz) || 1, sx = Math.sign(p.x - jx) || 1;
    for (const [d, o] of [[4.5, 0.5], [6.5, 0.5], [4.5, 1.2]]) {
      const x = p.x + sx * o, z = p.z + sz * d, yaw = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
      if (!onPave(x, z, 0.6) || inLot(x, z, 0.6) || !clear(x, z, 0.9, 0.3)) continue;
      C.props.push({ kind: 'newsstand', x, z, yaw, chunk: chunkOf(x, z), o1b: true });
      C.walls.push({ cx: x, cz: z, hx: 0.85, hz: 0.55, angle: yaw, tag: 'stand' });
      note(x, z, 1.0, 'newsstand');
      break;
    }
  }
  // ---- the corners: a mailbox, a phone booth (by their street's character) --------------------
  for (const p of C.props) {
    if (p.kind !== 'namesign') continue;
    const st = C.streets.find((s) => s.name === p.names[0]) || C.streets.find((s) => s.name === p.names[1]);
    if (!st) continue;
    const ch = character(st.id, districtAt(p.x, p.z).id), P = ch.props || {};
    const h = vhash(p.x, p.z, 808);
    // (along the north-south kerb from the post, then the east-west)
    for (const [dx, dz, kind] of [[0, Math.sign(-p.z + Math.round(p.z / 30) * 30) || 1, 'mailbox'], [Math.sign(-p.x + Math.round(p.x / 30) * 30) || 1, 0, 'booth']]) {
      if ((kind === 'mailbox' ? h : vhash(p.x, p.z, 809)) > (P[kind] || 0)) continue;
      for (const d of [2.6, 3.6, -2.6]) {
        const S = SH[kind], x = p.x + dx * d, z = p.z + dz * d;
        if (put(kind, x, z, dz ? Math.PI / 2 : 0, { ...S })) break;
      }
    }
  }

  // ---- the lamps by their street's character --------------------------------------------------
  const postAt = new Map();
  for (const p of C.posts) if (p.tag === 'lamp') postAt.set(`${p.x.toFixed(2)},${p.z.toFixed(2)}`, p);
  const dropPost = (l) => { const k = `${l.x.toFixed(2)},${l.z.toFixed(2)}`, p = postAt.get(k); if (p) { const i = C.posts.indexOf(p); if (i >= 0) C.posts.splice(i, 1); } };
  const byId = new Map(C.streets.map((s) => [s.id, s]));
  for (const l of C.lamps) {
    if (l.quay || l.bridge || l.park || !l.street) continue;
    const st = byId.get(l.street);
    if (!st) continue;
    const ch = character(l.street, districtAt(l.x, l.z).id);
    let style = ch.lamp || 'goose';
    const ax = Math.cos(l.yaw), az = -Math.sin(l.yaw);     // the arm: toward the street's middle
    const p = st.p || 3, hw = st.hw;
    if (style === 'hung') {
      // to the street's middle, a wall each side at the building line
      const cx = l.x + ax * (hw + 0.7), cz = l.z + az * (hw + 0.7);
      const half = hw + p;
      if (inLot(cx + ax * (half + 0.4), cz + az * (half + 0.4), 0) && inLot(cx - ax * (half + 0.4), cz - az * (half + 0.4), 0)) {
        dropPost(l);
        l.x = cx; l.z = cz; l.style = 'hung'; l.kind = 'wall'; l.hanging = true; l.span = half * 2;
        continue;
      }
      style = 'bracket';
    }
    if (style === 'bracket') {
      // back to the wall behind it (the building line), the lantern out over the pavement
      const back = p - 0.7;
      const wx = l.x - ax * (back - 0.06), wz = l.z - az * (back - 0.06);
      if (back > 0.8 && inLot(wx - ax * 0.5, wz - az * 0.5, 0) && !inLot(wx + ax * 0.3, wz + az * 0.3, 0)) {
        dropPost(l);
        l.x = wx; l.z = wz; l.style = 'bracket'; l.kind = 'wall';
        continue;
      }
      style = 'goose';
    }
    l.style = style;
    if (style === 'globe') l.hanging = true;
  }
  // (a lane of hung lamps has them close: one between every two more than 24 m apart, where both walls are there)
  const hungBy = new Map();
  for (const l of C.lamps) if (l.style === 'hung') { if (!hungBy.has(l.street)) hungBy.set(l.street, []); hungBy.get(l.street).push(l); }
  for (const list of hungBy.values()) {
    list.sort((p, q) => (p.x - q.x) || (p.z - q.z));
    for (let i = 0; i + 1 < list.length; i++) {
      const p = list[i], q = list[i + 1], d = Math.hypot(q.x - p.x, q.z - p.z);
      if (d < 24 || d > 70) continue;
      const x = (p.x + q.x) / 2, z = (p.z + q.z) / 2, ax = Math.cos(p.yaw), az = -Math.sin(p.yaw), half = p.span / 2;
      if (!inLot(x + ax * (half + 0.4), z + az * (half + 0.4), 0) || !inLot(x - ax * (half + 0.4), z - az * (half + 0.4), 0)) continue;
      C.lamps.push({ ...p, x, z, extra: true });
    }
  }
  // ---- the street trees (their street's kind, every treeStep m, both kerbs of the wide ones) ----
  for (const st of C.streets) {
    if (st.river || st.bridge || st.cls === 'lane' || (st.p || 3) < 3) continue;
    const [ax, az] = st.a, [bx, bz] = st.b, L = Math.hypot(bx - ax, bz - az);
    if (L < 40) continue;
    const dx = (bx - ax) / L, dz = (bz - az) / L, nx = -dz, nz = dx;
    const mid = [(ax + bx) / 2, (az + bz) / 2];
    const ch = character(st.id, districtAt(mid[0], mid[1]).id);
    if (!ch.trees) continue;
    const step = ch.treeStep || 26;
    for (let u = 16 + vhash(ax, az, 5) * 6; u < L - 14; u += step) for (const sd of [-1, 1]) {
      const x = ax + dx * u + nx * (st.hw + 1.25) * sd, z = az + dz * u + nz * (st.hw + 1.25) * sd;
      if (!onPave(x, z, 0.7) || inLot(x, z, 1.2) || !clear(x, z, 0.9, 0.6)) continue;
      const t = { x, z, kind: ch.trees, v: vhash(x, z, 77), s: 0.85 + vhash(x, z, 78) * 0.35, chunk: chunkOf(x, z), street: st.id };
      trees.push(t); note(x, z, 0.9, 'tree');
      C.posts.push({ x, z, r: 0.28, tag: 'tree' });
    }
  }

  // ---- the Hill's curving lane (the brief: "the Hill gets a curving lane") ------------------------
  const lane = hillLane(C, { chunkOf, note, trees });
  if (lane) uniques.push(lane);
  // ---- the one thing mid-block that is only there -----------------------------------------------
  for (const [id, S] of Object.entries(STREETS)) {
    if (!S.unique || S.unique === 'lane') continue;
    // the street's segments, its middle by length
    const parts = C.streets.filter((s) => s.id === id && !s.bridge);
    if (!parts.length) continue;
    let tot = 0; for (const s of parts) tot += Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
    // the faces on this street: the one nearest the street's middle (by length), long enough
    let acc = 0, mid = null;
    for (const s of parts) { const l = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]); if (acc + l >= tot / 2) { const t = (tot / 2 - acc) / l; mid = [s.a[0] + (s.b[0] - s.a[0]) * t, s.a[1] + (s.b[1] - s.a[1]) * t]; break; } acc += l; }
    if (!mid) continue;
    const want = UNIQUE_W[S.unique] || 8;
    let best = null, bd = Infinity;
    for (const L of C.lots) {
      if (!L.fc || L.place || L.used) continue;
      for (const f of L.fc) {
        if (f.st !== id || f.len < want) continue;
        const d = Math.hypot(f.mid[0] - mid[0], f.mid[1] - mid[1]);
        if (d < bd) { bd = d; best = { L, f }; }
      }
    }
    if (!best) continue;
    best.L.used = S.unique;
    const f = best.f;
    const u = { id, kind: S.unique, street: id, name: f.name, x: f.mid[0], z: f.mid[1], nx: f.n[0], nz: f.n[1], len: f.len, a: f.a, b: f.b, lot: best.L, h: best.L.h, p: f.p || 3, hw: f.hw, chunk: chunkOf(f.mid[0], f.mid[1]) };
    uniques.push(u);
    best.L.unique = u;
    // (what stands out on the pavement is solid: the canopy's posts, the clock's pillar, the statue, the fountain, the water tower's legs)
    const ox = (o) => [u.x + u.nx * o, u.z + u.nz * o];
    if (u.kind === 'canopy') for (const s of [-1, 1]) { const [x, z] = ox(u.p - 0.6); C.posts.push({ x: x - u.nz * s * 2.6, z: z + u.nx * s * 2.6, r: 0.12, tag: 'post' }); }
    if (u.kind === 'clock') { const [x, z] = ox(u.p - 0.8); C.posts.push({ x, z, r: 0.28, tag: 'post' }); u.post = [x, z]; }
    // (a piece in the face's frame: along a, out o -> the world; a box there)
    const tx = u.nz, tz = -u.nx;     // (the builders' local +x: rotateY(atan2(nx, nz)) of (1, 0, 0))
    const lbox = (a, o, hx, hz) => C.walls.push({ cx: u.x + tx * a + u.nx * o, cz: u.z + tz * a + u.nz * o, hx, hz, angle: Math.atan2(-tz, tx), tag: 'stand', unique: u.kind });
    if (u.kind === 'columns') { const w = Math.min(u.len - 2, 14); for (let k = 0; k < 6; k++) { const a = -w / 2 + (k + 0.5) * (w / 6); C.posts.push({ x: u.x + tx * a + u.nx * 1.1, z: u.z + tz * a + u.nz * 1.1, r: 0.42, tag: 'post' }); } }
    if (u.kind === 'cellar') lbox(1.2, 0.63, 1.42, 0.64);
    if (u.kind === 'poultry') lbox(-0.85, 0.35, 1.2, 0.3);
    if (u.kind === 'yardgate') { const w = Math.min(u.len - 2, 10); for (const s of [-1, 1]) lbox(s * (w / 2 + 0.3), 0.3, 0.3, 0.3); }
    if (u.kind === 'fountain') lbox(0, 0.3, 0.6, 0.3);
    if (u.kind === 'barber') C.posts.push({ x: u.x + tx * 1.4 + u.nx * 0.35, z: u.z + tz * 1.4 + u.nz * 0.35, r: 0.16, tag: 'post' });
  }
  // ---- where the items lie (world/items.js places and renews them) ---------------------------------
  // cash: at a dead end's end, in an alley behind its bins (a roll in the rain)
  for (const A of C.alleys) {
    const cx = (A.x0 + A.x1) / 2, h = vhash(cx, A.z0, 901);
    if (h > (A.through ? 0.3 : 0.75)) continue;
    const z = A.through ? A.z0 + (A.z1 - A.z0) * (0.3 + h) : A.z1 - 1.2;
    spots.push({ kind: 'cash', x: cx + (vhash(cx, z, 3) - 0.5) * 2.4, y: PAVE, z, yaw: h * 6, chunk: chunkOf(cx, z) });
  }
  // cash: by a rain barrel, a stack of drums, a handcart (the yards', the docks')
  for (const r of dress) {
    if (!['rainbarrel', 'drums', 'cart'].includes(r.kind) || vhash(r.x, r.z, 905) > (r.kind === 'cart' ? 0.4 : 0.09)) continue;
    const fx = r.face ? r.face[0] : 0, fz = r.face ? r.face[1] : 0;
    const x = r.x + fz * 0.85 + fx * 0.35, z = r.z - fx * 0.85 + fz * 0.35;
    if (onPave(x, z, 0.15) && !inLot(x, z, 0.05) && clear(x, z, 0.1, 0.05)) spots.push({ kind: 'cash', x, y: PAVE, z, yaw: vhash(x, z, 6) * 6, chunk: chunkOf(x, z) });
  }
  // rounds: by a loading door in the docks and the tenements' dead ends, behind the crates
  for (const r of dress) {
    if ((r.kind === 'crates' || r.kind === 'barrels') && vhash(r.x, r.z, 902) < 0.08 && spots.filter((s) => s.kind === 'rounds').length < 24) {
      const fx = r.face ? r.face[0] : 0, fz = r.face ? r.face[1] : 0;
      const x = r.x + fz * 0.9 + fx * 0.15, z = r.z - fx * 0.9 + fz * 0.15;
      if (onPave(x, z, 0.2) && !inLot(x, z, 0.1)) spots.push({ kind: 'rounds', x, y: PAVE, z, yaw: r.yaw, chunk: chunkOf(x, z) });
    }
  }
  // bottles: on a step by a door, by the bins
  for (const r of dress) {
    if ((r.kind === 'bins' || r.kind === 'churns') && vhash(r.x, r.z, 903) < 0.12 && spots.filter((s) => s.kind === 'bottle').length < 60) {
      const fz = r.face ? r.face[1] : 0, fx = r.face ? r.face[0] : 0;
      const x = r.x + fx * 0.75 + fz * 0.5, z = r.z + fz * 0.75 - fx * 0.5;
      if ((r.alley || onPave(x, z, 0.15)) && !inLot(x, z, 0.05)) spots.push({ kind: 'bottle', x, y: PAVE, z, yaw: vhash(x, z, 4) * 6, chunk: chunkOf(x, z) });
    }
  }
  // a bottle on a stoop now and then (the tenements', the docks')
  for (const L of C.lots) {
    if (!L.fc || L.place || (L.district !== 'tenements' && L.district !== 'docks')) continue;
    for (const w of lotWindows(L)) {
      if (w.kind !== 'door' || vhash(w.x, w.z, 904) > 0.035 || spots.filter((s) => s.kind === 'bottle').length >= 60) continue;
      const s = vhash(w.x, w.z, 5) < 0.5 ? -1 : 1, x = w.x + w.nx * 0.45 - w.nz * 0.62 * s, z = w.z + w.nz * 0.45 + w.nx * 0.62 * s;
      if (onPave(x, z, 0.1) && !inLot(x, z, 0.02)) spots.push({ kind: 'bottle', x, y: PAVE + 0.15, z, yaw: vhash(x, z, 4) * 6, chunk: chunkOf(x, z) });
    }
  }
  // a matchbook at every bar's door (on its step): the bars, the cellar bar, the dance hall, the seamen's hall
  for (const pl of PLACES) {
    if (pl.kind !== 'bar') continue;
    const L = C.lots.find((l) => l.place === pl);
    const d = L && lotWindows(L).filter((w) => w.kind === 'door').sort((p, q) => Math.hypot(p.x - pl.at[0], p.z - pl.at[1]) - Math.hypot(q.x - pl.at[0], q.z - pl.at[1]))[0];
    if (d) spots.push({ kind: 'matchbook', place: pl.id, name: pl.district === 'docks' ? 'THE ANCHOR' : 'THE BLUE NOTE', x: d.x + d.nx * 0.55 + (-d.nz) * 0.5, y: PAVE + 0.15, z: d.z + d.nz * 0.55 + d.nx * 0.5, yaw: 0.4, chunk: chunkOf(d.x, d.z) });
  }
  for (const u of uniques) {
    const name = { cellar: 'THE CELLAR', ballroom: 'THE ROSELAND', seamen: 'SEAMEN\'S REST', chinese: 'THE JADE GARDEN' }[u.kind];
    if (!name) continue;
    const x = u.x + u.nx * 0.6 + (-u.nz) * (u.kind === 'cellar' ? 2.6 : 1.4), z = u.z + u.nz * 0.6 + u.nx * (u.kind === 'cellar' ? 2.6 : 1.4);
    spots.push({ kind: 'matchbook', place: u.kind, name, x, y: PAVE + 0.15, z, yaw: 0.2, chunk: chunkOf(x, z) });
  }
  // a newspaper at every newsstand
  for (const p of C.props) {
    if (p.kind !== 'newsstand') continue;
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
    spots.push({ kind: 'paper', x: p.x + fx * 0.75, y: PAVE + 0.9, z: p.z + fz * 0.75, yaw: p.yaw, stand: p, chunk: chunkOf(p.x, p.z) });
  }

  // ---- the steps' lamps: a globe at every landing (the world says where the way out of the water is)
  for (const s of ctx.steps || []) {
    const [x, z] = s.lamp;
    C.lamps.push({ x, z, yaw: Math.atan2(-s.nz, s.nx), kind: 'post', style: 'globe', hanging: true, street: 'river', quay: true, steps: true });
    C.posts.push({ x, z, r: 0.2, tag: 'lamp' });
  }
  C.dress = dress; C.trees = trees; C.uniques = uniques; C.itemSpots = spots;
  return { dress: dress.length, trees: trees.length, uniques: uniques.length, spots: spots.length };
}

// ---- the Hill's lane: an S-curve up from Bridge St to Hill Rd through the
// garden between Baxter St and the Bowery's block, walled each side, globe
// lamps along it, a big house in each garden it leaves. At the pavements'
// height (a car bumps up its mouth as up a kerb); walls solid to a man and a car.
export const LANE = { x0: -21, x1: 60, z0: -531, z1: -431, amp: 14, hw: 3.2, verge: 1.2 };
function hillLane(C, { chunkOf, note, trees }) {
  const gi = C.lots.findIndex((l) => l.kind === 'garden' && Math.abs(l.x0 - LANE.x0) < 1 && Math.abs(l.z0 - LANE.z0) < 1);
  if (gi < 0) return null;
  const G0 = C.lots[gi];
  // the garden and its house go (their walls with them)
  const gone = new Set([G0, ...C.lots.filter((l) => l.house && l.x0 > G0.x0 && l.x1 < G0.x1 && l.z0 > G0.z0 && l.z1 < G0.z1)]);
  for (let i = C.lots.length - 1; i >= 0; i--) if (gone.has(C.lots[i])) C.lots.splice(i, 1);
  for (let i = C.walls.length - 1; i >= 0; i--) if (gone.has(C.walls[i].lot)) C.walls.splice(i, 1);
  const { x0, x1, z0, z1, amp, hw, verge } = LANE, cx = (x0 + x1) / 2;
  // the centre line, sampled
  const N = 32, pts = [];
  for (let k = 0; k <= N; k++) { const t = k / N; pts.push([cx + amp * Math.sin(t * Math.PI * 2), z0 - 1.5 + (z1 - z0 + 3) * t]); }
  const nrm = (k) => { const a = pts[Math.max(0, k - 1)], b = pts[Math.min(N, k + 1)], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); return [-dz / L, dx / L]; };
  const off = (k, o) => { const n = nrm(k); return [pts[k][0] + n[0] * o, pts[k][1] + n[1] * o]; };
  const box = (a, b, t, tag = 'wall') => { const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); return { cx: (a[0] + b[0]) / 2, cz: (a[1] + b[1]) / 2, hx: L / 2 + t * 0.5, hz: t, angle: Math.atan2(-dz, dx), tag, laneWall: true, a, b }; };
  const walls = [];
  // the lane's walls, each side, from mouth to mouth
  for (const s of [-1, 1]) for (let k = 1; k + 1 <= N - 1; k++) walls.push(box(off(k, s * (hw + verge)), off(k + 1, s * (hw + verge)), 0.25));
  // the gardens' outer walls on the streets' sides (open at the lane's two mouths) and the east side
  const mouthW = hw + verge + 0.3;
  const run = (a, b) => { if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 0.4) walls.push(box(a, b, 0.25)); };
  for (const z of [z0 + 0.25, z1 - 0.25]) { const mx = pts[z === z0 + 0.25 ? 1 : N - 1][0]; run([x0, z], [mx - mouthW, z]); run([mx + mouthW, z], [x1, z]); }
  run([x0 + 0.25, z0], [x0 + 0.25, z1]); run([x1 - 0.25, z0], [x1 - 0.25, z1]);
  for (const w of walls) C.walls.push(w);
  // a big house in each garden, clear of the lane
  const houses = [[cx - 26, (z0 * 3 + z1) / 4, 11, 8], [cx + 22, (z0 + z1 * 3) / 4, 11, 8]];
  for (const [hx, hz, ex, ez] of houses) {
    const floors = 3, L = { kind: 'rect', x0: hx - ex, x1: hx + ex, z0: hz - ez, z1: hz + ez, h: 1.2 + floors * 3.8 + 2.5, floors, fh: 3.8, kit: 'hill', house: true, faces: { n: true, s: true, w: true, e: true }, district: 'hill', seed: Math.round(hx * 37 + hz * 11) & 0xffff, cx: hx, cz: hz, chunk: chunkOf(hx, hz), laneHouse: true };
    C.lots.push(L);
    C.walls.push({ cx: hx, cz: hz, hx: ex, hz: ez, angle: 0, tag: 'wall', lot: L });
  }
  // its globe lamps, alternately each side between the lane and its wall
  for (let k = 3, s = 1; k < N - 1; k += 5, s = -s) {
    const [x, z] = off(k, s * (hw + 0.55)), n = nrm(k);
    C.lamps.push({ x, z, yaw: Math.atan2(n[1] * -s, -n[0] * s), kind: 'post', style: 'globe', hanging: true, street: 'hillrd', lane: true });
    C.posts.push({ x, z, r: 0.2, tag: 'lamp' });
    note(x, z, 0.5, 'lamp');
  }
  // the gardens' trees
  for (let k = 0; k < 14; k++) {
    const x = x0 + 4 + vhash(k, 1, 61) * (x1 - x0 - 8), z = z0 + 4 + vhash(k, 2, 62) * (z1 - z0 - 8);
    const near = pts.some((p) => Math.hypot(p[0] - x, p[1] - z) < hw + verge + 3.5) || houses.some(([hx, hz, ex, ez]) => Math.abs(x - hx) < ex + 3 && Math.abs(z - hz) < ez + 3);
    if (near) continue;
    trees.push({ x, z, kind: k % 3 ? 'elm' : 'bare', v: vhash(x, z, 77), s: 1.0 + vhash(x, z, 78) * 0.3, chunk: chunkOf(x, z), street: 'hillrd' });
    C.posts.push({ x, z, r: 0.3, tag: 'tree' });
  }
  return { id: 'hillrd', kind: 'lane', street: 'hillrd', name: 'HILL RD', pts, hw, verge, walls, x: cx, z: (z0 + z1) / 2, nx: 0, nz: -1, len: 0, h: 0, p: 0, chunk: chunkOf(cx, (z0 + z1) / 2) };
}

// the width of street face each unique wants
const UNIQUE_W = { church: 16, steeple: 16, firehouse: 10, canopy: 8, cinema: 10, baths: 10, ballroom: 12, columns: 14, mission: 8, paper: 10, seamen: 10, yardgate: 12, watertower: 12, billboard: 12, gasboard: 10 };

// ---- the quay's steps (the swim's way out: brief §2, O1 Left 6) -------------------------------------
// flights of stone steps down the quay's face into the water: on the south
// quay between the piers and the slipways, on the east quay, at every pier's
// end. A flight lies along the face, outside it (in the water), from the
// landing on the quay down past the water's surface. The quay's railing has
// a gap at each landing (cityGen.quay reads these).
export function quaySteps() {
  const out = [];
  const edgeS = RIVER.s + QUAY_OFF;           // the south quay's face (z)
  const edgeE = RIVER.e + QUAY_OFF;           // the east quay's face (x)
  const LEN = 6.0;
  const busy = (x) => PIERS.some((p) => Math.abs(x - p.x) < p.w / 2 + 8) || SLIPS.some((s) => Math.abs(x - s.x) < s.w / 2 + 8) || CRANES.some((c) => Math.abs(x - c.x) < 9);
  for (let x = -520; x < RIVER.bend.cx - 30; x += 50) {
    let xx = x;
    for (let k = 0; k < 6 && busy(xx); k++) xx += 11;
    if (busy(xx)) continue;
    // (down toward +x along the face, outside it: +z is the water)
    out.push({ x: xx, z: edgeS, dx: 1, dz: 0, nx: 0, nz: 1, len: LEN, kind: 'quay' });
  }
  for (let z = -530; z < RIVER.bend.cz - 20; z += 66) {
    if (Math.abs(z - BRIDGE.z) < 22) continue;
    out.push({ x: edgeE, z, dx: 0, dz: 1, nx: 1, nz: 0, len: LEN, kind: 'quay' });
  }
  // every pier's end: a flight down its east side, its landing at the open end
  for (const p of PIERS) out.push({ x: p.x + p.w / 2, z: edgeS + p.len - 0.25, dx: 0, dz: -1, nx: 1, nz: 0, len: LEN, kind: 'pier', pier: p.name });
  for (const s of out) {
    s.top = [s.x - s.nx * 1.1, s.z - s.nz * 1.1];              // on the quay (the pier), at the landing
    s.step = [s.x + s.nx * 0.75, s.z + s.nz * 0.75];           // the flight's top step, outside the face
    s.foot = [s.step[0] + s.dx * s.len, s.step[1] + s.dz * s.len];   // its foot, under the water
    s.lamp = [s.x - s.nx * 2.3 + s.dx * 0.9, s.z - s.nz * 2.3 + s.dz * 0.9];
  }
  return out;
}
export { vhash, vpick, PAVE };

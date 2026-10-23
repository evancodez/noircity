import * as THREE from 'three';
import { allocInkId, markFigure } from '../../../render/layers.js';
import { merge } from '../../../world/geom.js';
import { RNG } from '../../../util/rng.js';
import { LETTER_FONT } from '../../../ui/lettering.js';
import { lotWindows } from '../../../city/kits/facade.js';
import { PAVE, CLS, NS, EW } from '../../../world/plan.js';
import { accent } from '../../../render/accents.js';
import { vhash } from '../../../world/streets.js';

// The named places and the neon (lane O1): what tells a street from a
// street at night. The theatres' marquees (a lit board, the name in black,
// a row of bulbs under it) and their blades; the hotel's blade; the diner's,
// the bars' tubes; the police headquarters' and the station's globe lamps
// and their lettered board; the gym's, the gun shop's, the garage's, the
// store's, the bank's painted boards; and along Grand Ave, the Bowery and
// Centre St, blades over the shop fronts (BAR, HOTEL, CHOP SUEY, PAWN ...):
// the neon's one colour - the registry's blue (accents.js 'neon', the
// diner's) on the places a man goes into (the diner, the bars, the hotel)
// and on one shop blade in five; every other tube burns white (ink: no
// chroma). No green, no amber (the critic's M4: DESIGN.md, colour an accent,
// one or two a frame). Always drawn (they are few: the city's lights,
// seen down a street from far off); one atlas, one material, one mesh of
// faces, one of boards, one of bulbs.
//   api: { signs: [{ text, x, z, n, kind, place }], doors: [{ x, z, nx, nz, place }] (the places' doors: O5's) }
// [O1b] red: the registry's neonRed (accents.js) as the canvas draws it (its
// linear (1, .035, .05) in sRGB), one blade in ten by the street's character
const toCss = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(255 * Math.pow(Math.min(1, v), 1 / 2.2)).toString(16).padStart(2, '0')).join('');
const COL = {
  blue: { rim: '#4aa8ff', core: '#dff0ff' },
  white: { rim: '#cfcfcf', core: '#ffffff' },
  red: { rim: toCss(accent('neonRed', { gain: 1 / 3 })), core: '#ffe2e2' },
};
const PX = 96, ATLAS = 2048, ATLAS_H = 4096;   // ([O1b] twice as tall: the painted names and the windows' neon ran off the bottom of a square one)
const BLADES = ['BAR', 'HOTEL', 'CHOP SUEY', 'PAWN', 'DANCING', 'LIQUORS', 'BILLIARDS', 'LUNCH', 'ROOMS', 'DRUGS', 'CAFE', 'TAILOR', 'GRILL', 'SHOES', 'RADIO', 'JEWELRY'];
const BLADE_STREETS = new Set(['grand', 'bowery', 'centre', 'houston', 'broadway', 'mott', 'clock']);

export default {
  name: 'places', order: 45,
  build(stage) {
    const { scene, M } = stage;
    const C = stage.part('city').C;
    const group = new THREE.Group();
    group.name = 'places';
    scene.add(group);
    // ---- the atlas ---------------------------------------------------------------------------------
    const cv = document.createElement('canvas'); cv.width = ATLAS; cv.height = ATLAS_H;
    const g = cv.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, ATLAS, ATLAS_H);
    let ax = 4, ay = 4, row = 0;
    const alloc = (w, h) => { if (ax + w + 4 > ATLAS) { ax = 4; ay += row + 6; row = 0; } const c = { x: ax, y: ay, w, h }; ax += w + 6; row = Math.max(row, h); return c; };
    const uvOf = (c) => [c.x / ATLAS, 1 - (c.y + c.h) / ATLAS_H, (c.x + c.w) / ATLAS, 1 - c.y / ATLAS_H];
    // a neon face: the black board, the tube's glow, the tube, its white-hot line
    const neonFace = (text, col, wM, hM, vert) => {
      const c = alloc(Math.round(wM * PX), Math.round(hM * PX));
      const K = COL[col];
      g.save(); g.beginPath(); g.rect(c.x, c.y, c.w, c.h); g.clip(); g.translate(c.x, c.y);
      g.fillStyle = '#050505'; g.fillRect(0, 0, c.w, c.h);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      const letters = vert ? [...text] : [text];
      const fs = vert ? Math.min(c.w * 0.72, (c.h * 0.9) / letters.length) : Math.min(c.h * 0.62, (c.w * 0.9) / (text.length * 0.6));
      g.font = `700 ${fs}px ${LETTER_FONT}`;
      const pos = letters.map((ch, i) => [c.w / 2, vert ? c.h * 0.05 + (i + 0.5) * (c.h * 0.9 / letters.length) : c.h / 2, ch]);
      for (const [pass, lw, style, blur] of [[0, fs * 0.16, K.rim, fs * 0.35], [1, fs * 0.09, K.rim, 0], [2, fs * 0.03, K.core, 0]]) {
        void pass;
        g.lineWidth = lw; g.strokeStyle = style; g.shadowColor = K.rim; g.shadowBlur = blur; g.lineJoin = 'round';
        for (const [x, y, ch] of pos) g.strokeText(ch, x, y);
      }
      g.restore();
      return uvOf(c);
    };
    // a lettered board: pale lit (a marquee) with black letters, or dark with pale letters
    const boardFace = (text, wM, hM, lit) => {
      const c = alloc(Math.round(wM * PX), Math.round(hM * PX));
      g.save(); g.beginPath(); g.rect(c.x, c.y, c.w, c.h); g.clip(); g.translate(c.x, c.y);
      g.fillStyle = lit ? '#d8d4c8' : '#0c0c0c'; g.fillRect(0, 0, c.w, c.h);
      g.strokeStyle = lit ? '#151515' : '#9a968c'; g.lineWidth = Math.max(2, c.h * 0.05); g.strokeRect(c.h * 0.06, c.h * 0.06, c.w - c.h * 0.12, c.h - c.h * 0.12);
      g.fillStyle = lit ? '#0a0a0a' : '#b8b4aa'; g.textAlign = 'center'; g.textBaseline = 'middle';
      const fs = Math.min(c.h * 0.58, (c.w * 0.86) / (text.length * 0.58));
      g.font = `700 ${fs}px ${LETTER_FONT}`;
      g.fillText(text, c.w / 2, c.h / 2);
      g.restore();
      return uvOf(c);
    };
    const faceGeo = (w, h, nx, nz, x, y, z, uv) => {
      const p = new THREE.PlaneGeometry(w, h);
      const U = p.getAttribute('uv');
      for (let i = 0; i < U.count; i++) U.setXY(i, U.getX(i) ? uv[2] : uv[0], U.getY(i) ? uv[3] : uv[1]);
      p.rotateY(Math.atan2(nx, nz)).translate(x, y, z);
      return p;
    };
    const box = (cx, cy, cz, sx, sy, sz, yaw) => new THREE.BoxGeometry(sx, sy, sz).rotateY(yaw).translate(cx, cy, cz);
    const neonFaces = [], litFaces = [], darkFaces = [], boards = [], bulbs = [], amberBulbs = [];
    const signs = [], doors = [];
    // the street face of a rect lot nearest a point: { a, b, n, mid, len }
    const facesOf = (L) => {
      const F = [];
      const f = L.faces || {};
      if (f.n) F.push({ mid: [(L.x0 + L.x1) / 2, L.z0], n: [0, -1], len: L.x1 - L.x0 });
      if (f.s) F.push({ mid: [(L.x0 + L.x1) / 2, L.z1], n: [0, 1], len: L.x1 - L.x0 });
      if (f.w) F.push({ mid: [L.x0, (L.z0 + L.z1) / 2], n: [-1, 0], len: L.z1 - L.z0 });
      if (f.e) F.push({ mid: [L.x1, (L.z0 + L.z1) / 2], n: [1, 0], len: L.z1 - L.z0 });
      return F;
    };
    const nearestFace = (L, at) => { let best = null, bd = Infinity; for (const F of facesOf(L)) { const d = Math.hypot(F.mid[0] - at[0], F.mid[1] - at[1]); if (d < bd) { bd = d; best = F; } } return best; };
    // a blade sign hung out from the wall at (x, z) (n: out of the wall)
    const blade = (x, z, n, y, text, col, { big = false } = {}) => {
      const wM = big ? 1.2 : 0.85, lh = big ? 0.8 : 0.58, hM = text.replace(/ /g, '').length * lh + 0.4;
      const out = 0.35 + wM / 2, cx = x + n[0] * out, cz = z + n[1] * out;
      const yawN = Math.atan2(-n[1], n[0]);
      boards.push(box(cx, y, cz, wM, hM, 0.14, yawN));
      boards.push(box(x + n[0] * (0.35 + wM) / 2, y + hM / 2 + 0.08, z + n[1] * (0.35 + wM) / 2, 0.35 + wM, 0.05, 0.05, yawN));
      const uv = neonFace(text.replace(/ /g, ''), col, wM - 0.06, hM - 0.06, true);
      const tx = -n[1], tz = n[0];
      for (const sd of [1, -1]) neonFaces.push(faceGeo(wM - 0.06, hM - 0.06, tx * sd, tz * sd, cx + tx * sd * 0.075, y, cz + tz * sd * 0.075, uv));
      signs.push({ text, x, z, n, kind: 'blade', col });
    };
    // a flat sign on the wall
    const flat = (x, z, n, y, text, w, h, kind, col = 'blue', res = 1) => {   // ([O1b] res: the atlas's pixels a metre, a share of PX - the painted names are big and seen far)
      const yawN = Math.atan2(-n[1], n[0]) + Math.PI / 2;
      boards.push(box(x + n[0] * 0.05, y, z + n[1] * 0.05, w + 0.12, h + 0.12, 0.1, yawN));
      const uv = kind === 'neon' ? neonFace(text, col, w * res, h * res, false) : boardFace(text, w * res, h * res, kind === 'lit');
      (kind === 'neon' ? neonFaces : kind === 'lit' ? litFaces : darkFaces).push(faceGeo(w, h, n[0], n[1], x + n[0] * 0.11, y, z + n[1] * 0.11, uv));
      signs.push({ text, x, z, n, kind });
    };
    // ---- the named places ------------------------------------------------------------------------------
    for (const L of C.lots) {
      const P = L.place;
      if (!P || L.kind !== 'rect') continue;
      const F = nearestFace(L, P.at);
      if (!F) continue;
      const [mx, mz] = F.mid, n = F.n, tx = -n[1], tz = n[0];
      // its door: the door of its layout nearest the face's middle
      let door = null, dd = Infinity;
      for (const w of lotWindows(L)) { if (w.kind !== 'door' || w.nx !== n[0] || w.nz !== n[1]) continue; const d = Math.hypot(w.x - mx, w.z - mz); if (d < dd) { dd = d; door = w; } }
      const dx = door ? door.x : mx, dz = door ? door.z : mz;
      doors.push({ x: dx, z: dz, nx: n[0], nz: n[1], place: P.id, lot: L });
      if (P.kind === 'theatre') {
        // the marquee over the pavement: a lit board each side and front, the name in black, bulbs under it
        const w = Math.min(14, F.len * 0.75), d = 3.4, y = 5.0, h = 1.5;
        const cx = mx + n[0] * d / 2, cz = mz + n[1] * d / 2;
        const yawF = Math.atan2(-n[1], n[0]) + Math.PI / 2;
        boards.push(box(cx, y + h / 2 + 0.1, cz, w + 0.2, 0.2, d + 0.2, yawF));
        boards.push(box(cx, y - h / 2 - 0.08, cz, w + 0.2, 0.16, d + 0.2, yawF));
        const uvF = boardFace(P.name.replace('THE ', ''), w, h, true);
        litFaces.push(faceGeo(w, h, n[0], n[1], mx + n[0] * (d + 0.01), y, mz + n[1] * (d + 0.01), uvF));
        const uvS = boardFace('TONIGHT', d, h, true);
        for (const sd of [1, -1]) litFaces.push(faceGeo(d, h, tx * sd, tz * sd, cx + tx * sd * (w / 2 + 0.01), y, cz + tz * sd * (w / 2 + 0.01), uvS));
        // ([O1b] the marquee's bulbs a warm amber: the registry's neonAmber)
        for (let u = -w / 2 + 0.4; u <= w / 2 - 0.3; u += 0.7) for (const k of [0.4, 0.8]) amberBulbs.push(new THREE.SphereGeometry(0.07, 6, 4).translate(mx + tx * u + n[0] * d * k, y - h / 2 - 0.22, mz + tz * u + n[1] * d * k));
        blade(mx + tx * (w / 2 - 1), mz + tz * (w / 2 - 1), n, Math.min(L.h - 3, 12), P.name.replace('THE ', ''), 'white', { big: true });
      } else if (P.kind === 'hotel') {
        blade(dx + tx * 3, dz + tz * 3, n, Math.min(L.h - 3, 10.5), 'HOTEL', 'blue', { big: true });
        flat(dx, dz, n, 4.0, P.name, Math.min(8, F.len * 0.6), 0.7, 'dark');
        boards.push(box(dx + n[0] * 1.6, 3.4, dz + n[1] * 1.6, 3.2, 0.15, 3.2, Math.atan2(-n[1], n[0]) + Math.PI / 2));
      } else if (P.kind === 'diner') {
        flat(dx + tx * 2.5, dz + tz * 2.5, n, 3.9, 'DINER', 3.2, 0.9, 'neon', 'blue');
      } else if (P.kind === 'bar') {
        flat(dx + tx * 1.8, dz + tz * 1.8, n, 3.6, 'BAR', 1.8, 0.8, 'neon', 'blue');
      } else if (P.kind === 'police' || P.kind === 'station') {
        flat(dx, dz, n, 4.3, 'POLICE', 4.2, 0.8, 'lit');
        // the two globe lamps by the door, on short iron posts
        for (const s of [-1, 1]) {
          const gx = dx + tx * s * 1.6 + n[0] * 0.6, gz = dz + tz * s * 1.6 + n[1] * 0.6;
          bulbs.push(new THREE.SphereGeometry(0.28, 14, 10).translate(gx, PAVE + 2.6, gz));
          boards.push(new THREE.CylinderGeometry(0.05, 0.08, 2.3, 8).translate(gx, PAVE + 1.15, gz));
        }
      } else {
        const label = { bank: 'BANK', store: P.name, gym: 'BOXING', shop: 'GUNS', garage: 'GARAGE' }[P.kind] || P.name;
        flat(dx, dz, n, P.kind === 'garage' ? 5.4 : 4.2, label, Math.min(label.length * 0.62 + 0.8, F.len * 0.8), 0.8, P.kind === 'gym' || P.kind === 'shop' ? 'lit' : 'dark');
      }
    }
    // ---- the blades along the busy streets (over a shop front, one a lot at most) --------------------------
    const rng = new RNG(0xB1ADE);
    const onStreet = (L) => {
      for (const F of facesOf(L)) {
        const px = F.mid[0] + F.n[0] * 6, pz = F.mid[1] + F.n[1] * 6;
        const S = stage.part('city').graph.streetAt(px, pz);
        if (S && S.d < S.edge.hw + 1 && BLADE_STREETS.has(S.edge.street)) return F;
      }
      return null;
    };
    let nB = 0;
    for (const L of C.lots) {
      if (L.kind !== 'rect' || L.place || L.back || L.house || (L.district !== 'downtown' && L.district !== 'tenements')) continue;
      if (!rng.chance(0.13)) continue;
      const F = onStreet(L);
      if (!F) continue;
      const shop = lotWindows(L).find((w) => w.kind === 'shop' && w.nx === F.n[0] && w.nz === F.n[1]);
      if (!shop) continue;
      // (the draws as they were, so the blades stand where they stood: one in five blue)
      let col = rng.chance(0.6) ? 'white' : rng.chance(0.5) ? 'blue' : 'white';
      // ([O1b] one in ten red, by the street: the Bowery's pawnshops more, the hill's none)
      if (L.ch && vhash(L.cx, L.cz, 61) < (L.ch.red || 0)) col = 'red';
      const text = BLADES[Math.floor(rng.next() * BLADES.length)];
      blade(shop.x + (-F.n[1]) * shop.w * 0.5, shop.z + F.n[0] * shop.w * 0.5, F.n, 4.6 + text.replace(/ /g, '').length * 0.29, text, col);
      if (++nB >= 40) break;
    }
    // ---- [O1b] neon in the lit shop windows (the brief §4: a touch of colour,
    // the vast majority still ink): one lit shop in four of the trades that
    // burn one - a cafe's EATS, a pawnshop's LOANS, a chop suey's - red, the
    // registry's blue or white; red by the street (one in ten and more on the
    // Bowery, Doyers, Broadway). A tube on its black backing, up in the glass
    const WN = { cafe: ['EATS', 'CAFE', 'OPEN'], deli: ['DELI', 'OPEN'], chopsuey: ['CHOP SUEY', 'TEA'], pawn: ['LOANS', 'PAWN'], radio: ['RADIO'], drugs: ['DRUGS', 'SODA'], cigars: ['CIGARS'], tobacco: ['SMOKES'], barber: ['BARBER'], shoes: ['OPEN'], grocer: ['OPEN'], laundry: ['LAUNDRY'], hats: ['HATS'], jeweler: ['WATCHES'] };
    let nW = 0;
    for (const L of C.lots) {
      if (!L.fc || L.place || nW >= 260) continue;
      for (const w of lotWindows(L)) {
        if (w.kind !== 'shop' || !w.lit || !w.trade || !WN[w.trade] || vhash(w.x, w.z, 71) > 0.3) continue;
        const words = WN[w.trade], text = words[Math.floor(vhash(w.x, w.z, 72) * words.length) % words.length];
        const red = Math.max(0.3, ((L.ch && L.ch.red) || 0) * 2.5);
        const col = vhash(w.x, w.z, 73) < red ? 'red' : vhash(w.x, w.z, 74) < 0.6 ? 'blue' : 'white';
        const wM = Math.min(w.w * 0.62, text.replace(/ /g, '').length * 0.24 + 0.35), hM = 0.4;
        neonFaces.push(faceGeo(wM, hM, w.nx, w.nz, w.x + w.nx * 0.16, w.y + w.h * 0.2, w.z + w.nz * 0.16, neonFace(text, col, wM, hM, false)));
        signs.push({ text, x: w.x, z: w.z, n: [w.nx, w.nz], kind: 'window', col });
        if (++nW >= 260) break;
      }
    }
    // ---- the warehouses' and the sheds' painted names, high on their street faces (the Docks, the Yards) ------------
    const PAINT = {
      docks: ['HARBOR FREIGHT', 'COLD STORAGE', 'PIER 5 TERMINAL', 'BONDED WAREHOUSE', 'COFFEE & SUGAR', 'LUMBER', 'SHIP CHANDLER', 'FISH', 'HEMP & ROPE', 'IMPORTS', 'GENERAL CARGO', 'TEA'],
      yards: ['MOTOR FREIGHT', 'FOUNDRY', 'COAL & COKE', 'SCRAP IRON', 'STEEL', 'MACHINE WORKS', 'CARTAGE', 'FEED & GRAIN'],
    };
    const prng = new RNG(0x9A1A7);
    let nP = 0;
    for (const L of C.lots) {
      if (L.kind !== 'rect' || L.place || L.back || !PAINT[L.district] || L.h < 7) continue;
      if (!prng.chance(0.22)) continue;
      const Fs = facesOf(L).filter((F) => F.len > 14);
      if (!Fs.length) continue;
      const F = Fs[Math.floor(prng.next() * Fs.length)];
      const list = PAINT[L.district], text = list[Math.floor(prng.next() * list.length)];
      const w = Math.min(F.len * 0.7, text.length * 0.9 + 2), h = Math.min(2.2, Math.max(1.4, w / text.length * 1.4));
      flat(F.mid[0], F.mid[1], F.n, L.h - h / 2 - 1.0, text, w, h, 'dark', 'blue', 0.4);
      if (++nP >= 30) break;
    }
    // ---- the meshes ----------------------------------------------------------------------------------------------
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const id = allocInkId(3);
    const mk = (geos, mat, k, figure = false) => {
      if (!geos.length) return null;
      const m = new THREE.Mesh(geos[0].attributes.uv ? mergeUV(geos) : merge(geos), mat);
      m.userData.inkId = id + k; m.userData.noRay = true;
      if (figure) markFigure(m);
      group.add(m);
      return m;
    };
    const neonMat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color().setScalar(3.2), fog: false });
    const litMat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color().setScalar(1.25) });
    const darkMat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color().setScalar(0.8) });
    mk(neonFaces, neonMat, 0);
    mk(litFaces, litMat, 1);
    mk(darkFaces, darkMat, 1);
    const bm = mk(boards, M.iron, 2);
    if (bm) bm.userData.noRay = false;
    mk(bulbs, M.bulb, 2);
    mk(amberBulbs, new THREE.MeshBasicMaterial({ color: accent('neonAmber', { gain: 0.7 }) }), 2);   // [O1b]
    void CLS; void NS; void EW;
    return { group, signs, doors, atlasUsed: ay + row };   // ([O1b] the atlas's height used: under ATLAS_H)
  },
};

// planes with uvs merged (position, normal, uv; non-indexed)
export function mergeUV(list) {
  const L = list.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0; for (const g of L) n += g.getAttribute('position').count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const g of L) { pos.set(g.getAttribute('position').array, o * 3); nor.set(g.getAttribute('normal').array, o * 3); uv.set(g.getAttribute('uv').array, o * 2); o += g.getAttribute('position').count; }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}

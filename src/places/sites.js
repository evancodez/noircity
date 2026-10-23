import { lotWindows } from '../city/kits/facade.js';
import { Frame } from '../city/kits/interior/frame.js';

// Where the places are (lane O5): each one a lot of the city (lane O1's
// plan: its named places, the market hall's lot, and lots of the Docks and
// the Tenements chosen here by rule), its street door (a door of the lot's
// seeded layout, or, where the layout has none on that face - the diner, the
// theatre - the shop front nearest the face's middle, made the entrance), and
// the frame the room is authored in (frame.js). Deterministic: the same
// city gives the same places.
//   sites(C) -> [{ id, name, kind, lot, door: { x, z, nx, nz, w, shop }, doors: [...]
//                  (more ways in: the hall's far side, a hideout's back), frame,
//                  lb: the lot in the frame { x0, x1, z0, z1 }, room (its sound) }]
// The rooms themselves are src/places/rooms/<kind>.js.
const PLACE_IDS = ['gym', 'diner', 'bar1', 'bar2', 'gunshop', 'garage', 'hotel', 'police', 'theatre1'];
const KIND = { gym: 'gym', diner: 'diner', bar1: 'bar', bar2: 'bar', gunshop: 'gunshop', garage: 'garage', hotel: 'hotel', police: 'police', theatre1: 'theatre' };
const NAME = { gym: 'the gym', diner: 'the diner', bar1: 'the Tenements bar', bar2: 'the Docks bar', gunshop: 'the gun shop', garage: 'the garage', hotel: 'the hotel', police: 'police headquarters', theatre1: 'the Orpheum' };
const ROOM = { hospital: 'office', gym: 'o5_gym', diner: 'diner', bar: 'o5_bar', gunshop: 'office', garage: 'o5_big', hotel: 'office', police: 'office', theatre: 'office', hall: 'o5_hall', hideout: 'o5_big', stair: 'corridor' };

// the street faces of a rect lot: { n: [nx, nz], mid: [x, z], len }
function facesOf(L) {
  const F = [], f = L.faces || {};
  if (f.n) F.push({ k: 'n', mid: [(L.x0 + L.x1) / 2, L.z0], n: [0, -1], len: L.x1 - L.x0 });
  if (f.s) F.push({ k: 's', mid: [(L.x0 + L.x1) / 2, L.z1], n: [0, 1], len: L.x1 - L.x0 });
  if (f.w) F.push({ k: 'w', mid: [L.x0, (L.z0 + L.z1) / 2], n: [-1, 0], len: L.z1 - L.z0 });
  if (f.e) F.push({ k: 'e', mid: [L.x1, (L.z0 + L.z1) / 2], n: [1, 0], len: L.z1 - L.z0 });
  return F;
}
// the lot's door on a face nearest a point (or its shop front made the door)
function doorOn(L, F, at = F.mid) {
  const W = lotWindows(L).filter((w) => w.nx === F.n[0] && w.nz === F.n[1]);
  const best = (kind) => { let b = null, bd = Infinity; for (const w of W) if (w.kind === kind) { const d = Math.hypot(w.x - at[0], w.z - at[1]); if (d < bd) { bd = d; b = w; } } return b; };
  const d = best('door');
  if (d) return { x: d.x, z: d.z, nx: F.n[0], nz: F.n[1], w: 1.05, shop: null };
  const s = best('shop');
  if (s) return { x: s.x, z: s.z, nx: F.n[0], nz: F.n[1], w: Math.min(2.0, s.w - 0.4), shop: s };
  return { x: F.mid[0], z: F.mid[1], nx: F.n[0], nz: F.n[1], w: 1.05, shop: null };
}
const nearestLot = (C, x, z, f) => { let b = null, bd = Infinity; for (const L of C.lots) { if (L.kind !== 'rect' || L.place || L.hall || L.back || !f(L)) continue; const d = Math.hypot(L.cx - x, L.cz - z); if (d < bd) { bd = d; b = L; } } return b; };
const hasDoorOn = (L, k) => facesOf(L).some((F) => F.k === k && lotWindows(L).some((w) => w.kind === 'door' && w.nx === F.n[0] && w.nz === F.n[1]));

let CACHE = null, CACHE_C = null;
export function sites(C) {
  if (CACHE && CACHE_C === C) return CACHE;
  const out = [];
  const mk = (id, kind, lot, door, extra = {}) => {
    const frame = new Frame(door);
    // the lot in the frame (its corners: every lot here is a rect)
    const lb = frame.lbox({ x0: lot.x0, x1: lot.x1, z0: lot.z0, z1: lot.z1 });
    out.push({ id, kind, name: extra.name || id, lot, door, doors: [], frame, lb, room: ROOM[kind] || 'office', ...extra });
  };
  // ---- O1's named places
  for (const id of PLACE_IDS) {
    const L = C.lots.find((l) => l.place && l.place.id === id);
    if (!L) continue;
    // (the face the places part dressed: nearest the place's mark)
    let F = null, fd = Infinity;
    for (const f of facesOf(L)) { const d = Math.hypot(f.mid[0] - L.place.at[0], f.mid[1] - L.place.at[1]); if (d < fd) { fd = d; F = f; } }
    if (!F) continue;
    mk(id, KIND[id], L, doorOn(L, F), { name: NAME[id] });
  }
  // ---- the market hall: in from Hester St (west), out the far side (east)
  const H = C.specials && C.specials.hall;
  if (H) {
    const Fs = facesOf(H);
    const w = Fs.find((f) => f.k === 'w'), e = Fs.find((f) => f.k === 'e');
    if (w && e) { mk('hall', 'hall', H, doorOn(H, w), { name: 'the market hall' }); out.at(-1).doors.push(doorOn(H, e)); }
  }
  // ---- the hideouts on the Docks: the pier office (on the quay by Pier 7), a warehouse
  const dock = (x, z, f) => nearestLot(C, x, z, (L) => L.district === 'docks' && f(L));
  const po = dock(90, 410, (L) => hasDoorOn(L, 's'));
  if (po) {
    const F = facesOf(po).find((f) => f.k === 's');
    mk('pieroffice', 'hideout', po, doorOn(po, F, [F.mid[0] - 6, F.mid[1]]), { name: 'the pier office', gang: 'docks', upstairs: true });
    const back = facesOf(po).find((f) => f.k === 'w' || f.k === 'e');
    if (back && hasDoorOn(po, back.k)) out.at(-1).doors.push({ ...doorOn(po, back), back: true });
  }
  const wh = dock(-185, 358, (L) => (L.x1 - L.x0) * (L.z1 - L.z0) > 600 && hasDoorOn(L, 'n'));
  if (wh) {
    const F = facesOf(wh).find((f) => f.k === 'n');
    mk('warehouse', 'hideout', wh, doorOn(wh, F), { name: 'a warehouse', gang: 'docks' });
    const back = facesOf(wh).find((f) => f.k === 'w' || f.k === 'e');
    if (back && hasDoorOn(wh, back.k)) out.at(-1).doors.push({ ...doorOn(wh, back), back: true });
  }
  // ---- [O5b] the hospital (Downtown, on Mercer St behind the Orpheum's block: a door of its own -
  // the globe, EMERGENCY, the ambulance at the kerb - loaded from further off so the globe is seen
  // down the street)
  const hl = nearestLot(C, -190, 13, (L) => L.district === 'downtown' && hasDoorOn(L, 'w') && L.x1 - L.x0 > 20 && L.z1 - L.z0 > 16);
  if (hl) {
    const F = facesOf(hl).find((f) => f.k === 'w');
    mk('hospital', 'hospital', hl, doorOn(hl, F), { name: 'the hospital', loadR: 80, dropR: 110 });
  }
  // ---- three tenement stairwells (a street door, four floors and more, the roof)
  const used = new Set(out.map((s) => s.lot));
  const marks = [[230, -72], [300, 108], [179, 42]];
  marks.forEach(([x, z], i) => {
    const L = nearestLot(C, x, z, (L) => L.district === 'tenements' && L.h >= 13.5 && !used.has(L) && facesOf(L).some((F) => hasDoorOn(L, F.k)) && Math.min(L.x1 - L.x0, L.z1 - L.z0) > 7.5);
    if (!L) return;
    used.add(L);
    const F = facesOf(L).find((f) => hasDoorOn(L, f.k));
    mk('stairs' + (i + 1), 'stair', L, doorOn(L, F), { name: 'a tenement', variant: i });
  });
  CACHE = out; CACHE_C = C;
  return out;
}

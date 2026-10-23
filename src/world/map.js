import { DISTRICTS, NS, EW, BROADWAY, CLOCK, GASWORKS, PARK, PIERS, BRIDGE, RIVER, SPECIAL, EL, CITY, STADIUM, WHEEL } from './plan.js';
import { RIVER_SEGS, EL_LINE } from './cityGen.js';
import { LETTER_FONT } from '../ui/lettering.js';

// NOIR CITY's map (lane O1): the city inked from the plan, north up, on
// paper - the water black, the blocks dark, the streets the paper, the el's
// loop a dashed line, the landmarks as small marks, the districts' names in
// the game's lettering. Drawn once into a canvas; the player's mark (and,
// later, the heat: O3 / O7) is drawn over it each frame by the overlay.
//   drawMap(C, size = 1024) -> { canvas, toMap(x, z) -> [u, v] (canvas pixels) }
//   MapOverlay: new MapOverlay(C); overlay.open / close / toggle; overlay.draw(marks)
//   marks: [{ x, z, yaw, kind: 'me' | 'car' | 'heat' }]
// (the blocks near black: an ink drawing, not a grey plan - the critic's M7)
const PAPER = '#d4cfc4', INK = '#141414', BLOCK = '#1e1d1b', WATERC = '#0b0b0b', STREET = '#d8d3c9';
// a district's name off the streets' names (DOWNTOWN sat on CENTRE ST): where it is printed
const NAME_AT = { downtown: [-205, 105] };

export function drawMap(C, size = 1024) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const g = c.getContext('2d');
  const pad = 40;
  const span = CITY.x1 - CITY.x0;
  const k = (size - pad * 2) / span;
  const toMap = (x, z) => [pad + (x - CITY.x0) * k, pad + (z - CITY.z0) * k];
  // the paper, a little uneven
  g.fillStyle = PAPER; g.fillRect(0, 0, size, size);
  for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.04})`; g.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 3, 1); }
  // the water: everything past the quay
  g.fillStyle = WATERC;
  g.beginPath();
  const Q = RIVER_SEGS.map((s) => [s.ax - s.nx * (RIVER.hw + 14), s.az - s.nz * (RIVER.hw + 14)]);
  const last = RIVER_SEGS[RIVER_SEGS.length - 1];
  Q.push([last.bx - last.nx * (RIVER.hw + 14), last.bz - last.nz * (RIVER.hw + 14)]);
  g.moveTo(...toMap(Q[0][0], CITY.z0 - 50));
  for (const p of Q) g.lineTo(...toMap(p[0], p[1]));
  g.lineTo(...toMap(CITY.x0 - 50, Q[Q.length - 1][1]));
  g.lineTo(...toMap(CITY.x0 - 50, CITY.z1 + 50)); g.lineTo(...toMap(CITY.x1 + 50, CITY.z1 + 50)); g.lineTo(...toMap(CITY.x1 + 50, CITY.z0 - 50));
  g.closePath(); g.fill();
  // the piers, the bridge
  g.fillStyle = STREET;
  for (const p of PIERS) { const [u, v] = toMap(p.x - p.w / 2, RIVER.s + 20); g.fillRect(u, v, p.w * k, p.len * k); }
  // (its two spans; the gap between them, the bascule up)
  for (const [a, b] of [[RIVER.e + 18, BRIDGE.hinge[0]], [BRIDGE.hinge[1], BRIDGE.x1]]) { const [u, v] = toMap(a, BRIDGE.z - BRIDGE.hw - 2); g.fillRect(u, v, (b - a) * k, (BRIDGE.hw * 2 + 4) * k); }
  // the land beyond the edges (the rail embankment, the Hill's woods): darker
  // ([O7] after the critic, m5: the paper's margin and a half-tone band read as a grey panel offset from the
  // map on the pause card - the land beyond the edges is one dark ground to the sheet's edge now)
  g.fillStyle = '#262422';
  { const [u1] = toMap(-590, 0); g.fillRect(0, 0, u1, size); }
  { const [, v1] = toMap(0, -590); g.fillRect(0, 0, size, v1); }
  // the blocks: every pavement slab, ink; the specials' grounds lighter
  for (const p of C.paves) {
    const sp = p.cell.special;
    g.fillStyle = sp === 'park' ? '#3e3c38' : sp ? '#33312e' : BLOCK;
    g.beginPath();
    p.pts.forEach(([x, z], i) => { const [u, v] = toMap(x, z); if (i) g.lineTo(u, v); else g.moveTo(u, v); });
    g.closePath(); g.fill();
  }
  // the rail yard's tracks
  g.strokeStyle = 'rgba(20,20,20,0.6)'; g.lineWidth = 1;
  const RY = SPECIAL.find((s) => s.id === 'railyard');
  for (let x = RY.rect[0] + 8; x < RY.rect[1] - 6; x += 7) { g.beginPath(); g.moveTo(...toMap(x, RY.rect[2])); g.lineTo(...toMap(x, RY.rect[3])); g.stroke(); }
  // the el's loop: a dashed heavy line over the streets
  g.strokeStyle = INK; g.lineWidth = Math.max(2, 4 * k); g.setLineDash([6, 4]);
  g.beginPath(); EL_LINE.forEach(([x, z], i) => { const [u, v] = toMap(x, z); if (i) g.lineTo(u, v); else g.moveTo(u, v); }); g.closePath(); g.stroke();
  g.setLineDash([]);
  // the landmarks: the clock tower, the gas holders, the stacks, the bandstand, the stations
  const dot = (x, z, r, fill = INK) => { const [u, v] = toMap(x, z); g.fillStyle = fill; g.beginPath(); g.arc(u, v, r, 0, Math.PI * 2); g.fill(); };
  dot(CLOCK.x, CLOCK.z, 7); dot(CLOCK.x, CLOCK.z, 3.5, PAPER);
  for (const h of GASWORKS.holders) { const [u, v] = toMap(h.x, h.z); g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.arc(u, v, h.r * k, 0, Math.PI * 2); g.stroke(); }
  for (const s of GASWORKS.stacks) dot(s.x, s.z, 4);
  dot(PARK.bandstand.x, PARK.bandstand.z, 5);
  for (const S of EL.stations) dot(S.side === 'e' ? EL.x1 : EL.x0, S.at, 5);
  // the names: the districts large, a few streets small
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const d of DISTRICTS) {
    const [x0, x1, z0, z1] = d.rect;
    const cx = Math.max(-560, Math.min(420, (Math.max(x0, -590) + Math.min(x1, 440)) / 2)), cz = Math.max(-560, Math.min(420, (Math.max(z0, -590) + Math.min(z1, 440)) / 2));
    const [u, v] = toMap(...(NAME_AT[d.id] || [cx, cz]));
    g.font = `700 ${Math.round(size * 0.026)}px ${LETTER_FONT}`;
    g.lineWidth = 6; g.strokeStyle = PAPER; g.strokeText(d.name, u, v); g.fillStyle = INK; g.fillText(d.name, u, v);
  }
  g.font = `600 ${Math.round(size * 0.012)}px ${LETTER_FONT}`;
  const label = (t, x, z, rot = 0) => { const [u, v] = toMap(x, z); g.save(); g.translate(u, v); g.rotate(rot); g.lineWidth = 3; g.strokeStyle = STREET; g.strokeText(t, 0, 0); g.fillStyle = INK; g.fillText(t, 0, 0); g.restore(); };
  for (const L of NS) if (['grand', 'bowery', 'straight', 'baxter', 'gasworks'].includes(L.id)) label(L.name, L.x, (L.segs[0][0] + L.segs[0][1]) / 2 + 40, -Math.PI / 2);
  for (const L of EW) if (['centre', 'houston', 'parkrow', 'dock', 'bridge', 'clock'].includes(L.id)) label(L.name, (L.segs[0][0] + L.segs[0][1]) / 2 - 60, L.z);
  label(BROADWAY.name, -75, 15, -Math.PI / 4);
  label(RIVER.name, RIVER.e, -200, -Math.PI / 2);
  label('THE RIVER', 520, -150, -Math.PI / 2);
  label('THE BRIDGE', 520, BRIDGE.z - 16);
  label('STADIUM', Math.min(STADIUM.x, 585), STADIUM.z + 50, -Math.PI / 2);
  label('FAIRGROUND', Math.min(WHEEL.x, 560), 585);
  label('CLOCK SQUARE', CLOCK.x, CLOCK.z + 18);
  for (const s of SPECIAL) if (s.id !== 'fishmarket' || true) label(s.name, (s.rect[0] + s.rect[1]) / 2, (s.rect[2] + s.rect[3]) / 2);
  // the frame and the compass
  g.strokeStyle = INK; g.lineWidth = 3; g.strokeRect(pad * 0.5, pad * 0.5, size - pad, size - pad);
  const [nu, nv] = [size - pad * 1.6, pad * 1.8];
  g.fillStyle = INK; g.beginPath(); g.moveTo(nu, nv - 18); g.lineTo(nu + 8, nv + 6); g.lineTo(nu, nv + 1); g.lineTo(nu - 8, nv + 6); g.closePath(); g.fill();
  g.font = `700 ${Math.round(size * 0.016)}px ${LETTER_FONT}`; g.fillText('N', nu, nv - 30);
  return { canvas: c, toMap, k };
}

// the overlay the M key opens (the pause card's map, O7, may take the canvas)
export class MapOverlay {
  constructor(C) {
    this.C = C;
    this.isOpen = false;
    this.el = null;
  }
  ensure() {
    if (this.el) return;
    const M = drawMap(this.C, 1024);
    this.map = M;
    const el = document.createElement('div');
    el.id = 'citymap';
    el.style.cssText = 'position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,0.78);z-index:12;pointer-events:none';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;width:min(86vh,86vw);height:min(86vh,86vw);box-shadow:0 0 40px #000';
    M.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
    const marks = document.createElement('canvas');
    marks.width = 1024; marks.height = 1024;
    marks.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
    wrap.append(M.canvas, marks);
    el.appendChild(wrap);
    document.body.appendChild(el);
    this.el = el; this.marks = marks;
  }
  open() { this.ensure(); this.el.style.display = 'flex'; this.isOpen = true; }
  close() { if (this.el) this.el.style.display = 'none'; this.isOpen = false; }
  toggle() { if (this.isOpen) this.close(); else this.open(); return this.isOpen; }
  // marks: [{ x, z, yaw, kind }]
  draw(marks) {
    if (!this.isOpen) return;
    const g = this.marks.getContext('2d');
    g.clearRect(0, 0, 1024, 1024);
    // (me drawn last, over the rest; the car's word only when it is off my ring)
    const me = marks.find((m) => m.kind === 'me');
    const meUV = me ? this.map.toMap(me.x, me.z) : null;
    for (const m of [...marks.filter((q) => q !== me), ...(me ? [me] : [])]) {
      const [u, v] = this.map.toMap(m.x, m.z);
      g.save();
      g.translate(u, v);
      if (m.kind === 'me') {
        // me: a ring that breathes round a big ink arrowhead the way I face
        // (a viewer's yaw: looking along (-sin, -cos)), paper round both, so
        // it reads on a street and on a block (the critic's M7: a 15 px pale
        // arrow on a pale street lost to the car's square)
        const t = (typeof performance !== 'undefined' ? performance.now() : 0) / 1000;
        const pr = 34 + 8 * (0.5 + 0.5 * Math.sin(t * 4));
        g.lineWidth = 7; g.strokeStyle = 'rgba(212,207,196,0.9)'; g.beginPath(); g.arc(0, 0, pr, 0, Math.PI * 2); g.stroke();
        g.lineWidth = 3.5; g.strokeStyle = '#000'; g.beginPath(); g.arc(0, 0, pr, 0, Math.PI * 2); g.stroke();
        g.rotate(-m.yaw);
        g.fillStyle = '#000'; g.strokeStyle = '#f4f1ea'; g.lineWidth = 5; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(0, -30); g.lineTo(18, 20); g.lineTo(0, 10); g.lineTo(-18, 20); g.closePath(); g.stroke(); g.fill();
      } else if (m.kind === 'car') {
        // the car: a small outlined body and the word, so it is never taken for me
        g.rotate(-(m.yaw ?? 0));
        g.fillStyle = '#d4cfc4'; g.strokeStyle = '#000'; g.lineWidth = 2.5;
        g.beginPath(); g.rect(-5, -9, 10, 18); g.fill(); g.stroke();
        g.rotate(m.yaw ?? 0);
        if (meUV && Math.hypot(u - meUV[0], v - meUV[1]) < 70) { g.restore(); continue; }
        g.font = `700 15px ${LETTER_FONT}`; g.textAlign = 'left'; g.textBaseline = 'middle';
        g.lineWidth = 4; g.strokeStyle = '#d4cfc4'; g.strokeText('CAR', 12, 0); g.fillStyle = '#000'; g.fillText('CAR', 12, 0);
      }
      g.restore();
    }
  }
  dispose() { if (this.el && this.el.parentNode) this.el.parentNode.removeChild(this.el); this.el = null; this.isOpen = false; }
}

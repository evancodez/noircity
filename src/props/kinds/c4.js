import * as THREE from 'three';
import { slab } from '../lib.js';
import { SPECS as BUILT_IN } from '../kinds.js';

// [C4] Two pieces of paper of chapters I and II (docs/story/briefs/C4_FIGHT.md
// §5, §6), each a canvas drawn by a function of what is written on it:
//   amesCard    J. AMES - PRIVATE INVESTIGATIONS - HARBOR BLDG. RM 304, a
//               business card, crossed through in the crew's red with a
//               grease pencil (found folded in the Cardinal's matchbook on
//               the man in the street, end of II). 8.9 x 5.1 cm, its face up.
//   guestCheck  the diner's own pad: a printed slip, DINER at its head, GUEST
//               CHECK, numbered, ruled, written in Dot's pencil. 8.5 x 14 cm,
//               its face up, its head toward -z. ud.write(lines, opts)
//               writes it again: lines are what her hand writes, top to
//               bottom ('1  Scotch neat|.35' puts a price in the right
//               column); opts { total, sign, big, torn } - big: a few large
//               words across the ruled lines (chapter III's
//               ['PIER 9', 'MIDNIGHT', '— DOT'], lane C5).
//   drawGuestCheck(g, W, H, lines, opts) / drawAmesCard(g, W, H): the same
//   drawings on any 2D context (a still, a torn piece, a puzzle).
// Her hand is the same everywhere: HAND (a pencil, pressed in two passes).
export const HAND = '"Bradley Hand", "Segoe Script", "Snell Roundhand", "Comic Sans MS", cursive';
const PRINT = '"American Typewriter", "Courier New", monospace';
const SERIF = 'Didot, "Bodoni 72", Georgia, "Times New Roman", serif';
// the crew's red as paint (the ink keeps a saturated pixel: render/accents.js)
const CREW_RED = '#c40f2c';
const PAPER = '#ece6d6', CARD = '#f1ece1', PENCIL = 'rgba(38,38,42,0.92)';

// a small seeded noise for the paper's grain and the pencil's skip
function rnd(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }
function grain(g, W, H, seed, k = 0.05) {
  const r = rnd(seed);
  for (let i = 0; i < W * H / 220; i++) {
    const v = r() < 0.5 ? 0 : 255;
    g.fillStyle = `rgba(${v},${v},${v},${(k * r()).toFixed(3)})`;
    g.fillRect(r() * W, r() * H, 1 + r() * 2, 1 + r() * 2);
  }
}
// her pencil: the line written twice, a hair apart, the second lighter (the
// graphite's grain), slightly rising to the right
function pencil(g, text, x, y, px, { align = 'left', seed = 3, rise = -0.012 } = {}) {
  const r = rnd(seed);
  g.save();
  g.translate(x, y); g.rotate(rise + (r() - 0.5) * 0.01);
  g.font = `bold ${px}px ${HAND}`;
  g.textAlign = align; g.textBaseline = 'alphabetic';
  g.fillStyle = PENCIL;
  // (pressed hard: the graphite laid on twice, a stroke round each letter)
  g.strokeStyle = PENCIL; g.lineWidth = Math.max(1.5, px * 0.07); g.lineJoin = 'round';
  g.strokeText(text, 0, 0);
  g.fillText(text, 0, 0);
  g.globalAlpha = 0.45;
  g.fillText(text, px * 0.02, -px * 0.015);
  g.restore();
}

export function drawGuestCheck(g, W, H, lines = [], { total = null, sign = 'thank you — Dot', big = null, no = 4417, seed = 7 } = {}) {
  g.fillStyle = PAPER; g.fillRect(0, 0, W, H);
  grain(g, W, H, seed, 0.06);
  const K = W / 512;
  const ink = 'rgba(20,20,22,0.95)';
  // the printed head: DINER, a rule, GUEST CHECK, the number
  g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.font = `bold ${Math.round(78 * K)}px ${SERIF}`;
  g.fillText('DINER', W / 2, 92 * K);
  g.fillRect(28 * K, 110 * K, W - 56 * K, 4 * K);
  g.font = `${Math.round(24 * K)}px ${PRINT}`;
  g.textAlign = 'left'; g.fillText('GUEST CHECK', 32 * K, 146 * K);
  g.textAlign = 'right'; g.fillStyle = 'rgba(150,20,30,0.9)'; g.fillText('No ' + no, W - 32 * K, 146 * K);
  // the boxes: table, guests, server
  g.fillStyle = ink; g.font = `${Math.round(15 * K)}px ${PRINT}`; g.textAlign = 'left';
  const bx = [28, 190, 330, 484].map((v) => v * K);
  g.lineWidth = 2 * K; g.strokeStyle = ink;
  g.strokeRect(bx[0], 160 * K, bx[3] - bx[0], 46 * K);
  for (const x of [bx[1], bx[2]]) { g.beginPath(); g.moveTo(x, 160 * K); g.lineTo(x, 206 * K); g.stroke(); }
  g.fillText('TABLE', bx[0] + 6 * K, 176 * K); g.fillText('GUESTS', bx[1] + 6 * K, 176 * K); g.fillText('SERVER', bx[2] + 6 * K, 176 * K);
  // the ruled lines and the price column
  const top = 240 * K, step = 46 * K, rows = Math.floor((H - top - 110 * K) / step);
  g.strokeStyle = 'rgba(40,46,60,0.7)'; g.lineWidth = 2.4 * K;
  for (let i = 0; i <= rows; i++) { const y = top + i * step; g.beginPath(); g.moveTo(28 * K, y); g.lineTo(W - 28 * K, y); g.stroke(); }
  const px = W - 120 * K;
  g.strokeStyle = 'rgba(150,20,30,0.6)';
  g.beginPath(); g.moveTo(px, top - 10 * K); g.lineTo(px, top + rows * step); g.stroke();
  // the foot: TOTAL, the printed thanks
  const fy = top + rows * step;
  g.fillStyle = ink; g.font = `bold ${Math.round(22 * K)}px ${PRINT}`; g.textAlign = 'left';
  g.fillText('TOTAL', 32 * K, fy + 40 * K);
  g.font = `${Math.round(14 * K)}px ${PRINT}`; g.textAlign = 'center';
  g.fillText('PAY THE CASHIER  ·  COME AGAIN', W / 2, H - 22 * K);
  // her pencil: the table, the server's initial
  pencil(g, '4', bx[0] + 70 * K, 200 * K, Math.round(30 * K), { seed: seed + 1 });
  pencil(g, '1', bx[1] + 70 * K, 200 * K, Math.round(30 * K), { seed: seed + 2 });
  pencil(g, 'D.', bx[2] + 68 * K, 200 * K, Math.round(30 * K), { seed: seed + 3 });
  if (big && big.length) {
    // (a few large words across the ruled lines: legible from a metre)
    const n = big.length, h = Math.min(120 * K, (rows * step) / n * 0.82);
    // [C9] (a word wider than the slip - MIDNIGHT ran off both its edges - is
    // written smaller to fit inside its margins)
    const fit = (t) => { g.font = `bold ${Math.round(h)}px ${HAND}`; const w = g.measureText(t).width * 1.06; return w > W - 64 * K ? Math.round(h * (W - 64 * K) / w) : Math.round(h); };
    big.forEach((t, i) => pencil(g, t, W / 2, top + (rows * step) * (i + 0.72) / n, fit(t), { align: 'center', seed: seed + 10 + i, rise: -0.03 }));
  } else {
    lines.forEach((ln, i) => {
      const [item, price] = String(ln).split('|');
      pencil(g, item, 38 * K, top + step * (i + 1) - 8 * K, Math.round(38 * K), { seed: seed + 20 + i });
      if (price) pencil(g, price, W - 40 * K, top + step * (i + 1) - 8 * K, Math.round(38 * K), { align: 'right', seed: seed + 40 + i });
    });
    if (total) pencil(g, total, W - 40 * K, fy + 42 * K, Math.round(33 * K), { align: 'right', seed: seed + 60 });
    if (sign) pencil(g, sign, W / 2 + 20 * K, fy - 30 * K, Math.round(46 * K), { align: 'center', seed: seed + 61, rise: -0.05 });
  }
}

export function drawAmesCard(g, W, H, { crossed = true, seed = 304 } = {}) {
  g.fillStyle = CARD; g.fillRect(0, 0, W, H);
  grain(g, W, H, seed, 0.045);
  const K = W / 1024;
  const ink = 'rgba(14,14,16,0.97)';
  g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  // (an engraved card: the name large, the trade spaced, the address)
  // ([C4] the critic's second look, m2: the name in the card's heavy print
  // and pressed - its Didot's hairlines broke up in the hand at 1440 x 900
  // and it was the weakest line on the card; now it reads first)
  g.font = `bold ${Math.round(140 * K)}px ${PRINT}`;
  g.strokeStyle = ink; g.lineWidth = 4 * K; g.lineJoin = 'round';
  g.strokeText('J. AMES', W / 2, 205 * K);
  g.fillText('J. AMES', W / 2, 205 * K);
  g.fillRect(W / 2 - 300 * K, 238 * K, 600 * K, 5 * K);
  g.font = `bold ${Math.round(52 * K)}px ${PRINT}`;
  g.save(); g.translate(W / 2, 318 * K); g.fillText('PRIVATE  INVESTIGATIONS', 0, 0); g.restore();
  g.font = `bold ${Math.round(64 * K)}px ${PRINT}`;
  g.fillText('HARBOR BLDG.  RM 304', W / 2, 432 * K);
  g.font = `${Math.round(32 * K)}px ${PRINT}`;
  g.fillText('HARBOR 4-0117   ·   NIGHT CALLS TAKEN', W / 2, 518 * K);
  if (!crossed) return;
  // the cross: a grease pencil, bold - two strokes corner to corner, pressed
  // hard, waxy (the paper's tooth shows through in skips), the second over
  // the first
  const r = rnd(seed + 9);
  // (wax over print: the red multiplies with the paper - the black letters
  // stay black under it, so every word still reads through the cross)
  g.globalCompositeOperation = 'multiply';
  const stroke = (x0, y0, x1, y1, w) => {
    const L = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / L, uy = (y1 - y0) / L, nx = -uy, ny = ux;
    for (let k = 0; k < 26; k++) {
      const off = (k / 25 - 0.5) * w;
      g.strokeStyle = CREW_RED; g.globalAlpha = 0.55 + 0.4 * r(); g.lineWidth = (3 + 4 * r()) * K; g.lineCap = 'round';
      g.beginPath();
      let on = false;
      for (let s = 0; s <= 1.0001; s += 0.02) {
        const skip = r() < 0.05;
        const wob = Math.sin(s * 9 + k) * 2.5 * K;
        const x = x0 + ux * L * s + nx * (off + wob), y = y0 + uy * L * s + ny * (off + wob);
        if (skip) { on = false; continue; }
        if (!on) { g.moveTo(x, y); on = true; } else g.lineTo(x, y);
      }
      g.stroke();
    }
    g.globalAlpha = 1;
  };
  // ([C4] m2: from just under the name's corners, so its arms cross the card
  // and leave the name clear)
  stroke(70 * K, 125 * K, W - 80 * K, H - 46 * K, 34 * K);
  stroke(W - 60 * K, 135 * K, 90 * K, H - 32 * K, 32 * K);
  g.globalCompositeOperation = 'source-over';
}

function paperMat(canvas, name, surface = 'paper') {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  // (unlit for the check on the counter: under the pendant's pool a lit
  // face printed white, its print and all; the card in the hand is lit)
  const m = surface === 'unlit' ? new THREE.MeshBasicMaterial({ color: new THREE.Color(0.92, 0.92, 0.92), map: tex }) : new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, map: tex });
  m.name = 'prop_' + name;
  // (printed as paper in the hands too: its own white, the grey of its print)
  m.userData.inkSurface = surface === 'unlit' ? 'paper' : surface;
  return m;
}
const plainMat = () => { const m = new THREE.MeshStandardMaterial({ color: 0xc9c4b8, roughness: 0.95 }); m.name = 'prop_cardback'; m.userData.inkSurface = 'paper'; return m; };

// a sheet: its face a canvas on top (+y), its head toward -z, read from +z
function sheet(w, t, d, canvas, name, surface = 'paper') {
  const body = slab(w, t, d, { bevel: t * 0.4, corner: 0.002, seg: 1, curve: 3 });
  // (the face a hair above the body - 0.8 mm: closer, the depth test lost it to the body at half a metre)
  const face = new THREE.PlaneGeometry(w - 0.0004, d - 0.0004).rotateX(-Math.PI / 2).translate(0, t + 0.0008, 0);
  return { body, face, mat: paperMat(canvas, name, surface) };
}

export const SPECS = {
  // ([C4] the critic's second look, M2: the Cardinal's matchbook as it comes
  // up in my fingers at the end of II - the shared matchbook's own build,
  // under a kind of its own so the hand holds it by a socket of its own
  // (player/clips/c4.js c4readMatchbook): the shared one rides a finger bone)
  c4matchbook(v, lod) { return BUILT_IN.matchbook(v, lod); },
  amesCard() {
    const W = 1024, H = 588;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    drawAmesCard(c.getContext('2d'), W, H);
    // ([C4] after the critic: held in the fingers under the lamp a lit face
    // printed its print grey - unlit, as the check's: the black and the red read)
    const S = sheet(0.089, 0.0006, 0.051, c, 'amesCard', 'unlit');
    return {
      parts: [{ geo: S.body, mat: plainMat(), id: 0 }, { geo: S.face, mat: S.mat, id: 0, cast: false, name: 'face' }],
      grip: [0.03, 0.0003, 0.0], accent: 'crew',
      init(g, ud) { ud.canvas = c; ud.crossed = true; },
    };
  },
  guestCheck(v) {
    const W = 512, H = 842;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g2 = c.getContext('2d');
    const first = v === 'pier9' ? { lines: [], opts: { big: ['PIER 9', 'MIDNIGHT', '— DOT'], sign: null } } : { lines: ['1  Scotch, neat|.35'], opts: { total: '.35' } };
    drawGuestCheck(g2, W, H, first.lines, first.opts);
    // (on the lit counter the paper class prints all of it white: its print is
    // read as an ordinary surface's albedo, the ink's own greys)
    const S = sheet(0.085, 0.0004, 0.14, c, 'guestCheck', 'unlit');
    return {
      parts: [{ geo: S.body, mat: plainMat(), id: 0 }, { geo: S.face, mat: S.mat, id: 0, cast: false, name: 'face' }],
      grip: [0.03, 0.0002, 0.05],
      init(g, ud) {
        ud.canvas = c;
        ud.write = (lines = [], opts = {}) => { drawGuestCheck(g2, W, H, lines, opts); S.mat.map.needsUpdate = true; };
      },
    };
  },
};

import { RNG } from '../util/rng.js';
import { LETTER_FONT } from '../ui/lettering.js';

// The rooms' painted faces (lane O5b, brief O5b §3: the rooms told apart): drawn into a
// place's lettering atlas by label(K, '', ..., { draw }) (pieces.js). Each in the
// reference's own few strokes: paper, black shapes, a hard light; never a photograph.
//   filmPoster(i)    the Orpheum's: a face or a scene and a title (five)
//   fightCard(i)     the gym's: two fighters squared up, the names, the night
//   chalkBoard(rows) the gym's: tonight's bouts in chalk, the purses, the tallies
//   stencil(text)    the warehouse's crates: a word sprayed through a stencil
//   priceBoard(rows) the diner's: the lit board over the pass
//   pieCase()        the diner's: the case's glass lit from inside, the pies on their stands
const PAPER = '#dcd8cd', INK = '#0b0b0b';

function title(g, text, x, y, w, size, color = INK, weight = 800) {
  g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
  let fs = size;
  g.font = `${weight} ${fs}px ${LETTER_FONT}`;
  while (g.measureText(text).width > w && fs > 6) { fs -= 1; g.font = `${weight} ${fs}px ${LETTER_FONT}`; }
  g.fillText(text, x, y);
}
// a rough brush rule (a dry stroke, not a vector line)
function brush(g, x0, y0, x1, y1, wd, rng, color = INK) {
  g.strokeStyle = color; g.lineCap = 'round';
  for (let k = 0; k < 3; k++) {
    g.lineWidth = wd * (0.6 + rng.next() * 0.5);
    g.beginPath(); g.moveTo(x0 + (rng.next() - 0.5) * wd, y0 + (rng.next() - 0.5) * wd);
    g.quadraticCurveTo((x0 + x1) / 2 + (rng.next() - 0.5) * wd * 2, (y0 + y1) / 2 + (rng.next() - 0.5) * wd * 2, x1 + (rng.next() - 0.5) * wd, y1 + (rng.next() - 0.5) * wd);
    g.stroke();
  }
}
function grain(g, w, h, rng, n = 400, a = 0.07) {
  for (let i = 0; i < n; i++) { g.fillStyle = `rgba(0,0,0,${rng.next() * a})`; g.fillRect(rng.next() * w, rng.next() * h, 1 + rng.next() * 3, 1); }
}
// a man under his hat, the face lit from one side (the reference's man, close)
function hatMan(g, cx, top, s, rng, side = 1) {
  g.fillStyle = INK;
  g.beginPath(); g.moveTo(cx - 1.6 * s, top + 3.4 * s); g.quadraticCurveTo(cx - 1.2 * s, top + 1.5 * s, cx - 0.4 * s, top + 1.35 * s); g.lineTo(cx + 0.4 * s, top + 1.35 * s); g.quadraticCurveTo(cx + 1.2 * s, top + 1.5 * s, cx + 1.6 * s, top + 3.4 * s); g.closePath(); g.fill();
  // the face: pale on the lit side, lost in the black on the other
  g.fillStyle = PAPER; g.beginPath(); g.ellipse(cx, top + 0.95 * s, 0.42 * s, 0.56 * s, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = INK; g.beginPath(); g.ellipse(cx - side * 0.18 * s, top + 0.98 * s, 0.32 * s, 0.6 * s, 0, 0, Math.PI * 2); g.fill();
  g.fillRect(cx - 0.42 * s, top + 0.5 * s, 0.84 * s, 0.22 * s);
  // the hat
  g.beginPath(); g.ellipse(cx, top + 0.5 * s, 0.95 * s, 0.16 * s, -0.05 * side, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(cx - 0.5 * s, top + 0.5 * s); g.quadraticCurveTo(cx - 0.48 * s, top - 0.1 * s, cx, top - 0.05 * s); g.quadraticCurveTo(cx + 0.48 * s, top - 0.1 * s, cx + 0.5 * s, top + 0.5 * s); g.fill();
  // a cigarette's smoke, the collar
  g.strokeStyle = PAPER; g.lineWidth = Math.max(1, 0.05 * s); g.beginPath(); g.moveTo(cx + side * 0.15 * s, top + 1.3 * s); g.lineTo(cx + side * 0.55 * s, top + 1.36 * s); g.stroke();
  g.strokeStyle = 'rgba(220,216,205,0.6)'; g.beginPath(); g.moveTo(cx + side * 0.55 * s, top + 1.3 * s); for (let k = 1; k < 6; k++) g.lineTo(cx + side * (0.55 + 0.08 * k + rng.next() * 0.1) * s, top + (1.3 - 0.22 * k) * s); g.stroke();
}
// a woman's head in profile: the dark wave of her hair, the pale line of her face, the mouth
function woman(g, cx, top, s, rng) {
  g.fillStyle = PAPER; g.beginPath(); g.moveTo(cx + 0.2 * s, top + 0.2 * s); g.quadraticCurveTo(cx + 0.75 * s, top + 0.6 * s, cx + 0.62 * s, top + 1.0 * s); g.lineTo(cx + 0.7 * s, top + 1.12 * s); g.quadraticCurveTo(cx + 0.55 * s, top + 1.25 * s, cx + 0.58 * s, top + 1.35 * s); g.quadraticCurveTo(cx + 0.45 * s, top + 1.7 * s, cx + 0.05 * s, top + 1.75 * s); g.lineTo(cx - 0.1 * s, top + 2.4 * s); g.lineTo(cx - 0.5 * s, top + 2.4 * s); g.closePath(); g.fill();
  g.fillStyle = INK; g.beginPath(); g.moveTo(cx + 0.3 * s, top); g.bezierCurveTo(cx - 0.6 * s, top - 0.2 * s, cx - 1.2 * s, top + 0.9 * s, cx - 0.9 * s, top + 1.9 * s); g.bezierCurveTo(cx - 0.6 * s, top + 2.3 * s, cx - 0.2 * s, top + 1.6 * s, cx - 0.1 * s, top + 1.2 * s); g.bezierCurveTo(cx + 0.1 * s, top + 0.7 * s, cx + 0.4 * s, top + 0.5 * s, cx + 0.3 * s, top); g.fill();
  g.beginPath(); g.ellipse(cx + 0.55 * s, top + 1.3 * s, 0.09 * s, 0.035 * s, -0.3, 0, Math.PI * 2); g.fill();
  g.fillRect(cx + 0.3 * s, top + 0.83 * s, 0.18 * s, 0.03 * s);
  void rng;
}
// five films, each its own picture
const FILMS = [
  { t: 'THE LONG NIGHT', sub: 'NOBODY SLEEPS IN THIS TOWN' },
  { t: 'SHE WORE GREY', sub: 'SHE LIED. HE KNEW IT.' },
  { t: "DEAD MAN'S HAND", sub: 'ACES AND EIGHTS' },
  { t: 'RAIN ON CANAL ST.', sub: 'EVERY CITY HAS ONE' },
  { t: 'THE BLACK SEDAN', sub: 'IT CAME FOR HIM AT MIDNIGHT' },
];
export function filmPoster(i) {
  const F = FILMS[i % FILMS.length];
  return (g, w, h) => {
    const rng = new RNG(0xF11 + i * 31);
    g.fillStyle = PAPER; g.fillRect(0, 0, w, h);
    const ph = h * 0.7, s = w / 4;
    g.save(); g.beginPath(); g.rect(w * 0.06, h * 0.05, w * 0.88, ph); g.clip();
    g.fillStyle = '#9a968c'; g.fillRect(0, 0, w, h);
    if (i % 5 === 0) {
      // a man under a lamp: the cone, his hat, the black
      g.fillStyle = INK; g.fillRect(0, 0, w, h);
      g.fillStyle = '#c9c5ba'; g.beginPath(); g.moveTo(w * 0.5, h * 0.05); g.lineTo(w * 0.05, h * 0.75); g.lineTo(w * 0.95, h * 0.75); g.closePath(); g.fill();
      hatMan(g, w * 0.5, h * 0.22, s * 0.9, rng, 1);
    } else if (i % 5 === 1) {
      g.fillStyle = INK; g.fillRect(0, 0, w * 0.4, h);
      woman(g, w * 0.45, h * 0.12, s * 1.05, rng);
      hatMan(g, w * 0.2, h * 0.42, s * 0.5, rng, -1);
    } else if (i % 5 === 2) {
      // the cards fanned in a black glove, the gun under them
      g.fillStyle = INK; g.fillRect(0, 0, w, h);
      for (let k = 0; k < 5; k++) { g.save(); g.translate(w * 0.5, h * 0.62); g.rotate(-0.5 + k * 0.25); g.fillStyle = PAPER; g.fillRect(-s * 0.32, -s * 1.5, s * 0.64, s * 0.95); g.fillStyle = INK; g.font = `800 ${s * 0.3}px ${LETTER_FONT}`; g.textAlign = 'center'; g.fillText(k % 2 ? '8' : 'A', 0, -s * 1.2); g.beginPath(); g.arc(0, -s * 0.85, s * 0.08, 0, Math.PI * 2); g.fill(); g.restore(); }
      g.fillStyle = '#2a2a2a'; g.beginPath(); g.ellipse(w * 0.5, h * 0.66, s * 0.6, s * 0.35, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#8f8b82'; g.fillRect(w * 0.18, h * 0.5, s * 1.3, s * 0.18); g.fillRect(w * 0.18 + s * 0.9, h * 0.5, s * 0.25, s * 0.55);
    } else if (i % 5 === 3) {
      // the street in the rain: a lamp, its cone, a man with his collar up, the wet road's streaks
      g.fillStyle = '#6e6b64'; g.fillRect(0, 0, w, h);
      g.fillStyle = INK; g.fillRect(0, h * 0.5, w, h);
      g.fillStyle = '#d6d2c6'; g.beginPath(); g.moveTo(w * 0.3, h * 0.12); g.lineTo(w * 0.1, h * 0.5); g.lineTo(w * 0.5, h * 0.5); g.closePath(); g.fill();
      g.fillRect(w * 0.29, h * 0.05, w * 0.02, h * 0.45);
      for (let k = 0; k < 9; k++) { g.fillStyle = 'rgba(220,216,205,0.55)'; g.fillRect(w * (0.12 + rng.next() * 0.4), h * (0.52 + rng.next() * 0.05), w * 0.012, h * (0.08 + rng.next() * 0.12)); }
      hatMan(g, w * 0.66, h * 0.2, s * 0.55, rng, -1);
      g.strokeStyle = 'rgba(230,226,215,0.5)'; g.lineWidth = 1;
      for (let k = 0; k < 40; k++) { const x = rng.next() * w, y = rng.next() * h * 0.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 3, y + 14); g.stroke(); }
    } else {
      // the sedan's black shape, its two lamps white
      g.fillStyle = '#5a5751'; g.fillRect(0, 0, w, h);
      g.fillStyle = INK; g.beginPath(); g.moveTo(w * 0.05, h * 0.62); g.quadraticCurveTo(w * 0.1, h * 0.4, w * 0.3, h * 0.38); g.quadraticCurveTo(w * 0.42, h * 0.22, w * 0.62, h * 0.24); g.quadraticCurveTo(w * 0.8, h * 0.3, w * 0.95, h * 0.45); g.lineTo(w * 0.95, h * 0.65); g.closePath(); g.fill();
      g.fillRect(0, h * 0.62, w, h);
      g.fillStyle = '#f4f1ea'; for (const x of [0.8, 0.92]) { g.beginPath(); g.arc(w * x, h * 0.5, s * 0.12, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = 'rgba(244,241,234,0.35)'; g.beginPath(); g.moveTo(w * 0.86, h * 0.5); g.lineTo(w * 1.0, h * 0.4); g.lineTo(w * 1.0, h * 0.75); g.closePath(); g.fill();
    }
    grain(g, w, h, rng, 300, 0.12);
    g.restore();
    g.strokeStyle = INK; g.lineWidth = Math.max(2, w * 0.012); g.strokeRect(w * 0.06, h * 0.05, w * 0.88, ph);
    title(g, F.t, w / 2, h * 0.83, w * 0.86, h * 0.075);
    title(g, F.sub, w / 2, h * 0.92, w * 0.8, h * 0.032, '#2a2a2a', 700);
    grain(g, w, h, rng, 200, 0.05);
  };
}
// the gym's fight cards: a band, two men squared up, the names, the night
export function fightCard(i, names) {
  return (g, w, h) => {
    const rng = new RNG(0xB0 + i * 7);
    g.fillStyle = '#cfcab9'; g.fillRect(0, 0, w, h);
    g.fillStyle = INK; g.fillRect(0, 0, w, h * 0.16);
    title(g, 'BOXING', w / 2, h * 0.085, w * 0.86, h * 0.11, '#e8e4d8');
    // two fighters, black, fists up, leaning in
    for (const sd of [-1, 1]) {
      const cx = w / 2 + sd * w * 0.2, top = h * 0.24;
      g.fillStyle = INK;
      g.beginPath(); g.arc(cx, top + h * 0.04, w * 0.07, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(cx - w * 0.11, top + h * 0.09); g.lineTo(cx + w * 0.11, top + h * 0.09); g.lineTo(cx + w * 0.07, top + h * 0.3); g.lineTo(cx - w * 0.07, top + h * 0.3); g.closePath(); g.fill();
      g.beginPath(); g.arc(cx - sd * w * 0.12, top + h * 0.07, w * 0.055, 0, Math.PI * 2); g.fill();
      brush(g, cx - sd * w * 0.02, top + h * 0.12, cx - sd * w * 0.12, top + h * 0.08, w * 0.04, rng);
      brush(g, cx - w * 0.05, top + h * 0.3, cx - w * 0.07, top + h * 0.44, w * 0.04, rng);
      brush(g, cx + w * 0.05, top + h * 0.3, cx + w * 0.08, top + h * 0.44, w * 0.04, rng);
    }
    const [a, b] = names[i % names.length];
    title(g, a, w / 2, h * 0.73, w * 0.9, h * 0.07);
    title(g, 'vs', w / 2, h * 0.79, w * 0.3, h * 0.04, '#333', 700);
    title(g, b, w / 2, h * 0.85, w * 0.9, h * 0.07);
    title(g, ['FRIDAY  10 ROUNDS', 'SATURDAY  MAIN EVENT', 'TONIGHT  ADM. 25c', 'SUNDAY  BENEFIT'][i % 4], w / 2, h * 0.94, w * 0.86, h * 0.035, '#222', 700);
    grain(g, w, h, rng, 260, 0.1);
  };
}
// a chalk board: tonight's bouts, the purses, the tallies
export function chalkBoard(rows) {
  return (g, w, h) => {
    const rng = new RNG(0xC4A1C);
    g.fillStyle = '#161816'; g.fillRect(0, 0, w, h);
    // the smudges of old chalk
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(200,200,190,${0.02 + rng.next() * 0.04})`; g.beginPath(); g.ellipse(rng.next() * w, rng.next() * h, 10 + rng.next() * 40, 4 + rng.next() * 12, rng.next(), 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#dedad0'; g.textBaseline = 'middle';
    g.textAlign = 'left';
    g.font = `700 ${h * 0.12}px ${LETTER_FONT}`; g.fillText('TONIGHT', w * 0.06, h * 0.13);
    brush(g, w * 0.06, h * 0.21, w * 0.5, h * 0.215, 2, rng, '#cfcbc0');
    rows.forEach((r, k) => {
      const y = h * (0.36 + k * 0.17);
      g.font = `600 ${h * 0.085}px ${LETTER_FONT}`; g.textAlign = 'left'; g.fillStyle = '#dedad0'; g.fillText(r[0], w * 0.06, y);
      g.textAlign = 'right'; g.fillText(r[1], w * 0.94, y);
      // the tallies of who won
      for (let t = 0; t < (k + 2) % 5; t++) brush(g, w * (0.62 + t * 0.025), y - h * 0.04, w * (0.625 + t * 0.025), y + h * 0.04, 1.5, rng, '#bdb9ae');
    });
    // the frame
    g.strokeStyle = '#2c2a26'; g.lineWidth = Math.max(4, w * 0.025); g.strokeRect(0, 0, w, h);
  };
}
// a word sprayed through a stencil on a crate's boards (pale on the dark wood, broken by the stencil's bridges)
export function stencil(text, sub = '') {
  return (g, w, h) => {
    const rng = new RNG(text.length * 131 + sub.length);
    g.fillStyle = '#2a2722'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += h / 4) { g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(0, y, w, 2); }
    g.fillStyle = '#c4bfb1'; g.textAlign = 'center'; g.textBaseline = 'middle';
    let fs = h * (sub ? 0.36 : 0.5); g.font = `800 ${fs}px ${LETTER_FONT}`;
    while (g.measureText(text).width > w * 0.9 && fs > 6) { fs -= 1; g.font = `800 ${fs}px ${LETTER_FONT}`; }
    g.fillText(text, w / 2, h * (sub ? 0.4 : 0.52));
    if (sub) { g.font = `700 ${h * 0.16}px ${LETTER_FONT}`; g.fillText(sub, w / 2, h * 0.76); }
    // the stencil's bridges and the spray's overspray
    g.fillStyle = '#2a2722'; for (let x = w * 0.08; x < w; x += w * (0.07 + rng.next() * 0.05)) g.fillRect(x, 0, Math.max(1, w * 0.006), h);
    for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(167,162,150,${rng.next() * 0.25})`; g.fillRect(w * (0.1 + rng.next() * 0.8), h * (0.15 + rng.next() * 0.7), 1, 1); }
  };
}
// the diner's price board over the pass: lit, its letters black
export function priceBoard(rows) {
  return (g, w, h) => {
    g.fillStyle = '#e6e2d6'; g.fillRect(0, 0, w, h);
    g.fillStyle = INK; g.fillRect(0, 0, w, h * 0.2);
    title(g, 'TODAY', w / 2, h * 0.1, w * 0.6, h * 0.14, '#ece8dc');
    g.textBaseline = 'middle';
    rows.forEach(([a, b], k) => {
      const y = h * (0.32 + k * (0.66 / rows.length));
      g.fillStyle = INK; g.font = `700 ${h * 0.1}px ${LETTER_FONT}`;
      g.textAlign = 'left'; g.fillText(a, w * 0.06, y);
      g.textAlign = 'right'; g.fillText(b, w * 0.94, y);
      g.fillStyle = 'rgba(0,0,0,0.5)'; for (let x = w * 0.45; x < w * 0.8; x += w * 0.03) g.fillRect(x, y + h * 0.02, 2, 2);
    });
  };
}
// the pie case: the glass lit from inside, two shelves, the pies on their stands under glass domes
// (each pie its crust's dark band, its top with a lattice or a wedge cut out)
export function pieCase() {
  return (g, w, h) => {
    const rng = new RNG(0x91E);
    g.fillStyle = '#efece4'; g.fillRect(0, 0, w, h);
    g.fillStyle = INK;
    g.fillRect(0, h * 0.5, w, h * 0.04);
    g.fillRect(0, 0, w, h * 0.04); g.fillRect(0, h * 0.96, w, h * 0.04);
    for (const row of [0.5, 0.96]) {
      for (let k = 0; k < 3; k++) {
        const cx = w * (0.18 + k * 0.32), y = h * row, pw = w * 0.13, py = y - h * 0.13;
        // the stand
        g.fillStyle = INK; g.fillRect(cx - w * 0.008, py + h * 0.03, w * 0.016, y - py - h * 0.03); g.fillRect(cx - w * 0.06, y - h * 0.012, w * 0.12, h * 0.012);
        g.fillRect(cx - pw * 1.08, py + h * 0.02, pw * 2.16, h * 0.012);
        // the pie: the crust's band, the top
        g.fillStyle = '#3a3733'; g.beginPath(); g.moveTo(cx - pw, py + h * 0.02); g.lineTo(cx - pw * 0.92, py - h * 0.03); g.lineTo(cx + pw * 0.92, py - h * 0.03); g.lineTo(cx + pw, py + h * 0.02); g.closePath(); g.fill();
        g.fillStyle = '#8c877c'; g.beginPath(); g.ellipse(cx, py - h * 0.03, pw * 0.92, h * 0.025, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#2a2724'; g.lineWidth = 1.5;
        if ((k + (row > 0.6 ? 1 : 0)) % 2) { for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(cx + i * pw * 0.25, py - h * 0.05); g.lineTo(cx + i * pw * 0.25 + pw * 0.1, py - h * 0.01); g.stroke(); } }
        else { g.fillStyle = '#efece4'; g.beginPath(); g.moveTo(cx, py - h * 0.03); g.lineTo(cx + pw * 0.9, py - h * 0.045); g.lineTo(cx + pw * 0.95, py + h * 0.02); g.lineTo(cx + pw * 0.2, py + h * 0.02); g.closePath(); g.fill(); g.fillStyle = '#5a554d'; g.fillRect(cx + pw * 0.2, py - h * 0.03, pw * 0.05, h * 0.05); }
        // the dome
        g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 2.5; g.beginPath(); g.ellipse(cx, py + h * 0.02, pw * 1.12, h * 0.17, 0, Math.PI, 0); g.stroke();
        g.fillStyle = INK; g.beginPath(); g.arc(cx, py - h * 0.15, w * 0.012, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 3; g.beginPath(); g.ellipse(cx, py + h * 0.02, pw * 0.95, h * 0.14, 0, Math.PI * 1.15, Math.PI * 1.35); g.stroke();
      }
    }
    void rng;
  };
}

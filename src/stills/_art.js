import { blob } from '../ui/inkArt.js';

// The stills' placeholder pictures (lane C1): flat ink shapes drawn on a
// canvas at load, one per panel of WAVE_C §5, so the timing and the story
// can be judged before lane C9's pictures exist. Black ground, paper-white
// shapes, a grey wash or two, and only the registry's accents (the crew's
// red, the ember, the neon). Each is (g, w, h, rng) on a canvas already
// filled black. (Not a stills file: the glob skips names that start with _)
const PAPER = '#ece9e1', INK = '#060606', CREW = '#c8102e', EMBER = '#ff7a1a', NEON = '#6fb6ff';

// rain: thin slanted streaks, lighter than the dark
function rain(g, w, h, rng, { n = 260, a = 0.22, slant = 0.18, len = [18, 46], x0 = 0, x1 = w, y0 = 0, y1 = h } = {}) {
  g.save();
  g.strokeStyle = `rgba(230,230,225,${a})`;
  g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = rng.range(x0, x1), y = rng.range(y0, y1), L = rng.range(len[0], len[1]);
    g.lineWidth = rng.range(0.8, 1.8);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x - L * slant, y + L); g.stroke();
  }
  g.restore();
}
// a cone of light from (x, y) down along angle a (radians from straight down)
function cone(g, x, y, a, spread, len, alpha = 0.55) {
  g.save();
  const dx = Math.sin(a), dy = Math.cos(a);
  const px = -dy, py = dx;
  const ex = x + dx * len, ey = y + dy * len, hw = Math.tan(spread) * len;
  const gr = g.createLinearGradient(x, y, ex, ey);
  gr.addColorStop(0, `rgba(240,238,230,${alpha})`);
  gr.addColorStop(0.55, `rgba(240,238,230,${alpha * 0.4})`);
  gr.addColorStop(1, 'rgba(240,238,230,0)');
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(x - px * 6, y - py * 6); g.lineTo(x + px * 6, y + py * 6);
  g.lineTo(ex + px * hw, ey + py * hw); g.lineTo(ex - px * hw, ey - py * hw);
  g.closePath(); g.fill();
  g.restore();
}
// a fedora and shoulders, black with a rim of light on one side
function hatMan(g, cx, base, s, rim = 1) {
  g.save();
  g.fillStyle = INK;
  // shoulders and coat
  g.beginPath();
  g.moveTo(cx - 62 * s, base);
  g.quadraticCurveTo(cx - 58 * s, base - 120 * s, cx - 34 * s, base - 150 * s);
  g.lineTo(cx + 34 * s, base - 150 * s);
  g.quadraticCurveTo(cx + 58 * s, base - 120 * s, cx + 62 * s, base);
  g.closePath(); g.fill();
  // head and hat
  g.beginPath(); g.ellipse(cx, base - 168 * s, 17 * s, 21 * s, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(cx, base - 182 * s, 42 * s, 7 * s, 0, 0, Math.PI * 2); g.fill();
  g.beginPath();
  g.moveTo(cx - 22 * s, base - 184 * s); g.quadraticCurveTo(cx - 24 * s, base - 214 * s, cx - 4 * s, base - 212 * s);
  g.quadraticCurveTo(cx + 2 * s, base - 206 * s, cx + 8 * s, base - 212 * s); g.quadraticCurveTo(cx + 26 * s, base - 214 * s, cx + 22 * s, base - 184 * s);
  g.closePath(); g.fill();
  // the rim of light
  if (rim) {
    g.strokeStyle = 'rgba(236,233,225,0.85)'; g.lineWidth = 2.2 * s;
    const sd = rim > 0 ? 1 : -1;
    g.beginPath(); g.moveTo(cx + sd * 40 * s, base - 182 * s); g.lineTo(cx + sd * 22 * s, base - 186 * s); g.stroke();
    g.beginPath(); g.moveTo(cx + sd * 34 * s, base - 150 * s); g.quadraticCurveTo(cx + sd * 58 * s, base - 120 * s, cx + sd * 61 * s, base - 20 * s); g.stroke();
  }
  g.restore();
}
// a red cross, as a hand would draw it with a grease pencil: two strokes
function redCross(g, x, y, r, rng, w = 9) {
  g.save();
  g.strokeStyle = CREW; g.lineCap = 'round';
  for (const [a, b] of [[[-1, -0.85], [1, 0.9]], [[1, -0.9], [-0.95, 0.85]]]) {
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(x + a[0] * r, y + a[1] * r);
    g.quadraticCurveTo(x + rng.gauss() * r * 0.06, y + rng.gauss() * r * 0.06, x + b[0] * r, y + b[1] * r);
    g.stroke();
  }
  g.restore();
}
// drops on glass: small paper-white lenses with a dark core
function drops(g, w, h, rng, n = 70, r = [2, 7]) {
  g.save();
  for (let i = 0; i < n; i++) {
    const x = rng.range(0, w), y = rng.range(0, h), R = rng.range(r[0], r[1]);
    g.fillStyle = 'rgba(236,233,225,0.55)';
    blob(g, x, y, R, rng, 0.2);
    g.fillStyle = 'rgba(5,5,5,0.7)';
    blob(g, x + R * 0.2, y + R * 0.15, R * 0.55, rng, 0.2);
  }
  g.restore();
}

export const ART = {
  // A TIP. AMES. - a telephone receiver in a hand, a desk lamp's cone, rain on the glass
  tip(g, w, h, rng) {
    // the window behind: dark grey, the rain on it, its bars
    g.fillStyle = '#262626'; g.fillRect(w * 0.5, 0, w * 0.5, h * 0.74);
    rain(g, w, h, rng, { x0: w * 0.5, x1: w, y1: h * 0.74, n: 260, a: 0.34 });
    drops(g, w, h * 0.74, rng, 26, [2, 4]);
    g.fillStyle = INK; g.fillRect(w * 0.495, 0, w * 0.016, h * 0.74); g.fillRect(w * 0.5, h * 0.37, w * 0.5, h * 0.014); g.fillRect(w * 0.75, 0, w * 0.01, h * 0.74);
    // the lamp: a shade top left, its cone down onto the desk
    cone(g, w * 0.2, h * 0.17, -0.1, 0.46, h * 0.9, 0.62);
    g.fillStyle = INK;
    g.beginPath(); g.moveTo(w * 0.12, h * 0.18); g.lineTo(w * 0.28, h * 0.18); g.lineTo(w * 0.24, h * 0.06); g.lineTo(w * 0.16, h * 0.06); g.closePath(); g.fill();
    g.fillStyle = PAPER; g.beginPath(); g.ellipse(w * 0.2, h * 0.183, w * 0.08, h * 0.013, 0, 0, Math.PI * 2); g.fill();
    // the desk: the lamp's pool on it
    g.fillStyle = '#101010'; g.fillRect(0, h * 0.74, w, h * 0.26);
    const pool = g.createRadialGradient(w * 0.16, h * 0.84, 0, w * 0.16, h * 0.84, w * 0.3);
    pool.addColorStop(0, 'rgba(236,233,225,0.55)'); pool.addColorStop(1, 'rgba(236,233,225,0)');
    g.fillStyle = pool; g.fillRect(0, h * 0.74, w * 0.5, h * 0.26);
    g.fillStyle = 'rgba(236,233,225,0.55)'; g.fillRect(0, h * 0.74, w * 0.5, 3);
    // the handset, held up: a heavy bar, the earpiece's cup high, the
    // mouthpiece's low, black against the window, the lamp's rim along its top
    g.save();
    g.translate(w * 0.64, h * 0.5); g.rotate(-0.62);
    const L = w * 0.36, T = h * 0.075;
    g.fillStyle = INK;
    g.beginPath(); g.moveTo(-L / 2, -T * 0.4); g.quadraticCurveTo(0, -T * 1.3, L / 2, -T * 0.4); g.lineTo(L / 2, T * 0.5); g.quadraticCurveTo(0, -T * 0.2, -L / 2, T * 0.5); g.closePath(); g.fill();
    for (const sx of [-1, 1]) {
      g.beginPath(); g.ellipse(sx * L / 2, T * 0.75, T * 1.15, T * 0.95, 0, 0, Math.PI * 2); g.fill();
      g.fillRect(sx * L / 2 - T * 1.15, T * 0.2, T * 2.3, T * 0.6);
    }
    g.strokeStyle = 'rgba(236,233,225,0.9)'; g.lineWidth = 3.2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-L / 2 - T * 0.9, T * 0.1); g.quadraticCurveTo(-L / 2, -T * 0.55, -L * 0.3, -T * 0.62); g.quadraticCurveTo(0, -T * 1.05, L * 0.3, -T * 0.62); g.stroke();
    // the hand round its middle: four fingers over the top, the thumb under
    g.fillStyle = '#0b0b0b';
    for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(-L * 0.14 + i * T * 0.95, -T * 0.55, T * 0.5, T * 0.75, 0.15, 0, Math.PI * 2); g.fill(); }
    g.beginPath(); g.ellipse(L * 0.05, T * 0.45, T * 1.3, T * 0.55, -0.2, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(236,233,225,0.55)'; g.lineWidth = 2;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(-L * 0.14 + i * T * 0.95, -T * 0.55, T * 0.62, Math.PI * 1.1, Math.PI * 1.6); g.stroke(); }
    g.restore();
    // the wrist and the sleeve, down out of the frame
    g.fillStyle = INK;
    g.beginPath(); g.moveTo(w * 0.58, h * 0.58); g.lineTo(w * 0.7, h * 0.5); g.lineTo(w * 0.84, h * 1.02); g.lineTo(w * 0.6, h * 1.02); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(236,233,225,0.4)'; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(w * 0.7, h * 0.5); g.lineTo(w * 0.84, h * 1.02); g.stroke();
    // the cord, coiled down out of the frame from the mouthpiece
    g.strokeStyle = 'rgba(236,233,225,0.5)'; g.lineWidth = 2;
    g.beginPath();
    for (let i = 0; i <= 50; i++) { const u = i / 50, x = w * (0.47 - 0.08 * u) + Math.sin(u * 46) * 7, y = h * (0.72 + 0.32 * u); if (i) g.lineTo(x, y); else g.moveTo(x, y); }
    g.stroke();
  },
  // HIS MEN. MY DINER. - three hats in a doorway's light, a small white apron between them
  men(g, w, h, rng) {
    // the doorway: a tall lit slot in the black (the diner's door from the
    // street), the light thrown out on the wet pavement
    const dx = w * 0.37, dw = w * 0.26, dy = h * 0.05, dh = h * 0.78;
    rain(g, w, h, rng, { n: 120, a: 0.16 });
    const gr = g.createLinearGradient(0, dy, 0, dy + dh);
    gr.addColorStop(0, '#cfccc4'); gr.addColorStop(1, '#f2efe8');
    g.fillStyle = gr; g.fillRect(dx, dy, dw, dh);
    g.fillStyle = 'rgba(236,233,225,0.24)';
    g.beginPath(); g.moveTo(dx, dy + dh); g.lineTo(dx + dw, dy + dh); g.lineTo(dx + dw * 1.9, h); g.lineTo(dx - dw * 0.9, h); g.closePath(); g.fill();
    g.fillStyle = INK; g.fillRect(dx - w * 0.012, dy - h * 0.01, w * 0.012, dh + h * 0.01); g.fillRect(dx + dw, dy - h * 0.01, w * 0.012, dh + h * 0.01); g.fillRect(dx - w * 0.012, dy - h * 0.02, dw + w * 0.024, h * 0.02);
    // [C1] (after the critic: three hats and her - she was lost in front of
    // the third man's coat, the two at the door black on black)
    // the third man, inside, to one side: his hat and shoulders black in the light
    hatMan(g, w * 0.548, dy + dh, h / 505, 0);
    // her: small, against the light between them - a bun, the dress, the
    // white apron catching the doorway's light
    const dX = w * 0.463, hu = h / 100;
    g.fillStyle = '#121212';
    g.beginPath(); g.ellipse(dX, 50.5 * hu, 1.9 * hu, 2.9 * hu, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(dX + 0.5 * hu, 47.2 * hu, 1.35 * hu, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(dX - 2.2 * hu, 54 * hu); g.lineTo(dX + 2.2 * hu, 54 * hu); g.lineTo(dX + 3.1 * hu, 66 * hu);
    g.lineTo(dX + 5.2 * hu, dy + dh - 0.4 * hu); g.lineTo(dX - 5.2 * hu, dy + dh - 0.4 * hu); g.lineTo(dX - 3.1 * hu, 66 * hu); g.closePath(); g.fill();
    g.fillStyle = PAPER;
    g.fillRect(dX - 1.3 * hu, 56.5 * hu, 2.6 * hu, 6.5 * hu);
    g.beginPath(); g.moveTo(dX - 2.4 * hu, 63 * hu); g.lineTo(dX + 2.4 * hu, 63 * hu); g.lineTo(dX + 3.6 * hu, 77 * hu); g.lineTo(dX - 3.6 * hu, 77 * hu); g.closePath(); g.fill();
    g.fillRect(dX - 3.3 * hu, 62.6 * hu, 6.6 * hu, 0.8 * hu);
    // the two at the door, big and black, framing her: their hats cut into
    // the doorway's light, its rim on their inside edges
    hatMan(g, w * 0.352, h * 1.05, h / 372, 1);
    hatMan(g, w * 0.648, h * 1.04, h / 382, -1);
  },
  // (no words) - the diner's neon through a wet windscreen
  neon(g, w, h, rng) {
    g.fillStyle = '#0b0b0b'; g.fillRect(0, 0, w, h);
    // the neon, soft through the wet glass: the one colour
    g.save();
    g.filter = 'blur(10px)';
    g.strokeStyle = NEON; g.lineWidth = 16; g.lineCap = 'round';
    g.font = `700 ${Math.round(h * 0.26)}px "Avenir Next Condensed", "Arial Narrow", sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.globalAlpha = 0.75;
    g.strokeText('DINER', w * 0.52, h * 0.36);
    g.restore();
    g.save();
    g.strokeStyle = 'rgba(200,228,255,0.9)'; g.lineWidth = 3.5;
    g.font = `700 ${Math.round(h * 0.26)}px "Avenir Next Condensed", "Arial Narrow", sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.strokeText('DINER', w * 0.52, h * 0.36);
    g.restore();
    // its streaks down the glass
    g.fillStyle = 'rgba(111,182,255,0.12)';
    for (let i = 0; i < 14; i++) { const x = w * rng.range(0.32, 0.72); g.fillRect(x, h * 0.42, rng.range(2, 6), h * rng.range(0.1, 0.4)); }
    drops(g, w, h, rng, 90, [3, 9]);
    // the wiper, at rest across the bottom, and the dash's black
    g.fillStyle = INK;
    g.beginPath(); g.moveTo(-20, h * 0.86); g.quadraticCurveTo(w * 0.4, h * 0.7, w * 0.78, h * 0.62); g.lineTo(w * 0.79, h * 0.64); g.quadraticCurveTo(w * 0.4, h * 0.76, -20, h * 0.92); g.closePath(); g.fill();
    g.fillRect(0, h * 0.9, w, h * 0.1);
  },
  // AMES. MARKED. - Ames's card in my wet fingers, the red cross
  ames(g, w, h, rng) {
    cone(g, w * 0.5, -h * 0.2, 0, 0.5, h * 1.4, 0.18);
    // the card, a little turned
    g.save();
    g.translate(w * 0.5, h * 0.48); g.rotate(-0.08);
    const cw = w * 0.5, ch = cw * 0.57;
    g.fillStyle = PAPER; g.fillRect(-cw / 2, -ch / 2, cw, ch);
    g.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 9; i++) blob(g, rng.range(-cw / 2, cw / 2), rng.range(-ch / 2, ch / 2), rng.range(6, 18), rng, 0.3);
    g.fillStyle = '#1a1a1a'; g.textAlign = 'center';
    g.font = `700 ${Math.round(ch * 0.15)}px "American Typewriter", "Courier New", monospace`;
    g.fillText('J. AMES', 0, -ch * 0.12);   // [C4] the card in the hand reads J. AMES (props/kinds/c4.js amesCard)
    g.font = `${Math.round(ch * 0.075)}px "American Typewriter", "Courier New", monospace`;
    g.fillText('PRIVATE INVESTIGATIONS', 0, ch * 0.04);
    g.fillText('HARBOR BLDG.  RM 304', 0, ch * 0.2);   // [C4] as the card
    redCross(g, 0, 0, ch * 0.42, rng, 10);
    g.restore();
    // the fingers on its corners: black, wet
    g.fillStyle = INK;
    g.beginPath(); g.ellipse(w * 0.27, h * 0.66, w * 0.07, h * 0.06, 0.6, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(w * 0.21, h * 0.75, w * 0.11, h * 0.09, 0.5, 0, Math.PI * 2); g.fill();
    g.fillRect(0, h * 0.78, w * 0.3, h * 0.25);
    g.beginPath(); g.ellipse(w * 0.74, h * 0.29, w * 0.06, h * 0.05, -0.4, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(w * 0.82, h * 0.22, w * 0.1, h * 0.07, -0.5, 0, Math.PI * 2); g.fill();
    drops(g, w, h, rng, 40, [2, 5]);
  },
  // DOT'S HAND. - the torn guest check, close: her hand
  check(g, w, h, rng) {
    cone(g, w * 0.45, -h * 0.3, 0.1, 0.45, h * 1.5, 0.22);
    g.save();
    g.translate(w * 0.5, h * 0.52); g.rotate(0.05);
    const cw = w * 0.42, ch = h * 0.78;
    // the slip, its bottom torn
    g.fillStyle = PAPER;
    g.beginPath(); g.moveTo(-cw / 2, -ch / 2); g.lineTo(cw / 2, -ch / 2); g.lineTo(cw / 2, ch * 0.32);
    for (let i = 0; i <= 12; i++) g.lineTo(cw / 2 - (cw * i) / 12, ch * 0.32 + rng.range(-10, 14));
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1.5;
    for (let i = 1; i < 7; i++) { g.beginPath(); g.moveTo(-cw / 2 + 10, -ch / 2 + ch * 0.12 * i); g.lineTo(cw / 2 - 10, -ch / 2 + ch * 0.12 * i); g.stroke(); }
    g.fillStyle = '#222'; g.font = `700 ${Math.round(ch * 0.05)}px "American Typewriter", monospace`; g.fillText('GUEST CHECK', -cw * 0.42, -ch * 0.42);
    // her hand: a pencil's loops
    g.fillStyle = '#101010'; g.font = `italic ${Math.round(ch * 0.095)}px "Snell Roundhand", "Bradley Hand", "Noteworthy", cursive`;
    g.fillText('Pier 9', -cw * 0.38, -ch * 0.2);
    g.fillText('midnight', -cw * 0.34, -ch * 0.06);
    g.fillText('— Dot', -cw * 0.1, ch * 0.12);
    g.restore();
  },
  // SHE SENT HIM TO THEM. - her shape behind the counter, the face lost
  her(g, w, h, rng) {
    // the back bar's light behind her: she is a cut-out of it
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#8d8a84'); gr.addColorStop(0.7, '#d6d3cb'); gr.addColorStop(1, '#2a2a2a');
    g.fillStyle = gr; g.fillRect(0, 0, w, h * 0.7);
    g.fillStyle = INK;
    for (let i = 0; i < 7; i++) { const x = w * (0.08 + i * 0.135); g.fillRect(x, h * 0.18, w * 0.03, h * 0.14); g.fillRect(x - 6, h * 0.17, w * 0.03 + 12, 6); }
    // her: head, the little cap, shoulders, the apron's strings
    g.beginPath(); g.ellipse(w * 0.5, h * 0.36, w * 0.05, h * 0.09, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(w * 0.455, h * 0.29); g.lineTo(w * 0.545, h * 0.29); g.lineTo(w * 0.53, h * 0.25); g.lineTo(w * 0.47, h * 0.25); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(w * 0.37, h * 0.72); g.quadraticCurveTo(w * 0.39, h * 0.5, w * 0.47, h * 0.45); g.lineTo(w * 0.53, h * 0.45); g.quadraticCurveTo(w * 0.61, h * 0.5, w * 0.63, h * 0.72); g.closePath(); g.fill();
    // the counter across the bottom, its edge lit
    g.fillStyle = '#0a0a0a'; g.fillRect(0, h * 0.7, w, h * 0.3);
    g.fillStyle = 'rgba(236,233,225,0.8)'; g.fillRect(0, h * 0.7, w, 4);
  },
  // NOT HIS GIRL. HIS NEXT. - her photograph under the desk lamp, the red cross
  photo(g, w, h, rng) {
    g.fillStyle = '#141414'; g.fillRect(0, 0, w, h);
    const pool = g.createRadialGradient(w * 0.5, h * 0.55, 0, w * 0.5, h * 0.55, w * 0.45);
    pool.addColorStop(0, 'rgba(236,233,225,0.55)'); pool.addColorStop(1, 'rgba(236,233,225,0)');
    g.fillStyle = pool; g.fillRect(0, 0, w, h);
    g.save();
    g.translate(w * 0.5, h * 0.55); g.rotate(0.06);
    const pw = w * 0.3, ph = pw * 1.25;
    g.fillStyle = PAPER; g.fillRect(-pw / 2, -ph / 2, pw, ph);
    g.fillStyle = '#7d7a74'; g.fillRect(-pw / 2 + 12, -ph / 2 + 12, pw - 24, ph - 50);
    g.fillStyle = '#2b2b2b';
    g.beginPath(); g.ellipse(0, -ph * 0.12, pw * 0.17, ph * 0.17, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(-pw * 0.36, ph * 0.33); g.quadraticCurveTo(-pw * 0.3, ph * 0.06, 0, ph * 0.04); g.quadraticCurveTo(pw * 0.3, ph * 0.06, pw * 0.36, ph * 0.33); g.closePath(); g.fill();
    redCross(g, 0, -ph * 0.05, pw * 0.4, rng, 9);
    g.restore();
    // the lamp's shade at the top edge
    g.fillStyle = INK; g.beginPath(); g.moveTo(w * 0.3, -2); g.lineTo(w * 0.7, -2); g.lineTo(w * 0.62, h * 0.08); g.lineTo(w * 0.38, h * 0.08); g.closePath(); g.fill();
  },
  // THE DINER. - my headlamps on the wet avenue, the el above
  avenue(g, w, h, rng) {
    g.fillStyle = '#3a3a3a'; g.fillRect(0, 0, w, h * 0.5);
    // the el: black ironwork across the top, columns down
    g.fillStyle = INK; g.fillRect(0, h * 0.06, w, h * 0.09);
    for (let i = 0; i < 9; i++) { const x = w * (i / 8); g.fillRect(x - 3, h * 0.15, 6, h * 0.06); g.beginPath(); g.moveTo(x - 30, h * 0.15); g.lineTo(x + 30, h * 0.15); g.lineTo(x, h * 0.2); g.fill(); }
    for (const x of [0.12, 0.88]) g.fillRect(w * x - 14, h * 0.15, 28, h * 0.5);
    // the road, black and wet
    g.fillStyle = '#0a0a0a'; g.fillRect(0, h * 0.5, w, h * 0.5);
    // the headlamps' two beams, far down to the vanishing point
    cone(g, w * 0.32, h * 1.05, Math.PI - 0.12, 0.16, h * 0.62, 0.55);
    cone(g, w * 0.68, h * 1.05, Math.PI + 0.12, 0.16, h * 0.62, 0.55);
    // their streaks in the wet
    g.fillStyle = 'rgba(236,233,225,0.4)';
    for (let i = 0; i < 26; i++) { const x = w * rng.range(0.3, 0.7); g.fillRect(x, h * rng.range(0.52, 0.9), rng.range(1, 3), h * rng.range(0.02, 0.08)); }
    // the diner far ahead: a small lit window
    g.fillStyle = PAPER; g.fillRect(w * 0.47, h * 0.42, w * 0.06, h * 0.05);
    g.fillStyle = NEON; g.fillRect(w * 0.48, h * 0.4, w * 0.04, 3);
    rain(g, w, h, rng, { n: 200, a: 0.25 });
  },
  // (no words) - his hat in the wet street, the cigar's ember
  hat(g, w, h, rng) {
    g.fillStyle = '#121212'; g.fillRect(0, 0, w, h);
    const pool = g.createRadialGradient(w * 0.55, h * 0.3, 0, w * 0.55, h * 0.3, w * 0.6);
    pool.addColorStop(0, 'rgba(200,198,190,0.35)'); pool.addColorStop(1, 'rgba(200,198,190,0)');
    g.fillStyle = pool; g.fillRect(0, 0, w, h);
    // the wet: lamp streaks down the ground
    g.fillStyle = 'rgba(236,233,225,0.25)';
    for (let i = 0; i < 18; i++) { const x = w * rng.range(0.1, 0.9); g.fillRect(x, h * rng.range(0.1, 0.5), rng.range(2, 5), h * rng.range(0.2, 0.5)); }
    // the homburg on its side, the brim a pale rim
    g.fillStyle = INK;
    g.beginPath(); g.ellipse(w * 0.5, h * 0.66, w * 0.24, h * 0.09, -0.1, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(w * 0.49, h * 0.55, w * 0.14, h * 0.13, -0.1, Math.PI, 0); g.fill();
    g.fillRect(w * 0.35, h * 0.55, w * 0.28, h * 0.1);
    g.strokeStyle = 'rgba(236,233,225,0.7)'; g.lineWidth = 3;
    g.beginPath(); g.ellipse(w * 0.5, h * 0.66, w * 0.24, h * 0.09, -0.1, Math.PI * 1.05, Math.PI * 1.9); g.stroke();
    // its reflection, broken
    g.fillStyle = 'rgba(5,5,5,0.6)'; for (let i = 0; i < 10; i++) g.fillRect(w * rng.range(0.32, 0.66), h * rng.range(0.76, 0.86), rng.range(14, 50), 3);
    // the cigar, and its ember
    g.save(); g.translate(w * 0.79, h * 0.8); g.rotate(-0.3);
    g.fillStyle = '#1b1b1b'; g.fillRect(-w * 0.08, -5, w * 0.08, 10);
    g.restore();
    const e = g.createRadialGradient(w * 0.79, h * 0.8, 0, w * 0.79, h * 0.8, 22);
    e.addColorStop(0, '#fff1c4'); e.addColorStop(0.3, EMBER); e.addColorStop(1, 'rgba(255,122,26,0)');
    g.fillStyle = e; g.beginPath(); g.arc(w * 0.79, h * 0.8, 22, 0, Math.PI * 2); g.fill();
    rain(g, w, h, rng, { n: 140, a: 0.18 });
  },
};

// The Orpheum's reel (lane O5, brief O5 §2.10): a seat in the dark house
// and a short noir picture on the screen - one panel, held. Blinds' bars of
// light across a room, a man in a hat in the doorway, his shadow longer
// than he is, a woman's shape at the window. No words. (A placeholder of
// flat ink shapes like the base's: a picture can be dropped in at
// public/stills/o5_reel_1.jpg.)
const PAPER = '#ece9e1', INK = '#060606';
function draw(g, w, h, rng) {
  // the room's wall: dark, the blinds' light across it in slanted bars
  g.fillStyle = '#181818'; g.fillRect(0, 0, w, h);
  g.save();
  g.translate(w * 0.62, h * 0.08); g.transform(1, 0.22, -0.35, 1, 0, 0);
  for (let i = 0; i < 9; i++) { g.fillStyle = `rgba(236,233,225,${0.42 - i * 0.02})`; g.fillRect(-w * 0.1, i * h * 0.075, w * 0.55, h * 0.036); }
  g.restore();
  // the floor
  g.fillStyle = '#0b0b0b'; g.fillRect(0, h * 0.78, w, h * 0.22);
  // the doorway, lit from behind: the man in it, his hat, his coat
  g.fillStyle = PAPER; g.fillRect(w * 0.12, h * 0.16, w * 0.17, h * 0.62);
  g.fillStyle = INK;
  const cx = w * 0.205, base = h * 0.78, s = h * 0.56;
  g.beginPath(); g.moveTo(cx - s * 0.17, base); g.lineTo(cx - s * 0.2, base - s * 0.55); g.lineTo(cx - s * 0.13, base - s * 0.78); g.lineTo(cx + s * 0.13, base - s * 0.78); g.lineTo(cx + s * 0.2, base - s * 0.55); g.lineTo(cx + s * 0.17, base); g.closePath(); g.fill();
  g.beginPath(); g.ellipse(cx, base - s * 0.86, s * 0.075, s * 0.09, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(cx, base - s * 0.93, s * 0.16, s * 0.025, 0, 0, Math.PI * 2); g.fill();
  g.fillRect(cx - s * 0.08, base - s * 1.03, s * 0.16, s * 0.1);
  // his shadow, long across the floor toward us
  g.fillStyle = 'rgba(0,0,0,0.85)';
  g.beginPath(); g.moveTo(cx - s * 0.17, base); g.lineTo(cx + s * 0.17, base); g.lineTo(w * 0.62, h); g.lineTo(w * 0.36, h); g.closePath(); g.fill();
  // the woman at the window: a slim black shape against the blinds, her hand at the cord
  const wx = w * 0.78, wb = h * 0.78, ws = h * 0.5;
  g.fillStyle = INK;
  g.beginPath(); g.moveTo(wx - ws * 0.12, wb); g.lineTo(wx - ws * 0.07, wb - ws * 0.6); g.lineTo(wx - ws * 0.1, wb - ws * 0.78); g.lineTo(wx + ws * 0.1, wb - ws * 0.78); g.lineTo(wx + ws * 0.06, wb - ws * 0.6); g.lineTo(wx + ws * 0.14, wb); g.closePath(); g.fill();
  g.beginPath(); g.ellipse(wx, wb - ws * 0.86, ws * 0.07, ws * 0.085, 0, 0, Math.PI * 2); g.fill();
  g.lineWidth = 3; g.strokeStyle = INK; g.beginPath(); g.moveTo(wx + ws * 0.09, wb - ws * 0.72); g.lineTo(wx + ws * 0.2, wb - ws * 0.95); g.stroke();
  // a cigarette's smoke from the doorway, grey
  g.strokeStyle = 'rgba(200,200,195,0.35)'; g.lineWidth = 2;
  g.beginPath(); for (let i = 0; i < 40; i++) { const t = i / 39; const x = cx + s * 0.06 + Math.sin(t * 9 + rng.next()) * 6 + t * 30, y = base - s * 0.8 - t * h * 0.22; if (i) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke();
}
export default {
  panels: [
    { img: 'stills/o5_reel_1.jpg', draw, caption: null, secs: 4.2, aspect: 1.6, from: { s: 1.0, x: 0, y: 0 }, to: { s: 1.06, x: 0.01, y: 0 } },
  ],
};

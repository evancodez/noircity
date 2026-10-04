// The revolver's count (lane B3): a small inked cylinder face, bottom right,
// only while the gun is in the hand (the weapon draws it into its HUD layer,
// hud.layer('revolver')). Six chambers round the pin: a live round is a
// paper-white case head with its primer, a spent one a dark head in a thin
// ring, an empty one a black hole. The face turns as the cylinder does; the
// notch at the top is the hammer's (the next chamber to fire under it).
// (no default export: not a weapon)
const NS = 'http://www.w3.org/2000/svg';
// a hand-inked outline: the cylinder's edge, scalloped by its six flutes,
// its line wobbling and thickening like a brush's (fixed jitter)
function outline() {
  const pts = [];
  const N = 96;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    // (a flute between each pair of chambers: 30 degrees off each chamber)
    const flute = Math.pow(Math.max(0, Math.cos((a - Math.PI / 6) * 6)), 8);
    const wob = Math.sin(i * 2.3) * 0.5 + Math.sin(i * 0.7 + 1) * 0.7;
    const r = 43 - 5.5 * flute + wob * 0.35;
    pts.push([Math.sin(a) * r, -Math.cos(a) * r]);
  }
  return 'M' + pts.map(([x, y]) => x.toFixed(1) + ' ' + y.toFixed(1)).join(' L') + ' Z';
}
const OUTLINE = outline();

// [C13] the pocket beside the cylinder: the rounds in the coat as rows of six
// little inked cartridges (a row is a reload's worth), the top row the one
// being spent - its gone rounds greyed hollow; nothing in the pocket, one row
// all hollow. An endless pocket (a test bed) draws nothing.
const SH = { w: 7.5, h: 18, gap: 4, row: 22 };
function drawPocket(el, pocket) {
  let svg = el.querySelector('svg.rvp');
  if (!Number.isFinite(pocket)) { if (svg) svg.remove(); return; }
  if (!svg) {
    svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'rvp');
    svg.style.cssText = 'position:absolute; right:128px; bottom:34px; overflow:visible; filter: drop-shadow(0 0 1.5px #000) drop-shadow(0 0 3px rgba(0,0,0,0.7)); transition: opacity 0.3s;';
    el.appendChild(svg);
  }
  const p = Math.max(0, Math.floor(pocket));
  const rows = Math.min(4, Math.max(1, Math.ceil(p / 6)));
  const top = p === 0 ? 0 : p - 6 * (rows - 1);   // rounds in the top row (1..6; more than 24: all full)
  const W = 6 * SH.w + 5 * SH.gap, H = rows * SH.row;
  svg.setAttribute('viewBox', `-2 -2 ${W + 4} ${H + 2}`);
  svg.setAttribute('width', String(W + 4)); svg.setAttribute('height', String(H + 2));
  let out = '';
  for (let r = 0; r < rows; r++) {
    // (r 0 the top row on the screen)
    const n = r === 0 ? Math.min(6, top) : 6;
    const y = r * SH.row;
    for (let i = 0; i < 6; i++) {
      const x = i * (SH.w + SH.gap) + (i % 2 ? 0.3 : -0.2);
      const live = i < n;
      // the case and its rim, the bullet's round nose (a brush's slight lean)
      const nose = `M ${x.toFixed(1)} ${(y + 6).toFixed(1)} Q ${(x + SH.w / 2).toFixed(1)} ${(y - 2).toFixed(1)} ${(x + SH.w).toFixed(1)} ${(y + 6).toFixed(1)} Z`;
      if (live) out += `<rect x="${x.toFixed(1)}" y="${(y + 6).toFixed(1)}" width="${SH.w}" height="${SH.h - 6}" fill="#e9e7e1" stroke="#0b0b0b" stroke-width="0.8"/>`
        + `<path d="${nose}" fill="#bdbab2" stroke="#0b0b0b" stroke-width="0.8"/>`
        + `<rect x="${(x - 0.6).toFixed(1)}" y="${(y + SH.h - 1.6).toFixed(1)}" width="${SH.w + 1.2}" height="1.8" fill="#e9e7e1"/>`;
      else out += `<rect x="${x.toFixed(1)}" y="${(y + 6).toFixed(1)}" width="${SH.w}" height="${SH.h - 6}" fill="#111" stroke="#5c5a56" stroke-width="1"/>`
        + `<path d="${nose}" fill="#111" stroke="#5c5a56" stroke-width="1"/>`;
    }
  }
  svg.innerHTML = out;
}

export function drawCount(el, { chambers, top, turn, fading, pocket = Infinity }) {
  let svg = el.querySelector('svg.rv');
  if (!svg) {
    el.innerHTML = '';
    svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'rv');
    svg.setAttribute('viewBox', '-52 -58 104 110');
    svg.setAttribute('width', '84');
    svg.setAttribute('height', '89');
    svg.style.cssText = 'position:absolute; right:36px; bottom:30px; overflow:visible; filter: drop-shadow(0 0 1.5px #000) drop-shadow(0 0 3px rgba(0,0,0,0.7)); transition: opacity 0.3s;';
    svg.innerHTML = `
      <g class="face">
        <path d="${OUTLINE}" fill="#0b0b0b" stroke="#e9e7e1" stroke-width="3.2" stroke-linejoin="round"/>
        <path d="${OUTLINE}" fill="none" stroke="#0b0b0b" stroke-width="1.1" stroke-dasharray="7 11 3 9" transform="scale(0.93)" opacity="0.8"/>
        <circle r="5.2" fill="#e9e7e1"/><circle r="2.2" fill="#0b0b0b"/>
        <g class="ch"></g>
      </g>
      <path d="M -6 -56 L 6 -56 L 0 -47 Z" fill="#e9e7e1"/>`;
    el.appendChild(svg);
    const g = svg.querySelector('.ch');
    for (let i = 0; i < 6; i++) {
      const c = document.createElementNS(NS, 'g');
      const th = i * Math.PI / 3;
      // (chamber i sits i * 60 degrees counter-clockwise from the top as the
      // shooter sees the rear face: the gun's own order)
      c.setAttribute('transform', `translate(${(-Math.sin(th) * 26).toFixed(2)} ${(-Math.cos(th) * 26).toFixed(2)})`);
      c.innerHTML = '<circle class="rim" r="10.5"/><circle class="head" r="8"/><circle class="pr" r="2.6"/>';
      g.appendChild(c);
    }
  }
  const face = svg.querySelector('.face');
  // (the cylinder turned by `turn` brings chamber turn/60 under the notch)
  face.setAttribute('transform', `rotate(${(turn * 180 / Math.PI).toFixed(2)})`);
  const cs = svg.querySelectorAll('.ch > g');
  cs.forEach((c, i) => {
    const s = chambers[i];
    const rim = c.children[0], head = c.children[1], pr = c.children[2];
    if (s === 'live') {
      rim.setAttribute('fill', '#e9e7e1'); head.setAttribute('fill', '#d9d6ce'); head.setAttribute('stroke', '#0b0b0b'); head.setAttribute('stroke-width', '1');
      pr.setAttribute('fill', '#3a3a3a'); pr.style.display = '';
    } else if (s === 'spent') {
      rim.setAttribute('fill', '#6a6864'); head.setAttribute('fill', '#161616'); head.setAttribute('stroke', 'none');
      pr.setAttribute('fill', '#6a6864'); pr.style.display = '';
    } else {
      rim.setAttribute('fill', '#2a2a2a'); head.setAttribute('fill', '#000'); head.setAttribute('stroke', 'none');
      pr.style.display = 'none';
    }
  });
  svg.style.opacity = fading ? '0' : '1';
  drawPocket(el, pocket);
  const ps = el.querySelector('svg.rvp');
  if (ps) ps.style.opacity = fading ? '0' : '1';
  void top;
}

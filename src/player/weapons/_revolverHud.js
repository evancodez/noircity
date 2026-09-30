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

export function drawCount(el, { chambers, top, turn, fading }) {
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
  void top;
}

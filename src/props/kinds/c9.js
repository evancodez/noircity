import * as THREE from 'three';
import { std, lathe, slab, tubeAlong, mergeGeos, V3 } from '../lib.js';

// [C9] The stills' own things (docs/story/briefs/C9_STILLS.md), the same
// objects in a panel and in play:
//   dotPhoto    Dot's photograph on the Cardinal's desk (chapter VII, lane C7
//               puts it there; the `photo` still is it under his lamp): a
//               9 x 12.5 cm print with a white border, a waitress in her cap
//               and apron behind a counter, her face lost in the print's
//               shadow, crossed through in the crew's red by the hand that
//               crossed Ames's card (props/kinds/c4.js: the same grease
//               pencil, the same two strokes). Lies face up, its head toward
//               -z, read from +z (as the check and the card).
//               drawDotPhoto(g, W, H, { crossed }) draws it on any 2D context.
//   deskPhone   a black bakelite desk telephone (the base and its cradle,
//               the handset on it unless variant 'empty'): the opening
//               still's (A TIP. AMES.)
//   handset     the handset alone (the opening still has it lying on its side on the desk): along z, the ear
//               cup at -z, the cups' mouths down (-y); its grip the bar's middle
const CREW_RED = '#c40f2c';

function rnd(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }

// the grease pencil's cross (as drawAmesCard's: two strokes corner to corner,
// pressed hard, waxy, skipping on the paper's tooth, multiplied over the print)
export function crewCross(g, x0, y0, x1, y1, x2, y2, x3, y3, K, seed = 911) {
  const r = rnd(seed);
  g.save();
  g.globalCompositeOperation = 'multiply';
  const stroke = (ax, ay, bx, by, w) => {
    const L = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / L, uy = (by - ay) / L, nx = -uy, ny = ux;
    for (let k = 0; k < 26; k++) {
      const off = (k / 25 - 0.5) * w;
      g.strokeStyle = CREW_RED; g.globalAlpha = 0.55 + 0.4 * r(); g.lineWidth = (3 + 4 * r()) * K; g.lineCap = 'round';
      g.beginPath();
      let on = false;
      for (let s = 0; s <= 1.0001; s += 0.02) {
        const skip = r() < 0.05;
        const wob = Math.sin(s * 9 + k) * 2.5 * K;
        const x = ax + ux * L * s + nx * (off + wob), y = ay + uy * L * s + ny * (off + wob);
        if (skip) { on = false; continue; }
        if (!on) { g.moveTo(x, y); on = true; } else g.lineTo(x, y);
      }
      g.stroke();
    }
    g.globalAlpha = 1;
  };
  stroke(x0, y0, x1, y1, 34 * K);
  stroke(x2, y2, x3, y3, 32 * K);
  g.restore();
}

// the photograph: a print of the diner's back bar, she in the middle of it,
// turned a little away, the cap's white and the apron's white the brightest
// things in it; her face in the shadow of the print (a dark soft oval, a rim
// of light along the cheek, nothing more)
export function drawDotPhoto(g, W, H, { crossed = true, seed = 4417 } = {}) {
  const r = rnd(seed);
  const K = W / 720;
  // the paper, its white border
  g.fillStyle = '#eee9dc'; g.fillRect(0, 0, W, H);
  const bx = 34 * K, by = 34 * K, bw = W - 68 * K, bh = H - 120 * K;
  g.save();
  g.beginPath(); g.rect(bx, by, bw, bh); g.clip();
  // the print: the back bar's light behind her (a pale band), dark below
  let gr = g.createLinearGradient(0, by, 0, by + bh);
  gr.addColorStop(0, '#3b3a37'); gr.addColorStop(0.3, '#8d8a83'); gr.addColorStop(0.48, '#a9a59d'); gr.addColorStop(0.62, '#5e5b56'); gr.addColorStop(1, '#1d1c1b');
  g.fillStyle = gr; g.fillRect(bx, by, bw, bh);
  // the shelves' bottles, soft
  g.fillStyle = 'rgba(30,30,28,0.55)';
  for (let i = 0; i < 9; i++) {
    const x = bx + bw * (0.05 + i * 0.11 + r() * 0.03), w = bw * (0.035 + r() * 0.02), h = bh * (0.09 + r() * 0.05);
    g.beginPath(); g.roundRect(x, by + bh * 0.42 - h, w, h, w * 0.3); g.fill();
  }
  g.fillStyle = 'rgba(25,25,24,0.7)'; g.fillRect(bx, by + bh * 0.42, bw, bh * 0.018);
  // her: the head turned a little to her left, the shoulders, the dark dress
  const cx = bx + bw * 0.52, hy = by + bh * 0.3;
  g.fillStyle = '#1b1a19';
  // shoulders and dress
  g.beginPath();
  g.moveTo(cx - bw * 0.3, by + bh);
  g.bezierCurveTo(cx - bw * 0.31, hy + bh * 0.28, cx - bw * 0.2, hy + bh * 0.17, cx - bw * 0.07, hy + bh * 0.15);
  g.lineTo(cx + bw * 0.08, hy + bh * 0.15);
  g.bezierCurveTo(cx + bw * 0.21, hy + bh * 0.17, cx + bw * 0.31, hy + bh * 0.28, cx + bw * 0.3, by + bh);
  g.closePath(); g.fill();
  // the neck, in shadow
  g.fillStyle = '#2a2826';
  g.beginPath(); g.moveTo(cx - bw * 0.045, hy + bh * 0.08); g.lineTo(cx + bw * 0.05, hy + bh * 0.08); g.lineTo(cx + bw * 0.06, hy + bh * 0.16); g.lineTo(cx - bw * 0.055, hy + bh * 0.16); g.fill();
  // the hair: dark, a roll over the brow and the curl at her temple
  g.fillStyle = '#121211';
  g.beginPath(); g.ellipse(cx + bw * 0.005, hy - bh * 0.005, bw * 0.12, bh * 0.105, -0.12, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(cx - bw * 0.09, hy + bh * 0.06, bw * 0.05, bh * 0.07, 0.3, 0, Math.PI * 2); g.fill();
  // the face, lost: a soft dark oval a shade off the hair, the cheek's rim of light
  gr = g.createRadialGradient(cx + bw * 0.02, hy + bh * 0.03, bw * 0.01, cx + bw * 0.02, hy + bh * 0.03, bw * 0.1);
  gr.addColorStop(0, '#2e2c2a'); gr.addColorStop(1, '#191817');
  g.fillStyle = gr;
  g.beginPath(); g.ellipse(cx + bw * 0.022, hy + bh * 0.035, bw * 0.072, bh * 0.072, -0.12, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(200,196,186,0.55)'; g.lineWidth = 3 * K;
  g.beginPath(); g.ellipse(cx + bw * 0.022, hy + bh * 0.035, bw * 0.072, bh * 0.072, -0.12, -0.5, 0.75); g.stroke();
  // the curl: one loop of dark hair on her brow
  g.strokeStyle = '#0c0c0b'; g.lineWidth = 7 * K; g.lineCap = 'round';
  g.beginPath(); g.arc(cx - bw * 0.035, hy - bh * 0.025, bw * 0.03, Math.PI * 0.2, Math.PI * 1.75); g.stroke();
  // the cap: a small white crescent pinned on top, its pleats
  g.fillStyle = '#e6e2d8';
  g.beginPath(); g.ellipse(cx + bw * 0.01, hy - bh * 0.085, bw * 0.085, bh * 0.032, -0.12, Math.PI, 0); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(80,78,72,0.6)'; g.lineWidth = 2 * K;
  for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(cx + bw * (0.01 + i * 0.022), hy - bh * 0.087); g.lineTo(cx + bw * (0.012 + i * 0.026), hy - bh * 0.112); g.stroke(); }
  // the collar's white points
  g.fillStyle = '#d9d5cb';
  g.beginPath(); g.moveTo(cx - bw * 0.06, hy + bh * 0.15); g.lineTo(cx, hy + bh * 0.2); g.lineTo(cx - bw * 0.012, hy + bh * 0.15); g.fill();
  g.beginPath(); g.moveTo(cx + bw * 0.07, hy + bh * 0.15); g.lineTo(cx + bw * 0.01, hy + bh * 0.2); g.lineTo(cx + bw * 0.022, hy + bh * 0.15); g.fill();
  // the apron: its bib and its skirt, the bright shape of the picture
  g.fillStyle = '#ece8de';
  g.beginPath(); g.moveTo(cx - bw * 0.075, hy + bh * 0.26); g.lineTo(cx + bw * 0.085, hy + bh * 0.26); g.lineTo(cx + bw * 0.09, hy + bh * 0.42); g.lineTo(cx - bw * 0.08, hy + bh * 0.42); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(cx - bw * 0.16, hy + bh * 0.42); g.lineTo(cx + bw * 0.17, hy + bh * 0.42); g.lineTo(cx + bw * 0.22, by + bh); g.lineTo(cx - bw * 0.21, by + bh); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(120,116,108,0.5)'; g.lineWidth = 2.5 * K;
  for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(cx + bw * (-0.1 + i * 0.07), hy + bh * 0.44); g.lineTo(cx + bw * (-0.13 + i * 0.09), by + bh); g.stroke(); }
  // the bib's straps over the shoulders
  g.strokeStyle = '#e2ded3'; g.lineWidth = 9 * K;
  g.beginPath(); g.moveTo(cx - bw * 0.07, hy + bh * 0.26); g.lineTo(cx - bw * 0.1, hy + bh * 0.17); g.stroke();
  g.beginPath(); g.moveTo(cx + bw * 0.08, hy + bh * 0.26); g.lineTo(cx + bw * 0.11, hy + bh * 0.17); g.stroke();
  // the counter's edge across the bottom, a coffee pot's glint at her side
  g.fillStyle = '#0f0f0e'; g.fillRect(bx, by + bh * 0.86, bw, bh * 0.14);
  g.fillStyle = 'rgba(230,226,216,0.5)'; g.fillRect(bx, by + bh * 0.86, bw, 3 * K);
  // the print's grain and its vignette
  for (let i = 0; i < (bw * bh) / (90 * K * K); i++) {
    const v = r() < 0.5 ? 0 : 255;
    g.fillStyle = `rgba(${v},${v},${v},${(0.07 * r()).toFixed(3)})`;
    g.fillRect(bx + r() * bw, by + r() * bh, 1.5 * K, 1.5 * K);
  }
  gr = g.createRadialGradient(cx, by + bh * 0.45, bw * 0.2, cx, by + bh * 0.45, bw * 0.8);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.55)');
  g.fillStyle = gr; g.fillRect(bx, by, bw, bh);
  g.restore();
  // the paper's own grain on the border; a pencilled date on it
  for (let i = 0; i < (W * H) / 400; i++) {
    const v = r() < 0.5 ? 0 : 255;
    g.fillStyle = `rgba(${v},${v},${v},${(0.04 * r()).toFixed(3)})`;
    g.fillRect(r() * W, r() * H, 2, 2);
  }
  if (!crossed) return;
  // the cross: from her shoulders to the corners, through her
  crewCross(g, bx + 30 * K, by + 40 * K, bx + bw - 26 * K, by + bh - 30 * K, bx + bw - 20 * K, by + 52 * K, bx + 34 * K, by + bh - 20 * K, K, 912);
}

const bake = (key, color, rough, surface) => std('c9_' + key, { color, roughness: rough, surface });

export const SPECS = {
  dotPhoto() {
    const W = 720, H = 1000;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    drawDotPhoto(c.getContext('2d'), W, H);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    // (unlit, as the card and the check: under a lamp a lit face printed its
    // greys white; the red and the print read as they are drawn)
    const face = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.9, 0.9), map: tex });
    face.name = 'prop_dotPhoto';
    face.userData.inkSurface = 'paper';
    const w = 0.09, d = 0.125, t = 0.0005;
    const body = slab(w, t, d, { bevel: t * 0.4, corner: 0.002, seg: 1, curve: 3 });
    const top = new THREE.PlaneGeometry(w - 0.0004, d - 0.0004).rotateX(-Math.PI / 2).translate(0, t + 0.0008, 0);
    return {
      parts: [{ geo: body, mat: bake('photoBack', 0xc9c4b8, 0.95, 'paper'), id: 0 }, { geo: top, mat: face, id: 0, cast: false, name: 'face' }],
      grip: [0.035, 0.0003, 0.04], accent: 'crew',
      init(g, ud) { ud.canvas = c; ud.crossed = true; },
    };
  },
  handset() {
    return { parts: handsetParts(), grip: [0, 0.008, 0] };
  },
  // a desk lamp: a weighted foot, a stem, a cone of a shade tipped down
  // toward +z, the bulb's white in its mouth (userData.head: the bulb, in
  // the lamp's frame; userData.axis: where the shade points)
  deskLamp() {
    const iron = bake('lampIron', 0x101010, 0.4, 'metal');
    const parts = [];
    parts.push({ geo: lathe([[0.0001, 0], [0.085, 0], [0.087, 0.012], [0.07, 0.03], [0.02, 0.04], [0.0001, 0.042]], 40), mat: iron, id: 0 });
    parts.push({ geo: new THREE.CylinderGeometry(0.008, 0.009, 0.34, 10).translate(0, 0.21, 0), mat: iron, id: 0 });
    parts.push({ geo: tubeAlong([V3(0, 0.375, 0), V3(0, 0.41, 0.03), V3(0, 0.4, 0.08)], 0.007, 8, 12), mat: iron, id: 0 });
    // the shade: a cone, its mouth down and forward (40 degrees off straight down)
    const shade = lathe([[0.012, 0.13], [0.03, 0.125], [0.06, 0.09], [0.088, 0.03], [0.095, 0.0], [0.091, -0.004]].reverse(), 40).rotateX(-0.7).translate(0, 0.335, 0.11);
    parts.push({ geo: shade, mat: bake('lampShade', 0x0c0c0c, 0.35, 'enamel'), id: 1 });
    const inner = lathe([[0.012, 0.12], [0.055, 0.085], [0.085, 0.025], [0.09, 0.003]], 36).rotateX(-0.7).translate(0, 0.335, 0.11);
    const innerMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.75, 0.75, 0.75), side: THREE.DoubleSide });
    innerMat.name = 'prop_c9_lampInner'; innerMat.userData.inkSurface = 'lit';
    parts.push({ geo: inner, mat: innerMat, id: 1, cast: false });
    const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 9, 9) });
    bulbMat.name = 'prop_c9_bulb'; bulbMat.userData.inkSurface = 'lit';
    parts.push({ geo: new THREE.SphereGeometry(0.026, 16, 10).translate(0, 0.36, 0.092), mat: bulbMat, id: 1, cast: false });
    return {
      parts, grip: [0, 0.2, 0],
      init(g, ud) { ud.head = new THREE.Vector3(0, 0.33, 0.115); ud.axis = new THREE.Vector3(0, -Math.cos(0.7), Math.sin(0.7)).normalize(); },
    };
  },
  deskPhone(v) {
    const B = bake('bakelite', 0x0b0b0b, 0.25, 'enamel');
    const parts = [];
    // the base: a low sloped dome, the dial on its front face
    const base = lathe([[0.0001, 0.0], [0.105, 0.0], [0.106, 0.012], [0.095, 0.03], [0.07, 0.068], [0.045, 0.082], [0.0001, 0.085]], 48).scale(1, 1, 1.18);
    parts.push({ geo: base, mat: B, id: 0 });
    // the dial: a ring of finger holes on the sloped front (a pale card in its middle)
    const dial = new THREE.CylinderGeometry(0.036, 0.038, 0.008, 40).rotateX(Math.PI / 2 - 0.62).translate(0, 0.052, 0.088);
    parts.push({ geo: dial, mat: bake('dialRing', 0x121212, 0.45, 'metal'), id: 1 });
    const card = new THREE.CircleGeometry(0.013, 24).rotateX(-0.62).translate(0, 0.053, 0.0935);
    parts.push({ geo: card, mat: bake('dialCard', 0x9a9a9a, 0.9, 'paper'), id: 1, cast: false });
    // the cradle: two prongs standing up off the back of the dome
    for (const s of [-1, 1]) parts.push({ geo: new THREE.CylinderGeometry(0.009, 0.011, 0.05, 12).translate(s * 0.062, 0.095, -0.012), mat: B, id: 0 });
    parts.push({ geo: new THREE.BoxGeometry(0.14, 0.012, 0.03).translate(0, 0.084, -0.012), mat: B, id: 0 });
    if (v !== 'empty') {
      // the handset on the cradle, across it
      for (const p of handsetParts()) parts.push({ ...p, geo: p.geo.clone().rotateY(Math.PI / 2).translate(0, 0.122, -0.012), id: 2 });
    }
    return { parts, grip: [0, 0.04, 0] };
  },
};

function handsetParts() {
  const B = bake('bakelite', 0x0b0b0b, 0.25, 'enamel');
  // the bar: a flattened tube bowed a little toward the face (-y)
  const bar = tubeAlong([V3(0, -0.006, -0.088), V3(0, 0.004, -0.04), V3(0, 0.008, 0), V3(0, 0.004, 0.04), V3(0, -0.006, 0.088)], 0.0135, 14, 32).scale(1.25, 0.82, 1);
  // the cups: the receiver (ear) at -z, the transmitter (mouth) at +z, their mouths down
  const cup = (r, h) => lathe([[0.0001, 0.0], [r * 0.55, 0.0], [r * 0.92, -h * 0.25], [r, -h * 0.7], [r * 0.96, -h], [r * 0.8, -h * 1.02], [r * 0.4, -h * 0.9], [0.0001, -h * 0.85]], 36);
  const ear = cup(0.029, 0.03).translate(0, -0.002, -0.096);
  const mouth = cup(0.026, 0.028).rotateX(-0.35).translate(0, -0.004, 0.096);
  return [{ geo: mergeGeos([bar, ear, mouth]), mat: B, id: 0 }];
}

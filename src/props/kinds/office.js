import * as THREE from 'three';
import { PM, slab, lathe, mergeGeos } from '../lib.js';

// Room 304's things for the hands (lane B2): the pencil (its lead's side
// rubbed across the pad), the torn sheet (the numbers, in the left hand),
// the ledger (red: the crew's; columns and sums, a black bird stamped by
// the big ones).
// Frames as the library's: the origin the middle of the base, +y up, +z
// the front; grip where the palm holds it.

// the ledger's pages: ruled columns, figures in a bookkeeper's hand, and
// the bird by the big sums
let PAGES = null;
function pagesCanvas() {
  if (PAGES) return PAGES;
  const c = document.createElement('canvas'); c.width = 512; c.height = 360;
  const g = c.getContext('2d');
  for (let s = 0; s < 2; s++) {
    const x0 = s * 256;
    g.fillStyle = '#e4e1d8'; g.fillRect(x0, 0, 256, 360);
    // the rules: a header band, columns
    g.fillStyle = '#3a3936';
    g.fillRect(x0 + 10, 34, 236, 2);
    for (const cx of [60, 150, 196]) g.fillRect(x0 + cx, 24, 2.5, 326);
    for (let y = 50; y < 350; y += 14) g.fillRect(x0 + 10, y, 236, 1.2);
    // a heading, dates and names as dashes, the sums in figures
    g.fillStyle = '#1c1c1c';
    g.font = 'bold 15px Georgia, serif';
    g.fillText(s ? 'PIER 9  -  DOCK' : 'CARDINAL CLUB', x0 + 14, 22);
    g.font = 'bold italic 12px Georgia, serif';
    let seed = 13 + s * 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let r = 0; r < 20; r++) {
      const y = 60 + r * 14;
      g.fillRect(x0 + 14, y - 5, 20 + rnd() * 20, 2.6);
      g.fillRect(x0 + 66, y - 5, 40 + rnd() * 40, 2.6);
      const amt = Math.floor(rnd() * 900 + 40) + (rnd() > 0.8 ? Math.floor(rnd() * 9) * 1000 : 0);
      g.fillText(String(amt) + '.00', x0 + 154, y);
      const big = amt >= 1000;
      if (big) {
        // the stamp: a small black bird by the sum
        g.save(); g.translate(x0 + 224, y - 5); g.scale(0.3, 0.3);
        g.beginPath(); g.moveTo(-30, 20); g.bezierCurveTo(-20, -8, 4, -18, 18, -14); g.lineTo(26, -30); g.lineTo(24, -12); g.lineTo(36, -8); g.lineTo(24, -2);
        g.bezierCurveTo(26, 16, 10, 28, -8, 30); g.lineTo(-40, 44); g.lineTo(-34, 30); g.closePath(); g.fill();
        g.restore();
      }
    }
    g.fillRect(x0 + 150, 336, 44, 1.5);
    g.font = 'bold italic 12px Georgia, serif';
    g.fillText(s ? '41,760.00' : '38,215.00', x0 + 150, 350);
  }
  PAGES = c;
  return c;
}

export const SPECS = {
  // a hexagonal pencil, sharpened, 17 cm, lying along +z (the point at +z)
  pencil(v, lod) {
    const P = PM();
    const R = 0.0038, L = 0.15;
    const body = new THREE.CylinderGeometry(R, R, L, 6, 1).rotateX(Math.PI / 2).translate(0, R, -0.01);
    const cone = lathe([[R * 0.98, 0], [R * 0.5, 0.014], [0.0012, 0.02]], 12).rotateX(Math.PI / 2).translate(0, R, L / 2 - 0.01);
    const lead = lathe([[0.0013, 0], [0.0008, 0.005], [0.0001, 0.007]], 10).rotateX(Math.PI / 2).translate(0, R, L / 2 + 0.01);
    const ferrule = new THREE.CylinderGeometry(R * 1.05, R * 1.05, 0.012, 12).rotateX(Math.PI / 2).translate(0, R, -L / 2 - 0.016);
    const rubber = lathe([[R, 0], [R, 0.006], [R * 0.7, 0.009], [0.0001, 0.0095]], 12).rotateX(-Math.PI / 2).translate(0, R, -L / 2 - 0.022);
    return {
      parts: [
        { geo: body, mat: P.paperLight, id: 0 },
        { geo: cone, mat: P.cork, id: 1 },
        { geo: lead, mat: P.black, id: 1 },
        { geo: ferrule, mat: P.brass, id: 2 },
        { geo: rubber, mat: P.dark, id: 2 },
      ],
      // (held a third of the way from the point)
      grip: [0, R, 0.025],
    };
  },
  // the sheet torn off the pad: 21.5 x 28 cm, lying flat, its top edge
  // ragged; the scene gives it the pad's own drawing (userData.setPaper)
  padSheet(v, lod) {
    const P = PM();
    const g = new THREE.PlaneGeometry(0.215, 0.28, 6, 8).rotateX(-Math.PI / 2);
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) { const z = p.getZ(i), x = p.getX(i); p.setY(i, 0.0015 + 0.006 * Math.pow(Math.abs(x) / 0.1075, 2) * 0.5 + (z < -0.13 ? 0.002 * Math.sin(x * 140) : 0)); }
    g.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, side: THREE.DoubleSide });
    mat.name = 'prop_paper';
    return {
      parts: [{ geo: g, mat, id: 0, name: 'sheet', keep: true }],
      grip: [-0.095, 0.002, 0.03],
      init(grp, ud, by) {
        ud.setPaper = (tex) => { by.sheet.material.map = tex; by.sheet.material.needsUpdate = true; };
        // (in a left hand the hands mirror what they hold: the sheet is
        // mirrored back, so its figures read)
        ud.leftHanded = (on) => { by.sheet.scale.x = on ? -1 : 1; };
      },
    };
  },
  // the ledger: a heavy account book, its boards red (the crew's), a black
  // bird blind-stamped on the front; setOpen(0..1) opens it like a book
  ledger(v, lod) {
    const P = PM();
    const w = 0.21, d = 0.3, t = 0.038;
    const back = slab(w, 0.006, d, { bevel: 0.002, corner: 0.006 });
    const block = slab(w - 0.012, t - 0.012, d - 0.012, { bevel: 0.001, corner: 0.003 }).translate(0.003, 0.006, 0);
    const spine = new THREE.CylinderGeometry(t / 2, t / 2, d, 16, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).translate(-w / 2, t / 2, 0);
    // the front board: its hinge at the spine (x = -w/2), built round the hinge
    const front = slab(w, 0.006, d, { bevel: 0.002, corner: 0.006 }).translate(w / 2, 0, 0);
    // the bird on the front (a small dark shape pressed into the board)
    const s = new THREE.Shape();
    s.moveTo(-0.03, 0.02); s.bezierCurveTo(-0.02, -0.008, 0.004, -0.018, 0.018, -0.014); s.lineTo(0.026, -0.03); s.lineTo(0.024, -0.012);
    s.lineTo(0.036, -0.008); s.lineTo(0.024, -0.002); s.bezierCurveTo(0.026, 0.016, 0.01, 0.028, -0.008, 0.03); s.lineTo(-0.04, 0.044); s.lineTo(-0.034, 0.03);
    const bird = new THREE.ShapeGeometry(s, 6).rotateX(-Math.PI / 2).scale(0.8, 1, 0.8).translate(w / 2, 0.0062, -0.04);
    // the pages as they show when it is open: the right page on the block's
    // top, the left on the inside of the front board (it turns up as it opens)
    const tex = new THREE.CanvasTexture(pagesCanvas());
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const pm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, map: tex });
    pm.name = 'prop_paper';
    // (held up in the inspection, not in a hand: it prints as paper by its own tag)
    pm.userData.inkSurface = 'paper';
    const half = (u0, u1) => { const g = new THREE.PlaneGeometry(w - 0.02, d - 0.02); const uv = g.getAttribute('uv'); for (let i = 0; i < uv.count; i++) uv.setX(i, u0 + uv.getX(i) * (u1 - u0)); return g; };
    // (the right page: its top edge toward -z, read from +z with +x to the right)
    const right = half(0.5, 1).rotateX(-Math.PI / 2).translate(0.003, t - 0.0025, 0);
    // (the left page: on the board's inside face, which faces down while it is shut)
    const left = half(0, 0.5).rotateX(Math.PI / 2).rotateY(Math.PI).translate(w / 2, -0.003, 0);
    return {
      parts: [
        { geo: back, mat: P.crew, id: 0 },
        { geo: block, mat: P.paperLight, id: 1 },
        { geo: spine, mat: P.crew, id: 0 },
        { geo: front, mat: P.crew, id: 2, name: 'cover', pivot: [-w / 2, t - 0.006, 0] },
        { geo: bird, mat: P.black, id: 2, parent: 'cover', cast: false },
        { geo: right, mat: pm, id: 3, cast: false },
        { geo: left, mat: pm, id: 3, parent: 'cover', cast: false },
      ],
      grip: [0.05, t / 2, 0.02], accent: 'crew',
      init(grp, ud, by) {
        ud.open = 0;
        // (open: the front board over to the left, flat; the pages show)
        ud.setOpen = (k) => {
          ud.open = Math.max(0, Math.min(1, k));
          const e = ud.open * ud.open * (3 - 2 * ud.open);
          by.cover.rotation.z = e * Math.PI;
        };
        ud.setOpen(0);
      },
    };
  },
};
void mergeGeos;

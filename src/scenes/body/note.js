import * as THREE from 'three';
import { allocInkId } from '../../render/layers.js';

// Puzzle C, the torn note (scene 3, lane B1): the paper from his fist in
// seven wet pieces on the dry step under the lamp. I slide them with the
// pointer (my fingertip on the piece) and turn one with the wheel or the
// right button; pieces that belong together pull together when near
// (about 8 mm and 12 degrees) and then move as one. Whole, it reads in a
// quick pencil hand, the ink run a little by the rain:
//   HARBOR BLDG.
//   RM 304
// (no default export: not a scene)
export const NOTE = { w: 0.15, d: 0.095 };
const W = NOTE.w, D = NOTE.d;

// the paper: wet grey, the pencil, the run of the rain
let TEX = null;
function noteTexture() {
  if (TEX) return TEX;
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * D / W);
  const x = c.getContext('2d');
  const H = c.height;
  x.fillStyle = '#b4b4b4'; x.fillRect(0, 0, 1024, H);
  // wet: darker blotches soaked through, a tide line
  let s = 7;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let k = 0; k < 26; k++) {
    const g = x.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, `rgba(60,60,60,${0.1 + r() * 0.12})`); g.addColorStop(1, 'rgba(60,60,60,0)');
    x.save(); x.translate(r() * 1024, r() * H); x.scale(60 + r() * 200, 40 + r() * 120); x.fillStyle = g; x.beginPath(); x.arc(0, 0, 1, 0, 7); x.fill(); x.restore();
  }
  // faint ruled lines of a pad sheet
  x.strokeStyle = 'rgba(80,80,80,0.18)'; x.lineWidth = 3;
  for (let y = H * 0.18; y < H; y += H * 0.2) { x.beginPath(); x.moveTo(0, y); x.lineTo(1024, y + 3); x.stroke(); }
  // the pencil: a quick hand, leaning, pressed hard
  const font = (px) => `italic 700 ${px}px "Bradley Hand", "Noteworthy", "Marker Felt", "Segoe Print", "Comic Sans MS", cursive`;
  const line = (text, y, px, tilt) => {
    x.save();
    x.translate(512, y); x.rotate(tilt);
    x.font = font(px);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    // the run: the letters smeared down a little by the wet
    for (let k = 5; k >= 1; k--) { x.fillStyle = `rgba(40,40,40,${0.05})`; x.fillText(text, (k % 2 ? 1 : -1) * k * 0.8, k * 4.2); }
    x.fillStyle = 'rgba(28,28,28,0.92)';
    x.fillText(text, 0, 0);
    x.restore();
  };
  line('HARBOR BLDG.', H * 0.3, 128, -0.03);
  line('RM 304', H * 0.72, 160, -0.02);
  // a thumb's smudge
  x.fillStyle = 'rgba(50,50,50,0.12)'; x.beginPath(); x.ellipse(830, H * 0.8, 70, 40, 0.5, 0, 7); x.fill();
  TEX = new THREE.CanvasTexture(c);
  TEX.colorSpace = THREE.SRGBColorSpace;
  TEX.anisotropy = 8;
  return TEX;
}

// ---- the tears: one across between the lines, three through the top line,
// two through the bottom one; each a ragged run, fixed (every note the same)
const jag = (t, seed, amp) => amp * (0.55 * Math.sin(t * 61 + seed) + 0.3 * Math.sin(t * 173 + seed * 2.3) + 0.15 * Math.sin(t * 419 + seed * 5.1));
const Hcut = (x) => 0.004 + jag(x, 1.3, 0.0035) - 0.03 * x;
const TOPS = [-0.042, 0.004, 0.043], BOTS = [-0.022, 0.03];
const Vcut = (k, v0) => (y) => v0 + jag(y, 3.1 + k * 2.2, 0.003) + 0.08 * y * (k % 2 ? 1 : -1);
// where a cut x = f(y) meets the across tear
function meet(f) { let y = 0; for (let i = 0; i < 8; i++) y = Hcut(f(y)); return y; }
const N = 14;
// a polyline of the across tear from xa to xb
function across(xa, xb) { const out = []; for (let i = 0; i <= N; i++) { const x = xa + (xb - xa) * i / N; out.push([x, Hcut(x)]); } return out; }
// a cut from ya to yb
function down(f, ya, yb) { const out = []; for (let i = 0; i <= N; i++) { const y = ya + (yb - ya) * i / N; out.push([f(y), y]); } return out; }

// the seven pieces as polygons in the note's frame (x across, y up the
// page: +y the top), numbered left to right, top then bottom
function pieces() {
  const T = TOPS.map((v, k) => Vcut(k, v)), B = BOTS.map((v, k) => Vcut(k + 5, v));
  const L = -W / 2, R = W / 2, top = D / 2, bot = -D / 2;
  const out = [];
  // top row: between the cuts, from the across tear up to the top edge
  const tl = [(y) => L, ...T, (y) => R];
  for (let i = 0; i < 4; i++) {
    const f0 = tl[i], f1 = tl[i + 1];
    const y0 = i === 0 ? Hcut(L) : meet(f0), y1 = i === 3 ? Hcut(R) : meet(f1);
    const x0 = f0(y0), x1 = f1(y1);
    const poly = [];
    // up the left side, across the top, down the right side, back along the tear
    poly.push(...(i === 0 ? [[L, y0], [L, top]] : down(f0, y0, top)));
    poly.push(...(i === 3 ? [[R, top], [R, y1]] : down(f1, top, y1)));
    poly.push(...across(x1, x0).slice(1, -1));
    out.push(poly);
  }
  const bl = [(y) => L, ...B, (y) => R];
  for (let i = 0; i < 3; i++) {
    const f0 = bl[i], f1 = bl[i + 1];
    const y0 = i === 0 ? Hcut(L) : meet(f0), y1 = i === 2 ? Hcut(R) : meet(f1);
    const x0 = f0(y0), x1 = f1(y1);
    const poly = [];
    poly.push(...(i === 0 ? [[L, bot], [L, y0]] : down(f0, bot, y0)));
    poly.push(...across(x0, x1).slice(1, -1));
    poly.push(...(i === 2 ? [[R, y1], [R, bot]] : down(f1, y1, bot)));
    out.push(poly);
  }
  return out;
}
// which pieces share a torn edge
const NEIGH = [[0, 1], [1, 2], [2, 3], [4, 5], [5, 6], [0, 4], [1, 4], [1, 5], [2, 5], [3, 5], [3, 6], [2, 6]];

// a piece's mesh: the paper (both faces), its origin at its own centroid
function pieceMesh(poly, mat, edgeMat) {
  let cx = 0, cy = 0;
  for (const [x, y] of poly) { cx += x; cy += y; }
  cx /= poly.length; cy /= poly.length;
  const shape = new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x - cx, y - cy)));
  const geo = new THREE.ShapeGeometry(shape, 1);
  const uv = geo.getAttribute('uv'), p = geo.getAttribute('position');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + cx + W / 2) / W, (p.getY(i) + cy + D / 2) / D);
  // lie flat: the page's +y (its top) away from the eye (+z of the table... the
  // scene turns it), face up
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, mat);
  m.receiveShadow = true;
  m.userData.noRay = true;
  // the torn edge: a thin pale rim just inside the outline
  const pts = poly.map(([x, y]) => new THREE.Vector3(x - cx, 0.0003, -(y - cy)));
  pts.push(pts[0].clone());
  const eg = new THREE.BufferGeometry().setFromPoints(pts);
  const edge = new THREE.Line(eg, edgeMat);
  edge.userData.noRay = true;
  const g = new THREE.Group();
  g.add(m, edge);
  return { group: g, c: new THREE.Vector2(cx, cy) };
}

// where each piece lies at the start (table metres: x right, z away; turn):
// spread over the step, none on another, the words' order not the pieces'
const SCATTER = [[0.085, 0.05, 2.4], [-0.16, -0.035, -0.9], [0.2, -0.045, 0.55], [-0.02, 0.085, -2.2], [-0.1, 0.07, 1.25], [0.02, -0.07, 2.95], [0.175, 0.075, -1.6]];

export const NOTE_PUZZLE = {
  id: 'body.note',
  // (close over the step [second pass]: the pencil read on every piece)
  table: { anchor: 'body.step', size: [0.46, 0.26], fov: 38 },
  build(ctx, a) {
    const S = ctx.stage, G = ctx.game;
    const top = a.pos.y + 0.0006;
    const yaw = a.yaw ?? 0, c = Math.cos(yaw), s = Math.sin(yaw);
    const world = (x, z) => new THREE.Vector3(a.pos.x + x * c - z * s, top, a.pos.z - x * s - z * c);
    const mat = new THREE.MeshStandardMaterial({ color: 0xe6e6e6, map: noteTexture(), roughness: 0.92, side: THREE.DoubleSide });
    mat.name = 'body_note';
    mat.userData.inkSurface = 'paper';
    const edgeMat = new THREE.LineBasicMaterial({ color: 0xd0d0d0 });
    const id = allocInkId();
    const P = pieces().map((poly, i) => {
      const pm = pieceMesh(poly, mat, edgeMat);
      pm.group.traverse((o) => { o.userData.inkId = id + 0; });
      const [sx, sz, sa] = SCATTER[i];
      const p = world(sx, sz);
      pm.group.position.copy(p);
      // (the page's frame on the table: its top away from the eye, turned by sa)
      pm.group.rotation.y = yaw + sa;
      S.scene.add(pm.group);
      return { i, g: pm.group, c: pm.c, group: i, lift: 0, layer: i };
    });
    const st = { pieces: P, grab: null, progress: 0, whole: false, wholeT: 0, top, yaw, world, G, id };
    ctx.flags.noteSt = st;
    return st;
  },
  input(st, p) {
    if (st.whole) return;
    const G = st.G;
    // (the right button turns what is under the pointer: the pointer stays)
    if (p.right) {
      const m = G.mouse, A = G.puzzles.active, [tw, td] = A.def.table.size;
      p.x = Math.max(-tw / 2, Math.min(tw / 2, p.x - m.dx * 0.0006));
      p.z = Math.max(-td / 2, Math.min(td / 2, p.z + m.dy * 0.0006));
      p.world.copy(st.world(p.x, p.z));
    }
    const members = (gid) => st.pieces.filter((q) => q.group === gid);
    if (p.pressed) {
      // the piece under the fingertip: the topmost whose outline is near
      let best = null, bd = 0.03;
      for (const q of st.pieces) {
        const d = Math.hypot(q.g.position.x - p.world.x, q.g.position.z - p.world.z);
        if (d < bd + (q.layer * 1e-4)) { bd = d; best = q; }
      }
      if (best) {
        st.grab = { q: best, last: p.world.clone() };
        // (it comes to the top)
        const L = Math.max(...st.pieces.map((q) => q.layer)) + 1;
        for (const m of members(best.group)) m.layer = L;
        G.sfx.play('paperTouch', best.g.position);
      }
    }
    // (let go near where it belongs: it pulls home - the one let go moves)
    if (!p.down && st.grab) { const gid = st.grab.q.group; st.grab = null; tryJoin(st, gid); }
    if (st.grab) {
      const q = st.grab.q, M = members(q.group);
      const dx = p.world.x - st.grab.last.x, dz = p.world.z - st.grab.last.z;
      for (const m of M) { m.g.position.x += dx; m.g.position.z += dz; }
      st.grab.last.copy(p.world);
      st.progress += 0.0001;
    }
    // turning: the held group (or the piece under the pointer) about the pointer
    let turn = p.wheel * 0.0025;
    if (p.right) turn += G.mouse.dx * 0.009;
    if (turn) {
      let gid = st.grab ? st.grab.q.group : null;
      if (gid == null) {
        let best = null, bd = 0.035;
        for (const q of st.pieces) { const d = Math.hypot(q.g.position.x - p.world.x, q.g.position.z - p.world.z); if (d < bd) { bd = d; best = q; } }
        if (best) gid = best.group;
      }
      if (gid != null) {
        const cs = Math.cos(-turn), sn = Math.sin(-turn);
        for (const m of members(gid)) {
          const rx = m.g.position.x - p.world.x, rz = m.g.position.z - p.world.z;
          m.g.position.x = p.world.x + rx * cs + rz * sn;
          m.g.position.z = p.world.z - rx * sn + rz * cs;
          m.g.rotation.y -= turn;
        }
        st.progress += 0.0001;
        if (!st.grab) tryJoin(st, gid);
      }
    }
  },
  update(st, dt) {
    for (const q of st.pieces) {
      const want = st.grab && q.group === st.grab.q.group ? 0.004 : 0;
      q.lift += (want - q.lift) * Math.min(1, dt / 0.06);
      // (a snap's settle: a hair up and down)
      let bump = 0;
      if (q.snapT != null) { q.snapT += dt; bump = q.snapT < 0.12 ? 0.0012 * Math.sin(q.snapT / 0.12 * Math.PI) : 0; if (q.snapT > 0.2) q.snapT = null; }
      q.g.position.y = st.top + q.lift + bump + q.layer * 0.00012;
    }
    if (!st.whole && st.pieces.every((q) => q.group === st.pieces[0].group)) {
      st.whole = true; st.wholeT = 0; st.grab = null; st.progress += 1;
      st.G.sfx.play('noteWhole', st.pieces[0].g.position);
    }
    if (st.whole) {
      st.wholeT += dt;
      // whole: it comes square and to the middle of the step, to be read
      const k = Math.min(1, dt / 0.25);
      const P = st.pieces, ref = P[0];
      const da = Math.atan2(Math.sin(st.yaw - ref.g.rotation.y), Math.cos(st.yaw - ref.g.rotation.y)) * k;
      const cen = new THREE.Vector3();
      for (const q of P) cen.add(q.g.position);
      cen.divideScalar(P.length);
      const goal = st.world(0, 0.01);
      const cs = Math.cos(da), sn = Math.sin(da);
      for (const q of P) {
        const rx = q.g.position.x - cen.x, rz = q.g.position.z - cen.z;
        q.g.position.x = cen.x + (goal.x - cen.x) * k + rx * cs + rz * sn;
        q.g.position.z = cen.z + (goal.z - cen.z) * k - rx * sn + rz * cs;
        q.g.rotation.y += da;
      }
    }
  },
  solved(st) { return st.whole && st.wholeT > 1.8; },
  hint(st, level) { return ['The words run across the pieces.', 'Drag a piece; the wheel turns it.', 'Lay torn edges together: they join on their own.'][level - 1]; },
  exit(st) {},
};

// a group near a neighbour's group, as it lay in the note: pulled home
function tryJoin(st, gid) {
  const P = st.pieces;
  const tol = 0.008, atol = THREE.MathUtils.degToRad(12);
  for (const [i, j] of NEIGH) {
    const a = P[i], b = P[j];
    if (a.group === b.group) continue;
    if (gid != null && a.group !== gid && b.group !== gid) continue;
    // move the group that is being handled onto the one that lies still
    const mover = gid != null && b.group === gid ? b : gid != null && a.group === gid ? a : b;
    const fixed = mover === a ? b : a;
    const da = Math.atan2(Math.sin(mover.g.rotation.y - fixed.g.rotation.y), Math.cos(mover.g.rotation.y - fixed.g.rotation.y));
    if (Math.abs(da) > atol) continue;
    // where the mover's centroid belongs, in the fixed one's frame
    const want = placeOf(fixed, mover);
    const d = Math.hypot(want.x - mover.g.position.x, want.z - mover.g.position.z);
    if (d > tol) continue;
    // the mover's whole group swings and slides into place
    const rot = fixed.g.rotation.y - mover.g.rotation.y;
    const piv = mover.g.position.clone();
    const cs = Math.cos(rot), sn = Math.sin(rot);
    const from = mover.group, to = fixed.group;
    for (const m of P.filter((q) => q.group === from)) {
      const rx = m.g.position.x - piv.x, rz = m.g.position.z - piv.z;
      m.g.position.x = want.x + rx * cs + rz * sn;
      m.g.position.z = want.z - rx * sn + rz * cs;
      m.g.rotation.y += rot;
      m.group = to;
      m.snapT = 0;
    }
    const L = Math.max(...P.map((q) => q.layer));
    for (const m of P.filter((q) => q.group === to)) m.layer = L;
    st.progress += 1;
    st.G.sfx.play('paperJoin', mover.g.position);
    if (st.grab) st.grab.q = st.grab.q;
    return true;
  }
  return false;
}
// where piece b's centroid lies if a is where it is (the page's frame: its
// x along the group's local x, its y along the group's local -z)
function placeOf(a, b) {
  const dx = b.c.x - a.c.x, dy = b.c.y - a.c.y;
  const local = new THREE.Vector3(dx, 0, -dy).applyAxisAngle(new THREE.Vector3(0, 1, 0), a.g.rotation.y);
  return a.g.position.clone().add(local);
}

export function clearNote(st) {
  if (!st) return;
  for (const q of st.pieces) if (q.g.parent) q.g.parent.remove(q.g);
}

import * as THREE from 'three';
import { allocInkId } from '../../render/layers.js';
import { drawGuestCheck } from '../../props/kinds/c4.js';
import { padGlyphs } from '../../input/Pad.js';   // [C12]

// [C5] The torn check (chapter III, the brief's step 6): what Ames kept in
// his safe - a guest check from my diner (the printed slip of chapter I's
// pay beat, lane C4's drawGuestCheck), torn in seven, written across in a
// woman's pencil in bold dark strokes: PIER 9 / MIDNIGHT / - DOT. On his
// desk under the lamp I piece it together (lane B1's table puzzle, the torn
// note: LMB slides a piece under my fingertip, RMB with the mouse or the
// wheel turns it; a piece near where it tore from pulls home, generous: 9 mm
// and 14 degrees). Legible from the first look: the words are a pencil's
// two centimetres high, dark on pale paper, unlit by the lamp's glare (the
// paper prints as paper); a piece's torn edge and its writing both say
// where it goes. (no default export: not a scene)
//   CHECK_PUZZLE: a G.puzzles def ({ id: 'office.check', table on office.blotter })
export const CHECK = { w: 0.085, d: 0.14 };
const W = CHECK.w, D = CHECK.d;

// the check's face, drawn once (lane C4's drawing: the diner's slip, her hand)
let TEX = null;
function checkTexture() {
  if (TEX) return TEX;
  const c = document.createElement('canvas'); c.width = 512; c.height = 842;
  drawGuestCheck(c.getContext('2d'), 512, 842, [], { big: ['PIER 9', 'MIDNIGHT', '— DOT'], sign: null, no: 4417 });
  TEX = new THREE.CanvasTexture(c);
  TEX.colorSpace = THREE.SRGBColorSpace;
  TEX.anisotropy = 8;
  return TEX;
}

// ---- the tears: three across (between the head and the words, and between
// the words), one down through each of the top three bands; fixed (every
// check tears the same) ----------------------------------------------------
const jag = (t, seed, amp) => amp * (0.55 * Math.sin(t * 61 + seed) + 0.3 * Math.sin(t * 173 + seed * 2.3) + 0.15 * Math.sin(t * 419 + seed * 5.1));
// across: y (up the check, metres from its middle) of tear k at x; from the
// check's top: under the head (30 %), between PIER 9 and MIDNIGHT (51 %), between MIDNIGHT and - DOT (69 %)
const HY = [0.31, 0.515, 0.695].map((f) => D / 2 - f * D);
const hcut = (k) => (x) => HY[k] + jag(x, 1.3 + k * 2.1, 0.0026) + (k % 2 ? 0.05 : -0.04) * x;
// down: the x of a band's tear at y (bands 0 .. 2 from the top; the last band is whole)
const VX = [0.012, -0.004, 0.009];
const vcut = (r) => (y) => VX[r] + jag(y, 3.1 + r * 2.2, 0.0024) + (r % 2 ? -0.12 : 0.1) * (y - (r === 0 ? 0.045 : HY[r]));
// where a down tear meets an across one: y = h(v(y))
function meet(h, v) { let y = h(0); for (let i = 0; i < 10; i++) y = h(v(y)); return y; }
const N = 12;
const along = (f, a, b) => Array.from({ length: N + 1 }, (_, i) => { const x = a + (b - a) * i / N; return [x, f(x)]; });
const up = (f, a, b) => Array.from({ length: N + 1 }, (_, i) => { const y = a + (b - a) * i / N; return [f(y), y]; });

// the seven pieces as polygons in the check's frame (x across, y up), and their spans
function pieces() {
  const L = -W / 2, R = W / 2, TOP = D / 2, BOT = -D / 2;
  const topOf = (r) => (r === 0 ? () => TOP : hcut(r - 1));
  const botOf = (r) => (r === 3 ? () => BOT : hcut(r));
  const out = [];
  for (let r = 0; r < 4; r++) {
    const T = topOf(r), B = botOf(r);
    if (r === 3) {
      out.push({ r, c: 0, span: [L, R], poly: [[L, B(L)], [L, T(L)], ...along(T, L, R).slice(1, -1), [R, T(R)], [R, B(R)], ...along(B, R, L).slice(1, -1)] });
      continue;
    }
    const V = vcut(r);
    const yt = r === 0 ? TOP : meet(T, V), yb = meet(B, V);
    const xt = V(yt), xb = V(yb);
    // the left piece: up the paper's edge, along the top to the tear, down the tear, back along the bottom
    out.push({ r, c: 0, span: [L, Math.max(xt, xb)], poly: [[L, B(L)], [L, T(L)], ...along(T, L, xt).slice(1, -1), ...up(V, yt, yb), ...along(B, xb, L).slice(1, -1)] });
    // the right piece
    out.push({ r, c: 1, span: [Math.min(xt, xb), R], poly: [...up(V, yb, yt), ...along(T, xt, R).slice(1, -1), [R, T(R)], [R, B(R)], ...along(B, R, xb).slice(1, -1)] });
  }
  return out;
}
// which pieces share a torn edge: the two of a band; a band's with the next's where they overlap
function neighbours(P) {
  const out = [];
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
    const a = P[i], b = P[j];
    if (a.r === b.r) { out.push([i, j]); continue; }
    if (Math.abs(a.r - b.r) !== 1) continue;
    if (Math.min(a.span[1], b.span[1]) - Math.max(a.span[0], b.span[0]) > 0.006) out.push([i, j]);
  }
  return out;
}

function pieceMesh(poly, mat, edgeMat) {
  let cx = 0, cy = 0;
  for (const [x, y] of poly) { cx += x; cy += y; }
  cx /= poly.length; cy /= poly.length;
  const shape = new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x - cx, y - cy)));
  const geo = new THREE.ShapeGeometry(shape, 1);
  const uv = geo.getAttribute('uv'), p = geo.getAttribute('position');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + cx + W / 2) / W, (p.getY(i) + cy + D / 2) / D);
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, mat);
  m.userData.noRay = true;
  // (a hair of thickness under it: the paper's edge, a shade darker - the torn edges read)
  const pts = poly.map(([x, y]) => new THREE.Vector3(x - cx, 0.0003, -(y - cy)));
  pts.push(pts[0].clone());
  const edge = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), edgeMat);
  edge.userData.noRay = true;
  const g = new THREE.Group();
  g.add(m, edge);
  return { group: g, c: new THREE.Vector2(cx, cy) };
}

// where each piece lies when the envelope is emptied (table metres: x right as
// seen, z away; a turn): spread over the desk's top, the words' order not the pieces'
const SCATTER = [[0.02, 0.01, 2.6], [-0.15, -0.06, -0.8], [0.06, -0.085, 0.5], [-0.07, 0.075, -2.4], [0.16, -0.05, 1.3], [-0.16, 0.06, 2.9], [0.15, 0.07, -1.7]];

export const CHECK_PUZZLE = {
  id: 'office.check',
  // (close over the desk's top beside the blotter: the slip a quarter of the frame)
  table: { anchor: 'office.blotter', size: [0.46, 0.28], fov: 31 },
  build(ctx, a) {
    const S = ctx.stage, G = ctx.game;
    const top = a.pos.y + 0.0006;
    const yaw = a.yaw ?? 0, c = Math.cos(yaw), s = Math.sin(yaw);
    const world = (x, z) => new THREE.Vector3(a.pos.x + x * c - z * s, top, a.pos.z - x * s - z * c);
    // (unlit: under the lamp's pool a lit sheet printed its pencil white, as the check on the counter did)
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.9, 0.9), map: checkTexture(), side: THREE.DoubleSide });
    mat.name = 'office_check'; mat.userData.inkSurface = 'paper';
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x9a9690 });
    const id = allocInkId();
    const P0 = pieces();
    const P = P0.map((pc, i) => {
      const pm = pieceMesh(pc.poly, mat, edgeMat);
      pm.group.traverse((o) => { o.userData.inkId = id; });
      const [sx, sz, sa] = SCATTER[i];
      pm.group.position.copy(world(sx, sz));
      pm.group.rotation.y = yaw + sa;
      S.scene.add(pm.group);
      return { i, g: pm.group, c: pm.c, group: i, lift: 0, layer: i };
    });
    const st = { pieces: P, neigh: neighbours(P0), grab: null, progress: 0, whole: false, wholeT: 0, top, yaw, world, G, id, joins: 0 };
    ctx.flags.checkSt = st;
    return st;
  },
  input(st, p) {
    if (st.whole) { st.G.hud.cursor(null); return; }
    const G = st.G;
    if (p.right) {
      const m = G.mouse, A = G.puzzles.active, [tw, td] = A.def.table.size;
      p.x = Math.max(-tw / 2, Math.min(tw / 2, p.x - m.dx * 0.0006));
      p.z = Math.max(-td / 2, Math.min(td / 2, p.z + m.dy * 0.0006));
      p.world.copy(st.world(p.x, p.z));
    }
    const members = (gid) => st.pieces.filter((q) => q.group === gid);
    // the piece under the fingertip: the topmost whose middle is near (the pieces are bigger than the note's)
    const under = (r) => { let best = null, bd = r; for (const q of st.pieces) { const d = Math.hypot(q.g.position.x - p.world.x, q.g.position.z - p.world.z); if (d < bd + q.layer * 1e-4) { bd = d; best = q; } } return best; };
    if (p.pressed) {
      const best = under(0.045);
      if (best) {
        st.grab = { q: best, last: p.world.clone() };
        const L = Math.max(...st.pieces.map((q) => q.layer)) + 1;
        for (const m of members(best.group)) m.layer = L;
        G.sfx.play('paperTouch', best.g.position);
      }
    }
    if (!p.down && st.grab) { const gid = st.grab.q.group; st.grab = null; tryJoin(st, gid); }
    if (st.grab) {
      const q = st.grab.q, M = members(q.group);
      const dx = p.world.x - st.grab.last.x, dz = p.world.z - st.grab.last.z;
      for (const m of M) { m.g.position.x += dx; m.g.position.z += dz; }
      st.grab.last.copy(p.world);
      st.progress += 0.0001;
    }
    let turn = p.wheel * 0.0025;
    if (p.right) turn += G.mouse.dx * 0.009;
    if (turn) {
      let gid = st.grab ? st.grab.q.group : null;
      if (gid == null) { const b = under(0.05); if (b) gid = b.group; }
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
      // whole: it comes square to me and to the middle, to be read (its head away, as a check is read)
      const k = Math.min(1, dt / 0.25);
      const P = st.pieces, ref = P[0];
      const da = Math.atan2(Math.sin(st.yaw - ref.g.rotation.y), Math.cos(st.yaw - ref.g.rotation.y)) * k;
      const cen = new THREE.Vector3();
      for (const q of P) cen.add(q.g.position);
      cen.divideScalar(P.length);
      const goal = st.world(0, 0.0);
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
  // ([C12] the pad the last device: its hands, as the turn card draws them - L2 held turns it)
  hint(st, level) { return ['Her writing runs across the tears.', padGlyphs() ? 'Drag a piece with R2; hold L2 to turn it.' : 'Drag a piece; RMB or the wheel turns it.', 'Lay torn edges together: they join.'][level - 1]; },
  exit() {},
};

// a group near a neighbour's group, as it lay in the check: pulled home
function tryJoin(st, gid) {
  const P = st.pieces;
  const tol = 0.009, atol = THREE.MathUtils.degToRad(14);
  for (const [i, j] of st.neigh) {
    const a = P[i], b = P[j];
    if (a.group === b.group) continue;
    if (gid != null && a.group !== gid && b.group !== gid) continue;
    const mover = gid != null && b.group === gid ? b : gid != null && a.group === gid ? a : b;
    const fixed = mover === a ? b : a;
    const da = Math.atan2(Math.sin(mover.g.rotation.y - fixed.g.rotation.y), Math.cos(mover.g.rotation.y - fixed.g.rotation.y));
    if (Math.abs(da) > atol) continue;
    const want = placeOf(fixed, mover);
    const d = Math.hypot(want.x - mover.g.position.x, want.z - mover.g.position.z);
    if (d > tol) continue;
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
    st.progress += 1; st.joins++;
    st.G.sfx.play('paperJoin', mover.g.position);
    return true;
  }
  return false;
}
// where piece b's middle lies if a is where it is (the check's frame: x along the group's local x, y along its local -z)
export function placeOf(a, b) {
  const dx = b.c.x - a.c.x, dy = b.c.y - a.c.y;
  const local = new THREE.Vector3(dx, 0, -dy).applyAxisAngle(new THREE.Vector3(0, 1, 0), a.g.rotation.y);
  return a.g.position.clone().add(local);
}
// (the plays and the shots: every piece laid where it tore from the first)
export function layCheckWhole(st) {
  const P = st.pieces, a = P[0];
  for (const q of P) { if (q === a) continue; const w = placeOf(a, q); q.g.position.x = w.x; q.g.position.z = w.z; q.g.rotation.y = a.g.rotation.y; q.group = a.group; }
}
export function clearCheck(st) {
  if (!st) return;
  for (const q of st.pieces) if (q.g.parent) q.g.parent.remove(q.g);
}

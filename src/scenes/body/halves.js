import * as THREE from 'three';
import { buildProp } from '../../props/index.js';
import { tornBack, birdMaterial, edgeMaterial, BOOK } from '../../props/kinds/body.js';

// Puzzle B, the two halves (scene 3, lane B1), on the dry step under the
// lamp: Mack's matchbook face down, its back torn across the bird, and the
// torn half from the landing. I slide the half (the left button, my
// fingertip on it) and turn it (the wheel, or the right button and the
// mouse) until the torn edges meet: generous (8 mm, 12 degrees), then it
// pulls home, a click, the bird whole, the two held together a beat.
// (no default export: not a scene)

// Mack's book as it is now: the back of it torn (the half gone), the bird
// printed across the back; face down, so the torn back is up
export function tornBook() {
  const b = buildProp('matchbook');
  const T = tornBack();
  // (the book's own back panel is the one mesh of its crew red outside the
  // cover's pivot: it takes the torn shape and the back's bird)
  const back = b.children.find((o) => o.isMesh && o.material && o.material.userData && o.material.userData.accent === 'crew');
  // (the prop itself is torn now, props/kinds.js: only an old one is torn here)
  if (back && !b.userData.torn) {
    back.geometry = T.keep.geo;
    const bird = new THREE.Mesh(T.keep.decal, birdMaterial());
    bird.userData.inkId = back.userData.inkId;
    const edge = new THREE.Mesh(T.edgeKeep, edgeMaterial());
    edge.userData.inkId = back.userData.inkId;
    b.add(bird, edge);
  }
  b.traverse((o) => { if (o.isMesh) o.userData.noRay = true; });
  return b;
}

// the book's thickness shut (its cover's top): face down it rests on that
const BOOK_H = 0.0052;

export const HALVES = {
  id: 'body.halves',
  // (close over the step [second pass]: the book a sixth of the frame, not a stamp)
  table: { anchor: 'body.step', size: [0.34, 0.2], fov: 30 },
  build(ctx, a) {
    const S = ctx.stage;
    const G = ctx.game;
    const top = a.pos.y;
    // the frame of the table: +x right as seen, +z away (Puzzles' pointer)
    const yaw = a.yaw ?? 0, c = Math.cos(yaw), s = Math.sin(yaw);
    const world = (x, z, y = top) => new THREE.Vector3(a.pos.x + x * c - z * s, y, a.pos.z - x * s - z * c);
    // the book, face down, a little left of the middle, turned a little
    const holder = new THREE.Group();
    holder.position.copy(world(-0.05, 0.0));
    holder.rotation.y = yaw + Math.PI + 0.35;
    const book = tornBook();
    book.rotation.z = Math.PI;
    book.position.y = BOOK_H;
    holder.add(book);
    S.scene.add(holder);
    // the half, face up, off to the right, turned away from its place
    const pivot = new THREE.Group();
    const half = buildProp('matchHalf');
    half.traverse((o) => { if (o.isMesh) o.userData.noRay = true; });
    // (it turns about its own middle: its centroid in its own frame)
    const bb = new THREE.Box3().setFromObject(half);
    const cen = bb.getCenter(new THREE.Vector3()); cen.y = 0;
    half.position.copy(cen).negate();
    pivot.add(half);
    pivot.position.copy(world(0.11, 0.03));
    pivot.rotation.y = holder.rotation.y + 1.95;
    S.scene.add(pivot);
    // where it belongs: laid on the book's back as it was torn from it
    holder.updateMatrixWorld(true);
    const st = { holder, book, pivot, half, cen, top, tgt: holder.localToWorld(new THREE.Vector3(0, BOOK_H - BOOK.t, 0).add(cen.clone())), tgtYaw: holder.rotation.y,
      grab: null, lift: 0, snapped: false, snapT: 0, heldT: 0, progress: 0, world, G };
    ctx.flags.halvesSt = st;
    return st;
  },
  input(st, p) {
    // [R2-G] (made whole, the hand draws off: the pointer's cross goes with it)
    if (st.snapped) { st.G.hud.cursor(null); return; }
    const G = st.G;
    // (the right button turns what is under the pointer: the pointer stays)
    if (p.right) {
      const m = G.mouse, A = G.puzzles.active, [tw, td] = A.def.table.size;
      p.x = Math.max(-tw / 2, Math.min(tw / 2, p.x - m.dx * 0.0006));
      p.z = Math.max(-td / 2, Math.min(td / 2, p.z + m.dy * 0.0006));
      p.world.copy(st.world(p.x, p.z));
    }
    const P = st.pivot.position;
    // the fingertip on the half: a press on it (generous: 4 cm)
    if (p.pressed && Math.hypot(p.world.x - P.x, p.world.z - P.z) < 0.045) {
      st.grab = { dx: P.x - p.world.x, dz: P.z - p.world.z };
      G.sfx.play('paperTouch', P);
    }
    if (!p.down) st.grab = null;
    if (st.grab) {
      P.x = p.world.x + st.grab.dx; P.z = p.world.z + st.grab.dz;
      st.progress += 0.0001;
    }
    // turning: the wheel, or the right button held and the mouse across
    let turn = p.wheel * 0.0025;
    if (p.right) turn += G.mouse.dx * 0.009;
    if (turn) { st.pivot.rotation.y -= turn; st.progress += 0.0001; }
  },
  update(st, dt) {
    const P = st.pivot.position;
    // held: lifted a hair over the book (it slides over, never through);
    // let go: it settles back down in a tenth of a second
    const want = st.grab ? 0.004 : 0;
    st.lift += (want - st.lift) * Math.min(1, dt / 0.06);
    if (st.snapped) {
      // home: the pull, the two-frame settle
      st.snapT += dt;
      const k = Math.min(1, st.snapT / 0.09);
      P.lerp(st.tgt, k);
      st.pivot.rotation.y += Math.atan2(Math.sin(st.tgtYaw - st.pivot.rotation.y), Math.cos(st.tgtYaw - st.pivot.rotation.y)) * k;
      P.y = st.tgt.y + (st.snapT < 0.12 ? 0.0012 * Math.sin(st.snapT / 0.12 * Math.PI) : 0);
      return;
    }
    // (shot mode, the strips: act=join@t lays it home by itself)
    if (st.autoJoin) {
      st.lift = 0.004;
      P.x += (st.tgt.x - P.x) * 0.07; P.z += (st.tgt.z - P.z) * 0.07;
      st.pivot.rotation.y += Math.atan2(Math.sin(st.tgtYaw - st.pivot.rotation.y), Math.cos(st.tgtYaw - st.pivot.rotation.y)) * 0.07;
    }
    P.y = st.top + st.lift + (st.overBook ? BOOK_H - BOOK.t : 0);
    // over the book?
    const hd = Math.hypot(P.x - st.holder.position.x, P.z - st.holder.position.z);
    st.overBook = hd < 0.035;
    // the torn edges near: 8 mm and 12 degrees
    const d = Math.hypot(P.x - st.tgt.x, P.z - st.tgt.z);
    const a = Math.abs(Math.atan2(Math.sin(st.pivot.rotation.y - st.tgtYaw), Math.cos(st.pivot.rotation.y - st.tgtYaw)));
    if (d < 0.008 && a < THREE.MathUtils.degToRad(12)) {
      st.snapped = true; st.snapT = 0; st.grab = null;
      st.progress += 1;
      st.G.sfx.play('matchSnap', st.tgt);
    }
  },
  // solved once home and held together its beat
  solved(st) { return st.snapped && st.snapT > 1.1; },
  // [R3] (42 characters at most: the longer two were warnings in the log)
  hint(st, level) { return ['The torn edges.', 'Drag the red half onto the book.', 'Hold LMB on the half; the wheel turns it.'][level - 1]; },
  exit(st) {},
};

// the puzzle's things off the step (pocketed)
export function clearHalves(st) {
  if (!st) return;
  for (const o of [st.holder, st.pivot]) if (o && o.parent) o.parent.remove(o);
}

import * as THREE from 'three';
import { LAYER } from '../../../render/layers.js';
import { makeGlassMaterial } from '../../../render/glass.js';
import { mergeGeos, slab, lathe } from '../../../props/lib.js';
import { makeFrosted } from './frosted.js';
import { FLOOR, CEIL, ROOM, CORR, DOOR, SIDE, DOORS, STAIRS, LIFT, WIN, ESC, T } from '../plan.js';

// The openings: 304's door (hinged, its frosted pane a pane of the glass
// system, AMES, BOOKKEEPING in gilt), the frosted sidelight beside it, the
// transom, the corridor's other doors (their offices dark), the stairs'
// door ajar, the lift's cage; the street window (two sashes of wet glass,
// the venetian blind hung inside it: its slats one by one), the fire-escape
// window (its lower sash half up, the curtain that moves in the air from it).
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const M = (l) => mergeGeos(l);

// A frosted pane's frame in its parent's space (its centre, u, v, n), so the
// frame can be carried into the world every step, however the parent moves
// (a door swinging) and whatever the glass system did to the mesh's own
// transform once it cut the pane.
function frosted(mesh) {
  mesh.updateMatrix();
  const q = mesh.quaternion.clone();
  return { mesh, parent: mesh.parent, c: mesh.position.clone(), u: V(1, 0, 0).applyQuaternion(q), v: V(0, 1, 0).applyQuaternion(q), n: V(0, 0, 1).applyQuaternion(q) };
}
const _c = new THREE.Vector3(), _u = new THREE.Vector3(), _v = new THREE.Vector3(), _n = new THREE.Vector3(), _q = new THREE.Quaternion();
export function syncFrosted(L, mat) {
  const P = L.parent;
  P.updateWorldMatrix(true, false);
  P.getWorldQuaternion(_q);
  _c.copy(L.c).applyMatrix4(P.matrixWorld);
  mat.userData.setFrame(_c, _u.copy(L.u).applyQuaternion(_q), _v.copy(L.v).applyQuaternion(_q), _n.copy(L.n).applyQuaternion(_q));
  mat.userData.update();
}

// a panelled door leaf in its own frame: hinge edge on z = 0, the leaf
// along +z (width w), its faces toward +x / -x, 0.045 thick; a glazed upper
// panel between y g0 and g1 (the glass is the caller's)
function leafGeos(w, h, [g0, g1]) {
  const t = 0.045, st = 0.12, out = [];
  const B = (z0, z1, y0, y1, th = t) => out.push(new THREE.BoxGeometry(th, y1 - y0, z1 - z0).translate(0, (y0 + y1) / 2, (z0 + z1) / 2));
  B(0, st, 0, h); B(w - st, w, 0, h);                       // the stiles
  B(st, w - st, h - 0.13, h);                               // the top rail
  B(st, w - st, g0 - 0.1, g0);                              // the lock rail
  B(st, w - st, 0, 0.24);                                   // the bottom rail
  B(st, w - st, 0.24, g0 - 0.1, t * 0.55);                  // the lower panel (set back)
  // (the glass's stops: thin beads round the opening on both faces)
  for (const s of [-1, 1]) {
    const x = s * (t / 2 + 0.004);
    out.push(new THREE.BoxGeometry(0.012, 0.02, w - 2 * st).translate(x, g0 + 0.01, w / 2));
    out.push(new THREE.BoxGeometry(0.012, 0.02, w - 2 * st).translate(x, g1 - 0.01, w / 2));
    out.push(new THREE.BoxGeometry(0.012, g1 - g0, 0.02).translate(x, (g0 + g1) / 2, st + 0.01));
    out.push(new THREE.BoxGeometry(0.012, g1 - g0, 0.02).translate(x, (g0 + g1) / 2, w - st - 0.01));
    // the lower panel's moulding
    out.push(new THREE.BoxGeometry(0.01, 0.018, w - 2 * st - 0.04).translate(x * 0.8, 0.3, w / 2));
    out.push(new THREE.BoxGeometry(0.01, 0.018, w - 2 * st - 0.04).translate(x * 0.8, g0 - 0.16, w / 2));
  }
  return out;
}
// a knob and its rose on both faces, at the leaf's free edge
function knobGeos(w) {
  const out = [];
  for (const s of [-1, 1]) {
    const k = lathe([[0.0001, 0], [0.03, 0], [0.03, 0.006], [0.011, 0.012], [0.009, 0.045], [0.024, 0.055], [0.028, 0.07], [0.02, 0.083], [0.0001, 0.086]], 18);
    k.rotateZ(-s * Math.PI / 2).translate(s * 0.022, 1.0, w - 0.07);
    out.push(k);
  }
  return out;
}

export function buildOpenings(kit, mats, stage) {
  const G = stage.glass;
  const out = {};

  // ---- 304's door --------------------------------------------------------------------------
  kit.piece();
  const W = DOOR.z1 - DOOR.z0 - 0.012;
  const hinge = new THREE.Group();
  hinge.position.set(-0.07, FLOOR, DOOR.z0 + 0.006);
  kit.g.add(hinge);
  const leaf = kit.add(M(leafGeos(W, DOOR.h - 0.01, DOOR.glass)), mats.door, { parent: hinge, name: 'door304' });
  kit.add(M(knobGeos(W)), mats.brass, { parent: hinge, cast: false });
  // the splintered lock: the strike torn out of the jamb (a jag of wood on the corridor side)
  {
    const sp = [];
    for (let i = 0; i < 7; i++) sp.push(new THREE.BoxGeometry(0.012 + (i % 3) * 0.006, 0.05 + (i % 4) * 0.03, 0.01).rotateX((i - 3) * 0.12).translate(-0.02 + (i % 2) * 0.012, 0.96 + i * 0.022, DOOR.z1 + 0.012 + (i % 3) * 0.004));
    kit.add(M(sp), mats.deskTop, { cast: false });
  }
  const frost = makeFrosted({ w: W - 0.24, h: DOOR.glass[1] - DOOR.glass[0], text: ['AMES', 'BOOKKEEPING'], seed: 3 });
  frost.userData.glow(0.55, 1.15);
  const pane = G.addPane({ centre: V(0, (DOOR.glass[0] + DOOR.glass[1]) / 2, W / 2), normal: V(1, 0, 0), w: W - 0.24, h: DOOR.glass[1] - DOOR.glass[0], material: frost, parent: hinge, tag: 'door304', thick: 0.005 });
  pane.mesh.layers.set(LAYER.WORLD);
  pane.mesh.userData.noRay = true;
  pane.mesh.userData.inkId = kit.id;
  pane.mesh.userData.inkSurface = 'lit';
  out.door = { hinge, leaf, pane, frost, W, angle: DOOR.open0, target: DOOR.open0, vel: 0, colliderOn: true, local: frosted(pane.mesh) };
  hinge.rotation.y = DOOR.open0;

  // ---- the sidelight and the transom ----------------------------------------------------------
  kit.piece();
  const sw = SIDE.z1 - SIDE.z0, sh = SIDE.y1 - SIDE.y0;
  const sideFrost = makeFrosted({ w: sw, h: sh, text: null, seed: 7 });
  sideFrost.userData.glow(0.5, 1.2);
  const side = G.addPane({ centre: V(-0.07, (SIDE.y0 + SIDE.y1) / 2, (SIDE.z0 + SIDE.z1) / 2), normal: V(1, 0, 0), w: sw, h: sh, material: sideFrost, tag: 'sidelight', thick: 0.005 });
  side.mesh.layers.set(LAYER.WORLD);
  side.mesh.userData.noRay = true;
  side.mesh.userData.inkId = kit.id;
  out.side = { pane: side, frost: sideFrost, local: frosted(side.mesh) };
  // a muntin across the sidelight (two lights, as the period had them)
  kit.add(new THREE.BoxGeometry(0.05, 0.035, sw).translate(-0.07, SIDE.y0 + sh * 0.5, (SIDE.z0 + SIDE.z1) / 2), mats.trim, { cast: true });
  kit.piece();
  const tw = DOOR.z1 - DOOR.z0, th = DOOR.transom[1] - DOOR.transom[0];
  const trFrost = makeFrosted({ w: tw, h: th, text: ['304'], seed: 11 });
  trFrost.userData.glow(0.45, 1.1);
  const tr = new THREE.Mesh(new THREE.PlaneGeometry(tw, th), trFrost);
  tr.position.set(-0.07, (DOOR.transom[0] + DOOR.transom[1]) / 2, (DOOR.z0 + DOOR.z1) / 2);
  tr.rotation.y = Math.PI / 2;
  tr.userData.inkId = kit.id; tr.userData.noRay = true;
  kit.g.add(tr);
  out.transom = { mesh: tr, frost: trFrost, local: frosted(tr) };

  // ---- the other doors of the corridor --------------------------------------------------------
  out.others = [];
  for (const [num, z, sideW, name, trade] of DOORS) {
    kit.piece();
    const g = new THREE.Group();
    const east = sideW === 'E';
    // (hinged on its south jamb; the leaf's +x face toward the corridor for a west door)
    g.position.set(east ? -0.07 : CORR.x0 - T / 2, FLOOR, z - 0.475 + 0.006);
    kit.g.add(g);
    kit.add(M(leafGeos(0.938, DOOR.h - 0.01, DOOR.glass)), mats.door, { parent: g });
    kit.add(M(knobGeos(0.938)), mats.brass, { parent: g, cast: false });
    const fm = makeFrosted({ w: 0.7, h: DOOR.glass[1] - DOOR.glass[0], text: [num + '  ' + name, trade], seed: 20 + z });
    fm.userData.glow(0.035, 0.02);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.7, DOOR.glass[1] - DOOR.glass[0]), fm);
    m.position.set(0, (DOOR.glass[0] + DOOR.glass[1]) / 2, 0.469);
    // (its front face toward the office behind it: the lettering reads from the corridor)
    m.rotation.y = Math.PI / 2;
    m.userData.inkId = kit.id;
    g.add(m);
    // (the west doors face the other way: turned about their hinge)
    if (!east) { g.position.z = z + 0.475 - 0.006; g.rotation.y = Math.PI; }
    out.others.push({ num, group: g, frost: fm, mesh: m, local: frosted(m) });
    stage.colliders.addBox(east ? -0.07 : CORR.x0 - T / 2, z, 0.06, 0.48, 0, 'wall');
  }
  // the stairs' door: ajar, black behind it (the stairwell)
  {
    kit.piece();
    const g = new THREE.Group();
    g.position.set(CORR.x0 - T / 2, FLOOR, STAIRS.z1 - 0.006);
    g.rotation.y = Math.PI + 0.55;
    kit.g.add(g);
    kit.add(M(leafGeos(STAIRS.z1 - STAIRS.z0 - 0.012, DOOR.h - 0.01, [1.25, 1.75])), mats.door, { parent: g });
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.5), mats.glassDark);
    gl.position.set(0, 1.5, (STAIRS.z1 - STAIRS.z0) / 2); gl.rotation.y = Math.PI / 2;
    gl.userData.inkId = kit.id; g.add(gl);
    // the stairwell: a black box behind the wall, a few steps going up into it
    kit.piece();
    kit.add(kit.box(CORR.x0 - 2.6, CORR.x0 - T, FLOOR - 0.05, CEIL, STAIRS.z0 - 0.4, STAIRS.z1 + 1.2), mats.black, { cast: false });
    const steps = [];
    for (let i = 0; i < 6; i++) steps.push(new THREE.BoxGeometry(1.1, 0.18, 0.28).translate(CORR.x0 - 0.9, FLOOR + 0.09 + i * 0.18, STAIRS.z1 + 0.3 - i * 0.28));
    kit.add(M(steps), mats.iron);
    out.stairsDoor = g;
    stage.colliders.addRegion(CORR.x0 - 2.4, CORR.x0, STAIRS.z0 - 0.3, STAIRS.z1 + 1.0, 'stairwell');
  }
  // the lift: a black shaft behind a scissor gate, the floor dial over it
  {
    kit.piece();
    kit.add(kit.box(LIFT.x0 - 0.05, LIFT.x1 + 0.05, FLOOR - 0.5, CEIL + 0.5, CORR.z0 - T - 1.6, CORR.z0 - T), mats.black, { cast: false });
    const bars = [];
    const n = 9, w = LIFT.x1 - LIFT.x0, hh = 2.2;
    for (let i = 0; i < n; i++) {
      const x = LIFT.x0 + (i + 0.5) * w / n;
      bars.push(new THREE.BoxGeometry(0.018, hh, 0.012).translate(x, FLOOR + hh / 2, CORR.z0 - 0.04));
    }
    // the lattice: the diagonals of the scissor
    for (let i = 0; i < n - 1; i++) for (let k = 0; k < 4; k++) {
      const x0 = LIFT.x0 + (i + 0.5) * w / n, x1 = LIFT.x0 + (i + 1.5) * w / n;
      const y0 = 0.25 + k * 0.5, y1 = y0 + 0.5;
      const len = Math.hypot(x1 - x0, 0.5);
      for (const s of [1, -1]) bars.push(new THREE.BoxGeometry(len, 0.012, 0.008).rotateZ(s * Math.atan2(0.5, x1 - x0)).translate((x0 + x1) / 2, (y0 + y1) / 2, CORR.z0 - 0.045));
    }
    bars.push(new THREE.BoxGeometry(w + 0.1, 0.05, 0.05).translate((LIFT.x0 + LIFT.x1) / 2, FLOOR + 2.22, CORR.z0 - 0.04));
    // the floor dial: a half disc, a needle on 3
    const dial = new THREE.CylinderGeometry(0.2, 0.2, 0.02, 32, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2).translate((LIFT.x0 + LIFT.x1) / 2, 2.42, CORR.z0 + 0.01);
    bars.push(dial);
    kit.add(M(bars), mats.iron);
    kit.add(new THREE.BoxGeometry(0.012, 0.16, 0.012).rotateZ(-0.35).translate((LIFT.x0 + LIFT.x1) / 2 + 0.028, 2.49, CORR.z0 + 0.025), mats.steelLight, { cast: false });
    stage.colliders.addBox((LIFT.x0 + LIFT.x1) / 2, CORR.z0 - 0.04, w / 2 + 0.05, 0.05, 0, 'wall');
  }

  // ---- the street window ------------------------------------------------------------------
  kit.piece();
  {
    const x = ROOM.x1 + T * 0.55, z0 = WIN.z0, z1 = WIN.z1, y0 = WIN.y0, y1 = WIN.y1, ym = (y0 + y1) / 2 + 0.02;
    const fr = [];
    // the sashes' frames: the upper sash outside the lower, the meeting rail
    for (const [xx, a, b] of [[x + 0.025, ym - 0.02, y1], [x - 0.025, y0, ym + 0.02]]) {
      fr.push(new THREE.BoxGeometry(0.045, b - a, 0.05).translate(xx, (a + b) / 2, z0 + 0.025));
      fr.push(new THREE.BoxGeometry(0.045, b - a, 0.05).translate(xx, (a + b) / 2, z1 - 0.025));
      fr.push(new THREE.BoxGeometry(0.045, 0.05, z1 - z0).translate(xx, a + 0.025, (z0 + z1) / 2));
      fr.push(new THREE.BoxGeometry(0.045, 0.05, z1 - z0).translate(xx, b - 0.025, (z0 + z1) / 2));
      // a vertical muntin: two lights a sash
      fr.push(new THREE.BoxGeometry(0.03, b - a, 0.028).translate(xx, (a + b) / 2, (z0 + z1) / 2));
    }
    kit.add(M(fr), mats.trim, { name: 'window_sashes' });
    const glassIn = makeGlassMaterial({ wet: 1, side: 'out' });
    const up = G.addPane({ centre: V(x + 0.025, (ym + y1) / 2, (z0 + z1) / 2), normal: V(1, 0, 0), w: z1 - z0 - 0.08, h: y1 - ym - 0.06, material: glassIn, tag: 'window.up' });
    const lo = G.addPane({ centre: V(x - 0.025, (y0 + ym) / 2, (z0 + z1) / 2), normal: V(1, 0, 0), w: z1 - z0 - 0.08, h: ym - y0 - 0.06, material: glassIn, tag: 'window.lo' });
    out.window = { up, lo };
    stage.colliders.addBox(ROOM.x1 + 0.03, (z0 + z1) / 2, 0.06, (z1 - z0) / 2, 0, 'wall');
  }
  out.blind = buildBlind(kit, mats, stage);

  // ---- the fire-escape window --------------------------------------------------------------
  kit.piece();
  {
    const z = ROOM.z1 + T * 0.5, x0 = ESC.x0, x1 = ESC.x1, y0 = ESC.y0, y1 = ESC.y1;
    const H = (y1 - y0) / 2;
    // the upper sash where it stays; the lower one raised in front of it
    const lo0 = y0 + ESC.open, lo1 = lo0 + H + 0.02;
    const fr = [];
    for (const [zz, a, b] of [[z + 0.025, y1 - H - 0.02, y1], [z - 0.025, lo0, lo1]]) {
      fr.push(new THREE.BoxGeometry(0.05, b - a, 0.045).translate(x0 + 0.025, (a + b) / 2, zz));
      fr.push(new THREE.BoxGeometry(0.05, b - a, 0.045).translate(x1 - 0.025, (a + b) / 2, zz));
      fr.push(new THREE.BoxGeometry(x1 - x0, 0.05, 0.045).translate((x0 + x1) / 2, a + 0.025, zz));
      fr.push(new THREE.BoxGeometry(x1 - x0, 0.05, 0.045).translate((x0 + x1) / 2, b - 0.025, zz));
    }
    kit.add(M(fr), mats.trim, { name: 'escape_sashes' });
    const gm = makeGlassMaterial({ wet: 1, side: 'in' });
    const up = G.addPane({ centre: V((x0 + x1) / 2, y1 - H / 2 - 0.01, z + 0.025), normal: V(0, 0, 1), w: x1 - x0 - 0.08, h: H - 0.06, material: gm, tag: 'escape.up' });
    const lo = G.addPane({ centre: V((x0 + x1) / 2, (lo0 + lo1) / 2, z - 0.025), normal: V(0, 0, 1), w: x1 - x0 - 0.08, h: H - 0.06, material: gm, tag: 'escape.lo' });
    out.escape = { up, lo, gap: [y0, lo0] };
    // (the window is shut to the player in scenes 4 and 5; scene 6 goes out of it)
    out.escape.collider = stage.colliders.addBox((x0 + x1) / 2, ROOM.z1 + 0.04, (x1 - x0) / 2, 0.06, 0, 'wall');
  }
  out.curtain = buildCurtain(kit, mats, stage);
  return out;
}

// ---- the venetian blind -----------------------------------------------------------------------
// One slat an instance (a slat can be knocked askew by a round - each lets
// a new blade of light in - or parted by two fingers, scene 6): its tilt,
// its sag and its lift are its own. The headrail, the bottom rail and the
// ladder tapes are one mesh. The slats cast the room's most important
// shadow: the light through them (parts/room.js, the blind's light).
export const BLIND = { n: 36, x: ROOM.x1 - 0.075, tilt: 0.62, width: 0.05, len: WIN.z1 - WIN.z0 - 0.06 };
function buildBlind(kit, mats, stage) {
  kit.piece();
  const B = BLIND;
  const top = WIN.y1 - 0.07, bottom = WIN.y0 + 0.03;
  const step = (top - bottom) / (B.n - 1);
  // a slat: a thin crowned strip, its length along z
  const g = new THREE.BoxGeometry(B.width, 0.0022, B.len, 3, 1, 12);
  {
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) / (B.width / 2), s = p.getZ(i) / (B.len / 2);
      p.setY(i, p.getY(i) + 0.0035 * (1 - u * u) - 0.004 * s * s);
    }
    g.computeVertexNormals();
  }
  const im = new THREE.InstancedMesh(g, mats.blind, B.n);
  im.castShadow = true; im.receiveShadow = true;
  im.userData.inkId = kit.id;
  im.userData.inkPerInstance = false;
  im.userData.noRay = true;
  im.name = 'blind_slats';
  kit.g.add(im);
  const zc = (WIN.z0 + WIN.z1) / 2;
  const slats = [];
  for (let i = 0; i < B.n; i++) slats.push({ i, y: top - i * step, tilt: B.tilt + ((i * 37) % 7 - 3) * 0.012, sag: 0, lift: 0, twist: 0, gone: false, part: 0 });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s1 = new THREE.Vector3(1, 1, 1), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const write = (S) => {
    if (S.gone) { im.setMatrixAt(S.i, zero); return; }
    // (tilt: about the slat's length, the room edge down; twist: a round's
    // kink turns one end; part: fingers pushing it down or up at the middle)
    e.set(S.twist, 0, S.tilt, 'ZXY');
    q.setFromEuler(e);
    m4.compose(new THREE.Vector3(B.x, S.y + S.lift - S.sag, zc), q, s1);
    im.setMatrixAt(S.i, m4);
  };
  for (const S of slats) write(S);
  im.instanceMatrix.needsUpdate = true;
  im.computeBoundingSphere();
  // the headrail, the bottom rail, the ladder tapes and the cord
  const R = [];
  R.push(slab(0.07, 0.055, B.len + 0.04, { bevel: 0.008, corner: 0.01 }).translate(B.x, top + 0.025, zc));
  R.push(slab(0.055, 0.022, B.len, { bevel: 0.006, corner: 0.008 }).translate(B.x, bottom - 0.035, zc));
  for (const dz of [-0.62, 0, 0.62]) for (const dx of [-0.026, 0.026]) R.push(new THREE.BoxGeometry(0.002, top - bottom + 0.06, 0.012).translate(B.x + dx, (top + bottom) / 2, zc + dz));
  R.push(new THREE.CylinderGeometry(0.0022, 0.0022, 1.3, 5).translate(B.x - 0.04, top - 0.62, WIN.z1 - 0.05));
  R.push(lathe([[0.0001, 0], [0.008, 0.004], [0.009, 0.03], [0.0001, 0.04]], 10).translate(B.x - 0.04, top - 1.3, WIN.z1 - 0.05));
  kit.add(mergeGeos(R), mats.trim, { name: 'blind_rails' });
  const api = {
    mesh: im, slats, top, bottom, step,
    set(i, o) { const S = slats[i]; if (!S) return; Object.assign(S, o); write(S); im.instanceMatrix.needsUpdate = true; },
    // a round through the blind at a world point: the slats it passes are
    // knocked open (a blade of light) or torn away
    pierce(point, r) {
      let n = 0;
      for (const S of slats) {
        if (S.gone || Math.abs(S.y - point.y) > 0.04) continue;
        const k = 1 - Math.abs(S.y - point.y) / 0.04;
        S.twist += (r.next() - 0.5) * 0.5 * k;
        S.tilt += (0.35 + r.next() * 0.5) * k * (r.chance(0.5) ? 1 : -0.6);
        S.sag += 0.01 * k;
        if (k > 0.7 && r.chance(0.3)) S.gone = true;
        write(S); n++;
      }
      if (n) im.instanceMatrix.needsUpdate = true;
      return n;
    },
    reset() { slats.forEach((S, i) => { Object.assign(S, { tilt: B.tilt + ((i * 37) % 7 - 3) * 0.012, sag: 0, lift: 0, twist: 0, gone: false, part: 0 }); write(S); }); im.instanceMatrix.needsUpdate = true; },
  };
  return api;
}

// ---- the curtain at the fire-escape window --------------------------------------------------------
// A cloth on a rod over the window, moving in the air that comes in under
// the raised sash; a round through it tears a hole (its alpha, a canvas);
// enough of them and it hangs in strips.
function buildCurtain(kit, mats, stage) {
  kit.piece();
  const w = ESC.x1 - ESC.x0 + 0.34, h = CEIL - 0.34 - (ESC.y0 - 0.12);
  const geo = new THREE.PlaneGeometry(w, h, 14, 20);
  const base = geo.getAttribute('position').array.slice();
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 192;
  const cg = cv.getContext('2d');
  cg.fillStyle = '#fff'; cg.fillRect(0, 0, 128, 192);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.NoColorSpace;
  const mat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.95, side: THREE.DoubleSide, alphaMap: tex, alphaTest: 0.5 });
  mat.name = 'office_curtain';
  mat.userData.inkSurface = 'cloth';
  const m = kit.add(geo, mat, { name: 'curtain', noRay: true });
  const zc = ROOM.z1 - 0.1, xc = (ESC.x0 + ESC.x1) / 2, yc = CEIL - 0.34 - h / 2;
  m.position.set(xc, yc, zc);
  // (drawn to one side: the curtain covers the window's left two thirds)
  const rod = kit.add(new THREE.CylinderGeometry(0.009, 0.009, w + 0.2, 8).rotateZ(Math.PI / 2).translate(xc, CEIL - 0.32, zc), mats.brass, { cast: false });
  void rod;
  const holes = [];
  return {
    mesh: m, tex, canvas: cv, holes, w, h, base,
    // a hole where a round went through (a world point)
    tear(point, r) {
      const u = (point.x - xc) / w + 0.5, v = 1 - ((point.y - yc) / h + 0.5);
      if (u < 0 || u > 1 || v < 0 || v > 1) return false;
      cg.fillStyle = '#000';
      cg.beginPath();
      const R = 3 + r.next() * 4, cx = u * 128, cy = v * 192;
      for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2, rr = R * (0.6 + r.next() * 0.9); cg.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 1.3); }
      cg.closePath(); cg.fill();
      // (a rip runs down from a hole now and then)
      if (r.chance(0.35)) { cg.fillRect(cx - 1, cy, 2 + r.next() * 2, 8 + r.next() * 30); }
      tex.needsUpdate = true;
      holes.push([u, v]);
      return true;
    },
    reset() { cg.fillStyle = '#fff'; cg.fillRect(0, 0, 128, 192); tex.needsUpdate = true; holes.length = 0; },
    // the air from under the sash: a slow billow, stronger low down
    step(t, gust = 0) {
      const p = geo.getAttribute('position');
      for (let i = 0; i < p.count; i++) {
        const bx = base[i * 3], by = base[i * 3 + 1];
        const low = Math.max(0, (-by / h) + 0.5);          // 0 at the rod, 1 at the hem
        const wave = Math.sin(t * 1.3 + bx * 3.1 + by * 1.7) * 0.5 + Math.sin(t * 0.61 + bx * 1.3) * 0.5;
        p.setZ(i, -(0.03 + 0.1 * (0.6 + gust)) * low * low * (0.7 + 0.3 * wave));
        p.setX(i, bx + 0.02 * low * Math.sin(t * 0.9 + by * 2.0));
      }
      p.needsUpdate = true;
      geo.computeVertexNormals();
    },
  };
}

import * as THREE from 'three';
import { LAYER, allocInkId } from '../render/layers.js';
import { makeGlassMaterial } from '../render/glass.js';
import { FIRE } from '../fx/fxTextures.js';
import { cutPane, addStar, crackAll, pieces, paneGeometry, crackGeometry, shardGeometry, inConvex } from './Shatter.js';

// Glass (docs/story/CONTRACTS.md §8.3): every pane that a round, a body or
// a blast can break. One per stage (stage.glass, game.glass); a part
// registers its panes while it builds.
//   glass.addPane({ mesh | centre, normal, w, h, material?, thick: 0.006,
//                   lit: false, room?: Object3D, tag, parent?, outline? }) -> pane
//   glass.hit(pane, { point, dir, power, by, normal })   -> 'glass' | 'done'
//       1st round: a hole and a star of cracks; more: more stars, the pieces
//       the cracks close off fall out; enough of them: it goes
//   glass.shatter(pane, { dir, power, at? })     all of it, now (a body: the
//       pane bursts outwards round a man-sized hole at `at`)
//   glass.restore(pane)                          whole again (a retry)
//   pane.state: 'whole' | 'cracked' | 'holed' | 'gone'
//   pane.on('state', fn(pane, state))            game event 'glass:shatter' { pane }
//
// The breaking is geometry-true (destruct/Shatter.js): on its first hit a
// pane is cut into a seeded Voronoi of its outline; its cracks are walks
// along the cells' edges, drawn as thin pale ribbons in its plane; what falls
// out is the cells the cracks closed off, as real shards (ShardField below).
// A pane given as { centre, normal, w, h } gets a plain faint plane (lane
// 1's makeGlassMaterial) drawn in the scene pass only (LAYER.FX: the ink
// still sees the room behind it) and an invisible twin on the world layer
// that the bullets hit (userData.pane; fx/React.js routes it here). Both take
// the cut pane's remaining cells: a round through a hole goes through.
// A pane may instead be SHARED: a record of an owner that draws many panes
// in one merged mesh (the façade's windows, world/Facade.js): on its first
// hit the pane leaves the owner's mesh (owner.paneGone(pane, kind)) and is
// drawn here, cut, with the owner's material and ink id; a black backing
// (the dark room) stands behind its holes.

const SHARD_CAP = 150;      // shards flying or sliding
const REST_CAP = 220;       // shards lying on the ground (the oldest go)
const _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _m = new THREE.Matrix4(), _o = new THREE.Vector3(), _d = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

// the frosted halo round a hole: a ring of crushed glass, its alpha a noisy
// radial field (one texture for every halo)
let HALO_TEX = null;
function haloTexture() {
  if (HALO_TEX) return HALO_TEX;
  const S = 128, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const img = g.createImageData(S, S);
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const spikes = Array.from({ length: 24 }, () => 0.75 + rnd() * 0.5);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (x + 0.5) / S * 2 - 1, dy = (y + 0.5) / S * 2 - 1;
    const r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    const sp = spikes[Math.floor(((a + Math.PI) / (2 * Math.PI)) * 24) % 24];
    // dense crushed ring close to the hole, thinning into ragged spikes
    const k = r < 0.18 ? 0 : Math.max(0, 1 - (r - 0.18) / (0.8 * sp));
    const n = rnd();
    const al = k > 0 ? (n < k * 1.2 ? Math.min(1, 0.35 + k) : 0) : 0;
    const i = (y * S + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
    img.data[i + 3] = Math.round(al * 255);
  }
  g.putImageData(img, 0, 0);
  HALO_TEX = new THREE.CanvasTexture(c);
  HALO_TEX.colorSpace = THREE.NoColorSpace;
  return HALO_TEX;
}

export class Glass {
  constructor(stage) {
    this.stage = stage;
    this.panes = [];
    this.rng = null;           // (a fork of its own, taken at the first break)
    this.shards = null;        // ShardField, made at the first break
    this.mats = null;
  }

  addPane(spec) {
    let pane;
    if (spec.shared) {
      // (the owner's own record becomes the pane: its fields stay where
      // the owner's code expects them)
      pane = spec;
      Object.assign(pane, { state: 'whole', broken: false, hits: pane.hits || 0, listeners: [] });
      pane.normal = pane.normal || new THREE.Vector3(1, 0, 0);
    } else {
      const normal = (spec.normal || new THREE.Vector3(1, 0, 0)).clone().normalize();
      const c = (spec.centre || spec.c || (spec.mesh && spec.mesh.getWorldPosition(new THREE.Vector3())) || new THREE.Vector3()).clone();
      pane = {
        tag: spec.tag || 'pane', c, normal, w: spec.w ?? 1, h: spec.h ?? 1, thick: spec.thick ?? 0.006, lit: !!spec.lit, room: spec.room || null,
        mesh: spec.mesh || null, proxy: null, state: 'whole', broken: false, hits: 0, listeners: [], kind: 'pane', outline: spec.outline || null,
      };
      if (!pane.mesh) {
        const geo = new THREE.PlaneGeometry(pane.w, pane.h);
        const m = new THREE.Mesh(geo, spec.material || makeGlassMaterial({ wet: 1, side: 'out' }));
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
        m.position.copy(c);
        m.layers.set(LAYER.FX);
        m.renderOrder = 1;
        m.name = 'pane_' + pane.tag;
        (spec.parent || this.stage.scene).add(m);
        pane.mesh = m;
        // the bullets' target: an invisible twin on the world layer
        const px = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ visible: false }));
        px.visible = false;
        px.quaternion.copy(m.quaternion);
        px.position.copy(c);
        px.userData.pane = pane;
        px.userData.surf = 'glass';
        px.name = 'paneRay_' + pane.tag;
        (spec.parent || this.stage.scene).add(px);
        pane.proxy = px;
        // (a pane added once the stage stands joins the bullets' world now;
        // during the build the stage collects every mesh on its own)
        if (this.stage.rays) this.stage.addSolid(px);
      } else pane.mesh.userData.pane = pane;
      pane.geo0 = pane.mesh.geometry;
    }
    pane.on = (ev, fn) => { if (ev === 'state') pane.listeners.push(fn); return pane; };
    this.panes.push(pane);
    return pane;
  }

  setState(pane, state) {
    if (pane.state === state) return;
    pane.state = state;
    for (const fn of pane.listeners) fn(pane, state);
  }

  get game() { return this.stage.game; }

  // ---- the pane's frame and its cut ---------------------------------------------------
  // (u across, v up, n out; a mesh pane: its plane's own axes)
  frameOf(pane) {
    if (pane.frame) return pane.frame;
    let U, V, N, c;
    if (pane.owner) {
      // the façade's panes: PlaneGeometry turned +90 deg about y (facing +x)
      N = pane.normal.clone().normalize();
      V = new THREE.Vector3(0, 1, 0);
      U = new THREE.Vector3().crossVectors(V, N).normalize();
      c = pane.c.clone();
    } else {
      const m = pane.mesh;
      m.updateWorldMatrix(true, false);
      const q = m.getWorldQuaternion(new THREE.Quaternion());
      U = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
      V = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
      N = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
      c = m.getWorldPosition(new THREE.Vector3());
    }
    pane.frame = { c, U, V, N };
    return pane.frame;
  }

  toUV(pane, p) {
    const F = this.frameOf(pane);
    _v.copy(p).sub(F.c);
    return [_v.dot(F.U), _v.dot(F.V)];
  }

  materials() {
    if (this.mats) return this.mats;
    const M = this.stage.M;
    this.mats = {
      // pale fracture lines: they print as broken white lines on dark glass
      crack: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.2, 0.2), side: THREE.DoubleSide }),
      halo: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.3, 0.3), alphaMap: haloTexture(), transparent: true, depthWrite: false, side: THREE.DoubleSide }),
      backing: new THREE.MeshBasicMaterial({ color: 0x000000 }),
      shard: new THREE.MeshStandardMaterial({ color: 0x8c8c8c, roughness: 0.1, metalness: 1.0, envMap: M.env, envMapIntensity: 2.4, side: THREE.DoubleSide }),
    };
    return this.mats;
  }

  // cut the pane on its first hit (the finest cells round that first hit)
  prepare(pane, first, { spokes = true } = {}) {
    if (pane.cut) return pane.cut;
    const G = this.game;
    const r = this.rng || (this.rng = this.stage.rng.fork(8311));
    const F = this.frameOf(pane);
    const outline = pane.outline || [[-pane.w / 2, -pane.h / 2], [pane.w / 2, -pane.h / 2], [pane.w / 2, pane.h / 2], [-pane.w / 2, pane.h / 2]];
    const area = pane.w * pane.h;
    // (a pitch that keeps a pane's cells at a few hundred, never coarser
    // than 16 cm, never finer than 3 cm; the star's rings scale with it)
    const s = Math.min(0.11, Math.max(0.03, Math.sqrt(area / 700)));
    const scale = Math.min(1, Math.max(0.35, s / 0.12));
    const P = cutPane(outline, first, s, r, scale, { spokes });
    P.scale = scale;
    P.stars = [];
    pane.cut = P;
    // enough rounds and it goes: by its size (a car's window 3, the diner's
    // plate glass 15)
    pane.limit = pane.limit || Math.max(3, Math.round(4 + area * 1.4));
    const M = this.materials();
    // the meshes: the pane's own (a mesh pane) or its own drawing (a shared one)
    if (pane.owner) {
      const src = pane.owner.glassMeshes && pane.owner.glassMeshes[pane.kind];
      pane.kind0 = pane.kind;
      const mat = src ? src.material : this.stage.M.glassDark;
      const m = new THREE.Mesh(paneGeometry(P, F), mat);
      m.userData.inkId = src ? src.userData.inkId : 1;
      m.userData.pane = pane;
      m.userData.surf = 'glass';
      m.name = 'paneCut_' + (pane.tag || 'facade');
      this.stage.scene.add(m);
      pane.cutMesh = m;
      this.stage.addSolid(m);
      const back = new THREE.Mesh(new THREE.PlaneGeometry(pane.w, pane.h), M.backing);
      back.quaternion.setFromRotationMatrix(_m.makeBasis(F.U, F.V, F.N));
      back.position.copy(F.c).addScaledVector(F.N, -0.006);
      back.userData.inkId = m.userData.inkId;
      back.userData.noRay = true;
      back.visible = false;
      this.stage.scene.add(back);
      pane.backing = back;
      // (the owner's merged mesh loses it)
      pane.kind = 'cut';
      pane.owner.paneGone(pane, pane.kind0);
    } else {
      pane.xf0 = { p: pane.mesh.position.clone(), q: pane.mesh.quaternion.clone() };
      pane.mesh.geometry = paneGeometry(P, F);
      // (the mesh's own transform is the plane's: the geometry is written in
      // world space, so the mesh and its twin sit at the origin)
      for (const o of [pane.mesh, pane.proxy]) {
        if (!o) continue;
        const parent = o.parent;
        if (parent) { parent.updateWorldMatrix(true, false); o.matrix.copy(parent.matrixWorld).invert(); o.matrix.decompose(o.position, o.quaternion, o.scale); }
      }
      if (pane.proxy) pane.proxy.geometry = pane.mesh.geometry;
    }
    const layer = pane.owner ? LAYER.WORLD : LAYER.FX;
    const parent = pane.owner ? this.stage.scene : (pane.mesh.parent || this.stage.scene);
    const cr = new THREE.Mesh(new THREE.BufferGeometry(), M.crack);
    cr.layers.set(layer);
    cr.userData.noRay = true;
    cr.renderOrder = 2;
    if (pane.owner) cr.userData.inkId = pane.cutMesh.userData.inkId;
    parent.add(cr);
    if (!pane.owner) { parent.updateWorldMatrix(true, false); cr.matrix.copy(parent.matrixWorld).invert(); cr.matrix.decompose(cr.position, cr.quaternion, cr.scale); }
    pane.crackMesh = cr;
    pane.halos = [];
    return P;
  }

  // redraw the pane after cells fell or cracks ran
  redraw(pane) {
    const P = pane.cut, F = this.frameOf(pane), G = this.game;
    const g = paneGeometry(P, F);
    const w = 0.0035 + 0.003 * P.scale;
    const old = pane.crackMesh.geometry;
    pane.crackMesh.geometry = crackGeometry(P, F, w);
    old.dispose();
    if (pane.owner) {
      const o = pane.cutMesh.geometry;
      pane.cutMesh.geometry = g;
      o.dispose();
      if (G) G.rays.refresh(pane.cutMesh);
      // (no black behind a pane whose owner opened a room there: lane 4's
      // upper rooms, Facade.openRoom)
      pane.backing.visible = !pane.roomOpen && P.cells.some((c) => c.gone);
    } else {
      const o = pane.mesh.geometry;
      pane.mesh.geometry = g;
      if (pane.proxy) { pane.proxy.geometry = g; if (G) G.rays.refresh(pane.proxy); }
      if (o !== pane.geo0) o.dispose();
    }
    // a halo goes with the glass round it
    for (const h of pane.halos) {
      let gone = 0;
      for (let k = 0; k < 6; k++) {
        const a = k * 1.047, u = h.u + Math.cos(a) * h.r * 0.9, v = h.v + Math.sin(a) * h.r * 0.9;
        const ci = P.cells.findIndex((c) => inConvex(c.poly, u, v));
        if (ci < 0 || P.cells[ci].gone) gone++;
      }
      h.mesh.visible = gone < 3;
    }
  }

  halo(pane, u, v) {
    const F = this.frameOf(pane), P = pane.cut, M = this.materials(), r = this.rng;
    const R = 0.06 * Math.max(0.6, P.scale) * r.range(0.85, 1.2);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(R * 2, R * 2), M.halo);
    m.quaternion.setFromRotationMatrix(_m.makeBasis(F.U, F.V, F.N)).multiply(_q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), r.next() * 6.28));
    m.position.copy(F.c).addScaledVector(F.U, u).addScaledVector(F.V, v).addScaledVector(F.N, 0.002);
    m.layers.set(pane.owner ? LAYER.WORLD : LAYER.FX);
    m.userData.noRay = true;
    m.renderOrder = 3;
    if (pane.owner) m.userData.inkId = pane.cutMesh.userData.inkId;
    this.stage.scene.add(m);
    pane.halos.push({ mesh: m, u, v, r: R });
  }

  // cells that fall out: a shard per group (tiny ones: a shower of bits)
  drop(pane, group, { dir, power = 1, burst = null, tip = false }) {
    const P = pane.cut, F = this.frameOf(pane), G = this.game, r = this.rng;
    for (const ci of group.cells) P.cells[ci].gone = true;
    if (!G) return;
    const S = this.shards || (this.shards = new ShardField(this.stage, this.materials().shard));
    let cu = 0, cv = 0;
    for (const ci of group.cells) { cu += P.cells[ci].c[0] * P.cells[ci].area; cv += P.cells[ci].c[1] * P.cells[ci].area; }
    cu /= group.area || 1; cv /= group.area || 1;
    const at = F.c.clone().addScaledVector(F.U, cu).addScaledVector(F.V, cv);
    // (the side the round or the body came from decides where it falls)
    const side = dir && dir.dot(F.N) < 0 ? -1 : 1;
    const out = F.N.clone().multiplyScalar(side);
    if (group.area < 0.0012 * Math.max(0.5, P.scale)) {
      // a bit: a flake of the debris
      const s = Math.sqrt(group.area) * 1.3 + 0.01;
      G.fx.debris.spawn({
        pos: at, vel: out.clone().multiplyScalar(r.range(0.3, 1.6) * power).add(new THREE.Vector3(r.gauss() * 0.5, r.range(-0.2, 0.9), r.gauss() * 0.5)),
        life: r.range(0.7, 1.4), size: [s, s * r.range(0.4, 0.8)], rot: r.next() * 6.28, spin: r.gauss() * 12,
        col: [0.32, 0.32, 0.32], cell: FIRE.SHARD, gravity: 9.8, ground: this.stage.surfaceY(at.x, at.z) + 0.01, fadeOut: 0.12, lit: 2.5, litT: 0.1,
      });
      return;
    }
    const vel = out.clone().multiplyScalar(r.range(0.2, 0.9) * power).add(new THREE.Vector3(r.gauss() * 0.25, r.range(-0.1, 0.5), r.gauss() * 0.25));
    let spin;
    if (burst) {
      // the body's burst: flung along its path, faster the nearer the hole
      const d = Math.max(0.2, Math.hypot(cu - burst[0], cv - burst[1]));
      vel.addScaledVector(dir, power * r.range(2.0, 4.2) / (0.6 + d)).add(new THREE.Vector3(0, r.range(0.2, 1.4), 0));
      spin = new THREE.Vector3(r.gauss(), r.gauss(), r.gauss()).multiplyScalar(6 + 4 / (0.5 + d));
    } else if (tip) {
      // a big shard at the frame: it tips out about its frame edge, then falls
      // (they tip out of the frame onto the pavement side, the face the pane
      // shows the street: the rest of it falls in with the round)
      const outer = F.N;
      vel.copy(outer).multiplyScalar(r.range(0.2, 0.6)).add(new THREE.Vector3(0, r.range(0, 0.3), 0));
      const hinge = Math.abs(cv) > Math.abs(cu) * (pane.h / pane.w) ? F.U : F.V;
      const lever = at.clone().sub(F.c);
      const sg = Math.sign(new THREE.Vector3().crossVectors(hinge, lever).dot(outer)) || 1;
      spin = hinge.clone().multiplyScalar(sg * r.range(1.6, 3.2)).add(new THREE.Vector3(r.gauss() * 0.4, r.gauss() * 0.4, r.gauss() * 0.4));
    } else {
      spin = new THREE.Vector3(r.gauss(), r.gauss(), r.gauss()).multiplyScalar(r.range(3, 9));
    }
    const sh = shardGeometry(P, group.cells, pane.thick || 0.006);
    sh.P = P; sh.cells = group.cells;
    S.spawn(sh, F, vel, spin).pane = pane;
  }

  // the groups the cracks closed off from the frame fall out
  dropLoose(pane, dir, power, onlyCore = -1) {
    const P = pane.cut;
    let n = 0;
    for (const g of pieces(P)) {
      if (g.frame) continue;
      if (onlyCore >= 0 && !g.cells.includes(onlyCore)) continue;
      this.drop(pane, g, { dir, power });
      n++;
    }
    return n;
  }

  // a round hit the pane: a star; the pieces it closes off fall; enough of
  // them and the pane goes
  hit(pane, { point, dir = new THREE.Vector3(0, 0, -1), normal = null, power = 1, by = 'bullet' } = {}) {
    const G = this.game;
    if (!G) return null;
    if (pane.state === 'gone' || pane.hidden) return 'done';
    if (power >= 2) { this.shatter(pane, { dir, power, by, at: point }); return 'glass'; }
    const [u, v] = this.toUV(pane, point);
    const P = this.prepare(pane, [u, v]);
    pane.hits++;
    const star = addStar(P, u, v, this.rng, { scale: P.scale, core: pane.hits === 1 });
    if (star) { P.stars.push(star); this.halo(pane, u, v); }
    // the first round: only its pulverised core goes (a hole); later rounds
    // let every piece the cracks have closed off fall out
    const fell = this.dropLoose(pane, dir, power, pane.hits === 1 && star ? Math.max(0, star.core) : -1);
    // a spray of glitter off the hit
    const r = this.rng, F = this.frameOf(pane);
    for (let k = 0; k < 6; k++) {
      const s = r.range(0.008, 0.02);
      G.fx.debris.spawn({
        pos: point.clone(), vel: dir.clone().multiplyScalar(r.range(0.5, 2)).add(new THREE.Vector3(r.gauss() * 0.6, r.range(0, 1), r.gauss() * 0.6)),
        life: r.range(0.4, 0.9), size: [s, s * 0.6], rot: r.next() * 6.28, spin: r.gauss() * 14, col: [0.32, 0.32, 0.32], cell: FIRE.SHARD,
        gravity: 9.8, ground: this.stage.surfaceY(point.x, point.z) + 0.01, fadeOut: 0.12, lit: 2.5, litT: 0.08,
      });
    }
    if (pane.hits >= pane.limit) { this.shatter(pane, { dir, power, by }); return 'glass'; }
    this.redraw(pane);
    G.sfx.glass(point, fell > 1 ? 0.7 : 0.35);
    this.setState(pane, P.cells.some((c) => c.gone) ? 'holed' : 'cracked');
    return 'glass';
  }

  // all of it, now: fine cracks run through the rest; the big shards at the
  // frame tip out, the rest bursts; teeth stay in the putty. `at` (a body):
  // a man-sized hole bursts outward round it
  shatter(pane, { dir = new THREE.Vector3(-1, 0, 0), power = 1, at = null, by = 'bullet' } = {}) {
    const G = this.game;
    if (!G || pane.state === 'gone') return;
    const F = this.frameOf(pane);
    let c = at ? this.toUV(pane, at) : [(this.rng || this.stage.rng.fork(8311)).range(-0.2, 0.2) * pane.w, -0.1 * pane.h];
    const P = this.prepare(pane, c, { spokes: false });
    const r = this.rng;
    if (!P.stars.length) { const s = addStar(P, c[0], c[1], r, { scale: P.scale }); if (s) P.stars.push(s); }
    const body = by === 'body' || power >= 1.4;
    const burst = body ? c : null;
    if (body) {
      // the man-sized hole: every cell in an ellipse round him goes to bits
      for (const E of P.edges) {
        if (E.frame) continue;
        const a = P.verts[E.a];
        const du = (a[0] - c[0]) / 0.42, dv = (a[1] - c[1]) / 0.85;
        if (du * du + dv * dv < 1) E.crack = true;
      }
    }
    // (above the percolation line of the cells' edges - about half - the
    // glass falls apart in bits; below it, in big sheets: near the holes the
    // one, at the frame the other)
    // (a body through it (Wave A fix D8): bits round him, but away from him
    // the glass holds in large sheets - fewer cracks there - which tip out
    // of the frame about their edge and fall onto the pavement)
    crackAll(P, P.stars, r, body ? { near: 0.92, far: 0.26, edge: 0.12, reach: 0.6 } : { near: 0.92, far: 0.62, edge: 0.42, reach: Math.max(0.5, Math.min(pane.w, pane.h) * 0.45) });
    const tooth = Math.max(0.04, Math.min(0.14, Math.min(pane.w, pane.h) * 0.08));
    let n = 0;
    for (const g of pieces(P)) {
      // teeth: shallow pieces held by the frame stay
      if (g.frame && g.depth < tooth) continue;
      let far = true;
      if (body) {
        let cu = 0, cv = 0;
        for (const ci of g.cells) { cu += P.cells[ci].c[0] * P.cells[ci].area; cv += P.cells[ci].c[1] * P.cells[ci].area; }
        cu /= g.area || 1; cv /= g.area || 1;
        far = Math.hypot((cu - c[0]) / 0.42, (cv - c[1]) / 0.85) > 1.05;
      }
      const tip = g.frame && g.area > 0.03 && far;
      this.drop(pane, g, { dir, power: power * (body ? 1.2 : 1), burst: tip ? null : burst, tip });
      n++;
    }
    pane.broken = true;
    this.redraw(pane);
    G.sfx.glass(F.c, 1.2);
    G.counters.windows++;
    this.setState(pane, 'gone');
    G.emit('glass:shatter', { pane });
  }

  // put a pane back whole (a retry, a preset)
  restore(pane) {
    const G = this.game;
    pane.hits = 0;
    pane.broken = false;
    if (pane.cut) {
      if (pane.owner) {
        this.stage.scene.remove(pane.cutMesh, pane.backing);
        if (G) G.rays.setEnabled(pane.cutMesh, false);
        pane.kind = pane.kind0;
        pane.owner.paneGone(pane, pane.kind);
      } else {
        for (const o of [pane.mesh, pane.proxy]) if (o) { o.geometry = pane.geo0; o.position.copy(pane.xf0.p); o.quaternion.copy(pane.xf0.q); o.scale.set(1, 1, 1); }
        if (pane.proxy && G) G.rays.refresh(pane.proxy);
      }
      pane.frame = null;
      pane.crackMesh.parent && pane.crackMesh.parent.remove(pane.crackMesh);
      for (const h of pane.halos) this.stage.scene.remove(h.mesh);
      pane.cut = null;
    }
    // (its shards go with it: a retry must not find the old glass lying
    // under a whole pane)
    if (this.shards) this.shards.clear((s) => s.pane === pane);
    this.setState(pane, 'whole');
  }

  // take a pane out altogether (a breakable's own glass - the pie case's -
  // made for one break; Breakables.restore puts the thing back whole)
  removePane(pane) {
    const G = this.game;
    const i = this.panes.indexOf(pane);
    if (i >= 0) this.panes.splice(i, 1);
    if (this.shards) this.shards.clear((s) => s.pane === pane);
    if (pane.owner) { this.restore(pane); return; }
    for (const o of [pane.mesh, pane.proxy, pane.crackMesh]) if (o && o.parent) o.parent.remove(o);
    for (const h of pane.halos || []) h.mesh.parent && h.mesh.parent.remove(h.mesh);
    if (pane.proxy) this.stage.removeSolid(pane.proxy);
    if (G && pane.proxy && G.rays.setEnabled) G.rays.setEnabled(pane.proxy, false);
  }

  // the shards lying (or still falling) inside a box, or all of them
  clearShards(box = null) {
    if (!this.shards) return 0;
    return this.shards.clear((s) => !box || box.containsPoint(s.mesh.position));
  }

  update(dt) {
    if (this.shards) this.shards.update(dt);
    // (a shared pane hidden by its owner - the diner bays out of sight - hides
    // its cut drawing too)
    for (const p of this.panes) {
      if (!p.cut || !p.owner) continue;
      const vis = !p.hidden;
      if (p.cutMesh.visible !== vis) {
        p.cutMesh.visible = vis; p.crackMesh.visible = vis;
        p.backing.visible = vis && !p.roomOpen && p.cut.cells.some((c) => c.gone);
        for (const h of p.halos) h.mesh.visible = vis;
        if (this.game) this.game.rays.setEnabled(p.cutMesh, vis);
      }
    }
  }
}

// ---- the shards --------------------------------------------------------------------------
// Real pieces of the pane: they fly, turn (flashing white where they catch
// the light: a mirror-like material over the environment), land, break again
// on a hard landing, slide, and lie on the ground.
export class ShardField {
  constructor(stage, material) {
    this.stage = stage;
    this.mat = material;
    this.live = [];
    this.rest = [];
    this.inkId = allocInkId();
    this.rng = stage.rng.fork(8312);
  }

  // (each flying shard its own material: its glint is its own)
  matFor() {
    const m = this.pool && this.pool.pop();
    if (m) return m;
    // (see-through: a clear shard is a dark pane with an inked outline; it
    // comes up opaque and white only while it glints)
    // (Wave A fix D4: with no ink silhouette of its own the shard shows by
    // its tone - a grey sheet of glass catching the lamps - and its hairline)
    // (clear: what is behind shows through it, lifted a little; it comes up
    // white only while it glints)
    return new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 0.2, metalness: 0.6, envMap: this.mat.envMap, envMapIntensity: 1.6, emissive: new THREE.Color(0.02, 0.02, 0.02), transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide });
  }

  restMat() {
    // lying on the street: a faint pale sheen (the lamps catch the flats).
    // (a shard at rest goes back to the world layer and takes the ink's own
    // outline: the glass on the pavement of s18_matchbook is the level)
    return this._rest || (this._rest = new THREE.MeshStandardMaterial({ color: 0x202020, roughness: 0.3, metalness: 0.3, envMap: this.mat.envMap, envMapIntensity: 0.35, emissive: new THREE.Color(0.03, 0.03, 0.03), transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }));
  }

  // (Wave A fix D4) A shard carries a thin contour, not the ink's heavy one:
  // it is drawn on the effects layer (the scene pass only: the ink's id and
  // depth probes see what lies under it, so it gets no silhouette line of
  // its own) and its outline is a hairline of its own, one pixel of dark
  // round its rim, riding with it
  lineMat() {
    return this._line || (this._line = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.85, depthWrite: false }));
  }

  spawn(sh, F, vel, spin, parent = null) {
    const m = new THREE.Mesh(sh.geo, this.matFor());
    m.userData.inkId = this.inkId;
    m.userData.noRay = true;
    m.castShadow = false;
    m.layers.set(LAYER.FX);
    m.renderOrder = 2;
    // (a sliver too small to hold a line is its tone alone: outlined, a
    // shower of slivers printed as a scribble of wire)
    if (sh.line && sh.area > 0.0035) {
      const l = new THREE.LineSegments(sh.line, this.lineMat());
      l.layers.set(LAYER.FX);
      l.renderOrder = 3;
      l.userData.noRay = true;
      m.add(l);
      m.userData.line = l;
    }
    if (parent) { m.position.copy(parent.pos); m.quaternion.copy(parent.q); }
    else {
      m.position.copy(F.c).addScaledVector(F.U, sh.cu).addScaledVector(F.V, sh.cv);
      m.quaternion.setFromRotationMatrix(_m.makeBasis(F.U, F.V, F.N));
    }
    this.stage.scene.add(m);
    const s = { mesh: m, vel, spin, area: sh.area, rad: Math.sqrt(sh.area) * 0.75, broke: !!parent, slide: false, flat: null, t: 0, sh, gx: 1e9, gz: 1e9, gy: 0 };
    this.live.push(s);
    while (this.live.length > SHARD_CAP) this.kill(this.live.shift());
    return s;
  }

  kill(s) {
    this.stage.scene.remove(s.mesh);
    s.mesh.geometry.dispose();
    if (s.mesh.userData.line) s.mesh.userData.line.geometry.dispose();
    if (s.mesh.material !== this._rest) (this.pool || (this.pool = [])).push(s.mesh.material);
  }

  // what a shard comes down on: the highest solid under it (a counter, a
  // booth's table or bench, a car's roof), else the walking surface. Found
  // by the bullets' rays, again only when it has moved ~15 cm across
  groundAt(s) {
    const p = s.mesh.position;
    if (Math.hypot(p.x - s.gx, p.z - s.gz) < 0.15) return s.gy;
    s.gx = p.x; s.gz = p.z;
    const floor = this.stage.surfaceY(p.x, p.z);
    let y = floor;
    const G = this.stage.game;
    if (G && G.rays) {
      // (a big sheet rests on a support only where the support spans it: the
      // lowest of five rays, its middle and four points out toward its edge;
      // a sill under its middle alone does not hold it up)
      const k = s.rad > 0.12 ? 0.6 * s.rad : 0;
      let low = Infinity;
      for (const [ox, oz] of k ? [[0, 0], [k, 0], [-k, 0], [0, k], [0, -k]] : [[0, 0]]) {
        const hit = G.rays.raycast(_o.set(p.x + ox, p.y + 0.05, p.z + oz), _d.set(0, -1, 0), 6);
        // (not the glass it came out of: a ray down the pane's own plane)
        const yy = hit && !hit.mesh.userData.pane ? Math.max(floor, hit.point.y) : floor;
        low = Math.min(low, yy);
      }
      y = Math.max(floor, low);
    }
    s.gy = y;
    return y;
  }

  // take away the shards that match (flying or lying) -> how many went
  clear(pred) {
    let n = 0;
    for (const L of [this.live, this.rest]) {
      for (let i = L.length - 1; i >= 0; i--) if (pred(L[i])) { this.kill(L[i]); L.splice(i, 1); n++; }
    }
    return n;
  }

  // the glint: a shard turned so that it mirrors the lamps above into the
  // eye flashes paper-white for a frame or two
  glint(s, cam) {
    const m = s.mesh;
    const n = _v.set(0, 0, 1).applyQuaternion(m.quaternion);
    const toEye = new THREE.Vector3().subVectors(cam, m.position).normalize();
    const h = toEye.add(UP).normalize();
    const g = Math.pow(Math.abs(n.dot(h)), 60);
    const e = 0.02 + 3.5 * g;
    m.material.emissive.setRGB(e, e, e);
    m.material.opacity = Math.min(1, 0.32 + 2 * g);
  }

  update(dt) {
    const r = this.rng;
    const cam = this.stage.game ? this.stage.game.camera.position : null;
    for (let i = this.live.length - 1; i >= 0; i--) {
      const s = this.live[i], m = s.mesh;
      s.t += dt;
      if (cam) this.glint(s, cam);
      const gy = this.groundAt(s) + 0.004;
      if (!s.slide) {
        s.vel.y -= 9.8 * dt;
        s.vel.multiplyScalar(1 - 0.15 * dt);
        m.position.addScaledVector(s.vel, dt);
        const w = s.spin.length();
        if (w > 1e-4) m.quaternion.premultiply(_q.setFromAxisAngle(_v.copy(s.spin).divideScalar(w), w * dt));
        // its lowest reach: the half-extent across its tilt
        const n = _v.set(0, 0, 1).applyQuaternion(m.quaternion);
        const hh = s.rad * Math.sqrt(Math.max(0, 1 - n.y * n.y));
        if (m.position.y - hh <= gy && s.vel.y < 0) {
          // a hard landing breaks a big shard again (into 2 or 3)
          if (!s.broke && s.area > 0.012 && s.vel.y < -2.2) { this.split(s); this.live.splice(i, 1); this.kill(s); continue; }
          s.slide = true;
          s.vel.y = 0;
          s.vel.x *= 0.45; s.vel.z *= 0.45;
          // lie flat, face up or down as it came
          const q = new THREE.Quaternion().setFromUnitVectors(n.y >= 0 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 0, -1), UP);
          // (keep its heading: turn it about the vertical by its own yaw)
          const f = new THREE.Vector3(1, 0, 0).applyQuaternion(m.quaternion).setY(0);
          const yaw = f.lengthSq() > 1e-6 ? Math.atan2(-f.z, f.x) : r.next() * 6.28;
          s.flat = new THREE.Quaternion().setFromAxisAngle(UP, yaw).multiply(q);
          m.position.y = gy;
          this.stage.street && this.stage.street.addImpact && s.area > 0.004 && this.stage.street.addImpact(this.stage, m.position.x, m.position.z, 0.25);
        }
      } else {
        m.quaternion.slerp(s.flat, Math.min(1, dt * 14));
        m.position.addScaledVector(s.vel, dt);
        m.position.y = gy;
        const sp = Math.hypot(s.vel.x, s.vel.z);
        const dec = Math.min(sp, 3.2 * dt);
        if (sp > 1e-5) { s.vel.x -= s.vel.x / sp * dec; s.vel.z -= s.vel.z / sp * dec; }
        if (sp < 0.02 && s.t > 0.25) {
          m.quaternion.copy(s.flat);
          (this.pool || (this.pool = [])).push(m.material);
          m.material = this.restMat();
          m.layers.set(LAYER.WORLD);
          if (m.userData.line) m.userData.line.visible = false;
          this.live.splice(i, 1);
          this.rest.push(s);
          while (this.rest.length > REST_CAP) this.kill(this.rest.shift());
        }
      }
    }
  }

  // split a shard's cells in two or three by a line through its middle
  split(s) {
    const r = this.rng, sh = s.sh;
    const P = sh.P;
    if (!P) return;
    const cells = sh.cells;
    const a = r.next() * Math.PI;
    const dx = Math.cos(a), dy = Math.sin(a);
    const parts = [[], []];
    for (const ci of cells) parts[((P.cells[ci].c[0] - sh.cu) * dx + (P.cells[ci].c[1] - sh.cv) * dy) > 0 ? 1 : 0].push(ci);
    const m = s.mesh;
    for (const cs of parts) {
      if (!cs.length) continue;
      const g = shardGeometry(P, cs, 0.006);
      g.P = P; g.cells = cs; g.broke = true;
      // (the child's centroid in the parent's frame -> world)
      const off = new THREE.Vector3(g.cu - sh.cu, g.cv - sh.cv, 0).applyQuaternion(m.quaternion);
      const pos = m.position.clone().add(off);
      const vel = new THREE.Vector3(s.vel.x * 0.5 + r.gauss() * 0.6, -s.vel.y * r.range(0.15, 0.3), s.vel.z * 0.5 + r.gauss() * 0.6);
      const spin = new THREE.Vector3(r.gauss(), r.gauss(), r.gauss()).multiplyScalar(r.range(4, 10));
      this.spawn(g, null, vel, spin, { pos, q: m.quaternion }).pane = s.pane;
    }
  }
}

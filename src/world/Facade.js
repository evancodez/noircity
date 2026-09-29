import * as THREE from 'three';
import { tagInk, allocInkId } from '../render/layers.js';
import { STREET } from './Street.js';
import { roundedBox, boxWorldUV, merge, place, V3, smoothNormals } from './geom.js';
import { DINER } from '../stages/block/site.js';

// where the left row makes way for the el (z, from its first block to its
// last: the el crosses the building line from z -146 to -192)
export const EL_GAP = { z0: -143, z1: -184 };

// The left façade: a tall wet stone building in the foreground (rusticated
// base, pilasters, framed windows, cornice, fire escape, a blade sign), then a
// cross street, then lower buildings receding into the mist. Also the
// warehouses on the far side of the overpass and the block ends.
export class Facade {
  constructor(world) {
    this.world = world;
    const { scene, M, rng } = world;
    this.group = new THREE.Group();
    this.group.name = 'facade';
    scene.add(this.group);
    this.windowsDark = [];   // matrices for instanced far windows
    this.windowsLit = [];
    this.windows = [];       // the near building's panes (Phase 3a: shootable)
    this.buildNearBuilding(rng.fork(1));
    this.buildFarBlocks(rng.fork(2));
    this.buildWindowInstances();
  }

  box(w, h, d, x, y, z, mat, uvScale = 1 / 6) {
    const g = boxWorldUV(new THREE.BoxGeometry(w, h, d).translate(x, y, z), uvScale);
    const m = new THREE.Mesh(g, mat);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }

  // ---------------------------------------------------------------------
  buildNearBuilding(rng) {
    const { M, colliders } = this.world;
    const X = STREET.facadeX;          // wall plane faces +x
    const z0 = 40, z1 = -24, H = 24; // its corner frames the left of the reference view
    const g = new THREE.Group();
    const stoneParts = [];
    const trimParts = [];

    // main mass and the rusticated base course & plinth (CONTRACTS §15):
    // one building with the diner's room in it, always drawn, always solid:
    // boxes round the room's void, and a plinth broken where the diner's
    // own front (its tiled stall riser, stages/block/parts/dinerFront.js)
    // stands between the pilasters at z = 11.6 and z = -6.0 (the
    // pilasters, as deep as the plinth, hide its cut ends)
    const D = DINER;
    const massParts = [];
    const slab = (xa, xb, ya, yb, za, zb) => massParts.push(new THREE.BoxGeometry(xb - xa, yb - ya, zb - za).translate((xa + xb) / 2, (ya + yb) / 2, (za + zb) / 2));
    slab(X - 16, X, 0, H, z1, D.zMin);
    slab(X - 16, X, 0, H, D.zMax, z0);
    slab(X - 16, D.backX, 0, H, D.zMin, D.zMax);
    slab(D.backX, X, 0, D.floorY, D.zMin, D.zMax);
    slab(D.backX, X, D.ceilY, H, D.zMin, D.zMax);
    const pz0 = D.pilasters[D.pilasters.length - 1], pz1 = D.pilasters[0];
    massParts.push(roundedBox(0.3, 0.7, pz0 - z1, 0.05).translate(X + 0.12, 0.35, (pz0 + z1) / 2));
    massParts.push(roundedBox(0.3, 0.7, z0 - pz1, 0.05).translate(X + 0.12, 0.35, (z0 + pz1) / 2));
    // string course above the ground floor & under the cornice
    trimParts.push(roundedBox(0.42, 0.34, z0 - z1 + 0.4, 0.06).translate(X + 0.2, 5.35, (z0 + z1) / 2));
    trimParts.push(roundedBox(0.3, 0.22, z0 - z1 + 0.4, 0.05).translate(X + 0.14, 20.4, (z0 + z1) / 2));
    // cornice: stepped moulding
    const corn = [[0.35, 0.5, 21.9], [0.7, 0.3, 22.4], [1.05, 0.28, 22.8], [1.25, 0.5, 23.2]];
    for (const [dx, h, y] of corn) trimParts.push(roundedBox(dx * 2, h, z0 - z1 + dx * 2, 0.07).translate(X, y, (z0 + z1) / 2));

    // pilasters every bay; wider corner quoin at z1
    const bay = 4.4;
    for (let z = z0 - 2.0; z > z1 + 1; z -= bay) {
      stoneParts.push(roundedBox(0.5, 20.4, 0.75, 0.06).translate(X + 0.18, 10.2 + 0.4, z));
    }
    stoneParts.push(roundedBox(0.6, H - 1.0, 1.3, 0.08).translate(X + 0.22, (H - 1.0) / 2, z1 + 0.6));
    // side quoin (visible end wall edge)
    stoneParts.push(roundedBox(16.2, H - 1.0, 0.4, 0.08).translate(X - 8, (H - 1.0) / 2, z1 + 0.12));

    // (the stone tile covers 12 m: 1 m courses)
    const stoneMesh = (parts) => {
      const geo = merge(parts.map((q) => boxWorldUVAfter(q)));
      boxWorldUV(geo, 1 / 12);
      const m = new THREE.Mesh(geo, M.stone);
      m.castShadow = true; m.receiveShadow = true;
      g.add(m);
      return m;
    };
    this.mass = stoneMesh(massParts);
    this.mass.name = 'facadeMass';
    stoneMesh(stoneParts);
    // Ledges and frames do NOT cast shadow-map shadows: a lamp at ledge
    // height projects them as long crisp black parallelograms (a regular
    // black-bar grid). Their own unlit undersides give the dark band an
    // inker would draw.
    const trim = new THREE.Mesh(merge(trimParts), M.stoneTrim);
    trim.castShadow = false; trim.receiveShadow = true;
    g.add(trim);

    // windows: frames (stone trim), sills, glass (dark or lit)
    const frameParts = [], glassDark = [], glassLit = [], glassDim = [], blinds = [];
    const floors = [6.4, 10.0, 13.6, 17.2];
    for (let z = z0 - 2.0 - bay / 2; z > z1 + 1.5; z -= bay) {
      for (const y of floors) {
        const w = 1.5, h = 2.3;
        const xf = X + 0.02;
        // glass sits in the reveal
        const glass = new THREE.PlaneGeometry(w, h).rotateY(Math.PI / 2).translate(xf + 0.01, y + h / 2, z);
        const r = rng.next();
        const kind = r < 0.0 ? 'lit' : r < 0.14 ? 'dim' : 'dark';
        (kind === 'lit' ? glassLit : kind === 'dim' ? glassDim : glassDark).push(glass);
        this.windows.push(this.world.glass.addPane({ geo: glass, kind, c: V3(xf + 0.01, y + h / 2, z), w, h, broken: false, hits: 0, shared: true, owner: this, tag: 'facade' }));
        if (r < 0.22 && rng.next() < 0.6) {
          // drawn blind: dark band over the top part of the lit window
          const bh = h * rng.range(0.3, 0.7);
          blinds.push(new THREE.PlaneGeometry(w, bh).rotateY(Math.PI / 2).translate(xf + 0.02, y + h - bh / 2, z));
        }
        // frame: jambs, head, sill, keystone
        frameParts.push(roundedBox(0.2, h + 0.3, 0.16, 0.04, 2).translate(xf + 0.08, y + h / 2, z - w / 2 - 0.08));
        frameParts.push(roundedBox(0.2, h + 0.3, 0.16, 0.04, 2).translate(xf + 0.08, y + h / 2, z + w / 2 + 0.08));
        frameParts.push(roundedBox(0.26, 0.24, w + 0.6, 0.05, 2).translate(xf + 0.1, y + h + 0.2, z));
        frameParts.push(roundedBox(0.34, 0.14, w + 0.5, 0.04, 2).translate(xf + 0.14, y - 0.06, z));
        frameParts.push(roundedBox(0.3, 0.36, 0.3, 0.04, 2).translate(xf + 0.12, y + h + 0.3, z));
        // mullion
        frameParts.push(roundedBox(0.06, h, 0.06, 0.02, 2).translate(xf + 0.03, y + h / 2, z));
      }
      // ground floor shop window between pilasters (the diner's four bays
      // are its own front: stages/block/parts/dinerFront.js)
      if (Object.values(D.bays).some((b) => Math.abs(b - z) < 0.01)) continue;
      const fp = frameParts;
      const w = 2.9, h = 3.3;
      const glass = new THREE.PlaneGeometry(w, h).rotateY(Math.PI / 2).translate(X + 0.03, 0.75 + h / 2, z);
      glassDark.push(glass);
      this.windows.push(this.world.glass.addPane({ geo: glass, kind: 'dark', c: V3(X + 0.03, 0.75 + h / 2, z), w, h, broken: false, hits: 0, shop: true, shared: true, owner: this, tag: 'facade.shop' }));
      fp.push(roundedBox(0.2, 0.2, w + 0.3, 0.05, 2).translate(X + 0.1, 0.75 + h + 0.1, z));
      fp.push(roundedBox(0.22, 0.28, w + 0.3, 0.05, 2).translate(X + 0.11, 0.7, z));
      fp.push(roundedBox(0.08, h, 0.08, 0.03, 2).translate(X + 0.05, 0.75 + h / 2, z));
    }
    const frames = new THREE.Mesh(merge(frameParts), M.stoneTrim);
    frames.castShadow = false; frames.receiveShadow = true;
    g.add(frames);
    // Phase 3a: each kind of pane is one merged mesh, rebuilt without a pane
    // once it is shot out (world/Facade.hit); a black recess stands behind
    // every shot-out pane (the dark room)
    this.glassMeshes = {};
    const addGlass = (list, mat, kind) => {
      if (!list.length) return;
      const m = new THREE.Mesh(merge(list), mat);
      m.userData.facadeGlass = kind;
      m.userData.surf = 'glass';
      g.add(m);
      this.glassMeshes[kind] = m;
    };
    addGlass(glassDark, M.glassDark, 'dark');
    addGlass(glassLit, M.windowLit, 'lit');
    addGlass(glassDim, M.windowLitDim, 'dim');
    if (blinds.length) {
      // (a round through a drawn blind breaks the pane behind it)
      const bm = new THREE.Mesh(merge(blinds), M.black);
      bm.userData.facadeGlass = 'any';
      g.add(bm);
    }

    this.buildFireEscape(g, X, -1.0);
    this.buildSign(g, X, -10.6);
    tagInk(g);
    this.group.add(g);
    this.near = g;
  }

  // (the old far / near swap round the diner is gone: one building, always
  // drawn; kept as a no-op for callers of the foundation's API)
  setNear() {}

  // ---- Phase 3a: shooting the windows ---------------------------------------
  bind(game) {
    this.game = game;
  }

  // a round hit a pane of the near building: find which one (the panes
  // are drawn merged, one mesh per kind); the pane cracks or goes
  hit(hit, dir) {
    const G = this.game;
    if (!G) return null;
    const kind = hit.mesh.userData.facadeGlass;
    let best = null, bd = Infinity;
    for (const w of this.windows) {
      if (w.kind !== kind && kind !== 'any') continue;
      const dz = Math.abs(hit.point.z - w.c.z) - w.w / 2, dy = Math.abs(hit.point.y - w.c.y) - w.h / 2;
      const d = Math.max(dz, dy);
      if (d < bd) { bd = d; best = w; }
    }
    if (!best || bd > 0.3) return null;
    // (the crack and the shatter are the panes' own: destruct/Glass.js)
    return this.world.glass.hit(best, { point: hit.point, normal: hit.normal, dir });
  }

  shatter(w, dir = new THREE.Vector3(-1, 0, 0)) { this.world.glass.shatter(w, { dir }); }

  // destruct/Glass.js: a lit pane that went dark moves into the dark mesh
  paneGone(w, from) {
    this.rebuildGlass(from);
    this.rebuildGlass('dark');
  }

  rebuildGlass(kind) {
    const G = this.game, m = this.glassMeshes[kind];
    if (!m) return;
    const keep = this.windows.filter((x) => x.kind === kind).map((x) => x.geo.clone());
    if (keep.length) { const old = m.geometry; m.geometry = merge(keep); old.dispose(); m.visible = true; G.rays.refresh(m); G.rays.setEnabled(m, true); }
    else { m.visible = false; G.rays.setEnabled(m, false); }
  }

  buildFireEscape(parent, X, zc) {
    const { M } = this.world;
    const parts = [];
    const L = 4.2, D = 1.15;
    const levels = [5.9, 9.5, 13.1, 16.7];
    for (let i = 0; i < levels.length; i++) {
      const y = levels[i];
      // platform (slatted grating read as a thin slab) + brackets
      parts.push(roundedBox(D, 0.06, L, 0.02).translate(X + D / 2, y, zc));
      parts.push(new THREE.CylinderGeometry(0.025, 0.025, 1.5, 6).rotateZ(Math.PI / 4.2).translate(X + 0.5, y - 0.55, zc - L / 2 + 0.2));
      parts.push(new THREE.CylinderGeometry(0.025, 0.025, 1.5, 6).rotateZ(Math.PI / 4.2).translate(X + 0.5, y - 0.55, zc + L / 2 - 0.2));
      // railing: posts + two rails
      for (let k = 0; k <= 6; k++) {
        const z = zc - L / 2 + (k / 6) * L;
        parts.push(new THREE.CylinderGeometry(0.018, 0.018, 1.0, 6).translate(X + D - 0.03, y + 0.5, z));
      }
      for (const ry of [0.5, 1.0]) {
        parts.push(new THREE.CylinderGeometry(0.022, 0.022, L, 6).rotateX(Math.PI / 2).translate(X + D - 0.03, y + ry, zc));
        parts.push(new THREE.CylinderGeometry(0.022, 0.022, D, 6).rotateZ(Math.PI / 2).translate(X + D / 2, y + ry, zc - L / 2));
        parts.push(new THREE.CylinderGeometry(0.022, 0.022, D, 6).rotateZ(Math.PI / 2).translate(X + D / 2, y + ry, zc + L / 2));
      }
      // stair to the next level (alternating direction)
      if (i < levels.length - 1) {
        const dir = i % 2 === 0 ? 1 : -1;
        const za = zc - dir * (L / 2 - 0.3), zb = zc + dir * (L / 2 - 0.9);
        const a = V3(X + 0.55, y + 0.03, za), b = V3(X + 0.55, levels[i + 1], zb);
        const len = a.distanceTo(b);
        const mid = a.clone().add(b).multiplyScalar(0.5);
        const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), b.clone().sub(a).normalize());
        for (const off of [-0.35, 0.35]) {
          const s = new THREE.BoxGeometry(0.04, len, 0.12);
          place(s, { pos: mid.clone().add(V3(off, 0, 0)), quat: q });
          parts.push(s);
        }
        // treads
        for (let k = 1; k < 10; k++) {
          const p = a.clone().lerp(b, k / 10);
          parts.push(new THREE.BoxGeometry(0.7, 0.03, 0.18).translate(p.x, p.y, p.z));
        }
      }
    }
    // drop ladder from the lowest platform
    // (at the platform's south end: over the diner's end bay, clear of its
    // sign over the door)
    const lz = zc - 1.2;
    parts.push(new THREE.CylinderGeometry(0.02, 0.02, 2.4, 6).translate(X + 0.3, levels[0] - 1.2, lz));
    parts.push(new THREE.CylinderGeometry(0.02, 0.02, 2.4, 6).translate(X + 0.75, levels[0] - 1.2, lz));
    for (let k = 0; k < 7; k++) parts.push(new THREE.CylinderGeometry(0.015, 0.015, 0.45, 5).rotateZ(Math.PI / 2).translate(X + 0.525, levels[0] - 0.2 - k * 0.33, lz));
    const m = new THREE.Mesh(merge(parts), M.iron);
    m.castShadow = true;
    parent.add(m);
  }

  // Vertical blade sign, unlit, monochrome paint.
  buildSign(parent, X, z) {
    const { M } = this.world;
    const c = document.createElement('canvas');
    c.width = 128; c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#1a1a1a'; g.fillRect(0, 0, 128, 512);
    g.strokeStyle = '#9a9a9a'; g.lineWidth = 6; g.strokeRect(10, 10, 108, 492);
    g.fillStyle = '#b8b8b8';
    g.font = 'bold 84px "Bodoni 72", Didot, Georgia, serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    'DINER'.split('').forEach((ch, i) => g.fillText(ch, 64, 62 + i * 96));
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, envMap: M.envSoft, envMapIntensity: 0.5 });
    // put letters on both broad faces via planes (rounded box has no face groups)
    const body = new THREE.Mesh(roundedBox(1.36, 4.7, 0.2, 0.06), M.paintedMetal);
    body.position.set(X + 0.95, 6.1, z);
    parent.add(body);
    for (const s of [1, -1]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 4.5), face);
      p.position.set(X + 0.95, 6.1, z + s * 0.105);
      if (s < 0) p.rotation.y = Math.PI;
      parent.add(p);
    }
    // bracket arms
    const arm = new THREE.Mesh(merge([
      new THREE.CylinderGeometry(0.03, 0.03, 1.8, 8).rotateZ(Math.PI / 2).translate(X + 0.9, 8.6, z),
      new THREE.CylinderGeometry(0.03, 0.03, 1.8, 8).rotateZ(Math.PI / 2).translate(X + 0.9, 3.6, z),
    ]), M.iron);
    parent.add(arm);
  }

  // ---------------------------------------------------------------------
  // Simpler blocks: left side past the cross street, cross-street depth,
  // warehouses beyond the overpass, and the block behind the player.
  buildFarBlocks(rng) {
    const { M } = this.world;
    const blocks = [];
    // left side past the cross street (z < -30)
    let z = -30;
    while (z > -260) {
      const w = rng.range(14, 26), h = rng.range(9, 17);
      blocks.push({ x0: STREET.facadeX - 18, x1: STREET.facadeX, z0: z, z1: z - w, h });
      z -= w + (rng.next() < 0.15 ? 10 : 0.3);
    }
    // cross street flanks (running off to the left)
    for (let x = -34; x > -120; x -= rng.range(16, 26)) {
      blocks.push({ x0: x - 14, x1: x, z0: -2, z1: -16, h: rng.range(10, 22) });
      blocks.push({ x0: x - 14, x1: x, z0: -30, z1: -44, h: rng.range(10, 20) });
    }
    // block behind the player
    z = 40;
    while (z < 120) {
      const w = rng.range(12, 20);
      blocks.push({ x0: STREET.facadeX - 18, x1: STREET.facadeX, z0: z + w, z1: z, h: rng.range(12, 24) });
      z += w + 0.3;
    }
    // (the low warehouse row beyond the right pavement is gone: in the fog it
    // printed as a line of outlined boxes. The el's arches now frame open
    // mist and the skyline, whose feet dissolve into the ground haze.)
    // The el leaves the avenue over the left row (fix 5): the row makes way
    // for it - its blocks between EL_GAP.z0 and z1 are not built (their rng
    // draws are still taken, so every other block keeps its shape and its
    // lit windows) - and a cross street opens under the el's turn, lined
    // with blocks of its own (buildElStreet, from its own stream).
    for (const b of blocks) b.skip = b.x1 === STREET.facadeX && b.z0 <= -30 && b.z0 > EL_GAP.z1 && b.z1 < EL_GAP.z0;
    const massParts = [], trimParts = [];
    for (const b of blocks) {
      if (b.skip) {
        const floors = Math.floor((b.h - 3) / 3.4), cols = Math.floor((b.z0 - b.z1) / 3.2);
        rng.range(0.03, 0.14);
        for (let k = 0; k < floors * cols; k++) rng.next();
        continue;
      }
      const w = b.x1 - b.x0, d = b.z0 - b.z1;
      const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
      massParts.push(new THREE.BoxGeometry(w, b.h, d).translate(cx, b.h / 2, cz));
      // cornice lip on the street side
      trimParts.push(new THREE.BoxGeometry(w + 0.8, 0.5, d + 0.8).translate(cx, b.h + 0.1, cz));
      // windows on the face toward the street
      const faceX = b.faceMinus ? b.x0 - 0.05 : b.x1 + 0.05;
      const rotY = b.faceMinus ? -Math.PI / 2 : Math.PI / 2;
      const floors = Math.floor((b.h - 3) / 3.4);
      const cols = Math.floor(d / 3.2);
      const litP = rng.range(0.03, 0.14);
      for (let f = 0; f < floors; f++) {
        for (let c = 0; c < cols; c++) {
          const wz = b.z1 + (c + 0.5) * (d / cols);
          const wy = 3.6 + f * 3.4;
          const m = new THREE.Matrix4().compose(V3(faceX, wy, wz), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0)), V3(1.3, 1.9, 1));
          (rng.next() < litP ? this.windowsLit : this.windowsDark).push(m);
        }
      }
    }
    this.buildElStreet(blocks, massParts, trimParts);
    // (the block's edges read them: every gap in the building line is
    // closed by a thing, stages/block/parts/bounds.js; the el's clipTest
    // reads them too)
    this.farBlocks = blocks.filter((b) => !b.skip);
    const mass = new THREE.Mesh(merge(massParts), M.brickFar);
    mass.castShadow = false; mass.receiveShadow = true;
    const trim = new THREE.Mesh(merge(trimParts), M.brickFar);
    this.farId = tagInk(mass); tagInk(trim, this.farId);
    this.group.add(mass, trim);
  }

  // The cross street under the el's turn: the left row's corners, then
  // blocks along both sides of the street the el follows west, each kept
  // clear of the el (its deck, columns and the train) by 2 m.
  buildElStreet(blocks, massParts, trimParts) {
    const rng = this.world.rng.fork(203);
    const ov = this.world.overpass;
    if (!ov) return;
    // the el's footprint past the avenue: points on its deck edges and its
    // columns
    const foot = [];
    // (the station at the turn reaches 7.5 m out from the track, its stair
    // further: world/Overpass.js buildStation)
    for (let s = ov.sAtZ(EL_GAP.z0 + 10); s <= ov.length + 9; s += 0.5) {
      const f = ov.frameAt(s);
      const st = ov.station;
      const wide = st && s > st.s0 - 2 && s < st.s1 + 14 ? 9.5 : 4.8;
      for (let k = -wide; k <= wide + 0.01; k += wide / 4) foot.push([f.P.x + f.N.x * k, f.P.z + f.N.z * k]);
    }
    const clear = 2.0;
    const elZ = (xa, xb) => {
      let lo = Infinity, hi = -Infinity;
      for (const [x, z] of foot) if (x > xa - clear && x < xb + clear) { lo = Math.min(lo, z); hi = Math.max(hi, z); }
      return [lo, hi];
    };
    const add = (b) => {
      blocks.push(b);
      const w = b.x1 - b.x0, d = b.z0 - b.z1;
      const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
      massParts.push(new THREE.BoxGeometry(w, b.h, d).translate(cx, b.h / 2, cz));
      trimParts.push(new THREE.BoxGeometry(w + 0.8, 0.5, d + 0.8).translate(cx, b.h + 0.1, cz));
      // a few windows on the face toward the cross street (+z or -z) and,
      // for the row's corners, toward the avenue
      const faces = b.faces || [];
      for (const fc of faces) {
        const along = fc === 'x' ? d : w;
        const floors = Math.floor((b.h - 3) / 3.4), cols = Math.floor(along / 3.2);
        const litP = rng.range(0.04, 0.12);
        for (let f = 0; f < floors; f++) for (let c = 0; c < cols; c++) {
          const u = (c + 0.5) * (along / cols), wy = 3.6 + f * 3.4;
          let pos, rotY;
          if (fc === 'x') { pos = V3(b.x1 + 0.05, wy, b.z1 + u); rotY = Math.PI / 2; }
          else if (fc === '+z') { pos = V3(b.x0 + u, wy, b.z0 + 0.05); rotY = 0; }
          else { pos = V3(b.x0 + u, wy, b.z1 - 0.05); rotY = Math.PI; }
          const m = new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0)), V3(1.3, 1.9, 1));
          (rng.next() < litP ? this.windowsLit : this.windowsDark).push(m);
        }
      }
    };
    const X0 = STREET.facadeX - 18, X1 = STREET.facadeX;
    // the row's corners: from the last block standing to the gap's edges,
    // each cut back to clear the el
    const row = blocks.filter((b) => b.x1 === X1 && b.z0 <= -30 && !b.skip);
    const north = Math.min(...row.filter((b) => b.z1 >= EL_GAP.z0).map((b) => b.z1));
    const south = Math.max(...row.filter((b) => b.z0 <= EL_GAP.z1).map((b) => b.z0));
    {
      const [lo, hi] = elZ(X0, X1);
      void lo;
      const z1 = Math.max(hi + clear, EL_GAP.z0 - 10);
      if (north - z1 > 4) add({ x0: X0, x1: X1, z0: north - 0.3, z1, h: rng.range(10, 16), faces: ['x', '-z'] });
    }
    // south corner: the row begins again past the el
    {
      let zTop = south;
      const [lo] = elZ(X0, X1);
      const z0 = Math.min(lo - clear, south + 30);
      if (z0 - south > 4) add({ x0: X0, x1: X1, z0, z1: south + 0.3, h: rng.range(10, 16), faces: ['x', '+z'] });
      void zTop;
    }
    // along the cross street, west to x -160: a block each side
    let x = X0;
    while (x > -165) {
      const w = rng.range(14, 24);
      const xa = x - w, xb = x;
      const [lo, hi] = elZ(xa, xb);
      if (hi > -Infinity) {
        const nz1 = hi + clear, nz0 = nz1 + rng.range(14, 22);
        add({ x0: xa, x1: xb, z0: nz0, z1: nz1, h: rng.range(10, 20), faces: ['-z'] });
        const sz0 = lo - clear, sz1 = sz0 - rng.range(14, 22);
        add({ x0: xa, x1: xb, z0: sz0, z1: sz1, h: rng.range(10, 20), faces: ['+z'] });
      }
      x = xa - (rng.chance(0.3) ? rng.range(6, 10) : 0.3);
    }
  }

  buildWindowInstances() {
    const { M } = this.world;
    const quad = new THREE.PlaneGeometry(1, 1);
    const mk = (list, mat) => {
      if (!list.length) return;
      const im = new THREE.InstancedMesh(quad, mat, list.length);
      list.forEach((m, i) => im.setMatrixAt(i, m));
      im.instanceMatrix.needsUpdate = true;
      im.userData.inkId = this.farId;
      im.userData.inkPerInstance = false;
      this.group.add(im);
    };
    mk(this.windowsDark, M.glassDark);
    mk(this.windowsLit, M.windowLit);
  }
}

// merge() strips uvs; the stone mass gets world UVs after merging instead.
function boxWorldUVAfter(g) { return g; }
void smoothNormals;

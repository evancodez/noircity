import * as THREE from 'three';
import { tagInk, allocInkId, allocIronId, markFigure } from '../render/layers.js';
import { lathe, merge, roundedBox, tube, catenaryPoints, V3 } from './geom.js';
import { STREET } from './Street.js';
import { OVERPASS } from './Overpass.js';

// Street dressing that layers silhouettes and gives cover: hydrant, trash
// cans, phone booth, newsstand, crates & barrels under the el, steam grates,
// manholes, and overhead wires (tram trolley wire + span wires).
export class Props {
  constructor(world) {
    this.world = world;
    this.group = new THREE.Group();
    this.group.name = 'props';
    world.scene.add(this.group);
    const P = STREET.pavementTop;
    this.items = [];     // Phase 3a: the shootable props (cans, booth, hydrants, grates)
    this.hydrant(V3(-6.55, P, -27.5));
    this.hydrant(V3(-6.55, P, -83));
    this.trashCan(V3(-9.55, P, -5.2), 0.2);
    this.trashCan(V3(-9.45, P, -6.25), -0.4, true);
    this.trashCan(V3(-6.8, P, -45.5), 0.9);
    this.trashCan(V3(-9.5, P, -66), 0.3);
    this.phoneBooth(V3(-8.9, P, -27.2), 0.0); // at the alley mouth past the corner
    this.newsstand(V3(-9.2, P, -36), 0);
    // cover clutter under the overpass
    this.crates(V3(4.6, 0, -40), 0.4);
    this.barrels(V3(12.5, 0, -24), 0.0);
    this.barrels(V3(8.6, 0, -84), 0.0);
    this.crates(V3(13.8, 0, -52), -0.3);
    // steam grates (vents consumed by fx/Steam)
    this.vents = [V3(-1.4, 0, -21.5), V3(3.6, 0, -47), V3(-3.4, 0, -79), V3(-1.0, 0, 6), V3(0.5, 0, -112)];
    for (const v of this.vents) this.grate(v);
    for (const m of [V3(-2.5, 0, -33), V3(-2.8, 0, -64), V3(2.2, 0, -90)]) this.manhole(m);
    this.flushStatic();
    this.wires();
  }

  // (Phase 3c performance pass) the props nobody can move - the crates, the
  // barrels, the manholes - are batched: one mesh (one ink id, one draw per
  // pass) per kind instead of one per pile; their colliders stay their own
  addStatic(kind, geo, mat, p, yaw, figure = false) {
    const B = this._static || (this._static = {});
    const m = new THREE.Matrix4().makeRotationY(yaw).setPosition(p);
    (B[kind] || (B[kind] = { mat, figure, geos: [] })).geos.push(geo.applyMatrix4(m));
  }

  flushStatic() {
    for (const [kind, b] of Object.entries(this._static || {})) {
      const m = new THREE.Mesh(merge(b.geos), b.mat);
      m.name = 'props_' + kind;
      if (b.figure) markFigure(m);   // inked like a car: the air light goes around it
      this.add(m);
    }
    this._static = null;
  }

  add(mesh, collider) {
    mesh.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    tagInk(mesh);
    this.group.add(mesh);
    if (collider) collider();
    return mesh;
  }

  hydrant(p) {
    const { M, colliders } = this.world;
    const body = lathe([
      [0, 0], [0.2, 0], [0.2, 0.06], [0.16, 0.1], [0.14, 0.12], [0.13, 0.55], [0.16, 0.58], [0.16, 0.64],
      [0.12, 0.68], [0.115, 0.72], [0.1, 0.8], [0.06, 0.86], [0.04, 0.9], [0.05, 0.92], [0, 0.95],
    ], 28);
    const nozzles = [
      new THREE.CylinderGeometry(0.055, 0.06, 0.34, 16).rotateZ(Math.PI / 2).translate(0, 0.46, 0),
      new THREE.CylinderGeometry(0.075, 0.075, 0.05, 6).rotateZ(Math.PI / 2).translate(0.17, 0.46, 0),
      new THREE.CylinderGeometry(0.075, 0.075, 0.05, 6).rotateZ(Math.PI / 2).translate(-0.17, 0.46, 0),
      new THREE.CylinderGeometry(0.07, 0.075, 0.16, 16).rotateX(Math.PI / 2).translate(0, 0.44, 0.13),
      new THREE.CylinderGeometry(0.085, 0.085, 0.05, 6).rotateX(Math.PI / 2).translate(0, 0.44, 0.22),
    ];
    const m = new THREE.Mesh(merge([body, ...nozzles]), M.paintedMetal);
    m.position.copy(p);
    m.rotation.y = 0.5;
    this.add(m, () => colliders.addCircle(p.x, p.z, 0.25, 'hydrant'));
    const hy = { kind: 'hydrant', mesh: m, pos: p.clone(), hits: 0, open: false, t: 0, acc: 0, ripT: 0 };
    m.userData.prop = hy;
    this.items.push(hy);
  }

  trashCan(p, yaw, tipped = false) {
    const { M, colliders } = this.world;
    const prof = [[0, 0.02], [0.24, 0.02], [0.25, 0.05]];
    for (let i = 0; i < 6; i++) {
      const y = 0.08 + i * 0.14;
      prof.push([0.26, y], [0.275, y + 0.035], [0.26, y + 0.07]);
    }
    prof.push([0.265, 0.92], [0.28, 0.94], [0.275, 0.96]);
    const can = lathe(prof, 32);
    const lid = lathe([[0.3, 0.0], [0.29, 0.03], [0.22, 0.07], [0.08, 0.1], [0.05, 0.14], [0.0, 0.15]], 32).translate(0, 0.95, 0);
    const handles = [
      new THREE.TorusGeometry(0.06, 0.012, 6, 16, Math.PI).translate(0, 0, 0).rotateY(Math.PI / 2).translate(0.28, 0.72, 0),
      new THREE.TorusGeometry(0.06, 0.012, 6, 16, Math.PI).rotateY(-Math.PI / 2).translate(-0.28, 0.72, 0),
    ];
    const g = new THREE.Group();
    const canM = new THREE.Mesh(merge([can, ...handles]), M.paintedMetal);
    const lidM = new THREE.Mesh(lid, M.paintedMetal);
    g.add(canM, lidM);
    g.position.copy(p);
    g.rotation.y = yaw;
    if (tipped) {
      lidM.position.set(0.55, -0.93, 0.2);
      lidM.rotation.set(0.2, 0, 1.45);
    }
    let col = null;
    this.add(g, () => { col = colliders.addCircle(p.x, p.z, 0.32, 'can'); });
    const item = { kind: 'can', group: g, can: canM, lid: lidM, pos: p.clone(), yaw, collider: col, hits: 0, dent: 0,
      tip: 0, tipDir: 0, vel: new THREE.Vector3(), spin: 0, down: false, lidOff: tipped, lidVel: null };
    g.traverse((o) => { if (o.isMesh) o.userData.prop = item; });
    this.items.push(item);
  }

  phoneBooth(p, yaw) {
    const { M, colliders } = this.world;
    const W = 1.0, D = 1.0, H = 2.45;
    const frame = [];
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) frame.push(roundedBox(0.1, H, 0.1, 0.03).translate(sx * (W / 2 - 0.05), H / 2, sz * (D / 2 - 0.05)));
    frame.push(roundedBox(W + 0.1, 0.25, D + 0.1, 0.05).translate(0, H + 0.1, 0));
    frame.push(lathe([[0.72, 0], [0.6, 0.1], [0.3, 0.2], [0.0, 0.24]], 4).rotateY(Math.PI / 4).translate(0, H + 0.22, 0));
    frame.push(roundedBox(W + 0.06, 0.2, D + 0.06, 0.04).translate(0, 0.1, 0));
    // mullions & kick panels on each side
    for (const s of [1, -1]) {
      frame.push(roundedBox(0.05, H - 0.4, 0.05, 0.015).translate(s * (W / 2 - 0.03), H / 2, 0));
      frame.push(roundedBox(0.05, H - 0.4, 0.05, 0.015).translate(0, H / 2, s * (D / 2 - 0.03)));
      for (const y of [0.9, 1.65]) {
        frame.push(roundedBox(0.04, 0.04, D - 0.1, 0.01).translate(s * (W / 2 - 0.03), y, 0));
        frame.push(roundedBox(W - 0.1, 0.04, 0.04, 0.01).translate(0, y, s * (D / 2 - 0.03)));
      }
    }
    const panes = [];
    for (const s of [1, -1]) {
      panes.push(new THREE.PlaneGeometry(D - 0.1, H - 0.5).rotateY(Math.PI / 2).translate(s * (W / 2 - 0.035), H / 2 + 0.1, 0));
      panes.push(new THREE.PlaneGeometry(W - 0.1, H - 0.5).translate(0, H / 2 + 0.1, s * (D / 2 - 0.035)));
    }
    const g = new THREE.Group();
    g.add(new THREE.Mesh(merge(frame), M.paintedMetal));
    const glassMat = M.glass.clone();
    glassMat.side = THREE.DoubleSide;
    const paneMesh = new THREE.Mesh(merge(panes), glassMat);
    paneMesh.userData.surf = 'glass';
    g.add(paneMesh);
    // interior dome light (dim) and the telephone box
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8).translate(0, H - 0.1, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 6, 6) }));
    g.add(lamp);
    g.add(new THREE.Mesh(roundedBox(0.25, 0.4, 0.15, 0.03).translate(0, 1.45, -D / 2 + 0.12), M.ironDark));
    g.position.copy(p);
    g.rotation.y = yaw;
    this.add(g, () => colliders.addBox(p.x, p.z, W / 2 + 0.05, D / 2 + 0.05, yaw, 'booth'));
    const booth = { kind: 'booth', group: g, paneMesh, panes: panes.map((geo, i) => ({ geo, hits: 0, broken: false, i })), pos: p.clone(), yaw, W, D, H };
    // pane centres / normals in the booth's frame: +x, +z, -x, -z faces
    const pc = [[W / 2 - 0.035, 0], [0, D / 2 - 0.035], [-(W / 2 - 0.035), 0], [0, -(D / 2 - 0.035)]];
    const order = [[1, 0], [1, 1], [-1, 0], [-1, 1]];
    booth.panes.forEach((pn, i) => {
      const [sgn, ax] = order[i];
      pn.c = ax === 0 ? V3(sgn * (W / 2 - 0.035), H / 2 + 0.1, 0) : V3(0, H / 2 + 0.1, sgn * (D / 2 - 0.035));
      pn.n = ax === 0 ? V3(sgn, 0, 0) : V3(0, 0, sgn);
    });
    void pc;
    g.traverse((o) => { if (o.isMesh) o.userData.prop = booth; });
    this.items.push(booth);
    const light = new THREE.PointLight(0xffffff, 3.0, 5, 2);
    light.position.set(p.x, p.y + H - 0.25, p.z);
    this.world.scene.add(light);
    this.world.lights.add({ position: light.position.clone(), direction: V3(0, -1, 0), halfAngle: Math.PI, range: 3, intensity: 0.25 });
  }

  newsstand(p, yaw) {
    const { M, colliders } = this.world;
    const parts = [
      roundedBox(1.9, 1.1, 0.9, 0.05).translate(0, 0.55, 0),
      roundedBox(2.1, 0.08, 1.2, 0.03).translate(0, 1.16, 0.12).rotateX(0.0),
      roundedBox(1.9, 1.2, 0.06, 0.02).translate(0, 1.8, -0.4),
      roundedBox(2.2, 0.1, 1.5, 0.04).translate(0, 2.45, 0.2),
    ];
    const g = new THREE.Mesh(merge(parts), M.wood);
    g.position.copy(p);
    g.rotation.y = yaw + Math.PI / 2;
    this.add(g, () => colliders.addBox(p.x, p.z, 0.5, 1.0, yaw, 'stand'));
    // stacked papers: pale slabs catch light
    const paper = new THREE.Mesh(merge([
      roundedBox(0.5, 0.12, 0.4, 0.02).translate(-0.5, 1.26, 0.25),
      roundedBox(0.5, 0.08, 0.4, 0.02).translate(0.2, 1.24, 0.25),
      roundedBox(0.45, 0.1, 0.38, 0.02).translate(0.7, 1.25, 0.2),
    ]), new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 0.9 }));
    paper.position.copy(p);
    paper.rotation.y = yaw + Math.PI / 2;
    this.add(paper);
  }

  crates(p, yaw) {
    const { M, colliders } = this.world;
    const parts = [
      roundedBox(1.1, 1.0, 1.1, 0.04).translate(0, 0.5, 0),
      roundedBox(1.0, 0.9, 1.0, 0.04).translate(1.15, 0.45, 0.1),
      roundedBox(0.9, 0.8, 0.9, 0.04).translate(0.4, 1.4, 0.05).rotateY(0.3),
    ];
    // slats
    for (const [cx, cy, s] of [[0, 0.5, 1.1], [1.15, 0.45, 1.0]]) {
      for (let k = -1; k <= 1; k++) parts.push(roundedBox(s + 0.04, 0.08, 0.06, 0.02).translate(cx, cy + k * 0.3, s / 2 + 0.03));
    }
    // unlit black (Phase 1c): under an el lamp the lit wood printed as
    // light-grey outline art; clutter is a black silhouette like the cars
    this.addStatic('crates', merge(parts), M.black, p, yaw, true);
    colliders.addBox(p.x + Math.cos(yaw) * 0.55, p.z - Math.sin(yaw) * 0.55, 1.2, 0.6, yaw, 'crates');
  }

  barrels(p, yaw) {
    const { M, colliders } = this.world;
    const prof = [[0, 0], [0.28, 0], [0.3, 0.04], [0.31, 0.12], [0.3, 0.16], [0.33, 0.3], [0.345, 0.44], [0.33, 0.58], [0.3, 0.72], [0.31, 0.76], [0.3, 0.84], [0.28, 0.88], [0, 0.88]];
    const b = lathe(prof, 28);
    const parts = [b.clone().translate(0, 0, 0), b.clone().translate(0.72, 0, 0.15), b.clone().rotateZ(Math.PI / 2).translate(0.35, 0.3, 0.85)];
    this.addStatic('barrels', merge(parts), M.paintedMetal, p, yaw);
    colliders.addBox(p.x + 0.36, p.z + 0.4, 0.8, 0.8, yaw, 'barrels');
  }

  grate(p) {
    const { M } = this.world;
    const parts = [roundedBox(1.5, 0.04, 1.0, 0.015).translate(0, 0.02, 0)];
    const bars = [];
    // a few heavy, unevenly spaced bars that barely stand proud of the frame:
    // thirteen even bars printed as a patch of ruled diagonal hatching (the
    // graph-paper look DESIGN.md forbids) under the lamp preset's light
    const xs = [-0.58, -0.37, -0.2, 0.04, 0.19, 0.41, 0.6];
    xs.forEach((x, i) => {
      const w = [0.05, 0.035, 0.06, 0.04, 0.055, 0.035, 0.05][i];
      bars.push(new THREE.BoxGeometry(w, 0.008, 0.86).translate(x, 0.043, (i % 3 - 1) * 0.012));
    });
    const frame = new THREE.Mesh(merge(parts), M.ironDark);
    const b = new THREE.Mesh(merge(bars), M.iron);
    const g = new THREE.Group();
    g.add(frame, b);
    g.position.copy(p);
    g.rotation.y = 0.1;
    this.add(g);
    const gr = { kind: 'grate', group: g, pos: p.clone(), puff: 0, acc: 0 };
    g.traverse((o) => { if (o.isMesh) o.userData.prop = gr; });
    this.items.push(gr);
  }

  manhole(p) {
    const { M } = this.world;
    const parts = [lathe([[0, 0.012], [0.35, 0.012], [0.4, 0.004], [0.42, 0.0]], 36)];
    for (let r = 0.1; r < 0.36; r += 0.08) parts.push(new THREE.TorusGeometry(r, 0.008, 4, 36).rotateX(Math.PI / 2).translate(0, 0.012, 0));
    this.addStatic('manholes', merge(parts), M.iron, p, 0);
  }

  // ---- Phase 3a: shooting the props --------------------------------------------
  bind(game) { this.game = game; }

  hit(prop, hit, dir, { weak = false } = {}) {
    const G = this.game;
    if (!G) return null;
    G.counters.props++;
    if (prop.kind === 'can') return this.hitCan(prop, hit, dir, weak);
    if (prop.kind === 'booth') return this.hitBooth(prop, hit, dir);
    if (prop.kind === 'hydrant') return this.hitHydrant(prop, hit, dir, weak);
    if (prop.kind === 'grate') { this.puffGrate(prop, 1); return null; }
    return null;
  }

  // a round near a vent (the street round a grate) makes it puff too
  nearGrate(x, z) {
    for (const it of this.items) if (it.kind === 'grate' && Math.hypot(it.pos.x - x, it.pos.z - z) < 0.9) return it;
    return null;
  }

  puffGrate(gr, k = 1) {
    gr.puff = Math.min(2.5, gr.puff + 0.9 * k);
    this.game.sfx.steam(gr.pos, k);
  }

  // dent (it squashes a little, rocks) then tumble over and roll, the lid
  // flying off
  hitCan(c, hit, dir, weak) {
    const G = this.game, r = this.rng || (this.rng = this.world.rng.fork(8181));
    c.hits++;
    c.dent = Math.min(0.14, c.dent + 0.035);
    G.sfx.clang(hit.point);
    const push = new THREE.Vector3(dir.x, 0, dir.z).normalize();
    if (!c.down && c.hits >= (weak ? 4 : 3)) {
      c.down = true;
      c.tipDir = Math.atan2(push.x, push.z);
      c.vel.copy(push).multiplyScalar(r.range(1.4, 2.2));
      c.spin = r.gauss() * 2;
      if (!c.lidOff) { c.lidOff = true; c.lidVel = push.clone().multiplyScalar(2.5).add(new THREE.Vector3(r.gauss(), 3.2, r.gauss())); }
      const cs = this.world.colliders.circles, i = cs.indexOf(c.collider);
      if (i >= 0) cs.splice(i, 1);
    } else if (!c.down) {
      c.rock = (c.rock || 0) + 0.25;
      c.vel.addScaledVector(push, 0.35);
    } else c.vel.addScaledVector(push, 1.2);
    return null;
  }

  hitBooth(b, hit, dir) {
    const G = this.game, r = this.rng || (this.rng = this.world.rng.fork(8181));
    if (hit.mesh !== b.paneMesh) return null;
    const inv = new THREE.Matrix4().copy(b.group.matrixWorld).invert();
    const lp = hit.point.clone().applyMatrix4(inv);
    let best = null, bd = Infinity;
    for (const pn of b.panes) { const d = pn.c.distanceToSquared(lp); if (d < bd) { bd = d; best = pn; } }
    if (!best || best.broken) return 'done';
    best.hits++;
    if (best.hits === 1) { G.fx.decals.crack(hit.point, hit.normal, 0.45, best); G.sfx.glass(hit.point, 0.35); return 'glass'; }
    best.broken = true;
    G.fx.decals.hideOwner(best);
    const keep = b.panes.filter((p) => !p.broken).map((p) => p.geo.clone());
    if (keep.length) { const old = b.paneMesh.geometry; b.paneMesh.geometry = merge(keep); old.dispose(); G.rays.refresh(b.paneMesh); }
    else { b.paneMesh.visible = false; G.rays.setEnabled(b.paneMesh, false); }
    const c = best.c.clone().applyMatrix4(b.group.matrixWorld), n = best.n.clone().transformDirection(b.group.matrixWorld);
    for (let k = 0; k < 16; k++) {
      const s = r.range(0.04, 0.1);
      G.fx.debris.spawn({
        pos: c.clone().add(new THREE.Vector3(r.gauss() * 0.25, r.gauss() * 0.5, r.gauss() * 0.25)),
        vel: n.clone().multiplyScalar(r.range(0.3, 1.8)).add(new THREE.Vector3(r.gauss() * 0.5, r.range(-0.2, 1), r.gauss() * 0.5)),
        life: r.range(0.8, 1.5), size: [s, s * 0.6], rot: r.next() * 6.28, spin: r.gauss() * 12,
        col: [0.35, 0.35, 0.35], cell: 12, gravity: 9.8, ground: 0.17, fadeOut: 0.15, lit: 2, litT: 0.1,
      });
    }
    G.sfx.glass(c, 1);
    G.counters.panes++;
    return 'glass';
  }

  // the hydrant: two rounds in the nozzle cap and it bursts - a white plume
  // of water, monochrome, rippling the street round it
  hitHydrant(hy, hit, dir, weak) {
    hy.hits++;
    this.game.sfx.clang(hit.point);
    if (!hy.open && hy.hits >= (weak ? 5 : 2)) {
      hy.open = true;
      hy.t = 0;
      this.game.sfx.hydrant(hy.pos);
    }
    return null;
  }

  // per fixed step (fx/React.js)
  update(dt, t) {
    const G = this.game;
    if (!G) return;
    const r = this.rng || (this.rng = this.world.rng.fork(8181));
    const F = G.fx;
    for (const it of this.items) {
      if (it.kind === 'can') this.stepCan(it, dt);
      else if (it.kind === 'grate' && it.puff > 0) {
        it.acc += dt * 26 * Math.min(1, it.puff);
        while (it.acc >= 1) {
          it.acc -= 1;
          const s = r.range(0.4, 0.8);
          F.smoke.spawn({
            pos: it.pos.clone().add(new THREE.Vector3(r.gauss() * 0.4, 0.1, r.gauss() * 0.3)),
            vel: new THREE.Vector3(r.gauss() * 0.3 + 0.3, r.range(2.5, 4.5) * Math.min(1, it.puff), r.gauss() * 0.3),
            life: r.range(1.2, 2.0), size: [s, s], grow: r.range(0.8, 1.3), rot: r.next() * 6.28, spin: r.gauss() * 0.4,
            col: [0.16, 0.16, 0.16], alpha: 0.55, drag: 1.2, fadeIn: 0.06, fadeOut: 0.6, cell: 8 + r.int(0, 3), lit: 0.5, litT: 0.3,
          });
        }
        it.puff = Math.max(0, it.puff - dt * 0.9);
      } else if (it.kind === 'hydrant' && it.open) {
        it.t += dt;
        const k = it.t < 25 ? 1 : Math.max(0, 1 - (it.t - 25) / 8);
        if (k <= 0) continue;
        const top = it.pos.clone().add(new THREE.Vector3(0, 0.9, 0));
        it.acc += dt * 150 * k;
        while (it.acc >= 1) {
          it.acc -= 1;
          // the plume: a white jet of drops thrown up and over toward the
          // road, falling back as spray (stretched along their flight: at
          // 10-20 m they print as a white column of streaks)
          const v = new THREE.Vector3(r.gauss() * 0.35 + 1.1, r.range(6.5, 9) * (0.6 + 0.4 * k), r.gauss() * 0.35);
          const sz = r.range(0.03, 0.07);
          F.splash.spawn({
            pos: top.clone().add(new THREE.Vector3(r.gauss() * 0.04, 0, r.gauss() * 0.04)), vel: v, life: r.range(1.2, 1.9), size: [sz, sz * 1.6], stretch: 0.07,
            col: [0.7, 0.7, 0.7], alpha: 0.95, cell: 4, gravity: 9.8, ground: 0.02, fadeOut: 0.12,
            onGround: (p) => { if (r.chance(0.04)) this.world.street.addImpact(this.world, p.pos.x, p.pos.z, 0.5); return false; },
          });
        }
        // mist off the column
        if (r.chance(dt * 10 * k)) {
          const s = r.range(0.35, 0.7);
          F.smoke.spawn({
            pos: top.clone().add(new THREE.Vector3(0.6 + r.gauss() * 0.3, r.range(1.5, 3), r.gauss() * 0.3)), vel: new THREE.Vector3(r.gauss() * 0.4 + 0.5, r.range(-0.3, 0.6), r.gauss() * 0.4),
            life: r.range(1.0, 1.6), size: [s, s], grow: 0.6, rot: r.next() * 6.28, col: [0.2, 0.2, 0.2], alpha: 0.2, drag: 1, fadeIn: 0.1, fadeOut: 0.6, cell: 8 + r.int(0, 3),
          });
        }
        // the street ripples round it where the spray comes down
        it.ripT -= dt;
        if (it.ripT <= 0) { it.ripT = r.range(0.12, 0.3); this.world.street.addImpact(this.world, it.pos.x + 1.5 + r.gauss() * 0.8, it.pos.z + r.gauss() * 0.9, 0.7 * k); }
      }
    }
  }

  stepCan(c, dt) {
    const G = this.game, g = c.group;
    let moved = false;
    if (c.rock > 0) { c.rock = Math.max(0, c.rock - dt * 1.2); moved = true; }
    if (c.down && c.tip < 1) { c.tip = Math.min(1, c.tip + dt * 3.2); moved = true; }
    if (c.vel.lengthSq() > 1e-4) {
      c.pos.addScaledVector(c.vel, dt);
      c.vel.multiplyScalar(Math.exp(-(c.down ? 1.6 : 6) * dt));
      this.world.colliders.resolve(c.pos, 0.3);
      c.roll = (c.roll || 0) + c.vel.length() * dt / 0.27;
      moved = true;
    }
    if (c.lidVel) {
      const L = c.lid;
      if (!c.lidWorld) { c.lidWorld = new THREE.Vector3().setFromMatrixPosition(L.matrixWorld); c.lidSpin = new THREE.Vector3(4, 7, 3); }
      c.lidVel.y -= 9.8 * dt;
      c.lidWorld.addScaledVector(c.lidVel, dt);
      if (c.lidWorld.y < STREET.pavementTop * (c.lidWorld.x < STREET.kerbX ? 1 : 0) + 0.03) {
        c.lidWorld.y = STREET.pavementTop * (c.lidWorld.x < STREET.kerbX ? 1 : 0) + 0.03;
        if (c.lidVel.y < -1) { c.lidVel.y *= -0.3; c.lidVel.x *= 0.5; c.lidVel.z *= 0.5; G.sfx.clang(c.lidWorld, 0.5); } else { c.lidVel = null; c.lidSpin.set(0, 0, 0); }
      }
      // the lid leaves the can's group: placed in world space via its parent's inverse
      const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
      L.position.copy(c.lidWorld).applyMatrix4(inv);
      L.rotation.x += c.lidSpin.x * dt; L.rotation.z += c.lidSpin.z * dt;
      if (!c.lidVel) { L.rotation.x = Math.PI; L.rotation.z = 0; }
      moved = true;
    }
    if (!moved) return;
    // pose: dented (squashed), rocking, tipped over along its push and rolling
    const s = 1 - c.dent;
    c.can.scale.set(s, 1 - c.dent * 0.4, 1 + c.dent * 0.3);
    const tipA = c.tip * Math.PI / 2 * 0.98;
    const rock = Math.sin((c.rock || 0) * 25) * (c.rock || 0) * 0.3;
    g.position.set(c.pos.x, c.pos.y + c.tip * 0.27, c.pos.z);
    const q = new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), c.tipDir);
    q.multiply(new THREE.Quaternion().setFromAxisAngle(V3(1, 0, 0), tipA + rock));
    q.multiply(new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), c.roll || 0));
    g.quaternion.copy(q);
    g.updateMatrixWorld(true);
    for (const m of [c.can, c.lid]) G.rays.refresh(m);
    c.shT = (c.shT ?? 0) + 1;
    if (c.shT % 10 === 0) G.pipeline.dirtyShadows();
  }

  wires() {
    const { M } = this.world;
    const ov = this.world.overpass;
    const parts = [];
    // Span wires from the façade to the el, only far down the block (beyond
    // z -60): the near spans and the old tram trolley wire (the rails are
    // retired) were the darkest lines in the upper half of the street view,
    // cutting diagonally across the sky, the tower cluster and the near
    // lamp's cone; the reference has no wires across its sky. Far spans are
    // sub-pixel threads that the ink lifts to grey with distance (iron ids).
    for (let z = -66; z > -150; z -= 24) {
      const f = ov.frameAt(ov.sAtZ(z));
      const col = f.P.clone().addScaledVector(f.N, -OVERPASS.halfW);
      const a = V3(STREET.facadeX + 0.05, 8.2, z);
      const b = V3(col.x - 0.3, 7.4, col.z);
      parts.push(tube(catenaryPoints(a, b, 0.55, 20), 0.014, 5, 40));
    }
    // a loose wire sagging along the façade (dark against the wall, never
    // across the sky from the street view)
    parts.push(tube(catenaryPoints(V3(STREET.facadeX + 0.05, 11.5, 12), V3(STREET.facadeX + 0.05, 10.8, -14), 1.2, 24), 0.018, 5, 48));
    const m = new THREE.Mesh(merge(parts), M.ironDark);
    // inked like the el's iron: black up close, lifting toward dark grey and
    // losing its contour with distance
    m.userData.inkId = allocIronId();
    this.group.add(m);
  }
}

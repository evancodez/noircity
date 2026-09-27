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
    this.wires();
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
    this.add(g, () => colliders.addCircle(p.x, p.z, 0.32, 'can'));
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
    g.add(new THREE.Mesh(merge(panes), glassMat));
    // interior dome light (dim) and the telephone box
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8).translate(0, H - 0.1, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 6, 6) }));
    g.add(lamp);
    g.add(new THREE.Mesh(roundedBox(0.25, 0.4, 0.15, 0.03).translate(0, 1.45, -D / 2 + 0.12), M.ironDark));
    g.position.copy(p);
    g.rotation.y = yaw;
    this.add(g, () => colliders.addBox(p.x, p.z, W / 2 + 0.05, D / 2 + 0.05, yaw, 'booth'));
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
    const m = new THREE.Mesh(merge(parts), M.black);
    m.position.copy(p);
    m.rotation.y = yaw;
    markFigure(m);   // inked like a car: the air light goes around it
    this.add(m, () => colliders.addBox(p.x + Math.cos(yaw) * 0.55, p.z - Math.sin(yaw) * 0.55, 1.2, 0.6, yaw, 'crates'));
  }

  barrels(p, yaw) {
    const { M, colliders } = this.world;
    const prof = [[0, 0], [0.28, 0], [0.3, 0.04], [0.31, 0.12], [0.3, 0.16], [0.33, 0.3], [0.345, 0.44], [0.33, 0.58], [0.3, 0.72], [0.31, 0.76], [0.3, 0.84], [0.28, 0.88], [0, 0.88]];
    const b = lathe(prof, 28);
    const parts = [b.clone().translate(0, 0, 0), b.clone().translate(0.72, 0, 0.15), b.clone().rotateZ(Math.PI / 2).translate(0.35, 0.3, 0.85)];
    const m = new THREE.Mesh(merge(parts), M.paintedMetal);
    m.position.copy(p);
    m.rotation.y = yaw;
    this.add(m, () => colliders.addBox(p.x + 0.36, p.z + 0.4, 0.8, 0.8, yaw, 'barrels'));
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
  }

  manhole(p) {
    const { M } = this.world;
    const parts = [lathe([[0, 0.012], [0.35, 0.012], [0.4, 0.004], [0.42, 0.0]], 36)];
    for (let r = 0.1; r < 0.36; r += 0.08) parts.push(new THREE.TorusGeometry(r, 0.008, 4, 36).rotateX(Math.PI / 2).translate(0, 0.012, 0));
    const m = new THREE.Mesh(merge(parts), M.iron);
    m.position.copy(p);
    this.add(m);
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

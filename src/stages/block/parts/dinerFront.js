import * as THREE from 'three';
import { DINER, dinerOpenings, dinerInSight } from '../site.js';
import { tagInk } from '../../../render/layers.js';
import { boxWorldUV, merge } from '../../../world/geom.js';

// The diner's street front (docs/story/CONTRACTS.md §15; lane 4's brief 1):
// the front wall of the four ground-floor bays between the pilasters at
// z = 11.6 and z = -6.0, its plate glass, the door in bay B3.
// API (stage.part('dinerFront')):
//   door    { object, open(), close(), isOpen, angle (0 shut .. 1 open),
//             on('open' | 'close', fn) }    the leaf, hinged at z = 0.12,
//             opens inwards when the player comes to it, closes behind him;
//             its collider follows the leaf
//   panes   { B1, B2, B4, B3L, B3R }  (destruct/Glass.js panes: pane.state,
//             game.glass.hit / shatter; B4 is the end bay, the KO window)
//   group   the front's meshes    near   true while the diner is in sight
// The diner is drawn only while it can be seen (site.js dinerInSight: the
// eye north of z = -7.5 or inside): otherwise the near building is its old
// solid block (world/Facade.js setNear) and nothing of the diner is drawn,
// shadowed or lit, so every accepted frame stays what it was.
//
// FOUNDATION STUB (lane 4 owns this file): a plain stone wall with plain
// openings, stand-in glass (lane 1's makeGlassMaterial stub), a plain leaf,
// real colliders; no riser tiles, sign, awning, gutter or window light yet.
export default {
  name: 'dinerFront', order: 130, tick: 130,
  build(stage) {
    const { M, colliders } = stage;
    const D = DINER, X = D.faceX, Xi = D.innerX;
    const g = new THREE.Group();
    g.name = 'dinerFront';
    g.visible = false;
    stage.scene.add(g);
    const ops = dinerOpenings();

    // ---- the wall: boxes round the openings (y from the floor to the
    // ceiling line; the building's mass stands above it)
    const parts = [];
    const slab = (za, zb, ya, yb) => { if (zb - za > 1e-3 && yb - ya > 1e-3) parts.push(new THREE.BoxGeometry(D.wallT, yb - ya, zb - za).translate((X + Xi) / 2, (ya + yb) / 2, (za + zb) / 2)); };
    const cuts = [...ops].sort((a, b) => a.z0 - b.z0);
    let z = D.zMin;
    for (const o of cuts) {
      slab(z, o.z0, D.floorY, D.ceilY);            // the pier between openings
      slab(o.z0, o.z1, D.floorY, o.y0);            // under it (the riser)
      slab(o.z0, o.z1, o.y1, D.ceilY);             // over it
      z = o.z1;
    }
    slab(z, D.zMax, D.floorY, D.ceilY);
    // (a transom bar at the head of each window)
    for (const o of ops) if (!o.door) parts.push(new THREE.BoxGeometry(0.08, 0.05, o.z1 - o.z0).translate(X - 0.1, D.window.head + 0.02, (o.z0 + o.z1) / 2));
    const geo = boxWorldUV(merge(parts), 1 / 12);
    const wall = new THREE.Mesh(geo, M.stone);
    wall.castShadow = true; wall.receiveShadow = true;
    wall.name = 'dinerFrontWall';
    g.add(wall);

    // ---- the plate glass (lane 3's panes; lane 1's glass)
    const panes = {};
    for (const o of ops) {
      if (o.door) continue;
      const h = (o.name.startsWith('B3') ? D.window.transom : D.window.head) - o.y0;
      panes[o.name] = stage.glass.addPane({
        centre: new THREE.Vector3(X - 0.12, o.y0 + h / 2, (o.z0 + o.z1) / 2), normal: new THREE.Vector3(1, 0, 0),
        w: o.z1 - o.z0, h, tag: 'diner.' + o.name, parent: g,
      });
    }

    // ---- the door: a leaf hinged at its south jamb, opening inwards
    const dz = D.door, hinge = new THREE.Group();
    hinge.position.set(Xi, D.floorY, dz.hingeZ);
    g.add(hinge);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.045, dz.h, dz.w).translate(-0.03, dz.h / 2, dz.w / 2), M.paintedMetal || M.stone);
    leaf.castShadow = true;
    leaf.name = 'dinerDoor';
    hinge.add(leaf);
    const col = colliders.addBox(Xi - 0.03, dz.hingeZ + dz.w / 2, 0.04, dz.w / 2, 0, 'door');
    const listeners = { open: [], close: [] };
    const door = {
      object: hinge, leaf, collider: col, angle: 0, target: 0, isOpen: false, holdT: 0,
      on(ev, fn) { (listeners[ev] || (listeners[ev] = [])).push(fn); return door; },
      open() { if (door.target !== 1) { door.target = 1; for (const f of listeners.open) f(door); } door.holdT = 1.5; },
      close() { if (door.target !== 0) { door.target = 0; for (const f of listeners.close) f(door); } },
    };
    tagInk(g);

    // ---- colliders: the front wall (with the plinth before it) except the
    // doorway, the pilasters, and the room's net (the doorway and the room)
    const cz0 = D.zMin - 0.3, cz1 = D.zMax + 0.3, px = 0.26;
    // (from the wall's inner face out to the plinth's front, x -9.93)
    const wx0 = Xi, wx1 = X + 0.27;
    const wallBox = (za, zb) => colliders.addBox((wx0 + wx1) / 2, (za + zb) / 2, (wx1 - wx0) / 2, (zb - za) / 2, 0, 'wall');
    wallBox(cz0, dz.hingeZ);
    wallBox(dz.hingeZ + dz.w, cz1);
    for (const pz of D.pilasters) colliders.addBox(X + 0.18, pz, px, D.pilasterW / 2, 0, 'wall');
    colliders.addRegion(Xi - 1.2, X + 1.2, dz.hingeZ, dz.hingeZ + dz.w, 'diner.door');
    colliders.addRegion(D.backX, Xi, D.zMin, D.zMax, 'diner');
    stage.addAnchor('diner.door.out', { pos: { x: X + 0.9, y: D.floorY, z: dz.hingeZ + dz.w / 2 }, yaw: -Math.PI / 2, r: 1.0 });
    stage.addAnchor('diner.door.in', { pos: { x: Xi - 0.9, y: D.floorY, z: dz.hingeZ + dz.w / 2 }, yaw: Math.PI / 2, r: 1.0 });
    stage.addAnchor('diner.pavement.ko', { pos: { x: -8.9, y: 0.15, z: D.bays.B4 + 0.2 }, yaw: Math.PI / 2, r: 1.6 });

    return { group: g, wall, door, panes, near: null, stage, facade: stage.part('facade') };
  },

  update(api, dt, t, camera) {
    const near = dinerInSight(camera.position);
    if (near !== api.near) {
      api.near = near;
      api.group.visible = near;
      // (out of sight nothing of it is a bullet's target either)
      const G = api.stage.game;
      if (G) api.group.traverse((o) => { if (o.isMesh) G.rays.setEnabled(o, near); });
      api.facade && api.facade.setNear(near);
    }
    // the door: opens when the eye comes within 2 m of it, closes 1.5 s
    // after it has gone
    const d = api.door, D = DINER;
    const e = camera.position;
    if (Math.hypot(e.x - D.faceX, e.z - (D.door.hingeZ + D.door.w / 2)) < 2.0) d.open();
    else if (d.target === 1 && (d.holdT -= dt) <= 0) d.close();
    const prev = d.angle;
    d.angle += Math.sign(d.target - d.angle) * Math.min(Math.abs(d.target - d.angle), dt * 2.2);
    if (d.angle !== prev) {
      const a = -Math.PI / 2 * d.angle * (2 - d.angle);
      d.object.rotation.y = a;
      d.isOpen = d.angle > 0.95;
      // the collider follows the leaf (a box along it, turned with it); a
      // leaf on the swing does not shove a man out of the doorway
      const c = d.collider, w = D.door.w;
      const rest = d.angle === 0 || d.angle === 1;
      c.angle = a; c.c = Math.cos(a); c.s = Math.sin(a);
      c.cx = D.innerX - 0.03 * Math.cos(a) + (w / 2) * Math.sin(a);
      c.cz = rest ? D.door.hingeZ + 0.03 * Math.sin(a) + (w / 2) * Math.cos(a) : 1e6;
    }
  },
};

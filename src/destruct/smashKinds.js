import * as THREE from 'three';
import { merge, roundedBox } from '../world/geom.js';
import { propGeo, LAMP } from '../city/kits/street.js';
import { crateGeo, fenceGeo } from '../stages/riverroad/smashKinds.js';
import { SURF } from '../util/RayWorld.js';

// [O6] The kinds of the destruction set (lane O6, docs/seams/SMASH.md): how
// each meets a car, a round and a push, its numbers, its draw. A car meets a
// ROUND thing as the track's circle (Car.vsCircle's give: below giveAt m/s it
// is a post that stops it, above it goes over and the car keeps drag of its
// speed and takes hurt x the speed over of a damage step); a BOX thing in
// Smash.collide (the same rule). `how`: lean (a post bends at its base,
// fallAt and over: down flat), shear (off its stem: the head flies, water),
// tumble (a rigid body: over, rolling, sliding), break (to pieces), tear
// (an awning), pane (shop glass). `shot`: what a round does. `cap`: how
// many of the kind may be out of their merge at once (its pool).
//   tags: the colliders' tags of the kind (bounds' and track's: how the
//   city's own are found); fp: the footprint's half sizes (local x, z);
//   h: its height; light: a car kicks it on where it lies (else a bump);
//   lie: where it lies it stops a man (a box)
export const KINDS = {
  lamp: { round: true, r: 0.22, h: 6.3, giveAt: 4.5, fallAt: 11, drag: 0.8, hurt: 0.035, how: 'lean', shot: 'lamp', lamp: true, cap: 24, mat: 'iron', surf: SURF.IRON, sound: 'c3_post', knock: 'clang', tags: ['lamp', 'post'], restLean: 0.06 },
  pole: { round: true, r: 0.17, h: 9, giveAt: 6, fallAt: 13, drag: 0.74, hurt: 0.05, how: 'lean', shot: 'wood', cap: 8, mat: 'iron', surf: SURF.STONE, sound: 'b9post', knock: 'b9thunk', tags: ['pole'], restLean: 0.03 },
  namesign: { round: true, r: 0.12, h: 3.0, giveAt: 2.5, fallAt: 7, drag: 0.96, hurt: 0.01, how: 'lean', shot: 'knock', hp: 4, cap: 16, mat: 'iron', surf: SURF.IRON, sound: 'c3_post', knock: 'clang', tags: ['sign'], restLean: 0.03 },
  stop: { round: true, r: 0.12, h: 2.7, giveAt: 2.5, fallAt: 7, drag: 0.96, hurt: 0.01, how: 'lean', shot: 'knock', hp: 3, cap: 8, mat: 'iron', surf: SURF.IRON, sound: 'c3_post', knock: 'clang', tags: ['sign'], restLean: 0.03 },
  hydrant: { round: true, r: 0.3, h: 0.8, giveAt: 3, drag: 0.88, hurt: 0.03, how: 'shear', shot: 'leak', cap: 24, mat: 'kerb', surf: SURF.IRON, sound: 'smash_hydrant', knock: 'clang', tags: ['hydrant'], light: true, mu: 0.4, bounce: 0.3 },
  bin: { round: true, r: 0.3, h: 0.94, giveAt: 1.2, drag: 0.965, hurt: 0.01, how: 'tumble', shot: 'knock', hp: 1, cap: 32, mat: 'kerb', surf: SURF.IRON, sound: 'city_bin', knock: 'city_bin', tags: ['bin'], light: true, roll: true, lift: 1.6, carry: 1.05, mu: 0.35, bounce: 0.3 },
  callbox: { round: true, r: 0.45, h: 2.05, giveAt: 3.5, drag: 0.86, hurt: 0.025, how: 'tumble', shot: 'box', hp: 6, cap: 12, mat: 'kerb', surf: SURF.IRON, sound: 'smash_stand', knock: 'clang', tags: ['callbox'], lie: true, lift: 0.8, carry: 0.7 },
  bench: { fp: [0.85, 0.27], h: 1.0, giveAt: 2.2, drag: 0.9, hurt: 0.02, how: 'tumble', shot: 'wood', hp: 0, cap: 16, mat: 'tree', surf: SURF.STONE, sound: 'smash_crate', knock: 'b9thunk', tags: ['bench'], lie: true, lift: 1.4, carry: 0.85, lieDrag: 0.94 },
  stall: { fp: [1.32, 0.52], h: 2.3, giveAt: 1.8, drag: 0.7, hurt: 0.07, how: 'tumble', shot: 'goods', hp: 6, cap: 16, mat: 'tree', surf: SURF.STONE, sound: 'smash_stall', knock: 'b9thunk', tags: ['stall'], goods: true, lie: true, lift: 1.0, carry: 0.6, lieDrag: 0.88, mu: 0.6 },
  newsstand: { fp: [0.82, 0.52], h: 2.0, giveAt: 3, drag: 0.8, hurt: 0.05, how: 'tumble', shot: 'papers', hp: 8, cap: 8, mat: 'kerb', surf: SURF.STONE, sound: 'smash_stand', knock: 'b9thunk', tags: ['stand'], papers: true, lie: true, lift: 0.9, carry: 0.55, lieDrag: 0.9, mu: 0.6 },
  crate: { fp: [0.31, 0.21], h: 0.34, giveAt: 0.8, drag: 0.975, hurt: 0.01, how: 'break', shot: 'knock', hp: 2, cap: 48, mat: 'wood', surf: SURF.STONE, sound: 'smash_crate', knock: 'b9crate', tags: ['crate'], light: true, lift: 2, carry: 1.05 },
  fence: { fp: [1.15, 0.06], h: 1.9, giveAt: 1.5, drag: 0.88, hurt: 0.04, how: 'tumble', shot: 'wood', hp: 3, cap: 24, mat: 'wood', surf: SURF.STONE, sound: 'smash_fence', knock: 'w_fenceHit', tags: ['fence'], lie: false, lift: 0.8, carry: 0.6, light: true },
  // (an awning: an object of its own on a wall; only a tall thing reaches it)
  awning: { high: true, low: 2.45, h: 0.6, giveAt: 0, drag: 1, hurt: 0, how: 'tear', shot: 'tear', hp: 3, mat: 'cloth', surf: SURF.STONE, sound: 'awning_tear', tags: ['awning'], proxy: false, bounce: 0.1, mu: 0.8 },
  // (shop glass: a Glass pane; its rounds are the pane's own)
  glass: { pane: true, h: 2, giveAt: 0, drag: 0.97, hurt: 0.02, how: 'pane', shot: 'pane', mat: 'kerb', sound: 'glass', tags: ['glass'], proxy: false },
};
// the city's furniture kinds (cityGen's C.props) -> the set's
export const KIND_OF = { hydrant: 'hydrant', bin: 'bin', callbox: 'callbox', bench: 'bench', stall: 'stall', newsstand: 'newsstand', namesign: 'namesign', stop: 'stop', pole: 'pole' };

const CACHE = new Map();
// a kind's whole shape (local: its base's middle at the origin, +x along it)
export function kindGeo(kind) {
  if (CACHE.has(kind)) return CACHE.get(kind);
  let g;
  switch (kind) {
    case 'lamp': g = merge([LAMP.iron.clone(), LAMP.shade.clone()]); break;
    case 'namesign': g = merge([propGeo('namepost').clone(), new THREE.BoxGeometry(0.05, 0.24, 1.25).translate(0, 2.68, 0), new THREE.BoxGeometry(1.25, 0.24, 0.05).translate(0, 2.4, 0)]); break;
    case 'crate': g = crateGeo(); break;
    case 'fence': g = fenceGeo(); break;
    case 'awning': g = awningGeo(3, 1.5); break;
    default: g = propGeo(kind).clone();
  }
  CACHE.set(kind, g);
  return g;
}

// an awning on a wall: a canvas raked down from the wall (local -z) to its
// scalloped edge (local +z), its two iron arms (w wide, d deep)
export function awningGeo(w = 3, d = 1.5) {
  const cv = new THREE.PlaneGeometry(w, d, 1, 3);
  const p = cv.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const u = (p.getY(i) + d / 2) / d;     // 0 at the wall, 1 at the edge
    p.setXYZ(i, p.getX(i), -u * 0.55 - Math.sin(u * Math.PI) * 0.05, u * d);
  }
  cv.computeVertexNormals();
  const hem = [];
  for (let i = 0; i < 8; i++) hem.push(new THREE.BoxGeometry(w / 8 - 0.02, 0.2 - (i % 2) * 0.05, 0.012).translate(-w / 2 + (i + 0.5) * w / 8, -0.65 + (i % 2) * 0.025, d));
  const arms = [-w / 2 + 0.06, w / 2 - 0.06].map((x) => new THREE.BoxGeometry(0.03, 0.03, d * 1.02).rotateX(-0.36).translate(x, -0.28, d / 2));
  return merge([cv.toNonIndexed(), ...hem, ...arms]);
}
export { roundedBox };

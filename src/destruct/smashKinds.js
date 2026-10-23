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
//   (after the critic: a car pays for iron - a lamp post or a telegraph pole
//   about half its speed, a hydrant or a call box a third, a stall a third;
//   two lamps at 50 km/h and it steams, four or five iron things and it
//   smokes, more and it burns)
//   tags: the colliders' tags of the kind (bounds' and track's: how the
//   city's own are found); fp: the footprint's half sizes (local x, z);
//   h: its height; light: a car kicks it on where it lies (else a bump);
//   lie: where it lies it stops a man (a box)
export const KINDS = {
  lamp: { round: true, r: 0.22, h: 6.3, giveAt: 4.5, fallAt: 11, drag: 0.55, hurt: 0.07, how: 'lean', shot: 'lamp', lamp: true, cap: 24, mat: 'iron', surf: SURF.IRON, sound: 'c3_post', knock: 'clang', tags: ['lamp', 'post'], restLean: 0.06 },
  pole: { round: true, r: 0.17, h: 9, giveAt: 6, fallAt: 13, drag: 0.55, hurt: 0.075, how: 'lean', shot: 'wood', cap: 8, mat: 'iron', surf: SURF.STONE, sound: 'b9post', knock: 'b9thunk', tags: ['pole'], restLean: 0.03 },
  namesign: { round: true, r: 0.12, h: 3.0, giveAt: 2.5, fallAt: 7, drag: 0.9, hurt: 0.01, how: 'lean', shot: 'knock', hp: 4, cap: 16, mat: 'iron', surf: SURF.IRON, sound: 'c3_post', knock: 'clang', tags: ['sign'], restLean: 0.03 },
  stop: { round: true, r: 0.12, h: 2.7, giveAt: 2.5, fallAt: 7, drag: 0.9, hurt: 0.01, how: 'lean', shot: 'knock', hp: 3, cap: 8, mat: 'iron', surf: SURF.IRON, sound: 'c3_post', knock: 'clang', tags: ['sign'], restLean: 0.03 },
  hydrant: { round: true, r: 0.3, h: 0.8, giveAt: 3, drag: 0.68, hurt: 0.04, how: 'shear', shot: 'leak', cap: 24, mat: 'kerb', surf: SURF.IRON, sound: 'smash_hydrant', knock: 'clang', tags: ['hydrant'], light: true, mu: 0.4, bounce: 0.3 },
  bin: { round: true, r: 0.3, h: 0.94, giveAt: 1.2, drag: 0.94, hurt: 0.01, how: 'tumble', shot: 'knock', hp: 1, cap: 32, mat: 'kerb', surf: SURF.IRON, sound: 'city_bin', knock: 'city_bin', tags: ['bin'], light: true, roll: true, lift: 1.6, carry: 1.05, mu: 0.35, bounce: 0.3 },
  callbox: { round: true, r: 0.45, h: 2.05, giveAt: 3.5, drag: 0.7, hurt: 0.04, how: 'tumble', shot: 'box', hp: 6, cap: 12, mat: 'kerb', surf: SURF.IRON, sound: 'smash_stand', knock: 'clang', tags: ['callbox'], lie: true, lift: 0.8, carry: 0.7 },
  bench: { fp: [0.85, 0.27], h: 1.0, giveAt: 2.2, drag: 0.84, hurt: 0.025, how: 'tumble', shot: 'wood', hp: 0, cap: 16, mat: 'tree', surf: SURF.STONE, sound: 'smash_crate', knock: 'b9thunk', tags: ['bench'], lie: true, lift: 1.4, carry: 0.85, lieDrag: 0.94 },
  stall: { fp: [1.32, 0.52], h: 2.3, giveAt: 1.8, drag: 0.66, hurt: 0.07, how: 'tumble', shot: 'goods', hp: 6, cap: 16, mat: 'tree', surf: SURF.STONE, sound: 'smash_stall', knock: 'b9thunk', tags: ['stall'], goods: true, lie: true, lift: 1.0, carry: 0.6, lieDrag: 0.88, mu: 0.6 },
  newsstand: { fp: [0.82, 0.52], h: 2.0, giveAt: 3, drag: 0.72, hurt: 0.05, how: 'tumble', shot: 'papers', hp: 8, cap: 8, mat: 'kerb', surf: SURF.STONE, sound: 'smash_stand', knock: 'b9thunk', tags: ['stand'], papers: true, lie: true, lift: 0.9, carry: 0.55, lieDrag: 0.9, mu: 0.6 },
  crate: { fp: [0.31, 0.21], h: 0.34, giveAt: 0.8, drag: 0.975, hurt: 0.01, how: 'break', shot: 'knock', hp: 2, cap: 48, mat: 'wood', surf: SURF.STONE, sound: 'smash_crate', knock: 'b9crate', tags: ['crate'], light: true, lift: 2, carry: 1.05 },
  fence: { fp: [1.15, 0.06], h: 1.9, giveAt: 1.5, drag: 0.85, hurt: 0.04, how: 'tumble', shot: 'wood', hp: 3, cap: 24, mat: 'wood', surf: SURF.STONE, sound: 'smash_fence', knock: 'w_fenceHit', tags: ['fence'], lie: false, lift: 0.8, carry: 0.6, light: true },
  // (an awning: an object of its own on a wall; only a tall thing reaches it)
  // [O6b] (low: its valance's hem under its fixing - a lorry's roof, 3.3 m, reaches the city's at 3.85; a car's
  // 1.75 never: the old 2.45 over the fixing was out of reach of anything. cap: a pool for the city's
  // awnings, records in the near chunks' merge, drawn as the pool's canvas scaled to their width)
  awning: { high: true, low: -0.6, h: 0.6, giveAt: 0, drag: 1, hurt: 0, how: 'tear', shot: 'tear', hp: 3, cap: 12, mat: 'cloth', surf: SURF.STONE, sound: 'awning_tear', tags: ['awning'], proxy: false, bounce: 0.1, mu: 0.8 },
  // [O6b] the el's hung lamps (no post: a round in the head puts one out; a car, a blast never reach it)
  hanglamp: { lamp: true, high: true, low: 99, how: 'fixed', shot: 'lamp', h: 0.4, giveAt: 99, drag: 1, hurt: 0, hp: 1, surf: SURF.IRON, sound: 'zap', knock: 'clang', tags: ['hanglamp'], proxy: false },
  // [O6b] the parts that come off a car (CarDamage, the user's must: "car damage ... physical
  // within reason"): things of the set once they are off - never standing (Smash.spawnPart),
  // a rigid body that flies, rests and is swept by the cap and the mend at a distance. The
  // bonnet and a door lie as a man's box and are heavy to a car (a bump that slows it, a
  // shove); a bumper and a wheel are kicked on. Their pool's shape is scaled to the car's part
  // (it.S); `paintable`: drawn in its car's paint (the instance's colour)
  carbonnet: { part: true, paintable: true, h: 0.06, giveAt: 0, drag: 0.97, hurt: 0, how: 'part', shot: 'knock', cap: 10, mat: 'paint', surf: SURF.IRON, sound: 'o6b_flap', knock: 'clang', tags: ['part'], lie: true, lieDrag: 0.94, mu: 0.45, bounce: 0.15, scrub: 1.6 },
  cardoor: { part: true, paintable: true, h: 0.62, giveAt: 0, drag: 0.97, hurt: 0, how: 'part', shot: 'knock', cap: 12, mat: 'paint', surf: SURF.IRON, sound: 'o6b_door', knock: 'clang', tags: ['part'], lie: true, lieDrag: 0.92, mu: 0.5, bounce: 0.18 },
  carbumper: { part: true, h: 0.17, giveAt: 0, drag: 0.98, hurt: 0, how: 'part', shot: 'knock', cap: 12, mat: 'chrome', surf: SURF.IRON, sound: 'clang', knock: 'clang', tags: ['part'], light: true, mu: 0.4, bounce: 0.25 },
  carwheel: { part: true, h: 0.75, giveAt: 0, drag: 0.98, hurt: 0, how: 'part', shot: 'knock', cap: 12, mat: 'rubber', surf: SURF.STONE, sound: 'o6b_wheel', knock: 'b9thunk', tags: ['part'], light: true, mu: 0.6, bounce: 0.35, topple: true },
  // (shop glass: a Glass pane; its rounds are the pane's own)
  glass: { pane: true, h: 2, giveAt: 0, drag: 0.97, hurt: 0.02, how: 'pane', shot: 'pane', mat: 'kerb', sound: 'glass', tags: ['glass'], proxy: false },
  // [O1b] the streets' new things (world/dressing.js C.dress, one record each;
  // their shapes: city/kits/dress.js PIECES through street.js propGeo, which
  // kindGeo falls back to). A kind's name is its record's kind and its
  // collider's tag, so bounds' and track's solids are found by itemAt
  crates: { fp: [0.55, 0.42], h: 0.9, giveAt: 1.0, drag: 0.93, hurt: 0.02, how: 'break', shot: 'knock', hp: 2, cap: 24, mat: 'wood', surf: SURF.STONE, sound: 'smash_crate', knock: 'b9crate', tags: ['crates'], light: true, lift: 1.6, carry: 1.0 },
  barrels: { round: true, r: 0.62, h: 0.84, giveAt: 2.0, drag: 0.85, hurt: 0.03, how: 'tumble', shot: 'knock', hp: 3, cap: 10, mat: 'wood', surf: SURF.STONE, sound: 'smash_crate', knock: 'b9thunk', tags: ['barrels'], roll: true, lift: 1.0, carry: 0.8, mu: 0.4, bounce: 0.25 },
  barrel: { round: true, r: 0.33, h: 0.84, giveAt: 1.5, drag: 0.92, hurt: 0.02, how: 'tumble', shot: 'knock', hp: 2, cap: 16, mat: 'wood', surf: SURF.STONE, sound: 'smash_crate', knock: 'b9thunk', tags: ['barrel'], light: true, roll: true, lift: 1.3, carry: 0.95, mu: 0.4, bounce: 0.25 },
  churns: { round: true, r: 0.4, h: 0.72, giveAt: 1.2, drag: 0.95, hurt: 0.01, how: 'tumble', shot: 'knock', hp: 1, cap: 12, mat: 'kerb', surf: SURF.IRON, sound: 'city_bin', knock: 'clang', tags: ['churns'], light: true, roll: true, lift: 1.4, carry: 1.0, mu: 0.35, bounce: 0.3 },
  mailbox: { round: true, r: 0.3, h: 1.1, giveAt: 3.0, drag: 0.75, hurt: 0.03, how: 'tumble', shot: 'box', hp: 5, cap: 8, mat: 'kerb', surf: SURF.IRON, sound: 'smash_stand', knock: 'clang', tags: ['mailbox'], lie: true, lift: 0.8, carry: 0.6 },
  booth: { fp: [0.55, 0.55], h: 2.6, giveAt: 3.5, drag: 0.7, hurt: 0.05, how: 'tumble', shot: 'box', hp: 6, cap: 6, mat: 'kerb', surf: SURF.IRON, sound: 'smash_stand', knock: 'clang', tags: ['booth'], lie: true, lift: 0.7, carry: 0.55, lieDrag: 0.9, mu: 0.6 },
  fruit: { fp: [1.15, 0.42], h: 2.1, giveAt: 1.8, drag: 0.7, hurt: 0.05, how: 'tumble', shot: 'goods', hp: 6, cap: 12, mat: 'tree', surf: SURF.STONE, sound: 'smash_stall', knock: 'b9thunk', tags: ['fruit'], goods: true, lie: true, lift: 1.0, carry: 0.6, lieDrag: 0.88, mu: 0.6 },
  flowers: { round: true, r: 0.5, h: 0.7, giveAt: 1.0, drag: 0.95, hurt: 0.01, how: 'tumble', shot: 'goods', hp: 2, cap: 10, mat: 'kerb', surf: SURF.IRON, sound: 'city_bin', knock: 'city_bin', tags: ['flowers'], goods: true, light: true, lift: 1.4, carry: 1.0 },
  board: { fp: [0.32, 0.28], h: 0.95, giveAt: 1.0, drag: 0.97, hurt: 0.005, how: 'tumble', shot: 'wood', hp: 2, cap: 12, mat: 'wood', surf: SURF.STONE, sound: 'smash_fence', knock: 'b9thunk', tags: ['board'], light: true, lift: 1.6, carry: 1.0 },
  bike: { fp: [0.88, 0.14], h: 1.0, giveAt: 1.0, drag: 0.96, hurt: 0.01, how: 'tumble', shot: 'knock', hp: 2, cap: 12, mat: 'iron', surf: SURF.IRON, sound: 'city_bin', knock: 'clang', tags: ['bike'], light: true, lift: 1.2, carry: 0.9 },
  bins: { round: true, r: 0.5, h: 0.95, giveAt: 1.2, drag: 0.93, hurt: 0.01, how: 'tumble', shot: 'knock', hp: 1, cap: 16, mat: 'kerb', surf: SURF.IRON, sound: 'city_bin', knock: 'city_bin', tags: ['bins'], light: true, roll: true, lift: 1.6, carry: 1.05, mu: 0.35, bounce: 0.3 },
  rainbarrel: { round: true, r: 0.38, h: 0.9, giveAt: 1.6, drag: 0.9, hurt: 0.02, how: 'tumble', shot: 'knock', hp: 2, cap: 10, mat: 'wood', surf: SURF.STONE, sound: 'smash_crate', knock: 'b9thunk', tags: ['rainbarrel'], roll: true, lift: 1.0, carry: 0.85, mu: 0.4, bounce: 0.2 },
  drums: { round: true, r: 0.62, h: 0.88, giveAt: 2.0, drag: 0.85, hurt: 0.03, how: 'tumble', shot: 'knock', hp: 3, cap: 10, mat: 'kerb', surf: SURF.IRON, sound: 'city_bin', knock: 'clang', tags: ['drums'], roll: true, lift: 1.0, carry: 0.8, mu: 0.35, bounce: 0.3 },
  cart: { fp: [1.15, 0.6], h: 1.1, giveAt: 2.2, drag: 0.85, hurt: 0.03, how: 'tumble', shot: 'wood', hp: 4, cap: 6, mat: 'wood', surf: SURF.STONE, sound: 'smash_crate', knock: 'b9thunk', tags: ['cart'], lie: true, lift: 0.9, carry: 0.7, lieDrag: 0.9 },
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
    // [O6b] (a car's parts, each a unit a car's own scales: the bonnet a crowned
    // plate 1 m long, a door a panel 1 m, a bumper's bar 1 m across, a wheel -
    // tyre and hub - its axle along y, 0.75 m across; middles at the origin)
    case 'carbonnet': g = roundedBox(1, 0.05, 1, 0.02, 2); break;
    case 'cardoor': g = roundedBox(1, 0.62, 0.05, 0.02, 2); break;
    case 'carbumper': g = roundedBox(0.12, 0.15, 1, 0.05, 2); break;
    case 'carwheel': g = merge([new THREE.TorusGeometry(0.27, 0.105, 10, 24).rotateX(Math.PI / 2), new THREE.CylinderGeometry(0.22, 0.22, 0.12, 16)]); break;
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

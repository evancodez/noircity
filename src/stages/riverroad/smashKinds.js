import * as THREE from 'three';
import { merge, lathe, roundedBox, V3 } from '../../world/geom.js';

// The river road's things that a car goes through, as geometry (origin the
// middle of the base, +x along the road, +z toward the river, metres):
// whole things (drawn instanced while they stand and while they fly whole)
// and the pieces they come apart into. src/stages/riverroad/parts/smash.js
// places, draws and throws them.

const box = (w, h, d, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

// a fruit crate: slatted sides, corner posts, a low heap of fruit left to
// the fruit mesh (the crate is 0.62 x 0.34 x 0.42)
export function crateGeo() {
  const W = 0.62, H = 0.34, D = 0.42, t = 0.018;
  const parts = [box(W, 0.02, D, 0, 0.01, 0)];
  for (const y of [0.06, 0.17, 0.28]) {
    for (const z of [-D / 2 + t / 2, D / 2 - t / 2]) parts.push(box(W, 0.075, t, 0, y, z));
    for (const x of [-W / 2 + t / 2, W / 2 - t / 2]) parts.push(box(t, 0.075, D - 2 * t, x, y, 0));
  }
  for (const x of [-W / 2 + 0.025, W / 2 - 0.025]) for (const z of [-D / 2 + 0.025, D / 2 - 0.025]) parts.push(box(0.045, H, 0.045, x, H / 2, z));
  return merge(parts);
}
// the fruit heaped in a crate (one mesh per crate: a dozen apples)
export function fruitHeapGeo(rng) {
  const parts = [];
  for (let i = 0; i < 12; i++) {
    const r = 0.055 + rng.next() * 0.015;
    parts.push(new THREE.SphereGeometry(r, 9, 7).translate(-0.24 + (i % 4) * 0.16 + rng.gauss() * 0.015, 0.3 + (i % 3 === 1 ? 0.03 : 0), -0.12 + Math.floor(i / 4) * 0.12 + rng.gauss() * 0.015));
  }
  return merge(parts);
}
export const CRATE = { w: 0.62, h: 0.34, d: 0.42 };

// a barrel: a lathe with its hoops (0.58 across, 0.86 tall)
export function barrelGeo() {
  const prof = [];
  for (let i = 0; i <= 16; i++) {
    const u = i / 16, y = u * 0.86;
    prof.push([0.25 + 0.045 * Math.sin(u * Math.PI), y]);
  }
  const body = lathe([[0, 0], ...prof, [0, 0.86]], 22);
  const hoops = [0.08, 0.26, 0.6, 0.78].map((y) => new THREE.TorusGeometry(0.25 + 0.045 * Math.sin((y / 0.86) * Math.PI) + 0.006, 0.012, 5, 22).rotateX(Math.PI / 2).translate(0, y, 0));
  return merge([body, ...hoops]);
}
export const BARREL = { r: 0.29, h: 0.86 };

// a market stall: a trestle table (planks on two trestles), an awning of
// canvas raked toward the road on four poles, a crate bin under the table
// (3.0 wide along the road, 1.6 deep)
export function stallGeo() {
  const W = 3.0, D = 1.6;
  const parts = [];
  // the table top and its trestles
  for (let i = 0; i < 5; i++) parts.push(box(W, 0.035, 0.17, 0, 0.86, -0.36 + i * 0.18));
  for (const x of [-W / 2 + 0.35, W / 2 - 0.35]) {
    parts.push(box(0.06, 0.9, 0.06, x, 0.43, -0.38).rotateX(0));
    parts.push(box(0.06, 0.9, 0.06, x, 0.43, 0.38));
    parts.push(box(0.05, 0.05, 0.8, x, 0.3, 0));
  }
  // poles and the awning (raked down toward the road: -z is the road side)
  for (const x of [-W / 2 + 0.05, W / 2 - 0.05]) {
    parts.push(box(0.05, 2.35, 0.05, x, 1.175, -D / 2 + 0.05));
    parts.push(box(0.05, 2.7, 0.05, x, 1.35, D / 2 - 0.05));
  }
  const aw = new THREE.PlaneGeometry(W + 0.3, D + 0.5, 1, 4);
  const p = aw.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);    // -(D+0.5)/2 .. (D+0.5)/2: along the rake
    const u = (y + (D + 0.5) / 2) / (D + 0.5);
    p.setXYZ(i, p.getX(i), 2.3 + u * 0.45 - Math.sin(u * Math.PI) * 0.06, -D / 2 - 0.25 + u * (D + 0.5));
  }
  aw.computeVertexNormals();
  // the valance: a scalloped hem on the road side
  const val = [];
  for (let i = 0; i < 9; i++) val.push(box((W + 0.3) / 9 - 0.02, 0.22 - (i % 2) * 0.06, 0.01, -W / 2 - 0.15 + (i + 0.5) * (W + 0.3) / 9, 2.18 + (i % 2) * 0.03, -D / 2 - 0.25));
  return { frame: merge(parts), awning: merge([aw, ...val]) };
}
export const STALL = { w: 3.0, d: 1.6 };

// a board fence section between two posts (2.3 wide, 1.9 tall)
export function fenceGeo() {
  const parts = [];
  for (let i = 0; i < 12; i++) parts.push(box(0.17, 1.8 + (i % 3) * 0.05, 0.022, -1.1 + i * 0.19 + 0.095, 0.95, 0));
  for (const y of [0.35, 1.5]) parts.push(box(2.3, 0.09, 0.045, 0, y, 0.035));
  for (const x of [-1.12, 1.12]) parts.push(box(0.09, 1.95, 0.09, x, 0.97, 0.03));
  return merge(parts);
}
export const FENCE = { w: 2.3, h: 1.9 };

// the newsstand: a shuttered kiosk with a sloped roof and racks of papers
// on its road face (1.6 x 2.2 x 1.1)
export function standGeo() {
  const parts = [
    roundedBox(1.6, 1.9, 1.1, 0.03, 2).translate(0, 0.95, 0),
    box(1.9, 0.08, 1.45, 0, 2.02, -0.12).rotateX(-0.12),
    box(1.5, 0.05, 0.28, 0, 1.0, -0.66),
    box(1.5, 0.05, 0.28, 0, 1.35, -0.66),
  ];
  const papers = [];
  for (let i = 0; i < 6; i++) for (const y of [1.03, 1.38]) papers.push(box(0.22, 0.02, 0.3, -0.62 + i * 0.25, y, -0.66).rotateX(-0.25));
  return { frame: merge(parts), papers: merge(papers) };
}
export const STAND = { w: 1.6, d: 1.1 };

// a hydrant (the block's shape, simpler)
export function hydrantGeo() {
  return merge([
    lathe([[0, 0], [0.16, 0], [0.16, 0.05], [0.12, 0.08], [0.11, 0.55], [0.14, 0.58], [0.14, 0.64], [0.1, 0.7], [0.06, 0.78], [0, 0.8]], 18),
    new THREE.CylinderGeometry(0.045, 0.045, 0.34, 10).rotateZ(Math.PI / 2).translate(0, 0.46, 0),
    new THREE.CylinderGeometry(0.06, 0.06, 0.08, 10).rotateX(Math.PI / 2).translate(0, 0.44, -0.12),
  ]);
}

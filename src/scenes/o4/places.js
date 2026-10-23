import * as THREE from 'three';
import { std } from '../../props/lib.js';
import { buildProp } from '../../props/index.js';
import { allocInkId } from '../../render/layers.js';
import { makeTornStroke, hashSeed } from '../../ui/inkArt.js';

// [O4] The test bed's stand-ins for lane O5's rooms (the gun shop's counter,
// the gym's ring): built by the scene on the block's pavement and road, taken
// away when it leaves. Only what the rules need: solid (colliders), seen
// (ink ids), usable (the scene adds the prompts).
const V = (x, y, z) => new THREE.Vector3(x, y, z);
function mesh(geo, mat, id, cast = true) { const m = new THREE.Mesh(geo, mat); m.userData.inkId = id; m.castShadow = cast; m.receiveShadow = true; return m; }

// the gun shop's counter: a dark wooden counter with a glass-less top, a board
// behind it; on it the double, a box of shells, a box of .38 rounds
export function buildCounter(stage, { x, z, yaw = 0 }) {
  const g = new THREE.Group(); g.position.set(x, stage.surfaceY(x, z), z); g.rotation.y = yaw;
  const wood = std('o4Counter', { color: 0x1c1c1c, roughness: 0.8, surface: 'wood' });
  // ([O4] after the critic - a black smear on a dark box, the boxes unseen: the top
  // pale, a pale felt under the gun, the boxes pasteboard white and big enough to read
  // from where I stand, a pale board of pegs behind; the things a hand apart)
  const top = std('o4CounterTop', { color: 0x8a8781, roughness: 0.6, surface: 'wood' });
  const felt = std('o4Felt', { color: 0xd8d4ca, roughness: 0.95, surface: 'wood' });
  const card = std('o4Pasteboard', { color: 0xe4ded0, roughness: 0.9, surface: 'wood' });
  const band = std('o4Band', { color: 0x161616, roughness: 0.8, surface: 'wood' });
  const peg = std('o4Pegboard', { color: 0x7c7a75, roughness: 0.9, surface: 'wood' });
  const id = allocInkId(7);
  g.add(mesh(new THREE.BoxGeometry(2.2, 0.92, 0.62).translate(0, 0.46, 0), wood, id));
  g.add(mesh(new THREE.BoxGeometry(2.3, 0.05, 0.7).translate(0, 0.945, 0), top, id + 1));
  // the board behind (the stand-in of the shop's wall of guns)
  g.add(mesh(new THREE.BoxGeometry(2.4, 1.6, 0.06).translate(0, 1.7, -0.62), peg, id + 2));
  // the felt under the gun
  g.add(mesh(new THREE.BoxGeometry(1.05, 0.012, 0.42).translate(-0.62, 0.976, 0.04), felt, id + 3, false));
  const items = {};
  const lay = (kind, lx, lz, ry = 0) => {
    const o = buildProp(kind);
    o.position.set(lx, 0.97, lz); o.rotation.y = ry;
    if (kind === 'shotgun') { o.rotation.set(0, ry, Math.PI / 2); o.position.y = 0.995; }
    g.add(o);
    return o;
  };
  // a box of pasteboard, a dark band round it (its lettering), the count on the lid in rows
  const boxOf = (lx, lz, ry, w, h, d, k) => {
    const o = new THREE.Group(); o.position.set(lx, 0.97, lz); o.rotation.y = ry;
    o.add(mesh(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), card, id + 4 + k));
    o.add(mesh(new THREE.BoxGeometry(w + 0.004, h * 0.32, d + 0.004).translate(0, h * 0.5, 0), band, id + 4 + k, false));
    g.add(o);
    return o;
  };
  items.shotgun = lay('shotgun', -0.62, 0.05, Math.PI / 2 + 0.1);
  items.shells = boxOf(0.12, 0.04, 0.25, 0.2, 0.11, 0.28, 0);
  items.rounds = boxOf(0.62, -0.02, -0.2, 0.16, 0.08, 0.22, 1);
  stage.scene.add(g); g.updateMatrixWorld(true);
  const col = stage.colliders.addBox(x, z, 1.15, 0.36, yaw, 'counter');
  const back = stage.colliders.addBox(x - Math.sin(yaw) * 0.62, z - Math.cos(yaw) * 0.62, 1.2, 0.05, yaw, 'wall');
  return {
    group: g, items, cols: [col, back],
    at(item) { return items[item].getWorldPosition(V(0, 0, 0)).add(V(0, 0.08, 0)); },
    remove() { stage.scene.remove(g); for (const c of this.cols) { const i = stage.colliders.boxes.indexOf(c); if (i >= 0) stage.colliders.boxes.splice(i, 1); } },
  };
}

// the gym's ring: a canvas square a step up, four corner posts, three ropes a side
export function buildRing(stage, { x, z, size = 5.2 }) {
  const g = new THREE.Group(); const y0 = stage.surfaceY(x, z); g.position.set(x, y0, z);
  const canvas = std('o4Canvas', { color: 0x4c4c4c, roughness: 0.95, surface: 'wood' });
  const post = std('o4Post', { color: 0x101010, roughness: 0.5, surface: 'metal' });
  const rope = std('o4Rope', { color: 0x9a9a9a, roughness: 0.7, surface: 'wood' });
  const id = allocInkId(3);
  const h = size / 2;
  // (the canvas a hand above the street, its apron: the ring is a raised thing, read at a glance)
  g.add(mesh(new THREE.BoxGeometry(size + 0.5, 0.06, size + 0.5).translate(0, 0.03, 0), canvas, id, false));
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) g.add(mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.45, 16).translate(sx * h, 0.72, sz * h), post, id + 1));
  for (const y of [0.55, 0.9, 1.25]) {
    for (const [a, b] of [[[-h, -h], [h, -h]], [[h, -h], [h, h]], [[h, h], [-h, h]], [[-h, h], [-h, -h]]]) {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const r = mesh(new THREE.CylinderGeometry(0.018, 0.018, L, 8).rotateZ(Math.PI / 2), rope, id + 2, false);
      r.position.set((a[0] + b[0]) / 2, y - 0.02 * Math.sin(y * 7), (a[1] + b[1]) / 2);
      r.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]);
      g.add(r);
    }
  }
  stage.scene.add(g); g.updateMatrixWorld(true);
  const posts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => stage.colliders.addCircle(x + sx * h, z + sz * h, 0.12, 'post'));
  return {
    group: g, posts, size,
    // the fight's room: inside the ropes
    bounds: { x0: x - h + 0.3, x1: x + h - 0.3, z0: z - h + 0.3, z1: z + h - 0.3 },
    // my corner (inside) and his (the far one)
    mine: { x: x - h + 0.9, z: z + h - 0.9 }, his: { x: x + h - 0.9, z: z - h + 0.9 },
    // where the bout is taken up: outside my corner
    door: { x: x - h - 0.55, z: z + h + 0.55 },
    remove() { stage.scene.remove(g); for (const c of posts) { const i = stage.colliders.circles.indexOf(c); if (i >= 0) stage.colliders.circles.splice(i, 1); } },
  };
}

// a card in the game's lettering, top right while it is wanted: the shop's
// prices, the gym's bout (lines of text, the first the heading)
export function priceCard(hud, lines) {
  const el = hud.layer('o4card');
  const key = lines.join('|');
  if (el.dataset.key === key) return el;
  el.dataset.key = key;
  el.innerHTML = '';
  if (!lines.length) return el;
  const box = document.createElement('div');
  box.style.cssText = 'position:absolute; right:42px; top:76px; padding:18px 30px 20px; font-family:"American Typewriter","Courier New",monospace; color:#efede7; letter-spacing:0.22em; text-transform:uppercase; text-shadow:0 0 4px #000,0 0 2px #000; font-size:14px; line-height:1.85; white-space:pre;';
  const w = 360, hh = 40 + lines.length * 26;
  const bg = makeTornStroke(w, hh, hashSeed(key));
  bg.style.cssText = 'position:absolute; left:-20px; top:-6px; width:' + (w + 40) + 'px; height:' + (hh + 12) + 'px; z-index:-1; opacity:0.88;';
  box.appendChild(bg);
  lines.forEach((t, i) => { const d = document.createElement('div'); d.textContent = t; if (i === 0) { d.style.fontSize = '16px'; d.style.letterSpacing = '0.32em'; d.style.marginBottom = '4px'; } box.appendChild(d); });
  el.appendChild(box);
  return el;
}

import * as THREE from 'three';
import { allocInkId } from '../render/layers.js';

// [O2] after the critic (B1, B3): where a thing on wheels wants me, the world says so - the
// same lit mark everywhere, a few strokes, lit by the city's own lamp deal (lamps.addExtra:
// the nearest lamps get the real light and the haze's cone):
//   lantern(stage, x, z, { yaw })            a post at the kerb with a lit lantern: a fare's
//                                            drop-off (its pool of light on the pavement)
//   sawhorse(stage, x, z, { yaw, turn })     a race's corner: a white board on a trestle with
//                                            black chevrons pointing the way it turns (turn:
//                                            1 right, -1 left, as seen coming at it), its lantern
// Each -> { group, lamp, dispose() }. The meshes are solid to nothing (noRay): marks, not walls.
let GEO = null, BOARD = null;
function geo() {
  if (GEO) return GEO;
  GEO = {
    post: new THREE.CylinderGeometry(0.035, 0.045, 2.3, 8).translate(0, 1.15, 0),
    cap: new THREE.CylinderGeometry(0.11, 0.14, 0.06, 10).translate(0, 2.52, 0),
    glass: new THREE.CylinderGeometry(0.09, 0.09, 0.22, 10).translate(0, 2.38, 0),
    leg: new THREE.BoxGeometry(0.06, 1.0, 0.06),
    board: new THREE.BoxGeometry(1.7, 0.36, 0.05),
    chev: new THREE.BoxGeometry(0.07, 0.3, 0.06),
  };
  return GEO;
}
function boardMat() { return BOARD || (BOARD = new THREE.MeshStandardMaterial({ color: 0xcfcfc6, roughness: 0.85 })); }
function lampOf(stage, x, y, z) {
  const L = { x, z, yaw: 0, kind: 'o2mark', head: new THREE.Vector3(x, y, z), on: true, dead: false, _k: 1, cone: null, entry: null, hanging: false, power: 55, drop: y, noCone: false };
  const api = stage.part && stage.part('lamps');
  if (api && api.addExtra) api.addExtra([L]);
  return { L, api };
}
function finish(stage, g, lampAt) {
  const id = allocInkId(1);
  g.traverse((o) => { if (o.isMesh) { o.userData.inkId = id; o.userData.noRay = true; o.castShadow = false; o.receiveShadow = true; } });
  stage.scene.add(g);
  const { L, api } = lampOf(stage, lampAt.x, lampAt.y, lampAt.z);
  return {
    group: g, lamp: L,
    dispose() { if (g.parent) g.parent.remove(g); if (api && api.removeExtra) api.removeExtra([L]); },
  };
}
export function lantern(stage, x, z, { yaw = 0 } = {}) {
  const G = geo(), M = stage.M, g = new THREE.Group();
  g.add(new THREE.Mesh(G.post, M.iron), new THREE.Mesh(G.cap, M.iron), new THREE.Mesh(G.glass, M.bulb));
  g.position.set(x, stage.surfaceY ? stage.surfaceY(x, z) : 0, z);
  g.rotation.y = yaw;
  g.name = 'o2_lantern';
  return finish(stage, g, { x, y: g.position.y + 2.38, z });
}
export function sawhorse(stage, x, z, { yaw = 0, turn = 1 } = {}) {
  const G = geo(), M = stage.M, g = new THREE.Group();
  // (the trestle: two A-frames, the board across them at the knee)
  for (const sx of [-0.7, 0.7]) for (const sz of [-1, 1]) { const l = new THREE.Mesh(G.leg, M.wood); l.position.set(sx, 0.48, sz * 0.18); l.rotation.x = sz * 0.36; g.add(l); }
  const b = new THREE.Mesh(G.board, boardMat()); b.position.set(0, 0.9, 0); g.add(b);
  // (the chevrons: the way the course turns, black on the white)
  for (let i = 0; i < 4; i++) {
    const cx = -0.54 + i * 0.36;
    for (const s of [-1, 1]) { const c = new THREE.Mesh(G.chev, M.black); c.position.set(cx + turn * 0.04 * (s > 0 ? 1 : 1), 0.9 + s * 0.075, 0.03); c.rotation.z = -turn * s * 0.75; g.add(c); }
  }
  // (its lantern on a post at the board's end)
  const p = new THREE.Mesh(G.post, M.iron); p.position.set(0.82, 0, 0); p.scale.set(1, 0.62, 1); g.add(p);
  const gl = new THREE.Mesh(G.glass, M.bulb); gl.position.set(0.82, -0.92, 0); g.add(gl);
  g.position.set(x, stage.surfaceY ? stage.surfaceY(x, z) : 0, z);
  g.rotation.y = yaw;
  g.name = 'o2_sawhorse';
  g.updateMatrixWorld(true);
  const head = gl.getWorldPosition(new THREE.Vector3()); head.y += 2.38 * 1;
  return finish(stage, g, { x: head.x, y: g.position.y + 1.5, z: head.z });
}

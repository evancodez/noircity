import * as THREE from 'three';
import { Kit } from './kit.js';
import { tube, catenaryPoints, V3 } from '../../world/geom.js';
import { FLOOR } from './plan.js';

// The backlot's builder's tools (lane B4's, gathered here by lane C6 so the
// parts that build the places of the chase share them): the materials, a
// Kit, and the helpers that put a building's face together - its windows,
// doors, pipes, cornices; a building's mass and its collider; the iron of a
// fire escape; a wire. Not a part (no default export).
//   const A = arch(stage, 'seed')   A.MAT, A.K (a Kit: A.K.flush() at the end)
//   A.face(axis, at, n)                             a wall plane (x = at or z = at, outward normal n)
//   A.block(g, mat, x0, x1, z0, z1, h, { faces })   a mass with facades on the faces asked for
export function materials(stage) {
  const { M, tex } = stage;
  if (stage._blMAT) return stage._blMAT;
  const std = (o) => new THREE.MeshStandardMaterial(o);
  return (stage._blMAT = {
    brick: std({ color: 0x9c9c9c, map: tex.stone.map, bumpMap: tex.stone.bump, bumpScale: 0.3, roughness: 0.93, envMap: M.envSoft, envMapIntensity: 0.22 }),
    brickDark: std({ color: 0x626262, map: tex.stone.map, bumpMap: tex.stone.bump, bumpScale: 0.3, roughness: 0.95, envMap: M.envSoft, envMapIntensity: 0.18 }),
    trim: M.stoneTrim,
    glass: M.glassDark,
    lit: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.05, 1.05, 1.05) }),
    wood: std({ color: 0x404040, roughness: 0.88, envMap: M.envSoft, envMapIntensity: 0.12 }),
    woodDark: std({ color: 0x1e1e1e, roughness: 0.9, envMap: M.envSoft, envMapIntensity: 0.1 }),
    iron: M.iron,
    metal: M.paintedMetal,
    room: std({ color: 0x2e2e2e, roughness: 0.95, envMap: M.envSoft, envMapIntensity: 0.05 }),
    black: M.black,
    // [C6] the roofs' tar: wet, it gives back the grey of the sky (a roof that took no light at all was a black floor under half the frame)
    tar: std({ color: 0x3c3c3c, roughness: 0.42, envMap: M.envSoft, envMapIntensity: 0.9 }),
    tile: std({ color: 0x8a8a8a, roughness: 0.4, envMap: M.envSoft, envMapIntensity: 0.4 }),
    plaster: std({ color: 0x7c7c7c, roughness: 0.95, envMap: M.envSoft, envMapIntensity: 0.1 }),
    canvas: std({ color: 0x5a5a5a, roughness: 0.97, side: THREE.DoubleSide, envMap: M.envSoft, envMapIntensity: 0.05 }),
    // [C6] what can be gone over is drawn the same way every time: a pale
    // edge catching the light along its top (a fence's rail, a wall's coping,
    // a bin's rim); what can be gone under, a pale edge along its underside
    mark: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.62, 0.62, 0.62) }),
  });
}

export function arch(stage, seed = 6060) {
  const MAT = materials(stage);
  const rng = stage.rng.fork(seed);
  const K = new Kit(stage);
  const face = (axis, at, n) => ({ axis, at, n });
  // a box against a face: u along it, d out from it
  const fbox = (g, mat, F, u0, u1, y0, y1, d0, d1, uv) => {
    const a = F.at + F.n * d0, b = F.at + F.n * d1;
    if (F.axis === 'x') return K.box(g, mat, Math.min(a, b), Math.max(a, b), y0, y1, u0, u1, uv);
    return K.box(g, mat, u0, u1, y0, y1, Math.min(a, b), Math.max(a, b), uv);
  };
  const fplane = (g, mat, F, u, y, w, h, d, opts) => {
    const geo = new THREE.PlaneGeometry(w, h);
    if (F.axis === 'x') geo.rotateY(F.n > 0 ? Math.PI / 2 : -Math.PI / 2).translate(F.at + F.n * d, y, u);
    else geo.rotateY(F.n > 0 ? 0 : Math.PI).translate(u, y, F.at + F.n * d);
    return K.add(g, mat, geo, opts);
  };
  const lit = [];
  // a sash window: the dark glass (or lit), its frame, sill and meeting rail
  const window1 = (g, F, u, sill, w = 1.0, h = 1.6, isLit = false) => {
    const y = sill + h / 2;
    fplane(g, isLit ? MAT.lit : MAT.glass, F, u, y, w, h, 0.01, { cast: false, noRay: isLit });
    if (isLit) lit.push({ F, u, y });
    fbox(g, MAT.trim, F, u - w / 2 - 0.09, u + w / 2 + 0.09, sill + h, sill + h + 0.14, 0, 0.09);
    fbox(g, MAT.trim, F, u - w / 2 - 0.13, u + w / 2 + 0.13, sill - 0.07, sill, 0, 0.16);
    fbox(g, MAT.trim, F, u - w / 2 - 0.08, u - w / 2, sill, sill + h, 0, 0.07);
    fbox(g, MAT.trim, F, u + w / 2, u + w / 2 + 0.08, sill, sill + h, 0, 0.07);
    fbox(g, MAT.woodDark, F, u - w / 2, u + w / 2, sill + h * 0.5 - 0.025, sill + h * 0.5 + 0.025, 0, 0.04);
    fbox(g, MAT.woodDark, F, u - 0.02, u + 0.02, sill, sill + h, 0, 0.03);
  };
  // a door: its leaf proud of the wall in a heavy frame, a step
  // ([C6 3rd] each is written down, stage._blDoors: things.js makes every one
  // a locked door - run into it or press E against it, it rattles: "Locked.")
  const door = (g, F, u, w = 1.05, h = 2.2) => {
    (stage._blDoors || (stage._blDoors = [])).push({ F, u, w, h });
    fbox(g, MAT.woodDark, F, u - w / 2, u + w / 2, 0.12, h, 0, 0.05);
    fbox(g, MAT.trim, F, u - w / 2 - 0.12, u - w / 2, 0, h + 0.12, 0, 0.12);
    fbox(g, MAT.trim, F, u + w / 2, u + w / 2 + 0.12, 0, h + 0.12, 0, 0.12);
    fbox(g, MAT.trim, F, u - w / 2 - 0.12, u + w / 2 + 0.12, h, h + 0.16, 0, 0.14);
    fbox(g, MAT.trim, F, u - w / 2 - 0.1, u + w / 2 + 0.1, 0, 0.12, 0, 0.3);
  };
  // a doorway's frame only (the leaf is a thing of its own that moves)
  const doorFrame = (g, F, u, w = 1.05, h = 2.2) => {
    fbox(g, MAT.trim, F, u - w / 2 - 0.12, u - w / 2, 0, h + 0.12, 0, 0.12);
    fbox(g, MAT.trim, F, u + w / 2, u + w / 2 + 0.12, 0, h + 0.12, 0, 0.12);
    fbox(g, MAT.trim, F, u - w / 2 - 0.12, u + w / 2 + 0.12, h, h + 0.16, 0, 0.14);
    fbox(g, MAT.trim, F, u - w / 2 - 0.1, u + w / 2 + 0.1, 0, 0.1, 0, 0.26);
  };
  // a drainpipe from the roof to the ground, its hopper and shoe
  const pipe = (g, F, u, top) => {
    const off = 0.13;
    const p = (y) => (F.axis === 'x' ? V3(F.at + F.n * off, y, u) : V3(u, y, F.at + F.n * off));
    K.add(g, MAT.metal, tube([p(0.15), p(top - 0.3)], 0.055, 10, 2), { figure: true });
    const hop = new THREE.CylinderGeometry(0.14, 0.07, 0.3, 12);
    const hp = p(top - 0.15);
    K.add(g, MAT.metal, hop.translate(hp.x, hp.y, hp.z), { figure: true });
    for (let y = 1.6; y < top - 0.6; y += 2.4) {
      const b = p(y);
      const geo = F.axis === 'x' ? new THREE.BoxGeometry(off, 0.04, 0.2) : new THREE.BoxGeometry(0.2, 0.04, off);
      K.add(g, MAT.metal, geo.translate(F.axis === 'x' ? F.at + F.n * off / 2 : b.x, y, F.axis === 'x' ? b.z : F.at + F.n * off / 2));
    }
  };
  // rows of windows on a face between u0 and u1, bays `bay` apart, one row
  // per storey from `from`; skip ranges of u; a few lit
  const facade = (g, F, u0, u1, h, { bay = 3.1, from = 1, skip = [], litP = 0.05, pipes = [], w = 1.0, cornice = true, course = true } = {}) => {
    const n = Math.max(1, Math.floor((u1 - u0) / bay));
    const b = (u1 - u0) / n;
    for (let s = from; (s + 1) * FLOOR <= h + 0.4; s++) {
      for (let i = 0; i < n; i++) {
        const u = u0 + b * (i + 0.5);
        if (skip.some(([a, c]) => u > a && u < c)) continue;
        const isLit = s >= 2 && rng.next() < litP;
        window1(g, F, u, s * FLOOR + 0.95, w, 1.6, isLit);
      }
    }
    if (course && h > FLOOR + 1) fbox(g, MAT.trim, F, u0, u1, FLOOR - 0.12, FLOOR + 0.12, 0, 0.1);
    if (cornice) {
      fbox(g, MAT.trim, F, u0, u1, h - 0.5, h - 0.2, 0, 0.22);
      fbox(g, MAT.trim, F, u0, u1, h - 0.2, h, 0, 0.32);
    }
    for (const u of pipes) pipe(g, F, u, h - 0.3);
  };
  // a building mass (with its collider)
  const mass = (g, mat, x0, x1, z0, z1, h, y0 = 0, collide = true) => {
    K.box(g, mat, x0, x1, y0, y0 + h, z0, z1);
    if (collide && y0 < 2) K.collide(x0, x1, z0, z1, 'wall');
  };
  // a mass with facades on the faces asked for: faces { n, s, e, w: opts | true }
  // (n the face at z0 looking north, s at z1 looking south, e at x1, w at x0)
  const block = (g, mat, x0, x1, z0, z1, h, faces = {}) => {
    mass(g, mat, x0, x1, z0, z1, h);
    const opt = (o) => (o === true ? {} : o);
    if (faces.n) facade(g, face('z', z0, -1), x0, x1, h, opt(faces.n));
    if (faces.s) facade(g, face('z', z1, 1), x0, x1, h, opt(faces.s));
    if (faces.e) facade(g, face('x', x1, 1), z0, z1, h, opt(faces.e));
    if (faces.w) facade(g, face('x', x0, -1), z0, z1, h, opt(faces.w));
  };
  // an iron fire escape's landing: grating, frame, brackets, railing on its
  // open sides; F: the wall's face, u0..u1 along it, y its floor, d deep
  const landing = (g, F, u0, u1, y, d = 1.2, { holes = [], rail = true } = {}) => {
    for (let u = u0 + 0.04; u < u1 - 0.03; u += 0.085) {
      if (holes.some(([a, b]) => u > a && u < b)) {
        const H = holes.find(([a, b]) => u > a && u < b);
        if (H[2] > 0.02) fbox(g, MAT.iron, F, u - 0.017, u + 0.017, y - 0.03, y, 0.02, H[2]);
        if (H[3] < d - 0.02) fbox(g, MAT.iron, F, u - 0.017, u + 0.017, y - 0.03, y, H[3], d - 0.02);
        continue;
      }
      fbox(g, MAT.iron, F, u - 0.017, u + 0.017, y - 0.03, y, 0.02, d - 0.02);
    }
    fbox(g, MAT.iron, F, u0, u1, y - 0.1, y - 0.02, d - 0.05, d);
    fbox(g, MAT.iron, F, u0, u1, y - 0.1, y - 0.02, 0, 0.05);
    fbox(g, MAT.iron, F, u0, u0 + 0.05, y - 0.1, y - 0.02, 0, d);
    fbox(g, MAT.iron, F, u1 - 0.05, u1, y - 0.1, y - 0.02, 0, d);
    for (const u of [u0 + 0.3, (u0 + u1) / 2, u1 - 0.3]) {
      const a = F.axis === 'x' ? V3(F.at, y - 1.0, u) : V3(u, y - 1.0, F.at);
      const b = F.axis === 'x' ? V3(F.at + F.n * (d - 0.1), y - 0.08, u) : V3(u, y - 0.08, F.at + F.n * (d - 0.1));
      K.add(g, MAT.iron, tube([a, b], 0.022, 6, 2));
    }
    if (!rail) return;
    const top = y + 1.0;
    const side = (ua, ub, dd) => {
      fbox(g, MAT.iron, F, ua, ub, top - 0.04, top, dd - 0.025, dd + 0.025);
      fbox(g, MAT.iron, F, ua, ub, y + 0.12, y + 0.16, dd - 0.02, dd + 0.02);
      for (let u = ua + 0.06; u < ub; u += 0.13) fbox(g, MAT.iron, F, u - 0.009, u + 0.009, y, top, dd - 0.009, dd + 0.009);
    };
    side(u0, u1, d - 0.03);
    const end = (u) => {
      for (let dd = 0.08; dd < d - 0.05; dd += 0.13) fbox(g, MAT.iron, F, u - 0.009, u + 0.009, y, top, dd - 0.009, dd + 0.009);
      fbox(g, MAT.iron, F, u - 0.025, u + 0.025, top - 0.04, top, 0, d);
    };
    end(u0 + 0.025); end(u1 - 0.025);
  };
  // a flight of iron stairs from (uA, yA) down to (uB, yB) at depth dd from
  // the wall (its centre), w wide: two stringers, slatted treads, a handrail
  const flight = (g, F, uA, yA, uB, yB, dd, w = 0.64, { rails = 1 } = {}) => {
    const P = (u, y, d) => (F.axis === 'x' ? V3(F.at + F.n * d, y, u) : V3(u, y, F.at + F.n * d));
    for (const s of [-1, 1]) {
      const d = dd + s * w / 2;
      K.add(g, MAT.iron, tube([P(uA, yA - 0.06, d), P(uB, yB - 0.06, d)], 0.03, 6, 2));
      if (s > 0 || rails > 1) {
        K.add(g, MAT.iron, tube([P(uA, yA + 0.95, d), P(uB, yB + 0.95, d)], 0.022, 8, 2));
        const n = Math.max(3, Math.round(Math.abs(uA - uB) / 0.8));
        for (let i = 0; i <= n; i++) { const k = i / n, u = uA + (uB - uA) * k, y = yA + (yB - yA) * k; K.add(g, MAT.iron, tube([P(u, y, d), P(u, y + 0.95, d)], 0.012, 5, 2)); }
      }
    }
    const steps = Math.round(Math.abs(yA - yB) / 0.2);
    for (let i = 1; i < steps; i++) {
      const k = i / steps, u = uA + (uB - uA) * k, y = yA + (yB - yA) * k;
      for (const o of [-0.06, 0.0, 0.06]) fbox(g, MAT.iron, F, u + o * Math.sign(uB - uA) - 0.022, u + o * Math.sign(uB - uA) + 0.022, y - 0.035, y - 0.005, dd - w / 2 + 0.02, dd + w / 2 - 0.02);
    }
  };
  // a wire across, sagging
  const wire = (a, b, sag) => K.add('wires', MAT.iron, tube(catenaryPoints(a, b, sag, 20), 0.012, 4, 40), { cast: false, figure: true });
  return { MAT, K, rng, lit, face, fbox, fplane, window1, door, doorFrame, pipe, facade, mass, block, landing, flight, wire };
}

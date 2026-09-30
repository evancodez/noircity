import * as THREE from 'three';
import { Kit, holeyPanel } from '../kit.js';
import { tube, catenaryPoints, lathe, V3 } from '../../../world/geom.js';
import { accentMaterial } from '../../../render/accents.js';
import { markFigure, tagInk } from '../../../render/layers.js';
import { Steam } from '../../../fx/Steam.js';
import {
  FLOOR, L3Y, ESC, ROOM, STREET_WIN, WATCH_LAMP, HARBOR, BACKST, FENCES, LANE, YARD, PASSAGE, DEADEND, BOARD, GATE,
} from '../plan.js';

// The backlot's architecture (lane B4): brick and stone masses round the
// route, their windows (a few lit, high up), drainpipes, fire escapes
// criss-crossing overhead, wires, the board fences, the dead end, the
// street at each end, room 304's stand-in, the lamps and the one blue neon.
// Everything static is merged by building (one ink id each: the contours
// separate one building from the next). The things that move are
// parts/chase.js's.

export default {
  name: 'build', order: 60,
  build(stage) {
    const { M, tex, scene } = stage;
    const rng = stage.rng.fork(6060);
    const std = (o) => new THREE.MeshStandardMaterial(o);
    const MAT = {
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
    };
    const K = new Kit(stage);
    const api = { MAT, kit: K, lit: [] };

    // ---- a face and the things on it ----------------------------------------------------
    // face: { axis: 'x' | 'z', at, n: +1 | -1 } (the wall plane x = at or z =
    // at, its outward normal n along that axis); u runs along the face
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
    // a sash window: the dark glass (or lit), its frame, sill and meeting rail
    const window1 = (g, F, u, sill, w = 1.0, h = 1.6, lit = false) => {
      const y = sill + h / 2;
      fplane(g, lit ? MAT.lit : MAT.glass, F, u, y, w, h, 0.01, { cast: false, noRay: lit });
      if (lit) api.lit.push({ F, u, y });
      fbox(g, MAT.trim, F, u - w / 2 - 0.09, u + w / 2 + 0.09, sill + h, sill + h + 0.14, 0, 0.09);
      fbox(g, MAT.trim, F, u - w / 2 - 0.13, u + w / 2 + 0.13, sill - 0.07, sill, 0, 0.16);
      fbox(g, MAT.trim, F, u - w / 2 - 0.08, u - w / 2, sill, sill + h, 0, 0.07);
      fbox(g, MAT.trim, F, u + w / 2, u + w / 2 + 0.08, sill, sill + h, 0, 0.07);
      fbox(g, MAT.woodDark, F, u - w / 2, u + w / 2, sill + h * 0.5 - 0.025, sill + h * 0.5 + 0.025, 0, 0.04);
      fbox(g, MAT.woodDark, F, u - 0.02, u + 0.02, sill, sill + h, 0, 0.03);
    };
    // a door: its leaf proud of the wall in a heavy frame, a step
    const door = (g, F, u, w = 1.05, h = 2.2) => {
      fbox(g, MAT.woodDark, F, u - w / 2, u + w / 2, 0.12, h, 0, 0.05);
      fbox(g, MAT.trim, F, u - w / 2 - 0.12, u - w / 2, 0, h + 0.12, 0, 0.12);
      fbox(g, MAT.trim, F, u + w / 2, u + w / 2 + 0.12, 0, h + 0.12, 0, 0.12);
      fbox(g, MAT.trim, F, u - w / 2 - 0.12, u + w / 2 + 0.12, h, h + 0.16, 0, 0.14);
      fbox(g, MAT.trim, F, u - w / 2 - 0.1, u + w / 2 + 0.1, 0, 0.12, 0, 0.3);
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
      const s = p(0.2);
      const shoe = new THREE.CylinderGeometry(0.055, 0.055, 0.3, 10).rotateZ(Math.PI / 2 * (F.axis === 'x' ? 1 : 0)).rotateX(F.axis === 'z' ? Math.PI / 2 : 0);
      K.add(g, MAT.metal, shoe.translate(F.axis === 'x' ? F.at + F.n * 0.2 : s.x, 0.18, F.axis === 'x' ? s.z : F.at + F.n * 0.2));
    };
    // rows of windows on a face between u0 and u1, bays `bay` apart, one row
    // per storey from `from`; skip ranges of u; a few lit
    const facade = (g, F, u0, u1, h, { bay = 3.1, from = 1, skip = [], litP = 0.05, pipes = [], w = 1.0 } = {}) => {
      const n = Math.max(1, Math.floor((u1 - u0) / bay));
      const b = (u1 - u0) / n;
      for (let s = from; (s + 1) * FLOOR <= h + 0.4; s++) {
        for (let i = 0; i < n; i++) {
          const u = u0 + b * (i + 0.5);
          if (skip.some(([a, c]) => u > a && u < c)) continue;
          const lit = s >= 2 && rng.next() < litP;
          window1(g, F, u, s * FLOOR + 0.95, w, 1.6, lit);
        }
      }
      // the string course over the ground floor, a cornice at the top
      fbox(g, MAT.trim, F, u0, u1, FLOOR - 0.12, FLOOR + 0.12, 0, 0.1);
      fbox(g, MAT.trim, F, u0, u1, h - 0.5, h - 0.2, 0, 0.22);
      fbox(g, MAT.trim, F, u0, u1, h - 0.2, h, 0, 0.32);
      for (const u of pipes) pipe(g, F, u, h - 0.3);
    };
    // a building mass (with its collider)
    const mass = (g, mat, x0, x1, z0, z1, h, y0 = 0, collide = true) => {
      K.box(g, mat, x0, x1, y0, y0 + h, z0, z1);
      if (collide && y0 < 2) K.collide(x0, x1, z0, z1, 'wall');
    };
    // an iron fire escape's landing: grating, frame, brackets, railing on its
    // open sides; F: the wall's face, u0..u1 along it, y its floor, d deep
    const landing = (g, F, u0, u1, y, d = 1.2, { holes = [], rail = true } = {}) => {
      // the grating: slats across the landing, a frame round it
      for (let u = u0 + 0.04; u < u1 - 0.03; u += 0.085) {
        if (holes.some(([a, b, da, db]) => u > a && u < b)) {
          // (a stairwell: the slats stop at the hole's inner edge)
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
      // the brackets under it into the wall
      for (const u of [u0 + 0.3, (u0 + u1) / 2, u1 - 0.3]) {
        const a = F.axis === 'x' ? V3(F.at, y - 1.0, u) : V3(u, y - 1.0, F.at);
        const b = F.axis === 'x' ? V3(F.at + F.n * (d - 0.1), y - 0.08, u) : V3(u, y - 0.08, F.at + F.n * (d - 0.1));
        K.add(g, MAT.iron, tube([a, b], 0.022, 6, 2));
      }
      if (!rail) return;
      // the railing: a top rail, a mid rail, balusters, on the open sides
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
    const flight = (g, F, uA, yA, uB, yB, dd, w = 0.64) => {
      const P = (u, y, d) => (F.axis === 'x' ? V3(F.at + F.n * d, y, u) : V3(u, y, F.at + F.n * d));
      for (const s of [-1, 1]) {
        const d = dd + s * w / 2;
        K.add(g, MAT.iron, tube([P(uA, yA - 0.06, d), P(uB, yB - 0.06, d)], 0.03, 6, 2));
        // the handrail on the open side (the far side from the wall)
        if (s > 0) {
          K.add(g, MAT.iron, tube([P(uA, yA + 0.95, d), P(uB, yB + 0.95, d)], 0.022, 8, 2));
          const n = 5;
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

    // ================= Harbor Street: its south row, the far ends ================
    {
      const g = 'southRow';
      mass(g, MAT.brickDark, -80, 90, HARBOR.z1 + HARBOR.pave, 24, 13.2);
      const F = { axis: 'z', at: HARBOR.z1 + HARBOR.pave, n: -1 };
      facade(g, F, -40, 40, 13.2, { bay: 3.4, litP: 0.12, pipes: [-12.2, 12.8], skip: [[-6.6, -2.0], [6.6, 11]] });
      // shop fronts at street level: dark glass in heavy frames, a door
      for (const u of [-30, -21, -12.5, 17, 25.5, 33]) {
        fplane(g, MAT.glass, F, u, 1.7, 3.6, 2.4, 0.02, { cast: false });
        fbox(g, MAT.trim, F, u - 1.95, u + 1.95, 2.9, 3.2, 0, 0.12);
        fbox(g, MAT.trim, F, u - 1.95, u + 1.95, 0, 0.5, 0, 0.1);
      }
      door(g, F, -4.3); door(g, F, 8.8, 1.2, 2.4);
    }
    // the north side of the street, either side of the Harbor Building and the
    // east block (to the ends of the fog)
    {
      mass('westSt', MAT.brick, -80, -24, -47.5, HARBOR.z0 - HARBOR.pave, 11.6);
      facade('westSt', { axis: 'z', at: HARBOR.z0 - HARBOR.pave, n: 1 }, -40, -24, 11.6, { bay: 3.2, litP: 0.1 });
      mass('eastSt', MAT.brickDark, 34, 90, -30, HARBOR.z0 - HARBOR.pave, 10.4);
      facade('eastSt', { axis: 'z', at: HARBOR.z0 - HARBOR.pave, n: 1 }, 34, 60, 10.4, { bay: 3.3, litP: 0.1 });
    }

    // ================= the Harbor Building (room 304 cut out of its corner) ======
    {
      const g = 'harbor', H = 16.2;
      mass(g, MAT.brick, -24, ROOM.x0, -47.5, -7.5, H);
      mass(g, MAT.brick, ROOM.x0, 0, -47.5, ROOM.z0, H);
      K.box(g, MAT.brick, ROOM.x0, 0, 0, ROOM.y0, ROOM.z0, -7.5);
      K.collide(ROOM.x0, 0, ROOM.z0, -7.5, 'wall');
      K.box(g, MAT.brick, ROOM.x0, 0, ROOM.y1, H, ROOM.z0, -7.5);
      // the room's two outer walls, with their windows
      const T = 0.28;
      const sw = STREET_WIN, ew = ESC.window;
      holeyPanel(K, g, MAT.brick, 'z', -7.5 - T, -7.5, ROOM.x0, 0, ROOM.y0, ROOM.y1, [[sw.x - sw.w / 2, sw.x + sw.w / 2, sw.sill, sw.sill + sw.h]]);
      holeyPanel(K, g, MAT.brick, 'x', -T, 0, ROOM.z0, -7.5 - T, ROOM.y0, ROOM.y1, [[ew.z - ew.w / 2, ew.z + ew.w / 2, ew.sill, ew.sill + ew.h]]);
      // their frames: the street window's, and the escape window's with its
      // sash pushed up
      const Fs = { axis: 'z', at: -7.5, n: 1 }, Fe = { axis: 'x', at: 0, n: 1 };
      for (const [F, u, w, s, h] of [[Fs, sw.x, sw.w, sw.sill, sw.h], [Fe, ew.z, ew.w, ew.sill, ew.h]]) {
        fbox(g, MAT.trim, F, u - w / 2 - 0.09, u + w / 2 + 0.09, s + h, s + h + 0.14, 0, 0.09);
        fbox(g, MAT.trim, F, u - w / 2 - 0.13, u + w / 2 + 0.13, s - 0.07, s, -0.28, 0.16);
        fbox(g, MAT.trim, F, u - w / 2 - 0.08, u - w / 2, s, s + h, -0.28, 0.07);
        fbox(g, MAT.trim, F, u + w / 2, u + w / 2 + 0.08, s, s + h, -0.28, 0.07);
      }
      // (the escape window's lower sash raised behind the upper)
      fbox(g, MAT.woodDark, Fe, ew.z - ew.w / 2, ew.z + ew.w / 2, ew.sill + ew.h * 0.62, ew.sill + ew.h * 0.66, -0.2, -0.15);
      fbox(g, MAT.woodDark, Fe, ew.z - ew.w / 2, ew.z + ew.w / 2, ew.sill + ew.h - 0.05, ew.sill + ew.h, -0.2, -0.15);
      // inside: dark walls (the mass's own faces), a desk, a cabinet
      K.box('room', MAT.room, ROOM.x0 + 0.3, ROOM.x0 + 1.2, ROOM.y0, ROOM.y0 + 0.78, -11.4, -9.6);
      K.box('room', MAT.room, ROOM.x0 + 0.2, ROOM.x0 + 0.75, ROOM.y0, ROOM.y0 + 1.35, ROOM.z0 + 0.2, ROOM.z0 + 0.8);
      stage.dry.push(new THREE.Box3(V3(ROOM.x0, ROOM.y0, ROOM.z0), V3(0, ROOM.y1, -7.5)));
      stage.addLook(new THREE.Box3(V3(ROOM.x0, ROOM.y0 - 0.1, ROOM.z0), V3(-0.05, ROOM.y1, -7.8)), { rainOverlay: 0.25, room: 'office304' });
      // the east wall over the straight: windows (the escape's on the three
      // upper floors), a door, pipes
      const F = { axis: 'x', at: 0, n: 1 };
      facade(g, F, -47.5, -7.5, H, { bay: 3.2, skip: [[-11.6, -7.5]], litP: 0.08, pipes: [-20.4, -35.6] });
      door(g, F, -28.4);
      door(g, F, -42.6, 1.4, 2.6);
      facade(g, { axis: 'z', at: -7.5, n: 1 }, -24, ROOM.x0, H, { bay: 3.3, litP: 0.1 });
      // its ground floor on Harbor Street: a shop front, a door
      const Ff = { axis: 'z', at: -7.5, n: 1 };
      fplane(g, MAT.glass, Ff, -12, 1.8, 5.2, 2.5, 0.02, { cast: false });
      fbox(g, MAT.trim, Ff, -14.8, -9.2, 3.05, 3.4, 0, 0.14);
      door(g, Ff, -4.2, 1.2, 2.5);
    }

    // ================= the fire escape (the player's way down) ===================
    {
      const g = 'escape';
      const F = { axis: 'x', at: 0, n: 1 };
      const [y3, y2, y1] = ESC.levels;
      const d = ESC.depth, w = ESC.stairW;
      // (the stair holes: [u0, u1, d0, d1] - along the wall, and the depth
      // band they cut: from a flight's head to where it has dropped 2.1 m)
      landing(g, F, ESC.z0, ESC.z1, y3, d, { holes: [[ESC.f1.z0 - 2.15, ESC.f1.z0 + 0.02, ESC.f1.x - w / 2 - 0.03, ESC.f1.x + w / 2 + 0.03]] });
      landing(g, F, ESC.z0, ESC.z1, y2, d, { holes: [[ESC.f2.z0 - 0.02, ESC.f2.z0 + 2.15, ESC.f2.x - w / 2 - 0.03, ESC.f2.x + w / 2 + 0.03]] });
      landing(g, F, ESC.z0, ESC.z1, y1, d, { holes: [[ESC.hatch.z0, ESC.hatch.z1, ESC.ladder.x - 0.34, ESC.ladder.x + 0.34]] });
      flight(g, F, ESC.f1.z0, y3, ESC.f1.z1, y2, ESC.f1.x, w);
      flight(g, F, ESC.f2.z0, y2, ESC.f2.z1, y1, ESC.f2.x, w);
      // the ladder's guides at the hatch (the ladder itself slides: chase.js)
      for (const s of [-1, 1]) fbox(g, MAT.iron, F, ESC.ladder.z - 0.025, ESC.ladder.z + 0.025, y1 - 0.9, y1 + 1.0, ESC.ladder.x + s * 0.27 - 0.03, ESC.ladder.x + s * 0.27 + 0.03);
    }

    // ================= 1 the straight: the east block ============================
    {
      const g = 'east', H = 12.6;
      mass(g, MAT.brickDark, 5, 34, -47.5, -7.5, H);
      const F = { axis: 'x', at: 5, n: -1 };
      facade(g, F, -47.5, -7.5, H, { bay: 3.4, litP: 0.1, pipes: [-16.8, -31.0, -44.4] });
      door(g, F, -22.6, 1.3, 2.4);
      facade(g, { axis: 'z', at: -7.5, n: 1 }, 5, 34, H, { bay: 3.3, litP: 0.08 });
      // its fire escape, up over the alley (the Harbor Building's crosses it)
      const Fe = { axis: 'x', at: 5, n: -1 };
      landing(g, Fe, -33.4, -26.6, 2 * FLOOR, 1.1);
      landing(g, Fe, -33.4, -26.6, 3 * FLOOR, 1.1);
      flight(g, Fe, -27.2, 3 * FLOOR, -30.8, 2 * FLOOR, 0.7, 0.6);
      // its hanging ladder (up)
      for (const s of [-1, 1]) fbox(g, MAT.iron, Fe, -33.0 + s * 0.25 - 0.02, -33.0 + s * 0.25 + 0.02, 2 * FLOOR - 2.6, 2 * FLOOR + 0.1, 0.65, 0.7);
      for (let y = 2 * FLOOR - 2.4; y < 2 * FLOOR; y += 0.3) fbox(g, MAT.iron, Fe, -33.25, -32.75, y - 0.015, y + 0.015, 0.66, 0.69);
      // the wires over the straight
      wire(V3(0, 7.6, -19.4), V3(5, 7.9, -21.2), 0.45);
      wire(V3(0, 9.3, -31.2), V3(5, 8.8, -29.4), 0.6);
      wire(V3(0, 6.8, -40.8), V3(5, 7.2, -42.2), 0.35);
    }

    // ================= 2 the fences: the back lane ==============================
    {
      mass('mid', MAT.brick, 0, YARD.x0, PASSAGE.z1, LANE.z0, 14);
      const Fs = { axis: 'z', at: LANE.z0, n: 1 };
      facade('mid', Fs, 0, YARD.x0, 14, { bay: 3.3, litP: 0.08, pipes: [8.7, 29.6], skip: [[0.5, 4.6]] });
      door('mid', Fs, 16.8);
      mass('westBack', MAT.brickDark, -24, 0, -84.0, -47.5, 10.2);
      // the lane's ends and its south side (the east block's back)
      facade('westBack', { axis: 'x', at: 0, n: 1 }, LANE.z0, LANE.z1, 10.2, { bay: 2.5, litP: 0.2 });
      facade('east', { axis: 'z', at: -47.5, n: -1 }, 5, 34, 12.6, { bay: 3.3, litP: 0.07, pipes: [21.2] });
      mass('yardS', MAT.brickDark, 34, YARD.x1, -47.5, -30, 9.4);
      // the fences across it: boards on two rails, a top rail (a hand plants
      // on it); their colliders stop a man who does not vault
      api.fences = FENCES.map((f) => ({ a: { x: f.x, z: LANE.z0 + 0.05 }, b: { x: f.x, z: LANE.z1 - 0.05 }, h: f.h, collider: fence(K, MAT, f.x, LANE.z0, LANE.z1, f.h, rng) }));
      // a fire escape on the mid block, up over the lane
      const Fe = { axis: 'z', at: LANE.z0, n: 1 };
      landing('mid', Fe, 19.4, 25.6, 2 * FLOOR, 1.1);
      landing('mid', Fe, 19.4, 25.6, 3 * FLOOR, 1.1);
      flight('mid', Fe, 20.0, 3 * FLOOR, 23.6, 2 * FLOOR, 0.7, 0.6);
      wire(V3(10.2, 8.1, LANE.z0), V3(11.4, 7.6, LANE.z1), 0.5);
      wire(V3(30.0, 7.0, LANE.z0), V3(29.0, 7.4, LANE.z1), 0.4);
    }

    // ================= 3 the washing: the yard ===================================
    {
      mass('far', MAT.brick, YARD.x1, 70, -110, -30, 12.2);
      const Fw = { axis: 'x', at: YARD.x1, n: -1 };
      facade('far', Fw, -84.2, -47.5, 12.2, { bay: 3.3, litP: 0.12, pipes: [-60.2, -75.4] });
      door('far', Fw, -65.8);
      const Fm = { axis: 'x', at: YARD.x0, n: 1 };
      facade('mid', Fm, -81.8, -52.5, 14, { bay: 3.3, litP: 0.1, pipes: [-70.6] });
      facade('yardS', { axis: 'z', at: -47.5, n: -1 }, 34, YARD.x1, 9.4, { bay: 3.2, litP: 0.05 });
      // the washing posts at the lines' ends (the lines and the sheets are
      // chase.js's)
      for (const z of [-58.5, -63.5, -68.5, -73.5]) {
        K.add('far', MAT.metal, tube([V3(YARD.x1 - 0.2, 0, z), V3(YARD.x1 - 0.2, 3.1, z)], 0.035, 6, 2));
        K.add('mid', MAT.metal, tube([V3(YARD.x0 + 0.2, 0, z), V3(YARD.x0 + 0.2, 3.1, z)], 0.035, 6, 2));
      }
    }

    // ================= 4 the passage: the dog and the crates ======================
    {
      const H = 12.4, pz = PASSAGE.z0;
      mass('north', MAT.brickDark, DEADEND.x1, GATE.x - 2.0, -100, pz, H);
      mass('north', MAT.brickDark, GATE.x + 2.0, YARD.x1, -100, pz, H);
      mass('north', MAT.brickDark, GATE.x - 2.0, GATE.x + 2.0, -100, pz - 5.4, H);
      mass('mid', MAT.brick, 0, PASSAGE.x0, pz, PASSAGE.z1, 12);
      const Fn = { axis: 'z', at: pz, n: 1 };
      facade('north', Fn, DEADEND.x1, GATE.x - 2.0, H, { bay: 3.2, litP: 0.12, pipes: [12.2] });
      facade('north', Fn, GATE.x + 2.0, YARD.x1, H, { bay: 3.2, litP: 0.1, pipes: [34.6] });
      facade('mid', { axis: 'z', at: PASSAGE.z1, n: -1 }, 0, YARD.x0, 14, { bay: 3.2, litP: 0.06, pipes: [19.8] });
      door('north', Fn, 17.2);
      door('north', Fn, 43.2, 1.2, 2.3);
      // the dog's pen behind the gate: its walls either side of the gate (the
      // gate itself swings: chase.js)
      for (const [a, b] of [[GATE.x - 2.0, GATE.x - GATE.w / 2], [GATE.x + GATE.w / 2, GATE.x + 2.0]]) {
        K.box('pen', MAT.wood, a, b, 0, 2.2, pz - 0.08, pz);
        K.collide(a, b, pz - 0.08, pz, 'wall');
      }
      K.collide(GATE.x - GATE.w / 2, GATE.x + GATE.w / 2, pz - 0.1, pz, 'gate');
      // a fire escape high over the passage
      landing('north', Fn, 8.6, 14.4, 2 * FLOOR + 0.3, 1.05);
      landing('north', Fn, 8.6, 14.4, 3 * FLOOR + 0.3, 1.05);
      flight('north', Fn, 9.2, 3 * FLOOR + 0.3, 12.8, 2 * FLOOR + 0.3, 0.65, 0.6);
      wire(V3(24.0, 6.4, pz), V3(22.6, 6.8, PASSAGE.z1), 0.3);
      wire(V3(6.2, 7.2, pz), V3(7.8, 6.8, PASSAGE.z1), 0.35);
    }

    // ================= 5 the dead end, and the street beyond the board ==========
    {
      mass('nw', MAT.brick, 2.0, YARD.x1, -130, DEADEND.z0, 11.8);
      const Fw = { axis: 'x', at: DEADEND.x1, n: -1 };
      facade('north', Fw, DEADEND.z0, PASSAGE.z0, 12.4, { bay: 3.1, litP: 0.08, pipes: [-92.2] });
      // the dead end's wall: a lower brick wall across it, a bill on it
      const Fd = { axis: 'z', at: DEADEND.z0, n: 1 };
      K.box('nw', MAT.brickDark, DEADEND.x0, DEADEND.x1, 0, 4.4, DEADEND.z0, DEADEND.z0 + 0.35);
      facade('nw', Fd, DEADEND.x0, DEADEND.x1, 11.8, { bay: 2.0, from: 2, litP: 0.2 });
      // the board fence down its west side (the street behind it), with the
      // loose board's gap (the board: chase.js)
      boardFence(K, MAT, DEADEND.x0, DEADEND.z0 + 0.35, PASSAGE.z0, 2.3, [BOARD.z - 0.5, BOARD.z + 0.5], rng);
      // the back street: its buildings
      mass('backW', MAT.brickDark, -40, BACKST.x0 - BACKST.pave, -150, -92, 12.8);
      facade('backW', { axis: 'x', at: BACKST.x0 - BACKST.pave, n: 1 }, -150, -92, 12.8, { bay: 3.4, litP: 0.14, pipes: [-104.4, -121.6] });
      door('backW', { axis: 'x', at: BACKST.x0 - BACKST.pave, n: 1 }, -98.6, 1.2, 2.4);
      facade('nw', { axis: 'x', at: 2.0, n: -1 }, -130, DEADEND.z0, 11.8, { bay: 3.2, litP: 0.1 });
      facade('westBack', { axis: 'z', at: -84.0, n: -1 }, -24, 0, 10.2, { bay: 3.2, litP: 0.1 });
    }

    // ================= the lamps ====================================================
    const L = stage.part('lamps');
    const lamps = api.lamps = {};
    // Harbor Street: his, under which he stands, and two more down the street
    lamps.watch = L.post(WATCH_LAMP.x, WATCH_LAMP.z, Math.PI / 2);
    lamps.st1 = L.post(-19.0, WATCH_LAMP.z, Math.PI / 2);
    lamps.st2 = L.post(23.0, HARBOR.z0 - 0.7, -Math.PI / 2);
    // 1 the straight
    lamps.s1 = L.wall(5, 4.3, -21.8, -1, 0);
    lamps.s2 = L.wall(0, 4.1, -35.4, 1, 0);
    lamps.s3 = L.wall(4.3, 4.4, LANE.z0, 0, 1, { out: 0.2 });
    // 2 the lane
    lamps.l1 = L.wall(19.0, 4.2, LANE.z1, 0, -1);
    lamps.l2 = L.wall(31.6, 4.0, LANE.z0, 0, 1);
    // 3 the yard: at its far end, behind the sheets (the back light) and at
    // its entry
    lamps.y1 = L.wall(YARD.x1, 4.6, -78.6, -1, 0, { out: 0.6, strength: 1.0 });
    // a lamp over the door in the far wall of the yard, low, thrown down the
    // yard through the washing: the sheets glow with it, and a man just
    // past a line of them is his own shadow on them, as tall as he is
    lamps.y3 = L.wall(43.2, 2.95, PASSAGE.z0, 0, 1, { out: 7.5, half: 0.55, strength: 0.9, height: 30 });
    // (its light carries the length of the yard: the washing 10 .. 26 m off
    // must be lit through, not just the ground under it)
    lamps.y3.light.intensity = 700;
    lamps.y3.light.angle = 0.55;
    // (not one of the pool's: the far lamp behind the washing must have
    // a shadow-casting light as I come up the yard)
    lamps.y2 = L.wall(YARD.x1, 4.2, -50.4, -1, 0, { real: false });
    // 4 the passage
    lamps.p1 = L.wall(32.4, 3.9, PASSAGE.z1, 0, -1, { out: 0.2 });
    lamps.p2 = L.wall(16.0, 4.0, PASSAGE.z0, 0, 1, { out: 0.2 });
    lamps.p3 = L.wall(7.4, 4.1, PASSAGE.z1, 0, -1, { out: 0.2 });
    // 5 the dead end, the street
    lamps.d1 = L.wall(DEADEND.x1, 3.8, -94.8, -1, 0, { out: 0.5 });
    lamps.b1 = L.post(0.9, -104.5, Math.PI / 2 + Math.PI / 2, { y: 0.15 });
    lamps.b2 = L.post(-13.6, -124.0, -Math.PI / 2 + Math.PI / 2, { y: 0.15, real: true });
    lamps.b3 = L.post(0.9, -130.0, Math.PI, { real: false });

    // ================= the neon at the end of the straight's sight line ==========
    api.neon = neonSign(stage, V3(2.5, 5.2, LANE.z0 + 0.06));

    // ================= steam from a vent in the lane ================================
    const vent = V3(33.4, 0.05, -49.4);
    K.box('lane', MAT.metal, vent.x - 0.45, vent.x + 0.45, 0, 0.03, vent.z - 0.3, vent.z + 0.3);
    api.steam = new Steam(stage, [vent], 18);

    // ================= clutter along the walls (never across the way) ============
    const bin = (x, z, s = 1) => {
      const geo = lathe([[0, 0], [0.26, 0], [0.28, 0.05], [0.27, 0.72], [0.3, 0.76], [0.3, 0.8], [0, 0.8]], 24).scale(s, s, s).translate(x, 0, z);
      K.add('clutter', MAT.metal, geo, { figure: true });
      const lid = lathe([[0, 0.1], [0.2, 0.08], [0.31, 0.02], [0.32, 0.0]], 24).scale(s, s, s).translate(x, 0.8 * s, z);
      K.add('clutter', MAT.metal, lid, { figure: true });
      stage.colliders.addCircle(x, z, 0.32 * s, 'can');
    };
    const crate = (x, z, s = 0.62, y = 0, yaw = 0) => {
      const g = new THREE.BoxGeometry(s, s, s).rotateY(yaw).translate(x, y + s / 2, z);
      K.add('clutter', MAT.wood, g, { figure: true });
      if (y < 0.1) stage.colliders.addBox(x, z, s / 2, s / 2, yaw, 'crates');
    };
    bin(0.45, -24.8); bin(0.5, -25.6, 0.95); bin(4.5, -37.6);
    crate(4.55, -40.6, 0.7); crate(4.5, -40.7, 0.55, 0.7, 0.3); crate(0.55, -44.4, 0.6, 0, 0.4);
    bin(9.0, -52.0); bin(29.0, -47.9, 0.95);
    crate(35.2, -52.0, 0.7); crate(35.3, -52.1, 0.6, 0.7, 0.2);
    bin(47.4, -66.6); crate(47.3, -55.6, 0.7, 0, 0.1);
    bin(5.5, -99.4); crate(2.6, -99.3, 0.65, 0, 0.3); bin(5.4, -86.9, 0.9);

    K.flush();
    // the architecture's meshes are the bullets' solids (the stage finds them)
    return api;
  },
};

// a board fence across the lane at x: two posts at the walls, rails, boards
// with gaps, a top rail (where the hands plant); its collider
function fence(K, MAT, x, z0, z1, h, rng) {
  const g = 'fence' + Math.round(x);
  K.box(g, MAT.woodDark, x - 0.06, x + 0.06, 0, h + 0.08, z0, z0 + 0.12);
  K.box(g, MAT.woodDark, x - 0.06, x + 0.06, 0, h + 0.08, z1 - 0.12, z1);
  for (const y of [0.35, h - 0.3]) K.box(g, MAT.woodDark, x + 0.03, x + 0.1, y - 0.06, y + 0.06, z0, z1);
  K.box(g, MAT.wood, x - 0.07, x + 0.07, h - 0.04, h + 0.02, z0, z1);
  for (let z = z0 + 0.14; z < z1 - 0.14; z += 0.155) {
    const top = h - 0.04 - rng.range(0, 0.05);
    K.box(g, MAT.wood, x - 0.03, x + 0.03, 0.04, top, z, z + 0.135);
  }
  return K.stage.colliders.addBox(x, (z0 + z1) / 2, 0.1, (z1 - z0) / 2, 0, 'fence');
}

// the dead end's fence along x: boards from z0 to z1, a gap (the loose board's)
function boardFence(K, MAT, x, z0, z1, h, gap, rng) {
  const g = 'deadFence';
  for (let z = Math.min(z0, z1); z < Math.max(z0, z1) - 0.1; z += 0.16) {
    if (z + 0.14 > gap[0] && z < gap[1]) continue;
    K.box(g, MAT.wood, x - 0.03, x + 0.03, 0.03, h - rng.range(0, 0.08), z, z + 0.14);
  }
  for (const y of [0.4, h - 0.35]) K.box(g, MAT.woodDark, x + 0.03, x + 0.1, y - 0.06, y + 0.06, Math.min(z0, z1), Math.max(z0, z1));
  const lo = Math.min(z0, z1), hi = Math.max(z0, z1);
  K.stage.colliders.addBox(x, (lo + gap[0]) / 2, 0.08, (gap[0] - lo) / 2, 0, 'fence');
  K.stage.colliders.addBox(x, (gap[1] + hi) / 2, 0.08, (hi - gap[1]) / 2, 0, 'fence');
}

// the blue neon: HOTEL down a blade on the wall, in tubes (accent neon)
function neonSign(stage, at) {
  const g = new THREE.Group();
  g.position.copy(at);
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.86, 3.5, 0.1).translate(0, 0, 0.05), stage.M.ironDark);
  board.castShadow = true;
  g.add(board);
  const mat = accentMaterial('neon', { tube: 0.012, minPx: 3 });
  const r = 0.014;
  const strokes = [];
  const L = (pts) => strokes.push(pts.map(([x, y]) => V3(x, y, 0.13)));
  const letter = (ch, cy) => {
    const s = 0.2, t = 0.24;
    if (ch === 'H') { L([[-s, cy - t], [-s, cy + t]]); L([[s, cy - t], [s, cy + t]]); L([[-s, cy], [s, cy]]); }
    if (ch === 'O') { const p = []; for (let i = 0; i <= 28; i++) { const a = (i / 28) * Math.PI * 2; p.push([Math.sin(a) * s, cy + Math.cos(a) * t]); } L(p); }
    if (ch === 'T') { L([[-s, cy + t], [s, cy + t]]); L([[0, cy + t], [0, cy - t]]); }
    if (ch === 'E') { L([[s, cy + t], [-s, cy + t], [-s, cy - t], [s, cy - t]]); L([[-s, cy], [s * 0.6, cy]]); }
    if (ch === 'L') { L([[-s, cy + t], [-s, cy - t], [s, cy - t]]); }
  };
  'HOTEL'.split('').forEach((ch, i) => letter(ch, 1.3 - i * 0.64));
  for (const p of strokes) {
    const geo = p.length === 2 ? tube(p, r, 8, 2) : tube(p, r, 8, p.length * 3);
    const m = new THREE.Mesh(geo, mat);
    m.userData.noRay = true;
    g.add(m);
  }
  markFigure(board);
  tagInk(g);
  stage.scene.add(g);
  return g;
}

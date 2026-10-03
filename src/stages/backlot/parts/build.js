import * as THREE from 'three';
import { holeyPanel } from '../kit.js';
import { arch } from '../arch.js';
import { lathe, V3, merge } from '../../../world/geom.js';
import { accentMaterial } from '../../../render/accents.js';
import { markFigure, tagInk } from '../../../render/layers.js';
import { tube } from '../../../world/geom.js';
import { Steam } from '../../../fx/Steam.js';
import {
  FLOOR, ESC, ROOM, STREET_WIN, WATCH_LAMP, HARBOR, BACKST, ALLEY, LANE, YARD, WASH, KITCHEN, LOADING, PASSAGE, ROOFS, TANNER,
  MERCER, GARAGE, MARKET, FENCE, NORTHST, AVENUE, PRESS, CUT, ARCH,
} from '../plan.js';

// The backlot's architecture (lane B4; the run behind the Harbor Building
// rebuilt by lane C6): the blocks round the course - brick and stone masses,
// their windows (a few lit, high up), drainpipes, fire escapes overhead,
// wires - the Harbor Building with room 304's stand-in and its fire escape,
// the street at each end, and the lamps. The places with insides of their
// own are parts of their own: the kitchen (kitchen.js), the roof row
// (roofs.js), Mercer Street, Tanner's Row and the market (streets.js); what
// the chase meets in its way is things.js. Everything static is merged by
// building (one ink id each).
export default {
  name: 'build', order: 60,
  build(stage) {
    const A = arch(stage, 6060);
    const { MAT, K, face, fbox, fplane, facade, mass, block, door, landing, flight, wire } = A;
    const api = { MAT, kit: K, lit: A.lit };

    // ================= Harbor Street: its south row, the north side ===============
    {
      const g = 'southRow';
      // ([C6 2nd] to the avenue's west side: the avenue crosses Harbor Street)
      mass(g, MAT.brickDark, -80, AVENUE.x0, HARBOR.z1 + HARBOR.pave, 24, 13.2);
      const F = face('z', HARBOR.z1 + HARBOR.pave, -1);
      facade(g, F, -40, 60, 13.2, { bay: 3.4, litP: 0.12, pipes: [-12.2, 12.8, 44.6], skip: [[-6.6, -2.0], [6.6, 11]] });
      for (const u of [-30, -21, -12.5, 17, 25.5, 33, 41.5, 50]) {
        fplane(g, MAT.glass, F, u, 1.7, 3.6, 2.4, 0.02, { cast: false });
        fbox(g, MAT.trim, F, u - 1.95, u + 1.95, 2.9, 3.2, 0, 0.12);
        fbox(g, MAT.trim, F, u - 1.95, u + 1.95, 0, 0.5, 0, 0.1);
      }
      door(g, F, -4.3); door(g, F, 8.8, 1.2, 2.4);
    }
    {
      block('westSt', MAT.brick, -80, -24, -47.5, HARBOR.z0 - HARBOR.pave, 11.6, { s: { bay: 3.2, litP: 0.1 } });
      // the block east of the side alley (its back is the lane's south side)
      // and the one east of it, on the yard's south end
      const H = 12.6;
      block('east', MAT.brickDark, ALLEY.x1, 50, -47.5, HARBOR.z0 - HARBOR.pave, H, { s: { bay: 3.3, litP: 0.08 }, n: { bay: 3.3, litP: 0.07, pipes: [21.2, 38.6] } });
      block('eastSt', MAT.brick, 50, AVENUE.x0, -47.5, HARBOR.z0 - HARBOR.pave, 10.4, { s: { bay: 3.3, litP: 0.1 }, n: { bay: 3.3, litP: 0.05, skip: [[70, 110]] }, e: { bay: 3.3, litP: 0.1 } });
    }

    // ================= the Harbor Building (room 304 cut out of its corner) ======
    {
      const g = 'harbor', H = 16.2;
      mass(g, MAT.brick, -24, ROOM.x0, -47.5, -7.5, H);
      mass(g, MAT.brick, ROOM.x0, 0, -47.5, ROOM.z0, H);
      K.box(g, MAT.brick, ROOM.x0, 0, 0, ROOM.y0, ROOM.z0, -7.5);
      K.collide(ROOM.x0, 0, ROOM.z0, -7.5, 'wall');
      K.box(g, MAT.brick, ROOM.x0, 0, ROOM.y1, H, ROOM.z0, -7.5);
      const T = 0.28;
      const sw = STREET_WIN, ew = ESC.window;
      holeyPanel(K, g, MAT.brick, 'z', -7.5 - T, -7.5, ROOM.x0, 0, ROOM.y0, ROOM.y1, [[sw.x - sw.w / 2, sw.x + sw.w / 2, sw.sill, sw.sill + sw.h]]);
      holeyPanel(K, g, MAT.brick, 'x', -T, 0, ROOM.z0, -7.5 - T, ROOM.y0, ROOM.y1, [[ew.z - ew.w / 2, ew.z + ew.w / 2, ew.sill, ew.sill + ew.h]]);
      const Fs = face('z', -7.5, 1), Fe = face('x', 0, 1);
      for (const [F, u, w, s, h] of [[Fs, sw.x, sw.w, sw.sill, sw.h], [Fe, ew.z, ew.w, ew.sill, ew.h]]) {
        fbox(g, MAT.trim, F, u - w / 2 - 0.09, u + w / 2 + 0.09, s + h, s + h + 0.14, 0, 0.09);
        fbox(g, MAT.trim, F, u - w / 2 - 0.13, u + w / 2 + 0.13, s - 0.07, s, -0.28, 0.16);
        fbox(g, MAT.trim, F, u - w / 2 - 0.08, u - w / 2, s, s + h, -0.28, 0.07);
        fbox(g, MAT.trim, F, u + w / 2, u + w / 2 + 0.08, s, s + h, -0.28, 0.07);
      }
      fbox(g, MAT.woodDark, Fe, ew.z - ew.w / 2, ew.z + ew.w / 2, ew.sill + ew.h * 0.62, ew.sill + ew.h * 0.66, -0.2, -0.15);
      fbox(g, MAT.woodDark, Fe, ew.z - ew.w / 2, ew.z + ew.w / 2, ew.sill + ew.h - 0.05, ew.sill + ew.h, -0.2, -0.15);
      K.box('room', MAT.room, ROOM.x0 + 0.3, ROOM.x0 + 1.2, ROOM.y0, ROOM.y0 + 0.78, -11.4, -9.6);
      K.box('room', MAT.room, ROOM.x0 + 0.2, ROOM.x0 + 0.75, ROOM.y0, ROOM.y0 + 1.35, ROOM.z0 + 0.2, ROOM.z0 + 0.8);
      stage.dry.push(new THREE.Box3(V3(ROOM.x0, ROOM.y0, ROOM.z0), V3(0, ROOM.y1, -7.5)));
      stage.addLook(new THREE.Box3(V3(ROOM.x0, ROOM.y0 - 0.1, ROOM.z0), V3(-0.05, ROOM.y1, -7.8)), { rainOverlay: 0.25, ambient: 0.45, room: 'office304' });
      const F = face('x', 0, 1);
      facade(g, F, -47.5, -7.5, H, { bay: 3.2, skip: [[-11.6, -7.5]], litP: 0.08, pipes: [-20.4, -35.6] });
      door(g, F, -28.4);
      door(g, F, -42.6, 1.4, 2.6);
      facade(g, face('z', -7.5, 1), -24, ROOM.x0, H, { bay: 3.3, litP: 0.1 });
      const Ff = face('z', -7.5, 1);
      fplane(g, MAT.glass, Ff, -12, 1.8, 5.2, 2.5, 0.02, { cast: false });
      fbox(g, MAT.trim, Ff, -14.8, -9.2, 3.05, 3.4, 0, 0.14);
      door(g, Ff, -4.2, 1.2, 2.5);
    }

    // ================= the fire escape (the player's way down) ===================
    {
      const g = 'escape';
      const F = face('x', 0, 1);
      const [y3, y2, y1] = ESC.levels;
      const d = ESC.depth, w = ESC.stairW;
      landing(g, F, ESC.z0, ESC.z1, y3, d, { holes: [[ESC.f1.z0 - 2.15, ESC.f1.z0 + 0.02, ESC.f1.x - w / 2 - 0.03, ESC.f1.x + w / 2 + 0.03]] });
      landing(g, F, ESC.z0, ESC.z1, y2, d, { holes: [[ESC.f2.z0 - 0.02, ESC.f2.z0 + 2.15, ESC.f2.x - w / 2 - 0.03, ESC.f2.x + w / 2 + 0.03]] });
      landing(g, F, ESC.z0, ESC.z1, y1, d, { holes: [[ESC.hatch.z0, ESC.hatch.z1, ESC.ladder.x - 0.34, ESC.ladder.x + 0.34]] });
      flight(g, F, ESC.f1.z0, y3, ESC.f1.z1, y2, ESC.f1.x, w);
      flight(g, F, ESC.f2.z0, y2, ESC.f2.z1, y1, ESC.f2.x, w);
      for (const s of [-1, 1]) fbox(g, MAT.iron, F, ESC.ladder.z - 0.025, ESC.ladder.z + 0.025, y1 - 0.9, y1 + 1.0, ESC.ladder.x + s * 0.27 - 0.03, ESC.ladder.x + s * 0.27 + 0.03);
    }

    // ================= the alley: the east block's face and its fire escape =======
    {
      const g = 'east', H = 12.6;
      const F = face('x', ALLEY.x1, -1);
      facade(g, F, -47.5, -7.5, H, { bay: 3.4, litP: 0.1, pipes: [-16.8, -31.0, -44.4] });
      door(g, F, -22.6, 1.3, 2.4);
      landing(g, F, -33.4, -26.6, 2 * FLOOR, 1.1);
      landing(g, F, -33.4, -26.6, 3 * FLOOR, 1.1);
      flight(g, F, -27.2, 3 * FLOOR, -30.8, 2 * FLOOR, 0.7, 0.6);
      for (const s of [-1, 1]) fbox(g, MAT.iron, F, -33.0 + s * 0.25 - 0.02, -33.0 + s * 0.25 + 0.02, 2 * FLOOR - 2.6, 2 * FLOOR + 0.1, 0.65, 0.7);
      for (let y = 2 * FLOOR - 2.4; y < 2 * FLOOR; y += 0.3) fbox(g, MAT.iron, F, -33.25, -32.75, y - 0.015, y + 0.015, 0.66, 0.69);
      wire(V3(0, 7.6, -19.4), V3(5, 7.9, -21.2), 0.45);
      wire(V3(0, 9.3, -31.2), V3(5, 8.8, -29.4), 0.6);
      wire(V3(0, 6.8, -40.8), V3(5, 7.2, -42.2), 0.35);
    }

    // ================= the lane: the mid block over it, the west end ==============
    {
      // the block north of the lane (to the market's south end and the garage)
      mass('mid', MAT.brick, 0, LANE.x1, YARD.z1 - 32.5, LANE.z0, 14);
      const Fs = face('z', LANE.z0, 1);
      facade('mid', Fs, 0, LANE.x1, 14, { bay: 3.3, litP: 0.08, pipes: [8.7, 29.6, 44.2], skip: [[0.5, 4.6]] });
      door('mid', Fs, 16.8);
      door('mid', Fs, 40.4, 1.2, 2.3);
      // its north face: over the market's south end, the garage's back, the
      // block west of the kitchen
      facade('mid', face('z', -80, -1), 0, LANE.x1, 14, { bay: 3.3, litP: 0.08, from: 2 });
      // the west end of the lane and Pell Lane's south end
      mass('westBack', MAT.brickDark, -24, 0, BACKST.z1, -47.5, 10.2);
      facade('westBack', face('x', 0, 1), LANE.z0, LANE.z1, 10.2, { bay: 2.5, litP: 0.2 });
      facade('westBack', face('z', BACKST.z1, -1), -24, 0, 10.2, { bay: 3.2, litP: 0.1 });
      mass('midN', MAT.brickDark, 0, MARKET.x1, MARKET.z1, -80, 6.4);
      facade('midN', face('z', MARKET.z1, -1), 0, MARKET.x1, 6.4, { bay: 3.4, litP: 0.0, from: 1, course: false });
      // a fire escape on the mid block, up over the lane
      const Fe = face('z', LANE.z0, 1);
      landing('mid', Fe, 19.4, 25.6, 2 * FLOOR, 1.1);
      landing('mid', Fe, 19.4, 25.6, 3 * FLOOR, 1.1);
      flight('mid', Fe, 20.0, 3 * FLOOR, 23.6, 2 * FLOOR, 0.7, 0.6);
      wire(V3(10.2, 8.1, LANE.z0), V3(11.4, 7.6, LANE.z1), 0.5);
      wire(V3(30.0, 7.0, LANE.z0), V3(29.0, 7.4, LANE.z1), 0.4);
      wire(V3(41.0, 6.6, LANE.z0), V3(42.4, 7.2, LANE.z1), 0.45);
    }

    // ================= the yard: its walls, the wash-house =========================
    {
      // the yard's west wall is the mid block's east end; its east, the far block
      facade('mid', face('x', YARD.x0, 1), LANE.z0, -80, 14, { bay: 3.3, litP: 0.1, pipes: [-70.6] });
      // ([C6 2nd] the block east of the yard south of the press hall - the
      // press hall itself is press.js's - to the avenue)
      block('far', MAT.brick, YARD.x1, AVENUE.x0, PRESS.z1, YARD.z1, 12.2, { w: { bay: 3.3, litP: 0.12, pipes: [-60.2] }, e: { bay: 3.3, litP: 0.1, pipes: [-66.0] } });
      facade('eastSt', face('z', YARD.z1, -1), YARD.x0, YARD.x1, 10.4, { bay: 3.2, litP: 0.05 });
      // the wash-house: a long low brick shed, a slate roof, a copper's
      // chimney; its doors on the lanes are shut
      const W = WASH;
      mass('wash', MAT.brickDark, W.x0, W.x1, W.z0, W.z1, W.h);
      const roof = new THREE.BufferGeometry();
      {
        const x0 = W.x0 - 0.25, x1 = W.x1 + 0.25, xm = (W.x0 + W.x1) / 2, y0 = W.h - 0.05, y1 = W.h + 0.9;
        const pos = [];
        for (const [a, b] of [[x0, xm], [xm, x1]]) {
          const ya = a === x0 ? y0 : y1, yb = b === x1 ? y0 : y1;
          pos.push(a, ya, W.z1 + 0.25, b, yb, W.z1 + 0.25, b, yb, W.z0, a, ya, W.z1 + 0.25, b, yb, W.z0, a, ya, W.z0);
        }
        roof.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        roof.computeVertexNormals();
      }
      K.add('wash', MAT.tar, roof);
      // (its gable end facing the lane's mouth)
      const gable = new THREE.BufferGeometry();
      gable.setAttribute('position', new THREE.Float32BufferAttribute([W.x0 - 0.25, W.h - 0.05, W.z1 + 0.25, W.x1 + 0.25, W.h - 0.05, W.z1 + 0.25, (W.x0 + W.x1) / 2, W.h + 0.9, W.z1 + 0.25], 3));
      gable.computeVertexNormals();
      K.add('wash', stage.M.brickFar, gable);
      K.add('wash', MAT.metal, tube([V3(60.6, W.h, -70), V3(60.6, W.h + 2.4, -70)], 0.11, 10, 2), { figure: true });
      const Fw = face('x', W.x0, -1), Fe = face('x', W.x1, 1);
      door('wash', Fw, -66.0, 1.0, 2.0); door('wash', Fe, -73.0, 1.0, 2.0);
      for (const z of [-62, -70.5, -78]) { A.window1('wash', Fw, z, 1.05, 0.8, 0.9); A.window1('wash', Fe, z + 3, 1.05, 0.8, 0.9); }
      // the washing posts at the lines' ends (the lines and the sheets are the chase's)
      for (const z of [-62, -67, -72, -77]) {
        K.add('far', MAT.metal, tube([V3(YARD.x1 - 0.2, 0, z), V3(YARD.x1 - 0.2, 3.1, z)], 0.035, 6, 2));
        K.add('mid', MAT.metal, tube([V3(YARD.x0 + 0.2, 0, z), V3(YARD.x0 + 0.2, 3.1, z)], 0.035, 6, 2));
        K.add('wash', MAT.metal, tube([V3(W.x0 - 0.12, 0, z), V3(W.x0 - 0.12, 3.1, z)], 0.035, 6, 2));
        K.add('wash', MAT.metal, tube([V3(W.x1 + 0.12, 0, z), V3(W.x1 + 0.12, 3.1, z)], 0.035, 6, 2));
      }
      // the yard's south end: a coal bunker in the east corner, bins by the west
      mass('wash', MAT.brickDark, 66.6, YARD.x1, YARD.z1 - 3.0, YARD.z1, 1.25);
      fbox('wash', MAT.trim, face('z', YARD.z1 - 3.0, -1), 66.6, YARD.x1, 1.15, 1.32, -0.05, 0.08);
    }

    // ================= north of the lane: the block west of the kitchen, the
    // garage at Mercer Street's foot, the blocks beyond the roofs and the row ====
    {
      // between Mercer Street and the kitchen, the yard and the roof row
      block('kw', MAT.brickDark, MERCER.x1, YARD.x0, ROOFS.z1, -80, 11.2, { w: { bay: 3.3, litP: 0.12, skip: [[-86.5, -80]] } });
      // the garage: a brick box across Mercer Street's south end, its doors
      // (the leaves are streets.js's) on the street
      // (a shell: its doorway open on the street, the car waiting inside)
      {
        const T = 0.3, H = 5.2, d0 = GARAGE.door[0], d1 = GARAGE.door[1];
        holeyPanel(K, 'garage', MAT.brick, 'z', GARAGE.z0, GARAGE.z0 + T, GARAGE.x0, GARAGE.x1, 0, H, [[d0, d1, 0, 3.7]]);
        K.box('garage', MAT.brick, GARAGE.x0, GARAGE.x0 + T, 0, H, GARAGE.z0 + T, GARAGE.z1);
        K.box('garage', MAT.brick, GARAGE.x1 - T, GARAGE.x1, 0, H, GARAGE.z0 + T, GARAGE.z1);
        K.box('garage', MAT.brick, GARAGE.x0, GARAGE.x1, H - 0.4, H, GARAGE.z0, GARAGE.z1);
        K.box('garageIn', MAT.room, GARAGE.x0 + T, GARAGE.x1 - T, 3.9, 4.0, GARAGE.z0 + T, GARAGE.z1);
        K.collide(GARAGE.x0, d0, GARAGE.z0, GARAGE.z0 + T, 'wall');
        K.collide(d1, GARAGE.x1, GARAGE.z0, GARAGE.z0 + T, 'wall');
        K.collide(GARAGE.x0, GARAGE.x0 + T, GARAGE.z0, GARAGE.z1, 'wall');
        K.collide(GARAGE.x1 - T, GARAGE.x1, GARAGE.z0, GARAGE.z1, 'wall');
        stage.addLook(new THREE.Box3(V3(GARAGE.x0, -1, GARAGE.z0 + T), V3(GARAGE.x1, 4, GARAGE.z1)), { ambient: 0.05, exposure: 0.9 });
      }
      const Fg = face('z', GARAGE.z0, -1);
      fbox('garage', MAT.trim, Fg, GARAGE.door[0] - 0.25, GARAGE.door[0], 0, 4.0, 0, 0.18);
      fbox('garage', MAT.trim, Fg, GARAGE.door[1], GARAGE.door[1] + 0.25, 0, 4.0, 0, 0.18);
      fbox('garage', MAT.trim, Fg, GARAGE.door[0] - 0.25, GARAGE.door[1] + 0.25, 3.7, 4.05, 0, 0.2);
      fbox('garage', MAT.trim, Fg, GARAGE.x0, GARAGE.x1, 4.8, 5.2, 0, 0.25);
      // north of Tanner's Row, across Mercer Street, Pell Lane's west side
      block('nblk', MAT.brick, MERCER.x1, PASSAGE.x1, -133, TANNER.z0, 11.0, { s: { bay: 3.3, litP: 0.1, skip: [[41.6, 47.2]], pipes: [33.2, 55.0] }, w: { bay: 3.3, litP: 0.1 }, n: { bay: 3.3, litP: 0.12 } });
      // ([C6 2nd] north of the alley behind the press hall, to the avenue)
      // ([C6 3rd] the cut through it: three masses round an L of alley - in
      // off the avenue (the E-W leg), round the knee, down the N-S leg into
      // the alley behind the press hall's west end)
      {
        const E = CUT.ew, N = CUT.ns, H = 12.0;
        // the west strip: the passage's east wall, the N-S leg's west wall
        mass('ne', MAT.brickDark, PASSAGE.x1, N.x0, -133, LOADING.z0, H);
        facade('ne', face('x', PASSAGE.x1, -1), -133, LOADING.z0, H, { bay: 3.2, litP: 0.08, pipes: [-109.0] });
        facade('ne', face('x', N.x0, 1), N.z0, N.z1, H, { bay: 3.0, litP: 0.14, pipes: [-107.4] });
        facade('ne', face('z', LOADING.z0, 1), PASSAGE.x1, N.x0, H, { bay: 3.0, litP: 0.1 });
        // the north block: on the cross street, the avenue, the E-W leg
        block('ne', MAT.brickDark, N.x0, AVENUE.x0, -133, E.z0, H, { n: { bay: 3.3, litP: 0.1 }, e: { bay: 3.3, litP: 0.12 }, s: { bay: 3.1, litP: 0.16, pipes: [85.6] } });
        // the south-east block: on the E-W leg, the avenue, the alley, the N-S leg
        block('ne', MAT.brick, E.x0, AVENUE.x0, E.z1, LOADING.z0, 10.8, { n: { bay: 3.2, litP: 0.1, pipes: [90.2] }, e: { bay: 3.3, litP: 0.12 }, s: { bay: 3.1, litP: 0.12, pipes: [90.4] }, w: { bay: 3.0, litP: 0.12 } });
        // their doors on the cut: a pub's back door and its cellar flap, a
        // workshop's on the N-S leg
        door('ne', face('z', E.z0, 1), 88.2, 1.15, 2.3);
        door('ne', face('z', E.z1, -1), 83.6, 1.1, 2.2);
        door('ne', face('x', N.x0, 1), -114.6, 1.1, 2.3);
        // a fire escape over the N-S leg (its landings, a flight)
        landing('ne', face('x', N.x1, -1), -115.2, -108.8, 2 * FLOOR, 1.0);
        landing('ne', face('x', N.x1, -1), -115.2, -108.8, 3 * FLOOR, 1.0);
        flight('ne', face('x', N.x1, -1), -109.4, 3 * FLOOR, -113.0, 2 * FLOOR, 0.62, 0.56);
        wire(V3(N.x0, 7.4, -118.2), V3(N.x1, 7.0, -119.4), 0.35);
        wire(V3(84.0, 6.8, E.z0), V3(85.4, 7.2, E.z1), 0.4);
      }
      // ([C6 2nd] the avenue's east side, Harbor Street to the works at its north end; south of Harbor Street)
      block('aveE', MAT.brick, AVENUE.x1, AVENUE.x1 + 26, AVENUE.z0 - 8, HARBOR.z0 - HARBOR.pave, 13.0, { w: { bay: 3.3, litP: 0.14, pipes: [-41.0, -96.4] } });
      block('aveSE', MAT.brickDark, AVENUE.x1, AVENUE.x1 + 26, HARBOR.z1 + HARBOR.pave, 40, 12.4, { w: { bay: 3.3, litP: 0.1 }, n: { bay: 3.3, litP: 0.1 } });
      facade('southRow', face('x', AVENUE.x0, 1), HARBOR.z1 + HARBOR.pave, 24, 13.2, { bay: 3.3, litP: 0.1 });
      // ([C6 3rd] the carriage arch through it: the market's back way in
      // from the cross street; the block goes on over it)
      {
        const AR = ARCH, H = 12.4;
        mass('nwb', MAT.brickDark, FENCE.x, AR.x0, -133, MARKET.z0, H);
        mass('nwb', MAT.brickDark, AR.x1, MERCER.x0, -133, MARKET.z0, H);
        mass('nwb', MAT.brickDark, AR.x0, AR.x1, -133, MARKET.z0, H - AR.h, AR.h, false);
        facade('nwb', face('x', MERCER.x0, 1), -133, MARKET.z0, H, { bay: 3.2, litP: 0.1 });
        facade('nwb', face('x', FENCE.x, -1), -133, MARKET.z0, H, { bay: 3.2, litP: 0.12 });
        facade('nwb', face('z', -133, -1), FENCE.x, MERCER.x0, H, { bay: 3.3, litP: 0.12 });
        // the arch's frame on the street: piers, the head, a keystone; its
        // soffit and walls inside (the market's end of it: the gate, things.js)
        const Fn = face('z', -133, -1);
        fbox('nwb', MAT.trim, Fn, AR.x0 - 0.35, AR.x0, 0, AR.h + 0.2, 0, 0.18);
        fbox('nwb', MAT.trim, Fn, AR.x1, AR.x1 + 0.35, 0, AR.h + 0.2, 0, 0.18);
        fbox('nwb', MAT.trim, Fn, AR.x0 - 0.35, AR.x1 + 0.35, AR.h, AR.h + 0.42, 0, 0.2);
        fbox('nwb', MAT.trim, Fn, (AR.x0 + AR.x1) / 2 - 0.2, (AR.x0 + AR.x1) / 2 + 0.2, AR.h - 0.1, AR.h + 0.55, 0, 0.26);
        K.box('nwbArch', MAT.plaster, AR.x0, AR.x1, AR.h - 0.04, AR.h, -133, MARKET.z0);
        // (its cobbles' gutter down the middle, a wheel-guard stone at each pier)
        K.box('nwbArch', MAT.iron, (AR.x0 + AR.x1) / 2 - 0.09, (AR.x0 + AR.x1) / 2 + 0.09, 0.0, 0.012, -133, MARKET.z0, 1 / 6, { cast: false });
        for (const x of [AR.x0 + 0.18, AR.x1 - 0.18]) { K.add('nwbArch', MAT.trim, new THREE.CylinderGeometry(0.16, 0.22, 0.6, 10).translate(x, 0.3, -132.7), { figure: true }); stage.colliders.addCircle(x, -132.7, 0.2, 'guard'); }
        stage.addLook(new THREE.Box3(V3(AR.x0, -1, -133), V3(AR.x1, AR.h, MARKET.z0)), { ambient: 0.08, exposure: 1.0, rainOverlay: 0.0 });
        stage.dry.push(new THREE.Box3(V3(AR.x0, 0, -133), V3(AR.x1, AR.h, MARKET.z0)));
      }
      block('backW', MAT.brickDark, -40, BACKST.x0 - BACKST.pave, -133, BACKST.z1, 12.8, { e: { bay: 3.4, litP: 0.14, pipes: [-104.4, -121.6] }, n: { bay: 3.4, litP: 0.12 } });
      door('backW', face('x', BACKST.x0 - BACKST.pave, 1), -98.6, 1.2, 2.4);
      door('backW', face('x', BACKST.x0 - BACKST.pave, 1), -112.4, 1.1, 2.3);
      // [C6] the cross street at the north end of Pell Lane and Mercer
      // Street (the city's Harbor Street, where its Pell Lane meets it: the
      // seam's first frame looks up the lane at its far side), the block across it
      block('acrossN', MAT.brick, NORTHST.x0, NORTHST.x1, NORTHST.z0 - NORTHST.pave - 18, NORTHST.z0 - NORTHST.pave, 13.6, { s: { bay: 3.4, litP: 0.16, pipes: [-21.0, 12.6, 47.4] } });
      for (const u of [-30.5, -6.2, 33.5]) { fplane('acrossN', MAT.glass, face('z', NORTHST.z0 - NORTHST.pave, 1), u, 1.7, 3.6, 2.4, 0.02, { cast: false }); fbox('acrossN', MAT.trim, face('z', NORTHST.z0 - NORTHST.pave, 1), u - 1.95, u + 1.95, 2.9, 3.2, 0, 0.12); }
      // [C6] where the streets run on into the fog, a builder's hoarding
      // across them (the street up for works: tall boards, a lantern on it):
      // a real end, never an invisible one
      const hoard = (x, z0, z1) => {
        const g = 'hoarding';
        for (let z = z0 + 0.06; z < z1 - 0.06; z += 0.3) K.box(g, MAT.wood, x - 0.03, x + 0.03, 0, 2.4 - ((z * 7.3) % 0.12), z, z + 0.28);
        for (const y of [0.5, 1.9]) K.box(g, MAT.woodDark, x - 0.1, x - 0.03, y - 0.06, y + 0.06, z0, z1);
        for (let z = z0 + 1.2; z < z1 - 0.5; z += 3.2) K.box(g, MAT.woodDark, x - 0.24, x - 0.03, 0, 2.5, z - 0.06, z + 0.06);
        K.collide(x - 0.1, x + 0.05, z0, z1, 'hoarding');
      };
      // ([C6 2nd] the same across a street that runs north - south: the avenue's two ends)
      const hoardZ = (z, x0, x1, n = 1) => {
        const g = 'hoarding';
        for (let x = x0 + 0.06; x < x1 - 0.06; x += 0.3) K.box(g, MAT.wood, x, x + 0.28, 0, 2.4 - ((x * 7.3) % 0.12), z - 0.03, z + 0.03);
        for (const y of [0.5, 1.9]) K.box(g, MAT.woodDark, x0, x1, y - 0.06, y + 0.06, z + n * 0.03, z + n * 0.1);
        for (let x = x0 + 1.2; x < x1 - 0.5; x += 3.2) K.box(g, MAT.woodDark, x - 0.06, x + 0.06, 0, 2.5, z + n * 0.03, z + n * 0.24);
        K.collide(x0, x1, z - 0.05, z + 0.1, 'hoarding');
      };
      hoardZ(AVENUE.z0, AVENUE.x0, AVENUE.x1, 1);
      hoardZ(AVENUE.z1, AVENUE.x0, AVENUE.x1, -1);
      hoard(-36.5, HARBOR.z0 - HARBOR.pave, HARBOR.z1 + HARBOR.pave);
      // ([C6 2nd] Harbor Street runs on across the avenue; the works are beyond it)
      hoard(AVENUE.x1 + 1.6, HARBOR.z0 - HARBOR.pave, HARBOR.z1 + HARBOR.pave);
      hoard(-36.5, NORTHST.z0 - NORTHST.pave, BACKST.z0);
      hoard(92.5, NORTHST.z0 - NORTHST.pave, BACKST.z0);
      // Pell Lane's east side beyond the fence: a brick wall to the next block
      mass('pellWall', MAT.brickDark, FENCE.x, FENCE.x + 0.4, MARKET.z0, FENCE.z0, 3.4);
      fbox('pellWall', MAT.trim, face('x', FENCE.x, -1), MARKET.z0, FENCE.z0, 3.3, 3.5, -0.05, 0.06);
    }

    // ================= [C6 2nd] water tanks on the roofs round the chase =============
    // (the wooden tanks on their iron legs, a conical cap: silhouettes on the
    // sky over the roofs, from the yard, the roof row, the avenue)
    {
      const tank = (x, z, y, r = 1.6, h = 2.8) => {
        const parts = [];
        parts.push(new THREE.CylinderGeometry(r, r * 1.04, h, 22).translate(x, y + 2.4 + h / 2, z));
        parts.push(new THREE.ConeGeometry(r * 1.08, 1.1, 22).translate(x, y + 2.4 + h + 0.55, z));
        for (const [dx, dz] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) parts.push(new THREE.CylinderGeometry(0.06, 0.08, 2.45, 6).translate(x + dx * r, y + 1.2, z + dz * r));
        parts.push(new THREE.BoxGeometry(r * 2, 0.12, 0.12).translate(x, y + 1.0, z), new THREE.BoxGeometry(0.12, 0.12, r * 2).translate(x, y + 1.0, z));
        for (let k = 0.4; k < h; k += 0.7) parts.push(new THREE.TorusGeometry(r + 0.03, 0.025, 4, 24).rotateX(Math.PI / 2).translate(x, y + 2.4 + k, z));
        K.add('waterTanks', MAT.woodDark, merge(parts), { figure: true });
      };
      tank(36.0, -96.0, 11.2);
      tank(82.0, -122.0, 12.0, 1.8, 3.2);
      tank(8.0, -128.0, 12.4, 1.4, 2.4);
      tank(30.0, -70.0, 14.0, 1.7);
      tank(122.0, -60.0, 13.0, 1.9, 3.0);
    }

    // ================= the lamps ====================================================
    const L = stage.part('lamps');
    const lamps = api.lamps = {};
    // Harbor Street: his, under which he stands, and two more down the street
    lamps.watch = L.post(WATCH_LAMP.x, WATCH_LAMP.z, Math.PI / 2);
    lamps.st1 = L.post(-19.0, WATCH_LAMP.z, Math.PI / 2);
    lamps.st2 = L.post(23.0, HARBOR.z0 - 0.7, -Math.PI / 2);
    // the alley
    lamps.s1 = L.wall(5, 4.3, -21.8, -1, 0);
    lamps.s2 = L.wall(0, 4.1, -35.4, 1, 0);
    lamps.s3 = L.wall(4.3, 4.4, LANE.z0, 0, 1, { out: 0.2 });
    // the lane
    lamps.l1 = L.wall(19.0, 4.2, LANE.z1, 0, -1);
    lamps.l2 = L.wall(31.6, 4.0, LANE.z0, 0, 1);
    lamps.l3 = L.wall(45.6, 4.1, LANE.z1, 0, -1, { strength: 0.9 });
    // Pell Lane: my car stands under one; his lamps further up
    lamps.b1 = L.post(0.9, -104.5, Math.PI, { y: 0.15 });
    lamps.b2 = L.post(-13.6, -124.0, 0, { y: 0.15, real: true });
    lamps.b3 = L.post(0.9, -132.0, Math.PI, { real: false });
    lamps.b4 = L.post(-0.35, -87.6, Math.PI, { y: 0.15 });

    // ================= the neon at the end of the alley's sight line ==============
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
    api.bin = bin; api.crate = crate;
    bin(4.5, -37.6); crate(0.55, -44.4, 0.6, 0, 0.4);
    bin(9.0, -52.0); bin(29.0, -47.9, 0.95); crate(43.0, -52.0, 0.7); crate(43.1, -52.1, 0.6, 0.7, 0.2);
    bin(51.0, -48.2); bin(51.6, -48.0, 0.95);
    bin(1.6, -86.6, 0.9); bin(1.5, -107.2);

    K.flush();
    return api;
  },
};

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

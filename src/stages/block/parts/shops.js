import * as THREE from 'three';
import { allocInkId } from '../../../render/layers.js';
import { makeGlassMaterial } from '../../../render/glass.js';
import { lathe, merge, roundedBox, V3 } from '../../../world/geom.js';
import { STREET } from '../../../world/Street.js';
import { SHOP_BAYS } from '../../../world/Facade.js';

// The rooms behind the street's glass (lane 4's brief 5, fix 9): the ten
// shop bays of the near building besides the diner's are real shallow
// rooms (world/Facade.js cuts them, 3.5 m deep), each with a few dark
// shapes that say what shop it is - a tailor's dummies and bolts of cloth,
// a barber's chair and mirror, a pawnbroker's shelves of clocks and
// instruments, an empty shop with a ladder and tins, a florist's palms and
// urns - two with their roller shutters down. Dark: lit only by what the
// street sends in. Their panes are panes of their own (lane 1's glass,
// dark and wet; lane 3's breakage), each with its room.
// A pane of an upper floor that goes opens a room too (Facade.openRoom):
// back wall and a door's outline, a curtain's edge, a lamp shade.
//   api.shops [{ z, kind, pane, room }]    api.dressRoom(box)
const X = STREET.facadeX;

export default {
  name: 'shops', order: 170,
  build(stage) {
    const { M } = stage;
    const facade = stage.part('facade');
    const rng = stage.rng.fork(1700);
    const g = new THREE.Group();
    g.name = 'shops';
    stage.scene.add(g);
    const std = (c, r = 0.85, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0, envMap: M.envSoft, envMapIntensity: 0.15, ...extra });
    const MAT = {
      dark: std(0x0c0c0c), mid: std(0x1c1c1c), cloth: std(0x222222, 0.95), wood: std(0x121212, 0.7),
      metal: new THREE.MeshStandardMaterial({ color: 0x3c3c3c, roughness: 0.35, metalness: 0.8, envMap: M.envSoft, envMapIntensity: 0.7 }),
      mirror: new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.08, metalness: 1.0, envMap: M.envSoft, envMapIntensity: 1.1 }),
      pale: std(0x6a6a6a, 0.9), plaster: std(0x080808, 0.95), ceil: std(0x050505, 1.0), floor: std(0x070707, 0.6),
    };
    const B = (w, h, d, x, y, z, r = 0.02) => roundedBox(w, h, d, Math.min(r, w * 0.4, h * 0.4, d * 0.4), 2).translate(x, y, z);
    const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
    // (each shop's things in its room's frame: x from -3.5 at the back wall
    // to 0 at the glass, z across the bay, y from the floor)
    const KIT = {
      tailor(P, r) {
        for (const [x, z] of [[-1.2, -0.7], [-0.9, 0.8]]) {
          // a dress form: a lathed torso on a pole and a tripod foot
          P.mid.push(lathe([[0, 0.9], [0.14, 0.92], [0.17, 1.02], [0.15, 1.15], [0.18, 1.3], [0.2, 1.42], [0.12, 1.5], [0.05, 1.55], [0.045, 1.62], [0, 1.64]], 24).translate(x, 0, z));
          P.metal.push(new THREE.CylinderGeometry(0.015, 0.015, 0.9, 8).translate(x, 0.45, z));
          for (let k = 0; k < 3; k++) { const a = k * 2.1 + r.next(); P.metal.push(box(0.02, 0.02, 0.32, 0, 0, 0.16).rotateY(a).translate(x, 0.02, z)); }
        }
        // the cutting table and the bolts of cloth on it
        P.wood.push(B(1.0, 0.08, 2.4, -2.6, 0.86, 0));
        for (const z of [-1.05, 1.05]) P.wood.push(B(0.9, 0.82, 0.08, -2.6, 0.41, z));
        for (let k = 0; k < 5; k++) P.cloth.push(new THREE.CylinderGeometry(0.1, 0.1, 0.9, 16).rotateZ(Math.PI / 2).translate(-2.6 + r.range(-0.2, 0.2), 0.99 + (k % 2) * 0.17, -0.8 + k * 0.38));
        // shelves of bolts on the back wall
        for (const y of [1.3, 1.9]) { P.wood.push(box(0.4, 0.04, 3.2, -3.3, y, 0)); for (let k = 0; k < 7; k++) P.cloth.push(new THREE.CylinderGeometry(0.09, 0.09, 0.36, 12).rotateZ(Math.PI / 2).translate(-3.3, y + 0.11, -1.4 + k * 0.45 + r.range(-0.05, 0.05))); }
      },
      barber(P, r) {
        // the chair: a pedestal, the seat, the arms, the back, the headrest,
        // the footrest
        const x = -1.7, z = 0.1;
        P.metal.push(lathe([[0, 0], [0.3, 0], [0.28, 0.05], [0.09, 0.1], [0.08, 0.42], [0.14, 0.46], [0, 0.47]], 24).translate(x, 0, z));
        P.dark.push(B(0.6, 0.14, 0.62, x, 0.55, z, 0.05));
        for (const s of [-1, 1]) P.dark.push(B(0.5, 0.08, 0.1, x + 0.02, 0.8, z + s * 0.33, 0.03));
        P.dark.push(B(0.12, 0.72, 0.58, x - 0.34, 0.95, z, 0.05).rotateZ(0.0));
        P.dark.push(B(0.1, 0.16, 0.3, x - 0.36, 1.43, z, 0.04));
        P.metal.push(box(0.35, 0.04, 0.4, x + 0.5, 0.32, z));
        // the mirror on the back wall in its frame, the shelf below it
        P.mirror.push(box(0.02, 1.0, 1.6, -3.48, 1.65, 0));
        for (const [w, h, y, zz] of [[0.06, 1.14, 1.65, -0.83], [0.06, 1.14, 1.65, 0.83], [0.06, 0.08, 2.2, 0], [0.06, 0.08, 1.1, 0]]) P.wood.push(box(w, h, zz === 0 ? 1.72 : 0.08, -3.45, y, zz));
        P.wood.push(box(0.3, 0.04, 1.6, -3.33, 1.04, 0));
        for (let k = 0; k < 5; k++) P.pale.push(new THREE.CylinderGeometry(0.03, 0.035, r.range(0.12, 0.22), 10).translate(-3.3, 1.12, -0.6 + k * 0.3));
        // a coat stand by the door
        P.wood.push(new THREE.CylinderGeometry(0.025, 0.03, 1.8, 8).translate(-0.6, 0.9, -1.4));
        P.cloth.push(lathe([[0, 1.75], [0.18, 1.6], [0.26, 1.1], [0.24, 0.9], [0, 0.9]], 16).translate(-0.6, 0, -1.4));
      },
      pawn(P, r) {
        // shelves of clocks and instruments on the back wall, a counter
        for (const y of [0.8, 1.45, 2.1, 2.75]) P.wood.push(box(0.42, 0.04, 3.5, -3.28, y, 0));
        for (const y of [0.8, 1.45, 2.1]) {
          let z = -1.6;
          while (z < 1.6) {
            const k = r.int(0, 3);
            if (k === 0) { const rr = r.range(0.1, 0.16); P.mid.push(new THREE.CylinderGeometry(rr, rr, 0.06, 20).rotateZ(Math.PI / 2).translate(-3.28, y + 0.02 + rr, z)); P.pale.push(new THREE.CircleGeometry(rr * 0.8, 20).rotateY(Math.PI / 2).translate(-3.24, y + 0.02 + rr, z)); z += rr * 2 + 0.08; }
            else if (k === 1) { const h = r.range(0.3, 0.5); P.wood.push(B(0.16, h, 0.2, -3.28, y + 0.02 + h / 2, z, 0.03)); P.pale.push(new THREE.CircleGeometry(0.06, 16).rotateY(Math.PI / 2).translate(-3.19, y + h * 0.75, z)); z += 0.3; }
            else if (k === 2) { P.metal.push(lathe([[0.0, 0], [0.03, 0], [0.03, 0.15], [0.05, 0.25], [0.12, 0.34], [0.14, 0.36], [0.0, 0.36]], 18).translate(-3.28, y + 0.02, z)); z += 0.34; }
            else z += r.range(0.1, 0.3);
          }
        }
        // a violin and a horn hung on the side wall, a gramophone
        P.wood.push(new THREE.SphereGeometry(0.1, 14, 10).scale(0.3, 1, 1.5).translate(-2.2, 1.9, 1.78), new THREE.SphereGeometry(0.075, 14, 10).scale(0.3, 1, 1.4).translate(-2.2, 2.15, 1.78), box(0.03, 0.3, 0.03, -2.2, 2.4, 1.78));
        P.metal.push(lathe([[0.01, 0], [0.02, 0.2], [0.05, 0.4], [0.16, 0.55], [0.2, 0.58]], 20).rotateX(0.9).translate(-1.9, 1.35, -0.9));
        P.wood.push(B(0.36, 0.2, 0.36, -1.9, 1.06, -0.9, 0.03));
        // the counter with its grille
        P.wood.push(B(0.6, 0.96, 2.4, -1.9, 0.48, 0.2, 0.02));
        for (let k = 0; k < 7; k++) P.metal.push(box(0.015, 0.5, 0.015, -1.9, 1.21, -0.8 + k * 0.33));
        P.metal.push(box(0.02, 0.02, 2.2, -1.9, 1.46, 0.2));
      },
      empty(P, r) {
        // a stepladder, paint tins, a plank on two trestles, dust sheet
        const x = -1.9, z = 0.3;
        for (const s of [-1, 1]) for (const zz of [-0.25, 0.25]) P.wood.push(box(0.05, 2.1, 0.05, 0, 0, 0).rotateZ(s * 0.2).translate(x + s * 0.2, 1.03, z + zz));
        for (let k = 1; k < 6; k++) P.wood.push(box(0.2, 0.03, 0.5, x - 0.2 + k * 0.012, k * 0.34, z));
        P.wood.push(box(0.5, 0.05, 0.6, x, 2.08, z));
        for (let k = 0; k < 7; k++) { const rr = r.range(0.08, 0.13); P.metal.push(new THREE.CylinderGeometry(rr, rr, rr * 1.6, 16).translate(-1.0 + r.range(-0.5, 0.4), rr * 0.8, -1.3 + r.range(0, 0.9))); }
        P.wood.push(box(0.25, 0.05, 2.4, -3.0, 0.72, 0));
        for (const zz of [-1, 1]) P.wood.push(box(0.5, 0.7, 0.06, -3.0, 0.35, zz));
        P.cloth.push(lathe([[0, 1.0], [0.5, 0.95], [0.75, 0.6], [0.8, 0.05], [0, 0.05]], 7).scale(1, 1, 0.7).translate(-2.9, 0, 1.1));
      },
      florist(P, r) {
        // urns on the floor, palms in them, a bench of pots
        for (const [x, z, s] of [[-1.0, -1.0, 1.0], [-2.6, 0.9, 1.25], [-1.4, 1.1, 0.85]]) {
          P.mid.push(lathe([[0, 0], [0.16, 0], [0.12, 0.08], [0.2, 0.3], [0.27, 0.5], [0.3, 0.56], [0.26, 0.6], [0.2, 0.6]], 20).scale(s, s, s).translate(x, 0, z));
          const th = 1.0 * s;
          P.wood.push(new THREE.CylinderGeometry(0.035, 0.05, th, 8).translate(x, 0.55 * s + th / 2, z));
          const n = 7;
          for (let k = 0; k < n; k++) {
            const a = k / n * Math.PI * 2 + r.next();
            const f = new THREE.ConeGeometry(0.09, 0.9 * s, 4, 1).scale(1, 1, 0.2).rotateZ(Math.PI / 2 + 0.6).rotateY(a);
            f.translate(x + Math.cos(a) * 0.33 * s, 0.55 * s + th + 0.05, z - Math.sin(a) * 0.33 * s);
            P.cloth.push(f);
          }
        }
        P.wood.push(box(0.5, 0.05, 3.0, -3.2, 0.8, 0));
        for (let k = 0; k < 8; k++) { P.mid.push(lathe([[0, 0], [0.07, 0], [0.1, 0.16], [0, 0.16]], 12).translate(-3.2 + r.range(-0.1, 0.1), 0.825, -1.3 + k * 0.37)); P.cloth.push(new THREE.SphereGeometry(r.range(0.08, 0.14), 10, 8).translate(-3.2, 1.05, -1.3 + k * 0.37)); }
      },
    };
    const place = (P, ox, oy, oz, id) => {
      for (const [k, list] of Object.entries(P)) {
        if (!list.length) continue;
        const m = new THREE.Mesh(merge(list.map((q) => q.translate(ox, oy, oz))), MAT[k]);
        m.castShadow = true; m.receiveShadow = true;
        m.userData.inkId = id;
        // (inked as a figure: the room prints as black masses with its
        // contours and a light tick where the street's light catches an
        // edge - the wall's dry-brush lift-outs made a lit shop of it)
        m.userData.inkFigure = true;
        g.add(m);
      }
    };
    const shops = [];
    for (const sb of SHOP_BAYS) {
      const w = 2.9, h = 3.3, y0 = 0.75;
      if (sb.kind === 'shutter') {
        // a roller shutter down over the glass: a steel curtain with a few
        // uneven seams (never an even stripe), its box above, a padlock at
        // its bottom rail
        const id = allocInkId();
        const P = { metal: [], dark: [] };
        P.dark.push(box(0.03, h + 0.1, w + 0.1, X + 0.1, y0 + h / 2 - 0.05, sb.z));
        let y = y0 + 0.2;
        while (y < y0 + h - 0.1) { P.metal.push(box(0.01, 0.018, w, X + 0.118, y, sb.z)); y += rng.range(0.28, 0.62); }
        P.metal.push(B(0.06, 0.08, w + 0.1, X + 0.13, y0 + 0.02, sb.z));
        P.dark.push(B(0.22, 0.32, w + 0.3, X + 0.13, y0 + h + 0.02, sb.z, 0.04));
        P.metal.push(B(0.05, 0.09, 0.07, X + 0.17, y0 - 0.02, sb.z + 0.5, 0.015));
        place(P, 0, 0, 0, id);
        shops.push({ ...sb, pane: null, room: null });
        continue;
      }
      const id = allocInkId();
      const P = { dark: [], mid: [], cloth: [], wood: [], metal: [], mirror: [], pale: [], plaster: [], ceil: [], floor: [] };
      KIT[sb.kind](P, rng.fork(Math.round(sb.z * 10) + 500));
      // the room's lining: plaster walls, boards, a ceiling, 1 cm inside
      // the stone the facade cut (the wet stone is the street's, not the
      // shop's); dark, the sky's light does not reach in here
      {
        const e = 0.01, d = 3.5, hw = 1.85, rh = 4.2;
        P.plaster.push(new THREE.PlaneGeometry(2 * hw, rh).rotateY(Math.PI / 2).translate(-d + e, rh / 2, 0));
        for (const s of [-1, 1]) P.plaster.push(new THREE.PlaneGeometry(d, rh).rotateY(s < 0 ? 0 : Math.PI).translate(-d / 2, rh / 2, s * (hw - e)));
        P.ceil.push(new THREE.PlaneGeometry(d, 2 * hw).rotateX(Math.PI / 2).translate(-d / 2, rh - e, 0));
        P.floor.push(new THREE.PlaneGeometry(d, 2 * hw).rotateX(-Math.PI / 2).translate(-d / 2, e, 0));
        P.wood.push(box(0.03, 0.18, 2 * hw - 0.02, -d + 0.03, 0.09, 0));
      }
      const room = new THREE.Group();
      room.name = 'shop_' + sb.kind;
      g.add(room);
      place(P, X - 0.25, 0.15, sb.z, id);
      const pane = stage.glass.addPane({
        centre: V3(X + 0.03, y0 + h / 2, sb.z), normal: V3(1, 0, 0), w, h, tag: 'shop.' + sb.kind, parent: g, room,
        material: makeGlassMaterial({ wet: 1, side: 'out', tint: 0x101010 }),
      });
      shops.push({ ...sb, pane, room });
    }

    // an upper floor's pane has gone: its room opens (the facade cuts it)
    // and gets a back wall's door outline, a curtain's edge and a lamp shade
    const dressRoom = (bx) => {
      const r = rng.fork(Math.round(bx.z * 13 + bx.y0 * 7));
      const id = allocInkId();
      const P = { dark: [], mid: [], cloth: [], wood: [], metal: [], mirror: [], pale: [], plaster: [], ceil: [], floor: [] };
      const xb = bx.x0, xf = bx.x1, y = bx.y0, zc = bx.z;
      {
        // its lining, as the shops' (inked as a figure: black, with lines)
        const e = 0.01, d = xf - xb, hw = (bx.z1 - bx.z0) / 2, rh = bx.y1 - bx.y0, cx = (xb + xf) / 2;
        P.plaster.push(new THREE.PlaneGeometry(2 * hw, rh).rotateY(Math.PI / 2).translate(xb + e, y + rh / 2, zc));
        for (const s of [-1, 1]) P.plaster.push(new THREE.PlaneGeometry(d, rh).rotateY(s < 0 ? 0 : Math.PI).translate(cx, y + rh / 2, zc + s * (hw - e)));
        P.ceil.push(new THREE.PlaneGeometry(d, 2 * hw).rotateX(Math.PI / 2).translate(cx, bx.y1 - e, zc));
        P.floor.push(new THREE.PlaneGeometry(d, 2 * hw).rotateX(-Math.PI / 2).translate(cx, y + e, zc));
      }
      // the door's outline on the back wall
      const dzz = zc + r.range(-0.6, 0.6);
      for (const [w, h, zz, yy] of [[0.06, 2.1, dzz - 0.45, y + 1.05], [0.06, 2.1, dzz + 0.45, y + 1.05], [0.06, 0.08, dzz, y + 2.15]]) P.wood.push(box(0.04, h, w === 0.06 && h === 0.08 ? 0.96 : w, xb + 0.03, yy, zz));
      // a curtain's edge inside the window
      const cz = zc + (r.chance(0.5) ? -1 : 1) * 0.55;
      P.cloth.push(new THREE.CylinderGeometry(0.12, 0.16, 2.4, 10, 1).scale(0.5, 1, 1).translate(xf - 0.2, y + 0.55 + 1.3, cz));
      // a lamp shade hanging from the ceiling
      P.mid.push(lathe([[0.03, 0], [0.08, -0.05], [0.2, -0.22], [0.22, -0.24]], 18).translate(xb + 1.6, bx.y1 - 0.45, zc + r.range(-0.4, 0.4)));
      P.metal.push(new THREE.CylinderGeometry(0.006, 0.006, 0.45, 5).translate(xb + 1.6, bx.y1 - 0.22, zc));
      place(P, 0, 0, 0, id);
    };
    if (facade) {
      for (const w of facade.windows) {
        if (w.shop || !w.on) continue;
        w.on('state', (pane, st) => { if (st === 'gone') { const bx = facade.openRoom(pane); if (bx) dressRoom(bx); } });
      }
    }
    return { group: g, shops, dressRoom };
  },
};

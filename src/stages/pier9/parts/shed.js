import * as THREE from 'three';
import { FOG } from '../../../render/fog.js';
import { PIER } from '../site.js';
import { makeKit, worldUV } from '../kit.js';
import { mergeGeos } from '../../../props/lib.js';

// The shed (lane B6): board walls 7.2 m high under a pitched roof on iron
// trusses, the posts, the beams the lamps hang from, the clerestory windows
// grey with the night, the doors (the side door I come in by, the big doors
// shut, the bay's side door I leave by), PIER 9 in tall letters on the south
// gable, a caged lamp over the side door. The interior's Look (dust in the
// cones, no screen rain, a dark haze toward the far end, the room's sound)
// and its dry volume.
//   api.sideDoor / api.bayDoor: { open(k?), openK, isOpen, pivot, collider }
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// PIER 9 painted on the boards: white letters, weathered, on a transparent quad
function letteringMap(text, w = 1024, h = 256) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.clearRect(0, 0, w, h);
  g.fillStyle = 'rgba(235,235,235,1)';
  g.font = `bold ${Math.round(h * 0.86)}px "Arial Narrow", "Helvetica Neue", Arial, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.save(); g.scale(0.8, 1); g.fillText(text, w / 2 / 0.8, h * 0.54); g.restore();
  // weathering: the paint gone in flakes and runs
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * w, y = Math.random() * h, r = 1 + Math.random() * 5;
    g.fillStyle = `rgba(0,0,0,${0.3 + Math.random() * 0.7})`; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  for (let i = 0; i < 40; i++) { const x = Math.random() * w; g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x, 0, 2 + Math.random() * 3, h); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default {
  name: 'shed', order: 30,
  build(stage) {
    const g = new THREE.Group();
    g.name = 'pier9_shed';
    stage.scene.add(g);
    const kit = makeKit(stage, g);
    const { M } = kit;
    const S = PIER.shed, t = S.t, H = S.wallH;
    const C = stage.colliders;
    const wallMat = M.wall;

    // ---- the walls, with their openings
    const wallId = kit.piece();
    const walls = [];
    const wallBox = (x0, x1, z0, z1, y0 = 0, y1 = H) => walls.push(worldUV(kit.box(x0, x1, y0, y1, z0, z1), 1.6));
    const col = (x0, x1, z0, z1) => C.addBox((x0 + x1) / 2, (z0 + z1) / 2, (x1 - x0) / 2, (z1 - z0) / 2, 0, 'wall');
    // south (z 0): the side door, the big doors
    const sd = PIER.sideDoor, bd = PIER.bigDoor;
    const sdx0 = sd.x - sd.w / 2, sdx1 = sd.x + sd.w / 2;
    wallBox(S.x0, sdx0, S.z1 - t, S.z1); col(S.x0, sdx0, S.z1 - t, S.z1);
    wallBox(sdx0, sdx1, S.z1 - t, S.z1, sd.h, H);
    wallBox(sdx1, bd.x0, S.z1 - t, S.z1); col(sdx1, bd.x0, S.z1 - t, S.z1);
    wallBox(bd.x0, bd.x1, S.z1 - t, S.z1, bd.h, H);
    wallBox(bd.x1, S.x1, S.z1 - t, S.z1); col(bd.x1, S.x1, S.z1 - t, S.z1);
    // (the big doors' leaves are shut: they hold like a wall)
    col(bd.x0, bd.x1, S.z1 - t, S.z1);
    // west and north: whole
    wallBox(S.x0, S.x0 + t, S.z0, S.z1); col(S.x0, S.x0 + t, S.z0, S.z1);
    wallBox(S.x0, S.x1, S.z0, S.z0 + t); col(S.x0, S.x1, S.z0, S.z0 + t);
    // east: the loading doors and the bay's side door
    const bdz = PIER.bayDoor.z, bw = PIER.bayDoor.w;
    const openings = [[bdz - bw / 2, bdz + bw / 2, PIER.bayDoor.h], ...PIER.loading.map((l) => [l.z - PIER.loadingW / 2, l.z + PIER.loadingW / 2, PIER.loadingH])].sort((a, b) => a[0] - b[0]);
    let z = S.z0;
    for (const [z0, z1, h] of openings) {
      wallBox(S.x1 - t, S.x1, z, z0); col(S.x1 - t, S.x1, z, z0);
      wallBox(S.x1 - t, S.x1, z0, z1, h, H);
      z = z1;
    }
    wallBox(S.x1 - t, S.x1, z, S.z1); col(S.x1 - t, S.x1, z, S.z1);
    // (the loading doors are shut and barred: walls for now)
    for (const l of PIER.loading) col(S.x1 - t, S.x1, l.z - PIER.loadingW / 2, l.z + PIER.loadingW / 2);
    kit.addMerged(walls, wallMat, { cast: true });

    // the gables: triangles over the south and north walls (the walls'
    // boards: one face, no contour at the eaves)
    const gable = (zc) => {
      const sh = new THREE.Shape([new THREE.Vector2(S.x0, H), new THREE.Vector2(S.x1, H), new THREE.Vector2(0, S.ridgeY)]);
      const ge = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false });
      ge.translate(0, 0, zc - t / 2);
      return worldUV(ge, 1.6);
    };
    kit.addMerged([gable(S.z1 - t / 2), gable(S.z0 + t / 2)], wallMat, { cast: true });

    // ---- the roof: two pitched planes of boards, black inside
    kit.piece();
    const run = S.x1 - S.x0, rise = S.ridgeY - H, half = Math.hypot(run / 2, rise);
    const ang = Math.atan2(rise, run / 2);
    const roofs = [];
    for (const s of [-1, 1]) {
      const r = new THREE.BoxGeometry(half + 0.6, 0.12, S.z1 - S.z0 + 0.8);
      r.rotateZ(s * -ang);
      r.translate(s * run / 4, H + rise / 2 + 0.08, (S.z0 + S.z1) / 2);
      roofs.push(r);
    }
    kit.addMerged(roofs, M.roof, { cast: false });

    // ---- the trusses: iron, every 4.5 m; the beams the lamps hang from
    kit.piece();
    const iron = [];
    const bar = (a, b, w = 0.12, d = 0.12) => {
      const L = a.distanceTo(b);
      const m = new THREE.BoxGeometry(w, L, d);
      m.translate(0, L / 2, 0);
      const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
      m.applyQuaternion(q); m.translate(a.x, a.y, a.z);
      iron.push(m);
    };
    for (let tz = S.z1 - 2.5; tz > S.z0 + 1; tz -= 4.5) {
      const y0 = PIER.trussY + 0.05;
      bar(V(S.x0, y0, tz), V(S.x1, y0, tz), 0.14, 0.14);
      bar(V(S.x0, H - 0.1, tz), V(0, S.ridgeY - 0.1, tz), 0.14, 0.14);
      bar(V(S.x1, H - 0.1, tz), V(0, S.ridgeY - 0.1, tz), 0.14, 0.14);
      bar(V(0, y0, tz), V(0, S.ridgeY - 0.1, tz), 0.08, 0.08);
      for (const s of [-1, 1]) {
        for (const k of [0.25, 0.5, 0.75]) {
          const x = s * (run / 2) * k;
          const yr = S.ridgeY - 0.1 - (rise - 0.1) * (Math.abs(x) / (run / 2));
          bar(V(x, y0, tz), V(x, yr, tz), 0.07, 0.07);
          const x2 = s * (run / 2) * (k + 0.25);
          const yr2 = S.ridgeY - 0.1 - (rise - 0.1) * (Math.min(1, Math.abs(x2) / (run / 2)));
          bar(V(x, y0, tz), V(x2, Math.min(yr2, H + 3), tz), 0.06, 0.06);
        }
      }
    }
    // the beams along the aisles, under the trusses: the lamps' flexes
    for (const x of [PIER.aisle.A, PIER.aisle.B, PIER.aisle.C, PIER.hoist.x]) bar(V(x, PIER.trussY, S.z1 - 1), V(x, PIER.trussY, S.z0 + 1), 0.16, 0.2);
    // the posts at the blocks' corners, to the trusses
    for (const [x, zz] of PIER.columns) {
      iron.push(new THREE.BoxGeometry(0.3, PIER.trussY, 0.3).translate(x, PIER.trussY / 2, zz));
      iron.push(new THREE.BoxGeometry(0.46, 0.08, 0.46).translate(x, 0.04, zz));
      C.addBox(x, zz, 0.2, 0.2, 0, 'column');
    }
    kit.addMerged(iron, M.iron, { cast: true });

    // ---- the clerestory: high windows along both long walls, grey with
    // the night sky; dark glazing bars
    kit.piece();
    const panes = [], bars = [];
    for (let wz = S.z1 - 4.5; wz > S.z0 + 2; wz -= 4.5) {
      for (const s of [-1, 1]) {
        const x = s > 0 ? S.x1 - t - 0.01 : S.x0 + t + 0.01;
        const pw = 2.2, y0 = 5.1, y1 = 6.6;
        const p = new THREE.PlaneGeometry(pw, y1 - y0).rotateY(s > 0 ? -Math.PI / 2 : Math.PI / 2).translate(x, (y0 + y1) / 2, wz);
        panes.push(p);
        for (const f of [-0.5, 0, 0.5]) bars.push(new THREE.BoxGeometry(0.06, y1 - y0 + 0.1, 0.06).translate(x - s * 0.02, (y0 + y1) / 2, wz + f * pw));
        for (const yy of [y0, (y0 + y1) / 2, y1]) bars.push(new THREE.BoxGeometry(0.06, 0.06, pw + 0.06).translate(x - s * 0.02, yy, wz));
      }
    }
    const paneMat = M.glow('clerestory', 0.09);
    kit.addMerged(panes, paneMat, { cast: false, noRay: true });
    kit.piece();
    kit.addMerged(bars, M.ironDark, { cast: false });

    // ---- the doors
    const door = (hx, hz, w, h, axis, dirOpen, name) => {
      kit.piece();
      const pivot = new THREE.Group();
      pivot.position.set(hx, 0, hz);
      g.add(pivot);
      const leaf = [];
      // planks with two ledges and a brace
      leaf.push(worldUV(kit.box(0, w, 0.02, h, -0.03, 0.03), 1.6));
      leaf.push(kit.box(0.05, w - 0.05, 0.4, 0.55, -0.07, -0.03), kit.box(0.05, w - 0.05, h - 0.55, h - 0.4, -0.07, -0.03));
      const lm = kit.add(mergeGeos(leaf, { uv: true }), M.plankDoor, { parent: pivot });
      lm.name = name;
      pivot.rotation.y = axis;
      const cx = hx + Math.cos(axis) * w / 2, cz = hz - Math.sin(axis) * w / 2;
      const coll = C.addBox(cx, cz, Math.abs(Math.cos(axis)) * w / 2 + 0.05, Math.abs(Math.sin(axis)) * w / 2 + 0.05, 0, 'door');
      const D = {
        pivot, leaf: lm, collider: coll, openK: 0, target: 0, axis, dirOpen, w,
        get isOpen() { return D.target > 0.5; },
        open(k = 1) { D.target = k; },
        close() { D.target = 0; },
        // (at once: a beat's setup)
        snap(k) { D.target = k; D.openK = k + (k ? -1e-3 : 1e-3); D.step(1); },
        // (its collider stands only while the leaf is shut)
        step(dt) {
          if (Math.abs(D.target - D.openK) < 1e-4) return;
          D.openK += Math.sign(D.target - D.openK) * Math.min(Math.abs(D.target - D.openK), dt * 1.4);
          const e = D.openK * D.openK * (3 - 2 * D.openK);
          pivot.rotation.y = axis + dirOpen * e * 1.75;
          // (open, the box is put out of the way: a box of no size would
          // still push a circle off its centre point)
          coll.cx = D.openK > 0.25 ? 1e5 : cx;
        },
      };
      return D;
    };
    // the side door: hinged at its west jamb, opening inward (north)
    const sideDoor = door(sdx0, S.z1 - t / 2, sd.w, sd.h, 0, -1, 'sideDoor');
    // the bay's side door: in the east wall, hinged at its south jamb,
    // opening outward onto the apron
    const bayDoor = door(S.x1 - t / 2, bdz + bw / 2, bw, PIER.bayDoor.h, Math.PI / 2, -1, 'bayDoor');
    // the big doors: two shut leaves on their track; the loading doors, barred
    kit.piece();
    const big = [];
    for (const [x0, x1] of [[bd.x0, (bd.x0 + bd.x1) / 2], [(bd.x0 + bd.x1) / 2, bd.x1]]) {
      big.push(worldUV(kit.box(x0 + 0.02, x1 - 0.02, 0.02, bd.h, S.z1 - t - 0.06, S.z1 - t + 0.02), 1.6));
      for (const yy of [0.8, 2.6, 4.4]) big.push(kit.box(x0 + 0.1, x1 - 0.1, yy, yy + 0.16, S.z1 - t - 0.12, S.z1 - t - 0.06));
    }
    big.push(kit.box(bd.x0 - 0.3, bd.x1 + 0.3, bd.h + 0.02, bd.h + 0.2, S.z1 - t - 0.2, S.z1 - t - 0.05));
    kit.addMerged(big, M.plankDoor, { cast: true });
    // ([R2-E] each loading door is its planks, its ledges and its bar, each
    // a piece of its own: the last blow of the second fight puts a man back
    // through one and every piece of it goes out over the river - burst(dir);
    // the door's own ink id holds them together as one door until then)
    const loading = PIER.loading.map((l, i) => {
      kit.piece();
      const pz0 = l.z - PIER.loadingW / 2, pz1 = l.z + PIER.loadingW / 2, x = S.x1 - t / 2;
      const grp = new THREE.Group();
      grp.name = 'loadingDoor' + (i + 1);
      g.add(grp);
      const pieces = [];
      // a piece: its geometry centred on its own middle (it turns about it
      // when it flies)
      const piece = (geo, name) => {
        geo.computeBoundingBox();
        const c = geo.boundingBox.getCenter(new THREE.Vector3());
        geo.translate(-c.x, -c.y, -c.z);
        const m = kit.add(geo, M.plankDoor, { parent: grp, name });
        m.position.copy(c);
        pieces.push({ mesh: m, home: c.clone() });
        return m;
      };
      for (const [za, zb] of [[pz0, l.z - 0.01], [l.z + 0.01, pz1]]) {
        // three planks a leaf, the ledges across them
        const n = 3, w = (zb - za - 0.04) / n;
        for (let k = 0; k < n; k++) piece(worldUV(kit.box(x - 0.04, x + 0.04, 0.02, PIER.loadingH, za + 0.02 + k * w + 0.004, za + 0.02 + (k + 1) * w - 0.004), 1.6), 'plank');
        piece(kit.box(x - 0.1, x - 0.04, 0.5, 0.65, za + 0.06, zb - 0.06), 'ledge');
        piece(kit.box(x - 0.1, x - 0.04, PIER.loadingH - 0.65, PIER.loadingH - 0.5, za + 0.06, zb - 0.06), 'ledge');
      }
      // the bar across them in its brackets
      piece(kit.box(x - 0.2, x - 0.1, 1.2, 1.32, pz0 - 0.1, pz1 + 0.1), 'bar');
      const D = { group: grp, z: l.z, pieces, burst: false, x0: S.x1 - t, x1: S.x1 };
      // put back (a beat's setup)
      D.reset = () => {
        for (const p of pieces) {
          if (p.mesh.parent !== grp) { if (p.mesh.parent) p.mesh.parent.remove(p.mesh); grp.add(p.mesh); }
          p.mesh.position.copy(p.home); p.mesh.quaternion.identity(); p.mesh.visible = true;
        }
        D.burst = false;
      };
      return D;
    });

    // ---- PIER 9 on the south gable, over the big doors
    const letters = new THREE.MeshStandardMaterial({ color: 0xb0b0b0, roughness: 0.85, map: letteringMap('PIER 9'), transparent: true, alphaTest: 0.35 });
    letters.userData.inkSurface = 'plaster';
    kit.piece();
    const lt = kit.add(new THREE.PlaneGeometry(11, 2.75).translate(0, 8.0, S.z1 + 0.02), letters, { cast: false, noRay: true });
    lt.name = 'pier9_letters';
    // (the paint is the boards': no contour round its quad)
    lt.userData.inkId = wallId;

    // ---- a caged lamp over the side door, outside: its pool at the door
    kit.piece();
    const lampAt = V(sd.x, 2.95, S.z1 + 0.32);
    const cage = kit.add(mergeGeos([
      new THREE.CylinderGeometry(0.1, 0.12, 0.16, 16).translate(0, 0.08, 0),
      new THREE.CylinderGeometry(0.02, 0.02, 0.32, 6).rotateX(Math.PI / 2).translate(0, 0.18, -0.16),
    ]).translate(lampAt.x, lampAt.y, lampAt.z), M.iron, { cast: false });
    void cage;
    const bulbOut = kit.add(new THREE.SphereGeometry(0.07, 14, 10).translate(lampAt.x, lampAt.y - 0.02, lampAt.z), M.bulb, { cast: false, noRay: true });
    const outLamp = stage.lamps.addCustom({ head: lampAt.clone().setY(lampAt.y - 0.06), axis: V(0, -1, 0.35), height: 3.4, half: 0.62, real: true, bulb: bulbOut, fadeEnd: 0.8, edgeSoft: 0.5, strength: 0.8, tag: 'door' });
    if (outLamp.light) { outLamp.light.intensity = 45; outLamp.light.distance = 9; }

    // ---- inside: the dry volume, the interior's Look, the room's sound
    const room = new THREE.Box3(V(S.x0, -0.5, S.z0), V(S.x1, S.ridgeY + 0.5, S.z1));
    stage.dry.push(room);
    const inLook = { fogDensity: FOG.density * 5.5, fogColor: FOG.color.clone().multiplyScalar(0.28), rainOverlay: 0, rain3d: 0, haze: 0.2, ambient: 0.12, reflect: 'none', room: 'warehouse' };
    stage.addLook(new THREE.Box3(V(S.x0 + 0.05, -1, S.z0 + 0.05), V(S.x1 - 0.05, S.ridgeY, S.z1 - 0.12)), inLook);

    return { group: g, sideDoor, bayDoor, loading, room, inLook, outLamp };
  },
  update(api, dt) {
    api.sideDoor.step(dt);
    api.bayDoor.step(dt);
  },
};

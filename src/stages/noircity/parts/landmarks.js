import * as THREE from 'three';
import { tagInk, allocInkId, markFigure } from '../../../render/layers.js';
import { merge, lathe, roundedBox } from '../../../world/geom.js';
import { CLOCK, GASWORKS, PARK, CRANES, RIVER, QUAY_OFF, PAVE, SPECIAL, PIERS } from '../../../world/plan.js';
import { RAIL } from '../../../world/cityGen.js';
import { quadGeo } from './street.js';

// The landmarks (lane O1), always drawn: the clock tower over Clock Square
// (its four faces lit: seen from everywhere), the gasworks (three holders in
// their guide frames, two stacks, the fence), the park (its railing and
// gates, the paths, the bandstand, the trees), the rail yard (its tracks,
// the wagons standing on them, the signal gantry), the fish market's shed,
// the market hall's barrel roof, the cranes on the south quay, the sheds on
// the piers. Their solids are the generator's (C.specials, C.walls,
// C.posts): what is drawn here is what the colliders say is there.
//   api: { group, clockFaces, update(camera) }
const box = (x0, x1, y0, y1, z0, z1) => new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);

export default {
  name: 'landmarks', order: 40,
  *buildSteps(stage) {
    const { scene, M } = stage;
    const C = stage.part('city').C, SP = C.specials;
    const group = new THREE.Group();
    group.name = 'landmarks';
    scene.add(group);
    const add = (geos, mat, { figure = false, ray = true, shadow = false } = {}) => {
      if (!geos.length) return null;
      const m = new THREE.Mesh(merge(geos), mat);
      tagInk(m);
      if (figure) markFigure(m);
      if (!ray) m.userData.noRay = true;
      m.castShadow = shadow; m.receiveShadow = true;
      group.add(m);
      return m;
    };
    const stoneT = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.9, envMap: M.envSoft, envMapIntensity: 0.25 });
    // ---- the clock tower -------------------------------------------------------------------
    let clockFaces = null;
    {
      const { x, z, h } = CLOCK, W = 11;
      const parts = [];
      parts.push(box(x - W / 2, x + W / 2, 0, h * 0.62, z - W / 2, z + W / 2));
      parts.push(box(x - W / 2 - 0.5, x + W / 2 + 0.5, h * 0.62, h * 0.65, z - W / 2 - 0.5, z + W / 2 + 0.5));
      parts.push(box(x - W / 2 + 1, x + W / 2 - 1, h * 0.65, h * 0.82, z - W / 2 + 1, z + W / 2 - 1));
      parts.push(box(x - W / 2 + 0.5, x + W / 2 - 0.5, h * 0.82, h * 0.84, z - W / 2 + 0.5, z + W / 2 - 0.5));
      parts.push(new THREE.ConeGeometry(W * 0.48, h * 0.22, 4).rotateY(Math.PI / 4).translate(x, h * 0.84 + h * 0.11, z));
      parts.push(new THREE.CylinderGeometry(0.12, 0.12, 6, 6).translate(x, h * 1.06 + 3, z));
      // the base's door and the pilasters up its faces
      for (const s of [-1, 1]) for (const t of [-1, 1]) parts.push(box(x + s * (W / 2 - 0.6) - 0.6, x + s * (W / 2 - 0.6) + 0.6, 0, h * 0.62, z + t * (W / 2) - 0.6, z + t * (W / 2) + 0.6));
      add(parts, stoneT, { shadow: false });
      // the faces: a lit disc on each side, its hands dark over it
      const faceY = h * 0.735, R = 3.2, faces = [], hands = [];
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2, nx = Math.sin(a), nz = Math.cos(a);
        const fx = x + nx * (W / 2 - 1 + 0.05), fz = z + nz * (W / 2 - 1 + 0.05);
        faces.push(new THREE.CircleGeometry(R, 40).rotateY(a).translate(fx, faceY, fz));
        // (ten to eleven: the hour, the minute)
        hands.push(new THREE.BoxGeometry(0.22, R * 0.62, 0.05).translate(0, R * 0.31, 0).rotateZ(0.52).rotateY(a).translate(fx + nx * 0.04, faceY, fz + nz * 0.04));
        hands.push(new THREE.BoxGeometry(0.16, R * 0.88, 0.05).translate(0, R * 0.44, 0).rotateZ(-1.05).rotateY(a).translate(fx + nx * 0.06, faceY, fz + nz * 0.06));
        hands.push(new THREE.TorusGeometry(R, 0.18, 6, 40).rotateY(a).translate(fx + nx * 0.03, faceY, fz + nz * 0.03));
      }
      clockFaces = add(faces, new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(1.6) }), { ray: false });
      add(hands, M.black, { ray: false });
    }
    yield;
    // ---- the gasworks ------------------------------------------------------------------------
    {
      const parts = [], frame = [];
      for (const H of GASWORKS.holders) {
        // the bell (the tank), half risen; the guide frame round it: columns and rings
        parts.push(new THREE.CylinderGeometry(H.r, H.r, H.h * 0.7, 40, 1).translate(H.x, H.h * 0.35, H.z));
        parts.push(new THREE.SphereGeometry(H.r, 40, 8, 0, Math.PI * 2, 0, 0.32).scale(1, 0.5, 1).translate(H.x, H.h * 0.7 - H.r * 0.475, H.z));
        const n = Math.max(8, Math.round(H.r * 0.6));
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2, cx = H.x + Math.cos(a) * (H.r + 1.2), cz = H.z + Math.sin(a) * (H.r + 1.2);
          frame.push(new THREE.CylinderGeometry(0.35, 0.45, H.h, 8).translate(cx, H.h / 2, cz));
        }
        for (const y of [H.h * 0.33, H.h * 0.66, H.h - 0.3]) frame.push(new THREE.TorusGeometry(H.r + 1.2, 0.22, 4, 48).rotateX(Math.PI / 2).translate(H.x, y, H.z));
        // the X braces between the columns
        for (let k = 0; k < n; k++) {
          const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
          const p0 = [H.x + Math.cos(a0) * (H.r + 1.2), H.z + Math.sin(a0) * (H.r + 1.2)], p1 = [H.x + Math.cos(a1) * (H.r + 1.2), H.z + Math.sin(a1) * (H.r + 1.2)];
          const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), hh = H.h * 0.33;
          for (const [y0, y1] of [[0, hh], [hh, hh * 2], [hh * 2, H.h]]) for (const s of [-1, 1]) {
            const g = new THREE.CylinderGeometry(0.08, 0.08, Math.hypot(L, y1 - y0), 4);
            g.rotateZ(s * Math.atan2(L, y1 - y0)).rotateY(-Math.atan2(p1[1] - p0[1], p1[0] - p0[0])).translate((p0[0] + p1[0]) / 2, (y0 + y1) / 2, (p0[1] + p1[1]) / 2);
            frame.push(g);
          }
        }
      }
      for (const S of GASWORKS.stacks) {
        parts.push(lathe([[S.r * 1.6, 0], [S.r * 1.6, 3], [S.r * 1.25, 4], [S.r, S.h - 3], [S.r * 1.15, S.h - 2], [S.r * 1.15, S.h], [S.r * 0.85, S.h], [S.r * 0.85, S.h - 1]], 20).translate(S.x, 0, S.z));
      }
      add(parts, stoneT, { shadow: false });
      add(frame, M.iron, { figure: false });
    }
    yield;
    // ---- the fences (the gasworks', the rail yard's, the park's railing) -----------------------------
    {
      const ironP = [];
      for (const f of SP.fences) {
        const [ax, az] = f.a, [bx, bz] = f.b, L = Math.hypot(bx - ax, bz - az);
        const ang = Math.atan2(-(bz - az), bx - ax), mx = (ax + bx) / 2, mz = (az + bz) / 2;
        const tall = f.park ? 1.6 : 2.4;
        for (const y of f.park ? [0.25, 1.5] : [0.3, 2.2]) ironP.push(new THREE.BoxGeometry(L, 0.06, 0.06).rotateY(ang).translate(mx, y + PAVE, mz));
        const n = Math.max(1, Math.round(L / (f.park ? 0.4 : 3)));
        for (let k = 0; k <= n; k++) {
          const x = ax + (bx - ax) * (k / n), z = az + (bz - az) * (k / n);
          ironP.push(new THREE.BoxGeometry(f.park ? 0.035 : 0.09, tall, f.park ? 0.035 : 0.09).translate(x, tall / 2 + PAVE, z));
        }
        // (a chain-link panel between the yard's posts: a dark mesh, the ink sees through it as a grey)
        if (!f.park) ironP.push(new THREE.BoxGeometry(L, 1.9, 0.02).rotateY(ang).translate(mx, 1.25 + PAVE, mz));
      }
      add(ironP, M.lampIron, { ray: false });
    }
    yield;
    // ---- the park: the paths, the bandstand, the trees --------------------------------------------------
    if (SP.park) {
      const [a, b, c, d] = SP.park.rect;
      const paths = [], bs = [], trees = [], trunks = [];
      for (const [[gx, gz], [cx, cz]] of SP.parkPaths) {
        const L = Math.hypot(cx - gx, cz - gz), dx = (cx - gx) / L, dz = (cz - gz) / L, w = 1.6;
        paths.push(quadGeo([gx - dz * w, gz + dx * w], [cx - dz * w, cz + dx * w], [cx + dz * w, cz - dx * w], [gx + dz * w, gz - dx * w], PAVE + 0.02));
      }
      const pm = new THREE.Mesh(merge(paths), stage.part('street').paveMat);
      pm.layers.set(1); pm.userData.inkId = allocInkId(); pm.receiveShadow = true;
      group.add(pm);
      const B = PARK.bandstand;
      bs.push(new THREE.CylinderGeometry(B.r, B.r + 0.3, 1.1, 8).translate(B.x, PAVE + 0.55, B.z));
      for (let k = 0; k < 8; k++) { const t = (k / 8) * Math.PI * 2; bs.push(new THREE.CylinderGeometry(0.14, 0.14, 3.6, 8).translate(B.x + Math.cos(t) * (B.r - 0.5), PAVE + 1.1 + 1.8, B.z + Math.sin(t) * (B.r - 0.5))); }
      bs.push(new THREE.ConeGeometry(B.r + 1.4, 2.6, 8).translate(B.x, PAVE + 1.1 + 3.6 + 1.3, B.z));
      bs.push(new THREE.CylinderGeometry(0.08, 0.08, 1.5, 6).translate(B.x, PAVE + 8.6, B.z));
      add(bs, M.iron);
      // the trees (the generator's: their trunks are solid)
      void a; void b; void c; void d;
      for (const [x, z, r] of SP.trees || []) {
        trees.push(new THREE.IcosahedronGeometry(r, 1).scale(1, 0.8, 1).translate(x, 4.5 + r * 0.6, z));
        trunks.push(new THREE.CylinderGeometry(0.2, 0.3, 5, 6).translate(x, 2.5, z));
      }
      add(trees, M.tower, { ray: false });
      add(trunks, M.iron);
    }
    yield;
    // ---- the rail yard: tracks, the wagons, the signal gantry ------------------------------------------
    {
      const RY = SPECIAL.find((s) => s.id === 'railyard');
      const [x0, x1, z0, z1] = RY.rect;
      const rails = [], sleepers = [], wag = [];
      for (let k = 0; k < RAIL.tracks; k++) {
        const x = x0 + 8 + k * 8;
        for (const s of [-1, 1]) rails.push(box(x + s * RAIL.gauge / 2 - 0.04, x + s * RAIL.gauge / 2 + 0.04, 0.0, 0.16, z0 + 2, z1 - 9));
        sleepers.push(box(x - 1.3, x + 1.3, -0.02, 0.06, z0 + 2, z1 - 9));
      }
      for (const w of SP.wagons) {
        wag.push(roundedBox(2.8, 2.6, 12.4, 0.15, 2).translate(w.cx, 0.9 + 1.3, w.cz));
        wag.push(box(w.cx - 1.5, w.cx + 1.5, 3.4, 3.6, w.cz - 6.3, w.cz + 6.3));
        for (const dz of [-4.4, 4.4]) for (const s of [-1, 1]) wag.push(new THREE.CylinderGeometry(0.45, 0.45, 0.2, 12).rotateZ(Math.PI / 2).translate(w.cx + s * 0.72, 0.45, w.cz + dz));
      }
      // the signal gantry across the tracks at the yard's middle
      const gz = (z0 + z1) / 2;
      wag.push(box(x0 + 3, x0 + 3.5, 0, 8, gz - 0.25, gz + 0.25), box(x1 - 3.5, x1 - 3, 0, 8, gz - 0.25, gz + 0.25), box(x0 + 3, x1 - 3, 7.6, 8.2, gz - 0.3, gz + 0.3));
      add(rails, M.chrome, { ray: false });
      add(sleepers, M.wood, { ray: false });
      add(wag, M.iron);
      // the signals' lamps: small lit discs on the gantry
      const sig = [];
      for (let x = x0 + 8; x < x1 - 4; x += 16) sig.push(new THREE.CircleGeometry(0.22, 12).translate(x, 7.2, gz + 0.32));
      add(sig, new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(2.0) }), { ray: false });
    }
    yield;
    // ---- the fish market's shed, the market hall's roof -----------------------------------------------
    if (SP.shed) {
      const S = SP.shed, parts = [];
      for (const p of C.posts) if (p.tag === 'column' && p.x >= S.x0 - 0.5 && p.x <= S.x1 + 0.5 && p.z >= S.z0 - 0.5 && p.z <= S.z1 + 0.5) parts.push(new THREE.CylinderGeometry(0.22, 0.28, S.h, 8).translate(p.x, PAVE + S.h / 2, p.z));
      // the roof: two long slopes and the clerestory between
      const W = S.x1 - S.x0 + 2, D = S.z1 - S.z0 + 2, cx = (S.x0 + S.x1) / 2, cz = (S.z0 + S.z1) / 2;
      for (const s of [-1, 1]) parts.push(new THREE.BoxGeometry(W / 2 + 0.6, 0.25, D).rotateZ(s * -0.28).translate(cx + s * W / 4, PAVE + S.h + 1.6, cz));
      parts.push(box(cx - 2, cx + 2, PAVE + S.h + 2.6, PAVE + S.h + 4.2, cz - D / 2, cz + D / 2));
      add(parts, M.iron);
      // its sign: FISH MARKET lettered on the gable over Dock Rd (a pale board)
      const lights = [];
      for (let x = S.x0 + 6; x < S.x1 - 4; x += 12) for (let z = S.z0 + 6; z < S.z1 - 4; z += 12) lights.push(new THREE.CircleGeometry(0.3, 12).rotateX(Math.PI / 2).translate(x, PAVE + S.h - 0.1, z));
      add(lights, M.bulb, { ray: false });
    }
    if (SP.hall) {
      const L = SP.hall;
      const W = L.x1 - L.x0, cx = (L.x0 + L.x1) / 2;
      const g = new THREE.CylinderGeometry(W / 2, W / 2, L.z1 - L.z0, 32, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2).scale(1, 0.45, 1).translate(cx, L.h, (L.z0 + L.z1) / 2);
      add([g], M.iron);
    }
    yield;
    // ---- the cranes on the south quay, the sheds on the piers ------------------------------------------------
    {
      const parts = [];
      const zA = RIVER.s + RIVER.hw + 1.6, zB = RIVER.s + QUAY_OFF - 1.2, H = 22;
      for (const c of CRANES) {
        for (const dx of [-4.2, 4.2]) for (const z of [zA, zB]) parts.push(box(c.x + dx - 0.45, c.x + dx + 0.45, 0, H, z - 0.45, z + 0.45));
        parts.push(box(c.x - 4.8, c.x + 4.8, H, H + 1.2, zA - 0.6, zB + 0.6));
        parts.push(box(c.x - 2.6, c.x + 2.6, H + 1.2, H + 5.6, (zA + zB) / 2 - 3, (zA + zB) / 2 + 3));
        // the jib out over the water, a little raised; its tie back to the A-frame
        parts.push(box(c.x - 0.6, c.x + 0.6, H + 3, H + 4, zB - 2, zB + 36).rotateX(0));
        parts.push(box(c.x - 0.3, c.x + 0.3, H + 5.6, H + 12, (zA + zB) / 2 - 0.3, (zA + zB) / 2 + 0.3));
        const tie = Math.hypot(30, 8);
        parts.push(new THREE.CylinderGeometry(0.07, 0.07, tie, 4).rotateX(Math.atan2(30, -8) * -1 + Math.PI).translate(c.x, H + 8, zB + 13));
        parts.push(new THREE.CylinderGeometry(0.04, 0.04, 14, 4).translate(c.x, H + 3 - 7, zB + 30));
      }
      for (const p of PIERS) {
        const e0 = RIVER.s + QUAY_OFF;
        parts.push(box(p.x - p.w / 2 + 2, p.x + p.w / 2 - 2, PAVE, PAVE + (p.office ? 7 : 5), e0 + p.len * 0.35, e0 + p.len * 0.8));
      }
      add(parts, M.iron);
    }
    const api = {
      group, clockFaces,
      update() {},
    };
    return api;
  },
  build(stage) { const it = this.buildSteps(stage); let r; while (!(r = it.next()).done); return r.value; },
};

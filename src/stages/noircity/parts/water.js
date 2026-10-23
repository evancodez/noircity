import * as THREE from 'three';
import { allocInkId, allocSkylineId, LAYER, tagInk } from '../../../render/layers.js';
import { merge, lathe, roundedBox, V3 } from '../../../world/geom.js';
import { Skyline, makeTowerMaterial } from '../../../world/Skyline.js';
import { makeWaterMaterial } from '../../riverroad/water.js';
import { glowTexture } from '../../../vehicles/models.js';
import { FOG } from '../../../render/fog.js';
import { RIVER, QUAY_OFF, BRIDGE, PIERS, SLIPS, PAVE, WATER_Y, FAR_BANK, STADIUM, WHEEL } from '../../../world/plan.js';
import { RIVER_SEGS } from '../../../world/cityGen.js';
import { lampHead } from '../../../city/kits/street.js';
import { LETTER_FONT } from '../../../ui/lettering.js';
import { mergeUV } from './places.js';

// The river (lane O1): the water east and south of the quay (a car in it is
// a wreck; a man swims to the steps - the scene's), the quay's stone face and
// its cast-iron railing (broken at the piers' mouths and the slipways), the
// piers on their piles, the bridge out over the water on its girders and
// arches to the far bank, where the road is shut (the toll's barrier down, a
// lorry across it); the far bank as a silhouette with its lights, the
// stadium's floodlights (east), the fairground's wheel (south-east); the
// lights the water carries as broken columns (riverroad/water.js).
// API: { water, far, update(camera, pixelHeight) }
const ROW_TONE = [0.30, 0.32, 0.33, 0.34], ROW_HAZE = [0.08, 0.12, 0.16, 0.2];
// the river's Look over the quay and the water: the night darker (the
// city's C11 rule: the lamps, their cones, their streaks and the far
// lights are the whites over the water)
const RIVER_LOOK = { fog: 0.4, exposure: 1.25 };

export default {
  name: 'water', order: 25,
  *buildSteps(stage) {
    const { scene, M, U } = stage;
    const C = stage.part('city').C;
    const rng = stage.rng.fork(2501);
    const group = new THREE.Group();
    group.name = 'river';
    scene.add(group);
    // the far lights the water carries (and their glow): { p, k, w, sprite? }
    const far = [];
    // the look over the water (two boxes: the east reach, the south reach)
    const lk = { fogColor: FOG.color.clone().multiplyScalar(RIVER_LOOK.fog), exposure: stage.look.exposure * RIVER_LOOK.exposure };
    stage.addLook(new THREE.Box3(new THREE.Vector3(RIVER.e + RIVER.hw + 1, -60, -900), new THREE.Vector3(1600, 600, 900)), lk);
    stage.addLook(new THREE.Box3(new THREE.Vector3(-900, -60, RIVER.s + RIVER.hw + 1), new THREE.Vector3(1600, 600, 1600)), lk);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2), makeWaterMaterial(U, WATER_Y));
    water.position.set(300, WATER_Y, 300);
    water.layers.set(LAYER.GROUND);
    water.userData.inkId = allocSkylineId();
    water.userData.noRay = true;
    water.name = 'water';
    scene.add(water);
    // ---- the quay's face, the railings ------------------------------------------------------------
    const face = [];
    for (const s of RIVER_SEGS) {
      const a = [s.ax - s.nx * QUAY_OFF, s.az - s.nz * QUAY_OFF], b = [s.bx - s.nx * QUAY_OFF, s.bz - s.nz * QUAY_OFF];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      face.push(new THREE.BoxGeometry(L + 0.6, -WATER_Y + PAVE + 1.2, 0.8).rotateY(Math.atan2(-(b[1] - a[1]), b[0] - a[0])).translate((a[0] + b[0]) / 2 - s.nx * 0.4, (WATER_Y - 1.2 + PAVE) / 2, (a[1] + b[1]) / 2 - s.nz * 0.4));
    }
    // the piers' piles and their edge beams
    for (const p of PIERS) {
      const z0 = RIVER.s + QUAY_OFF;
      for (let z = z0 + 4; z < z0 + p.len; z += 6) for (const sx of [-1, 0, 1]) face.push(new THREE.CylinderGeometry(0.28, 0.32, -WATER_Y + 1.5, 8).translate(p.x + sx * (p.w / 2 - 0.6), WATER_Y / 2 - 0.5, z));
      face.push(new THREE.BoxGeometry(p.w, 0.6, p.len).translate(p.x, PAVE - 0.3, z0 + p.len / 2));
    }
    const faceM = new THREE.Mesh(merge(face), M.stone || M.kerb);
    tagInk(faceM);
    group.add(faceM);
    yield;
    // the railings: posts every 2 m, a pier every 20, two rails (the walls the generator made: rail = true)
    // (the posts every 3 m in a light lathe: they are instanced along 2.5 km of quay, all drawn whenever any is)
    const post = lathe([[0, 0], [0.07, 0], [0.07, 0.06], [0.03, 0.12], [0.03, 1.02], [0.05, 1.06], [0, 1.16]], 6).translate(0, PAVE, 0);
    const pier = new THREE.BoxGeometry(0.34, 1.25, 0.34).translate(0, PAVE + 0.62, 0);
    const posts = [], piers = [], rails = [];
    for (const w of C.walls) {
      if (!w.rail || w.parapet) continue;
      const [ax, az] = w.a, [bx, bz] = w.b, L = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.round(L / 3));
      for (let k = 0; k <= n; k++) {
        const m = new THREE.Matrix4().makeTranslation(ax + (bx - ax) * (k / n), 0, az + (bz - az) * (k / n));
        if (k % 7 === 0 || k === n) piers.push(m); else posts.push(m);
      }
      for (const y of [PAVE + 0.55, PAVE + 1.08]) rails.push(new THREE.CylinderGeometry(0.028, 0.028, L, 5).rotateZ(Math.PI / 2).rotateY(Math.atan2(-(bz - az), bx - ax)).translate((ax + bx) / 2, y, (az + bz) / 2));
    }
    const inst = (geo, list, mat) => {
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((m, i) => im.setMatrixAt(i, m));
      im.instanceMatrix.needsUpdate = true;
      im.userData.inkId = allocInkId(); im.userData.inkPerInstance = false; im.userData.noRay = true;
      im.computeBoundingSphere();
      group.add(im);
      return im;
    };
    inst(post, posts, M.lampIron); inst(pier, piers, M.lampIron);
    const railM = new THREE.Mesh(merge(rails), M.lampIron);
    tagInk(railM); railM.userData.noRay = true;
    group.add(railM);
    // the slipways' ramps down into the water
    const ramps = [];
    for (const sl of SLIPS) {
      const z0 = RIVER.s + RIVER.hw, len = QUAY_OFF - RIVER.hw + 6, drop = -WATER_Y + 1.2;
      const g = new THREE.PlaneGeometry(sl.w, Math.hypot(len, drop)).rotateX(-Math.PI / 2 + Math.atan2(drop, len) * -1).translate(sl.x, -drop / 2, z0 + len / 2);
      ramps.push(g);
      ramps.push(new THREE.BoxGeometry(0.5, drop + PAVE, len).translate(sl.x - sl.w / 2 - 0.25, -drop / 2, z0 + len / 2));
      ramps.push(new THREE.BoxGeometry(0.5, drop + PAVE, len).translate(sl.x + sl.w / 2 + 0.25, -drop / 2, z0 + len / 2));
    }
    const rampM = new THREE.Mesh(merge(ramps), M.kerb);
    tagInk(rampM);
    group.add(rampM);
    yield;
    // ---- the bridge: two fixed spans on their arches, the bascule's two
    // piers with the tenders' houses, its two leaves up (the road is shut
    // and the eye sees why from the river road: the critic's B2 - a grey
    // lorry and the far bank's boxes 20 m off read as an unfinished edge);
    // the barrier before the near pier, striped, lit, lettered BRIDGE UP ---------
    {
      const x0 = RIVER.e + QUAY_OFF - 1, x1 = BRIDGE.x1, W = BRIDGE.hw + BRIDGE.foot;
      const [hA, hB] = BRIDGE.hinge, PIER = 8, LEAF = (hB - hA) / 2;
      const parts = [];
      // a fixed span from a to b: the deck's edge beams and parapets, the slab, its arches and piers
      const span = (a, b, n) => {
        for (const sz of [-1, 1]) {
          const z = BRIDGE.z + sz * (W + 0.25);
          parts.push(new THREE.BoxGeometry(b - a, 1.3, 0.5).translate((a + b) / 2, PAVE + 0.5, z));
          parts.push(new THREE.BoxGeometry(b - a, 1.2, 0.8).translate((a + b) / 2, -0.6, z));
        }
        parts.push(new THREE.BoxGeometry(b - a, 0.9, W * 2).translate((a + b) / 2, -0.5, BRIDGE.z));
        const L = (b - a) / n;
        for (let k = 0; k <= n; k++) parts.push(new THREE.BoxGeometry(4, -WATER_Y + 1, W * 2 + 2).translate(a + k * L, WATER_Y / 2 - 0.5, BRIDGE.z));
        for (let k = 0; k < n; k++) for (const sz of [-1, 1]) {
          const arc = new THREE.TorusGeometry(L / 2 - 2, 0.55, 6, 24, Math.PI);
          arc.scale(1, 0.32, 1);
          arc.translate(a + (k + 0.5) * L, -1.0, BRIDGE.z + sz * (W - 0.2));
          // (the arch hangs under the deck: flipped)
          parts.push(arc.scale(1, -1, 1).translate(0, -2.0, 0));
        }
      };
      span(x0, hA - PIER, 2);
      span(hB + PIER, x1, 2);
      // the bascule's piers: stone from the water to the deck, wider than it,
      // a tender's house on each side of the road over the water
      const houses = [], lit = [];
      for (const [p0, p1] of [[hA - PIER, hA], [hB, hB + PIER]]) {
        parts.push(new THREE.BoxGeometry(p1 - p0, -WATER_Y + PAVE, W * 2 + 7).translate((p0 + p1) / 2, (WATER_Y + PAVE) / 2, BRIDGE.z));
        parts.push(new THREE.BoxGeometry(p1 - p0 + 1, 0.5, W * 2 + 7.6).translate((p0 + p1) / 2, PAVE - 0.25, BRIDGE.z));
        for (const sz of [-1, 1]) {
          const cz = BRIDGE.z + sz * (W + 2.3), cx = (p0 + p1) / 2;
          houses.push(roundedBox(5.2, 4.6, 3.6, 0.08, 2).translate(cx, PAVE + 2.3, cz));
          houses.push(new THREE.ConeGeometry(3.9, 2.4, 4).rotateY(Math.PI / 4).scale(1, 1, 0.72).translate(cx, PAVE + 4.6 + 1.2, cz));
          // (its window toward the road, lit: the tender is in)
          lit.push(new THREE.PlaneGeometry(1.2, 1.0).rotateY(sz > 0 ? Math.PI : 0).translate(cx, PAVE + 2.6, cz - sz * 1.82));
        }
        // the parapets over the pier
        for (const sz of [-1, 1]) parts.push(new THREE.BoxGeometry(p1 - p0, 1.3, 0.5).translate((p0 + p1) / 2, PAVE + 0.5, BRIDGE.z + sz * (W + 0.25)));
      }
      const m = new THREE.Mesh(merge(parts), M.stone || M.kerb);
      tagInk(m);
      m.receiveShadow = true;
      group.add(m);
      const hm = new THREE.Mesh(merge(houses), M.iron);
      tagInk(hm);
      group.add(hm);
      // the leaves, up: each a deck with its two lattice girders, hinged at its pier and turned up by BRIDGE.raise
      const leaf = [], rails = [];
      for (const [hx, dir] of [[hA, 1], [hB, -1]]) {
        const L = LEAF - 0.6, g = [];
        g.push(new THREE.BoxGeometry(L, 1.0, W * 2).translate(L / 2, -0.5, 0));
        // the cross girders under it (they face the road when it is up)
        for (let u = 1.5; u < L; u += 3) g.push(new THREE.BoxGeometry(0.35, 0.9, W * 2).translate(u, -1.3, 0));
        const r = [];
        for (const sz of [-1, 1]) {
          const z = sz * (W + 0.1);
          r.push(new THREE.BoxGeometry(L, 0.3, 0.3).translate(L / 2, 2.2, z));
          r.push(new THREE.BoxGeometry(L, 0.35, 0.35).translate(L / 2, 0.15, z));
          for (let u = 0; u <= L; u += 2) r.push(new THREE.BoxGeometry(0.16, 2.1, 0.16).translate(u, 1.15, z));
          for (let u = 0; u + 2 <= L; u += 2) r.push(new THREE.BoxGeometry(0.1, Math.hypot(2, 2.05), 0.1).rotateZ(((u / 2) % 2 ? 1 : -1) * Math.atan2(2, 2.05)).translate(u + 1, 1.15, z));
        }
        // (built along +x from the hinge; the far leaf turned round to face it; turned up about the hinge)
        const place = (geo) => { if (dir < 0) geo.rotateY(Math.PI); geo.rotateZ(dir * BRIDGE.raise); geo.translate(hx, PAVE, BRIDGE.z); return geo; };
        leaf.push(place(merge(g)));
        rails.push(place(merge(r)));
        // a lantern at its tip (a mark on the sky: the bridge is up)
        const tip = new THREE.Vector3(L, 2.4, 0);
        if (dir < 0) tip.x = -L;
        tip.applyAxisAngle(new THREE.Vector3(0, 0, 1), dir * BRIDGE.raise).add(new THREE.Vector3(hx, PAVE, BRIDGE.z));
        for (const sz of [-1, 1]) far.push({ p: V3(tip.x, tip.y, tip.z + sz * W), k: 1.4, w: 1.2, sprite: 5 });
      }
      const lm0 = new THREE.Mesh(merge(leaf), M.iron);
      tagInk(lm0); lm0.castShadow = false;
      group.add(lm0);
      const rm = new THREE.Mesh(merge(rails), M.lampIron);
      tagInk(rm); rm.userData.noRay = true;
      group.add(rm);
      // the barrier (shut): two posts, the boom in black and white, a board
      // lettered BRIDGE UP lit on it, two lanterns on the posts
      const bx = BRIDGE.barrier;
      const ink = [], paper = [];
      for (const sz of [-1, 1]) ink.push(new THREE.BoxGeometry(0.4, 1.7, 0.4).translate(bx, PAVE + 0.85, BRIDGE.z + sz * (W - 0.1)));
      const n = 14, seg = (W * 2) / n;
      for (let k = 0; k < n; k++) for (const y of [1.1, 0.55]) (k % 2 ? ink : paper).push(new THREE.BoxGeometry(0.2, 0.26, seg).translate(bx, PAVE + y, BRIDGE.z - W + (k + 0.5) * seg));
      for (const sz of [-1, 1]) { lit.push(new THREE.SphereGeometry(0.22, 12, 8).translate(bx, PAVE + 1.95, BRIDGE.z + sz * (W - 0.1))); far.push({ p: V3(bx - 0.3, PAVE + 1.95, BRIDGE.z + sz * (W - 0.1)), k: 1.2, w: 1.0, sprite: 3 }); }
      const im = new THREE.Mesh(merge(ink), M.iron);
      tagInk(im);
      group.add(im);
      const pm = new THREE.Mesh(merge(paper), new THREE.MeshStandardMaterial({ color: 0xe0ddd6, roughness: 0.5 }));
      pm.userData.inkId = im.userData.inkId;
      group.add(pm);
      // the board: lettered on a canvas, lit (paper with black letters), both faces
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
      const g2 = cv.getContext('2d');
      g2.fillStyle = '#e4e0d6'; g2.fillRect(0, 0, 512, 128);
      g2.strokeStyle = '#111'; g2.lineWidth = 8; g2.strokeRect(8, 8, 496, 112);
      g2.fillStyle = '#0a0a0a'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.font = `700 78px ${LETTER_FONT}`;
      g2.fillText('BRIDGE UP', 256, 68);
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
      const board = [];
      for (const s2 of [-1, 1]) board.push(new THREE.PlaneGeometry(3.6, 0.9).rotateY(s2 * Math.PI / 2).translate(bx + s2 * 0.13, PAVE + 1.95, BRIDGE.z));
      const bm = new THREE.Mesh(mergeUV(board), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color().setScalar(1.15) }));
      bm.userData.inkId = im.userData.inkId; bm.userData.noRay = true;
      group.add(bm);
      im.userData.noRay = false;
      const litM = new THREE.Mesh(merge(lit), new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(2.4) }));
      litM.userData.inkId = allocInkId(); litM.userData.noRay = true;
      group.add(litM);
    }
    yield;
    // ---- the far bank: its sheds and their lights, the towers beyond, the stadium, the wheel -------------------------
    const lit = new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(2.2) });
    const bank = [], lights = [];
    // (the far bank is a silhouette, never a place: its quay's dark face
    // along the water under the lights, its sheds pushed back and fogged
    // like the skyline's towers - the critic's m5: lights hanging in a void,
    // grey boxes read as cardboard from the bridge)
    const shed = (x, z, w, d, h) => bank.push(new THREE.BoxGeometry(w, h, d).translate(x, WATER_Y + h / 2 + 1.2, z));
    const light = (x, y, z, k = 1) => { lights.push(new THREE.SphereGeometry(0.55, 8, 6).translate(x, y, z)); far.push({ p: V3(x, y, z), k: k * rng.range(0.7, 1.6) * 1.6, w: 1.3 }); };
    bank.push(new THREE.BoxGeometry(14, 3.4, 1300).translate(FAR_BANK.east + 7, WATER_Y + 1.5, 10));
    bank.push(new THREE.BoxGeometry(1240, 3.4, 14).translate(-10, WATER_Y + 1.5, FAR_BANK.south + 7));
    for (let z = -620; z < 640; z += rng.range(18, 40)) {
      if (Math.abs(z - BRIDGE.z) < 22) continue;
      const h = rng.range(6, 15);
      shed(FAR_BANK.east + 26 + rng.range(0, 40), z, rng.range(12, 26), rng.range(14, 36), h);
      if (rng.chance(0.55)) light(FAR_BANK.east + 4, WATER_Y + 1.4 + rng.range(4, 7), z + rng.range(-8, 8));
    }
    for (let x = -620; x < 600; x += rng.range(18, 40)) {
      const h = rng.range(6, 15);
      shed(x, FAR_BANK.south + 26 + rng.range(0, 40), rng.range(14, 36), rng.range(12, 26), h);
      if (rng.chance(0.55)) light(x + rng.range(-8, 8), WATER_Y + 1.4 + rng.range(4, 7), FAR_BANK.south + 4);
    }
    const bankMesh = new THREE.Mesh(merge(bank), makeTowerMaterial(U, ROW_TONE[0], ROW_HAZE[0]));
    bankMesh.userData.inkId = allocSkylineId(); bankMesh.userData.noRay = true;
    group.add(bankMesh);
    // the stadium: its bowl, four floodlight towers (their lamps the brightest far lights)
    {
      const S = STADIUM, parts = [];
      parts.push(new THREE.CylinderGeometry(S.r, S.r * 0.92, 18, 32, 1, true).translate(S.x, 9, S.z));
      for (let k = 0; k < 4; k++) {
        const a = Math.PI / 4 + k * Math.PI / 2, tx = S.x + Math.cos(a) * (S.r + 6), tz = S.z + Math.sin(a) * (S.r + 6);
        parts.push(new THREE.CylinderGeometry(0.8, 1.4, 42, 6).translate(tx, 21, tz));
        parts.push(new THREE.BoxGeometry(7, 4, 1).rotateY(-a + Math.PI / 2).translate(tx, 43, tz));
        for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) light(tx + Math.cos(a + Math.PI / 2) * (i - 1) * 2.2, 42.4 + j * 1.6, tz + Math.sin(a + Math.PI / 2) * (i - 1) * 2.2, 2.2);
      }
      const sm = new THREE.Mesh(merge(parts), makeTowerMaterial(U, ROW_TONE[1], ROW_HAZE[1]));
      sm.userData.inkId = allocSkylineId(); sm.userData.noRay = true; sm.frustumCulled = false;
      group.add(sm);
      // (the floodlights' glow over the bowl: a stadium at night across the water)
      far.push({ p: V3(S.x, 34, S.z), k: 0, w: 0, sprite: 190, dim: 0.22 });
    }
    // the wheel: a ring, its spokes, its cars, its legs, a few lights round its rim
    {
      const Wl = WHEEL, parts = [], y0 = Wl.r + 6;
      parts.push(new THREE.TorusGeometry(Wl.r, 0.45, 6, 64).translate(Wl.x, y0, Wl.z));
      parts.push(new THREE.TorusGeometry(Wl.r * 0.96, 0.25, 6, 64).translate(Wl.x, y0, Wl.z + 1.2));
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        parts.push(new THREE.CylinderGeometry(0.12, 0.12, Wl.r, 4).translate(0, Wl.r / 2, 0).rotateZ(a).translate(Wl.x, y0, Wl.z));
        parts.push(new THREE.BoxGeometry(1.8, 1.8, 2.4).translate(Wl.x + Math.cos(a) * Wl.r, y0 + Math.sin(a) * Wl.r - 1.4, Wl.z + 0.6));
        light(Wl.x + Math.cos(a) * Wl.r, y0 + Math.sin(a) * Wl.r, Wl.z - 0.6, 0.8);
        light(Wl.x + Math.cos(a + Math.PI / 16) * Wl.r, y0 + Math.sin(a + Math.PI / 16) * Wl.r, Wl.z - 0.6, 0.5);
      }
      for (const s of [-1, 1]) parts.push(new THREE.CylinderGeometry(0.5, 0.9, y0 * 1.08, 6).rotateZ(s * 0.32).translate(Wl.x + s * y0 * 0.17, y0 / 2, Wl.z));
      const wm = new THREE.Mesh(merge(parts), makeTowerMaterial(U, ROW_TONE[1], ROW_HAZE[1]));
      wm.userData.inkId = allocSkylineId(); wm.userData.noRay = true; wm.frustumCulled = false;
      group.add(wm);
    }
    const lm = new THREE.Mesh(merge(lights), lit);
    lm.userData.inkId = bankMesh.userData.inkId; lm.userData.noRay = true; lm.frustumCulled = false;
    group.add(lm);
    {
      const gm = new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color().setScalar(0.8), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
      const gd = new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color().setScalar(0.22), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
      for (const f of far) {
        const sp = new THREE.Sprite(f.dim ? gd : gm);
        sp.position.copy(f.p);
        sp.scale.setScalar(f.sprite || 7 + f.k * 2.2);
        sp.layers.set(LAYER.FX_REFL); sp.renderOrder = 6; sp.userData.noRay = true;
        group.add(sp);
      }
    }
    yield;
    // the towers beyond the far bank (the block's skyline kit: fogged silhouettes)
    const sk = Object.create(Skyline.prototype);
    Object.assign(sk, { world: stage, windows: [], _az: [], wrng: stage.rng.fork(2502), group });
    const trng = stage.rng.fork(2503);
    const rings = [
      { at: (u) => [FAR_BANK.east + trng.range(80, 260), u], span: [-900, 700], h: [34, 100], w: [14, 28], gap: [22, 56] },
      { at: (u) => [u, FAR_BANK.south + trng.range(80, 260)], span: [-900, 500], h: [30, 90], w: [16, 30], gap: [26, 70] },
      { at: (u) => [-760 - trng.range(0, 200), u], span: [-900, 600], h: [40, 120], w: [16, 30], gap: [30, 70] },
      { at: (u) => [u, -760 - trng.range(0, 200)], span: [-900, 700], h: [40, 130], w: [16, 30], gap: [30, 70] },
    ];
    for (let ri = 0; ri < rings.length; ri++) {
      const R = rings[ri];
      const parts = [];
      for (let u = R.span[0]; u < R.span[1]; u += trng.range(R.gap[0], R.gap[1])) {
        const [x, z] = R.at(u);
        const h = trng.range(R.h[0], R.h[1]);
        if (trng.chance(0.3)) sk.slabTower(parts, trng, x, z, h * 0.9, trng.range(R.w[0], R.w[1]) * 1.2);
        else sk.tower(parts, trng, x, z, h, trng.range(R.w[0], R.w[1]) * 1.2, Math.min(3, ri % 2 + 1), false, 0);
      }
      const mesh = new THREE.Mesh(merge(parts), makeTowerMaterial(U, ROW_TONE[2], ROW_HAZE[2]));
      mesh.userData.inkId = allocSkylineId();
      mesh.userData.noRay = true;
      mesh.frustumCulled = false;
      group.add(mesh);
      yield;
    }
    sk.buildWindows();
    if (sk.windowMesh) sk.windowMesh.userData.noRay = true;
    // ---- the lights the water carries ---------------------------------------------------------------------
    const cand = [], res = { x: 1, y: 1 };
    const quayLamps = C.lamps.filter((l) => l.quay || l.bridge).map((l) => ({ l, p: lampHead(l) }));
    return {
      group, water, far,
      update(camera, pixelHeight) {
        if (!water.material.setLights) return;
        const p = camera.position;
        cand.length = 0;
        for (const q of quayLamps) {
          if (q.l.dead || q.l.on === false) continue;
          if (Math.abs(q.p.x - p.x) + Math.abs(q.p.z - p.z) > 260) continue;
          cand.push({ p: q.p, k: 4.2, w: 0.95 });
        }
        for (const f of far) if (f.k > 0) cand.push(f);
        res.y = pixelHeight || 900; res.x = res.y * camera.aspect;
        water.material.setLights(cand, camera, res);
      },
    };
  },
  build(stage) { const it = this.buildSteps(stage); let r; while (!(r = it.next()).done); return r.value; },
  update: (r, dt, t, camera, ph) => r.update(camera, ph),
};

import * as THREE from 'three';
import { tagInk, allocInkId, allocSkylineId, markFigure, LAYER } from '../../../render/layers.js';
import { makeConeMesh } from '../../../render/shaders/cone.js';
import { merge, roundedBox, lathe, tube, V3 } from '../../../world/geom.js';
import { STREET } from '../../../world/Street.js';
import { Steam } from '../../../fx/Steam.js';
import { DINER } from '../site.js';
import { linearFor, EXPOSURE } from '../../../render/tone.js';
import * as W from '../../../world/Works.js';

// The block's edges (lane 4's brief 2, fix 6): every metre where the
// player used to be stopped by an invisible wall is now a thing a man
// cannot pass, with its collider, and a solid for bullets:
//   south (z 30 .. 36, behind the start): road works - two sawhorse
//     barricades with storm lanterns, a trench across the left lanes with a
//     plank bridge chained off and a mound of spoil, a tar boiler breathing
//     steam, a flatbed truck parked across the right lanes with its
//     tailboard to us, timber hoarding with torn bills on the pavements
//   east (x = 22): an iron railing, spear-topped bars on a brick plinth,
//     brick piers every 8.8 m, one pair of locked gates; beyond it a rail
//     yard in the mist (wagons, a timber stack, a water tower, a gantry)
//   north (z -118 .. -126, under the el's crossing): a pipe-laying job -
//     two trucks nose to tail, pipe stacks, a compressor, barricades with
//     lanterns, rubble between the el's columns; low, so the far lamps and
//     the mist still show over it
//   west: the building line (walls), the cross street open 14 m for the
//     side alley and then a wire gate with a van behind it, board fences in
//     the other gaps
// The outer net (colliders' bounds and a region round the whole block) lies
// beyond all of it. The Hoods' nav grid and the legacy spawner still read
// colliders.bounds (unchanged: their grid, their spawns); nothing here
// stands inside it.
//   api.perimeterTest() -> { stops, byTag, net }   (see below)
const SOUTH_Z = 30.0, NORTH_Z = -118.0, EAST_X = 22.0;

export default {
  name: 'bounds', order: 150,
  build(stage) {
    const { M, colliders } = stage;
    const rng = stage.rng.fork(1500);
    const g = new THREE.Group();
    g.name = 'bounds';
    stage.scene.add(g);
    const std = (o) => new THREE.MeshStandardMaterial(o);
    const MAT = {
      paint: M.paint, rubber: M.rubber, hub: M.hubcap, glass: M.carGlass, chrome: M.chrome,
      wood: std({ color: 0x2a2a2a, roughness: 0.85, envMap: M.envSoft, envMapIntensity: 0.15 }),
      iron: M.iron,
      brick: std({ color: 0x3a3a3a, roughness: 0.9, envMap: M.envSoft, envMapIntensity: 0.2 }),
      clay: std({ color: 0x1e1e1e, roughness: 1.0 }),
      pit: new THREE.MeshBasicMaterial({ color: 0x000000 }),
      glow: new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 5, 5) }),
    };
    const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _y = V3(0, 1, 0), _one = V3(1, 1, 1);
    // place a builder's parts (a { key: geo[] } set) at (x, z) turned by
    // yaw (a figure's heading: its +z faces (sin yaw, cos yaw)), one mesh
    // per material, one ink id for the thing
    // (Wave A fix D3, the frame rate) The works at the south, north and west
    // edges are many small things - sawhorses, lanterns, trucks, pipe
    // stacks, hoardings, bills - each one a mesh per material with an ink id
    // of its own: ~100 meshes, ~150 draws a frame down the avenue. A thing
    // at those edges is now baked (already in world space, as before) into
    // its edge's bucket for its material: one mesh per edge and material,
    // one ink id per edge (figures - the trucks, the van, the compressor -
    // one of their own). The vertices are the same numbers as before. What
    // is lost is only the id line between two things of one edge where no
    // depth or normal edge draws it anyway: two black trucks nose to tail
    // (black on black), a lantern on its sawhorse; the east railing keeps
    // its own ids (its caps' line is its design).
    const buckets = new Map();
    const edgeOf = (x, z) => (z > 25 ? 'S' : z < -110 ? 'N' : x < -9 ? 'W' : null);
    const edgeIds = {};
    const edgeId = (e, figure) => edgeIds[e + (figure ? 'F' : '')] ?? (edgeIds[e + (figure ? 'F' : '')] = allocInkId());
    const bucket = (e, k, figure, mat, geo, { cast = true, receive = true, noRay = false } = {}) => {
      const key = e + '|' + k + '|' + (figure ? 'F' : '');
      let B = buckets.get(key);
      if (!B) buckets.set(key, B = { mat, figure, id: edgeId(e, figure), geos: [], cast, receive, noRay });
      B.geos.push(geo);
    };
    const thing = (P, x, z, yaw = 0, { figure = false, y = 0, parent = g, id = null, edge = edgeOf(x, z) } = {}) => {
      _m.compose(V3(x, y, z), _q.setFromAxisAngle(_y, yaw), _one);
      const out = [];
      if (edge && parent === g) {
        for (const [k, list] of Object.entries(P)) {
          if (!list.length) continue;
          bucket(edge, k, figure, MAT[k], merge(list.map((q) => q.clone().applyMatrix4(_m))), { cast: k !== 'glow', noRay: k === 'glow' });
        }
        return { meshes: out, edge };
      }
      if (id == null) id = allocInkId();
      for (const [k, list] of Object.entries(P)) {
        if (!list.length) continue;
        const geo = merge(list.map((q) => q.clone().applyMatrix4(_m)));
        const m = new THREE.Mesh(geo, MAT[k]);
        m.castShadow = k !== 'glow'; m.receiveShadow = true;
        if (k === 'glow') m.userData.noRay = true;
        parent.add(m);
        out.push(m);
      }
      const grp = { meshes: out };
      for (const m of out) { m.userData.inkId = id; if (figure) m.userData.inkFigure = true; }
      return grp;
    };
    // the buckets become meshes once every edge has been built
    const flush = () => {
      for (const [key, B] of buckets) {
        const m = new THREE.Mesh(merge(B.geos), B.mat);
        m.name = 'bounds_' + key;
        m.castShadow = B.cast; m.receiveShadow = B.receive;
        if (B.noRay) m.userData.noRay = true;
        m.userData.inkId = B.id;
        if (B.figure) m.userData.inkFigure = true;
        g.add(m);
      }
      buckets.clear();
    };
    // a collider box given by its footprint's two corners (axis aligned)
    const wallAA = (x0, x1, z0, z1, tag) => colliders.addBox((x0 + x1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0) / 2, Math.abs(z1 - z0) / 2, 0, tag);
    // an oriented box: centre, half sizes along the thing's x / z, heading
    const wallOB = (x, z, hx, hz, yaw, tag) => colliders.addBox(x, z, hx, hz, yaw, tag);

    // storm lanterns: a lit globe in its wire guard. (Wave A fix D6) Each is
    // a lamp of the registry now (stage.lamps.addCustom): small and short -
    // a faint cone 0.6 m down, no pool light - so the renderer knows it as a
    // lamp (its sheen on the wet road is one of the lamps' sheens, held down
    // near the eye like theirs; its head a small disc in the mirror), and its
    // registry entry (rain, rim) counts only while the eye is near
    // it (6 m): it never takes a far street lamp's slot. The globe prints white but
    // small (a gentler emitter: at 3 m the old one bloomed into a white disc
    // 100 px across over the road)
    MAT.glow.color.setScalar(1.7);
    const lanterns = [];
    const lanternAt = (x, y, z) => {
      const L = W.lantern();
      const t = thing(L.parts, x, z, 0, { y });
      const c = V3(x, y + L.globe.y, z);
      const bulb = t.meshes.find((m) => m.material === MAT.glow) || null;
      const lamp = stage.lamps.addCustom({ head: c, axis: V3(0, -1, 0), height: 0.6, half: 0.85, real: false, bulb, fadeEnd: 0.65, edgeSoft: 0.8, strength: 0.22, tag: 'lantern' });
      lamp.sconce = true;
      lamp.entry.range = 2.5;
      // (its air light only a breath: at full a lamp's cone, it stood under
      // the globe as a small grey bell)
      lamp.cone.material.uniforms.uIntensity.value *= 0.45;
      lamp.coneBase = lamp.cone.material.uniforms.uIntensity.value;
      lanterns.push({ pos: c, cone: lamp.cone, lamp });
    };
    const sawhorseAt = (x, z, yaw, len = 2.4, lamp = true) => {
      thing(W.sawhorse(len), x, z, yaw);
      const s = Math.sin(yaw), c = Math.cos(yaw);
      if (lamp) lanternAt(x + s * len * 0.15, 1.15, z + c * len * 0.15);
      wallOB(x, z, 0.3, len / 2, yaw, 'barricade');
    };
    // a timber hoarding from a to b (on the ground), bills on its face
    // toward `face` (+1: the side the boards' +x normal points to)
    const billMats = [];
    for (let i = 0; i < 6; i++) billMats.push(new THREE.MeshStandardMaterial({ map: W.billTexture(rng), transparent: true, alphaTest: 0.5, roughness: 0.9, envMap: M.envSoft, envMapIntensity: 0.1 }));
    const hoardingAB = (ax, az, bx, bz, h = 2.4, face = 1) => {
      const len = Math.hypot(bx - ax, bz - az);
      const yaw = Math.atan2(bx - ax, bz - az);
      const H = W.hoarding(len, h, rng);
      const edge = edgeOf((ax + bx) / 2, (az + bz) / 2);
      const id = edge ? edgeId(edge, false) : allocInkId();
      const t = thing(H.parts, ax, az, yaw, { id, edge });
      const s = Math.sin(yaw), c = Math.cos(yaw);
      // (the boards' +x normal in world: (cos yaw, 0, -sin yaw))
      const nx = c * face, nz = -s * face;
      for (const b of H.bills) {
        const px = ax + s * b.z + nx * 0.03, pz = az + c * b.z + nz * 0.03;
        const bm = billMats[Math.floor(b.seed * billMats.length)];
        const pl = new THREE.Mesh(new THREE.PlaneGeometry(b.w, b.h), bm);
        pl.position.set(px, b.y, pz);
        pl.lookAt(px + nx, b.y, pz + nz);
        pl.rotateZ((b.torn - 0.5) * 0.06);
        if (edge) {
          // (a bill joins its edge's bucket for its paper: baked where it hangs)
          pl.updateMatrix();
          bucket(edge, 'bill' + billMats.indexOf(bm), false, bm, pl.geometry.clone().applyMatrix4(pl.matrix), { cast: false, receive: false, noRay: true });
          continue;
        }
        pl.userData.inkId = id;
        pl.userData.noRay = true;
        g.add(pl);
      }
      wallOB((ax + bx) / 2, (az + bz) / 2, 0.12, len / 2, yaw, 'hoarding');
      return t;
    };

    // ================= south: the road works behind the start ===========
    const SZ = SOUTH_Z;
    hoardingAB(STREET.facadeX + 0.43, SZ + 4.0, STREET.kerbX + 0.15, SZ + 4.0, 2.4, -1);
    // the trench across the left lanes: a black pit, shoring along its lips
    const trench = { x0: STREET.kerbX + 0.2, x1: 4.2, z0: SZ + 1.7, z1: SZ + 3.0 };
    {
      const id = edgeId('S', false);
      const pit = new THREE.Mesh(new THREE.BoxGeometry(trench.x1 - trench.x0, 0.02, trench.z1 - trench.z0).translate((trench.x0 + trench.x1) / 2, 0.006, (trench.z0 + trench.z1) / 2), MAT.pit);
      pit.userData.inkId = id; pit.receiveShadow = false;
      g.add(pit);
      const sh = [];
      for (const z of [trench.z0 - 0.08, trench.z1 + 0.08]) sh.push(W.B(trench.x1 - trench.x0 + 0.2, 0.16, 0.16, (trench.x0 + trench.x1) / 2, 0.06, z, 0.02));
      // the spoil: a long low mound of clay and cobbles beyond it
      const mound = new THREE.SphereGeometry(1, 40, 14, 0, Math.PI * 2, 0, Math.PI / 2);
      const p = mound.getAttribute('position'), mr = rng.fork(3);
      const bumps = Array.from({ length: 9 }, () => [mr.range(-1, 1), mr.range(-1, 1), mr.range(0.05, 0.15)]);
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        let d = 0;
        for (const [bx, bz, a] of bumps) d += a * Math.exp(-((x - bx) ** 2 + (z - bz) ** 2) * 6);
        p.setXYZ(i, x * (1 + d * 0.3), y * (1 + d * 2), z * (1 + d * 0.3));
      }
      mound.computeVertexNormals();
      mound.scale(4.6, 0.95, 0.9).translate(-1.4, 0, SZ + 4.1);
      const cob = [];
      for (let i = 0; i < 26; i++) cob.push(W.B(mr.range(0.12, 0.2), 0.1, mr.range(0.12, 0.2), mr.range(-6, 3.4), 0.05, SZ + mr.range(3.1, 3.4), 0.03).rotateY(mr.range(0, 3)));
      thing({ clay: [mound], wood: sh, iron: cob }, 0, 0, 0, { id, edge: 'S' });
      wallAA(trench.x0, trench.x1, trench.z0 - 0.15, trench.z1 + 0.15, 'trench');
      wallAA(-6.0, 3.3, SZ + 3.3, SZ + 5.0, 'spoil');
      // the plank bridge across it, chained off
      const bx = -1.2;
      const planks = [W.B(0.34, 0.06, 2.2, bx - 0.2, 0.05, (trench.z0 + trench.z1) / 2, 0.015), W.B(0.34, 0.06, 2.1, bx + 0.18, 0.05, (trench.z0 + trench.z1) / 2 + 0.05, 0.015)];
      const posts = [], ch = [];
      for (const s of [-1, 1]) posts.push(new THREE.CylinderGeometry(0.035, 0.04, 1.0, 10).translate(bx + s * 0.55, 0.5, trench.z0 - 0.35));
      ch.push(W.chain(V3(bx - 0.55, 0.92, trench.z0 - 0.35), V3(bx + 0.55, 0.92, trench.z0 - 0.35), 0.18));
      ch.push(W.chain(V3(bx - 0.55, 0.6, trench.z0 - 0.35), V3(bx + 0.55, 0.6, trench.z0 - 0.35), 0.1));
      thing({ wood: planks, iron: [...posts, ...ch] }, 0, 0, 0, { edge: 'S' });
      wallAA(bx - 0.6, bx + 0.6, trench.z0 - 0.45, trench.z0 - 0.25, 'chain');
    }
    // two sawhorses before it, with lanterns
    sawhorseAt(-3.6, SZ + 0.9, Math.PI / 2);
    sawhorseAt(1.4, SZ + 0.9, Math.PI / 2 + 0.12);
    // the tar boiler, breathing steam
    thing(W.tarBoiler(), 5.6, SZ + 1.6, 0.3);
    wallOB(5.6, SZ + 1.6, 1.1, 0.7, 0.3, 'boiler');
    const boilerSteam = new Steam(stage, [V3(5.6 + 0.4 * Math.cos(0.3), 2.35, SZ + 1.6 - 0.4 * Math.sin(0.3))], 14);
    sawhorseAt(4.9, SZ + 3.4, Math.PI / 2 - 0.1, 2.4, false);
    // the flatbed across the right lanes, its tailboard to the block
    const truckS = { x: 10.2, z: SZ + 3.0, yaw: 1.05 };
    thing(W.flatbed({ load: 'pipes' }), truckS.x, truckS.z, truckS.yaw, { figure: true });
    wallOB(truckS.x, truckS.z, 1.15, 3.35, truckS.yaw, 'truck');
    sawhorseAt(14.6, SZ + 1.2, Math.PI / 2 + 0.2);
    hoardingAB(13.4, SZ + 3.6, EAST_X, SZ + 3.6, 2.4, -1);

    // ================= east: the railing on its plinth, the rail yard ====
    const east = { z0: 36.5, z1: -124.5, gate: [-32.2, -27.8] };
    {
      const X = EAST_X, PH = 0.5, TH = 2.6, bay = 8.8;
      const brick = [], caps = [], rails = [];
      brick.push(W.B(0.46, PH, east.z0 - east.z1, X, PH / 2, (east.z0 + east.z1) / 2, 0.03));
      caps.push(W.B(0.54, 0.08, east.z0 - east.z1, X, PH + 0.04, (east.z0 + east.z1) / 2, 0.02));
      const piers = [];
      for (let z = east.z0; z >= east.z1 - 0.01; z -= bay) piers.push(z);
      piers.push(...east.gate);
      for (const z of piers) {
        const big = east.gate.includes(z);
        const pw = big ? 0.78 : 0.62, ph = big ? TH + 0.6 : TH + 0.25;
        brick.push(W.B(pw, ph, pw, X, ph / 2, z, 0.03));
        caps.push(W.B(pw + 0.12, 0.12, pw + 0.12, X, ph + 0.06, z, 0.03));
        caps.push(lathe([[0, 0], [0.16, 0], [0.12, 0.06], [0.14, 0.16], [0.08, 0.26], [0, 0.3]], 20).translate(X, ph + 0.12, z));
      }
      // the bars: runs between the piers (the gate's leaves are their own)
      const runs = [];
      const cuts = [...new Set(piers)].sort((a, b) => b - a);
      for (let i = 0; i < cuts.length - 1; i++) {
        const a = cuts[i], b = cuts[i + 1];
        if (a === east.gate[1] && b === east.gate[0]) continue;
        runs.push([a - 0.36, b + 0.36]);
      }
      const barH = TH - PH;
      const barGeo = merge([
        new THREE.CylinderGeometry(0.011, 0.011, barH - 0.12, 6).translate(0, (barH - 0.12) / 2, 0),
        lathe([[0.0, 0], [0.018, 0.0], [0.03, 0.05], [0.0, 0.16]], 8).translate(0, barH - 0.14, 0),
      ]);
      const mats = [];
      const barsAlong = (za, zb) => { for (let z = za; z > zb; z -= 0.13) mats.push(new THREE.Matrix4().makeTranslation(X, PH, z)); };
      for (const [a, b] of runs) {
        barsAlong(a, b);
        for (const y of [PH + 0.14, TH - 0.28]) rails.push(W.B(0.05, 0.035, a - b, X, y, (a + b) / 2, 0.01));
      }
      // the gates: two leaves, a heavier frame, a chain and padlock where
      // they meet
      const [g0, g1] = east.gate;
      barsAlong(g1 - 0.42, g0 + 0.42);
      const gm = (g0 + g1) / 2;
      for (const y of [PH + 0.14, PH + 1.0, TH - 0.28]) rails.push(W.B(0.06, 0.05, g1 - g0 - 0.84, X, y, gm, 0.012));
      for (const z of [g0 + 0.44, gm - 0.03, gm + 0.03, g1 - 0.44]) rails.push(W.B(0.06, TH - PH, 0.05, X, PH + (TH - PH) / 2, z, 0.012));
      const chn = [W.chain(V3(X + 0.05, PH + 1.05, gm - 0.18), V3(X + 0.05, PH + 1.05, gm + 0.18), 0.2), W.chain(V3(X - 0.05, PH + 1.05, gm - 0.18), V3(X - 0.05, PH + 1.05, gm + 0.18), 0.2)];
      const lock = W.B(0.05, 0.1, 0.08, X + 0.08, PH + 0.82, gm, 0.02);
      const id = allocInkId();
      thing({ brick, wood: [], iron: [...rails, ...chn, lock], chrome: [] }, 0, 0, 0, { id });
      thing({ brick: caps }, 0, 0, 0, { id: allocInkId() });
      const im = new THREE.InstancedMesh(barGeo, M.iron, mats.length);
      mats.forEach((m, i) => im.setMatrixAt(i, m));
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = true; im.receiveShadow = true;
      im.userData.inkId = id;
      im.userData.inkPerInstance = false;
      im.userData.noRay = true;
      g.add(im);
      // (the bullets hit a thin invisible screen where the bars stand: a
      // round goes through the gaps as often as not, so it is left to the
      // plinth and the piers) - the man is stopped by the whole run
      wallAA(X - 0.23, X + 0.23, east.z1, east.z0, 'fence');
    }
    // the rail yard beyond: flat dark shapes in the mist (skyline ink: no
    // line work, fog alone lightens them with distance)
    const yard = new THREE.Group();
    yard.name = 'railyard';
    g.add(yard);
    {
      const yr = rng.fork(9);
      // (three depths, each a flat tone a little lighter than the one in
      // front: the nearest wagons a dark grey silhouette, not a black wall)
      const tone = (v) => new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(linearFor(v) / EXPOSURE) });
      const depth = [[], [], []];
      let parts = depth[0];
      // two tracks of rails and sleepers
      for (const tx of [30.5, 35.0, 41.0]) for (const s of [-0.72, 0.72]) parts.push(new THREE.BoxGeometry(0.08, 0.12, 170).translate(tx + s, 0.06, -44));
      // boxcars
      const car = (x, z) => {
        const L = yr.range(10.5, 12.5);
        parts.push(W.B(2.9, 3.0, L, x, 2.15, z, 0.12));
        parts.push(W.B(3.1, 0.18, L + 0.2, x, 3.72, z, 0.05));
        parts.push(new THREE.BoxGeometry(2.4, 0.5, L - 1.5).translate(x, 0.75, z));
        for (const bz of [z - L / 2 + 1.6, z + L / 2 - 1.6]) for (const s of [-0.72, 0.72]) for (const d of [-0.9, 0.9]) parts.push(new THREE.CylinderGeometry(0.42, 0.42, 0.12, 16).rotateZ(Math.PI / 2).translate(x + s, 0.42, bz + d));
        // the sliding door's frame
        parts.push(new THREE.BoxGeometry(3.0, 2.3, 0.08).translate(x, 2.0, z + yr.range(-1, 1)));
        return L;
      };
      let z = 22;
      while (z > -110) { const L = car(30.5, z); z -= L + (yr.chance(0.6) ? yr.range(9, 22) : 0.9); }
      parts = depth[1];
      z = -8;
      while (z > -95) { const L = car(35.0, z); z -= L + (yr.chance(0.5) ? yr.range(8, 20) : 0.9); }
      parts = depth[2];
      // a timber stack
      for (let i = 0; i < 5; i++) parts.push(W.B(1.2 * (5 - i), 0.34, 7.5, 44.0, 0.17 + i * 0.34, 8.0, 0.04));
      for (let i = 0; i < 4; i++) parts.push(W.B(4.0 - i * 0.8, 0.3, 6.0, 45.5, 0.15 + i * 0.3, -64, 0.04));
      // the water tower: a tank on four legs, a spout
      const wt = V3(44, 0, -38);
      parts.push(lathe([[0, 0], [2.6, 0], [2.7, 0.2], [2.7, 4.2], [2.9, 4.4], [1.6, 5.4], [0.2, 5.8], [0, 5.8]], 28).translate(wt.x, 9.5, wt.z));
      for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) parts.push(new THREE.CylinderGeometry(0.14, 0.2, 9.8, 8).rotateX(sz * 0.08).rotateZ(-sx * 0.08).translate(wt.x + sx * 1.9, 4.8, wt.z + sz * 1.9));
      parts.push(new THREE.BoxGeometry(3.6, 0.12, 0.12).translate(wt.x, 4.6, wt.z + 1.9));
      parts.push(new THREE.BoxGeometry(0.12, 0.12, 3.6).translate(wt.x + 1.9, 4.6, wt.z));
      parts.push(new THREE.CylinderGeometry(0.16, 0.16, 3.2, 8).rotateZ(Math.PI / 2 - 0.5).translate(wt.x - 3.4, 9.0, wt.z));
      // the signal gantry across the tracks
      const gz = -84;
      for (const x of [27.2, 44.0]) parts.push(new THREE.BoxGeometry(0.35, 7.2, 0.35).translate(x, 3.6, gz));
      parts.push(new THREE.BoxGeometry(17.2, 0.5, 0.4).translate(35.6, 7.0, gz));
      for (const x of [30.5, 35.0, 41.0]) { parts.push(new THREE.BoxGeometry(0.5, 1.4, 0.4).translate(x, 6.1, gz + 0.1)); parts.push(new THREE.BoxGeometry(0.7, 0.08, 0.3).translate(x, 6.9, gz + 0.3)); }
      const yid = allocSkylineId();
      const m = { userData: { inkId: yid } };
      [0.13, 0.17, 0.21].forEach((v, i) => {
        const mm = new THREE.Mesh(merge(depth[i]), tone(v));
        mm.userData.inkId = yid;
        mm.userData.noRay = true;
        yard.add(mm);
      });
      // the gantry's signal lamps: two small points of light
      const sig = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.4, 1.4) });
      const lg = [];
      for (const x of [30.5, 41.0]) lg.push(new THREE.SphereGeometry(0.1, 10, 8).translate(x, 6.3, gz + 0.32));
      const sl = new THREE.Mesh(merge(lg), sig);
      sl.userData.inkId = m.userData.inkId;
      sl.userData.noRay = true;
      yard.add(sl);
    }

    // ================= north: the pipe job under the el's crossing =======
    const NZ = -120.3;
    // (the el's column pairs at z -112 and -124: nothing stands on them)
    thing(W.flatbed({ load: 'pipes' }), -2.7, NZ, -Math.PI / 2, { figure: true });
    wallOB(-2.7, NZ, 1.15, 3.35, -Math.PI / 2, 'truck');
    thing(W.flatbed(), 4.1, NZ, -Math.PI / 2, { figure: true });
    wallOB(4.1, NZ, 1.15, 3.35, -Math.PI / 2, 'truck');
    thing(W.pipeStack(3, 0.42, 2.6), 8.9, NZ + 0.1, Math.PI / 2);
    wallAA(7.5, 10.4, NZ - 1.35, NZ + 1.35, 'pipes');
    thing(W.compressor(), 11.6, NZ - 0.1, 0.25, { figure: true });
    wallOB(11.6, NZ - 0.1, 0.62, 1.3, 0.25, 'works');
    thing(W.pipeStack(2, 0.42, 2.6), 14.2, NZ + 0.2, Math.PI / 2 + 0.08);
    wallAA(12.8, 15.7, NZ - 1.1, NZ + 1.1, 'pipes');
    sawhorseAt(16.6, NZ + 0.6, Math.PI / 2 - 0.15);
    hoardingAB(17.4, NZ - 0.3, EAST_X, NZ - 0.3, 2.2, 1);
    sawhorseAt(STREET.facadeX + 1.35, NZ + 0.6, Math.PI / 2);
    sawhorseAt(STREET.facadeX + 3.6, NZ + 0.7, Math.PI / 2 + 0.1);
    // rubble between the columns beyond, a lantern on it
    {
      const mr = rng.fork(11);
      const chunks = [];
      for (let i = 0; i < 40; i++) {
        const r = mr.range(0.12, 0.45);
        chunks.push(W.B(r * 2, r * mr.range(0.6, 1.2), r * mr.range(1.4, 2.4), mr.range(-3, 3), r * 0.4, mr.range(-1.4, 1.4), 0.05).rotateY(mr.range(0, 3.14)).rotateZ(mr.range(-0.3, 0.3)));
      }
      thing({ clay: chunks }, -0.2, -124.2, 0.2);
      lanternAt(-0.4, 1.1, -123.0);
    }

    // ================= west: the building line and its gaps ============
    {
      const near = stage.part('facade');
      // the near building: its pilasters stand 0.43 m proud (the diner's
      // front has its own colliders)
      const face = STREET.facadeX + 0.43;
      wallAA(face - 1.4, face, -24.0, DINER.pilasters[4] - 0.4, 'wall');
      wallAA(face - 1.4, face, DINER.pilasters[0] + 0.4, 41, 'wall');
      // the diner's room: its back and end walls
      wallAA(DINER.backX - 1, DINER.backX, DINER.zMin - 1, DINER.zMax + 1, 'wall');
      wallAA(DINER.backX, DINER.innerX, DINER.zMin - 1, DINER.zMin, 'wall');
      wallAA(DINER.backX, DINER.innerX, DINER.zMax, DINER.zMax + 1, 'wall');
      // the cross street: 14 m open (the side alley), then a wire gate
      const cz0 = -30, cz1 = -24, gx = STREET.facadeX - 14;
      wallAA(STREET.facadeX - 16.2, STREET.facadeX, cz1, cz1 + 1.2, 'wall');     // the near building's end
      wallAA(STREET.facadeX - 18, STREET.facadeX, cz0 - 1.2, cz0, 'wall');       // the far block's end
      colliders.addRegion(gx - 0.5, STREET.facadeX + 0.5, cz0, cz1, 'crossStreet');
      {
        const id = allocInkId();
        const frame = [], mesh = [];
        const posts = [cz0 + 0.05, cz0 + 2.0, (cz0 + cz1) / 2, cz1 - 2.0, cz1 - 0.05];
        for (const z of posts) frame.push(new THREE.CylinderGeometry(0.045, 0.045, 2.4, 12).translate(gx, 1.2, z));
        for (const y of [0.1, 2.35]) frame.push(new THREE.CylinderGeometry(0.03, 0.03, cz1 - cz0, 10).rotateX(Math.PI / 2).translate(gx, y, (cz0 + cz1) / 2));
        frame.push(new THREE.CylinderGeometry(0.03, 0.03, cz1 - cz0, 10).rotateX(Math.PI / 2).translate(gx, 1.2, (cz0 + cz1) / 2));
        // barbed strands over the top
        for (const [dy, dx] of [[2.55, 0.12], [2.7, 0.22]]) frame.push(tube([V3(gx + dx, dy, cz0), V3(gx + dx, dy - 0.04, (cz0 + cz1) / 2), V3(gx + dx, dy, cz1)], 0.006, 4, 30));
        for (const z of [cz0 + 0.05, cz1 - 0.05]) frame.push(new THREE.CylinderGeometry(0.02, 0.02, 0.45, 8).rotateZ(-0.45).translate(gx + 0.1, 2.55, z));
        frame.push(W.chain(V3(gx + 0.06, 1.25, (cz0 + cz1) / 2 - 0.2), V3(gx + 0.06, 1.25, (cz0 + cz1) / 2 + 0.2), 0.15));
        frame.push(W.B(0.05, 0.1, 0.08, gx + 0.1, 1.05, (cz0 + cz1) / 2, 0.02));
        thing({ iron: frame }, 0, 0, 0, { id, edge: 'W' });
        // the wire: chain-link as a faint scrim (a fine even mesh at this
        // distance reads as a grey veil, not as a grid)
        const c = document.createElement('canvas');
        c.width = 64; c.height = 64;
        const x = c.getContext('2d');
        x.strokeStyle = 'rgba(150,150,150,1)'; x.lineWidth = 7;
        x.beginPath(); x.moveTo(0, 0); x.lineTo(64, 64); x.moveTo(64, 0); x.lineTo(0, 64); x.stroke();
        const t = new THREE.CanvasTexture(c);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set((cz1 - cz0) / 0.09, 2.3 / 0.09);
        const scrim = new THREE.Mesh(new THREE.PlaneGeometry(cz1 - cz0, 2.3).rotateY(Math.PI / 2).translate(gx, 1.2, (cz0 + cz1) / 2),
          new THREE.MeshBasicMaterial({ color: new THREE.Color(0.03, 0.03, 0.03), map: t, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
        scrim.layers.set(LAYER.FX);
        scrim.userData.noRay = true;
        g.add(scrim);
        mesh.length = 0;
        wallAA(gx - 0.1, gx + 0.1, cz0, cz1, 'fence');
        // the van parked behind it, nose to the gate
        thing(W.van(), gx - 4.2, (cz0 + cz1) / 2 + 0.6, Math.PI / 2 + 0.15, { figure: true });
        // the wall lamp of the side alley (CONTRACTS §15): its fixture,
        // unlit until the alley's scene lights it
        const wl = V3(-12.5, 4.2, -24.3);
        const fix = [
          new THREE.CylinderGeometry(0.02, 0.02, 0.55, 10).rotateX(Math.PI / 2).translate(wl.x, wl.y + 0.15, wl.z + 0.27),
          lathe([[0.012, 0.0], [0.05, -0.02], [0.14, -0.1], [0.19, -0.14], [0.185, -0.15]], 24).translate(wl.x, wl.y + 0.1, wl.z),
          W.B(0.14, 0.2, 0.04, wl.x, wl.y + 0.15, -24.02, 0.015),
        ];
        thing({ iron: fix }, 0, 0, 0, { edge: 'W' });
        stage.addAnchor('block.alley.lamp', { pos: wl.clone(), yaw: 0 });
      }
      // the far row past the cross street: walls, and every gap closed
      const blocks = (near.farBlocks || []).filter((b) => b.x1 === STREET.facadeX && b.z0 <= -30 && b.z1 > -140).sort((a, b) => b.z0 - a.z0);
      let prev = -30;
      let k = 0;
      for (const b of blocks) {
        if (prev - b.z0 > 0.05) {
          // a gap: a board fence, or a locked service gate with bins
          const za = prev, zb = b.z0;
          if (k++ % 2 === 0 || prev - b.z0 < 2) hoardingAB(STREET.facadeX - 0.3, za, STREET.facadeX - 0.3, zb, 2.6, 1);
          else {
            const id = allocInkId();
            const gp = [];
            for (const z of [za - 0.1, zb + 0.1]) gp.push(W.B(0.3, 3.0, 0.3, STREET.facadeX - 0.4, 1.5, z, 0.03));
            for (let z = za - 0.35; z > zb + 0.3; z -= 0.14) gp.push(new THREE.CylinderGeometry(0.014, 0.014, 2.6, 6).translate(STREET.facadeX - 0.4, 1.3, z));
            for (const y of [0.2, 1.3, 2.5]) gp.push(W.B(0.05, 0.06, za - zb - 0.5, STREET.facadeX - 0.4, y, (za + zb) / 2, 0.01));
            gp.push(W.chain(V3(STREET.facadeX - 0.32, 1.3, (za + zb) / 2 - 0.2), V3(STREET.facadeX - 0.32, 1.3, (za + zb) / 2 + 0.2), 0.15));
            thing({ iron: gp }, 0, 0, 0, { id, edge: 'W' });
            wallAA(STREET.facadeX - 0.55, STREET.facadeX - 0.25, zb, za, 'gate');
            // bins inside the gate
            for (const dz of [0.8, 1.6]) {
              const bin = lathe([[0, 0.02], [0.25, 0.02], [0.27, 0.1], [0.28, 0.85], [0.3, 0.9], [0.25, 0.95], [0, 0.97]], 24);
              thing({ iron: [bin] }, STREET.facadeX - 1.2, za - dz, 0);
            }
          }
        }
        wallAA(STREET.facadeX - 1.0, STREET.facadeX, Math.max(b.z1, -140), b.z0, 'wall');
        prev = b.z1;
      }
    }

    // ================= the outer net: beyond everything ================
    colliders.addRegion(-40, EAST_X + 2, NORTH_Z - 14, SOUTH_Z + 12, 'net');
    flush();

    const api = {
      group: g, lanterns, steam: boilerSteam, yard,
      // Walk out from 40 points inside the block in 72 directions each, a
      // man's circle (0.3 m) stepping 0.1 m, until something stops him:
      // a collider (its tag) or the outer net ('bounds'). No stop may be
      // 'bounds'. -> { stops: [{ from, dir, at, tag }], byTag, net }
      perimeterTest({ r = 0.3, step = 0.1, far = 260 } = {}) {
        const C = colliders;
        const pts = [];
        const pr = stage.rng.fork(1501);
        while (pts.length < 40) {
          const x = pr.range(-9.3, 21.4), z = pr.range(-117, 29.5);
          if (!hitAt(x, z, r)) pts.push([x, z]);
        }
        pts[0] = [-14, -27];      // one in the cross street
        const stops = [], byTag = {};
        for (const [x0, z0] of pts) {
          for (let k = 0; k < 72; k++) {
            const a = k / 72 * Math.PI * 2, dx = Math.sin(a), dz = Math.cos(a);
            let tag = null, d = 0;
            for (; d < far && !tag; d += step) tag = hitAt(x0 + dx * d, z0 + dz * d, r);
            tag = tag || 'none';
            byTag[tag] = (byTag[tag] || 0) + 1;
            stops.push({ from: [x0, z0], dir: k, at: [+(x0 + dx * d).toFixed(2), +(z0 + dz * d).toFixed(2)], tag });
          }
        }
        return { stops, byTag, net: stops.filter((s) => s.tag === 'bounds' || s.tag === 'none') };
        // the first thing a circle at (x, z) overlaps: a collider's tag, or
        // 'bounds' outside the net (the bounds and regions)
        function hitAt(x, z, rr) {
          for (const c of C.circles) { const ddx = x - c.x, ddz = z - c.z; if (ddx * ddx + ddz * ddz < (c.r + rr) ** 2) return c.tag || 'circle'; }
          for (const b of C.boxes) {
            const ddx = x - b.cx, ddz = z - b.cz;
            const lx = ddx * b.c - ddz * b.s, lz = ddx * b.s + ddz * b.c;
            const qx = Math.max(0, Math.abs(lx) - b.hx), qz = Math.max(0, Math.abs(lz) - b.hz);
            if (qx * qx + qz * qz < rr * rr) return b.tag || 'box';
          }
          const inside = (R) => x > R.minX + rr && x < R.maxX - rr && z > R.minZ + rr && z < R.maxZ - rr;
          if (inside(C.bounds) || C.regions.some(inside)) return null;
          return 'bounds';
        }
      },
    };
    void roundedBox; void markFigure; void tagInk; void makeConeMesh; void LAYER;
    return api;
  },

  // the lanterns' registry entries count only near the eye (see lanternAt)
  update(api, dt, t, camera) {
    const e = camera.position;
    for (const L of api.lanterns) L.lamp.entry.enabled = Math.hypot(L.pos.x - e.x, L.pos.z - e.z) < 6;
  },
};

import * as THREE from 'three';
import { LAYER } from '../../../render/layers.js';
import { PIER } from '../site.js';
import { makeKit, worldUV } from '../kit.js';
import { mergeGeos, lathe } from '../../../props/lib.js';

// The mezzanine (lane B6): a plank floor on iron posts along the back wall,
// 3.8 m up; the office on it (the Cardinal's: a lit room behind a window
// with blinds, a door with a glass panel); the catwalk in front of the
// office with its railing; the two iron stairs in front of the edge (the
// west pair from the floor by the stairs lamp, the east pair down into the
// bay).
// Two floors over one plan: the walking surface and the railings belong to
// the level the eye is on (api.up), set as I come off either stairs:
//   down  the floor at 0, the stairs' sides are walls, under the mezzanine
//         is walkable (its posts stand in it)
//   up    the mezzanine's floor at 3.8, its railings and the office's walls
// A figure up there takes its own surface (c.fig.surface = api.upSurface).
//   api.up, api.upSurface, api.stairsAt(x, z) -> y | undefined, api.office
//   { lamp, window: { x0, x1, y0, y1, z }, slats, glow }, anchors
//   pier9.office.window (outside it, on the catwalk: where I crouch to listen),
//   pier9.office.desk / .window.in (inside), pier9.stairs.W.foot / .top, E ...
const V = (x, y, z) => new THREE.Vector3(x, y, z);

export default {
  name: 'mezz', order: 60, tick: 60,
  build(stage) {
    const g = new THREE.Group();
    g.name = 'pier9_mezz';
    stage.scene.add(g);
    const kit = makeKit(stage, g);
    const { M } = kit;
    const Z = PIER.mezz, O = PIER.office, SW = PIER.stairs.W, SE = PIER.stairs.E;
    const Y = Z.y;
    const C = stage.colliders;
    // the landings at the stairs' tops, forward of the edge
    const landW = { x0: Z.x0, x1: SW.top, z0: Z.z1, z1: SW.z + SW.w / 2 };
    const landE = { x0: SE.top - 1.8, x1: SE.top, z0: Z.z1, z1: SE.z + SE.w / 2 };

    // ---- the floor: planks on joists, the posts under it
    kit.piece();
    const fl = [];
    fl.push(worldUV(kit.box(Z.x0, Z.x1, Y - Z.t, Y, Z.z0 + 0.25, Z.z1), 1));
    for (const L of [landW, landE]) fl.push(worldUV(kit.box(L.x0, L.x1, Y - Z.t, Y, L.z0, L.z1), 1));
    kit.addMerged(fl, M.floor, { cast: true });
    kit.piece();
    const iron = [];
    // the fascia beam along the edge, the joists under, the posts
    iron.push(kit.box(Z.x0, Z.x1, Y - Z.t - 0.35, Y - Z.t, Z.z1 - 0.12, Z.z1));
    for (let x = Z.x0 + 0.2; x < Z.x1; x += 1.6) iron.push(kit.box(x - 0.05, x + 0.05, Y - Z.t - 0.25, Y - Z.t, Z.z0 + 0.25, Z.z1));
    const posts = [];
    for (let x = Z.x0 + 0.3; x <= Z.x1 - 0.2; x += 4.1) posts.push(x);
    for (const x of posts) {
      iron.push(new THREE.BoxGeometry(0.2, Y - Z.t, 0.2).translate(x, (Y - Z.t) / 2, Z.z1 - 0.15));
    }
    kit.addMerged(iron, M.iron, { cast: true });

    // ---- the railings (the catwalk's edge, the mezzanine's ends, the landings)
    kit.piece();
    const rail = [];
    const railRun = (a, b) => {
      const d = b.clone().sub(a), L = d.length(), n = Math.max(1, Math.round(L / 1.2));
      for (let i = 0; i <= n; i++) { const p = a.clone().addScaledVector(d, i / n); rail.push(new THREE.CylinderGeometry(0.025, 0.025, 1.05, 8).translate(p.x, Y + 0.525, p.z)); }
      const mid = a.clone().add(b).multiplyScalar(0.5);
      for (const hh of [1.05, 0.55]) {
        const r = new THREE.CylinderGeometry(0.028, 0.028, L, 8).rotateZ(Math.PI / 2);
        r.rotateY(-Math.atan2(d.z, d.x));
        r.translate(mid.x, Y + hh, mid.z);
        rail.push(r);
      }
    };
    const railsUp = [];
    const railC = (x0, z0, x1, z1) => { railRun(V(x0, 0, z0), V(x1, 0, z1)); railsUp.push({ cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, hx: Math.abs(x1 - x0) / 2 + 0.06, hz: Math.abs(z1 - z0) / 2 + 0.06 }); };
    railC(landW.x1, Z.z1, landE.x0, Z.z1);          // the catwalk's edge
    railC(landE.x1, Z.z1, Z.x1, Z.z1);              // over the east stairs
    railC(Z.x1, Z.z0 + 0.3, Z.x1, Z.z1);            // the east end
    railC(Z.x0, Z.z0 + 0.3, Z.x0, landW.z1);        // the west end
    railC(landW.x0, landW.z1, landW.x1, landW.z1);  // the west landing's front
    railC(landE.x0, landE.z1, landE.x1, landE.z1);  // the east landing's front
    railC(landE.x0, Z.z1, landE.x0, landE.z1);      // the east landing's west side
    kit.addMerged(rail, M.iron, { cast: true });

    // ---- the stairs: two stringers, open treads, a handrail each side
    const stairs = (x0, x1, zc, w) => {
      kit.piece();
      const parts = [];
      // (x0 is the foot, x1 the top)
      const lo = Math.min(x0, x1), hi = Math.max(x0, x1);
      const n = 20, run = hi - lo;
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n;
        const x = x0 + (x1 - x0) * u, y = Y * (i + 1) / n;
        parts.push(kit.box(x - run / n / 2 - 0.02, x + run / n / 2 + 0.02, y - 0.05, y, zc - w / 2 + 0.05, zc + w / 2 - 0.05));
      }
      for (const s of [-1, 1]) {
        const a = V(x0, 0, zc + s * w / 2), b = V(x1, Y, zc + s * w / 2), d = b.clone().sub(a), L = d.length();
        const m =new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(V(1, 0, 0), d.clone().normalize()));
        const sg = new THREE.BoxGeometry(L, 0.28, 0.06).applyMatrix4(m).translate((a.x + b.x) / 2, (a.y + b.y) / 2 - 0.1, a.z);
        parts.push(sg);
        const hr = new THREE.CylinderGeometry(0.025, 0.025, L, 8).rotateZ(Math.PI / 2).applyMatrix4(m).translate((a.x + b.x) / 2, (a.y + b.y) / 2 + 0.95, a.z);
        parts.push(hr);
        for (let k = 0; k <= 4; k++) { const p = a.clone().addScaledVector(d, k / 4); parts.push(new THREE.CylinderGeometry(0.022, 0.022, 0.95, 6).translate(p.x, p.y + 0.48, p.z)); }
      }
      kit.addMerged(parts, M.iron, { cast: true });
      // (the stairs' sides hold me on them, and keep me out from below)
      for (const s of [-1, 1]) C.addBox((lo + hi) / 2, zc + s * (w / 2 + 0.05), run / 2, 0.06, 0, 'stairs');
    };
    stairs(SW.foot, SW.top, SW.z, SW.w);
    stairs(SE.foot, SE.top, SE.z, SE.w);
    const stairsAt = (x, z) => {
      for (const S of [SW, SE]) {
        if (Math.abs(z - S.z) > S.w / 2 + 0.05) continue;
        const lo = Math.min(S.foot, S.top), hi = Math.max(S.foot, S.top);
        if (x < lo - 0.02 || x > hi + 0.02) continue;
        const u = (x - S.foot) / (S.top - S.foot);
        return Math.max(0, Math.min(1, u)) * Y;
      }
      return undefined;
    };

    // ---- the office: its walls, its window with the blinds, its door, the
    // lit room behind (the back wall bright: whoever stands in there is a
    // black shape against it)
    kit.piece();
    const wallsO = [];
    const oy0 = Y, oy1 = Y + O.h, W = O.win, D = O.door;
    const fz = O.z1, t = 0.12;
    // front wall round the window and the door
    wallsO.push(kit.box(O.x0, W.x0, oy0, oy1, fz - t, fz));
    wallsO.push(kit.box(W.x0, W.x1, oy0, oy0 + W.y0, fz - t, fz));
    wallsO.push(kit.box(W.x0, W.x1, oy0 + W.y1, oy1, fz - t, fz));
    wallsO.push(kit.box(W.x1, D.x0, oy0, oy1, fz - t, fz));
    wallsO.push(kit.box(D.x0, D.x1, oy0 + 2.15, oy1, fz - t, fz));
    wallsO.push(kit.box(D.x1, O.x1, oy0, oy1, fz - t, fz));
    // the sides and the roof
    wallsO.push(kit.box(O.x0 - t, O.x0, oy0, oy1, O.z0 + 0.25, fz));
    wallsO.push(kit.box(O.x1, O.x1 + t, oy0, oy1, O.z0 + 0.25, fz));
    wallsO.push(kit.box(O.x0 - t, O.x1 + t, oy1, oy1 + 0.1, O.z0 + 0.25, fz));
    kit.addMerged(wallsO.map((q) => worldUV(q, 1.6)), M.wall, { cast: true });
    // inside: dark walls, the back wall lit round where the lamp hangs
    kit.piece();
    kit.add(kit.box(O.x0, O.x1, oy1 - 0.01, oy1, O.z0 + 0.25, fz - t), M.officeWall, { cast: false });
    kit.piece();
    const backGlow = new THREE.PlaneGeometry(O.x1 - O.x0, O.h, 24, 12).translate((O.x0 + O.x1) / 2, oy0 + O.h / 2, O.z0 + 0.27);
    // (a gradient: brightest behind the window's middle, at a standing
    // man's head - the Cardinal at the window is a black shape on it -
    // falling to the corners)
    const col = new Float32Array(backGlow.getAttribute('position').count * 3);
    const BP = backGlow.getAttribute('position');
    for (let i = 0; i < BP.count; i++) { const dx = BP.getX(i) + 0.8, dy = BP.getY(i) - (oy0 + 1.5); const v = Math.max(0.05, 1 - Math.hypot(dx / 4.4, dy / 2.4)); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = Math.pow(v, 1.4); }
    backGlow.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const glowMat = M.glow('officeBack', 1.3, { vertexColors: true });
    const back = kit.add(backGlow, glowMat, { cast: false, noRay: true });
    back.name = 'officeBack';
    // the desk, a chair, a cabinet, a coat stand, the desk lamp
    kit.piece();
    const furn = [
      kit.box(-1.2, 1.3, oy0 + 0.74, oy0 + 0.79, -44.3, -43.4),
      kit.box(-1.15, -0.8, oy0, oy0 + 0.74, -44.25, -43.45), kit.box(0.95, 1.25, oy0, oy0 + 0.74, -44.25, -43.45),
      kit.box(2.2, 2.9, oy0, oy0 + 1.35, -44.7, -44.1),
      kit.box(-2.8, -2.3, oy0, oy0 + 0.46, -43.9, -43.4), kit.box(-2.8, -2.72, oy0 + 0.46, oy0 + 1.05, -43.9, -43.4),
    ];
    kit.addMerged(furn, M.crateDark, { cast: true });
    kit.piece();
    const lampG = mergeGeos([lathe([[0.001, 0.0], [0.08, 0.0], [0.07, 0.02], [0.012, 0.03], [0.012, 0.38], [0.02, 0.4]], 16).translate(0.8, oy0 + 0.79, -44.0),
      lathe([[0.02, 0.0], [0.07, -0.04], [0.14, -0.12], [0.13, -0.13]].reverse(), 20).translate(0.8, oy0 + 1.22, -44.0)]);
    kit.add(lampG, M.shade, { cast: false });
    // the office's own lamp: over the desk, its pool on the desk, light
    // behind whoever stands between it and the window
    const deskBulb = kit.add(new THREE.SphereGeometry(0.05, 12, 8).translate(0.8, oy0 + 1.14, -44.0), M.bulb, { cast: false, noRay: true });
    const oLamp = stage.lamps.addCustom({ head: V(0.2, oy1 - 0.3, -43.9), axis: V(0, -1, -0.3), height: 2.6, half: 0.7, real: true, bulb: deskBulb, fadeEnd: 0.8, edgeSoft: 0.6, strength: 0.5, tag: 'office' });
    if (oLamp.light) { oLamp.light.intensity = 40; oLamp.light.distance = 7; }
    oLamp.entry.range = 3.0;

    // the window: its frame, the blinds (slats tilted to show the room in
    // strips), the light through them on the catwalk's boards
    kit.piece();
    const fr = [];
    const wx0 = W.x0, wx1 = W.x1, wy0 = oy0 + W.y0, wy1 = oy0 + W.y1;
    fr.push(kit.box(wx0 - 0.05, wx1 + 0.05, wy0 - 0.06, wy0, fz - 0.16, fz + 0.04), kit.box(wx0 - 0.05, wx1 + 0.05, wy1, wy1 + 0.05, fz - 0.16, fz + 0.03));
    fr.push(kit.box(wx0 - 0.05, wx0, wy0, wy1, fz - 0.16, fz + 0.03), kit.box(wx1, wx1 + 0.05, wy0, wy1, fz - 0.16, fz + 0.03), kit.box((wx0 + wx1) / 2 - 0.025, (wx0 + wx1) / 2 + 0.025, wy0, wy1, fz - 0.1, fz + 0.02));
    kit.addMerged(fr, M.iron, { cast: false });
    kit.piece();
    const slatsG = [];
    const n = 15, sp = (wy1 - wy0 - 0.08) / n;
    for (let i = 0; i < n; i++) {
      const s = new THREE.BoxGeometry(wx1 - wx0 - 0.04, 0.004, 0.05).rotateX(0.55).translate((wx0 + wx1) / 2, wy1 - 0.06 - i * sp, fz - 0.12);
      slatsG.push(s);
    }
    slatsG.push(kit.box(wx0, wx1, wy1 - 0.06, wy1, fz - 0.15, fz - 0.09));
    const slats = kit.add(mergeGeos(slatsG), M.blind, { cast: true, noRay: true });
    slats.name = 'blinds';
    // the door: dark planks, a lit glass panel in its top half
    kit.piece();
    const dg = [kit.box(D.x0 + 0.02, D.x1 - 0.02, oy0, oy0 + 2.13, fz - 0.07, fz - 0.03)];
    const doorM = kit.add(mergeGeos(dg), M.plankDoor, { cast: true });
    kit.piece();
    const pane = kit.add(new THREE.PlaneGeometry(D.x1 - D.x0 - 0.24, 0.7).translate((D.x0 + D.x1) / 2, oy0 + 1.55, fz - 0.025), M.glow('officePane', 0.5), { cast: false, noRay: true });
    // the light through the blinds on the catwalk: bars on the boards
    const barsMat = new THREE.ShaderMaterial({
      name: 'PierBlindLight', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      // (uOpen: the blinds raised - the scene's listen beat - the bars
      // nearest the wall run together into a slab, brighter)
      uniforms: { uGain: { value: 0.16 }, uOpen: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform float uGain, uOpen; varying vec2 vUv;
        void main(){
          float bars = smoothstep( 0.35, 0.5, abs( fract( vUv.y * 9.0 ) - 0.5 ) * 2.0 );
          bars = mix( bars, 1.0, uOpen * ( 1.0 - smoothstep( 0.25, 0.55, vUv.y ) ) );
          float fall = ( 1.0 - smoothstep( 0.0, 1.0, vUv.y ) ) * ( 1.0 - smoothstep( 0.35, 0.5, abs( vUv.x - 0.5 ) ) );
          gl_FragColor = vec4( vec3( bars * fall * uGain * ( 1.0 + 1.6 * uOpen ) ), 1.0 );
        }`,
    });
    const barsQ = new THREE.Mesh(new THREE.PlaneGeometry(wx1 - wx0 + 0.6, 1.4).rotateX(-Math.PI / 2).translate((wx0 + wx1) / 2, Y + 0.004, fz + 0.7), barsMat);
    barsQ.layers.set(LAYER.FX); barsQ.userData.noRay = true; barsQ.renderOrder = 2;
    g.add(barsQ);

    // ---- the level: surfaces, and the walls that belong to it
    const api = { group: g, up: false, stairsAt, landW, landE, posts, slats, door: doorM, pane, barsQ, back };
    const onUp = (x, z) => (x > Z.x0 && x < Z.x1 && z > Z.z0 && z < Z.z1) || (x > landW.x0 && x < landW.x1 && z >= Z.z1 - 0.01 && z < landW.z1) || (x > landE.x0 && x < landE.x1 && z >= Z.z1 - 0.01 && z < landE.z1);
    api.onUp = onUp;
    api.upSurface = (x, z) => { const s = stairsAt(x, z); return s !== undefined ? s : onUp(x, z) ? Y : 0; };
    stage.addSurface((x, z) => {
      const s = stairsAt(x, z);
      if (s !== undefined) return s;
      if (api.up && onUp(x, z)) return Y;
      return undefined;
    });
    // (up: the railings and the office's walls; down: the posts under it)
    const upBoxes = railsUp.map((r) => ({ cx: r.cx, cz: r.cz, hx: r.hx, hz: r.hz, angle: 0, c: 1, s: 0, tag: 'rail' }));
    const ob = (x0, x1, z0, z1) => upBoxes.push({ cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, hx: (x1 - x0) / 2, hz: (z1 - z0) / 2, angle: 0, c: 1, s: 0, tag: 'office' });
    ob(O.x0 - 0.12, D.x0, fz - 0.14, fz + 0.02); ob(D.x1, O.x1 + 0.12, fz - 0.14, fz + 0.02); ob(D.x0, D.x1, fz - 0.14, fz + 0.02);
    ob(O.x0 - 0.14, O.x0, O.z0, fz); ob(O.x1, O.x1 + 0.14, O.z0, fz);
    // (the level's own back wall up there: the shed's is a wall at both levels)
    const downCircles = posts.map((x) => ({ x, z: Z.z1 - 0.15, r: 0.16, tag: 'post' }));
    // (and the stores stacked under it, parts/stacks.js)
    const downBoxes = C.boxes.filter((b) => b.tag === 'stores');
    api.setUp = (up) => {
      if (up === api.up && api._set) return;
      api._set = true;
      api.up = up;
      for (const b of upBoxes) { const i = C.boxes.indexOf(b); if (up && i < 0) C.boxes.push(b); if (!up && i >= 0) C.boxes.splice(i, 1); }
      for (const c of downCircles) { const i = C.circles.indexOf(c); if (!up && i < 0) C.circles.push(c); if (up && i >= 0) C.circles.splice(i, 1); }
      for (const b of downBoxes) { const i = C.boxes.indexOf(b); if (!up && i < 0) C.boxes.push(b); if (up && i >= 0) C.boxes.splice(i, 1); }
    };
    api.setUp(false);

    // ---- the anchors
    const A = (name, x, y, z, yaw, extra = {}) => stage.addAnchor('pier9.' + name, { pos: V(x, y, z), yaw, ...extra });
    A('office.window', (wx0 + wx1) / 2, Y, fz + 0.55, 0);
    A('office.window.in', (wx0 + wx1) / 2, Y, fz - 0.45, Math.PI);
    A('office.desk', 0.1, Y, -44.5, Math.PI);
    // (the men in the office stand back from its front: a figure keeps me off
    // him in plan whatever the height, and the way under the office runs
    // below its front)
    A('office.side', -2.45, Y, -44.35, -Math.PI / 2 + 0.5);
    A('office.cab', 2.1, Y, -43.4, Math.PI / 2);
    A('stairs.W.foot', SW.foot + 0.7, 0, SW.z, Math.PI / 2);
    A('stairs.W.top', landW.x0 + 1.0, Y, SW.z - 0.3, -Math.PI / 2);
    A('stairs.E.top', landE.x0 + 0.9, Y, SE.z - 0.3, Math.PI / 2);
    A('stairs.E.foot', SE.foot + 0.6, 0, SE.z, -Math.PI / 2);
    return api;
  },
  // the level follows the eye as it comes off the stairs
  update(api, dt, t, camera) {
    const p = camera.position;
    const s = api.stairsAt(p.x, p.z);
    if (s !== undefined) api.setUp(s > 1.9);
  },
};

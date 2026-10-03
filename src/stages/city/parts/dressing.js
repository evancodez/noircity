import * as THREE from 'three';
import { allocInkId, LAYER, tagInk } from '../../../render/layers.js';
import { merge, lathe, V3 } from '../../../world/geom.js';
import { Steam } from '../../../fx/Steam.js';
import { fenceGeo, FENCE } from '../../riverroad/smashKinds.js';
import { glowTexture } from '../../../vehicles/models.js';
import { PELL, SPECIAL, ALLEY_W, NS, EW, NS_LIST, EW_LIST, blockAt, PAVE, riverPoint, riverSAtZ, RIVER } from '../plan.js';

// The city's dressing (lane C3): Pell Lane's board fence along its east
// pavement where the cars stand (the backlot's, so the cut into the seat is
// not felt) and the brick wall north of it, the dead end's wall at its end,
// the coal yard's heaps behind its fence, the market square's and the wharf
// market's strings of bare bulbs on their wires, steam out of the street
// grates.
export default {
  name: 'dressing', order: 78,
  build(stage) {
    const { scene, M } = stage;
    const group = new THREE.Group();
    group.name = 'dressing';
    scene.add(group);
    const rng = stage.rng.fork(781);
    const add = (geo, mat, { noRay = false, figure = false, id = allocInkId() } = {}) => {
      const m = new THREE.Mesh(geo, mat);
      m.userData.inkId = id; m.receiveShadow = true; m.castShadow = !noRay;
      if (noRay) m.userData.noRay = true;
      if (figure) m.userData.inkFigure = true;
      group.add(m);
      return m;
    };
    const box = (x0, x1, y0, y1, z0, z1) => new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    const wood = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.85, envMap: M.envSoft, envMapIntensity: 0.2 });
    // ---- Pell Lane: the board fence (z 12 .. 42 on the east pavement's line)
    // and its brick wall from there north to Harbor St
    {
      const fx = PELL.x + PELL.hw + PELL.pe + 0.08;
      const parts = [];
      const fg = fenceGeo();
      // [C6] (a gap where the backlot's market gate is - backlot z -97.6 .. -96, city 23.4 .. 25: the panel over it left out, the gate's leaf open inside)
      for (let z = 12 + FENCE.w / 2; z < 42; z += FENCE.w) { if (Math.abs(z - 24.65) < 0.1) continue; parts.push(fg.clone().rotateY(Math.PI / 2).translate(fx, PAVE, z)); }
      parts.push(new THREE.BoxGeometry(0.05, 2.0, 1.5).translate(fx + 0.85, PAVE + 1.0, 23.5 + 0.75).rotateY(0));
      // (the yard's south fence, back to the block)
      for (let x = fx + FENCE.w / 2; x < fx + 14; x += FENCE.w) parts.push(fg.clone().translate(x, PAVE, 41.85));
      add(merge(parts), wood);
      add(box(fx - 0.08, fx + 0.3, 0, 3.4, -12, 12), M.brickFar);
      add(box(fx - 0.12, fx + 0.34, 3.4, 3.6, -12, 12), M.brickFar);
    }
    // ---- the dead end's wall, and a lamp-less dark at its foot
    {
      const D = SPECIAL['0,1'].deadEnd;
      add(box(D.x0 - 1, D.x0, 0, 5.2, D.z - ALLEY_W / 2, D.z + ALLEY_W / 2), M.brickFar);
    }
    // ---- the coal yard's heaps (behind its board fence)
    {
      const Y = blockAt(3, 4), parts = [];
      for (let k = 0; k < 5; k++) {
        const x = Y.x0 + 6 + k * ((Y.x1 - Y.x0) / 2 - 8) / 4, z = Y.z0 + rng.range(10, Y.z1 - Y.z0 - 10);
        parts.push(new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(rng.range(4, 7), rng.range(2, 3.4), rng.range(4, 8)).translate(x, 0, z));
      }
      add(merge(parts), M.black, { id: allocInkId() });
    }
    // ---- strings of bare bulbs on wires over the market square and the
    // wharf market (the stalls' light: a sag of white points, their glow)
    {
      const wires = [], bulbs = [], glows = [];
      const string = (a, b, sag = 0.7, n = 14) => {
        const pts = [];
        for (let i = 0; i <= 24; i++) { const u = i / 24; pts.push(V3(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u - Math.sin(u * Math.PI) * sag, a.z + (b.z - a.z) * u)); }
        wires.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.012, 3));
        for (let k = 1; k < n; k++) { const u = k / n, p = V3(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u - Math.sin(u * Math.PI) * sag - 0.08, a.z + (b.z - a.z) * u); bulbs.push(new THREE.SphereGeometry(0.06, 6, 4).translate(p.x, p.y, p.z)); if (k % 3 === 1) glows.push(p); }
      };
      const sq = blockAt(1, 1);
      const poles = [];
      for (const z of [sq.z0 + 9, (sq.z0 + sq.z1) / 2, sq.z1 - 9]) {
        string(V3(sq.x0 + 2, 4.2, z + 1.4), V3(sq.x1 - 2, 4.2, z + 1.4), 0.9, 20);
        for (const x of [sq.x0 + 2, sq.x1 - 2]) poles.push(new THREE.CylinderGeometry(0.06, 0.08, 4.3, 6).translate(x, 2.15, z + 1.4));
      }
      for (const zz of [-160, -130]) {
        const s0 = riverSAtZ(zz), s1 = riverSAtZ(zz + 26);
        const a = riverPoint(s0, RIVER.hw + RIVER.pw + 0.4, 3.9), b = riverPoint(s1, RIVER.hw + RIVER.pw + 0.4, 3.9);
        string(a, b, 0.6, 14);
        poles.push(new THREE.CylinderGeometry(0.06, 0.08, 4, 6).translate(a.x, 2, a.z), new THREE.CylinderGeometry(0.06, 0.08, 4, 6).translate(b.x, 2, b.z));
      }
      add(merge(wires.concat(poles)), M.lampIron, { noRay: true });
      add(merge(bulbs), new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(6) }), { noRay: true });
      const gm = new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color().setScalar(0.5), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
      // [2nd owner] (a bulb's glow keeps about its size on the screen as the
      // car passes under the string: at 1.3 m fixed, the nearest one swelled
      // into a white disc a fifth of the frame wide)
      const near = (sp) => (renderer, scene, cam) => { const k = Math.min(1.3, Math.max(0.18, sp.position.distanceTo(cam.position) * 0.085)); if (Math.abs(k - sp.scale.x) > 0.01) { sp.scale.setScalar(k); sp.updateMatrixWorld(); } };
      for (const p of glows) { const sp = new THREE.Sprite(gm); sp.position.copy(p); sp.scale.setScalar(1.3); sp.layers.set(LAYER.FX_REFL); sp.renderOrder = 6; sp.userData.noRay = true; sp.onBeforeRender = near(sp); group.add(sp); }
      // (the square's light on the stalls: three of the lamps' hanging kind)
      const L = stage.part('lamps');
      if (L) for (const z of [sq.z0 + 16, sq.z1 - 16]) L.addHanging(V3((sq.x0 + sq.x1) / 2, 6.3, z), { real: true });
    }
    // ---- steam out of the street grates (a grate's dark disc, its column)
    {
      const vents = [];
      const at = [[NS.avenue.x + 4.5, EW.market.z + 30], [NS.cooper.x - 1.5, EW.harbor.z - 40], [NS.baxter.x + 1.2, EW.canal.z + 44], [NS.water.x - 1.2, EW.clock.z + 36], [NS.avenue.x - 5.2, EW.clock.z + 40], [-150, EW.harbor.z + 4.5], [20, EW.market.z - 2.5], [-60, EW.fifth.z + 2]];
      const grates = [];
      for (const [x, z] of at) { vents.push(V3(x, 0, z)); grates.push(new THREE.CircleGeometry(0.42, 20).rotateX(-Math.PI / 2).translate(x, 0.012, z)); }
      add(merge(grates), M.black, { noRay: true });
      new Steam(stage, vents, 26);
    }
    void NS_LIST; void EW_LIST; void lathe; void tagInk;
    return { group };
  },
};

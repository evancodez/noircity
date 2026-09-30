import * as THREE from 'three';
import { PIER } from '../site.js';
import { makeKit, paint } from '../kit.js';
import { slab } from '../../../props/lib.js';
import { buildProp } from '../../../props/index.js';

// The loading bay (lane B6; the ring of the second fist fight, lane R2-E):
// the clear floor in its pool of light, walled in on every side by real
// things (the second fight's rules keep us inside them: an invisible wall
// is a thing a man can be knocked into and nothing there - never): the east
// wall with its two plank loading doors over the river, the east stairs'
// side to the north, a stack of crates two high and a lower crate and a
// barrel to the west (the block of stacks behind them), three crates and a
// barrel to the south with the gap by the east wall to the bay's side door.
// What lies in reach round the ring's edge (props, each a thing a hand can
// take): a crate lid leaning on the stack, two bottles on the low crate, a
// cargo hook on a barrel, a coil of chain on a crate, a lantern hanging lit
// on a nail on a post by the stairs. The stack's top crate comes down when
// a man is driven into it; the post shakes its lantern (it swings, and the
// second time it falls and burns on the floor).
//   api.reach [{ name, kind, object, home }]   api.stacks [{ name, pos, r, top?, bottom }]
//   api.post { pos, r }   api.lantern { pivot, prop, lamp, on, swing(v), drop() }
//   api.jacketAt   where his jacket goes (the crate by the door)
//   api.reset()    everything back where it stood (a beat's setup)
//   anchors pier9.bay.centre (r 2.4), pier9.bay.finish.1 / .2 (inside each
//   loading door, facing out over the water), pier9.bay.door, pier9.bay.out,
//   pier9.bay.reach.<name>
const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const RING = { x0: 10.0, x1: 14.72, z0: -39.35, z1: -29.98 };

export default {
  name: 'bay', order: 80,
  build(stage) {
    const g = new THREE.Group();
    g.name = 'pier9_bay';
    stage.scene.add(g);
    const kit = makeKit(stage, g);
    const { M } = kit;
    const B = PIER.bay, C = stage.colliders;
    const S = PIER.shed;

    // ---- barrels: at the ring's west edge, its south-west corner, by the stairs
    kit.piece();
    const barrelGeo = new THREE.LatheGeometry([[0.001, 0], [0.27, 0], [0.3, 0.1], [0.32, 0.44], [0.3, 0.8], [0.27, 0.88], [0.001, 0.88]].map(([r, y]) => new THREE.Vector2(r, y)), 22);
    const barrels = [];
    const barrel = (name, x, z) => {
      kit.piece();
      const m = kit.add(barrelGeo.clone(), M.crateDark, { cast: true, name: 'bay_' + name });
      m.position.set(x, 0, z);
      const col = C.addCircle(x, z, 0.34, 'barrels');
      const b = { name, object: m, pos: V(x, 0, z), r: 0.34, col, top: V(x, 0.88, z), home: { p: m.position.clone(), q: m.quaternion.clone() } };
      barrels.push(b);
      return b;
    };
    const bW = barrel('west', 9.45, -35.55);
    const bSW = barrel('sw', 9.5, -31.1);
    barrel('sw2', 9.95, -30.45);
    barrel('stairs', 10.1, -42.6);
    const bS = barrel('south', 12.62, -29.34);

    // ---- crates: each its own (a stack's top one can come down)
    const crates = [];
    const crateGeo = (w, h, d) => { const c = slab(w, h, d, { bevel: 0.03, corner: 0.03, seg: 1, curve: 2 }); c.deleteAttribute('uv'); return c; };
    const crate = (name, x, z, w, h, d, v = 0.14, on = null, yaw = 0) => {
      kit.piece();
      const geo = crateGeo(w, h, d);
      paint(geo, v);
      const m = kit.add(geo, M.crate, { cast: true, name: 'bay_' + name });
      const y = on ? on.top.y : 0;
      m.position.set(x, y, z);
      m.rotation.y = yaw;
      // (only the bottom one of a stack holds the floor: one on top rides it)
      const col = on ? null : C.addBox(x, z, w / 2, d / 2, yaw, 'crates');
      const c = { name, object: m, pos: V(x, y, z), w, h, d, col, on, top: V(x, y + h, z), r: Math.max(w, d) / 2, home: { p: m.position.clone(), q: m.quaternion.clone() } };
      crates.push(c);
      return c;
    };
    // the stack at the ring's north-west corner: two high (the top one comes
    // down on a man driven into it)
    const cW1 = crate('stack1', 9.5, -38.45, 1.1, 0.95, 1.1, 0.13);
    const cW1t = crate('stack1top', 9.52, -38.43, 0.96, 0.82, 0.96, 0.17, cW1, 0.08);
    // the low crate on the west side, bottles on it
    const cW2 = crate('low', 9.42, -37.05, 0.9, 0.78, 0.9, 0.16);
    // south: two crates and the barrel, the gap to the door by the east wall
    const cS1 = crate('south1', 10.55, -29.42, 1.0, 0.96, 1.0, 0.12);
    const cS1t = crate('south1top', 10.5, -29.4, 0.86, 0.74, 0.86, 0.16, cS1, -0.06);
    const cS2 = crate('south2', 11.62, -29.46, 0.9, 0.86, 0.9, 0.15);
    // under the mezzanine, by the far wall (as the lane had them)
    crate('far1', 9.5, -41.5, 1.1, 0.9, 1.1, 0.16);
    crate('far2', 14.3, -43.4, 1.0, 1.0, 1.0, 0.12);
    // the stacks a man is driven into (what: 'crates' for the rules)
    const stacks = [
      { name: 'stack1', pos: cW1.pos, r: 0.62, box: cW1, top: cW1t },
      { name: 'low', pos: cW2.pos, r: 0.5, box: cW2, top: null },
      { name: 'south1', pos: cS1.pos, r: 0.55, box: cS1, top: cS1t },
      { name: 'south2', pos: cS2.pos, r: 0.5, box: cS2, top: null },
    ];

    // ---- the post against the east wall between the loading doors, a
    // lantern on a nail on it (lit): its beam low across the ring
    kit.piece();
    const postAt = V(14.56, 0, -35.2);
    const postGeo = new THREE.BoxGeometry(0.22, PIER.trussY, 0.22).translate(postAt.x, PIER.trussY / 2, postAt.z);
    kit.add(postGeo, M.timber, { cast: true, name: 'bay_post' });
    C.addBox(postAt.x, postAt.z, 0.13, 0.13, 0, 'column');
    // the nail on its ring side (west), the lantern hanging by its bail
    const nail = V(postAt.x - 0.14, 1.98, postAt.z + 0.02);
    const pivot = new THREE.Group();
    pivot.position.copy(nail);
    g.add(pivot);
    const lanternProp = buildProp('lantern');
    // (hanging by its bail: the bail's top at the nail; the lens toward the
    // ring, south-west)
    lanternProp.position.set(0, -0.34, 0);
    lanternProp.rotation.y = -1.75;
    pivot.add(lanternProp);
    lanternProp.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    const post = { pos: postAt.clone(), r: 0.16, nail: nail.clone() };

    // ---- the things in reach (props)
    const reach = [];
    const put = (name, kind, pos, { variant = null, yaw = 0, tilt = null, roll = null } = {}) => {
      const o = buildProp(kind, { variant });
      o.position.copy(pos);
      o.rotation.set(tilt || 0, yaw, roll || 0, 'YXZ');
      g.add(o);
      const r = { name, kind, object: o, home: { p: o.position.clone(), q: o.quaternion.clone(), parent: g } };
      reach.push(r);
      stage.addAnchor('pier9.bay.reach.' + name, { pos: pos.clone(), yaw });
      return r;
    };
    // the lid, leaning on the stack's east face
    put('lid', 'crateLid', V(10.14, 0.02, -38.5), { variant: 'small', yaw: Math.PI / 2, tilt: -1.28 });
    put('bottle1', 'bottle', cW2.top.clone().add(V(0.14, 0, 0.18)), { variant: 'rye' });
    put('bottle2', 'bottle', cW2.top.clone().add(V(-0.1, 0, -0.16)), { variant: 'beer' });
    put('hook', 'cargoHook', bSW.top.clone(), { yaw: 0.6 });
    put('chain', 'chainCoil', cS2.top.clone());
    // the lantern on its nail is a thing in reach too
    const lanternItem = { name: 'lantern', kind: 'lantern', object: lanternProp, home: { p: lanternProp.position.clone(), q: lanternProp.quaternion.clone(), parent: pivot } };
    reach.push(lanternItem);
    stage.addAnchor('pier9.bay.reach.lantern', { pos: nail.clone().add(V(0, -0.2, 0)), yaw: 0 });
    put('rope', 'rope', V(11.2, 0.0, -43.6));

    // the lantern's light: a bull's-eye's beam low across the ring
    const L = stage.lamps;
    const lamp = L.torch('baylantern', { half: 0.5, range: 7.5, strength: 0.7 });
    lamp.on = true;
    const lantern = {
      pivot, prop: lanternProp, lamp, lit: true, hung: true,
      sw: { a: 0, b: 0, va: 0, vb: 0 }, knocks: 0,
      // a knock on its post (m/s at the nail)
      swing(vx, vz) { lantern.sw.va += vx * 2.2; lantern.sw.vb += vz * 2.2; },
    };
    const lens = new THREE.Vector3(), beam = new THREE.Vector3();
    lantern.step = (dt) => {
      const W = lantern.sw;
      if (lantern.hung) {
        // (a pendulum on its bail, 0.34 m: damped)
        const w2 = 9.8 / 0.34;
        W.va += (-w2 * W.a - 1.1 * W.va) * dt; W.vb += (-w2 * W.b - 1.1 * W.vb) * dt;
        W.a = Math.max(-0.9, Math.min(0.9, W.a + W.va * dt)); W.b = Math.max(-0.9, Math.min(0.9, W.b + W.vb * dt));
        pivot.rotation.set(W.b, 0, -W.a);
        pivot.updateMatrixWorld(true);
      }
      const on = lantern.lit && lanternProp.parent === pivot;
      lamp.on = on;
      if (on) {
        lanternProp.updateMatrixWorld(true);
        lanternProp.localToWorld(lens.set(0, 0.1, 0.11));
        beam.set(0, -0.62, 1).applyQuaternion(lanternProp.getWorldQuaternion(_q)).normalize();
        lamp.aim(lens, beam);
      }
    };
    const _q = new THREE.Quaternion();

    // ---- the anchors
    const A = (name, x, y, z, yaw, extra = {}) => stage.addAnchor('pier9.' + name, { pos: V(x, y, z), yaw, ...extra });
    A('bay.centre', B.centre.x, 0, B.centre.z, -Math.PI / 2, { r: B.r });
    // (inside each loading door, his back to it: yaw a viewer's, looking +x)
    PIER.loading.forEach((l, i) => A('bay.finish.' + (i + 1), S.x1 - 0.5, 0, l.z, -Math.PI / 2, { w: PIER.loadingW }));
    A('bay.door', S.x1 - 0.8, 0, PIER.bayDoor.z, -Math.PI / 2);
    A('bay.out', PIER.apron.x0 + 1.8, 0, PIER.bayDoor.z + 0.4, 0);
    // (he steps out of the dark in the corner by the door)
    A('bay.foreman', 14.25, 0, -30.35, Math.PI);

    // his jacket goes over the crate by the door (the barrel there)
    const jacketAt = bS.top.clone();

    // everything back where it stood
    const reset = () => {
      for (const r of reach) {
        const o = r.object;
        if (o.parent !== r.home.parent) { if (o.parent) o.parent.remove(o); r.home.parent.add(o); }
        o.position.copy(r.home.p); o.quaternion.copy(r.home.q); o.scale.setScalar(1);
        o.visible = true;
        o.traverse((m) => { if (m.isMesh) m.visible = true; });
        delete r.gone;
      }
      for (const c of crates) {
        const o = c.object;
        if (o.parent !== g) { if (o.parent) o.parent.remove(o); g.add(o); }
        o.position.copy(c.home.p); o.quaternion.copy(c.home.q); o.visible = true;
        c.down = false;
      }
      for (const b of barrels) { b.object.position.copy(b.home.p); b.object.quaternion.copy(b.home.q); }
      lantern.sw.a = lantern.sw.b = lantern.sw.va = lantern.sw.vb = 0;
      lantern.lit = true; lantern.hung = true; lantern.knocks = 0;
      pivot.rotation.set(0, 0, 0);
      g.updateMatrixWorld(true);
    };
    return { group: g, reach, crates, barrels, stacks, post, lantern, jacketAt, reset, ring: RING };
  },
  update(api, dt) { api.lantern.step(dt); },
};

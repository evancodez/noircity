import * as THREE from 'three';
import { PIER } from '../site.js';
import { makeKit, paint } from '../kit.js';
import { slab, mergeGeos } from '../../../props/lib.js';
import { buildProp } from '../../../props/index.js';

// The loading bay (lane B6): the clear floor in its pool of light (the ring
// of the second fist fight, staged here after this lane merges), the two
// plank loading doors over the river three metres apart (a man can be put
// through them), and what lies in reach round the ring's edge: a crate lid,
// bottles, a cargo hook, a coil of chain, a lantern (props, each a thing a
// hand can take: api.reach). Barrels and a coil of rope by the wall.
//   anchors pier9.bay.centre (r 2.4), pier9.bay.finish.1 / .2 (inside each
//   loading door, facing out over the water), pier9.bay.door (the side door),
//   pier9.bay.reach.<kind> (each thing in reach)
const V = (x, y, z) => new THREE.Vector3(x, y, z);

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

    // ---- barrels and crates at the ring's edge (none on its clear floor)
    kit.piece();
    const barrels = [];
    const barrel = (x, z) => {
      const b = new THREE.LatheGeometry([[0.001, 0], [0.27, 0], [0.3, 0.1], [0.32, 0.44], [0.3, 0.8], [0.27, 0.88], [0.001, 0.88]].map(([r, y]) => new THREE.Vector2(r, y)), 22).translate(x, 0, z);
      barrels.push(b);
      C.addCircle(x, z, 0.34, 'barrels');
      return V(x, 0.88, z);
    };
    const bTop1 = barrel(9.35, -31.2);
    barrel(9.95, -31.05);
    const bTop2 = barrel(14.3, -39.3);
    kit.addMerged(barrels, M.crateDark, { cast: true });
    kit.piece();
    const cr = [];
    const crate = (x, z, w, h, d, v = 0.14, y = 0) => { const c = slab(w, h, d, { bevel: 0.03, corner: 0.03, seg: 1, curve: 2 }); c.deleteAttribute('uv'); c.translate(x, y, z); paint(c, v); cr.push(c); C.addBox(x, z, w / 2, d / 2, 0, 'crates'); return V(x, y + h, z); };
    const cTop1 = crate(9.5, -39.4, 1.1, 0.9, 1.1, 0.13);
    crate(9.5, -41.5, 1.1, 0.9, 1.1, 0.16);
    const cTop2 = crate(14.35, -31.6, 1.0, 1.0, 1.0, 0.12);
    kit.addMerged(cr, M.crate, { cast: true });

    // ---- the things in reach (props)
    const reach = [];
    const put = (kind, pos, { variant = null, yaw = 0, tilt = null } = {}) => {
      const o = buildProp(kind, { variant });
      o.position.copy(pos);
      o.rotation.y = yaw;
      if (tilt) o.rotation.x = tilt;
      g.add(o);
      o.userData.home = { p: o.position.clone(), r: o.rotation.clone() };
      reach.push({ kind, object: o });
      stage.addAnchor('pier9.bay.reach.' + kind + (reach.filter((r) => r.kind === kind).length > 1 ? reach.filter((r) => r.kind === kind).length : ''), { pos: pos.clone(), yaw });
      return o;
    };
    // the lid leaning on the crate by the east stairs
    put('crateLid', V(9.0, 0.0, -38.6), { yaw: Math.PI / 2, tilt: -1.25 });
    put('bottle', cTop1.clone().add(V(0.2, 0, 0.15)), { variant: 'rye' });
    put('bottle', cTop1.clone().add(V(-0.15, 0, -0.1)), { variant: 'beer' });
    put('cargoHook', bTop1.clone().add(V(0, 0, 0)), { yaw: 0.6 });
    put('chainCoil', V(13.9, 0.0, -32.9));
    put('lantern', bTop2.clone(), { variant: 'off', yaw: -0.8 });
    put('rope', V(14.2, 0.0, -41.6));

    // ---- the anchors
    const A = (name, x, y, z, yaw, extra = {}) => stage.addAnchor('pier9.' + name, { pos: V(x, y, z), yaw, ...extra });
    A('bay.centre', B.centre.x, 0, B.centre.z, -Math.PI / 2, { r: B.r });
    // (inside each loading door, facing out over the river: yaw a viewer's,
    // looking +x)
    PIER.loading.forEach((l, i) => A('bay.finish.' + (i + 1), S.x1 - 0.35, 0, l.z, -Math.PI / 2, { w: PIER.loadingW }));
    A('bay.door', S.x1 - 0.8, 0, PIER.bayDoor.z, -Math.PI / 2);
    A('bay.out', PIER.apron.x0 + 1.8, 0, PIER.bayDoor.z + 0.4, 0);
    void mergeGeos; void cTop2;
    return { group: g, reach };
  },
};

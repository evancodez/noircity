import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { allocInkId } from '../../render/layers.js';
import { boxWorldUV, merge } from '../../world/geom.js';

// The backlot's builder's kit (lane B4): things are added to buckets, one
// per (group, material); a group is one ink id (the contours separate one
// group from the next); at the end each bucket is one merged mesh. Textured
// buckets (world-UV brick and stone) keep their UVs.
//   kit.add(group, mat, geo, { figure, cast, noRay })
//   kit.box(group, mat, x0, x1, y0, y1, z0, z1)   a world-UV box
//   kit.flush() -> meshes (added to the stage's scene)
//   kit.collide(x0, x1, z0, z1, tag)              an axis-aligned collider
export class Kit {
  constructor(stage, parent = null) {
    this.stage = stage;
    this.parent = parent || stage.scene;
    this.buckets = new Map();
    this.ids = new Map();
    this.meshes = [];
  }

  id(group) {
    if (!this.ids.has(group)) this.ids.set(group, allocInkId());
    return this.ids.get(group);
  }

  add(group, mat, geo, { figure = false, cast = true, receive = true, noRay = false } = {}) {
    const key = group + '|' + mat.uuid + (figure ? '|F' : '') + (noRay ? '|N' : '') + (cast ? '' : '|C');
    let B = this.buckets.get(key);
    if (!B) this.buckets.set(key, B = { group, mat, figure, cast, receive, noRay, geos: [], uv: !!mat.map });
    B.geos.push(geo);
    return geo;
  }

  box(group, mat, x0, x1, y0, y1, z0, z1, uvScale = 1 / 6, opts = {}) {
    const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    return this.add(group, mat, mat.map ? boxWorldUV(g, uvScale) : g, opts);
  }

  collide(x0, x1, z0, z1, tag = 'wall') {
    return this.stage.colliders.addBox((x0 + x1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0) / 2, Math.abs(z1 - z0) / 2, 0, tag);
  }

  flush() {
    for (const B of this.buckets.values()) {
      let geo;
      if (B.uv) {
        const list = B.geos.map((g) => {
          const n = g.index ? g.toNonIndexed() : g;
          for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') n.deleteAttribute(k);
          return n;
        });
        geo = mergeGeometries(list, false);
      } else geo = merge(B.geos);
      const m = new THREE.Mesh(geo, B.mat);
      m.castShadow = B.cast; m.receiveShadow = B.receive;
      m.userData.inkId = this.id(B.group);
      if (B.figure) m.userData.inkFigure = true;
      if (B.noRay) m.userData.noRay = true;
      m.name = 'backlot_' + B.group;
      this.parent.add(m);
      this.meshes.push(m);
    }
    this.buckets.clear();
    return this.meshes;
  }
}

// a wall panel in the plane x = const (or z = const) with rectangular holes
// cut out: boxes round the holes. axis 'x': the panel spans z0..z1, y0..y1
// at x0..x1 (its thickness); holes [[za, zb, ya, yb]]. axis 'z' likewise.
export function holeyPanel(kit, group, mat, axis, t0, t1, a0, a1, y0, y1, holes) {
  const cuts = [...holes].sort((p, q) => p[0] - q[0]);
  const put = (a, b, ya, yb) => {
    if (b - a < 1e-3 || yb - ya < 1e-3) return;
    if (axis === 'x') kit.box(group, mat, t0, t1, ya, yb, a, b);
    else kit.box(group, mat, a, b, ya, yb, t0, t1);
  };
  let a = a0;
  for (const [ha, hb, hy0, hy1] of cuts) {
    put(a, ha, y0, y1);          // the full-height strip before the hole
    put(ha, hb, y0, hy0);        // under it
    put(ha, hb, hy1, y1);        // over it
    a = hb;
  }
  put(a, a1, y0, y1);
}

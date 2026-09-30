import * as THREE from 'three';
import { PIER } from '../site.js';
import { makeKit, paint } from '../kit.js';
import { slab } from '../../../props/lib.js';
import { buildProp } from '../../../props/index.js';

// The crate stacks (lane B6): the blocks between the aisles, each a grid of
// stacks one to three crates high, a few crates long, the odd one set askew,
// a tarpaulin over some; gaps in their edges a man can stand in, in the
// dark. Every stack is a collider tagged 'crates' (cover for the Hoods'
// kind of fight, walls for everyone's eyes: they are solids, so they cut
// line of sight and the lamps' light).
//   api.stacks [{ x0, x1, z0, z1, h }]   api.topAt(x, z) -> the height there
const CRATE = 1.25;

export default {
  name: 'stacks', order: 40,
  build(stage) {
    const g = new THREE.Group();
    g.name = 'pier9_stacks';
    stage.scene.add(g);
    const kit = makeKit(stage, g);
    const { M } = kit;
    const rng = stage.rng.fork(9101);
    // one bevelled slab per size, cloned
    const cache = new Map();
    const crateGeo = (w, h, d) => {
      const k = `${w.toFixed(2)}_${h.toFixed(2)}_${d.toFixed(2)}`;
      if (!cache.has(k)) {
        const s = slab(w, h, d, { bevel: 0.035, corner: 0.04, seg: 1, curve: 2 });
        s.deleteAttribute('uv');
        cache.set(k, s);
      }
      return cache.get(k).clone();
    };
    const stacks = [];
    const C = stage.colliders;
    let b = 0;
    for (const [x0, x1, z0, z1, tiers, full] of PIER.blocks) {
      kit.piece();
      const geos = [], battens = [];
      const nx = Math.max(1, Math.round((x1 - x0) / CRATE)), nz = Math.max(1, Math.round((z1 - z0) / CRATE));
      const cw = (x1 - x0) / nx, cd = (z1 - z0) / nz;
      for (let i = 0; i < nx; i++) {
        for (let j = 0; j < nz; j++) {
          const edge = i === 0 || j === 0 || i === nx - 1 || j === nz - 1;
          // (a notch in an edge now and then: a dark place to stand)
          const cx0 = x0 + (i + 0.5) * cw, cz0 = z0 + (j + 0.5) * cd;
          const notched = PIER.notches.some(([nx0, nz0]) => Math.abs(nx0 - cx0) < 0.45 && Math.abs(nz0 - cz0) < 0.45);
          if (edge && nx > 1 && nz > 2 && (rng.next() < 0.1 || notched)) continue;
          const n = full ? tiers : Math.max(1, Math.min(tiers, Math.round(tiers * (0.55 + 0.6 * rng.next()))));
          const cx = x0 + (i + 0.5) * cw, cz = z0 + (j + 0.5) * cd;
          let y = 0;
          for (let k = 0; k < n; k++) {
            const w = cw - 0.08 - rng.next() * 0.12, d = cd - 0.08 - rng.next() * 0.12, h = 1.0 + rng.next() * 0.3;
            const cr = crateGeo(w, h, d);
            cr.rotateY((rng.next() - 0.5) * (k === n - 1 ? 0.14 : 0.05));
            cr.translate(cx + (rng.next() - 0.5) * 0.08, y, cz + (rng.next() - 0.5) * 0.08);
            paint(cr, 0.1 + rng.next() * 0.1);
            geos.push(cr);
            // the slats' battens on the long faces of the lower crates
            if (k < 2 && rng.next() < 0.7) {
              for (const s of [-1, 1]) battens.push(new THREE.BoxGeometry(0.07, h * 0.86, d * 0.9).translate(cx + s * (w / 2 + 0.01), y + h / 2, cz));
            }
            y += h;
          }
          stacks.push({ x0: cx - cw / 2, x1: cx + cw / 2, z0: cz - cd / 2, z1: cz + cd / 2, h: y });
          // (the stores under the mezzanine: walls down there only, the
          // mezzanine's level takes them off when I am up on it)
          C.addBox(cx, cz, cw / 2 - 0.02, cd / 2 - 0.02, 0, full ? 'stores' : 'crates');
        }
      }
      kit.addMerged(geos, M.crate, { cast: true });
      if (battens.length) kit.addMerged(battens, M.crateDark, { cast: false });
      // a tarpaulin thrown over one block in three
      if (b % 3 === 1) {
        kit.piece();
        const tw = (x1 - x0) * 0.6, td = Math.min(4, (z1 - z0) * 0.5), tx = x0 + (x1 - x0) * 0.35, tz = z0 + (z1 - z0) * 0.6;
        const top = Math.max(...stacks.filter((s) => s.x0 < tx + tw / 2 && s.x1 > tx - tw / 2 && s.z0 < tz + td / 2 && s.z1 > tz - td / 2).map((s) => s.h), 1);
        const tarp = new THREE.PlaneGeometry(tw + 0.8, td + 0.8, 18, 12).rotateX(-Math.PI / 2);
        const P = tarp.getAttribute('position');
        for (let i = 0; i < P.count; i++) {
          const px = P.getX(i), pz = P.getZ(i);
          const ex = Math.max(0, Math.abs(px) - tw / 2) / 0.4, ez = Math.max(0, Math.abs(pz) - td / 2) / 0.4;
          const drop = Math.min(1, Math.max(ex, ez)) * 1.1 + 0.04 * Math.sin(px * 3.1 + pz * 2.3);
          P.setY(i, top + 0.03 - drop);
        }
        tarp.computeVertexNormals();
        tarp.translate(tx, 0, tz);
        const tm = kit.add(tarp, M.canvas, { cast: true });
        tm.material.side = THREE.DoubleSide;
      }
      b++;
    }
    // the low crates the bottles stand on, at the aisles' edges
    kit.piece();
    const lows = [];
    const lowTops = PIER.bottles.map(([x, z]) => {
      const h = 0.78;
      const c = crateGeo(0.62, h, 0.62);
      c.rotateY(0.3 * Math.sin(x * 3.1 + z));
      c.translate(x, 0, z);
      paint(c, 0.15);
      lows.push(c);
      C.addBox(x, z, 0.3, 0.3, 0, 'crates');
      return new THREE.Vector3(x, h, z);
    });
    kit.addMerged(lows, M.crate, { cast: true });
    // a bottle on the i-th low crate (the scene's: it takes it and throws it)
    const bottleAt = (i, variant = 'beer') => {
      const o = buildProp('bottle', { variant });
      const top = lowTops[i];
      o.position.set(top.x + 0.1 * Math.sin(i * 2.3), top.y, top.z + 0.1 * Math.cos(i * 1.7));
      o.rotation.y = i * 1.3;
      g.add(o);
      return o;
    };
    const topAt = (x, z) => { for (const s of stacks) if (x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1) return s.h; return 0; };
    return { group: g, stacks, topAt, lowTops, bottleAt };
  },
};

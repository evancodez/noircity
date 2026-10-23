import * as THREE from 'three';
import { Smash, rimMaterial } from '../../../destruct/Smash.js';
import { propPieces } from '../../../city/kits/dress.js';
import { KIND_OF, KINDS } from '../../../destruct/smashKinds.js';
import { lotWindows } from '../../../city/kits/facade.js';
import { SURF } from '../../../util/RayWorld.js';

// [O6] The city's destruction set (lane O6, docs/seams/SMASH.md): the
// furniture the generator placed (cityGen's C.props, C.lamps) registered
// with the set - drawn merged in the near chunks as O1 built them (stream.js
// records each one's ranges), out of the merge the moment something meets
// it. fx/React.js asks this part about every round (`hit`: a merged mesh is
// 'merged', an item's own box is the item) and steps it (`update`); Car.js
// meets it through the track (track.smash, the posts' give).
//   stage.props: { smash, hit(prop, hit, dir, { weak }), update(dt, t), nearGrate: null }
//   stage.smash: the Smash (register, hit, blast, mend, ...)
export default {
  name: 'props', order: 80,
  build(stage) {
    const M = stage.M, city = stage.part('city'), C = city.C;
    const mats = {
      iron: M.lampIron, kerb: M.kerb, tree: M.tower, wood: M.wood,
      cloth: new THREE.MeshStandardMaterial({ color: 0x262626, roughness: 0.9, side: THREE.DoubleSide }),
      // (a stall's goods: pale enough to read spilled across a dark road)
      fruit: new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.32, envMap: M.env, envMapIntensity: 0.5, emissive: 0x2e2e2e }),
      // (papers and a stall's canvas carry a little light of their own: in the
      // dark a newsstand's papers in the air were nothing - the critic's
      // blocker 1; under a lamp they print paper white)
      paper: new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.9, side: THREE.DoubleSide, emissive: 0x6a6a6a }),
      canvas: new THREE.MeshStandardMaterial({ color: 0xbdbdbd, roughness: 0.9, side: THREE.DoubleSide, emissive: 0x4a4a4a }),
      // (broken glass: its bright edges and a sheen catching the lamps)
      shard: new THREE.MeshStandardMaterial({ color: 0x505050, roughness: 0.12, metalness: 0.55, envMap: M.env, envMapIntensity: 1.8, side: THREE.DoubleSide }),
    };
    // (ink ids from the city's own block: nothing taken from the shared counter, so the city's frames keep theirs)
    const { base, n } = city.ids;
    const idOf = (k) => { let h = 7; for (const ch of String(k)) h = (h * 31 + ch.charCodeAt(0)) | 0; return base + ((h % n) + n) % n; };
    const smash = new Smash(stage, { mats, idOf });
    stage.smash = smash;
    // the generator's furniture and its lamp posts (the el's hung lamps are the el's)
    for (const p of C.props) { const k = KIND_OF[p.kind]; if (k) smash.register(p, k, { merged: true }); }
    for (const l of C.lamps) if (l.kind !== 'wall') smash.register(l, 'lamp', { merged: true });
    // [O1b] the streets' new things (C.dress: one record each, drawn merged by
    // parts/dressing.js with its ranges): a kind of the set by its own name
    for (const r of C.dress || []) if (KINDS[r.kind]) smash.register(r, r.kind, { merged: true });
    // [O1c] after the critic (B2): a thing of O1b's dressing knocked out of its merge is drawn
    // by the set's pool - in the kerb's (or the wood's) near-black, with no floor of light: a
    // bin over in a lamp's pool went ink on ink, as if the jab had made it vanish. Its pool
    // takes the dressing's own props material (dressing.js: the same floor of light) with the
    // set's paper rim, and its kind's grey - the mean of its pieces' levels, as the merge drew
    // it standing. (O1's generator kinds - KIND_OF - stand in the pool's own material already.)
    const o1Kinds = new Set(Object.values(KIND_OF));
    const dressKinds = new Set((C.dress || []).filter((r) => KINDS[r.kind] && !KINDS[r.kind].part && !o1Kinds.has(r.kind)).map((r) => r.kind));
    if (dressKinds.size) {
      const propsLike = rimMaterial(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0, envMap: M.envSoft, envMapIntensity: 0.25, emissive: 0x262626 }), 0.05, false);
      for (const kind of dressKinds) {
        const P = smash.pools[kind];
        if (!P) continue;
        let sum = 0, n = 0;
        for (const v of [0.15, 0.5, 0.85]) for (const [g, c] of propPieces({ kind, v, x: 0, z: 0, yaw: 0 })) {
          const k = g.getAttribute('position').count, l = Array.isArray(c) ? 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] : c;
          sum += l * k; n += k; g.dispose();
        }
        const col = new THREE.Color().setScalar(n ? sum / n : 0.05);
        P.im.material = propsLike;
        for (let i = 0; i < P.cap; i++) P.im.setColorAt(i, col);
        P.im.instanceColor.needsUpdate = true;
        P.im.userData.tint0 = col;
        P.tone = +col.r.toFixed(3);
      }
    }
    // the lamps' mouths in the far tiles (always drawn): their colour ranges
    const far = stage.part('far');
    if (far) for (const t of far.tiles) smash.chunkIn('far:' + t.key, t.meshes);
    // the shop fronts (glazed when a round or a car meets one: Smash.setShops)
    // - a round into a wall of the far masses is asked about them ('facade')
    const shops = [];
    for (const L of C.lots) for (const w of lotWindows(L)) if (w.kind === 'shop') shops.push(w);
    smash.setShops(shops);
    if (far) for (const t of far.tiles) for (const m of t.meshes) if (!m.userData.noRay && !m.userData.prop) m.userData.prop = 'facade';
    // [O6b] the el's hung lamps (the lamps part's, no post): items of the set
    // with a box in the bullets' world at the head - a round there puts one out
    const L = stage.part('lamps'), solids = [];
    if (L) {
      const box = new THREE.BoxGeometry(0.7, 0.6, 0.7), mat = new THREE.MeshBasicMaterial({ visible: false });
      for (const l of L.all) {
        if (!l.hanging) continue;
        l.src = l;
        const it = smash.register(l, 'hanglamp', { y: l.head.y - 0.2 });
        it.lamp = l; l.head0 = l.head.clone();
        const m = new THREE.Mesh(box, mat);
        m.visible = false; m.position.copy(l.head).add(new THREE.Vector3(0, 0.15, 0)); m.userData.lamp = l; m.userData.surf = SURF.IRON;
        m.updateMatrixWorld(true);
        stage.scene.add(m); solids.push(m);   // (into the bullets' world at the first step: it is not made yet)
      }
    }
    // (the lamps' own answer to a round in a head: O1's stage.lamps.hit gave null)
    if (L) L.hit = (lamp, hit, dir) => {
      const it = lamp && lamp.src ? smash.byRec.get(lamp.src) : null;
      if (!it || it.dark || it.state !== 'stand' || !hit || hit.point.distanceTo(lamp.head) > 0.8) return null;
      smash.shootLamp(it, dir);
      return 'done';
    };
    return {
      smash,
      nearGrate: null,
      hit: (prop, hit, dir, opts = {}) => smash.bullet(prop, hit, dir, !!opts.weak),
      update: (dt, t) => { if (solids.length) { for (const m of solids) stage.addSolid(m); solids.length = 0; } smash.update(dt, t); },
    };
  },
};

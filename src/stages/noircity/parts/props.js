import * as THREE from 'three';
import { Smash } from '../../../destruct/Smash.js';
import { KIND_OF } from '../../../destruct/smashKinds.js';

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
      fruit: new THREE.MeshStandardMaterial({ color: 0x2c2c2c, roughness: 0.32, envMap: M.env, envMapIntensity: 0.5 }),
      paper: new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 0.9, side: THREE.DoubleSide }),
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
    // the lamps' mouths in the far tiles (always drawn): their colour ranges
    const far = stage.part('far');
    if (far) for (const t of far.tiles) smash.chunkIn('far:' + t.key, t.meshes);
    // (the lamps' own answer to a round in a head: O1's stage.lamps.hit gave null)
    const L = stage.part('lamps');
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
      update: (dt, t) => smash.update(dt, t),
    };
  },
};

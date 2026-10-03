// What the eye can see in the city (lane C3; scene 3's sight.js idea, the
// block's dinerInSight): a block, an el station, a lamp's cone is drawn only
// when some line from the eye to it misses the other blocks' walls (in
// plan, cheap: the track's grid) - in a street of five- and six-storey
// buildings, the street ahead, the cross streets at the junctions and the
// open ground past them are what the windscreen sees. Every 0.12 s, or at
// once when the eye jumps.
//   sets block.seen (buildings), station.seen (el), lamp.seen (lamps)
//   ?nosight=1 turns it off (everything in range drawn)
const EVERY = 0.12;

export default {
  name: 'sight', order: 190, tick: 15,
  build(stage) {
    const off = typeof location !== 'undefined' && /[?&]nosight=1/.test(location.search);
    const B = stage.part('buildings'), E = stage.part('el'), L = stage.part('lamps'), T = stage.part('track');
    // each block's sample points: its kerb's corners and the middles of its
    // sides, a metre out into the street
    for (const blk of B.blocks) {
      const b = blk.b, x0 = b.kx0 - 1, x1 = b.kx1 + 1, z0 = b.kz0 - 1, z1 = b.kz1 + 1;
      const xm = (x0 + x1) / 2, zm = (z0 + z1) / 2;
      blk.samples = [[x0, z0], [x1, z0], [x0, z1], [x1, z1], [xm, z0], [xm, z1], [x0, zm], [x1, zm], [(x0 + xm) / 2, z0], [(xm + x1) / 2, z0], [(x0 + xm) / 2, z1], [(xm + x1) / 2, z1], [x0, (z0 + zm) / 2], [x0, (zm + z1) / 2], [x1, (z0 + zm) / 2], [x1, (zm + z1) / 2]];
    }
    const tags = ['wall'];
    const sees = (ex, ez, x, z) => !T.blocked(ex, ez, x, z, tags);
    let t = 9, lx = 1e9, lz = 1e9;
    const api = {
      off,
      update(dt, camera) {
        if (off) return;
        t += dt;
        const e = camera.position;
        const jumped = Math.hypot(e.x - lx, e.z - lz) > 6;
        if (t < EVERY && !jumped) return;
        t = 0; lx = e.x; lz = e.z;
        for (const blk of B.blocks) {
          if (!blk.meshes.length) continue;
          const d = Math.hypot(blk.mid.x - e.x, blk.mid.z - e.z);
          if (d > 340) { blk.seen = false; continue; }
          // (the nearest samples first: the usual answer comes at once)
          let seen = false;
          const S = blk.samples.slice().sort((a, b) => ((a[0] - e.x) ** 2 + (a[1] - e.z) ** 2) - ((b[0] - e.x) ** 2 + (b[1] - e.z) ** 2));
          for (const [x, z] of S) if (sees(e.x, e.z, x, z)) { seen = true; break; }
          blk.seen = seen;
        }
        for (const s of E.stations) {
          const d = Math.hypot(s.mid.x - e.x, s.mid.z - e.z);
          s.seen = d < 60 || (d < 320 && sees(e.x, e.z, s.mid.x, s.mid.z));
        }
        for (const l of L.lamps) {
          const d = Math.hypot(l.head.x - e.x, l.head.z - e.z);
          l.seen = d < 25 || (d < 180 && sees(e.x, e.z, l.head.x, l.head.z));
        }
      },
    };
    return api;
  },
  update: (s, dt, t, camera) => s.update(dt, camera),
};

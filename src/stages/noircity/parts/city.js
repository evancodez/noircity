import { getCity } from '../../../world/cityGen.js';
import { GridColliders } from '../../../world/GridColliders.js';
import { allocInkId } from '../../../render/layers.js';
import { buildGraph } from '../../../world/graph.js';

// The city's data (first of the parts): the generated city (lots, kerbs,
// walls, lamps, furniture, bays), its graphs (roads, pavements), the
// walking colliders as a grid (the city has thousands), and a block of ink
// ids the streamed chunks take theirs from (a chunk's meshes come and go:
// allocInkId would run through the whole range in a few minutes of driving).
//   stage.part('city'): { C, graph, ids: { base, n }, idFor(key, k) }
//   (C: the generator's: groundAt, inWater, cellAt, chunkOf, ...)
//   stage.rayAll = true: the bullets' world keeps every solid of the city
export default {
  name: 'city', order: 5,
  build(stage) {
    const C = getCity();
    stage.colliders = new GridColliders();
    stage.rayAll = true;
    const graph = buildGraph(C);
    const n = 96, base = allocInkId(n);
    return {
      C, graph, ids: { base, n },
      // a chunk's k-th mesh group: an id from the block, by the chunk's place
      idFor(key, k = 0) {
        const [i, j] = key.split(',').map(Number);
        return base + (((i * 7 + j * 13) * 5 + k) % n + n) % n;
      },
    };
  },
};

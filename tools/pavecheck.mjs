// [O1c] the pavement graph's check (docs/briefs/O1C_STREETS.md §1): walks every leg
// of the pavement graph (O1's buildGraph over the generated city, no browser) as a
// man of WALK_R walks it, and prints the legs that cross a solid - through a
// building, a garden or park wall, a fence, the quay's railing, the land's edge
// ('a lot'), or into a thing standing on the pavement (a newsstand, a bench, a
// crate, a lamp post, a tree: 'a thing') - and the corners that stand in one.
// Zero of each is the bar.
//   node tools/pavecheck.mjs            the counts and the first 40 of each
//   node tools/pavecheck.mjs --all      every one
import { getCity } from '../src/world/cityGen.js';
import { buildGraph, walkSolids, WALK_R } from '../src/world/graph.js';

const all = process.argv.includes('--all');
const C = getCity();
const g = buildGraph(C);
const S = walkSolids(C);
const tagOf = (o) => (o.post ? o.post.tag : o.box.tag + (o.box.lot ? `(lot ${o.box.lot.kind}${o.box.lot.place ? ' ' + o.box.lot.place.id : ''})` : ''));
const f = (v) => v.toFixed(1);
const lots = [], things = [], corners = [];
for (const e of g.pedges) {
  const A = g.pnodes.get(e.a), B = g.pnodes.get(e.b);
  const line = `${e.kind.padEnd(5)} (${f(A.x)}, ${f(A.z)}) -> (${f(B.x)}, ${f(B.z)})  ${f(e.len)} m`;
  const h = S.hits(A.x, A.z, B.x, B.z, WALK_R);
  const hard = h.filter((o) => o.hard), soft = h.filter((o) => !o.hard);
  if (hard.length) lots.push(`${line}  through ${[...new Set(hard.map(tagOf))].join(', ')}`);
  // (a crossing's line is the road: a lamp post or a bin at its kerb is stepped past)
  if (soft.length && e.kind !== 'cross') things.push(`${line}  into ${[...new Set(soft.map(tagOf))].join(', ')}`);
}
for (const n of g.pnodes.values()) {
  if (!n.edges.length) continue;
  const h = S.hits(n.x, n.z, n.x, n.z, WALK_R);
  if (h.length) corners.push(`(${f(n.x)}, ${f(n.z)}) in ${[...new Set(h.map(tagOf))].join(', ')}`);
}
const kinds = {}; for (const e of g.pedges) kinds[e.kind] = (kinds[e.kind] || 0) + 1;
const round = [...g.pnodes.values()].filter((n) => n.round).length;
console.log(`pavement graph: ${g.pnodes.size} corners (${round} of them a step round a thing), ${g.pedges.length} legs (${Object.entries(kinds).map(([k, v]) => `${k} ${v}`).join(', ')}); a walker ${WALK_R} m`);
for (const [name, list] of [['legs through a lot (a building, a wall, a fence, the edge)', lots], ['walks into a thing on the pavement', things], ['corners in a solid', corners]]) {
  console.log(`${name}: ${list.length}`);
  for (const l of all ? list : list.slice(0, 40)) console.log('  ' + l);
}
process.exit(lots.length || things.length || corners.length ? 1 : 0);

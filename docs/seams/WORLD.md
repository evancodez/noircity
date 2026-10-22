# NOIR CITY seams: the world (lane O1)

How every other lane reads and builds on the city. The code: `src/world/plan.js`
(the plan), `src/world/cityGen.js` (the generator), `src/world/graph.js` (the
graphs), `src/world/map.js` (the map), `src/city/kits/` (the kits), the stage
`src/stages/noircity/` (its parts), the free roam `src/scenes/city.js`.

Frame: metres, y up, **x east, z south** (north is -z). A viewer's yaw looks
along (-sin yaw, -cos yaw) (yaw 0 north); a car's heading is its rotation.y
(forward (cos, -sin): 0 east, PI/2 north). Traffic keeps to the **right**.
The road is y 0, the pavements `PAVE` (0.15), the river `WATER_Y` (-2.1).

---------------------------------------------------------------------------
## 1. The plan (`src/world/plan.js`)

Data only; change the city here. Every street is a grid line with the
segments where it is a road:

```js
// north-south: x, class, z segments (a segment's ends are other lines' z)
{ id: 'orchard', x: 270, name: 'ORCHARD ST', cls: 'lane', segs: [[-300, -120], [-30, 330]] }
// east-west: z, class, x segments
{ id: 'eldridge', z: -60, name: 'ELDRIDGE LN', cls: 'lane', segs: [[150, 270]] }   // a dead end at x 270
```

- Classes (`CLS`): `avenue` (hw 9, pavement 5), `el` (8, 4: the el's columns
  stand in it 7.8 m apart), `wide` (7, 4), `street` (5.5, 3.5), `lane` (3.5, 2).
- Where a line has no segment, the cells either side are one block. A segment
  that ends where no other road crosses is a dead end (a wall at its end).
- `BROADWAY`: the diagonal, corner to corner through five cells (six-way junctions).
- `RIVER`, `RIVER_LINE`: the river road along the east and south quays and
  round the bend; `QUAY_OFF` (20 m from its middle) is the water's edge.
- `PIERS`, `SLIPS` (a ramp into the water: no railing), `BRIDGE` (Bridge St on
  over the water to the far bank, shut by a barrier and a lorry at x 596).
- `DISTRICTS` (rects, first match wins: hill, yards, docks, tenements,
  downtown): each fills its lots from its own kit. `districtAt(x, z)`.
- `SPECIAL`: grounds with their own builders (the rail yard, the gasworks, the
  park, the fish market, the market hall). `CLOCK` (Clock Square and its tower),
  `GASWORKS`, `PARK`, `CRANES`, `STADIUM`, `WHEEL`.
- `EL`: the loop (Grand Ave, Market St, the Bowery, Houston St) and its stations.
- `PLACES`: the named buildings (police, bank, hotel, store, theatres, diner,
  gym, bars, gun shop, garage, station): the generator gives each the lot
  nearest its `at` and the kit dresses it as its kind. **O5: a place's door is
  that lot's street face** (`C.lots.find((l) => l.place && l.place.id === 'gym')`).
- `STARTS`: the free roam's starts (`?start=city&at=<id>`): `grand clock
  tenements docks yards hill gasworks bridge river park`.

## 2. The generated city (`getCity()` -> C)

Built once (~35 ms), deterministic (each cell its own RNG), no THREE: a
headless tool gets the same walls.

| field | what |
| --- | --- |
| `C.cells` | the grid's cells `{ i, j, xa, xb, za, zb, district, kit, special, sides: { w, e, n, s } (the street line on each side or null), polys }` |
| `C.paves` | the raised ground: `{ pts (convex polygon), kerbSides: [bool per edge], cell, chunk }` |
| `C.lots` | the buildings: `{ kind: 'rect' (x0 x1 z0 z1) / 'poly' (pts) / 'garden', h, floors, fh, kit, district, faces: { n, s, w, e } (the street faces), tower, flatiron, house, back, place, chunk, cx, cz }` |
| `C.walls` | the solids as oriented boxes `{ cx, cz, hx, hz, angle, tag: 'wall' 'rail' 'fence' 'barrier' 'edge' }` |
| `C.posts` | round solids `{ x, z, r, tag: 'lamp' 'hydrant' 'bin' 'callbox' 'bollard' 'holder' 'stack' 'column' 'crane' 'tree' 'bandstand' }` |
| `C.lamps` | every lamp `{ x, z, yaw (the arm's heading), kind, street, quay?, bridge?, park?, chunk }` |
| `C.props` | the furniture `{ kind: 'hydrant' 'bin' 'callbox', x, z, yaw, chunk }` |
| `C.bays` | parking bays `{ x, z, yaw (the way the traffic goes there), street, side }` |
| `C.streets` | road segments between junctions `{ id, name, cls, hw, p, a, b, el, tram, diag, river, bridge }` |
| `C.alleys` | `{ x0, x1, z0, z1, through }` (5 m, at pavement height; a dead end when not through) |
| `C.specials` | `{ fences, wagons, parkPaths, trees, shed, hall, park }` |
| `C.groundAt(x, z)` | the walking surface (kerbs eased over 0.2 m; the slipways' slope; `WATER_Y` in the river) |
| `C.inWater(x, z)` | past the quay's edge, not on a pier or the bridge |
| `C.cellAt(x, z)`, `C.chunkOf(x, z)` | lookups (`CHUNK` = 96 m) |

## 3. The graphs (`stage.part('city').graph`, or `buildGraph(C)`)

```js
const g = game.stage.part('city').graph;
g.nearestLane(x, z, heading?)   // { edge, dir (+1 a->b), s, x, z (the lane's point), off, heading, d }
g.route({ x, z }, { x, z })     // { nodes, edges, pts: [[x, z]...], len } (A*, the bridge only if you go there)
g.randomWalk(nodeId, 20, rng)   // [node ids] (never straight back unless a dead end)
g.baysNear(x, z, 30)            // [bay] nearest first
g.pavementAround(x, z)          // [[x, z]...] the walk round the block (1.2 m in from the kerb)
g.pavementRoute(from, to)       // { pts, len } along pavements, crossings and alleys
g.nearestPavement(x, z)         // { node, d }
g.lineOfSight(x0, z0, x1, z1)   // false when a building's walls stand between (2D)
g.streetAt(x, z)                // { edge, s, d }: the street a point stands in
g.nodes (Map id -> { x, z, edges, ways, signal, deadEnd }), g.edges, g.pnodes, g.pedges
```

An edge's `lanes` are offsets to the right of its way (mirrored for the other
way): `lane` [1.75], `street` [2.2] (+ parking at 4.25), `wide` [1.9, 4.6],
`el` [1.9] (between the columns; the outer lane, 6.3, is parking or a slow
lane), `avenue` [1.9] (parking 7.6); the river road [2.2]. `node.signal`: three
or more ways and not all lanes (lane O2 runs the lights). The tram's rails are
Grand Ave's middle (`edge.tram`).

## 4. The stage (`noircity`) and its parts

| part | order | what (api) |
| --- | --- | --- |
| `city` | 5 | `{ C, graph, ids, idFor(chunk, k) }`; makes `stage.colliders` a `GridColliders`; `stage.rayAll` |
| `sky` | 10 | the river road's storm dome |
| `street` | 20 | the land's wet road, the bridge's deck, the quay and piers' pavement; `addImpact`, `addBlast`, `paveMat`, `roadMat`; the walking surface |
| `water` | 25 | the river, the quay's face and railing, the slipways, the bridge's girders and its barrier, the far bank, the stadium, the wheel, the water's light columns |
| `far` | 30 | the far city (always drawn): every lot's mass and its lights in 240 m tiles |
| `el` | 35 | the loop: `line.at(s)`, `line.len`, `columns`, `stations`, `stops` (the stations' stairs) |
| `landmarks` | 40 | the clock tower, the gasworks, the fences, the park, the rail yard, the fish market, the market hall's roof, the cranes, the pier sheds |
| `lamps` | 50 | the lamps' budget (below): `stage.lamps` |
| `stream` | 60 | the near chunks: `warmAround(x, z)`, `loaded`, `stats` |
| `props` | 80 | (empty: what breaks is O6's) |
| `cars` | 90 | the block's `Cars`, empty (`cars.parked`: O2) |
| `mist`, `rain` | 100, 110 | the block's |
| `train` | 120 | the el's train round the loop |
| `track` | 130 | the cars' world (`Car.js`): statics, bodies, ground, `blocked`, `spots` |
| `bounds` | 200 | every wall and post into the walking colliders; the anchors `city.start.<id>`; `navAround(x, z, r)` |

**Colliders.** `stage.colliders` is a `GridColliders` (`src/world/GridColliders.js`):
the same API as `Colliders` with a 16 m grid; `near(x, z, r)`, `remove(o)`;
`colliders.bodies` (the cars) are pushed against too. Its `bounds` are only
the Hoods' nav grid's (a 1.2 km nav grid is 6 million cells): **a fight calls
`stage.part('bounds').navAround(x, z, r)` and rebuilds `stage.nav` there**
(`new NavGrid(stage.colliders)`); the outer net is the whole city (a region).

**Bullets.** `stage.rayAll`: every far mass is a solid (RayWorld keeps solids
past 260 m for this stage). The near chunks' pavements, kerbs and lamp posts
are solids while loaded; the relief (windows, trim) is not.

## 5. The budget each lane may spend (measured at Grand Ave by the el, in the car)

The frame there: ~580 draws and ~2.6 M triangles over all passes (the old
city's chapter VI: 543 and 3.4 M; `shot=perf`: 692 and 2.8 M).
- **Lights**: 7 real lights in all (the lamps' 5 with 2 shadows, the
  headlamps' 2) - never add one; use `stage.lights.add` entries (the rain,
  the rim) and the fx's pre-allocated flash / fire lights.
- **Lamps**: 30 cones dealt to the nearest every 0.25 s. A lamp off:
  `stage.lamps.setOn(lamp, false)` (O6's shot-out lamp, a bent post).
- **Draws**: a lane's own meshes merged by material per place (a stall
  row, a bar's front); stream them with the chunk when they are dressing
  (add to the near build in `src/city/kits/`), keep them global only if
  they are few (a landmark).
- **People and cars**: the figures' ink slots are 64 (`HOOD_ID0`), the
  cars' are figures too: O2 + O3 share them - keep 20 figures and 12 moving
  cars within 120 m of the eye.
- **Ink ids**: a chunk's meshes take theirs from the city's block
  (`idFor`); a lane allocating at runtime should allocate once and reuse.

## 6. The kits (`src/city/kits/`)

- `facade.js`: `KITS` (by district: the ground floor's height, the window
  steps and sizes, the lit share, shop fronts, cornices, fire escapes, water
  tanks), `lotTiers(lot)` (a tower's setbacks), `lotWindows(lot)` (one seeded
  layout of windows / shop fronts / doors / loading doors: `{ x, y, z, nx, nz, w,
  h, lit, kind }`), `farLot(lot, out, g)` (the mass and its lights),
  `nearLot(lot, out)` (the relief). A lane dressing a place adds a kind to
  `KITS` or reads `lotWindows` for its door (`kind: 'door'`, or a shop front).
- `street.js`: `paveGeo`, `kerbGeos`, `LAMP` (the gooseneck's pieces),
  `placeLamp`, `lampHead`, `propGeo` / `placeProp` (hydrant, bin, call box).

## 7. The free roam (`src/scenes/city.js`)

`?start=city[&at=<id>]`. `game.city`: `{ car, cabin, inCar, map, stream }`.
Events: `city:in`, `city:out` (`{ car }`). The river: `game.fail({ why, to:
'ashore' })`, the `ashore` beat puts me on the quay at the nearest steps with a
car at the kerb by them (`stepsNear(x, z)`). M is the map (`mapKey: true` on
the scene leaves the sound alone; O7 moves the map to the pause card). Look
development: `?scene=city&beat=roam&car=x,z,yaw` (in the car there),
`&pose=x,z,yaw,pitch` (the eye there), `&at=<id>`.

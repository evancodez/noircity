# O1 — the city: plan, generator, streaming, graphs, kits, landmarks, the el, the river, the map

Branch `ow/O1-city`, port 5371. The foundation of NOIR CITY: every other
lane lives in what you build. The user's words:

- **[must]** "for the most part I want a new city" with "mostly new
  assets (just use the base as inspiration for the aesthetic)".
- **[must]** "You should be able to drive around."
- **[must]** "Keep it very much this same aesthetic": every frame like
  `reference/noir_reference.png`; `DESIGN.md`'s ink rules bind.
- From OPEN_WORLD.md §2: about 1.2 km square, six districts each
  readable at a glance, the el's loop, the river and one bridge, the
  landmarks, streamed so the whole city is never in memory at once, at
  60 fps on the user's Mac.

What the base has that you may reuse as kits or as inspiration (read
them first): the chase city `src/stages/city/` (plan, layout, route,
parts: the el, the neon of lane C3c, the market, the river road), the
block `src/stages/block/`, the pier `src/stages/pier9/`, the backlot
`src/stages/backlot/`, the stage index `src/stages/index.js`, the
vehicles' pilot and traffic (`src/vehicles/pilot.js`,
`src/scenes/tail/traffic.js`: the road graph idea), the renderer's
limits (`docs/story/ARCHITECTURE.md`). The new city is not any of them.

## 1. The plan (`src/world/plan.js`, data)
A hand-authored block map: the districts as regions, the street grid
with variation (a diagonal avenue, a curve along the river, dead ends in
the Tenements, the long straight in the Yards), street classes (avenue,
street, lane, alley) with widths, the el's loop and its stations, the
river's edge and the bridge, the landmarks (the clock tower, the
gasworks, the bridge, the neon theatre, the gas holder, the stadium's
glow across the water), the parks and yards, the lots on every block
with their building class. One file a person can read and change.

## 2. The generator (`src/world/`)
From the plan: roads (surface, kerbs, crossings, manholes, tram rails on
the avenue), pavements, the lots filled from **facade kits** by district
(`src/city/kits/`): tenement (brick, fire escapes, laundry lines,
stoops, shop fronts below), downtown (stone, cornices, awnings, the
neon, big glass), docks (warehouse walls, loading doors, cranes,
piers), yards (sheds, tanks, stacks, rail), the hill (walls, gates,
houses behind trees). Street furniture (lamps with pools, hydrants,
stops, signs, bins, stalls, benches, call boxes, newsstands) placed by
rules. The el on its pillars with its track and stations; the river
with its wall and the bridge; the far bank as a silhouette with lights.
Each kit piece in the ink economy (few strokes, a pool, black), with
the lit windows that make a night city. Interiors are O5's: every
door that will open later is a kit door closed now (it rattles).

## 3. Streaming and the budget
Chunks (64 m or what plays) loaded around the player and dropped
behind; far chunks as black masses with lit windows and the landmarks
always drawn; instancing for the repeated pieces; the lamps' pools
budgeted. The bar: 60 fps driving the avenue at speed and standing at
the busiest junction, measured against `shot=perf`; memory flat after
ten minutes of driving loops (no leak: geometries, textures, listeners).
Collision everywhere a player can reach: walls, kerbs (a car bumps up
them, a man steps), pillars, the river wall (the water is the end: a
car goes in and is a wreck; a man swims to the nearest steps).

## 4. The graphs (`src/world/graph.js`)
Roads: lanes with direction, junctions with signals, parking bays,
one-way lanes, the tram's rails; pavements: nodes and crossings;
alleys, yards, fire escapes to roofs. Queries the other lanes need:
nearest lane, a route between two points, a random walk, the bays near
a point, the pavement around a block, line of sight between two points
(for the police). Write them in `docs/seams/WORLD.md` with examples.

## 5. The map and the free roam
`src/world/map.js`: the inked city map drawn from the plan (M on the
pause card, the player's mark, north up), and the district names on it
in the game's lettering. `?start=city` (a `src/scenes/city.js` that
uses the base's walk and drive modes, a car at the kerb at the start, no
objective): the free roam every critic and every later lane starts
from. `?start=city&at=<landmark>` to begin anywhere.

## 6. The look
The reference in every frame: the pools and the black, the rain, the
wet street's sheen, the neon's one colour, paper white 5 to 8 %. One
frame per district from a car and one on foot, judged against the
reference; a golden manifest of this city's frames
(`tools/golden.py add`: ten frames) begun here.

## 7. Proofs and gate
The drive-through (a bot drives a loop through every district: no
hitch over 50 ms, no missing chunk in view, no pop, nothing driven
through), the walk-through (the jank walk of one block in each district:
every wall, kerb, pillar, door, stall), the streaming test (ten
minutes, memory flat), the fps table (the five busiest spots), the map
against the city (five points), the latency of W and the first frame of
motion on foot and in the car; the frames; errors clean on `?start=city`
at every landmark. Report `docs/reports/O1.md` with "For other lanes"
(the plan's format, the kits' API, the graph's queries, the budget each
lane may spend). Grey but whole (the plan, the roads, the blocks as
masses, the streaming, the free roam) in the first hours; then the kits,
district by district. Hours, not days.

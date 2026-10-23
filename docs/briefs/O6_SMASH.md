# O6 — smash: the destruction set, car damage and fire

Branch `ow/O6-smash`, port 5376. Built and proven on a test bed of your
own until the city (lane O1) merges; then it is the city's. The user's
words:

- **[must]** "Make sure to add things like car damage (would be cool for some physical stuff within reason)." (The user, 2026-10-23.) Damage that is physical and seen where the hit was: the shell dents at the point of impact (a capped vertex displacement on the body, deeper the harder the hit), the bonnet pops and flaps, a door hangs and then comes off and lies on the road, a bumper drags and sparks, a wheel wobbles after a bad corner hit and can come off (the car then grinds on the hub, slow and pulling), the lamps and the glass as before, the wreck of C3b as the end state; the parts that come off are things (solid, they rest, they are swept by the cap). Within reason: no soft-body sim, a few strokes, 60 fps with ten damaged cars in view.
- **[must]** "some destruction".
- **[must]** "everything works": destruction is physical (it stops a
  man, a car, a round), seen (a few strokes, the right sound), and it
  never costs the frame rate.

What you build on: `src/destruct/` (Breakables, Glass, Shatter, Wreck:
read them and the lanes that used them, `docs/story/reports/wave-c/C3.md`,
`C3b.md`, `C8.md`), the vehicles (`src/vehicles/Car.js`, `Vehicle.js`,
`models.js`: the wreck's smash of lane C3b), the ink's economy
(`DESIGN.md`).

## 1. The set (`src/destruct/` extended, a registry)
`smash.register(object, kind, opts)` for anything the world places;
`smash.hit(object, point, impulse, by)` from a car, a fist, a round, a
body. Kinds, each with its ink look whole and broken, its physics (a
topple, a break, a leak, a lean), its sound, its cap:
- the hydrant (sheared: a column of water that cars and men walk
  through, lit by the lamps, for a minute);
- the lamp post (leans, flickers, dies: its pool goes out; a thing to
  shoot too);
- the stall (over: its canvas, its goods spilled and skidding), the
  crate (splinters), the bin (over, rolling), the bench, the newsstand
  (papers in the air for a moment), the sign, the awning (torn down by
  a lorry), the fence (panels down), the call box (dark);
- the glass (shop fronts, car glass: the base's Glass and Shatter where
  the round or the body went; it lies where it fell);
- what rests stays (capped: the oldest debris goes first, never in
  view if it can be helped).
All physical: a toppled stall stops a man, slows a car; a broken
hydrant is a thing to drive through; a dead lamp is dark.

## 2. Cars (`Car.js` damage, with the wheels lane later)
Damage states by where the hit was (a dent, a wing crumpled, a lamp
out, glass gone, a door hanging), the engine (steam, then smoke, then
**fire** as ink flames and black smoke, then the wreck: a body burnt
in a few strokes), the tyres (shot out: the pull). The wreck's smash of
C3b is the base: make it the rule for every car, mine or theirs, at any
speed, with the look of the thing (the body twisted onto the broken
corner). A car that burns is a thing to stay away from (it goes with a
flash: the lamps' pool for a moment, the shards). The tram strikes
sparks on a car in its way.

## 3. The bed and the budget
`?start=smash`: a street of your own with every kind placed, a car at
the kerb and a gun in hand, to drive and shoot through it. The budget:
a hundred props going over in view, with the glass, at 60 fps against
`shot=perf`; memory flat after a hundred cycles (pooled). Write the API
and the caps in `docs/seams/SMASH.md` for O1 (the generator registers),
O2 (the cars call), O4 (the rounds call).

## 4. Proofs and gate
A play that drives through the whole set (every kind over, nothing
passed through, nothing floating, everything resting), a play that
shoots every kind, a car burnt to the wreck, the tram's sparks; the
latency of a hit to its first frame; the strips of the hydrant, a stall,
a lamp dying, a car's fire, looked at; the fps reading at the hundred;
the memory reading; golden identical (the base's frames) plus two of
yours; errors clean on the bed. Report `docs/reports/O6.md`. Hours, not
days.

## From the cold play of the merged city (`docs/reports/CITY_COLD_PLAY.md`): yours
Yours, in your fix pass: **finding 10**, a car into the river: a splash
in ink and the water closing over it, not grey planes; the wreck under the
surface a dark shape with its lamps dying.

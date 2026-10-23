# O2 — wheels: car types, traffic, parking, hijack, the garage, fares, the race

Branch `ow/O2-wheels`, port 5372. Built on the city (lane O1 is merged:
read `docs/reports/O1.md` "For other lanes" and `docs/seams/WORLD.md`
first: the plan, the road graph and its queries, the budget O1 leaves
you) and on the destruction set (lane O6, `docs/seams/SMASH.md`: a car's
damage states, its fire and its wreck are O6's rule; you call it, you do
not redo it). The user's words:

- **[must]** "A variety of cars (not a ton for now but yk). Make it a world that feels not overly copy-paste." (The user, 2026-10-23.) The fleet's kinds each in two or three visible variants (body: two-door, four-door, a roof up or down, a pickup bed; livery: the taxi's band and roof light, the police markings, the vans' painted names, the hearse; grilles, lamps, wheels, a dent or a scrape on some parked ones), picked by a seeded hash of the bay or the lane, so no street of parked cars reads as one car repeated.
- **[must]** "You should be able to drive around."
- **[must]** "Hijack cars and various cars."
- **[must]** "everything works": cars never through cars, people, walls
  or each other; a car that is hit shows it; where I cannot drive I see
  why (a parked lorry, water, a wall, a chained yard).
- **[must]** "This city should really react to player interaction (like a dynamic police system), fun shootouts, brawls, etc. Keep the scope manageable but it should feel fun." (OPEN_WORLD.md: the city answers everything the player does, within seconds, visibly.)
- Still binding from game two (`docs/story/briefs/G4_CARS.md` §1, as
  `Car.js` left it): steer a hand can trust (W to the first frame of
  motion and A to the wheel's first turn under 50 ms), weight, the
  handbrake, collision that never sticks (reverse always gets me out),
  the horn (Q), the engine's note by the revs.

What you build on: the cars (`src/vehicles/Car.js`: `CAR_SPECS`, the
bicycle model, the contacts, `DAMAGE` and its events; `Vehicle.js`,
`models.js`, `cabin.js`; the drive mode `src/player/modes/drive.js`; the
pad's analogue pedals), the driver (`src/vehicles/pilot.js`: a path
follower that gives the same inputs a player gives), the tail's traffic
and tram (`src/scenes/tail/traffic.js`, `tram.js`: the idea, written for
one chase; read `docs/story/reports/wave-c/C3.md`, `C3b.md` and
`docs/story/reports/game-two/G4.md` and their `Left`), the cast's driver
kind (`src/cast/kinds/tail_trucker.js`, the fight's drunk driver in
`src/game/Brawl.js`), the kit (`docs/story/seams/Z.md`).

## 1. The cars (`src/vehicles/models.js` grown, new models in the ink)
Eight kinds, each told from the others by its outline alone at 40 m, each
with its spec and its sound:
- the **coupe** (fast, light, the one at the kerb at the start);
- the **saloon** (heavy, the gangs': two of them carry men who shoot);
- the **taxi** (a checkered band, a roof light: the fares);
- the **delivery van** (tall, slow to turn, the goods in the back);
- the **lorry** (slow, a wall; an awning torn down by it is O6's);
- the **police car** (the red lamp, the siren: lane O3 drives it; you
  give it the model, the lamp, the siren's sound and a pilot that can
  hunt a target on the graph);
- the **hearse** (long, black, slow);
- the **tram** on the avenue's rails (not drivable: a moving wall with a
  bell, the base's tram made the city's).
Each has a cabin (the wheel, the dials, the mirror) and the glass of
O6's set. Every car is a few strokes: the budget in `O1.md` is yours to
spend, instanced where a kind repeats.

## 2. Traffic (`src/traffic/`)
Cars on O1's graph, never more than the budget in view: they keep their
lane, stop at the signals (and run a late amber), give way at junctions,
park in the bays and pull out of them, overtake a slow one when the road
beside is free, brake for me and sound the horn when I cut them, stop
when I stand in the road (a horn, then a slow way round), and **panic**
when a shot is fired near them or a man is down (they swerve, they stop
crooked, the driver ducks or runs: a seam `traffic.alarm(point)` that
O3's police and O4's guns call). They come on out of my sight and go when
out of it; never a pop in the frame. Parked cars on every street by the
plan's bays, a few in each district, of the district's kinds (lorries in
the Yards, saloons on the Docks, the hearse by the Hill's chapel).
Every car, moving or parked, is solid to cars, men and rounds (O4's cover
finder reads them).

## 3. Hijack and the car's door (`src/vehicles/hijack.js`)
- **E at a driver's door** of a moving-or-stopped car with a driver:
  the car is brought to a stop if it was not (he brakes when I stand at
  his door), the door opens, he is pulled out (0.8 s, my hands on him,
  the camera eased in: the controls are mine from the seat), and he
  answers: a civilian runs (most), or fights (a driver with a jaw: O4's
  brawl, `brawl.start([kind])`, one opponent; until O4 merges, the
  base's `Brawl.js`), a gangster steps back and draws (O4's gun kit; the
  tell first), a cop fights and calls it in (heat: O3's). The car is
  mine with what was in it (a wallet now and then: `$` into
  `save.money`, the seam O4 names).
- **E at a parked car's door**: 2 s of my hands at the glass (the ink of
  it, the sound of the lock), the controls mine through it (I can walk
  away); a witness within sight raises heat (`crime.emit('hijack',
  point)`: the seam O3 reads; until O3 merges the event is logged and
  nothing more).
- Leaving: E stops the car and puts me on the pavement side; the car
  stays where I left it (the chunk remembers it, O1's streaming: a car
  left in a far district is there when I come back, as the plan's own
  cars are).
- A car in the river is a wreck; I swim to O1's steps.

## 4. The garage, the fares, the race (rules; the rooms are O5's)
- **The garage** (the Yards): E at its door with a car: the car is
  stored (`save.garage`: up to three), repaired for `$`, repainted in a
  grey of your three; a stored car is fetched by E at the door on foot.
  Until O5, a door and a prompt on the garage's kit door.
- **Fares**: in a taxi, a man or a woman on the pavement hails (an arm
  up, seen at 40 m); stop by them, they get in (E, or just a stop of 2 s);
  the objective line `The Hill.` (O1's landmarks as destinations: the
  line is O7's HUD, call `hud.objective` as the kit has it); the meter
  runs by distance; arrive and `$`; a passenger thrown about (two hard
  hits, or a wreck) gets out and the fare is lost (`He got out.` warned
  by `Easy.`). Idle: the passenger leaves after a while, warned.
- **The race**: at the Yards' long straight, by night, three cars at the
  corner with their lamps on and a man with a flag; stop by them and E:
  a bet of `$` (or nothing, a race for its own sake), three laps of the
  Yards' loop (the graph's route, O1's), the others by the pilot at
  three paces, the line crossed is the win and the purse. Idle loses
  (the others finish), good wins twice, medium in one to three.
- `$` is `save.money` (lane O4's seam; O7 draws it).

## 5. Proofs and gate
The drive-through of every district in traffic (a bot drives O1's loop
with the traffic on: no car through anything, no pop in view, no hitch
over 50 ms, nothing stuck at a junction for more than 10 s), the hijack
proofs (a civilian, a fighter, a parked car: `idle / bad / medium /
good`: idle at a fighter's door loses the fight, warned; good takes the
car twice), the fare proofs, the race proofs (idle, bad, medium, good
twice), the parked-car witness (a hijack unseen raises nothing seen:
the event, logged), the latency numbers (W, A, SPACE, E at the door,
Q), the jank bench of a car against every kind of car and the tram, the
strips of a hijack and of a race's start, looked at; fps at the busiest
junction with the traffic at its cap and at the race against
`shot=perf`; memory flat after ten minutes in traffic; golden identical
(the base's and O1's frames) plus two of yours; errors clean on
`?start=city` at every landmark with the traffic on; the pad play of a
drive and a hijack. Edits to shared files marked `// [O2]`. Report
`docs/reports/O2.md` with "For other lanes" (how a system asks for a
car at a point, how the police car hunts, `traffic.alarm`, the hijack's
events, the garage's save). Hours, not days.

## From the cold play of the merged city (`docs/reports/CITY_COLD_PLAY.md`): yours
Yours, in your fix pass: **finding 5**, the coupe tops out at 75 km/h
(`vmax` 22.5 in `src/vehicles/Car.js` line 33): a faster coupe for the
Straight, the lorry slow, each kind its own top speed that reads; and
**finding 4's cabin**: it fills about two fifths of the frame from the
seat (a lower dash or a wider view from the seat): the districts must read
from the car. Keep the cabin's craft the report praises (the drops on the
glass, the wiper, the mascot, the mirror).

## From the performance audit (`docs/reports/PERF_AUDIT.md`): yours
Hold your merge to the audit's budget table (its section 5). Yours, in
your fix pass (or your build if you read this first): `src/world/Cars.js`
`spawn` draws 12 meshes per car and `src/stages/noircity/parts/cars.js`
`update` never calls `lodUpdate`, so every car is drawn at full detail at
any range. A **one-draw far build** beyond about 36 m, with `lodUpdate`
called every tick (30 cars from about 400 draws to under 90), and the
variants' extra parts inside that budget.

## From lane O5's merge (2026-10-23, main 407278b): yours
O5's garage (`src/places/rooms/garage.js`): the mechanic fixes ($15) or
repaints ($10) the car parked outside, but the garage stores no car. Yours:
a car left at the garage is kept (one bay: the save holds it, the sheet goes
over it), taken again from the mechanic; and the repaint through your
variants (a new colour and plate, the heat off it: the reason to repaint).

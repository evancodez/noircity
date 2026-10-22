# NOIR CITY — an open world in the ink (the art director's plan)

A separate game from NOIR EXTREME, in the same hand-inked black-and-white
look (`reference/noir_reference.png`, `DESIGN.md`: both bind, word for
word), cloned from it on 2026-10-22 (the clone's head is NOIR EXTREME's
`game-two/integration` at 31912a7: the renderer, the ink, the cast, the
vehicles, the gun kit, the fist fight, the pad, the kit of cards and
fails, the tools). The user's words, which are the standard:

> An open world game set in this noir aesthetic. You can reuse some
> assets but for the most part I want a new city. You should be able to
> drive around, get into shootouts, fist fight (change these mechanics to
> work better and smoother), there should be a police system too. Hijack
> cars and various cars, some destruction, buildings to enter and things
> to do. Keep it very much this same aesthetic but mostly new assets
> (use the base as inspiration for the aesthetic). No story mode or
> outright missions yet: a full open world game.

Read first, in this order: `reference/noir_reference.png`, `DESIGN.md`,
this file, your brief `docs/briefs/O<n>_*.md`, then the parts of
`docs/story/WAVE_C.md` §1 and §2 and `docs/story/GAME_TWO.md` §1 that
this file points at (the rules of fairness, the rulebook of keys, the
three bars: smooth, the middle, everything works: they are this game's
rules too). The old game's chapters (`src/scenes/0*.js`) are reference,
not the game: this game has no chapters.

---------------------------------------------------------------------------
## 1. What the game is

One city, one endless night, rain coming and going. The player is a
man in a coat with a revolver under his arm, a car he took, and nothing
he must do. The city answers what he does: drive it, fight in it, rob
it, run from it, hide in it. There is no story. There are **systems**
that make things happen, **places** that are worth going into, and
**things to do** that a player finds by looking (a gym, a race, a fare,
a hideout), never a mission list.

The three bars of `GAME_TWO.md` §1 are the bars here: **smooth** (input
acts on the press, nothing locks the player, every hit reads three
ways, 60 fps on the user's Mac), **the middle** (the objective line
when there is one, a card at first need, a nudge only when stuck, never
a wall of text: in an open world the line is the player's own
situation: `HEAT 2`, `Lose them.`, `The gym.`), **everything works**
(what looks usable is usable; nothing passes through anything; where
you cannot go you see why; destruction is physical).

WAVE_C §1 rules 1, 2, 6, 7, 8 bind every system (nothing wins itself;
nothing lost for no reason; no jank; players explore and are answered;
polish). The rulebook of keys is WAVE_C §2 with these additions:
**M** the map (the pause card's map; the old M for sound moves to the
settings), **Tab** the heat and the money for a moment, **E** also:
take a car (a parked one, or the driver out of it), enter a door, sit,
buy. Keys are taught by the kit's cards once (`docs/story/seams/Z.md`:
the kit is kept, its `game.fail` is now the arrest and the hospital).

---------------------------------------------------------------------------
## 2. The city (lane O1 builds it; every lane lives in it)

New, about 1.2 km by 1.2 km, authored as a **plan** (a block map in a
data file: districts, streets, the el's loop, the river, the landmarks)
and built from **kits** (facade pieces, street furniture, props) by a
generator, streamed in chunks around the player so the whole city is
never in memory at once. The ink style's own economy is the budget:
few strokes, big pools of light, black.

Districts, each with its own silhouette and sound, readable at a
glance from a car:
- **The Docks** (south): piers, warehouses, cranes, the river, the
  fish market, a pier office or two to enter. Gang ground.
- **Downtown** (centre): the avenue with the neon (theatres, the hotel,
  the department store), the el's loop overhead, the clock tower (the
  landmark seen from everywhere), the police headquarters, the bank.
- **The Tenements** (east): narrow streets, fire escapes, laundry
  lines, stoops, the boxing gym, the corner bars, the market hall,
  the el's stations. The other gang's ground.
- **The Yards** (west): the rail yard, the gasworks (the second
  landmark: the tanks and the stacks), the garage, the long straight
  where the races run, lorries.
- **The Hill** (north): the big houses behind walls and gates, the
  park with its lamps and bandstand, the bridge over the river.
- **The Bridge** and the river: one bridge, open; the far bank is a
  silhouette (the stadium's lights, the fairground's wheel), not a
  place: the water stops you (a car in the river is a wreck; a man
  swims to the bank).

Roads carry a **graph** (lanes, junctions, lights, parking, kerbs) for
traffic and the police; pavements carry one for people. Alleys, yards
and roofs (by fire escapes) for the man on foot. Landmarks and neon
for orientation; the **map** (M) is an inked city map with the player
and the heat on it, nothing else at first.

---------------------------------------------------------------------------
## 3. The systems (one lane each; the table in §6)

### Wheels (O2)
Car types, new models in the ink style: the coupe (fast, light), the
saloon (heavy, the gangs'), the taxi (a checkered band), the delivery
van, the lorry (slow, a wall), the police car (the red lamp, the
siren), the hearse (why not), the tram on its rails (not drivable, a
moving wall). Traffic on the graph (signals, parking, lanes, a horn
when you cut them, a stop when you stand in the road, panic when you
shoot). **Hijack**: E at a driver's door takes the car: he is pulled
out (he may fight back or run; a cop fights, a gangster shoots), a
parked car is broken into (2 s, a witness raises heat). The car's feel
is `Car.js` as game two left it (steer a hand can trust, weight,
handbrake, damage, the wreck). The garage stores cars.

### People (O3)
Pedestrians who are the city's weather: walking, standing under
awnings in the rain, at the stalls, at the stops; who react (flee the
gun, cower from a fist fight, gather at a wreck, run to a call box to
report you). Two gangs with turf (the Docks, the Tenements): they
stand on corners, they watch you, they draw if you draw, they fight
each other at the border now and then. Beat cops. **The police
system**: `HEAT` 0 to 5, drawn as badges in the HUD. A crime seen by a
witness (a cop, a civilian who reaches a call box or a cop) raises it:
a punch 1, a hijack 1, a shot 2, a death 3, a cop hurt 4. The response
by level: 1 a beat cop walks over to arrest (fists, or run); 2 a
patrol car with two men; 3 two cars, a roadblock on your road; 4
detectives with Tommy guns, cars from the sides; 5 everything, the
riot squad's lorry. Losing it: out of their sight for a while (a
search state they show: the siren drops, they cruise), a change of car
where no one sees, an interior. **Arrest** is the fail when they have
you cornered on foot (a warning: `Hands up.`; a fight is a choice;
then the black and you wake at the station, the gun gone, the heat
gone, the car gone). **Death** is the other: the hospital. Both are
fair: the tells, the warnings, the retry quick.

### Combat (O4)
The gun kit (`docs/story/seams/GUNS.md`) and the fist fight
(`docs/story/FIGHT.md`) from the base, rebuilt for an open world. The
user asked for both to "work better and smoother": the fist fight must
handle **more than one opponent** (a crowd brawl: a target you face,
the others circling and coming in with the cue, a switch of target by
looking), the counters and the dodge cue kept, the environment used
(bottles, chairs, a wall); it is what the gym sells (bouts for money),
what a hijacked driver may give you, what a cop at heat 1 brings. The
guns in open ground: cover from the world (cars, pillars, crates,
doorways), enemies who use it (the gangs, the police), the revolver,
the Tommy gun, a shotgun (new), bought at the gun shop with money,
ammo counted everywhere. Health mends slowly; the diner's coffee and
the hotel bed mend it whole.

### Places (O5)
A kit for interiors (walls, doors that open, lights, furniture that is
solid) and a dozen buildings a player can enter, each with a use:
the boxing gym (bouts), the diner (sit, coffee), two bars (a drink, a
fight that breaks out, a card game watched), the gun shop, the garage
(store, repair, repaint in greys), the hotel (a room: save, sleep to
let the heat die), the police station (where you wake), the pier
office and a warehouse (gang hideouts: shootouts), the market hall,
the theatre lobby, the tenement stairwells to the roofs. Doors you
cannot enter rattle, locked. Shop fronts have glass.

### Smash (O6)
Destruction that is physical, capped, in a few strokes: hydrants (water),
lamps (they lean and die), stalls, crates, bins, fences, newsstands,
benches, signs, shop glass, awnings; cars (damage states, the wreck,
fire as ink flames and smoke), the tram's sparks. `src/destruct/` is
the base.

### The Night (O7)
The HUD (the heat badges, the money, the objective line when a thing
to do is taken up), the map, saves (the hotel room, and an autosave
at the car), the title and the pause, the music (the base's slots as a
car radio with stations and the city's own sound), the pad through
everything, the whole-game polish and the bug hunt.

### Things to do (every lane adds its own; O7 ties them)
Found by looking, never listed: the gym's bouts (money), the race
that starts at the Yards' corner at night (a bet), a taxi's fares
(take a taxi: a passenger hails you, the meter runs), the gangs'
hideouts (clear one: money in the safe, heat), a phone box (a car
brought to you for money), the el (ride it: a view), the diner, the
theatre (a short noir reel on the screen, a still), the matchbooks (one
per bar: a collection on the pause card), a bounty board at the police
station is **not** a mission list: it is three names a night, with a
photo, and you may or may not go looking.

---------------------------------------------------------------------------
## 4. Money
One number, `$`, from bouts, fares, races, hideouts, the odd wallet in a
hijacked car. Spent on guns, ammo, the garage, the phone box, the
hotel. Never required for anything: a player with no money can still
do everything but buy.

---------------------------------------------------------------------------
## 5. How it is built (the shape of the code)
- `src/world/` the plan, the generator, the streaming, the road and
  pavement graphs, the map data (O1).
- `src/city/kits/` the facade, street and prop kits (O1), the interior
  kit (O5).
- `src/traffic/`, `src/vehicles/` (O2); `src/people/`, `src/police/`
  (O3); `src/combat/` on `src/guns/` and `src/game/Brawl.js` (O4);
  `src/places/` (O5); `src/destruct/` (O6); `src/night/` the HUD, map,
  saves, radio, title (O7).
- The old game's `src/scenes/`, `src/stages/` stay as reference and as
  test beds (`?start=guns`, `?start=range`, the kit's bed) until O7
  decides what is dead.
- The renderer and the ink pipeline (`src/render/`, `src/fx/`) are not
  changed by any lane but a shader lane the art director opens.
- Headless tools as in the base: `tools/shot.sh`, `play.mjs`,
  `errors.sh`, `strip.py`, `golden.py` (a new manifest of this city's
  frames, begun by O1), `wd.sh` on every run.

---------------------------------------------------------------------------
## 6. Lanes and how to work

| Lane | What | Branch | Port |
| --- | --- | --- | --- |
| O1 | the city: plan, generator, streaming, graphs, kits, landmarks, the el, the river, the map data | `ow/O1-city` | 5371 |
| O2 | wheels: car types, traffic, parking, hijack, the garage, fares, the race | `ow/O2-wheels` | 5372 |
| O3 | people: pedestrians, witnesses, gangs, beat cops, the police system, arrest, the station | `ow/O3-people` | 5373 |
| O4 | combat: the crowd brawl, the guns in open ground, the shotgun, the gym, the gun shop | `ow/O4-combat` | 5374 |
| O5 | places: the interior kit and the dozen buildings with their uses, the hotel's save | `ow/O5-places` | 5375 |
| O6 | smash: the destruction set, car damage and fire | `ow/O6-smash` | 5376 |
| O7 | the night: HUD, map, saves, radio, title, pad, polish, the whole-game hunt | `ow/O7-night` | 5377 |

Waves: O1, O4, O6 first (O4 and O6 build and prove on the base's test
beds and move into the city when O1 merges); then O2, O3, O5 on the
city; then O7. At most three builders on this machine at a time, and
NOIR EXTREME's own lanes count: the art director schedules.

One owner per lane, end to end, judged by playing it (headless, by real
input); the critic plays it cold; the owner fixes. The gate is WAVE_C
§7's with GAME_TWO §4's additions, read for an open world: the proofs
are of the lane's contests (a hijack, an arrest, a bout, a race, a
roadblock, a hideout), `idle / bad / medium / good`; the jank walk is
of a district; the interaction walk lists everything tried; fps at the
busiest street. Reports `docs/reports/O<n>.md`, frames
`docs/review/O<n>/`. Hours, not days: grey but whole first, then the
look. Delete captures as you go.

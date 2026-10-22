# O1 — the city: the cold player's report

Played cold on `ow/O1-city` at 5f2b9a6 (2026-10-22), dev server on 5371,
headless, muted, by real input only (`tools/play.mjs` with my own plays in
`tools/plays/critic/o1/`). I played first and only then read
`docs/reports/O1.md`. The machine was loaded the whole time (load 7-16, the
GPU 70-92 % busy from other lanes' runs before each measure), so every
timing below is a loaded-machine number. Frames: `docs/review/O1/critic/`
(six). Errors: `#errlog` empty in every one of my ~30 runs.

Severity as the brief sets it: **blocker** = a user ask not met, a contest
that wins itself or cannot be won or lost fairly, a stuck state, a
pass-through or pop a player sees in normal play, not knowing what to do, an
input that does not act on the press; **major** = felt by most players, not
fatal; **minor** = polish.

---------------------------------------------------------------------------
## 1. Findings, most felt first

### B1. BLOCKER: a car drives through a standing lamp post
**What**: hit a lamp post at more than ~16 km/h (`giveAt: 4.5` m/s) and
the post's collider is switched off (`k.gone = true`), but the post is
merged into its chunk's mesh, so it **stays standing**. The car rolls on
through it and stops with the post sticking up out of its body. Frame
`1_lamp_post_through_car.jpg`: the coupe parked half up the kerb, the
post coming up out of its roof. My in-page recorder had the post's centre
0.8 m inside the car's box on 2 of 3 runs of the same input.
**Steps**: `?mute=1&start=city`, BEGIN, E into the coupe, hold W ~0.9 s,
D 0.35 s, A 0.25 s. The car mounts the east kerb of Grand Ave and goes
into the lamp at (-110.3, 14.0). Then E out and look back (play
`tools/plays/critic/o1/lamp_through.json`; the recorder is in
`drive_kerb.json`).
**Where**: `src/world/cityGen.js:712` and `:764` (`give: true` on every
lamp) with `src/vehicles/Car.js:380-391`. Report §5 item 4 knows the post
"bends nothing you can see". A player sees it every time a car goes up a
kerb, which in a free roam is all the time. **Fix**: until O6 draws a
breakable on its own, take `give` off the city's lamps, so they are solid
like the hydrants and the el's columns. Or hide the post's instance and put
a leaning or fallen post in its place. A post that stops counting must stop
being drawn.

### B2. BLOCKER: the one bridge ends in a grey cardboard wall
**What**: drive Bridge St east across the river (the bridge, a landmark,
the only way off the island the map shows) and at its end the screen fills
with flat, untextured grey planes: the far-bank "silhouette" sheds seen
20 m away, a grey box lorry, and a barrier with three white dashes. There
is no ink and no brush. It reads as a greybox level edge (frame
`2_bridge_far_end_grey.jpg`, 20 m before the barrier at 71 km/h). On foot
at the barrier you look up at the far bank's skyline. It is a flat grey
cut-out a few tens of metres away, at the wrong scale. The car hits the
barrier at 71 km/h with no warning (crash, dead stop). That is fair, but
nothing ahead said "shut" until the last second.
**Steps**: `?mute=1&start=city&at=bridge`, BEGIN, E, hold W for 7.5 s
(`tools/plays/critic/o1/bridge_end.json`).
**Where**: `src/stages/noircity/parts/water.js:132-170` (the barrier, the
lorry, the far bank's `shed()` boxes in `M.brickFar`). Report §5 item 9
calls the barrier "by design". The barrier is fine. What it looks like is
not (DESIGN.md: no untextured flat surfaces; the user: "make sure you
aren't placing people into unfinished environments"). **Fix**: push the
far-bank sheds well back past the barrier, or behind a toll house and the
lorry so the view is blocked. Ink them like the city's far masses. Put a
lit sign `BRIDGE CLOSED` or a watchman's lamp and red-white barrier boards
on the deck 60 m before the end, so the eye reads "shut" from the far side
of the river.

### B3. BLOCKER (the user's ask 4): the districts do not read at a glance from the car
**What**: from the driver's seat the coupe's cabin takes about 60 % of the
frame: the roof, both A-pillars, the mirror, the wheel and hands, the
bonnet. What is left is a letterbox of street. Through it the Yards, the
Docks and the Tenements are the same picture: a dark street, black walls
of brush strokes, lamp cones (frame `3_cabin_districts_alike.jpg`, four
frames from my drive-through: Tenements, Yards, Docks, Tenements). I
could not tell which district I was in without the map. Only the Hill
(walls, trees, skyline) and the quay (railing, crane) read on their own.
The brief and OPEN_WORLD §2 both say "readable at a glance **from a
car**".
**Steps**: `tools/plays/critic/o1/tour_drive.json` (the owner's drive bot
with shots every 200 points), or drive anywhere from `?start=city`.
**Where**: the eye is `src/vehicles/cabin.js:36` (`fov: 58, pitch:
-0.12`, the base's cabin camera; it may be O2's to change, but this lane's
ask fails on it). The districts' own street level is the other half: the
walls at street height are the same black brush field everywhere (see
M4). **Fix**: lift and widen the eye (a wider FOV, the eye higher, the
roof cut back so the upper storeys and the skyline show). Give each
district one thing that shows through a windscreen at 40 m: the
Tenements' laundry and fire escapes low enough to cross the view, the
Docks' cranes and warehouse doors at street level, the Yards' fences, rail
and holders over the roof line.

### M1. MAJOR: two "E GET IN" cards at once at every start
**What**: at every `&at=` start (clock, tenements, docks, yards, hill,
gasworks, bridge, park) and after the river's retry, the first frame shows
the teach card `[E] GET IN` (key cap) **and** the prompt `E GET IN` one
line under it, saying the same thing twice (frame
`4_start_two_get_in_cards.jpg`). The teach card then stays up for
seconds after I turn away from the car, over a black wall
(`hill_b`, `bridge_b`, `yards_b` in my run). GAME_TWO §1 B6: never two
cards at once.
**Where**: `src/scenes/city.js:146` (`hud.prompt` and `hud.teach` on the
same frame). **Fix**: show the teach card alone the first time (it already
has the key), and the plain prompt only after it has been taught. Clear the
teach card when the car leaves the look cone.

### M2. MAJOR: every start faces the car's side from one metre
**What**: at all the `&at=` starts the first frame is the coupe's flank
filling the screen. Turn round and it is a black brush-noise wall at arm's
length (the start puts me on the pavement between the car and a
building). The first picture of each district is a door panel. Only the
default Grand Ave start looks down the street under the el, and that one
is good.
**Where**: `src/stages/noircity/parts/bounds.js:39-46` (the anchor: 2.3 m
off the car's right, yaw looking at it + 0.35). **Fix**: stand me a pace
behind the car's tail, looking along the street past it, so the car is in
the lower third and the district is the picture.

### M3. MAJOR: the clock tower, "the landmark seen from everywhere", was not seen
**What**: in about 40 frames on foot and in the car (Grand Ave, Centre St,
the Tenements, the Docks, the Yards, the Hill, the Gasworks, the bridge) I
never once saw the clock tower. Turning toward it from the Grand Ave, Docks
and Yards starts I saw the building next to me. The owner's own frames
show it only straight down Broadway (`city_broadway`). At 58 m it is lower
than the "taller downtown" towers around it, so it only shows when
Broadway frames it.
**Where**: `src/world/plan.js:167` (`CLOCK.h: 58`), the downtown heights.
**Fix**: make it the tallest thing in the city by a clear margin (90 m or
more), lit faces on all four sides, and keep the lots round Clock Square
low, so it shows over the roofs from every district's main street and
from the quay and the bridge.

### M4. MAJOR: the colours outside the registry: green and amber neon
**What**: the bars, blades and theatre are lit **green** and **amber**
(`3_cabin_districts_alike.jpg`, the Docks frame: a green tube with its
green sheen in the wet street). DESIGN.md: colour "only from the registry
(`src/render/accents.js`)", which has one neon, the diner's blue. "No
colour leaks". The user: "keep it very much this same aesthetic".
**Where**: `src/stages/noircity/parts/places.js:16`, `:24`, `:142`,
`:150`, `:182` (`rng.chance(0.6) ? 'blue' : rng.chance(0.5) ? 'green' :
'amber'`). **Fix**: blue only (one colour, as the reference has none at
all), or get the art director to add a colour to the registry first.

### M5. MAJOR: the first seconds of every drive hitch
**What**: my run of the owner's drive-through (`tour_drive.json`, same
route) FAILED its hitch bar: 21 frames over 50 ms (worst 137 ms). **9 of
them in the first 7 s of driving**, on Grand Ave right after E and the
first W (128, 73, 53, 117, 53, 51, 52, 83, 57 ms). The rest were spread
over 5 minutes. No chunk was missing or late (0 / 0) and the car was
never inside a wall. So the city streams well, but the first thing a
player does (get in, floor it) stutters. The machine was loaded (load 11,
GPU busy), as on the owner's own failing run. The owner's report §5.1
names the same first-seconds cluster and has not isolated it.
**Fix**: as §5.1 says, run it on a quiet machine. Then make the first E
into the car pay its costs (the cabin, the car's sound bed, the shadow
lights' first renders) under the start's fade, not on the first throttle.

### M6. MAJOR (outside the lane: O7, but the player meets it first): the title is the old game's
**What**: `?start=city` opens on **NOIR EXTREME**, `BEGIN · CHAPTERS`, the
old diner's blue `DINER` backdrop and the old game's key line (`M SOUND`,
`F SMOKE`, `SPACE BLOCK, VAULT`). M is now the map. The first screen of
"a new city" is the old game (frame `6_title_noir_extreme.jpg`).
**Fix**: O7's title. Until then, at least `M MAP` in the key line.

### M7. MAJOR: the map's "me" is a tiny arrow lost in the street lettering
**What**: on M the map opens at once (open at 120 ms; the world freezes;
M closes it; good). But my mark is a ~15 px paper-white arrow (`#f4f1ea`) drawn
on a paper-white street at Grand Ave × Broadway. What I found first was
the car's little black square beside it, and I took that for me (frame
`5_map_mark.jpg`). `DOWNTOWN` is printed over
`CENTRE ST` ("DOWNT·ST·VN"). The map is grey UI rather than ink.
**Where**: `src/world/map.js:134-137`. **Fix**: a black arrow twice the
size with a white ring, or a pulsing ring. Move `DOWNTOWN` off the street
(report §5.8 knows the labels).

### m1. minor: the river's warning is not scaled by speed
Down the Baxter slipway at full throttle, `The river.` comes at z 439.2
and 34 km/h, and the car is in the water 1.1 s later at 48 km/h
(`river_slip.json`). A player who lets go of W 250 ms after the warning
and brakes (S + SPACE) stops 7 m short (`river_answer.json`: answered,
fair). A slip is only reached by turning off River Rd, so the speed there
is low. But a pier's end warns 14 m before it in the car
(`src/scenes/city.js:112`), which is 0.7 s at 70 km/h. **Fix**: warn at a
distance of speed × 1.5 s, minimum 14 m. The quay's railing stops a car
dead (`river_quay.json`: good, physical). Pier 5 has a shed across its
middle, so the car stops there (`river_pier.json`). Fine, but it is the
pier straight down Grand Ave's line, the one a player tries first.

### m2. minor: the teach card for driving comes after the driving
`[W] drive [SPACE] handbrake` shows 2.5 s after W is first pressed
(`city.js:126`). By then I was at 30 km/h. S (brake and reverse) is never
taught. Show it on the seat, before W, and say `[S] brake`.

### m3. minor: E at speed does nothing, and nothing says why
E to get out works only under 1.5 m/s (`city.js:128`). Pressed at 30 km/h
it does nothing, with no prompt and no sound. The `E get out` prompt only
appears when slow, which is right, but a first-timer mashes E and thinks it
is broken. Also on E out the car's velocity is zeroed (`city.js:187`), a
dead stop from up to 5 km/h. Let it roll.

### m4. minor: a facade at arm's length is pure brush noise
Up against any wall (a door, the Grand Ave facades, the docks sheds) the
whole frame is a field of brush strokes, with no brick course, no door
frame, no step (`00_door` in my poke play; the starts' `_b` frames). From
3 m on, the shop windows and doors read. It looks wrong at contact range,
where an E prompt (`TRY THE DOOR`) is up.

### m5. minor: the far bank's lights hang in the void
From the bridge's west end looking east, the far bank's lights are bright
round dots on posts against a black sky, with no bank under them. The
stadium and the wheel did not read as a stadium and a wheel in my frames.

---------------------------------------------------------------------------
## 2. The proofs, mine

The lane has one contest, the river (lose the car, or yourself). The rest is
free roam with nothing to win or lose.

| proof | what I did | result |
| --- | --- | --- |
| idle | hands off at every start for 5-10 s; on a pier; on the bridge | nothing happens, nothing is lost: right for a free roam (there is no contest to win by itself) |
| bad | full throttle off the end of a slipway, no answer (`river_slip.json`) | warned `The river.` 1.1 s before; black, `The river took it.`; on the quay with a car by me in under 2 s. Fair. The retry shows the double card (M1) |
| medium | the same, W let go and S + SPACE 250 ms after the warning (`river_answer.json`) | stopped 7 m short on the ramp, reversing. Won |
| good | drive the quay road and the river road at speed, into the railing (`river_quay.json`) | the railing stops the car (a crash, the car stays on the quay); never in the water without the warning |
| latency (my run of `o1_latency`) | W on foot, W in the car, A in the car | 12.7 / 11.7 / 7.2 ms: one frame each. M opens the map within 120 ms (the first shot) |
| the drive-through (`tour_drive.json`) | the owner's route, my run | 5 districts, 0 inside a wall, 0 missing, 0 late, **21 frames over 50 ms, FAIL** (M5) |
| the jank walk at the start | into the coupe's flank (stopped at 0.3 m), round its tail, into an el column, a bin, along the kerb, a door (E: rattle, `locked` for 1.5 s), the facade, a sprint under the el | all stopped where they should be; nothing walked through. The bridge's barrier and parapet stop me |
| the pad (`pad.json`, the owner's play, my run) | `?padfake=1`, the pad alone | PASS, 0 key or mouse events |
| fps | `shot=perf` vs Grand Ave from the car, one after the other, GPU 71-92 % busy before each | perf 50 fps, Grand Ave in the car 66.6 fps: **1.33x perf** |

---------------------------------------------------------------------------
## 3. Code read for cheats

- `src/vehicles/Car.js:380-391` with `src/world/cityGen.js:712, 764`: a lamp
  post "given" is removed from the physics and left standing in the picture.
  The car goes through a thing the player sees (B1).
- `src/stages/noircity/parts/stream.js:178` (`if (stage.game.shotMode)
  warmAround`): every golden frame and the owner's review frames are taken
  with the whole neighbourhood built at once. That is not what a player
  sees while streaming. It is honest for determinism, but no golden frame
  proves streaming. My live drive found 0 missing chunks, so it does not
  hide a pop today.
- `src/scenes/city.js:187`: E out zeroes the car's velocity (m3); harmless.
- The river fail (`city.js:204-211`) gives the player back a car at the
  steps, so losing the car costs nothing. That is right for a free roam
  with no heat yet. Revisit when O3's heat makes "lose the car" mean
  something.
- Nothing wins by itself. Nothing loses without the warning, except the
  bridge barrier's dead stop (B2: no tell until the last 20 m).

---------------------------------------------------------------------------
## 4. The user's asks, as I saw them in play

| ask | met? | what I saw |
| --- | --- | --- |
| "for the most part I want a new city", "mostly new assets" | **yes**, with M6 | the plan, the el's loop, Broadway's diagonal, the river road's bend, the gasworks' holders, the quay and its cranes, the park, the walled Hill are new and are not the base's chase city. The coupe and the cabin are the base's (allowed). The title screen is still the old game's (M6) |
| "You should be able to drive around" | **yes** | E into the coupe, W on the first frame (12 ms), the whole loop driven, kerbs bumped, crashes stop it, out by E. Hurt by B1 (posts) and M5 (first seconds) |
| "Keep it very much this same aesthetic" | **mostly**, not everywhere | the Grand Ave start under the el in the rain, the wet street's streaks, the lamp cones, the Hill's skyline, the quay are the reference's world. Off it: the grey bridge end (B2), green and amber neon (M4), brush-noise walls at arm's length (m4) |
| OPEN_WORLD §2: ~1.2 km, six districts readable at a glance, the el's loop, the river and one bridge, the landmarks, streamed, 60 fps | **partly** | the size (land -590 to 432, the river to 610), the el's loop, the river, one bridge, streaming (0 missing chunks, memory per the owner) and the fps ratio (1.33x perf) are there. **Not met**: districts readable at a glance from the car (B3), the clock tower seen from everywhere (M3), the bridge's end (B2). Five districts on the map, plus the river |

---------------------------------------------------------------------------
## 5. The owner's left list (docs/reports/O1.md §5), what a player feels

- **1, the hitches**: felt. I measured the same first-seconds cluster (M5).
- **2, the empty city**: felt the most of anything. No car, no man, no
  sound of anyone in a whole city at night. It is O2/O3's, but the user
  will play this first.
- **4, breakables merged**: felt as a car through a standing lamp (B1).
  This is not "O6 later". It is a pass-through now.
- **5, the el's train vanishes at a station**: not seen in my runs; a
  player who waits on a platform will see it.
- **7, variety**: felt (B3, m4). The grid is regular, and at street level
  the districts look alike.
- **8, the map**: felt (M7).
- **9, the bridge's end "by design"**: the barrier is by design; what it
  looks like is not (B2).
- 3, 6, 10, 11: not felt by a player yet (roofs, the swim fade is fine,
  the pavement graph, goldens).

---------------------------------------------------------------------------
## 6. What is good and must not be broken

- **The default start** (Grand Ave under the el, rain, the coupe at the
  kerb, one `E GET IN`): the first frame is the reference's street, and it
  tells a first-timer the one thing to do.
- **Latency**: W on foot, W and A in the car act on the first frame;
  E into the seat is eased (no camera pop); E out is eased.
- **The el**: columns are solid and a car keeps to the lanes beside them;
  the arches, the hung lamps' cones and the station read from below.
- **Collision on foot**: the car's flank, el columns, bins, the facades, the
  bridge's barrier and parapet all stop me, and nothing walked through
  anything in my walks.
- **The quay's railing** stops a car physically; **the river's fail** is
  warned, worded and back in under 2 s with a car by me.
- **The map** opens and closes on M at once and freezes the world under it;
  it matches the city (streets, the el's dotted loop, the gasworks, the
  piers, the bend).
- **Streaming**: 0 chunks missing or built late within 100 m in 5 minutes
  of driving at 60 km/h; the far masses are always drawn so no building
  pops in.
- **Doors**: `E TRY THE DOOR` comes when I face one, E rattles it, and
  `LOCKED` fades in 1.5 s.
- **The pad** plays the free roam alone.
- **Errors**: none in about 30 runs.

My plays: `tools/plays/critic/o1/` (cold_open, cold_drive, cold_map,
tour_drive, poke_grand, poke_grand2, probe_near, river_pier, river_quay,
river_slip, river_answer, latency, pad, at_<district> ×8, tower_<start>
×3, drive_kerb, lamp_through, bridge_end).

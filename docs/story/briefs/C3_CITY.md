# C3 — the city, the driving, and chapter VI The Tail

Branch `wave-c/C3-city`, port 5343. The biggest new build of the wave: a
new stage, a better car, and a chapter that is a game. The old river road
(`src/stages/riverroad/`, `src/scenes/07_tail.js`, `src/scenes/tail/*`) is
yours to quarry (its el, its market stalls, its things that burst, its
water, its cabin and wipers, the gun out of the window, `Vehicle.js`), and
the old scene is replaced.

Read `docs/story/WAVE_C.md` first (§1, §2, §4, chapter VI), then
`ARCHITECTURE.md` §10 (the stages, the vehicles, the `drive` mode), the
old lane's report `docs/story/reports/wave-b/B5.md` (what was learnt about
the car, the headlamps, the frame rate), and `src/vehicles/*`.

## What the user said
"The drive: rebuild in a new environment, really substantial rework to make
this much more fun and expansive."
- **[must]** A city, not a straight road. I can make real turns. Better
  driving than now.
- **[must]** I really tail him and can lose him.
- **[must]** Traffic and obstacles that are not trivial to dodge; some
  destruction. Not super fast.
- **[must]** When it comes to shooting his car, my shots cause the crash.
  It never crashes by itself.
- **[must]** Then I drive to Pier 9, which is a place on this map.
- **[must]** (from chapter V) No fade into the drive: the foot chase runs
  straight into the car.

What was wrong before: a straight road, a rubber band that kept him 25 to
60 m ahead whatever I did, a "mercy tyre" that burst by itself near the
end. All of that is the cheat. None of it survives.

## 1. The place: a small city at night in the rain (stage `city`)
A district you can learn in two minutes, not an open world: about six by
five blocks (blocks of 60 to 90 m, streets of two lanes with parked cars,
one wide avenue under the el, one river road along the water, a market
street, alleys that cut through blocks as shortcuts, a rail yard or goods
depot edge, the docks with **Pier 9 at the end of the river road**: its
shed, its gate, the freighter's lamps, a sign you can read). It is the
same city as the block and the Harbor Building: the el's deck and columns,
the same facades' language, lamps as cones in rain, neon, wet road with
every lamp's streak in it, black sky.
- **Landmarks make it navigable without a map**: the el (north-south, seen
  from anywhere by its lit trains), the river and its far bank's lights
  (east), a gasometer or water tower, a lit clock, a cinema's marquee, the
  crane and freighter at Pier 9. Painted signs at corners where it matters
  (`DOCKS →`, `PIER 9`). The player should be able to say where he is.
- **The edges are real**: the river, the rail yard's fence and wagons, a
  bridge up and closed, roadworks with lamps and a trench, a dead-end with
  a wall. Never an invisible wall.
- **Alive, a little**: a few cars with their own headlamps going about
  (they keep their lane, stop at a junction, brake for me, sound the
  horn, and are solid), a tram or the el train crossing on time, a few
  figures under umbrellas on the pavements who get out of the way (they
  are never run down: they jump clear), steam, a cat. Budget it: this
  must run at the frame rate of `shot=perf`. Build far things as cheap
  ink shapes, show only what the windscreen can see (the block's
  `dinerInSight` idea, and scene 3's `sight.js`), share materials, instance
  the repeated.
- **Things that give**: what a car can go through and what it cannot is
  readable. Gives: crates, fruit stalls, barrels, bins, newsstands, café
  tables, fences of plank, hydrants (a geyser), a row of milk cans, lamp
  posts that bend and go out (costly to my speed and my car), awnings.
  Does not give: walls, columns of the el, parked cars (they shunt and
  dent, and it costs me), trucks. `riverroad/parts/smash.js` and
  `smashKinds.js` are the start.
- The chase's last street (lane C6 builds the foot chase in the `backlot`
  stage and ends at a kerb with two parked cars: his sedan, my coupe) is
  **copied as the city's start**: the same facades, lamp and kerb, so the
  cut into the driver's seat is not felt. See §5.

## 2. The car: better driving
`Vehicle.js` is arcade physics on a track (`s`, `d`). The city needs a car
that turns corners: free in the plane, colliding with what is solid.
- Weight you can feel but never fight: quick to answer, a tail that steps
  out on the wet when I ask too much and comes back when I ease, a
  handbrake turn on **SPACE** (the body's big move) for the right-angle
  corner, brakes that matter. **Not super fast**: 50 to 60 km/h feels fast
  in these streets at this eye height with rain; top speed about 75.
  Corners are the game, not the straight.
- Hitting things: a glance scrapes and costs speed; a square hit stops me,
  the bonnet buckles, steam; the car takes damage in three or four visible
  steps (a lamp out, the bonnet up a little and steaming, the wheel
  pulling) and a wreck is a fail (`game.fail`, "Wrecked."). Damage mends
  at checkpoints.
- The cabin as it is (wheel in my hands, wipers, the dash as a frame, the
  road the picture: B5's report on the windscreen framing), the lens
  opening with speed, the engine note by revs, tyres on wet, the rain on
  the roof. A horn on **Q** (the room toy) that traffic answers to.
- Everything that moves on wheels is solid to everything else: **no car
  ever passes through a car**.

## 3. Chapter VI, The Tail: what the player does
Objective lines in quotes. Checkpoints between phases. Design the details
by play; this is the shape.

**a. "Don't lose him."** (about two minutes) He pulls away from the kerb
as I get in. He knows I am behind him and is trying to shake me: he turns,
doubles back, cuts through the market, runs a junction as the tram comes,
goes down an alley that I can follow through or go round. He is a driver
with a route graph and rules, on the same physics as me, **not on a
leash**: he does not slow down to wait for me. What keeps it fair is the
city: he has to brake for the same corners and traffic, the things he
knocks over mark where he went, his tail lamps are the crew's red and are
seen a long way down a wet street, and when he is out of sight there is
always a trace to read (his lamps' glow on a wall at the corner, a swinging
sign, a horn, spilled crates, wet tracks through a puddle of light). Lose
sight of him too long, or fall too far behind: first the warning ("He's
getting away."), then the fail ("Lost him."). Give him two or three
routes chosen by where I am, so a retry is not the same film.
The measure of success: an idle player loses in seconds; a careless one
loses him at the second or third turn; a player who reads the corners
keeps him.

**b. "Stop him before the docks."** The streets open onto the river road
(a long run with bends under the el, the water beside it): he makes for
Pier 9 to warn them. Now the gun: **RMB** puts the revolver out of the
window (as B5 built it), **LMB** fires. **His car goes only by my shots**:
tyres (it pulls and slows; two gone and it spins), the rear window and
the man (he ducks, weaves, loses speed), the tank or the engine (smoke,
then fire). Each hit shows and matters; the state is on the car, not in a
bar. Steering and shooting at once is the difficulty: traffic and things
in the road while I aim. I have the cylinder and one reload's worth in my
pocket (the story: I arrive at the pier with an empty gun), so shots are
worth aiming; if I run dry, ramming him at the right moment still works
(a shunt on the quarter when he is already hurt). If he reaches the pier's
gate: "He warned them." and back to the start of the river road. How he
crashes depends on what I did: into a lamp post, through the market's
last stalls, into the rail of the river: two or three ends, all caused.
A short look at the wreck (his hat, the umbrella in the back, the red
lamps going out): I get out, or I do not; either is fine.

**c. "Pier 9."** I drive there myself: the signs, the crane, the
freighter's lamps over the roofs. No pressure and no arrows: this is the
breath, and the proof that the city is a place (let it be short: under a
minute by the direct way). Park by the pier's gate in the dark (lamps
off: a small touch, **Q** is the horn so make the lamps a switch the
dash shows), E to get out: the chapter ends, VII begins at that spot.

Lane C8 may later use this stage for the race back to the diner; leave it
a way to start a drive from the pier's gate to a named place (an anchor
`city.diner` where the avenue under the el would reach the block: a
street end that reads as "the avenue goes on").

## 4. Fairness, as proofs (WAVE_C §7)
`tail_idle` (hands off: "Lost him." in under 20 s; and in phase b, he
reaches the gate), `tail_bad` (late on the brakes, a wrong turn: loses him
once or twice, a wreck once, then through), `tail_good` (wins twice in a
row; different routes on different seeds). The bot's driving goes in
`tools/lib/` (the `drive` step of `tools/play.mjs` takes a module).
Also the jank drive: into every kind of thing at 20 and at 60 km/h, into
traffic head-on and from behind, into his car, into every edge of the map,
reverse out of each: never stuck, never through, never launched.

## 5. The seam with the foot chase (lane C6)
The chase ends at my coupe's door with **E**. The cut to the city happens
inside the act of getting in (the door frame crosses the lens: black for
a few frames by what is in front of the eye, not by a fade), with no card
on black: chapter VI's card is lettered small over the windscreen as I
pull out. From CHAPTERS or `?start=tail` the usual card. The city stage
must be built before that frame: expose `game.stages.warm('city')` or the
like (build it in slices during the chase's last stretch, never a hitch),
and say in your report what lane C6 must call and when. Until C6 merges,
test from `?start=tail`.

## 6. Order of work
1. The car on a grey grid: turning, the handbrake, hitting things. Judge
   the feel first; nothing else matters if this is not a pleasure.
2. The city grey but whole, his driver, phase a losable and winnable by
   the bots.
3. Phases b and c. Then the look, block by block, the life, the sound.
4. The proofs, the frame rate, the report (`docs/story/reports/wave-c/C3.md`,
   frames and strips in `docs/story/review/wave-c/C3/`).
The kit of lane C1 (`hud.objective`, `hud.teach`, `hud.warn`, `game.fail`)
may not be merged when you start: use the names through a small shim of
your own that falls back to `hud.prompt` / `hud.say` and a plain black
retry, and drop the shim when `wave-c/integration` has `docs/story/seams/Z.md`
(`git merge wave-c/integration` then; do it at a quiet moment).

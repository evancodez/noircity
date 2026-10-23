# NOIR CITY: the merged city, played cold (2026-10-23)

A first-time player's look at `main` as of 490e9a3. The only lane merged is
**O1, the city** (the systems lanes O2, O3, O4, O5, O6 and O1b are still
running). So these are the first ten minutes of a game that is so far only a
city. Everything was played headless by real input (`tools/play.mjs`, muted, at
1440 x 900) against the server on :5370. I played first and read the lane
reports' Left lists and `O1_CRITIC.md` afterwards. Where a finding repeats one
of theirs, that is noted.

Plays: `tools/plays/critic/cold_01_first.json` to `cold_09_verbs.json` (the
first minute, the loop through every district in two legs, a walk of one block
in the Tenements and one Downtown, ten street doors, the river by car and on
foot, the bridge, the el's stair, the Straight flat out, the other verbs).
Frames: `docs/review/cold_play/1_*.jpg` to `6_*.jpg`.

---------------------------------------------------------------------------
## 0. The first ten minutes, as a stranger feels them

The title is beautiful: the diner's blue tube in the rain. BEGIN drops me on
Grand Ave under the el, a coupe at the kerb, rain, the lamps' cones and the
long white streaks in the wet street. **For about thirty seconds this is the
reference.** Then the first look down at my feet shows a mid-grey camouflage
pattern on the street (frame 1).

E puts me in the car at once. The cabin is lovely: drops on the glass, the
wiper, the mascot on the bonnet. It is also always the same picture, and about
two fifths of every frame. I drive. The el, the clock tower down Broadway, the
quay with the skyline and the fairground wheel are good to find. Between them,
the Tenements, the Yards and the Docks look the same from the seat: a black
canyon, a lamp cone, a wet road (frame 2). No car passes me, no one is on a
pavement, nothing I hit gives or breaks. At 75 km/h the car stops gaining
speed. On the Straight that is nearly fifty seconds of the same frame.

On foot I try ten doors. Every one is locked, the gym's included, and about a
quarter of them give no prompt at all. Up close every door is the same door in
the same brush field (frame 3). The mouse buttons, R, F, Q, 1, 2 and Tab do
nothing, though the title listed most of them. The river is handled well: I
am warned, I see the words, and I am back on the quay with a car in seconds.
The bridge is up, as it says.

By minute ten: **a handsome, empty, silent stage.** It is good to look at for
a few minutes. It answers nothing I do yet, and that is the most felt thing of
all.

**Against the user's words:**
- **Streets distinct?** At the skyline, yes: the el, the tower, the gas
  holders, the cranes, the Hill's trees. At street level, mostly no
  (findings 4 and 7).
- **Not copy-paste?** No. The same door, the same close-range facade, the
  same grey road and the same cabin are in every district (findings 3, 4, 8).
- **Does the world answer what I do?** Not yet. Nothing reacts (finding 1).
- **Fun to just drive?** For two minutes, for the look. It is slow (75 km/h
  top), the streets are empty, and nothing is there to weave through or
  smash (findings 1, 5).
- **What is missing most:** people and traffic, then anything that reacts:
  a post that falls, a dent, a cop.
- **The look against the reference:** the ground is grey where it should be
  ink and pools (finding 3). The Hill's trees are balloon discs (finding 7).
  The pier shed and the bridge's raised leaves are blank slabs (finding 9).
  Nothing popped in or floated in about ten minutes of driving and walking.

---------------------------------------------------------------------------
## 1. Findings, most felt first

### 1. BLOCKER (for the first playable; not an O1 bug): the city is empty and answers nothing
- **What:** no traffic, no parked cars, no people, no police, no
  breakables. Everything I did got no answer from the city:
  - 67 km/h into the bridge barrier: a dead stop. The car's internal damage
    reads 1.97 and nothing shows: no dent, no glass, no steam (frame 6).
  - A handbrake spin at 75 km/h into a facade, and three lamp posts and a
    call box clipped on the loop: the same. The posts are solid and stay
    standing.
  - Ten doors: all locked.
  - LMB, RMB, R, F, C, Q, 1, 2 and Tab on foot: nothing. My hands are empty
    and there is no gun.
- **Steps:** any start; drive five minutes; hit anything.
- **Where:** O2, O3, O4, O5 and O6 are in flight. This finding is how their
  absence is felt, and the measure their merges should be judged by (the
  north star: "the city answers everything he does, within seconds").
- **Severity:** blocker for the first playable; expected at this stage.

### 2. MAJOR: the title promises verbs the city does not have, and lists M twice
- **What:** the key line on the title with `start=city` reads `LMB FIRE,
  JAB · RMB STEADY, OTHER FIST · SPACE BLOCK, VAULT · A D DODGE · C GET LOW ·
  R RELOAD · SHIFT RUN · F SMOKE · M MAP · ESC PAUSE · SOUND OFF · M SOUND`.
  In the city none of fire, jab, steady, block, dodge, reload or smoke does
  anything, and no card says why. **M is listed twice**, as MAP and as
  SOUND, and in the city it is only the map.
- **Steps:** `?start=city`, read the title; BEGIN; press LMB, RMB, R, F
  (`cold_09_verbs.json`).
- **Where:** `src/main.js` (the key line O1 extended with `M map`); the
  title is O7's. Until O4 lands, show only the verbs that work.
- **Severity:** major. It is the first text a player reads, and half of it
  is untrue.

### 3. MAJOR (look): the street is grey camouflage, not ink and pools
- **What:** the near 10 to 20 m of every road and pavement is large
  mid-grey blotches with ragged edges between black patches, on foot and
  through the windscreen, in every district. It fills the bottom third of
  nearly every frame I took. In the reference the street is black, the
  lamps' reflections are long white streaks, and the puddles have white
  rings. The streaks and rings are here and good. The grey "dry" field
  between the puddles is what reads as a wash. Far away it is fine.
- **Steps:** `?start=city`, look round at the start (frame 1); the Hill start
  (frame 4).
- **Where:** `src/render/shaders/ground.js`, the puddle field (around line
  296: `puddle = smoothstep(...)`; `rough = mix(0.42, 0.07, puddle)`, so the
  dry ground is rough and lit mid-grey). This is the renderer, so it is the
  art director's shader lane (OPEN_WORLD §5). Try the dry ground near black
  with a rough sheen only inside a lamp's pool.
- **Severity:** major. It is the most visible place the frame leaves the
  reference.

### 4. MAJOR: from the seat the districts are one picture, and the cabin takes two fifths of it
- **What:** a frame every 165 m on a two-leg loop through all five
  districts. Downtown, the Tenements, the Yards and the Docks read as the
  same black street canyon, lamp cone and wet road (frame 2). What does tell
  them apart is above roof height or at the water: the el, the clock tower,
  the Yards' sawtooth sheds and telegraph wires (seen only end-on), the
  cranes and the quay railing, the Hill's walls and trees. At street height
  there is no stoop, stall, crate, shop window with something in it,
  painted sign or loading door that I could read from the car. The cabin
  (roof band, both pillars, dash, bonnet) is still about 40 % of every
  frame, so the same frame repeats everywhere.
- **Steps:** `cold_02a_loop_east.json`, `cold_02b_loop_west.json` (frames
  `d*`).
- **Where:** O1b (the streets distinct, more in them) is the owner. The
  seat is `CITY_SEAT` in `src/scenes/city.js`; a look-back or a bonnet view
  on a key would also help. This is the previous critic's B3, still felt
  after its fix.
- **Severity:** major. It is the user's own first note ("more distinct from
  street to street").

### 5. MAJOR: the car tops out at 75 km/h
- **What:** W held on the Straight: 15, 29, 43, 53, 61, 66, 69, 71, 73, 74,
  75, then flat at 75 km/h from 11 s on. The 970 m Straight (the races' run)
  takes about 47 s. The cabin shake and the lamps going by do not sell much
  speed. For "fun to just drive" across 1.2 km of city it feels like a
  saloon in second gear. A handbrake turn at 75 spins and stops against a
  facade, which is fine.
- **Steps:** `cold_08_straight.json` (`&car=-444.2,60,1.5708`, W).
- **Where:** `src/vehicles/Car.js` line 33, `coupe: { vmax: 22.5, accel: 5.2,
  ... }` (the base game's street-scene tune). This is O2's: the coupe
  "fast, light" wants something like 110 to 130 km/h, and something on
  screen that shows speed.
- **Severity:** major.

### 6. MAJOR (bug): about one street door in four cannot be tried at all
- **What:** facing a door at 1.3 m on Grand Ave or Centre St, no `E try the
  door` appears and E does nothing. In the Tenements the same walk works.
  Cause: `doorNear(x, z, r)` searches only the chunks that overlap the
  player's position ± r, but a door is stored in its **lot's** chunk
  (`stream.js` line 110). A lot that straddles a chunk line keeps its door
  in a chunk the search never opens. Measured at the Grand Ave start: **139
  of the 602 doors in loaded chunks** return `null` from 1.2 m in front of
  them. Examples: the doors at x = -201 on the lots of chunk `-2,0`, and the
  door at (-106, -6.1) on Grand Ave.
- **Steps:** `cold_04_downtown_walk.json` (doors 3 to 5: info `hud: ""`,
  after E `""`); frame 3 (the two downtown panels).
- **Where:** `src/stages/noircity/parts/stream.js` `doorNear` (line 144):
  widen the chunk range by the largest lot's half-size, or index the doors
  by their own position. This matters for O5: its `city:door` hangs off this
  call, so a place whose lot straddles a chunk line would be unenterable.
- **Severity:** major (silent, and lands on O5).

### 7. MAJOR (look): the Hill's trees are balloon discs, and its streets are a blank wall
- **What:** the trees in the park and over the garden walls are stacks of
  flat black discs on sticks, like lollipops (frame 4; `cold_02a` d0580).
  The user's own word for what he does not want, "balloon", fits them. A
  Hill street from the car is a featureless wall on one side and a railing
  on the other: no gate, lit window or drive between gates that I could
  read at 60 km/h. O1 left list 7 calls the trees "lumps of ink".
- **Steps:** `?start=city&at=hill`.
- **Where:** the tree builder in O1's kits (`src/city/kits/street.js` /
  `cityGen.js` specials); O1b.
- **Severity:** major for the Hill. It is the district whose identity is the
  trees.

### 8. MAJOR: every door is the same door, and every wall at arm's length is the same brush field
- **What:** ten doors in two districts are one stone frame and one transom
  in one diagonal brush texture, with only `LOCKED` underneath (frame 3).
  Walking a block, this is what a man on foot sees most, and it is identical
  everywhere (the gym's door too, under its fine `BOXING` sign). The
  previous critic's m4 was answered with the frame. The copy-paste is
  still there.
- **Where:** `src/city/kits/facade.js` (the near build's door). O1b, by the
  seeded-variant rule (OPEN_WORLD "Nothing copy-paste"): door kinds (panel,
  glazed, shop, warehouse leaf, a lit transom now and then), a step or
  stoop, a number. The brush field wants to fade to flat ink inside about
  2 m.
- **Severity:** major on foot (the user's "not copy-paste").

### 9. minor: the pier shed and the bridge's raised leaves read as blank slabs; stray tiles on the pier
- **What:** Pier 7's shed (the pier office) is a featureless black box
  with no roof line, door or window (frame 5). On the deck near the root,
  small grey rectangles hang on the planks like stray decals. From the
  approach on Bridge St the raised leaves are one black rectangle; close
  up at the barrier the lattice reads.
- **Steps:** `cold_05_river.json` (`05_pier_root`, `06_pier_mid`);
  `cold_06_bridge.json` (`01_on_bridge`).
- **Severity:** minor.

### 10. minor: the river's moments
- **What:** at the instant the car goes in, the frame is grey planes
  (inside the quay's face) with no splash before the black. Put ashore at
  the steps, the first thing I read is `The river.` again, because the
  steps are near the water and the warning comes back. Both are small.
  The warning, the words and the quick return are otherwise right.
- **Steps:** `cold_05_river.json` (`02_in`, `04_ashore`).
- **Severity:** minor.

### 11. minor: the el's stair looks climbable and is not, and nothing says so
- **What:** at the foot of GRAND - CENTRE's stair, W walks me 1.6 m into its
  footprint and stops me, with the screen black against the slab. There is
  no prompt and no word. A stair is the most "usable-looking" thing in the
  city. "Where you cannot go you see why" (OPEN_WORLD §1) wants a gate, a
  chain or `closed`. This is O1 left list 3.
- **Steps:** `cold_07_el_stair.json`.
- **Severity:** minor.

### 12. unverified: hitches and the pause
- **Hitches:** the east leg counted 214 frames over 50 ms in 4,998 (worst
  152 ms), the west leg 48 in 5,434 (worst 121 ms). Both at 1440 x 900
  headless with load 13 to 17 and three other sessions' headless Chromes
  running, so this is not attributable. Re-run `o1_drive.json` on a quiet
  machine.
- **Pause:** Escape did nothing headless (no pointer lock to release), so I
  could not judge the pause.

---------------------------------------------------------------------------
## 2. What is good and must not be lost

- **The Grand Ave start under the el** is the reference's street without its
  figures: the arches, the hung lamps' cones, the long white reflections, the
  ORPHEUM marquee, one blue tube. Keep it as the first frame.
- **The lightning:** the sky floods white for a beat and the city goes to
  silhouette. It is a good surprise.
- **The cabin's craft:** drops on the glass, the wiper, the mascot, the
  mirror. Keep it; just give the street more of the frame.
- **The orientation landmarks:** the clock tower down Broadway, the el's
  loop, the gas holders, the cranes, the skyline and the fairground wheel
  over the river road.
- **The river and the bridge:** a warning first, then the words, then back on
  the quay with a car in about 4 s. The bascule with `BRIDGE UP`, its board
  and `The bridge is up.` before the barrier. The river at night: black,
  with lamp reflections.
- **The verbs that exist are instant:** E in and out, E at speed brakes and
  then lets me out, the doors' rattle and `locked`, the map on M open and
  closed in one frame, with my mark right in every district I opened it.
- **Solid everywhere:** in the loop's 3.9 km the car never ended inside a
  wall, and on foot nothing let me through. Streaming showed no missing
  chunk, no pop and no floating thing.
- **Errors:** none in any run (`#errlog` empty in every play).
- **Colour:** restrained. Only the blue tubes and the title's red, well under
  the 2 % rule.

---------------------------------------------------------------------------
## 3. The frames (`docs/review/cold_play/`)

| frame | shows |
| --- | --- |
| `1_ground_grey_blotches.jpg` | finding 3: the first look round at Grand Ave, the grey camouflage street |
| `2_districts_from_the_seat.jpg` | finding 4: Downtown, Tenements, Yards, Docks from the seat, one picture |
| `3_every_door_alike.jpg` | findings 6 and 8: four doors, one door; the two downtown doors without a prompt |
| `4_hill_lollipop_trees.jpg` | findings 7 and 3: the Hill's disc trees, the blank wall, the grey road |
| `5_pier_shed_box.jpg` | finding 9: Pier 7's shed as a slab, stray tiles on the deck |
| `6_barrier_no_answer.jpg` | finding 1: 67 km/h into the barrier, a dead stop and nothing shows |

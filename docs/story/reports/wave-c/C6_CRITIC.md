# C6 critic, second look: chapter V The Watcher, played cold again (2026-10-03)

The code played: `wave-c/C6-chase` at f245b9f (the third owner's handover).
Played as the user will, before reading the owner's report: from the title
(`?start=watcher`, `?start=watcher.<beat>`, `mute=1`) by trusted input. First
by hand, frozen between moves (`tools/stepplay.mjs`), knowing no keys but what
the screen said, from the window to the press hall and the el; then in real
time with my own player (`tools/plays/critic/c6c_drive.mjs`: the mouse on the
course's line, W held, SPACE / C by what lies ahead; profiles idle, w, good,
bad, good with chosen misses - new: `missIn` / `missN`) and the jank walker
(`c6c_poke.mjs`). The new plays are `tools/plays/critic/c6d_*.json` (each
file's `about` says what it proves and how to run it). Frames:
`docs/story/review/wave-c/C6/critic/` (eight, 1440 x 900; the first look's
eight are in git history, 5f84d2a).

**Verdict.** The first look's two blockers are fixed and the run is better in
every way the critic asked: his car now loses me, the `[C]` card comes even
after an early SPACE, no burst, ~87 s of clean running, a second fork, the
peek as the first frame, a SPACE pressed into a fence's stop kept, the seam
into VI clean. Idle loses in every beat (12 / 12, warned first), W alone loses
in every beat (12 / 12), good hands win twice by both forks with no warning.
But two new things fail the user's own standard. **The press hall's doors have
a chest-high dark panel standing across them that every run passes through**
(the first frame of the press and of the el stretch is that slab). And **the
chase measures where I am through walls**: in the kitchen's north-west corner
or the press hall's north aisle I count as far ahead of him (no warning for
15 - 30 s standing still, and the "Lost him." that comes sends me *forward*,
skipping the press, or the press and the el), and in the delivery yard's west
end I count as back in the washing yard (warned and lost 1.5 s later with him
25 m away, for nothing I did). Fix those two first; then the kitchen's pocket,
the yard's black mouth, the cut's sticky wall doors.

---------------------------------------------------------------------------
## Findings, most felt first

### 1. BLOCKER: a dark panel stands across both press-hall doors; every run goes through it
- **What.** The kitchen's iron door into the press hall and the press hall's
  south door into the delivery yard - both on the only way, both on every
  run - have a flat dark panel across their lower 1.6 m. From the kitchen the
  iron door reads as a window over a slab (frame
  `01_iron_door_slab_across_the_doorway`, by hand at x 69.7); running through,
  the slab fills the bottom half of the frame and is gone a step later - I pass
  through it (by hand, x 69.98 -> 70.24 -> 70.53). The south door the same: the
  el stretch's first frame in both good runs is this slab at chest height with
  him and the yard above it (frame `02_press_south_door_run_through_the_slab`,
  the good run's own `good_el` shot; the press stretch's `good_press` shot is
  the iron door's).
- **Steps.** `?start=watcher.kitchen&c6Lane=E`, run to the iron door (E corridor,
  round the cook, over or round the sacks) and through it; or watch the
  `good_press` / `good_el` shots of `c6d_good_roofs_mid.json`,
  `c6d_good_row_west.json`.
- **Code.** `src/stages/backlot/parts/press.js:110-113`: the dado (`pressDado`,
  y 0.02 - 1.6, 2 cm thick) is laid along the whole south wall (`xi0 .. xi1`
  at `zi1`) and the whole west wall (`zi0 .. zi1` at `xi0`), across the south
  door (`P.southDoor`) and the iron door (`KDOOR`); only the dock is cut out.
  The same mistake, thinner: `kitchen.js:130-131`, the tiles' dark top course
  (4 cm at 1.55 m) runs `xi0 .. xi1` across both yard doors and the roller
  door. The owner's jank walk (90 / 90) faces walls; it does not look for a
  panel across an opening.
- **Wanted.** The dado (and the tiles' top course) cut round every doorway, as
  the grime above it already is; then a look through each door from both
  sides.

### 2. BLOCKER: the chase measures me through walls - no warning where I stand still, a loss that skips stretches, a loss for nothing
`course.near()` takes the course edge nearest me on the ground plan, walls or
no walls; my distance to the gate (`myD`) is that edge's, and the stretch is
advanced from `myD` (only ever forward). Wherever a dead-end or a later way runs
just behind a wall, being near that wall puts me on it. Four places, all found
by play:
- **The kitchen's north-west corner** (by the ranges; the loading yard's way
  runs behind the north wall): 2.6 s from his door, the beat jumped from
  `kitchen` to **`cut`**, the gap to -149 m; standing still, **no warning for
  ~30 s** while he ran the press hall, the yard and the avenue; then warned
  2.6 s, "Lost him." - and **the retry is at the cut's gate: the press and the
  el skipped**. By hand the same (warned when I stepped into the corner: the
  warning went off at once). Frames `03_kitchen_corner_standing_no_warning`
  (10 s standing, only the objective on screen) and
  `04_lost_in_the_kitchen_retry_at_the_cut`.
  `c6d_kitchen_corner.json` (its expect "back at the kitchen's start" FAILS).
- **The press hall's north aisle** - the straight line on from the iron door,
  along the wall, over the bundles, the way I ran by hand: at its far end by
  the folder the beat jumped to **`el`**, gap -70 m (the alley behind the hall,
  fenced off, runs behind that wall); standing, **no warning for ~16 s** (by
  hand ~15 s); lost 21.6 s after the retry (warned 2.5 s); **the retry is in the delivery yard: the press
  skipped**. `c6d_press_aisle.json` (FAILS the same expect). By hand it happened
  to me as a first-timer: I ran the aisle to its dead end (the web and the way
  on are behind me to the right, unmarked), stopped, and the warning I was in
  went away.
- **Mercer Street south of the shed** (the market's aisle is behind its east
  wall): walking the wrong way toward the garage, at (23, -94) the beat became
  `market`, the gap -35 m, no warning; a loss there restarts at the market.
  `c6d_street_south.json`.
- **The delivery yard's west end** (the washing yard's east lane is behind its
  west wall): a look round the pallets 3.7 s after the el's retry - the gap
  jumped to 113 m, "He's getting away." at once, **"Lost him." 1.5 s later**,
  with him 25 m away on the avenue. A loss with no cause a player can see:
  exactly what the user rejected. `c6d_el_west.json`.
- **Code.** `src/scenes/watcher/course.js:69-91` (`near`, `dist`: nearest edge
  by plan distance), `chase.js:178-186` (`measure`), `chase.js:206-210` (the
  stretch advanced from `myD`, never back).
- **Wanted.** My place on the course from a way I can actually be on: the
  nearest edge *with a clear line* to it (the stage's rays), or a continuity
  rule (a jump of `myD` of more than a few metres in a step is not believed;
  hold the last place until it is reached along the course), and the stretch
  never advanced by such a jump. A play for each of the four places above.

### 3. MAJOR: the kitchen holds a runner in a pocket between the table and its racks
- **What.** The long table across the middle (x 55 - 65) and a rack of pans
  standing at each end of it (`rackW`, `rackE`, 1.66 m long toward the doors)
  make a U open to the yard doors. Twice by hand I went from a yard door
  toward the lit iron door (the light the eye goes to) and was held in the
  U's corner against the rack and the table's edge, W doing nothing, turning
  doing nothing (the E side: 4 s, warned, lost him there; the W side: the
  retry faces him across the room and W straight on put me in the pocket at
  once, 3 s, warned; frame `05_kitchen_held_against_the_rack_warned`). The
  room is also very dark in its west half (grey on grey; the way out is the far
  north-east corner).
- **Code.** `things.js:313-345` (the racks' `standCol`), `kitchen.js` table
  (`KITCHEN.table`).
- **Wanted.** No dead corner on the way: the racks off the table's ends (or
  standing along it), a clear diagonal from each yard door to the iron door,
  the iron door's lamp the brightest thing in the room.

### 4. MAJOR: the cut is the new place clumsy hands lose again and again (its wall doors stop me dead)
- **What.** My clumsy player (`c6d_bad_s3.json`, seed 3, over the roofs) got
  through to chapter VI but lost **11 times, 4 of them in a row in the cut**
  (then 3 over the roofs). In each cut try it was **stopped dead against a
  locked wall door** (`wdoor12`, the N-S leg's west wall at z -114.6, just past
  the knee; 5 stops) - a door in a wall is a "thing": a grazing run into it is
  a hit (the stop, the stun, "Locked."), where the bare wall beside it lets me
  slide along. The cut's other wall door (`wdoor11`, its E-W leg's south wall
  at x 83.6) stopped the jank walker the same way. The leg is 3.4 m wide with
  a pipe (C) and sacks (SPACE) in it right after the knee. The mercy brought
  him to 3 m on the fifth try. Seed 5 (by the row) lost 8 times, at most 2 in
  a stretch. The first look's roofs problem is mostly gone (3 and 1).
- **Code.** `things.js:637-644` (`wdoor<i>`: `kind: 'locked'`, `catch: 0.15`;
  `run.js:266` hits at any approach with `q.c > 0.4`).
- **Wanted.** A wall door met at a glancing angle is a wall (slide along it);
  only met square does it stop and rattle. And the cut's knee a little wider or
  its first thing a little further on.

### 5. MAJOR: the lane ends on a black court; the washing yard is off the frame
- **What.** By hand, a little behind him (warned), I came over fence3 and ran
  on to the lane's end: in front a black court, a lit window, black walls, the
  warning (frame `06_lane_end_black_court_yard_off_frame`); the lit sheets of
  the yard - the way - are 60 degrees to the left, unseen. I ran at the black
  wall, looked round, found the sheets and lost him among them. The good player's frame at the yard's start
  (`c6d_good_roofs_mid`, `good_yard`) is the same black court. A player who is
  not on his heels has nothing to steer by.
- **Wanted.** The yard's light (a lamp, the first sheet) in the lane's line of
  sight from fence3 on, or the court lit toward the lanes.

### 6. MINOR: in the street three misses do not even warn
- `c6d_missall_<beat>.json` (every thing in the stretch run into, the right key
  a quarter second after; the play stops when the stretch ends): warned in the
  alley (3 trips), the press (3), the el (3, then off), the cut (4), the market
  (2); lost in the lane and over the roofs (warned 4.0 / 5.5 s first); **the
  street: three hits (the handcart, the arch's crates, its gate) and no
  warning**. The yard has one thing. `c6d_miss2_<beat>.json`: two misses never
  lose (warned in the lane, press, el, over, market). The first look's finding
  6 is mostly met.

### 7. MINOR: the car's retry: "Get to your car." and no car in sight
- `?start=watcher.car` (or a loss at the car): the eye is turned toward him,
  behind the fence; the frame is the fence, the gate's opening and a hedge
  (frame `07_car_retry_no_car_in_sight`). Warned at 3.6 s, lost at 6.2 s.
  Both clumsy runs lost the car once (each warned 6 - 20 s: fair), but a retry
  there should face my coupe through the gate.

### 8. MINOR: the yard's retry is brisk
- Hands off after the yard's black: warned at ~2 s (the grace), lost 1.5 s
  later (`c6d_idle_yard.json`: 3.1 s in all), and from the court's corner he is
  not in view (`idle_yard_warn`). By hand, after my loss there, he was in view
  at the lane's end and I made it: fair, but the yard is the one retry with
  under four seconds.

(Polish, not findings: in the yard the eye sometimes runs into a hanging sheet
and the frame is a flat white plane for a moment; the escape's camera is
steered round the landings by the rail. The pitch I saw jump up after a trip in
my hand play was my tool's first mouse move, not the game.)

---------------------------------------------------------------------------
## The first look's findings, checked in play

| # | first look | now | seen |
| --- | --- | --- | --- |
| 1 | BLOCKER his car waits; nothing loses me once he is in | **fixed** | W at the market: stopped in its aisle, lost by his car's clock (warned 6.6 s); idle market 10.6 s (warned 8.1); W / idle at the car lost (2.6 s); both clumsy runs lost the car once, warned |
| 2 | BLOCKER early SPACE at fence2 skips the C card | **fixed** | by hand: SPACE ~4 m early, the hop, `[C] under` held in it, C, under, on |
| 3 | MAJOR the burst | **fixed** | no burst in `chase.js`; good runs never warned, on his heels ~3 m at the car |
| 4 | MAJOR ~63 s | **met at its low end** | iron to the car stretch 86.4 s / 87.2 s (two good runs); window to seat ~97 s |
| 5 | MAJOR one fork | **fixed** | the market's middle / west aisle, both won by good hands (I did not judge how plainly the west aisle reads as a way) |
| 6 | MAJOR missing everything does not warn | **mostly** | see finding 6 (the street) |
| 7 | MAJOR the yard's door dark, narrow | **fixed** | by hand: two lamps over it, the card with it in front at ~1 m, SPACE through; I did not reach the locked door's padlock in play |
| 8 | MAJOR V does not begin on IV's frame | **fixed on V's side** | the first frame under the card is the peek (frame `08_good_first_frame_the_peek`); IV (lane C5) is not on this branch |
| 9 | MAJOR clumsy hands lose the roofs again and again | **moved** | roofs 3 / 1 losses; the cut 4 in a row (finding 4) |
| 10 | minor SPACE at a hit swallowed | **fixed** | by hand at fence1: SPACE in the hit's stop, the climb when the stop ends |
| 11 | minor the window waits; the line | **fixed** | "After him. Down the fire escape." as he runs; idle from the iron lost 13.3 s (warned 3.9) |
| 12 | minor retries: three seconds, not in view | **mostly** | retries face him (the yard's by hand, the kitchen's); the yard's idle retry is 3.1 s (finding 8) |
| 13 | minor stub blocks under fence2 | **fixed** | by hand: the slide's frames clear |
| 14 | minor press way in grey boxes | **replaced by finding 1** | the walls are grimed; the doorway now has the slab across it |
| 15 | minor on his heels the coat fills the lens | **fixed** | 3 m back: in the market he is a whole man with the crates |
| 16 | minor doors answer nothing | **fixed** | by hand in the lane: "Locked." on a wall door |

## The three proofs (mine, by real input)

| contest | idle (hands off) | W only, the mouse steering | bad | good |
| --- | --- | --- | --- | --- |
| escape (the iron) | lost 13.3 s, warned 3.9 | lost at fence1 (lane), warned 6.4 | - | - |
| alley | lost 4.1 s, warned 2.1 | lost at fence1 (lane) | seed 5: 1 | through |
| lane | lost 4.4, warned 2.4 | lost at fence1, warned 2.6 | 1 / 1 | through |
| yard | lost 3.1, warned 1.5 | lost at his door, warned 3.0 | 1 / 2 | through |
| kitchen | lost 5.0, warned 2.9 | through it, lost at the web | - | through |
| press | lost 4.8, warned 2.6 | lost at the web, warned 2.2 | 1 / 1 | through |
| el | lost 4.3, warned 2.2 | lost at the reels, warned 2.2 | - | through |
| cut | lost 5.0, warned 2.8 | lost at its gate, warned 3.4 | **4** / 0 | through |
| over | lost 4.9, warned 2.3 | lost at the jump's edge, warned 2.2 | 3 / 1 | roofs and row, through |
| street | lost 4.1, warned 2.2 | lost at the arch's gate, warned 2.4 | 0 / 1 | through |
| market | lost 10.6 (his car), warned 8.1 | lost by his car, warned 6.6 | - | middle and west, through |
| car | lost 6.2, warned 2.6 | lost (no E), warned 2.6 | 1 / 1 | E at the coupe, the cut |

- Idle: `c6d_idle_<beat>.json` x 12: **12 of 12 lost, the warning first** (1.5 - 8.1 s).
- W only: `c6d_w_<beat>.json` x 12: **12 of 12 lost, warned first** (2.2 - 6.6 s).
- Bad: `c6d_bad_s3.json` (roofs, middle aisle) through to chapter VI after 11
  losses in 201 s, `c6d_bad_s5.json` (row, west aisle) after 8 in 153 s; every
  loss warned first (1.5 - 30 s); never stuck for good.
- Good, twice by both forks: `c6d_good_roofs_mid.json`, `c6d_good_row_west.json`:
  0 losses, 0 warnings, into chapter VI; stretch times (roofs run) alley 14.1,
  lane 7.3, yard 7.8, kitchen 2.1, press 8.0, el 15.9, cut 7.4, over 9.9,
  street 9.5, market 4.4 s.
- Misses: `c6d_missall_<beat>.json`, `c6d_miss2_<beat>.json` (finding 6).
- Through walls: `c6d_kitchen_corner.json`, `c6d_press_aisle.json` (both FAIL
  their expect), `c6d_street_south.json`, `c6d_el_west.json` (finding 2).
- Jank walks: `c6d_jank_{yard,el,cut,street,market}.json` (the new places: the
  delivery yard, the avenue's hoardings, the dock's shutter, the cut's gate and
  legs, Mercer Street, the cross street, the arch, the chained gateway, the
  west aisle): nothing passed through anything there; walls stop, wall doors
  rattle. Their weakness: the walker runs straight at points and stalls on the
  first thing; it is not a full walk.

## The user's asks, in play

| # | ask | met | what I saw |
| --- | --- | --- | --- |
| 1 | No automatic vaults; SPACE or hit; C / Ctrl under | **yes** | W alone trips over the low things (a second lost) and stops dead at every fence, gate and door: lost in all 12 beats |
| 2 | W runs; controls down: I stop, he is gone, I lose | **partly** | true from every retry (12 / 12); but standing in the kitchen's north-west corner or the press hall's north aisle there is no warning for 15 - 30 s (finding 2) |
| 3 | lose on several misses or too far ahead; warning first; retry at the stretch's start | **no** | warning first every time; one or two misses never lose; four lose in the lane and over, warn elsewhere, three do not warn in the street. But a loss in the kitchen's corner restarts at the cut, in the press's aisle at the el, and the delivery yard's west end loses in 1.5 s with him 25 m away (finding 2) |
| 4 | not on a rubber band; close: things to answer, never a boost; findable | **yes** | no burst; on his heels I am held 3 m back (his body in the way, nobody wins by it); his doings when close; the mercy after failures is written and does not win; findable except from the lane's end (finding 5) |
| 5 | 90 s - 2 min of clean running; one idea a stretch; two forks; composed | **yes, at its low end** | 86 - 87 s from the iron, ~97 s window to seat; roofs / row and middle / west aisle; the el, the stair, the roofs' skyline, the arch and the market are composed frames; the kitchen is still a 2 s dark room |
| 6 | no fade into the drive | **yes** | E at the coupe: the hand on the handle, the door swings, his car's tail lamps pulling away through the door, the cabin, the seat in VI with his car ahead; no card, no black hold I could see |
| 7 | vault and slide taught once each at a calm moment, then used many times | **yes** | `[SPACE] over` held at the bins; `[C] under` held at fence2 even after an early SPACE; used through every stretch; again after two losses in a stretch |
| 8 | no jank; hands on the thing; real edges; never stuck | **no** | through the press hall's door panels on every run (finding 1); held in the kitchen's pocket (finding 3); hands on the rail in the climb, out in the trip, on the boards in a hit |
| 9 | begins on IV's last frame; every frame the ink | **partly** | V begins on the peek (the man under the lamp through the slats); IV's end is lane C5's (not here); the doorway slabs and the kitchen's flat dark west half are not the ink |

## Code read for cheats

- `chase.js:26-41, 273-274`: no burst; his pace is his own.
- `chase.js:448`: the rules stop once he is in his car - but `carClock`
  (`06_watcher.js:635`) now loses me 5.0 s after he gets in, wherever I am,
  with the warning at 2.4 s: fair.
- `06_watcher.js:446` (`capStep`): within 4.2 m my top speed is held to his
  measured pace, so the gap comes back to 3 m. Neither side wins by it; it
  only means a good runner can never close. Not a cheat.
- `chase.js:523-529` (`hisStart`, the kit's mercy): each failure in a stretch
  past the first starts him a fifth nearer, down to 3 m. Written, and it does
  not win (idle still loses from 3 m): allowed.
- `chase.js:355`: his doings only within 9 m (and some always); no boost.
- `course.js:69-91`, `chase.js:178-186, 206-210`: **the gap and the stretch
  measured through walls** - no warning where I stand (15 - 30 s), a loss that
  sends me forward past one or two stretches, a loss in 1.5 s for nothing
  (finding 2). Not a deliberate cheat; it loses without a tell and lets a loss
  skip the contest.
- `run.js`: `ctl.auto` is set only by shot mode and the debug autopilot; the
  escape's `autoTo` carries me out of the window (the E that began it). No
  automatic move in the run.
- `06_watcher.js:578` (`streetStep`): Mercer Street's car timed to the corner
  as I reach it - a hazard, not a win. `06_watcher.js:887` (`windowClock`):
  the window warns at 6.5 s, loses at 9.5 s: fair.

## The owner's Left list, as a player would feel it

1. Short of two minutes: **barely felt** - 86 - 87 s of running reads as a
   full chase; the brief's "about ninety seconds" is met at its low end.
2. Clumsy hands lose often, the roofs most: **felt, but now the cut most**
   (finding 4: 4 in a row against its wall door).
3. The kitchen two seconds: **felt** - and its pocket and its dark west half
   (finding 3) are felt more than its length.
4. The end: not felt (both clumsy runs lost the car once, warned 6 - 20 s).
5. The seam with IV: felt by anyone who plays IV into V on this branch (IV is
   wave B's); not mine to judge until C5 is merged.
6. The yard's flood: not felt; the yard's mouth is (finding 5).
7. Mercer Street's car: my runs never met it.
8. His pull, 9. the old Left, 10. the hold at 3 m, 11. old frames: not felt.

Not in the Left list and felt: findings 1, 2, 3, 4, 5. The owner's gate says
"jank walk 90 / 90: nothing passes through anything"; finding 1 is on the way
of every run.

Frame rate (once, at the end, the GPU 86 - 93 % busy with other work before
each run): the avenue under the el (`shot=chase&st=el&at=97,-70&ay=0`) 60 fps
(the cap) against `shot=perf` 48.7 at the same moment: **at least 1.23x perf**.

---------------------------------------------------------------------------
## What is good and must not be broken

- **The first frame is the peek**: under the chapter card, two fingers on the
  slats, the man under the lamp and his umbrella; he drops it and runs; the
  line becomes "After him. Down the fire escape." at once.
- **W runs and nothing runs for me**: hands off, every beat is lost with
  "He's getting away." first (1.5 - 8 s); W alone loses every beat at its
  first tall thing.
- **The held first cards**: `[SPACE] over` at the bins, `[C] under` at the
  broken fence even out of an early hop; `[SPACE] through it` only with the
  door in front; the card again after two losses in a stretch.
- **A key pressed into a stop or a hop is kept** (SPACE at the hit climbs).
- **His car's clock** starts when he is in: the starter, the warning, gone.
- **No burst; his doings when I am close**; 3 m on his heels he is a whole
  man in the frame.
- **One or two misses never lose**; good hands are never warned, by either
  fork of either pair.
- **The seam into VI**: E at the coupe, hand, door, cabin, the seat, his tail
  lamps ahead - no fade, no card.
- **The look of the new places**: the delivery yard and the avenue under the
  el with the train, the stair to the roofs, the jump against the skyline,
  Mercer Street, the arch, the market with him among the crates.
- **"Locked."** on every wall door; the yard's doors lit.

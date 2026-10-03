# C6 critic: chapter V The Watcher, played cold (2026-10-02/03)

The code played: `wave-c/C6-chase` at 7100d2f (the second owner's handover).
Played as the user will: from the title (`?start=watcher`, `?start=watcher.<beat>`,
`mute=1`), by trusted input, before reading the owner's report. First by hand,
frozen between moves (`tools/stepplay.mjs`, looking at every frame, knowing no
keys but what the screen said); then in real time with my own player
(`tools/plays/critic/c6c_drive.mjs`, not the owner's hands: it follows the
course's nodes with the mouse, W held, and presses SPACE / C by what lies ahead;
profiles idle, w, good, bad, spacer, and good with chosen misses) and a jank
walker (`c6c_poke.mjs`). All plays are in `tools/plays/critic/c6c_*.json`
(each file's `about` says what it proves and how to run it). Frames:
`docs/story/review/wave-c/C6/critic/` (eight, 1440 x 900).

**Verdict.** The core of the run is right and must be kept: W runs, nothing
goes over anything by itself, the warning always comes before "Lost him.", one
miss never loses, the hands are on the thing, and the cut into the driver's
seat is clean. But the chase **can be made unlosable**: once he is in his car
the rules stop, and his car waits for me to reach the gate - a W-only player
stopped at the market's crates stands there forever with no warning. And the
**slide is never taught** to a player who presses SPACE a little early at the
broken fence (the reflex the first card just taught): he is stopped at a
fence SPACE cannot pass, no card comes, and he loses with no idea why. Fix
those two first, then the burst that is the boost the user forbade, the length
(about 63 s of running against 90 - 120), the second fork, and the stretches
that no amount of missing can lose.

---------------------------------------------------------------------------
## Findings, most felt first

### 1. BLOCKER: after he gets into his car, nothing can lose him; his car waits for me
- **What.** In the street stretch, a W-only player (the mouse steering, never
  SPACE) runs into the market's crates and stops dead. He runs on, reaches
  his sedan at a gap of 22 m (under the 24 m warning) and gets in. From then
  on the chase's rules are off: the gap stays frozen at 22.3, no warning, no
  "Lost him.", the line still says "Don't lose him." - **40 s and on, forever**
  (frame `04_street_he_is_gone_no_warning`). And a player who is slow but not
  stopped is never punished either: the starter's clock (grind, grind, catch,
  pull away, fail) only starts when *I* reach the gate, so he sits in his car
  waiting for me however late I am.
- **Steps.** `NOIR_PORT=5346 node tools/play.mjs tools/plays/critic/c6c_w_street.json`
  (FAIL: 40 s, 0 warnings, 0 fails; its chase log: `act` 'carIn' then 'gone'
  at gap 22.3 from 12 s on). Every other stretch's W-only play loses
  (`c6c_w_<beat>.json`, 9 of 10).
- **Code.** `src/scenes/watcher/chase.js:411` (`rules()`: `if (this.act ===
  'gone' || this.act === 'carIn' || G.failing) return;`) and
  `src/scenes/06_watcher.js:568-602` (`carBeat` begins only when my progress
  reaches the `car` stretch; its clock `t` starts there).
- **Wanted.** His car's clock starts when *he* gets in, wherever I am: the
  starter (~3.4 s), the warning as it catches, gone ~2.5 s later, "Lost him."
  (back at the street's start). The rules may stop measuring the gap, but
  something must still lose me.

### 2. BLOCKER: an early SPACE at the broken fence skips the C card; stopped, untaught, lost
- **What.** My first try at the lane, by hand: the first card had taught
  `[SPACE] over`; I vaulted fence1, saw the next tall fence and pressed SPACE
  about two metres before it, as one does. The SPACE is a hop that lands me
  against the fence (it has a wire on top: no way over); I stand with my
  hands on the boards pressing SPACE, which does nothing; **no `[C] under`
  card ever shows**; "He's getting away.", "Lost him." (frame
  `02_fence2_space_no_c_card`). The card comes back only after two losses
  (at the stretch's start). The chase's own record of that try: `fence2 early
  59.53`, `fence2 hit 59.97`, lost 60.7 with `blocked: fence2`.
- **Steps.** `?start=watcher.lane` (or play on from the alley), run at the
  second fence and press SPACE 0.4 - 0.5 s before it.
- **Code.** `src/scenes/06_watcher.js:449` (`teachStep`: `if (!q || R.move ||
  R.blocked) return;`): the card's window (`t < 0.3`) falls inside the hop
  (`run.js` `decide()`, the "a press with nothing for it to meet (or the wrong
  key)" branch starts the hop at once), and then I am `blocked`, which also
  returns. The same hole is open for every first card (the first jump, the
  first shoulder, the first slide down) if the player is mid-move or stopped
  when its window passes.
- **Wanted.** A first card is shown at the latest when I am stopped against
  its thing (blocked at an `under` thing: `[C] under`, held), and a hop into
  an untaught thing does not swallow it.

### 3. MAJOR: when I get close he gets faster (the user said: never a boost)
- **What.** Within 7 m he gains +0.8 m/s for up to 3 s ("the fear's burst",
  `RULES.burst`/`close`/`stamina`), recharging when I fall back past 9 m. The
  user's ask is that when I am close he does things I must answer, *never a
  boost*. In play: from the press hall on, a good runner is on his heels (gap
  -1.3 to 5 m in both my good runs) and can never close; with the speed cap on
  my side within 2.6 m (`capStep`) the gap is pinned. The tricks he pulls (the
  bins, the rack, the bundles, the barrow) are the answer the brief asked for;
  the burst is extra and is the forbidden thing.
- **Code.** `src/scenes/watcher/chase.js:29-31, 243`.
- **Wanted.** No burst. If he must keep his lead at the heels, more doings
  (the brief's gate to shoulder, the bin kicked at me), not speed.

### 4. MAJOR: still short: ~63 s of running, ~75 s from the window to the seat
- **What.** Both my good runs: the alley's start to the car stretch 63.6 s
  (game time, 11.0 -> 74.6) and 63.7 s by the row; E at the window to E at
  the coupe ~75 s. The ask: about ninety seconds to two minutes of clean
  running. Stretch by stretch (good, roofs): alley 13.7 s, lane 6.8, yard 7.0,
  kitchen 2.2, press 8.1, el 8.2, over 11.0, street 6.7. The kitchen is a
  two-second corridor.
- **Steps.** `tools/plays/critic/c6c_good_roofs.json`, `c6c_good_row.json`
  (the `stretches` times in their result).
- (The owner's Left 1 says the same; it is the user's ask, not a wish.)

### 5. MAJOR: one fork where I choose, not two
- **What.** The roofs or Tanner's Row is a real choice of ways (both won,
  both ~10 s for a good runner). The yard's two lanes are not a choice: one
  door is locked, so it is a guess at the lane he took, and the wrong one is
  a dead end. Alley, lane, kitchen, press, el and street have one way each.
  The ask: at least two forks where I choose (the short way that asks more,
  or the plain long way).
- **Wanted.** A second fork of the same kind (both ways open, visibly
  different): the press hall's south line (the owner's Left 2), or the
  market's rows, or the el's station.

### 6. MAJOR: in half the stretches, missing everything does not even warn
- **What.** Played well except for chosen misses (run into the thing, the
  right key a quarter second after): **one miss never lost him** (9 cases:
  fence1, fence2, the yard door, the web, the pipe, the jump, the tank, the
  market's crates, the bins) - good. But **all of a stretch's things missed**
  lost him only in the lane and over the roofs; in the alley (bins and
  crates), the press (web and conveyor) and the street (crates; the barrow
  and the car did not come) there was **not even the warning**. There the
  only way to lose is to stop. The ask: lose on several misses.
- **Steps.** `c6c_missall_alley.json`, `c6c_missall_press.json`,
  `c6c_missall_street.json` (0 warnings, 0 fails) against `c6c_missall_lane.json`,
  `c6c_missall_over.json` (lost, warned 3.1 - 3.7 s first).
- **Wanted.** Those stretches' things cost enough (or start closer to the
  line) that two or three misses bring the warning and four or five lose.

### 7. MAJOR: the yard's door: a black corner, a narrow target, SPACE dead beside it
- **What.** By hand, in the lane he took (E), I followed him through the
  sheets (the yard is a grey blown-out fog with walls of white sheets; it was
  hard to tell where the lanes were). The `[SPACE] through it` card came up
  while I faced a dark corner, the door 3 m off to my right under a lamp. I
  steered at the door, pressed SPACE a little early (a hop), came down against
  the wall beside its 1.1 m frame; there SPACE and E do nothing and the
  screen is black boards and "He's getting away." (frame
  `03_yard_door_beside_it_black`); I lost him there (`doorE hit 77.5`, lost
  80.4, unseen 2.5 s). The locked door's only tell is a rattle sound and a
  tiny jolt: with the sound off nothing says "locked".
- **Wanted.** The slammed door lit and in front of me when its card comes;
  a SPACE pressed against the wall within a step of his door takes the door;
  the locked door seen to be locked (a chain, a padlock in the lamp's light).

### 8. MAJOR: the chapter does not begin on chapter IV's last frame
- **What.** From IV's quiet (`?start=gunfight.quiet`; on this branch IV is
  wave B's) the last frame is the office's bright lit blind from inside the
  room with the revolver up; V's card then opens on a near-black blind with a
  lamp's glow, and **the man under the lamp is not in the frame at all** until
  E parts the slats (frame `01_first_frame_no_man`). The ask: V begins on the
  frame IV ends on - the man under the lamp seen through the blind.
- **Steps.** `tools/plays/critic/c6c_iv_seam.json`, `c6c_idle_title.json`.
- **Wanted.** V's first frame the man under his lamp through the slats (with
  C5 on IV's side: agree the frame).

### 9. MAJOR: the roofs are where clumsy hands lose again and again
- **What.** My clumsy player (late eyes, wide timing, a third of the things
  fumbled, W let go now and then; seed 3) got through - 9 losses in 140 s -
  but **5 of them in a row over the roofs**, each at the light well (the jump
  missed or the wrong key, then the standing jump's catch and haul, with a
  moment of W let go). One missed jump alone puts a good runner into the
  warning (`c6c_miss1_over_edge.json`). Nothing tells the clumsy player that
  the row is there: he follows the man up the stair every try.
- **Steps.** `tools/plays/critic/c6c_bad.json` (its log: `over` fails at
  104.4, 116.8, 130.0, 142.4, 154.8; the `[SPACE] jump` card again after the
  second, as it should).
- **Wanted.** Over the roofs a fumble at the well costs about what a fumble
  elsewhere costs; the passage to the row lit at the stair's foot.

### 10. MINOR: a SPACE pressed at the moment of a hit is swallowed
- By hand at fence1 (no SPACE, ran into it): pressed SPACE as I hit it,
  nothing for a second, the second press climbed. The hit's stop lasts 0.5 s
  (`run.js` `hit()`), a press is remembered 0.15 s (`TIMING.BUF`): any press
  in the first ~0.35 s of the stop is lost. A player mashing SPACE gets
  through; one who presses once at impact thinks the key is dead.

### 11. MINOR: the window waits forever after he runs; the line says "Check the street."
- After he drops the umbrella and runs, the prompt is `E the fire escape`
  and the line still says "Check the street." for as long as I like. Waiting
  30 s there costs nothing: on the iron he starts again from beside the lamp
  (`c6c_window_wait.json`: he is `gone` from the office's street, then placed
  at 4.5 m of his way at the iron; `06_watcher.js:820-823`). The line should
  change to the chase's ("After him.") the moment he runs.

### 12. MINOR: a retry gives about three seconds to find him, and he is often out of sight
- Hands off after a retry's black: warned ~3.3 s after it lifts, lost
  3.8 - 4.5 s after (alley, over; `c6c_idle_<beat>.json`, warned 1.9 - 2.3 s
  first). At the lane's and the yard's retries he is not in view at all (over
  the fence, round the corner). Fair, but a player who looks round to orient
  is warned at once. At the alley's T after the first vault there is no sign
  of which way he went (the only open way is right; nothing rocks or swings).

### 13. MINOR: the slide under the broken fence goes through a row of black blocks
- Under fence2 at slide height a row of black cubes stands on the ground in
  my way and I pass through them (frame `05_slide_through_stub_blocks`):
  the boards' broken stubs (`src/stages/backlot/parts/things.js:582`, boxes
  0.05 x up to 0.2 x 0.12 m on the ground), seen side on they read as cubes,
  not splinters, and they are not solid.

### 14. MINOR: the press hall's way in reads as grey boxes
- Through the kitchen's iron door the first frame of the press is flat
  grey untextured slabs and a pale cylinder (frame `06_press_entry_grey_boxes`).
  Further in, the hall is good (the presses, the windows).

### 15. MINOR: on his heels the camera is at his back and his pull reads as a wave
- In the market, close behind him, his arm flung up to the barrow fills half
  the frame from half a metre (frame `07_on_his_heels_market`); the barrow
  itself is out of frame. A step more distance (or the pull toward the
  barrow, low) and it reads.

### 16. MINOR: the doors of the place answer nothing
- The doors along the alley, the lane and the yard's walls take no E and no
  SPACE (only his door, the kitchen's iron door and the locked doors are
  things; nothing else is in `interact`). WAVE_C §1.7: a small answer for
  anything a curious player tries (a rattle, "locked").

---------------------------------------------------------------------------
## The three proofs (mine, by real input)

| contest | idle (hands off) | W only, the mouse steering | bad (seed 3) | good |
| --- | --- | --- | --- | --- |
| escape (the iron) | lost 13 s, warned ~3 s first | lost in the lane at fence1 | - | - |
| alley | lost 3.8 s after the black, warned 1.9 s | lost at fence1 (lane) | through | through |
| lane | lost, warned | lost at fence1 (gap 36) | through | through |
| yard | lost, warned | lost at his door (2.5 s warned) | lost once (at the yard's mouth), through | through |
| kitchen | lost, warned | lost at the web | through | through |
| press | lost, warned | lost at the web | lost once, through | through |
| el | lost, warned | lost at the pipe | lost once, through | through |
| over | lost 4.5 s, warned 2.3 s | lost at the parapet | **lost 5 times**, through | roofs and row, through |
| street | lost, warned | **never lost (finding 1)** | lost once, through | through |
| car | lost 9.1 s, warned 4 s (his starter) | lost (no E) | E at the coupe | E at the coupe, the cut |

- Idle: `c6c_idle_<beat>.json` x 10: **10 of 10 lost, the warning first**.
- W only: `c6c_w_<beat>.json` x 10: **9 of 10** (street: never).
- Bad: `c6c_bad.json`: through to the seat after 9 losses (yard 1, press 1,
  el 1, over 5, street 1), never stuck for good, every loss warned first.
- Good, twice in a row by both forks: `c6c_good_roofs.json` and
  `c6c_good_row.json`: 0 losses, 0 warnings, into chapter VI.
- One miss / all misses: `c6c_miss1_*.json`, `c6c_missall_*.json` (finding 6).
- The first-timer's SPACE at the broken fence: hand play (finding 2);
  `c6c_spacer_lane.json` / `c6c_spacer_early_lane.json` are my attempts to
  script it (a scripted press reads the thing late and the held card comes
  first; a human pressing at 0.4 - 0.5 s does not get it).

## The user's asks, in play

| # | ask | met | what I saw |
| --- | --- | --- | --- |
| 1 | No automatic vaults; SPACE or hit; C / Ctrl under | yes | W alone stops dead at every tall thing; the low ones trip me over them with a second lost; slides only with C / Ctrl |
| 2 | W runs; controls down: I stop, he is gone, I lose | **no** | true in 9 stretches of 10; in the street, stopped at the crates after he is in his car, never lost (finding 1) |
| 3 | lose on several misses or too far ahead, warning first, retry at the stretch's start | partly | warning first every time (1.9 - 14 s), retry at the stretch's start; one miss never loses; but several misses lose only in the lane and over the roofs (finding 6) |
| 4 | not on a rubber band; when close, things to answer, never a boost; always findable | **no** | a +0.8 m/s burst within 7 m (finding 3); his car waits for me at the gate (finding 1); the tricks are there and good; findable most of the way (pale coat under the lamps), not at the retries |
| 5 | 90 s - 2 min of clean running, stretches with one idea, two forks, composed | **no** | ~63 s of running (finding 4); one real fork (finding 5); the stretches each have an idea; the yard, the el's arches, the roofs are composed |
| 6 | no fade into the drive | yes | E at the coupe's kerb door, the hand on the handle, the door swings, the cut on the door frame into the seat; no card on black |
| 7 | vault and slide taught once each at a calm moment, used many times | partly | SPACE at the bins (held, calm) - good; C skipped by an early SPACE (finding 2); both used many times (vaults 7 kinds, slides 6) |
| 8 | no jank; hands on the thing; every edge real; never stuck | partly | palms on the rail in the climb, on the boards in a hit, on the wet in the crawl, on the parapet in the catch; fences full width, parapets real, the cooks and pressmen solid; through the slide's stub blocks (13); stuck for good in the street (1) |
| 9 | begins on IV's last frame; every frame the ink | **no** | V opens on a dark blind with no man (finding 8); the press's way in is grey boxes (14) |

## Code read for cheats

- `src/scenes/watcher/chase.js:411`: the rules return once he is in his car
  (`carIn`, `gone`): nothing can lose me after that point (finding 1).
- `src/scenes/06_watcher.js:568-602`: the car's clock starts when I reach the
  gate, not when he gets in: he waits for me in his car (finding 1).
- `src/scenes/watcher/chase.js:29-31, 243`: +0.8 m/s for him within 7 m
  (finding 3): a boost when close, against the ask.
- `src/scenes/06_watcher.js:820-823` (`outOfOffice`): however long I wait at
  the window, he is put back 4.5 m from his lamp when I reach the iron (a
  wait for me at a beat with no contest; finding 11).
- `src/scenes/06_watcher.js:424-434` (`capStep`): within 2.6 m my speed is
  held to his (not a win for either side; it keeps me from running through
  him, and pins the gap).
- Fair and written down: `Chase.held` (`06_watcher.js:225`: both held under
  the card and the fail's black), `RULES.grace` 1.6 s after a retry, the held
  first cards (the kit's crawl), the card again after two losses
  (`06_watcher.js:314-320`), Mercer Street's car timed to reach the crossing
  as I do (`streetStep`: a hazard, not a win). No enemy that misses, no
  automatic move in the run (`ctl.auto` is set only by shot mode and the
  debug autopilot).

## The owner's Left list, as a player would feel it

1. Short of ninety seconds: **felt** (finding 4).
2. The press hall's one way: felt mildly; the bigger lack is a second fork
   (finding 5).
3. Programs at the cut: not felt in my frames (the door frame's black hides
   it); not measured by me.
4. Frame rate on a busy GPU: my one measure (the GPU at 100 % from other
   processes before and after): the avenue under the el 34.6 fps against
   `shot=perf` 27.7 at the same moment, **1.25x perf**.
5. The train glimpsed, not seen; 6. the kitchen's plaster; 7. the dog of
   capsules; 8. his clips: not felt in play.
9. The four-second stand-still at the stair's foot: not seen.

Not in the Left list and felt: findings 1, 2, 3, 6, 7, 8, 9.

---------------------------------------------------------------------------
## What is good and must not be broken

- **W runs and nothing runs for me**: let go and I slow to a stop; hands off,
  every stretch is lost with "He's getting away." up first (1.9 - 4 s), back
  at that stretch's start after a short black.
- **Nothing goes over anything by itself**: a tall fence stops me dead with
  my palms on the boards until I climb it (SPACE), go under (C) or push the
  door; the low things trip me over them at a cost.
- **One miss never loses him** (nine kinds of thing tried); a good runner
  never even sees the warning, by either fork.
- **The hands are on the thing**: the climb's palms on the top rail, the
  crawl's on the wet, the catch's on the far parapet, the hit's flat on the
  boards.
- **The bins card** (held, calm, the bins visibly across the alley) is the
  model for every first card.
- **The fork**: the roofs (the stair, the jump, the tank, the shed's slide)
  and Tanner's Row (the dog, the truck's plank) are both real and both won.
- **The washing yard's picture** (frame `08_good_yard_sheets`: him a pale
  coat between lit sheets), the el's arches and lamps, the roofs with the
  towers beyond, the kitchen hands and pressmen flattening (and solid).
- **The seam into VI**: E at the coupe, the hand on the handle, the door
  swung open, the cut inside the movement, the seat - no fade, no card on
  black.
- The retry is quick and puts me where the stretch begins, him ahead along
  his way, what he pulled down put back.

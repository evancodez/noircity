# O1c — the streets, the follow-up (lane report, the handover)

Branch `ow/O1c-streets` from main at 7040333 (after O3, O5, O7); main merged in
again at b2228c7 (O6b's car damage, O7 and O3 together, O9's brief). Brief:
`docs/briefs/O1C_STREETS.md`. Port 5378. What a player meets, how it is built,
the proofs, what is left. **Section 0 (after the critic) is the current state;
where sections 1-6 say otherwise (the kick, a car's 'dent' that was a sound, the
0.5 s beat, the duplicate punch), section 0 wins.**

---------------------------------------------------------------------------
## 0. After the critic (`docs/reports/O1c_CRITIC.md`)

Each finding, in the order a player feels it, played on the final code:

| finding | now | proved by |
| --- | --- | --- |
| **B1** a jab at a car only a sound | **fixed.** The tin dents where the fist met it (`CarDamage.dent` of O6b, r 0.32 m, 4.5 cm; the second blow 0.42 / 7 cm), the paint scarred pale round it (its scar strokes), the body rocks on its springs away from the blow (roll or pitch, 0.03 rad at a jab; the roam's parked car is stepped while it rocks: `scenes/city.js`), the dent sound, and a car that is not mine (never driven by me: `v.driver !== 'player'`) is a crime, `vandal`, once in 4 s - the street sees it as it sees a bin go over (seen by a civilian: he goes to tell; by a cop: HEAT 1) | the fist walk's car: `dents +1, rock 0.031 rad, crimes: vandal`; the same pose before and after three jabs (frame `after/5`, bottom: the scars pale on the door) |
| **B2** a thing knocked over goes ink on ink | **fixed.** What O1b's dressing drops out of its merge is drawn by its pool in the dressing's own material (`props` of `parts/dressing.js`: the floor of light) with the set's paper rim, and its kind's grey (the mean of its pieces' levels), never under the tin's 0.09 - the bench and the single dustbin too (`parts/props.js`). A round thing, a bicycle struck high topples (the fist's spin across the blow) instead of hopping back onto its foot | the fist walk's new check `__seeLying`: from 3 m on the open side, two frames of the canvas, with the instance and without it, the share of its drawn box changed 20 levels or more: dustbins 37 %, a dustbin 36, board 38, churns 40, barrel 53, crates 59, drums 47, bench 39 (the old material on the same dustbins: 1.7 %). Bicycle 6 % (a frame of thin lines: its threshold 5 %), rain barrel 40 (10 %, its box holds its downpipe) - both looked at in frames. Frame `after/5`, top |
| **M1** the kick hidden, footless, C meaning nothing | **the kick cut** (the critic's first option). C (or Ctrl, the pad's circle) held changes nothing now. **The second blow** instead: a thing that shook to a jab (bench, oil drums, barrels, a handcart, a stall) goes over to the next jab within 2.5 s, with the eye's lunge and the wind of it - hitting again is all a player has to find. Crates are still shoved over whole by a jab (to planks only by a car or rounds now). C on foot is still nothing in the city (the controller's walk mode has no crouch; not this lane's) | fist walk: `oil drums, twice`, `barrels, twice`, `a bench, twice`, `a handcart, twice`: over; one jab: shake. Pad play: `a bench, twice` by R2 |
| **M2** each crime logged again as a 'punch' by 'me' | **fixed by the merge** (main's `standins.js`: O7's stand-in listeners stand down under O3's crime bus) | the crime log after a knock: `vandal:player` only; after a lamp post double jab: nothing |
| m1 0.5 s of swallowed presses after a hurt hand | **fixed**: the beat 0.25 s (`THING.beat`) | a lamp post jabbed twice 0.35 s apart: two swings, two rings, both hurt |
| m2 a bottle at my feet takes the jab meant for the bins | **fixed**: a bottle on a step is hit only looking down at it (pitch under -0.3; at the feet it is out of view otherwise) | the critic's c11 walk at the dustbins (-148.6, -19.6) with presses every 0.4 s: whiffs, then `bins:over`; the bottle target looking down: broken |
| m3 the firehouse's red out of the frame at arm's length | **fixed**: the middle panels' top rail of each leaf in the company's red, at 1.74 m (the eye) | the critic's pose (1.7 m off the doors): **1.21 %** colour, all red (was 0.00). Frame `after/6` |
| m4 the Hill not warm on foot | **partly.** Its globes' glass burns amber-yellow (the far tiles' lamp mouths, `parts/far.js`: `[2.0, 1.65, 0.7]` - the registry amber's reflection printed red in the wet), the pools' light deeper amber (1.0 / 0.6 / 0.27) and at 0.6 of the power so the wet keeps it. Hill Rd at the critic's pose: **colour 0.62 %, amber 0.18** (was 0.09), the globes plainly amber; but the columns the globes leave in the water are mostly white with a pink edge, and the lamp cones are white (the cone shader writes a volume, not a colour) | frame `after/6` (the park: old, new); `hill` probe 0.62 % |
| m5 dustbin groups read the same | **fixed**: by the hash, two or three cans, a gap where one was taken, the last pulled out of line, a lid askew or **off** (lying against the can's foot, the mouth black), the cans' greys differing | Hester St (frame `after/6`) |
| cheat: the proof counted `car:dent` by its name | **removed**: the car passes on the damage record (`D.scar` slots in use +1), a sampled rock over 0.004 rad, and the `vandal` crime | `tools/lib/o1c_fist.mjs` |
| cheat: 'everything resting' true for things no one can see | **removed**: every 'over' is also `__seeLying` (above) | same |

**Not changed, where I agree with the critic but it is not mine**: losing the
revolver for a knocked bin is O3's arrest rule. **Where the critic's finding
stands as written**: none disputed.

### 0a. The runs on the final code
- **The fist walk** `o1c_fist.json`: **PASS, 29 of 29** (the kicked crate
  target gone with the kick): every 'over' lying, resting and seen (numbers
  above), shakes, rings with the hurt hand, glass crack then gone, wall, door,
  the coupe dented and rocked and a crime, the bottle, the bin a cop saw:
  `vandal@cop`, **HEAT 1** 1.5 s after the press. Press to the swing 1.8-47 ms.
  #errlog clean. (The bottle's look-down rule came after this run; the bottle
  target and the critic's c11 bins were run again after it: both as expected.)
- **The fist by the pad** `o1c_fist_pad.json`: **PASS** (dustbin over, lamp
  post rings and hurts, a bench over to the second R2, glass cracked then
  gone), **0 key or mouse events**.
- **Golden** against main's frames after the merge: game one's **39 of 40
  identical**, `title` changed (its backdrop: the near ground darker) and
  re-accepted; the city's 17: **6 identical** (`city_tenements`, `city_quay`,
  `city_straight`, `city_clock`, `o5_bar`, `o5_gym`), **11 re-accepted**: the
  near ground darker (`uNearK`, this lane's look pass) in every street frame
  and O6b's beds, `city_park` also its Hill globe amber, `city_gasworks` and
  `city_o3_police` a speck each. Colour of all re-taken: **max 1.72 %**
  (`city_grand_car`), none over 2 %.
- **Errors** (`tools/errors.sh`): `scene=city&beat=roam&at=` grand, hill,
  tenements, docks, and `start=city`: **clean, all five**.
- **fps** (`MOMENTS=city tools/fpstable.mjs 5`, at a load of 7-18, other lanes
  capturing): Grand Ave from the car **1.26 x** shot=perf, the el's corner
  1.37, Broadway 1.88, the Bowery 1.94, the quay 1.53 - every spot over perf;
  draws 670 / 599 / 930 / 671 / 555 (unchanged: the fallen things' material
  is one more program, no draw).
- Not re-run after the critic: `o1b_jank`, `o6_city`, `o3_witness`,
  `o3_crowd`, `o1_drive`, `pavecheck` (nothing of the graph, the walk or the
  cars' driving changed; the merge brought O6b's damage, whose own plays ran
  on main).

### 0b. Left after the critic (most felt first)
1. **The Hill's water**: the globes are amber, but the columns they leave in
   the wet print white with a pink edge, and the cones are white (the cone
   pass carries no colour). A warm column needs the ground shader's lamp
   reflection or the cone's volume to carry a hue - a renderer lane's.
2. **A bicycle knocked over** stands on its wheels where it lands more often
   than not (tilted 0 in both walks; it tumbles and lands upright): it reads
   as moved, not fallen.
3. **C on foot** means nothing in the city (no crouch in the walk mode): the
   rulebook's 'get low' on foot is the controller's, not this lane's.
4. **A car punched is a crime only if I never drove it** (`driver !==
   'player'`); there is no car alarm (1940s) and no owner yet - O2's traffic
   brings drivers: `city:fist { thing: 'car', depth, heavy }` is the hook.
5. **Crates go to planks only by a car or rounds** now (the kick took them;
   the second blow cannot reach a crate already shoved over).
6. The earlier Left (section 6) items 1, 4, 6, 7 stand; 2 (no foot) and 5 (the
   duplicate punch) are gone with the kick and the merge.

---------------------------------------------------------------------------
## 1. What exists now (as a player meets it)

**People walk on the pavement, not into the buildings.** O1's pavement graph
walked every side of a block's kerb polygon, the sides with no road too: where
two cells are one block, a leg ran along the block's inside, through the lots
(194 legs through a solid, 17 corners inside a building, O3's example among
them). Now (`src/world/graph.js`):
- only a kerb's side is walked, and only a kerb's side is moved in - a side with
  no road keeps its line, so the walk along a kerb runs on to the next cell's
  corner on that line (the two cells' corners are the same point);
- the walk's line is in the pavement's clear middle - 1.2 m in on a lane's 2 m,
  2 m on a street's 3.5, 2.7 on an avenue's 5 - past the kerb's lamp posts
  (0.7 m in) and street trees (1.25: O1's 1.2 m line ran through every tree),
  short of the things by the wall;
- a dead end's corner that stood in the building past it (or a garden's wall
  on the cell line) is stepped out along its own walk;
- a walk leg with a thing on its line (a newsstand, a bench, crates, a lamp
  post, a tree, a bicycle) goes round it: off the line a metre before, along
  it clear of the thing (on the side with pavement, or a lane's cobbles, or the
  road's gutter when the pavement is full), back on a metre after; a thing met
  on the way round joins the group and the way goes round it too, never round
  a building. These corners are marked `round`; O3's `pavWalk` and `awayPath`
  do not count them as steps (a walk of five corners is still five corners of
  the block).
`node tools/pavecheck.mjs` walks every leg as a man of 0.35 m walks it:
**0 legs through a lot, 0 walks into a thing, 0 corners in a solid** (2,893
corners, 2,238 of them steps round a thing; 3,255 legs). O3's leg-by-leg
check of a witness's way (`People.boxWay`) is kept: its comment does not say
it may go (the brief's rule); it now never finds a blocked leg.

**Round things may slide you round them.** The jank walk's rule
(`tools/lib/o1_city.mjs`, `expect: 'round'`): a barrel, churns, a bucket of
flowers, dustbins, drums, a mailbox, a tree, a lamp may stop the man or slide
him round it, never let him into it (his nearest to its middle sampled through
the walk). The flower bucket stays round (four tins in a ring: it is round);
the stands that are boxes (fruit, newsstand, booth, cart) were boxes already.
`o1b_jank`: **20 of 20**.

**The street answers a fist** (`src/world/fistThings.js`, hooked into O7's
`night/fist.js` before the whiff). LMB (or RMB) with empty hands at a thing in
reach (1.25 m, in a 0.62 rad cone); with **C held (the pad's circle) a kick**
(no foot in the hand kit: the eye dips and lunges, the fists come up, the foot
lands 0.12 s later, a stronger and lower push, 1.45 m). The swing is on the
press (2-35 ms press to the swing); the answer at the jab's contact mark:
- what gives goes over (`Smash.hit(..., 'fist')`, O6's set, nothing new in it):
  a dustbin, dustbins, a sandwich board, a bicycle, a bucket of flowers, a
  barrel, a rain barrel, churns; crates are **shoved over whole** by a jab
  (`'body'` under their break speed) and **kicked to planks**; oil drums,
  barrels, a bench, a handcart go over to a kick and shake to a jab (a thud);
  a fruit stand and a newsstand shake;
- iron that does not give **rings and stands, and hurts the hand**: a lamp
  post (`c3_post`), a hydrant, a call box, a mailbox, a booth, a street sign -
  the hurt clip (the flinch), a grunt, the view kicked, and a beat of 0.5 s in
  which the next press does nothing; a kick at iron rings without the hurt;
- shop glass **cracks at the first jab and goes at the second** (the set's
  glazing: `S.glaze`, `Glass.hit` power 0.6, then `shatterPane`);
- a wall hurts the hand (grit off the stone, `w_hitWall`); a street door is
  knocked on (`b9thunk`); a car's tin dents (`c3_dent`);
- a bottle lying in front of my feet (on a step) is knocked off and breaks
  where it lands (the glass, `bottleSmash`; back after five minutes unseen, as
  a taken one); cash, rounds or a matchbook hop and lie where they land (found
  once a save by where they were laid: `it.sk`);
- what lies by a thing that goes over (any cause: a car, a round, a fist, a
  blast) is knocked loose (`items.knock`, on the set's `smash` event).
**The city answers**: a thing knocked over is a crime of its own -
`crime.emit('vandal')`, level 1 (`LEVEL.vandal` in O3's `crime.js`; the street
sees it as it sees a smash: `People.witness`). Seen by a cop: the whistle and
HEAT 1; by a civilian: he goes to tell it. Glass, stalls and newsstands stay
O3's own 'smash' through the set's event (`by: 'fist'`).

**The districts' look** (O1b's Left):
- **Mott St beside Orchard St, Eldridge Ln beside Pell Ln** (the Tenements'
  lanes that read as one): Mott and Eldridge are grey stone with flat lintels
  and lanterns on brackets (Mott's trades the barbers', the laundries', chop
  suey and the tobacconist); Orchard and Pell keep their brick arches and the
  shades hung on wires. With O1b's accent blades (Mott blue, Orchard amber) and
  uniques the pairs are told apart at a glance (review frames 2-4).
- **A warmer Hill**: the Hill's lamps (`districtAt === 'hill'`) light their
  pools amber when they hold a real light (`lamps.js`: the pool's SpotLight
  colour 1.0 / 0.76 / 0.46 - the ink keeps a saturated light's colour on the
  wet): the cobbles of Hill Rd's lane and the gate piers' pavements under a
  warm pool, with O1b's amber gate lanterns. Bridge St on foot 0.16 % colour
  (was 0.05); the park 0.09 - 0.16 %.
- **The firehouse's doors at arm's length**: each leaf has three raised panels
  (a lit rim round a field proud of the leaf), the brass (a pull at the meeting
  edge with its plates, three hinges, a kick plate), and the company's red as
  one thin line under the lights; 0.95 % colour filling the frame at 3 m.
- **The near ground darker between the pools**: the near field's grey wash
  (the storm sky in the rain-beaten water at the eye's feet) at 0.35 of the
  base's in the city (`uNearK` on the ground material, default 1: game one's
  street unchanged). The lamps' columns and the puddles' sheen are kept.
- **Doyers Ln's red halved in the water** (`uRedCut`, a rect where a red
  sign's column is halved): Doyers on foot 0.88 % (O1b measured 1.48-1.70).

---------------------------------------------------------------------------
## 2. How it is built

| file | what |
| --- | --- |
| `src/world/graph.js` | the walk: `insetPoly` by side, only kerbs walked, `walkIn` (the line by the street's pavement), `mendWalk` (corners out of solids, the ways round things: `round` corners), `walkSolids(C)` / `WALK_R` (exported for the tool) |
| `tools/pavecheck.mjs` | the graph's check (no browser): legs through a lot, walks into a thing, corners in a solid |
| `src/world/fistThings.js` | `thingAhead(G, kick)`, `thingStep(G, R, arm)`, `thingTick(G, R)` (the kick's foot, the hurt's beat); events `city:swing` `{ thing, kick }` on the press, `city:fist` `{ thing, how, kick, hurt }` at the contact |
| `src/stages/noircity/parts/items.js` | `ahead(eye, fx, fz, reach)`, `knock(it, dir)` (the hop, a bottle's break), knocked loose on `smash` |
| `src/city/kits/uniques.js` | the firehouse's panels, brass and red line |
| `src/world/streets.js` | Mott's and Eldridge's characters |
| `src/stages/noircity/parts/lamps.js` | the Hill's warm pools (`lamp.warm`, the pool light's colour) |
| shared, marked `[O1c]` | `night/fist.js` (O7's: the import, `thingTick` at the top, `thingStep` before the whiff), `police/crime.js` (O3's: `vandal` 1), `people/People.js` (O3's: `vandal` in `witness`; `round` corners not counted in `pavWalk` / `awayPath`), `render/shaders/ground.js` (`uNearK`, `uRedCut`, defaults leave game one identical), noircity `parts/street.js` (their city values), `tools/lib/o1_city.mjs` (the jank walk's `round`) |
| plays | `tools/plays/o1c_fist.json` (the fist walk, `tools/lib/o1c_fist.mjs`), `tools/plays/o1c_fist_pad.json` (by the pad); `o1b_jank.json` round kinds `expect: 'round'` |

---------------------------------------------------------------------------
## 3. Proofs and the gate (on the final code)

| proof | result |
| --- | --- |
| the graph tool `node tools/pavecheck.mjs` | **0 / 0 / 0** (was 194 legs through a solid and 17 corners inside) |
| `o1b_jank.json` | **PASS 20 of 20** (the flowers slid round, never inside; every round thing nearest its edge 0.36 m) |
| the fist walk `o1c_fist.json` | **PASS 30 of 30** (section 3a) |
| the fist by the pad `o1c_fist_pad.json` | **PASS** (section 3a) |
| `o6_city.json` | **PASS** (down Grand Ave and the market: over, nothing through, nothing floating, resting) |
| `o3_witness.json` | **PASS** (empty 0, cop 1, box 1, stopped 0) |
| `o3_crowd.json` | the walk part passes on the mended graph (1,423 frames, nobody through anybody, in a wall or in the eye; car through 0; the shot scatters 6; fast car down 2); **the gun step fails (2 of 6 run from the drawn gun, 4 wanted)** - and fails the same with main's `graph.js` and `People.js` put back (run here): it is main's RMB clash (O3's draw against O7's wheel and jab), not the graph |
| `o1_drive.json` | five districts, never in a wall; ended `failed` on car wear (O6b's, section 3a) |
| the colour measure (`tools/colour.py`), the ten blind streets from the seat (O1b's poses) + Doyers on foot + `city_o3_police` + `city_park` + the title | **max 1.72 % (Grand Ave under the el, the police's red lamp not in it), mean 0.59 %, none over 2 %**; `city_o3_police` 1.01 % (its red roof lamp: red 0.41), the title 0.94 % (its red splash 0.35 + the blue neon), Doyers 0.88 %, Bridge St from the seat 0.05 % (no real light of the Hill near that pose) |
| golden, game one's | 39 of 40 identical; **`title` changed** (its backdrop is the city's Grand Ave: the near ground darker) - re-taken |
| golden, the city's 16 | **12 changed and re-taken, 4 identical** (`city_quay`, `city_clock`, `o5_bar`, `o5_gym`): every street frame's near ground darker (uNearK); `city_park` also the Hill's warm pool; `city_o3_crowd` and `city_o3_police` also the walkers on the mended graph's line; `smash_bed` and `smash_wreck` (O6's bed on the city's ground: the near ground). Old beside new: `docs/review/O1c/1_city_frames_old_new_near_ground_darker.jpg` |
| errors | **clean** at fourteen starts and beats |
| fps | every busy spot over `shot=perf` (Grand Ave 1.08 x) |

### 3a. The last runs
- **The fist walk** `o1c_fist.json` (final code): **PASS, 30 of 30** - every
  kind once on and about Grand Ave (what the Tenements, the Docks and the Yards
  have, the nearest one: churns, drums, a handcart): the dustbin, dustbins, a
  board, a bicycle, flowers, a barrel, a rain barrel, churns over; crates
  shoved over (`over:body`), crates kicked to planks (`break`); drums, a
  bench, a fruit stand, a newsstand shake to a jab (no hurt); drums, barrels,
  a bench, a handcart over to a kick; a mailbox, a hydrant, a lamp post, a call
  box, a street sign, a booth ring and stand, the hand hurt each time; shop
  glass `crack` then `break` (pane gone, O3's `smash`); a wall hurt the hand;
  a door knocked; the coupe's tin dented (no traffic on main before O2: the
  roam's own coupe); a bottle on a step knocked off and broken; a bin a cop
  saw knocked over: `vandal@cop` and **HEAT 1**. Everything that went over
  lay with its lowest point 0.003 m over the ground (`settle`), at rest after
  3.5 s (7 s for what rolls). Press to the swing 2.2-32.6 ms. #errlog clean.
- **The fist by the pad** `o1c_fist_pad.json`: **PASS** (R2 a dustbin over,
  a lamp post rings and hurts, circle + R2 crates kicked to planks, glass
  cracked then gone), 0 key or mouse events.
- **The drive-through** `o1_drive.json` (at a one-minute load of 67-77, five
  NOIR CITY lanes building): all five districts, 3.47 km, **never inside a
  wall**, 1 crash, 5 scrapes; 36 frames over 50 ms of 10,002 (worst 251 ms);
  **it ended `failed`** - the car wore out and burned on the bot's scrapes,
  the O6 car-wear finding routed to O6b (its merge is pending on main), not
  this lane's.
- **errors** (`tools/errors.sh`, people on): every start (grand, clock,
  tenements, docks, yards, hill, gasworks, bridge, river, park), the station,
  hospital and ashore beats, `start=city`: **clean, all fourteen**.
- **fps** (`MOMENTS=city tools/fpstable.mjs 5`, at a load of 36-56, ratio to
  `shot=perf` measured beside each): Grand Ave from the car **1.08 x**, the
  el's corner 1.33, Broadway to the clock 1.18, the Bowery under the station
  1.39, the quay 1.60 - every spot over perf (O1b's 1.09 / 1.49 / 1.16 / 1.06
  / 1.71); draws 652 / 572 / 900 / 650 / 546 (unchanged: nothing of this lane
  draws more; the firehouse's panels are in the dressing's merged chunk).

---------------------------------------------------------------------------
## 4. Feel

The press to the swing: 1-35 ms (the fist walk's 30 presses; the frame of the
press or the next). The answer lands at the jab's contact (0.09 s), a kick's
foot at 0.12 s. A hurt hand holds the next press 0.5 s (the beat the brief
asks for); nothing holds the feet.

---------------------------------------------------------------------------
## 5. For other lanes

- **O6b** (merging into main now): its awnings in their own solid merge and
  the el's hung lamps as items are in `dressing.js` / `props.js`; nothing of
  mine is in those files. A fist reaches any item of the set that stands within
  1.25 m (`thingAhead` skips `K.high`, so an awning is not punched).
- **O3**: `crime.emit('vandal')` (level 1) is new; the walk now runs 2-2.7 m in
  from the kerb on streets and avenues (was 1.2), through `round` corners
  round things; `boxWay`'s leg check can go when you agree.
- **O7**: on main, every crime by 'player' is told again as a 'punch' by 'me'
  (`night/standins.js` lines 86 and 88: the stand-in's listener on `crime`):
  the fist walk shows `vandal, punch` for every knock, `smash, punch` for
  glass. No heat comes of it (O3 counts only `by === 'player'`) but the street
  alarms twice. Yours to retire.
- **O2**: a jab at a car dents nothing yet (a sound): `city:fist` `{ thing:
  'car' }` is there for the car's own answer (an alarm, a driver who gets out).
- **O5b**: in a room the room's fist is first; a swing at nobody there comes
  to `thingStep` (its walls hurt the hand: the bullets' world).

---------------------------------------------------------------------------
## 6. Left (most felt first)

1. **o3_crowd's gun step** fails on main as here (the RMB clash); not the
   graph's. **o1_drive ended in a burnt car** (O6's car wear, O6b's fix).
2. **A kick has no foot**: the hand kit has no leg; the kick is the eye's
   lunge and the fists coming up. A foot in the viewmodel would sell it.
3. **The Hill's warmth is in its real lights' pools only** (the nearest five
   lamps hold one): from a car on Bridge St at speed the pools ahead are still
   white cones; a warm cone (the cone shader's colour) was not tried.
4. **The near ground** is darker by the wash's share only; the puddles' sky
   sheen and the lamps' pools are as they were.
5. **The O7 stand-in's duplicate 'punch'** for every crime (section 5).
6. **Mott and Eldridge's stone** reads at night mostly by their bracket
   lanterns and lintels; the masses are dark either way.
7. **People spawn** a little more often by things on the pavement (the round
   corners are nodes of the spawn ring); not seen as a problem in the crowd
   walk.

**Where the brief was changed in play**: the walk's line moved into the
pavement's middle (the brief asked only for legs off the lots; at 1.2 m every
street tree and most lamp posts stood on it); round things keep their round
colliders and the jank rule allows the slide (the brief's second option); a
kick is C held + LMB on foot (C is otherwise nothing on foot in the city); the
crate is shoved whole by a jab, broken by a kick.

# O1c — the streets, the follow-up (lane report, the handover)

Branch `ow/O1c-streets` from main at 7040333 (after O3, O5, O7). Brief:
`docs/briefs/O1C_STREETS.md`. Port 5378. What a player meets, how it is built,
the proofs, what is left.

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
| the fist walk `o1c_fist.json` | see section 3a |
| the fist by the pad `o1c_fist_pad.json` | see section 3a |
| `o6_city.json` | **PASS** (down Grand Ave and the market: over, nothing through, nothing floating, resting) |
| `o3_witness.json` | **PASS** (empty 0, cop 1, box 1, stopped 0) |
| `o3_crowd.json` | the walk part passes on the mended graph (1,423 frames, nobody through anybody, in a wall or in the eye; car through 0; the shot scatters 6; fast car down 2); **the gun step fails (2 of 6 run from the drawn gun, 4 wanted)** - and fails the same with main's `graph.js` and `People.js` put back (run here): it is main's RMB clash (O3's draw against O7's wheel and jab), not the graph |
| `o1_drive.json` | see section 3a |
| the colour measure (`tools/colour.py`), the ten blind streets from the seat (O1b's poses) + Doyers on foot + `city_o3_police` + `city_park` + the title | **max 1.72 % (Grand Ave under the el, the police's red lamp not in it), mean 0.59 %, none over 2 %**; `city_o3_police` 1.01 % (its red roof lamp: red 0.41), the title 0.94 % (its red splash 0.35 + the blue neon), Doyers 0.88 %, Bridge St from the seat 0.05 % (no real light of the Hill near that pose) |
| golden, game one's | 39 of 40 identical; **`title` changed** (its backdrop is the city's Grand Ave: the near ground darker) - re-taken |
| golden, the city's 16 | **12 changed and re-taken, 4 identical** (`city_quay`, `city_clock`, `o5_bar`, `o5_gym`): every street frame's near ground darker (uNearK); `city_park` also the Hill's warm pool; `city_o3_crowd` and `city_o3_police` also the walkers on the mended graph's line; `smash_bed` and `smash_wreck` (O6's bed on the city's ground: the near ground). Old beside new: `docs/review/O1c/1_city_frames_old_new_near_ground_darker.jpg` |
| errors | see section 3a |
| fps | see section 3a |

### 3a. The last runs
(filled in below as they run)

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
   graph's.
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

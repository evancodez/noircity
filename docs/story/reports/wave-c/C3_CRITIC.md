# C3 critic: chapter VI The Tail, played cold (2026-10-02)

The code played: `wave-c/C3-city` at 93bf060 (the second owner's handover).
Played as the user will: from the title (`?start=tail`, `?start=tail.river`,
`mute=1`), by trusted input, before reading the owner's report. Most of it
frozen between moves (`tools/stepplay.mjs`), looking at every frame; the
contests by my own player (`tools/plays/critic/c3c_drive.mjs`: it follows
only what it has seen of his car, brakes for the bends of his trail, aims
the mouse onto a tyre), not the owner's bot; the findings that matter
re-checked in real time with `tools/play.mjs` plays of my own
(`tools/plays/critic/*.json`). Frames: `docs/story/review/wave-c/C3/critic/`.

**Verdict.** The chase on the streets is the real thing: he is on no leash,
hands off loses with a warning, a player who follows what he sees keeps him,
the car is a car and the city has hard edges. Phase b is not a contest:
**LMB alone, never aimed, stops him in about five seconds** (6 of 6 rounds
land). Fix that first; then the two things a player will see pass through
(fruit in my lap, a walker into a wall), the teach cards, the kit merge and
the seam's stall.

---------------------------------------------------------------------------
## Findings, most felt first

### 1. BLOCKER: phase b wins with no aiming (the game aims for me)
- **What.** On the river road, clicking LMB once a second with the mouse
  never moved and RMB never pressed lands every round on his car and puts
  him off the road. Real time, real input: 6 shots, 6 hits (most on the tank),
  his wreck 6.6 s after phase b starts, my hands off the wheel the
  whole time (`tools/plays/critic/tail_b_noaim.json`, run three times at
  1280 and 1440 wide: wrecked every time; 6 of 6 in both runs whose count
  I read). Frozen, with my car following him:
  4 of 4, he crashes in 4.4 s (twice, identical). Frame
  `01_lmb_alone_eye_on_him.jpg`: 0.2 s after a click, the eye is centred on
  his car's back without the mouse having moved.
- **Why** (`src/scenes/tail/gun.js`):
  - line 52: LMB with the gun down sets `snapT = 0.9`: the click raises the
    revolver and fires once the arm is up (`fireBuf`), so a bare click is a
    full aimed shot;
  - line 58: every raise sets `aimSnap = 0.32`, and lines 61-66 swing the
    look onto `his.seat(-1.9, 0.75, 0)` - the middle of his back, low -
    which is exactly `chase.js` line 365's tank zone (`lp.x < -1.45 &&
    lp.y < 1.05`). Three tank rounds set him on fire (line 370) and the fire
    takes him 2.5 s later (line 578); four take his hold (0.22 each).
  - his weave (`his.js`, `seesGun` needs `aimK > 0.5` for a while) never
    builds while the gun bobs up and down between clicks.
- **The player feels**: I clicked, he blew up. Nothing was asked of me.
- **Fix.** No automatic aim: drop `aimSnap` (or keep a slight ease that
  never reaches him), and make LMB with the gun down only raise it (no
  round until the arm is up and LMB is pressed again). The aim mark is
  enough to aim with. Then judge phase b again (finding 5). The play
  `tail_b_noaim.json` must pass: at most one hit, he is still driving.
- Note: RMB held and LMB spammed with the mouse still (W held,
  `tail_b_rmbspam.json`) landed 2 of 6 and did not stop him in real time:
  once the gun stays up his weave works. The cheat is the per-raise snap.

### 2. BLOCKER: fruit inside the cabin, in my lap (a pass-through seen in play)
- **What.** After his crash I drove on through the wharf market's stalls
  and over what they spilled (36 to 60 km/h). A melon-sized fruit sat in
  front of the steering wheel between my hands, a second over the dash on
  the left, and stall poles crossed the windscreen inside the glass, in
  front of the mirror's stalk. Frame `02_fruit_in_the_cabin.jpg` (phase c,
  t 179.5, my car at (127, -59) heading south).
- **Why.** Pieces never collide with the car's body. `smash.js`
  `kickPieces` (line 501, called from `Car.js` line 281) throws a piece
  the car overlaps up at 0.8 to 1.15 of the car's speed - so it falls back
  through the bonnet - and the only guard is the windscreen band in
  `update()` (lines 523-526: 1.0 to 1.95 m up, 0.25 to 0.85 m ahead of the
  car's middle, |z| < 0.7). A piece lower, wider or slower than that band
  passes through the bonnet, the pillars and the cabin. (A probe of a clean
  plough at 50 km/h found none inside; it happened over pieces already
  lying in the road and on a piece kicked twice. It is intermittent, and
  ugly when it comes.)
- **Fix.** Keep every piece out of my car's body box, not only out of one
  band of the windscreen: anything inside it (below 1.5 m, within the
  car's half length and half width) is put on its surface and thrown off
  it; never kick a piece from inside the box toward the rear.

### 3. MAJOR: a walker who jumps clear goes into the building
- **What.** Drive at a figure under an umbrella on Cooper St's west pavement
  at 40 km/h: he jumps toward the wall and ends 0.7 to 2.7 m inside the
  facade (x -184.2, -184.7, -186.2 in three runs; Cooper's west building
  line is x -183.5 = -175 - 5.5 - 3). `tools/plays/critic/tail_walker_wall.json`
  (real time) fails.
- **Why.** `walkers.js` line 96-98: the jump runs 4.2 m/s for 0.55 s
  toward the wall's side with no test against the building line; the
  'never under a car' push (line 122) moves him out of the car's box with
  no wall test either.
- **Fix.** Clamp a walker to his pavement strip (between the kerb and the
  building line) every step; jump along the pavement or into a doorway,
  never into brick. Three of the four walkers are on his route's pavements.

### 4. MAJOR: the driving keys are never readable; the handbrake is taught at the kerb
- **What.** BEGIN at the tail, touch nothing: the card `W drive / A D steer
  / S brake` shows for 0.2 s (t 4.58 to 4.78) and is replaced by `SPACE
  handbrake: the tail round a tight corner` the instant he pulls away, at
  the kerb, nowhere near a corner. A first-timer reads neither: the first
  was gone before it could be read, the second is about a corner he cannot
  see. `tools/plays/critic/tail_teach.json` fails (both checks). Frame
  `04_handbrake_card_at_the_kerb.jpg`.
- **Why.** `src/scenes/07_tail.js` line 113: `pilot.s > 30` is already true
  at the kerb (the path starts at the junction before him), so line 114's
  card follows line 109's at once.
- **Fix.** Hold the drive card until W is pressed (or 5 s); teach the
  handbrake when he brakes for his first corner (his brake lamps flare) or
  when I arrive at it above 35 km/h. `kit.teachAgain` exists and is used
  nowhere: after two "Wrecked."/"Lost him." at a corner, teach it again
  (WAVE_C §3).
- The wording "the tail round a tight corner" reads like the chapter's name;
  "SPACE handbrake: swing round a tight corner" says it.

### 5. MAJOR: phase b is a gallery even with honest aim; a hit does not show
- **What.** Aiming as taught (RMB, the mouse onto a tyre, LMB): 3 shots, 2
  hits, he is off the road 7 s into phase b; another run 10 s; a sloppy
  aim (slow, shaky, firing early) 7 shots, 3 hits, 6 s. He starts 26 m
  ahead in my lane on a straight, with nothing between us; there is no
  steering-and-shooting problem to solve. The brief: "Steering and shooting
  at once is the difficulty: traffic and things in the road while I aim."
- **A hit does not show at range.** A tyre hit at 22 m (`hisDmg.tyres` 1):
  the next 24 frames show nothing on his car - no spark, no puff, no sag
  readable at that size; only his speed drops 55 to 51 km/h and he pulls a
  little (`06_tyre_hit_nothing_shows.jpg`, and crops at 4x). Muted, a hit and
  a miss look the same. Smoke shows from the second tank hit; that one
  reads.
- **Fix** (after 1): a hit needs a mark at the place it lands, readable at
  20 to 40 m in the ink (a white spark star, a burst of black rubber, the
  car's quarter dropping visibly); put traffic and parked cars on the river
  road's first 200 m, have him change lanes round them and swerve when
  hit, so I must steer while aiming. The owner's Left 2 says the same; with
  1 fixed it is the next thing a player feels.

### 6. MAJOR: the lane still runs the wave B order and its own kit; the integration's kit is ready
- **What a player sees today.** The card says **VII THE TAIL**
  (`05_card_VII.jpg`) and the next chapter **VIII PIER NINE**: WAVE_C §4
  numbers them VI and VII.
- **Why.** `wave-c/integration` has had the C1 kit since 0b46889 (with
  `docs/story/seams/Z.md`); this branch has not merged it. The owner's
  report ("Z.md is not on wave-c/integration yet") is out of date.
- **What the merge will bring** (check it in play, not only in the build):
  integration's `src/scenes/order.js` gives `tail` stand-in objectives for
  the wave B beats - `start: 'Stay on his tail lamps.'`, `close` / `shot`:
  'Put him off the road.', `crash: 'Get out. Take him.'`, `interrogate:
  'Make him talk.'` - and a stand-in is taken down when a beat begins that
  has none (this scene's `chase2`, `river`, `pier`). The tail sets its
  lines through `kit.objective` around its beats (`07_tail.js` lines 106,
  118, 124, 134; `chase.js` 192 and 485): declare them as the scene's own `objectives` in
  `defineScene` (Z.md §5) so the manager does not show the old lines or take
  the new ones down. Then `teach(id, text)`'s signature, `game.fail`'s black
  (long enough to read the why), and drop the shim's fallbacks as the
  report already plans.

### 7. MAJOR: the seam's warm-up and the cut stall
- **Measured** (frozen session, the city not yet built, from the watcher
  chapter; CPU time per call/frame, the machine shared with another lane):
  `game.stages.warm('city', 6)` once a frame: 38 frames, 396 ms in all, the
  longest slice 35 ms, six over 16 ms (a part's build cannot be cut). Then
  `scenes.go('tail', { beat: 'start', fade: 'cut', card: false })`: 224 ms
  inside the call, and the first frame of the city 580 ms (its shaders and
  buffers): about 0.8 s frozen at the cut. Later cuts into the city: 77 to
  99 ms in the call, then single frames of 130 to 490 ms within the first
  12 frames.
- **Why it matters.** The user's ask is a cut inside the act of getting in,
  with no hitch and no black: a 0.8 s freeze on the door frame is the black
  card in another form.
- **Fix.** Compile the city's materials during the warm (a hidden render of
  its parts, or `renderer.compile` on its scene) and build the chase's
  objects (cars, traffic, walkers, cast) in the warm too, so `scenes.go`
  only places them; slice the parts that take over 16 ms. Say in the report
  what C6 must call: today nobody calls `warm` (the owner's Left 5).

### 8. MAJOR: phase b's river road reads grey
- **What.** The chapter's climax is drawn in mid-grey: sky, skyline, road
  and railing all between 70 and 170. Share of the frame (480 x 300,
  luminance): the reference 50 % black / 8 % white / 28 % mid-grey; the
  river road with the gun out (`01`, `06`) 44 to 49 % black, 3 to 5 %
  white, **43 to 44 % mid-grey**; Harbor St with the el 48 % mid-grey. The
  streets seen from the cabin are black-heavy, not grey (Pell Lane 79 / 1 /
  11, the market square 75 / 2 / 13 - `08_keep_the_market_square.jpg`),
  though with few whites everywhere (1 to 2 %: the reference's lamp cones and wet
  streaks are 8 %).
- **Fix.** Darker sky over the river (the reference's sky is lighter only
  round the lamps and the skyline is a mass, not a tint), black water,
  stronger lamp cones and their streaks on the wet road along the quay,
  black masses (the el's columns, the wharf's sheds) nearer the road.

### 9. MAJOR: things in the way cost nothing; the traffic is seldom in the way
- **Stalls.** Through a row of eight wharf-market stalls at 50 km/h, W
  held: 0 damage, the speed rose 47 to 59 km/h, and for two seconds the
  windscreen was nothing but black planks (`03_stall_row_costs_nothing.jpg`).
  `smash.js` line 27: a stall costs `drag 0.93` once, then the engine has
  it back. A player learns that a stall is a free shortcut. (Lamp posts do
  cost: 57 to 45 km/h and 1.3 damage; parked cars, columns and edges are
  hard: see Good.)
- **Traffic.** At most four sedans, spawned 70 to 170 m off and away from
  his line: in my two clean good runs not one was in my way. When one meets
  me head-on it stops 9 m off and waits (7 s and counting), never backing
  or going round; I can reverse round it.
- **Fix.** A stall should take real speed (a third of it) and shake me;
  put the traffic on his line ahead of us at the junctions he takes (he
  overtakes, I must too), and let a car facing me back off after 2 s.

### 10. MINOR
- **A player who falls far behind in phase a starts phase b already lost**:
  my clumsy player turned onto the river road 114 m behind; no warning for
  23 s ("He's nearly at the pier." comes only at his z 70), then "He warned
  them.". Fail at once ("Lost him.") if I reach the river road more than
  85 m behind, or warn at once.
- **The chase2 checkpoint starts 33 m behind him at 40 km/h straight into
  the Baxter turn**, a parked van on Baxter's west kerb at the corner: my
  player hit it four restarts running (once it had lost him for other
  reasons). Start chase2 a little further back from the corner or with him
  closer to it.
- **A bent lamp post stays lit**: 1.5 s after the blow its lamp is still on
  (`on: true`) and its glowing head rides in front of my bonnet like a
  bottle on the ornament. The report says they go out.
- **The yard reads bare**: Pier 9's yard is 44 x 38 m; its west half is
  empty paving to the river rail (`07_yard_bare_plain.jpg`). The doors,
  drum, crates and lamp are by the gate; `E get out` shows only within 11 m
  of (133, 176) and under 0.6 m/s, with nothing on the ground to say where.
  A second sign or a lamp over the stop helps.
- **The `PIER 9 ->` sign at z 110 points right while the shed shows on the
  left**; it means the yard. Fine once known; a first-timer looked right.
- **`tools/fps.mjs` at the market square with `tailAt=-150,-160,0.79,9`
  measured 3.5 and 4.2 fps (twice)** while my real-time play into the
  square's stalls measured 72 fps: a shot-mode CPU storm (a car placed into
  a stall?) worth a look before anyone quotes a square number.
- **The traffic car stopped facing me showed unlit headlamps.**

---------------------------------------------------------------------------
## Cheats and losses without a tell (from the code)

- `src/scenes/tail/gun.js` line 52 + line 58 + lines 61-66: LMB raises the
  gun and fires once it is up, and every raise swings the eye onto his
  tank: an automatic aim that decides phase b (finding 1).
- `src/scenes/tail/chase.js` line 134 `sees()`: "in sight" is blocked only
  by walls, fences, the works and the gate - parked cars, traffic, the el's
  columns and distance never hide him. Generous rather than winning (it only
  delays "Lost him."), but write it down.
- No rubber band: `his.js` drives a fixed path; its pace is his own (duck,
  hurt, weave), never my distance (only the route's two choices read the
  gap). No mercy tyre, no scripted crash: `D.lose` is called only from my
  rounds (`chase.js` 325, 346), a ram on a hurt car (387) and the fire my
  rounds lit (578).
- Every loss has a tell: "He's getting away." about 4 s before "Lost him.";
  "He's nearly at the pier." 5 s before "He warned them."; damage shows in
  steps before "Wrecked.".
- `?c3auto=good|bad` plays for the player, but only from the URL (debug).

---------------------------------------------------------------------------
## The user's asks, as played

| # | ask | met | what I saw |
| --- | --- | --- | --- |
| 1 | a city, real turns, better driving | yes | a grid of real junctions; the car is heavy and answers: 0.9 rad/s of yaw at 30 km/h, 0.75 at 45; the handbrake pivots (1.1 rad in 0.8 s at 40, the tail out 0.8 rad, down to 16 km/h); S 47 to 0 km/h in 1.5 s; flat out ~72 |
| 2 | tail him, can lose him | yes | hands off: "He's getting away." about 12 s in, "Lost him." at about 16 s (twice); W held: into the wall, lost; my good player (eyes only) kept him clean in 2 runs of 3 (80 s), the third lost him at traffic and a parked van |
| 3 | traffic and obstacles not trivial; destruction; not fast | no | destruction yes; not fast yes; but stalls cost nothing and traffic is seldom on the line (finding 9) |
| 4 | my shots cause the crash, each hit shows | no | only my rounds crash him, but LMB alone does it without aiming (1), and a tyre hit shows nothing at 22 m (5) |
| 5 | drive to Pier 9 by landmarks and signs | yes | PIER 9 signs, the crane, the shed; under a minute; E at the gate, the lamps off, the doors, chapter VII |
| 6 | nothing passes through; real edges; never stuck | no | cars, columns, walls and every edge are solid and real at 60 (Good); but fruit in the cabin (2) and a walker into a wall (3); never stuck (reverse frees every wedge I made) |
| 7 | always clear what to do; gun and handbrake taught | no | the objective line from the first second and at each change; the gun card at the river; but the drive card lasts 0.2 s and the handbrake card comes at the kerb (4) |
| 8 | the seam: no fade, no card on black, warmed without a hitch | no | `warm` exists and the cut lands in the seat with no card; but ~0.8 s frozen at the first cut, a 35 ms slice in the warm (7); C6's side not testable yet |
| 9 | every frame the ink; the frame rate of perf | no | frame rate yes (fps.mjs, the GPU shared: perf 31-35, the kerb 71, Canal St 64, the river road 38; real time Cooper St 36, the square 72); the streets are the ink, the river road is grey (8) |

---------------------------------------------------------------------------
## Good: keep it, do not break it

- His driver: no leash, his own pace, two route choices by my gap; brake
  lamps before a corner; he overtakes.
- The idle and fail shape: warning, then the fail; the black with the why
  lettered (1.15 s), back at the checkpoint in under 2 s; checkpoints at the
  kerb, Canal St, the river road; damage mended there.
- The car on the wet: weight, a tail that steps out under the handbrake and
  comes back, brakes that matter.
- A solid world (`c3c_jank.mjs`, phase c, my car placed and W held): a
  parked car at 60 km/h: stopped, the car shunted, 1.9 damage, centres
  4.98 m apart (no overlap); an el column at 60: stopped dead 3.1 m from its
  centre, 1.6 damage; the rail yard's railing and wagons (west), the canal
  railing (north), the lift bridge's end, the depot wall (south), the river
  rail (east), the roadworks' sawhorses (they give) and trench (it stops
  me): all solid at 60, about 1.7 damage, no launch (pitch under 0.12 rad),
  all of them visible things. Rammed his car at the kerb and alongside: no
  overlap.
- The city's look on the streets: Pell Lane's fence and lit wall, the market
  square's bulb strings over wet stones (`08`), the el's arches at the
  river's end, his red lamps down a black street.
- The crash and the wreck: caused, varied, the slow motion, the hat; the
  drive to the pier and the getting out.
- `tools/errors.sh` clean on start, chase2, river, pier; no errors in any of
  my plays.

---------------------------------------------------------------------------
## My plays and tools (tools/plays/critic/)

| file | what | today |
| --- | --- | --- |
| `tail_b_noaim.json` | phase b: LMB once a second, no RMB, the mouse never moves; must not stop him | FAILS (6/6 hits, wreck at 6.6 s) |
| `tail_b_rmbspam.json` | RMB held, LMB twice a second, the mouse still, W held; must not stop him | passes (2/6 hits) |
| `tail_teach.json` | the drive card up 3 s; no handbrake card at the kerb | FAILS (0.2 s; the handbrake card at the kerb) |
| `tail_walker_wall.json` | a walker jumping clear stays out of the facade | FAILS (x -184.2 against -183.5) |
| `tail_square_fps.json` | the square's stalls hold the street's frame rate | passes (36 vs 72 fps) |
| `c3c_drive.mjs` (+ `c3c_status.js`, `c3c_proj.js`) | my player for a `stepplay` session: good / bad / idle / W-only hands; aim / sloppy / tap / rmbspam / none gun | good aim: through twice (130 s); bad sloppy: "He warned them." once, through on the 2nd try |
| `c3c_jank.mjs` | my car placed and driven into a thing in a `stepplay` session, the least distance and the damage read every 2 frames | see Good |

Run the plays with `NOIR_PORT=5343 node tools/play.mjs tools/plays/critic/<play>.json --size 1440x900`.

## Frames (docs/story/review/wave-c/C3/critic/)

`01_lmb_alone_eye_on_him` (1), `02_fruit_in_the_cabin` (2),
`03_stall_row_costs_nothing` (9), `04_handbrake_card_at_the_kerb` (4),
`05_card_VII` (6), `06_tyre_hit_nothing_shows` (5),
`07_yard_bare_plain` (10), `08_keep_the_market_square` (Good).

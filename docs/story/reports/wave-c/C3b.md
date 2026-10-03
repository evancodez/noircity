# Wave C lane report: C3b, chapter VI The Tail after the user's play (2026-10-03)

- branch `wave-c/C3b-tail` (from `wave-c/integration` fc69676), port 5343
- the brief: `docs/story/briefs/C3B_TAIL.md` (every [must] is the user's own
  words); the standard: `docs/story/WAVE_C.md`; the lane before:
  `docs/story/reports/wave-c/C3.md` (its "C3b" section points here)
- this file is the handover: a later owner continues from it, the code and
  the brief. Code marks: `[C3b]`.

## What changed, as the player feels it

| the user's ask | what plays now | where |
| --- | --- | --- |
| **he speeds up when I catch him; a graze, nothing more, until the shooting** | In the streets (phase a), and on the river road while his car is whole, closing within 8 m of him (behind or alongside) for 0.35 s (his eyes in the mirror) makes him floor it for 2.8 s: his car briefly faster than my coupe (25.5 m/s against 22.5, its corners as they were), the engine note up, his tail lamps brighter, a tyre chirp; then back to his pace (not again for 2 s). A good driver at two to five lengths is left alone; a fast close (into a corner, where he is slow) gets the graze. A graze is a jolt and a dent's sound: his yaw knock is taken back (x0.25), he keeps his line and pulls away. I cannot put him off the road in phase a and cannot get past him. (Not done: "a late turn I did not expect, a cut through traffic" - his answer is the burst only; his route already turns and doubles back.) | `his.js pullStep / burst / boostPath`, `chase.js grazed`, `rules.js PULL` |
| **the gun a bit easier, not trivial** | One round in a tyre takes it (the bang, the hiss, the quarter down, the rim sparking): he is slower than me (his river pace x (0.55 + 0.45 of his hold)) and weaves. The man ducks as before (a round while he is down goes over him); the tank leaks, smokes at 2, burns at 4. **No number of rounds ends it**: his hold goes 1 .. 0.35 and never under (`HIT.floor`) - slow, weaving, catchable. | `chase.js hisHit`, `rules.js HIT` |
| **if not the gun, the shunt on the back corner works (it seemed impossible)** | The old test wanted the push mostly sideways in his frame, which a car closing from behind at an angle almost never makes. Now it is the PIT as a driver does it: contact behind -0.9 m in his frame (his rear axle -1.55, tail -2.45), on a side (abs z > 0.3), my heading 12 to 66 degrees off his and turned into him, closing at 1 m/s or more (or held into him 0.35 s). Hurt (a tyre gone, the tank smoking, or the man hit): he spins. Whole: a fishtail he catches (0.7 rad/s) and the burst - he pulls away. A straight rear-end is a shove. The card `[A] [D] shunt his back corner` comes the first time he is hurt. | `chase.js rammed / hurt / hurtCheck`, `rules.js RAM`, `TEACH.ram` |
| **the crash looks cool, and it is gameplay, not a cutscene** | The spin is the cars' own physics: a yaw kick (3.4 rad/s) and a shove across (5 m/s) at the shunt, a stab of throttle, the handbrake held, all four tyres light on the wet; he goes round on his momentum and slides on 10 to 15 m into what is there (in the final runs a lamp post that bent and went out; the rail holds; the stalls and parked cars are the city's same solids), with tyre smoke, his own knocks heard and sparked. The camera is never taken (the old crash turned the eyes to him); a 0.7 s slowdown at half speed as he goes past the windscreen. Then the stuck horn dying and his lamps going out one after the other, as before. Needed: `Car.js` treated a car sliding sideways as "at a crawl" (its forward speed ~0) and stopped it dead in 0.1 s - a car with `freeSlide` (only his, only in the crash) is at a crawl only when it is slow over the ground. | `chase.js crashing`, `his.js crashing`, `Car.js` [C3b] |
| **no interrogation: I get out, he is crouched over, he says Pier 9** | His wreck at rest: "See to the driver."; stopped within 32 m, `E  get out` - the door, the eye out on foot by my door (the side with room, never into his car or the rail), the hands empty. He is out by his wreck, down on one knee, bent over, a hand to the road, the bowler gone (it lies on the road), on the side of his car nearest mine with room. Walked up to (within 2.2 m, looking at him), or passed within 6 m: his one line, subtitled, *Pier nine. Tonight.*, and his right arm goes up and out down the river road. `E  get in` at my door: the same cut into the seat as the chase's; "Pier 9."; phase c as it was. Both cars, the man, the walls and the rail are solid on foot (the walking net round the eye, taken away on getting in). The old E-look at the wreck is gone; the hold and the question's clips are not used. | `chase.js manOut / walkNet / doorAt / free / getOut / getIn / sayLine / atWreck`, `cast/kinds/tail_trucker.js` clips `tail_crouched`, `tail_point` |
| **no cutscene at the pier: I am there and the next mission starts** | Stopped at the pier's bay, `E  get out`: the lamps off, the door, and chapter VII by a **cut** (no black) with its card lettered small over the picture (`scenes.go(..., { card: 'small' })`, added to `SceneManager` [C3b]: a self-fading CSS card). The pier's stage is built a slice a frame (4 ms) from the river road on (`game.stages.warm('pier9')`). Lane C7 owns VII's first frame. | `07_tail.js` script end, `SceneManager.js` [C3b], `chase.js step` |
| **the fail: he gets away after enough time** | Phase b has a window (`RIVER_B`): he runs the river road at 10 m/s whole (less hurt); from 16 s "He's pulling away." and he speeds up toward 21 m/s (15 hurt); from 24 s he is gone - "Lost him." once 45 m clear, or at 26 s if more than 25 m off (never with him wedged in front of my bonnet - he is mine to shunt - unless I leave him 8 s more). Back at the river road, him whole. "He warned them." only if he reaches the gate first (a whole car chased bumper to bumper). | `chase.js rules`, `his.js pullStep`, `rules.js RIVER_B` |

**Where I differ from the brief, and why.** The window is 24 s (+2), not
about 45: from phase b's start to the pier's gate the river road is 360 m,
and a car that speeds away covers it in under 30 s - at 45 s the gate would
always end it first. The good hands need 5 to 18 s, the clumsy ones most of
the window. The man's line comes on a pass within 6 m only while I walk
away from him (a pass), not on standing near him; if I get back in without
going to him at all, he calls it as I get in (the story needs the words).

## The rules, in numbers (`src/scenes/tail/rules.js`)

- `HIT { tyre 0.4, rim 0.05, man [0.15, 0.12, 0.08], tank 0.08, body 0.04, tankSmoke 2, tankFire 4, floor 0.35 }`
- `RAM { behind -0.9, side 0.3, yaw0 0.2, yaw1 1.15, imp 1.0, lean 0.35, spin 3.4, shove 5.0, stagger 0.7 }`
- `PULL { near 8, react 0.35, t 2.8, cool 2.0, vmax 25.5, accel 6.6, pathV 25 }`
- `RIVER_B { cruise 10, away 21, awayHurt 15, warn 16, t 24, lostGap 45, extra 2 }`
- `RULES.gateWarnZ` 110 (was 70: "He's nearly at the pier." would have come over the window's line)

## The proofs (WAVE_C §7), by real input, each run once on the final code

Hands: `src/scenes/tail/bot.js` profiles, pressed by `tools/lib/c3_tail.mjs`
(real keys, the mouse onto his car, LMB, E on the prompts; on foot: W and the
mouse onto the man, then the door; round a car in the way by its corner).

| play | what it shows | result |
| --- | --- | --- |
| `tail_idle` | (a) hands off at the kerb: "He's getting away." in 18 s, "Lost him." in under 20; (b) W only: lost; (c) river road hands off: "He's getting away.", "Lost him." (warned 1 s and more); (d) river road, good driving, never shot or shunted: "He's pulling away.", then "Lost him." at 26 s (him at z 93, short of the gate) | 12/12 PASS |
| `tail_bad` | clumsy hands from the kerb | 3/3 PASS: lost him once in the streets (try 1, 58.8 s), through on try 2 - phase b in 20 s with no fail (the clumsy hands hit a tyre and shunted); chapter VII opens |
| `tail_good` | good hands from the kerb, twice in a row (page reloaded, another draw) | 6/6 PASS: both wins with no fail; phase b 18 s and 4.6 s (one round, then the shunt); the ram card seen (`g08b`) |
| `tail_b_good` | phase b to VII: one tyre, the shunt, the spin (frames every few tenths), out, the line, back in, the pier, the cut and the small card | 4/4 PASS: crash at 10 s, wreck 14, out 17, in 27, parked 51; VII by a cut (fade 0), the small card |
| `tail_ram_whole` | the shunt on a whole car: a real PIT contact (behind his axle, at an angle, into him, closing), no spin, he catches it and bursts away | the chain's run FAILED (the hands sat 11 m behind for the river road's timed oncoming car and never got beside him; he reached the gate); the hands made bolder past a far oncoming car (`pitAlways`: tools only), then 2 runs: 4/4 PASS each |
| `tail_gun_only` | a deep pocket at everything, never a shunt: 13 shots, 8 hits, a tyre, the tank burning, his hold at 0.35 - never off the road; "He's pulling away." at 16 s, "Lost him." at 29.9 s | 6/6 PASS |
| `tail_graze` | phase a, hands onto his bumper: 3 grazes, 2 bursts, his yaw rate never past 0.85, he keeps his way, I never get past him | 6/6 PASS |
| `tail_jank_walk` | on foot by the wreck: into his car, into the man, into my car, along the road; the eye checked every 0.1 s | 4/4 PASS: never inside a car, never nearer the man than 1.1 m, his line came |

Look development (not proofs): `tail_out_look` (the man crouched, the line).

## The gate

1. `npx vite build`: built (the usual chunk-size notice).
2. `python3 tools/golden.py check`: 32 of 32 identical.
3. `tools/errors.sh` on every beat (`scene=tail&beat=start|chase2|river|wreck|pier`, and `warehouse&beat=arrive`, the cut's target): clean.
4. The proofs: above.
5. The jank walk: `tail_jank_walk` above (the streets and the car's own collisions are lane C3's and unchanged).
6. Frame rate, one session (the GPU 89 to 95 % busy before each run - another process - so the ratio only): `shot=perf` 29.5 fps (2.80 M triangles); the river road, phase b with its traffic and the gun out (`scene=tail&beat=river&t=1&anim=1&tailGun=1`) 65.4 fps, 3.69 M, 715 calls: 2.2x perf. (Shot mode does not warm the pier: the 4 ms a frame of `stages.warm('pier9')` during real play is not in that reading.)

## Shared files touched (marked `[C3b]`)

- `src/game/SceneManager.js`: `go(..., { card: 'small' })` - the chapter's card small over the picture, no black (a module function `smallCard`; sets `game.smallCardShown`).
- `src/vehicles/Car.js`: `freeSlide` (one line in `integrate`): a car with it is at a crawl only when slow over the ground. Only the tail's crash sets it.
- (lane C3's own) `src/cast/kinds/tail_trucker.js`: clips `tail_crouched`, `tail_point` (global names; played on the watcher kind).

## For other lanes

- Lane C7: VII is entered by `scenes.go('warehouse', { fade: 'cut', card: 'small' })` from the tail's pier bay; `pier9` is warmed during phase b and after. The first beat (`arrive`) must stand at once.
- Anyone: `scenes.go(id, { card: 'small' })` is now the small card on any transition.

## Review frames (`docs/story/review/wave-c/C3b/`, 1440 x 900)

1. `01_hurt_the_shunt_card` - one tyre gone, the card `[A] [D] shunt his back corner`
2. `02_the_spin_strip` - the shunt and the spin from my seat (0.12 .. 2.4 s), the wreck at rest, out on foot, walking back as he says it
3. `03_crouched_by_his_wreck` - down on one knee by his car, the bowler gone
4. `04_pier_nine_tonight` - the line, his arm up and out down the river road
5. `05_the_window_pulling_away` - the gun only: his tank burning, "He's pulling away."
6. `06_pier_nine_by_a_cut` - chapter VII at once, its card small over the picture

## Left (most felt first)

1. The spin's look depends on where I am: after a shunt at low speed with my car still pushing, his car can still come round against my wing and stop beside me (seen in two tuning runs before `freeSlide`; not in the final runs). A heavier shove or a short no-contact-with-me window would make every spin clear me; not done.
2. "A late turn I did not expect, a cut through traffic" in phase a: not done; his answer to a close tail is the burst only.
3. The clumsy hands got through phase b first time in the final run; one run does not show they can fail it (the window does fail the gun-only hands and the hands-off ones).
4. The whole-car shunt proof depends on the river road's timed traffic: the chain's run failed on the hands, not the rule; after a bolder hand it passed twice.
5. The man's point: the arm goes up and ahead (it reads as pointing down the road from behind him); from in front it reads less. His head does not follow me.
6. `tail_shunt.json` (the 4th owner's) still drives the old "dry gun then shunt" set-up; it is superseded by `tail_b_good` and `tail_ram_whole` and was not re-run.
7. The headless `c3city.mjs` bench reads only `RULES`; it does not know the window or the burst.

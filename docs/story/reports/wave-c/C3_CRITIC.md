# C3 critic, second look: chapter VI The Tail, played cold again (2026-10-02)

The code played: `wave-c/C3-city` at e95959a (the third owner's answer to the
first look). The first look's report is in git (aa5b177); its findings are
checked one by one below ("The first list, in play"). Played as the user will:
from the title (`?start=tail`, `?start=tail.river`, `mute=1`), by trusted input,
before reading the owner's report. Real time with `tools/play.mjs`; frozen
between moves with `tools/stepplay.mjs` and my own player
(`tools/plays/critic/c3c2_drive.mjs`: it follows only what it has seen of his
car, brakes for the bends of his trail, aims by moving the mouse onto a point
of his car; it logs every line the screen shows and the deepest overlap of any
two cars' boxes every 4 frames). Frames: `docs/story/review/wave-c/C3/critic/2nd/`.

**Verdict.** The first list is answered: no more aim of the game's own, nothing
in my lap, walkers clear of the walls, the cards readable and at their
moment, the kit's lines and VI, stalls that cost, a head-on car that backs off
and goes round, a much shorter seam, a darker river road. Phase a is a real
tail (idle and W-only lose with a warning; careful hands keep him; careless
hands lose him at corners). **Phase b is the problem now: one round anywhere
on his car and then a bump from behind puts him off the road** - and a player
who closes in to shoot bumps him without meaning to. Fix that first, then the
chapter card that never shows when coming in by the cut, then the length of
phase b.

---------------------------------------------------------------------------
## Findings, most felt first

### 1. BLOCKER: after one round lands, any bump from behind ends phase b (my shots do not cause the crash)
- **What.** On the river road, one round anywhere on his car (a body graze,
  the rear window) and then my car into his back at speed: he loses it and
  spins off. Frozen session, by trusted input, my player aiming once at his
  roof then holding W into him: **2 of 2, and a 3rd for the frames**: one
  round at 30 to 35 m, the crash 3.4 to 4.4 s later at a bump (gap 5.2 m),
  with 5 rounds still in the cylinder. And without meaning to: in my first
  natural run with the good hands (follow at his speed, aim at a tyre), 2
  shots, **1 body hit**, he slowed after it, my car closed in, touched him, and
  he went off 1.4 s later (`hisDmg` body 1, nothing else). A player who drives
  up close to shoot will see this as "I grazed him and he crashed by himself".
  Frame `01_one_round_then_a_bump_wins` (his car slewed across my bonnet;
  the one round was `05_the_one_round_35m`).
- **Steps.** `NOIR_PORT=5343 node tools/stepplay.mjs --url "/?mute=1&start=tail.river" --dir <d> --size 1440x900 --status tools/plays/critic/c3c2_status.js --ready "G.state === 'playing' && !!G.scenes.ctx.flags.chase && G.scenes.ctx.flags.chase.phase === 'b' && !G.scenes.fadeK"`,
  then `SEED=41 node tools/plays/critic/c3c2_drive.mjs <d> ram one 30 0.25 c`
  (`ram`: once a round has landed, W held straight at his car; `one`: one
  round at his roof from behind, then the gun goes back in).
- **Why** (`src/scenes/tail/chase.js` `rammed`):
  - line 463: `hurt = ... tyres || man || tank ... || D.control < 1` - any one
    round makes him "hurt" (a body graze costs 0.12 of his 1.0 hold);
  - line 462: `quarter = Math.abs(l.x) > 0.6` - `l.x` is along his car, so
    his rear bumper counts as "the quarter": a straight rear-end qualifies;
  - line 464: `e.imp > 2.5 && quarter && hurt` -> `D.lose(...)`: the whole
    contest decided by one touch. (My car tops 72 km/h, his ~55: closing in
    is easy and a bump is the natural end of closing in.)
- **Fix.** The brief's ram is for a dry gun on a hurt car. Make "hurt" mean
  really hurt (a tyre gone, or the man hit twice, or his control under 0.5)
  and "the quarter" the side behind the rear wheel (`l.x < -1.2 &&
  |l.z| > 0.55`, the shunt that spins a car), never a straight rear-end; or
  let a ram cost control like a round (0.2 to 0.3, his car jolted) instead of
  ending it. The play to pass: `ram one` must not end phase b on the bump.

### 2. MAJOR: in by the cut from V, the chapter is never named (the small card never shows)
- **What.** The seam (C3_CITY.md 5): "chapter VI's card is lettered small over
  the windscreen as I pull out". From V The Watcher, warm then
  `scenes.go('tail', { beat: 'start', fade: 'cut', card: false })`, W held:
  no card at all, in 3 of 3 runs; the `.c3card` element is never even made.
  A player who plays through from the title never sees "VI THE TAIL".
  Frame `02_seam_no_chapter_card` (pulling out, 4 s after the cut).
- **Steps.** `NOIR_PORT=5343 node tools/play.mjs tools/plays/critic/tail_seam_frames.json --size 1440x900`
  (FAILS: "the chapter's card lettered small over the windscreen as I pull out").
- **Why.** `src/scenes/07_tail.js` line 129: `smallCard = !G.hud.cardT && ...`.
  After any chapter card has run (V's own), `src/ui/Hud.js` lines 444-447
  leave `cardT` at -1/60 (it is decremented past 0), so `!G.hud.cardT` is
  false and line 142 never calls `K.smallCard`. Only a session that has never
  shown a card would see it.
- **Fix.** `!(G.hud.cardT > 0)` (and check line 142 passes the numeral and the
  name the way `kit.smallCard(num, name)` wants them: `D.title, D.name`).

### 3. MAJOR: phase b is still short and forgiving; the clumsy hand never fails it
- **What.** From the river road's checkpoint, every hand that aims at all
  wins the first try, before the river road's traffic matters:
  - sloppy aim (slow, shaky, fires early; `bad sloppy`, `good sloppy`):
    **3 of 3 first-try wins**, 4 to 10 shots, 3 to 4 hits, his crash 8 to 12 s
    after the checkpoint; no "He's nearly at the pier." in any;
  - good aim (`good aim`): 4 of 4, 3 to 4 shots, 3 hits, 3 to 10 s;
  - lazy hands (steer at him, RMB held, LMB twice a second, mouse never
    moved, bump): 0 hits in 3 tries ("He warned them.", fair), a tyre and the
    bump on the 4th.
  Three hits end it: a tyre 0.4 + the rim 0.25 + the tank 0.22 of his hold
  (`chase.js` `hisHit` lines 349, 378, 383, 406). The first slow car of the
  river road is placed 58 m ahead of him (`traffic.js` `riverTraffic`, line
  148): he reaches it ~7 s in, about when he goes down, so the "steer round
  traffic while aiming" of the brief barely happens. (The owner's own proof
  says 14 to 33 s; my hands, which aim less well than his, end it faster
  because they do not wait for a tyre.) WAVE_C 7.4: the clumsy hand should
  fail some.
- **Steps.** In the river session above: `SEED=31 node tools/plays/critic/c3c2_drive.mjs <d> bad sloppy 90 5 c`
  (and 32, 111); `good aim` with 21, 22.
- **Fix** (after 1): one more hit to finish him (control costs down a third,
  or the crash only from two tyres, the man three times, the fire, or a real
  quarter ram); the first river car 20 to 30 m ahead of him and a parked
  lorry or a stall on his lane in the first 150 m, so he swerves and I must
  steer while the gun is out.

### 4. MINOR: the warning of the failed try comes back for 0.4 s as the retry starts
- **What.** After every "LOST HIM." / "HE WARNED THEM." black, the last
  warning ("He's getting away." / "He's nearly at the pier.") is lettered
  over the scene again as it comes up from black, then fades: seen after
  every one of the 20-odd fails in my runs (the screen's line logged 0.35 to
  0.4 s into each retry). The player reads "He's getting away." at the
  checkpoint with his car 30 m ahead. Frame `03_old_warning_after_lost_him`.
- **Why.** `src/game/Game.js` `fail()` (line 510) calls `this.hud.kit.clearWarn()`
  without `{ now: true }`: `src/ui/kit.js` (lines 323-324, 359) fades the line
  over 0.4 s of game time, and game time is stopped under the black, so the
  fade happens after it. (A C1 file: every chapter has it; this one fails
  often.)
- **Fix.** `clearWarn({ now: true })` in `fail()`.

### 5. MINOR: "Wrecked." has no warning line
- **What.** Into the canal rail at 50 km/h three times (phase a): 1.46,
  2.93, then "WRECKED." No line at any step; at 2.93 the frame shows a crack
  and a lamp less (`06_two_steps_of_damage_no_line`). WAVE_C 1.2 wants a
  warning before every fail; a first-timer does not know the third hit is the
  last. (My careless hands carried 1.0 to 1.9 damage through most tries.)
- **Fix.** At the third step (`chase.js` `showDamage`, damage >= 3) the kit's
  warning until the checkpoint mends it: "She won't take another." (or the
  like).

### 6. MINOR: the chase2 checkpoint still meets the van on the inside of the Baxter turn
- **What.** From "Lost him." in the second half, back on Canal St: my good
  hands (which kept him clean from the kerb in 3 of 3 full runs) hit the van
  parked on Baxter's west kerb just past the corner on **6 of 6 retries**
  (33 km/h into the right turn on his line, stopped dead at (-29.4, -240.3),
  then lost him). At the checkpoint he is 30 to 45 m ahead and already round
  the corner, so the line into the turn is the inside one. Frame
  `04_baxter_van_on_the_inside_line`. The first look saw the same; the owner
  slowed the start (25 km/h), which does not move the van.
- **Fix.** Move that van 15 m down Baxter or to its east kerb, or leave the
  first 12 m of the west kerb past the corner clear.

### 7. MINOR: E by his wreck answers nothing
- **What.** Stopped beside his wreck on the river road, E: no prompt, no line,
  nothing (`07_by_his_wreck_E_answers_nothing`). It is the first thing a
  curious player tries there (WAVE_C 1.7: a small answer for anything tried).
  The brief allows not getting out; then say so once: a line ("No time.
  Pier 9.") or the head turning to him.

### 8. MINOR (polish)
- **A good player always sees the same film.** Three clean runs from the kerb:
  his route identical to the metre (the route choice reads only my gap, and
  good hands keep it the same). The brief: "so a retry is not the same film".
  A random pick between the two at each leg when I am near would do.
- **The drive card waits for a W press it never gets** when W is already down
  as it appears (W held from BEGIN): it stays its full 6 s over the road.
- **The seam's cost moves with the machine's load**: three runs of
  `tail_seam_frames`: the cut 36 / 52 / 37 ms + a first frame of 69 / 59 / 121
  ms (stall 105 / 110 / 158 ms); the warm's longest call 27 / 28 / 91 ms, 3 to 6
  over 16 ms. Eight programs still compile at the cut (the cast's cloth, the
  id pass's, the headlamp pool, the tail screen, a lambert and a physical):
  warm them with the rest and the first frame drops.
- **Whites are scarce** (the owner's Left 1): the river road with the gun out
  54 to 58 % black, 2 to 3 % white, 30 to 34 % mid-grey (the reference 52 / 6 /
  27); the streets 74 to 91 % black and 0 to 1 % white. The river road is no
  longer grey; it is short of lamp light.
- **I reach the pier with 9 rounds** in a good run (the story: an empty gun).
  VII's to say, but the tail could spend them (see 3).

---------------------------------------------------------------------------
## The first list, in play

| # | first finding | now | what I saw |
| --- | --- | --- | --- |
| 1 | B: LMB alone wins phase b | fixed | `tail_b_noaim` 5 shots 0 hits; `tail_b_rmbspam` 6 / 0; W held + RMB + LMB spam (`tail_b_wram`) 12 / 0, he reached the pier; no snap of the eye |
| 2 | B: fruit in the cabin | fixed | four ploughs (the wharf market at 50 km/h, the square's row of eight): 0 frames with a piece inside my car's body (`c3c2_plough.mjs`); the planks tangle in front of the glass for a moment, outside it |
| 3 | M: a walker into a facade | fixed | 7 approaches at 40 km/h on the 3 walkers (on their line and off it): they jump into the road, never into brick, never nearer than 0.95 m to my body (`c3c2_walker.mjs`) |
| 4 | M: the driving keys never readable | fixed | the drive card 6.25 s; the handbrake card as his lamps flare for his first corner; the gun card as the river road begins; each again after two fails (seen for the gun and the handbrake) |
| 5 | M: a gallery; a hit does not show | half | a tyre hit at 27 m shows: a white puff at the wheel and the quarter down (~10 px of white at 1440); a rim hit, a lean; but phase b is still a gallery (finding 3) and can be ended by a bump (finding 1) |
| 6 | M: wave B order and its own kit | fixed | VI THE TAIL, then VII PIER NINE; the beats' lines from the first second and at each change; `game.fail`'s black with the why |
| 7 | M: the seam stalls | mostly | ~0.1 to 0.16 s at the cut (was ~0.8), no black, no card on black; but the small card never shows (finding 2) |
| 8 | M: the river road grey | mostly | 54-58 / 2-3 / 30-34 % (was 44-49 / 3-5 / 43-44); short of whites (8) |
| 9 | M: things in the way cost nothing; traffic not in the way | fixed | eight stalls: 52 -> 20..27 km/h, 0.94 damage; a lamp post 1.08 damage and out 0.27 s after; a car I face stops at 9 m, backs off at 2 s, goes round in ~8 s with its lamps on; traffic ahead of him in phase a and on the river road |
| 10 | m: far behind at the river road | fixed | "He's getting away." at once at 85 m, "Lost him." 3.6 s later |
| 10 | m: chase2 into the Baxter van | not fixed | finding 6 |
| 10 | m: a bent post stays lit | fixed | `on` false 0.27 s after the blow |
| 10 | m: the yard bare; the sign points right | fixed | the PIER 9 signs point straight on; `E get out` came at the bay (133.4, 171.1) |
| 10 | m: fps at the square | not re-measured | (one fps run only; see the frame rate) |

---------------------------------------------------------------------------
## The three proofs, mine (every contest)

| contest | idle (hands off / W only) | bad | good |
| --- | --- | --- | --- |
| **a, the tail** | from the title, hands off (`tail_idle_title`, real time): "He's getting away." then "Lost him." ~16 s in; W only (`tail_wonly`): into him, off a wall, down the wrong street at 69 km/h, the warning, "Lost him." 3.9 s later; back at the kerb in under 2 s | `bad` hands (late brakes, a wrong key now and then): through on the 1st try, 83 s, never warned; `rough` hands (corners 10 km/h too fast, more wrong keys): lost him at corners 7 times in 240 s and 10 in 300 s (my bot reverses badly, so a floor, not a measure) | through, 80 s, no warning, 3 of 3 from the kerb (the same route each time) |
| **b, stop him** | hands off at the river road: the warning 6 s in, "Lost him." 3.6 s later (x4); followed but never shot at: "He's nearly at the pier.", "He warned them." 5 to 10 s later (x2) | sloppy aim: 3 of 3 won on the first try in 8 to 12 s (finding 3); lazy spam (steer at him, RMB, LMB spam, bump) 1 of 4 | 4 of 4 in 3 to 10 s; one round + a bump 3 of 3 (finding 1) |
| **c, Pier 9** | (no contest: nothing fails there) | - | my player drove from his wreck to the bay in 34 s; E; the doors; VII |

Every fail had its line first ("He's getting away." 2.9 to 6.7 s before "Lost
him.", "He's nearly at the pier." 5 to 10 s before "He warned them."),
except "Wrecked." (finding 5). The teach card came again after two fails at
the beat. No error in the page in any play.

---------------------------------------------------------------------------
## Exploring (the jank walk)

- **Edges** (my car at 50 km/h into each, W then S): the rail yard (west), the
  depot wall (south), the canal rail (north, twice), the river rail (east), the
  el's column by the pier road, the far corners: all stop me, all are things I
  can see, no launch (height 0), 1.3 to 1.7 damage, and S frees every one
  (3 to 3.6 m) (`c3c2_edges.mjs`).
- **Stuck?** Turning round in the alley through the block south of the
  avenue: wedged across it at 0.8 rad; W and S alone do nothing, S with the
  other lock frees it. A player gets out.
- **No car through a car**: the deepest overlap of any two cars' boxes, every 4
  frames, through 3 full runs, the careless runs and the phase b runs: never
  over 0.15 m. Rammed him at 72 km/h: no overlap.
- **People**: the walkers as above; nobody under a car.
- **Keys in the car**: E at the kerb and on the river road, F, C, R, Q: nothing
  breaks; E answers only at the pier's bay (and not at his wreck: 7). Mouse
  look turns my head in the cabin and eases back.
- **Things that give**: the stalls, crates, barrels and a lamp post as
  measured; what bursts over the bonnet stays outside the glass.
- **The yard**: the lorry and the stacks are there; I did not walk it on foot
  (E ends the chapter).

---------------------------------------------------------------------------
## Cheats and losses without a tell (from the code)

- `src/scenes/tail/chase.js` lines 462-464 (`rammed`): any one round makes
  him "hurt" and any bump off his middle (his rear bumper included) puts him
  off the road: the contest decided by a touch (finding 1). **Must change.**
- `chase.js` line 137 `sees()`: in sight unless a wall, fence, the works or the
  gate is between; parked cars, traffic, the el and distance never hide him.
  Generous (only delays "Lost him."), written down by the owner; unchanged.
- No rubber band: `his.js` drives his own pace (duck, hurt, weave); my gap only
  picks his next leg (line 69). No mercy tyre, no scripted crash: `D.lose` only
  from my rounds (two tyres, his hold at 0.15), the fire my rounds lit
  (`chase.js` ~663) and the ram above.
- `src/vehicles/Car.js` line 227: a yaw assist toward the steered rate (the
  car's stability, same for every car). Fine.
- The gun reloads itself on an empty cylinder (R also works): not a cheat.
- `?c3auto=good|bad` and `?tailGun=1`, `?tailAt`: URL only (debug).
- Loss without a tell: "Wrecked." (finding 5).

---------------------------------------------------------------------------
## The user's asks, as played

| # | ask | met | what I saw |
| --- | --- | --- | --- |
| 1 | a city with real turns; the driving a pleasure | yes | a grid of junctions, an alley, the square, the river road; handbrake from 50: 1.1 rad in 0.8 s down to 21 km/h, then W+A: round a right angle in ~12 m; S from 50 to 4 km/h in 1.5 s, 12 m; flat out ~72; the head looks round the cabin |
| 2 | really tail him, can lose him | yes | idle loses in ~16 s, W only in ~26 s, each with the warning ~4 s first; careful hands keep him (3 of 3 from the kerb); careless corners lose him; he waits for nobody |
| 3 | traffic and obstacles not trivial; destruction; not fast | yes | traffic on his line and on the river road, a car that backs off and goes round; stalls cost a third of the speed and some damage; things burst and scatter; ~72 top |
| 4 | my shots cause the crash; each hit shows and matters | **no** | only my doing crashes him, but one round + a bump does it (1); hits show modestly (a puff, the quarter down) |
| 5 | drive to Pier 9 myself by landmarks and signs | yes | PIER 9 signs straight on, the crane, the shed; 34 s; the painted bay, E |
| 6 | nothing through anything; real edges; never stuck | yes | overlap probe never over 0.15 m; edges solid and visible; every wedge freed by reversing |
| 7 | always clear what to do; gun and handbrake taught | yes, but | the line from the first second and at each change, the cards at their moment; but a stale warning at each retry (4), no line before "Wrecked." (5) |
| 8 | the seam: no fade, no card on black, warmed without a hitch | partly | no fade, no black card, ~0.1 to 0.16 s at the cut; the chapter is never named on that path (2); C6's end not testable here |
| 9 | every frame the ink; the frame rate of perf | yes | the river road under the el is the reference's picture (`08`); short of whites (8); 41.3 fps at the river road with the gun out against `shot=perf` 33.9 measured just before it (1.22 x; the GPU 100 % busy with other work, so ratios only) |

---------------------------------------------------------------------------
## Good: keep it, do not break it

- His driver on no leash; the warning then the fail, back at the checkpoint in
  under 2 s; the teach card again after two fails.
- The car: weight, the handbrake swing, brakes that stop, the cabin's look
  round; damage that shows (the crack, a lamp out).
- The first list's fixes: no aim of the game's own, `guardBody`, the walkers'
  jump, the cards' timing, stalls that cost, the head-on car that goes round,
  the bent post going out, PIER 9 signs straight on, the yard's bay.
- A solid city: every edge a thing, no car in a car, reverse frees everything.
- The river road under the el in the rain with his red lamps ahead
  (`08_keep_the_river_road_under_the_el`): this is the reference.
- The seam's warm (~0.1 s at the cut, from ~0.8).

---------------------------------------------------------------------------
## The owner's Left, as a player would feel it

1 (whites) seen, minor. 2 (clumsy hands vary) fine: my careless hands lose
him at corners, my clumsy ones get through. 3 / 4 (the seam's 0.1 s, C6
untested) fine, but the small card is broken (2). **5 (phase b length) is
felt, and worse than the report says**: 7 to 12 s with sloppy aim, and the
bump (1) is not in the report at all. 6 (thin traces out of sight) felt in
phase a at corners only by a player who is already far back (muted, I could
not judge the horn). 7 (unlit lenses on traffic) not seen: the head-on car's
lamps were on. 8 (a red ring under his car) seen as red dashes under him on
the wet at 18 to 30 m: minor. 9 (planks over the glass) seen, fine. 10
(`sees()`) fine. 11 (no getting out at the wreck) felt: 7. 12-14 fine.

---------------------------------------------------------------------------
## My plays and tools (tools/plays/critic/)

| file | what | today |
| --- | --- | --- |
| `tail_idle_title.json` | from the title, hands off, the screen every 1.5 s | passes (lost ~16 s, warned first) |
| `tail_wonly.json` | from the title, W held only | passes (lost, warned 3.9 s) |
| `tail_b_wram.json` | phase b: W held, RMB, LMB spam, mouse still | passes (0 hits, he reaches the pier) |
| `tail_seam_frames.json` | the seam from V with frames and a watch for the small card | **FAILS** (finding 2) |
| `c3c2_drive.mjs` (+ `c3c2_status.js`, `c3c2_proj.js`, `c3c2_cmd.mjs`) | my player for a `stepplay` session: drives `good / bad / rough / ram / idle / w`, guns `aim / sloppy / one / tap / rmbspam / none`; logs the lines on screen, fails, hits, overlaps; `HITSHOTS=1` frames each hit and the crash | see the proofs |
| `c3c2_plough.mjs` | my car through a thing: pieces inside its body each 2 frames | 0 |
| `c3c2_walker.mjs` | my car at a walker on his pavement | never in a wall |
| `c3c2_edges.mjs` | my car into the city's edges, then reverse | all solid, all freed |

The first look's plays still in the folder: `tail_b_noaim`, `tail_b_rmbspam`,
`tail_teach`, `tail_walker_wall` pass today; `tail_square_fps` not run (one
fps measure only); `c3c_*` are its tools.
Run: `NOIR_PORT=5343 node tools/play.mjs tools/plays/critic/<play>.json --size 1440x900`.

## Frames (docs/story/review/wave-c/C3/critic/2nd/)

`01_one_round_then_a_bump_wins` (1), `02_seam_no_chapter_card` (2),
`03_old_warning_after_lost_him` (4), `04_baxter_van_on_the_inside_line` (6),
`05_the_one_round_35m` (1: the round through his rear window that made him
"hurt"), `06_two_steps_of_damage_no_line` (5),
`07_by_his_wreck_E_answers_nothing` (7), `08_keep_the_river_road_under_the_el`
(Good). The first look's frames stay in `critic/` (the owner's report cites
them).

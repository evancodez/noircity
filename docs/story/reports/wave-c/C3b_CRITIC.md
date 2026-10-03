# C3b critic: chapter VI The Tail, played cold (2026-10-03)

The critic did not build this lane. Everything below was seen in play, by real
input, before reading the owner's report: one hand-played session (a
frozen-clock `tools/stepplay.mjs`, one move at a time, frames looked at), and
the critic's own bot `tools/plays/critic/c3b_drive.mjs` (C3's critic driver
plus a shunt approach as I did it by hand). Port 5343, muted, one Chrome.

Frames: `docs/story/review/wave-c/C3b/critic/` (1440 x 900).

## Findings, most felt first

### 1. BLOCKER: "Lost him." with him 15 m ahead in plain view; "He's pulling away." while he is not (ask 6)

- Steps: `/?mute=1&start=tail.river`. Shoot him (one round takes a tyre), then
  follow at 10 to 16 m and never shunt. From 16 s "He's pulling away." is up,
  but he does not pull away: hurt, his getaway is `RIVER_B.awayHurt` 15 m/s
  (54 km/h) and my coupe does 69 km/h, so the gap stays 15 m. At about 34 s:
  black, "Lost him.", with his car filling the middle of my windscreen the
  frame before (frame `02_lost_him_15m_ahead`: his tail lamps 15 m ahead,
  "He's pulling away." under them). The critic's run: 12 rounds landed (2
  tyres, 9 rims, the tank), fail at bT 33.7 s with gap 15.8 m.
- The same lie the other way: glued on his back corner, him hurt, my bot held
  5.3 m for 15 s with "He's pulling away." up (his car filling the right half
  of the screen), then "He's nearly at the pier.", then "He warned them." at
  the gate. Never once did he speed away.
- The user asked: after enough time "it speeds away". What plays is a timer
  that ends the contest and words the screen contradicts. Make the getaway
  real: when the window runs out he finds speed I cannot match even hurt (a
  last burst over my top speed, the limp and the smoke still on him) and the
  fail comes only when he is actually gone (gap past `lostGap`, or out of
  sight); drop the clause that loses at a fixed time whatever the gap.
- Files: `src/scenes/tail/chase.js` rules(), the last line (`this.bT > B.t +
  B.extra + 8` loses at any gap, and `gap > 25` at 26 s); `src/scenes/tail/his.js`
  pullStep (`awayHurt`); `src/scenes/tail/rules.js` RIVER_B.

### 2. BLOCKER: in the streets I sat on his bumper and he hit a pillar and stuck there 26 s (ask 1)

- Steps: `/?mute=1&start=tail`, W held, steer straight at his car (the
  critic's bot `close`, which is what a player who wants to ram him does).
  From 40 s to 45.5 s the gap stayed 5.0 to 5.3 m (bumper to bumper) while we
  both went from 26 to 63 km/h: his burst did not open a gap on that straight.
  At 45.5 s, under the el at about (-90, -40), he hit something at 63 km/h and
  stopped dead, I went into his back (my damage 1.2 to 3.1, "She won't take
  much more."). From 45.5 s to at least 71.7 s his car stayed within 2 m of
  that spot, backing a metre or two and going into it again (frame
  `01_wedged_at_a_pillar_phase_a`, him stopped by the el's column). Nothing
  ends this while I wait in sight of him: the chase cannot go on. (It ended
  only because my bot drove away and lost him.)
- The ask was: I can graze his bumper and nothing more; I cannot ram him off
  the road. Here I stayed on his bumper and he came off his line into the
  iron. Two things: the burst must beat a car already on his bumper (his
  path's corner speeds and the cool-down let me hold 5 m for 5 s), and his
  own crash in phase a needs an answer (he gets free: backs out to the
  open side, or is put back on his path when not in my view).
- Files: `src/scenes/tail/his.js` pullStep / burst (PULL.cool, path speeds),
  `src/vehicles/pilot.js` 162-177 (the stuck back-off loops against the same
  column), `src/scenes/tail/chase.js` (no rule for his own wedge in phase a).

### 3. MAJOR: a push on his back corner with my car straight does nothing, for as long as I hold it

- Steps: river road, hurt him, put my nose on his back corner a metre off his
  line and keep W. The card says `[A] [D] shunt his back corner`; I am on his
  back corner; nothing happens (my bot held it 15 s, gap 5.3 m, then lost at
  the gate). Alongside him (easy: hurt he slows to 21 to 29 km/h and I come
  past) nothing happens either. By hand it worked when I dropped back to ~6 m,
  turned in about 0.2 rad (12 degrees) and closed at ~3 m/s: then he went
  round at once. My bot doing the same approach landed it on 1 of 3 tries
  that were not ended by the stalls.
- A first-timer pushes the corner straight. Either count a held push on the
  corner with a smaller angle (`RAM.yaw0` 0.2 is the wall he hits), or answer
  a near miss visibly (his tail steps out a little and the sound) so he knows
  to turn in harder; and the card could say "turn into his back corner".
- Files: `src/scenes/tail/rules.js` RAM, `src/scenes/tail/chase.js` rammed().

### 4. MAJOR: the crash ends as a parked car (ask 3: "make it look cool")

- The spin reads well: the shunt, his car sideways across the road in front
  of me, tyre smoke, round once more, the slowdown, my wheel in my hands
  (frame `03_the_spin`). Then he slides on and comes to rest square along the
  river rail, body whole, lamps on, no dent, no glass, no steam I could see
  from my seat or on foot (frame `04_wreck_parked_by_the_rail`: it looks like
  a car parked at the kerb with a man crouched beside it). Both my wins ended
  like this. In the first, the dropped bumper on the road was the only mark.
- Wanted: the last knock hard and seen (into a lamp post, a stall, the rail at
  an angle), the car left skewed, the corner that hit crumpled, a lamp broken,
  the bonnet sprung and steaming, glass on the road.
- Files: `src/scenes/tail/chase.js` crashing / wrecked2 / wreckStep, `src/scenes/tail/his.js` crashing.

### 5. MAJOR: the objective stays "See to the driver." after he has said Pier 9

- Steps: wreck, `E get out`, walk to him: "Pier nine. Tonight." (good). The
  objective still says "See to the driver." for as long as I stand there (6 s
  and more); it changes to "Pier 9." only once I am back in my seat. After
  the line it should say where to go at once.
- Files: `src/scenes/07_tail.js` objectives, `src/scenes/tail/chase.js` sayLine.

### 6. MAJOR: the man's pointing arm is a flat white slab; walking up, my eye stands over his head

- Frame `05_the_mans_arm`: the arm up and out is a long flat white board with
  a dark lump at its end, at the very moment the chapter pays off. Walked up
  to him the eye ends up over his head (his crown fills the bottom of the
  frame). Owner's left #5 knows the arm; it reads worse than "less from the
  front": it reads unfinished.
- Files: `src/cast/kinds/tail_trucker.js` (`tail_point`), `chase.js` atWreck (how close the eye may come).

### 7. MINOR: polish

- The first E after getting out is swallowed: `E get in` appears about a
  second after the door; a tap in that second does nothing.
- The cut at Pier 9 (frame `06_pier_by_a_cut`): no black, the small card
  "VII PIER NINE", "Get inside. Quietly." at once: as asked. But the picture
  jumps: the river road's lit night at the gate becomes a flat grey sky and a
  different car position by the PIER 9 shed. Felt as a cut, not as arriving.
- The market stalls on the right of the river road hold a car for seconds in
  debris; four of my bot's six river-road tries ended there (far behind,
  "Lost him."). Fair (it is the player's swerve), but heavy.
- The aim mark when leaning out is a dot a few pixels wide; on the wet glare
  it is easy to lose.

## Ask 7 (nothing else changed)

`python3 tools/golden.py check` once at the end: 32 of 32 identical. In play the
city, the streets and the chapter's look were as in lane C3.

## The proofs (mine)

| contest | idle | bad | good |
| --- | --- | --- | --- |
| phase a, the streets | hands off from the title: "He's getting away." then "Lost him." in under 24 s, warned 1.5 s+ (`critic/tail_idle_title.json`, 3/3 PASS). W only: "He's getting away." at 19.9 s, "Lost him." at 24 s. | (the bot's corners are clumsy: one "Lost him." in the streets, then through) | through in the streets by the bot's trail-following; the full chapter won once from the kerb |
| phase b, the river road | hands off: "He's pulling away." up, "Lost him." at ~24 s, back at the river road. | the bot (`pit tyre`, seed 11): 5 fails (4 in the stalls or far behind, 1 glued behind with no shunt), never stuck, won on the 6th | by hand: one tyre at 21 m (the dot on his rear tyre, LMB), gun in, back to 6 m, a 12-degree turn into his back corner: he spun at once, first deliberate try. Not twice in a row: my bot is not as good as my hands (finding 3). |

The gun-only proof (ask 2) is finding 1's run: 12 hits, never ended by
rounds, lost at the window. The wedge (finding 2) was the `close` bot.

## Cheats read in the code

- `src/scenes/tail/chase.js` rules(), last line: `this.bT > B.t + B.extra + 8`
  loses at a fixed time whatever the gap (with the warning up, but the
  warning says something the screen does not show). A timer ending the
  contest.
- `src/scenes/tail/his.js` pullStep: a hurt car's getaway (`RIVER_B.awayHurt`
  15 m/s) is slower than my coupe, so "he speeds away" can never happen once
  he is hurt; the window is decided by the clock alone.
- `src/scenes/tail/chase.js` crashing(): `this.crashT > 7` freezes his car
  where it is (`wrecked2`: frozen, velocity zero) even if it is still sliding:
  a pop if a spin runs long. Not seen in play.
- Nothing that wins for the player: rounds floor at `HIT.floor` 0.35, the
  shunt needs its geometry, the line is said even if I skip him (story only).

## What is good and must not be broken

- One round in a tyre takes it: the bang, he slows and weaves, the card for the
  shunt comes at that moment. Rounds alone never end it.
- The shunt, when it lands, is the cars' own physics: he goes round in front of
  me, sideways across the road, smoke, and I keep my wheel. That is the moment
  the user wanted.
- Out of the car: the man down on one knee by his car, the bowler gone, one
  line ("Pier nine. Tonight."), no interrogation, no camera taken.
- Skipping him works: back in, he calls the line as I get in; never stuck.
- The pier: `E get out` at the gate and VII starts with no black and the small
  card.
- Hands off and W-only lose in the streets with the warning first; hands off
  loses on the river road.

## Owner's left list, as a player would feel it

1. The spin against my wing: not seen; the spin cleared me both times.
2. No late turn or cut through traffic: felt as finding 2 (holding his bumper is
   possible and he has no trick but the burst).
3. Clumsy hands can fail phase b: yes, my bot failed five times (no doubt left).
4. Whole-car shunt proof flaky: not tested.
5. The man's point: felt, worse than written (finding 6).
6. and 7. (old plays, the headless bench): not felt by a player.

## The critic's plays

- `tools/plays/critic/c3b_drive.mjs`: drives a stepplay session; drives
  `close` (flat out at his car in phase a), `pit` / `pitbad` / `pitrough` (the
  shunt approach after a hit in phase b), guns `tyre` (one tyre then the gun
  in), `aim`, `none`; stop `b`, `out`, `wreck`, `end`.
- `tools/plays/critic/c3b_s.sh` (a batch of moves, a short status line),
  `c3b_m.py` (moves with his car projected on the screen), `c3b_face.js`
  (the eye's place and heading on foot).

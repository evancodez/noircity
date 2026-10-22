# G4 — the cars: V The Tail polished, VI The Run built (the pursuit, with destruction)

Branch `game-two/G4-cars`, port 5364. The city stage (`src/stages/city/`,
lanes C3 and C3c: plan, layout, route, the neon), the cars
(`src/vehicles/Car.js`, `Vehicle.js`, `pilot.js`, `models.js`, `cabin.js`;
the drive mode `src/player/modes/drive.js`; the pad's analogue triggers),
the tail (`src/scenes/07_tail.js`, `scenes/tail/*`: `his.js` the driver I
follow, `chase.js` the rules and the ram, `gun.js` the window gun,
`traffic.js`, `rules.js`; reports `C3.md`, `C3b.md`, `C3c.md` and their
`Left`), destruction (`src/destruct/`). The user's words:

- **[must]** "the chase sections, the car sections": "way smoother",
  "destruction is good, environment is good".
- **[must]** "Adding more... just action based sections."
- Still binding from wave C and his tail notes: he speeds up when I catch
  him; the gun hurts, the shunt on his back corner spins him; no
  interrogation (he says "Pier 9." from the wreck); no cutscene into the
  pier; the fail is that he gets away; the car accelerates when turning
  at low speed (fixed in `Car.js`, keep it); the neon.

## 1. The car's feel (GAME_TWO §1 A), for both chapters
1. **Steering a hand can trust.** On the keyboard the steer eases in and
   out at a rate that matches the speed (quick at a crawl, measured at
   60 km/h), with a small counter-steer help when the back steps out so
   a slide is caught by letting go, not by fighting. On the stick it is
   analogue as C12 left it. Measure: W to the first frame of motion and
   A to the first frame of the wheel turning, under 50 ms.
2. **Weight.** The cabin leans and lags a touch in a turn and under the
   brake; the horizon stays level; a kerb is felt; the handbrake (SPACE)
   sets the back out at once and the car comes round readable. No pop in
   the camera at a mode change or a retry.
3. **Collision that never sticks.** A wall, a column, a parked car: a
   jolt, the speed scrubbed, the body marked, and reverse always gets me
   out (the Pilot's un-stick for the bots, my own for me: a car wedged
   nose-in backs free on S). Never through anything (`tools/lib/c3jank.mjs`
   and `c3pier.mjs` stay green).
4. **My car has damage.** A pool (steam from the bonnet, then smoke; a
   pull to one side; top speed down) and an end: `The car's done for.`
   warned, then `Wrecked.` A tyre shot out is felt (the pull). Repairs:
   none; the retry gives the checkpoint's car.
5. **Sound**: the engine's note by the revs, the tyres, the scrape, the
   hits; a horn (Q).

## 2. V The Tail, polished
The chapter works; make it smooth and in the middle. C3b's Left 1 (the
spin that stops against my wing: a clear-me window), 2 (his late turn
and his cut through traffic in the streets: one each, telegraphed by
his indicator lamp), C12's Left 3 (aiming out of the window on the
stick: a slower look while leaning); `tail_medium` through in one to
three tries of the streets and of the river road; the nudge (a player
who has lost him twice to distance gets `[SHIFT]`... no: the throttle is
W; the card is the objective's `Stay on his lamps.` re-struck and the
first lamp's glow louder; a player on his bumper for 6 s on the river
road with the gun away gets `[RMB] lean out` again, once). The `pier`
beat now ends the chapter: as I pull away from the wreck, VI begins
(`ctx.next()`), no fade.

## 3. VI The Run, new (`src/scenes/07b_run.js`, `scenes/run/*`)
The pursuit from the wreck to the pier's gate, about two minutes, on
the city's streets (the route planned on the existing plan; the pier is
a place on the map). Beats and the contest in each:
1. `away`: I get in (E), the still `THEY SAW.` (headlamps in the mirror,
   lane C9's style: a still of your own if time, else the kit's card
   stands in), the box of rounds in the glovebox (E in the cabin: the
   cylinder filled, `[R] reload` taught here if not before). Objective
   `Lose them. The pier.` Two of the Cardinal's saloons behind me, red
   lamps, a third one later.
2. `streets`: they hunt me. Their driver goes for my back corner (the
   same shunt physics as mine on him in V: a hit sets me sliding and I
   catch it or spin), then backs off a beat (so a run can be driven, not
   only shot). One man leans out of the lead car and fires at my car (my
   damage; his tell is the lean and the glint). My answers: drive (the
   handbrake at corners, traffic as a wall they hit when I thread it),
   ram them into things (a column, a parked car, a stall: their damage),
   shoot (RMB lean, LMB) at the driver or the tyres. A car wrecked is
   wrecked where it crashed (the Wreck: steam, the body twisted, glass
   on the road), physical. A car I out-drive for 12 s is lost (`Lost
   one.`); it comes back later from a side street if the chapter wants
   it. Traffic: real, not trivial, never through anything.
3. `quay`: the last stretch along the water: a third car blocks the quay
   road ahead (it comes out of a yard, telegraphed by its lamps); the
   way is through the market's stalls or the yard beside (a fork, both
   visible), destruction the player causes (stalls, crates, a lamp, a
   hydrant's water, the yard's fence), and the gate.
4. `gate`: through the pier's gate; VII begins at once, as the tail's
   pier beat did (no cutscene).
Fail: `Wrecked.` (my car dead, warned), or boxed (two cars on me and
stopped for 4 s: `They had you.`, warned `Move!`). Never a timer.
Win: the gate, with them wrecked, lost or still behind (a car still on
me at the gate is fine: the gate's men take it as the story: they know).
The middle: `run_medium` one to three tries; `run_good` twice;
`run_bad` by the fourth; `run_idle` wrecked or boxed, warned.

## 4. Destruction (GAME_TWO §1 C3), the city's things
A set the city gets from this lane, physical and capped: stalls (the
market's, already there) that go over and spill, crates and bins, the
newsstand, a lamp post that leans and goes out, a hydrant (water, a
thing to drive through), shop glass that breaks where a car or a round
goes, fences, a parked car shunted (it moves, it is marked). Each in a
few ink strokes, with a sound, pooled so the frame rate holds (fps at
the quay with everything going over, against `shot=perf`).

## 5. Proofs and gate
`tail_idle/bad/medium/good` (good twice), `run_idle/bad/medium/good`
(good twice), `run_box` (the boxed fail), `run_wreck` (the damage fail),
`run_quay_fork` (both ways); the jank benches; the latency numbers; the
interaction walk of the cabin and the wreck (E, Q, the glovebox, the
doors); golden identical (the tail's frames named if changed); errors
on every beat of V and VI; fps. The ammo rows for V and VI in the
revolver's table (`src/player/weapons/revolver.js`). The pad plays for
the tail still pass. Report `docs/story/reports/game-two/G4.md`.
This is the largest lane: whole and grey by the third hour, then the
look. Hours, not a day.

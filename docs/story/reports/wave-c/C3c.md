# Wave C lane report: C3c, the city after the user played it (2026-10-03)

- branch `wave-c/C3c-city` (from `wave-c/integration` 2240c35), port 5343
- the brief: `docs/story/briefs/C3C_CITY_NEON.md`; the full report is the
  "C3c" section at the end of `docs/story/reports/wave-c/C3.md` (this file is
  the short handover; code marks `[C3c]`)

## Where things are

- The neon: `src/stages/city/parts/neon.js` (one part, order 195, tick 65:
  after the buildings and the sight). `SIGNS` is the list (x, z on the
  facade, its outward normal, kind blade / flat / window, text, colour, height,
  symbol, flicker). The colours are registry keys: `neon` (blue), and two
  new ones, `neonGreen`, `neonAmber` (`src/render/accents.js`, marked `[C3c]`).
- The line at the car: `src/scenes/tail/chase.js` `manAtWheel` / `wheelStep`
  (the man at his wheel), `atWreck` (the line's two triggers: `WIN_NEAR` 1.5
  m at his window looking at it, `WIN_PASS` 4 m walking off), `sayLine`.
  `manOut` and the crouched man are gone; `tail_crouched` / `tail_point`
  clips (cast/kinds/tail_trucker.js) are unused now.
- [after the critic] The man at his wheel: `chase.js slumpedMan` spawns the
  cast's watcher in his cabin (clips `tail_slumpedL/R`, `tail_slumpedUpL/R`
  in `src/cast/kinds/tail_trucker.js`); the drawn head is only the fallback.
  `E  talk`: `atWreck` (`TALK_NEAR` 2.5 m, `lookingAtCar`). The walking net
  on foot: `walkNet` (the track's statics, the parked cars, the city's
  bounds).
- The hands: `src/scenes/tail/bot.js` `walkMark` / `walkLook` (to
  `chase.winAt`, eyes on `chase.winP`); `tools/lib/c3_tail.mjs` presses E at
  "get in" only once the line was said.
- Plays: `tail_window` (new), `tail_window_pass` (new), `tail_jank_walk`
  and `tail_good` (updated).

## How to look at it

- A frame from the seat anywhere in the city:
  `tools/shot.sh out.png "mute=1&scene=tail&beat=start&t=1&tailAt=x,z,yaw,0" 1440 900`
  (yaw 0 east, PI/2 north, PI west, -PI/2 south).
- The wreck: `?start=tail.wreck`, E, walk to his window.

See C3.md "C3c" for what plays, the numbers, the gate and Left.

## After the critic (2026-10-03, `C3c_CRITIC.md`)

Merged `wave-c/integration` (075a17b, C5's office) first: clean, no shim.
Each finding, in the order a player feels it, what was done, and the play
that shows it (each play run once on the final code).

| finding | what was done | shown by |
| --- | --- | --- |
| **1 BLOCKER: on foot at the wreck only the two cars are solid** (through the river rail 24 m out over the water, into the west buildings; an invisible square 60 m round my car) | `chase.js walkNet`: out of the car the walking net is the whole city (bounds -300..260 x -320..220, a backstop well past every wall) and every static of the cars' track is solid for the man on foot: the lots (facades), the river's rail, the canal's rail and the bridge's barrier, the rail yard's fence, the depot's sheds, the pier yard's walls and gate, the el's columns and the lamp posts (circles), the parked cars (their boxes); a static a car burst (`gone`) is not. The city is closed for the cars by what you can see, so it is closed for a man on foot the same way: no invisible wall anywhere, a walk up the road ends at a wall or the pier's gate. All taken out again on getting back in. | `tail_jank_walk` (two new walks: straight into the rail 24 m out, stopped at d -9.13 against the rail at 9.6; straight 40 m west, stopped at the warehouses' front x 95.36, never inside a wall box), the critic's `c3c_wreck_rail` (east stopped at d -9.11; west at the facade), `c3c_wreck_poke` (90 m down the road: nothing invisible stops me) |
| **2 BLOCKER: colour in 5 of 12 timed drive frames, none on the river road** | Eight signs added where a timed drive had none (26 in all): BILLIARDS straight ahead at the T where Pell Lane meets Harbor St, CIGARS high and far up Cooper St (the near left kerb is behind the pillar), RADIO across the market square at the avenue's corner, GRILL on Baxter St south, MISSION at Canal St's end as I turn onto the river road, LODGING tall and high over the wharf (in view from the canal's corner down to OYSTERS' stretch and beyond), POOL and HOTEL on the river road's middle and south stretch. Same three colours, no red, same boards. The blade's two faces now share one atlas cell and the atlas is 2048 x 2560 (it was full). | `tail_neon_timed` (new: the critic's seed-33 good drive, a frame every 10 s of chase time and on the river road every 6 s, each with my car's place): colour in 9 of 12 (kerb, t10 BILLIARDS, t20 CIGARS small, t30 RADIO, t40, t50, t60, t70, river r1 LODGING, the crash) against 5 of 12; none at t80 (passing DOCKS), r0 (the canal corner), the wreck. Most saturated frame 0.41 % of pixels (BILLIARDS after it was made smaller; it was 1.6 %). Seat frames along the river road (`tailAt`): z -20 POOL, z 40 COLD STORE, z 100 HOTEL just out of frame. |
| **3 MAJOR: his face at the window a flat pale mask** | The man at his wheel is now a figure of the cast (the watcher's kind, as C3b's crouched man was), printed by the ink as every figure is: slumped on the bench against his door, his shoulder and head at the broken window over the sill, a gloved hand over it, the bowler on the road (`tail_slumpedL/R`, `tail_slumpedUpL/R` in `cast/kinds/tail_trucker.js`, placed by `chase.js slumpedMan` inside the cabin: the glass's plane 0.62 m out, the door's skin 0.70, the sill 1.12 high, from `Cars.js`). Within 6 m his head comes up off the frame (the Up clip, 0.6 s fade) and the figure's look-at turns it to me; a groan as it comes up. The drawn head stays only as the fallback if the cast cannot spawn. | frame `07_wreck_the_man_slumped_at_his_window_E_talk`, the critic's `c3c_wreck_line` part B; `tail_window` / `tail_jank_walk`'s "nobody got out" now checks the one man is inside his cabin |
| **4 MAJOR: E at his car does nothing** | Within 2.5 m of his car's box and looking at it (its boot, side or nose: the look within ~57 degrees of his centre, or the look's ray into his box) the prompt is `E  talk`, and E has him say it. A groan from his window as his head comes up (within 6 m), so a player not looking at it hears him. The window trigger and the walk-off trigger stay. | `tail_talk` (new): at his boot (where my car stopped me) looking at it, `E  talk` (1.16 m from his box), E: the line, "Pier 9." |
| **5 minor: straight back in, the line from 16 m through my shut door** | My door takes E only once he has said it: until then "See to the driver." stays up and there is no `E  get in`. He is always within reach (his window, `E  talk` at any side of his car, or walking past him). The old fallback in `getIn` cannot fire now. | `tail_talk` part A: E out then E at once: still on foot, no line, no `get in` |
| **6 minor (C3b's route and bot): the good hands lost the river road's first try in 2 of 3** | Not changed (not this lane's code). Seen once in my runs too: a `tail_neon_timed` run went into phase b 55 m behind with 1.83 damage and lost "Lost him." on the river, then won the retry. | Left 1 |

The keeps held: the tail contest untouched (no rule changed: idle loses, the
clumsy hands get through, the good hands win), nobody gets out of his car
and nothing walks (the figure in his seat is placed once and posed), the
neon is as quiet (blue, green, amber, small boards, no red), the cars solid.

### The gate (WAVE_C §7, once, on the final code)

1. `npm run build`: built (the usual chunk-size notice).
2. `python3 tools/golden.py check`: 38 of 38 identical (`cars` got no capture
   in the full run - a headless hang, as the critic saw with `still_photo` -
   and was IDENTICAL on its own re-run). No frame changed on purpose.
3. `tools/errors.sh` on `scene=tail&beat=start|chase2|river|wreck|pier`:
   clean; every play below ended "no errors in #errlog" (VII's arrival
   included, in `tail_good`).
4. The proofs, each once:
   - `tail_idle` **12/12**: hands off loses ("He's getting away." then "Lost
     him." in under 20 s, back at the kerb); W held loses; the river hands
     off loses; kept up with but never shot at loses ("He's pulling away."
     first).
   - `tail_bad` **3/3**: "Lost him." in the streets (try 1, 60.7 s), lost on
     the river with 3 rounds in him (try 2), through on the 3rd try,
     chapter VII.
   - `tail_good` **7/7**: wins twice; run 1 lost two street tries on Water St
     (leg 4: once 66 m behind and unseen 7 s, once 135 m behind beside a
     traffic car at 1.5 m/s - stuck behind the tram's street traffic) and won
     the 3rd; run 2 clean, the line at his window. (Not this lane's code:
     Left 1.)
   - `tail_window` **5/5**, `tail_window_pass` **2/2**, `tail_talk` (new)
     **8/8**.
5. The jank walk: `tail_jank_walk` **6/6** - into his car, his window, my
   car, along the road, then straight into the river's rail (stopped at d
   -9.13; the rail is at 9.6) and 40 m into the west facades (stopped at
   x 95.36; the warehouses' front is x 95), never inside a car (712 samples)
   or a wall box, the one man inside his cabin. The critic's
   `c3c_wreck_rail` (east d -9.11, west at the facade) and `c3c_wreck_poke`
   (90 m down the road: nothing invisible).
6. Frame rate, one session (`UNCAPPED=1`, 1440 x 900; the GPU 75 to 95 %
   busy from another process before each run, so ratios only):
   `shot=perf` 40.4 fps; the market square 47.7 with the neon, 47.3 without
   (`?noneon=1`, +24 calls): **1.18x perf**; the river road's middle
   (`tailAt=112,-30,-1.57,9`, POOL and LODGING in view) 53.2 with, 53.1
   without: **1.32x perf**. The neon's cost is under 1 % in this reading,
   inside the noise.

### Review frames (added, `docs/story/review/wave-c/C3c/`)

7. `07_wreck_the_man_slumped_at_his_window_E_talk` - from behind his car on
   foot: the man of the cast slumped at his broken window, his arm over the
   sill, `E  talk`
8. `08_wreck_at_his_boot_E_talk` - at his boot, where my car stops me:
   `E  talk`
9. `09_pell_lane_billiards_at_the_T` - pulling off the kerb: BILLIARDS at the
   T, its streak (the timed drive's t10 had no colour before)
10. `10_river_road_lodging_high_over_the_wharf` - the river road with the gun
    out: LODGING's amber high over the wharf, his red lamps
11. `11_river_road_pool_hall` - the river road's middle stretch: POOL and its
    streak under the el

Plays added: `tools/plays/tail_neon_timed.json` (the timed coverage drive),
`tools/plays/tail_talk.json`; updated: `tail_jank_walk.json`,
`tail_window.json` (the "nobody got out" check for the man in his seat).

### Left (most felt first)

1. The good hands still lose some first tries (C3b's route, bot and
   traffic, not changed here): in `tail_good` run 1 two street tries on
   Water St (leg 4, stuck behind traffic going up toward the canal), and in
   one `tail_neon_timed` run the river's first try ("Lost him." 85 m
   behind). Both won on a retry. Worth one look by whoever owns the route
   and the traffic on Water St (the tram's street).
2. His face is mostly not seen: the man of the cast is printed as the cast
   is (a dark mass with a rim and the coat's light shapes), and the cabin
   behind his head is black, so at the window the head reads as a dark head
   and shoulder over the sill, not a face. His head comes up and turns to me
   (the Up clip and the figure's look-at, yaw only); a face that catches
   the lamp would need a light on him or a light share on the face.
3. Seen from his car's far side there is still nobody at the wheel (the
   figure leans to the window with room; the far side is the solid cabin).
4. Coverage is by one timed drive (9 of 12 frames with colour against the
   critic's 5 of 12); the three without were passing DOCKS on Water St, the
   canal's corner as I turn onto the river road (MISSION is there but out of
   the frame at that second), and the wreck itself. The river road's last
   60 m before the pier's yard has only HOTEL (a sign at the depot's corner
   floated in front of nothing and was taken out).
5. On foot the whole city is open to walk (by design: no invisible wall);
   it is finished for the car's eye, and was walked only round the wreck,
   to the rail, into the river side facades and 90 m down the road.

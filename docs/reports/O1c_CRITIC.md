# O1c, the cold player's report (the critic)

Lane O1c (the pavement graph mended, the street answers a fist, the districts'
look), played cold on `ow/O1c-streets` at 170496d, port 5378, every run muted,
by real input (`tools/play.mjs`). I played before I read `docs/reports/O1c.md`.
My plays are in `tools/plays/critic/o1c/` (`approach.mjs` is a driver: it walks
at a thing with W held and swings LMB every 350 ms from 3 m out, the way a
first-timer swings early). Frames are in `docs/review/O1c/critic/` (six).

Findings, the most felt first. Severity: blocker = a user ask not met, a stuck
state, a hit that does not read in normal play; major = most players feel it;
minor = polish.

---------------------------------------------------------------------------
## 1. Findings

### B1 (blocker) A jab at a car only makes a sound. Nothing happens to the car.
- **Steps**: `start=city`, walk to the coupe parked on Grand Ave (-112.2, 30),
  face its side, press LMB (`c2_approach.json`, target "a parked car").
- **Seen**: the event fires (`city:fist {thing:'car', how:'dent'}`) and the
  `c3_dent` sound plays. The body shows no dent, does not rock, and no alarm,
  owner, crime or crowd answers. Frame 2: the coupe right after the jab, with
  nothing on it.
- **Code**: `src/world/fistThings.js:181-185`: in the car branch, sound and a
  camera kick are the only things it does. The report says "a car's tin dents"
  (`docs/reports/O1c.md:65`, `:146`), and its own section 5 says "a jab at a
  car dents nothing yet (a sound)". Both cannot be true, and the play shows the
  second. The proof passes on the event's name alone: `tools/lib/o1c_fist.mjs:128`
  (`ok = /car:dent/.test(fl)`).
- **Why a blocker**: the user's must 1, "a fist that lands on a thing is
  answered by the thing". A car is the thing a player is most likely to hit.
- **Fix**: merge main. O6b's car damage is there (`src/destruct/CarDamage.js`).
  Give the jab a small dent at the contact point (a kick a bigger one) and a
  rock of the body. Add one answer from the city: the car's horn or alarm for a
  second, or the vandal crime. Make the proof check the car's damage record,
  not the event's name.

### B2 (blocker) Once knocked over, a thing turns black on the black pavement and seems to vanish.
- **Steps**: `c9_lie.json` / `c10_lie_probe.json`. Jab the dustbins at
  (-91.7, 68.5) off Grand Ave. Step back 3 m and look at where they lie.
  Then stand 1.3 m off and look down at them.
- **Seen**: standing, the dustbins are three pale tin cans that read from
  20 m (frame 5, left: Hester St). Knocked over, the set's pool instance takes
  over (`inst 0, visible, count 1`, lying at the right place, lowest point
  0.003 m over the ground). It is drawn as near-black on the near-black wet
  pavement. From 3.4 m nothing reads at the place where they lie. From 1.3 m
  straight down you can just make out the outline of a can (frame 1). Milk
  churns at (204.9, 18.4) are the same: at 3.5 m the frame centre is plain
  pavement. To a player the jab makes the bin vanish. "A thing knocked over
  falls like that thing and lies where it fell" (GAME_TWO 1 C3) does not
  read, and the fist walk's "nothing floating, everything resting" check
  passes on numbers no one can see.
- **Code**: the pool `InstancedMesh` built in `src/destruct/Smash.js:85`
  (material `this.mats[K.mat]`, kerb) for the city's merged dressing items
  does not carry the dressing's grey level (`src/city/kits/dress.js`: tin
  0.054 under the lamp's pool, which the ink prints pale). The pool is O6's
  code, but this lane's verb puts it in front of the player every few
  seconds.
- **Fix**: draw a knocked-out thing with the grey and the rim its merged twin
  had (the same level per kind, or the vertex colour of the merged piece), so
  a bin lying in a lamp's pool prints pale like the standing ones.

### M1 (major) The kick is hidden, has no foot, and changes what C means.
- **Steps**: on foot in the city, tap C, then press LMB at a bench (`c1_cold.json`):
  a jab, no kick. Hold C and press LMB (`c2_approach.json`, "a bench, C
  held"): a kick, and the bench goes over.
- **Seen**: no card ever teaches the kick (no `hud.teach` for it anywhere). C
  on its own does nothing on foot in the city, so a player who presses C (the
  rulebook's "get low", a toggle) sees nothing and never learns that holding
  it turns LMB into a kick. The kick itself is the camera dipping with the
  fists up and no foot, so even when it happens it does not read as a kick.
  The pad's version is circle held with R2.
- **Code**: `src/world/fistThings.js:32` (`kicking` = C or Ctrl held), and
  `:110-115` (the kick has no foot).
- **Fix**: either cut the kick (a jab already knocks everything a kick does
  except crates to planks and benches, drums and carts over; give the jab
  those on the second blow) or make it real. A real kick needs a foot in the
  view, one `hud.teach('city_kick', '[C] + [LMB] kick')` the first time the
  player jabs a bench, drum or cart that only shakes, and a crouch on foot
  for C so the key means what the rulebook says.

### M2 (minor, felt in every knock) Each crime of mine is also logged as a "punch" that nobody threw.
- **Steps**: knock over any bin (`c3_punchtrace.json`).
- **Seen**: `crime.log` gets `vandal by player` and then `punch by me` at my
  own eye. The stack is `night/standins.js:86` (O7's stand-in listener, live
  with O3 in). The street's alarm runs twice, the second at the player rather
  than the bin. The owner found this (section 5) and routed it to O7. It is
  one line (`if (!G.crime.stand) return;` at the head of that listener), and
  this lane's vandal is the thing that sets it off most often.

### m1 (minor) After the hand hurts, presses do nothing for 0.5 s, with no sign.
- `src/night/fist.js:30` (`if (beat) return true;`) with `THING.beat 0.5`
  (`fistThings.js:23`). A player who jabs a lamp post twice in a row gets no
  second swing and no sound. That is over the 0.25 s lock of GAME_TWO A2.
  Shorten it to 0.25 s, or let the second press swing a weak, slow jab (the
  hurt hand).

### m2 (minor) A bottle at my feet takes the jab meant for the dustbins behind it.
- `c11_fall.json`, the dustbins at (-148.6, -19.6): four presses walking at
  them, the bottle on the step broke, and the bins stayed up (`set [jolt:body]`).
  `thingAhead` scores a thing on the ground by gap like a thing at chest
  height (`fistThings.js:78-79`). A jab at chest height should prefer what
  stands there; leave the bottle to a kick or to a pitch looking down.

### m3 (minor) At arm's length, the firehouse's doors have no red.
- `c8_look.json`: standing 1.7 m off the doors at (-39, -50.5), facing them:
  0.00 % colour. The panels, pulls and hinges are there (frame 3), but the
  "one thin red line" is out of the frame, and Baxter St's own look is "the
  firehouse's red doors". Put the red where the eye is at arm's length: the
  panels' rim or the kick plate's edge, kept under 2 %.

### m4 (minor) The Hill is not warm on foot.
- `c8_look.json`, Hill Rd (-140, -538) looking east: amber 0.09 %. The globes'
  pools on the wet read white, and the only warm thing is an orange smear in
  the middle of the road (frame 4). The owner admits it (left 3). A player
  would not call this street warmer than Grand Ave.

### m5 (minor) Props are dressed from few variants.
- On Hester St (frame 5, left) the dustbin groups on both pavements are the
  same three cans with the same lids. `dress.js` varies the group (two or
  three cans, a lid askew by `rec.v`), but at the distance a player reads a
  street the groups read the same. Add a can missing, one turned, or one
  lid on the ground, picked by the hash.

---------------------------------------------------------------------------
## 2. The contest: the bin a cop saw (vandal, then HEAT 1, then the arrest)

| hands | run | result |
| --- | --- | --- |
| idle | `c4_vandal_idle.json` | **loses, warned**: within the second, `HEAT 1` and a card (Shift RUN, LMB FIGHT), then `LOSE THEM.`; the cop is seen walking in from 23 m; `Hands up.` at 3 m; cuffs about 1 s later (6 s from the knock); `Released. They kept the gun.` at the station |
| good | `c5_vandal_run.json` | **wins**: run away from him along the streets (Shift+W, a turn at each corner), and the heat is gone about 20 s later (`HEAT AND MONEY`, the line clears); once ran, once won |
| bad | `c6_vandal_bad.json` | **not validly measured**: 3.5 s of looking round and an E, then the run; arrested in both runs, but in one my bot ran into a facade (its direction check found free ground inside a lot) and stood there 23 s under `Hands up.`. Not a game fault; no verdict |
| medium | not run | |

Fair as far as I could see: the tell (the card, the cop walking in), the
warning (`Hands up.`), the reason on the black. The arrest machinery is O3's.
Losing the revolver for knocking a bin over is harsh, but it is O3's rule.

---------------------------------------------------------------------------
## 3. The user's asks

| ask | met? | what I saw |
| --- | --- | --- |
| 1. everything works: nobody walks into a facade; solid is solid; a fist is answered by the thing | **partly** | Walkers: 0 found inside a wall, a lot's edge or a box prop over 4,130 samples (45 s at Grand Ave, 45 s at (-20, 40)); `pavecheck` 0 / 0 / 0, re-run. Round colliders were not in my sample. Fist: bins, boards, crates, benches (kick), hydrant, lamp post (hurt), glass (crack, then gone), wall (hurt), door (knock), bottle (broken) all answer. **The car does not (B1)**, and **what goes over is not seen lying there (B2)** |
| 2. nothing copy-paste: streets told apart, props by a seeded hash | **mostly** | Hester (market street, orange blades, delicatessen) beside Doyers (narrow lane, a hung lamp, red, laundry and tobacco) are two places at a glance (frame 5). The prop groups repeat (m5) |
| 3. the aesthetic, colour under 2 % | **met** | the city's 16 golden frames and the title: max 1.72 % (`city_grand_car`), `city_o3_police` 1.01 %, title 0.94 %; my own frames (a cop's chase, the coupe, Hester, Doyers, the Hill, the firehouse) max 0.99 %; none over 2 % |
| 4. GTA but noir, havoc, the city reacts | **partly** | a bin knocked over is a crime: seen by a cop, HEAT 1 and the cop walks over in seconds; seen by a civilian, he goes to tell it; the crowd backs off. **A car punched: no reaction at all (B1).** A knocked thing that seems to vanish (B2) takes away the havoc's picture |
| 5. super awesome, fun, cool, polished | **not yet** | the swing is instant (press to swing 1.3-37.5 ms, page side, every target), the hurt-hand flinch reads, the glass's two blows feel right; the black bins, the silent car, the kick with no foot and no teach are not polished |

---------------------------------------------------------------------------
## 4. Cheats

Nothing in the lane wins for the player, and nothing loses without a tell.
One proof passes on its own label rather than the game:
`tools/lib/o1c_fist.mjs:128` counts `car:dent` as "the tin dented" though the
code that sends it only plays a sound (`src/world/fistThings.js:181-185`).
The fist walk's "everything resting" (`__rest`, lowest point within -0.3 to
0.15 m) is true and says nothing about whether the thing is visible (B2).

---------------------------------------------------------------------------
## 5. The owner's report read last: what a player would feel of its left list

- Left 2 (a kick has no foot): yes, felt, and worse because nothing teaches
  it (M1).
- Left 3 (the Hill's warmth only in its real lights' pools): yes, on foot too
  (m4).
- Left 5 (the duplicate 'punch'): not seen by a player, but every knock
  alarms the street a second time at me (M2).
- Left 1 (o3_crowd's gun step, o1_drive's burnt car), 4, 6 and 7: not felt
  in this lane's play.
- **Not in the left list and felt**: B1 (the report claims the dent in
  sections 1 and 3a), B2, m1, m2, m3, m5.

---------------------------------------------------------------------------
## 6. Good, must not be broken by the fixes

- The jab is on the press: 1.3-37.5 ms from the mousedown to the swing,
  twelve kinds walked at; the hands come up in the frame of the press.
- Every kind answers as its kind: dustbin, board, crates (shoved whole),
  churns, flowers and bike go over; bench and drums shake to a jab and go
  over to a kick; lamp post, hydrant and the iron ring and the hand hurts (the
  flinch, a grunt); shop glass cracks and then goes, with O3's smash crime;
  a wall hurts; a door is knocked; a bottle on a step hops and breaks.
- The pad: `o1c_fist_pad.json` passes as is (R2 jab, circle+R2 kick, 0 key or
  mouse events).
- The vandal crime: HEAT 1 when a cop sees it, the card, `LOSE THEM.`, the cop
  walking in, `Hands up.`; lost by running round a corner. Idle loses,
  warned; running away wins.
- The pavement graph: `node tools/pavecheck.mjs` 0 legs through a lot, 0
  into a thing, 0 corners in a solid; no walker found in a wall in 90 s at
  two corners; I walked away from knocked-over dustbins freely four ways.
- The districts: Hester and Doyers told apart; the near ground darker; the
  colour under 2 % everywhere I measured, the police's red lamp included.
- Errors: #errlog clean in all of my runs.

Plays (tools/plays/critic/o1c/): `c1_cold`, `c2_approach` (driver
`approach.mjs`), `c3_punchtrace`, `c4_vandal_idle`, `c5_vandal_run`,
`c6_vandal_bad`, `c7_peds`, `c8_look`, `c9_lie`, `c10_lie_probe`, `c11_fall`,
`c12_walkers_fallen` (inconclusive: an arrest moved me away before any
walker came by), `c13_drive_props`, `c14_stuck_fallen`.

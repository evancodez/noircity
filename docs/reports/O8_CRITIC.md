# O8 figures: the cold critic

I played it before I read `docs/reports/O8.md`. It ran on my own dev server (5379) under a
heavy machine load (14 to 38). Every play was real input through `tools/play.mjs`, muted.
My plays are in `tools/plays/critic/o8/` (`cold_punch`, `carhit`, `bodies`, `b1v1_idle`).
I also reused O3's and O4's critic bots for the contests. The frames are in
`docs/review/O8/critic/`.

The verdict in one line: in the bed, the cast reads well and the faces are hidden under
the brim. In the city, though, the physics layer is almost never seen. A car cannot hit
anyone, a punched man runs before he falls, and a body on the wet street disappears into
the ink. Downtown is still mostly the same fedora man.

---------------------------------------------------------------------------
## Findings (the ones a player feels most come first)

### 1. MAJOR (it hides the lane's main work): a car never hits a man in plain driving
- **What**: I stood walkers in the car's path and drove straight at them. All of them
  (6 of 6 over two runs) dashed clear every time. That held at 35 to 68 km/h, with the
  first man 9 m to 44 m ahead. `G.people.stats.hitByCar` stayed 0 and `knocked` stayed 0.
  A man stood 9 m ahead of a car doing 40 km/h has about 0.8 s, and he still stepped 2 m
  aside in that time. That reflex is faster than any man has.
- **Why it matters for O8**: the brief's car hit is the physics layer's best moment: the
  man goes over the bonnet and is thrown along the car's way (§2 "a man hit by a car goes
  over the bonnet or under, by the speed"). In the city a player never sees it. The
  north star also says "he may run people down", but the crowd cannot be touched, which
  works like an invisible hand saying no.
- **Steps**: `node tools/play.mjs tools/plays/critic/o8/carhit.json` (start=city: E into
  the car, three walkers stood in its path once it passes 32 km/h, W held). In the log,
  every man goes `dash`, then `walk`, then `gone`, and no one goes `down`.
- **File**: the dash is O3's (the car look-ahead in `src/people/People.js` and the dash in
  `Person.js`). O8 added the "met at its face" strike in `People.js` `hitByCar`, but it
  never fires because the dash comes first.
- **The fix the player needs**: make the dash human. Give it a reaction time of about
  0.4 to 0.6 s, slower when his back is to the car, under an umbrella, or in a crowd.
  Let it fail now and then above about 40 km/h or inside about 8 m, so a driver who
  aims hits about half the time. Note that my men stood side-on to the car, which is
  the easiest case for them, so this is the best case for dodging. A man with his back
  to the car may already be hit; check it in the same play.

### 2. MAJOR (a hit that does not read): a body on the ground disappears into the ink
- **What**: frame 2 is the falls bed at ?scene=cast&beat=falls, t 1.2 to 3.6 s. At 1.2 s
  the man in the open is mid-fall and reads well, arm flung up against the lit window.
  From 1.9 s on, nothing on the road reads as a man. The dark coat on the black wet
  street has no edge. The stations at the wall, the doorway and the stoop do not read
  from the bed's eye at all. In the car50 strip (not kept) the man at 50 km/h cannot be
  told apart before, during or after the hit. A standing man has the white rim (frame
  1). A lying man loses it, because what lies behind him is just as dark.
- **Why it matters**: GAME_TWO §1 A4 says "A hit nobody can see did not happen." The
  ragdoll settles well by the numbers, but a player looking from 10 m sees an empty
  street.
- **Steps**: `NOIR_PORT=5379 python3 tools/strip.py out.jpg "scene=cast&beat=falls&mute=1&t={t}" 1.2 3.6 8 4 720 450`.
- **File**: the ink and rim (render, not O8), and how a lying figure is lit. The cheap
  fix is inside O8: give a lying figure the standing figure's rim, or a pale shirt cuff
  or collar and a pale hat band or face. Or cast the street lamp's pool onto him (the
  base's bodies read because their white shirt fronts caught the light). Check the
  answer from the player's eye at 6 m and at 12 m under a lamp and away from one.

### 3. MAJOR (canned): men made together keep the same idle in step
- **What**: frame 1 is the lineup. Three men raise the cigarette to the mouth in the same
  frame, with the same arm and the same height. Each looping idle starts at time 0 when
  the figure is made (`HoodAnim.play`: a looping clip keeps its action's time, and the
  first play is at 0), so figures made in the same moment share a phase. In the city
  this is a gang's three on its corner, a crowd made under the fade, and the bodies
  pool. It is the "canned" the user named (OPEN_WORLD "alive, not canned, not stiff").
- **File**: `src/enemies/Hood.js` about line 1000 (the idle by style) and
  `src/enemies/HoodAnim.js:677`. Start each idle (and the walk) at a phase from the
  man's seed, and give the smoke and the arms-folded idles a seeded pause between
  cycles.
- **Steps**: `tools/shot.sh x.png "scene=cast&beat=lineup&t=3&mute=1" 1440 900`, then
  look at the hands.

### 4. MAJOR (must 1, "not just one style of NPC"): downtown is still mostly the fedora man
- **What**: in my first city frame at start=city, the 7 people about were 5 fedora men
  (`o3_fedora_a/b/c/g`), one `couple_her` and one patrolman. In the lineup (frame 1),
  every look of the city stands in three rows. At 20 m almost all of them read as the
  same dark coat under a brimmed hat. The women in their belted coats, the cops'
  carriage and the swell's topper do read. The brief's kinds that would tell at a
  distance (the beat cop's helmet and cape, the docker's jersey and hook, the newsboy,
  the woman in fur, the boxer's bare arms, the barman's apron, the driver's peaked
  cap, the detective's belted coat) were not added to the street. O8 added one new
  kind, the swell, and its weight downtown is 1 against about 30 for the fedora looks.
  The variants (build, hat's set, carriage) are subtle and are not seen past a few
  metres.
- **Steps**: `tools/plays/critic/o8/cold_punch.json` (the eval after begin lists who is
  about); frame 1.
- **File**: `src/people/costumes.js` (`PED_LOOKS`). The cheapest real fix: put more of
  the existing distinct looks into downtown's weights (the newsboy, a cop at every
  other corner, the woman's fur, the driver by his car). Then give two or three
  outline-level variants that read at 20 m (a long coat against a short jacket, a
  homburg, a flat cap, no hat), not only proportions.

### 5. MINOR to MAJOR: the common walker from behind is a slab
- **What**: frame 3 is the nearest fedora man from 2 m behind, under a lamp. The coat is
  one flat dark rectangle from the shoulders to the knees, with square shoulders and no
  arms read against it. The neck is long and thin under the hat. From the front and in
  the lineup the figures read well, so this is the one view that comes close to the
  "blocky" the user does not want. It is the view a player has most of the time,
  walking behind people.
- **File**: the Hood's coat outline (`src/cast/costumes.js`, the `o3_fedora_*` coats).
  Show the arms' swing outside the coat's line, taper or nip the coat's back at the
  waist, and shorten the neck under a lower hat.

### 6. MINOR: a punched man runs before the physics shows
- **What**: in `bodies` I gave one jab at 1.5 m and the man fled at once. He was never
  down, and this happened twice. In `cold_punch`, eight clicks landed 2 hits and the
  man was knocked down once (`knocked: 1`), but he was up (`rise`) within about 1.5 s.
  The knock-down is real, but a casual player sees it only if he chases. That is fine
  for O3's street, but together with 1 and 2 it means the ragdoll is the hardest thing
  in the lane to come across.

### 7. MINOR: the gang's tell is short
- `src/people/Gangs.js` (O8's reach): the first man's gun comes out 0.32 s after his
  hand goes into his coat. That is under the "half-second" of WAVE_C §2. The gun kit's
  own raise and glint still follow before he fires, so it is not unfair, but the reach
  is the intention O8 was to show. Make it about 0.5 s for the first man.

### Other lanes, seen in passing (not O8's to fix)
- During the arrest fall in `cop_fists_idle`, three texts are on screen at once:
  "LOSE THEM.", "HEAT AND MONEY" and "One more and you're down.". GAME_TWO B6 says
  never two cards at once (O7 or O3).
- The 1v1 brawl's bad hands won on the first try in 17 s (`b1v1_bad`). The bar is
  "through by the third or fourth", so the 1v1 may be on the easy side (O4).
- A known tool quirk, not the game: the first mouse move after pointer lock tips the
  view up (pitch -0.06 to +0.45 on a turn of 0, 0) in `play.mjs`. Frames taken right
  after it look at the sky.

---------------------------------------------------------------------------
## The four proofs (mine, on this branch)

O8 owns no contest of its own. Its figures, falls and knock-downs are in O4's brawl and
in O3's cop fight, so I played those on this code.

| contest | idle | bad | medium | good |
| --- | --- | --- | --- | --- |
| the 1v1 / 1v2 / 1v3 brawl (O4's bed, the new figures) | **lost**, warned ("One more and you're down."), why said ("Block his jab."), 50 s (`critic/o8/b1v1_idle`) | won on the 1st try (`b1v1_bad`) | won on the 1st try, 1v2 (`b1v2_medium`) | **won twice in a row**, 1v3 (`b1v3_good`) |
| the cop's fist fight in the city | **lost**, warned, "Arrested. Block his jab.", woke at the station (`critic/o3/cop_fists_idle`) | - | - | (O3's `cop_fists_fight` ran; no loss in its window) |
| the pad (`?padfake=1`) | `o3_pad_arrest`: the punch seen, arrested, the station, the pad alone: PASS | | | |

No contest wins itself, and none that I played is unwinnable. Every #errlog was empty.

---------------------------------------------------------------------------
## Cheats (lane code read after play)

None found that wins for the player, and no loss without a tell. Read: `People.js`
`hitByCar` (the car's push; a slow car "met at its face" counts as a hit; a body woken
for a car), `Person.js` `knock` (the fall that fits, the pool where he rests),
`Crowd.js` (the KO push only), `Gangs.js` (the reach adds a delay before the guns: it
helps the player a little and shows the tell), `bounty.js` and `arm.js` (the wanted man
keeps his hp scaling).

---------------------------------------------------------------------------
## What is good and must not be broken

- **The faces are under the brim.** At 1.5 m, facing me, the man is a hat, a shadow
  and a collar, with no stare. This is the Hood's look the user asked for.
- **Nothing balloon and nothing jitters.** Standing and walking figures have the white
  rim and clean silhouettes. The women's belted coats and the cops' upright carriage
  read in the lineup.
- **The street answers a drawn gun at once.** In `bodies`, the man 5 m ahead was already
  fleeing when the revolver came up. The street's startle and run are good.
- **The fall itself, while it lasts, reads like the base's falls**: the arm flung up
  against the light (frame 2 at 1.2 s).
- **The brawl's knock-downs on the ragdoll** keep O4's contest whole: idle loses with a
  warning and a reason, and good wins twice.
- **The pad play passes**, and no run had an error.

---------------------------------------------------------------------------
## The owner's left list, read last: what a player would feel

- **Left 1 (gestures small at a distance in the dark)**: yes. Together with my
  findings 2 and 3, it is the same problem. The new motion is real but too dark and
  too small to be seen. Fix the readability before adding more motion.
- **Left 3 (the rooms' figures not varied)**: a player will see the same barman and
  boxer in every bar and gym. It is one line, so do it.
- **Left 5 (the stoop's slow slide, a body on a step's edge)**: I could not see it from
  the bed's eye (finding 2), so nobody else will either until bodies read.
- **Left 2, 6, 7, 8**: polish. A player will not name them.
- **Not in the left list but felt**: findings 1 (cars cannot hit anyone), 3 (idles in
  step) and 4 (downtown is one style).

## Frames
1. `1_lineup_kinds_and_synced_idles.jpg`: every look at 20 m. Most read as one coat
   and hat, and three men raise a cigarette in the same frame.
2. `2_falls_bodies_lost_in_the_ink.jpg`: the falls bed, t 1.2 to 3.6 s. The fall reads
   at 1.2 s, and after that the bodies are gone into the street's black.
3. `3_walker_from_behind_slab_coat.jpg`: the common walker from behind under a lamp
   (left), with the zoom (right).

# C2 — the cold player's report, second look (critic, 2026-10-02)

Branch `wave-c/C2-guns` at `303f2c7` (the owner's last commit after my first
look), port 5342. I did not build it. I played the test bed from the title
(`?start=guns`, `?start=guns.<beat>`, BEGIN clicked, `mute=1`) by real input
only, with my own plays and hands (`tools/plays/critic/c2b_*.json`, drivers
in `tools/plays/critic/c2/`), looked at the frames, then read the code, and
only then the owner's report. Frames: `docs/story/review/wave-c/C2/critic/`
(the first look's eight are replaced; they are in git at `907f72a`).

My hands are the first look's (`c2/hands.mjs`: they see a man only in the
view with nothing solid between, his gun coming up only when he is in view,
a hit's bearing thrown +-25 degrees, the warning's words, cover spots chosen
by eye). New this time: `low` (down with C and RMB held on open floor,
nothing in front), `goto` (first walk to the room's open floor),
`fairGlass` (the owner's fair note: a man behind a pane is seen only within
1.2 m of it - frosted panes show nothing of a man further back).

## The first look's findings, checked in play

| first look | now | what I saw |
| --- | --- | --- |
| 1 BLOCKER: pin and door won standing | **pin fixed, door not** | Pin standing, fair-glass hands: lost 5 sessions of 6 (15 falls; one session won on try 1 from the bar's floor). Door standing **behind the desk**: lost 3 of 3. Door standing **on the room's floor**: won **9 sessions of 10** (finding 2) |
| 2 MAJOR: doors jam against me, no E up against one | **fixed** | A1 from 1 m: open 1.00, walked through to the corridor. Up against it: "E open", E opens it fully. But the pull carries me behind the leaf (finding 6) |
| 3 MAJOR: false "Move!" at the street | **fixed** | Rush won by good hands, the street watched 9 s hands off: no warning at all, the line "Four of them across the street." |
| 4 MAJOR: last man hides 40 s | **fixed in the rush** | Good hands won the rush in 24.6, 24.5, 24.1 s (were 57-61). A stand-off seen once in ten door sessions (finding 12) |
| 5 MAJOR: ready beat, C where the tip leaves me | **fixed** | C where I stand: "Rise over it. Shoot the bottles.", the RMB card, RMB rises over the desk, both bottles broken, the R card |
| 6 stale lines | **mostly fixed** | No "Clear." over the fade, no warning once won. The ready's "Reload behind the desk." still shows over the door beat's fade-in (finding 11) |
| 7 splash over the objective | **fixed** | A round from the doorway ahead splashes at the top edge's middle; from the right at the right edge |
| 8 tell small | **better, but drawn through the leaf** | A white star and the click; in slow time the star sits on the face of the door leaf while the man is still behind it (finding 8) |
| 9, 10 desk's things, desk from the door's side | not re-filmed | - |

## The three proofs, mine (each contest from the title)

| contest | (a) hands off / W held | (b) clumsy | (c) good, run 1 / run 2 | stand and trade, where the beat starts me | stand and trade on the room's floor | low in the open (C + RMB, no cover) |
| --- | --- | --- | --- | --- | --- | --- |
| door | lost 8.6 / 8.7 s; "Get down!" 1.6 / 1.5 s before; "Shot standing in the open." / "Shot in the open." | won try 1 | won try 1 / try 1 | lost 3 of 3 | **won 9 sessions of 10** (tries 2, 2, 1, 1, 1, 1, 1, 2, 2; one ran out my 120 s) | won try 2 |
| two_ways | lost 8.5 / 8.8 s; "Get down!" 1.3 / 1.5 s before | **lost 15 tries of 15** (3 sessions) | won try 2 / try 2 | lost 3 of 3 | lost 3 of 3 | lost 3 of 3 |
| pin | lost 8.9 / 9.7 s; "Get down!", "Tommy gun! Get down!" | won try 1 | won try 1 / try 1 | lost 3 of 3; fair glass lost 3 sessions of 3 | X-ray hands won 2 of 4 (try 2); **fair glass lost 2 of 3, won 1 (try 1)** | lost 3 of 3 |
| rush | lost 8.5 / 7.8 s; "Stop him!" 2.8 / 2.1 s before; "He walked right up to you." | won try 1 | won / won (24.6, 24.5 s) | lost 3 of 3 | (my hands never saw him) | (same) |
| street | lost 18.5 / 24.1 s; "One's going round on your left." 7.5 s before, "Behind you!"; "They had your angle." / "Flanked." | fell 1, won try 2 | won try 2 / try 1 | lost 3 of 3 (my hands fire at chests the car hides: not a proof) | lost 3 of 3 (same) | lost 3 of 3 |
| street_rev | lost 18.9 / 16.6 s, warned as the street | won try 1 | won try 1 / **try 3** | lost 3 of 3 (same note) | - | - |

Hands off loses every contest, warned, with its reason, back in about three
seconds. Good play wins every contest, but not every first try: two_ways
fell once in both runs, street and street_rev once each. Standing and
trading loses everything except the door from the room's floor. The clumsy
first-timer is stuck in two_ways (finding 1).

## Findings, most felt first

### 1. BLOCKER - the clumsy first-timer cannot get through two_ways (0 of 15 tries)
**Steps:** `node tools/play.mjs tools/plays/critic/c2b_bad_tw.json` (two
sessions of five lives) and `c2b_bad.json` (the run through all six). The
same clumsy hands got through two_ways on the third try at the first look;
now 15 falls in 15 tries, three sessions: "Flanked." 7, "Up over the cover
too long." 4, "They had your angle." 4. Each life is 15-20 s: the two A1
men work the jambs together, and at about 10 s the third comes through A2,
which is at my back behind the desk ("Behind you!", splashes at the top,
right and bottom edges at once: frame `02`). My good hands lost its first
try in both runs too (one "They had your angle.", one "Flanked."). The
owner's own clumsy proof lost it three tries running (C2.md Left 4). The
retry's half-empty gun (finding 3) is part of it: the clumsy began tries
with 4, 5, 2, 1 rounds.
**Fix (the owner's call):** the beat must be got through by the clumsy hands
on a second or third try, twice running (`c2b_bad_tw.json`). Levers seen in
play: the A2 man's entry said or heard before he has me (his door opening
behind me is the moment - a line, "The other door!", when A2 opens, not when
he already has the line); his wait (3 s) longer; the cylinder full on a
retry (finding 3).

### 2. BLOCKER (ask 3) - the door is still won standing up, from the room's floor
**Steps (frame `03`):** `c2b_open_floor2.json`, `c2b_door_standoff2.json`:
`?start=guns.door`, BEGIN, never press C, step off the desk to the room's
floor beside it (about -3.4, -2.3: 2.8 m from A1, at an angle), and shoot
each man as he steps into the doorway. Won **9 sessions of 10**, five on
the first try in 13.8-16.9 s with 1-2 hits taken, four on the second (the
tenth ran out my 120 s, finding 12). The men come through A1 in their entry with the gun down and are in
the frame, lit from behind, 2.8 m off, while my sights are already on it.
Standing behind the desk now loses (3 of 3): the fix closed one spot, not
the room. The user's words for the old street fit exactly: "I just stand
and shoot, and it is neither hard nor fun." IV The Door is built on this
beat. The pin is fixed (fair glass: 5 of 6 sessions lost standing).
**Fix (the owner's call):** a man who has me standing in the room as he
reaches a doorway does not walk into its frame to be shot: he works it from
the jamb with his gun up first (the "hold" he does when I am down), or the
two come in together with guns up, so that standing there means two guns at
2.8 m. Prove it with `c2b_open_floor2.json` and `c2b_door_standoff2.json`
(standing must lose most sessions).

### 3. MAJOR - a retry gives me back the gun as it was when I fell
**Steps (frame `01`):** `c2b_retry_ammo.json`: `?start=guns.two_ways`, fire
four rounds into the wall, stand until the fall. Back at the beat's start:
the cylinder holds **2** (the HUD shows two rounds), and the men are coming.
In the clumsy runs tries began with 4, 5, 2, 1, 5 rounds. "Back at the last
checkpoint with the world as it was there" (WAVE_C §2): a first-timer finds
his gun nearly empty in the doorway's first second and loses again to a
reload he did not choose. The Tommy gun is reset; the revolver is not:
`src/scenes/91_guns.js` lines 191-192 (`equip` then `if (B.gun === 'tommy')
G.weapon.reset()`). GUNS.md should say a chapter must refill on a retry.

### 4. MAJOR - behind the back door: an empty plain and an invisible wall
**Steps (frame `08`):** the men unlock the back door (BD) and leave it open
in door, two_ways and pin; walk out of it (`c2b_backdoor.json`,
`c2b_backdoor2.json` unlock it by eval, as the men leave it, then walk by
real input). Behind the house is an empty wet plane to the skyline: no wall,
no fence, nothing; walking south I am stopped at z -9.65 in the middle of it
by nothing I can see. Walking east along the back I go round the house's
east end and out onto the street's pavement (10.5, 6.65) - and from the
street, in the street beats, round to the back the same way. WAVE_C §1.6:
"never an invisible wall, never an empty edge".
**Fix:** a yard with a wall or fence behind the house and across both gaps
between the house's ends and the street's fences (x -9 and x 9).

### 5. MAJOR (ask 2) - standing in a man's line, I am down 1.3-1.9 s after the first round, and the first word comes with that round
**Steps:** `c2b_idle_all.json`, `c2b_idle_w.json`: hands off, first round
to the fall: door 1.6 s, two_ways 1.3 s, pin 1.5 s (W held: 1.5, 1.5, 1.9).
"Get down!" first shows at the first hit. The tell (the click, the star)
comes about 0.6 s before the first round (`c2b_tell.json`, slow time). The
brief: "a player in the open, standing still, is down in three to four
seconds against two men". A first-timer who freezes at the first hit is
down before he reads the line; it will feel like dying at once. And the
door beat puts me **standing** although the ready beat ended with me down
behind the desk (the crouch is reset at the cut, `c2b_ready_through.json`:
crouch 1 at the ready's end, 0 at the door's start) - the first contest
begins by undoing the habit just taught. The owner names the speed (Left 3).
**Fix:** a breath between a standing man's bursts again (`afterBurst`'s
stay), or the warning before the first round (when a man with the line on
me standing raises), and start the door beat as the ready beat left me.

### 6. MAJOR (ask 5) - the door pulled open into me carries me behind its leaf
**Steps (frame `04`):** `c2b_door_push.json`: from room A walk into A1 until
it stops me (-1.60, -4.12), look at it, E. The leaf swings into the room and
carries me round with it over 1 s to (-2.35, -5.01): behind the open leaf,
in the corner between it and the wall, facing the wall, the prompt "E shut".
To go through I must find my way round the door. `src/stages/killhouse/
door.js` `shove()` (line 179) pushes me out along the leaf's own normal,
which turns with the leaf, so I am swept round the hinge.
**Fix:** step me straight back from the doorway's plane (out of the sweep,
on my side of it), never round the hinge; or open a door away from the
player who opens it.

### 7. MINOR - down in the open with RMB held: "Get down!", and the fall says "Up over the cover too long."
**Steps (frame `07`):** `c2b_low.json`: C, then RMB on open floor with
nothing in front. Hit, the line says "Get down!" to a man who is down; the
fall's words were "Up over the cover too long." in 4 of 13 falls, with no
cover there. `src/guns/Guns.js` line 583 (`down` is false when risen) and
line 550 (`L.risen` is any RMB while crouched; in the open the rise is
0.08 m). Say "Shot in the open." when the rise lifted me over nothing.

### 8. MINOR (ask 5) - the tell's star is drawn on the door leaf in front of a man behind it
**Steps (frame `05`):** `c2b_tell.json` (speed 0.25), door beat: the first
man at A1's jamb brings his gun up; the star shows on the face of the open
leaf, 20-30 cm to the side of him, while his hand and gun are behind the
leaf (frames `door01`, `door02`). Either the star is not hidden by the leaf
or his gun is through it. `gunman.js` `glintStar` (line 348).

### 9. MINOR - the Tommy gunner behind the frosted partition shows as a hand at B2's jamb
**Steps (frame `06`):** `c2b_tell.json`, the pin: "Tommy gun! Get down!"
with the panes plain white, no shadow of him, and his hand and gun alone at
the edge of the glazed door. The line carries the warning; the picture does
not (the owner's Left 2 and 9 say the same). IV The Door's first choice is
to shoot shadows through door glass.

### 10. MINOR - the locked back door says "E open"
`c2b_walk_house.json`: at BD, "E open", E rattles it (a sound and a small
jolt) and the prompt stays "E open". After a rattle say it is locked.

### 11. MINOR - the ready's last line over the door's fade-in
`c2b_ready_through.json` frame `d_00`: "Reload behind the desk." dimmed at
the top while the door beat fades in, then the door's own line.

### 12. MINOR - one stand-off in ten
Door, standing on the floor (`c2b_open_floor.json`): one session ran to my
120 s limit with one man left, no hit taken and nobody in view for the last
~100 s. Not seen again in nine sessions; the brains were not recorded that
time (`c2b_door_standoff2.json` records them with `?c2rec=1`).

## The code, read for cheats

Nothing wins for the player. No timer ends a contest (a beat ends when its
last man is down; the ready beat's 60 s / 75 s, `91_guns.js` 264 and 267,
move the teach on, not a contest), no rubber band, no automatic action;
rounds are rays and a settled pistol round's throw is a constant 0.0055 rad
(no miss streak). Named:
- **Rules on my stance, not on what he can see** (`gunman.js`): a hit from
  a man crouched sends him back behind his cover with his aim gone (line
  116), from a man standing it does not; at a man standing in his line he
  fires up to two more bursts (769); he snaps a shot on his way only at a
  man standing (330); he comes out after 0.3 s when I stand (555); he
  notices a crouched man 0.25 s late, a standing one 0.075 s (176);
  `settleStill` 0.6 (41). Written in the file's header and C2.md. They
  favour crouching wherever I am, cover or not, and a player cannot see
  them. In play they do not win by themselves: down in the open with RMB, I
  lost four contests of five (won the door on a second try). Allowed; keep
  them written in GUNS.md for the chapters.
- **Their round from his sight line** (`Guns.js` 455-463): with his gun
  hand behind a jamb and his eyes on me, the round (and its flash) leaves
  from 0.45 m in front of his eyes, not from the gun. For them, not me; it
  can look like a flash in the air beside his head.
- `Game.spareLast` (lane C1's mercy, written in Z.md), `GUNMAN.behind`
  0.45 s with "Behind you!", street_rev's `settleK` 1.1: written knobs, none
  wins.
- Gone since the first look: the 2.2x friendly fire (a man holds his fire
  with a mate in his line; a stray does what it does to me).
- Loses without a tell: the retry's cylinder (finding 3) is the only one I
  found; the Tommy gunner behind glass has his line and his bolt.

## The user's asks, as I saw them in play

1. **Enemies who really try to kill me: met.** Hands off, every contest is
   lost in 7.8-24.1 s; standing in a line, down 1.3-1.9 s after the first
   round (finding 5 says that is too quick to be fair).
2. **Fair: partly met.** The click and the star before the round, "Get
   down!", "Tommy gun! Get down!", "Behind you!", the side of a flank, the
   splash's compass all work, and no miss streak. Against it: the first word
   comes with the first round and the fall 1.3-1.9 s later (5); the retry's
   half-empty gun (3); "Get down!" to a man already down (7).
3. **Strategy, standing loses: not met in the door.** Standing loses
   two_ways, pin (fair glass), rush, street; the door is won standing from
   the room's floor 9 of 10 (2). Cover is physical (rounds into the desk,
   "Your cover won't hold. Move!").
4. **Not one door, cover, a flank with a warning: met.** two_ways A1 + A2,
   pin B2 + B1, rush SD + A2, the street's three places and the bay; men work
   jambs, cars, the counter; "One's going round on your left." then "Behind
   you!". The door beat is one door by the brief.
5. **Nobody clips: met, with two exceptions.** Walking into every wall,
   cabinet, the desk, the table, the barrels, the bench, the reception, the
   cars, the crates, the hydrant and the fences stopped me and slid me along
   (`c2b_walk_house.json`, `c2b_walk_street.json`). The star on the leaf (8)
   and the door carrying me round its hinge (6).
6. **Dying men slump where they are: met.** Thirteen falls logged through
   their fall (`c2b_deaths.json`): 0.00 m moved after the hit, a slump at a
   wall, over a car's end, to the knees in B2's doorway.
7. **Men come in naturally: met.** Doors open and the men are framed in
   them; the heavy through the street door; the fourth out of the bay.
8. **Taught, not cold: met.** The three cards each at its moment with the
   key drawn; from where the tip leaves me now.
9. **Premium, not janky: met for the shooting.** C, RMB, LMB, R act at
   once; hits show (blood, the flinch, the arm thrown up). Golden **32 of 32
   IDENTICAL** (`NOIR_PORT=5342 python3 tools/golden.py check`, alone).
   Frame rate, once, at the end: the street (`scene=guns&beat=street&t=3`)
   60.4 fps against `shot=perf` 35.9: **1.68 x perf** (both flagged BUSY:
   the GPU was 92-96 % used by other processes). The jank is the door's
   pull (6) and the plain behind the back door (4).

## The owner's Left list, as a player would feel it

1. Not played by a person - still true of mine too.
2. The pin and X-ray hands - fair: with `fairGlass` my standing hands lose
   the pin 5 sessions of 6. Not felt. The door is felt (finding 2): no glass
   there.
3. Fast to fall standing still - **felt** (finding 5).
4. Clumsy at the edge - **felt hard**: two_ways is a wall for the clumsy
   (finding 1).
5. Doors - the pull is **felt** as being carried round the leaf (6); BD's
   "E open" (10).
6. Cars do not burn - not felt (sparks, glass).
7. The desk's things not solid - not felt.
8, 10. Tools; integration - not a player's.
9. The glowing frosted glass - felt in the pin (9).
Not in the list and felt: the retry's gun (3), the plain behind the back
door (4).

## What is good and must not be broken

- Hands off, every contest lost, warned, with its reason on the black, back
  at the beat's start in about three seconds.
- Good play wins every contest within three tries, twice; no stuck state for
  the good hands.
- The ready beat: E, C where I stand, RMB over the desk, the bottles, R:
  each card at its moment.
- Standing behind the desk loses the door; standing loses two_ways, the pin
  (fair glass), the rush and the street.
- The rush: the heavy reads as the heavy, "Stop him!", "One more. Find
  him." and the last man comes in 24 s.
- The street opens clean (no false line), the men already down behind the
  far cars, the flank named and then "Behind you!".
- Doors: E from 1 m or up against one opens it fully; the men open them.
- The splash's compass; the tell's click and star (fix where it is drawn,
  keep it); "Tommy gun! Get down!".
- Falls in place, fitted to what is beside them.
- Golden 32 of 32 identical; `#errlog` clean in every play of mine.

## Plays (all `tools/plays/critic/`, run `NOIR_PORT=5342 node tools/play.mjs <play>`)

`c2b_first`, `c2b_ready`, `c2b_ready_through` (the first-timer from the
title through the ready beat into the door), `c2b_idle_all`, `c2b_idle_w`
(a), `c2b_bad`, `c2b_bad_tw` (b; two_ways twice), `c2b_good` (c; run twice
with `--out`), `c2b_open` (stand and trade where the beat starts me),
`c2b_open_floor`, `c2b_open_floor2`, `c2b_door_standoff`,
`c2b_door_standoff2` (stand and trade on the room's floor), `c2b_low` (down
with RMB in the open), `c2b_pin_fair` (the pin standing, fair glass),
`c2b_retry_ammo`, `c2b_door_swing`, `c2b_door_e`, `c2b_door_push`,
`c2b_tell` (slow time), `c2b_street_open`, `c2b_deaths`, `c2b_walk_house`,
`c2b_walk_street`, `c2b_backdoor`, `c2b_backdoor2`. The hands
(`c2/hands.mjs`) take `style: good | bad | open | low`, `goto`, `fairGlass`.

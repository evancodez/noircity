# C5 — the cold player's report (III Room 304, IV The Door)

Played on `wave-c/C5-office` at 08b9507 (the owner's final code), dev server on
5345, muted, 1440 x 900. III by hand, frame by frame (tools/stepplay.mjs, my
own status line `tools/plays/critic/c5/status.js`), then the owner's III driver
over every flavour step. IV: the take and the moment by hand; the three proofs
with lane C2's / C5's gun driver (`tools/lib/c5_door.mjs`) in my own plays
(`tools/plays/critic/c5/iv_*.json`), each beat entered as its checkpoint. Read
the owner's report only after. Golden check: **32 of 32 identical** (no frame
changed, ask 11 met on the golden side).

## Findings, most felt first

### 1. MAJOR (blocker by ask 6) — standing and trading in the open wins the door and the flank
- Play `tools/plays/critic/c5/iv_bad.json` (profile `bad`: stands where the
  beat puts him, never gets down, turns onto a man 0.45 - 0.8 s after he shows,
  reloads standing).
- Seen: **door, try 1 lost** (`Reloading in the open.`, warned 4.4 s first);
  **door, try 2 WON** in 11.8 s, 5 hits of 6, 35 hp left. **Flank, try 1 WON**
  in 21.4 s, 40 hp left. Corridor lost 2 of 2 (good).
- The user's own words (ask 6): "standing and trading in the open loses". It
  does not, in two of three movements. Why it plays that way: in the door the
  three come through one door and the opening one after another into a man who
  is already aimed at the opening (they "file through one door to be shot",
  the thing the user named); the second try is the retry ease (below), and the
  flank's two come one at a time, 2.5 s apart, through a door he is facing.
- The owner knows the flank half of this (C5.md Left, first item). The door
  half is new: his note "he dies at the door every time" was not so here; with
  `retryEase` one fall is enough to make standing in the open win the door.
- Fix to aim at: an open stander must lose each movement, retry or not. Levers
  in `src/scenes/05_gunfight.js`: `NUM_FLANK.settleK` (1.5) and the flank's
  `late: 2.5` (line 62); the door men's starts (line 147: 0.05 / 0.35 / 0.5 s -
  they are nearly a queue); `retryEase` (line 85) only from the second fall, or
  only for a player who used cover; and the door's men not all funnelling
  through the opening (the sidelight man firing from the outer office at a man
  in the open, the jamb man holding the corridor door, not following).

### 2. MAJOR — the corridor held from inside the suite is lost by good hands: only the cart wins it
- Plays `iv_good_desk.json`, `iv_good_glass.json` (good hands, the corridor
  without `out`: down behind the secretary's desk facing the suite door) and
  `iv_corr_in.json` (the same with a frame every 6 s).
- Seen: **lost 7 of 7** (`Flanked.` x5, `He walked right up to you.` x2). In
  two of them the good hand fired **0 rounds** in 30 - 35 s: the men went round
  through 305 and the connecting door and shot him from Ames's room.
  Out at the cart (the owner's `out: true`, `iv_good_move_out.json`,
  `iv_corr_out2.json`): **won 2 of 2**, 21.8 s and 30.8 s.
- The clumsy hand (`iv_clumsy.json`, desk, also holding the suite) won it once
  in 97 s, so it is not impossible, it is a coin with a heavy side.
- A player who obeys "Check the corridor" goes out; a careful first-timer who
  holds the room he has just held twice is punished from behind with no way to
  read where they went. WAVE_C §1.5 wants two ways through every contest; this
  one has one. Either the men sent round (05_gunfight.js line 303 `goRound`,
  and the heavy's and the 306 man's routes) give a tell he can read in time
  (the connecting door's handle turning, as the flank's does - heard and seen,
  the line "The other door!") **before** they have a line on him, or the suite
  must be a place the corridor can be held from.

### 3. MAJOR — the corridor's last minute: a stand-off nobody can read, and the line lies
- `iv_corr_in.json` frames every 6 s (`shots/critic/c5/iv_corr_in/`): after the
  lift opens the Tommy gunner stands **in the open lift car for about 80 s**
  (`open@-4.6,-6.5`, snaps 35 s to 95 s) while the 306 man and the heavy come and
  die. When the heavy is dead (about 77 s) the objective still reads
  **"One more. On the stair."** - the stair man is dead; the last man is the
  Tommy gun in the lift. 15 s later he is sent round through 305 and the
  connecting door and kills the player from behind (`Behind you!`, frame
  `01_corridor_stale_line_flanked.jpg`).
- A player in that minute does not know what is left or where; the line points
  him at an empty stair. Fix: the objective follows who is left ("One more. In
  the lift." or just "Check the corridor." again once the heavy is down); the
  stand-off breaker (line 296 - 309) should not wait on `left.length !== 1`
  while the heavy is still coming, so the Tommy gunner does not stand 60+ s in a
  lit car doing nothing.

### 4. MAJOR — III: the torn check has no teach card; turning a piece is never shown
- Steps: solve III to the envelope; at the desk, E `lay them out`.
- Seen: seven pieces scattered and turned (up to 2.9 rad) on the blotter, a small
  ink cross, the line "Piece it together." and **no card at all**: nothing says
  LMB drags, nothing says the wheel or RMB turns a piece. A piece joins only
  within 14 degrees and 9 mm (`check.js` line 222), so turning is required. The
  only help is the puzzle's idle hint, "Drag a piece; the wheel turns it.", at
  the **second** hint level, i.e. after about 80 s without progress
  (`Puzzles.js` line 84: 40 s each), and it never names RMB, which
  `check.js` line 166 also accepts.
- WAVE_C §1.3: no mechanic thrown cold - a card with the key at the moment of
  need. Wanted: `hud.teach('check', '[LMB] drag  [RMB] turn')` (or two cards) when
  the pieces go down. The dial has its prompt ("MOUSE turn the dial") and the
  pad has its card ("[LMB] hold and rub"); the check is the odd one out.
- (The pieces themselves pass ask 4: PIE / R 9 / — DOT / MIDNI / DINE read at a
  glance while apart; the owner driver solved it and the stills ran, PIER 9 in
  the save.)

### 5. MAJOR — IV: the moment's "real choice" shows only one of its three ways
- Steps: begin IV from the title (`/?mute=1&start=gunfight`), let the take run.
- Seen: the take on the shadows is good (three shapes on the frosted door and
  the sidelight). Given the view back at (2.9, 2.2), facing the opening, the
  screen says `[LMB] fire`, then `[C] get low`, and the line "Someone at the
  door. Get ready." The desk is behind me, out of frame; `E tip the desk over`
  appears only once I have walked round to its chair side and looked at it
  (`tipPrompt`, 05_gunfight.js line 368: `behind()` within 1 m of its back).
  In 7.5 s a first-timer will shoot (the card says so) or crouch where he
  stands; he will not find the desk unless he already knows.
- Ask 5 wants the pause, then a real choice: tip the desk, shoot the glass, or
  move. Make the desk visible as a choice: the take could end facing the desk,
  or turn past it; or the desk's prompt shows at range from the start place
  ("E tip the desk" when looking at it from anywhere in the room).

### 6. MAJOR — IV with the desk tipped the door is free: no damage at all, twice
- `iv_good_desk.json` and `iv_clumsy.json` (both tip the desk and get low).
- Seen: the door won with **100 hp left in both** (the clumsy first-timer: 4 hits
  of 7, 26 s, untouched). With the glass or the move the good hand took 15 and 45.
  Risen over the desk I saw the three standing bunched in the suite's doorway
  (they hold at the door, in a clump, and are shot over the desk one by one).
  The door with the desk has no danger for anyone who uses it; nothing to lose,
  so nothing won. (Not a cheat: they do shoot - "They have your angle. Move!"
  came while I was risen - but they do not press.) A man moving to the outer
  office's bench / files to take an angle round the tipped desk would make the
  desk a choice and not the answer.

### 7. MAJOR (minor if only cosmetic) — rain falls inside the building
- Seen in the corridor at the chapter's first frame (white rain streaks in the
  lit middle of the corridor), through the suite's open door from inside, and
  inside the outer office during the corridor beat (frame
  `02_rain_inside_the_suite.jpg`: streaks at the left wall and over the files).
  The streaks are the rain layer drawn indoors. Something passing through the
  roof, in every interior frame where it shows. Hide the rain inside the
  Harbor Building's rooms (or the layer's indoor mask) - if it is a shared
  layer, name it in Left for its owner.

### 8. minor — the pad: the right hand covers what it shades, and "readable" lags the eye
- Steps: III, pad with the pencil; rub the top row.
- Seen: while the pencil is on the top figures the right hand and forearm cover
  them completely; I had to drag the pencil off the sheet to see what I had
  done. And once all three figures read plainly to me (36 / 12 / 57, big and
  white), the sheet was still not `readable` (the top row at 0.56 - 0.67 of the
  0.7 it needs, `pad.js` line 133) - no `E tear it off` for another ~10 s of
  rubbing, and E in that state steps back from the desk (`P.close()`), the
  sheet left on the pad. No threshold ends it while it is unreadable (ask 3 met);
  the reverse bites: readable to the eye, not to the game. Lower the row
  threshold to what reads (the figure's middle band shaded), or move the hand
  aside when LMB is up.

### 9. minor — the dial: on the number is not "on" it
- Steps: at the dial, mouse right until 36 sits under the index and stop.
- Seen: reading 36.03 - the index on 36 - **no click, no gate**
  (`safe.js` line 118: a number counts only when the reading passes it, so
  stopping a hair above it never sets it). Turning on two more numbers and back
  worked at once (36 / 12 / 57 cracked first time that way). Also the right
  hand's fingers cover the figures just right of the index (frame of the dial at
  36: "35" then the 40 under the index finger). With sound on, a player hears no
  click at 36 and does not know why; muted (the user plays muted sometimes) he
  has only the camera kick. Count a number as reached when the reading rounds
  to it.

### 10. minor — III: the pencil drawer is reached from one side only
- The pencil lies in drawer R1, which opens and is taken only from the desk's
  north end behind Ames (x 4.9, z 4.6). From the south, behind Ames's chair (where
  `search him` is), I could not get past the chair; from the front, aiming at
  the pencil gives "the ashtray" or "the pad". A first-timer will find it, but
  the desk's interactions fight each other from the front (the pad wins the
  cone over Ames, over the pencil and over drawer R1 from several places).

### 11. minor — "Piece it together." with nothing in hand and nowhere named
- After the envelope the sheet goes into the coat and the hands are empty; the
  line says "Piece it together." facing the empty safe. The lamp's pool on the
  desk is the only cue. A one-word place in the line ("At his desk: piece it
  together.") or the envelope in the left hand until the desk would do.

## The three proofs (my runs, on 08b9507)
| contest | idle | bad (stand and trade) | clumsy first-timer | good |
| --- | --- | --- | --- | --- |
| III puzzle | n/a (no fail state; the stall hint is there) | - | - | solved by hand (pad, dial, envelope) and by the owner's driver over every flavour step (`office_all`, 4/4) |
| IV door | **lost** at 21.6 s from the take's end, warned 3.8 s, "Shot standing in the open."; W held: lost at 25.6 s, "Flanked." | **lost 1, then WON** (finding 1) | won first try, untouched (finding 6) | won 3 of 3 first tries (desk, glass, move) |
| IV flank | **lost**, 25 s, warned 11 s, "Flanked." | **WON first try** (finding 1) | won first try | won 3 of 3 first tries |
| IV corridor | **lost**, 40.6 s (the lift comes at 16 s), warned 6.7 s, "Flanked." | lost 2 of 2 | won first try (from the suite, 97 s) | from the suite **lost 7 of 7** (finding 2); from the cart **won 2 of 2 in a row** |

Idle loses everywhere with a warning and a reason (good). Good play wins every
movement twice in a row **only by the owner's route** (out to the cart).

## Cheat read (src/scenes/05_gunfight.js, 04_office.js, office/*.js, Game.js)
- `05_gunfight.js` 85 - 88 `retryEase`: each fall at a beat (up to two) makes
  them settle 15 % slower and hit 12 % lighter. Written down (C5.md). After ONE
  fall it is enough for a man standing in the open to win the door (finding 1):
  a mercy that decides the contest for the wrong player. Make it start at the
  second fall, or tie it to cover.
- `05_gunfight.js` 264: movement 1 ends at `G.time - F.go > 40` even with men
  up - not a win (they stay, the flank is added); fine.
- `05_gunfight.js` 292 (the lift comes after 16 s anyway), 181 (the heavy comes
  if the corridor stalls 40 s), 303 (a stand-off breaker sends the last man
  round): all bring the fight to the player, none ends it. Fine; the breaker
  is the cause of finding 3's 80 s wait only by its condition.
- `src/game/Game.js` 570 `spareLast` (the kit's, lane C1): a killing hit is
  turned to 1 hp unless the warning has shown long enough. It guarantees the
  warning before the fall; it does not win (idle still loses everywhere).
- No man misses on purpose that I could find in the lane; `NUM.maxFiring 2`
  (at most two firing at once) is the kit's written rule.
- No timer ends a contest in III or IV in the player's favour. No loss without
  a tell seen: every fall had a warning of 3.5 s or more. But finding 2's men
  who go round give the warning only once they have the angle.

## The user's asks
1. **Met.** The suite's door draws itself shut behind me on its closer: open 1.0
   as I passed, 0.0 three seconds later in the outer office
   (`tools/plays/critic/c5/door_closer.json`).
2. **Partly met.** Ames is dead at his desk, slumped, blood red, in the slats'
   light; I said "oh" at the dents in the pad ("Dents in it. Written hard."),
   at the key on him opening the drawer, at the safe behind the picture, at the
   sheet's arrows matching the dial. Every thing answers (hat, photo, cooler,
   typewriter, phone lifted dead, every drawer, the cabinets' open ones say
   "shut"). But "what does it want" came twice: at the check (finding 4) and at
   the moment in IV (finding 5).
3. **Met.** 36 / 12 / 57 came up big, white, whole; held in my left hand beside
   the dial they read at a glance. (Finding 8: the hand covers it while rubbing,
   and readable lags the eye.)
4. **Met.** The safe is kept; the check's pieces read PIE / R 9 / — DOT / MIDNI
   while apart; the save has `note: 'PIER 9'` and the check in the inventory.
   (Finding 4: how to turn them is never taught.)
5. **Partly met.** The pause at the shadows is there and strong; the glass is a
   real choice (rounds through the frosted door hit: 5 of 5 in the glass run);
   doing nothing gets the door kicked and the man in the open down. The desk is
   not shown as a choice (finding 5), and with it the door is free (finding 6).
6. **Not met.** Idle play is down within seconds after the door (good); cover,
   rise, reload down wins (good); but **standing and trading in the open won the
   door (on its retry) and the flank** (finding 1).
7. **Met.** No man outside the window; nobody fired from the street in any run.
8. **Met in count, partly in feel.** Nine men (three at the door, two through the
   connecting door from 305, two out of the lift - one a Tommy gun - one out of
   306, the heavy up the stair); revolver only. The door's three still come
   through one door into one opening (finding 1, 6).
9. **Met as far as I walked.** No man through a frame or a desk in the frames I
   looked at; Ames does not move; I could not walk through his chair, the desk
   or a wall; doors open or rattle (the owner's jank walk covers more than I
   did). Rain through the roof is the one pass-through I saw (finding 7).
10. **Met (with V).** "See if more are coming." - walking up to the street
   window cuts straight to V in the same room at the same blind ("Check the
   street.", `E look out`): no black, no card hiding a jump. The man under the
   lamp is V's first beat (lane C6's), not seen in IV itself.
11. **Met.** Golden 32 / 32 identical. The banker's lamp is the one pool on the
   desk (switched by its chain; dark before), the slats lie on the walls and
   the ceiling.

## The owner's Left, as a player would feel it
- Flank won by standing and trading: **felt** (finding 1; and the door too).
- The flank no longer comes while busy with the door: not felt as a problem; the
  turning handle and "The other door! Behind you!" read well.
- The heavy as the corridor's danger: not what killed the good hand in the suite -
  the men sent round did (finding 2).
- The kinder retry: **felt in the wrong place** (finding 1).
- The revolver's pocket uncounted: not felt in IV (nobody runs out).
- Retries drop the dead of earlier movements: a player retrying the corridor
  finds the room clean of the bodies he left - a small pop at each checkpoint,
  felt.
- The washroom light off, the lift button that only rings, the dead corner
  behind the secretary's desk: small, fine.
- Not in Left and felt: findings 3, 4, 5, 7, 9.

## Good, must not be broken
- The corridor arrival and the suite's door: "Room 304. Ames.", the door gives,
  shuts behind me on its closer.
- Ames dead at his desk in the slats' light; the dark room; the banker's lamp on
  its chain the one pool; the golden frames untouched.
- The pad: the dents line before the pencil, the card at the pad, the figures
  big and white with the turn arrows, the sheet held in the left hand beside the
  dial (it reads at a glance). The dial's camera close and its prompt; the
  handle; the envelope.
- The check's pieces legible while apart; the stills; PIER 9 in the save.
- IV's take on the three shadows on the frosted door and sidelight - the best
  frame of the chapter; rounds through the glass really hit.
- Idle loses every movement with a warning (3.5 - 11 s) and a reason; the flank's
  handle turning and its line; the lift's dial and cage; the heavy's line and
  the gate's clank; nine men, revolver only, no window shooter.
- The window's cut into V.
- Every flavour thing answers and nothing broke the room in `office_all`.

## Plays (tools/plays/critic/c5/)
`office_all.json` (III, every thing then the solve, owner driver),
`door_closer.json` (ask 1), `iv_idle.json`, `iv_holdw.json`, `iv_bad.json`,
`iv_clumsy.json`, `iv_good_desk.json`, `iv_good_glass.json`,
`iv_good_move_out.json`, `iv_corr_out2.json`, `iv_corr_in.json`; `status.js`
(a status line for tools/stepplay.mjs). Run each with
`NOIR_PORT=5345 node tools/play.mjs tools/plays/critic/c5/<name>.json`.

## Frames (docs/story/review/wave-c/C5/critic/)
- `01_corridor_stale_line_flanked.jpg` - the corridor from the suite: the
  heavy dead, the line still "One more. On the stair.", "Behind you!" as the
  Tommy gunner comes round through Ames's room (finding 2, 3).
- `02_rain_inside_the_suite.jpg` - rain streaks inside the outer office
  (finding 7).
(The III frames I took by hand were lost with a scratch folder; the owner's
review frames 02 - 04 show the pad, the dial and the pieces as I saw them.)

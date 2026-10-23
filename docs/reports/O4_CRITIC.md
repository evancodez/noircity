# O4 — the cold critic's play (combat: the crowd brawl, the guns, the shotgun, the gym, the gun shop)

Played cold on `ow/O4-combat` at `b9c7abe`, dev server on 5374, muted, by
real input only (`tools/play.mjs`; my plays in `tools/plays/critic/o4/`,
reusing the lane's bots `tools/lib/o4_brawl.mjs` and `o4_guns.mjs` with
their profiles). Played first, read the owner's report last. Frames in
`docs/review/O4/critic/` (1440 x 900). The machine was loaded by other lanes
throughout (load 10 - 26).

What a player gets today: `?start=o4` drops him from the title into a chain
of contests on the old block (a driver, two men, three, a cop, the diner,
the street), each won one fades to the next. None of it is in the city
(O1 is not merged); the gym, the gun shop and the range are reachable only
by `?start=o4.gym|shop|range`.

---------------------------------------------------------------------------
## Findings, most felt first

### 1. BLOCKER: the street shootout starts me where they can already hit me
- **What.** The beat puts me crouched behind the sedan; at 4 s, hands off,
  the warning line already says *They have your angle. Move!*
  (`c1_street_start.jpg`: all I see is the car's door). Hands off, I was down
  in 13.4 s with the fall *Down, but in the open.*, 87 of the damage taken
  *while crouched* where the game put me (`down-open:pistol 45`,
  `down-open:tommy 42`). Medium hands' first try: down in 16.8 s,
  *Flanked.*, again mostly hit while down in the open. Bad hands' first
  try: 75 of the damage came while down, yet the black said *Up over the
  cover too long.*: the fix it names is not what killed me.
- **Steps.** `?mute=1&start=o4.street`, BEGIN, take your hands off: the
  warning is up before you have done anything. Or
  `tools/plays/critic/o4/street_idle.json`, `street_medium.json`,
  `street_bad.json`.
- **Where.** `src/scenes/94_o4.js` `STREET.at` / `STREET.car` (the sedan at
  `yaw 0.06` is end-on to the Tommy gunner at (12.9, -25.1) and the first
  pistol). Start me behind something that hides me from all three opening
  men (ask `coverFor(G, at, man)` for each and move the car or the start
  until all three say hidden), and make the black's line follow the damage
  that actually put me down.
- **Why it is a blocker.** A loss that starts at second 0 in the spot the
  game chose, with a line that blames the player for the wrong thing, is a
  loss for no reason (WAVE_C §1 rule 2).

### 2. BLOCKER: "Use the room." and the room answers nothing
- **What.** The diner's objective is *A fight in the diner. Use the room.*
  I walked to the counter where the beer bottles stand
  (`c4_diner_no_take.jpg`: the bottles in plain view) and to a cafe chair
  by the window, and looked at each: no `E take the …` prompt came, ever;
  E did nothing. The medium bot with `things` on (it presses E whenever a
  `take the` prompt shows) fought the whole diner by the pad (46 s) and was
  never offered one (`stats.things = 0`).
- **Steps.** `?mute=1&start=o4.diner`, walk left to the counter, look at a
  bottle; walk to a chair at the window tables and look at it.
  `tools/plays/critic/o4/diner_poke.json`, `pad_diner.json`.
- **Where.** `src/combat/brawl/Crowd.js:572` (`offerThing`: range 1.9,
  cone 0.55, the point is the thing's origin). The bottles stand at
  x = -14.51, behind the counter's top, about 2 m from where my feet stop
  at the counter; a chair's origin is at the floor, so standing at it and
  looking at it at eye height is outside the 0.55 rad cone. Give each
  thing a take point at its middle (the bottle's neck, the chair's seat),
  a reach measured from where I can stand, and prove it with a play that
  walks up and takes each one.
- **Why.** The objective names a verb the player cannot find
  (GAME_TWO §1 C1: what looks usable is usable).

### 3. MAJOR: a fall in the police shootout wakes at the hospital, gun kept
- **What.** Hands off against the police, the black, then *The hospital
  steps.* / *The hospital. Stitched up.* with the revolver in my hand.
  The brief, the owner's own table (`police | … down, the station`) and
  `fall.js` say the police's fall is the station, the guns taken.
- **Steps.** `?mute=1&start=o4.police`, hands off.
  `tools/plays/critic/o4/police_idle_wake.json`.
- **Where.** `src/scenes/94_o4.js:271`: `K.begin({ … to: G.o4stay ?
  beatName : 'hospital' … })` for both the street and the police.

### 4. MAJOR: the run after the police (and after walking off a fight)
- **What.** `NEXT` has no `police` (`src/scenes/94_o4.js:103`), so a won
  police shootout goes to `scenes.go('o4', { beat: undefined })` (read in
  the code; my plays could not reach it, because `tools/lib/o4_guns.mjs:123`
  forces `o4stay`). And walking off a street fight (`Walked away.`) sends
  me, 1.8 s later, back to the start of **the same fight**
  (`94_o4.js:313`: `beat: r === 'won' && !G.o4stay ? NEXT[name] : name`):
  I ran 31 m to leave him and was put back in front of him.
- **Steps.** `?mute=1&start=o4.brawl1`, turn round and run (Shift + W) for
  6 s: *He's coming.*, *Walked away.*, then the driver again.
  `tools/plays/critic/o4/brawl_poke.json`.
- Fix: `police` in `NEXT` (`done`); `left` goes on where I am (or to the
  next contest), never back to the start of the one I left.

### 5. MAJOR: cards stacked at the start, and a card in danger
- **What.** In the very first fight four cards come in about 20 s, three
  of them inside the first 8 s, all while men are throwing at me: the
  dodge at 2 s (held), *hit when his guard drops* at 4.7 s, *keep it
  pressed: the heavy* at 7.4 s, *hold to block his jab* at about 20 s. In
  the 1v2 the **block** card is on screen during a live **dodge** cue
  (`c2_card_in_cue.jpg`: the black and white halves, the streaks, and
  `SPACE hold to block his jab` over them): the card tells me the wrong
  verb at the one moment it matters. The owner's report says a card other
  than the dodge's goes when a cue comes; in play it did not.
  The very first frame a player sees (`c3_first_second.jpg`) is the cue's
  half-black, half-white screen with the dodge card: the fight opens on
  its hardest verb.
- **Steps.** A fresh save, `?mute=1&start=o4.brawl2`, hands off; watch the
  first 10 s. `tools/plays/critic/o4/idle_1v2_wake.json`,
  `b1v2_medium.json` (snap 00).
- **Where.** The cards' triggers in `Crowd.js` (the teach calls); the
  kit (`docs/story/seams/Z.md`) should refuse a card while a cue is live.
  One card, then a safe second (no man in his blow) before the next;
  the jab card first, the dodge card at the first cue but not in the
  first two seconds of a fight (let the first man walk in).

### 6. MAJOR: the dodge does not always act on the press
- **What.** In a live 1v2 (no hold: he is hitting me), press to act over
  12 presses each: jab 27.3 ms mean (max 72), block 22.2 (max 46), the
  heavy from its release 26.3 (max 81), but the **dodge 52.5 ms mean,
  248 ms and 150 ms on two presses** (they were kept behind a blow's hold).
  The dodge is the one verb that is timed against his blow; a press held
  back a quarter second by a hurt is a dodge that came too late, and the
  black then says *Too slow*.
- **Steps.** `tools/plays/critic/o4/latency_live.json` (measures to the
  step the act starts on; the frame shows it one frame later).
- **Where.** `Crowd.js` the hurt (`me.act = 'hurt'`, `CROWD.hurtMax 0.25`)
  and the key buffer (`me.buf`, 0.3 s). Let A / D cut a hurt short (a
  hop out of a stagger) instead of waiting it out.

### 7. MAJOR: in a fist fight the gun in my coat cannot be drawn
- **What.** With the revolver owned, the wheel (and every other key) does
  nothing while a fight is on: `94_o4.js:300` `if (w && !C.active)`. GTA
  but noir: a man in a street fight with a .38 under his arm can pull it
  (and the city answers: heat). A player who tries finds the game says no
  without a reason.
- **Steps.** `?mute=1&start=o4.brawl1`, wheel or 2: nothing.
- Fix: the wheel draws the gun in a fight too (the fight ends as a
  shootout or the men run); if the lane keeps it out, say why on screen.

### 8. MAJOR: keys written as text in the objective line
- *E: back to it.* on every wake (`94_o4.js:299`, the frame
  `c5_hospital_key_text.jpg` shows it twice: the objective and the prompt
  under it), *All of them won. E: again.* (`94_o4.js:290`). GAME_TWO §1
  B6: never a key written as text: the prompt (with its key cap) is
  enough, the objective says what, not how.

### 9. MINOR: the beat starts under the black and the card
- On a direct start the fight is already on while the screen is still the
  fade and the scene card says *THE STREET* (in the diner, at the gun
  shop's counter, on the range): the drunk was stepping in at 2.8 s while
  I could barely see him. Start the men when the fade has lifted, and name
  the card for the place (or no card).

### 10. MINOR: the shop is hard to read
- The counter is a dark box in a black void (`c6_shop.jpg`, a stand-in:
  O5's room); the shotgun is a black smear on it and the shells and the
  .38s are not visible at all. Their take points are 0.13 rad apart
  (a hand has to aim at the dark to find *buy ten shells*). Everything
  else works (below). Until O5's room: a light over the counter and the
  boxes pale enough to see.

### 11. MINOR: the top of the screen
- The objective line and the man's name bar sit on one line; in narrower
  frames they print over each other (the jab strip at 640 px), and in a
  cue the black half swallows the objective (`c2`, `c3`). The words
  *Down. All of them.* after a single cop.
- The first dodge's held card stops the world about five seconds of real
  time and lets go by itself; while it holds, my feet still walk (W moved
  me 2.7 m with the game clock stopped at 4.1 s).
- `src/combat/brawl/kinds.js` comment says *my jab 4*; `CROWD.me.jab` is 5.

---------------------------------------------------------------------------
## The four proofs (mine, by the lane's bots and the critic's profiles)

| contest | idle | bad | medium | good |
| --- | --- | --- | --- | --- |
| 1v1 (driver) | warned *One more and you're down.* at 29 s, still standing at 31 s when my cold play ended (slow to lose; the fall itself not seen) | won first try, 29 s (11 of 16 jabs into his guard) | - | - |
| 1v2 | down 24.9 s, warned 4.3 s, *From behind. Keep them in front.* | - | down try 1 (*Into his guard. Wait for openings.*, warned 6.3 s), won try 2 | - |
| 1v3 | - | - | won first try (41 s, 4 taken) | won twice in a row, 0 blows taken either time |
| cop | - | - | won first try (56 s) | - |
| diner (pad only) | - | - | won first try (50 s), no thing ever taken | - |
| street | down 13.4 s, warned 9.4 s (but see 1) | down try 1 (wrong line, see 1), won try 2 | down try 1 at 16.8 s (*Flanked.*), won try 2 | won twice in a row (31 s, 33 s) |
| police | down, warned; wakes at the hospital (see 3) | - | - | down try 1 (*They had your angle.*), won try 2 |

Nothing wins itself: every idle play lost, warned, with a line. Good hands
won every contest I gave them twice. The fist fights sit in the middle
(medium one to two tries). The guns' first try is lost more than it
should be, and for the reason in finding 1. Not played by me: the gym's
bout (time box), 1v1 / 1v2 good, 1v3 bad and idle.

## Cheats and losses without a tell (code read)
- `src/scenes/94_o4.js:249` (`hospital`): if I do not own a revolver, I am
  given one. After the station takes my guns, the next hospital wake hands
  a revolver back free.
- `src/scenes/94_o4.js:204` (`shop`) and `:216` (`gym`): the money is
  topped up to $150 / $60 each time the beat is set up (a fresh ctx), so a
  lost bet at the gym costs nothing on the test bed. Fine for a bed, wrong
  if it reaches the city.
- `src/scenes/94_o4.js` `STREET.at` / `car`: the start spot is exposed to
  the opening men (finding 1): a loss whose cause the player cannot answer
  in the first seconds.
- Fair and kept: `Crowd.js:904` (the last blow spared until the warning has
  been up a second: always warned), `Crowd.js:134` (the mercy after a fall:
  a wider cue window and longer openings, never a blow landed for me).

## What is good and must not be broken by the fixes
- **The crowd brawl reads and feels right.** The jab lands on the press
  (27 ms live), the fist reaches him, an inked burst at his jaw, his bar
  drops, he flinches (the jab strip); the block 22 ms; the heavy from its
  release 26 ms. One to three men work: one steps in at a time, the cue's
  black and white halves say which way, the fixes on the black are short
  and true (*From behind. Keep them in front.*).
- **Nobody walks through me**: W held into the driver stopped me at 1.05 m;
  the diner's walls, counter and tables stopped me.
- **Leaving works as a mechanic**: a run of about 30 m, *He's coming.*,
  then the fight left (only where it sends me after is wrong: finding 4).
- **The warnings**: every fall I saw was warned (4 to 9 s before).
- **The gun shop's rules**: the prompt with the price on each thing, the
  money taken, *12 rounds.* / *10 shells.* / *The double. Four shells with
  it.* and the gun in hand, *Not enough. $8.* with the hammer's dry click,
  the price card with *YOU HAVE $*.
- **The shotgun**: kills at 4 m (thrown down, the blood), wounds at 10,
  the pellets that pass a near man hit the one behind, the break-open
  reload counts two from the coat (10 -> 8 -> 6 -> 4), the count bottom
  right. The view of it (`r3`) is in the ink.
- **The pad**: the diner by the pad alone, 0 key or mouse events, won
  first try.
- **The fall's black** with its line, and the wake's cost line.

## The user's asks for this lane
1. *"get into shootouts, fist fight (please change these mechanics to work
   better and smoother)"*: **not met yet.** The fist fight is better and
   smoother (several men, the cue, the counters, on the press); the
   shootout works and good hands win it twice, but its first seconds are
   unfair (1), the room's things in a bar fight cannot be found (2), the
   gun cannot come out in a fist fight (7), and none of it is yet in the
   city.
2. *The three bars*: **not met yet.** Smooth: the jab, block and heavy
   under 50 ms, the dodge 52 ms mean with presses at 150 and 248 ms (6).
   The middle: cards stacked and one in danger (5), keys written as text
   (8). Everything works: the bottles and chairs (2), the police's wake
   (3), the run after leaving (4).

## Not done by the critic
No fps reading, no golden, no errors sweep (the owner's gate covers them);
the gym's bout not played; the frame-level latency (to the drawn frame)
not measured, only to the game step.

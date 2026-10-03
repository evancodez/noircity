# Wave C, lane C4: the cold player (critic), second look

I played II The Fight (with I's pay beat and Pier 9's fist fight) again from
the title, `?start=<id>&mute=1`, BEGIN, by real input only (`tools/play.mjs`
and my own hands, `tools/plays/critic/c4_bot.mjs`, now with three more
players: `slow`, `lazy`, `lazydodge`; the black's word is read off the screen
at every down), looked at every strip, and read the owner's report only at
the end. Branch `wave-c/C4-fight` at `ed22524` (the owner's last commit; my
plays are committed on top). Frames: `docs/story/review/wave-c/C4/critic/`
(the first look's eight are replaced; they are in git at `44d5ff5`).

**Verdict.** The first list is answered, and in play, not only on paper: the
lesson lets every kind of player through, the way out after the last blow is
shown wherever I stand, the black says what to change, the block and opening
cards come back, the warning goes with his fall, the check is read in the
hand, the heavy's card says what to do and its fist is in the frame, the room
answers. A practised hand wins twice in a row in II and at Pier 9; medium and
slow hands now get through in about seven downs. But the written mercy now
decides the fight: **a player who never dodges, never blocks and never reads
his guard - W held, a click every two or three seconds - wins II** (31 downs,
13 minutes). And the opening, the fight's other lesson, does not matter: the
same random clicker who only answers the cue wins faster than the medium
hands who read him. Then one new jank every player sees: the red matchbook
hangs in the air with no hand for as long as you read it.

---------------------------------------------------------------------------
## Findings, most felt first

### B1 (blocker) The mercy wins the fight for a man who uses none of what was taught
- **What.** W held the whole fight, a click of either button every 2 .. 3 s
  whatever he is doing, never A or D, never SPACE, never a look at his guard
  (my `lazy` hands; at the reel's card they keep the button pressed, as it
  says). Five minutes in: 10 downs, Mack at 45 %, round 2 - he is losing
  ground every life and never gets it back. Fourteen minutes in: **he won**
  (the KO at 760 s of fight, 31 downs - 22 of them `Too slow.` - 77 punches
  landed, 227 taken, never a cue answered on purpose). Frame `01` (minute 5:
  the cue he will never answer). A man who stands there or leans on W loses
  for ever (idle, holdW below); a man who clicks slowly while standing there
  wins - only by waiting it out.
- **Why.** `Brawl.js:2306` counts a life as "trying" when three punches
  landed in it - and random clicks land half the time (B2/M1 below). A trying
  man then gets the whole mercy: from the second down in a manner Mack gets
  **nothing** back (`:2312`) and I come up **whole** (`:2315`), and
  `mercy()` (`:877`) cuts his answer to a punch into his guard from 0.75 to
  0.15 (`:913`), his follow-up press (`:1545`), and stretches his openings
  (`:1327`, `:1472`, `:1761`) and the gaps between his blows (`:1371`). Every
  punch that lands is kept for ever: a checkpoint per punch. Downs cost
  nothing but time, so any player who clicks wins in the end. The brief: a
  small written mercy is allowed, one that wins is not; and the user: "able
  to not play the game and still win".
- **Steps.** `NOIR_PORT=5344 node tools/play.mjs
  tools/plays/critic/c4b_lazy_long.json` (14 min; `c4b_lazy.json` is the
  first 5 min). Read `G.brawl.stats.mannerDowns` (6 of the 10 downs by minute 5 counted as "trying")
  and `downWhy`.
- **Fix.** Earn the mercy with the verbs the fight teaches: a life is
  "trying" only if in it a cue was slipped or a blow blocked (landed punches
  alone are not trying); a down by `Too slow.` / `Wrong way.` / `Block his
  jab.` with no slip and no block in that life gives him back his 8 % as for
  the pounder. Keep "whole from the second down" for the man who slips cues.
  Then: `c4b_lazy_long` must not win in 15 minutes, while `c4b_medium`,
  `c4b_slow` and the owner's `fight_bad` still get through.

### M1 (major) His guard does not matter: random clicks win as fast as reading him
- **What.** My `lazydodge` hands: the same slow random clicks (either button
  every 2 .. 3 s, W held, never a look at his guard, never SPACE) but they
  answer the cue at 0.23 .. 0.3 s. **II: won in 234 s with 4 downs. Pier 9:
  won in 193 s with 5 downs.** The medium hands, who strike his openings
  (late, sometimes with the wrong fist) and poke his guard now and then: II
  207 s with 7 downs, Pier 9 137 s with 5. Random clicks reach his head 48
  times in 98 (`myHits`), and only 7 of his answers to 49 punches into his
  guard found me. "HIS GUARD IS DOWN - LEFT CLICK", "WAIT FOR AN OPENING", "hit
  only where his guard is down" - the lesson's first three cards and the card
  that comes back - teach a thing the fight does not ask for. The fight is
  "answer the cue and click now and then".
- **Steps.** `c4b_lazydodge.json`, `c4b_pier_lazydodge.json` against
  `c4b_medium.json`, `c4b_pier_medium.json`.
- **Where.** His guard is open about half the time between blows (breathers
  and misses, `Brawl.js:1327`, `:1472`, lengthened by the mercy); his answer
  to a punch into it (`:913`) only from `move` and cut by the mercy.
- **Fix.** His guard closed unless he opened it (a miss, a slipped blow, a
  breath that shows); a punch into his guard answered as the lesson says (the
  mercy may slow his answer, not drop it to 15 %); then random clicking at 20
  a minute should go down more often than the medium hands, and win slower.

### M2 (major) The red matchbook floats with no hand
- **What.** E search: the right hand brings up the matchbook (THE CARDINAL),
  and about a second later the hand is gone and the matchbook hangs in the air
  in front of me, turning, until I press E - 17 s in one of my plays (frame
  `02`; strip `c4b_matchbook` f05 .. f15). Ames's card after it is held in the
  fingers (fixed); the thing right before it is not. Every player sees it.
- **Steps.** `?start=fight.ko`, climb out, E search, wait. Play
  `c4b_matchbook.json`.
- **Where.** `src/scenes/02_fight.js:610-611`: `showMatchbook` plays once
  while `G.inspect.open` keeps the prop up on its own.
- **Fix.** The matchbook in the fingers as the card is (a held pose that
  stays until E), or the hand kept under the inspect view.

### Minor
- **m1 The warning sits through the reel, and the ticks write over the reel's
  card.** At low health `One more and you're down.` stays up while he reels
  out on his feet (he cannot hit me then) and lies across my loading fist;
  the fist's white ticks cross `LET GO TO HIT` on `OUT ON HIS FEET. KEEP IT
  PRESSED, LET GO TO HIT` (frame `03`, `c4b_good1`). Take the warning down at
  the reel's start (`Brawl.lowWarn`, `:1979`), and keep the ticks off the card.
- **m2 The name is the weakest line on Ames's card.** In the hand at 1440 x
  900, `J. AMES` is the thinnest print, broken strokes, with both arms of the
  red cross through it; `PRIVATE INVESTIGATIONS` and `HARBOR BLDG. RM 304` read
  better (frame `04`). The still that follows reads `J. AMES` clearly, and the
  objective says `Harbor Building. Room 304.`, so the story gets through; but
  the name should read first.
- **m3 The narrow door: walked into at a slant you slide off it onto the
  glass.** After the KO, heading for the 0.95 m leaf in its recess at a
  normal walking angle, I slid 1.1 m along it onto the bay's glass, the
  prompt gone, no word (frame `05`, `c4b_after_door`); a second try from a
  step to the side slid me 0.6 m the other way. Square on, `E lift the bar`
  shows up against the leaf, E lifts, walking pushes it open (`c4b_after_door2`:
  fine). Hold me on the leaf (a recess that catches the body) or keep the
  prompt for a man pressed to the glass beside the door.
- **m4 Lifting the bar is not seen.** Looking at the door at eye level, E: the
  hands drop out of the bottom of the frame and the prompt goes; the bar is
  below the view. Pitch the view down a little with the hand, or anchor the
  grip higher.
- **m5 The cook's `E talk` floats in an empty aisle.** Behind the counter
  looking south, `E talk` sits in the middle of the aisle with nobody there;
  E answers `Kitchen's closed.` from a man behind the wall (`c4_explore`,
  `x_dot`). Anchor it on the hatch, or only when he is in view.
- **m6 Pier 9 begun cold teaches the dodge only.** From `?start=warehouse.fight`
  (a save that never saw II): `Put him down.` and the held dodge card; nothing
  names the punch, his guard or the heavy until a down brings `[LMB] [RMB] hit
  only where his guard is down`; the heavy's only words are at his reel.
  Clicking is guessable; the heavy is not. (Rule 3: no verb cold.)
- **m7 Slow eyes that pound his guard still do not get through.** My `bad`
  hands (cue at 0.32 .. 0.5 s, a quarter missed, a punch into his guard every
  0.7 .. 1.5 s, never learn): 23 downs in 9 minutes, round 2, Mack at 61 %,
  told `Into his guard. Wait for an opening.` 11 times (the owner's run of the
  same hands won at 463 s with 16). Fair - the black says the one thing to
  change - but after B1's fix, check this player is not walled in.
- **m8 (owner's Left 1) the doorway in the lesson's first seconds**: not
  felt in my plays (Mack stood between me and the door each time I backed
  off); not re-checked.

---------------------------------------------------------------------------
## The first list, checked in play

| finding | now | seen |
| --- | --- | --- |
| B1 the lesson walls in a clicker | **fixed** | `c4b_masher` (never holds): `KEEP IT PRESSED` flashed, NOW FIGHT at 59 s; `c4b_wmash` (W + clicks): past BLOCK, NOW FIGHT at 55 s; `c4b_holdW` cut at 12 s |
| B2 the way out after the last blow | **fixed** | real wins at B2 (`c4b_good1`, `good2`) and B4 (`c4b_medium`, `slow`): `SPACE climb out` up 4 s after the KO, where the fight left me; from four spots along the bay a metre back looking at him: prompt each time, SPACE, out beside him (`c4b_after_sill2`, `landing`, his nearest knee 0.6 m from my feet: not on him); the door square on: `E lift the bar` from 1 m and pressed to it, E lifts, walking pushes it open (`c4b_after_door2`) - slanted: m3 |
| B3 clumsy hands stuck and not told | **fixed** for a player who is not pounding his guard | the black says the cause and what to do (frame `07`: `Block his jab.`, `Into his guard. Wait for an opening.`, `Too slow.`, `Wrong way.`, `Caught swinging. Hit when he's open.`, `Get out of the big ones.`, `No room. Get off the wall.`); the block card after a jab down, the opening card after an answer down; medium won II 207 s / 7 downs (was 21 downs, round 2), slow eyes won 305 s / 7 (`c4b_slow`), Pier 9 medium won 137 s / 5 (was 18 downs, him full); the pounder: m7 |
| M1 the warning outlives the fight | **fixed** at the KO, both fights | `warn: null` at the KO in every win (II and Pier 9); still up during the reel: m1 |
| M2 the check unreadable | **fixed** | picked up, held up, read: DINER, No 4417 in red, `1 Scotch, neat .35`, `thank you - Dot`; laid back; `E pay` beyond its head (frame `08`, `c4b_check2`) |
| M3 the heavy a riddle, its fist in the corner | **fixed** | `KEEP IT PRESSED: IT LOADS.   LET GO TO HIT`; held, the fist cocks up left of centre with its three ticks, in the frame all the way (`c4_heavy` rerun) |
| M4 nothing answers after the fight | **fixed** | docker `Not my fight, mister.`, Dot `You'd better go. They'll send more.` / `Go on. I'll be all right.`, the cook `Kitchen's closed.` / `I said closed.`, the jukebox `E play` (`c4b_dot`, `c4_explore`); m5 |
| m1 the still says R. AMES | **fixed** | the still reads `J. AMES` (`c4b_card2` m18) |
| m2 the card floats | **fixed** for the card | in the right hand's fingers, by its edge, through looking down too (`c4b_card2` m05 .. m13); the matchbook now floats: M2 |
| m3 BARRED. on NOW FIGHT. | not seen again | (I did not reach the door at the lesson's end) |
| m4 the W-holder's fight goes soft | **fixed** | `c4b_holdW`: 15 downs in 5 min, one every 11 .. 23 s, warned, `Too slow.` / `Block his jab.`, him untouched |
| m5 a white frame at a stool | not seen | - |
| m6 the cue out of reach for slow eyes | **fixed** | +0.05 s after each `Too slow.`; slow eyes got through (`c4b_slow`) |
| m7 the slip judged by the key | **fixed** (read) | a slip the room stops lands, and the black says `No room. Get off the wall.` (seen once at Pier 9, `c4b_pier_good1`) |
| m8 the doorway in the lesson | not fixed (owner's Left 1) | not felt by me |

---------------------------------------------------------------------------
## The three proofs, as I played them (real input, my own hands)

| contest | idle | holding W | fast spam | slow random clicks, no dodge (`lazy`) | slow random clicks + the cue (`lazydodge`) | clumsy | practised |
| --- | --- | --- | --- | --- | --- | --- | --- |
| II The Fight | **loses**: the lesson cut at 12 s, first down 38 s, then every 11 .. 21 s, 7 downs in 145 s, warned before each | **loses**: 15 downs in 5 min, him untouched | **loses**: masher 47 downs in 5 min, round 1; W + mash 27 in 4 min | **wins** at 13 min after 31 downs (B1) | **wins** 234 s, 4 downs (M1) | medium **won** 207 s / 7 downs; slow eyes **won** 305 s / 7; slow eyes that pound: 23 downs in 9 min, round 2 (m7) | **won twice**: 176 s and 151 s, 0 downs |
| VII Pier 9 foreman | **loses**: 10 downs in 136 s, warned each, him untouched | - | (first look: 39 downs in 5 min) | not run (same code) | **wins** 193 s, 5 downs (M1) | medium **won** 137 s / 5 downs | **won twice**: 182 s / 2 downs, 134 s / 1 |

Idle and W-holding lose everywhere, fairly; fast spam loses; practised hands
win twice in a row; clumsy hands that try get through in about seven downs.
What fails: slow clicking with no dodge wins in the end (B1), and reading his
guard buys nothing over clicking at random (M1).

**The click, in a real fight** (`c4_click_real`): 120 presses of 60, 120, 200,
280 ms, either button: 117 jabbed on the press, 3 (while reeling from his
blow) 33 .. 83 ms later; contact 0.05 s after the press; no wind-up from a
click.

**The cue's window** (`c4b_probe`): answered 0.30 s after it shows, in time;
0.34 s and later, `late` - and after each `Too slow.` the window grows (a
0.35 s answer was in time after one).

---------------------------------------------------------------------------
## The user's asks, as seen in play

1. **People fleeing go round me** - met (code unchanged since the first
   look; rerun `c4_start_right`): nobody through anybody; nearest me to Mack
   0.71 m (he brushes past my face on his way in), runner to runner 0.81 m.
2. **The dodge cue and slowdown** - met: ink, not an arrow; the dark side, the
   torn white side, strokes toward the light; the world at a third; the first
   one held with its card; 0.34 s real, somewhat hard, growing a little after
   `Too slow.`.
3. **The same for thrown things** - met (the plate and the bottle cued; in
   every run's cue list).
4. **A click jabs at once** - met (above).
5. **A better heavy** - met as a scheme (no jab delayed or swallowed; the card
   says what to do; the wind-up is seen in the frame; fast spam never wins) -
   **but dodging does not have to matter** (B1), and not felt by ear (muted).
6. **The street door** - met: barred with a bar I can see during the fight,
   out only after the window; after the KO `E lift the bar` and a push, or
   over the sill (slanted approach: m3; the lift unseen: m4).
7. **Ames's crossed card** - met: in the fingers, crossed in red, legible (the
   name weakest: m2); `Harbor Building. Room 304.`; the still `AMES. MARKED.`
   with J. AMES; III (`c4b_card`: on into the Harbor Building corridor,
   `Find Ames. Room 304.`). The matchbook before it floats (M2).
8. **The fight is kept** - **not met**: fast and arcade for a practised hand,
   the lesson teaches the new rules and lets everyone through, losing is
   warned and explained, idle never wins, Pier 9 runs on the same rules; but
   the mercy wins it for a man who never dodges (B1) and the guard it teaches
   does not matter (M1).
9. **The diner is kept** - met: six goldens of the lane IDENTICAL on my check
   (`diner_settle`, `diner_order`, `dinerfront`, `fight_round1`, `street`,
   `title`); Mack's line `She's got nothing to say to you.`; the check read in
   the hand.

---------------------------------------------------------------------------
## Cheats read in the code

- **Wins (not allowed)**: the mercy for a "trying" man, `Brawl.js:2306`
  (trying = three landed, or a cue slipped, or a blow blocked, in that life),
  `:2312` (nothing back for him from the second such down), `:2315` (up whole
  from the second), with `mercy()` `:877` feeding `:913` (his answer 0.75 down
  to 0.15), `:1545` (his press), `:1327` `:1472` `:1761` (openings longer),
  `:1371` (gaps longer). With "landed three" counted as trying, a slow random
  clicker qualifies, and every punch he lands is kept: B1.
- Fine, written, wins nothing: the spared hit (`:1576-1580`: a blow that would
  put me down before the warning has been up a second leaves one; idle still
  goes down every 11 .. 21 s); the lesson's safety (`BrawlLesson.js:122` his
  health floored at 70 %, `Brawl.js:1576` mine at 30, the step let go after
  15 s / 16 presses / three catches - lesson only); the cue's window +0.05 s
  per `Too slow.` to +0.2 (`:887`); the pinned slip lands (`:1464`).
- No timer ends a contest: left alone at the window in the reel he comes
  round and fights on (`:2126`; held up on his way, `:2113`); the KO needs a loaded punch or a
  thing.
- Nothing loses without a tell any more: the small blows' tell is drawn at
  his fist, and every down is warned and named.

---------------------------------------------------------------------------
## The owner's left list, as a player feels it

1. m8 the doorway - not felt (above).
2. Clumsy players go down often - felt, and fair now: seven downs for medium
   and slow hands, each named; the pounder is the outlier (m7).
3. The cue's window by models - felt right for my hands; a person must sit
   at it.
4. Two downs 2.2 s apart - not seen (shortest gap in my plays about 5.5 s, a
   masher).
5. m5 - not seen.
6. The check and card held by poses fitted by eye - felt a little: the left
   hand's fingers lie across the check's lines; the card's hand is very big
   against it; and the matchbook has no hand at all (M2, not in the list).
7. Sound - not judged (muted).
8. - 12. Not felt.
13. Pier 9 - passes; begun cold it teaches only the dodge (m6).
14. - 15. Fine.

Not in the list and most felt: B1, M1, M2, m1.

---------------------------------------------------------------------------
## What is good and must not be broken

- **The lesson lets everyone through**: a clicker, a W-masher, a hands-off
  player, a card-reader; and it still teaches in order.
- **The black says what to change**, in the kit's lettering, and the block's
  and opening's cards come back when that is what put me down (frame `07`).
- **Idle and W-holding lose, warned, every 11 .. 23 s**, in II and at Pier 9;
  fast spam never wins.
- **Practised hands win twice in a row**, II and Pier 9, in two to three
  minutes with 0 .. 2 downs; medium and slow hands that try get through.
- **The jab on the press** (117 of 120, 0.05 s to contact) and **the cue**
  (ink, the held first card, the slowdown, the growing window).
- **The way out after the last blow**: the climb prompt where the fight left
  me (frame `06`), along the whole bay; the bar's prompt square on; the push.
- **The check read in the hand** (frame `08`) and **Ames's card in the
  fingers**, the still with J. AMES, the line, III.
- **The room clears round me**; **the room answers** after the fight.
- **The diner's look**: the lane's goldens identical.

---------------------------------------------------------------------------
## Frames (`docs/story/review/wave-c/C4/critic/`, 1440 x 900)

| file | what |
| --- | --- |
| `01_never_dodges_still_wins.jpg` | minute 5 of the `lazy` hands (W held, a click every 2 .. 3 s): the cue they never answer; they won at minute 13 after 31 downs (B1) |
| `02_matchbook_floats_no_hand.jpg` | the matchbook in the air, no hand, two seconds after E search (M2) |
| `03_reel_warning_and_ticks_over_card.jpg` | the reel: the warning over the fist, the ticks over `LET GO TO HIT` (m1) |
| `04_card_name_line_weakest.jpg` | Ames's card in the fingers: the name the weakest line (m2) |
| `05_door_slid_off_onto_glass.jpg` | after the KO, walked at the door at a slant: slid onto the glass, no prompt (m3) |
| `06_good_climb_prompt_after_real_win.jpg` | good: a real win at B4, `SPACE climb out` where the fight left me |
| `07_good_black_says_what_to_do.jpg` | good: the black, `BLOCK HIS JAB.` |
| `08_good_check_read_in_hand.jpg` | good: the guest check read in the hand |

## How to rerun

`NOIR_PORT=5344 node tools/play.mjs tools/plays/critic/<play>.json` (against a
build - `npx vite build`, `npx vite preview --port 5344 --strictPort` - for the
long ones; my dev server was stopped by its time limit under the 14-minute
play):
- the fights (`c4_bot.mjs` profiles): `c4b_idle`, `c4b_holdW`, `c4b_masher`,
  `c4b_wmash`, `c4b_bad`, `c4b_slow`, `c4b_medium`, `c4b_good1`, `c4b_good2`,
  `c4b_lazy`, `c4b_lazy_long`, `c4b_lazydodge`, `c4b_probe`; Pier 9:
  `c4b_pier_idle`, `c4b_pier_medium`, `c4b_pier_good1`, `c4b_pier_good2`,
  `c4b_pier_lazydodge`; the click: `c4_click_real`; the wind-up: `c4_heavy`;
  `tools/plays/critic/c4b_mk.py <name> <start> <profile> <ms>` writes another.
- after the fight: `c4b_after_door`, `c4b_after_door2`, `c4b_after_sill`,
  `c4b_after_sill2`, `c4b_landing`, `c4b_landing3`, `c4b_matchbook`,
  `c4b_card`, `c4b_card2`, `c4b_dot`, `c4_explore`; the start:
  `c4_start_right`; the diner: `c4b_diner`, `c4b_check2`.

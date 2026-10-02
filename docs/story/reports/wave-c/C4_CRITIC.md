# Wave C, lane C4: the cold player (critic)

I played II The Fight (and the diner's pay beat, and Pier 9's fist fight) from
the title, `?start=<id>&mute=1`, BEGIN, by real input only (`tools/play.mjs`,
my own hands: `tools/plays/critic/c4_bot.mjs`, `c4_click.mjs`,
`c4_prompter.mjs` and the `c4_*.json` plays), looked at every strip, and read
the owner's report only at the end. Branch `wave-c/C4-fight` at `1bc3bb8`.
Frames: `docs/story/review/wave-c/C4/critic/`.

**Verdict.** The new parts are good: a click is a jab on the press, the cue
reads at a glance and is fair to a practised hand, idle play loses with a
warning and a word every time, spam never wins, the room clears round me, the
door is barred with a bar I can see, Ames's card is legible. But three things
stop a real first-timer cold: the lesson walls in anyone who keeps clicking
the wrong way; after the last blow nothing on screen shows the way out
(one window in two, and the door close up); and a clumsy player who does not
block goes down twenty times without getting through, told "Down." or
"Caught swinging.", never what to do. And the warning outlives the fight.

---------------------------------------------------------------------------
## Findings, most felt first

### B1 (blocker) The lesson walls in a player who keeps clicking
- **What.** At the fourth card, `HOLD ON AFTER THE JAB: IT LOADS.   LET GO`,
  Mack drops both hands against the wall and stands there. A player who only
  clicks (the most common first reaction to a fist fight) never leaves it: he
  never hits back, the card never goes, round 1 never starts. Seven minutes,
  847 punches landed, still the lesson (frame `01`). A second way in: hold W
  and click, hold once when the card says so - then stuck at `BLOCK` for six
  minutes: he is being hit, so he never throws the jab the step waits for.
- **Steps.** II from the title; through the cards click either button as fast
  as you like, never holding. Or: W held all the time and click, one hold at
  the HOLD card. Plays `c4_masher.json` (stuck at `hold`), `c4_wmash.json`
  (stuck at `block`), `c4_masher_look.json` (a frame every 4 s).
- **Where.** `src/game/BrawlLesson.js:121` cuts the lesson only after 12 s with
  no input at all; step 4 (`:26`) waits only for `B.did.hard`; step 8 (`:30`)
  waits for a jab he throws only from `move` and in reach (`:142`), and the
  three-catches let-go (`:100`) needs his blow to land.
- **Fix.** Every step lets go after a time or a count whatever I do (say 15 s
  or 10 presses in one step), the way the idle cut does for hands off. The
  lesson may never wait on one right action.

### B2 (blocker) After the last blow, nothing shows the way out
- **What.** `See to him.` - he is on the pavement, the door is barred. When
  he goes out through B4 (the south bay; about half my wins) I am left at the
  broken window, hands on the sill, looking at him: no prompt at all (frame
  `02`). `SPACE climb out` exists only at one spot of the sill 1.25 m to the
  side of where he lies, low, within 0.7 rad and 1.7 m: from where the fight
  leaves me it is 1.9 m away and behind my shoulder. Going to the door
  instead, as anyone would: walking into it says `Barred.` (frame `03`), and E
  there does nothing - `E lift the bar` shows only from about a metre back,
  looking at the bar's middle at waist height, or close up looking down at
  it. In one play I stood at the door, pressed E twice, nothing; in another I
  never found the sill and ended pressed against the pilaster.
- **Steps.** Win the fight (any way) until he goes out through B4; at the KO
  look at him, press SPACE: nothing. Walk to the street door, walk into it,
  press E with the view on the door: `Barred.`, nothing. Back off a metre:
  `E lift the bar` appears. Plays `c4_after_sill.json` (the sill found only by
  aiming at its hidden spot), `c4_after_door.json`, `c4_bar.json`.
- **Where.** `src/scenes/fight/out.js:58` (the bar's prompt: a grip point,
  range 1.8, cone 0.6) and `:66-72` (the sill's one spot, `zc`, range 1.7,
  cone 0.7).
- **Fix.** At the KO the climb prompt wherever I stand at the broken bay (the
  spot under me, or the whole sill); the bar's prompt whenever I am at the
  door facing it (anchor it on the leaf, widen the cone); a door tried after
  the KO says `E lift the bar`, not `Barred.`.

### B3 (blocker) A clumsy first-timer cannot get through, and is not told why
- **What.** With slow-but-honest hands the fight is a wall, in II and in Pier
  9, and the black's word does not say what to change.
  - *Medium hands* (the cue answered 0.24 .. 0.36 s after it shows, one in four
    wrong or missed; his openings struck 0.3 .. 0.45 s late, the wrong fist one
    in seven; a jab into his guard every 1.5 .. 3 s; never SPACE): **II: 21
    downs in 8 minutes, still in round 2**; **Pier 9: 18 downs in 6 minutes,
    7 punches landed in all, the foreman never below full**. The cue was not
    the problem (61 % in time).
  - *Slower eyes* (the cue at 0.32 .. 0.5 s): 28 downs, never out of round 1, 1
    cue of 23 in time.
  - *A learner* (medium hands that read the word on the black and change that
    one thing): won II after **10 downs in 6 min 9 s** - "gets through",
    barely.
  - What puts them down is the blows **without a cue**: his jab, his cross and
    above all his answer to a punch into his guard - 150 of 175 hits for the
    medium player at Pier 9, 51 of 95 for the learner in II. The words: an
    unblocked jab or cross is `Down.` (says nothing, frame `04`); the answer to
    a punch into his guard is `Caught swinging.` (about 90 downs with that
    word across my plays; `Into his guard.` never once). BLOCK is taught once, in the lesson, and
    never again (not at all if the lesson was cut, or the save began at Pier
    9); the dodge card comes back after two misses, the block card never.
- **Steps.** Play as a first-timer who answers the cue most of the time, hits
  his openings a little late, pokes his guard now and then and does not use
  SPACE. Plays `c4_medium.json`, `c4_pier_medium.json`, `c4_bad.json`,
  `c4_learner.json`.
- **Where.** `src/game/Brawl.js:12` (`DOWN_WHY`), `:2128` (the `down` and
  `caught` keys win over `answer`), `:2131` (only cue downs bring a card back),
  `:2146-2165` (the retry); `BrawlCue.js:34` (the small blows uncued).
- **Fix.** A word per cause that says what to do (`Block his jab.`, `Wait for
  the opening.`); the BLOCK card again after two such downs; and a written
  mercy after repeated downs in one manner that does not win by itself (his
  answer not every time, or his openings longer) until medium hands get
  through in three to five downs. The owner's own clumsy bot learns the right
  lesson at each down; a person needs to be told it.

### M1 (major) The warning outlives the fight
- **What.** `One more and you're down.` stays on screen after the last blow:
  through the reel, the KO, over the sill and out on the pavement by him (70 s
  and more in one play) - and at Pier 9 into `Get to the diner.` (frames `02`,
  `07`). It tells me I am about to go down when the fight is over.
- **Steps.** Be under 30 health when he begins to reel; win. Seen in
  `c4_good.json`, `c4_after_sill.json`, `c4_pier_human.json`.
- **Where.** `Brawl.js` `lowWarn` (`:1853`) and `stop` (`:243`, clears only while
  `warned`): the line outlives the flag somewhere between the reel and the KO.

### M2 (major) The guest check cannot be seen
- **What.** In I's pay beat the check lies at the bottom edge of the frame
  between my hands, white on the white-lit counter, and the `E pay` prompt
  sits on its head (frame `05`): no DINER, no pencil readable at 1440 x 900,
  nothing draws the eye to it. III hangs on recognising this paper.
- **Steps.** `?start=diner.pay`, BEGIN, look where you sit. Play `c4_check.json`.
- **Where.** `src/scenes/01_diner.js` (`CHECK_AT`, the pay prompt's anchor
  `counterAt(4, 0.3, -0.05)`).
- **Fix.** Lay it where the prompt is not (by the glass), or anchor the prompt
  elsewhere; a lamp on it or a second's look at it.

### M3 (major) The heavy is taught by a riddle, and its wind-up is in the corner
- **What.** `HOLD ON AFTER THE JAB: IT LOADS.   LET GO` reads as "wait"; it is
  the heavy's only teaching (and the step of B1). Held, the fist drops off
  the bottom-left of the frame and the three ticks flick at the corner (strip
  `c4_heavy.json`, frames h03 .. h09): seen if you look there, missed if you
  watch his face. (Heard: not judged, muted.)
- **Fix.** `KEEP IT PRESSED: IT LOADS.   LET GO TO HIT` (or the like), and the
  loading fist kept in the frame.

### M4 (major) Nothing answers in the diner after the fight (WAVE_C §1 rule 7)
- **What.** E at and walking into the docker, Dot, the cook's hatch, the
  jukebox, the booths, the stools: no prompt, no line, no sound. The docker
  stands at the north wall like a post. (I can walk behind the counter; it is
  finished there.)
- **Steps.** After the KO walk the room, E at everything. Play `c4_explore.json`.
- **Fix.** One small answer each (Dot a line, the docker's hands up, the
  jukebox plays, a stool spins).

### Minor
- **m1** The still `AMES. MARKED.` reads **R. AMES**; the card in my hand
  reads **J. AMES** (frame `06`, `c4_card2.json`). The kit's placeholder (and
  lane C9's picture) must agree with `props/kinds/c4.js amesCard`.
- **m2** Ames's card floats in the air with no hand under it (the matchbook
  before it was in my fingers): `c4_card.json` c16 .. c24.
- **m3** At the end of the lesson `BARRED.` and `NOW FIGHT.` are written on
  top of each other at the frame's centre (`c4_bad.json`, its NOW FIGHT frame).
- **m4** Holding W only: inside his reach his swings pass behind me (104 of
  his blows "dodged", 5 cues in 6 minutes). It still loses (two downs in six
  minutes, warned, never a hit landed), but a down takes one to two minutes
  instead of fifteen seconds: the fight goes soft for a W-holder (`c4_holdW.json`).
- **m5** Once, hands off, a whole frame of white paper during a stool's cue
  or its impact, the room gone (`c4_idle_cold.json`, i18). Check it is meant.
- **m6** The cue's 0.34 s of real time is out of reach above about 0.33 s of
  reaction (1 in 23 for slower eyes); `Too slow.` twice brings the card back
  but never more time. The user asked for somewhat hard; it is a wall for
  slower players.
- **m7** The slip is judged by the key, not the feet: A or D toward the light
  inside the window makes the blow miss even where the hop is stopped (a wall,
  the counter), so pinned, his fist passes where my head still is
  (`Brawl.js:1384`, `BrawlCue.js:126`). Read in the code, not seen in play.
- **m8** In the lesson's first seconds the doorway is an invisible wall in a
  fist fight (the owner's left 11): felt by anyone who backs off that way.

---------------------------------------------------------------------------
## The three proofs, as I played them (real input, my own hands)

| contest | idle | holding W | spam | clumsy (no learning) | clumsy who learns | practised |
| --- | --- | --- | --- | --- | --- | --- |
| II The Fight | loses: first down at 38 s, then every 12 .. 20 s, warned each time, `Too slow.`; never wins | loses slowly (2 downs in 6 min, warned, `Down.`) | **stuck in the lesson 7 min** (B1); with W: **stuck at BLOCK** (B1); passing the lesson then spamming: 52 downs in 6.5 min, never past round 1 | medium: **21 downs, round 2 at 8 min**; slow eyes: **28 downs, round 1** (B3) | won after 10 downs, 6 min 9 s | won 4 of 4 (169 s with 0 downs; three more, 1 down at most); faster hands won 208 s, 1 down |
| VII Pier 9 foreman | loses: 8 downs in 2.5 min, each warned | - | 39 downs in 5 min, never wins | medium: **18 downs, 7 punches landed, him full** (B3) | - | won 229 s, 1 down (a second run in `c4_pier_human2.json`) |

Idle never wins anywhere; spam never wins; practised play wins; clumsy play
does not get through without learning exactly the right thing, and is not
told it.

**The click, in a real fight** (`c4_click_real.json`): 120 presses of 60,
120, 200 and 280 ms, either button, while he fought me: 119 jabbed on the
press, one (I was reeling from his blow) 33 ms later; contact 0.05 s after the
press (median), 0.083 s at most; no wind-up from any click.

**The cue's window, felt** (`c4_probe.json`): answered 0.20, 0.24, 0.28, 0.32 s
after it showed: all in time (the window closes at 0.34 s of real time).

---------------------------------------------------------------------------
## The user's asks, as seen in play

1. **People fleeing go round me** - met. From the stool looking ahead, right and
   back, positions every 40 ms: no runner nearer than 0.8 m centre to centre to
   another, 1 m to me; the leaf kept off each runner in the doorway; nobody
   queues. Mack brushes past my face at 0.71 m on his way in (fills the frame
   for a moment; not through me).
2. **The dodge cue and slowdown** - met. Dark side, torn white side, strokes
   toward the light, the fist marked (frame `08`); the first held with its
   card; 0.34 s real: practised hands 79 .. 100 % in time, medium 61 %, slow
   eyes almost none (m6).
3. **The same for thrown things** - met (the plate and the bottle get the cue;
   the held card came on a throw in two runs).
4. **A click jabs at once** - met (above).
5. **A better heavy** - not met as delivered: the scheme is right (no jab ever
   delayed or swallowed; spam does not win; dodging matters), but its one
   card is a riddle, its lesson step walls a clicker in (B1, M3), and the
   loading fist sits in the bottom-left corner.
6. **The street door** - met: pushed open at my pace, never through anyone,
   barred with a bar I can see, `Barred.` and a rattle when tried in the lesson
   and rounds; out only after the window. But after the KO the way out is not
   shown (B2).
7. **Ames's crossed card** - met: legible at 1440 x 900, bold red cross,
   `Harbor Building. Room 304.`, the still, III (the still's name: m1).
8. **The fight is kept** - not met: fast and arcade for a practised hand, idle
   never wins, Pier 9 on the same rules; but the lesson walls in (B1),
   losing is not explained (B3: `Down.`), a clumsy player is stuck (B3), and
   the warning outlives the fight in both (M1).
9. **The diner is kept** - met: the six golden frames of the lane (diner
   settle, order, dinerfront, fight_round1, street, title) IDENTICAL on my
   check; Mack's line `She's got nothing to say to you.` (C1's); the check is
   added in pay only - and cannot be read (M2).

---------------------------------------------------------------------------
## Cheats read in the code

- `Brawl.js:1384` + `BrawlCue.js:123-128`: the slip is judged by the key: a
  correct A/D in the window makes the blow miss whatever the room let my feet
  do (m7). Needs the right input; does not win by itself.
- `Brawl.js:1492-1500`: a blow that would put me down before the warning has
  been up a second leaves me 1: a written fairness rule (warning first). Fine.
- `Brawl.js:2146-2165`: a down gives him back 8 % (more while I pound his
  guard), never past his manner's start, and I come up with 60 - with 100 from
  the third down in one manner: a written mercy; progress is kept across
  downs. It wins nothing for idle or spam (above). Allowed.
- `BrawlLesson.js:110` (his health floored at 70 % in the lesson), `Brawl.js:1495`
  (the lesson never puts me down), `BrawlLesson.js:100` (caught three times, the
  step passes itself): lesson only. Fine - but the lesson has no exit for an
  active player (B1).
- Loses without a tell (to a first-timer): his jab, cross and answer have no
  cue, only the body; they do most of the damage to a clumsy player and the
  black says `Down.` (B3).

---------------------------------------------------------------------------
## The owner's left list, as a player feels it

1. The cue's window, never felt by a person - **felt**: right for practised
   hands, none for slow eyes (m6).
2. A clumsy player goes down often - **felt hard**: 18 .. 28 downs without
   getting through (B3). The owner's clumsy bot learns the right thing at each
   down; a person is not told it.
3. The fist marked, not rimmed - not felt.
4. The room clearing passes close - not felt; nobody through anybody.
5. No hand on the door - barely felt.
6. The check faint - **felt, and worse**: blank and under the prompt (M2).
7. The held first cue - works.
8. The music not ducked - not judged (muted).
9. Pier 9 passes - for practised hands; a clumsy one is stuck (B3).
10. The fight's own black - fine.
11. The doorway's invisible wall in the lesson - felt by an explorer (m8).
12. `Barred.` - fine.
Not in the list and most felt: B1, B2, M1, M4, m1.

---------------------------------------------------------------------------
## What is good and must not be broken

- **The jab on the press**: every click of 60 .. 280 ms jabs in its step and
  strikes 0.05 s later, in a real fight; no click ever winds up.
- **The cue**: ink, not UI; dark side, torn white side, strokes toward the
  light; the world at a third while my hands run; the held first card; the
  dodge card again after two misses. It reads without being told.
- **Idle loses, every time, fairly**: `One more and you're down.` before every
  down, a word on the black, up again in seconds; in II and at Pier 9.
- **Spam never wins**, in II and at Pier 9 (39 .. 52 downs).
- **Practised play wins** in about three minutes, 0 .. 1 downs.
- **The room clears round me**; the leaf is kept off every runner.
- **The door**: barred with a bar that drops on the slam, rattles and says
  `Barred.`; the bar lifted by my hand; pushed at my pace; shuts behind me.
- **Ames's card**: big, legible, the red cross unmistakable; the line, the
  still, III; matchbook and card in the inventory.
- **The diner's look**: the lane's golden frames identical.

---------------------------------------------------------------------------
## Frames (`docs/story/review/wave-c/C4/critic/`, 1440 x 900)

| file | what |
| --- | --- |
| `01_masher_walled_in_the_lesson.jpg` | 52 s into the HOLD card, a clicker beating a man who never hits back (B1) |
| `02_ko_stale_warning_no_way_out_shown.jpg` | the KO at B4: him on the pavement, no prompt, the warning still up (B2, M1) |
| `03_door_after_ko_close_up_no_prompt.jpg` | after the KO, at the door: `Barred.`, no `lift the bar` (B2) |
| `04_down_word_says_nothing.jpg` | the black: `Down.` (B3) |
| `05_check_blank_under_prompt.jpg` | the guest check under `E pay` (M2) |
| `06_still_reads_R_AMES.jpg` | the still says R. AMES (m1) |
| `07_pier9_stale_warning_after_win.jpg` | Pier 9 won, `Get to the diner.`, the warning still up (M1) |
| `08_good_the_cue_reads.jpg` | what is good: the cue on his left hook |

## How to rerun

`NOIR_PORT=5344 node tools/play.mjs tools/plays/critic/<play>.json`:
`c4_idle_cold`, `c4_holdW`, `c4_masher`, `c4_wmash`, `c4_masher2`, `c4_bad`,
`c4_medium`, `c4_learner`, `c4_human`, `c4_good`, `c4_probe`, `c4_click_real`,
`c4_heavy`, `c4_down`, `c4_cues`, `c4_start_ahead|right|back` (the room
clearing, positions every 40 ms), `c4_doorflee` (runners against the leaf),
`c4_door_fight`, `c4_after_door`, `c4_after_sill`, `c4_bar`, `c4_push`,
`c4_card`, `c4_card2`, `c4_explore`, `c4_diner`, `c4_check`, `c4_move`,
`c4_pier_idle|human|human2|medium|masher2`. The hands: `c4_bot.mjs` (profiles
idle, holdW, masher, masher2, wmash, bad, medium, learner, human, good, probe),
`c4_click.mjs`, `c4_prompter.mjs`.

# C13 — the cold player's report (critic)

Branch `wave-c/C13-ammo` at e809877, port 5353, dev server, every run muted.
I played before I read `C13.md`. Plays of mine are in `tools/plays/critic/c13/`
(one driver copy, `c5_door_flow.mjs`: lane C5's door driver with `flow: true`,
which lets the game run from one movement into the next instead of sending the
page to each checkpoint). Frames in `docs/story/review/wave-c/C13/critic/`.

Short verdict: the pocket is real, shown, and honest in play; nothing in the
lane wins for the player. The one thing a player will feel is that **nobody
has proven IV in flow**: every IV proof sends the page to each movement's
checkpoint, which hands the gun back with at least 6 + 18. Played as the user
plays it (one chapter, the counts carried), the good hand reaches the
corridor with 13 to 16 rounds for a movement that takes it 12 to 14.

## Findings, most felt first

### 1. major — IV's pocket is proven per movement, not over the chapter; in flow the corridor is a knife edge
What: `tools/lib/c5_door.mjs` (used by `gunfight_good_desk`, `gunfight_bad`,
`gunfight_idle`) begins every movement with `scenes.go('gunfight', { beat })`,
and `armCounts` floors a checkpoint at 6 + 18 (`src/player/weapons/revolver.js:51`,
`:187`). So each movement of those proofs starts with 24 or more, and the
owner's "the good hand used all 24" is one movement's worth, not the chapter's.
In flow the counts carry (no floor; I checked: the flank begins with exactly
what the door left).
Played in flow (`iv_flow_good.json`, twice; `iv_flow_clumsy.json`, once):

| run | door shots | flank begins | flank shots | corridor begins | corridor |
| --- | --- | --- | --- | --- | --- |
| good 1 | 7 | 5 + 18 | 7 | **4 + 12** | lost "Flanked." (0 fired), retry 6 + 18 won with 12 |
| good 2 | 12 | 0 + 18 | 5 | **4 + 9** | lost "Flanked." (0 fired), retry 6 + 18 won with 12 |
| clumsy | 5 | 1 + 24 | 15 | **4 + 6** | lost twice, won the third with 16 |

The good hand fires 12 to 14 in the corridor (my two checkpoint runs: 10, 14;
owner's: 13), and arrives with 13 to 16. A good player who misses two more
than the bot runs dry in the corridor's first try, dies with "Empty." under
the line that says he was shot, and the retry quietly gives him 6 + 18.
The corridor first try lost with zero rounds fired in all three flow runs: I
believe that is my driver (its corridor route assumes the checkpoint's pose)
and not the game, but it means **good play has not been shown to win IV
twice in a row as a player meets it**. Steps: `NOIR_PORT=5353 node tools/play.mjs
tools/plays/critic/c13/iv_flow_good.json` (look at the `c13 flow:` lines).
Fix asked: prove IV good twice in flow (fix the driver's corridor start in
flow, or play it), and if the corridor's first try is short, give the
corridor a reason to have rounds (a box in Ames's desk drawer or the
secretary's, taken with E, the WAVE_C way) rather than a silent top-up.

### 2. major — `gunfight_bad`'s own check failed in my run: standing and trading in the open won two of three movements
What: `gunfight_bad.json`, first half (`profile: bad`, stands in the open and
trades): door **won** first try (low hp 47), flank **won** first try (low hp
83), corridor lost "Shot standing in the open." The play's check "standing
and trading loses (most movements)" FAILED. The clumsy half passed (3/3 first
try, 14 + 17 + 22 shots). The owner reports 3/3 for the same play: it is a
flaky line, not caused by the pocket (19 shots in all), but this lane's ask
is "the proofs still hold" and this one did not, once. Steps: `NOIR_PORT=5353
node tools/play.mjs tools/plays/gunfight_bad.json`. Owner: run it again; if it
fails again, that is lane C5's tuning (WAVE_C §2: a man with a line and time
to aim hits me) and goes in Left by name.

### 3. minor — `pier_loud` timed out once (second win: 300 s, 39 presses, 1 fall, no win, no loss)
What: in the batch run of `pier_loud.json` the first win took 35 s and 6
shots; the second (from the loud checkpoint) fell once ("Up over the cover
too long."), then went 4.5 minutes with neither a win nor a fall, and the
check failed. 39 presses against the 24 rounds the pass gives means the hand
was pressing an empty gun for part of it. I could not make a dry player
stuck on purpose: `pier_dry.json` fires all 24 at the roof and crouches, and
is shot within 13 s ("One on the catwalk!" then "The one on the catwalk got
you.", retry 6 + 18). My own `pier_loud_count.json` won 4 of 4 with 5 to 19
shots. So: probably the bot, but the owner should look at what the hand was
doing in those minutes before calling the pass proven.

### 4. minor — an empty pocket is very hard to see
What: the empty pocket is one row of hollow shells drawn `#111` with a
`#5c5a56` stroke (`src/player/weapons/_revolverHud.js`, `drawPocket`), on a
dark floor. In `c02_iv_dry_empty_row_faint.jpg` and
`c05_vii_loud_dry_row_faint.jpg` I had to look for it. The full rows read at
once (`c01`, `c04`); the empty state - the one that matters - does not. A
lighter stroke or the paper-white outline of the cylinder face would do.

### 5. minor — `Empty.` is a subtitle: with subtitles off the dry gun says nothing
What: `sayEmpty` goes through `hud.say`, which returns early when subtitles are
off (`src/ui/Hud.js:413`). The title's settings let the player switch them off;
then the only tell of an empty pocket is the click (and the faint row of
finding 4). It is a game message, not speech: `hud.warn` or a kit line would
always show.

### 6. minor — VI's count does not follow what IV left (by the table)
What: the window gun is 6 + 6 every time (`src/scenes/tail/gun.js:29`). A player
who left IV with 0 + 3 sees 6 + 6 out of the window; one who left with 6 + 24
sees the same. "Carried through V" is true only in the save
(`save.flags.ammo`), never on the screen. The brief asks for exactly this
row, so not a fault; written here because a player who counts will notice
rounds appear. The owner's Left 2 says the same.

### 7. minor — "He's nearly at the pier." is up 1.8 s before "He warned them." with him 41 m ahead
What: `c13_tail_gate.json` try 2: the gate line at 25.4 s, the fail at 27.2 s,
gap 41 m. The letter of the brief is met (the line always comes first, 1.5 s
or more: `GATE_READ`, `src/scenes/tail/chase.js:39`, `:329`), and "He's
pulling away." covers the gap earlier. But at that distance nothing the
player does in 1.8 s answers it: it is a reason said, not a warning heeded.

## The three proofs, mine

| contest | idle | bad / clumsy | good |
| --- | --- | --- | --- |
| IV The Door (checkpoint by checkpoint) | `gunfight_idle`: loses all three, warned 4 to 5 s first, reasons said - PASS | clumsy 3/3 first try; stand-and-trade won 2 of 3 (finding 2) | `gunfight_good_desk` 2 of 2 runs, every movement first try (8 + 9 + 10, 4 + 6 + 14 shots) |
| IV in flow (as the user meets it) | not run | clumsy gets through (corridor on try 3) | **not shown**: corridor first try lost twice, then won (finding 1) |
| VI The Tail gun phase | (lane C3's, not re-run) | `tail_gun_only` 7/7 (it gives itself a deep pocket of 60) | `tail_good` 7/7, two wins in one play, no fail |
| VII loud pass | `pier_dry`: dry and crouched, shot in 13 s with its warning and reason | - | `pier_loud` 1 of 2 (finding 3); `pier_loud_count` 4 of 4 |

## Explore (short)

- IV from the title: the count beside the cylinder is there from the chapter
  card (four rows of cartridges and the cylinder face, bottom right) and
  needs no word to read (`c01`). Spraying at the door from the first second
  gets me shot within ten seconds every time ("Flanked.", "Shot standing in
  the open."): I never ran dry that way, and each retry was 6 + 24.
- The HUD follows a reload pair by pair and never lags (`iv_reload_hud.json`:
  the drawn live cartridges equal the pocket at every sample).
- VII from CHAPTERS on a fresh save: the chapter card, then the creep card
  (none under the card: sampled every 50 ms), the gun away and 0 + 0. LMB in
  the dark: the hand to the coat, the click, `Empty.` (`c03`). At the shells:
  `[LMB] fire` with 6 + 18 (`c04`), nothing taught again as the telephone
  rings (`c13_cold_cards` 11/11 in my run).
- `c13_card_teach`: the chapter card up 75 samples, no teach card visible
  under it, then the fire card.
- Nothing in this lane changed a place: I did not repeat the jank walk.

## Cheats read (none that wins)

- `src/player/weapons/revolver.js:51`, `:53`, `:187`: the retry floor - a
  checkpoint in IV or VII's loud pass is never under 6 + 18. A fall refills
  the pocket. It is written down (the table's comment, GUNS.md) and it does
  not decide a contest; it does make "die to get your rounds back" the
  answer to a dry gun (finding 1).
- `revolver.js:249`: a press on an empty cylinder with rounds in the pocket
  starts the reload by itself (old, a convenience). Not a win.
- `src/scenes/tail/gun.js:197`, `:216`: the window gun reloads itself after
  its last round when the pocket has more (old). Not a win.
- `src/scenes/tail/chase.js:329`: the gate fail waits until its warning has
  been up 1.5 s. A tell, not a mercy.
- Nothing loses without a tell in the lane's code; dry deaths are told by
  the click, `Empty.` and the row (findings 4, 5 make that tell weak).

## The user's asks

1. **Counted and shown; dry click and `Empty.`; a reload takes from the
   pocket and fills only the empty chambers** - met. Seen: 6 + 24 drawn as four
   rows; `c13_dry` 9/9 in my run (two spent, R costs two; the last reload fills
   four; `Empty.` once, R loads nothing); in VII's loud pass, sampled every
   5 s across partial reloads (1 + 18, then 4 + 14 mid-reload, then 6 + 12), the
   cylinder plus the pocket only ever fell by the shots fired.
2. **One table, carried, by saves and by CHAPTERS** - met with two
   deviations the owner wrote down: IV gives 6 + **24**, not 6 + 18 (the
   brief's own fallback; my flow runs say 18 would leave the good hand dry in
   the corridor), and the carry through V never reaches the screen (VI is 6 + 6
   by its row). Seen: VI 6 + 6 (`c13_tail_gate`), VII from CHAPTERS 0 + 0,
   the shells 6 + 18, the loud retry gives back the checkpoint's 6 + 18,
   IV's flank begins with exactly what the door left.
3. **The proofs still hold** - not met in full: good desk 2/2, clumsy 3/3,
   tail good and gun-only pass, IV dry shown; but `gunfight_bad`'s
   stand-and-trade line failed in my run (finding 2), `pier_loud` timed out
   once (finding 3), and no proof plays IV in flow (finding 1).
4. **No teach card under a chapter card; VII cold teaches the gun at the
   shells; the gate loss always warned first** - met (`c13_card_teach`,
   `vii_cold`, `c13_cold_cards`, `c13_tail_gate`; finding 7 is about how much
   the warning helps, not whether it comes).
5. **Golden frames identical** - met: `golden.py check` 38/38 identical.
   `errors.sh` clean on `gunfight.quiet`, `warehouse.office`, `tail.river`, and
   every play above reported a clean `#errlog`.

## What is good and must not be broken

- The count beside the cylinder: four rows of inked cartridges, greyed as
  they go, no number, no box; it reads at a glance and belongs to the frame.
- A partial reload keeps the live rounds and costs only what it fills; the
  rounds in the left hand match what goes in.
- `Empty.` once, the click every time, R doing nothing: an honest dry gun.
- VII cold: the gun's cards at the shells, not under the telephone; the
  stealth start says nothing about guns except `Empty.` when I reach for one.
- The kit holding a teach card until a chapter card has gone.
- The gate line coming first in every case.
- The tail's count out of the window, drawn the same as on foot.

## After reading C13.md

- Its "IV 6 + 18 ... the good hand used all 24" is true of one movement
  begun at a checkpoint; the player feels the chapter (finding 1).
- Its proof table says `gunfight_bad` 3/3 and `pier_loud` 3/3; mine were 2/3
  and 1 of 2 loud runs: flaky lines, said so above.
- Left 1 (count hidden with the gun): fine as played; in IV and from the
  shells on the gun is always out.
- Left 3 (the tail's `Empty.` unreached): also unreached by me; 6 + 6 was
  never spent in `tail_good`.
- Left 4 (VII office door at the loud pass): not looked at.
- Left 7 (old saves get the row): a player would not notice.

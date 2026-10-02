# C10 — the whole game: the play-through, the seams, the bug hunt, the documents

Branch `wave-c/C10-whole`, port 5350. Every chapter lane is merged. You
own the game as one thing, from BEGIN to THE END, the way the user will
meet it when he sits down to play it by hand.

Read `docs/story/WAVE_C.md` (all), every lane's report
(`docs/story/reports/wave-c/C*.md` and their `left` lists, and each
`C*_CRITIC.md`), `docs/story/seams/Z.md` and `GUNS.md`.

## 1. The whole play
`tools/plays/whole.json`: one page session from BEGIN through the opening
stills and all eight chapters to THE END by real input, chaining each
lane's `_good` play (the old one is parked in `tools/plays/_wave_b/` with
its helper `tools/lib/whole.py`). It passes twice. And `whole_first.json`:
the same by the lanes' clumsy bots: it gets to the end, failing where a
first-timer would, never stuck.

## 2. The seams (every one played and looked at, as strips)
- Stills → I; I → II (no cut); II → the card, the still → III; III → IV
  (same room, no black); IV → V (the window's frame is both);
  **V → VI: straight into the car, no fade, no card on black, no hitch
  when the city comes in**; VI → VII (parked at the pier's gate: the same
  spot, the same car); VII → VIII (the still; the drive back if it was
  kept); VIII → the end still → THE END → the title.
- What each chapter assumes the last one left: the inventory and flags
  (WAVE_C §4 "What the detective carries"), the hands' set, the
  controller's mode, the weapon and its rounds (empty after VI; full
  after the shells; gone after the foreman), HUD layers, the objective
  line (never a stale one), teach cards (each key taught exactly once in
  a play from the title: list them in order, and check a chapter picked
  from CHAPTERS teaches what it needs if the save has not seen it),
  music cues (lane C1's rule), nothing left running from a finished
  scene (listeners, lights, sounds, an old stage's update).
- Saves: CONTINUE from every checkpoint of every chapter after a reload
  (`saves.json`), and a v1 save dropped quietly.
- The rulebook (WAVE_C §2): one key, one meaning. Walk the table against
  every chapter; anything that breaks it is a bug.

## 3. The bug hunt (play it badly)
For every chapter: the wrong keys at the wrong times (every key of the
rulebook in every mode; every mouse button during a still, a card, a
fail's black); ESC in every mode and resume; stand still for two
minutes everywhere a player can stand; walk away from the path and back;
every door and edge; die in every way and retry ten times in a row at
one checkpoint (does anything pile up: bodies, sounds, lights, frame
time?); reload mid-beat; resize the window; alt-tab (lose the pointer
lock) mid-contest. The old hunters are in `tools/hunts/`.
Fix bugs (a wrong rule, a missing guard); a design problem goes in your
report with the chapter and the steps, most felt first.

## 4. Fairness, measured across the game
A table in your report: for every contest in the game, idle (lost in how
many seconds, was the warning up), bad (fails before through), good
(time). Where a number is out of line with the chapters around it
(something trivially easy, something a clumsy bot cannot pass in five
tries), turn that chapter's own difficulty numbers (each lane's report
names its three) and say so.

## 5. Frame rate and memory
One quiet session, one Chrome: the heaviest moment of each chapter
against `shot=perf`; heap and draw calls at each chapter's start in a
play from the title (stages are built once and kept: does it decay?).
Cheap causes fixed; the rest listed with the cause.

## 6. The documents
`README.md` (how to play: the rulebook's keys, CHAPTERS, `?start=`),
`docs/story/STORY.md` (rewritten to the story as built in wave C: short),
`ARCHITECTURE.md` (a section 11: wave C as built, from the code and the
reports: the kit, the gun kit, the city, the changed stages and scenes,
the plays and proofs), `MUSIC.md` (every slot's cue and each chapter's
first-timer length). Remove what is dead only when nothing reads it
(the old Body's files, the river road if the city replaced it wholly):
list what you removed.

## Gate
Build; golden check; errors clean on every beat of every chapter;
`whole.json` twice; `whole_first.json`; `saves.json`; every lane's proofs
once. Report `docs/story/reports/wave-c/C10.md`: found / fixed / left,
the fairness table, the frame-rate table, the teach-card order, and what
the user should try first when he plays.

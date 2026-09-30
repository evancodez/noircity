# Wave A, the arcade pass — one owner, the fight

The user played the slice again on 2026-09-30: "it looks a lot better and
it plays a lot better", and the fight is "really slow and super, super
heavy", "it doesn't really look like your punches land", and it must feel
arcadey, smooth, fun, not stiff or scripted. His words are at the top of
`docs/story/FIGHT.md`, which is now **version 3** and is your design.
Read it twice. Build all of it.

You own the fight end to end and may edit any file under `src/` that the
fight needs, except `src/enemies/**`. Scene one (the diner before the
fight) and the street must keep working and looking as they do.

## What to build, in this order

1. **Speed and response** (FIGHT.md §2, §9). Retime every clip of mine
   and his to the tables. Inputs act on the step they arrive; buffer
   0.15 s. Measure it: a probe that logs, for each input, the steps from
   the input to the first moved frame and to contact.
2. **The guard and the openings** (§3). His guard has two sides, each up
   or down, driven by what he is doing. Blocked punches bounce off.
   The opening is shown by his body and a white tick. Counters, combos,
   the guard break.
3. **Blows hit places; a dodge is a step** (§4). Side-step and back-step
   as quick hops; his blows aimed at the end of the tell, with a reach and
   a path, resolved against where I stand at contact. No timing windows.
   Remove the arrow and the slow motion from everything but the lesson.
4. **Punches that land** (§5): the fist on him, hit stop, the burst, his
   reaction, the view, three different sounds, his health bar.
5. **The lesson** (§6), rewritten for the guard and the step.
6. **Things in hands** (§7): E takes what I look at; a stool or a chair
   comes apart on him; whatever leaves a hand falls and comes to rest.
   The bug the user saw: a stool hangs in the air after I hit him with
   it. Find every way a held or thrown thing can be left in the air
   (mine and his, after a hit, a miss, a block, a knock-down, a retry, the
   finish) and close them all.
7. **Tuning by play**: autoplay at a human's pace (reaction time 0.22 s,
   imperfect: it reads four tells in five) wins in 60 to 100 s over ten
   seeds; a player who only mashes both buttons does not win; a player
   who never dodges loses.

## How you are judged

- By how it plays. After each of the seven items, play it: the scripted
  play by real input and the autoplay, muted, and watch the film strips
  at 30 frames a second of: a jab landing, a jab blocked, a hard punch
  landing, a counter, a three-hit combo, each of his attacks missed by a
  step and landed, the guard break, a stool coming apart on him.
- By the numbers in FIGHT.md: measure startup and recovery in steps, hop
  distance and time, the fight's length, frames per second.
- Every run muted. Clean up after yourself: no stray processes, no temp
  folders.

## Gate
`npm run build`; `tools/errors.sh` clean on `street`, `hoods`,
`battle&t=30`, `title`, every scene beat; `node tools/playtest.mjs`, the
slice, autoplay and continue plays pass, updated for the new controls;
frames per second on `scene=fight&beat=round1&anim=1` no lower than
before. Commit on your branch; do not push, do not merge.

## Report
Per item: what you built, the measurements, the strips, and your own
honest account of how it feels to play and what is still stiff.

# C7 — Pier Nine: the cold player's report

Played on `wave-c/C7-pier` at `92b6f90` (the owner's last commit), dev
server on 5347, muted, 1440 x 900, by real input with `tools/play.mjs`.
My plays are in `tools/plays/critic/c7_*.json`; frames in
`docs/story/review/wave-c/C7/critic/`. I played before reading
`C7.md`; what I add to its Left list is marked **new**.

Judged by WAVE_C §1: can I lose, can I win, do I know how.

## What I played

| play | what | result |
| --- | --- | --- |
| `c7_cold` | `?start=warehouse` from the title, hands off by the coupe for 120 s; LMB | "Empty." at once (good); nothing finds me outside (no contest out there: fine) |
| `c7_enter_idle` | walk to the lit side door, E, one step in, hands off; then into the door's pool | found in the dark by Sully's round **31.7 s** in, "They've seen me." **2.6 s** before the cosh, "They caught you.", back at the door; in the pool warned in 1.0 s, caught in 2.6 s |
| `c7_first_frame` | eye level just inside the door, looking north; crouched; in the pool | frame 02; the hands are dark in the dark and white in the pool (reads well) |
| `c7_naive` | a first-timer with no oracle: crouched, straight up the west wall to the stairs | caught twice (by Sully at -12.5,-8.6; by Sully again at the stairs' foot) - creeping blind does not win (good) |
| `c7_hunter` | the owner's `hunter` driver, my checks | **FAILS**: 4 of 6 men down, then **35 catches in 532 s**, all at the `stairs` beat, never reaches the window |
| `pier_office` (owner's, my out dir) | the window, the order, the office | 9/9; the order done at 16.7 s, the office beat at 69.4 s (**53 s of waiting**) |
| `c7_loud_idle` | loud pass: hands off on the catwalk; then W held down the west stairs and across the lit floor | catwalk: the flank line at 21.6 s, then "They caught you." at 24.7 s; floor: "Flanked." about 21 s after leaving the catwalk |
| `c7_loud_good` | the owner's `loud` driver twice, my checks | wins twice: **125 s** (1 fall, 21 shots, **1 man down**), **82 s** (1 fall, 9 shots) |
| `c7_fight` (first version) | the foreman, hands off | "One more and you're down." at 12.3 s; **9 downs in 124 s and the fight never ends** (me 24 hp, him 146) |
| `c7_fight` | the play tool's first-timer fist hands, then the bay door, the pier, the coupe | won in **85 s**, 1 down; E at the bay door; "The diner."; VIII entered |
| `c7_edges` | walk off the pier west, south, east, into the coupe | stopped at x -23.6, z 27.5 (the gate), x 23.6 (fences); the coupe is solid |
| `c7_seam` | `?start=tail.pier`, car put in the painted bay by eval (lane C3's drive is not mine to judge), E | a cut, VII's card small, no black |

(`c7_fight_idle.json` is the hands-off half split out after the run; the run
itself was the first version of `c7_fight.json`.)

## Findings, most felt first

### 1. BLOCKER — The first frame does not show the goal (ask 1)
Steps: `?start=warehouse`, Begin. Frame 01: the shed's flank, PIER 9, the
side door's lamp, my coupe, the freighter. No lit office, no mezzanine.
Walk in by the side door and look north (frame 02): aisle A, Sully and his
lantern, the stacks. The office is still not in sight. The objective says
"Get to the office" and nothing on the screen says where the office is. A
first-timer walks up an aisle hoping. (The owner's Left 2 says the same.)
The brief asked for the warm window across the black shed in the first
frame, with a wide shape moving on its blind.
Fix: start the chapter **inside** the side door (or in the door with it
open), facing a line of sight to the office window: move a crate tier or
open a gap in the stacks so the window is seen down an aisle. The window
should be the warmest thing in the frame, with the Cardinal's shape on the
blind. Files: `src/stages/pier9/site.js` (`start`, `blocks`),
`08_warehouse.js` `setupAt('arrive')`.

### 2. BLOCKER — "Take every man out" is not shown to work (ask 3)
Steps: `node tools/play.mjs tools/plays/critic/c7_hunter.json`. The
owner's driver put down Sully, Rusty, Bert and hood1 (hood1 near the
stairs lamp, at about -3,-38). Then it went into a loop at the `stairs`
checkpoint: back at (-8.0,-33.1), the strip's Hood (hood2, torch) has it
about 10 s later every time, at -3.3,-36 (the stairs lamp's pool, the only
way to the west stairs' foot). That is 35 catches in 532 s, with no way
found. The owner's two runs also fail (C7.md Left 1), at a different man.
So in three runs of the "every man down" way, none reached the office.
I do not know that a human cannot. But nothing shows that one can, and the
stairs' foot is a choke under a lamp, watched by a torch. A body left near
it (hood1) also brings the men there (the snapshot keeps `found`). What a
player would feel: after taking four men, he is caught at the same spot
over and over, about every 12 s, with the same "They caught you.".
Fix, all three:
(a) Script a hunter route that takes all six (as `pier_ghost` scripts the
ghost) and run it twice on the final code.
(b) Give the stairs a second approach that a player who took the Hoods'
partner can use: the dark lane behind the stores to the west stairs' top
side, or the brief's ladder to the stack tops. Or keep hood2's sweep off
the stairs lamp's pool for part of his round.
(c) After two catches at the same checkpoint, show the bottle card again
(`hud.teach.again`): the bottle is the tool for that strip.
Files: `src/scenes/warehouse/crew.js` (hood2's route), `site.js` (`blocks`,
`notches`), `08_warehouse.js` (cards around line 830).

### 3. BLOCKER — No lantern to use, no ladder or stack tops (ask 2)
Steps: walk the floor. The bottle ("bottle", then "hold LMB throw"), the
switch ("pull the switch") and the hoist ("let the load go") answer E.
**No lantern answers anything**: there is no `I.add` for one in
`08_warehouse.js` (around lines 420-480). The brief's third way across,
along the stack tops by a ladder, is not built. The owner knows this
(Left 3). The ask lists four tools: one is missing, and one of the three
ways across is missing.
Fix: one lantern hanging on a post on a route (aisle C near the hoist).
E puts it out, its pool goes black, and a man comes to relight it (the
switch's pattern). If the stack tops will not be built, write the cut in
the brief and the report.

### 4. MAJOR — The loud pass is a run for the bay; the men vanish when I get there (ask 6)
Steps: `tools/plays/critic/c7_loud_good.json`. Both wins dropped **one**
man between them (21 shots in the first, 9 in the second). The rest were
alive and hunting when I reached the bay. `08_warehouse.js:1010-1011`
(`if (K.active) K.end(); for (const h of [...G.world.hoods.list])
G.removeHood(h);`) removes every gunman the moment `atBay` is true (line
915). A man in sight behind me pops out of the world. The fight to the
door counts for nothing: getting there is the whole of it. The ask's "the
pin from the catwalk" is not built (no Tommy gunner up there; owner's
Left 4). That leaves the floor as a walk past two torches and two Hoods.
Fix:
(a) At the bay, end the kit's encounter only for men out of sight. Men in
sight follow to the bay mouth, or the bay door stays shut ("Locked.") until
the gunmen in the bay's mouth are down or have lost me.
(b) Build the catwalk gunner on the east catwalk over the bay: one man,
the gun kit's tell, who covers the last 10 m to the bay. The rails stop
rounds, so it is a pin, not a wall.

### 5. MAJOR — 53 seconds of waiting under the window (ask 5's beat)
Steps: `pier_office.json` with `?start=warehouse.listen`. The three lines
are done 12 s in ("No one walks out." on screen, frame not kept). Then the
objective "Stay down. Listen." stays up for another **53 s**: his look, the
blind shut, "Let's go. Lock up.", his man walking the catwalk to the far
gate and back, the back door. Through all of it the player must stay
crouched and do nothing. Frame 04 is that wait: an empty lit blind. Nothing
says how long to wait or that the room will open. A player who gets up
early at the wrong moment is caught (the look, `08_warehouse.js:665-676`,
or the lock-up man, `spotted()`). The rules there are fair. The length is
not.
Fix: cut the lock-up walk to the gate (chain the gate before I arrive, or
have the man lock it while the Cardinal speaks). Change the line to "Wait
for them to go." as soon as the order is done. Keep the wait under 20 s.

### 6. MAJOR — After a loud-pass fail I come back staring at a wall
Steps: `?start=warehouse.loud`, or get caught in the loud pass. Frame 05:
the checkpoint's view is the office's planked wall at arm's length, in the
dark, with the revolver. You cannot see the catwalk, the stairs or the
floor, and that is where you must go. Every retry of the loud pass starts
like this.
Fix: the `loud` setup pose faces west along the catwalk toward the west
stairs (pitch slightly down, so the stairs' lamp and the floor are in the
frame). File: `08_warehouse.js` (the `loud` start in `setupAt`).

### 7. MAJOR — The loud pass's warning and its fail disagree
Steps: `c7_loud_idle.json` part 1, hands off on the catwalk. 21.6 s in,
the warning line is **"One's going round on your left."** (the gun kit's
flank line). The answerer went loud on the floor while he climbed to me.
At 24.7 s the black says **"They caught you."**: the cosh from the man on
the catwalk, who keeps the crew's rule (`loud.js:110`, `if (m.upLvl)
continue;`). The warning was about a flanker; I lost to a man walking up
behind me. And I was coshed while holding a full revolver.
Fix: when the answerer is up and sure of me, warn with "They've seen me."
(or "Behind you." when he is behind), not the kit's flank line. Better:
make him a gun-kit man too once he is sure, so a man with a loaded gun is
shot at, not coshed.

### 8. MAJOR — The foreman falls in 85 s; the ask is two to three minutes, harder than Mack (ask 7)
Steps: `c7_fight.json`. With the play tool's first-timer hands (reaction
time, a wrong read now and then) it was won in **85 s** with 1 down
(rounds 28.9 / 33.9 / 16.1 s, 25 dodges, 21 blocks). The owner's proofs
were faster still: 64 s, 62.9 s, 72.2 s. The fight plays well (the hook's
tell reads; the dodge cue; he goes through the planks), but it is about
half the length asked.
Fix: raise his 146 hp (`warehouse/fight.js:84` `FOREMAN`) toward 200, or
give the hook manner a little more of the mix. Measure good hands at
120-180 s. Measure Mack with the same hands and put both numbers in the
report so "harder than Mack" is a measured claim.

### 9. MINOR — Caught at the stairs, sent back two beats
Steps: `c7_naive.json`. Caught at the stairs' foot (beat `stairs`), I came
back at the `lamps` notch (-7.6,-17.4), about 20 m and two crossings back.
The `stairs` checkpoint was never taken because a man was curious when I
got there (`cp()` waits for calm, `08_warehouse.js:801-807`). For a
first-timer, that is more than "a few seconds lost".
Fix: when a pending checkpoint has waited more than about 5 s, take it at
the next moment no man has a line on me, instead of waiting for full calm.

### 10. MINOR — The cut from VI changes the place
Steps: `c7_seam.json`. Frame 06 against VI's last frame: VI's pier has the
el's iron arches, a street lamp and low sheds. VII's has the PIER 9 shed,
a freighter and no el, and my coupe has moved 6 m to my right. The card is
small and there is no black (good: the user's ask), but the world jumps.
Fix (with lane C3): match VII's `start` pose and car to where VI parks me
(the side door to my left, the car behind me). Or add VII's freighter and
shed silhouette to VI's pier end.

### 11. MINOR — The fist fight never ends if you put the controls down
Steps: the first version of `c7_fight.json`. Hands off: "One more and
you're down.", down, black with the reason, up, 9 times in 124 s. He never
wins and the fight never ends. This is the brawl's own rule (FIGHT.md §8,
lane C4), not this lane's. Idle does lose every exchange, with warnings,
so it is not a self-win. Noted only because the user will try it.

### 12. MINOR — The tools are taught by prompt only
The bottle, the switch and the hoist each show an E prompt, but no teach
card says what they **do** to the men. The switch darkens aisle B and its
man comes to fix it with his back to the floor: that is the hunter's key,
and nothing tells the player. Fix: one teach card the first time the switch
is in reach, saying what it does to aisle B's lamps.

## Cheats read in the code

- `08_warehouse.js:1010-1011`: reaching the bay removes every live gunman
  (`K.end()`, `G.removeHood`). This wins the loud pass's fight for the
  player the moment he steps into the bay. No man is down, nothing is
  seen. (Finding 4.)
- `08_warehouse.js:196, 979`: `dmgK: 0.8` (their rounds do 80 %). It is
  written down, small, and does not decide the contest. Allowed.
- `warehouse/crew.js:41`: `lostAlarm: 3.2` (they lose me after 3.2 s out of
  every man's sight) with `coshMin: 1.4`. A chase I can break. It is the
  stated rule and is fair (I was caught every time I stood still).
- `loud.js:110`: a man up on the catwalk when they go loud keeps the
  crew's cosh rule rather than a gun. That is a loss without the right
  tell. (Finding 7.)
- Nothing found that misses on purpose, and no timer that ends a contest
  in my favour. The fist fight's mercy is lane C4's written rule.

## The user's asks, as I saw them in play

1. **Not met.** The objective line is there from the first frame; LMB gives
   "Empty." at once. But the lit office is in neither the first frame
   (outside) nor the frame inside the door. (Finding 1.)
2. **Partly.** Light and dark read: the hands are white in a pool and grey
   in the dark, and I was found in a pool in 2.6 s. The lantern is the
   man's light. Creep is taught by its card at the door. E from behind
   works (my hunter run put 4 men down by E; I did not keep a frame of the
   takedown card). Bottle, switch and hoist work. **No
   lantern to use** (Finding 3). Running being heard was not tested
   separately by me.
3. **Not proven.** Touching no one works (owner's `pier_ghost`, a scripted
   route). Taking every man out failed in my run (35 catches at the stairs)
   and in both of the owner's. (Finding 2.)
4. **Met.** Idle in a pool: caught in 2.6 s, warned 1.0 s before. Idle in
   the dark: found by the round in 31.7 s, warned 2.6 s. The cosh, black,
   "They caught you.", back in about 1.3 s. Except that a catch at the stairs
   can send me two beats back (Finding 9).
5. **Mostly.** The still (`NOT HIS GIRL. HIS NEXT.`, the red cross) is
   strong. The order is three subtitles. The drawer, then the shells fill
   the revolver. The Cardinal's car is only heard leaving, not seen. The
   wait is 53 s too long (Finding 5).
6. **Partly.** The loud pass happens: the revolver is full, they hunt with
   torches and pistols, and men flank ("Flanked." killed my W-holder in
   about 21 s on the floor). But there is no catwalk pin; it is won by
   running to the bay; the men vanish there; and the retry faces a wall
   (Findings 4, 6, 7). Lamp shot-out not played by me (owner's `pier_dark`).
7. **Partly.** He steps out with the hook (in the fight 3.1 s after the
   beat starts), the gun is gone (`weapons.active` null), the dodge cue is
   on his swings, and he goes through the planks. Too short: 85 s against
   2-3 min (Finding 8). I did not see the moment the hook takes the
   revolver.
8. **Met where I walked.** Fences at x ±23.6 and the gate at z 27.5 stop
   me; the coupe is solid; nobody passed through anything in my frames.
   I did not do the full walk of every aisle and ladder (time box).
9. **Mostly.** VII starts on a cut under the small card with no black, and
   ends at the coupe with "The diner." and VIII. The place itself jumps
   across the cut (Finding 10). Golden frames not run by me.

## The owner's report, read last: what a player would feel

- Left 1 (hunter fails) and Left 2 (first frame): felt, and confirmed here
  (Findings 2 and 1). The stairs loop I saw is a second place the hunter
  way breaks, not only aisle B.
- Left 3 (no ladder, no lantern): felt by anyone who reads the
  brief's promise; the ask lists the lantern.
- Left 4 ("the loud pass may be easy for a good player"): it is easy for
  any player, because reaching the bay ends it (Finding 4). **new**: the
  vanish at the bay.
- Left 5 (the swap is a pop): a hunter who becomes a gun-kit man where he
  stands. I did not catch it on a frame; the user will, at close range.
- Left 7 (the listen beat): the owner says the lock-up adds 25 s; I measured
  **53 s** from the last line to the office (Finding 5).
- Left 9 (card over the warning): not seen in my frames.
- **new**: the loud retry facing a wall (6), the warning that does not match
  the cosh (7), the fight's length (8), the checkpoint that waits for calm
  (9), the seam (10).

## What is good and must not be broken

- The rules of being seen read on the screen: the hands go white in a pool;
  a man's lantern throws its own pool ahead of him; idle in a pool is
  caught in seconds; idle in the dark is found by the round in about 30 s.
  Always "They've seen me." 1-2.6 s first, then the cosh and "They caught
  you.". Keep `crew.js`'s TUNE.
- Blind creeping does not win: the stealth is a real contest.
- "Empty." on the first LMB, at once.
- The window: the Cardinal's shape and his cigar's ember through the blind,
  three short lines. The photograph still with the red cross is the best
  frame of the chapter.
- The office objects behave: the door opens, the drawer slides, the shells
  fill the gun.
- The loud pass can be lost (on the floor in the light: "Flanked.") and
  won at a human pace, twice.
- The foreman: the hook, the cue, the fall through the planks, the bay door
  with E, the walk along the pier in the rain, the coupe, "The diner.",
  straight into VIII. No errors in #errlog in any of my eleven runs.
- The pier's edges stop me at a chain-link fence (seen on the west side;
  the east stop is at the same distance, its fence not framed) and the
  gate; the coupe is solid.

# G3 — IV The Watcher: two minutes on foot, every vault and slide answering the hand

Branch `game-two/G3-chase`, port 5363. Chapter IV of game two is wave
C's V (`src/scenes/06_watcher.js`, `scenes/watcher/*`, the course
`src/stages/backlot/` (plan.js STRETCHES / NODES / WAYS, things.js), the
run mode `src/player/modes/run.js`; reports `C6.md` and its `Left`).
Lane C6b began the two stretches the first lane did not build (the dance
hall's back or its coal yard, the boiler room, the el's deck with the
train) and died at the weekly limit with them "grey but whole" on branch
`wave-c/C6b-chase` (two commits; its brief `docs/story/briefs/C6B_CHASE_MORE.md`).
**Before you build: `git merge wave-c/C6b-chase` into your branch,
resolve, build, play it; it is yours to finish.** The user's words:

- **[must]** "the chase sections": "way smoother", "more fun", "easy to
  grasp".
- Still binding from wave C: no automatic vaults (SPACE or I hit it);
  slides (C); losable on several misses or when he gets too far ahead,
  never on one; longer, more interactive, more cinematic (two minutes);
  no fade into the car.

## 1. Feel (GAME_TWO §1 A)
1. **The press is the move.** SPACE to the first frame of the vault, C to
   the slide, under 50 ms. A press a little early is remembered for 0.3 s
   and taken at the thing (a buffered press is not an automatic vault:
   no press, no vault; a press too late is the hit). The hands reach and
   the eye dips with the body; the landing has weight and a sound; the
   run is not broken by a clean vault (no stall after it).
2. **Nothing locks me** beyond the vault's own 0.25 s; I steer through a
   slide; a hit on a thing costs speed and a stumble (0.3 s), not a
   stop, unless it is the fail.
3. **The eye**: the run's bob and the lean in a turn, eased; no pop at a
   checkpoint or a retry; he is always findable (his shape, his lamp,
   his sound) when the way bends.
4. **Sound**: my feet on each surface, my breath by the gap, his feet
   ahead, the band through the wall, the train.

## 2. The middle (GAME_TWO §1 B)
1. C6's clumsy hands lost 9 to 13 times a run: too many. The bar:
   `watcher_medium` through each stretch in one to three tries;
   `watcher_bad` by the fourth; `watcher_good` twice; `watcher_idle`
   loses at the first stretch, warned (`He's getting away.`).
2. The gap rule stays (several misses, or too far), but each stretch's
   retry puts me where I can see him go (C6 Left 3: the yard's wrong
   lane): from the retry he is in view and his way is lit.
3. Cards: `[SPACE] vault` held at the first fence, `[C] slide` held at
   the first pipe, nothing else; the nudge: a player who has hit the same
   kind of thing twice in a stretch gets that card again, once; a player
   who stops for 3 s gets the objective re-struck (`After him.`). The
   fail's black: `Too slow. SPACE at the fence.` or shorter.

## 3. More (lane C6b's stretches, finished)
The second building (the hall's corridor, the door he slams, the boiler
room's pipes, the coal chute) or the coal yard (the fence, the dog), and
the el's deck with the train: finish them as places (lit with one light
each, finished walls, people who flatten to the wall), with the beat
and the checkpoint each, the numbers each, and one moment in each where
he does something I must answer (he slams the door: SPACE to shoulder
it; the train: off the deck by the stair before it passes, or stopped
by it and seconds lost, never killed). A clean run of 115 to 130 s from
the iron to the car. Both forks visibly different.

## 4. Everything works (GAME_TWO §1 C)
The jank run through every stretch, new ones included: every wall,
fence, pipe, door, person, the train, the chute; a thing that looks
vaultable is vaultable, a thing that is not is seen to be not (height,
a wall); every door he goes through I can go through; nothing leaves me
stuck (an explore into a dead corner costs the gap, not the chapter).
No fade into the car: the chase runs into V as before.

## 5. Proofs and gate
`watcher_idle`, `watcher_bad`, `watcher_medium` (new), `watcher_good`
twice (both forks, both choices), `watcher_w` (C6b's), the jank run;
the latency numbers; the strips of a vault, a slide, the door, the train,
looked at; golden identical (the chase's own frames named if changed);
errors on every beat; fps on the el's deck with the train. The pad play
of the chase still passes. Report `docs/story/reports/game-two/G3.md`.
Hours, not a day.

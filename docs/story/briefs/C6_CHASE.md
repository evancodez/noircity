# C6 — chapter V The Watcher: the foot chase, rebuilt as a game

Branch `wave-c/C6-chase`, port 5346. You own `src/scenes/06_watcher.js` (to
be renumbered by lane C1: use the file as you find it) + `watcher/*`,
`src/stages/backlot/**`, `src/player/modes/run.js` and `escape.js`, the run
hands, the `watcher` cast kind.

Read `docs/story/WAVE_C.md` (all), `docs/story/seams/Z.md` (the kit),
`ARCHITECTURE.md` §10 (the backlot, the `run` mode), the old lane's report
`docs/story/reports/wave-b/B4.md`.

## What the user said
- **[must]** No automatic vaults. I press SPACE or I hit the thing.
  Perhaps slides under things too.
- **[must]** I can lose: not on one miss, but on several, or when he gets
  too far ahead.
- **[must]** Longer, more interactive, more cinematic: more of a game.
- **[must]** No fade into the drive. The chase runs straight into the car.

What was wrong: the run went by itself (7.5 m/s with no key held), fences
were vaulted for me, and he was kept 9 to 22 m ahead by a rule whatever I
did. A player could put the mouse down. None of that survives.

## 1. The rules of the run (taught once each, then used many times)
- **W runs.** Let go and I slow to a walk. A / D and the mouse steer.
- **SPACE** goes over: a fence, a crate, a bin, a low wall, a car's
  bonnet, a gap between roofs. It is timed, generously but really: pressed
  in the last metres before the thing, I go over clean and keep my speed
  (hands on the top rail, the lens over, the land); too early or not at
  all and I hit it: a stumble, the hands out, a second lost; a little late
  and I scramble over, half a second lost. The thing itself tells me:
  what can be vaulted is drawn the same way every time (a pale top edge
  catching the light), and what cannot be is plainly a wall.
- **C / Ctrl** goes under: a slide on the wet (a half-shut roller door, a
  truck's bed, a barrier, a low beam of the el's stair, washing poles),
  with the same timing rule.
- **Missing costs distance, not the chase.** Each miss lets him get
  further; several lose him.
- Teach cards (`hud.teach`, held for the very first vault and the first
  slide): `[SPACE] over`, `[C] under`. The first of each comes in a calm
  place where a miss costs little.

## 2. Him: a man running for it, not a carrot on a stick
- He runs his own race at his own speed with his own costs: he slows for
  his corners and his fences, he looks back, he slips once. Clean running
  on my side holds the gap or closes it a little; a miss opens it.
- **Losing**: when he is too far ahead or out of sight too long, first
  the warning ("He's getting away.": `hud.warn`, and the picture says it
  too: he is small and far), then "Lost him." (`game.fail`), back at the
  start of that stretch with the gap that stretch starts with. The
  thresholds are yours by play: a first-timer who misses two or three in
  a stretch should be in the warning; four or five, lost.
- **When I get close, he does something about it**, and what he does is a
  thing for me to answer, never a boost: he pulls a stack of crates down
  behind him (SPACE), kicks a bin into my path (A / D), slams a gate
  (shoulder it: SPACE, late is a bruise and a second), drags a market
  barrow across (C under its shafts), throws his umbrella. So being good
  makes the chase denser, not shorter, and he still reaches his car by his
  own legs. If the player is so good that he is on the man's heels at the
  cars, good: the car door slams in my face, and that is a better ending.
- He must always be findable: the pale raincoat in the dark, his shadow
  thrown ahead of him by lamps, what he knocked over still rocking, a
  door still swinging, a dog barking at where he went.

## 3. The course: longer, with choice, composed like a film
About ninety seconds to two minutes of running for a clean run (today it
is far shorter), in stretches that each have one idea, a checkpoint at
each, and at least two forks where I choose (the short way that asks more
of me, or the long way that is plain): the old stretches are yours to
keep, rebuild or cut. A shape to start from:
1. **The window and the iron.** He sees me see him, drops the umbrella,
   runs. Out under the sash, down the fire escape (the `escape` mode: make
   it mine to run, W and the mouse, the last ladder dropping under my
   weight; a short drop to the alley).
2. **The alley.** A straight to learn W; bins he topples (the first
   vault, taught).
3. **The fences and the yards.** Board fences to go over; one has a gap
   under it (the first slide, taught); the washing yard, where he is a
   shadow on a lit sheet and I pick the lane he took (wrong lane: a dead
   corner and seconds lost).
4. **Through a building.** A back door he slams; a kitchen or a boiler
   room or the back of a dance hall (one lamp, steam, people who flatten
   to the wall); out through a window or a loading door.
5. **Up and over.** A stair to the roofs, tar and skylights, the el's
   lights beyond; **the jump** across an alley's gap (SPACE at the edge;
   short of it I catch the far parapet with both hands and haul up: time
   lost, never a death); down a coal chute or a shed's roof (C: the
   slide).
   *Fork*: the roofs, or the alley under them (a dog on a chain, a
   delivery truck to slide under).
6. **The street.** Across a wet street with a car coming (over its bonnet,
   or wait and lose a second), through the market's shut stalls, and out
   at the kerb: his sedan pulling away, my coupe under its lamp.
It is one night in the rain in the same city as the rest: every stretch
is a composed frame (one light, what is black, where the eye goes: him).
Every edge is a real thing. People and animals get out of the way and
are solid.

## 4. [must] Straight into the car
At my coupe's door, **E**: the hand on the handle, the door, the eye
ducks in. No fade and no card on black: the cut to the city's stage
(lane C3's chapter VI) happens inside that movement, when the door frame
crosses the lens. Lane C3 builds the city's first street as a copy of
your last street and gives a way to warm its stage beforehand
(`docs/story/reports/wave-c/C3.md`, "for other lanes"; `game.stages.warm`
or the like): call it during the chase's last stretch so nothing hitches,
and fix the look of your last street early (facades, the lamp, the kerb,
both cars' places: write the numbers in `stages/backlot/plan.js` and in
your report) so C3 can copy it. If C3 is not merged when you finish, end
on `scenes.go('tail', { fade: 'cut', card: false, keep: true })` and say
so: lane C10 will check the seam.
The chapter's beginning is also a seam: chapter IV ends at the office
window on the man under the lamp (lane C5); yours begins on the same
frame (`seen`), and from CHAPTERS it begins there with the usual card.

## 5. Proofs and gate
WAVE_C §7. `watcher_idle` (hands off: he is gone and "Lost him." within
seconds, in every stretch); `watcher_w` (W held, nothing else: hits the
first thing and loses); `watcher_bad` (half the vaults missed: the
warning, a loss or two, through in the end); `watcher_good` (clean: to
the car twice in a row, by both forks). The jank run: into every wall,
fence, person and car at full speed and at a walk; stop anywhere; go back
the way I came (a real reason stops me, or I may, and he gets away).
Strips of every vault, slide, stumble, the jump and the catch: the hands
are on the thing, nothing floats. Report `docs/story/reports/wave-c/C6.md`.

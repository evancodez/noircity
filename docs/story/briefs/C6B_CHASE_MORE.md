# C6b — the foot chase to two minutes

Branch `wave-c/C6b-chase`, port 5346. Chapter V (lane C6, merged; report
`docs/story/reports/wave-c/C6.md`, the course in `src/stages/backlot/plan.js`
STRETCHES / STRETCH_ORDER / NODES / WAYS and `things.js`) is about 87 s of
clean running from the iron to the car stretch; the user asked for
"longer, more interactive, more cinematic", about two minutes. Add the
stretches the first lane did not build, keep everything else as it is.

## 1. Two new stretches (about 35 to 45 s together)
Between the press hall and the roofs, or between the roofs and Mercer
St, wherever the plan takes them best:
- **The second building**: the back of a dance hall or a boxing gym
  (the user's old boxing game: a nod, not a copy): a corridor with a
  band heard through a wall, a door he slams (SPACE to shoulder it), a
  stair down into a boiler room (steam, one lamp, pipes to slide under:
  C), out through a coal chute or a loading door. Two people who
  flatten to the wall. Solid, finished, lit with one light each.
- **The el**: the roofs end at the el's deck or its stair: a run along
  the deck's catwalk with the train coming (the lights, the horn: get
  off it by the stair before it passes, or be stopped by it and lose
  seconds: never killed), down the stair to the street. "The el's lights
  beyond" that the roofs lacked are now the place itself.
Each stretch is a beat and a checkpoint with its own idle/bad/good
numbers, one thing taught by use (nothing new: SPACE, C, W), and one
moment where he does something I must answer.

## 2. One more fork
Before the new stretches, a second choice that is visibly different
(the building, or the yard behind it with a fence to vault and a dog).

## 3. Proofs
`watcher_idle` (every stretch, the new ones included), `watcher_bad`
(through on the second or third try), `watcher_good` (both forks, both
choices, twice: a clean run of 115 to 130 s from the iron to the car),
the jank run through the new stretches (every wall, door, pipe, person,
the train), strips of the new vaults and slides looked at. Golden
identical; errors clean on every beat; fps at the new stretches against
perf. Append a "C6b" section to `docs/story/reports/wave-c/C6.md`.
Hours, not a day.

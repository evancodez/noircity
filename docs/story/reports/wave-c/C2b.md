# C2b: the gun kit after the user played it (handover)

Branch `wave-c/C2b-guns`, port 5342. Brief: `docs/story/briefs/C2B_GUNS_FIXES.md`.
The full section, with the numbers, is "C2b" at the end of `C2.md`; this
page is the short handover.

## What was wrong, what changed

1. **The dead blocked people.** A body became a circle in the stage's
   colliders 1.35 s after the fall (`Guns.stepBodies`, tag `corpse`). The
   player was stopped by it. The living were meant to ignore it:
   `Guns.resolveMan` set the corpse circles' radius to 0 while it resolved a
   man. But `Colliders.resolve` pushes to `c.r + r`, so a zero-radius corpse
   still pushed every living man 0.32 m off its centre. Every body was a
   post the men got shoved off and stuck on. **Now** the dead are in no
   colliders at all. `K.corpses` is a list of records
   `{ x, z, r, hood, ax, az, bx, bz }` (torso, head, feet), read from the
   bones every step. The gun mode lifts the eye by `GUN_MODE.overBody`
   (6.5 cm) times `K.overBody(x, z)` (0..1 along the body's length, eased in
   and out), with a soft cloth sound as the foot goes on. Rounds into bodies
   work as before (the Hood's hit volumes, never the circles). The nav grid
   and `Bodies.steer` never read the dead, and the doors' leaves stop only
   on the living.
2. **Men turned full circles.** The only yaw writer for a living man is
   `HoodAI.faceTo` (the short way, capped rate), so the spins were made of
   short-way turns that kept going the same way. A man turned away
   (~180 degrees) to walk a step back to his cover, or out to his spot, then
   turned to face me again. From facing away, either way is the short way,
   and he often went on round: 300 - 390 degrees in 2.5 s, measured in
   `back`, `aim` and `move`. Two more causes: (a) at a path's end, a man at
   full pace has a 0.4 m turning circle but must come within 0.3 m, so he
   can loop round the point; (b) the look-at twisted the chest 0.8 rad one
   way and then 0.8 rad the other in one frame as the target crossed his
   back. **Now**, for the kit's men only (`h.turnSafe`, set by `K.spawn`):
   - `faceTo` keeps a decaying sum of his recent turning (~1.5 s), and a
     turn of more than ~140 degrees goes back the way he came (it unwinds),
     keeping that way until it is done.
   - Near a path's end and off his line, he slows to 0.3 of his pace.
   - The look fades out for a target behind him.
   - Aiming he turns at 5.5 rad/s (was 7).
   The wave game's and the battle's men are untouched: they diverged the
   golden battle frames.
3. **The turn counter**: `Guns.stepSpin` gives `K.spin`
   (`{ sec, rev, turn, who, whoTurn }`) and an event `spin` for a sweep over
   300 degrees.

## Proofs

- `tools/plays/guns_dead.json`: three bodies (a doorway, the corridor),
  walked through by real input; a man walking his way through two; two men
  through a doorway with a body in it.
- `tools/plays/guns_spin.json`: every contest by the first-timer with the
  counter. Before: worst 2.5 s sweep 389 degrees, 6 `spin` events.
  After: 265 degrees, no `spin` event; worst second 269 degrees of turning.
- The gate (C2.md has it in full): build clean; golden 38/38 identical;
  errors clean on every beat; `guns_dead` 6/6, `guns_spin` 5/5,
  `guns_walk` 9/9, `guns_idle` PASS. `guns_bad` and `guns_good` each failed
  one run of two and passed the other (both were at the edge before this
  lane).
- `guns_walk` changed: "a body on the floor" is now stepped over, not walked
  round.

## Left

See the "C2b" section of `C2.md`. In short:
- the good / bad balance swings between runs, as before;
- there is no strafe clip, so a man still turns his back for a step to his
  cover (180 degrees out and back now, never on round);
- the turn rule is opt-in (`h.turnSafe`): only the kit's men have it.

---------------------------------------------------------------------------
## After the critic

The critic (`C2b_CRITIC.md`, on `85a5d77`) found ask 2 not met: `guns_spin`
failed (345 degrees in 2.5 s), four of six plays swept 300 - 385 degrees, and
the man at a doorway jamb whipped his body +115 / -170 / +80 degrees at every
step out and back. A door also shut through a body in its doorway.
`wave-c/integration` was merged in first (C5, C7: `gunman.js` 'rush' / 'open'
round a jamb, no conflict).

### Each finding, what was done, the play that shows it

1. **BLOCKER, men still turned full circles and whipped round at every step.**
   Two causes, two fixes, all for `h.turnSafe` men only (the kit's):
   - *The steps out and back no longer turn him.* `HoodAI.step(dt, fx, fz)`:
     a one-node step under 1.8 m with no door on it (`gunman.js` `stepOr`,
     used by `out`, `back` and the reload's way back to cover) is walked
     facing the target (me, `S.target`), sideways or backwards. The legs
     turn toward the step (`h.stepYaw`: the object up to ~70 degrees off his
     facing, the spine and chest turned back by the same amount, the walk
     clip run backwards when the step is behind him; eased, no pop; folded
     into his yaw if he dies mid-step). The pace eases in and out.
   - *No chain of short turns adds up to a circle.* `HoodAI.faceTo` keeps the
     last 2.5 s of his turning (unwrapped yaw) and never lets it sweep more
     than 4.6 rad (264 degrees) one way: a turn that would pass it waits
     (he holds his facing a moment) or goes the other way round if that
     fits. The old single-big-turn unwind stays.
   - So that a waiting turn can never shoot behind him: no round leaves more
     than ~50 degrees (0.9 rad) off his facing (`shoot()` holds it).
   - Plays: `guns_steps.json` (door + two_ways hands off, every man's yaw each
     frame): 36 steps out / back, the widest turn inside any one step **32
     degrees** (was 115 / 170), worst 2.5 s sweep 209, no `spin` event.
     `guns_step_obs.json` films the jamb man (frame 06): his yaw -94 / -92
     / -90 / -92 / -95 through out, back and hold.
   - The counter now runs at the end of `guns_idle`, `guns_bad` and
     `guns_good` too (the three expects of `guns_spin`). Worst 2.5 s sweep:
     idle **228**, bad **264**, clumsy (`guns_spin`) **242**, good **224 /
     264**; no `spin` event in any; worst second 268, worst one-second
     reversal 208.
2. **MAJOR, a door shut through a body.** `killhouse/door.js` `blocked()`
   returns `'body'` when the leaf would cut a body's length (head to feet,
   `K.corpses`, segment to segment, 0.12 m): the leaf stops ajar against him
   with a small jolt and a soft knock (`c2_doorShut` at 0.35). A man pushing
   a door open onto a body is stopped the same way. `guns_body_door.json`:
   E on A1 with a body across its threshold, `open01` stays 0.74 (was 1 ->
   0); frame 05.
3. **MINOR, the pace flickered 0.45 / 1.5 m/s.** `HoodAI.follow` eases the
   pace toward its target (8 /s) instead of switching it, and the steps
   (`step`) have their own eased pace. In `guns_steps` 11 frames of 1349 in
   out / back still change the pace by more than 0.5 m/s in one frame:
   arrivals (a stop is a stop), not the flicker.
4. **MINOR, the step over a body only in the gun mode.** `Controller.update`
   (walk mode, marked `[C2b]`) lifts the eye by the same 6.5 cm with the
   cloth sound; the gun mode reads `K.overBody` whether an encounter is
   active or not. The body records outlive the encounter: `end()` keeps them
   (and files the ones still falling), the next `begin()` keeps those still
   lying in the stage. `guns_body_walk.json`: in the walk mode on his legs,
   `_overBody` 1.0 (was 0).

### The gate, on the final code

- Build clean. `golden.py check`: **38/38 IDENTICAL**.
- `errors.sh`: clean on `scene=guns&beat=` ready, door, two_ways, pin, rush,
  street, street_rev, done, lab, and `start=guns`.
- Proofs: `guns_idle` PASS (6/6 lost, each warned 2.9 - 8.1 s before, each
  with its reason). `guns_bad` PASS (lost 4 of 6, won two_ways and rush,
  every loss warned). `guns_spin` (clumsy) door, two_ways, pin lost once
  then won on the second try; rush and street won first; street_rev lost
  both its tries in that run (Flanked., warned 6.1 and 2.0 s before) - run
  again alone with three tries it won on the first. `guns_good` **6/6 on the
  first try twice in a row**.
- `guns_dead` 6/6 (its check of the second man through the doorway now asks
  him past -2.4, not -2.6: he stops 0.65 m behind the first, parked; the
  merged integration put him at -2.55 *with or without* this lane's changes,
  measured), `guns_body_door` 2/2, `guns_body_walk` PASS, `guns_steps` 4/4.
- The jank walk `guns_walk` 9/9.
- fps (`UNCAPPED=1 tools/fps.mjs` 1440x900, back to back): the street
  (`scene=guns&beat=street&t=8&anim=1`) 82.6 against `shot=perf` 48.2:
  **1.71 x perf** (the GPU 72 - 84 % busy with other processes: only the
  ratio counts).

### Frames (`docs/story/review/wave-c/C2b/`)

- `05_door_stops_on_the_body.jpg`: E on A1 with a body across it - the leaf
  stopped against his shoulder.
- `06_strip_step_facing_no_whip.jpg`: the jamb man's out / back / hold, his
  yaw on each panel.

### Left

- **The battle's men (chapter VIII, C8's lane) and the wave game's still
  turn the old way**: everything here is behind `h.turnSafe`, which only
  `K.spawn` sets. If VIII's men are kit men they have it; if they are the
  battle's own, the user will meet the old spins there.
- **The office's doors (`src/stages/office/build/door.js`, C5's lane) do not
  stop on bodies**: only the kill house's door does. GUNS.md says how
  (`K.corpses`, the segment test in `killhouse/door.js` `segDist`).
- A door stopped by a body stays ajar; a man who wants through it gives up
  after his tries (the door's `until`) and goes another way. Not seen to
  stick anyone in the test bed's beats, but no beat leaves a body in a
  doorway a man then has to push open.
- The step is the walk clip turned and run backwards; there is no strafe
  clip. Seen from above it reads as a shuffle sideways; up close a pure
  sideways step still slides about 20 degrees (the legs turn at most ~70).
- A turn that would pass 264 degrees in 2.5 s waits: a man whom I run round
  very close may hold his facing for up to a second and a half before he
  comes round (he cannot fire meanwhile: the 50 degree rule).
- The clumsy profile's street_rev is at the edge: one run lost both tries,
  the next won on the first.

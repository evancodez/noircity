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

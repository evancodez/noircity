# C2b — the gun kit after the user played it: the dead do not block, and no man spins

Branch `wave-c/C2b-guns`, port 5342. The kit is merged (`src/guns/*`,
`src/enemies/brains/gunman.js`, `src/guns/deaths.js`, `docs/story/seams/GUNS.md`,
the test bed `?start=guns`). The user played the test bed and found two
things. Fix exactly these, prove them, stop. Lanes C5, C7 and C8 build on
the kit right now, so change the kit's behaviour, not its API.

His words: "the bodies being physical objects means you can't walk over
them as a player, so you can be blocked, and enemies get stuck on them.
Might be easiest to just have enemies and the player not collide with
dead enemies (but other things do). Additionally enemies, while alive,
seem to do a lot of body / full 360s kind of randomly, which is weird."

## 1. The dead block nobody
- The player walks through a body (over it: at most a small step of the
  eye, 5 to 8 cm, as the foot goes over, so it is felt and not solid).
- A living man walks through a body too: never steers round it, never
  waits at it, never paths round it, never has his line blocked by it.
  Check every place the kit or the nav reads bodies: `Bodies.js` (tag
  `corpse`), `Guns.js` (the living kept out of the corpses), `Covers.js`,
  `Nav.js` / the nav grid (if a slumped body ever becomes an obstacle
  cell), `Controller.keepOff`, and the stage colliders a slump may add.
- A body still rests on the world: it slumps against the wall, over the
  cover, in the doorway, and stays there; rounds still stop in it or not
  as they do now; it is still a shape the player sees and steps over.
- Prove it: a play where I walk straight through three bodies in a
  doorway and a corridor with no slowing beyond the step; a play where a
  man walks his path through two bodies lying on it and does not slow,
  stop or go round (`G.counters` or a trace of his speed), and one where
  a body lies in a doorway the men must come through.

## 2. No man spins
Find why a living gunman turns a full circle (or several) for no reason.
Capture strips of men in every state of the test bed (hold, out, back,
move, flank, open, the door pair, the rusher's walk, the Tommy gunner's
drum change, the hit stagger) and look for the turn; then read the code
for a yaw that is set across the ±π seam without the shortest-way rule
(`HoodAnim`'s facing, `h.lookAt`, `h.setAim`, `B.follow`'s path turning,
the brain's own `face` calls, the `steady` fix the cast has for exactly
this), and for a target that flips (a look point behind him, a cover
point on the other side of him, a path whose first node is at his back).
A man turns the short way, at a man's turning speed (about 360 degrees a
second at most on his feet, slower while aiming), never twice. Prove it
with a counter: the sum of |Δyaw| per man per second, logged in a play
across all beats, never above about 2π in any second, and no second with
a reversal of more than 270 degrees; and strips you have looked at.

## 3. Gate
Build; golden check identical; errors clean on every beat of the test
bed; `guns_idle`, `guns_bad`, `guns_good` once each (the balance must not
move); the two new proofs. Append a "C2b" section to
`docs/story/reports/wave-c/C2.md` and a line to `GUNS.md` ("the dead block
nobody"). Hours, not a day: the user is waiting.

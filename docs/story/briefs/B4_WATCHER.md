# B4 — Scene 6, The Watcher (`watcher`): the chase on foot

Read `docs/story/WAVE_B.md` first: it is the standard and the way of
working. This scene is yours end to end. Branch `wave-b/B4-watcher`, dev
port 5314. Music slot `chase` (cue it the moment he runs).

## The places
- **First beat in lane B2's office** (stage `office`; it may not exist in
  your worktree: build and test from your second beat, write the first
  against the anchors `office.window.street`, `office.street.watcher`,
  `office.window.escape`, and guard it so the scene still starts without
  them).
- **A new stage, `backlot`**: the fire escape down the back of the Harbor
  Building and the run behind it, about 170 m of alleys and yards in five
  stretches, each ending in a turn so the view changes. Brick and board,
  fire escapes criss-crossing overhead, a few lit windows high up, wall
  lamps with their cones in the rain and black between them, puddles,
  steam from a vent, one blue neon (accent) far off at the end of the
  longest sight line. It ends on a street with two parked cars.

## The man
Cast kind `watcher` (yours): tall and narrow, a bowler, a long raincoat,
an umbrella. His run is the animation of this scene: long strides, the
coat's tails out behind him, one hand on the bowler, a look back over his
shoulder twice, a skid on the wet at a corner, a hand on a fence as he
goes over. It must read as a running man in ink at 25 m (look at strips
of it before anything else in the scene is polished).

## The beats
1. `seen` (office) — At the street window **E**: two of my fingers part
   the blind's slats. Through the gap, across the street, under the lamp
   and under an umbrella, a man looking up at this window. Held a second
   and a half, he sees me see him: the umbrella tips, drops, rolls; he
   runs. One prompt: **E the fire escape**. I go out of the side window
   (the eye eases through it; cut on black only if the ease cannot be
   made good).
2. `escape` — Third floor, iron and rain. I run down the fire escape's
   stairs (fast: two flights, the landings ring), the last ladder slides
   down under my weight. Below, he crosses the alley's mouth: the goal is
   always in sight at the start of a stretch.
3. `run` — the chase. W runs (in this scene the run is the default, 7.5
   m/s; no key to hold), the lens opens a few degrees at speed, my breath,
   my feet in the water, my arms pumping at the bottom corners of the
   frame. The stretches:
   - **the straight**: bins and puddles, he is fifteen metres ahead.
   - **the fences**: two board fences. **SPACE vaults**: both hands plant
     on the top (object first), the eye arcs over and lands with a dip,
     0.45 s, no speed lost. The window is generous (within 2.2 m, moving
     at it; SPACE held early counts). Without it I hit the fence and
     scramble over in 1.1 s. He vaults them too.
   - **the washing**: a yard strung with wet sheets. He vanishes among
     them; I run through them (they swing aside and close behind), and
     catch him as a shadow on a back-lit sheet.
   - **the dog and the crates**: a narrow passage; a dog hits a gate
     beside me (the gate jumps, the bark, my view flinches); he drags
     crates and bins down behind him as he goes. **A / D** round them or
     **SPACE** over them; hitting one is a stumble (a second lost), not a
     stop.
   - **the dead end**: a wall. He is gone. It is not quite dead: a board
     in the fence still swinging, or a cellar hatch banging shut, wet
     prints to it. Through it, the street.
4. `car` — He is in his sedan, the lamps come on, it pulls away: red tail
   lamps (crew) going down the wet street (your own rail). Mine is at the
   kerb. **E drive**: my hand on the door, `ctx.next()`.

## The rules under it
- He is never caught on foot and rarely lost: his speed follows mine to
  stay nine to twenty-two metres ahead (a burst if I close to five). More
  than thirty metres behind, or six seconds out of sight: "Lost him."
  Black, back at the start of that stretch. A first-timer who runs and
  presses SPACE at fences makes it; one who stops to look around does not.
- Teach SPACE at the first fence with one prompt; A / D needs none.
- The run is a controller mode of your own (`src/player/modes/run.js`,
  built on `walkStep`). Steering is the mouse, as walking.
- Nothing he knocks down may fall through the ground, hang in the air, or
  block the way completely.
- The whole scene is sixty to ninety seconds of play.

## Play and proof
`tools/plays/watcher.json` (`?start=watcher.escape` until the office
exists, then from `seen`) by real input. Strips: his run cycle side on and
from behind, a vault (mine), a vault (his), the sheets, the crates coming
down, the car pulling away. Frames: the slat gap with him under the lamp,
the fire escape looking down, each stretch, the tail lamps.

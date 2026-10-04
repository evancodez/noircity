# NOIR EXTREME

A short first-person noir detective story, one rainy night in 1937, in a
city rendered in real time to look like a hand-inked black-and-white noir
illustration. Colour is an accent: blood, fire, an ember, a flame, scotch,
neon, the crew's red. Built with Three.js and Vite; every texture, model,
sound and effect is generated procedurally at startup (no art assets; the
music slots wait for the user's jazz in `public/music/`).

The target look is `reference/noir_reference.png`; progress frames per
milestone live in `docs/progress/`.

## Run

```bash
npm install
npm run dev          # NOIR_PORT=<port> npm run dev for another port (default 5173)
```

Open http://127.0.0.1:5173 and click. The game takes the mouse (pointer
lock); Esc gives it back and pauses (click to resume).

**A PS5 controller** (any standard gamepad) plays it all, the title and the
pause card too: press a button on it (the browser shows a pad only after one)
and the cards draw its buttons instead of the keys. The d-pad or the left
stick moves the ink bracket on a menu, **✕** chooses, **○** or **options**
goes back; a pad needs no click (it holds the game without the mouse), but
the browser lets the sound in only after one click or key. The pause card
has the stick's speed and the rumble.

## How to play

One rainy night in 1937: eight chapters, from a stool at a diner's counter to
the Cardinal's hat in the wet street. You are only ever seen as hands and
sleeves. Very little is said; what can be used shows itself in the light,
and a prompt low in the frame names the key (E) when you are looking at it.
A line top left says what you are doing now; a card with the key on it
teaches a move the first time you need it. A loss is warned before it comes,
then black, a word on why, and back at the start of the beat or a checkpoint.

**The title.**

- **BEGIN** starts the story: a few comic panels (a click, E or SPACE moves
  on; ESC twice skips them), then chapter I.
- **CONTINUE** is there when a checkpoint exists (saved in the browser at the
  start of each chapter and of its main beats).
- **CHAPTERS** is the table of contents: a row starts that chapter, carrying
  what the story has given by then (the matchbook, Ames's card, the check,
  the revolver). Starting a chapter replaces the saved checkpoint.
- **`?start=<chapter>[.<beat>]`** on the address starts BEGIN anywhere, for
  example `/?start=warehouse` or `/?start=warehouse.fight`. The chapters
  (wave C: The Body is cut): `diner` I, `fight` II, `office` III, `gunfight`
  IV, `watcher` V, `tail` VI, `warehouse` VII, `shootout` VIII (the beats of
  each: `docs/story/ARCHITECTURE.md` section 10.3). `?start=kit` is the kit's
  test bed (`docs/story/seams/Z.md`).
- **M** turns the sound on and off (the browser holds sound back until the
  first click or key; `?mute=1` starts silent), **[** and **]** the volume.
  No music is composed: drop jazz into `public/music/` and
  `docs/story/MUSIC.md` says what goes where.

**The keys, by mode.** Everywhere: mouse looks, **E** does what the prompt
says, **M** sound, **Esc** pause. On a pad: the right stick looks, **□** does
what the prompt says, **options** pauses, the d-pad's down is sound.

| Where | Keys | PS5 pad |
| --- | --- | --- |
| walking (the street, the alley, the office, the pier) | **W A S D**, **Shift** sprints | left stick (as fast as it is pushed), **L1** (or **L3**) sprints |
| I The Diner (seated at the counter) | mouse looks round the room; **E** light up, scotch, drink, pay; **F** a drag on the cigarette; **LMB** taps the ash; **Q** spins the empty stool beside you | right stick looks; **□** light up, scotch, drink, pay; **R1** a drag; **R2** taps the ash; the d-pad spins the stool |
| II The Fight (and the foreman at Pier Nine) | **LMB** / **RMB** are your two arms: tap to jab, hold to load a harder punch (three ticks) and let go; **A / D** hop aside, **S** hop back, **W** step in; **SPACE** held blocks; **E** takes what is in reach (a bottle, a plate, a stool, at Pier Nine a hook, a lid, a chain, a lantern) and that hand's button uses it (a hold throws). Afterwards **WASD** out of the door, **E** search | **L2** / **R2** are your left and right fists (each trigger the fist of its side); a flick of the left stick left / right hops aside, back hops back, forward steps in; **✕** held blocks; **□** takes |
| III Room 304 | **WASD**; **E** push the door, the pad, the picture, the dial, take; the pad: hold **LMB** and rub; the dial: the mouse turns it, **E** the handle | left stick; **□**; the pad: hold **R2**, the right stick rubs; the dial: the right stick turns it; the torn check: the right stick moves the fingertip, **R2** held drags a piece, **L2** held (or **L1** / **R1**) turns it |
| IV The Door | **LMB** fires the revolver, hold **RMB** to steady, **R** reloads; **E** tips the desk; **C** ducks (a toggle; **Ctrl** ducks while held) | **R2** fires, **L2** held steadies (crouched: rises over the cover), **△** reloads; **□** tips the desk; **○** ducks (a tap toggles; held, you stand when you let go) |
| V The Watcher | **E** look out, **E** the fire escape; **W** takes you down the iron; the chase: **W** runs (no key held for speed), **A / D**, the mouse steers, **SPACE** vaults a fence and hops a crate; **E** drive | **□**; the left stick forward; the chase: the left stick, the right stick steers, **✕** vaults and jumps, **○** slides under |
| VI The Tail | **W** throttle, **S** brake and reverse, **A / D** steer (the arrows too); close to him, hold **RMB** to put the revolver out of the window and **LMB** to fire; **E** get out, **E** take him, then look at the river with the mouse | **R2** throttle and **L2** brake / reverse (as far as they are pressed), the left stick steers (as far as it is pushed), **✕** handbrake; hold **L1** to lean out of the window and **R1** fires (**R2** stays on the throttle); the right stick aims; **□** get out, take him; the d-pad is the horn |
| VII Pier Nine | **WASD**, **Shift** runs, **C** crouches (you are heard walking within 3 m, running within 8, crouching never); **E** open a door, take a bottle, pull the switch or the cord, knock a man out from behind; with a bottle hold **LMB** for the arc and let go to throw; then the foreman's fist fight (as II) | left stick, **L1** runs, **○** crouches; **□**; with a bottle hold **R2** and let go; then the fist fight (as II) |
| VIII The Block | **E** take the Tommy gun, **E** the lights by the door, **E** the drums on the counter; **LMB** fires (hold), **R** reloads; at the end **WASD** out to the hat | **□**; **R2** fires (hold), **△** reloads; the left stick |
| the comic panels | a click, **E** or **SPACE** moves on, **ESC** twice skips | **✕** moves on, **options** twice (or held) skips |

## How the look works

- `src/render/Pipeline.js` renders normals + object ids, an emitter-only
  planar reflection of the wet street (long vertical streaks), volumetric
  lamp cones, 3D rain lit by the cones, bloom, and then one ink pass
  (`src/render/shaders/ink.js`): fog, filmic tone curve, dry-brush tonal
  quantisation from canvas-generated stroke textures sampled in **world
  space** (so strokes stay on surfaces as you move), hand-drawn contours,
  a saturation-keyed colour keep for blood and fire, rain streaks, grain.
- Enemies ("Hoods", `src/enemies/`) are skinned procedural men in fedoras
  and trench coats with procedural animation clips, inked as black
  silhouettes with a lamp rim.
- The world reacts: destructible cars that smoke, explode and burn (with a
  warm reflection on the street), shootable lamps and windows, a train
  crossing the el, lightning, and over a hundred procedural Web Audio sounds.

## Tooling

Every tool takes `NOIR_PORT` (the dev server's port) and runs headless Chrome
muted, on a throwaway profile; run one at a time (the GPU is shared and a
frame-rate number from a busy GPU means nothing: read the ratio to
`shot=perf`). `docs/story/ARCHITECTURE.md` section 10.6 has the hygiene.

- `tools/shot.sh out.png "shot=street" 1600 1000` — headless Chrome WebGL
  screenshot of a named camera preset (`street`, `lamp`, `cars`, `hood`,
  `hoodstudy`, `hoods`, `viewmodel`, `battle&t=30` (autopilot combat),
  `wreck&t=8`, `train&t=6`, `title`, `end`; `t=` fast-forwards the
  simulation, `hud=1`, `debug=1`, `view=N` shows pipeline buffers).
  `tools/shot.sh out.png "scene=office&beat=pad&t=3"` — a story beat's frame
  (every beat of the eight scenes: `docs/story/ARCHITECTURE.md` §8 and §10.3);
  `"still=opening&panel=2"` — a page of comic panels.
  A hung capture is killed after `SHOT_LIMIT` seconds (default 180).
- `python3 tools/strip.py out.jpg "scene=...&t={t}" t0 t1 n` — a film strip of
  one motion.
- `tools/errors.sh "scene=office&beat=pad&t=3"` — runtime errors, frame count and
  (with `audiotest=1`) the offline audio render table.
- `node tools/fps.mjs "shot=perf&t=1&anim=1" 1440 900` (`UNCAPPED=1` for
  headroom) — frame-time measurement.
- `python3 tools/golden.py check` — every golden frame (32) against
  `shots/golden/` (the renderer is pixel-deterministic).
- `node tools/play.mjs tools/plays/<play>.json` — a scripted play of the real
  game by trusted input, one play per scene (`office`, `tail`, `warehouse`, ...),
  plus `slice` (scenes 1 and 2), `chapters`, `continue` and `kit` (the opening
  panels, the objective line, a teach card, a fail); the list is in
  `docs/story/ARCHITECTURE.md` §10.5. `node tools/playtest.mjs` is the older
  Phase 3 play-through.

## Design documents

`DESIGN.md` is the art direction and technical plan. The story pass:
`docs/story/STORY.md` (the story, with what was built where it differs),
`docs/story/CONTRACTS.md` (the binding APIs, file ownership, the site plan),
`docs/story/ARCHITECTURE.md` (the engine as built; section 10 is wave B: the
stages, the scenes and their save points, the systems, the plays, the tools),
`docs/story/FIGHT.md` (the fist fight), `docs/story/MUSIC.md` (the music slots,
for the jazz), `docs/story/WAVE_B.md` (the plan for scenes 3 to 9),
`docs/story/seams/` (how to add a mode, a clip, a weapon, a cast kind, a prop, a
sound), `docs/story/briefs/` (one brief per lane) and
`docs/story/reports/` (what each lane built and measured).
`docs/PHASE*_BRIEF.md` are the shooter's phases.

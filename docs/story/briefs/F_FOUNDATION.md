# Foundation brief (step 2) — two passes, in order, in the main checkout

The wave shooter becomes the engine of a story game. Nothing visible changes
in this step: the foundation is judged by the golden frames staying
**pixel-identical** and by the contract APIs existing and working as stubs.

Read first, in this order: `DESIGN.md`, `docs/story/STORY.md`,
`docs/story/CONTRACTS.md`, `reference/noir_reference.png`, then the code:
`src/main.js`, `src/game/*.js`, `src/world/World.js`, `src/render/layers.js`,
`src/render/Pipeline.js`, `src/debug/Shots.js`, `src/player/*.js`,
`src/enemies/Spawner.js`, `src/world/Facade.js`, `src/ui/Hud.js`.

Work in `/Users/evansmac/Downloads/eprojects/noirextreme` on branch `main`.
A dev server is already running on port 5173 (leave it running; it reloads
on save). Commit locally after each numbered task with a clear message
ending in the co-author line below. **Do not push.**

```
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## The gate (run it after every task)

```
python3 tools/golden.py check          # 28 frames, about 4 minutes
bash tools/errors.sh "shot=street"     # and every preset you touched
npm run build                          # imports resolve
```
Expected after every task of pass A and pass B:
- IDENTICAL: `street street_t8 lamp cars carside hood hoodstudy hooddeath
  hoodwalk hoods viewmodel reload impacts muzzlesmoke wreck_t2.9 wreck_t3.1
  wreck_t3.4 wreck_t8 wreck_t40 train_t6 havoc storm battle_t15 battle_t30
  battle_t45 perf title`.
- `end` may change (the card no longer counts waves): run with `ALLOW=end`.
If a frame that must be identical changes, find out why and fix it before
moving on. Open `shots/check/diff_<name>.jpg`. Do not accept goldens.

---------------------------------------------------------------------------
## Pass A — demolition and the engine

A1. **Remove third person entirely.** Delete `src/player/PlayerBody.js`, the
  `V` key, `game.ots`, `setOts`, `aimRef` (it is the camera), the `ots`,
  `otslook`, `otshatdrop`, `otsheadk` parameters, the `ots` preset and
  `stageOts`, `PLAYER_SLOT`, `PLAYER_HEAD`, `HERO` and everything in
  `ink.js`, `Hood.js` (`playerPartGeometry`, player-only geometry paths),
  `Pipeline.js`, `Hud.js` (the moving crosshair) and `README.md` that exists
  only for it. The Hoods get all 64 figure slots. Grep until nothing refers
  to it. The shader must print every first-person frame exactly as before.

A2. **Remove waves.** No wave counter, wave card, intermission or
  `Spawner`. `src/game/Director.js` (CONTRACTS §5) replaces it, with
  `legacyWave(n)` spawning exactly what wave n spawned (same spots, same
  order, same RNG fork 1777, same pacing helpers: the lull breaker and the
  fire tokens stay with the Hoods' AI) so `battle`, `perf` and `end` stay
  identical. The HUD loses the wave / kills box. In play, for now, the title
  leads to the stub scene of pass B.

A3. **Stages and parts.** `World` becomes the Stage base (CONTRACTS §2.2):
  engine services in the base, the block's content in
  `src/stages/block/` as parts (`street`, `overpass`, `facade`, `lamps`,
  `skyline`, `cars`, `props`, `train`, ... in today's build order, so ids,
  RNG draws and draw order are what they were). `game.stage` /
  `game.world` is the current stage; `game.stages.get(name)`. Systems that
  belong to a place (`fx`, `rays`, `nav`, `covers`, `react`, the cast) are
  per stage; systems that belong to the player or the machine (`hands`,
  `weapons`, `health`, `hud`, `sfx`, the pipeline) are the game's and are
  re-bound on `stage:enter`. Move `src/game/React.js` to `src/fx/React.js`.
  Add `stage.surfaceY`, `stage.addSolid / removeSolid`, `stage.anchors`,
  `stage.dry`, `stage.look` / `lookAt`, `lamps.addCustom` (§2.4).

A4. **Preset registry.** `src/debug/Shots.js` keeps the core and today's
  presets; `src/debug/shots/*.js` files are auto-registered
  (`import.meta.glob`, eager) and export `{ presets: { name: {...} } }`.
  Add the scene shot mode of CONTRACTS §3 (`?scene=&beat=&t=`).

A5. **Ink id ranges** as CONTRACTS §9.4: `allocInkId` wraps at 1729,
  `allocVmId(n)` hands out 1730..1769 and the ink pass treats 1730..1779 as
  the viewmodel. Check first that the block never allocated past 1729.

---------------------------------------------------------------------------
## Pass B — the contract stubs

Every API in CONTRACTS.md exists, is reachable from `game`, and **works as a
stub** good enough for seven lanes to build against in parallel. A stub is
plain but real: it has the final name and signature, it does the simplest
thing that lets the next lane test its own work. Keep each stub in the
directory its future owner owns (CONTRACTS §1) so the owner replaces a file,
not a fragment.

B1. `src/game/SceneManager.js`, `defineScene`, the generator helpers
  (`wait`, `until`, `beat`), transitions (fade to black, chapter card), the
  shot mode. Stub scenes `src/scenes/01_diner.js` and `02_fight.js` with
  the beats of STORY.md: each beat places the player and the stub cast
  where the story has them and waits for E.
B2. `src/game/Interact.js` with the HUD prompt; `Inspect.js`, `Puzzles.js`
  (the table camera, the virtual cursor, one trivial demo puzzle behind
  `?scene=diner&beat=settle&puzzle=demo`).
B3. `src/cast/Cast.js`: `cast.spawn(kind)` for every wave A kind, each a
  Hood-skeleton figure without a gun (the Hood's own mesh is the
  placeholder), the whole Character API, clips that hold a plausible pose
  for their duration and fire their marks (timing from CONTRACTS §14 as
  data in `src/cast/clips.js`).
B4. `src/player/Hands.js`: the Viewmodel behind the `hands` API.
  `equip('tommy')` is today's gun, untouched (the golden frames prove it).
  The other sets show nothing yet; `hands.play(clip)` runs the clip's clock
  and marks. Controller modes `walk`, `seated`, `brawl`, `table`,
  `cutscene` (§7.1), plain but working.
B5. `src/props/index.js`: `buildProp(kind)` for every wave A kind as a
  simple smooth lathe or rounded box of the right size with `grip` and
  `rest`. `src/destruct/Breakables.js` and `src/destruct/Glass.js`: the
  façade's crack / shatter code moves into Glass unchanged and the façade
  registers its panes (the `havoc` frame proves it); breakables hide the
  object in a burst of the existing debris. Prop stubs carry the no-op
  methods the briefs name (`userData.setFill`, `setTilt`, `setOpen`).
  `src/fx/`: `fx.pour.start({ from, to, accent, rate })` / `.stop()`,
  `fx.cig.wisp(pos)` / `.exhale(pos, dir)`, `fx.hit.punch(pos, dir, power)`
  as stubs that draw something plain with the existing particles.
B6. `src/render/accents.js` (§9.3) with colours that survive today's
  colour keep; `pipeline.setLook` (§9.1) where the block's Look is today's
  frame; `src/game/Exposure.js` (§10) working; `src/audio/Music.js` (§12.3)
  and `sfx.room(name)`; `src/game/Save.js`; `src/vehicles/index.js` as an
  interface that throws "wave B".
B7. **The diner site** (CONTRACTS §15), as stubs: rebuild the near
  building's mass as boxes around the diner's void (same outer faces, same
  world-space texture: the golden frames must not move);
  `src/stages/block/parts/dinerFront.js`: the four bays as plain openings
  in a plain wall, a doorway, colliders; `src/stages/block/parts/diner.js`:
  floor, ceiling, walls, a counter block, nine stool cylinders, booth
  blocks, the pendant lamps through `lamps.addCustom`, every anchor of the
  site plan, the dry volume, an interior Look. Real walls get real
  colliders: the player walks in and out through the door and nowhere else.
  The part returns the API of `docs/story/briefs/L5_INTERIORS.md` P0.2
  (`stool(i)`, `items`, `place`, `take`, `jukebox`, `bell`, `doorBell`,
  `register`, `cupsRattle`, `lampsDip`, `trainPass`, `reset`) as working
  no-ops, and `dinerFront` returns `door` (`on('open')`) and `panes` (B1,
  B2, B4 through `game.glass.addPane`).
  The lane briefs in `docs/story/briefs/L*.md` name a few more calls
  (presets, part APIs, clip names): read them all and make sure every name
  a lane will call on another lane's system exists as a stub.
B8. `docs/story/ARCHITECTURE.md`: the module map as built, one paragraph
  per system, how a lane adds a part, a preset, a scene; the exact query
  strings of the new presets. Update `README.md` and the first paragraph
  and §2, §8, §9 of `DESIGN.md` for a first-person story game. Record
  anything that differs from the contract under "Deviations" in
  CONTRACTS.md.
B9. New golden candidates (capture into `shots/check/`, do not accept):
  `scene=diner&beat=settle`, `scene=diner&beat=order`,
  `scene=fight&beat=round1`, and a street view of the stub diner front
  from the pavement (`shot=dinerfront`).

---------------------------------------------------------------------------
## What the foundation does not do
No art. No new look. No fix from the user's list other than the removal of
third person and waves. The reflections, the reload, the hand, the cars, the
track, the bounds, the skyline and the glass belong to the lanes.

## Report
For each task: what changed, the golden table after it, the errors.sh
output, and anything a lane must know. List every file created, moved or
deleted.

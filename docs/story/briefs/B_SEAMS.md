# Wave B seams (plumbing, before the scene owners fan out)

Seven builders are about to build scenes 3 to 9 in parallel, each in its own
worktree. Today several registries are single files that every one of them
would have to edit (controller modes, hand clips, cast kinds, props, sounds,
the Hoods' brains). This pass turns each into a folder that is read on its
own (`import.meta.glob`, eager, as `src/scenes/` and `src/stages/` already
are), so **a lane adds a file and never edits a shared one**.

This is plumbing. No redesign, no new look, no behaviour change. Aim to be
done in about half an hour. Two builders, X and Y, in two worktrees; the
files below are split so they never touch the same one.

## Rules for both

- Behaviour today must be bit-identical. Gate, from your worktree, with your
  own dev server (`ln -s <main checkout>/node_modules node_modules`, then
  `NOIR_PORT=<your port> npx vite` in the background; every tool reads
  `NOIR_PORT`):
  - `NOIR_PORT=<port> python3 tools/golden.py check` : every frame identical.
  - `NOIR_PORT=<port> node tools/play.mjs tools/plays/slice.json` : passes
    (it is a little flaky at "walk out of the diner": rerun once before
    believing a failure there).
  - `NOIR_PORT=<port> bash tools/errors.sh "scene=fight&beat=round1&t=3"`: clean.
- Headless Chrome is always muted (the tools do it). Stop your dev server
  and delete `shots/check`, `shots/play` when you are done.
- Do not touch anything outside your list. Commit on your branch with a
  clear message. Write your half of the how-to in `docs/story/seams/X.md`
  or `Y.md`: for each seam, the file shape and a five-line example. Your
  final message: what you built, the exact export shape of every seam, and
  anything that differs from this brief.

## Builder X: the player's side

**X1. Controller modes** (`src/player/Controller.js`, new `src/player/modes/*.js`).
A mode file default-exports
`{ name, enter(ctl, opts, prevPose), step(ctl, dt), exit?(ctl), mouse?(ctl, e) -> true if it took the move }`.
`setMode(name, opts)` accepts any registered name (calls the old mode's
`exit`, then `enter`); `modeStep` calls `step`; `_onMouse` offers the move to
`mouse` first. A mode owns `pos`, `yaw`, `pitch`, `groundY`; the shared
`apply()` still does the bob, the shake, the hands' viewFx, the kick and the
mode-change blend. Pull today's walking out of `update()` into
`walkStep(dt, { speed = 4.0, sprint = 6.8, canSprint = true, input? })` so a
mode (a run, a sneak) can reuse it; `update()` calls it for `walk` exactly as
now. `'drive'` stops throwing: it is simply not a mode until a file adds it.
The built-in modes stay where they are.

**X2. Hands data** (`src/player/Hands.js`, `handPoses.js`). Glob
`src/player/clips/*.js`: a file may export `CLIPS`, `POSES`, `SOCKETS`,
`SETS` (each an object merged into the hands' tables; a name defined twice
throws at load). Today's `clips/diner.js` and `clips/fight.js` keep working
as they are (adapt their exports or the loader, whichever is smaller).
`HAND_SETS` is the keys of the merged sets.

**X3. Weapons** (`src/player/Weapons.js`, new `src/player/weapons/*.js`,
the call sites in `src/game/Game.js`). `weapons.register(impl)` and a glob
of `src/player/weapons/*.js`, each default-exporting
`(game) => ({ name, set, equip(), unequip(), trigger(down, pressed), fire() -> bool, reload() -> bool, update(dt, t), ammo, mag })`.
`weapons.equip(name)` swaps them; the Game gives the current weapon the
mouse button each step and calls its `update`. The Tommy gun stays exactly
as it is (wrap it, do not move it). Then add a **plain revolver**
(`weapons/revolver.js`) so gunfights can be built before the real one
lands: six rounds, one round per press (0.3 s between), the same bullet path
the Tommy's rounds take (damage so a Hood dies to two body hits), the
existing `pistol` sound, the existing muzzle flash at a point ahead of the
eye, `controller.kick`, R reloads in 1.8 s. No model, no hands: lane B3
replaces its insides and keeps this front.

**X4. HUD layers** (`src/ui/Hud.js`). `hud.layer(name) -> HTMLElement` (a
div of the lane's own under the HUD root, `pointer-events: none`, made on
first ask) and `hud.dropLayer(name)`; all layers are dropped on scene exit.

**X5. The order of the story** (`src/game/SceneManager.js`, `src/game/script.js`,
`src/game/Game.js`, `src/main.js`, `src/scenes/02_fight.js` at its end only,
new `src/scenes/order.js` with no default export).
`ORDER = [{ id, numeral, title }]`: diner I The Diner, fight II (keep its
title), body III The Body, office IV Room 304, gunfight V The Door,
watcher VI The Watcher, tail VII The Tail, warehouse VIII Pier Nine,
shootout IX The Block. `scenes.next(opts)` and `ctx.next(opts)` go to the
next id in ORDER that has a scene file; when there is none, the
"to be continued" card (`game.endSlice()`), as today. Scene 2 ends with
`ctx.next()`. A scene's chapter card takes its numeral and title from ORDER
unless the scene gives its own. `?start=<id>[.<beat>]` in play mode: the
title's click starts there instead of the diner (no save read), so a scene
can be played by hand or by `tools/play.mjs` without playing the ones
before it.

## Builder Y: the world's side

**Y1. Cast kinds** (`src/cast/Cast.js`, `costumes.js`, `castAnim.js`, new
`src/cast/kinds/*.js`). A kind file default-exports
`{ kind, h, name?, costume, clips?: { name: def }, idle?: clipName, onSpawn?(c, fig, cast) }`
and is merged into `KINDS`, `COSTUMES`, the animator's clip bank and the
idle table. Today's kinds stay where they are. `cast.has(kind)`.

**Y2. The Hoods under direction** (`src/enemies/HoodAI.js`, `src/game/Game.js`
`spawnHood`, `src/game/Director.js`, `src/cast/Cast.js` pass-through).
Scenes 5 and 9 place gunmen by the story, not by the wave spawner. Add
options that reach `spawnHood` from `cast.spawn('hood', { ... })` and
`d.spawn({ ... })`:
- `entry: [{x, z} | anchor, ...]`: he walks (or runs: `run: true`) these
  first, without thinking, then his brain starts.
- `post: {x, z} | anchor`, `leash: metres`: he fights from there and never
  goes further from it than the leash (0 = he never moves: a man on a
  landing, a man behind a car door).
- `wake: fn -> bool` or `'sight' | 'shot'`: he stands idle until it is true.
- `aim: 1` (a scale on his accuracy) and `hp`.
And a brains folder for anything stranger: `src/enemies/brains/*.js`
default-exporting `{ name, create(game, hood, opts) -> { update(dt, t), onHit?(dir, stunned), release?() } }`,
chosen by `brain: '<name>'`; `'cover'` (today's) and `'none'` stay. The
default path must not change by one random draw: the accepted battle frames
are the test. In your notes say how a new stage gets its nav grid and cover
points for the Hoods (what it must provide), and the calls a brain can make
on a Hood (move, face, aim, fire, states).

**Y3. Props** (`src/props/index.js`, `kinds.js`, new `src/props/kinds/*.js`).
A file exports `SPECS = { kind: (variant, lod) => spec }`, merged into the
library; a kind defined twice throws at load.

**Y4. Sounds and rooms** (`src/audio/Sfx.js`, new `src/audio/sounds/*.js`).
A file default-exports `(kit) => ({ sounds: { name: fn(ctx, out, t0, p, R, send) }, rooms?: { name: def } })`
where `kit` is every helper the built-in sounds use (burst, thud, ping,
chain, osc, gain, env, filt, voice, loopN, glassFall, splinter, tear, rng,
and the built-ins themselves). Make `sfx.room(name)` read a table a file can
add to (say in your notes what a room definition is).

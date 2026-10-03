# NOIR EXTREME: the story engine as built (foundation, passes A and B; wave B in §10)

This is the map a lane reads before touching code. `CONTRACTS.md` says what
must exist; this says where it is, what it does today, and how to add to it.
Where the two differ, the difference is listed in `CONTRACTS.md` under
"Deviations" (Foundation, pass B). Stubs are plain but real: they carry the
final name and signature, and they do the simplest thing that lets another
lane test its own work. A lane replaces the stubs in the files it owns
(CONTRACTS §1) and builds against the others' APIs, never their insides.

**Status after wave B (round 3).** §1 to §9 were written by the foundation
and corrected where they were plainly wrong; every stub they name has since
been replaced (wave A: lanes 1 to 7; wave B: the vehicles, the revolver, the
hands' sets, the controller's modes). §7 is kept as the record of who
replaced what. **§10 is wave B: the five stages, the nine scenes and their
save points, the systems the lanes added, the plays, the chapter select,
the tools' hygiene and the seams folders.** The story plays from the title to
THE END (the README's "How to play" says how).

---------------------------------------------------------------------------
## 1. Module map

Owner lane in brackets. **Frozen** files are the integration agent's.

```
index.html, vite.config.js, package.json          [frozen]
src/main.js                        [L7] bootstrap, URL params, the loop, window.__noir
src/game/
  Game.js                          [L7] the engine object (game): the player, the story's systems,
                                        combat resolution, the state machine, input edges
  SceneManager.js                  [L7] game.scenes: scene coroutines, transitions, shot mode
  script.js                        [L7] wait / until / beat / defineScene / keyLabel (what scripts import)
  Interact.js                      [L7] game.interact: one prompt at a time
  Inspect.js                       [L7] game.inspect: an object held up and turned
  Puzzles.js                       [L7] game.puzzles: table puzzles, the virtual cursor, the demo
  Director.js                      [L7] game.director: fights as scripts; legacyWave(s) for old presets
  Exposure.js                      [L7] game.exposure: light at a point, the player's exposure
  Save.js                          [L7] game.save: checkpoints in localStorage['noir.save']
  Autopilot.js                     [L7] the battle presets' player
src/scenes/
  01_diner.js ... 09_shootout.js   the nine scenes (one file per scene, auto-registered; §10.3), their
                                        helpers in src/scenes/<id>/ ; 90_range.js is a test bed outside the order
  order.js                         the story's order (ORDER; no default export: not a scene)
  _diner_room.js                   [L7] shared setup of the diner (no default export: not a scene)
src/ui/Hud.js                      [L7] HUD, prompts, subtitles, chapter card, fade, cursor, cards
src/audio/
  Sfx.js                           [L7] procedural sounds, sfx.room(name); wave B's sounds and rooms are files
                                        in sounds/*.js (§10.4)
  Music.js                         [L7] game.music: the named slots (docs/story/MUSIC.md)
src/render/                        [L1] (only L1 edits shaders, Pipeline.js, layers.js)
  Pipeline.js                           the passes; pipeline.setLook (blends the Look over about 0.25 s)
  accents.js                            accent / accentMaterial
  glass.js                              makeGlassMaterial / makeWindowLightMaterial / makeRoomMaterial
  layers.js, shaders/*, textures.js, fog.js, tone.js, uniforms.js
src/player/                        [L2]
  Controller.js                         first person + modes (walk, seated, brawl, table, cutscene; wave B's are
                                        files in modes/*.js)
  Hands.js                              game.player.hands (the inked hands; sets, clips, sockets from clips/*.js)
  HandRig.js, handPoses.js              the rig, its poses
  handClips.js                          the hands' first clips as data
  Viewmodel.js                          the Tommy gun and gloves (the golden frames' gun)
  Weapon.js                             the Tommy gun's logic
  Weapons.js                            game.player.weapons (front over Weapon.js; weapons/*.js: the revolver)
  Health.js                             health and its overlay
src/fx/                            [L3]
  Fx.js                                 the stage's effects (game.fx): particles, decals, flashes, ...
  StoryFx.js                            fx.pour, fx.cig, fx.hit
  React.js                              bullets routed to what they hit
  Particles, Decals, MuzzleFlash, Casings, Impacts, Blood, Explosion, Fire, Steam, GroundMist, fxTextures
src/destruct/                      [L3]
  Glass.js                              stage.glass (panes: cracks, stars, shards)
  Breakables.js                         stage.breakables
src/world/                         [L4] (Cars.js [L3], World.js [frozen])
  World.js                              the Stage base
  Facade.js                             the near building (far / near builds round the diner), far blocks
  Colliders.js                          2D collision: circles, boxes, bounds, regions
  Street, Lamps, Lights, Overpass, Skyline, Props, Train, Rain, Sky, Storm, Cars, geom, materials
src/stages/
  index.js                         [frozen] the stage registry (import.meta.glob)
  block/index.js                   [L4] the block: its parts, found on their own
  block/site.js                    [L4] the diner's site plan (CONTRACTS §15) as numbers; dinerInSight
  block/parts/*.js                 [L4] sky 10, street 20, overpass 30, facade 40, lamps 50, skyline 60,
                                        cars 70, props 80, steam 90, mist 100, rain 110, train 120,
                                        dinerFront 130
  block/parts/diner.js             [L5] the diner's room, order 140
  block/parts/alley.js             [B1] the side alley of scene 3, order 200 (§10.2)
  office/, backlot/, riverroad/, pier9/   wave B's four stages (§10.2)
src/props/index.js                 [L5] buildProp; wave B's kinds are files in props/kinds/
src/enemies/                       [L6] Hood, HoodRig, HoodAnim, HoodAI, Nav
src/cast/                          [L6]
  Cast.js                               stage.cast (costumes on the Hood's skeleton; wave B's kinds are files
                                        in kinds/*.js)
  Character.js                          the Character API
  clips.js                              the cast's clips as data
src/vehicles/                      [B5] game.vehicles: index.js (spawn), Vehicle.js (the physics), models.js
src/debug/                         [frozen] Shots.js (the core presets), Stats, Bench, GpuProf, errlog
src/debug/shots/F_stage.js         [frozen] the foundation's presets
src/debug/shots/L4_street.js       [L4] dinerfront (started by the foundation)
src/debug/shots/L<n>_*.js          [L<n>] each lane's presets (auto-registered)
src/util/                          [frozen] RayWorld (bullets, line of sight), rng
tools/                             [frozen] shot.sh, errors.sh, counters.sh, golden.py, fps.mjs, playtest.mjs, ...
```

---------------------------------------------------------------------------
## 2. One fixed step, one frame

`main.js` runs the simulation at a fixed 1/60 s (`simStep`), then renders.
All game logic lives in the step and takes its time from it (`game.time`,
`dt`), never from `Date`, `performance.now`, timers or promises; randomness
comes from forks of the seeded `RNG` (`rng.fork(n)` draws nothing).

```
simStep(dt):
  game.pre(dt, t)      staged shot scripts; the autopilot; the controller (input, modes);
                       the viewmodel and the hands' clips; the weapon in hand (weapons.step:
                       the Tommy gun only if the hands' set is 'tommy'; the revolver, a file);
                       the Hoods' AI
  stage.update(...)    the parts' updaters in tick order; the Hoods; the cast; the
                       breakables; the light registry -> rain / rim uniforms
  game.post(dt, t)     the Hoods' bullets; react; fx; the train; the storm; the director;
                       the scene's script and its onStep hooks; interact; inspect; the
                       puzzle; the HUD's line timers; sfx.room from the Look; input edges
                       cleared
frame:  pipeline.setLook(stage.lookAt(eye)); pipeline.render(scene, camera, t); hud.update
```

Input edges for scripts: `game.pressed(code)` (a key, `Mouse0`, `Mouse2` went
down since the last step), `game.released(code)`, `game.mouse` `{ dx, dy,
wheel }` for the step. Held keys: `controller.keys` (a Set of codes, mouse
buttons included). A headless driver can press a key for a scene with
`game.scenes.press(code)`.

---------------------------------------------------------------------------
## 3. The systems

**Game** (`game`, `window.__noir.game`). Built once in `main.js`. Holds
`stage` (alias `world`), `stages`, `player = { controller, hands, weapons,
health, eye }`, `scenes`, `interact`, `inspect`, `puzzles`, `director`,
`exposure`, `music`, `save`, `vehicles`, `hud`, `sfx`, `pipeline`, `rng`,
`time`, `counters`, and getters for the current stage's `cast`, `glass`,
`breakables`, `fx`, `rays`, `nav`, `covers`, `react`, `hoods`. Events:
`game.on(name, fn)` / `off` / `emit(name, data)`. Emitted today:
`stage:enter`, `scene:enter`, `scene:beat`, `scene:exit`, `player:hit`,
`player:down`, `shot`, `car:exploded`, `glass:shatter`, `break`, `cast:hit`,
`cast:down`, `brawl:round`, `brawl:end`, `music:cue`, `cue`. `game.start(from)`
(the title's click: BEGIN goes to scene `diner`, CONTINUE to the save, a
CHAPTERS row or `?start=` to that scene, §10.1); `game.restart()` (try
again) goes back to the current scene at its beat. `game.screenOf(v)` -> CSS pixels.
`game.enterStage(name)` swaps the place and re-binds the player's systems.

**Stages and parts** (`src/world/World.js`, `src/stages/`). A Stage is a
place: engine services (materials, light registry, colliders, fog, the
pre-allocated flash / fire lights), then its parts built in `order`, then its
own systems (solids and the ray world, nav grid, cover set, fx, the Hoods,
the cast); `react` on the first bind. Before the parts it makes
`stage.glass` and `stage.breakables` (plain registries) so a part can
register panes and breakables while it builds. `stage.part(name)` (also
`stage[name]`), `stage.anchor(name)` / `addAnchor`, `stage.surfaceY(x, z)` /
`addSurface(fn)`, `stage.addSolid` / `removeSolid`, `stage.dry` (Box3[]),
`stage.look` / `addLook(box, look)` / `lookAt(pos)`, `stage.onReflLod` /
`onShadowLod`, `stage.update`. `game.stages.get(name)` builds a stage on
first use; the block draws from the root seed, any other stage from
`root.fork(salt)`.

**Scenes** (`game.scenes`, `src/game/SceneManager.js`). A scene is
`defineScene({ id, stage, title, name, spawn, beats, save, setup, script })`
in `src/scenes/NN_name.js`. `scenes.go(id, { beat, fade: 'black' | 'cut',
card })`: fade to black (0.6 s), `enterStage`, clear the stage's cast and the
scene's interact handles, run `setup[beat]` (or place the player at
`spawn.anchor`), the chapter card, fade in, start the script at the beat,
write the save. `scenes.shot(id, beat)` is the same at once, for
`?scene=&beat=`. The script is a generator stepped once per fixed step; it
yields `wait(s)`, `until(fn)`, `beat(name)` (costs no step), or nothing (the
next step), and delegates with `yield*` (`ctx.say`, `ctx.prompt`,
`c.walkTo`). `ctx = { game, stage, player, hands, controller, cast,
interact, inspect, puzzles, director, hud, sfx, music, save, rng, time,
sceneTime, scene, beat, from, at(beat), pressed(code), onStep(fn), flags,
say, prompt }`. `ctx.at(b)` is true when the scene was entered at or before
beat b: a script wraps each beat in `if (ctx.at('order')) { ... }` so a jump
skips what came before. `ctx.onStep(fn)` runs every step while the scene
lasts (what lives under the beats).

**Interact** (`game.interact`). `add({ id, at, range, cone, prompt, key,
hold, when, onUse, scope })`, `remove`, `clear(scope)`; the candidate nearest
the view's centre within range and cone gets the prompt; `onUse(ctx)` on the
key (or after `hold` seconds held). A scene's `ctx.prompt` takes the line
while it waits. **Inspect** (`game.inspect`): `open({ prop, options,
caption, onDone })` draws the prop in the hands' scene; mouse turns, wheel
zooms, E puts it away (`onDone(ctx)`); `close()`, `active`. **Puzzles**
(`game.puzzles`): `define({ id, table: { anchor, size, height, fov }, build,
input, update, solved, hint, exit })`, `open(id, { onSolved })`; the camera
eases to the table (controller mode `table`); the pointer is `{ x, z (m on
the table), down, pressed, right, wheel, world }`; E leaves (state kept); a
hint after 40 s without `state.progress` changing.

**Director** (`game.director`). Fights as scripts: `run(function* (d) {...})`,
`d.spawn({ who, at, yaw, group, entry, to, brain, variant })` (a Hood kind
with the Game's AI, or any cast kind through `game.cast`), `d.wait`,
`d.until('dead:g' | 'alive:g<=n' | 'zone:anchor' | fn)`, `d.cue(name, data)`
(lightning, train, music), `alive(group)`, `stop()`. `legacyWave(n)` /
`legacyWaves(from)` keep the old wave game for the `battle`, `perf`, `end`
presets only.

**The controller** (`game.controller`). `setMode(name, opts)`, `mode`
(wave B adds file modes, `src/player/modes/`, §10.4): `walk` (today's WASD,
exactly as it was), `seated { anchor, yawRange,
pitchRange, lean, eyeY, pitch }`, `brawl { opponent, ring: { x, z, r }, dist,
eyeY }` (+ `controller.slip` metres sideways, `nudge` from the mouse),
`table { pose, fov }` (eased 0.5 s), `cutscene { track(t) -> pose }`;
`ease(pose, s)`, `eyePose()`, `shake(strength, dist)`, `lookLocked`.
`setPose(x, z, yaw, pitch, y)` puts it back in `walk`. A pose is `{ x, y, z,
yaw, pitch, fov? }` with **y the eye's world height**.

**Hands and weapons** (`game.player.hands`, `.weapons`). `hands.equip(set)`
(`tommy` is the gun and gloves as they were; the others: `smoke`, `fists`,
`empty`, `revolver`, and wave B's `run`, `sneak`, `drive`, `lapels`: §10.4),
`hold(prop, 'L' | 'R')` (the prop moves into the hands'
scene at the palm, on the viewmodel layer with a viewmodel ink id, and gets
its own back when let go), `play(clip, { onMark })` -> handle `{ name, t,
duration, done, stop() }`, `clip(name)`, `busy`, `current`, `anchor(name)`
(`muzzle`, `cigTip`, `mouth`, `palmL`, `palmR`, `glass`, `eye`), `pose()`.
Clip data: `src/player/handClips.js`. `weapons.equip('tommy' | 'revolver' |
'fists' | null)`, `current`, `fire()`, `reload()`.

**Cast** (`stage.cast`, `game.cast`). `spawn(kind, { at, yaw, variant, seat,
group, name, brain })` -> Character; `get(name)`, `list`, `remove(c)`,
`clear()`, `figures()`. Names: `mack` (brawler), `dot` (waitress), else the
kind (`cook`, `oldman`, `couple_her`, `couple_him`, `docker`; a second one
gets `2`). `hood` / `heavy` go through `game.spawnHood` (they live in
`stage.hoods`, with AI unless `brain: 'none'`). Character: `name kind pos yaw
alive object bones hp brain state down items fig`, `setState(name)`,
`play(clip, { fade, hold, onMark })`, `clip(name)`, `*walkTo(at, { speed,
run })`, `sit(anchor)`, `stand()`, `place(at, yaw)`, `face(yaw)`,
`lookAt(v)`, `hold(prop, hand)`, `hit({ dir, power, zone, by })`,
`ko(kind)`. Clip data: `src/cast/clips.js`. A figure is a costume on the
Hood's skeleton (`src/cast/costumes.js`, `tailor.js`); wave B's kinds are
files (`src/cast/kinds/`, §10.4). The cast's figures cast shadows
(`game.shadowFigures()`).

**Props** (`src/props/index.js`). `buildProp(kind, { lod, variant })` ->
Group, origin at the middle of its base; `userData = { kind, variant, size,
grip, rest, inkIds, inkId, accent, fill, setFill, setTilt, setOpen, setTip
}`. Kinds: tumbler, bottle (scotch, rye, gin, beer, ketchup, milk), plate,
cup, saucer, mug, stool, ashtray, cigarette, cigarettePack, lighter,
matchbook (accent crew), wallet, coffeePot, napkinBox, ketchup, sugar, menu,
newspaper, pie, fork, knife, and wave B's (`props/kinds/`: the revolver, the
body's hat, shoe, spectacles, casing and torn half, the office's, Pier 9's
lantern, torch, cargo hook, crate lid, chain and rope, the tail's). A tumbler's and a scotch bottle's liquid is its
own mesh (accent amber) scaled by `setFill`.

**Glass** (`stage.glass`). `addPane({ centre, normal, w, h, material, thick,
lit, room, tag, parent } | { mesh })` -> pane; `hit(pane, { point, normal,
dir, power, by })` -> `'glass' | 'done'`; `shatter(pane, { dir, power })`;
`restore(pane)`; `pane.state`, `pane.on('state', fn)`; emits
`glass:shatter`. A pane of its own is a faint plane on `LAYER.FX` (scene pass
only: the ink sees the room behind it) plus an invisible twin on the world
layer that bullets hit (`userData.pane`). A **shared** pane is a record of
an owner drawing many panes in one merged mesh (the facade's windows); the
owner finds which pane was hit and redraws on `owner.paneGone(pane, from)`.

**Breakables** (`stage.breakables`). `add(object, { kind, hp, mass, solid,
collider, onBreak })` -> handle; `hit(handle | object, { point, dir, power,
by })` -> `'hit' | 'break'`; `topple(handle, impulse)`; `upright(handle)`;
`remove`. Bullets find them through `mesh.userData.breakable`. A break
emits `break` and asks `sfx.play('break_' + kind)`.

**Effects** (`game.fx`, the stage's). The Phase 3 systems (blood, chips,
sparks, splash, dust, smoke, fire, debris, puff, decals, flash, casings,
impacts, explosions) plus `fx.pour.start({ from, to, accent, rate })` /
`stop()`, `fx.cig.wisp(tip)`, `fx.cig.exhale(mouth, dir)`,
`fx.hit.punch(pos, dir, power)`. (`fx.smoke` is a particle system, not a
function.) `fx/React.js` routes a bullet to its target's owner.

**Render** (`pipeline`). The Phase 3 pipeline (normal+id, emitter-only
reflection and streak, scene, volume, rain, bloom, ink). `setLook(look)` is
called every frame with `stage.lookAt(eye)`: fog density and colour,
exposure (unless `pipeline.exposureOverride`, the `exposure=` param) and the
ink pass's screen rain (`rainOverlay`) are applied, switched by volume;
`rain3d`, `grain`, `ambient`, `reflect`, `haze` are carried for lane 1.
`accent(key)` / `accentMaterial(key)` (blood, fire, ember, flame, amber,
neon, crew).
Ink ids: CONTRACTS §9.4, `layers.js` (the block allocates 2..83, the diner
and its props take the ids after them).

**Lamps and light** (`stage.lamps`, the block's lamps part). Gooseneck
posts, sconces, hanging lamps, far fakes, and `addCustom({ head, axis,
height, half, real, bulb, fadeEnd, edgeSoft, strength, tag })` for any part.
Seven pooled real SpotLights (three with shadows) go to the nearest lamps
that are on, every 0.25 s. `lamps.setOn(lamp, on)`, `lamps.shootOut(lamp,
dir)`. Every lamp registers in `stage.lights` (rain, rim, exposure).

**Exposure** (`game.exposure`). `at(pos, { los })` -> 0..1 from the light
registry, one shadow ray per lamp; `player` -> `{ value, lamp }`, chest and
head, smoothed 0.15 s, computed when read.

**Sound and music** (`game.sfx`, `game.music`). `sfx.play(name, pos,
params, opts)` (a name it does not know yet is silent), `sfx.loop`,
`sfx.room(name)` (the Game calls it when the Look's `room` changes).
`music.cue(slot, { fade, diegetic: { pos, room } })`, `music.stop(fade)`,
`music.current`; slots `jukebox_a jukebox_b jukebox_c fight body office chase
tail warehouse shootout end`; a slot plays `public/music/<slot>.(mp3|ogg|m4a)`
when the file exists.

**HUD** (`game.hud`). The Phase 3 cards (title, pause, end), ammo (only
while the Tommy gun is the set), health (in a fight or while hurt), and the
story's lines: `prompt(text, at, owner)` / `clearPrompt(owner)`, `say(text,
s)`, `card(numeral, name, s)`, `fade(k)`, `cursor(at)`, `tick(dt)` (game-time
timers), `freeze()` (shot mode: every CSS animation off).

**Saves** (`game.save`). `write()`, `read()`, `exists`, `clear()`, `flags`,
`inventory`; disabled in shot mode.

**Collision** (`stage.colliders`). Circles, boxes (a box's `cx cz hx hz
angle c s` can be moved, as the diner's door does), the bounds, and
`addRegion(minX, maxX, minZ, maxZ)`: the outer net is the union of the
bounds and the regions (a room behind a doorway). The Hoods' nav grid and
the old spawner read the bounds only.

---------------------------------------------------------------------------
## 4. The diner on the block (the site of CONTRACTS §15)

- `src/stages/block/site.js`: `DINER` (every number of the site plan),
  `stoolZ(i)`, `dinerOpenings()`, `dinerInSight(eye)` / `DINER_SIGHT`.
- **Far and near builds.** Every accepted golden frame is printed from the
  old near building. Cutting the diner's void into its mass moved pixels
  (the same plane cut into other triangles interpolates depth and texture a
  last bit differently, and the ink's thresholds show it). So the facade
  keeps two builds of its mass and plinth: the **far** one is the old solid
  block triangle for triangle; the **near** one is boxes round the void and a
  plinth broken for the doorway. `facade.setNear(on)` swaps them (drawn,
  shadow-cast and shot at one at a time; the shadow maps are re-rendered).
  The diner bays' old shop windows and frames stay in the far build: the
  Hoods' stray rounds in the accepted fights break them.
- **In sight.** `dinerInSight(eye)`: the eye north of z = -7.5, or inside
  (x < -10.2). Every accepted camera stands south of z = -8.4. Out of sight
  nothing of the diner is drawn, shadowed, lit (its pendants are off: no
  pool light, no cone, no rain light) or shot at. `parts/dinerFront.js`
  drives the facade's switch; `parts/diner.js` switches its own room.
  (Lane 4: a frustum test would do better once the goldens allow it.)
- `parts/dinerFront.js` (order 130, lane 4): the wall with its openings,
  panes `B1 B2 B4 B3L B3R`, the door (hinged at z = 0.12, opens inwards when
  the eye is within 2 m, closes 1.5 s after; its collider stands only while
  the leaf is at rest), wall and pilaster colliders, the regions of the
  doorway and the room, anchors `diner.door.in`, `diner.door.out`,
  `diner.pavement.ko`. API: `{ group, wall, door, panes, near, facade }`.
- `parts/diner.js` (order 140, lane 5): the room's stand-ins, eight
  pendants through `lamps.addCustom` (they take the pool while the eye is
  inside), the counter items, the anchors, the dry volume, the interior Look
  (`fogDensity` x0.35, `rainOverlay` 0, `haze` 0.6, `reflect` 'floor', `room`
  'diner'), the floor surface, and lane 5's API (`stool(i)`, `items`,
  `place`, `take`, `jukebox`, `bell`, `doorBell`, `register`, `clock`,
  `fans`, `lamps`, `cupsRattle`, `lampsDip`, `trainPass`, `reset`).
- **Anchors** (`stage.anchor(name)` -> `{ name, pos, yaw, ... }`):
  `diner.stool.1..9` (pos = seat top y 0.92, `eyeY` 1.6, `seat`),
  `diner.stool.player` (= 4), `diner.serve.1..9` and `counter.serve.1..9`
  (behind the counter, x -15.3), `diner.booth.1..4.a/.b` (seats),
  `diner.hatch`, `diner.jukebox.front`, `diner.ring.centre` (`r` 2.2),
  `diner.urns`, `diner.bar.scotch`, `diner.till`, `diner.window.B1..B4`,
  `diner.counter.player` (the counter top before stool 4: the puzzle table),
  `diner.counter.glass`, `diner.door.in`, `diner.door.out`,
  `diner.pavement.ko`; on the street `block.player.start`,
  `block.alley.mouth`.

---------------------------------------------------------------------------
## 5. Conventions

- **Yaw.** The controller's (and every anchor's) yaw is a viewer's: he
  looks along (-sin yaw, -cos yaw). A figure's own yaw (a Hood's, a
  Character's `c.yaw` / `c.face`) is a heading: it faces (sin yaw, cos yaw).
  A figure put on an anchor turns to `anchor.yaw + PI`; `c.place`, `c.sit`,
  `c.walkTo` and `cast.spawn({ at })` do it.
- **Heights.** World y. The street 0, the pavements and the diner's floor
  0.15, the standing eye 1.65 above the surface, the seated eye 1.60, the
  brawl's eye 1.80, the counter top 1.20, a stool's seat 0.92.
- **Anchors**: a part adds them with `stage.addAnchor('diner.name', { pos,
  yaw, r, eyeY, seat, ... })`; names are dotted and start with the place.
- **Ink ids**: `allocInkId()` in a part built after the block's own (order
  after 120) or at runtime; `allocVmId()` for anything drawn in the hands'
  scene (write it as a figure: `userData.inkFigure = true`).
- **RNG**: a new system forks its own (`stage.rng.fork(n)`, `game.rng` is
  the game's fork 8080 and runs the battle); never draw from `stage.rng`
  itself, and never draw in a place the accepted frames pass through.
- **Clips as data**: hands `src/player/handClips.js`, cast
  `src/cast/clips.js`. Scripts read `clip(name).marks`, never numbers of
  their own.

---------------------------------------------------------------------------
## 6. How to add ...

**A part.** A file `src/stages/<stage>/parts/<name>.js`:
```js
export default {
  name: 'bounds', order: 150, tick: 150,          // order: after the block's 120
  build(stage) {                                  // -> the part's API (stage.part('bounds'))
    const g = new THREE.Group(); stage.scene.add(g);
    // meshes into the scene are bullet solids on their own (userData.noRay to opt out);
    // stage.colliders.addBox / addCircle / addRegion; stage.addAnchor; stage.addSurface;
    // stage.glass.addPane; stage.breakables.add; stage.lamps.addCustom; stage.dry.push;
    // stage.addLook(box, look); a rng of its own: stage.rng.fork(<salt>)
    return { group: g };
  },
  update(api, dt, t, camera, pixelHeight) {},     // optional, every step in tick order
};
```
Never reorder the block's parts; a new part takes an order after 120 (or
between two only if it allocates no ink id and draws no shared rng). A part
may read an earlier part's API, never change another part's state (it may
call its API: `stage.part('facade').setNear`).

**A preset.** In your lane's file `src/debug/shots/L<n>_<topic>.js`:
```js
export const presets = {
  mypreset: { x, z, yaw, pitch, fov, t, y?, viewmodel?, prewarm?, holdWindow?,
              stage(stage, camera, controller, game) { /* spawn, script */ } },
};
```
Query: `?shot=mypreset` (`&t=`, `&anim=1`, `&hud=1`, `&pose=x,z,yaw,pitch[,fov]`,
`&fov=`, `&debug=1`, `&view=n`). A name defined twice throws at load.
Staged events go in `game.scripts.push((t, dt) => ...)`.

**A scene.** A file `src/scenes/NN_<id>.js` default-exporting
`defineScene({...})` (imports from `../game/script.js`). Give every beat a
`setup` that puts the room, the cast and the player where the story has
them: that is what `?scene=<id>&beat=<beat>` renders. Write the script so it
runs from any beat (`if (ctx.at(b))`). A helper file in `src/scenes/` without
a default export is not a scene. Add the id to `src/scenes/order.js` to put
it in the story (its chapter card, CHAPTERS, `ctx.next()`); a scene left out
of ORDER (`90_range.js`) is played only by `?start=<id>` or `?scene=<id>`.
Helpers go in `src/scenes/<id>/`. §10.3 lists the nine.

**A cast kind.** A file `src/cast/kinds/<kind>.js` (seams/Y.md Y1: height, a
costume, clips, an idle, `onSpawn`); nothing shared is edited. The built-in
kinds are the Wave A costumes in `src/cast/costumes.js`; a clip's name is
global, so prefix it with the kind.

**A prop.** A file `src/props/kinds/<name>.js` exporting `SPECS` (seams/Y.md
Y3: `{ parts, groups?, grip, rest?, accent?, init?, after? }`); the library's
own kinds are in `src/props/kinds.js` and `src/props/diner/`.

**A breakable.** `stage.breakables.add(object, { kind, hp, collider })` while
the part builds (its meshes become bullet solids with the stage), or at
runtime (it adds them to the ray world). A pane: `stage.glass.addPane({
centre, normal, w, h, tag, parent })`.

**A lamp.** `stage.lamps.addCustom({ head, axis, height, half, real, bulb,
fadeEnd, edgeSoft, strength, tag })`; set `lamp.on = false` at once if it
must not light an accepted frame (a real lamp takes a pool light whenever
it is among the seven nearest that are on).

**A look volume, a dry volume, a floor.** `stage.addLook(box, { ...look,
room })`, `stage.dry.push(box)`, `stage.addSurface((x, z) => y | undefined)`.

---------------------------------------------------------------------------
## 7. The stubs, and who replaced them

**Every row below is done**: lanes 1 to 7 in wave A, the revolver (B3) and the
vehicles (B5) in wave B, with the hands redrawn (B3, R2-B). The foundation's
words in the first column are what the stub was, not what is there now.

| Stub | File | Replaced by |
| --- | --- | --- |
| accent colours (only blood and fire looked at) | src/render/accents.js | L1 |
| setLook (switched, not blended; rain3d, grain, ambient, reflect, haze unused) | src/render/Pipeline.js | L1 |
| makeGlassMaterial, makeWindowLightMaterial (+ userData.sweep), makeRoomMaterial | src/render/glass.js | L1 |
| dry volumes: stored, not read by the rain | stage.dry | L1 |
| Hands: no hands drawn for smoke / fists / empty / revolver / wheel; clips are clocks and marks; held props at a fixed palm | src/player/Hands.js, handClips.js | L2 |
| controller modes (plain: no swivel, footwork, eased mode changes) | src/player/Controller.js | L2 |
| weapons.equip('revolver') (hands set only) | src/player/Weapons.js | B3 (wave B: player/weapons/revolver.js) |
| Glass (the Phase 3a crack / shatter, no geometry-true pieces) | src/destruct/Glass.js | L3 |
| Breakables (a burst of debris, a 0.35 s topple) | src/destruct/Breakables.js | L3 |
| fx.pour, fx.cig, fx.hit | src/fx/StoryFx.js | L3 |
| the diner's street front | src/stages/block/parts/dinerFront.js | L4 |
| far / near builds, dinerInSight | src/world/Facade.js, src/stages/block/site.js | L4 |
| dinerfront preset | src/debug/shots/L4_street.js | L4 |
| the diner's room and its API (cupsRattle, trainPass, fans, clock, register: no-ops) | src/stages/block/parts/diner.js | L5 |
| the prop library (stand-in lathes and boxes) | src/props/index.js | L5 |
| the cast (unarmed Hoods, stand-in poses) | src/cast/Cast.js, Character.js, clips.js | L6 |
| scenes 1 and 2 (E moves the beats on) | src/scenes/*.js | L7 |
| scene manager, interact, inspect, puzzles, save (plain but working) | src/game/*.js | L7 |
| sfx.room (the rain muffled only), the missing sounds (bell, doorbell, lighter, break_*, topple_*, jukebox_hit) | src/audio/Sfx.js | L7 |
| music slots (working; no files yet) | src/audio/Music.js | L7 (the user's jazz) |
| the HUD's lines, card, fade, cursor (plain DOM) | src/ui/Hud.js | L7 |
| the title still drifts on the street | src/game/Game.js titleDrift | L7 |
| vehicles (throw) | src/vehicles/index.js | B5 (wave B: Vehicle.js, models.js) |

---------------------------------------------------------------------------
## 8. Presets and scene beats (exact query strings)

Core (`src/debug/Shots.js`): `shot=street`, `shot=street&t=8`, `shot=lamp`,
`shot=cars`, `shot=cars_v1`, `shot=carside`, `shot=car34`, `shot=hood`,
`shot=hoodstudy`, `shot=hooddeath`, `shot=hoodwalk`,
`shot=hoodlab&hs=<state>&hy=<deg>&hv=<coat,brim>`, `shot=hoods`,
`shot=viewmodel` (`&vmpuff=<s>`), `shot=reload&vmreload=<s>`,
`shot=impacts`, `shot=muzzlesmoke&smokeage=<s>`,
`shot=battle&t=30` (`&legacywave=<n>`), `shot=wreck&t=8` (`&wreckcar=<i>`),
`shot=train&t=6`, `shot=havoc`, `shot=storm&strikeage=<s>`,
`shot=perf&t=1&anim=1`, `shot=title`, `shot=end`.

Foundation: `shot=start` (the block.player.start anchor).
Lane 4 (started by the foundation): `shot=dinerfront`.

Scene beats (`?scene=<id>&beat=<beat>`, default t = 1 s, the hands' scene
shown; `&t=`, `&anim=1`, `&pose=`, `&fov=` work; `&press=KeyE@<t>[,<code>@<t>]`
presses a key at game time t, as a player's would). Every beat of every scene
has a `setup`, so each of these renders; the full list, scene by scene, is
§10.3:
```
scene=diner&beat=settle|order|drink|pay
scene=fight&beat=start|lesson|round1|round2|round3|reel|ko|outside|matchbook
scene=office&beat=corridor|room|pad|safe|ledger         (&demo=1 on pad / safe)
scene=gunfight&beat=shadows|door|window|quiet
scene=watcher&beat=seen|escape|run|car
scene=tail&beat=start|chase|close|shot|crash|interrogate
scene=warehouse&beat=arrive|floor|lamps|aisle|stairs|listen|out|fight|ko|after
scene=shootout&beat=arrive|cars|doorways|el|driveby|cardinal|end
scene=range&beat=ready|fight|done                       (the revolver's test bed)
scene=kit&beat=ready|done                               ([C1] the kit's test bed)
still=opening&panel=0|1|2                               ([C1] a page of comic panels; also ames, check, photo, diner, end)
scene=diner&beat=settle&puzzle=demo                  (the demo puzzle on the counter)
```
Each lane's own presets (`shot=b2_pad`, `shot=b8duel`, ...) live in
`src/debug/shots/B<n>_*.js` and `R2*_*.js`, named in that lane's report.

All the golden frames are accepted (`shots/golden/`, 32 of them: §9).

Play (no shot params): the title, click BEGIN, and the story: the README's
"How to play" has the keys for every mode, `?start=<id>[.<beat>]` starts the
story anywhere (§10.1).

---------------------------------------------------------------------------
## 9. The golden gate: what keeps the accepted frames identical

- Nothing new may be drawn, lit, shadow-cast or shot at in an accepted
  frame's camera (see the diner's far / near builds and `dinerInSight`).
- A real custom lamp competes for the seven pool lights and the rain /
  rim uniform slots: switch it off where the goldens look.
- New objects and materials may be created after the old ones (the
  renderer sorts by ids: their relative order is kept); a part never
  reorders the block's build.
- A new system forks its own rng; the game's rng (`game.rng`) and the
  stage's fork draws are the battle's: keep their order and count where the
  old code drew them (Glass.js keeps the facade's shard draws in the same
  order).
- Stray Hood rounds in `battle`, `perf` and `end` hit whatever the rays find
  (the old shop windows, the facade, the props): anything you add to the ray
  world where they fly changes the fight. Check with `tools/counters.sh
  "shot=battle&t=1"` against the previous commit.
- Shot mode freezes CSS animation, so the title and end cards are
  deterministic.
- Gate: `python3 tools/golden.py check` (32 frames, run with `NOIR_PORT` of
  the dev server; every frame identical). The title and end frames were
  accepted after Wave A; the hands' frames after round 2 (`diner_settle`,
  `diner_order`, `fight_round1`: the two-tone hands, accepted in commit
  9e03ec2). A lane that changes a frame on purpose says which and why.

---------------------------------------------------------------------------
## 10. Wave B: scenes 3 to 9 (as built, from the lanes' reports)

Wave B built the rest of the story (`docs/story/WAVE_B.md` is the plan; the
lane reports, each with a Round 2 section, are `docs/story/reports/wave-b/B1.md`
to `B8.md`; the review frames and strips are `docs/story/review/wave-b/B<n>/`;
the briefs `docs/story/briefs/B*.md` and `R2_ROUND2.md`). Lane ids: B1 the body,
B2 room 304 and the door, B3 the revolver and the hands, B4 the watcher, B5 the
tail and the vehicles, B6 Pier 9, B7 the shootout, B8 the fist fight; round 2
(R2-A to R2-H) reworked each, R2-B the hands across the game, R2-E Pier 9's
second fist fight. The nine chapters are merged on `wave-b/integration`. This
section says what is there; the sections above still say how the engine works.

### 10.1 The order, the title, the starts and the saves

- **The order** is `src/scenes/order.js` (`ORDER`). **Wave C** (lane C1,
  `docs/story/seams/Z.md`): diner I The Diner, fight II The Fight, office III
  Room 304, gunfight IV The Door, watcher V The Watcher, tail VI The Tail,
  warehouse VII Pier Nine, shootout VIII The Block; The Body is cut (its file
  parked as `src/scenes/_body_cut.js`: the manager skips `_` files), and each
  entry carries the chapter's kit defaults (stand-in objective, music,
  carry). The rest of this section is wave B's (nine chapters, III The Body)
  until lane C10 rewrites it. Wave B's order was: diner I The Diner, fight
  II The Fight, body III The Body, office IV Room 304, gunfight V The Door,
  watcher VI The Watcher, tail VII The Tail, warehouse VIII Pier Nine,
  shootout IX The Block. A scene's chapter card takes its numeral and name
  from here. `ctx.next(opts)` / `scenes.next(opts)` go to the next id in ORDER
  that has a scene file (a fade to black and its card by default); past the
  last, `game.endSlice()` (the "To be continued" card; no scene reaches it
  any more: scene 9 ends on its own THE END card).
- **The title** has BEGIN, CONTINUE (only when a save exists) and CHAPTERS, a
  key line (`WASD walk · mouse look · E use · F smoke · M sound · ESC pause`)
  and a sound hint. Every choice waits for the pointer lock (the title's click
  is the gesture the browser needs); if the browser refuses it, the card says
  "click again to take the mouse" and the next click carries the choice out.
  - **BEGIN**: `game.start(null)`: flags and inventory emptied, scene 1 from
    black over 2.5 s under card I.
  - **CONTINUE**: `game.start(save)`: the save's scene and beat, its flags and
    inventory, from black over 1.6 s under the card.
  - **CHAPTERS** (`hud.setChapters(ORDER...)`, main.js `onChapter`): the table
    of contents, nine rows, a row dimmed when its scene has no file (none is
    now). A row starts that scene at its first beat with the save unread and
    flags and inventory empty (scenes 3 to 6 put into the inventory what the
    story would have given by then). Starting a chapter writes a
    save, so it replaces the CONTINUE one.
  - **`?start=<id>[.<beat>]`** (play mode only, not in shot mode): BEGIN
    starts there instead of the diner, with the same empty flags. An unknown
    scene is reported in the errlog and BEGIN plays the diner; an unknown beat
    is reported and the scene starts at its first beat.
    `?start=warehouse.fight` and `?start=watcher.run` start mid-scene;
    `?start=range` is the revolver's test bed (`90_range.js`, not in ORDER).
- **Saves** ([C1] wave C: `v: 2`, a v1 save dropped quietly; seams/Z.md §7) (`game.save`, `localStorage['noir.save']`, `{ v: 1, scene, beat,
  flags, inventory }`): written when a scene is entered (with the beat it was
  entered at, a retry included) and when a beat listed in the scene's `save`
  begins; never in shot mode. A save is a beat's start: a reload puts you at
  the start of the last saved beat. The save lists are in §10.3.
  - Inventory (names as the scenes write them): `matchbook` (scene 2's
    search), `matchbookHalf` (scene 3, the landing), `note` (scene 3; and
    `flags.note = 'HARBOR BLDG. RM 304'`), `ledger` (scene 4). Scene 6's cold
    start adds `tornHalf` (an older spelling of the half) and `revolver`; the
    revolver itself is equipped by scene 5 and held by the hands' set.
  - Flags: `window` (`'B2'` or `'B4'`: which end window Mack went through;
    scenes 3 and 9 leave that window out), `won` (scene 2), `ended` (scene 9),
    `b6taught` (what scene 8 has taught: the crouch, the throw).
- **Failing is soft** (WAVE_B §2): black and back at the beat's start or a
  checkpoint, at most about ten seconds lost; each scene says how in §10.3.

### 10.2 The stages

`game.stages.get(name)` builds a stage the first time it is entered
(`src/stages/index.js` finds every `src/stages/<name>/index.js`); a scene names
its stage (`defineScene({ stage })`), and a scene may enter another from its
own script (`G.enterStage`: scene 6 does). A stage other than the block
declares a `salt` and draws from `root.fork(salt)`, so building it never
touches the block's draws (the golden frames). Every stage with Hoods or a
walking player declares its colliders' bounds (`stage.colliders.setBounds`).

| stage | where | salt | what is in it | scenes | anchors and API worth knowing |
| --- | --- | --- | --- | --- | --- |
| `block` (the avenue, the diner, **the alley part**) | `src/stages/block/`; the alley is `parts/alley.js` (order 200, B1) | root | the wave A street; the alley is a side alley 30 m down the pavement: brick faces (hand-laid canvas texture, fourteen patches of joints), wet flagstones falling to a drain, a plank door (five planks, two straps) in a stone frame with a dry step under a stone hood (a `stage.dry` volume), a drainpipe, the wall lamp (`lamps.addCustom`, a real pool light, with a second light on the step: `alley.stepLight`), a gooseneck lamp on the far block's corner at the mouth, the fire escape on the north wall (landings at 4.15 m and 7.3 m, a drop ladder that slides), bins. Everything of it is **hidden, noRay and collider-free until a scene calls `alley.show(true)`** (the lamp off until `alley.light(true)`): the golden frames stay identical | 1, 2, 3, 9 | `body.step` (the puzzles' table), `body.ladder`, `body.landing`, `block.alley.mouth`, `block.alley.lamp`; the south wall's face is `ALLEY.faceS`; the scene sets `DINER_SIGHT.force = false` while the eye is in the alley (the frustum test sees the diner through the brick); `scenes/body/sight.js` skips what cannot be seen through the mouth (`?nosight=1` turns it off) |
| `office` | `src/stages/office/` (`parts/`: room, lamps, props, rain, sky, train, cars; `build/`: shell, walls, furniture, openings (the blind), frosted, gobo, mats, outside, pad; `plan.js`) | 304 | the Harbor Building's third floor: the corridor with its one globe, room 304, the fire escape outside its side window, and three floors down through the blind the street with the lamp post the watcher stands under. Lit as the diner is: the banker's lamp the one pool, the hotel's floodlight through the slats the second light (slats across the hands too: `build/gobo.js`), everything else falling into ink | 4, 5, 6's first beat | `office.corridor.start`, `office.door`, `office.desk`, `office.safe`, `office.window.street` (a hand from the blind), `office.window.escape`, `office.street.watcher`, `cover.desk`, `fight.*`. The room part is also named `room` (`parts/roomAlias.js`). API: `setDoor`, `swingDoor`, `kickDoor`, `tipDesk`, `swingPicture`, `reset`, `lights.{blind,desk,corridor,post}`, `curtain.{tear,flash}`, `blind.set(i, { tilt, lift, sag, gone })`, `pierce`; sound rooms `office` and `corridor` |
| `backlot` | `src/stages/backlot/` (`parts/`: build, cars, chase, lamps, props, rain, sky, street, train; `plan.js`, `kit.js`) | 4404 | the Harbor Building's fire escape and the run behind it: the side alley (37 m), the back lane with two fences, the washing yard, the dog's passage with its crates, the dead end with its loose board, and a street with two parked cars | 6 (`escape` to `car`) | `plan.js` has the numbers (`STRETCH`, `FENCES`, `LANE`, `GATE`, `PASSAGE`, `BOARD`, `HIS_CAR`, `MY_CAR`); the `chase` part resets a stretch (what he knocked down put back); the yard has a Look of its own (ambient 0.12) with one flood the one light |
| `riverroad` | `src/stages/riverroad/` (`road.js`, `water.js`, `smashKinds.js`; `parts/`: bounds, buildings, cars, el, ground, lamps, market, mist, props, rain, river, sky, smash, track, train) | 7007 | 1.76 km of wet road under and beside the el (the chase is s 14 to 1330), the river behind its railing, warehouses and the market under the el, the freighter, the far bank | 7 | `ROAD.marks` (start 14, train 80, market 400 to 700, truck 862, close 1330, hull 1195, end 1740), `ROAD.checkpoints` `[14, 420, 820, 1200]`; `stage.track` (a car's `s`, `d` on the road); `smash` is what bursts (crates, fruit, barrels, stalls, awnings, fences, the newsstand, hydrants with a geyser); the car's cabin is a sound room (`car`) |
| `pier9` | `src/stages/pier9/` (`site.js`; `parts/`: bay, ground, lamps, mezz, outside, rain, shed, sky, stacks, works) | 909 | the crew's warehouse on a pier: the shed with aisles A to C, stacks, the mezzanine with the Cardinal's lit office, the stairs (west and east), the loading bay, the truck, the hoist and the knife switch; outside, the apron, the freighter. Nine hanging lamps, the switch's caged bulb, the office's desk lamp; it stubs the block's `train`, `cars` and `props` parts (the Game reads them on any stage) | 8 | `pier9.start`, `pier9.door.in/out`, `pier9.office.window`, `.window.in`, `.desk`, `.side`, `.cab`, `pier9.stairs.W/E.foot/top`, and the second fist fight's ring: `pier9.bay.centre` (`r` 2.4), `pier9.bay.finish.1` and `.2` (the two plank loading doors), `pier9.bay.door`, `.out`, `.foreman`, `pier9.bay.reach.*`; the stage's own lamp list for the street's mirror (`PierLamps.mirror`); sound room `warehouse` |

The block is also changed in three small places, all marked: the near
building's side quoin (`world/Facade.js`, R2-G: it stood 8 cm into the
alley), `parts/dinerFront.js` (the street door stays shut while `door.shut`,
B8), and `world/Cars.js` (two added exports, `sedanTemplate(lo)` [B5] and
`sedanTemplates()` [B4], the sedan's builds for a stage that places its own
cars).

### 10.3 The scenes, their beats and their save points

Every beat has a `setup`, so `?scene=<id>&beat=<beat>` renders it and a script
runs from any beat (`ctx.at(b)`). **Saves**: the scene's entry beat, then the
beats named in `save`. The notes say what ends the scene, how failing works,
and what the hands and the weapon are.

| scene | file, stage | beats | saves (besides the entry) | ends with | failing |
| --- | --- | --- | --- | --- | --- |
| I `diner` | `01_diner.js`, block | settle, order, drink, pay | order, drink, pay | the pay beat's line, then a cut into scene 2's `start` (`scenes.go('fight', { beat: 'start', fade: 'cut', card: false, keep: true })`) | none |
| II `fight` | `02_fight.js` + `fight/start.js`, block | start, lesson, round1, round2, round3, reel, ko, outside, matchbook | lesson, round1, round2, round3, outside | the matchbook pocketed: `ctx.next()` | going down is black, and up again in the same manner with 60 hit points (100 from the third down in it; FIGHT.md §8) |
| ~~III `body`~~ (cut in wave C) | `_body_cut.js` (parked) + `body/*`, block | approach, body, strings, landing, halves, note, leave | body, landing, note | walking out of the alley's mouth, or 24 s standing at the end: `ctx.next()` | none |
| IV `office` | `04_office.js` + `office/*`, office | corridor, room, pad, safe, ledger | room, pad, safe, ledger | the ledger put away: `ctx.next({ fade: 'cut', keep: true, card: true })`, the same room, card V | none |
| V `gunfight` | `05_gunfight.js` + `office/fight.js`, office | shadows, door, window, quiet | (shadows) | the quiet's 3.2 s: `ctx.next()` | down: 0.9 s fall, black, back at `shadows` with the door already shut, the desk over if I had tipped it, the door going in about 3 s after the black lifts |
| VI `watcher` | `06_watcher.js` + `watcher/*`, office then backlot | seen, escape, run, car | escape, run, car | E at my coupe's door: `ctx.next()` | "Lost him." (30 m behind, or 6 s with no line to his head or chest): black 0.35 s, back at the start of that stretch, him 15 m ahead (10 m in the yard) |
| VII `tail` | `07_tail.js` + `tail/*`, riverroad | start, chase, close, shot, crash, interrogate | chase, close | "Pier nine.": `ctx.next()` | he gets 90 m ahead for 5 s ("Lost him."), or the car into the truck: black, back at the last of the four marks, about 5 s lost |
| VIII `warehouse` | `08_warehouse.js` + `warehouse/*`, pier9 | arrive, floor, lamps, aisle, stairs, listen, out, fight, ko, after | floor, lamps, aisle, stairs, listen, out, fight | out on the pier past the bay's side door: `ctx.next()` | caught: the whistle, the cosh from behind 1.7 s later, black, back at the last checkpoint (the door, the pocket at the cross aisle, the second stack, the stairs, the window, the catwalk) with the room as it was; the fist fight has the brawl's own rule |
| IX `shootout` | `09_shootout.js` + `shootout/*`, block | arrive, cars, doorways, el, driveby, cardinal, end | cars, doorways, el, driveby, cardinal | the end card, THE END (`hud.endKind = 'cont'`: its click goes to the title) | down: 0.9 s fall, black, back at the beat, my ammunition and the lights as they were; each death makes that beat's men shoot a fifth worse (down to 0.55 of their aim) |
| `range` | `90_range.js`, block | ready, fight, done | | its own end card | a test bed outside ORDER |

What each scene is, in a paragraph (the keys are the README's):

- **III The Body.** The block's alley. `approach` (a crew car out of the alley's
  mouth on its own rail, his hat in the kerb, the el train), `body` (E kneel,
  then E at what I look at: the wounds, his hand (the wet paper comes away into
  my fingers), the two marks), `strings` (puzzle A: the mouse carries a string's
  free end through each wound on the plane of the shots, my right hand
  pinching it; they cross at the landing), `landing` (E pull the drop ladder
  down, W climbs, E takes the torn half), `halves` and `note` (puzzles B and C
  on the dry step: LMB slides, the wheel or RMB turns; a piece within 8 mm and
  12 degrees pulls home; the note is seven wet pieces and reads HARBOR BLDG.
  RM 304), `leave`. Hands are solved onto each thing (`body/hands.js`).
- **IV Room 304.** `corridor`, `room`, `pad` (hold LMB and rub the pencil's side
  across the sheet: R 36 / L 12 / R 57 come up white, 42 % of each figure to
  count), `safe` (the picture swings on its wire; the mouse turns the dial by
  feel, a click at the right number; E the handle), `ledger` (E take, held up
  and opened: CARDINAL CLUB, PIER 9 - DOCK, the black bird). The pad and the
  safe are puzzles of the scene's own (`office/pad.js`, `office/safe.js`), not
  `game.puzzles`.
- **V The Door.** The revolver is drawn at `shadows`; E tips the desk (cover:
  down behind its edge a man's aim falls to about a fifth) and C ducks; six men
  in all (the kicker, the glass man, a doorway man, the Tommy gunner on the
  fire escape, then another doorway man and a heavy) by the brain `office`
  (`src/enemies/brains/office.js`); their outlines are drawn on the frosted
  glass and the curtain from their real joints. No music.
- **VI The Watcher.** `seen` in room 304 (E look out: two fingers part the
  office blind's slats: bendable copies of three of them while they are parted,
  `watcher/office.js`), E the fire escape (out under the raised sash, a cut on
  its black to the backlot's window), `escape` (the escape mode on the iron
  and the ladder), `run` (five stretches: the straight, the fences with SPACE
  to vault, the washing, the dog and the crates, the dead end), `car` (his sedan
  away on its rail; my coupe, B5's, at the kerb under its lamp). He runs a
  polyline at a speed that keeps him 9 to 22 m ahead (`watcher/chase.js`).
- **VII The Tail.** My coupe, the wheel in my hands (the drive mode). He is
  the same man, B4's `watcher` kind, in his sedan on the same physics, held on a
  rubber band 25 to 60 m ahead, closer as the scene goes on (`tail/driver.js`). The road's events: the train
  on the el's near track (s 80), the market, a truck out of a side street
  (stopped at the crown so one lane is open), headlamps the other way, the
  newsstand. RMB aims out of the window, LMB fires (B3's prop in the left hand);
  his rear tyre goes (a mercy tyre near the road's end); the spin into a lamp
  post; E get out; E take him (`hold` mode, the lapels set); the one question is
  asked with a look at the river; "Pier nine."
- **VIII Pier Nine.** The stealth is `warehouse/crew.js` (six men: four dock
  hands and two Hoods, each a light) and `warehouse/stealth.js` (me: the
  `sneak` mode, the hands printed by the light on me, footfalls to their ears);
  the foreman's fight is `warehouse/fight.js` on the brawl's rules (below).
- **IX The Block.** The diner under attack. `arrive` (Dot lays the Tommy gun and
  two drums; E takes it; E the light switch), `cars` (two sedans on rails,
  their lamps through the glass, six men climb out of the doors), `doorways`,
  `el` (a gunman at the rail, onto the car's roof), `driveby`, `cardinal` (a
  quiet, the saloon, two heavies, him: 24 wounds), `end` (his hat in the wet
  street, the cigar's ember, the el train going away along the deck; the card).
  The rig is `shootout/rig.js` (rails, cars, men, `mercy()`), the site numbers
  `shootout/site.js`; from the doorways on `G.director.level` is 5 so three men
  may fire at once, and `G.b7` is the scene's rig (both cleared at teardown).

### 10.4 The systems wave B added

**Controller modes** (`src/player/modes/*.js`, seams/X.md X1; each file
`{ name, enter, step, exit?, mouse? }`; the built-ins stay `walk seated brawl
table cutscene`):

| mode | for | keys |
| --- | --- | --- |
| `brawlIn` (B8) | scene 2's way in: the eye is carried by the scene, the look free within 0.3 rad | mouse |
| `climb` (B1) | the fire escape's drop ladder | W up, S down (S held a quarter second at the foot steps off), no momentum |
| `escape` (B4) | down the fire escape on a rail of landings and flights (3.3 m/s level, 2.9 on stairs) | W goes, S holds, the mouse looks within 80 degrees |
| `run` (B4) | the chase: 7.5 m/s with no key held for speed, the lens opens 5.5 degrees, fists pump | W, A / D, mouse steers, SPACE vaults a fence (taught once) or hops a crate |
| `office` (B2) | a room where men shoot: walk a little slower, a crouch to 0.95 m | WASD, C toggles the duck, Ctrl ducks while held |
| `drive` (B5) | the driver's seat of a car in `game.vehicles`: the lens 58 degrees at rest, 67 flat out; the head leans out of the window to aim | W throttle, S brake then reverse, A / D, mouse looks a little, RMB aims |
| `hold` (B5) | holding a man by his lapels; the look is the question | mouse |
| `sneak` (B6) | the dark: walk 3.1 m/s, crouch-walk 2.05, run 5.4 (Shift, standing); the crouch drops the eye 0.62 m | WASD, Shift, C |

**Hands** (`src/player/clips/*.js`, X2: `CLIPS`, `POSES`, `SOCKETS`, `SETS`
merged into `HandRig`'s tables; a file's name replaces a built-in's). New in
wave B: `body`, `drive`, `lapels`, `office`, `pier9`, `revolver`, `run`,
`sneak`, `watcher`, with `diner` and `fight` replacing the first versions. The
sets are `smoke`, `fists`, `tommy`, `empty`, `revolver`, `run`, `sneak`, `drive`,
`lapels`. Two prints came with round 2 (`render/shaders/ink.js` and `idpass.js`,
marked `[R2-B]`): **bare hands print in two hard tones** (the lit plane near
paper, the shadow plane ink, a hard terminator following the form under one
designed key: from above and the upper left), and **leather** (ink class 18,
`glove`: the revolver's, the wheel's and the lapels' gloves, ink with a few
hard paper-white shapes); a cast figure within a stride of the eye prints its
light shapes the same way. A hand is solved onto the thing it touches every
step (object first); `hands.still` poses a hand from a scene.

**Weapons** (`src/player/weapons/*.js`, X3): `revolver` (B3): six rounds, one
per press with the shot in the step that reads the press, 0.3 s between,
a press in the last 0.15 s of the gap is kept, holding does not repeat; 55 a
body hit (two kill a Hood, a heavy takes four), 999 the head; RMB steadies (the
gun rises to the eye's line, the lens narrows 7 degrees, the spread closes to
0.0012 rad; no crosshair); R or a press on an empty cylinder reloads in 1.7 s
(a press during it shuts the cylinder and fires); the draw and `holster()`
0.35 s each; the count is an inked cylinder face (`hud.layer('revolver')`). The
Tommy gun is the built-in `tommy` and fires only while the set is `tommy`
(scene 9). The prop is `buildProp('revolver')` (`props/kinds/revolver.js`),
shared with the tail's window. Scene 8 keeps it in the coat: LMB with nothing
in hand sends the hand to the coat and away. `90_range.js` is its test bed.

**Vehicles** (`src/vehicles/`, `game.vehicles`): `spawn('coupe' | 'sedan' |
'truck', { at, yaw, speed, lights, tail: 'crew' })` returns a `Vehicle`
(arcade physics: 0 to 60 km/h in about 2.4 s, 95 to 100 flat out, the tail
steps out on the wet and comes back, a wall is a glancing scrape that costs
speed once, a column head-on a hard stop and a bounce, `unstick()` pivots a
pinned car). A stage with cars has a `stage.track`. Models are `models.js` (my
coupe with everything the driver sees from his seat, the truck, the sedan's
contact shadow, the crew's tail lamps); a sedan goes through the stage's `Cars`
(a round cracks its glass, breaks a lens, flattens a tyre). A car's `Headlamps`
are two cones in the rain, a lit lens and a pool of light on the wet road (a
car in another car's beams blocks it); only two have a real light, dealt by
`vehicles.dealLights()` from the track's two: the player's car always, the other
to the lit car nearest ahead. Scene 9's cars are the block's car model on rails
of the scene's own (`shootout/rails.js`: dip on the brakes, roll on a swing,
open door leaves, the front wheels steering; their headlamps borrow a plain
lamp-pool spot rather than make a light), not `game.vehicles`.

**Stealth** (scene 8; `warehouse/crew.js`, `warehouse/stealth.js`, the `sneak`
mode, `game.exposure`): a man sees me if his beam is on me, or I stand in a
lamp's light anywhere in front of him, or within 3 m in the dark in front of
him, always with a clear ray (every 0.1 s); walking is heard within 3 m,
running within 8, crouching never; certainty takes at least a second from his
"hm" (1 to 2.5 s by light and distance); calm, curious, search, alarm. A bottle
(E, then hold LMB for the inked arc, let go to throw) or the hoist's crash
sends the nearest two; the knife switch kills aisle B's lamps; E from behind
within 1.7 m knocks a man out and I go down with him. The hands print by the
light on me. `Controller.keepOff` ignores height (a figure on the mezzanine
keeps me off the floor under him in plan).

**Hoods under direction and their brains** (seams/Y.md Y2; `src/enemies/brains/`):
`wake`, `entry`, `run`, `post`, `leash`, `aim`, `hp` on `spawnHood`,
`cast.spawn('hood' | 'heavy')` and `director.spawn`; brains `office` (scene 5),
`b7_el` and `b7_cardinal` (scene 9). A new stage gives the Hoods their bounds,
obstacles and cover tags (`car`, `booth`, `stand`, `crates`, `barrels`,
`column`, `hydrant`, `can`).

**Cast kinds** (`src/cast/kinds/*.js`, Y1; `cast.has(kind)`): `victim` (Ames),
`watcher` (bowler, long pale raincoat, umbrella: soaked dark in the tail),
`tail_trucker` (the question's clips, `tail_*`), `dockhand`, `foreman`,
`cardinal` (homburg, fur-collared coat, cane, cigar; also Dot's gun and
drum clips and the Cardinal's car-out). Clip names are global: each kind
prefixes its own.

**Props** (`src/props/kinds/*.js`, Y3): `body` (hat, shoe, spectacles, casing,
the torn half), `office`, `pier9` (lantern, torch, cargo hook, crate lid, chain
coil, rope), `revolver` (+ `roundsHand`), `tail`.

**Sounds and rooms** (`src/audio/sounds/*.js`, Y4): `body` (also the room
`alley`), `office` (rooms `office` and `corridor`), `pier9` (room
`warehouse`), `revolver`, `tail` (room `car`), `watcher`, `b7_shootout`,
`b8_fight`; with the built-in rooms `street` and `diner`. `audiotest=1` renders
every sound offline (no sound has been heard by a person: every run is muted).

**HUD layers** (`hud.layer(name)`, X4): a scene's own DOM, dropped when the
scene exits (`revolver`, the office's `b2ink` smudge under its prompts, `tail`,
`range`).

**The fist fight as data** (`src/game/Brawl.js`, `BrawlLesson.js`,
`src/cast/brawl/*`, `src/ui/fightCards.js`, `docs/story/FIGHT.md` §10): the rules
name no diner thing. `game.brawl.start({ opponent, room, who, manner, lesson,
... })` takes a **room** (`bounds`, `enter()` / `leave()`, `items()`, `hisItem`,
`things` (its own kinds for `THINGS`), `knockables()`, `hardAt`, `onInto`,
`onBump`, `finishes`, `gift`, `lane`) and a **man** (`who = { name, hp,
manners }`). Two rooms exist: scene 2's `brawlRoom` (`02_fight.js`: the diner,
Mack, 116 hit points, the stools, the counter, the jukebox, the pie case, two
finish windows) and Pier 9's `bayRoom` (`warehouse/fight.js`: the bay, the
foreman with 146, his hook's two blows `FM_ATTACKS`, his manners `FM_MANNERS`
with the hook in his fist and without, the bay's things `FM_THINGS` (hook,
crate lid as a shield, chain, lantern whose oil burns), two plank loading doors
as the finish, the jacket over the barrel, the water below). The rules' shared
extensions for the second room are marked `[R2-E]` (a thing's own reach, a
weapon knocked from his fist, a held shield, a spent thing's fate, an attack
path's `min`). The in-page autoplay (`?shot=r2play&beat=lesson&seed=<n>&style=
<player|fists|things|rough|mash|mashone|mashload|nododge>&t=300`) judges the
rules by play; `window.__b8things`, `?shot=b8duel`, `?shot=b9duel` and
`?shot=b9play` are the strips and the Pier 9 fight's own seeded run.

### 10.5 The plays

`node tools/play.mjs tools/plays/<play>.json` drives the real game page in
headless Chrome through the DevTools protocol with **trusted** input (the
same path as a player's keyboard and mouse); steps are in the tool's header
(`wait`, `key`, `down`/`up`, `mouse`, `look`, `until`, `shot`, `expect`, `eval`,
`walk`, `clickOn`, `reload`, and the scene drivers `shoot` [B2], `drive` with an
object [B5] or a module path [B7], `fight` [B8]). Each play opens
`/?mute=1&start=<scene>` (or the title) and clicks BEGIN; because a click that
lands while the page is busy can lose its pointer lock, the plays click
again a few seconds later or re-click until `taken` is true. A play ends with
the `#errlog` contents (a non-empty log is a fail) and exits 1 on any fail.
`NOIR_PORT` picks the dev server. One Chrome at a time.

| play | starts at | covers | last reported |
| --- | --- | --- | --- |
| `slice.json` | the title | scenes 1 and 2 by real input to the next chapter's start | 27 of 27 (a loaded machine fails its fight-length window now and then) |
| `fight.json` | `?start=fight` | scene 2 from the way in to the matchbook | 12 of 12, twice |
| `continue.json` | the title | a save at the fight's last blow, a reload, CONTINUE | 6 of 6, twice |
| `autoplay.json` | `?autoplay=1&speed=2` | the in-page autoplayer plays scenes 1 and 2 | 3 of 3, twice |
| `chapters.json` | the title | CHAPTERS opens, a row starts that chapter | 4 checks |
| `body.json` | `?start=body` | scene 3 whole, both table puzzles by LMB / RMB drags | 16 of 16, twice |
| `body_continue.json` | the title | CONTINUE from the body, landing and note saves after a reload | 4 of 4 |
| `office.json` | `?start=office` | scene 4 to scene 5's card | 12 of 12, twice |
| `gunfight.json` | `?start=gunfight` | scene 5 at a human pace (reaction 300 to 560 ms), behind the desk | 7 of 7, twice (one fall in the last overlap) |
| `watcher_good.json` [C6] | `?start=watcher` | chapter V from the window to chapter VI's seat, twice (over the roofs and the market's middle aisle, by Tanner's Row and its west aisle), never lost (`tools/lib/c6_chase.mjs` 'good') | see C6.md |
| `watcher_bad.json` [C6] | `?start=watcher` | a clumsy first-timer: warned, lost, through on a later try | see C6.md |
| `watcher_idle.json`, `watcher_w.json` [C6] | every beat | hands off / W only: warned, then "Lost him.", back at the beat | see C6.md |
| `watcher_missall.json`, `watcher_miss1.json`, `watcher_firsttimer.json`, `watcher_window.json`, `watcher_moves.json` [C6 3rd] | each stretch | every thing missed (warned or lost); one thing missed (never lost); SPACE by reflex, the cards obeyed; the window's first frame and clock; small moves | see C6.md |
| `watcher_seam.json`, `watcher_jank.json` [C6] | `?start=watcher.car`, `scene=watcher&beat=car` | the cut into the coupe's seat measured; walking into the chase's walls, fences, doors, cars | see C6.md |
| `tail.json` | `?start=tail` | scene 7 to chapter VIII's start | 4 of 4, twice |
| `warehouse.json` | `?start=warehouse` | scene 8 whole: the stealth by the men's rounds, the switch and a bottle, the order, the fight, out to IX | 34 of 34, twice |
| `warehouse_caught.json` | `?start=warehouse.floor` | seen in the door's pool, the cosh, back at the door | 10 of 10 |
| `warehouse_takedown.json` | `?start=warehouse.lamps` | the blow from behind | 7 of 7 |
| `pier_fight.json` | `?start=warehouse.fight` | the foreman and the way out | 9 of 9, twice |
| `shootout.json` | `?start=shootout` | scene 9 by the sure-shot driver (`tools/lib/b7_shootout.mjs`) | 5 of 5, twice |
| `shootout_first.json` | `?start=shootout` | scene 9 by the driver's first-timer profile (slower eyes and hands, wandering sights, attention that follows the view) | its runs are in B7.md |
| `revolver.json` | `?start=range` | draw, steady, six rounds, reload, put away | 11 of 11, twice |

`tools/playtest.mjs` is the older Phase 3 scripted play-through; the plays above
supersede it for the story.

[C1] Wave C: `whole.json`, `saves.json`, `body.json`, `body_continue.json` are
parked under `tools/plays/_wave_b/` (they pass through The Body); `chapters`,
`continue` and `slice` follow the new order; the kit's plays are `kit.json`
(the stills, the objective, a teach card once, a fail) and its three proofs
on the test bed, `kit_idle`, `kit_bad`, `kit_good` (`tools/lib/kit_bot.mjs`),
and `kit_downs` (IV and VIII going down through `game.fail`). A drive module
gets `cursor()` from `play.mjs`: press there, or the view jumps.

### 10.6 The tools and their hygiene

`tools/shot.sh` (a frame: `tools/shot.sh out.png "scene=body&beat=strings&t=3" 1440 900`),
`errors.sh` (the errlog, the frame count, with `audiotest=1` the offline audio
table), `counters.sh`, `golden.py` (`check`, `diff`, `accept`, `add`, `list`; the
renderer is pixel-deterministic, 32 frames in `shots/golden/manifest.txt`),
`strip.py` (a film strip of one motion, `{t}` in the query), `fps.mjs` (real-time
frame rate beside `shot=perf`; `UNCAPPED=1`, `RUNS=n`; it prints the GPU's own
utilisation and flags a run BUSY above 30 %), `evalpage.mjs` and `probe.mjs` (an
expression over `window.__noir`), `waitdom.mjs` (the errlog in real time, for the
audio render), `play.mjs` and `playtest.mjs`, `gaittest.mjs` (the Hoods' gaits,
no browser). All take `NOIR_PORT` (the dev server's; `vite.config.js` reads
`NOIR_PORT` or `PORT`, strict, and gives each port its own dependency cache and
ignores `.claude/`, `shots/` and `docs/` by absolute path, so a server rooted in
a worktree sees its own edits). Port 5173 may belong to another project.

Hygiene, because eight builders on one machine filled its disk with headless
Chrome (19 GB of profiles, then about 200 GB of cache) and ran its keychain
daemon at 100 to 190 % CPU:

- **Every headless Chrome gets a throwaway profile and cache**, removed when it
  ends. The node tools use `/tmp/noir-<tool>-<port>` (about 200 MB each) and
  `tools/lib/profile.mjs`: `sweepProfiles()` at the start removes any
  `/tmp/noir-*` older than 60 minutes (a killed run's), `endChrome()` kills with
  SIGKILL and removes the profile (retrying while Chrome lets go of its files),
  `freePort()` draws a DevTools port the OS says is free from a wide range
  (parallel runs collided), `CHROME_WAIT_STEPS` waits 30 s for DevTools. The
  shell tools (`shot.sh`, `errors.sh`, `counters.sh`) use `mktemp -d
  /tmp/noir-shot-XXXXXX` as `--disk-cache-dir`, removed by a trap.
- **The headless cache sweep** at the end of the shell tools: stale
  `.com.google.Chrome.*` temp files older than 60 minutes in `$TMPDIR`, and
  `scoped_dir*` folders older than 30 minutes under
  `~/Library/Caches/Google/Chrome-headless` and
  `~/Library/Application Support/Google/Chrome-headless` (headless Chrome never
  removes them). Empty `com.google.Chrome.*` folders left by killed Chromes are
  not swept (16 000 of them were seen in `$TMPDIR`).
- **Every tool starts Chrome with `--use-mock-keychain --password-store=basic`**
  (the keychain daemon answered every launch), `--mute-audio` (every headless
  run is muted; a URL you open yourself carries `mute=1`), and on macOS
  `--use-angle=metal`.
- **The hung-capture limit**: `shot.sh` kills a Chrome still running after
  `SHOT_LIMIT` seconds (default 180) with `kill -9` and says so (four hung
  captures once ran nine hours at full CPU); `strip.py` gives each frame 120 s,
  kills its process group and tries once more. **`golden.py` goes through
  `shot.sh`, so it has the limit; `errors.sh`, `counters.sh`, `fps.mjs`,
  `evalpage.mjs`, `probe.mjs`, `waitdom.mjs` and `play.mjs` have none** (a hung
  one needs `kill -9`: it ignores SIGTERM).
- **One headless Chrome at a time.** The GPU is shared; each page draws the whole
  ink pipeline at 1440 x 900. A frame-rate number from a busy GPU means nothing:
  measure `shot=perf` at the same moment and read the ratio. Captures go under
  `shots/` (ignored by git except `shots/golden/`); a lane keeps only the frames
  its report shows.

### 10.7 The seams folders

A lane adds a file to a folder and edits no shared file; every folder is read
with `import.meta.glob` (eager), and a name defined twice, or against a
built-in, throws at load. The contracts are `docs/story/seams/X.md` (the
player's side) and `Y.md` (the world's side).

| folder | a file exports | read by | wave B files |
| --- | --- | --- | --- |
| `src/scenes/*.js` | default `defineScene` | `SceneManager` | `01_` to `09_`, `90_range` (and `order.js`, `_diner_room.js`: no default) |
| `src/stages/*/index.js` | default `{ name, salt?, parts, look? }` | `stages/index.js` | block, office, backlot, riverroad, pier9 |
| `src/stages/<stage>/parts/*.js` | default `{ name, order, tick, build, update }` | the stage's index | the parts in §10.2 |
| `src/player/modes/*.js` | default `{ name, enter, step, exit?, mouse? }` | `Controller` | §10.4 |
| `src/player/clips/*.js` | `CLIPS`, `POSES`, `SOCKETS`, `SETS` | `Hands` | §10.4 |
| `src/player/weapons/*.js` | default `(game) => weapon` | `Weapons` | `revolver` |
| `src/cast/kinds/*.js` | default kind (costume, clips, idle, `onSpawn`) | `costumes.js`, `Cast` | §10.4 |
| `src/enemies/brains/*.js` | default `{ name, create }` | `HoodBrains` | `office`, `b7_el`, `b7_cardinal` |
| `src/props/kinds/*.js` | `SPECS` | `props/index.js` | §10.4 |
| `src/audio/sounds/*.js` | default `(kit) => { sounds, rooms? }` | `Sfx` | §10.4 |
| `src/debug/shots/*.js` | `presets` | `debug/Shots.js` | `B2_office`, `B3_revolver`, `B4_watcher`, `B6_warehouse`, `B8_fight`, `B9_pier`, `R2B_hands`, `R2_diner`, `R2_fight`, `R2_look` |
| `tools/plays/*.json` | a play | `tools/play.mjs` | §10.5 |
| `public/music/<slot>.(mp3\|ogg\|m4a)` | audio | `audio/Music.js` | none yet (`docs/story/MUSIC.md`) |

### 10.8 Shared files wave B touched (each edit marked `// [B<n>]` or `[R2-<x>]`)

`Controller.js` ([B8] one line: the body's turn to him is eased for half a
second after a hop), `Hands.js` / `HandRig.js` (B3's own: the rebuilt hand,
`pose3`, `vmPartIds`, `noGauntlet`, `leather`), `render/shaders/ink.js` and
`idpass.js` ([R2-B]), `props/kinds.js` ([B1] the matchbook's torn back),
`world/Cars.js` and `world/Facade.js` (§10.2), `destruct/Breakables.js` ([B7]
a neon letter's tube) and `destruct/Glass.js` ([R2-F] `ShardField.batchRest`,
off everywhere but scene 9), `game/Brawl.js`, `cast/brawl/brain.js` and
`game/Autoplay.js` ([B8], [R2-E]), `stages/block/parts/dinerFront.js` ([B8]),
`scenes/01_diner.js` (B8: the pay beat hands the room to scene 2),
`tools/play.mjs` (the step additions above) and `tools/plays/slice.json`
(its last checks accept the next chapter's start instead of the old end card).
No lane edited `Game.js`, `Hud.js`, the pipeline or `HoodAI.js` for its scene.

### 10.9 Frame rate, measured and not

The budgets (WAVE_B §2): seven real lights, twelve Hoods, eight other
figures, 60 fps at 1440 x 900. **No lane saw 60 fps on this machine**: the GPU
was shared and 55 to 100 % busy in every run. The ratio against `shot=perf` run
at the same moment is what was kept (fps of the scene's heaviest moment over
perf's; above 1 is lighter than perf): body 1.03 to 1.05 (the approach, 869
draw calls, was the heaviest), office 3.3 (the kick of the door), watcher 1.0
to 1.9 (the yard, the iron, the slit, the car), tail 1.23 (the market at
24 m/s), warehouse about 3 (the fight with the oil burning; the stealth 2.1),
shootout 1.14 (the cars beat, 639 draw calls against perf's 744, after
batching the glass at rest), fist fight 1.10 to 1.11. The alley's mouth is the
one place the block has occlusion (`scenes/body/sight.js`); everywhere else
every shop and room of the block is drawn.

### 10.10 Loose ends the reports left (most felt first)

- Nobody has played the whole story by hand with sound. Difficulty and length
  are tuned against bots: the gunfight (a first-timer who hits half his
  shots will fall in its last overlap), the shootout (a first-timer's driver
  wins in 2.4 to 2.7 minutes, the brief wanted 4 to 6), the fist fights, the
  car's feel and balance (A / D in the market, the rubber band as a leash).
- The look: the table views in scene 3 are mostly paper white; the office
  away from its two lights is an even dark grey; the washing yard's walls and
  the pier's wet ground are the ink's brush grain; the river's far bank is a
  bright fog band; his face stays black under the brim in the tail.
- The hands (R2-B): the revolver's draw comes from under the left arm, not out
  of the coat; the lid in Pier 9's fight is held by its top middle; the sneak
  hands do not take a man's weight; scene 3's hands (the string's pinch, the
  paper pinch, the rung hooks) were last looked at before R2-B's merged.
- The scene seams: a cut between VI and VII (the tail opens on its own stage);
  `?scene=tail&beat=interrogate` entered cold sweeps from the road's start.
- Documents: `reports/wave-b/B8.md` carries its Round 2 section twice (a merge
  artefact), `B2.md` opens with a stray review-frame paragraph, and
  `reports/wave-b/B4_second_pass_uncommitted.patch` was applied in `855abf2` and
  is redundant.
- Sound: `end` is not stopped when the end card is clicked, a CONTINUE in
  scene 9 after `cars` has no `shootout`, `fight` is never cued
  (`docs/story/MUSIC.md`).

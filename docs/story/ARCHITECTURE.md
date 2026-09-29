# NOIR EXTREME: the story engine as built (foundation, passes A and B)

This is the map a lane reads before touching code. `CONTRACTS.md` says what
must exist; this says where it is, what it does today, and how to add to it.
Where the two differ, the difference is listed in `CONTRACTS.md` under
"Deviations" (Foundation, pass B). Stubs are plain but real: they carry the
final name and signature, and they do the simplest thing that lets another
lane test its own work. A lane replaces the stubs in the files it owns
(CONTRACTS §1) and builds against the others' APIs, never their insides.

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
  01_diner.js, 02_fight.js         [L7] STUB scenes 1 and 2 (one file per scene, auto-registered)
  _diner_room.js                   [L7] shared setup of the diner (no default export: not a scene)
src/ui/Hud.js                      [L7] HUD, prompts, subtitles, chapter card, fade, cursor, cards
src/audio/
  Sfx.js                           [L7] procedural sounds, sfx.room(name) (STUB: muffles the rain)
  Music.js                         [L7] game.music: the named slots
src/render/                        [L1] (only L1 edits shaders, Pipeline.js, layers.js)
  Pipeline.js                           the passes; pipeline.setLook (STUB: fog, exposure, screen rain)
  accents.js                            accent / accentMaterial (STUB colours)
  glass.js                              makeGlassMaterial / makeWindowLightMaterial / makeRoomMaterial (STUBS)
  layers.js, shaders/*, textures.js, fog.js, tone.js, uniforms.js
src/player/                        [L2]
  Controller.js                         first person + modes (walk, seated, brawl, table, cutscene)
  Hands.js                              game.player.hands (STUB over the Viewmodel)
  handClips.js                          the hands' clips as data
  Viewmodel.js                          the Tommy gun and gloves (the golden frames' gun)
  Weapon.js                             the Tommy gun's logic
  Weapons.js                            game.player.weapons (front over Weapon.js)
  Health.js                             health and its overlay
src/fx/                            [L3]
  Fx.js                                 the stage's effects (game.fx): particles, decals, flashes, ...
  StoryFx.js                            fx.pour, fx.cig, fx.hit (STUBS)
  React.js                              bullets routed to what they hit
  Particles, Decals, MuzzleFlash, Casings, Impacts, Blood, Explosion, Fire, Steam, GroundMist, fxTextures
src/destruct/                      [L3]
  Glass.js                              stage.glass (STUB: the facade's Phase 3a crack / shatter)
  Breakables.js                         stage.breakables (STUB: a burst of debris)
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
                                        dinerFront 130 (STUB)
  block/parts/diner.js             [L5] the diner's room (STUB), order 140
src/props/index.js                 [L5] buildProp (STUB stand-ins)
src/enemies/                       [L6] Hood, HoodRig, HoodAnim, HoodAI, Nav
src/cast/                          [L6]
  Cast.js                               stage.cast (STUB: every kind is the Hood's figure without a gun)
  Character.js                          the Character API (STUB poses)
  clips.js                              the cast's clips as data
src/vehicles/index.js              [L8] game.vehicles (throws: wave B)
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
                       the viewmodel and the hands' clips; the Tommy gun (only if the
                       hands' set is 'tommy'); the Hoods' AI
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
`cast:down`, `brawl:round`, `brawl:end`, `music:cue`, `cue`. `game.start()`
(the title's click) goes to scene `diner`; `game.restart()` (try again) goes
back to the current scene at its beat. `game.screenOf(v)` -> CSS pixels.
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

**The controller** (`game.controller`). `setMode(name, opts)`, `mode`:
`walk` (today's WASD, exactly as it was), `seated { anchor, yawRange,
pitchRange, lean, eyeY, pitch }`, `brawl { opponent, ring: { x, z, r }, dist,
eyeY }` (+ `controller.slip` metres sideways, `nudge` from the mouse),
`table { pose, fov }` (eased 0.5 s), `cutscene { track(t) -> pose }`;
`ease(pose, s)`, `eyePose()`, `shake(strength, dist)`, `lookLocked`.
`setPose(x, z, yaw, pitch, y)` puts it back in `walk`. A pose is `{ x, y, z,
yaw, pitch, fov? }` with **y the eye's world height**.

**Hands and weapons** (`game.player.hands`, `.weapons`). `hands.equip(set)`
(`tommy` is the gun and gloves as they were; the other sets hide them and
draw no hands yet), `hold(prop, 'L' | 'R')` (the prop moves into the hands'
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
`ko(kind)`. Clip data: `src/cast/clips.js`. The stub figure is an unarmed
Hood (`variant.unarmed`) scaled to the kind's height; a story clip holds a
stand-in pose on the bones (`POSES` in Character.js) for its duration and
fires its marks. The cast's figures cast shadows (`game.shadowFigures()`).

**Props** (`src/props/index.js`). `buildProp(kind, { lod, variant })` ->
Group, origin at the middle of its base; `userData = { kind, variant, size,
grip, rest, inkIds, inkId, accent, fill, setFill, setTilt, setOpen, setTip
}`. Kinds: tumbler, bottle (scotch, rye, gin, beer, ketchup, milk), plate,
cup, saucer, mug, stool, ashtray, cigarette, cigarettePack, lighter,
matchbook (accent crew), wallet, coffeePot, napkinBox, ketchup, sugar, menu,
newspaper, pie, fork, knife. A tumbler's and a scotch bottle's liquid is its
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
neon, crew). Glass and window light materials are stubs in `glass.js`.
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
a default export is not a scene.

**A cast kind.** Add it to `KINDS` in `src/cast/Cast.js` (`{ h: height,
name?, variant }` today; lane 6's costume later), its clips to
`src/cast/clips.js`, its stand-in poses to `POSES` in Character.js.

**A prop.** Add a builder to `SPECS` in `src/props/index.js` returning `{
parts: [[geometry, material key]], size, grip, rest?, liquid?, accent? }`
and its name to `PROP_KINDS`.

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
## 7. The stubs, and who replaces them

| Stub | File | Replaced by |
| --- | --- | --- |
| accent colours (only blood and fire looked at) | src/render/accents.js | L1 |
| setLook (switched, not blended; rain3d, grain, ambient, reflect, haze unused) | src/render/Pipeline.js | L1 |
| makeGlassMaterial, makeWindowLightMaterial (+ userData.sweep), makeRoomMaterial | src/render/glass.js | L1 |
| dry volumes: stored, not read by the rain | stage.dry | L1 |
| Hands: no hands drawn for smoke / fists / empty / revolver / wheel; clips are clocks and marks; held props at a fixed palm | src/player/Hands.js, handClips.js | L2 |
| controller modes (plain: no swivel, footwork, eased mode changes) | src/player/Controller.js | L2 |
| weapons.equip('revolver') (hands set only) | src/player/Weapons.js | L2 (wave B) |
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
| vehicles (throw) | src/vehicles/index.js | L8 (wave B) |

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
shown; `&t=`, `&anim=1`, `&pose=`, `&fov=` work):
```
scene=diner&beat=settle    scene=diner&beat=order    scene=diner&beat=drink    scene=diner&beat=pay
scene=fight&beat=round1    scene=fight&beat=round2   scene=fight&beat=round3
scene=fight&beat=ko        scene=fight&beat=outside  scene=fight&beat=matchbook
scene=diner&beat=settle&puzzle=demo                  (the demo puzzle on the counter)
```

Golden candidates (captured in `shots/check/`, not accepted):
`cand_scene_diner_settle`, `cand_scene_diner_order`,
`cand_scene_fight_round1`, `cand_dinerfront`.

Play (no shot params): the title, click, the diner: seated at the counter;
E moves the stub beats on (light up, scotch, drink x3, pay), then the fight
(E for the next round, E for the last blow), then walk out of the door to
Mack, E to search, E to pocket the matchbook. X stands up off the stool
(walk mode) and sits back down near it. F takes a drag once lit.

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
- Gate: `ALLOW=end,title python3 tools/golden.py check` (the title changed
  only in its prompt line: the key list lost "V camera" in pass A, the
  prompt's blink is frozen in pass B).

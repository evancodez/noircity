# NOIR EXTREME, story pass — CONTRACTS (step 1, written by the art director)

Every lane builds against this document. The foundation step implements each
API below as a **working stub**; a lane then replaces the stub inside the
files it owns. Names and signatures here are binding. If something cannot be
done as written, keep the name, do the nearest thing, and record it under
"Deviations" at the end of this file. Read `docs/story/STORY.md` with it.

---------------------------------------------------------------------------
## 0. Ground rules (all lanes)

1. **Quality lock.** The look is identical or better, never worse.
   `python3 tools/golden.py check` diffs every preset against
   `shots/golden/`. The renderer is deterministic (two captures differ by
   zero pixels), so every changed pixel is a real change. A lane may change
   only the frames its brief lists as intended; anything else blocks the
   merge. Only the art director accepts a new golden.
2. **Ink rules.** Tonal textures are sampled in world space (or the
   figure's / the viewmodel's own frame), never screen space. Far figures
   are black silhouettes. No hatching grids, no halftone, no CG gloss, no
   modelled faces. Nothing prints colour except a registered accent (§9.3).
3. **Determinism.** All game logic runs in the fixed step (1/60 s) and
   takes its time from the step, never from `Date`, `performance.now`,
   `setTimeout`, promises or `Math.random`. Randomness comes from the forked
   `RNG` (`rng.fork(n)`). `?t=` fast-forward and screenshots depend on it.
4. **Procedural only.** No art or sound assets, no new npm dependencies.
   Plain ES modules. Comment the why of a trick, in the code's own voice.
5. **Performance.** 60 fps at 1440x900 with the scene's full cast. No new
   real `THREE.Light` without measuring: every light is paid by every lit
   pixel. Interiors borrow the lamp pool (§2.4). The light count of a stage
   is constant while it is on screen (no recompiles in play).
6. **Ownership.** A lane edits only the files it owns (§1). Need something
   from another lane: use its API here; if the API is missing, add a thin
   adapter in your own files and report it. Never edit a frozen file.
7. **Proof.** A lane is done when its presets (§13) show it, `tools/errors.sh`
   is clean on each, and the golden check shows only its intended changes.
   "It runs" is not done. Look at your own screenshots next to
   `reference/noir_reference.png` and the golden frames, and iterate.

---------------------------------------------------------------------------
## 1. Layout and file ownership

```
src/main.js                      L7   bootstrap, url params, loop
src/game/**                      L7   Game (the engine object), SceneManager, Interact, Inspect,
                                      Puzzles, Director, Brawl, Stealth, Save
src/scenes/**                    L7   one file per story scene (scripts only, no geometry)
src/ui/**                        L7   HUD, cards, prompts, subtitles
src/audio/**                     L7   Sfx, ambience, Music slots
src/render/**                    L1   Pipeline, shaders, textures, layers, accents, glass, look
src/player/**                    L2   Controller (+ modes), Hands (was Viewmodel), weapons, Health
src/fx/**                        L3   particles, decals, flashes, explosions, fire, React
src/destruct/**                  L3   Breakables, Glass
src/world/Cars.js                L3   car damage and the wreck (parked cars)
src/world/** (the rest)          L4   Street, Facade, Overpass, Lamps, Skyline, Props, Train, ...
src/stages/block/**              L4   the block's assembly and exterior parts
  src/stages/block/parts/diner*.js   L5   (exception) the diner interior
  src/stages/block/parts/dinerFront.js L4 the diner's street front (wall, panes, door, sign)
src/stages/alley|road/**         L4   (wave B)
src/stages/office/**             L5   (wave B)
src/stages/warehouse/**          L5 interior, L4 exterior part (wave B)
src/props/**                     L5   the small-object library (§8.1)
src/enemies/**                   L6   Hood, rig, animation, AI, nav
src/cast/**                      L6   every non-Hood character, brawl opponent
src/vehicles/**                  L8   (wave B)
src/debug/shots/L<n>_*.js        each lane its own preset files (auto-registered)

FROZEN (integration agent and art director only):
src/world/World.js (the Stage base), src/debug/Shots.js, src/debug/*.js,
src/util/**, tools/**, docs/**, shots/golden/**, package.json,
vite.config.js, index.html, DESIGN.md, README.md
```

Auto-registration: directories marked "parts" and `src/debug/shots/` and
`src/scenes/` are loaded with `import.meta.glob(..., { eager: true })`, so a
lane adds a file and never edits a shared index.

---------------------------------------------------------------------------
## 2. Game, stages

### 2.1 Game (the engine object; `window.__noir.game`)
```
game.stage            the current Stage (alias game.world: old code keeps working)
game.stages           .get(name) -> Stage (built on first use), .names
game.player           { controller, hands, weapons, health, eye: Vector3 }
game.scenes  game.interact  game.inspect  game.puzzles  game.director
game.cast             the current stage's characters (§6)
game.breakables  game.glass      (§8)
game.exposure         (§10)
game.vehicles         (§11, wave B)
game.hud  game.sfx  game.music  game.save
game.fx  game.rays  game.nav  game.covers  game.react     the current stage's
game.rng  game.time  game.counters
game.on(event, fn) / game.off / game.emit(event, data)
game.pre(dt, t) / game.post(dt, t)     one fixed step, as today
```
Events used across lanes (payload in brackets): `scene:enter {id}`,
`scene:beat {id, beat}`, `scene:exit {id}`, `stage:enter {name}`,
`player:hit {dmg, dir}`, `player:down`, `shot {weapon, hit}`,
`break {kind, pos, by}`, `glass:shatter {pane}`, `car:exploded {car, at}`,
`cast:down {who}`, `brawl:hit {by, kind, power, zone}`, `brawl:round {n}`,
`brawl:end {won}`, `alert {level, at}`, `music:cue {slot}`.

### 2.2 Stage (a place). Today's `World` is the base; the block is a Stage.
```
stage.name
stage.scene: THREE.Scene      stage.U, .tex, .M, .rng, .renderer
stage.colliders: Colliders    walls are real collider boxes; setBounds is only an outer net
stage.solids: Mesh[]          stage.addSolid(mesh) / removeSolid(mesh)  (bullets, line of sight)
stage.lights: LightRegistry   stage.lamps: Lamps (may be empty)
stage.cast: Cast              stage.hoods = the Hoods inside the cast (old name kept)
stage.street                  { addImpact(world,x,z,s), addBlast(...) }; a no-op object indoors
stage.flash, stage.fxLights   pre-allocated lights, as today
stage.surfaceY(x, z) -> y     the walking surface (kerbs, floors, steps)
stage.dry: Box3[]             volumes the rain never enters (§9.2)
stage.look: Look              (§9.1); stage.lookAt(pos) -> Look blended by the volume the eye is in
stage.anchors: Map            named places: stage.anchor('diner.stool.3') -> { pos, yaw, ... }
stage.update(dt, t, camera, pixelHeight)
stage.part(name)              the object a part returned from build()
```
A stage is assembled from **parts**: `src/stages/<stage>/parts/*.js`, each
`export default { name, order, build(stage) -> api }`. Parts are built in
`order`, then the stage collects solids, builds its ray world, nav grid and
cover set. A part registers anchors, colliders, solids, lamps, breakables,
interaction anchors and cast seats; it never reaches into another part.

### 2.3 Stages of the story
`block` (avenue, el, the diner, the side alley), `office`, `alley`, `road`,
`warehouse`. Wave A builds only `block`.

### 2.4 Lamps for every lane
`stage.lamps.addCustom({ head: Vector3, axis: Vector3 (unit, down the beam),
height: m, half: rad, real: true, bulb: Mesh|null, fadeEnd: 0..1,
edgeSoft: 0..1, strength: 1, tag: 'pendant' }) -> lamp`
gives any lane a lamp with the emissive head, the volumetric cone, the
registry entry (rain / smoke / rim / exposure) and a share of the pooled real
SpotLights (nearest lamps win). `lamps.setOn(lamp, on)`,
`lamps.shootOut(lamp, dir)`, `lamp.flicker = { rate, depth }` as today.

---------------------------------------------------------------------------
## 3. Scenes (story beats on a stage)

```
// src/scenes/01_diner.js
export default defineScene({
  id: 'diner', stage: 'block', title: 'I', name: 'The Diner',
  spawn: { anchor: 'diner.stool.player' },
  beats: ['settle', 'order', 'drink', 'pay'],      // named, in order
  *script(ctx) { ... },                            // a generator: the scene
  setup: { order(ctx) { ... }, drink(ctx) { ... } } // jump straight to a beat
});
```
- The script is a **generator coroutine** stepped once per fixed step.
  `yield wait(1.2)`, `yield until(() => cond)`, `yield beat('order')`,
  `yield* ctx.say('Scotch. Neat.')`, `yield* ctx.prompt({...})`,
  `yield* ctx.cast.get('dot').walkTo('counter.serve.3')`. No promises.
- `ctx = { game, stage, player, hands, controller, cast, interact, inspect,
  puzzles, director, hud, sfx, music, save, rng, time }`.
- `game.scenes.go(id, { beat?, fade: 'black' | 'cut', card?: string })`.
  A transition fades to black (0.6 s), builds or enters the stage, places
  the player, shows the chapter card if any, fades in. `scenes.current`.
- **Shot mode**: `?scene=<id>&beat=<name>&t=<s>` builds the stage, runs
  `setup[beat]` (state exactly as if played), steps `t` seconds, freezes.
  With `anim=1` it plays on. `pose=` and `fov=` still override the camera.
  Every beat in STORY.md must be reachable this way. This is how the art
  director judges a scene.
- **Checkpoint**: entering a scene or a beat marked `save: true` writes the
  save (§12.4).

---------------------------------------------------------------------------
## 4. Interaction, inspection, puzzles

### 4.1 Interact
```
interact.add({ id, at: Object3D | Vector3 | () => Vector3, range: 1.6, cone: 0.5 (rad),
               prompt: 'light up', key: 'KeyE', hold: 0 (s),
               when: () => true, onUse(ctx) {} }) -> handle
interact.remove(id | handle)      interact.clear(scope)
```
One prompt at a time: the candidate nearest the centre of the view within
range and cone. Generous cones: never a pixel hunt. The HUD prints
`E  light up` low in the frame in the typewriter face, with a small brush
tick at the object's projected position.

### 4.2 Inspect (an object held up and turned in the hands)
```
inspect.open({ prop: 'matchbook' | Object3D, options?, caption?: string,
               onDone(ctx) {} })
```
The prop is drawn in the hands' scene (inked like the gun), mouse turns it,
wheel brings it closer, E / Esc puts it away. L2 poses the hands; L7 owns
the logic.

### 4.3 Puzzles
```
puzzles.define({ id, table: { anchor, size: [w, d], height }, build(ctx) -> state,
                 input(state, pointer), update(state, dt), solved(state) -> bool,
                 hint(state, level: 1..3), exit(state) })
puzzles.open(id, { onSolved })
```
A puzzle is played on a **table**: the camera eases to look down on a real
surface of the stage (a step under a lamp, a desk blotter). Pieces are real
meshes in the stage, inked by the pipeline. The pointer is a virtual cursor
(mouse deltas under pointer lock) drawn as a small ink cross; LMB drags, RMB
or wheel turns, Esc leaves with progress kept. One clear idea per puzzle; a
minute or two; no fail state; a hint after 40 s without progress (level 1 a
nudge, level 3 nearly the answer).

---------------------------------------------------------------------------
## 5. Encounter director (replaces the wave spawner)

```
director.run(*script(d))                 a generator, like a scene
d.spawn({ who: 'hood' | 'heavy' | castKind, at: anchor | {x, z}, yaw, group: 'a',
          entry: 'walk' | 'run' | 'door' | 'car' | 'el' | 'idle', to?: anchor | {x, z},
          brain: 'cover' | 'rush' | 'hold' | 'sniper' | 'none', variant? }) -> Character
d.car({ path: [anchor...], stop: anchor, riders: [spawn specs], speed })   (wave B)
yield d.wait(s)   yield d.until('dead:a')   yield d.until('alive:a<=1')
yield d.until('zone:diner.door')         yield d.until(() => cond)
d.cue(name, data)                        lights, train, lightning, music
director.alive(group?) -> n              director.stop()
director.legacyWave(n)                   the old wave n, same spawns, same RNG: debug presets only
```
No wave counter, no wave card, no intermission anywhere in the game.

---------------------------------------------------------------------------
## 6. Cast (every figure; L6)

```
cast.spawn(kind, { at: anchor | {x, z}, yaw, variant?, seat?: anchor, group? }) -> Character
cast.get(name) / cast.list / cast.remove(c)
kinds (wave A): 'hood', 'heavy', 'brawler', 'waitress', 'cook', 'oldman',
                'couple_her', 'couple_him', 'docker'
```
A **Character** is a Hood-skeleton figure (same joint names, `bones`,
`pos`, `yaw`, `alive`, `object`, ink slot and brush anchor, LODs, shadow).
```
c.setState(name, fade)         idle, walk, run, sit, sitEat, sitRead, sitDrink, lean,
                               serve, pour, carry, duck, cower, flee, ...
c.play(clip, { fade, hold, onMark: { name: fn } }) -> handle   handle.done
c.clip(name) -> { duration, marks: { contact: 0.40, ... } }     timing is data (§14)
*c.walkTo(anchor | {x, z}, { speed, run })                      a generator for scripts
c.sit(anchor) / c.stand()      c.lookAt(Vector3 | null)         c.face(yaw)
c.hold(prop | null, hand: 'L' | 'R')     attaches a §8.1 prop at the hand bone
c.hit({ dir, power: 0..1, zone: 'head' | 'body', by: 'fist' | 'bottle' | ... })
c.ko(kind)                     a down state that is not death (no blood pool)
c.hp, c.brain                  brains are AI modules; 'none' for scripted figures
```
Faces are never modelled: every kind has a hat, cap or hair that shadows
the face, and the ink keeps the head a dark mass (see `hoodF`).
At most 12 Hoods plus 8 civilians alive on a stage.

---------------------------------------------------------------------------
## 7. The player: controller modes, hands, weapons (L2)

### 7.1 Controller modes
```
controller.setMode(name, opts)      controller.mode
'walk'      today's first person (WASD, sprint, kerbs via stage.surfaceY)
'seated'    { anchor, yawRange: [-2.3, 2.3], pitchRange: [-0.9, 0.7], lean: 0.06 }
'brawl'     { opponent: Character, ring: { centre, radius }, dist: 1.45 }  locked on him;
            the mouse only nudges the view (+-0.12 rad); slips move the eye sideways
'table'     { pose, fov }  the puzzle view (eased in 0.5 s)
'cutscene'  { track(t) -> pose }  the script drives the eye
'drive'     { vehicle }  (wave B)
controller.ease(pose, seconds)       controller.shake(strength, dist)
```
First person only. There is no third-person camera and no player body.

### 7.2 Hands (the viewmodel system, generalised; `game.player.hands`)
One inked pair of hands and forearms (the detective's: dark coat sleeves,
gloves off indoors: bare hands printed light with dark knuckle ticks; gloves
on with the guns), drawn by the viewmodel camera as the gun is today.
```
hands.equip(set, opts)          set: 'tommy' | 'revolver' | 'fists' | 'smoke' | 'empty' | 'wheel'
hands.hold(prop | null, hand)   a §8.1 prop in a hand (glass, bottle, plate, stool, matchbook, ...)
hands.play(clip, { onMark }) -> handle        hands.clip(name) -> { duration, marks }
hands.busy                       true while a clip that blocks input runs
clips (wave A): lightUp, drag, ash, reachGlass, sip, putDown, payWallet,
  guard, jabL, jabR, heavyWind, heavyHit, block, blockHit, slipL, slipR, hurt,
  grab, swingBottle, swingPlate, swingStool, searchBody, showMatchbook,
  tommy reload (fix 2), tommy hold (fix 3)
hands.anchor(name) -> Vector3    world position of 'muzzle', 'cigTip', 'mouth', 'palmR', ...
```

### 7.3 Weapons
`game.player.weapons.equip('tommy' | 'revolver' | 'fists' | null)`,
`.current`, `.fire()`, `.reload()`. Tommy gun as today with fixes 2 and 3.
Revolver (wave B): six rounds, 2.4 shots/s at most, heavy kick, a reload
that thumbs six rounds in.

---------------------------------------------------------------------------
## 8. Props, breakables, glass

### 8.1 The prop library (L5 owns `src/props/**`; everyone calls it)
```
buildProp(kind, { lod: 0 | 1, variant? }) -> Object3D
  .userData = { kind, size: Vector3, grip: Matrix4 (where a hand holds it),
                rest: Matrix4 (how it sits on a surface), inkIds: n, accent?: key }
kinds (wave A): tumbler, bottle, plate, cup, saucer, mug, stool, ashtray,
  cigarette, cigarettePack, lighter, matchbook, wallet, coffeePot, napkinBox,
  ketchup, sugar, menu, newspaper, pie, fork, knife
```
The same builder makes the thing on the counter and the thing in the hand,
so they are the same object. Smooth: lathes, bevels, no facets at 0.4 m.

### 8.2 Breakables (L3)
```
breakables.add(object, { kind: 'bottle' | 'plate' | 'cup' | 'tumbler' | 'stool' | 'table' |
                               'crate' | 'barrel' | 'sign' | 'pipe' | 'lampGlass' | 'jukebox' | ...,
                         hp: 1, mass, solid: true, collider?, onBreak(ctx, how) {} }) -> handle
breakables.hit(handle | object, { point, dir, power, by: 'bullet' | 'fist' | 'body' | 'blast' | 'car' })
breakables.topple(handle, impulse)      knock over without breaking (stools, cans, signs swing)
```
A breakable swaps its intact mesh for its pieces (shards, splinters, staves,
a spill), which fall, bounce, come to rest and stay (capped, oldest go).
Liquids spill and spread. Bullets find breakables through `mesh.userData.
breakable`; `fx/React.js` routes them.

### 8.3 Glass (L3)
```
glass.addPane({ mesh | { centre, normal, w, h }, material?, thick: 0.006,
                lit: false, room?: Object3D, tag }) -> pane
glass.hit(pane, { point, dir, power, by })     1st round: a star crack at the point;
                                               more: the cracks run; then it falls out
glass.shatter(pane, { dir, power })            all of it, now (a body through the window)
pane.state: 'whole' | 'cracked' | 'holed' | 'gone'
```
Cracks are geometry-true: the pane breaks into the pieces the cracks drew,
the pieces fall out of the frame, teeth stay in the putty. Behind a pane
there is a real room with depth (L4 builds rooms behind the street's panes;
the diner is a real room).

---------------------------------------------------------------------------
## 9. Render (L1)

### 9.1 Look (per stage, per volume)
```
Look = { fogDensity, fogColor, exposure, rainOverlay: 0..1 (the screen rain of the ink pass),
         rain3d: 0..1, grain, ambient: 0..1, reflect: 'street' | 'floor' | 'none',
         haze: 0..1 (room smoke lit by cones) }
pipeline.setLook(look)      called every frame with stage.lookAt(eye) (blended across a doorway)
```
The block's exterior Look reproduces today's frame exactly.

### 9.2 Dry volumes
`stage.dry` boxes are passed to the rain, splash and ripple shaders: no
streak, splash or ring is drawn inside one. Seen from inside, rain falls
beyond the glass and runs down it.

### 9.3 Accent registry: the only colours that may print
```
import { accent } from 'src/render/accents.js'
accent(key, { gain: 1 }) -> THREE.Color (linear, scene-referred)
accentMaterial(key, { gain, map, additive }) -> Material
```
| key | prints as | used for | size rule |
| --- | --- | --- | --- |
| `blood` | the reference red #c8102e (exists) | blood | as today |
| `fire` | orange to yellow-white (exists) | fire, blasts | as today |
| `ember` | deep orange point with a hot core | cigarette tip, cigar | under 12 px |
| `flame` | pale yellow tongue, orange edge | lighter, match | under 40 px tall |
| `amber` | rich honey amber, darker than fire, never lifted to flame | scotch in bottle, stream, glass | the liquid only |
| `neon` | cold electric blue, a tube with a tight glow | the DINER sign, its sheen on wet pavement | one sign per frame |
| `crew` | the same red as blood | the Cardinal's red: matchbook, ledger, tail lamps | one object |
Rule of thumb: one or two accents in a frame. A lane never writes a
saturated colour by hand; it asks the registry.

### 9.4 Ink ids (half float: exact to 2048)
| range | owner | meaning |
| --- | --- | --- |
| 0, 1 | | sky / untagged |
| 2 .. 1729 | `allocInkId()` | world surfaces and props (wraps at 1729) |
| 1730 .. 1769 | `allocVmId(n)` | new viewmodel ids: hands, held props, revolver, fists, wheel |
| 1770 .. 1779 | VM_ID0 | the Tommy gun and gloves (unchanged) |
| 1780 .. 1789 | DEBRIS_ID0 | flying chunks (unchanged) |
| 1790 .. 1853 | HOOD_ID0 | figures: all 64 slots are the cast's (the player's old slots 55..63 are freed) |
| 1860 .. 1899 | SKYLINE_ID0 | skyline (unchanged) |
| 1900 .. 2040 | IRON_ID0 | the el's iron (unchanged) |
Figures and cars are written negative (`markFigure`). Only L1 edits shaders
and `layers.js`; a lane that needs a new id class asks for it in its report.

### 9.5 Glass material and rooms
`makeGlassMaterial({ wet: 0..1, side: 'in' | 'out', tint })`: a pane seen
through, with rain beading and running down its outer face, a faint sheen,
drawn so that what is behind it is still inked. `makeRoomMaterial(...)` is
optional help for far windows; near rooms are real geometry.

---------------------------------------------------------------------------
## 10. Light exposure (stealth, wave B; the API exists from the foundation)

```
game.exposure.at(pos: Vector3, { los: true }) -> 0..1
game.exposure.player -> { value, lamp }     sampled at chest and head, smoothed 0.15 s
```
Computed on the CPU from `stage.lights` (position, direction, half angle,
range, intensity, enabled), shadowed by one ray per lamp. A lamp that is
shot out or switched off stops counting. L5 places lamps so that there is
always a dark route; L7 owns the rules (who sees what, how fast).

---------------------------------------------------------------------------
## 11. Vehicles (wave B; L8)

```
vehicles.spawn(kind: 'sedan' | 'coupe' | 'truck', { at, yaw, paint }) -> Vehicle
v.pos, v.yaw, v.speed, v.steer, v.body: Object3D, v.wheels[4] { pos, r, flat }
v.setDriver('player' | { path: Curve, speed(t) } | null)
v.input({ throttle, brake, steer })        v.seat -> { eye: Matrix4, window: Matrix4 }
v.hitTyre(i)   v.on('collide', fn)   v.on('wreck', fn)   v.damage(n)
stage.road = { curve, width, surfaceY(x, z), edge(x, z) -> signed distance }   (L4)
```
Roadside objects are breakables (§8.2) with `by: 'car'`. The player's hands
on the wheel and the revolver out of the window are hands sets (§7.2).

---------------------------------------------------------------------------
## 12. HUD, audio, music, saves (L7)

### 12.1 HUD
Ink-styled DOM, monochrome plus at most one red accent. Prompts (§4.1),
one-line subtitles (`hud.say(text, seconds)`, 42 characters at most),
chapter cards (`hud.card('I', 'The Diner')`), the title, pause and end
cards, health as today in a fight, ammo only while a gun is out. No wave
counter, no kill counter, no objective list.

### 12.2 Sfx
Procedural Web Audio as today. `sfx.play(name, pos, params, opts)`,
`sfx.loop(key, ...)`. New sounds are added to the offline `audioTest` table.
`sfx.room(name)` sets the ambience bed and the reverb send per Look volume:
`street` (today), `diner` (rain on glass, muffled; room tone; fridge hum;
cutlery), and the wave B rooms. Crossing a doorway cross-fades in 0.4 s.

### 12.3 Music slots (the user supplies the jazz)
```
music.cue(slot, { fade: 1.5, diegetic?: { pos, room } })     music.stop(fade)
```
A slot plays `public/music/<slot>.(mp3|ogg|m4a)` if the file exists and is
otherwise silent (the jukebox gives a faint needle hiss so the room knows
it is on). Slots are listed in STORY.md. Diegetic music comes from a point
(the jukebox) through a small-speaker filter.

### 12.4 Saves
`save.write()` at a checkpoint: `{ v: 1, scene, beat, flags, inventory }`
in `localStorage['noir.save']`. The title card offers **continue** when one
exists. `?scene=` never reads or writes the save.

---------------------------------------------------------------------------
## 13. Verification (every lane)

- Own dev server: `NOIR_PORT=518<lane> npm run dev` in your worktree
  (`npm ci` first). All tools read `NOIR_PORT`.
- Goldens: `NOIR_GOLDEN=/Users/evansmac/Downloads/eprojects/noirextreme/shots/golden`
  is tracked in git, so your worktree has its own copy at `shots/golden/`.
- `python3 tools/golden.py check` and read the table; open
  `shots/check/diff_<name>.jpg` for every changed frame and confirm the
  change is one your brief intends.
- `bash tools/errors.sh "<query>"` clean on every preset you add or touch.
- Presets you add live in `src/debug/shots/L<n>_*.js` and are listed in your
  report with the exact query strings.
- Commit on the branch the brief names, in your worktree. Do not push. Do
  not merge. Do not touch `main`.
- Report: what you built, the presets that prove it, the golden table, what
  you could not do, and any contract deviation.

---------------------------------------------------------------------------
## 14. The brawl: shared timing (L2 hands, L6 opponent, L7 rules)

Rules read the numbers from the clips (`clip().marks`), so art can retime
without breaking the fight. These are the starting values (seconds).

| Player clip | total | marks |
| --- | --- | --- |
| `jabL`, `jabR` | 0.24 | contact 0.09 |
| `heavyWind` | hold 0.25 .. 0.7 | charged 0.25 |
| `heavyHit` | 0.5 | contact 0.12 |
| `block` | up in 0.1, held | |
| `slipL`, `slipR` | 0.42 | safe 0.05 .. 0.30 |
| `grab` | 0.3 | taken 0.2 |
| `swingBottle`, `swingPlate` | 0.45 | contact 0.2 |
| `swingStool` | 0.8 | contact 0.45 |

| Opponent clip | total | marks | answer |
| --- | --- | --- | --- |
| `br_jab` | 0.7 | tell 0.0, contact 0.38 | block |
| `br_hook` | 1.0 | tell 0.0, contact 0.62 | slip away from the hand, or block (chip damage) |
| `br_haymaker` | 1.4 | tell 0.0, contact 0.95 | slip; blocking it staggers me |
| `br_bottle` | 1.2 | tell 0.0, contact 0.75 | block breaks the bottle; slip |
| `br_hitHeadL/R`, `br_hitBody` | 0.35 | | |
| `br_stun` | 1.3 | open 0.1 .. 1.2 | my combo window |
| `br_into_stools`, `br_into_jukebox`, `br_into_piecase` | 1.6 | impact 0.5 | thrown by a heavy hit near them |
| `br_ko_window` | 2.2 | glass 0.55 | the end |

A tell is readable in silhouette at a glance: the shoulder drops and the
elbow goes back (hook), both hands go up and back (haymaker), the bottle
comes up beside the cap (bottle). The HUD never says what to press after the
first round.

---------------------------------------------------------------------------
## 15. Site plan: the diner on the block

Street axes as in `src/world/Street.js`: the avenue runs along z, -z is down
the avenue; the left building line is x = -10.2; the left pavement runs
from x = -10.2 to the kerb at x = -6.0 at y = 0.15.

The near stone building (x from -26.2 to -10.2, z from -24 to 40) has a
pilaster every 4.4 m. The diner takes the four ground-floor bays between
the pilasters at z = 11.6 and z = -6.0. Every existing camera preset stands
at z <= -9 looking down the avenue, so the diner is behind all of them and
no accepted frame changes.

```
All y values are WORLD y. The pavement and the diner's floor are at y = 0.15.

front wall plane        x = -10.2 (outer face), wall 0.25 thick, inner face x = -10.45
interior (clear)        x from -17.0 to -10.45, z from -5.8 to 11.4, floor y = 0.15, ceiling y = 3.55
bays (centre z)         B1 9.4    B2 5.0    B3 0.6 (door)    B4 -3.8 (the end bay: the KO window)
pilasters kept          z = 11.6, 7.2, 2.8, -1.6, -6.0 (0.75 wide)
window opening          3.55 wide, sill y 0.90, head y 3.10, transom band above to 3.40
door (bay B3)           leaf 0.95 x 2.15, hinged at z = 0.12, opens inwards, glazed upper half,
                        recess 0.4 deep; fixed side lights fill the rest of the bay
sign                    DINER in neon tube letters (accent `neon`) on the fascia over B2..B3,
                        letters 0.55 tall, y centre 3.85; the old blade sign stays, unlit
counter                 runs along z from -3.6 to 8.6, front face x = -14.35, top y = 1.20
                        (1.05 above the floor), 0.62 deep; service aisle behind it; back bar
                        against x = -17.0
stools                  9, on the street side of the counter at x = -13.75, every 1.3 m,
                        seat y = 0.92; anchors diner.stool.1 (z = 8.0) .. diner.stool.9 (z = -2.4)
the player's stool      diner.stool.4 (z = 4.1), alias diner.stool.player, facing -x;
                        the seated eye is at y = 1.60 (a man leaning on the counter)
the brawler's stool     diner.stool.6 (z = 1.5)
booths                  4, along the window wall, x from -12.35 to -10.55, in bays B1, B2, B4 and
                        the near half of B3's side light; table top y = 0.90
aisle (the ring)        x from -13.3 to -12.4, z from -5.0 to 10.6; brawl ring centre (-12.85, 1.0);
                        in the brawl the eye is at y = 1.80 (standing)
jukebox                 against the end wall z = -5.8, x = -12.9, facing +z
kitchen hatch           in the back wall x = -17.0, z from 1.0 to 3.4, y from 1.25 to 2.15, lit from behind
pendant lamps           6, over the counter's front edge x = -14.0, at z = 8.0, 5.6, 3.2, 0.8, -1.6, -3.4,
                        head y = 2.60, half angle 0.6; 2 more over the booths in B1 and B4
serve anchors           counter.serve.1..9 behind the counter at x = -15.3, opposite each stool
```
The side alley (scene 3, wave B) is the cross street's mouth: x from -10.2
to -22, z from -24 to -30, a wall lamp at (-12.5, 4.2, -24.3).

---------------------------------------------------------------------------
## Deviations
(the foundation and the lanes record here what differs from the above)

### Foundation, pass A (steps A1 to A5)
- §5 Director: besides `legacyWave(n)` there is `director.legacyWaves(from)`,
  the old wave game chained for the `battle`, `perf` and `end` presets: a
  wave, its last man down plus 2 s, then the old 8 s gap (`director.lull`:
  `game.live` is false, the gun is safed, the Hoods' rounds cannot hit, the
  train hurries off), then the next wave. Debug presets only. Also
  `director.done` (no spawns to come), `director.level` (the legacy wave
  number: 3 fire tokens from 5), `director.begin()`, `director.active`,
  `director.startT` (the fight's start: the storm and train pacing read it).
  `d.spawn` of a cast kind needs `game.cast` (pass B); `entry` sets the
  Hood's first state, `to` walks only a figure with `walkTo`.
- §5: the fire tokens and the lull breaker live in `HoodPacing`
  (`src/enemies/HoodAI.js`, `game.pacing`: `take`, `drop`, `begin`, `shot`,
  `update`).
- §2.2 Stage: added `stage.addAnchor(name, data)`, `stage.addSurface(fn)`
  (`fn(x, z) -> y | undefined`, the last to answer wins), `stage.addLook(box,
  look)` (`lookAt` picks the volume the eye is in, no blending yet: L1),
  `stage.onReflLod(fn)` / `onShadowLod(fn)` (the pipeline's light-build
  hooks), and a part def may carry `update(api, dt, t, camera, pixelHeight)`
  and `tick` (update order; the block keeps the old World.update order).
  A part may read an earlier part's API (steam reads `props.vents`, lamps
  read the overpass's curve), never change it.
- §2.2: `stage.cast` does not exist yet (pass B, B3); `stage.hoods` does.
  `stage.lamps` exists only on a stage with a lamps part: `Lamps` cannot be
  built empty without moving the block's pooled SpotLights in the scene
  graph (a wave B stage needs that refactor, keeping the block's order).
- §2.3 / RNG: the block draws from the root seed; another stage declares a
  `salt` in its `index.js` and draws from `root.fork(salt)`.
- §2.4 `lamps.addCustom`: `bulb` is the caller's own mesh (built and added
  by the part; null for none), the lamp adds the cone, the registry entry and
  the pool share; its cone seed and flicker phase come from RNG fork 42 so
  the block's lamps keep every draw. `lamp.flicker` is still a number as
  today, not `{ rate, depth }`.
- §3 shot mode: `?scene=` defaults to t = 1 s and shows the viewmodel; it
  calls `game.scenes.shot(id, beat)`, which pass B provides (until then the
  page reports "no scene manager").
- §9.4: `allocVmId(n)` wraps inside 1730..1769; `VM_LO` / `VM_HI` (1730,
  1779) are exported from `layers.js`. The block allocates ids 2..83.
- The effects still find the ground with `Street.groundAt(x)` (the street's
  kerb profile): indoors they must use `stage.surfaceY` (L3).
- Golden `title`: its key line no longer lists "V camera" (the key is gone);
  the frame differs only in that line (and the blinking "click to begin",
  whose CSS phase follows the page's load time).

# Wave B seams, the player's side (Builder X)

Each seam is a folder read on its own (`import.meta.glob`, eager). A lane
adds a file there and never edits a shared one. Built-in things stay where
they were; nothing that played before plays differently.

## X1. Controller modes: `src/player/modes/<name>.js`

A file default-exports

```
{ name, enter(ctl, opts, prevPose), step(ctl, dt), exit?(ctl), mouse?(ctl, e) -> true if it took the move }
```

- `controller.setMode(name, opts)` takes any built-in (`walk seated brawl
  table cutscene`) or file mode. It computes the eye's pose, calls the old
  mode's `exit(ctl)` (file modes only), sets `ctl.mode`, `ctl.modeOpts =
  opts`, `modeT = 0`, clears the ease, `vel`, `bobAmp` and `bodyYaw`, then
  calls `enter(ctl, opts, prevPose)`; after that the shared 0.4 s mode-change
  blend (`opts.ease` seconds) and `apply(0)`. `setPose()` (back to walk)
  calls the file mode's `exit` too.
- Every step `apply(dt)` calls `modeStep(dt)`, which calls your `step(ctl,
  dt)` (also with dt = 0 from `setMode` / `setPose`: be safe with it). The
  mode owns `ctl.pos` (the feet, y unused), `ctl.yaw`, `ctl.pitch`,
  `ctl.groundY` (the eye is `groundY + 1.63`); `apply()` then adds the bob
  (`bobPhase`, `bobAmp`), the shake, the hands' `viewFx`, the kick and the
  blend.
- `ctl.walkStep(dt, { speed = 4.0, sprint = 6.8, canSprint = true, input? })`
  is today's walking as one step (WASD or `input { f, s, sprint }`, else the
  autopilot's; the colliders, `keepOff`, the surface, the bob, the
  footfalls). It does not place the camera: `update()` is `walkStep(dt);
  apply(dt)` for `walk`, exactly as before.
- `mouse(ctl, e)` gets each pointer-locked move first; return true to keep
  it from the default look (`yaw -= e.movementX * ctl.sensitivity`, ...).
- A name defined twice (or a built-in's name) throws at load. `'drive'` is
  not a mode until a file adds it (`setMode('drive')` throws "no mode").

```js
// src/player/modes/run.js   (the tail: he runs, Shift or not)
export default { name: 'run',
  enter(ctl, opts) { ctl.runSpeed = opts.speed ?? 6.8; },
  step(ctl, dt) { ctl.walkStep(dt, { speed: ctl.runSpeed, canSprint: false }); },
  exit(ctl) { delete ctl.runSpeed; },
};
```
(`controller.setMode('run', { speed: 6 })`; `setPose()` or
`setMode('walk')` gives walking back. With no `mouse`, the mouse looks as
in walk.)

## X2. Hands data: `src/player/clips/<name>.js`

A file may export any of

```
export const CLIPS   = { name: clipDef }        // as handClips.js: { duration, marks, keys, view?, props?, hold?, blocking?, blend?, brush? }
export const POSES   = { name: poseDef }        // as handPoses.js: { frame, p, f, b, F, e? }
export const SOCKETS = { propKind: socketDef }  // as Hands.js: { bone, p, r | basis }
export const SETS    = { name: setDef }         // as Hands.js: { skin, sleeve, cuff?, R, L, gun?, hidden?, hideAtRest?, brush? }
```

- Merged at load, in file-name order, into the hands' tables: `HAND_CLIPS`
  (exported by Hands.js), `HAND_POSES` itself (so a clip key may name a
  file's pose as a string; a file reading `HAND_POSES.x` at load time sees
  only the built-ins and the files before it), the sockets and the sets.
  `HAND_SETS` is the keys of the merged sets (`hands.equip(name)` checks it).
- A name defined in two files throws at load. A file's name replaces a
  built-in of the same name (that is how `clips/fight.js` and
  `clips/diner.js` replace the first version's clips in `handClips.js`; a
  lane may replace the `revolver` set this way).
- Today's `clips/diner.js` and `clips/fight.js` keep their `DINER_CLIPS` /
  `FIGHT_CLIPS` and add `export { DINER_CLIPS as CLIPS }`.

```js
// src/player/clips/door.js
import { HAND_POSES as HP } from '../handPoses.js';
export const POSES = { knobR: { ...HP.reachR, p: [0.18, -0.2, -0.45] } };
export const CLIPS = { tryDoor: { duration: 0.9, marks: { turn: 0.5 },
  keys: { R: [[0, '@rest'], [0.4, 'knobR', 'out'], [0.9, '@rest']] } } };
```

## X3. Weapons: `src/player/weapons/<name>.js`

A file default-exports a factory, called once when the Game is built:

```
(game) => ({ name, set, equip(), unequip(), trigger(down, pressed), fire() -> bool, reload() -> bool, update(dt, t), ammo, mag })
```

- `set` is the hands' set it puts up (`hands.equip(set)`).
- `game.player.weapons`: `equip(name)` (the old weapon's `unequip()`, the
  hands' set, the new one's `equip()`; `'fists'` and `null` are still
  hands' sets only), `current` (name), `active` (impl or null), `fire()`,
  `reload()` (the active one's), `register(impl)` (at runtime; a name twice
  throws), `get(name)`, `names`.
- Every step (`Game.pre`, where the Tommy gun's update always was),
  `weapons.step(dt, t)` hands the active weapon the left button:
  `trigger(held, pressedThisStep)` (both false while the game is not live
  or an inspection or a puzzle has the mouse), calls `reload()` on R
  pressed this step, then `update(dt, t)`. Real input and the autoplay's
  `game.vin` both count.
- The Tommy gun is the built-in `'tommy'` (in Weapons.js, a wrapper over
  `player/Weapon.js`, which did not move). Its trigger is still the input
  events' and the autopilot's (`game.weapon.trigger`), R still reloads it
  from the keydown handler, and it still steps every step, firing only
  while `hands.set === 'tommy'`. Its `trigger()` is a no-op.
- **The plain revolver** (`weapons/revolver.js`, `REVOLVER` exported): 6
  rounds, one per press, 0.3 s between (a press inside the gap is dropped),
  straight down the view along the Tommy's bullet path
  (`rays.raycastHoods`, then `rays.raycast` and `react.bullet`), 55 a body
  hit (two kill a Hood), 999 the head, `sfx.pistol`, `fx.flash.player` at
  (0.1, -0.09, -0.8) in the eye's frame, `controller.kick(2.2, 1.5, 0.12)`,
  `emit('shot', { weapon: 'revolver', hit })`; R (or a press on an empty
  cylinder) reloads in 1.8 s. No model, no hands (set `'revolver'`: hidden).
  The HUD's ammo readout still shows only for the Tommy gun.

```js
// src/player/weapons/sap.js
export default (game) => ({ name: 'sap', set: 'fists', ammo: Infinity, mag: Infinity,
  equip() {}, unequip() {}, reload() { return false; },
  trigger(down, pressed) { if (pressed) this.fire(); },
  fire() { game.sfx.play('punch'); return true; }, update() {},
});
```

## X4. HUD layers: `game.hud.layer(name)`

```
hud.layer(name) -> HTMLElement     hud.dropLayer(name)     hud.dropLayers()
```

- A `div.layer` (`data-layer=name`) under the HUD root: the whole frame
  (`position: absolute; inset: 0`), `pointer-events: none`, made on the first
  ask and the same element after. Hidden while the title, pause or end card
  is up (`#hud.titled`).
- Every layer is dropped when a scene exits (`scenes.go` / `ctx.next` /
  `scenes.stop`), so a scene makes its own in its setup or script.

```js
// in a scene's script
const L = ctx.hud.layer('tail');
L.innerHTML = '<div class="dist" style="position:absolute;right:40px;top:40px"></div>';
ctx.onStep(() => { L.firstChild.textContent = Math.round(dist()) + ' m'; });
// (gone on its own when the scene ends; ctx.hud.dropLayer('tail') before that)
```

## X5. The order of the story: `src/scenes/order.js`

```
export const ORDER = [{ id, numeral, title }, ...]   // no default export: not a scene
```

diner I The Diner, fight II The Fight, body III The Body, office IV Room
304, gunfight V The Door, watcher VI The Watcher, tail VII The Tail,
warehouse VIII Pier Nine, shootout IX The Block.

- `game.scenes.next(opts)` and `ctx.next(opts)`: `scenes.go` to the next id
  in ORDER after the current scene's that has a scene file (go's opts; by
  default a fade to black and the chapter card); when there is none (or the
  current scene is not in ORDER), `game.endSlice()` (the "to be continued"
  card). `scenes.nextId(id?)` says which. Scene 2 now ends with
  `ctx.next()` (with no scene 3 file it is the card, as before).
- `defineScene` fills `title` (the numeral) and `name` from ORDER unless the
  scene gives its own; the chapter card shows them.
- `?start=<id>[.<beat>]` (play mode only): BEGIN on the title starts at that
  scene (its first beat, or the one named) instead of the diner, no save
  read, no flags, no inventory (CONTINUE still reads the save). An unknown
  scene or beat is reported in the errlog. `tools/play.mjs` can open
  `/?mute=1&start=gunfight` and click `#title .opt[data-k=begin]`.

```js
// src/scenes/05_gunfight.js
import { defineScene, wait } from '../game/script.js';
export default defineScene({ id: 'gunfight', stage: 'block', beats: ['door', 'hall'],
  *script(ctx) { ctx.player.weapons.equip('revolver'); yield wait(1); /* ... */ ctx.next(); },
});   // its card: "V  The Door" from ORDER
```

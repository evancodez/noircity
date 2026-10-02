# The gun kit (lane C2): how a chapter fights with a gun

IV The Door (the office, the revolver), VII Pier Nine's loud pass (a
warehouse, the revolver) and VIII The Block (the diner and the street, the
Tommy gun) are built on this. Read this page and play the test bed
(`?start=guns`, `src/scenes/91_guns.js` on the stage `killhouse`); nothing
else of lane C2 needs reading.

The rules it gives the player (WAVE_C §2): what is solid stops a round,
theirs and mine; thin wood and glass let it through, weaker; wood is chewed
to a gap; a man who has a line on me and time to aim hits me, but he shows
it first (the gun coming up, a glint, a click), and needs a moment more to
see me when I come up out of cover; down behind something, I am safe from
the men in front of it, and someone comes round.

---------------------------------------------------------------------------
## 1. The player: the mode `gun`, the weapons

```js
ctx.controller.setMode('gun', { crouch: false });   // in the beat's setup
ctx.player.weapons.equip('revolver');               // or 'tommy'
```
- **C** toggles the crouch, **Ctrl** holds it: the eye 0.63 m above the floor
  (under a desk on its side, a counter, a crate, a car's wing). Crouched,
  1.7 m/s.
- **RMB crouched**: up over what is in front, only as high as the gun needs
  to clear it (0.15 s up, 0.15 s down on release); at the end of something too
  tall to rise over, a lean out round its side. **RMB standing**: the gun's
  own steady (the revolver's).
- **LMB** fires, **R** reloads (the revolver's cylinder face / the Tommy gun's
  count on the HUD as before).
- `controller.crouchK` (0..1), `riseK` (0..1), `leanK` (-1..1), `crouchOn`.
- The mode `office` (scene 5 of wave B) is untouched: move IV to `gun`.

---------------------------------------------------------------------------
## 2. An encounter: `gunsOf(game)`

```js
import { gunsOf } from '../guns/Guns.js';
const K = gunsOf(ctx.game);
K.end(); K.begin({ to: 'beatName', maxFiring: 2, flankAfter: 7, settleK: 1, dmgK: 1, why: {} });
...
G.on('scene:exit', () => K.end());   // a scene that leaves ends its encounter
```
- `begin` in the beat's **setup** (it runs again on a retry): it builds the
  men's nav grid and cover from the stage as it stands, takes the health's
  death (a fall is the chapter's fail, back at `to`), and steps the director.
- `to`: the beat a fall goes back to. `why`: the fall's reasons in your
  words, by key (`open`, `moving`, `risen`, `cover`, `angle`, `flank`,
  `reload`, `tommy`, `rush`, `default`); the kit picks the key from the
  killing round (`K.why()`).
- **The three numbers a chapter may turn** (everything else is the kit's):
  `maxFiring` (how many fire at once: 2 in a room, 3 in a street), `settleK`
  (x their aim's settle: 1.2 for a first gunfight, never under 0.85), `dmgK`
  (x their damage: 0.8 .. 1.2). And `flankAfter` (s down in one place before
  one of them goes round; 0: never).
- `K.end()` at the scene's exit; `K.active`.
- While an encounter runs the player's revolver and Tommy gun fire through
  the kit (`K.playerRound`): from the muzzle (a gun still behind the cover's
  edge puts its round into the cover), through what is thin.

---------------------------------------------------------------------------
## 3. The place: cover as data

On the stage's meshes (any part; a group's data covers its children):
```js
mesh.userData.cover = { kind: 'wood', hp: 8, name: 'crate' };
```
| kind | a round | for |
| --- | --- | --- |
| `stone` | stops (chips); the default for anything unmarked | walls, floors, a counter's top |
| `steel` | stops (sparks; a car's own damage) | a car's body, a cabinet, a hydrant |
| `wood` | stops, `hp` rounds (a revolver round takes 1.5, any other 1), then **the mesh breaks away** (splinters, a gap) and lets rounds through. Split a piece into sections (each its own mesh) for a gap the size of a board; `section: false` keeps it standing, riddled | a desk, crates, a counter's panels, barrels |
| `thin` | goes through, x0.62 of its force, 2 degrees off | doors, a partition's dado, a table, a bench |
| `glass` | breaks (destruct/Glass.js), goes through, x0.85 | panes, a car's windows (automatic) |

- **The men's cover** is read from the stage's colliders: a box or circle
  tagged `booth`, `crates`, `barrels`, `car`, `stand`, `can`, `hydrant`,
  `column` or `bench` gives cover points round it; `stage.coverCorners =
  [{ x, z }]` adds places beside a doorway or a wall's end (a man stands
  there, the wall between us, and steps into the opening to shoot). A cover
  is judged against the player's place at a standing eye's height: `low` (he
  kneels behind it and rises to shoot) or `tall` (he stands behind it and
  steps out). After the room changes under them (a desk tipped), call
  `K.rebuild()`.
- **Doors**: a part exposes `doors: { NAME: door }` where a door has
  `{ spec: { inside: {x,z}, outside: {x,z} }, centre: Vector3, open(by),
  close(), shut, open01, moving, locked }` (the killhouse's
  `stages/killhouse/door.js` is one: a hinged leaf, a collider along it, a
  frosted light that shows the men behind it, a leaf that stops against a
  body). A door's collider must be zero while the stage is built (the nav
  grid sees the doorway open).
- **Bounds**: `stage.colliders.setBounds(...)` round the ground (the kit's
  nav grid is 0.25 m cells over it: a 1 m doorway is a way through).
- **The floor**: `stage.addSurface`; every gunman stands on `stage.surfaceY`.

---------------------------------------------------------------------------
## 4. The men

```js
K.spawn({ kind: 'pistol', at: { x, z }, way: { steps: [{ door: 'BD' }, { x, z, run: true }, { door: 'A1' }] },
          wait: 1.2, door: 'hold', hp: 100 });
```
- `kind`: **`pistol`** (cover to cover, out to shoot, back; reloads behind
  it; may flank), **`tommy`** (pins: long bursts at where I went down, line or
  no line, chewing my cover; after each burst he changes the drum, out loud,
  2.6 s: my moment), **`rusher`** (the heavy: a head taller, walks at me
  firing bursts, 220 - 280 hit points, stops a moment at each hit; within
  2.4 m he does not miss).
- `at`: where he is before he comes (out of sight: never appearing in view).
  `way.steps`: points walked to (`run: true`) and doors gone through - he
  goes up to the door on his side, opens it (it moves: it is pushed), steps
  through, stands a moment in its frame (0.4 s at the last door: exposed),
  and on. A door with a man in it is waited for. `door: 'hold'`: at the last
  door he does not walk in: he works it from his side (the jamb, the step
  into the opening). `wait`: seconds before he moves; `start(game, hood)`: a
  condition instead.
- Then his brain (`src/enemies/brains/gunman.js`, its numbers in `GUNMAN` at
  the top of the file) reads the room: the cover that hides him from my
  place, a way there by the nav grid, spread round me (not all on one line).
- **The tell and the settle** (the fair rule): the gun comes up (0.26 s, a
  glint, a click), he must see me (0.25 s after I come into his line), then
  settle (0.36 s at 3 m .. 0.85 s at 18 m; x1.4 while I move across his line;
  x1.5 for 1.5 s after a round near him); a settled round at a man standing
  still in the open hits (0.0055 rad); his aim trails a moving target by
  0.2 s. Out of his line, the settle drains (0.6 s).
- **The director** (the kit): at most `maxFiring` shoot at once; when I hold
  one place down for `flankAfter` seconds, the man best placed goes round
  (a run you hear: a scuff and quick heels) to a place that sees me.
- **Deaths**: a dying man slumps where he is: down the wall at his back,
  over the low cover he rose from, onto his knees and his side where there
  is no room; the Hood's own falls only where the body has floor to lie on
  (`src/guns/deaths.js`). The body is then solid for the player (a circle at
  the torso), never in the living men's way.

---------------------------------------------------------------------------
## 5. The teach, the warning, the fail (lane C1's kit)

Call them through `src/guns/kitStub.js` (they pass to C1's `hud.teach`,
`hud.objective`, `hud.warn`, `game.fail` the moment those exist):
```js
import { objective, teach, warn } from '../guns/kitStub.js';
objective(G, 'Hold the room.');
teach(G, 'low', 'get low', { key: 'KeyC', until: () => C.crouchK > 0.6 });
teach(G, 'rise', 'rise and aim', { key: 'Mouse2', until: () => C.riseK > 0.7 });
teach(G, 'reload', 'reload, down behind it', { key: 'KeyR', until: () => W.reloading });
warn(G, 'Get down!');   // and warn(G, null)
```
The fail needs no call: health at zero is the kit's `down()`: the fall
(0.9 s), black, the reason, back at `to`. The warning before it is the
scene's (the test bed's: `Get down!` when hurt with a man on me, `They have
your angle. Move!` when that is so down behind cover, `Stop him!` for the
heavy within 4 m), with the health's own: the ink closing in, the heartbeat,
each hit's splash at the edge it came from.

---------------------------------------------------------------------------
## 6. Bodies: `game.bodies` (for any figure)

```js
const b = G.bodies.add(character, { r: 0.3 });     // a circle that follows it
G.bodies.steer(b, target, { speed: 1.4 })           // -> { x, z, wait }: round the player and the others
G.bodies.free(x, z, 0.3)                            // room here?
G.bodies.path(from, to)                             // the nav grid's way round
G.bodies.remove(b)
```
The player is kept off every body (the colliders); a figure that moves with
`steer` goes round the player and the others and waits where the way is
taken (a doorway with a man in it).

---------------------------------------------------------------------------
## 7. What a chapter must not do

- fudge cover (an aim scale for "behind the desk"): the rays are the cover;
- spawn a man in view; walk a man on marks;
- put a door's collider in the way while the stage builds;
- call `K.begin` in a script after the setup (a retry would not get it);
- leave an encounter running past the scene (`K.end()` on `scene:exit`).

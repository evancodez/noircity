# The gun kit (lane C2): how a chapter fights with a gun

IV The Door (the office, the revolver), VII Pier Nine's loud pass (a
warehouse, the revolver) and VIII The Block (the diner and the street, the
Tommy gun) are built on this. Read this page and play the test bed
(`?start=guns`, `?start=guns.<beat>`, `src/scenes/91_guns.js` on the stage
`killhouse`); nothing else of lane C2 needs reading.

The rules it gives the player (WAVE_C §2): what is solid stops a round,
theirs and mine; thin wood and glass let it through, weaker; wood is chewed
to a gap; a man who has a line on me and time to aim hits me, but he shows
it first (the gun coming up, a glint, a click), and needs a moment more to
see me when I come up out of cover; down behind something, I am safe from
the men in front of it, and someone comes round.

---------------------------------------------------------------------------
## 1. The player: the mode `gun`, the weapons

```js
ctx.controller.setMode('gun', { crouch: false });   // in the beat's setup ({ crouch: true }: starts down)
ctx.player.weapons.equip('revolver');               // or 'tommy'
```
- **C** toggles the crouch, **Ctrl** holds it: the eye 0.64 m above the floor
  (under a desk on its side, a counter, a crate, a car's wing). Crouched,
  1.7 m/s.
- **RMB crouched**: up over what is in front, only as high as the gun needs
  to clear it (0.15 s up, 0.15 s down on release; re-judged every 0.1 s as
  the view turns); at the end of something too tall to rise over, a lean
  out round its side. **RMB standing**: the gun's own steady (the revolver's).
- **LMB** fires, **R** reloads (the revolver's cylinder face / the Tommy gun's
  count on the HUD as before).
- `controller.crouchK` (0..1), `riseK` (0..1), `leanK` (-1..1), `crouchOn`.
- The mode `office` (scene 5 of wave B) is untouched: IV moves to `gun`.
- **Do not edit the page's code while a play runs**: Vite reloads the page.

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
  words, by key; the kit picks the key from the killing round (`K.why()`):

  | key | when | the test bed's words |
  | --- | --- | --- |
  | `rush` | the heavy, within 3.5 m | He walked right up to you. |
  | `reload` | reloading, standing | Reloading in the open. |
  | `flank` | from a flanker, or from behind | Flanked. |
  | `risen` | up over the cover | Up over the cover too long. |
  | `tommy` | a Tommy gun, me down | The Tommy gun chewed through. |
  | `cover` | down, through what I hid behind | Your cover was shot away. |
  | `angle` | down, a man who had my side | They had your angle. |
  | `moving` | moving, standing | Shot in the open. |
  | `open` | standing still | Shot standing in the open. |

- **The difficulty table: the three numbers a chapter may turn**
  (everything else is the kit's):

  | number | what | the test bed | range |
  | --- | --- | --- | --- |
  | `maxFiring` | how many fire at once | 2 (rooms, street) | 2 in a room, 2 - 3 in a street |
  | `settleK` | x their aim's settle | 1 | 1.2 for a first gunfight; never under 0.85 |
  | `dmgK` | x their damage | 1 | 0.8 .. 1.2 |

  And `flankAfter` (s down in one place before one of them goes round; 0:
  never; the test bed: 7 - 9) - a beat's shape, not its difficulty.
- `K.end()` at the scene's exit; `K.active`; `K.events` (the record: raise,
  shot, break, flank, push, seek, down - what the plays read).
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
| `wood` | stops, `hp` rounds (a revolver round takes 1.5, any other 1), then **the mesh breaks away** (splinters, a gap) and lets rounds through. Split a piece into sections (each its own mesh) for a gap the size of a board; `section: false` keeps it standing, riddled | a desk (top boards 11), crates (6), a counter's panels (15), a reception's (14) |
| `thin` | goes through, x0.62 of its force, 2 degrees off | doors, a partition's dado, a table, a bench, a board fence |
| `glass` | breaks (destruct/Glass.js), goes through, x0.85 | panes, a car's windows (automatic); clear glass is seen through, frosted is not |

- **The men's cover** is read from the stage's colliders: a box or circle
  tagged `booth`, `crates`, `barrels`, `car`, `stand`, `can`, `hydrant`,
  `column` or `bench` gives cover points round it; `stage.coverCorners =
  [{ x, z }]` adds places beside a doorway or a wall's end (a man stands
  there, the wall between us, and steps into the opening to shoot). A cover
  is judged against the player's place at a standing eye's height: `low` (he
  kneels behind it and rises to shoot) or `tall` (he stands behind it and
  steps out); where he shoots from is judged again whenever I have moved
  0.8 m. After the room changes under them (a desk tipped), call
  `K.rebuild()`.
- **A car's windows are glass**: a man behind a car can be seen through
  them, and shot through them.
- **Doors**: a part exposes `doors: { NAME: door }` where a door has
  `{ spec: { inside: {x,z}, outside: {x,z} }, centre: Vector3, open(by),
  close(), set(a), shut, open01, moving, locked }` (the killhouse's
  `stages/killhouse/door.js` is one: a hinged leaf, a collider along it, a
  frosted light that shows the men behind it, a leaf that stops against a
  body). A door's collider must be zero while the stage is built (the nav
  grid sees the doorway open). A man on his `way` opens a locked door (he
  has the key); `locked` keeps the player out (a rattle) - lock a door you
  do not want me to go through (the test bed's street locks the street door
  behind me).
- **Bounds**: `stage.colliders.setBounds(...)` round the ground (the kit's
  nav grid is 0.25 m cells over it, inflated 0.3 m: a 1 m doorway is a way
  through). Close a street's ends with something you can see (the test
  bed's board fences).
- **The floor**: `stage.addSurface`; every gunman stands on `stage.surfaceY`.

---------------------------------------------------------------------------
## 4. The men

```js
K.spawn({ kind: 'pistol', at: { x, z }, way: { steps: [{ door: 'BD' }, { x, z, run: true }, { door: 'A1' }] },
          wait: 1.2, door: 'hold' });
K.spawn({ kind: 'tommy', at: { x, z }, cover: true, wait: 2.4 });   // there already, down behind cover
```
- `kind` (numbers in `GUNMAN`, the table at the top of
  `src/enemies/brains/gunman.js`):

  | kind | hp | a round | a time out | his own |
  | --- | --- | --- | --- | --- |
  | **`pistol`** | 100 | 17 | 2 - 3 rounds, 0.4 - 0.52 s apart | 7 in the magazine, reloads behind cover (1.7 s); goes round; pushes |
  | **`tommy`** | 120 | 8 | a burst of 10 - 14 at 10.5/s, climbing | pins: rakes where I went down, line or no line, through what is thin; after each burst he changes the drum where he stands, out loud (2.6 s): my moment |
  | **`rusher`** | 300 | 10 | bursts of 5 - 8 at 9/s, every 1.2 s | the heavy: a head taller, broader; **walks at me with the gun up, aiming and firing on the move**; a hit stops him 0.35 s and halves his settle; he must be answered before he is at my cover |

  The player's guns against them: the revolver 55 a round, the Tommy gun
  52 (body) / 34 (limbs) - two to three rounds a pistol man.
- `at`: where he is before he comes (out of sight: never appearing in view;
  the test bed's street has dark recesses behind the warehouse's openings).
  `way.steps`: points walked to (`run: true`) and doors gone through - he
  goes up to the door on his side, opens it (it moves: it is pushed), steps
  through, stands a moment in its frame (`frame`, 0.4 s at the last door:
  exposed), and on. A door with a man in it is waited for. `door: 'hold'`:
  at the last door he does not walk in: he works it from his side (the
  jamb, the step into the opening; with nothing beside it to work from, he
  goes through). `wait`: seconds before he moves; `start(game, hood)`: a
  condition instead.
- `cover: true` (and no `way`): he is there when the beat opens, down
  behind the cover point nearest `at` (1.3 m), his first time out after
  `wait`. For a fight already on (the test bed's street: three men behind
  the far cars).
- `hp`, `yaw`, `name`, `variant`: as the Hood's.
- Then his brain reads the room: the cover that hides him from my place, a
  way there by the nav grid, spread round me (not all on one line); out
  from it to shoot (a step out, or up over it), two or three rounds, back.
- **The tell and the settle** (the fair rule, the brief's numbers): the gun
  comes up (0.26 s, a glint, a click); he must see me (0.25 s after I come up
  or out into his line; 0.075 s when I am standing in it already); then the
  settle (0.4 s at 3 m .. 0.9 s at 18 m; x1.4 while I move across his line;
  x1.5 for 1.5 s after a round near him or into him); a settled round at a
  man standing still in the open hits (0.0055 rad); his aim trails a moving
  target by 0.2 s. Out of his line, the settle drains (0.6 s). A hit knocks
  a pistol man or a Tommy gunner off his aim and back behind his cover.
- **How they press** (nobody hides out the clock):
  - **together**: when one goes out, the others behind cover go with him
    (two guns on the man who rises to answer);
  - **standing**: me standing in a man's line, he does not wait his turn
    behind his cover (0.3 s);
  - **on the way**: a man in the open on his way, with me standing within
    9 m in his line, stops and shoots (the tell and the settle as ever);
  - **the push**: out from one cover 3 - 5 times with no line on me, he
    goes on to cover nearer me; nothing nearer and no line for 6 s, he
    goes to find a place that sees me;
  - **the seek**: a man with no cover and no line goes to a place that sees
    me, or in at me by the way there is;
  - **the flank** (the director): when I hold one place down for
    `flankAfter` seconds, the man best placed goes round (a run you hear: a
    scuff and quick heels) to a place that sees me, off the others' line;
    the last man alive goes round too (after 1.5 x `flankAfter`), Tommy gun
    or not.
- **The director** (the kit): at most `maxFiring` pistol men shoot at once;
  the Tommy gunner and the heavy fire whatever the count (they count
  against the pistol men while they do).
- **Deaths**: a dying man slumps where he is: down the wall at his back,
  over the low cover he rose from (at its height: a desk, a counter), onto
  his knees and his side where there is no room; the Hood's own falls only
  where the body has floor to lie on (`src/guns/deaths.js`). The body is
  then solid for the player (a circle at the torso, after 1.35 s), never in
  the living men's way.

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
(0.9 s), black (the warning, the objective and the cards go), the reason,
back at `to`. The warning before it is the scene's (the test bed's, in
`91_guns.js`: `Get down!` when hurt with a man on me, `They have your
angle. Move!` when that is so down behind cover, `Your cover won't hold.
Move!` when it is being shot through, `Stop him!` for the heavy within 4 m),
with the health's own: the ink closing in, the heartbeat, each hit's
splash at the edge it came from; the mending starts later and runs slower
while any man has a line on me.

---------------------------------------------------------------------------
## 6. Bodies: `game.bodies` (for any figure)

```js
const b = G.bodies.add(character, { r: 0.3 });     // a circle that follows it (character.pos)
G.bodies.steer(b, target, { speed: 1.4 })           // -> { x, z, wait }: round the player and the others
G.bodies.free(x, z, 0.3)                            // room here?
G.bodies.path(from, to)                             // the nav grid's way round
G.bodies.remove(b)
```
The player is kept off every body (the colliders); a figure that moves with
`steer` goes round the player and the others and waits where the way is
taken (a doorway with a man in it). The Game updates the circles each step;
a new stage drops the old stage's bodies.

---------------------------------------------------------------------------
## 7. The test bed's beats (examples to copy)

| beat | what it asks | the men |
| --- | --- | --- |
| `ready` | the teach: tip the desk (E), low (C), rise (RMB), two bottles, reload (R) down | none |
| `door` | the exposure of a doorway | two pistol men through one door, working it |
| `two_ways` | watch two ways: the flank | two through one door, one through the other |
| `pin` | wait out the burst, rise on the drum | a Tommy gunner working the glazed door, a pistol man |
| `rush` | answer the heavy at once | the heavy in at the street door, a pistol man later |
| `street` | cover to cover (Tommy gun) | three behind the far cars, one out of the loading door |
| `street_rev` | the same, with the revolver | the same |

Each beat's `spots` are its cover places for the plays; `open` (the
street's) is where the play that stands in the open stands.

---------------------------------------------------------------------------
## 8. What a chapter must not do

- fudge cover (an aim scale for "behind the desk"): the rays are the cover;
- spawn a man in view (except `cover: true` at a beat's opening, there from
  the first frame); walk a man on marks;
- put a door's collider in the way while the stage builds;
- call `K.begin` in a script after the setup (a retry would not get it);
- leave an encounter running past the scene (`K.end()` on `scene:exit`).

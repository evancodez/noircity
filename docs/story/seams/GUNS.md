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
ctx.controller.setPose(x, z, yaw, pitch);           // (setPose puts the controller back in 'walk':
ctx.controller.setMode('gun', { crouch: false });   //  the mode after it) ({ crouch: true }: starts down)
ctx.player.weapons.equip('revolver');               // or 'tommy'
```
- **C** toggles the crouch, **Ctrl** holds it: the eye 0.64 m above the floor
  (under a desk on its side, a counter, a crate, a car's wing). Crouched,
  1.7 m/s.
- **RMB crouched**: up over what is in front (anything within 2.4 m of the
  eye along the view: a desk on its side seen through its knee space is
  still the desk), only as high as the gun needs to clear it (0.15 s up,
  0.15 s down on release; re-judged every 0.1 s as the view turns); at the
  end of something too tall to rise over (a jamb, a wall's end, anything
  over a standing eye), a lean out round its side, 0.46 m, where the view's
  own line is clear past the edge for 1.3 m. Under about 1.4 m
  is risen over, not leaned round. **RMB standing**: the gun's own steady
  (the revolver's).
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
K.end(); K.begin({ to: 'beatName', maxFiring: 2, flankAfter: 7, settleK: 1, dmgK: 1, why: {}, area: null });
...
G.on('scene:exit', () => K.end());   // a scene that leaves ends its encounter
```
- `begin` in the beat's **setup** (it runs again on a retry): it builds the
  men's nav grid and cover from the stage as it stands, takes the health's
  death (a fall is the chapter's fail, back at `to`), and steps the director.
- `area` (`{ x0, x1, z0, z1 }`, optional): the place the fight is in - the
  men take no cover outside it (the test bed's lobby fight keeps them off the
  pavement outside the street door). Nothing of one `begin`'s numbers carries
  into the next.
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
- **The fire tokens are room for the player who fights from cover**: at
  most `maxFiring` pistol men shoot at once while I am down or risen over
  something; a man standing up (crouch under half) is every man's to shoot -
  stand and trade in the open and they all come out at once.

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
  `{ spec: { inside: {x,z}, outside: {x,z}, swing }, centre: Vector3, open(by),
  close(), set(a), rattle(), shut, open01, moving, locked, col, live, apply(),
  openBox() }` (the killhouse's
  `stages/killhouse/door.js` is one: a hinged leaf, a collider along it, a
  frosted light that shows the men behind it, a leaf that stops against a
  body). A door's collider must be zero while the stage is built. **The men's
  grid** (`Covers.rebuild`, at `begin`) has every door that may open **as it
  stands fully open** (`openBox()`: the leaf into the room is a thing to go
  round, the doorway a way through), the dead out of it, and a **locked**
  door shut (nobody paths through it). Any man whose path crosses a shut
  door reaches for it a step off, it swings (pushed or pulled - a leaf that
  swings at him: a step back out of its sweep first), he goes through; a
  locked one rattles and he goes another way; a way that will not open in
  12 s is given up. **The player's E** (the test bed's `doorPoint` in
  `91_guns.js`: copy it): the use point is where on the doorway the view's
  line meets it (knee to head height, inside its width), so a man up against
  a door, looking at its panel or its knob, gets the prompt; range 1.7 m. A
  door that swings toward me as I open it does not stop ajar against me: it
  is pulled open and I give way before it (slower, `door.shove`), and only
  where there is room behind me (against a wall it stops); a door stopped
  ajar (against a man) is opened on by E, not shut. A man on his `way` opens a locked door (he has the key:
  the grid is built again through it); `locked` keeps the player out (a
  rattle) - lock a door you
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
  | **`tommy`** | 120 | 8 | a burst of 10 - 14 at 10.5/s, wide (0.02 rad) and climbing (0.005 a round) | pins: rakes where I went down, line or no line, chewing what I hide behind and through what is thin; after each burst he changes the drum where he stands, out loud (2.6 s): my moment |
  | **`rusher`** | 250 | 10 | bursts of 4 - 6 at 9/s, every 1.5 s | the heavy: a head taller, broader; **walks at me with the gun up, aiming and firing on the move**; a hit stops him 0.45 s and halves his settle; five revolver rounds; he must be answered before he is at my cover |

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
  or out into his line; 0.075 s when I am standing in it already; **0.45 s
  more when he has me from off my screen** - a flank, a door at my back: the
  time to turn, with the warning `Behind you!`); then the settle (0.4 s at
  3 m .. 0.9 s at 18 m; x1.4 while I move across his line; x0.6 while I
  stand up still in it - a man standing in the open is an easy mark; x1.5
  for 1.5 s after a round near him or into him); a settled round at a man
  standing still in the open hits (0.0055 rad); his aim trails a moving
  target by 0.2 s. Out of his line, the settle drains (0.6 s) - whatever he
  is doing: behind his cover too (out again, he settles again). The star of
  the glint shows on the barrel when it is up (0.75 of the raise), with the
  click or the bolt as it starts.
- **A hit is a flinch**, not a knock-out: the body jerks a step off it
  (`Hood.flinch`), his settle is halved and does not grow for 0.18 s; a man
  already firing keeps firing, his next rounds wider for 0.35 s (a Tommy
  gunner's burst climbs). He does not go back behind his cover for it: a
  man who has me standing in the open goes on shooting through it, one who
  loses me goes back as ever. No random stagger for a kit gunman. A pistol
  man whose mark stands up in his line does not go back between bursts:
  two more, at once, the gun still up.
- **Shot at before he is in** (a round into him or past him while he is on
  his `way`, or waiting to start): he does not walk on into it - the gun up
  if he has me, the Tommy gunner rakes where the shot came from (aimed: he
  saw the flash), else the nearest cover. A round into a Tommy gunner from
  where he could not see me tells him where I am.
- **His gun at a jamb or over a car**: the place he shoots from needs a
  clear line for a gun hand as well as his eyes; a round from a gun still
  behind the edge while his eyes have me is laid from his sight line, not
  into the wall beside him.
- **He does not shoot through his mate** (he holds the round); a stray one
  into a mate does what it would do to me.
- **How they press** (nobody hides out the clock):
  - **together**: when one goes out, the others behind cover go with him
    (two guns on the man who rises to answer);
  - **standing**: me standing in a man's line, he does not wait his turn
    behind his cover (0.3 s); the last he saw of me I was standing, he looks
    out again in 0.6 - 1.1 s, not 2.5 - 4;
  - **a doorway worked by two**: the first at the jamb waits (up to 4 s) for
    his mate on his way to it, then they go out together;
  - **on the way**: a man in the open on his way, with me standing within
    9 m in his line, stops and shoots (the tell and the settle as ever);
  - **the push**: out from one cover 3 - 5 times with no line on me, he
    goes on to cover nearer me; nothing nearer and no line for 6 s, he
    goes to find a place that sees me;
  - **the last man** with no line on me for 6 s leaves his cover and comes
    to find me (a last man once held a pavement for 40 s): to a place round
    me that sees me, else in at me by the grid's way, stopping where he has
    me (not the Tommy gunner: he pins - he rakes where he last saw me, or
    the flash of my gun, for 12 s after, from cover or from the open, and
    then waits for me to show);
  - **the seek**: a man with no cover and no line goes to a place that sees
    me, or in at me by the way there is; nine seconds without a line, he
    comes straight in (nobody waits the clock out either);
  - **the flank** (the director): when I hold one place down for
    `flankAfter` seconds, the man best placed goes round (a run you hear: a
    scuff and quick heels) to a place that sees me, off the others' line;
    the last man alive goes round too (after 1.5 x `flankAfter`), the Tommy
    gunner only then, and to his own range (6 - 7.5 m). Otherwise the Tommy
    gunner pins: with no line he rakes where he last saw me (or the flash of
    my gun), from cover or from the open; he never comes looking, and takes
    no cover nearer me than 5.5 m.
- **The director** (the kit): at most `maxFiring` pistol men shoot at once
  while I fight from cover (down, or risen over it); standing up, I am every
  man's; the Tommy gunner and the heavy fire whatever the count (they count
  against the pistol men while they do).
- **Deaths**: a dying man slumps where he is: down the wall at his back,
  over the low cover he rose from (at its height: a desk, a counter), onto
  his knees and his side where there is no room; the Hood's own falls only
  where the body has floor to lie on (`src/guns/deaths.js`). The body is
  then solid for the player (a circle at the torso, after 1.35 s), never in
  the living men's way.

---------------------------------------------------------------------------
## 5. The teach, the warning, the fail (lane C1's kit, seams/Z.md)

The kit uses lane C1's lines; a chapter declares its beats' `objectives` in
its `defineScene` (Z.md §1) and the kit gives the rest:
```js
K.teach('crouch');                 // [C] get low        (until: down)
K.teach('rise');                   // [RMB] rise and aim (until: up over it)
K.teach('reload');                 // [R] reload         (until: reloading)
K.teach('crouch', { again: true }); // once more: in a beat failed twice (G.fails(beat) === 2)
ctx.onStep(() => ctx.hud.warn(K.active ? K.warning() : null));   // the warning, every step
```
- **The cards** (`TEACH` in `Guns.js`, ids shared with the rest of the game:
  IV's stand-in gives `crouch` too) are once per save; the scene picks the
  safe second - the test bed: `crouch` as a contest opens (the men are seconds
  away), `rise` the first time I am down, `reload` in the ready beat. A card
  goes when the thing is done; `hud.teach`'s opts pass through.
- **The warning** (`K.warning()`, WAVE_C §1 rule 2), most urgent first:
  `Stop him!` (the heavy within 4.2 m), `Behind you!` (a man has me from off
  my screen), `Tommy gun! Get down!` (a Tommy gunner bringing it up or firing
  at me while I am not down), `Your cover won't hold. Move!` (down, a round
  just came through what I hide behind - or their rounds are chewing the
  last of the wood within 1.6 m of me), `They have your angle. Move!` (down,
  a man who has had me a moment, or has his gun up at me),
  `One's going round on your left.` / `...right.` (a flanker on his way, the
  side as I face), `Get down!` (standing in a man's line and hit in the last
  2.5 s - from the first hit, not only once low - or hurt under 45),
  `Stay down. Let it mend.` (down, hurt, nobody has me). A line stays a
  second unless a more urgent one comes, or the man it is about is down.
  Words in `cfg.warn` by key (`rush`, `behind`, `tommy`, `cover`, `angle`,
  `flankL`, `flankR`, `open`, `mend`). A scene sets no warning once its room
  is won (the test bed: `won`). Over the kit's own low line (`You're hit. Get to
  cover.`); with the kit's rule that no fall comes before a warning has been
  up a second (`Game.spareLast`; a warning that changes its words is one
  warning).
- **The fail needs no call**: health at zero in an encounter is the kit's
  `down()` -> `game.fail({ why: K.why(), to: cfg.to, fall: true })`: the fall,
  black, the reason, back at `to` with the world as its setup makes it
  (`begin` runs again there). Do not also give `onDown` for those beats.
  The low state is the health's own: the ink closing in and the heartbeat
  under 35, each hit's splash a compass of where he is (`splashAt`: ahead at
  the top edge's middle, to a side at that edge, behind at the bottom edge's
  middle - never a corner, where the objective line and the HUD are); the
  mending starts later and runs slower while any man has a line on me.

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
| `door` | the exposure of a doorway | three pistol men through one door: two work it together from its jambs, a third close behind |
| `two_ways` | watch two ways: the flank | two through one door, one through the other |
| `pin` | wait out the burst, rise on the drum | a pistol man working B1 first, then a Tommy gunner (170 hp: four rounds) at the glazed door - two guns at once on a man standing up |
| `rush` | answer the heavy at once | the heavy in at the street door, a pistol man later (the fight's `area` the house; the line changes when the heavy is down) |
| `street` | cover to cover (Tommy gun) | three behind the far cars, one out of the loading door |
| `street_rev` | the same, with the revolver | the same |

Each beat's `spots` are its cover places for the plays; `open` (the
street's) is where the play that stands in the open stands. Each contest
teaches what it needs if it is played cold (`K.teach('crouch')` as it
opens, `rise` the first time I am down: nothing after the ready beat, the
cards are once per save) and gives the crouch card once more in a beat
failed twice.

**The plays** (`tools/plays/guns_*.json`, the driver
`tools/lib/c2_guns.mjs`: copy them for a chapter's own proofs - a profile
is a model of a player, its record says how each try ended, how fast a
fall came, and where the rounds into me came from):

| play | the player | must |
| --- | --- | --- |
| `guns_idle` | does nothing | lose every contest, each warned a second or more, each with its reason |
| `guns_bad` | stands and trades shots in the open (the brief's) | lose most contests, each by a fall with its reason |
| `guns_clumsy` | the first-timer of WAVE_C §7: slow, a wide hand, up too long now and then, reloads standing now and then, late to get down, a wrong key | fail some, get through every contest within three tries |
| `guns_good` | cover, rise, one aimed round, down; reload down; moves on the warning and off a spent spot; watches a man going round; ducks when hit; shoots a shadow on frosted glass | win every contest on the first try, twice in a row |
| `guns_teach` | the ready beat by real input | each card once, the bottles from over the desk, on to `door` |
| `guns_doors` | (a man looking for a way to me, every door shut) | he opens his way through, never through a shut leaf; locked doors hold |
| `guns_walk` | walks into the desk, a man, a body, a shut and a locked door, a wall; leans round a jamb | nothing passes through anything; the lean goes out and back |

---------------------------------------------------------------------------
## 8. What a chapter must not do

- fudge cover (an aim scale for "behind the desk"): the rays are the cover;
- spawn a man in view (except `cover: true` at a beat's opening, there from
  the first frame); walk a man on marks;
- put a door's collider in the way while the stage builds;
- call `K.begin` in a script after the setup (a retry would not get it);
- leave an encounter running past the scene (`K.end()` on `scene:exit`).

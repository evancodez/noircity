# The gun kit (lane C2): how a chapter fights with a gun

IV The Door (the office, the revolver), VII Pier Nine's loud pass (a
warehouse, the revolver) and VIII The Block (the diner and the street, the
Tommy gun) are built on this. Read this page and play the test bed
(`?start=guns`, `?start=guns.<beat>`, `src/scenes/91_guns.js` on the stage
`killhouse`); nothing else of lane C2 needs reading.

The rules it gives the player (WAVE_C §2): what is solid stops a round,
theirs and mine; thin wood and glass let it through, weaker; wood is chewed
to a gap; a man who has a line on me and time to aim hits me, but he shows
it first (the gun coming up, a glint, a click - and `Get down!` with it if I
am up in his line), and needs a moment more to see me when I come up out of
cover; down behind something, I am safe from the men in front of it, and
someone comes round; in the open - on my feet, or down with nothing between
me and most of them - I am every man's, and a doorway I hold standing in the
room is not walked into again: one of them comes round by another door.
Every rule reads what the men see; the one that reads my stance is the size
of the mark (a man on his feet is noticed and settled on quicker), written
below.

---------------------------------------------------------------------------
## 1. The player: the mode `gun`, the weapons

```js
ctx.controller.setPose(x, z, yaw, pitch);           // (setPose puts the controller back in 'walk':
ctx.controller.setMode('gun', { crouch: false });   //  the mode after it) ({ crouch: true }: starts down)
gunsOf(ctx.game).arm('revolver');                   // or 'tommy': in hand AND FULL - in the beat's setup,
                                                    // so every retry gives the gun as it was at the checkpoint
```
(`weapons.equip` alone keeps what was left in the gun at the fall: the
critic's second look found a retry starting with two rounds as the men came
in. A beat that starts a man down behind cover starts him down: the test
bed's door and two_ways begin crouched behind the desk, as the ready beat
left him.)
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
  (the revolver's). **RMB down in the open** lifts the eye 0.08 m over
  nothing: that is still down, not risen (`controller.riseOver` says a rise
  is over something; the warnings and the fall's words read it).
- **LMB** fires, **R** reloads (the revolver's cylinder face / the Tommy gun's
  count on the HUD as before).
- `controller.crouchK` (0..1), `riseK` (0..1), `riseOver`, `leanK` (-1..1), `crouchOn`.
- The mode `office` (scene 5 of wave B) is untouched: IV moves to `gun`.
- **Do not edit the page's code while a play runs**: Vite reloads the page.

---------------------------------------------------------------------------
## 2. An encounter: `gunsOf(game)`

```js
import { gunsOf } from '../guns/Guns.js';
const K = gunsOf(ctx.game);
K.end(); K.begin({ to: 'beatName', maxFiring: 2, flankAfter: 7, settleK: 1, dmgK: 1, why: {}, warn: {}, area: null });
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
  | `risen` | up over the cover (over something: RMB in the open is not risen) | Up over the cover too long. |
  | `tommy` | a Tommy gun, me down | The Tommy gun chewed through. |
  | `cover` | down, through what I hid behind | Your cover was shot away. |
  | `bare` | down with nothing solid within 1.2 m on any side | Down, but in the open. |
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
  most `maxFiring` pistol men shoot at once while I fight from cover; a man
  standing in the open (up, and seen whole: §4 *In the open*) is every man's
  to shoot - stand and trade in the open and they all come out at once.

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
  bed's board fences), and every door that opens onto somewhere: the men
  leave the killhouse's back door open, so behind it is a walled yard, the
  house in a terrace of brick blocks (`stages/killhouse/parts/yard.js`) -
  never a plain to the skyline, never an invisible wall, never a way round a
  house's end into the street.
- **The player's push by a door**: a leaf swinging into me pushes me straight
  back from the doorway's plane, on my own side of it (`door.shove`: it
  used to follow the leaf's own normal and swept me round the hinge to
  behind the leaf); against a wall it stops ajar. A locked door, once tried,
  says `locked` (the test bed's prompt).
- **Frosted glass shows a man where he stands**: the shadow's source is put
  straight behind the nearest man on the far side, 2.4 m back (the killhouse's
  `updateFrost`; the frost's own source behind the pane's middle threw a man
  0.6 m off the glass a metre sideways, off the pane).
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
  | **`pistol`** | 100 | 17 | 2 - 3 rounds, 0.4 - 0.52 s apart (0.3 - 0.36 at a man standing still in the open: his aim holds) | 7 in the magazine, reloads behind cover (1.7 s); goes round; pushes |
  | **`tommy`** | 120 | 8 | a burst of 10 - 14 at 10.5/s, wide (0.02 rad) and climbing (0.007 a round) | pins: rakes where I went down, line or no line, chewing what I hide behind and through what is thin; after each burst he changes the drum where he stands, out loud (2.6 s): my moment |
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
  **A man coming in at a `hold` door comes with his gun up** from the moment
  it opens (and through it, to his jamb); two working the same door **stack
  on it as a pair** - the first waits at it (3 s at most) for his mate, the
  mate takes the wall beside him, not his back - and it opens on both. Seeing
  me in the open through it, he stops and brings the gun onto me (the click,
  the star: the tell), settles, fires one or two, holds his aim a moment
  (0.4 s: shot back at, it is a duel, below), then a breath with the gun
  down and again while I stand there; once I am down or out of his sight,
  on to his jamb. A head over the desk he does not stop for.
- `cover: true` (and no `way`): he is there when the beat opens, down
  behind the cover point nearest `at` (1.3 m), his first time out after
  `wait`. For a fight already on (the test bed's street: three men behind
  the far cars).
- `hp`, `yaw`, `name`, `variant`: as the Hood's.
- Then his brain reads the room: the cover that hides him from my place, a
  way there by the nav grid, spread round me (not all on one line); out
  from it to shoot (a step out, or up over it), two or three rounds, back.
- **In the open** (the critic's second look: every rule that read my stance
  now reads what he sees): he sees me **whole** when nothing at all is
  between his eye and my body low down (my belly where it is under a rise -
  a car's windows and a pane count as between), and I am up on my feet, or
  down with my body bare to at least half of the men alive (`K.lowInOpen`:
  down on a room's floor with two at the door is the open; down behind a car,
  flanked by one of four, is that one's angle). The rules of the open: the
  token (every man's to shoot), the snap on his way, the duel, a hit that he
  trades instead of ducking, the look-out again in 0.8 - 1.3 s, the held
  doorway (below).
- **The tell and the settle** (the fair rule, the brief's numbers): the gun
  comes up (0.26 s, a glint, a click); he must see me (0.25 s after I come
  into his line; x0.3 when I am standing in it - the height of me, a big
  mark: written, the one rule that reads my size; **0.45 s more when he has
  me from off my screen** - a flank, a door at my back: the time to turn,
  with the warning `Behind you!` or `Behind you! The door!`); then the
  settle (0.4 s at 3 m .. 0.9 s at 18 m; x1.4 while I move across his line;
  x0.6 while I stand still on my feet in it - the size again; x1.5 for 1.5 s
  after a round near him or into him); a settled round at a man standing
  still in the open hits (0.0055 rad); his aim trails a moving target by
  0.2 s. Out of his line, the settle drains (0.6 s) - whatever he is doing;
  **he does not settle on the move** (a step out from cover: his aim settles
  once he stands at the spot). The star shows at his muzzle **only where I
  can see it** (0.75 of the raise; with the gun still behind a jamb or a
  leaf it waits, half a second at most), and his first round comes 0.18 s
  after it - never a star on a door's face with his hand behind it.
- **A hit** is a flinch (the body jerks a step off it, `Hood.flinch`; his
  settle is halved and does not grow for 0.18 s; a man already firing keeps
  firing, his next rounds wider for 0.35 s; a Tommy gunner's burst climbs).
  Shot by me **from cover** (he sees only the top of me, or nothing) he ducks
  back behind his own, his aim gone; shot by me **in the open** he stays and
  trades. No random stagger for a kit gunman. **Out, two or three, back**,
  whoever he shoots at (with no cover to go back to: a breath of 1.0 - 1.4 s
  with the gun down). **The duel**: shot at (a round into him or past him in
  the last 1.5 s) by a man he sees in the open, he does not lower his gun
  between bursts - he fires on.
- **Shot at before he is in** (a round into him or past him while he is on
  his `way`, or waiting to start): he does not walk on into it - the gun up
  if he has me, the Tommy gunner rakes where the shot came from (aimed: he
  saw the flash), else the nearest cover. A round into a Tommy gunner from
  where he could not see me tells him where I am.
- **His gun at a jamb or over a car**: the round leaves his gun, always. The
  place he shoots from needs his right hand's line to my eye and my chest
  (from 0.22 m to his right, the arm from his right shoulder) as well as his
  eyes'; he walks out to the spot itself (the path's end is 0.3 m short: a
  shuffle the last of the way). A gun still behind the edge, or an arm
  through a jamb, a door's leaf, a crate's corner (shoulder to muzzle, and
  0.7 m on toward me), does not fire: he steps out further to where it
  bears (0.45 - 0.9 m), and with no such step that cover is no good against
  me where I am - he takes another (8 s).
- **He does not shoot through his mate** (he holds the round); a stray one
  into a mate does what it would do to me.
- **How they press** (nobody hides out the clock):
  - **together**: when one goes out, the others behind cover go with him
    (two guns on the man who rises to answer);
  - **in the open**: me in the open in a man's line, he does not wait his turn
    behind his cover (0.3 s); the last he saw of me I was in the open, he
    looks out again in 0.8 - 1.3 s, not 2.5 - 4;
  - **a held doorway**: a man down in a doorway (within 1.3 m of it) who had
    me in the open - I hold it standing in the room - sends one of the others
    whose way is that door round to another door of my room (one I could see
    from where I stand, unlocked), by the grid with the held doorway shut to
    it (never through my room), with the flank's warning and the door's when
    he opens it behind me (`K.doorHeld`);
  - **a doorway worked by two**: the first at the jamb waits (up to 4 s) for
    his mate on his way to it, then they go out together; a third waits his
    turn along the wall, out of the doorway's line, and takes a side as one
    comes free (up to 14 s, then he goes through);
  - **on the way**: a man in the open on his way, with me in the open within
    9 m in his line, stops and shoots one or two (the tell and the settle as
    ever), then on;
  - **the push**: out from one cover 3 - 5 times with no line on me, he
    goes on to cover nearer me; nothing nearer and no line for 6 s, he
    goes to find a place that sees me;
  - **the last man** with no line on me for 6 s - or with no round off at me
    in 10 s (a glimpse of me now and then from places where his gun would
    not bear kept the 6 s from ever running: a stand-off) - leaves his cover
    and comes to find me (a last man once held a pavement for 40 s): to a place round
    me that sees me, else in at me by the grid's way, stopping where he has
    me (a lone Tommy gunner only after 18 s, and only to a place at his own
    range: he pins - he rakes where he last saw me, or the flash of my gun,
    for 12 s after, from cover or from the open);
  - **the seek**: a man with no cover and no line goes to a place that sees
    me, or in at me by the way there is; nine seconds without a line, he
    comes straight in (nobody waits the clock out either); in the open with
    me in his line and nothing coming back at him, he does not go back into
    cover: he finishes it;
  - **the flank** (the director): when I hold one place down for
    `flankAfter` seconds - and no man is still on his way in (a man coming in
    through another door is the beat's way round; then 6 s more) - the man best placed goes round (a run you hear: a
    scuff and quick heels) to a place that sees me, off the others' line;
    the last man alive goes round too (after 1.5 x `flankAfter`), the Tommy
    gunner only then, and to his own range (6 - 7.5 m). Otherwise the Tommy
    gunner pins: with no line he rakes where he last saw me (or the flash of
    my gun), from cover or from the open; he takes no cover nearer me than
    5.5 m, and comes looking only as the last man (above).
- **The director** (the kit): at most `maxFiring` pistol men shoot at once
  while I fight from cover; standing in the open, I am every man's; the
  Tommy gunner and the heavy fire whatever the count (they count against the
  pistol men while they do).
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
  `Behind you! The door!` (key `door`: a man opening the last door on his way,
  a door of my room - one I could see if I turned - off my screen; before he
  is through it), `One's going round on your left.` / `...right.` (a flanker
  on his way, or a man sent round a held doorway, the side as I face),
  `Get down!` (not down - risen over nothing is down - and **a man bringing
  his gun onto me**: the first word comes with the tell, before the first
  round; and held for 3.5 s after a hit standing, between their rounds, so
  the kit's second before the fall is not given again by each new line; or
  hurt under 45 with a man on me),
  `Stay down. Let it mend.` (down, hurt, nobody has me). A line stays a
  second unless a more urgent one comes, or the man it is about is down.
  Words in `cfg.warn` by key (`rush`, `behind`, `door`, `tommy`, `cover`, `angle`,
  `flankL`, `flankR`, `open`, `mend`; the test bed's two_ways: `door: 'The
  other door! Behind you!'`). A scene sets no warning once its room
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
| `door` | the exposure of a doorway (starts down behind the desk) | three pistol men through one door: the first two stack on it as a pair, guns up, and work it from its jambs; a third (5 s behind) waits his turn along the wall. Standing in the room holding the doorway: a man down in it sends another round by the lobby to A2 |
| `two_ways` | watch two ways (starts down behind the desk) | two through A1 as a pair, the third (7 s) through A2 at my back - working it from its jamb, his door said as it opens (`The other door! Behind you!`); no director's flank as well (flankAfter 0); settleK 1.15 |
| `pin` | wait out the burst, rise on the drum | the Tommy gunner first at the glazed door B2 (the first thing met is the burst), then two pistol men working B1 while he changes his drum; the bar's front panels take two bursts at one place |
| `rush` | answer the heavy at once | the heavy in at the street door, a pistol man at 14 s through A2 (the fight's `area` the house; "One more. Find him." when the heavy is down) |
| `street` | cover to cover (Tommy gun) | three behind the far cars, one out of the loading door (flankAfter 14) |
| `street_rev` | the same, with the revolver | the same (settleK 1.2) |

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
- equip the gun without `K.arm` in the setup (a retry would give back what
  was left in it at the fall);
- leave a door the men open onto an unfinished edge;
- leave an encounter running past the scene (`K.end()` on `scene:exit`).

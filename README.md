# NOIR CITY

An open-world first-person noir game: one new city, one endless night in the
rain, rendered in real time to look like a hand-inked black-and-white
illustration (`reference/noir_reference.png`). No story and no missions:
systems (driving, the gun, the police's heat, destruction), places, and
things to do that you find by looking. Cloned from NOIR EXTREME (below),
whose renderer, ink, cast, cars, guns, fist fight, pad and tools it keeps.
The standard is `docs/OPEN_WORLD.md`; the lanes' reports `docs/reports/`.

## Run

```bash
npm install
npm run dev          # NOIR_PORT=<port> npm run dev for another port (default 5173)
```

Open http://127.0.0.1:5173 and click. The game takes the mouse (pointer
lock); Esc gives it back and pauses. `?mute=1` starts silent.

## How to play (the city as built)

**The title** is the city itself: Grand Ave under the el in the rain, the
coupe at the kerb. **BEGIN** starts a new night at that kerb; **CONTINUE**
(only when there is a save of the city) puts you back where you last got into
a car with no heat on you. An old NOIR EXTREME save is dropped quietly.

**The keys** (the title and the pause card list them; a card teaches each
the first time it is needed):

| key | does |
| --- | --- |
| WASD, mouse | walk and look; in a car: throttle, brake, steer |
| E | use what you look at: get in / out of the car, try a door, take a thing, ride the el, the phone box, the wanted board |
| mouse wheel | draw the revolver under your coat, and put it away |
| LMB / RMB / R | with the revolver out: fire, steady, reload; C gets low |
| SHIFT | run |
| SPACE | the handbrake |
| Q / F | in a car: the horn / the radio's dial (silent stations hiss until you drop records into `public/music/`) |
| TAB (held) | the heat, the money, the car's state, the hour, what is in your pockets |
| M | the map (the game holds while you read it) |
| ESC | the pause card: the map, the settings (the sound is there), the matchbooks |

**What the screen shows**: an inked scrap of the map bottom left (heading
up); the police's shields top right when they want you (half-toned while
they search, struck as they give up) and a line top left that is your
situation (`Lose them.`, `Stay out of sight.`, `Clear.`, `A car is
coming.`); the money bottom right when it changes. Nothing else.

**What answers you**: a shot in the city is heard (two shields, `Lose
them.`; out of sight they search, then give up). Things on the pavements
break, fall and stay where they fell; cars dent, smoke and burn; the river
takes a car (and lets a man swim to the steps); the paper at a stand prints
what you did last.

**Things to find** (nothing lists them): the el (the stair at any station:
ride the loop up front, off at any stop; a man chased onto it while they
search for him is lost at the next station); the phone boxes (a car brought
to the kerb by the box for $50); the wanted board by the police
headquarters' door (three faces a night, each standing somewhere in his
district: take him down and collect); cash, rounds and bottles in alleys and
on stoops; a matchbook on the step of each of the six bars (the pause card
keeps the row); the paper at every newsstand.

**The pad** (a PS5 controller, `?padfake=1` for the tools): the title and
the pause card are menus (✕ chooses); the left stick walks, the right looks;
□ use, R2 fire (and throttle), L2 steady (and brake), d-pad left / right the
revolver on foot, d-pad right the radio in a car, d-pad up the horn, d-pad
down the map, the touchpad the heat and the money, options the pause. A
gun raised on L2 eases the sight onto a man near it.

**Test beds** (`?start=<id>[.<beat>]`): `city` (the default), `o4` and its
beats (the fist fights, the street shootout, the gym, the gun shop: lane
O4's), `smash` (lane O6's destruction), `?nightbed=1` in the city (1 to 5
set the heat, 0 clears it, 9 the search, 8 gives $50, 7 a matchbook).
NOIR EXTREME's chapters stay reachable the same way (below).

---------------------------------------------------------------------------
# The base: NOIR EXTREME (its chapters are reference and test beds here)

A short first-person noir detective story, one rainy night in 1937, in a
city rendered in real time to look like a hand-inked black-and-white noir
illustration. Colour is an accent: blood, fire, an ember, a flame, scotch,
neon, the crew's red. Built with Three.js and Vite; every texture, model,
sound and effect is generated procedurally at startup (no art assets; the
music slots wait for the user's jazz in `public/music/`).

The target look is `reference/noir_reference.png`; progress frames per
milestone live in `docs/progress/`.

## Run

```bash
npm install
npm run dev          # NOIR_PORT=<port> npm run dev for another port (default 5173)
```

Open http://127.0.0.1:5173 and click. The game takes the mouse (pointer
lock); Esc gives it back and pauses (click to resume).

**A PS5 controller** (any standard gamepad) plays it all, the title and the
pause card too: press a button on it (the browser shows a pad only after one;
that first press only brings up the ink bracket) and the cards draw its
buttons instead of the keys. The d-pad or the left stick moves the bracket on
a menu, **✕** chooses, **○** or **options** goes back; a pad needs no click
(it holds the game without the mouse), but the browser lets the sound in only
after a key (a click on the title starts the story): press any key on the
keyboard once. The pause card has the stick's speed and the rumble.

## How to play

One rainy night in 1937: eight chapters, from a stool at a diner's counter to
the Cardinal's hat in the wet street. You are only ever seen as hands and
sleeves. Very little is said; what can be used shows itself in the light,
and a prompt low in the frame names the key (E) when you are looking at it.
A line top left says what you are doing now; a card with the key on it
teaches a move the first time you need it. A loss is warned before it comes,
then black, a word on why, and back at the start of the beat or a checkpoint.

**The title.**

- **BEGIN** starts the story: a few comic panels (a click, E or SPACE moves
  on; ESC twice skips them), then chapter I.
- **CONTINUE** is there when a checkpoint exists (saved in the browser at the
  start of each chapter and of its main beats).
- **CHAPTERS** is the table of contents: a row starts that chapter, carrying
  what the story has given by then (the matchbook, Ames's card, the check,
  the revolver) and teaching the keys it needs that the save has not seen.
  Starting a chapter replaces the saved checkpoint.
- **`?start=<chapter>[.<beat>]`** on the address starts BEGIN anywhere, for
  example `/?start=warehouse` or `/?start=warehouse.fight`. The chapters
  (wave C: The Body is cut): `diner` I, `fight` II, `office` III, `gunfight`
  IV, `watcher` V, `tail` VI, `warehouse` VII, `shootout` VIII (the beats of
  each: `docs/story/ARCHITECTURE.md` section 11.1). `?start=kit` is the kit's
  test bed (`docs/story/seams/Z.md`), `?start=guns` the gun kit's.
- **M** turns the sound on and off (the browser holds sound back until the
  first click or key; `?mute=1` starts silent), **[** and **]** the volume.
  No music is composed: drop jazz into `public/music/` and
  `docs/story/MUSIC.md` says what goes where.

**The keys, by mode.** One key means one thing all through the game (the
rulebook: `docs/story/WAVE_C.md` §2): **E** use / take / open what you look
at, **LMB** the right hand's act (jab, fire, rub, throw), **RMB** the other
fist or, with a gun, steady the aim (crouched behind cover: rise over it),
**SPACE** the body's big move (block, vault, jump; in the car the handbrake),
**C** (toggle) or **Ctrl** (held) get low, **A / D** in a fist fight the
dodge, **R** reload, **Shift** run. Everywhere: mouse looks, **M** sound,
**Esc** pause (the pause card lists the keys). On a pad: the right stick looks, **□** does
what the prompt says, **options** pauses, the d-pad's down is sound.

| Where | Keys | PS5 pad |
| --- | --- | --- |
| walking (the street, the alley, the office, the pier) | **W A S D**, **Shift** sprints | left stick (as fast as it is pushed), **L1** (or **L3**) sprints |
| I The Diner (seated at the counter) | mouse looks round the room; **E** light up, scotch, drink, pay; **F** a drag on the cigarette; **LMB** taps the ash; **Q** spins the empty stool beside you | right stick looks; **□** light up, scotch, drink, pay; **R1** a drag; **R2** taps the ash; the d-pad spins the stool |
| II The Fight (and the foreman at Pier Nine) | **LMB** / **RMB** are your two arms: tap to jab, hold to load a harder punch (three ticks) and let go; **A / D** hop aside, **S** hop back, **W** step in; **SPACE** held blocks; **E** takes what is in reach (a bottle, a plate, a stool, at Pier Nine a hook, a lid, a chain, a lantern) and that hand's button uses it (a hold throws). Afterwards **WASD** out of the door, **E** search | **L2** / **R2** are your left and right fists (each trigger the fist of its side); a flick of the left stick left / right hops aside, back hops back, forward steps in; **✕** held blocks; **□** takes |
| III Room 304 | **WASD**; **E** open the door, the pad, the picture, the dial, take; the pad: hold **LMB** and rub with the pencil until the three numbers show; the dial: the mouse turns it, **E** the handle; the torn check: **LMB** held drags a piece, **RMB** held turns it | left stick; **□**; the pad: hold **R2**, the right stick rubs; the dial: the right stick turns it; the torn check: the right stick moves the fingertip, **R2** held drags a piece, **L2** held turns it (as the card says; **L1** / **R1** turn it too) |
| IV The Door | **LMB** fires the revolver, hold **RMB** to steady (crouched: rise over the cover), **R** reloads (from the pocket: the rounds are counted); **E** tips the desk; **C** ducks (a toggle; **Ctrl** ducks while held); at the end, walk to the street window | **R2** fires, **L2** held steadies (crouched: rises over the cover), **△** reloads; **□** tips the desk; **○** ducks (a tap toggles; held, you stand when you let go) |
| V The Watcher | **E** the fire escape; **W** takes you down the iron; the chase: **W** runs, **A / D**, the mouse steers; nothing goes over anything by itself: **SPACE** over a fence or a crate (and through a door), **C** under a bar, **SPACE** the jump, **C** the slide down the roof | **□**; the left stick forward; the chase: the left stick, the right stick steers, **✕** vaults and jumps, **○** slides under |
| VI The Tail | **W** throttle, **S** brake and reverse, **A / D** steer (the arrows too), **SPACE** the handbrake, **Q** the horn, **E** with nothing to use the headlamps; when he makes for the docks hold **RMB** to put the revolver out of the window and **LMB** to fire; **E** get out, walk to his window (he talks), **E** get in, drive to Pier 9's gate | **R2** throttle and **L2** brake / reverse (as far as they are pressed), the left stick steers (as far as it is pushed), **✕** handbrake; hold **L1** to lean out of the window and **R1** fires (**R2** stays on the throttle); the right stick aims; **□** get out, take him; the d-pad is the horn |
| VII Pier Nine | **WASD**, **Shift** runs, **C** crouches (in the light you are seen; you are heard walking within 3 m, running within 8, crouching never); **E** open a door, take a bottle, pull the switch, put out the lantern, drop a load, knock a man out from behind; with a bottle hold **LMB** for the arc and let go to throw; after the shells the gun as IV (**LMB**, **RMB**, **R**, **C**; a lamp can be shot out); then the foreman's fist fight (as II) | left stick, **L1** runs, **○** crouches; **□**; with a bottle hold **R2** and let go; then the fist fight (as II) |
| VIII The Block | the nick of time: **C** low, **E** a man from behind, **E** a bottle and **LMB** held to throw it, **SPACE** over the broken window's sill, **LMB** a blow over the counter; **E** take the Tommy gun, **E** the lights by the door, **E** a drum from Dot at the counter (few: count them); **LMB** fires (hold), **RMB** steadies, **R** reloads, **C** low; at the end **WASD** out to the hat | **□**; **R2** fires (hold), **△** reloads; the left stick |
| the comic panels | a click, **E** or **SPACE** moves on, **ESC** twice skips | **✕** moves on, **options** twice (or held) skips |

## How the look works

- `src/render/Pipeline.js` renders normals + object ids, an emitter-only
  planar reflection of the wet street (long vertical streaks), volumetric
  lamp cones, 3D rain lit by the cones, bloom, and then one ink pass
  (`src/render/shaders/ink.js`): fog, filmic tone curve, dry-brush tonal
  quantisation from canvas-generated stroke textures sampled in **world
  space** (so strokes stay on surfaces as you move), hand-drawn contours,
  a saturation-keyed colour keep for blood and fire, rain streaks, grain.
- Enemies ("Hoods", `src/enemies/`) are skinned procedural men in fedoras
  and trench coats with procedural animation clips, inked as black
  silhouettes with a lamp rim.
- The world reacts: destructible cars that smoke, explode and burn (with a
  warm reflection on the street), shootable lamps and windows, a train
  crossing the el, lightning, and over a hundred procedural Web Audio sounds.

## Tooling

Every tool takes `NOIR_PORT` (the dev server's port) and runs headless Chrome
muted, on a throwaway profile; run one at a time (the GPU is shared and a
frame-rate number from a busy GPU means nothing: read the ratio to
`shot=perf`). `docs/story/ARCHITECTURE.md` section 10.6 has the hygiene.

- `tools/shot.sh out.png "shot=street" 1600 1000` — headless Chrome WebGL
  screenshot of a named camera preset (`street`, `lamp`, `cars`, `hood`,
  `hoodstudy`, `hoods`, `viewmodel`, `battle&t=30` (autopilot combat),
  `wreck&t=8`, `train&t=6`, `title`, `end`; `t=` fast-forwards the
  simulation, `hud=1`, `debug=1`, `view=N` shows pipeline buffers).
  `tools/shot.sh out.png "scene=office&beat=pad&t=3"` — a story beat's frame
  (every beat of the eight scenes: `docs/story/ARCHITECTURE.md` §8 and §10.3);
  `"still=opening&panel=2"` — a page of comic panels.
  A hung capture is killed after `SHOT_LIMIT` seconds (default 180).
- `python3 tools/strip.py out.jpg "scene=...&t={t}" t0 t1 n` — a film strip of
  one motion.
- `tools/errors.sh "scene=office&beat=pad&t=3"` — runtime errors, frame count and
  (with `audiotest=1`) the offline audio render table.
- `node tools/fps.mjs "shot=perf&t=1&anim=1" 1440 900` (`UNCAPPED=1` for
  headroom) — frame-time measurement.
- `python3 tools/golden.py check` — every golden frame (38) against
  `shots/golden/` (the renderer is pixel-deterministic).
- `node tools/play.mjs tools/plays/<play>.json` — a scripted play of the real
  game by trusted input: every contest's three proofs (`<id>_idle`, `_bad`,
  `_good`), `slice` (the title to III), `chapters`, `continue`, `saves`, the
  kit's and the pad's plays, and the whole game in one session:
  `whole.json` (the taught hands) and `whole_first.json` (the clumsy ones),
  written by `python3 tools/lib/whole.py`; the list is in
  `docs/story/ARCHITECTURE.md` §11.8. `tools/fpstable.mjs` reads every
  chapter's heaviest moment against `shot=perf`.

## Design documents

`DESIGN.md` is the art direction and technical plan. The story pass:
`docs/story/STORY.md` (the story, with what was built where it differs),
`docs/story/CONTRACTS.md` (the binding APIs, file ownership, the site plan),
`docs/story/ARCHITECTURE.md` (the engine as built; section 10 is wave B,
section 11 wave C: the chapters and their save points, the kit, the gun kit,
the places, the pad, the plays), `docs/story/WAVE_C.md` (the plan for making
it a game: the rulebook, the kit, the story),
`docs/story/FIGHT.md` (the fist fight), `docs/story/MUSIC.md` (the music slots,
for the jazz), `docs/story/WAVE_B.md` (the plan for scenes 3 to 9),
`docs/story/seams/` (how to add a mode, a clip, a weapon, a cast kind, a prop, a
sound), `docs/story/briefs/` (one brief per lane) and
`docs/story/reports/` (what each lane built and measured).
`docs/PHASE*_BRIEF.md` are the shooter's phases.

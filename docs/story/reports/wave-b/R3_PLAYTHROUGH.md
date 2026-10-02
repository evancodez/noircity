# Wave B, round 3: the play-through (the game as one thing)

- branch `wave-b/R3-playthrough`, from `9e03ec2` (wave-b/integration), port 5331; not pushed, not merged.
- What it is: the title, BEGIN, the nine chapters and THE END played in one page
  session by real input, the way a player meets them; every seam between two
  chapters judged; every save point continued from after a reload; the frame
  rate of every chapter's heaviest moment against `shot=perf` in one headless
  Chrome; what broke at a seam fixed.

## How it is played (the tools)

- **`tools/plays/whole.json`** (built by `tools/lib/whole.py` from the lanes'
  own plays: run it again when a lane's play changes). One page, `?mute=1`,
  1280 x 800: the title, BEGIN, `slice.json` (the diner, the fight), then
  `body`, `office`, `gunfight`, `watcher`, `tail`, `warehouse` (the stealth and
  the pier fight), `shootout` (B7's driver), each from the step that waits for
  its chapter (its title and BEGIN dropped, its screenshots dropped), to THE
  END; then the end card's click, the title, BEGIN again and the second
  evening's first frame. At each chapter's start: a frame under the card and
  one after the fade, checks of what the last chapter left, and a measure
  (the garbage-collected heap, draw calls a frame over two seconds, programs,
  geometries, textures, lit lights and shadow lights, listeners, the scene's
  hooks, the director, the fist fight, the Hoods' brains, HUD layers, the
  controller's mode, the hands' set, the weapon, the inventory, the flags, the
  music slot, the prompt, the lens, the sound loops). A recorder in the page
  keeps the chapter cards, every `scenes.go`, every music cue and stop, every
  beat with its play time, every save written, anything printed over a
  chapter card, how long the black is held, every frame longer than 120 ms,
  and every glass sound. `node tools/play.mjs tools/plays/whole.json`
  (`NOIR_PORT`); about 15 minutes.
- **`tools/plays/saves.json`** (built by `tools/lib/saves.py` from a whole
  run's log: the 42 saves the game actually wrote). For each, in the story's
  order: the save put back as written, the page reloaded, CONTINUE by a real
  click; the chapter must come up at that beat (or the one its script runs on
  into), out of the black, playing, the inventory and flags as saved, the
  beat's music; a frame; three seconds of play (a look round, a step); the
  error log empty. Last, the save of a story played to THE END: the title must
  offer BEGIN, not CONTINUE. About 7 minutes.
- **`tools/fpstable.mjs`**: one headless Chrome, uncapped, 1440 x 900; each
  chapter's heaviest moment measured between two runs of `shot=perf&t=1&anim=1`
  (the ratio holds whatever else the machine does); fps, p95, the draw calls
  a frame (mean and max), triangles, lit lights.
- `tools/play.mjs`: one added step (`[R3]`), `{ "heap": "label" }`: a garbage
  collection, then the page's JS heap in use (DevTools, exact).

The long plays were run against a production build (`vite build` +
`vite preview` on 5331), so editing the code during a 15-minute run could not
reload the page under it; the gate's frames and error logs on the dev server.

## Found (most felt first)

1. **Chapter VII could not be driven when played through from VI.** Scene 6
   freezes the controller for the duck into my car (`controller.frozen = true`,
   the eye eased down to the door as the chapter's black comes), and nothing
   unfroze it: scene 7's drive mode reads a frozen controller as "no input".
   "W drive" stood on the dials and the car never moved; the play waited 300
   s at the kerb and failed. Every lane play starts its chapter cold
   (`?start=tail`), where the controller is free: only a play-through could see
   it. Anyone who played the story would have stopped there.
2. **A train passing over the block as a chapter changed rumbled on in the
   next place.** The rumble is a sound loop the train's step keeps at its
   level and lets go when it is gone; the old stage is no longer stepped, so
   nothing let it go. Measured in two runs: `train` and `trainGrind` loops
   alive through IV (the corridor, the room), V and VI's office beat, into
   VII's seat, in a place with no train at all. Likewise a fire: the roar of
   scene 9's burning wreck went on under the second evening's diner (the
   wreck was taken away, its loop was not).
3. **Text under the chapter card.** VII's "W drive" came up 1.1 s into its
   2.4 s card, IX's "They're coming here." 1.1 s into its card: two pieces of
   type at once in a chapter's first second.
4. **Scene 9 broke Mack's window a second time.** Its fresh room put every
   pane back and shattered Mack's again: a crash under the chapter's black and
   new glass falling past the door in IX's first second, the glass of scene 2
   swept away. The window is now out as scene 2 left it.
5. **After THE END the title offered CONTINUE**, which went back to the hat in
   the street (the end beat's save, `flags.ended`, was read by nobody): ten
   seconds of the ending, then THE END again.
6. **The torn half was in my coat twice, under two names** (`matchbookHalf`
   from scene 3, `tornHalf` added by scene 6's own list of what I carry).
7. **Continued at scene 6's car save: silence** where a play-through has the
   chase's music until the tail's takes over.

Looked at and found sound (no change): every chapter card (I, III-IX; II is a
cut by design, the way in one move); the black held 0.05 s between chapters
(0.15 s before I); the long frames all under the black of a stage's first
build (office 167-267 ms, backlot 167-200 ms, river road 467-483 ms, pier
250 ms; none in play); the hands' set, the controller's mode, the lens (68
degrees) and the HUD's layers at every chapter's start are that chapter's own;
no prompt, subtitle, fight card, layer or brawl carried over; the Hoods'
brains and the director stand down with their chapter (`ais` 0, the director
off at every start but V's own first man); the scene hooks are one (the new
scene's) at every start; the game's own listeners are bounded (one cast hook
and one reaction hook per stage built, the guarded `scene:exit` hooks; the
others come and go with their scenes); Mack's window is out in IX; the second
evening (THE END, its click, the title, BEGIN) is a clean diner: no gunman,
body or burning car, the glass whole, empty pockets, `jukebox_a`, the stool
and the smoke set.

## Fixed (shared files marked `[R3]`, each the smallest additive change)

| # | what | where |
| --- | --- | --- |
| 1 | a chapter entered afresh (not a kept cut) starts with the controller unfrozen and the look free, as it does cold | `src/game/SceneManager.js` `enter()` |
| 2 | entering a stage stops the old place's train rumble (and a shot hydrant's hiss); a fire gone from the list stops roaring | `src/game/Game.js` `enterStage()`, `src/audio/Sfx.js` `update()` |
| 3 | a prompt waits for the chapter card (hidden while the card is up, shown as it fades; the key works under it); IX's first line after its card | `src/ui/Hud.js` (`#hud.carded`), `src/scenes/09_shootout.js` |
| 4 | scene 9 keeps Mack's window as scene 2 left it (its glass on the pavement); a cold start breaks it without a sound | `src/scenes/shootout/room.js` `freshRoom()` |
| 5 | a save of a story played to THE END is not offered as CONTINUE (BEGIN and CHAPTERS are) | `src/game/Save.js` `exists` |
| 6 | the torn half by scene 3's name | `src/scenes/06_watcher.js` `INV` |
| 7 | continued at the car, the chase's music | `src/scenes/06_watcher.js` (car beat) |

## The seams, chapter by chapter

Run 4 (the numbers repeat within a few per cent in runs 2, 3 and 5). Draw
calls are a frame's mean over two seconds at 1280 x 800 (the lesson's 1437
is a frame with the shadow maps redrawn); the heap after a garbage collection.

| chapter | comes in | card | music at its start (MUSIC.md) | mode / hands at start | carries in | draw calls | heap MB |
| --- | --- | --- | --- | --- | --- | --- | --- |
| title | page load | - | none | title drift | - | - | 21.2 |
| I The Diner | BEGIN: black, fade in 2.5 s | I | `jukebox_a`; `jukebox_b` on the docker's nickel (36 s in) | seated / smoke | nothing | 473-517 | 23.9 |
| II The Fight | cut from his line (keep) | none (one move) | the record playing (`jukebox_b`) | brawl / fists | the room as it stands | 1190 (1437 max) | 26.1 |
| III The Body | black 0.6 + card + 0.6 | III | `body` (the jukebox stopped) | walk / empty | matchbook; window B2/B4 out, Mack on the pavement | 1190-1231 | 31.9 |
| IV Room 304 | black + card | IV | `office` | walk / empty | matchbook, torn half, note | 452 | 35.1 |
| V The Door | cut in the same room (keep) + card | V | `office` stopped at the shadows | office / empty, the revolver drawn on the way | + ledger; the eye where IV left it | 229-303 | 35.7 |
| VI The Watcher | black + card, in V's room | VI | silence, `chase` as he runs | seated at the blind / empty | + revolver; his six dead men in the room | 385 | 46.0 |
| VII The Tail | black + card | VII | `tail` | drive / drive | (unfrozen: fix 1) | 518 | 56.4 |
| VIII Pier Nine | black + card | VIII | `warehouse`; stopped as the foreman steps out | sneak / sneak | - | 763 | 62.0 |
| IX The Block | black + card | IX | silence; `shootout` with the cars, stopped for the quiet; `end` over the hat | walk / empty (the gun on the counter) | Mack's window out | 529-547 | 62.0 |
| THE END | the card over the hat, its click to the title | - | `end` | cutscene | - | 763-779 | 76.8 |
| second evening | BEGIN again | I | `jukebox_a` | seated / smoke | nothing (pockets empty) | 489-543 | - |

The heap grows by the stages as they are built (block 21 MB with the title,
office +3, backlot +10, river road +10, pier +6) and stays: entering a built
stage again adds nothing (the block at IX: 62.0 against 62.0 at VIII's start;
the second evening's draw calls, programs and lights are the first evening's).
The scene's own things go with it: 14 dead Hoods at THE END, none at the
second evening.

**Frame rate does not decay.** The same diner view, first evening and second
(after all nine chapters and five stages built): draw calls 473-517 against
489-543, programs 91 against 247 (other stages' materials, not drawn), the
same lamp pool. The render-only bench of that view (`__noir.bench`, 30
frames) read 12.2 and 16.5 ms on the first evenings of runs 3 and 4, 17.4 and
23.7 ms on the second evenings, but the same bench on one unchanged view
read 16.8, 17.4, 17.1 and 11.7 ms in a row on this machine (other builders'
GPU load): it is noise at this size. The one real difference between the two
evenings is the lamp pool's deal: the diner gets two of the three
shadow-casting lamp lights when the eye comes in from the title at the start
of the game and three after THE END (the third shadow slot sits empty when a
plain slot already holds the third-nearest lamp: it depends on where the eye
came from), one shadow light more (left, 3).

## Saves and CONTINUE

42 save points written in a play-through (`tools/plays/saves.json`): diner
settle, order, drink, pay; fight start, lesson, round 1-3, outside,
matchbook; body approach, body, landing, note; office corridor, room, pad,
safe, ledger; gunfight shadows; watcher seen, escape, run, car; tail start,
chase, close; warehouse arrive, floor, lamps, aisle, stairs, listen, out,
fight; shootout arrive, cars, doorways, el, driveby, cardinal. Every one
continues after a reload: the beat, out of the black, playing under the mouse,
the inventory and flags as saved, the beat's music, three seconds of play, no
error. The ended save gives a title of BEGIN and CHAPTERS. (Frames: the
review sheet `saves_continued.jpg`.)

## Frame rate, chapter by chapter

`tools/fpstable.mjs`: one headless Chrome (uncapped, 1440 x 900, production
build), each chapter's heaviest moment (the lanes' own where they named one)
measured for 5 s between two runs of `shot=perf&t=1&anim=1`; the ratio is
the moment's fps over the mean of the perf runs either side of it. Two
sessions: A at 21:17-21:22 (load 3-8; the GPU reading of that session is the
tool's own page, a bug fixed for B), B at 22:36-22:40 (load 3-14; another
builder's headless play was running, the GPU 88-100 % busy before every
measurement with my page blank). Absolute numbers move with the machine; the
ratio does not move much.

| chapter: heaviest moment (query) | A: fps / perf / ratio | B: fps / perf / ratio | draw calls a frame, mean / max | triangles (M) | lit lights |
| --- | --- | --- | --- | --- | --- |
| I the room alive, Dot pouring (`scene=diner&beat=order&t=14&anim=1`) | 85.9 / 57.9 / **1.48** | 97.9 / 64.0 / **1.53** | 519 / 543 | 2.17 | 9 |
| II round 3, his haymakers (`scene=fight&beat=round3&t=3&anim=1`) | 91.8 / 54.3 / **1.69** | 91.7 / 70.2 / **1.31** | 1087 / 1169 | 3.01 | 9 |
| III the approach, the car and the train (`scene=body&beat=approach&t=5.5&anim=1`) | 58.9 / 51.5 / **1.14** | 76.5 / 69.8 / **1.10** | 894 / 962 | 2.94 | 9 |
| IV the room, the lamp, the slats (`scene=office&beat=room&t=2&anim=1`) | 120.6 / 51.3 / **2.35** | 116.0 / 61.9 / **1.88** | 215 / 239 | 0.12 | 5 |
| V the kick, the glass man, the flashes (`scene=gunfight&beat=door&t=1.8&anim=1`) | 101.9 / 50.3 / **2.03** | 98.7 / 44.7 / **2.21** | 213 / 251 | 0.34 | 5 |
| VI the run, the yard (`scene=watcher&beat=run&t=3&anim=1`) | 93.0 / 55.5 / **1.68** (a third short session) | 65.5 / 33.7 / **1.95** | 860 / 876 | 0.85 | 7 |
| VI the fire escape (`shot=bl_escape&t=1&anim=1`) | 132.8 / 58.0 / **2.29** | 95.6 / 37.4 / **2.56** | 89 / 89 | 0.33 | 7 |
| VII the market at 24 m/s (`scene=tail&beat=chase&tailAt=520,2.2,24,30&tailCruise=1&t=1&anim=1`) | 55.0 / 44.4 / **1.24** | 37.1 / 27.9 / **1.33** | 434 / 451 | 3.94 | 7 |
| VIII the lamps beat (`scene=warehouse&beat=lamps&t=3&anim=1`) | 123.1 / 48.1 / **2.56** | 54.1 / 31.4 / **1.72** | 237 / 249 | 0.31 | 7 |
| VIII the foreman, the oil burning (`shot=b9duel&do=lantern&t=3.4&anim=1`) | 86.7 / 46.6 / **1.86** | 76.1 / 35.7 / **2.13** | 195 / 283 | 0.21 | 7 |
| IX the cars beat (`scene=shootout&beat=cars&t=10&anim=1`) | 56.9 / 48.5 / **1.17** | 39.3 / 36.0 / **1.09** | 653 / 785 | 2.71 | 9 |
| perf (`shot=perf&t=1&anim=1`, 11-12 runs a session) | 44-58 | 28-71 | 729-734 / 785 | 2.90 | 9-10 |

**No chapter is below perf at its heaviest moment.** The nearest are IX's
cars beat (1.09-1.17: two cars' headlamp cones through the room, six men,
the glass going; 653 calls against perf's 730, 2.7 M triangles) and III's
approach (1.10-1.14: the avenue, the el, the crew car, 894 calls). Lane B7
measured the cars beat at 0.60-0.86 of perf in alternate pages under heavier
load from seven builders; between perf runs in one page it holds above perf
in both sessions here, so nothing was cut. In the play-through itself
(vsync-capped, 1280 x 800, light load) every chapter's start ran 60 fps but
the body's approach and the tail's start in run 3 (48 and 52, p95 33 ms:
the other builder's play was running).

## The first-timer's length of each chapter, as the plays measure it

Game seconds of play from a chapter's start to the next's (runs 3 and 4).
The plays are first-timers only in the fights (a reaction time, a wrong read
in five) and the gunfights (a human's turn and aim); the puzzles and the
walks are played by a hand that knows the way, so a person's first time is
longer: the lanes' own estimates are in brackets.

| chapter | the play | a person (lanes' estimate) |
| --- | --- | --- |
| I The Diner | 62 s | 3-6 min (the player's pace: light up, the scotch, three sips, pay) |
| II The Fight | 78-105 s (the lesson 23 s; won in 58-85 s) | 1.5-2.5 min |
| III The Body | 65 s | 4-8 min |
| IV Room 304 | 43 s | 2.5-5 min |
| V The Door | 49-54 s (the fight 37-42 s, never down) | 1-2 min, more with a fall |
| VI The Watcher | 46 s | 1-2 min |
| VII The Tail | 78 s | 2-2.5 min |
| VIII Pier Nine | 286-293 s (the pier fight 67-74 s) | 6.5-10 min |
| IX The Block | 117-133 s (B7's sure driver, down once) | 4-5 min |
| all | 14-14.6 min | about 30-45 min |

## The gate

GATE

## Left (most felt first)

LEFT

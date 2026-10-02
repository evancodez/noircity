# NOIR EXTREME — music slots (for the user's jazz)

No music is composed for the game. Every slot below is silent until a file
is dropped into `public/music/` (the folder does not exist yet: make it),
named after the slot, as `.mp3`, `.ogg` or `.m4a` (the first that exists
plays):

```
public/music/jukebox_a.mp3      public/music/body.ogg      ...
```

This document is the one to read when cutting the files. It is checked
against the code (`grep music.cue src`, `src/audio/Music.js`, each scene's
script) as of the end of wave B, round 3. Times marked "computed" come from
the code's own timings (a walk's pace, a clip's length), not from a capture;
times marked "first-timer" are the lanes' estimates or their bots' runs
(`docs/story/reports/wave-b/B*.md`): nobody has played the whole story by
hand and heard it with sound (every headless run is muted).

## The rule (wave C, lane C1; the code: `SceneManager.applyMusic`, seams/Z.md §6)

A scene declares its slot, and a beat may override it: `music` and
`beatMusic: { beat: spec }` in its `defineScene`, defaulting to its
chapter's entry in `src/scenes/order.js`. A spec is a slot (`'office'` or
`{ slot, fade }`), `null` (silence), `{ stop: fade }`, or `'room'` (the scene
plays its own diegetic music, the diner's jukebox: the rule leaves it
alone); a scene that declares nothing (the test beds) stops the music as it
is entered from another scene. **Entering a scene, or continuing into any beat of it - a chapter's
start, a CONTINUE, a retry after a fail, a chapter picked, a jump - cues
what that beat declares (its beatMusic's, else the scene's); a beat of
beatMusic cues its own as it begins.** Leaving a scene stops its slot only
through the next scene's declaration: another slot crossfades over the new
cue's fade, the same slot plays on, `null` stops it. The title stops any
music (`Game.toTitle`, BEGIN). A scene's own `music.cue` / `music.stop` at a
moment inside a beat still works (the watcher's umbrella). This replaces the
three patches the loose ends below asked for: `end` now stops when its card
goes to the title; a CONTINUE in VIII at `doorways`, `el` or `driveby` cues
`shootout`; a CONTINUE at V's `car` cues `chase`; and `fight` is cued, under
VII's fist fight with the foreman (beats `fight`, `ko`; out over 3 s as
`after` begins). Wave C's declarations:

| chapter | music | beatMusic |
| --- | --- | --- |
| I diner, II fight | `'room'` (the jukebox) | |
| III office (Room 304) | `office` (2.5 s) | |
| IV gunfight (The Door) | `{ stop: 2.5 }` | |
| V watcher | `null` (the umbrella cues `chase`) | escape, run, car: `chase` (0.4 s) |
| VI tail | `tail` (2.5 s) | |
| VII warehouse (Pier Nine) | `warehouse` (1.5 s) | fight, ko: `fight` (2.5 s); after: `{ stop: 3 }` |
| VIII shootout (The Block) | `null` | cars, doorways, el, driveby: `shootout` (2.5 s) |

The `body` slot is no longer cued (The Body is cut). The tables below are
wave B's and keep its chapter numbers (III was The Body); lane C10 rewrites
them at the end of wave C.

## How a slot plays

- A scene cues a slot: `game.music.cue(slot, { fade, diegetic })`. A cue of
  the slot already playing does nothing. A cue of another slot **stops the
  one playing, over the new cue's own fade**: two cues in a row are a
  crossfade (the new one's fade in, the old one's fade out, the same length).
- `game.music.stop(fade)` fades out and ends the file. Nothing else stops
  music: a scene ending, a retry (black and back to a beat), a chapter card,
  the pause card (the master only ducks to 0.22) and the title all leave a
  slot playing. Only the next cue, or one of the stops listed below, ends it.
- A **jukebox** slot (`jukebox_a`, `jukebox_b`, `jukebox_c`) is diegetic: it
  plays from a point in the world (the diner's jukebox) through a
  small-speaker filter (band-passed: no deep bass, no air), placed in the
  room, so it gets quieter and duller as you move away and is heard through
  the wall from the street. A jukebox slot with no file still plays a faint
  needle hiss, so the room knows a record is on. Jukebox slots **loop**.
- The other slots are score, heard flat, and **play once**: when the file
  ends there is silence until the next cue. Cut or loop a file yourself if a
  scene should run longer than it. (Fades are exponential: a cue's fade is the
  time to about 95 % of the level.)
- Level: a file plays at 0.8 of the music bus; the jukebox's speaker filter
  takes off the lows and the highs, so a well-mastered record is right as it
  is. Everything obeys the game's volume (`[` `]` or `-` `=`, and the pause
  card's settings) and `M` (mute).
- A file that is missing is quiet, never an error: the player tries `.mp3`,
  `.ogg`, `.m4a`, then gives up.
- Sound effects around the music (the coin, `jukebox_change`, `needleScratch`,
  the thunder, the el) are procedural and always play.

## The slots

| slot | cued by | starts | stops | mood it wants | file |
| --- | --- | --- | --- | --- | --- |
| `jukebox_a` | `01_diner.js` / `_diner_room.js` (`jukebox.play`) | scene 1 comes up out of black under its card (a fresh evening, or a second BEGIN, always puts it on); from a save or a chapter pick into scene 1 or 2 it is the record the room last had, or this one when it has none | the next jukebox change, a needle scratch, or the next scene's cue | late-night small-band jazz, slow and warm, a muted trumpet or a tenor sax over brushed drums; unhurried, a little tired; nothing that swings hard | `public/music/jukebox_a.(mp3\|ogg\|m4a)` |
| `jukebox_b` | the jukebox's change, 1.6 s into it (a, b, c, a, ...) | the docker's nickel, about 35 s into scene 1 (computed: his errand is set for 22 s; he walks 13 m to the machine, about 10 s, then coin, button, change) | as above | a shade livelier: mid-tempo, a walking bass, a piano trio or a clarinet; it must still sit under a fist fight without mocking it | `public/music/jukebox_b.(mp3\|ogg\|m4a)` |
| `jukebox_c` | the same cycle, the third change | scene 2: a body thrown into the jukebox knocks it on (1.1 s later the record changes), or its third dent darkens it for a second and it starts again. Rare in a played fight: he is thrown into what his back is near, and that is mostly the stools | as above | brassy and hot, a big-band shout chorus or a fast blues; the room has gone wild | `public/music/jukebox_c.(mp3\|ogg\|m4a)` |
| `fight` | **nothing** (reserved) | never cued: the diner's jukebox carries scene 2, and the second fist fight at Pier 9 is silent. Cueing it would stop the jukebox | | percussive, tense, low piano and drums | `public/music/fight.(mp3\|ogg\|m4a)` |
| `body` | `03_body.js`, the script's first line, fade 2 s | scene 3's chapter card (every entry, so a CONTINUE at any of its beats too); it takes the jukebox down over 2 s | the next scene's cue (`office`, 2.5 s crossfade). Nothing stops it inside scene 3 | sparse and cold: a lone bass, a vibraphone, long silences; rain does the rest | `public/music/body.(mp3\|ogg\|m4a)` |
| `office` | `04_office.js`, the script's first line, fade 2.5 s | scene 4's chapter card (every entry); it takes `body` down over 2.5 s | `05_gunfight.js` stops it, fade 2.5 s, at the first moment of beat `shadows` (the draught shuts the door), so it plays under the "V THE DOOR" card and goes out as the shadows come | quiet, careful, curious: soft piano, a brushed snare, a clock's patience | `public/music/office.(mp3\|ogg\|m4a)` |
| `chase` | `06_watcher.js`, fade 0.4 s (a hard start) | the moment his umbrella drops (beat `seen`, 5 to 8 s into the scene for a first-timer); cued again, a no-op, at the starts of beats `escape` and `run` (what a CONTINUE at those beats starts it from). Beat `car` entered from a save has none | the next cue: `tail`'s, 2.5 s crossfade, at scene 7's card. Nothing stops it inside scene 6 ("Lost him." and the retries leave it playing) | fast and urgent: a driving walking bass, stabbing horns | `public/music/chase.(mp3\|ogg\|m4a)` |
| `tail` | `07_tail.js`, the script's first line, fade 2.5 s | scene 7's chapter card (every entry); it takes `chase` down over 2.5 s | `07_tail.js`, fade 2 s, 1.4 s after "Pier nine." has gone and he lies against the rail, as `ctx.next()` fires | a steady pulse, low and restless, brass swelling as you close in | `public/music/tail.(mp3\|ogg\|m4a)` |
| `warehouse` | `08_warehouse.js`, in the beat's setup, default fade 1.5 s | scene 8's first frame (every beat entry up to `out`: a checkpoint, a cosh and back, a CONTINUE; a no-op if it is playing) | `pierFight`, fade 2.5 s, the moment I go down into the loading bay and the foreman steps out. The beats `fight`, `ko` and `after` are cued silent (stop 0.5 s) | almost nothing: a low drone, a muted note now and then, a heartbeat of a bass | `public/music/warehouse.(mp3\|ogg\|m4a)` |
| `shootout` | `09_shootout.js`, fade 2.5 s | beat `cars` begins (5 to 7 s into scene 9 for the driver: the line, Dot's gun, the take; later for a first-timer who looks around). Beat `arrive` is silent | `cardinal()`, fade 4 s, when the quiet before the Cardinal begins: the last of the others is down or gone (survivors are sent running after 15 s and are removed once out of sight, 20 s at the latest) | big, dark and loud: full band, hard-swinging, dissonant brass | `public/music/shootout.(mp3\|ogg\|m4a)` |
| `end` | `shootout/ending`, fade 3 s | 2.6 s into the last frame (the view has come down to the hat; the el train goes over) | nothing: it plays once, under the end card, until its file ends or the next cue (see "Loose ends") | a slow, sad ballad; one horn, the rain | `public/music/end.(mp3\|ogg\|m4a)` |

## Scene by scene, with the length the music has to cover

First-timer lengths are for the whole scene unless it says "music". A scripted
play is the lane's bot by real input; it is faster than a person.

| scene | music | the scene's length | the music's length |
| --- | --- | --- | --- |
| title | none (the rain; the street through the diner's glass; a record left on from an earlier play is heard faintly) | | |
| I The Diner | `jukebox_a`, then `jukebox_b` | 3 to 6 minutes at the player's pace: light up, the scotch, three sips, pay (Wave A) | `jukebox_a` about 35 s, then `jukebox_b` for the rest; both loop |
| II The Fight | the record in the room (`jukebox_b`, or silence after a scratch; `jukebox_c` if the room changes it) | about 2 to 2.5 minutes from his line to the chapter card: the way in 4 s, the lesson 25 to 35 s, the fight 40 to 80 s after it (the seeded reader's whole fight, lesson included: 71 to 108 s), the walk out and the search about 30 s. A player who struggles takes 111 to 217 s for the fight; one who mashes and holds now and then, 2 to 4.5 minutes | what the record has; loops |
| III The Body | `body` | 3 to 4 minutes (scripted: 66 s) | about 4 minutes |
| IV Room 304 | `office` | 2.5 to 5 minutes: the pad by trial, the dial by ear; the hints come at 16 s (pad) and 28 s (dial). Scripted: 44 to 62 s | at least 5 minutes, or a cue that loops cleanly; it also runs under the next scene's card and fades out over 2.5 s |
| V The Door | none (the music goes out as the shadows come; the corridor's boards, the guns, the room coming apart carry it) | about a minute: 30 to 45 s of shooting for a first-try win, the scripted scene 50 to 60 s; every fall costs about 5 s | silence |
| VI The Watcher | `chase` from the umbrella | 65 to 80 s for a first-timer (scripted 50 to 62 s from BEGIN to the tail's card; one "Lost him." adds about 10 s) | 1 to 1.25 minutes, starting on the beat (0.4 s fade) |
| VII The Tail | `tail` | 2 to 2.5 minutes (1:25 to 2:30): the engine, the chase (52 s flat out, up to 90 s), the close and the shots (3 to 20 s), the spin and wreck (about 6 s), out and the walk (about 8 s), the question (6 to 21 s), the last line and the slide (about 5 s) | 1:25 to 2:30; it fades out over its last 2 s |
| VIII Pier Nine | `warehouse`, then silence | the whole scene 6.5 to 10 minutes: the stealth 5 to 8 minutes (scripted 3 min 40 s; most of it, two thirds, is the lamps and the stairs; the order at the window is 12 s, his look 3.2 s; the way out about 30 s), then the fist fight 50 to 100 s (silent), then about 15 s after the splash | 5 to 8 minutes under the stealth, then a 2.5 s fade into the silent fight |
| IX The Block | `shootout`, a silence, `end` | 2.5 to 5 minutes. The drivers' beats on the final code: arrive 5 to 6 s, cars 24 to 29 s, doorways 9 to 111 s (the sure shot 9 to 11, the first-timer's driver 13 to 111: deaths there), el 12 to 46 s, drive-by 15 to 49 s, the Cardinal 25 to 53 s, the end 15 to 17 s; the whole scene 131 to 179 s for the sure shot, 143 to 245 s for the first-timer's driver. A person is estimated at 4 to 5 minutes | `shootout` from the cars to the quiet: 73 to 75 s (sure shot), 80 to 110 s (first-timer's driver), up to 3 minutes with deaths; plan for up to 4. The Cardinal's beat is silent: 7 s of rain, the saloon, his men, him, his fall (26 to 53 s; a retry of it about 10 s to him). `end`: the card comes 6 s after the cue; 1 to 2 minutes of file |

## What the story cues, in order

Checked against the code. "Black" is the 0.6 s fade a chapter change takes.

1. **The title**: no music.
2. **Scene 1 fades in** (2.5 s under the card): `jukebox_a` from the jukebox.
3. **About 35 s in**: the docker's nickel. `coin`, then the jukebox's own
   `jukebox_change` (arm, mechanism, the record dropping), and `jukebox_b`
   starts 1.6 s into the change. The cycle is a, b, c, a, ... on every change.
4. **Scene 1 to 2** is a cut with the room kept (no card, no new cue): the
   record plays on.
5. **Scene 2's first beat** (`start`, his rise): half the time (seeded) his
   hip bumps the counter as the stool goes over: `needleScratch`, and the
   music stops (0.15 s); then the scene has no music at all. Otherwise the
   record plays on under the way in, the lesson and the fight.
6. **In the fight**: a body thrown into the jukebox skips it (`jukebox_hit`)
   and 1.1 s later changes the record (the next slot). Every third dent
   darkens it for a second and it changes record too.
7. **A lost round** (the retry under the black): the record goes on as it
   was, a needle knocked off stays off.
8. **The window**: the street comes into the room (the wall's muffle opens
   halfway); outside on the pavement the jukebox is heard through the broken
   end bay. **The matchbook** changes nothing.
9. **Scene 3 (black, the card)**: `body` in over 2 s; the jukebox goes out
   over the same 2 s. It plays under the whole scene and its last glide.
10. **Scene 4 (black, the card)**: `office` in over 2.5 s, `body` out over it.
    It plays through the corridor, the room, the pad and the safe, and
    through the ledger and the cut into scene 5 with its card.
11. **Scene 5, the first moment of `shadows`**: `office` out over 2.5 s.
    Nothing else in scene 5, nor in its retries.
12. **Scene 6**: silence through the card and the first look out of the
    blind; the moment the umbrella drops, `chase` in (0.4 s). It plays
    through the fire escape, the run, "Lost him." and its retries, the dead
    end and the car, until E drive.
13. **Scene 7 (black, the card)**: `tail` in over 2.5 s, `chase` out over it.
    Out at the end, over 2 s, as "Pier nine." leaves.
14. **Scene 8 (black, the first frame)**: `warehouse` in (1.5 s). A cosh and
    the checkpoint's black leave it playing. As the foreman steps out, out
    over 2.5 s. The fight, the splash and the way out are silent.
15. **Scene 9**: `arrive` silent. At `cars`, `shootout` in (2.5 s). Dying
    leaves it playing through the black and the retry. At the Cardinal's
    quiet, out over 4 s: the Cardinal's beat, his fall and the walk out to
    the hat are silent.
16. **The last frame**: 2.6 s after the view has come down to the hat,
    `end` (3 s fade). Six seconds later the card, THE END.

## Loose ends (wave B, round 3; the first four are answered by the rule above)

- **`end` is not stopped when the card is clicked.** The click goes to the
  title (`game.toTitle()`), which does not touch the music, so a file longer
  than the player's stay carries on over the title until it ends or the next
  cue (a second BEGIN's `jukebox_a` fades it out). Cut `end` to the card, or
  make `toTitle` call `music.stop`.
- **A CONTINUE in scene 9 at `doorways`, `el` or `driveby` starts without
  `shootout`.** The cue sits in beat `cars`; a retry after a death keeps the
  music that was already playing, a reload does not have it. A CONTINUE at
  `cars` cues it; at `cardinal` it is silent by design. Scenes 3, 4, 7 and 8
  cue their slot on every entry, whatever beat a CONTINUE lands on.
- **A CONTINUE at scene 6's `car` beat has no `chase`** (the cue is at the
  umbrella and at the starts of `escape` and `run`).
- **The `fight` slot is never cued** (the diner's fight rides the jukebox;
  Pier 9's is silent). Nothing in the game would play it today.
- **The 35 s of the first change is computed**, not captured; the docker's
  walk could run a few seconds either way (a stool in the way, the pace).
- Every length above is a bot's or an estimate. The user's own first play
  with the jazz in will be the first by a person with sound.

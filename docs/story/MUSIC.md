# NOIR EXTREME — music slots (for the user's jazz)

No music is composed for the game. Every slot below is silent until a file
is dropped into `public/music/` (make the folder), named after the slot, as
`.mp3`, `.ogg` or `.m4a` (the first that exists plays):

```
public/music/jukebox_a.mp3      public/music/office.ogg      ...
```

This is the document to read when cutting the files. It is checked against
the code as of the end of wave C (lane C10b): each scene's `music` /
`beatMusic` declaration, every `music.cue` / `music.stop` left in a script,
and the cues recorded in a play of the whole game from BEGIN to THE END
(`tools/plays/whole.json`, its recorder's `cues`). Every headless run is
muted: nobody has heard it with the files in.

## The rule (lane C1; the code: `SceneManager.applyMusic`, seams/Z.md §6)

A scene declares its slot, and a beat may override it: `music` and
`beatMusic: { beat: spec }` in its `defineScene`, else its chapter's entry
in `src/scenes/order.js`. A spec is a slot (`'office'` or `{ slot, fade }`),
`null` (silence, a 2 s fade), `{ stop: fade }`, or `'room'` (the scene plays
its own diegetic music, the diner's jukebox: the rule leaves it alone).
**Entering a scene, or continuing into any beat of it - a chapter's start, a
CONTINUE, a retry after a fail, a chapter picked - cues what that beat
declares (its beatMusic's, else the scene's); a beat of beatMusic cues its
own as it begins.** Leaving a scene stops its slot only through the next
scene's declaration (another slot crossfades over the new cue's fade, the
same slot plays on, `null` stops it). The title stops any music (BEGIN and
THE END's click to the title too). A scene's own cue at a moment inside a
beat still works (the watcher's umbrella, the end's hat).

| chapter | music | beatMusic | cues left in the script |
| --- | --- | --- | --- |
| I diner, II fight | `'room'` (the jukebox) | | II: half the time (seeded) his hip bumps the counter as the stool goes: a needle scratch and the record stops (0.15 s) |
| III office (Room 304) | `office` (2.5 s) | | `04_office.js` cues it on entry |
| IV gunfight (The Door) | `{ stop: 2.5 }` | | `05_gunfight.js` stops it (2.5 s) at the moment the shadows come to the door |
| V watcher | `null` | escape .. car (every stretch): `chase` (0.4 s) | the umbrella dropping cues `chase` (0.4 s, a hard start); a CONTINUE at `car` cues it |
| VI tail | `tail` (2.5 s) | | out over 2 s as the chapter ends at the pier's gate |
| VII warehouse (Pier Nine) | `warehouse` (1.5 s) | fight, ko: `fight` (2.5 s); after: `{ stop: 3 }` | the bay's beats are cued silent in the setup (0.5 s) before the rule's `fight` |
| VIII shootout (The Block) | `null` (the nick of time and the gun are silent) | cars, flank, el, cardinal, last: `shootout` (2.5 s); saloon: `{ stop: 4 }` (the quiet before his car) | `end` (3 s fade) as the eye comes down by the hat |

## How a slot plays

- A cue of the slot already playing does nothing. A cue of another slot
  stops the one playing over the new cue's own fade: two cues in a row are a
  crossfade.
- A **jukebox** slot (`jukebox_a`, `jukebox_b`, `jukebox_c`) is diegetic: it
  plays from the diner's jukebox through a small-speaker filter, quieter and
  duller as you move away, heard through the wall from the street. With no
  file it still plays a faint needle hiss. Jukebox slots **loop**; the docker
  feeds it a nickel about 35 s into I (`jukebox_b`), a body thrown into it in
  II changes the record (a, b, c, a, ...).
- The other slots are score, heard flat, and **play once**: when the file
  ends there is silence until the next cue. Cut or loop a file yourself if a
  chapter runs longer than it (the lengths below).
- Level: 0.8 of the music bus; everything obeys the game's volume (`[` `]`)
  and `M`. A missing file is quiet, never an error.

## The slots

| slot | where it plays | mood it wants |
| --- | --- | --- |
| `jukebox_a` | I from the first frame (a fresh evening always puts it on) | late-night small-band jazz, slow and warm, a muted trumpet or a tenor over brushes |
| `jukebox_b` | I from the docker's nickel; II under the fight unless the needle was knocked off | a shade livelier: mid-tempo, a walking bass; it must sit under a fist fight without mocking it |
| `jukebox_c` | II when a body hits the jukebox (rare) | brassy and hot: the room has gone wild |
| `office` | III, all of it, and under IV's card until the shadows come | quiet, careful, curious: soft piano, a brushed snare, a clock's patience |
| `chase` | V from the umbrella to the car (and on into VI's first seconds, crossfaded) | fast and urgent: a driving walking bass, stabbing horns |
| `tail` | VI, all of it | a steady pulse, low and restless, brass swelling as you close in |
| `warehouse` | VII's quiet pass, the office and the loud pass | almost nothing: a low drone, a muted note, a heartbeat of a bass |
| `fight` | VII's fist fight with the foreman (the beats `fight`, `ko`) | percussive, tense, low piano and drums |
| `shootout` | VIII from the cars to the end of the el, again for the Cardinal and the last ten seconds | big, dark and loud: full band, hard-swinging, dissonant brass |
| `end` | the last frame, his hat in the street, under THE END | a slow, sad ballad; one horn, the rain |

The `body` slot is no longer cued (The Body is cut).

## Chapter by chapter: how long the music has to cover

"Taught bot" is `whole.json`'s good hands by real input (faster than a
person); "first-timer bot" is `whole_first.json`'s clumsy hands, falls and
retries included (each retry is about 3 s of black under the music, which
plays on). A person playing for the first time is slower than both: plan the
files for the longer number and a bit.

LENGTHS_TABLE

## What the story cues, in order (the whole play's recorder)

CUES_LIST

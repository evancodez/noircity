# NOIR EXTREME — music slots (for the user's jazz)

No music is composed for the game. Every slot below is silent until a file
is dropped into `public/music/`, named after the slot, as `.mp3`, `.ogg` or
`.m4a` (the first that exists plays):

```
public/music/jukebox_a.mp3      public/music/fight.ogg      ...
```

A slot is cued by the story (`game.music.cue(slot, { fade, diegetic })`,
`src/audio/Music.js`). A **diegetic** slot plays from a point in the world
(the diner's jukebox) through a small-speaker filter (band-passed: no deep
bass, no air), placed in the room, so it gets quieter and duller as you
move away, and it is heard through the wall from the street. A jukebox slot
with no file still plays a faint needle hiss, so the room knows a record is
on. The other slots are score, heard flat. Jukebox slots loop; score slots
play once (cut or loop a file yourself if it should run longer).

| slot | where it plays | how long the scene runs | mood it wants | file |
| --- | --- | --- | --- | --- |
| `jukebox_a` | Scene 1, the diner: the record on when the scene fades in, from the jukebox at the far end (diegetic). Also the record a fight picks up when it is entered straight from a save (CONTINUE into round one, two or three) | 3 to 6 minutes (the player's pace: light up, the scotch, three sips, pay); from a save, the fight (about 2 minutes) | late-night small-band jazz, slow and warm, a muted trumpet or a tenor sax over brushed drums; unhurried, a little tired; nothing that swings hard | `public/music/jukebox_a.(mp3\|ogg\|m4a)` |
| `jukebox_b` | Scene 1: the docker feeds the jukebox a nickel ~22 s in; the change (the arm, the mechanism, the drop: about 2 s of clunks) and then the next record (diegetic). It plays on under the fight unless the big man's rise knocks the needle off (half the time: a scratch, then silence) | the rest of scene 1, and scene 2 (1.5 to 2.5 minutes) if it survives | a shade livelier: mid-tempo, a walking bass, a piano trio or a clarinet; it must still sit under a fist fight without mocking it | `public/music/jukebox_b.(mp3\|ogg\|m4a)` |
| `jukebox_c` | Scene 2: the jukebox's third record, when a body thrown into the jukebox knocks it on, or its third dent darkens it and it starts again (diegetic). Rare in a played fight: he is thrown into what his back is near, and that is mostly the stools | the rest of the fight (under a minute) | brassy and hot, a big-band shout chorus or a fast blues; the room has gone wild | `public/music/jukebox_c.(mp3\|ogg\|m4a)` |
| `fight` | reserved (score over a fight; unused in wave A: the jukebox carries scene 2) | 1.5 to 2.5 minutes (the fight: 90 to 150 s for a first-timer, three rounds of about 35, 35 and 50 s) | percussive, tense, low piano and drums | `public/music/fight.(mp3\|ogg\|m4a)` |
| `body` | Scene 3, the body in the side alley (wave B) | 4 to 8 minutes (three table puzzles) | sparse and cold: a lone bass, a vibraphone, long silences; rain does the rest | `public/music/body.(mp3\|ogg\|m4a)` |
| `office` | Scene 4, room 304 (wave B) | 4 to 6 minutes (the pad, the safe) | quiet, careful, curious: soft piano, a brushed snare, a clock's patience | `public/music/office.(mp3\|ogg\|m4a)` |
| `chase` | Scene 6, the watcher runs: down the fire escape, through the alley (wave B) | 1 to 2 minutes | fast and urgent: a driving walking bass, stabbing horns | `public/music/chase.(mp3\|ogg\|m4a)` |
| `tail` | Scene 7, the tail by car on the river road (wave B) | 2 to 3 minutes | a steady pulse, low and restless, brass swelling as you close in | `public/music/tail.(mp3\|ogg\|m4a)` |
| `warehouse` | Scene 8, Pier 9 in the dark (wave B) | 4 to 7 minutes (stealth) | almost nothing: a low drone, a muted note now and then, a heartbeat of a bass | `public/music/warehouse.(mp3\|ogg\|m4a)` |
| `shootout` | Scene 9, the big shootout on the block (wave B) | 4 to 6 minutes | big, dark and loud: full band, hard-swinging, dissonant brass | `public/music/shootout.(mp3\|ogg\|m4a)` |
| `end` | after the shootout: the Cardinal's hat in the wet street (wave B) | 1 to 2 minutes, over the last frame and the card | a slow, sad ballad; one horn, the rain | `public/music/end.(mp3\|ogg\|m4a)` |

## What the wave A slice cues, in order

Checked against the code (`src/scenes/_diner_room.js`, `01_diner.js`,
`02_fight.js`, the diner's jukebox in `src/stages/block/parts/diner.js`).

1. **The title**: no music. The rain, and the street through the diner's
   glass (if a record was left on in an earlier play, it is heard faintly
   from across the street: the jukebox is a point in the room).
2. **Scene 1 fades in**: `jukebox_a` from the jukebox (a fresh evening
   always puts the first record on, a second BEGIN too).
3. **~22 s**: the docker's nickel. `coin`, then the jukebox's own
   `jukebox_change` (arm, mechanism, the record dropping, about 2.8 s), and
   `jukebox_b` starts 1.6 s into the change. It cycles a, b, c, a, ... on
   every change.
4. **Pay, his rise**: half the time (seeded) his hip bumps the counter: a
   `needleScratch` and the music stops (0.15 s). Otherwise the record plays
   on.
5. **Scene 2** is a cut, not a new start: the record in the room plays on
   (or the silence after the scratch). A body thrown into the jukebox skips
   it (`jukebox_hit`) and 1.1 s later changes the record (the next slot).
   Every third dent darkens it for a second and it changes record too.
6. **A lost round** (the retry under the black): the record goes on as it
   was, a needle knocked off stays off.
7. **The window**: the street comes into the room (the wall's muffle
   opens halfway); outside on the pavement the jukebox is heard through
   the broken end bay.
8. **The matchbook, To be continued**: no new cue; the record in the room
   carries on under the end card.
9. **CONTINUE** (a save at any beat of scene 1 or 2): the record the room
   last had, or `jukebox_a` when there is none (after a reload).

Nothing else in wave A cues a slot; `fight`, `body`, `office`, `chase`,
`tail`, `warehouse`, `shootout` and `end` wait for wave B.

Levels: a file plays at 0.8 of the music bus; the jukebox's speaker filter
takes off the lows and the highs, so a well-mastered record is right as it
is. Everything obeys the game's volume and `M` (mute).

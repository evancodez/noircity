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
| `jukebox_a` | Scene 1, the diner: the record on when the scene fades in, from the jukebox at the far end (diegetic) | 3 to 6 minutes (the player's pace: light up, the scotch, three sips, pay) | late-night small-band jazz, slow and warm, a muted trumpet or a tenor sax over brushed drums; unhurried, a little tired; nothing that swings hard | `public/music/jukebox_a.(mp3\|ogg\|m4a)` |
| `jukebox_b` | Scene 1: the docker feeds the jukebox a nickel ~22 s in; the next record (diegetic). It plays on under the fight unless the big man's rise knocks the needle off (then silence) | the rest of scene 1, and scene 2 (2 to 3 minutes) if it survives | a shade livelier: mid-tempo, a walking bass, a piano trio or a clarinet; it must still sit under a fist fight without mocking it | `public/music/jukebox_b.(mp3\|ogg\|m4a)` |
| `jukebox_c` | Scene 2: the jukebox's third record, when a body into the jukebox knocks it on (diegetic) | the rest of the fight (1 to 2 minutes) | brassy and hot, a big-band shout chorus or a fast blues; the room has gone wild | `public/music/jukebox_c.(mp3\|ogg\|m4a)` |
| `fight` | reserved (score over a fight; unused in wave A: the jukebox carries scene 2) | 2 to 3 minutes | percussive, tense, low piano and drums | `public/music/fight.(mp3\|ogg\|m4a)` |
| `body` | Scene 3, the body in the side alley (wave B) | 4 to 8 minutes (three table puzzles) | sparse and cold: a lone bass, a vibraphone, long silences; rain does the rest | `public/music/body.(mp3\|ogg\|m4a)` |
| `office` | Scene 4, room 304 (wave B) | 4 to 6 minutes (the pad, the safe) | quiet, careful, curious: soft piano, a brushed snare, a clock's patience | `public/music/office.(mp3\|ogg\|m4a)` |
| `chase` | Scene 6, the watcher runs: down the fire escape, through the alley (wave B) | 1 to 2 minutes | fast and urgent: a driving walking bass, stabbing horns | `public/music/chase.(mp3\|ogg\|m4a)` |
| `tail` | Scene 7, the tail by car on the river road (wave B) | 2 to 3 minutes | a steady pulse, low and restless, brass swelling as you close in | `public/music/tail.(mp3\|ogg\|m4a)` |
| `warehouse` | Scene 8, Pier 9 in the dark (wave B) | 4 to 7 minutes (stealth) | almost nothing: a low drone, a muted note now and then, a heartbeat of a bass | `public/music/warehouse.(mp3\|ogg\|m4a)` |
| `shootout` | Scene 9, the big shootout on the block (wave B) | 4 to 6 minutes | big, dark and loud: full band, hard-swinging, dissonant brass | `public/music/shootout.(mp3\|ogg\|m4a)` |
| `end` | after the shootout: the Cardinal's hat in the wet street (wave B) | 1 to 2 minutes, over the last frame and the card | a slow, sad ballad; one horn, the rain | `public/music/end.(mp3\|ogg\|m4a)` |

Levels: a file plays at 0.8 of the music bus; the jukebox's speaker filter
takes off the lows and the highs, so a well-mastered record is right as it
is. Everything obeys the game's volume and `M` (mute).

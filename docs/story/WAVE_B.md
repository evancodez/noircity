# NOIR EXTREME — Wave B: scenes 3 to 9 (the art director's plan)

The user played the slice on 2026-09-30 and approved its look ("a good job
in terms of the aesthetics"). Wave B builds the rest of the story.

His words, which are the standard for everything below:

> I really want you to think like this is a premium game. It should feel
> very premium, not janky. The shooting that we had in the very beginning
> of this game felt very premium because it didn't feel janky. The
> animations felt good.

> It's paramount that gameplay feels fun to play and not super
> stiff/scripted. Things that occur should make sense from a game
> perspective.

> You take a really, really long time, and I'd like you to work on this
> stuff way quicker while also being as polished.

Read first, in this order: `reference/noir_reference.png` (the look),
`DESIGN.md` (the ink rules), `docs/story/STORY.md` (the story),
this file, `docs/story/seams/X.md` and `Y.md` (how to add a mode, a clip, a
weapon, a cast kind, a prop, a sound, a Hood under direction, without
editing a shared file), your own brief in `docs/story/briefs/B<n>_*.md`,
then `docs/story/ARCHITECTURE.md` for the map. `docs/story/FIGHT.md` and
`docs/story/reports/wave-a/ARCADE.md` show what "judged by play" means.

---------------------------------------------------------------------------
## 1. One owner per scene

Each builder owns one scene (or two that share a room) end to end: the
place, the people, the hands, the rules, the sound, the script, and how it
plays. Nobody else will fix your scene's feel. You are judged by playing
it, not by a checklist.

| Lane | Scene(s) | Stage | Branch | Dev port |
| --- | --- | --- | --- | --- |
| B1 | 3 The Body (`body`) | `block` (the side alley) | `wave-b/B1-body` | 5311 |
| B2 | 4 Room 304 (`office`), 5 The Door (`gunfight`) | `office` | `wave-b/B2-office` | 5312 |
| B3 | the hands and the revolver (a system, used by 5, 7) | — | `wave-b/B3-revolver` | 5313 |
| B4 | 6 The Watcher (`watcher`) | `office` (first beat), `backlot` | `wave-b/B4-watcher` | 5314 |
| B5 | 7 The Tail (`tail`), vehicles | `riverroad` | `wave-b/B5-tail` | 5315 |
| B6 | 8 Pier Nine (`warehouse`) | `pier9` | `wave-b/B6-warehouse` | 5316 |
| B7 | 9 The Block (`shootout`), the ending | `block` | `wave-b/B7-shootout` | 5317 |
| B8 | 1 and 2: the fist fight, version 4, and how it starts | `block` (the diner) | `wave-b/B8-fight` | 5318 |

After these merge: a second fist fight at Pier 9 (on B8's fight, in B6's
loading bay), then a play-through review and fixes. Those are not yours.

---------------------------------------------------------------------------
## 2. What premium means here (the lessons of Wave A, paid for in rounds)

These are the ways the slice failed the first three times. Do not repeat
them.

1. **Input acts at once.** Anything the player does shows on screen within
   four steps (1/15 s) and is never swallowed: buffer 0.15 s. No animation
   takes the controls away for longer than it must; nothing the player
   waits through twice. If it feels heavy, it is too slow: halve it.
2. **The game explains itself in play.** A mechanic is taught the first
   time it is needed by one short prompt with the key in it, then never
   again. What is dangerous has a tell a first-timer can read; what can be
   used looks usable. No on-screen arrows or meters once taught: the world
   and the hands carry it.
3. **Fair and fun before faithful.** The outline is the spine, but every
   beat must be a thing a player can do, fail softly, and do better. If a
   rule makes no sense from the chair (a hit that lands after you dodged
   it, a win you can get by mashing, a fail you could not see coming),
   change the rule. Failing costs at most ten seconds: black, back at the
   beat's start.
4. **Object first.** When a hand touches a thing (a string, a pencil, a
   dial, a wheel, a rail, a lapel), author the thing's path and put the
   hand on its grip, never the other way. Nothing floats, nothing passes
   through anything, nothing is left in the air after it leaves a hand.
   Check every exit of every state for that.
5. **People are ink shapes, as the Hoods are.** A flat dark mass with a lit
   rim, a tailored outline that reads at 20 m, a few designed poses held
   and eased between, the face lost under a brim. No balloon limbs, no
   arms flung wide on a knock-back, no spinning torsos (the cast's
   `steady` fix exists: use the cast's animator, not raw mixers). Look at
   film strips of every motion you author before you call it done.
6. **Every frame is the reference.** Hard black and paper white, the
   brush's grain, light as cones in rain and smoke, one or two small
   accents that mean something (the registry: blood, fire, ember, flame,
   amber, neon, crew red). Compose each beat like a panel: where the eye
   goes, what is black, what the one light is. An interior is lit by its
   lamps, as the diner now is: pools and darkness, not an even grey.
7. **Smooth seams.** Every change of mode, place or camera is eased or
   cut on black with the chapter card; the eye never jumps, a figure never
   pops. The first and last five seconds of your scene are part of it.
8. **Sound sells it.** Every action has a sound (procedural, through the
   sounds folder), every place a room tone, and your scene cues its music
   slot (silent until the user drops a file in). No voices.
9. **Sixty frames a second at 1440 x 900.** Measure against `shot=perf`
   run at the same moment (the machine is shared with six other builders:
   absolute numbers lie, the ratio does not). Budgets: seven real lights
   (the lamp pool), twelve Hoods, eight other figures.

---------------------------------------------------------------------------
## 3. How to work (fast, and by play)

1. **Grey but whole first.** In the first third of your effort the scene
   is playable from its first beat to `ctx.next()` with stand-ins, and
   `tools/plays/<id>.json` plays it through by real input (`?start=<id>`
   starts the game there). Commit. Everything after that is making it
   good, in the order the player feels it.
2. **Play it after every change that touches feel.** `node tools/play.mjs`
   for the run, `python3 tools/strip.py` for a film strip of any motion,
   `tools/shot.sh` for a beat's frame (`?scene=<id>&beat=<beat>&t=`; give
   every beat a `setup` so this works). Look at what you captured. A strip
   you did not look at proves nothing.
3. **Do not polish what nobody sees; do not leave what everybody feels.**
   If something off the spine costs more than twenty minutes, write it in
   your report and move on.
4. **Your files.** New files under your own folders: `src/scenes/NN_<id>.js`
   (+ `src/scenes/<id>/**`), `src/stages/<stage>/**`, `src/cast/kinds/`,
   `src/props/kinds/`, `src/audio/sounds/`, `src/player/modes/`,
   `src/player/clips/`, `src/debug/shots/B<n>_*.js`, `tools/plays/<id>.json`.
   A shared file (`Game.js`, `Hud.js`, `Hands.js`, `Controller.js`,
   `Cars.js`, `HoodAI.js`, the render pipeline, the shaders) only when
   there is no other way, as the smallest additive change, marked
   `// [B<n>]`, and listed in your report. Never reformat a shared file.
5. **Your server.** `ln -s /Users/evansmac/Downloads/eprojects/noirextreme/node_modules node_modules`
   in your worktree, `NOIR_PORT=<your port> npx vite` in the background,
   and `NOIR_PORT=<your port>` on every tool. Port 5173 belongs to another
   project: never use it, never kill a process you did not start.
6. **Muted, and tidy.** Every headless run is muted (the tools do it; a
   URL you open yourself carries `mute=1`). Captures go under `shots/`
   (ignored by git); when you finish, keep only what your report shows
   and delete the rest, stop your server, leave no stray Chrome.
7. **The gate** (run it before your last commit):
   `npm run build`; `python3 tools/golden.py check` identical (a frame you
   changed on purpose: say which and why; it must be as good or better);
   `tools/errors.sh` clean on every beat of your scene; your play passes
   twice in a row; the slice play (`tools/plays/slice.json`) still passes;
   frames per second at your heaviest moment against `shot=perf`.
8. **The report**: `docs/story/reports/wave-b/B<n>.md` (what plays, what
   you measured, what you changed in shared files, what is open, music
   slot timings) and up to ten review frames and four strips as JPEG in
   `docs/story/review/wave-b/B<n>/` (1440 x 900, quality 85). Commit on
   your branch. Do not push, do not merge.

---------------------------------------------------------------------------
## 4. Shared facts (so seven scenes make one story)

**Order and ids** (`src/scenes/order.js`): diner, fight, body, office,
gunfight, watcher, tail, warehouse, shootout. A scene ends with
`yield* ctx.next()` (fade to black, the next chapter's card). Every scene's
`setup` must make sense when entered cold (`?start=<id>`): give the player
what the story has given him by then (below).

**What the detective carries** (`game.save.inventory`, and what his hands
can do): after scene 2 the red matchbook; after 3 the torn half and the
note (HARBOR BLDG. RM 304); from the start of 5 the revolver (a shoulder
holster: it was always there); after 4 the ledger (red cover); in 9 the
Tommy gun from under the diner's counter.

**The crew's red** (`accent('crew')`) means them, every time: the
matchbook, the ledger's cover, the tail lamps of their cars, the cigar
band. Spend it only on that.

**People** (cast kinds; a kind another lane owns may not exist in your
worktree yet: ask `cast.has(kind)` and fall back to the stand-in):

| Kind | Owner | Stand-in until merged |
| --- | --- | --- |
| `victim` (Ames: thin, hatless, rumpled suit, one shoe off) | B1 | — |
| `watcher` (tall, narrow, bowler, long raincoat, umbrella) | B4 | `couple_him` |
| `cardinal` (wide, slow, homburg, fur-collared overcoat, cane, cigar) | B7 | `heavy` Hood, unarmed |
| `foreman`, dock hands (flat caps, short jackets, cargo hooks) | B6 | `docker` |
| Hoods, `dot`, `mack`, `docker` | exist | |

**Cars.** The detective's is a dark coupe; the watcher's a sedan with red
tail lamps; the Cardinal's a long black saloon. B5 owns `src/vehicles/**`
(anything driven by the player or along a path at speed). B4 shows two
parked cars and one pulling away, B7 brings cars to a kerb and one past at
speed: both animate the block's existing car model on their own rails in
their own files and do not wait for B5. Nobody edits `src/world/Cars.js`
beyond an added export.

**The revolver.** B3 builds it behind the front that exists today
(`weapons.equip('revolver')`, six rounds, LMB, R). Until it merges, the
plain one fires and kills with no model: build your gunfight on it.
B3 also gives the prop `buildProp('revolver')` for a hand outside the
viewmodel (the car window).

**Anchors between lanes.**
- B2's office gives B4: `office.window.street` (where I stand to look
  out), `office.street.watcher` (across the street, under a lamp B2
  builds, where he stands), `office.window.escape` (the window onto the
  fire escape, where I climb out). B4 plays its first beat in B2's room;
  until merged, B4 tests from its second beat.
- B6's warehouse gives the second fist fight its ring: `pier9.bay.centre`
  (`r` 2.4, a clear 5 x 6 m of floor in the loading bay), `pier9.bay.finish.1`
  and `.2` (two plank loading doors over the water, 3 m apart, that a man
  can be put through), and at least five things in reach that can be
  picked up (a crate lid, bottles, a cargo hook, a coil of chain, a
  lantern). The way out of the scene goes through the bay.
- The block: `diner.*` (ARCHITECTURE §4), `block.alley.mouth`,
  `block.alley.lamp`.

**Music slots** (cue yours when your scene starts, `game.music.cue`):
`body`, `office` (scenes 4 and 5: stop it when the shadows come), `chase`,
`tail`, `warehouse`, `shootout`, `end`. Note in your report how long a
first-timer's run of your scene takes: the user cuts his jazz to it.

**Continuity.** It is one night and it rains all through it. The window
Mack went through is still out when the story comes back to the diner.

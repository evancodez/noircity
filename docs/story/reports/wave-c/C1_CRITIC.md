# C1, the kit: the cold player's report

Played on `wave-c/C1-kit` at 3a0af04, dev server 5341, muted, by real input
(`tools/play.mjs`; my plays are `tools/plays/critic/c1_*.json`), before I
read the owner's report. I played as a first-timer: the title, BEGIN, the
stills (left alone, mashed, clicked, skipped), the diner, every chapter's
start from CHAPTERS, a later beat of every chapter (`?start=<id>.<beat>`),
the end of II into III, IV and VIII hands off, II hands off, the kit's test
bed (`?start=kit`) idle, clumsy, very clumsy and good, the saves (a wave B
save, a junk save, a v2 save naming The Body), a reload and CONTINUE, W and
clicks held through a fail's black, the pause card. Frames are in
`docs/story/review/wave-c/C1/critic/`.

**In one line:** the kit itself is fair and well made where it is used (the
test bed). The game around it does not yet keep the kit's promise: the
stand-in objective lines lie after the first beat of six chapters, and the
two chapters this lane routed through `game.fail` (IV and VIII) kill a
player without the warning the user asked for.

---------------------------------------------------------------------------
## Findings, most felt first

### B1 (blocker): the stand-in objective lines outlive their beat and lie
`01_stale_objectives.jpg`

`order.js` gives each chapter one stand-in line (I and II have per-beat
lines; IV's `Stay alive.` happens to fit all of IV). The manager writes it at the first beat and nothing takes it down,
so it stays up for the whole chapter, through goals it no longer describes.
What the screen told me, beat by beat:

| chapter, beat | the line on screen | what I am actually doing |
| --- | --- | --- |
| VIII `arrive` (from CHAPTERS) | GET TO DOT. | standing at the counter facing Dot, the Tommy gun laid in front of me, `E TAKE IT` |
| VIII `cars`, `doorways` (80 s idle) | GET TO DOT. | in a street gunfight, being shot |
| VIII `cardinal` | GET TO DOT. | the Cardinal |
| III `safe` | FIND AMES. ROOM 304. | at Ames's safe, the combination in my hand |
| VI `crash`, `interrogate` | STAY ON HIS TAIL LAMPS. | out of the car, holding the watcher by the collar at the water |
| VII `fight` | REACH THE LIT OFFICE. QUIETLY. | fist-fighting the foreman |
| V `seen` (the first beat) | CATCH HIM BEFORE THE PIER. | `E LOOK OUT`: nobody has been seen yet |
| V `car` | CATCH HIM BEFORE THE PIER. | getting into the car |

Steps: title, CHAPTERS, VIII; or BEGIN on `/?mute=1&start=office.safe`
(`tail.interrogate`, `warehouse.fight`, `shootout.cardinal`,
`watcher.car`), wait 4 s, read the top left. Play:
`tools/plays/critic/c1_later_beats.json`, `c1_block_idle2.json`.

A line that tells the wrong goal is worse than none: this is the opposite of
"always clear what to do". Fix, in your files:
1. `src/scenes/order.js`: an `objectives` map for every beat of every
   chapter, from WAVE_C §4 (the story as it stands today, a few words each).
   VIII `arrive` must say what the screen says ("Take the gun." or better).
2. `src/game/SceneManager.js` `setBeat`: a line that came from `order.js`'s
   chapter `objective` (not one the scene set itself) is taken down when a
   later beat begins that declares none. Better nothing than a lie; a lane
   that rebuilds the chapter declares its own.
3. II `matchbook`: `SEARCH HIM.` stays while the prompt is `E PUT AWAY`;
   "Pocket it." or nothing.

### B2 (blocker): IV and VIII kill the player with no warning
`02_door_no_warning.jpg`

The user's rule 2 is "a warning before every fail". Both chapters this lane
moved onto `game.fail` (IV `05_gunfight.js:381`, VIII `shootout/rig.js:275`,
through `Game.onPlayerDeath`, `Game.js:435-443`) go down with
`hud.warnText === null` the whole way; `game.lastFail.warnedFor` is null.

IV from CHAPTERS, hands off (`c1_gunfight_idle.json`): the view is on the
window blinds, `STAY ALIVE.`, no prompt. Nothing turns me to the door glass
(WAVE_C §6 IV keeps the camera taken to their shadow: it does not happen on
a cold start). At about 19 s hits start from behind me: red splats at the
frame's edge, the health bar falls 100, 81, 71, 53, 39, 30, 7 over 11 s. I
never see a man. `THEY GOT YOU.` on the black. The retry, oddly, faces the
room with `E TIP THE DESK`: the first try teaches less than the second.
VIII, take the gun then hands off (`c1_block_idle2.json`): 47 s untouched,
then hit from outside while facing the back bar, down at 83 s, no line.

`docs/story/seams/Z.md` §3 exempts "a fail that is a hit" from the warning.
That exemption is the owner's, not the user's. Fix in the kit, so every gun
lane gets it for free: in `Game.js` (or a hook on `Health`), when health
falls under about 45 with a hit in the last second, `hud.warn(def.lowWarn
?? 'You’re hit. Get down.')`, cleared as it mends or by the fail. Then the
fail reads `warnedFor` like the bed does. Tell C5 that IV's cold start
needs its door-glass look (theirs to build).

### M1 (major): no chapter uses a teach card or a warning; IV hands over the revolver cold

The teach card and the warning exist only on the hidden test bed
(`?start=kit`). In the eight chapters a first-timer never meets one: IV
gives me the revolver (LMB fires, RMB steadies, R reloads, C gets low, E
tips the desk) with no card. The title's and the pause card's key line still
says `WASD WALK · MOUSE LOOK · E USE · F SMOKE · M SOUND · ESC PAUSE`, with
no fire, no SPACE, no C, no R, so a player who forgot cannot even look it up
(the pause card: `c1_odds.json`). Ask 2 holds on the bed only. Either stand in
`[LMB] fire` and `[C] get low` on IV's first beat the way you stood in the
objective lines, or say in Z.md and to C2 and C5 that they are theirs. Make
the pause card's key line the rulebook's (WAVE_C §2).

### M2 (major): the warning covers the very thing it warns about
`03_warning_on_the_target.jpg`

`.kwarn` sits at `top: 61%` (`src/ui/kit.js`, the style block): at 1440 x 900
its torn stroke spans about y 514 to 584. On the bed, "He’s getting close."
lies across the running man's chest for the last 1 to 4 s, exactly when I
must aim at him. In a chase the man ahead sits at the same height. Move it
down to about 70 to 72% (it must stay clear of the teach card at `bottom:
22%` and the prompt at `bottom: 16%`), or up under the objective line.

### M3 (major): the end of II never shows Ames's card, so III's goal comes from nowhere
`04_end_of_II_no_card.jpg`

`E SEARCH`: the red matchbook is shown, `E PUT AWAY`, and the card is pushed
into the inventory unseen (`02_fight.js`, the `[C1]` line). The next thing
on screen is `III ROOM 304` and `FIND AMES. ROOM 304.` The only hint of who
Ames is came a chapter ago in "A TIP. AMES.". The `ames` stills run ("AMES.
MARKED.") is built and not played. C4 owns the moment, but while it has not
arrived two lines next to your `amesCard` push (`const h =
G.stills.play('ames'); yield until(() => h.done);`, as Z.md §4 shows) make
the order read. Steps: `/?mute=1&start=fight.ko`, BEGIN, walk out, E, E
(`c1_fight_end.json`).

### M4 (major, by the code: headless cannot prove it): skipping the stills with ESC in a real browser lands on PAUSED

Under a real pointer lock the first ESC is the browser's: `lockLost()` counts
it, the second ESC skips, and `main.js:169-171` then shows the pause card,
because the mouse was let go. So the user's first ESC ESC on the opening ends on
`PAUSED / CLICK TO RESUME` instead of the diner. Also `Stills.js:141` drops
a second press under 160 ms as "one press seen twice": a quick double tap
does nothing but change the hint. The owner names this as untried in a
headed browser. The user will press ESC on the very first thing he sees, so
try it by hand (Chrome, `mute=1`) and, after a skip, take the mouse back
with the next click without showing the pause card (or show the diner and
let a click lock).

### m1 (minor): the stills' skip hint is nearly invisible
`05_opening_page_hint.jpg`. `CLICK · ESC ESC SKIPS` is 11 px, `#8d8b85`, in
the bottom right corner of a black page; at 1440 x 900 a first-timer will
not see it. Brighter, or 13 px.

### m2 (minor): placeholder panel 2 has no Dot
The opening's second panel (`HIS MEN. MY DINER.`) reads as one man in a lit
doorway. The small white apron between three hats, Dot, is not there, so
the run says nothing about her. C9 replaces the picture, but the user will
see this placeholder if C9 is late (`src/stills/_art.js`, `men`).

### m3 (minor): the diner's first line outlives half of itself
After E lights the cigarette, `LIGHT UP. WATCH THE ROOM.` stays up about
20 s while I only watch. Two lines (`Light up.`, struck through as it is
done, then `Watch the room.`) are what the kit's strike is for.

### m4 (minor): the mouse glyph marks the button by leaving it dark
On `[LMB] fire` and `[RMB] steady the aim` the button to press is the one
drawn black on a white mouse (`06_teach_again_after_two_fails.jpg`, zoomed
in play). It reads as the missing half. Draw the pressed button white on a
dark mouse, or add a small L / R.

### m5 (minor): the test bed is easy for a clumsy hand
With an aim off by up to 4.6 degrees, 0.9 to 1.6 s reactions and a wrong key
first (`c1_kit_bad.json`), I won first time, twice, with 4 and 5 shots. Only
at 8.6 degrees and 1.6 to 2.6 s (`c1_kit_worse.json`) did I fail: twice, then
the walking mercy round. The bed is not a story contest, but its "bad" proof
does not show "fails some".

---------------------------------------------------------------------------
## The three proofs, mine

| contest | idle | clumsy | good |
| --- | --- | --- | --- |
| the kit's bed (`?start=kit`) | **loses**, 4 of 4 rounds; "He’s getting close." up about 1 to 4 s before; `HE REACHED YOU.`; back in about 2.8 s; after two fails the steady card again and he walks (still loses idle) | won first try twice (4, 5 shots); very clumsy: 2 fails, then won on the walking round, never stuck | won twice in a row in 2 of 3 runs (6 and 14 shots); one run failed its first round, then won twice |
| IV The Door (lane C5; the fall is the kit's) | **loses** in about 30 s, **no warning**, shot from behind unseen (B2); back at `shadows` in about 3.5 s | not played (C5's contest) | not played |
| VIII The Block (lane C8; the fall is the kit's) | **loses** in about 70 s after taking the gun, **no warning** (B2) | not played | not played |
| II The Fight (lane C4) | the lesson waits forever on its first card ("HIS GUARD IS DOWN · LEFT CLICK"): no loss, no stuck state, as wave B | | the play tool's fighter won (28 landed, 8 taken, 112 s) and walked out into III |

Nothing in the lane wins by itself.

## Cheats and losses without a tell (read in the code after playing)
- `src/game/Game.js:435-443` `onPlayerDeath` → `fail({ fall: true })` with
  no `hud.warn` before it; with `05_gunfight.js:381` and
  `shootout/rig.js:275` this is B2. Z.md §3 writes the exemption down.
- Written-down mercies, none of which wins: the bed's walker after two fails
  (`92_kit.js`, `run: G.fails('ready') < 2`; idle still loses on the walking
  rounds); VIII's aim mercy (`shootout/rig.js:311`, never under 0.55; idle
  still died); a held teach card lets the crawl go after `holdMax` 6 s
  (`kit.js` `tickTeach`): time resumes, nothing is won.
- `Game.js:429` heals the player in autopilot or the battle preset's warm-up
  only; it is not reached in the story.

## The user's asks for this lane, as played
1. **Always clear what to do. Not met.** Every chapter's first beat shows a
   line, readable and quiet (top left, a torn stroke on light ground; it
   waits for the chapter card; it survives a retry). But after the first beat
   it lies in VIII, III, V, VI, VII (B1).
2. **No mechanic thrown cold. Met on the bed, nowhere else.** `[LMB] FIRE`
   then `[RMB] STEADY THE AIM` came once; after a reload and CONTINUE neither
   came again (`flags.taught` kept); after two fails the steady card came
   once more. No chapter shows a card (M1).
3. **Lose and know why. Not met in IV and VIII.** The bed warns first, then
   black with three words, back in about 2.8 s; a click or W during the black
   does nothing (the gun stayed at 6; W walks only as the picture comes up).
   IV and VIII go down with no warning (B2), though the black, the reason and
   the return (about 3.5 s) are right.
4. **Comic stills, short, little text, skippable, BEGIN only. Met** (the ESC
   path under a real lock is untried: M4). Framed off-square panels on a
   black page, captions at most six words (`A TIP. AMES.`, `HIS MEN. MY
   DINER.`, none on the third), about 3 s each, the whole run 9.4 s; mashed
   clicks moved on only after 0.4 s; two ESCs skipped the rest of the run; no stills on
   CONTINUE, a chapter picked or `?start=`. The pictures are placeholders
   (C9).
5. **The Body removed. Met.** CHAPTERS shows I to VIII in the new order. II
   ends `E PUT AWAY`, then III with `matchbook, amesCard` and the office
   music. A wave B save (`v: 1`, `scene: 'body'`) was dropped: BEGIN and
   CHAPTERS only. A junk save was ignored. A v2 save naming `body` CONTINUEd
   into the diner. `?start=body` logs its error and plays the diner.
6. **Nothing that worked is broken. Met.** `slice.json` 29 of 29.
   `golden.py check` 32 of 32 IDENTICAL (`perf` was not captured the first
   time under load; IDENTICAL on its own retry). The diner and the fight
   play as before; Mack's new line is in.

## What is good and must not be broken by the fixes
- The fail's shape: the 0.9 s fall or the hard stop, black, three
  hand-lettered words, back at the beat with the world reset in 2.4 to
  3.5 s. The game is held under the black, and input during the black never
  fires.
- The objective line's look: small, top left, readable on light and dark
  ground, quiet after 2.5 s, waiting for the chapter card, kept across a
  retry, hidden under the stills, the pause card and the black.
- The teach card: once per save, written into the save on the next write,
  again after two fails. The key cap and glyph read at a glance.
- The warning's look: italic serif on a torn stroke, one pulse (only its
  height is wrong, M2).
- The stills player: the 0.4 s guard, the auto-advance, BEGIN only, keys
  spent at the end (none reaches the diner), the black between the page and
  the scene.
- The saves: v2, an old one dropped quietly, never a broken title.
- The order: eight rows, II into III, the inventory per chapter.
- The music rule: III cues `office`, V `car` cues `chase`, VIII's quiet
  before the Cardinal is silent on purpose (`09_shootout.js:757`), II rides
  the jukebox.
- slice.json and the 32 golden frames.

## The owner's report, read last: what of its open list a player feels
- "The stills' pictures are placeholders": every player who presses BEGIN
  sees them. Panel 2 also tells the story wrong (m2).
- "No chapter but I uses the kit…": yes, felt in IV at once (M1, B2). But
  the report does not name the worst of it: the stand-in lines do not wait
  for the lanes; they stay up and lie (B1). "What a player feels" says
  "every other chapter shows its stand-in … until its lane declares its own"
  as if that were harmless.
- "ESC under the pointer lock … not yet tried in a headed browser": the user
  will try it first thing (M4).
- "`fight` (II) still rides the jukebox: when the needle is scratched off …
  the fight is silent": felt half the time by anyone who fights; C4's.
- "Nobody has heard the kit's sounds": felt by ear on the first play; the
  user will judge them.
- The rest (file numbers, fpstable, a page reload under a long play) a
  player does not feel.
- The report's `kit_idle` "warned 4.3 s before" matches what I saw on the
  walking rounds; on the running rounds it was nearer 1 to 2 s, still
  readable.

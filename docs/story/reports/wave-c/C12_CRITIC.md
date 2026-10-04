# C12 — the cold player's report (the pad)

Played on `wave-c/C12-pad` at 0b8a63e, port 5352, every run muted, by the
fake pad through `?padfake=1` and `"input": "pad"` (0 raw key or mouse
events in every pad play), before reading `C12.md`. My plays are
`tools/plays/critic/c12_*.json`; frames in
`docs/story/review/wave-c/C12/critic/`.

The layer is good. Every chapter I tried plays by the pad alone and the
glyphs are right. Three things still break it for a pad player. The worst
is a trigger held through a retry: it goes dead, and in VI that loses the
retry for no reason he can see.

## Findings, most felt first

### 1. BLOCKER: a trigger held through a fail is dead after the retry (VI: the car will not go)
- **What:** in VI a pad player keeps R2 (the throttle) down through
  "He's getting away." / "Lost him." and the black. When the retry starts,
  the car sits at 0 km/h with R2 fully pressed, and he watches the tail
  lamps drive off. Measured 5 s after the retry: `speed 0`,
  `input.throttle 0`, `pad.stale = [7]` (R2). Let go of R2 and press it
  again: `throttle 1`. Nothing on screen says why. The game breaks rule 2
  (lost for no reason he saw) on the very first retry of the chapter. Every
  pad player holds the throttle through a black that lasts under ten
  seconds.
- **Steps:** `node tools/play.mjs tools/plays/critic/c12_tail_stale.json`
  (R2 held from the start, into the wall, "Lost him.", the retry, R2 still
  held). Frame `05_tail_retry_R2_held_car_dead.jpg`.
- **Where:** `src/input/Pad.js:195-202`. Any button over 0.3 when the
  context changes goes into `stale`, and a fail goes play → `idle` (while
  `G.failing`) → play. Then `Pad.js:250` (`throttle = stale.has(R2) ? 0 :`)
  and `:254` for the brake. The same rule should also swallow L1 (run) held
  through a fall in V or VII, L2 (rise / steady) held through a fall in IV
  or VIII, and R2 (the Tommy gun) in VIII. I measured only the car.
- **Fix:** mark buttons stale only when leaving a menu context (title,
  pause, stills, end) for play, which is the case the rule exists for (the
  ✕ that chose BEGIN). Never mark them stale on the way back from `idle` (a
  fail's black) to the same play context. The car's pedals are analogue
  and should never be stale.

### 2. MAJOR: in a fist fight, walking in on the stick a little off straight hops me aside
- **What:** in II I walked toward Mack with the left stick 33° off straight
  (x 0.55, y -0.83), and the game hopped me sideways (`KeyD`) without my
  asking. At 24° it did not. The dodge reads the stick as A / D past 0.5 on
  x, with no test of the angle and no flick. A thumb seldom pushes straight
  forward, and a hop costs time in this fight: no punch during it, and 0.25
  s before the next one. The pad player gets dodges he never meant, and the
  real dodge, the cue's flick, fails to read because the stick was already
  past 0.5 to that side.
- **Steps:** `node tools/play.mjs tools/plays/critic/c12_fight_diag.json`
  → `hops33: [[10.5, "KeyD"]]`, `hops24: []`.
- **Where:** `src/input/Pad.js:238-239` (the A / D mirror at 0.5) feeding
  `src/game/Brawl.js:499-503` (any A / D / S keydown is a hop).
- **Fix:** in context `brawl` only, make A / D (and S, the hop back) a flick:
  |x| goes past 0.65 from under 0.3 within about 150 ms, with
  |x| > 1.6 |y|. A slow drift or a diagonal walk never hops. The card
  already says "flick", so the rule would match it.

### 3. MAJOR (plausible): the aim friction works through walls and glass; IV's glass way never won by the pad
- **What:** with a gun out, the stick slows to half speed whenever the
  middle of the view is near a living man's chest. It checks every man
  within 45 m with no line of sight (`Pad.js:314-331`). Sweep the stick
  across a wall or the frosted door glass and it drags where a hidden man
  stands. That tells a pad player where unseen men are, an edge the
  keyboard player does not get. In IV's moment before the door, the second
  of the two ways through (shoot through the glass) was never won by the
  pad: 0 of 6 tries over two runs, and each try fired one round before the
  door burst ("Shot standing in the open."). The same bot on the same way
  by the keyboard won on its second try with 5 rounds (4 hits). I cannot
  say how much of this is the friction and how much is the bot's stick aim
  (its turns do not model the friction, so it under-turns near men). Either
  way, the glass way has no pad proof. The desk way does: the clumsy hands
  won the shadows on the first try and the flank on the second.
- **Steps:** `c12_door_pad_glass.json` and `c12_door_pad_glass2.json` (pad:
  0/3 and 0/3 in the shadows), `c12_door_keys_glass.json` (keyboard: won on
  try 2), `c12_door_pad_clumsy.json` (pad, desk: shadows 1st try, flank 2nd).
- **Fix:** friction only on a man the player can see: a ray from the eye to
  the chest that hits nothing solid, or the gun kit's own sight test. Then
  prove the glass way by the pad (`c5_door.mjs` `"choice": "glass"`), or
  give a hand on a real pad two tries at it in the hand test.

### 4. MINOR: on the stick, the Tommy gun's rumble never stops while R2 is held
11 rounds a second, each with a 70 ms kick no closer than 50 ms apart,
keeps the motors on about 77 % of the time while R2 is held. The ask was
"never continuous". `src/input/Pad.js:98` with `src/player/Weapon.js:15`.
Fix: one kick at the burst's start, then a kick every third round, or the
weak motor alone. (Seen in the code, not felt: there is no pad in the room.)

### 5. MINOR: the title's sound line speaks keyboard to a pad player
With the pad as the device, the keys line turns into glyphs but the sound
line under it still reads `SOUND OFF · M SOUND` (frame
`01_title_pad_bracket_but_sound_line_says_M.jpg`). M on the pad is d-pad ▼.
When sound is not yet on, the line reads `click once: sound`, but a click
on the title's background starts BEGIN when nothing is saved (the owner's
Left 8). A player who does what the line says may start the story without
choosing. Fix: draw ▼ for M, and say `any key: sound` (the keyboard's own
line already does).

### 6. MINOR: the first ✕ on an untouched title starts the game unseen
Until the pad is touched, the title shows the keyboard's line and no
bracket. The first ✕ (in real Chrome, the press that makes the pad visible
to the page) chooses BEGIN, or CONTINUE, at once: frame
`02_first_x_on_untouched_title_starts_stills.jpg` is what the first ✕
gave. A player pressing ✕ "to wake the pad" lands in the stills. Harmless
when there is no save. With a save, CONTINUE is the default, which is
fine. Suggest: the first pad press on the title only shows the bracket.

### 7. MINOR: keyboard words a pad player still meets
`hud.say('Drag a piece; the wheel turns it.')` in III's check and the Tommy
gun's `press r` note (the owner's Left 4). A pad player has no wheel. On
top of that, the check's turn card draws L2 and the hand test says L1 / R1,
so he gets two answers. Make them one, through the kit's token table.

### 8. MINOR: the d-pad in play
▲ ◄ ► are all Q (the toys and the horn) and ▼ toggles the sound. A pad
player who reaches for the d-pad in play, as he would in a menu, mutes the
game (a `sound off` note shows). Also, L3 runs only while held, not as a
toggle, and running on L1 while working both sticks is a claw. Both are by
the rulebook. Leave them unless the hand test says otherwise.

## The three proofs, by the pad (mine)

| Contest | Idle (hands off / the pad's "hold W") | Bad | Good |
| --- | --- | --- | --- |
| II The Fight | left stick held into him 150 s: down 5 times, never won, "One more and you're down." before each (`c12_fight_pad_stick`) | `fight_bot` bad: 7 downs, each warned 2.2-16.8 s before, won on the 8th life, no mercy (`spared 0`) (`c12_fight_pad_bad`) | `fight_bot` good: won twice in a row, 56 s and 91 s, no downs (`c12_fight_pad_good`) |
| VI The Tail | R2 only, no wheel: into the wall at 8 s, "He's getting away." 4 s, "Lost him." (`c12_tail_pad_r2only`) | (keyboard proofs of C3 stand; the pad adds nothing here but finding 1) | the tail bot, seed 3 (not the owner's 7): won first try, one round, the shunt, the wreck, the pier, VII (`c12_tail_pad_good`) |
| IV The Door | the pad sends nothing with no input, so hands off is the keyboard's idle (C5's proof); the open-stander loses every try, warned 4-7 s before (`c12_door_pad_bad`) | clumsy (desk): shadows 1st try, flank lost then won (`c12_door_pad_clumsy`) | desk: the owner's play; **glass: 0 of 6** (finding 3) |
| VII the foreman | not run | not run | `fight_bot` good: won, 2 downs (`c12_pier_fight_pad`) |
| VIII The Block | not run | not run | the b7 gunman whole by the pad: every beat to THE END, 1 death (`c12_shootout_pad`) |
| V The Watcher | not run | not run | over the row, the way the owner did not take: through, no fail (`c12_watcher_row`) |
| III Room 304 | - | - | solved by the pad, the owner's order (rub, dial, check, PIER 9). My other order failed at a walk, and failed the same way by the keyboard (`c12_office_keys`): the driver, not the pad |

## The user's asks

1. **Every chapter and mode by the pad alone:** **not met**, for finding 1
   (a retry in VI starts with a dead car) and finding 3 (IV's glass way
   unproven by the pad). Everything else I touched works: the title,
   CHAPTERS (▼ ×3 to IV, ○ shuts the list), CONTINUE (highlighted first),
   the stills by ✕, the pause by options, I to the order, II both ways and
   the search and the card, III, IV (desk), V, VI, VII's fist fight, VIII.
   Not seen by me: VII's stealth pass, the pause's rumble toggle in play.
2. **The mapping as a table:** met (`C12.md` §2, with the hand test in §9).
   In the car one button does not keep one meaning (R2 throttle, R1 fire,
   L1 lean, against fire, smoke and run on foot). The brief allowed it, and
   the car's cards draw it.
3. **Glyphs for the last device:** met in play. On IV's fire card the keys
   drew LMB; touching the right stick redrew it as R2 while it was up; R
   on the keyboard turned it back to the keys (frame
   `03_card_keys_top_pad_bottom_redrawn_live.jpg`). The prompt's □ (frame
   `04_card_read_put_away_square.jpg`), the stills' ✕ / options, the
   title's and the pause card's lines all followed. The exceptions are
   findings 5 and 7.
4. **Keyboard unchanged:** met. `slice.json` 35/35, `kit.json` 19/19,
   golden 38/38 IDENTICAL, build clean.
5. **Rumble:** not met (minor): discrete in the fight (132 short effects in
   160 s) and the car (jolts 0.1-1.3 s apart), but near-continuous on a
   Tommy burst (finding 4). The off switch shows on the pause card (`rumble
   on`). I did not toggle it in play: my ▼ wrapped round to RESUME.
6. **Proofs by a fake pad through a hook:** met. `tools/play.mjs` has the
   `pad` step and `"input": "pad"`, and FAILs any raw key or mouse event. I
   ran my own variants: the fight twice, the tail on another seed, the
   office, the door clumsy and glass, the menus with CHAPTERS, CONTINUE and
   the pause, V the other way, VII's boss, VIII whole.

## Cheats

- Nothing wins for the player. The friction (`Pad.js:314-331`) slows the
  look, never moves it, and is written down (`C12.md` §7). But it reads
  men through walls and glass (finding 3).
- One thing loses without a tell: the stale trigger after a fail
  (`Pad.js:195-202`, `:250`, `:254`) (finding 1).

## The owner's Left, as a player would feel it

- Left 1 (no real pad): the hand test is the only proof of the real
  mapping, the rumble and the lock after resume. Fair.
- Left 2 (a fight that never ended, the reel without the KO): I did not see
  it in four pad fights (II ×3 including bad, VII ×1). If it happens to the
  user it is a stuck state. The fight's owner should look.
- Left 3 (the aim out of the car's window is slow): my run hit his tyre
  with the first round. Not felt here.
- Left 4 is my finding 7. Left 8 is my finding 5.

## What is good and must not be broken

- The pad holds the game without the pointer lock: ✕ on BEGIN runs the
  stills and the diner with no click, and nothing waits for the mouse.
- The ink bracket on the title, the chapter list and the pause card. ○
  shuts the list. Options pauses and resumes. CONTINUE is highlighted first.
- The glyphs: □ on the prompt, ✕ / options on the stills, R2 on the fire
  card, ✕ on the handbrake card, the keys line in glyphs, the live redraw
  when the device changes. They are drawn in the kit's ink and read
  clearly.
- The fight's mapping (L2 the left fist, R2 the right): the good hands won
  twice, bad got through, idle lost, all by the pad.
- The car's analogue pedals and wheel, and L1 lean + R1 fire with R2 kept
  down: the good hands won VI on a new seed with one round.
- The keyboard untouched: slice, kit, golden identical. The shot mode never
  attaches the pad.
- The play tool's pad mode, which refuses a raw key or click: it is what
  made every proof above honest.

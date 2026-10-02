# C1 — the kit: objective, teach, fail, stills, and the new chapter order

Branch `wave-c/C1-kit`, port 5341. You own `src/ui/Hud.js`, `src/game/Game.js`,
`src/game/SceneManager.js`, `src/game/Save.js`, `src/scenes/order.js`,
`src/main.js`, `src/audio/Music.js` for this lane. Seven other lanes will
code against what you build, so it is small, plain and documented:
write the contract as `docs/story/seams/Z.md` (signatures, one example each,
what a scene must not do). **Speed matters here: two other lanes are
waiting for this. Whole and merged-able first, pretty second.**

Read `docs/story/WAVE_C.md` first (all of it): §1 to §5 are what this kit
exists to serve.

## 1. The objective line — `hud.objective(text | null)`
A few words, top left, small, in the game's lettering (look at how
`Hud.js` draws the prompt and the cards; `ui/inkArt.js`). When it changes
it writes itself in (a quick brush-on, a soft tick of sound) and then sits
at low contrast; it is never in the way of the picture. `null` clears it.
It is dropped at scene exit, hidden in shot mode unless `&hud=1`, hidden
under cards and stills. A done objective may strike itself through for a
moment before the next writes in. Survives a retry (the scene sets it in
each beat's `setup`, so a cold `?scene=&beat=` shows the right one).

## 2. The teach card — `hud.teach(id, text, opts?)`
One line with the key drawn as a key cap (`[SPACE] vault`, `[C] get low`;
`[LMB]` / `[RMB]` as little mouse glyphs). Shown at the moment of need,
once per save (`save.flags.taught[id]`), for about three seconds or until
the key is used (`opts.until` = a key code or a predicate). `hud.teach.again(id)`
shows it once more: a scene calls it when the player has failed that thing
twice. It must not stop the game unless `opts.hold` is set (a held teach
slows time to a crawl until the key is pressed: only for the very first
dodge, vault and crouch in the game). Returns a promise / takes a callback
for when it is dismissed.

## 3. The warning and the fail — `hud.warn(text)`, `game.fail({ why, to, fall? })`
- `hud.warn(text)`: the line that must come before a loss ("He's getting
  away.", "They've seen something."). Centre low, pulses once, goes when
  the danger passes (`hud.warn(null)`).
- `game.fail({ why, to, fall })`: the one way a chapter loses. `fall: true`
  is the short fall of a man shot (0.9 s; look at how scene 5 and 9 do it
  now and lift it into the Game so they all share one); otherwise a hard
  stop. Black, `why` in a few words on the black (hand lettering, small),
  then `scenes.go(current, { beat: to })` with the world as that beat's
  `setup` makes it. Under ten seconds from the fail to control. It counts
  fails per beat (`game.fails(beatId)`), which `teach.again` and the
  scenes' mercy rules read. Health reaching zero calls it with the scene's
  own `why` and `to` (`scene.onDown` or a default the scene sets with
  `game.setCheckpoint(beat, why)`).

## 4. Stills — `game.stills.play(id, opts?)` → promise
Comic panels over black: WAVE_C §5. Data in `src/stills/<id>.js`
(`{ panels: [{ img, caption?, secs?, from?, to? }] }`, read with
`import.meta.glob` as the other seams are); images are files under
`public/stills/` made later by lane C9. Build the player now with
**placeholder panels** (flat ink shapes drawn on a canvas at load, one per
panel in the table of WAVE_C §5, so the timing and the story can be judged
before the pictures exist):
- a panel is a framed picture on the black page (a white gutter, a hand-
  drawn black frame line, slightly off square, as a comic's), not full
  bleed; one, two or three panels may share the page and come in one after
  another, the earlier ones staying;
- a slow drift inside the frame (`from` / `to`: a rect or a scale and
  offset), never a zoom you notice;
- the caption in a lettered box at a corner of its panel, capitals, at most
  six words;
- a click, E, SPACE or Enter moves on (after 0.4 s, so a mashed key does
  not skip one unseen); it moves on by itself after `secs` (2 to 4);
  holding ESC or pressing it twice skips the run;
- the game is paused under it, the music slot keeps playing, sounds duck;
  a soft paper sound as each panel lands;
- in shot mode `?still=<id>&panel=<n>` renders one page deterministically
  (for the golden frames later).
Wire the opening run before chapter I on BEGIN only (not on CONTINUE, not
on a chapter picked), and leave the other calls to the lanes that own
those moments.

## 5. The chapter order
`order.js`: I diner, II fight, III office (Room 304), IV gunfight (The
Door), V watcher (The Watcher), VI tail (The Tail), VII warehouse (Pier
Nine), VIII shootout (The Block). `body` leaves the order; **do not delete
its files** in this lane (the alley part of the block and the table-puzzle
code may be reused by other lanes; move `03_body.js` out of the scenes'
glob only if it must not load, e.g. rename the scene files so their
numbers match the new order and park the body's as `_body_cut.js`, which the
glob skips as it skips `_diner_room.js`: check how the manager globs).
Then everything that names a chapter by number or expects `body`:
- the fight's last beat goes on to `office` (lane C4 will rebuild that
  ending: for now `ctx.next()` must simply land in Room 304 with the
  inventory the story has given: `matchbook`, `amesCard`);
- every scene's cold-start inventory (grep `INV`, `inventory`, `tornHalf`,
  `matchbookHalf`, `note`, `ledger`) agrees with WAVE_C §4 "What the
  detective carries"; keep the old names working where a scene still reads
  them, until its lane rebuilds it;
- saves: bump to `v: 2`; a `v: 1` save is dropped quietly (BEGIN and
  CHAPTERS only);
- CHAPTERS shows eight rows; `?start=body` reports and plays the diner;
- the README's and ARCHITECTURE's chapter lists (a few lines; lane C10
  rewrites the documents at the end).

## 6. The music cues that are wrong today
`end` is not stopped when the end card is clicked; a CONTINUE in the
shootout after `cars` has no `shootout` cue (and scene 6's car beat, the
same); `fight` is never cued. Make the rule general in the manager rather
than three patches: a scene declares its slot (and a beat may override it);
entering a scene **or continuing into any beat of it** cues it; leaving
stops it unless the next scene declares the same slot. `docs/story/MUSIC.md`
gets the rule in a paragraph.

## 7. The plays
The old plays that pass through the body (`whole.json`, `saves.json`,
`body*.json`, `chapters.json`) will not pass any more. Fix `chapters.json`
and `slice.json` and `continue.json`; park the others under
`tools/plays/_wave_b/` (lane C10 rebuilds the whole-game play at the end).
Add `tools/plays/kit.json`: BEGIN → the opening stills (stepped through by
clicks, and once skipped) → the diner's first beat with its objective line
showing; a teach card shown once and not twice; `game.fail` from a debug
hook lands back at the beat (`?kitdemo=1` may add a tiny demo to the range
scene for this).

## 8. Where the kit is used at once (so it is proven, not just built)
- The diner (I): its objective line per beat (short: `Light up.`,
  `Order.`, `Pay.` or better; do not change the scene otherwise).
- Every other chapter's first beat gets a first objective line as a
  stand-in (one line each, from WAVE_C §4), so no chapter starts without
  one while its lane has not got to it yet.

## Gate
WAVE_C §7's gate where it applies (build; golden check identical: the HUD
additions are hidden in shot mode; errors clean on the first beat of every
chapter; `kit.json`, `slice.json`, `chapters.json`, `continue.json` twice).
Report `docs/story/reports/wave-c/C1.md`.

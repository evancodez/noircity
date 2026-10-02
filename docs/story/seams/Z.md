# Wave C seams: the kit (lane C1)

Every chapter loses, teaches and tells the player what to do the same way.
This is how (WAVE_C.md §1 to §5). Signatures, one example each, and what a
scene must not do. The code: `src/ui/kit.js` (the lines), `src/ui/Hud.js`
(the calls), `src/game/Game.js` (the fail), `src/game/Stills.js` (the stills),
`src/game/SceneManager.js` (the declarations), `src/scenes/order.js` (the
chapters' defaults). The test bed is `src/scenes/92_kit.js` (`?start=kit`):
one small contest that uses all of it; read it before you use the kit.

Everything below is on the HUD, so it is hidden in shot mode unless `&hud=1`
(the golden frames do not see it), hidden under the title, the pause card,
a chapter card, the stills and a fail's black; a line or a card that comes
while it is hidden waits, unseen, and comes when it can be read. All timers
run on game time (a fail's timeline and the stills on real time: the game is
held still under them).

Look params (shot mode, with `&hud=1`): `obj=<text>`, `warn=<text>`,
`teach=<text with [KEYS]>`, `fail=<words>` hold that line over a beat's
frame; `still=<id>&panel=<n>` a stills page (no `hud=1` needed).

A shim for a lane that starts before this is merged (C3's brief asks for
one): call `hud.objective`, `hud.teach`, `hud.warn`, `game.fail` only when
they exist (`if (game.fail) ...`), and drop the shim when it is merged.

---------------------------------------------------------------------------
## Z1. The objective line: `hud.objective(text | null, opts?)`

A few words, top left, in the typewriter's capitals on a thin torn stroke.
A new line is brushed in left to right (0.45 s, a dry brush sound), sits at
full strength 2.5 s, then settles to low contrast. Changing it strikes the
old one through first (0.3 s, held 0.45 s), then writes the new.

```
hud.objective('Catch him before the pier.')          // write in (strikes the last)
hud.objective('Get to the car.', { strike: false })  // replace without the strike
hud.objective(null)                                  // take it away (fades)
hud.objective('Stay alive.', { now: true })          // at once, no animation
hud.objectiveText                                    // what it says (or is about to)
```

- The same text again does nothing (no second write-in).
- **Declare it, do not call it, where you can.** A scene file may give
  `objective: 'one line for the scene'` or `objectives: { beat: 'line' }` in
  `defineScene`: the manager sets the beat's line when the scene is entered
  at that beat (a cold `?scene=&beat=`, a CONTINUE, a retry) and when the
  script's `yield beat(name)` begins it. Call `hud.objective` yourself only
  for a change inside a beat (the goal moved: "Get to the car.").
- A scene that declares nothing shows its chapter's stand-in from
  `src/scenes/order.js` (`objective`, and `objectives` for the beats whose
  goal changes: II's `ko`, `outside`), so no chapter starts without one.
- Entering another scene drops it; a retry of the same scene keeps it (and
  its beat's line is set again: no flicker, no second write-in).
- Must not: a wall of text (a few words, eight at most), a second line, a
  hint that does the playing ("Press E on the left door"). The world shows
  the way; the line says the goal.

```js
// src/scenes/01_diner.js
export default defineScene({ id: 'diner', beats: ['settle', 'order', 'drink', 'pay'],
  objectives: { settle: 'Light up. Watch the room.', order: 'Order a drink.', drink: 'Drink. Watch the big man.', pay: 'Pay the tab.' },
  /* ... */ });
```

---------------------------------------------------------------------------
## Z2. The teach card: `hud.teach(id, text, opts?) -> handle`

One line with the key drawn as a key cap, centre low, at the moment of
need. `[X]` in the text is a key cap: `[SPACE]`, `[E]`, `[C]`, `[R]`, `[A]`,
`[D]`, `[SHIFT]`, `[CTRL]`, `[ESC]`; `[LMB]` and `[RMB]` are little mice
with that button inked. Use the rulebook's keys (WAVE_C §2) and its words.

```
const h = hud.teach('vault', '[SPACE] vault', { until: 'Space' });
yield until(() => h.done);          // or: await h / h.then(...) / opts.onDone
hud.teach.again('vault');           // once more (after two fails of it)
hud.teach.dismiss();                // the one up and the queue, now
```

- **Once per save**: shown, it is marked in `save.flags.taught[id]` and
  never shown again in this save (BEGIN and a chapter picked start a fresh
  save; CONTINUE keeps it). `again(id)` shows it once more regardless: call
  it when the player has failed that thing twice (`game.fails(beat) >= 2`).
- `opts.until`: a key code (`'Space'`, `'KeyC'`, `'Mouse2'`), a list of
  them, or a predicate `() => bool`; the card goes when it is met. Default:
  the codes of the key caps in the text (`'[A] [D] step aside'` waits for
  either). `until: false`: time only.
- `opts.secs` (default 3.2): how long it stays when the key is not used.
- `opts.hold: true`: **only for the very first dodge, vault and crouch in
  the game.** Time crawls (x0.12) until the key is pressed, at most
  `opts.holdMax` (6) real seconds, then runs on (an idle player still loses).
- One card at a time: another is queued behind it. A card waits, unseen,
  while a chapter card, the stills or a fail's black is up: its time starts
  when it can be read. A scene leaving (or a fail) dismisses it.
- The handle: `{ id, shown, done, then }`. Already taught: `done` at once,
  `shown` false.
- Must not: teach in the middle of danger (find the safe second, or hold);
  teach what was taught (the same verb is the same key everywhere); write
  the key as text ('Press SPACE'): the cap is drawn for you.

---------------------------------------------------------------------------
## Z3. The warning and the fail

### `hud.warn(text | null)`
The line that must come before a loss ("He's getting away.", "They've seen
something."). Centre low, italic, on a torn stroke; it pulses once as it
comes, with a low thump; it stays until `hud.warn(null)` (fades in 0.4 s).
The same text again does nothing, so a scene may set it every step from a
condition:

```js
ctx.onStep(() => ctx.hud.warn(gap() > 22 ? 'He’s getting away.' : null));
```

### `game.fail({ why, to, fall, keepWorld, hold }) -> bool`
**The one way a chapter loses.** `why`: a few words on the black ('Lost
him.', 'They saw you.', 'Wrecked.'). `to`: the beat to go back to (default:
the current beat). `fall: true`: the short fall of a man shot (0.9 s: the eye
sinks and tips, a grunt, the floor), else a hard stop (the frame holds). Then
black, the words in hand lettering, and the scene re-entered at `to` under
the black: **the world as that beat's `setup` makes it.** About 3.3 s from a
fall to control, 2.4 s from a stop.

- By default the black takes the stage's Hoods, the shots in flight, the
  director's encounter and the fx marks away (the setup puts back what the
  beat has). `keepWorld: true` keeps them (a scene whose setup keeps the dead
  of earlier beats). Health is reset, the brawl stopped, the controls back.
- While a fail runs: `game.failing` is set, `game.live` is false (no shot of
  theirs hits, no gun of mine fires), the HUD's lines are hidden.
- **Fail counts**: `game.fails(beat?)` is how often the player has failed in
  that beat of this scene (default the current beat; kept across retries,
  reset when another scene is entered). Mercy rules and `teach.again` read it.
- **Health reaching zero** calls `game.fail({ fall: true, ... })` with, in
  order: the scene's `onDown` (`{ why, to }` or `(ctx) => ({ why, to })` in
  `defineScene`), else `game.setCheckpoint(beat, why)`'s, else `'Down.'` at
  the current beat. (IV The Door and VIII The Block still set
  `health.onDeath` themselves, but their falls now go through `game.fail`:
  IV with 'They got you.' back to `shadows`, VIII with `keepWorld` back to the
  beat, so all three share the one fall. Their lanes may move to `onDown`.)
- Events: `fail` `{ why, to, from, scene }` when it starts, `fail:back`
  `{ scene, beat }` when control is back.

```js
// a chase: the warning first, then the fail, back to the stretch's start
if (gap > 30 || unseen > 6) ctx.game.fail({ why: 'Lost him.', to: stretchBeat });
else ctx.hud.warn(gap > 22 || unseen > 3 ? 'He’s getting away.' : null);
// a gunfight: what going down means here
defineScene({ id: 'gunfight', onDown: { why: 'They got you.', to: 'shadows' }, /* ... */ });
ctx.game.setCheckpoint('window', 'The window man got you.');   // later in the scene
```

- Must not: roll your own black, fall, retry card or lose text; call
  `scenes.go` yourself to retry; lose without a warning first (§1 rule 2:
  the warning must be on screen at least a second before a fail that is not
  a hit); fail on one miss where several are fair.

---------------------------------------------------------------------------
## Z4. Stills: `game.stills.play(id, opts?) -> handle`

Comic panels over black (WAVE_C §5). The game is paused under them (the sim
does not step), the music plays on, the rain ducks; each panel lands with a
paper sound. A click, E, SPACE or Enter moves on (0.4 s after a panel lands,
so a mashed key never skips one unseen); a panel moves on by itself after
its `secs`; ESC twice (or held) skips the run. Ending, the page goes to
black: what comes next comes up out of the black itself.

```js
// the end of II (lane C4): the card, then on to III
const h = ctx.game.stills.play('ames');
yield until(() => h.done);     // (h.skipped: it was skipped)
ctx.next();
```

The runs (`src/stills/<id>.js`), with placeholder pictures until lane C9's:

| id | where | who plays it | panels |
| --- | --- | --- | --- |
| `opening` | before I, on BEGIN only (Game.start) | C1 (done) | 3: `A TIP. AMES.`, `HIS MEN. MY DINER.`, the neon (no words) |
| `ames` | end of II | C4 | 1: `AMES. MARKED.` |
| `check` | III, the check assembled | C5 | 2: `DOT'S HAND.`, `SHE SENT HIM TO THEM.` |
| `photo` | VII, the office | C7 | 1: `NOT HIS GIRL. HIS NEXT.` |
| `diner` | VIII, before the diner | C8 | 1: `THE DINER.` |
| `end` | the end | C8 | 1: the hat, the ember (no words) |

**Data** (`src/stills/<id>.js`, read with `import.meta.glob`; a name that
starts with `_` is not a run):

```js
import { ART } from './_art.js';
export default { panels: [
  { img: 'stills/ames_1.jpg', draw: ART.ames, caption: 'AMES. MARKED.', secs: 3.4,
    from: { s: 1.02, x: 0, y: 0 }, to: { s: 1.08, x: 0.008, y: -0.006 } },
] };
```

- `img`: a file under `public/` (lane C9's picture); until it loads,
  `draw(g, w, h, rng)` paints the placeholder (flat ink shapes on a canvas
  already black: `src/stills/_art.js`). A missing file is quiet.
- `caption`: six words at most, capitals, in a lettered box at a corner
  (`cap: 'tl' | 'tr' | 'bl' | 'br'`, default `'tl'`); none for a wordless one.
- `secs`: 2 to 4 (default 3). `from` / `to`: the slow drift inside the frame
  (`s` scale, `x` `y` offset as a share of the frame), never a zoom you notice.
- `newPage: true` starts a fresh page; a page holds up to three panels laid
  out by count (one large; two side by side; two over one wide), earlier ones
  staying as the next come in. `rect: { x, y, w, h }` (shares of the page)
  places one by hand; `aspect` is the picture's width / height.
- Shot mode: `?still=<id>&panel=<n>` renders the page of panel n with panels
  0..n landed, the drift at its middle (deterministic: for golden frames).
- `game.stills.active`, `.has(id)`, `.skip()`, `.last` (`{ id, skipped,
  panels, secs }` of the last run); event `stills:end` `{ id, skipped }`.
- Must not: a still made of a screenshot of play (C9 stages a tableau);
  more than six words; a run longer than four panels; stills on a retry or a
  CONTINUE (play them where the story first gets there, once).

---------------------------------------------------------------------------
## Z5. The order and a chapter's defaults: `src/scenes/order.js`

`ORDER = [{ id, numeral, title, objective?, objectives?, music?, beatMusic?, carry?, flags? }]`:
I `diner` The Diner, II `fight` The Fight, III `office` Room 304, IV
`gunfight` The Door, V `watcher` The Watcher, VI `tail` The Tail, VII
`warehouse` Pier Nine, VIII `shootout` The Block. **The Body is cut**: its
scene file is parked as `src/scenes/_body_cut.js` (the manager skips files
that start with `_`), its alley and puzzles are still in the tree
(`stages/block/parts/alley.js`, `scenes/body/*`); `?start=body` is reported
in the errlog and BEGIN plays the diner.

`defineScene` takes `objective`, `objectives`, `music`, `beatMusic`, `carry`, `flags` from
the chapter's entry unless the scene file gives its own (the file wins: a
lane overrides the defaults in its own `defineScene`, never in order.js).

**What the detective carries** (`carry`, WAVE_C §4; added to
`save.inventory` when the scene is entered, never taken away; `flags` set
where not already set):

| chapter | carry | flags |
| --- | --- | --- |
| I, II | nothing | |
| III office | `matchbook`, `amesCard` | |
| IV gunfight, V watcher, VI tail, VII warehouse | + `check`, `revolver` | `note: 'PIER 9'` |
| VIII shootout | + `shells` | `note: 'PIER 9'` |

Old names (`matchbookHalf`, `note`, `ledger`, `tornHalf`) are no longer
carried; scene 4 still pockets `ledger` with the `check` until lane C5
rebuilds the safe's find. "Empty after VI" (the revolver's last rounds spent
on his car) is lane C3's and C7's to keep (the revolver's chambers): no flag
here yet. The Tommy gun is VIII's (it is handed over in the scene).

---------------------------------------------------------------------------
## Z6. The music rule (also `docs/story/MUSIC.md` "The rule")

A scene declares its slot, `music`, and a beat may override it,
`beatMusic: { beat: spec }`. A spec is `'slot'`, `{ slot, fade }`, `null`
(silence, a 2 s fade), `{ stop: fade }`, `'room'` (the scene plays its own
diegetic music: the manager leaves it alone) or undefined (not declared:
left alone). **Entering a scene, or continuing into any beat of it (a
CONTINUE, a retry, a chapter picked), cues the beat's spec (its beatMusic's,
else the scene's); a beat of beatMusic cues its own as it begins.** Leaving
a scene stops its slot only through the next scene's declaration (another
slot crossfades, the same slot plays on, null stops it); the title stops
any music; BEGIN does too. A scene's own `music.cue` / `music.stop` in its
script still work (a cue at a moment inside a beat: the watcher's umbrella).

| chapter | music | beatMusic |
| --- | --- | --- |
| I diner, II fight | `'room'` (the jukebox) | |
| III office | `office` (2.5 s) | |
| IV gunfight | `{ stop: 2.5 }` | |
| V watcher | `null` (the umbrella cues `chase`) | escape, run, car: `chase` (0.4 s) |
| VI tail | `tail` (2.5 s) | |
| VII warehouse | `warehouse` (1.5 s) | fight, ko: `fight` (2.5 s); after: `{ stop: 3 }` |
| VIII shootout | `null` | cars, doorways, el, driveby: `shootout` (2.5 s) |

---------------------------------------------------------------------------
## Z7. Saves

`localStorage['noir.save'] = { v: 2, scene, beat, flags, inventory }`. A save
of another version is dropped quietly (the title offers BEGIN and CHAPTERS
only). Written when a scene is entered (a retry included) and when a beat in
`save: [...]` begins. `flags` keeps plain values and one level of plain
objects (`taught`, a lane's own record such as `b6taught`). BEGIN and a
chapter picked start with empty flags and inventory (then the chapter's
`carry`); CONTINUE restores the save's.

---------------------------------------------------------------------------
## Z8. The kit's test bed and the plays

`?start=kit` (`src/scenes/92_kit.js`, not in the order): a man walks up the
avenue at me; the revolver is out. The objective, two teach cards (`[LMB]
fire`, `[RMB] steady the aim`; the second once more after two fails), the
warning at 7 m, the fail ('He reached you.') back at `ready`; won, 'Done.'
and the round again (`game.kitWins`). The plays: `tools/plays/kit.json`
(the stills, the objective, teach once, the fail from a debug hook),
`kit_idle.json`, `kit_bad.json`, `kit_good.json` (the three proofs of
WAVE_C §7 on the test bed's contest).

The counters (`#counters`, `tools/counters.sh`, a play's `K`) carry
`objective`, `warn`, `teach` (the card up), `stills` (the run up), `failing`
(its phase), `music` (the slot), `fails` (all fails so far).

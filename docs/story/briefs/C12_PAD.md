# C12 — play it with a PS5 controller

Branch `wave-c/C12-pad`, port 5352. The user asked: "make it possible to
play the game with a PS5 controller." Every chapter, every mode, the
title, the pause, the puzzles and the stills, with the pad alone after
the one click the browser needs.

Read `docs/story/WAVE_C.md` §2 (the rulebook: one key, one meaning), the
kit's contract `docs/story/seams/Z.md` (teach cards draw keys), the
controller and its modes (`src/player/Controller.js`,
`src/player/modes/*.js`), the brawl's input (`src/game/Brawl.js` input()),
the drive mode and the car (`modes/drive.js`, `vehicles/Car.js`:
`input.throttle/brake/steer` are already analogue 0..1), the gun mode,
the puzzles that use the mouse (`scenes/office/pad.js`, `safe.js`, the
torn check: `scenes/body/note.js` reused by III), the title and pause
(`src/ui/Hud.js`, `main.js`), the stills player (`src/game/Stills.js`).

## 1. One input layer, nothing else changes
`src/input/Pad.js`: reads `navigator.getGamepads()` every frame (the
DualSense is a standard-mapping gamepad in Chrome: buttons 0 cross, 1
circle, 2 square, 3 triangle, 4 L1, 5 R1, 6 L2, 7 R2, 8 share, 9 options,
10 L3, 11 R3, 12–15 d-pad, 16 PS, 17 touchpad; axes 0/1 left stick, 2/3
right stick; triggers also as analogue buttons). It turns pad state into
what the game already reads: key down/up events for the rulebook's keys
and mouse deltas and buttons for the look and the fists, so every mode
works unchanged, plus an analogue channel the modes that want it read
(`pad.axes.move`, `pad.axes.look`, `pad.trigger.l/r`). Deadzones (0.12
sticks, 0.05 triggers), a response curve on the look stick (gentle in
the middle, fast at the edge), a sensitivity the pause's settings can
change. The pad is active once any of its controls moves; the last device
used (pad or keyboard/mouse) is remembered (`input.last`), and the kit
draws its cards for that device. Keyboard and mouse keep working at the
same time.

## 2. The mapping (one pad, one meaning: it mirrors the rulebook)
| Pad | Key / mouse | Everywhere |
| --- | --- | --- |
| left stick | WASD (analogue where a mode can use it: walk speed, the car's steer) | move / steer |
| right stick | mouse look | look |
| **R2** | LMB | fire, jab (right arm), rub, throw, swing |
| **L2** | RMB | the left fist in a fist fight; steady the aim / rise over cover with a gun; aim out of the window in the car |
| **✕ (cross)** | SPACE | block, vault, jump, handbrake |
| **○ (circle)** | C (a tap toggles the crouch; held past 0.3 s acts as Ctrl, released stands) | get low, slide |
| **□ (square)** | E | use / take / open |
| **△ (triangle)** | R | reload |
| **R1** | F | smoke (and the room toys where F is) |
| **L1** | Shift | run |
| d-pad | Q / M and the menus | the horn in the car, sound, up/down in lists |
| **options** | ESC | pause / skip a stills run (twice) |
| **touchpad press** | Tab or nothing | (the objective line is always up: no map) |
| left stick ◄ ► in a fist fight | A / D | the dodge |
In the car the triggers are analogue: R2 throttle, L2 brake / reverse,
and while the gun is out (L1 held, see below) R2 fires. Pick the simplest
honest scheme for the car's gun and write it in the card: a candidate
is L1 = lean out and aim (hold), R2 = fire while leaning, so the throttle
is let go to shoot, which is the trade-off the keyboard has (RMB + LMB
while steering).

## 3. The things the mouse did that have no stick
- **Menus** (the title's BEGIN / CONTINUE / CHAPTERS, the chapter list,
  the pause and its settings, THE END's card): d-pad or left stick moves
  a highlight, ✕ chooses, ○ or options goes back. The highlight is drawn
  in the game's lettering (an ink bracket), never a browser focus ring.
- **The stills**: ✕ moves on, options twice (or held) skips.
- **The puzzles that drag and turn** (the pad's rub, the dial, the torn
  check, the strings if any): the right stick moves the game's own
  cursor (`hud.cursor` exists), R2 holds as LMB, L2 as RMB, L1 / R1 turn
  a piece as the wheel does. The cursor speed suits a stick (and a
  gentle pull toward the nearest piece is allowed if it plays better).
- **The pointer lock**: a pad player makes one click on the title (the
  browser's gesture); after that nothing waits for the mouse. Check every
  place the game waits for the lock or for a click (`main.js`, the title,
  the pause's resume, the fail's black, the stills) and let ✕ or any pad
  button stand in.

## 4. Teach cards and prompts for the pad
The kit's cards and the E prompts write `[SPACE]`, `[C]`, `[LMB]`: with
the pad as the last device they draw the pad's glyphs instead (✕ ○ □ △
as the PlayStation shapes in the game's ink; R2 / L2 / L1 / R1 as small
shoulder caps; the sticks as a little stick glyph). One table in
`src/ui/kit.js` (or `src/input/glyphs.js` the kit reads) maps key token
→ glyph; a card already shown re-draws if the device changes while it is
up. The README's key line gets a pad column.

## 5. Rumble (small, honest)
`gamepad.vibrationActuator.playEffect('dual-rumble', ...)` where it is
available: a short kick on every shot I fire, a heavier one when I am
hit, a thud on a punch landing or taken, a buzz on a car's scrape and a
hit on a thing, the dodge cue's slowdown as a soft pulse. Off in the
settings. Never continuous.

## 6. Proof without a pad in the room
A debug hook (`window.__pad = { buttons[], axes[] }` or a
`?padfake=1` that `Pad.js` reads instead of `navigator.getGamepads`)
lets `tools/play.mjs` drive the pad; add a `pad` step to the play tool
(`{ pad: { b: [...], a: [...], secs } }`). Proofs (`tools/plays/pad_*.json`,
each once): the title to chapter I by the pad alone; the fist fight's
good play by the pad (dodges, both fists, block, take); the tail's good
play by the pad (analogue steer, the handbrake, the gun out of the
window); the office puzzle solved by the pad (rub, dial, the check); the
gunfight's good play by the pad (crouch, rise, reload); the stills
clicked through and skipped; CONTINUE and CHAPTERS by the pad. Each by
real synthetic pad input through the hook, with the keyboard never used.
And the hand test the user will do: write in the report exactly what to
press in each mode, in order.

## Gate
Build; golden check identical (the pad draws nothing in shot mode);
errors clean on every chapter's first beat with `?padfake=1`; the proofs
above; `slice.json` and `kit.json` still pass with the keyboard. Report
`docs/story/reports/wave-c/C12.md`. Hours, not a day.

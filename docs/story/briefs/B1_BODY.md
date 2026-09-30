# B1 — Scene 3, The Body (`body`), on the block

Read `docs/story/WAVE_B.md` first: it is the standard and the way of
working. This is your scene, end to end. Branch `wave-b/B1-body`, dev port
5311. Music slot `body`.

## The place
The side alley already has its site on the block: the cross street off the
west pavement, x from the building line back 14 m, z -30 .. -24, closed by
the wire gate with the van behind it; the wall lamp's fixture at
`block.alley.lamp` (unlit), the mouth at `block.alley.mouth`
(`src/stages/block/parts/bounds.js` near "the cross street"). Build the
alley in a part of your own (`src/stages/block/parts/alley.js`, order after
150): brick with a fire escape on the north wall (a drop ladder, one
landing at about 4 m that a man can stand on, a second above it in the
dark), bins, a drain and gutter the blood runs to, a doorway with one dry
stone step under the wall lamp (the table for the paper puzzles), wet
cobbles. Light the wall lamp when the scene starts (it must stay off in the
accepted frames: `lamp.on = false` until then): one cone in the rain, the
body at its edge, everything else black. This is the most "reference"
frame in the story: compose it.

## The beats (each a `?scene=body&beat=` with a `setup`)
1. `approach` — I stand where scene 2 left me (by Mack at
   `diner.pavement.ko`, the matchbook pocketed, two shots just heard). Down
   the pavement a car's red tail lamps (crew) pull out of the alley mouth
   and go (your own rail, the block's car model). The alley lamp is the
   only goal in the frame. I walk the thirty metres. Give the walk
   something: his hat turning in the gutter water halfway, the el train
   going over.
2. `body` — Ames on his back under the lamp: thin, hatless, rumpled suit,
   one shoe off, round spectacles cracked beside him, blood (accent) going
   to the gutter, a fist closed on paper. Cast kind `victim` (yours; a
   lying pose that reads as a man at 20 m, not a pile). **E kneel**: the
   eye eases down beside him (no cut). From there I look and **E** what I
   look at: the wounds ("Two. In the chest. He was standing." one subtitle
   line), the fist (my hand opens his fingers: seven wet pieces of paper
   come away), the two bullet marks in the brick above him (they went
   through him).
3. `strings` — **Puzzle A, the line of fire.** The idea: a string from
   each bullet mark back through where his chest was shows where the
   shooter stood. Make it a thing I do, not a slider: from a composed
   study view of the alley (the wall and its two marks, where he stood,
   the fire escape above), I take hold of a string pinned in a mark and
   carry its free end; the line from the mark through my fingers runs on
   across the alley as a drawn ray to whatever it strikes. Where he stood
   is shown the way an inker would show it: a dashed outline of a standing
   man, raised by the lightning or by my examining the body, with the
   wound marked. When a string passes through the wound it goes taut
   (a sound, a twitch) and stays. The second string crosses the first on
   the fire-escape landing, where something small and red shows. It must
   be understood in ten seconds with one short prompt, be impossible to
   get stuck on (the framework's hint after 40 s), and the solved frame
   must be a picture: two white lines converging up into the dark.
4. `landing` — **E** pulls the drop ladder down (its weight, its
   clatter), I climb (W; the hands take the rungs: object first; two
   seconds, not ten). On the landing under the rain: two brass casings and
   the torn half of a Cardinal matchbook cover (crew red). **E** take.
5. `halves` — **Puzzle B.** Held up in my two hands (or on the dry step):
   Mack's matchbook and the torn half. I turn and slide the half until the
   torn edges meet and the black bird is whole: a click, the two held
   together a beat. Same book, same crew. Give the matchbook prop a torn
   back flap that only shows when it is opened or turned (the closed front
   seen in scene 2 must not change). Direct, generous, no fail.
6. `note` — **Puzzle C.** On the dry step under the lamp, the seven wet
   pieces. I slide them with the pointer (my fingertip on the piece), turn
   one with the wheel or the right button; pieces that belong together
   pull together when near (generous: about 8 mm and 12 degrees) and then
   move as one. Whole, it reads in a quick pencil hand: **HARBOR BLDG.
   RM 304**, the ink run a little by the rain. A beat on it, then I fold
   it into my coat.
7. `leave` — I stand. The lamp, the body, the rain. `yield* ctx.next()`.

## What makes it premium
- The three puzzles feel like handling real things: the cursor is one to
  one, things have weight (a short ease when let go, never a lag when
  held), snaps are felt (sound, a two-frame settle), and my hands are in
  the frame doing it wherever that can be made to look right. If a hand
  cannot be made to look right in a view, leave it out of that view rather
  than show a bad one.
- Nothing is read for more than two seconds. No inventory screen.
- The body is never a toy: I cannot push it, walk through it, or make it
  twitch.
- Save at `body`, `landing`, `note`.

## Play and proof
`tools/plays/body.json` plays `?start=body` through all seven beats by real
input (the pointer puzzles by real mouse moves). Strips: the kneel, a
string going taut, the climb, the halves meeting, the last two pieces
joining. Frames: approach, the body under the lamp, the solved strings,
the landing, the whole note.

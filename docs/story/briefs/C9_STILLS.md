# C9 — the stills: the comic panels' pictures

Branch `wave-c/C9-stills`, port 5349. Lane C1 built the player
(`game.stills.play(id)`, `src/stills/*.js`, `docs/story/seams/Z.md`) with
placeholder panels drawn flat on a canvas. You make the pictures.

Read `docs/story/WAVE_C.md` §4 (the story) and §5 (the stills), `DESIGN.md`
(the ink rules), `reference/noir_reference.png`, the placeholders as they
play (`?still=<id>&panel=<n>`; BEGIN for the opening run).

## What the user said
- "Add cutscenes as comic-book stills, only where they help, few, and as
  short as possible. Very little text or dialogue anywhere."
- "The stills must be composed pictures, not random screenshots. They may
  be rendered from the game, but make them look good: mostly shadow,
  abstract, or close on one character. Build something unique for them if
  needed."
- "A through line I can follow even without specifics."

## The method
Each panel is a small staged tableau built for the purpose and rendered
through the game's own ink pipeline, so it is the same hand as the game:
a debug shot preset per panel (`src/debug/shots/C9_stills.js`:
`shot=still_<id>_<n>`) that places a few props and figures on a bare
stage of your own (`src/stages/studio/`, its own salt: a floor, a wall, a
window with rain, nothing else unless a panel needs it), sets one or two
lights, the lens and the look, at the panel's own aspect. A script
(`tools/stills.sh`) renders every preset with `tools/shot.sh` and writes
`public/stills/<id>_<n>.jpg` (quality 88, the long side 1600 px, under
300 KB each); `src/stills/<id>.js` names them. The renderer is
pixel-deterministic: the script must reproduce the committed files.
Where a panel is better drawn than built (a pure shape: a cross, a
silhouette row), draw it on a canvas with the brush functions of
`src/ui/inkArt.js` and put it through the same grain; say which.

## Composition (this is the whole job)
One idea per panel. Mostly black. One light, hard, from one side or
behind; the subject read by its edge. Close: a hand, an object, a hat's
brim, a shape in a doorway. Faces are never shown (STORY.md: lost under a
brim, in shadow, in the print's grain). One accent at most per panel and
only where it means something: the crew's red on the two crosses; an
ember; nothing else. Leave air for the caption box where the player puts
it (a corner; say which corner in the data). Each must read in one
second, and the run must read as a story to someone who knows nothing.
Make three candidates for each, look at them side by side at the size
they are shown, keep the best. Study how the reference frames weight
black against white before you start.

## The panels (WAVE_C §5; captions are the player's, at most six words)
1. **`opening`** (before chapter I), one page, three panels:
   a. a telephone receiver in a hand, a desk lamp's cone, rain on the
      glass behind: `A TIP. AMES.`
   b. three hats in the light of a diner's doorway, a small white apron
      between them (Dot: the one paper-white shape): `HIS MEN. MY DINER.`
   c. the diner's neon through a wet windscreen, the wiper's arc, my
      knuckles on the wheel: no words.
2. **`ames`** (end of II): the business card in wet fingers under a
   street lamp, the red cross over the name: `AMES. MARKED.` The card is
   lane C4's prop (`amesCard`): use it, do not redraw it.
3. **`check`** (III, when the torn check is whole), two panels: the check
   close, her pencil's hand (`guestCheck`, lane C4's prop, with lane C5's
   lines `PIER 9 / MIDNIGHT / — DOT`): `DOT'S HAND.`; then her shape
   behind the diner's counter, back-lit, the face lost, a coffee pot:
   `SHE SENT HIM TO THEM.`
4. **`photo`** (VII, the Cardinal's office): a photograph under a desk
   lamp: a waitress's cap and curl, the apron, the face lost in the
   print's shadow, crossed through in red by the same hand as Ames's
   card: `NOT HIS GIRL. HIS NEXT.` The photograph is a prop kind you make
   (`dotPhoto`), for lane C7 to put on the desk in play: the same object
   in the game and in the panel.
5. **`theDiner`** (before VIII): my headlamps on the wet avenue, the el
   above, the diner's neon small and far: `THE DINER.`
6. **`end`** (after the last frame of VIII): his hat in the wet street,
   the cigar's ember beside it: no words.
You may cut one that does not earn its place or add one where the story
is not carried (say why); never more than three panels on a page, never
more than eight pages in the game.

## Then
- Replace the placeholders in `src/stills/*.js`; keep each run's timing
  short (2 to 4 s a panel; the opening under ten seconds).
- The drift inside each frame (`from` / `to`): a few per cent, toward the
  subject.
- Play every run in the player (click through; skip) and look at frames
  of each page: `tools/plays/stills.json`.
- Add the pages to the golden frames (`?still=<id>&panel=<n>`:
  `tools/golden.py add`), since they are deterministic.

## Gate
Build; golden check (the old frames identical; the new pages added);
`stills.json` twice; `kit.json` and `slice.json` still pass. Report
`docs/story/reports/wave-c/C9.md` with every panel as a JPEG in
`docs/story/review/wave-c/C9/` (the art director looks at each).

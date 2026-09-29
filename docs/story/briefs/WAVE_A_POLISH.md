# Wave A, the polish pass (one builder)

Round 2 is merged on `wave-a/integration`. The slice now plays to the
user's fight design, the people print like the Hoods, the room has light,
and every contact in scene one is solved onto the object. All plays pass.
What is left is a list of things that snag the eye. Frames and strips:
`docs/story/review/round2/`. Reports: `docs/story/reports/wave-a/ROUND2.md`.

You may edit any file under `src/` except `src/enemies/**`. Keep every
play passing. Judge each fix on a frame or a strip
(`python3 tools/strip.py`), at full size. Every run is muted.

## The art director's list, in order

1. **White halo round my hands.** `strip_ko_B4.jpg` from t = 1.0 on, and
   `strip_light.jpg` at t = 5.6 and 8.0: a soft white glow surrounds the
   fists and the hands. Skin must never glow. Find what lifts it (the
   bloom prefilter taking bright skin, the ink's paper lift-out round
   figures, the exposure change as the room opens to the street) and keep
   the viewmodel out of it. Hands print the same indoors, at the broken
   window and on the street.
2. **The blue disc on the floor.** `round2.jpg`, `diner_left.jpg`,
   `diner_wide.jpg`: a saturated blue ellipse lies on the floor like a
   plate. The neon's spill inside the door is a faint, broken wash, display
   value under 0.35, torn by the floor's brush, no edge, under 1.2 m
   across; if it cannot be made to sit in the picture, remove it.
3. **The cigarette in my lips** (`strip_light.jpg` t = 7.4 to 8.6) is a
   fat white post rising from the bottom of the frame. In the lips it
   shows only its last 2 to 3 cm, thin, low centre, under 40 px long at
   1440 x 900, with the ember at its tip.
4. **The smoke over dark ground** (`pay.jpg`): the thread prints as a
   thick white dashed bar from the counter to the top of the frame. It is
   a hair: 2 to 3 px, mid grey over dark, darker grey over light, fading
   out by 60 cm, never paper white, never dashed.
5. **Glass on the ground** (`outside.jpg`, `matchbook.jpg`): large flat
   paper-white sheets and triangles lie on the pavement. Glass at rest is
   dark and clear: what prints is a thin light edge and, on a few pieces,
   one small glint. White only while a piece turns in the air.
6. **He comes too close** (`round3.jpg`): in a rush he fills the frame, a
   black mass with the camera almost inside him. He never comes nearer
   than 1.1 m to my eye; a rush ends at 1.2 m. Same for every other
   figure and the player's eye anywhere in the game.
7. **Mack's arms**: the forearms are flat grey slabs without form. Keep
   them the light shapes of the figure, and give each one shadow shape
   (the under side, a torn edge) and a thin contour; the fists get a
   knuckle line. His hands at rest on the pavement too
   (`matchbook.jpg`).
8. **The sconce on the end wall** (`round1.jpg`, above the jukebox): its
   painted light reads as an odd pale shape with a black dot. Make it a
   small wall lamp with a soft scallop of light above and below, or take
   it out.
9. **The tumbler** by my hand (`strip_pour2.jpg` t = 14 to 16,
   `strip_sip.jpg`): it reads as an orange can with a dark lid. It is
   glass: a dark rim ellipse, clear wall above the liquid, the thick base,
   amber only where the scotch is (a double is two fifths of the glass).
10. **The first frames of a beat** (`strip_sip.jpg` t = 0.40): the counter
    is black because the pendants have no light yet. The room's lamps are
    lit from the first frame of every beat and every preset.
11. **The lesson's cards**: the torn backing is nearly invisible, the
    mouse picture small. Backing at display 0.0 with a torn edge and 85 %
    opacity; the picture 48 px; the arrow of steps 4 and 5 drawn with a
    dry-brush stroke, not a clean vector line.
12. **Pendant heads** print as large hard white ovals (`round1.jpg`). A
    lamp head is a small white disc with a tight glow.

## Defects from the bug hunt
The bug hunter's list is given to you with this brief. Fix every blocker
and major; fix minors where the cause is plain. For each, say what caused
it.

## Gate
`npm run build`; `tools/errors.sh` clean on `street`, `hoods`,
`battle&t=30`, `title`, every scene beat; `node tools/playtest.mjs`,
`node tools/play.mjs tools/plays/slice.json`, `autoplay.json`,
`continue.json` all pass; frame rate on `scene=fight&beat=round1&anim=1`
and `shot=perf&t=1&anim=1` no lower than before you started.

# Wave A fix round — four lanes, one round

Read `docs/story/briefs/WAVE_A_REVIEW.md` first and open every frame it
names in `docs/story/review/wave-a/`. Then `docs/story/CONTRACTS.md`,
`docs/story/ARCHITECTURE.md`, `docs/story/reports/wave-a/INTEGRATION.md`
(the defects list and how the lanes were wired), and your section below.

## Rules for every fix lane
- Base: branch `wave-a/integration` at `f08ba93`. In your worktree:
  `git switch -c wave-a/fix-<letter> f08ba93`, `npm ci`,
  `NOIR_PORT=<port> npm run dev &`, `export NOIR_PORT=<port>`.
- Edit only the files your section owns. If you need something from
  another fix lane, call it with `?.` by the name given here and say so in
  your report.
- The goldens in `shots/golden/` are the OLD accepted frames (before
  Wave A): every exterior frame differs from them already. Your reference
  for "nothing else moved" is the integrated build itself: before you
  change anything, capture the presets you might touch into
  `shots/base/` and diff your result against those
  (`NOIR_GOLDEN=shots/base python3 tools/golden.py ...` with a manifest,
  or your own PIL diff). Report what changed against the base and why.
- Judge with your eyes, at full size, beside the review frame and the
  reference image. Crop and enlarge. Iterate. A finding is closed when the
  frame shows it closed.
- Determinism, no new lights without measuring, no new dependencies.
- Commit on your branch; message ends with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push,
  do not merge.
- Report: each finding closed / partly / open, the preset that shows it,
  your own critique of the frame, what changed against the base, frame
  rate if you touched anything per pixel or added geometry.

---------------------------------------------------------------------------
## Fix lane A — the picture (port 5191)
Owns `src/render/**`, `src/stages/block/parts/diner.js`,
`src/stages/block/site.js`, `src/props/**`, `src/debug/shots/L1_*.js`,
`src/debug/shots/L5_*.js`.

A1. **A lamp over my place, and the pools on the counter.** Six pendants
  over the counter's front edge at z = 8.0, 6.05, 4.1, 2.15, 0.2, -1.75
  (one directly over stool 4, my seat). Each throws a pool about 1.5 m
  across on the counter top: paper white at its centre, a torn edge, grey
  beyond, black between pools only where pools do not reach. The counter
  top is a dark material that prints white **only** in a pool. Objects on
  it throw small soft shadows away from the lamp. Frame: `diner_seat`
  (set its eye to the seated eye of lane B: x -13.87, y 1.60, z 4.1,
  looking straight at the back bar, pitch -0.14, fov 68): the bottom third
  is the lit counter with its near steel edge across the bottom of the
  frame.
A2. **Cones are light, not bells.** In `s12_round1`, `diner_wide`,
  `s00_title` every pendant's cone is an opaque grey bell with a hard
  stepped outline. A cone is additive light in smoky air: brightest just
  under the shade (display lift about 0.35), falling to nothing by 60 %
  of the way to the counter, edges dissolving over a third of its radius,
  no outline, no banding, never hiding what is behind it; slow smoke curls
  inside it. Seen from the street through the glass the room shows lamp
  heads and soft glows, never bell shapes. The haze must not be laid into
  the surface bands behind it.
A3. **Walls, ceiling and floor in ink.** Today: flat CG grey with thin
  vertical scratches (walls), contour-map rings (floor). Wanted, as on the
  pavement of `s18_matchbook`: a few flat values with bold torn edges,
  black line work where forms meet (dado rail, panel joints, door and
  window frames, the counter's panel line, skirting), and black where no
  lamp reaches. A wall away from any pool prints display 0.06 to 0.14; a
  pool on a wall is one light shape with a ragged dry-brush edge and at
  most one step of grey around it. The floor takes at most three values;
  a lamp's pool on the lino is one torn light shape with a short broken
  sheen, not rings. The ceiling is black.
A4. **Skin.** Bare skin under a lamp prints light grey (display 0.62 to
  0.75) on the lit side and mid grey (0.30 to 0.40) on the shadow side,
  the two split by a torn brush edge that follows the form; paper white
  only as small highlights on the knuckles and the edge of the hand
  nearest the lamp; contour 1.5 to 2 px, not a heavy outline. On the dim
  street (`s18_matchbook`) the lit side is 0.45 to 0.6. Shirt cuffs and
  cigarette paper stay paper white, which is how skin is told from them.
A5. **Amber in glass.** Scotch prints as honey: hue about #c9832a at the
  centre of the liquid, darker toward the glass wall (#8a5416), display
  value 0.45 to 0.62, never the fire's orange (#f08020) and never lifted
  to flame. The bottle is glass: a dark outline, a paper label, one long
  white highlight tick down its shoulder, the liquid inside to its fill
  line with a lighter meniscus line; empty glass above the line prints
  dark with the highlight. The tumbler: thick base printing as two dark
  ellipses, the amber in it, a white tick on the rim. Frames:
  `propsheet&kind=bottle&variant=scotch`, `propsheet&kind=tumbler&fill=1`,
  `scene=diner&beat=order&press=KeyE@0.3&t=5.8` (Dot pouring).
A6. **Flame.** A tongue 25 to 40 mm tall: white-yellow core, orange
  edge, a blue-dark base at the wick; it flickers; it lights the hands
  around it (a warm-white lift on the skin within 8 cm, through the skin's
  own print, no new light). Give `buildProp('lighter')` / the flame
  material what lane B's clip needs (`userData.flame.visible`,
  `setGain`).
A7. **Neon.** (a) At grazing angles the sign prints as a translucent blue
  slab (integration defect 1): the tube widening must never exceed 1.5 x
  the tube's projected diameter or 4 px, whichever is larger, and the halo
  must follow the tube, not a rectangle. (b) The sheen on the pavement:
  broken blue flecks under the sign, no wider than the sign, gone within
  2 m of the kerb, display value under 0.6. (c) The neon's blue must not
  tint other lights: the pendant glows seen through the glass stay white.
A8. **Street columns**: dashes paper white on the plateau of a lamp's
  column (white slivers with dark gaps, as in `golden_street.jpg`), the
  near lamp's column fading out by about y 800 of 900 in `street`.
A9. The room is always drawn (integration defect: hidden beyond 30 m).
  Keep the lamp-pool saving; the room casts no shadows from outside.
A10. `d.reset()` restores everything: call lane D's
  `stage.breakables.restore?.(handle)` and
  `stage.breakables.clearPieces?.(box)`; the pie in the pie case is visible
  (it sits on its stand under the lamp).
A11. The cigarette prop gets `userData.setGlow(k)` with its own ember
  material instance (gain 1 at rest, 3 on a drag).
Presets to deliver: `diner_seat`, `diner_wide`, `diner_left`,
`diner_right`, `dinerfront`, `title`, `street`, `propsheet` variants,
`vmtone`, and the scene beats `scene=diner&beat=settle|order|drink`,
`scene=fight&beat=round1`.

---------------------------------------------------------------------------
## Fix lane B — hands and people (port 5192)
Owns `src/player/**`, `src/cast/**`, `src/enemies/**`,
`src/debug/shots/L2_*.js`, `src/debug/shots/L6_*.js`.

B1. **The seat.** Seated mode: `forward` 0.12 m (the eye at x -13.87 on
  stool 4), the default view straight across the counter (the anchor's
  yaw), pitch -0.14, no roll, ever. The lean when looking down stays
  small (0.04).
B2. **Fists that are fists.** Guard, from the owner's eye: the back of
  each hand faces me and a little outward; the four fingers are curled
  tight into the palm (MCP 85, PIP 105, DIP 75 degrees), so from behind I
  see the knuckle row along the top as four rounded bumps and the first
  phalanges as a flat front going away from me; the thumb is folded across
  the front of the index and middle fingers, its tip visible on the inner
  side. Forearms rise from the bottom corners, sleeves rolled. Each fist
  is 150 to 190 px wide at 1280 x 800 and sits wholly inside the frame,
  its top at about 70 % of the frame height; his head, shoulders and both
  of his hands stay visible between and above mine. Check in
  `handstudy&pose=guard&orbit=0|90|180|270` that it is a fist from every
  side, then in `handclip&clip=guard`, `jabL`, `heavyHit`, `block`.
B3. **Hands at rest and in the clips**: fingers slimmer (radius 8.5 mm
  tapering to 6.5), knuckles modelled, a thumb that opposes; the resting
  hand on the counter lies relaxed, fingers slightly curled, not a rake.
  In `lightUp` the cupping hand does not hide the flame from me; in `sip`
  the glass comes up with the fingers round its far side, call
  `glass.userData.setTilt` every step so the liquid stays level, and the
  glass never fills more than a fifth of the frame.
B4. **Mack.** Build: a barrel chest wider than the belly (chest 0.60
  across at the shoulders, 0.52 at the ribs, waist 0.48), the belly
  forward of the chest by no more than 4 cm, a thick neck, heavy forearms
  (wrist 0.075 across), hands 1.25 x with a modelled knuckle ridge and a
  thumb, never spheres. Guard: upright, chin down, the fists at cheek
  height either side of the jaw, elbows in front of the ribs, left foot
  and left shoulder forward. He stands tall in my frame: the top of his
  cap at 12 to 18 % from the top at 1.45 m. The pendant above rims his
  cap, shoulders and forearms with light; his face stays black.
  Frames: `brawlstudy&clip=br_guard`, the four attack strips.
B5. Add `br_bottle_thrust` (0.9 s: tell 0.0, contact 0.45): the thrust
  alone, for when the neck is already in his fist. Keep `br_bottle` for
  the first time.
B6. Dot: shorter neck, hands with fingers when she pours (the bottle held
  by its body, tilted 100 degrees, its mouth over the glass).

---------------------------------------------------------------------------
## Fix lane C — story (port 5193)
Owns `src/main.js`, `src/game/**`, `src/scenes/**`, `src/ui/**`,
`src/audio/**`, `tools/play.mjs`, `tools/plays/**`, `tools/playtest.mjs`,
`src/debug/shots/L7_*.js`.

C1. **Beats do not turn the view.** Every seated beat starts square to
  the counter (lane B's seat). When something wants my eye, the script
  eases the view to it and gives it back: Dot arriving (ease 0.25 rad
  toward her for 1.2 s), Mack's line (ease to frame him, hold through the
  line and his rise). `drink`: the glass stands in view by my left hand
  (x -14.20, z 4.35 on the counter).
C2. **The title**: the lettering block top-left (its centre at 30 % of
  the width, 22 % of the height), smaller (the block 46 % of the frame
  width), so the neon sign, the door and the blade sign are all clear of
  it; the red splat clear of both signs.
C3. Mack's repeated bottle attack uses `br_bottle_thrust` when his fist
  already holds the neck (fall back to `br_bottle` if the clip is
  missing).
C4. A retry restages quietly: no break sound or shards under the black.
C5. **Sounds** that are requested by name and silent (integration
  defect list): build them all, add them to the audio test table.
C6. Fight feel, tuned by autoplay at human pace and by the reactive
  play: a first-time player wins in 90 to 150 s; the three rounds differ
  clearly in pace; at least one throw into the room per fight.
C7. `docs/story/MUSIC.md` is up to date with every slot the slice cues.
C8. Update the plays and the playtest for everything above; all pass.

---------------------------------------------------------------------------
## Fix lane D — destruction, street, speed (port 5194)
Owns `src/fx/**`, `src/destruct/**`, `src/world/**`,
`src/stages/block/parts/*.js` except `diner.js`,
`src/debug/shots/L3_*.js`, `src/debug/shots/L4_*.js`.

D1. **Smoke.** The cigarette's thread is 2 to 4 px wide at arm's length,
  mid grey, half transparent, rising straight for 10 cm, then wavering,
  then breaking into two or three thin curls by 40 cm and gone by 70 cm;
  it leans with a draught when the door opens. The exhale: a soft plume
  0.6 m long that slows, rolls and rises into the cone above, display
  value under 0.5, gone in 3 s. Never a tube, never white.
D2. `breakables.restore(handle)` and `breakables.clearPieces(box)`;
  `glass.restore(pane)` clears its shards.
D3. **Speed.** The street lane's parts added about 170 draw calls
  (perf preset 649 to 820) and cost 7 %. Merge static meshes by material
  and ink id in bounds, city, shops and dressing, instance what repeats;
  target: the perf preset at 700 calls or fewer and the frame rate back
  within 3 % of the build before the street merge. Same pixels.
D4. Glass: cracks are nearly straight with slight kinks (no lightning
  zig-zag); shards carry a thin contour, not a heavy one; shards resting
  indoors lie on what is under them (tables, benches, floor).
D5. The phone booth's panes through `glass.addPane`.
D6. The works lanterns register with the lamp registry (small, short
  range) so their sheens are held near the eye; no white disc on the road
  at the south barricade.
D7. The fuel sheet (explosion B) reads as one low sheet of flame with a
  ragged edge, not a row of separate flames.
D8. The brawler through the window (`windowman`, `scene=fight&beat=ko`):
  the pane bursts outwards around him, large shards tipping out and
  falling onto the pavement, the frame's teeth left; check it in the
  scene with lane 6's figure.

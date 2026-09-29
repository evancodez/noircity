# Lane 1, fix round 1 — from the art director

You built what the brief asked for, and the brief was wrong about one
thing. The mechanism you made (emitter positions, feet, sheens laid on the
ground plane, the fire and blood handling, the ground-only mask) is right
and stays. The **length model** in my brief does not survive perspective,
and the street lost its picture. This round corrects my model and closes
the other gaps. Work in your existing worktree on your existing branch.

Compare `shots/golden/street.png` with your own `street`: the golden has a
row of white columns under the lamps, the one thing every viewer notices;
yours has one sheen at the near post and a dull grey road. `cars` has no
light on the road at all. `wreck&t=8` has a white paint blob bottom-left.
The user asked for reflections that do not look infinitely deep. He did not
ask for them to go away.

## 1. Reflections, model v2 (replaces P0.1's length rule)

**Why v1 failed.** A cap of 9 m on the ground is a few pixels tall at 30 m.
A reflection's length has to be judged in the image, where a streak under a
lamp is about as tall as the lamp stands above its own foot.

**The geometry.** An emitter E at height h above the street, its foot F at
ground distance D from the eye, the eye at height e. A true mirror shows E
at the ground point M on the line from F toward the eye, at distance
`D * h / (h + e)` from F. The stretch F..M is what the eye reads as "the
reflection under the lamp"; in the image it is as tall as the lamp.
What made the old street look bottomless was everything **beyond M**: the
old streak began at M and ran on toward the eye for 45 % of the frame.

**The streak.**
- It starts at F (touching the foot: no gap) and runs toward the eye for
  `L = 1.15 * D * h / (h + e)` (the mirror run plus a little smear), at
  least 1.5 m, and never closer to the eye than 1 m.
- Along it (u = 0 at F, 1 at the end): it rises to full strength in the
  first 6 %, holds to u = 0.35, then falls smoothly to nothing at u = 1.
  No hard end.
- Across it: narrow. The emitter's own width at F (a lamp head is about
  0.5 m; a window its own width), growing by 4 % of the distance run,
  Gaussian. In `street` a lamp's column at mid distance is 25 to 40 px
  wide, as in the golden, not a pool.
- Strength: a street lamp's column prints paper white on its plateau, as
  in the golden; a dim window's prints grey. A sheen whose whole length
  lies within 3 m of the eye is held under display 0.6 and broken hard by
  the ripples (no white blob at the player's feet).
- The ripple dashes, the vertical dry-brush break-up, the ink blots and the
  treatment of fire and blood stay exactly as they are.
- Sources: lamp heads (not their cones), lit windows, headlights, fire,
  muzzle flashes, the train's windows, sparks, neon. Blood in the air: a
  few red flecks.

**What the frames must show.**
- `street`: five to seven distinct white columns, one under each lamp as in
  the golden, every one touching its lamp's foot. The far ones are short
  (about their lamp's height in the image) and end in the road, not at the
  bottom edge. The near lamp's is the longest and has faded below 25 % of
  its plateau by the bottom edge. The road between is dark as in the
  golden. Side by side with the golden, a viewer should say "the same
  street, and the lights sit on the water now".
- `cars`: the el's hanging lamps each leave their column on the road
  between and beside the cars.
- `wreck&t=8`, `wreck&t=40`: the fire's warm sheen starts under the
  wreck, shows clearly in front of it, and ends within about the fire's
  own height in the image; no white blob in the bottom-left corner.
- `train&t=6`: the train's windows leave short broken dashes of light on
  the road under the el.
- `reflstudy`: report for each source the gap at the foot (0), the length
  on the ground against the model, the width at mid length, and the
  profile (plateau, then monotonic fall).
- `accents`: the sheen of each small emitter lies under that emitter, not
  at the bottom of the frame (today the ember's and the neon ring's sheens
  print at the bottom edge, 6 m from their sources).
- Still ground only: the mask test as before.

## 2. Interiors print in bands, not gradients
`dinerlook` is calm now, and too smooth: the walls and the cones are
airbrushed gradients, which is the CG look the project forbids. Indoors,
as outdoors, tone is laid in **flat bands with torn dry-brush edges**
between them (four or five values between black and paper white), sampled
in world space. What indoors must not have is the façade's white slashes
and lift-outs. So: bands yes, slashes no. A lamp's pool on a wall is a
white shape with a ragged edge, then a grey band with a ragged edge, then
dark. The lamp cones in the air stay soft (they are light, not surface).

## 3. Skin, paper and cloth in the hands (lane 2 needs this)
Every viewmodel id (1730..1779) is held under the Tommy gun's tone
ceiling of 0.28, so bare hands, shirt cuffs and cigarette paper print
dark grey. Keep the ceiling for the gun and gloves (ids 1770..1779, the
golden frames). For 1730..1769 read the surface class from
`userData.inkSurface` on the mesh or material: `skin` (prints light grey
to paper white under a lamp, display 0.55 to 0.9, with the contour and
dark ticks kept), `paper` (paper white), `cloth` (dark, as a coat),
`metal`, `glass`. Default for an untagged id in that range: `skin`.
Preset `vmtone`: a test hand-sized capsule of each class held in front of
the eye under the diner's lamp and on the dark street.

## 4. Neon
In lane 4's `dinerfront` the sign prints as hairlines with almost no glow,
and its sheen printed as a solid blue block, so lane 4 took the tubes out
of the reflection. A neon tube 18 mm thick seen from 8 m must print as a
solid bright line 3 to 4 px wide, white-hot along its centre, with a blue
halo of 10 to 14 px, and leave a broken blue sheen under the sign through
the reflection path of §1. Give `accentMaterial('neon')` what it needs
(a minimum printed width, the halo through the bloom) and say in your
report what lane 4 must set on its tubes.

## 5. Ember and flame
The ember at rest needs a warm glow of a few pixels (today a thin white
ring). Keep the accepted fire frames unchanged: key the ember's glow by
its own class.

## Proof and gate
The presets above, each opened and looked at beside its golden.
`python3 tools/golden.py check`: every exterior frame still changes on the
ground only. `tools/errors.sh` clean. Frame rate and GPU profile as
before. Commit on `wave-a/L1-render`. Report as before, with your own
critique of each frame.

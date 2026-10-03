# C11 — the look pass: the frames that fell short of the reference

Branch `wave-c/C11-look`, port 5351. The play of chapters I to VII is
built and merged. This lane fixes the pictures the art director marked
while reviewing the lanes' frames. Each item names the frame; the measure
is `reference/noir_reference.png` and the diner (`shots/golden/diner_settle.png`):
hard black, paper white, one light making pools, nothing an even grey.
Change nothing about the play. Capture each frame before and after at
1440 x 900 and look at it.

1. **Pier 9, the Cardinal's office (VII, beat `office`)**: the inside is
   blown-out white (walls paper, no pool). Light it like the diner: the
   desk lamp the one pool on the blotter and the photograph, the walls
   falling into ink, the blinds' slats as the second light from the shed,
   the ceiling black. The photograph must read at once under the lamp.
2. **The river road (VI, phase b and on foot by the wreck)**: too little
   white and a flat grey sky band. The quay lamps' cones and their
   streaks in the wet road are the whites; the sky black with the far
   bank's lights in fog; the water black with the lamps in it. Measure:
   paper whites 5 to 8 % of the frame, mid-grey under 30 %.
3. **The foot chase (V)**: the kitchen's walls are bare grey and the roofs
   are black masses with only their lamps. Kitchen: one lamp over the
   ranges, steam, the pans catching it, the rest ink. Roofs: the el's
   lights beyond, a lit skylight or two, chimney stacks against the sky's
   fog, the tar's wet sheen under the one lamp.
4. **The stills (C9)**: the opening's telephone panel (the handset reads
   crude; the pool under the lamp is mid-grey: make it a hard pool, the
   receiver and hand an ink shape with one rim) and the windscreen strip
   (too dark: the neon must light the drops on the glass and the wiper's
   arc, the knuckles on the wheel rimmed). Re-render with
   `tools/stills.sh` and re-accept their golden pages.
5. **The tail's crew car close up**: the red tail-lamp glow draws as a
   huge disc when my eye is near it (seen on foot by the wreck and at a
   bumper graze). Size the glow by distance so it never exceeds the lamp's
   housing by more than about 50 % up close.
6. **Any frame of I to VII whose first beat is an even grey**: capture the
   first beat of every chapter (`?scene=<id>&beat=<first>`) and fix the
   worst one or two with the same rules, within the lane's time.

Gate: build; golden check (the old frames identical; stills pages
re-accepted and named); errors clean on the beats touched; fps at each
touched moment against `shot=perf` within 5 % of before. Report
`docs/story/reports/wave-c/C11.md` with before/after frames in
`docs/story/review/wave-c/C11/`. Hours, not a day.

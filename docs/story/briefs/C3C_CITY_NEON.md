# C3c — the city after the user played it: neon, and the line at the car

Branch `wave-c/C3c-city`, port 5343. The city and the tail are merged
(`src/stages/city/**`, `src/scenes/07_tail.js`, `src/scenes/tail/*`,
reports `docs/story/reports/wave-c/C3.md` and `C3b.md`). Two changes the
user asked for after playing; do these, prove them, stop.

His words: "in the tail sequence add some neon signs, not an overload, but
in general to the city, to add some colour; it's too grey and black and
white at the moment. Then make the interrogation just going up to the car
instead of him coming out."

## 1. Neon through the city
The accent registry (`CONTRACTS.md`, `src/render/accents.js`) has `neon`;
the diner's DINER sign and the Bijou's marquee show what a neon looks like
in this ink (`stages/block/parts/dinerFront.js`, `stages/city` marquee):
a lit tube with a hard glow, its colour the one colour in the frame, and
its reflection in the wet road. Add neon to the city so that most frames
of the drive have one or two small colour notes and no frame is a
carnival: about twelve to twenty signs across the district, placed where a
sign would be and where the drive passes: a BAR, a HOTEL with ROOMS, a
pharmacy's cross, a GARAGE, a CAFE, a theatre's name, a LIQUOR sign, a
dance hall, a pawnbroker's balls, an arrow sign for the docks, a few
lit shop windows with a coloured tube in them; the market square and the
river road get one or two each (the river road reads greyest: a
warehouse's red tube, a bar at the quay). Two or three colours in all
(the registry's neon reds, a blue, a green or amber), one per sign.
Each sign: the tube's glow, its light pool on the wall and the wet
pavement, its streak in the road, visible from the distance the drive
sees it, and a flicker on one or two. They must not cost the frame rate
(sprites and emissive strips, no real lights; batch them) and must be
culled with the block they stand on.
Look at the result from the driver's seat along each of his routes and
from the kerb and the pier, as frames at 1440 x 900: more colour, still
the ink reference (black-heavy, paper whites, one accent at a time).

## 2 The line at the car
After the crash he stays in his wreck. "See to the driver." I stop and
get out (E, as now), walk up to his car: at the driver's door or window
(within 1.5 m, looking at it) he says the line from his seat, subtitle
only: "Pier nine. Tonight." (his shape slumped at the wheel, his head
turning to me, a hand on the sill; the bowler on the road beside the
door). No man gets out; no crouched figure; the `tail_crouched` and
`tail_point` clips go unused. If I walk off without going to the door,
the line comes as I pass within 4 m of his car. Then E at my door to get
in, "Pier 9.", as now. The jank walk at the wreck still holds (his car,
mine and the rail solid; nothing through).

## Gate
Build; golden check identical (the city has no golden frame; the block's
frames must not change); errors clean on every beat of the tail;
`tail_good` once (it must still find the line and the pier; update the
play's walk to the door), `tail_jank_walk`; fps at the market square and
the river road against `shot=perf` (the neon must cost under 5 %). Six
frames of the neon from the drive in `docs/story/review/wave-c/C3c/`.
Append a "C3c" section to `docs/story/reports/wave-c/C3.md`. Hours, not a
day.

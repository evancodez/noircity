# O2b — wheels, the second pass: what O2 left short, the user's car notes

Branch `ow/O2b-wheels`, port 5382, effort high. A short follow-up on lane O2
(`docs/reports/O2.md`, its sections 5 and 6) after its merge into main at
634c47e. The user's words (2026-10-23, after his first play):

- **[must]** "the car hitboxes may be too big (bullets seem to hit cars
  sometimes)": a tight hull for rounds against a car - body and cabin boxes
  inside the silhouette, glass that a round goes through (and cracks), a
  tyre its own target; a round past a car's wing never stops. O2 left this
  at the hull's box (`docs/reports/O2.md` §6: "the gun kit (kitUse) would be
  the next step").
- **[must]** "some first-person car views (the police car's) are blocked":
  O2's seats see the road from every kind (the manager's sheet
  `docs/review/mgr/seats_after_O2.jpg`), but the police car's cabin is a box
  with a heavy header and pillars (the top quarter and the left third of the
  frame black) and the lorry's seat has no frame at all. Each kind's cabin
  drawn as the coupe's is: pillars a hand wide, the header a strip, the dash
  low, two fifths of the frame at most (the cold play's finding 4), a frame
  from each seat in the report.
- Still binding: the standard's rules (OPEN_WORLD.md) and O2's own gate.

What you build on: `src/vehicles/kinds.js`, `cockpit.js`, `cabin.js`,
`chase.js`, `hijack.js`, `fares.js`, `race.js`, `src/traffic/`, O6b's
`src/destruct/CarDamage.js` (the hull for damage), O4's gun kit
(`src/guns/`, `Smash.bullet`), the manager's plays `tools/plays/mgr/seats.json`
(every seat), `tools/colour.py --blocked`.

## 1. The rest of O2's left list (its §6), in this order
1. Each kind's own top speed and the coupe's 75 km/h (the cold play's 5).
2. The one-draw far build for the sedans with `lodUpdate` every tick (the
   performance audit); the drive-through's hitch bar measured on a quiet
   machine and reported honestly.
3. The good fare bot stops for cross traffic and signals (`o2_fare_good`).
4. The race: the field harder for a hand that drives well (bad hands won the
   first of four; medium won by 195 m); the leader's ease only after a loss.
5. Hands in the hijack (the break-in's hands at the door, the pull's grab).
6. The traffic parks and pulls out now and then; the tram carries people.
7. O5's sheet over the kept car and the repaint through the fleet's variants.
8. The title's keys line lists V (O7's line: `V VIEW`), with the golden title
   frame re-accepted and named.

## 2. Proofs and gate
The hull play (rounds past a car's wing and through its glass: never a hit
on air; a tyre shot flat), the seat frames of every kind against the two
fifths, the speed table, the fare and race plays, O2's own proofs still
passing, the drive-through, golden identical (name any frame you change and
why), errors clean at the eleven starts. Report `docs/reports/O2b.md`. Hours.

# O2b — wheels, the second pass: what O2 left short, the user's car notes

Branch `ow/O2b-wheels`, port 5382, effort high. A short follow-up on lane O2
(`docs/reports/O2.md`, its sections 5 and 6) after its merge into main at
634c47e. The user's words (2026-10-23, after his first play):

- **[must]** (the user, 2026-10-29, the point of the game; every brief and
  merge is judged by it) "The point of this game is a fun open world that feels smooth, alive, populated and on theme. Make it look varied, feel alive and populated, and have fun gameplay." Smooth, alive, populated, varied, fun,
  and on theme (the ink).
- **[must]** (the user, 2026-10-29, the direction for what is left)
  "Buildings you can enter, interiors without a loading screen, and things
  to do in them, destructible / physics objects, stores to rob etc. is a
  thing to have, if you haven't started on that. Not every interior. In
  general, things like destruction, environment objects, or NPCs reacting
  to you is a good idea. Once again, the goal is polish rather than
  immense scope (apply that to the entire world and the other things you
  are working on), but it should still be pretty cool and varied. Work
  your way up. Keep working until I stop you."
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

## 1. The rest of O2's left list, cut to finish (polish rather than immense scope)
In this order, each done completely; the manager cut on 2026-10-29 the fare
bot, the traffic's parking and the tram's passengers (O9's cars with people),
and the kept car's sheet and repaint: breadth without finish.
1. Each kind's own top speed and the coupe's 75 km/h (the cold play's 5).
2. The traffic sees a walker: a traffic car brakes or swerves for a man in
   its lane (O8's note: `manAhead` looks only at the player, so walkers must
   dash clear of every car); the start's kerb clear past the parked taxi
   66 m along it (x -112, z -67: the first long W from `start=city` ends
   in it).
3. Hands in the hijack (the break-in's hands at the door, the pull's grab).
4. The race: the field harder for a hand that drives well (bad hands won the
   first of four; medium won by 195 m); the leader's ease only after a loss.
5. The one-draw far build for the sedans with `lodUpdate` every tick (the
   performance audit); the drive-through's hitch bar measured and reported
   with the load beside it.
6. The title's keys line lists V (O7's line: `V VIEW`), with the golden title
   frame re-accepted and named.

## 2. Proofs and gate
The hull play (rounds past a car's wing and through its glass: never a hit
on air; a tyre shot flat), the seat frames of every kind against the two
fifths, the speed table, a walker in a traffic car's lane, the race plays, O2's own proofs still
passing, the drive-through, golden identical (name any frame you change and
why), errors clean at the eleven starts. Report `docs/reports/O2b.md`. Hours.

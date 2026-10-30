# O6c — car wear, the second pass: the fire's warning on every path, the wear by kind

Branch `ow/O6c-wear`, port 5385, effort high. A short follow-up on lanes O6
and O6b (`docs/reports/O6b.md`, its sections 0 and 7) after O2's traffic and
parked cars came into the city (634c47e) and the manager's stopgap tune on
main (5b9bb44). What was found, in the manager's merge checks and the lanes'
runs:

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
- **[must]** O6b's rule is that `She's burning. Get out.` always fires first,
  with time to get out. The crash path to the fire skipped it: a chase at
  heat 3 into the roadblock burned the car after two crashes with no warning
  (`tools/plays/o3_roadblock.json`: `warnedFor` null, then 'She went up with
  you in her.'). The manager's stopgap in `Car.hurt` (5b9bb44) stops a blow
  from below the fire's step just below it; make it the rule by every path
  (a crash, a blast, rounds, a wall at speed): the warning, then a fuse long
  enough to get out (O6b's FUSE), never the fire in the same frame as the
  blow that earned it.
- **[must]** The traffic's knocks must not burn the car. On main as it was
  after O2 the drive-through burned the car on the bot's scrapes (O1c's run:
  1 crash and 5 scrapes, 'failed' by wear; the manager's: 132 scrapes and 6
  crashes at a load of 590) and O3's chase burned it every try. The stopgap
  halves every blow in the city, flat. Own it by kind: a scrape costs no wear;
  a glance a fraction of a step; a square blow about a step; the blows to the
  fire by kind measured and tabled (a coupe, a saloon, the lorry, the hearse)
  with the masses (O6b's `impC * mr`), and the stopgap's flat half removed
  (`Car.hurt`, the `city` branch) once yours is in. Game one's numbers stand:
  its tail, `shots/golden`'s 40 frames and O6's own plays identical.
- O6b's left 3: a dent alone on a black car is dark at 20 m at night. A dent
  that reads from across the street (the scar's pale edge, the ink's contour
  at the dent: a shader lane's call if it needs one, name it).
- O6b's left 4: the blast hurts the car I am in like any other (2.0 at 4 m):
  one blast beside a burning car never takes my car from whole to the fire;
  two in a row warn first.
- Still binding: the standard's rules (OPEN_WORLD.md: the city answers
  everything the player does, visibly; no invisible hand says no) and O6b's
  own gate.

What you build on: `src/vehicles/Car.js` (`hurt`, `contact`, `DAMAGE`,
`warnAt`), `src/destruct/CarDamage.js` (STEAM 1.5, SMOKE 2.5, BURN 3.3, FUSE,
the warning at line ~1249, the fail at ~1103), `src/vehicles/kinds.js` (the
specs: mass, k), O2's traffic (`src/traffic/`) and parked bodies
(`src/traffic/parked.js`, `src/stages/city/parts/cars.js`: a parked body has
a yaw and no `fwd`, c93ab25), the plays `o3_roadblock`, `o3_chase_medium`,
`o1_drive`, `o6_burn`, `o6_fire`, `o6b_ram`, `o6b_after`.

## 1. In this order
1. The warning on every path to the fire, and the fuse (the first must).
2. The wear by kind, tabled; the stopgap removed (the second must).
3. The blast beside a burning car (O6b's left 4).
4. The dent that reads at 20 m (O6b's left 3).

## 2. Proofs and gate
A new play `tools/plays/o6c_wear.json`: every kind rammed square at 45 km/h
into a wall until it burns, the steps counted, the warning seen before the
fire every time, the fuse timed (seconds from the warning to the fire with
the player seated), the table in the report; `o3_roadblock` passing with
`warnedFor` set and never 'went up' without the warning; `o3_chase_medium`
with the car alive at the end of a medium chase; `o1_drive` ending 'done'
with the car whole or steaming after its loop; O6's and O6b's proofs still
passing (`o6_burn`, `o6_fire`, `o6b_ram`, `o6b_after`, `o6b_hang`); golden
identical (game one's 40 and the city's; name any frame you change and why);
errors clean at the starts and at `scene=smash&beat=bed`. Report
`docs/reports/O6c.md`. Hours.

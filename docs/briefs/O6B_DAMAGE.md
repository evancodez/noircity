# O6b — car damage, physical; the awnings and the hung lamps; the river's splash

Branch `ow/O6b-damage`, port 5380. A follow-up to lane O6 (merged at
814c675: `docs/reports/O6.md`, `docs/seams/SMASH.md`, the bed
`?start=smash`), for the one must O6 landed short of and the three things
its `Left` and the city's cold play named. The user's words:

- **[must]** "Make sure to add things like car damage (would be cool for
  some physical stuff within reason)." Damage that is physical and seen
  where the hit was: the shell **dents at the point of impact** (a capped
  vertex displacement on the body, deeper the harder the hit, the normals
  redone so the dent reads in the light), the **bonnet pops and flaps**
  (hinged at the scuttle, it lifts on a hard front hit and beats in the
  wind at speed), a **door hangs and then comes off** and lies on the
  road as a thing (solid, it rests, swept by the cap), a **bumper drags
  and sparks**, a **wheel wobbles** after a bad corner hit and **can come
  off** (the car then grinds on the hub: slow, sparks, pulling that way),
  the lamps and the glass as O6 left them, the wreck as the end state.
  Within reason: no soft-body sim, a few strokes, **60 fps with ten
  damaged cars in view**.
- **[must]** "everything works": every part that comes off is a thing (it
  stops a man, slows a car, lies where it fell); nothing floats, nothing
  passes through anything; the damage never costs the frame rate.
- **[must]** "Think GTA but noir. Make sure the player has freedom to
  cause havoc and do what they want in this open world, one that reacts to
  them." (The havoc here: ram every car on Grand Ave until each is a
  wreck, and the street answers in sparks, doors and smoke.)

What you build on: O6's `src/destruct/CarDamage.js`, `Smash.js`,
`smashKinds.js` and `src/world/Cars.js` (the dents as pushed vertices,
the wing, the lamp, the hanging door, the corner smash, the fire, the
blast, the wreck), `src/vehicles/Car.js` and `models.js` (the body's
parts are children of `model.group`: name them so a part can hinge and
come off), the pools and caps of the set. **A start exists**: the branch
`ow/O6b-copy-wip` (one commit, d1b420d, on top of O6's head) holds
unjudged edits of the same four files made by a copy of O6's owner in
its last hour: diff it against `ow/O6-smash`, play what it does, keep
what is good, drop the rest; it is not merged as it is. Lane O2
(wheels) is building the car kinds and variants in parallel in its own
worktree and is not in main yet: build on `Car.js` and `models.js` as
they stand, keep your changes to the damage's own files and to named
parts of the model, and your fix pass (which merges main first) takes
O2's kinds if they have landed.

## 1. The damage (`src/destruct/CarDamage.js` grown)
By where the hit was and how hard (the contact point and impulse O6's
`hit` already carries): the dent map per car (a capped displacement
within 12 cm, the normals recomputed over the dented region only), the
bonnet (three states: shut, sprung, flapping; off at a wreck), each door
(shut, hanging and swinging, off), the bumpers (fixed, dragging with
sparks at its scraping end, off), each wheel (true, wobbling, off: the
hub grinding, the car's spec losing that corner's grip and pulling),
with the look of the thing in the ink (a few strokes, the part's own
black and its edge). Every part that comes off is registered with the
set as a thing (`smash.register`, kind `carpart`) with its own pool and
the cap. The sound of each: a bonnet's bang, a door's clatter and skid,
a bumper's scrape, a hub's grind.

## 2. The rest of O6's left
- **The awnings** torn down by a lorry and the **el's hung lamps** shot
  out, in the city (O6 brought only the shop glass to the city).
- **The river's splash** (the cold play's finding 10): a car into the
  river is a splash in ink and the water closing over it, the wreck a
  dark shape under the surface with its lamps dying; a man the same, in
  the base's rule (the quay's steps).
- **A shot-out lamp's head** prints as a grey disc, not black (O6's
  left 5): find why and make it black.
- **What lies in an unlit stretch** after a break reads as a black
  silhouette (O6's left 4): a faint rim of paper on the near edge of a
  fallen thing, so its shape reads where no lamp falls.
- The tram wrecking a car on its rails in half a second is harsh (O6's
  left 6): three seconds of shove and sparks before the wreck.

## 3. Proofs and gate
On the bed and in the city: a play that rams ten cars to ten states and
looks at each (the strips of a dent, a bonnet flapping at speed, a door
coming off and lying, a bumper dragging, a wheel off and the grind), the
parts' physics (a man stopped by a door on the road, a car slowed by
it, nothing floating, nothing inside a wall, everything resting in 5 s),
the fps at ten damaged cars in view against `shot=perf`, memory flat
over fifty cycles; the awning and the hung lamp in the city; the splash;
the lamp's black head; golden identical (game one's 38, the city's
twelve: `smash_wreck` re-taken and named if the wreck changed) plus one
frame of yours (ten wrecks on Grand Ave); errors clean on the bed's
beats and the city's starts; the pad play. Report `docs/reports/O6b.md`
with "For other lanes" (the parts as things, what O2's kinds must name).
Hours, not days: the dents, the bonnet and the doors first, grey and
physical, then the rest.

## From the drive-through on main after O1b's merge (2026-10-23): yours
The drive-through play (`tools/plays/o1_drive.json`: a bot drives 4.3 km
through every district at up to 60 km/h, by the keys, taking its corners
badly) on main 6c1a623, three runs: the car ends the loop at damage 3.2 in
the `smoke` state with 5 to 8 wall scrapes and **no crash**; in two runs of
three it went to `burning` and the wreck on the Docks leg at 257 s (the
fail `Wrecked.`, the bot never getting out). That is wear beyond the
user's "within reason": a scrape marks the paint and dents the wing, a
dozen scrapes do not burn a car; the engine's smoke, the fire and the
wreck come from crashes (hard, head-on, the corner taken into a wall at
speed) and from rounds into the engine, never from scrapes alone. Yours in
your fix pass: tune the wear so that the drive-through's bot finishes its
loop under `smoke` every time (the scrapes showing on the body as yours do),
and name in your report what a car can take before it smokes, burns and
goes: how many hard crashes at what speed, how many rounds.

# O1c — the streets, the follow-up: the pavement graph mended, the street answers a fist, the look of the districts

Branch `ow/O1c-streets`, port 5378, `high`. A follow-up of lanes O1 and O1b
on main as it is after O3 (the people and the police), O5 (the places) and
O7 (the night) merged: read `docs/reports/O1b.md` (its Left), `O1.md`,
`O3.md` (its 'for other lanes': the pavement graph), `O7.md` (the jab on
LMB, `src/night/fist.js`), `docs/seams/WORLD.md` and `SMASH.md` first. The
user's words:

- **[must]** "everything works": nobody walks into a facade; a thing that looks solid is solid; a fist that lands on a thing is answered by the thing.
- **[must]** Nothing copy-paste (OPEN_WORLD.md): the streets within a district told apart; every prop in a variant by a seeded hash of where it stands.
- **[must]** "Keep it very much this same aesthetic": the reference's pools and black, a touch of colour under 2 % of every frame (measured again now that the police's red roof lamps, the title's splash and the signs are in).
- **[must]** "Think GTA but noir. Make sure the player has freedom to cause havoc and do what they want in this open world, one that reacts to them." (OPEN_WORLD.md: the city answers everything the player does, within seconds, visibly; no invisible hand says no.)
- **[must]** "to completion: super awesome, fun, cool, and polished." (The user, after his first drive.)

## 1. The pavement graph mended
O3 found walk legs that cut through a block (e.g. (-100.4, 28.8) to
(-49.8, -21.8) east of Grand Ave, from an inset polygon): a man routed
along one walks into the facade, and O3 now checks witness routes leg by
leg. Mend the graph itself (`src/world/` the pavement graph of O1: every
leg on a pavement or a crossing, none through a lot; a tool that walks
every leg and prints the ones that cross a solid, zero at the end), and
drop O3's leg-by-leg check only if its owner's comment says it may go.
The flower stand and every round prop: the jank walk's rule reads a man
sliding round a round collider as a miss (`o1b_jank.json`, the flowers,
19 of 20): a box for the stands that are boxes, the rule allowing the
slide for the round ones; 20 of 20.

## 2. The street answers a fist
O7's jab (LMB with empty hands) lands on people; on things it whiffs.
Yours: a jab into a thing of the destruction set hits it (`smash.hit` with
a fist's impulse: a bin goes over, a sandwich board down, a crate shoved,
a bottle off a stoop, glass cracks and then goes; a lamp post rings and
stands), the sound of the thing, O1b's items knocked loose; the hydrant,
the post, the wall hurt the hand (a flinch, a beat). A kick (C held and
LMB, if the hand kit allows; else the jab alone). The city answers: a
thing knocked over near a cop is a crime of its own level (O3's
`crime.emit`, 'vandal', level 1 with a witness). Prove it on a walk down
Grand Ave: every kind hit once, each answering as its kind, nothing
floating, everything resting.

## 3. The look of the districts (O1b's left)
Streets within a district told further apart (two streets of the
Tenements side by side must not read as one: the lamp style, the stone,
the trades, the one thing mid-block each has); a warmer Hill (its
lanterns' amber in the pools, the cobbles' lane, the gate piers; under
the colour measure); the firehouse's doors at arm's length (flat now:
the panels, the brass, the red under 2 %); the near ground's wash between
the pools (darker, the reference's black); the Doyers Lane red doubled in
reflections (halved). Three review frames of a district's two neighbouring
streets beside each other, named for what tells them apart.

## 4. Proofs and gate
The graph tool at zero; `o1b_jank` 20 of 20; the fist walk down Grand
Ave; `o1_drive` (the drive-through: all five districts, nothing driven
through, no chunk missing or late) and `o6_city` still passing; O3's
`o3_crowd` and `o3_witness` passing on the mended graph; the blind test
of ten streets with their colour under 2 % re-run with the police on
(`o3_police` tableau in it); golden: game one's 40 identical, the city's
frames re-taken only where the look pass changed them, each named and
shown beside the old; errors clean at every start. Report
`docs/reports/O1c.md`. Hours, not days.

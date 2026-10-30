# O5b — the cold critic (places, the follow-up)

Played cold on `ow/O5b-places` at 3d7339e, dev server 5375, headless, muted, by real
input (`tools/play.mjs`), before reading `docs/reports/O5b.md`. A tool's teleport was used
only to skip a walk across the city (to a door's pavement, to a wanted man's corner, my car
brought near); everything at a door, in a room and at a desk was played by keys, mouse and
(once) the fake pad. Plays: `tools/plays/critic/o5b/` (`cold_hospital`, `hq_book`,
`led_car`, `rooms`, `fall_ward`, `poke_hospital`, `ambulance`, `pad_hospital`). Frames:
`docs/review/O5b/critic/`.

## Findings, most felt first

### B1 — blocker: the ambulance can be taken, and from its seat the screen is a grey wall
**Steps:** `?start=city`, walk to the ambulance at the hospital's kerb, `E  get in` (the
prompt shows; E works: `G.city.inCar` true, `G.city.car` is the ambulance). The seat's view is
a flat grey plane with two black wedges (frame 1): no road, no windscreen, nothing. `V` (the
view) changes nothing. W held 4 s moves it 1.5 m and then it stands at 0 m/s with W held
(wedged at the kerb/canopy); a second W pulls it off diagonally. You drive it blind.
The report's Left 6 says "it cannot be taken (no hijack in main)": it can, today, by E.
**Where:** `src/places/rooms/hospital.js` `ambulance()` (the `truck` spawned as a city car;
the lorry's seat eye sits in its box). **Fix:** either the cab is locked (E: the rattle and a
word: "Locked. The keys are inside.") until O2 gives the lorry a seat that sees, or give this
vehicle a seat eye in the cab and make V work in it. Whatever is takeable must drive.

### B2 — blocker: E at the nurse, from the desk, looking at her: no prompt, nothing
**Steps:** in the hospital's hall, walk to the admitting desk and stand at its front, looking
at the nurse's face (frame 2, she is dead centre, 0.9 m off): no `E  the nurse` prompt; two
E presses do nothing. The prompt only flickers for 0.1-0.2 s while walking past at 1.5-2 m
(the log: `P[E the nurse]` on for 100-200 ms three times). The one person in the hall, the
one thing that looks usable, does not answer where a player stands to talk to her.
**Where:** `src/places/rooms/hospital.js` the `K.use({ at: [mid, FLOOR + 1.3, dz1], range: 2.3,
cone: 0.5 })`: the point is on the counter's front edge below the eye; at the desk the eye on
her face is out of the cone. Put the point at her head height behind the desk (as the bar's
barman / the sergeant: the sergeant's desk works, `E  the desk sergeant` at 1 m) or widen it.
Same check for every other `K.use` added in this lane (I saw the sergeant, the board, the
cells' door, the ward beds answer).

### B3 — blocker (the police contest wins itself): a ward bed clears heat 2 in four seconds, free
**Steps:** out of the hospital's door, draw (wheel), two shots: heat 2, `Lose them.`, the
gunmen coming (`Behind you!` within 4 s). Back in by the street door, 12 m to a free ward
bed, `E  sleep`: the black, `Slept. Saved.`, and on waking heat 0, health 100, the line
`Clear.`. From the first shot to clean: 12 s, no money. Every bed but two in the ward does it.
The OPEN_WORLD rule is that heat is lost out of their sight, by a change of car, an
interior with time; the hotel's sleep was paid for by the walk upstairs, this is next to
the door of a public building on Mercer St.
**Where:** `src/places/rooms/hospital.js` line ~100 (`onUse: () => P.sleepAt('ward')`) and
`src/places/Places.js` `sleepAt` (clears heat unconditionally). **Fix:** no sleep with heat
up (the nurse's word: "Not with the law on your heels." and the prompt says `sleep` only at
heat 0), or the sleep keeps the heat; a ward bed as a save and a mend at heat 0 is fine.

### M1 — major: the led man vanishes when I get into a car, and is lost with no warning
**Steps:** take a wanted man in (`Come on.`), stand by a car with him beside you, `E  get in`:
he disappears the frame E is pressed (logged: `visible:false, inCar` at the press, 0.7 m from
me, beside the door: in a third-person view or with him in front of the windscreen he pops
out). At HQ, `E  get out`: he is put 1.4 m behind me (out of sight, fine). Get in with him
more than 9 m away and drive off: after 8 s at 70 m `He got away.` with no warning before
(WAVE_C §1 rule 2: a warning before every fail - "He's falling behind." at 50 m).
**Where:** `src/night/bounty.js` `stepLed` (the `< 9` boarding and `visible = false`, the
`M.far > 8` loss). **Fix:** he walks to the car's rear door and in (a second) or at least
is hidden only once the cut into the seat has the camera inside; a warning line when he is
falling behind; the board-in radius said by the world (he runs to the car).

### M2 — major: the led man stands in my face
**Steps:** beat the wanted man, `E  take him in`: he stands up where he fell, 0.6-0.7 m from
my eye, and stays there filling half the frame (frame 4) until I walk; he only keeps 2 m
when he has walked to me. **Where:** `src/night/bounty.js` `stepLed` (`d < 2.0` stops him,
nothing steps him back). **Fix:** at under 1.2 m he steps back to 2 m (or to my side).

### M3 — major (look): the hospital's hall is a flat grey box with no pool of light
**Steps:** walk in at the street door: the first room of the hospital is an even mid-grey
wall, floor-to-ceiling, the WARD and ADMITTING labels and the swing door's outline, no pool,
no black (frame 3). The desk's pendant is out of view from the door and lights nothing the
player sees first. Compare the ward (frame 5): the pendant's cone, the white pool, the black
far end: that is the reference's panel. **Where:** `hospital.js` the hall (`ambient: 0.42`,
the dado and walls all `linen` / `plaster`). **Fix:** drop the hall's ambient to the ward's
(0.26), one hard pool in the line of sight from the door (the desk's pendant toward the
middle, or the globe by the door with a cone), the tiled dado the one white stroke.

### M4 — major: the WANTED card's order is the wall's mirrored
**Steps:** HQ's hall, turn round to the board by the door: the sheets read LOU $400 / DUKE $250
/ BENNY $150 left to right; E: the card reads BENNY $150 / DUKE / LOU $400. A player who
picked the one on the left picks the wrong man on the card. **Where:** `police.js`
`K.posters` (index i at `bx - 0.45 + i * 0.45` on a wall facing in, `dir: 'n'`: the x order
is mirrored for the viewer). **Fix:** reverse the index along the wall. (The names are O7's:
two of three tonight were "the Ox" - Benny "the Ox" Brandt and Duke "the Ox" Moretti: copy-paste
a player reads; O7's to vary.)

### M5 — major: the board is behind you as you walk in
HQ's board hangs on the inside of the front wall beside the door; a player walks in facing
the desk and the POLICE sign and never sees it unless he turns round; nothing in the hall
points at it (the old outside board, gone, was seen from the street). The world must say
where (GAME_TWO §1 B 2): put it on a side wall seen from the door, or a lamp on it bright
enough to catch the corner of the eye. (`police.js`, `bx = x1 - 1.3`, `z1`.)

### m1 — minor: the place's load is a felt hitch on the approach (the owner's Left 4)
40-60 ms frames when you come within a place's radius (the report's own figure); driving
past five places down Grand Ave is five stutters. Spread the build over frames.

### m2 — minor: the gun shop's two price lists disagree
The board on its wall lists A REVOLVER $25; the HUD's GUNS & AMMUNITION list does not (O4/O5's,
seen while touring).

### m3 — minor: the first trusted mouse move after BEGIN pitches the eye up ~35 deg
In my first play the first `look` (trusted mouse events) left the eye pitched up for the whole
play (every room frame a ceiling); with event moves it does not happen. The repo's plays all
reset `pitch = 0` after a first `look [0,0]`, which hides it. Worth one check by hand with a
real mouse (pointer lock's first movement).

## The four proofs (mine)

The lane's contests: the wanted man taken and booked (the fight is O4/O7's), the fall that
ends in the ward, the police's heat (which the ward now touches).

| Contest | idle | bad | medium | good |
| --- | --- | --- | --- | --- |
| Wanted man, taken, booked | loses: warned (`One more and you're down.` 15 s before), put down, the black names him, wakes in the ward, `Came round. $10 for the stitches.`, the heat 0, the man still out | not run by me | not run by me (owner's `o7/bounty_medium` covers it) | wins twice in a row: taken first try (21.5 s, 23.7 s, 36.6 s over three runs), booked twice at the desk (`Book him.`, `$150. He signs for him.`, +$150, the man walked to a cell) |
| Heat 2 at the hospital | - | - | - | **wins itself**: a ward bed clears it (B3) |

## Interaction walk (what I touched)

- Every place's street door, first open, E to the leaf's first move: diner 25 ms, Orpheum 8 ms,
  gym 17, Tenements bar 15, Docks bar 12, warehouse 21, market hall 17, gun shop 14, hotel 18,
  garage 11, pier office 12, hospital 11 ms. All within 25 ms (one or two frames). The ask is met.
- Walked straight in through each room until stopped: stopped by furniture or a wall in all
  but the hall and the garage (long rooms, the far wall reached); nothing passed through.
- The hospital: front reads (lit frosted windows, AMBULANCE on the box); the hall (M3), the
  nurse (B2; jabbed: `Not in my hospital!`, heat 1, she cowers below the desk, the room sore),
  a shot in the hall (`Everybody down.`, heat 2), the swing doors push open by walking, the
  ward (good), walking between the beds (the aisles are free, the beds solid), the wake bed,
  out by the street door (it pushes open from inside).
- HQ: the door, the desk with nobody (`He looks up. Then down again.`), the board (B: M4, M5),
  the card, the cells' door (`E open`), the cells' corridor; the booked man's path logged in
  the room's frame: through the desk's gate and the cells' door, no pass-through.
- The pad alone at the hospital: square opens the street door, the stick walks me through
  the hall, the swing doors and the ward to its far wall; 0 key or mouse events. (My play's
  turn to a bed missed: the bed's sleep by pad is not proven by me.)

## Cheats (code that wins for the player or loses without a tell)

- `src/places/rooms/hospital.js` ~l.100 + `src/places/Places.js` `sleepAt` l.571-599: a free
  ward bed clears any heat and mends health in 4 s (B3).
- `src/night/bounty.js` `stepLed` (`d > 24`: the led man put 3.2 m behind me wherever I am):
  he can never be lost by walking, only by 70 m for 8 s; lenient by design, but it is a
  teleport (out of sight).
- `src/night/bounty.js` `lose()` (`M.far > 8`): the man lost with no warning line first (M1).

## What is good and must not be broken

- The first open of every door is one frame (8-25 ms from E to the leaf at twelve places).
- The diner is not a bar: the lit pie case, the two urns, the lit price board TODAY, the pass
  with the cook's shape (frame 6). The Orpheum's posters have pictures and titles (RAIN ON
  CANAL ST., BLACK SEDAN). The gym's BOXING card and BOUTS NIGHTLY over the lit ring; the
  Docks bar's tables, NO CREDIT and the wheel against the Tenements bar's white bottle wall;
  the warehouse's hanging chains and stencil. A player tells the rooms apart.
- The ward is a panel: one pendant's cone, the white pool on the aisle, the iron beds at its
  edge, two lit windows, the night nurse's lamp at the far end (frame 5).
- The fall: warned, the black names the man, the ward's bed, `Came round. $10 for the
  stitches.`, `E  get up`, out by the doors on foot, the car where it was.
- The booking: `E  book him` only with him at hand, the reward once, the poster `PAID`, his
  walk through the gate and the cells' door to a bench; `Take him to headquarters.` as the
  line from the take to the desk.
- The nurse's and the hall's answers to a fist and a shot (the word, the cower, the heat).
- No errors in `#errlog` in any of my eight plays.

## Your asks, as I saw them in play

1. "buildings to enter and things to do": **met** - twelve doors open on rooms, the hospital
   is a building, the board and the desk are a thing to do end to end.
2. "Keep it very much this same aesthetic": **partly** - the ward, the diner, the bars, the
   gym are panels; the hospital's hall is a grey wash (M3); HQ's hall the same at ambient 0.6.
3. "everything works": **not met** - the ambulance takes you in and you drive blind (B1); the
   nurse at her desk does not answer (B2). Doors never open on nothing; first opens one frame.
4. Nothing copy-paste: **met for the rooms** (the card's names are O7's: two "the Ox").
5. "the city should react": **met here** - a jab at the nurse is heat 1 and her word, a shot
   in the hall `Everybody down.` and heat 2, the gunmen at the door within seconds.
6. "freedom to cause havoc": **met but undercut** - nothing says no, but the free ward bed
   (B3) ends any havoc's heat in four seconds, so the city's answer does not hold.

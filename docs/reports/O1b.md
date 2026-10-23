# O1b — the streets, distinct; more in them; items; a touch of colour (lane report, the handover)

Branch `ow/O1b-streets`, port 5378. Brief: `docs/briefs/O1B_STREETS.md` (with
its two later sections: the cold play's findings and the performance
audit's levers, both merged from `main` and done here). Built on O1's city
(`docs/reports/O1.md`, `docs/seams/WORLD.md`). Review frames:
`docs/review/O1b/` (six JPEGs of the pass after the critic, section 0; the
critic's own six are in `docs/review/O1b/critic/`). Every proof was played headless by real input (trusted keys
and mouse, or the fake pad alone), muted, on a machine at load 20-85 from
other lanes and system services (`secd`, StorageManagement at 90-160 % CPU):
frame times in this report are not clean absolutes.

**Not in this lane, said plainly (the critic's M1): the city has no people and
no traffic yet.** The user's "I assume you are going to populate the city" is
lanes O3 (pedestrians, gangs, the police) and O2 (traffic, parked cars, the
cars to hijack): neither was merged when this lane was played, so every frame
of it has the one coupe and nobody in the street but pigeons and steam. This
lane makes the streets they will walk and drive (distinct, dressed, with things
to pick up and a touch of colour); it does not put anyone in them.

The pass after the critic (`docs/reports/O1b_CRITIC.md`) is section 0 below:
each finding, what changed, its play.

---------------------------------------------------------------------------
## 0. After the critic (`docs/reports/O1b_CRITIC.md`, played cold at cae4413)

`main` had moved (lane O4's combat, 24 commits): merged into this branch first,
clean; its `combat/money.js` wallet is now what the items add to (the money
and the coat's rounds), no shim of mine left. In the order a player feels them:

**B1 - the items unseen, and no prompt as a man walks.** Fixed.
- *Seen*: each kind has a paper-white part that prints in the dark (an unlit
  white: the roll's band, the box's label, the bottle's label and a highlight
  down its side, the matchbook; the roll and the box a third bigger than life)
  and a **glint** - a four-pointed white star that flashes on it for half a
  second every 2.2 s, within 24 m, about 40 px across at any distance, never on
  the thing being looked at (`parts/items.js` `glintGeo`, the update's glints);
  the white parts and the glint streak in the wet street too (frame
  `2_items_seen_and_found_as_a_man_walks.jpg`).
- *Found as a man walks*: a thing is "looked at" by where it lies before his
  feet - within 2.8 m on the ground, in a corridor 0.6 m wide at his feet
  widening 0.5 m a metre ahead, anywhere from the frame's middle down to just
  under its bottom edge (a thing he is about to step on) - not a 0.55 rad cone
  round the eye's line (`lookAt` in `parts/items.js`). Proof
  `tools/plays/o1b_walkover.json` (new: the driver's `walkover` mode): walking
  at each kind from 5.5 m on its open side, the eye 7 degrees down, W held -
  the prompt came at 2.67 m for the roll of cash, 2.67 m for the bottle, 2.73 m for the box of rounds and 2.73 m for the matchbook, each before he was on it (he stopped 2.1-2.4 m off when it came), and E took each; Tab after showed the money and the matchbook. The critic's own `c10_walkover.json`: the roll of cash at 2.73 m (the drums still stop him at 1.9 m, now with the prompt up), the box of rounds at 2.70 m, the bottle at 2.71 m (it never came before, 8.6 m past it).
- *More of them, and where a player begins*: 256 things (72 rolls of cash, 42
  boxes of rounds, 119 bottles, 6 matchbooks, 17 papers; were 148): by doors'
  steps (a bottle one door in twenty in the rough districts, one in forty
  downtown; a roll one in seventy; a box of rounds one in sixty in the Docks,
  the Yards and the Tenements), a roll by one pavement's bins in fourteen, and
  round **every start** a roll, a bottle and a box by the doors 15-70 m from
  the car. From the Grand Ave start: the nearest roll 29.7 m (was 177), bottle
  45.8 m, box of rounds 61.1 m (was 215).

**B2 - the firehouse a red wash pasted over shop fronts.** Fixed, and the 26
others checked. The uniques are now chosen *before* the faces are dressed
(`world/dressing.js` `pickUniques`): the lot's ground floor is cleared under
each unique's span (`UNIQUE_SPAN`: no shop front, door or loading door there,
so none of the lot's boards, displays, awnings, blades, glass, window neon or
pavement things), the iron pilasters skip it (`dress.js`), and the unique's own
doors stand in the face's windows (`UNIQUE_DOORS`, `kind: 'door', unique`),
drawn by the unique, not the facade. The firehouse itself
(`city/kits/uniques.js`): two tall doors of leaves in dark enamel, pale rails,
a row of lights, the pier between, ENGINE CO. 7 over them; its red is a lamp
over each door and the street's fire alarm box on its post. Colour at arm's
length (3.5 m): **0.06 %** (was 47.6); from across Baxter St the two red lamps
and their streaks. All 26 looked at from the road (5.5 m): no board, pilaster,
display or pavement thing across any; the SEAMEN'S REST board, which was
behind its own plank, now in front. Frame `3_firehouse_after_near_and_across.jpg`.

**M1 - the city still empty.** Not this lane's (O2, O3); said plainly at the
top of this report.

**M2 - a bit more colour not felt.** Fixed. Every street has its **accent**
(`world/streets.js` `accent: { col, every }`): neon blades in its colour over
its shop fronts every 30-70 m a side (`parts/places.js`, the trade's word on
the blade: TAILOR, LOANS, BARBER ...; in the Docks over a door, the bars'
red BAR, ROOMS, GRILL; in the Yards amber GARAGE, DINER, TRUCKS over doors and
loading doors; never two blades within 9 m; one atlas cell a word and colour);
the Hill's gate lanterns burn amber. Downtown blue, red or amber by street,
the lanes their own (Mott and Eldridge blue, Pell, Orchard and Rivington amber,
Bayard red, Doyers its red lanterns). Measured on the critic's ten blind
positions (on foot, his poses): mean **0.75 %** (the critic's 0.19 % over his 21 frames, and 7 of these ten under 0.1 %), nine of ten from 0.25 to 1.48 % - Mott St 0.25, Dock Rd 0.44, Canal St 0.65, Pell Ln 1.36, Doyers Ln 1.48, the Bowery 0.66, Clock St 1.02, Rivington Ln 1.03, the Straight 0.55 - and Houston St 0.10 % (its red blades far down under the el, none near in that frame); none over 2 % (frame `1_critics_blind_ten_after_colour_by_street.jpg`). From the seat (this lane's ten):
mean 0.57 % (the first pass's 0.13 %), 0.23-1.73 %, none over 2 %, but Bridge St on the Hill 0.05 % (its amber lanterns read, small: Left 3). **Nothing over 2 % at arm's length**: the firehouse 0.06 %, the
uniques at 3.5 m at most 1.25 %; and from the road (5.5 m, facing them) the
RIALTO's and the ROSELAND's amber bulbs and the mission's red tubes streaked the
wet street red to 4.5-5 % - their bulbs and tubes are white now (the RIALTO's
colour its amber blade, the mission's its red cross, the ROSELAND's Fifth St's
red blades): 1.62 %, 1.46 %, 1.99 %; Doyers' lanterns a little fewer (1.70 %).

**M3 - the shop displays out of the wall.** Fixed: every display piece is
pressed into the window's own depth (`dress.js` `inGlass`: local z 0.076-0.096,
between the lit pane at +0.07 and where lane O6's glass goes at +0.1), a
silhouette against the light. Frame `4_display_inside_the_window.jpg` (FINE
SHOES, Grand Ave, side-on: the shelves flat on the glass).

**M4 - things that look usable answer nothing.** Fixed. The phone booth: `E
use the phone`, the receiver's click, `a nickel in, a dial tone - nobody to
call`; the mailbox: `E try the mailbox`, the flap's clank, `U.S. MAIL - last
collection 6 a.m.` (both by where they stand before my feet, as the items;
not when knocked over; event `city:use`). The uniques' doors - the firehouse's,
the church's and the belfry's, the hotel's under its canopy, the RIALTO's, the
baths', the ROSELAND's (no longer a white card: a glazed pair), the bank's,
the mission's, the SEAMEN'S REST's, the two yard gates - are street doors: `E
try the door`, rattle, `locked` (`city:door` with `door.unique`; a wide door
measured by its nearest point). The critic's `c8_poke.json`: the booth `E USE THE PHONE` and its line, the mailbox `E TRY THE MAILBOX` and its line; at the ROSELAND the matchbook on its step takes the prompt first (`THE ROSELAND - matchbook 1 of 6`), its door after; the firehouse from his 3.5 m gives no prompt - a door's reach is O1's 1.9 m for every door, I keep it - and from 1.3 m `E try the door`, `locked`.

**M5 - what I pick up means nothing I can see.** Fixed.
- *Rounds* go into lane O4's coat (`save.ammo.revolver`; the gun's pocket too
  when the revolver is in hand) and the line tells the truth: `12 .38 rounds -
  no gun for them yet`, or `12 rounds - 36 in the coat` once the revolver is
  his (the cheat gone). A police glovebox says the same.
- *A bottle*: `a bottle - for the next fight` (`... 2 in the coat`); in a fist
  fight a bottle in the coat is one of the things in reach (`coatBottle`, read
  by O4's `Crowd.start`): `E take the bottle`, it is in the hand, swung once it
  breaks on him. Proof `tools/plays/o1b_coat.json` on O4's bed: PASS - `E take the bottle`, in the hand, the coat's count 1 to 0, swung into the driver it lands and is spent.
- *Tab*: what I carry, for a moment (the rulebook's "the heat and the money for
  a moment"): `$`, the .38 rounds (and `(no gun)`), shells, drums, bottles,
  matchbooks N of 6 - a small card top right, 3 s (`#o1bpockets`, `pockets(G)`;
  the heat is O3's to add, the card O7's to take over). The pad's share and
  touchpad tap Tab (`Pad.js`, one line).
- *Escape opened no pause card*: not reproducible headless - the pause is the
  pointer lock's loss (Escape is the browser's, which a headless page has no
  lock to lose); in a real window it comes. O7's.

**M6 - streets in a district only partly told apart.** Fixed as far as rules
go. No shop's trade is the one beside it on its face (within 9 m) or the one
facing it across the street (within 12 m along it): Canal St's two DRUGS are a
LAUNDRY and a DRUGS now, Houston St sells tobacco, not coffee. The Tenements'
lanes each their own: Mott blue (its barbers' BARBER blades, the big pole),
Pell amber with all its washing kept, Doyers red lanterns and no washing,
Rivington amber, no washing, the bakery's glow; the laundry lines kept by each
lane's share (`wash`). Not re-played blind by a second cold eye: Left 2.

**Minors.** m1 (dark on dark): bicycles enamelled pale or mid (were black
tubes), tyres grey; the pavement things carry a floor of light of their own
(emissive 0x262626 on their material, as lane O6's fruit and papers have) -
the critic's bicycle at 3.6 m under no lamp now reads. m3 (the swim card):
the W held that walked him off the pier answered the card the frame it came,
and the critic's first look was some seconds after the splash: the card is
answered now by a fresh W a second in or by getting out, else it stays 6 s
(`o1b_swim.json` times it from the splash: up at 1.5 s, read 4.9 s). m2 (fists
into the new things) and m4 (the grey near ground): not done, Left 5 and 6.

**The cheats.** `rounds()` banks into the coat and says so (above). Money,
rounds and matchbooks are found **once a save** (`save.flags.o1bTaken`, by
spot): a taken roll never comes back, so no alley is a bank; a bottle (junk in
a doorway) still comes back after five minutes out of sight.

**Kept** (the critic's list): the Grand Ave start (its marquee red and amber
untouched, its golden frame changed only by the street's new blue blade and
the lit glass - the gate below), the glass and benches going under the car (O6's,
untouched), E into the coupe, the take on the press with its count, the paper's
card exactly, the matchbook line, Doyers Ln (its lanterns a little fewer, still
its red), the Yards' Straight and Dock Rd (their blades added), the swim off a
pier, the pad play (`o1b_pad.json`, now with Tab by the pad), no errors, the
frame rate (the gate below).

**The gate on the final code** (every play by real input, muted, at load 10-24 from other lanes' plays;
the proofs on 4378828; the one source change after them draws the accent
blades at half the neon atlas's resolution - the city's golden frames, the
critic's ten colour frames and the counts were taken again after it, the
seat's ten on 4378828)
- **Golden, game one's**: `python3 tools/golden.py check` - **40 of 40 identical**
  (the base's 38 and lane O4's two).
- **Golden, the city's**: `NOIR_GOLDEN=shots/golden/city python3 tools/golden.py check`
  - 11 of 12 changed, re-taken (the clock's identical), each by this pass:
  the streets' accent blades and their streaks (Grand Ave's blue, Houston's
  red, Broadway's and the Yards' amber, the Bowery's red: `city_grand_car`,
  `city_elcorner`, `city_broadway`, `city_straight`, `city_gasworks`,
  `city_station`, `city_tenements`, `smash_bed`'s blue TAILOR), a trade that
  no longer twins its neighbour with its display inside the glass (the
  Bowery's SHOES now a BARBER, `city_station`), the pavement things off the
  black, the Hill walls' lanterns and far blades by a few pixels (`city_park`,
  `city_quay`, `smash_wreck`). Before and after:
  `6_golden_before_after_grand_houston_bowery.jpg`.
- **Errors at every start**: `tools/errors.sh "scene=city&beat=roam&anim=1&t=3&at=<id>"`
  at all ten starts, `beat=ashore` and O4's `scene=o4&beat=brawl1`: clean, all
  twelve (the gasworks' first dump came back empty on the loaded machine; again: clean).
- **Proofs**: `o1b_walkover` PASS (above), `o1b_items` PASS (cash, rounds `12 .38
  rounds - no gun for them yet`, bottle, matchbook, paper, his revolver `18
  rounds in the coat`, the glovebox; E to the take 2.1-23 ms), `o1b_pad` PASS (the
  pad alone: square takes four kinds, share shows Tab; 0 key or mouse events),
  `o1b_coat` PASS, `o1b_swim` PASS (the card from the splash; run at e51e6d8; nothing after it touches the swim), `o1b_doors` PASS
  (24 doors, 8 on lots across a chunk line, every one answers), `o1b_smash` PASS,
  `o1b_train` PASS, `o1b_pigeons` PASS (up at 8.5 m and 23.6 m), the critic's
  `c10_walkover` and `c8_poke` as above. **`o1b_jank` 19 of 20**: the flowers
  walk (a different tub now: the list it picks from changed) slid the man round
  the round tub instead of stopping him square - never inside it (no `inside`),
  but the walk's 'stop' rule failed; every other thing stopped him short.
- **Colour**: the critic's ten 0.75 % mean, none over 2 %; the seat's ten 0.57 %,
  none over 2 %; every unique from the road at most 1.99 %, at arm's length at
  most 1.25 %.
- **The neon atlas**: 3,755 of 4,096 px (542 accent blades, 582 blades in all).
- **The build**: `npx vite build` passes. `main` merged again at the end (one
  commit, O4's seams into three briefs: docs only).
- **Frames per second** against `shot=perf` at the same moments
  (`MOMENTS=city node tools/fpstable.mjs 5`, once, at load 45-60, the GPU 100 %
  busy before each): Grand Ave from the car **1.09 x** (652 draws, 2.56 M
  triangles), the el's corner **1.87 x**, Broadway to the clock **1.48 x**, the
  Bowery under the station **1.45 x**, the quay **1.55 x** - every spot over
  `perf`; the critic's at load 130-178 were 1.20 / 1.88 / 1.27 / 1.53 / 1.78:
  Grand Ave is the thinnest (its blades and the start's items), Left 4.


---------------------------------------------------------------------------
## 1. What exists (as a player meets it)

**Every street its own** (`src/world/streets.js`: a CHARACTER per street of
the plan, over its district's base). Each record names the street's facade
stone, its window heads, its lamp, its trades, its lettering, its awnings'
canvas, its trees, its furniture's densities, its share of red neon and the
one thing mid-block that is only there (`look` says it in a line). What a
man sees of it:
- **Its lamps** (the light pools are the night's structure, so they differ
  most): the gooseneck (downtown, 183), a fluted post with a glass globe
  (the Hill, Centre St, Canal, Fifth, Park Row, the steps: 231), a lantern on
  an iron bracket from the wall (Hester, Clock St, Water St, Bayard,
  Rivington: 54; no post), a shade hung on a wire across the lane (Mott,
  Orchard, Doyers, Pell, Eldridge, Delancey: 63, every 17-24 m, no post), a
  timber pole with an enamel dish (the Docks, the Yards: 200). Each style
  its own iron, shade, glowing mouth (the far build's) and cone (straight
  down for the globes and the hung ones).
- **Its facades**: the masses dark brick, grey stone or pale limestone
  (a third far material) by the street; window heads by the street (flat
  lintels, hood mouldings, brick arches, none); cast-iron pilasters (Baxter,
  Broadway), quoins at the true corners of stone and limestone fronts,
  a glazed tile ground floor (Canal St).
- **Its shops** (3,073 of 3,124 shop fronts have a trade; 1,013 are lit):
  a lettered board on the fascia in the street's hand (deco, Didot serif,
  script, Impact block, stencil; neutral greys only), often a proprietor's
  name over the trade (KLEIN TAILOR, COHEN JEWELER: 16 names x 20 trades x
  5 hands); behind the lit glass what the trade has, dark against the light
  (a tailor's dress form, a butcher's hooks, a bookshop's shelves, a
  barber's chair, a radio, hats on stands, shoes on shelves, a pawnshop's
  trumpet and clock, a chop suey's ducks and red paper lanterns, a deli's
  salamis, a laundry's shirts on a line, a chandler's rope ...); an awning
  in the street's canvas (wide stripes, pinstripe, pale, dark, scalloped);
  a barber's pole (red and white, its glass lit) at most barbers; neon in
  one lit window in four of the trades that burn one (EATS, LOANS, CHOP
  SUEY, SODA, WATCHES ...: 214, red 79, blue 83, white 52).
- **Its doors** (the cold play's finding 8): a leaf of its own by the hash
  of where it stands - panelled, glazed (lit now and then), double, a
  warehouse's planks in the Docks and the Yards - its paint dark, mid or
  pale, a knob, a mail slot, a lit transom over some, a number plate beside
  many.
- **Its trees** (`src/city/kits/trees.js`, the cold play's finding 7): a
  shape each - winter-bare (the trunk forks, the limbs bend and fork into
  twigs: ink lines on the sky), the London plane, the Lombardy poplar, the
  vase elm with a ragged crown - on Centre St, Fifth St, Canal St, Mercer St,
  Park Row, the Hill's streets, in the gardens (O1's lumps replaced) and the
  park (O1's park trees moved into the streamed set): 366 street and park
  trees, mostly bare (the Hill is winter).
- **The one thing mid-block** (`src/city/kits/uniques.js`, 27): Grand Ave the
  MAJESTIC's canopy on its posts with bulbs under it; Centre St THE EVENING
  STAR's lit board and clock; Broadway the RIALTO's marquee with amber
  bulbs and its blade; Clock St a lit street clock on its pillar; Baxter St
  ENGINE CO. 7's tall dark doors, a red lamp over each and its alarm box; Canal St the PUBLIC BATHS' tiled
  front, round lit windows, steam; Mercer St a stone church with a rose
  window and an 18 m spire; Hester St a church's belfry with a lit clock;
  Fifth St the ROSELAND with its bulbs; Market St the SAVINGS BANK's six
  columns and pediment; Houston St the mission's red JESUS SAVES and its
  cross; Water St the SEAMEN'S REST's anchor and lantern; the Bowery the
  pawnbroker's three balls; Mott St a big barber's pole; Orchard St the
  CELLAR: an iron-railed areaway with an amber window low in it; Doyers Ln
  the JADE GARDEN's red lanterns strung along the lane and its red blade;
  Pell Ln the HAND LAUNDRY's steam pipes; Bayard Ln LIVE POULTRY's crates;
  Eldridge Ln a yard gate; Rivington Ln the bakery's glow up through a
  pavement grating; Delancey Ln CYCLES; Dock Rd HARBOR LUMBER CO.'s gateway;
  the Straight a water tower on a trestle; Foundry St a lit billboard
  (GALLAGHER'S RYE) on the roofs; Gasworks Ave CITY GAS LIGHT CO. painted
  high; Park Row a drinking fountain in a niche; and **the Hill's curving
  lane** (Hill Rd to Bridge St through the garden between Baxter and the
  Bowery: an S of cobbles between stone walls, piers at its mouths, globe
  lamps along it, a big house in each garden it leaves, bare trees).
- **The Hill's streets** (finding 7): a lantern lit on every gate pier.
- **Pier sheds** (finding 9): a gabled roof, sliding doors, lit windows,
  PIER 7 OFFICE on the office's.
- **The el's stairs** (finding 11): a gate at each foot, chained, CLOSED;
  solid; E at it rattles it as a street door does (`city:door` with
  `door.gate === 'el'`: a lane that opens the el lets it through).

**More in the streets** (`src/world/dressing.js`, by rule, each a seeded
variant by where it stands): 1,873 things on the pavements - crates and
barrels and oil drums by loading doors, handcarts, milk churns by doors,
dustbins by doors and in rows in the alleys, rain barrels under downpipes,
fruit stands outside grocers, buckets of flowers outside florists,
sandwich boards, bicycles leaning on walls, mailboxes and phone booths at
corners; 16 newsstands at corners (O1's furniture kind: they had none);
every one solid (its collider in `C.posts` / `C.walls`, tagged), none in
front of a door, none at a start. Steam out of the grates (one in five
manholes), the laundries' transoms, the bathhouse's and the laundry's pipes
(six vents round the eye at once). Pigeons on the ledges (parapets and the
course over the shops, six flocks round the eye) that go up as I come (8 m
on foot, 14 m in a car going fast, any shot within 45 m), wings beating, a
flutter, back after a minute where nobody looks. The el drips off its
girders into the wet street (rings). **The el's train pulls in and waits**
(14 s at each station, braking on a curve a hand would drive, pulling out
again, round the loop for ever; O1 Left 5). **A man in the river swims**
(O1 Left 6): off a pier's end, a quay steps' landing or a slipway he is in
the water, the eye at it with a slow bob, W strokes him on (1.8 m/s, 2.6
with SHIFT), `[W] swim to the steps` the first time; 33 flights of stone
steps down the quay's face and every pier's end, a globe lamp at each
landing, a gap in the railing there; at a flight's foot he climbs out (0.6
s, the look free); up a slipway he wades out. No fade, no loss. (A car in
the river is still the river's fade, as O1 left it.)

**Items** (`src/world/items.js`, `parts/items.js`): E takes them (the
kit's prompt `E  take` with its tick at the thing, on the press, 0.2 s of
the thing flying to the hand, never holding my feet), what it was and its
count said low in the frame (each with a paper-white part and a glint: section
0): a roll of cash (72: alleys' ends, by the Yards' drums and rain barrels, a
handcart, by doors' steps and pavements' bins, one round every start; $5-44,
O4's `save.money`), a box of rounds (42, behind the crates at loading doors, by
doors in the rough districts: 12 .38s into O4's coat, `save.ammo.revolver`), a
bottle (119, on stoops, by bins and doors: `save.flags.bottles`, taken out in a
fist fight), a matchbook on the step of every bar (six: THE BLUE NOTE,
THE ANCHOR, THE CELLAR, THE ROSELAND, SEAMEN'S REST, THE JADE GARDEN;
`save.flags.matchbooks`, `matchbook 2 of 6`), a paper at every newsstand
(E: THE EVENING STAR's front page for four seconds, walking on; its
headline the city's own news of what I did last), a man's gun where he
fell (`hood:down` drops it: E takes it, in hand, +6 rounds), and a car's
glovebox (taken by E: a police car's box of rounds, one car in three a
roll of cash). Money, rounds and matchbooks are found once a save; a bottle
is back after five minutes where nobody is looking. Tab shows what I carry.

**A touch of colour** (all through `src/render/accents.js`: `neonRed`,
`paintRed` added; `neonAmber` and the neon blue used): one neon blade in
ten red by the street (a quarter on the Bowery), the windows' neon above,
the barbers' poles, the firehouse's two lamps and alarm box, the mission's
cross, the chop suey's lanterns, the theatres' marquee bulbs amber (were
white; the ORPHEUM's at the start), the RIALTO's blade, the cellar's and the
bakery's amber glow; and after the critic every street's accent blades and the
Hill's amber gate lanterns (section 0).

**The street is darker between its pools** (finding 3): a uniform in the
ground shader, `uDryK` (default 1: the base's frames identical), 0.5 on the
city's road and 0.6 on its pavements: the dry ground near ink, the puddles'
sheen and the lamps' streaks kept.

**Every door answers** (finding 6, a bug): `doorNear` keeps each door by
where it stands, not by its lot's chunk: at Grand Ave and Centre St 25 of
25 doors tried answer, 9 of them on lots across a chunk line.

---------------------------------------------------------------------------
## 2. How it is built

| file | what |
| --- | --- |
| `src/world/streets.js` | the characters (`STREETS`, the districts' `BASE`), `character(id, district)`, `vhash` / `vpick` (the seeded variant by place) |
| `src/world/dressing.js` | `dress(C, ctx)` at the end of `generate()`: the lots' street faces and characters (`lot.fc`, `lot.mat`, `win.trade`, a fifth more shops lit), the lamps restyled by street (a bracket's and a hung lamp's post out of `C.posts`; kind `'wall'`), the hung lamps closed up, the trees (`C.trees`, the park's moved in), `C.dress` (one record each, its collider in `C.posts` / `C.walls`), the newsstands (`C.props`), the uniques (`C.uniques`: `pickUniques` before the faces are dressed, their colliders, the lot's ground floor cleared under `UNIQUE_SPAN`, their `UNIQUE_DOORS` put in the lot's windows), no trade twinning its neighbour or the shop across, the laundry lines kept by each lane's `wash`, the Hill's lane (`hillLane`: the garden and its house replaced, walls, two houses, lamps, trees), `C.itemSpots` (more after the critic: by doors' steps and bins, and round every start); `quaySteps()` (the railing's gaps read it in `cityGen.quay`) |
| `src/world/items.js` | the item kinds (`KINDS[kind].take`), `money(G, n)` and `rounds(G, n)` through O4's wallet (`roundsLine`: the honest line), `ONCE` / `spotKey` (found once a save), `pockets(G)` (the Tab card's lines), `coatBottle(G, make)` (O4's fist fight offers it), the news (`newsOf(G)`: `say(line, where)`, `latest()`) |
| `src/world/swim.js` | `swimStep(ctx, R)`: in, the swim, out by the steps (the climb) or a slipway |
| `src/player/modes/swim.js` | the controller's `swim` mode |
| `src/city/kits/dress.js` | the things' pieces (`PIECES`, `propPieces`; their whole shapes into `street.js` `PROPS_EXT` for O6's pools), `faceRelief` (window heads, pilasters, quoins, tile, doors, boards, displays, barbers' poles, awnings), the boards' atlas, `stepsPieces` |
| `src/city/kits/trees.js` | `treePieces` (four kinds) |
| `src/city/kits/uniques.js` | the uniques' builders, their lettering atlas, `stairGate`, `pierShed` |
| `src/stages/noircity/parts/dressing.js` | streams it round the eye (130 m, built nearest first in 2.5 ms a frame, dropped past 190 m): four meshes a chunk (props: solid, with each record's vertex ranges; relief; boards; lit), the uniques / steps / stair gates / pier sheds once and always drawn, the Hill's gate lanterns |
| `src/stages/noircity/parts/items.js` | the items drawn near the eye (their white parts, the glints), the look-at by where a thing lies before the feet (`lookAt`), E, the take, the booth's and the mailbox's answers (`USE`), Tab's card (`#o1bpockets`), the paper's card, the glovebox, the news fed from the city's events, the dropped guns; `api.glintAt` pins the glints' phase for a frame |
| `src/stages/noircity/parts/ambience.js` | steam's pool of vents, the pigeons, the el's drip |
| shared, marked `[O1b]` | `cityGen.js` (dress at the end; the railing's gaps; furnish returns its lookups), `street.js` (lamp styles in `placeLamp` / `lampHead`, lighter posts, `PROPS_EXT`), `facade.js` (the far mass by `lot.mat`; awnings left to the dressing where a street has a character; the gardens' trees), `far.js` (the limestone material; each lamp's own mouth), `stream.js` (doors by where they stand, `addDoor`, the stepped merge), `el.js` (bays merged by 80 m), `train.js` (the stations), `places.js` (red blades, window neon, amber bulbs, a taller atlas, the painted names at 0.4 resolution; after the critic every street's accent blades and the `amber` tube colour, one atlas cell a blade word), `uniques.js` lives in this lane, `Crowd.js` (O4's: the coat bottle offered at a fight's start), `Pad.js` (C12's: share and touchpad tap Tab), `facade.js` again (a unique's door is drawn by the unique), `stream.js` again (a door's `unique` and `w`; a wide door by its nearest point), `landmarks.js` (the park's trees left to the dressing), `compile.js` (the dressing's materials), `city.js` (the dressing warmed at a start, the swim, the seat taken once under the fade), `accents.js` (`neonRed`, `paintRed`), `ground.js` (`uDryK`, default 1), noircity `street.js` (`uDryK` set) |
| tools | `tools/colour.py` (the colour and tone measure), `tools/lib/o1b_streets.mjs` (items, pigeons, doors; `walkover` after the critic), `tools/plays/o1b_*.json` (after the critic: `o1b_walkover.json`, `o1b_coat.json`; the swim's and the pad's plays extended) |

---------------------------------------------------------------------------
## 3. The first pass's proofs (before the critic, at cae4413; kept as the record - the gate on the code after the critic is section 0's last paragraph, and its frames are the six in `docs/review/O1b/`)

| proof | play | result |
| --- | --- | --- |
| **items**: each kind picked up by E, the prompt before, the count after | `o1b_items.json` | PASS: cash `$14 - $14`, rounds `12 rounds - 12 in the pocket`, a bottle, a matchbook `THE ROSELAND - matchbook 1 of 6`, a paper (front page `RAIN TO LAST THE NIGHT`), his revolver (in hand, `+6`); E to the take **2.3-34 ms**; then the coupe by E: its glovebox searched (this car empty, by its hash) |
| **items by the pad alone** | `o1b_pad.json` | PASS: square takes cash, rounds, a matchbook, a paper; square into the car; 0 key or mouse events |
| **the swim** | `o1b_swim.json` | PASS: off Pier 7's end by W: swimming, the eye at -1.79 m (the water's at -2.1), no fade; W to the pier's steps: up and on the pier, on his feet, **12.1 s** from the splash; through a quay landing's gap into the water, then out up the slipway's ramp |
| **the train waits** | `o1b_train.json` | PASS: braked into BOWERY - CLOCK, its middle 0.2 m from the platform's; still standing 8 s on; pulled out; stopped at the next station |
| **the pigeons** | `o1b_pigeons.json` | PASS: two flocks walked at by W, up at 8.1 m and 23.7 m (the second a roof's flock, 19 m up) |
| **the jank walk of the new things** | `o1b_jank.json` | PASS: 20 walks by W into crates, barrels, a barrel, churns, a fruit stand, flowers, a sandwich board, a bicycle, dustbins, a rain barrel, oil drums, a handcart, a phone booth, a mailbox, a newsstand, a street tree, the Hill lane's wall, the cellar's railing, the bank's columns, a steps' lamp: each stopped short (0.5-2.2 m), never inside |
| **the new things go over** (O6's set, after the merge) | `o1b_smash.json` (O6's driver on a path) | PASS: E into the coupe at the Docks, west along Dock Rd and up onto its north pavement through the loading doors' crates, barrels and drums by the keys: at least five of them over (crates broken to planks, barrels and drums rolling), the car never inside a standing thing, nothing floating, nothing in a wall, everything resting |
| **the doors** (finding 6) | `o1b_doors.json` | PASS: 25 doors round Grand Ave x Centre St's west block, 9 on lots across a chunk line: `E  try the door` at each, E, `locked` |
| **errors** at every start | `tools/errors.sh "scene=city&beat=roam&anim=1&t=3&at=<id>"` x 10, `beat=ashore` | clean, all eleven |
| **the drive-through** | `o1_drive.json` | all five districts in 321 s, never inside a wall, **0 chunks missing** within 100 m, **0 built late**, 3 crashes / 22 scrapes (the bot's corners); **720 frames over 50 ms of 8,705** (27 fps on average in the 1280 x 800 window, the worst 209 ms) - **not under the hitch bar**, measured at load 20-85 (the 5-minute load 55 through the run; `secd` 160 % CPU); 519 draws, 2.13 M triangles at its end. O1's quiet run was 56 fps; see Left 1 |
| **the blind test** | ten frames from the seat (below) | made (its sheet was replaced by the pass after the critic; in git at cae4413); the critic named them (8 of 10 districts) |
| **the colour measure** | `python3 tools/colour.py` on the ten | **under 2 % in all ten**: max 0.81 % (Grand Ave: the ORPHEUM's amber bulbs and a red blade, their streaks), then 0.23 % (Fifth St: a red and a blue window neon), 0.10 (Hester: the barber's pole), 0.08 (Broadway), 0.04 (Orchard), 0.02 (the Bowery), 0.01 (Centre), 0 in the Docks, the Yards and on the Hill (no accent there by design); mean 0.13 %. Red 0.01-0.35, amber 0-0.11, blue 0-0.04. Paper white 1.0-3.2 %, ink 53-83 %, mid 11-41 % |
| **golden frames, game one's** | `python3 tools/golden.py check` | **38 / 38 identical** (on the final code, after the O6 merge) |
| **golden frames, the city's** | `NOIR_GOLDEN=shots/golden/city python3 tools/golden.py check` | **12 of 12 changed, re-taken** (O1's ten and O6's two): each by this lane's changes, named - the streets' lamps by style (Orchard's hung lamp over the lane, the Docks' dish lamps, the globes on Centre St and the Hill), the boards, displays, awnings and doors on every shop street, the new things on the pavements, the window neon and the amber marquee bulbs, the trees (the park's balloon crowns now winter trees and poplars), the darker dry ground, the el's merged bays (the same iron, contours between bays gone), the lighter lamp posts. Before and after (that sheet replaced after the critic; in git at cae4413): (Orchard St: a gooseneck and blank fronts become a hung lamp over the lane, DELICATESSEN, SHOES, MEATS, lit windows with their goods, a red window neon; the park: the balloon trees become bare winter trees and poplars) |
| **frames per second** against `shot=perf` | `MOMENTS=city node tools/fpstable.mjs 5` (load 180-214, the GPU 94-100 % busy before each) | Grand Ave from the car **1.09 x** (646 draws, 2.52 M triangles; perf 729 / 2.9 M), the el's corner **1.49 x**, Broadway to the clock **1.16 x** (900 draws: the clock tower's long view and the uniques), the Bowery under the station **1.06 x** (635 draws), the quay **1.71 x**: every spot at or over `perf`, Grand Ave and the Bowery with little room (O1's were 1.28 / 1.44 / 1.34 / 1.60 / 1.83 at load 16-22: the Bowery lost most) |
| **the build** | `npx vite build` | passes |

**The blind test** (the first pass's sheet, in git at cae4413; frames
numbered 1-10 as in the sheet; the critic names the district and tells the
streets apart before reading this key): 1 Orchard St (the Tenements' lane),
2 Dock Rd (the Docks), 3 Centre St (downtown), 4 Bridge St (the Hill), 5 the
Bowery (the Tenements, under the el), 6 Fifth St (downtown), 7 the Straight
(the Yards), 8 Hester St (the Tenements), 9 Broadway (downtown), 10 Grand
Ave (downtown, under the el). All from the coupe's seat in its right lane,
heading along the street (`?scene=city&beat=roam&t=2&car=x,z,yaw`: 271.75,100,1.5708 /
-60,328.1,3.1416 / -60,-28.1,0 / -150,-418.1,0 / 151.9,0,1.5708 /
-80,57.8,3.1416 / -448.1,-60,1.5708 / 332.2,-20,1.5708 /
-163.7,106.3,0.785 / -112.2,40,1.5708).

---------------------------------------------------------------------------
## 4. Feel

E to the take: 2.3, 2.8, 8.2, 13.9, 22.8, 34.1 ms from the trusted keydown
to the take (cash, rounds, paper, bottle, matchbook, gun): the frame of the
press or the next. The take never holds the feet (0.2 s flight of the thing,
walking on). The climb out of the water: 0.6 s (a context move, the look
free). The swim: W acts on the press as the walk does (it is the walk's step).

---------------------------------------------------------------------------
## 5. For other lanes

- **O6 (smash) - registered** (O6 merged into `main` while this lane ran;
  its fix pass merged it and did this): every new pavement thing is one
  record in `C.dress` - `{ id, kind, x, z, yaw, v, chunk, r | hx hz, face,
  tag, smash }` - with its collider in `C.posts` (round: `r`) or `C.walls`
  (a box: `hx`, `hz`, `angle` = its yaw) tagged by its kind and carrying
  `dress: rec`; drawn by `parts/dressing.js` in its own merged `props` mesh
  per chunk with `m.userData.ranges = [{ owner: rec, start, count }]` and
  `m.userData.prop = 'merged'`, `stage.smash.chunkIn` / `chunkOut` called
  as each chunk comes and goes. Registering is one call a record in O6's
  `props.js`: `for (const r of C.dress) if (KINDS[r.kind]) smash.register(r,
  r.kind, { merged: true })`. The kinds are added to `smashKinds.js`
  (`[O1b]`), each named as its record's kind and its collider's tag (so
  bounds' and track's solids are found by `itemAt`): `crates` (break),
  `barrels`, `barrel`, `drums`, `bins`, `churns`, `rainbarrel` (tumble,
  roll), `flowers` and `fruit` (goods), `board`, `bike` (light), `mailbox`,
  `booth`, `cart` (over, they lie); their whole shapes are `street.js`
  `PROPS_EXT` (`propGeo`, which `kindGeo` falls back to). 1,873 registered
  (the Docks start: 145 of them already in merged slots). The newsstands I
  added are O1's kind in `C.props` (`o1b: true`): O6's loop registers them.
  Still O6's: globe and dish posts are registered as `lamp` and its pool
  draws a gooseneck when one goes over (a `lampGlobe` / `lampDish` kind from
  `LAMP_STYLES` is wanted); bracket and hung lamps are `kind: 'wall'` (no
  post to knock), so a shot at their heads (`stage.lamps.hit`) gets no answer.
- **O2 (wheels)**: the glovebox is `stage.part('items').glovebox(car)`
  (called on `city:in` already: a police car is `car.kind === 'police'`, or
  `car.police`); the parked cars' bays are untouched; hung lamps hang at
  7.1-7.25 m (a tall lorry clears them), dish lamps' arms over the road at
  7.6 m. The cabin's share of the frame (the cold play's finding 4) is
  yours: the streets now differ at street height, but the seat shows two
  fifths of the frame as the cabin.
- **O3 (people, police)**: `newsOf(G).say(line, weight, where)`
  (`G.news.say`, THINGS_TO_DO §10): the worst line of the last ten minutes
  is the paper's headline, ties the newest (the city's own events feed it
  meanwhile, by street name: `MAN SHOT DEAD ON GRAND AVE` 3, `CAR BURNS ON
  ...` 2, `SHOTS FIRED ON ...` and `CAR RUNS WILD ON ...` 1); the `news`
  event `{ line, weight, where }`.
  The pavements carry more now: the walking graph is O1's; my things stand
  clear of doors and within a metre of the wall.
- **O4 (combat)** - merged: the items add through your `combat/money.js`
  (`wallet(G)`: `money(G, n)` into `save.money`, `rounds(G, n)` into
  `save.ammo.revolver` and the revolver's pocket when it is in hand); a gun
  taken is your `give` + `arms(G).to`; a man's gun is dropped on `hood:down`
  (`items.drop('weapon', x, z, { gun })`). **Shared edit in `Crowd.js`
  (`[O1b]`, two imports and two lines in `start`)**: a bottle in the coat
  (`save.flags.bottles`) is offered as one of the things in reach
  (`coatBottle(G, make)` in `world/items.js`: its point follows my eye, taken
  it is `buildProp('bottle', { variant: 'beer' })` and the coat's count goes
  down). The city has no fist on foot outside a fight: a jab into the street's
  things is yours with O6's `smash.hit(rec, point, impulse, 'fist')` (Left 4).
- **O5 (places)**: `city:door` now reaches every door (finding 6); the el's
  stair gates come through it with `door.gate === 'el'`; the bars'
  matchbooks lie on their steps until your counters exist (move them in:
  `C.itemSpots` kind `matchbook`, `place`); the CELLAR (Orchard St), the
  ROSELAND (Fifth St), SEAMEN'S REST (Water St), the JADE GARDEN (Doyers Ln)
  are fronts with a door each that could be places.
- **O7 (the night)**: the matchbooks' collection is `save.flags.matchbooks`
  (`{ place: name }`, six); the paper's card is `#o1bpaper` on the HUD; the
  `item:take` event `{ kind, item, said }`, `city:use` `{ kind: 'booth' |
  'mailbox', rec }` (the phone box's car is yours to hang on the booth),
  `pigeons`, `city:swim`, `city:ashore` `{ how: 'steps' | 'slipway' }` for the
  minimap or the radio. **Tab** is answered for now by a small card of what I
  carry (`#o1bpockets` in `parts/items.js`, `pockets(G)` in `world/items.js`;
  the pad's share and touchpad tap Tab - **shared edit in `Pad.js`**, one line
  and `Tab` in its key names): take it into your HUD with the heat.
- **The art director**: `uDryK` in `ground.js` (default 1).

---------------------------------------------------------------------------
## 6. Left (most felt first; after the critic)

1. **Nobody in the streets** - the people and the traffic are lanes O3 and O2
   (the critic's M1); this lane's streets are ready for them (the pavements'
   things stand within a metre of the wall and clear of every door, the hung
   lamps at 7.1-7.25 m).
2. **The streets inside a district were not re-played blind by a cold eye**
   after this pass (M6): the rules are in (no twin trades; each lane its accent
   colour and its own washing), but whether Mott, Pell, Doyers and Rivington
   are now told apart from the seat is the next critic's call.
3. **Houston St and the Hill have the least colour**: Houston 0.10 % in the
   critic's frame (its blades every 45 m a side, none near that pose; 30 m
   would do it - the golden `city_elcorner` would change again), the Hill
   0.05 % from the seat on Bridge St (amber lanterns on its gates and on its
   walls' piers every 18 m, a few pixels each). A warmer Hill (amber in the
   big houses' windows, the far build's `lit` bucket) is the next step.
4. **The drive-through's hitch bar is not proved** (as before the critic: 720
   frames over 50 ms of 8,705 at load 20-85, the whole frame slow, not spikes;
   re-run `o1_drive.json` on a quiet machine). This pass added 542 accent
   blades into the places' two existing meshes (no new draw; about 28
   triangles each, always drawn), the items' glints (one small mesh each, near
   the eye, hidden between flashes) and the Hill walls' lanterns (in the
   dressing's chunk meshes).
5. **Fists into the street's things** (the critic's m2): the city has no jab
   on foot outside a fist fight (lane O4's Crowd swings only in one), so a
   bicycle is never punched; O4 with O6's `smash.hit(rec, point, impulse,
   'fist')` (the door is there: "a fist counts a third of a round's push").
6. **The grey near ground** (m4) is not this lane's to fix further: the light
   blotches are the overcast sky in the puddles (the reflection pass), not the
   dry ground - `uDryK` 0.3 / 0.4 against 0.5 / 0.6 changed nothing a player
   would see in three frames, so it stays; the art director's shader lane.
7. **The Tenements' lanes' uniques are dark at night** (the steam pipes, the
   poultry crates, the yard gate, the cycle shop's wheel): only their boards
   and the bakery's glow read from 5 m in an unlit lane.
8. **Only the car's way was proved going over** (`o1b_smash.json`): rounds
   into the new things, a man at a run into a bin, a blast among them are
   O6's code paths and were not played for these kinds.
9. **The pause card on Escape** (M5's last line) could not be seen headless
   (no pointer lock to lose); O7's.
10. **The windows' neon reads as a coloured glow**, its word too small to read
   past a few metres; the blades are what carry a street's colour now.
11. **Bridge's leaves** are still one black slab from the approach; the
    **brush field at arm's length** is the ink shader's.
12. **The leafy crowns** (plane, elm, poplar) still print as black lumps; the
    Hill and the park are mostly winter-bare, which reads best in the ink.
13. **The matchbooks** lie on the bars' steps until O5's counters exist; the
    paper stays at its stand (endless; only its card shows).
14. **The glovebox** is searched on `city:in` (the free roam's own coupe at
    the first E); O2's hijack should call it for the cars it hands over.
15. **The news** is weighed but only the city's own events feed it until O3's
    police do.
16. **Stoops** are still doorsteps (O1's facade); **pigeons** come back only
    after a minute out of sight.
17. **The awnings, boards, poles, displays, blades and uniques are relief**
    (not breakable): one record an awning, as the props have, would let a lorry
    tear them (O6's `awning` kind).
18. **The dish lamps' cones** are large white wedges beside the car in the
    Docks and the Yards; a dimmer cone for the style may read better.

**Where the brief was changed in play**: the props are drawn by a part of
this lane's (`parts/dressing.js`), merged per chunk with each record's
range - one call to register each, O6's documented "merged set of its own" -
not each a mesh of its own (a few hundred would be a few hundred draws);
the twin-arm lamp was dropped (two heads on one post would be two O6 items
on one circle); the statue (Bridge St) was dropped for the Hill's lane; the
bars' matchbooks are on their steps (no bar opens yet); the hung lamps were
closed up to every 17-24 m (at the lanes' 34 m the lanes went dark between).

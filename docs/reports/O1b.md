# O1b — the streets, distinct; more in them; items; a touch of colour (lane report, the handover)

Branch `ow/O1b-streets`, port 5378. Brief: `docs/briefs/O1B_STREETS.md` (with
its two later sections: the cold play's findings and the performance
audit's levers, both merged from `main` and done here). Built on O1's city
(`docs/reports/O1.md`, `docs/seams/WORLD.md`). Review frames:
`docs/review/O1b/` (six JPEGs; the blind test is `1_blind_ten_streets.jpg`,
its key below). Every proof was played headless by real input (trusted keys
and mouse, or the fake pad alone), muted, on a machine at load 20-85 from
other lanes and system services (`secd`, StorageManagement at 90-160 % CPU):
frame times in this report are not clean absolutes.

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
  ENGINE CO. 7's red doors and red lamp; Canal St the PUBLIC BATHS' tiled
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
count said low in the frame: a roll of cash (42 places: alleys' ends, by the
Yards' drums and rain barrels, a handcart; $5-44, `save.money`), a box of
rounds (24, behind the crates at loading doors: 12 rounds into the
revolver's pocket), a bottle (60, on stoops, by bins: `save.flags.bottles`,
for the brawl), a matchbook on the step of every bar (six: THE BLUE NOTE,
THE ANCHOR, THE CELLAR, THE ROSELAND, SEAMEN'S REST, THE JADE GARDEN;
`save.flags.matchbooks`, `matchbook 2 of 6`), a paper at every newsstand
(E: THE EVENING STAR's front page for four seconds, walking on; its
headline the city's own news of what I did last), a man's gun where he
fell (`hood:down` drops it: E takes it, in hand, +6 rounds), and a car's
glovebox (taken by E: a police car's box of rounds, one car in three a
roll of cash). A taken thing is back after five minutes where nobody is
looking.

**A touch of colour** (all through `src/render/accents.js`: `neonRed`,
`paintRed` added; `neonAmber` and the neon blue used): one neon blade in
ten red by the street (a quarter on the Bowery), the windows' neon above,
the barbers' poles, the firehouse's doors and lamp, the mission's tubes,
the chop suey's lanterns, the theatres' marquee bulbs amber (were white),
the RIALTO's bulbs, the cellar's and the bakery's amber glow.

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
| `src/world/dressing.js` | `dress(C, ctx)` at the end of `generate()`: the lots' street faces and characters (`lot.fc`, `lot.mat`, `win.trade`, a fifth more shops lit), the lamps restyled by street (a bracket's and a hung lamp's post out of `C.posts`; kind `'wall'`), the hung lamps closed up, the trees (`C.trees`, the park's moved in), `C.dress` (one record each, its collider in `C.posts` / `C.walls`), the newsstands (`C.props`), the uniques (`C.uniques`, their colliders), the Hill's lane (`hillLane`: the garden and its house replaced, walls, two houses, lamps, trees), `C.itemSpots`; `quaySteps()` (the railing's gaps read it in `cityGen.quay`) |
| `src/world/items.js` | the item kinds (`KINDS[kind].take`), `money(G, n)`, `rounds(G, n)`, the news (`newsOf(G)`: `say(line, where)`, `latest()`) |
| `src/world/swim.js` | `swimStep(ctx, R)`: in, the swim, out by the steps (the climb) or a slipway |
| `src/player/modes/swim.js` | the controller's `swim` mode |
| `src/city/kits/dress.js` | the things' pieces (`PIECES`, `propPieces`; their whole shapes into `street.js` `PROPS_EXT` for O6's pools), `faceRelief` (window heads, pilasters, quoins, tile, doors, boards, displays, barbers' poles, awnings), the boards' atlas, `stepsPieces` |
| `src/city/kits/trees.js` | `treePieces` (four kinds) |
| `src/city/kits/uniques.js` | the uniques' builders, their lettering atlas, `stairGate`, `pierShed` |
| `src/stages/noircity/parts/dressing.js` | streams it round the eye (130 m, built nearest first in 2.5 ms a frame, dropped past 190 m): four meshes a chunk (props: solid, with each record's vertex ranges; relief; boards; lit), the uniques / steps / stair gates / pier sheds once and always drawn, the Hill's gate lanterns |
| `src/stages/noircity/parts/items.js` | the items drawn near the eye, the look-at, E, the take, the paper's card, the glovebox, the news fed from the city's events, the dropped guns |
| `src/stages/noircity/parts/ambience.js` | steam's pool of vents, the pigeons, the el's drip |
| shared, marked `[O1b]` | `cityGen.js` (dress at the end; the railing's gaps; furnish returns its lookups), `street.js` (lamp styles in `placeLamp` / `lampHead`, lighter posts, `PROPS_EXT`), `facade.js` (the far mass by `lot.mat`; awnings left to the dressing where a street has a character; the gardens' trees), `far.js` (the limestone material; each lamp's own mouth), `stream.js` (doors by where they stand, `addDoor`, the stepped merge), `el.js` (bays merged by 80 m), `train.js` (the stations), `places.js` (red blades, window neon, amber bulbs, a taller atlas, the painted names at 0.4 resolution), `landmarks.js` (the park's trees left to the dressing), `compile.js` (the dressing's materials), `city.js` (the dressing warmed at a start, the swim, the seat taken once under the fade), `accents.js` (`neonRed`, `paintRed`), `ground.js` (`uDryK`, default 1), noircity `street.js` (`uDryK` set) |
| tools | `tools/colour.py` (the colour and tone measure), `tools/lib/o1b_streets.mjs` (items, pigeons, doors), `tools/plays/o1b_*.json` |

---------------------------------------------------------------------------
## 3. The proofs (by real input, once on the final code)

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
| **the blind test** | ten frames from the seat (below) | made; the critic names them |
| **the colour measure** | `python3 tools/colour.py` on the ten | see below |
| **golden frames** | `golden.py check` (game one's 38; the city's 10) | see below |
| **frames per second** | `MOMENTS=city node tools/fpstable.mjs` | see below |

**The blind test** (`docs/review/O1b/1_blind_ten_streets.jpg`, frames
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
- **O4 (combat)**: `money(G, n)` adds to `save.money` (replace by your
  `money.js`); `rounds(G, n)` puts rounds in the revolver's pocket (an
  endless city pocket becomes counted at the first box) and into
  `save.ammo.revolver` when that exists; a bottle is
  `save.flags.bottles` (the brawl's bottle); a man's gun is dropped on
  `hood:down` (`items.drop('weapon', x, z, { gun })`: `revolver` or `tommy`).
- **O5 (places)**: `city:door` now reaches every door (finding 6); the el's
  stair gates come through it with `door.gate === 'el'`; the bars'
  matchbooks lie on their steps until your counters exist (move them in:
  `C.itemSpots` kind `matchbook`, `place`); the CELLAR (Orchard St), the
  ROSELAND (Fifth St), SEAMEN'S REST (Water St), the JADE GARDEN (Doyers Ln)
  are fronts with a door each that could be places.
- **O7 (the night)**: the matchbooks' collection is `save.flags.matchbooks`
  (`{ place: name }`, six); the paper's card is `#o1bpaper` on the HUD; the
  `item:take` event `{ kind, item, said }`, `pigeons`, `city:swim`,
  `city:ashore` `{ how: 'steps' | 'slipway' }` for the minimap or the radio.
- **The art director**: `uDryK` in `ground.js` (default 1).

---------------------------------------------------------------------------
## 6. Left (most felt first)

1. **The drive-through's hitch bar is not proved.** 720 frames over 50 ms
   in 8,705 at load 20-85 (the drive's average 27 fps in the window: the
   whole frame slow, not spikes). Not attributable on this machine; the
   lane added ~4 meshes a near chunk (130 m), the uniques (3 meshes), the
   items, steam, pigeons and drips, and took away about half of the lamp
   posts' triangles and nine tenths of the el's bay draws. Re-run
   `o1_drive.json` on a quiet machine; the dressing's `stats` (`buildMs`,
   `tris`) are there to read.
2. **Only the car's way was proved going over** (`o1b_smash.json`): rounds
   into the new things, a man at a run into a bin, a blast among them are
   O6's code paths and were not played for these kinds; the rain barrel's
   downpipe goes over with its barrel.
3. **The colour is a touch from the street, nearly none from the seat**
   (see the measure): most of it is in shop windows and blades, which the
   coupe's pillars and the right-hand lane keep at the frame's edge.
4. **The windows' neon reads as a coloured glow**, its word too small to
   read past a few metres (0.4 m tall); the colour and its streak in the
   wet street are what carry.
5. **Bridge's leaves** (finding 9's second half) are untouched: still one
   black slab from the approach; the **brush field at arm's length**
   (finding 8's second half) is the ink shader's (the art director's lane).
6. **The leafy crowns** (plane, elm, poplar) still print as black
   silhouettes of lumps; the Hill and the park are mostly winter-bare now,
   which reads best in the ink.
7. **The bottle** is counted but does nothing yet (O4's brawl); **the
   matchbooks** lie on bars' steps, not on counters (O5).
8. **The glovebox** is searched on `city:in`, so the free roam's own coupe
   is searched at the first E (empty or not by its hash); O2's hijack should
   call it for the cars it hands over.
9. **The news** is weighed (`say(line, weight, where)`: the worst thing of
   the last ten minutes is the headline) but only the city's own events feed
   it (a man shot dead 3, a car burning 2, shots or a wild car 1) until O3's
   police do; the paper stays at the stand (endless) - only its card shows.
10. **Stoops** (O1 Left 9) are still doorsteps: a raised stoop wants the
    door raised with it (O1's facade).
11. Pigeons come back to a ledge only after a minute and out of sight; a
    flock flushed by a far shot is gone from that street a minute.

**Where the brief was changed in play**: the props are drawn by a part of
this lane's (`parts/dressing.js`), merged per chunk with each record's
range - one call to register each, O6's documented "merged set of its own" -
not each a mesh of its own (a few hundred would be a few hundred draws);
the twin-arm lamp was dropped (two heads on one post would be two O6 items
on one circle); the statue (Bridge St) was dropped for the Hill's lane; the
bars' matchbooks are on their steps (no bar opens yet); the hung lamps were
closed up to every 17-24 m (at the lanes' 34 m the lanes went dark between).

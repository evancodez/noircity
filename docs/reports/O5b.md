# O5b — places, the follow-up (lane report, the handover)

Branch `ow/O5b-places` (from main `d6382da`), port 5375. Brief:
`docs/briefs/O5B_PLACES.md`. A follow-up of O5 (`docs/reports/O5.md`, its critic
and Left) on main after O5 and O7 merged (`docs/reports/O7.md`,
`docs/seams/NIGHT.md`). This report is the handover: what a player meets now,
how it is built, what was proved and what is left.

---------------------------------------------------------------------------
## 1. What exists now (as a player meets it)

**The hospital** (`hospital`, Downtown, Mercer St behind the Orpheum's block, the lot
x -201..-176, z 4..23). From down the street: a ground floor faced in pale stone over
the block's shop fronts (a hospital is not a tailor's), frosted windows lit from inside
(their streaks in the wet road), the door set back between two pilasters under a dark
canopy, **a lit globe** over it on its bracket (a real lamp of the city's deal: its cone,
its pool on the step), **EMERGENCY** lettered under it, **CITY HOSPITAL** up the face,
and **the ambulance** at the kerb (the city's lorry painted pale, AMBULANCE and a cross on
each side, its bell lamp dark: a car of the city's - solid, a car shoves it, a round
finds it). The place loads from 80 m (the others 34) so the globe is seen down the
street. Inside: **the hall** (pale lino, a white tiled dado to the shoulder, the
admitting desk under a hard pendant with **the nurse** behind it - E: her word; after a
wake, 'Paid. Mind the stitches.' -, a man waiting on the bench with his hat, a trolley,
NO SMOKING / VISITORS 2 - 4), **the swing doors** under WARD and a short corridor under
a bare bulb, **the ward**: a long room, eight iron beds with their heads to the side
walls, the aisle down the middle under **one pendant** (the beds at the pool's edge), a
man asleep in one (the blanket over his shape, his head on the pillow), a screen half
round another, lockers, the night nurse's table at the far end with its low lamp, two
windows lit on the night.

- **A fall in the city that no place claims** (the wanted man, a street fight, a
  gunfight the night's kit began: every `to: 'hospital'`) goes to black (the black names
  who), and I come round **in the ward's bed by the door** (lying, the aisle and the
  pendant before me): `Came round. $N for the stitches.` - O4's `fall.js` (a tenth of
  the money, the gun kept, holstered), the heat cleared (O7's stand-in police clear on a
  fall to the hospital), **my car where I left it** (gone or burnt: at the hospital's
  kerb). S / SPACE / E up, out through the ward, the swing doors, the hall, the street door.
- **Every free bed is a sleep** (the hotel's rule, `Places.sleepAt`): the black, health
  whole, the heat dies, the night on an hour, the save written at the city's new beat
  **`ward`** (CONTINUE wakes me in the ward's bed, no bill), `Slept. Saved.`
- The nurse, the waiting man answer a fist like O5's people (her word: `Not in my
  hospital!`, the room sore).
- The map marks the hospital once I have been within 40 m of its door (as O7's places).

**One board, the desk that books a man** (police headquarters). The posters of the
night hang on **the hall's sheets** under WANTED (O7's `poster()`: the photo, the name,
the district, the reward, `DEAD $`; crossed when he is down, `PAID` when paid, redrawn
when a man's state changes). The board outside HQ's door is gone. E at the board: O7's
WANTED card. A man beaten and taken in (`Come on.`) **follows me**: at my heels on foot
(a walk, a run when I run), into the back of my car when I get in near him (and out of it
beside me when I get out), in at a place's door behind me; left 70 m behind for 8 s he
is lost (`He got away.`, back on his corner). The line says `Take him to
headquarters.` and the minimap's ring sits on HQ's door (`game.things.start`). At **the
sergeant's desk** with him at my side: `E  book him` - `Book him.`, the reward paid
through `game.things.end` (O4's wallet, O1b's paper: `... BOOKED AT HEADQUARTERS`), the
poster `PAID`, the line and the ring gone, and he is walked through the cells' door to
the first cell and sat on its bench. A dead man's half is `E  collect  $N` at the desk.
The cells' doors answer E (a bench and a bucket behind each, as O5 built them).

**The rooms told apart** (brief §3; the art director's look at O5's frames):
- **The diner** no longer has the bar's bottle shelf: a low back counter with **the pie
  case lit from inside** (pies on stands under glass domes, a lattice top, a wedge cut
  out), the register, a malt mixer, **two chrome coffee urns** under a lit COFFEE and a
  low lamp, the cups stacked, **the price board lit** over the case (TODAY: coffee,
  pie, hash, eggs), and **the pass**: plates up, the bell, the orders on their rail, the
  cook's hands in the hatch.
- **The Orpheum's** lit frames hold **five film posters**, each its own picture and title
  (THE LONG NIGHT, SHE WORE GREY, DEAD MAN'S HAND, RAIN ON CANAL ST., THE BLACK SEDAN:
  a man under a lamp, a woman's profile, a hand of aces and eights, a street in the rain,
  a sedan's lamps) - and **the chandelier** (two tiers of fifteen lit arms round a
  chrome bowl, glass drops) whose light is the lobby's one pool on the carpet.
- **The gym's** walls: **four fight cards** (BOXING, two men squared up, the names -
  O4's KID LEARY, SAILOR DOYLE, IRON MIKE ROURKE among them - and the night) and **a chalk
  board of tonight's bouts** with their purses (read from O4's `BOXER_LEVELS`) and the
  tallies.
- **The warehouse**: **the goods stencilled** on the faces that look on the lane (PIER 7,
  FRAGILE, HAVANA, MACHINE PARTS, CANNED GOODS...), and **two chains** hanging from the
  roof over the lane (a hook, a block and tackle).
- Second strokes a player remembers: **the Tenements bar's pianist** (on a stool at the
  piano: he plays his set at eleven - the night begins at eleven - and again at one and
  at three, a slow blues, the left hand walking, a little out of tune; between sets he
  smokes; a fist or a shot in the room stops him: `Not the hands!`; E at the piano while
  he plays: `He nods. He does not stop.`), **the Orpheum's chandelier**, **the market
  hall's lamps** on their long cords **swinging in the draught** while a street door
  stands open (each at its own period, settling when it shuts; the light's head follows
  the bulb, so the pools sway on the stalls).
- The hall's and the hotel's rooms are as they were (the brief).

**The first open is one frame like the second** (brief §4): a place's room is compiled
(`renderer.compileAsync` against the stage's lights, in parallel where the GPU can) the
moment it loads, and drawn once into a scrap target a step later (its buffers and its
lettering on the GPU) - all while I walk up, 34 m out. The leaf now starts moving in the
frame E is pressed (it waited for the next step).

**The pier office's store**: the men's grid now takes the opening under the stairs'
landing (`Covers.rebuild` leaves an upper floor's colliders and switched-off ones out of
the grid - the landing's rails had closed the opening to the men); **its three men start
in the store** among the crates and come out through the opening when they draw.

**Small things**: the bar's and the diner's stools take E only when looked at, close
(range 1.7, cone 0.38: a fist at the barman never becomes a seat - the critic's minor
10); the tour reaches the diner's jukebox, HQ's cell bench and a ward's bed (`tourAt`).

---------------------------------------------------------------------------
## 2. How it is built

| file | what |
| --- | --- |
| `src/places/rooms/hospital.js` | **new**: the hospital (front, hall, corridor, ward, the ambulance in `live`, `wake(K, s, P, how)`: `'fall'` the stitches, `'ward'` CONTINUE) |
| `src/places/sites.js` | the hospital's site (the downtown lot nearest (-190, 13) with a door on Mercer St), `loadR: 80, dropR: 110` |
| `src/places/Places.js` | `s.loadR` / `s.dropR`; `sleepAt(beat)` (the hotel's sleep, shared); `wake(id, how)`; `warm(s)` / `warmDraw(s)` (the first open); the leaf's first step on the press; the hospital found for the map; `OUCH` for the nurse and the pianist |
| `src/places/art.js` | **new**: the painted faces: `filmPoster(i)`, `fightCard(i, names)`, `chalkBoard(rows)`, `stencil(text, sub)`, `priceBoard(rows)`, `pieCase()` |
| `src/city/kits/interior/pieces.js` | `label(..., { draw, res, shade, outer })`: a face painted by a function, its resolution, lit by the room's lamps (`shade`) or a lit panel, drawn with the street (`outer`); `crates()` returns its boxes |
| `src/city/kits/interior/mats.js` | `lino` (the hospital's pale floor), `stone` (its front) |
| `src/places/rooms/police.js` | the desk (`book him` / `collect`), the board's E (the card), the posters on the sheets (`live`), the booked man's path to a cell |
| `src/places/rooms/diner.js`, `theatre.js`, `gym.js`, `hideout.js`, `hall.js`, `bar.js` | the rooms told apart (§1); the pier office's men in the store |
| `src/audio/sounds/o5_places.js` | `o5b_piano`: a piano's note, two strings a few cents apart, the hammer's knock |
| shared, marked `[O5b]` | `src/night/bounty.js` (the board gone outside, the man led, `book`, `collect`, `ledNear`, `lose`; `poster` exported), `src/scenes/city.js` (the `hospital` beat in the ward, the new `ward` beat), `src/game/Save.js` (the `ward` beat written), `src/night/map.js` (the hospital's mark), `src/guns/Covers.js` (the men's grid), `src/stages/noircity/parts/items.js` (one guard: a TypeError at the first matchbook taken after BEGIN - `flags.o1bTaken` was not there) |
| `tools/plays/o5b_*.json`, `tools/lib/o5_places.mjs` | the proofs; the tour's `tourAt`, its answers for the WANTED card and a sleep, its loads counted from a place's own turn |

## 3. For other lanes

- **O3 (police)**: a fall routed `to: 'hospital'` wakes in the ward now (`city.js`
  beat `hospital` -> `places.wake('hospital', 'fall')`); the arrest's `station` beat is
  unchanged. The wanted men's walk to the station is mine now (`bounty.stepLed`): give
  him your gang man's brain when it lands, keep `M.mode === 'led'` while I lead him.
- **O7 (the night)**: the bounty pays at **the desk**, not the board (`bounty.book(M,
  path)`, `bounty.collect()`); `bounty.board()` returns null; `bounty.use()` opens the
  card; `owed()` counts only the dead men's halves; a man taken in is a `game.things`
  thing (`bounty_<id>`: `booked` or `lost`). `o7/bounty_medium.json`'s tail now leads him
  to the desk.
- **O2 (wheels)**: the ambulance is a `truck` from `vehicles.spawn` with its own
  paint and lettering (`hospital.js` `ambulance()`); when you have an ambulance kind,
  spawn yours there instead. The led man rides in the back of whatever I drive (hidden,
  `M.inCar`).
- **O1b (items)**: an item lying before a place's door takes E before the door (the Docks
  bar's: `E  take` where the door should say `go in`) - the plays aim at the door; a
  player looking down at the step gets the item first. The guard in `items.js` line 299
  is mine (a crash): keep it or fix it at its root (BEGIN's `save.load(null)` replaces
  `flags` after the items were laid).
- **Anyone adding a room**: a painted face is `label(K, '', a, y, c, { w, h, dir, draw:
  (g, pw, ph) => ..., res, shade })`; a place seen from far loads further with
  `loadR`/`dropR` on its site; nothing is needed for the first open (the warm-up is the
  places' own).

## 4. Proofs (by real input, on the final code; dev server on 5375, the GPU 100 % busy from other lanes)

| proof | play | result |
| --- | --- | --- |
| **the hospital**: a shot in the street by the wanted man (heat 2, he draws), then the bot stands in the open and does nothing | `o5b_hospital.json` | **9 / 9**: the black names him (`Flanked. -> hospital`), `Came round. $10 for the stitches.` in the ward's bed, $100 -> $90, heat 0, the revolver kept; up (S), out through the ward, the swing doors, the hall and the street door by walking; the car 0 m from where it was |
| O7's idle bounty wakes there | `o7/bounty_idle.json` | **4 / 4**: warned, put down, `Came round. Stitched up.` (broke: nothing docked), he is still out |
| **a ward's bed is a sleep**, CONTINUE in the ward | `o5b_wardsleep.json` | **5 / 5**: woken at `?start=city.hospital`, up, to the bed across the aisle, `sleep`: black, health 60 -> 100, the save at `ward`, the clock +60 min; reload, CONTINUE: the `ward` beat, in the ward's bed |
| **the board and the desk**: the first man put on HQ's street, beaten by O4's good brawl bot, `Come on.` | `o5b_board.json` | **7 / 7**: the outside board gone; `Take him to headquarters.`; he follows (5 m behind, running) along the pavement and in at the street door; `E  book him` at the desk; +$150, `bounty_b0` booked, the poster on the hall's sheet `PAID`; walked through the cells' door to the first cell (sat at -4.7, -14.6 in the room's frame) |
| O7's medium bounty, its tail to the desk | `o7/bounty_medium.json` | **4 / 4**: taken in on the first try (44 s), led in to the desk, `book him`, +$150 |
| **the first open** at three big rooms, each walked to from 44 m down its pavement | `o5b_door_hitch.json` | **7 / 7**: the Docks bar E -> leaf **17.5 ms**, every frame after it <= 19.8 ms; the market hall **6.4 ms** (<= 18.6); the hotel **12.7 ms** (<= 21.3). Loaded under the walk in 39.6 / 59.7 / 8.9 ms, warm draw 5.2 / 5.8 / 1.0 ms |
| **the pier office's store** | `o5b_pierstore.json` | **4 / 4**: its three men start among the store's crates; 5.5 s after I am in the front office all three are in the opening under the landing, firing from it (a nav proof: my health held by the tool) |
| the pier office's contest after the move | `o5_hide_idle_pieroffice`, `o5_hide_medium_pieroffice` | idle: down in 26 s, warned (`They know your face.`); medium: **cleared first try** (42 s) |
| **the tour, whole** (14 places: O5's 13 and the hospital) | `o5_tour.json` | **PASS**: in and out of all 14, every door / seat / use answered (the diner's jukebox, HQ's cell bench, a ward's bed reached; the WANTED card; a sleep), the jank walk ok everywhere, each loaded once in its turn, the car never moved; first opens 5.8 - 19.4 ms |
| O5's and O7's plays that touch the places | `o5_hotel` 13/13, `o5_station` 8/8, `o5_bar` 11/11, `o5_havoc` 6/6, `o5_stool` 9/9, `o5_reel` 8/8, `o7/save` 7/7, `o7/autosave` 3/3 | all pass |
| **the pad** (`?padfake=1`, no key or mouse event) | `o5_pad.json` | **7 / 7** |

**The gate.**
- **Golden** (one check, on the final code): game one's **40 / 40 identical**; the city's **15 / 17
  identical**, two re-accepted and named: `o5_gym` (the four fight cards on the left wall: the
  brief's own change; nothing else in the frame moved) and `o5_bar` (the two drunks' and the
  barman's outlines a frame apart: the pianist added to the room's cast shifts the figures'
  idle phase; the room, its lamps and its bottles identical - looked at in the diff sheet).
  **Three new**, each looked at against the reference: `o5b_diner` (the long counter under its
  pendants' pools, the stools' black lathes, the lit price board and the hatch, the urns under
  COFFEE, the booths' black masses and the street through the glass: the reference's few hard
  pools in the black), `o5b_orpheum` (the chandelier the one white burst over a pale pool on
  the carpet, the posters' lit frames, the walls black), `o5b_ward` (one pendant's cone onto
  the aisle, the iron beds in silhouette at its edge, two lit windows and the night nurse's low
  lamp at the end).
- **Errors**: clean in all 16 places (`place=<id>`) and at the beats `hospital`, `ward`, `wake`,
  `hotel`; the garage and `station` hung in `errors.sh`'s virtual time and were killed by the
  watchdog (twice for the garage: as O5 saw with the hall) - in real time both are clean
  (`#errlog` empty after 724 / 726 frames), and every play above ends `no errors in #errlog`.
- **Frames per second** (`tools/fps.mjs`, 8 s, 1440 x 900, the GPU 100 % busy before each run):
  outside the hospital's door, the globe, the ambulance and the street **28.3 fps** against
  `shot=perf` 26.6 / 22.8 before and after: **1.15 x perf**.
- `npx vite build` passes.

## 5. Where the brief was changed in play

- **The man taken in follows me** (the brief: "E with the wanted man at hand"). O7's man
  walked off to the station by himself and vanished; the desk could only book a man who
  is there, so he comes with me: at my heels, in the back of my car, through the door.
  Out of my sight 24 m behind, he is at my back again (a man who followed me round a
  corner): no invisible leash shows, and no man stuck on a lamp post loses the bounty.
- **The hospital's lot is a shop row** (every downtown lot's ground floor is shops in
  O1's kit): its ground floor is faced over in stone, 0.42 m proud of the block, with
  its own windows, so the street reads it as a hospital; the floors above are O1's.
- **The pier office's three men** all start in the store (the brief: "its three men come
  through the opening"): the front office is empty when I walk in; they heard the door.
- **The pianist plays at eleven, one and three** (the night begins at eleven: a player
  who goes straight to the Tenements bar hears him; a set an hour on, an hour off).
- **The stools' E reach** (critic minor 10, unchanged by O5): range 1.7, cone 0.38.

## 6. Left (most felt first)

1. **O1b's item on a door's step takes E first** (the Docks bar's: `E  take` where the door
   says `go in`): a player looking down at the step picks it up; the next E opens the door.
   O1b's to place items off doorsteps (or the items' E to yield to a door looked at).
2. **The pier office's idle player dies in 26 s**, not "a few seconds": the three men come from
   the back of the store (3.5 s to draw, then the walk). The contest still holds (idle loses,
   warned; medium clears first try); bad and good not re-run after the move.
3. **The led man is not O3's yet**: he never tries to run on the way (THINGS_TO_DO §5), his
   gang holds no grudge, and when he is out of sight 24 m behind he is put at my back (no path
   finding across the city). O3's man and his brain when they land.
4. **A place's load is a long frame** when I come within its radius (40 - 60 ms at the Docks
   bar and the hall, O5's own cost; the warm-up added 1 - 6 ms a step later): the first open is
   now one frame, the approach is not. Building a room over two or three steps would spread it.
5. **The wanted men's tails** in O7's other plays (`o7/bounty_good`, `_bad`, `_gun`) were not
   re-run: their `taken` is still `taken` (the driver's check), but none of them walks the man
   to the desk.
6. **The ambulance** is the lorry repainted (O2 has no ambulance kind yet); it cannot be taken
   (no hijack in main) and its bell lamp is dark.
7. **The hospital's upper floors** are O1's facade (no rooms up there); the ward's sleeping man
   is a shape, not a figure (a cast figure lying in a bed has no pose of its own).
8. **The pianist's hands** are the cast's seated `sitTalk` gestures, not a pianist's; his set is
   a procedural blues of single notes (no record in `public/music/`).
9. **`errors.sh` hangs in virtual time** at the garage and at `station` on this loaded machine
   (clean in real time).
10. Still standing from O5: upper floors hold no people, the rooms' furniture merged (O6b's
    breakables), the garage stores no car (O2), the hall's shoppers slide without a gait.

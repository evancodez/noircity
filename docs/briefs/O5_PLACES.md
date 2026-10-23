# O5 — places: the interior kit and the dozen buildings with their uses, the hotel's save

Branch `ow/O5-places`, port 5375. Built on the city (lane O1 is merged:
read `docs/reports/O1.md` "For other lanes" and `docs/seams/WORLD.md`
first: every door that opens later is a kit door closed now, named by
building and anchored on the plan; the chunks and what they draw through
a door), on the combat (lane O4, `docs/reports/O4.md`: how a place starts
a bout, how a system spawns a fight, the gun shop's rules, `save.money`)
and on the destruction set (lane O6, `docs/seams/SMASH.md`: the glass of
shop fronts and the interiors' breakables). The user's words:

- **[must]** "buildings to enter and things to do."
- **[must]** "Keep it very much this same aesthetic": every room a panel
  of the reference's artist (a pool of light, the black, the few
  strokes; `DESIGN.md`).
- **[must]** "everything works": what looks usable is usable, and the
  answer is the honest one; a door I cannot enter rattles, locked; a
  door never opens on nothing; nothing passes through anything; a body
  never blocks feet.
- **[must]** "This city should really react to player interaction (like a dynamic police system), fun shootouts, brawls, etc. Keep the scope manageable but it should feel fun." (OPEN_WORLD.md: the city answers everything the player does, within seconds, visibly.)
- **[must]** "Think GTA but noir. Make sure the player has freedom to cause havoc and do what they want in this open world, one that reacts to them." (OPEN_WORLD.md: the player may do anything the systems allow and the city answers everything he does, visibly, within seconds; no invisible hand says no, never a scripted stop or a locked verb; the only answer is the city's own, and a scene broken on purpose still ends somewhere sane.)

Read `docs/THINGS_TO_DO.md` first: the design of every thing to do (how
each is found, played and answered by the city; the seams `things.start`
/ `things.end`, `news.say`, `money.add` / `money.take`): it binds.

What you build on: the office (`src/stages/office/`: `plan.js`, `build/`,
`parts/`: a whole interior with its doors, lights and furniture), the
killhouse's door (`src/stages/killhouse/door.js`: a hinged leaf with a
collider that swings, `open`, `close`, `locked` and the rattle, a pane of
the glass system), the diner (`src/scenes/_diner_room.js`,
`src/stages/block/parts/diner.js`, `dinerFront.js`: a room with a
counter and a stool to sit on), the pier's shed and office
(`src/stages/pier9/kit.js`, `site.js`), the studio, the props
(`src/props/lib.js`, `kinds/`, `liquid.js`), the frosted glass
(`src/stages/office/build/frosted.js`), the kit (`docs/story/seams/Z.md`:
`E` prompts, `hud.teach`), the saves (`src/game/Save.js`), reports
`docs/story/reports/wave-c/C5.md`, `C7.md`, `C8.md` and their `Left`.

## 1. The interior kit (`src/city/kits/interior/`)
Pieces a person can assemble into a room from a small plan: walls and
partitions, doors that open (the killhouse's, made the kit's: push or
pull, locked, glazed, double), stairs and landings, counters and bars,
tables, chairs and stools (a seat is a place to sit: E, the camera eased
down, E up), beds, shelves, a safe, lockers, a ring, a screen, lamps with
pools and switches that work, windows onto the street (the chunk outside
seen through them, O1's), floors (boards, tile, concrete) in the ink's
three greys. Everything solid; everything that looks movable has an
answer (a chair goes over: O6's set; a bottle breaks; a phone clicks; a
switch lights). Interiors are **loaded on entry** and dropped on leaving
(a seam with O1's streaming), so no room costs the street a frame.

## 2. The dozen (`src/places/`)
Each entered through its kit door (E: the door opens, I walk in, the
street still drawn through it; the car I left stays outside; the heat
is kept, and the police lose me inside after a while: O3's
`police.lost()`), each with its use, each a place a player finds by
looking (a sign, a lit window, a door with people at it):
1. **the boxing gym** (the Tenements): the ring, the bags, the men
   training; the man at the ring: E, a bout for `$` (O4's
   `brawl.bout(level, bet)`: three levels), the crowd around the ropes;
2. **the diner** (Downtown): sit at the counter (E), the coffee (E:
   health whole, the cup in my hands), the pie; a cook, a waitress, two
   customers who talk;
3. **two bars** (one on the Docks, one in the Tenements: the gangs'): a
   drink at the bar (E: the glass, the amber), a card game at a back
   table to watch (E sits), a fight that breaks out between two men now
   and then (O4's spawn), a matchbook on the bar (E: taken, one per bar:
   `save.matchbooks`, O7 shows the collection);
4. **the gun shop** (Downtown, off the avenue): the counter and its man,
   the case of guns, the card of prices (O4's rule), E to buy;
5. **the garage** (the Yards): the pit, the lift, the cars in it (O2's
   rules: store, repair, repaint), the man in overalls;
6. **the hotel** (Downtown, on the avenue): the lobby with its desk and
   its lift, a corridor, my room: the bed (E: sleep: the black, the heat
   dies, health whole, the night runs on an hour, and the **save** is
   written: `save.write()` as the game has it; O7 defines the open
   world's save format and CONTINUE: you call, O7 defines; until then
   the base's v2 save with `city` as the scene);
7. **the police station** (Downtown, the HQ): the desk, the cells
   (where I wake after an arrest: O3's seam: `places.wake('station')`
   puts me on the cell's bench, then the desk, then the door), the
   bounty board by the door (O7 fills it);
8. **the pier office** (the Docks) and **a warehouse** (the Docks): the
   gangs' hideouts: men inside who shoot (O4's spawn from the room's
   nav), the safe with `$` in the office upstairs (E: opened by a shot
   or a kick), a back way out;
9. **the market hall** (the Tenements): stalls under a roof, the
   crowd, a second door out the other side, the stairs to its gallery;
10. **the theatre lobby** (Downtown, the neon): the box office, the
    stairs, the doors to the dark house: a seat (E) and a short noir
    reel on the screen (a still of the stills' kind, `src/game/Stills.js`:
    one panel, held), then out;
11. **the tenement stairwells** (three in the Tenements): the street
    door, the stairs up four floors with the doors on each landing (one
    in three opens: a hall, a window, nothing taken), the door to the
    roof: the roofs and the fire escapes down (O1's roofs: this joins
    them).
Every other door in the city stays O1's kit door: it rattles, locked.
Nothing else says no: a player who breaks a room on purpose (shoots the
barman, takes the gym's purse at gunpoint, drives at the market hall's
doors, sleeps through a heat of 5 at the hotel) gets the city's own answer
(the heat, the crowd, the men who come) and the room still ends somewhere
sane (the hospital, the station, the street outside); never a locked verb.
Shop fronts have glass (O6's): a window broken is a way in to nothing
(the shop's dark back, a wall at 2 m, the alarm bell that is heat).

## 3. Proofs and gate
The interaction walk of every building (every door, every seat, every
switch, every thing that looks usable, with the answer each gave: a
list in the report), the jank walk of every room (every wall, piece of
furniture, stair, counter; a body on the floor and my feet), the door
latency (E to the first frame of the leaf moving, under 50 ms), the
in-and-out at every door (the car outside still there; the heat kept;
the street drawn through the door; no pop of the camera; nothing
loaded twice), the hideout's shootout proofs (`idle / bad / medium /
good` with O4's men), the gym's bout from the man at the ring, the
hotel's sleep and save (CONTINUE at the room), the station's wake, the
reel; the strips of a door opening and of the hotel's black, looked at;
fps inside the market hall with its crowd and in the hideout fight
against `shot=perf`; memory flat after entering and leaving every
building twice; golden identical (every earlier lane's frames) plus two
of yours (a bar, the gym); errors clean inside every building. Edits to
shared files marked `// [O5]`. Report `docs/reports/O5.md` with "For
other lanes" (the kit's pieces and plan format, `places.enter`,
`places.wake`, how a room spawns men, the matchbooks). Grey but whole
first (the kit, every door opening on a bare room, the hotel's save),
then the rooms one by one in the order a player finds them. Hours, not
days.

## From the cold play of the merged city (`docs/reports/CITY_COLD_PLAY.md`): yours
**Finding 6** is a bug under your feet: `doorNear` in
`src/stages/noircity/parts/stream.js` (line 144) searches only the chunks
around the player while each door is stored in its lot's chunk, so about
one street door in four gives no prompt and E does nothing, and your
`city:door` depends on it. If O1b's fix has not reached main when you need
it, fix it first yourself (a play that tries every door of a block) and
mark it `[O5]`; take O1b's from main if it lands first.

## From lane O4's merge (`docs/reports/O4.md`, "For other lanes"): yours
O4 is in main (5e83e76). A place's things are offered to a brawl by their
bounding-box middle: pass `{ kind, object, take(), available() }` in the
crowd's start `cfg.things` (bottles, chairs). The gym's bouts and the gun
shop's counter have their rules in `src/combat/` (`BOXER_LEVEL`, the price
card): the rooms are yours, the rules are O4's. The hospital and the
station are stand-in beats in O4's bed until your rooms exist. Take these
at your fix pass (it merges main first) and drop your stand-ins for them.

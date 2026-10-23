# O5b — places, the follow-up: the hospital, the board in the hall, the rooms told apart, the first open

Branch `ow/O5b-places`, port 5375, `high`. A follow-up of lane O5 (read
`docs/reports/O5.md`, its critic `O5_CRITIC.md` and its Left first), on
main as it is after O5 and O7 merged (`docs/reports/O7.md`, `docs/seams/NIGHT.md`:
`game.things`, `game.money`, the `hospital` beat, the stand-in police
`police.lost`, the `station` beat; `docs/THINGS_TO_DO.md` §5 the bounty, §7
the hospital). The user's words:

- **[must]** "buildings to enter and things to do."
- **[must]** "Keep it very much this same aesthetic": every room a panel of the reference's artist (a pool of light, the black, the few strokes; `DESIGN.md`).
- **[must]** "everything works": what looks usable is usable, and the answer is the honest one; a door never opens on nothing; nothing passes through anything; the first open of a door is one frame like the second.
- **[must]** Nothing copy-paste (OPEN_WORLD.md): the dozen rooms differ in something a player sees; a diner is not a bar with a hatch.
- **[must]** "This city should really react to player interaction (like a dynamic police system), fun shootouts, brawls, etc. Keep the scope manageable but it should feel fun." (OPEN_WORLD.md: the city answers everything the player does, within seconds, visibly.)
- **[must]** "Think GTA but noir. Make sure the player has freedom to cause havoc and do what they want in this open world, one that reacts to them." (OPEN_WORLD.md: no invisible hand says no, never a scripted stop or a locked verb; the only answer is the city's own, and a scene broken on purpose still ends somewhere sane.)

## 1. The hospital (a building with a door)
O7's `hospital` beat wakes a fallen man by his car; O3's arrest wakes him at
the station. Give the city its hospital: a street door of its own (a lit
globe over it, `EMERGENCY` in the kit's lettering, an ambulance at the
kerb that is a thing), a hall with the desk and a nurse, a ward of beds
under one pendant with a man asleep in one, a corridor out. A fall anywhere
in the city that no place claims goes to black, `'Came round.'`, and wakes
in a ward bed with the money docked (THINGS_TO_DO §7: the price, the gun
kept, the heat clear), the car where it was; the `hospital` beat now means
this room (`city.js [O7]` reads the place: keep its name, change its
meaning; O7's plays `o7/bounty_*` wake there). Walk out by the door. The
nurse answers a fist like O5's people. A bed is a sleep too (the hotel's
rule: the save written, `'Slept. Saved.'`, the clock moved), for a man with
no room.

## 2. The board in the hall, the station's desk
O7's bounty posters hang outside HQ's door; O5's hall has a blank board.
One board: the posters on the hall's sheets (O7's `src/night/bounty.js`
reads and writes it: the WANTED card, `PAID`, the `DEAD $` line), the
outside one gone, the sergeant's desk the place a man is taken in (E with
the wanted man at hand: `'Book him.'`, the reward through `game.money`,
`game.things.end`). The cells' doors answer E (the cold play's rule: a
door never opens on nothing: a cell is a bench and a bucket).

## 3. The rooms told apart (the look)
From the art director's look at O5's frames: the diner's back wall is the
bar's bottle shelf (`diner.js` imports `backBar`): a diner's is a pie
case lit from inside, two urns, the price board lit, a pass with the
cook's hands; the Orpheum's lit frames hold "a poster's dark shape" and
read as empty: a face and a title in each (O7's poster faces,
`src/night/bounty.js`, are the kit); the gym's and the warehouse's walls
are flat grey washes: a stroke of their own (the gym's fight cards and
a chalk board of the night's bouts, the warehouse's stencilled crates and
a hanging chain); the hall's and the hotel's rooms as they are. Every
room is the one recipe (a dark box, pendants with cones, one lit white
element): give three a second stroke a player remembers (the bar's
piano played by someone at eleven, the Orpheum's chandelier, the market's
hanging lamps swinging in the door's draught).

## 4. The first open, the store's nav, the small things
O5's critic measured the first E at a place's door at 135-149 ms and the
merge check at 111 ms at the Docks bar (the big room): the first open is
one frame like the second (`renderer.compileAsync` of the room's meshes
and its lamps at load, as O5 named; prove with `o5_door_hitch.json` at the
Docks bar, the hall and the hotel, first opens all under 50 ms on a loaded
machine). The pier office store: the men's nav does not route under the
stairs' landing (O5 Left 2: check Covers' grid against the landing floor).
The bar's E reach (critic's minor 10). The tour's two stand points (the
jukebox, the cell bench) reachable, the tour passing whole. O7's two
matchbook collections are O7's; do not touch them.

## 5. Proofs and gate
Plays: the hospital (a fall in the street by a bot that stands in the
open at heat 2: black, `'Came round.'`, the ward, the money docked, out by
the door, the car where it was; and O7's `o7/bounty_idle.json` waking
there); the board (a wanted man taken in at the desk: `'Book him.'`, the
reward, the poster `PAID` on the hall's sheet, the outside board gone);
the door hitch at three big rooms; the pier office store (its three men
come through the opening); `o5_tour.json` whole; O5's and O7's plays
that touch the places still passing (`o5_hotel`, `o5_station`, `o5_bar`,
`o5_havoc`, `o7/save`, `o7/autosave`, `o7/bounty_medium`). Golden: game
one's 40 and the city's 14 identical (the diner's and the Orpheum's frames
are not in the set: add `o5b_diner` and `o5b_orpheum` and `o5b_ward`,
looked at against the reference, each named). Errors clean at every place
and the hospital, station and wake beats. The fps at the hospital's door
against `shot=perf`. Report `docs/reports/O5b.md` (what changed, each
play, the look at the three new frames, Left). Hours, not days.

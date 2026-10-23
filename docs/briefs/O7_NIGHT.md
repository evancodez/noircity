# O7 — the night: HUD, map, saves, radio, title, pad, polish, the whole-game hunt

Branch `ow/O7-night`, port 5377. The last lane, after O1 to O6 are
merged: read every `docs/reports/O<n>.md` and its `Left` (they are yours
now), `docs/seams/WORLD.md` and `SMASH.md`. The pattern is game two's
whole lane (`docs/story/briefs/G8_WHOLE.md`, `docs/story/reports/game-two/G8.md`)
and the hunts (`tools/hunts/*.mjs`, `tools/hunt.mjs`, `tools/lib/whole.py`,
`tools/fpstable.mjs`). The user's words:

- **[must]** "a full open world game": it plays from the title through
  an hour of a night with no seam that breaks, no save that strands, no
  system that does not know the others.
- **[must]** "No story mode or outright missions yet": nothing lists
  what to do; the city shows it.
- **[must]** "Keep it very much this same aesthetic": the HUD, the map,
  the title and the cards in the game's own ink and lettering.
- **[must]** The three bars (GAME_TWO §1) over the whole: smooth
  everywhere, the middle everywhere (the line is the player's own
  situation), everything works.
- **[must]** "This city should really react to player interaction (like a dynamic police system), fun shootouts, brawls, etc. Keep the scope manageable but it should feel fun." (OPEN_WORLD.md: the city answers everything the player does, within seconds, visibly.)
- **[must]** "Focus on making everything come together as a cohesive open world. Once you have the basics down, don't make it cluttered or overly convoluted, but add nice attention to detail and cool stuff." (The user, 2026-10-23.) One city where every system meets every other; one HUD language; a thing is on the screen because a player will notice it, and off it if he would not.
- **[must]** "Probably add a mini map in the bottom left corner too or something." (The user, after his first drive, 2026-10-23.) An inked minimap bottom left: the streets within about 150 m, heading up, my mark, the cops' marks when they are close, the thing I have taken up (a fare, a bout) as a mark; a torn-paper patch in the game's ink, small, hidden on the title and under stills; M still opens the full map.
- **[must]** "Think GTA but noir. Make sure the player has freedom to cause havoc and do what they want in this open world, one that reacts to them." (OPEN_WORLD.md: the player may do anything the systems allow and the city answers everything he does, visibly, within seconds; no invisible hand says no, never a scripted stop or a locked verb; the only answer is the city's own, and a scene broken on purpose still ends somewhere sane.)

Read `docs/THINGS_TO_DO.md` first: the design of every thing to do (how
each is found, played and answered by the city; the seams `things.start`
/ `things.end`, `news.say`, `money.add` / `money.take`): it binds.

What you build on: the HUD (`src/ui/Hud.js`, `kit.js`, `inkArt.js`,
`lettering.js`: the title, the pause card and its settings line, the
objective, the cards), the saves (`src/game/Save.js`), the music
(`src/audio/Music.js`: the slots and the diegetic speaker), the sound
(`src/audio/Sfx.js`), the pad (`src/input/Pad.js`, `?padfake=1`), O1's
map (`src/world/map.js`), O3's `police.heat` and its event, O4's
`save.money`, O5's matchbooks and the hotel's save, O2's garage.

## 1. The HUD (`src/night/hud.js` on `Hud.js`)
- **The heat** as badges top right, 0 to 5, drawn in ink (a badge
  brushed in as it rises, struck out as it falls; the search state a
  badge half-tone); the stand-in row of O3 replaced.
- **The money** `$` bottom right in the typewriter face, only when it
  changes (it comes, it settles, it goes) and on Tab.
- **Tab** held: the heat, the money, the car's state, the hour, for a
  moment, and nothing else.
- **The objective line** only when a thing to do is taken up (a fare,
  a race, a bout, a hideout entered, the heat: `Lose them.`), and gone
  when it is done: an open world's line is the player's situation,
  never an order. Every line in the game audited (a table in the
  report: where it comes, where it goes).
- The kit's cards once per save: the table of every card id, where it
  is first taught (the first E at a car, the first punch, the first
  shot, the first crouch, the first dodge, M for the map), its nudge
  rule, and the fails whose black names it. At most a dozen cards in
  the whole game; none in danger; none twice; no key as text.

## 2. The map and the pause (`src/night/map.js`)
**M** opens O1's inked city map on the pause card (the frame dims; the
map with the district names in the game's lettering, north up, the
player's mark, the heat's badge, the hotel and the garage marked once
found, nothing else at first; a second M or ESC closes it). The pause
card: `PAUSED`, the keys (the rulebook with the open world's additions),
the settings line (mouse, volume, subtitles; the old M for sound moves
here), the matchbooks collected (a row of little covers), `click to
resume`. The pad's menu mapping covers it.

## 3. Saves (`src/night/save.js` on `Save.js`)
The open world's save, v3: where I am (the position and the yaw, the
car and its state if I am in one, the hour), the heat, the money, the
garage's cars, the matchbooks, the cards taught, the places found;
written at the hotel's bed (O5) and as a **quiet autosave** when I get
into a car with the heat at 0 (never under fire, never mid-brawl: the
rule written). CONTINUE on the title puts me there with the world as it
was (the traffic and the people drawn afresh: the city is never the same
film). BEGIN starts the night at the kerb. No CHAPTERS. A v2 save is
dropped quietly.

## 4. The title, the radio and the city's sound
- **The title**: the rename is done on `main` (2bf5989, marked `[AD]`:
  `index.html` and the title card say `NOIR CITY`, BEGIN drops into the
  city when no `?start=` is given (`src/main.js` startAt), CHAPTERS is
  hidden, the title's golden frame re-accepted). Yours: the title's own
  backdrop (today it is still the old diner street: make it the live
  city from the start's kerb in the rain, the lettering over it, the red
  splatter accent; re-accept the title frame once, named), and what
  CONTINUE means: a save of the old story (v2, a chapter id) must never
  continue into the old chapters; it is dropped quietly and the title
  offers BEGIN alone; CONTINUE appears only for a v3 city save.
- **The radio** (`src/night/radio.js` on `Music.js`): in a car, the
  slots are stations (`public/music/<station>.(mp3|ogg|m4a)`: the user
  drops real jazz in; silent until then, with a needle hiss and the
  dial's click): a key the rulebook allows (Q is the horn: use the
  pause card's line or F while driving; say which in the report), the
  station's sound from the dashboard's speaker (the diegetic filter),
  fading as I get out and gone with the door.
- **The city's sound**: the rain's rise and fall, the el passing
  overhead, a distant siren, a ship's horn from the river, a bell from
  the Hill, the market's voices, the gasworks' hum: each placed by the
  district and heard at the right distance, never on top of the game's
  own sounds.

## 5. Things to do, tied (every lane added its own)
- **The el**: a seat on a station platform (E boards the next train; the
  ride round the loop with the view; E at any station gets off).
- **The bounty board** at the police station (O5's board): three names
  a night with a photo (three of O3's gang men, somewhere in their
  turf, marked by nothing but the photo's face and the district named
  under it); found and taken down (a fight, or a shot), `$` at the desk.
  Not a mission list: nothing says go, nothing counts.
- **The phone box**: E in a call box with `$`: a car brought to the
  kerb beside it in a minute (O2's car at a point).
- **The matchbooks** on the pause card; **the theatre's reel** (O5);
  **the fares**, **the race**, **the gym**, **the hideouts** (theirs):
  each checked by you in play, each with its line coming and going
  right.

## 6. The whole-game hunt and polish
- The whole play: twenty minutes of a night by real input, twice (the
  good hands, the medium hands): drive every district, hijack, a fare,
  a race, a bout, a shootout at a hideout, heat to 3 and lost, the
  hotel's save, CONTINUE, the el, the map; every seam between systems
  (a hijack into a fight into the heat into the chase into an interior
  into the search) with no break.
- **The havoc play** (the user's freedom, by real input): run people
  down, steal the police car from under the cop, start a gang war at the
  border, ram the tram, shoot every lamp on Grand Avenue, drive off the
  pier, sleep at the hotel at heat 5, hijack a hearse: the city answers
  each within seconds, visibly, with its own means; nothing says no; every
  scene broken on purpose ends sane (the hospital, the station, the quay).
  Any place the game says no with a locked verb or a scripted stop is a
  blocker to fix with that system's owner's levers, marked `[O7]`.
- The hunts on the city: ten retries at the hospital and the station
  (nothing piles up: GPU geometries, listeners, timers), the edges of
  every district and the river (nothing unfinished, nothing invisible),
  the bodies, the cars, the doors; `drive_abuse`, `pile`, `edges`,
  `brawl` brought to the city. Errors clean everywhere (`?start=city`
  at every landmark, inside every building, at every heat).
- The fps table at the five busiest spots (the avenue at speed, the
  market, a heat 4 chase, the hideout fight, the race) against
  `shot=perf`, with each lane's number before and yours after; memory
  flat after thirty minutes.
- The look, once over the whole: one frame per district and per room
  against the reference (pools and ink, paper white 5 to 8 %, no grey);
  the golden manifest of the city brought to its final set.
- The pad through everything (`?padfake=1`): the drive, the hijack, the
  brawl, the guns, the map, the pause, the title.

## 7. The documents and the gate
`README.md` (how to play NOIR CITY by hand: the keys, what the city
offers, how to see each thing; NOIR EXTREME's game at its own port),
`docs/OPEN_WORLD.md` §7 "As built" (the systems, the seams, the budgets,
the parked base scenes and what O7 decided is dead), `docs/seams/`
consistent with the code. Build; golden identical or every change named
and shown; the whole play twice; the saves; the pad; the fps table;
errors; the report `docs/reports/O7.md` with "What the user should
feel", "Found and fixed", "The middle, audited", "Left". Edits to shared
files marked `// [O7]`. Hours, not days.

## From the cold play of the merged city (`docs/reports/CITY_COLD_PLAY.md`): yours
Yours, in your fix pass: **finding 2**, the title's key line promises
verbs the city does not have yet and lists M twice: one line per device
(keys, pad) that is true of the city as built, kept true as lanes merge.
And its section 2 (what is good and must not be lost) is a list your
whole-game check keeps.

## From lane O4's merge (`docs/reports/O4.md`, "For other lanes"): yours
O4 is in main (5e83e76). The weapon wheel is `arms(G).next(dir)`; in a
fist fight `crowd.draw(gun)` ends the fight. The pad has no wheel in play
(L1 and R1 are Shift and F), so a pad player cannot draw a gun in a fight:
map it. The pad needs an aim help in a gunfight (the pad's medium hands
lost the street three of three and the 1v2 at the merge check): a soft
snap toward the nearest man in the reticle's cone while aiming on the
stick, in `src/input/Pad.js`, measured by `tools/plays/o4/pad_street.json`
and `pad_1v2.json` passing by medium hands. Take these at your fix pass.

## From lane O5's merge (2026-10-23, main 407278b): yours
O5 (the places) is in main: fifteen street doors open on rooms (`src/places/`,
`docs/reports/O5.md`). Yours in this pass or your fix pass:
- **One matchbook collection.** O1b put a matchbook on every bar's step
  (`src/world/items.js`: `save.flags.matchbooks`, "n of 6" on Tab) and O5 put
  one on the counter inside each of its two bars (`src/places/rooms/bar.js`:
  `save.matchbooks`). Two collections of the same thing is the clutter the
  user warned of. Make it one: six matchbooks, one a bar; at the two bars with
  rooms it is the one inside (O5's, on the counter: a reason to go in), and
  the step's is gone; one save field (`save.matchbooks`, the ids; migrate the
  flags map), one count on Tab, one row on the pause card.
- **One press, one answer at a door.** At the Docks bar's door the prompt
  reads `E  take` (O1b's item on the step) and the press opens the door
  (O5's). Whatever the eye is on gets the prompt and the press: the door when
  looking at the door, the item when looking at the item; never two answers
  to one press.
- **The wheel** on foot (city.js [O5]: the mouse wheel through what I own) has
  no teach card and no pad mapping: give it both, in the kit's language.
- **The night's kit at BEGIN.** OPEN_WORLD's revolver under his arm and
  O4's night kit ($150 and the revolver, `nightKit`) are never given in the
  city: BEGIN gives them once, quietly; CONTINUE keeps what the save holds.
- **Where a fall wakes.** A fall inside a place wakes where the place says
  (outside its door, by the ring, the cell bench); a fall anywhere else in the
  city has nowhere to wake but the city's beats. O4's rule is
  `fall.wake('hospital')`: give the city a hospital's waking (a bed, the
  black, 'Came round.', the money docked), with O3's station wake for an
  arrest.
- **The stills' footer** writes keys as words (`CLICK: NEXT · ESC ESC: SKIP`)
  outside O5's reel; the kit's key caps everywhere.

## From lane O3's merge (2026-10-23, main 768adb5): yours (second pass)
O3's police are in: `game.police` (heat, searching, units, marks(),
on('heat'), set, lost, clear); your stand-in (`src/night/standins.js`,
`patrol.js`) is installed only while it is absent: drop it. The title's
and the pause card's key line says `RMB steady, other fist`; in the street
RMB draws the gun you own and steadies it, in a fist fight it is the other
fist: say `RMB draw / steady, other fist` (game one's title golden frame
changes once, named). From the art director's look at your frames: the
minimap's district label rotates with the heading-up map and reads
mirrored (frame 2); labels stay upright. The el ride's right third is a
flat white panel (the car's own window): the window's frame and the dark
of the car instead. The title's colour measured (the splash, the blue
sign, the red lanterns together under 2 %).

## From the merge check of O7 with O3 (2026-10-23, main 768adb5): yours (second pass)
On main with O3's police, your plays written against the stand-in fail on
their timings: `o7_hud` (two shields within 2 s of a shot), `o7_gun` and
`o7_havoc` (heat 2 and 'Lose them.' within 1.5 s), `o7/heat_idle` and
`o7/heat_lose` (`G.police.units` of length 1 within 12 s), `o7_save`
(an autosave blocked by heat). O3's police answer a shot through who
hears it: a cop within 80 m whistles and the heat is at once; with
nobody near, a witness runs to a box and the heat comes in ten to forty
seconds; a crime nobody sees raises none. Bring the plays to that (a
shot staged with a cop in earshot for the instant answer, and one with
none for the witness's), read units through O3's `units` or `marks()`,
and make the HUD show the city's answer the moment it exists (the whistle
heard, the shields brushed in when the heat moves). The manager removed
O3's RMB draw on main (the wheel draws; O3's card says the fist only):
one card for the revolver, yours.

## From the user's first play of the systems (2026-10-23, main 43df2f8): the rule your hunt judges by
"Make the city feel more alive and less canned and stiff." The rule is in
docs/OPEN_WORLD.md ('alive, not canned, not stiff': the near street never
empty, events on their own, every NPC with a readable state and human
delays, no reaction without a cause he saw and none that outlives its
cause). Your second pass's whole-game hunt (§6) judges by it above the
rest: the alive test at three corners (a minute standing still: what
happens?), the read test (name each man's state from a strip), the
nonsense list (every reaction without a cause, every one that outlives
it), each counted in your report. Lane O9 (docs/briefs/O9_ALIVE.md) builds
the life; your hunt finds what it missed.

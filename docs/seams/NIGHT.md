# NOIR CITY seams: the night (lane O7)

What ties the systems into one game: the HUD, the minimap, the map and the
pause card, the saves, the radio and the city's sound, the title, and the
things to do that are no other lane's (the el, the phone box, the bounty
board). The code is `src/night/` (one module each), made by `main.js` as
`game.night`. Every lane reads this before it puts anything on the screen.

---------------------------------------------------------------------------
## 1. The HUD: one language (`src/night/hud.js`)

One HUD, in the HUD's own ink (`src/ui/Hud.js`, `kit.js`): the typewriter
face for numbers and lines, the hand lettering for names, torn brush strokes,
paper on ink. A thing is on the screen only while a player would notice it.

| where | what | when |
| --- | --- | --- |
| top left | the line (`hud.objective`) | the player's situation: the heat's line over a thing taken up |
| top right | the heat: 0-5 police shields | only with heat (and on Tab); brushed in rising, struck falling, half-tone searching |
| top right, under | Tab's lines: the car's state, the hour | Tab held (the pad: the touchpad) |
| bottom left | the minimap (§2) | in the city, in play |
| bottom right | the money `$` | when it changes (it comes, the sum counts, it goes) and on Tab |
| bottom right | the ammo (the base's) | a gun out; the money sits above it then |
| bottom right | the radio's dial, `saved` | a moment each |
| centre low | the prompt, the teach card, the warning (the kit's) | as Z.md |

**The line.** `hud.objective(text)` from any lane, in the city, is the line
of the thing taken up (a fare's `The Hill.`, a bout's, the phone's `A car is
coming.`); the night keeps it and shows the heat's line over it while there
is heat (`Lose them.`, `Stay out of sight.` while they search, `Clear.` for a
moment as it goes), then gives it back. Call it with `null` when the thing is
done. `night.take(id, text | null)` is the same with an owner (several
things at once: the last taken shows). Never an order, never a list.
**Do not** write `HEAT 2` as a line: the shields say it.

**Cards** (`hud.teach`, once a save): the night's are `night_tab` (`[TAB]
heat and money`, the first time money comes or the heat clears, in a quiet
second) and `night_radio` (`[F] the radio`, after 30 s at the wheel with no
heat). The table of every card is in `docs/reports/O7.md`.

## 2. The minimap and the map (`src/night/minimap.js`, `map.js`)

- The minimap: a torn patch of O1's inked map (`drawMap(C, 2048)`, drawn once:
  `night.cityMap()`), bottom left, heading up, about 150 m round me; my mark
  in the middle; my car when I am out of it; the cops' marks when they are
  close; the thing taken up (`night.target = { x, z }`) as a ring, or a tick
  at the edge when it is further. The health bar (a fight) moves above it.
- **Marks from a lane**: `game.police.units` (or `police.marks()`) ->
  `[{ x, z } | { pos }]` are drawn as cops; `night.addMarks(fn)` with
  `fn() -> [{ x, z, kind: 'cop' | 'place' | 'target' }]` for anything else
  that a player must see on it (sparingly).
- **M** (the pad's d-pad down) opens the map on the pause card: the frame
  dims and the game is held (`night.holding`), north up, the districts
  lettered, me, my car, the heat's shields, the places found (the hotel, the
  garage, the station, the gym, the gun shop, the diner, the bars: marked
  once I have been within 40 m of their door, `save.found`), the target's
  ring. M again or ESC closes it. city.js's own M is handed this map (its
  `R.map`): the free roam's code is unchanged.
- **The pause card** (ESC): PAUSED, the same map at its side, the keys, the
  settings line (mouse, volume, sound on / off - the old M -, subtitles; the
  pad's stick and rumble), the matchbooks (`save.matchbooks`: one cover per
  bar, the missing ones dotted), `click to resume`.

## 3. Saves (`src/game/Save.js` v3, `src/night/save.js`)

`localStorage['noir.save'] = { v: 3, scene: 'city', beat: 'roam', at, flags,
inventory, money, heat, matchbooks, garage, found, bounty, city: { pos: { x,
z, yaw }, car: { kind, x, z, yaw, damage } | null, inCar, hour } }`.

- `game.save.money` (a setter: every change emits `money` `{ money, was, d }`
  and the HUD shows it), `save.heat`, `save.matchbooks` (push an id),
  `save.garage` (O2's records, kept as given), `save.found` (`{ placeId: true }`),
  `save.bounty`.
- **Written** only by `save.write()` in the city: O5's hotel bed calls it as
  the game has it (the place record comes from `night.snapshot()`); the
  night's quiet autosave on `city:in` (a car got into) when the heat is 0, no
  hit in 8 s, no warning, no brawl, no director's fight, not in the first 6 s
  of the night, at most every 20 s (`night.saver.blocked()` says why not). A
  small `saved` bottom right. The scene manager's writes (a scene or beat
  entered) are no longer saves (`write({ scene: true })` is ignored); an old
  chapter is never written.
- **CONTINUE** (only for a v3 city save; a v2 save is dropped quietly):
  `Game.start(save)` -> `save.load(d)` (money, heat, collections) and the
  flags; `night:start` `{ from }`; city.js's roam setup calls
  `night.takeResume()` -> the car (its kind and damage) where it stood, me in
  its seat or where I stood; the hour. The traffic and the people are drawn
  afresh. **O2**: a car kind of yours must be spawnable by `vehicles.spawn(kind)`
  for a save to bring it back (today: coupe, sedan, truck).
- **BEGIN** starts a new night at the kerb: `save.load(null)`.

## 4. The title, the radio, the city's sound

- The title (`src/night/title.js`): the city's stage entered at load, the
  start's coupe at the kerb, the camera a few strides back from the start's
  anchor breathing over a minute (`game.titleCam`); `shot=title` renders it.
- The radio (`src/night/radio.js`): F in a car (the pad: the d-pad's right;
  Q stays the horn) turns the dial: off, WJZZ 1170, KBLU 880, WBND 1450.
  `public/music/<wjzz|kblu|wbnd>.(mp3|ogg|m4a)`: the user's records; until
  then the needle's hiss and the carrier's hum. The dashboard's speaker (a
  band-pass on a panner riding the dash); fades out with the door; a car
  keeps its station (`car.radio`).
- The city's sound (`src/night/ambience.js`; the sounds in
  `src/audio/sounds/night.js`): the gasworks' hum, the river's lap at the
  quay, the markets' voices, a ship's horn, the Hill's bell on the hour, a
  far siren at no heat. Nothing new starts while there is heat, a fight, a
  warning or a fail.

## 5. Things to do (the night's own)

- **The el** (`src/night/el.js`): `E  take the el` at the foot of a
  station's stair; up front in the first car (the 'hold' mode), the train
  pulls in at each station for 7 s (`E  get off`: at that stair's foot).
  Events `el:board`, `el:stop`, `el:off`.
- **The phone box** (`src/night/phone.js`): `E  call for a car  $50` at a call
  box: `A car is coming.`, about 35 s later a coupe at the kerb by the box out
  of my sight (`Your car.`, its ring): it becomes `game.city.car`. **O2**: put
  your car-at-a-point here (`phone:call` `{ box }`, `phone:car` `{ car, bay }`).
- **The bounty board** (`src/night/bounty.js`) by the police headquarters'
  door: three names a night (seeded, kept in the save), each a photo, a
  district, a reward; the man stands on a corner of his turf (spawned within
  110 m: a figure of the base's cast with no brain, `h.bountyId`); taken down,
  his poster is crossed and E at the board pays. **O3**: give the three to
  your gang men (`night.bounty.names()` -> `[{ id, name, turf, x, z, seed,
  state }]`; set `state = 'down'` when yours goes down, or keep `h.bountyId`
  on the man so the night sees him fall); **O5**: the board inside the
  station with the desk.

## 5a. Things to do, any lane's: `game.things` and `game.money` (`src/night/things.js`)

The seams of `docs/THINGS_TO_DO.md`. A thing is only ever started by its
own place when the player walks up to it (nothing lists, nothing says go).

```js
G.things.start(id, { line, at })   // taken up: the line (under the heat's), the mark
                                   // (at: { x, z } or () => { x, z }: the minimap's ring, the map's)
G.things.line(id, text)            // the line changed (a lap, the place)
G.things.end(id, { result, money, news, weight, where })
                                   // put down: the line and the mark gone; money +/- through
                                   // O4's wallet (the HUD counts it in); O1b's news.say;
                                   // the night's record save.flags.night[id] = { result, hour }
G.things.done(id)                  // that record or null (a cleared hideout stays cleared)
G.things.active                    // Map id -> opts
G.money.add(n, why)  G.money.take(n, why) -> bool  G.money.n   // O4's earn / pay
```
The phone's car and the bounty's pay use them. Events `things:start`,
`things:end`.

## 5b. The revolver under the coat (`src/scenes/city.js`, marked `[O7]`)

A new night in the city (BEGIN) gives `save.inventory` the revolver and
`save.ammo` `{ revolver: 12, revolverIn: 6 }` (OPEN_WORLD §1). On foot the
mouse wheel (the pad's d-pad left / right, a notch a press) turns O4's
`arms(G).next` (fists, then what I own): drawn, the controller's gun mode;
put away, the walk. Getting into a car or into the river puts it away. The
card `city_gun` (`[WHEEL] the revolver`) once, on foot, in a quiet second.
`city:arms` `{ gun }` on each change. In a fist fight O4's crowd takes the
wheel (`Crowd.draw`).

## 5c. The pad's aim help (`src/input/Pad.js`, `PAD.aim`)

L2 raised with a gun, by the pad: the man nearest the sight within
`cone` rad (or `width` m of his chest at his distance), with a clear line,
is eased toward: `snap` of the way on the raise, then `rate` of what is
left a second (at most `max` rad/s); a stick pushed past `stick` away from
him is never pulled. `pad.aimed` / `pad.aimedHood` name him (the tools).

## 6. The stand-ins (until the lane merges; `src/night/standins.js`)

Installed only when the real seam is absent; dropped at O7's fix pass.

| seam | owner | the stand-in |
| --- | --- | --- |
| `game.police` `{ heat, searching, units, seen, on('heat', fn), set(level), lost(), clear() }` | O3 | [O7 after the critic] somebody comes (`src/night/patrol.js`): heat 1 a beat cop (O4's `o4_cop`, the fist fight, 'Hands up.', the station), heat 2+ the siren then O4's police gunmen (the gun kit in the street; 3 at heat 3+); the quiet clock (14 s: the search; 9 s: a shield less) runs only while none of them sees me (42 m, no building between, not inside a place); `lost()` (a room after 20 s, the el's next station) begins the search, it never clears the heat; `clear()` the hotel's sleep, the arrest, the hospital. `units: [{ pos, kind }]` are the cop marks |
| `game.crime.emit(kind, point, by)` | O3 | raises the stand-in's heat to the kind's level (punch 1, hijack 1, shot 2, death 3, cop 4); until O3's witnesses a shot in the city (`shot`), O4's crowd's `crime` (a gun drawn on a cop: 2; a man shot running: 3; a cop: 4) and O5's rooms' `crime` (level 1: punch, 2: shot) raise it too |
| the street's gun fight | O7 | `kitUse(night, owner, cfg)` / `kitFree(night, owner)` (`src/night/patrol.js`): one gun kit encounter in the street shared by the police and the wanted man; a place's own (a hideout) is never taken over |
| `game.news` | O1b | merged: O1b's own (`world/items.js` `newsOf`), no stand-in |
| `save.money`, `save.matchbooks`, `save.garage` | O4, O5, O2 | the save's own fields (no stand-in needed) |

The debug bed: `?nightbed=1` (never in a normal run): 1-5 the heat, 0 none,
9 the search, 8 $50, 7 a matchbook.

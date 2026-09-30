# B2 — Scenes 4 and 5: Room 304 (`office`) and The Door (`gunfight`)

Read `docs/story/WAVE_B.md` first: it is the standard and the way of
working. These two scenes share one room and are yours end to end. Branch
`wave-b/B2-office`, dev port 5312. Music slot `office` (stop it when the
shadows come; the gunfight has no music, only the room).

## The place: a new stage, `office`
The Harbor Building, third floor, night.
- **The corridor**: eight metres of it. Linoleum, a dado rail, three doors
  with frosted glass and gilt names, one ceiling lamp with its pool, the
  lift's cage dark at the end. The third door: **AMES, BOOKKEEPING**, ajar,
  the lock splintered.
- **Room 304**, about 5.5 x 7 m, turned over once already: a desk with a
  banker's lamp (the one pool of light: the blotter, the pad), the swivel
  chair on its side, filing cabinets with the drawers pulled, paper over
  the floor, a coat stand, a water cooler, a radiator, a ceiling fan
  turning slowly, a framed picture hanging a little crooked (the safe is
  behind it), a transom over the door.
- **The street window**: venetian blinds. The street lamp and a blue neon
  sign outside (accent `neon`, flickering: HOTEL) throw the slats' shadows
  across the room and across me. This is the oldest picture in noir: make
  it the room's look (a real shadow-casting light through real slats; the
  lamp pool gives three shadow lights). Beyond the glass: rain, the
  building opposite with a few lit windows, a lamp post with its cone in
  the rain.
- **The second window**, on the side wall: a sash half open onto the fire
  escape, a curtain moving.
- Anchors other lanes rely on: `office.window.street` (where I stand to
  look out through the blinds), `office.street.watcher` (on the far
  pavement under that lamp post: where lane B4 stands its man; it must be
  clearly visible from the window), `office.window.escape` (in front of
  the fire-escape window). Also `office.corridor.start`, `office.door`,
  `office.desk`, `office.safe`.
- The Hoods need a nav grid and cover in this stage (see `seams/Y.md`).
- Look: interior (no screen rain, thin haze in the lamp's cone, room tone:
  rain on glass, the fan, the building's hum, the neon's buzz).

## Scene 4, Room 304 — beats
1. `corridor` — I come out of the dark end toward the lit door. It swings
   in at a touch (my hand on it).
2. `room` — I look the room over. What can be used shows itself by how it
   sits in the light: the pad on the blotter with a pencil beside it, the
   crooked picture. Two or three other things answer **E** with one short
   line or none (the open drawers: "Somebody was here first."), so the
   room is a room and not a hallway to two puzzles.
3. `pad` — **Puzzle D.** The top sheet is gone. **E** takes the pencil; I
   rub its side across the next sheet (hold the button and scrub: the
   graphite builds where I rub, my hand and the pencil in the frame doing
   it); what was written above comes up white: three numbers. The rubbing
   must feel like rubbing: it builds with each pass, it is uneven like a
   hand's. When enough of the numbers shows, a beat, and the sheet is
   torn off into my left hand.
4. `safe` — **E** swings the picture aside on its wire: a wall safe.
   **Puzzle E.** I turn the dial by the mouse (my fingers on it). Right
   to the first number, left to the second, right to the third. By feel:
   at the right number the click is louder and lower, the dial twitches
   under my fingers and the view gives the smallest kick. The numbers
   from the pad are on the sheet in my left hand at the edge of the frame
   (no memorising; a player who ignores them can still find it by ear).
   Overshooting costs a little, never everything. The handle, the door's
   weight. Inside: the ledger, its cover red (crew).
5. `ledger` — **E** take. Held up and opened (Inspect): columns, sums, a
   small black bird stamped by the big ones. It goes inside my coat.

## Scene 5, The Door — beats
1. `shadows` — A board creaks in the corridor. A shadow on the frosted
   glass, then a second. The music is gone. My hand goes into my coat and
   comes out with the revolver (`weapons.equip('revolver')`; lane B3
   builds the real one behind that front: build on the plain one). One
   prompt: **E tip the desk** (it goes over with everything on it; the
   lamp falls and burns on from the floor, throwing the shadows up the
   walls; the desk is cover). The player may ignore it.
2. `door` — The door is kicked in. One Hood through it; one firing
   through the frosted glass, his outline on it before it goes (a player
   who shoots the outline is rewarded: he falls through it).
3. `window` — One at the fire-escape window with a Tommy gun: the curtain
   shreds, the wall behind me is stitched. Then two more down the corridor,
   one of them a heavy. Six men in all, about a minute to ninety seconds.
4. `quiet` — The last one falls. Smoke in the lamp's light, paper coming
   down, the fan ticking round with a bent blade. Three seconds of it,
   then `ctx.next()` (lane B4's scene opens in this room).

## What makes the gunfight premium
- The first shooter in this game felt right: the same Hoods, the same hit
  reactions, blood, impacts and sound. Use all of it; place the men with
  the director's options (`entry`, `post`, `leash`, `wake`: `seams/Y.md`).
- Six rounds: every shot is a decision, and the reload under fire is the
  tension. Tune their aim so a first-timer who uses cover lives and one
  who stands in the doorway does not. Dying is ten seconds: back at
  `shadows`.
- **The room comes apart**, and it is the player's bullets and theirs
  that do it: the frosted pane (the glass system), the desk lamp (shoot it
  and the room goes to the window's slats alone: darker for them too), the
  water cooler (it bursts and runs), cabinet drawers, the picture's glass,
  the blind slats (each bullet lets a new blade of light in), the fan,
  plaster, and paper in the air. Everything that breaks comes to rest.
- Nothing pops in. Men arrive through doors and windows by walking and
  climbing, seen or heard first.

## Play and proof
`tools/plays/office.json` (`?start=office`) and `gunfight.json`
(`?start=gunfight`) by real input, the gunfight by an aiming player at a
human's pace (it should win most runs, lose some). Strips: the pencil
rubbing, the dial at a right number, the door going in, the man through
the glass, a reload. Frames: the corridor, the room with the slats, the
pad, the open safe, the first shot's flash, the room wrecked.

# O5 — places: the cold player's report (critic)

Played cold on `ow/O5-places` at b6bb583 (port 5375, dev server, muted), by
real input through `tools/play.mjs` with my own plays
(`tools/plays/critic/o5/`), before reading `docs/reports/O5.md`. The machine
was loaded by three other lanes' headless runs all through (latencies below
are on that machine). Frames: `docs/review/O5/critic/` (six).

What I did: BEGIN from the title, the first frame, on foot to the Orpheum by
input (its door, the lobby, the box office, the house's double door, a seat,
the reel, up); the hotel from the start on foot (the door, the bell, the
lift up, the corridor's doors, room 3, the bed, the reload and CONTINUE);
the Tenements bar (every usable thing poked by `poke.mjs`: the piano, six
stools, the matchbook, the card table, then a fist at the barman, then the
drunks' fight); the gym's bout with my own hands (`c4_bot.mjs` profiles:
idle once, bad four bouts, medium four bouts, good two in a row); the
warehouse hideout (idle once, bad four tries, medium three, good at the
warehouse and then the pier office, and good again from the crate by the
door); the street door's latency, twice.

Not reached in the time box (named, not judged): the diner, the gun shop,
the garage, the market hall, the stairwells and the fire escape, the police
station's wake, driving into a place's doors, a body on a room's floor
under my feet, the pad play.

---------------------------------------------------------------------------
## Findings, most felt first

### 1. BLOCKER — stuck on a bar stool: E never gets me up
Sat at a stool in the Tenements bar (E), the bar top is in front of me, so
E is taken by `a whiskey: $2` / `drink` and never by `get up`; the kit's card
says `[E] get up` at the same moment (two lines that contradict each other:
frame `01_stool_stuck.jpg`). Pressed E three times: the barman pours, I drink,
he pours again (`The barman pours. One. On the house.` every time: not one,
unlimited, +15 health each). W held 1.2 s, S, SPACE: still seated. Looked
away 1.47 rad to either side: the prompt turns to `E  get up`, and E **still
does not stand me up** (`seat true`, mode `seated`, `G.interact.current` read
`drink` right after; `controller.modeT` read 1.10 s after 8 s seated, so
something sets the seated mode again). A first-timer is trapped on the stool
until he reloads. My poke of all six stools of the bar: sat on each, none
got up by E (`up: false`); the theatre's seat (no use in front of it) gets
up fine on the second E.
- Steps: `node tools/plays/critic/o5/stool_stuck.json` (bar1, stool16).
- Where: `src/places/Places.js` 459-465 (the seated E: only when nothing in
  reach takes it, and `modeT > 0.3`); `src/places/rooms/bar.js` 104-106 (the
  stool and its `seated` drink use), the same pattern in
  `src/places/rooms/diner.js` 75-77 (the counter's coffee and pie: not
  played, very likely the same trap).
- Fix as a player needs it: getting up must win over a seated use (a second
  key the rulebook has for "leave": S or SPACE, or E held, or the seated
  use only when looked down at the bar top); W or S stands me up; the
  barman's "One" is one (then `He waits.`).

### 2. BLOCKER — the gym's bout: good wins, everyone else can never win
Kid Shea (level 1, the slowed man): **idle** loses in 74 s, warned, each down
said (`Too slow.`, `Block his jab.`), out of the ring, nothing taken: right.
**Good** wins twice in a row (Kid Shea 0 downs, Big Lou 0 downs, +$25, +$60).
But **bad lost 4 of 4 and medium lost 4 of 4**, each time all four downs, and
medium never even dented him: his hit points at each of medium's downs were
49, 45, 40, 41 (of 52) in the first bout, 48 / 52 / 52 / 52 in the second, 49
/ 45 / 46 / 47 and 49 / 52 / 46 / 50 after. The blacks say why (`Into his
guard. Wait for an opening.` most times), so it is fair, but the bar of
GAME_TWO §1 B7 is medium through in one to three tries and clumsy by the
third or fourth: here it is a cliff between good and everyone else. The
owner's Left 2 knows medium; bad is also never through, which is worse.
- Steps: `node tools/plays/critic/o5/mkbout.mjs <idle|bad|medium|good> <n>`
  then the play it writes (`bout_*.json`; in by the street door, E at the
  man, `c4_bot.mjs`).
- Where: `src/places/bout.js` 16-24 (`HP`, `STYLE`: Kid Shea is the base's
  manners at 1.55 with +0.2 s openings; still too closed for a medium hand),
  `lesson: false` at 67 (a first-timer who has never fought gets no lesson
  in the ring: three teach cards came, in the middle of the first round).
- Also: the first bout costs nothing and loses nothing, so the gym has no
  stake; the brief's `bet` is not there.

### 3. BLOCKER — the hideouts: nobody but a bot that stands still has a fight, and the bot cannot win it
- **Warehouse, idle** (stand in the doorway): `They know your face.` then the
  fall 64 s later (`Shot standing in the open.`). Warned and lost, but a
  minute of standing in a doorway in their sight is not "dies in a few
  seconds" (WAVE_C §2).
- **Bad** 4 of 4 down (8 - 15 s each), **medium** 3 of 3 down (8 - 12 s),
  **good** down at the warehouse in 9 s (4 shots fired) and down again from
  the crate by the door (6 shots, 10 s). Not cleared once in 9 runs.
- **Hidden behind the crate by the door, crouched (C): the fight never
  starts.** The warning stays up, `hostile false`, the men stand at their
  marks 10 - 25 m away; I waited 6 s, nothing came (frame
  `04_warehouse_cover_stalemate.jpg`). A stalemate, not a fight: they only
  turn on me after 2.2 s with a line on me, or my shot.
- **The pier office, good hands: a stalemate.** It put 2 of 4 down, then for
  two minutes nobody in sight and nobody coming (`the gunfight ended in time`
  FAIL, `{"men": 2}`), standing at full health inside: the men upstairs and in
  the store never move.
- **The dead stay dead across falls** (`s.state.dead`: 0, 1, 2 dead by the
  third and fourth tries of bad and medium): attrition, not a retry "with the
  world as it was". It will let a player clear it by dying enough: a quiet
  win by repetition.
- **The fall sends me to Grand Avenue**, 330 m from the Docks, by the car
  that was moved there, the revolver still in my hand (frame
  `05_fall_back_at_grand_ave.jpg`): not the hospital (O4's fall is on main,
  not in this branch), not the start of the contest, and the way back is a
  drive across the city. Felt as "I lost and the game reset me".
- Where: `src/places/rooms/hideout.js` 177-187 (hostile only on 2.2 s seen or a
  shot: men who never hunt), 155 (`Kt.begin({ to: 'roam', ... })`), 157
  and 200 (`s.state.dead` kept across a fall), `K.men` 98 and 134.
- Fix as a player needs it: they come for me once warned (flank, push, the
  tommy gun's spray to move me); the fall goes somewhere near (O4's hospital,
  or the street outside the hideout with the men reset); a medium hand clears
  the warehouse in one to three tries from its cover.

### 4. MAJOR — the first E at a place's door is late
The Orpheum's street door, E to the first frame the leaf moves: **135 ms and
149 ms** the first time (two runs), **50 ms** the second time at the same
door. A hitch on the first open of every place (the owner saw 169 ms at the
Docks bar and called it the machine). It is the first open each time: the
room's first draw (programs, its group made visible) on that press. GAME_TWO
§1 A1: under 50 ms.
- Steps: `node tools/plays/critic/o5/door_latency.json`.
- Where: `src/places/Places.js` 336-342 (`open`; `L.K.group.visible` flips at
  457); warm the room's programs when it loads at 34 m, not when the door
  opens.

### 5. MAJOR — getting up from the theatre seat faces me into a wall; two "get up" lines at once
After the reel (the still: good), E up puts me in the aisle at
`standAt yaw: PI/2`, my face 0.8 m from the side wall: the whole screen a grey
wall, no idea which way is out. Sat, the screen shows `[E] GET UP` (the card)
and `E  GET UP` (the prompt) one above the other (frame `02_two_get_up.jpg`):
GAME_TWO §1 B6, never two cards at once.
- Where: `src/places/rooms/theatre.js` 73 (`standAt`), `src/places/Places.js`
  353 (the teach card while the prompt says the same).

### 6. MAJOR — the lobbies are grey mud, not panels of the reference
The Orpheum's lobby and the hotel's lobby read as one dull mid-grey: the
paper walls a uniform dark grey, the floors near black, no white at all
except a bulb, no pool that lands anywhere (frame
`03_theatre_lobby_murk.jpg`; the hotel's lobby, corridor and room the same
grey). DESIGN.md's panel is a pool of light, the black, a few strokes: the
city outside has it (the wet street, the hard whites), and the Tenements bar
has it (the lit shelves behind the bottles: frame 01 is a real panel), the
warehouse has it (one cone over the crates). The theatre and the hotel do
not. User ask 2 is met in the bar and the warehouse, not in the lobbies.
- Where: `src/places/rooms/theatre.js` 22 (`look: { ambient: 0.6, haze: 0.3 }`)
  and 37-41 (two globes, one 0.6 power), `src/places/rooms/hotel.js` 27 and
  44-46; the `paper` wall material. Fewer, harder lights, a white thing to
  silhouette against (the box office's lit window, the poster frames lit, the
  doors to the house edged in light), the rest black.

### 7. MAJOR — havoc in a place has no answer
In the bar I faced the barman and pressed LMB twice and RMB once: nothing
(the hands are empty in the city; no swing, no flinch, no crime). The
drunks' fight at the bar's end emits `crime 'brawl'` and nobody listens in
this branch (no heat, no police: O3 is not merged here). No gun outside a
hideout (the revolver appears only when the hideout's men see me). So in
this branch the places cannot be broken on purpose and nothing answers:
user asks 4 and 5 are not met here. Half of it is other lanes' (O3's heat,
O4's fists everywhere), but a room must take the fist when they land: the
barman, the clerk, the cashier, the usher must have an answer (a flinch, a
step back, a word, the crowd turning) the moment LMB lands.
- Where: `src/places/Places.js` 399 (`crime()` emitted, unheard here); every
  room's `K.fig` people are props with no hit answer.

### 8. MINOR — the prompt under the black
Sleeping at the hotel: the black, `SLEPT. SAVED.`, and under it `E  SLEEP`
still on screen through the whole black (frame
`06_prompt_under_the_black.jpg`). `src/places/rooms/hotel.js` 161-193: clear
the prompt while sleeping.

### 9. MINOR — the reel's footer is a key written as text
`CLICK: NEXT · ESC ESC: SKIP` under the still (the base's stills). E
dismissed it (good); the footer should draw the keys as caps or go.

### 10. MINOR — the bar's E reach is wide
Standing 1.6 m from the barman, looking at him, E offered `a whiskey: $2`
(the stool's seat beside me took me), so a fist at the barman became a seat:
two uses in one cone. Small, but it is how I sat down without meaning to.

### From the code, not seen in play (check them)
- **The fire escape is a 2.6 s cut with a turn at its end**:
  `src/places/rooms/stair.js` 140-151 glides the eye from the roof to the
  pavement in a straight line (through whatever iron is between), the
  controls locked 2.6 s (GAME_TWO §1 A2: 0.5 s for a context move), then
  `setPose(..., yaw + Math.PI, ...)` turns the view half round in one frame
  at the bottom: a camera pop.
- **The hideout's revolver comes from nowhere** (`hideout.js` 208-215,
  `Kt.arm('revolver')`): a stand-in, but after a fall I still held it in the
  street (frame 05), with no ammo count shown other than the cylinder.

---------------------------------------------------------------------------
## The four proofs (mine)

| contest | idle | bad | medium | good |
| --- | --- | --- | --- | --- |
| the gym's bout (Kid Shea, then Big Lou) | **loses**, warned, 74 s, the black says why | **0 of 4** won (4 downs each, ~60 s each) | **0 of 4** won (never below 40 of 52) | **won twice in a row** (0 downs each) |
| the warehouse | **loses**, warned (`They know your face.`), 64 s | **0 of 4** (8 - 15 s each) | **0 of 3** (8 - 12 s each) | **0 of 2** (9 s in the open; 10 s from the crate) |
| the pier office | not run | not run | not run | **stalemate**: 2 of 4 down, then nobody for 2 min |

A contest good play cannot win is a blocker (the hideouts). A contest only
good play can win is a blocker by the middle bar (the bout).

---------------------------------------------------------------------------
## The user's asks, as played

1. **"buildings to enter and things to do."** — **Met, mostly.** I walked
   from the start into the Orpheum (the marquee is in the first frame, 30 m
   away) and the hotel (49 m), the doors open on rooms, things answer: the
   box office (`She waves you through.`), the reel, the bell (`Your key is on
   its hook: 3.`), the lift up, room 2 rattles `locked`, the bed saves and
   CONTINUE wakes me in the room, the piano (`Out of tune. Somebody
   laughs.`), the matchbook (`1 of 2`). The gym's bout is there. But the
   bar's stool traps me (1) and the hideouts are not a fight a person can
   win (3).
2. **"Keep it very much this same aesthetic."** — **Met in the bar and the
   warehouse, not met in the theatre's and the hotel's rooms** (6).
3. **"everything works."** — **Not met**: the stool (1), the theatre's stand
   into a wall (5), the first door late (4), the hideout's men who never come
   (3). What did work: every door I tried opened or rattled honestly, the
   house's double door, the lift's gates, the walk-in push doors; nothing I
   walked into let me through (the theatre's rows, the hotel's armchairs and
   counter stopped me: my straight-line walks stuck on them, as they should).
4. **"This city should really react ... dynamic police ... fun shootouts,
   brawls."** — **Not met in this branch**: crimes are emitted and nobody
   hears them (no O3 here); the shootout is lost by everyone; the brawl at
   the bar comes on a timer (40 - 70 s after I walk in) and is a scripted
   exchange of blows (`bar.js` 178-183) I can step into.
5. **"Think GTA but noir ... freedom to cause havoc."** — **Not met**: no fist
   or gun outside a hideout, no answer from anyone in a room when I hit them
   (7); a broken scene (the fall in the warehouse) ends at Grand Avenue, which
   is sane but far.

---------------------------------------------------------------------------
## The owner's report, read last: what of its Left a player would feel

- Left 1 (the hideout not cleared by the good bot) and Left 2 (the bout's
  medium hands): felt, and worse than written: bad is never through either,
  and the hideout's men never come for a man in cover (a stalemate the
  report does not name). The report's "idle: down about 4 s after" the draw
  was 64 s in my run.
- Left 3 (door latency "the machine"): it is the first open of each place,
  every time; felt as a hitch at every new door.
- The report's interaction walk lists the stools as "E up from each": not
  what I saw at the bar (1). Its bar play passes; mine is stuck, so the play
  probably looks away in a way a player would not, or stands on a frame mine
  did not; play it as a first-timer: E, E, E.
- Left 8 (dressed boxes, the shoppers sliding): not reached (the market
  hall), believed.
- Left 9 (`heat:clear`, `police.lost()`, the garage's storage, the gun shop's
  purchases with no listener): felt as "nothing answers" (7).

---------------------------------------------------------------------------
## What is good and must not be broken by the fixes

- **The Tenements bar is a real panel**: the lit shelves behind the bottles,
  the black bar, the barman's silhouette (frame 01). Keep the light.
- **The warehouse's first frame**: one cone of light down the middle, crates
  in rows, the men's silhouettes at 10 - 15 m, `BONDED` on the far wall: it
  reads at once as "trouble in there". The warning `They know your face.`
  and the revolver coming out with it is the right tell.
- **Doors are honest**: a place's street door says `E  go in`, opens (50 ms
  on a warm room), shuts behind me; the hotel's rooms 2 and 4 rattle `locked`;
  the house's double door opens; walking into a push door pushes it.
- **The hotel**: the lift (in the cab, `E  the lift: up`, a smooth 3.2 s ride,
  `the lift: down` at the top), the bed's black and `Slept. Saved.`, the
  reload, CONTINUE in my room with `Morning, near enough. The rain again.`
  The save is the right beat (`hotel`).
- **The gym's bout loses honestly**: idle is warned and told why at every
  down, out of the ring, nothing taken, the man offers again; good hands win
  the purse and the next man is named in the prompt (`a bout: big lou, $60`).
- **The reel** is a proper still and E ends it.
- **The places load near and do not move my car** (it was where I left it
  at the hotel); the Orpheum's marquee in the first frame is the "finds by
  looking" the brief asked for.
- Errors: none in any of my runs (#errlog clean every time).

## The plays (tools/plays/critic/o5/)
`cold_open.json`, `probe_sites.json`, `theatre_cold.json`,
`theatre_poke.json`, `theatre_house.json`, `door_latency.json`,
`hotel.json`, `bar.json`, `stool_stuck.json`, `mkbout.mjs` (writes
`bout_<profile>.json`), `mkhide.mjs` (writes `hide_<profile>.json`),
`hide_look.json`, `hide_good_cover.json`, and `poke.mjs` (a driver: walks by
W and the mouse to each use, seat and door of a room, looks at it, E, reads
the answer).

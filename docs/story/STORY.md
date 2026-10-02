# NOIR EXTREME — the story (art director's bible)

A short noir detective story told by action, objects and staging. One night,
one city, rain throughout. Very little dialogue: a handful of short lines,
printed as one-line subtitles, never a dialogue tree, never a choice. No
voices. If a beat can be told by an object in the hand, it is.

The user's outline is the spine. This document fills it in. Stay on it; do
not pad it.

## The rules of the telling

- **Year** 1937. The city has no name.
- **The detective** (the player): never seen, never named. Only his hands,
  his sleeves, his hat brim's shadow if anything. First person always.
- **The crew's colour is red.** Their club is THE CARDINAL. Its matchbook is
  red with a black bird. Every time that red shows up in a frame it means
  them. It is the recurring "clue that matters" colour accent.
- **Faces are never modelled.** Every face is lost in shadow under a hat
  brim, a cap, hair, or the light coming from behind. Characters are read by
  silhouette, posture and one signature prop.
- **Colour** is an accent: one or two per frame, small, meaningful. See the
  accent registry in CONTRACTS.md. When in doubt, leave it out.
- **Text in the world** is short: a sign, a name on a door, an address.
  Nothing the player has to stop and read for more than two seconds.

## The cast (distinct silhouettes; all built on the Hood skeleton)

| Who | Silhouette | Signature |
| --- | --- | --- |
| Hoods (the crew's gunmen) | fedora, trench coat (existing) | pistol or Tommy gun |
| The brawler ("Mack") | bare-armed bulk: flat cap pulled low, rolled shirt sleeves, waistcoat, thick neck, no coat. A head taller than the player's eye line. | fists; a red matchbook in his waistcoat pocket |
| The waitress ("Dot") | cap on pinned-up hair with one loose curl shadowing the face, short-sleeved uniform dress, white apron (the one paper-white shape in the room), flat shoes | coffee pot, bottle, cloth |
| The cook | seen only through the kitchen hatch: paper hat, broad shoulders, back-lit | a bell |
| Old man at the far end | hunched, flat cap, scarf, newspaper held high | newspaper |
| The couple in the booth | she: cloche hat, fur collar; he: bowler hat, narrow shoulders | her cigarette holder |
| The dock worker | knit watch cap, pea coat with the collar up | coffee mug in both hands |
| The victim ("Ames", a bookkeeper) | thin, hatless (hat in the gutter), rumpled suit, one shoe off, round spectacles cracked beside him | a torn note in his fist |
| The watcher | tall and narrow: bowler hat, long raincoat, **umbrella** (he drops it when he runs) | umbrella |
| Warehouse crew | Hoods plus dockers: flat caps, short jackets, cargo hooks | hooks, crates |
| The boss ("the Cardinal") | wide and slow: homburg hat, overcoat with a fur collar, cane | a cigar (ember) |

## The places

- **The block** (exists): the avenue under the el. The diner is the ground
  floor of the big stone building on the left, behind where the old street
  camera stood. The story starts and ends here.
- **The side alley** off the cross street, thirty metres down the pavement
  from the diner door: where the body lies.
- **The Harbor Building, room 304**: the victim's office. One window over
  a street, a frosted-glass door with his name.
- **The alley run** behind the Harbor Building: fire escape, fences, washing
  lines, a dead end that is not quite dead.
- **The river road**: a long wet road under and beside the el, for the tail.
- **Pier 9 warehouse**: crates, hanging lamps, a lit office on a mezzanine.

## The scenes

Each scene carries an *As built* line where what was built differs from the
outline (round 3, from the lane reports in `docs/story/reports/wave-b/`; the
keys are in the README's "How to play", the scene by scene machinery in
`ARCHITECTURE.md` §10). The outline itself is left as it was written.

### 1. The diner  (Wave A)
Fade in from black. Inside, night, rain running down the plate glass,
the street and the el dim beyond it. I am on a stool at the counter. The
room: six pendant lamps over the counter, each with its cone in the smoke; a
jukebox glowing at the far end; booths along the window; the hatch to the
kitchen behind the back bar.

Beats, in order (each is a named beat for `?scene=diner&beat=<name>`):
1. `settle`: I can look around. A pack and a lighter lie by my right hand.
   Prompt: **E light up**. Hands: cigarette to the lips, lighter flicks
   (flame: accent), the tip catches (ember: accent). Smoke rises into the
   lamp cone above me. From now on **F** takes a drag (ember flares, smoke).
2. `order`: Dot comes down the counter. Prompt: **E scotch**. One line from
   me, subtitle only: "Scotch. Neat." She sets a tumbler down, takes a
   bottle off the back bar, pours. The stream and the glass are amber
   (accent). She slides it to my hand.
3. `drink`: **E drink**. The glass comes up, tilts, the level drops. Two or
   three sips empty it.
4. `room` (runs under 1 to 3, the room is alive): the jukebox changes
   record when the docker drops a nickel in it; the cook rings the bell
   and Dot carries a plate; the old man turns his page; the el train passes
   outside: its window lights sweep through the room, the cups rattle and
   rings spread in my glass; lightning whitens the windows, the lamps dip
   and recover. A stool beside me can be spun with a nudge.
5. `pay`: **E pay**. My hands open the wallet: the licence card shows for a
   second. The big man two stools down is looking at it. His one line:
   "You're the one asking about the Cardinal." He stands. The stool falls.

*As built:* the pay beat ends on his line and the room passes with no cut into
scene 2's first beat, where he stands and the stool goes over; Q spins the
empty stool beside me, F takes a drag, LMB taps the ash; there is no stand-up
key.

### 2. The fist fight  (Wave A)
First person, fists up in the bottom corners of the frame. It starts in one
move: his hand on my shoulder pulls me round on the stool, I come up and
send the stool beside me skidding away to clear the floor, and we square
up. The rules are `docs/story/FIGHT.md` (each mouse button an arm, a click
a jab, a hold a harder punch, his guard and its openings, a step off the
line as the dodge); the list below is the story's shape.
- **Controls**: LMB jab (alternating hands), hold and release RMB heavy
  punch, SPACE block, A / D slip left / right, E grab what is in reach,
  then LMB swing it.
- **Round one**: jabs and a slow hook. The room clears: the couple runs out
  into the rain, the old man gets under his table, Dot ducks behind the
  counter.
- **Round two**: he takes a bottle by the neck and breaks it on the counter.
  Dot slides me a bottle; plates and a stool are in reach. Things break on
  him and around him: he goes into the stools (they topple and roll), into
  the jukebox (the record skips, then a new one), into the pie case (glass).
- **Round three**: blood at his mouth (accent), wild haymakers. The last
  heavy punch puts him through the front window of the end bay. Glass, rain
  and the sound of the street come into the room.
- Losing is not failing: I go down, the frame goes black, I get up at the
  start of the round.
- **After**: I step out through the door. He is on his back on the wet
  pavement in the broken glass, out cold. **E search**: a red matchbook, THE
  CARDINAL, a black bird (accent; it goes into my pocket). Two shots, far
  down the pavement. Wave A ends here, on the matchbook in my hand and the
  sound of the shots.

*As built (FIGHT.md, version 4):* the way in lasts four seconds and a
nine-card lesson of about thirty seconds follows; the rounds are four manners
of his by his hit points (measured, dirty, wild, out on his feet), not timed;
each button is an arm (a tap a jab, a hold a loaded hard punch), A / D hop
aside, S back, SPACE blocks, E takes; he throws plates (a chevron says where to
step) and swings stools; going down is black and up again in the same manner;
the finish is out through the nearer of the two end windows (the save
remembers which); the matchbook leads straight into scene 3, not an end card.

### 3. The body  (Wave B)
Thirty metres down the pavement, in the mouth of the side alley under a wall
lamp: a man on his back in the rain, blood going into the gutter.
- **Puzzle A, the line of fire**: two bullet marks in the brick. I pull a
  string from each mark through where his chest was; where the two lines
  meet is where the shooter stood: on the fire escape landing. Something
  red lies there: a torn half of a Cardinal matchbook cover.
- **Puzzle B, the two halves**: the half from the landing against the
  matchbook from the brawler: turn it until the torn edges meet. Same
  book. Same crew.
- **Puzzle C, the torn note**: the paper in his fist is in seven wet
  pieces. On the dry step under the lamp I put it back together: HARBOR
  BLDG. RM 304.

*As built:* a crew car pulls out of the alley as the scene opens; before the
strings I kneel (E) and look at three things (the wounds, his hand, the two
marks), and the wet paper comes out of his hand there; my hand holds each
string; the torn half hangs over the fire escape's landing, which I reach by
pulling its drop ladder down (E) and climbing it (W); puzzles B and C are on
the dry step under the lamp (E the matchbook, E the note); leaving is walking
out of the alley's mouth.

### 4. The office  (Wave B)
Room 304. AMES, BOOKKEEPING on the frosted glass. The room has been
turned over once already.
- **Puzzle D, the pad**: the top sheet of the desk pad is gone. I shade the
  next sheet with the side of a pencil: three numbers come up white.
- **Puzzle E, the safe**: behind the framed picture. I turn the dial by
  feel: the click is louder and the dial twitches at the right numbers.
  Inside: the ledger, its cover red.

*As built:* it opens in the third-floor corridor (the lift, doors 302, 303 and
306, 304's glass lit, its lock splintered: a push opens it); the pad is
rubbed with the pencil's side (hold LMB), R 36 / L 12 / R 57 come up white and
the sheet is torn off into my left hand; the safe is right to 36, left to 12,
right to 57, then E the handle; the ledger opens in my hands (CARDINAL CLUB,
PIER 9 - DOCK, the black bird); the scene cuts into scene 5 in the same room.

### 5. The first gunfight  (Wave B)
A shadow on the frosted glass, then two. I draw the revolver (six rounds,
slow, heavy). The door goes in. Three Hoods: one through the door, one
firing through the glass, one from the fire escape window. The room comes
apart: the desk lamp, the glass door, paper in the air.

*As built:* six men, not three (a kicker, a man firing through the frosted
sidelight, a doorway man, a Tommy gunner on the fire escape, then another
doorway man and a heavy); E tips the desk for cover and C ducks behind it; the
music goes as the shadows come; going down is a short fall, black, and back at
the shadows with the door already shut.

### 6. The watcher  (Wave B)
In the quiet after, through the window: a man across the street under a
lamp, under an umbrella, looking up. He sees me see him. He runs.
Down the fire escape, through the alley: fences to vault, washing lines, a
dog behind a gate, crates he pulls down behind him. He reaches his car
first. Mine is parked at the alley mouth.

*As built:* it opens in room 304 at the street window (E look out: two fingers
part the slats) and E the fire escape takes me out under the raised sash; the
run has five stretches (the straight, the fences with SPACE to vault, the
washing, the dog and the crates, the dead end's loose board); losing him is
"Lost him.", black, and back at the stretch's start; his raincoat is pale so
he reads in the dark; his sedan pulls away from the street beyond the board
and mine is a coupe at that kerb, not at the alley mouth; E drive opens
scene 7 in it.

### 7. The tail  (Wave B)
The river road in the rain, his tail lamps ahead (red: the crew's colour).
A mostly straight run with gentle bends under the el: fruit crates, market
stalls, barrels, a newsstand, fences and hydrants to go through. When I am
close: RMB puts the revolver out of the window, LMB fires. A rear tyre goes,
he spins into a lamp post. He crawls out. **Interrogation**: I hold him
against the car by the lapels; one question, asked with a look at the river;
he gives it up in two words: "Pier nine."

*As built:* my coupe's cabin, wheel and wipers; the road is 1.76 km (the chase
about 1.3) with the train over the el, the market, a truck out of a side street
and a car coming the other way; he is the watcher; failing is black and back
to the last of four marks; the question is both fists on his lapels, then I
walk him to the rail and bend him over it, he fights and breaks, his bowler goes
into the river, "Pier nine.", and he slides down the rail.

### 8. The warehouse  (Wave B)
Pier 9. Pools of lamp light and black between them. I stay in the black.
The light on my hands tells me how exposed I am. Lamps can be dealt with:
a switch, a chain, a thrown bottle to turn a head. On the mezzanine, in a
lit office, the Cardinal, cigar going, gives the order: the diner, tonight,
the waitress saw Mack talk. No one leaves.
- **The second fist fight** (the user asked for one later in the story).
  The way out is through the loading bay, and the foreman is in it: a dock
  man with a cargo hook, as big as Mack and quieter. A shot would bring
  the whole pier, so it is fists, and whatever the bay has lying in it (a
  crate lid, bottles, a coil of chain, a lantern). No lesson this time. It
  ends with him going through the planks of a loading door into the river.

*As built:* ten beats (arrive, floor, lamps, aisle, stairs, listen, out, fight,
ko, after); the Cardinal is a black shape on the blinds of the lit office (the
real `cardinal` kind) and the three lines are subtitles; the "chain" is the
hoist's cord (let the load go), the knife switch kills aisle B's lamps, a bottle
(hold LMB for the arc) turns heads, E from behind knocks a man out, and LMB with
nothing in hand reaches for the revolver and puts it back; being caught is the
cosh and the last checkpoint; the foreman's cargo hook is knocked out of his
fist by a jab on his arm, and the bay's things are the hook, the crate lid (a
shield), the chain and the lantern (its oil burns); the fight is silent; then
out past the bay's side door onto the pier.

### 9. The big shootout  (Wave B)
Back on the block. I get there first. Dot hands me the Tommy gun from under
the counter. They come as the story, not as waves: two cars pull up and
men get out behind the doors; men from the doorways across the street; a
gunman on the el firing down; a car that does not stop. The diner's windows
go. The last car is the Cardinal's. It ends on him: his hat in the wet
street, the cigar still lit beside it.

*As built:* as outlined, plus the light switch by the door (the men shoot worse
at a dark room), the drums (E at the counter; Dot slides two more), a man
climbing out of each car, an intruder in at the door, the Cardinal's walk (a
cane, a pistol, a cigar; twenty-four wounds), Dot at the broken window in the
last frame and the el train going away along the deck.

After the shootout: stop. The user decides what comes next. *As built:* it
stops on the THE END card, whose click goes back to the title.

## Music (the user adds real jazz at the end)
No music is composed. The game has named music slots that are silent until
a file is dropped in (see CONTRACTS.md, Music; `docs/story/MUSIC.md` says which
scene cues which slot, when it starts and stops, and how long each runs). The
slots:
`jukebox_a`, `jukebox_b`, `jukebox_c` (diner, from the jukebox, heard in the
room), `fight`, `body`, `office`, `chase`, `tail`, `warehouse`, `shootout`,
`end`.

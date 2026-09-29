# Lane 6 — characters

Branch `wave-a/L6-characters`, port 5186. You own `src/enemies/**` and
`src/cast/**`. The Hoods are the user's favourite thing in the game: men,
not mannequins, black shapes with a lit rim, moving like people. Every new
figure must be as good, and must be told from every other by its outline
alone at 20 m.

The Hoods themselves do not change: `hood hoodstudy hooddeath hoodwalk
hoods` must stay pixel-identical.

## P0.1  Costumes on the Hood's skeleton
`Hood.js` builds one skinned mesh from parts (`buildTorso`, `buildSkirt`,
`buildCollar`, `buildSleeve`, `buildHat`, `buildHead`, ... `assemble`).
Generalise that into costumes without touching what a Hood is:
`figureGeometry(costume, lod)` in `src/cast/`, where a costume names a
body (a table of proportions), a head cover, garments, shoes, and a skin
of part shades. Same joints, same skinning approach, same three LODs, same
ink slot and brush anchor, same shadow. Far LOD is a clean black
silhouette with the head cover and the garment's hem readable.

**No faces.** A head is a dark mass. What the eye gets is the hat or the
hair, the angle of the head, the line of the jaw against a lit background,
at most a nose in profile. The cover always shadows the face: a brim, a
peak, a fall of hair.

Anchors carry a **viewer's** yaw (the way a camera placed there would
look); a figure placed on an anchor faces `yaw + PI`. The foundation's
stand-in brawler in `scene=fight&beat=round1` stands with his back to the
player: make sure your figures face what they should (the brawler faces
the player, the waitress faces the counter, a seated man faces the counter
or his table).

## P0.2  The diner's people (STORY.md, the cast)
Heights are to the top of the head cover. The player's standing eye is at
1.65 m, seated 1.45 m above the floor.

**The brawler, "Mack"** (kind `brawler`), 1.96 m, the widest shape in
the game.
- Body: shoulders 0.60 across (a Hood's are 0.46), a deep chest, a thick
  short neck that runs straight into the head, a belly that carries the
  waistcoat forward, long heavy arms, big hands (1.25 x a Hood's).
- Clothes: a flat cap pulled low, its peak shadowing everything above the
  jaw; a collarless shirt with the **sleeves rolled above the elbow** (the
  forearms are bare and print light: the lightest thing about him, so his
  hands read in the fight); a dark waistcoat, unbuttoned at the bottom;
  braces; heavy trousers, boots. No coat.
- At the counter: hunched over a plate on stool 6, elbows wide, a bottle
  of beer by his right hand.
- A red matchbook in his waistcoat pocket (a `matchbook` prop; hidden
  until lane 7 asks for it).
- In round three: blood at his mouth and on his shirt front (accent
  `blood`, small).

**The waitress, "Dot"** (kind `waitress`), 1.68 m.
- A narrow-waisted figure; a short-sleeved uniform dress to below the
  knee, a small collar; a **white apron** tied at the back (the one
  paper-white shape in the room: it is how the eye finds her); a small
  cap on pinned-up hair with one curl falling forward that shadows the
  face; flat shoes.
- She carries: a glass coffee pot, a bottle, a plate, a cloth
  (`c.hold`).

**The cook** (kind `cook`), 1.80 m: only ever seen from the waist up in
the hatch, back-lit: a paper hat, heavy shoulders, an apron bib, sleeves
rolled. He rings the bell and slides plates onto the shelf.

**The old man** (kind `oldman`), 1.66 m: bent, a flat cap, a scarf, an
overcoat too big for him, a newspaper held up in both hands that hides him
from the chest up.

**The couple** in booth 2: **she** (kind `couple_her`), 1.64 m: a cloche
hat low over the brow, a coat with a fur collar that stands round the
jaw, a cigarette holder; **he** (kind `couple_him`), 1.74 m: a bowler
hat, narrow sloping shoulders, a short overcoat, an umbrella hooked on
the table edge.

**The docker** (kind `docker`), 1.82 m: a knit watch cap, a pea coat with
the collar turned up to the ears, a mug held in both hands.

Preset `caststudy`: all seven and one Hood standing in a row under a lamp
on the street, 5 m from the eye, turned three-quarters; `caststudy&far=1`
the same at 22 m (silhouettes only: each must be named at a glance);
`castlab&kind=<k>&hs=<state>&hy=<deg>` one figure, any state, any angle,
with `focus=` for close-ups as `hoodlab` has.

## P0.3  How they move
Procedural clips on the joints, as `HoodAnim.js` does it, blended by a
small state machine. People sit with weight, shift, breathe; nobody is a
statue and nobody loops visibly.
- **Seated** (`sit`, and on top of it `sitEat`, `sitDrink`, `sitRead`,
  `sitSmoke`, `sitTalk`): the pelvis on the seat anchor, feet on the rail
  or the floor, elbows on the counter or the table; a glance toward the
  door when its bell rings, toward a loud noise, toward the player now
  and then.
- **The waitress**: `walk` with a carried load (the pot held level, the
  free hand out from the body), `serve` (sets a thing down on the counter,
  mark `down`), `pour` (3.2 s: takes the bottle from the back bar, uncorks
  it, tilts it over the glass, marks `streamOn` 1.3 and `streamOff` 2.6,
  rights it), `slide` (slides the glass across the counter to the player's
  hand, mark `release`), `wipe`, `lean` (hip against the counter, arms
  folded), `duck` (down behind the counter, a hand up over the head),
  `slideBottle` (in the fight: a bottle sent down the counter to the
  player, mark `release`).
- **Civilians in the fight**: `startle`, `cower` (the old man under his
  table), `flee` (the couple: up, he takes her arm, out of the door into
  the rain, the door's bell), the docker backs to the wall and watches.
- **The brawler at the counter**: `sitEat`; then `notice` (2.0 s: the head
  turns slowly toward the player's wallet, holds), `rise` (1.6 s: he stands
  off the stool, which goes over behind him: mark `stool` 0.7), squares
  up.

## P0.4  The brawler's fight (CONTRACTS §14; lane 7 runs the rules)
He fills the middle of the frame, 1.45 m from the eye, lit from above by
the pendants: the cap's peak and the shoulders catch light, the face is
black, the bare forearms and fists are the lightest shapes and the eye
follows them.
Every attack has a **tell that reads in silhouette** in its first 0.2 s:
- `br_guard`: weight on the back foot, fists low at the chest, chin down,
  swaying.
- `br_jab`: the left shoulder dips, the left fist flicks out straight.
- `br_hook`: the right shoulder drops and the right elbow goes back and
  out **beyond the line of his body** (it breaks his outline), then the
  fist comes round wide at head height.
- `br_haymaker`: both hands go up and back over the right shoulder, the
  whole body winds to his right, he steps in; the blow comes down
  overhand.
- `br_bottle`: he snatches a bottle from the counter, breaks it on the
  counter's edge (mark `break`), holds the neck low and out to the side,
  then thrusts.
- Hit reactions that show where and how hard: `br_hitHeadL/R` (the head
  snaps, the cap stays on until round three, then flies), `br_hitBody`
  (he folds over the blow), `br_stun` (arms drop, he sways on his heels:
  the opening).
- Thrown into the room: `br_into_stools` (he goes backwards into the row,
  arms wide, takes three stools down with him, gets up off one knee),
  `br_into_jukebox` (his back hits it, his head goes back against its
  arch), `br_into_piecase`.
- `br_ko_window` (2.2 s): the last blow lifts him; two steps backwards
  over the booth table, his back goes through the plate glass of bay B4
  (mark `glass` 0.55: lane 7 calls `glass.shatter`), he lands on his back
  on the pavement outside, one arm out, in the rain. He stays there,
  breathing (`c.ko`), to be searched.
Marks and durations are data in `src/cast/clips.js`; start from the
contract's table and retime for the look, but keep each tell at least
0.3 s long before its contact.
Preset `brawlstudy&clip=<name>&t=<s>`: him alone, the player's eye and
distance, the diner's lamps, any clip at any time; a strip of five frames
per attack showing tell, wind, contact, follow, recover.

## P1
- The Hoods sit in cars, lean in doorways and step out of them
  (wave B entries): `leanDoor`, `stepOut`.
- The watcher and the victim (wave B kinds) if everything above is
  finished and looked at.

## Intended golden changes
None. If a Hood frame moves, you changed the Hood.

## Performance
Up to 12 Hoods and 8 civilians; seated civilians are cheap (few bones
move; shadows refreshed slowly, as a standing Hood's are).

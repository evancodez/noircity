# O6b — car damage, physical; the awnings and the hung lamps; the river's splash (lane report, the handover)

Branch `ow/O6b-damage` (from main at 5e83e76), port 5380. Brief:
`docs/briefs/O6B_DAMAGE.md`. A follow-up to O6 (`docs/reports/O6.md`); the
seams for other lanes are `docs/seams/SMASH.md` §5 (new). Code marks in shared
files: `[O6b]`. Review frames: `docs/review/O6b/`.

The copy's start (`ow/O6b-copy-wip`, d1b420d) was cherry-picked, played and
judged: **kept** its idea of cutting a part out of the car's own skin (`own`,
`cut`), the dents' normals tilted to the hollow, `spawnPart`, the bonnet's
top line, the hub's drop and grind, the LOD guard in `world/Cars.js`;
**fixed** what did not run or did not play (an undefined `V3` that threw at
the first wheel off; parts drawn in the kerb's grey; a wheel left standing on
its rim; thin plates that never came to rest; a door overlaid on the side with
the door still there under it; bumper cuts reaching the grille; dents pushed
**out** of the car - O6's too: the contact's normal points into the car; the
dents uncapped; listeners piling up on a car attached twice); **dropped**
nothing else.

---------------------------------------------------------------------------
## 1. What exists (as a player meets it)

**Every car** (`src/destruct/CarDamage.js`; mine, the parked ones, O2's when
they land):
- **Dents where it was hit**, deeper the harder, the light shifting in the
  hollow, capped at 12 cm a vertex (knocks add up, the car keeps its shape); a
  car held against another (a shove) dents once, it is not smashed by the
  stream of contacts.
- **The bonnet** pops at a hard front blow (or when the engine smokes): a
  bang, a white mark, it lifts on its broken catch and from the seat it is
  seen riding in front of the screen, rising with the speed and beating in the
  wind, knocking down on its catch over bumps. A second hard front blow, or a
  few seconds flat out, tears it off: it goes up and back over the roof,
  tumbling, and lies in the road. At a blast it goes up with her.
- **A door** hangs open after a side blow (a pale cabin in the gap: an open
  door reads on a black car), swings with the car's moves, slams on its stop;
  hit again, slammed hard, or driven on fast it tears off with a clatter and a
  skid and lies on the road, a thing: it stops a man, a car meets it as a bump
  and shoves it.
- **A bumper** torn loose at a smashed corner hangs from its other end and
  drags on the road: sparks at its scraping end, a scrape, the car slowed a
  little; worked more or hit again, it comes away and is kicked along.
- **A wheel** at a smashed corner wobbles as it rolls (the car shakes and
  pulls); hit again at that corner or driven hard it comes off and rolls away,
  tips over and lies; the car drops onto its hub: iron on stone, sparks, half
  its power, pulling to that side.
- The lamps, the glass, steam, smoke, fire, the blast and the wreck as O6 left
  them. The tram on a car now shoves it for three seconds and more (sparks,
  dents, a door, a bumper) before she burns (O6's half a second).
- **The river**: a car over the quay's edge drops nose first, the splash in
  ink (a crown of white drops, a white ring spreading and closing, the
  sound), and `The river took it.` as the water closes; ashore at the steps
  (no `The river.` warning in the first seconds there: the cold play's finding
  10), looking back: a dark shape under the surface where it went down, a pale
  ripple round it, its two lamps glowing up through the water and dying over
  twenty seconds, a bubble now and then. A man walking off a slipway or a
  pier: his splash, then the base's rule (the steps).

**The city** (O1's roam, every district): the near build's **awnings** (about
eighty in the streamed chunks round Grand Ave) are things of the set: a
lorry's roof under one tears it down (its water dumped, the canvas down on
the pavement); **the el's hung lamps** (fifty) can be shot out: a round in
the head, glass, sparks, the pop, the buzz, dark - its cone and its light out
(mended out of sight at 200 m). **A shot-out lamp's head prints black** (the
grey disc was the far tile's lights mesh: its black printed paper grey; the
dark mouth is now taken out of that draw). **What lies** (everything the set
puts on the road) carries a faint rim of paper on its edge, so a bench or a
door lying in an unlit stretch reads by its shape.

**The bed's new beat** (`?start=smash.ten`): ten cars parked along Grand Ave
in the gaps between the el's columns (sedans in two paints, a second coupe,
two lorries: the bed's sedan and lorry among them), my coupe in the lane
under the el at Fifth St heading north, the tram kept off. Ram them all. The
sedans are locked (no seat in them yet: E at one rattles `locked`); the coupes
and the lorries can be taken when mine is spent. Look development:
`&ten=states` (the ten states of a car's damage, one a car), `&ten=wrecks`
(all ten up), `&ten=parts` (a door and a bonnet lying in the lane), `&ten=drive`
(a sedan with its bonnet up, a door hanging, a bumper dragging and a wheel
wobbling driven up the lane by a hand of its own: the strips).

---------------------------------------------------------------------------
## 2. How it is built

| file | what |
| --- | --- |
| `src/destruct/CarDamage.js` | **the parts**: `PARTS` (where each part of a kind is; a model may carry its own `model.parts`), `own` (my build of a skin mesh, non-indexed, its first positions kept for the dents' cap), `append` (the bay's black into `dark`), `cut` (a part's triangles out of the skin onto a pivot, one mesh a material, the material's rimmed twin), `popHood` / `hoodOff` / `blowHood`, `hangDoor` / `doorOff` (a panel of the paint over a pale opening), `looseBumper` / `bumperOff`, `wobble` / `wheelOff`, `partsStep` (the bonnet's spring, wind and knock; the bumper's drag, sparks and strain; the wheel's wobble, pull and wear; the hub's grind; the doors' swing, stop and strain); `knock` with the held-contact rule, the parts that take a second blow, the dents along the contact's normal; the tram's rate (1.15 a second); the listeners kept and taken off; `sink` / `sinkStep` / `splash` / `waterStep` (the river) |
| `src/destruct/Smash.js` | `spawnPart` (a part as a thing: scale, paint, roll), `dropPart`, `regrid`; per-item scale `it.S` (draw, body, the bullets' box); a part's plate stops falling on the ground (thin plates never rested); a wheel tips over off its rim; the pools' materials twinned with a paper rim (`rimMaterial`, the car paint's own cap kept under it); a lamp's dark far mouth collapsed out of the draw (`mouthHide`); `how: 'fixed'` (a hung lamp) never pushed over |
| `src/destruct/smashKinds.js` | kinds `carbonnet`, `cardoor`, `carbumper`, `carwheel` (pools, unit shapes), `hanglamp`; `awning` given a pool and its valance's reach (`low: -0.6`: a lorry's roof reaches it) |
| `src/audio/sounds/o6b.js` | the bonnet's bang and its flap, a door's tearing off (snap, clatter, skid), a bumper's scrape, a hub's grind, a wheel off, the splash |
| `src/scenes/smash.js` | the beat `ten` (`TEN`, `&ten=states|wrecks|parts|drive`); `place` takes the car, the lorry, no tram; every sedan locked (E rattles); parked cars hold their brakes |
| shared, marked `[O6b]` | `src/scenes/city.js` (the car into the river sinks and splashes before the words; a man's splash; no river warning the first 4 s ashore), `src/stages/noircity/parts/stream.js` (each lot's awnings registered: `awningRec`), `src/stages/noircity/parts/props.js` (the hung lamps registered, their boxes in the bullets' world at the first step), `src/world/Cars.js` (the copy's: a car with its own build keeps it, LOD and shadow) |
| `tools/lib/o6b_damage.mjs`, `tools/plays/o6b_*.json` | the proofs' driver (ram, parts, hang, awning, river, memory) and its plays |

Within reason: no soft body. A part is the car's own triangles moved on a
pivot (a few draws a car while they hang: one mesh a material); once off it is
one instance of a pool (one draw a kind, whatever the count).

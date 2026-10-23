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

---------------------------------------------------------------------------
## 3. The proofs (by real input, each run once on the final code)

The machine at load 28-30 and the GPU 100 % busy from other lanes throughout.

| proof | play | result |
| --- | --- | --- |
| **the havoc: ten cars rammed to the states of a car's damage** (E into my coupe; up the east kerb a diagonal into each one's door from the lane under the el, the last twice; round the junction at Centre St; down the west kerb head-on into each one's tail; my car spent: E out, a walk, E into the next whole car) | `o6b_ram.json` | PASS: the states between them `dent, bonnet, bonnetOff, doorHang, doorOff, bumperDrag, bumperOff, wheelWobble, wheelOff` (and steam, smoke); the parts off (2 wheels, a bumper, a door) **all at rest, none floating, none in a wall**; the rams at 13-35 km/h (the driver's own pace), one swap of car. The run before the last (same game code, an over-strict check) had a wheel lie with its middle inside an el column's plinth collider (§7) |
| **the parts as things**: a door and a bonnet lying in the lane (`&ten=parts`); on foot straight into the door, W held 3 s; E into my coupe and north over the door | `o6b_parts.json` | PASS: stopped by it (nearest 0.36 m, the walk's own radius; never inside); the car meets it at 8.2 m/s and leaves it at 7.7 (a bump that slows it), the door shoved 0.6 m on and at rest again |
| **memory flat over fifty cycles**: every part on the ten cars at once, 0.7 s, every car put back whole and the set mended, fifty times | `o6b_memory.json` | PASS: geometries 1177 at every tenth cycle, textures 64, programs 144, the set's items 1430, the scene's children 180, cut parts 0; heap 527-545 MB, no trend |
| **the el's hung lamp shot out** (on foot under the el, aim by the mouse, LMB) | `o6b_hang.json` | PASS: out at the first burst; dark, its cone and its light out |
| **the city's awnings and a lorry** (the bed's lorry into Fifth St, up on its north pavement under the shop fronts) | `o6b_awning.json` | PASS: the near build's awning there torn down by the roof and at rest on the pavement |
| **the river** (O1's roam, the coupe down the slipway at the docks, W held) | `o6b_river.json` | PASS: the splash and its ring as she goes in, `The river took it.`, ashore at the steps; looking back, her shape under the water with its lamps glowing |
| **a shot-out lamp's head black** (O6's own lamp proof, by real input) | `o6b_lamp_black.json` | PASS: cone, light, pool out and the mouth out of the far tile's draw; the frame: a black head (review frame 6) |
| **the tram on a car** (the bed's tram beat) | `o6b_tram.json` | PASS: 2.9 s from its first sparks to her burning (dents, a door hanging), the blast, me unhurt across the road |
| **the pad** (`?padfake=1`, the pad alone) | `o6b_pad.json` | PASS: X begins, square into the coupe, R2 up the lane over the door lying (met), the stick into the east kerb (the car it meets takes the blow), L2, square out; 0 key or mouse events |
| O6's own, replayed (regressions) | `o6_drive.json`, `o6_fire.json`, `o6_iron.json` | PASS 3/3, 4/4, 5/5 |
| **errors** | `tools/errors.sh` on `smash` `bed`, `ten&ten=states`, `ten&ten=wrecks`, `ten&ten=drive`, `tram`, `burn` and the city's `roam`, `ashore`, `roam&at=docks` | clean, all nine (three dumps ran out their watchdog on the loaded machine the first time; run again, clean); every play's `#errlog` clean |

**The look** (strips and frames looked at against the reference): a strip of
a sedan driven up the lane with every part loose (`&ten=drive`, 8 frames): the
bumper is the most legible part (a bar from the nose to the road, its paper
rim, sparks at its end); the bonnet reads from the seat (its rim over the
screen, review frames 2 and 3) more than from outside; an open door reads by
the pale cabin in the gap. The splash is a white crown and its streak in the
wet. Frames (`docs/review/O6b/`, 1440 x 900): `o6b_1_ten_wrecks_on_grand_ave`
(a golden frame), `o6b_2_a_tail_rammed_from_the_seat`,
`o6b_3_the_bonnet_riding_on_its_catch`, `o6b_4_a_bumper_dragging`,
`o6b_5_into_the_river`, `o6b_6_a_shot_out_lamp_head_black`.

---------------------------------------------------------------------------
## 4. For other lanes

- **O2 (wheels)**: your kinds get every part with nothing to do if their
  meshes are in `model.meshes` at the identity (`paint` or `body`, `chrome`,
  `dark`, `rubber`, `hubs`, `caps`, `white`, `seams`); a body of another shape
  names its parts as **`model.parts`** in `PARTS`' form (SMASH.md §5: `hood`,
  `door`, `bumper`, `wheel`; model frame). A kind without them uses the
  sedan's. A damaged world/Cars sedan keeps its near build (`car.own`): a
  one-draw far build (the perf audit's lever 1) must leave a car with
  `car.own` alone. Every sedan of the bed is locked because a sedan has no
  seat yet: your cabins unlock them. A parked car should hold its brakes
  (`input.brake = 1, handbrake = 1, hold = 1`): shoved, it slides, it does not
  roll away. Your tram: a car's own contact with it marks it
  (`e.thing.kind === 'tram'`); nothing to do.
- **O3 (people)**: `game.on('smash:part', { car, part, how })` (a bonnet
  sprung or off, a door hanging or off, a bumper, a wheel); the parts on the
  road are things of the set (kinds `carbonnet` `cardoor` `carbumper`
  `carwheel`): a man walking is stopped by a door or a bonnet lying.
- **O1b (streets)**: `stream.js`'s `awningRec` reads the awnings back from
  facade.js's boxes (vertices 0-3 the +x face, 4-7 the -x face of a
  `BoxGeometry(w, 0.08, 1.6)`): change the awning's shape and change it there.
  The hung lamps' bullet boxes are added at the props part's first step.
- **O7**: `?start=smash.ten` is a test bed, not the game. The river's sink is
  `CarDamage.sink`; what comes after (the quay, the hospital) is the roam's.

---------------------------------------------------------------------------
## 5. The gate (on the final code)

1. `npx vite build`: built (the usual chunk-size notice).
2. Golden: **game one's 40 frames identical** (the 38 and O4's two); **the
   city's eleven identical** (O1's ten and `smash_bed`); **`smash_wreck`
   re-taken** (0.58 % of the pixels: the sedan's blast now throws her bonnet,
   so the set's random numbers after it moved and the lamp post the blast
   knocks over leans at another angle; that post now carries the paper rim of
   what lies: accepted as this lane's); **one frame added, `smash_ten`** (ten
   wrecks on Grand Ave: `scene=smash&beat=ten&ten=wrecks&t=14&hud=0&vm=0&pose=-120,-21,3.1416,-0.06`),
   captured twice: identical.
3. Errors: clean (§3).
4. The proofs: §3.
5. The jank walk: the havoc's every-part check (resting, floating, in a wall),
   the walk into a door lying, a car over it, O6's drive-through replayed
   (the car never inside a standing thing).
6. **Frames per second with ten damaged cars in view** (the ten beat's ten
   states - dents, the bonnet up, doors hanging and off, bumpers dragging and
   off, wheels wobbling and off, one burning, one a wreck - from the north end
   of the lane, all ten in the frame; `tools/fps.mjs`, 1440 x 900, 6 s) against
   `shot=perf` measured straight after (the GPU 100 % busy before both: the
   ratio only): **24.9 fps against 21.4: 1.16 x `shot=perf`** (1,599 draws and
   3.13 M triangles against 731 and 2.82 M).

---------------------------------------------------------------------------
## 6. Where the brief was changed in play

- **A door is a panel over a pale opening, not cut from the side.** The
  sedan's and the coupe's sides are extrusions whose caps are long fan
  triangles: cut by the door's box they came away as slivers the length of the
  car. The panel is the door's size in the car's paint; the gap shows the
  cabin's inside pale (black on a black car, an open door did not read).
- **The bonnet comes off** on a second hard front blow and flat out, not only
  at a wreck: a bonnet riding up in front of the screen for good was a wall at
  speed; torn off over the roof it clears the view, and it is the better beat.
- **A side blow of k >= 0.3 hangs a door** (O6's door wanted 0.45: only above
  about 40 km/h into a door; 20-30 km/h is how a player swipes a parked car).
- **The tram's three seconds** are its damage rate (1.15 a second while it has
  the car), not a brake for the tram: the car is shoved, sparks, dents, a door
  goes, then she burns.
- **An awning's reach** is its valance (`low: -0.6` under the fixing): the old
  2.45 over the fixing was out of reach of anything, the bed's lorry
  included; a lorry's roof (3.3 m) tears the city's (fixed at 3.85 m), a car
  never.
- **The bed's sedans are locked** (E rattles `locked`): from a sedan's seat
  the camera was inside the body (no cabin of its own yet); the coupes and the
  lorries can be taken.

---------------------------------------------------------------------------
## 7. Left (most felt first)

1. **Black on black.** Dents read only in the glints of a black car's paint;
   the bonnet up and a hanging door read by their paper rim and by the sparks,
   white marks and sounds at the moment they go - from the seat best; from
   across a dark street a damaged parked car is still mostly a black shape.
   The ink draws no contour between parts of one car (one ink id): a distinct
   id for a loose part would outline it - a shader lane's call.
2. **The sunk car's shape** under the water reads only near (a dark disc with
   a pale ripple and two small lamps on black water); from the steps it is
   hardly seen.
3. **A wheel came to rest once with its middle inside an el column's plinth
   collider** (one havoc run in four; never in a building's wall). Parts meet
   the walking colliders (walls, columns) but not other cars' boxes: a door
   can lie partly under a parked car.
4. **The driver's rams** are 13-35 km/h (pure pursuit by the keys under the
   el's columns); harder rams were proved only by staging (`&ten=states`).
5. **The parts are generic shapes once off**: the pool's unit shapes (a plate,
   a bar, a wheel) scaled to the car's part, in its paint, not the panel that
   hung with its dents.
6. **A damaged sedan never takes its far build** (`car.own`): ten damaged
   sedans far down a street cost their near triangles. O2's far build should
   give a damaged car one too, or drop the damage beyond 40 m.
7. **City awnings cannot be shot** (the near chunk's `tree` merge is not in
   the bullets' world); only a tall vehicle tears them. The city has no lorry
   of its own yet (O2): the proof drove the bed's.
8. The `hundred` beat's errors dump (O6's left 12) was not run; the `hundred`
   fps was not re-measured (O6's 1.20 x).
9. Sounds were not listened to (every run muted); built from the kit like
   O6's and played by the events above.

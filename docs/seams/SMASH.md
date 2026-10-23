# NOIR CITY seams: the destruction set (lane O6)

How every other lane makes things break, and what it gets back. The code:
`src/destruct/Smash.js` (the registry, the bodies, the car's meeting, the
rounds' meeting, the caps), `src/destruct/smashKinds.js` (the kinds: their
numbers, their shapes), `src/destruct/SmashPieces.js` (the pieces' pools),
`src/destruct/CarDamage.js` (what a car shows), the city's part
`src/stages/noircity/parts/props.js`, the test bed `src/scenes/smash.js`
(`?start=smash`). The base (`Breakables`, `Glass`, `Shatter`, `Wreck`) is
kept: Glass panes are the set's shop glass, Wreck's shell is every car's
burnt body.

---------------------------------------------------------------------------
## 1. The registry: `stage.smash`

One per stage (the city's: `stage.smash`, built by the `props` part).

```js
const S = game.stage.smash;
S.register(target, kind, opts) -> item
//   target: a record { x, z, yaw } drawn MERGED with its neighbours (the
//           generator's furniture: its slots come from the merge), or an
//           Object3D drawn on its own (it is moved itself when it goes)
//   kind:   'lamp' 'pole' 'namesign' 'stop' 'hydrant' 'bin' 'callbox'
//           'bench' 'stall' 'newsstand' 'crate' 'fence' 'awning' 'glass'
//   opts:   { y (base height; else the walking surface), merged: true,
//             colliders: true (its walking and car colliders made here: a
//             lane's own things; the city's come from bounds and track),
//             w, d, wall: { nx, nz } (an awning's), e, c (an object's box) }
S.hit(target, point, impulse, by) -> 'hit' | 'over' | 'break' | null
//   target: the item, its record or its Object3D; impulse: a Vector3, its
//   way and its speed in m/s; by: 'car' | 'bullet' | 'fist' | 'body' | 'blast'
//   (a fist counts 0.4 of its push; below the kind's give it is a jolt: a
//   sound, nothing moves)
S.blast(at, r = 6, power = 1)      // what stands within r goes over, away, as the
                                   // wave reaches it (35 m/s out, 12 a step at most);
                                   // what lies is thrown (a car's blast calls it)
S.later(dt, fn)                    // a thing to do a moment from now (the wave's queue)
S.mend(item)   S.mendAll()         // back as built (a retry, a reset)
S.itemAt(x, z, tag)                // the standing item at a place (a collider's)
S.near(x, z, r)                    // the items round a point
S.events                           // the record the plays read: { t, kind, what, by, id }
S.stats                            // { over, broken, shot, mended, recycled, maxOut }
S.setShops(list)                   // [after the critic] the city's shop windows (facade.js
                                   // lotWindows kind 'shop'): glazed when a round or a car meets one
S.cars.why()                       // the fail's words when the set downed the man (null: not ours):
                                   // 'Too close when she went.' | 'Burnt. Keep off the fire.' | 'The tram. Mind the rails.'
S.cars.lowWarn()                   // the low line's fix when the set hurt him ('Too hot. Get back.' | 'Hurt. Keep off the rails.'):
                                   // a scene's `lowWarn: (ctx) => ctx.stage.smash.cars.lowWarn() || null`
```

**Every break is seen** (after the critic: dark on dark it was not): a
thing that goes over or breaks throws the muzzle flash's white splatter for
two frames where it went (`S.mark`, three a step), sparks off iron and
white splinters off wood and stone, a pale puff that hangs a moment; a
round's chips are two in three white; a shot hydrant's fan is white; the
papers, a stall's canvas and its goods carry a little light of their own.
A lane's own breakable gets it by going through `S.hit`.

**The man and the set** (no lane calls these; the set does it per step):
walking into a standing thing is `S.hit(item, ..., 'body')` at a fifth of
his speed (a clang; a bin at a run goes over); on foot within 7.5 m of a
car that burns he is told `She’s going up. Get back.`, in a burning wreck's
fire (3.6 m) `Too hot. Get back.`; on the rails ahead of a car of `kind
'tram'` (26 m) the bell and `The tram. Off the rails.`, and met he is
knocked aside off the rails and hurt by its speed (16 + 4.2 x m/s). Downed
by what the set did in a scene with no `health.onDeath` (the city's roam),
the set fails him with `why()`'s words; a scene with its own `onDeath` (the
bed's; O3 / O7's hospital) reads `S.cars.why()` for them.

Events on the game: `smash` `{ kind, pos, by, how, item, speed }` (O3: a
witness to what is someone's), `car:burning` `{ car }`, `car:wreck`
`{ car, at, mine }`, `smash:tram` `{ at, k }`, and the base's
`car:exploded`.

### The merge (O1: the generator registers)
The city registers every `C.props` record of a kind of the set and every
lamp post (`props.js`, at the stage's build). `stream.js` records each
record's vertex ranges in its chunk's merged meshes (`m.userData.ranges =
[{ owner: record, start, count }]`, `m.userData.prop = 'merged'`) and calls
`smash.chunkIn(key, meshes)` before the chunk's solids go into the bullets'
world and `smash.chunkOut(key, meshes)` as it drops. A lamp's mouth in the
far tile is a colour range (`far.js`: `attr: 'color'`). The item that goes
over is collapsed out of its merge (its triangles in the draw and in the
bullets' BVH) and drawn on its own; mended, the ranges are written back. A
chunk built again with an item out collapses it at once. **A lane that adds
a merged set of its own** does the same: merge, record the ranges, call
`chunkIn` (the bed does it: `src/scenes/smash.js` `buildBed`).

### The car (O2: the cars call)
`Car.js` meets the set through the track: `stage.track.smash = S`.
- A round thing (lamp, pole, sign, hydrant, bin, call box) is the track's
  circle with Car.js's own give: `{ give, giveAt, drag, hurt, onGive }`
  (`S.bindCircle(item, circle)` for the city's; `register(..., { colliders:
  true })` for a lane's). Below `giveAt` m/s into it, it is a post that
  stops the car; above, it goes (the car keeps `drag` of its speed and
  takes `hurt` x the speed over 3 m/s of a damage step).
- Box things (bench, stall, newsstand, crate, fence), what lies and what
  flies: `S.collide(car, out)` every step from `Car.collide` (as it was: the
  old city's `smash.collide`): it returns what the car pays for
  (`[{ drag, dmg, pos, kind, item }]`); below the give it calls
  `car.vsBox` (a solid); a light thing lying in the road is kicked on, a
  heavy one is a bump (`heaveV`, a little drag).
- `spec.top` (m over the road; default 1.75, a truck 3.3) says what an
  awning's hem reaches: only a tall thing tears one down.
- A kinematic car (the tram) calls `S.collide(car)` from its driver to
  sweep its rails; its `kind = 'tram'` gives it the man's rule above.
- [after the critic] What a car pays (the kind's `drag`, `hurt`): a lamp
  post or a telegraph pole about half its speed, a hydrant or a call box a
  third, a stall a third; the eye of the player's car kicked by it
  (`controller.kick`). Two lamps at 50 km/h and the car steams, four or
  five iron things and it smokes, never burning from one kerb run.
- [after the critic] A car whose `input.hold` is 1 brakes when rolling back
  too (Car.js's own rule for the city's drivers): the roam sets it on the
  car I leave and while E brakes for me to get out (the empty coupe reversed
  itself 37 m down Grand Ave), and clears it as I get in.
- The city's shop fronts: a car's box reaching one glazes it and bursts it
  (`S.collide`), as the bed's panes.

### The rounds (O4: the rounds call)
`fx/React.js` already routes every round: `ud.prop` -> `stage.props.hit` ->
`S.bullet(prop, hit, dir, weak)`. A merged mesh is `'merged'` (the item
standing where the round went is picked by its shape); an item out of its
merge has a box in the bullets' world (`ud.prop = item`); a car has its
hull's box riding with it (`ud.prop = { carD }`). A Hood's stray round
(`weak`) shows but never kills a lamp or flattens a tyre. A fist or a body
thrown into a thing: `S.hit(item, point, impulse, 'fist' | 'body')`.
[after the critic] The far tiles' masses carry `ud.prop = 'facade'`: a round
into a wall comes here too, and where it went into a shop window
(`S.shopNear`) the window is glazed there and then (`S.glaze`: a Glass pane
over it, an item of kind `glass`, at most 24 at once, the oldest out of
view goes, all of them at the mend's 200 m) and the round is the pane's.

---------------------------------------------------------------------------
## 2. The kinds (src/destruct/smashKinds.js)

| kind | a car (give at, m/s) | a round | where it lies |
| --- | --- | --- | --- |
| lamp | leans from its base, bends and stops (4.5); flat down past 11 m/s; flickers 1-1.6 s and dies: its pool, its cone, its light, its mouth go out | the head: glass, sparks, the pop, a buzz back on, dark; the post: sparks | leaning, its base still stops a man; down, driven over (a bump) |
| pole | as a lamp (6, 13) | splinters | as a lamp |
| namesign, stop | bend over (2.5, 7) | a clang; the 3rd/4th bends it over | as a lamp |
| hydrant | off its stem (3): the head flies, a column of water for a minute (40 s full, then dying), rings on the wet | a fan of water out of the hole for 10 s | the head: kicked on |
| bin | knocked flying (1.2), lands, rolls | knocked over at the first | kicked on |
| callbox | over (3.5) | its glass at the first, then sparks; the 6th takes it over | a box: stops a man |
| bench | over (2.2) | splinters | a box; a bump |
| stall | over (1.8): its canvas torn off fluttering, its goods spilled and skidding | its goods jump and burst; the 6th takes it over | a box; slows a car (0.88) |
| newsstand | over (3): papers in the air | papers; the 8th takes it over | a box; a bump |
| crate | to planks and its fruit (0.8; a slow push tips it whole) | splinters; the 2nd breaks it | its pieces |
| fence | the panel down (1.5) | splinters; the 3rd takes it down | kicked on |
| awning | torn down by a tall thing (a lorry, the tram) | torn, its water dumped; the 3rd drops it | lies; no box |
| glass | a car's front into it bursts it | Glass's own: holes and stars, then gone | its shards (Glass) |

Every kind has its sound (`smash_*`, `city_bin`, `c3_post`, `clang`, `glass`,
`hydrant`, `zap`, `buzz`).

---------------------------------------------------------------------------
## 3. Cars (src/destruct/CarDamage.js): the rule for every car

Attached to every car in `game.vehicles.list` the step it appears (dropped,
everything put back, when it leaves): **O2 does nothing to get it**. What
it reads: `Car.js`'s contacts (`crash`, `scrape`, `bump`, `lean`, `post`),
`v.damage` (0 .. 4, Car.hurt) and the rounds.
- By where: a knock's point in the car's frame is its corner. Dents (the
  skin pushed in: `paint`, `chrome`, `dark`, `skirt`, `seams`, `trim` of
  `model.meshes`, each car's own copy), the headlamp out (a sedan's lens
  through world/Cars; any other: that disc of `meshes.lens`), a door
  hanging and swinging (a side hit), and at a hard blow (any speed) C3b's
  smash: the corner down on its broken spring and the body twisted onto it,
  the wing crumpled, the glass on that side and the screen (a sedan's
  panes), grains of glass on the road, the bonnet sprung (+0.5 of damage).
- The engine by `v.damage`: 1.5 steam, 2.5 grey smoke (power 0.8), 3.3 FIRE
  (flames at the bonnet's seams, black smoke, the fire light; power falling;
  `She's burning. Get out.` when it is mine, under the warning's rule) and
  7 s later (3 s from 4.0) the blast: `fx.explosions.blast`, `S.blast(at,
  7)`, cars within 6.5 m +1.4 damage, `game.onCarExploded` (Hoods, my
  health), then the WRECK: Wreck.js's burnt shell cut to the car's length
  and width, on its rims, twisted onto its worst corner, a Fire on it (in
  `stage.cars.fires`: the hot tick, the fire lights), frozen, solid, never
  driven again (`car.wrecked`: city.js offers no E). In it when it goes:
  `game.fail({ why: 'She went up with you in her.' })`.
- `Car.warnAt` is set to 3.3: one blow from below never wrecks it (the
  warning first).
- Tyres: a round within a wheel's reach flattens it: `grip` 0.35, that
  corner 9 cm down (`sagPitch` / `sagRoll`), a front one pulls the wheel
  (`v.pull` 0.04 rad); a rim on the road sparks.
- The tram: a car the tram meets (`bump`, `lean` from a car whose `kind` is
  `'tram'`) has sparks struck off it where they touch, the scrape and the
  clang; the shove and the dents are Car.js's contact.
- O2's new models: give them `model.meshes.paint` (and `lens`, `chrome`...)
  as children of `model.group` at the identity, and `spec.top`; a sedan's
  `v.car` (world/Cars) keeps its glass and lenses.

---------------------------------------------------------------------------
## 4. The caps and the budget

- `CAP` 140 items out of their merge at once; past it the oldest at rest
  that the eye does not see goes back standing (`recycle`), and every item
  more than 200 m from the eye is mended (the city mends out of sight).
- A pool per kind (one draw each, only while used): lamp 24, pole 8,
  namesign 16, stop 8, hydrant 24, bin 32, callbox 12, bench 16, stall 16,
  newsstand 8, crate 48, fence 24.
- The pieces (SmashPieces): planks 420, fruit 320, papers 200, canvas 24,
  glass 360, lids 24, iron 60; a full pool takes back the resting piece
  behind the eye, then the furthest. Nothing is made or freed after the
  build: memory flat (the memory play: 100 cycles of a hundred over and
  mended, geometries and textures unchanged).
- A step's own: 160 pieces made at most (a blast's last are not made), five
  smash sounds, twelve things reached by a blast's wave (the rest the step
  after); a full pool is searched 40 slots at a time.
- Water: two hydrant columns in full spate at most (95 drops/s each; the
  splash pool is 300); six jets.
- Fires: two roaring at once (a third blast sinks the oldest to embers).
- The first draw of every program the set and a blast use (the wreck's
  shell, the explosion's chunks, the glass's cracks, halo, shards and
  hairlines, every pool) is made in the stage's first steps, at a scale of
  nothing (`CarDamage.prewarm`, `Smash.warmPools`): the first blast was a
  100 ms frame, the first papers in the air 50 ms.
- Lights: none added. A leaning lamp moves its own cone and light while it
  flickers; a burning car borrows the fire light (`fxLights.fire[0]`); the
  blast borrows the muzzle flash's.
- Ink ids from the city's block (`city.ids`): nothing taken from the shared
  counter (the city's golden frames keep theirs).

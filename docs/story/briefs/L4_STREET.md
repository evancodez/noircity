# Lane 4 — street and city

Branch `wave-a/L4-street`, port 5184. You own `src/world/**` (except
`Cars.js` and the frozen `World.js`) and `src/stages/block/**` (except the
diner interior, `parts/diner*.js`). The block is the most loved thing in
the game. You make it a real place with edges, a city behind it, and a
diner on it, without disturbing what is accepted: the dark road, the thin
open el in the upper right, the lamp cones, the façade, the car
silhouettes, the towers behind the vanishing point.

All of this brief is required; the numbers are the order of work.

## 1. The diner's street front (`parts/dinerFront.js`; CONTRACTS §15)
The four ground-floor bays between the pilasters at z = 11.6 and z = -6.0,
a 1930s lunch-room front set into the stone:
- **Stall riser** under the windows: pavement to y 0.90, dark glazed tile
  with one thin steel trim line along its top.
- **Plate glass** in bays B1, B2, B4: 3.55 x 2.20 m (y 0.90 to 3.10) in
  slim steel frames; above each a transom band (y 3.10 to 3.40) of ribbed
  glass. Panes through `game.glass.addPane` with lane 1's glass material
  (`makeGlassMaterial({ wet: 1, side: 'out' })`; the stub is fine until the
  merge).
- **The door bay B3**: a recess 0.4 m deep with splayed side lights, the
  door leaf 0.95 x 2.15 m (glazed upper half, a push bar, a blind half
  drawn), hinged at z = 0.12, opening inwards when the player walks into it
  (and closing behind him; a collider that follows the leaf); a bell on a
  spring over it (`door.on('open', fn)`), the street number 714 on the
  transom.
- **The sign**: DINER in neon tube letters (accent `neon` from
  `src/render/accents.js`) on a dark fascia panel over B2 and B3, letters
  0.55 m tall, tubes 18 mm, a single tube underline, stand-offs, a
  transformer box and its cable. Every letter is a breakable of kind
  `neon`. The N buzzes and flickers (dark for 0.1 s every few seconds).
  The old vertical blade sign stays where it is, unlit.
- A rolled canvas awning on its bar under the fascia; a gutter along the
  fascia that drips a row of drops onto the pavement.
- **Light on the pavement**: through each window a soft patch of the
  diner's light falls on the wet pavement (lane 1's
  `makeWindowLightMaterial`), and the sign leaves a blue sheen.
- Walls and risers get real colliders; the only way in is the door.
- From across the street at night the room must read through the glass:
  the counter, the lamps, the people as dark shapes (the Hopper picture).
Presets: `dinerfront` (from the kerb opposite, the eye at (-1.5, 6.5)
looking at the door, fov 60), `dinerwide` (from the far pavement under the
el, (12, 9), looking at B2: the whole front, the floors above rising into
the rain), `dinerdoor` (2 m from the door, it opens).

## 2. Fix 6: the block has edges made of things
Today `colliders.setBounds` stops the player in open space. Replace every
metre of that with something real that a man cannot pass, each with a
collider, each registered as a solid for bullets. `setBounds` moves out
beyond them as a net nobody can reach.
- **South end** (behind the start, z = 30 to 36): road works. Two timber
  sawhorse barricades with storm lanterns (small lit lamps, tiny cones), a
  trench across the left lanes with a plank bridge chained off and a mound
  of cobbles and clay, a tar boiler breathing steam, a flatbed truck
  parked across the right lanes with its tailboard to us, timber hoarding
  closing the pavements, with torn bills on it.
- **East side** (x = 22, from z = 36 to z = -124): an iron railing fence
  2.6 m tall on a 0.5 m brick plinth, spear-topped bars at 0.13 m, brick
  piers every 8.8 m, one pair of locked gates (chain and padlock) near
  z = -30. It is see-through: the el's arches keep framing mist and
  skyline. Beyond it, a rail yard in the mist: freight wagons, a timber
  stack, a water tower, a signal gantry, at 6 to 25 m behind the fence, as
  flat dark shapes that fade with distance.
- **North end** (z = -118 to -126, under the el's crossing): the avenue
  goes on into the mist but cannot be walked: a pipe-laying job: two
  parked trucks nose to tail across the lanes, stacks of pipe sections, a
  compressor, barricades with lanterns, rubble between the el's columns.
  Low enough that the far lamps and the mist still show above it: the
  street view keeps its depth.
- **West side**: the building line, and every gap in it closed by a thing:
  the cross street at z = -24 to -30 is open for 14 m (the side alley of
  scene 3: keep it clear and leave the wall lamp of CONTRACTS §15) and then
  closed by a wire fence gate with a parked van behind it; other gaps get
  board fences, bins, a locked service gate.
Proof: `stage.part('bounds').perimeterTest()` (run it through
`tools/errors.sh "shot=street&probe=..."`): from 40 points inside the
block it walks outwards in 72 directions until stopped and returns, for
every stop, the tag of the collider that stopped it. No stop may be
`bounds`. Presets `boundS`, `boundE`, `boundN`, `boundW`: each barrier from
10 m.

## 3. Fix 5: the el must not pass through buildings
The el's curve crosses the avenue at z = -118 and then runs west through
the row of blocks on the left (from about z = -150 on) and ends in mid-air
at (-78, -264). Decide: either the blocks make way (a wide cross street
that the el follows, the buildings ending before it and beginning after
it, a station platform where it turns) or the far curve is re-laid so it
never meets a building and runs out of sight into the mist before it ends.
The near composition is accepted: do not move the curve for z > -118.
The train follows the curve; check its carriages' swept path as well.
Proof: `stage.part('overpass').clipTest()` returns every building, prop,
lamp and tower box that the deck, a column, the railing or the train's
swept path intersects, with a clearance of 0.6 m. It must return none.
Presets `elfar` (from under the crossing, looking along the far curve) and
`elplan` (a high oblique view of where the track leaves the avenue).

## 4. Fix 7: the city behind
Richer, more layered, more atmospheric, and still the reference's skyline:
flat, fogged silhouettes, lighter with distance, no line work.
- **Keep** the four rings of towers and the cluster behind the street
  view's vanishing point.
- **Add a roofscape** between 60 and 150 m, darker than the towers
  (display 0.22 to 0.28): tenement roofs with water tanks on stilts,
  chimney stacks with slow smoke leaning on the wind, skeletal billboard
  frames, a church spire, a gasometer's drum and lattice, laundry-line
  poles. Different from every side of the block.
- **A bridge** far off beyond the rail yard: one suspension tower, its
  cables, the deck, tiny lights crossing it now and then.
- **Life in the sky**: two searchlight beams sweeping the cloud base
  slowly from behind the towers (very faint); a beacon on the tallest
  spire that pulses every 2 s; low scud crossing the tops so spires come
  and go; veils of heavier rain drifting across the distance; lit windows
  in clusters, a few going on or off over a minute.
- Lightning silhouettes all of it in layers (nearest darkest).
Presets: `skyline` (from the middle of the block looking down the
avenue, fov 45), `skylineE` (looking east through the arches), `skylineT`
(`skyline&lightning=1`).

## 5. Fix 9: rooms behind the street's glass
- The ten other shop bays of the near building: each a real shallow room
  (3.5 m deep) with a few dark shapes that tell what shop it is: a
  tailor's dummies and bolts of cloth; a barber's chair and mirror frame;
  a pawnbroker's shelves of clocks and instruments; an empty shop with a
  ladder and tins; a florist's palms and urns; two with roller shutters
  down. Dark, lit only by what the street sends in.
- Their panes are see-through (lane 1's glass, dark tint, wet) and
  breakable (`game.glass.addPane({ ..., room })`).
- Upper floors: a pane that breaks shows a room, not a black sticker: a
  room box built when the pane goes (back wall, a door outline, a curtain
  edge, a lamp shade), or lane 1's `makeRoomMaterial` above the second
  floor.
Preset `shoprooms` (two bays from 4 m, one pane whole, one broken).

## 6. Street dressing that reacts (fix 10, with lane 3)
Place them, register them with lane 3's kinds
(`game.breakables.add(obj, { kind })`): drainpipes on the façade every
second pilaster (`pipe`), two hanging shop signs on brackets (`sign`), the
crate stacks and barrels (`crate`, `barrel`), the newsstand's papers, an
awning, overhead wires (`wire`), a steam pipe along the el's columns.

## Intended golden changes
The far distance and the east side in every exterior frame (skyline,
roofscape, fence, rail yard, the far el), and the near building's shop
windows. **Not** the road, the lamps, the near el, the cars, the figures,
the near façade's stone. Compare each changed frame with its golden at full
size: if the street view is not at least as good a picture as before, it
is not done.

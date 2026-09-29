# Lane 5 — interiors: the diner, and the prop library

Branch `wave-a/L5-interiors`, port 5185. You own
`src/stages/block/parts/diner*.js` and `src/props/**`. The game opens in
your room. The first frame the player sees is the counter under a lamp,
the smoke in its cone, rain on the glass, the street beyond. It has to be
as good a picture as the street is.

Dimensions and anchors are in CONTRACTS §15 and are binding (lane 4 builds
the street front to the same numbers; lanes 2, 6 and 7 stand people and
hands at your anchors). Your side of the wall is everything at x < -10.45.

## The picture (what the frames should look like)
- **Black room, pools of light.** Six pendant lamps over the counter throw
  six soft cones; where a cone meets the counter top it is paper white;
  between and beyond them the room falls off to black. The booths by the
  window are lit mostly by the street: a street lamp's light through wet
  glass, the rain's shadows crawling through it.
- **Depth in layers**: near, the counter edge and what is on it; middle,
  the waitress, the back bar; far, the jukebox at the end of the room, the
  windows, the street and the el outside.
- **Few lines, right lines**: a steel counter edge is one thin broken
  highlight; a row of bottles is a row of dark shapes with one tick of
  light each; upholstery is a dark mass with a few button dimples.
- No regular grids. No checkerboard floor, no tiled wall printed as graph
  paper, no evenly ruled anything.

## P0.1  The room
- **Floor**: dark linoleum, polished: it takes a soft, short, broken sheen
  under each pendant lamp (not a mirror); a lighter inlaid border line
  running 0.3 m out from the counter's base; scuffed paths; wet footprints
  and a wet mat inside the door.
- **Ceiling**: y 3.55, dark, plain; two ceiling fans turning slowly
  (40 rpm), their blades' shadows passing through the lamp cones.
- **Walls**: a dado rail 1.1 m above the floor, dark panelling below, a lighter wall
  above that goes to black toward the ceiling; the end walls carry a coat
  rack with two hats and a coat by the door end, and framed pictures as
  plain dark rectangles with a light edge.
- **Counter** (site plan): top 0.62 deep at world y 1.20 with a rolled
  steel edge; a dark front with a panel line; a brass foot rail on brackets
  at y 0.43. The top carries, at the player's place (stool 4): an ashtray, a
  pack of cigarettes, a lighter, a napkin box, a sugar shaker; elsewhere:
  plates, cups and saucers, cutlery, a pie case at the end near the door,
  the cash register at the far end (keys, a drawer that opens:
  `register.open()`).
- **Stools**: 9, chrome pedestals with a flared foot, round padded seats
  with a piped edge; each swivels (`stool(i).spin(impulse)`, friction
  brings it to rest), and is a breakable (`stool`) that can be knocked over
  (`topple`).
- **Back bar** against x = -17.0: shelves of bottles (a dozen silhouettes:
  squat, tall, square, flask) with the scotch among them at serve anchor 4
  (the only one with accent `amber` in it), stacked tumblers, cups on
  hooks, two tall coffee urns with gauges and spigots breathing a little
  steam, a menu board with four short lines (COFFEE 5, PIE 10, HASH 25,
  EGGS 20), a round wall clock at 11:40 whose second hand moves.
- **Kitchen hatch**: the opening of the site plan, bright behind (the
  kitchen is a lit box with a hanging pan rack seen as shapes), a shelf, a
  ticket rail, a bell (`bell.ring()`); the cook stands in it (lane 6),
  back-lit.
- **Booths** by the windows: high-backed benches, buttoned, a table
  between each pair (breakable `table`), on each a napkin box, an
  ashtray, a ketchup bottle; one window has its blind half down, and its
  slats' shadows lie across that booth (lane 1's window light with
  `slats`).
- **Jukebox** at the end wall: an arched 1930s cabinet 1.5 m tall: lit
  side pilasters and an arched lit top that print paper white and grey
  (no colour), a window showing the record and the arm. `jukebox.play
  (slot)`, `.next()` (the arm lifts, the mechanism turns, a new record, 2 s
  of clunks), `.hit(power)` (the record skips; at the third hit it goes
  dark for a second and starts another record). It is a breakable of kind
  `jukebox`.
- **Pendant lamps**: enamel cone shades (0.34 m across, dark outside,
  white inside) on cords, heads at y 2.60, through `stage.lamps.addCustom`
  with `real: true`: they borrow the pooled spot lights, so add no lights
  of your own. They can swing (`lamp.swing(impulse)`), flicker and be shot
  out like the street's.
- The dry volume and the interior Look (CONTRACTS §9.1: fog very low,
  `rainOverlay` 0, `haze` 0.6, exposure so that a lamp pool on the counter
  prints white and the floor between lamps prints near black).

## P0.2  The part's API (lanes 6 and 7 call these)
```
const d = stage.part('diner')
d.anchors             every anchor of CONTRACTS §15, also as stage.anchor('diner.*'):
                      stool.1..9, stool.player, serve.1..9, booth.1..4.a/b (seats), hatch,
                      jukebox.front, door.in, door.out, ring.centre, urns, bar.scotch,
                      till, window.B1..B4 (inside face centres)
d.stool(i)            { object, spin(impulse), topple(dir), upright() }
d.items               Map name -> Object3D for what stands on the counter
d.place(kind, anchor | Vector3, { name }) -> Object3D      d.take(name) -> Object3D (removes it)
d.jukebox  d.bell  d.doorBell  d.register  d.clock  d.fans  d.lamps[]
d.cupsRattle(strength, seconds)   cups, saucers and glasses tremble, rings spread in the liquids
d.lampsDip(depth, seconds)        a power dip: the pendants sag to `depth` and recover
d.trainPass(seconds)              the el train outside: light bars sweep the room from the
                                  windows across the booths, the floor and the back bar,
                                  one per carriage; cupsRattle with it
d.reset()                         everything back in its place (a retry, a preset)
```

## P0.3  The prop library (`src/props/**`, CONTRACTS §8.1)
Every kind in the contract's list, each smooth and right at 0.3 m in the
hand, each with `grip`, `rest`, `size`, and ink ids of its own where a
contour should separate parts. The ones the camera will be closest to:
- `tumbler`: 8.5 cm tall, 7.5 cm across, a thick base (1.4 cm), straight
  wall with 10 shallow cut flutes in the lower half; the liquid is a mesh
  of its own with accent `amber`; `userData.setFill(0..1)` (full is 40 %
  of the height: a double), a meniscus that tilts with the glass
  (`userData.setTilt(quaternion)`).
- `bottle` (variants `scotch`, `rye`, `gin`, `beer`, `ketchup`, `milk`):
  the scotch is a squat-shouldered bottle 28 cm tall with a paper label (a
  few dark marks, no readable text needed), a cork stopper, accent `amber`
  inside to its fill line; `setFill`.
- `cigarette` (8 cm, a paper tube, a tip that can be `unlit`, `lit`
  (accent `ember`), `ash` (a grey ash end that grows and falls)),
  `cigarettePack` (soft pack, torn open, two cigarettes standing proud),
  `lighter` (a flat flip-top petrol lighter: `userData.setOpen(0..1)`, a
  wheel, a wick; the flame is lane 3's / lane 1's, not geometry),
  `matchbook` (red cover: accent `crew`; a black bird on it; THE CARDINAL
  in small capitals; it opens: `setOpen`), `wallet` (opens like a book; a
  licence card behind a window: a photograph as a dark oval, three short
  lines, the words PRIVATE INVESTIGATOR).
- `plate`, `cup`, `saucer`, `mug`, `coffeePot` (a glass globe pot with a
  dark band and handle, coffee inside near black), `pie`, `ashtray` (cut
  glass, with butts), `stool`, `napkinBox`, `sugar`, `menu`,
  `newspaper` (folded; a headline as three heavy bars), `fork`, `knife`.
Preset `propsheet`: every kind on the counter under a lamp in two rows,
0.6 m from the eye; `propsheet&kind=<k>` one prop filling the frame.

## P1  The room is alive
The coffee urns breathe; the clock runs; the fans turn; the register's
drawer; the door's bell; a fly-paper ribbon turning by the hatch; drips
from the coat on the rack; the jukebox's record turning; cups that rattle
and liquids that ring when the train passes; a pie under the glass.

## P2
Wave B rooms are not yours yet. If everything above is finished and
looked at: a rest room door with a lit gap under it, a pay phone on the
wall by the jukebox, a cigarette machine.

## Presets you must deliver
`diner_seat` (the player's view from stool 4 looking at the back bar, the
eye at world y 1.60, fov 68), `diner_left` (from the stool, looking down the
counter toward the door and the windows), `diner_right` (toward the
jukebox), `diner_wide` (from the door end, standing, the whole room),
`diner_booth` (from a booth looking at the counter), `diner_out` (from the
stool looking straight out through the glass at the street), each also
with `&train=1` (mid pass) where it shows.

## Intended golden changes
None. The diner is behind every existing camera. If an existing frame
moves, something of yours leaks (a light, a shadow, an id): find it.

## Performance
The room adds no real lights. Instanced where repeated (bottles, cups,
stools). Standing in `diner_wide` with the cast in place: 60 fps.

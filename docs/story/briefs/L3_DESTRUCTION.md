# Lane 3 — destruction

Branch `wave-a/L3-destruction`, port 5183. You own `src/fx/**` (with
`React.js`), `src/destruct/**` and `src/world/Cars.js`. Everything that
breaks, bursts, burns, spills or falls is yours. The world must answer a
bullet and a fist with something worth looking at, every time.

## P0.1  Fix 4: cars

### Damage is a bullet count, never a timer
Remove the fuse. A car blows on the round that takes it past its limit.
- Each car has a limit of `26 +- 3` points (seeded per car).
- A round into the **body** counts 1. Into the **engine bay** (local x >
  0.6, under the bonnet line) 2. Into the **fuel tank** (the rear, local x
  < -1.55 and y < 0.95) 3. Glass, lenses and tyres count 0.5 and keep
  their own effects. A Hood's stray round (`weak`) counts 0.15.
  So: about 26 rounds anywhere, 13 into the engine, 9 into the tank: two
  to three seconds of the Tommy gun, and I can catch a man beside a car.
- **Warnings, by count, not by clock**: at 40 % grey smoke from the bonnet
  seam (or fuel dripping and a dark pool growing under the tank if the
  tank took most of it); at 75 % the smoke goes black and thick, a small
  flame licks at the seam, the Hoods using the car as cover relocate. A
  smoking car left alone just smokes.
- The blast still kills within about 5 m, hurts the player within 8 m,
  and chains: a blast within 6 m adds 12 points to a neighbouring car.
- The limit of burning wrecks for the frame rate stays (2 roaring at
  once): a third blast is allowed, the oldest fire dies down to embers.

### Three or more kinds of explosion, chosen by the killing round
A. **Bonnet**: (killing round in the engine bay) the bonnet tears off and
   spins up 6 to 8 m, the fireball goes up and forward, the front wheels
   splay, the car drops onto its nose.
B. **Tank**: (in the tank) the rear lifts a metre and slams down, a low
   fireball rolls out backwards along the ground, the boot lid flies,
   burning fuel spreads on the wet street as a sheet of low flame 3 to 4 m
   wide that burns 12 s (it lies on the water; it reflects).
C. **Cook-off**: (anywhere else) the windows blow out one after another in
   0.4 s, the doors burst open, fire stands up through the roof, and a
   second, larger blast follows 0.5 s after the first.
D. **Roll** (one in six of any kind): the blast is under the chassis; the
   car jumps, rolls onto its side and burns there.
Each has its own debris (bonnet, boot lid, a door, a wheel that rolls away
burning and falls over), its own flash shape, its own smoke. All keep the
ink rules from Phase 3: the fireball is ink with a white-hot core, never a
bloom aura; chunks print black against the flame.

### The burnt wreck, rebuilt
Today's wreck is the intact body painted black: it prints as a lump (see
`shots/golden/wreck_t40.png`). Build a wreck that reads as a burnt-out car
from 40 m, by its **silhouette**:
- the same length, width and wheelbase as the sedan (4.9 x 1.8 m);
- **you can see through it**: no glass, the window openings are holes
  with the fire or the mist behind them; roof pillars thin and bent;
- the roof sagged 8 to 12 cm between the pillars; the bonnet gone (A) or
  peeled up and back; the boot lid gone (B); one door hanging open on
  its lower hinge, another missing;
- inside, in the openings: the seat frames and the steering wheel's
  ring as thin black line work;
- **on its rims**: the tyres are burnt away, the car sits 9 cm lower, a
  few ribbons of tyre hanging from the rims, the front axle down on one
  side (3 degrees of list);
- char black, matte, with pale ash-grey dry-brush along the top edges and
  a few embers (accent `ember`) crawling on edges for the first 40 s;
- a variant per explosion kind (nose down, tail collapsed, gutted, on its
  side).
Proof: `wreck&t=<s>` for each kind (`wreckkind=A|B|C|D`), at the blast,
+0.3 s, +5 s, +40 s; and `wreckstudy`: the four wrecks side on, 8 m away,
under a lamp, with no fire (the silhouette alone must read).

## P0.2  Fix 9: glass that shatters properly (CONTRACTS §8.3)
- **First round**: a hole with a star of cracks: 6 to 9 long radial cracks
  that run to the frame or to another crack, a few short ring cracks
  between them, a white frosted halo around the hole.
- **More rounds**: more stars; where cracks enclose a piece, the piece
  falls out, leaving a hole with jagged edges.
- **Enough of them** (or a body, or a blast): the pane goes. The pieces
  are the pieces the cracks drew: large shards at the edges that tip out
  and fall, slivers, a shower of bits; they flash paper-white as they turn
  in the light, land, slide, break again, and lie on the ground (some
  stay). Teeth of glass stay in the frame.
- Pieces are real geometry cut from the pane (a seeded Voronoi of the
  pane's rectangle, grouped into shards along the crack lines), not a
  decal and not camera-facing sprites.
- It works on the façade's windows, the shop windows, the diner's plate
  glass (3.55 x 2.2 m, the big one), the phone booth, the cars, the pie
  case.
- Behind a broken pane there is a room (lane 4 and lane 5 build them). Give
  lane 4 what it needs: `pane.on('state', fn)`.
- `glass.shatter(pane, { dir, power })` for a man thrown through the
  window: the whole pane bursts outwards around a man-sized hole.
Proof: `glassstudy2&hits=1|4|12|all`, and `windowman` (the diner's end
bay bursting outwards at the moment the brawler goes through it).

## P0.3  Breakables for the fist fight (CONTRACTS §8.2)
Each kind breaks in its own way, leaves its own mess, makes its own sound
request (`game.sfx.play?.('break_<kind>', pos)`; lane 7 builds the sounds).
- `bottle`: breaks at the shoulder; the neck stays in the hand as a
  jagged weapon; the liquid bursts and runs (accent `amber` for whisky).
- `plate`, `cup`, `saucer`: 5 to 8 wedge shards; a plate thrown flat
  shatters on the man, the bits rain down.
- `tumbler`: heavy base survives, the wall goes to bits.
- `stool`: the seat comes off the column; the column bends; the base
  rolls in an arc. `breakables.topple` makes stools fall and roll when a
  man goes into a row of them (each knocks the next).
- `table` (booth): splits along its length, the halves fold in.
- `pieCase`: its glass shatters (as panes do), pies slide out.
- `jukebox`: never destroyed; a hit dents it, its lights stutter, a
  shower of sparks at the third hit.
- `liquid`: spilt liquid spreads on a counter and runs off its edge in a
  thin stream, pools on the floor.
- The pour: `fx.pour.start({ from: Object3D, to: Object3D, accent:
  'amber', rate })` / `.stop()`: a thin stream from a bottle's mouth to a
  glass, swaying a little, the splash inside the glass.
- Cigarette smoke: `fx.cig.wisp(tipPos)` (a thin thread rising from the
  tip, curling, breaking up at 0.5 m) and `fx.cig.exhale(mouthPos, dir)`
  (a soft plume 0.6 m long that slows, rolls and rises into the lamp
  cone). Grey, brushed, never a sprite blob.
- Fist impacts: `fx.hit.punch(pos, dir, power)`: a small white ink burst
  (the jagged splatter family of the muzzle flash, 2 frames), sweat
  drops, at power > 0.7 a few drops of blood (accent `blood`), never a
  fountain.
Proof: `breakstudy&kind=<k>&t=<s>`: each kind breaking, at contact and
0.4 s later and at rest.

## P1  Fix 10: the street answers bullets
- **Stone**: chips fly, a pale crater with a dark core stays; a corner of
  a pilaster or a kerb loses a chunk after a few hits.
- **Metal** (cars, cans, the newsstand, the el's columns, drainpipes):
  a dent with a bright edge, sparks that bounce and die, a ring.
- **Signs**: a hanging sign swings on its brackets when hit, slows, stops;
  a bracket can be shot through and the sign drops to hang by one corner.
- **Pipes**: a drainpipe bursts: a fan of water that weakens to a dribble;
  a steam pipe: a white jet with a hiss for 4 s.
- **Props**: a stack of crates topples; a barrel rolls and leaks; papers
  fly up from the newsstand and drift down wet; awnings tear and dump
  their water.
- **Wires**: a cut wire falls, swings and spits sparks.
- **Neon** (kind `neon`): a letter hit goes out with a pop and a fall of
  glass and sparks; its neighbours flicker.
Lane 4 places these things and registers them with your kinds; build your
own test objects in `breakstudy` so you depend on nobody.
Proof: `havoc` (the existing preset) richer, and `streetstudy`.

## Intended golden changes
`wreck_t2.9 wreck_t3.1 wreck_t3.4 wreck_t8 wreck_t40 havoc battle_t15
battle_t30 battle_t45 perf end impacts`. Everything else identical.

## Performance
Particles and pieces are pooled and capped; a wreck plus a broken diner
front plus 12 Hoods holds 60 fps. Report the fps preset before and after.

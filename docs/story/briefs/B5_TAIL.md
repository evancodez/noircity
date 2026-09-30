# B5 — Scene 7, The Tail (`tail`): the chase by car, and the question

Read `docs/story/WAVE_B.md` first: it is the standard and the way of
working. This scene, and everything driven in the game
(`src/vehicles/**`), is yours end to end. Branch `wave-b/B5-tail`, dev
port 5315. Music slot `tail`.

## The place: a new stage, `riverroad`
About 1.3 km of wet road at night, mostly straight with gentle bends. The
el's iron columns march down one side (the train goes over once); on the
other a railing and the river: black water, far lights, a moored hull.
Warehouses, a market stretch (stalls under awnings, fruit crates, barrels),
a newsstand on a corner, board fences, hydrants, lamp posts with their
cones in the rain. Built for speed: repeated pieces, one ink id per thing,
nothing drawn that the headlamps and the lamps do not reach.

## The car (the feel is the scene)
First person from the driver's seat of a 1937 coupe:
- **The frame**: the long hood and its ornament, two pools of headlamp
  light sliding over the wet road, the dashboard's lit dials along the
  bottom (the speedometer's needle moves), the wheel with both my hands on
  it (the wheel turns; the hands go with it: object first; a hand set of
  your own in `src/player/clips/`), the windscreen with rain on it and
  **the wipers sweeping it clear** in two arcs, the pillar and the side
  window's edge. The mouse looks a little (the eye turns, the car does
  not).
- **Arcade driving**: W throttle, S brake, A / D steer. Quick off the
  line, 90 to 100 km/h flat out and it must feel like it (the lens, the
  road's marks, the rain's streaks, the engine's note, the wheel's
  shake). Steering is light and sure at speed, the tail steps out a little
  on the wet when thrown about and comes back. It never spins out on its
  own and never stops dead: a wall is a glancing scrape with sparks and
  lost speed; only a column or a truck head-on stops me, and then I am
  rolling again in a second.
- **Going through things is the fun**: fruit crates, stalls, barrels, the
  newsstand (a cloud of papers), fences, a hydrant (the geyser): they
  burst over the hood with almost no speed lost (the breakables system),
  and what is left lies where it fell.
- **Sound**: the engine (pitch with speed), tyres on wet, the wipers,
  every kind of thing hit, the el going over.

## The beats
1. `start` — In my car at the kerb (where lane B4's scene ends), his red
   tail lamps (crew) already small down the road. The engine catches. One
   prompt: **W drive**.
2. `chase` — The tail. His sedan follows the road on a path with a rubber
   band: twenty-five to sixty metres ahead, closer as the scene goes on.
   He swerves through the market and sends things into my road. Once, a
   truck pulls out of a side street (swerve); once, headlamps come the
   other way. About ninety seconds.
3. `close` — Past a marker on the road he can be caught. Within thirty
   metres, one prompt: **RMB aim, LMB fire**. RMB: my left hand puts the
   revolver out of the window (the prop `buildProp('revolver')`, lane B3's;
   until it merges, a stand-in of your own), the view leans out with it,
   the mouse aims, A / D still steers. LMB fires (the weapon's bullet path
   and sound). His rear window stars and goes, a lamp goes out, sparks off
   the trunk.
4. `shot` — A rear tyre (a generous target; by the fourth or fifth good
   shot it goes regardless): it bursts, he fishtails, spins, and goes
   side-on into a lamp post. The post bends, its lamp swings and stays
   lit. Steam, the horn stuck and then dying, one tail lamp still red.
5. `crash` — I stop beside it (if the player does not brake, the car
   brakes itself over the last metres, eased). **E get out.** He crawls
   out of the door and tries to stand (the `watcher`, lane B4's; stand-in
   `couple_him`).
6. `interrogate` — **E**: both my hands take his lapels (object first:
   the coat moves, the hands are on it) and put him against the car: a
   thud, the view's kick. His face is a bowler's brim and rain running off
   it. There is one question and I ask it with a look: the river is three
   metres away behind the railing. As the mouse turns my eyes to the
   water, I walk him to the rail and bend him back over it. He breaks:
   subtitle, **"Pier nine."** If the player only stares at him, he says
   nothing; after a while a small prompt: *look at the river*. I let go;
   he slides down the railing. `yield* ctx.next()`.

## The rules under it
- Failing is soft: if he gets more than ninety metres ahead for five
  seconds, or I wreck badly, black and back to the last marker (three on
  the road).
- The player's car and his are `game.vehicles` (replace the stub that
  throws; keep its documented shape where it makes sense). Driving is a
  controller mode of your own (`src/player/modes/drive.js`).
- The Hoods and the wave game are not in this stage.
- Sixty frames a second at speed: this is the heaviest moving frame in
  the game. Measure in the market stretch.

## Play and proof
`tools/plays/tail.json` (`?start=tail`) by real input: drives the road,
closes, aims, fires, the crash, the question. Strips: pulling away, a
stall going over the hood, the wipers' sweep, the gun going out of the
window and a shot, the spin into the post, the lapels and the walk to the
rail. Frames: the cabin at rest, at speed under the el, the market, the
gun out, the wreck, the man over the rail.

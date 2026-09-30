# B7 — Scene 9, The Block (`shootout`), and the ending

Read `docs/story/WAVE_B.md` first: it is the standard and the way of
working. This scene and the game's ending are yours end to end. Branch
`wave-b/B7-shootout`, dev port 5317. Music slots `shootout`, then `end`.

This is where the game began: the Tommy gun, the Hoods, the block in the
rain. The user's measure of "premium" is that first shooter. Everything
that made it feel right is still in the code (the gun, the Hoods' hit
reactions and deaths, blood, impacts, casings, the cars that burn and
blow, the lamps that can be shot out, the glass). Your job is to stage it
as a story: men who arrive for reasons, in ways the player sees coming,
from directions that make him move.

## The place
The block, the diner. The window Mack went through is still out; rain
comes in over that booth. Dot is alone behind the counter; the others are
gone, a newspaper left on a table, a cup still steaming.

## The beats
1. `arrive` — I come in from the street (the scene opens inside the
   door). One line, mine: **"They're coming here."** Dot brings the Tommy
   gun up from under the counter and lays it on the counter top with two
   drums (her clip, authored with the gun as the object). **E take it**:
   my hands take the gun off the counter (object first) and it comes up
   to the shoulder as it always did. A second prompt, optional: **E the
   lights** at the switch by the door: the room goes dark, and men
   outside shoot worse at what they cannot see.
2. `cars` — Headlamps swing across the windows and through the room. Two
   cars brake hard at the far kerb, nose to tail; doors open; six men get
   out behind the doors and fire over them. The diner's glass goes, pane
   by pane (the glass system), bottles on the back bar burst, a pendant
   lamp is shot down, stuffing comes out of the booths. I fire from the
   counter's end, the window sills, the door frame. The cars take
   bullets: tyres, glass, and by the count they burn and blow, taking
   whoever stays behind them.
3. `doorways` — Four from the doorways across the street, moving up
   between the lamp posts and the parked cars; one of them comes round to
   the diner's door and in: a close one, heard on the step first.
4. `el` — A gunman on the el's walkway firing down through the broken
   windows (his muzzle flashes up in the iron, the rounds chewing the
   counter). Hit, he goes over the rail and down onto a car roof.
5. `driveby` — A car that does not stop: fast down the avenue, a man
   firing a Tommy gun from its window along the diner's front. It can be
   killed on the pass (the driver, the engine: it goes into a hydrant or
   a lamp post and burns); if not it turns at the end of the block and
   comes back once.
6. `cardinal` — A quiet, long enough to hear the rain. Then a long black
   saloon rolls up slowly and stops in the middle of the street, under
   the lamp. Two heavies with Tommy guns. Then him: wide, slow, a
   homburg, an overcoat with a fur collar, a cane, a cigar (cast kind
   `cardinal`, yours: the best silhouette in the game, readable at forty
   metres). He does not run and does not hide; he walks at the diner
   behind his two men with a pistol in his free hand. He takes a great
   deal of killing, and shows it: the hat stays on, the walk slows, a
   knee goes.
7. `end` — He falls in the street. His hat rolls, turns, and settles in
   the water; the cigar lies beside it, its ember still lit (the one
   accent in the frame), the rain hissing on it. I walk out to it (the
   player does; the gun lowers by itself). The el train goes over. Behind
   me Dot's shape stands in the broken window. Hold the frame six
   seconds, cue `end`, then the end card (`hud.showEnd({ kind: 'end' })`).
   After the shootout the game stops: no credits, no restart loop beyond
   what the card already offers.

## The rules under it
- Place the men with the director (`d.spawn` with `entry`, `post`,
  `leash`, `wake`, `aim`, `hp`: `docs/story/seams/Y.md`), each beat
  started by the one before it being nearly done (one or two men left),
  so it builds and never waits. Twelve Hoods alive at most.
- The arriving cars, the drive-by and the saloon are the block's car
  model moved on rails of your own, with doors that open (in your own
  files; an added export from `Cars.js` at most). They must sit on the
  road, turn their wheels, dip on the brakes, and be shot like any car.
- Ammunition: the drums on the counter; Dot slides more up when I come
  back to it (**E**). She keeps down otherwise. She cannot be hurt.
- Dying is ten seconds: black, back at the start of the beat I was in,
  with the damage done to the room so far left as it was.
- Four to six minutes for a first-timer. It must get louder and wilder
  beat by beat and then go quiet before him.
- Sixty frames a second through the worst of it (the cars beat with all
  the glass going): measure there. Fire, glass and twelve men at once is
  the heaviest the game gets.

## What makes it premium
- The player is never shot by someone he had no way to know about: every
  arrival is seen or heard first (headlamps, an engine, feet on the step,
  a muzzle flash before the second burst lands).
- The room is wrecked by the end and every broken thing came to rest.
- The last frame is a panel from the reference: the wet street, the
  lamp's cone, a hat, an ember.

## Play and proof
`tools/plays/shootout.json` (`?start=shootout`) by real input, with an
aiming player at a human's pace that wins most runs. Strips: Dot bringing
the gun up and my hands taking it, the cars arriving and the doors
opening, the man off the el, the drive-by's crash, the Cardinal's walk
and his fall, the hat settling. Frames: the diner dark with the headlamps
crossing it, the height of the cars beat, the el gunman's flashes, the
saloon under the lamp, him walking, the last frame.

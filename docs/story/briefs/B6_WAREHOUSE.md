# B6 — Scene 8, Pier Nine (`warehouse`): in the dark

Read `docs/story/WAVE_B.md` first: it is the standard and the way of
working. This scene is yours end to end. Branch `wave-b/B6-warehouse`, dev
port 5316. Music slot `warehouse`.

## The place: a new stage, `pier9`
- **Outside**: the pier's gate, PIER 9 in tall letters on the shed, black
  water, a freighter's hull and one riding light, my car left in the
  dark. Twenty metres to a side door.
- **The shed**, about 30 x 45 m: aisles between crate stacks two and
  three high, seven or eight hanging lamps with their cones in the dust
  (some on long flexes, one swinging), and black between the pools; a
  truck half loaded; a knife-switch panel on a column; a chain hoist with
  a load hanging.
- **The mezzanine** along the back wall: iron stairs, a catwalk, the
  office: a lit window with blinds, a door with a glass panel.
- **The loading bay** on the water side: a clear 5 x 6 m of floor
  (`pier9.bay.centre`, `r` 2.4), two plank loading doors over the water
  three metres apart (`pier9.bay.finish.1`, `.2`: a man can be put through
  them), and at least five things in reach that can be picked up (a crate
  lid, bottles, a cargo hook, a coil of chain, a lantern), each a prop or
  a breakable by the usual calls. The way out of the scene goes through
  the bay. A second fist fight will be staged here after your lane
  merges; build the room for it, not the fight.

This is the scene where the reference's rule (light as cones, black
everywhere else) is also the game's rule. Compose it from the door: the
pools down the long aisle, the lit office small and high at the end.

## The game: stay out of the light
No meters, no icons. Three things tell the player everything:
- **My hands.** In this scene they ride low in the frame (a set of your
  own). In light they print paper white; in the dark they are ink. That
  is the exposure (`game.exposure.player`), shown.
- **Their torches.** Every man on the floor carries a torch or a lantern,
  and its cone is what he can see: if his light is on me, he sees me;
  standing in a lamp's pool, he sees me from wherever he is looking my
  way. In the dark and out of his beam I am safe to within three metres.
- **Their bodies.** Calm: he walks his round, stops, moves on. Curious:
  he stops, his head and then his light come round to where he heard or
  glimpsed me, a low sound; it takes one to two and a half seconds to
  become certain (longer in the dark, shorter in a pool), and I can get
  out of it. Searching: he walks to where I was, looks about, gives up.
  Alarmed: a whistle, they all come.
  Caught is a cosh from behind: black, back at the last checkpoint
  (three: the door, the hoist, the stairs). Never further than thirty
  seconds.

What I can do:
- Walk (quiet within three metres of a man), **C** crouch (silent, lower,
  slower; the hands lower with me), run (heard at eight metres).
- **The switch**: **E** kills a row of lamps. A man walks over to put it
  back, which takes him off his round for twenty seconds.
- **The chain**: **E** lets the hoist's load down with a crash at the far
  end of an aisle: two of them go to look.
- **A bottle**: **E** picks one up, hold **LMB** to aim (an inked arc),
  let go to throw: it breaks, the nearest men go to the sound.
- **From behind**: **E** on a man who has not noticed me puts him down
  (one short blow, he folds; I lower him, not drop him). A man found
  lying starts a search. Build this after the rest plays well.
- The revolver stays in the coat: a shot here brings the whole pier.
  (If the player tries: my hand goes to it and comes away.)

Five or six men: dock hands in flat caps and short jackets with cargo
hooks at their belts (cast kinds of your own on the `docker`), two Hoods
by the stairs. Their rounds are designed, not random: there is always a
readable way through for a player who watches for ten seconds, and a
faster one for a player who uses the switch, the chain or a bottle.

## The beats
1. `arrive` — outside, the rain, the side door. One line of mine as a
   subtitle is allowed, none is better.
2. `floor` — the first aisle: teach by the first guard walking past the
   door's pool as I come in (one prompt: **C crouch**).
3. `lamps` — the middle: the switch and the chain are here, shown by
   their place in the light.
4. `stairs` — the two Hoods at the foot of the stairs: a bottle, or the
   dark side of the stairs.
5. `listen` — on the catwalk under the office window. Through the blinds:
   the Cardinal (kind `cardinal`, lane B7's; until it merges a wide
   stand-in; he is a back-lit shape behind slats, a homburg, a cane, the
   cigar's ember the one accent), and two men. Three subtitles, slow:
   **"The diner. Tonight."** / **"The waitress saw Mack talk."** /
   **"No one leaves."** He comes to the window and looks down at the
   floor: I must be down (**C**) and still, or it is the alarm.
6. `out` — the way I came is shut (the truck has backed against it).
   Along the catwalk, down the far stairs, through the loading bay and
   out of its side door to the pier. `yield* ctx.next()`.

## What makes it premium
- It is fair: I am never seen by a man I could not have known was
  looking. Their lights and bodies are the whole language; if a player
  needs text to understand why he was caught, the language failed.
- It is tense without being slow: crouch-walking is not a crawl, the
  scene is four to six minutes for a first-timer, and being bold with the
  tools is faster than waiting.
- The men are ink shapes behind their lights: a torch's cone in the
  dust, a silhouette against a far pool. Their walk and their turn of the
  head are the animations that matter here.

## Play and proof
`tools/plays/warehouse.json` (`?start=warehouse`) by real input: a route
that uses the switch and a bottle, reaches the window, hears the order,
gets out; and a second play that walks into a beam and is caught and
restarts. Strips: a man turning curious and giving up, the bottle's throw
and the heads turning, the switch going and a man walking to it, the
blow from behind. Frames: the pier, the view from the door, my hands in
light and in the dark (side by side), the stairs, the office window with
his shape, the bay.

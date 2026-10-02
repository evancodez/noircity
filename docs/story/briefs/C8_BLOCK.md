# C8 — chapter VIII The Block: the diner in the nick of time, the street, the Cardinal

Branch `wave-c/C8-block`, port 5348. You own the shootout scene
(`src/scenes/*_shootout.js`, `shootout/*`), the block's use in it, the
`cardinal` kind, Dot's part in it, the ending. It is built on lane C2's gun
kit (`docs/story/seams/GUNS.md`, `?start=guns`) and may use lane C3's city
and car for the way there.

Read `docs/story/WAVE_C.md` (all), `docs/story/seams/Z.md`,
`ARCHITECTURE.md` §10 (scene IX as built: the rig, the rails, the cars),
the old lane's report `docs/story/reports/wave-b/B7.md`.

## What the user said
- **[must]** Danger at the diner; I arrive just in time; the waitress
  twist (I had come to think she was with the Cardinal; in fact they are
  after her; she is the one who arms me for the end).
- **[must]** The street shootout gets strategy: cover and other
  mechanics. "Today I just stand and shoot, and it is neither hard nor
  fun."
- **[must]** Cars never pass through cars. Men come into the frame in a
  natural way. The head man is fun to take out and not so trivial, not
  just a bullet sponge.

The frames of this chapter are the reference already (the diner's windows
going, the cars' lamps through the rain). Keep the pictures. Rebuild the
play under them.

## 1. Getting there
The still `theDiner` (WAVE_C §5). If lane C3's city has the avenue to the
block (`city.diner`) and it plays well, a short hard drive back first
("Get to the diner.": forty to sixty seconds, the saloon's red lamps
ahead of me and gaining, the driving the player already knows, a wreck or
a wrong turn costing time I can see I do not have); if it does not make
the game better, cut it and keep the still. Do not spend more than a
fifth of the lane on it.

## 2. The nick of time ("Dot.")
I come on foot the last metres, unarmed (the foreman's hook put my
revolver in the river). Through the plate glass: the room lit, the stools
empty, **a man with a gun on Dot at the back bar**, another at the door
looking out at the street the other way. Design it so that there is more
than one way and each uses what the game has taught:
- round by the alley and the kitchen's back door, low (C), behind him,
  **E** from behind as at the pier;
- a bottle from the bin thrown through the far window (the pier's throw):
  both heads turn; then in;
- straight in at the door: the bell rings, he turns: I have one second
  to be on him with my fists (a jab stops a gun hand: one blow, not a
  brawl) or I am shot.
The warning is in the room (he cocks the gun; "Last time, sister."); too
slow or seen: the shot, "Too late." (`game.fail`), back at the kerb. An
idle player loses.
Then the turn: **she reaches under the counter and lays the Tommy gun on
it in front of me**, and two drums (Dot's clips exist). One line at
most. The player takes it (E). She is the one who arms me. No still here
unless it earns it: the picture is the game's own frame.
Headlamps swing across the windows.

## 3. The street: a fight with choices
"The diner. Hold it." Then the objective changes with the fight.
The player may fight from anywhere on the block that is real: behind the
counter (hard cover), in the booths (thin: chewed), at the door, out on
the pavement behind the parked cars (the engine end stops rounds, the
doors do not), the el's columns (steel), the newsstand, the alley's
mouth. Every edge of the block is a real thing (shut shops whose doors
rattle, a parked truck, roadworks, the el's stair gated).
What makes it strategy (the gun kit's rules, used by the place):
- **Cover is spent**: the diner comes apart round me as built (the
  windows, the pie case, the booths): now it matters, because what is
  shot away no longer hides me. I have to move.
- **They come from more than one side**, as men would: out of cars behind
  their doors and across to cover; from the doorways across the street;
  **round by the alley to the kitchen door** (the flank: the back door's
  crash, Dot's one word: "Kitchen!"); a gunman on the el's stair or deck
  (high: the counter does not hide me from him; a column does).
- **Kinds that ask different things**: pistol men (cover to cover), the
  Tommy gunner (he pins the diner's front: down until his drum is out),
  the rusher who comes for the door, and one new to this chapter if it
  plays: the man with a bottle of fire (he must be dropped before he
  throws, or the booth I am in burns and I must leave it: `fx/Fire.js`
  exists).
- **The street's own weapons**: a car's tank or its engine shot until it
  burns and goes (`fx/Explosion.js`, the wrecks: as the first version of
  this game had), taking the men behind it; the room's light switch (in
  the dark they cannot find me until I fire); the hydrant.
- **Ammunition is a decision**: drums are few; Dot slides one when I call
  for it at the counter (E), which means going back to the counter. The
  Tommy gun sprays: bursts hit, a held trigger climbs.
- **Dot is in it**: behind the counter she is safe from the street but
  not from a man who gets inside: if one does, I have a few seconds
  (her cry, the objective) to put him down: a second way to lose that
  the player can see coming, used once or twice, not a constant escort
  duty.
The movements come as the story, with a checkpoint at each, the count
kept to what reads (four to six men alive at once, about twenty in all):
the two cars; the doorways and the flank; the el and the drive-by; then
him.
**[must] Cars never pass through cars**, or through anything: every car
in this chapter is solid to every other car, to the wrecks, the columns
and the men (a car that arrives when the kerb is taken stops behind or
alongside, or shunts the wreck; the drive-by has to steer round what is
in the road, and if it cannot, it stops and they get out). If lane C3's
vehicles do this already, use them in place of the rails.
**[must] Men come into the frame in a natural way**: out of a car's door
(as built), round a corner, down a stair, through a door that opens.
Nobody appears.

## 4. The Cardinal: not a sponge, a problem to solve
(Today: twenty-four wounds. That is the sponge.) He should take about as
many rounds as a man, when a round reaches him; the fight is making one
reach him. A shape to start from, three short stages with a checkpoint
before the first, each read from the picture, no bar:
1. **The saloon.** Long, black, armoured: it comes up the avenue at a
   walk with its lamps full in my eyes, two heavies walking behind its
   open doors. Rounds spark off it. What gives: the lamps (shoot them:
   the glare goes and I can see), the tyres (it stops where I stop it),
   the men's legs under the doors. Or leave the diner and get an angle
   from a column while they watch the windows: the flank is mine this
   time.
2. **Him on the street.** He gets out when the car stops: wide, slow,
   the cane, the cigar, a big pistol. He walks at the diner and nothing
   hurries him. His tell is his own: he draws on the cigar (the ember
   flares: the accent), the gun comes up, and that shot does not miss a
   man in the open. A heavy walks with him as a shield, or he keeps a
   column between us. Hits stagger him only when he is open: just after
   he fires, when his shield man drops, when the hydrant knocks him
   down, when burning petrol from a wreck cuts him off. Three or four
   honest hits. Each shows on him (the hat goes, the coat, a knee).
3. **The end.** Hurt, he makes for the diner's door and Dot, or back for
   his car: a last ten seconds in which the player must finish it or
   lose. However it is done, the last frame is the one built: his hat in
   the wet street, the cigar's ember beside it, the el train going away,
   Dot at the broken window. The still for the end (WAVE_C §5) and THE
   END.
Design it by play: a first-timer should die to him once or twice and
then see how; a good player takes two to three minutes; nobody stands and
holds the trigger.

## Proofs and gate
WAVE_C §7. `block_idle` at each contest (the nick of time; each movement
of the street; each stage of the Cardinal): lost, with the warning first.
`block_bad` (stands at one window and holds the trigger): dies in each
movement, learns, gets through. `block_good` (moves, uses cover and the
street): wins twice in a row in six to nine minutes, dying once or twice
at most. The nick of time by each of its ways. The jank walk over the
whole block during the fight (in every doorway as men come, between the
cars as cars arrive). The frame rate at the heaviest moment against
`shot=perf` (the old chapter's glass batching, `ShardField.batchRest`,
still on). Music: `shootout` then `end`, as lane C1's rule cues them.
Report `docs/story/reports/wave-c/C8.md`.

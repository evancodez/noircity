# O8 — figures: one cast for the city, never stiff, never blocky; the physics layer; the look of the Hood for everyone

Branch `ow/O8-figures`, port 5379. After O3 (people) and O4 (combat)
have merged: the lane that makes every figure in the city (pedestrians,
gang men, cops, detectives, drivers, boxers, barmen, the player's own
hands) one cast, in the look the user wants, moving in a way that is
not stiff. The user's words (2026-10-23):

- **[must]** "I liked the noir style enemies from the OG game, and the
  animations often looked cool, but it probably needs some sort of
  physics or more dynamic way to do things too, or just more animations
  etc, better AI. That style of character and others (remember, not just
  one style of NPC)."
- **[must]** "Make the game not feel buggy, glitchy, ugly, or overly
  stiff when it comes to other characters. The look of the AI normal
  grunt enemies is a good look: the face was obscured, as it's hard to
  get faces right, and they didn't look blocky nor balloon-animally."
- **[must]** "Not cluttered or overly convoluted, but nice attention to
  detail and cool stuff."

What you build on: the cast (`src/cast/`: `Figure.js`, `Character.js`,
`costumes.js`, `kinds/`, `castAnim.js`, `clips.js`, `tailor.js`), the
Hood (`src/enemies/Hood.js`, `HoodRig.js`, `HoodAnim.js`, `HoodAI.js`,
`gunClips.js`, `src/guns/deaths.js`: the slumps), the brawl's figure and
brain (`src/cast/brawl/`), the hands (`src/player/HandRig.js`,
`Hands.js`, `handClips.js`), O3's crowd figure and reactions
(`docs/reports/O3.md`), O4's kinds (`docs/reports/O4.md`), lane C2b's
turn rule (`docs/story/reports/wave-c/C2b.md`: no spin, no whip), the
character notes of the base (`docs/story/briefs/L6_CHARACTERS.md`,
`docs/story/reports/` of lanes L6 and B-era where the Hood was made).

## 1. The look: the Hood's rule for everyone
The face is never the problem: under a hat brim, in the shadow of a
collar, turned away, in the ink's black; what reads is the **silhouette**
(the hat, the coat's cut, the shoulders, the gait) and the costume's
variants. Nothing blocky (no box limbs), nothing balloon (no round
tubes): the base's Hood proportions, re-used and varied. Kinds, each
told at 20 m by outline alone and never one style: the Hood (the
grunt), the detective (the belted coat, the fedora low), the beat cop
(the tunic, the helmet or the cap, the cape in the rain), the docker
(the cap, the jersey, the hook), the swell (the topper, the cane), the
woman in the cloche, the woman in the fur, the newsboy, the drunk, the
boxer (bare arms, the robe), the barman (the apron), the driver (the
peaked cap), the gang men (long coats; caps and jackets). Variants by a
seeded hash (build: tall, heavy, slight; the hat; the coat's length;
the walk). Faces when seen close: a few strokes under the brim, the
base's ink, no eyes that stare.

## 2. The motion: never stiff
- **Blended clips over procedural layers**: a walk, a run, a stand with
  idle variety (shifting weight, a cigarette, a look round, hands in
  pockets, the paper), a turn that steps (never a spin: C2b's rule for
  all), a dash clear, a cower, a gather, a drink, a lean on a wall, a
  sit; over them a look layer (the head and the eyes to what matters:
  me, a car, a shot), a lean into a turn and against the rain, feet
  placed on kerbs and stairs (a simple two-bone IK), the coat and the
  hat answering the run and the wind in a few strokes.
- **The physics layer, within reason**: a light ragdoll for a fall (a
  knock-down in a brawl, a car's hit, a death: the body goes the way the
  force went, settles against what it meets, never through it, never
  jittering; blended from the clip in the first frames so nothing pops),
  a stagger that is physical (a push moves him), a body that is solid to
  things and not to feet (the rule). No full-body simulation; a dozen
  bodies on the ground at 60 fps.
- **Hits read**: where the round struck, the body answers there (the
  base's deaths); a punch snaps the head on its side; a man hit by a car
  goes over the bonnet or under, by the speed.
- **The AI that shows**: every man has an intention you can read before
  he acts (he looks, he squares up, he raises, he backs off), reactions
  in 0.2 s, no sliding, no popping between states; a crowd never jams
  (they go round each other and me); a pedestrian pushed moves and
  objects; cops and gangs use the base's cover and tells (O4's) with
  the new rig.

## 3. One cast, every system
O3's crowd figure, O4's fighters and gunmen, O2's drivers, O5's barmen
and boxers, the base's Hood: all on one rig and one kit of clips, with
the budget O1 left (the ten nearest full, the rest the light figure,
the far ones the outline). Write the cast's API in `docs/seams/CAST.md`
(a kind, a variant seed, the layers a system drives, the ragdoll call).
Nothing a lane did is lost: their kinds move onto the rig.

## 4. Proofs and gate
A parade bed (`?start=cast`: every kind in its variants walking,
standing, turning, falling, dying, being hit by a car; the strips
looked at); the jank walk of a crowd at the busiest street (nothing
through anyone, no jitter, no pop, bodies solid to things and not to
feet); the ragdoll proofs (a knock-down, a car at 20 and at 50 km/h, a
death in a doorway, on a stair, against a wall: settles, never through);
the AI read proofs (a cold critic names each man's intention from a
strip before he acts); fps with forty figures and twelve bodies; memory
flat over ten minutes; the latency of a reaction; golden identical (the
city's frames with figures named and shown as better); errors clean.
Report `docs/reports/O8.md`. Hours, not days.

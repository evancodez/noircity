# Wave A, round 2 — after the user played the slice

The user played the integrated slice (title, the diner, the fist fight, the
matchbook) on 2026-09-29. His verdict: **not at the standard yet,
graphically, in animation, or in gameplay, but not lost.** His words, in
short:

- the bar needs **more cinematic lighting**;
- the **characters** look like "3D balloon-animal blobs"; the enemies of
  the wave shooter (the Hoods) looked really good and had distinct
  silhouettes: go back, find out why, and bring every character to that;
- the player's hand has a **stick or line between thumb and index**;
- **animation is wonky** wherever a character meets an object: the pour is
  at an angle that makes no sense, picking up and putting down the glass
  looks wrong;
- the brawler's **torso spins 360 degrees** when the fight starts and when
  he lies on the ground;
- the **fight** must be taught properly, then open up; each mouse button
  is an arm; a dodge goes away from the swinging hand; he must go out of a
  **window**, not through a table, from wherever the fight has gone;
- glass **shards float** after the window breaks;
- beyond these examples: **look at everything**; raise the quality.

## Why the Hoods look good (the art director's finding)

Open `shots/golden/hoodstudy.png`, `hoods.png`, `hood.png`.
1. **They are drawn as flat shapes.** The ink prints a Hood as one black
   mass with a thin white rim on the lit side and two or three light
   shapes (the lapel V, the collar, a cuff). There is no shading inside the
   mass. The body is 3D; the picture is a cut-out. That is the "2.5D" the
   user sensed.
2. **The shape is tailored.** A fedora's brim, squared shoulders, a belted
   coat that flares to its hem: straight lines and angles. Nothing in the
   outline is a ball.
3. **They stand against light.** Lit mist and the white columns on the
   wet street are behind them. Dark on light.
4. **Few poses, each designed** from the reference, with whole-body
   weight, and the coat's hem following the motion.

The slice's people break all four: they are lit grey and shaded smoothly
(so every rounded form reads as a balloon), their bodies are built of
ellipsoids (belly, ball fists, mitten hands), they stand against a black
room, and their many clips were made fast.

## Principles for this round

- **One owner per seam.** The first version split every interaction
  between lanes (hand, glass, waitress, stream, script), and the seams are
  where it looked worst. Now one builder owns a scene end to end and may
  edit whatever that scene needs, inside the ownership below.
- **Object first.** When a hand meets a thing, author the **thing's**
  path and pose (the bottle leaves the shelf, crosses to the glass, tips
  until its mouth is below its base and over the rim), then put the hand
  on the thing's grip by IK every step. Never pose the arm and hope the
  object follows.
- **Film strips.** Motion is judged on `python3 tools/strip.py` sheets
  (8 to 12 frames of one action), yours first, then the art director's.
- **Flat ink.** A figure is a dark shape with a rim, not a shaded solid.
- **Silence.** Every automated run is muted (`--mute-audio` is in the
  tools). Never open the game with sound on the user's machine.
- Base: the head of `wave-a/integration`. Own worktree, own port, own
  branch `wave-a/r2-<name>`. Put new clip and pose data in **new files**
  of your own (listed below) and touch a shared file only to import them
  or to delete what you replace. Commit; do not push; do not merge.

---------------------------------------------------------------------------
## Owner 1 — THE FIGHT (port 5195, branch `wave-a/r2-fight`)

Build `docs/story/FIGHT.md`. All of it: controls, the dodge rule, the
lesson, the open fight in the room, his four manners, the finish at
either window, the motion rules.

You own: `src/game/Brawl.js`, `src/game/Autoplay.js`,
`src/scenes/02_fight.js`, `src/player/Controller.js` (the `brawl` mode
only), new `src/player/clips/fight.js` (my fists: guard, jabs, wind-ups by
arm, hard punches by arm, cover, slips, lean back, hurt, grab, strikes
with bottle / neck / plate / mug / stool), new `src/cast/brawl/**` (his
clips, his brain, his steering), `src/destruct/**` (the window, the
shards), `src/props/diner/booths.js` and the `booths` entry of
`src/stages/block/site.js` (FIGHT.md §6: finish spots, café tables and
chairs), the fight's cards in `src/ui/Hud.js`, `tools/plays/**`,
`tools/playtest.mjs`, `src/debug/shots/R2_fight.js`.

Must be true when you finish:
1. The controls are exactly FIGHT.md §1 and §2. Left button left arm,
   right button right arm, click for a jab, hold and let go for the hard
   punch with power by hold time, visible in the fist.
2. The lesson (§3) plays, step by step, and can be seen in
   `scene=fight&beat=lesson&step=<1..7>`.
3. The fight is in the room: I walk anywhere, he moves, blows knock
   people into furniture, things can be grabbed and used by both, his
   manner changes with his health (§4).
4. He uses **both** hands, and a swing is only slipped away from its hand.
5. The finish (§5) works at **both** windows from wherever the fight is:
   strips from my eye, from the side, and from the pavement outside, for
   B2 and for B4. He never passes through furniture, the wall or the
   sill; the glass bursts outwards; every shard comes to rest on a
   surface; nothing floats (probe: after 6 s no shard has |velocity| > 0
   above its support, none is higher than 5 mm over what it lies on).
6. **No spinning, no sliding, no pops** (§7). A probe records his chest's
   heading against his root through a whole autoplayed fight: no step
   changes it by more than 0.2 rad and it never winds a full turn. Find
   the cause of the 360s (at the rise into the guard, and on the ground
   after the fall) and remove it at the root.
7. Autoplay at a human's pace wins in 90 to 150 s; the scripted play by
   real input passes; both muted.
8. Strips: the rise into the guard; each of his attacks from each hand
   with the right and the wrong slip; a hard punch that throws him into
   the stools; him arming himself; the stool swing; out on his feet, the
   reel to the window; the finish.

His **look** (build, clothes, hands) belongs to owner 3; his **motion** is
yours. Use whatever figure exists; keep to the skeleton's joint names.

---------------------------------------------------------------------------
## Owner 2 — SCENE ONE (port 5196, branch `wave-a/r2-diner`)

The first three minutes of the game, end to end: I sit, I light up, I
order, she pours, I drink, I pay, he notices. Every moment a hand or a
person meets an object must be right.

You own: `src/scenes/01_diner.js`, `src/scenes/_diner_room.js`,
`src/player/Controller.js` (the `seated` mode only), new
`src/player/clips/diner.js` (my hands in scene 1), `src/player/Hands.js`
(holding, IK onto grips), new `src/cast/diner/**` (Dot, the cook, the
patrons: clips and behaviour), `src/fx/StoryFx.js` (the stream, the
smoke), the `grip` and `rest` data of props in `src/props/**` (not their
shapes or materials), the scene's prompts in `src/ui/Hud.js`,
`src/debug/shots/R2_diner.js`.

Must be true when you finish:
1. **The pour.** Dot takes the scotch by its body from the back bar,
   brings it over the glass upright, and tips it about the axis along the
   counter until the **mouth is lower than the base and points into the
   glass** (the bottle's axis 110 to 120 degrees from upright), the mouth
   5 to 8 cm above the rim. A thin stream (3 to 4 mm) falls from the
   mouth into the glass, swaying slightly; the level in the glass rises;
   the level in the bottle falls. She rights it with a small twist of the
   wrist, corks it, sets it on the counter. Her hand stays on the bottle
   throughout (IK on its grip), her other hand steadies the glass or
   rests on the counter. Strip: 12 frames.
2. **The glass, in my hand.** My hand comes to the glass from the side,
   open; the fingers close round its far wall and the thumb on its near
   wall; it lifts, upright; it tips only at my mouth, the liquid staying
   level in it; it comes down flat on the counter, the hand lets go and
   goes back to rest. The glass never passes through a finger or the
   counter, and never fills more than a fifth of the frame. Strips for
   taking, the sip, putting down.
3. **Lighting up.** The cigarette comes out of the pack between two
   fingers; the lighter opens, the thumb turns the wheel, the flame
   stands; the tip meets the flame; the lighter shuts. Every object is
   held at a grip, by fingers that close on it.
4. **Paying**: the wallet opens like a book, the licence shows, a bill
   is laid on the counter.
5. **The slide**: the glass Dot slides stops at my left hand.
6. **The smoke** is a thread, then curls (see the round 1 brief D1 if it
   is not already so).
7. **The seat**: square to the counter, level, the counter's near edge in
   frame; when something wants my eye the view is eased to it and given
   back.
8. The patrons and the cook do their small things without a wrong
   contact (cup to mouth, page turned, plate set down, coin in the
   jukebox).
9. The scene plays by real input and by autoplay; muted.

---------------------------------------------------------------------------
## Owner 3 — THE LOOK: light and figures (port 5197, branch `wave-a/r2-look`)

You own: `src/render/**`, `src/stages/block/parts/diner.js`,
`src/props/**` (shapes and materials), `src/cast/costumes.js`,
`src/cast/tailor.js`, `src/cast/Figure.js`, `src/cast/extras.js`,
`src/player/HandRig.js` (the hands' shape), `src/debug/shots/R2_look.js`.
Do not change `src/enemies/**`: the Hoods are the standard.

### 3.1 Every figure to the Hood standard
- **Print**: every character prints as the Hoods do: a dark mass
  (display under 0.12) with a thin white rim on the side of the key
  lamp, no gradient inside the mass, and at most two flat light shapes
  per figure, each with a torn edge (Dot: the apron and the cap; Mack:
  the forearms and the shirt's V; the cook: the paper hat; the old man:
  the newspaper). Indoors as outdoors. The ink's figure path (`hoodF`)
  is how the Hoods get it: bring every cast figure onto it.
- **Shape**: tailored, angular, readable as a cut-out at 22 m. Squared
  shoulders with a seam; collars with points; a waistcoat with its two
  points and its back strap; an apron with its bib, straps and bow;
  trouser creases; shoes with heels; hats with brims and crowns that have
  an edge. No body part reads as a ball or a balloon: no round belly, no
  ball fists, no mitten hands, no tube neck. Hands have fingers (the
  figure's hand may be simpler than mine: four fingers as one tapered
  block with knuckle lines, and a thumb).
- **Mack** is the most dangerous shape in the game: 1.96 m, shoulders
  0.60, a barrel chest wider than his waist, thick forearms bare to the
  elbow, big hands, a flat cap pulled low. Heavy, not fat.
- Proof: `caststudy` and `caststudy&far=1` beside
  `shots/golden/hoodstudy.png` (the cast must look like the work of the
  same hand), and each figure in the diner's light.

### 3.2 The player's hands
- The stick or line between thumb and index goes: find what draws it
  (the web's geometry, a tick line, a contour between two ink ids) and
  remove it. The web is a smooth fold of skin.
- The hand is drawn, not modelled: light grey with one shadow shape and
  a thin contour; the knuckles as short ticks; nails as one tick each.
  Never white gloves, never a heavy outline.
- Strip and stills: `handstudy` from four sides, open, holding the
  glass, a fist.

### 3.3 Cinematic light in the diner
Noir light is a few hard sources, deep black, and every figure set
against light.
- **Key**: the pendants' pools on the counter and floor (a pool over my
  place).
- **Back light**: the back bar is a lit glass wall; Dot and the bottles
  are black shapes on it. The kitchen hatch is a white rectangle with the
  cook cut out of it.
- **Window light**: the street's lamps through the wet plate glass throw
  long soft patches across the booths and the floor, with the water's
  shadows crawling in them; the half-lowered blind in one bay lays its
  slats across the floor and over anyone who stands there. The el train's
  windows sweep the room.
- **Neon**: a faint blue on the floor just inside the door and on the
  wet pavement outside; nowhere else.
- **Air**: a layer of smoke under the ceiling catches the pendants:
  soft shafts, never solid cones.
- **Staging**: wherever a figure usually stands, something lighter is
  behind them: Mack at his stool against the lit end wall and the
  jukebox's glow; in the fight, the window wall and the lit back bar are
  the two backgrounds.
- **Black**: the ceiling, the corners, under the counter, the far end
  beyond the last lamp.
- Frames: `diner_seat`, `diner_wide`, `diner_left`, `diner_right`,
  `diner_booth`, `scene=fight&beat=round1`, each judged as a film still.

### 3.4 What round 1 left open
The art director adds this list when round 1 has been merged and judged.

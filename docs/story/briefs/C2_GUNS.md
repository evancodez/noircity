# C2 — the gun kit: cover, crouch, gunmen who are dangerous and fair, bodies that are solid

Branch `wave-c/C2-guns`, port 5342. Three chapters will be built on what
you make: IV The Door (the office, revolver), VII Pier Nine's loud pass
(a warehouse, revolver), VIII The Block (the diner and the street, Tommy
gun). You build the rules, the men and the proof; they build the places.
Your test bed is a place of your own (below). You do not touch those three
chapters' scenes.

Read `docs/story/WAVE_C.md` first (§1, §2 and the chapters IV, VII, VIII),
then `ARCHITECTURE.md` §10.4, `src/enemies/*` (the Hood: `Hood.js`,
`HoodAI.js` the street's cover brain, `HoodBrains.js`, `brains/office.js`,
`Nav.js`), `src/player/modes/office.js`, `src/player/Health.js`,
`src/player/weapons/revolver.js`, `src/game/Director.js`, and
`src/scenes/05_gunfight.js` + `src/scenes/office/fight.js` (what exists and
what was wrong with it).

## What the user said about the gunfights
- "Enemies who really try to kill me. Today they do not feel dangerous."
- "They do not all file through one door to be shot."
- "Nobody clips through furniture or door frames. Dying men slump where
  they are."
- Of the street: "Today I just stand and shoot, and it is neither hard nor
  fun." He wants "strategy: cover and other mechanics".
- Of the very first version of this game's shooting: it "felt very premium
  because it didn't feel janky. The animations felt good." Keep that.

Today's office fight fakes cover (`coverK`: a man's aim falls to a fifth
when I am "behind the desk") and its men walk marks. That is the cheat and
the stiffness. Replace the fake with physics and the marks with men who
read the room.

## 1. My side: one way of fighting with a gun, used in all three chapters
A controller mode `gun` (it replaces `office`; keep `office` as an alias
until lane C5 has moved over).
- **C** toggles the crouch, **Ctrl** holds it. Crouched, the eye is low
  enough that a desk on its side, a counter, a crate, a car's wing hides
  me. Crouch-walking is slow.
- **Crouched behind something, holding RMB rises to aim over it** (or
  leans round its end when I am at its end); letting go drops back. LMB
  fires. So cover is one habit: get low, RMB up, fire, let go. Standing in
  the open RMB steadies as now. Make the rise and the drop fast (0.15 s)
  and the gun honest: the muzzle must clear the cover or the round hits it.
- **R** reloads; reloading is the moment I want to be down. The count is
  the HUD's inked cylinder (revolver) / drum.
- **Health**: `Health.js` as it is, but: every hit says where it came from
  (an ink splash at that edge of the frame); mending starts later and runs
  slower while anyone has a line on me; the low state is unmistakable
  (the ink closing in, the heartbeat).
- **Feedback when I am shot at and missed**: splinters, plaster, a crack
  past the ear on that side. The player must always know he is under fire
  and from where.
- **Feedback when I hit**: every round that lands shows on the man (the
  flinch, the stagger, the cloth, the ink) and sounds; a kill is clear at
  once.
- Teach cards (lane C1's `hud.teach`; if it is not merged when you need
  it, call a stub of the same signature): `[C] get low`, `[RMB] rise and
  aim`, `[R] reload`. The scene decides when; the kit gives a helper.

## 2. Cover is physical
- A round is a ray, theirs and mine, and what is solid stops it. Remove
  every aim fudge that stands in for cover. A man shooting at where I
  crouch hits the desk.
- **Cover is spent.** A cover object has a material: thin wood (a desk
  top, a door, a crate) takes so many rounds and then lets them through,
  showing it honestly (holes with light in them, splinters, then a gap);
  steel and stone do not. Glass breaks. Offer this as data a stage sets on
  its things (`cover: { kind: 'wood', hp }`), with the damage look and the
  ray rule in one place. `src/destruct/*` has the breakables and the glass:
  build on them.
- **Shooting through**: frosted glass and thin doors can be shot through
  from both sides, with the round losing aim and force. (Scene IV's first
  choice is to shoot the shadows through the door glass: the kit must make
  that just work.)

## 3. Their side: men who try to kill me, fairly
A brain (a new file in `src/enemies/brains/`, name `gunman`) that works in
any room or street from data the stage gives (nav bounds and obstacles,
cover objects, entries), not from marks per man:
- **He is dangerous.** With a clear line and his aim settled he hits. The
  rule that makes it fair is time, not luck: he raises (0.25 s, the tell:
  the arm comes up, a glint on the barrel, a short sound), settles (0.4 to
  0.9 s by distance, by whether I am moving, by whether he was just hit or
  shot at), then fires; his first shot at a still target in the open hits.
  Moving across his line, ducking, or putting a round near him resets or
  spoils the settle. No hidden miss streaks, no "first three shots always
  miss". A player in the open, standing still, is down in three to four
  seconds against two men. Put the numbers in one table at the top of the
  file.
- **He uses the room.** He goes from cover to cover, fires from cover
  (out, two or three rounds, back), reloads behind it, moves when his
  cover is being chewed or when I have his angle.
- **They work together** (the Director): at most N fire at once (N by the
  scene: two in the office, three or four in the street), the others move.
  One keeps my head down while another goes round: **the flank**. If I
  sit behind one piece of cover for long, someone comes round its side, and
  I hear and see him going (footsteps, a shape crossing a doorway) in time
  to turn. That is the strategy the user asked for: where I am safe
  changes, so I must move, pick who to shoot first, and watch two ways.
- **Kinds** that read at a glance and ask different things of me: the
  pistol man (the above); the Tommy gunner (he pins: a long burst chews my
  cover and I cannot rise into it; when the burst ends he must change the
  drum or let the gun cool: that is my moment, and it is audible); the
  rusher (the heavy: walks at me firing, takes more, staggers on a hit, has
  to be answered before he reaches my cover). A stage chooses from these.
  Nothing else in this lane.
- **Wounds and deaths.** Hit, he flinches by where he was hit and may
  drop to a knee behind cover. Dying, **he slumps where he is**: down a
  wall, over the cover he stood behind, in the doorway, to his knees and
  onto his side; never thrown backwards through a desk, never sliding,
  never standing up through a table. The body comes to rest on what is
  there (the floor, a sill, a car's bonnet) and stays, solid to walk round
  (or soft: your call, but it never trips the nav of the living). Look at
  `HoodAnim.js` deaths: keep the good ones, add the slumps, pick by what is
  beside him.
- **Entries.** A man comes in the way a man would: through a door he
  opens (the door moves, he is in the frame of it for a moment, exposed:
  that is fair for me too), up a stair, out of a car's door, round a
  corner. Never appearing. A stage gives entries as data (`{ at, door?,
  path }`); the kit walks him in.

## 4. Bodies are solid (the one physical layer for people)
`Nav.js` and `world/Colliders.js` exist. Make one rule for every Hood, in
every stage, and offer the same to the cast (lane C4 will use it for the
people who flee the diner):
- a man is a circle; he does not enter furniture, walls, door jambs, cars,
  the player, or another man; he steers round, and when a doorway is taken
  he waits or goes another way;
- his path is planned on the stage's obstacles (a small nav grid or the
  portal graph `Nav.js` has: your call) and followed with steering, so no
  straight line through a desk ever;
- the player cannot walk through a living man or a body of furniture
  either (`Controller.keepOff`, the colliders): check every case in the
  test bed;
- arms and guns: a man at a door jamb or a wall holds his gun so it does
  not go through it (shorten the aim pose near a surface, or step him off
  it).
Export a small service the cast can use: `game.bodies` (register a
circle, ask for a steer, ask `free(x, z, r)`).

## 5. The test bed: a place of your own, and the proof
A stage `killhouse` (`src/stages/killhouse/`, its own salt) and a scene
`91_guns.js` (`?start=guns`, not in the order): two rooms and a corridor
with real doors, a desk that can be tipped (reuse the office's desk and
`tipDesk` if it lifts out cleanly, else your own), crates, a counter, a
frosted glass partition, a stair or a second door; and outside a short
piece of street with two parked cars. Lit like the game (pools and ink),
not a grey box, but do not spend the lane on its looks. Beats:
`ready` (teach: low, rise, reload), `door` (two men through one door: the
exposure of a doorway), `two_ways` (three men from two entries: the
flank), `pin` (a Tommy gunner and a pistol man: wait out the burst),
`rush` (the heavy), `street` (four men and two cars: cover to cover, with
the Tommy gun and with the revolver).
Proofs as plays (WAVE_C §7 gate): `guns_idle` (stand still: down within
seconds in every beat), `guns_bad` (stand and trade shots in the open:
loses most beats), `guns_good` (cover, rise, reload down, move when
flanked: wins every beat, twice in a row, at a human pace: reactions 300
to 550 ms, 60 to 70 % of aimed shots landing). Use the shoot driver in
`tools/play.mjs` (`shoot` [B2]) and `tools/lib/b7_shootout.mjs`'s
first-timer profile as the bot's hands.
Strips of every death and every entry: look at them.

## 6. What you hand over
`docs/story/seams/GUNS.md`: how a chapter uses the kit in a page (the
mode, the cover data, the entries, the Director's numbers, the three kinds,
the helper for teach cards, the difficulty table and which three numbers a
chapter may turn). Lanes C5, C7 and C8 read only that and your test bed.

Shared files (`Hood.js`, `HoodAI.js`, `Game.js hoodFire`, `Controller.js`,
`Health.js`, `Weapon.js`): yours to change for this, marked `// [C2]`, as
small as will do. **The golden frames `battle`, `perf`, `end` and the
street's old fight must stay identical** (ARCHITECTURE §9): the old cover
brain keeps its draws; your brain is new and opt-in.

## Gate
WAVE_C §7. Report `docs/story/reports/wave-c/C2.md`, review frames and
strips in `docs/story/review/wave-c/C2/`.

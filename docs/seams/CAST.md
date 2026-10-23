# NOIR CITY seams: the cast (lane O8)

One cast for every figure of the city - the crowd, the beat cops and the
detectives, the gangs, the brawl's men, the gun kit's gunmen, the rooms'
barmen, boxers and drunks, the wanted men - on one rig and one kit of clips,
in the Hood's look (the face in the brim's shadow, the silhouette tells the
kind), with the city's own layers over the clips and a light ragdoll for
every fall. Brief: `docs/briefs/O8_FIGURES.md`; report: `docs/reports/O8.md`.

Frame: a figure faces **(sin yaw, cos yaw)** (`fig.yaw`; a viewer's yaw looks
along (-sin, -cos): `docs/seams/WORLD.md`). Model units are metres before the
figure's scale.

---------------------------------------------------------------------------
## 1. The rig: one skeleton, one figure class

- **The skeleton** is the Hood's (`src/enemies/HoodRig.js` `JOINTS`: root,
  hips, spine, chest, neck, head, hat; the shoulders, arms, forearms, hands;
  the thighs, shins, feet; the coat and the skirt halves). Bind rotations are
  identity; a clip's quaternion is "away from hanging straight".
- **`Hood`** (`src/enemies/Hood.js`) is every figure's base: the skinned mesh
  (three LODs by distance), the ink slot, the shadow, the coat's spring, the
  look-at, the hit volumes, the deaths, **the ragdoll** and **the style
  layer** (below). The gun kit's gunmen are Hoods; everyone else is a
  **`Figure`** (`src/cast/Figure.js`: a Hood in a costume of the tailor,
  `src/cast/tailor.js`) directed through a **`Character`**
  (`src/cast/Character.js`: states, clips, sit, hold, glance, hit, ko).
- A **kind** is a costume plus its clips: built in (`src/cast/costumes.js`),
  in a kind file (`src/cast/kinds/<kind>.js`: `{ kind, h, costume, clips?,
  idle? }`, read by a glob), or one of the street's looks
  (`src/people/costumes.js` `LOOKS`). **A kind file's clips are everyone's**
  (`castAnim.js` bakes them per costume the first time a figure plays one).

---------------------------------------------------------------------------
## 2. A man of the city: kind, variant, style

```js
import { styleFor } from 'src/cast/style.js';
const S = styleFor(kind, x, z, { role: 'walker' | 'cop' | 'gang', sex: 'm' | 'f', work, old });
fig.setStyle(S);                     // (the street's Person.reset does this)
import { carry } from 'src/cast/o8extras.js';
carry(fig, 'cigarette' | 'cane' | null);
```

- **The variant is where he stands**: a seeded hash of (x, z) picks, on top
  of the look, his **build** (slight / middling / heavy: the shoulders' width
  and the chest's depth, `fig.object.scale`), the **hat's set** (pulled down
  over the eyes, pushed back, cocked: the hat bone), his **carriage** (a
  slouch, the chest up, the head down), his **walk** (the hips' sway for a
  woman, the shoulders' roll for a working man, the gang's swagger, the arms
  in or out, all with the gait's own phase), the **idle he keeps** and what he
  **carries**. The same place gives the same man; the next corner another.
- **The idles** (`fig.idleName`, played whenever the figure's state is
  `idle`): `idle` (the Hood's), `o8_idleShift` (the weight on one leg, then the
  other, a look round), `o8_idlePockets` (hands in the coat, shoulders up),
  `o8_idleSmoke` (a cigarette to the lips; its ember the registry's
  `ember`), `o8_idleArms` (arms folded). Walking with `pockets`, the
  idle's upper body is laid over the walk (`Person.walkOverlay`).
- **The kinds the street wears** are `src/people/costumes.js` `PED_LOOKS`
  by district (O3's), plus `o8_swell` (the topper, the white scarf, the cane:
  downtown and the Hill). A new look: register it there; it is varied by
  `styleFor` with no more work.
- `fig.setStyle(null)` is the costume as built (game one's figures never have
  one: their frames are golden).

---------------------------------------------------------------------------
## 3. The layers a system drives

Over whatever clip plays (the mixer), every step, in `Hood.postPose`:

| layer | how a system drives it |
| --- | --- |
| the look | `c.lookAt(Vector3 \| null)` (eased off), `c.glance(pos, secs)`; the street's people glance at me as I pass within 6.5 m before them (`Person.step`) |
| the style | `fig.setStyle(S)` (above): carriage, walk, the lean into a turn (the yaw rate x the speed) |
| a gesture | `person.gesture(name, secs)`: an upper-body clip over the legs, held, then back. `o8_point` (a witness, before he runs to tell it: `People.startReport`), `o8_halt` (a cop's palm out with 'Hands up.': `Police`), `o8_reach` (a hand into the coat 0.3 - 0.6 s before the gun: `Gangs.hostile`); `fig.anim.setOverlay(name)` for a Character |
| the startle | `c.play('startle')`: the jolt, additive, the step a man takes fright (`Person.flee`) |
| the turn | a man standing who must turn more than 45 degrees steps round it (`GAIT.turn`, a slow walk on the turn: `Person.step`); the gun kit's men keep lane C2b's `turnSafe` |
| the coat | the hem's spring (the start, the stop, the turn) - the Hood's |

A layer that turns a bone the mixer may not rewrite marks it moved each step
(`Hood.dirtyBones`): never lay a rotation on a bone outside `STYLE_BONES` /
the CastAnimator's `LOOK_BONES` without adding it there.

---------------------------------------------------------------------------
## 4. The physics layer: the ragdoll

A stage that sets `stage.ragdolls = true` (the city: `src/stages/noircity/
parts/o8figures.js`) gives every fall to `src/cast/ragdoll.js`: sixteen points
at the joints, Verlet, fixed links (a torso box, the limbs), joint limits as
minimum distances; solid to the walking surface under each point (kerbs,
steps, floors - a step's riser is a wall from below), to the walls and posts
(the colliders, not the men), and to the cars (two boxes, the body to the
bonnet and the cabin: the bumper sweeps the legs, the bonnet carries the
torso, the screen meets the head). The fall's clip is what it reaches for:
the torso follows it in the world for 0.42 s (`follow`), the limbs reach for
it relative to the torso while he falls (`limb`), then he is limp. Asleep
once still for 0.45 s (no cost, the pose kept); a car near wakes him (a man
lying in the road is rolled out of its way, not driven through).

```js
fig.startRagdoll({ clip, push: { v: Vector3 (m/s), lo, hi, up }, follow = 1 })
//   push: the velocity at his feet x lo, at his crown x hi, between by height (+ up m/s)
fig.endRagdoll({ instant })   // (a get-up clip played ends it by itself: blended out of how he lies)
fig.rag                        // the Ragdoll while it runs: .asleep, .t, .facing(), .lie(), .onSleep = fn
c.ko(kind, { push, follow, clip })   // a Character down: the ragdoll in the city, the clip elsewhere
person.knock(dir, { dead, why, push, follow })   // the street's: the fall that fits where he stands
```

- **Who calls it**: `Hood.die` (the gun kit's deaths: the round's way
  pushes, `h._hitDir` from `Game.killHood`), `Character.ko` (the crowd
  brawl's last blow - `Crowd.knockDown` passes the blow's way - the wanted
  man, the bars' fights), `Person.knock` (a punch, a round, a car:
  `People.hitByCar` gives the car's own push - fast, over the bonnet; slow,
  knocked down before it). `Person.knock` asks the gun kit's
  `chooseDeath` for the fall that fits (a wall at his back: `deathSlumpWall`;
  no room: `deathSlump`) and the ragdoll reaches for it.
- **The get-up**: playing `o4_getUp` (or any clip that is not a lying one)
  ends the ragdoll: the root is put where the clip's lying body overlaps his
  (his feet at the root, his head along -z) and the pose blends from how he
  lay over 0.32 s (0.55 s from his front).
- **The blood pool** waits for the body to lie still (`rag.onSleep`).
- **The bodies are solid to things, not to feet** (C2b's rule): no body is in
  the walking colliders; the gun kit's `overBody` reads the bones as before.
- **Budget**: twelve bodies falling at once and forty walking, the bed's
  `crowd` beat (`docs/reports/O8.md` for the frame rate); a sleeping body costs
  nothing.

---------------------------------------------------------------------------
## 5. One cast, every system: drawing a gun

A man of the cast who draws stays the man he was:
`armFigure(game, kit, character, { kind, hp })` (`src/cast/arm.js`) hands his
own figure to the gun kit (the gunman brain steps him from then on, the
revolver into his fist). The wanted man of the bounty board draws this way
(`src/night/bounty.js`); a Person of the street draws through O3's
`copGuns(police).arm(person)`, the same way. `K.spawn` makes a new gunman only
for a system that has no man standing (a hideout's).

---------------------------------------------------------------------------
## 6. The bed

`?start=cast.<beat>` plays it, `?scene=cast&beat=<beat>&t=<s>` frames it
(`src/scenes/cast.js`, Grand Ave under the el, the bed's own lamps, a stoop
and a doorway on the west facade): `parade` (the looks walking the avenue,
turning at the ends; a row standing in their idles), `lineup` (three rows
facing me), `falls` (a knock-down and its get-up, a death against the wall,
in the doorway, on the steps, every nine seconds), `cars` / `car20` / `car50`
(a sedan into a man), `crowd` (forty walking, twelve down), `intent` (a
witness, a cop, a gang's three showing what they mean). `game.castBed` holds
each station's record (`settled`, `minY`, `through`, `at`) and the intent's
times; the proofs are `tools/plays/o8/*.json`.

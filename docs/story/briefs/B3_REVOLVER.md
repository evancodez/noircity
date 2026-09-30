# B3 — The hands, and the revolver

Read `docs/story/WAVE_B.md` first: it is the standard and the way of
working. You own the detective's hands as drawn (`src/player/HandRig.js`,
`Hands.js`, `Viewmodel.js`, `handPoses.js`) and the revolver. Branch
`wave-b/B3-revolver`, dev port 5313. Other lanes add hand clips as files of
their own in `src/player/clips/`; they do not edit your files, so keep
every pose, socket and clip that exists working.

## 1. The hands: less balloon
The user, after the last play: "The hands should maybe look a little less
balloon animaly." He is right: the fingers and the back of the hand are
round tubes, and the ink pass draws round things as soft blobs. The Hoods
look good because they are flat shapes with planes and corners.

Rebuild the hand's surface on the same rig (same bones, same lengths, same
sockets, so every clip and grip still lands) the way an inker constructs a
hand: a flat, slightly wedge-shaped back with a clear knuckle line; fingers
as tapered boxes with soft corners (flat top, flat sides, a pad beneath),
each joint a small step, not a bulge; a squared thumb with its ball; a
wrist that is a flattened box into the cuff. Planes catch the light as
planes: one side lit, one side ink, a hard edge between. Lines where an
inker would put them (between the fingers, the knuckles when the fist is
closed, the thumb's web as the palm's own edge, the cuff), and nowhere
else. No stray geometry between thumb and finger (that bug came once
already).

Judge it in every set against a frame captured before you start, at the
same presets: the guard in the fight (the hands the player sees most), a
fist mid-jab, the rest on the counter, the glass held, the cigarette, the
lighter, the wallet, the matchbook shown, the Tommy gun's gloves. It must
be plainly better in all of them and break none. The accepted frames that
show hands will change: say which, and show before and after.

## 2. The revolver
A .38 with a four-inch barrel, blued, checkered grip: a prop
(`buildProp('revolver')`, with its muzzle, its cylinder that turns and
swings out, its hammer, its ejector) and the weapon behind the front that
exists (`src/player/weapons/revolver.js`: keep the front, replace the
insides). Bare right hand, coat sleeve, held one-handed at the eye's
height, a little canted: the classic frame.

It must feel as good as the Tommy gun did on day one, and heavier:
- **Fire**: on the press, this step. The flash lights the room (the
  flash light exists), the muzzle climbs hard and comes back in a quarter
  of a second, the hammer falls and the cylinder turns (seen), a report
  deeper than the Hoods' pistols with the room's tail. About 0.3 s
  between shots; holding the button does not repeat.
- **Hits**: through the same bullet path as the Tommy's rounds (impacts,
  blood, glass, breakables, the Hoods' reactions). One body hit staggers a
  Hood, two put him down; the head, one. A heavy takes four.
- **Aim**: the rounds go where the eye's centre is, a little spread from
  the hip; **RMB steadies**: the gun comes to the eye's line, the lens
  tightens a few degrees, the spread closes. No crosshair.
- **Reload** (R, or the press on an empty gun): the cylinder swings out,
  the ejector's stroke, six brass casings fall and ring on the floor (the
  casings system), three pairs of rounds go in fast, it snaps shut: 1.7 s.
  A press during the reload shuts it with what is in it and fires.
- **Draw and put away**: the hand into the coat and out, 0.35 s each way.
- **The count**: a small inked cylinder with six chambers, bottom right,
  only while it is in the hand (`hud.layer`).
- Also give both hands a grip pose on it (`revolverGripR`, `revolverGripL`)
  so lane B5 can hold it out of a car window with the left hand.

## 3. Small things that are yours
- In the light-up (scene 1), a hand passes too close to the eye for a
  moment. Fix it.
- Anything else in the hands that looks wrong while you are in there:
  list it, fix what is cheap.

## Play and proof
Presets of your own (`src/debug/shots/B3_revolver.js`): the gun at rest,
steadied, mid-recoil, the cylinder out, and a staged fight on the block
against three Hoods. A play (`tools/plays/revolver.json`) that draws,
fires six, reloads, kills three Hoods by real input. Strips at 30 frames a
second: one shot (press to settled), the whole reload, the draw. Frames:
before and after of the hands in six poses, the revolver in four.

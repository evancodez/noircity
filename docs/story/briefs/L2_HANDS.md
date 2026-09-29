# Lane 2 — hands and weapons

Branch `wave-a/L2-hands`, port 5182. You own `src/player/**`: the
controller and its modes, the hands (the old Viewmodel), the weapons, the
health overlay. The player is only ever seen as two hands and two sleeves.
They carry the whole story, so they must be the best-drawn things in the
game.

## P0.1  One pair of rigged hands
Replace the rigid mitten shapes (`buildHands` in `Viewmodel.js`) with one
articulated pair, used by every set.
- **Skeleton per arm**: elbow (fixed in camera space, off-frame), forearm,
  wrist (2 axes), palm, thumb (3 joints), four fingers (3 joints each).
- **Proportions** (metres; adult male): palm 0.085 wide, 0.095 long, 0.028
  thick; fingers index 0.072, middle 0.080, ring 0.074, little 0.058
  (phalanges 0.45 / 0.30 / 0.25 of the length), radius 0.0095 tapering to
  0.0075; thumb 0.060, radius 0.011; wrist 0.058 x 0.040; forearm in a coat
  sleeve, radius 0.045 at the cuff widening to 0.055, with a shirt cuff
  showing 8 mm of paper white at the wrist indoors.
- **Surfaces**: smooth. Palm as a rounded, slightly cupped slab; fingers as
  capsules with sphere knuckles a little proud of them; web between thumb
  and index. No facets at 0.3 m.
- **Two skins on the same rig**: `bare` (indoors: skin prints light grey to
  paper white under a lamp, with dark knuckle ticks, nails as one short
  tick) and `glove` (with the guns: today's dark leather, knuckle ticks
  light). Ids from `allocVmId`: skin, sleeve, cuff, and one per held prop.
- **Poses are data**: a pose is a table of joint angles plus a wrist
  position and rotation in camera space; clips are keyframed poses with
  eases and marks (CONTRACTS §7.2). `hands.pose(name)` for stills.
- The elbows stay where a man's elbows are: the forearms enter the frame
  from the **bottom corners**, coming from behind the camera, never from
  the side of the frame at the depth of the hand.

Preset `handstudy`: the two bare hands open, palms down, over the counter
height, under a lamp; `handstudy&pose=<name>` shows any pose;
`handstudy&orbit=<deg>` turns a free camera around the hands (side, front,
top) so a pose can be checked from outside the first-person view.

## P0.2  Fix 3: the front hand on the foregrip
Today the left forearm comes in sideways from the left edge at the depth of
the foregrip and the hand sits on the grip as a knot: see
`shots/golden/viewmodel.png` (the fist at x 850, y 640). The user: "the
front hand faces the wrong way. Grip it from the correct side, fingers
wrapped around the grip."

The correct grip (a left hand on a vertical foregrip, seen by its owner):
- the **palm lies against the left side** of the grip, facing right;
- the **four fingers wrap round the front** of the grip and curl back along
  its right side, fingertips pointing back toward the shooter; from the eye
  the four knuckles are a vertical row of bumps on the front-left of the
  grip, index on top just under the barrel;
- the **thumb wraps round the back** of the grip toward the right, lying
  over the index fingertip or pointing forward along the left of the fore
  end;
- the **back of the hand faces left and a little up**, and continues the
  line of the forearm: the wrist is straight, below and behind the grip;
- the forearm runs from the bottom-left corner of the frame forward and up
  to the wrist (elbow in camera space near x -0.27, y -0.42, z +0.05).
Keep the gun's place in the frame and the right hand's look; give the right
hand the same rig (index on the trigger, thumb over the grip's left side).
Proof: `viewmodel`, `hoods`, `battle&t=30` at 1440x900 and a 4x crop of the
left hand; `handstudy&pose=tommyL&orbit=270` (from the left side),
`&orbit=0` (from the front), `&orbit=90`.

## P0.3  Fix 2: the reload
Keep the rest of the animation (the gun comes up and turns its right side
to the eye, the bolt is racked, the gun goes back down). Change the drum:
1. the left hand leaves the foregrip and thumbs the latch (as today);
2. the spent drum slides 5 cm out of its slot to the side, then **falls**:
   gravity, a slight tumble, accelerating straight out of the **bottom of
   the frame**. By u = 0.40 no part of it is in view. 0.35 s later it lands
   on the street by the player's feet (`sfx` clang; a ripple on the wet
   street; a dark drum lying there that stays, 3 at most);
3. the left hand drops out of the bottom of the frame with it (to the coat)
   and **comes back up with a fresh drum**, rising into view from the
   bottom edge, tilted, held by its rim;
4. the drum lines up beside the slot, **slides in and seats** with a push
   of the palm: the gun gives a small jolt, a click;
5. the hand goes to the bolt (as today), then back to the foregrip.
Total about 2.6 s; keep `Weapon.js` in step. Proof: `reload&vmreload=<s>`
at the five moments above (give the times), each frame showing exactly what
its step says; in the frame of step 2's end there is no drum anywhere.

## P0.4  The diner hands (scene 1)
Seated at the counter, the eye at world y 1.60, the counter top at world y
1.20 (0.40 m below the eye) filling the bottom third of the frame. Set `smoke`, bare hands.
- **rest**: the left forearm lies on the counter, the right hand near the
  pack and the lighter.
- `lightUp` (3.2 s): the right hand taps a cigarette out of the pack and
  brings it to the lips (the cigarette ends low in the frame, centre,
  foreshortened, pointing away); the left hand brings the lighter up,
  thumb flicks the wheel (mark `spark` 1.9), a flame stands (mark `flame`
  2.0: accent `flame`, a small warm-white light on both hands); the tip
  catches (mark `lit` 2.5: accent `ember`); the lighter snaps shut and goes
  down. The cigarette stays between the first two fingers of the right
  hand, which rests on the counter, smoke rising from the tip.
- `drag` (2.4 s): the hand comes up, the ember flares (gain 3, mark `glow`
  0.8), the hand goes down, then a slow plume of smoke from below the frame
  centre (mark `exhale` 1.6) that drifts up and forward into the lamp's
  cone.
- `ash` (0.8 s): a tap over the ashtray, a fleck falls.
- `reachGlass`, `sip` (2.0 s), `putDown`: the left hand takes the tumbler;
  the glass comes up to the bottom centre of the frame, tilts toward the
  eye so the amber runs to the rim, the room seen bent through the glass's
  base for a moment; down again. Each sip lowers the fill by a third
  (`prop.userData.setFill`).
- `payWallet` (2.6 s): the right hand brings a wallet from the coat, the
  left opens it: a licence card in a window, held still for 0.9 s where a
  man two stools to the left could see it (mark `shown` 1.3), a bill goes on
  the counter.
Smoke is an fx: call `game.fx.smoke` / `game.fx.cig?.` with the world
position of `hands.anchor('cigTip')` and `'mouth'`; lane 3 owns the effect.

## P0.5  The fists (scene 2)
Set `fists`, bare hands, sleeves pushed up. The punch-out view: the
opponent stands 1.45 m away in the middle of the frame; my fists frame him
from the bottom corners.
- `guard`: both fists up, knuckles toward him, thumbs outside, left a
  little ahead; they bob with my breath and rock with my weight. They
  occupy the bottom corners only: his head, shoulders and both of his hands
  stay visible between and above them, always.
- `jabL`, `jabR`: the fist shoots straight at his face along the centre
  line, foreshortened (it grows), turning palm-down at contact; snaps back.
- `heavyWind`: the right fist draws back and down out of the corner, the
  left opens forward for balance, the view twists 6 degrees to the right.
  `heavyHit`: the whole frame swings through with it (view yaw +10 then
  back, a 4 cm lunge); the fist crosses the frame from low right to high
  left.
- `block`: both forearms come up vertical, side by side, filling the lower
  middle of the frame, fists at brow height; `blockHit`: they jolt back
  toward the eye, the view kicks.
- `slipL`, `slipR`: the eye moves 0.45 m sideways and 0.12 m down, rolls 8
  degrees into the slip; the fists stay up and trail the move.
- `hurt`: a blow lands: the view snaps away from it (yaw 9 degrees, roll 5),
  the fists drop for 0.25 s, a white flash of 2 frames.
- `grab` then `swingBottle`, `swingPlate`, `swingStool`: the right hand
  takes what lane 7 hands it (`hands.hold(prop, 'R')`); a bottle is held by
  the neck and comes down overhand; a plate is thrown flat from the chest;
  a stool is swung two-handed from the right shoulder.
- `searchBody` (kneeling over the man on the pavement, the hand goes into
  his waistcoat pocket) and `showMatchbook` (the red matchbook held up
  between finger and thumb, turned once, pocketed).
Every timing in CONTRACTS §14 is a mark in the clip; lane 7 reads them.

## P1  Controller modes
`seated` (the view turns on the stool: past +-1.2 rad the stool swivels
with it; a slight lean when looking down the counter), `brawl` (locked on
the opponent's chest; footwork: I circle with him inside the ring, never
through a stool or a booth), `table`, `cutscene`, eased in and out in
0.4 s. Head bob and the footfall callback stay in `walk`.

## P2
Idle flourishes: drumming fingers on the counter after 20 s, turning the
lighter over, adjusting a cuff. Rain drops on the backs of the hands
outdoors.

## Intended golden changes
Frames with the gun in them: `viewmodel reload impacts muzzlesmoke hoods`,
**inside the hands and sleeves only**: the gun itself, its flash and the
world behind are identical. `battle_t15 battle_t30 battle_t45 perf end`
change as a whole (the autopilot reloads, and a longer reload shifts every
shot after it): there, check by eye that the fight is as alive as the
golden and the gun and hands are right.

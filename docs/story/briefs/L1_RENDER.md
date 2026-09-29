# Lane 1 — render guard

Branch `wave-a/L1-render`, port 5181. You own `src/render/**`. You are the
only lane that edits shaders, `Pipeline.js` and `layers.js`. You guard the
look: nothing you do may make an accepted frame worse.

## P0.1  Fix 8: reflections that lie on the street

**What is wrong today.** Look at `shots/golden/street.png` and
`shots/golden/wreck_t40.png`. Every lamp leaves a white column that runs
from under the horizon to the bottom edge of the frame. The burning wreck's
reflection starts a long way in front of the car, with black water between
the car and its own reflection, and hangs there as an upside-down picture of
the fire. The street reads as a mirror over a deep hole. The cause is the
model: a planar mirror (`rtRefl`) whose emitters are smeared one way, down
the screen, by a 40-tap streak that reaches 45 % of the frame
(`Pipeline.js` step 2, `ground.js` "reflection").

**What the user asked for.** A reflection is a sheen lying on the surface:
limited in length, fading with distance from its source, broken by the
ripples. For lamps, windows, headlights, fire, muzzle flashes, blood in the
air, the train's windows, neon: everything.

**The model to build.** Every emitter leaves a streak on the ground that
1. is **anchored at the emitter's foot** F (the ground point under it). The
   streak touches F. A burning car sits on its own reflection; a lamp's
   streak begins at the base of its post; a lit window's begins at the foot
   of its wall;
2. runs from F **toward the eye** along the ground, for a length
   `L = clamp(1.1 * h + 1.5, 1.5, 9.0)` metres, where h is the emitter's
   height above the ground (a 6 m lamp: about 8 m; a fire 1.5 m tall: about
   3 m; a muzzle flash at 1.4 m: about 3 m);
3. is brightest in its first third and **fades smoothly to nothing** at L
   (no hard end, no step). Width: the emitter's own width at F, growing by
   about 6 % of the distance run;
4. is **broken by the ripples**: keep today's dash language (white ripple
   slivers with dark gaps, denser at the core, the vertical dry-brush
   break-up, the ink blots cut out of it). That part of the look is
   accepted and loved; keep it;
5. never shows a recognisable upside-down image (no inverted flames, no
   window rectangles): light only.
A streak that reaches the bottom of the frame is allowed only when its
source is within about 8 m of the eye.

**How (a suggestion; engineer it as you see fit).** Keep the emitter-only
mirror render and its bright pass, since it already collects every kind of
emitter. Give the streak pass the mirror's depth, so each tap knows its
emitter's world position, hence its foot F and height h; make the gather
two-sided; weight each tap by the ground distance between the pixel's
ground point P and the streak axis from F toward the eye (the falloff along
it, the narrow Gaussian across it). Or drop the mirror for an analytic
pass over the light registry plus a low-cost splat of particle emitters.
Whatever you choose: half or quarter resolution, no more GPU time than
today's step 2 (`__noir.gpuProfile()`).

**Keep.** The tonal design of the road from `docs/PHASE1B_BRIEF.md` §1:
60 to 70 % of the road dark, distinct light under each lamp, sparse pale
dashes, the near grey wash with ink blots, the far road a soft mid grey.
The fire's streak keeps its warm colour and its dry-brush break-up; blood in
the air leaves a few red flecks at most.

**Proof.** `street`, `lamp`, `cars`, `wreck&t=8`, `wreck&t=40`,
`hoods`, `train&t=6`, `viewmodel` before and after, side by side, plus a new
preset `reflstudy`: the eye at 1.65 m looking along the road at a lamp post
12 m away, a lit window, a burning wreck at 15 m and a car with headlights,
so one frame shows four kinds of source. Measure and report for each
source: the gap between the foot and the start of the streak (must be 0),
the streak's length on the ground in metres, and that its luminance falls
monotonically from the first third to the end.
Intended golden changes: every exterior frame, **on the ground only**. Show
that the changed pixels lie on the street and pavement (mask the diff by
the ground's ids); sky, el, façade, cars, figures and the gun are identical.

## P0.2  The Look, indoors and out (CONTRACTS §9.1, §9.2)
- `pipeline.setLook(look)` drives the fog, exposure, the ink pass's screen
  rain overlay, the 3D rain's gain, grain and ambient, blended smoothly as
  the eye crosses a doorway. With the block's exterior Look every frame is
  pixel-identical to today.
- Dry volumes: the 3D rain, its splashes and the ripple rings never appear
  inside a `stage.dry` box (pass up to 4 boxes as uniforms). Seen from
  inside the diner, the rain falls beyond the glass.
- **Haze.** Indoors a lamp cone lights smoke, not rain: slow world-anchored
  curls drifting up through the cone (two octaves of noise scrolled
  upwards at about 0.08 m/s), soft, denser near the lamp. `Look.haze`
  scales it. A pendant lamp over the counter must look like the street
  lamps do in the rain: a soft cone you could put your hand into.
- **Interior surfaces are calm.** Look at
  `docs/story/stub_frames/scene_diner_settle.jpg` and
  `docs/story/stub_frames/scene_fight_round1.jpg` (the foundation's stand-in room): every
  wall, the ceiling and the floor carry the façade's heavy white dry-brush
  slashes, so the room looks like wet stone turned inside out. Give the
  ink a surface class for interiors (plaster, panelling, linoleum, wood,
  enamel, leather; by material flag or id class,
  `mesh.userData.inkSurface = 'plaster' | 'wood' | 'lino' | 'metal' |
  'cloth'`): flat dark washes that follow the light, with **sparse** short
  strokes only where a lamp's pool falls off into shadow; stroke coverage
  under 10 % of a wall, none on the ceiling. Lane 5 tags its meshes.
- Interior surfaces must use the full range: paper-white where a lamp's
  pool falls on the counter top, real black under the counter and in the
  corners, dry-brush greys between. Check the ink bands on a lit interior
  wall 3 m from the eye: brush strokes, never flat CG gradients, never a
  grid.

## P0.3  Accents (CONTRACTS §9.3)
`src/render/accents.js` is the only source of colour. Make each key print as
the table says and nothing else print colour at all:
- `ember`: a cigarette tip 4 to 10 px across must survive the ink pass as a
  deep orange point with a hot core and a glow of a few pixels; when the
  smoker drags (gain 3) the core goes yellow-white.
- `flame`: a lighter flame 20 to 40 px tall: pale yellow tongue, orange
  edge, a small warm-white light on the hand around it.
- `amber`: scotch. A rich honey amber at mid value (display value about
  0.55 to 0.7), darker and deeper than fire. Today's fire path lifts any
  orange to flame brightness: amber must not take that path. It may be keyed
  by an id class or a material flag rather than by hue.
- `neon`: a cold electric blue tube (display about #4aa8ff at the core,
  white-hot centre line), a tight glow, and its sheen on the wet pavement in
  the same blue through the reflection path.
- `crew`: the blood red, on an object.
Preset `accents`: one frame on the street with a test card of all seven
keys as small objects at 2 m, and their sheens on the wet road.

## P1.1  Glass you can see through (CONTRACTS §9.5)
`makeGlassMaterial({ wet, side, tint })`: the diner's plate glass.
- What is behind the pane is still inked (contours, brush). The pane adds:
  rain on its outer face (beads that sit, grow, then run down in crooked
  paths, fast then slow, leaving a trail that fades; world-anchored on the
  pane, deterministic in time), a faint grey sheen toward grazing angles,
  and two or three small paper-white smears where a lamp reflects.
- From inside looking out, the street is dimmer and softer through the wet
  glass (the rivulets bend the view a little: offset the lookup along the
  rivulet normals if you take a copy of the scene, or fake it with the
  streak alphas).
- A pane must still be a bullet target and must vanish piece by piece when
  lane 3 breaks it (it will swap geometry; your material must not care).
Preset `glassstudy`: a pane 3.5 x 2.2 m seen from 2 m inside, the street
beyond, at t = 4 and t = 12 (the water has moved).

## P1.2  Window light with rain shadows
`makeWindowLightMaterial({ w, h, slats: 0 | n })`: a soft additive patch of
light for a floor or a wall, as thrown by a street lamp through a wet
window: the pane's shape in perspective, soft-edged, with the rivulets'
shadows crawling down through it; with `slats` the shadow of a half-lowered
blind. It is the noir signature; keep it subtle (display lift of 0.1 to
0.2). `patch.userData.sweep(t0, speed)` runs a bright bar across it (the el
train passing).

## P2  Rooms behind far windows
`makeRoomMaterial(...)` for upper-floor windows that lane 3 breaks: a fake
room with depth (a back wall, a lit door crack, a curtain's edge) by
interior mapping, world-anchored, dark. Near windows get real rooms from
lane 4; this is only for panes above the second floor.

## Performance
Before and after, clean runs: `UNCAPPED=1 RUNS=3 node tools/fps.mjs
"shot=perf&t=1&anim=1" 1440 900` and `__noir.gpuProfile()`. No regression
beyond 3 %.

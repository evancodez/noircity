import * as THREE from 'three';

// Render layers decide which passes see an object.
//   WORLD   : opaque world geometry. Main pass, planar reflection, normal/id pass, shadows.
//   GROUND  : the wet street itself. Main pass + normal/id pass (never reflects itself).
//   FX      : translucent effects that must not be inked or reflected (3D rain, splashes).
//   FX_REFL : translucent effects that DO show up in the wet street (steam, sky).
//   VOLUME  : additive light (lamp cones, headlight beams, rain, splashes). Rendered
//             into a separate half-res buffer that the ink pass lays over the
//             inked image like airbrushed white, so light is never brush-banded.
//             Also drawn into the planar reflection.
//   RAIN    : like VOLUME but never reflected (3D rain streaks, splashes).
//   SKY     : the sky dome. Main pass only: the wet street's reflection is
//             emitters-only (Pipeline §2), the storm sky must not come back
//             as light across the whole road.
//   MIST    : the lamp-lit ground mist. Volume pass only, NEVER reflected: its
//             pools, mirrored and streaked, merged with the far columns into a
//             white plate on the road under the vanishing point.
export const LAYER = { WORLD: 0, GROUND: 1, FX: 2, FX_REFL: 3, VOLUME: 4, RAIN: 5, SKY: 6, MIST: 7 };

// Additive light that leaves the target's ALPHA untouched: the planar
// reflection uses alpha as 'opaque geometry coverage' (cleared 0, surfaces 1),
// so cones and mist drawn into it must add light without claiming coverage.
export const ADD_KEEP_ALPHA = {
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneFactor,
  blendSrcAlpha: THREE.ZeroFactor,
  blendDstAlpha: THREE.OneFactor,
};

export function setLayerDeep(obj, layer) {
  obj.traverse((o) => o.layers.set(layer));
  return obj;
}

// Object ids feed the contour detector: an id change always draws an ink line,
// so two overlapping black silhouettes still separate. Ids live in a half-float
// channel, which holds integers exactly up to 2048.
let nextId = 2; // 0 = sky/clear, 1 = untagged default
export function allocInkId(count = 1) {
  const id = nextId;
  nextId += count;
  if (nextId > HOOD_ID0 - 1) nextId = 2;
  return id;
}
export function inkIdsUsed() { return nextId; }

// Ids HOOD_ID0..HOOD_ID0+HOOD_SLOTS-1 are the Hoods (always written as
// figures, i.e. negative). Each slot also owns an entry in FIG_ANCHOR: the
// Hood's root position (xyz) and yaw (w), which the ink pass subtracts from
// a figure pixel's world position before sampling the brush, so the
// dry-brush strokes ride on the moving body instead of sliding over it.
export const HOOD_ID0 = 1790;
export const HOOD_SLOTS = 64;
export const FIG_ANCHOR = Array.from({ length: HOOD_SLOTS }, () => new THREE.Vector4());
const hoodSlots = new Array(HOOD_SLOTS).fill(false);
export function allocHoodSlot() {
  for (let i = 0; i < HOOD_SLOTS; i++) {
    if (!hoodSlots[i]) { hoodSlots[i] = true; return i; }
  }
  return -1;
}
export function releaseHoodSlot(i) { if (i >= 0) hoodSlots[i] = false; }
// Ids SKYLINE_ID0..IRON_ID0-1 are the far skyline (towers + their window
// flecks). The ink pass prints them as flat fogged silhouettes: no dry-brush
// strokes, no paper lift-outs, no contours or rims (Phase 1c polish #1).
export const SKYLINE_ID0 = 1860;
let nextSkyline = SKYLINE_ID0;
export function allocSkylineId() {
  const id = nextSkyline;
  nextSkyline = nextSkyline >= IRON_ID0 - 1 ? SKYLINE_ID0 : nextSkyline + 1;
  return id;
}
// Ids IRON_ID0..2040 are reserved for the el's ironwork. The ink pass keeps
// iron black under lamps (like a figure: the air glows, the steel does not)
// and draws its structure as broken highlight lines.
export const IRON_ID0 = 1900;
let nextIron = IRON_ID0;
export function allocIronId() {
  const id = nextIron;
  nextIron = nextIron >= 2040 ? IRON_ID0 : nextIron + 1;
  return id;
}
// Figures (cars, the Hoods) are written with a NEGATIVE id. The ink pass keeps
// them as black silhouettes against lit mist: cone light and bloom are painted
// around a figure, not over it, the way the reference inks its far car and
// mid-ground man solid black in front of the lamps.
export function markFigure(obj) {
  obj.traverse((o) => { if (o.isMesh) o.userData.inkFigure = true; });
  return obj;
}
export function tagInk(obj, id = allocInkId()) {
  obj.traverse((o) => { if (o.isMesh) o.userData.inkId = id; });
  return id;
}

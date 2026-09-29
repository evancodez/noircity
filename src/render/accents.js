import * as THREE from 'three';

// The accent registry (docs/story/CONTRACTS.md §9.3): the only colours that
// may print. The ink pass keeps a pixel's colour when its saturation is over
// ~0.25 (render/shaders/ink.js, the colour keep); everything else becomes
// ink. So every accent here is a strongly saturated linear colour, and a
// lane never writes a saturated colour by hand: it asks for a key.
//
//   accent(key, { gain: 1 }) -> THREE.Color (linear, scene-referred)
//   accentMaterial(key, { gain, map, additive }) -> Material
//
// FOUNDATION STUB (lane 1 owns this file): the colours survive today's
// colour keep, but only blood and fire have been looked at in a frame;
// ember, flame, amber and neon take the fire path of the ink pass until
// lane 1 gives each its own print (the brief's P0.3).
const KEYS = {
  // the reference red #c8102e, scene-referred as the blood in the air is
  // (fx/Blood.js BLOOD_AIR: unlit particles print it through the colour keep)
  blood: { rgb: [0.11, 0.00045, 0.0045], emit: true, gain: 1 },
  // orange to yellow-white (the fire atlas' mid flame)
  fire: { rgb: [1.0, 0.42, 0.08], emit: true, gain: 2.5 },
  // a cigarette's tip: deep orange with a hot core (Hood.js' cigarette)
  ember: { rgb: [1.0, 0.32, 0.05], emit: true, gain: 3 },
  // a lighter's tongue: pale yellow
  flame: { rgb: [1.0, 0.62, 0.16], emit: true, gain: 2.2 },
  // scotch: honey amber, darker than fire
  amber: { rgb: [0.62, 0.26, 0.035], emit: false },
  // the DINER sign: cold electric blue (#4aa8ff at the core)
  neon: { rgb: [0.07, 0.4, 1.0], emit: true, gain: 3 },
  // the Cardinal's red: the same red as blood, on an object
  crew: { rgb: [0.578, 0.0056, 0.0273], emit: false },
};
export const ACCENT_KEYS = Object.keys(KEYS);

export function accent(key, { gain = 1 } = {}) {
  const k = KEYS[key];
  if (!k) throw new Error(`accent: no key '${key}' (keys: ${ACCENT_KEYS.join(', ')})`);
  return new THREE.Color(k.rgb[0], k.rgb[1], k.rgb[2]).multiplyScalar(gain * (k.emit ? k.gain : 1));
}

// Emitters (blood in the air, fire, ember, flame, neon) are unlit; surfaces
// (amber, crew) are lit like any other object, so a lamp shapes them.
export function accentMaterial(key, { gain = 1, map = null, additive = false } = {}) {
  const k = KEYS[key];
  if (!k) throw new Error(`accentMaterial: no key '${key}'`);
  const color = accent(key, { gain });
  let m;
  if (k.emit || additive) {
    m = new THREE.MeshBasicMaterial({ color, map });
    if (additive) Object.assign(m, { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  } else {
    m = new THREE.MeshStandardMaterial({ color, map, roughness: 0.45, metalness: 0 });
  }
  m.name = 'accent_' + key;
  m.userData.accent = key;
  return m;
}

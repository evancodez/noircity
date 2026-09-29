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
// How each prints (lane 1, P0.3):
//   blood  the reference red #c8102e (the ink's red family)
//   fire   orange to yellow-white, lifted bright (the ink's fire family)
//   ember  a cigarette tip: a deep orange point with a hot core (the material
//          is hot where it faces the eye, deep orange at its rim) and a few
//          pixels of glow (the bloom); at gain 3 (a drag) the core goes
//          yellow-white
//   flame  a lighter's tongue: pale yellow body, orange edge (same core/rim
//          material, paler)
//   amber  scotch: a LIT surface, printed by its own rule (idpass class 6 ->
//          the ink's amber path: honey at mid value, never lifted to flame)
//   neon   the DINER tubes: cold electric blue (#4aa8ff through the ink's
//          display hue) with a white-hot centre line, a tight blue glow, and
//          its sheen in the wet street in the same blue (the reflection path
//          keeps its hue)
//   crew   the Cardinal's red on an object: the same red as blood, lit
const KEYS = {
  // the reference red #c8102e, scene-referred as the blood in the air is
  // (fx/Blood.js BLOOD_AIR: unlit particles print it through the colour keep)
  blood: { rgb: [0.11, 0.00045, 0.0045], emit: true, gain: 1 },
  // orange to yellow-white (the fire atlas' mid flame)
  fire: { rgb: [1.0, 0.42, 0.08], emit: true, gain: 2.5 },
  // a cigarette's tip: deep orange rim, hot core
  // (the rim's linear hue is deep - the ink displays it through a 1/2.2
  // gamma, where (1, .3, .04) read as a pale apricot)
  ember: { rgb: [1.0, 0.12, 0.012], core: [1.0, 0.42, 0.08], hot: [1.0, 0.85, 0.5], emit: true, gain: 10, corePow: 2.5 },
  // a lighter's tongue: pale yellow body, orange edge
  flame: { rgb: [1.0, 0.26, 0.03], core: [1.0, 0.8, 0.4], hot: [1.0, 0.93, 0.7], emit: true, gain: 2.2, corePow: 1.6 },
  // scotch: honey amber, darker than fire (a lit surface; ink class 6)
  amber: { rgb: [0.62, 0.26, 0.035], emit: false },
  // the DINER sign: cold electric blue, white-hot along the tube's centre
  neon: { rgb: [0.07, 0.4, 1.0], core: [0.55, 0.8, 1.0], hot: [0.8, 0.92, 1.0], emit: true, gain: 3, corePow: 6 },
  // the Cardinal's red: the same red as blood, on an object
  crew: { rgb: [0.578, 0.0056, 0.0273], emit: false },
};
export const ACCENT_KEYS = Object.keys(KEYS);

export function accent(key, { gain = 1 } = {}) {
  const k = KEYS[key];
  if (!k) throw new Error(`accent: no key '${key}' (keys: ${ACCENT_KEYS.join(', ')})`);
  return new THREE.Color(k.rgb[0], k.rgb[1], k.rgb[2]).multiplyScalar(gain * (k.emit ? k.gain : 1));
}

// An emitter that is hot where it faces the eye and its own colour at the
// rim: a cigarette tip's core, a flame's pale body, the neon tube's white
// centre line. uGain (1 at rest; a drag takes an ember to 3) pushes the core
// toward `hot`. Unlit, no fog (small near things), written like any mesh
// (the id pass and the reflection read it as they read a basic material).
function coreMaterial(k, gain, map, additive) {
  const m = new THREE.ShaderMaterial({
    uniforms: {
      uRim: { value: new THREE.Color(...k.rgb) },
      uCore: { value: new THREE.Color(...k.core) },
      uHot: { value: new THREE.Color(...k.hot) },
      uLevel: { value: k.gain },
      uGain: { value: gain },
      uPow: { value: k.corePow },
      tMap: { value: map },
      uUseMap: { value: map ? 1 : 0 },
    },
    vertexShader: /* glsl */`
      #include <common>
      #include <skinning_pars_vertex>
      varying vec3 vN;
      varying vec3 vV;
      varying vec2 vUv;
      void main() {
        #include <beginnormal_vertex>
        #include <skinbase_vertex>
        #include <skinnormal_vertex>
        #include <defaultnormal_vertex>
        #include <begin_vertex>
        #include <skinning_vertex>
        #include <project_vertex>
        vN = normalize( transformedNormal );
        vV = - mvPosition.xyz;
        vUv = uv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uRim, uCore, uHot;
      uniform float uLevel, uGain, uPow, uUseMap;
      uniform sampler2D tMap;
      varying vec3 vN;
      varying vec3 vV;
      varying vec2 vUv;
      void main() {
        vec3 n = normalize( vN );
        n = gl_FrontFacing ? n : -n;
        float f = pow( clamp( dot( n, normalize( vV ) ), 0.0, 1.0 ), uPow );
        // the core heats with the gain: at 3 (a drag) it is the hot colour
        vec3 core = mix( uCore, uHot, smoothstep( 1.2, 3.0, uGain ) );
        vec3 c = mix( uRim, core, f ) * uLevel * ( 0.55 + 0.45 * uGain ) * ( 0.7 + 0.6 * f );
        float a = 1.0;
        if ( uUseMap > 0.5 ) { vec4 t = texture2D( tMap, vUv ); c *= t.rgb; a = t.a; }
        gl_FragColor = vec4( c, a );
      }`,
  });
  if (additive) Object.assign(m, { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  // (the gain can be changed live: m.userData.setGain(3) for a drag)
  m.userData.setGain = (g) => { m.uniforms.uGain.value = g; };
  return m;
}

// Emitters (blood in the air, fire, ember, flame, neon) are unlit; surfaces
// (amber, crew) are lit like any other object, so a lamp shapes them.
export function accentMaterial(key, { gain = 1, map = null, additive = false } = {}) {
  const k = KEYS[key];
  if (!k) throw new Error(`accentMaterial: no key '${key}'`);
  let m;
  if (k.core) {
    m = coreMaterial(k, gain, map, additive);
  } else if (k.emit || additive) {
    m = new THREE.MeshBasicMaterial({ color: accent(key, { gain }), map });
    if (additive) Object.assign(m, { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  } else {
    m = new THREE.MeshStandardMaterial({ color: accent(key, { gain }), map, roughness: key === 'amber' ? 0.25 : 0.45, metalness: 0 });
  }
  m.name = 'accent_' + key;
  m.userData.accent = key;
  return m;
}

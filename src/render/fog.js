import * as THREE from 'three';

// Fog is applied in the scene pass (per material) rather than in post, so that
// additive light cones in front of the sky are not wrongly fogged by the depth
// of whatever is behind them. Built-in materials get it through an override of
// three's fog chunks; custom ShaderMaterials include NOIR_FOG_GLSL themselves.
//
// Two terms: distance haze (aerial perspective) and a ground mist that only
// thickens beyond MIST_START, so the near street stays crisp and black while
// the far end of the avenue dissolves into grey. The haze starts at
// HAZE_START and reaches ~80% by 150 m; the combined amount is SQUARED before
// it is applied, so solid silhouettes hold their black out to ~60 m (the
// reference's far car is still solid ink) and only then melt into the grey.
export const FOG = {
  color: new THREE.Color(0.095, 0.095, 0.095), // linear; prints ~#7e paper grey (render/tone.js)
  density: 0.0036,
  mistDensity: 0.014,
  mistHeight: 4.0,
  mistStart: 30.0,
  mistGain: 1.0,   // (was 1.5: stacked with the volume mist it printed a white wall; the
                   // lamp-lit glow is now the pooled volume mist's job, fx/GroundMist.js)
  hazeStart: 30.0,
  hazeK: 3.7,      // haze rate = density * hazeK (0.0134/m: ~80% at 150 m)
};

export const fogUniforms = {
  uFogColor: { value: FOG.color },
  uFogDensity: { value: FOG.density },
};

const f = (x) => x.toFixed(5);
export const NOIR_FOG_FUNC = /* glsl */`
float noirHaze( float dist, float density ) {
  return 1.0 - exp( - density * ${f(FOG.hazeK)} * max( dist - ${f(FOG.hazeStart)}, 0.0 ) );
}
float noirFogAmount( float dist, float wy, float density ) {
  float fogA = noirHaze( dist, density );
  float mist = ${f(FOG.mistDensity)} * exp( - max( wy, 0.0 ) / ${f(FOG.mistHeight)} )
             * smoothstep( ${f(FOG.mistStart)}, ${f(FOG.mistStart * 3.5)}, dist );
  fogA = 1.0 - ( 1.0 - fogA ) * exp( - mist * dist );
  fogA = clamp( fogA, 0.0, 1.0 );
  return fogA * fogA;
}
// Colour + opacity: grey distance fog blended with brighter lamp-lit ground mist.
vec4 noirFog( float dist, float wy, float density, vec3 fogCol ) {
  float a = noirHaze( dist, density );
  float mist = ${f(FOG.mistDensity)} * exp( - max( wy, 0.0 ) / ${f(FOG.mistHeight)} )
             * smoothstep( ${f(FOG.mistStart)}, ${f(FOG.mistStart * 3.5)}, dist );
  float m = 1.0 - exp( - mist * dist );
  float A = 1.0 - ( 1.0 - a ) * ( 1.0 - m );
  float share = m / max( a + m, 1e-4 );
  A = clamp( A, 0.0, 1.0 );
  return vec4( fogCol * mix( 1.0, ${f(FOG.mistGain)}, share ), A * A );
}
`;

// For custom shaders: uniforms + function.
export const NOIR_FOG_GLSL = /* glsl */`
uniform vec3 uFogColor;
uniform float uFogDensity;
${NOIR_FOG_FUNC}
`;

export function installFogChunks() {
  const C = THREE.ShaderChunk;
  // The view-space POSITION is interpolated, not its length: length() is not
  // affine, so on long polygons (kerbs, the 60 m façade box) a per-vertex
  // distance smears the far end's fog over the near end.
  C.fog_pars_vertex = /* glsl */`
#ifdef USE_FOG
  varying vec3 vFogViewPos;
  varying float vFogWorldY;
#endif`;
  C.fog_vertex = /* glsl */`
#ifdef USE_FOG
  vFogViewPos = mvPosition.xyz;
  {
    vec4 fogWP = vec4( transformed, 1.0 );
    #ifdef USE_INSTANCING
      fogWP = instanceMatrix * fogWP;
    #endif
    vFogWorldY = ( modelMatrix * fogWP ).y;
  }
#endif`;
  C.fog_pars_fragment = /* glsl */`
#ifdef USE_FOG
  uniform vec3 fogColor;
  varying vec3 vFogViewPos;
  varying float vFogWorldY;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
  ${NOIR_FOG_FUNC}
#endif`;
  C.fog_fragment = /* glsl */`
#ifdef USE_FOG
  float vFogDepth = length( vFogViewPos );
  #ifdef FOG_EXP2
    vec4 noirF = noirFog( vFogDepth, vFogWorldY, fogDensity, fogColor );
    gl_FragColor.rgb = mix( gl_FragColor.rgb, noirF.rgb, noirF.a );
  #else
    float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
    gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
  #endif
#endif`;
}

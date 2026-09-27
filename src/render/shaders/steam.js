import * as THREE from 'three';
import { HASH_GLSL, LAMPS_GLSL } from './common.js';
import { NOIR_FOG_GLSL } from '../fog.js';

// Steam puffs rising from grates. Fully GPU-animated: each instance cycles
// through its life from uTime; billboards face the camera; soft-particle fade
// against the opaque depth so puffs never show a hard line on the street.
export function makeSteamMaterial(U, puffTex) {
  return new THREE.ShaderMaterial({
    name: 'NoirSteam',
    transparent: true,
    depthWrite: false,
    uniforms: {
      ...U,
      tPuff: { value: puffTex },
      uStrength: { value: 1.0 },
    },
    vertexShader: /* glsl */`
      attribute vec4 aSeed;   // x: phase, y: life, z/w: random
      attribute vec3 aOrigin; // vent position
      uniform float uTime;
      varying vec2 vUvP;
      varying float vA;
      varying float vLight;
      varying float vDist;
      varying float vWY;
      varying float vViewZ;
      varying float vRot;
      ${HASH_GLSL}
      ${LAMPS_GLSL}
      void main() {
        float life = aSeed.y;
        float t = fract( uTime / life + aSeed.x );
        float cyc = floor( uTime / life + aSeed.x );
        vec2 j = hash22( vec2( aSeed.z * 91.0, cyc ) ) - 0.5;
        vec3 c = aOrigin;
        c.y += 0.05 + t * t * 0.4 + t * 3.2;
        c.xz += j * 0.6 + vec2( 0.9, 0.25 ) * t * t * 2.2;
        float size = mix( 0.3, 1.9, sqrt( t ) ) * ( 0.8 + 0.4 * aSeed.w );
        vec4 mv = viewMatrix * vec4( c, 1.0 );
        float ang = aSeed.z * 6.28 + t * ( aSeed.w - 0.5 ) * 2.0;
        vec2 q = mat2( cos( ang ), -sin( ang ), sin( ang ), cos( ang ) ) * position.xy;
        mv.xy += q * size;
        vUvP = uv;
        vA = smoothstep( 0.0, 0.12, t ) * ( 1.0 - smoothstep( 0.45, 1.0, t ) );
        vLight = lampCones( c );
        vDist = length( mv.xyz );
        vWY = c.y;
        vViewZ = - mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D tPuff, tDepth;
      uniform vec2 uRes;
      uniform float uNear, uFar, uUseDepth, uStrength;
      varying vec2 vUvP;
      varying float vA;
      varying float vLight;
      varying float vDist;
      varying float vWY;
      varying float vViewZ;
      ${NOIR_FOG_GLSL}
      float linZ( float d ) {
        float ndc = d * 2.0 - 1.0;
        return ( 2.0 * uNear * uFar ) / ( uFar + uNear - ndc * ( uFar - uNear ) );
      }
      void main() {
        float p = texture2D( tPuff, vUvP ).r;
        float a = p * vA * 0.45 * uStrength;
        if ( uUseDepth > 0.5 ) {
          float d = texture2D( tDepth, gl_FragCoord.xy / uRes ).r;
          float sz = d < 0.999999 ? linZ( d ) : 1e5;
          a *= smoothstep( 0.0, 0.8, sz - vViewZ );
        }
        a *= smoothstep( 0.3, 1.2, vViewZ );
        vec4 nf = noirFog( vDist, vWY, uFogDensity, uFogColor );
        vec3 col = vec3( 0.07 + vLight * 0.22 );  // grey veil, lit where it drifts through a cone
        col = mix( col, nf.rgb, nf.a );
        gl_FragColor = vec4( col, a );
      }`,
  });
}

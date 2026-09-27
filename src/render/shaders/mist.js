import * as THREE from 'three';
import { HASH_GLSL, LAMPS_GLSL } from './common.js';
import { NOIR_FOG_GLSL } from '../fog.js';
import { ADD_KEEP_ALPHA } from '../layers.js';
import { linearFor, EXPOSURE } from '../tone.js';

// Lamp-lit ground mist: the soft grey haze that lies on the far street
// between the el's columns in the reference (behind the shot man, around the
// far car). A low slab ray-marched in the volume pass like the cones. It is
// NOT a uniform band (that summed into a flat white wall): it POOLS under
// each lamp (Gaussian, sigma ~5 m, where the lamp's axis meets the street),
// billows with low-frequency noise, and is capped (uCap, scene-linear:
// ~0.05 prints ~0.43 on black, so over the grey distance it stays a soft
// mid grey and the far car and columns remain legible against it).
// In the planar reflection (no depth, whole slab integrated) only the pools
// may rise above the bright-pass threshold, so the road gets a column under
// each lamp, not a white lake.
export function makeMistMaterial(U, { min, max, intensity = 1 }) {
  return new THREE.ShaderMaterial({
    name: 'NoirGroundMist',
    side: THREE.BackSide,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    ...ADD_KEEP_ALPHA,
    uniforms: {
      ...U,
      uMin: { value: min.clone() },
      uMax: { value: max.clone() },
      uIntensity: { value: intensity },
      uHeight: { value: 1.5 },   // e-folding height of the mist (m)
      uStart: { value: new THREE.Vector2(9, 22) },   // camera distance: fade in over this range
      uCap: { value: 0.035 },       // max added light (scene-linear) in the view
      uCapRefl: { value: 0.075 },   // ... and in the planar reflection (pools -> columns)
      uDensity: { value: 0.011 },   // light per metre of pool-centre mist, view
      uDensityRefl: { value: 0.045 }, // ... reflection (5 m segment: pool centre ~T + 0.02)
      uSigma: { value: 5.0 },       // pool radius (m)
      // mist + backdrop never above this (scene-linear). Phase 1c: 0.075
      // (~0.55 display) -> linearFor(0.48): the far plate under the
      // vanishing point stays separate pools on a ~0.37 road, not one patch
      uDispCap: { value: linearFor(0.48) / EXPOSURE },
      uSigmaFar: { value: 4.0 },    // pool radius (m) for lamps beyond ~40 m
    },
    vertexShader: /* glsl */`
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4( position, 1.0 );
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uMin, uMax;
      uniform float uIntensity, uHeight, uCap, uCapRefl, uSigma, uSigmaFar, uDensity, uDensityRefl, uDispCap;
      uniform vec2 uStart;
      uniform sampler2D tDepth, tNoise;
      uniform vec2 uRes;
      uniform float uNear, uFar, uUseDepth, uTime;
      varying vec3 vWorld;
      ${HASH_GLSL}
      ${LAMPS_GLSL}
      ${NOIR_FOG_GLSL}
      float linZ( float d ) {
        float ndc = d * 2.0 - 1.0;
        return ( 2.0 * uNear * uFar ) / ( uFar + uNear - ndc * ( uFar - uNear ) );
      }
      // light falling into the mist: every lamp throws a broad pool on the
      // ground (Gaussian around where its axis meets the street)
      float lampPools( vec3 p ) {
        float acc = 0.0;
        for ( int i = 0; i < MAX_LAMPS; i ++ ) {
          if ( i >= uLampCount ) break;
          vec4 prm = uLampParams[ i ];
          if ( prm.z <= 0.0 || prm.x < -0.5 ) continue;   // skip omni (booth) lights
          vec3 lp = uLampPos[ i ];
          vec3 ld = uLampDir[ i ];
          if ( ld.y > -0.3 ) continue;                     // headlights: not a pool
          vec3 g = lp + ld * ( lp.y / - ld.y );
          vec2 dv = p.xz - g.xz;
          float r2 = dot( dv, dv );
          // far pools are tighter, so down the avenue they stay separate
          // (the mirrored camera shares the eye's x/z)
          float sg = mix( uSigma, uSigmaFar, smoothstep( 34.0, 44.0, length( g.xz - cameraPosition.xz ) ) );
          acc += prm.z * exp( - r2 / ( 2.0 * sg * sg ) );
        }
        return acc;
      }
      void main() {
        if ( uIntensity <= 0.0 ) discard;
        vec3 ro = cameraPosition;
        vec3 rd = normalize( vWorld - ro );
        // ray / box slab intersection
        vec3 inv = 1.0 / ( rd + vec3( 1e-6 ) );
        vec3 ta = ( uMin - ro ) * inv, tb = ( uMax - ro ) * inv;
        vec3 tmn = min( ta, tb ), tmx = max( ta, tb );
        float t0 = max( max( tmn.x, tmn.y ), max( tmn.z, 0.0 ) );
        float t1 = min( min( tmx.x, tmx.y ), tmx.z );
        float tSurf = 1e6;
        if ( uUseDepth > 0.5 ) {
          float d = texture2D( tDepth, gl_FragCoord.xy / uRes ).r;
          if ( d < 0.999999 ) {
            vec3 fwd = - vec3( viewMatrix[ 0 ][ 2 ], viewMatrix[ 1 ][ 2 ], viewMatrix[ 2 ][ 2 ] );
            tSurf = linZ( d ) / max( dot( rd, fwd ), 1e-3 );
            t1 = min( t1, tSurf );
          }
        }
        // the mist only begins some way down the street
        t0 = max( t0, uStart.x );
        // planar reflection: the mirrored ray enters the slab at the street
        // point it is reflected in; only the mist within a few metres of
        // that point counts, so a pool mirrors as a local glow under its
        // lamp instead of every ray summing 150 m of slab into a white lake
        if ( uUseDepth < 0.5 ) t1 = min( t1, t0 + 5.0 );
        if ( t1 <= t0 ) discard;
        const int STEPS = 10;
        float dt = ( t1 - t0 ) / float( STEPS );
        float j = ign( gl_FragCoord.xy + fract( uTime * 7.0 ) * 61.0 );
        float acc = 0.0, accNear = 0.0;
        for ( int i = 0; i < STEPS; i ++ ) {
          float t = t0 + ( float( i ) + j ) * dt;
          vec3 x = ro + rd * t;
          // soft box: the slab never shows its sides
          vec3 e = min( x - uMin, uMax - x );
          float box = smoothstep( 0.0, 5.0, e.x ) * smoothstep( 0.0, 14.0, e.z );
          float hgt = exp( - max( x.y, 0.0 ) / uHeight ) * ( 1.0 - smoothstep( uMax.y * 0.55, uMax.y, x.y ) );
          // billowing banks: low-frequency noise, slowly drifting
          float n = texture2D( tNoise, x.xz * 0.028 + vec2( uTime * 0.004, - uTime * 0.003 ) ).g * 0.65
                  + texture2D( tNoise, x.xz * 0.09 + x.y * 0.08 - uTime * 0.012 ).r * 0.35;
          float bank = smoothstep( 0.3, 0.72, n );
          // light only where a lamp pools it (a trace elsewhere)
          float lit = 0.03 + lampPools( x );
          float fadeIn = smoothstep( uStart.x, uStart.y, t );
          // (Phase 1c) the far plate under the vanishing point: every ray
          // there crosses 100 m of slab and all the far pools line up along
          // it, summing into one bright patch; beyond ~30 m the mist thins
          // so the far pools stay separate soft glows on a ~0.4 road
          float farThin = mix( 1.0, 0.3, smoothstep( 26.0, 46.0, t ) );
          float a = hgt * box * ( 0.2 + 0.8 * bank ) * lit * fadeIn * farThin;
          acc += a;
          accNear += a * smoothstep( tSurf - 9.0, tSurf - 4.0, t );
        }
        float refl = 1.0 - step( 0.5, uUseDepth );
        acc *= dt * mix( uDensity, uDensityRefl, refl );
        accNear *= dt * mix( uDensity, uDensityRefl, refl );
        // capped: however many pools line up along the ray, the mist never
        // adds more than uCap (soft saturation)
        float cap = mix( uCap, uCapRefl, refl );
        // Display cap (~0.48): the mist is ADDED over whatever lies behind
        // it, and the far street's backdrop is already the grey fog / horizon
        // (~0.4-0.6 display): mist + backdrop summed into the flat white wall.
        // So the mist may only lift the backdrop up to uDispCap (scene-
        // linear): over a black near column it adds its full pool light
        // (feet dissolve into haze), over the fogged distance or the sky it
        // adds nothing, and the far car and columns stay legible against a
        // soft mid-grey instead of a white wall.
        if ( refl < 0.5 ) {
          float bgFog = 1.0;
          if ( tSurf < 1e5 ) {
            vec3 ps = ro + rd * tSurf;
            bgFog = noirFogAmount( tSurf, ps.y, uFogDensity );
          }
          float bgL = dot( uFogColor, vec3( 0.2126, 0.7152, 0.0722 ) ) * bgFog;
          cap = min( cap, max( uDispCap - bgL, 0.0 ) );
          if ( cap <= 1e-5 ) discard;
        }
        float total = uIntensity * cap * ( 1.0 - exp( - acc / cap ) );
        // G = the share lying within a few metres of the surface behind (the
        // ink pass' figure rule: a car keeps its black against the haze, a
        // far column's feet dissolve into it)
        float nearShare = uUseDepth > 0.5 ? accNear / max( acc, 1e-5 ) : 1.0;
        gl_FragColor = vec4( total, total * nearShare, total, 1.0 );
      }`,
  });
}

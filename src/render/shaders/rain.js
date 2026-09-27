import * as THREE from 'three';
import { HASH_GLSL, LAMPS_GLSL, DEPTH_TEST_GLSL } from './common.js';
import { NOIR_FOG_GLSL } from '../fog.js';

// 3D rain: instanced camera-facing streak quads living in a box around the
// camera. Positions are computed in the vertex shader from time (no CPU work)
// and wrap in WORLD space, so drops stay put as the player moves. Each streak
// is lit by the lamp cones it falls through (lampCones), so rain is nearly
// invisible in the dark and glitters inside every light.
export function makeRainMaterial(U) {
  return new THREE.ShaderMaterial({
    name: 'NoirRain',
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      ...U,
      uBoxCenter: { value: new THREE.Vector3() },
      uBoxSize: { value: new THREE.Vector3(32, 16, 32) },  // dense where it is seen: ~1.2 streaks per m^3
      uFall: { value: 10.5 },
      uWind: { value: new THREE.Vector2(-1.9, 0.4) },  // leans like the reference: top to the right
      // long hairlines, not beads: 1.4-3.4 m streaks, never thinner than
      // ~1.8 px of the half-res volume buffer they are drawn into (thinner
      // quads alias into dotted dashes), dimmed instead as they recede
      uLen: { value: 2.4 },
      uWidth: { value: 0.006 },
      uPixelAngle: { value: 0.0006 },   // set per frame by world/Rain.js
      uBase: { value: 0.03 },   // outside the cones: barely visible (reference)
      uLit: { value: 0.72 },
      uAmount: { value: 1.0 },
    },
    vertexShader: /* glsl */`
      attribute vec4 aSeed;
      uniform vec3 uBoxCenter, uBoxSize;
      uniform float uTime, uFall, uLen, uWidth, uPixelAngle, uAmount;
      uniform vec2 uWind;
      varying vec2 vUvR;
      varying float vAlpha;
      varying float vLight;
      varying float vDist;
      varying float vWY;
      varying float vViewZ;
      varying float vBright;
      ${HASH_GLSL}
      ${LAMPS_GLSL}
      void main() {
        // every streak its own: length, weight, value and lean all vary, so
        // the lit rain inside a cone never prints as a comb of equal bars
        vec2 hA = hash22( aSeed.xy * 173.1 + aSeed.z * 31.7 );
        vec2 hB = hash22( aSeed.zw * 97.3 + 5.1 );
        float spd = uFall * ( 0.8 + 0.4 * aSeed.w );
        // +/- 2.5 deg of lean jitter around the wind
        vec2 wind = uWind + ( hB - 0.5 ) * 2.0 * spd * 0.0437;
        vec3 vel = vec3( wind.x, - spd, wind.y );
        vec3 lo = uBoxCenter - 0.5 * uBoxSize;
        vec3 p = aSeed.xyz * uBoxSize + vel * uTime;
        p = lo + mod( p - lo, uBoxSize );
        vec3 axis = normalize( vel );
        // 0.5 - 2.4 m, most of them short: long bars are the exception
        float len = uLen * mix( 0.22, 1.0, hA.x * ( 0.5 + 0.5 * hA.x ) );
        vec3 toCam = cameraPosition - p;
        float dist = length( toCam );
        vec3 side = normalize( cross( axis, toCam / dist ) );
        float wd = uWidth * mix( 0.67, 1.17, hB.y );
        float w = max( wd, dist * uPixelAngle * 1.5 );
        // near streaks (a metre or two away) would print as wide bright
        // stripes: they fade out before they get that close
        vAlpha = ( wd / w ) * smoothstep( 1.6, 4.5, dist ) * step( aSeed.w, uAmount );
        vBright = mix( 0.3, 1.0, hA.y );
        vec3 wp = p + axis * ( position.y * len ) + side * ( position.x * w );
        vUvR = uv;
        vLight = min( lampCones( p ), 2.5 );
        vDist = dist;
        vWY = p.y;
        vec4 mv = viewMatrix * vec4( wp, 1.0 );
        vViewZ = - mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float uBase, uLit;
      uniform sampler2D tDepth;
      uniform vec2 uRes;
      uniform float uNear, uFar;
      varying vec2 vUvR;
      varying float vAlpha;
      varying float vLight;
      varying float vDist;
      varying float vWY;
      varying float vViewZ;
      varying float vBright;
      ${NOIR_FOG_GLSL}
      ${DEPTH_TEST_GLSL}
      void main() {
        if ( behindScene( vViewZ, 0.05 ) ) discard;
        float across = 1.0 - abs( vUvR.x - 0.5 ) * 2.0;
        // flat along the streak: no bright bead in the middle
        float along = smoothstep( 0.0, 0.15, vUvR.y ) * smoothstep( 1.0, 0.85, vUvR.y );
        float a = across * along * vAlpha;
        float fogF = noirFogAmount( vDist, vWY, uFogDensity );
        float bright = ( uBase + vLight * uLit ) * vBright * ( 1.0 - fogF );
        // B channel only: the ink pass lays rain over the INKED image in
        // display space (a thin white line reads even over a bright cone,
        // which it could not if it were summed into the cone's light first)
        gl_FragColor = vec4( 0.0, 0.0, bright * a, 1.0 );
      }`,
  });
}

// Splash rings on the wet ground, visible only where lamps light the street.
export function makeSplashMaterial(U) {
  return new THREE.ShaderMaterial({
    name: 'NoirSplash',
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      ...U,
      uCenter: { value: new THREE.Vector3() },
      uRadius: { value: 16 },
      uRate: { value: 1.6 },
      uKerbX: { value: -6.0 },
    },
    vertexShader: /* glsl */`
      attribute vec4 aSeed;
      uniform vec3 uCenter;
      uniform float uRadius, uTime, uRate, uKerbX;
      varying vec2 vUvS;
      varying float vPh;
      varying float vLight;
      varying float vDist;
      varying float vViewZ;
      ${HASH_GLSL}
      ${LAMPS_GLSL}
      void main() {
        float tt = uTime * uRate * ( 0.8 + 0.4 * aSeed.w ) + aSeed.z * 17.0;
        float cyc = floor( tt );
        float ph = tt - cyc;
        vec2 h = hash22( aSeed.xy * 97.0 + cyc * 1.618 );
        vec2 pos = uCenter.xz + ( h - 0.5 ) * 2.0 * uRadius;
        float y = pos.x < uKerbX ? 0.163 : 0.013;
        float size = 0.3 + 0.6 * aSeed.w; // ring radius 0.15-0.45 m
        vec3 wp = vec3( pos.x + position.x * size, y, pos.y + position.z * size );
        vUvS = uv;
        vPh = ph;
        vLight = lampCones( vec3( pos.x, 0.2, pos.y ) );
        vDist = length( cameraPosition - wp );
        vec4 mv = viewMatrix * vec4( wp, 1.0 );
        vViewZ = - mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D tDepth;
      uniform vec2 uRes;
      uniform float uNear, uFar;
      varying vec2 vUvS;
      varying float vPh;
      varying float vLight;
      varying float vDist;
      varying float vViewZ;
      ${DEPTH_TEST_GLSL}
      void main() {
        if ( behindScene( vViewZ, 0.08 ) ) discard;
        float r = length( vUvS - 0.5 ) * 2.0;
        float R = 0.15 + vPh * 0.85;
        // a thin drawn circle (the reference's foreground ripple rings), a
        // second fainter ring trailing inside it, and a tiny crown at birth
        float ring = exp( - pow( ( r - R ) * 24.0, 2.0 ) ) * ( 1.0 - vPh ) * ( 1.0 - vPh );
        float R2 = R * 0.6;
        ring += 0.45 * exp( - pow( ( r - R2 ) * 24.0, 2.0 ) ) * ( 1.0 - vPh ) * smoothstep( 0.1, 0.35, vPh );
        float crown = exp( - r * r * 900.0 ) * smoothstep( 0.2, 0.0, vPh );
        float a = ( ring + crown * 2.0 ) * smoothstep( 25.0, 8.0, vDist );
        gl_FragColor = vec4( 0.0, 0.0, a * ( 0.02 + vLight * 0.5 ), 1.0 );
      }`,
  });
}

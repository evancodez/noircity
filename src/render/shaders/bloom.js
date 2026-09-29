import * as THREE from 'three';
import { FULLSCREEN_VERT, LUMA_GLSL } from './common.js';

// Small mip-chain bloom (prefilter -> 4-tap downsamples -> tent upsamples).
// Runs in linear HDR so lamp heads, cones and (later) muzzle flashes glow.

export function makeBloomPrefilter() {
  return new THREE.ShaderMaterial({
    name: 'BloomPrefilter',
    depthTest: false, depthWrite: false,
    uniforms: { tSrc: { value: null }, tId: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 1.3 }, uKnee: { value: 0.6 } },
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: /* glsl */`
      uniform sampler2D tSrc, tId; uniform vec2 uTexel; uniform float uThreshold; uniform float uKnee;
      varying vec2 vUv;
      ${LUMA_GLSL}
      vec3 prefilter( vec3 c ) {
        float l = luma( c );
        // soft knee: smooth ramp into the threshold instead of a hard clip
        float rq = clamp( l - uThreshold + uKnee, 0.0, 2.0 * uKnee );
        rq = rq * rq / ( 4.0 * uKnee + 1e-4 );
        float w = max( rq, l - uThreshold ) / max( l, 1e-4 );
        return c * w;
      }
      float emberW( vec2 uv ) {
        float n = length( texture2D( tId, uv ).xyz );
        return step( 20.0, n ) * step( n, 22.0 );
      }
      void main() {
        vec3 a = texture2D( tSrc, vUv + uTexel * vec2( -0.5, -0.5 ) ).rgb;
        vec3 b = texture2D( tSrc, vUv + uTexel * vec2(  0.5, -0.5 ) ).rgb;
        vec3 c = texture2D( tSrc, vUv + uTexel * vec2( -0.5,  0.5 ) ).rgb;
        vec3 d = texture2D( tSrc, vUv + uTexel * vec2(  0.5,  0.5 ) ).rgb;
        // clamp fireflies before averaging
        vec3 pa = min( prefilter( a ), 60.0 ), pb = min( prefilter( b ), 60.0 ), pc = min( prefilter( c ), 60.0 ), pd = min( prefilter( d ), 60.0 );
        vec3 s = pa + pb + pc + pd;
        // alpha: the share of this glow that is an ember's (idpass class
        // 10, the normal's length 21): the ink warms the ember's glow by it,
        // keyed by the class and never by hue (the fire keeps its print).
        // The chain carries it as it carries the light (rgb untouched).
        float e = emberW( vUv + uTexel * vec2( -0.5, -0.5 ) ) * luma( pa ) + emberW( vUv + uTexel * vec2( 0.5, -0.5 ) ) * luma( pb )
                + emberW( vUv + uTexel * vec2( -0.5, 0.5 ) ) * luma( pc ) + emberW( vUv + uTexel * vec2( 0.5, 0.5 ) ) * luma( pd );
        gl_FragColor = vec4( s * 0.25, e * 0.25 );
      }`,
  });
}

export function makeBloomDown() {
  return new THREE.ShaderMaterial({
    name: 'BloomDown',
    depthTest: false, depthWrite: false,
    uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } },
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: /* glsl */`
      uniform sampler2D tSrc; uniform vec2 uTexel;
      varying vec2 vUv;
      void main() {
        vec4 s = texture2D( tSrc, vUv + uTexel * vec2( -1.0, -1.0 ) )
               + texture2D( tSrc, vUv + uTexel * vec2(  1.0, -1.0 ) )
               + texture2D( tSrc, vUv + uTexel * vec2( -1.0,  1.0 ) )
               + texture2D( tSrc, vUv + uTexel * vec2(  1.0,  1.0 ) );
        gl_FragColor = s * 0.25;
      }`,
  });
}

export function makeBloomUp() {
  return new THREE.ShaderMaterial({
    name: 'BloomUp',
    depthTest: false, depthWrite: false,
    blending: THREE.AdditiveBlending,
    transparent: true,
    // (premultiplied: ONE, ONE - the light is added exactly as before, and
    // the alpha, the ember's share, is added with it)
    premultipliedAlpha: true,
    uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uScale: { value: 1.0 } },
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: /* glsl */`
      uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uScale;
      varying vec2 vUv;
      void main() {
        vec2 t = uTexel;
        vec4 s = texture2D( tSrc, vUv ) * 4.0;
        s += ( texture2D( tSrc, vUv + vec2( t.x, 0.0 ) ) + texture2D( tSrc, vUv - vec2( t.x, 0.0 ) )
             + texture2D( tSrc, vUv + vec2( 0.0, t.y ) ) + texture2D( tSrc, vUv - vec2( 0.0, t.y ) ) ) * 2.0;
        s += texture2D( tSrc, vUv + t ) + texture2D( tSrc, vUv - t )
           + texture2D( tSrc, vUv + vec2( t.x, -t.y ) ) + texture2D( tSrc, vUv + vec2( -t.x, t.y ) );
        gl_FragColor = s * ( uScale / 16.0 );
      }`,
  });
}

// ---- wet-street reflection: bright pass ---------------------------------
// The planar reflection is rendered EMITTERS-ONLY (black clear, black fog:
// Pipeline §2). The bright pass keeps only light above uThreshold (set just
// above lamp-lit stone), so lamp heads, windows, headlights, fire and flashes
// survive while the mist and a wet black car body leave nothing. It also
// downsamples half res -> quarter res (2x2 box). What it keeps becomes a
// sheen on the street at each emitter's foot (shaders/reflstreak.js); the
// far emitters are dimmed there, by their real distance. (The old elevation
// estimate of the distance and the long screen-space column it fed are gone
// with fix 8.)
export function makeReflBrightMaterial() {
  return new THREE.ShaderMaterial({
    name: 'ReflBright',
    depthTest: false, depthWrite: false,
    uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 0.1 } },
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: /* glsl */`
      uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThreshold;
      varying vec2 vUv;
      ${LUMA_GLSL}
      vec3 keep( vec3 c ) {
        c = min( c, vec3( 40.0 ) );                 // fireflies
        float l = luma( c );
        return c * ( max( l - uThreshold, 0.0 ) / max( l, 1e-4 ) );
      }
      void main() {
        vec3 s = keep( texture2D( tSrc, vUv + uTexel * vec2( -0.5, -0.5 ) ).rgb )
               + keep( texture2D( tSrc, vUv + uTexel * vec2(  0.5, -0.5 ) ).rgb )
               + keep( texture2D( tSrc, vUv + uTexel * vec2( -0.5,  0.5 ) ).rgb )
               + keep( texture2D( tSrc, vUv + uTexel * vec2(  0.5,  0.5 ) ).rgb );
        gl_FragColor = vec4( s * 0.25, 1.0 );
      }`,
  });
}

// Separable 5-tap Gaussian used on the half-res volume buffer (lamp cones):
// it feathers every cone edge so no light shape ever ends in a ruled line.
// Run twice (horizontal, then vertical) via uDir.
export function makeBlurMaterial() {
  return new THREE.ShaderMaterial({
    name: 'VolBlur',
    depthTest: false, depthWrite: false,
    uniforms: { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } },
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: /* glsl */`
      uniform sampler2D tSrc; uniform vec2 uDir;
      varying vec2 vUv;
      void main() {
        // 1-4-6-4-1 binomial at 1.5-texel spacing: a ~5 px feather at full res
        vec4 s = texture2D( tSrc, vUv ) * 6.0
               + ( texture2D( tSrc, vUv + uDir * 1.5 ) + texture2D( tSrc, vUv - uDir * 1.5 ) ) * 4.0
               + ( texture2D( tSrc, vUv + uDir * 3.0 ) + texture2D( tSrc, vUv - uDir * 3.0 ) );
        gl_FragColor = s / 16.0;
      }`,
  });
}

// Phase 3c performance pass: the bloom chain in TWO levels (half and quarter
// res) instead of five. The three small levels (1/8 .. 1/32 res) carried the
// lamps' wide soft glow; their six tiny passes cost ~0.25 ms a frame (each
// pass has a fixed cost on the tiled GPU whatever its size). The quarter-res
// level is now mipmapped by the GPU in one call, and this last upsample
// (quarter -> half res) reads its mips 1..3 with the same tent the chain
// used - the chain's nested sum L1 + k T(L2 + k T(L3 + k T(L4))) flattened
// into one pass, k^n weights and all - so the lamp halos keep their width.
export function makeBloomUpWide() {
  return new THREE.ShaderMaterial({
    name: 'BloomUpWide',
    depthTest: false, depthWrite: false,
    blending: THREE.AdditiveBlending,
    transparent: true,
    premultipliedAlpha: true,   // (see makeBloomUp)
    uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uScale: { value: 1.0 }, uSpread: { value: 1.3 } },
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: /* glsl */`
      uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uScale, uSpread;
      varying vec2 vUv;
      vec4 tent( float lod, vec2 t ) {
        vec4 s = textureLod( tSrc, vUv, lod ) * 4.0;
        s += ( textureLod( tSrc, vUv + vec2( t.x, 0.0 ), lod ) + textureLod( tSrc, vUv - vec2( t.x, 0.0 ), lod )
             + textureLod( tSrc, vUv + vec2( 0.0, t.y ), lod ) + textureLod( tSrc, vUv - vec2( 0.0, t.y ), lod ) ) * 2.0;
        s += textureLod( tSrc, vUv + t, lod ) + textureLod( tSrc, vUv - t, lod )
           + textureLod( tSrc, vUv + vec2( t.x, -t.y ), lod ) + textureLod( tSrc, vUv + vec2( -t.x, t.y ), lod );
        return s / 16.0;
      }
      void main() {
        vec4 s = tent( 0.0, uTexel )
               + uScale * ( tent( 1.0, uTexel * 2.0 * uSpread )
               + uScale * ( tent( 2.0, uTexel * 4.0 * uSpread )
               + uScale * tent( 3.0, uTexel * 8.0 * uSpread ) ) );
        gl_FragColor = s * uScale;
      }`,
  });
}

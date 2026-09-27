import * as THREE from 'three';
import { FULLSCREEN_VERT, LUMA_GLSL } from './common.js';

// Small mip-chain bloom (prefilter -> 4-tap downsamples -> tent upsamples).
// Runs in linear HDR so lamp heads, cones and (later) muzzle flashes glow.

export function makeBloomPrefilter() {
  return new THREE.ShaderMaterial({
    name: 'BloomPrefilter',
    depthTest: false, depthWrite: false,
    uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 1.3 }, uKnee: { value: 0.6 } },
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: /* glsl */`
      uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThreshold; uniform float uKnee;
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
      void main() {
        vec3 a = texture2D( tSrc, vUv + uTexel * vec2( -0.5, -0.5 ) ).rgb;
        vec3 b = texture2D( tSrc, vUv + uTexel * vec2(  0.5, -0.5 ) ).rgb;
        vec3 c = texture2D( tSrc, vUv + uTexel * vec2( -0.5,  0.5 ) ).rgb;
        vec3 d = texture2D( tSrc, vUv + uTexel * vec2(  0.5,  0.5 ) ).rgb;
        // clamp fireflies before averaging
        vec3 s = min( prefilter( a ), 60.0 ) + min( prefilter( b ), 60.0 ) + min( prefilter( c ), 60.0 ) + min( prefilter( d ), 60.0 );
        gl_FragColor = vec4( s * 0.25, 1.0 );
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
        vec3 s = texture2D( tSrc, vUv + uTexel * vec2( -1.0, -1.0 ) ).rgb
               + texture2D( tSrc, vUv + uTexel * vec2(  1.0, -1.0 ) ).rgb
               + texture2D( tSrc, vUv + uTexel * vec2( -1.0,  1.0 ) ).rgb
               + texture2D( tSrc, vUv + uTexel * vec2(  1.0,  1.0 ) ).rgb;
        gl_FragColor = vec4( s * 0.25, 1.0 );
      }`,
  });
}

export function makeBloomUp() {
  return new THREE.ShaderMaterial({
    name: 'BloomUp',
    depthTest: false, depthWrite: false,
    blending: THREE.AdditiveBlending,
    transparent: true,
    uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uScale: { value: 1.0 } },
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: /* glsl */`
      uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uScale;
      varying vec2 vUv;
      void main() {
        vec2 t = uTexel;
        vec3 s = texture2D( tSrc, vUv ).rgb * 4.0;
        s += ( texture2D( tSrc, vUv + vec2( t.x, 0.0 ) ).rgb + texture2D( tSrc, vUv - vec2( t.x, 0.0 ) ).rgb
             + texture2D( tSrc, vUv + vec2( 0.0, t.y ) ).rgb + texture2D( tSrc, vUv - vec2( 0.0, t.y ) ).rgb ) * 2.0;
        s += texture2D( tSrc, vUv + t ).rgb + texture2D( tSrc, vUv - t ).rgb
           + texture2D( tSrc, vUv + vec2( t.x, -t.y ) ).rgb + texture2D( tSrc, vUv + vec2( -t.x, t.y ) ).rgb;
        gl_FragColor = vec4( s * ( uScale / 16.0 ), 1.0 );
      }`,
  });
}

// ---- wet-street reflection: bright pass + long vertical streak ------------
// The planar reflection is rendered EMITTERS-ONLY (black clear, black fog:
// Pipeline §2). The bright pass keeps only light above uThreshold (set just
// above lamp-lit stone), so lamp heads, cone cores, headlights and hot lit
// spots survive while the storm sky, the mist and a wet black car body leave
// nothing. It also downsamples half res -> quarter res (2x2 box).
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

// Long vertical streak (replaces the old 21-tap smear). Every texel gathers
// from ABOVE it (larger v): in reflection-texture space v runs the same way
// as the screen for points on the street plane (the mirrored camera's flipped
// up-vector cancels the mirror), so 'above' is 'further up the frame' and the
// light runs DOWN the frame, toward the viewer.
// N taps with geometrically growing spacing reach uReach (fraction of the
// frame height); weights exp(-3.5 i/N). Each tap is read from the mip whose
// footprint matches its spacing, so far taps average the gap instead of
// printing ghost copies of a small emitter, and the column widens a little
// as it nears the viewer. Tap weights are multiplied by the local spacing
// (the kernel is an integral over distance, not a sum of samples).
export function makeStreakMaterial() {
  return new THREE.ShaderMaterial({
    name: 'ReflStreak',
    depthTest: false, depthWrite: false,
    uniforms: {
      tSrc: { value: null },
      uTexel: { value: new THREE.Vector2() },
      uReach: { value: 0.45 },
      uSpread: { value: 0.7 },   // horizontal spread, in source texels
      uGain: { value: 0.75 },
    },
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: /* glsl */`
      uniform sampler2D tSrc; uniform vec2 uTexel;
      uniform float uReach, uSpread, uGain;
      varying vec2 vUv;
      const int N = 40;
      const float G = 1.05;               // spacing growth per tap
      void main() {
        // o_i = a (G^i - 1): first step = a (G - 1) ~ 1 texel, last offset = uReach
        float a = uReach / ( pow( G, float( N - 1 ) ) - 1.0 );
        float step0 = a * ( G - 1.0 );
        vec3 acc = vec3( 0.0 );
        float gi = 1.0;
        // per-pixel jitter along the kernel (interleaved gradient noise):
        // together with a modest mip it fills the gaps between the far taps
        // without widening a column much
        float jit = fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) ) - 0.5;
        for ( int i = 0; i < N; i ++ ) {
          float fi = float( i );
          float dstep = a * gi * ( G - 1.0 );
          float o = a * ( gi - 1.0 ) + jit * dstep * step( 0.5, fi );
          float lod = min( max( log2( dstep / uTexel.y ), 0.0 ) * 0.7, 1.6 );
          float w = exp( - 3.5 * fi / float( N ) ) * ( dstep / step0 );
          vec2 uv = vUv + vec2( 0.0, o );
          vec2 sx = vec2( uTexel.x * uSpread, 0.0 );
          // + a faint wider skirt (~10 px): the ground turns it into the
          // low-coverage flank where ripple slivers stick out of the column
          vec2 sw = vec2( uTexel.x * uSpread * 3.5, 0.0 );
          vec3 c = textureLod( tSrc, uv, lod ).rgb
                 + 0.6 * ( textureLod( tSrc, uv + sx, lod ).rgb + textureLod( tSrc, uv - sx, lod ).rgb )
                 + 0.07 * ( textureLod( tSrc, uv + sw, lod ).rgb + textureLod( tSrc, uv - sw, lod ).rgb );
          acc += c * w;
          gi *= G;
        }
        gl_FragColor = vec4( acc * ( uGain / 2.34 ), 1.0 );
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

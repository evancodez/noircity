import * as THREE from 'three';
import { FULLSCREEN_VERT, LUMA_GLSL } from './common.js';

// Reflections that lie on the street (story pass, lane 1, fix 8).
//
// The old model streaked the emitter-only mirror DOWN THE SCREEN from each
// emitter's mirror point (a 40-tap gather over 45 % of the frame): a lamp at
// 6 m mirrors to a point a few metres in front of the eye, so every lamp left
// a white column from under the horizon to the bottom edge, and a burning car's
// reflection hung upside down a long way in front of the car, with black water
// between. A wet street does not do that: a light leaves a SHEEN lying on the
// surface, at the light's feet, running toward the eye for a length that grows
// with the light's height, fading, broken by the ripples.
//
// So the mirror is now read as a list of emitters with a place in the world:
//   1. the emitter-only mirror (Pipeline step 2) is rendered with its depth;
//   2. the bright pass keeps light above T (bloom.js makeReflBrightMaterial);
//   3. this position pass turns the mirror's depth into each bright texel's
//      world position E (relative to the eye), weighted toward the bright
//      taps; mipmapped, so a texel with no depth of its own (a fire or muzzle
//      sprite in front of nothing: sprites write no depth) takes the place of
//      the geometry nearest round it (the car it burns on, the man who fired);
//   4. the splat: one instance per bright texel lays a quad FLAT ON THE
//      STREET from the emitter's foot F (the ground under E) toward the eye,
//      L = clamp( 1.1 h + 1.5, 1.5, 9 ) m long, as wide as the texel's own
//      footprint at F and 6 % wider per metre run; brightest in its first
//      third, fading smoothly to nothing at L; a narrow Gaussian across.
//      MAX-blended, so an emitter's texels union into its own width and two
//      streaks crossing never add up into a white plate.
// The ground shader (ground.js) reads the result exactly as it read the old
// column (same texture space: the mirror's view of the street plane), so the
// ripple dashes, the vertical dry-brush break-up and the ink blots print it
// as they printed the columns. Only light goes into it: no mirrored shape of
// anything (no inverted flames, no window rectangles) can reach the street.

// ---- 3. position pass ------------------------------------------------------
// In: the mirror's colour (half res) and depth. Out (quarter res, mipmapped):
// xyz = E - eye (m), w = 1 where a tap had depth (0 elsewhere): the mips
// average the positions of the texels that have one.
export function makeReflPosMaterial() {
  return new THREE.ShaderMaterial({
    name: 'ReflPos',
    depthTest: false, depthWrite: false,
    uniforms: {
      tSrc: { value: null }, tOpq: { value: null }, tDepth: { value: null }, tSpriteZ: { value: null }, uTexel: { value: new THREE.Vector2() },
      uProjInv: { value: new THREE.Matrix4() },     // the mirror camera's (oblique) inverse projection
      uCamWorld: { value: new THREE.Matrix4() },    // the mirror camera -> world
      uEye: { value: new THREE.Vector3() },
    },
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: /* glsl */`
      uniform sampler2D tSrc, tOpq, tDepth, tSpriteZ; uniform vec2 uTexel;
      uniform mat4 uProjInv, uCamWorld; uniform vec3 uEye;
      varying vec2 vUv;
      ${LUMA_GLSL}
      void tap( vec2 uv, inout vec4 acc ) {
        float d = texture2D( tDepth, uv ).r;
        // a tap whose light is mostly a sprite's (the world's own light, the
        // copy taken before the sprites, is less than half of it) stands at
        // the sprites' own depth (Pipeline: rtSpriteZ), not at the wall or
        // the tower behind it
        float lt = min( luma( texture2D( tSrc, uv ).rgb ), 40.0 );
        float lo = min( texture2D( tOpq, uv ).r, 40.0 );
        if ( lt > 0.02 && lo < 0.5 * lt ) d = texture2D( tSpriteZ, uv ).r;
        if ( d >= 0.999999 ) return;
        vec4 v = uProjInv * vec4( uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0 );
        vec3 w = ( uCamWorld * vec4( v.xyz / v.w, 1.0 ) ).xyz - uEye;
        // (within the 2x2 block the bright taps decide: a lamp head's rim
        // texel is placed at the lamp, not half way to the wall behind it)
        float k = 0.002 + lo;
        acc += vec4( w * k, k );
      }
      void main() {
        vec4 acc = vec4( 0.0 );
        tap( vUv + uTexel * vec2( -0.5, -0.5 ), acc );
        tap( vUv + uTexel * vec2(  0.5, -0.5 ), acc );
        tap( vUv + uTexel * vec2( -0.5,  0.5 ), acc );
        tap( vUv + uTexel * vec2(  0.5,  0.5 ), acc );
        if ( acc.w <= 0.0 ) { gl_FragColor = vec4( 0.0 ); return; }
        vec3 p = acc.xyz / acc.w;
        // Stored premultiplied by a weight that falls steeply with distance,
        // so the MIPS (the fill for a texel with no depth) average toward
        // the NEAREST geometry round it: a flame seen in the mirror against
        // the skyline takes the car it burns on (15 m), not the towers
        // (300 m); a Hood's flash takes the Hood. (A texel of its own keeps
        // its exact place: xyz / w.)
        float wd = pow( 30.0 / max( length( p ), 2.0 ), 4.0 );
        gl_FragColor = vec4( p * wd, wd );
      }`,
  });
}

// the world's own light in the mirror, before the sprites (luminance)
export function makeCopyLumMaterial() {
  return new THREE.ShaderMaterial({
    name: 'ReflCopyLum',
    depthTest: false, depthWrite: false,
    uniforms: { tSrc: { value: null } },
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: /* glsl */`
      uniform sampler2D tSrc;
      varying vec2 vUv;
      ${LUMA_GLSL}
      void main() { gl_FragColor = vec4( luma( texture2D( tSrc, vUv ).rgb ), 0.0, 0.0, 1.0 ); }`,
  });
}

// ---- 4. the splat ---------------------------------------------------------
// One instance per source texel (gl_InstanceID -> texel); a dark texel sends
// its quad off screen (no fragments). The quad's corners: along in [0, 1]
// (-lead .. L), across in [-1, 1].
export function makeReflSplat(maxInstances) {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.instanceCount = maxInstances;
  const mat = new THREE.ShaderMaterial({
    name: 'ReflSplat',
    glslVersion: THREE.GLSL3,
    depthTest: false, depthWrite: false, transparent: true,
    blending: THREE.CustomBlending,
    blendEquation: THREE.MaxEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    blendEquationAlpha: THREE.MaxEquation, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor,
    uniforms: {
      tBright: { value: null }, tPos: { value: null },
      uSrcSize: { value: new THREE.Vector2(1, 1) },
      uVP: { value: new THREE.Matrix4() },          // street plane -> the column target's clip space
      uProjInvR: { value: new THREE.Matrix4() },    // the mirror camera's inverse projection (its own window)
      uCamWorldR: { value: new THREE.Matrix4() },   // the mirror camera -> world
      uEye: { value: new THREE.Vector3() },
      uPlaneY: { value: 0 },
      uTexelTan: { value: 0.002 },                  // one source texel, in tan units (its angular size)
      uMin: { value: 0.004 },                       // bright-passed luminance below which a texel is skipped
      uLenK: { value: new THREE.Vector4(1.1, 1.5, 1.5, 9.0) },   // L = clamp( k.x h + k.y, k.z, k.w )
      uGrow: { value: 0.06 },                       // width growth per metre run
      uDbg: { value: 0 },
      uSat: { value: new THREE.Vector2(0.11, 0.35) },            // presence = s.x ( 1 - exp( -lum / s.y ) )
      uFar: { value: new THREE.Vector3(26, 44, 0.35) },          // far emitters: fade from x to y m, to z
    },
    vertexShader: /* glsl */`
      uniform sampler2D tBright, tPos;
      uniform vec2 uSrcSize;
      uniform mat4 uVP, uProjInvR, uCamWorldR;
      uniform vec3 uEye;
      uniform float uPlaneY, uTexelTan, uMin, uGrow, uDbg;
      uniform vec4 uLenK;
      uniform vec2 uSat;
      uniform vec3 uFar;
      out vec3 vCol;
      out vec3 vST;       // s (m along, from F), t (m across), sigma0 (m)
      out float vLen;
      float luma( vec3 c ) { return dot( c, vec3( 0.2126, 0.7152, 0.0722 ) ); }
      void main() {
        ivec2 tc = ivec2( gl_InstanceID % int( uSrcSize.x ), gl_InstanceID / int( uSrcSize.x ) );
        vec3 c = texelFetch( tBright, tc, 0 ).rgb;
        float l = luma( c );
        gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 );
        vCol = vec3( 0.0 ); vST = vec3( 0.0 ); vLen = 1.0;
        if ( l < uMin ) return;
        // the emitter's place: its own depth, else the nearest geometry's
        // (the mips of the position target; see makeReflPosMaterial)
        vec4 P = texelFetch( tPos, tc, 0 );
        vec2 uv = ( vec2( tc ) + 0.5 ) / uSrcSize;
        bool pulled = false;
        // A sprite stands ON something below it: a flame on the car, blood
        // over the man, a flash at his hand. Below in the world is toward
        // the horizon in the mirror (+v): the first texel up the column that
        // has a place of its own gives the sprite its distance. (The mips'
        // nearest-weighted average, below, only when that finds nothing: it
        // mixed the car with the wall beside it and put half a fire's sheen
        // two metres in front of the car.)
        if ( P.w <= 0.0 ) {
          int dy = 1;
          for ( int i = 0; i < 20; i ++ ) {
            int y = tc.y + dy;
            if ( y >= int( uSrcSize.y ) ) break;
            vec4 Q = texelFetch( tPos, ivec2( tc.x, y ), 0 );
            if ( Q.w > 0.0 ) { P = Q; pulled = true; break; }
            dy += i < 8 ? 1 : 3;
          }
        }
        for ( int k = 1; k <= 6; k ++ ) {
          if ( P.w > 0.0 ) break;
          P = textureLod( tPos, uv, float( k ) );
          pulled = true;
        }
        if ( P.w <= 0.0 ) return;
        vec3 E = uEye + P.xyz / P.w;
        // a sprite's light stands on ITS OWN ray, as far off as the thing
        // it was placed by: a flame above the roof keeps its height (and so
        // its longer sheen), not the car body's
        if ( pulled && uDbg < 0.5 ) {
          vec4 vd = uProjInvR * vec4( uv * 2.0 - 1.0, 0.0, 1.0 );
          vec3 dir = normalize( mat3( uCamWorldR ) * ( vd.xyz / vd.w ) );
          float Dh = length( E.xz - uEye.xz ), dh = length( dir.xz );
          if ( dh > 1e-3 ) {
            vec3 eyeR = vec3( uEye.x, 2.0 * uPlaneY - uEye.y, uEye.z );
            E = eyeR + dir * ( Dh / dh );
          }
        }
        float r = length( E - uEye );
        float h = max( E.y - uPlaneY, 0.0 );
        vec2 toEye = uEye.xz - E.xz;
        float D = length( toEye );
        if ( D < 0.3 ) return;
        vec2 u = toEye / D;
        vec2 v = vec2( -u.y, u.x );
        float L = min( clamp( uLenK.x * h + uLenK.y, uLenK.z, uLenK.w ), D );
        // the texel's own footprint at the emitter: the streak's width at F
        // (max-blended with its neighbours: sigma ~0.6 of the spacing keeps
        // the union smooth across an emitter)
        float w0 = max( r * uTexelTan, 0.02 );
        // (a floor: an emitter's union keeps soft, round flanks where the
        // ripple slivers thin out, not a straight-sided slab)
        float sig0 = max( 0.6 * w0, 0.14 );
        float lead = 0.1;
        float s = mix( -lead, L, position.x );
        float sig = sig0 + 0.5 * uGrow * max( s, 0.0 );
        float t = position.y * 2.6 * sig;
        vec3 Pw = vec3( E.x, uPlaneY, E.z ) + vec3( u.x, 0.0, u.y ) * s + vec3( v.x, 0.0, v.y ) * t;
        vec4 clip = uVP * vec4( Pw, 1.0 );
        gl_Position = vec4( clip.xy, 0.0, clip.w );
        // presence: the light's luminance saturates early (a lamp head is
        // ~100x a lit window, and the ground prints any real light near
        // white); the streak's fall-off then carries its strength
        float far = smoothstep( uFar.x, uFar.y, D );
        float pres = uSat.x * ( 1.0 - exp( - l / uSat.y ) ) * mix( 1.0, uFar.z, far );
        vCol = c * ( pres / max( l, 1e-5 ) );
        vST = vec3( s, t, sig0 );
        vLen = L;
      }`,
    fragmentShader: /* glsl */`
      uniform float uGrow;
      in vec3 vCol;
      in vec3 vST;
      in float vLen;
      out vec4 outColor;
      void main() {
        float s = vST.x, t = vST.y, sig0 = vST.z;
        float x = s / vLen;
        // along: touches F (a short soft lead behind it so the foot is not
        // an aliased cut), brightest in the first third, then a smooth fade
        // to nothing at L (monotonic, no step)
        float along = smoothstep( - 0.1, 0.3, s ) * ( 1.0 - smoothstep( 0.3, 1.0, x ) ) * ( 1.0 - 0.2 * clamp( x, 0.0, 1.0 ) );
        float sig = sig0 + 0.5 * uGrow * max( s, 0.0 );
        float across = exp( - 0.5 * ( t * t ) / ( sig * sig ) );
        // (the light spreads as it widens)
        float spread = sqrt( sig0 / sig );
        outColor = vec4( vCol * along * across * spread, 1.0 );
      }`,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  return mesh;
}

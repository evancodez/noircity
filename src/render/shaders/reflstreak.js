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
//   4. the splat: one quad per bright texel laid FLAT ON THE STREET from
//      the emitter's foot F (the ground under E) toward the eye (model v2,
//      fix round 1: its length judged in the IMAGE). In the image the run
//      from F to the true mirror point M is as tall as the emitter stands
//      above its foot; the sheen covers that and a little smear (1.3
//      emitter heights in the image: ~1.05-1.15 x the art director's
//      1.15 D h / ( h + e ) on the ground), at least 1.5 m, never closer than
//      1 m to the eye; full within its first 6 %, held to 35 %, then a
//      smooth fall to nothing (laid out in the image, so a far lamp keeps a
//      column as tall as the lamp). Across: the texel's own footprint at F
//      (a lamp head ~0.5 m), a Gaussian 3 % wider per metre run, held as an
//      angle from the eye (a column, not a tent). Held down at the player's
//      feet and where the emitter's mirror point is under the eye; the el
//      train's hair-blue light leaves short broken dashes. MAX-blended, so an
//      emitter's texels union into its own width and two streaks crossing
//      never add up into a white plate. The lamps of the stage are given to
//      the mirror as small bright balls at their heads (Pipeline:
//      lampProxy): a bulb disc seen edge-on from the mirror left far lamps
//      without a sheen.
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
        // (the scale keeps p * wd inside a half float at arm's length - with
        // 30 / d it overflowed under ~2.2 m, and a small emitter held before
        // the eye, an ember, a flame, was placed at garbage: its sheen printed
        // at the bottom edge - and above the half float's subnormals out to
        // ~150 m, where the far fade has taken every sheen)
        float wd = pow( 10.0 / max( length( p ), 2.5 ), 4.0 );
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
// One quad per source texel (gl_VertexID / 6 -> texel); a dark texel sends
// its quad off screen (no fragments). The quad's corners: along in [0, 1]
// (-lead .. L), across in [-1, 1].
// (Plain triangles, six vertices per texel, the texel and the corner taken
// from gl_VertexID: drawn as 100k instances of one quad, the pass cost
// ~1.2 ms on the Metal backend even with every instance culled in its
// vertex shader; as one flat draw it is a fraction of that.)
export function makeReflSplat(maxInstances) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxInstances * 6), 1));
  g.userData.texels = maxInstances;
  // (the one-float 'position' is only a vertex count: three must not try
  // to bound it - the quads are placed in the vertex shader)
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  g.boundingBox = new THREE.Box3(new THREE.Vector3(-1e6, -1e6, -1e6), new THREE.Vector3(1e6, 1e6, 1e6));
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
      uEyeSrc: { value: new THREE.Vector3() },      // the eye of the frame the sources were taken in
      uPlaneY: { value: 0 },
      uTexelTan: { value: 0.002 },                  // one source texel, in tan units (its angular size)
      uMin: { value: 0.004 },                       // bright-passed luminance below which a texel is skipped
      // the end: k.x emitter heights below F in the image; at least k.y m, ending no closer than k.z m to the eye
      uLenK: { value: new THREE.Vector4(1.3, 1.5, 1.0, 0.0) },
      uGrow: { value: 0.03 },                       // width growth per metre run
      uDbg: { value: 0 },
      uSat: { value: new THREE.Vector2(0.2, 0.35) },            // presence = s.x ( 1 - exp( -lum / s.y ) )
      uFar: { value: new THREE.Vector3(90, 140, 0.0) },          // far emitters: fade from x to y m, to z
      uNear: { value: new THREE.Vector3(3.0, 7.0, 0.3) },        // at the player's feet: from y m in to x m, held to z
      uNearM: { value: new THREE.Vector3(1.3, 1.9, 0.05) },      // mirror point under the eye (m): held to z
    },
    vertexShader: /* glsl */`
      uniform sampler2D tBright, tPos;
      uniform vec2 uSrcSize;
      uniform mat4 uVP, uProjInvR, uCamWorldR;
      uniform vec3 uEye, uEyeSrc;
      uniform float uPlaneY, uTexelTan, uMin, uGrow, uDbg;
      uniform vec4 uLenK;
      uniform vec2 uSat;
      uniform vec3 uFar, uNear, uNearM;
      out vec3 vCol;
      out vec3 vST;       // s (m along, from F), t (m across), sigma0 (m)
      out vec4 vQ;        // D (m, F from the eye), e (eye height), q at F, q at the end
      out float vGrow;    // the width's growth per metre run (round 2: narrower near)
      float luma( vec3 c ) { return dot( c, vec3( 0.2126, 0.7152, 0.0722 ) ); }
      void main() {
        int inst = gl_VertexID / 6;
        int cv = gl_VertexID - inst * 6;
        int ci = cv == 3 ? 0 : cv == 4 ? 2 : cv == 5 ? 3 : cv;
        vec2 corner = vec2( ci == 1 || ci == 2 ? 1.0 : 0.0, ci >= 2 ? 1.0 : -1.0 );
        ivec2 tc = ivec2( inst % int( uSrcSize.x ), inst / int( uSrcSize.x ) );
        vec3 c = texelFetch( tBright, tc, 0 ).rgb;
        float l = luma( c );
        gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 );
        vCol = vec3( 0.0 ); vST = vec3( 0.0 ); vQ = vec4( 1.0 ); vGrow = uGrow;
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
        vec3 E = uEyeSrc + P.xyz / P.w;
        // a sprite's light stands on ITS OWN ray, as far off as the thing
        // it was placed by: a flame above the roof keeps its height (and so
        // its longer sheen), not the car body's
        if ( pulled && uDbg < 0.5 ) {
          vec4 vd = uProjInvR * vec4( uv * 2.0 - 1.0, 0.0, 1.0 );
          vec3 dir = normalize( mat3( uCamWorldR ) * ( vd.xyz / vd.w ) );
          float Dh = length( E.xz - uEyeSrc.xz ), dh = length( dir.xz );
          if ( dh > 1e-3 ) {
            vec3 eyeR = vec3( uEyeSrc.x, 2.0 * uPlaneY - uEyeSrc.y, uEyeSrc.z );
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
        // The length is judged in the image (fix 8, model v2). A true mirror
        // shows E at the ground point M on the line from F toward the eye,
        // D h / ( h + e ) from F: in the image the stretch F..M is exactly as
        // tall as the emitter stands above its foot (q = e / d, the tangent
        // below the horizon of a ground point d from the eye: q_M - q_F =
        // h / D) - 'the reflection under the lamp'. The sheen covers that run
        // and a little smear past it (k = uLenK.x lamp heights in the image),
        // and stops there: what made the old street bottomless was
        // everything beyond M, the column running on to the bottom edge.
        // Its profile is laid out in the image too (u from q, fragment): a
        // lamp 40 m off keeps a column as tall as the lamp, not a stub whose
        // fade is squeezed into its first few pixels by the perspective.
        float e = max( uEye.y - uPlaneY, 0.3 );
        float qF = e / D;
        float qEnd = qF + uLenK.x * h / D;
        float L = D - e / qEnd;
        // The el train's light (its windows, the pools they throw on the
        // street, its rail sparks) is tagged a hair blue (world/Train.js):
        // it leaves short broken dashes on the road under the el, not a
        // lamp's column - a row of windows 9 m up laid a wide white band
        // down the road. (The neon's deep blue is not the tag.)
        float bt = ( c.b - c.r ) / max( c.b, 1e-4 );
        float trainK = smoothstep( 0.02, 0.04, bt ) * ( 1.0 - smoothstep( 0.15, 0.3, bt ) );
        L = mix( L, 1.5 + min( 0.25 * h, 1.5 ), trainK );
        L = min( max( L, uLenK.y ), D - uLenK.z );
        if ( L < 0.15 ) return;
        qEnd = e / ( D - L );
        // Across: the emitter's own width at F (each texel lays its own
        // footprint; max-blended, the texels of one emitter union into its
        // width: a lamp head ~0.5 m, a window its own), a Gaussian growing
        // by uGrow of the distance run (full width at half maximum) - held
        // as an ANGLE from the eye, the way the glitter of rippled water
        // spreads: toward the eye the sheen narrows on the ground as the
        // ground comes closer, so in the image it keeps the width it has
        // under the lamp (a column, as in the golden street), not a tent
        // opening toward the bottom edge. (See sigAt in the fragment.)
        float w0 = max( r * uTexelTan, 0.02 );
        float sig0 = max( 0.35 * w0, mix( 0.026, 0.04, smoothstep( 7.0, 16.0, D ) ) );
        float lead = 0.1;
        float s = mix( -lead, L, corner.x );
        // (the quad's edge bounds the Gaussian over the whole run)
        // (round 2: a lamp a stride or two off lays a narrower, harder
        // column - the golden street's near bar - than the spread of the
        // far ones; beyond ~16 m the width is as it was)
        float grow = uGrow * mix( 0.5, 1.0, smoothstep( 7.0, 16.0, D ) );
        vGrow = grow;
        float t = corner.y * 2.6 * ( sig0 + grow / 2.355 * max( s, 0.0 ) );
        vec3 Pw = vec3( E.x, uPlaneY, E.z ) + vec3( u.x, 0.0, u.y ) * s + vec3( v.x, 0.0, v.y ) * t;
        vec4 clip = uVP * vec4( Pw, 1.0 );
        gl_Position = vec4( clip.xy, 0.0, clip.w );
        // presence: the light's luminance saturates early (a lamp head is
        // ~100x a lit window, and the ground prints any real light near
        // white); the streak's fall-off then carries its strength
        // (the skyline's windows, 200 m off and 90 m up, are not the
        // street's lights: beyond ~100 m an emitter leaves nothing)
        float far = smoothstep( uFar.x, uFar.y, D );
        float pres = uSat.x * ( 1.0 - exp( - l / uSat.y ) ) * mix( 1.0, uFar.z, far );
        // An emitter whose mirror point M lies under the eye (a lamp a few
        // metres off, a flame held before the face): its true reflection is
        // out of the frame, below the bottom edge, and what the view sees is
        // the grazing stretch toward its foot. It is held far under the
        // saturation (display ~0.5; the ground's ripples then break it into
        // sparse slivers): the street lamp beside the eye left a white paint
        // blob in the bottom corner.
        // (a sheen wholly within ~3 m of the eye - a small emitter held
        // before the face - is the ground's to hold: under display 0.6,
        // broken hard, but there)
        pres *= mix( 1.0, 0.45, trainK );
        float dM = D * e / ( h + e );
        float holdM = mix( uNearM.z, 1.0, smoothstep( uNearM.x, uNearM.y, dM ) );
        pres *= mix( holdM, 1.0, 1.0 - smoothstep( 2.5, 3.5, D ) );
        vCol = c * ( pres / max( l, 1e-5 ) );
        vST = vec3( s, t, sig0 );
        vQ = vec4( D, e, qF, qEnd );
      }`,
    fragmentShader: /* glsl */`
      uniform float uGrow;
      uniform vec3 uNear;
      in vec3 vCol;
      in vec3 vST;
      in vec4 vQ;
      in float vGrow;
      out vec4 outColor;
      void main() {
        float s = vST.x, t = vST.y, sig0 = vST.z;
        // u: 0 at F, 1 at the end, in the IMAGE (q = e / d, linear on the
        // screen's vertical for a straight-on view)
        float d = max( vQ.x - s, 0.05 );
        float x = clamp( ( vQ.y / d - vQ.z ) / max( vQ.w - vQ.z, 1e-4 ), 0.0, 1.0 );
        // along: touches F (a short soft lead behind it so the foot is not
        // an aliased cut), full within the first 6 %, held to u = 0.35, then
        // a smooth fall to nothing at u = 1 (monotonic, no step, no hard end)
        float along = smoothstep( - 0.08, 0.04, s ) * smoothstep( 0.0, 0.06, x + 0.02 ) * ( 1.0 - smoothstep( 0.35, 1.0, x ) );
        // at the player's feet every sheen is held down (the ground's ripples
        // then break it hard): no white blob under the eye, and the near
        // lamp's column has faded out by the bottom edge
        along *= mix( uNear.z, 1.0, smoothstep( uNear.x, uNear.y, d ) );
        float sigA = sig0 + vGrow / 2.355 * max( s, 0.0 );     // at F's distance
        float sig = sigA * clamp( d / vQ.x, 0.02, 1.0 );         // held as an angle
        float across = exp( - 0.5 * ( t * t ) / ( sig * sig ) );
        // (the light spreads a little as it widens)
        float spread = pow( sig0 / sigA, 0.35 );
        outColor = vec4( vCol * along * across * spread, 1.0 );
      }`,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  return mesh;
}

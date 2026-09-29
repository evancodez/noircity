import * as THREE from 'three';
import { HASH_GLSL, LAMPS_GLSL } from './shaders/common.js';
import { NOIR_FOG_GLSL } from './fog.js';

// Glass, window light and far rooms (docs/story/CONTRACTS.md §9.5, lane 1's
// brief P1.1, P1.2, P2).
//
//   makeGlassMaterial({ wet, side, tint })     plate glass seen through
//   makeWindowLightMaterial({ w, h, slats })   a street lamp's light thrown
//       through a wet window onto a floor or a wall; .userData.sweep(t0,
//       speed) runs a bright bar across it (the el train passing)
//   makeRoomMaterial({ seed, lit })            a fake room behind a far pane
//
// All three read game time from the shared uniforms (uTime: the fixed step's
// clock), so every frame is deterministic; everything is anchored in the
// world (glass: on the pane's plane; a room: in the pane's own frame), so
// nothing slides as the eye moves and a pane lane 3 re-cuts into pieces
// keeps its rain exactly where it was.

// ---- rain on a pane --------------------------------------------------------
// q: position on the pane in metres (x across, y up, world-anchored).
// Beads sit, grow and vanish; every ~13 cm a runner forms, runs down a
// crooked path - fast, then slowing - and leaves a trail of fading water.
// Returns x: water coverage (0..1), y: a highlight (the bead's lit crown),
// z: the trail share (the water left behind, the part that bends the view).
const RAIN_GLASS_GLSL = /* glsl */`
vec3 paneRain( vec2 q, float t, float wet ) {
  vec3 o = vec3( 0.0 );
  // beads: 2.6 cm cells, one bead each at a hashed spot, a life of 3-9 s
  vec2 bq = q / 0.026;
  vec2 bc = floor( bq );
  for ( int j = -1; j <= 1; j ++ ) for ( int i = -1; i <= 1; i ++ ) {
    vec2 c = bc + vec2( float( i ), float( j ) );
    vec2 h = hash22( c * 1.31 + 7.7 );
    float life = 3.0 + 6.0 * h.x;
    float ph = fract( t / life + h.y );
    vec2 ctr = c + 0.2 + 0.6 * hash22( c + floor( t / life + h.y ) * 3.1 );
    float r = ( 0.12 + 0.28 * h.y ) * smoothstep( 0.0, 0.5, ph ) * ( 1.0 - smoothstep( 0.9, 1.0, ph ) );
    vec2 d = ( bq - ctr ) * vec2( 1.0, 0.85 );
    float dl = length( d );
    float m = 1.0 - smoothstep( r * 0.8, r, dl );
    float on = step( 0.55, hash12( c * 3.7 ) );
    o.x = max( o.x, m * on );
    // the crown catches the light: a speck up and to the left of the centre,
    // on one bead in four (a pane of equal specks reads as a dot screen)
    o.y = max( o.y, ( 1.0 - smoothstep( 0.0, r * 0.35, length( d + vec2( 0.25, -0.3 ) * r ) ) ) * m * on * step( 0.75, hash12( c * 5.3 + 1.1 ) ) * 0.7 );
  }
  // runners: a column every ~13 cm, jittered; one drop per period
  float cw = 0.13;
  float ci = floor( q.x / cw );
  for ( int k = -1; k <= 1; k ++ ) {
    float col = ci + float( k );
    vec2 h = hash22( vec2( col, 17.3 ) );
    float per = 5.0 + 7.0 * h.x;
    float cyc = floor( t / per + h.y );
    float ph = fract( t / per + h.y );
    vec2 hc = hash22( vec2( col, cyc ) );
    float y0 = 1.8 + 1.2 * hc.x;                     // where it gathers (m up the pane)
    // fast, then slowing: it breaks away, then crawls
    float run = 2.6 * ( 1.0 - pow( 1.0 - ph, 2.2 ) );
    float yd = y0 - run;
    // crooked: the path wanders with the height (fixed per drop), so the
    // trail above the drop lies where the drop has been
    float px = ( col + 0.5 + ( hc.y - 0.5 ) * 0.5 ) * cw;
    float xa = px + 0.009 * sin( q.y * 17.3 + hc.x * 40.0 ) + 0.006 * sin( q.y * 41.7 + hc.y * 13.0 ) + 0.004 * sin( q.y * 97.1 + hc.x * 7.0 );
    float dx = q.x - xa;
    // the drop: a bead elongated downward
    float rd = 0.0055;
    float dd = length( vec2( dx, ( q.y - yd ) * ( q.y < yd ? 0.8 : 1.4 ) ) );
    float drop = 1.0 - smoothstep( rd * 0.75, rd, dd );
    // the trail above it, fading with the time since the drop passed
    float since = ( q.y - yd ) / 1.3;                // ~s since the drop was here
    float trail = step( yd, q.y ) * step( q.y, y0 ) * exp( - max( since, 0.0 ) * 3.2 )
                * ( 1.0 - smoothstep( 0.0012, 0.0024, abs( dx ) ) );
    // droplets left along the trail
    float tb = step( yd, q.y ) * step( q.y, y0 ) * ( 1.0 - smoothstep( 0.0018, 0.0028, length( vec2( dx, fract( q.y / 0.021 + hc.x ) * 0.021 - 0.0105 ) ) ) )
             * step( 0.55, hash12( vec2( col, floor( q.y / 0.021 + hc.x ) ) ) ) * exp( - max( since, 0.0 ) * 0.5 );
    o.x = max( o.x, max( drop, max( trail * 0.7, tb ) ) );
    o.y = max( o.y, drop * ( 1.0 - smoothstep( 0.0, rd * 0.4, length( vec2( dx + rd * 0.3, q.y - yd - rd * 0.3 ) ) ) ) );
    // the wet trail catches a thread of light along one edge
    o.y = max( o.y, trail * 0.4 * ( 1.0 - smoothstep( 0.0004, 0.0011, abs( dx - 0.0008 ) ) ) );
    o.z = max( o.z, max( drop, trail ) );
  }
  return o * wet;
}
`;

// Plate glass. Drawn in the scene pass only (destruct/Glass.js puts panes on
// LAYER.FX), blended over the room or the street behind it, which the ink
// still inks from its own depth and ids. The pane adds, and only adds:
//   - rain on its OUTER face (the side 'out' faces: the normal's side for
//     side 'out'): beads, runners and their trails, world-anchored;
//   - a faint grey sheen toward grazing angles;
//   - two or three small paper-white smears where the nearest lamps reflect;
//   - seen from the dry side, a dim veil: the street is dimmer through wet
//     glass, and darker along the water's trails (they bend the view).
// The material does not care how the pane is cut: lane 3 may swap its
// geometry for pieces and every piece keeps its part of the water.
export function makeGlassMaterial({ wet = 1, side = 'out', tint = 0x1a1a1a } = {}) {
  const m = new THREE.ShaderMaterial({
    name: 'NoirGlass',
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: {
      uTime: sh('uTime'),
      uLampPos: sh('uLampPos'), uLampDir: sh('uLampDir'), uLampParams: sh('uLampParams'), uLampCount: sh('uLampCount'),
      uFogColor: sh('uFogColor'), uFogDensity: sh('uFogDensity'),
      uWet: { value: wet },
      uOut: { value: side === 'in' ? -1 : 1 },
      uTint: { value: new THREE.Color(tint) },
    },
    vertexShader: /* glsl */`
      varying vec3 vWorld;
      varying vec3 vN;
      void main() {
        vec4 wp = modelMatrix * vec4( position, 1.0 );
        vWorld = wp.xyz;
        vN = normalize( mat3( modelMatrix ) * normal );
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uWet, uOut;
      uniform vec3 uTint;
      varying vec3 vWorld;
      varying vec3 vN;
      ${HASH_GLSL}
      ${LAMPS_GLSL}
      ${NOIR_FOG_GLSL}
      ${RAIN_GLASS_GLSL}
      void main() {
        vec3 N = normalize( vN ) * uOut;                 // toward the wet side
        vec3 V = cameraPosition - vWorld;
        float dist = length( V );
        V /= dist;
        float facing = dot( N, V );                      // > 0: the eye is on the wet side
        vec3 T = normalize( cross( vec3( 0.0, 1.0, 0.0 ), N ) + vec3( 1e-4, 0.0, 0.0 ) );
        vec2 q = vec2( dot( vWorld, T ), vWorld.y );
        vec3 w = paneRain( q, uTime, uWet );
        // (small water detail goes before it aliases: past ~12 m the pane
        // keeps only its sheen)
        w *= 1.0 - smoothstep( 7.0, 12.0, dist );
        float cosV = abs( facing );
        float fres = 0.04 + 0.96 * pow( 1.0 - cosV, 5.0 );
        // the lamps reflected in the pane: a small vertical smear each
        vec3 R = reflect( - V, normalize( vN ) * sign( facing + 1e-5 ) );
        float smear = 0.0;
        for ( int i = 0; i < MAX_LAMPS; i ++ ) {
          if ( i >= uLampCount || i >= 6 ) break;
          vec4 prm = uLampParams[ i ];
          if ( prm.z <= 0.0 ) continue;
          vec3 L = uLampPos[ i ] - vWorld;
          float dl = length( L );
          L /= dl;
          float c = dot( R, L );
          // stretched along the vertical: a smear, not a dot
          vec3 dv = R - L;
          float s = exp( - ( dv.x * dv.x + dv.z * dv.z ) * 26000.0 - dv.y * dv.y * 1100.0 ) * step( 0.0, c );
          smear += s * prm.z / ( 1.0 + 0.02 * dl * dl );
        }
        // (broken by the water on the pane: a smear, not a CG oval)
        smear = min( smear, 1.2 ) * mix( 1.0, 0.25 + 1.2 * w.z + 0.6 * w.x, uWet );
        // colour and cover: dark water, a grey sheen, the lit crowns and
        // the lamp smears (paper white); the dry side's dim veil
        float dry = step( facing, 0.0 );
        float veil = dry * ( 0.18 + 0.22 * w.z ) * uWet;
        float water = w.x * mix( 0.45, 0.3, dry );
        vec3 col = uTint * 0.2;
        float a = max( max( veil, water ), fres * 0.35 );
        vec3 sheen = uFogColor * 2.2;
        col = mix( col, sheen, fres * 0.35 / max( a, 1e-4 ) );
        // highlights are light: premultiplied into the colour so a speck on
        // an otherwise clear pane still reads (the ink prints it white)
        vec3 light = vec3( 1.0 ) * ( w.y * 1.6 + smear * 3.0 );
        vec4 nf = vec4( 0.0 );
        float fogA = noirFogAmount( dist, vWorld.y, uFogDensity );
        gl_FragColor = vec4( ( col * a + light ) * ( 1.0 - fogA ), a * ( 1.0 - fogA ) );
      }`,
  });
  // premultiplied: dst = col*a + light + dst*(1-a)
  m.blending = THREE.CustomBlending;
  m.blendSrc = THREE.OneFactor;
  m.blendDst = THREE.OneMinusSrcAlphaFactor;
  m.blendSrcAlpha = THREE.ZeroFactor;
  m.blendDstAlpha = THREE.OneFactor;
  m.userData = { wet, side, glass: true };
  return m;
}

// ---- window light ------------------------------------------------------------
// A soft additive patch of street light thrown through a wet window onto a
// floor or a wall: put a plane of w x h where the window's light falls (the
// caller shapes it in perspective: a trapezoid mesh, or a plane skewed by its
// transform). Soft edges; the water's shadows crawl down through it (the same
// runners as on the pane, stretched); with `slats` the shadow of a half-
// lowered blind across its upper part. Display lift 0.1 - 0.2: subtle.
// userData.sweep(t0, speed): a bright bar runs across it from t0 (game
// seconds) at `speed` (patches per second): the el train passing.
export function makeWindowLightMaterial({ w = 1, h = 1, slats = 0, strength = 1 } = {}) {
  const m = new THREE.ShaderMaterial({
    name: 'NoirWindowLight',
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    uniforms: {
      uTime: sh('uTime'),
      uFogColor: sh('uFogColor'), uFogDensity: sh('uFogDensity'),
      uSize: { value: new THREE.Vector2(w, h) },
      uSlats: { value: slats },
      uStrength: { value: strength },
      uSweep: { value: new THREE.Vector2(-1e4, 1) },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      varying vec3 vWorld;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4( position, 1.0 );
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uSlats, uStrength;
      uniform vec2 uSize, uSweep;
      varying vec2 vUv;
      varying vec3 vWorld;
      ${HASH_GLSL}
      ${NOIR_FOG_GLSL}
      ${RAIN_GLASS_GLSL}
      void main() {
        vec2 p = vUv * uSize;
        // soft edges (the light passes a frame and spreads)
        vec2 e = min( vUv, 1.0 - vUv ) * uSize;
        float edge = smoothstep( 0.0, 0.12, e.x ) * smoothstep( 0.0, 0.12, e.y );
        // the water's shadow, stretched and softened (a shadow of a runner
        // is wider than the runner): the pane's rain at the patch's scale
        vec3 wr = paneRain( p * vec2( 0.7, 0.55 ), uTime, 1.0 );
        float shade = 1.0 - 0.5 * max( wr.z, wr.x * 0.3 );
        // a half-lowered blind: its slats' shadows across the upper part
        if ( uSlats > 0.5 ) {
          float sl = fract( vUv.y * uSlats );
          float blind = step( 0.45, vUv.y ) * ( 1.0 - smoothstep( 0.55, 0.75, sl ) * smoothstep( 1.0, 0.9, sl ) );
          shade *= mix( 1.0, 0.2, step( 0.45, vUv.y ) * smoothstep( 0.35, 0.6, sl ) );
        }
        // the train: a bright bar crossing the patch
        float bx = ( uTime - uSweep.x ) * uSweep.y;
        float bar = exp( - pow( ( vUv.x - bx + 0.2 ) / 0.12, 2.0 ) ) * step( 0.0, uTime - uSweep.x ) * step( bx, 1.6 );
        float l = ( 0.0095 * shade + 0.022 * bar ) * edge * uStrength;
        float fogA = noirFogAmount( length( cameraPosition - vWorld ), vWorld.y, uFogDensity );
        gl_FragColor = vec4( vec3( l * ( 1.0 - fogA ) ), 1.0 );
      }`,
  });
  m.userData = { w, h, slats, sweep(t0, speed = 0.6) { m.uniforms.uSweep.value.set(t0, speed); } };
  return m;
}

// ---- far rooms (P2) ------------------------------------------------------------
// A fake room behind a pane by interior mapping, for upper-floor windows
// (lane 3 breaks them; near windows have real rooms from lane 4). The room is
// a box behind the pane in the pane's own frame (local x across, y up, -z
// into the room; the pane is a unit plane scaled to its size): the view ray
// is carried into the box and the wall it meets decides the tone - a dark
// back wall, darker side walls, floor and ceiling, a thin lit crack of a door
// on the back wall, a curtain's edge hanging on one side. World-anchored,
// dark; `lit` lifts it a little (a lamp on in there).
export function makeRoomMaterial({ seed = 0, lit = 0, depth = 3.5 } = {}) {
  const m = new THREE.ShaderMaterial({
    name: 'NoirRoom',
    uniforms: {
      uFogColor: sh('uFogColor'), uFogDensity: sh('uFogDensity'),
      uSeed: { value: seed }, uLit: { value: lit }, uDepth: { value: depth },
      uCamLocal: { value: new THREE.Vector3() },   // the eye in the pane's frame (onBeforeRender)
    },
    vertexShader: /* glsl */`
      varying vec3 vLocal;
      varying vec3 vCamLocal;
      varying vec3 vWorld;
      varying vec2 vScale;
      uniform vec3 uCamLocal;
      void main() {
        vLocal = position;
        vCamLocal = uCamLocal;
        vec4 wp = modelMatrix * vec4( position, 1.0 );
        vWorld = wp.xyz;
        vScale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform float uSeed, uLit, uDepth;
      varying vec3 vLocal;
      varying vec3 vCamLocal;
      varying vec3 vWorld;
      varying vec2 vScale;
      ${HASH_GLSL}
      ${NOIR_FOG_GLSL}
      void main() {
        // the ray in metres, in the pane's frame (room: x, y in [-.5, .5]
        // of the pane's size, z from 0 to -depth)
        vec3 s = vec3( vScale, 1.0 );
        vec3 ro = vLocal * s;
        vec3 rd = normalize( ( vLocal - vCamLocal ) * s );
        vec3 hb = vec3( 0.5 * vScale, 0.0 );
        vec3 lo = vec3( - hb.xy, - uDepth ), hi = vec3( hb.xy, 0.0 );
        vec3 tA = ( lo - ro ) / rd, tB = ( hi - ro ) / rd;
        vec3 tf = max( tA, tB );
        float t = min( min( tf.x, tf.y ), tf.z );
        vec3 p = ro + rd * t;
        vec3 u = ( p - lo ) / ( hi - lo );             // 0..1 in the box
        float back = step( tf.z, min( tf.x, tf.y ) + 1e-4 );
        float side = ( 1.0 - back ) * step( tf.x, tf.y );
        float flo = ( 1.0 - back ) * ( 1.0 - side ) * step( rd.y, 0.0 );
        // a room is dark; lit (a lamp on in there, hung high in the middle)
        // its back wall takes a pool that falls off to the corners, the side
        // walls less, the floor and ceiling least: the depth reads in steps
        vec2 lp = vec2( 0.5, 0.85 );
        float pool = exp( - dot( ( u.xy - lp ) * vec2( 1.6, 1.1 ), ( u.xy - lp ) * vec2( 1.6, 1.1 ) ) * 3.0 );
        float tone = back > 0.5 ? mix( 0.008, 0.07 * pool + 0.012, uLit )
                   : side > 0.5 ? mix( 0.005, 0.02 + 0.03 * u.z * pool, uLit )
                   : flo > 0.5 ? mix( 0.003, 0.012, uLit ) : mix( 0.004, 0.018, uLit );
        // a door on the back wall, its crack of light (hashed per room)
        float dx = mix( 0.2, 0.8, hash11( uSeed * 3.1 + 0.7 ) );
        float crack = back * ( 1.0 - smoothstep( 0.004, 0.012, abs( u.x - dx ) ) ) * step( u.y, 0.72 );
        // a curtain's edge: a black fold hanging on one side, near the pane
        float cs = step( 0.5, hash11( uSeed * 1.7 + 0.2 ) );
        float cx = mix( u.x, 1.0 - u.x, cs );
        float curtain = step( cx, 0.16 + 0.03 * sin( u.y * 20.0 + uSeed ) ) * step( 0.55, u.z );
        tone = mix( tone, 0.002, curtain );
        tone += crack * ( 0.12 + 0.6 * uLit ) * ( 1.0 - curtain );
        float fogA = noirFogAmount( length( cameraPosition - vWorld ), vWorld.y, uFogDensity );
        gl_FragColor = vec4( mix( vec3( tone ), uFogColor, fogA ), 1.0 );
      }`,
  });
  m.userData = { room: true, seed, lit };
  const inv = new THREE.Matrix4();
  m.onBeforeRender = (r, sc, cam, g, obj) => {
    m.uniforms.uCamLocal.value.setFromMatrixPosition(cam.matrixWorld).applyMatrix4(inv.copy(obj.matrixWorld).invert());
  };
  return m;
}

// The shared uniform bag (render/uniforms.js) is created by the Game; these
// materials take their clock, lamps and fog from it by reference.
const SHARED = {};
const DEFAULTS = { uTime: 0, uLampCount: 0, uFogDensity: 0.0036 };
function sh(k) {
  if (!SHARED[k]) SHARED[k] = { value: k === 'uFogColor' ? new THREE.Color(0.095, 0.095, 0.095) : k in DEFAULTS ? DEFAULTS[k] : [] };
  return SHARED[k];
}
export function bindGlassUniforms(U) {
  for (const k of ['uTime', 'uLampPos', 'uLampDir', 'uLampParams', 'uLampCount', 'uFogColor', 'uFogDensity']) SHARED[k] = U[k];
}

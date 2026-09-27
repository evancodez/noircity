import * as THREE from 'three';
import { HASH_GLSL } from './common.js';
import { NOIR_FOG_GLSL } from '../fog.js';
import { ADD_KEEP_ALPHA } from '../layers.js';

// Volumetric lamp cone. The mesh is only a proxy (a truncated cone drawn with
// its BACK faces, depthTest off) that covers the pixels the light could touch.
// The fragment shader ray-marches the real density: intersect the view ray with
// the cone's bounding cylinder + height slab, clip the far end against the
// opaque scene depth (soft intersection with cars, people, the street), then
// integrate a density that is bright on the axis, soft at the rim, strongest
// under the shade and gone before the ground. Works with the camera inside.
export function makeConeMaterial(U, { apex, axis, tan, height, r0 = 0.18, intensity = 1, seed = 0, fadeEnd = 1.0, edgeSoft = 0.3 }) {
  return new THREE.ShaderMaterial({
    name: 'NoirCone',
    side: THREE.BackSide,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    ...ADD_KEEP_ALPHA,
    uniforms: {
      ...U,
      uApex: { value: apex.clone() },
      uAxis: { value: axis.clone().normalize() },
      uTan: { value: tan },
      uHeight: { value: height },
      uR0: { value: r0 },
      uIntensity: { value: intensity },
      uSeed: { value: seed },
      uReflCore: { value: 3.0 },   // brightness of the axis core in the planar reflection
      // where along the height (0..1) the light has faded to nothing, and
      // where the radial falloff begins (0 = soft from the axis out)
      uFadeEnd: { value: fadeEnd },
      uEdgeSoft: { value: edgeSoft },
    },
    vertexShader: /* glsl */`
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4( position, 1.0 );
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uApex, uAxis;
      uniform float uTan, uHeight, uR0, uIntensity, uSeed, uReflCore, uFadeEnd, uEdgeSoft;
      uniform sampler2D tDepth, tNoise;
      uniform vec2 uRes;
      uniform float uNear, uFar, uUseDepth, uTime;
      varying vec3 vWorld;
      ${HASH_GLSL}
      ${NOIR_FOG_GLSL}
      float linZ( float d ) {
        float ndc = d * 2.0 - 1.0;
        return ( 2.0 * uNear * uFar ) / ( uFar + uNear - ndc * ( uFar - uNear ) );
      }
      void main() {
        if ( uIntensity <= 0.0 ) discard;
        vec3 ro = cameraPosition;
        vec3 rd = normalize( vWorld - ro );
        vec3 co = ro - uApex;
        float dv = dot( rd, uAxis ), cv = dot( co, uAxis );
        vec3 rp = rd - dv * uAxis, cp = co - cv * uAxis;
        float Rb = uR0 + uHeight * uTan;
        float a = dot( rp, rp ), b = 2.0 * dot( rp, cp ), c = dot( cp, cp ) - Rb * Rb;
        float t0 = 0.0, t1 = 1e5;
        if ( a > 1e-6 ) {
          float disc = b * b - 4.0 * a * c;
          if ( disc <= 0.0 ) discard;
          float sq = sqrt( disc );
          t0 = ( - b - sq ) / ( 2.0 * a );
          t1 = ( - b + sq ) / ( 2.0 * a );
        } else if ( c > 0.0 ) discard;
        if ( abs( dv ) > 1e-5 ) {
          float ta = - cv / dv, tb = ( uHeight - cv ) / dv;
          t0 = max( t0, min( ta, tb ) );
          t1 = min( t1, max( ta, tb ) );
        } else if ( cv < 0.0 || cv > uHeight ) discard;
        t0 = max( t0, 0.0 );
        float tSurf = 1e6;   // distance to the opaque surface behind this pixel
        if ( uUseDepth > 0.5 ) {
          float d = texture2D( tDepth, gl_FragCoord.xy / uRes ).r;
          if ( d < 0.999999 ) {
            vec3 fwd = - vec3( viewMatrix[ 0 ][ 2 ], viewMatrix[ 1 ][ 2 ], viewMatrix[ 2 ][ 2 ] );
            tSurf = linZ( d ) / max( dot( rd, fwd ), 1e-3 );
            t1 = min( t1, tSurf );
          }
        }
        if ( t1 <= t0 ) discard;

        const int STEPS = 14;
        float dt = ( t1 - t0 ) / float( STEPS );
        float j = ign( gl_FragCoord.xy + fract( uTime * 7.0 ) * 61.0 );
        float acc = 0.0, accNear = 0.0;
        for ( int i = 0; i < STEPS; i ++ ) {
          float t = t0 + ( float( i ) + j ) * dt;
          vec3 x = co + rd * t;
          float h = dot( x, uAxis );
          float r = length( x - h * uAxis );
          float coneR = uR0 + max( h, 0.0 ) * uTan;
          float rn = r / coneR;
          vec3 wx = x + uApex;
          float mist = texture2D( tNoise, wx.xz * 0.23 + vec2( wx.y * 0.11, uTime * 0.04 ) + uSeed ).r;
          // a finer tatter so the rim is ragged, like light caught in rain
          float tat = texture2D( tNoise, wx.xz * 0.9 + vec2( wx.y * 0.37, uTime * 0.07 ) - uSeed ).a;
          // the edge threshold wanders with the mist: the fan's rim dissolves
          // into the rain instead of running as a ruled line
          float rnj = rn + ( mist - 0.5 ) * 0.3 + ( tat - 0.5 ) * 0.16;
          float radial = ( 1.0 - smoothstep( uEdgeSoft, 1.05, rnj ) ) * ( 0.55 + 0.45 * exp( - rn * rn * 6.0 ) );
          float hn = clamp( h / uHeight, 0.0, 1.0 );
          // artist's cone, not physics: even brightness down the first half,
          // a hot collar right under the shade, then a fade to NOTHING before
          // the end of the proxy (any light left at hn = 1 draws a base line).
          // uFadeEnd < 1 compresses the whole profile toward the apex (the
          // hanging lamps: gone by ~65 % of the height, never a lit tent
          // standing on the street)
          float hf = hn / uFadeEnd;
          float along = smoothstep( 0.0, 0.04, hn ) * ( 1.0 - smoothstep( 0.15, 1.0, hf ) * 0.8 )
                      * ( 1.0 - smoothstep( 0.55, 1.0, hf + ( mist - 0.5 ) * 0.12 ) );
          along *= 1.0 + 2.0 * exp( - hf * 7.0 );
          // In the planar reflection only (emitters-only, bright-passed,
          // streaked: Pipeline §2): a street lamp mirrors as a NARROW bright
          // core along its axis, from the shade down to the street, so after
          // the bright pass each lamp leaves one thin bar from its foot to its
          // head image, which the streak carries on down the frame: the
          // column under the lamp. (A near lamp's head image lies below the
          // frame; its foot-to-frame-edge core is what makes its column.)
          // The cone's wide body stays under the threshold.
          // (the core has a FIXED width in metres, ~0.35 m: relative to the
          // cone radius it widened to ~1 m at the street and the near lamp's
          // column printed twice as wide as the reference's)
          if ( uUseDepth < 0.5 && uAxis.y < -0.5 ) {
            float core = exp( - r * r / 0.05 );
            along = along * 0.12 + uReflCore * core * smoothstep( 0.0, 0.05, hn ) * ( 1.0 - 0.45 * hn )
                  * ( 1.0 - smoothstep( 0.93, 1.0, hn ) );
          }
          // divide by the local radius so the integrated brightness across the
          // cone stays roughly constant as it widens
          float spread = 1.0 / ( 0.35 + coneR );
          // the mist right around the viewer is not drawn: standing under a
          // lamp shows the cone around you, not a grey veil over the screen
          float camFade = smoothstep( 2.0, 10.0, t );
          float a = radial * along * spread * ( 0.55 + 0.9 * mist ) * camFade;
          acc += a;
          // light within a few metres in front of the surface: it touches it
          accNear += a * smoothstep( tSurf - 9.0, tSurf - 4.0, t );
        }
        acc *= dt;
        accNear *= dt;
        float tm = 0.5 * ( t0 + t1 );
        vec3 pm = ro + rd * tm;
        float fogF = noirFogAmount( tm, pm.y, uFogDensity );
        // soft saturation: looking down a cone's length (or standing in it)
        // must not turn it into an opaque white wall
        float lit = ( 1.0 - exp( - acc * 1.6 ) ) / 1.6;
        // far cones step back: each one stays a distinct shape in the mist
        // instead of summing with its neighbours into a white wall
        float farAtt = 1.0 / ( 1.0 + 0.025 * max( tm - 8.0, 0.0 ) );
        float total = uIntensity * lit * ( 1.0 - fogF * 0.85 ) * farAtt;
        // volume pass: R = B = all the cone light, G = the part that hugs the
        // surface behind it. The ink pass paints figures (cars, Hoods) as black
        // silhouettes by dropping the light that floats well in front of them,
        // while light that actually falls on them stays. The reflection pass
        // has no depth and must stay grey (chroma would leak into the street).
        float nearShare = uUseDepth > 0.5 ? accNear / max( acc, 1e-5 ) : 1.0;
        gl_FragColor = vec4( total, total * nearShare, total, 1.0 );
      }`,
  });
}

// Proxy mesh for a cone: truncated cone around +Y from apex (top) downward,
// then oriented along `axis`.
export function makeConeMesh(U, opts) {
  const { apex, axis, tan, height, r0 = 0.18 } = opts;
  const rb = (r0 + height * tan) * 1.08 + 0.05;
  const geo = new THREE.CylinderGeometry(r0 * 1.2 + 0.05, rb, height, 24, 1, false);
  geo.translate(0, -height / 2, 0); // top at origin
  const mat = makeConeMaterial(U, opts);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(apex);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), axis.clone().normalize());
  mesh.frustumCulled = true;
  mesh.renderOrder = 5;
  return mesh;
}

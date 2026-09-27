// Shared GLSL snippets.

export const FULLSCREEN_VERT = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4( position.xy, 0.0, 1.0 );
}`;

export const HASH_GLSL = /* glsl */`
float hash12( vec2 p ) {
  vec3 p3 = fract( vec3( p.xyx ) * 0.1031 );
  p3 += dot( p3, p3.yzx + 33.33 );
  return fract( ( p3.x + p3.y ) * p3.z );
}
vec2 hash22( vec2 p ) {
  vec3 p3 = fract( vec3( p.xyx ) * vec3( 0.1031, 0.1030, 0.0973 ) );
  p3 += dot( p3, p3.yzx + 33.33 );
  return fract( ( p3.xx + p3.yz ) * p3.zy );
}
float hash11( float p ) {
  p = fract( p * 0.1031 );
  p *= p + 33.33;
  p *= p + p;
  return fract( p );
}
// Interleaved gradient noise: cheap per-pixel dither for ray-march jitter.
float ign( vec2 fc ) { return fract( 52.9829189 * fract( dot( fc, vec2( 0.06711056, 0.00583715 ) ) ) ); }
`;

export const LUMA_GLSL = /* glsl */`
float luma( vec3 c ) { return dot( c, vec3( 0.2126, 0.7152, 0.0722 ) ); }
`;

// Lamp registry (world/Lights.js) as seen by shaders: world-space position,
// direction, params = (cos half-angle, range, intensity, tan half-angle).
export const MAX_LAMPS = 24;
export const LAMPS_GLSL = /* glsl */`
#define MAX_LAMPS ${MAX_LAMPS}
uniform vec3 uLampPos[ MAX_LAMPS ];
uniform vec3 uLampDir[ MAX_LAMPS ];
uniform vec4 uLampParams[ MAX_LAMPS ];
uniform int uLampCount;

// How strongly a point sits inside the lamps' light cones (for lit rain, steam).
float lampCones( vec3 p ) {
  float acc = 0.0;
  for ( int i = 0; i < MAX_LAMPS; i ++ ) {
    if ( i >= uLampCount ) break;
    vec4 prm = uLampParams[ i ];
    if ( prm.z <= 0.0 ) continue;
    vec3 v = p - uLampPos[ i ];
    float h = dot( v, uLampDir[ i ] );
    float d2 = dot( v, v );
    if ( h <= 0.0 || h > prm.y ) continue;
    float r = sqrt( max( d2 - h * h, 0.0 ) );
    float edge = h * prm.w + 0.15;
    float inside = 1.0 - smoothstep( edge * 0.55, edge * 1.05, r );
    float fall = 1.0 / ( 1.0 + 0.06 * d2 );
    fall *= 1.0 - smoothstep( prm.y * 0.55, prm.y, h );
    acc += inside * fall * prm.z;
  }
  return acc;
}
`;

// Manual depth test against the opaque depth (for passes without a depth
// buffer). Needs uniforms tDepth, uRes (size of the CURRENT target), uNear, uFar.
export const DEPTH_TEST_GLSL = /* glsl */`
float sceneViewZ() {
  float d = texture2D( tDepth, gl_FragCoord.xy / uRes ).r;
  if ( d >= 0.999999 ) return 1e6;
  float ndc = d * 2.0 - 1.0;
  return ( 2.0 * uNear * uFar ) / ( uFar + uNear - ndc * ( uFar - uNear ) );
}
bool behindScene( float viewZ, float eps ) { return viewZ > sceneViewZ() + eps; }
`;

import * as THREE from 'three';
import { NOIR_FOG_GLSL } from '../../render/fog.js';
import { LAMPS_GLSL } from '../../render/shaders/common.js';

// The river at night (lane R2-D): black water that carries the lights in it.
// The street's wet shader mirrors emitters on the plane y = 0; the river lies
// 2.1 m under it and its lights are far off (the far bank at 150 .. 400 m:
// sub-pixel in the street's half-res mirror, so the water took no light at
// all, and its wet-stone flecks printed it as black ground). Here each light
// the river should carry - the quay's lamps near the eye, the far bank's
// lamps and windows - is a column of its own, laid out on the screen each
// frame (its foot on the water under it, its mirror image, the column from
// the one down past the other), broken into horizontal dashes by ripples
// anchored in the water (they drift slowly; rain dimples them near the eye).
// Between the columns: black, with the sky's sheen at a grazing angle in
// long thin streaks, and the fog.
//   makeWater(U) -> material; water.setLights(list, camera, res) each frame:
//   list [{ p: Vector3 (the light), k: brightness, w: its size, m }]
export const MAX_COLS = 28;

export function makeWaterMaterial(U, waterY) {
  const cols = [], ks = [];
  for (let i = 0; i < MAX_COLS; i++) { cols.push(new THREE.Vector4()); ks.push(new THREE.Vector4()); }
  const mat = new THREE.ShaderMaterial({
    name: 'NoirRiver',
    uniforms: {
      uLampPos: U.uLampPos, uLampDir: U.uLampDir, uLampParams: U.uLampParams, uLampCount: U.uLampCount,
      uTime: U.uTime, uFogColor: U.uFogColor, uFogDensity: U.uFogDensity, tNoise: U.tNoise, tBrush: U.tBrush, uRes: U.uRes, uLightning: U.uLightning,
      uDrop: { value: new THREE.Vector4(0, 0, -100, 0) },
      uCol: { value: cols }, uColK: { value: ks }, uColN: { value: 0 },
      uFwd: { value: new THREE.Vector2(0, -1) }, uWaterY: { value: waterY },
    },
    vertexShader: /* glsl */`
      varying vec3 vWorld;
      varying vec3 vViewPos;
      void main() {
        vec4 wp = modelMatrix * vec4( position, 1.0 );
        vWorld = wp.xyz;
        vec4 mv = viewMatrix * wp;
        vViewPos = mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      #define MAX_COLS ${MAX_COLS}
      uniform vec4 uDrop;   // a thing dropped in: x, z, when, how hard
      uniform float uTime, uLightning, uWaterY;
      uniform sampler2D tNoise, tBrush;
      uniform vec2 uRes, uFwd;
      uniform vec4 uCol[ MAX_COLS ];   // screen px: x, the foot's y, the mirror's y, half width
      uniform vec4 uColK[ MAX_COLS ];  // brightness (fogged), the reach past the mirror (x its span), dash scale, -
      uniform int uColN;
      varying vec3 vWorld;
      varying vec3 vViewPos;
      ${NOIR_FOG_GLSL}
      ${LAMPS_GLSL}
      void main() {
        vec2 fc = gl_FragCoord.xy;
        float dist = length( vViewPos );
        vec2 P = vWorld.xz;
        // the water's own frame: along the view (fw) and across it (lt)
        vec2 fw = normalize( uFwd ), lt = vec2( -fw.y, fw.x );
        float a = dot( P, lt ), b = dot( P, fw );
        // ripples: long horizontal dashes on the screen (stretched across the
        // view), anchored in the water, drifting; finer near the eye
        float t = uTime;
        float r1 = texture2D( tNoise, vec2( a * 0.018, b * 0.34 + t * 0.05 ) ).r;
        float r2 = texture2D( tNoise, vec2( a * 0.05 + 0.3, b * 0.9 - t * 0.08 ) ).g;
        float rip = r1 * 0.62 + r2 * 0.38;
        // (the rain: dimples near the eye, gone by 25 m)
        float rain = texture2D( tNoise, P * 0.9 + vec2( t * 0.7, -t * 0.4 ) ).b;
        rain = smoothstep( 0.72, 0.9, rain ) * ( 1.0 - smoothstep( 8.0, 25.0, dist ) );
        // the columns
        vec3 col = vec3( 0.0 );
        for ( int i = 0; i < MAX_COLS; i ++ ) {
          if ( i >= uColN ) break;
          vec4 c = uCol[ i ], k = uColK[ i ];
          float span = max( c.y - c.z, 1.0 );            // foot above the mirror (px, y up)
          float u = ( c.y - fc.y ) / span;               // 0 at the foot, 1 at the mirror image
          if ( u < -0.05 || u > 1.0 + k.y ) continue;
          // (each dash row sits a little to one side: the ripples' wobble)
          float wob = ( texture2D( tNoise, vec2( a * 0.004 + float( i ) * 0.137, b * k.z * 0.25 ) ).g - 0.5 ) * 1.3;
          float hw = c.w * ( 0.75 + 0.6 * u );
          float dx = abs( fc.x - c.x - wob * hw );
          float across = 1.0 - smoothstep( hw * 0.55, hw * 1.25, dx );
          if ( across <= 0.0 ) continue;
          // along: in from the foot, strongest round the mirror image, out
          // past it
          float along = smoothstep( -0.05, 0.35, u ) * ( 1.0 - smoothstep( 1.0, 1.0 + k.y, u ) );
          along *= ( 0.4 + 0.6 * exp( - pow( ( u - 1.0 ) * 1.4, 2.0 ) ) ) * mix( 1.0, 0.45, smoothstep( 1.0, 1.0 + k.y, u ) );
          // broken into dashes: the ripples' crests take the light
          float dsh = texture2D( tNoise, vec2( a * 0.03 + float( i ) * 0.61, b * k.z ) ).r * 0.6 + rip * 0.4;
          float dash = smoothstep( 0.42, 0.6, dsh );
          col += vec3( k.x * across * along * mix( 0.12, 1.0, dash ) );
        }
        // the sky's sheen at a grazing angle: thin streaks far out, nothing
        // underfoot
        vec3 V = normalize( vWorld - cameraPosition );
        float graze = pow( 1.0 - clamp( -V.y, 0.0, 1.0 ), 6.0 );
        float streak = smoothstep( 0.5, 0.75, rip );
        // (only far out: near the eye a dark wash on the water was dry-brushed
        // by the ink into long grey scratches - the water there is black)
        float farW = smoothstep( 35.0, 140.0, dist );
        vec3 sheen = uFogColor * ( 0.05 + 0.6 * streak ) * graze * farW * ( 1.0 + 3.0 * uLightning );
        // under a lamp that leans out over it, the water takes the light: a
        // patch of broken ripples (the lamps' cones, as the lit rain has them)
        float cone = lampCones( vWorld );
        float glint = smoothstep( 0.5, 0.78, rip ) + rain * 2.0;
        // a thing dropped in (his hat): its rings run out over the water
        float rings = 0.0;
        {
          float age = uTime - uDrop.z;
          if ( age > 0.0 && age < 3.0 ) {
            float rr = 0.1 + age * 0.75, dd = length( P - uDrop.xy );
            float band = exp( - pow( ( dd - rr ) / ( 0.03 + 0.02 * age ), 2.0 ) ) + 0.6 * exp( - pow( ( dd - rr * 0.6 ) / ( 0.025 + 0.015 * age ), 2.0 ) );
            rings = band * ( 1.0 - age / 3.0 ) * uDrop.w;
          }
        }
        vec3 lamp = vec3( 3.2 * cone * ( 0.03 + glint ) + rings * ( 0.45 + 3.0 * cone ) );
        vec3 base = sheen + lamp;
        col = base + col;
        // (the fog as it lies over the street's own level: at the water's
        // level the ground mist was full and the far river a white plate)
        vec4 nf = noirFog( dist, 1.5, uFogDensity, uFogColor );
        col = mix( col, nf.rgb, nf.a );
        gl_FragColor = vec4( col, 1.0 );
      }`,
  });
  // ---- each frame: the columns on the screen -------------------------------------------------------
  const _p = new THREE.Vector3(), _m = new THREE.Vector3(), _f = new THREE.Vector3(), _e = new THREE.Vector3();
  const rows = [];
  mat.setLights = (list, camera, res) => {
    const W = res.x, H = res.y;
    camera.updateMatrixWorld();
    _e.setFromMatrixPosition(camera.matrixWorld);
    const eyeH = _e.y - waterY;
    rows.length = 0;
    const toPx = (v) => { v.project(camera); return v; };
    for (const L of list) {
      const d = Math.hypot(L.p.x - _e.x, L.p.z - _e.z);
      if (d < 1.5) continue;
      // the light's mirror in the water, and the water under the light
      _m.set(L.p.x, 2 * waterY - L.p.y, L.p.z);
      _f.set(L.p.x, waterY, L.p.z);
      // (behind the eye: none)
      _p.copy(_m).applyMatrix4(camera.matrixWorldInverse);
      if (_p.z > -0.5) continue;
      toPx(_m); toPx(_f);
      if (Math.abs(_m.x) > 1.3 || _f.y < -1.2) continue;
      const mx = (_m.x * 0.5 + 0.5) * W, my = (_m.y * 0.5 + 0.5) * H, fy = (_f.y * 0.5 + 0.5) * H;
      // (the fog between the eye and the light, as the fog shader has it)
      const haze = 1 - Math.exp(-0.0036 * 3.7 * Math.max(d - 30, 0));
      const k = L.k * (1 - haze * haze);
      if (k < 0.01) continue;
      // its width: the light's size across, spread by the ripples (more
      // for a light high over the water and near)
      const f = (H / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
      const hw = Math.max(1.4, (L.w * 0.5 + 0.02 * d * 0.25) * f / Math.max(d, 1));
      // how far the column runs on past its mirror image (in spans): a far
      // light's column is long and thin, a near one's broken and short
      const reach = 0.8 + 3.2 * Math.min(1, d / 140) + 0.4 * Math.min(1, eyeH / 4);
      rows.push([mx, fy, my, hw, k, reach, 0.9 + 0.8 * Math.min(1, 40 / d), d]);
    }
    rows.sort((a, b) => b[4] - a[4]);
    const n = Math.min(MAX_COLS, rows.length);
    for (let i = 0; i < n; i++) {
      const r = rows[i];
      cols[i].set(r[0], r[1], r[2], r[3]);
      ks[i].set(r[4], r[5], r[6], 0);
    }
    mat.uniforms.uColN.value = n;
    const fwd = _p.set(0, 0, -1).transformDirection(camera.matrixWorld);
    const l = Math.hypot(fwd.x, fwd.z) || 1;
    mat.uniforms.uFwd.value.set(fwd.x / l, fwd.z / l);
  };
  return mat;
}

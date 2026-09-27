import * as THREE from 'three';
import { HASH_GLSL } from './common.js';
import { NOIR_FOG_GLSL } from '../fog.js';

// Wet street. A ShaderMaterial with lights:true so it can read three's spot /
// point light uniforms and spot shadow maps, but with its own BRDF:
//   - dark asphalt with low-frequency tone, ink-splatter blobs (dead black,
//     non-reflective), tram rails that catch the light
//   - reflection model (Phase 1b): the planar reflection is EMITTERS ONLY
//     (black clear/fog, bright pass, long vertical streak: Pipeline §2), so
//     the road stays dark asphalt and every light leaves ONE column, textured
//     by world-anchored horizontal ripple dashes; the storm sky only comes
//     back as a faint fresnel sheen; puddles add a sharp mirror
//   - rain ring ripples + footstep/shot impact rings perturb the normal and
//     distort the reflection lookup
//   - wet GGX specular for every lamp, with shadows
// (12: Phase 3a adds Hood footfalls, the blast's rings, the hydrant)
export const MAX_IMPACTS = 12;
// blast shockwaves (Phase 3a review): one bold ring per explosion, racing
// out to ~6 m in 0.4 s with a bright broken crest (Street.addBlast)
export const MAX_BLASTS = 2;

export function makeGroundUniformsShared(tex) {
  const impacts = [];
  for (let i = 0; i < MAX_IMPACTS; i++) impacts.push(new THREE.Vector4(0, 0, -100, 0));
  const blasts = [];
  for (let i = 0; i < MAX_BLASTS; i++) blasts.push(new THREE.Vector4(0, 0, -100, 0));
  return {
    tRefl: { value: null },
    tReflBlur: { value: null },
    uReflMatrix: { value: new THREE.Matrix4() },
    tNoise: { value: tex.noise },
    tBrush: { value: tex.brush },
    uImpacts: { value: impacts },
    uBlasts: { value: blasts },
    uReflStrength: { value: 1.0 },
    uGroundDebug: { value: 0 },   // ?gdbg=: 1 base, 2 direct, 3 column, 4 sheen, 5 dash, 6 rSharp*puddle, 7 blobs, 8 near wash
  };
}

// `U` is the shared uniform bag (render/uniforms.js).
export function makeGroundMaterial(U, { paving = 0 } = {}) {
  const uniforms = Object.assign(
    THREE.UniformsUtils.clone(THREE.UniformsLib.lights),
    U,
    { uPaving: { value: paving } },
  );
  const mat = new THREE.ShaderMaterial({
    name: paving ? 'NoirPavement' : 'NoirStreet',
    lights: true,
    uniforms,
    vertexShader: /* glsl */`
      #include <common>
      #include <shadowmap_pars_vertex>
      uniform mat4 uReflMatrix;
      varying vec3 vWorld;
      varying vec3 vViewPos;
      varying vec4 vReflCoord;
      void main() {
        #include <beginnormal_vertex>
        #include <defaultnormal_vertex>
        #include <begin_vertex>
        #include <project_vertex>
        #include <worldpos_vertex>
        vec4 wp = modelMatrix * vec4( transformed, 1.0 );
        vWorld = wp.xyz;
        vViewPos = mvPosition.xyz;
        vReflCoord = uReflMatrix * vec4( wp.x, 0.0, wp.z, 1.0 );
        #include <shadowmap_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <packing>
      #include <lights_pars_begin>
      #include <shadowmap_pars_fragment>
      uniform sampler2D tRefl, tReflBlur, tNoise, tBrush;
      uniform float uTime, uPaving, uReflStrength;
      uniform int uGroundDebug;
      uniform vec2 uRes;
      uniform vec4 uImpacts[ ${MAX_IMPACTS} ];
      uniform vec4 uBlasts[ ${MAX_BLASTS} ];
      varying vec3 vWorld;
      varying vec3 vViewPos;
      varying vec4 vReflCoord;
      ${HASH_GLSL}
      ${NOIR_FOG_GLSL}

      // Rain rings: every 0.8 m cell spawns one expanding ring per cycle at a
      // fresh random spot. Returns the height gradient (xz); 'crest' gets the
      // ring's thin leading crest (printed as a light arc on the dark water).
      vec2 rainRipples( vec2 p, float t, out float crest ) {
        vec2 acc = vec2( 0.0 );
        crest = 0.0;
        vec2 q = p * 1.25;
        vec2 cell = floor( q );
        for ( int j = -1; j <= 1; j ++ ) {
          for ( int i = -1; i <= 1; i ++ ) {
            vec2 c = cell + vec2( float( i ), float( j ) );
            float h = hash12( c );
            float tt = t * ( 1.1 + 0.6 * h ) + h * 10.0;
            float cyc = floor( tt );
            float ph = tt - cyc;
            vec2 ctr = c + 0.15 + 0.7 * hash22( c + cyc * 13.7 );
            vec2 dv = q - ctr;
            float r = length( dv );
            float R = ph * 0.75;
            float x = ( r - R ) * 22.0;
            float env = ( 1.0 - ph ) * ( 1.0 - ph ) * smoothstep( R + 0.12, R, r );
            float wave = sin( x * 3.14159 ) * exp( - x * x * 0.3 ) * env;
            acc += dv / max( r, 1e-3 ) * wave;
            crest = max( crest, exp( - x * x * 4.5 ) * env * env );
          }
        }
        return acc * 0.45;
      }

      // Footstep / bullet rings pushed from the game (x, z, startTime, strength).
      vec2 impactRipples( vec2 p ) {
        vec2 acc = vec2( 0.0 );
        for ( int i = 0; i < ${MAX_IMPACTS}; i ++ ) {
          vec4 im = uImpacts[ i ];
          float age = uTime - im.z;
          if ( age < 0.0 || age > 2.0 ) continue;
          vec2 dv = p - im.xy;
          float r = length( dv );
          float R = age * 1.1;
          float x = ( r - R ) * 9.0;
          float env = ( 1.0 - age / 2.0 ) * ( 1.0 - age / 2.0 ) * im.w;
          acc += dv / max( r, 1e-3 ) * sin( x * 3.14159 ) * exp( - x * x * 0.25 ) * env;
        }
        return acc;
      }

      // Blast shockwave (x, z, startTime, strength): ONE bold ring whose
      // front races out and slows (~2.5 m at 0.1 s, ~5.8 m at 0.4 s, 7 m
      // max), a ~0.4 m crest ~3x a bullet ring's amplitude. 'crest' gets its
      // leading edge, broken along the ring like an inked line, bright only
      // for the first ~0.7 s: a white ripple like the reference's puddle rings.
      vec2 blastRings( vec2 p, out float crest ) {
        vec2 acc = vec2( 0.0 );
        crest = 0.0;
        for ( int i = 0; i < ${MAX_BLASTS}; i ++ ) {
          vec4 b = uBlasts[ i ];
          float age = uTime - b.z;
          if ( age < 0.0 || age > 1.8 ) continue;
          vec2 dv = p - b.xy;
          float r = length( dv );
          float R = 7.0 * ( 1.0 - exp( - age * 4.5 ) );
          float x = ( r - R ) / 0.2;
          float env = b.w * ( 1.0 - smoothstep( 0.4, 1.8, age ) ) * smoothstep( 0.0, 0.03, age );
          acc += dv / max( r, 1e-3 ) * sin( x * 1.6 ) * exp( - x * x * 0.35 ) * env;
          // (the crest: the ring's leading edge, a thin line cut into dashes
          // by the world-anchored dry brush - an inker's broken line, not a
          // smooth CG hoop - with a fainter second line trailing it)
          float brk = smoothstep( 0.32, 0.52, texture2D( tBrush, p * 0.23 + b.xy * 0.37 ).g )
                    * smoothstep( 0.18, 0.4, texture2D( tNoise, p * 0.61 + 3.7 ).a );
          float lead = exp( - ( x + 0.2 ) * ( x + 0.2 ) * 3.0 );
          float trail = exp( - ( x + 2.6 ) * ( x + 2.6 ) * 4.0 ) * 0.55;
          float cr = ( lead + trail * ( 1.0 - brk * 0.6 ) ) * ( 1.0 - smoothstep( 0.3, 0.8, age ) );
          crest = max( crest, cr * brk * min( b.w / 3.0, 1.0 ) );
        }
        return acc;
      }

      // Irregular dead-black ink blobs with ragged edges and satellite drops.
      float inkBlobs( vec2 p ) {
        float m = 0.0;
        vec2 q = p / 3.4;
        vec2 cell = floor( q );
        float rag = texture2D( tNoise, p * 0.7 ).a - 0.5;
        for ( int j = -1; j <= 1; j ++ ) {
          for ( int i = -1; i <= 1; i ++ ) {
            vec2 c = cell + vec2( float( i ), float( j ) );
            vec2 h = hash22( c + 41.3 );
            if ( h.x < 0.5 ) continue;
            vec2 ctr = c + 0.2 + 0.6 * hash22( c + 7.1 );
            float rad = mix( 0.05, 0.26, h.y * h.y );
            vec2 dv = q - ctr;
            float ang = h.x * 6.28;
            dv = mat2( cos( ang ), -sin( ang ), sin( ang ), cos( ang ) ) * dv;
            float d = length( dv * vec2( 1.0, mix( 0.55, 1.3, h.y ) ) ) + rag * 0.16;
            m = max( m, 1.0 - smoothstep( rad * 0.85, rad, d ) );
            // droplets flung around the blob
            vec2 s = hash22( c + 3.3 ) - 0.5;
            float d2 = length( q - ctr - s * rad * 5.0 ) + rag * 0.03;
            m = max( m, 1.0 - smoothstep( rad * 0.18, rad * 0.24, d2 ) );
          }
        }
        return m;
      }

      // One octave of world-anchored ripple DASHES. Rows are 'pitch' metres
      // deep in z (tall near the camera, compressing with distance), but a
      // row is never a continuous band: it is cut along x into segments of
      // irregular length (~len m, joints wandering and staggered row to row
      // like a brick bond), and every segment is its own short ripple crest
      // with its own height in the row, thickness and tilt, and a hash decides
      // whether it carries a crest at all. So crests never line up across the
      // road, and the spacing between consecutive crests down a column runs
      // anywhere from ~0.3 to ~1.7 pitches (no rungs at one period). Segment
      // ends taper to a point; the horizontal dry-brush family breaks the
      // thickness along the crest (bristle edges).
      // Coverage by construction: a share q of the segments is on, each
      // covering ~w of its row, q * w ~= cov (0.82 = mean of the tapers).
      // 'fade' -> 0 once a row is < 2 px, where the caller replaces the mask
      // by its mean (no aliasing).
      // Near-field wash / blot mask (Phase 1c polish #4): thresholded
      // low-frequency fbm, cells stretched ~1.5x along z in the WORLD so the
      // foreshortened street prints them ~1.5:1 on screen (the old x-stretched
      // noise x the horizontal brush printed 6:1 hard-edged streaks), with
      // ragged rims from a fine isotropic octave.
      float nearFbm( vec2 p, float seed ) {
        vec2 q = p * vec2( 0.36, 0.24 ) + seed;
        return texture2D( tNoise, q ).g * 0.5
             + texture2D( tNoise, q * 2.03 + 1.7 ).r * 0.25
             + texture2D( tNoise, q * 4.1 + 3.1 ).b * 0.15
             + texture2D( tNoise, p * vec2( 1.9, 1.5 ) + seed * 2.3 ).a * 0.1;
      }
      float nearMask( vec2 p, float seed, float thr ) {
        float rag = ( texture2D( tNoise, p * 3.3 + seed * 1.7 ).a - 0.5 ) * 0.07;
        return smoothstep( thr, thr + 0.02, nearFbm( p, seed ) + rag );
      }

      float rippleDashes( vec2 p, float pitch, float len, float cov, float seed, out float fade ) {
        float warp = texture2D( tNoise, p * vec2( 0.14 / len, 0.04 / pitch ) + seed ).r - 0.5;
        // a finer second octave: +-25 % local pitch, rows kink irregularly
        float warp2 = texture2D( tNoise, p * vec2( 0.41 / len, 0.11 / pitch ) + seed * 1.7 ).a - 0.5;
        float rz = p.y / pitch + warp * 1.4 + warp2 * 0.9;
        float row = floor( rz );
        float fy = fract( rz );
        vec2 hr = hash22( vec2( row * 1.37 + seed, seed * 7.1 + 3.0 ) );
        float sx = p.x / len + hr.x * 13.0
                 + ( texture2D( tNoise, vec2( p.x * 0.07 / len, row * 0.131 + seed * 0.37 ) ).g - 0.5 ) * 2.4;
        float seg = floor( sx );
        float fx = fract( sx );
        vec2 hs = hash22( vec2( seg * 0.917 + row * 3.1 + seed, row * 1.71 - seg * 0.29 + seed * 5.3 ) );
        vec2 hs2 = hash22( vec2( seg * 2.31 - row * 0.77 + seed * 2.9, row * 0.61 + seg * 1.37 ) );
        float q = clamp( 0.14 + 1.25 * cov, 0.0, 0.95 );
        float w = clamp( cov / ( q * 0.82 ), 0.0, 1.0 );
        float on = step( hs.x, q );
        float wS = w * mix( 0.55, 1.45, hs2.x );
        float c = 0.5 + ( hs.y - 0.5 ) * max( 1.0 - wS, 0.0 ) + ( fx - 0.5 ) * ( hs2.y - 0.5 ) * 0.35;
        float endT = smoothstep( 0.0, 0.16, fx ) * smoothstep( 1.0, 0.84, fx );
        float m = texture2D( tBrush, vec2( p.x * 0.16 / len + hr.y * 7.0, row * 0.093 + fy * 0.04 + seed ) ).b;
        float halfW = 0.5 * wS * endT * ( 0.55 + 0.9 * m );
        float e = max( fwidth( rz ) * 0.75, 0.02 );
        float rowPx = 1.0 / max( fwidth( rz ), 1e-4 );
        fade = smoothstep( 1.6, 3.2, rowPx );
        return on * ( 1.0 - smoothstep( halfW - e, halfW + e, abs( fy - c ) ) );
      }

      // ks: specular share. The column (reflection) already IS the lamp's
      // mirror image on the wet road; a full-strength rough GGX lobe on top
      // of it printed a broad mid-grey pool around every lamp (the plate
      // between the columns), so the rough asphalt keeps a fifth of it and
      // puddles keep their hot glints.
      vec3 wetBRDF( vec3 lcol, vec3 L, vec3 N, vec3 V, float rough, float alb, float ks ) {
        float NoL = saturate( dot( N, L ) );
        if ( NoL <= 0.0 ) return vec3( 0.0 );
        vec3 H = normalize( L + V );
        float NoH = saturate( dot( N, H ) );
        float a = rough * rough;
        float a2 = a * a;
        float dd = NoH * NoH * ( a2 - 1.0 ) + 1.0;
        float D = a2 / ( PI * dd * dd );
        float F = 0.02 + 0.98 * pow( 1.0 - saturate( dot( V, H ) ), 5.0 );
        float spec = min( D * F * 0.25, 60.0 );
        return lcol * NoL * ( alb * RECIPROCAL_PI + spec * ks );
      }

      void main() {
        vec2 p = vWorld.xz;
        float dist = length( vViewPos );

        // ---- surface structure -------------------------------------------
        vec4 n0 = texture2D( tNoise, p * 0.0105 );
        vec4 n1 = texture2D( tNoise, p * 0.061 + 0.5 );
        vec4 n2 = texture2D( tNoise, p * 0.43 );
        float field = n0.g * 0.62 + n1.r * 0.38;
        // puddle rims are dragged out by a (world-space) horizontal dry brush
        // so no puddle ends in a smooth noise contour
        float pb = texture2D( tBrush, p * vec2( 0.045, 0.16 ) ).b;
        float puddle = smoothstep( 0.5, 0.56, field + uPaving * -0.08 + ( pb - 0.5 ) * 0.07 );
        // big irregular dead-black splatter (0.3-1.5 m), ragged edged: the
        // reference's ink blots that cut the wet sheen. Threshold on the
        // big-blob noise, broken by finer noise so no two share a shape.
        float splat = texture2D( tNoise, p * 0.115 + 3.7 ).g * 0.8 + texture2D( tNoise, p * 0.52 + 1.3 ).a * 0.2
                    + ( texture2D( tNoise, p * 1.9 ).r - 0.5 ) * 0.07;
        // In the near field (< ~10 m) they are the reference's bottom edge:
        // large splatter (1-2 m) over the grey wash, ~25-30 % of the road
        // (right under the viewer a 2 m pool of ink swallowed the columns'
        // feet and read as plain black road: there the splatter below takes over)
        float bigBlobs = smoothstep( 0.635, 0.655, splat ) * smoothstep( 3.5, 7.0, dist );
        // near splatter: many 0.1-0.4 m blots, flattened along x, with ragged
        // rims and flung drops (a mid-frequency threshold broken by fine noise)
        float nearB = ( 1.0 - smoothstep( 5.0, 11.0, dist ) ) * ( 1.0 - uPaving );
        // (Phase 1c: ~1.5:1 on screen, not flattened along x)
        float ns = texture2D( tNoise, p * vec2( 0.95, 0.66 ) + 7.7 ).g * 0.62
                 + texture2D( tNoise, p * vec2( 0.3, 0.21 ) + 5.2 ).r * 0.2
                 + texture2D( tNoise, p * vec2( 3.2, 2.6 ) + 2.1 ).a * 0.18;
        float nearSplat = smoothstep( 0.6, 0.615, ns ) * nearB;
        float blobs = max( max( inkBlobs( p ), bigBlobs ), nearSplat ) * ( 1.0 - uPaving * 0.6 );
        float grain = n2.a * 0.55 + n1.b * 0.45;
        // dark asphalt: ambient * albedo prints ~0.06-0.12 (render/tone.js),
        // with grain; the light lives in the reflections, the ink blobs are
        // dead black
        float albedo = mix( 0.019, 0.028, grain );
        float rough = mix( 0.42, 0.07, puddle );

        // tram rails: two tracks, bright steel with a dark groove beside each rail
        float fw = fwidth( p.x ) + 1e-4;
        float rail = 0.0, groove = 0.0;
        if ( uPaving < -1.0 ) { // (tram rails retired: the el's columns now stand in the lanes)
          for ( int k = 0; k < 4; k ++ ) {
            float rx = ( k < 2 ? 0.9 : 4.2 ) + ( ( k == 0 || k == 2 ) ? -0.7175 : 0.7175 );
            float dx = abs( p.x - rx );
            rail = max( rail, 1.0 - smoothstep( 0.022 - fw, 0.022 + fw, dx ) );
            groove = max( groove, 1.0 - smoothstep( 0.02 - fw, 0.02 + fw, abs( dx - 0.055 ) ) );
          }
          float railFade = 1.0 - smoothstep( 0.02, 0.08, fw );
          rail *= railFade; groove *= railFade;
        }

        // pavement slabs: faint jittered joints
        float joint = 0.0;
        if ( uPaving > 0.5 ) {
          vec2 sp = vec2( p.x / 1.5, p.y / 1.1 );
          sp.x += floor( sp.y ) * 0.37;
          vec2 f = abs( fract( sp ) - 0.5 );
          vec2 fwj = fwidth( sp ) + 1e-4;
          joint = max( smoothstep( 0.49 - fwj.x, 0.5, f.x ), smoothstep( 0.49 - fwj.y, 0.5, f.y ) );
          joint *= 1.0 - smoothstep( 0.05, 0.2, max( fwj.x, fwj.y ) );
          float slab = hash12( floor( sp ) );
          albedo = mix( 0.018, 0.028, slab * 0.6 + grain * 0.4 );
          rough = mix( 0.5, 0.12, puddle );
        }

        albedo *= ( 1.0 - 0.9 * blobs ) * ( 1.0 - 0.6 * groove ) * ( 1.0 - 0.3 * joint );
        albedo = mix( albedo, 0.1, rail );
        rough = mix( rough, 0.2, rail );

        // ---- normal: rain rings + impacts + wind-rippled micro noise ------
        float nearFade = 1.0 - smoothstep( 16.0, 34.0, dist );
        float crest;
        vec2 grad = rainRipples( p, uTime, crest ) * nearFade * ( 0.5 + 0.8 * puddle );
        crest *= 1.0 - smoothstep( 5.0, 10.0, dist );
        grad += impactRipples( p ) * ( 0.4 + puddle );
        float blastCrest;
        grad += blastRings( p, blastCrest ) * ( 0.5 + 0.5 * puddle );
        vec2 micro = ( texture2D( tNoise, p * 0.9 + uTime * vec2( 0.021, 0.047 ) ).rb - 0.5 )
                   + ( texture2D( tNoise, p * 2.3 - uTime * vec2( 0.033, 0.018 ) ).rb - 0.5 ) * 0.5;
        grad += micro * mix( 0.12, 0.03, puddle );
        vec3 Nw = normalize( vec3( - grad.x, 1.0, - grad.y ) );
        vec3 N = normalize( ( viewMatrix * vec4( Nw, 0.0 ) ).xyz );
        vec3 V = normalize( - vViewPos );

        // ---- reflection (emitters only) -----------------------------------
        vec2 ruv = vReflCoord.xy / vReflCoord.w;
        float wave = texture2D( tNoise, vec2( p.x * 0.33, p.y * 1.7 ) + vec2( 0.0, uTime * 0.02 ) ).b - 0.5;
        vec2 dis = grad * mix( 0.02, 0.008, puddle ) * ( 1.0 / ( 1.0 + dist * 0.05 ) );
        // a slight sideways waver only: a column stays a straight bar
        dis.x += wave * 0.006 * ( 1.0 - puddle * 0.7 );
        vec4 rS = texture2D( tRefl, ruv + dis * 0.6 );
        vec3 rSharp = rS.rgb;
        float coverage = clamp( rS.a, 0.0, 1.0 );   // geometry mirrored here (cleared = 0)
        // the sharp mirror only ADDS light that is itself a light (lamp heads,
        // lit windows, headlights, cone cores: above the bright-pass T); any
        // mirrored LIT GEOMETRY (a car's sky-grey windows and underbody seen
        // from below) is black water, carried by the coverage cut in the
        // sheen - it printed as a flat grey plate, brush-hatched, under the cars
        float rsL = dot( rSharp, vec3( 0.2126, 0.7152, 0.0722 ) );
        rSharp *= smoothstep( 0.055, 0.13, rsL );
        // column: the bright-passed, long-streaked emitters (Pipeline §2)
        vec3 column = texture2D( tReflBlur, ruv + dis ).rgb * uReflStrength;
        float colL = dot( column, vec3( 0.2126, 0.7152, 0.0722 ) );
        // graphic toe: the faint skirt of a column goes (it printed as a
        // mid-grey plate between the columns), the column body stays
        column *= smoothstep( 0.004, 0.03, colL );
        // sheen: the storm sky, only as a faint fresnel wet-grey between the
        // columns; in a puddle whatever is mirrored (a car, a column) is
        // black against it
        float NoV = saturate( dot( N, V ) );
        float fres = 0.02 + 0.98 * pow( 1.0 - NoV, 5.0 );
        vec3 sheen = uFogColor * fres * 0.15 * mix( 0.35, 1.0, puddle );
        sheen *= 1.0 - coverage * puddle;
        // dashes: dense inside a column, sparse elsewhere. Four world-
        // anchored octaves of irregular pitch (0.16, 0.42, 1.1, 3.0 m rows),
        // each taking over as the finer one falls under 2 px a row.
        // Outside the columns the coverage gathers in PATCHES (low-frequency
        // world noise, 2-4 m, about half the road): isolated slivers there,
        // bare dark asphalt between (~10-12 % on average)
        float patchN = texture2D( tNoise, p * vec2( 0.055, 0.075 ) + 9.3 ).r * 0.7
                     + texture2D( tNoise, p * 0.21 + 2.2 ).g * 0.3;
        float patchM = smoothstep( 0.42, 0.6, patchN + puddle * 0.08 );
        float covOut = 0.11 * mix( 0.05, 1.7, patchM ) * ( 1.0 - 0.7 * uPaving );
        // the near field is carried by ink blots and a few specks, not chop
        covOut *= mix( 0.6, 1.0, smoothstep( 3.0, 8.0, dist ) );
        // inside a column the coverage rises to ~70 % at its core (a white
        // column cut by thin dark ripples, before the vertical smear breaks
        // it: ~60 % net) and falls off across its flanks; within ~6 m the
        // core thins so the column's foot is carried by its dashes
        float nearCol = smoothstep( 1.5, 7.0, dist );
        float covIn = 0.8 * mix( 0.82, 1.1, patchM ) * mix( 0.7, 1.0, nearCol );
        float colMask = smoothstep( 0.006, 0.075, colL );
        float cov = mix( covOut, covIn, colMask );
        float f1, f2, f3, f4;
        float d1 = rippleDashes( p, 0.16, 0.45, cov, 0.0, f1 );
        float d2 = rippleDashes( p, 0.42, 1.0, cov, 3.7, f2 );
        float d3 = rippleDashes( p, 1.1, 2.6, cov, 7.3, f3 );
        float d4 = rippleDashes( p, 3.0, 7.0, cov, 11.1, f4 );
        float dash = mix( cov, d4, f4 );
        dash = mix( dash, d3, f3 );
        dash = mix( dash, d2, f2 );
        // (the finest octave only inside a column: on the open road it laid
        // a fine ruled texture of hairline slivers; there the dashes are the
        // coarser, isolated ones)
        dash = mix( dash, d1, f1 * smoothstep( 0.2, 0.7, colMask ) );
        // inside a column the dashes are also cut by a VERTICAL smear (the
        // near-vertical dry-brush family, laid in the reflection's own frame
        // so it runs down the column): the rungs break into ragged vertical
        // slivers like the reference's streaks
        float vbr = texture2D( tBrush, ( ruv + dis ) * vec2( 1.9, 0.8 ) + vec2( 0.37, 0.11 ) ).g;
        dash *= mix( 1.0, smoothstep( 0.06, 0.24, vbr ), smoothstep( 0.02, 0.08, colL ) * 0.9 );
        // inside the near wash band the water is carried by the wash and its
        // blots, not by a ruled field of slivers: ~30 % of the dashes stay
        // (outside the columns; a column's foot keeps its ripples)
        float nearBand = ( 1.0 - smoothstep( 7.0, 11.0, dist ) ) * ( 1.0 - uPaving );
        dash *= mix( 1.0, 0.3, nearBand * ( 1.0 - colMask ) );
        // A column stays a column; the dashes print it. The ink tone curve is
        // LOGARITHMIC (tone.js), so a linear floor of 0.55 is only -0.9 stop:
        // the dash gaps printed ~0.1 lighter than the dashes, or white where
        // the core clipped (a smooth bar). The reference's columns are WHITE
        // ripple slivers with dark gaps, dense at the core and thinning out
        // across the flanks and down the frame. So the column's brightness
        // saturates early (any real column light prints its dashes near
        // white) and its strength is carried by the dash COVERAGE instead
        // (cov above: ~80 % at the core, sparse slivers in the flanks); the
        // gaps keep ~4 %: dark grey inside a core, black in the flanks.
        float colB = 0.45 * ( 1.0 - exp( - colL / 0.045 ) );
        // aerial perspective on the columns: every far emitter's streak
        // converges on the road under the vanishing point, where they summed
        // (with the direct lamp pools) into a lit white plate. Beyond ~25 m a
        // column thins toward the grey of the fog, so the far road stays a
        // mid grey with the columns still separate, like the reference.
        colB *= mix( 1.0, 0.22, smoothstep( 24.0, 62.0, dist ) );
        // ... and at the very front the column is no solid core: its foot is
        // carried by the dashes (the reference's bottom edge is ink blots
        // over a grey wash, the columns already broken up)
        colB *= mix( 0.65, 1.0, nearCol );
        vec3 colC = column * ( colB / max( colL, 1e-5 ) );
        // Blood in the column (Phase 3a review): the brightness normalisation
        // above lifts a red streak to the same value as a lamp's, and the ink
        // keeps any red over ~0.1 saturation, so a burst in the air printed
        // a solid red block in the water. The blood family (red dominant,
        // green ~ blue, as ink.js reads it) keeps ~35 % of the column, only
        // on sparse ripple flecks with black water between: a few red slivers
        // under the burst, like the reference's faint red in the wet street.
        // Fire (green well above blue) keeps its full warm column.
        float cMx = max( column.r, max( column.g, column.b ) );
        vec3 cHn = column / max( cMx, 1e-5 );
        float cSat = 1.0 - min( cHn.r, min( cHn.g, cHn.b ) );
        float bloodC = step( column.g, column.r ) * step( column.b, column.r )
                     * ( 1.0 - smoothstep( 0.02, 0.07, cHn.g - cHn.b ) ) * smoothstep( 0.15, 0.4, cSat );
        vec3 colBlood = colC * bloodC;
        colC -= colBlood;
        float fleck = smoothstep( 0.56, 0.64, texture2D( tNoise, p * vec2( 0.45, 1.6 ) + 5.1 ).r )
                    * smoothstep( 0.3, 0.6, dash );
        vec3 refl = colC * mix( 0.04, 1.0, dash ) + colBlood * 0.35 * fleck
                  + sheen * ( 0.4 + 1.2 * dash )       // the dark-grey wet look
                  // sparse pale dashes on dark asphalt: ripple facets that
                  // catch the grey storm sky. (sheen * 1.2 * dash alone is
                  // ~0.005 near the camera, where the fresnel is low: under
                  // the ink's black point, so the near road had no dashes)
                  + uFogColor * ( 0.1 + 0.3 * fres ) * dash * ( 1.0 - smoothstep( 0.004, 0.05, colL ) )
                    * ( 1.0 - coverage * puddle )
                  + rSharp * puddle * 0.5;             // puddles: a sharp mirror
        // near-field rain rings: thin light arcs where their crest catches the sky
        refl += uFogColor * crest * 0.7 * ( 0.5 + 0.5 * puddle );
        // the blast's shockwave: its crest catches the fireball and the storm
        // sky as a WHITE ripple line racing out across the wet street
        refl += vec3( 0.55 ) * blastCrest * mix( 1.0, 0.35, uPaving );
        // near field (< ~9 m): a patchy grey wash (the rain-beaten water
        // catching the storm sky) with sparse pale specks, so the black ink
        // blots below have grey to sit on, like the reference's bottom edge
        float nearW = ( 1.0 - smoothstep( 4.0, 11.0, dist ) ) * ( 1.0 - uPaving );
        // (Phase 1c: patches from the thresholded fbm, ~1.5:1 with ragged
        // rims; the horizontal-brush strokes printed 6:1 hard-edged streaks)
        float wash = nearMask( p, 4.4, 0.56 ) * nearW;
        float speck = smoothstep( 0.7, 0.74, texture2D( tNoise, p * vec2( 0.9, 1.3 ) + 6.1 ).a ) * nearW;
        refl += uFogColor * ( 0.22 * wash + 0.45 * speck ) * ( 1.0 - coverage * puddle );
        // the bottom edge (< ~5 m, the bottom ~20 % of the street view): the
        // reference's rain-beaten water is a GREY wash (~0.35 display) over
        // about half of it, and the black ink splatter reads as holes cut
        // into that grey; over black water the blots were invisible (black
        // on black) and the near field printed as dark chop. Patches of 0.4-1.5 m,
        // stretched along x, their rims dragged out by the
        // horizontal dry brush; blots are cut below (refl *= 1 - blobs).
        float nearE = ( 1.0 - smoothstep( 4.4, 7.0, dist ) ) * ( 1.0 - uPaving );
        if ( nearE > 0.0 ) {
          float washE = nearMask( p, 2.7, 0.515 ) * nearE;
          // (under a column too: its dash gaps print grey, not black, so a
          // column's foot is white ripple slivers on grey water)
          refl += uFogColor * 0.4 * washE * ( 1.0 - coverage * puddle );
        }
        // ink blots are matte: nothing reflects in them
        refl *= ( 1.0 - 0.95 * blobs ) * ( 1.0 - 0.25 * joint );

        // ---- direct light ---------------------------------------------------
        vec3 direct = vec3( 0.0 );
        float ks = mix( 0.2, 1.0, puddle );
        #if NUM_SPOT_LIGHTS > 0
          IncidentLight il;
          #pragma unroll_loop_start
          for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
            getSpotLightInfo( spotLights[ i ], vViewPos, il );
            #if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
              il.color *= getShadow( spotShadowMap[ i ], spotLightShadows[ i ].shadowMapSize, spotLightShadows[ i ].shadowIntensity, spotLightShadows[ i ].shadowBias, spotLightShadows[ i ].shadowRadius, vSpotLightCoord[ i ] );
            #endif
            direct += wetBRDF( il.color, il.direction, N, V, rough, albedo, ks );
          }
          #pragma unroll_loop_end
        #endif
        #if NUM_POINT_LIGHTS > 0
          IncidentLight pl;
          for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
            getPointLightInfo( pointLights[ i ], vViewPos, pl );
            direct += wetBRDF( pl.color, pl.direction, N, V, rough, albedo, ks );
          }
        #endif
        vec3 ambient = vec3( 0.0 );
        #if NUM_HEMI_LIGHTS > 0
          for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) ambient += getHemisphereLightIrradiance( hemisphereLights[ i ], N );
        #endif
        ambient += ambientLightColor;

        // the road's lamp pool stays a DARK grey wash (display ~0.1): at full
        // strength it printed in the 0.35 ink band as a mid-grey plate
        // between the columns; the light on a wet road lives in the column
        direct *= mix( 0.5, 1.0, max( uPaving, puddle * 0.5 ) );
        // ... and the far road is not lit from above as well as by its
        // columns: beyond ~30 m the pools are halved
        direct *= mix( 1.0, 0.5, smoothstep( 24.0, 36.0, dist ) );
        vec3 col = ambient * albedo * RECIPROCAL_PI + direct + refl;
        if ( uGroundDebug == 1 ) col = ambient * albedo * RECIPROCAL_PI;
        else if ( uGroundDebug == 2 ) col = direct;
        else if ( uGroundDebug == 3 ) col = column;
        else if ( uGroundDebug == 4 ) col = sheen * ( 0.4 + 1.2 * dash );
        else if ( uGroundDebug == 5 ) col = vec3( dash * 0.3 );
        else if ( uGroundDebug == 6 ) col = rSharp * puddle * 0.5;
        else if ( uGroundDebug == 7 ) col = vec3( blobs * 0.3 );
        else if ( uGroundDebug == 9 ) col = vec3( bigBlobs * 0.3, inkBlobs( p ) * 0.3, nearSplat * 0.3 );
        else if ( uGroundDebug == 8 ) col = vec3( ( wash + speck ) * 0.1 );
        vec4 nf = noirFog( dist, vWorld.y, uFogDensity, uFogColor );
        col = mix( col, nf.rgb, nf.a );
        gl_FragColor = vec4( col, 1.0 );
      }`,
  });
  return mat;
}

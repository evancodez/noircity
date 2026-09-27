import * as THREE from 'three';
import { FULLSCREEN_VERT, HASH_GLSL, LUMA_GLSL } from './common.js';
import { NOIR_FOG_GLSL } from '../fog.js';
import { TONE_GLSL, toneUniforms, EXPOSURE } from '../tone.js';
import { RAIN_SLANT } from '../textures.js';
import { FIG_ANCHOR, HOOD_ID0, HOOD_SLOTS } from '../layers.js';

// The ink pass: turns the linear HDR render into a hand-inked noir panel.
// Order inside the shader (see DESIGN.md §3.4):
//   bloom add -> tone curve -> dry-brush band quantisation -> colour keep
//   -> contours (depth/normal/id, wobbling, fog-faded) -> lamp rim -> rain
//   overlay -> paper, grain, vignette. Output is display-referred (sRGB-ish),
//   written straight to the canvas.
export function makeInkMaterial(tex, fogUniforms) {
  return new THREE.ShaderMaterial({
    name: 'NoirInk',
    depthTest: false,
    depthWrite: false,
    uniforms: {
      tScene: { value: null },
      tBloom: { value: null },
      tVolume: { value: null },
      tRainBuf: { value: null },
      tNormalId: { value: null },
      tDepth: { value: null },
      tBrush: { value: tex.brush },
      tPaper: { value: tex.paper },
      tRain: { value: tex.rain },
      tNoise: { value: tex.noise },
      uRes: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uBoil: { value: 0 },
      uNear: { value: 0.1 },
      uFar: { value: 1500 },
      uProjInv: { value: new THREE.Matrix4() },
      uViewInv: { value: new THREE.Matrix4() },
      uExposure: { value: EXPOSURE },
      ...toneUniforms(),
      uBloomStrength: { value: 0.3 },
      uBrush: { value: 0.85 },
      uLineWidth: { value: 1.0 },
      uLightning: { value: 0 },
      uBrushPan: { value: new THREE.Vector2() },
      uRimLamps: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] },
      uRain: { value: 1.0 },
      uRain3: { value: 1.0 },
      uView: { value: 0 },
      // per-Hood brush anchor (root xyz, yaw), indexed by id - HOOD_ID0
      uFigAnchor: { value: FIG_ANCHOR },
      ...fogUniforms,
    },
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: /* glsl */`
      uniform sampler2D tScene, tBloom, tVolume, tRainBuf, tNormalId, tDepth, tBrush, tPaper, tRain, tNoise;
      uniform vec2 uRes;
      uniform float uTime, uBoil, uNear, uFar;
      uniform mat4 uProjInv, uViewInv;
      uniform float uExposure, uBloomStrength, uBrush, uLineWidth, uLightning, uRain, uRain3;
      uniform vec4 uRimLamps[ 4 ];
      uniform vec4 uFigAnchor[ ${HOOD_SLOTS} ];
      uniform int uView;
      varying vec2 vUv;

      ${HASH_GLSL}
      ${LUMA_GLSL}
      ${NOIR_FOG_GLSL}

      float linZ( float d ) {
        float ndc = d * 2.0 - 1.0;
        return ( 2.0 * uNear * uFar ) / ( uFar + uNear - ndc * ( uFar - uNear ) );
      }
      // 1/z: affine in screen space across any plane, so its second difference
      // is ~0 on flat or gently curved surfaces and spikes only at silhouettes.
      float wAt( vec2 uv ) {
        float d = texture2D( tDepth, uv ).r;
        return d >= 0.999999 ? 0.0 : 1.0 / linZ( d );
      }
      vec3 viewPos( vec2 uv, float d ) {
        vec4 c = vec4( uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0 );
        vec4 v = uProjInv * c;
        return v.xyz / v.w;
      }

      // Log-space film curve with an S (render/tone.js): solid ink below
      // TONE.black, bare paper above TONE.white, ~7 stops between.
      ${TONE_GLSL}

      // Dry-brush band quantisation: each tonal band is laid down as a FLAT
      // wash over most of its range; only across the transition to the next
      // band does the brush field decide which pixels step up, so gradients
      // become a few flat tones joined by overlapping dry-brush strokes (ink
      // wash), rather than a surface uniformly covered in scribbles.
      // N bands: 4 everywhere, the wet street included: its dark-grey wet
      // asphalt must survive between the black gaps and the white dashes
      // (with 2 bands it snapped to black or white: a white lake with holes)
      float inkBands( float v, float b, float N ) {
        float t = v * N;
        float base = floor( t );
        float f = clamp( ( t - base - 0.5 ) * 2.2 + 0.5, 0.0, 1.0 );
        float s = smoothstep( b - 0.09, b + 0.09, f );
        return ( base + s ) / N;
      }

      // World-anchored dry-brush field. The brush texture is projected onto
      // the surfaces themselves (triplanar, world space) so the strokes stay
      // on the wall and on the road while the player walks; sampled in
      // screen space they slid over the world like a pattern on the lens.
      // Two octaves are chosen by distance so a tile always spans about
      // pxPerTile pixels on screen, cross-faded with the contrast restored,
      // so the field's threshold statistics do not change with distance.
      vec3 brushWorld( vec3 wp, vec3 nrm, float dist, float pxPerTile, float shift ) {
        float f = uRes.y * 0.5 / max( uProjInv[ 1 ][ 1 ], 1e-4 );   // focal length in px
        float lg = log2( max( pxPerTile * dist / f, 1e-3 ) );
        float k0 = floor( lg );
        float t = lg - k0;
        float W0 = exp2( k0 ), W1 = W0 * 2.0;
        vec3 w = pow( abs( nrm ) + 1e-3, vec3( 4.0 ) );
        w /= ( w.x + w.y + w.z );
        vec2 o = vec2( shift, shift * 0.63 );
        vec3 s0 = w.x * texture2D( tBrush, wp.zy / W0 + o ).rgb
                + w.y * texture2D( tBrush, wp.xz / W0 + o ).rgb
                + w.z * texture2D( tBrush, wp.xy / W0 + o ).rgb;
        vec3 s1 = w.x * texture2D( tBrush, wp.zy / W1 + o + 0.37 ).rgb
                + w.y * texture2D( tBrush, wp.xz / W1 + o + 0.37 ).rgb
                + w.z * texture2D( tBrush, wp.xy / W1 + o + 0.37 ).rgb;
        vec3 s = mix( s0, s1, t );
        // restore the contrast lost by averaging two independent fields
        float k = inversesqrt( 1.0 - 2.0 * t * ( 1.0 - t ) );
        return clamp( ( s - 0.5 ) * k + 0.5, 0.0, 1.0 );
      }

      // 1 for a Hood's id (figures are written negative, see layers.js)
      float isHood( float w ) {
        float f = -w - ${HOOD_ID0.toFixed(1)};
        return step( -0.5, f ) * step( f, ${(HOOD_SLOTS - 0.5).toFixed(1)} );
      }

      void main() {
        vec2 uv = vUv;
        vec2 fc = gl_FragCoord.xy;

        vec4 nid = texture2D( tNormalId, uv );
        float d = texture2D( tDepth, uv ).r;
        bool sky = d >= 0.999999;
        vec3 vpos = viewPos( uv, d );
        float dist = sky ? uFar : length( vpos );
        vec3 wpos = ( uViewInv * vec4( vpos, 1.0 ) ).xyz;
        float fogA = sky ? 1.0 : noirFogAmount( dist, wpos.y, uFogDensity );
        float nearF = 1.0 - fogA;

        vec3 hdr = texture2D( tScene, uv ).rgb;
        vec3 bloom = texture2D( tBloom, uv ).rgb * uBloomStrength;
        // volume (half res, feathered): r = cone light, g = the share of it
        // touching the surface. Rain & splash rings live in their own
        // full-res buffer (b) so the hairlines stay one pixel sharp.
        vec4 volT = texture2D( tVolume, uv );
        vec3 vol = volT.rrr;
        float rain3 = texture2D( tRainBuf, uv ).b;
        float volNear = volT.g / max( volT.r, 1e-5 );
        // soft knee on the accumulated air light: one near cone passes almost
        // untouched, but a stack of far cones + mist can never add up to a
        // featureless white wall (it saturates around ~0.7 display)
        float volL = luma( vol );
        float volC = volL < 0.24 ? volL : 0.24 + ( volL - 0.24 ) / ( 1.0 + ( volL - 0.24 ) / 0.16 );
        vol *= volC / max( volL, 1e-5 );
        // figures (negative id: cars, Hoods) are inked as solid silhouettes in
        // front of the light: the air light is painted around them, not over
        // (the tone curve is steep in the darks: even a quarter of a cone's
        // glow prints a black car as mid grey, so nearly all of it goes; a
        // cone that actually falls onto the figure keeps a little more)
        // ids >= 1900 are the el's ironwork (columns, arches, girders): inked
        // like figures - black even directly under a lamp, only the air glows
        float iron = step( 1899.5, abs( nid.w ) );
        float isFig = max( step( nid.w, -0.5 ), iron );
        // ids SKYLINE_ID0..1899 (render/layers.js): the far towers and their
        // window flecks. Flat fogged silhouettes: no strokes, no lift-outs,
        // no contours or rims (DESIGN.md: 'no line work' on the skyline)
        float skyl = sky ? 0.0 : step( 1859.5, abs( nid.w ) ) * ( 1.0 - iron );
        float figure = isFig * ( 1.0 - smoothstep( 45.0, 110.0, dist ) );
        // (the el's iron is a backdrop, not a figure: the cones hanging in
        // front of it must survive, so only the light that actually lies on
        // the steel is taken off, not the fan in the air before it)
        // columns (below the arch springing) are inked like figures: the
        // glow goes around them, never over them, even directly under a lamp
        float vn = clamp( volNear, 0.0, 1.0 );
        float ironRm = wpos.y < 5.0 ? mix( 0.9, 0.97, vn ) : mix( 0.42, 0.94, vn );
        float figRm = mix( mix( 0.97, 0.93, vn ), ironRm, iron );
        vol *= 1.0 - figure * figRm;
        // (a lamp hung under the el keeps its halo over the girders and
        // arches around it; figures and columns stay clean silhouettes)
        bloom *= 1.0 - 0.85 * figure * ( 1.0 - iron * step( 5.0, wpos.y ) * 0.8 );
        // A Hood is inked as a man, not as a window onto the mist: the few
        // percent of air light left on generic figures still printed a far
        // walker in the lit mist as mid grey (the tone curve is steep in the
        // darks), so on Hood pixels the air light is taken off almost fully.
        float hoodF = isFig * isHood( nid.w ) * ( 1.0 - smoothstep( 60.0, 110.0, dist ) );
        vol *= 1.0 - 0.9 * hoodF;
        bloom *= 1.0 - 0.85 * hoodF;
        float L = luma( hdr );
        float exposure = uExposure * ( 1.0 + 2.5 * uLightning );
        // v: the inked surface tone (gets brush bands + lines);
        // light that floats in the air (bloom halo, cones, rain) is laid over
        // afterwards as a smooth wash, like white gouache over the ink.
        float v = toneCurve( L * exposure );
        float vRaw = v;
        // ironwork never rises above dark grey where it is lit (a SpotLight
        // at 4 m blows a black column out to pale line art); the fog may
        // still lift it toward the paper grey with distance
        // (0.08: inside the first ink band, so the brush quantiser keeps it
        // black with only the odd dry-brush mark; at 0.16 most pixels were
        // promoted to the 0.25 band and the columns printed mid grey)
        // Aerial perspective on the el (Phase 1b): the scene fog barely
        // touches 20-60 m, so every span printed the same dead black slab.
        // Beyond the nearest span the iron lifts toward dark grey (~0.28 by
        // 45 m), so the el recedes in steps like the reference; the two
        // nearest columns (< ~20 m) stay pure black.
        float ironAir = 0.28 * smoothstep( 22.0, 48.0, dist );
        v = mix( v, max( min( v, mix( 0.08, 0.62, fogA ) ), ironAir ), iron );
        float vSmooth = v;
        float vLit = toneCurve( ( L + luma( bloom ) + luma( vol ) ) * exposure );
        // (measured against the UNclamped surface: the clamp must not come
        // back as 'air light')
        float glow = max( vLit - vRaw, 0.0 );

        // ---- brush quantisation ------------------------------------------
        float idc = nid.w;
        vec3 n = nid.xyz;
        vec3 nW = mat3( uViewInv ) * n;
        // the sky has no surface: project along the view ray so its wash
        // turns with the head but never slides with the walk
        vec3 camW = uViewInv[ 3 ].xyz;
        vec3 nB = sky ? normalize( wpos - camW ) : nW;
        // Moving figures (the Hoods) carry their own brush field: the pixel's
        // world position is taken into the Hood's root frame (anchor xyz +
        // yaw from uFigAnchor), plus a per-slot offset so no two men wear the
        // same strokes. The field is still world-scaled and surface-anchored
        // (never screen space), it just rides with the body as it walks and
        // turns. Everything else (cars included) keeps anchor 0.
        float fidH = -idc - ${HOOD_ID0.toFixed(1)};
        float hood = sky ? 0.0 : isHood( idc );
        vec3 bpos = wpos;
        vec3 nBr = nB;
        if ( hood > 0.5 ) {
          int slot = int( fidH + 0.5 );
          vec4 A = uFigAnchor[ slot ];
          vec3 q = wpos - A.xyz;
          float ca = cos( A.w ), sa = sin( A.w );
          bpos = vec3( ca * q.x - sa * q.z, q.y, sa * q.x + ca * q.z ) + vec3( float( slot ) * 7.31, float( slot ) * 1.9, float( slot ) * 3.77 );
          nBr = vec3( ca * nB.x - sa * nB.z, nB.y, sa * nB.x + ca * nB.z );
        }
        vec3 br = brushWorld( bpos, nBr, dist, 820.0, 0.0 );
        // A Hood stays a dark mass: a soft knee holds a lamp-lit coat below
        // ~0.34 (dry-brush greys on the folds, never a pale plate), and past
        // ~12 m he prints as a clean black silhouette: only the rim and the
        // contour survive, like the reference's mid-ground men
        // Cloth that faces the sky (a fallen man's coat and shirt, the tops of
        // the shoulders) sits right under the lamp and would print as a flat
        // 0.25 plate: its ceiling drops to ~0.12 and the brush breaks it, so
        // it reads as dry-brush grey on black. The ceiling acts on the final
        // surface tone, so the pale shirt (vertex colour) is held with the coat.
        if ( hood > 0.5 ) {
          float upF = smoothstep( 0.3, 0.7, nW.y );
          // (the band quantiser promotes most of a flat 0.14 surface to the
          // 0.25 band, so the ceiling is scaled by the brush: only where its
          // strokes are strong does the cloth step up to grey)
          float ceilV = mix( 0.34, 0.13, upF );
          v = ceilV * ( 1.0 - exp( -v / ceilV ) );
          v *= mix( 1.0, mix( 0.2, 1.4, br.r ), upF );
          v *= 1.0 - 0.88 * smoothstep( 9.0, 20.0, dist );
        }
        // the wet street & pavements: flat, facing up, at kerb height or below
        float ground = sky ? 0.0 : step( 0.9, nW.y ) * step( wpos.y, 0.25 );
        // stroke family follows surface orientation: walls get vertical
        // strokes, the street & undersides horizontal, everything else diagonal
        float wV = smoothstep( 0.6, 0.92, abs( n.x ) ) * ( 1.0 - smoothstep( 0.45, 0.75, abs( n.y ) ) );
        float wH = smoothstep( 0.6, 0.92, abs( n.y ) );
        float wD = clamp( 1.0 - wV - wH, 0.0, 1.0 );
        float b = ( br.r * wD + br.g * wV + br.b * wH ) / max( wD + wV + wH, 1e-3 );
        // Walls (the façade, the far blocks): the dry-brush strokes covered
        // every pilaster and panel at one density (fur / scratches). Like the
        // reference's big wet stone blocks, strokes now GATHER on some areas
        // (a world-anchored low-frequency mask, 3-5 m, ~40 % of the wall,
        // its rim broken by the brush) and the rest stays a flat dark-grey
        // wash; where they gather they are longer and fewer (a coarser
        // octave of the vertical family).
        float wall = sky ? 0.0 : wV * ( 1.0 - iron ) * ( 1.0 - isFig ) * ( 1.0 - ground );
        float gather = 1.0;
        if ( wall > 0.01 ) {
          vec2 wq = abs( nW.x ) > abs( nW.z ) ? wpos.zy : wpos.xy;
          float gN = texture2D( tNoise, wq * vec2( 0.05, 0.065 ) + vec2( 3.3, 1.1 ) ).g * 0.75
                   + texture2D( tNoise, wq * 0.19 + 1.9 ).r * 0.25;
          gather = smoothstep( 0.5, 0.56, gN + ( br.g - 0.5 ) * 0.14 );
          float bLong = brushWorld( wpos, nB, dist, 1900.0, 0.23 ).g;
          b = mix( b, bLong, wall );
        }
        float wallQuiet = wall * ( 1.0 - gather );
        // the skyline takes a neutral field: whatever the brush does below
        // (bands, paper lift-out edges) leaves its flat tone untouched
        b = mix( b, 0.5, skyl );
        // Broken black: the reference's blacks (coat, wall, road) are not flat
        // fill, they carry sparse white dry-brush lift-outs, heaviest on the
        // side that faces the light. Only the brightest strokes of the field
        // survive, so they read as individual strokes, not noise.
        // A FEW BOLD marks, not a scratched surface: the lift field is the
        // brush texture magnified ~2.7x (strokes 100-450 px long), gated so
        // only ~5% of it survives. Vertical faces (girders, walls) take the
        // near-horizontal family so marks run along the spans, not down
        // them like bark.
        if ( !sky && skyl < 0.5 && v < 0.10 ) {
          vec3 Lr = uRimLamps[ 0 ].xyz - vpos;
          float facing = uRimLamps[ 0 ].w > 0.0 ? max( dot( n, normalize( Lr ) ), 0.0 ) : 0.3;
          vec3 brL = brushWorld( bpos, nBr, dist, 2200.0, 0.41 );
          // iron: girders & arches (above the springing) take the
          // near-horizontal family so marks run along the spans; columns the
          // vertical one (a horizontal mark on a column reads as a ring).
          // Walls and everything else: the diagonal family, sparser.
          float bIron = wpos.y > 5.0 ? brL.b : brL.g;
          float bl = mix( brL.r, bIron, iron );
          float lift = smoothstep( mix( 0.955, 0.925, iron ), mix( 0.98, 0.962, iron ), bl ) * nearF * mix( 0.28, 0.4, iron )
                     * ( 0.2 + 0.8 * smoothstep( 0.1, 0.7, facing ) )
                     // the magnified field is soft: break each bold mark into
                     // dry-brush fragments with the fine field, so no mark
                     // prints as a solid plank
                     * smoothstep( 0.3, 0.62, br.r * 0.4 + br.b * 0.6 )
                     * ( 1.0 - smoothstep( 18.0, 45.0, dist ) ) * ( 1.0 - 0.5 * step( nid.w, -0.5 ) ) * ( 1.0 - ground )
                     * ( 1.0 - hood * smoothstep( 8.0, 16.0, dist ) );
          v += lift * ( 1.0 - smoothstep( 0.06, 0.10, v ) ) * ( 1.0 - wallQuiet );
        }
        // strokes reach down into the blacks (dry-brush on near-black
        // surfaces) and survive inside lit mist; only real glare stays smooth
        float brushAmt = sky ? 0.0 : uBrush * nearF * nearF * smoothstep( 0.03, 0.15, v )
                       * ( 1.0 - smoothstep( 25.0, 60.0, dist ) ) * ( 1.0 - smoothstep( 0.15, 0.5, glow ) );
        // (the street's 4 bands are cut in a gamma-warped space, levels
        // 0 / 0.125 / 0.35 / 0.65 / 1: the first step above ink is a DARK
        // wet grey, so the asphalt reads dark between the white columns
        // instead of being promoted to a 0.25 mid-grey plate)
        float vBand = mix( inkBands( v, b, 4.0 ), pow( inkBands( pow( v, 0.6667 ), b, 4.0 ), 1.5 ), ground );
        // the quiet wall areas keep the flat wash (the lit surface tone)
        brushAmt *= ( 1.0 - 0.9 * wallQuiet ) * ( 1.0 - skyl );
        v = mix( v, vBand, brushAmt );
        // the sky gets only a whisper of horizontal wash; fogged towers a
        // little vertical dry-brush (the far street keeps horizontal)
        v += sky ? ( br.b - 0.5 ) * 0.012 : ( mix( br.g, br.b, wH ) - 0.5 ) * 0.03 * fogA * ( 1.0 - skyl );

        // ---- colour keep (blood & fire only carry chroma) -------------------
        float mx = max( hdr.r, max( hdr.g, hdr.b ) );
        float mn = min( hdr.r, min( hdr.g, hdr.b ) );
        float sat = ( mx - mn ) / max( mx, 1e-5 );
        float keep = smoothstep( 0.22, 0.4, sat ) * smoothstep( 0.0004, 0.004, mx );
        vec3 hue = hdr / max( mx, 1e-5 );
        vec3 colOut = hue * clamp( vLit * 1.25 + 0.12, 0.0, 1.0 );

        // ---- contours ------------------------------------------------------
        // Wobble: a static low-frequency warp plus a small 'boil' that jumps
        // 8x per second, like inked animation on twos.
        // (the slow warp is anchored to the surface so lines do not swim
        // against the world as the player walks; the boil is time-only)
        vec2 wob = ( texture2D( tNoise, ( bpos.xy + bpos.zx * 0.7 ) / ( 0.6 + dist * 0.09 ) ).rg - 0.5 ) * 1.8
                 + ( texture2D( tNoise, uv * vec2( 5.3, 3.7 ) + uBoil * 0.37 ).ba - 0.5 ) * 1.2;
        vec2 uvL = uv + wob / uRes;
        float wc = sky ? 0.0 : 1.0 / linZ( d );
        float zc = sky ? uFar : linZ( d );
        // width varies along the line and grows for near objects
        float wN = texture2D( tNoise, uv * vec2( 7.0, 5.0 ) + 0.3 ).a;
        float rpx = uLineWidth * mix( 0.7, 1.9, wN ) * clamp( 7.0 / zc + 0.6, 0.65, 1.7 );
        vec4 cN = texture2D( tNormalId, uvL );
        float wcl = wAt( uvL );
        float edge = 0.0;
        float edgeN = 0.0;   // crease lines only (no silhouettes): structure inside black masses
        float edgeId = 0.0;
        float silFront = 0.0;
        float halo = 0.0;    // we are just behind a Hood's silhouette
        vec2 haloUV = uv;    // ... at this neighbouring Hood pixel,
        vec3 haloN = vec3( 0.0, 0.0, 1.0 );   // whose normal is this
        const vec2 dirs[ 4 ] = vec2[ 4 ]( vec2( 1.0, 0.0 ), vec2( 0.0, 1.0 ), vec2( 0.7071, 0.7071 ), vec2( 0.7071, -0.7071 ) );
        for ( int i = 0; i < 4; i ++ ) {
          vec2 o = dirs[ i ] * rpx / uRes;
          float w1 = wAt( uvL + o ), w2 = wAt( uvL - o );
          float lap = abs( w1 + w2 - 2.0 * wcl ) / max( max( wcl, max( w1, w2 ) ), 1e-6 );
          edge = max( edge, smoothstep( 0.025, 0.07, lap ) );
          vec4 n1 = texture2D( tNormalId, uvL + o ), n2 = texture2D( tNormalId, uvL - o );
          float nd = max( 1.0 - dot( cN.xyz, n1.xyz ) * step( 0.5, abs( n1.w ) ), 1.0 - dot( cN.xyz, n2.xyz ) * step( 0.5, abs( n2.w ) ) );
          float en = smoothstep( 0.3, 0.6, nd ) * step( 0.5, abs( cN.w ) );
          edge = max( edge, en );
          edgeN = max( edgeN, en );
          float idd = max( abs( n1.w - cN.w ), abs( n2.w - cN.w ) );
          edgeId = max( edgeId, step( 0.5, idd ) );
          float h1 = isHood( n1.w ) * step( 0.5, abs( n1.w - cN.w ) ) * step( wcl * 1.15 + 1e-6, w1 );
          float h2 = isHood( n2.w ) * step( 0.5, abs( n2.w - cN.w ) ) * step( wcl * 1.15 + 1e-6, w2 );
          if ( halo < 0.5 && h1 > 0.5 ) { haloUV = uvL + o; haloN = n1.xyz; }
          else if ( halo < 0.5 && h2 > 0.5 ) { haloUV = uvL - o; haloN = n2.xyz; }
          halo = max( halo, max( h1, h2 ) );
          // wider probe for the lit rim: are we the front side of a silhouette?
          vec2 o2 = o * 1.7;
          float wf = min( wAt( uv + o2 ), wAt( uv - o2 ) );
          silFront = max( silFront, step( 1.25, wc / max( wf, 1e-7 ) ) );
        }
        // lines break up a little like a dry brush, and dissolve into the fog
        float lineBreak = mix( 1.0, smoothstep( 0.08, 0.3, br.g * 0.6 + br.r * 0.4 ), 0.35 + 0.5 * fogA );
        edge *= lineBreak * pow( nearF, 1.6 ) * ( 1.0 - smoothstep( 45.0, 140.0, zc ) );
        // object-id silhouettes (a car against the mist) hold their line out
        // to the mid-ground regardless of fog, then fade with distance
        edgeId *= mix( 1.0, lineBreak, 0.5 ) * ( 1.0 - smoothstep( 60.0, 140.0, zc ) ) * ( sky ? 0.0 : 1.0 );
        // material edges on the architecture (kerbs, pavement, far blocks)
        // melt into the fog like any other line; only figures hold theirs
        edgeId *= mix( 1.0 - smoothstep( 0.03, 0.3, fogA ), 1.0, isFig );
        // lifted (far) iron is a soft grey silhouette, not outlined line art
        float ironSoft = iron * smoothstep( 25.0, 50.0, dist );
        edgeId *= 1.0 - ironSoft * 0.85;
        edge *= 1.0 - ironSoft * 0.75;
        edge = max( edge, edgeId );
        edge *= 1.0 - skyl;
        // only a dense glow in front of a line washes it out
        edge *= 1.0 - smoothstep( 0.35, 0.8, glow );
        // light sources are never outlined: ink stops where the glare begins
        float glare = ( L + luma( bloom ) ) * exposure;
        edge *= 1.0 - smoothstep( 0.6, 2.0, glare );

        // ---- lit rim: a thin white line inside silhouettes facing a lamp ----
        float rim = 0.0;
        if ( !sky && silFront > 0.5 ) {
          float rimBestW = 0.0, rimBest = 0.0;
          for ( int i = 0; i < 4; i ++ ) {
            vec3 Lv = uRimLamps[ i ].xyz - vpos;
            float dl = length( Lv );
            // only the part of the silhouette that turns squarely to the lamp
            float wl = uRimLamps[ i ].w / ( 1.0 + mix( 0.015, 0.009, hood ) * dl * dl );
            float c = smoothstep( mix( 0.55, 0.3, hood ), mix( 0.85, 0.75, hood ), dot( n, Lv / dl ) ) * wl;
            rim += c;
            if ( wl > rimBestW ) { rimBestW = wl; rimBest = c; }
          }
          // a man is rimmed by the lamp he stands under (the lamp-facing half
          // of his silhouette); the other lamps only add a trace, or the rim
          // closes round him on the shadow side too like a sticker's outline
          rim = mix( rim, rimBest + 0.25 * ( rim - rimBest ), hood );
          // tops of kerbs, roofs and ledges face every lamp: an inker would
          // not rim them, only the sides of silhouettes that turn to the light
          // (a man's hat crown and shoulders are the exception: that light
          // edge is what separates him from the black behind, DESIGN.md 5.4)
          rim = smoothstep( 0.35, 1.0, rim ) * nearF * ( 1.0 - edge ) * mix( 1.0 - smoothstep( 0.5, 0.8, nW.y ), 1.0, hood )
              // (a far Hood keeps only a trace of rim: past ~10 m the rim probe
              // covers most of his body and would print him grey)
              * ( 1.0 - hood * 0.85 * smoothstep( 9.0, 20.0, dist ) );
          // a dry-brush highlight, not a CG glow outline: broken along its length
          rim *= smoothstep( 0.3, 0.5, br.g * 0.5 + br.r * 0.5 );
          // no rim beside a glare (the lamp shade is a black silhouette under its light)
          rim *= 1.0 - smoothstep( 0.3, 1.0, glare );
          rim *= 1.0 - skyl;
        }

        // ---- structure in the black: inverse inking ------------------------
        // On a black mass a black contour is invisible, so an inker draws the
        // structure (flanges, stiffeners, arch intrados, rails) as thin grey
        // highlight lines where a crease turns toward the light or the sky.
        // Broken by the brush field so it never becomes a ruled grid.
        float structL = 0.0;
        if ( !sky && vSmooth < 0.14 ) {
          float lampF = 0.0;
          for ( int i = 0; i < 4; i ++ ) {
            vec3 Lv = uRimLamps[ i ].xyz - vpos;
            float dl = length( Lv );
            lampF = max( lampF, smoothstep( 0.2, 0.7, dot( n, Lv / dl ) ) * uRimLamps[ i ].w / ( 1.0 + 0.004 * dl * dl ) );
          }
          float skyF = smoothstep( 0.25, 0.8, nW.y );
          float lit = max( lampF, skyF * 0.6 );
          structL = edgeN * ( 1.0 - edgeId ) * lit * ( 0.6 + 0.4 * iron )
                  * smoothstep( 0.35, 0.55, br.r * 0.5 + br.b * 0.5 )
                  * nearF * ( 1.0 - smoothstep( 25.0, 60.0, dist ) ) * ( 1.0 - ground )
                  // a far Hood is a clean black silhouette (the reference's
                  // man by the car): his fold lines go long before the world's
                  * ( 1.0 - hood * 0.92 * smoothstep( 8.0, 18.0, dist ) );
        }

        vec3 col = vec3( v );
        col = mix( col, vec3( 0.0 ), edge );
        col = max( col, vec3( structL * 0.42 ) );
        col = max( col, vec3( rim * mix( 0.72, 0.86, hood ) ) );
        // black on black: behind a Hood's silhouette the dark object (a car,
        // a column, another man) is cut back by a thin broken paper gap, the
        // inker's trapping line, instead of a black contour nobody can see
        // (a man behind another man gets it too: ids differ per Hood, so a
        // Hood never haloes against his own body)
        float haloK = halo * ( 1.0 - smoothstep( 0.1, 0.22, vSmooth ) ) * nearF
                    * smoothstep( 0.25, 0.45, br.r * 0.5 + br.g * 0.5 ) * ( sky ? 0.0 : 1.0 );
        // ... but only on his lamp side: where the man's own edge turns away
        // from every lamp the gap closes and he goes black on black (the
        // reference's shadow side dissolves), unless what lies behind him is
        // a dark OBJECT (a car, a column, another man), which keeps a broken
        // trap so he never merges with it. Broken along its length like the
        // contours, never a continuous sticker outline.
        if ( haloK > 0.0 ) {
          vec3 hp = viewPos( haloUV, texture2D( tDepth, haloUV ).r );
          // (the lamp he stands under, as for the rim: its terminator runs
          // down his sides, so grazing edges get only part of the gap)
          float lampH = 0.0, bestW = 0.0;
          for ( int i = 0; i < 4; i ++ ) {
            vec3 Lv = uRimLamps[ i ].xyz - hp;
            float dl = length( Lv );
            float wl = uRimLamps[ i ].w / ( 1.0 + 0.009 * dl * dl );
            if ( wl > bestW ) {
              bestW = wl;
              lampH = smoothstep( -0.05, 0.35, dot( haloN, Lv / max( dl, 1e-4 ) ) ) * smoothstep( 0.2, 0.7, wl );
            }
          }
          haloK *= lineBreak * max( lampH, 0.7 * isFig );
        }
        col = mix( col, vec3( 0.42 ), haloK );
        col = min( col + glow, vec3( 1.0 ) );
        // paper-white lift-out: where the air light is dense (a lamp's halo,
        // the hot collar under a shade) the brush leaves bare paper, with a
        // dry-brush edge instead of a smooth airbrushed falloff
        float airL = ( luma( vol ) + luma( bloom ) ) * exposure;
        // Where the field dips below 0.12 this lifts paper out of NO air
        // light at all: the white dry-brush slashes of the façade and the
        // street blocks. Phase 1c: that is kept only where the wall's strokes
        // GATHER (item 6: the quiet blocks stay a flat dark-grey wash) and
        // never on the sky or the skyline (item 1: the towers carried the
        // façade's slashes); there only real air light lifts paper.
        float airA = smoothstep( 0.5, 0.95, airL );
        float slashOK = sky ? 0.0 : ( 1.0 - skyl ) * ( 1.0 - wallQuiet );
        float paperW = smoothstep( b - 0.12, b + 0.12, airA ) * max( smoothstep( 0.0, 0.2, airA ), slashOK ) * ( 1.0 - figure );
        col = max( col, vec3( paperW ) );
        col = mix( col, colOut, keep );
        // 3D rain + splash rings, screened over the ink as thin white lines at
        // the value they would print on their own (through the tone curve)
        float rainD = rain3 > 1e-5 ? toneCurve( rain3 * exposure * uRain3 ) : 0.0;
        col = 1.0 - ( 1.0 - col ) * ( 1.0 - rainD * 0.85 );

        // ---- screen-space rain ---------------------------------------------
        // three parallax layers of the slanted streak texture, each scrolled
        // along the streak slope so drops slide down their own lines
        vec2 rp = ( fc - uRes * 0.5 ) / uRes.y;
        vec2 fall = vec2( ${RAIN_SLANT.toFixed(3)}, 1.0 );
        float rain = texture2D( tRain, rp * vec2( 1.9, 1.9 ) + fall * uTime * 1.7 ).r * 0.55
                   + texture2D( tRain, rp * vec2( 3.1, 3.1 ) + vec2( 0.37, 0.11 ) + fall * uTime * 2.1 ).r * 0.38
                   + texture2D( tRain, rp * vec2( 5.0, 5.0 ) + vec2( 0.71, 0.53 ) + fall * uTime * 2.6 ).r * 0.25;
        float bl = luma( bloom ) + luma( vol ) * 0.5;
        // outside the beams the rain is barely there (reference: it only
        // lights up inside the cones), most of all over near-black surfaces
        rain *= uRain * 0.32 * ( mix( 0.18, 0.4, smoothstep( 0.05, 0.4, col.r ) ) + 1.4 * clamp( bl, 0.0, 1.0 ) );
        col = 1.0 - ( 1.0 - col ) * ( 1.0 - rain );

        // ---- paper, grain, vignette ----------------------------------------
        // paper: faint and low-frequency only; a stronger sheet texture reads
        // as a pattern glued to the lens once the player walks
        vec4 paper = texture2D( tPaper, fc / 1400.0 );
        float lum = col.r;
        col *= mix( 1.0, 0.965 + 0.045 * paper.r, smoothstep( 0.15, 0.8, lum ) );
        float grain = hash12( fc + fract( uTime * 7.13 ) * vec2( 131.0, 71.0 ) ) - 0.5;
        col += grain * 0.045;
        vec2 vq = ( uv - 0.5 ) * vec2( uRes.x / uRes.y, 1.0 );
        col *= mix( 1.0, 0.8, smoothstep( 0.5, 1.1, length( vq ) ) );

        if ( uView == 1 ) col = mix( vec3( vLit ), colOut, keep );
        else if ( uView == 7 ) col = vec3( toneCurve( ( luma( vol ) + rain3 ) * exposure ) );
        else if ( uView == 2 ) col = n * 0.5 + 0.5;
        else if ( uView == 3 ) col = vec3( hash12( vec2( idc, 3.1 ) ), hash12( vec2( idc, 7.7 ) ), hash12( vec2( idc, 1.3 ) ) ) * step( 0.5, abs( idc ) );
        else if ( uView == 4 ) col = vec3( fogA );
        else if ( uView == 5 ) col = vec3( 1.0 - edge ) - vec3( rim ) * vec3( 0.0, 1.0, 1.0 );
        else if ( uView == 6 ) col = vec3( b );
        else if ( uView == 8 ) col = vec3( vSmooth );   // lit surfaces only (no air light)

        gl_FragColor = vec4( clamp( col, 0.0, 1.0 ), 1.0 );
      }`,
  });
}

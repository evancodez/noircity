import * as THREE from 'three';
import { FULLSCREEN_VERT, HASH_GLSL, LUMA_GLSL, DRY_GLSL } from './common.js';
import { NOIR_FOG_GLSL } from '../fog.js';
import { TONE_GLSL, toneUniforms, EXPOSURE } from '../tone.js';
import { RAIN_SLANT } from '../textures.js';
import { FIG_ANCHOR, HOOD_ID0, HOOD_SLOTS, VM_ID0, VM_LO, VM_HI, DEBRIS_ID0 } from '../layers.js';

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
      // viewmodel: its camera's inverse projection (FOV ~50) and the view ->
      // gun-local transform its brush field is anchored in
      uProjInvVM: { value: new THREE.Matrix4() },
      uVmFrame: { value: new THREE.Matrix4() },
      uExposure: { value: EXPOSURE },
      ...toneUniforms(),
      uBloomStrength: { value: 0.3 },
      uBrush: { value: 0.85 },
      uLineWidth: { value: 1.0 },
      uLightning: { value: 0 },
      uKick: { value: 0 },
      uBrushPan: { value: new THREE.Vector2() },
      uRimLamps: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] },
      uRain: { value: 1.0 },
      uRain3: { value: 1.0 },
      uGrain: { value: 1.0 },       // the Look's film grain
      uView: { value: 0 },
      // 1: the Phase 3b fast paths (bit-identical output); 0: the Phase 3a
      // path, for the in-session before/after benchmark (__noir.perfLegacy)
      uFast: { value: 1 },
      // per-Hood brush anchor (root xyz, yaw), indexed by id - HOOD_ID0
      uFigAnchor: { value: FIG_ANCHOR },
      // the lighter's flame in the hands (fix round A6): view-space xyz, w =
      // its strength (0: no flame); Pipeline sets it from the viewmodel
      uFlame: { value: new THREE.Vector4() },
      ...fogUniforms,
    },
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: /* glsl */`
      uniform sampler2D tScene, tBloom, tVolume, tRainBuf, tNormalId, tDepth, tBrush, tPaper, tRain, tNoise;
      uniform vec2 uRes;
      uniform float uTime, uBoil, uNear, uFar;
      uniform mat4 uProjInv, uViewInv, uProjInvVM, uVmFrame;
      uniform float uExposure, uBloomStrength, uBrush, uLineWidth, uLightning, uRain, uRain3, uKick, uGrain;
      uniform vec4 uRimLamps[ 4 ];
      uniform vec4 uFigAnchor[ ${HOOD_SLOTS} ];
      uniform vec4 uFlame;
      uniform int uView;
      uniform float uFast;
      varying vec2 vUv;

      ${HASH_GLSL}
      ${LUMA_GLSL}
      ${NOIR_FOG_GLSL}
      ${DRY_GLSL}

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
      vec3 viewPosVM( vec2 uv, float d ) {
        vec4 c = vec4( uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0 );
        vec4 v = uProjInvVM * c;
        return v.xyz / v.w;
      }
      // 1 for the viewmodel's ids, VM_LO..VM_HI: the hands and whatever they
      // hold, the Tommy gun (written negative, see layers.js)
      float isVM( float w ) {
        float f = -w - ${VM_LO.toFixed(1)};
        return step( -0.5, f ) * step( f, ${(VM_HI - VM_LO + 0.5).toFixed(1)} );
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
      // Interior bands (story pass): N flat values, each edge a narrow zone
      // (~1/7 of a band) where the brush field b decides the side - a torn
      // dry-brush edge between flat washes.
      float inkBandsTorn( float v, float b, float N ) {
        float t = v * N;
        float base = floor( t );
        float f = clamp( ( t - base - 0.5 ) * 7.0 + 0.5, 0.0, 1.0 );
        float s = smoothstep( b - 0.12, b + 0.12, f );
        return ( base + s ) / N;
      }
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
        // an interior surface class rides on the normal's length (idpass:
        // n * ( 1 + 2 k ), k = 1 plaster, 2 wood, 3 lino, 4 metal, 5 cloth);
        // untagged surfaces are unit normals and never enter the branch
        float surf = 0.0;
        // a cast figure (class 14 / 15, idpass): its light share t, 0 on the
        // dark cloth, toward 1 on its light shapes
        float castF = 0.0, castT = 0.0;
        {
          float nLen = length( nid.xyz );
          if ( nLen > 2.0 ) { surf = floor( ( nLen - 1.0 ) * 0.5 + 0.5 ); nid.xyz /= nLen; }
          castF = step( 13.5, surf ) * step( surf, 15.5 );
          castT = castF * clamp( ( nLen - 29.0 ) / 1.8, 0.0, 1.0 );
        }
        // (bare metal and glass, class 12: a room's too, printed black with
        // broken highlights)
        float metalF = step( 11.5, surf ) * step( surf, 12.5 );
        float interior = max( step( 0.5, surf ) * step( surf, 5.5 ), metalF );
        float amberF = step( 5.5, surf ) * step( surf, 6.5 );   // the scotch (accents.js)
        // the glass of a vessel that holds scotch (class 11): the amber is
        // read through it by its hue below
        float amberGlassF = step( 10.5, surf ) * step( surf, 11.5 );
        float d = texture2D( tDepth, uv ).r;
        bool sky = d >= 0.999999;
        // the viewmodel was drawn by its own camera (same eye, narrower FOV)
        float vmF = isVM( nid.w );
        // (in the hands the tag is what the thing is made of, not a room)
        interior *= 1.0 - vmF;
        vec3 vpos = vmF > 0.5 ? viewPosVM( uv, d ) : viewPos( uv, d );
        float dist = sky ? uFar : length( vpos );
        vec3 wpos = ( uViewInv * vec4( vpos, 1.0 ) ).xyz;
        float fogA = sky ? 1.0 : noirFogAmount( dist, wpos.y, uFogDensity );
        float nearF = 1.0 - fogA;

        vec3 hdr = texture2D( tScene, uv ).rgb;
        // the scotch seen through its glass (class 11): the fire's hue
        // family, well saturated (the glass's own grey thins it a little);
        // what is not amber there is the empty glass above the fill line
        {
          float hx = max( hdr.r, max( hdr.g, hdr.b ) );
          float hs = ( hx - min( hdr.r, min( hdr.g, hdr.b ) ) ) / max( hx, 1e-5 );
          float amberIn = amberGlassF * step( hdr.b, hdr.g ) * step( hdr.g, hdr.r )
                        * smoothstep( 0.02, 0.07, ( hdr.g - hdr.b ) / max( hx, 1e-5 ) ) * smoothstep( 0.12, 0.25, hs );
          amberF = max( amberF, amberIn );
        }
        float glassE = amberGlassF * ( 1.0 - amberF );
        // a lit panel in a room (class 13: the back bar's glass, the
        // kitchen's wall): its own flat light, never banded or torn
        float litF = step( 12.5, surf ) * step( surf, 13.5 );
        vec4 bloom4 = texture2D( tBloom, uv );
        vec3 bloom = bloom4.rgb * uBloomStrength;
        // (the ember's share of the glow, bloom.js: its class carried down
        // the bloom chain in alpha)
        float emberA = bloom4.a * uBloomStrength;
        // The fire's glow (Phase 3b): a fireball's bloom printed as a smooth
        // white aura round the flame, a CG glow sprite. The bloom is split
        // into a white part (lamps, flashes, windows: untouched) and a warm
        // part (the fire family, hue ~(1, .45, .07): r - b carries it, and
        // green well above blue tells it from blood); the warm part loses
        // its faint outer ~40 %, and what is left of its glow is broken by
        // the world-space brush field below, so the flame is edged by
        // dry-brush paper, not airbrushed. (Split, not switched: where a
        // lamp's halo and the fire's overlap only the fire's share goes.)
        float bWarm = smoothstep( 0.02, 0.08, ( bloom.g - bloom.b ) / max( bloom.r, 1e-6 ) );
        vec3 fireBl = max( ( bloom.r - bloom.b ) / 0.93, 0.0 ) * bWarm * vec3( 1.0, 0.45, 0.07 );
        vec3 whiteBl = max( bloom - fireBl, 0.0 );
        fireBl *= smoothstep( 0.1, 0.5, luma( fireBl ) * uExposure );
        bloom = whiteBl + fireBl;
        float fireGlowF = luma( fireBl ) / max( luma( bloom ), 1e-6 );
        // volume (half res, feathered): r = cone light, g = the share of it
        // touching the surface. Rain & splash rings live in their own
        // full-res buffer (b) so the hairlines stay one pixel sharp.
        vec4 volT = texture2D( tVolume, uv );
        vec3 vol = volT.rrr;
        // smoke coverage (Phase 3a): smoke puffs are not in the id / depth
        // passes, so every id-driven rule (iron and figures held black, the
        // air light painted around figures, contours, rims) belonged to
        // whatever stands BEHIND a puff; the puffs' occluders write their
        // coverage into the volume buffer's alpha (fx/Particles occlude) and
        // those rules give way to the smoke's own tone where it covers
        float fxCov = clamp( 1.0 - volT.a, 0.0, 1.0 );
        // the muzzle puff's own coverage (Phase 3c: its occluder marks the
        // volume buffer's blue channel after the feather, crisp at its frayed
        // edge): printed in flat banded washes below, not airbrushed
        float puffCov = volT.b;
        // a blast's flying chunks are drawn over the fire and smoke (fx/
        // Explosion.js): the smoke's coverage does not apply to them, and the
        // fireball's bloom is taken off them below (black against the flame)
        float debrisF = step( ${(DEBRIS_ID0 - 0.5).toFixed(1)}, - nid.w ) * step( - nid.w, ${(DEBRIS_ID0 + 9.5).toFixed(1)} );
        fxCov *= 1.0 - debrisF;
        float rain3 = texture2D( tRainBuf, uv ).r;
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
        float figure = isFig * ( 1.0 - smoothstep( 45.0, 110.0, dist ) ) * ( 1.0 - fxCov );
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
        bloom *= 1.0 - debrisF;
        vol *= 1.0 - 0.9 * debrisF;
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
        float flameLift = 0.0;
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
        // (an emitter drawn over the iron - a train's wheel sparks spilling
        // over the girder, L ~ 7 - is not lit steel: far brighter than any
        // lamp-lit iron, it keeps its own tone and prints as a hot white
        // point instead of being held dark with the girder behind it)
        float emitOnIron = smoothstep( 2.2, 3.5, L );
        // (and the rail sparks, tagged a hair blue by their own system
        // (fx/Particles, 'spark'): printed wherever they fall on the iron, at
        // ~2x the bloom's threshold - hot enough for paper white, cool
        // enough that the bloom haloes each point instead of welding a bite
        // into one flare; nothing else in the city is blue)
        float hmx = max( hdr.r, max( hdr.g, hdr.b ) );
        float sparkTag = step( 0.04, ( hdr.b - max( hdr.r, hdr.g ) ) / max( hmx, 1e-5 ) ) * smoothstep( 0.3, 0.6, L );
        emitOnIron = max( emitOnIron, sparkTag );
        v = mix( v, max( min( v, mix( 0.08, 0.62, fogA ) ), ironAir ), iron * ( 1.0 - fxCov ) * ( 1.0 - emitOnIron ) );
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
        float hoodY = 10.0;   // height above the Hood's root (m)
        if ( hood > 0.5 ) {
          int slot = int( fidH + 0.5 );
          vec4 A = uFigAnchor[ slot ];
          vec3 q = wpos - A.xyz;
          hoodY = q.y;
          float ca = cos( A.w ), sa = sin( A.w );
          // (a select, never taken: it keeps the offset's arithmetic as it
          // was compiled when the player's slots were remapped here - folded
          // straight into the sum, it rounds differently in the last bit and
          // a few pixels of every frame with a man in it move one level)
          float slotO = slot < 0 ? 0.0 : float( slot );
          bpos = vec3( ca * q.x - sa * q.z, q.y, sa * q.x + ca * q.z ) + vec3( slotO * 7.31, slotO * 1.9, slotO * 3.77 );
          nBr = vec3( ca * nB.x - sa * nB.z, nB.y, sa * nB.x + ca * nB.z );
        }
        // the gun carries its brush field in its own frame (it moves with the
        // eye): world-scaled strokes that stay on the steel and the wood
        if ( vmF > 0.5 ) {
          bpos = ( uVmFrame * vec4( vpos, 1.0 ) ).xyz * 2.2 + vec3( 3.1, 1.7, 5.3 );
          nBr = normalize( mat3( uVmFrame ) * n );
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
          // the shins below the coat hem hold lower (Phase 2b polish: a lit
          // trouser leg printed as a pale slot between two black shins)
          ceilV *= mix( 1.0, 0.55, 1.0 - smoothstep( 0.42, 0.62, hoodY ) );
          v = ceilV * ( 1.0 - exp( -v / ceilV ) );
          v *= mix( 1.0, mix( 0.2, 1.4, br.r ), upF );
          v *= 1.0 - 0.88 * smoothstep( 9.0, 20.0, dist );
        }
        // The cast (round 2): printed as the Hoods are, whatever the light
        // on them - under a pendant a figure's shaded solid printed every
        // rounded form as a grey balloon. One flat dark mass (no gradient
        // inside it: a dry-brush grey only where the brush's strongest
        // strokes cross the lit side of the cloth), and its one or two light
        // shapes (the apron, the bare forearms, the paper hat: t from the
        // albedo) printed FLAT - a light value where the key light reaches
        // them, a mid value where it does not - with torn edges: the shape's
        // own edge where the brush decides the side, and the split between
        // its two values. The rim (below) cuts it from what is behind.
        castF *= hood;
        if ( castF > 0.5 ) {
          float lgC = log2( max( L * exposure, 1e-6 ) );
          float keyC = smoothstep( -1.5, 1.5, lgC );
          float foldC = smoothstep( 0.74, 0.8, br.g * 0.55 + br.r * 0.45 ) * keyC;
          float massV = mix( 0.028, 0.15, foldC * 0.75 );
          float tb = clamp( 0.1 + 0.16 * br.g, 0.1, 0.26 );
          float shapeK = smoothstep( tb - 0.05, tb + 0.05, castT );
          // (the light shape's albedo sets its value: skin a light grey, a
          // white apron paper)
          float hiA = smoothstep( 0.2, 0.95, castT );
          float litS = mix( 0.62, 0.9, hiA ), shS = mix( 0.3, 0.44, hiA );
          float bs = clamp( br.r, 0.2, 0.8 );
          float sideS = smoothstep( bs - 0.12, bs + 0.12, clamp( ( lgC + 0.8 ) / 2.2 + 0.5, 0.0, 1.0 ) );
          float shapeV = mix( shS, litS, sideS );
          // (past ~14 m only the brightest shape holds, dimmed: a cut-out)
          shapeV *= 1.0 - 0.45 * smoothstep( 14.0, 30.0, dist );
          v = mix( massV, shapeV, shapeK );
        }
        // the gun: black steel and dark wood; lamp light and the muzzle flash
        // raise dry-brush greys on it (never a white plate)
        // (ceiling ~0.28: at 0.5 the stock lit by the key light printed as a
        // pale flat slab beside the camera.) The walnut (stock, grips) is
        // broken by the brush field in the gun's own frame, so it reads as
        // dry-brushed dark wood with strokes along it, not a painted plank.
        if ( vmF > 0.5 ) {
          float vmPart = -idc - ${VM_ID0.toFixed(1)};
          if ( vmPart > -0.5 ) {
            float ceilG = 0.28;
            v = ceilG * ( 1.0 - exp( -v / ceilG ) );
            float woodF = step( 1.5, vmPart ) * step( vmPart, 2.5 );
            v *= mix( 1.0, mix( 0.35, 1.45, smoothstep( 0.25, 0.75, br.g * 0.6 + br.r * 0.4 ) ), woodF );
          } else {
            // The hands and what they hold (ids 1730..1769, fix round 1):
            // the gun's ceiling printed bare hands, cuffs and cigarette paper
            // dark grey. Each prints by what it is made of (idpass class):
            // paper white; cloth dark as a coat; metal the gun's black
            // steel; glass held at mid grey; skin (the default) below.
            // Contours and the brush's dark ticks stay.
            float lit = smoothstep( 0.08, 0.4, v );
            if ( surf > 7.5 && surf < 8.5 ) {
              v = mix( min( v * 3.0, 0.7 ), 0.86 + 0.14 * smoothstep( 0.3, 0.6, v ), lit );
            } else if ( surf > 4.5 && surf < 5.5 ) {
              v = 0.22 * ( 1.0 - exp( -v / 0.22 ) );
            } else if ( ( surf > 3.5 && surf < 4.5 ) || metalF > 0.5 ) {
              v = 0.28 * ( 1.0 - exp( -v / 0.28 ) );
            } else if ( surf > 8.5 && surf < 9.5 ) {
              v = 0.55 * ( 1.0 - exp( -v / 0.55 ) );
            } else if ( amberF > 0.5 ) {
              // (the scotch in the hand prints by its own rule below)
            } else if ( glassE > 0.5 ) {
              // the empty glass of a tumbler (its thick base, the wall above
              // the scotch): dark, a white tick where the light catches it
              v = mix( min( v, 0.9 ) * 0.42, 0.05, smoothstep( 0.35, 0.85, 1.0 - abs( n.z ) ) );
            } else {
              // Skin (fix round A4): a hand, not a white glove. Two values
              // split by a torn brush edge that follows the form: the lit
              // side light grey (0.62 .. 0.75 under a lamp, 0.45 .. 0.6 in
              // the street's dim light), the shadow side mid grey (0.30 ..
              // 0.40); paper white only as small highlights where the light
              // is hottest (the knuckles, the hand's edge nearest the lamp).
              // (the lit side is where the form turns up to the lamps over
              // it - the room's pendants, the street's lamps - as much as
              // where the light on it is strong: the hands' own key lights
              // them all over, and by tone alone the whole hand was 'lit')
              // (in log stops: under a pendant the hand's lit side is 4 .. 8x
              // paper white, its turned-away side 1/8 of it; in the street
              // or a stride from the lamp everything is 2 .. 4 stops lower)
              float lg = log2( max( L * exposure, 1e-6 ) );
              vec3 upV = vec3( uViewInv[ 0 ][ 1 ], uViewInv[ 1 ][ 1 ], uViewInv[ 2 ][ 1 ] );
              float ndl = dot( n, normalize( upV + vec3( 0.0, 0.0, 0.3 ) ) );
              // (the split follows the FORM - the faces turned up to the
              // lamps are the lit side wherever the hand is - with a
              // push from the light itself: a face in a lamp's hot spot is
              // lit, one in a cast shadow is not)
              float lm = 0.62 * smoothstep( -0.25, 0.45, ndl ) + 0.38 * smoothstep( -3.2, 0.6, lg );
              float litV = mix( 0.48, 0.72, smoothstep( -2.2, 1.8, lg ) );
              float shV = mix( 0.3, 0.38, smoothstep( -4.0, -0.5, lg ) );
              float bs = clamp( br.r, 0.16, 0.84 ), bh = clamp( br.g, 0.12, 0.88 );
              float side = smoothstep( bs - 0.14, bs + 0.14, clamp( ( lm - 0.5 ) / 0.16 + 0.5, 0.0, 1.0 ) );
              // (the highlight: where the form turns its face between the
              // lamp over it and the eye - the knuckles' curves, a rolled
              // edge - and the light is strong; a flat back of the hand
              // under the lamp stays the lit grey)
              vec3 hV = normalize( upV + normalize( - vpos ) );
              float spec = pow( max( dot( n, hV ), 0.0 ), 60.0 );
              // (round 2: no paper highlight on the skin - on the knuckles'
              // small spheres it printed as white speckles; the hand is two
              // values, its contour and its dark ticks)
              float hiK = 0.0 * smoothstep( bh - 0.1, bh + 0.1, clamp( ( spec - 0.45 ) / 0.3 + 0.5, 0.0, 1.0 ) ) * smoothstep( 0.5, 2.0, lg );
              v = mix( mix( shV, litV, side ), 0.95, hiK ) * mix( 0.97, 1.03, br.b );
              // (the lighter's flame, within ~8 cm: a warm-white lift through
              // the skin's own print, no new light; the warmth is added below)
              float fl = 1.0 - smoothstep( 0.015, 0.08, length( vpos - uFlame.xyz ) );
              fl = uFlame.w * fl * fl;
              v = mix( v, max( v, 0.8 ), fl );
              flameLift = fl;
            }
          }
        }
        // A muzzle flash sprite drawn in front of a man or of the gun is not
        // his cloth or its steel: it is far brighter than anything they can
        // reflect (lit cloth < ~0.7, the sprite ~3), so it keeps its own
        // tone instead of being held under their ceilings. (Crushed, a
        // Hood's flash printed as black behind his head and the player's
        // core vanished into the compensator.)
        // (bare hands under a pendant are 4 .. 8x paper white themselves:
        // only a far brighter thing in front of them is a flash)
        // (the bare hands and what they hold, not the gloves and sleeves of
        // the gun sets: those keep their accepted print)
        float vmHands = vmF * step( -idc, ${(VM_ID0 - 0.5).toFixed(1)} ) * ( 1.0 - metalF ) * ( 1.0 - step( 3.5, surf ) * step( surf, 5.5 ) );
        // (a cast figure's apron under a pendant is several times paper
        // white itself: as with the bare hands, only a far brighter thing)
        float flashF = max( hood * ( 1.0 - castF ), vmF * ( 1.0 - vmHands ) ) * smoothstep( 1.1, 2.2, L ) + max( vmHands, castF ) * smoothstep( 14.0, 24.0, L );
        v = mix( v, vRaw, flashF );
        // (smoke over a man or the el prints as smoke, not as his cloth)
        v = mix( v, vRaw, fxCov * ( 1.0 - vmF ) );
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
        // Interior surfaces are calm (story pass, P0.2): a room is not wet
        // stone turned inside out. Flat washes that follow the lamps; the
        // brush works only where a band gives way to the next, which in a
        // room is where a lamp's pool falls off into shadow: short, sparse
        // strokes there, none on the ceiling, no white slashes or lift-outs
        // anywhere. Wood takes the horizontal family (its grain), lino and
        // enamel are flatter still.
        // (an untagged surface inside a room - a dry volume, stage.dry - is
        // plaster: the room's own faces of the façade's stone, a part not
        // yet tagged; figures and the hands are never a room)
        if ( interior < 0.5 && !sky && isFig < 0.5 && surf < 0.5 && inDry( wpos + nW * 0.05 ) > 0.5 ) { interior = 1.0; surf = 1.0; }
        // A room's cone (fix round A2) is smoke lit in the air: its light is
        // laid over what stands behind it in DISPLAY space, soft and
        // saturating (~0.35 just under the shade), not through the log tone
        // curve - there the faint rim of a cone over black was lifted to mid
        // grey and cut off by the curve's crush in one step: a grey bell with
        // a hard stepped outline. The lamps' own halos (the bloom) keep the
        // curve. (Over a room's surface, or glass onto one, never the street.)
        float roomAir = max( interior, max( amberGlassF, litF ) ) * ( 1.0 - vmF ) * ( sky ? 0.0 : 1.0 );
        if ( roomAir > 0.5 ) {
          float gB = max( toneCurve( ( L + luma( bloom ) ) * exposure ) - vRaw, 0.0 );
          float gV = 0.46 * ( 1.0 - exp( - luma( vol ) * exposure / 0.1 ) );
          glow = gB + gV * ( 1.0 - gB );
        }
        if ( interior > 0.5 ) {
          wallQuiet = 0.0;
          if ( surf > 1.5 && surf < 2.5 ) b = br.b;
          // Banded, as outdoors (fix round 1: the walls and the cones'
          // pools were airbrushed gradients, the CG look): the tone is laid
          // in five flat values between ink and paper, and where one gives
          // way to the next the edge is TORN by the brush field (the steep
          // bands below keep a face flat away from its band edges, so the
          // full-contrast field makes a ragged edge, never a mottle). No
          // slashes or lift-outs: those stay outdoors. Lino and enamel a
          // little calmer; ceilings only a soft tear.
          b = 0.5 + ( b - 0.5 ) * ( surf > 2.5 && surf < 4.5 ? 0.75 : 1.0 );
          b = mix( b, 0.5 + ( b - 0.5 ) * 0.35, smoothstep( -0.4, -0.75, nW.y ) );
        }
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
        // (never in a room: its lift is multiplied away there below)
        if ( !sky && skyl < 0.5 && v < 0.10 && interior < 0.5 ) {
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
          v += lift * ( 1.0 - smoothstep( 0.06, 0.10, v ) ) * ( 1.0 - wallQuiet ) * ( 1.0 - fxCov ) * ( 1.0 - interior );
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
        // (in a room the smoke's glow lies over most surfaces: its bands stay
        // brushed under a thin haze, only real glare goes smooth)
        // (the haze glow is added over the bands later: light in the air
        // stays soft, the surface under it keeps its bands; only a face
        // lost in real glare goes smooth)
        // The room in ink (fix round A3): five bands made every wall a mesh
        // of thin scratches (a flat wall sat on a band edge) and every pool
        // on the lino a contour map of rings. A room is printed like the
        // pavement: a FEW flat values with bold torn edges - black where no
        // lamp reaches, a dark wash (display 0.06 .. 0.14) on a wall the
        // room's dim light finds, ONE step of grey round a pool, paper
        // white in it - the edges torn by a coarse world-space brush broken
        // by the fine one (a dry brush dragged round the pool, not a
        // mottle). The ceiling is black. Bare metal and glass print black
        // with a broken paper highlight where the light glances off them
        // (the counter's rolled edge, chrome, a bottle's shoulder).
        if ( interior > 0.5 || glassE * ( 1.0 - vmF ) > 0.5 ) {
          // the open tone: the curve without its crush of the dark greys,
          // so a dim wall keeps a wash instead of snapping to ink
          float tO = clamp( ( log2( max( L * exposure, 1e-6 ) ) - uLogBlack ) / ( uLogWhite - uLogBlack ), 0.0, 1.0 );
          float vo = mix( tO, tO * tO * ( 3.0 - 2.0 * tO ), uContrast );
          vo = mix( vo, 1.0, smoothstep( 0.72, 0.9, vo ) );
          // (a coarse field for the torn edges: the brush on the surface's
          // dominant plane only, two octaves - a third of brushWorld's taps)
          float bc;
          {
            float f = uRes.y * 0.5 / max( uProjInv[ 1 ][ 1 ], 1e-4 );
            float lg2 = log2( max( 2600.0 * dist / f, 1e-3 ) );
            float k0 = floor( lg2 ), tt = lg2 - k0;
            float W0 = exp2( k0 );
            vec3 an = abs( nBr );
            vec2 pq = an.x > an.y && an.x > an.z ? bpos.zy : an.y > an.z ? bpos.xz : bpos.xy;
            vec2 c0 = texture2D( tBrush, pq / W0 + vec2( 0.17, 0.107 ) ).rb;
            vec2 c1 = texture2D( tBrush, pq / ( W0 * 2.0 ) + vec2( 0.54, 0.477 ) ).rb;
            vec2 cc = clamp( ( mix( c0, c1, tt ) - 0.5 ) * inversesqrt( 1.0 - 2.0 * tt * ( 1.0 - tt ) ) + 0.5, 0.0, 1.0 );
            bc = mix( cc.x, cc.y, wH );
          }
          // (held inside the steps' ramps: where the field dips near 0 or 1 a
          // step would otherwise fire at ANY tone - white slashes on a black wall)
          float bt = clamp( 0.62 * bc + 0.38 * b, 0.16, 0.84 );
          float wash = 0.1 * smoothstep( 0.05, 0.22, vo ) + ( bc - 0.5 ) * 0.03 * smoothstep( 0.05, 0.2, vo );
          // (a wall, a counter front, a booth's back - an upright face of the
          // room - is a dark wash even where the lamps' spill barely finds
          // it, so a man stands black against it; the floor and the ceiling
          // keep their black)
          wash = max( wash, ( 0.075 + ( bc - 0.5 ) * 0.035 ) * ( 1.0 - smoothstep( 0.35, 0.7, abs( nW.y ) ) ) * ( 1.0 - metalF ) );
          // (steps: grey from display ~0.45 of the open tone - 3.3 stops
          // under paper - and paper from ~0.86, 1.3 stops under: a pool's
          // paper heart, one grey ring round it, black beyond)
          float sG = smoothstep( bt - 0.13, bt + 0.13, clamp( ( vo - 0.47 ) / 0.14 + 0.5, 0.0, 1.0 ) );
          float sP = smoothstep( bt - 0.13, bt + 0.13, clamp( ( vo - 0.86 ) / 0.1 + 0.5, 0.0, 1.0 ) );
          float room = mix( mix( wash, 0.4, sG ), 0.94, sP );
          // (a ceiling: black, only a lamp's own collar reaches it)
          float ceilF = smoothstep( -0.4, -0.75, nW.y );
          room = mix( room, mix( wash * 0.35, 0.94, sP ), ceilF );
          // metal and glass: black, a broken highlight where it is hottest
          float bm = clamp( b, 0.12, 0.88 );
          float hiM = smoothstep( bm - 0.1, bm + 0.1, clamp( ( vRaw - 0.84 ) / 0.1 + 0.5, 0.0, 1.0 ) );
          room = mix( room, mix( min( wash, 0.08 ), 0.95, hiM ), metalF );
          // the empty glass of a scotch bottle or a tumbler (above the fill
          // line, the thick base): what is behind it seen darker through
          // it, black where the glass turns edge-on (its walls' edges, the
          // base's two ellipses); the white tick is its own stroke
          float gFres = smoothstep( 0.35, 0.85, 1.0 - abs( n.z ) );
          room = mix( room, mix( min( vRaw, 0.9 ) * 0.42, 0.05, gFres ), glassE );
          brushAmt = sky ? 0.0 : nearF * ( 1.0 - smoothstep( 0.8, 0.98, glow ) );
          vBand = room;
        }
        // smoke is a soft wash with its own brushed alpha (fx/fxTextures
        // SMOKE): banded by the surface behind it, its tone stepped at every
        // tower and wall edge it drifted across
        brushAmt *= ( 1.0 - fxCov ) * ( 1.0 - litF ) * ( 1.0 - castF );
        v = mix( v, vBand, brushAmt );
        // (the muzzle puff: its tone laid in the ink's flat bands, their
        // edges broken by the brush field - a brushed puff with a darker core,
        // not a soft gradient blob)
        v = mix( v, inkBands( v, b, 4.0 ), smoothstep( 0.35, 0.6, puffCov ) );
        // the sky gets only a whisper of horizontal wash; fogged towers a
        // little vertical dry-brush (the far street keeps horizontal)
        v += sky ? ( br.b - 0.5 ) * 0.012 : ( mix( br.g, br.b, wH ) - 0.5 ) * 0.03 * fogA * ( 1.0 - skyl );

        // ---- colour keep (blood & fire only carry chroma) -------------------
        float mx = max( hdr.r, max( hdr.g, hdr.b ) );
        float mn = min( hdr.r, min( hdr.g, hdr.b ) );
        float sat = ( mx - mn ) / max( mx, 1e-5 );
        vec3 hn = clamp( hdr / max( mx, 1e-5 ), 0.0, 1.0 );
        // the red family: red dominant with green ~ blue (blood, and blood
        // thinned by grey at a drop's anti-aliased rim). The ember and fire
        // (green well above blue) keep their own hue.
        // (SIGNED: blood's green sits at or below its blue however much grey
        // thins it; an orange thinned by grey (a fire column's flank in the
        // wet street) keeps green above blue and must never be read as
        // blood: with abs() its pale rim printed as a crimson fringe)
        float gb = hn.g - hn.b;
        float redF = step( hdr.g, hdr.r ) * step( hdr.b, hdr.r ) * ( 1.0 - smoothstep( 0.02, 0.07, gb ) );
        // the fire family (Phase 3a, the second permitted colour): orange to
        // yellow-white, green well above blue
        float fireF = step( hdr.b, hdr.g ) * step( hdr.g, hdr.r ) * smoothstep( 0.02, 0.07, gb );
        // (the scotch has the fire's hue but never its print: see below)
        fireF *= 1.0 - amberF;
        // (a steep, low window for blood: a half-covered pixel at a drop's
        // edge goes red or stays ink, it never prints as a pink mix)
        float keep = mix( smoothstep( 0.22, 0.4, sat ), smoothstep( 0.1, 0.2, sat ), redF ) * smoothstep( 0.0004, 0.004, mx );
        // Fire is printed BRIGHT or not at all: its value is the tone of its
        // own max channel, and only where that is >= ~0.3 does the colour
        // survive; the dim end (a fire light's falloff on the stone, the gaps
        // of its column in the wet street) goes back to ink. A dark orange
        // is brown, and brown is the one thing fire must never print as.
        // (the transition is thresholded against the dry-brush field, not
        // blended: a half-kept orange over dark ink is exactly brown, so the
        // fading fire breaks into orange strokes and ink instead)
        float vFire = toneCurve( mx * exposure );
        float fireK = clamp( ( vFire - 0.22 ) / 0.2, 0.0, 1.0 );
        keep *= mix( 1.0, smoothstep( b - 0.05, b + 0.05, fireK ), fireF );
        // Blood must print VIVID red (the reference's #c8102e), never maroon
        // or black: chroma pixels bypass the black crush and the brush bands.
        // The hue is taken to display space (linear #c8102e = (1, .009, .047)
        // of its max -> (1, .12, .25) displayed), the value follows a gentle
        // log curve of the colour's own max channel, floored at 0.45 and
        // broken a little by the brush so a splatter is not a flat sticker.
        vec3 hue = pow( hn, vec3( 1.0 / 2.2 ) );
        // blood prints at the reference red at full saturation, whatever
        // grey (mist, a lamp's cone, the anti-aliased rim) thinned it to
        hue = mix( hue, vec3( 1.0, 0.12, 0.25 ), redF );
        float cT = clamp( ( log2( max( mx * exposure, 1e-6 ) ) + 7.97 ) / 8.1, 0.0, 1.0 );
        float cV = 0.45 + 0.55 * smoothstep( 0.0, 1.0, cT );
        cV *= mix( 0.9, 1.04, b );
        vec3 colOut = hue * clamp( max( cV, 0.45 ), 0.0, 1.0 );
        // fire: lifted into the top of the range (0.86-1) so it reads as
        // flame, never as brown; the dimmer it is, the deeper and redder the
        // orange (an ember), not the darker. The brush breaks it a little.
        vec3 fireHue = mix( vec3( 1.0, 0.36, 0.06 ), hue, smoothstep( 0.35, 0.95, vFire ) );
        vec3 fireOut = fireHue * mix( 0.86, 1.0, smoothstep( 0.3, 0.9, vFire ) ) * mix( 0.94, 1.03, b );
        colOut = mix( colOut, fireOut, fireF );
        // amber (the scotch in the bottle, the stream, the glass): a rich
        // honey at MID value, darker and deeper than any flame - its own
        // lit tone laid in 0.5 .. 0.72 (display), the brush breaking it a
        // little; keyed by its class (idpass), never by hue
        // (fix round A5: honey IN GLASS - #c9832a where the liquid faces the
        // eye, darker toward the glass wall, #8a5416, as the liquid turns
        // away; its surface, seen nearly edge-on at the fill line, a lighter
        // meniscus line; display 0.36 .. 0.62, never the fire's #f08020)
        float amTop = smoothstep( 0.75, 0.95, nW.y ) * ( 1.0 - amberGlassF );
        float amFace = max( smoothstep( 0.55, 0.99, abs( n.z ) ), amTop * 0.8 );
        vec3 amberOut = mix( vec3( 0.541, 0.329, 0.086 ), vec3( 0.788, 0.514, 0.165 ), amFace )
                      * mix( 0.78, 1.02, smoothstep( 0.05, 0.6, vRaw ) ) * mix( 0.95, 1.03, b );
        // (the meniscus: the surface only where it is seen nearly edge-on -
        // a lighter line at the fill line; seen from above, it is the depth)
        float amMen = amTop * ( 1.0 - smoothstep( 0.1, 0.28, abs( n.z ) ) );
        amberOut = mix( amberOut, vec3( 0.9, 0.68, 0.34 ), amMen * 0.85 );
        colOut = mix( colOut, amberOut, amberF );
        keep = max( keep, amberF * smoothstep( 0.1, 0.25, sat ) );

        // ---- contours ------------------------------------------------------
        // Wobble: a static low-frequency warp plus a small 'boil' that jumps
        // 8x per second, like inked animation on twos.
        // (the slow warp is anchored to the surface so lines do not swim
        // against the world as the player walks; the boil is time-only)
        // (the wobble's and the width's noise taps stay OUTSIDE the sky
        // branch below: the noise is mipmapped, and a quad straddling a
        // silhouette against the sky needs its derivatives)
        vec2 wob = ( texture2D( tNoise, ( bpos.xy + bpos.zx * 0.7 ) / ( 0.6 + dist * 0.09 ) ).rg - 0.5 ) * 1.8
                 + ( texture2D( tNoise, uv * vec2( 5.3, 3.7 ) + uBoil * 0.37 ).ba - 0.5 ) * 1.2;
        vec2 uvL = uv + wob / uRes;
        float wc = sky ? 0.0 : 1.0 / linZ( d );
        float zc = sky ? uFar : linZ( d );
        // width varies along the line and grows for near objects
        float wN = texture2D( tNoise, uv * vec2( 7.0, 5.0 ) + 0.3 ).a;
        float rpx = uLineWidth * mix( 0.7, 1.9, wN ) * clamp( 7.0 / zc + 0.6, 0.65, 1.7 );
        // (a bare hand's contour is a pen line, 1.5 .. 2 px, not the heavy
        // outline of a near object: the hands were white gloves inside it)
        if ( vmHands > 0.5 ) rpx = uLineWidth * mix( 0.75, 1.05, wN );
        float edge = 0.0;
        float edgeN = 0.0;   // crease lines only (no silhouettes): structure inside black masses
        float edgeId = 0.0;
        float silFront = 0.0;
        float halo = 0.0;    // we are just behind a Hood's silhouette
        vec2 haloUV = uv;    // ... at this neighbouring Hood pixel,
        vec3 haloN = vec3( 0.0, 0.0, 1.0 );   // whose normal is this
        const vec2 dirs[ 4 ] = vec2[ 4 ]( vec2( 1.0, 0.0 ), vec2( 0.0, 1.0 ), vec2( 0.7071, 0.7071 ), vec2( 0.7071, -0.7071 ) );
        // (Phase 3b performance: a sky pixel's contour terms all end up zero -
        // its edge fades out at zc = uFar, its id edge, halo, rim and structure
        // lines are all gated by !sky - so the 24-tap probe is skipped there;
        // the output is bit-identical. The depth and normal/id targets are
        // unfiltered and unmipmapped, so the branch is safe for their taps.)
        if ( !sky || uFast < 0.5 ) {
        vec4 cN = texture2D( tNormalId, uvL );
        if ( dot( cN.xyz, cN.xyz ) > 4.0 ) cN.xyz = normalize( cN.xyz );
        float wcl = wAt( uvL );
        for ( int i = 0; i < 4; i ++ ) {
          vec2 o = dirs[ i ] * rpx / uRes;
          float w1 = wAt( uvL + o ), w2 = wAt( uvL - o );
          float lap = abs( w1 + w2 - 2.0 * wcl ) / max( max( wcl, max( w1, w2 ) ), 1e-6 );
          edge = max( edge, smoothstep( 0.025, 0.07, lap ) );
          vec4 n1 = texture2D( tNormalId, uvL + o ), n2 = texture2D( tNormalId, uvL - o );
          if ( dot( n1.xyz, n1.xyz ) > 4.0 ) n1.xyz = normalize( n1.xyz );
          if ( dot( n2.xyz, n2.xyz ) > 4.0 ) n2.xyz = normalize( n2.xyz );
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
        edge *= 1.0 - smoothstep( 0.6, 2.0, mix( glare, luma( bloom ) * exposure, castF ) );

        // ---- lit rim: a thin white line inside silhouettes facing a lamp ----
        float rim = 0.0;
        // the gun takes the figures' rim (stronger, allowed on its top)
        float figR = max( hood, vmF );
        // (a cast figure's rim is a band a few pixels deep inside its
        // outline: the probe reaches three line widths in, so the rim is
        // not only the sliver the contour leaves between itself and 1.7)
        if ( castF > 0.5 && !sky && silFront < 0.5 ) {
          for ( int i = 0; i < 4; i ++ ) {
            vec2 o3 = dirs[ i ] * rpx * 3.4 / uRes;
            float wf3 = min( wAt( uv + o3 ), wAt( uv - o3 ) );
            silFront = max( silFront, step( 1.25, wc / max( wf3, 1e-7 ) ) );
          }
        }
        if ( !sky && silFront > 0.5 ) {
          float rimBestW = 0.0, rimBest = 0.0;
          for ( int i = 0; i < 4; i ++ ) {
            vec3 Lv = uRimLamps[ i ].xyz - vpos;
            float dl = length( Lv );
            // only the part of the silhouette that turns squarely to the lamp
            float wl = uRimLamps[ i ].w / ( 1.0 + mix( 0.015, 0.009, figR ) * dl * dl );
            float c = smoothstep( mix( 0.55, 0.3, figR ), mix( 0.85, 0.75, figR ), dot( n, Lv / dl ) ) * wl;
            rim += c;
            if ( wl > rimBestW ) { rimBestW = wl; rimBest = c; }
          }
          // a man is rimmed by the lamp he stands under (the lamp-facing half
          // of his silhouette); the other lamps only add a trace, or the rim
          // closes round him on the shadow side too like a sticker's outline
          rim = mix( rim, rimBest + 0.25 * ( rim - rimBest ), figR );
          // tops of kerbs, roofs and ledges face every lamp: an inker would
          // not rim them, only the sides of silhouettes that turn to the light
          // (a man's hat crown and shoulders are the exception: that light
          // edge is what separates him from the black behind, DESIGN.md 5.4)
          rim = smoothstep( mix( 0.35, 0.12, castF ), mix( 1.0, 0.55, castF ), rim ) * nearF * ( 1.0 - edge ) * mix( 1.0 - smoothstep( 0.5, 0.8, nW.y ), 1.0, figR )
              // (a far Hood keeps only a trace of rim: past ~10 m the rim probe
              // covers most of his body and would print him grey)
              * ( 1.0 - hood * 0.85 * smoothstep( 9.0, 20.0, dist ) );
          // a dry-brush highlight, not a CG glow outline: broken along its length
          rim *= smoothstep( 0.3, 0.5, br.g * 0.5 + br.r * 0.5 );
          // no rim beside a glare (the lamp shade is a black silhouette under its light)
          // (a cast figure is lit strongly under a pendant - its own light
          // is not a glare; only a lamp's halo beside it is)
          rim *= 1.0 - smoothstep( 0.3, 1.0, mix( glare, luma( bloom ) * exposure, castF ) );
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
        // (a smoke puff in front softens the line work behind it)
        edge *= 1.0 - 0.85 * fxCov;
        rim *= 1.0 - fxCov;
        structL *= 1.0 - fxCov;
        col = mix( col, vec3( 0.0 ), edge );
        col = max( col, vec3( structL * 0.42 ) );
        col = max( col, vec3( rim * mix( 0.72, 0.86, figR ) ) );
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
        col = mix( col, vec3( 0.42 ), haloK * ( 1.0 - fxCov ) );
        // (the fire's glow in dry-brush strokes: the strong inner part stays
        // solid, the rest of it breaks up along the brush field)
        glow *= mix( 1.0, smoothstep( b - 0.2, b + 0.2, clamp( glow * 1.1 - 0.15, 0.0, 1.0 ) ), fireGlowF );
        // (and no air-light wash over the puff's body: the occluder already
        // took the light behind it; what the blur left at its rim goes too)
        glow *= 1.0 - smoothstep( 0.35, 0.6, puffCov );
        // (fix round A2: a room's cone is light in smoky AIR: its glow is
        // laid over the surfaces behind it as a soft wash, never cut into
        // their bands - banded, every cone printed as a grey bell with a
        // stepped outline across the wall and the ceiling)
        // The ember's glow (fix round 1): a cigarette tip is a few pixels
        // across; its bloom printed as a thin WHITE ring (the paper lift-out
        // of dense air light). Keyed by its own class (idpass 10), never by
        // hue, so the fire keeps its accepted print: the bloom carries the
        // ember's share of each glow in alpha (bloom.js), and there the
        // ring becomes a warm glow as wide as the bloom.
        float emberSelf = step( 9.5, surf ) * step( surf, 10.5 );
        // (the bloom's own falloff sets the glow's width: ~7 px round a tip
        // at rest, wider on a drag)
        float emberNear = max( emberSelf, clamp( emberA / max( luma( bloom ), 1e-5 ), 0.0, 1.0 ) * smoothstep( 0.01, 0.06, emberA ) );
        if ( !sky && emberSelf < 0.5 && emberNear > 0.0 ) {
          float eg = emberNear * smoothstep( 0.015, 0.15, emberA );
          col = max( col, vec3( 1.0, 0.36, 0.07 ) * mix( 0.45, 0.9, eg ) * eg );
        }
        // (the neon's glow is its own cold blue, tight round the tube: a
        // bloom whose blue clearly leads is the sign's; every other glow is
        // white. Exactly vec3( 1 ) elsewhere.)
        // (fix round A7: only the BLOOM's share of the glow is the sign's,
        // and only where the sign's own blue is strong - close round the
        // tube. Keyed by the ratio alone, the faint blue skirt of the
        // bloom's coarse mips tinted every cone and lamp glow near the sign
        // - blue bells through the diner's glass, a blue slab of lamp light
        // beside the sign seen up the avenue.)
        float neonEx = ( bloom.b - max( bloom.r, bloom.g ) ) * exposure;
        float neonBl = smoothstep( 0.15, 0.4, ( bloom.b - max( bloom.r, bloom.g ) ) / max( bloom.b, 1e-5 ) )
                     * smoothstep( 0.015, 0.08, neonEx )
                     * clamp( luma( bloom ) / max( luma( bloom ) + luma( vol ), 1e-5 ), 0.0, 1.0 );
        vec3 glowC = mix( vec3( 1.0 ), vec3( 0.42, 0.72, 1.25 ), neonBl );
        // (round an ember its own bloom is warm: orange, hot toward the tip)
        glowC = mix( glowC, mix( vec3( 1.0, 0.34, 0.06 ), vec3( 1.0, 0.72, 0.36 ), smoothstep( 0.3, 0.8, glow ) ), emberNear * ( 1.0 - emberSelf ) );
        col = min( col + glow * glowC, vec3( 1.0 ) );
        // paper-white lift-out: where the air light is dense (a lamp's halo,
        // the hot collar under a shade) the brush leaves bare paper, with a
        // dry-brush edge instead of a smooth airbrushed falloff
        // (a room's cones are smoke lit in the air: soft, never a torn paper
        // shape laid over the wall behind them - only a lamp's own halo, the
        // bloom, lifts paper there)
        float airL = ( luma( vol ) * ( 1.0 - roomAir ) + luma( bloom ) ) * exposure;
        // Where the field dips below 0.12 this lifts paper out of NO air
        // light at all: the white dry-brush slashes of the façade and the
        // street blocks. Phase 1c: that is kept only where the wall's strokes
        // GATHER (item 6: the quiet blocks stay a flat dark-grey wash) and
        // never on the sky or the skyline (item 1: the towers carried the
        // façade's slashes); there only real air light lifts paper.
        float airA = smoothstep( 0.5, 0.95, airL );
        float slashOK = sky ? 0.0 : ( 1.0 - skyl ) * ( 1.0 - wallQuiet ) * ( 1.0 - interior );
        float paperW = smoothstep( b - 0.12, b + 0.12, airA ) * max( smoothstep( 0.0, 0.2, airA ), slashOK ) * ( 1.0 - figure ) * ( 1.0 - fxCov ) * ( 1.0 - emberNear );
        keep = max( keep, emberSelf );
        col = max( col, vec3( paperW ) );
        col = mix( col, colOut, keep );
        // (the flame's light on the skin: warm white, the flame's own accent)
        col *= mix( vec3( 1.0 ), vec3( 1.0, 0.93, 0.8 ), flameLift * 0.4 );
        // 3D rain + splash rings, screened over the ink as thin white lines at
        // the value they would print on their own (through the tone curve)
        float rainD = rain3 > 1e-5 ? toneCurve( rain3 * exposure * uRain3 ) : 0.0;
        // the gun is half a metre from the eye: the rain falls behind it, never
        // across it (streaks over the steel read as the gun behind the rain);
        // over blood the streaks thin out so a splatter never prints pink
        float rainMask = ( 1.0 - vmF ) * ( 1.0 - 0.7 * keep );
        rainD *= rainMask;
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
        rain *= uRain * 0.32 * ( mix( 0.18, 0.4, smoothstep( 0.05, 0.4, col.r ) ) + 1.4 * clamp( bl, 0.0, 1.0 ) ) * rainMask;
        col = 1.0 - ( 1.0 - col ) * ( 1.0 - rain );

        // lightning's first frame (Pipeline.kick): the print snaps to a stark
        // two-tone - mid greys jump to paper, the darks stay ink - a flash
        // bulb's one-frame inversion feel; colour (blood, fire) is left alone
        col = mix( col, mix( vec3( smoothstep( 0.1, 0.32, col.r ) ), col, keep ), uKick * 0.85 );

        // ---- paper, grain, vignette ----------------------------------------
        // paper: faint and low-frequency only; a stronger sheet texture reads
        // as a pattern glued to the lens once the player walks
        vec4 paper = texture2D( tPaper, fc / 1400.0 );
        float lum = col.r;
        col *= mix( 1.0, 0.965 + 0.045 * paper.r, smoothstep( 0.15, 0.8, lum ) );
        float grain = hash12( fc + fract( uTime * 7.13 ) * vec2( 131.0, 71.0 ) ) - 0.5;
        col += grain * 0.045 * uGrain;
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
        else if ( uView == 9 ) col = vec3( fxCov, glow, paperW );   // smoke coverage / air light / paper lift-out
        else if ( uView == 10 ) col = vec3( ( log2( max( L * exposure, 1e-6 ) ) + 6.0 ) / 10.0, luma( vol ) * exposure * 2.0, luma( bloom ) * exposure * 2.0 );   // r: log2 of the lit surface (-6 .. 4), g: air, b: halo

        gl_FragColor = vec4( clamp( col, 0.0, 1.0 ), 1.0 );
      }`,
  });
}

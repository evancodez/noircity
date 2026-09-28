import * as THREE from 'three';
import { FULLSCREEN_VERT, HASH_GLSL, LUMA_GLSL } from './common.js';
import { NOIR_FOG_GLSL } from '../fog.js';
import { TONE_GLSL, toneUniforms, EXPOSURE } from '../tone.js';
import { RAIN_SLANT } from '../textures.js';
import { FIG_ANCHOR, HOOD_ID0, HOOD_SLOTS, VM_ID0, DEBRIS_ID0, PLAYER_SLOT, HERO } from '../layers.js';

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
      uView: { value: 0 },
      // 1: the Phase 3b fast paths (bit-identical output); 0: the Phase 3a
      // path, for the in-session before/after benchmark (__noir.perfLegacy)
      uFast: { value: 1 },
      // per-Hood brush anchor (root xyz, yaw), indexed by id - HOOD_ID0
      uFigAnchor: { value: FIG_ANCHOR },
      // the player's hero key (layers.HERO): hat bone + brim radius, hat up
      // axis + on, key direction + strength
      uHero: { value: HERO },
      ...fogUniforms,
    },
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: /* glsl */`
      uniform sampler2D tScene, tBloom, tVolume, tRainBuf, tNormalId, tDepth, tBrush, tPaper, tRain, tNoise;
      uniform vec2 uRes;
      uniform float uTime, uBoil, uNear, uFar;
      uniform mat4 uProjInv, uViewInv, uProjInvVM, uVmFrame;
      uniform float uExposure, uBloomStrength, uBrush, uLineWidth, uLightning, uRain, uRain3, uKick;
      uniform vec4 uRimLamps[ 4 ];
      uniform vec4 uFigAnchor[ ${HOOD_SLOTS} ];
      uniform vec4 uHero[ 6 ];
      uniform int uView;
      uniform float uFast;
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
      vec3 viewPosVM( vec2 uv, float d ) {
        vec4 c = vec4( uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0 );
        vec4 v = uProjInvVM * c;
        return v.xyz / v.w;
      }
      // 1 for the viewmodel's ids (written negative, see layers.js)
      float isVM( float w ) {
        float f = -w - ${VM_ID0.toFixed(1)};
        return step( -0.5, f ) * step( f, 9.5 );
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

      // 1 for the player's own ids (his body and the gun's parts)
      float isHeroId( float w ) {
        float f = -w - ${(HOOD_ID0 + PLAYER_SLOT.low).toFixed(1)};
        return step( -0.5, f ) * step( f, ${(HOOD_SLOTS - 1 - PLAYER_SLOT.low + 0.5).toFixed(1)} );
      }

      void main() {
        vec2 uv = vUv;
        vec2 fc = gl_FragCoord.xy;

        vec4 nid = texture2D( tNormalId, uv );
        float d = texture2D( tDepth, uv ).r;
        bool sky = d >= 0.999999;
        // the viewmodel was drawn by its own camera (same eye, narrower FOV)
        float vmF = isVM( nid.w );
        vec3 vpos = vmF > 0.5 ? viewPosVM( uv, d ) : viewPos( uv, d );
        float dist = sky ? uFar : length( vpos );
        vec3 wpos = ( uViewInv * vec4( vpos, 1.0 ) ).xyz;
        float fogA = sky ? 1.0 : noirFogAmount( dist, wpos.y, uFogDensity );
        float nearF = 1.0 - fogA;

        vec3 hdr = texture2D( tScene, uv ).rgb;
        vec3 bloom = texture2D( tBloom, uv ).rgb * uBloomStrength;
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
          bpos = vec3( ca * q.x - sa * q.z, q.y, sa * q.x + ca * q.z ) + vec3( float( slot ) * 7.31, float( slot ) * 1.9, float( slot ) * 3.77 );
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
        // The hero (Phase 3c): the player's own body, hat, head and Tommy gun,
        // seen from half a metre in the over-the-shoulder frame. The Hoods'
        // treatment (the figure ceiling, the band quantiser) printed him as a
        // glossy mannequin: smooth grey gradients across the shoulder, the
        // collar and the skull. Like the reference's foreground shooter he is
        // now a BLACK MASS with sparse ragged dry-brush ticks: the light that
        // falls on him is cut to TWO levels - lit or not - and where it is lit
        // a coarse stroke field (~900 px tiles, world-scaled and riding on the
        // body) at a fixed threshold prints paper-grey ticks; unlit, only the
        // odd faint mark. No gradient survives: the tone of a tick is the
        // stroke's own value, never the light's. The key is the scene's own
        // light for the coat and the gun (PlayerBody's material key, the
        // lamps, the flash) and, for the head, the hat and the gun, the ink's
        // world key (uHero[2], mostly from above: the crown, the brim's top,
        // the ear, the receiver's top). The ribbon stays a black band with a
        // broken light top edge, the brim's rim a heavy ink line. Applied
        // after the band quantiser (below), in place of it.
        float heroEarLit = 0.0, heroGun = 0.0, heroFins = 0.0;
        float heroM = 0.0, heroV = 0.0, heroLine = 0.0, heroRimK = 1.0, heroBreak = 0.0, heroHead = 0.0, heroHard = 0.0;
        if ( hood > 0.5 && fidH > ${(PLAYER_SLOT.low - 0.5).toFixed(1)} && uHero[ 1 ].w > 0.5 ) {
          // his parts, by id (layers.PLAYER_SLOT): the coat-and-hat body, the
          // gun's four pieces, the ears, the left glove
          float slotH = floor( fidH + 0.5 );
          float gunF = step( ${(PLAYER_SLOT.sight - 0.5).toFixed(1)}, slotH ) * step( slotH, ${(PLAYER_SLOT.gun + 0.5).toFixed(1)} );
          float earP = 1.0 - step( 0.5, abs( slotH - ${PLAYER_SLOT.ear.toFixed(1)} ) );
          float handP = 1.0 - step( 0.5, abs( slotH - ${PLAYER_SLOT.hand.toFixed(1)} ) );
          float bodyP = 1.0 - step( 0.5, abs( slotH - ${PLAYER_SLOT.body.toFixed(1)} ) );
          heroGun = gunF;
          heroFins = 1.0 - step( 0.5, abs( slotH - ${PLAYER_SLOT.fins.toFixed(1)} ) );
          // (the steel and the glove: flat faces, the triplanar field)
          float hardF = max( gunF, handP );
          heroHard = hardF;
          heroM = nearF * ( 1.0 - smoothstep( 3.0, 6.0, dist ) );
          if ( heroM > 0.0 ) {
            vec3 hq = wpos - uHero[ 0 ].xyz;
            float hh = dot( hq, uHero[ 1 ].xyz );                  // height above the brim plane
            float hx = dot( hq, uHero[ 3 ].xyz );
            float hz = length( hq - hh * uHero[ 1 ].xyz - hx * uHero[ 3 ].xyz );
            float hr = length( vec2( hx / 0.9, hz ) );              // off the crown's axis (the brim's oval)
            float onHat = bodyP * step( -0.05, hh ) * step( hr, uHero[ 0 ].w + 0.02 );
            float band = onHat * smoothstep( 0.008, 0.013, hh ) * ( 1.0 - smoothstep( 0.034, 0.039, hh ) ) * step( hr, 0.125 );
            float brimEdge = onHat * smoothstep( uHero[ 0 ].w - 0.014, uHero[ 0 ].w - 0.007, hr ) * step( hh, 0.03 );
            // the hat: above the brim plane, or the brim's snapped front
            // just below it
            float hatPx = onHat * max( step( 0.0, hh ), step( -0.035, hh ) * step( 0.097, hr ) );
            // the head under it: the skull, the face and the jaw, and the
            // neck down inside the collar (the collar itself is coat)
            // (Phase 3c review: the skull is the head's own ellipsoid in the
            // hat's frame - bind centre 5.5 cm under the brim plane, 1.8 cm
            // forward - and the neck a column round its axis; a cylinder of
            // 0.13 m round the hat's axis took in the turned-up collar's
            // back, and the collar printed as part of the head: a black
            // column with the skull on top, cut flat by the coat)
            vec3 hZ = normalize( cross( uHero[ 3 ].xyz, uHero[ 1 ].xyz ) );   // the hat's front
            float hzF = dot( hq, hZ );
            float eH = length( vec3( hx / 0.08, ( hh + 0.055 ) / 0.103, ( hzF - 0.018 ) / 0.097 ) );
            vec3 nq = wpos - uHero[ 4 ].xyz;
            float nt = dot( nq, uHero[ 5 ].xyz );
            float neckR = length( nq - nt * uHero[ 5 ].xyz );
            // (the skull's surface sits at eH 0.94 - 1.1: fuller at the upper
            // back, tucked in at the nape, where the collar's back comes up
            // to eH ~1.08 once the head drops onto the stock - so the margin
            // closes toward the nape)
            float headOnly = bodyP * ( 1.0 - hatPx ) * max( step( eH, mix( 1.03, 1.14, smoothstep( -0.1, -0.04, hh ) ) ), step( -0.04, nt ) * step( nt, 0.2 ) * step( neckR, 0.058 ) );
            heroHead = headOnly;
            // the coarse stroke field. On the cloth and the felt it is laid
            // in ONE direction, like an inker's hand: projected on the body's
            // frontal plane (the body frame, riding on him), on the plane
            // under it where the surface faces up (the shoulders' tops, the
            // crown, the brim) - triplanar, a curved sleeve turned the strokes
            // into blobs that followed its curvature like a highlight on
            // vinyl. The steel and the glove keep the triplanar field.
            float upP = smoothstep( 0.55, 0.85, abs( nBr.y ) );
            vec3 nProj = mix( vec3( 0.0, upP, 1.0 - upP ), nBr, hardF );
            vec3 brH = brushWorld( bpos, nProj, dist, 900.0, 0.53 );
            float bs = mix( brH.r, brH.b, upP * ( 1.0 - hardF ) );
            // (a fine octave of the field - ~220 px tiles - tears the small
            // shapes' edges: the ear's C, the cheek's plane, the glove's lit
            // plane; at the coarse tiles they were smooth ruled curves)
            vec3 brF = brushWorld( bpos, nBr, dist, 220.0, 0.43 );
            // the key: the ink's own (ahead, right, above) and the scene's
            // light (the material key from behind-left, the lamps, the
            // flash) - the scene's only on the coat, the gun and the glove:
            // on the felt, the hair and the skin it printed as wet latex
            float kInk = max( dot( nW, uHero[ 2 ].xyz ), 0.0 ) * uHero[ 2 ].w;
            float softP = max( max( hatPx, headOnly ), earP );
            float kScn = smoothstep( 0.05, 0.12, vRaw ) * ( 1.0 - softP );
            float kR = max( kInk * kInk * 1.25, kScn );
            // (blued steel is black: the scene's light washes the coat and the
            // glove, on the gun it only raises ticks - washed, the receiver
            // printed as the same grey cloth as the sleeve over it)
            float kW = max( kInk * kInk * 1.25, kScn * ( 1.0 - gunF ) );
            // (the glove on the foregrip sits under the barrel, out of the
            // ink's key: it takes a key of its own from over the lens's right
            // shoulder - view space - so its knuckles print as a fist)
            float kHand = handP * max( dot( n, vec3( 0.49, 0.7, 0.52 ) ), 0.0 );
            kR = max( kR, kHand * kHand * 1.2 );
            kW = max( kW, kHand * kHand * 1.2 );
            // ... cut to TWO lit levels over the black, like the reference's
            // coat: a flat dark-grey wash where the light falls, its edge the
            // stroke field itself (the cut is thresholded against it, so the
            // wash ends in long tapered brush swooshes, never a smooth
            // terminator), and where the light is strongest sparse white
            // ticks - the strokes above a fixed threshold of a second family
            // (the steel a little fuller, so the receiver's top and the
            // drum's rim read as light edges). The felt, the hair and the
            // ear take no wash: a black hat on a black head, cut by ticks.
            // (Phase 3c review: the wash's cut on the 900 px field alone was too
            // low-frequency to break a plate - the lit shoulder printed as one
            // flat grey plate, a latex bag. A second family, ~480 px tiles
            // stretched 4:1 - strokes ~1900 px long - along the sleeve's fold
            // line (uHero[4].w, the upper arm's heading in the body's frontal
            // plane), tears it into long tapered fold strokes, like the
            // reference's coat)
            vec2 fd = vec2( cos( uHero[ 4 ].w ), sin( uHero[ 4 ].w ) );
            vec3 fp = vec3( dot( bpos.xy, fd ) * 0.25, dot( bpos.xy, vec2( -fd.y, fd.x ) ), bpos.z );
            // (one call serves both fold families - the wash's tear in .g and
            // the ticks' swooshes in .r: ~480 px tiles, strokes ~1900 px long)
            vec3 brFold = brushWorld( fp, nProj, dist, 480.0, 0.61 );
            float fold = brFold.g;
            float foldK = ( 1.0 - hardF ) * ( 1.0 - softP );
            float wash = step( mix( 0.42, 0.6, gunF ), kW + ( bs - 0.5 ) * mix( 0.75, 0.4, foldK ) + ( fold - 0.5 ) * 1.1 * foldK ) * ( 1.0 - softP );
            float thT = mix( 0.62, 0.45, hardF );
            // (the ticks from a coarser octave still: fewer, longer, bolder
            // marks - at the wash's scale they printed as a pelt of short
            // hairs on the lit shoulder)
            // (Phase 3c review: on the coat the ticks ride the fold family too -
            // stretched 4:1 along the sleeve's fold line - so the
            // light that tears the wash is long tapered swooshes down the
            // sleeve and the back, not round flecks; the felt and the head
            // keep the isotropic octave)
            float btIso = brushWorld( bpos, nProj, dist, 1500.0, 0.21 ).r;
            float btFold = brFold.r;
            float bt = mix( mix( btIso, btFold, foldK ), brH.r, hardF );
            // (the glove: its knuckles catch the flash and the key a little
            // more readily - the hand must read on the foregrip)
            float tick = step( mix( 0.84, 0.55, handP ), kR + ( brH.g - 0.5 ) * 0.35 ) * smoothstep( thT, thT + 0.03, bt );
            // (cloth turning away from the eye takes no ticks: projected on
            // the body's plane there the strokes crowd into a pelt of short
            // parallel hairs along the silhouette)
            float grazeH = 1.0 - abs( dot( n, normalize( -vpos ) ) );
            tick *= mix( 1.0 - smoothstep( 0.55, 0.7, grazeH ), 1.0, hardF );
            // the steel (Phase 3c review): FLAT BLACK, drawn by a few clean
            // light edges like the reference's Tommy gun - the tick field on
            // its faces printed as pixel-scale specular sparkle, a CG normal
            // map. Only the planes that face the sky - the receiver's top rib,
            // the drum's rim - take the paper ink, cut into long dashes by the
            // coarse field; its creases and its silhouette are the light
            // lines (below)
            // (the steel only: the walnut stock behind the receiver - gun-
            // local z past ~6.6 cm, the gun's own brush frame less its slot
            // offset - has a 3.6 cm flat comb that printed as a paper plank
            // along the whole arm; it keeps its silhouette line alone)
            float gunZ = bpos.z - slotH * 3.77;
            // (nor the fins: their crowns a pixel or two apart printed as a
            // checker of specks; the finned barrel is black under its one
            // light silhouette line)
            tick = mix( tick, step( 0.85, nW.y ) * smoothstep( 0.3, 0.34, bt ) * step( gunZ, 0.066 ) * ( 1.0 - heroFins ), gunF );
            wash *= 1.0 - gunF;
            // the hat is black felt: where the key is square on the crown's
            // side it takes a lit plane of white strokes with a ragged edge,
            // like the reference's crown
            // (Phase 3c review: where the felt turns away from the eye - the
            // crown's silhouette - its ticks are dashes only, a third of the
            // edge at most: at the coarse field's scale they ran unbroken
            // round the crown, the one continuous light edge left on him, a
            // CG outline; the same dash breaks the lamp rim, heroRimK below)
            float hatDash = step( 0.75, mix( brH.r, brF.r, 0.6 ) );
            tick = mix( tick, step( 0.72, kR + ( brH.g - 0.5 ) * 0.45 ) * smoothstep( 0.5, 0.54, bt ) * mix( 1.0, hatDash, smoothstep( 0.5, 0.65, grazeH ) ), hatPx );
            // the skull is a black mass of hair (its only light the broken
            // lost-profile edge below)
            tick *= 1.0 - headOnly;
            // the ear: bare skin, cut out of the skull by its own contour - a
            // BUMP on the black mass, never a pale disc: a dark bowl, and a C
            // of light along its rolled rim, where it turns from the eye
            float grazeE = 1.0 - abs( dot( n, normalize( -vpos ) ) );
            // (Phase 3c review: cut at 0.78 - only the rolled rim, the true
            // silhouette band, takes the light; at 0.45 most of the shell
            // passed and the ear printed as a pale glowing button. The rim
            // there turns from the key - the key's test left it dark and the
            // shell printed as a hole - so the C is the rim's back and top,
            // open toward the face: the helix, never a ring)
            // (the rim band by position on the shell - its outer third, in
            // the hat's frame, bind centre 5.8 cm under the brim plane and
            // 0.8 cm behind the hat's axis - as well as by the grazing
            // normal: the shell is 1 cm thick and its grazing band alone was
            // a one-pixel dotted line)
            vec2 eq = vec2( ( hh + 0.058 ) / 0.024, ( hzF + 0.008 ) / 0.0125 );
            float earR = length( eq );
            // (tapered: full at the back of the helix, thinning to nothing
            // toward its two ends by the face)
            float earTaper = smoothstep( -0.5, 0.45, eq.y / max( earR, 1e-3 ) );
            float earC = min( 1.0, step( hzF, -0.01 ) + step( -0.046, hh ) );
            float earLit = earC * max( step( 0.78 + 0.18 * earTaper, grazeE + ( brF.g - 0.5 ) * 0.2 ), step( 0.8 + 0.16 * earTaper, earR + ( brF.g - 0.5 ) * 0.34 ) );
            tick = mix( tick, earLit, earP );
            heroEarLit = earP * earLit;
            // (the tick's tone is one of two inks, never the brush field's own
            // value: magnified to these tiles the field is smooth, and a tone
            // that followed it printed every tick as a little gradient)
            // (the ear's rim never takes the paper-white ink: a C of 0.64)
            float tone = mix( mix( mix( 0.64, 0.86, step( 0.8, bt ) ), 0.64, earP ), 0.86, gunF );
            // the felt: where the key is square on the crown's side and the
            // brim's top, a flat dark-grey plane with a ragged brush edge
            // (the reference's crown), the white strokes only at its heart
            float hatWash = hatPx * ( 1.0 - band ) * step( 0.5, kR + ( bs - 0.5 ) * 0.6 );
            heroV = max( max( wash * 0.12, hatWash * 0.26 ), tick * tone );
            // the glove on the foregrip (Phase 3c review): a FIST, not a few
            // ticks on a black blob - the planes that face up in the view
            // (the back of the hand, the knuckles' tops) a flat 0.64 plane,
            // its edge torn by the fine field, and paper-white ticks only on
            // the top two knuckles
            // (the glove's own key, over the lens's right shoulder in view
            // space: from here the fist shows its side and its knuckles,
            // barely its top)
            float gloveK = dot( n, vec3( 0.49, 0.7, 0.52 ) ) + ( brF.r - 0.5 ) * 0.3;
            float glove = step( 0.58, gloveK + ( brF.g - 0.5 ) * 0.25 ) * 0.64;
            glove = max( glove, step( 0.45, n.y + ( brF.g - 0.5 ) * 0.3 ) * step( 0.5, gloveK ) * smoothstep( 0.4, 0.45, brF.b ) * 0.86 );
            // (the gaps between the four fingers: dark hatch lines across
            // the bore - the glove rides on the gun's brush frame - ~1.9 cm
            // apart, so the lit plane reads as a closed fist, not a ball)
            float fing = fract( ( bpos.z - slotH * 3.77 ) / 0.019 + 0.35 );
            glove *= step( 0.2, fing + ( brF.r - 0.5 ) * 0.12 );
            heroV = mix( heroV, glove, handP );
            // (the shell's bowl: barely off the black - at 0.3 the whole shell
            // printed as a lit disc)
            heroV = max( heroV, earP * 0.1 * step( 0.38, bs ) * step( 0.35, kInk + ( brH.g - 0.5 ) * 0.5 ) );
            // the hair: a black mass, dark-grey strands combed back over the
            // skull (the reference's shooter has hair, not a black egg)
            // (Phase 3c review: only at the nape - the hairline between the
            // skull and the neck - and along the silhouette on the lens's
            // side, from the plain field at a higher cut: stretched along the
            // body's up axis over the whole skull, the strands printed as the
            // regular vertical bars of a ribbed helmet)
            float graze = 1.0 - abs( dot( n, normalize( -vpos ) ) );
            float nape = step( -0.15, hh ) * step( hh, -0.09 );
            float silB = step( 0.62, graze + ( bt - 0.5 ) * 0.2 ) * step( -0.12, hh ) * step( 0.1, kInk + ( bt - 0.5 ) * 0.3 );
            // (the fine octave's third channel: the glove takes it for its
            // knuckles, the head - other pixels - for its strands)
            float strands = step( 0.72, brF.b );
            heroV = max( heroV, headOnly * 0.15 * max( nape, silB ) * strands );
            // the face in lost profile: past the ear - forward of it, on the
            // ear's side of the head (the camera is always over his right
            // shoulder: -x in the hat's frame) - the temple, the cheek and the
            // jaw turned away from the eye, a flat grey plane whose edge the
            // stroke field tears, a few lighter ticks inside: the head turned
            // away, not a black hood with a hole for the ear
            float past = smoothstep( 0.0, 0.03, hzF ) + ( bs - 0.5 ) * 0.3 + ( brF.r - 0.5 ) * 0.5;
            float cheek = headOnly * step( hx, -0.03 ) * step( 0.5, past ) * step( -0.12, hh ) * step( hh, -0.03 );
            heroV = max( heroV, cheek * mix( 0.3, 0.64, step( 0.78, bt ) ) );
            // the head: a broken light edge where it turns away from the eye
            // on the key's side - the jaw, the cheek in lost profile, the
            // side of the neck - ticks of the same field, never a rim
            vec3 kH0 = normalize( vec3( uHero[ 2 ].x, 0.0, uHero[ 2 ].z ) + 1e-4 );
            float edgeLit = headOnly * step( 0.8, graze + ( brH.g - 0.5 ) * 0.2 ) * step( 0.2, dot( nW, kH0 ) );
            heroV = max( heroV, edgeLit * smoothstep( 0.56, 0.6, bt ) * tone );
            // the ribbon: a black band, its top edge a broken light line
            heroV *= 1.0 - band;
            float bandTop = onHat * smoothstep( 0.030, 0.033, hh ) * ( 1.0 - smoothstep( 0.0355, 0.039, hh ) ) * step( hr, 0.125 );
            heroV = max( heroV, bandTop * 0.6 * smoothstep( 0.45, 0.5, bs ) * smoothstep( -0.2, 0.3, dot( nW, kH0 ) ) );
            // the brim's outer edge: a light line where it turns to the key
            // (the reference's brim is drawn by that one catch-light), a
            // heavy ink line where it does not
            float brimLit = brimEdge * step( 0.25, dot( nW, kH0 ) + ( brH.g - 0.5 ) * 0.3 );
            // (broken into dashes too - about half of it - so the brim's
            // catch-light is a dry-brush line, not a ruled one)
            heroV = max( heroV, brimLit * smoothstep( 0.46, 0.5, bs ) * step( 0.55, mix( brH.r, brF.r, 0.6 ) ) * tone );
            heroLine = heroM * brimEdge * ( 1.0 - brimLit ) * smoothstep( 0.3, 0.5, br.g * 0.5 + br.r * 0.5 );
            // the lamp rim and the crease highlights on him: ticks too
            // (on the cloth only the strongest strokes: a lamp rim along his
            // collar and shoulders read as a CG outline)
            heroRimK = mix( 1.0, smoothstep( mix( 0.68, 0.6, hardF ), mix( 0.71, 0.64, hardF ), brH.r ), heroM );
            // (Phase 3c review: on the hat, dashes only - at most a third of the
            // crown's and the brim's lamp rim survives, as broken ticks like the
            // ribbon's top edge; the one continuous light edge left on him
            // read as a CG outline round the felt)
            heroRimK = mix( heroRimK, hatDash, hatPx );
            // (his light lines: ~half of each line survives, in dashes)
            // (his light lines: about a third of each line survives, in
            // ragged dashes - a continuous light edge is a CG rim)
            // (the steel's edges hold longer: machined, not cloth)
            // (Phase 3c review: 0.47 -> 0.3 on the steel - most of each of its
            // few light lines survives, as long dashes)
            heroBreak = step( mix( 0.6, 0.3, gunF ), br.r * 0.4 + brH.g * 0.6 );
          }
        }
        // the gun: black steel and dark wood; lamp light and the muzzle flash
        // raise dry-brush greys on it (never a white plate)
        // (ceiling ~0.28: at 0.5 the stock lit by the key light printed as a
        // pale flat slab beside the camera.) The walnut (stock, grips) is
        // broken by the brush field in the gun's own frame, so it reads as
        // dry-brushed dark wood with strokes along it, not a painted plank.
        if ( vmF > 0.5 ) {
          float ceilG = 0.28;
          v = ceilG * ( 1.0 - exp( -v / ceilG ) );
          float vmPart = -idc - ${VM_ID0.toFixed(1)};
          float woodF = step( 1.5, vmPart ) * step( vmPart, 2.5 );
          v *= mix( 1.0, mix( 0.35, 1.45, smoothstep( 0.25, 0.75, br.g * 0.6 + br.r * 0.4 ) ), woodF );
        }
        // A muzzle flash sprite drawn in front of a man or of the gun is not
        // his cloth or its steel: it is far brighter than anything they can
        // reflect (lit cloth < ~0.7, the sprite ~3), so it keeps its own
        // tone instead of being held under their ceilings. (Crushed, a
        // Hood's flash printed as black behind his head and the player's
        // core vanished into the compensator.)
        float flashF = max( hood, vmF ) * smoothstep( 1.1, 2.2, L );
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
          v += lift * ( 1.0 - smoothstep( 0.06, 0.10, v ) ) * ( 1.0 - wallQuiet ) * ( 1.0 - fxCov );
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
        // smoke is a soft wash with its own brushed alpha (fx/fxTextures
        // SMOKE): banded by the surface behind it, its tone stepped at every
        // tower and wall edge it drifted across
        brushAmt *= 1.0 - fxCov;
        v = mix( v, vBand, brushAmt );
        // (the muzzle puff: its tone laid in the ink's flat bands, their
        // edges broken by the brush field - a brushed puff with a darker core,
        // not a soft gradient blob)
        v = mix( v, inkBands( v, b, 4.0 ), smoothstep( 0.35, 0.6, puffCov ) );
        // the sky gets only a whisper of horizontal wash; fogged towers a
        // little vertical dry-brush (the far street keeps horizontal)
        v += sky ? ( br.b - 0.5 ) * 0.012 : ( mix( br.g, br.b, wH ) - 0.5 ) * 0.03 * fogA * ( 1.0 - skyl );
        // the hero: his two-level ticks in place of the bands (the flash
        // sprite and smoke in front of him keep their own tone)
        heroM *= ( 1.0 - flashF ) * ( 1.0 - fxCov );
        v = mix( v, heroV, heroM );

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
        float wcl = wAt( uvL );
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
          // (between two of the hero's own ids - the drum, the barrel, the
          // sights, the receiver, his coat - the part in front need only be
          // ~1.5 % nearer: at half a metre 15 % is 7 cm, and the drum on the
          // receiver never drew its trap)
          float hc = isHeroId( cN.w );
          float h1 = isHood( n1.w ) * step( 0.5, abs( n1.w - cN.w ) ) * step( wcl * ( 1.15 - 0.135 * hc * isHeroId( n1.w ) ) + 1e-6, w1 );
          float h2 = isHood( n2.w ) * step( 0.5, abs( n2.w - cN.w ) ) * step( wcl * ( 1.15 - 0.135 * hc * isHeroId( n2.w ) ) + 1e-6, w2 );
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
        edge *= 1.0 - smoothstep( 0.6, 2.0, glare );

        // ---- lit rim: a thin white line inside silhouettes facing a lamp ----
        float rim = 0.0;
        // the gun takes the figures' rim (stronger, allowed on its top)
        float figR = max( hood, vmF );
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
          rim = smoothstep( 0.35, 1.0, rim ) * nearF * ( 1.0 - edge ) * mix( 1.0 - smoothstep( 0.5, 0.8, nW.y ), 1.0, figR )
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
        // (a smoke puff in front softens the line work behind it)
        edge *= 1.0 - 0.85 * fxCov;
        rim *= ( 1.0 - fxCov ) * heroRimK;
        structL *= ( 1.0 - fxCov ) * heroRimK;
        // (on the hero the lamp rim and the structure lines are ticks of one
        // ink, not a smooth falloff: a graded rim printed as a gloss band)
        rim = mix( rim, 0.9 * step( 0.45, rim ), step( 0.5, heroM ) );
        structL = mix( structL, 1.6 * step( 0.3, structL ), step( 0.5, heroM ) );
        // (the ear's lit rim is drawn INSTEAD of its contour: the id line
        // round the shell ran exactly along the rim band and ate it)
        col = mix( col, vec3( 0.0 ), max( edge * ( 1.0 - heroEarLit * step( 0.5, heroM ) ), heroLine ) );
        col = max( col, vec3( structL * 0.42 ) );
        col = max( col, vec3( rim * mix( 0.72, 0.86, figR ) ) );
        // black on black: behind a Hood's silhouette the dark object (a car,
        // a column, another man) is cut back by a thin broken paper gap, the
        // inker's trapping line, instead of a black contour nobody can see
        // (a man behind another man gets it too: ids differ per Hood, so a
        // Hood never haloes against his own body)
        // (the hero is judged by his own two-level tone: his lit wash is a
        // dark mass for the trap, whatever the scene's light on him was)
        float haloK = halo * ( 1.0 - smoothstep( 0.1, 0.22, mix( vSmooth, heroV, heroM ) ) ) * nearF
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
          // (no paper trap round the hero's ear: outlined, the shell printed
          // as a disc stuck on the skull - its lit rim alone draws it)
          float haloId = texture2D( tNormalId, haloUV ).w;
          haloK *= 1.0 - step( abs( -haloId - ${(HOOD_ID0 + PLAYER_SLOT.ear).toFixed(1)} ), 0.5 );
        }
        col = mix( col, vec3( 0.42 ), haloK * ( 1.0 - fxCov ) );
        // The hero's own line work (Phase 3c): black steel on a black coat is
        // drawn, like the reference's Tommy gun, by broken LIGHT lines where
        // an edge turns to the key - the creases (the receiver's corners, the
        // fins, the drum's rims, the sight, a sleeve's folds) and his
        // silhouette on the key's side - never a continuous band: the tick
        // field breaks them along their length
        if ( heroM > 0.0 ) {
          float kLine = smoothstep( 0.2, 0.5, dot( nW, uHero[ 2 ].xyz ) );
          // (the steel and the glove only: on the coat and the collar the
          // light edge printed as a continuous CG rim; the cloth is drawn by
          // its wash and ticks alone, like the reference's coat)
          // (the fins take none: their thirteen crease pairs printed as a
          // pelt of white specks - their hatch is the light crowns on the
          // barrel's top and the dark flanks between them; the steel's
          // lines at full paper, 1.0)
          float crease = edgeN * ( 1.0 - edgeId ) * kLine * heroHard * ( 1.0 - heroFins );
          float silK = silFront * kLine * heroHard;
          col = max( col, vec3( max( crease, silK ) * heroBreak * mix( 0.82, 1.0, heroGun ) * heroM * ( 1.0 - fxCov ) ) );
        }
        // (the fire's glow in dry-brush strokes: the strong inner part stays
        // solid, the rest of it breaks up along the brush field)
        glow *= mix( 1.0, smoothstep( b - 0.2, b + 0.2, clamp( glow * 1.1 - 0.15, 0.0, 1.0 ) ), fireGlowF );
        // (no air-light wash over the hero: a smooth glow on his black mass
        // is exactly the gradient band he must not carry)
        glow *= 1.0 - heroM;
        // (and no air-light wash over the puff's body: the occluder already
        // took the light behind it; what the blur left at its rim goes too)
        glow *= 1.0 - smoothstep( 0.35, 0.6, puffCov );
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
        float paperW = smoothstep( b - 0.12, b + 0.12, airA ) * max( smoothstep( 0.0, 0.2, airA ), slashOK ) * ( 1.0 - figure ) * ( 1.0 - fxCov );
        col = max( col, vec3( paperW ) );
        col = mix( col, colOut, keep );
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
        else if ( uView == 9 ) col = vec3( fxCov, glow, paperW );   // smoke coverage / air light / paper lift-out
        else if ( uView == 10 ) col = vec3( heroV, heroM * 0.5, heroHead );   // the hero's ticks / his mask / his head

        gl_FragColor = vec4( clamp( col, 0.0, 1.0 ), 1.0 );
      }`,
  });
}

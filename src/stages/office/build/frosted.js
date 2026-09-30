import * as THREE from 'three';

// Frosted glass with a name on it, lit from behind, and the shadows of the
// men who stand behind it (the oldest shot of the genre: a shape on the
// glass of the door). The pane glows with the light of the side it is lit
// from (a corridor's lamp, a room's); a figure between that lamp and the
// glass throws his outline onto it: every joint of his (head, hat, chest,
// hips, hands) is projected from the lamp onto the pane's plane and drawn
// there as soft capsules - sharp where he stands close to the glass, a
// grey blur where he stands back. The lettering is a canvas (gilt: pale
// letters with a dark edge, read the right way round from the corridor).
//
//   const m = makeFrosted({ w, h, text: ['AMES', 'BOOKKEEPING'], lit: 'back' | 'front' })
//   m.userData.setFrame(centre, U, V, N)    the pane's world frame (u across, v up, n toward the room)
//   m.userData.setLamp(pos, k)              the light behind it (world), its strength
//   m.userData.figures = [{ joints: () => [...Vector3 x 7], k: 0..1 }]  up to 3 men
//   m.userData.glow(front, back)            the pane's own brightness seen from each side
// (u, v are metres from the pane's centre; the material is on the world
// layer: the ink sees a surface, not the corridor behind it)
const MAXF = 3, NJ = 7;   // joints: head, hatTop, chest, hips, handR, handL, knee

function letterCanvas(lines, w, h) {
  const S = 512, c = document.createElement('canvas');
  c.width = S; c.height = Math.round(S * h / w);
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  if (!lines || !lines.length) return c;
  const n = lines.length;
  lines.forEach((ln, i) => {
    const big = i === 0;
    const px = big ? Math.min(78, (S * 0.84) / Math.max(4, ln.length * 0.64)) : Math.min(40, (S * 0.84) / Math.max(4, ln.length * 0.62));
    g.font = `bold ${Math.round(px)}px Georgia, 'Times New Roman', serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const y = c.height * (0.34 + i * (0.36 / Math.max(1, n - 1)));
    // (gilt: a dark keyline, then the pale letter a hair up-left of it)
    g.lineWidth = Math.max(2, px * 0.09); g.strokeStyle = 'rgba(0,0,0,1)';
    g.strokeText(ln, S / 2, y);
    g.fillStyle = 'rgba(255,255,255,1)';
    g.fillText(ln, S / 2, y);
  });
  return c;
}

export function makeFrosted({ w = 1, h = 1, text = null, lit = 'back', seed = 0 } = {}) {
  const tex = new THREE.CanvasTexture(letterCanvas(text, w, h));
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 4;
  const U = {
    uC: { value: new THREE.Vector3() }, uU: { value: new THREE.Vector3(1, 0, 0) }, uV: { value: new THREE.Vector3(0, 1, 0) }, uN: { value: new THREE.Vector3(0, 0, 1) },
    uWH: { value: new THREE.Vector2(w, h) },
    uLamp: { value: new THREE.Vector3(0, 3, 0) }, uLampK: { value: 1 }, uSrc: { value: new THREE.Vector3(0, 1.5, 0) },
    uGlowF: { value: 0.2 }, uGlowB: { value: 1.0 },
    uJ: { value: Array.from({ length: MAXF * NJ }, () => new THREE.Vector3(0, -99, 0)) },
    uFK: { value: new Array(MAXF).fill(0) },
    tText: { value: tex }, uText: { value: text ? 1 : 0 },
    uSeed: { value: seed },
    uHole: { value: 0 },
    // (a cloth's holes: a mask canvas, black where a round went through; a flash behind it)
    tHoles: { value: null }, uHoles: { value: 0 }, uSrcD: { value: 1.25 },
    uFl: { value: new THREE.Vector3(0, -99, 0) }, uFlK: { value: 0 },
    // (round 2: a pane lit as the diner's lamps light things - a hot corner
    // toward its lamp, falling off into grey: uFall 1; 0 is the first
    // version's even glow. uRect: the part of it with light behind it (a
    // curtain over a window: the window's rectangle, in metres from its centre))
    uFall: { value: 0 }, uFallK: { value: new THREE.Vector4(0.012, 0.0, 1.3, 1.0) },
    uRect: { value: new THREE.Vector4(-1e3, -1e3, 1e3, 1e3) },
  };
  const m = new THREE.ShaderMaterial({
    name: 'OfficeFrosted',
    side: THREE.DoubleSide,
    uniforms: U,
    vertexShader: /* glsl */`
      varying vec3 vW;
      void main() {
        vec4 wp = modelMatrix * vec4( position, 1.0 );
        vW = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uC, uU, uV, uN, uLamp, uSrc;
      uniform vec2 uWH;
      uniform float uLampK, uGlowF, uGlowB, uText, uSeed;
      uniform vec3 uJ[ ${MAXF * NJ} ];
      uniform float uFK[ ${MAXF} ];
      uniform sampler2D tText;
      uniform sampler2D tHoles;
      uniform float uHoles, uFlK, uSrcD;
      uniform vec3 uFl;
      uniform float uFall;
      uniform vec4 uFallK, uRect;
      varying vec3 vW;
      // (the lamp's projection of a world point onto the pane: its u, v and
      // how far it stands off the glass)
      // (the shadows are thrown from uSrc: the corridor's light as it falls
      // on a man's back, low and behind him - a ceiling lamp over his head
      // would drop his outline to the glass's foot)
      vec3 proj( vec3 P ) {
        vec3 L = uSrc;
        float den = dot( P - L, uN );
        float t = abs( den ) < 1e-4 ? 1.0 : dot( uC - L, uN ) / den;
        vec3 Q = L + ( P - L ) * max( t, 0.0 );
        return vec3( dot( Q - uC, uU ), dot( Q - uC, uV ), abs( dot( P - uC, uN ) ) );
      }
      float segD( vec2 p, vec2 a, vec2 b ) {
        vec2 pa = p - a, ba = b - a;
        float h = clamp( dot( pa, ba ) / max( dot( ba, ba ), 1e-6 ), 0.0, 1.0 );
        return length( pa - ba * h );
      }
      float sdBox2( vec2 p, vec2 b ) { vec2 d = abs( p ) - b; return length( max( d, 0.0 ) ) + min( max( d.x, d.y ), 0.0 ); }
      // (a trapezoid standing on y: r1 the half-width at its foot, r2 at its top, he its half-height)
      float sdTrap( vec2 p, float r1, float r2, float he ) {
        vec2 k1 = vec2( r2, he ), k2 = vec2( r2 - r1, 2.0 * he );
        p.x = abs( p.x );
        vec2 ca = vec2( p.x - min( p.x, ( p.y < 0.0 ) ? r1 : r2 ), abs( p.y ) - he );
        vec2 cb = p - k1 + k2 * clamp( dot( k1 - p, k2 ) / dot( k2, k2 ), 0.0, 1.0 );
        float s = ( cb.x < 0.0 && ca.y < 0.0 ) ? -1.0 : 1.0;
        return s * sqrt( min( dot( ca, ca ), dot( cb, cb ) ) );
      }
      float smin( float a, float b, float k ) { float h = clamp( 0.5 + 0.5 * ( b - a ) / k, 0.0, 1.0 ); return mix( b, a, h ) - k * h * ( 1.0 - h ); }
      float hash( vec2 p ) { return fract( sin( dot( p, vec2( 12.9898, 78.233 ) ) + uSeed ) * 43758.5453 ); }
      float noise( vec2 p ) {
        vec2 i = floor( p ), f = fract( p );
        vec2 u = f * f * ( 3.0 - 2.0 * f );
        return mix( mix( hash( i ), hash( i + vec2( 1, 0 ) ), u.x ), mix( hash( i + vec2( 0, 1 ) ), hash( i + vec2( 1, 1 ) ), u.x ), u.y );
      }
      void main() {
        vec3 d = vW - uC;
        vec2 p = vec2( dot( d, uU ), dot( d, uV ) );
        if ( uHoles > 0.5 && texture2D( tHoles, p / uWH + 0.5 ).r < 0.5 ) discard;
        // the man's outline: capsules between his projected joints, their
        // edge softer the further he stands from the glass
        float sh = 0.0;
        for ( int f = 0; f < ${MAXF}; f ++ ) {
          float k = uFK[ f ];
          if ( k <= 0.0 ) continue;
          // (a man behind the light, or on the room's side of the glass: no shadow here)
          float front = dot( uJ[ f * ${NJ} + 2 ] - uSrc, uN ), gap = dot( uC - uJ[ f * ${NJ} + 2 ], uN );
          if ( front < 0.15 || gap < 0.05 ) continue;
          k *= smoothstep( 0.15, 0.35, front );
          vec3 hd = proj( uJ[ f * ${NJ} + 0 ] ), ht = proj( uJ[ f * ${NJ} + 1 ] ), ch = proj( uJ[ f * ${NJ} + 2 ] );
          vec3 hp = proj( uJ[ f * ${NJ} + 3 ] ), hr = proj( uJ[ f * ${NJ} + 4 ] ), hl = proj( uJ[ f * ${NJ} + 5 ] ), kn = proj( uJ[ f * ${NJ} + 6 ] );
          // (the source's magnification of a man between it and the glass:
          // his widths grow as his joints' places do; his edge softens with
          // his distance from the glass)
          float sc = uSrcD / max( 0.3, uSrcD - ch.z );
          float blur = 0.006 + 0.06 * ch.z;
          vec2 X = vec2( 1.0, 0.0 );
          float dd = 1e3;
          // the man as an inker draws him on the glass (second pass: one
          // connected shape, not a stack of balls): in his own frame (metres
          // from the head's bone, y up, x across; mag the lamp's
          // magnification) the skull under the hat, the jaw into the neck,
          // the neck into sloping padded shoulders; the fedora a flat brim,
          // wide and a little down at its ends, the crown a tapered block on
          // it with the pinch at its top. The coat from the shoulders on down
          // his projected joints, joined smooth; the arms to the hands.
          vec2 up = ( ht.xy - hd.xy ) / 0.2;
          float mag = max( length( up ), 1e-3 );
          vec2 U = up / mag, Xa = vec2( U.y, -U.x );
          vec2 q = p - hd.xy;
          vec2 l = vec2( dot( q, Xa ), dot( q, U ) ) / mag;
          // (the head and the coat's top: one mass)
          float hb = length( ( l - vec2( 0.0, 0.085 ) ) / vec2( 0.083, 0.105 ) ) - 1.0;
          hb *= 0.083;
          float jaw = sdBox2( l - vec2( 0.0, -0.035 ), vec2( 0.05, 0.075 ) ) - 0.015;
          float shl = sdTrap( l - vec2( 0.0, -0.118 ), 0.232, 0.07, 0.058 ) - 0.012;
          float body = smin( smin( hb, jaw, 0.025 ), shl, 0.03 );
          // (the fedora: hard edged)
          float bx = l.x;
          float brimY = 0.142 - 0.45 * bx * bx;
          float brim = sdBox2( vec2( bx, l.y - brimY ), vec2( 0.2, 0.013 ) ) - 0.006;
          float crown = sdTrap( l - vec2( 0.0, 0.206 ), 0.1, 0.082, 0.058 ) - 0.014;
          float hat = min( brim, crown );
          float dL = min( body, hat ) * mag;
          // the coat: the shoulders' line down the chest to the hips, on to the knee
          vec2 sh0 = hd.xy + U * ( -0.15 * mag );
          float coat = min( segD( p, sh0, ch.xy ) - 0.2 * sc, min( segD( p, ch.xy, hp.xy ) - 0.2 * sc, segD( p, hp.xy, kn.xy ) - 0.21 * sc ) );
          dd = smin( dL, coat, 0.03 * mag );
          // the arms (a raised gun hand shows)
          vec2 shR = sh0 + Xa * 0.2 * mag * sign( dot( hr.xy - ch.xy, Xa ) + 1e-4 );
          vec2 shL = sh0 + Xa * 0.2 * mag * sign( dot( hl.xy - ch.xy, Xa ) + 1e-4 );
          dd = smin( dd, segD( p, shR, hr.xy ) - 0.052 * sc, 0.02 * mag );
          dd = smin( dd, segD( p, shL, hl.xy ) - 0.052 * sc, 0.02 * mag );
          // the frost's own grain breaks the edge a little
          float e = dd + ( noise( p * 40.0 ) - 0.5 ) * blur * 0.5;
          sh = max( sh, k * ( 1.0 - smoothstep( -blur, blur, e ) ) );
        }
        // the pane's glow: brighter toward the lamp's side of it, the frost's
        // mottle; seen from the lamp's side it is only faintly lit
        vec3 toL = normalize( uLamp - vW );
        float lampFace = dot( uN, toL );
        bool front = gl_FrontFacing;
        // (the glass seen from the side away from the lamp: it glows)
        float glow = ( front == ( lampFace < 0.0 ) ) ? uGlowB : uGlowF;
        float fall = 1.0 / ( 1.0 + 0.35 * dot( uLamp - vW, uLamp - vW ) );
        float mottle = 0.82 + 0.18 * noise( p * 9.0 ) + 0.06 * noise( p * 41.0 );
        // (lit evenly, a pane and not a spot: a little darker only at its frame)
        vec2 eg = uWH * 0.5 - abs( p );
        float rim = 0.8 + 0.2 * smoothstep( 0.0, 0.07, min( eg.x, eg.y ) );
        float I = min( 1.05, glow * uLampK * ( 0.6 + 2.2 * fall ) ) * mottle * rim;
        if ( uFall > 0.5 ) {
          // (base, mid, peak, sigma: the far part a dark grey, the corner toward
          // the lamp paper white; the ink prints the step between as its washes)
          vec3 dl = uLamp - vW;
          vec2 rm = smoothstep( vec2( -0.06 ), vec2( 0.06 ), min( p - uRect.xy, uRect.zw - p ) );
          float mask = rm.x * rm.y;
          I = min( 1.05, glow * uLampK * ( uFallK.x + mask * ( uFallK.y + uFallK.z * exp( - dot( dl, dl ) / uFallK.w ) ) ) ) * mottle * rim;
        }
        // (a flash behind it: the cloth white round it for a moment)
        if ( uFlK > 0.0 ) { vec3 fq = uFl - vW; I = min( 1.05, I + uFlK * 2.5 / ( 1.0 + 6.0 * dot( fq, fq ) ) ); }
        // the gilt letters: pale, keylined; read the right way round from the
        // lamp's side (the text is drawn for a reader facing -N)
        vec2 tuv = vec2( 0.5 - p.x / uWH.x, p.y / uWH.y + 0.5 );
        vec4 tx = texture2D( tText, tuv ) * uText;
        float letter = tx.a;
        float pale = tx.r;
        vec3 col = vec3( I * ( 1.0 - 0.985 * sh ) );
        // (the letters: dark keyline, paler body; a gilt that the ink prints as a pale grey)
        col = mix( col, vec3( 0.02 ), letter * ( 1.0 - pale ) * 0.9 );
        col = mix( col, vec3( 0.28 + 0.4 * I ), letter * pale );
        gl_FragColor = vec4( col, 1.0 );
      }`,
  });
  const J = U.uJ.value;
  const ud = m.userData;
  ud.inkSurface = 'lit';
  ud.U = U;
  ud.figures = [];
  ud.setFrame = (c, u, v, n) => {
    U.uC.value.copy(c); U.uU.value.copy(u); U.uV.value.copy(v); U.uN.value.copy(n);
    // (the shadows' source: 1.9 m behind the glass, at a man's shoulder)
    U.uSrc.value.copy(c).addScaledVector(n, -U.uSrcD.value); U.uSrc.value.y = 1.55;
  };
  ud.setLamp = (p, k = 1) => { U.uLamp.value.copy(p); U.uLampK.value = k; };
  ud.glow = (f, b) => { U.uGlowF.value = f; U.uGlowB.value = b; };
  // (round 2) the lamp's fall across the pane: { base, mid, peak, sigma }, a lit rectangle
  ud.fall = ({ base = 0.012, mid = 0, peak = 1.3, sigma = 1.0 } = {}, rect = null) => {
    U.uFall.value = 1; U.uFallK.value.set(base, mid, peak, sigma);
    if (rect) U.uRect.value.set(...rect);
  };
  // every step: the figures' joints into the uniforms
  ud.update = () => {
    for (let f = 0; f < MAXF; f++) {
      const F = ud.figures[f];
      const js = F && F.k > 0 ? F.joints() : null;
      U.uFK.value[f] = js ? F.k : 0;
      if (!js) continue;
      for (let j = 0; j < NJ; j++) J[f * NJ + j].copy(js[j]);
    }
  };
  return m;
}

// a Hood's (or a cast figure's) seven joints for the frosted glass, from its bones
const _v = new THREE.Vector3();
export function hoodJoints(fig) {
  const out = Array.from({ length: NJ }, () => new THREE.Vector3());
  const B = fig.bones;
  const at = (name, o) => { const b = B[name]; if (b) b.getWorldPosition(o); return o; };
  return () => {
    const head = at('head', out[0]);
    out[1].copy(head).y += 0.2 * (fig.scale || 1);
    at('chest', out[2]);
    at('hips', out[3]);
    at('handR', out[4]);
    at('handL', out[5]);
    // the knee (the coat ends about there)
    if (B.shinR) at('shinR', out[6]);
    else { out[6].copy(out[3]); out[6].y -= 0.5 * (fig.scale || 1); }
    void _v;
    return out;
  };
}

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
      float hash( vec2 p ) { return fract( sin( dot( p, vec2( 12.9898, 78.233 ) ) + uSeed ) * 43758.5453 ); }
      float noise( vec2 p ) {
        vec2 i = floor( p ), f = fract( p );
        vec2 u = f * f * ( 3.0 - 2.0 * f );
        return mix( mix( hash( i ), hash( i + vec2( 1, 0 ) ), u.x ), mix( hash( i + vec2( 0, 1 ) ), hash( i + vec2( 1, 1 ) ), u.x ), u.y );
      }
      void main() {
        vec3 d = vW - uC;
        vec2 p = vec2( dot( d, uU ), dot( d, uV ) );
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
          float sc = 1.25 / max( 0.3, 1.25 - ch.z );
          float blur = 0.006 + 0.06 * ch.z;
          vec2 X = vec2( 1.0, 0.0 );
          float dd = 1e3;
          // the head, the hat's crown, its wide brim
          // (hd: the head's bone, ht 0.2 over it: the head a ball on the
          // bone, the brim a flat wide bar at its crown, the crown a low
          // rounded block on the brim with its pinch)
          vec2 up = ( ht.xy - hd.xy ) / 0.2;
          vec2 brim = hd.xy + up * 0.14;
          dd = min( dd, length( ( p - ( hd.xy + up * 0.05 ) ) / vec2( 1.0, 1.2 ) ) - 0.088 * sc );
          dd = min( dd, segD( p, brim - X * 0.165 * sc, brim + X * 0.165 * sc ) - 0.022 * sc );
          dd = min( dd, segD( p, brim + up * 0.04 * sc - X * 0.045 * sc, brim + up * 0.04 * sc + X * 0.045 * sc ) - 0.052 * sc );
          dd = min( dd, segD( p, brim + up * 0.1 * sc - X * 0.03 * sc, brim + up * 0.1 * sc + X * 0.03 * sc ) - 0.035 * sc );
          // the shoulders, the coat to the hips and on past them to the knee
          vec2 sh0 = mix( ch.xy, hd.xy, 0.28 );
          dd = min( dd, segD( p, sh0 - X * 0.17 * sc, sh0 + X * 0.17 * sc ) - 0.075 * sc );
          dd = min( dd, segD( p, ch.xy, hp.xy ) - 0.19 * sc );
          dd = min( dd, segD( p, hp.xy, kn.xy ) - 0.2 * sc );
          // the arms (a raised gun hand shows)
          dd = min( dd, segD( p, sh0 + X * 0.18 * sc * sign( hr.x - ch.x + 1e-4 ), hr.xy ) - 0.05 * sc );
          dd = min( dd, segD( p, sh0 + X * 0.18 * sc * sign( hl.x - ch.x + 1e-4 ), hl.xy ) - 0.05 * sc );
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
        float I = min( 1.05, glow * uLampK * ( 0.35 + 3.2 * fall ) ) * mottle;
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
    U.uSrc.value.copy(c).addScaledVector(n, -1.25); U.uSrc.value.y = 1.55;
  };
  ud.setLamp = (p, k = 1) => { U.uLamp.value.copy(p); U.uLampK.value = k; };
  ud.glow = (f, b) => { U.uGlowF.value = f; U.uGlowB.value = b; };
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

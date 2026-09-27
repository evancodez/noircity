// The ink pass tone curve, shared by GLSL and JS so materials can be art
// directed in *display* values ("this tower row should print at #3a").
//
// Log-space film curve: linear luminance between TONE.black and TONE.white is
// mapped by stops onto 0..1, then an S-curve adds contrast. Everything below
// `black` is solid ink, everything above `white` is bare paper. ~7 stops of
// latitude: enough that lamp-lit mist reads as light grey instead of blowing
// straight to white, while still crushing the shadows to true black.
// Ink-pass exposure: scene luminance is multiplied by this before the tone
// curve. Materials that art-direct a DISPLAY value use linearFor(d) / EXPOSURE.
export const EXPOSURE = 1.46;

export const TONE = {
  black: 0.0085,   // linear luminance that prints as solid black
  white: 1.1,      // linear luminance that prints as paper white
  contrast: 0.55,  // 0 = straight log ramp, 1 = full smoothstep S
};

// After the S: a SHOULDER that rolls display values above ~0.72 onto bare
// paper (lamp haloes, cone collars and reflection cores print 255, like the
// reference's lift-outs), and a CRUSH that snaps the dark-grey mush (display
// ~0.03-0.12) down into solid ink, so shadows are either black or a visible
// wash, never a muddy near-black.
export const TONE_GLSL = /* glsl */`
uniform float uLogBlack, uLogWhite, uContrast;
float toneCurve( float x ) {
  float t = clamp( ( log2( max( x, 1e-6 ) ) - uLogBlack ) / ( uLogWhite - uLogBlack ), 0.0, 1.0 );
  float v = mix( t, t * t * ( 3.0 - 2.0 * t ), uContrast );
  v = mix( v, 1.0, smoothstep( 0.72, 0.9, v ) );
  return v * smoothstep( 0.06, 0.13, v );
}
`;

export function toneUniforms() {
  return {
    uLogBlack: { value: Math.log2(TONE.black) },
    uLogWhite: { value: Math.log2(TONE.white) },
    uContrast: { value: TONE.contrast },
  };
}

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function toneCurve(x) {
  const lb = Math.log2(TONE.black), lw = Math.log2(TONE.white);
  const t = Math.min(1, Math.max(0, (Math.log2(Math.max(x, 1e-6)) - lb) / (lw - lb)));
  let v = t + (t * t * (3 - 2 * t) - t) * TONE.contrast;
  v += (1 - v) * sstep(0.72, 0.9, v);
  return v * sstep(0.06, 0.13, v);
}

// Linear luminance that the ink pass prints at display value d (0..1).
export function linearFor(d) {
  let lo = TONE.black * 0.5, hi = TONE.white * 2;
  for (let i = 0; i < 60; i++) {
    const m = Math.sqrt(lo * hi);
    if (toneCurve(m) < d) lo = m; else hi = m;
  }
  return Math.sqrt(lo * hi);
}

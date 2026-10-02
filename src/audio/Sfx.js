import { FIGHT_SOUNDS } from './fight.js';
// Procedural sound (Phase 3a): Web Audio only, no assets. Every sound is a
// small node graph built on demand by a `build` function
//     build(ctx, out, t0, params, R)   (R: per-context noise buffers + reverb)
// so the same code plays live (an AudioContext, routed through a PannerNode
// per emitter) and renders offline (window.__noir.audioTest(): each sound
// into an OfflineAudioContext, measured for peak / rms).
//
// Routing (live):
//   voices -> [panner] -> sfx bus ----------------------\
//                      \-> reverb send -> street tail --> master -> compressor -> out
//   rain bed / drips / gusts -> ambience bus -----------/
// The master bus runs through a gentle compressor (-18 dB, 3:1, soft knee).
// M mutes, [ and ] set the volume; both persist in localStorage.
//
// Nothing here may throw in headless / shot mode: until unlock() (the first
// click, the pointer-lock start) there is no AudioContext and every call is
// a no-op. The shot presets never unlock.

const TAU = Math.PI * 2;
const SR = 44100;

// ---------------------------------------------------------------------------
// shared resources per context: noise buffers and the street's impulse
// response (a short, dark, wet slapback between the façade and the el)
const RES = new WeakMap();
function res(ctx) {
  let R = RES.get(ctx);
  if (R) return R;
  const sr = ctx.sampleRate;
  const mk = (secs, fill) => {
    const b = ctx.createBuffer(1, Math.floor(sr * secs), sr);
    fill(b.getChannelData(0), sr);
    return b;
  };
  let seed = 1337;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const white = mk(2, (d) => { for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1; });
  // brown: integrated white, leaky, normalised
  const brown = mk(4, (d) => {
    let l = 0;
    for (let i = 0; i < d.length; i++) { l = (l + 0.02 * (rnd() * 2 - 1)) / 1.02; d[i] = l * 3.5; }
  });
  // pink (Paul Kellet's economy filter)
  const pink = mk(3, (d) => {
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < d.length; i++) {
      const w = rnd() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
    }
  });
  // street IR: 1.6 s of decaying noise, darker as it decays, with a few
  // early slaps (the façade, the parked cars, the el's columns)
  const ir = ctx.createBuffer(2, Math.floor(sr * 2.4), sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < d.length; i++) {
      const t = i / sr;
      const k = Math.min(1, t / 0.15);
      lp += (rnd() * 2 - 1 - lp) * (0.5 - 0.42 * k);
      d[i] = lp * Math.exp(-t * 2.3) * 0.55;
    }
    // early slaps (façade, parked cars, columns) and two far echoes (the
    // block's end, the towers) that give a shot its rolling city tail
    for (const [tt, a] of [[0.021 + ch * 0.004, 0.5], [0.047 - ch * 0.006, 0.35], [0.083 + ch * 0.009, 0.25], [0.131, 0.16], [0.21 - ch * 0.012, 0.2], [0.34 + ch * 0.015, 0.12]]) {
      const i0 = Math.floor(tt * sr);
      for (let k = 0; k < 90; k++) d[i0 + k] += (rnd() * 2 - 1) * a * Math.exp(-k / 25);
    }
  }
  R = { white, brown, pink, ir };
  RES.set(ctx, R);
  return R;
}

// ---- small graph helpers ----------------------------------------------------
function noise(ctx, R, kind = 'white', t0 = 0, dur = 1, rate = 1) {
  const s = ctx.createBufferSource();
  s.buffer = R[kind];
  s.loop = true;
  s.playbackRate.value = rate;
  const off = (t0 * 7.31 + dur * 3.7) % Math.max(0.01, s.buffer.duration - 0.01);
  s.start(t0, off);
  s.stop(t0 + dur + 0.05);
  return s;
}
function filt(ctx, type, freq, Q = 0.7) {
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = Q;
  return f;
}
function gain(ctx, v = 1) { const g = ctx.createGain(); g.gain.value = v; return g; }
// attack / exponential decay envelope on a GainNode
function env(g, t0, peak, attack, decay, hold = 0) {
  const p = g.gain;
  p.setValueAtTime(0.0001, t0);
  p.linearRampToValueAtTime(peak, t0 + attack);
  if (hold > 0) p.setValueAtTime(peak, t0 + attack + hold);
  p.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + decay);
}
function shaper(ctx, drive = 2) {
  const ws = ctx.createWaveShaper();
  const n = 2048, c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * drive) / Math.tanh(drive); }
  ws.curve = c; ws.oversample = '2x';
  return ws;
}
function chain(...nodes) { for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); return nodes[nodes.length - 1]; }
function osc(ctx, type, f, t0, dur) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.start(t0); o.stop(t0 + dur + 0.05); return o; }
const rng = (a, b) => a + (b - a) * Math.random();

// ---------------------------------------------------------------------------
// The sounds. p: params; `out` is the voice's destination (panner / bus);
// `send` (optional) the reverb send. Each returns its length in seconds.
const B = {
  // Tommy gun, one round: a crack of band-limited noise, a low thump that
  // drops in pitch, the bolt's mechanical click; slight per-shot pitch
  // variance; the street throws back a tail (the reverb send)
  tommy(ctx, out, t0, p, R, send) {
    const pv = p.pitch ?? rng(0.94, 1.06);
    // every layer sums into a soft clipper: saturation is what gives a
    // recorded gunshot its weight, and it glues the crack to the thump
    const sat = shaper(ctx, 2.4);
    chain(sat, gain(ctx, 0.95), out);
    // crack: band-limited noise, ~90 ms, with a presence peak
    const n = noise(ctx, R, 'white', t0, 0.25, pv);
    const g1 = gain(ctx); env(g1, t0, 0.9, 0.0012, 0.09);
    const pk = filt(ctx, 'peaking', 1900 * pv, 1.2); pk.gain.value = 7;
    chain(n, filt(ctx, 'highpass', 420 * pv), pk, g1, sat);
    // thump: a sine dropping from 140 Hz to 42 Hz over 160 ms (the chest hit)
    const th = osc(ctx, 'sine', 140 * pv, t0, 0.3);
    th.frequency.setValueAtTime(140 * pv, t0);
    th.frequency.exponentialRampToValueAtTime(42, t0 + 0.16);
    const g2 = gain(ctx); env(g2, t0, 1.1, 0.002, 0.2);
    chain(th, g2, sat);
    // boom: low brown noise, the muzzle blast's pressure wave
    const bm = noise(ctx, R, 'brown', t0, 0.25, pv);
    const g5 = gain(ctx); env(g5, t0, 1.0, 0.001, 0.16);
    chain(bm, filt(ctx, 'lowpass', 220), g5, sat);
    // bark: a short saw sweep, the low-mid punch
    const bk = osc(ctx, 'sawtooth', 260 * pv, t0, 0.08);
    bk.frequency.exponentialRampToValueAtTime(95 * pv, t0 + 0.05);
    const g3 = gain(ctx); env(g3, t0, 0.55, 0.001, 0.045);
    chain(bk, filt(ctx, 'lowpass', 1400), g3, sat);
    // bolt click, a hair later
    const c = noise(ctx, R, 'white', t0 + 0.012, 0.03, 1);
    const g4 = gain(ctx); env(g4, t0 + 0.012, 0.25, 0.0005, 0.012);
    chain(c, filt(ctx, 'bandpass', 3400 * pv, 4), g4, out);
    // the street answers: a big send (crack, thump, boom) plus a slap off
    // the far façade ~190 ms later, the rolling echo of a shot in a city
    if (send) {
      const gs = gain(ctx); env(gs, t0, 1.3, 0.002, 0.12); chain(n, gs, send);
      chain(g2, gain(ctx, 0.7), send);
      chain(g5, gain(ctx, 0.5), send);
      const sl = noise(ctx, R, 'white', t0 + 0.19, 0.12, 0.9 * pv);
      const gsl = gain(ctx); env(gsl, t0 + 0.19, 0.35, 0.004, 0.08);
      chain(sl, filt(ctx, 'bandpass', 900, 0.8), gsl, send);
    }
    return 0.45;
  },

  // a Hood's pistol: a sharp crack, a short body; distance darkens it
  // (p.dist: m) and pushes more of it into the street tail
  pistol(ctx, out, t0, p, R, send) {
    const d = p.dist ?? 15;
    const dark = Math.max(700, 9000 / (1 + d / 12));
    const sat = shaper(ctx, 2.0);
    chain(sat, gain(ctx, 0.95), out);
    const n = noise(ctx, R, 'white', t0, 0.25, rng(0.95, 1.05));
    const g = gain(ctx); env(g, t0, 0.85, 0.001, 0.09);
    chain(n, filt(ctx, 'highpass', 600), filt(ctx, 'lowpass', dark), g, sat);
    const b = osc(ctx, 'triangle', 190, t0, 0.12);
    b.frequency.exponentialRampToValueAtTime(80, t0 + 0.07);
    const gb = gain(ctx); env(gb, t0, 0.55, 0.001, 0.1);
    chain(b, gb, sat);
    // a low thump that fades with distance (the pressure wave does not carry)
    const th = osc(ctx, 'sine', 110, t0, 0.2);
    th.frequency.exponentialRampToValueAtTime(50, t0 + 0.12);
    const gt = gain(ctx); env(gt, t0, 0.6 * Math.max(0.25, 1 - d / 60), 0.002, 0.14);
    chain(th, gt, sat);
    if (send) { const gs = gain(ctx); env(gs, t0, 0.6 + Math.min(0.5, d / 50), 0.002, 0.12); chain(n, filt(ctx, 'lowpass', dark), gs, send); chain(gb, gain(ctx, 0.5), send); }
    return 0.45;
  },

  // ricochet: a falling whine with a little flutter, over a tick
  ricochet(ctx, out, t0, p, R) {
    const f0 = rng(2600, 4200), f1 = f0 * rng(0.3, 0.45), dur = rng(0.28, 0.5);
    const o = osc(ctx, 'triangle', f0, t0, dur);
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const lfo = osc(ctx, 'sine', rng(28, 45), t0, dur);
    const lg = gain(ctx, f0 * 0.02); chain(lfo, lg, o.frequency);
    const g = gain(ctx); env(g, t0, 0.22, 0.006, dur);
    chain(o, filt(ctx, 'bandpass', f0 * 0.7, 1.2), g, out);
    const n = noise(ctx, R, 'white', t0, 0.04);
    const gn = gain(ctx); env(gn, t0, 0.4, 0.0005, 0.02);
    chain(n, filt(ctx, 'highpass', 2500), gn, out);
    return dur + 0.1;
  },

  // glass: the crash (a burst of bright noise) and the tinkle of falling
  // pieces (inharmonic pings, scattered over ~0.6 s); k = how much glass
  glass(ctx, out, t0, p, R) {
    const k = p.k ?? 1;
    const n = noise(ctx, R, 'white', t0, 0.5);
    const g = gain(ctx); env(g, t0, 0.55 * Math.min(1.2, k), 0.001, 0.12 + 0.12 * k);
    chain(n, filt(ctx, 'highpass', 2400), g, out);
    const pings = Math.round(5 + 10 * k);
    for (let i = 0; i < pings; i++) {
      const t = t0 + 0.01 + Math.pow(Math.random(), 1.6) * (0.25 + 0.45 * k);
      const f = rng(2600, 7800);
      const o = osc(ctx, 'sine', f, t, 0.12);
      const o2 = osc(ctx, 'sine', f * rng(2.2, 2.9), t, 0.08);
      const go = gain(ctx); env(go, t, rng(0.05, 0.14), 0.001, rng(0.03, 0.09));
      o.connect(go); o2.connect(go); go.connect(out);
    }
    return 0.4 + 0.5 * k;
  },

  // the explosion: a sub drop, a roaring noise body, the crack, a long dark
  // tail, then debris ticks raining down
  explosion(ctx, out, t0, p, R, send) {
    // (Phase 3b: the whole voice at 0.85 - its offline peak was ~1.05, the
    // compressor's knee is no limiter; now ~0.9)
    const trim = gain(ctx, 0.85); trim.connect(out); out = trim;
    if (send) { const ts = gain(ctx, 0.85); ts.connect(send); send = ts; }
    const sub = osc(ctx, 'sine', 55, t0, 1.8);
    sub.frequency.setValueAtTime(58, t0);
    sub.frequency.exponentialRampToValueAtTime(24, t0 + 1.4);
    const gs = gain(ctx); env(gs, t0, 0.7, 0.01, 1.5);
    chain(sub, gs, out);
    const body = noise(ctx, R, 'brown', t0, 3.5, 0.9);
    const lp = filt(ctx, 'lowpass', 1800, 0.5);
    lp.frequency.setValueAtTime(2200, t0);
    lp.frequency.exponentialRampToValueAtTime(180, t0 + 2.6);
    const gb = gain(ctx); env(gb, t0, 0.6, 0.004, 3.0);
    chain(body, lp, gb, out);
    const cr = noise(ctx, R, 'white', t0, 0.3);
    const gc = gain(ctx); env(gc, t0, 0.55, 0.0008, 0.16);
    chain(cr, filt(ctx, 'highpass', 900), gc, out);
    if (send) { const g2 = gain(ctx); env(g2, t0, 0.9, 0.01, 2.2); chain(body, filt(ctx, 'lowpass', 700), g2, send); }
    // debris ticks: bits of car coming down on the street
    const nT = 18;
    for (let i = 0; i < nT; i++) {
      const t = t0 + 0.35 + Math.pow(Math.random(), 0.8) * 2.3;
      const c = noise(ctx, R, 'white', t, 0.03);
      const gt = gain(ctx); env(gt, t, rng(0.05, 0.22) * (1 - (t - t0) / 3.2), 0.0005, rng(0.01, 0.04));
      chain(c, filt(ctx, 'bandpass', rng(1500, 5000), 3), gt, out);
    }
    return 3.6;
  },

  // a bit of car or a trash-can lid clattering down
  debris(ctx, out, t0, p) {
    const k = p.k ?? 0.6;
    for (const f of [rng(300, 520), rng(900, 1500), rng(2100, 3300)]) {
      const o = osc(ctx, 'triangle', f, t0, 0.3);
      const g = gain(ctx); env(g, t0, 0.18 * k, 0.001, rng(0.06, 0.2));
      chain(o, g, out);
    }
    return 0.35;
  },
  clang(ctx, out, t0, p, R) {
    // a dented trash can / the hydrant: inharmonic metal partials
    const k = p.k ?? 1;
    for (const [f, a, d] of [[rng(380, 460), 0.3, 0.45], [rng(1010, 1150), 0.2, 0.3], [rng(1830, 2100), 0.14, 0.2], [rng(3100, 3500), 0.08, 0.12]]) {
      const o = osc(ctx, 'sine', f, t0, d + 0.05);
      const g = gain(ctx); env(g, t0, a * k, 0.001, d);
      chain(o, g, out);
    }
    const n = noise(ctx, R, 'white', t0, 0.03);
    const gn = gain(ctx); env(gn, t0, 0.3 * k, 0.0005, 0.015);
    chain(n, filt(ctx, 'bandpass', 2500, 1.5), gn, out);
    return 0.5;
  },

  // fire crackle (a loop voice renders its first seconds offline): a low
  // roar and random pops
  fire(ctx, out, t0, p, R) {
    const dur = p.dur ?? 3;
    const roar = noise(ctx, R, 'brown', t0, dur, 0.7);
    const g = gain(ctx, 0);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.35, t0 + 0.3);
    g.gain.setValueAtTime(0.35, t0 + dur - 0.2); g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    chain(roar, filt(ctx, 'lowpass', 520, 0.6), g, out);
    const n = Math.round(dur * 14);
    for (let i = 0; i < n; i++) B.crackle(ctx, out, t0 + Math.random() * dur, { k: rng(0.4, 1) }, R);
    return dur;
  },
  crackle(ctx, out, t0, p, R) {
    const c = noise(ctx, R, 'white', t0, 0.03, rng(0.7, 1.4));
    const g = gain(ctx); env(g, t0, 0.3 * (p.k ?? 1), 0.0005, rng(0.004, 0.02));
    chain(c, filt(ctx, 'bandpass', rng(900, 4200), rng(1, 4)), g, out);
    return 0.05;
  },

  // the el train: a deep rumble with the wheels' clack over the rail joints
  // and a mid-band grind (the loop voice renders its first seconds offline)
  train(ctx, out, t0, p, R) {
    const dur = p.dur ?? 3;
    const r = noise(ctx, R, 'brown', t0, dur, 0.5);
    const g = gain(ctx, 0.0001);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.8, t0 + 0.8);
    g.gain.setValueAtTime(0.8, t0 + dur - 0.5); g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    chain(r, filt(ctx, 'lowpass', 140, 0.9), g, out);
    const grind = noise(ctx, R, 'pink', t0, dur, 0.8);
    const gg = gain(ctx, 0.0001);
    gg.gain.setValueAtTime(0.0001, t0); gg.gain.linearRampToValueAtTime(0.12, t0 + 0.8);
    gg.gain.setValueAtTime(0.12, t0 + dur - 0.5); gg.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    chain(grind, filt(ctx, 'bandpass', 420, 0.8), gg, out);
    for (let t = t0 + 0.2; t < t0 + dur - 0.3; t += 0.93) { B.clack(ctx, out, t, { k: 0.7 }, R); B.clack(ctx, out, t + 0.11, { k: 0.55 }, R); }
    return dur;
  },
  clack(ctx, out, t0, p, R) {
    const c = noise(ctx, R, 'brown', t0, 0.08, 2);
    const g = gain(ctx); env(g, t0, 0.6 * (p.k ?? 1), 0.001, 0.05);
    chain(c, filt(ctx, 'bandpass', 260, 1.3), g, out);
    const o = osc(ctx, 'triangle', 820, t0, 0.06);
    const go = gain(ctx); env(go, t0, 0.06 * (p.k ?? 1), 0.001, 0.03);
    chain(o, go, out);
    return 0.1;
  },
  // wheel squeal on the curve: a thin, wavering screech
  squeal(ctx, out, t0, p) {
    const dur = p.dur ?? 0.8;
    const f = rng(2400, 3300);
    const o = osc(ctx, 'sawtooth', f, t0, dur);
    const lfo = osc(ctx, 'sine', rng(5, 9), t0, dur);
    const lg = gain(ctx, f * 0.012); chain(lfo, lg, o.frequency);
    const g = gain(ctx); env(g, t0, 0.16 * (p.k ?? 1), 0.08, dur * 0.8, dur * 0.2);
    chain(o, filt(ctx, 'bandpass', f, 6), filt(ctx, 'highpass', 1500), g, out);
    return dur + 0.1;
  },

  // footstep on wet stone: a soft heel knock and a splash
  step(ctx, out, t0, p, R) {
    const k = (p.run ? 1.2 : 0.8) * (p.k ?? 1);
    const n = noise(ctx, R, 'brown', t0, 0.1, 1.6);
    const g = gain(ctx); env(g, t0, 0.35 * k, 0.002, 0.05);
    chain(n, filt(ctx, 'lowpass', p.lino ? 1100 : 700), g, out);
    // (indoors: a dry heel on linoleum, no splash)
    const s = noise(ctx, R, 'white', t0 + 0.012, 0.15, rng(0.8, 1.2));
    const gs = gain(ctx); env(gs, t0 + 0.012, 0.16 * k * (p.lino ? 0.15 : 1), 0.004, 0.07);
    chain(s, filt(ctx, 'bandpass', rng(2400, 3600), 1.1), gs, out);
    return 0.2;
  },

  // reload: the drum slides out, clunks home, the bolt is racked
  reload(ctx, out, t0, p, R) {
    const slide = (t, f0, f1, a) => {
      const n = noise(ctx, R, 'white', t, 0.2);
      const bp = filt(ctx, 'bandpass', f0, 2.5);
      bp.frequency.setValueAtTime(f0, t); bp.frequency.linearRampToValueAtTime(f1, t + 0.14);
      const g = gain(ctx); env(g, t, a, 0.01, 0.13);
      chain(n, bp, g, out);
    };
    const click = (t, f, a) => {
      const n = noise(ctx, R, 'white', t, 0.03);
      const g = gain(ctx); env(g, t, a, 0.0005, 0.018);
      chain(n, filt(ctx, 'bandpass', f, 3), g, out);
      const o = osc(ctx, 'triangle', f * 0.31, t, 0.05);
      const go = gain(ctx); env(go, t, a * 0.3, 0.001, 0.03);
      chain(o, go, out);
    };
    const thump = (t, a) => {
      const o = osc(ctx, 'sine', 140, t, 0.1);
      o.frequency.exponentialRampToValueAtTime(70, t + 0.06);
      const g = gain(ctx); env(g, t, a, 0.002, 0.07);
      chain(o, g, out);
    };
    const T = p.dur ?? 2.3;
    click(t0 + T * 0.2, 2600, 0.25);          // the drum latch
    slide(t0 + T * 0.26, 1400, 900, 0.22);    // drum out
    slide(t0 + T * 0.52, 900, 1500, 0.2);     // drum in
    thump(t0 + T * 0.6, 0.5); click(t0 + T * 0.6, 1900, 0.35);
    click(t0 + T * 0.76, 3000, 0.4);          // bolt back
    click(t0 + T * 0.81, 2200, 0.45); thump(t0 + T * 0.81, 0.3);   // and home
    return T;
  },

  // a man hit: a short, breathy, voiced exhale through two formants (an
  // "uh"), low in the mix - never a cartoon yelp
  grunt(ctx, out, t0, p, R) {
    const f0 = (p.f0 ?? rng(95, 135));
    const dur = p.dur ?? rng(0.14, 0.24);
    return voice(ctx, out, t0, R, { f0, f1: f0 * 0.82, dur, formants: [[rng(520, 640), 5], [rng(950, 1150), 7], [2500, 10]], breath: 0.55, level: p.k ?? 0.5 });
  },
  death(ctx, out, t0, p, R) {
    const f0 = p.f0 ?? rng(105, 150);
    const dur = p.dur ?? rng(0.5, 0.8);
    return voice(ctx, out, t0, R, { f0, f1: f0 * 0.6, dur, formants: [[rng(650, 780), 4], [rng(1050, 1250), 6], [2450, 9]], breath: 0.7, level: p.k ?? 0.55, attack: 0.03 });
  },

  // the heartbeat (low health): lub-dub
  heart(ctx, out, t0, p) {
    const k = p.k ?? 1;
    for (const [dt, f, a] of [[0, 58, 0.6], [0.17, 46, 0.45]]) {
      const o = osc(ctx, 'sine', f, t0 + dt, 0.2);
      o.frequency.exponentialRampToValueAtTime(f * 0.7, t0 + dt + 0.12);
      const g = gain(ctx); env(g, t0 + dt, a * k, 0.008, 0.13);
      chain(o, filt(ctx, 'lowpass', 160), g, out);
    }
    return 0.45;
  },

  // a spent case on the stone: a tiny bright tink (n: which bounce)
  casing(ctx, out, t0, p) {
    const k = 1 / (1 + (p.n ?? 1) * 0.8);
    const f = rng(5200, 6800);
    for (const [m, a, d] of [[1, 0.2, 0.05], [2.76, 0.1, 0.03], [5.4, 0.05, 0.018]]) {
      const o = osc(ctx, 'sine', f * m, t0, d + 0.02);
      const g = gain(ctx); env(g, t0, a * k, 0.0005, d);
      chain(o, g, out);
    }
    return 0.1;
  },

  // thunder: a crack for a near strike, then a long rolling rumble
  // (p.s strength, p.far 0 near .. 1 far)
  thunder(ctx, out, t0, p, R) {
    const far = p.far ?? 0.5, s = p.s ?? 1;
    const dur = 4 + far * 3;
    if (far < 0.5) {
      const c = noise(ctx, R, 'white', t0, 0.5);
      const gc = gain(ctx); env(gc, t0, 0.5 * s * (1 - far), 0.004, 0.35);
      chain(c, filt(ctx, 'highpass', 1200), filt(ctx, 'lowpass', 5000), gc, out);
    }
    const nRolls = 4 + Math.round(Math.random() * 3);
    for (let i = 0; i < nRolls; i++) {
      const t = t0 + (i === 0 ? 0.05 : Math.pow(Math.random(), 0.7) * dur * 0.6);
      const r = noise(ctx, R, 'brown', t, dur, rng(0.35, 0.6));
      const g = gain(ctx); env(g, t, rng(0.35, 0.8) * s * (1 - far * 0.4), 0.08 + far * 0.3, rng(1.2, 3.2));
      chain(r, filt(ctx, 'lowpass', 180 + (1 - far) * 250, 0.8), g, out);
    }
    return dur + 1;
  },

  // rain bed (the loop renders its first seconds offline): a wash of
  // filtered noise, a brighter patter, drips
  rain(ctx, out, t0, p, R) {
    const dur = p.dur ?? 3;
    const bed = noise(ctx, R, 'pink', t0, dur, 1);
    const g = gain(ctx, 0.0001);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.24, t0 + 0.5);
    chain(bed, filt(ctx, 'highpass', 250), filt(ctx, 'lowpass', 2600, 0.5), g, out);
    const pat = noise(ctx, R, 'white', t0, dur, 1);
    const g2 = gain(ctx, 0.0001);
    g2.gain.setValueAtTime(0.0001, t0); g2.gain.linearRampToValueAtTime(0.035, t0 + 0.5);
    chain(pat, filt(ctx, 'bandpass', 5200, 0.6), g2, out);
    for (let i = 0; i < dur * 3; i++) B.drip(ctx, out, t0 + Math.random() * dur, {}, R);
    return dur;
  },
  drip(ctx, out, t0, p) {
    const f = rng(1300, 2900);
    const o = osc(ctx, 'sine', f, t0, 0.08);
    o.frequency.exponentialRampToValueAtTime(f * 1.6, t0 + 0.04);
    const g = gain(ctx); env(g, t0, (p.k ?? 1) * rng(0.03, 0.08), 0.001, 0.04);
    chain(o, g, out);
    return 0.1;
  },

  // small world sounds
  hiss(ctx, out, t0, p, R) {       // a car starting to smoke: steam hiss
    const dur = p.dur ?? 1.5;
    const n = noise(ctx, R, 'white', t0, dur);
    const g = gain(ctx); env(g, t0, 0.18, 0.25, dur * 0.6, dur * 0.2);
    chain(n, filt(ctx, 'highpass', 2800), g, out);
    return dur + 0.1;
  },
  tyre(ctx, out, t0, p, R) {       // a tyre shot flat: a burst of air
    const n = noise(ctx, R, 'white', t0, 1.0);
    const bp = filt(ctx, 'bandpass', 3200, 0.7);
    bp.frequency.setValueAtTime(3600, t0); bp.frequency.exponentialRampToValueAtTime(1400, t0 + 0.9);
    const g = gain(ctx); env(g, t0, 0.3, 0.004, 0.85);
    chain(n, bp, g, out);
    return 1;
  },
  steam(ctx, out, t0, p, R) {      // a grate coughing steam
    const n = noise(ctx, R, 'white', t0, 0.9);
    const g = gain(ctx); env(g, t0, 0.15 * (p.k ?? 1), 0.05, 0.7);
    chain(n, filt(ctx, 'bandpass', 1600, 0.6), g, out);
    return 0.9;
  },
  hydrant(ctx, out, t0, p, R) {    // the hydrant bursting, and its rush
    const dur = p.dur ?? 2.5;
    const n = noise(ctx, R, 'pink', t0, dur, 1.2);
    const g = gain(ctx, 0.0001);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.45, t0 + 0.05);
    g.gain.setValueAtTime(0.3, t0 + dur - 0.3); g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    chain(n, filt(ctx, 'highpass', 400), filt(ctx, 'lowpass', 5000), g, out);
    return dur;
  },
  zap(ctx, out, t0, p, R) {        // a lamp shot out: the pop of the bulb
    const n = noise(ctx, R, 'white', t0, 0.1);
    const g = gain(ctx); env(g, t0, 0.5, 0.0005, 0.06);
    chain(n, filt(ctx, 'bandpass', 1800, 1), g, out);
    const o = osc(ctx, 'square', 60, t0, 0.12);
    const go = gain(ctx); env(go, t0, 0.1, 0.001, 0.1);
    chain(o, filt(ctx, 'lowpass', 900), go, out);
    return 0.2;
  },
  buzz(ctx, out, t0, p) {          // a dying lamp's arc buzzing back on
    const dur = p.dur ?? 0.5;
    const o = osc(ctx, 'sawtooth', 120, t0, dur);
    const o2 = osc(ctx, 'square', 240, t0, dur);
    const chop = osc(ctx, 'square', rng(11, 19), t0, dur);
    const cg = gain(ctx, 0.06); chain(chop, cg);
    const g = gain(ctx, 0.0001);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.08, t0 + 0.02);
    g.gain.setValueAtTime(0.08, t0 + dur - 0.03); g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    cg.connect(g.gain);
    const bp = filt(ctx, 'bandpass', 1200, 0.9);
    o.connect(bp); o2.connect(bp); chain(bp, g, out);
    return dur + 0.05;
  },
};

// a voiced burst: a sawtooth glottal source with jitter, noise breath, both
// through parallel formant band-passes
function voice(ctx, out, t0, R, { f0, f1, dur, formants, breath = 0.5, level = 0.5, attack = 0.015 }) {
  const src = osc(ctx, 'sawtooth', f0, t0, dur);
  src.frequency.setValueAtTime(f0, t0);
  src.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  const jit = osc(ctx, 'sine', rng(18, 30), t0, dur);
  const jg = gain(ctx, f0 * 0.03); chain(jit, jg, src.frequency);
  const br = noise(ctx, R, 'white', t0, dur);
  const mixIn = gain(ctx, 1);
  const gv = gain(ctx, 1 - breath * 0.6); chain(src, gv, mixIn);
  const gbr = gain(ctx, breath * 0.5); chain(br, gbr, mixIn);
  const g = gain(ctx); env(g, t0, level, attack, dur * 0.7, dur * 0.2);
  const lp = filt(ctx, 'lowpass', 3200);
  for (const [f, q] of formants) { const bp = filt(ctx, 'bandpass', f, q); chain(mixIn, bp, lp); }
  chain(lp, g, out);
  return dur + 0.1;
}


// ---------------------------------------------------------------------------
// The story's sounds (lane 7, P0.4): the diner's small objects, the fight,
// what breaks. Same kit as above: noise through filters, a few oscillators,
// envelopes; each returns its length.
// a struck thing: inharmonic partials [freq, level, decay] and a tick
function ping(ctx, out, t0, parts, k = 1) {
  for (const [f, a, d] of parts) {
    const o = osc(ctx, 'sine', f, t0, d + 0.05);
    const g = gain(ctx); env(g, t0, a * k, 0.001, d);
    chain(o, g, out);
  }
}
// a burst of filtered noise: kind, [type, freq, Q], peak, attack, decay
function burst(ctx, out, R, t0, kind, f, peak, attack, decay, rate = 1) {
  const n = noise(ctx, R, kind, t0, attack + decay + 0.05, rate);
  const g = gain(ctx); env(g, t0, peak, attack, decay);
  chain(n, filt(ctx, f[0], f[1], f[2] ?? 0.7), g, out);
  return g;
}
// a thud: a sine dropping in pitch
function thud(ctx, out, t0, f0, f1, peak, dur) {
  const o = osc(ctx, 'sine', f0, t0, dur);
  o.frequency.setValueAtTime(f0, t0);
  o.frequency.exponentialRampToValueAtTime(f1, t0 + dur * 0.8);
  const g = gain(ctx); env(g, t0, peak, 0.002, dur);
  chain(o, g, out);
}
// glass going: the crack, then pieces pinging down over `spread` seconds
function glassFall(ctx, out, t0, R, k, spread, pieces) {
  burst(ctx, out, R, t0, 'white', ['highpass', 2200], 0.5 * k, 0.001, 0.1 + 0.1 * k);
  for (let i = 0; i < pieces; i++) {
    const t = t0 + 0.02 + Math.pow(Math.random(), 1.4) * spread;
    const f = rng(2400, 8200);
    ping(ctx, out, t, [[f, rng(0.03, 0.12) * k, rng(0.02, 0.08)], [f * rng(2.2, 2.8), rng(0.02, 0.05) * k, 0.03]]);
  }
}
Object.assign(B, {
  // ---- the cigarette, the lighter ---------------------------------------------------
  packTap(ctx, out, t0, p, R) {
    burst(ctx, out, R, t0, 'brown', ['bandpass', 520, 1.5], 0.3, 0.002, 0.04, 2);
    burst(ctx, out, R, t0 + 0.14, 'brown', ['bandpass', 560, 1.5], 0.25, 0.002, 0.04, 2);
    return 0.25;
  },
  // the lid flipped, the wheel rasped, the flame catching with a soft whoosh
  lighter(ctx, out, t0, p, R) {
    ping(ctx, out, t0, [[3150, 0.16, 0.05], [5600, 0.08, 0.03], [1400, 0.06, 0.03]]);
    const w = noise(ctx, R, 'white', t0 + 0.12, 0.12, 1.3);
    const am = osc(ctx, 'square', 46, t0 + 0.12, 0.1);
    const ga = gain(ctx, 0.5); chain(am, ga);
    const g = gain(ctx); env(g, t0 + 0.12, 0.22, 0.004, 0.07);
    ga.connect(g.gain);
    chain(w, filt(ctx, 'bandpass', 2600, 1.6), g, out);
    const f = noise(ctx, R, 'pink', t0 + 0.2, 0.6, 1);
    const gf = gain(ctx, 0.0001);
    gf.gain.setValueAtTime(0.0001, t0 + 0.2); gf.gain.linearRampToValueAtTime(0.1, t0 + 0.3); gf.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.75);
    chain(f, filt(ctx, 'lowpass', 1100, 0.6), gf, out);
    return 0.8;
  },
  lighterShut(ctx, out, t0) { ping(ctx, out, t0, [[1850, 0.18, 0.04], [4300, 0.07, 0.03], [700, 0.08, 0.03]]); return 0.1; },
  // the tip catching: a dry crackle over a drawn breath
  cigCatch(ctx, out, t0, p, R) {
    for (let i = 0; i < 9; i++) burst(ctx, out, R, t0 + Math.random() * 0.45, 'white', ['highpass', 3200], rng(0.02, 0.06), 0.0005, 0.006);
    burst(ctx, out, R, t0, 'pink', ['bandpass', 900, 0.8], 0.05, 0.12, 0.35);
    return 0.6;
  },
  drag(ctx, out, t0, p, R) {
    for (let i = 0; i < 14; i++) burst(ctx, out, R, t0 + Math.random() * 0.8, 'white', ['highpass', 3600], rng(0.015, 0.045), 0.0005, 0.005);
    burst(ctx, out, R, t0, 'pink', ['bandpass', 1100, 0.9], 0.04, 0.2, 0.6);
    return 0.9;
  },
  exhale(ctx, out, t0, p, R) { burst(ctx, out, R, t0, 'pink', ['bandpass', 700, 0.7], 0.08, 0.15, 1.1); return 1.3; },
  ashTap(ctx, out, t0) { ping(ctx, out, t0, [[2250, 0.07, 0.05], [5100, 0.03, 0.02]]); return 0.1; },
  // ---- the scotch -------------------------------------------------------------------------------
  glassDown(ctx, out, t0, p, R) {
    const k = p.k ?? 1;
    thud(ctx, out, t0, 190, 120, 0.25 * k, 0.05);
    ping(ctx, out, t0, [[2950, 0.09 * k, 0.12], [4750, 0.05 * k, 0.08], [7100, 0.02 * k, 0.05]]);
    return 0.2;
  },
  cork(ctx, out, t0, p, R) {
    const o = osc(ctx, 'sine', 900, t0, 0.1);
    o.frequency.setValueAtTime(900, t0); o.frequency.exponentialRampToValueAtTime(1500, t0 + 0.08);
    const g = gain(ctx); env(g, t0, 0.05 * (p.k ?? 1), 0.02, 0.06);
    chain(o, filt(ctx, 'bandpass', 1200, 2), g, out);
    burst(ctx, out, R, t0 + 0.09, 'white', ['bandpass', 1800, 3], 0.2 * (p.k ?? 1), 0.0005, 0.02);
    return 0.2;
  },
  // the pour: glugs, their note rising as the glass fills
  pour(ctx, out, t0, p, R) {
    const dur = p.dur ?? 1.3;
    const n = Math.round(dur * 7);
    for (let i = 0; i < n; i++) {
      const u = i / Math.max(1, n - 1), t = t0 + u * dur + rng(-0.02, 0.02);
      const f = 380 + 750 * u;
      const b = noise(ctx, R, 'white', t, 0.08, 1);
      const g = gain(ctx); env(g, t, rng(0.08, 0.14), 0.005, 0.06);
      chain(b, filt(ctx, 'bandpass', f, 9), g, out);
      const o = osc(ctx, 'sine', f * 0.5, t, 0.05);
      o.frequency.setValueAtTime(f * 0.45, t); o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.04);
      const go = gain(ctx); env(go, t, 0.05, 0.003, 0.04);
      chain(o, go, out);
    }
    burst(ctx, out, R, t0, 'pink', ['bandpass', 2400, 0.8], 0.02, 0.1, dur);
    return dur + 0.2;
  },
  glassSlide(ctx, out, t0, p, R) {
    const n = noise(ctx, R, 'white', t0, 0.55, 1);
    const bp = filt(ctx, 'bandpass', 1300, 2);
    bp.frequency.setValueAtTime(1500, t0); bp.frequency.linearRampToValueAtTime(900, t0 + 0.5);
    const g = gain(ctx); env(g, t0, 0.06, 0.03, 0.45);
    chain(n, bp, g, out);
    ping(ctx, out, t0 + 0.52, [[2900, 0.04, 0.06]]);
    return 0.65;
  },
  sip(ctx, out, t0, p, R) {
    const n = noise(ctx, R, 'pink', t0, 0.3, 1);
    const am = osc(ctx, 'sine', 13, t0, 0.3); const ga = gain(ctx, 0.03); chain(am, ga);
    const g = gain(ctx); env(g, t0, 0.05, 0.03, 0.22); ga.connect(g.gain);
    chain(n, filt(ctx, 'bandpass', 1500, 1.2), g, out);
    thud(ctx, out, t0 + 0.35, 110, 70, 0.12, 0.08);
    return 0.5;
  },
  // ---- the room's things ---------------------------------------------------------------------
  plateDown(ctx, out, t0, p, R) { thud(ctx, out, t0, 240, 150, 0.15, 0.05); ping(ctx, out, t0, [[2100, 0.06, 0.08], [3350, 0.04, 0.05]]); return 0.15; },
  cutlery(ctx, out, t0) {
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) { const t = t0 + i * rng(0.08, 0.25), f = rng(3400, 6100); ping(ctx, out, t, [[f, rng(0.02, 0.05), 0.05], [f * 1.49, 0.015, 0.03]]); }
    return 1.0;
  },
  // the bell in the kitchen hatch: a bright ding that rings on
  bell(ctx, out, t0) { ping(ctx, out, t0, [[1720, 0.22, 1.3], [4140, 0.1, 0.7], [6310, 0.05, 0.35], [870, 0.05, 0.9]]); return 1.4; },
  // the shop door's little bells on a spring
  doorbell(ctx, out, t0) {
    for (let i = 0; i < 6; i++) { const t = t0 + i * rng(0.05, 0.11); const f = rng(2600, 3400); ping(ctx, out, t, [[f, 0.07 * (1 - i / 7), 0.35], [f * 2.4, 0.03, 0.15]]); }
    return 1.0;
  },
  register(ctx, out, t0, p, R) {
    ping(ctx, out, t0, [[1930, 0.14, 0.6], [2410, 0.1, 0.5], [4800, 0.04, 0.2]]);
    burst(ctx, out, R, t0 + 0.12, 'brown', ['bandpass', 220, 1], 0.25, 0.02, 0.25, 1.5);
    thud(ctx, out, t0 + 0.4, 140, 80, 0.2, 0.08);
    return 0.8;
  },
  wallet(ctx, out, t0, p, R) {
    const n = noise(ctx, R, 'brown', t0, 0.35, 2.5);
    const am = osc(ctx, 'sawtooth', 23, t0, 0.35); const ga = gain(ctx, 0.08); chain(am, ga);
    const g = gain(ctx); env(g, t0, 0.18, 0.04, 0.28); ga.connect(g.gain);
    chain(n, filt(ctx, 'bandpass', 650, 1.4), g, out);
    return 0.4;
  },
  newspaper(ctx, out, t0, p, R) {
    const n = noise(ctx, R, 'white', t0, 0.6, 1);
    const am = osc(ctx, 'square', 31, t0, 0.6); const ga = gain(ctx, 0.04); chain(am, ga);
    const g = gain(ctx); env(g, t0, 0.07, 0.05, 0.45); ga.connect(g.gain);
    chain(n, filt(ctx, 'highpass', 1800), g, out);
    return 0.7;
  },
  stoolSqueak(ctx, out, t0, p) {
    const o = osc(ctx, 'sawtooth', 780, t0, 0.4);
    const v = osc(ctx, 'sine', 9, t0, 0.4); const vg = gain(ctx, 60); chain(v, vg, o.frequency);
    const g = gain(ctx); env(g, t0, 0.2 * (p.k ?? 1), 0.04, 0.3);
    chain(o, filt(ctx, 'bandpass', 1500, 5), g, out);
    return 0.45;
  },
  stoolFall(ctx, out, t0, p, R) {
    B.clang(ctx, out, t0, { k: 0.6 }, R);
    thud(ctx, out, t0, 120, 60, 0.4, 0.15);
    B.clang(ctx, out, t0 + 0.28, { k: 0.3 }, R);
    return 0.9;
  },
  // the jukebox: the coin in, the mechanism, the needle down, a skip
  coin(ctx, out, t0) {
    ping(ctx, out, t0, [[4230, 0.08, 0.1], [6100, 0.04, 0.06]]);
    for (let i = 0; i < 5; i++) ping(ctx, out, t0 + 0.12 + i * 0.07 * (1 - i * 0.12), [[rng(2600, 3600), 0.05 * (1 - i / 6), 0.03]]);
    return 0.6;
  },
  jukeboxMech(ctx, out, t0, p, R) {
    const o = osc(ctx, 'sawtooth', 52, t0, 1.3);
    const g = gain(ctx, 0.0001); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.08, t0 + 0.2); g.gain.setValueAtTime(0.08, t0 + 1.0); g.gain.linearRampToValueAtTime(0.0001, t0 + 1.3);
    chain(o, filt(ctx, 'lowpass', 320), g, out);
    for (const t of [0.05, 0.55, 1.25]) { thud(ctx, out, t0 + t, 170, 90, 0.15, 0.06); burst(ctx, out, R, t0 + t, 'white', ['bandpass', 2200, 3], 0.08, 0.001, 0.02); }
    return 1.4;
  },
  needleDrop(ctx, out, t0, p, R) {
    thud(ctx, out, t0, 95, 60, 0.12, 0.1);
    for (let i = 0; i < 16; i++) burst(ctx, out, R, t0 + 0.05 + Math.random() * 0.9, 'white', ['highpass', 2500], rng(0.01, 0.04), 0.0005, 0.004);
    return 1.0;
  },
  needleScratch(ctx, out, t0, p, R) {
    const n = noise(ctx, R, 'white', t0, 0.4, 1);
    const bp = filt(ctx, 'bandpass', 3000, 2);
    bp.frequency.setValueAtTime(3400, t0); bp.frequency.exponentialRampToValueAtTime(700, t0 + 0.32);
    const g = gain(ctx); env(g, t0, 0.3, 0.005, 0.3);
    chain(n, bp, g, out);
    return 0.45;
  },
  jukebox_hit(ctx, out, t0, p, R) {
    const k = p.power ?? 1;
    thud(ctx, out, t0, 110, 50, 0.6 * Math.min(1.2, k), 0.25);
    burst(ctx, out, R, t0, 'brown', ['lowpass', 600], 0.5 * k, 0.002, 0.18);
    B.needleScratch(ctx, out, t0 + 0.03, {}, R);
    ping(ctx, out, t0, [[1180, 0.05, 0.4], [1731, 0.03, 0.3]]);
    return 0.6;
  },
  coffeePour(ctx, out, t0, p, R) {
    const n = noise(ctx, R, 'white', t0, 1.4, 1);
    const am = osc(ctx, 'sine', 17, t0, 1.4); const ga = gain(ctx, 0.025); chain(am, ga);
    const g = gain(ctx, 0.0001); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.06, t0 + 0.1); g.gain.linearRampToValueAtTime(0.0001, t0 + 1.3); ga.connect(g.gain);
    const bp = filt(ctx, 'bandpass', 1400, 1.5); bp.frequency.linearRampToValueAtTime(2200, t0 + 1.3);
    chain(n, bp, g, out);
    return 1.4;
  },
  // the el overhead, through the wall: felt more than heard
  trainWall(ctx, out, t0, p, R) {
    const dur = p.dur ?? 7;
    const r = noise(ctx, R, 'brown', t0, dur, 0.45);
    const g = gain(ctx, 0.0001);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.55, t0 + dur * 0.35); g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    chain(r, filt(ctx, 'lowpass', 110, 0.9), g, out);
    for (let t = t0 + 0.8; t < t0 + dur - 0.6; t += 0.93) { const k = Math.sin(Math.PI * (t - t0) / dur); thud(ctx, out, t, 75, 50, 0.12 * k, 0.07); thud(ctx, out, t + 0.11, 75, 50, 0.09 * k, 0.07); }
    for (let i = 0; i < 12; i++) { const t = t0 + dur * (0.2 + 0.6 * Math.random()); ping(ctx, out, t, [[rng(3000, 5200), 0.012, 0.04]]); }
    return dur;
  },
  // ---- the search, the matchbook ----------------------------------------------------------------
  crouch(ctx, out, t0, p, R) { burst(ctx, out, R, t0, 'white', ['bandpass', 2300, 0.8], 0.05, 0.05, 0.3); thud(ctx, out, t0 + 0.25, 140, 90, 0.08, 0.06); return 0.45; },
  clothRustle(ctx, out, t0, p, R) {
    const n = noise(ctx, R, 'white', t0, 0.6, 1);
    const am = osc(ctx, 'sine', 9, t0, 0.6); const ga = gain(ctx, 0.035); chain(am, ga);
    const g = gain(ctx); env(g, t0, 0.07, 0.05, 0.45); ga.connect(g.gain);
    chain(n, filt(ctx, 'bandpass', 2500, 0.9), g, out);
    return 0.65;
  },
  matchbook(ctx, out, t0, p, R) { burst(ctx, out, R, t0, 'white', ['bandpass', 3800, 1.5], 0.06, 0.003, 0.05); burst(ctx, out, R, t0 + 0.09, 'white', ['bandpass', 3000, 1.5], 0.04, 0.003, 0.04); return 0.2; },
  pocket(ctx, out, t0, p, R) { burst(ctx, out, R, t0, 'white', ['bandpass', 1900, 0.8], 0.06, 0.03, 0.22); return 0.3; },
  // ---- the fight --------------------------------------------------------------------------------
  // a jab: a short slap of skin with a knock under it
  // (the arcade pass, FIGHT.md v3 §5.6: a landed blow is a sharp CRACK over
  // a low thud; a blocked one a dull knock; a miss a whiff of air)
  f_jab(ctx, out, t0, p, R) {
    const k = p.k ?? 0.5;
    burst(ctx, out, R, t0, 'white', ['highpass', 2600], 0.5 * (0.6 + k), 0.0005, 0.018);
    burst(ctx, out, R, t0 + 0.002, 'white', ['bandpass', 1400, 1.2], 0.3 * (0.6 + k), 0.0008, 0.04);
    thud(ctx, out, t0, 130, 55, 0.55 * (0.6 + k), 0.09);
    return 0.14;
  },
  // a heavy one: a deep thud with the body in it, the slap on top
  f_heavy(ctx, out, t0, p, R) {
    const k = p.k ?? 1;
    const sat = shaper(ctx, 2.2); chain(sat, gain(ctx, 0.9), out);
    thud(ctx, sat, t0, 95, 38, 0.9 * (0.6 + 0.4 * k), 0.22);
    burst(ctx, sat, R, t0, 'brown', ['lowpass', 420], 0.8 * k, 0.001, 0.14);
    burst(ctx, out, R, t0, 'white', ['highpass', 1100], 0.35 * k, 0.0008, 0.05);
    burst(ctx, out, R, t0, 'white', ['highpass', 2800], 0.55 * k, 0.0005, 0.022);
    return 0.3;
  },
  f_hisGrunt(ctx, out, t0, p, R) { return voice(ctx, out, t0 + 0.03, R, { f0: rng(78, 92), f1: 62, dur: rng(0.2, 0.3), formants: [[480, 5], [900, 7], [2300, 10]], breath: 0.6, level: 0.45 * (p.k ?? 1) }); },
  f_myGrunt(ctx, out, t0, p, R) { return voice(ctx, out, t0 + 0.02, R, { f0: rng(100, 118), f1: 84, dur: rng(0.12, 0.2), formants: [[560, 5], [1050, 7], [2500, 10]], breath: 0.7, level: 0.3 * (p.k ?? 1) }); },
  // a blow into the guard: dull, on the forearms
  f_blocked(ctx, out, t0, p, R) {
    const k = p.k ?? 1;
    burst(ctx, out, R, t0, 'brown', ['lowpass', 320], 0.6 * k, 0.001, 0.07);
    thud(ctx, out, t0, 240, 160, 0.25 * k, 0.05);
    burst(ctx, out, R, t0, 'white', ['bandpass', 1800, 1], 0.05 * k, 0.001, 0.03);
    return 0.12;
  },
  f_punchMe(ctx, out, t0, p, R) {
    const k = p.k ?? 1;
    const sat = shaper(ctx, 2.6); chain(sat, gain(ctx, 0.9), out);
    thud(ctx, sat, t0, 80, 34, 0.9 * (0.5 + 0.5 * k), 0.26);
    burst(ctx, sat, R, t0, 'brown', ['lowpass', 520], 0.7 * k, 0.001, 0.16);
    // (the ring in the ears after a big one)
    if (k > 0.8) { const o = osc(ctx, 'sine', 3100, t0 + 0.05, 1.2); const g = gain(ctx); env(g, t0 + 0.05, 0.02, 0.1, 1.0); chain(o, g, out); }
    return 0.4;
  },
  f_guardBreak(ctx, out, t0, p, R) { B.f_punchMe(ctx, out, t0, { k: 0.7 }, R); B.f_scuff(ctx, out, t0 + 0.12, {}, R); return 0.4; },
  // air: a fist or a bottle missing
  f_whiff(ctx, out, t0, p, R) {
    const n = noise(ctx, R, 'pink', t0, 0.25, 1);
    const bp = filt(ctx, 'bandpass', 700, 1.2);
    bp.frequency.setValueAtTime(700, t0); bp.frequency.exponentialRampToValueAtTime(2400, t0 + 0.16);
    const g = gain(ctx); env(g, t0, 0.22 * (p.k ?? 1), 0.04, 0.14);
    chain(n, bp, g, out);
    return 0.25;
  },
  f_wind(ctx, out, t0, p, R) { burst(ctx, out, R, t0, 'white', ['bandpass', 2000, 0.8], 0.03, 0.08, 0.2); return 0.3; },
  // footwork on linoleum: a rubber squeak and a scuff
  f_scuff(ctx, out, t0, p, R) {
    const o = osc(ctx, 'sine', rng(1300, 1900), t0, 0.08);
    o.frequency.exponentialRampToValueAtTime(rng(2000, 2600), t0 + 0.06);
    const g = gain(ctx); env(g, t0, 0.025, 0.01, 0.06);
    chain(o, g, out);
    burst(ctx, out, R, t0, 'white', ['bandpass', 3000, 1], 0.03, 0.005, 0.08);
    return 0.15;
  },
  f_tell(ctx, out, t0, p, R) { return B.f_scuff(ctx, out, t0, p, R); },
  f_grab_bottle(ctx, out, t0) { ping(ctx, out, t0, [[1900, 0.05, 0.1], [3100, 0.03, 0.06]]); return 0.15; },
  f_grab_plate(ctx, out, t0) { ping(ctx, out, t0, [[2200, 0.05, 0.08], [3500, 0.03, 0.05]]); return 0.12; },
  f_grab_stool(ctx, out, t0, p, R) { B.clang(ctx, out, t0, { k: 0.25 }, R); B.f_scuff(ctx, out, t0, {}, R); return 0.5; },
  f_stun(ctx, out, t0) { const o = osc(ctx, 'sine', 2300, t0, 0.9); const g = gain(ctx); env(g, t0, 0.012, 0.05, 0.8); chain(o, g, out); return 0.95; },
  f_bodyThud(ctx, out, t0, p, R) { thud(ctx, out, t0, 85, 40, 0.8 * (p.k ?? 1), 0.3); burst(ctx, out, R, t0, 'brown', ['lowpass', 500], 0.6 * (p.k ?? 1), 0.002, 0.2); return 0.4; },
  f_bodyStools(ctx, out, t0, p, R) {
    B.f_bodyThud(ctx, out, t0, { k: 0.7 }, R);
    for (let i = 0; i < 3; i++) B.clang(ctx, out, t0 + 0.05 + i * rng(0.12, 0.25), { k: 0.5 - i * 0.1 }, R);
    return 1.0;
  },
  f_bodyFloor(ctx, out, t0, p, R) { B.f_bodyThud(ctx, out, t0, { k: 1 }, R); burst(ctx, out, R, t0 + 0.01, 'white', ['highpass', 1500], 0.12, 0.001, 0.05); return 0.4; },
  // a body on the wet pavement in the glass
  f_bodyPavement(ctx, out, t0, p, R) {
    B.f_bodyThud(ctx, out, t0, { k: 1 }, R);
    burst(ctx, out, R, t0 + 0.01, 'white', ['bandpass', 1800, 0.7], 0.25, 0.003, 0.25);
    glassFall(ctx, out, t0 + 0.02, R, 0.5, 0.6, 10);
    return 0.8;
  },
  // ---- what breaks --------------------------------------------------------------------------------
  break_bottle(ctx, out, t0, p, R) { thud(ctx, out, t0, 180, 90, 0.3, 0.05); glassFall(ctx, out, t0, R, 0.8, 0.35, 12); burst(ctx, out, R, t0 + 0.02, 'pink', ['bandpass', 1400, 0.8], 0.1, 0.01, 0.25); return 0.6; },
  break_tumbler(ctx, out, t0, p, R) { glassFall(ctx, out, t0, R, 0.6, 0.3, 8); return 0.45; },
  break_cup(ctx, out, t0, p, R) { thud(ctx, out, t0, 260, 150, 0.2, 0.04); ping(ctx, out, t0, [[1800, 0.1, 0.1], [2700, 0.07, 0.08]]); glassFall(ctx, out, t0 + 0.01, R, 0.4, 0.3, 6); return 0.45; },
  break_plate(ctx, out, t0, p, R) { thud(ctx, out, t0, 230, 130, 0.3, 0.05); ping(ctx, out, t0, [[2050, 0.12, 0.12], [3300, 0.08, 0.1]]); glassFall(ctx, out, t0 + 0.01, R, 0.5, 0.4, 9); return 0.55; },
  break_stool(ctx, out, t0, p, R) { B.clang(ctx, out, t0, { k: 0.8 }, R); burst(ctx, out, R, t0, 'brown', ['bandpass', 400, 1], 0.5, 0.001, 0.12); B.clang(ctx, out, t0 + 0.3, { k: 0.35 }, R); return 0.9; },
  break_table(ctx, out, t0, p, R) {
    burst(ctx, out, R, t0, 'brown', ['bandpass', 350, 0.8], 0.8, 0.001, 0.15);
    for (let i = 0; i < 10; i++) burst(ctx, out, R, t0 + Math.random() * 0.25, 'white', ['bandpass', rng(800, 2500), 2], rng(0.1, 0.25), 0.0005, 0.02);
    thud(ctx, out, t0 + 0.2, 110, 60, 0.3, 0.12);
    return 0.5;
  },
  // the plate-glass window: a crack like a shot, then a long fall of glass on stone
  break_glass_big(ctx, out, t0, p, R, send) {
    const trim = gain(ctx, 0.75); trim.connect(out); out = trim;
    const sat = shaper(ctx, 2); chain(sat, gain(ctx, 0.9), out);
    burst(ctx, sat, R, t0, 'white', ['highpass', 900], 0.9, 0.0008, 0.07);
    thud(ctx, sat, t0, 130, 50, 0.6, 0.18);
    if (send) { const gs = gain(ctx); env(gs, t0, 0.8, 0.002, 0.1); chain(noise(ctx, R, 'white', t0, 0.2), filt(ctx, 'highpass', 900), gs, send); }
    glassFall(ctx, out, t0 + 0.03, R, 1.2, 2.2, 46);
    // the heavy sheets landing on the pavement
    for (let i = 0; i < 4; i++) { const t = t0 + 0.35 + i * rng(0.15, 0.35); burst(ctx, out, R, t, 'white', ['bandpass', rng(1500, 3000), 0.8], 0.3 - i * 0.05, 0.002, 0.12); }
    return 2.6;
  },
  topple_stool(ctx, out, t0, p, R) { return B.stoolFall(ctx, out, t0, p, R); },
  topple_table(ctx, out, t0, p, R) { thud(ctx, out, t0, 120, 60, 0.5, 0.18); burst(ctx, out, R, t0, 'brown', ['lowpass', 500], 0.4, 0.002, 0.2); return 0.4; },
});

// ---------------------------------------------------------------------------
// The sounds the other lanes ask for by name (the integration's list, wave A
// fix round): what the street's things and the diner's small china make when
// a round, a fist or a body finds them. Same kit.
// wood splitting: a dry crack, splinters ticking off, a knock under it
function splinter(ctx, out, t0, R, k = 1, n = 9) {
  burst(ctx, out, R, t0, 'white', ['bandpass', 1900, 1.1], 0.45 * k, 0.0006, 0.05);
  thud(ctx, out, t0, 210, 110, 0.35 * k, 0.07);
  for (let i = 0; i < n; i++) burst(ctx, out, R, t0 + 0.01 + Math.random() * 0.22, 'white', ['bandpass', rng(900, 3200), 3], rng(0.05, 0.16) * k, 0.0005, rng(0.01, 0.03));
}
// canvas or paper going: a ragged tear, its grain chopped by a fast flutter
function tear(ctx, out, t0, R, dur, f0, f1, k = 1, rate = 38) {
  const n = noise(ctx, R, 'white', t0, dur, 1);
  const bp = filt(ctx, 'bandpass', f0, 1.3);
  bp.frequency.setValueAtTime(f0, t0); bp.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  const am = osc(ctx, 'square', rate, t0, dur); const ga = gain(ctx, 0.5 * k); chain(am, ga);
  const g = gain(ctx); env(g, t0, 0.22 * k, 0.01, dur * 0.8, dur * 0.1); ga.connect(g.gain);
  chain(n, bp, g, out);
}
Object.assign(B, {
  // a round on iron or a steel post: a hard tick and an inharmonic ring (p.big: 1 the el's iron, 0.5 a post)
  ring(ctx, out, t0, p, R) {
    const k = p.big ?? 0.7;
    burst(ctx, out, R, t0, 'white', ['highpass', 3000], 0.25, 0.0005, 0.02);
    const f = rng(1300, 2100) * (1.25 - 0.4 * k);
    ping(ctx, out, t0, [[f, 0.12, 0.25 + 0.7 * k], [f * 2.76, 0.06, 0.18 + 0.4 * k], [f * 5.4, 0.03, 0.1 + 0.2 * k], [f * 0.53, 0.05 * k, 0.4 * k + 0.1]]);
    return 0.35 + 0.8 * k;
  },
  // a pipe holed: the pop, then water rushing out under pressure
  burst_water(ctx, out, t0, p, R) {
    const dur = p.dur ?? 1.6;
    thud(ctx, out, t0, 160, 70, 0.3, 0.08);
    burst(ctx, out, R, t0, 'white', ['bandpass', 1400, 1], 0.25, 0.002, 0.08);
    const n = noise(ctx, R, 'pink', t0 + 0.02, dur, 1.1);
    const g = gain(ctx, 0.0001);
    g.gain.setValueAtTime(0.0001, t0 + 0.02); g.gain.linearRampToValueAtTime(0.3, t0 + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    chain(n, filt(ctx, 'highpass', 500), filt(ctx, 'lowpass', 4200), g, out);
    return dur + 0.1;
  },
  // a barrel holed low: a dark dribble, a few glugs slowing
  burst_leak(ctx, out, t0, p, R) {
    for (let i = 0; i < 7; i++) {
      const t = t0 + i * (0.09 + i * 0.03);
      const f = rng(380, 560) * (1 - i * 0.05);
      const g = gain(ctx); env(g, t, 0.9 * (1 - i / 9), 0.004, 0.05);
      chain(noise(ctx, R, 'white', t, 0.07, 1), filt(ctx, 'bandpass', f, 5), g, out);
      const o = osc(ctx, 'sine', f * 0.5, t, 0.05); o.frequency.exponentialRampToValueAtTime(f * 0.7, t + 0.04);
      const go = gain(ctx); env(go, t, 0.07 * (1 - i / 9), 0.003, 0.04); chain(o, go, out);
    }
    burst(ctx, out, R, t0, 'pink', ['bandpass', 900, 0.8], 0.08, 0.05, 0.9);
    return 1.2;
  },
  // a shop sign off its brackets: the bracket's creak, the fall, the sign flat on the pavement
  sign_drop(ctx, out, t0, p, R) {
    const o = osc(ctx, 'sawtooth', 240, t0, 0.3);
    o.frequency.setValueAtTime(260, t0); o.frequency.exponentialRampToValueAtTime(150, t0 + 0.25);
    const g = gain(ctx); env(g, t0, 0.05, 0.03, 0.22);
    chain(o, filt(ctx, 'bandpass', 900, 4), g, out);
    const t1 = t0 + 0.42;
    thud(ctx, out, t1, 140, 60, 0.5, 0.14);
    burst(ctx, out, R, t1, 'white', ['bandpass', 1600, 0.9], 0.3, 0.001, 0.09);
    B.clang(ctx, out, t1 + 0.02, { k: 0.35 }, R);
    return 1.0;
  },
  // the awning's canvas torn by a round or a body
  awning_tear(ctx, out, t0, p, R) { tear(ctx, out, t0, R, 0.55, 2600, 900, 1, 41); tear(ctx, out, t0 + 0.3, R, 0.35, 1800, 700, 0.5, 29); return 0.75; },
  // a neon tube shot out: a glassy pop and the arc's buzz dying
  neon_pop(ctx, out, t0, p, R) {
    burst(ctx, out, R, t0, 'white', ['highpass', 2500], 0.4, 0.0004, 0.04);
    thud(ctx, out, t0, 520, 180, 0.2, 0.04);
    const o = osc(ctx, 'sawtooth', 120, t0 + 0.02, 0.4);
    const g = gain(ctx, 0.0001); g.gain.setValueAtTime(0.06, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
    chain(o, filt(ctx, 'bandpass', 1100, 1), g, out);
    glassFall(ctx, out, t0 + 0.03, R, 0.35, 0.4, 7);
    return 0.55;
  },
  // ---- what breaks (the rest of lane 3's kinds) ----------------------------------------------
  break_saucer(ctx, out, t0, p, R) { thud(ctx, out, t0, 280, 170, 0.18, 0.035); ping(ctx, out, t0, [[2400, 0.08, 0.08], [3700, 0.05, 0.06]]); glassFall(ctx, out, t0 + 0.01, R, 0.4, 0.3, 6); return 0.4; },
  break_mug(ctx, out, t0, p, R) { thud(ctx, out, t0, 190, 110, 0.35, 0.06); ping(ctx, out, t0, [[1450, 0.09, 0.08], [2300, 0.05, 0.06]]); glassFall(ctx, out, t0 + 0.015, R, 0.45, 0.35, 6); return 0.5; },
  // the pie case: its four panes going, and the pie stand's tin
  break_pieCase(ctx, out, t0, p, R) {
    burst(ctx, out, R, t0, 'white', ['highpass', 1400], 0.5, 0.0006, 0.06);
    glassFall(ctx, out, t0 + 0.02, R, 0.9, 0.9, 22);
    B.clang(ctx, out, t0 + 0.25, { k: 0.2 }, R);
    return 1.1;
  },
  break_crate(ctx, out, t0, p, R) { splinter(ctx, out, t0, R, 1, 12); thud(ctx, out, t0 + 0.12, 150, 80, 0.25, 0.1); return 0.5; },
  // a barrel stove in: the hollow boom, the staves, a hoop ringing
  break_barrel(ctx, out, t0, p, R) {
    thud(ctx, out, t0, 110, 55, 0.6, 0.3);
    burst(ctx, out, R, t0, 'brown', ['lowpass', 380], 0.5, 0.002, 0.25);
    splinter(ctx, out, t0 + 0.02, R, 0.6, 7);
    ping(ctx, out, t0 + 0.05, [[640, 0.04, 0.5], [1510, 0.025, 0.3]]);
    return 0.7;
  },
  break_sign(ctx, out, t0, p, R) { splinter(ctx, out, t0, R, 0.8, 8); B.clang(ctx, out, t0 + 0.05, { k: 0.3 }, R); return 0.6; },
  break_pipe(ctx, out, t0, p, R) { B.clang(ctx, out, t0, { k: 0.7 }, R); burst(ctx, out, R, t0, 'white', ['bandpass', 2600, 2], 0.12, 0.001, 0.06); return 0.6; },
  break_awning(ctx, out, t0, p, R) { tear(ctx, out, t0, R, 0.7, 2400, 700, 1.2, 36); B.clang(ctx, out, t0 + 0.45, { k: 0.35 }, R); return 1.0; },
  // a bundle of papers blown apart: a flurry of sheets
  break_papers(ctx, out, t0, p, R) {
    burst(ctx, out, R, t0, 'white', ['bandpass', 1800, 0.7], 0.25, 0.002, 0.08);
    for (let i = 0; i < 6; i++) tear(ctx, out, t0 + 0.04 + i * rng(0.04, 0.1), R, rng(0.15, 0.3), rng(3000, 4200), rng(1500, 2200), 0.35, rng(24, 50));
    return 0.8;
  },
  // an overhead wire cut: the snap, a twang, the spark's crackle
  break_wire(ctx, out, t0, p, R) {
    burst(ctx, out, R, t0, 'white', ['highpass', 2200], 0.3, 0.0005, 0.03);
    const o = osc(ctx, 'triangle', 190, t0, 0.6);
    o.frequency.setValueAtTime(230, t0); o.frequency.exponentialRampToValueAtTime(120, t0 + 0.5);
    const g = gain(ctx); env(g, t0, 0.12, 0.002, 0.5);
    chain(o, filt(ctx, 'lowpass', 1400), g, out);
    for (let i = 0; i < 10; i++) burst(ctx, out, R, t0 + Math.random() * 0.35, 'white', ['highpass', 3400], rng(0.03, 0.08), 0.0004, 0.006);
    return 0.65;
  },
  break_neon(ctx, out, t0, p, R) { glassFall(ctx, out, t0, R, 0.6, 0.5, 12); return 0.6; },
  // anything else (the fallback for a kind with no sound of its own): a crunch
  break_thing(ctx, out, t0, p, R) {
    thud(ctx, out, t0, 170, 80, 0.35, 0.08);
    burst(ctx, out, R, t0, 'brown', ['bandpass', 600, 0.9], 0.35, 0.001, 0.1);
    for (let i = 0; i < 5; i++) burst(ctx, out, R, t0 + 0.01 + Math.random() * 0.15, 'white', ['bandpass', rng(1200, 3500), 2], rng(0.05, 0.12), 0.0005, 0.02);
    return 0.4;
  },
  // knocked over whole
  topple_barrel(ctx, out, t0, p, R) {
    thud(ctx, out, t0, 95, 50, 0.55, 0.28);
    burst(ctx, out, R, t0, 'brown', ['lowpass', 420], 0.35, 0.003, 0.25);
    // (it rolls a little: a rumble that slows)
    const n = noise(ctx, R, 'brown', t0 + 0.2, 0.9, 1);
    const g = gain(ctx, 0.0001); g.gain.setValueAtTime(0.12, t0 + 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.1);
    const am = osc(ctx, 'sine', 5, t0 + 0.2, 0.9); const ga = gain(ctx, 0.06); chain(am, ga, g.gain);
    chain(n, filt(ctx, 'lowpass', 300), g, out);
    return 1.15;
  },
  topple_crate(ctx, out, t0, p, R) { thud(ctx, out, t0, 150, 75, 0.45, 0.14); burst(ctx, out, R, t0, 'white', ['bandpass', 1300, 1], 0.12, 0.002, 0.08); burst(ctx, out, R, t0 + 0.06, 'brown', ['bandpass', 500, 1], 0.2, 0.01, 0.2); return 0.4; },
  topple_thing(ctx, out, t0, p, R) { thud(ctx, out, t0, 130, 65, 0.4, 0.16); burst(ctx, out, R, t0, 'brown', ['lowpass', 520], 0.3, 0.003, 0.18); return 0.35; },
  // the jukebox changing records: the arm lifts, the mechanism turns, the next
  // record drops onto the platter (2 s of clunks)
  jukebox_change(ctx, out, t0, p, R) {
    ping(ctx, out, t0, [[1200, 0.04, 0.05]]);
    B.jukeboxMech(ctx, out, t0 + 0.08, p, R);
    thud(ctx, out, t0 + 1.55, 120, 70, 0.18, 0.08);
    burst(ctx, out, R, t0 + 1.56, 'white', ['bandpass', 1600, 2], 0.06, 0.001, 0.03);
    B.needleDrop(ctx, out, t0 + 1.8, p, R);
    return 2.8;
  },
});
// a name no sound answers (a new kind of lane 3's): its family's fallback
const FAMILY = [['break_', 'break_thing'], ['topple_', 'topple_thing'], ['burst_', 'burst_water']];
function soundFor(name) {
  if (B[name]) return name;
  for (const [pre, alt] of FAMILY) if (name.startsWith(pre)) return alt;
  return null;
}

// The diner's own sound (sfx.room('diner')): nodes that live while the ear
// is in the room. Rain on the plate glass (soft, close, no low end), the
// room tone, the refrigerator's hum with its slow beat, the fans, a murmur
// of two voices as filtered noise, the urns' hiss. Returns { gain, stop }.
function dinerBed(ctx, R, out) {
  const master = gain(ctx, 0.0001);
  master.connect(out);
  const srcs = [];
  const loopN = (kind, rate = 1) => { const s = ctx.createBufferSource(); s.buffer = R[kind]; s.loop = true; s.playbackRate.value = rate; s.start(ctx.currentTime, Math.random() * 2); srcs.push(s); return s; };
  const lfo = (f, depth, param, type = 'sine') => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.start(); srcs.push(o); const g = gain(ctx, depth); o.connect(g).connect(param); return o; };
  // rain on the glass: bright, close, patter modulated by slow gusts
  const rg = gain(ctx, 0.05); chain(loopN('white'), filt(ctx, 'highpass', 1600), filt(ctx, 'lowpass', 6500, 0.5), rg, master);
  lfo(0.13, 0.02, rg.gain);
  const pt = gain(ctx, 0.02); chain(loopN('pink', 1.3), filt(ctx, 'bandpass', 3800, 1.4), pt, master);
  lfo(7.3, 0.012, pt.gain, 'square');
  // the room tone
  chain(loopN('brown', 0.8), filt(ctx, 'lowpass', 260), gain(ctx, 0.12), master);
  // the refrigerator: 60 and 120 Hz, two a hair apart so it beats slowly
  for (const [f, a] of [[60, 0.02], [120, 0.014], [120.6, 0.014], [180, 0.004]]) { const o = ctx.createOscillator(); o.frequency.value = f; o.start(); srcs.push(o); chain(o, gain(ctx, a), master); }
  // the fans: a low whoosh that turns at ~3 Hz
  const fg = gain(ctx, 0.025); chain(loopN('pink', 0.7), filt(ctx, 'lowpass', 420), fg, master);
  lfo(2.8, 0.012, fg.gain);
  // two voices murmuring: band-passed noise, syllables in a slow uneven swing
  for (const [f, rate, a] of [[420, 3.1, 0.035], [640, 4.3, 0.025]]) {
    const vg = gain(ctx, a * 0.5);
    chain(loopN('pink', 1), filt(ctx, 'bandpass', f, 2.2), filt(ctx, 'bandpass', f * 1.9, 1.5), vg, master);
    lfo(rate, a * 0.5, vg.gain);
    lfo(rate * 0.23, a * 0.4, vg.gain);
  }
  // the urns' hiss
  chain(loopN('white', 1.1), filt(ctx, 'highpass', 5200), gain(ctx, 0.008), master);
  return {
    gain: master,
    stop() { const t = ctx.currentTime; master.gain.setTargetAtTime(0, t, 0.15); setTimeout(() => { for (const s of srcs) { try { s.stop(); } catch (e) { /* */ } } try { master.disconnect(); } catch (e) { /* */ } }, 1500); },
  };
}

// (round 2: the fight's own new sounds, src/audio/fight.js)
Object.assign(B, FIGHT_SOUNDS);

// ---------------------------------------------------------------------------
// The rooms sfx.room(name) knows (CONTRACTS §12.2). A room definition:
//   inside    true (default for any name but 'street'): the street goes
//             through the wall, as below
//   wall      the wall's low-pass, Hz (default 600: the diner's)
//   wallGain  the street's level through the wall (default 0.25, 12 dB down)
//   bed(ctx, R, out, kit) -> { gain: GainNode, stop() }: the room's own sound,
//             built when the ear comes in (faded to 1 in 0.4 s) and stopped
//             when it leaves for another room
// A name the table does not know is an interior with no bed (as before).
export const ROOMS = {
  street: { inside: false },
  diner: { bed: dinerBed },
};

// a looping noise source and a slow modulator for a room's bed (srcs: the
// list the bed stops)
function loopN(ctx, R, kind, rate = 1, srcs = null) {
  const s = ctx.createBufferSource(); s.buffer = R[kind]; s.loop = true; s.playbackRate.value = rate;
  s.start(ctx.currentTime, Math.random() * 2); if (srcs) srcs.push(s); return s;
}
function lfo(ctx, f, depth, param, type = 'sine', srcs = null) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.start(); if (srcs) srcs.push(o);
  const g = gain(ctx, depth); o.connect(g).connect(param); return o;
}

// Sounds of their own files (wave B seams, docs/story/seams/Y.md):
// src/audio/sounds/*.js default-exporting
//   (kit) => ({ sounds: { name(ctx, out, t0, p, R, send) -> seconds }, rooms?: { name: def } })
// kit: every helper the built-in sounds use, and the table itself (kit.B:
// a file's sound may play a built-in one: kit.B.clang(ctx, out, t0, { k }, R)).
// A sound or a room named twice throws at load.
export const KIT = {
  burst, thud, ping, chain, osc, gain, env, filt, voice, noise, shaper, loopN, lfo,
  glassFall, splinter, tear, rng, dinerBed, B, ROOMS,
};
const SOUND_FILES = import.meta.glob('./sounds/*.js', { eager: true });
for (const path of Object.keys(SOUND_FILES).sort()) {
  const make = SOUND_FILES[path].default;
  if (typeof make !== 'function') throw new Error(`sfx: ${path} must default-export (kit) => ({ sounds, rooms? })`);
  const { sounds = {}, rooms = {} } = make(KIT) || {};
  for (const [name, fn] of Object.entries(sounds)) {
    if (B[name]) throw new Error(`sfx: sound '${name}' defined twice (${path})`);
    if (typeof fn !== 'function') throw new Error(`sfx: sound '${name}' must be (ctx, out, t0, p, R, send) -> seconds (${path})`);
    B[name] = fn;
  }
  for (const [name, def] of Object.entries(rooms)) {
    if (ROOMS[name]) throw new Error(`sfx: room '${name}' defined twice (${path})`);
    ROOMS[name] = def;
  }
}
export const SOUND_NAMES = Object.keys(B);

// ---------------------------------------------------------------------------
export class Sfx {
  // forceMute: start silent whatever was saved (the URL's mute=1, or an
  // automated browser: a test run never makes a sound on the machine); M
  // still turns it on, and the saved choice is left as the player made it
  constructor({ enabled = true, forceMute = false } = {}) {
    this.enabled = enabled;
    this.ctx = null;
    this.muted = false;
    this.volume = 0.8;
    try {
      const v = parseFloat(localStorage.getItem('noir.volume'));
      if (Number.isFinite(v)) this.volume = Math.min(1, Math.max(0, v));
      this.muted = localStorage.getItem('noir.muted') === '1';
    } catch (e) { /* storage blocked: defaults */ }
    this.forceMute = !!forceMute;
    if (forceMute) this.muted = true;
    this.loops = new Map();   // key -> { src nodes, gain, panner }
    this.heartT = 0;
    this.lowK = 0;
    this.gust = 0; this.gustV = 0;
    this.dripT = 0;
    this.ends = [];
    this.stats = { played: 0, dropped: 0 };
  }

  // the first click (pointer-lock start): create / resume the context
  unlock() {
    if (!this.enabled) return;
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC({ latencyHint: 'interactive' });
        this.build();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    } catch (e) { this.ctx = null; }
  }

  build() {
    const ctx = this.ctx;
    this.R = res(ctx);
    // glue compressor: a high threshold and a slow attack so a gunshot's
    // transient gets through untouched, then a brick-wall limiter so the
    // hot gun voices never clip the output
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -12; this.comp.knee.value = 8; this.comp.ratio.value = 2.5;
    this.comp.attack.value = 0.02; this.comp.release.value = 0.3;
    this.lim = ctx.createDynamicsCompressor();
    this.lim.threshold.value = -2; this.lim.knee.value = 0; this.lim.ratio.value = 20;
    this.lim.attack.value = 0.001; this.lim.release.value = 0.08;
    this.master = gain(ctx, this.muted ? 0 : this.volume);
    this.master.connect(this.comp).connect(this.lim).connect(ctx.destination);
    this.bus = gain(ctx, 1.0); this.bus.connect(this.master);
    // the ambience sits well under the guns and ducks when they fire
    this.ambLevel = 0.4;
    // the street heard through a wall (sfx.room): the rain beds, thunder,
    // the train and far shots go through a low-pass and a level that the
    // room sets (the street: wide open; the diner: 600 Hz, 12 dB down; a
    // broken window lets half of it back in)
    this.wall = filt(ctx, 'lowpass', 20000, 0.7);
    this.wallG = gain(ctx, 1);
    this.wall.connect(this.wallG).connect(this.master);
    this.street = gain(ctx, 1); this.street.connect(this.wall);
    this.amb = gain(ctx, this.ambLevel); this.amb.connect(this.wall);
    // the street's tail: a convolution reverb on a send
    this.verb = ctx.createConvolver();
    this.verb.buffer = this.R.ir;
    this.send = gain(ctx, 0.75);
    this.send.connect(this.verb).connect(filt(ctx, 'lowpass', 2800)).connect(this.bus);
    this.startRain();
  }

  get live() { return !!this.ctx && this.ctx.state !== 'closed'; }
  get voices() { const now = this.ctx ? this.ctx.currentTime : 0; return this.ends.filter((e) => e > now).length; }

  setMuted(m) {
    this.muted = m;
    // (a forced mute is the run's, not the player's: it is not saved)
    if (!this.forceMute) try { localStorage.setItem('noir.muted', m ? '1' : '0'); } catch (e) { /* ignore */ }
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : this.volume, this.ctx.currentTime, 0.03);
  }
  toggleMute() { this.setMuted(!this.muted); return this.muted; }
  // the pause card (Phase 3b): the whole mix drops to a murmur (the rain
  // keeps falling behind the card), and comes back on resume
  // (not duck(): that is the guns' sidechain duck of the ambience, below)
  pauseMix(on) {
    this.ducked = !!on;
    if (this.master && !this.muted) this.master.gain.setTargetAtTime(this.volume * (on ? 0.22 : 1), this.ctx.currentTime, 0.08);
  }
  setVolume(v) {
    this.volume = Math.min(1, Math.max(0, v));
    try { localStorage.setItem('noir.volume', String(this.volume.toFixed(2))); } catch (e) { /* ignore */ }
    if (this.master && !this.muted) this.master.gain.setTargetAtTime(this.volume * (this.ducked ? 0.22 : 1), this.ctx.currentTime, 0.03);
    return this.volume;
  }

  // the listener rides the camera (per rendered frame)
  listen(camera) {
    if (!this.live) return;
    const L = this.ctx.listener, e = camera.matrixWorld.elements, p = camera.position, t = this.ctx.currentTime;
    const set = (param, v) => { if (param) param.setTargetAtTime(v, t, 0.02); };
    if (L.positionX) {
      set(L.positionX, p.x); set(L.positionY, p.y); set(L.positionZ, p.z);
      set(L.forwardX, -e[8]); set(L.forwardY, -e[9]); set(L.forwardZ, -e[10]);
      set(L.upX, e[4]); set(L.upY, e[5]); set(L.upZ, e[6]);
    } else if (L.setPosition) {
      L.setPosition(p.x, p.y, p.z);
      L.setOrientation(-e[8], -e[9], -e[10], e[4], e[5], e[6]);
    }
  }

  // a voice's destination: a PannerNode at pos (world), or the bus direct
  dest(pos, { ref = 3, roll = 1, max = 250, street = false } = {}) {
    const ctx = this.ctx;
    const bus = street ? this.street : this.bus;
    if (!pos) return bus;
    const pn = ctx.createPanner();
    pn.panningModel = 'equalpower';
    pn.distanceModel = 'inverse';
    pn.refDistance = ref; pn.rolloffFactor = roll; pn.maxDistance = max;
    if (pn.positionX) { pn.positionX.value = pos.x; pn.positionY.value = pos.y; pn.positionZ.value = pos.z; } else pn.setPosition(pos.x, pos.y, pos.z);
    pn.connect(bus);
    return pn;
  }

  // play a one-shot: name, world pos (null = at the ear), params
  play(name, pos = null, p = {}, opts = {}) {
    if (!this.live) return 0;
    // (a name with no sound of its own takes its family's: break_, topple_,
    // burst_; the names seen so are kept in sfx.aliased for the tests)
    const s = soundFor(name);
    if (!s) return 0;
    if (s !== name) (this.aliased || (this.aliased = new Set())).add(name);
    name = s;
    // the voice cap is kept on the AUDIO clock (a throttled background tab
    // or a fast-forwarded sim must not wedge it): end times of live voices
    const now = this.ctx.currentTime;
    // (a hush: a retry's room set again behind the black, silently)
    if (now < (this.hushEnd || 0)) return 0;
    if (this.ends.length > 64) this.ends = this.ends.filter((e) => e > now);
    if (this.ends.length > 90) { this.stats.dropped++; return 0; }
    try {
      const t0 = now + (opts.delay || 0) + 0.005;
      const out = gain(this.ctx, opts.gain ?? 1);
      out.connect(this.dest(pos, opts));
      const dur = B[name](this.ctx, out, t0, p, this.R, opts.send === false ? null : this.send);
      this.ends.push(t0 + dur);
      this.stats.played++;
      // (the sources stop by themselves; the voice's gain and panner are let
      // go once it has rung out)
      setTimeout(() => { try { out.disconnect(); } catch (e) { /* gone */ } }, ((opts.delay || 0) + dur + 0.5) * 1000);
      return dur;
    } catch (e) { return 0; }
  }

  // no one-shot plays for `secs` (the audio clock): what a re-staging sets
  // off behind the black (a brawl's retry) is not heard. Loops, the rain,
  // the room's bed and the music go on.
  hush(secs = 1) {
    if (!this.live) return;
    this.hushEnd = Math.max(this.hushEnd || 0, this.ctx.currentTime + secs);
  }

  // ---- the game's calls ------------------------------------------------------
  // sidechain-style duck of the ambience: 10 ms in, ~350 ms out (a burst
  // holds it down; the rain swells back after the last round)
  duck(depth = 0.6, release = 0.35) {
    if (!this.amb) return;
    const t = this.ctx.currentTime, g = this.amb.gain;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(this.ambLevel * (1 - depth), t, 0.01);
    g.setTargetAtTime(this.ambLevel, t + 0.09, release);
  }
  tommy() { this.play('tommy', null, {}, { gain: 1.0 }); this.duck(0.6, 0.35); }
  pistol(pos, dist) {
    // (sound travels: a far shot arrives after its flash)
    this.play('pistol', pos, { dist }, { delay: Math.min(0.25, dist / 343), ref: 4, street: true });
  }
  ricochet(pos) { this.play('ricochet', pos, {}, { ref: 3 }); }
  glass(pos, k = 1) { this.play('glass', pos, { k }, { ref: 3 }); }
  explosion(pos) { this.play('explosion', pos, {}, { ref: 8, roll: 0.7, gain: 1.2 }); this.duck(0.75, 1.2); }
  debris(pos, k) { this.play('debris', pos, { k }, { ref: 3 }); }
  clang(pos, k = 1) { this.play('clang', pos, { k }, { ref: 3 }); }
  hiss(pos) { this.play('hiss', pos, { dur: 2.5 }, { ref: 4 }); }
  tyre(pos) { this.play('tyre', pos, {}, { ref: 3 }); }
  steam(pos, k) { this.play('steam', pos, { k }, { ref: 3 }); }
  hydrant(pos) { this.play('hydrant', pos, { dur: 3 }, { ref: 4 }); this.loop('hydrant', pos, 0.35, 'pink', 700, 5000); }
  zap(pos) { this.play('zap', pos, {}, { ref: 4 }); }
  buzz(pos, dur) { this.play('buzz', pos, { dur }, { ref: 4 }); }
  step(pos, run, player, lino = false) {
    if (player) this.play('step', null, { run, k: 0.55, lino }, { send: false });
    else if (pos) this.play('step', pos, { run }, { ref: 2, roll: 1.4, max: 40, send: false });
  }
  reload() { this.play('reload', null, {}, { send: false, gain: 0.8 }); }
  grunt(pos) { this.play('grunt', pos, {}, { ref: 3 }); }
  death(pos) { this.play('death', pos, {}, { ref: 3 }); }
  casing(pos, n) { this.play('casing', pos, { n }, { ref: 1.5, roll: 1.5, max: 30, send: false }); }
  thunder(s, far, dbl) { this.play('thunder', null, { s, far }, { gain: 0.9, street: true }); if (dbl) this.play('thunder', null, { s: s * 0.7, far: Math.min(1, far + 0.2) }, { delay: 0.6, gain: 0.7, street: true }); }
  squeal(k, pos) {
    if (!this.live) return;
    const now = this.ctx.currentTime;
    if (now < (this.squealUntil || 0)) return;
    this.squealUntil = now + 0.5;
    this.play('squeal', pos, { k, dur: 0.7 }, { ref: 8, roll: 0.8 });
  }

  // ---- loops: rain bed, fires, the train, the hydrant -------------------------
  // a looping filtered-noise voice at pos, its level driven per step
  loop(key, pos, level, kind = 'brown', lp = 500, hp = 0, street = false) {
    if (!this.live) return null;
    let L = this.loops.get(key);
    if (!L) {
      const ctx = this.ctx;
      const s = ctx.createBufferSource();
      s.buffer = this.R[kind]; s.loop = true;
      s.start(ctx.currentTime, Math.random() * 2);
      const g = gain(ctx, 0);
      let node = s;
      if (hp) node = chain(node, filt(ctx, 'highpass', hp));
      node = chain(node, filt(ctx, 'lowpass', lp, 0.7), g);
      const dst = pos ? this.dest(pos, { ref: 5, roll: 0.9, street }) : (key.startsWith('rain') ? this.amb : street ? this.street : this.bus);
      g.connect(dst);
      L = { s, g, dst, pos: pos ? pos.clone() : null };
      this.loops.set(key, L);
    }
    L.g.gain.setTargetAtTime(level, this.ctx.currentTime, 0.15);
    if (pos && L.dst.positionX) { L.dst.positionX.setTargetAtTime(pos.x, this.ctx.currentTime, 0.05); L.dst.positionY.setTargetAtTime(pos.y, this.ctx.currentTime, 0.05); L.dst.positionZ.setTargetAtTime(pos.z, this.ctx.currentTime, 0.05); }
    return L;
  }
  stopLoop(key) {
    const L = this.loops.get(key);
    if (!L) return;
    L.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
    setTimeout(() => { try { L.s.stop(); L.g.disconnect(); } catch (e) { /* gone */ } }, 2000);
    this.loops.delete(key);
  }

  startRain() {
    // the bed: pink noise, band-limited; the patter: bright white noise
    // (a bed, not a wall of noise: it sits ~9 dB under where it began, so
    // the guns own the mix and the drips and thunder read against it)
    this.loop('rainBed', null, 0.24, 'pink', 2600, 250);
    this.loop('rainPatter', null, 0.035, 'white', 7000, 3800);
    this.loop('rainLow', null, 0.1, 'brown', 400, 60);
  }

  // The ambience of the place the ear is in (CONTRACTS §12.2): 'street'
  // (the rain bed as it always was) or an interior ('diner', and wave B's
  // rooms), whose walls muffle the rain; a doorway cross-fades in 0.4 s.
  // Indoors the street goes through the wall (600 Hz, 12 dB down) unless a
  // window is out (openK: 0 shut .. 1 open); the room's own bed comes up
  // (the diner: game/dinerBed). A doorway cross-fades in 0.4 s.
  // (the rooms: the ROOMS table above, which a sound file can add to)
  room(name = 'street') {
    this.roomName = name;
    if (!this.live) return;
    const def = ROOMS[name] || {};
    const inside = def.inside ?? name !== 'street';
    const ctx = this.ctx, t = ctx.currentTime, tau = 0.4 / 3;
    const k = inside ? Math.max(0, Math.min(1, this.openK || 0)) : 1;
    const hz = def.wall ?? 600, lo = def.wallGain ?? 0.25;
    this.wall.frequency.setTargetAtTime(hz * Math.pow(20000 / hz, k), t, tau);
    this.wallG.gain.setTargetAtTime(lo + (1 - lo) * k, t, tau);
    this.roomGain = 1;
    if (this.bed && this.bedName !== name) { this.bed.stop(); this.bed = null; }
    if (def.bed) {
      if (!this.bed) { this.bed = def.bed(ctx, this.R, this.bus, KIT); this.bedName = name; }
      this.bed.gain.gain.setTargetAtTime(1, t, tau);
    }
  }

  // the fight's sounds (game/Brawl.js): a name of the fight's table
  fight(name, pos = null, p = {}) { this.play('f_' + name, pos, p, { ref: 2 }); }
  // a window gone: the street comes into the room (0..1 of the way)
  roomOpen(k = 0.5) { this.openK = k; if (this.live) this.room(this.roomName || 'diner'); }

  // the train rumble: k 0..1 by distance, pos the nearest car
  train(k, pos) {
    if (!this.live) return;
    if (k <= 0.001 || !pos) { if (this.loops.has('train')) this.stopLoop('train'); if (this.loops.has('trainGrind')) this.stopLoop('trainGrind'); return; }
    const p = pos.clone(); p.y = 11;
    this.loop('train', p, 0.9 * k, 'brown', 150, 0, true);
    this.loop('trainGrind', p, 0.1 * k, 'pink', 700, 250, true);
    this.clackT = (this.clackT ?? 0);
    const now = this.ctx.currentTime;
    if (now > this.clackT) { this.clackT = now + 0.93; this.play('clack', p, { k }, { ref: 8, street: true }); this.play('clack', p, { k: k * 0.8 }, { ref: 8, delay: 0.11, street: true }); }
  }

  // per rendered frame (the Game): fires' crackle, the heartbeat, gusts,
  // drips
  update(dt, { fires = [], hp = 100, dead = false, listener = null } = {}) {
    if (!this.live) return;
    if (listener) this.listen(listener);
    // wind gusts: a slow random walk on the rain's level
    this.gustV += (Math.random() - 0.5) * dt * 0.6 - this.gust * dt * 0.25;
    this.gust = Math.max(-0.5, Math.min(1, this.gust + this.gustV * dt));
    const bed = this.loops.get('rainBed');
    if (bed) bed.g.gain.setTargetAtTime(0.24 * (this.roomGain ?? 1) * (1 + 0.45 * this.gust), this.ctx.currentTime, 0.4);
    // drips off the ironwork and the awnings, here and there
    this.dripT -= dt;
    if (this.dripT <= 0) {
      this.dripT = rng(0.15, 0.9);
      const a = Math.random() * TAU, d = rng(2, 9);
      const p = listener ? listener.position.clone().add({ x: Math.cos(a) * d, y: rng(-1, 3), z: Math.sin(a) * d }) : null;
      this.play('drip', p, { k: rng(0.5, 1) }, { ref: 2, send: false });
    }
    // fires: a roar loop per wreck and random crackles
    fires.forEach((f, i) => {
      const I = f.intensity();
      const key = 'fire' + i;
      if (I <= 0) { if (this.loops.has(key)) this.stopLoop(key); return; }
      this.loop(key, f.pos, 0.55 * I, 'brown', 480);
      if (Math.random() < dt * 16 * I) this.play('crackle', f.pos, { k: rng(0.4, 1) * I }, { ref: 4, send: false });
    });
    // [R3] a fire gone from the list (its wreck taken away when scene 9
    // ends, or the list another place's) roars no more
    for (let i = fires.length; this.loops.has('fire' + i); i++) this.stopLoop('fire' + i);
    // the heartbeat under 35 hp (~70 bpm, harder the lower)
    const low = dead ? 0 : Math.max(0, 1 - hp / 35);
    if (low > 0) {
      this.heartT -= dt;
      if (this.heartT <= 0) { this.heartT = 60 / (70 + 25 * low); this.play('heart', null, { k: 0.5 + 0.5 * low }, { send: false }); }
    } else this.heartT = 0;
  }
}

// ---------------------------------------------------------------------------
// window.__noir.audioTest(): render every sound offline and measure it.
// Loops render their first ~3 s. Returns [{ name, peak, rms, seconds }]
// (peak / rms of the rendered stereo signal, reverb send included).
// (22.05 kHz and each sound only as long as it lasts, six at a time, so the
// whole table renders in a few seconds of the headless browser's virtual
// time; the noise buffers are built once and shared by every context)
export async function audioTest({ rate = 22050, batch = 6 } = {}) {
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!OAC) return [{ name: 'OfflineAudioContext', error: 'unavailable' }];
  const params = {
    fire: { dur: 3 }, train: { dur: 3 }, rain: { dur: 3 }, hydrant: { dur: 2.5 }, reload: { dur: 2.3 },
    thunder: { s: 1, far: 0.3 }, pistol: { dist: 15 }, glass: { k: 1 }, step: { run: false },
  };
  const base = new OAC(2, 128, rate);
  const R = res(base);
  const one = async (name) => {
    try {
      const p = params[name] || {};
      // the sound's length: build it once into a throwaway context
      const probe = new OAC(2, 128, rate);
      const dur = B[name](probe, probe.destination, 0.02, p, R, null);
      const ctx = new OAC(2, Math.floor(rate * (dur + 0.4)), rate);
      const g = ctx.createGain();
      g.connect(ctx.destination);
      const verb = ctx.createConvolver();
      verb.buffer = R.ir;
      const send = ctx.createGain(); send.gain.value = 0.5;
      send.connect(verb).connect(g);
      B[name](ctx, g, 0.02, p, R, send);
      const buf = await ctx.startRendering();
      let peak = 0, sum = 0;
      for (let c = 0; c < buf.numberOfChannels; c++) {
        const d = buf.getChannelData(c);
        for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; sum += d[i] * d[i]; }
      }
      return { name, peak: +peak.toFixed(3), rms: +Math.sqrt(sum / (buf.length * buf.numberOfChannels)).toFixed(4), seconds: +dur.toFixed(2) };
    } catch (e) {
      return { name, error: String((e && e.message) || e) };
    }
  };
  const out = [];
  for (let i = 0; i < SOUND_NAMES.length; i += batch) out.push(...await Promise.all(SOUND_NAMES.slice(i, i + batch).map(one)));
  return out;
}

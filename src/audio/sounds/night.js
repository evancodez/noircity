// The night's sounds (lane O7, src/night/): the heat's shield brushed in, the
// cash, the map's paper, the radio's dial, and the city's own far sounds -
// a ship's horn on the river, the Hill's bell, a siren a long way off, the
// market's voices, the el's doors, the phone box's dial and its ring.
export default (kit) => {
  const { burst, thud, ping, chain, osc, gain, env, filt, rng, noise, tear } = kit;
  return {
    sounds: {
      // a shield brushed in: a low thump under a dry paper slap
      n_badge(ctx, out, t0, p, R) {
        const k = 0.6 + 0.4 * (p.k ?? 0.5);
        thud(ctx, out, t0, 95, 48, 0.42 * k, 0.28);
        burst(ctx, out, R, t0, 'pink', ['bandpass', 1500, 0.9], 0.16 * k, 0.003, 0.09);
        return 0.4;
      },
      // money: two bills riffled and a coin's chink
      n_cash(ctx, out, t0, p, R) {
        for (let i = 0; i < 3; i++) burst(ctx, out, R, t0 + i * 0.045, 'white', ['bandpass', rng(2400, 3600), 2.2], 0.09, 0.004, 0.05);
        ping(ctx, out, t0 + 0.16, [[rng(3100, 3400), 0.05, 0.25], [rng(5200, 5600), 0.025, 0.15]]);
        return 0.5;
      },
      // the map's paper opened (or folded: k < 1)
      n_paper(ctx, out, t0, p, R) {
        const k = p.k ?? 1;
        tear(ctx, out, t0, R, 0.22 * k, 2800, 1400, 0.6, 46);
        burst(ctx, out, R, t0 + 0.12 * k, 'pink', ['bandpass', 900, 0.8], 0.08, 0.01, 0.12);
        return 0.45;
      },
      // the radio's dial: the knob's click and a sweep of static between stations
      n_dial(ctx, out, t0, p, R) {
        burst(ctx, out, R, t0, 'white', ['bandpass', 3800, 6], 0.12, 0.0005, 0.012);
        const n = noise(ctx, R, 'white', t0 + 0.02, 0.42);
        const bp = filt(ctx, 'bandpass', 900, 2.5);
        bp.frequency.setValueAtTime(600, t0 + 0.02); bp.frequency.exponentialRampToValueAtTime(3400, t0 + 0.4);
        const g = gain(ctx); env(g, t0 + 0.02, 0.05, 0.03, 0.35);
        const w = osc(ctx, 'sine', 1400, t0 + 0.02, 0.4); w.frequency.exponentialRampToValueAtTime(700, t0 + 0.4);
        const wg = gain(ctx); env(wg, t0 + 0.05, 0.012, 0.05, 0.3);
        chain(n, bp, g, out); chain(w, wg, out);
        return 0.5;
      },
      // a ship's horn on the river: two low reeds a hair apart, a long breath
      n_horn(ctx, out, t0, p, R) {
        const dur = 2.6 + rng(0, 0.8);
        for (const [f, a] of [[rng(86, 92), 0.16], [rng(129, 133), 0.1], [rng(172, 178), 0.05]]) {
          const o = osc(ctx, 'sawtooth', f, t0, dur);
          const g = gain(ctx); env(g, t0, a, 0.35, 0.9, dur - 1.2);
          chain(o, filt(ctx, 'lowpass', 420, 0.8), g, out);
        }
        burst(ctx, out, R, t0, 'brown', ['lowpass', 300], 0.05, 0.4, dur);
        return dur + 1;
      },
      // the Hill's bell: one stroke (the night tolls it for the hour)
      n_bell(ctx, out, t0, p, R) {
        const f = p.f ?? 196;
        ping(ctx, out, t0, [[f, 0.16, 4.2], [f * 2.0, 0.08, 2.8], [f * 2.4, 0.06, 2.2], [f * 3.0, 0.04, 1.6], [f * 4.2, 0.025, 1.0], [f * 0.5, 0.07, 3.6]]);
        return 4.4;
      },
      // a siren a long way off: one wail, up and down, through the rain
      n_siren(ctx, out, t0, p, R) {
        const dur = 4.2;
        const o = osc(ctx, 'sawtooth', 520, t0, dur);
        o.frequency.setValueAtTime(480, t0);
        o.frequency.linearRampToValueAtTime(880, t0 + 1.4);
        o.frequency.linearRampToValueAtTime(860, t0 + 2.2);
        o.frequency.linearRampToValueAtTime(470, t0 + dur);
        const g = gain(ctx); env(g, t0, 0.06, 0.6, 1.4, dur - 2.0);
        chain(o, filt(ctx, 'bandpass', 900, 1.2), filt(ctx, 'lowpass', 1600), g, out);
        return dur + 0.5;
      },
      // the market's voices: a few seconds of a crowd's murmur under its roof
      n_murmur(ctx, out, t0, p, R) {
        const dur = 6;
        for (const [f, rate, a] of [[380, 3.3, 0.05], [560, 4.1, 0.04], [820, 2.7, 0.03], [470, 5.2, 0.03]]) {
          const n = noise(ctx, R, 'pink', t0, dur);
          const vg = gain(ctx, a * 0.5);
          const lfo = osc(ctx, 'sine', rate * rng(0.85, 1.15), t0, dur); const lg = gain(ctx, a * 0.5); chain(lfo, lg, vg.gain);
          const g = gain(ctx); env(g, t0, 1, 0.8, 1.2, dur - 2);
          chain(n, filt(ctx, 'bandpass', f, 2.2), filt(ctx, 'bandpass', f * 1.8, 1.4), vg, g, out);
        }
        return dur + 0.3;
      },
      // the el's doors: a two-note chime, the doors' rumble
      n_chime(ctx, out, t0, p, R) {
        ping(ctx, out, t0, [[784, 0.12, 0.7], [1568, 0.03, 0.4]]);
        ping(ctx, out, t0 + 0.32, [[622, 0.12, 0.9], [1244, 0.03, 0.5]]);
        burst(ctx, out, R, t0 + 0.7, 'brown', ['lowpass', 500], 0.2, 0.05, 0.5);
        thud(ctx, out, t0 + 1.2, 140, 80, 0.2, 0.12);
        return 1.6;
      },
      // the phone box: the dial run round and back, a pause, a voice's buzz
      n_phone(ctx, out, t0, p, R) {
        for (let d = 0; d < 3; d++) {
          const t = t0 + d * 0.55;
          const n = 2 + ((d * 3) % 5);
          for (let i = 0; i < n; i++) burst(ctx, out, R, t + 0.08 + i * 0.06, 'white', ['bandpass', 2600, 5], 0.06, 0.0005, 0.01);
        }
        const o = osc(ctx, 'square', 180, t0 + 1.9, 0.7);
        const g = gain(ctx); env(g, t0 + 1.9, 0.03, 0.02, 0.2, 0.45);
        chain(o, filt(ctx, 'bandpass', 900, 3), g, out);
        return 2.8;
      },
      // a quiet tick: the night has kept its place (the autosave)
      n_tick(ctx, out, t0, p, R) { burst(ctx, out, R, t0, 'white', ['bandpass', 4200, 5], 0.03, 0.0005, 0.02); return 0.1; },
    },
  };
};

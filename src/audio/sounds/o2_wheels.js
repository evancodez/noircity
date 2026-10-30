// The wheels' sounds (lane O2): the police car's siren (a hand-cranked
// wail: up and down, a sawtooth through a horn's band), the lock worked
// open at a parked car's door, the taxi's meter flag.
export default (kit) => {
  const { burst, thud, osc, gain, env, filt, chain, rng } = kit;
  return {
    sounds: {
      // one wail: up over 0.55 s, down over 0.65 s (played again and again while it runs)
      o2_siren(ctx, out, t0, p, R) {
        const k = p.k ?? 1;
        const o = osc(ctx, 'sawtooth', 420, t0, 1.25);
        o.frequency.setValueAtTime(420, t0);
        o.frequency.linearRampToValueAtTime(980, t0 + 0.55);
        o.frequency.linearRampToValueAtTime(430, t0 + 1.2);
        const o2 = osc(ctx, 'square', 211, t0, 1.25);
        o2.frequency.setValueAtTime(211, t0);
        o2.frequency.linearRampToValueAtTime(492, t0 + 0.55);
        o2.frequency.linearRampToValueAtTime(216, t0 + 1.2);
        const g = gain(ctx); env(g, t0, 0.07 * k, 0.08, 1.0, 0.15);
        const g2 = gain(ctx); env(g2, t0, 0.025 * k, 0.08, 1.0, 0.15);
        chain(o, filt(ctx, 'bandpass', 1100, 1.2), g, out);
        chain(o2, filt(ctx, 'bandpass', 900, 1.5), g2, out);
        return 1.3;
      },
      // the lock worked at the glass: a scrape of metal, two clicks
      o2_lock(ctx, out, t0, p, R) {
        const k = p.k ?? 0.7;
        burst(ctx, out, R, t0, 'white', ['bandpass', 3800, 6], 0.06 * k, 0.01, 0.18);
        for (const dt of [0.22, 0.31]) { burst(ctx, out, R, t0 + dt, 'white', ['bandpass', 2900, 5], 0.16 * k, 0.0005, 0.02); thud(ctx, out, t0 + dt, rng(600, 800), 400, 0.05 * k, 0.02); }
        return 0.45;
      },
      // the meter's flag pulled down: a ratchet and a bell's tick
      o2_meter(ctx, out, t0, p, R) {
        for (let i = 0; i < 3; i++) burst(ctx, out, R, t0 + i * 0.03, 'white', ['bandpass', 3000, 5], 0.08, 0.0005, 0.012);
        const o = osc(ctx, 'triangle', 2100, t0 + 0.12, 0.4);
        const g = gain(ctx); env(g, t0 + 0.12, 0.03, 0.002, 0.05, 0.3);
        chain(o, g, out);
        return 0.6;
      },
    },
  };
};

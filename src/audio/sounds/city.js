// The city's sounds (lane C3, chapter VI): the tram's bell, the handbrake's
// ratchet and the tyres giving on the wet, a dustbin knocked flying, the
// tin of a car denting, a lamp post folding over, my horn, the dash's lamp
// switch. (The car's room, the engine, the scrapes, the crashes, the horns
// of the traffic and the things that burst are the tail's: tail.js.)
export default (kit) => {
  const { burst, thud, ping, chain, osc, gain, env, filt, rng, B } = kit;
  return {
    sounds: {
      // a tram's bell: two quick strokes on a bright bell, its ring
      c3_bell(ctx, out, t0, p, R) {
        const k = p.k ?? 1;
        for (const dt of [0, 0.16]) ping(ctx, out, t0 + dt, [[1480, 0.22 * k, 0.9], [2210, 0.12 * k, 0.6], [3320, 0.06 * k, 0.35], [740, 0.08 * k, 1.1]]);
        return 1.4;
      },
      // the handbrake: the ratchet's clack, the rear tyres hissing on the wet
      c3_handbrake(ctx, out, t0, p, R) {
        const k = p.k ?? 0.8;
        for (let i = 0; i < 4; i++) burst(ctx, out, R, t0 + i * 0.025, 'white', ['bandpass', 2600, 4], 0.06, 0.0005, 0.012);
        burst(ctx, out, R, t0 + 0.05, 'white', ['bandpass', 1300, 3], 0.22 * k, 0.04, 0.5 + 0.4 * k);
        const o = osc(ctx, 'triangle', rng(1050, 1250), t0 + 0.05, 0.7);
        o.frequency.linearRampToValueAtTime(rng(820, 900), t0 + 0.75);
        const g = gain(ctx); env(g, t0 + 0.05, 0.035 * k, 0.05, 0.35, 0.3);
        chain(o, g, out);
        return 1.0;
      },
      // a dustbin hit: the tin's clang, the lid ringing off
      city_bin(ctx, out, t0, p, R) {
        const k = p.k ?? 0.7;
        B.clang(ctx, out, t0, { k: 0.6 * k }, R);
        thud(ctx, out, t0, 160, 90, 0.3 * k, 0.08);
        ping(ctx, out, t0 + 0.12, [[rng(900, 1200), 0.06 * k, 0.4], [rng(2300, 2700), 0.03 * k, 0.25]]);
        for (let i = 0; i < 4; i++) thud(ctx, out, t0 + 0.2 + i * rng(0.1, 0.18), rng(300, 500), 200, 0.06 * k * (1 - i / 4), 0.04);
        return 1.0;
      },
      // the tin of a car denting: a deep crunch, a little glass
      c3_dent(ctx, out, t0, p, R) {
        const k = p.k ?? 0.7;
        thud(ctx, out, t0, 120, 50, 0.6 * k, 0.22);
        burst(ctx, out, R, t0, 'brown', ['lowpass', 700, 1], 0.5 * k, 0.002, 0.25);
        burst(ctx, out, R, t0 + 0.01, 'white', ['bandpass', 2400, 1.5], 0.18 * k, 0.001, 0.12);
        for (let i = 0; i < 3; i++) ping(ctx, out, t0 + 0.04 + Math.random() * 0.25, [[rng(3000, 6000), 0.04 * k, rng(0.03, 0.07)]]);
        return 0.7;
      },
      // a lamp post going over: the iron groaning as it folds, the lamp's glass
      c3_post(ctx, out, t0, p, R) {
        const k = p.k ?? 0.8;
        thud(ctx, out, t0, 140, 60, 0.5 * k, 0.18);
        const o = osc(ctx, 'sawtooth', rng(180, 220), t0 + 0.05, 1.1);
        o.frequency.exponentialRampToValueAtTime(rng(70, 90), t0 + 1.1);
        const g = gain(ctx); env(g, t0 + 0.05, 0.08 * k, 0.1, 0.5, 0.45);
        chain(o, filt(ctx, 'bandpass', 420, 3), g, out);
        burst(ctx, out, R, t0 + 0.9, 'white', ['highpass', 2500], 0.2 * k, 0.002, 0.3);
        return 1.5;
      },
      // the dash's lamp switch: a knob pulled, a click
      c3_switch(ctx, out, t0, p, R) {
        burst(ctx, out, R, t0, 'white', ['bandpass', 3200, 4], 0.14, 0.0005, 0.015);
        thud(ctx, out, t0 + 0.01, 800, 500, 0.05, 0.02);
        return 0.15;
      },
    },
  };
};

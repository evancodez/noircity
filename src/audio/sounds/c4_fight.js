// [C4] The fight's wave C sounds (docs/story/briefs/C4_FIGHT.md), through
// sfx.fight(name) ('f_' + name) or sfx.play:
//   f_c4cue     the dodge cue: a held breath drawn in (a soft rising hiss
//               of air) under a rising tick, the room ducked by the caller
//   f_c4slip    the slip: his blow (or the thing) going by my ear - a close
//               whoosh, panned nowhere, and a short exhale
//   f_c4rattle  the barred street door tried: the leaf given a centimetre,
//               the bar knocking in its brackets, the bell's tinny shiver
//   f_c4bar     the bar dropping into its brackets as the door slams
//   f_c4lift    the bar lifted off (a scrape of iron, a knock)
export default (kit) => {
  const { burst, thud, ping, rng } = kit;
  return {
    sounds: {
      f_c4cue(ctx, out, t0, p, R) {
        // the breath in: band-passed air rising
        const n = kit.noise(ctx, R, 'pink', t0, 0.42, 1);
        const bp = kit.filt(ctx, 'bandpass', 700, 1.1);
        bp.frequency.setValueAtTime(600, t0); bp.frequency.exponentialRampToValueAtTime(1900, t0 + 0.34);
        const g = kit.gain(ctx); kit.env(g, t0, 0.09, 0.22, 0.16);
        kit.chain(n, bp, g, out);
        // the tick, rising: three knocks a little quicker and higher each
        for (let i = 0; i < 3; i++) ping(ctx, out, t0 + 0.02 + i * 0.09 - i * i * 0.006, [[880 * Math.pow(1.19, i), 0.045, 0.05]]);
        thud(ctx, out, t0, 90, 60, 0.18, 0.2);
        return 0.45;
      },
      f_c4slip(ctx, out, t0, p, R) {
        burst(ctx, out, R, t0, 'white', ['bandpass', 1500, 0.7], 0.22, 0.02, 0.16);
        burst(ctx, out, R, t0 + 0.02, 'pink', ['lowpass', 900], 0.12, 0.03, 0.2);
        return 0.3;
      },
      f_c4rattle(ctx, out, t0, p, R) {
        for (let i = 0; i < 3; i++) {
          const t = t0 + i * 0.07 + rng(0, 0.012);
          thud(ctx, out, t, 140 + rng(-15, 15), 90, 0.3 - i * 0.07, 0.07);
          burst(ctx, out, R, t, 'white', ['bandpass', 2400, 2.2], 0.06, 0.002, 0.05);
        }
        ping(ctx, out, t0 + 0.01, [[2350, 0.012, 0.25], [3100, 0.008, 0.2]]);
        return 0.5;
      },
      f_c4bar(ctx, out, t0, p, R) {
        thud(ctx, out, t0, 120, 70, 0.45, 0.16);
        burst(ctx, out, R, t0, 'white', ['bandpass', 1900, 1.8], 0.12, 0.002, 0.09);
        ping(ctx, out, t0 + 0.003, [[620, 0.06, 0.35], [940, 0.03, 0.28]]);
        thud(ctx, out, t0 + 0.11, 110, 75, 0.2, 0.1);
        return 0.55;
      },
      // the street door shut on its closer: the leaf against its stop, the bell
      f_c4shut(ctx, out, t0, p, R) {
        thud(ctx, out, t0, 95, 60, 0.4, 0.18);
        burst(ctx, out, R, t0, 'pink', ['bandpass', 1100, 1.0], 0.1, 0.002, 0.08);
        ping(ctx, out, t0 + 0.02, [[2350, 0.02, 0.4], [3100, 0.012, 0.3]]);
        return 0.5;
      },
      f_c4lift(ctx, out, t0, p, R) {
        burst(ctx, out, R, t0, 'white', ['bandpass', 2800, 1.2], 0.08, 0.06, 0.12);
        thud(ctx, out, t0 + 0.16, 130, 80, 0.22, 0.08);
        ping(ctx, out, t0 + 0.16, [[700, 0.035, 0.22]]);
        return 0.4;
      },
    },
  };
};

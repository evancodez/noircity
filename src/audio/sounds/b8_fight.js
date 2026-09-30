// [B8] The fist fight's own sounds (docs/story/briefs/B8_FIGHT.md), played
// through sfx.fight(name) ('f_' + name) or sfx.play:
//   f_b8tick  { k: level 1..2 }  the wind-up passing a level: a short drawn
//             breath of cloth and a rising knock, higher each level
//   f_b8full  the wind-up full: the knock at its highest and a tight ring
//   f_b8throw a thing leaving his hand: a whip of air
//   f_b8shoulder  his hand landing on my shoulder: cloth taken in a fist
export default (kit) => ({
  sounds: {
    f_b8tick(ctx, out, t0, p, R) {
      const k = Math.max(1, Math.min(3, p.k || 1));
      kit.burst(ctx, out, R, t0, 'white', ['bandpass', 900 + 500 * k, 1.4], 0.05 + 0.02 * k, 0.012, 0.09);
      kit.thud(ctx, out, t0, 150 + 70 * k, 110 + 50 * k, 0.18 + 0.05 * k, 0.09);
      kit.ping(ctx, out, t0 + 0.004, [[420 * Math.pow(1.26, k), 0.05, 0.07]]);
      return 0.16;
    },
    f_b8full(ctx, out, t0, p, R) {
      kit.burst(ctx, out, R, t0, 'white', ['bandpass', 2600, 1.2], 0.1, 0.006, 0.12);
      kit.thud(ctx, out, t0, 380, 260, 0.34, 0.1);
      kit.ping(ctx, out, t0 + 0.004, [[830, 0.08, 0.22], [1245, 0.04, 0.16]]);
      return 0.3;
    },
    f_b8throw(ctx, out, t0, p, R) {
      kit.burst(ctx, out, R, t0, 'pink', ['bandpass', 1400, 0.9], 0.2 * (p.k ?? 1), 0.04, 0.18);
      return 0.25;
    },
    f_b8shoulder(ctx, out, t0, p, R) {
      kit.burst(ctx, out, R, t0, 'pink', ['bandpass', 1800, 0.8], 0.16, 0.004, 0.12);
      kit.thud(ctx, out, t0, 120, 70, 0.22, 0.12);
      return 0.2;
    },
  },
});

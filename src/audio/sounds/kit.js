// The kit's sounds (lane C1, docs/story/seams/Z.md): small, dry, under the
// game's own. All procedural (Y4 seam).
//   kit_write   the objective line brushed in: a soft dry stroke of a brush
//               across paper, a short tick at its end
//   kit_strike  a done objective struck through: a quicker, harder stroke
//   kit_teach   a teach card laid down: a card on a table, a soft flick
//   kit_warn    a warning: one low muffled heartbeat thump
//   kit_fail    the fall to black: a dull low knock, the room going out
//   kit_paper   a comic panel landing: a sheet set down, its edge settling
//   kit_page    the stills' page turned / skipped: a quick paper swish
export default (kit) => {
  const { burst, thud, ping, rng } = kit;
  // a brush dragged over paper: band-passed noise swept up, its grain
  // chopped (the bristles), a breath of air under it
  const stroke = (ctx, out, R, t0, dur, f0, f1, k) => {
    const n = kit.noise(ctx, R, 'pink', t0, dur + 0.05, 1);
    const bp = kit.filt(ctx, 'bandpass', f0, 1.6);
    bp.frequency.setValueAtTime(f0, t0); bp.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = kit.gain(ctx); kit.env(g, t0, 0.09 * k, dur * 0.25, dur * 0.75);
    const am = kit.osc(ctx, 'square', rng(52, 64), t0, dur); const ga = kit.gain(ctx, 0.35 * k); kit.chain(am, ga); ga.connect(g.gain);
    kit.chain(n, bp, g, out);
  };
  return {
    sounds: {
      kit_write(ctx, out, t0, p, R) {
        stroke(ctx, out, R, t0, 0.32, 1900, 3600, p.k ?? 1);
        burst(ctx, out, R, t0 + 0.31, 'white', ['bandpass', 4200, 4], 0.035, 0.0008, 0.012);
        return 0.42;
      },
      kit_strike(ctx, out, t0, p, R) {
        stroke(ctx, out, R, t0, 0.16, 2600, 1500, 1.3);
        return 0.22;
      },
      kit_teach(ctx, out, t0, p, R) {
        burst(ctx, out, R, t0, 'pink', ['bandpass', 1300, 0.9], 0.07, 0.004, 0.07);
        thud(ctx, out, t0 + 0.005, 190, 120, 0.05, 0.06);
        burst(ctx, out, R, t0 + 0.05, 'white', ['bandpass', 3800, 2.5], 0.02, 0.002, 0.03);
        return 0.18;
      },
      kit_warn(ctx, out, t0, p, R) {
        thud(ctx, out, t0, 72, 44, 0.32, 0.22);
        burst(ctx, out, R, t0, 'brown', ['lowpass', 180], 0.12, 0.004, 0.16);
        return 0.3;
      },
      kit_fail(ctx, out, t0, p, R) {
        thud(ctx, out, t0, 64, 36, 0.4, 0.5);
        burst(ctx, out, R, t0, 'brown', ['lowpass', 140], 0.22, 0.006, 0.45);
        ping(ctx, out, t0 + 0.02, [[118, 0.05, 0.6]]);
        return 0.7;
      },
      kit_paper(ctx, out, t0, p, R) {
        burst(ctx, out, R, t0, 'pink', ['bandpass', 2200, 0.8], 0.06, 0.03, 0.16);
        burst(ctx, out, R, t0 + 0.16, 'pink', ['lowpass', 900], 0.07, 0.002, 0.05);
        burst(ctx, out, R, t0 + 0.18, 'white', ['bandpass', 5200, 3], 0.015, 0.001, 0.03);
        return 0.3;
      },
      kit_page(ctx, out, t0, p, R) {
        burst(ctx, out, R, t0, 'white', ['bandpass', 2900, 0.7], 0.06, 0.04, 0.2);
        return 0.28;
      },
    },
  };
};

// [O6b] The car's parts as they go (lane O6b, procedural, Sfx.js's kit), through sfx.play(name):
//   o6b_bonnet   the bonnet sprung off its catch: a sheet of tin banging up
//                (a hollow boom, the catch's snap, the ring of the panel)
//   o6b_flap     the sprung bonnet beating on its catch at speed: a short tin knock
//   o6b_door     a door torn off its hinges: the snap of the hinge, the panel
//                hitting the road and its clatter and skid along it
//   o6b_scrape   a bumper dragging on the stones: a harsh short grind (played
//                again and again while it drags)
//   o6b_grind    a hub on the road with no wheel: iron on stone, low and
//                rough, with a shriek over it (played again and again)
//   o6b_wheel    a wheel coming off: the clunk of the hub dropping, the tyre's bounce
//   o6b_splash   something heavy into the river: the slap, the plunge, the water falling back
export default (kit) => {
  const { burst, thud, ping, chain, osc, gain, env, filt, rng, B } = kit;
  return {
    sounds: {
      o6b_bonnet(ctx, out, t0, p, R) {
        const k = p.k ?? 1;
        thud(ctx, out, t0, 140, 60, 0.7 * k, 0.22);
        burst(ctx, out, R, t0, 'white', ['bandpass', 2600, 2], 0.3 * k, 0.001, 0.05);
        // the panel's ring: a few low inharmonic partials, long
        for (const [f, a, d] of [[rng(210, 260), 0.16, 0.7], [rng(540, 620), 0.1, 0.5], [rng(1150, 1300), 0.06, 0.35]]) {
          const o = osc(ctx, 'sine', f, t0, d + 0.05); const g = gain(ctx); env(g, t0, a * k, 0.002, d); chain(o, g, out);
        }
        return 0.9;
      },
      o6b_flap(ctx, out, t0, p, R) {
        const k = p.k ?? 0.5;
        thud(ctx, out, t0, 170, 110, 0.25 * k, 0.06);
        burst(ctx, out, R, t0, 'white', ['bandpass', 1900, 2.5], 0.08 * k, 0.001, 0.04);
        return 0.15;
      },
      o6b_door(ctx, out, t0, p, R) {
        const k = p.k ?? 1;
        // the hinge going: a snap and a short shriek of metal
        burst(ctx, out, R, t0, 'white', ['bandpass', 3200, 3], 0.25 * k, 0.0006, 0.03);
        const o = osc(ctx, 'sawtooth', rng(900, 1200), t0, 0.18); o.frequency.exponentialRampToValueAtTime(rng(500, 650), t0 + 0.18);
        const g = gain(ctx); env(g, t0, 0.04 * k, 0.005, 0.16); chain(o, filt(ctx, 'bandpass', 1500, 6), g, out);
        // the panel down on the road, bouncing, and its skid
        B.clang(ctx, out, t0 + 0.18, { k: 0.55 * k }, R);
        thud(ctx, out, t0 + 0.18, 120, 70, 0.45 * k, 0.1);
        B.clang(ctx, out, t0 + 0.42, { k: 0.3 * k }, R);
        burst(ctx, out, R, t0 + 0.45, 'white', ['bandpass', rng(1600, 2200), 2], 0.14 * k, 0.01, 0.5);
        burst(ctx, out, R, t0 + 0.45, 'brown', ['lowpass', 500, 1], 0.18 * k, 0.01, 0.45);
        return 1.1;
      },
      o6b_scrape(ctx, out, t0, p, R) {
        const k = p.k ?? 0.5, dur = 0.35;
        burst(ctx, out, R, t0, 'white', ['bandpass', rng(2400, 3400), 3], 0.22 * (0.4 + k), 0.01, dur);
        burst(ctx, out, R, t0, 'brown', ['bandpass', 380, 1.2], 0.25 * (0.4 + k), 0.01, dur);
        return dur + 0.05;
      },
      o6b_grind(ctx, out, t0, p, R) {
        const k = p.k ?? 0.5, dur = 0.4;
        burst(ctx, out, R, t0, 'brown', ['bandpass', rng(160, 220), 1.4], 0.5 * (0.4 + k), 0.01, dur);
        burst(ctx, out, R, t0, 'white', ['bandpass', rng(1700, 2300), 4], 0.12 * (0.4 + k), 0.01, dur);
        const o = osc(ctx, 'sawtooth', rng(55, 70), t0, dur); const g = gain(ctx); env(g, t0, 0.12 * k, 0.01, dur * 0.9);
        chain(o, filt(ctx, 'lowpass', 380), g, out);
        return dur + 0.05;
      },
      o6b_wheel(ctx, out, t0, p, R) {
        const k = p.k ?? 1;
        thud(ctx, out, t0, 95, 45, 0.6 * k, 0.18);
        B.clang(ctx, out, t0, { k: 0.5 * k }, R);
        thud(ctx, out, t0 + 0.32, 150, 90, 0.25 * k, 0.08);
        thud(ctx, out, t0 + 0.55, 160, 100, 0.12 * k, 0.06);
        return 0.8;
      },
      o6b_splash(ctx, out, t0, p, R) {
        const k = p.k ?? 1;
        burst(ctx, out, R, t0, 'white', ['bandpass', 1100, 0.7], 0.55 * k, 0.002, 0.18);
        thud(ctx, out, t0 + 0.01, 160, 45, 0.7 * k, 0.4);
        burst(ctx, out, R, t0 + 0.05, 'brown', ['lowpass', 700, 0.8], 0.5 * k, 0.02, 0.9);
        // the water falling back: a long white hiss and drops
        burst(ctx, out, R, t0 + 0.3, 'white', ['highpass', 2600], 0.16 * k, 0.05, 1.3);
        for (let i = 0; i < 7; i++) ping(ctx, out, t0 + 0.35 + Math.random() * 1.0, [[rng(900, 2000), 0.03 * k, rng(0.03, 0.07)]]);
        return 1.8;
      },
    },
  };
};

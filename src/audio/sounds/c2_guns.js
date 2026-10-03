// The gun kit's sounds (lane C2), procedural as the rest (Sfx.js's kit):
//   c2_crack      a round past the ear: a sharp supersonic snap and its hiss
//                 (positional, so it is heard on the side it passed)
//   c2_hitMe      a round into me: a dull punch under the grunt
//   c2_cock       his tell (a pistol man): the hammer drawn back, two clicks
//   c2_bolt       his tell (a Tommy gun): the bolt racked, a heavy clack
//   c2_magOut / c2_magIn    a pistol's magazine out / slapped home
//   c2_drumOut / c2_drumIn  the Tommy gun's drum: the latch, the drum
//                 dragged out, the new one in and the bolt (his pause, out loud)
//   c2_woodHit    a round into wood: a knock and a splinter
//   c2_woodBreak  a section of wood shot to pieces: a crack and a rain of splinters
//   c2_doorOpen / c2_doorShut / c2_doorRattle   a door's latch, its hinge, a locked one
//   c2_deskFall   the desk over on its front: a boom and its drawers
//   c2_flank      a man breaking into a run (the flank): a scuff and quick heels
export default (kit) => {
  const { burst, thud, ping, chain, osc, gain, env, filt, noise, splinter, rng } = kit;
  const click = (ctx, out, R, t, f, a) => {
    burst(ctx, out, R, t, 'white', ['bandpass', f, 3], a, 0.0005, 0.015);
    const o = osc(ctx, 'triangle', f * 0.3, t, 0.05);
    const g = gain(ctx); env(g, t, a * 0.3, 0.001, 0.025);
    chain(o, g, out);
  };
  return {
    sounds: {
      c2_crack(ctx, out, t0, p, R) {
        const k = p.k ?? 1;
        // the snap: a very short bright burst, then the air tearing behind it
        burst(ctx, out, R, t0, 'white', ['highpass', 3800], 0.9 * k, 0.0003, 0.012);
        burst(ctx, out, R, t0 + 0.004, 'white', ['bandpass', 2200, 0.8], 0.35 * k, 0.002, 0.09);
        burst(ctx, out, R, t0 + 0.01, 'pink', ['bandpass', 900, 0.6], 0.12 * k, 0.01, 0.18);
        return 0.3;
      },
      c2_hitMe(ctx, out, t0, p, R) {
        const k = p.k ?? 1;
        thud(ctx, out, t0, 120, 45, 0.7 * k, 0.16);
        burst(ctx, out, R, t0, 'brown', ['lowpass', 400], 0.6 * k, 0.002, 0.12);
        burst(ctx, out, R, t0 + 0.005, 'white', ['bandpass', 1500, 1.2], 0.18 * k, 0.001, 0.04);
        return 0.3;
      },
      c2_cock(ctx, out, t0, p, R) {
        click(ctx, out, R, t0, 2600, 0.45);
        click(ctx, out, R, t0 + 0.07, 3400, 0.55);
        return 0.15;
      },
      c2_bolt(ctx, out, t0, p, R) {
        burst(ctx, out, R, t0, 'white', ['bandpass', 1800, 2], 0.4, 0.001, 0.05);
        thud(ctx, out, t0 + 0.09, 260, 140, 0.35, 0.06);
        click(ctx, out, R, t0 + 0.09, 2200, 0.6);
        return 0.25;
      },
      c2_magOut(ctx, out, t0, p, R) {
        click(ctx, out, R, t0, 2100, 0.4);
        burst(ctx, out, R, t0 + 0.03, 'white', ['bandpass', 1300, 2], 0.2, 0.004, 0.06);
        ping(ctx, out, t0 + 0.32, [[4100, 0.05, 0.04], [6300, 0.03, 0.03]]);
        return 0.45;
      },
      c2_magIn(ctx, out, t0, p, R) {
        burst(ctx, out, R, t0, 'white', ['bandpass', 1600, 2], 0.25, 0.003, 0.04);
        thud(ctx, out, t0 + 0.04, 240, 120, 0.3, 0.05);
        click(ctx, out, R, t0 + 0.04, 2800, 0.55);
        click(ctx, out, R, t0 + 0.2, 2400, 0.45);
        return 0.35;
      },
      c2_drumOut(ctx, out, t0, p, R) {
        click(ctx, out, R, t0, 1900, 0.5);
        // the drum dragged out of its guides
        const n = noise(ctx, R, 'white', t0 + 0.06, 0.32, 0.8);
        const g = gain(ctx); env(g, t0 + 0.06, 0.18, 0.02, 0.25);
        chain(n, filt(ctx, 'bandpass', 900, 1.5), g, out);
        thud(ctx, out, t0 + 0.4, 180, 90, 0.35, 0.12);
        ping(ctx, out, t0 + 0.42, [[1400, 0.06, 0.12], [2900, 0.03, 0.08]]);
        return 0.6;
      },
      c2_drumIn(ctx, out, t0, p, R) {
        const n = noise(ctx, R, 'white', t0, 0.22, 0.85);
        const g = gain(ctx); env(g, t0, 0.15, 0.02, 0.18);
        chain(n, filt(ctx, 'bandpass', 1000, 1.5), g, out);
        thud(ctx, out, t0 + 0.22, 230, 120, 0.45, 0.08);
        click(ctx, out, R, t0 + 0.22, 2000, 0.6);
        // the bolt
        burst(ctx, out, R, t0 + 0.5, 'white', ['bandpass', 1800, 2], 0.35, 0.001, 0.05);
        click(ctx, out, R, t0 + 0.58, 2300, 0.65);
        return 0.75;
      },
      c2_woodHit(ctx, out, t0, p, R) {
        const k = p.k ?? 1;
        thud(ctx, out, t0, rng(220, 300), 120, 0.4 * k, 0.07);
        splinter(ctx, out, t0, R, 0.55 * k, 5);
        return 0.3;
      },
      c2_woodBreak(ctx, out, t0, p, R) {
        const k = p.k ?? 1;
        thud(ctx, out, t0, 170, 70, 0.6 * k, 0.16);
        splinter(ctx, out, t0, R, 1.0 * k, 16);
        burst(ctx, out, R, t0 + 0.02, 'brown', ['lowpass', 600], 0.4 * k, 0.003, 0.25);
        return 0.5;
      },
      c2_doorOpen(ctx, out, t0, p, R) {
        click(ctx, out, R, t0, 1700, 0.35);
        // the hinge: a short dry creak
        const o = osc(ctx, 'sawtooth', rng(380, 460), t0 + 0.05, 0.35);
        o.frequency.setValueAtTime(rng(380, 460), t0 + 0.05);
        o.frequency.linearRampToValueAtTime(rng(520, 640), t0 + 0.35);
        const g = gain(ctx); env(g, t0 + 0.05, 0.04, 0.05, 0.25, 0.05);
        chain(o, filt(ctx, 'bandpass', 900, 4), g, out);
        return 0.5;
      },
      c2_doorShut(ctx, out, t0, p, R) {
        thud(ctx, out, t0, 140, 70, 0.5, 0.14);
        burst(ctx, out, R, t0, 'brown', ['lowpass', 700], 0.4, 0.002, 0.12);
        click(ctx, out, R, t0 + 0.02, 1900, 0.4);
        return 0.3;
      },
      c2_doorRattle(ctx, out, t0, p, R) {
        for (let i = 0; i < 4; i++) {
          const t = t0 + i * 0.07 + rng(0, 0.02);
          click(ctx, out, R, t, rng(1300, 1900), 0.35);
          thud(ctx, out, t, 180, 120, 0.15, 0.05);
        }
        return 0.4;
      },
      c2_deskFall(ctx, out, t0, p, R) {
        thud(ctx, out, t0, 110, 40, 0.9, 0.3);
        burst(ctx, out, R, t0, 'brown', ['lowpass', 500], 0.8, 0.003, 0.3);
        for (let i = 0; i < 4; i++) { const t = t0 + 0.05 + i * 0.06; thud(ctx, out, t, 220, 140, 0.2, 0.05); click(ctx, out, R, t, 1500, 0.2); }
        return 0.6;
      },
      c2_flank(ctx, out, t0, p, R) {
        burst(ctx, out, R, t0, 'white', ['bandpass', 2600, 1.2], 0.2, 0.004, 0.08);
        for (let i = 0; i < 3; i++) {
          const t = t0 + 0.1 + i * 0.17;
          const n = noise(ctx, R, 'brown', t, 0.1, 1.6);
          const g = gain(ctx); env(g, t, 0.4, 0.002, 0.05);
          chain(n, filt(ctx, 'lowpass', 900), g, out);
        }
        return 0.65;
      },
    },
  };
};

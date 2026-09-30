// The sounds of scene 9, The Block (B7): the cars (the brakes, a skid, a
// door flung open, a crash, the handbrake), the gun and its drums on the
// counter, the switch by the door, a body on a car's roof, the hat in the
// street and the rain hissing on a cigar's ember. Procedural, as the rest
// (audio/Sfx.js KIT).
export default (k) => {
  const { burst, thud, ping, osc, gain, env, filt, chain, noise, glassFall, splinter, rng } = k;
  return {
    sounds: {
      // the room's switch: a hard bakelite clack
      b7_switch(ctx, out, t0, p, R) {
        burst(ctx, out, R, t0, 'white', ['bandpass', 2600, 2.5], 0.35, 0.0005, 0.018);
        thud(ctx, out, t0, 520, 300, 0.12, 0.03);
        burst(ctx, out, R, t0 + 0.012, 'white', ['bandpass', 1500, 3], 0.18, 0.0005, 0.02);
        return 0.1;
      },
      // the Tommy gun laid on the counter: wood and steel on the formica
      b7_gunDown(ctx, out, t0, p, R) {
        thud(ctx, out, t0, 140, 80, 0.45, 0.16);
        burst(ctx, out, R, t0, 'brown', ['bandpass', 600, 1.2], 0.35, 0.002, 0.08);
        ping(ctx, out, t0 + 0.01, [[1650, 0.05, 0.08], [2340, 0.03, 0.05]]);
        burst(ctx, out, R, t0 + 0.05, 'white', ['bandpass', 3200, 2], 0.08, 0.001, 0.03);
        return 0.4;
      },
      // a drum set down on its rim: a tinny clunk
      b7_drumDown(ctx, out, t0, p, R) {
        thud(ctx, out, t0, 190, 110, 0.3, 0.1);
        ping(ctx, out, t0, [[980, 0.08, 0.12], [1840, 0.04, 0.07], [2730, 0.02, 0.05]]);
        burst(ctx, out, R, t0, 'white', ['bandpass', 2400, 2], 0.1, 0.001, 0.025);
        return 0.3;
      },
      // two drums pushed across the counter to me
      b7_drumSlide(ctx, out, t0, p, R) {
        const n = noise(ctx, R, 'pink', t0, 0.42);
        const g = gain(ctx); env(g, t0, 0.14, 0.03, 0.36, 0.04);
        chain(n, filt(ctx, 'bandpass', 900, 1.1), g, out);
        k.B.b7_drumDown(ctx, out, t0 + 0.44, p, R);
        return 0.8;
      },
      // the drums into the coat
      b7_drumTake(ctx, out, t0, p, R) {
        burst(ctx, out, R, t0, 'pink', ['bandpass', 1200, 1], 0.14, 0.01, 0.12);
        ping(ctx, out, t0 + 0.05, [[860, 0.05, 0.09], [1610, 0.025, 0.06]]);
        burst(ctx, out, R, t0 + 0.14, 'brown', ['lowpass', 400], 0.12, 0.005, 0.1);
        return 0.35;
      },
      // the gun off the counter and up: cloth, the sling's swivel, the bolt
      b7_take(ctx, out, t0, p, R) {
        burst(ctx, out, R, t0, 'pink', ['bandpass', 1400, 0.9], 0.12, 0.02, 0.18);
        ping(ctx, out, t0 + 0.12, [[2100, 0.04, 0.05], [3300, 0.02, 0.03]]);
        burst(ctx, out, R, t0 + 0.42, 'white', ['bandpass', 2800, 2.2], 0.25, 0.0005, 0.03);
        thud(ctx, out, t0 + 0.42, 330, 190, 0.14, 0.05);
        burst(ctx, out, R, t0 + 0.52, 'white', ['bandpass', 2300, 2.5], 0.2, 0.0005, 0.025);
        return 0.8;
      },
      // the gun at the shoulder: the bolt drawn back and let go
      b7_bolt(ctx, out, t0, p, R) {
        burst(ctx, out, R, t0, 'white', ['bandpass', 2400, 2.5], 0.3, 0.0005, 0.025);
        thud(ctx, out, t0, 300, 180, 0.12, 0.04);
        burst(ctx, out, R, t0 + 0.13, 'white', ['bandpass', 3100, 3], 0.35, 0.0005, 0.02);
        thud(ctx, out, t0 + 0.13, 420, 240, 0.16, 0.04);
        ping(ctx, out, t0 + 0.13, [[3900, 0.03, 0.05]]);
        return 0.3;
      },
      // hard braking: the tyres' squeal on the wet stone, a wobble in it
      b7_brake(ctx, out, t0, p, R) {
        const dur = p.dur ?? 0.55;
        const o = osc(ctx, 'sawtooth', 1050, t0, dur);
        o.frequency.setValueAtTime(1150, t0); o.frequency.exponentialRampToValueAtTime(820, t0 + dur);
        const w = osc(ctx, 'sine', 23, t0, dur); const wg = gain(ctx, 60); chain(w, wg, o.frequency);
        const g = gain(ctx); env(g, t0, 0.07, 0.02, dur * 0.6, dur * 0.3);
        chain(o, filt(ctx, 'bandpass', 1300, 3), g, out);
        const n = noise(ctx, R, 'white', t0, dur);
        const gn = gain(ctx); env(gn, t0, 0.12, 0.03, dur * 0.7, dur * 0.2);
        chain(n, filt(ctx, 'bandpass', 2200, 1.4), gn, out);
        // (the springs take the weight at the stop)
        thud(ctx, out, t0 + dur * 0.9, 95, 60, 0.3, 0.2);
        return dur + 0.25;
      },
      // a skid through the swing: longer, wetter
      b7_skid(ctx, out, t0, p, R) {
        const dur = p.dur ?? 1.2;
        for (const [f, a] of [[880, 0.06], [1330, 0.035]]) {
          const o = osc(ctx, 'sawtooth', f, t0, dur);
          o.frequency.setValueAtTime(f * 1.08, t0); o.frequency.exponentialRampToValueAtTime(f * 0.86, t0 + dur);
          const w = osc(ctx, 'sine', rng(16, 27), t0, dur); const wg = gain(ctx, f * 0.05); chain(w, wg, o.frequency);
          const g = gain(ctx); env(g, t0, a, 0.08, dur * 0.5, dur * 0.4);
          chain(o, filt(ctx, 'bandpass', f * 1.2, 3.5), g, out);
        }
        const n = noise(ctx, R, 'white', t0, dur);
        const gn = gain(ctx); env(gn, t0, 0.16, 0.06, dur * 0.6, dur * 0.3);
        chain(n, filt(ctx, 'bandpass', 1800, 0.9), gn, out);
        // the water thrown off the tyres
        const s = noise(ctx, R, 'pink', t0, dur);
        const gs = gain(ctx); env(gs, t0, 0.1, 0.1, dur * 0.7, dur * 0.2);
        chain(s, filt(ctx, 'highpass', 2800), gs, out);
        return dur + 0.1;
      },
      // a car door flung open: the latch, the hinge's check
      b7_carDoor(ctx, out, t0, p, R) {
        burst(ctx, out, R, t0, 'white', ['bandpass', 1800, 2], 0.3, 0.0005, 0.03);
        thud(ctx, out, t0, 220, 140, 0.2, 0.06);
        burst(ctx, out, R, t0 + 0.2, 'brown', ['bandpass', 380, 1.4], 0.35, 0.002, 0.12);
        thud(ctx, out, t0 + 0.2, 120, 70, 0.3, 0.14);
        ping(ctx, out, t0 + 0.2, [[640, 0.04, 0.12]]);
        return 0.5;
      },
      // the handbrake: a ratchet
      b7_handbrake(ctx, out, t0, p, R) {
        for (let i = 0; i < 7; i++) burst(ctx, out, R, t0 + i * 0.035, 'white', ['bandpass', 2600 + i * 60, 3], 0.1, 0.0005, 0.012);
        thud(ctx, out, t0 + 0.26, 160, 100, 0.12, 0.06);
        return 0.4;
      },
      // a man's body onto a car's roof: sheet steel caving, glass
      b7_bodyRoof(ctx, out, t0, p, R) {
        const kk = p.k ?? 1;
        thud(ctx, out, t0, 110, 55, 0.9 * kk, 0.3);
        burst(ctx, out, R, t0, 'brown', ['lowpass', 700], 0.7 * kk, 0.002, 0.25);
        ping(ctx, out, t0 + 0.01, [[310, 0.12 * kk, 0.5], [470, 0.08 * kk, 0.4], [735, 0.05 * kk, 0.3]]);
        if (kk > 0.8) glassFall(ctx, out, t0 + 0.03, R, 0.7, 0.45, 10);
        return 1.0;
      },
      // a car into a post at speed: the crunch, the post's ring, glass
      b7_crash(ctx, out, t0, p, R) {
        thud(ctx, out, t0, 90, 40, 1.0, 0.45);
        burst(ctx, out, R, t0, 'brown', ['lowpass', 900], 0.9, 0.002, 0.4);
        splinter(ctx, out, t0 + 0.01, R, 1.1, 12);
        ping(ctx, out, t0 + 0.02, [[260, 0.2, 1.2], [395, 0.12, 0.9], [612, 0.08, 0.7], [1180, 0.05, 0.4]]);
        glassFall(ctx, out, t0 + 0.04, R, 0.9, 0.7, 16);
        return 1.6;
      },
      // the hat onto the street, and onto its brim
      b7_hatDrop(ctx, out, t0, p, R) {
        const kk = p.k ?? 1;
        burst(ctx, out, R, t0, 'brown', ['bandpass', 320, 1], 0.25 * kk, 0.003, 0.08);
        burst(ctx, out, R, t0, 'white', ['highpass', 3000], 0.06 * kk, 0.002, 0.06);
        return 0.25;
      },
      // the hat rolling on its brim through the water
      b7_hatRoll(ctx, out, t0, p, R) {
        const dur = p.dur ?? 1;
        const n = noise(ctx, R, 'pink', t0, dur);
        const g = gain(ctx); env(g, t0, 0.05, 0.05, dur * 0.8, dur * 0.1);
        chain(n, filt(ctx, 'bandpass', 2400, 1.2), g, out);
        return dur;
      },
      // rain on an ember: a tiny sizzle
      b7_hiss(ctx, out, t0, p, R) {
        const kk = p.k ?? 0.6;
        const dur = 0.12 + 0.2 * kk;
        const n = noise(ctx, R, 'white', t0, dur);
        const g = gain(ctx); env(g, t0, 0.05 * kk, 0.004, dur);
        chain(n, filt(ctx, 'highpass', 5200), g, out);
        return dur;
      },
    },
  };
};

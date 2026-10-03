// [C5] The Harbor Building's third floor, wave C (procedural, as the rest):
//   c5_closerClick  the suite's door drawn shut on its closer: the latch, the glass shivering in its frame
//   c5_gate         an iron grille gate swung on its pins
//   c5_chain        a lamp's pull chain: a bead chain run, the switch's click
//   c5_phoneHang    the receiver set down across its cradle
//   c5_phoneDead    the receiver lifted to the ear: the hook's click, nothing on the line
//   c5_keys         a key ring out of a waistcoat pocket
//   c5_unlock       a small key turned in a drawer's lock
//   c5_locked       a locked drawer tugged: the bolt against its keeper
//   c5_liftMotor    the lift's motor and its cables, coming up the shaft (p.dur)
//   c5_liftBell     the car arrived: one bell
//   c5_cage         the scissor cage folding open: a clatter of iron
//   c5_handle       a door's handle turned from the other side, slowly
//   c5_envelope     an envelope's flap and the paper in it
//   c5_tap          a basin's tap: the squeal, water a moment
//   c5_typeKey      one typewriter key struck
export default (kit) => {
  const { burst, thud, ping, chain, osc, gain, env, filt, noise, rng } = kit;
  const click = (ctx, out, R, t, f, a) => {
    burst(ctx, out, R, t, 'white', ['bandpass', f, 3], a, 0.0005, 0.015);
    const o = osc(ctx, 'triangle', f * 0.3, t, 0.05);
    const g = gain(ctx); env(g, t, a * 0.3, 0.001, 0.025);
    chain(o, g, out);
  };
  return {
    sounds: {
      c5_closerClick(ctx, out, t0, p, R) {
        thud(ctx, out, t0, 150, 80, 0.35, 0.12);
        click(ctx, out, R, t0 + 0.01, 1900, 0.45);
        // (the glass in its frame: a short high shiver)
        for (let i = 0; i < 5; i++) ping(ctx, out, t0 + 0.02 + i * 0.022, [[rng(3800, 5200), 0.03, 0.04]]);
        return 0.4;
      },
      c5_gate(ctx, out, t0, p, R) {
        for (let i = 0; i < 3; i++) ping(ctx, out, t0 + i * 0.05, [[rng(700, 1100), 0.06, 0.18], [rng(1900, 2600), 0.03, 0.1]]);
        const o = osc(ctx, 'sawtooth', 220, t0 + 0.08, 0.5);
        o.frequency.linearRampToValueAtTime(320, t0 + 0.5);
        const g = gain(ctx); env(g, t0 + 0.08, 0.03, 0.05, 0.35, 0.05);
        chain(o, filt(ctx, 'bandpass', 700, 4), g, out);
        return 0.7;
      },
      c5_chain(ctx, out, t0, p, R) {
        for (let i = 0; i < 6; i++) ping(ctx, out, t0 + i * 0.012, [[rng(4200, 6400), 0.02, 0.012]]);
        click(ctx, out, R, t0 + 0.09, 2400, 0.35);
        return 0.2;
      },
      c5_phoneHang(ctx, out, t0, p, R) {
        thud(ctx, out, t0, 200, 120, 0.25, 0.06);
        click(ctx, out, R, t0, 1500, 0.4);
        ping(ctx, out, t0 + 0.01, [[880, 0.015, 0.15]]);
        return 0.3;
      },
      c5_phoneDead(ctx, out, t0, p, R) {
        click(ctx, out, R, t0, 1700, 0.3);
        // (the line: a faint hiss, then nothing)
        burst(ctx, out, R, t0 + 0.05, 'pink', ['bandpass', 1200, 0.8], 0.02, 0.05, 0.5);
        return 0.7;
      },
      c5_keys(ctx, out, t0, p, R) {
        for (let i = 0; i < 7; i++) ping(ctx, out, t0 + i * 0.03 + rng(0, 0.02), [[rng(3000, 5600), 0.04, 0.06], [rng(1600, 2200), 0.02, 0.05]]);
        burst(ctx, out, R, t0, 'white', ['bandpass', 2400, 1.2], 0.04, 0.02, 0.12);
        return 0.35;
      },
      c5_unlock(ctx, out, t0, p, R) {
        click(ctx, out, R, t0, 2600, 0.3);
        click(ctx, out, R, t0 + 0.12, 1700, 0.45);
        thud(ctx, out, t0 + 0.12, 260, 180, 0.12, 0.04);
        return 0.25;
      },
      c5_locked(ctx, out, t0, p, R) {
        for (let i = 0; i < 2; i++) { const t = t0 + i * 0.09; thud(ctx, out, t, 220, 160, 0.2, 0.05); click(ctx, out, R, t, 1300, 0.25); }
        return 0.25;
      },
      c5_liftMotor(ctx, out, t0, p, R) {
        const d = p.dur ?? 5;
        const o = osc(ctx, 'sawtooth', 48, t0, d);
        o.frequency.setValueAtTime(42, t0); o.frequency.linearRampToValueAtTime(58, t0 + d * 0.5); o.frequency.linearRampToValueAtTime(40, t0 + d);
        const g = gain(ctx); env(g, t0, 0.14, 0.6, d - 1.0, 0.4);
        chain(o, filt(ctx, 'lowpass', 260), g, out);
        // (the cables over their sheave: a rhythmic tick)
        for (let t = t0 + 0.3; t < t0 + d - 0.3; t += 0.42) ping(ctx, out, t, [[rng(900, 1200), 0.012, 0.05]]);
        const n = noise(ctx, R, 'brown', t0, d, 1);
        const ng = gain(ctx); env(ng, t0, 0.08, 0.6, d - 1.0, 0.4);
        chain(n, filt(ctx, 'bandpass', 180, 0.8), ng, out);
        return d + 0.2;
      },
      c5_liftBell(ctx, out, t0) { ping(ctx, out, t0, [[1320, 0.16, 1.4], [2640, 0.05, 0.8], [3960, 0.02, 0.4]]); return 1.6; },
      c5_cage(ctx, out, t0, p, R) {
        for (let i = 0; i < 10; i++) ping(ctx, out, t0 + i * 0.05 + rng(0, 0.02), [[rng(800, 1800), 0.04, 0.08]]);
        thud(ctx, out, t0 + 0.55, 300, 200, 0.2, 0.05);
        burst(ctx, out, R, t0, 'white', ['bandpass', 1800, 0.8], 0.05, 0.05, 0.5);
        return 0.8;
      },
      c5_handle(ctx, out, t0, p, R) {
        // (slow: the spindle turning, the latch drawn back, a held breath)
        const o = osc(ctx, 'sawtooth', 160, t0, 0.6);
        o.frequency.linearRampToValueAtTime(230, t0 + 0.55);
        const g = gain(ctx); env(g, t0, 0.025, 0.1, 0.4, 0.1);
        chain(o, filt(ctx, 'bandpass', 1400, 6), g, out);
        click(ctx, out, R, t0 + 0.6, 2000, 0.4);
        return 0.8;
      },
      c5_envelope(ctx, out, t0, p, R) {
        burst(ctx, out, R, t0, 'white', ['bandpass', 3200, 1.4], 0.07, 0.01, 0.12);
        burst(ctx, out, R, t0 + 0.14, 'white', ['bandpass', 2600, 1.2], 0.06, 0.02, 0.2);
        return 0.4;
      },
      c5_tap(ctx, out, t0, p, R) {
        const o = osc(ctx, 'square', 900, t0, 0.18);
        o.frequency.linearRampToValueAtTime(1300, t0 + 0.15);
        const g = gain(ctx); env(g, t0, 0.02, 0.02, 0.12, 0.04);
        chain(o, filt(ctx, 'bandpass', 1500, 6), g, out);
        burst(ctx, out, R, t0 + 0.15, 'white', ['bandpass', 2000, 0.6], 0.08, 0.1, 1.2);
        return 1.5;
      },
      c5_typeKey(ctx, out, t0, p, R) { click(ctx, out, R, t0, 2200, 0.5); thud(ctx, out, t0 + 0.02, 300, 200, 0.12, 0.03); return 0.15; },
    },
  };
};

// The places' rooms (lane O5): each interior a sound of its own, built
// when the ear comes in and stopped when it leaves (Sfx.js ROOMS; the street
// comes through the walls low and dark):
//   o5_gym     a big bare hall: a heavy bag's slow thumps far off, a skipping rope's tick, the hall's tone
//   o5_bar     low talk (a murmur, no words), a glass now and then, the smoke-thick room tone
//   o5_big     a high storeroom, a garage, a warehouse: the rain on the roof far up, the tone of the space
//   o5_hall    the market hall: the crowd's murmur and footsteps under the iron roof, the rain on it
//   o5_house   the theatre's dark house: the projector's whirr from behind, a cough
export default (kit) => {
  const { gain, filt, chain, loopN, lfo } = kit;
  const stopper = (ctx, g, srcs) => ({ gain: g, stop() { const t = ctx.currentTime; g.gain.setTargetAtTime(0, t, 0.15); setTimeout(() => { for (const s of srcs) { try { s.stop(); } catch (e) { /* */ } } try { g.disconnect(); } catch (e) { /* */ } }, 1500); } });
  const tone = (ctx, R, g, srcs, f = 140, k = 0.1) => chain(loopN(ctx, R, 'brown', 0.7, srcs), filt(ctx, 'lowpass', f), gain(ctx, k), g);
  const murmur = (ctx, R, g, srcs, k = 0.05, rate = 0.55) => {
    // (talk with no words: band-passed noise in the voice's range, its level breathing slowly)
    const m = gain(ctx, k); chain(loopN(ctx, R, 'pink', rate, srcs), filt(ctx, 'bandpass', 520, 0.9), filt(ctx, 'lowpass', 1300), m, g);
    lfo(ctx, 0.31, k * 0.45, m.gain, 'sine', srcs); lfo(ctx, 1.7, k * 0.25, m.gain, 'triangle', srcs);
  };
  const roofRain = (ctx, R, g, srcs, k = 0.07) => { const r = gain(ctx, k); chain(loopN(ctx, R, 'pink', 0.9, srcs), filt(ctx, 'lowpass', 1600), filt(ctx, 'highpass', 200), r, g); lfo(ctx, 0.07, k * 0.3, r.gain, 'sine', srcs); };
  return {
    sounds: {},
    rooms: {
      o5_gym: { wall: 520, wallGain: 0.22, bed(ctx, R, out) {
        const g = gain(ctx, 0.0001), srcs = []; g.connect(out);
        tone(ctx, R, g, srcs, 110, 0.1);
        // the bag: a dull thump, twice a second and a half, coming and going
        const bag = gain(ctx, 0.0); chain(loopN(ctx, R, 'brown', 0.4, srcs), filt(ctx, 'lowpass', 160), bag, g);
        lfo(ctx, 1.4, 0.05, bag.gain, 'square', srcs); lfo(ctx, 0.11, 0.03, bag.gain, 'sine', srcs);
        murmur(ctx, R, g, srcs, 0.018, 0.5);
        return stopper(ctx, g, srcs);
      } },
      o5_bar: { wall: 600, wallGain: 0.25, bed(ctx, R, out) {
        const g = gain(ctx, 0.0001), srcs = []; g.connect(out);
        tone(ctx, R, g, srcs, 130, 0.07);
        murmur(ctx, R, g, srcs, 0.06, 0.6);
        // a glass, now and then: a high ring that comes in a beat of the slow lfo
        const gl = gain(ctx, 0); chain(loopN(ctx, R, 'white', 1.0, srcs), filt(ctx, 'bandpass', 3400, 8), gl, g);
        lfo(ctx, 0.23, 0.006, gl.gain, 'square', srcs);
        return stopper(ctx, g, srcs);
      } },
      o5_big: { wall: 450, wallGain: 0.3, bed(ctx, R, out) {
        const g = gain(ctx, 0.0001), srcs = []; g.connect(out);
        roofRain(ctx, R, g, srcs, 0.08);
        tone(ctx, R, g, srcs, 120, 0.12);
        return stopper(ctx, g, srcs);
      } },
      o5_hall: { wall: 500, wallGain: 0.28, bed(ctx, R, out) {
        const g = gain(ctx, 0.0001), srcs = []; g.connect(out);
        roofRain(ctx, R, g, srcs, 0.06);
        murmur(ctx, R, g, srcs, 0.07, 0.62);
        tone(ctx, R, g, srcs, 130, 0.09);
        return stopper(ctx, g, srcs);
      } },
      o5_house: { wall: 380, wallGain: 0.15, bed(ctx, R, out) {
        const g = gain(ctx, 0.0001), srcs = []; g.connect(out);
        // the projector: a whirr behind me, its shutter's flutter
        const pr = gain(ctx, 0.03); chain(loopN(ctx, R, 'white', 0.8, srcs), filt(ctx, 'bandpass', 900, 3), pr, g);
        lfo(ctx, 24, 0.012, pr.gain, 'square', srcs);
        tone(ctx, R, g, srcs, 90, 0.08);
        return stopper(ctx, g, srcs);
      } },
    },
  };
};

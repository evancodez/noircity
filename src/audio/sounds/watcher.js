// The watcher's scene (lane B4, scene 6): its sounds, all procedural.
// The iron of the fire escape under running feet (a tread's clank, a
// landing's ring, the ladder's screech and its stop), the blind's slats,
// the umbrella in the street, the run (a vault's hands on wood, a hop,
// the landings, a stumble, my breath), the board fence and the loose
// board, the dog behind its gate, the crates, his car (the handle, the
// door, the engine catching and pulling away), my car's door.
export default (kit) => {
  const { burst, thud, ping, osc, gain, env, filt, chain, noise, voice, splinter, rng, B, loopN, lfo } = kit;
  // an iron ring: inharmonic partials (a grating, a stair, a landing)
  const iron = (ctx, out, t0, k, lo = 1) => {
    for (const [f, a, d] of [[rng(230, 280) * lo, 0.22, 0.5], [rng(610, 690) * lo, 0.16, 0.34], [rng(1320, 1480) * lo, 0.1, 0.22], [rng(2600, 2900) * lo, 0.05, 0.12]]) {
      const o = osc(ctx, 'sine', f, t0, d + 0.05);
      const g = gain(ctx); env(g, t0, a * k, 0.001, d);
      chain(o, g, out);
    }
  };
  return {
    sounds: {
      // the fingers part the slats: a thin aluminium tick and a rattle
      w_slats(ctx, out, t0, p, R) {
        ping(ctx, out, t0, [[3100, 0.05, 0.05], [4700, 0.03, 0.04]]);
        for (let i = 0; i < 5; i++) burst(ctx, out, R, t0 + 0.02 + i * 0.025, 'white', ['bandpass', rng(2800, 4200), 3], 0.05, 0.0008, 0.012);
        return 0.25;
      },
      // the umbrella: a flop of wet cloth, the crook's knock, a skitter
      w_umbrella(ctx, out, t0, p, R) {
        burst(ctx, out, R, t0 + 0.32, 'pink', ['bandpass', 900, 0.8], 0.25, 0.005, 0.18);
        thud(ctx, out, t0 + 0.36, 320, 180, 0.12, 0.06);
        ping(ctx, out, t0 + 0.37, [[1400, 0.05, 0.05]]);
        for (let i = 0; i < 4; i++) burst(ctx, out, R, t0 + 0.5 + i * 0.13, 'white', ['bandpass', 2400, 2], 0.04, 0.002, 0.03);
        return 1.2;
      },
      // a tread of the iron stair under a running foot: a clank
      w_ironStep(ctx, out, t0, p, R) {
        thud(ctx, out, t0, 140, 80, 0.3, 0.07);
        burst(ctx, out, R, t0, 'white', ['bandpass', 2100, 1.4], 0.18, 0.0008, 0.03);
        const k = 0.6;
        for (const [f, a, d] of [[rng(520, 600), 0.1, 0.18], [rng(1250, 1400), 0.07, 0.12], [rng(2500, 2800), 0.04, 0.07]]) {
          const o = osc(ctx, 'sine', f, t0, d + 0.05); const g = gain(ctx); env(g, t0, a * k, 0.001, d); chain(o, g, out);
        }
        return 0.25;
      },
      w_ironWalk(ctx, out, t0, p, R) {
        thud(ctx, out, t0, 120, 70, 0.25, 0.08);
        burst(ctx, out, R, t0, 'white', ['bandpass', 1700, 1.2], 0.12, 0.001, 0.03);
        return 0.2;
      },
      // a landing reached at a run: it rings
      w_landing(ctx, out, t0, p, R) {
        thud(ctx, out, t0, 110, 60, 0.45, 0.12);
        burst(ctx, out, R, t0, 'white', ['bandpass', 1500, 1], 0.25, 0.001, 0.05);
        iron(ctx, out, t0, 1.0);
        return 0.6;
      },
      // the drop ladder lets go: the catch, the screech down the guides
      w_ladder(ctx, out, t0, p, R) {
        ping(ctx, out, t0, [[1900, 0.12, 0.05], [3400, 0.06, 0.04]]);
        const n = noise(ctx, R, 'white', t0 + 0.12, 0.8);
        const bp = filt(ctx, 'bandpass', 2600, 6);
        bp.frequency.setValueAtTime(3200, t0 + 0.12); bp.frequency.exponentialRampToValueAtTime(1500, t0 + 0.9);
        const g = gain(ctx); env(g, t0 + 0.12, 0.2, 0.08, 0.6, 0.1);
        chain(n, bp, g, out);
        const o = osc(ctx, 'sawtooth', 840, t0 + 0.15, 0.75);
        o.frequency.setValueAtTime(900, t0 + 0.15); o.frequency.exponentialRampToValueAtTime(520, t0 + 0.9);
        const go = gain(ctx); env(go, t0 + 0.15, 0.025, 0.1, 0.55, 0.1);
        chain(o, filt(ctx, 'bandpass', 1400, 3), go, out);
        return 1.0;
      },
      // ... and hits its stop: a deep clang, my feet on the stones
      w_ladderStop(ctx, out, t0, p, R) {
        thud(ctx, out, t0, 90, 45, 0.6, 0.2);
        iron(ctx, out, t0, 1.2, 0.8);
        B.step(ctx, out, t0 + 0.12, { run: true, k: 1.2 }, R);
        B.step(ctx, out, t0 + 0.24, { run: true, k: 0.9 }, R);
        return 0.9;
      },
      // the palms on the fence's top rail, the boards creak, a scuff
      w_vault(ctx, out, t0, p, R) {
        thud(ctx, out, t0, 210, 130, 0.35, 0.06);
        burst(ctx, out, R, t0, 'pink', ['bandpass', 1300, 1.2], 0.2, 0.002, 0.06);
        burst(ctx, out, R, t0 + 0.08, 'white', ['bandpass', 700, 3], 0.08, 0.02, 0.12);
        burst(ctx, out, R, t0 + 0.14, 'pink', ['bandpass', 2200, 1.5], 0.1, 0.01, 0.1);
        return 0.35;
      },
      // into the fence: boards rattle, a grunt of wood, the climb
      w_fenceHit(ctx, out, t0, p, R) {
        thud(ctx, out, t0, 150, 70, 0.6, 0.12);
        splinter(ctx, out, t0 + 0.01, R, 0.3, 5);
        for (let i = 0; i < 4; i++) burst(ctx, out, R, t0 + 0.25 + i * 0.16, 'pink', ['bandpass', rng(600, 1400), 1.5], 0.1, 0.01, 0.08);
        return 1.0;
      },
      // down on the wet stones after a vault: a slap and a splash
      w_land(ctx, out, t0, p, R) {
        thud(ctx, out, t0, 100, 55, 0.45, 0.1);
        burst(ctx, out, R, t0 + 0.005, 'white', ['bandpass', 2800, 0.9], 0.26, 0.002, 0.12);
        burst(ctx, out, R, t0 + 0.02, 'white', ['highpass', 4000], 0.1, 0.004, 0.2);
        return 0.4;
      },
      w_hop(ctx, out, t0, p, R) {
        burst(ctx, out, R, t0, 'white', ['bandpass', 2400, 1], 0.12, 0.002, 0.05);
        return 0.1;
      },
      // a shin into a crate: a knock, the crate skids, my breath caught
      w_stumble(ctx, out, t0, p, R) {
        thud(ctx, out, t0, 180, 90, 0.5, 0.1);
        splinter(ctx, out, t0, R, 0.25, 4);
        burst(ctx, out, R, t0 + 0.05, 'brown', ['bandpass', 400, 1], 0.25, 0.01, 0.25);
        burst(ctx, out, R, t0 + 0.06, 'pink', ['bandpass', 1100, 1.2], 0.12, 0.01, 0.2);
        return 0.5;
      },
      // my breath, running (p.k: how hard): a pair of rough exhales
      w_breath(ctx, out, t0, p, R) {
        const k = p.k ?? 1;
        burst(ctx, out, R, t0, 'pink', ['bandpass', 620, 0.9], 0.13 * k, 0.03, 0.16);
        burst(ctx, out, R, t0, 'white', ['bandpass', 1400, 1.4], 0.05 * k, 0.03, 0.12);
        return 0.25;
      },
      // the dog behind the gate: two barks, low and hard
      w_bark(ctx, out, t0, p, R) {
        for (const [dt, f0] of [[0, 310], [0.28, 290], [0.5, 340]]) {
          voice(ctx, out, t0 + dt, R, { f0, f1: f0 * 0.7, dur: 0.16, formants: [[700, 4], [1500, 6], [2600, 8]], breath: 0.7, level: 0.6, attack: 0.006 });
          burst(ctx, out, R, t0 + dt, 'pink', ['bandpass', 900, 1], 0.22, 0.004, 0.12);
        }
        return 0.9;
      },
      // the gate jumping on its hinges and chain
      w_gate(ctx, out, t0, p, R) {
        thud(ctx, out, t0, 130, 70, 0.55, 0.12);
        splinter(ctx, out, t0 + 0.005, R, 0.35, 6);
        ping(ctx, out, t0 + 0.02, [[1700, 0.06, 0.12], [2900, 0.04, 0.08]]);
        B.clang(ctx, out, t0 + 0.04, { k: 0.18 }, R);
        return 0.6;
      },
      // the loose board swinging back on its nail against the others
      w_board(ctx, out, t0, p, R) {
        thud(ctx, out, t0, 230, 140, 0.35, 0.05);
        burst(ctx, out, R, t0, 'pink', ['bandpass', 1500, 2], 0.14, 0.001, 0.05);
        thud(ctx, out, t0 + 0.42, 210, 130, 0.18, 0.05);
        const o = osc(ctx, 'sawtooth', 380, t0 + 0.05, 0.3);
        o.frequency.setValueAtTime(420, t0 + 0.05); o.frequency.exponentialRampToValueAtTime(300, t0 + 0.35);
        const g = gain(ctx); env(g, t0 + 0.05, 0.012, 0.05, 0.22);
        chain(o, filt(ctx, 'bandpass', 900, 5), g, out);
        return 0.6;
      },
      // his hand on the fence as he goes over it
      // [R2-C] out of the office: the curtain swept aside (a swish of thin
      // cloth), both palms on the escape window's sill (a flat slap on wood)
      w_curtain(ctx, out, t0, p, R) {
        burst(ctx, out, R, t0, 'pink', ['bandpass', 1400, 0.7], 0.16, 0.04, 0.22);
        burst(ctx, out, R, t0 + 0.05, 'white', ['bandpass', 3800, 1.2], 0.05, 0.03, 0.12);
        return 0.4;
      },
      w_sill(ctx, out, t0, p, R) {
        thud(ctx, out, t0, 210, 120, 0.28, 0.05);
        burst(ctx, out, R, t0, 'pink', ['bandpass', 1300, 1.2], 0.14, 0.002, 0.05);
        thud(ctx, out, t0 + 0.035, 190, 110, 0.2, 0.05);
        return 0.25;
      },
      w_fenceHand(ctx, out, t0, p, R) {
        thud(ctx, out, t0 + 0.12, 200, 120, 0.3, 0.06);
        burst(ctx, out, R, t0 + 0.12, 'pink', ['bandpass', 1200, 1.2], 0.16, 0.002, 0.06);
        B.step(ctx, out, t0 + 0.62, { run: true, k: 1 }, R);
        return 0.8;
      },
      // his car: the handle, the door slammed
      w_handle(ctx, out, t0, p, R) { ping(ctx, out, t0 + 0.25, [[1500, 0.08, 0.04], [2300, 0.05, 0.03]]); burst(ctx, out, R, t0 + 0.28, 'white', ['bandpass', 2600, 2], 0.08, 0.001, 0.03); return 0.4; },
      w_door(ctx, out, t0, p, R) {
        thud(ctx, out, t0, 95, 55, 0.7, 0.18);
        burst(ctx, out, R, t0, 'brown', ['lowpass', 700], 0.5, 0.002, 0.15);
        ping(ctx, out, t0 + 0.01, [[640, 0.08, 0.2], [1270, 0.04, 0.14]]);
        return 0.5;
      },
      // the engine catching, idling up and pulling away (a 5 s one-shot)
      w_engine(ctx, out, t0, p, R) {
        const dur = 5.2;
        // the starter's whine and the catch
        const st = osc(ctx, 'sawtooth', 60, t0, 0.6);
        st.frequency.setValueAtTime(55, t0); st.frequency.linearRampToValueAtTime(95, t0 + 0.55);
        const gs = gain(ctx); env(gs, t0, 0.08, 0.05, 0.4, 0.15);
        chain(st, filt(ctx, 'lowpass', 500), gs, out);
        // the running engine: a low saw and its firing pulses, rising, then away
        const e = osc(ctx, 'sawtooth', 38, t0 + 0.55, dur);
        e.frequency.setValueAtTime(34, t0 + 0.55); e.frequency.linearRampToValueAtTime(46, t0 + 1.4); e.frequency.exponentialRampToValueAtTime(88, t0 + 4.2);
        const am = osc(ctx, 'square', 13, t0 + 0.55, dur); am.frequency.setValueAtTime(13, t0 + 0.55); am.frequency.exponentialRampToValueAtTime(30, t0 + 4.2);
        const amg = gain(ctx, 0.35); chain(am, amg);
        const g = gain(ctx); env(g, t0 + 0.55, 0.3, 0.12, dur - 1.6, 0.9); amg.connect(g.gain);
        chain(e, filt(ctx, 'lowpass', 380), g, out);
        // the tyres on the wet
        const n = noise(ctx, R, 'white', t0 + 1.4, 3.6);
        const bp = filt(ctx, 'bandpass', 1800, 0.8);
        const gn = gain(ctx); env(gn, t0 + 1.4, 0.07, 0.6, 2.6, 0.2);
        chain(n, bp, gn, out);
        return dur + 0.3;
      },
      // my own car's door: the handle, it opens
      w_carDoorOpen(ctx, out, t0, p, R) {
        ping(ctx, out, t0, [[1400, 0.08, 0.04], [2200, 0.05, 0.03]]);
        burst(ctx, out, R, t0 + 0.03, 'white', ['bandpass', 2400, 2], 0.08, 0.001, 0.03);
        thud(ctx, out, t0 + 0.12, 150, 90, 0.2, 0.08);
        return 0.35;
      },
      // his shoe sliding on the wet stones at a corner: a hiss and a slap
      w_skid(ctx, out, t0, p, R) {
        const n = noise(ctx, R, 'white', t0, 0.35);
        const bp = filt(ctx, 'bandpass', 2400, 1.2);
        bp.frequency.setValueAtTime(3200, t0); bp.frequency.exponentialRampToValueAtTime(1400, t0 + 0.32);
        const g = gain(ctx); env(g, t0, 0.22, 0.01, 0.28);
        chain(n, bp, g, out);
        thud(ctx, out, t0 + 0.3, 110, 60, 0.3, 0.08);
        burst(ctx, out, R, t0 + 0.3, 'white', ['bandpass', 2600, 0.9], 0.16, 0.002, 0.1);
        return 0.5;
      },
      // the crates coming down: their stack knocked, wood on stone
      w_crates(ctx, out, t0, p, R) {
        splinter(ctx, out, t0 + 0.05, R, 0.4, 6);
        thud(ctx, out, t0 + 0.35, 130, 65, 0.5, 0.14);
        thud(ctx, out, t0 + 0.5, 150, 75, 0.35, 0.1);
        burst(ctx, out, R, t0 + 0.36, 'brown', ['bandpass', 500, 1], 0.25, 0.01, 0.2);
        return 0.8;
      },
      // "Lost him.": nothing but a low sting of the street
      w_lost(ctx, out, t0, p, R) { burst(ctx, out, R, t0, 'brown', ['lowpass', 300], 0.25, 0.2, 1.2); return 1.5; },

      // ---- [C6] the chase rebuilt: my moves ------------------------------------------------
      // a slide on the wet: a long hiss of the coat on the flags, falling,
      // and the knees' knock as it ends
      w_slide(ctx, out, t0, p, R) {
        const n = noise(ctx, R, 'white', t0, 0.7);
        const bp = filt(ctx, 'bandpass', 2600, 0.9);
        bp.frequency.setValueAtTime(3400, t0); bp.frequency.exponentialRampToValueAtTime(900, t0 + 0.65);
        const g = gain(ctx); env(g, t0, 0.3, 0.015, 0.62);
        chain(n, bp, g, out);
        burst(ctx, out, R, t0, 'brown', ['lowpass', 500], 0.28, 0.01, 0.4);
        thud(ctx, out, t0 + 0.02, 120, 60, 0.35, 0.1);
        return 0.8;
      },
      // into a wall, a fence, a shut door: the body's thump, the boards shake
      w_hitWall(ctx, out, t0, p, R) {
        thud(ctx, out, t0, 85, 40, 0.85, 0.16);
        burst(ctx, out, R, t0, 'brown', ['lowpass', 600], 0.5, 0.002, 0.2);
        splinter(ctx, out, t0 + 0.02, R, 0.2, 3);
        burst(ctx, out, R, t0 + 0.04, 'pink', ['bandpass', 900, 1.4], 0.12, 0.01, 0.25);
        return 0.6;
      },
      // a locked door shaken: the latch knocks in its keep, twice
      w_rattle(ctx, out, t0, p, R) {
        for (const dt of [0, 0.11, 0.2]) {
          thud(ctx, out, t0 + dt, 180, 110, 0.3, 0.05);
          ping(ctx, out, t0 + dt + 0.005, [[1900, 0.07, 0.05], [3100, 0.04, 0.03]]);
        }
        return 0.45;
      },
      // ducking under a thing, the coat brushing it
      w_duck(ctx, out, t0, p, R) {
        burst(ctx, out, R, t0, 'pink', ['bandpass', 1100, 0.8], 0.18, 0.03, 0.3);
        thud(ctx, out, t0 + 0.08, 160, 90, 0.15, 0.05);
        return 0.45;
      },
      // a door flung open by a shoulder (or by him): the bang of the leaf on
      // its stop, the hinges, a shake
      w_doorBang(ctx, out, t0, p, R) {
        const k = p.k ?? 1;
        thud(ctx, out, t0, 110, 55, 0.8 * k, 0.14);
        burst(ctx, out, R, t0, 'brown', ['bandpass', 500, 0.8], 0.45 * k, 0.002, 0.18);
        thud(ctx, out, t0 + 0.16, 140, 80, 0.45 * k, 0.12);
        splinter(ctx, out, t0 + 0.17, R, 0.18 * k, 3);
        const o = osc(ctx, 'sawtooth', 420, t0 + 0.04, 0.25);
        o.frequency.setValueAtTime(460, t0 + 0.04); o.frequency.exponentialRampToValueAtTime(260, t0 + 0.25);
        const g = gain(ctx); env(g, t0 + 0.04, 0.02 * k, 0.03, 0.18);
        chain(o, filt(ctx, 'bandpass', 1100, 6), g, out);
        return 0.6;
      },
      // the door slammed shut behind him: hard, the frame rings
      w_slam(ctx, out, t0, p, R) {
        thud(ctx, out, t0, 75, 38, 1.0, 0.2);
        burst(ctx, out, R, t0, 'brown', ['lowpass', 900], 0.6, 0.001, 0.22);
        ping(ctx, out, t0 + 0.005, [[520, 0.1, 0.3], [1180, 0.05, 0.2]]);
        return 0.6;
      },
      // the hands slapping onto the far parapet's coping, the body against the wall
      w_catch(ctx, out, t0, p, R) {
        thud(ctx, out, t0, 220, 130, 0.45, 0.05);
        burst(ctx, out, R, t0, 'white', ['bandpass', 1800, 1.2], 0.2, 0.002, 0.05);
        thud(ctx, out, t0 + 0.09, 95, 50, 0.6, 0.14);
        burst(ctx, out, R, t0 + 0.12, 'pink', ['bandpass', 700, 1], 0.12, 0.02, 0.2);
        return 0.5;
      },
      // the haul up: shoes scrabbling on brick, the coat over the coping
      w_haul(ctx, out, t0, p, R) {
        for (let i = 0; i < 4; i++) burst(ctx, out, R, t0 + 0.08 + i * 0.13, 'pink', ['bandpass', rng(900, 1700), 1.6], 0.12, 0.01, 0.08);
        burst(ctx, out, R, t0 + 0.45, 'pink', ['bandpass', 1200, 0.7], 0.15, 0.06, 0.25);
        thud(ctx, out, t0 + 0.85, 110, 60, 0.4, 0.1);
        return 1.0;
      },
      // down the shed's slates on the seat of the coat: a long rasp
      w_slideRoof(ctx, out, t0, p, R) {
        const n = noise(ctx, R, 'pink', t0, 0.9);
        const bp = filt(ctx, 'bandpass', 1300, 1.1);
        bp.frequency.setValueAtTime(1600, t0); bp.frequency.linearRampToValueAtTime(900, t0 + 0.85);
        const g = gain(ctx); env(g, t0, 0.34, 0.03, 0.82);
        chain(n, bp, g, out);
        for (let i = 0; i < 5; i++) burst(ctx, out, R, t0 + 0.1 + i * 0.15, 'white', ['bandpass', rng(2200, 3400), 3], 0.05, 0.002, 0.02);
        return 1.0;
      },
      // ... or slithering down it on the hands, a slate cracking
      w_slither(ctx, out, t0, p, R) {
        for (let i = 0; i < 7; i++) burst(ctx, out, R, t0 + i * 0.11, 'pink', ['bandpass', rng(800, 1600), 1.2], 0.16, 0.01, 0.07);
        splinter(ctx, out, t0 + 0.3, R, 0.22, 4);
        return 0.9;
      },
      // a hard landing from a drop: the heels, the knees, the splash
      w_landHard(ctx, out, t0, p, R) {
        thud(ctx, out, t0, 80, 40, 0.8, 0.16);
        burst(ctx, out, R, t0 + 0.004, 'white', ['bandpass', 2600, 0.8], 0.32, 0.002, 0.16);
        burst(ctx, out, R, t0 + 0.02, 'brown', ['lowpass', 400], 0.3, 0.01, 0.2);
        return 0.5;
      },
      // a foot on the tar of the roofs: dull, a little grit
      w_roofStep(ctx, out, t0, p, R) {
        thud(ctx, out, t0, 120, 70, 0.28, 0.06);
        burst(ctx, out, R, t0, 'pink', ['bandpass', 1600, 1.1], 0.09, 0.002, 0.05);
        return 0.15;
      },
      // ---- him, ahead: his slide, his leap and landing (heard to find him) ----------
      w_slideHim(ctx, out, t0, p, R) {
        const n = noise(ctx, R, 'white', t0, 0.55);
        const bp = filt(ctx, 'bandpass', 2400, 1);
        bp.frequency.setValueAtTime(3000, t0); bp.frequency.exponentialRampToValueAtTime(1000, t0 + 0.5);
        const g = gain(ctx); env(g, t0, 0.24, 0.02, 0.5);
        chain(n, bp, g, out);
        return 0.6;
      },
      w_leapHim(ctx, out, t0, p, R) {
        thud(ctx, out, t0, 150, 90, 0.35, 0.05);
        burst(ctx, out, R, t0, 'pink', ['bandpass', 1500, 1.2], 0.12, 0.002, 0.05);
        return 0.2;
      },
      w_landHim(ctx, out, t0, p, R) {
        thud(ctx, out, t0, 90, 45, 0.6, 0.14);
        burst(ctx, out, R, t0 + 0.004, 'pink', ['bandpass', 1300, 1], 0.2, 0.002, 0.12);
        return 0.4;
      },
      // ---- his doings ---------------------------------------------------------------------
      // the bins pulled over: tin on stone, the lids, rolling
      w_bins(ctx, out, t0, p, R) {
        for (const [dt, f] of [[0, 1], [0.12, 0.9], [0.22, 1.1], [0.35, 0.8]]) {
          thud(ctx, out, t0 + dt, 160 * f, 90 * f, 0.4, 0.08);
          ping(ctx, out, t0 + dt + 0.004, [[rng(700, 900) * f, 0.08, 0.25], [rng(1500, 1900) * f, 0.05, 0.18], [rng(2900, 3400), 0.03, 0.1]]);
        }
        // the lids spinning down
        for (let i = 0; i < 6; i++) ping(ctx, out, t0 + 0.5 + i * (0.09 - i * 0.009), [[rng(1100, 1300), 0.04 * (1 - i / 7), 0.06]]);
        const n = noise(ctx, R, 'white', t0 + 0.3, 0.9);
        const g = gain(ctx); env(g, t0 + 0.3, 0.06, 0.05, 0.8);
        chain(n, filt(ctx, 'bandpass', 900, 2), g, out);
        return 1.3;
      },
      // a rack of pans over on the tiles
      w_pans(ctx, out, t0, p, R) {
        for (let i = 0; i < 9; i++) {
          const dt = 0.05 + i * rng(0.03, 0.08);
          ping(ctx, out, t0 + dt, [[rng(400, 700), 0.09, 0.4], [rng(1100, 1600), 0.06, 0.3], [rng(2400, 3600), 0.04, 0.2]]);
          burst(ctx, out, R, t0 + dt, 'white', ['bandpass', rng(2500, 4500), 2], 0.06, 0.001, 0.03);
        }
        thud(ctx, out, t0 + 0.3, 120, 60, 0.5, 0.12);
        return 1.4;
      },
      // the barrow dragged across the flags: iron tyres grinding, a thump
      w_barrow(ctx, out, t0, p, R) {
        const n = noise(ctx, R, 'brown', t0, 0.9);
        const bp = filt(ctx, 'bandpass', 380, 1.4);
        const g = gain(ctx); env(g, t0, 0.35, 0.05, 0.8);
        chain(n, bp, g, out);
        for (let i = 0; i < 6; i++) burst(ctx, out, R, t0 + i * 0.14, 'pink', ['bandpass', rng(600, 900), 2], 0.09, 0.005, 0.05);
        thud(ctx, out, t0 + 0.9, 110, 55, 0.55, 0.14);
        return 1.1;
      },
      // ---- the street -------------------------------------------------------------------------
      // a car coming down the street: its engine nearing, the tyres' hiss
      w_carComing(ctx, out, t0, p, R) {
        const dur = 4.0;
        const e = osc(ctx, 'sawtooth', 44, t0, dur);
        e.frequency.setValueAtTime(42, t0); e.frequency.linearRampToValueAtTime(58, t0 + dur);
        const g = gain(ctx); env(g, t0, 0.22, 1.6, dur - 1.8, 0.4);
        chain(e, filt(ctx, 'lowpass', 300), g, out);
        const n = noise(ctx, R, 'white', t0, dur);
        const gn = gain(ctx); env(gn, t0, 0.1, 2.0, dur - 2.2, 0.3);
        chain(n, filt(ctx, 'bandpass', 1700, 0.8), gn, out);
        return dur + 0.2;
      },
      // his starter grinding (p.dur): the motor's whirr, the engine not catching
      w_starter(ctx, out, t0, p, R) {
        const dur = p.dur ?? 1.1;
        const o = osc(ctx, 'sawtooth', 70, t0, dur);
        o.frequency.setValueAtTime(62, t0);
        for (let k = 0; k < dur; k += 0.16) o.frequency.linearRampToValueAtTime(k % 0.32 < 0.16 ? 82 : 64, t0 + k + 0.16);
        const g = gain(ctx); env(g, t0, 0.2, 0.04, dur - 0.1, 0.06);
        chain(o, filt(ctx, 'lowpass', 600), g, out);
        for (let k = 0; k < dur; k += 0.16) burst(ctx, out, R, t0 + k, 'brown', ['lowpass', 300], 0.12, 0.005, 0.06);
        return dur + 0.1;
      },
      // the dog at the end of its chain: the chain snapping taut, the barks
      w_dog(ctx, out, t0, p, R) {
        ping(ctx, out, t0 + 0.2, [[2100, 0.06, 0.1], [3300, 0.04, 0.06]]);
        burst(ctx, out, R, t0 + 0.2, 'white', ['bandpass', 3000, 3], 0.08, 0.001, 0.05);
        for (const [dt, f0] of [[0.05, 300], [0.3, 280], [0.55, 330], [0.8, 300]]) {
          voice(ctx, out, t0 + dt, R, { f0, f1: f0 * 0.7, dur: 0.15, formants: [[700, 4], [1500, 6], [2600, 8]], breath: 0.7, level: 0.65, attack: 0.006 });
          burst(ctx, out, R, t0 + dt, 'pink', ['bandpass', 900, 1], 0.22, 0.004, 0.12);
        }
        return 1.2;
      },
      // [C6 2nd] the kitchen's iron door flung open against its stop: the
      // latch's clack, the slab's boom, the ring of the iron
      w_ironDoor(ctx, out, t0, p, R) {
        ping(ctx, out, t0, [[1800, 0.1, 0.04], [3100, 0.06, 0.03]]);
        burst(ctx, out, R, t0, 'white', ['bandpass', 2600, 2], 0.12, 0.001, 0.03);
        thud(ctx, out, t0 + 0.2, 72, 40, 0.9, 0.3);
        burst(ctx, out, R, t0 + 0.2, 'brown', ['lowpass', 420], 0.5, 0.002, 0.25);
        for (const [f, a, d] of [[rng(180, 210), 0.12, 0.7], [rng(470, 520), 0.08, 0.5], [rng(1100, 1250), 0.05, 0.3]]) {
          const o = osc(ctx, 'sine', f, t0 + 0.2, d + 0.05); const g = gain(ctx); env(g, t0 + 0.2, a, 0.002, d); chain(o, g, out);
        }
        return 1.0;
      },
      // bundles of the edition going over: dull slabs of paper on the floor, the twine's slap
      w_bundles(ctx, out, t0, p, R) {
        for (let i = 0; i < 5; i++) {
          const t = t0 + 0.12 + i * rng(0.06, 0.1);
          thud(ctx, out, t, rng(150, 230), 70, 0.4, 0.09);
          burst(ctx, out, R, t, 'white', ['bandpass', rng(1800, 2800), 1.2], 0.12, 0.001, 0.05);
        }
        burst(ctx, out, R, t0, 'pink', ['bandpass', 900, 0.8], 0.15, 0.02, 0.2);
        return 0.9;
      },
    },
    // [C6 2nd] the press hall: the night edition running - the units' heavy
    // beat, the clatter of the folders, the web's hiss, the motors' hum
    rooms: {
      press: { wall: 520, wallGain: 0.12, bed: pressBed },
    },
  };
  function pressBed(ctx, R, out) {
    const master = gain(ctx, 0.0001); master.connect(out);
    const srcs = [];
    const beat = gain(ctx, 0.15); chain(loopN(ctx, R, 'brown', 0.9, srcs), filt(ctx, 'lowpass', 170), beat, master);
    lfo(ctx, 5.4, 0.08, beat.gain, 'sine', srcs);
    const clat = gain(ctx, 0.028); chain(loopN(ctx, R, 'pink', 1.2, srcs), filt(ctx, 'bandpass', 1900, 1.3), clat, master);
    lfo(ctx, 10.8, 0.022, clat.gain, 'square', srcs);
    const chop = gain(ctx, 0.03); chain(loopN(ctx, R, 'pink', 0.8, srcs), filt(ctx, 'bandpass', 420, 1.6), chop, master);
    lfo(ctx, 2.7, 0.028, chop.gain, 'sawtooth', srcs);
    chain(loopN(ctx, R, 'white', 1, srcs), filt(ctx, 'highpass', 3200), gain(ctx, 0.01), master);
    for (const [f, a] of [[50, 0.012], [100, 0.008], [150, 0.004]]) { const o = ctx.createOscillator(); o.frequency.value = f; o.start(); srcs.push(o); chain(o, gain(ctx, a), master); }
    return { gain: master, stop() { const t = ctx.currentTime; master.gain.setTargetAtTime(0, t, 0.15); setTimeout(() => { for (const x of srcs) { try { x.stop(); } catch (e) { /* */ } } try { master.disconnect(); } catch (e) { /* */ } }, 1500); } };
  }
};

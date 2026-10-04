// [R3] walk away from the scripted path: from where the beat puts me, W held for a few seconds in
// eight headings (the yaw set directly), the eye sampled every 100 ms. Reports pops (a step of
// more than 1 m between samples), the eye's height jumping or falling away, the farthest reach.
//   HUNT_AT=body.approach HUNT_SECS=4 NOIR_PORT=5332 node tools/hunt.mjs tools/hunts/walkabout.mjs
export default async function (h) {
  const at = process.env.HUNT_AT || 'body.approach';
  const secs = +(process.env.HUNT_SECS || 4);
  const wait = +(process.env.HUNT_WAIT || 3500);
  await h.open(`/?mute=1&start=${at}`);
  h.check(`${at}: begun`, await h.begin());
  await h.wait(wait);
  await h.say();
  const S = () => h.js(`(() => { const C = N.controller, e = G.eye; return [e.x, e.y, e.z, C.mode, G.scenes.beat, C.frozen]; })()`);
  const s0 = await S();
  h.log('start ' + JSON.stringify(s0.map((v) => typeof v === 'number' ? +v.toFixed(2) : v)));
  for (let k = 0; k < 8; k++) {
    // back to the start, facing heading k
    const head = k * Math.PI / 4;
    await h.js(`(() => { const C = N.controller; C.setPose(${s0[0]}, ${s0[2]}, ${head}, 0); return 1; })()`);
    // (the scene may have moved on: only the mode walk is meaningful)
    await h.wait(300);
    const m = (await S())[3];
    // [C10a] (the modes a player walks in: on foot, the gun out, sneaking)
    const MODES = (process.env.HUNT_MODES || 'walk,gun,sneak').split(',');
    if (!MODES.includes(m)) { h.log(`heading ${k}: mode is ${m}, skipped`); continue; }
    let prev = await S(), maxD = 0, pops = 0, ymin = 9, ymax = -9, steps = 0;
    await h.down('KeyW');
    const T = Date.now() + secs * 1000;
    while (Date.now() < T) {
      await h.wait(100);
      const s = await S();
      const d = Math.hypot(s[0] - prev[0], s[2] - prev[2]);
      if (d > 1.0) { pops++; h.log(`  POP heading ${k}: ${d.toFixed(2)} m in 0.1 s at ${s[0].toFixed(1)},${s[2].toFixed(1)}`); }
      if (Math.abs(s[1] - prev[1]) > 0.5) h.log(`  eye height jump ${prev[1].toFixed(2)} -> ${s[1].toFixed(2)} at ${s[0].toFixed(1)},${s[2].toFixed(1)}`);
      maxD = Math.max(maxD, Math.hypot(s[0] - s0[0], s[2] - s0[2]));
      ymin = Math.min(ymin, s[1]); ymax = Math.max(ymax, s[1]);
      prev = s; steps++;
      if (s[3] !== m) { h.log(`  the mode went to ${s[3]} (beat ${s[4]})`); break; }
    }
    await h.up('KeyW');
    h.log(`heading ${k}: reach ${maxD.toFixed(1)} m, eye y ${ymin.toFixed(2)}..${ymax.toFixed(2)}, ends at ${prev[0].toFixed(1)},${prev[2].toFixed(1)}, ${pops} pops`);
    if (ymin < 0.2) h.check(`heading ${k}: the eye stays above the ground`, false, { ymin });
  }
  await h.say();
}

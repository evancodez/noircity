// [C6] The jank run (WAVE_C §7 item 5) for chapter V, by real input: at each
// place the eye is put down facing a thing - a wall, a fence, a door, a table,
// a parked car, a man, a dog, the roof's edge - and W is held into it for a
// second and a half at a run (and again at a walk: W tapped); then the body is
// checked: not through it (still on the near side of its face), the feet on a
// surface (not in the air, not under the ground), no fall unless the place
// is an edge with a drop. Returns { ok, rows: [[name, ok, why]] }.
// { "drive": "tools/lib/c6_jank.mjs", "check": "D.ok" }
const PLACES = [
  // name, [x, z, yaw] (yaw 0 faces -z, PI/2 faces -x), the face: axis, value,
  // side (+1: must stay above the value, -1: below)
  // (his sedan first: it is at its kerb only in the beat's first seconds)
  ['Pell Lane into his sedan', [-1.2, -101.5, Math.PI / 2], ['x', -3.15, 1]],
  ['alley east wall', [2.5, -20, -Math.PI / 2], ['x', 5.0, -1]],
  ['alley west wall (the Harbor Building)', [2.5, -30, Math.PI / 2], ['x', 0.0, 1]],
  ['fence1 without SPACE', [9.0, -50, -Math.PI / 2], ['x', 13.0, -1]],
  ['fence2 without C', [20.0, -50, -Math.PI / 2], ['x', 24.0, -1]],
  ['the wash-house', [55.0, -65, -Math.PI / 2], ['x', 58.5, -1]],
  ['the yard\'s east wall', [66.0, -66, -Math.PI / 2], ['x', 70.0, -1]],
  ['the kitchen table', [60.0, -88.5, 0], ['z', -91.6, 1]],
  ['the kitchen\'s ranges (the middle stove)', [53.0, -92.6, Math.PI / 2], ['x', 51.4, 1]],
  ['the kitchen hand by the sinks', [66.0, -95.4, -Math.PI / 2], ['x', 68.1, -1]],
  ['the roller door without C', [60.0, -97.0, 0], ['z', -99.88, 1]],
  ['the loading yard into the stair\'s side', [63.0, -102.5, 0], ['z', -104.8, 1]],
  ['Tanner\'s Row into the truck', [44.0, -114.6, 0], ['z', -116.15, 1]],
  ['Tanner\'s Row into the bay\'s dock', [44.0, -119.0, 0], ['z', -120.45, 1]],
  ['Mercer St into the garage\'s front wall', [25.2, -95.0, Math.PI], ['z', -86.0, -1]],
  ['the market into a stall', [9.0, -105.0, Math.PI / 2], ['x', 6.6, 1]],
  ['the market wall on Mercer St', [20.0, -105.0, Math.PI / 2], ['x', 16.0, 1]],
  ['Pell Lane into my coupe', [-1.2, -91.0, Math.PI / 2], ['x', -3.16, 1]],
  ['Pell Lane\'s north end into the block across', [-7.0, -140.0, 0], ['z', -159.0, 1]],
  ['Harbor St\'s hoarding (west)', [-30.0, 0.0, Math.PI / 2], ['x', -36.5, 1]],
  ['Harbor St\'s hoarding (east)', [94.0, 0.0, -Math.PI / 2], ['x', 100.5, -1]],
];
export default async function drive({ js, keyDown, keyUp, sleep, log, opts }) {
  const rows = [];
  for (const [name, [x, z, yaw], [axis, v, side]] of PLACES) {
    for (const pace of ['run', 'walk']) {
      // (put down there in the run mode, facing it, still)
      await js(`(() => { const C = N.controller; C.setPose(${x}, ${z}, ${yaw}, 0); const ctx = G.scenes.ctx; G.controller.setMode('run', { game: G, speed: 6.8, side: 2.6, things: N.stage.part('things'), onEvent: () => {} }); return 1; })()`);
      await sleep(250);
      if (pace === 'run') { await keyDown('KeyW'); await sleep(1500); await keyUp('KeyW'); }
      else for (let i = 0; i < 6; i++) { await keyDown('KeyW'); await sleep(110); await keyUp('KeyW'); await sleep(160); }
      await sleep(400);
      const s = await js(`(() => { const C = N.controller, R = C.run; return { x: C.pos.x, z: C.pos.z, feet: R ? R.feet : C.groundY, ground: N.stage.surfaceY(C.pos.x, C.pos.z), move: R && R.move ? R.move.kind : null }; })()`);
      const p = axis === 'x' ? s.x : s.z;
      const through = side > 0 ? p < v - 0.02 : p > v + 0.02;
      const floating = Math.abs(s.feet - s.ground) > 0.3;
      const ok = !through && !floating;
      rows.push([name + ' (' + pace + ')', ok, ok ? '' : `pos ${s.x.toFixed(2)},${s.z.toFixed(2)} feet ${s.feet.toFixed(2)} ground ${s.ground.toFixed(2)} ${s.move || ''}`]);
      if (!ok) log(`c6_jank: THROUGH or FLOATING at ${name} (${pace}): ${rows[rows.length - 1][2]}`);
    }
  }
  const bad = rows.filter((r) => !r[1]);
  log(`c6_jank: ${rows.length - bad.length} of ${rows.length} held`);
  void opts;
  return { ok: bad.length === 0, n: rows.length, bad };
}

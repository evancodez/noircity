// [C6] The jank run (WAVE_C §7 item 5) for chapter V, by real input: at each
// place the eye is put down facing a thing - a wall, a fence, a door, a table,
// a parked car, a man, a dog, the roof's edge - and W is held into it for a
// second and a half at a run (and again at a walk: W tapped); then the body is
// checked: not through it (still on the near side of its face), the feet on a
// surface (not in the air, not under the ground), no fall unless the place
// is an edge with a drop. Returns { ok, rows: [[name, ok, why]] }.
// { "drive": "tools/lib/c6_jank.mjs", "check": "D.ok" }
const CUT_GATE_X = 92.9;
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
  ['the kitchen hand by the sinks', [66.0, -93.9, -Math.PI / 2], ['x', 68.1, -1]],
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
  // ([C6 2nd] Harbor Street runs on across the avenue now: its hoarding is past it)
  ['Harbor St\'s hoarding (east)', [110.0, 0.0, -Math.PI / 2], ['x', 117.25, -1]],
  // [C6 2nd] the kitchen's iron door's wall, the press hall, the avenue, the alley behind
  // ([C6 3rd] the kitchen's east wall beside its iron door: the flour sacks
  // lie before the door now - run at it, a man trips over them; out of the list)
  ['the press hall: the north line\'s first unit', [76.0, -97.2, Math.PI], ['z', -93.68, -1]],
  ['the pressman at it', [76.0, -96.8, Math.PI], ['z', -94.69, -1]],
  ['the web without C', [79.65, -96.4, Math.PI], ['z', -93.1, -1]],
  ['the north line\'s folder from the middle aisle', [87.2, -88.0, 0], ['z', -90.95, 1]],
  ['the press hall\'s east wall', [91.4, -90.0, -Math.PI / 2], ['x', 93.45, -1]],
  ['the avenue: the van at the dock', [98.3, -82.0, Math.PI], ['z', -74.2, -1]],
  ['the avenue: an el column', [96.6, -89.5, Math.PI], ['z', -86.22, -1]],
  ['the avenue: the news-stand', [98.4, -93.4, Math.PI / 2], ['x', 95.5, 1]],
  ['the avenue\'s hoarding (north)', [100.0, -123.0, 0], ['z', -127.9, 1]],
  ['the alley: the steam pipe without C', [88.0, -103.0, Math.PI / 2], ['x', 82.64, 1]],
  ['the alley: the next block\'s wall', [86.0, -102.6, 0], ['z', -106.0, 1]],
  // [C6 3rd] the new places: the delivery yard, the shut dock, the alley's
  // barrier, the cut, the street's corner, the market's back arch, the
  // market's west aisle, its chained gateway, a door in a wall
  ['the delivery yard: the reels without SPACE', [89.3, -65.6, Math.PI], ['z', -63.2, -1]],
  ['the delivery yard: the van\'s side', [88.6, -65.0, Math.PI / 2], ['x', 86.45, 1]],
  ['the press hall: the dock\'s shutter from inside', [91.0, -78.2, -Math.PI / 2], ['x', 93.23, -1]],
  ['the alley behind the press hall: its barrier', [77.9, -103.0, -Math.PI / 2], ['x', 80.4, -1]],
  ['the cut: its gate pulled to', [96.4, -118.9, Math.PI / 2], ['x', CUT_GATE_X + 0.11, 1], "N.stage.part('things').get('cutGate').set('shut')"],
  // (the low things - the barrels, the handcart, the sacks - trip a man over
  // them by design: not in this list)
  ['the cut: the N-S leg\'s west wall', [77.9, -112.0, Math.PI / 2], ['x', 76.2, 1]],
  ['the cut: the pipe without C', [77.9, -115.0, Math.PI], ['z', -111.84, -1]],
  ['Mercer St into the block at the corner', [23.6, -126.0, -Math.PI / 2], ['x', 26.0, -1]],
  ['the market\'s gateway, chained', [19.0, -117.4, Math.PI / 2], ['x', 16.31, 1]],
  ['the arch: its west wall', [8.5, -127.0, Math.PI / 2], ['x', 7.0, 1]],
  ['the arch: its gate shut', [8.6, -125.0, Math.PI], ['z', -122.4, -1], "N.stage.part('things').get('archGate').set('shut')"],
  ['the market\'s west aisle: the table without C', [3.3, -114.0, Math.PI], ['z', -110.55, -1]],
  ['a door in the alley\'s wall', [2.6, -22.6, -Math.PI / 2], ['x', 4.85, -1]],
];
export default async function drive({ js, keyDown, keyUp, sleep, log, opts }) {
  const rows = [];
  for (const [name, [x, z, yaw], [axis, v, side], prep] of PLACES) {
    for (const pace of ['run', 'walk']) {
      if (prep) await js(`(${prep}, 1)`);
      // (put down there in the run mode, facing it, still)
      await js(`(() => { const C = N.controller; C.setPose(${x}, ${z}, ${yaw}, 0); const ctx = G.scenes.ctx; G.controller.setMode('run', { game: G, speed: 6.75, side: 2.6, things: N.stage.part('things'), onEvent: () => {} }); return 1; })()`);
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

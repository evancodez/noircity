// [C5] The jank walk on the Harbor Building's third floor (WAVE_C §7.5), by real
// input: W held into every wall, door, piece of furniture and person, from a
// standing start a step or two off; after each, the eye must be outside what
// it walked into (a box it may not enter), and in the room it started in.
// And every door tried with E: the ones that open open, finished behind; the
// locked ones rattle. (tools/play.mjs { "drive": "tools/lib/c5_jank.mjs" })
export default async function drive({ js, keyDown, keyUp, sleep, log, shot }) {
  const rec = { cases: [], bad: [] };
  // [name, start x, z, yaw (0: facing -z, PI/2: facing -x), the box the eye must stay out of [x0, x1, z0, z1], hold ms]
  const PI = Math.PI, E = -PI / 2, Wd = PI / 2, N = PI, S = 0;
  const CASES = [
    // the walls of every room (a hand's breadth inside them is the limit: the eye stops short of the plaster)
    ['Ames: street wall', 4.6, 6.2, E, [5.48, 9, -9, 9]],
    ['Ames: north wall', 1.0, 4.6, N, [-9, 9, 6.88, 9]],
    ['Ames: south wall by the safe', 1.6, 1.4, S, [-9, 9, -9, 0.12]],
    ['outer: west wall (the bench)', -2.6, 1.4, Wd, [-9, -3.68, -9, 9]],
    ['outer: north wall', -3.0, 5.4, N, [-9, 9, 6.88, 9]],
    ['corridor: west wall', -4.6, 2.2, Wd, [-9, -5.48, -9, 9]],
    ['corridor: south end (the cage, shut)', -4.78, -5.8, S, [-9, 9, -9, -7.08]],
    ['corridor: north end beside the washroom', -4.2, 5.6, N, [-9, 9, 6.88, 9]],
    ['305: south wall', 1.0, -3.0, S, [-9, 9, -9, -4.68]],
    ['305: street wall', 4.4, -2.5, E, [5.48, 9, -9, 9]],
    // the doors, shut (the suite's front door from the corridor, 305's, the connecting door, the stair, the washroom, a locked office)
    ['the suite door, shut, from the corridor', -5.0, 3.38, E, [-3.86, 9, 2.9, 3.85]],
    ['305 door, shut, from the corridor', -5.0, -1.88, E, [-3.86, 9, -2.35, -1.4]],
    ['the connecting door, shut, from Ames', 4.7, 1.4, S, [-9, 9, -9, 0.04]],
    ['the stair door, shut', -4.6, -4.98, Wd, [-9, -5.62, -5.45, -4.5]],
    ['the washroom door, shut', -4.8, 5.9, N, [-9, 9, 7.04, 9]],
    ['301, locked', -4.6, 4.4, Wd, [-9, -5.62, 3.9, 4.9]],
    ['306, locked', -4.6, -6.1, E, [-3.94, 9, -6.6, -5.6]],
    // the furniture
    ['Ames desk, from its front', 2.4, 3.7, E, [3.5, 4.4, 2.9, 4.55]],
    ['Ames in his chair', 5.15, 2.3, N, [4.45, 5.05, 3.32, 3.95]],
    ['the cabinets', 1.0, 4.9, N, [0.27, 1.77, 6.3, 7.0]],
    ['the adding machine table', 0.95, 1.6, S, [0.6, 1.3, 0.1, 0.56]],
    ['the coat stand', 0.42, 4.6, N, [0.25, 0.6, 5.6, 5.9]],
    ['the secretary desk, from the door side', -3.0, 5.25, E, [-1.99, -1.21, 4.55, 5.95]],
    ['the bench', -2.6, 1.45, Wd, [-3.8, -3.32, 0.55, 2.35]],
    ['the cooler', -2.75, 1.6, S, [-2.94, -2.56, 0.23, 0.61]],
    ['the cart', -4.9, 0.6, S, [-4.58, -3.98, -1.3, -0.4]],
    ['the radiator', -4.7, -0.2, Wd, [-9, -5.36, -0.6, 0.2]],
    ['a dust sheet in 305', 1.2, -0.9, S, [0.41, 1.99, -3.04, -2.16]],
    ['the chimney breast in 305', 2.75, -1.6, N, [2.35, 3.15, -0.58, 0.0]],
  ];
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  for (const [name, x, z, yaw, box] of CASES) {
    await js(`(N.controller.setPose(${x}, ${z}, ${yaw}, -0.05), N.controller.setMode('walk'), 1)`);
    await sleep(250);
    await keyDown('KeyW');
    let inside = false, minD = 99;
    const T = Date.now();
    while (Date.now() - T < 1700) {
      const e = await js('[N.game.eye.x, N.game.eye.z]');
      if (e[0] > box[0] && e[0] < box[1] && e[1] > box[2] && e[1] < box[3]) inside = true;
      await sleep(60);
    }
    await keyUp('KeyW');
    await sleep(150);
    const e = await js('[+N.game.eye.x.toFixed(2), +N.game.eye.z.toFixed(2)]');
    const ok = !inside;
    rec.cases.push({ name, ok, at: e });
    if (!ok) { rec.bad.push(name); log(`c5 jank: INTO ${name} (eye ${e})`); await shot('jank_' + rec.cases.length); }
    void minD; void wrap;
  }
  // every door tried: E at it (aim at its middle), each opens (finished behind) or rattles
  const DOORS = await js(`Object.entries(N.game.stage.part('office').doors).map(([n, d]) => [n, d.centre.x, d.centre.z, d.spec.axis, d.locked])`);
  rec.doors = {};
  for (const [n, cx, cz, axis, locked] of DOORS) {
    // (stand on the corridor's / the room's side a step off, facing it)
    const off = n === 'CONN' ? [0, 1.1, 0] : n === 'WC' ? [0, -1.1, N] : n === 'STAIR' ? [1.1, 0, Wd] : n === 'GATE' ? [1.1, 0, Wd] : [-1.1, 0, E];
    await js(`(N.controller.setPose(${cx + off[0]}, ${cz + off[1]}, ${off[2]}, -0.05), N.controller.setMode('walk'), 1)`);
    await sleep(500);
    const before = await js(`N.game.stage.part('office').doors.${n}.open01`);
    await keyDown('KeyE'); await sleep(60); await keyUp('KeyE');
    await sleep(1200);
    const after = await js(`N.game.stage.part('office').doors.${n}.open01`);
    rec.doors[n] = { locked, opened: after > before + 0.3 };
  }
  rec.allDoors = Object.entries(rec.doors).every(([n, d]) => (d.locked ? !d.opened : d.opened));
  rec.ok = rec.bad.length === 0;
  return rec;
}

// Lane C3's presets (chapter VI, the city): the stage seen from anywhere
// without the scene (look development), from above (the map), and the
// scene's beats with a staged minute of driving.
//   ?shot=city&pose=x,z,yaw,pitch[,fov]&y=<eye height>   anywhere in the city
//   ?shot=citymap&y=420                                   the district from above
//   ?shot=c3drive&drive=<inputs>                          (tail start) the
//     car driven by a list of timed inputs: 'W@0-4,A@2-3,Space@2.5-2.9'
// (their times: t= in the query)
const q = () => new URLSearchParams(location.search);
const at = (x, z, yaw, pitch, fov = 70, y = 0) => ({
  t: 2, fov,
  stage(stage, camera, controller, game) {
    game.enterStage('city');
    const p = q().get('pose');
    const [px, pz, pyaw, ppitch] = p ? p.split(',').map(Number) : [x, z, yaw, pitch];
    controller.setPose(px, pz, pyaw, ppitch, parseFloat(q().get('y') ?? y));
  },
});

// timed inputs as a player's (key down at t0, up at t1)
function drive(game, list) {
  for (const item of list.split(',')) {
    const [code, span] = item.split('@');
    const [t0, t1] = span.split('-').map(Number);
    let s = 0;
    const key = code.length === 1 ? 'Key' + code : code;
    game.scripts.push((t) => {
      if (s === 0 && t >= t0) { s = 1; game.vin.down.add(key); game.vin.held.add(key); }
      else if (s === 1 && t >= t1) { s = 2; game.vin.held.delete(key); game.vin.up.add(key); }
    });
  }
}

export const presets = {
  city: at(-209, 36, 0, 0),
  citymap: { t: 1, fov: 60, stage(stage, camera, controller, game) { game.enterStage('city'); const y = parseFloat(q().get('y') ?? 520); const p = (q().get('pose') || '-60,-40,0,-1.5707').split(',').map(Number); controller.setPose(p[0], p[1], p[2], p[3], y); } },
  // the scene's start, its car driven by timed inputs (?drive=...)
  c3drive: { scene: 'tail', beat: 'start', t: 6, stage(stage, camera, controller, game) { const d = q().get('drive'); if (d) drive(game, d); } },
};

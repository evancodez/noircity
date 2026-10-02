// [R3] copies of the lanes' plays with a state dump appended (what is left over when a chapter hands on):
//   node tools/hunts/mkplays.mjs <outdir>
// The dump is taken at the first second of the next chapter and again once its card and fade are gone.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

export const LEAK = `(() => { const C = N.controller, S = G.scenes, H = G.hands, K = H.held, kind = (o) => o ? (o.userData && o.userData.kind) || o.name || 'obj' : null;
  return JSON.stringify({ scene: S.current ? S.current.id : null, beat: S.beat, trans: S.trans ? S.trans.phase : null, st: G.state, mode: C.mode, frozen: C.frozen, lookLocked: !!C.lookLocked, auto: !!C.auto, ease: !!C._ease, bodyYaw: C.bodyYaw == null ? null : +C.bodyYaw.toFixed(2),
    viewFx: C.viewFx ? Object.keys(C.viewFx).filter((k) => C.viewFx[k]) : null, fov: N.camera.fov, pitch: +C.pitch.toFixed(2), roll: +N.camera.rotation.z.toFixed(3),
    hands: H.set, held: { R: kind(K.R), L: kind(K.L), M: kind(K.M) }, clip: H.current, busy: H.busy, still: !!H.still, studyFov: !!H.studyFov, snPath: !!H.snPath, vmLower: [+(+G.vm.lower).toFixed(2), G.vm.lowerTarget], weap: G.player.weapons.current, ammo: G.weapon.ammo, rev: G.player.weapons.get('revolver') ? G.player.weapons.get('revolver').ammo : null,
    vm: G.vm.visible, ts: G.timeScale, hs: G.hitStop, hp: Math.round(G.health.hp), dead: G.health.dead,
    layers: G.hud.layers ? [...G.hud.layers.keys()] : [], inter: G.interact.list.length, inspect: !!G.inspect.active, puz: G.puzzles.active ? G.puzzles.active.id : null, brawl: G.brawl.active, dirActive: G.director.active, lull: G.director.lull,
    hoods: G.stage.hoods.list.filter((h) => h.alive).length, corpses: G.corpses.length, cast: G.stage.cast.list.length, ais: G.ais.size, pending: G.pending.length,
    prompt: G.hud.promptShown, say: G.hud.sayShown, paused: G.hud.paused, endShown: G.hud.endShown, fade: +S.fadeK.toFixed(2), stage: G.stage.name, inv: [...G.save.inventory], flags: Object.keys(G.save.flags),
    locked: !!document.pointerLockElement, keys: [...C.keys].join(','), pos: [+C.pos.x.toFixed(2), +C.pos.z.toFixed(2)], eyeY: +N.camera.position.y.toFixed(2),
    veh: G.vehicles && G.vehicles.list ? G.vehicles.list.length : null, music: G.music && G.music.current ? G.music.current : null }); })()`;

if (process.argv[1] && process.argv[1].endsWith('mkplays.mjs')) {
  const out = resolve(process.argv[2] || 'shots/hunt/plays');
  mkdirSync(out, { recursive: true });
  for (const f of readdirSync('tools/plays').filter((n) => n.endsWith('.json'))) {
    const d = JSON.parse(readFileSync('tools/plays/' + f, 'utf8'));
    d.out = 'shots/hunt/playshots/' + f.replace('.json', '');
    d.steps.push({ wait: 900 }, { eval: LEAK }, { wait: 4200 }, { eval: LEAK }, { shot: 'after_next' });
    writeFileSync(`${out}/${f}`, JSON.stringify(d, null, 1));
  }
  console.log('written', out);
}

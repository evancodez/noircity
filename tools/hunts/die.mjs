// [R3] die where it is possible and retry: the player is brought to hp 0 (what a Hood's rounds do),
// and what comes back is looked at: the mode, the hands, the gun, the controls, the fade.
//   HUNT_AT=gunfight.door HUNT_WAIT=4000 NOIR_PORT=5332 node tools/hunt.mjs tools/hunts/die.mjs
import { LEAK } from './mkplays.mjs';

export default async function (h) {
  const at = process.env.HUNT_AT || 'gunfight.door';
  const wait = +(process.env.HUNT_WAIT || 4000);
  const times = +(process.env.HUNT_TIMES || 2);
  await h.open(`/?mute=1&start=${at}`);
  h.check(`${at}: begun`, await h.begin());
  await h.wait(wait);
  await h.say();
  const dump = async (tag) => { const v = JSON.parse(await h.js(LEAK)); h.log(`${tag}: ${JSON.stringify({ scene: v.scene, beat: v.beat, trans: v.trans, st: v.st, mode: v.mode, frozen: v.frozen, lookLocked: v.lookLocked, fov: v.fov, hands: v.hands, held: v.held, weap: v.weap, ammo: v.ammo, rev: v.rev, vm: v.vm, ts: v.ts, hp: v.hp, dead: v.dead, brawl: v.brawl, hoods: v.hoods, layers: v.layers, fade: v.fade, prompt: v.prompt, paused: v.paused, endShown: v.endShown, locked: v.locked, eyeY: v.eyeY })}`); return v; };
  const before = await dump('before');
  for (let k = 0; k < times; k++) {
    h.log(`--- death ${k + 1}: hp -> 0`);
    await h.js('(G.health.damage(1000), 1)');
    await h.watch(3500, 250);
    // the end card (the game's own death) needs a click to try again
    if (await h.js('G.state') === 'dead') {
      h.log('the game said THE END (state dead): click to try again');
      await h.clickOn('#endcard');
      await h.wait(600);
      if (!(await h.js('!!document.pointerLockElement'))) await h.clickOn('#endcard');
      await h.watch(4000, 300);
    }
    await h.until('!G.scenes.trans', 8000);
    await h.wait(2500);
    const after = await dump(`after ${k + 1}`);
    h.check(`death ${k + 1}: playing again, controls free`, after.st === 'playing' && !after.frozen && !after.dead && after.hp > 90 && after.fade < 0.05 && !after.lookLocked, after);
    h.check(`death ${k + 1}: the mode and the hands as before`, after.mode === before.mode && after.hands === before.hands && after.weap === before.weap, { before: [before.mode, before.hands, before.weap], after: [after.mode, after.hands, after.weap] });
    // the controls answer
    const p0 = after.pos;
    await h.down('KeyW'); await h.wait(700); await h.up('KeyW');
    const p1 = JSON.parse(await h.js(LEAK)).pos;
    h.log(`W moved me ${Math.hypot(p1[0] - p0[0], p1[1] - p0[1]).toFixed(2)} m`);
  }
}

// [C10a critic] every seam I..VII by real input from the last beat of each chapter: what the next
// chapter starts with (mode, hands, objective, inventory, flags), and what the last one left running.
//   NOIR_PORT=5350 node tools/hunt.mjs tools/plays/critic/c10a/seams.mjs   (SEAM=3 for one)
import { wrap, walkTo, face, AFTER } from './lib.mjs';
const only = process.env.SEAM ? +process.env.SEAM : 0;
export default async function (h0) {
  const h = wrap(h0);
  const until = (e, ms) => h.until(e, ms);
  const after = async (id, tag) => {
    const ok = await until(`G.scenes.current && G.scenes.current.id === '${id}'`, 60000);
    h.check(`${tag}: into ${id}`, ok, await h.snap());
    await h.wait(600); h.log(`${tag} +0.6s ${await h.js(AFTER)}`);
    await h.shot(`seam_${tag}_a`);
    await h.wait(4500); h.log(`${tag} +5s ${await h.js(AFTER)}`);
    await h.shot(`seam_${tag}_b`);
    const e = await h.err(); h.check(`${tag}: errlog clean`, e === '', e);
  };
  const pressWhen = async (re, ms = 20000) => { const ok = await until(`/${re}/.test(G.hud.promptShown || '')`, ms); if (ok) { await h.wait(250); await h.key('KeyE'); } return ok; };

  if (!only || only === 1) {
    h.log('=== 1: I -> II');
    await h.open('/?mute=1&start=diner.pay'); await h.begin();
    h.check('1: pay prompt', await pressWhen('pay', 30000));
    await h.watch(9000, 400);
    await after('fight', '1_I_II');
  }
  if (!only || only === 2) {
    h.log('=== 2: II -> III');
    await h.open('/?mute=1&start=fight.matchbook'); await h.begin();
    for (let k = 0; k < 6; k++) { if (await pressWhen('.', 8000)) h.log('  E on ' + await h.snap()); if (await h.js(`G.stills.active || (G.scenes.current && G.scenes.current.id === 'office')`)) break; }
    await until('G.stills.active', 15000); h.log('  still up: ' + await h.js('G.stills.last || G.stills.active && G.stills.active.id'));
    await after('office', '2_II_III');
  }
  if (!only || only === 3) {
    h.log('=== 3: III -> IV');
    await h.open('/?mute=1&start=office.done'); await h.begin();
    await h.wait(2000); h.log('  done beat: ' + await h.js(AFTER));
    await h.look(400, 0, 10);
    await after('gunfight', '3_III_IV');
  }
  if (!only || only === 4) {
    h.log('=== 4: IV -> V');
    await h.open('/?mute=1&start=gunfight.quiet'); await h.begin();
    await h.wait(2500); h.log('  quiet: ' + await h.js(AFTER));
    // (round Ames's desk, which stands before the window, to his chair's side)
    await walkTo(h, 3.1, 5.0); await walkTo(h, 4.8, 4.9); await face(h, 5.6, 4.15);
    h.log('  at the window: ' + await h.snap());
    await after('watcher', '4_IV_V');
  }
  if (!only || only === 5) {
    h.log('=== 5: V -> VI');
    await h.open('/?mute=1&start=watcher.car'); await h.begin();
    await h.wait(2500); h.log('  car: ' + await h.js(AFTER));
    const car = await h.js(`(() => { const i = G.interact.list.find((i) => i.id === 'drive'); if (!i) return null; const a = typeof i.at === 'function' ? i.at() : i.at; return [a.x, a.z]; })()`);
    h.log('  coupe at ' + JSON.stringify(car));
    if (car) { await walkTo(h, car[0], car[1], 30000); h.log('  by the car: ' + await h.snap()); }
    for (let k = 0; k < 8 && !(await h.js(`G.hud.promptShown`)); k++) { await h.look(120, 0, 4); await h.wait(200); }
    h.log('  prompt: ' + await h.js('G.hud.promptShown'));
    await h.key('KeyE');
    await after('tail', '5_V_VI');
  }
  if (!only || only === 6) {
    h.log('=== 6: VI -> VII');
    await h.open('/?mute=1&start=tail.pier'); await h.begin();
    await until(`G.scenes.ctx.flags.chase && !G.scenes.fadeK`, 30000);
    await h.wait(2000); h.log('  pier: ' + await h.js(AFTER));
    await h.js(`(G.scenes.ctx.flags.chase.my.place(new N.THREE.Vector3(133, 0, 182), Math.PI, 0), 1)`);
    h.check('6: get out', await pressWhen('get out', 8000));
    await after('warehouse', '6_VI_VII');
  }
}

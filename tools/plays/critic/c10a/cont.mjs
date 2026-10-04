// [C10a critic] CONTINUE from every checkpoint I..VII after a reload: the same scene and beat as the save,
// and the same state a cold start there has (mode, hands, objective, inventory); then a v1 save dropped.
//   NOIR_PORT=5350 node tools/hunt.mjs tools/plays/critic/c10a/cont.mjs   (ONLY=tail)
import { wrap, AFTER } from './lib.mjs';
const CP = {
  diner: ['order', 'drink', 'pay'],
  fight: ['start', 'lesson', 'round1', 'round2', 'round3', 'outside', 'matchbook'],
  office: ['corridor', 'room', 'pad', 'safe', 'check', 'done'],
  gunfight: ['shadows', 'flank', 'corridor', 'quiet'],
  watcher: ['seen', 'escape', 'alley', 'lane', 'yard', 'kitchen', 'press', 'el', 'cut', 'over', 'street', 'market', 'car'],
  tail: ['start', 'chase2', 'river', 'wreck', 'pier'],
  warehouse: ['arrive', 'floor', 'lamps', 'aisle', 'stairs', 'listen', 'office', 'loud', 'fight', 'ko', 'after'],
};
export default async function (h0) {
  const h = wrap(h0);
  const only = process.env.ONLY;
  for (const [sc, beats] of Object.entries(CP)) for (const b of beats) {
    const at = `${sc}.${b}`;
    if (only && !at.includes(only)) continue;
    await h.open(`/?mute=1&start=${at}`);
    if (!(await h.begin())) { h.check(`${at}: begun`, false); continue; }
    await h.wait(3500);
    const a = JSON.parse(await h.js(AFTER));
    // a little play: W, a look, a click
    await h.down('KeyW'); await h.look(80, 0, 4); await h.wait(500); await h.up('KeyW');
    const sv = await h.js(`JSON.parse(localStorage.getItem('noir.save') || 'null')`);
    await h.reload(); await h.wait(1000);
    const can = await h.js(`!document.querySelector('#title .opt[data-k=continue]').classList.contains('hidden')`);
    if (!can) { h.check(`${at}: CONTINUE offered (save ${sv && sv.scene}.${sv && sv.beat})`, false); continue; }
    if (!(await h.cont())) { h.check(`${at}: CONTINUE took`, false); continue; }
    await h.wait(3500);
    const c = JSON.parse(await h.js(AFTER));
    const same = c.scene === sv.scene && c.beat === sv.beat;
    const diff = ['mode', 'hands', 'obj', 'weap'].filter((k) => a.scene === c.scene && a.beat === c.beat && JSON.stringify(a[k]) !== JSON.stringify(c[k]));
    const invd = JSON.stringify([...a.inv].sort()) !== JSON.stringify([...c.inv].sort());
    h.check(`${at}: CONTINUE at the save ${sv.scene}.${sv.beat}${diff.length || invd ? ' (differs from cold: ' + diff.map((k) => k + ' ' + JSON.stringify(a[k]) + '->' + JSON.stringify(c[k])).join(', ') + (invd ? ' inv ' + a.inv + '->' + c.inv : '') + ')' : ''}`, same, `${c.scene}.${c.beat} mode=${c.mode} hands=${c.hands} obj=${c.obj}`);
    const e = await h.err(); if (e) h.check(`${at}: errlog`, false, e);
  }
  // a v1 save
  await h.open('/?mute=1');
  await h.js(`(localStorage.setItem('noir.save', JSON.stringify({ v: 1, scene: 'body', beat: 'approach', flags: {}, inventory: ['matchbook'] })), 1)`);
  await h.reload(); await h.wait(1200);
  h.check('a v1 save dropped quietly', await h.js(`document.querySelector('#title .opt[data-k=continue]').classList.contains('hidden') && localStorage.getItem('noir.save') === null && document.getElementById('errlog').textContent.trim() === ''`));
}

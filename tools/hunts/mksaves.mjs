// [C10a] writes tools/plays/saves.json: CONTINUE after a reload from every checkpoint of chapters
// I to VII (each scene's first beat and every beat in its `save` list), and a v1 save dropped quietly.
//   node tools/hunts/mksaves.mjs && NOIR_PORT=5350 node tools/play.mjs tools/plays/saves.json
import { writeFileSync } from 'node:fs';
const CP = {
  diner: ['settle', 'order', 'drink', 'pay'],
  fight: ['start', 'lesson', 'round1', 'round2', 'round3', 'outside'],
  office: ['corridor', 'room', 'check'],
  gunfight: ['shadows', 'flank', 'corridor', 'quiet'],
  watcher: ['seen', 'escape', 'alley', 'lane', 'yard', 'kitchen', 'press', 'el', 'cut', 'over', 'street', 'market', 'car'],
  tail: ['start', 'chase2', 'river', 'pier'],
  warehouse: ['arrive', 'floor', 'lamps', 'aisle', 'stairs', 'listen', 'office', 'loud', 'fight'],
  // [C10b] VIII (lane C8): every beat in its save list
  shootout: ['dot', 'gun', 'cars', 'flank', 'el', 'saloon', 'cardinal', 'last'],
};
const steps = [
  { wait: 1500 },
  { eval: "(localStorage.setItem('noir.save', JSON.stringify({ v: 1, scene: 'body', beat: 'approach', flags: {}, inventory: ['matchbook'] })), true)" },
  { reload: true }, { wait: 1200 },
  { expect: "document.querySelector('#title .opt[data-k=continue]').classList.contains('hidden') && localStorage.getItem('noir.save') === null", label: 'a v1 save is dropped quietly' },
];
for (const [sc, beats] of Object.entries(CP)) for (const bt of beats) {
  steps.push(
    { eval: `(localStorage.setItem('noir.save', JSON.stringify({ v: 2, scene: '${sc}', beat: '${bt}', flags: { taught: { look: true } }, inventory: [] })), true)` },
    { reload: true },
    { until: "G.state === 'title'", timeout: 30000 }, { wait: 900 },
    { clickOn: '#title .opt[data-k=continue]', taken: "G.state !== 'title'", retries: 5, every: 3000 },
    { until: `G.scenes.current && G.scenes.current.id === '${sc}' && !G.scenes.trans`, timeout: 20000 },
    { wait: 2500 },
    { expect: `G.scenes.current.id === '${sc}' && (G.scenes.beat === '${bt}' || G.scenes.ctx.from === '${bt}') && G.state === 'playing' && !G.failing && G.scenes.fadeK < 0.05 && !G.stills.active && !N.controller.frozen`,
      label: `CONTINUE ${sc}.${bt}: back at it, playing, out of the black, the controls free` },
    { eval: `JSON.stringify({ at: G.scenes.current.id + '.' + G.scenes.beat, from: G.scenes.ctx.from, mode: N.controller.mode, obj: G.hud.kit.objectiveText, music: G.music.current, inv: G.save.inventory, hands: G.hands.set, rev: G.player.weapons.get('revolver') && G.player.weapons.get('revolver').ammo })` },
  );
}
const play = { about: '[C10a] CONTINUE from every checkpoint of chapters I to VIII after a reload, and a v1 save dropped quietly. node tools/hunts/mksaves.mjs writes it.', url: '/?mute=1', size: [1280, 800], out: 'shots/play/saves', steps };
writeFileSync('tools/plays/saves.json', JSON.stringify(play, null, 1));
console.log('tools/plays/saves.json:', steps.length, 'steps');

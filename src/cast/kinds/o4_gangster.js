import watcher from './watcher.js';
// [O4] A hood of the city's gangs (the crowd brawl, docs/briefs/O4_COMBAT.md):
// the watcher's long narrow cut in a dark coat, a fedora with a snap brim
// (tailor.js 'fedora'). Read at 20 m by the hat.
const B = watcher.costume;
export default {
  kind: 'o4_gangster', h: 1.86, name: 'hood',
  costume: {
    ...B, name: 'o4_gangster',
    cover: { kind: 'fedora', hatDY: 0.13, hatDZ: 0.004, pitch: 0.06, s: 0.99, brim: 0.172 },
    garments: B.garments.map((g) => (g.kind === 'torso' ? { kind: 'torso', shade: 'coat' } : g)),
    skin: { ...B.skin, coat: 0.012, collar: 0.011, lapel: 0.01, cover: 0.006, band: 0.002, trousers: 0.006 },
  },
};

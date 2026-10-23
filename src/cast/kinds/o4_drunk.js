import watcher from './watcher.js';
// [O4] The drunk (the crowd brawl): a pale raincoat gone grey with the rain,
// a bowler pushed back on his head.
const B = watcher.costume;
export default {
  kind: 'o4_drunk', h: 1.8, name: 'drunk',
  costume: {
    ...B, name: 'o4_drunk',
    cover: { kind: 'bowler', hatDY: 0.13, hatDZ: -0.012, pitch: -0.24, s: 0.99, brim: 0.14 },
    garments: B.garments.map((g) => (g.kind === 'torso' ? { kind: 'torso', shade: (th, y) => (Math.abs(y - 1.03) < 0.022 ? 0.04 : 0.17) } : g)),
    skin: { ...B.skin, coat: 0.17, collar: 0.14, lapel: 0.13, cover: 0.008, band: 0.003 },
  },
};

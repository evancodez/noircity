import dockhand from './dockhand.js';
// [O4] A beat cop (the crowd brawl; lane O3's police may wear it too): the
// tunic to the hip, belted, dark navy (it prints a shade lighter than the
// hoods' black), the peaked cap with its badge (tailor.js 'police').
const B = dockhand.costume;
export default {
  kind: 'o4_cop', h: 1.86, name: 'cop',
  costume: {
    ...B, name: 'o4_cop',
    cover: { kind: 'police', hatDY: 0.122, hatDZ: 0.008, pitch: 0.02, s: 1.02 },
    garments: B.garments.map((g) => (g.kind === 'skirt' ? { ...g, hem: 0.74, back: 0.7 } : g.kind === 'torso' ? { kind: 'torso', shade: (th, y) => (Math.abs(y - 1.0) < 0.024 ? 0.004 : 0.024) } : g)),
    skin: { ...B.skin, coat: 0.024, collar: 0.02, cover: 0.022, band: 0.004, trousers: 0.02, shoes: 0.003 },
  },
};

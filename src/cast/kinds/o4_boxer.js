import cook from './c6_cook.js';
// [O4] The gym's boxer: the heavy shoulders bare, a pale singlet, dark
// trunks, his fists taped white, no hat.
const B = cook.costume;
export default {
  kind: 'o4_boxer', h: 1.84, name: 'boxer',
  costume: {
    ...B, name: 'o4_boxer',
    cover: { kind: 'none', hatDY: 0.11, hatDZ: 0, pitch: 0 },
    garments: [
      { kind: 'torso', shade: (th, y) => (y < 0.99 ? 0.006 : 0.26) },
      { kind: 'arms', r: 0.06, d0: 0.0 },
      { kind: 'legs', r: 1.08 },
      { kind: 'shoes' },
      { kind: 'hands', s: 1.12 },
    ],
    skin: { arm: 0.045, hand: 0.3, skin: 0.045, trousers: 0.006, shoes: 0.004, hair: 0.004 },
  },
};

import { ART } from './_art.js';

// Before I (WAVE_C §5): the tip. Played on BEGIN only (game.start), one page,
// three panels coming in one after another. Lane C9 draws the pictures
// (public/stills/opening_<n>.jpg); until then the placeholders (_art.js).
export default {
  panels: [
    { img: 'stills/opening_1.jpg', draw: ART.tip, caption: 'A TIP. AMES.', secs: 3.2, from: { s: 1.03, x: 0.01, y: 0 }, to: { s: 1.09, x: -0.012, y: -0.006 } },
    { img: 'stills/opening_2.jpg', draw: ART.men, caption: 'HIS MEN. MY DINER.', secs: 3.2, cap: 'tr', from: { s: 1.06, x: 0, y: 0.01 }, to: { s: 1.1, x: 0, y: -0.01 } },
    { img: 'stills/opening_3.jpg', draw: ART.neon, secs: 2.8, from: { s: 1.02, x: -0.012, y: 0 }, to: { s: 1.07, x: 0.012, y: 0 } },
  ],
};

import { ART } from './_art.js';

// Before I (WAVE_C §5): the tip. Played on BEGIN only (game.start), one page,
// three panels coming in one after another (under ten seconds). The pictures
// are lane C9's (public/stills/opening_<n>.jpg, tools/stills.sh: staged
// tableaux through the ink pipeline, src/debug/shots/C9_stills.js); the
// placeholders (_art.js) paint until they load.
//   1 the receiver off its cradle on the desk in the lamp's cone, its coiled cord
//   2 three hats at the diner's lit door, her white apron between them
//   3 the diner's neon through my wet windscreen, the cabin black (no words)
export default {
  panels: [
    { img: 'stills/opening_1.jpg', draw: ART.tip, caption: 'A TIP. AMES.', secs: 3.2, aspect: 1.58, cap: 'tl', from: { s: 1.02, x: 0, y: 0 }, to: { s: 1.07, x: -0.012, y: -0.004 } },
    { img: 'stills/opening_2.jpg', draw: ART.men, caption: 'HIS MEN. MY DINER.', secs: 3.2, aspect: 1.58, cap: 'tr', from: { s: 1.02, x: 0, y: 0 }, to: { s: 1.08, x: 0.002, y: 0.004 } },
    { img: 'stills/opening_3.jpg', draw: ART.neon, secs: 2.8, aspect: 3.51, from: { s: 1.02, x: 0, y: 0 }, to: { s: 1.06, x: -0.004, y: 0.012 } },
  ],
};

import { ART } from './_art.js';

// III, the check assembled (WAVE_C §5): the torn guest check from my diner in
// a woman's hand, then her shape behind the counter. Lane C5 plays it.
export default {
  panels: [
    { img: 'stills/check_1.jpg', draw: ART.check, caption: 'DOT’S HAND.', secs: 3.2, from: { s: 1.04, x: 0, y: 0.01 }, to: { s: 1.1, x: 0, y: -0.008 } },
    { img: 'stills/check_2.jpg', draw: ART.her, caption: 'SHE SENT HIM TO THEM.', secs: 3.6, cap: 'br', from: { s: 1.02, x: 0, y: 0 }, to: { s: 1.08, x: 0, y: 0.01 } },
  ],
};

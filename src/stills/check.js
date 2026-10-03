import { ART } from './_art.js';

// III, the check assembled (WAVE_C §5): the torn guest check from my diner,
// pieced together under the lamp, her pencil (lane C4's prop with lane C5's
// lines); then her shape behind the diner's counter, back-lit by the kitchen
// hatch, the face lost, the coffee pot, the clock near midnight. Lane C5
// plays it. Lane C9's pictures (public/stills/check_<n>.jpg).
export default {
  panels: [
    { img: 'stills/check_1.jpg', draw: ART.check, caption: 'DOT’S HAND.', secs: 3.2, aspect: 1.09, cap: 'tl', from: { s: 1.02, x: 0, y: 0 }, to: { s: 1.07, x: -0.006, y: -0.004 } },
    { img: 'stills/check_2.jpg', draw: ART.her, caption: 'SHE SENT HIM TO THEM.', secs: 3.6, aspect: 1.09, cap: 'br', from: { s: 1.02, x: 0, y: 0 }, to: { s: 1.06, x: -0.005, y: -0.005 } },
  ],
};

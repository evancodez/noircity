import trucker from './tail_trucker.js';
// [O4] A driver pulled out of his car (the crowd brawl; lane O2's hijack
// may give him): the trucker's short jacket and cap, a shade darker.
const B = trucker.costume;
export default {
  kind: 'o4_driver', h: 1.78, name: 'driver',
  costume: { ...B, name: 'o4_driver', skin: { ...B.skin, coat: 0.009, cover: 0.012 } },
};

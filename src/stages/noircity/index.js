// NOIR CITY (lane O1): the open world's one city at night in the rain. The
// plan is src/world/plan.js, the generator src/world/cityGen.js, the kits
// src/city/kits/; this stage's parts build what is always there (the
// ground, the water, the far masses and their lights, the el, the
// landmarks, the lamps' pool) and stream the rest (./parts/stream.js: the
// near chunks' relief, pavements and furniture). Drawn from root.fork(salt):
// building it never disturbs the block's draws (the golden frames).
const mods = import.meta.glob('./parts/*.js', { eager: true });

export default {
  name: 'noircity',
  salt: 4401,
  parts: Object.values(mods).map((m) => m.default),
  look: { room: 'street' },
};

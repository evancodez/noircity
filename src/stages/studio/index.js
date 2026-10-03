// The studio (lane C9): a bare stage for the stills' close tableaux (WAVE_C
// §5, docs/story/briefs/C9_STILLS.md): a floor, a wall with a rainy window
// and a desk under it, nothing else. Each still's preset
// (src/debug/shots/C9_stills.js) places its few props, figures and its one
// or two lights on it and frames it. Never entered in play. It draws from
// root.fork(9009): building it never disturbs another stage's draws.
// The Game's step reads a few of the block's parts on any stage (the train,
// the cars and props of the reactive world): quiet stand-ins here, as Pier 9's.
const mods = import.meta.glob('./parts/*.js', { eager: true });

const STUBS = [
  { name: 'train', order: 1, build: () => ({ active: false, update() {}, stage() {}, onRumble: null, onSqueal: null }) },
  { name: 'cars', order: 2, build: () => ({ fires: [], list: [], cars: [], update() {}, hit() { return null; }, lodUpdate() {}, shadowLod() {}, bind() {} }) },
  { name: 'props', order: 3, build: () => ({ vents: [] }) },
];

export default {
  name: 'studio',
  salt: 9009,
  parts: [...STUBS, ...Object.values(mods).map((m) => m.default)],
  look: null,
};

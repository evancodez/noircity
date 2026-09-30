import { FOG } from '../../render/fog.js';

// Pier 9 (lane B6, scene 8 "Pier Nine"): the crew's warehouse on a pier over
// the river. Its content is its parts (./parts/*.js, found on their own),
// built in `order`; the site plan is ./site.js.
// The Game's step reads a few of the block's parts on any stage (the train,
// the rain's material, the cars and props of the reactive world): a stage
// without them gets quiet stand-ins here, so nothing of the block is needed.
const mods = import.meta.glob('./parts/*.js', { eager: true });

const STUBS = [
  // no el over the pier: a train that never comes
  { name: 'train', order: 1, build: () => ({ active: false, update() {}, stage() {} }) },
  // no cars to shoot, no street props (fx/React.js reads both)
  { name: 'cars', order: 2, build: () => ({ fires: [], list: [], update() {}, hit() { return null; }, lodUpdate() {} }) },
  { name: 'props', order: 3, build: () => ({}) },
];

export default {
  name: 'pier9',
  salt: 909,
  parts: [...STUBS, ...Object.values(mods).map((m) => m.default)],
  // outside on the pier: the block's night, a little thicker over the water
  look: { fogDensity: FOG.density * 1.5, fogColor: FOG.color.clone().multiplyScalar(0.9), reflect: 'street', room: 'street' },
};

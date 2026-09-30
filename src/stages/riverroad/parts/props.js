// (fx/React.js steps the stage's `props` and asks it about grates: the
// river road's things are the smash part's, so this is empty)
export default {
  name: 'props', order: 80,
  build: () => ({ update() {}, hit: null, nearGrate: null }),
};

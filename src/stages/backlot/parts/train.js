// No el over the backlot: the Game asks every stage for its train (the
// crossing schedule, the director's cue): one that never comes.
export default {
  name: 'train', order: 120,
  build: () => ({ active: false, update() {}, stage() {}, onRumble: null, onSqueal: null }),
};

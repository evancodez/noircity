// No el over the killhouse: the Game asks every stage for its train.
export default {
  name: 'train', order: 120,
  build: () => ({ active: false, update() {}, stage() {}, onRumble: null, onSqueal: null }),
};

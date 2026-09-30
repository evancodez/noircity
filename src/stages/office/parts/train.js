// What the Game and the reactive world ask of every stage by name (the
// block's cars, train and street furniture: Game.post steps a train,
// fx/React.js steps the cars and reads the props). The office has none of
// them: these stand in, doing nothing (cars.js and props.js likewise).
export default {
  name: 'train', order: 120,
  build: () => ({ active: false, update() {}, stage() {}, onRumble: null, onSqueal: null }),
};

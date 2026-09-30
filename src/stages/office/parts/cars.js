// (no cars on the third floor: fx/React.js and main.js step the stage's
// cars by name - these are none)
export default {
  name: 'cars', order: 70,
  build: () => ({ list: [], fires: [], update() {}, lodUpdate() {}, shadowLod() {}, hit() { return null; }, bind() {} }),
};

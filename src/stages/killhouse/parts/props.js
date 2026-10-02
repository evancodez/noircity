// The block's street furniture reacts to rounds (fx/React.js asks every
// stage for its props): the killhouse's things are the house's own.
export default {
  name: 'props', order: 80,
  build: () => ({ vents: [] }),
};

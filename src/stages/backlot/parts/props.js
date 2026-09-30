// The block's street furniture reacts to rounds (fx/React.js asks every
// stage for its props): the backlot's own things are the chase's
// (parts/chase.js), and nothing here is shot at.
export default {
  name: 'props', order: 80,
  build: () => ({ vents: [] }),
};

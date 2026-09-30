// The backlot (lane B4, scene 6 "The Watcher"): the Harbor Building's fire
// escape and the run of alleys and yards behind it, ending on a street with
// two parked cars (./plan.js has the numbers). Its content is its parts
// (./parts/*.js, found on their own), built in their `order`. It draws from
// root.fork(4404): building it never disturbs the block's draws.
const mods = import.meta.glob('./parts/*.js', { eager: true });

export default {
  name: 'backlot',
  salt: 4404,
  parts: Object.values(mods).map((m) => m.default),
  look: null,
};

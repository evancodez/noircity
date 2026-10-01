// The room under the name scene 6 asks for (round 2, lane R2-A): the watcher
// scene's first beat plays at room 304's street window and looks for the
// room's own blind as stage.part('room') (06_watcher.js seenInOffice); the
// part is 'office' (parts/room.js). Without this it put a stand-in blind of
// its own in front of the real one and looked out through both. Same object,
// a second name; no update, no draws.
export default {
  name: 'room', order: 131,
  build: (stage) => stage.part('office'),
};

// Vehicles (docs/story/CONTRACTS.md §11): wave B, lane 8.
//   vehicles.spawn(kind: 'sedan' | 'coupe' | 'truck', { at, yaw, paint }) -> Vehicle
//   v.pos, v.yaw, v.speed, v.steer, v.body, v.wheels[4] { pos, r, flat }
//   v.setDriver('player' | { path, speed(t) } | null)   v.input({ throttle, brake, steer })
//   v.seat -> { eye, window }   v.hitTyre(i)   v.on('collide' | 'wreck', fn)   v.damage(n)
// FOUNDATION: the interface only. Every call throws until wave B builds it,
// so nothing in wave A leans on it by accident.
const WAVE_B = (what) => { throw new Error(`vehicles.${what}: vehicles are wave B`); };

export class Vehicles {
  constructor(game) {
    this.game = game;
    this.list = [];
  }
  spawn() { return WAVE_B('spawn'); }
  remove() { return WAVE_B('remove'); }
  update() {}
}

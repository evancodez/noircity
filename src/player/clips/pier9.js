// [R2-E] The bay's things in my fists in the second fight (Pier 9's loading
// bay, docs/story/briefs/B9_PIER_FIGHT.md): how a hand holds them (the
// hands' sockets, docs/story/seams/X.md X2). The hand bone's frame: -x the
// thumb's way, -y out of the palm, -z along the fingers.
//   cargoHook  a docker's grip: the T-handle across the palm in the fist,
//              the steel out between the second and third fingers, away from
//              the palm, its point curling back over the knuckles
export const SOCKETS = {
  cargoHook: { bone: 'hand', p: [0.0, -0.03, -0.06], basis: [[1, 0, 0], [0, 0, 1], [0, -1, 0]] },
};

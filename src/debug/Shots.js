// Camera presets for ?shot=<name>. Each: feet position (x, z), yaw, pitch
// (radians), vertical fov, default fast-forward seconds, optional stage(world).
export const SHOTS = {
  // Reference composition: low on the road by the left kerb, eye ~1.7 m,
  // looking down the avenue. The vanishing point sits ~45 % across and ~55 %
  // down; the el (now set back ~13 m to the right) fills the top-right third
  // with its deck top and open railing inside the frame and sky between the
  // members; the near lamp stands left of the towers that back the VP.
  street: { x: -3.8, z: -9.0, y: 0.07, yaw: -0.105, pitch: 0.075, fov: 70, t: 4 },
  // Standing in the cone of the lamp by the phone booth, looking up at it.
  lamp: { x: -3.4, z: -12.8, yaw: 0.3, pitch: 0.28, fov: 66, t: 4 },
  // Two black sedans, the nearer ~7 m away (Phase 1b review, pending AD
  // sign-off): the camera moved 1.5 m toward -x and turned 0.1 rad down the
  // avenue (pitch -0.07, fov 58) so the skyline runs unbroken across the
  // left half behind the cars and the el enters from the top right instead
  // of arching over the whole frame. (Any closer to the near car and its
  // column pair's portal arch fills the top of the frame again.)
  cars: { x: 1.8, z: -13.6, yaw: -0.4, pitch: -0.07, fov: 58, t: 4 },
  // the Phase 1 framing, kept for the AD comparison
  cars_v1: { x: 3.3, z: -13.8, yaw: -0.5, pitch: -0.1, fov: 62, t: 4 },
  // inspection views (not part of the reference set)
  carside: { x: 1.4, z: -57.5, yaw: Math.PI / 2, pitch: -0.12, fov: 50, t: 4 },
  car34: { x: 0.5, z: -63.5, yaw: 2.525, pitch: -0.13, fov: 50, t: 4 },
};

// Phase 2/3 will replace these with staged scenes.
const ALIASES = { hood: 'street', hoods: 'street', wreck: 'street', ots: 'street', default: 'street' };

export function getShot(name) {
  const key = SHOTS[name] ? name : ALIASES[name];
  return key ? { name: key, ...SHOTS[key] } : null;
}

export function applyShot(shot, controller, camera, world) {
  camera.fov = shot.fov;
  camera.updateProjectionMatrix();
  // optional y: ground height under the eye (raises the camera for a shot)
  controller.setPose(shot.x, shot.z, shot.yaw, shot.pitch, shot.y ?? null);
  if (shot.stage) shot.stage(world);
}

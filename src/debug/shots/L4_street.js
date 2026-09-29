// Lane 4's presets (the street and the city). Started by the foundation
// with the diner's front as it stands (a stub: lane 4 builds the real one
// and owns this file).
export const presets = {
  // the diner's front from the kerb opposite its door: the eye at (-1.5,
  // 6.5), looking at the door, fov 60 (lane 4's brief 1)
  dinerfront: { x: -1.5, z: 6.5, yaw: Math.atan2(-(-10.2 + 1.5), -(0.6 - 6.5)), pitch: 0.04, fov: 60, t: 4 },
};

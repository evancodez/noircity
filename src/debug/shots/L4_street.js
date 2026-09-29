// Lane 4's presets (the street and the city): docs/story/briefs/L4_STREET.md.
// A viewer's yaw: he looks along (-sin yaw, -cos yaw).
const yawTo = (x, z, tx, tz) => Math.atan2(-(tx - x), -(tz - z));

export const presets = {
  // 1. the diner's front from the kerb opposite its door: the eye at (-1.5,
  // 6.5), looking at the door, fov 60
  dinerfront: { x: -1.5, z: 6.5, yaw: yawTo(-1.5, 6.5, -10.2, 0.6), pitch: 0.04, fov: 60, t: 4 },
  // from the far pavement under the el, (12, 9), looking at B2: the whole
  // front, the floors above rising into the rain
  dinerwide: { x: 12, z: 9, yaw: yawTo(12, 9, -10.2, 5.0), pitch: 0.16, fov: 55, t: 4 },
  // 2 m from the door: it opens (the eye walks up to it)
  dinerdoor: { x: -8.4, z: 0.9, yaw: yawTo(-8.4, 0.9, -10.5, 0.55), pitch: 0.0, fov: 62, t: 4 },
};

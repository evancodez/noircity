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

  // 2. the block's edges, each from 10 m
  // south: the road works behind the start
  boundS: { x: 2.0, z: 21.5, yaw: yawTo(2.0, 21.5, 4.0, 33), pitch: 0.02, fov: 62, t: 4 },
  // east: the railing and its locked gates, the rail yard beyond
  boundE: { x: 12.0, z: -25.0, yaw: yawTo(12.0, -25.0, 22.0, -31.0), pitch: 0.08, fov: 62, t: 4 },
  // north: the pipe job under the el's crossing
  boundN: { x: 4.0, z: -108.5, yaw: yawTo(4.0, -108.5, 3.5, -121), pitch: 0.03, fov: 62, t: 4 },
  // west: the cross street, its wire gate and the van behind it
  boundW: { x: -13.8, z: -26.2, yaw: yawTo(-13.8, -26.2, -24.2, -27.2), pitch: 0.03, fov: 62, t: 4 },

  // 3. the el clear of the buildings: from under the crossing along the far
  // curve (the turn into the cross street, the terminus), and a high
  // oblique view of where the track leaves the avenue
  elfar: { x: 3.0, z: -113.0, yaw: yawTo(3.0, -113.0, -30, -166), pitch: 0.2, fov: 60, t: 4 },
  elplan: { x: 30, z: -95, y: 42, yaw: yawTo(30, -95, -22, -160), pitch: -0.5, fov: 55, t: 4 },

  // 4. the city behind: from the middle of the block down the avenue (fov
  // 45), east through the arches, and the first under lightning
  // (skylineT: the same camera; add &lightning=1)
  skyline: { x: 2.0, z: -48, yaw: 0.0, pitch: 0.1, fov: 45, t: 20 },
  skylineE: { x: 4.0, z: -36, yaw: -Math.PI / 2, pitch: 0.12, fov: 55, t: 20 },
  skylineT: { x: 2.0, z: -48, yaw: 0.0, pitch: 0.1, fov: 45, t: 20 },
};

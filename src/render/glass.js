import * as THREE from 'three';

// Glass, window light and far rooms (docs/story/CONTRACTS.md §9.5, lane 1's
// brief P1.1, P1.2, P2).
//
// FOUNDATION STUB (lane 1 owns this file): plain materials with the final
// names and options, so the diner's front (lane 4), its room (lane 5) and
// the breakage (lane 3) can build against them today.
//   makeGlassMaterial({ wet, side, tint })     a faint dark pane; what is
//       behind it shows through (a pane is drawn in the scene pass only:
//       destruct/Glass.js puts it on LAYER.FX so the ink still sees the room)
//   makeWindowLightMaterial({ w, h, slats })   a faint additive patch;
//       material.userData.sweep(t0, speed) is a no-op here
//   makeRoomMaterial(opts)                      a dark flat stand-in
export function makeGlassMaterial({ wet = 1, side = 'out', tint = 0x1a1a1a } = {}) {
  const m = new THREE.MeshStandardMaterial({
    color: tint, roughness: 0.12, metalness: 0, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide,
  });
  m.name = 'glassStub';
  m.userData = { wet, side };
  return m;
}

export function makeWindowLightMaterial({ w = 1, h = 1, slats = 0 } = {}) {
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.05, depthWrite: false, blending: THREE.AdditiveBlending });
  m.name = 'windowLightStub';
  m.userData = { w, h, slats, sweep() {} };
  return m;
}

export function makeRoomMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 1 });
  m.name = 'roomStub';
  return m;
}

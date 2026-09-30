import * as THREE from 'three';
import { ROOM, WIN } from '../plan.js';
import { BLIND } from './openings.js';

// The blind's slats across my hands (round 2, lane R2-A). The hands and the
// gun are drawn in the viewmodel's own little scene, lit by copies of the
// two nearest lamps and never by the room's shadows - so the street's light
// through the blind, which lays the slats across the walls and the floor,
// never fell across them. Here the same light is copied into that scene with
// a map of the blind cast from the light (a gobo: for each ray of the
// light, open where it passes between two slats inside the window, black
// where a slat or the wall stops it), and switched on only while the eye
// stands in the light's path through the window. The map is baked again
// whenever a slat moves (a round knocks one askew, two fingers part them).
//   const g = makeGobo(game, stage, blind, lamp); each step g.update(k)   (k: the light's strength now)
// It is in the viewmodel's scene only while this stage is the one in play.
const MW = 64, MH = 1024;

export function makeGobo(game, stage, blind, lamp) {
  const vm = game.hands && game.hands.vm;
  if (!vm || !vm.scene) return null;
  const data = new Uint8Array(MW * MH * 4);
  const tex = new THREE.DataTexture(data, MW, MH);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  const spot = new THREE.SpotLight(0xffffff, 0, 34, 0.1, 0.35, 2);
  spot.map = tex;
  spot.layers.enableAll();
  spot.name = 'officeGobo';
  const cam = new THREE.PerspectiveCamera();
  const slats = blind.slats;
  const _v = new THREE.Vector3(), _d = new THREE.Vector3();
  // the ray of map texel (u, v) (0..1): where it crosses the blind's plane and its slope there
  const ray = (u, v) => {
    _v.set(u * 2 - 1, v * 2 - 1, 0.5).unproject(cam);
    _d.copy(_v).sub(cam.position).normalize();
    const t = (BLIND.x - cam.position.x) / _d.x;
    return { y: cam.position.y + _d.y * t, z: cam.position.z + _d.z * t, s: _d.y / Math.hypot(_d.x, _d.z) };
  };
  // does a ray at height y (the blind's plane) and slope s pass the slats?
  const hw = BLIND.width / 2;
  const open = (y, s) => {
    for (const S of slats) {
      if (S.gone) continue;
      const yc = S.y + S.lift - S.sag;
      if (Math.abs(yc - y) > 0.06) continue;
      // (the slat's cross-section, its room edge down: y(x) = yc + (x - BX) tan(tilt); the ray y(x) = y + (x - BX) s)
      const c = Math.cos(S.tilt), sn = Math.sin(S.tilt);
      const den = sn - s * c;
      const u = Math.abs(den) < 1e-6 ? (Math.abs(y - yc) < 1e-4 ? 0 : 1) : (y - yc) / den;
      if (Math.abs(u) <= hw) return 0;
    }
    return 1;
  };
  let sig = '';
  const bake = () => {
    const L = lamp.light;
    cam.fov = THREE.MathUtils.RAD2DEG * 2 * L.angle; cam.aspect = 1; cam.near = 1; cam.far = 60;
    cam.position.copy(L.pos); cam.up.set(0, 1, 0); cam.lookAt(L.target);
    cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    // (the light is 20 m off: its rays are near parallel, so the map is
    // separable - a column's window across, a row's slats and window up)
    const col = new Float32Array(MW), row = new Float32Array(MH);
    for (let i = 0; i < MW; i++) { const r = ray((i + 0.5) / MW, 0.5); col[i] = r.z > WIN.z0 + 0.03 && r.z < WIN.z1 - 0.03 ? 1 : 0; }
    for (let j = 0; j < MH; j++) { const r = ray(0.5, (j + 0.5) / MH); row[j] = r.y > WIN.y0 + 0.02 && r.y < WIN.y1 - 0.02 ? open(r.y, r.s) : 0; }
    for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) {
      const k = (j * MW + i) * 4, v = col[i] * row[j] * 255;
      data[k] = data[k + 1] = data[k + 2] = v; data[k + 3] = 255;
    }
    tex.needsUpdate = true;
  };
  let inScene = false;
  const put = (on) => {
    if (on === inScene) return;
    inScene = on;
    if (on) vm.scene.add(spot, spot.target); else vm.scene.remove(spot, spot.target);
  };
  game.on('stage:enter', () => put(game.stage === stage));
  put(game.stage === stage);
  const _e = new THREE.Vector3();
  return {
    spot, tex,
    update(k) {
      if (!inScene) return;
      // (baked again when a slat has moved)
      let s = '';
      for (const S of slats) s += S.gone ? 'x' : ((S.tilt * 100) | 0) + ',' + (((S.lift - S.sag) * 1000) | 0) + ';';
      if (s !== sig) { sig = s; bake(); }
      const L = lamp.light;
      spot.position.copy(L.pos);
      spot.target.position.copy(L.target); spot.target.updateMatrixWorld();
      spot.angle = L.angle; spot.penumbra = L.penumbra ?? 0.35; spot.distance = L.distance;
      // (on only while the light reaches the eye through the window: the
      // hands in the room's shade take nothing from it)
      const e = game.eye || _e;
      const inRoom = e.x > ROOM.x0 && e.x < ROOM.x1 && e.z > ROOM.z0 && e.z < ROOM.z1;
      let gate = 0;
      if (inRoom) {
        _d.copy(L.pos).sub(e);
        const t = (ROOM.x1 - e.x) / _d.x;
        if (t > 0) {
          const y = e.y + _d.y * t, z = e.z + _d.z * t;
          const m = 0.12;
          gate = Math.max(0, Math.min(1, (y - WIN.y0) / m, (WIN.y1 - y) / m, (z - WIN.z0) / m, (WIN.z1 - z) / m));
        }
      }
      spot.intensity = L.intensity * k * gate;
    },
  };
}

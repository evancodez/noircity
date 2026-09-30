import * as THREE from 'three';
import { lathe, slab, mergeGeos, std, basic } from '../lib.js';

// Pier 9's props (lane B6): what the dock hands carry and what lies in the
// loading bay within reach of a hand.
//   lantern    a bull's-eye lantern: a tin drum with a lens at the front (+z)
//              that throws its beam, a chimney, a wire bail (the grip);
//              userData.lens: the lens's centre, the beam's origin
//   torch      an electric torch: a ribbed tube, a wide head (+z, the lens)
//   cargoHook  a docker's hook: a curved steel point on a wooden T-handle
//   crateLid   a crate's lid of four planks on two battens
//   chainCoil  a coil of heavy chain lying in a heap
//   rope       a coil of rope
// Frame: the middle of the base at y 0, +y up, the front toward +z.
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const mats = () => ({
  tin: std('p9_tin', { color: 0x151515, roughness: 0.4, surface: 'metal' }),
  wood: std('p9_wood', { color: 0x1d1d1d, roughness: 0.8, surface: 'wood' }),
  plank: std('p9_plank', { color: 0x2a2a2a, roughness: 0.85, surface: 'wood' }),
  steel: std('p9_steel', { color: 0x0c0c0c, roughness: 0.35, surface: 'metal' }),
  rope: std('p9_rope', { color: 0x232323, roughness: 0.95, surface: 'cloth' }),
  // (a lit lens: bright enough to read as the light, not a moon - at 6 its
  // glow printed a white disc wider than the man's head)
  lens: basic('p9_lens', { color: new THREE.Color(1, 1, 1).multiplyScalar(3) }),
  lensOff: std('p9_lensOff', { color: 0x3a3a3a, roughness: 0.1, surface: 'metal' }),
});

function tubeOf(pts, r, radial = 8) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), pts.length * 10, r, radial, false);
}

export const SPECS = {
  lantern: (v, lod) => {
    const M = mats(), seg = lod ? 14 : 28;
    const drum = lathe([[0.001, 0.0], [0.075, 0.0], [0.08, 0.01], [0.08, 0.17], [0.065, 0.19], [0.04, 0.2], [0.035, 0.26], [0.045, 0.27], [0.001, 0.275]], seg);
    const rim = new THREE.CylinderGeometry(0.052, 0.058, 0.04, seg).rotateX(Math.PI / 2).translate(0, 0.1, 0.085);
    const bail = tubeOf([V3(-0.08, 0.16, 0), V3(-0.06, 0.3, 0), V3(0, 0.34, 0), V3(0.06, 0.3, 0), V3(0.08, 0.16, 0)], 0.004, 5);
    const lens = new THREE.CircleGeometry(0.046, seg).translate(0, 0.1, 0.106);
    return {
      parts: [{ geo: mergeGeos([drum, rim]), mat: M.tin, id: 0 }, { geo: bail, mat: M.steel, id: 0 }, { geo: lens, mat: v === 'off' ? M.lensOff : M.lens, id: 1, keep: true, name: 'lens', cast: false }],
      grip: [0, 0.33, 0],
      init(g, ud) { ud.lens = V3(0, 0.1, 0.11); ud.beam = V3(0, 0, 1); },
    };
  },
  torch: (v, lod) => {
    const M = mats(), seg = lod ? 12 : 24;
    const body = lathe([[0.001, 0.0], [0.018, 0.0], [0.019, 0.005], [0.019, 0.17], [0.024, 0.19], [0.032, 0.22], [0.034, 0.25], [0.03, 0.255], [0.001, 0.255]], seg).rotateX(Math.PI / 2).translate(0, 0.035, -0.12);
    const lens = new THREE.CircleGeometry(0.029, seg).translate(0, 0.035, 0.1365);
    return {
      parts: [{ geo: body, mat: M.tin, id: 0 }, { geo: lens, mat: v === 'off' ? M.lensOff : M.lens, id: 1, keep: true, name: 'lens', cast: false }],
      grip: [0, 0.035, -0.04],
      init(g, ud) { ud.lens = V3(0, 0.035, 0.14); ud.beam = V3(0, 0, 1); },
    };
  },
  cargoHook: (v, lod) => {
    const M = mats();
    const handle = new THREE.CylinderGeometry(0.02, 0.02, 0.13, lod ? 8 : 14).rotateZ(Math.PI / 2).translate(0, 0.02, 0);
    const shank = [V3(0, 0.02, 0), V3(0, 0.02, 0.1), V3(0, 0.03, 0.2), V3(0.005, 0.06, 0.26), V3(0.01, 0.1, 0.25), V3(0.012, 0.11, 0.2), V3(0.01, 0.1, 0.17)];
    return {
      parts: [{ geo: handle, mat: M.wood, id: 0 }, { geo: tubeOf(shank, 0.007, 7), mat: M.steel, id: 1 }],
      grip: [0, 0.02, 0],
    };
  },
  crateLid: (v, lod) => {
    const M = mats();
    const planks = [];
    for (let i = 0; i < 4; i++) {
      const p = slab(0.29, 0.022, 1.18, { bevel: 0.004, corner: 0.006, seg: 1, curve: 2 });
      p.deleteAttribute('uv');
      p.translate(-0.45 + i * 0.3, 0.03, 0);
      planks.push(p);
    }
    const bat = [new THREE.BoxGeometry(1.15, 0.03, 0.09).translate(0, 0.015, -0.4), new THREE.BoxGeometry(1.15, 0.03, 0.09).translate(0, 0.015, 0.4)];
    return { parts: [{ geo: mergeGeos(planks), mat: M.plank, id: 0 }, { geo: mergeGeos(bat), mat: M.wood, id: 0 }], grip: [0.5, 0.03, 0] };
  },
  chainCoil: (v, lod) => {
    const M = mats();
    const links = [];
    const n = lod ? 26 : 52;
    for (let i = 0; i < n; i++) {
      const a = i * 0.55, r = 0.08 + 0.12 * (i / n);
      const y = 0.03 + 0.02 * Math.floor(i / 14);
      const link = new THREE.TorusGeometry(0.03, 0.009, 5, 10).rotateY(a + (i % 2) * Math.PI / 2);
      if (i % 2) link.rotateX(Math.PI / 2);
      link.translate(Math.cos(a) * r, y, Math.sin(a) * r);
      links.push(link);
    }
    return { parts: [{ geo: mergeGeos(links), mat: M.steel, id: 0 }], grip: [0.18, 0.05, 0] };
  },
  rope: (v, lod) => {
    const M = mats();
    const turns = [];
    for (let k = 0; k < 5; k++) turns.push(new THREE.TorusGeometry(0.26 - k * 0.02, 0.025, 8, lod ? 18 : 36).rotateX(Math.PI / 2).translate(0, 0.025 + k * 0.045, 0));
    return { parts: [{ geo: mergeGeos(turns), mat: M.rope, id: 0 }], grip: [0.26, 0.1, 0] };
  },
};


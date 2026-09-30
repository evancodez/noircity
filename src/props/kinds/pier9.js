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
  // ([R2-E] the foreman's signature: it must read at arm's length and at
  // five metres - a hook as long as a forearm, its steel a worn grey that
  // catches the light along its curve)
  cargoHook: (v, lod) => {
    const M = mats();
    const handle = new THREE.CylinderGeometry(0.022, 0.022, 0.14, lod ? 8 : 14).rotateZ(Math.PI / 2).translate(0, 0.02, 0);
    const shank = [V3(0, 0.02, 0), V3(0, 0.02, 0.12), V3(0, 0.04, 0.22), V3(0.004, 0.1, 0.29), V3(0.008, 0.18, 0.285), V3(0.01, 0.235, 0.23), V3(0.01, 0.235, 0.17)];
    return {
      parts: [{ geo: handle, mat: M.wood, id: 0 }, { geo: tubeOf(shank, 0.0095, 8), mat: std('p9_hookSteel', { color: 0x464646, roughness: 0.28, surface: 'metal' }), id: 1 }],
      grip: [0, 0.02, 0],
    };
  },
  crateLid: (v, lod) => {
    const M = mats();
    const planks = [];
    // ([R2-E] the small one: off a crate a man carries, three planks on two
    // battens, 0.5 x 0.5 - held up before me in both hands it covers the
    // chest and he is seen over it; the grip at the middle of its right
    // side, the battens' ends)
    if (v === 'small') {
      for (let i = 0; i < 3; i++) {
        const p = slab(0.158, 0.02, 0.5, { bevel: 0.004, corner: 0.006, seg: 1, curve: 2 });
        p.deleteAttribute('uv');
        p.translate(-0.165 + i * 0.165, 0.028, 0);
        planks.push(p);
      }
      const bat = [new THREE.BoxGeometry(0.5, 0.028, 0.07).translate(0, 0.014, -0.17), new THREE.BoxGeometry(0.5, 0.028, 0.07).translate(0, 0.014, 0.17)];
      // (the grip's frame turns it upright before me in the fight's two-handed
      // hold - clips/fight.js BIG_R, the hands' default socket: its face to
      // me, spreading left of my right hand, held near its top corner so he
      // is seen over it)
      const grip = new THREE.Matrix4().makeBasis(V3(0.688, -0.065, -0.723), V3(-0.653, 0.351, -0.653), V3(0.297, 0.921, 0.198)).setPosition(0.25, 0.02, -0.16);
      // (a pale deal lid: it prints grey with its grain, never a black plate)
      return { parts: [{ geo: mergeGeos(planks), mat: std('p9_lidDeal', { color: 0x6a6a6a, roughness: 0.85, surface: 'wood' }), id: 0 }, { geo: mergeGeos(bat), mat: M.wood, id: 0 }], grip };
    }
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
    // ([R2-E] 'hank': a length of it taken up in the fist - two turns round
    // the knuckles and 0.6 m hanging out of the bottom of the fist and
    // curling forward: the reach it swings with; the grip its top)
    if (v === 'hank') {
      const pts = [];
      for (let i = 0; i < 16; i++) { const s = i / 15; pts.push([0.0, -0.04 - s * 0.42 + 0.12 * s * s * s, 0.02 + 0.3 * s * s]); }
      pts.forEach(([x, y, z], i) => {
        const link = new THREE.TorusGeometry(0.028, 0.008, 5, 10).rotateX(Math.PI / 2 * (i % 2)).rotateZ(Math.PI / 2);
        link.translate(x, y, z);
        links.push(link);
      });
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const link = new THREE.TorusGeometry(0.026, 0.008, 5, 10).rotateY(a); link.translate(Math.cos(a) * 0.05, 0.01 * (i % 2), Math.sin(a) * 0.05); links.push(link); }
      return { parts: [{ geo: mergeGeos(links), mat: std('p9_hookSteel', { color: 0x464646, roughness: 0.28, surface: 'metal' }), id: 0 }], grip: [0, 0, 0] };
    }
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
  // [R2-E] the foreman's work jacket: one cloth with two shapes, held by
  // its collar hanging from his hand (the grip, the origin) and laid over a
  // barrel's top and down its side (the barrel's top centre the origin, the
  // drape falling toward +z); variant 'draped' starts laid. The scene lays
  // it from one to the other (geometry.userData.shape(k): 0 held, 1 laid),
  // the vertices moved on the CPU so every pass draws the same cloth.
  jacket: (v, lod) => {
    const nu = lod ? 8 : 12, nv = lod ? 12 : 20;
    const geo = new THREE.PlaneGeometry(1, 1, nu, nv);
    const P = geo.getAttribute('position');
    const held = new Float32Array(P.count * 3), laid = new Float32Array(P.count * 3);
    for (let i = 0; i < P.count; i++) {
      const u = P.getX(i) + 0.5, s = (0.5 - P.getY(i)) * 0.94;
      const fold = Math.sin(u * 17 + 1.3), fold2 = Math.sin(u * 7.1 + s * 3);
      // held by the collar: hanging, bunched at the top
      held[i * 3] = (u - 0.5) * (0.26 + 0.24 * Math.min(1, s * 3));
      held[i * 3 + 1] = -s * 0.82;
      held[i * 3 + 2] = 0.022 * fold * Math.min(1, s * 4) + 0.015 * fold2;
      // laid: across the top, over the rim, down the side
      let y, z;
      if (s < 0.3) { y = 0.012 + 0.008 * fold2; z = -0.03 + s; }
      else if (s < 0.38) { const k = (s - 0.3) / 0.08 * Math.PI / 2; y = 0.012 - 0.03 * (1 - Math.cos(k)); z = 0.27 + 0.03 * Math.sin(k); }
      else { y = -0.02 - (s - 0.38); z = 0.3 + 0.08 * Math.min(1, (s - 0.38) / 0.44) + 0.012 * fold * Math.min(1, (s - 0.38) * 4); }
      laid[i * 3] = (u - 0.5) * 0.56 * (1 - 0.18 * Math.max(0, Math.min(1, (s - 0.38) / 0.5)));
      laid[i * 3 + 1] = y;
      laid[i * 3 + 2] = z;
    }
    const shape = (k) => {
      for (let i = 0; i < held.length; i++) P.array[i] = held[i] + (laid[i] - held[i]) * k;
      P.needsUpdate = true;
      geo.computeVertexNormals();
      geo.computeBoundingSphere();
    };
    geo.userData.shape = shape;
    shape(v === 'draped' ? 1 : 0);
    return { parts: [{ geo, mat: std('p9_jacket', { color: 0x121212, roughness: 0.95, surface: 'cloth', side: THREE.DoubleSide }), id: 0 }], grip: [0, 0, 0] };
  },
  rope: (v, lod) => {
    const M = mats();
    const turns = [];
    for (let k = 0; k < 5; k++) turns.push(new THREE.TorusGeometry(0.26 - k * 0.02, 0.025, 8, lod ? 18 : 36).rotateX(Math.PI / 2).translate(0, 0.025 + k * 0.045, 0));
    return { parts: [{ geo: mergeGeos(turns), mat: M.rope, id: 0 }], grip: [0.26, 0.1, 0] };
  },
};


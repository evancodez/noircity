import * as THREE from 'three';
import { std, lathe, mergeGeos, smooth } from '../lib.js';

// [O4] The city's shotgun (docs/briefs/O4_COMBAT.md §2): a side-by-side
// double, twelve bore, a boxlock action, a splinter fore-end, a semi-pistol
// grip and a straight comb; it breaks open on its hinge (the barrels and
// the fore-end tip down), two shells in its breech. buildProp('shotgun').
// Gun-local frame as the revolver's (+x right, +y up, the muzzle toward -z,
// metres); the origin is the grip - the palm's centre on the wrist, which is
// raked back as the revolver's stocks are, so the right hand holds it by the
// same socket (src/player/clips/o4.js).
//   ud.setOpen(k)      the barrels down on the hinge (0 shut .. 1 open)
//   ud.setShells([a, b])  'live' | 'spent' | 'empty' in the right and left barrel
//   ud.setLift(k)      the shells drawn out a little by the extractor (0 .. 1)
//   ud.muzzles         [right, left] gun-local points; ud.muzzle their middle
//   ud.fore            the fore-end's underside (the left hand's place)
//   ud.breech          the breech face's middle (the shells go in here)
// Also 'shellsHand': two shells side by side in the left hand's fingers
// (ud.setCount(n)), and 'shellBox': a pasteboard box of ten (the shop's).
const S = (lod, n) => Math.max(6, Math.round(n / (lod ? 2 : 1)));
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const BORE = 0.062;              // the barrels' axes above the grip
const BX = 0.0108;               // each barrel's axis off the middle
const BR = 0.0112;               // a barrel's outer radius at the breech
const BREECH = -0.048;           // the breech face (gun z)
const LEN = 0.68;                // the barrels' length
const HINGE = V(0, BORE - 0.034, BREECH - 0.022);   // the hinge pin
const MUZ = BREECH - LEN;

function mats() {
  return {
    steel: std('sgSteel', { color: 0x0a0a0a, roughness: 0.32, surface: 'metal' }),
    // the action: case-hardened, a shade lighter than the barrels
    action: std('sgAction', { color: 0x161616, roughness: 0.4, surface: 'metal' }),
    bore: std('sgBore', { color: 0x020202, roughness: 1, surface: 'metal' }),
    wood: (() => { const m = std('sgWood', { color: 0x2c2c2c, roughness: 0.85, surface: 'wood' }); m.userData.inkSurface = 'glass'; return m; })(),
    brass: (() => { const m = std('sgBrass', { color: 0x7a7a7a, roughness: 0.3, surface: 'metal' }); m.userData.inkSurface = 'glass'; return m; })(),
    // the shell's paper hull: a pale card
    hull: (() => { const m = std('sgHull', { color: 0x585858, roughness: 0.9, surface: 'wood' }); m.userData.inkSurface = 'glass'; return m; })(),
    box: (() => { const m = std('sgBox', { color: 0x4a4a4a, roughness: 0.95, surface: 'wood' }); m.userData.inkSurface = 'glass'; return m; })(),
  };
}
// a lathe along -z from a0
function latheFwd(prof, segs, a0 = 0) {
  const g = lathe(prof, segs);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0, -a0);
  return g;
}
// a side profile [[a, y]] (a forward, -z) extruded across x, width w, bevel b
function side(pts, w, b, spline = false, curve = 12) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  if (spline) s.splineThru(pts.slice(1).map(([a, y]) => new THREE.Vector2(a, y)));
  else for (const [a, y] of pts.slice(1)) s.lineTo(a, y);
  s.closePath();
  const depth = Math.max(0.0005, w - 2 * b);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: b, bevelSize: b * 0.9, bevelSegments: 3, curveSegments: curve });
  g.translate(0, 0, -depth / 2);
  g.rotateY(Math.PI / 2);
  return smooth(g, 1e-5);
}
// one shell along -z from its head (the brass head at 0, the crimp at -0.065)
function shellGeos(lod) {
  const seg = S(lod, 14);
  const head = latheFwd([[0.0001, -0.0015], [0.0112, -0.0015], [0.0112, 0.0002], [0.0103, 0.0006], [0.0103, 0.016], [0.0001, 0.016]], seg);
  const hull = latheFwd([[0.0001, 0.0158], [0.0102, 0.0158], [0.0102, 0.063], [0.0094, 0.066], [0.0001, 0.067]], seg);
  return { head, hull };
}

export const SPECS = {
  shotgun(v, lod) {
    const M = mats();
    const seg = S(lod, 26);
    const barrelF = [], boreF = [], steelF = [], actionF = [], woodF = [], foreF = [];
    // -- the barrels: a little taper to the muzzle, the breech's chamber rings
    for (const x of [BX, -BX]) {
      barrelF.push(latheFwd([[0.0001, 0], [BR, 0], [BR, 0.06], [BR - 0.0012, 0.09], [0.0098, LEN - 0.004], [0.0094, LEN], [0.0001, LEN]], seg).translate(x, BORE, BREECH));
      boreF.push(new THREE.CylinderGeometry(0.0091, 0.0091, 0.0006, S(lod, 16)).rotateX(Math.PI / 2).translate(x, BORE, MUZ - 0.0003));
    }
    // the rib along the top between them, the bead at its end; the rib under them
    barrelF.push(side([[-BREECH, BORE + 0.0098], [-BREECH, BORE + 0.0122], [-MUZ - 0.002, BORE + 0.0108], [-MUZ - 0.002, BORE + 0.0088]], 0.0062, 0.0012).translate(0, 0, 0));
    barrelF.push(side([[-BREECH - 0.03, BORE - 0.008], [-BREECH - 0.03, BORE - 0.0105], [-MUZ - 0.002, BORE - 0.0092], [-MUZ - 0.002, BORE - 0.0072]], 0.0072, 0.0012));
    barrelF.push(new THREE.SphereGeometry(0.0022, 10, 8).translate(0, BORE + 0.0135, MUZ + 0.006));
    // the lumps under the breech down to the hinge
    barrelF.push(side([[-BREECH, BORE - 0.006], [-BREECH, HINGE.y - 0.004], [-HINGE.z + 0.006, HINGE.y - 0.006], [-BREECH + 0.05, BORE - 0.012]], 0.02, 0.003));
    // -- the fore-end: a splinter of walnut under the barrels, its iron at the front
    foreF.push(side([[-BREECH + 0.035, BORE - 0.008], [-BREECH + 0.035, BORE - 0.03], [-BREECH + 0.07, BORE - 0.038], [-BREECH + 0.22, BORE - 0.035], [-BREECH + 0.27, BORE - 0.022], [-BREECH + 0.275, BORE - 0.01]], 0.04, 0.007, true));
    steelF.push(side([[-BREECH + 0.03, BORE - 0.02], [-BREECH + 0.03, BORE - 0.033], [-BREECH + 0.065, BORE - 0.036], [-BREECH + 0.07, BORE - 0.026]], 0.03, 0.003));
    // -- the action: the frame behind the breech, its bar forward to the hinge, the top lever
    actionF.push(side([[-BREECH, BORE + 0.012], [-BREECH, HINGE.y - 0.008], [-HINGE.z + 0.012, HINGE.y - 0.01], [-HINGE.z + 0.016, HINGE.y + 0.004], [-BREECH + 0.002, BORE - 0.012],
      [-BREECH - 0.004, BORE - 0.016], [0.026, BORE - 0.042], [0.012, BORE - 0.046], [0.006, BORE - 0.024], [-0.004, BORE + 0.006], [-0.006, BORE + 0.013]], 0.045, 0.0045));
    actionF.push(side([[0.0, BORE + 0.015], [-0.03, BORE + 0.017], [-0.034, BORE + 0.014], [0.0, BORE + 0.011]], 0.012, 0.0018));
    // the trigger guard and the triggers
    const tg = new THREE.CatmullRomCurve3([V(0, BORE - 0.044, -0.022), V(0, BORE - 0.078, -0.012), V(0, BORE - 0.082, 0.012), V(0, BORE - 0.072, 0.03), V(0, BORE - 0.05, 0.034)], false, 'centripetal');
    steelF.push(new THREE.TubeGeometry(tg, 20, 0.0022, 8, false).scale(2.4, 1, 1));
    for (const [z, x] of [[-0.016, 0.003], [-0.004, -0.003]]) steelF.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(x, BORE - 0.045, z), V(x, BORE - 0.06, z + 0.003), V(x, BORE - 0.068, z + 0.01)]), 8, 0.0018, 6, false).scale(1.6, 1, 1));
    // -- the stock: the wrist (the hand's grip, raked back) into the semi-pistol
    // grip, the comb straight back to the butt, a dark butt plate
    const stock = [
      [0.004, BORE + 0.0105], [-0.06, BORE + 0.006], [-0.14, BORE - 0.002], [-0.25, BORE - 0.006], [-0.33, BORE - 0.006], [-0.355, BORE - 0.004],
      [-0.36, BORE - 0.06], [-0.355, BORE - 0.125], [-0.33, BORE - 0.13], [-0.18, BORE - 0.085], [-0.07, BORE - 0.075], [-0.04, BORE - 0.105],
      [-0.012, BORE - 0.112], [0.004, BORE - 0.1], [0.008, BORE - 0.07], [0.01, BORE - 0.046],
    ];
    woodF.push(side(stock.map(([a, y]) => [a - 0.022, y]), 0.042, 0.009, true, 16));
    steelF.push(side([[-0.379, BORE - 0.002], [-0.386, BORE - 0.003], [-0.384, BORE - 0.133], [-0.377, BORE - 0.134]], 0.044, 0.002));
    const parts = [
      { geo: mergeGeos(barrelF), mat: M.steel, id: 0, parent: 'barrels' },
      { geo: mergeGeos(boreF), mat: M.bore, id: 0, parent: 'barrels', cast: false },
      { geo: mergeGeos(foreF), mat: M.wood, id: 2, parent: 'barrels' },
      { geo: mergeGeos(actionF), mat: M.action, id: 1 },
      { geo: mergeGeos(steelF), mat: M.steel, id: 1 },
      { geo: mergeGeos(woodF), mat: M.wood, id: 3 },
    ];
    // (the barrels' parts are built in the gun's frame: their group sits at the
    // hinge, so they are moved there by the hinge's offset)
    for (const p of parts) if (p.parent === 'barrels') p.geo.translate(-HINGE.x, -HINGE.y, -HINGE.z);
    const R = shellGeos(lod);
    return {
      parts,
      groups: { barrels: [HINGE.x, HINGE.y, HINGE.z] },
      grip: [0, 0, 0],
      init(g, ud, by) {
        const mk = (geo, mat, id) => { const m = new THREE.Mesh(geo, mat); m.userData.inkId = ud.inkId + id; m.castShadow = true; m.receiveShadow = true; return m; };
        // two shells in the breech (they ride the barrels; drawn out a little by the extractor)
        const ext = new THREE.Group(); ext.name = 'ext';
        by.barrels.add(ext);
        const shells = [];
        for (const x of [BX, -BX]) {
          const sg = new THREE.Group();
          sg.add(mk(R.head, M.brass, 4), mk(R.hull, M.hull, 4));
          sg.position.set(x - HINGE.x, BORE - HINGE.y, BREECH + 0.0015 - HINGE.z);
          ext.add(sg);
          shells.push(sg);
        }
        ud.shells = ['live', 'live'];
        ud.setShells = (arr) => { for (let i = 0; i < 2; i++) { ud.shells[i] = arr[i] || 'empty'; shells[i].visible = ud.shells[i] !== 'empty'; shells[i].children[1].visible = ud.shells[i] === 'live' || ud.shells[i] === 'spent'; } };
        ud.setOpen = (k) => { ud.open = Math.max(0, Math.min(1, k)); by.barrels.rotation.x = -ud.open * 0.5; };
        ud.setLift = (k) => { ext.position.z = Math.max(0, Math.min(1, k)) * 0.012; };
        ud.muzzles = [V(BX, BORE, MUZ), V(-BX, BORE, MUZ)];
        ud.muzzle = V(0, BORE, MUZ);
        ud.fore = V(0, BORE - 0.04, BREECH - 0.17);
        ud.breech = V(0, BORE, BREECH);
        ud.hinge = HINGE.clone();
        ud.dims = { BORE, BX, BR, BREECH, LEN, MUZ };
        ud.vmPartIds = 5;
        // (the shells' place in the eye's frame as the barrels stand: for the feed)
        ud.chamberAt = (i, out = V(0, 0, 0)) => { g.updateMatrixWorld(true); out.set(i ? -BX : BX, BORE, BREECH).sub(HINGE); out.applyMatrix4(by.barrels.matrixWorld); return out.applyMatrix4(new THREE.Matrix4().copy(g.matrixWorld).invert()); };
      },
      rest: new THREE.Matrix4().makeRotationZ(Math.PI / 2).setPosition(0.022, BORE, 0),
    };
  },

  // two shells between the fingers of the left hand, their heads up the hand
  shellsHand(v, lod) {
    const M = mats();
    const R = shellGeos(lod);
    return {
      parts: [{ geo: new THREE.BufferGeometry(), mat: M.brass, id: 0 }],
      grip: [0, 0, 0],
      init(g, ud) {
        g.clear();
        const list = [];
        for (const x of [-0.0112, 0.0112]) {
          const sg = new THREE.Group();
          const a = new THREE.Mesh(R.head, M.brass); a.userData.inkId = ud.inkId;
          const b = new THREE.Mesh(R.hull, M.hull); b.userData.inkId = ud.inkId;
          sg.add(a, b);
          sg.rotation.x = -Math.PI / 2;
          sg.position.set(x, 0, 0);
          g.add(sg);
          list.push(sg);
        }
        ud.setCount = (n) => { list.forEach((s, i) => { s.visible = i < n; }); };
      },
    };
  },

  // a pasteboard box of ten shells, its lid lettered (the shop's counter)
  shellBox(v, lod) {
    const M = mats();
    const box = new THREE.BoxGeometry(0.075, 0.07, 0.11).translate(0, 0.035, 0);
    return { parts: [{ geo: smooth(box.toNonIndexed ? box : box), mat: M.box, id: 0 }], grip: [0, 0.035, 0] };
  },
};

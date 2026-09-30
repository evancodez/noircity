import * as THREE from 'three';
import { std, lathe, flutedLathe, mergeGeos, smooth } from '../lib.js';

// The detective's .38 (lane B3): a 1930s police revolver, a four-inch
// barrel, blued steel, checkered walnut stocks with a medallion, the
// cylinder on its crane (swings out to the left), the hammer (cocked /
// down), the ejector (rod and star), six rounds. buildProp('revolver').
//
// Gun-local frame (the Tommy gun's): +x right, +y up, the muzzle toward -z,
// metres. The origin is the grip: the palm's centre on the stocks (where
// the hand's socket holds it: src/player/clips/revolver.js); the bore axis
// runs 0.052 above it, the cylinder's rear face 0.041 ahead of it.
//   ud.setOpen(k)        the cylinder swung out on its crane (0 shut .. 1 out)
//   ud.setTurn(rad)      the cylinder turned about its own axis
//   ud.setHammer(k)      0 down .. 1 cocked
//   ud.setTrigger(k)     0 forward .. 1 pulled
//   ud.setEject(k)       the ejector's stroke (0 home .. 1 full, the cases out)
//   ud.setChambers(arr)  six states, 'live' | 'spent' | 'empty' (chamber 0 is
//                        under the hammer when the cylinder is at turn 0; a
//                        chamber at index i sits i * 60 degrees clockwise as
//                        the shooter sees the rear face)
//   ud.chamberAt(i, out) a chamber's rear mouth, gun-local (Vector3)
//   ud.muzzle, ud.rearSight, ud.frontSight  gun-local points
//   ud.parts             the named groups (crane, cyl, eject, hammer, trigger)
// Also 'roundsHand': the loose rounds in the left hand for a reload (up to
// six, the front pair pinched by thumb and index): ud.setCount(n).
const S = (lod, n) => Math.max(6, Math.round(n / (lod ? 2 : 1)));
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---- dimensions (a = forward, along -z) ------------------------------------------------
// the bore axis at y = BORE; the cylinder's axis CA below it (the top chamber
// lines up with the barrel); the cylinder from its rear face at a = CY0 to its
// front at CY1; the barrel from the frame's front to the muzzle
const BORE = 0.052, CR = 0.0118, CYL_R = 0.0184;
const CA = BORE - CR;
const Z0 = -0.041;                 // the cylinder's rear face (gun z)
const CY0 = 0, CY1 = 0.039;        // cylinder, a from its rear face
const FR1 = 0.051;                 // the frame's front
const MUZ = 0.144;                 // the muzzle
const az = (a) => Z0 - a;          // a (forward from the cylinder's rear face) -> gun z
// the crane's hinge: low on the left, under the cylinder's front
const CRANE = V(-0.0088, CA - 0.0158, 0);

// ---- helpers --------------------------------------------------------------------------
// a lathe along -z (the barrel's way): profile [[r, a]], a forward from a0
function latheFwd(prof, segs, a0 = 0) {
  const g = lathe(prof.map(([r, a]) => [r, a]), segs);
  g.rotateX(-Math.PI / 2);         // lathe +y -> -z
  g.translate(0, 0, -a0);
  return g;
}
// a side profile [[a, y]] (a forward) extruded across x, width w, bevel b
function side(pts, w, b, curve = 10, bevelSeg = 3) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (const [a, y] of pts.slice(1)) s.lineTo(a, y);
  s.closePath();
  const depth = Math.max(0.0005, w - 2 * b);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: b, bevelSize: b * 0.9, bevelSegments: bevelSeg, curveSegments: curve });
  g.translate(0, 0, -depth / 2);
  g.rotateY(Math.PI / 2);          // shape x (forward) -> -z, extrusion -> x
  return smooth(g, 1e-5);
}
// the same with a smooth outline (spline through the points)
function sideSpline(pts, w, b, curve = 12, bevelSeg = 3) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  s.splineThru(pts.slice(1).map(([a, y]) => new THREE.Vector2(a, y)));
  s.closePath();
  const depth = Math.max(0.0005, w - 2 * b);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: b, bevelSize: b * 0.9, bevelSegments: bevelSeg, curveSegments: curve });
  g.translate(0, 0, -depth / 2);
  g.rotateY(Math.PI / 2);
  return smooth(g, 1e-5);
}
// a rounded box centred at c (gun coords)
function rbox(w, h, d, r, c, seg = 2) {
  // (a box with its corners rounded: an extruded rounded rect, bevelled)
  const s = new THREE.Shape();
  const hw = w / 2, hh = h / 2;
  r = Math.min(r, hw * 0.95, hh * 0.95);
  s.moveTo(-hw + r, -hh); s.lineTo(hw - r, -hh); s.quadraticCurveTo(hw, -hh, hw, -hh + r);
  s.lineTo(hw, hh - r); s.quadraticCurveTo(hw, hh, hw - r, hh); s.lineTo(-hw + r, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - r); s.lineTo(-hw, -hh + r); s.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  const bv = Math.min(r, d * 0.3);
  const e = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.0005, d - 2 * bv), bevelEnabled: true, bevelThickness: bv, bevelSize: bv * 0.8, bevelSegments: seg, curveSegments: 4 });
  e.translate(0, 0, -(d - 2 * bv) / 2);
  e.translate(c.x, c.y, c.z);
  return smooth(e, 1e-5);
}
// a tube through points (gun coords), its section flattened across x by fx
function band(points, r, fx = 1, seg = 24, radial = 8) {
  const c = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const g = new THREE.TubeGeometry(c, seg, r, radial, false);
  if (fx !== 1) g.scale(fx, 1, 1);
  return g;
}

// ---- materials (the prop palette's rules: low albedos, no gloss) ----------------------
function mats() {
  return {
    // blued steel: prints black with the rim's glints (hands: 'metal')
    steel: std('revSteel', { color: 0x0b0b0b, roughness: 0.34, surface: 'metal' }),
    // the bore and the chamber mouths: black
    bore: std('revBore', { color: 0x020202, roughness: 1, surface: 'metal' }),
    // the walnut stocks: a mid grey in the hand (printed as glass is:
    // held at mid grey, so the grip parts from the black frame)
    wood: (() => { const m = std('revWood', { color: 0x2e2e2e, roughness: 0.85, surface: 'wood' }); m.userData.inkSurface = 'glass'; return m; })(),
    // the medallion, the rounds' brass: light metal
    brass: (() => { const m = std('revBrass', { color: 0x7a7a7a, roughness: 0.3, surface: 'metal' }); m.userData.inkSurface = 'glass'; return m; })(),
    lead: (() => { const m = std('revLead', { color: 0x3a3a3a, roughness: 0.6, surface: 'metal' }); m.userData.inkSurface = 'glass'; return m; })(),
  };
}

// ---- one round: the case (rim at a = 0, the head toward +z) and the bullet --------------
// built along -z from its head; (spent: the case alone)
function roundGeos(lod) {
  const seg = S(lod, 16);
  const cas = latheFwd([[0.0001, -0.0012], [0.0053, -0.0012], [0.0056, -0.0008], [0.0056, 0.0002], [0.0048, 0.0004], [0.0048, 0.0287], [0.0046, 0.029], [0.0001, 0.029]], seg);
  // the primer: a small disc proud of the head
  const primer = new THREE.CylinderGeometry(0.0019, 0.0019, 0.0006, seg).rotateX(Math.PI / 2).translate(0, 0, 0.0014);
  const bullet = latheFwd([[0.0001, 0.0286], [0.00445, 0.0286], [0.00445, 0.033], [0.0038, 0.0365], [0.0022, 0.0386], [0.0001, 0.0392]], seg);
  return { cas, primer, bullet };
}

export const SPECS = {
  revolver(v, lod) {
    const M = mats();
    const seg = S(lod, 28);
    const steelF = [], woodF = [], boreF = [];
    // -- the barrel: breech shoulder to the crowned muzzle, a little taper
    steelF.push(latheFwd([[0.0001, FR1 - 0.012], [0.0078, FR1 - 0.012], [0.0098, FR1 - 0.004], [0.0098, FR1 + 0.004], [0.0086, FR1 + 0.006],
      [0.0083, FR1 + 0.03], [0.0078, MUZ - 0.004], [0.0074, MUZ - 0.0008], [0.0062, MUZ], [0.0001, MUZ]], seg).translate(0, BORE, Z0));
    // the bore at the muzzle: a black disc just proud of the crown
    boreF.push(new THREE.CylinderGeometry(0.0046, 0.0046, 0.0004, S(lod, 16)).rotateX(Math.PI / 2).translate(0, BORE, az(MUZ) - 0.0002));
    // the rib along the barrel's top and the front sight: a half-moon blade
    steelF.push(rbox(0.0034, 0.0032, MUZ - FR1 - 0.004, 0.0012, V(0, BORE + 0.0086, az((MUZ + FR1) / 2))));
    steelF.push(side([[MUZ - 0.014, BORE + 0.008], [MUZ - 0.009, BORE + 0.0148], [MUZ - 0.0035, BORE + 0.0156], [MUZ - 0.0015, BORE + 0.008]], 0.0032, 0.0006, 4, 1).translate(0, 0, Z0));
    // the ejector rod's lug under the barrel (the rod's tip locks into it)
    steelF.push(side([[FR1 + 0.036, BORE - 0.006], [FR1 + 0.036, CA - 0.004], [FR1 + 0.044, CA - 0.0055], [FR1 + 0.05, CA - 0.002], [FR1 + 0.052, BORE - 0.006]], 0.0082, 0.0018, 6, 2).translate(0, 0, Z0));
    // -- the frame
    // the top strap over the cylinder, its rear grooved for the sight
    steelF.push(rbox(0.0165, 0.0088, FR1 + 0.022, 0.0028, V(0, BORE + 0.0098 - 0.0012, az(FR1 / 2 - 0.011))));
    for (const x of [-0.0036, 0.0036]) steelF.push(rbox(0.0024, 0.0026, 0.016, 0.0009, V(x, BORE + 0.0149, az(-0.012))));
    // the front post (where the barrel is screwed in) down to the frame's floor
    steelF.push(rbox(0.021, BORE + 0.012 - (CA - 0.031), 0.012, 0.0032, V(0, (BORE + 0.012 + CA - 0.031) / 2, az(FR1 - 0.006))));
    // the floor under the cylinder's window
    steelF.push(rbox(0.021, 0.011, FR1 + 0.006, 0.003, V(0, CA - 0.0185 - 0.006, az(FR1 / 2 - 0.004))));
    // the recoil shield behind the cylinder: a round plate on the axis
    steelF.push(latheFwd([[0.0001, -0.013], [0.0176, -0.013], [0.0196, -0.0105], [0.0199, -0.004], [0.019, -0.0012], [0.0001, -0.0012]], seg).translate(0, CA, Z0));
    // the rear of the frame and the grip frame: the hammer's slot at the
    // top, the backstrap raked down and back to the round butt, the front
    // strap up to the trigger guard (a side profile, a = forward)
    const G0 = BORE - 0.052;   // the grip's origin height (0)
    const rearPts = [
      [-0.004, BORE + 0.010], [-0.02, BORE + 0.0085], [-0.03, BORE + 0.001], [-0.034, BORE - 0.012], [-0.038, BORE - 0.026],
      [-0.047, BORE - 0.062], [-0.056, BORE - 0.101], [-0.052, BORE - 0.111], [-0.04, BORE - 0.114], [-0.03, BORE - 0.112],
      [-0.024, BORE - 0.094], [-0.018, BORE - 0.068], [-0.012, BORE - 0.052], [-0.004, BORE - 0.048], [0.006, CA - 0.031], [0.006, CA - 0.02], [-0.002, CA - 0.019],
    ];
    steelF.push(side(rearPts, 0.0205, 0.003, 4, 2).translate(0, 0, Z0));
    // the trigger guard: a flat band from the floor round to the front strap
    const tg = [[0.012, CA - 0.034], [0.01, BORE - 0.066], [0.0, BORE - 0.074], [-0.009, BORE - 0.073], [-0.015, BORE - 0.066], [-0.0155, BORE - 0.058]];
    steelF.push(band(tg.map(([a, y]) => V(0, y, az(a))), 0.0021, 2.2, 24, 8));
    // the cylinder latch on the frame's left, behind the recoil shield
    steelF.push(rbox(0.0042, 0.0056, 0.0115, 0.0016, V(-0.0112, CA + 0.0015, az(-0.02))));
    // the stocks: rounded walnut panels over the grip frame, fatter than it,
    // a medallion high on each side
    const stockPts = [
      [-0.033, BORE - 0.018], [-0.041, BORE - 0.036], [-0.048, BORE - 0.064], [-0.055, BORE - 0.097], [-0.052, BORE - 0.108], [-0.042, BORE - 0.112],
      [-0.031, BORE - 0.11], [-0.025, BORE - 0.093], [-0.019, BORE - 0.068], [-0.016, BORE - 0.054], [-0.02, BORE - 0.036], [-0.026, BORE - 0.024],
    ];
    woodF.push(sideSpline(stockPts, 0.0315, 0.0062, 14, 4).translate(0, 0, Z0));
    const med = [];
    for (const s of [-1, 1]) med.push(new THREE.CylinderGeometry(0.0042, 0.0042, 0.0008, S(lod, 18)).rotateZ(Math.PI / 2).translate(s * 0.01525, BORE - 0.041, az(-0.03)));
    // -- the hammer (its pivot low behind the recoil shield); drawn DOWN
    const HP = V(0, BORE - 0.013, az(-0.021));
    const hammer = side([[-0.013, BORE - 0.016], [-0.0125, BORE + 0.0035], [-0.017, BORE + 0.0105], [-0.025, BORE + 0.0165], [-0.0345, BORE + 0.0205],
      [-0.0365, BORE + 0.0165], [-0.029, BORE + 0.0085], [-0.0255, BORE - 0.004], [-0.0245, BORE - 0.016]], 0.0068, 0.0014, 4, 2).translate(0, 0, Z0);
    hammer.translate(-HP.x, -HP.y, -HP.z);
    // -- the trigger: a curved blade on its pivot in the frame's floor
    const TP = V(0, CA - 0.031, az(0.004));
    const trig = band([V(0, CA - 0.031, az(0.004)), V(0, BORE - 0.058, az(0.0035)), V(0, BORE - 0.066, az(-0.001)), V(0, BORE - 0.0695, az(-0.0065))], 0.0019, 1.7, 16, 8);
    trig.translate(-TP.x, -TP.y, -TP.z);
    // -- the cylinder (on the crane): fluted between the chambers, chamfered
    const CYC = V(0, CA, 0);        // the cylinder's axis (gun x, y)
    const cylProf = [[0.0001, CY0 + 0.0005], [0.0172, CY0 + 0.0005], [CYL_R, CY0 + 0.0022], [CYL_R, 0.008], [CYL_R, 0.018], [CYL_R, 0.03], [CYL_R, CY1 - 0.0035], [0.0165, CY1], [0.0001, CY1]];
    // (flutedLathe runs along +y with the angle measured from +z; the
    // flutes lie between the chambers: the ridges at 0, 60, ... degrees)
    const cyl = flutedLathe(cylProf.map(([r, a]) => [r, a]), { segs: S(lod, 72), count: 6, depth: (y) => (y > 0.0075 && y < 0.0305 ? 0.0034 * Math.min(1, (y - 0.0075) / 0.003, (0.0305 - y) / 0.003) : 0) });
    // (+y -> -z; the lathe's angle 0 (+z) -> +y: the top chamber)
    cyl.rotateX(-Math.PI / 2);
    // chamber mouths: black discs on the front face; the rear face's
    // counterbores (seen when the cylinder is out and empty)
    const mouths = [], rears = [];
    for (let i = 0; i < 6; i++) {
      const th = i * Math.PI / 3, x = -Math.sin(th) * CR, y = Math.cos(th) * CR;
      mouths.push(new THREE.CylinderGeometry(0.0047, 0.0047, 0.0004, S(lod, 12)).rotateX(Math.PI / 2).translate(x, y, -CY1 - 0.0001));
      rears.push(new THREE.CylinderGeometry(0.0054, 0.0054, 0.0004, S(lod, 12)).rotateX(Math.PI / 2).translate(x, y, -CY0 + 0.0002));
    }
    // the ejector star on the rear face and its rod forward along the axis
    // to the lug; the rod's knurled tip
    const star = new THREE.CylinderGeometry(0.0086, 0.0086, 0.0016, 6).rotateX(Math.PI / 2).translate(0, 0, 0.0009);
    const rod = latheFwd([[0.0001, CY1 - 0.004], [0.0027, CY1 - 0.004], [0.0027, FR1 + 0.036], [0.0034, FR1 + 0.037], [0.0034, FR1 + 0.043], [0.0024, FR1 + 0.045], [0.0001, FR1 + 0.045]], S(lod, 14));
    // the crane: its tube along the hinge and the yoke to the cylinder's front
    const craneTube = latheFwd([[0.0001, CY1 + 0.0005], [0.0034, CY1 + 0.0005], [0.0034, FR1 - 0.001], [0.0001, FR1 - 0.001]], S(lod, 12)).translate(0, 0, Z0);
    const yoke = rbox(0.0068, 0.0068, 0.0058, 0.002, V(0, 0, 0));
    // (the yoke bridges the hinge and the cylinder's axis at the front)
    const yA = V(0, 0, az(CY1 + 0.0035));
    {
      const d = new THREE.Vector3(CYC.x - CRANE.x, CYC.y - CRANE.y, 0);
      const L = d.length();
      yoke.scale(1, 1, 1);
      yoke.applyMatrix4(new THREE.Matrix4().makeScale(1, L / 0.0068 + 0.4, 1));
      yoke.rotateZ(Math.atan2(-d.x, d.y));
      yoke.translate(CRANE.x + d.x / 2, CRANE.y + d.y / 2, yA.z);
    }
    // (the crane's parts are built about the hinge: the group sits there)
    craneTube.translate(0, 0, 0);
    // rounds
    const R = roundGeos(lod);
    const parts = [
      { geo: mergeGeos(steelF), mat: M.steel, id: 0 },
      { geo: mergeGeos(boreF), mat: M.bore, id: 0, cast: false },
      { geo: mergeGeos(woodF), mat: M.wood, id: 1 },
      { geo: mergeGeos(med), mat: M.brass, id: 1, cast: false },
      { geo: hammer, mat: M.steel, id: 2, name: 'hammer', pivot: [HP.x, HP.y, HP.z] },
      { geo: trig, mat: M.steel, id: 0, name: 'trigger', pivot: [TP.x, TP.y, TP.z] },
    ];
    return {
      parts,
      groups: {},
      grip: [0, 0, 0],
      init(g, ud, by) {
        const pieces = (geo, mat, id) => { const m = new THREE.Mesh(geo, mat); m.userData.inkId = ud.inkId + id; m.castShadow = true; m.receiveShadow = true; return m; };
        // the crane: hinged low left, under the cylinder
        const crane = new THREE.Group(); crane.name = 'crane';
        crane.position.set(CRANE.x, CRANE.y, 0);
        g.add(crane);
        const craneM = pieces(mergeGeos([craneTube.clone().translate(0, 0, 0), yoke.clone().translate(-CRANE.x, -CRANE.y, 0)]), M.steel, 3);
        crane.add(craneM);
        // the cylinder turns about its own axis (a group on the axis, in the crane)
        const cylG = new THREE.Group(); cylG.name = 'cyl';
        cylG.position.set(CYC.x - CRANE.x, CYC.y - CRANE.y, Z0);
        crane.add(cylG);
        cylG.add(pieces(cyl, M.steel, 3));
        cylG.add(pieces(mergeGeos(mouths), M.bore, 3));
        const rearM = pieces(mergeGeos(rears), M.bore, 3);
        cylG.add(rearM);
        // the ejector: the star, the rod, and the rounds ride it on the stroke
        const ej = new THREE.Group(); ej.name = 'eject';
        cylG.add(ej);
        ej.add(pieces(star, M.steel, 4));
        const rodM = pieces(rod, M.steel, 4);
        ej.add(rodM);
        // (the rod does not ride the stroke's full length forward: it is the
        // plunger; it stays put while the star comes back) - modelled as one
        // piece moving together; the rod's tip slides in the lug
        // (second pass: the six rounds are two meshes - the cases, the lead
        // noses - rebuilt when a chamber changes, not twelve: ten fewer draw
        // calls for the gun in hand)
        const caseOne = mergeGeos([R.cas, R.primer]);
        const at = (i, geo) => { const th = i * Math.PI / 3; return geo.clone().translate(-Math.sin(th) * CR, Math.cos(th) * CR, -CY0); };
        const casesM = pieces(new THREE.BufferGeometry(), M.brass, 5); casesM.name = 'cases';
        const nosesM = pieces(new THREE.BufferGeometry(), M.lead, 5); nosesM.name = 'noses';
        ej.add(casesM, nosesM);
        let roundsKey = '';
        const buildRounds = () => {
          const key = ud.chambers.join();
          if (key === roundsKey) return;
          roundsKey = key;
          const cs = [], ns = [];
          for (let i = 0; i < 6; i++) {
            if (ud.chambers[i] !== 'empty') cs.push(at(i, caseOne));
            if (ud.chambers[i] === 'live') ns.push(at(i, R.bullet));
          }
          for (const [m, list] of [[casesM, cs], [nosesM, ns]]) {
            m.geometry.dispose();
            m.geometry = list.length ? mergeGeos(list) : new THREE.BufferGeometry();
            m.visible = list.length > 0;
          }
        };
        Object.assign(by, { crane, cyl: cylG, eject: ej });
        ud.chambers = ['live', 'live', 'live', 'live', 'live', 'live'];
        buildRounds();
        ud.open = 0; ud.turn = 0; ud.hammer = 0; ud.trigger = 0; ud.eject = 0;
        // the crane swings the cylinder out to the left and a little down
        ud.setOpen = (k) => { ud.open = Math.max(0, Math.min(1, k)); crane.rotation.z = ud.open * 1.42; };
        ud.setTurn = (a) => { ud.turn = a; cylG.rotation.z = -a; };
        ud.setHammer = (k) => { ud.hammer = k; by.hammer.rotation.x = k * 0.62; };
        ud.setTrigger = (k) => { ud.trigger = k; by.trigger.rotation.x = k * 0.28; };
        // the stroke: the star comes back 17 mm, the rounds with it
        ud.setEject = (k) => { ud.eject = k; ej.position.z = k * 0.017; };
        ud.setChambers = (arr) => {
          for (let i = 0; i < 6; i++) ud.chambers[i] = arr[i] || 'empty';
          buildRounds();
        };
        // a chamber's rear mouth, gun-local (as the cylinder stands now)
        ud.chamberAt = (i, out = new THREE.Vector3()) => {
          g.updateMatrixWorld(true);
          const th = i * Math.PI / 3;
          out.set(-Math.sin(th) * CR, Math.cos(th) * CR, 0).applyMatrix4(cylG.matrixWorld);
          return out.applyMatrix4(new THREE.Matrix4().copy(g.matrixWorld).invert());
        };
        ud.muzzle = V(0, BORE, az(MUZ));
        ud.frontSight = V(0, BORE + 0.0156, az(MUZ - 0.006));
        ud.rearSight = V(0, BORE + 0.0149, az(-0.012));
        ud.cylRear = V(0, CA, Z0);
        ud.dims = { BORE, CA, CR, CYL_R, Z0, CY1, FR1, MUZ };
        // (a held revolver keeps a contour between its parts: Hands gives
        // it consecutive viewmodel ids, one per part id)
        ud.vmPartIds = 6;
        ud.setHammer(1);
      },
      // (how it lies on a table: on its right side, the grip toward +x)
      rest: new THREE.Matrix4().makeRotationZ(Math.PI / 2).setPosition(0.0165, 0.052, 0),
    };
  },

  // the loose rounds in the left hand: up to six in two rows, noses down;
  // the front pair pinched at the fingertips (the socket's point), the
  // others in the curl of the fingers behind them
  roundsHand(v, lod) {
    const M = mats();
    const R = roundGeos(lod);
    const one = mergeGeos([R.cas, R.primer]);
    return {
      parts: [{ geo: new THREE.BufferGeometry(), mat: M.brass, id: 0 }],
      grip: [0, 0, 0],
      init(g, ud) {
        g.clear();
        const list = [];
        // the pair: side by side 11.8 mm apart (two chambers' spacing),
        // their heads up (+z of the round is its head: stood noses down)
        const at = [[-0.0059, 0, 0], [0.0059, 0, 0], [-0.0059, -0.001, 0.011], [0.0059, -0.001, 0.011], [-0.0059, -0.002, 0.022], [0.0059, -0.002, 0.022]];
        for (let i = 0; i < 6; i++) {
          const rg = new THREE.Group();
          const c = new THREE.Mesh(one, M.brass); c.userData.inkId = ud.inkId;
          const b = new THREE.Mesh(R.bullet, M.lead); b.userData.inkId = ud.inkId;
          rg.add(c, b);
          // (a round along its own -z from its head: laid with its head up
          // the socket's +y; the pair's heads at y = 0)
          rg.rotation.x = -Math.PI / 2;
          rg.position.set(...at[i]);
          g.add(rg);
          list.push(rg);
        }
        ud.count = 6;
        // (the front pair goes in first: n rounds left are the rear ones,
        // moved up to the front as the hand feeds them)
        ud.setCount = (n) => { ud.count = n; list.forEach((r, i) => { r.visible = i < n; }); };
      },
    };
  },
};

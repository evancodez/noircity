import * as THREE from 'three';
import { Colliders } from '../../../world/Colliders.js';
import { arch } from '../arch.js';
import { lathe, tube, V3, roundedBox } from '../../../world/geom.js';
import { ROOFS, LOADING, TANNER, PASSAGE, MERCER } from '../plan.js';

// The roof row over the loading yard (lane C6): R1, two storeys, its tar
// roof behind a low parapet, chimneys, a skylight, the party wall between
// its two houses; the light well between it and R2 (the jump); R2, lower,
// its roof falling to the west, the motor house and the big skylight that
// funnel a man onto the water tank's legs; the shed's steep lean-to roof
// down to Mercer Street's pavement; the iron stair up R1's south face from
// the loading yard. Below, the row's backs on Tanner's Row.
//   stage.roofColliders   the walls of the roof level (parapets, chimneys,
//                         the stair's rails): the run mode walks there with
//                         these instead of the ground's (whose buildings
//                         would hold it out of the row's footprint)
//   stage.surfaceY        the roofs', the stair's and the shed's heights
//   api.roofY(x, z)       the roof surface there, or undefined
// [C11, after the critic] wired glass lit from the workshop below, one bay
// (u across the bay, v eave -> ridge): a glow in the bay's middle low down,
// dimmer toward its bars and up toward the ridge, the wire mesh faint over it
function skylightMap() {
  const CW = 128, CH = 128;
  const c = document.createElement('canvas'); c.width = CW; c.height = CH;
  const g = c.getContext('2d');
  g.fillStyle = 'rgb(70,70,70)'; g.fillRect(0, 0, CW, CH);
  const lg = g.createRadialGradient(CW * 0.5, CH * 0.62, 0, CW * 0.5, CH * 0.62, CW * 0.62);
  lg.addColorStop(0, 'rgba(250,250,250,1)'); lg.addColorStop(0.45, 'rgba(200,200,200,0.85)'); lg.addColorStop(1, 'rgba(70,70,70,0)');
  g.fillStyle = lg; g.fillRect(0, 0, CW, CH);
  // (toward the ridge the glass looks at the sky, not down into the room)
  const vg = g.createLinearGradient(0, 0, 0, CH * 0.35);
  vg.addColorStop(0, 'rgba(40,40,40,0.8)'); vg.addColorStop(1, 'rgba(40,40,40,0)');
  g.fillStyle = vg; g.fillRect(0, 0, CW, CH * 0.35);
  g.strokeStyle = 'rgba(30,30,30,0.35)'; g.lineWidth = 1;
  for (let i = 8; i < CW; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, CH); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(CW, i); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

export default {
  name: 'roofs', order: 63,
  build(stage) {
    const A = arch(stage, 6363);
    const { MAT, K, face, fbox, facade, mass } = A;
    const R = ROOFS, P = R.parapet, PW = R.pw;
    const RC = stage.roofColliders = new Colliders();
    const rbox = (x0, x1, z0, z1, tag = 'roof') => RC.addBox((x0 + x1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0) / 2, Math.abs(z1 - z0) / 2, 0, tag);
    const api = { MAT, colliders: RC };

    // ---- R1: two storeys, the tar roof at 7.2 -----------------------------------------
    {
      const g = 'r1', r = R.R1;
      mass(g, MAT.brick, r.x0, r.x1, R.z0, R.z1, r.y);
      facade(g, face('z', R.z1, 1), r.x0, r.x1, r.y, { bay: 3.1, litP: 0.08, cornice: false, skip: [[r.x0, 50.2]] });
      facade(g, face('z', R.z0, -1), r.x0, r.x1, r.y, { bay: 3.1, litP: 0.1, cornice: false, pipes: [52.4, 66.8] });
      facade(g, face('x', r.x1, 1), R.z0, R.z1, r.y, { bay: 2.6, litP: 0.1, cornice: false });
      // the roof's tar, the parapets with their coping (the coping pale where
      // a man goes over it: the jump's edge is things.js's)
      K.box(g, MAT.tar, r.x0, r.x1, r.y - 0.04, r.y, R.z0, R.z1);
      const par = (x0, x1, z0, z1) => { K.box(g, MAT.brick, x0, x1, r.y, r.y + P, z0, z1); K.box(g, MAT.trim, x0 - 0.03, x1 + 0.03, r.y + P, r.y + P + 0.06, z0 - 0.03, z1 + 0.03); rbox(x0, x1, z0, z1); };
      par(r.x0, R.stair.top, R.z1 - PW, R.z1);           // south, west of the stair's landing
      par(R.stair.x0, r.x1, R.z1 - PW, R.z1);            // south, east of it
      par(r.x0, r.x1, R.z0, R.z0 + PW);                  // north
      par(r.x1 - PW, r.x1, R.z0, R.z1);                  // east
      // chimney stacks: brick, a coping, pots
      // ([C11] a stack 2.7 m over the roof, its coping and pots on top: mass()
      // takes a height, and r.y + 1.7 made each a 8.9 m black column with
      // its coping and pots buried in it - now over a man's head, the stacks
      // and pots stand against the sky's fog; their colliders are the same)
      const CH = 2.7;
      for (const [x, z] of R.chimneys) {
        mass(g, MAT.brickDark, x - 0.55, x + 0.55, z - 0.4, z + 0.4, CH, r.y, false);
        K.box(g, MAT.trim, x - 0.62, x + 0.62, r.y + CH, r.y + CH + 0.12, z - 0.47, z + 0.47);
        for (const dx of [-0.25, 0.25]) K.add(g, MAT.metal, lathe([[0, 0], [0.13, 0], [0.11, 0.35], [0.14, 0.42], [0, 0.42]], 14).translate(x + dx, r.y + CH + 0.12, z));
        rbox(x - 0.55, x + 0.55, z - 0.4, z + 0.4, 'chimney');
      }
      // the skylight over the stairwell (glass in iron frames, lit from below)
      {
        const s = R.skylight, y = r.y;
        K.box(g, MAT.brickDark, s.x - s.w / 2, s.x + s.w / 2, y, y + 0.35, s.z - s.d / 2, s.z + s.d / 2);
        const glass = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.1, 1.1, 1.1) });
        for (const sg of [-1, 1]) {
          const geo = new THREE.PlaneGeometry(s.d, s.w * 0.56).rotateY(Math.PI / 2).rotateZ(sg * 0.95).translate(s.x + sg * s.w * 0.24, y + 0.35 + 0.22, s.z);
          K.add(g + 'Sky', glass, geo, { cast: false, noRay: true });
        }
        for (let z = s.z - s.d / 2; z <= s.z + s.d / 2 + 0.01; z += s.d / 4) K.add(g, MAT.iron, tube([V3(s.x - s.w / 2, y + 0.36, z), V3(s.x, y + s.h, z), V3(s.x + s.w / 2, y + 0.36, z)], 0.018, 5, 4));
        // (its collider is the thing's: things.js, so a vault over it can clear it)
      }
      // a roof door's little house by the north parapet (a bulb over its door)
      // ([C11] 2.4 m high, as its door and its bulb are: r.y + 2.4 was a 9.6 m tower)
      mass(g, MAT.brickDark, 64.6, 67.4, R.z0 + PW, R.z0 + 2.6, 2.4, r.y, false);
      K.box(g, MAT.trim, 64.55, 67.45, r.y + 2.4, r.y + 2.48, R.z0 + PW - 0.05, R.z0 + 2.65);
      fbox(g, MAT.woodDark, face('z', R.z0 + 2.6, 1), 65.4, 66.6, r.y + 0.05, r.y + 2.0, 0, 0.04);
      rbox(64.6, 67.4, R.z0 + PW, R.z0 + 2.6, 'roofhouse');
    }
    // ---- the light well between R1 and R2: its walls at the ground, a chained gate on Tanner's Row
    {
      const gp = R.gap;
      K.box('well', MAT.brickDark, gp.x0, gp.x1, 0, 3.0, R.z1 - 0.3, R.z1);
      K.collide(gp.x0, gp.x1, R.z1 - 0.3, R.z1, 'wall');
      // (the gate: iron bars, chained)
      const zg = R.z0;
      for (let x = gp.x0 + 0.12; x < gp.x1 - 0.05; x += 0.14) K.add('well', MAT.iron, tube([V3(x, 0, zg), V3(x, 2.4, zg)], 0.014, 5, 2));
      for (const y of [0.25, 1.2, 2.3]) K.box('well', MAT.iron, gp.x0, gp.x1, y - 0.025, y + 0.025, zg - 0.02, zg + 0.02);
      K.add('well', MAT.metal, tube([V3(42.5, 1.05, zg - 0.06), V3(42.75, 1.0, zg - 0.08), V3(42.9, 1.1, zg - 0.06), V3(42.8, 1.2, zg - 0.04)], 0.02, 5, 8));
      K.collide(gp.x0, gp.x1, zg - 0.08, zg + 0.08, 'gate');
      // the well's floor: black water in a drain, rubbish
      K.box('well', MAT.black, gp.x0 + 0.1, gp.x1 - 0.1, 0.0, 0.02, R.z0 + 0.2, R.z1 - 0.4);
    }
    // ---- R2: lower, its roof falling west from 5.6 to 5.0 -------------------------------
    const r2Y = (x) => R.R2.yW + (R.R2.yE - R.R2.yW) * Math.min(1, Math.max(0, (x - R.R2.x0) / (R.R2.x1 - R.R2.x0)));
    {
      const g = 'r2', r = R.R2;
      mass(g, MAT.brickDark, r.x0, r.x1, R.z0, R.z1, r.yW);
      // the roof: a slab sloping down to the west, under it the wedge of brick
      const slab = new THREE.BoxGeometry(r.x1 - r.x0, 0.1, R.z1 - R.z0);
      const pa = slab.getAttribute('position');
      for (let i = 0; i < pa.count; i++) { const x = pa.getX(i) + (r.x0 + r.x1) / 2; pa.setY(i, pa.getY(i) + r2Y(x) - 0.05); }
      slab.translate((r.x0 + r.x1) / 2, 0, (R.z0 + R.z1) / 2);
      slab.computeVertexNormals();
      K.add(g, MAT.tar, slab);
      for (const z of [R.z0, R.z1]) {
        const wedge = new THREE.BufferGeometry();
        const zz = z === R.z0 ? R.z0 : R.z1;
        wedge.setAttribute('position', new THREE.Float32BufferAttribute([r.x0, r.yW, zz, r.x1, r.yW, zz, r.x1, r.yE, zz], 3));
        wedge.computeVertexNormals();
        K.add(g, stage.M.brickFar, wedge);
      }
      K.box(g, MAT.brickDark, r.x1 - 0.3, r.x1, r.yW, r.yE, R.z0, R.z1);
      facade(g, face('z', R.z0, -1), r.x0, r.x1, r.yW, { bay: 3.0, litP: 0.12, cornice: false, course: false });
      // the parapets: north, south, and the east (the jump lands over it)
      const par = (x0, x1, z0, z1, y0) => { K.box(g, MAT.brickDark, x0, x1, y0, y0 + P, z0, z1); K.box(g, MAT.trim, x0 - 0.03, x1 + 0.03, y0 + P, y0 + P + 0.06, z0 - 0.03, z1 + 0.03); rbox(x0, x1, z0, z1); };
      for (let x = r.x0; x < r.x1 - 0.01; x += 1.9) {
        const x1 = Math.min(r.x1, x + 1.9);
        par(x, x1, R.z1 - PW, R.z1, r2Y(x));
        par(x, x1, R.z0, R.z0 + PW, r2Y(x));
      }
      // (the east parapet is the jump's landing edge: things.js puts it and
      // its pale coping, so a catch puts the hands on it)
      // the motor house and the big skylight's box that funnel the run onto the tank
      for (const [x, z, w, d, h] of R.boxes) {
        const y = r2Y(x);
        mass(g, MAT.brick, x - w / 2, x + w / 2, z - d / 2, z + d / 2, h, y - 0.2, false);
        K.box(g, MAT.trim, x - w / 2 - 0.05, x + w / 2 + 0.05, y - 0.2 + h, y + h - 0.1, z - d / 2 - 0.05, z + d / 2 + 0.05);
        rbox(x - w / 2, x + w / 2, z - d / 2, z + d / 2, 'roofbox');
      }
      // [C11] the big skylight's glass on its box, lit from the workshop
      // under it: a pale ridge of panes across R2 seen from R1's roof (a lit
      // skylight or two among the black roofs). ([C11, after the critic] the
      // panes lie on the iron's own pitch - eave to ridge, the glazing bars
      // on them, a ridge bar and the eave bars - where they were a steep tent
      // the shallow ribs cut across; and the glass is wired glass lit from
      // below - a glow in each bay, darker toward its bars and the ridge -
      // not a flat white card)
      {
        const [x, z, w, d, h] = R.boxes[1];
        const yt = r2Y(x) - 0.2 + h - 0.1;
        const ex = w / 2 - 0.05, eY = yt + 0.02, rY = yt + 0.5, za = z - d / 2 + 0.1, zb = z + d / 2 - 0.1, bays = 4;
        const glass = new THREE.MeshBasicMaterial({ color: 0xffffff, map: skylightMap(), side: THREE.DoubleSide });
        glass.map.repeat.set(bays, 1);
        for (const sg of [-1, 1]) {
          // (u along the ridge, v from the eave up to it)
          const geo = new THREE.BufferGeometry();
          const xe = x + sg * ex;
          geo.setAttribute('position', new THREE.Float32BufferAttribute([xe, eY, za, xe, eY, zb, x, rY, zb, x, rY, za], 3));
          geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
          geo.setIndex(sg < 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]);
          geo.computeVertexNormals();
          K.add(g + 'Sky', glass, geo, { cast: false, noRay: true });
        }
        // the bars: rafters at each bay's edge (a hair over the glass), the
        // ridge and the two eaves
        const lift = 0.012;
        for (let i = 0; i <= bays; i++) {
          const zz = za + (zb - za) * i / bays;
          K.add(g, MAT.iron, tube([V3(x - ex, eY + lift, zz), V3(x, rY + lift, zz), V3(x + ex, eY + lift, zz)], 0.02, 5, 2));
        }
        K.add(g, MAT.iron, tube([V3(x, rY + lift, za - 0.04), V3(x, rY + lift, zb + 0.04)], 0.028, 6, 2));
        for (const sg of [-1, 1]) K.add(g, MAT.iron, tube([V3(x + sg * ex, eY + lift, za - 0.04), V3(x + sg * ex, eY + lift, zb + 0.04)], 0.024, 5, 2));
      }
      // the shed's walls below the lean-to, its side walls up to the slope
      const s = R.shed, sz0 = -113.4, sz1 = -108.6;
      mass('shed', MAT.brickDark, s.x0, s.x1, R.z0, R.z1, s.yEave - 0.1);
      for (const z of [R.z0, R.z1]) {
        // the parts of the row's end beside the shed's slope: R2's wall comes on down to the eave's height
        K.box('shed', MAT.brickDark, s.x0, s.x1, s.yEave - 0.1, s.yTop + 0.5, z === R.z0 ? R.z0 : sz1, z === R.z0 ? sz0 : R.z1);
        rbox(s.x0 - 0.2, s.x1, z === R.z0 ? R.z0 : sz1, z === R.z0 ? sz0 : R.z1, 'shedwall');
      }
      // R2's west parapet either side of the shed's head
      par(r.x0 - 0.0, r.x0 + PW, R.z0, sz0, r.yW);
      par(r.x0 - 0.0, r.x0 + PW, sz1, R.z1, r.yW);
      facade('shed', face('x', s.x0, -1), R.z0, R.z1, s.yTop + 0.5, { bay: 2.8, from: 0, litP: 0, cornice: false, course: false, skip: [[sz0 - 0.2, sz1 + 0.2]] });
      // the lean-to: slates on rafters, steep (a man slides down it)
      {
        const slope = new THREE.BoxGeometry(Math.hypot(s.x1 - s.x0, s.yTop - s.yEave) + 0.3, 0.08, sz1 - sz0 + 0.3);
        slope.rotateZ(Math.atan2(s.yTop - s.yEave, s.x1 - s.x0));
        slope.translate((s.x0 + s.x1) / 2 - 0.12, (s.yTop + s.yEave) / 2 - 0.02, (sz0 + sz1) / 2);
        K.add('shedRoof', MAT.tar, slope);
        // its gutter at the eave (pale: what the eye slides off)
        K.add('shedRoof', MAT.metal, tube([V3(s.x0 - 0.12, s.yEave - 0.06, sz0 - 0.1), V3(s.x0 - 0.12, s.yEave - 0.06, sz1 + 0.1)], 0.06, 8, 2));
      }
      // the coal yard's heap below the eave on the pavement: soft ground to come down on
      K.add('shed', MAT.black, new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.9, 0.35, 1.6).translate(25.6, 0.15, -111.0));
    }
    // ---- the tank on R2: an iron tank on four legs over the funnel ---------------------
    {
      const t = R.tank, y = r2Y(t.x), z = -111.0;
      const top = y + t.under + 1.4;
      K.add('tank', MAT.iron, new THREE.CylinderGeometry(1.25, 1.25, 1.4, 24).translate(t.x, y + t.under + 0.7, z));
      K.add('tank', MAT.iron, lathe([[0, 0.3], [0.7, 0.25], [1.3, 0.0]], 24).translate(t.x, top, z));
      for (const [dx, dz] of [[-1.0, -1.0], [1.0, -1.0], [-1.0, 1.0], [1.0, 1.0]]) {
        K.add('tank', MAT.iron, tube([V3(t.x + dx, y, z + dz), V3(t.x + dx * 0.8, y + t.under, z + dz * 0.8)], 0.06, 6, 2));
        rbox(t.x + dx - 0.08, t.x + dx + 0.08, z + dz - 0.08, z + dz + 0.08, 'leg');
      }
      // (the tank's underside is the slide's pale edge: things.js)
    }
    // ---- the stair up R1's south face --------------------------------------------------
    {
      const S = R.stair, y1 = R.R1.y;
      const F = face('z', R.z1, 1);
      // (its centre line 0.65 m out from the wall)
      const dd = R.z1 - S.z + 0.0;
      A.flight('stair', F, S.x1, 0, S.x0, y1, Math.abs(S.z - R.z1), S.w, { rails: 1 });
      // its head's landing at the parapet's gap
      A.landing('stair', F, S.top, S.x0 + 0.1, y1, 1.0, { rail: false });
      fbox('stair', MAT.iron, F, S.top - 0.03, S.top + 0.02, y1, y1 + 1.0, 0, 1.0);
      fbox('stair', MAT.iron, F, S.top, S.x0, y1 + 0.96, y1 + 1.0, 0.95, 1.0);
      // (the ground's: the space under the stair is boxed in, its foot open)
      K.box('stair', MAT.woodDark, S.top, S.x1 - 3.5, 0, 1.9, S.z - S.w / 2, S.z + S.w / 2 - 0.25);
      K.collide(S.top, S.x1 - 3.4, S.z - S.w / 2 - 0.05, S.z + S.w / 2 + 0.05, 'stairbox');
      // (the roof level's: the stair's rails, the landing's rails)
      rbox(S.top, S.x1, S.z + S.w / 2, S.z + S.w / 2 + 0.06, 'stairrail');
      rbox(S.top - 0.06, S.top, R.z1, S.z + S.w / 2 + 0.06, 'stairrail');
      void dd;
    }
    // ---- the alley under the roofs: the row's backs, the north blocks' fronts are build.js's
    {
      const g = 'rowBack';
      // R1's and R2's north faces on Tanner's Row have windows (R1: facade
      // above); R2's ground floor: a workshop's shut doors
      A.door(g, face('z', R.z0, -1), 34.6, 2.4, 2.8);
      A.door(g, face('z', R.z0, -1), 57.6, 1.2, 2.3);
      A.door(g, face('z', R.z0, -1), 66.0, 1.1, 2.2);
    }
    // ---- the walking surfaces ------------------------------------------------------------
    const S = R.stair, y1 = R.R1.y;
    const roofY = (x, z) => {
      // the stair (a ramp along its centre line), and its landing
      if (z > S.z - S.w / 2 - 0.02 && z < S.z + S.w / 2 + 0.02) {
        if (x >= S.top - 0.02 && x <= S.x0) return y1;
        if (x > S.x0 && x <= S.x1 + 0.02) return y1 * (S.x1 - x) / (S.x1 - S.x0);
      }
      // the landing's step through the parapet's gap onto R1
      if (x >= S.top - 0.02 && x <= S.x0 + 0.02 && z >= R.z1 - 0.3 && z <= S.z + S.w / 2) return y1;
      if (z < R.z0 || z > R.z1) return undefined;
      if (x >= R.R1.x0 && x <= R.R1.x1) return y1;
      if (x >= R.R2.x0 && x <= R.R2.x1) return r2Y(x);
      const s = R.shed;
      if (x >= s.x0 - 0.05 && x < s.x1 && z > -113.4 && z < -108.6) return s.yEave + (s.yTop - s.yEave) * (x - s.x0) / (s.x1 - s.x0);
      return undefined;
    };
    api.roofY = roofY;
    api.r2Y = r2Y;
    stage.addSurface(roofY);
    // ---- the lamps: a bulb over the roof door, one over the stair's landing; the
    // lit skylight; Tanner's Row: a lamp over the truck's bay, the dog's
    const L = stage.part('lamps');
    api.lamps = {
      roofDoor: L.wall(66.0, y1 + 2.25, R.z0 + 2.6, 0, 1, { out: 0.5, strength: 0.8 }),
      landing: L.wall(S.x0 + 1.4, y1 + 2.3, R.z1, 0, 1, { out: 0.3, strength: 0.9 }),
      // [C6 2nd] the stair's foot, where the alley behind the press hall comes out: lit
      foot: L.wall(S.x1 - 0.6, 3.3, R.z1, 0, 1, { out: 0.35, strength: 0.95 }),
      bay: L.wall(44.4, 4.0, TANNER.z0, 0, 1, { out: 0.35 }),
      dog: L.wall(62.4, 3.6, TANNER.z0, 0, 1, { out: 0.2, strength: 0.85 }),
      rowEnd: L.wall(31.0, 3.8, TANNER.z1, 0, -1, { out: 0.3, strength: 0.9 }),
      passage: L.wall(PASSAGE.x0, 4.0, -110.0, 1, 0, { out: 0.3, strength: 0.85 }),
      // ([C6 3rd] its mouth by the stair's foot lit too: the other way over is
      // plain to see from where the alley comes out - a man who keeps failing
      // the jump sees there is a way round under the roofs)
      passMouth: L.wall(PASSAGE.x1, 3.5, -102.2, -1, 0, { out: 0.4, strength: 0.95 }),
      // the jump: lamps on the taller block's wall over the roofs' south side,
      // one over the light well's near edge, one over the far roof's parapet
      edge: L.wall(46.6, ROOFS.R1.y + 2.7, ROOFS.z1, 0, -1, { out: 0.45, strength: 1.0 }),
      far: L.wall(38.6, ROOFS.R2.yE + 2.9, ROOFS.z1, 0, -1, { out: 0.6, strength: 0.95 }),
      // the funnel on R2: a lamp over the motor house's door lights the tank's legs
      motor: L.wall(35.6, r2Y(35.6) + 2.25, -109.4, 0, -1, { out: 0.55, strength: 0.95 }),
      // the light well: a bare bulb down at its foot and a lit window there -
      // from the roof's edge the gap is a slot of light far below
      well: L.hang(42.7, 3.6, -111.0, { real: false }),
    };
    {
      const Fw = face('x', ROOFS.gap.x0, 1);
      for (const z of [-113.4, -108.6]) {
        fbox('well', MAT.lit, Fw, z - 0.45, z + 0.45, 0.9, 2.3, 0.01, 0.02);
        fbox('well', MAT.trim, Fw, z - 0.55, z + 0.55, 0.82, 0.9, 0, 0.12);
      }
    }
    stage.addLook(new THREE.Box3(V3(28, 4.4, R.z0 - 0.5), V3(70.5, 30, R.z1 + 1.2)), { ambient: 0.2, exposure: 1.02, haze: 0.4 });
    void LOADING; void MERCER; void roundedBox;
    K.flush();
    return api;
  },
};

import * as THREE from 'three';
import { tagInk, allocIronId } from '../render/layers.js';
import { lathe, merge, sweep, V3, smoothNormals } from './geom.js';

// The elevated railway. Everything is generated along one CatmullRomCurve3:
// tapered lathe columns in pairs every SPAN metres, arched spandrel plates
// between consecutive columns (and a portal arch across each pair), riveted
// plate girders with stiffeners (the girders + deck slab are ONE thin solid
// band, girderH tall), cross beams inside it, and an open lattice railing
// (posts every railBay, one X of diagonals per bay, top rail) with the sky
// showing through every triangle.
export const OVERPASS = {
  deckY: 9.5,       // underside of the girders
  girderH: 1.2,     // the SOLID band (girder web + slab) is this tall in total:
                    // a thin dark band against the sky like the reference,
                    // not a slab covering a third of the frame
  railH: 1.3,       // open lattice railing above it (sky between the members)
  railBay: 1.7,     // post spacing; one X of diagonals per bay
  halfW: 3.9,       // column / girder offset from the centre line
  span: 11.5,
  springY: 5.6,
};

const FAR_LOD = 70;

export class Overpass {
  constructor(world) {
    this.world = world;
    const { scene, M } = world;
    this.curve = new THREE.CatmullRomCurve3([
      // near the player it runs ~8 m to the +x side of the avenue (the
      // nearest column pair stands >= 14 m right of the street view, so the
      // el sits back in the upper right like the reference instead of
      // covering the frame), then curves across over the avenue far ahead
      // and away to the left into the mist
      // (the brief's control points + ~2 m more toward +x near the player,
      // tapering out by z = -118: the street camera moved 1.2 m right to put
      // the near lamp left of the towers, and the columns keep their distance)
      V3(50, 0, 170), V3(32, 0, 100), V3(21, 0, 45), V3(15.5, 0, 0), V3(11.8, 0, -40),
      V3(7.3, 0, -80), V3(1, 0, -118), V3(-7.5, 0, -156), V3(-23, 0, -196), V3(-46, 0, -232), V3(-78, 0, -264),
    ], false, 'centripetal');
    this.length = this.curve.getLength();
    this.group = new THREE.Group();
    this.group.name = 'overpass';
    scene.add(this.group);
    this.stations = [];
    this.buildStations(M);
    this.buildDeck(M);
  }

  // arc length whose curve point is nearest the given z (the curve is monotonic in z)
  sAtZ(z) {
    let lo = 0, hi = this.length;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      const pz = this.curve.getPointAt(mid / this.length).z;
      if (pz > z) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  frameAt(s) {
    const u = THREE.MathUtils.clamp(s / this.length, 0, 1);
    const P = this.curve.getPointAt(u);
    const T = this.curve.getTangentAt(u).setY(0).normalize();
    const N = new THREE.Vector3(-T.z, 0, T.x); // right-hand side of travel
    return { P, T, N };
  }

  // (segs: 32 near; the far LOD - Phase 3b - takes 14: at 70 m a 0.7 m
  // column is ~14 px wide and 14 segments deviate < 0.2 px from the circle)
  columnGeo(segs = 32) {
    const D = OVERPASS.deckY;
    // (profile drawn for an 8.8 m deck; the shaft and capital stretch with
    // deckY, the plinth stays its own height)
    const k = D / 8.8;
    const prof = [
      [0.0, 0], [0.66, 0], [0.66, 0.32], [0.54, 0.42], [0.5, 0.86], [0.42, 0.98], [0.37, 1.08],
      [0.33, 2.8 * k], [0.3, 4.4 * k], [0.34, 4.5 * k], [0.34, 4.72 * k], [0.29, 4.8 * k], [0.29, 6.6 * k],
      [0.34, 7.1 * k], [0.44, 7.6 * k], [0.58, 8.1 * k], [0.66, 8.4 * k], [0.7, 8.5 * k], [0.7, D + 0.05], [0.0, D + 0.05],
    ];
    return lathe(prof, segs);
  }

  // Spandrel plate spanning Lc between two column centres, arched underside.
  archPlate(Lc, H, rise, c0, thick, n = 40, bevelSegments = 2) {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const th = (i / n) * Math.PI;
      const u = Lc / 2 - (Lc / 2 - c0) * Math.cos(th);
      const v = rise * Math.pow(Math.sin(th), 0.85);
      pts.push([u, v]);
      s.lineTo(u, v);
    }
    s.lineTo(Lc, 0);
    s.lineTo(Lc, H);
    s.lineTo(0, H);
    s.closePath();
    const plate = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments, curveSegments: 4 });
    plate.translate(0, 0, -thick / 2);
    // intrados flange: a flat band under the arch, wider than the plate
    const path = pts.map(([u, v]) => V3(u, v, 0));
    const flange = sweep(path, [[-0.24, 0], [0.24, 0], [0.24, -0.075], [-0.24, -0.075]], { closed: true, fixedAcross: V3(0, 0, 1), flat: false });
    return merge([smoothNormals(plate, 1e-3), flange]);
  }

  placeLocal(geo, origin, uDir) {
    // local (u along uDir, v up, w = u x up) -> world
    const up = V3(0, 1, 0);
    const w = new THREE.Vector3().crossVectors(uDir, up).normalize();
    const m = new THREE.Matrix4().makeBasis(uDir, up, w).setPosition(origin);
    geo.applyMatrix4(m);
    return geo;
  }

  // Each station (a column pair, its portal arch and the arches to the next)
  // is one mesh, in two levels of detail (Phase 3b performance pass): the
  // full build near the eye, a light one (14-segment columns, 16-point
  // arches, one bevel step: ~1/3 of the triangles) beyond FAR_LOD m, where a
  // station is a fogged silhouette ~100 px tall and the two print the same.
  // Thirty-odd far stations of 5000 triangles each were drawn by the id,
  // reflection and scene passes every frame, most of them a few pixels big.
  buildStations(M) {
    const { colliders } = this.world;
    const O = OVERPASS;
    const col = this.columnGeo();
    const colLo = this.columnGeo(14);
    const count = Math.floor(this.length / O.span);
    const cols = [];
    for (let k = 0; k <= count; k++) {
      const s = k * O.span;
      const f = this.frameAt(s);
      const L = f.P.clone().addScaledVector(f.N, -O.halfW);
      const R = f.P.clone().addScaledVector(f.N, O.halfW);
      cols.push({ s, f, L, R });
    }
    const Hs = O.deckY - O.springY;
    for (let k = 0; k < cols.length; k++) {
      const c = cols[k];
      const build = (lo) => {
        const parts = [];
        const cg = lo ? colLo : col, n = lo ? 16 : 40, bs = lo ? 1 : 2;
        parts.push(cg.clone().translate(c.L.x, 0, c.L.z));
        parts.push(cg.clone().translate(c.R.x, 0, c.R.z));
        // portal arch across the pair
        const across = new THREE.Vector3().subVectors(c.R, c.L);
        const Lx = across.length();
        const portalH = O.deckY + O.girderH - 0.4 - (O.springY + 0.4);
        parts.push(this.placeLocal(this.archPlate(Lx, portalH, Hs - 0.85, 0.3, 0.26, n, bs), V3(c.L.x, O.springY + 0.4, c.L.z), across.normalize()));
        // longitudinal arches to the next station, both sides
        if (k + 1 < cols.length) {
          const nx = cols[k + 1];
          for (const [a, b] of [[c.L, nx.L], [c.R, nx.R]]) {
            const d = new THREE.Vector3().subVectors(b, a);
            const Lc = d.length();
            parts.push(this.placeLocal(this.archPlate(Lc, Hs, Hs - 0.62, 0.3, 0.22, n, bs), V3(a.x, O.springY, a.z), d.normalize()));
          }
        }
        const mesh = new THREE.Mesh(merge(parts), M.iron);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.group.add(mesh);
        return mesh;
      };
      const mesh = build(false), meshLo = build(true);
      const id = allocIronId();
      tagInk(mesh, id);
      tagInk(meshLo, id);
      meshLo.visible = false;
      meshLo.userData.noRay = true;     // (the bullets hit the full build)
      // (the station's centre, for the LOD distance)
      const mid = c.L.clone().add(c.R).multiplyScalar(0.5);
      this.stations.push({ s: c.s, L: c.L, R: c.R, frame: c.f, mesh, meshLo, mid, lo: false });
      if (c.L.z > -140 && c.L.z < 60) {
        colliders.addCircle(c.L.x, c.L.z, 0.66, 'column');
        colliders.addCircle(c.R.x, c.R.z, 0.66, 'column');
      }
    }
  }

  // the planar reflection (half res, emitters only) draws every station in
  // its light build (Pipeline.reflLod)
  reflLod(on) {
    for (const st of this.stations) {
      if (st.lo) continue;
      st.mesh.visible = !on; st.meshLo.visible = on;
    }
  }

  // per step: the far stations take their light build (with 4 m of
  // hysteresis so a station on the boundary never flickers)
  update(camera) {
    const p = camera.position;
    for (const st of this.stations) {
      const d = Math.hypot(st.mid.x - p.x, st.mid.z - p.z);
      const lo = !this.world.lodOff && (st.lo ? d > FAR_LOD - 4 : d > FAR_LOD);
      if (lo !== st.lo) { st.lo = lo; st.mesh.visible = !lo; st.meshLo.visible = lo; }
    }
  }

  buildDeck(M) {
    const O = OVERPASS;
    const step = 1.0;
    const n = Math.floor(this.length / step);
    const left = [], right = [], mid = [];
    for (let i = 0; i <= n; i++) {
      const f = this.frameAt(i * step);
      mid.push(V3(f.P.x, O.deckY, f.P.z));
      left.push(V3(f.P.x - f.N.x * O.halfW, O.deckY, f.P.z - f.N.z * O.halfW));
      right.push(V3(f.P.x + f.N.x * O.halfW, O.deckY, f.P.z + f.N.z * O.halfW));
    }
    // The solid band: plate girders H tall (the deck slab sits inside them),
    // nothing else opaque above deckY + H.
    const H = O.girderH, fw = 0.26, ft = 0.08, wt = 0.05;
    const ibeam = [[-fw, 0], [fw, 0], [fw, ft], [wt, ft], [wt, H - ft], [fw, H - ft], [fw, H], [-fw, H], [-fw, H - ft], [-wt, H - ft], [-wt, ft], [-fw, ft]];
    const parts = [];
    parts.push(sweep(left, ibeam, { flat: true }));
    parts.push(sweep(right, ibeam, { flat: true }));
    // deck slab between the girders
    const hw = O.halfW;
    parts.push(sweep(mid, [[-hw, H - 0.34], [hw, H - 0.34], [hw, H - 0.1], [-hw, H - 0.1]], { flat: true }));
    // lattice railing: a top rail and a light bottom rail on each girder;
    // posts and X-diagonals are instanced below
    const R = O.railH;
    const rail = (pts, y, w, h) => sweep(pts, [[-w, y], [w, y], [w, y + h], [-w, y + h]], { flat: true });
    for (const side of [left, right]) {
      parts.push(rail(side, H + R - 0.08, 0.05, 0.08));   // top rail
      parts.push(rail(side, H, 0.035, 0.05));              // bottom rail on the flange
    }
    const deck = new THREE.Mesh(merge(parts), M.iron);
    deck.castShadow = true;
    deck.receiveShadow = true;
    tagInk(deck, allocIronId());
    this.group.add(deck);
    this.deck = deck;

    // instanced repeats: railing posts + diagonals, web stiffeners, cross beams
    const mk = (geo, mats, mat) => {
      const im = new THREE.InstancedMesh(geo, mat, mats.length);
      mats.forEach((m, i) => im.setMatrixAt(i, m));
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = true;
      im.userData.inkId = allocIronId();
      im.userData.inkPerInstance = false;
      this.group.add(im);
      return im;
    };
    const posts = [], stiff = [], beams = [], braces = [];
    const q = new THREE.Quaternion();
    const up = V3(0, 1, 0);
    // posts 0.08 m every railBay, the full railing height
    const bay = O.railBay;
    for (let s = 0; s < this.length; s += bay) {
      const f = this.frameAt(s);
      q.setFromAxisAngle(up, Math.atan2(f.T.x, f.T.z));
      for (const sign of [-1, 1]) {
        const p = V3(f.P.x + f.N.x * hw * sign, O.deckY + H + R / 2, f.P.z + f.N.z * hw * sign);
        posts.push(new THREE.Matrix4().compose(p, q, V3(1, 1, 1)));
      }
    }
    // one X per bay: two 0.06 m diagonals corner to corner, in the plane of
    // the railing (sky shows through every triangle)
    const diagL = Math.hypot(bay, R - 0.08);
    const tilt = Math.atan2(bay, R - 0.08);
    const bq = new THREE.Quaternion(), tq = new THREE.Quaternion(), yq = new THREE.Quaternion();
    for (let s = bay / 2; s < this.length; s += bay) {
      const f = this.frameAt(s);
      yq.setFromAxisAngle(up, Math.atan2(f.T.x, f.T.z));
      for (const sign of [-1, 1]) {
        const p = V3(f.P.x + f.N.x * hw * sign, O.deckY + H + (R - 0.08) / 2, f.P.z + f.N.z * hw * sign);
        for (const t of [-1, 1]) {
          // local frame of the yaw: +z runs along the track, so tilting
          // about local x leans the (vertical) bar along the railing
          tq.setFromAxisAngle(V3(1, 0, 0), t * tilt);
          bq.copy(yq).multiply(tq);
          braces.push(new THREE.Matrix4().compose(p, bq, V3(1, 1, 1)));
        }
      }
    }
    for (let s = 0; s < this.length; s += 1.6) {
      const f = this.frameAt(s);
      q.setFromAxisAngle(up, Math.atan2(f.T.x, f.T.z));
      for (const sign of [-1, 1]) {
        for (const face of [-1, 1]) {
          const o = hw * sign + face * 0.08;
          const p = V3(f.P.x + f.N.x * o, O.deckY + H / 2, f.P.z + f.N.z * o);
          stiff.push(new THREE.Matrix4().compose(p, q, V3(1, 1, 1)));
        }
      }
    }
    for (let s = 0; s < this.length; s += 2.6) {
      const f = this.frameAt(s);
      q.setFromAxisAngle(up, Math.atan2(f.T.x, f.T.z));
      beams.push(new THREE.Matrix4().compose(V3(f.P.x, O.deckY + 0.2, f.P.z), q, V3(1, 1, 1)));
    }
    mk(new THREE.BoxGeometry(0.06, diagL, 0.06), braces, M.iron);
    mk(new THREE.BoxGeometry(0.08, R, 0.08), posts, M.iron);
    mk(new THREE.BoxGeometry(0.1, H - 0.16, 0.08), stiff, M.iron);
    mk(new THREE.BoxGeometry(hw * 2, 0.36, 0.18), beams, M.ironDark);
  }
}

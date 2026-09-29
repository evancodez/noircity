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
const W3 = (w, h, d) => new THREE.BoxGeometry(w, h, d);

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
      // Past the crossing (fix 5) the el no longer runs through the left
      // row and on through the towers: it turns west over a cross street
      // the row opens for it (world/Facade.js EL_GAP, buildElStreet) and
      // ends at its terminus there: platforms under canopies, buffer stops
      // and a station house on its own columns (buildTerminus). The ring
      // towers stand round the street's far end, clear of it. (The points
      // up to (-7.5, -156) are the accepted curve's: nothing moves for
      // z > -118.)
      V3(7.3, 0, -80), V3(1, 0, -118), V3(-7.5, 0, -156), V3(-25, 0, -167), V3(-40, 0, -170.5), V3(-56, 0, -172),
    ], false, 'centripetal');
    this.length = this.curve.getLength();
    this.group = new THREE.Group();
    this.group.name = 'overpass';
    scene.add(this.group);
    this.stations = [];
    this.buildStations(M);
    this.buildDeck(M);
    this.buildStation(M);
    this.buildTerminus(M);
  }

  // The line's end: a last column pair under the buffer stops, the buffer
  // beam with its two sprung buffers and a lamp, and a small station house
  // beyond them at deck level, brick on an iron frame.
  buildTerminus(M) {
    const O = OVERPASS;
    const end = this.length;
    const f = this.frameAt(end);
    const parts = [], house = [];
    const topY = O.deckY + O.girderH;
    const at = (along, across, y = 0) => V3(f.P.x + f.T.x * along + f.N.x * across, y, f.P.z + f.T.z * along + f.N.z * across);
    const yaw = Math.atan2(f.T.x, f.T.z);
    const put = (g, p) => { g.rotateY(yaw).translate(p.x, p.y, p.z); return g; };
    // the last column pair (and its portal arch) under the end
    for (const s of [-1, 1]) {
      const p = at(-0.6, s * O.halfW);
      parts.push(this.columnGeo(24).translate(p.x, 0, p.z));
    }
    // a deck cap closing the girders' ends
    parts.push(put(new THREE.BoxGeometry(O.halfW * 2 + 0.5, O.girderH, 0.3), at(0.1, 0, O.deckY + O.girderH / 2)));
    // the buffer stop: a beam on two raked struts, two round buffers
    parts.push(put(new THREE.BoxGeometry(2.6, 0.4, 0.35), at(-1.2, 0, topY + 0.75)));
    for (const s of [-0.9, 0.9]) {
      parts.push(put(new THREE.BoxGeometry(0.2, 0.9, 1.4).rotateX(0.5), at(-0.7, s, topY + 0.4)));
      parts.push(put(new THREE.CylinderGeometry(0.2, 0.2, 0.35, 16).rotateX(Math.PI / 2), at(-1.55, s * 0.7, topY + 0.8)));
      parts.push(put(new THREE.CylinderGeometry(0.26, 0.26, 0.06, 16).rotateX(Math.PI / 2), at(-1.75, s * 0.7, topY + 0.8)));
    }
    // the station house beyond: brick walls on the deck's end, a pitched
    // roof, a door onto the platform and a lit window
    const hl = 4.6, hw = O.halfW * 2 + 1.0, hh = 4.0;
    house.push(put(W3(hw, hh, hl), at(hl / 2 + 0.3, 0, topY + hh / 2)));
    house.push(put(W3(hw + 0.5, 0.25, hl + 0.5), at(hl / 2 + 0.3, 0, topY + hh + 0.12)));
    const roof = new THREE.CylinderGeometry(0.01, (hw + 0.8) / 2, 1.8, 4, 1).rotateY(Math.PI / 4).scale(1, 1, (hl + 0.8) / (hw + 0.8));
    house.push(put(roof, at(hl / 2 + 0.3, 0, topY + hh + 1.15)));
    // the house stands on two more column pairs and a floor slab
    for (const a of [4.4]) for (const s of [-1, 1]) { const p = at(a, s * O.halfW); parts.push(this.columnGeo(24).translate(p.x, 0, p.z)); }
    parts.push(put(new THREE.BoxGeometry(hw, O.girderH, hl + 0.4), at(hl / 2 + 0.3, 0, O.deckY + O.girderH / 2)));
    const m = new THREE.Mesh(merge(parts), M.iron);
    m.castShadow = true; m.receiveShadow = true;
    tagInk(m, allocIronId());
    this.group.add(m);
    const hm = new THREE.Mesh(merge(house), M.brickFar || M.iron);
    hm.castShadow = true; hm.receiveShadow = true;
    tagInk(hm, allocIronId());
    this.group.add(hm);
    // the house's lit window facing back up the line, and the lamp on the
    // buffer beam (emitters only: no light of their own)
    const lit = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.9, 0.9) });
    const win = [];
    for (const s of [-1.6, 1.6]) win.push(put(new THREE.PlaneGeometry(0.9, 1.3).rotateY(Math.PI), at(0.28, s, topY + 2.2)));
    win.push(put(new THREE.SphereGeometry(0.12, 12, 8), at(-1.2, 0, topY + 1.1)));
    const wm = new THREE.Mesh(merge(win), lit);
    wm.userData.inkId = hm.userData.inkId;
    wm.userData.noRay = true;
    this.group.add(wm);
    this.terminus = { end, house: hm, frame: f, houseLen: hl + 0.6 };
  }

  // The station at the turn: a platform outside each girder at deck level
  // (s from station 29 to 31), a canopy on slim posts over each, a stair
  // down to the street on the outside of the curve. Iron: drawn black with
  // the el (ids of the el's own class, after its own).
  buildStation(M) {
    const O = OVERPASS;
    // (along the last 46 m of the line, to the buffers)
    const s1 = this.length - 1.8, s0 = s1 - 46;
    const topY = O.deckY + O.girderH - 0.12;
    const parts = [], roof = [];
    const pts = (off, y) => { const out = []; for (let s = s0; s <= s1 + 0.01; s += 1.0) { const f = this.frameAt(s); out.push(V3(f.P.x + f.N.x * off, y, f.P.z + f.N.z * off)); } return out; };
    for (const side of [-1]) {   // (one side platform, on the north: the ring towers stand close to the south)
      const inner = side * (O.halfW + 0.35), outer = side * (O.halfW + 3.2);
      const a = Math.min(inner, outer), b = Math.max(inner, outer);
      // the platform slab: swept along the curve, its edge a thin lip
      parts.push(sweep(pts(0, 0), [[a, topY - 0.25], [b, topY - 0.25], [b, topY], [a, topY]], { flat: true }));
      // a railing on the outer edge, the canopy's posts and roof
      parts.push(sweep(pts(0, 0), [[outer - 0.03, topY + 1.0], [outer + 0.03, topY + 1.0], [outer + 0.03, topY + 1.06], [outer - 0.03, topY + 1.06]], { flat: true }));
      const rp = side * (O.halfW + 2.4);
      for (let s = s0 + 1.5; s < s1; s += 4.2) {
        const f = this.frameAt(s);
        const p = V3(f.P.x + f.N.x * rp, 0, f.P.z + f.N.z * rp);
        parts.push(new THREE.CylinderGeometry(0.06, 0.07, 3.0, 10).translate(p.x, topY + 1.5, p.z));
        const q = V3(f.P.x + f.N.x * outer, 0, f.P.z + f.N.z * outer);
        parts.push(new THREE.CylinderGeometry(0.025, 0.025, 1.0, 6).translate(q.x, topY + 0.5, q.z));
        // the brackets under the slab to the girder
        const g = V3(f.P.x + f.N.x * side * O.halfW, 0, f.P.z + f.N.z * side * O.halfW);
        const mid = g.clone().lerp(q, 0.5);
        const len = g.distanceTo(q);
        const br = new THREE.BoxGeometry(0.08, 0.08, len * 1.1);
        br.rotateX(0.55).rotateY(Math.atan2(q.x - g.x, q.z - g.z)).translate(mid.x, topY - 0.9, mid.z);
        parts.push(br);
      }
      const ra = side * (O.halfW + 0.6), rb = side * (O.halfW + 3.5);
      roof.push(sweep(pts(0, 0), [[Math.min(ra, rb), topY + 3.0], [Math.max(ra, rb), topY + 3.0], [Math.max(ra, rb), topY + 3.12], [Math.min(ra, rb), topY + 3.12]], { flat: true }));
      roof.push(sweep(pts(0, 0), [[rb - 0.04, topY + 2.75], [rb + 0.04, topY + 2.75], [rb + 0.04, topY + 3.0], [rb - 0.04, topY + 3.0]], { flat: true }));
    }
    // the stair on the north side, down to the cross street's pavement
    // from the platform's east end
    {
      const f = this.frameAt(s0 + 30);
      const side = -1;
      const top = V3(f.P.x + f.N.x * side * (O.halfW + 3.2), topY, f.P.z + f.N.z * side * (O.halfW + 3.2));
      const dir = f.T.clone().multiplyScalar(-1);
      const out = V3(f.N.x * side, 0, f.N.z * side);
      const n = 28, run = 0.3, rise = topY / n;
      for (let i = 0; i < n; i++) {
        const p = top.clone().addScaledVector(dir, -i * run).addScaledVector(out, 0.8);
        const t = new THREE.BoxGeometry(1.4, 0.05, 0.32);
        t.rotateY(Math.atan2(dir.x, dir.z)).translate(p.x, topY - i * rise, p.z);
        parts.push(t);
      }
      const a = top.clone().addScaledVector(out, 0.1), b = top.clone().addScaledVector(dir, -n * run).addScaledVector(out, 0.1);
      b.y = 0;
      for (const o of [0, 1.5]) {
        const aa = a.clone().addScaledVector(out, o), bb = b.clone().addScaledVector(out, o);
        const len = aa.distanceTo(bb), mid = aa.clone().lerp(bb, 0.5);
        const st = new THREE.BoxGeometry(0.05, 0.3, len);
        st.lookAt(bb.clone().sub(aa));
        st.translate(mid.x, mid.y, mid.z);
        parts.push(st);
        const rail = new THREE.CylinderGeometry(0.02, 0.02, len, 6).rotateX(Math.PI / 2);
        rail.lookAt(bb.clone().sub(aa));
        rail.translate(mid.x, mid.y + 1.0, mid.z);
        parts.push(rail);
      }
      for (const k of [0.33, 0.66, 1.0]) {
        const p = a.clone().lerp(b, k).addScaledVector(out, 0.75);
        const h = a.y + (b.y - a.y) * k;
        parts.push(new THREE.CylinderGeometry(0.07, 0.08, Math.max(0.2, h), 8).translate(p.x, Math.max(0.1, h / 2), p.z));
      }
    }
    const m = new THREE.Mesh(merge(parts), M.iron);
    m.castShadow = true; m.receiveShadow = true;
    tagInk(m, allocIronId());
    this.group.add(m);
    const r = new THREE.Mesh(merge(roof), M.ironDark);
    r.castShadow = true; r.receiveShadow = true;
    tagInk(r, allocIronId());
    this.group.add(r);
    this.station = { s0, s1, mesh: m, roof: r };
  }

  // Fix 5's proof: every building, prop, lamp and tower box that the deck,
  // a column, the railing or the train's swept path comes within `clear`
  // of. -> [{ what, at: [x, z], s }]  (it must return none)
  clipTest({ clear = 0.6, from = -100 } = {}) {
    const O = OVERPASS, W = this.world;
    const hits = [], seen = new Set();
    const boxes = [], obb = [];
    // buildings: the near one, the far blocks
    boxes.push({ what: 'building:near', x0: -26.2, x1: -10.2, z0: -24, z1: 40, y1: 24 });
    const fac = W.part ? W.part('facade') : W.facade;
    for (const b of (fac && fac.farBlocks) || []) boxes.push({ what: `building:${b.x0.toFixed(0)},${b.z0.toFixed(0)}`, x0: b.x0, x1: b.x1, z0: Math.min(b.z0, b.z1), z1: Math.max(b.z0, b.z1), y1: b.h + 0.6 });
    // towers
    const sk = W.part ? W.part('skyline') : null;
    // (a tower's base tier, turned by its rot: tested in its own frame)
    for (const t of (sk && sk.boxes) || []) obb.push({ tag: 'tower', cx: t.x, cz: t.z, hx: t.hw, hz: t.hd, c: Math.cos(t.rot), s: Math.sin(t.rot), y1: t.h });
    // lamps (posts; the el's own hanging lamps are part of it)
    const lamps = W.part ? W.part('lamps') : null;
    for (const l of (lamps && lamps.lamps) || []) {
      if (l.hanging || l.kind === 'hang' || l.custom) continue;
      const base = l.base0 || l.pos || (l.group && l.group.position) || l.head;
      boxes.push({ what: `lamp:${l.head.x.toFixed(0)},${l.head.z.toFixed(0)}`, x0: Math.min(base.x, l.head.x) - 0.4, x1: Math.max(base.x, l.head.x) + 0.4, z0: Math.min(base.z, l.head.z) - 0.4, z1: Math.max(base.z, l.head.z) + 0.4, y1: l.head.y + 0.6 });
    }
    // props and the block's edges: their colliders (oriented boxes), as
    // things 3.5 m tall
    for (const b of W.colliders.boxes) if (b.tag !== 'column' && b.tag !== 'hood') obb.push(b);
    for (const c of W.colliders.circles) {
      if (c.tag === 'column' || c.tag === 'hood') continue;
      boxes.push({ what: `prop:${c.tag}`, x0: c.x - c.r, x1: c.x + c.r, z0: c.z - c.r, z1: c.z + c.r, y1: 3.5 });
    }
    const test = (x, z, r, y0, y1, s) => {
      for (const b of obb) {
        if (y0 > (b.y1 ?? 3.5)) continue;
        const dx = x - b.cx, dz = z - b.cz;
        const lx = dx * b.c - dz * b.s, lz = dx * b.s + dz * b.c;
        if (Math.abs(lx) < b.hx + r && Math.abs(lz) < b.hz + r) {
          const key = 'prop:' + b.tag + ':' + b.cx.toFixed(0) + ',' + b.cz.toFixed(0);
          if (!seen.has(key)) { seen.add(key); hits.push({ what: key, at: [+x.toFixed(1), +z.toFixed(1)], s: +s.toFixed(1) }); }
        }
      }
      for (const b of boxes) {
        if (y1 < 0 || y0 > b.y1) continue;
        if (x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r) {
          const key = b.what;
          if (!seen.has(key)) { seen.add(key); hits.push({ what: b.what, at: [+x.toFixed(1), +z.toFixed(1)], s: +s.toFixed(1) }); }
        }
      }
    };
    // the deck, the railing and the train's swept path: the whole band from
    // the girders' underside to the train's roof, across the girders
    const sFrom = this.sAtZ(from);
    const trainTop = O.deckY + O.girderH + 4.2;
    for (let s = sFrom; s <= this.length; s += 0.5) {
      const f = this.frameAt(s);
      for (let k = -(O.halfW + 0.3); k <= O.halfW + 0.31; k += 0.5) test(f.P.x + f.N.x * k, f.P.z + f.N.z * k, clear + 0.25, O.deckY, trainTop, s);
    }
    // the station's platforms and canopies, the terminus house
    if (this.station) for (let s = this.station.s0; s <= this.station.s1; s += 0.5) {
      const f = this.frameAt(s);
      for (const k of [-(O.halfW + 3.5), -(O.halfW + 2)]) test(f.P.x + f.N.x * k, f.P.z + f.N.z * k, clear + 0.25, O.deckY, O.deckY + 4.5, s);
    }
    if (this.terminus) {
      const f = this.terminus.frame;
      for (let a = 0; a <= this.terminus.houseLen + 0.01; a += 0.5) for (let k = -(O.halfW + 0.9); k <= O.halfW + 0.91; k += 0.5) test(f.P.x + f.T.x * a + f.N.x * k, f.P.z + f.T.z * a + f.N.z * k, clear + 0.25, O.deckY, O.deckY + 8, this.length + a);
    }
    // the columns
    for (const st of this.stations) {
      if (st.L.z > from) continue;
      for (const c of [st.L, st.R]) test(c.x, c.z, 0.7 + clear, 0, O.deckY, st.s);
    }
    return hits;
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

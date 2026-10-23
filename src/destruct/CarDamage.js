import * as THREE from 'three';
import { FIRE, ATLAS } from '../fx/fxTextures.js';
import { FIRE_COL } from '../fx/Explosion.js';
import { Fire } from '../fx/Fire.js';
import { buildWreck, wreckMaterials, WRECK_DROP } from './Wreck.js';
import { rimMaterial } from './Smash.js';
import { KINDS } from './smashKinds.js';
import { WATER_Y } from '../world/plan.js';
import { SEDAN_SHAPES } from '../world/Cars.js';
import { SURF } from '../util/RayWorld.js';
import { LAYER } from '../render/layers.js';
import { roundedBox } from '../world/geom.js';

// [O6] What a car shows of what it met (lane O6; docs/seams/SMASH.md §3).
// The rule for every car of game.vehicles, mine or theirs, any kind (the
// coupe, the sedan, the truck, the wheels lane's): it is attached the first
// step a car is in the list and dropped (everything it was given put back)
// when the car leaves it.
//   by where it was hit (a knock's point in the car's frame: its corner)
//     a dent (its body pushed in there), the wing crumpled at a corner, the
//     headlamp on that side out, the glass on that side gone (a sedan's),
//     a door hanging on its hinge (a side hit), and at a hard blow - any
//     speed, as lane C3b's wreck - the corner down on its broken spring and
//     the body twisted onto it, glass grains on the road, the bonnet's steam
//   the engine (Car.damage 0 .. 4: Car.hurt, the knocks and the rounds)
//     1.5 steam, 2.5 grey smoke and the power going, 3.3 FIRE: flames at the
//     bonnet's seams and black smoke (the warning: `She's burning. Get out.`
//     when it is mine) and, FUSE s later, the blast (the flash on the wet,
//     the shards, what stands near goes over, a man near is hurt) and the
//     WRECK: a body burnt in a few strokes (destruct/Wreck.js), on its rims,
//     twisted onto its worst corner, burning down to embers; it stays,
//     solid (a wall for a car, a box for a man), never driven again
//   the tyres: a round near a wheel flattens it (that corner down, the
//     grip gone, the wheel pulling to that side; a rim sparks on the road)
//   the tram: on a car in its way it strikes sparks (bump / lean); a man on
//     its rails ahead hears the bell and is told (`The tram. Off the rails.`);
//     met, he is knocked aside and hurt (never carried along)
//   the man on foot: told off a car that burns (`She’s going up. Get back.`)
//     and off a burning wreck's fire (`Too hot. Get back.`); the fail names
//     what did it (why(): the blast, the fire, the tram) and the low line too
//     (lowWarn(): a scene's `lowWarn` - the bed's, the city's)
// A car is never wrecked by one blow from below the fire's step (Car.warnAt).
// The wreck's shell is built, and its programs compiled, with the stage
// (prewarm): built in the blast's frame it was a 100 ms frame (the critic's 5).
// Bullets meet a car as a box in the bullets' world riding with it (its
// hull, ud.prop: { car }) - Smash.bullet sends them here.
export const STEAM = 1.5, SMOKE = 2.5, BURN = 3.3, FUSE = 7, FUSE_HOT = 3;
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion(), _b = new THREE.Box3();
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const CORNER_KEYS = ['fl', 'fr', 'rl', 'rr'];
const GRIP_KEYS = ['fl', 'fr', 'rl', 'rr'];
// (which meshes of a car's body are its skin: a dent pushes them in)
const SKIN = ['paint', 'chrome', 'dark', 'skirt', 'seams', 'trim', 'body'];
// (a sedan's parts world/Cars swaps to its far build: a damaged one keeps its own)
const LODK = ['paint', 'chrome', 'dark', 'rubber', 'white', 'hubs', 'caps', 'seams'];
const WHEELK = ['rubber', 'hubs', 'caps', 'white', 'dark'];
// [O6b] a dent's cap: no vertex further than this from where it was built (m)
const DENT_MAX = 0.12;
// [O6b] where each part of a kind is (model frame: x ahead, y up, z right; m).
// A model may carry its own as model.parts (lane O2's kinds: docs/seams/SMASH.md §3).
//   hood   { x0 (the scuttle: its hinge), x1 (the nose), w (half its width) }
//   door   { x0, x1 (its hinge: the front edge), y0, y1, z (the side's skin) }
//   bumper { x (|x| past this is the bumper), y1 (its top) }
//   wheel  { x: [front, rear], z: [front, rear] (half track), y (hub height), r }
export const PARTS = {
  coupe: { hood: { x0: 0.66, x1: 2.3, w: 0.52 }, door: { x0: -0.92, x1: 0.62, y0: 0.5, y1: 1.12, z: 0.7 }, bumper: { x: 2.42, y1: 0.64 }, wheel: { x: [1.55, -1.55], z: [0.78, 0.76], y: 0.375, r: 0.375 } },
  sedan: { hood: { x0: 0.74, x1: 2.3, w: 0.58 }, door: { x0: -0.29, x1: 0.62, y0: 0.5, y1: 1.1, z: 0.7 }, bumper: { x: 2.42, y1: 0.64 }, wheel: { x: [1.55, -1.55], z: [0.78, 0.76], y: 0.375, r: 0.375 } },
  truck: { hood: { x0: 1.9, x1: 3.2, w: 0.5 }, door: { x0: 0.66, x1: 2.04, y0: 0.95, y1: 2.5, z: 1.05 }, bumper: { x: 3.22, y1: 0.7 }, wheel: { x: [2.4, -2.4], z: [0.95, 0.95], y: 0.46, r: 0.46 } },
};
const DOOR_GEO = new Map();
function doorGeo(L, H) {
  const k = L.toFixed(2) + 'x' + H.toFixed(2);
  if (!DOOR_GEO.has(k)) DOOR_GEO.set(k, roundedBox(L, H, 0.045, 0.02, 2).translate(-L / 2, H / 2, 0));
  return DOOR_GEO.get(k);
}
const _s = new THREE.Vector3(), _p = new THREE.Vector3(), _q3 = new THREE.Quaternion();
let WRECK = null;
// [O6b] a loose part's material: its own with a faint paper rim (a bonnet up, a
// door hanging read by their edge on a black car; made with the stage: prewarm)
const RIMS = new Map();
function rimmed(mat) {
  if (!mat || !mat.isMaterial) return mat;
  if (!RIMS.has(mat)) RIMS.set(mat, rimMaterial(mat, 0.05, false));
  return RIMS.get(mat);
}

export class CarDamage {
  constructor(smash) {
    this.smash = smash;
    this.list = [];
    this.byCar = new Map();
    this.fires = [];
    this.trams = [];
    this.hurtBy = null;          // { by: 'blast' | 'fire' | 'tram', t }: what last hurt the man
  }
  // the wreck's shell and its materials made now, and meshes of them in the
  // stage drawn for its first few steps at a scale of nothing (no pixel, but
  // every pass draws them once: the programs compiled, the GPU's own state
  // for them made, their buffers up - a first blast was 75 ms of render)
  prewarm() {
    const st = this.stage;
    if (!WRECK) WRECK = { B: buildWreck('A', SEDAN_SHAPES, 0), M: wreckMaterials(st.M) };
    if (this._warm) return;
    const g = this._warm = new THREE.Group();
    g.name = 'wreckWarm';
    g.scale.set(0, 0, 0);
    this._warmN = 0;
    for (const [geo, mat] of [[WRECK.B.shell, WRECK.M.shell], [WRECK.B.lines, WRECK.M.lines], [WRECK.B.rims, WRECK.M.rims]]) {
      if (!geo) continue;
      const m = new THREE.Mesh(geo, mat);
      m.frustumCulled = false; m.userData.noRay = true; m.userData.inkId = 1; m.userData.inkFigure = true; m.receiveShadow = true; m.castShadow = false;
      g.add(m);
    }
    // (and twins of what a blast makes the first time it goes - the
    // explosion's charred chunks, a shard's glint - so their programs are
    // compiled with the city's: fx/ keeps its own lazily made materials)
    const chunk = new THREE.Mesh(new THREE.PlaneGeometry(0.01, 0.01), new THREE.MeshBasicMaterial({ color: 0x030303, transparent: true, opacity: 1, depthWrite: true }));
    chunk.userData.inkFigure = true; chunk.userData.noRay = true; chunk.castShadow = false; chunk.frustumCulled = false; chunk.renderOrder = 7;
    const glint = new THREE.Sprite(new THREE.SpriteMaterial({ color: new THREE.Color(3.2, 3.2, 3.2), depthWrite: false, fog: false }));
    glint.userData.noRay = true; glint.frustumCulled = false; glint.layers.set(LAYER.FX); glint.renderOrder = 4;
    g.add(chunk, glint);
    // (the glass's, made at its first break - a pane's cracks, halo and
    // backing, its shards flying and lying, their hairlines: the same
    // materials, or twins of the same make where Glass.js makes its own -
    // a sedan's glass going at the blast was a 52 ms frame three frames on)
    const Gl = st.glass;
    if (Gl && Gl.materials) {
      const gm = Gl.materials();
      const tri = new THREE.PlaneGeometry(0.01, 0.01);
      const seg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0.01, 0, 0)]);
      const fly = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 0.2, metalness: 0.6, envMap: gm.shard.envMap, envMapIntensity: 1.6, emissive: new THREE.Color(0.02, 0.02, 0.02), transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide });
      const rest = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide, fog: false });
      for (const mat of [gm.crack, gm.halo, gm.backing, gm.shard, fly, rest]) for (const L of [LAYER.WORLD, LAYER.FX]) {
        const m = new THREE.Mesh(tri, mat); m.layers.set(L); m.frustumCulled = false; m.userData.noRay = true; g.add(m);
      }
      for (const mat of [new THREE.LineBasicMaterial({ color: new THREE.Color(0.2, 0.2, 0.2), transparent: true, opacity: 0.7, depthWrite: false }), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.85, depthWrite: false })]) {
        const l = new THREE.LineSegments(seg, mat); l.layers.set(LAYER.FX); l.frustumCulled = false; l.userData.noRay = true; g.add(l);
      }
    }
    // [O6b] (the loose parts' rimmed twins of the cars' materials, drawn once with the rest)
    const M = st.M || {};
    const tiny = new THREE.PlaneGeometry(0.01, 0.01);
    for (const k of ['paint', 'paintGrey', 'chrome', 'rubber', 'hubcap', 'whitewall', 'seam', 'black', 'iron']) {
      if (!M[k] || !M[k].isMaterial) continue;
      const m = new THREE.Mesh(tiny, rimmed(M[k])); m.frustumCulled = false; m.userData.noRay = true; m.userData.inkFigure = true; g.add(m);
    }
    this.smash.group.add(g);
  }
  // what the fail says when the man goes down by what this set did (null: not ours)
  why() {
    const h = this.hurtBy, G0 = this.game;
    if (!h || !G0 || G0.time - h.t > 3) return null;
    return h.by === 'fire' ? 'Burnt. Keep off the fire.' : h.by === 'tram' ? 'The tram. Mind the rails.' : 'Too close when she went.';
  }
  // the low line (Game.lowStep's scene `lowWarn`) when it was ours that hurt him
  lowWarn() {
    const h = this.hurtBy, G0 = this.game;
    if (!h || !G0 || G0.time - h.t > 2) return null;
    return h.by === 'tram' ? 'Hurt. Keep off the rails.' : 'Too hot. Get back.';
  }
  get stage() { return this.smash.stage; }
  get game() { return this.smash.stage.game; }

  // ---- attached to a car, dropped from it --------------------------------------------------------
  attach(v) {
    const S = v.spec;
    const D = {
      v, corners: { fl: 0, fr: 0, rl: 0, rr: 0 }, dents: { fl: 0, fr: 0, rl: 0, rr: 0 }, smashed: new Set(), lampOut: [false, false],
      tyres: [0, 0, 0, 0], state: 'whole', acc: { steam: 0, smoke: 0, flame: 0, rim: 0, spark: 0 }, fuse: null, fire: null, door: null,
      geo0: new Map(), hidden: [], added: [], proxy: null, entry: null, sagP: 0, sagR: 0, crushP: 0, crushR: 0, knockT: 0, t: 0,
      // [the user's must: car damage, physical within reason] my own build of a skin mesh, the parts cut out of it
      mine: new Map(), orig: new Map(), cutGeos: [], hood: null, doors: [null, null], bumper: [null, null], wob: [null, null, null, null], hub: [0, 0, 0, 0], pull0: 0, sparkT: 0, grindT: 0,
      top: S.top ?? (v.kind === 'truck' ? 3.0 : 1.75), panesHit: new Map(),
    };
    v.smashD = D;
    // (never wrecked by one blow from below the fire: the warning first)
    if (v.warnAt == null) v.warnAt = BURN;
    v.on('crash', (e) => this.knock(D, e, 1));
    v.on('scrape', (e) => this.knock(D, e, 0.35));
    v.on('bump', (e) => { if (e.by && e.by.kind === 'tram') this.tramSparks(e.point, e.k ?? 0.6, D); this.knock(D, { point: e.point, k: e.k ?? 0.3, n: e.n }, 0.8); });
    v.on('lean', (e) => { if (e.by && e.by.kind === 'tram') this.tramSparks(e.point, 0.3, D); });
    v.on('post', (e) => this.knock(D, { point: new THREE.Vector3(e.thing.x, 0.6, e.thing.z), k: e.k ?? 0.5 }, 0.35));
    // the tram's own contacts (a car it shoves: Car.contact on the car finds the tram as `o` and tells it 'bump')
    if (v.kind === 'tram') v.on('bump', (e) => this.tramSparks(e.point, e.k ?? 0.6, null));
    this.addProxy(D);
    this.list.push(D);
    this.byCar.set(v, D);
    return D;
  }
  detach(D) {
    const v = D.v;
    for (const [m, g0] of D.geo0) { const g = D.mine.get(m); m.geometry = g0; if (g) g.dispose(); }
    D.geo0.clear(); D.mine.clear(); D.orig.clear();
    for (const g of D.cutGeos) g.dispose();
    D.cutGeos.length = 0;
    if (v.car) delete v.car.own;
    for (const m of D.hidden) m.visible = true;
    for (const o of D.added) { if (o.parent) o.parent.remove(o); }
    if (D.fire) { const i = this.stage.cars && this.stage.cars.fires ? this.stage.cars.fires.indexOf(D.fire) : -1; if (i >= 0) this.stage.cars.fires.splice(i, 1); D.fire.dispose(); }
    if (D.proxy) { this.stage.removeSolid(D.proxy); if (D.proxy.parent) D.proxy.parent.remove(D.proxy); }
    v.sagPitch = 0; v.sagRoll = 0; v.pull = 0; v.power = 1;
    for (const k of GRIP_KEYS) v.grip[k] = 1;
    if (v._sinking) { v._sinking = null; v.onPose = null; }
    v.body.visible = true;
    delete v.smashD;
    const i = this.list.indexOf(D); if (i >= 0) this.list.splice(i, 1);
    this.byCar.delete(v);
  }

  // the bullets' box of a car: its hull, riding with it
  addProxy(D) {
    const S = this.stage, v = D.v;
    if (!S.rays || v.kind === 'tram') return;
    const m = new THREE.Mesh(this.smash.proxyGeo, this.smash.proxyMat);
    m.visible = false;
    m.userData.prop = { carD: D };
    m.userData.surf = SURF.CAR;
    m.scale.set(v.spec.halfL * 2 * 0.97, D.top - 0.3, v.spec.halfW * 2 * 0.97);
    m.position.set(0, 0.3 + (D.top - 0.3) / 2, 0);
    v.body.add(m);
    D.proxy = m;
    v.body.updateMatrixWorld(true);
    S.addSolid(m);
    D.entry = S.rays.entries.find((e) => e.mesh === m) || null;
  }
  syncProxy(D) {
    const e = D.entry, m = D.proxy;
    if (!e || !m) return;
    m.updateMatrixWorld(true);
    e.mw.copy(m.matrixWorld); e.inv.copy(m.matrixWorld).invert(); e.inv3.setFromMatrix4(e.inv);
    const g = m.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    _b.copy(g.boundingBox).applyMatrix4(m.matrixWorld);
    e.min.copy(_b.min); e.max.copy(_b.max);
  }

  // ---- what it met ---------------------------------------------------------------------------------
  // a knock (a crash, a scrape, a bump, a post): at its corner, by how hard
  knock(D, e, w) {
    if (!e || !e.point || D.state === 'wreck') return;
    const v = D.v, l = v.local(e.point, _v);
    const S = v.spec;
    const k = Math.min(1, (e.k ?? 0.4)) * w;
    if (k < 0.05) return;
    const c = (l.x >= 0 ? 'f' : 'r') + (l.z >= 0 ? 'r' : 'l');
    // [O6b] (a contact held - a car leaning on another, pushing it - tells it
    // every step: within a third of a second only what is harder than the last
    // counts, so a slow shove dents and never smashes a corner)
    const lk = D.lastK || (D.lastK = {}), L0 = lk[c], t = D.t;
    const add = L0 && t - L0.t < 0.33 ? Math.max(0, k - L0.k) : k;
    if (!L0 || t - L0.t >= 0.33 || k > L0.k) lk[c] = { t, k };
    if (add <= 0.01) return;
    D.corners[c] += add;
    const G0 = this.game;
    // a dent where it struck (a few a corner: each harder knock pushes in more)
    const steps = Math.floor(D.corners[c] / 0.3);
    if (steps > D.dents[c] && D.dents[c] < 4) {
      D.dents[c] = steps;
      // (deeper and wider the harder: 3 cm at a nudge, 12 - the cap - at a full blow;
      // e.n points from what it met into the car: the skin goes that way)
      const nl = e.n ? this.toLocalDir(v, e.n) : _w.set(-l.x, 0, -l.z).normalize().clone();
      this.dent(D, V(Math.max(-S.halfL, Math.min(S.halfL, l.x)), Math.max(0.45, Math.min(1.1, l.y || 0.7)), Math.max(-S.halfW, Math.min(S.halfW, l.z))), nl, 0.35 + 0.35 * k, Math.min(0.12, 0.03 + 0.1 * k));
    }
    // (the metal where it struck: sparks, seen)
    if (G0 && k >= 0.3 && G0.time - D.sparkT > 0.15) { D.sparkT = G0.time; this.smash.sparksAt(_p.copy(e.point).setY(Math.max(0.45, e.point.y || 0.6)), _s.set(-l.x, 0, -l.z).normalize().clone(), 0.25 + 0.5 * k); }
    // [O6b] the parts already loose take it: a wobbling wheel at that corner
    // comes off, a dragging bumper at that end is torn, the sprung bonnet
    // struck again at the front goes, a hanging door struck again on its side
    const ci = CORNER_KEYS.indexOf(c);
    if (D.wob[ci] && k >= 0.45) this.wheelOff(D, ci);
    const be = D.bumper[c[0] === 'f' ? 0 : 1];
    if (be && be.pivot && k >= 0.3) be.strain += k * 1.2;
    if (c[0] === 'f' && l.x > S.halfL * 0.5 && D.hood && D.hood.pivot && k >= 0.55 && D.t - (D.hood.t0 ?? D.t) > 0.3) this.hoodOff(D, 0.6);
    if (D.hood && D.hood.pivot && D.hood.t0 == null) D.hood.t0 = D.t;
    const dk = l.z >= 0 ? 1 : 0, Dd = D.doors[dk];
    if (Dd && Dd.pivot && Math.abs(l.x) < 1.8 && k >= 0.3 && D.t - (Dd.t0 ?? 0) > 0.3) Dd.strain += k * 2.4;
    // the headlamp on that side
    if (c[0] === 'f' && D.corners[c] >= 0.35) this.lampOut(D, l.z >= 0 ? 1 : 0);
    // a side hit at the door: it hangs open
    const Pd = this.partsOf(v).door;
    if (Pd && l.x > Pd.x0 - 0.7 && l.x < Pd.x1 + 0.4 && Math.abs(l.z) > S.halfW * 0.6 && k >= 0.3 && !D.doors[dk]) { this.hangDoor(D, l.z >= 0 ? 1 : -1); if (D.doors[dk]) D.doors[dk].t0 = D.t; }
    // a hard blow at any speed (C3b's wreck smash): the corner down, the glass, the lamp
    if ((k >= 0.55 && w >= 1) || D.corners[c] >= 0.75) this.smashCorner(D, c, e.point);
    if (G0 && w >= 1 && k > 0.3) G0.sfx.play('c3_dent', e.point, { k }, { ref: 5 });
  }
  toLocalDir(v, d) { _q.setFromAxisAngle(_w.set(0, 1, 0), -v.yaw); return d.clone().applyQuaternion(_q); }

  // the skin pushed in round a point (car frame), along n (into the car), a falloff of r
  dent(D, p, n, r, depth) {
    const v = D.v, M = v.model && v.model.meshes ? v.model.meshes : null;
    if (!M) return;
    for (const key of SKIN) {
      const m = M[key];
      if (!m || !m.isMesh || !m.geometry || m.position.lengthSq() > 1e-6 || m.quaternion.w < 0.9999) continue;
      const g = this.own(D, m), o = D.orig.get(m);
      const A = g.getAttribute('position'), a = A.array, NA = g.getAttribute('normal'), na = NA ? NA.array : null;
      const r2 = r * r;
      let moved = false;
      for (let i = 0; i < a.length; i += 3) {
        const dx = a[i] - p.x, dy = a[i + 1] - p.y, dz = a[i + 2] - p.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= r2) continue;
        const d = Math.sqrt(d2), f = 1 - d / r, k = depth * f * f;
        a[i] += n.x * k; a[i + 1] += n.y * k * 0.5 - k * 0.25; a[i + 2] += n.z * k;
        // (capped: never more than DENT_MAX from where it was built - knocks add up, the car keeps its shape)
        if (o) {
          const ox = a[i] - o[i], oy = a[i + 1] - o[i + 1], oz = a[i + 2] - o[i + 2], ol = Math.hypot(ox, oy, oz);
          if (ol > DENT_MAX) { const s = DENT_MAX / ol; a[i] = o[i] + ox * s; a[i + 1] = o[i + 1] + oy * s; a[i + 2] = o[i + 2] + oz * s; }
        }
        // (the dent's wall faces its middle: the normal tilted toward it by its slope, drawn
        // a little steeper than it is - the ink's shading shows the hollow, not only the outline)
        if (na) {
          const nx = na[i], ny = na[i + 1], nz = na[i + 2], od = dx * nx + dy * ny + dz * nz;
          const tx = dx - nx * od, ty = dy - ny * od, tz = dz - nz * od, tl = Math.hypot(tx, ty, tz);
          if (tl > 1e-4) {
            const s = Math.min(1.4, 8 * depth * f / r) / tl;
            let ux = nx - tx * s, uy = ny - ty * s, uz = nz - tz * s;
            const ul = Math.hypot(ux, uy, uz) || 1;
            na[i] = ux / ul; na[i + 1] = uy / ul; na[i + 2] = uz / ul;
          }
        }
        moved = true;
      }
      if (moved) { A.needsUpdate = true; if (NA) NA.needsUpdate = true; g.computeBoundingSphere(); }
    }
  }

  // C3b's smash of a corner: down on its broken spring, the body twisted
  // onto it, the wing crumpled, the lamp out, the glass on that side gone
  // and grains of it on the road, steam out of the bonnet
  smashCorner(D, c, point) {
    if (D.smashed.has(c)) return;
    D.smashed.add(c);
    const v = D.v, S = v.spec, G0 = this.game;
    const front = c[0] === 'f', right = c[1] === 'r';
    D.crushR += (right ? 1 : -1) * 0.045; D.crushP += (front ? -1 : 1) * 0.035;
    this.dent(D, V(front ? S.halfL - 0.15 : -S.halfL + 0.15, 0.85, (right ? 1 : -1) * (S.halfW - 0.1)), V(front ? -0.7 : 0.7, -0.2, right ? -0.7 : 0.7).normalize(), 0.7, DENT_MAX);
    if (front) this.lampOut(D, right ? 1 : 0);
    // the parts (the user's must): the wheel at that corner wobbles, the
    // bumper at that end comes loose and drags, a front blow pops the bonnet
    this.wobble(D, CORNER_KEYS.indexOf(c));
    this.looseBumper(D, front ? 0 : 1, right ? 1 : -1);
    if (front) this.popHood(D, 1);
    // a sedan's glass on that side and the screen at that end (world/Cars' panes: the sides 0..3, +z first; the screen 4, 5; the rear 6)
    const C = this.stage.cars;
    if (v.car && v.car.panes && C && C.shatter) {
      try { for (const i of [...(right ? [0, 1] : [2, 3]), front ? (right ? 4 : 5) : 6]) if (v.car.panes[i] && !v.car.panes[i].broken) C.shatter(v.car, i, 1.2); } catch (e) { /* its glass */ }
    }
    // grains of glass under the corner
    const at = v.world(front ? S.halfL : -S.halfL, (right ? 1 : -1) * S.halfW, _v).clone();
    at.y = (v.groundY || 0) + 0.6;
    const sm = this.smash;
    for (let i = 0; i < 16; i++) { const s = sm.rnd(0.02, 0.05); sm.pieces.spawn('shard', at.clone().add(_w.set(sm.gauss() * 0.3, sm.rnd(0, 0.3), sm.gauss() * 0.3)), sm.randQ(), _w.set(s, s, 1), V(v.vel.x * 0.3 + sm.gauss() * 1.2, sm.rnd(0.3, 1.5), v.vel.z * 0.3 + sm.gauss() * 1.2), sm.spin(1), { r: 0.02, bounce: 0.15 }); }
    if (G0) G0.sfx.glass(at, 0.8);
    // (the bonnet sprung: a step of the engine's damage, the steam's tell)
    if (front) v.damage = Math.min(BURN - 0.3, v.damage + 0.5);
    void point;
  }

  lampOut(D, side) {
    if (D.lampOut[side]) return;
    D.lampOut[side] = true;
    const v = D.v, G0 = this.game, C = this.stage.cars;
    if (v.car && v.car.lensBroken && C && C.breakLens) { try { if (!v.car.lensBroken[side ? 0 : 1]) C.breakLens(v.car, side ? 0 : 1); } catch (e) { /* */ } }
    else if (v.model && v.model.meshes && v.model.meshes.lens) {
      // (the coupe's lenses: one mesh, two discs - that side's collapsed)
      const m = v.model.meshes.lens;
      const a = this.own(D, m).getAttribute('position').array;
      for (let i = 0; i < a.length; i += 3) if ((a[i + 2] >= 0) === (side === 1)) { a[i] = 2.3; a[i + 1] = 0.98; a[i + 2] = side ? 0.6 : -0.6; }
      m.geometry.getAttribute('position').needsUpdate = true;
    }
    const p = v.world(v.spec.halfL, (side ? 1 : -1) * 0.6, _v).clone(); p.y = (v.groundY || 0) + 0.98;
    this.smash.glassBits(p, v.fwd.clone(), 8);
    if (G0) G0.sfx.glass(p, 0.4);
  }

  // ---- the parts [O6b] (the user's must: "car damage ... some physical stuff within reason") -------------
  // No soft body: a few strokes. The bonnet, a bumper and a wheel are the
  // car's own triangles cut out of its skin (my build of that mesh: `own`)
  // into a mesh or two of the same materials and ink on a pivot (`cut`); a
  // door is a panel of its paint on its hinge over a black opening. Each
  // moves on its pivot (the bonnet flaps, the bumper drags, the wheel wobbles,
  // the door swings) and when it comes off it is a THING of the set
  // (Smash.spawnPart: a rigid body from a pool that flies, rests, is solid
  // where it lies, is kicked by a car, swept by the cap and the mend).
  // Where each part is, by kind: PARTS (a model may carry its own: model.parts).

  // my own build of a skin mesh (the first change to it): a sedan of world/Cars
  // is brought to its near build first and kept there (car.own: Cars' LOD and
  // the shadow maps leave it be). orig: its positions as built (the dents' cap)
  own(D, m) {
    const mine = D.mine.get(m);
    if (mine) { if (m.geometry !== mine) m.geometry = mine; return mine; }
    const v = D.v, C = this.stage.cars;
    if (v.car && v.car.lod && C && C.T) { v.car.lod = 0; for (const k of LODK) { const mm = v.car.meshes[k]; if (mm && C.T[k]) mm.geometry = C.T[k]; } }
    if (v.car) v.car.own = true;
    const g0 = m.geometry;
    D.geo0.set(m, g0);
    const g = g0.index ? g0.toNonIndexed() : g0.clone();
    m.geometry = g;
    D.mine.set(m, g);
    D.orig.set(m, g.getAttribute('position').array.slice());
    return g;
  }
  // triangles added to my build of a mesh (the black of an opening, the engine bay)
  append(D, key, add) {
    const v = D.v, M = v.model && v.model.meshes, m = M && M[key];
    if (!m || !m.isMesh || m.position.lengthSq() > 1e-6) { add.dispose(); return; }
    const g = this.own(D, m), a = add.index ? add.toNonIndexed() : add;
    const ng = new THREE.BufferGeometry();
    for (const name of Object.keys(g.attributes)) {
      const A = g.getAttribute(name), B = a.getAttribute(name), n = a.getAttribute('position').count;
      const arr = new Float32Array(A.array.length + n * A.itemSize);
      arr.set(A.array);
      if (B && B.itemSize === A.itemSize) arr.set(B.array, A.array.length);
      ng.setAttribute(name, new THREE.BufferAttribute(arr, A.itemSize));
    }
    ng.computeBoundingSphere();
    const o = D.orig.get(m), np = ng.getAttribute('position').array;
    const no = new Float32Array(np.length); no.set(o); no.set(np.subarray(o.length), o.length);
    D.orig.set(m, no);
    m.geometry = ng; D.mine.set(m, ng); g.dispose();
    if (a !== add) a.dispose();
    add.dispose();
  }

  // the triangles of the car's meshes `keys` whose middle passes test(x, y, z,
  // ny, key) (model frame) cut out: collapsed in my build, drawn as meshes of
  // their own under a pivot at `at` (one mesh a material: few draws); returns
  // the group, or null
  cut(D, keys, test, at) {
    const v = D.v, M = v.model && v.model.meshes;
    if (!M) return null;
    const grp = new THREE.Group();
    grp.position.copy(at);
    const byMat = new Map();
    for (const key of keys) {
      const m = M[key];
      if (!m || !m.isMesh || !m.geometry || !m.visible || m.position.lengthSq() > 1e-6 || m.quaternion.w < 0.9999) continue;
      const g = this.own(D, m);
      const A = g.getAttribute('position'), a = A.array, NA = g.getAttribute('normal'), na = NA ? NA.array : null;
      let rec = byMat.get(m.material);
      for (let i = 0; i + 8 < a.length; i += 9) {
        if (a[i] === a[i + 3] && a[i + 1] === a[i + 4] && a[i + 2] === a[i + 5] && a[i] === a[i + 6] && a[i + 1] === a[i + 7]) continue;
        const cx = (a[i] + a[i + 3] + a[i + 6]) / 3, cy = (a[i + 1] + a[i + 4] + a[i + 7]) / 3, cz = (a[i + 2] + a[i + 5] + a[i + 8]) / 3;
        const ny = na ? (na[i + 1] + na[i + 4] + na[i + 7]) / 3 : 0;
        if (!test(cx, cy, cz, ny, key)) continue;
        if (!rec) { rec = { pos: [], nor: [], src: m }; byMat.set(m.material, rec); }
        for (let k = 0; k < 9; k++) rec.pos.push(a[i + k] - (k % 3 === 0 ? at.x : k % 3 === 1 ? at.y : at.z));
        for (let k = 0; k < 9; k++) rec.nor.push(na ? na[i + k] : 0);
        for (let k = 3; k < 9; k++) a[i + k] = a[i + (k % 3)];
      }
      A.needsUpdate = true; g.computeBoundingSphere();
    }
    let n = 0;
    for (const [mat, rec] of byMat) {
      if (!rec.pos.length) continue;
      const ng = new THREE.BufferGeometry();
      ng.setAttribute('position', new THREE.Float32BufferAttribute(rec.pos, 3));
      ng.setAttribute('normal', new THREE.Float32BufferAttribute(rec.nor, 3));
      ng.computeBoundingSphere();
      D.cutGeos.push(ng);
      const m = rec.src, pm = new THREE.Mesh(ng, rimmed(mat));
      pm.userData = { ...m.userData, noRay: true };
      pm.castShadow = m.castShadow; pm.receiveShadow = m.receiveShadow; pm.renderOrder = m.renderOrder;
      pm.layers.mask = m.layers.mask;
      grp.add(pm);
      n++;
    }
    if (!n) return null;
    v.body.add(grp);
    D.added.push(grp);
    return grp;
  }
  partsOf(v) { return (v.model && v.model.parts) || PARTS[v.kind] || PARTS.sedan; }
  paintOf(v) { const M = v.model && v.model.meshes, m = M && (M.paint || M.body); return m && m.material && m.material.color ? m.material.color : null; }

  // the bonnet sprung: cut off its car at the scuttle, it pops up and rides
  // on its broken catch, beating in the wind at speed; struck again at the
  // front, or flapped long enough flat out, it tears off and goes over the roof
  popHood(D, k = 0.6) {
    if (D.hood || D.state === 'wreck') return;
    const v = D.v, M = v.model && v.model.meshes, P = this.partsOf(v).hood;
    D.hood = { none: true };
    const skin = M && (M.paint || M.body);
    if (!skin || !skin.geometry || !P) return;
    const { x0, x1, w: zw } = P;
    // the bonnet's top line along x: the highest up-facing skin near the middle, in 12 cm bins
    const g = this.own(D, skin), a = g.getAttribute('position').array, na = g.getAttribute('normal');
    const N = Math.ceil((x1 - x0) / 0.12) + 1, top = new Float32Array(N).fill(-9);
    for (let i = 0; i + 8 < a.length; i += 9) {
      const cx = (a[i] + a[i + 3] + a[i + 6]) / 3, cz = (a[i + 2] + a[i + 5] + a[i + 8]) / 3;
      if (cx < x0 || cx > x1 || Math.abs(cz) > 0.3) continue;
      if (na && na.array[i + 1] < 0.4) continue;
      const cy = (a[i + 1] + a[i + 4] + a[i + 7]) / 3, b = Math.floor((cx - x0) / 0.12);
      if (cy > top[b]) top[b] = cy;
    }
    for (let b = 1; b < N; b++) if (top[b] < -1) top[b] = top[b - 1];
    for (let b = N - 2; b >= 0; b--) if (top[b] < -1) top[b] = top[b + 1];
    if (top[0] < -1) return;
    const topAt = (x) => top[Math.max(0, Math.min(N - 1, Math.floor((x - x0) / 0.12)))];
    const at = V(x0, topAt(x0), 0);
    const grp = this.cut(D, ['paint', 'body', 'chrome', 'seams'], (x, y, z, ny, key) => {
      if (x < x0 || x > x1 + 0.12) return false;
      const t = topAt(x);
      if (y < t - 0.09 || y > t + 0.16) return false;
      if (key === 'chrome') return Math.abs(z) < 0.1 || (x < x1 - 0.3 && Math.abs(z) < zw);
      return Math.abs(z) < zw;
    }, at);
    if (!grp) return;
    // the bay under it black (the engine in the dark: no hole through the car)
    const mid = (x0 + x1) / 2, L = x1 - x0;
    this.append(D, 'dark', new THREE.BoxGeometry(L - 0.08, 0.03, zw * 2 - 0.08).translate(mid, Math.min(topAt(x0), topAt(x1)) - 0.1, 0));
    D.hood = { pivot: grp, ang: 0, w: 4 + 5 * k, strain: 0, L, zw, flapT: 0 };
    const G0 = this.game;
    if (G0) { const p = v.body.localToWorld(V(mid, at.y + 0.2, 0)); G0.sfx.play('o6b_bonnet', p, { k: 0.6 + 0.4 * k }, { ref: 5 }); this.smash.mark(p, 0.7, V(0, 1, 0), KINDS.carbonnet); G0.emit('smash:part', { car: v, part: 'bonnet', how: 'sprung' }); }
  }
  hoodOff(D, up = 1) {
    const H = D.hood, v = D.v;
    if (!H || !H.pivot || !H.pivot.visible) return;
    H.pivot.updateMatrixWorld(true);
    const c = H.pivot.localToWorld(V(H.L / 2, 0.02, 0));
    H.pivot.matrixWorld.decompose(_p, _q3, _s);
    H.pivot.visible = false;
    D.hood = { none: true, off: true };
    const sm = this.smash;
    // (it goes up and back over the roof, tumbling: the wind takes it)
    const f = v.fwd, sp = v.speedAbs;
    const vel = V(v.vel.x * 0.55 - f.x * 2 * up, 3.5 + 3 * up + sp * 0.12, v.vel.z * 0.55 - f.z * 2 * up);
    sm.spawnPart('carbonnet', c, _q3.clone(), vel, V(sm.gauss() * 2, sm.gauss() * 2, -6 - sm.rnd(0, 4)).applyQuaternion(_q3), { scale: V(H.L, 1, H.zw * 2), color: this.paintOf(v) });
    const G0 = this.game;
    if (G0) { G0.sfx.play('o6b_bonnet', c, { k: 1 }, { ref: 5 }); sm.mark(c, 1, V(0, 1, 0), KINDS.carbonnet); G0.emit('smash:part', { car: v, part: 'bonnet', how: 'off' }); }
  }

  // a door hanging off its hinge after a side blow: a panel of its paint
  // swinging over a black opening; struck again, slammed on its stop or
  // driven on fast, it tears off and lies on the road
  hangDoor(D, side) {
    const v = D.v, M = v.model && v.model.meshes, P = this.partsOf(v).door;
    const key = side > 0 ? 1 : 0;
    if (!P || D.doors[key]) return;
    const skin = M && (M.paint || M.body);
    const mat = (skin && skin.material) || this.stage.M.paint;
    const L = P.x1 - P.x0, H = P.y1 - P.y0;
    // the opening: black where the door was (a hair proud of the side)
    this.append(D, 'dark', new THREE.BoxGeometry(L - 0.06, H - 0.06, 0.012).translate((P.x0 + P.x1) / 2, (P.y0 + P.y1) / 2, side * (P.z + 0.008)));
    const pivot = new THREE.Group();
    pivot.position.set(P.x1, P.y0, side * (P.z + 0.03));
    const door = new THREE.Mesh(doorGeo(L, H), rimmed(mat));
    door.userData.inkId = skin ? skin.userData.inkId : 1;
    door.userData.inkFigure = true;
    door.userData.noRay = true;
    pivot.add(door);
    v.body.add(pivot);
    D.added.push(pivot);
    D.doors[key] = { pivot, side, ang: 0.3, w: 3, strain: 0, door, L, H };
    const G0 = this.game;
    if (G0) { G0.sfx.play('tail_door', door.getWorldPosition(_v), { open: true }, { ref: 3 }); G0.sfx.play('clang', door.getWorldPosition(_v), { k: 0.4 }, { ref: 3 }); G0.emit('smash:part', { car: v, part: 'door', how: 'hanging', side }); }
  }
  doorOff(D, key) {
    const Dd = D.doors[key], v = D.v;
    if (!Dd || !Dd.pivot.visible) return;
    const door = Dd.door;
    door.updateMatrixWorld(true);
    const c = door.localToWorld(V(-Dd.L / 2, Dd.H / 2, 0));
    door.matrixWorld.decompose(_p, _q3, _s);
    Dd.pivot.visible = false;
    D.doors[key] = { off: true };
    const sm = this.smash, sv = V(Math.sin(v.yaw) * Dd.side, 0, Math.cos(v.yaw) * Dd.side);
    const vel = V(v.vel.x * 0.7, 1.2, v.vel.z * 0.7).addScaledVector(sv, 2.4);
    sm.spawnPart('cardoor', c, _q3.clone(), vel, V(sm.gauss() * 2, sm.gauss() * 3, sm.gauss() * 2), { scale: V(Dd.L, Dd.H / 0.62, 1), color: this.paintOf(v) });
    const G0 = this.game;
    if (G0) { G0.sfx.play('o6b_door', c, { k: 1 }, { ref: 5 }); sm.mark(c, 1, sv, KINDS.cardoor); G0.emit('smash:part', { car: v, part: 'door', how: 'off', side: Dd.side }); }
  }

  // a bumper torn loose at the struck side: it hangs from its other end and
  // drags on the road, striking sparks; worked more, it comes away
  looseBumper(D, end, side) {
    if (D.bumper[end] || D.state === 'wreck') return;
    const v = D.v, P = this.partsOf(v).bumper, sx = end ? -1 : 1;
    D.bumper[end] = { none: true };
    if (!P) return;
    const zEnd = v.spec.halfW * 0.95;
    const at = V(sx * (P.x + 0.1), (P.y1 + 0.3) / 2, -side * zEnd);
    const grp = this.cut(D, ['chrome'], (x, y) => x * sx > P.x && y < P.y1 && y > 0.2, at);
    if (!grp) return;
    // (the free end down on the road: a turn about the car's long axis)
    const drop = Math.max(0.2, at.y - 0.06);
    D.bumper[end] = { pivot: grp, side, end, ang: 0, target: side * Math.asin(Math.min(0.9, drop / (2 * zEnd))), strain: 0, zEnd };
    const G0 = this.game;
    if (G0) { G0.sfx.play('o6b_scrape', v.body.localToWorld(at.clone()), { k: 0.8 }, { ref: 4 }); G0.emit('smash:part', { car: v, part: 'bumper', how: 'loose', end }); }
  }
  bumperOff(D, end) {
    const B = D.bumper[end], v = D.v;
    if (!B || !B.pivot) return;
    B.pivot.updateMatrixWorld(true);
    const c = B.pivot.localToWorld(V(0, 0, B.side * B.zEnd));
    B.pivot.matrixWorld.decompose(_p, _q3, _s);
    B.pivot.visible = false;
    D.bumper[end] = { none: true, off: true };
    // (the pool's bar across: its z along the car's width, as the cut one)
    this.smash.spawnPart('carbumper', c, _q3.clone(), V(v.vel.x * 0.55, 0.8, v.vel.z * 0.55), V(0, this.smash.gauss() * 3, 0), { scale: V(1, 1, 2 * B.zEnd) });
    const G0 = this.game;
    if (G0) { G0.sfx.play('clang', c, { k: 0.9 }, { ref: 5 }); G0.sfx.play('o6b_scrape', c, { k: 0.6 }, { ref: 4 }); this.smash.mark(c, 0.8, V(v.vel.x, 0, v.vel.z).normalize(), KINDS.carbumper); G0.emit('smash:part', { car: v, part: 'bumper', how: 'off', end }); }
  }

  // the wheel at a corner after a bad blow: cut out of the car, it wobbles
  // on its hub as it rolls (the car shakes and pulls with it); driven hard
  // or struck again, it comes off - the car on its hub, grinding
  wheelAt(D, i) {
    const W = this.partsOf(D.v).wheel;
    if (!W) return null;
    const sz = i % 2 ? 1 : -1;
    return { c: V(W.x[i < 2 ? 0 : 1], W.y, sz * W.z[i < 2 ? 0 : 1]), R: W.r, sz };
  }
  wobble(D, i) {
    if (i < 0 || D.wob[i] || D.hub[i] || D.state === 'wreck') return;
    const W = this.wheelAt(D, i);
    if (!W) return;
    const { c, R, sz } = W, zc = Math.abs(c.z);
    const grp = this.cut(D, WHEELK, (x, y, z) => (x - c.x) * (x - c.x) + (y - c.y) * (y - c.y) < (R + 0.04) * (R + 0.04) && z * sz > zc - 0.2 && z * sz < zc + 0.22, c);
    if (!grp) return;
    D.wob[i] = { pivot: grp, ph: 0, hp: 1, R, c, sz };
    const G0 = this.game;
    if (G0) G0.emit('smash:part', { car: D.v, part: 'wheel', how: 'wobble', i });
  }
  wheelOff(D, i) {
    const W = D.wob[i], v = D.v;
    if (!W) return;
    W.pivot.visible = false;
    D.wob[i] = null;
    D.hub[i] = 1;
    v.grip[GRIP_KEYS[i]] = 0.12;
    // (it pulls to the side it lost: a front one hard, a rear one less)
    D.pull0 += (i < 2 ? 1 : 0.45) * (i % 2 ? -1 : 1) * 0.07;
    const G0 = this.game;
    const c = v.body.localToWorld(W.c.clone());
    // (it rolls on the way the car went, out to its side)
    const sv = _s.set(Math.sin(v.yaw) * W.sz, 0, Math.cos(v.yaw) * W.sz).clone();
    const sp = Math.hypot(v.vel.x, v.vel.z);
    const dir = sp > 1 ? V(v.vel.x / sp, 0, v.vel.z / sp).addScaledVector(sv, 0.35).normalize() : sv.clone();
    const axis = _p.crossVectors(V(0, 1, 0), dir).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), axis);
    const sc = W.R / 0.375;
    this.smash.spawnPart('carwheel', c, q, V(v.vel.x, 0, v.vel.z), null, { roll: { dir, sp: Math.min(12, sp * 0.9 + 1.5) }, scale: V(sc, sc, sc) });
    if (G0) {
      G0.sfx.play('o6b_wheel', c, { k: 1 }, { ref: 5 });
      this.smash.mark(c.clone(), 0.9, sv.clone(), KINDS.carwheel);
      this.smash.sparksAt(c.clone().setY((v.groundY || 0) + 0.1), sv.clone(), 1.2);
      if (G0.controller && G0.vehicles && G0.vehicles.player === v && G0.controller.kick) G0.controller.kick(3, 4, 0.2);
      G0.emit('smash:part', { car: v, part: 'wheel', how: 'off', i });
    }
  }

  // the parts' moves, a step (after the engine's)
  partsStep(D, dt) {
    const v = D.v, G0 = this.game, sp = v.speedAbs, sm = this.smash;
    // (the engine's smoke lifts a bonnet off its catch)
    if (!D.hood && v.damage >= SMOKE) this.popHood(D, 0.3);
    // the bonnet: popped up, then riding on its broken catch - the wind lifts
    // it with the speed and beats it; the bumps throw it
    const H = D.hood;
    if (H && H.pivot && H.pivot.visible) {
      const wind = Math.min(1, sp / 14);
      const beat = Math.sin(D.t * (7 + sp * 0.45)) * 0.6 + Math.sin(D.t * 17.3) * 0.4;
      const target = 0.07 + 0.2 * wind * wind + 0.07 * beat * wind;
      H.w += ((target - H.ang) * 90 - H.w * 7 + (v.heaveV || 0) * 6 - (v.pitchV || 0) * 3) * dt;
      H.ang += H.w * dt;
      if (H.ang < 0.0) {
        // (down on its catch: a knock, and up again)
        if (H.w < -1.2 && G0 && D.t - H.flapT > 0.12) { H.flapT = D.t; G0.sfx.play('o6b_flap', v.body.localToWorld(V(H.L, 1, 0)), { k: Math.min(1, -H.w / 5) }, { ref: 3 }); }
        H.ang = 0; H.w = Math.abs(H.w) * 0.35;
      }
      if (H.ang > 0.6) { H.ang = 0.6; H.w = -Math.abs(H.w) * 0.3; }
      H.pivot.rotation.z = H.ang;
      // flat out it works loose
      H.strain += dt * Math.max(0, sp - 16) * 0.06;
      if (H.strain >= 1) this.hoodOff(D, 1);
    }
    // a bumper dragging: its free end on the road, sparks and the scrape as it goes; it slows the car a little
    for (const B of D.bumper) {
      if (!B || !B.pivot) continue;
      B.ang += (B.target + Math.sin(D.t * 31) * 0.02 * Math.min(1, sp / 6) - B.ang) * Math.min(1, dt * 12);
      B.pivot.rotation.x = B.ang;
      if (sp > 2 && G0) {
        v.vel.multiplyScalar(1 - 0.04 * dt);
        B.strain += dt * sp * 0.004;
        B.acc = (B.acc || 0) + dt * Math.min(40, sp * 2.5);
        if (B.acc >= 1) {
          const p = B.pivot.localToWorld(V(0, 0, B.side * B.zEnd * 2));
          p.y = (v.groundY || 0) + 0.04;
          while (B.acc >= 1) {
            B.acc -= 1;
            G0.fx.sparks.spawn({ pos: p.clone(), vel: V(-v.vel.x * 0.35 + sm.gauss(), sm.rnd(0.3, 1.4), -v.vel.z * 0.35 + sm.gauss()), life: sm.rnd(0.12, 0.35), size: [0.008, 0.013], stretch: 0.04, col: [6, 6, 6], cell: ATLAS.DROP, gravity: 9.8, ground: p.y - 0.03, fadeOut: 0.3 });
          }
          if (G0.time - (B.sndT || -9) > 0.33) { B.sndT = G0.time; G0.sfx.play('o6b_scrape', p, { k: Math.min(0.8, 0.2 + sp / 20) }, { ref: 4 }); }
        }
      }
      if (B.strain >= 1) this.bumperOff(D, B.end);
    }
    // a wheel wobbling on its hub: it rocks as it rolls, the car shakes and pulls; worn through at speed, it goes
    let wob = 0;
    for (let i = 0; i < 4; i++) {
      const W = D.wob[i];
      if (!W) continue;
      W.ph += sp * dt / W.R;
      const A = 0.13 * Math.min(1, 0.35 + sp / 6);
      W.pivot.rotation.set(A * Math.sin(W.ph), A * 0.6 * Math.cos(W.ph), 0);
      wob += (i < 2 ? 1 : 0.4) * 0.035 * Math.sin(W.ph) * Math.min(1, sp / 5);
      v.grip[GRIP_KEYS[i]] = Math.min(v.grip[GRIP_KEYS[i]], 0.7);
      if (sp > 1) v.shake = Math.max(v.shake || 0, 0.3 * Math.min(1, sp / 8));
      W.hp -= dt * Math.max(0, sp - 7) * 0.012;
      if (W.hp <= 0) this.wheelOff(D, i);
    }
    v.pull = D.pull0 + wob;
    // on a hub: slow (half the power, the hub's drag), grinding
    const hubs = D.hub[0] + D.hub[1] + D.hub[2] + D.hub[3];
    if (hubs) {
      v.power *= 0.5;
      if (sp > 0.5) v.vel.multiplyScalar(1 - Math.min(0.5, 0.14 * hubs) * dt);
      if (sp > 1.5 && G0 && G0.time - D.grindT > 0.36) { D.grindT = G0.time; G0.sfx.play('o6b_grind', v.pos, { k: Math.min(0.9, 0.3 + sp / 20) }, { ref: 5 }); }
    }
    // the hanging doors: they swing with the car's moves (and a turn's pull),
    // slammed on their stop or driven on fast they work loose
    for (let key = 0; key < 2; key++) {
      const Dd = D.doors[key];
      if (!Dd || !Dd.pivot || !Dd.pivot.visible) continue;
      const push = -(v.accel || 0) * 0.35 + (v.yawRate || 0) * Dd.side * 0.8 + Math.min(1.5, sp * 0.08) * 0.6;
      Dd.w += ((0.5 - Dd.ang) * 12 - Dd.w * 1.6 + push) * dt;
      const a1 = Dd.ang + Dd.w * dt;
      if (a1 > 1.35 && Dd.w > 2) { Dd.strain += 0.15 * Math.min(2, Dd.w / 3); if (G0) G0.sfx.play('clang', Dd.door.getWorldPosition(_v), { k: 0.5 }, { ref: 3 }); }
      if (a1 < 0.04 && Dd.w < -2 && G0) G0.sfx.play('tail_door', Dd.door.getWorldPosition(_v), {}, { ref: 3 });
      Dd.strain += dt * Math.max(0, sp - 8) * 0.035;
      Dd.ang = Math.max(0.04, Math.min(1.35, a1));
      if (Dd.ang === 1.35 || Dd.ang === 0.04) Dd.w *= -0.3;
      Dd.pivot.rotation.y = Dd.side * Dd.ang;
      if (Dd.strain >= 1) this.doorOff(D, key);
    }
  }

  // ---- the river [O6b] (the cold play's finding 10: a car went in as grey planes and the black) --------------
  // A car over the quay's edge: it drops to the water nose first, the splash
  // (white, a column of drops and a ring that closes), and goes under; what is
  // left is a dark shape under the surface where it went down, its lamps two
  // glows dying under the water. (scenes/city.js gives the fail a moment for it:
  // `The river took it.` comes as the water closes.) A man the same: splash().
  sink(v) {
    const G0 = this.game;
    if (!G0 || v._sinking) return;
    v._sinking = { t: 0, y0: v.body.position.y, vy: Math.min(0, v.vel.y || 0), fwd: v.fwd.clone(), sp: Math.min(9, v.speedAbs), splashed: false, pitch: 0 };
    v.frozen = true;
    const S = v._sinking;
    v.onPose = (car) => {
      const B = car.body;
      B.position.y = S.y;
      B.position.x = car.pos.x; B.position.z = car.pos.z;
      B.quaternion.setFromAxisAngle(_w.set(0, 1, 0), car.yaw).multiply(_q.setFromAxisAngle(_v.set(0, 0, 1), -S.pitch));
      B.updateMatrixWorld(true);
    };
    S.y = S.y0;
    this.sinking = this.sinking || [];
    this.sinking.push(v);
  }
  sinkStep(dt) {
    const L = this.sinking;
    if (!L || !L.length) return;
    for (let i = L.length - 1; i >= 0; i--) {
      const v = L[i], S = v._sinking;
      if (!S || !this.game.vehicles.list.includes(v)) { L.splice(i, 1); continue; }
      S.t += dt;
      // (off the edge it carries on a little and falls; in the water it slows and goes down by the nose)
      const inW = S.y < WATER_Y + 0.2;
      S.sp = Math.max(0, S.sp - dt * (inW ? 9 : 1));
      v.pos.x += S.fwd.x * S.sp * dt; v.pos.z += S.fwd.z * S.sp * dt;
      S.vy = inW ? Math.max(S.vy - dt * 2, -0.9) * Math.exp(-dt * 0.5) : S.vy - 9.8 * dt;
      if (inW && S.vy < -0.9) S.vy = -0.9;
      S.y += S.vy * dt;
      S.pitch = Math.min(0.5, S.pitch + dt * (inW ? 0.35 : 0.55));
      if (!S.splashed && S.y < WATER_Y + 0.6) { S.splashed = true; this.splash(_v.set(v.pos.x, WATER_Y, v.pos.z).clone(), 1.4, v); }
      if (v.lamps && v.lamps.setOn && S.y < WATER_Y - 0.6 && v.lamps.on) v.lamps.setOn(false);
      if (S.y < WATER_Y - 2.6) { v.body.visible = false; L.splice(i, 1); }
      v.pose(0);
    }
  }
  // a splash in ink: white drops thrown up in a crown and falling back, a white
  // ring that spreads and closes, the sound; for a car, its dark shape under
  // the surface after (with its lamps' glows dying)
  splash(at, k = 1, car = null) {
    const G0 = this.game, sm = this.smash;
    if (!G0) return;
    const n = Math.round(70 * k);
    for (let i = 0; i < n; i++) {
      const a = sm.rnd(0, 6.283), r = sm.rnd(0.2, 1.1) * k, up = sm.rnd(2.5, 6.5) * Math.sqrt(k);
      G0.fx.splash.spawn({ pos: _w.set(at.x + Math.cos(a) * r, WATER_Y + 0.05, at.z + Math.sin(a) * r).clone(), vel: V(Math.cos(a) * sm.rnd(0.6, 2.4), up, Math.sin(a) * sm.rnd(0.6, 2.4)), life: sm.rnd(0.7, 1.4), size: [0.02, 0.07], stretch: 0.05, col: [3, 3, 3], alpha: 1, cell: ATLAS.DROP, gravity: 9.8, ground: WATER_Y + 0.02, fadeOut: 0.2 });
    }
    for (let i = 0; i < 4; i++) G0.fx.dust.spawn({ pos: _w.set(at.x + sm.gauss() * 0.6 * k, WATER_Y + 0.4, at.z + sm.gauss() * 0.6 * k).clone(), vel: V(sm.gauss() * 0.4, sm.rnd(0.6, 1.4), sm.gauss() * 0.4), life: sm.rnd(0.8, 1.3), size: [1.2 * k, 1.0 * k], grow: 0.8, rot: sm.rnd(0, 6.28), col: [1.2, 1.2, 1.2], alpha: 0.4, drag: 1.5, fadeOut: 0.6 });
    sm.mark(_w.set(at.x, WATER_Y + 0.5, at.z).clone(), Math.min(1, 0.6 + 0.3 * k), null, null);
    G0.sfx.play('o6b_splash', at.clone ? at.clone() : at, { k: Math.min(1, 0.5 + 0.4 * k) }, { ref: 6 });
    // the ring: white, out from where it went in, closing over it
    const ring = this.ringOf();
    ring.position.set(at.x, WATER_Y + 0.03, at.z); ring.scale.setScalar(0.6 * k); ring.visible = true;
    ring.userData.t = 0; ring.userData.k = k;
    if (car) {
      // the shape it leaves under the water: dark, the car's size, its lamps dying
      const S = this.sunkShape(), c = car;
      S.position.set(at.x + c.fwd.x * 1.2, WATER_Y + 0.02, at.z + c.fwd.z * 1.2);
      S.rotation.set(0, c.yaw, 0);
      S.scale.set(c.spec.halfL * 1.9, 1, c.spec.halfW * 1.9);
      S.visible = true; S.userData.t = 0;
    }
  }
  ringOf() {
    const R = this._rings || (this._rings = []);
    let r = R.find((x) => !x.visible);
    if (!r && R.length < 3) {
      r = new THREE.Mesh(new THREE.RingGeometry(0.75, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.2, 2.2), transparent: true, opacity: 0.9, depthWrite: false, fog: false }));
      r.layers.set(LAYER.FX); r.renderOrder = 5; r.userData.noRay = true; r.frustumCulled = false;
      this.smash.group.add(r); R.push(r);
    }
    return r || R[0];
  }
  sunkShape() {
    const L = this._sunk || (this._sunk = []);
    let s = L.find((x) => !x.visible);
    if (!s && L.length < 3) {
      s = new THREE.Group();
      // (black where it lies under the water - it takes the lamps' streaks out of the wet - a pale
      // ripple round it where the water closed, and its two lamps glowing up through the water)
      const body = new THREE.Mesh(new THREE.CircleGeometry(0.5, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.8, depthWrite: false, fog: false }));
      body.layers.set(LAYER.FX); body.renderOrder = 4; body.userData.noRay = true;
      const rim = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.56, 36).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.9, 0.9), transparent: true, opacity: 0.5, depthWrite: false, fog: false }));
      rim.layers.set(LAYER.FX); rim.renderOrder = 5; rim.userData.noRay = true;
      const glows = [-0.2, 0.2].map((z) => { const m = new THREE.Mesh(new THREE.CircleGeometry(0.06, 14).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 4, 4), transparent: true, opacity: 0.9, depthWrite: false, fog: false })); m.position.set(0.44, 0.004, z); m.layers.set(LAYER.FX); m.renderOrder = 5; m.userData.noRay = true; return m; });
      s.add(body, rim, ...glows);
      s.userData.rim = rim;
      s.userData.glows = glows;
      this.smash.group.add(s); L.push(s);
    }
    if (!s) { s = L.reduce((a, b) => (a.userData.t > b.userData.t ? a : b)); }
    return s;
  }
  // the rings spreading and closing, the shapes' lamps dying, far ones gone (the mend's 200 m)
  waterStep(dt) {
    for (const r of this._rings || []) {
      if (!r.visible) continue;
      const u = (r.userData.t += dt) / 1.8;
      r.scale.setScalar((0.6 + 3.2 * Math.sqrt(Math.min(1, u))) * r.userData.k);
      r.material.opacity = 0.9 * Math.max(0, 1 - u) * (u < 0.1 ? u * 10 : 1);
      if (u >= 1) r.visible = false;
    }
    const e = this.game && this.game.camera.position;
    for (const s of this._sunk || []) {
      if (!s.visible) continue;
      const t = (s.userData.t += dt);
      // (the lamps under the water: dimming over twenty seconds, a flicker as they go)
      const k = Math.max(0, 1 - t / 20) * (t > 12 ? (Math.sin(t * 31) * Math.sin(t * 13.7) > -0.3 ? 1 : 0.2) : 1);
      for (const g of s.userData.glows) g.material.opacity = 0.9 * k;
      s.userData.rim.material.opacity = 0.5 * Math.max(0.25, 1 - t / 30);
      // (air coming up off it for a while: a bubble breaking now and then)
      if (t < 14 && this.game && this.smash.rnd() < dt * (6 - t * 0.4)) {
        const sm = this.smash, c = Math.cos(s.rotation.y), sn = Math.sin(s.rotation.y), u = sm.gauss() * 0.3 * s.scale.x, w = sm.gauss() * 0.3 * s.scale.z;
        this.game.fx.splash.spawn({ pos: V(s.position.x + u * c + w * sn, WATER_Y + 0.03, s.position.z - u * sn + w * c), vel: V(0, sm.rnd(0.3, 0.9), 0), life: 0.35, size: [0.02, 0.03], stretch: 0.01, col: [2.5, 2.5, 2.5], alpha: 1, cell: ATLAS.DROP, gravity: 6, ground: WATER_Y + 0.01, fadeOut: 0.2 });
      }
      if (e && Math.hypot(s.position.x - e.x, s.position.z - e.z) > 200) s.visible = false;
    }
  }

  // ---- a round into it (Smash.bullet -> here) -----------------------------------------------------------
  bullet(D, hit, dir, weak) {
    const v = D.v, G0 = this.game, S = v.spec;
    if (D.state === 'wreck') return null;
    const l = v.local(hit.point, _v).clone();
    l.y = hit.point.y - (v.groundY || 0);
    // a tyre (near a wheel)
    const wheels = [[S.a, -S.halfW * 0.85], [S.a, S.halfW * 0.85], [-S.b, -S.halfW * 0.85], [-S.b, S.halfW * 0.85]];
    for (let i = 0; i < 4; i++) {
      const [wx, wz] = wheels[i];
      if (Math.hypot(l.x - wx, l.y - 0.375, (l.z - wz) * 0.6) < 0.42) {
        if (!weak) this.flat(D, i, hit.point);
        return null;
      }
    }
    // a headlamp
    if (l.x > S.halfL - 0.45 && l.y > 0.75 && l.y < 1.25 && Math.abs(Math.abs(l.z) - 0.6) < 0.25) { if (!weak) this.lampOut(D, l.z >= 0 ? 1 : 0); return 'glass'; }
    // a sedan's glass: the nearest pane, two rounds and it goes
    const C = this.stage.cars;
    if (v.car && v.car.panes && l.y > 1.1 && C && C.T) {
      let bi = -1, bd = Infinity;
      v.car.panes.forEach((p, i) => { if (p.broken) return; const d = C.T.panes[i].c.distanceToSquared(l); if (d < bd) { bd = d; bi = i; } });
      if (bi >= 0 && bd < 0.8) {
        const n = (D.panesHit.get(bi) || 0) + 1; D.panesHit.set(bi, n);
        if (n >= 2) C.shatter(v.car, bi, 1); else { G0.sfx.glass(hit.point, 0.35); this.smash.glassBits(hit.point, dir, 4); }
        return 'glass';
      }
    }
    if (weak) return null;
    // the engine, the tank, the body
    const zone = l.x > S.halfL * 0.3 && l.y < 1.16 ? 'engine' : l.x < -S.halfL * 0.6 && l.y < 0.95 ? 'tank' : 'body';
    v.hurt(zone === 'engine' ? 0.24 : zone === 'tank' ? 0.2 : 0.07, hit.point);
    if (zone === 'tank' && !D.leak) D.leak = true;
    return null;
  }

  // a tyre shot flat: the corner down, its grip gone, the wheel pulling to it
  flat(D, i, at) {
    if (D.tyres[i]) return;
    D.tyres[i] = 1;
    const v = D.v;
    v.grip[GRIP_KEYS[i]] = 0.35;
    if (i < 2) D.pull0 += (i === 0 ? 1 : -1) * 0.04;     // (a front one pulls the wheel to its side: + left)
    if (this.game) this.game.sfx.tyre(at);
    this.smash.sparksAt(at.clone(), v.fwd.clone(), 0.3);
  }

  // ---- the engine: steam, smoke, fire, the blast ----------------------------------------------------------
  engine(D, dt) {
    const v = D.v, G0 = this.game, sm = this.smash;
    const dmg = v.damage;
    if (D.state === 'wreck') return;
    if (dmg >= BURN && D.state !== 'burning') {
      D.state = 'burning';
      D.fuse = dmg >= 4 ? FUSE_HOT : FUSE;
      D.burnT = 0;
      if (G0) G0.sfx.hiss(v.pos);
      if (G0 && G0.emit) G0.emit('car:burning', { car: v });
    } else if (D.state !== 'burning') D.state = dmg >= SMOKE ? 'smoke' : dmg >= STEAM ? 'steam' : 'whole';
    if (D.state === 'burning') {
      D.burnT += dt;
      if (dmg >= 4 && D.fuse > FUSE_HOT) D.fuse = FUSE_HOT;
      D.fuse -= dt;
      v.power = Math.max(0, 0.55 - D.burnT * 0.08);
      if (D.fuse <= 0) { this.blast(D); return; }
    } else v.power = D.state === 'smoke' ? 0.8 : 1;
    if (!G0 || D.state === 'whole') return;
    // the seam at the bonnet's front, where it comes out
    const S = v.spec, hot = D.state === 'burning';
    const seam = (x, y, z) => v.body.localToWorld(_v.set(x, y, z)).clone();
    const rate = hot ? 16 : D.state === 'smoke' ? 9 : 7;
    D.acc.smoke += dt * rate;
    while (D.acc.smoke >= 1) {
      D.acc.smoke -= 1;
      const p = seam(S.halfL * 0.62 + sm.gauss() * 0.25, 1.1, sm.gauss() * 0.25);
      if (D.state === 'steam') {
        const g = sm.rnd(1.0, 1.35);
        G0.fx.dust.spawn({ pos: p, vel: V(sm.gauss() * 0.25 + v.vel.x * 0.5, sm.rnd(0.7, 1.4), sm.gauss() * 0.25 + v.vel.z * 0.5), life: sm.rnd(1.0, 1.6), size: [0.4, 0.35], grow: 0.9, rot: sm.rnd(0, 6.28), col: [g, g, g], alpha: 0.2, drag: 0.8, fadeOut: 0.7 });
      } else {
        const s = sm.rnd(0.5, 0.9) * (hot ? 1.2 : 1);
        const g = hot ? sm.rnd(0.004, 0.012) : 0.16 * sm.rnd(0.6, 1.2);
        G0.fx.smoke.spawn({ pos: p, vel: V(sm.gauss() * 0.3 + 0.35 + v.vel.x * 0.4, sm.rnd(1.4, 2.4), sm.gauss() * 0.3 + v.vel.z * 0.4), life: sm.rnd(2.2, 3.4), size: [s, s], grow: sm.rnd(0.4, 0.7), rot: sm.rnd(0, 6.28), spin: sm.gauss() * 0.3,
          col: [g, g, g], colEnd: [g * 1.5, g * 1.5, g * 1.5], alpha: sm.rnd(0.7, 0.85), drag: 0.3, fadeIn: 0.05, fadeOut: 0.5, cell: FIRE.SMOKE[Math.floor(sm.rnd(0, 3.99))] });
      }
    }
    if (hot) {
      // the flames licking out of the seams, growing as it cooks
      const grow = Math.min(1, D.burnT / 3);
      D.acc.flame += dt * (8 + 14 * grow);
      while (D.acc.flame >= 1) {
        D.acc.flame -= 1;
        const s = sm.rnd(0.25, 0.5) * (0.7 + 0.8 * grow);
        const p = seam(S.halfL * 0.55 + sm.gauss() * 0.3, 1.06, (sm.rnd() < 0.5 ? 1 : -1) * sm.rnd(0.15, 0.5));
        G0.fx.fire.spawn({ pos: p.add(_w.set(0, s * 0.3, 0)), vel: V(sm.gauss() * 0.1 + 0.2, sm.rnd(0.6, 1.3), sm.gauss() * 0.1), life: sm.rnd(0.18, 0.36), size: [s * 0.7, s], grow: 0.2, rot: sm.gauss() * 0.15,
          col: sm.rnd() < 0.5 ? FIRE_COL.yellow : FIRE_COL.orange, colEnd: FIRE_COL.deep, colPow: 1.3, cell: FIRE.FLAME[Math.floor(sm.rnd(0, 3.99))], fadeIn: 0.04, fadeOut: 0.3 });
      }
      // (its light: the fire light while it burns, flickering)
      const L = this.stage.fxLights && this.stage.fxLights.fire[0];
      if (L && (!this._litBy || this._litBy === D || !this._litBy.fire && this._litBy.state !== 'burning')) {
        this._litBy = D;
        L.position.copy(seam(S.halfL * 0.6, 1.8, 0));
        L.intensity = (25 + 35 * grow) * (0.75 + 0.25 * Math.sin(D.burnT * 23) * Math.sin(D.burnT * 7.1));
        L.distance = 14;
      }
    }
    // a hit tank: a dark drip under it
    if (D.leak) {
      D.acc.drip = (D.acc.drip || 0) + dt * 6;
      while (D.acc.drip >= 1) { D.acc.drip -= 1; const p = seam(-S.halfL * 0.8, 0.5, sm.gauss() * 0.2); G0.fx.splash.spawn({ pos: p, vel: V(0, -0.3, 0), life: 0.4, size: [0.012, 0.03], stretch: 0.03, col: [0.02, 0.02, 0.02], alpha: 1, cell: ATLAS.DROP, gravity: 9.8, ground: (v.groundY || 0) + 0.01, fadeOut: 0.1 }); }
    }
  }

  // it goes: the flash on the wet, the shards, the push; the wreck in its place
  blast(D) {
    const v = D.v, G0 = this.game, S = v.spec, sm = this.smash;
    const L = (x, y, z) => v.body.localToWorld(V(x, y, z));
    const at = L(S.halfL * 0.6, 1.0, 0);
    D.state = 'wreck';
    if (G0) {
      // (the frame rate's limit: two fires roaring; a third blast sinks the oldest to embers)
      const F = this.stage.cars && this.stage.cars.fires ? this.stage.cars.fires : this.fires;
      const roaring = F.filter((f) => !f.doused && (f.age < 1 || f.intensity() >= 0.45));
      if (roaring.length >= 2) roaring.sort((a, b) => b.age - a.age)[0].douse();
      G0.fx.explosions.blast(at, { yaw: v.yaw, kind: 'A', local: L });
      // what stands near goes over; what lies is thrown
      sm.blast(at, 7, 1);
      // (the cars near take it too)
      for (const o of this.list) if (o !== D && o.state !== 'wreck' && Math.hypot(o.v.pos.x - v.pos.x, o.v.pos.z - v.pos.z) < 6.5) o.v.hurt(1.4, at);
      const mine = G0.vehicles && G0.vehicles.player === v && G0.city && G0.city.inCar;
      if (Math.hypot(G0.eye.x - at.x, G0.eye.z - at.z) < 8) this.hurtBy = { by: 'blast', t: G0.time };
      G0.onCarExploded({ pos: v.pos.clone(), id: -1, smash: true }, at);
      G0.emit('car:wreck', { car: v, at, mine });
      if (mine) G0.fail({ why: 'She went up with you in her.', fall: false });
      else if (G0.health && G0.health.dead && !G0.health.onDeath) G0.fail({ why: this.why() || 'Too close when she went.', fall: false });
    }
    // [O6b] the bonnet goes up with her (off at a wreck): it comes down in the road, a thing
    this.blowHood(D);
    this.toWreck(D);
  }
  blowHood(D) {
    const v = D.v, H = D.hood, P = this.partsOf(v).hood, sm = this.smash;
    if (H && H.pivot && H.pivot.visible) { this.hoodOff(D, 2.6); return; }
    if ((H && H.off) || !P) return;
    D.hood = { none: true, off: true };
    const mid = (P.x0 + P.x1) / 2, y = P.y ?? (v.kind === 'truck' ? 1.68 : 1.1);
    const c = v.body.localToWorld(V(mid, y, 0));
    const f = v.fwd;
    sm.spawnPart('carbonnet', c, v.body.getWorldQuaternion(_q3).clone(), V(f.x * 1.5 + sm.gauss(), 8 + sm.rnd(0, 3), f.z * 1.5 + sm.gauss()), V(sm.gauss() * 3, sm.gauss() * 2, sm.gauss() * 5), { scale: V(P.x1 - P.x0, 1, P.w * 2), color: this.paintOf(v) });
  }

  toWreck(D) {
    const v = D.v, S = v.spec, st = this.stage, G0 = this.game;
    v.frozen = true; v.vel.set(0, 0, 0); v.yawRate = 0; v.wrecked = true; v.power = 0;
    v.input.throttle = 0; v.input.brake = 0;
    if (v.lamps && v.lamps.setOn) v.lamps.setOn(false);
    if (v.tail) v.tail.visible = false;
    // everything of it hidden but its shadow on the road and its bullets' box
    v.body.traverse((o) => {
      if (!o.isMesh || o === D.proxy || !o.visible) return;
      if (o.renderOrder >= 1 && o.layers && o.layers.mask === 4) return;   // (the contact shadow: LAYER.FX)
      o.visible = false; D.hidden.push(o);
    });
    // (a sedan's glass all gone: the step after - the blast's own frame is full)
    const C = st.cars;
    if (v.car && v.car.panes && C && C.shatter) this.smash.later(0.02, () => { try { v.car.panes.forEach((p, i) => { if (!p.broken) C.shatter(v.car, i, 2); }); } catch (e) { /* */ } });
    // the burnt body: the wreck's shell, cut to its length and width, down on its rims
    if (!WRECK) this.prewarm();
    const g = new THREE.Group();
    g.scale.set(S.halfL / 2.45, 1, S.halfW / 0.95);
    g.position.y = -WRECK_DROP;
    const id = v.model && v.model.meshes && v.model.meshes.paint ? v.model.meshes.paint.userData.inkId : 1;
    for (const [geo, mat] of [[WRECK.B.shell, WRECK.M.shell], [WRECK.B.lines, WRECK.M.lines], [WRECK.B.rims, WRECK.M.rims], [WRECK.B.doors, WRECK.M.shell]]) {
      if (!geo) continue;
      const m = new THREE.Mesh(geo, mat);
      m.userData.inkId = id; m.userData.inkFigure = true; m.userData.noRay = true;
      m.castShadow = false; m.receiveShadow = true;
      g.add(m);
    }
    v.body.add(g);
    D.added.push(g);
    D.hood = { none: true }; D.doors = [{ off: true }, { off: true }]; D.bumper = [{ none: true }, { none: true }]; D.wob = [null, null, null, null];
    // twisted onto its worst corner
    let worst = 'fl';
    for (const k of CORNER_KEYS) if (D.corners[k] > D.corners[worst]) worst = k;
    D.crushR = (worst[1] === 'r' ? 1 : -1) * 0.06; D.crushP = (worst[0] === 'f' ? -1 : 1) * 0.045;
    // the fire on the wreck (fx/Fire.js: it roars, then dies to embers)
    if (G0) {
      const src = [{ kind: 'bay', at: V(S.halfL * 0.6, 0.92, 0), rx: 0.42, rz: 0.36 }, { kind: 'cabin', at: V(-0.4, 0.85, 0), rx: 0.35, rz: 0.35, noEmber: true, k: 0.8 }];
      const fire = new Fire(st, G0.fx, { pos: v.body.localToWorld(V(S.halfL * 0.6, 0.92, 0)), yaw: v.yaw, sources: src, toWorld: (p) => _w.copy(p).applyMatrix4(v.body.matrixWorld), seed: 7900 + Math.round(v.pos.x * 3 + v.pos.z) });
      D.fire = fire;
      if (st.cars && st.cars.fires) { st.cars.fires.push(fire); if (st.cars.assignFireLights) st.cars.assignFireLights(); }
      else this.fires.push(fire);
      if (this._litBy === D) this._litBy = null;
      G0.sfx.play('fire', v.pos, { dur: 3 }, { ref: 5 });
    }
    // (frozen: its own step no longer poses it - once here)
    v.sagPitch = D.crushP + D.sagP; v.sagRoll = D.crushR + D.sagR;
    v.pose(0);
  }

  // ---- the tram strikes sparks on a car in its way ------------------------------------------------------------
  tramSparks(point, k = 0.6, D = null) {
    const G0 = this.game, sm = this.smash;
    if (!G0 || !point) return;
    const t = G0.time;
    if (t - (this._sparkT ?? -9) < 0.06) return;
    this._sparkT = t;
    const p = point.clone(); p.y = Math.max(p.y, 0.5);
    const n = Math.round(14 + 30 * k);
    for (let i = 0; i < n; i++) {
      const vv = V(sm.gauss() * 2.5, sm.rnd(0.4, 3), sm.gauss() * 2.5);
      G0.fx.sparks.spawn({ pos: p.clone().add(_w.set(sm.gauss() * 0.1, sm.rnd(0, 0.5), sm.gauss() * 0.1)), vel: vv, life: sm.rnd(0.15, 0.6), size: [0.009, 0.015], stretch: 0.04, col: [7, 7, 7], cell: ATLAS.DROP, gravity: 9.8, ground: this.stage.surfaceY(p.x, p.z) + 0.01, fadeOut: 0.3 });
    }
    if (t - (this._screechT ?? -9) > 0.5) { this._screechT = t; G0.sfx.play('tail_scrape', p, { k: Math.max(0.5, k) }, { ref: 5 }); G0.sfx.play('clang', p, { k: 0.8 }, { ref: 4 }); }
    this.sparkCount = (this.sparkCount || 0) + 1;
    if (D) D.tramT = t;
    G0.emit('smash:tram', { at: p, k });
  }

  // ---- per step -------------------------------------------------------------------------------------------------
  update(dt, t) {
    const G0 = this.game;
    if (!G0 || !G0.vehicles) return;
    // (the warm meshes drawn a third of a second of play, then not again)
    if (this._warm && this._warm.visible && G0.state === 'playing' && ++this._warmN > 20) this._warm.visible = false;
    const L = G0.vehicles.list;
    this.sinkStep(dt); this.waterStep(dt);
    for (const v of L) if (!v.smashD && v.spec && v.local && v.body) this.attach(v);
    for (let i = this.list.length - 1; i >= 0; i--) { const D = this.list[i]; if (!L.includes(D.v)) this.detach(D); }
    for (const D of this.list) {
      const v = D.v;
      D.t += dt;
      if (v.kind === 'tram') continue;
      // [O6b] the tram's shove (O6's left 6: a car on its rails wrecked in half a
      // second): its damage comes on at most 1.15 a second while the tram has it -
      // three seconds of sparks, dents, a door and a bumper going, then the fire
      if (D.tramT != null && G0.time - D.tramT < 0.35) {
        if (D.tram0 == null) { D.tram0 = G0.time; D.tramD0 = Math.min(v.damage, D.tramDmg ?? v.damage); }
        v.damage = Math.min(v.damage, D.tramD0 + (G0.time - D.tram0) * 1.15);
      } else if (D.tram0 != null && G0.time - D.tramT > 1.5) D.tram0 = null;
      D.tramDmg = v.damage;
      this.engine(D, dt);
      // the lean of what it carries: flat tyres, a smashed corner
      let sp = 0, sr = 0;
      const S = v.spec;
      for (let i = 0; i < 4; i++) {
        // (a flat tyre 9 cm down, a hub on the road 24)
        const drop = D.hub[i] ? 0.24 : D.tyres[i] ? 0.09 : 0;
        if (!drop) continue;
        const sx = i < 2 ? 1 : -1, sz = i % 2 ? 1 : -1; sp += -sx * drop / (S.wheelbase || 3.1); sr += sz * drop / ((S.halfW || 0.95) * 1.7);
      }
      D.sagP = sp; D.sagR = sr;
      if (D.state !== 'wreck') { v.sagPitch = D.sagP + D.crushP; v.sagRoll = D.sagR + D.crushR; }
      // the parts: the bonnet, a bumper, a wheel, a door (their moves)
      if (D.state !== 'wreck') this.partsStep(D, dt);
      // a rim on the road sparks as it goes (a hub on it, twice as many)
      const hubN = D.hub.some((x) => x);
      if ((hubN || D.tyres.some((x) => x)) && v.speedAbs > 4 && D.state !== 'wreck') {
        D.acc.rim += dt * Math.min(hubN ? 60 : 30, v.speedAbs * (hubN ? 3 : 1.5));
        while (D.acc.rim >= 1) {
          D.acc.rim -= 1;
          const i = hubN ? D.hub.findIndex((x) => x) : D.tyres.findIndex((x) => x);
          const p = v.world(i < 2 ? S.a : -S.b, (i % 2 ? 1 : -1) * S.halfW * 0.85, _v).clone(); p.y = (v.groundY || 0) + 0.05;
          G0.fx.sparks.spawn({ pos: p, vel: V(-v.vel.x * 0.3 + this.smash.gauss(), this.smash.rnd(0.3, 1.2), -v.vel.z * 0.3 + this.smash.gauss()), life: this.smash.rnd(0.1, 0.3), size: [0.008, 0.012], stretch: 0.03, col: [5, 5, 5], cell: ATLAS.DROP, gravity: 9.8, ground: p.y - 0.04, fadeOut: 0.3 });
        }
      }
      // a lamp out: its beam's cone that side gone
      if (v.lamps && v.lamps.cones && v.lamps.on) for (let s = 0; s < 2; s++) if (D.lampOut[s] && v.lamps.cones[s]) v.lamps.cones[s].visible = false;
      if (v.lamps && v.lamps.spot && v.lamps.on && (D.lampOut[0] || D.lampOut[1])) v.lamps.spot.intensity = v.lamps.intensity * (2 - D.lampOut.filter(Boolean).length) / 2;
      this.syncProxy(D);
      // a wreck's fire light after the roar: Cars' assigner
      if (D.fire && !(this.stage.cars && this.stage.cars.fires)) D.fire.update(dt, t);
    }
    if (this._litBy && this._litBy.state !== 'burning') { const Lf = this.stage.fxLights && this.stage.fxLights.fire[0]; if (Lf && !(this.stage.cars && this.stage.cars.fires.some((f) => f.light === Lf))) Lf.intensity = 0; this._litBy = null; }
    // the player's: warned while it burns and he sits in it; on foot, off a
    // car that burns, a fire that burns him, the tram's rails ahead of it
    const me = G0.vehicles.player, D = me && me.smashD, inCar = !!(G0.city && G0.city.inCar);
    const live = G0.state === 'playing' && !G0.failing;
    let want = D && D.state === 'burning' && inCar ? 'She’s burning. Get out.' : null;
    if (!want && !inCar && live) want = this.footWant(G0, dt);
    if (want !== (this._warned || null)) { this._warned = want; if (G0.hud && G0.hud.warn) { if (want) { if (G0.hud.teach && G0.hud.teach.dismiss) G0.hud.teach.dismiss(); G0.hud.warn(want); } else G0.hud.warn(null); } }
    // knocked aside by the tram: carried off its rails over a moment
    const K = this.knockV, ctl = G0.controller;
    if (K && ctl) {
      const k = Math.min(dt, K.t);
      ctl.pos.x += K.x * k; ctl.pos.z += K.z * k;
      if (this.stage.colliders && this.stage.colliders.resolve) this.stage.colliders.resolve(ctl.pos, ctl.radius || 0.35);
      K.t -= dt;
      if (K.t <= 0) this.knockV = null;
    }
    // (down by what this set did, in a scene that does not catch it - the
    // city's roam: the fail with its words, never a man lying dead in the street)
    if (live && G0.health && G0.health.dead && !G0.health.onDeath && this.why()) G0.fail({ why: this.why(), fall: true });
  }

  // a man on foot: the line he needs (and, met by the tram, the blow)
  footWant(G0, dt) {
    const e = G0.eye;
    let want = null;
    // the fire: standing in a burning wreck's (React's tick hurts within 2.4 m)
    const F = this.stage.cars && this.stage.cars.fires ? this.stage.cars.fires : this.fires;
    for (const f of F) {
      const I = f.intensity(), d = Math.hypot(f.pos.x - e.x, f.pos.z - e.z);
      if (I < 0.3) continue;
      if (d < 2.45) this.hurtBy = { by: 'fire', t: G0.time };
      if (d < 3.6) want = 'Too hot. Get back.';
    }
    for (const D of this.list) {
      const v = D.v;
      if (v.kind === 'tram') {
        const T = this.tramMan(v, e, G0);
        if (T && !want) want = T;
        continue;
      }
      // a car that burns, its blast to come (8 m: Game.onCarExploded's reach)
      if (!want && D.state === 'burning' && Math.hypot(v.pos.x - e.x, v.pos.z - e.z) - v.spec.halfL * 0.5 < 7.5) want = 'She’s going up. Get back.';
    }
    void dt;
    return want;
  }

  // the tram and a man on its rails: told while it comes; met, knocked aside
  // (to the side he stood) and hurt by its speed - a moving wall that hits
  tramMan(v, e, G0) {
    const sp = Math.hypot(v.vel.x, v.vel.z);
    if (sp < 1) return null;
    const l = v.local(_v.set(e.x, 0, e.z), _w), S = v.spec;
    const fwd = Math.sign(v.vel.x * Math.cos(v.yaw) - v.vel.z * Math.sin(v.yaw)) || 1;
    const ax = l.x * fwd;     // ahead of its nose along its way
    if (Math.abs(l.z) > S.halfW + 0.45) return null;
    if (ax > S.halfL - 0.6 && ax < S.halfL + 0.75 && G0.time - (this.tramHitT ?? -9) > 1.2) {
      this.tramHitT = G0.time;
      const side = l.z >= 0 ? 1 : -1, s = Math.sin(v.yaw), c = Math.cos(v.yaw);
      // (aside at 7 m/s for 0.35 s, and on a little with it)
      this.knockV = { x: s * side * 7 + v.vel.x * 0.4, z: c * side * 7 + v.vel.z * 0.4, t: 0.35 };
      this.hurtBy = { by: 'tram', t: G0.time };
      const ctl = G0.controller;
      if (ctl) { if (ctl.shake) ctl.shake(1, 0); if (ctl.kick) ctl.kick(7, 9, 0.3); }
      G0.sfx.play('crash', e.clone(), { k: 0.8 }, { ref: 4 });
      G0.sfx.play('f_bodyFloor', null, {}, { send: false });
      G0.health.damage(Math.round(16 + 4.2 * sp));
      G0.emit('smash:tram', { at: e.clone(), k: 1, man: true });
      return 'The tram. Off the rails.';
    }
    if (ax > S.halfL - 0.6 && ax < S.halfL + 26) {
      // (the bell, again and again as it closes)
      if (G0.time - (this._bellT ?? -9) > 0.9) { this._bellT = G0.time; G0.sfx.play('c3_bell', v.pos, { k: 1 }, { ref: 8 }); }
      return 'The tram. Off the rails.';
    }
    return null;
  }
}

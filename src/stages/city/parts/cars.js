import * as THREE from 'three';
import { Cars, sedanTemplates } from '../../../world/Cars.js';
import { allocInkId, LAYER } from '../../../render/layers.js';
import { merge } from '../../../world/geom.js';
import { groundAt } from '../plan.js';
import { parkedOf } from '../layout.js';

// The city's cars. `cars` is the block's Cars (world/Cars.js: what fx/React
// and the sound ask every stage for): src/vehicles spawns the moving sedans
// through it (a round cracks the glass, breaks a lens, flattens a tyre).
// And the parked ones, at the kerbs of the two-lane streets and the
// avenue's outer lanes: instances of the block's sedan (four draws for all
// of them in each of two builds, the full one near the eye), each a body
// the cars' physics shunts (src/vehicles/Car.js: a box with a mass; it
// slides a little on its locked wheels and stops), rocked and marked by a
// blow. Nothing here ever blows up.
//   cars.parked: [body]   body: { pos, yaw, vel, yawRate, spec, box(), ... }
const NEAR = 42;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _e = new THREE.Euler();

export default {
  name: 'cars', order: 90, tick: 30,
  build(stage) {
    const C = Object.create(Cars.prototype);
    Object.assign(C, {
      world: stage, cars: [], fires: [], chains: [], game: null,
      rng: stage.rng.fork(4447), limRng: stage.rng.fork(4450), kindRng: stage.rng.fork(4451), fxRng: stage.rng.fork(4452),
    }, sedanTemplates());
    stage.onShadowLod((on) => C.shadowLod(on));
    const M = stage.M;
    // ---- the parked: where (layout.js) ------------------------------------------------
    const parked = parkedOf(stage.rng.fork(911));
    // ---- the parked: the model, instanced -------------------------------------------------
    const T = C.T, TL = C.TL;
    const group = (tpl) => ({
      paint: merge([tpl.paint]), chrome: merge([tpl.chrome, tpl.caps, tpl.seams]),
      dark: merge([tpl.rubber, tpl.dark, tpl.hubs, tpl.skirt].filter(Boolean)), glass: merge([tpl.glass, tpl.lenses]),
    });
    const parts = { hi: group(T), lo: group(TL) };
    const mats = { paint: M.paint, chrome: M.chrome, dark: M.rubber, glass: M.carGlass };
    const n = parked.length;
    const base = allocInkId(Math.max(1, n));
    const inst = {};
    for (const lod of ['hi', 'lo']) {
      inst[lod] = {};
      for (const k of Object.keys(mats)) {
        const im = new THREE.InstancedMesh(parts[lod][k], mats[k], n);
        im.userData.inkId = base;
        im.userData.inkFigure = true;
        im.userData.noRay = true;
        im.castShadow = lod === 'hi';
        im.receiveShadow = true;
        im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        im.count = 0;
        stage.scene.add(im);
        inst[lod][k] = im;
      }
    }
    // their contact shadows (the block's: a soft dark footprint)
    const shadowGeo = new THREE.PlaneGeometry(5.6, 2.5).rotateX(-Math.PI / 2);
    const shadow = new THREE.InstancedMesh(shadowGeo, contactMat(), n);
    shadow.layers.set(LAYER.FX); shadow.renderOrder = 3; shadow.userData.noRay = true; shadow.frustumCulled = false;
    stage.scene.add(shadow);
    const bodies = parked.map((p, i) => ({
      kind: 'parked', parked: true, i, pos: new THREE.Vector3(p.x, 0, p.z), yaw: p.yaw, vel: new THREE.Vector3(), yawRate: 0,
      home: { x: p.x, z: p.z, yaw: p.yaw },
      spec: { halfL: 2.45, halfW: 0.95, mass: 1.6, k: 1.32 }, solid: true, rock: 0, rockV: 0, dents: 0, woken: 9, lod: -1,
      box() { const c = Math.cos(this.yaw), s = Math.sin(this.yaw); return { cx: this.pos.x, cz: this.pos.z, hx: 2.45, hz: 0.95, c, s }; },
      emit(name, e) { if (name === 'bump' && e.imp > 1.5) { this.rockV += Math.min(1.2, e.imp * 0.08); this.dents++; if (e.imp > 4 && C.onParkedHit) C.onParkedHit(this, e); } },
      hurt() {},
    }));
    C.parked = bodies;
    // (the track's bodies include them: src/vehicles/Car.js shunts them; the
    // track is built after this part and takes them)
    const track = () => stage.part('track');
    const write = (b) => {
      const g = groundAt(b.pos.x, b.pos.z);
      _q.setFromEuler(_e.set(Math.sin(b.rock * 9) * 0.03 * Math.min(1, b.rockAmp || 0), b.yaw, 0, 'YXZ'));
      _m.compose(_p.set(b.pos.x, g, b.pos.z), _q, _s);
      return _m;
    };
    // the instances: the near ones in the full build, the rest in the light
    // one; rewritten when a body moves or the split changes
    const relayout = (camera) => {
      const p = camera ? camera.position : null;
      let nh = 0, nl = 0;
      for (const b of bodies) {
        const lod = p && Math.hypot(b.pos.x - p.x, b.pos.z - p.z) < NEAR ? 'hi' : 'lo';
        b.lod = lod;
        const m = write(b);
        const I = inst[lod], k = lod === 'hi' ? nh++ : nl++;
        for (const im of Object.values(I)) im.setMatrixAt(k, m);
        shadow.setMatrixAt(b.i, _m.compose(_p.set(b.pos.x, groundAt(b.pos.x, b.pos.z) + 0.012, b.pos.z), _q.setFromAxisAngle(_p.set(0, 1, 0), b.yaw), _s));
      }
      for (const im of Object.values(inst.hi)) { im.count = nh; im.instanceMatrix.needsUpdate = true; }
      for (const im of Object.values(inst.lo)) { im.count = nl; im.instanceMatrix.needsUpdate = true; }
      shadow.instanceMatrix.needsUpdate = true;
      for (const L of [inst.hi, inst.lo]) for (const im of Object.values(L)) { if (!im.boundingSphere) im.computeBoundingSphere(); }
    };
    relayout(null);
    for (const L of [inst.hi, inst.lo]) for (const im of Object.values(L)) { im.computeBoundingSphere(); im.boundingSphere.radius += 30; }
    let dealT = 0, moving = false;
    C.parkedUpdate = (dt, camera) => {
      // a shunted car slides on its locked wheels and stops; rocks and settles
      moving = false;
      for (const b of bodies) {
        if (b.vel.lengthSq() > 1e-4 || Math.abs(b.yawRate) > 1e-3) {
          b.pos.x += b.vel.x * dt; b.pos.z += b.vel.z * dt; b.yaw += b.yawRate * dt;
          b.vel.multiplyScalar(Math.exp(-4.5 * dt)); b.yawRate *= Math.exp(-5 * dt);
          if (b.vel.lengthSq() < 0.01) b.vel.set(0, 0, 0);
          if (Math.abs(b.yawRate) < 0.01) b.yawRate = 0;
          moving = true;
          // (against the walls: out of them, no further)
          const T2 = track();
          if (T2) for (const k of T2.statics(b.pos.x, b.pos.z, 4, b._near || (b._near = []))) {
            if (k.r != null || k.gone) continue;
            const o = obbPush(b, k);
            if (o) { b.pos.x += o[0]; b.pos.z += o[1]; b.vel.multiplyScalar(0.5); }
          }
        }
        if (b.rockV || b.rockAmp > 0.01) {
          b.rockAmp = Math.max(0, (b.rockAmp || 0) + b.rockV - dt * 1.6); b.rockV = 0; b.rock += dt; moving = true;
        }
      }
      dealT -= dt;
      if (moving || dealT <= 0) { if (dealT <= 0) dealT = 0.3; relayout(camera); }
    };
    // (a retry: every parked car back where it stood)
    C.parkedReset = () => { for (const b of bodies) { b.pos.set(b.home.x, 0, b.home.z); b.yaw = b.home.yaw; b.vel.set(0, 0, 0); b.yawRate = 0; b.rockAmp = 0; b.dents = 0; } relayout(null); };
    return C;
  },
  update: (C, dt, t, camera) => { C.lodUpdate(camera); C.parkedUpdate(dt, camera); },
};

// a body's box out of a static box: the push (least overlap), or null
function obbPush(b, k) {
  const ca = Math.cos(b.yaw), sa = Math.sin(b.yaw);
  const axes = [[ca, -sa], [sa, ca], [k.c, -k.s], [k.s, k.c]];
  const dx = k.cx - b.pos.x, dz = k.cz - b.pos.z;
  let best = Infinity, bn = null;
  for (const [ax, az] of axes) {
    const ra = 2.45 * Math.abs(ca * ax - sa * az) + 0.95 * Math.abs(sa * ax + ca * az);
    const rb = k.hx * Math.abs(k.c * ax - k.s * az) + k.hz * Math.abs(k.s * ax + k.c * az);
    const d = dx * ax + dz * az;
    const o = ra + rb - Math.abs(d);
    if (o <= 0) return null;
    if (o < best) { best = o; bn = d > 0 ? [-ax, -az] : [ax, az]; }
  }
  return [bn[0] * best, bn[1] * best];
}

let CONTACT = null;
function contactMat() {
  if (CONTACT) return CONTACT;
  const W = 128, H = 64, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.filter = 'blur(6px)';
  x.fillStyle = 'rgba(0,0,0,0.85)';
  x.beginPath(); x.roundRect(W * 0.1, H * 0.18, W * 0.8, H * 0.64, 14); x.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  CONTACT = new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: tex, transparent: true, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  return CONTACT;
}

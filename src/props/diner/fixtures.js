import * as THREE from 'three';
import { DINER } from '../../stages/block/site.js';
import { lathe, mergeGeos, slab, V3 } from '../lib.js';

// The pendant lamps (enamel cone shades 0.34 m across, dark outside, white
// inside, on cords; heads at y 2.60) and the two ceiling fans (40 rpm).
// A pendant is a lamp of the block's pool (stage.lamps.addCustom, real: it
// borrows the pooled spot lights; the room adds none of its own) and can
// swing on its cord (lamp.swing(impulse)), flicker, dip, and be shot out.
const D = DINER, P = D.pendants;

// the shade: a shallow enamel cone with a rolled rim, a neck for the cord
function shadeGeo() {
  // (listed rim to neck: the lathe's faces look outward)
  return lathe([[0.012, 0.19], [0.022, 0.185], [0.03, 0.165], [0.05, 0.14], [0.09, 0.085], [0.14, 0.035], [0.166, 0.008], [0.171, 0.002], [0.169, -0.004], [0.163, 0.0]].reverse(), 48);
}

export function buildPendants(kit, lamps) {
  const { M } = kit;
  const heads = [...P.z.map((z) => [P.x, z, P.half, 'counter']), ...P.booth.map(([x, z]) => [x, z, P.half * 0.9, 'booth'])];
  const shade = shadeGeo();
  const inner = lathe([[0.02, 0.17], [0.05, 0.135], [0.09, 0.08], [0.14, 0.03], [0.165, 0.004]], 40);
  const bulbGeo = new THREE.SphereGeometry(0.045, 20, 12).scale(1, 0.8, 1).translate(0, 0.05, 0);
  const disc = new THREE.CircleGeometry(0.15, 40).rotateX(Math.PI / 2).translate(0, 0.004, 0);
  const canopy = lathe([[0.0001, 0], [0.06, 0], [0.058, -0.012], [0.03, -0.04], [0.0001, -0.042]].reverse(), 24);
  const out = [];
  const shadeMat = M.std('shade', 0x0a0a0a, 0.35, 'enamel');
  for (const [x, z, half, kind] of heads) {
    kit.piece();
    const cordLen = D.ceilY - (P.headY + 0.19);
    // the pivot is the cord's anchor on the ceiling: the lamp swings on it
    const pivot = new THREE.Group();
    pivot.position.set(x, D.ceilY, z);
    kit.g.add(pivot);
    kit.add(canopy, M.iron, { parent: pivot, cast: false });
    const cord = kit.add(new THREE.CylinderGeometry(0.005, 0.005, cordLen, 6).translate(0, -cordLen / 2, 0), M.black, { parent: pivot, cast: false });
    void cord;
    const head = new THREE.Group();
    head.position.set(0, -(D.ceilY - P.headY), 0);
    pivot.add(head);
    kit.add(shade, shadeMat, { parent: head });
    kit.add(inner, M.lampInner, { parent: head, cast: false });
    const bulb = kit.add(mergeGeos([bulbGeo, disc]), M.bulb, { parent: head, cast: false });
    const lamp = lamps.addCustom({ head: V3(x, P.headY, z), axis: V3(0, -1, 0), height: P.headY - D.floorY, half, real: true, bulb, fadeEnd: 0.9, edgeSoft: 0.35, strength: 0.75, tag: 'pendant' });
    // (the pool light: brighter than a street lamp's share, a tighter
    // pool, so the counter goes paper white under it and falls off to
    // black between; the cone keeps its street-lamp strength)
    if (lamp.light) {
      lamp.light.intensity = kind === 'counter' ? 210 : 110;
      lamp.light.angle = 0.62;
      lamp.light.penumbra = 0.6;
      lamp.light.distance = 4.6;
    }
    // (out of sight it is off: no pool share, no cone, no rain light)
    lamp.on = false;
    lamp.dipBase = { cone: lamp.coneBase, light: lamp.light ? lamp.light.intensity : 0 };
    lamp.pivot = pivot;
    lamp.cordLen = D.ceilY - P.headY;
    lamp.sw = { x: 0, z: 0, vx: 0, vz: 0 };
    lamp.kind = kind;
    // lamp.swing(impulse): a push (m/s at the shade, a Vector3 or a number
    // along x) sets it swinging on its cord; it rings down
    lamp.swing = (imp = 1) => {
      const v = typeof imp === 'number' ? V3(imp, 0, 0) : imp;
      lamp.sw.vx += v.x / lamp.cordLen; lamp.sw.vz += v.z / lamp.cordLen;
    };
    out.push(lamp);
  }
  return out;
}

// one step of a pendant's swing: a damped pendulum on its cord; the shade,
// the cone, the rain / smoke entry and the pool light's aim follow
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _dn = new THREE.Vector3(0, -1, 0);
export function swingStep(l, dt) {
  const S = l.sw;
  const w2 = 9.8 / l.cordLen;
  S.vx += (-w2 * S.x - 0.7 * S.vx) * dt;
  S.vz += (-w2 * S.z - 0.7 * S.vz) * dt;
  S.x += S.vx * dt; S.z += S.vz * dt;
  S.x = Math.max(-0.6, Math.min(0.6, S.x)); S.z = Math.max(-0.6, Math.min(0.6, S.z));
  const moving = Math.abs(S.x) + Math.abs(S.z) + Math.abs(S.vx) + Math.abs(S.vz) > 1e-4;
  if (!moving && !l._swung) return;
  l._swung = moving;
  // (S.x, S.z: the angle toward +x / +z)
  l.pivot.rotation.set(-S.z, 0, S.x);
  _q.setFromEuler(_e.set(-S.z, 0, S.x));
  l.axis.copy(_dn).applyQuaternion(_q);
  l.head.set(l.pivot.position.x, l.pivot.position.y, l.pivot.position.z).addScaledVector(l.axis, l.cordLen);
  const cone = l.cone;
  cone.position.copy(l.head);
  cone.quaternion.setFromUnitVectors(_dn, l.axis);
  const u = cone.material.uniforms;
  if (u.uApex) u.uApex.value.copy(l.head);
  if (u.uAxis) u.uAxis.value.copy(l.axis);
  l.entry.position.copy(l.head);
  l.entry.direction.copy(l.axis);
  if (l.light) { l.light.pos.copy(l.head); l.light.target.copy(l.head).addScaledVector(l.axis, 3); }
}

// the ceiling fans: a canopy, a down-rod, a motor housing and four wooden
// blades, turning at 40 rpm (their shadows pass through the booth lamps'
// light and the counter's)
export function buildFans(kit) {
  const { M } = kit;
  const out = [];
  for (const [x, z] of [[-12.95, 6.75], [-12.95, 1.95]]) {
    kit.piece();
    const g = new THREE.Group();
    g.position.set(x, D.ceilY, z);
    kit.g.add(g);
    const rodLen = 0.32;
    const fixed = [
      lathe([[0.0001, -0.05], [0.03, -0.045], [0.07, -0.02], [0.075, 0], [0.0001, 0]], 28),
      new THREE.CylinderGeometry(0.013, 0.013, rodLen, 10).translate(0, -rodLen / 2, 0),
    ];
    kit.add(mergeGeos(fixed), M.iron, { parent: g, cast: false });
    const rotor = new THREE.Group();
    rotor.position.y = -rodLen;
    g.add(rotor);
    const housing = lathe([[0.0001, -0.16], [0.05, -0.155], [0.1, -0.12], [0.115, -0.08], [0.11, -0.04], [0.07, -0.01], [0.02, 0], [0.0001, 0]], 36);
    kit.add(housing, M.iron, { parent: rotor, cast: true });
    const blades = [];
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2;
      const b = slab(0.56, 0.008, 0.13, { bevel: 0.003, corner: 0.05 });
      // (a paddle: wider at the tip; pitched 12 degrees)
      const p = b.getAttribute('position');
      for (let i = 0; i < p.count; i++) { const bx = p.getX(i); p.setZ(i, p.getZ(i) * (0.75 + 0.35 * (bx / 0.56 + 0.5))); }
      b.computeVertexNormals();
      b.translate(0.39, 0, 0).rotateX(0.2).rotateY(a).translate(0, -0.1, 0);
      blades.push(b);
      blades.push(new THREE.BoxGeometry(0.12, 0.01, 0.03).translate(0.14, -0.098, 0).rotateY(a));
    }
    kit.add(mergeGeos(blades), M.std('fanBlade', 0x121212, 0.5, 'wood'), { parent: rotor, cast: true });
    out.push({ group: g, rotor, rpm: 40, speed: 1 });
  }
  return out;
}

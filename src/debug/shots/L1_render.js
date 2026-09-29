// Lane 1's presets (the render guard: reflections, the Look, accents, glass).
import * as THREE from 'three';
import { accentMaterial } from '../../render/accents.js';
import { makeWindowLightMaterial, makeRoomMaterial } from '../../render/glass.js';
import { allocInkId } from '../../render/layers.js';

const Q = () => new URLSearchParams(location.search);

// reflstudy (fix 8): one frame with four kinds of source and their sheens on
// the street: the left pavement's lamp post at z = -44 (~12.5 m), the lit
// windows of the near building (12-18 m), a burning wreck (~15 m: the grey
// sedan, moved up the avenue for the study) and the headlit sedan under the
// el (~30 m). The eye at 1.65 m looking along the road. Each sheen must
// touch its source's foot and run toward the eye, fading
// (__noir.pipeline.probeStreak(foot) measures one).
function stageReflStudy(stage, camera, controller, game) {
  const cars = stage.cars;
  const car = cars.cars[parseInt(Q().get('wreckcar') ?? '4', 10) || 0];
  cars.startSmoke(car, parseFloat(Q().get('fuse') ?? '1.0'), { force: true });
}

// The diner's stand-in room (lane 5 tags its real meshes itself): its
// materials tagged with interior surface classes by their stub colour, so
// the calm interior ink can be judged before lane 5's room lands.
const STUB_SURF = { 0x1c1c1c: 'lino', 0x4a4a4a: 'plaster', 0x161616: 'wood', 0x121212: 'plaster', 0x202020: 'wood',
  0x9a9a9a: 'enamel', 0x141414: 'wood', 0x101010: 'leather', 0x3a3a3a: 'wood', 0x2a2a2a: 'metal' };
function tagDinerStub(stage) {
  stage.scene.traverse((o) => {
    if (!o.isMesh || o.userData.inkSurface || !o.material || !o.material.color) return;
    let p = o, inDiner = false;
    while (p) { if (p.name === 'diner') { inDiner = true; break; } p = p.parent; }
    if (!inDiner) return;
    const k = STUB_SURF[o.material.color.getHex()];
    if (k) o.userData.inkSurface = k;
  });
}

// accents: the seven registry keys as small objects 2 m in front of the eye,
// 1.2 m above the wet street, left to right: blood, fire, ember, flame,
// amber, neon, crew (&drag=1: the ember at gain 3, a drag)
function stageAccents(stage, camera) {
  const g = new THREE.Group();
  g.name = 'accentCard';
  const eye = camera.position;
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).setY(0).normalize();
  const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
  const at = eye.clone().setY(0).addScaledVector(fwd, 2.0).setY(1.25);
  const mk = (geo, key, i, opts) => {
    const m = new THREE.Mesh(geo, accentMaterial(key, opts));
    m.position.copy(at).addScaledVector(right, (i - 3) * 0.2);
    m.userData.inkId = allocInkId();
    m.castShadow = false;
    g.add(m);
    return m;
  };
  mk(new THREE.SphereGeometry(0.025, 24, 16), 'blood', 0);
  mk(new THREE.ConeGeometry(0.045, 0.12, 24), 'fire', 1);
  mk(new THREE.SphereGeometry(0.012, 20, 14), 'ember', 2, { gain: Q().get('drag') === '1' ? 3 : 1 });
  const tongue = [];
  for (let i = 0; i <= 16; i++) { const t = i / 16; tongue.push(new THREE.Vector2(0.016 * Math.sin(Math.PI * Math.pow(t, 0.7)) * (1 - 0.35 * t), t * 0.09)); }
  mk(new THREE.LatheGeometry(tongue, 24), 'flame', 3).position.y -= 0.04;
  mk(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 32), 'amber', 4);
  mk(new THREE.TorusGeometry(0.055, 0.006, 12, 48), 'neon', 5).rotation.y = Math.atan2(fwd.x, fwd.z);
  const crew = mk(new THREE.BoxGeometry(0.04, 0.05, 0.012), 'crew', 6);
  crew.rotation.y = Math.atan2(fwd.x, fwd.z) + 0.4;
  g.updateMatrixWorld(true);
  stage.scene.add(g);
}

// windowlight: the street lamps' light thrown through the diner's wet
// windows onto its floor (bays B1, B2: a patch skewed away from the window as
// the light falls in from above) and one with a half-lowered blind (B4, on
// the floor by the booth); &sweep=<t0>: the el train's bar crosses them from
// game time t0; &rooms=1 adds P2's fake rooms (see roomstudy)
function stageWindowLight(stage, camera, controller, game) {
  tagDinerStub(stage);
  // (&dark=1: the pendants off, the room lit by the street alone)
  if (Q().get('dark') === '1') {
    const d = stage.part('diner');
    game.scripts.push(() => { for (const l of (d && d.lamps) || []) stage.lamps.setOn(l, false); });
  }
  const sweep = Q().get('sweep');
  const add = (z, slats) => {
    const w = 2.6, h = 2.2;
    const m = makeWindowLightMaterial({ w, h, slats });
    // a quad on the floor, from the wall inward, wider as it goes (the
    // window's shape thrown in perspective)
    const g = new THREE.BufferGeometry();
    const x0 = -12.3, x1 = x0 - h * 0.9, y = 0.155;   // across the aisle, past the booths
    g.setAttribute('position', new THREE.Float32BufferAttribute([x0, y, z - w * 0.4, x0, y, z + w * 0.4, x1, y, z + w * 0.55, x1, y, z - w * 0.55], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const mesh = new THREE.Mesh(g, m);
    mesh.layers.set(2);   // LAYER.FX: scene pass only (light on the floor, not a surface)
    stage.scene.add(mesh);
    if (sweep) m.userData.sweep(parseFloat(sweep), 0.9);
    return mesh;
  };
  add(9.4, 0); add(5.0, 0); add(-3.8, 7);
}

// roomstudy: P2's fake rooms behind far panes: a row of third- and
// fourth-floor windows laid on the near building's face (x = -10.2) down the
// avenue, seen from the street (&lit=1: a lamp on in every other room)
function stageRooms(stage) {
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), makeRoomMaterial({ seed: i * 7 + j * 3, lit: Q().get('lit') === '1' && (i + j) % 2 ? 1 : 0 }));
    m.scale.set(1.3, 2.0, 1);
    m.position.set(-10.12, 4.4 + j * 3.2, -40.0 - i * 4.4);
    m.rotation.y = Math.PI / 2;           // facing the street (+x)
    m.userData.inkId = allocInkId();
    stage.scene.add(m);
  }
}

export const presets = {
  windowlight: { x: -12.9, z: 11.0, y: -0.05, yaw: 0.35, pitch: -0.45, fov: 64, t: 4, stage: stageWindowLight },
  roomstudy: { x: 1.5, z: -33.0, yaw: 0.55, pitch: 0.3, fov: 60, t: 4, stage: stageRooms },
  // glassstudy: the diner's plate glass (bay B2, 3.55 x 2.2 m) from 2 m
  // inside, the street beyond; &t=12 against the default t=4: the water has
  // moved (beads come and go, runners have run)
  glassstudy: { x: -12.25, z: 5.0, y: -0.05, yaw: -Math.PI / 2, pitch: 0.06, fov: 66, t: 4,
    stage(stage) { if (Q().get('notag') !== '1') tagDinerStub(stage); } },
  accents: { x: 0.8, z: -12.0, yaw: 0.0, pitch: -0.42, fov: 60, t: 4, stage: stageAccents },
  // inside the diner, standing in the aisle at the door end, looking down the
  // counter: the pendants' cones in the smoke, the calm interior ink, the
  // rain beyond the glass (dinerlook&notag=1: the untagged stand-in)
  dinerlook: { x: -12.9, z: 9.8, y: -0.05, yaw: 0.12, pitch: -0.05, fov: 62, t: 3,
    stage(stage) { if (Q().get('notag') !== '1') tagDinerStub(stage); } },
  // the same room looking out through the plate glass at the street
  dinerwindow: { x: -13.6, z: 3.0, y: -0.05, yaw: -Math.PI / 2 - 0.35, pitch: 0.02, fov: 62, t: 3,
    stage(stage) { if (Q().get('notag') !== '1') tagDinerStub(stage); } },
  reflstudy: { x: 1.2, z: -47.5, y: 0.0, yaw: 0.05, pitch: 0.0, fov: 62, t: 8, stage: stageReflStudy },
};
